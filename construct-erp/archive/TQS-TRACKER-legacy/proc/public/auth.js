const AUTH_STORAGE_KEY = 'buildpro_session';

function getSession() {
  try {
    const raw = sessionStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getToken() {
  const session = getSession();
  return session ? session.token || null : null;
}

function authHeaders(extra = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...extra };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

function setSession(session) {
  sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

function clearSession() {
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
}

function syncLegacyUserState(session) {
  const roleMap = {
    'Purchase Manager': 'PURCHASE_MANAGER',
    'Director': 'DIRECTOR',
    'Site Engineer': 'SITE_ENGINEER',
    'Supervisor': 'SUPERVISOR',
    'Accountant': 'ACCOUNTANT'
  };
  sessionStorage.setItem('buildpro_user_name', session.name || '');
  sessionStorage.setItem('buildpro_user_email', session.email || '');
  sessionStorage.setItem('buildpro_user_role', roleMap[session.role] || session.role || '');
  if (session.id) sessionStorage.setItem('buildpro_user_id', session.id);
  if (session.project) sessionStorage.setItem('buildpro_project_name', session.project);
}

function storeSession(session) {
  setSession(session);
  syncLegacyUserState(session);
  return session;
}

function requireAuth(redirectPath = 'login.html') {
  const session = getSession();
  if (!session || !session.token) {
    window.location.replace(redirectPath);
    return null;
  }
  return session;
}

function handleUnauthorized(redirectPath = 'login.html') {
  clearSession();
  sessionStorage.removeItem('buildpro_user_id');
  sessionStorage.removeItem('buildpro_user_name');
  sessionStorage.removeItem('buildpro_user_email');
  sessionStorage.removeItem('buildpro_user_role');
  window.location.replace(redirectPath);
}

function logout(redirectPath = 'login.html') {
  clearSession();
  sessionStorage.removeItem('buildpro_user_id');
  sessionStorage.removeItem('buildpro_user_name');
  sessionStorage.removeItem('buildpro_user_email');
  sessionStorage.removeItem('buildpro_user_role');
  window.location.replace(redirectPath);
}
