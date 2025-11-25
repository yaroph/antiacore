
(function(){
  const G = (window.QUESTIONS_GENERAL||[]).map(q => ({...q, type: (q.type||"general")}));
  const P = (window.QUESTIONS_PERSONAL||[]).map(q => ({...q, type: "personnel"}));
  window.QUESTIONS = [...G, ...P];
})();
