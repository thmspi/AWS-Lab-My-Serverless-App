import { Amplify } from 'aws-amplify';
import {
  confirmSignUp,
  fetchAuthSession,
  getCurrentUser,
  signIn,
  signOut,
  signUp,
} from 'aws-amplify/auth';
import { cognitoUserPoolsTokenProvider } from 'aws-amplify/auth/cognito';
import { sessionStorage } from 'aws-amplify/utils';


export function configureAuth(config) {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: config.USER_POOL_ID,
        userPoolClientId: config.USER_POOL_CLIENT_ID,
        signUpVerificationMethod: 'code',
        loginWith: { username: true },
      },
    },
  });
  cognitoUserPoolsTokenProvider.setKeyValueStorage(sessionStorage);
}


export async function registerUser({ username, email, password }) {
  return signUp({
    username: username.trim(),
    password,
    options: {
      userAttributes: { email: email.trim() },
      autoSignIn: false,
    },
  });
}


export async function confirmUser({ username, code }) {
  return confirmSignUp({
    username: username.trim(),
    confirmationCode: code.trim(),
  });
}


export async function loginUser({ username, password }) {
  return signIn({ username: username.trim(), password });
}


export async function logoutUser() {
  await signOut();
}


export async function readCurrentUser() {
  try {
    return await getCurrentUser();
  } catch {
    return null;
  }
}


export async function getIdToken() {
  const session = await fetchAuthSession();
  return session.tokens?.idToken?.toString() ?? null;
}

