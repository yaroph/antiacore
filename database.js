// database.js
// Page admin ultra simple pour lister les comptes + liens vers leurs réponses JSON.

(function(){
  const state = {
    accounts: [],
    filtered: []
  };

  function $(id){ return document.getElementById(id); }

  function normalize(str){
    return String(str || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
  }

  function applyFilter(){
    const input = $('db-search');
    const q = normalize(input ? input.value : '');
    if (!q){
      state.filtered = state.accounts.slice();
    } else {
      state.filtered = state.accounts.filter(acc => {
        const full = normalize(acc.fullName || (acc.firstName + ' ' + acc.lastName));
        const id   = normalize(acc.id || '');
        return full.includes(q) || id.includes(q);
      });
    }
    renderList();
  }

  function renderList(){
    const listEl = $('db-list');
    const emptyEl = $('db-empty');
    listEl.innerHTML = '';

    if (!state.filtered.length){
      emptyEl.style.display = 'block';
      return;
    }
    emptyEl.style.display = 'none';

    for (const acc of state.filtered){
      const card = document.createElement('div');
      card.className = 'db-card';

      const header = document.createElement('div');
      header.className = 'db-card-header';

      const name = document.createElement('div');
      name.className = 'db-card-name';
      name.textContent = (acc.firstName || '') + ' ' + (acc.lastName || '');

      const id = document.createElement('div');
      id.className = 'db-card-id';
      id.textContent = acc.id || '';

      header.appendChild(name);
      header.appendChild(id);
      card.appendChild(header);

      const passRow = document.createElement('div');
      passRow.className = 'db-card-row';
      const passLabel = document.createElement('span');
      passLabel.className = 'db-card-label';
      passLabel.textContent = 'Mot de passe :';
      const passValue = document.createElement('span');
      passValue.textContent = acc.password || '(non enregistré / ancien compte)';
      passRow.appendChild(passLabel);
      passRow.appendChild(passValue);
      card.appendChild(passRow);

      const respRow = document.createElement('div');
      respRow.className = 'db-card-row';
      const respLabel = document.createElement('span');
      respLabel.className = 'db-card-label';
      respLabel.textContent = 'Réponses :';
      const respValue = document.createElement('span');
      if (acc.hasReponses && acc.reponsesFile){
        respValue.textContent = acc.reponsesFile.replace(/^\/reponses\//, '');
      } else {
        respValue.textContent = '(aucun fichier de réponses)';
      }
      respRow.appendChild(respLabel);
      respRow.appendChild(respValue);
      card.appendChild(respRow);

      const footer = document.createElement('div');
      footer.className = 'db-card-footer';

      const tag = document.createElement('div');
      tag.className = 'db-tag';
      const updated = acc.updatedAt ? new Date(acc.updatedAt).toLocaleString() : '';
      tag.textContent = updated ? 'Dernière mise à jour : ' + updated : 'Compte sans date';

      const btn = document.createElement('button');
      btn.className = 'db-btn-small';
      btn.textContent = 'Télécharger les réponses';
      if (!(acc.hasReponses && acc.reponsesFile)){
        btn.disabled = true;
      } else {
        btn.addEventListener('click', () => {
          const a = document.createElement('a');
          a.href = acc.reponsesFile;
          a.download = acc.reponsesFile.split('/').pop() || 'reponses.json';
          document.body.appendChild(a);
          a.click();
          setTimeout(() => a.remove(), 0);
        });
      }

      footer.appendChild(tag);
      footer.appendChild(btn);
      card.appendChild(footer);

      listEl.appendChild(card);
    }
  }

  async function fetchAccounts(){
    try{
      const res = await fetch('/api/admin/accounts');
      if (!res.ok){
        console.error('Erreur /api/admin/accounts', res.status);
        return;
      }
      const data = await res.json();
      const accounts = (data && data.accounts) || [];
      // garder en mémoire
      state.accounts = accounts;
      state.filtered = accounts.slice();
      renderList();
    }catch(err){
      console.error('Erreur de chargement des comptes', err);
    }
  }

  async function downloadAll(){
    if (!window.JSZip){
      alert('JSZip non chargé, impossible de créer le ZIP.');
      return;
    }
    const btn = $('db-download-all');
    if (btn){
      btn.disabled = true;
      btn.textContent = 'Préparation…';
    }
    try{
      const accounts = state.accounts.filter(a => a.hasReponses && a.reponsesFile);
      if (!accounts.length){
        alert('Aucun fichier de réponses à télécharger.');
        return;
      }
      const zip = new JSZip();
      for (const acc of accounts){
        try{
          const url = acc.reponsesFile;
          const resp = await fetch(url);
          if (!resp.ok) continue;
          const text = await resp.text();
          const fname = url.split('/').pop() || (acc.id || 'reponses') + '.json';
          zip.file(fname, text);
        }catch(e){
          console.warn('Erreur téléchargement individuel', e);
        }
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'reponses_json.zip';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 1000);
    }finally{
      if (btn){
        btn.disabled = false;
        btn.textContent = 'Tout télécharger (ZIP)';
      }
    }
  }

  function init(){
    const search = $('db-search');
    if (search){
      search.addEventListener('input', applyFilter);
    }
    const allBtn = $('db-download-all');
    if (allBtn){
      allBtn.addEventListener('click', downloadAll);
    }
    fetchAccounts();
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
