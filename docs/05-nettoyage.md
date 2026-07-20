# Nettoyer les ressources du lab

**Durée : 5 minutes avec Reset environment, ou 10 minutes manuellement · Objectif : ne laisser aucune ressource facturable ou publique**

Arrêter une session AWS Academy ne remplace pas toujours un nettoyage volontaire. Supprimez les ressources dans l'ordre ci-dessous.

> [!TIP]
> Si vous utilisez un **AWS Academy Learner Lab** et ne souhaitez conserver aucune ressource, vous pouvez retourner sur la page du lab puis choisir **Reset environment**. Cette opération réinitialise l'environnement et détruit toutes les ressources que vous y avez déployées. Utilisez-la uniquement après avoir vérifié que vous n'avez rien à conserver. Dans ce cas, le nettoyage manuel détaillé ci-dessous n'est pas nécessaire.

## 1. CloudFront — si créé

1. Ouvrez la distribution.
2. Si elle utilise le **Free plan** ou un autre plan forfaitaire, ouvrez **Manage plan**, choisissez **Cancel plan** et confirmez. L'annulation du plan gratuit est immédiate.
3. Choisissez **Disable** et attendez la fin du déploiement.
4. Choisissez **Delete** et confirmez.

CloudFront interdit la suppression tant qu'un plan est associé et impose ensuite la désactivation de la distribution. La propagation peut dépasser le temps du reste du nettoyage ; revenez-y à la fin.

## 2. API Gateway

1. Ouvrez **API Gateway > APIs**.
2. Sélectionnez `dino-api-<suffixe>`.
3. Choisissez **Delete**.

La permission d'invocation ajoutée à la Lambda n'a plus d'utilité après cette suppression.

## 3. Lambda et logs

1. Supprimez `dino-score-api-<suffixe>` dans Lambda.
2. Ouvrez **CloudWatch > Log groups**.
3. Supprimez `/aws/lambda/dino-score-api-<suffixe>` si la sandbox le permet.

Ne supprimez pas `LabRole` : il appartient à AWS Academy.

## 4. DynamoDB

1. Ouvrez **DynamoDB > Tables**.
2. Sélectionnez `dino-scores-<suffixe>`.
3. Choisissez **Delete** et confirmez le nom.

La table et son GSI sont supprimés ensemble.

## 5. Cognito

1. Ouvrez le User Pool `dino-users-<suffixe>`.
2. Supprimez-le depuis le menu **Delete user pool**.
3. Confirmez son nom.

Les utilisateurs, attributs et jetons de refresh associés sont invalidés avec le pool.

## 6. S3

1. Ouvrez le bucket `serverless-dino-<suffixe>`.
2. Choisissez **Empty** et confirmez `permanently delete`.
3. Revenez à la liste des buckets, puis choisissez **Delete**.

Si CloudFront existe encore, terminez d'abord sa suppression pour ne pas conserver une distribution pointant vers un bucket absent.

## Vérification finale

- [ ] Distribution CloudFront absente ou suppression en cours.
- [ ] REST API supprimée.
- [ ] Lambda et log group supprimés.
- [ ] Table DynamoDB supprimée.
- [ ] User Pool supprimé.
- [ ] Bucket vidé puis supprimé.
- [ ] Aucun secret ou token copié dans les fichiers locaux.

## Pour aller plus loin

- recréer la même architecture avec AWS SAM, CDK ou Terraform ;
- ajouter un domaine Route 53 et un certificat ACM à CloudFront ;
- utiliser AWS WAF et des quotas adaptés au trafic réel ;
- produire des métriques Powertools et des alarmes CloudWatch ;
- concevoir un protocole serveur pour limiter la falsification des scores ;
- automatiser les tests de contrat et le déploiement continu du frontend.
