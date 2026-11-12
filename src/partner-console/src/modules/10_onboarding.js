/* ===== 10_onboarding: signup → verify → setup, Home dashboard, Settings, org/user menus ===== */

/* ---------- constants ---------- */
const ONB_COUNTRIES=['GB','UA','KZ','PL','MD','GE','RO','DE','AE','SA','QA','KW','BH','OM','XX'];
// pack v12 (MPA 2.6): partners from GCC states can register. Signup asks the tax status of the Partner Data Form —
// country of incorporation, tax residence, VAT registrations, fixed establishment in the UAE — and shows the VAT line that applies.
function onb_taxTs(){const u=S.ui;const inc=u.onb_country||'UA',tax=u.onb_taxCountry||inc;const vr=u.onb_vatRegs;const regs=Array.isArray(vr)?vr:[];
 return{inc,tax,vatRegs:regs,vatRegsSet:vr==='NONE'||regs.length>0,uaeFe:u.onb_uaeFe==='yes'?true:u.onb_uaeFe==='no'?false:null,
  get complete(){return !!(this.inc&&this.inc!=='XX'&&this.tax&&this.tax!=='XX'&&this.vatRegsSet&&this.uaeFe!=null);}};}
function onb_vatBox(){return typeof lg_vatBox==='function'?lg_vatBox(onb_taxTs()):'';}
// order-form currency per country (MPA 8.1): USD, EUR for Approved Countries in Europe
function onb_ccy(cc){return typeof lg_ccy==='function'?lg_ccy(cc):'USD';}
function onb_curs(){return [...new Set(orgCountries().map(onb_ccy))];}
const ONB_ROLES=['admin','finance','warehouse','viewer'];
const ONB_EVENTS=['sim.activated','sim.blocked','order.shipped','invoice.paid'];
const ONB_EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// the core dev stub registers a placeholder Home nav before modules load — replace it
for(let i=NAVS.length-1;i>=0;i--)if(NAVS[i].key==='home')NAVS.splice(i,1);

/* ---------- helpers ---------- */
function onb_cty(c){return !c||c==='XX'?t('onb.cty.XX'):ctyName(c);}
function onb_rnd(n){return rndB32(n).toLowerCase();}
function onb_mask(k){return k.slice(0,11)+'•'.repeat(12)+k.slice(-4);}
function onb_langSel(){return langBtn('onb-langsel');}
function onb_vals(){return [['bolt','v1'],['tag','v2'],['layers','v3']].map(([ic,k])=>`<li>${icon(ic)}<div><b>${t('onb.'+k+'.t')}</b><span>${t('onb.'+k+'.d')}</span></div></li>`).join('');}
function onb_authShell(inner,showVals){
 return `<div class="auth onb-auth"><div class="l"><div class="onb-auth-top"><span class="onb-logo"><span class="bm" aria-hidden="true">CFB</span><b>${t('c.program')}</b></span>${onb_langSel()}</div>
  <div class="box">${inner}${showVals?`<ul class="onb-vals onb-mvals">${onb_vals()}</ul>`:''}</div>
  <p class="xs faint onb-auth-foot">${t('c.copyright',{y:now().getFullYear(),p:t('c.program')})} · <a href="#" data-act="onb_terms">${t('onb.terms')}</a></p></div>
  <div class="r onb-r"><span class="onb-eyebrow">${t('onb.r.eyebrow')}</span><h2>${t('onb.r.title')}</h2><ul class="onb-vals">${onb_vals()}</ul></div></div>`;}
function onb_curCards(name,cur,act){
 return `<div class="radio-cards onb-rcs" role="radiogroup" aria-label="${t('onb.f.currency')}">${['UAH','USD'].map(c=>`<label class="rc onb-rc"><input class="onb-sr" type="radio" name="${name}" value="${c}" ${cur===c?'checked':''} ${act?`data-act="${act}"`:''}><span class="row between g8"><b>${t('onb.cur.'+c)}</b><span class="onb-radio" aria-hidden="true"></span></span><span class="small muted">${t('onb.cur.'+c+'.d')}</span></label>`).join('')}</div>`;}
// annual target = activated devices (keys used) in the last 365 days — a target, not a purchase obligation
function onb_ordersLastYear(){const lim=iso(new Date(now().getTime()-365*864e5));return S.codes.filter(c=>c.status==='activated'&&c.activatedAt>=lim&&c.keyLotId).length;}
function onb_dev(){const o=S.org;if(!o.dev)o.dev={pk:'bc_live_pk_'+onb_rnd(24),sk:'bc_live_sk_'+onb_rnd(32),webhook:'',events:['sim.activated','invoice.paid']};return o.dev;}
function onb_steps(){
 const models=allModels();
 return [
  ['brand',S.brands.length>0,'#catalog'],
  ['model',models.length>0,'#catalog'],
  ['imei',models.some(x=>x.model.imei&&x.model.imei.length>0),'#catalog'],
  ['legalForm',!!(S.lg&&S.lg.submitted),'#lg-form'],
  ['legalSign',typeof lg_pkgSigned==='function'&&lg_pkgSigned(),'#lg-sign'],
  ['order',S.keyOrders.concat(S.tokenOrders).some(o=>o.status!=='draft'),'#order-new'],
  ['pay',S.invoices.some(i=>i.status==='paid'),'#invoices'],
  ['ship',(S.shipments||[]).some(h=>h.status==='received'),'#shipments'],
  ['codes',S.codes.some(c=>c.reseller),'#codes']];}
function onb_closeSide(){const sd=$('#side');if(sd)sd.classList.remove('open');const sc=$('#sidescrim');if(sc)sc.remove();}
function onb_signOut(){S.authed=false;closeOverlay();go('signup');}

/* ---------- auth pages ---------- */
function onb_signupHtml(){
 const back=S.org&&S.user;
 return onb_authShell(`<div class="col g8"><h1 class="onb-h1" tabindex="-1">${t('onb.su.title')}</h1><p class="muted">${t('onb.su.sub')}</p></div>
  ${back?`<div class="onb-resume"><div class="grow"><b class="small">${esc(S.org.name)}</b><div class="xs faint">${esc(S.user.email)}</div></div>${ui.btn(t('onb.su.resume'),{size:'sm',act:'onb_resume'})}</div>`:''}
  <form data-form="onb_signup" class="col g16" novalidate>
   ${ui.field({id:'email',label:t('onb.f.email'),type:'email',value:S.ui.onb_email||'',placeholder:'name@company.com',attrs:'autocomplete="email" autocapitalize="off" spellcheck="false" required'})}
   ${ui.btn(t('onb.su.continue'),{kind:'primary',size:'lg',type:'submit',block:true})}
  </form>
  <div class="onb-or"><span>${t('onb.su.or')}</span></div>
  ${ui.btn(t('onb.su.demo'),{size:'lg',block:true,act:'demo',icon:'spark'})}
  <p class="xs faint">${t('onb.su.demoHint')}</p>`,true);}

function onb_verifyHtml(){
 if(!S.ui.onb_email)return onb_signupHtml();
 const boxes=Array.from({length:6},(_,i)=>`<input class="inp" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="1" ${i===0?'autocomplete="one-time-code"':'autocomplete="off"'} aria-label="${t('onb.vf.digit',{n:i+1})}" data-i="${i}">`).join('');
 return onb_authShell(`<div class="col g8"><a href="#signup" class="small onb-back">${icon('left','sm')}${t('c.back')}</a><h1 class="onb-h1" tabindex="-1">${t('onb.vf.title')}</h1>
   <p class="muted">${t('onb.vf.sub',{email:`<b class="onb-em">${esc(S.ui.onb_email)}</b>`})}</p></div>
  <form data-form="onb_verify" class="col g16" novalidate>
   <div class="col g8"><span class="lbl small"><b>${t('onb.vf.label')}</b></span><div class="onb-code" role="group" aria-label="${t('onb.vf.label')}">${boxes}</div><span class="err onb-codeerr" id="onb-codeerr" aria-live="polite"></span></div>
   ${ui.note('info',t('onb.vf.demo'))}
   ${ui.btn(t('onb.vf.verify'),{kind:'primary',size:'lg',type:'submit',block:true})}
  </form>
  <p class="small muted">${t('onb.vf.noCode')} <button type="button" class="onb-link" data-act="onb_resend">${t('onb.vf.resend')}</button> · <a href="#signup">${t('onb.vf.change')}</a></p>`,false);}

function onb_setupHtml(){
 if(!S.ui.onb_email)return onb_signupHtml();
 if(!S.ui.onb_verified)return onb_verifyHtml();
 const c=S.ui.onb_country||'UA';const tc=S.ui.onb_taxCountry||c;const vr=S.ui.onb_vatRegs;const regs=Array.isArray(vr)?vr:[];const fe=S.ui.onb_uaeFe||'';
 const vatChips=ONB_COUNTRIES.filter(k=>k!=='XX').map(k=>`<label class="lg-vatchip ${regs.includes(k)?'on':''}" title="${esc(onb_cty(k))}"><input type="checkbox" class="lg-sr onb-sr" data-act="onb_vatReg" data-arg="${k}" ${regs.includes(k)?'checked':''} aria-label="${esc(onb_cty(k))}"><span>${k}</span></label>`).join('');
 return onb_authShell(`<div class="col g8"><span class="xs faint onb-stepn">${t('onb.st.step')}</span><h1 class="onb-h1" tabindex="-1">${t('onb.st.title')}</h1><p class="muted">${t('onb.st.sub')}</p></div>
  <form data-form="onb_setup" class="col g16" novalidate>
   ${ui.field({id:'name',label:t('onb.f.company'),placeholder:t('onb.f.companyPh'),value:S.ui.onb_name||'',attrs:'autocomplete="organization" required'})}
   <div class="onb-2">
    ${ui.field({id:'country',label:t('onb.f.countryInc'),type:'select',value:c,options:ONB_COUNTRIES.map(k=>[k,onb_cty(k)]),attrs:'data-act="onb_country"'})}
    ${ui.field({id:'taxCountry',label:t('onb.f.taxCountry'),type:'select',value:tc,options:ONB_COUNTRIES.map(k=>[k,onb_cty(k)]),attrs:'data-act="onb_taxCountry"',hint:t('onb.f.taxCountryH')})}
   </div>
   <fieldset class="field onb-fs0" id="vatRegs-fs" aria-describedby="vatRegs-h"><legend class="lbl">${t('onb.f.vatRegs')}</legend>
    <label class="chk small"><input type="checkbox" name="vatNone" id="vatRegs" data-act="onb_vatNone" ${vr==='NONE'?'checked':''}><span>${t('onb.f.vatNone')}</span></label>
    <div class="lg-vatchips">${vatChips}</div><span class="hint" id="vatRegs-h">${t('onb.f.vatRegsH')}</span></fieldset>
   <fieldset class="field onb-fs0" aria-describedby="uaeFe-h"><legend class="lbl">${t('onb.f.uaeFe')}</legend>
    <div class="row wrap g16">${['yes','no'].map(x=>`<label class="chk small"><input type="radio" name="uaeFe" value="${x}" ${x==='yes'?'id="uaeFe"':''} data-act="onb_uaeFe" ${fe===x?'checked':''}><span>${t('onb.yn.'+x)}</span></label>`).join('')}</div><span class="hint" id="uaeFe-h">${t('onb.f.uaeFeH')}</span></fieldset>
   <div id="onb-vat">${onb_vatBox()}</div>
   ${ui.field({id:'taxId',label:t('onb.f.regno'),placeholder:t('onb.f.regnoPh'),value:S.ui.onb_taxId||'',hint:t('onb.f.optHint')})}
   <fieldset class="field" style="border:0;padding:0;margin:0"><legend class="lbl">${t('onb.f.ccs')}</legend><div class="row wrap g12">${Object.keys(CC_META).map(cc=>`<label class="chk small"><input type="checkbox" name="cc_${cc}" ${(S.ui.onb_ccs?S.ui.onb_ccs.includes(cc):cc==='UA')?'checked':''}><span>${esc(ctyName(cc))}</span></label>`).join('')}</div><span class="hint" id="cc_UA-h">${t('onb.f.ccsH')}</span></fieldset>
   <div class="onb-2">${ui.field({id:'lang2',label:t('onb.f.lang2'),type:'select',value:S.ui.onb_lang2||'ru',options:LANG2_AVAILABLE.map(l=>[l,LANG_NAMES[l]||l]),hint:t('onb.f.lang2H')})}
   <div class="field"><span class="lbl">${t('onb.f.code')}</span><b class="mono onb-prefix" id="onb_codeP" style="font-size:20px">${esc(proposeCode(S.ui.onb_name||''))}</b><span class="hint">${t('onb.f.codeH')}</span></div></div>
   ${ui.note('info',t('onb.f.billingNote'))}
   <div class="field"><label class="chk small"><input type="checkbox" name="agree" id="agree" aria-describedby="agree-h" ${S.ui.onb_agree?'checked':''}><span>${t('onb.f.agree',{terms:`<a href="#" data-act="onb_terms">${t('onb.termsLink')}</a>`})}</span></label><span class="hint" id="agree-h"></span></div>
   ${ui.btn(t('onb.st.submit'),{kind:'primary',size:'lg',type:'submit',block:true})}
  </form>`,false);}

// re-render the setup step (VAT treatment box) without losing what was typed; focus returns to the control that changed
function onb_keepSetup(focusSel){const f=$('form[data-form=onb_setup]');if(f){const d=formData(f);S.ui.onb_name=d.name||S.ui.onb_name||'';S.ui.onb_taxId=d.taxId||'';
  S.ui.onb_ccs=Object.keys(d).filter(k=>k.startsWith('cc_')&&d[k]).map(k=>k.slice(3));S.ui.onb_agree=!!d.agree;S.ui.onb_lang2=d.lang2||S.ui.onb_lang2;}
 rerender();if(focusSel){const el=document.querySelector(focusSel);if(el)el.focus({preventScroll:true});}}
route('signup',{auth:false,render:onb_signupHtml});
route('verify',{auth:false,render:onb_verifyHtml});
route('setup',{auth:false,render:onb_setupHtml});

function onb_bindCode(){
 const wrap=$('.onb-code');if(!wrap||wrap.dataset.bound)return;wrap.dataset.bound='1';
 const ins=$$('input',wrap);const form=wrap.closest('form');
 const fill=(start,str)=>{const d=digits(str).split('');let i=start;for(const ch of d){if(i>5)break;ins[i].value=ch;i++;}return i;};
 const check=()=>{const v=ins.map(x=>x.value).join('');if(/^\d{6}$/.test(v))form.requestSubmit();};
 ins.forEach((el,i)=>{
  el.addEventListener('input',()=>{const v=el.value;$('#onb-codeerr').textContent='';ins.forEach(x=>x.removeAttribute('aria-invalid'));
   if(v.length>1){const nx=fill(i,v);(ins[Math.min(nx,5)]).focus();check();return;}
   el.value=digits(v);if(el.value&&i<5)ins[i+1].focus();check();});
  el.addEventListener('keydown',e=>{
   if(e.key==='Backspace'&&!el.value&&i>0){ins[i-1].focus();ins[i-1].value='';e.preventDefault();}
   else if(e.key==='ArrowLeft'&&i>0){ins[i-1].focus();e.preventDefault();}
   else if(e.key==='ArrowRight'&&i<5){ins[i+1].focus();e.preventDefault();}});
  el.addEventListener('paste',e=>{const tx=(e.clipboardData||window.clipboardData).getData('text');if(!tx)return;e.preventDefault();const nx=fill(i,tx);ins[Math.min(nx,5)].focus();check();});
  el.addEventListener('focus',()=>el.select());});
 ins[0].focus();}
HOOKS.afterRender.push(()=>{if(!S.authed)onb_bindCode();});
document.addEventListener('input',e=>{if(e.target&&e.target.id==='name'&&e.target.closest('form[data-form=onb_setup]')){S.ui.onb_name=e.target.value;const el=$('#onb_codeP');if(el)el.textContent=proposeCode(e.target.value);}});

FORM.onb_signup=f=>{clearErrs(f);const v=formData(f).email.trim();
 if(!v)return setErr(f,'email',t('onb.e.emailReq'));
 if(!ONB_EMAIL_RE.test(v))return setErr(f,'email',t('onb.e.email'));
 S.ui.onb_email=v.toLowerCase();S.ui.onb_verified=false;go('verify');};
FORM.onb_verify=f=>{const v=$$('.onb-code input',f).map(x=>x.value).join('');
 if(!/^\d{6}$/.test(v)){$('#onb-codeerr').textContent=t('onb.e.code');const first=$$('.onb-code input',f).find(x=>!/^\d$/.test(x.value));if(first){first.setAttribute('aria-invalid','true');first.focus();}return;}
 S.ui.onb_verified=true;
 if(S.org&&S.user&&S.user.email===S.ui.onb_email){S.authed=true;toast(t('onb.t.back',{name:esc(S.org.name)}));go('home');return;} // returning partner: sign in, keep data
 go('setup');};
FORM.onb_setup=f=>{clearErrs(f);const d=formData(f);let bad=false;
 const name=d.name.trim(),tax=d.taxId.trim();
 if(name.length<2){setErr(f,'name',t('onb.e.company'));bad=true;}
 if(tax&&!/^[A-Za-z0-9 -]{6,16}$/.test(tax)){setErr(f,'taxId',t('onb.e.tax'));bad=true;}
 // v12 tax status (Data Form A / MPA 2.6) — required, no country is refused
 const vr=S.ui.onb_vatRegs;if(!(vr==='NONE'||(Array.isArray(vr)&&vr.length))){setErr(f,'vatNone',t('onb.e.vatRegs'));bad=true;}
 const fe=S.ui.onb_uaeFe;if(fe!=='yes'&&fe!=='no'){setErr(f,'uaeFe',t('onb.e.uaeFe'));bad=true;}
 if(!d.agree){setErr(f,'agree',t('onb.e.agree'));bad=true;}
 if(bad){const x=f.querySelector('[aria-invalid="true"]');if(x)x.focus();return;}
 const ccs=Object.keys(CC_META).filter(cc=>d['cc_'+cc]);if(!ccs.length){setErr(f,'cc_UA',t('onb.e.ccs'));return;}
 const email=S.ui.onb_email,lang=S.lang;const code=proposeCode(name);
 S=freshState();S.lang=lang;
 S.user={email,name:''};
 S.org={name,code,codeStatus:'proposed',lang2:d.lang2||'ru',country:d.country,taxCountry:d.taxCountry||d.country,countries:ccs,regNo:tax,taxId:'',address:'',currency:'USD',prefix:makePrefix(ccs[0]),createdAt:iso(now()),commit:3000,serials:{},delivery:{},
  vatRegs:vr==='NONE'?[]:vr.slice(),uaeFe:fe==='yes'};
 codeRegister(code);
 // the questionnaire starts from the signup tax status (P_INC_COUNTRY, P_TAX_COUNTRY, P_VAT_REGS, P_UAE_FE)
 S.form=S.form||{};const pf=(k,v)=>{S.form[k]={value:v,status:'filled',comment:'',by:email,at:iso(now())};};
 if(d.country&&d.country!=='XX'){pf('P_INC_COUNTRY',d.country);pf('P_COUNTRY',d.country);}if(S.org.taxCountry&&S.org.taxCountry!=='XX')pf('P_TAX_COUNTRY',S.org.taxCountry);
 pf('P_VAT_REGS',vr==='NONE'?'NONE':vr.join(','));pf('P_UAE_FE',fe);
 // demo: OTA's standard price list for the chosen countries (OTA reviews and adjusts it in OTA mode)
 ccs.forEach(cc=>{S.priceLists[cc]=[Object.assign({ver:1,from:iso(now()),to:null,createdAt:iso(now()),by:'OTA',note:'',increase:false},plSeed(cc))];});
 S.actor='u_p_admin';audit('partner.signup',code,{name,country:d.country,countries:ccs});
 S.authed=true;log(t('onb.log.created',{name}));toast(t('onb.t.welcome'));go('home');};

Object.assign(ACT,{
 demo(){seedDemo();go('home');},
 onb_resume(){S.authed=true;go('home');},
 onb_resend(){toast(t('onb.t.resent',{email:esc(S.ui.onb_email||'')}));const f=$('.onb-code input');if(f){$$('.onb-code input').forEach(x=>x.value='');f.focus();}},
 onb_country(v){const tc=S.ui.onb_taxCountry;if(!tc||tc===S.ui.onb_country)S.ui.onb_taxCountry=v;S.ui.onb_country=v;onb_keepSetup('#country');},
 onb_taxCountry(v){S.ui.onb_taxCountry=v;onb_keepSetup('#taxCountry');},
 onb_vatNone(on){S.ui.onb_vatRegs=on?'NONE':null;onb_keepSetup('#vatRegs');},
 onb_vatReg(on,el){const k=el.dataset.arg;let a=Array.isArray(S.ui.onb_vatRegs)?S.ui.onb_vatRegs.slice():[];a=a.filter(x=>x!==k);if(on)a.push(k);S.ui.onb_vatRegs=a.length?a:null;onb_keepSetup(`[data-act=onb_vatReg][data-arg="${k}"]`);},
 onb_uaeFe(v){S.ui.onb_uaeFe=v;onb_keepSetup(`input[name=uaeFe][value="${v}"]`);},
 onb_curTouch(v,el){const f=el.closest('form');if(f)f.dataset.curTouched='1';},
 onb_terms(){modal(t('onb.terms'),`<div class="onb-terms small">${t('onb.termsBody')}</div>`,ui.btn(t('c.close'),{kind:'primary',act:'ovclose'}),{wide:true});},
});

/* ---------- Home ---------- */
const ONB_NEXT={awaiting_payment:'pay',paid:'prod',production:'ship',shipped:'deliver',delivered:'accept'};
const ONB_TONE={awaiting_payment:'warn',paid:'info',production:'info',shipped:'accent',delivered:'ok',in_stock:'ok'};
function onb_checklistCard(){
 const st=onb_steps();const done=st.filter(s=>s[1]).length;const all=done===st.length;
 if(all&&S.ui.onb_checklistHidden)return '';
 const firstOpen=st.findIndex(s=>!s[1]);
 const items=st.map(([k,ok,href],i)=>`<div class="it ${ok?'done':''}"><span class="ck" aria-hidden="true">${ok?icon('check','sm'):`<span class="xs faint num">${i+1}</span>`}</span>
   <div class="grow"><b class="${ok?'onb-done':''}">${t('onb.ck.'+k)}</b><div class="small muted">${t('onb.ck.'+k+'.d')}</div></div>
   ${ok?ui.badge(t('onb.ck.doneB'),'ok'):ui.btn(t('onb.ck.'+k+'.b'),{size:'sm',kind:i===firstOpen?'primary':'',href})}</div>`).join('');
 return ui.card({title:all?t('onb.ck.allDone'):t('onb.ck.title'),
  actions:`<span class="small muted num">${t('onb.ck.prog',{x:done,n:st.length})}</span>${all?ui.btn(t('onb.ck.hide'),{size:'sm',kind:'ghost',act:'onb_hideCk'}):''}`,
  body:all?`<div class="row g12 onb-alldone"><span class="onb-okic" aria-hidden="true">${icon('check','sm')}</span><p class="small muted grow">${t('onb.ck.allDoneD')}</p></div>`:`<div class="col g12">${ui.bar(done/st.length)}<div class="checklist">${items}</div></div>`});}

function onb_homeHtml(){
 let stock=0,active=0;for(const s of S.sims){if(s.status==='stock')stock++;else if(s.status==='active')active++;}
 const n=now(),ym=n.getFullYear()*12+n.getMonth();let actM=0;
 for(const c of S.codes){if(c.status==='activated'&&c.activatedAt){const d=new Date(c.activatedAt);if(d.getFullYear()*12+d.getMonth()===ym)actM++;}}
 // v12: token and key stock is kept per country (tokenStats(k,cc) / keyStats(cc)) — shown per country, never pooled
 const ccs=orgCountries();const perCc=ccs.map(cc=>{const tk={};let avail=0;PLANS.forEach(p=>TERMS.forEach(tm=>{const k=pkgKey(p,tm);const st=tokenStats(k,cc);if(st.bought){tk[k]=st;avail+=st.avail;}}));return{cc,tk,avail,ks:keyStats(cc)};});
 const avail=perCc.reduce((a,x)=>a+x.avail,0);const ksAvail=perCc.reduce((a,x)=>a+x.ks.avail,0);
 const ccLine=perCc.filter(x=>x.avail||x.ks.avail).map(x=>t('onb.k.ccAvail',{n:fmtNum(x.avail),k:fmtNum(x.ks.avail),c:ctyName(x.cc)})).join(' · ');
 const kpis=`<div class="grid4">${ui.kpi(t('onb.k.stock'),fmtNum(stock),t('onb.k.stockS'),{href:'#sims'})}${ui.kpi(t('onb.k.active'),fmtNum(active),t('onb.k.activeS'),{href:'#sims'})}${ui.kpi(t('onb.k.act'),fmtNum(actM),fmtDate(n,{month:'long',year:'numeric'}),{href:'#codes'})}${ui.kpi(t('onb.k.cred'),fmtNum(avail),ccLine||t('onb.k.credS',{k:fmtNum(ksAvail)}),{href:'#codes'})}</div>`;
 // Service Tokens & Activation Keys — one block of rows per country
 const credRows=[];const multi=perCc.length>1;
 perCc.forEach(({cc,tk,ks})=>{const cl=multi?`<div class="xs faint">${esc(ctyName(cc))}</div>`:'';
  if(ks.bought)credRows.push({cells:[`<b>${t('onb.cr.keys')}</b>${cl}`,`<span class="num">${fmtNum(ks.bought)}</span>`,`<span class="num">${fmtNum(ks.used)}</span>`,`<div class="onb-avail"><span class="num"><b>${fmtNum(ks.avail)}</b></span></div>`,`<div class="onb-barcell">${ui.bar(ks.bought?ks.used/ks.bought:0)}</div>`]});
  Object.keys(tk).forEach(k=>{const c=tk[k];const {plan:p,term:tm}=pkgSplit(k);const low=c.avail<c.bought*0.1;
   credRows.push({cells:[`<b>${pkgLabel(p,tm)}</b>${cl}`,`<span class="num">${fmtNum(c.bought)}</span>`,`<span class="num">${fmtNum(c.used)}</span>`,
    `<div class="onb-avail"><span class="num"><b>${fmtNum(c.avail)}</b></span>${low?ui.badge(t('onb.cr.low'),'warn',true):''}</div>`,
    `<div class="onb-barcell">${ui.bar(c.bought?c.used/c.bought:0,low?'warn':'')}</div>`]});});});
 const credCard=ui.card({title:t('onb.cr.title'),actions:credRows.length?ui.btn(t('onb.cr.buy'),{size:'sm',href:'#order-new',icon:'plus'}):'',pad:false,
  body:credRows.length?ui.table([{label:t('onb.cr.pkg')},{label:t('onb.cr.bought'),cls:'r'},{label:t('onb.cr.used'),cls:'r'},{label:t('onb.cr.avail'),cls:'r'},{label:t('onb.cr.usage')}],credRows):ui.empty('layers',t('onb.cr.empty'),t('onb.cr.emptyD'),ui.btn(t('onb.cr.buy0'),{href:'#order-new',icon:'plus'}))});
 // in progress: orders awaiting payment + SIM shipments on the way
 const ords=S.keyOrders.map(o=>['key',o]).concat(S.tokenOrders.map(o=>['token',o])).filter(([,o])=>o.status==='awaiting_payment'||o.status==='draft');
 const shs=(S.shipments||[]).filter(h=>h.status!=='received');
 const ordRows=ords.map(([ty,o])=>({href:link('order',o.id),cells:[`<b class="mono onb-nw">${esc(o.no)}</b><div class="xs faint">${t(ty==='key'?'ord.type.key':'ord.type.token')}</div>`,ui.badge(t('ord.st.'+o.status),o.status==='draft'?'':'warn',true),`<span class="small muted">${t(o.status==='draft'?'onb.nx.draft':'onb.nx.pay')}</span>`]}))
  .concat(shs.map(h=>({href:link('shipment',h.id),cells:[`<b class="mono onb-nw">${esc(h.pf)}</b><div class="xs faint">${t('onb.or.sims',{n:fmtNum(h.qty)})}</div>`,ui.badge(t('ord.sh.st.'+h.status),'accent',true),`<span class="small muted">${t(h.status==='delivered'?'onb.nx.receive':'onb.nx.wait')}</span>`]})));
 const ordCard=ui.card({title:t('onb.or.title'),actions:ui.btn(t('onb.all'),{size:'sm',kind:'ghost',href:'#orders'}),pad:false,
  body:ordRows.length?ui.table([{label:t('onb.or.order')},{label:t('c.status')},{label:t('onb.or.next')}],ordRows):`<div class="onb-mini">${t('onb.or.none')}</div>`});
 // invoices to pay
 const invs=S.invoices.filter(i=>i.status==='open');
 const invCard=ui.card({title:t('onb.iv.title'),actions:ui.btn(t('onb.all'),{size:'sm',kind:'ghost',href:'#invoices'}),pad:false,
  body:invs.length?ui.table([{label:t('onb.iv.inv')},{label:t('onb.iv.amount'),cls:'r'}],invs.map(i=>{const over=i.dueAt&&new Date(i.dueAt)<n;return{href:link('invoice',i.id),cells:[`<b class="mono onb-nw">${esc(i.number)}</b><div class="xs ${over?'':'faint'}">${t('onb.iv.due')} ${i.dueAt?fmtDate(i.dueAt):'—'}${over?' · '+t('onb.iv.over'):''}</div>`,`<b class="num onb-nw">${money(i.total,typeof docCcy==='function'?docCcy(i):(i.currency||'USD'))}</b>`]};})):S.invoices.length?`<div class="onb-mini">${icon('check','sm')} ${t('onb.iv.none')}</div>`:`<div class="onb-mini">${t('onb.iv.empty')}</div>`});
 // activity
 const acts=S.activity.slice(0,8);
 const actCard=ui.card({title:t('onb.ac.title'),body:acts.length?`<ul class="onb-feed">${acts.map(a=>`<li><span class="onb-dot" aria-hidden="true"></span><div class="grow"><div>${esc(a.text)}</div><div class="xs faint num">${fmtDateTime(a.ts)}</div></div></li>`).join('')}</ul>`:`<p class="muted small">${t('onb.ac.none')}</p>`});
 // code profile: one line here, the full digit table lives on the Codes page
 const pre=S.org.prefix;
 const profCard=ui.card({title:t('onb.pf.title'),body:`<div class="col g8"><div class="row between wrap g8"><div><div class="xs faint">${t('onb.pf.prefix')}</div><div class="onb-prefix mono">${esc(pre)}</div></div>${ui.btn(t('onb.pf.copy'),{size:'sm',icon:'copy',act:'copy',arg:pre})}</div>
   <p class="small muted">${t('onb.pf.d')} <a href="#codes">${t('onb.pf.more')}</a></p></div>`});
 const firstName=S.user&&S.user.name?S.user.name.split(' ')[0]:'';
 const nextStep=onb_steps().find(s=>!s[1]);
 return ui.page({title:firstName?t('onb.h.hiName',{name:esc(firstName)}):t('onb.h.title'),sub:`${esc(S.org.name)} · ${fmtDate(n,{weekday:'long',day:'numeric',month:'long'})}`,
  actions:nextStep?ui.btn(t('onb.ck.'+nextStep[0]+'.b'),{kind:'primary',href:nextStep[2],icon:'right'}):ui.btn(t('onb.h.order'),{kind:'primary',href:'#order-new',icon:'plus'}),
  body:`<div class="stack">${onb_checklistCard()}${kpis}<div class="onb-cols"><div class="stack">${credCard}${ordCard}${actCard}</div><div class="stack">${invCard}${profCard}</div></div></div>`});}

function onb_codeProfile(){const pre=S.org.prefix;
 const digitsTbl=Object.keys(PKG_DIGIT).sort((a,b)=>B32.indexOf(PKG_DIGIT[a])-B32.indexOf(PKG_DIGIT[b])).map(k=>{const [p,tm]=k.split('-');return `<tr><td class="mono"><b>${PKG_DIGIT[k]}</b></td><td>${pkgLabel(p,+tm)}</td></tr>`;}).join('');
 return ui.card({title:t('onb.pf.title'),body:`<div class="col g12"><div class="row between wrap g8"><div><div class="xs faint">${t('onb.pf.prefix')}</div><div class="onb-prefix mono">${esc(pre)}</div></div>${ui.btn(t('onb.pf.copy'),{size:'sm',icon:'copy',act:'copy',arg:pre})}</div>
  <p class="small muted">${t('onb.pf.d')}</p><div class="onb-sample mono" aria-label="${t('onb.pf.sample')}"><span class="onb-pre">${esc(pre)}</span><span class="onb-pd">4</span>XXXXXXXXXX</div>
  <div class="small muted">${t('onb.pf.digit')}</div><div class="tblwrap"><table class="tbl onb-dtbl"><thead><tr><th scope="col">${t('onb.pf.d6')}</th><th scope="col">${t('onb.cr.pkg')}</th></tr></thead><tbody>${digitsTbl}</tbody></table></div></div>`});}
route('home',{nav:'home',render:onb_homeHtml});
nav({key:'home',label:()=>t('onb.nav.home'),icon:'home',href:'#home',order:1});
ACT.onb_hideCk=()=>{S.ui.onb_checklistHidden=true;toast(t('onb.t.ckHidden'));rerender();};

/* ---------- Settings ---------- */
function onb_tabCompany(){const o=S.org;
 return ui.card({title:t('onb.s.company'),body:`<form data-form="onb_company" class="col g16 onb-form" novalidate>
  <div class="onb-logo">${orgMark(56)}<div class="col g4"><b class="small">${t('onb.logo.t')}</b><span class="xs faint">${t('onb.logo.d')}</span><div class="row wrap g8" style="margin-top:4px"><label class="btn sm" for="onb_logo">${icon('upload','sm')}<span>${t('onb.logo.up')}</span></label><input type="file" id="onb_logo" accept="image/png,image/jpeg,image/svg+xml,image/webp" hidden>${o.logo?ui.btn(t('onb.logo.rm'),{size:'sm',kind:'ghost',act:'onb_logoRm'}):''}</div><span class="xs" id="onb_logo-h"></span></div></div>
  ${ui.field({id:'name',label:t('onb.f.company'),value:o.name,attrs:'autocomplete="organization"'})}
  <div class="onb-2">${ui.field({id:'country',label:t('onb.f.country'),value:onb_cty(o.country),hint:t('onb.s.countryRo'),attrs:'readonly aria-readonly="true"'})}
  ${ui.field({id:'taxId',label:t('onb.f.tax'),value:o.taxId||'',hint:t('onb.f.optHint')})}</div>
  ${ui.field({id:'address',label:t('onb.f.address'),value:o.address||'',placeholder:t('onb.f.addressPh'),hint:t('onb.f.addressHint'),attrs:'autocomplete="street-address"'})}
  ${ui.field({id:'phone',label:t('onb.f.phone'),type:'tel',value:o.phone||'',placeholder:'+380 00 000 00 00',attrs:'autocomplete="tel"'})}
  <div class="row">${ui.btn(t('c.save'),{kind:'primary',type:'submit'})}</div></form>`});}

function onb_entityDl(){const v=k=>otaVal(k);
 return `<dl class="dl small"><dt>${t('onb.b.seller')}</dt><dd><b>${esc(v('OTA_NAME')||'')}</b></dd>${v('OTA_REGNO')?`<dt>${t('onb.b.reg')}</dt><dd>${esc(v('OTA_REGNO'))}${v('OTA_LICENCE')?' · '+esc(v('OTA_LICENCE')):''}</dd>`:''}${v('OTA_TRN')?`<dt>TRN</dt><dd class="mono">${esc(v('OTA_TRN'))}</dd>`:''}<dt>${t('onb.b.addr')}</dt><dd>${esc(v('OTA_ADDR_EN')||'')}</dd>${v('OTA_BANK_IBAN')?`<dt>IBAN</dt><dd class="mono">${esc(v('OTA_BANK_IBAN'))}</dd>`:''}${v('OTA_BANK_NAME')?`<dt>${t('onb.b.bankName')}</dt><dd>${esc(v('OTA_BANK_NAME'))}${v('OTA_BANK_SWIFT')?' · <span class="mono">'+esc(v('OTA_BANK_SWIFT'))+'</span>':''}</dd>`:''}<dt>${t('onb.b.vat')}</dt><dd>${onb_vatLine()}</dd></dl>`;}
// v12: the VAT line that applies to this partner (Document 13 wording; rate from vatRateFor / MPA 2.6 rule)
function onb_vatLine(){if(typeof lg_vatRate!=='function'||typeof LG_VAT_TXT==='undefined')return t('onb.b.vat0');const ts=lg_taxStatus();if(!ts.complete)return esc(t('lg.vat.incomplete'));
 const five=lg_vatRate()>=0.05;const L=S.lang==='en'?'en':'ru';return `${ui.badge(five?'5%':'0%',five?'warn':'ok')} ${esc(five?LG_VAT_TXT.uae[L]:(typeof lg_vatTxt==='function'?lg_vatTxt(LG_VAT_TXT.zero):LG_VAT_TXT.zero[L]))}`;}
function onb_tabBilling(){const o=S.org;
 const ordered=onb_ordersLastYear();const frac=o.commit?ordered/o.commit:0;const cs=codeAvailable(o.code,o.code);
 const admin=S.admin?ui.card({title:`${t('onb.ad.title')} ${ui.badge('OTA','violet')}`,body:`<div class="col g12">${ui.note('admin',t('onb.ad.note'))}
   <form data-form="onb_code" class="row wrap g8" novalidate style="align-items:flex-end">${ui.field({id:'code',label:t('onb.ad.code'),value:o.code||'',mono:true,attrs:'maxlength="3" autocomplete="off" style="width:110px;text-transform:uppercase" '+(can('ota.codes')?'':'disabled'),hint:o.codeStatus==='approved'?t('onb.ad.codeOk'):t('onb.ad.codeProp')})}${ui.btn(o.codeStatus==='approved'?t('c.save'):t('onb.ad.approve'),{kind:'primary',type:'submit',size:'sm',disabled:!can('ota.codes')})}</form>
   <dl class="dl small"><dt>${t('onb.ad.pid')}</dt><dd class="mono">${esc(o.prefix.slice(1))}</dd><dt>${t('onb.pf.prefix')}</dt><dd class="mono">${esc(o.prefix)}</dd><dt>${t('onb.ad.created')}</dt><dd>${fmtDate(o.createdAt)}</dd></dl>
   <div>${ui.btn(t('onb.ad.reset'),{kind:'danger',act:'onb_resetAsk',icon:'trash'})}</div></div>`}):'';
 return `<div class="stack">${ui.card({title:t('onb.b.cur'),body:`<div class="col g12"><p class="small muted">${t('onb.b.curD2')}</p><dl class="dl small"><dt>${t('onb.b.code')}</dt><dd><b class="mono">${esc(o.code||'—')}</b> ${o.codeStatus==='approved'?ui.badge(t('onb.b.codeOk'),'ok'):ui.badge(t('onb.b.codeProp'),'warn')}</dd><dt>${t('onb.b.ccs')}</dt><dd>${orgCountries().map(c=>esc(ctyName(c))+' <span class="xs muted mono">'+esc(onb_ccy(c))+'</span>').join(', ')}</dd><dt>${t('onb.b.lang2')}</dt><dd>${esc(LANG_NAMES[o.lang2]||o.lang2||'—')}</dd></dl></div>`})}
  ${ui.card({title:t('onb.b.entity'),actions:ui.badge(onb_curs().join(' / '),'accent'),body:onb_entityDl()})}
  ${ui.card({title:t('onb.b.commit'),body:`<div class="col g12"><div class="row between wrap g8"><div><span class="onb-big num">${fmtNum(ordered)}</span> <span class="muted">/ ${fmtNum(o.commit)} ${t('onb.b.sims')}</span></div><span class="small muted num">${pct(Math.min(frac,9.99))}</span></div>${ui.bar(frac,frac>=1?'ok':'')}<p class="small muted">${t('onb.b.commitD',{n:fmtNum(o.commit)})}</p></div>`})}
  ${admin}</div>`;}
FORM.onb_code=f=>{if(!can('ota.codes'))return;clearErrs(f);const v=String(formData(f).code||'').trim().toUpperCase();const o=S.org;const e=codeAvailable(v,o.code);
 if(e){setErr(f,'code',t('onb.e.code.'+e));return;}const was=o.code;o.code=v;o.codeStatus='approved';codeRegister(v);audit('partner.code.approve',v,{was});log(t('onb.log.code',{c:v}));toast(t('onb.t.code',{c:v}));rerender();};

function onb_tabTeam(){const team=S.org.team||[];
 const roleB=r=>ui.badge(t('onb.r.'+r),r==='owner'?'accent':'');
 const rows=[{cells:[`<div class="row g8"><span class="onb-av" aria-hidden="true">${esc((S.user.email||'?')[0].toUpperCase())}</span><div class="grow"><b>${esc(S.user.name||S.user.email)}</b><div class="xs faint">${esc(S.user.email)} · ${t('onb.tm.you')}</div></div></div>`,roleB('owner'),ui.badge(t('onb.tm.active'),'ok',true),'']}]
  .concat(team.map(m=>({cells:[`<div class="row g8"><span class="onb-av" aria-hidden="true">${esc(m.email[0].toUpperCase())}</span><div class="grow"><b>${esc(m.email)}</b><div class="xs faint">${t('onb.tm.invited',{d:fmtDate(m.invitedAt)})}</div></div></div>`,roleB(m.role),ui.badge(t('onb.tm.pending'),'warn',true),ui.iconbtn('trash',t('onb.tm.remove'),{act:'onb_rmAsk',arg:m.id})]})));
 return ui.card({title:t('onb.s.team'),actions:ui.btn(t('onb.tm.invite'),{kind:'primary',size:'sm',icon:'plus',act:'onb_invite'}),pad:false,
  body:ui.table([{label:t('onb.tm.member')},{label:t('onb.tm.role')},{label:t('c.status')},{label:'',cls:'r'}],rows)+`<div class="onb-roles small muted">${ONB_ROLES.map(r=>`<div><b>${t('onb.r.'+r)}</b> — ${t('onb.r.'+r+'.d')}</div>`).join('')}</div>`});}

function onb_tabDev(){const d=onb_dev();const rv=S.ui.onb_reveal||{};
 const keyRow=(k,label,hint)=>`<div class="onb-key"><div class="grow"><div class="row g8"><b class="small">${label}</b></div><div class="xs faint">${hint}</div><code class="onb-keyval mono">${esc(rv[k]?d[k]:onb_mask(d[k]))}</code></div>
  <div class="row g4">${ui.btn(rv[k]?t('onb.dv.hide'):t('onb.dv.reveal'),{size:'sm',kind:'ghost',icon:'eye',act:'onb_reveal',arg:k})}${ui.btn(t('onb.pf.copy'),{size:'sm',icon:'copy',act:'copy',arg:d[k]})}</div></div>`;
 return `<div class="stack">${ui.note('warn',`<b>${t('onb.dv.preview')}</b> — ${t('onb.dv.previewD')}`)}
  ${ui.card({title:`${t('onb.dv.keys')} ${ui.badge(t('onb.dv.previewB'),'info')}`,actions:ui.btn(t('onb.dv.regen'),{size:'sm',kind:'danger',act:'onb_regenAsk'}),body:`<div class="col g12">${keyRow('pk',t('onb.dv.pk'),t('onb.dv.pkD'))}${keyRow('sk',t('onb.dv.sk'),t('onb.dv.skD'))}</div>`})}
  ${ui.card({title:`${t('onb.dv.wh')} ${ui.badge(t('onb.dv.previewB'),'info')}`,body:`<form data-form="onb_webhook" class="col g16 onb-form" novalidate>
   ${ui.field({id:'url',label:t('onb.dv.url'),type:'url',value:d.webhook,placeholder:'https://example.com/webhooks/bc',hint:t('onb.dv.urlHint'),mono:true})}
   <fieldset class="onb-fs"><legend class="small"><b>${t('onb.dv.events')}</b></legend><div class="onb-evs">${ONB_EVENTS.map(ev=>`<label class="chk small"><input type="checkbox" name="ev_${ev.replace('.','_')}" ${d.events.includes(ev)?'checked':''}><span><span class="mono">${ev}</span><br><span class="faint xs">${t('onb.ev.'+ev.replace('.','_'))}</span></span></label>`).join('')}</div></fieldset>
   <div class="row">${ui.btn(t('c.save'),{kind:'primary',type:'submit'})}</div></form>`})}</div>`;}

function onb_settingsHtml(tab){
 tab=['billing','team','developers'].includes(tab)?tab:'company';
 const tabs=ui.tabs([['company',t('onb.s.company'),'#settings'],['billing',t('onb.s.billing'),'#settings--billing'],['team',t('onb.s.team'),'#settings--team'],['developers',t('onb.s.dev'),'#settings--developers']],tab);
 const body={company:onb_tabCompany,billing:onb_tabBilling,team:onb_tabTeam,developers:onb_tabDev}[tab]();
 // ТЗ 2.5: partner card shows the pending bank-details change (S.bankChange, owned by 70_legal)
 const bank=(tab==='company'||tab==='billing')&&typeof lg_bankBanner==='function'?lg_bankBanner():'';
 return ui.page({title:t('onb.nav.settings'),sub:t('onb.s.sub'),body:tabs+`<div class="onb-set">${bank?`<div style="margin-bottom:16px">${bank}</div>`:''}${body}</div>`});}

route('settings',{nav:'settings',render:onb_settingsHtml});
nav({key:'settings',label:()=>t('onb.nav.settings'),icon:'gear',href:'#settings',section:()=>t('onb.nav.account'),order:90});

FORM.onb_company=f=>{clearErrs(f);const d=formData(f);const name=d.name.trim(),tax=d.taxId.trim(),ph=d.phone.trim();let bad=false;
 if(name.length<2){setErr(f,'name',t('onb.e.company'));bad=true;}
 if(tax&&!/^[A-Za-z0-9 -]{6,16}$/.test(tax)){setErr(f,'taxId',t('onb.e.tax'));bad=true;}
 if(ph&&!/^\+?[0-9 ()-]{7,20}$/.test(ph)){setErr(f,'phone',t('onb.e.phone'));bad=true;}
 if(bad)return;
 Object.assign(S.org,{name,taxId:tax,address:d.address.trim(),phone:ph});log(t('onb.log.company'));toast(t('onb.t.company'));rerender();};
FORM.onb_webhook=f=>{clearErrs(f);const d=formData(f);const url=d.url.trim();
 if(url&&!/^https:\/\/[^\s/$.?#].[^\s]*$/i.test(url))return setErr(f,'url',t('onb.e.url'));
 const dv=onb_dev();dv.webhook=url;dv.events=ONB_EVENTS.filter(ev=>d['ev_'+ev.replace('.','_')]);toast(t('onb.t.webhook'));rerender();};
FORM.onb_inviteF=f=>{clearErrs(f);const d=formData(f);const em=d.email.trim().toLowerCase();
 if(!ONB_EMAIL_RE.test(em))return setErr(f,'email',t('onb.e.email'));
 S.org.team=S.org.team||[];
 if(em===S.user.email||S.org.team.some(m=>m.email===em))return setErr(f,'email',t('onb.e.dup'));
 S.org.team.push({id:uid('tm'),email:em,role:d.role,invitedAt:iso(now())});log(t('onb.log.invite',{email:em}));closeOverlay();toast(t('onb.t.invited',{email:esc(em)}));rerender();};

Object.assign(ACT,{
 onb_setCur(v){if(v!=='UAH'&&v!=='USD')return;S.org.currency=v;log(t('onb.log.cur',{c:v}));toast(t('onb.t.cur',{c:t('onb.cur.'+v)}));rerender();},
 onb_invite(){modal(t('onb.tm.inviteT'),`<form data-form="onb_inviteF" id="onb-invf" class="col g16" novalidate>${ui.field({id:'email',label:t('onb.f.email'),type:'email',placeholder:'colleague@company.com',attrs:'autocomplete="off"'})}${ui.field({id:'role',label:t('onb.tm.role'),type:'select',value:'viewer',options:ONB_ROLES.map(r=>[r,t('onb.r.'+r)])})}<p class="small muted">${t('onb.tm.inviteD')}</p></form>`,
  ui.btn(t('c.cancel'),{act:'ovclose'})+`<button type="submit" form="onb-invf" class="btn primary">${icon('send','sm')}<span>${t('onb.tm.send')}</span></button>`);},
 onb_rmAsk(id){const m=(S.org.team||[]).find(x=>x.id===id);if(!m)return;modal(t('onb.tm.rmT'),`<p>${t('onb.tm.rmD',{email:`<b>${esc(m.email)}</b>`})}</p>`,ui.btn(t('c.cancel'),{act:'ovclose'})+ui.btn(t('onb.tm.remove'),{kind:'danger',act:'onb_rm',arg:id}));},
 onb_rm(id){const m=(S.org.team||[]).find(x=>x.id===id);S.org.team=(S.org.team||[]).filter(x=>x.id!==id);closeOverlay();if(m){log(t('onb.log.rm',{email:m.email}));toast(t('onb.t.removed',{email:esc(m.email)}));}rerender();},
 onb_reveal(k){S.ui.onb_reveal=S.ui.onb_reveal||{};S.ui.onb_reveal[k]=!S.ui.onb_reveal[k];rerender();},
 onb_regenAsk(){modal(t('onb.dv.regenT'),ui.note('warn',t('onb.dv.regenD')),ui.btn(t('c.cancel'),{act:'ovclose'})+ui.btn(t('onb.dv.regen'),{kind:'danger',act:'onb_regen'}));},
 onb_regen(){const d=onb_dev();d.pk='bc_live_pk_'+onb_rnd(24);d.sk='bc_live_sk_'+onb_rnd(32);S.ui.onb_reveal={};closeOverlay();log(t('onb.log.keys'));toast(t('onb.t.keys'));rerender();},
 onb_resetAsk(){modal(t('onb.ad.resetT'),ui.note('bad',t('onb.ad.resetD')),ui.btn(t('c.cancel'),{act:'ovclose'})+ui.btn(t('onb.ad.reset'),{kind:'danger',act:'onb_reset'}));},
 onb_reset(){const lang=S.lang;S=freshState();S.lang=lang;closeOverlay();save();go('signup');toast(t('onb.t.reset'));},
 orgmenu(){if(!S.org)return;onb_closeSide();const o=S.org;
  modal(t('onb.om.title'),`<div class="row g12">${orgMark(44)}<div class="grow"><b>${esc(o.name)}</b><div class="small muted">${onb_cty(o.country)} · ${esc(o.code||'')} · ${esc(onb_curs().join(' / '))}</div></div></div>
   <dl class="dl small"><dt>${t('onb.pf.prefix')}</dt><dd><span class="mono"><b>${esc(o.prefix)}</b></span> <button type="button" class="onb-link" data-act="copy" data-arg="${esc(o.prefix)}">${t('onb.pf.copy')}</button></dd><dt>${t('onb.om.since')}</dt><dd>${fmtDate(o.createdAt)}</dd></dl>
   <div class="col g4 onb-menu"><a href="#settings">${icon('gear','sm')}${t('onb.om.settings')}</a><a href="#settings--billing">${icon('card','sm')}${t('onb.s.billing')}</a><a href="#settings--team">${icon('users','sm')}${t('onb.s.team')}</a></div>`,
   ui.btn(t('onb.om.signout'),{kind:'ghost',icon:'logout',act:'onb_signout'}));},
 usermenu(){if(!S.user)return;
  modal(t('onb.um.title'),`<div class="row g12"><span class="onb-av lg" aria-hidden="true">${esc(S.user.email[0].toUpperCase())}</span><div class="grow"><b>${esc(S.user.name||S.user.email)}</b><div class="small muted">${esc(S.user.email)}</div></div>${ui.badge(t('onb.r.owner'),'accent')}</div>
   <div class="field"><span class="lbl">${t('c.language')}</span>${langBtn('inp')}<span class="hint">${t('onb.um.langD')}</span></div>`,
   ui.btn(t('onb.om.signout'),{kind:'ghost',icon:'logout',act:'onb_signout'})+ui.btn(t('c.close'),{kind:'primary',act:'ovclose'}));},
 onb_signout(){onb_signOut();toast(t('onb.t.signout'));},
});

/* ---------- strings ---------- */
I18N.add({
uk:{
'onb.nav.home':'Головна','onb.nav.settings':'Налаштування','onb.nav.account':'Акаунт',
'onb.terms':'Умови партнерства','onb.termsLink':'умовами партнерства','onb.r.eyebrow':'Для виробників і дистриб’юторів IoT','onb.r.title':'Додайте зв’язок до кожного пристрою — і заробляйте на ньому роками',
'onb.v1.t':'Дохід весь термін служби','onb.v1.d':'Ви отримуєте частку від зв’язку кожного проданого пристрою — не лише від продажу.',
'onb.v2.t':'Ваш бренд всюди','onb.v2.d':'На коробці, у порталі клієнта та в сповіщеннях — ваш логотип і ваші кольори.',
'onb.v3.t':'Без розробки й інтеграції','onb.v3.d':'Замовте SIM-карти, завантажте IMEI — і починайте продавати.',
'onb.su.title':'Створіть акаунт партнера','onb.su.sub':'Займе близько хвилини. Без картки й дзвінків.','onb.su.continue':'Продовжити','onb.su.or':'або','onb.su.demo':'Переглянути демо-компанію','onb.su.demoHint':'Відкриє консоль із прикладом даних: бренди, замовлення, SIM-карти й коди.','onb.su.resume':'Увійти знову',
'onb.f.email':'Робоча пошта','onb.f.company':'Назва компанії','onb.f.companyPh':'ТОВ «Ваша компанія»','onb.f.country':'Країна','onb.f.tax':'ЄДРПОУ / ІПН','onb.f.taxPh':'8 або 10 цифр','onb.f.currency':'Валюта рахунків','onb.f.currencyHint':'Можна змінити пізніше в налаштуваннях або для окремого замовлення.','onb.f.agree':'Я погоджуюся з {terms}','onb.f.address':'Юридична адреса','onb.f.addressPh':'Місто, вулиця, будинок','onb.f.addressHint':'Вказується в рахунках.','onb.f.phone':'Телефон',
'onb.vf.title':'Перевірте пошту','onb.vf.sub':'Ми надіслали 6-значний код на {email}.','onb.vf.label':'Код підтвердження','onb.vf.digit':'Цифра {n} з 6','onb.vf.demo':'Демо: введіть будь-які 6 цифр.','onb.vf.verify':'Підтвердити','onb.vf.noCode':'Не отримали код?','onb.vf.resend':'Надіслати ще раз','onb.vf.change':'Змінити пошту',
'onb.st.step':'Останній крок','onb.st.title':'Розкажіть про компанію','onb.st.sub':'Ці дані потрібні для рахунків. Решту можна додати пізніше.','onb.st.submit':'Створити акаунт',
'onb.cur.UAH':'Гривня з ПДВ','onb.cur.UAH.d':'Рахунки від української компанії.','onb.cur.USD':'Долари США без ПДВ','onb.cur.USD.d':'Міжнародний рахунок від OTA TECHNOLOGY DMCC.','onb.cur.short.UAH':'гривня з ПДВ','onb.cur.short.USD':'долари без ПДВ',
'onb.cty.UA':'Україна','onb.cty.PL':'Польща','onb.cty.KZ':'Казахстан','onb.cty.MD':'Молдова','onb.cty.GE':'Грузія','onb.cty.RO':'Румунія','onb.cty.DE':'Німеччина','onb.cty.XX':'Інша країна',
'onb.e.emailReq':'Вкажіть робочу пошту','onb.e.email':'Перевірте адресу — схоже, в ній помилка','onb.e.code':'Введіть усі 6 цифр коду','onb.e.company':'Вкажіть назву компанії (щонайменше 2 символи)','onb.e.tax':'Від 6 до 16 цифр або літер','onb.e.agree':'Щоб продовжити, погодьтеся з умовами','onb.e.phone':'Перевірте номер телефону','onb.e.url':'Адреса має починатися з https://','onb.e.dup':'Ця людина вже є в команді',
'onb.termsBody':'<p><b>[Умови партнерства — чернетка]</b></p><p>[Тут буде повний текст договору між партнером і CONNECT ДЛЯ БРЕНДІВ: предмет договору, порядок замовлення SIM-карт і пакетів, ціни та оплата, постачання, відповідальність сторін, обробка персональних даних, строк дії та розірвання.]</p><p>[Юридичні реквізити сторін наведено в рахунках.]</p>',
'onb.t.welcome':'Акаунт створено. Ласкаво просимо!','onb.t.back':'З поверненням! Ви увійшли в {name}','onb.t.resent':'Новий код надіслано на {email}','onb.t.ckHidden':'Чекліст приховано','onb.t.company':'Дані компанії збережено','onb.t.webhook':'Налаштування вебхука збережено','onb.t.invited':'Запрошення надіслано на {email}','onb.t.removed':'{email} видалено з команди','onb.t.cur':'Валюта рахунків: {c}','onb.t.keys':'Нові ключі створено, старі більше не діють','onb.t.reset':'Демо скинуто','onb.t.signout':'Ви вийшли з акаунта',
'onb.log.created':'Створено акаунт компанії «{name}»','onb.log.company':'Оновлено дані компанії','onb.log.invite':'Запрошено {email} до команди','onb.log.rm':'{email} видалено з команди','onb.log.cur':'Валюту рахунків змінено на {c}','onb.log.keys':'Перевипущено API-ключі',
'onb.h.title':'Головна','onb.h.hiName':'Вітаємо, {name}','onb.h.order':'Замовити SIM-карти',
'onb.ck.title':'Початок роботи','onb.ck.allDone':'Усе готово — можна продавати','onb.ck.allDoneD':'Бренд, моделі, SIM-карти, оплата й коди налаштовано. Цю картку можна приховати.','onb.ck.prog':'{x} з {n}','onb.ck.hide':'Приховати','onb.ck.doneB':'Готово',
'onb.ck.brand':'Створіть бренд','onb.ck.brand.d':'Ваш логотип і кольори з’являться в порталі клієнта та в сповіщеннях.','onb.ck.brand.b':'Створити бренд',
'onb.ck.model':'Додайте модель пристрою','onb.ck.model.d':'Ми призначимо їй пакет Light або Standard.','onb.ck.model.b':'Додати модель',
'onb.ck.imei':'Завантажте список IMEI','onb.ck.imei.d':'SIM-карта працює лише в пристроях із цього списку.','onb.ck.imei.b':'Завантажити IMEI',
'onb.ck.order':'Замовте SIM-карти','onb.ck.order.d':'Перше замовлення — від 1 000 карток, разом із пакетами.','onb.ck.order.b':'Замовити',
'onb.ck.pay':'Оплатіть рахунок','onb.ck.pay.d':'Після оплати запускаємо виробництво, а пакети стають доступні.','onb.ck.pay.b':'До рахунків',
'onb.ck.codes':'Видайте коди точкам продажу','onb.ck.codes.d':'Монтажники й магазини активують пакети для ваших клієнтів.','onb.ck.codes.b':'До кодів',
'onb.k.stock':'SIM-карти на складі','onb.k.stockS':'Готові до встановлення','onb.k.active':'Активні SIM-карти','onb.k.activeS':'Онлайн у пристроях','onb.k.act':'Активації цього місяця','onb.k.cred':'Доступні кредити','onb.k.credS':'Можна активувати зараз',
'onb.cr.title':'Кредити пакетів','onb.cr.buy':'Докупити','onb.cr.pkg':'Пакет','onb.cr.bought':'Куплено','onb.cr.used':'Використано','onb.cr.avail':'Доступно','onb.cr.usage':'Використання','onb.cr.low':'Закінчуються','onb.cr.empty':'Кредитів пакетів ще немає','onb.cr.emptyD':'Купіть пакети разом із SIM-картами — кожна активація використовує один пакет.',
'onb.all':'Усі','onb.or.title':'Замовлення в роботі','onb.or.order':'Замовлення','onb.or.next':'Наступний крок','onb.or.sims':'{n} SIM','onb.or.creditsOnly':'Лише пакети','onb.or.none':'Немає замовлень у роботі.',
'onb.os.awaiting_payment':'Очікує оплати','onb.os.paid':'Оплачено','onb.os.production':'Виробництво','onb.os.shipped':'Відправлено','onb.os.delivered':'Доставлено','onb.os.in_stock':'На складі',
'onb.nx.pay':'Оплатіть рахунок','onb.nx.prod':'Скоро почнемо виробництво','onb.nx.ship':'Готуємо до відправлення','onb.nx.deliver':'Очікуйте доставку','onb.nx.accept':'Прийміть на склад',
'onb.iv.title':'Рахунки до оплати','onb.iv.inv':'Рахунок','onb.iv.due':'Сплатити до','onb.iv.amount':'Сума','onb.iv.over':'Прострочено','onb.iv.none':'Усі рахунки оплачено.','onb.iv.empty':'Рахунків ще немає — вони з’являться після першого замовлення.','onb.cr.buy0':'Купити кредити','onb.f.optHint':'Необов’язково','onb.pf.more':'Таблиця символів пакетів — у розділі «Коди активації».',
'onb.ac.title':'Остання активність','onb.ac.none':'Тут з’являтимуться ваші дії та події.',
'onb.pf.title':'Ваш профіль кодів активації','onb.pf.prefix':'Префікс партнера','onb.pf.copy':'Копіювати','onb.pf.d':'Кожен ваш код активації починається з цього префікса — так система знає, що код ваш. 6-й символ означає пакет.','onb.pf.sample':'Приклад коду','onb.pf.digit':'Символ пакета (6-й символ коду):','onb.pf.d6':'Символ',
'onb.s.sub':'Компанія, оплата, команда та інтеграції.','onb.s.company':'Компанія','onb.s.billing':'Оплата','onb.s.team':'Команда','onb.s.dev':'Для розробників','onb.s.countryRo':'Країну не можна змінити після реєстрації — від неї залежить префікс кодів. Напишіть нам, якщо потрібно.',
'onb.b.cur':'Валюта рахунків','onb.b.curD':'Від валюти залежить, яка компанія виставляє рахунки і чи нараховується ПДВ.','onb.b.curNote':'Зміна діє для нових замовлень. Валюту можна обрати й для окремого замовлення.','onb.b.entity':'Хто виставляє рахунки','onb.b.seller':'Продавець','onb.b.reg':'Реєстрація','onb.b.addr':'Адреса','onb.b.bank':'Рахунок','onb.b.bankName':'Банк','onb.b.vat':'ПДВ','onb.b.vatYes':'Так, {p} включено в ціни','onb.b.vatNo':'Ні, міжнародний рахунок без ПДВ','onb.b.commit':'Річне зобов’язання','onb.b.sims':'SIM за 365 днів','onb.b.commitD':'За договором ви замовляєте щонайменше {n} SIM-карт на рік. Враховуються замовлення за останні 365 днів.',
'onb.ad.title':'Дані партнера','onb.ad.note':'Видно лише нашій команді в режимі OTA.','onb.ad.pid':'ID партнера','onb.ad.created':'Зареєстровано','onb.ad.reset':'Скинути демо','onb.ad.resetT':'Скинути демо?','onb.ad.resetD':'Усі дані — компанія, бренди, замовлення, SIM-карти й коди — буде видалено з цього браузера. Дію не можна скасувати.',
'onb.tm.member':'Учасник','onb.tm.role':'Роль','onb.tm.you':'ви','onb.tm.active':'Активний','onb.tm.pending':'Запрошено','onb.tm.invited':'Запрошено {d}','onb.tm.invite':'Запросити','onb.tm.inviteT':'Запросити до команди','onb.tm.inviteD':'Людина отримає лист із посиланням для входу.','onb.tm.send':'Надіслати запрошення','onb.tm.remove':'Видалити','onb.tm.rmT':'Видалити з команди?','onb.tm.rmD':'{email} втратить доступ до консолі.',
'onb.r.owner':'Власник','onb.r.admin':'Адміністратор','onb.r.finance':'Фінанси','onb.r.warehouse':'Склад','onb.r.viewer':'Перегляд',
'onb.r.admin.d':'усе, крім видалення акаунта','onb.r.finance.d':'замовлення, рахунки, ціни','onb.r.warehouse.d':'SIM-карти, приймання, коди','onb.r.viewer.d':'лише перегляд',
'onb.dv.preview':'Попередній перегляд','onb.dv.previewB':'Незабаром','onb.dv.previewD':'API та вебхуки ще в розробці. Ключі нижче не працюють — тут можна побачити, як це виглядатиме.','onb.dv.keys':'API-ключі','onb.dv.pk':'Публічний ключ','onb.dv.pkD':'Для віджетів на вашому сайті.','onb.dv.sk':'Секретний ключ','onb.dv.skD':'Лише для вашого сервера. Нікому не показуйте.','onb.dv.reveal':'Показати','onb.dv.hide':'Сховати','onb.dv.regen':'Перевипустити ключі','onb.dv.regenT':'Перевипустити ключі?','onb.dv.regenD':'Поточні ключі перестануть працювати одразу. Оновіть їх у своїх системах.',
'onb.dv.wh':'Вебхук','onb.dv.url':'URL-адреса','onb.dv.urlHint':'Надсилатимемо POST-запит з подією у форматі JSON.','onb.dv.events':'Події',
'onb.ev.sim_activated':'SIM-карта вийшла в мережу','onb.ev.sim_blocked':'SIM-карту заблоковано (IMEI не в списку)','onb.ev.order_shipped':'Замовлення відправлено','onb.ev.invoice_paid':'Рахунок оплачено',
'onb.om.title':'Компанія','onb.om.since':'Партнер з','onb.om.settings':'Налаштування компанії','onb.om.signout':'Вийти','onb.um.title':'Ваш профіль','onb.um.langD':'Мова інтерфейсу для цього браузера.'},
en:{
'onb.nav.home':'Home','onb.nav.settings':'Settings','onb.nav.account':'Account',
'onb.terms':'Partner terms','onb.termsLink':'Partner terms','onb.r.eyebrow':'For IoT manufacturers and distributors','onb.r.title':'Connect every device you sell — and earn from it for years',
'onb.v1.t':'Lifetime revenue','onb.v1.d':'You earn a share of every device’s connectivity, not just the one-off sale.',
'onb.v2.t':'Your brand everywhere','onb.v2.d':'On the box, in the customer portal and in alerts — your logo, your colours.',
'onb.v3.t':'No development or integration','onb.v3.d':'Order SIM cards, upload IMEIs and start selling.',
'onb.su.title':'Create your partner account','onb.su.sub':'Takes about a minute. No card, no sales call.','onb.su.continue':'Continue','onb.su.or':'or','onb.su.demo':'Explore a demo company','onb.su.demoHint':'Opens the console with sample brands, orders, SIM cards and codes.','onb.su.resume':'Sign back in',
'onb.f.email':'Work email','onb.f.company':'Company name','onb.f.companyPh':'Your Company Ltd','onb.f.country':'Country','onb.f.tax':'Company / tax number','onb.f.taxPh':'Company or VAT number','onb.f.currency':'Billing currency','onb.f.currencyHint':'You can change this later in settings or per order.','onb.f.agree':'I agree to the {terms}','onb.f.address':'Legal address','onb.f.addressPh':'City, street, building','onb.f.addressHint':'Shown on invoices.','onb.f.phone':'Phone',
'onb.vf.title':'Check your email','onb.vf.sub':'We sent a 6-digit code to {email}.','onb.vf.label':'Verification code','onb.vf.digit':'Digit {n} of 6','onb.vf.demo':'Demo: enter any 6 digits.','onb.vf.verify':'Verify','onb.vf.noCode':'Didn’t get it?','onb.vf.resend':'Resend code','onb.vf.change':'Change email',
'onb.st.step':'Last step','onb.st.title':'Tell us about your company','onb.st.sub':'We need this for invoices. Everything else can wait.','onb.st.submit':'Create account',
'onb.cur.UAH':'Hryvnia incl. VAT','onb.cur.UAH.d':'Invoices from the Ukrainian company.','onb.cur.USD':'US dollars, no VAT','onb.cur.USD.d':'International invoice from OTA TECHNOLOGY DMCC.','onb.cur.short.UAH':'UAH incl. VAT','onb.cur.short.USD':'USD, no VAT',
'onb.cty.UA':'Ukraine','onb.cty.PL':'Poland','onb.cty.KZ':'Kazakhstan','onb.cty.MD':'Moldova','onb.cty.GE':'Georgia','onb.cty.RO':'Romania','onb.cty.DE':'Germany','onb.cty.XX':'Other',
'onb.e.emailReq':'Enter your work email','onb.e.email':'That email doesn’t look right','onb.e.code':'Enter all 6 digits','onb.e.company':'Enter your company name (at least 2 characters)','onb.e.tax':'6 to 16 digits or letters','onb.e.agree':'Please accept the terms to continue','onb.e.phone':'Check the phone number','onb.e.url':'The URL must start with https://','onb.e.dup':'This person is already on the team',
'onb.termsBody':'<p><b>[Partner terms — draft]</b></p><p>[The full agreement between the partner and CONNECT FOR BRANDS goes here: scope, ordering SIM cards and packages, prices and payment, delivery, liability, personal data processing, term and termination.]</p><p>[Legal details of the parties are shown on invoices.]</p>',
'onb.t.welcome':'Account created. Welcome aboard!','onb.t.back':'Welcome back! You’re signed in to {name}','onb.t.resent':'New code sent to {email}','onb.t.ckHidden':'Checklist hidden','onb.t.company':'Company details saved','onb.t.webhook':'Webhook settings saved','onb.t.invited':'Invitation sent to {email}','onb.t.removed':'{email} removed from the team','onb.t.cur':'Billing currency: {c}','onb.t.keys':'New keys created; the old ones no longer work','onb.t.reset':'Demo reset','onb.t.signout':'You’re signed out',
'onb.log.created':'Account created for {name}','onb.log.company':'Company details updated','onb.log.invite':'Invited {email} to the team','onb.log.rm':'Removed {email} from the team','onb.log.cur':'Billing currency changed to {c}','onb.log.keys':'API keys regenerated',
'onb.h.title':'Home','onb.h.hiName':'Welcome, {name}','onb.h.order':'Order SIM cards',
'onb.ck.title':'Get started','onb.ck.allDone':'You’re all set — start selling','onb.ck.allDoneD':'Brand, models, SIM cards, payment and codes are all set up. You can dismiss this card.','onb.ck.prog':'{x} of {n}','onb.ck.hide':'Dismiss','onb.ck.doneB':'Done',
'onb.ck.brand':'Create a brand','onb.ck.brand.d':'Your logo and colours appear in the customer portal and alerts.','onb.ck.brand.b':'Create brand',
'onb.ck.model':'Add a device model','onb.ck.model.d':'We’ll assign it a Light or Standard package.','onb.ck.model.b':'Add model',
'onb.ck.imei':'Upload the IMEI whitelist','onb.ck.imei.d':'A SIM only goes online in devices on this list.','onb.ck.imei.b':'Upload IMEIs',
'onb.ck.order':'Order SIM cards','onb.ck.order.d':'Your first order starts at 1,000 cards, plus packages.','onb.ck.order.b':'Order',
'onb.ck.pay':'Pay the invoice','onb.ck.pay.d':'Once paid, production starts and packages become available.','onb.ck.pay.b':'View invoices',
'onb.ck.codes':'Hand out codes to points of sale','onb.ck.codes.d':'Installers and shops activate packages for your customers.','onb.ck.codes.b':'View codes',
'onb.k.stock':'SIMs in warehouse','onb.k.stockS':'Ready to install','onb.k.active':'Active SIMs','onb.k.activeS':'Online in devices','onb.k.act':'Activations this month','onb.k.cred':'Credits available','onb.k.credS':'Ready to activate',
'onb.cr.title':'Package credits','onb.cr.buy':'Buy more','onb.cr.pkg':'Package','onb.cr.bought':'Bought','onb.cr.used':'Used','onb.cr.avail':'Available','onb.cr.usage':'Usage','onb.cr.low':'Running low','onb.cr.empty':'No package credits yet','onb.cr.emptyD':'Buy credits with your SIM order — each activation uses one credit.',
'onb.all':'View all','onb.or.title':'Orders in progress','onb.or.order':'Order','onb.or.next':'Next step','onb.or.sims':'{n} SIMs','onb.or.creditsOnly':'Credits only','onb.or.none':'No orders in progress.',
'onb.os.awaiting_payment':'Awaiting payment','onb.os.paid':'Paid','onb.os.production':'In production','onb.os.shipped':'Shipped','onb.os.delivered':'Delivered','onb.os.in_stock':'In stock',
'onb.nx.pay':'Pay the invoice','onb.nx.prod':'Production starts soon','onb.nx.ship':'Preparing for shipment','onb.nx.deliver':'Delivery on the way','onb.nx.accept':'Accept into warehouse',
'onb.iv.title':'Invoices to pay','onb.iv.inv':'Invoice','onb.iv.due':'Due','onb.iv.amount':'Amount','onb.iv.over':'Overdue','onb.iv.none':'All invoices are paid.','onb.iv.empty':'No invoices yet — they appear after your first order.','onb.cr.buy0':'Buy credits','onb.f.optHint':'Optional','onb.pf.more':'The package symbol table is on the Activation codes page.',
'onb.ac.title':'Recent activity','onb.ac.none':'Your actions and events will show up here.',
'onb.pf.title':'Your activation code profile','onb.pf.prefix':'Partner prefix','onb.pf.copy':'Copy','onb.pf.d':'Every activation code you generate starts with this prefix — that’s how the system knows it’s yours. The 6th character is the package.','onb.pf.sample':'Sample code','onb.pf.digit':'Package character (6th character of the code):','onb.pf.d6':'Char',
'onb.s.sub':'Company, billing, team and integrations.','onb.s.company':'Company','onb.s.billing':'Billing','onb.s.team':'Team','onb.s.dev':'Developers','onb.s.countryRo':'Country can’t be changed after signup — your code prefix depends on it. Contact us if you need to.',
'onb.b.cur':'Billing currency','onb.b.curD':'The currency decides which company invoices you and whether VAT applies.','onb.b.curNote':'Applies to new orders. You can also pick a currency per order.','onb.b.entity':'Who invoices you','onb.b.seller':'Seller','onb.b.reg':'Registration','onb.b.addr':'Address','onb.b.bank':'Account','onb.b.bankName':'Bank','onb.b.vat':'VAT','onb.b.vatYes':'Yes, {p} included in prices','onb.b.vatNo':'No, international invoice without VAT','onb.b.commit':'Annual commitment','onb.b.sims':'SIMs in 365 days','onb.b.commitD':'Your agreement includes at least {n} SIM cards a year. Orders from the last 365 days count.',
'onb.ad.title':'Partner record','onb.ad.note':'Visible only to our team in OTA mode.','onb.ad.pid':'Partner ID','onb.ad.created':'Signed up','onb.ad.reset':'Reset demo','onb.ad.resetT':'Reset the demo?','onb.ad.resetD':'All data — company, brands, orders, SIM cards and codes — will be erased from this browser. This can’t be undone.',
'onb.tm.member':'Member','onb.tm.role':'Role','onb.tm.you':'you','onb.tm.active':'Active','onb.tm.pending':'Invited','onb.tm.invited':'Invited {d}','onb.tm.invite':'Invite','onb.tm.inviteT':'Invite a teammate','onb.tm.inviteD':'They’ll get an email with a sign-in link.','onb.tm.send':'Send invitation','onb.tm.remove':'Remove','onb.tm.rmT':'Remove from team?','onb.tm.rmD':'{email} will lose access to the console.',
'onb.r.owner':'Owner','onb.r.admin':'Admin','onb.r.finance':'Finance','onb.r.warehouse':'Warehouse','onb.r.viewer':'Viewer',
'onb.r.admin.d':'everything except deleting the account','onb.r.finance.d':'orders, invoices, prices','onb.r.warehouse.d':'SIM cards, receiving, codes','onb.r.viewer.d':'read-only',
'onb.dv.preview':'Preview','onb.dv.previewB':'Coming soon','onb.dv.previewD':'The API and webhooks are in development. These keys don’t work yet — this shows how it will look.','onb.dv.keys':'API keys','onb.dv.pk':'Publishable key','onb.dv.pkD':'For widgets on your website.','onb.dv.sk':'Secret key','onb.dv.skD':'Server-side only. Never share it.','onb.dv.reveal':'Reveal','onb.dv.hide':'Hide','onb.dv.regen':'Regenerate keys','onb.dv.regenT':'Regenerate keys?','onb.dv.regenD':'Your current keys stop working immediately. Update them in your systems.',
'onb.dv.wh':'Webhook','onb.dv.url':'Endpoint URL','onb.dv.urlHint':'We’ll send a POST request with the event as JSON.','onb.dv.events':'Events',
'onb.ev.sim_activated':'A SIM came online','onb.ev.sim_blocked':'A SIM was blocked (IMEI not whitelisted)','onb.ev.order_shipped':'An order shipped','onb.ev.invoice_paid':'An invoice was paid',
'onb.om.title':'Company','onb.om.since':'Partner since','onb.om.settings':'Company settings','onb.om.signout':'Sign out','onb.um.title':'Your profile','onb.um.langD':'Interface language for this browser.'},
ru:{
'onb.nav.home':'Главная','onb.nav.settings':'Настройки','onb.nav.account':'Аккаунт',
'onb.terms':'Условия партнёрства','onb.termsLink':'условиями партнёрства','onb.r.eyebrow':'Для производителей и дистрибьюторов IoT','onb.r.title':'Добавьте связь в каждое устройство — и зарабатывайте на нём годами',
'onb.v1.t':'Доход весь срок службы','onb.v1.d':'Вы получаете долю от связи каждого проданного устройства, а не только от продажи.',
'onb.v2.t':'Ваш бренд везде','onb.v2.d':'На коробке, в портале клиента и в уведомлениях — ваш логотип и ваши цвета.',
'onb.v3.t':'Без разработки и интеграции','onb.v3.d':'Закажите SIM-карты, загрузите IMEI — и начинайте продавать.',
'onb.su.title':'Создайте аккаунт партнёра','onb.su.sub':'Займёт около минуты. Без карты и звонков.','onb.su.continue':'Продолжить','onb.su.or':'или','onb.su.demo':'Посмотреть демо-компанию','onb.su.demoHint':'Откроет консоль с примером данных: бренды, заказы, SIM-карты и коды.','onb.su.resume':'Войти снова',
'onb.f.email':'Рабочая почта','onb.f.company':'Название компании','onb.f.companyPh':'ООО «Ваша компания»','onb.f.country':'Страна','onb.f.tax':'ЕГРПОУ / ИНН','onb.f.taxPh':'8 или 10 цифр','onb.f.currency':'Валюта счетов','onb.f.currencyHint':'Можно изменить позже в настройках или для отдельного заказа.','onb.f.agree':'Я соглашаюсь с {terms}','onb.f.address':'Юридический адрес','onb.f.addressPh':'Город, улица, дом','onb.f.addressHint':'Указывается в счетах.','onb.f.phone':'Телефон',
'onb.vf.title':'Проверьте почту','onb.vf.sub':'Мы отправили 6-значный код на {email}.','onb.vf.label':'Код подтверждения','onb.vf.digit':'Цифра {n} из 6','onb.vf.demo':'Демо: введите любые 6 цифр.','onb.vf.verify':'Подтвердить','onb.vf.noCode':'Не получили код?','onb.vf.resend':'Отправить ещё раз','onb.vf.change':'Изменить почту',
'onb.st.step':'Последний шаг','onb.st.title':'Расскажите о компании','onb.st.sub':'Эти данные нужны для счетов. Остальное можно добавить позже.','onb.st.submit':'Создать аккаунт',
'onb.cur.UAH':'Гривна с НДС','onb.cur.UAH.d':'Счета от украинской компании.','onb.cur.USD':'Доллары США без НДС','onb.cur.USD.d':'Международный счёт от OTA TECHNOLOGY DMCC.','onb.cur.short.UAH':'гривна с НДС','onb.cur.short.USD':'доллары без НДС',
'onb.cty.UA':'Украина','onb.cty.PL':'Польша','onb.cty.KZ':'Казахстан','onb.cty.MD':'Молдова','onb.cty.GE':'Грузия','onb.cty.RO':'Румыния','onb.cty.DE':'Германия','onb.cty.XX':'Другая страна',
'onb.e.emailReq':'Укажите рабочую почту','onb.e.email':'Проверьте адрес — похоже, в нём ошибка','onb.e.code':'Введите все 6 цифр кода','onb.e.company':'Укажите название компании (минимум 2 символа)','onb.e.tax':'От 6 до 16 цифр или букв','onb.e.agree':'Чтобы продолжить, примите условия','onb.e.phone':'Проверьте номер телефона','onb.e.url':'Адрес должен начинаться с https://','onb.e.dup':'Этот человек уже в команде',
'onb.termsBody':'<p><b>[Условия партнёрства — черновик]</b></p><p>[Здесь будет полный текст договора между партнёром и CONNECT FOR BRANDS: предмет договора, порядок заказа SIM-карт и пакетов, цены и оплата, поставка, ответственность сторон, обработка персональных данных, срок действия и расторжение.]</p><p>[Юридические реквизиты сторон указаны в счетах.]</p>',
'onb.t.welcome':'Аккаунт создан. Добро пожаловать!','onb.t.back':'С возвращением! Вы вошли в {name}','onb.t.resent':'Новый код отправлен на {email}','onb.t.ckHidden':'Чек-лист скрыт','onb.t.company':'Данные компании сохранены','onb.t.webhook':'Настройки вебхука сохранены','onb.t.invited':'Приглашение отправлено на {email}','onb.t.removed':'{email} удалён из команды','onb.t.cur':'Валюта счетов: {c}','onb.t.keys':'Новые ключи созданы, старые больше не действуют','onb.t.reset':'Демо сброшено','onb.t.signout':'Вы вышли из аккаунта',
'onb.log.created':'Создан аккаунт компании «{name}»','onb.log.company':'Обновлены данные компании','onb.log.invite':'{email} приглашён в команду','onb.log.rm':'{email} удалён из команды','onb.log.cur':'Валюта счетов изменена на {c}','onb.log.keys':'API-ключи перевыпущены',
'onb.h.title':'Главная','onb.h.hiName':'Здравствуйте, {name}','onb.h.order':'Заказать SIM-карты',
'onb.ck.title':'Начало работы','onb.ck.allDone':'Всё готово — можно продавать','onb.ck.allDoneD':'Бренд, модели, SIM-карты, оплата и коды настроены. Эту карточку можно скрыть.','onb.ck.prog':'{x} из {n}','onb.ck.hide':'Скрыть','onb.ck.doneB':'Готово',
'onb.ck.brand':'Создайте бренд','onb.ck.brand.d':'Ваш логотип и цвета появятся в портале клиента и в уведомлениях.','onb.ck.brand.b':'Создать бренд',
'onb.ck.model':'Добавьте модель устройства','onb.ck.model.d':'Мы назначим ей пакет Light или Standard.','onb.ck.model.b':'Добавить модель',
'onb.ck.imei':'Загрузите список IMEI','onb.ck.imei.d':'SIM-карта работает только в устройствах из этого списка.','onb.ck.imei.b':'Загрузить IMEI',
'onb.ck.order':'Закажите SIM-карты','onb.ck.order.d':'Первый заказ — от 1 000 карт, вместе с пакетами.','onb.ck.order.b':'Заказать',
'onb.ck.pay':'Оплатите счёт','onb.ck.pay.d':'После оплаты запускаем производство, а пакеты становятся доступны.','onb.ck.pay.b':'К счетам',
'onb.ck.codes':'Выдайте коды точкам продаж','onb.ck.codes.d':'Монтажники и магазины активируют пакеты для ваших клиентов.','onb.ck.codes.b':'К кодам',
'onb.k.stock':'SIM-карты на складе','onb.k.stockS':'Готовы к установке','onb.k.active':'Активные SIM-карты','onb.k.activeS':'Онлайн в устройствах','onb.k.act':'Активации в этом месяце','onb.k.cred':'Доступные кредиты','onb.k.credS':'Можно активировать сейчас',
'onb.cr.title':'Кредиты пакетов','onb.cr.buy':'Докупить','onb.cr.pkg':'Пакет','onb.cr.bought':'Куплено','onb.cr.used':'Использовано','onb.cr.avail':'Доступно','onb.cr.usage':'Использование','onb.cr.low':'Заканчиваются','onb.cr.empty':'Кредитов пакетов пока нет','onb.cr.emptyD':'Купите пакеты вместе с SIM-картами — каждая активация использует один пакет.',
'onb.all':'Все','onb.or.title':'Заказы в работе','onb.or.order':'Заказ','onb.or.next':'Следующий шаг','onb.or.sims':'{n} SIM','onb.or.creditsOnly':'Только пакеты','onb.or.none':'Нет заказов в работе.',
'onb.os.awaiting_payment':'Ожидает оплаты','onb.os.paid':'Оплачен','onb.os.production':'Производство','onb.os.shipped':'Отправлен','onb.os.delivered':'Доставлен','onb.os.in_stock':'На складе',
'onb.nx.pay':'Оплатите счёт','onb.nx.prod':'Скоро начнём производство','onb.nx.ship':'Готовим к отправке','onb.nx.deliver':'Ожидайте доставку','onb.nx.accept':'Примите на склад',
'onb.iv.title':'Счета к оплате','onb.iv.inv':'Счёт','onb.iv.due':'Оплатить до','onb.iv.amount':'Сумма','onb.iv.over':'Просрочен','onb.iv.none':'Все счета оплачены.','onb.iv.empty':'Счетов пока нет — они появятся после первого заказа.','onb.cr.buy0':'Купить кредиты','onb.f.optHint':'Необязательно','onb.pf.more':'Таблица символов пакетов — в разделе «Коды активации».',
'onb.ac.title':'Последняя активность','onb.ac.none':'Здесь будут появляться ваши действия и события.',
'onb.pf.title':'Ваш профиль кодов активации','onb.pf.prefix':'Префикс партнёра','onb.pf.copy':'Копировать','onb.pf.d':'Каждый ваш код активации начинается с этого префикса — так система понимает, что код ваш. 6-й символ обозначает пакет.','onb.pf.sample':'Пример кода','onb.pf.digit':'Символ пакета (6-й символ кода):','onb.pf.d6':'Символ',
'onb.s.sub':'Компания, оплата, команда и интеграции.','onb.s.company':'Компания','onb.s.billing':'Оплата','onb.s.team':'Команда','onb.s.dev':'Для разработчиков','onb.s.countryRo':'Страну нельзя изменить после регистрации — от неё зависит префикс кодов. Напишите нам, если нужно.',
'onb.b.cur':'Валюта счетов','onb.b.curD':'От валюты зависит, какая компания выставляет счета и начисляется ли НДС.','onb.b.curNote':'Изменение действует для новых заказов. Валюту можно выбрать и для отдельного заказа.','onb.b.entity':'Кто выставляет счета','onb.b.seller':'Продавец','onb.b.reg':'Регистрация','onb.b.addr':'Адрес','onb.b.bank':'Счёт','onb.b.bankName':'Банк','onb.b.vat':'НДС','onb.b.vatYes':'Да, {p} включён в цены','onb.b.vatNo':'Нет, международный счёт без НДС','onb.b.commit':'Годовое обязательство','onb.b.sims':'SIM за 365 дней','onb.b.commitD':'По договору вы заказываете не менее {n} SIM-карт в год. Учитываются заказы за последние 365 дней.',
'onb.ad.title':'Данные партнёра','onb.ad.note':'Видно только нашей команде в режиме OTA.','onb.ad.pid':'ID партнёра','onb.ad.created':'Зарегистрирован','onb.ad.reset':'Сбросить демо','onb.ad.resetT':'Сбросить демо?','onb.ad.resetD':'Все данные — компания, бренды, заказы, SIM-карты и коды — будут удалены из этого браузера. Действие нельзя отменить.',
'onb.tm.member':'Участник','onb.tm.role':'Роль','onb.tm.you':'вы','onb.tm.active':'Активен','onb.tm.pending':'Приглашён','onb.tm.invited':'Приглашён {d}','onb.tm.invite':'Пригласить','onb.tm.inviteT':'Пригласить в команду','onb.tm.inviteD':'Человек получит письмо со ссылкой для входа.','onb.tm.send':'Отправить приглашение','onb.tm.remove':'Удалить','onb.tm.rmT':'Удалить из команды?','onb.tm.rmD':'{email} потеряет доступ к консоли.',
'onb.r.owner':'Владелец','onb.r.admin':'Администратор','onb.r.finance':'Финансы','onb.r.warehouse':'Склад','onb.r.viewer':'Просмотр',
'onb.r.admin.d':'всё, кроме удаления аккаунта','onb.r.finance.d':'заказы, счета, цены','onb.r.warehouse.d':'SIM-карты, приёмка, коды','onb.r.viewer.d':'только просмотр',
'onb.dv.preview':'Предварительный просмотр','onb.dv.previewB':'Скоро','onb.dv.previewD':'API и вебхуки ещё в разработке. Ключи ниже не работают — здесь видно, как это будет выглядеть.','onb.dv.keys':'API-ключи','onb.dv.pk':'Публичный ключ','onb.dv.pkD':'Для виджетов на вашем сайте.','onb.dv.sk':'Секретный ключ','onb.dv.skD':'Только для вашего сервера. Никому не показывайте.','onb.dv.reveal':'Показать','onb.dv.hide':'Скрыть','onb.dv.regen':'Перевыпустить ключи','onb.dv.regenT':'Перевыпустить ключи?','onb.dv.regenD':'Текущие ключи перестанут работать сразу. Обновите их в своих системах.',
'onb.dv.wh':'Вебхук','onb.dv.url':'URL-адрес','onb.dv.urlHint':'Будем отправлять POST-запрос с событием в формате JSON.','onb.dv.events':'События',
'onb.ev.sim_activated':'SIM-карта вышла в сеть','onb.ev.sim_blocked':'SIM-карта заблокирована (IMEI не в списке)','onb.ev.order_shipped':'Заказ отправлен','onb.ev.invoice_paid':'Счёт оплачен',
'onb.om.title':'Компания','onb.om.since':'Партнёр с','onb.om.settings':'Настройки компании','onb.om.signout':'Выйти','onb.um.title':'Ваш профиль','onb.um.langD':'Язык интерфейса для этого браузера.'}});

/* partner logo (shown top-left of the console — it is the partner's own portal) */
document.addEventListener('change',e=>{if(!e.target||e.target.id!=='onb_logo')return;const f=e.target.files&&e.target.files[0];const h=$('#onb_logo-h');if(!f)return;
 if(f.size>300*1024){if(h){h.className='xs err';h.textContent=t('onb.logo.big');}return;}
 const r=new FileReader();r.onload=()=>{S.org.logo=r.result;log(t('onb.logo.log'));toast(t('onb.logo.done'));rerender();};r.readAsDataURL(f);});
ACT.onb_logoRm=()=>{delete S.org.logo;toast(t('onb.logo.removed'));rerender();};
I18N.add({uk:{'onb.logo.t':'Логотип компанії','onb.logo.d':'Показується зліва вгорі консолі. PNG, SVG або JPG до 300 КБ.','onb.logo.up':'Завантажити','onb.logo.rm':'Прибрати','onb.logo.big':'Файл більший за 300 КБ — стисніть його.','onb.logo.log':'Оновлено логотип компанії','onb.logo.done':'Логотип оновлено','onb.logo.removed':'Логотип прибрано'},
en:{'onb.logo.t':'Company logo','onb.logo.d':'Shown at the top left of the console. PNG, SVG or JPG up to 300 KB.','onb.logo.up':'Upload','onb.logo.rm':'Remove','onb.logo.big':'The file is over 300 KB — please compress it.','onb.logo.log':'Company logo updated','onb.logo.done':'Logo updated','onb.logo.removed':'Logo removed'},
ru:{'onb.logo.t':'Логотип компании','onb.logo.d':'Показывается слева вверху консоли. PNG, SVG или JPG до 300 КБ.','onb.logo.up':'Загрузить','onb.logo.rm':'Убрать','onb.logo.big':'Файл больше 300 КБ — сожмите его.','onb.logo.log':'Обновлён логотип компании','onb.logo.done':'Логотип обновлён','onb.logo.removed':'Логотип убран'}});

/* ---------- v09 strings (USD billing by OTA, keys & tokens, SIM in custody, partner code) ---------- */
(function(){const R=[
['f.ccs','Країни, де ви продаватимете','Countries where you’ll sell','Страны, где вы будете продавать'],['f.ccsH','Для кожної країни буде окремий Заказ і прайс-лист.','Each country gets its own Order Form and price list.','Для каждой страны будет отдельный Заказ и прайс-лист.'],['e.ccs','Виберіть хоча б одну країну','Choose at least one country','Выберите хотя бы одну страну'],
['f.lang2','Друга мова документів','Second document language','Второй язык документов'],['f.lang2H','Перша мова — завжди англійська.','The first language is always English.','Первый язык — всегда английский.'],
['f.code','Код партнера (пропозиція)','Partner code (proposed)','Код партнёра (предложение)'],['f.codeH','3 латинські літери в номерах документів. Остаточно затверджує OTA.','3 Latin letters used in document numbers. OTA gives final approval.','3 латинские буквы в номерах документов. Окончательно утверждает OTA.'],
['f.billingNote','Рахунки виставляє OTA TECHNOLOGY DMCC (Дубай) у доларах США, а за схваленими країнами в Європі — у євро. Ставка ПДВ залежить від податкового статусу нижче.','Invoices are issued by OTA TECHNOLOGY DMCC (Dubai) in US dollars, and in euro for Approved Countries in Europe. The VAT rate depends on the tax status below.','Счета выставляет OTA TECHNOLOGY DMCC (Дубай) в долларах США, а по Одобренным странам в Европе — в евро. Ставка НДС зависит от налогового статуса ниже.'],
['f.countryInc','Країна реєстрації компанії','Country of incorporation','Страна регистрации компании'],['f.taxCountry','Країна податкового резидентства','Tax residence','Страна налогового резидентства'],['f.taxCountryH','Країна, де компанія є податковим резидентом.','The country where the company is tax resident.','Страна, где компания является налоговым резидентом.'],
['f.vatRegs','Реєстрації платником ПДВ','VAT registrations','Регистрации плательщиком НДС'],['f.vatNone','Немає реєстрацій платником ПДВ','No VAT registration','Нет регистраций плательщиком НДС'],['f.vatRegsH','Позначте всі країни, де компанія зареєстрована платником ПДВ.','Tick every country where the company is VAT-registered.','Отметьте все страны, где компания зарегистрирована плательщиком НДС.'],
['f.uaeFe','Постійне представництво в ОАЕ','Fixed establishment in the UAE','Постоянное представительство в ОАЭ'],['f.uaeFeH','Офіс, філія або інше постійне місце діяльності в ОАЕ.','An office, branch or other fixed place of business in the UAE.','Офис, филиал или иное постоянное место деятельности в ОАЭ.'],
['yn.yes','Так','Yes','Да'],['yn.no','Ні','No','Нет'],['e.vatRegs','Позначте країни реєстрації платником ПДВ або «Немає реєстрацій»','Tick the VAT registration countries or “No VAT registration”','Отметьте страны регистрации по НДС или «Нет регистраций»'],['e.uaeFe','Вкажіть, чи є постійне представництво в ОАЕ','Say whether there is a fixed establishment in the UAE','Укажите, есть ли постоянное представительство в ОАЭ'],
['f.country','Країна реєстрації компанії','Country of incorporation','Страна регистрации компании'],['f.regno','Реєстраційний номер компанії','Company registration no.','Регистрационный номер компании'],['f.regnoPh','напр. 00012345','e.g. 00012345','напр. 00012345'],
['h.order','Нове замовлення','New order','Новый заказ'],
['ck.legalForm','Заповніть анкету партнера','Fill in the partner questionnaire','Заполните анкету партнёра'],['ck.legalForm.d','Реквізити, підписант, бренд, країни й друга мова документів — з них портал збере пакет документів.','Company details, signatory, brand, countries and second language — the portal builds the document package from them.','Реквизиты, подписант, бренд, страны и второй язык документов — из них портал соберёт пакет документов.'],['ck.legalForm.b','До анкети','To questionnaire','К анкете'],
['ck.legalSign','Підпишіть пакет документів','Sign the document package','Подпишите пакет документов'],['ck.legalSign.d','Рамкова угода й Заказ по кожній країні; без них замовлення ключів і токенів заблоковані.','Master Agreement and an Order Form per country; key and token orders are blocked until they are signed.','Рамочное соглашение и Заказ по каждой стране; без них заказы ключей и токенов заблокированы.'],['ck.legalSign.b','До підписання','To signing','К подписанию'],
['ck.model.d','OTA призначить їй тариф Light, Standard або Premium.','OTA will assign it a Light, Standard or Premium plan.','OTA назначит ей тариф Light, Standard или Premium.'],
['ck.order','Замовте ключі й токени','Order keys & tokens','Закажите ключи и токены'],['ck.order.d','Ключ активації — один на пристрій; токени — пакети зв’язку. Перше замовлення — від 1 000 ключів.','An Activation Key per device; tokens are connectivity packages. First order: at least 1,000 keys.','Ключ активации — один на устройство; токены — пакеты связи. Первый заказ — от 1 000 ключей.'],['ck.order.b','Замовити','Order','Заказать'],
['ck.pay.d','Ключі й токени видаються автоматично після оплати.','Keys and tokens are issued automatically after payment.','Ключи и токены выдаются автоматически после оплаты.'],
['ck.ship','Прийміть SIM-карти на зберігання','Receive SIM cards into custody','Примите SIM-карты на хранение'],['ck.ship.d','OTA безкоштовно надсилає SIM-карти; підтвердьте отримання й стан.','OTA ships SIM cards free of charge; confirm receipt and condition.','OTA бесплатно отправляет SIM-карты; подтвердите получение и состояние.'],['ck.ship.b','До відвантажень','To shipments','К отгрузкам'],
['k.stock','SIM на зберіганні','SIMs in custody','SIM на хранении'],['k.ccAvail','{c}: {n} токенів і {k} ключів на складі','{n} tokens and {k} keys on hand for {c}','{c}: {n} токенов и {k} ключей на складе'],['k.cred','Сервісні токени','Service Tokens','Сервисные токены'],['k.credS','і {k} ключів активації','and {k} Activation Keys','и {k} ключей активации'],
['cr.title','Токени й ключі','Tokens & keys','Токены и ключи'],['cr.keys','Ключі активації','Activation Keys','Ключи активации'],['cr.pkg','Що','Item','Что'],['cr.buy','Докупити','Buy more','Докупить'],['cr.buy0','Замовити','Order','Заказать'],
['cr.empty','Токенів і ключів ще немає','No tokens or keys yet','Токенов и ключей пока нет'],['cr.emptyD','Замовте ключі активації й сервісні токени — вони з’являться тут після оплати.','Order Activation Keys and Service Tokens — they show up here after payment.','Закажите ключи активации и сервисные токены — они появятся здесь после оплаты.'],
['or.title','У роботі','In progress','В работе'],['or.order','Документ','Document','Документ'],['or.sims','{n} SIM','{n} SIMs','{n} SIM'],['or.none','Нічого не очікує на вас.','Nothing is waiting for you.','Ничего не ждёт вас.'],
['nx.pay','Оплатіть рахунок','Pay the invoice','Оплатите счёт'],['nx.draft','Виставте рахунок','Issue the invoice','Выставьте счёт'],['nx.receive','Підтвердьте отримання','Confirm receipt','Подтвердите получение'],['nx.wait','Очікуйте доставку','Awaiting delivery','Ожидайте доставку'],
['b.cur','Партнерство','Partnership','Партнёрство'],['b.curD2','Рахунки OTA — у доларах США, за схваленими країнами в Європі — у євро (валюта Замовлення). Документи складаються англійською та другою мовою.','OTA invoices are in US dollars, and in euro for Approved Countries in Europe (the Order Form currency). Documents are in English and a second language.','Счета OTA — в долларах США, по Одобренным странам в Европе — в евро (валюта Заказа). Документы составляются на английском и втором языке.'],
['b.code','Код партнера','Partner code','Код партнёра'],['b.codeOk','затверджено OTA','approved by OTA','утверждён OTA'],['b.codeProp','на погодженні','pending approval','на согласовании'],['b.ccs','Країни','Countries','Страны'],['b.lang2','Друга мова документів','Second document language','Второй язык документов'],
['b.entity','Хто виставляє рахунки','Who invoices you','Кто выставляет счета'],['b.vat0','0% — експорт послуг (у кожному рахунку OTA)','0% — zero-rated export of services (on every OTA invoice)','0% — экспорт услуг (в каждом счёте OTA)'],
['b.commit','Річна ціль','Annual target','Годовая цель'],['b.sims','активованих пристроїв за 365 днів','devices activated in 365 days','активированных устройств за 365 дней'],['b.commitD','Ціль — {n} активованих пристроїв на рік. Це орієнтир, а не зобов’язання купити.','The target is {n} activated devices a year. It is a goal, not a purchase obligation.','Цель — {n} активированных устройств в год. Это ориентир, а не обязательство купить.'],
['ad.code','Код партнера (PPP)','Partner code (PPP)','Код партнёра (PPP)'],['ad.codeOk','Затверджено. Змінюйте лише до випуску документів.','Approved. Change only before documents are issued.','Утверждён. Меняйте только до выпуска документов.'],['ad.codeProp','Запропоновано порталом — перевірте й затвердьте.','Proposed by the portal — check and approve.','Предложен порталом — проверьте и утвердите.'],['ad.approve','Затвердити код','Approve code','Утвердить код'],
['e.code.format','Рівно 3 латинські літери','Exactly 3 Latin letters','Ровно 3 латинские буквы'],['e.code.reserved','OTA, INV і TST зарезервовані','OTA, INV and TST are reserved','OTA, INV и TST зарезервированы'],['e.code.taken','Цей код уже використовується іншим партнером','This code is already used by another partner','Этот код уже использует другой партнёр'],
['log.code','Код партнера затверджено: {c}','Partner code approved: {c}','Код партнёра утверждён: {c}'],['t.code','Код {c} затверджено','Code {c} approved','Код {c} утверждён'],
];const o={uk:{},en:{},ru:{}};R.forEach(([k,uk,en,ru])=>{o.uk['onb.'+k]=uk;o.en['onb.'+k]=en;o.ru['onb.'+k]=ru;});I18N.add(o);})();
