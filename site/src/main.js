import './styles.css';

import {
  configureAuth,
  confirmUser,
  getIdToken,
  loginUser,
  logoutUser,
  readCurrentUser,
  registerUser,
} from './auth.js';
import { createApiClient } from './api.js';
import { readRuntimeConfiguration } from './config.js';
import { DinoGame } from './game.js';


const runtime = readRuntimeConfiguration();
const elements = {
  accountButton: document.querySelector('#account-button'),
  accountDialog: document.querySelector('#account-dialog'),
  apiMessage: document.querySelector('#api-message'),
  authForms: document.querySelector('#auth-forms'),
  authMessage: document.querySelector('#auth-message'),
  authStatus: document.querySelector('#auth-status'),
  canvas: document.querySelector('#game-canvas'),
  confirmForm: document.querySelector('#confirm-form'),
  gameMessage: document.querySelector('#game-message'),
  jumpButton: document.querySelector('#jump-button'),
  leaderboard: document.querySelector('#leaderboard'),
  leaderboardButton: document.querySelector('#leaderboard-button'),
  leaderboardDialog: document.querySelector('#leaderboard-dialog'),
  localBest: document.querySelector('#local-best'),
  loginForm: document.querySelector('#login-form'),
  logoutButton: document.querySelector('#logout-button'),
  personalScore: document.querySelector('#personal-score'),
  refreshButton: document.querySelector('#refresh-button'),
  registerForm: document.querySelector('#register-form'),
  score: document.querySelector('#score'),
  sessionLabel: document.querySelector('#session-label'),
};

let currentUser = null;
let apiClient = null;


function formatScore(score) {
  return String(Math.max(0, Number(score) || 0)).padStart(6, '0');
}


function setMessage(element, message = '', type = '') {
  element.textContent = message;
  element.classList.toggle('is-error', type === 'error');
  element.classList.toggle('is-success', type === 'success');
}


function selectTab(tabName) {
  for (const tab of document.querySelectorAll('[data-tab]')) {
    const isSelected = tab.dataset.tab === tabName;
    tab.classList.toggle('is-active', isSelected);
    tab.setAttribute('aria-selected', String(isSelected));
  }
  for (const panel of document.querySelectorAll('[data-panel]')) {
    panel.hidden = panel.dataset.panel !== tabName;
  }
}


function openDialog(dialog) {
  if (!dialog.open) dialog.showModal();
}


function renderLeaderboard(items) {
  elements.leaderboard.replaceChildren();
  if (!items.length) {
    const empty = document.createElement('li');
    empty.className = 'empty-row';
    empty.textContent = 'Aucun score pour le moment. À vous de jouer !';
    elements.leaderboard.append(empty);
    return;
  }

  for (const item of items) {
    const row = document.createElement('li');
    const rank = document.createElement('span');
    const username = document.createElement('span');
    const score = document.createElement('strong');
    rank.className = 'rank';
    username.className = 'player-name';
    score.className = 'player-score';
    rank.textContent = `#${item.rank}`;
    username.textContent = item.username;
    score.textContent = formatScore(item.bestScore);
    row.append(rank, username, score);
    elements.leaderboard.append(row);
  }
}


async function refreshOnlineData() {
  if (!apiClient || !currentUser) return;
  elements.refreshButton.disabled = true;
  setMessage(elements.apiMessage, 'Actualisation…');
  try {
    const [leaderboard, personal] = await Promise.all([
      apiClient.getLeaderboard(),
      apiClient.getPersonalScore(),
    ]);
    renderLeaderboard(leaderboard.items);
    elements.personalScore.textContent = `Votre record : ${formatScore(personal.bestScore)}`;
    setMessage(elements.apiMessage, 'Classement à jour.', 'success');
  } catch (error) {
    setMessage(elements.apiMessage, error.message, 'error');
  } finally {
    elements.refreshButton.disabled = false;
  }
}


async function refreshSession() {
  currentUser = runtime.authReady ? await readCurrentUser() : null;
  elements.logoutButton.hidden = !currentUser;
  elements.sessionLabel.textContent = currentUser ? currentUser.username : 'Mode visiteur';
  elements.authForms.hidden = Boolean(currentUser) || !runtime.authReady;
  elements.authStatus.textContent = currentUser ? 'Connecté' : 'Prêt';
  elements.accountButton.setAttribute(
    'aria-label',
    currentUser ? `Ouvrir le compte de ${currentUser.username}` : 'Ouvrir le compte',
  );
  elements.refreshButton.disabled = !(currentUser && apiClient);

  if (currentUser && apiClient) {
    await refreshOnlineData();
  } else {
    elements.personalScore.textContent = 'Votre record : —';
    renderLeaderboard([]);
    if (runtime.apiReady) setMessage(elements.apiMessage, 'Connectez-vous pour afficher le classement.');
  }
}


async function submitScore(score) {
  if (!currentUser || !apiClient) {
    setMessage(
      elements.gameMessage,
      runtime.apiReady ? 'Connectez-vous pour enregistrer ce score.' : 'Record local enregistré.',
    );
    return;
  }

  setMessage(elements.gameMessage, 'Enregistrement du score…');
  try {
    const result = await apiClient.submitScore(score);
    setMessage(
      elements.gameMessage,
      result.updated ? `Nouveau record : ${formatScore(result.bestScore)} !` : `Record conservé : ${formatScore(result.bestScore)}.`,
      'success',
    );
    await refreshOnlineData();
  } catch (error) {
    setMessage(elements.gameMessage, error.message, 'error');
  }
}


function bindForm(form, handler) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    setMessage(elements.authMessage, 'Traitement en cours…');
    try {
      await handler(Object.fromEntries(new FormData(form)));
    } catch (error) {
      setMessage(elements.authMessage, error.message ?? 'Action impossible.', 'error');
    } finally {
      submitButton.disabled = false;
    }
  });
}


const game = new DinoGame(elements.canvas, {
  onScoreChange: (score, localBest) => {
    elements.score.textContent = formatScore(score);
    elements.localBest.textContent = formatScore(localBest);
  },
  onGameOver: submitScore,
});

elements.jumpButton.addEventListener('click', () => game.jump());
elements.canvas.addEventListener('pointerdown', () => game.jump());
elements.accountButton.addEventListener('click', () => openDialog(elements.accountDialog));
elements.leaderboardButton.addEventListener('click', () => openDialog(elements.leaderboardDialog));
elements.refreshButton.addEventListener('click', refreshOnlineData);

for (const tab of document.querySelectorAll('[data-tab]')) {
  tab.addEventListener('click', () => selectTab(tab.dataset.tab));
}

for (const closeButton of document.querySelectorAll('[data-close-dialog]')) {
  closeButton.addEventListener('click', () => closeButton.closest('dialog').close());
}

for (const dialog of document.querySelectorAll('dialog')) {
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    const outside = (
      event.clientX < bounds.left
      || event.clientX > bounds.right
      || event.clientY < bounds.top
      || event.clientY > bounds.bottom
    );
    if (outside) dialog.close();
  });
}

if (runtime.authReady) {
  configureAuth(runtime.config);
  elements.accountButton.hidden = false;

  bindForm(elements.registerForm, async (values) => {
    await registerUser(values);
    elements.confirmForm.elements.username.value = values.username;
    selectTab('confirm');
    setMessage(elements.authMessage, 'Compte créé. Saisissez le code reçu par email.', 'success');
  });

  bindForm(elements.confirmForm, async (values) => {
    await confirmUser(values);
    selectTab('login');
    elements.loginForm.elements.username.value = values.username;
    setMessage(elements.authMessage, 'Compte confirmé. Vous pouvez vous connecter.', 'success');
  });

  bindForm(elements.loginForm, async (values) => {
    const result = await loginUser(values);
    if (!result.isSignedIn) throw new Error('Une étape supplémentaire est requise pour cette connexion.');
    setMessage(elements.authMessage, 'Connexion réussie.', 'success');
    await refreshSession();
  });

  elements.logoutButton.addEventListener('click', async () => {
    await logoutUser();
    setMessage(elements.authMessage, 'Session fermée.', 'success');
    await refreshSession();
  });
} else {
  setMessage(elements.authMessage, 'Connexion indisponible.');
}

if (runtime.apiReady) {
  apiClient = createApiClient({ baseUrl: runtime.config.API_BASE_URL, getIdToken });
  elements.leaderboardButton.hidden = false;
} else {
  setMessage(elements.apiMessage, 'Classement indisponible.');
}

refreshSession();
