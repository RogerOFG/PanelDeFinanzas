// Autenticación con Google (Sign-In con Gmail) usando Google Identity Services.
// No requiere backend: se valida el token de Google en el navegador y se
// restringe el acceso a la(s) cuenta(s) de correo autorizadas.
//
// CONFIGURACIÓN NECESARIA (hazlo antes de usar la app):
// 1. Ve a https://console.cloud.google.com/apis/credentials
// 2. Crea (o usa) un proyecto y crea credenciales "ID de cliente de OAuth" tipo "Aplicación web".
// 3. En "Orígenes de JavaScript autorizados" agrega la URL desde donde abrirás la app
//    (ej: http://localhost:5500, https://tuusuario.github.io, etc).
// 4. Copia el "Client ID" (termina en .apps.googleusercontent.com) y pégalo abajo en CLIENT_ID.
// 5. En ALLOWED_EMAILS agrega tu(s) correo(s) de Gmail permitidos para entrar.

const AUTH_CONFIG = {
  CLIENT_ID: '829352713763-4e538a8e08p6rlgdvks9tp35qo7qjem9.apps.googleusercontent.com',
  ALLOWED_EMAILS: [
    // Agrega aquí tu(s) Gmail para restringir el acceso, ej: 'tucorreo@gmail.com'
  ],
  SESSION_KEY: 'finbot_session_v1'
};

const Auth = {
  currentUser: null,

  isConfigured() {
    return AUTH_CONFIG.CLIENT_ID && !AUTH_CONFIG.CLIENT_ID.startsWith('PON_AQUI');
  },

  init(onAuthenticated) {
    this.onAuthenticated = onAuthenticated;

    const saved = this.loadSession();
    if (saved && this.isSessionValid(saved)) {
      this.currentUser = saved;
      this.showApp();
      onAuthenticated();
      return;
    }

    this.showLogin();
  },

  loadSession() {
    try {
      const raw = localStorage.getItem(AUTH_CONFIG.SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  },

  isSessionValid(session) {
    return session && session.exp && (Date.now() / 1000) < session.exp;
  },

  showLogin() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app-root').style.display = 'none';

    if (!this.isConfigured()) {
      document.getElementById('login-status').innerHTML =
        `⚠️ Falta configurar el inicio de sesión con Google.<br>
         Edita <code>js/auth.js</code> y coloca tu <b>Client ID</b> de Google Cloud Console.`;
      return;
    }

    if (!window.google || !window.google.accounts) {
      document.getElementById('login-status').textContent = 'Cargando servicio de inicio de sesión de Google...';
      setTimeout(() => this.showLogin(), 300);
      return;
    }

    document.getElementById('login-status').textContent = '';

    google.accounts.id.initialize({
      client_id: AUTH_CONFIG.CLIENT_ID,
      callback: (response) => this.handleCredentialResponse(response)
    });

    google.accounts.id.renderButton(
      document.getElementById('google-signin-button'),
      { theme: 'filled_black', size: 'large', shape: 'pill', text: 'signin_with', width: 260 }
    );

    google.accounts.id.prompt();
  },

  handleCredentialResponse(response) {
    let payload;
    try {
      payload = this.decodeJwt(response.credential);
    } catch (e) {
      UI.toast('No se pudo procesar la sesión de Google', 'danger');
      return;
    }

    const email = payload.email;

    if (AUTH_CONFIG.ALLOWED_EMAILS.length > 0 && !AUTH_CONFIG.ALLOWED_EMAILS.includes(email)) {
      document.getElementById('login-status').innerHTML =
        `🚫 La cuenta <b>${escapeHtml(email)}</b> no tiene acceso a esta app.<br>Agrega tu correo en <code>ALLOWED_EMAILS</code> dentro de <code>js/auth.js</code>.`;
      google.accounts.id.disableAutoSelect();
      return;
    }

    const session = {
      email,
      name: payload.name,
      picture: payload.picture,
      exp: payload.exp
    };

    localStorage.setItem(AUTH_CONFIG.SESSION_KEY, JSON.stringify(session));
    this.currentUser = session;
    this.showApp();
    if (this.onAuthenticated) this.onAuthenticated();
  },

  decodeJwt(token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(json);
  },

  showApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-root').style.display = '';
    this.renderUserBadge();
  },

  renderUserBadge() {
    const el = document.getElementById('user-badge');
    if (!el || !this.currentUser) return;
    el.innerHTML = `
      <img src="${escapeHtml(this.currentUser.picture || '')}" alt="" class="user-avatar" referrerpolicy="no-referrer">
    `;
    el.onclick = () => this.openAccountMenu();
  },

  openAccountMenu() {
    UI.openModal('Cuenta', `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;">
        <img src="${escapeHtml(this.currentUser.picture || '')}" alt="" class="user-avatar" style="width:48px;height:48px;" referrerpolicy="no-referrer">
        <div>
          <div style="font-weight:600;">${escapeHtml(this.currentUser.name || '')}</div>
          <div class="text-dim" style="font-size:13px;">${escapeHtml(this.currentUser.email || '')}</div>
        </div>
      </div>
      <div class="modal-actions" style="justify-content:flex-start;">
        <button class="btn danger" id="logout-btn">Cerrar sesión</button>
      </div>
    `, {
      onMount: (root) => {
        root.querySelector('#logout-btn').onclick = () => Auth.logout();
      }
    });
  },

  logout() {
    localStorage.removeItem(AUTH_CONFIG.SESSION_KEY);
    this.currentUser = null;
    if (window.google && google.accounts) google.accounts.id.disableAutoSelect();
    UI.closeModal();
    location.reload();
  }
};
