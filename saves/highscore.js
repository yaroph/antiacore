// saves/highscore.js (server-backed)
// Highscores are stored on the server in "saves/highscore.json" via the /api/highscores endpoint.

(function(){
  const API_URL = '/api/highscores';

  function $(sel){ return document.querySelector(sel); }
  function now(){ try{return Date.now();}catch(e){return +new Date();} }
  function norm(s){ return String(s||'').trim(); }

  async function fetchAll(){
    const res = await fetch(API_URL, { method: 'GET', headers: { 'Accept': 'application/json' } });
    const data = await res.json().catch(()=>({highscores: []}));
    return Array.isArray(data.highscores) ? data.highscores : [];
  }

  async function upsert(entry){
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry||{})
    });
    const data = await res.json().catch(()=>({ok:false, highscores:[]}));
    if (!data || data.error) throw new Error(data.error||'save-failed');
    return data.highscores || [];
  }

  async function renderTable(){
    const table = $('#scoreBoardTableBody');
    if (!table) return;
    const list = await fetchAll();
    // Clear rows
    table.innerHTML = '';
    list.forEach((e, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = [
        `<td>${i+1}</td>`,
        `<td>${(e.prenom||'?')} ${(e.nom||'')}</td>`,
        `<td>${e.distance||0}</td>`,
        `<td>${e.captures||0}</td>`,
        `<td>${e.score||0}</td>`,
      ].join('');
      table.appendChild(tr);
    });
  }

  async function upsertRun({ distance=0, captures=0, score=0 }={}){
    try{
      const prof = (window.AF_SaveManager && window.AF_SaveManager.profile) || {};
      const prenom = norm(prof.firstName || prof.prenom || '');
      const nom    = norm(prof.lastName  || prof.nom    || '');
      const id     = prof.id || (prenom||nom ? `player:${prenom.toLowerCase()}::${nom.toLowerCase()}` : `anon:${Math.random().toString(36).slice(2)}`);

      const updated = await upsert({ id, prenom, nom, distance, captures, score, updatedAt: now() });
      // Also push stats to account (if an account exists)
      try{
        if (prenom || nom){
          let collection = null;
          try{
            const raw = localStorage.getItem('angryflappy_collection');
            if (raw) collection = JSON.parse(raw);
          }catch(e){}
          await fetch('/api/account/updateStats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              firstName: prenom,
              lastName: nom,
              distance,
              captures,
              score,
              collection
            })
          }).catch(()=>{});
        }
      }catch(e){ console.warn('updateStats error', e); }

      // Optionally refresh the table if visible
      renderTable();
      return updated;
    }catch(e){
      console.error('AF_Highscore.upsertRun failed:', e);
      throw e;
    }
  }


  // ---------- Minimal UI: Modal overlay for Highscores ----------
  
  function ensureModalStyles(){
    if (document.getElementById('hsModalStyles')) return;
    const st = document.createElement('style');
    st.id = 'hsModalStyles';
    st.textContent = `
      #highscoreModal .pixel-title{
        font-family: 'Press Start 2P','Silkscreen', monospace;
        text-transform: uppercase;
        font-size: 28px;
        text-align: center;
        color: #fff;
        margin: 0 0 24px 0;
      }
      #highscoreModal table,
      #highscoreModal th,
      #highscoreModal td{
        color: #fff !important;
      }
      #highscoreModal .close-row{
        display: flex;
        justify-content: center;
        margin-top: 12px;
      }
    `;
        st.textContent += `\n      #highscoreModal thead th{ border-bottom: 1px solid rgba(255,255,255,.35);  padding-bottom: 10px;}\n`;
        st.textContent += `\n      #highscoreModal tbody tr:first-child td{ padding-top: 12px; }\n`;
        st.textContent += `\n      #highscoreModal #closeHighscoreBtn{ pointer-events:auto; opacity:1; }\n`;
    document.head.appendChild(st);
  }

  function ensureModal(){

  // Global delegation for Close button (extra safety)
  document.addEventListener('click', function(e){
    const t = e.target;
    if (t && (t.id === 'closeHighscoreBtn' || t.closest && t.closest('#closeHighscoreBtn'))) {
      hideModal();
    }
  }, true);

    ensureModalStyles();
    if (document.getElementById('highscoreModal')) return;
    const wrap = document.createElement('div');
    wrap.id = 'highscoreModal';
    wrap.style.position = 'fixed';
    wrap.style.inset = '0';
    wrap.style.background = 'rgba(0,0,0,0.6)';
    wrap.style.display = 'none';
    wrap.style.zIndex = '9999';
    wrap.style.alignItems = 'center';
    wrap.style.justifyContent = 'center';

    const panel = document.createElement('div');
    panel.className = 'gb-panel panel';
    panel.style.maxWidth = '720px';
    panel.style.width = '92vw';
    panel.style.maxHeight = '80vh';
    panel.style.overflow = 'auto';
    panel.style.padding = '16px';
    panel.style.background = 'var(--gb4, #0c1222)';
    panel.style.border = '2px solid rgba(0,255,255,.25)';
    panel.style.boxShadow = '0 10px 0 rgba(0,0,0,.6)';
    panel.innerHTML = `
      <h2 class="gb-h2 pixel-title">HIGHSCORE</h2>
      <table class="gb-table" style="width:100%">
        <thead>
          <tr><th>#</th><th>Player</th><th>Distance</th><th>Captures</th><th>Score</th></tr>
        </thead>
        <tbody id="scoreBoardTableBody"></tbody>
      </table>
      <div class="close-row">
        <button id="closeHighscoreBtn" class="btn gb-btn">CLOSE</button>
      </div>
      `;
    wrap.appendChild(panel);
    document.body.appendChild(wrap);

    const closeBtn = document.getElementById('closeHighscoreBtn');
    if (closeBtn) closeBtn.onclick = () => hideModal();

    
    wrap.addEventListener('click', (e) => {
      if (e.target === wrap) hideModal();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') hideModal();
    });
  }

  function showModal(){
    ensureModalStyles();
    ensureModal();
    const el = document.getElementById('highscoreModal');
    if (!el) return;
    el.style.display = 'flex';
    renderTable();
  }
  function hideModal(){
    const el = document.getElementById('highscoreModal');
    if (!el) return;
    el.style.display = 'none';
  }

  function bindButton(){
    const btn1 = document.getElementById('highscoreBtn');
    const btn2 = document.getElementById('highscoreBtnOver');
    [btn1, btn2].forEach(btn => {
      if (!btn) return;
      btn.addEventListener('click', () => { showModal(); });
    });
  }

  // Expose a consistent API
  window.AF_Highscore = {
    renderTable,
    upsertRun,
    fetchAll
  };


  // Prepare UI and render table on load
  window.addEventListener('load', () => {
    ensureModalStyles();
    ensureModal();
    bindButton();
    renderTable();
  });

})();