
// Auto-added: toggle monsters visibility only after pressing Start
(function(){
  function markStarted(){
    if (!document.body.classList.contains('game-started')) {
      document.body.classList.add('game-started');
    }
  }

  function isStartButton(el){
    if (!el) return false;
    const id = el.id ? '#' + el.id : '';
    const cls = el.className ? '.' + String(el.className).split(' ').join('.') : '';
    const da = el.getAttribute && el.getAttribute('data-action');
    const txt = (el.textContent || '').trim().toLowerCase();
    if (da === 'start') return true;
    if (id === '#start' || id === '#btnStart') return true;
    if (cls.includes('.start') || cls.includes('.btn-start')) return true;
    if (txt === 'start' || txt === 'démarrer' || txt === 'lancer' || txt === 'jouer') return true;
    return false;
  }

  // Attach global click handler to catch Start actions anywhere
  window.addEventListener('click', function(e){
    const path = e.composedPath ? e.composedPath() : (function(){
      const arr = [];
      let node = e.target;
      while (node) { arr.push(node); node = node.parentNode; }
      arr.push(window);
      return arr;
    })();
    for (const el of path) {
      if (isStartButton(el)) {
        markStarted();
        break;
      }
    }
  }, true);

  // If there is a known start button, also bind directly
  document.addEventListener('DOMContentLoaded', function(){
    const candidates = Array.from(document.querySelectorAll('#start, .start, #btnStart, .btn-start, [data-action="start"], button, a'));
    for (const el of candidates) {
      if (isStartButton(el)) {
        el.addEventListener('click', markStarted, { once: false, capture: true });
      }
    }
  });
})();
