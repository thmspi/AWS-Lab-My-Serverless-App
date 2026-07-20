# Préparer le lab

**Durée : 5 minutes · Région : `us-east-1` · Public : débutants**

## Ce que vous allez construire

> **IMPORTANT** :
> Les environnements **AWS Academy Learner Lab ne permettent pas de créer une distribution CloudFront**. Dans cet environnement, ne tentez pas d'exécuter cette étape : lisez-la comme une extension optionnelle et conservez l'hébergement S3 réalisé précédemment. Pour la mettre en pratique, utilisez un compte AWS personnel compatible en surveillant les coûts et en supprimant les ressources à la fin du lab.

Le jeu fourni fonctionne intégralement dans le navigateur. Vous allez déployer :

1. Amazon S3 pour héberger les fichiers statiques ;
2. Amazon Cognito pour créer et connecter les joueurs ;
3. API Gateway, Lambda et DynamoDB pour conserver les records ;
4. CloudFront pour servir le site en HTTPS depuis un bucket privé.

À la fin de l'étape 3, seuls les utilisateurs connectés peuvent consulter le top 10 ou enregistrer un score.

## Pré requis

- une sandbox **AWS Academy Learner Lab** démarrée ;
- un accès console autorisé à S3, Cognito, DynamoDB, Lambda et API Gateway ;
- une adresse email accessible pour recevoir le code Cognito ;
- ce repository téléchargé et décompressé sur votre poste.

Dans la console, sélectionnez `N. Virginia / us-east-1`. Utilisez cette même région pour Cognito, Lambda, DynamoDB et API Gateway.

> **AWS Academy.** Le rôle `LabRole` est géré par la sandbox et possède plus de permissions que la Lambda n'en utiliserait normalement. Ne le supprimez pas et ne tentez pas de le modifier. Une politique minimale de production est fournie pour comparaison.

## Nommage et fiche de valeurs

Choisissez un suffixe court et unique, par exemple vos initiales suivies de quatre chiffres. Réutilisez-le partout.

| Valeur | Exemple | Votre valeur |
|---|---|---|
| Suffixe | `td-4821` | |
| Bucket | `serverless-dino-td-4821` | |
| User Pool | `dino-users-td-4821` | |
| ... | ... | |
## Suite

Commencez par [héberger le jeu sur S3](01-hebergement-s3.md).
