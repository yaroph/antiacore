
// AudioManager (no fades) + DOM <audio autoplay> for intro
(function(){
  if (!window) return;

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtx();
  window._af_ctx = ctx;

  
  
  // Master gain for sound effects (SFX). Set to 35% to reduce SFX loudness globally.
  const sfxMasterGain = ctx.createGain();
  try { sfxMasterGain.gain.value = 0.5; } catch(e) {}
  try { sfxMasterGain.connect(ctx.destination); } catch(e) {}
window._AF_SFX_MASTER = 0.5;
  // Default to 0.35 (i.e., -65%).
  function _AF_getSfxVolume(){ try { return (window.audio && typeof window.audio.sfxVolume === 'number') ? window.audio.sfxVolume : 0.35; } catch(e){ return 0.35; } }


  
  // Master volume for sound effects (SFX) only. 1.0 = 100%
  window._AF_SFX_MASTER = 0.5; // lowered to 50% by request
window.music = {

    current: null,
    get muted(){ try { return localStorage.getItem('AF_musicMuted') === '1'; } catch(e){ return false; } },
    set muted(v){ try { localStorage.setItem('AF_musicMuted', v ? '1' : '0'); } catch(e){} this.volume = v ? 0 : this.volume || 0.8; if (this.current) try{ this.current.volume = this.volume; }catch(e){} },
    loopWasPausedForCombat: false,
    volume: 0.8,
    _play(src, loop=false){
      try{ if (this.current && this.current !== introEl) { this.current.pause(); this.current.src=""; } }catch(e){}
      const a = new Audio(src);
      a.loop = loop;
      a.volume = (this.volume || 0);
      a.autoplay = true;
      try { a.play().catch(()=>{}); } catch(e){}
      a.addEventListener("canplay", ()=>{ try{ a.play().catch(()=>{}); }catch(e){} }, {once:true});
      this.current = a;
      return a;
    },
    siteIntroFromElement(el){
      // Use the DOM element (already autoplay)
      try{ if (this.current && this.current !== el) { this.current.pause(); } }catch(e){}
      this.current = el;
      try{ el.volume = this.volume; }catch(e){}
      try{ el.play().catch(()=>{}); }catch(e){}
    },
    menuIntroThenLoop(){
      const intro = this._play("assets/audio/loop_intro.mp3", false);
      intro.addEventListener("ended", ()=>{ this._play("assets/audio/loop.mp3", true); }, {once:true});
    },
    startLoop(){ this._play("assets/audio/loop.mp3", true); },
    combatStart(){
      const intro = this._play("assets/audio/loop_combat_intro.mp3", false);
      intro.addEventListener("ended", ()=>{ this._play("assets/audio/loop_combat.mp3", true); }, {once:true});
    },
    combatEnd(){ this.startLoop(); }
  };

  function bleep({freq=440, dur=0.08, type="square", gain=0.08, slide=0, attack=0.002, hp=0, lp=0}={}){
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide!==0){ const endF=Math.max(30,freq+slide); osc.frequency.exponentialRampToValueAtTime(endF, t0+Math.max(0.01, dur*0.9)); }
    g.gain.setValueAtTime( 0.0001 * _AF_getSfxVolume() , t0);
    g.gain.linearRampToValueAtTime( (Math.max(0) * (window._AF_SFX_MASTER || 1.0), (gain) * (window._AF_SFX_MASTER || 1.0)) , t0 + Math.min(0.01, dur*0.25));
    g.gain.linearRampToValueAtTime( (0.0001) * (window._AF_SFX_MASTER || 1.0), t0 + dur);
    osc.connect(g); g.connect(sfxMasterGain);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  const sfx = {
    click(){ bleep({freq:900, dur:0.05}); },
    wing(){ bleep({freq:1200, dur:0.07, slide:-700}); },
    gate(){ bleep({freq:600, dur:0.06}); },
    playerAttack(){ bleep({freq:850, dur:0.08, slide:-300}); },
    monsterAttack(){ bleep({freq:200, dur:0.12, slide:-80}); },
    captureSuccess(){ bleep({freq:1000, dur:0.1, type:"triangle"}); setTimeout(()=>bleep({freq:1500,dur:0.08,type:"triangle"}),100); },
    captureFail(){ bleep({freq:120, dur:0.08}); },
    ballPickup(){ bleep({freq:880, dur:0.07}); setTimeout(()=>bleep({freq:1320, dur:0.06}), 60); },
    gameOver(){ bleep({freq:300, dur:0.2}); setTimeout(()=>bleep({freq:220, dur:0.25}), 100); }
  };

  
  // --- Force-start intro via <audio> tag as well ---
  function tryStartInlineIntro(){
    try {
      var el = document.getElementById("siteIntroAudio");
      if (!el) return;
      el.volume = music.volume;
      el.removeAttribute("muted");
      el.muted = false;
      // try direct play
      try { el.play().catch(function(){
  if (!window) return;
}); } catch(e){}
      // retry a few times in case of race conditions
      var attempts = 0;
      var id = setInterval(function(){
  if (!window) return;

        attempts++;
        if (!el.paused && el.currentTime > 0.05) { clearInterval(id); return; }
        try { el.play().catch(function(){
  if (!window) return;
}); } catch(e){}
        if (attempts > 10) clearInterval(id);
      }, 200);
      // also set as current music handle so later transitions stop it
      music.current = el;
    } catch(e){}
  }

  window.audio = { ctx, music, sfx };

  document.addEventListener("click", (e)=>{
    const el = e.target;
    if (el && el.matches("button, .pixel-btn, .btn, [role='button']")) {
      try{ sfx.click(); }catch(e){}
    }
  }, {passive:true});

  // Wire DOM intro audio on load, then chain to menu music
  window.addEventListener("DOMContentLoaded", ()=>{ tryStartInlineIntro();
    const introEl = document.getElementById("introAudio");
    const startScreen = document.getElementById("startScreen");

    if (introEl) {
      // start via element
      music.siteIntroFromElement(introEl);

      // when intro ends, start menu music (or loop world if menu not visible)
      introEl.addEventListener("ended", ()=>{
        if (startScreen && startScreen.classList.contains("show")) {
          music.menuIntroThenLoop();
        } else {
          music.startLoop();
        }
      }, {once:true});
    } else {
      // fallback (shouldn't happen)
      music.menuIntroThenLoop();
    }

    // Prevent starting menu music before intro finishes
    if (startScreen){
      const mo = new MutationObserver(()=>{/* no-op: wait for intro end */});
      mo.observe(startScreen, { attributes:true, attributeFilter:["class"] });
    }
  });

  // Try to start intro immediately on page load (no user action)
  document.addEventListener("DOMContentLoaded", ()=>{
    try {
      if (!flags.siteIntroStarted) {
        flags.siteIntroStarted = true;
        const a = music.menuIntroThenLoop();
        if (a){
          a.autoplay = true;
          a.addEventListener("ended", ()=>{
            // After intro, if start screen is visible, menu intro -> loop
            try{
              const startScreen = document.getElementById("startScreen");
              if (startScreen && startScreen.classList.contains("show")) {
                music.menuIntroThenLoop();
              }
            }catch(e){}
          }, {once:true});
          // Retry loop in case autoplay is blocked; will keep trying quietly.
          let tries = 0;
          const maxTries = 30; // ~30s total if 1s interval
          const id = setInterval(()=>{
            tries++;
            if (!a.paused && a.currentTime > 0){ clearInterval(id); return; }
            try { a.play().catch(()=>{}); } catch(e){}
            if (tries >= maxTries){ clearInterval(id); }
          }, 1000);
        }
      }
    } catch(e){}
  });

})();