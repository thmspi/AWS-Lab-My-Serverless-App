# Site Serverless Dino

Le frontend est une application statique vanilla : HTML, CSS, Canvas et JavaScript. AWS Amplify Auth est bundlé lors du build ; les étudiants n'ont ni Node.js ni npm à utiliser pendant le lab.

## Pour les étudiants

1. Ouvrir [`dist/config.js`](dist/config.js).
2. Remplacer progressivement les quatre placeholders.
3. Uploader **le contenu** de `dist/` à la racine du bucket, pas le dossier `dist` lui-même.

```js
globalThis.DINO_CONFIG = Object.freeze({
  AWS_REGION: 'us-east-1',
  USER_POOL_ID: '__USER_POOL_ID__',
  USER_POOL_CLIENT_ID: '__USER_POOL_CLIENT_ID__',
  API_BASE_URL: '__API_BASE_URL__',
});
```

`USER_POOL_ID`, `USER_POOL_CLIENT_ID` et l'URL API sont des identifiants publics. Un client secret, une access key ou un mot de passe ne doivent jamais apparaître dans ce fichier.

## Pour les mainteneurs

```bash
npm install
npm test
npm run build
```

Le build Vite copie `public/config.js` sans le transformer afin que les étudiants puissent le modifier après compilation.

