import importlib
import json
import os
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from botocore.exceptions import ClientError


LAMBDA_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(LAMBDA_DIR))
os.environ.setdefault("AWS_DEFAULT_REGION", "us-east-1")
os.environ.setdefault("AWS_EC2_METADATA_DISABLED", "true")
os.environ.setdefault("TABLE_NAME", "dino-lab-scores")
os.environ.setdefault("ALLOWED_ORIGINS", "http://example.test")

lambda_function = importlib.import_module("lambda_function")

LAMBDA_CONTEXT = SimpleNamespace(
    function_name="dino-score-api",
    memory_limit_in_mb=128,
    invoked_function_arn="arn:aws:lambda:us-east-1:123456789012:function:dino-score-api",
    aws_request_id="test-request",
)


def make_event(method: str, path: str, *, body=None, claims=None, origin="http://example.test"):
    return {
        "resource": "/{proxy+}",
        "path": path,
        "httpMethod": method,
        "headers": {"Origin": origin, "Content-Type": "application/json"},
        "multiValueHeaders": {},
        "queryStringParameters": None,
        "multiValueQueryStringParameters": None,
        "pathParameters": {"proxy": path.lstrip("/")},
        "stageVariables": None,
        "requestContext": {
            "requestId": "test-request",
            "stage": "prod",
            "identity": {"sourceIp": "127.0.0.1"},
            "authorizer": {
                "claims": claims
                or {"sub": "user-123", "cognito:username": "alice"}
            },
        },
        "body": json.dumps(body) if body is not None else None,
        "isBase64Encoded": False,
    }


@pytest.mark.parametrize("score", [0, 1, 1_000_000])
def test_validate_score_accepts_integer_boundaries(score):
    assert lambda_function.validate_score({"score": score}) == score


@pytest.mark.parametrize(
    "payload",
    [
        None,
        {},
        {"score": True},
        {"score": 1.5},
        {"score": "10"},
        {"score": -1},
        {"score": 1_000_001},
        {"score": 10, "username": "mallory"},
    ],
)
def test_validate_score_rejects_invalid_payloads(payload):
    with pytest.raises(lambda_function.ValidationError):
        lambda_function.validate_score(payload)


def test_identity_is_derived_from_verified_claims():
    identity = lambda_function.identity_from_claims(
        {"sub": "user-123", "cognito:username": "alice", "email": "private@example.test"}
    )

    assert identity.user_id == "user-123"
    assert identity.username == "alice"


@pytest.mark.parametrize("claims", [{}, {"sub": "user-123"}, {"cognito:username": "alice"}])
def test_identity_rejects_missing_claims(claims):
    with pytest.raises(lambda_function.AuthenticationContextError):
        lambda_function.identity_from_claims(claims)


def test_update_best_score_returns_new_record():
    table = Mock()
    table.update_item.return_value = {"Attributes": {"bestScore": 420}}

    result = lambda_function.update_best_score(
        table=table,
        identity=lambda_function.Identity("user-123", "alice"),
        score=420,
        now="2026-07-20T12:00:00+00:00",
    )

    assert result == {"updated": True, "bestScore": 420}
    request = table.update_item.call_args.kwargs
    assert request["Key"] == {"userId": "user-123"}
    assert "bestScore < :score" in request["ConditionExpression"]


def test_update_best_score_keeps_existing_record_after_conditional_failure():
    table = Mock()
    table.update_item.side_effect = ClientError(
        {"Error": {"Code": "ConditionalCheckFailedException", "Message": "condition failed"}},
        "UpdateItem",
    )
    table.get_item.return_value = {"Item": {"bestScore": 900}}

    result = lambda_function.update_best_score(
        table=table,
        identity=lambda_function.Identity("user-123", "alice"),
        score=100,
        now="2026-07-20T12:00:00+00:00",
    )

    assert result == {"updated": False, "bestScore": 900}


def test_update_best_score_reraises_unexpected_dynamodb_error():
    table = Mock()
    table.update_item.side_effect = ClientError(
        {"Error": {"Code": "ProvisionedThroughputExceededException", "Message": "slow down"}},
        "UpdateItem",
    )

    with pytest.raises(ClientError):
        lambda_function.update_best_score(
            table=table,
            identity=lambda_function.Identity("user-123", "alice"),
            score=100,
            now="2026-07-20T12:00:00+00:00",
        )


def test_get_leaderboard_queries_gsi_in_descending_order():
    table = Mock()
    table.query.return_value = {
        "Items": [
            {"username": "alice", "bestScore": 900},
            {"username": "bob", "bestScore": 600},
        ]
    }

    result = lambda_function.get_leaderboard(table)

    assert result == {
        "items": [
            {"rank": 1, "username": "alice", "bestScore": 900},
            {"rank": 2, "username": "bob", "bestScore": 600},
        ]
    }
    request = table.query.call_args.kwargs
    assert request["IndexName"] == "gameId-bestScore-index"
    assert request["ScanIndexForward"] is False
    assert request["Limit"] == 10


def test_get_me_returns_zero_before_first_score():
    table = Mock()
    table.get_item.return_value = {}

    assert lambda_function.get_personal_score(
        table, lambda_function.Identity("user-123", "alice")
    ) == {"username": "alice", "bestScore": 0}


def test_lambda_handler_routes_authenticated_leaderboard(monkeypatch):
    table = Mock()
    table.query.return_value = {"Items": [{"username": "alice", "bestScore": 42}]}
    monkeypatch.setattr(lambda_function, "score_table", table)

    response = lambda_function.lambda_handler(make_event("GET", "/leaderboard"), LAMBDA_CONTEXT)

    assert response["statusCode"] == 200
    assert json.loads(response["body"])["items"][0]["bestScore"] == 42
    assert response["multiValueHeaders"]["Access-Control-Allow-Origin"] == ["http://example.test"]


def test_lambda_handler_logs_only_request_method_and_path(monkeypatch):
    table = Mock()
    table.query.return_value = {"Items": []}
    log_info = Mock()
    monkeypatch.setattr(lambda_function, "score_table", table)
    monkeypatch.setattr(lambda_function.logger, "info", log_info)

    event = make_event("GET", "/leaderboard")
    event["headers"]["Authorization"] = "Bearer secret-jwt"
    event["body"] = json.dumps({"secret": "must-not-be-logged"})

    response = lambda_function.lambda_handler(event, LAMBDA_CONTEXT)

    assert response["statusCode"] == 200
    log_info.assert_called_once_with(
        "Requête API reçue",
        method="GET",
        path="/leaderboard",
    )


def test_lambda_handler_maps_validation_error_to_400(monkeypatch):
    monkeypatch.setattr(lambda_function, "score_table", Mock())

    response = lambda_function.lambda_handler(
        make_event("PUT", "/me/score", body={"score": "forged"}), LAMBDA_CONTEXT
    )

    assert response["statusCode"] == 400
    assert json.loads(response["body"]) == {
        "error": {"code": "VALIDATION_ERROR", "message": "Le score doit être un entier entre 0 et 1000000."}
    }


def test_lambda_handler_does_not_accept_identity_from_body(monkeypatch):
    table = Mock()
    monkeypatch.setattr(lambda_function, "score_table", table)

    response = lambda_function.lambda_handler(
        make_event(
            "PUT",
            "/me/score",
            body={"score": 100, "userId": "attacker-choice", "username": "mallory"},
        ),
        LAMBDA_CONTEXT,
    )

    assert response["statusCode"] == 400
    table.update_item.assert_not_called()
