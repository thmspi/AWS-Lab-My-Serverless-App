export class ApiError extends Error {
  constructor(message, { status = 0, code = 'NETWORK_ERROR' } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}


export function createApiClient({ baseUrl, getIdToken, fetchImpl = globalThis.fetch }) {
  if (!baseUrl?.startsWith('https://')) {
    throw new Error("Une URL d'API HTTPS est requise.");
  }

  async function request(path, options = {}) {
    const token = await getIdToken();
    if (!token) {
      throw new ApiError('Connectez-vous pour accéder au classement.', {
        status: 401,
        code: 'AUTHENTICATION_REQUIRED',
      });
    }

    let response;
    try {
      response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}${path}`, {
        ...options,
        headers: {
          Authorization: token,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });
    } catch {
      throw new ApiError("Impossible de joindre l'API. Vérifiez l'URL et CORS.");
    }

    const isJson = response.headers.get('content-type')?.includes('application/json');
    const payload = isJson ? await response.json() : {};
    if (!response.ok) {
      throw new ApiError(
        payload?.error?.message ?? 'La requête a échoué.',
        { status: response.status, code: payload?.error?.code ?? 'HTTP_ERROR' },
      );
    }
    return payload;
  }

  return {
    getLeaderboard: () => request('/leaderboard'),
    getPersonalScore: () => request('/me'),
    submitScore: (score) => request('/me/score', {
      method: 'PUT',
      body: JSON.stringify({ score }),
    }),
  };
}

