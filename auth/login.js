
// auth/login.js
// Minimal login overlay that asks for [Prénom] + [Nom], then activates the SaveManager profile.
// Shown AFTER the BNI splash has finished.
// Session persistence: remembers login using localStorage

(function(){
  const SESSION_KEY = 'af_session';

  // Check if already logged in
  function getStoredSession(){
    try {
      const data = localStorage.getItem(SESSION_KEY);
      if (data) return JSON.parse(data);
    } catch(e){}
    return null;
  }

  function saveSession(profile, account){
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ profile, account }));
    } catch(e){}
  }

  function clearSession(){
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch(e){}
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

    .af-input-wrapper {
      position: relative;
      display: flex;
      flex: 1;
      min-width: 0;
    }
    .af-input-wrapper .af-input {
      width: 100%;
      padding-right: 32px;
    }
    .af-input-clear {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      width: 20px;
      height: 20px;
      border: none;
      background: rgba(255,255,255,0.15);
      border-radius: 50%;
      color: rgba(255,255,255,0.8);
      font-size: 14px;
      line-height: 1;
      cursor: pointer;
      display: none;
      align-items: center;
      justify-content: center;
      transition: background 0.15s;
      font-family: sans-serif;
      padding: 0;
    }
    .af-input-clear:hover {
      background: rgba(255,75,75,0.6);
      color: #fff;
    }
    .af-input-wrapper.has-text .af-input-clear {
      display: flex;
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

    .af-btn.af-btn-logout {
      background: #ff4b4b;
      border-color: #ff4b4b;
      box-shadow: 0 0 12px rgba(255,75,75,.6);
    }
    .af-btn.af-btn-logout:hover {
      background: #ff6b6b;
    }

    .af-error {
      color: #f87171;
      font-weight: 700;
      margin-top: 8px;
      display: none;
      text-shadow: 0 0 6px #b91c1c;
    }

    .af-logout-btn {
      position: fixed;
      top: 10px;
      right: 10px;
      z-index: 999;
      padding: 8px 14px;
      font-size: 12px;
      font-weight: 700;
      background: rgba(255,75,75,0.9);
      border: 2px solid #ff4b4b;
      border-radius: 4px;
      color: #fff;
      cursor: pointer;
      box-shadow: 0 0 10px rgba(255,75,75,.5);
      transition: transform .1s, background .2s;
      font-family: 'Silkscreen','Press Start 2P',monospace;
    }
    .af-logout-btn:hover {
      background: #ff6b6b;
      transform: translateY(-1px);
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
        <div class="af-input-wrapper">
          <input class="af-input" id="afFirstName" placeholder="Prénom" autocomplete="given-name" />
          <button type="button" class="af-input-clear" aria-label="Effacer">&times;</button>
        </div>
        <div class="af-input-wrapper">
          <input class="af-input" id="afLastName" placeholder="Nom" autocomplete="family-name" />
          <button type="button" class="af-input-clear" aria-label="Effacer">&times;</button>
        </div>
      </div>
      <div class="af-row">
        <div class="af-input-wrapper">
          <input class="af-input" type="password" id="afPassword" placeholder="Mot de passe" autocomplete="current-password" />
          <button type="button" class="af-input-clear" aria-label="Effacer">&times;</button>
        </div>
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
    // First try to restore existing session
    const existingSession = await restoreSession();
    if (existingSession) {
      // Already logged in, skip login overlay
      return existingSession;
    }

    const overlay = buildOverlay();
    await waitSplashThenShow(overlay);
    return await new Promise(resolve=>{
      const first = overlay.querySelector('#afFirstName');
      const last = overlay.querySelector('#afLastName');
      const pass = overlay.querySelector('#afPassword');
      const btnLogin = overlay.querySelector('#afLoginBtn');
      const btnRegister = overlay.querySelector('#afRegisterBtn');
      const err = overlay.querySelector('#afLoginErr');

      // Setup clear buttons for input fields
      function setupInputClearButtons(){
        const wrappers = overlay.querySelectorAll('.af-input-wrapper');
        wrappers.forEach(wrapper => {
          const input = wrapper.querySelector('input');
          const clearBtn = wrapper.querySelector('.af-input-clear');
          if (!input || !clearBtn) return;

          function updateVisibility(){
            if (input.value.length > 0){
              wrapper.classList.add('has-text');
            } else {
              wrapper.classList.remove('has-text');
            }
          }

          input.addEventListener('input', updateVisibility);
          updateVisibility();

          clearBtn.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            input.value = '';
            input.focus();
            updateVisibility();
          });
        });
      }
      setupInputClearButtons();

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
            } else if (mode === 'login' && (code === 'NOT_FOUND' || code === 'ACCOUNT_NOT_FOUND')){
              msg = 'Aucun compte trouvé avec ce prénom et ce nom.';
            } else if (mode === 'login' && code === 'BAD_PASSWORD'){
              msg = 'Mot de passe incorrect.';
            } else if (code === 'MISSING_FIELDS'){
              msg = 'Merci de remplir prénom, nom et mot de passe.';
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

          // Save session for persistence
          saveSession(profile, account);

          // Add logout button
          addLogoutButton();

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

  function addLogoutButton(){
    ensureStyles();
    // Remove existing logout button if any
    const existing = document.getElementById('afLogoutBtn');
    if (existing) existing.remove();

    const btn = document.createElement('button');
    btn.id = 'afLogoutBtn';
    btn.className = 'af-logout-btn';
    btn.textContent = 'DÉCONNEXION';
    btn.addEventListener('click', ()=>{
      clearSession();
      // Reload the page to show login again
      window.location.reload();
    });
    document.body.appendChild(btn);
  }

  async function restoreSession(){
    const session = getStoredSession();
    if (!session || !session.profile) return null;

    const { profile, account } = session;

    if (!window.AF_SaveManager){
      console.warn('SaveManager not available for session restore');
      return null;
    }

    try {
      // Restore profile
      await window.AF_SaveManager.useProfile(profile);
      window.__PROFILE__ = profile;

      // Sync stats from stored account
      if (account && account.stats){
        const stats = account.stats;
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

      // Update UI if elements exist
      try{
        const best = Number(localStorage.getItem('angryflappy_bestscore')||0);
        const el = document.getElementById('bestScore'); if (el) el.textContent = String(best);
        const balls = Number(localStorage.getItem('angryflappy_balls')||0);
        const bStart = document.getElementById('ballsStart'); if (bStart) bStart.textContent = String(balls);
      }catch(e){}

      window.dispatchEvent(new CustomEvent('af:login:done', { detail: { profile, account } }));

      // Add logout button
      addLogoutButton();

      return profile;
    } catch(e){
      console.warn('Session restore failed', e);
      clearSession();
      return null;
    }
  }

  // Logout function exposed globally
  window.AF_logout = function(){
    clearSession();
    window.location.reload();
  };

  // Public API (global)
  window.AF_showLogin = showLogin;
})();
