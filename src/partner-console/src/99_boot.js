/* ===== boot ===== */
HOOKS.onBoot.forEach(f=>{try{f();}catch(e){console.error(e);}});
if(!LANGS.includes(S.lang))S.lang='uk';
render();
if(!langReady(S.lang))loadLang(S.lang).then(ok=>{if(!ok)S.lang='en';rerender();});
