const PLACEHOLDER_PATTERN = /^__.+__$/;


function hasValue(value) {
  return typeof value === 'string' && value.trim() !== '' && !PLACEHOLDER_PATTERN.test(value.trim());
}


export function inspectConfiguration(rawConfig = {}) {
  const config = {
    AWS_REGION: rawConfig.AWS_REGION?.trim() ?? '',
    USER_POOL_ID: rawConfig.USER_POOL_ID?.trim() ?? '',
    USER_POOL_CLIENT_ID: rawConfig.USER_POOL_CLIENT_ID?.trim() ?? '',
    API_BASE_URL: rawConfig.API_BASE_URL?.trim().replace(/\/$/, '') ?? '',
  };
  const authKeys = ['AWS_REGION', 'USER_POOL_ID', 'USER_POOL_CLIENT_ID'];
  const missingAuth = authKeys.filter((key) => !hasValue(config[key]));

  let apiError = '';
  if (hasValue(config.API_BASE_URL) && !config.API_BASE_URL.startsWith('https://')) {
    apiError = "L'URL de l'API doit utiliser HTTPS.";
  }

  return {
    config,
    authReady: missingAuth.length === 0,
    apiReady: hasValue(config.API_BASE_URL) && apiError === '',
    missingAuth,
    apiError,
  };
}


export function readRuntimeConfiguration() {
  return inspectConfiguration(globalThis.DINO_CONFIG ?? {});
}

