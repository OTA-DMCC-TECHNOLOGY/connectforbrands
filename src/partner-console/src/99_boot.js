/* ===== boot ===== */
HOOKS.onBoot.forEach(f=>{try{f();}catch(e){console.error(e);}});
render();
