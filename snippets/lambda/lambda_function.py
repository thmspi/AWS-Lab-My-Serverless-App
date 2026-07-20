"""API du leaderboard Dino — conçue pour l'éditeur de code Lambda.

Les routes et la gestion d'erreurs restent volontairement au début du fichier.
La validation, la logique métier et les appels DynamoDB sont regroupés ensuite.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

import boto3
from aws_lambda_powertools import Logger
from aws_lambda_powertools.event_handler import APIGatewayRestResolver, CORSConfig, Response
from aws_lambda_powertools.logging import correlation_paths
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError


SERVICE_NAME = "dino-score-api"
GAME_ID = "serverless-dino"
LEADERBOARD_INDEX = "gameId-bestScore-index"
MAX_SCORE = 1_000_000

logger = Logger(service=SERVICE_NAME)

allowed_origins = [
    origin.strip()
    for origin in os.environ.get("ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]
if not allowed_origins:
    raise RuntimeError("ALLOWED_ORIGINS doit contenir au moins une origine explicite.")

cors = CORSConfig(
    allow_origin=allowed_origins[0],
    extra_origins=allowed_origins[1:],
    allow_headers=["Authorization", "Content-Type"],
    max_age=300,
)
app = APIGatewayRestResolver(cors=cors)
score_table = boto3.resource("dynamodb").Table(os.environ["TABLE_NAME"])


class ValidationError(ValueError):
    """Le corps reçu ne représente pas un score acceptable."""


class AuthenticationContextError(RuntimeError):
    """API Gateway n'a pas fourni les claims attendus."""


@dataclass(frozen=True, slots=True)
class Identity:
    """Identité minimale dérivée d'un JWT déjà vérifié par API Gateway."""

    user_id: str
    username: str


# ---------------------------------------------------------------------------
# Routes déclaratives
# ---------------------------------------------------------------------------


@app.get("/leaderboard")
def leaderboard_route() -> dict[str, list[dict[str, Any]]]:
    """Retourne les dix meilleurs scores du jeu."""
    return get_leaderboard(score_table)


@app.get("/me")
def personal_score_route() -> dict[str, str | int]:
    """Retourne le record de l'utilisateur authentifié."""
    return get_personal_score(score_table, current_identity())


@app.put("/me/score")
def update_score_route() -> dict[str, bool | int]:
    """Enregistre un score uniquement lorsqu'il améliore le record existant."""
    try:
        payload = app.current_event.json_body
    except (json.JSONDecodeError, TypeError) as error:
        raise ValidationError from error

    score = validate_score(payload)
    return update_best_score(
        table=score_table,
        identity=current_identity(),
        score=score,
        now=datetime.now(UTC).isoformat(),
    )


# ---------------------------------------------------------------------------
# Gestion d'erreurs au niveau API
# ---------------------------------------------------------------------------


@app.exception_handler(ValidationError)
def handle_validation_error(error: ValidationError) -> Response:
    logger.warning("Score refusé", reason=str(error))
    return error_response(
        status_code=400,
        code="VALIDATION_ERROR",
        message="Le score doit être un entier entre 0 et 1000000.",
    )


@app.exception_handler(AuthenticationContextError)
def handle_authentication_context_error(error: AuthenticationContextError) -> Response:
    logger.warning("Claims Cognito absents ou incomplets", reason=str(error))
    return error_response(
        status_code=401,
        code="AUTHENTICATION_REQUIRED",
        message="Une session valide est requise.",
    )


@app.exception_handler(Exception)
def handle_unexpected_error(error: Exception) -> Response:
    # Ne jamais retourner les détails AWS, la stack trace ou le token au client.
    logger.exception("Erreur inattendue pendant le traitement de la requête", error=error)
    return error_response(
        status_code=500,
        code="INTERNAL_ERROR",
        message="Le service est temporairement indisponible.",
    )


@logger.inject_lambda_context(
    correlation_id_path=correlation_paths.API_GATEWAY_REST,
    log_event=False,
)
def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Point d'entrée Lambda : Powertools résout la route déclarée plus haut."""
    # Journaliser uniquement des métadonnées non sensibles. L'événement complet
    # contient notamment le JWT, les en-têtes et parfois le corps de la requête.
    logger.info(
        "Requête API reçue",
        method=event.get("httpMethod"),
        path=event.get("path"),
    )
    return app.resolve(event, context)


# ---------------------------------------------------------------------------
# Validation et logique métier
# ---------------------------------------------------------------------------


def validate_score(payload: Any) -> int:
    """Valide strictement le seul champ métier accepté depuis le navigateur."""
    if not isinstance(payload, dict):
        raise ValidationError("Le corps doit être un objet JSON.")
    if set(payload) != {"score"}:
        raise ValidationError("Le corps ne doit contenir que le score.")

    score = payload.get("score")
    if isinstance(score, bool) or not isinstance(score, int):
        raise ValidationError("Le score doit être un entier.")
    if not 0 <= score <= MAX_SCORE:
        raise ValidationError("Le score est hors limites.")
    return score


def current_identity() -> Identity:
    """Extrait l'identité du contexte Cognito construit par l'authorizer."""
    authorizer = app.current_event.request_context.authorizer
    claims = authorizer.claims if authorizer else None
    return identity_from_claims(claims or {})


def identity_from_claims(claims: dict[str, Any]) -> Identity:
    """Ignore volontairement toute identité envoyée dans le corps ou l'URL."""
    user_id = claims.get("sub")
    username = claims.get("cognito:username")
    if not isinstance(user_id, str) or not user_id:
        raise AuthenticationContextError("Claim sub manquant.")
    if not isinstance(username, str) or not username:
        raise AuthenticationContextError("Claim cognito:username manquant.")
    return Identity(user_id=user_id, username=username)


def get_personal_score(table: Any, identity: Identity) -> dict[str, str | int]:
    """Retourne zéro tant que l'utilisateur n'a pas terminé une partie."""
    response = table.get_item(
        Key={"userId": identity.user_id},
        ProjectionExpression="username, bestScore",
    )
    item = response.get("Item")
    return {
        "username": identity.username,
        "bestScore": int(item["bestScore"]) if item else 0,
    }


def update_best_score(
    *,
    table: Any,
    identity: Identity,
    score: int,
    now: str,
) -> dict[str, bool | int]:
    """Effectue un upsert atomique seulement lorsque le record progresse."""
    try:
        response = table.update_item(
            Key={"userId": identity.user_id},
            UpdateExpression=(
                "SET gameId = :game, username = :username, "
                "bestScore = :score, updatedAt = :updated_at"
            ),
            ConditionExpression=(
                "attribute_not_exists(bestScore) OR bestScore < :score"
            ),
            ExpressionAttributeValues={
                ":game": GAME_ID,
                ":username": identity.username,
                ":score": score,
                ":updated_at": now,
            },
            ReturnValues="ALL_NEW",
        )
        return {
            "updated": True,
            "bestScore": int(response["Attributes"]["bestScore"]),
        }
    except ClientError as error:
        if error.response.get("Error", {}).get("Code") != "ConditionalCheckFailedException":
            raise

    # Une lecture séparée après l'échec retourne le record désormais courant,
    # y compris si une autre requête concurrente vient de l'améliorer.
    response = table.get_item(
        Key={"userId": identity.user_id},
        ProjectionExpression="bestScore",
    )
    current_score = response.get("Item", {}).get("bestScore", Decimal(0))
    return {"updated": False, "bestScore": int(current_score)}


def get_leaderboard(table: Any) -> dict[str, list[dict[str, Any]]]:
    """Interroge le GSI, sans Scan, et limite les données retournées."""
    response = table.query(
        IndexName=LEADERBOARD_INDEX,
        KeyConditionExpression=Key("gameId").eq(GAME_ID),
        ProjectionExpression="username, bestScore",
        ScanIndexForward=False,
        Limit=10,
    )
    items = [
        {
            "rank": rank,
            "username": item["username"],
            "bestScore": int(item["bestScore"]),
        }
        for rank, item in enumerate(response.get("Items", []), start=1)
    ]
    return {"items": items}


def error_response(*, status_code: int, code: str, message: str) -> Response:
    """Produit l'enveloppe d'erreur publique commune à toutes les routes."""
    return Response(
        status_code=status_code,
        content_type="application/json",
        body=json.dumps({"error": {"code": code, "message": message}}),
    )
