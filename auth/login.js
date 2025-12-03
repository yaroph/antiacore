
// auth/login.js
// Minimal login overlay that asks for [Prénom] + [Nom], then activates the SaveManager profile.
// Shown AFTER the BNI splash has finished.

(function(){
  // Session storage key for persisting login
  const SESSION_KEY = 'AF_session';

  // Check if we have a saved session
  function getSavedSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  // Save session to localStorage
  function saveSession(creds) {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(creds));
    } catch (e) {
      console.warn('Could not save session', e);
    }
  }

  // Clear saved session (for logout)
  function clearSession() {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch (e) {
      console.warn('Could not clear session', e);
    }
  }

  // Build overlay UI
function ensureStyles(){
  if (document.getElementById('af-login-style')) return;
  const css = `
    .af-login-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,.75);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    .af-login-overlay.show { display: flex; }

    .af-login-card {
      padding: 20px 24px;
      border: 3px solid #0ff;
      background: rgba(10,20,40,0.95);
      border-radius: 8px;
      max-width: 420px;
      width: 92vw;
      box-shadow: 0 0 25px rgba(0,255,255,.4), inset 0 0 10px rgba(0,255,255,.2);
      color: #fff;
      text-align: center;
    }

    .af-login-card h2 {
      font-family: 'Silkscreen','Press Start 2P',monospace;
      font-size: 20px;
      margin: 0 0 12px;
      color: #00e5ff;
      text-shadow: 0 0 6px #00e5ff;
    }

    .af-login-card p {
      margin: 0 0 12px;
      font-size: 14px;
      line-height: 1.4;
      color: #cbd5e1;
    }

    .af-row {
      display: flex;
      gap: 10px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }

    .af-input {
      flex: 1;
      border: 2px solid #00e5ff;
      background: rgba(255,255,255,0.1);
      color: #fff;
      padding: 10px 12px;
      font-size: 15px;
      border-radius: 4px;
      outline: none;
      box-shadow: inset 0 0 8px rgba(0,229,255,.3);
    }
    .af-input::placeholder {
      color: rgba(255,255,255,.6);
    }
    .af-input:focus {
      border-color: #66f7ff;
      box-shadow: 0 0 12px #22e7ff, inset 0 0 8px rgba(34,231,255,.4);
    }

    .af-btn {
      margin-top: 10px;
      display: inline-block;
      border: 2px solid #00e5ff;
      background: #00e5ff;
      color: #0a0a0a;
      padding: 10px 16px;
      font-weight: 800;
      cursor: pointer;
      border-radius: 4px;
      box-shadow: 0 0 12px rgba(0,229,255,.6);
      transition: transform .1s, background .2s;
    }
    .af-btn:hover {
      background: #22e7ff;
      transform: translateY(-2px);
    }
    .af-btn:active {
      transform: translateY(1px);
    }
    .af-btn:disabled {
      opacity: .5;
      cursor: not-allowed;
      box-shadow: none;
    }

    .af-error {
      color: #f87171;
      font-weight: 700;
      margin-top: 8px;
      display: none;
      text-shadow: 0 0 6px #b91c1c;
    }
  `;
  const style = document.createElement('style');
  style.id = 'af-login-style'; 
  style.textContent = css;
  document.head.appendChild(style);
}

 function buildOverlay() {
  ensureStyles();
  const overlay = document.createElement('div');
  overlay.className = 'af-login-overlay';
  overlay.id = 'afLoginOverlay';
  overlay.innerHTML = `
    <div class="af-login-card">
      <h2>Connexion</h2>
      <p>Entrez votre <strong>prénom</strong>, votre <strong>nom</strong> et un <strong>mot de passe</strong>.</p>
      <div class="af-row">
        <input class="af-input" id="afFirstName" placeholder="Prénom" autocomplete="given-name" />
        <input class="af-input" id="afLastName" placeholder="Nom" autocomplete="family-name" />
      </div>
      <div class="af-row">
        <input class="af-input" type="password" id="afPassword" placeholder="Mot de passe" autocomplete="current-password" />
      </div>
      <div class="af-row">
        <button class="af-btn" id="afLoginBtn">CONNEXION</button>
        <button class="af-btn" id="afRegisterBtn">INSCRIPTION</button>
      </div>
      <div class="af-error" id="afLoginErr"></div>
    </div>
  `;
  document.body.appendChild(overlay);
  return overlay;
}


  async function waitSplashThenShow(overlay){
    const splash = document.getElementById('splash');
    // If splash exists, wait until it's hidden by the game's animation.
    if (splash){
      // If splash is already hidden, just show; else watch for its hide
      const isHidden = splash.style.display === 'none' || !splash.classList.contains('show');
      if (isHidden){ overlay.classList.add('show'); return; }
      const obs = new MutationObserver(()=>{
        const hidden = splash.style.display === 'none' || !splash.classList.contains('show');
        if (hidden){ overlay.classList.add('show'); obs.disconnect(); }
      });
      obs.observe(splash, { attributes: true, attributeFilter: ['class','style'] });
      // Safety: if nothing happens in 5s, show anyway
      setTimeout(()=> overlay.classList.add('show'), 5000);
    } else {
      overlay.classList.add('show');
    }
  }

  async function showLogin(){
    const overlay = buildOverlay();
    await waitSplashThenShow(overlay);
    return await new Promise(resolve=>{
      const first = overlay.querySelector('#afFirstName');
      const last = overlay.querySelector('#afLastName');
      const pass = overlay.querySelector('#afPassword');
      const btnLogin = overlay.querySelector('#afLoginBtn');
      const btnRegister = overlay.querySelector('#afRegisterBtn');
      const err = overlay.querySelector('#afLoginErr');

      function setBusy(busy){
        btnLogin.disabled = !!busy;
        btnRegister.disabled = !!busy;
      }

      function getCreds(){
        const firstName = (first.value||'').trim();
        const lastName  = (last.value||'').trim();
        const password  = (pass.value||'').trim();
        if (!firstName || !lastName || !password){
          err.textContent = 'Merci de remplir prénom, nom et mot de passe.';
          err.style.display = 'block';
          return null;
        }
        return { firstName, lastName, password };
      }

      async function doAuth(mode){
        err.style.display = 'none';
        const creds = getCreds();
        if (!creds) return;
        if (!window.AF_SaveManager){
          alert('SaveManager indisponible. Rechargez la page.');
          return;
        }
        setBusy(true);
        try{
          const payload = {
            firstName: creds.firstName,
            lastName: creds.lastName,
            password: creds.password
          };
          const url = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const result = await res.json().catch(()=>({}));
          const ok = result && result.ok;
          if (!ok){
            const code = result && result.error;
            let msg = 'Erreur de connexion.';
            if (mode === 'register' && code === 'ACCOUNT_EXISTS'){
              msg = 'Un compte existe déjà avec ce prénom et ce nom.';
            } else if (mode === 'login' && code === 'NOT_FOUND'){
              msg = 'Aucun compte trouvé avec ce prénom et ce nom.';
            } else if (mode === 'login' && code === 'BAD_PASSWORD'){
              msg = 'Mot de passe incorrect.';
            }
            err.textContent = msg;
            err.style.display = 'block';
            return;
          }

          const account = result.account || {};
          const firstName = account.firstName || creds.firstName;
          const lastName  = account.lastName  || creds.lastName;
          const fullName  = account.fullName  || `${firstName} ${lastName}`.trim();

          const profile = await window.AF_SaveManager.useProfile({ firstName, lastName, fullName });
          window.__PROFILE__ = profile; // expose

          // Save session for auto-login on next visit
          saveSession({ firstName, lastName, password: creds.password });

          // Synchronise les stats serveur -> stockage local du profil
          try{
            const stats = account.stats || {};
            if (typeof localStorage !== 'undefined'){
              if (stats.bestScore != null) {
                localStorage.setItem('angryflappy_bestscore', String(stats.bestScore));
              }
              if (stats.bestDistance != null) {
                localStorage.setItem('angryflappy_high', String(stats.bestDistance));
              }
              if (stats.bestCaptures != null) {
                localStorage.setItem('angryflappy_bestcaprun', String(stats.bestCaptures));
              }
              if (Array.isArray(stats.collection)) {
                localStorage.setItem('angryflappy_collection', JSON.stringify(stats.collection));
              }
            }
          }catch(e){ console.warn('Sync account->local error', e); }

          // Met à jour quelques compteurs UI si présents
          try{
            const best = Number(localStorage.getItem('angryflappy_bestscore')||0);
            const el = document.getElementById('bestScore'); if (el) el.textContent = String(best);
            const balls = Number(localStorage.getItem('angryflappy_balls')||0);
            const bStart = document.getElementById('ballsStart'); if (bStart) bStart.textContent = String(balls);
          }catch(e){}

          window.dispatchEvent(new CustomEvent('af:login:done', { detail: { profile, account } }));
          overlay.remove();
          resolve(profile);
        }catch(e){
          console.error('Auth error', e);
          err.textContent = 'Erreur lors de la communication avec le serveur.';
          err.style.display = 'block';
        }finally{
          setBusy(false);
        }
      }

      const submitLogin = ()=> doAuth('login');
      const submitRegister = ()=> doAuth('register');

      first.addEventListener('keydown', e=>{ if (e.key==='Enter') submitLogin(); });
      last.addEventListener('keydown', e=>{ if (e.key==='Enter') submitLogin(); });
      pass.addEventListener('keydown', e=>{ if (e.key==='Enter') submitLogin(); });
      btnLogin.addEventListener('click', submitLogin);
      btnRegister.addEventListener('click', submitRegister);

      // autofocus first input
      setTimeout(()=> first.focus(), 50);
    });
  }

  // Try to auto-login with saved session
  async function tryAutoLogin() {
    const session = getSavedSession();
    if (!session || !session.firstName || !session.lastName || !session.password) {
      return false;
    }

    if (!window.AF_SaveManager) {
      return false;
    }

    try {
      const payload = {
        firstName: session.firstName,
        lastName: session.lastName,
        password: session.password
      };
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json().catch(() => ({}));
      if (!result || !result.ok) {
        // Session is invalid, clear it
        clearSession();
        return false;
      }

      const account = result.account || {};
      const firstName = account.firstName || session.firstName;
      const lastName = account.lastName || session.lastName;
      const fullName = account.fullName || `${firstName} ${lastName}`.trim();

      const profile = await window.AF_SaveManager.useProfile({ firstName, lastName, fullName });
      window.__PROFILE__ = profile;

      // Sync stats from server
      try {
        const stats = account.stats || {};
        if (typeof localStorage !== 'undefined') {
          if (stats.bestScore != null) {
            localStorage.setItem('angryflappy_bestscore', String(stats.bestScore));
          }
          if (stats.bestDistance != null) {
            localStorage.setItem('angryflappy_high', String(stats.bestDistance));
          }
          if (stats.bestCaptures != null) {
            localStorage.setItem('angryflappy_bestcaprun', String(stats.bestCaptures));
          }
          if (Array.isArray(stats.collection)) {
            localStorage.setItem('angryflappy_collection', JSON.stringify(stats.collection));
          }
        }
      } catch (e) { console.warn('Sync account->local error', e); }

      // Update UI counters if present
      try {
        const best = Number(localStorage.getItem('angryflappy_bestscore') || 0);
        const el = document.getElementById('bestScore'); if (el) el.textContent = String(best);
        const balls = Number(localStorage.getItem('angryflappy_balls') || 0);
        const bStart = document.getElementById('ballsStart'); if (bStart) bStart.textContent = String(balls);
      } catch (e) { }

      window.dispatchEvent(new CustomEvent('af:login:done', { detail: { profile, account } }));
      return true;
    } catch (e) {
      console.error('Auto-login error', e);
      clearSession();
      return false;
    }
  }

  // Logout function
  function logout() {
    clearSession();
    // Clear profile state
    window.__PROFILE__ = null;
    if (window.AF_SaveManager) {
      window.AF_SaveManager.profile = null;
      window.AF_SaveManager.cache = {};
    }
    // Reload the page to show login screen
    window.location.reload();
  }

  // Modified showLogin to check for saved session first
  async function showLoginOrAutoLogin() {
    const autoLoggedIn = await tryAutoLogin();
    if (!autoLoggedIn) {
      return showLogin();
    }
    return window.__PROFILE__;
  }

  // Public API (global)
  window.AF_showLogin = showLoginOrAutoLogin;
  window.AF_logout = logout;
  window.AF_clearSession = clearSession;
})();
