/* ===== CONNECT FOR BRANDS partner console — core =====
   Everything is global inside one IIFE (build wraps all src/*.js together).
   Modules register: I18N.add(), route(), nav(), ACT.x = fn, FORM.x = fn, HOOKS.*.
*/
'use strict';
const APP_KEY='cfb-partner-v3';
const FX=45.0564;            // UAH per USD (NBU, demo)
const VAT=0.20;              // Ukraine VAT (retail planning only — OTA invoices are USD, see invVat())
const NOW0=new Date(2026,10,1,10,0); // demo clock start: 1 Nov 2026 10:00

/* ---------- i18n ---------- */
// Language registry: code → [native name, locale, group]. Groups (picker order): main → eu → eur → asia.
// uk/en/ru are built into the page; every other language is loaded on demand from i18n/<code>.json
// (written by build.py / tools/publish.py from src/partner-console/i18n). Missing keys fall back to English.
const LANG_META={
 uk:['Українська','uk-UA','main'],ru:['Русский','ru-RU','main'],en:['English','en-GB','main'],kk:['Қазақ тілі','kk-KZ','main'],
 bg:['Български','bg-BG','eu'],cs:['Čeština','cs-CZ','eu'],da:['Dansk','da-DK','eu'],de:['Deutsch','de-DE','eu'],el:['Ελληνικά','el-GR','eu'],
 es:['Español','es-ES','eu'],et:['Eesti','et-EE','eu'],fi:['Suomi','fi-FI','eu'],fr:['Français','fr-FR','eu'],ga:['Gaeilge','ga-IE','eu'],
 hr:['Hrvatski','hr-HR','eu'],hu:['Magyar','hu-HU','eu'],it:['Italiano','it-IT','eu'],lt:['Lietuvių','lt-LT','eu'],lv:['Latviešu','lv-LV','eu'],
 mt:['Malti','mt-MT','eu'],nl:['Nederlands','nl-NL','eu'],pl:['Polski','pl-PL','eu'],pt:['Português','pt-PT','eu'],ro:['Română','ro-RO','eu'],
 sk:['Slovenčina','sk-SK','eu'],sl:['Slovenščina','sl-SI','eu'],sv:['Svenska','sv-SE','eu'],
 ca:['Català','ca-ES','eur'],is:['Íslenska','is-IS','eur'],nb:['Norsk bokmål','nb-NO','eur'],sq:['Shqip','sq-AL','eur'],bs:['Bosanski','bs-BA','eur'],
 mk:['Македонски','mk-MK','eur'],sr:['Српски','sr-RS','eur'],tr:['Türkçe','tr-TR','eur'],
 az:['Azərbaycanca','az-AZ','asia'],hy:['Հայերեն','hy-AM','asia'],ka:['ქართული','ka-GE','asia'],ky:['Кыргызча','ky-KG','asia'],
 tg:['Тоҷикӣ','tg-TJ','asia'],tk:['Türkmençe','tk-TM','asia'],uz:['O‘zbekcha','uz-UZ','asia']};
const LANG_GROUPS=['main','eu','eur','asia'];
const I18N_EMBED=['uk','en','ru'];
const I18N_VER='__I18N_VER__';const I18N_AVAIL=__I18N_AVAIL__; // replaced by build.py
const LANGS=Object.keys(LANG_META).filter(l=>I18N_EMBED.includes(l)||I18N_AVAIL.includes(l));
const LANG_NAMES={},LOCALES={};for(const l in LANG_META){LANG_NAMES[l]=LANG_META[l][0];LOCALES[l]=LANG_META[l][1];}
const I18N={d:{uk:{},en:{},ru:{}},add(o){for(const l in o){this.d[l]=Object.assign(this.d[l]||{},o[l]);}}};
const _langLoaded={};
function langReady(l){return I18N_EMBED.includes(l)||!!_langLoaded[l];}
function loadLang(l){if(langReady(l))return Promise.resolve(true);if(!LANGS.includes(l))return Promise.resolve(false);
 if(!_langLoaded['p_'+l])_langLoaded['p_'+l]=fetch('i18n/'+l+'.json?v='+I18N_VER).then(r=>{if(!r.ok)throw new Error(r.status);return r.json();})
  .then(d=>{I18N.add({[l]:d});_langLoaded[l]=true;return true;}).catch(e=>{delete _langLoaded['p_'+l];console.warn('i18n',l,e);return false;});
 return _langLoaded['p_'+l];}
function useLang(l){if(!LANGS.includes(l))return;if(langReady(l)){S.lang=l;rerender();return;}
 toast(t('c.lg.loading'));loadLang(l).then(ok=>{if(ok){S.lang=l;rerender();}else toast(t('c.lg.fail'),'bad');});}
// language picker: button + searchable, grouped dialog
const _foldQ=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
function langName(code,inLang){try{const n=new Intl.DisplayNames([LOCALES[inLang]||inLang],{type:'language'}).of(code);if(n&&n!==code)return n.charAt(0).toLocaleUpperCase(LOCALES[inLang])+n.slice(1);}catch(e){}return '';}
function langBtn(cls){return `<button class="langbtn ${cls||''}" type="button" data-act="langpick" aria-haspopup="dialog" aria-label="${esc(t('c.language'))}: ${esc(LANG_NAMES[S.lang])}">${icon('globe','sm')}<span class="grow" lang="${S.lang}">${esc(LANG_NAMES[S.lang])}</span><span class="lgc mono">${S.lang.toUpperCase()}</span></button>`;}
function langPicker(){
 const rows=g=>{let ls=LANGS.filter(l=>LANG_META[l][2]===g);if(g!=='main')ls.sort((a,b)=>LANG_NAMES[a].localeCompare(LANG_NAMES[b]));
  return ls.map(l=>{const loc=langName(l,S.lang);const q=_foldQ([LANG_NAMES[l],loc,langName(l,'en'),langName(l,'ru'),langName(l,'uk'),l,LOCALES[l]].join(' '));
   return `<button class="lgi" type="button" data-act="setlang" data-arg="${l}" data-q="${esc(q)}" ${S.lang===l?'aria-current="true"':''}><span class="lgn"><b lang="${l}">${esc(LANG_NAMES[l])}</b>${loc&&loc!==LANG_NAMES[l]?`<span class="xs muted">${esc(loc)}</span>`:''}</span><span class="lgc mono">${l.toUpperCase()}</span>${S.lang===l?icon('check','sm'):''}</button>`;}).join('');};
 const body=`<div class="lgpick"><input class="inp" id="lgq" type="search" autocomplete="off" placeholder="${esc(t('c.lg.search'))}" aria-label="${esc(t('c.lg.search'))}" aria-controls="lgl">
  <div class="lgl" id="lgl">${LANG_GROUPS.map(g=>{const n=LANGS.filter(l=>LANG_META[l][2]===g).length;return n?`<section class="lgg" aria-label="${esc(t('c.lg.g.'+g))}"><h3 class="lgh">${t('c.lg.g.'+g)}<span class="cnt">${n}</span></h3>${rows(g)}</section>`:'';}).join('')}
  <p class="lgnone muted small" hidden>${t('c.lg.none')}</p></div><p class="xs faint">${t('c.lg.count',{n:LANGS.length})}</p></div>`;
 modal(t('c.language'),body);}
document.addEventListener('input',e=>{if(e.target.id!=='lgq')return;const q=_foldQ(e.target.value.trim());let any=0;
 $$('#lgl .lgg').forEach(sec=>{let n=0;$$('.lgi',sec).forEach(b=>{const on=!q||b.dataset.q.includes(q);b.hidden=!on;if(on)n++;});sec.hidden=!n;any+=n;});
 const no=$('#lgl .lgnone');if(no)no.hidden=!!any;});
document.addEventListener('keydown',e=>{if(e.target.id==='lgq'&&e.key==='Enter'){const b=$$('#lgl .lgi').find(x=>!x.hidden);if(b){e.preventDefault();b.click();}}});
function t(k,v){const L=S.lang;let s=I18N.d[L]&&I18N.d[L][k];if(s==null)s=I18N.d.en[k];if(s==null)s=I18N.d.uk[k];if(s==null)s=k;
 if(v)for(const a in v)s=s.split('{'+a+'}').join(v[a]);return s;}
function plural(n,forms){ // forms: {one,few,many,other}
 let c='other';try{c=new Intl.PluralRules(LOCALES[S.lang]).select(n);}catch(e){}return forms[c]||forms.other;}

/* ---------- utils ---------- */
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=(sel,root)=>(root||document).querySelector(sel);
const $$=(sel,root)=>[...(root||document).querySelectorAll(sel)];
const pad=(n,w=2)=>String(n).padStart(w,'0');
let _uid=0;const uid=p=>(p||'id')+'_'+Date.now().toString(36)+(++_uid).toString(36);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const digits=s=>String(s||'').replace(/\D/g,'');
function now(){return new Date(NOW0.getTime()+(S.clock||0)*60000);}   // demo clock; ACT.tick advances
function tick(min){S.clock=(S.clock||0)+(min||1);}
const iso=d=>d.toISOString();
function fmtDate(x,opt){const d=typeof x==='string'?new Date(x):x;return d.toLocaleDateString(LOCALES[S.lang],opt||{day:'numeric',month:'short',year:'numeric'}).replace(/\s?р\.$/,'').replace(/\s?г\.$/,'');}
function fmtDateTime(x){const d=typeof x==='string'?new Date(x):x;return fmtDate(d)+', '+d.toLocaleTimeString(LOCALES[S.lang],{hour:'2-digit',minute:'2-digit'});}
function fmtNum(n,dec=0){return new Intl.NumberFormat(LOCALES[S.lang],{minimumFractionDigits:dec,maximumFractionDigits:dec}).format(n).replace(/ /g,' ');}
function money(n,cur,dec){cur=cur||'USD';if(dec==null)dec=cur==='USD'?2:0;const s=fmtNum(Math.abs(n),dec);const m=n<0?'−':'';if(cur==='USD')return m+'$'+s;if(cur==='UAH')return m+s+' '+(S.lang==='uk'||S.lang==='ru'?'грн':'UAH');if(cur==='KZT')return m+s+' ₸';return m+s+' '+cur;}
function pct(x,dec=0){return fmtNum(x*100,dec)+'%';}
function luhnOk(num){let s=0,alt=false;for(let i=num.length-1;i>=0;i--){let n=+num[i];if(alt){n*=2;if(n>9)n-=9;}s+=n;alt=!alt;}return s%10===0;}

/* ---------- commercial model v09 (see API.md "Business rules") ----------
   OTA TECHNOLOGY DMCC invoices the partner ONLY in USD for Activation Keys and Service Tokens.
   SIM cards are never sold or invoiced: they are shipped in custody (S.shipments). */
const PLANS=['light','std','prem'];
const PLAN_NAME={light:'Light',std:'Standard',prem:'Premium'};
const PLAN_EN={light:'Light',std:'Standard',prem:'Premium'};      // names used in legal documents
const TERMS=[12,24,36,48,60];              // Service Token terms in months (monthly subscription is retail-only)
const TERM_DISC={1:0,12:0.10,24:0.20,36:0.30,48:0.35,60:0.40};
const TOKEN_VALID_MONTHS=36;               // a Service Token is usable for 36 months from issue
const PRICE_NOTICE_DAYS=90;                // price increase: notice >= 90 days (MPA 9.1)
const PRICE_CAP=0.10;                      // price increase: not more than 10% in any rolling 12 months (MPA 9.1, ТЗ v10 3.2)
const CLASS_A_NOTICE_DAYS=30;              // other class-A changes: >= 30 days
const RESERVED_CODES=['OTA','INV','TST'];
const LANG2_AVAILABLE=['ru','kk'];         // approved second document languages (kk: Kazakhstan class-C documents need kk + ru)
// Seed sources for per-country price lists (OTA can edit the lists afterwards; these are only the starting point)
const CC_META={
 UA:{cur:'UAH',fx:45.0564,vat:0.20,key:9.85,month:{light:75,std:99}},
 KZ:{cur:'KZT',fx:441.77,vat:0.16,key:9.40,month:{light:990,std:1290}}};
const BASE_MONTH_UAH_VAT=CC_META.UA.month; // legacy name (calculator)
const SIM_USD_NET=CC_META.UA.key;          // legacy name: now the Ukrainian Activation Key price
// Package version digit inside an activation code (position 6) — Crockford Base32
const PKG_DIGIT={'light-24':'1','light-36':'2','light-60':'3','std-24':'4','std-36':'5','std-60':'6','light-12':'7','std-12':'8',
 'light-48':'9','std-48':'A','prem-12':'B','prem-24':'C','prem-36':'D','prem-48':'E','prem-60':'F'};
function pkgKey(plan,term){return plan+'-'+term;}
function pkgSplit(k){const [p,tm]=String(k).split('-');return{plan:p,term:+tm};}
function pkgLabel(plan,term){return PLAN_NAME[plan]+' · '+termLabel(term);}
function termLabel(m){if(m===1)return t('c.monthly');const y=m/12;if(y%1)return m+' '+t('c.monthsShort');return fmtNum(y)+' '+plural(y,{one:t('c.year1'),few:t('c.year2'),many:t('c.year5'),other:t('c.year5')});}
function ctyName(cc){if(!cc)return '—';try{return new Intl.DisplayNames([LOCALES[S.lang]],{type:'region'}).of(cc)||cc;}catch(e){return cc;}}
function ctyNameEn(cc){try{return new Intl.DisplayNames(['en'],{type:'region'}).of(cc)||cc;}catch(e){return cc;}}
const r2=x=>Math.round(x*100)/100;
const addDays=(d,n)=>new Date((typeof d==='string'?new Date(d):d).getTime()+n*864e5);
function addMonths(d,n){const x=new Date(typeof d==='string'?d:d.getTime());x.setMonth(x.getMonth()+n);return x;}

/* ---------- per-country price lists (S.priceLists[CC] = versions, newest last) ----------
   version: {ver, from, to, key, tokens:{light:{12,24,36,48,60},std:{..},prem:{..}}, retained:{light,std,prem}, fee, createdAt, by, note, status?:'withdrawn'} */
function plSeed(cc){const m=CC_META[cc]||CC_META.UA;const tokens={},retained={};
 const monthUsd={light:m.month.light/(1+m.vat)/m.fx,std:m.month.std/(1+m.vat)/m.fx};
 ['light','std'].forEach(p=>{tokens[p]={};TERMS.forEach(tm=>{tokens[p][tm]=r2(monthUsd[p]*tm*(1-TERM_DISC[tm]));});retained[p]=r2(monthUsd[p]);});
 tokens.prem={};TERMS.forEach(tm=>{tokens.prem[tm]=r2(tokens.std[tm]*1.5);});retained.prem=r2(monthUsd.std*1.5);
 return{key:m.key,tokens,retained,fee:0};}
function plVersions(cc){return ((S.priceLists||{})[cc]||[]).filter(v=>v.status!=='withdrawn');}
// raw schedule: the version whose effective window contains `at`
function plSchedule(cc,at){const vs=plVersions(cc);if(!vs.length)return null;const ts=iso(at||now());let cur=null;
 vs.forEach(v=>{if(v.from<=ts&&(!v.to||ts<v.to))cur=v;});return cur||vs.filter(v=>v.from<=ts).pop()||vs[0];}
// version in force now: with the legal module, the one referenced by the Order Form in force (a new version — increase or
// decrease — applies only once its Order Form is signed by both parties); without it, the schedule. `at` = historical lookup.
function priceList(cc,at){if(!at&&typeof lg_inForce==='function'){try{const of=lg_inForce('OF',cc);if(of&&of.priceVer!=null){const v=((S.priceLists||{})[cc]||[]).find(x=>x.ver===of.priceVer);if(v)return v;}}catch(e){}}
 return plSchedule(cc,at);}
// versions not yet in force (scheduled, or effective but waiting for the new Order Form signature)
function plPending(cc){const cur=priceList(cc);const cv=cur?cur.ver:0;return plVersions(cc).filter(v=>v.ver>cv);}
function plAwaitingSign(v){return !!v&&v.from<=iso(now());}
function plLatest(cc){const vs=plVersions(cc);return vs[vs.length-1]||null;}
function plCountries(){return Object.keys(S.priceLists||{});}
function orgCountries(){const o=S.org||{};const l=(o.countries&&o.countries.length?o.countries:plCountries());return l.length?l:['UA'];}
function primaryCc(){return orgCountries()[0];}
function keyPrice(cc){const v=priceList(cc||primaryCc());return v?v.key:SIM_USD_NET;}
function tokenPrice(plan,term,cc){const v=priceList(cc||primaryCc());const x=v&&v.tokens[plan]&&v.tokens[plan][term];return x!=null?x:plSeed(cc||'UA').tokens[plan][term];}
function retainedAmt(plan,cc){const v=priceList(cc||primaryCc());return v?v.retained[plan]:plSeed(cc||'UA').retained[plan];}
function countryFee(cc){const v=priceList(cc||primaryCc());return v?v.fee||0:0;}
// is the change from version a -> b an increase for the partner (any price, retained amount or fee goes up)?
function plIsIncrease(a,b){if(!a)return false;if(b.key>a.key+0.004||(b.fee||0)>(a.fee||0)+1e-9)return true;
 return PLANS.some(p=>(b.retained[p]>a.retained[p]+0.004)||TERMS.some(tm=>b.tokens[p][tm]>a.tokens[p][tm]+0.004));}
// earliest allowed effective date for a new version (ISO)
function plMinFrom(cc,data){const base=plLatest(cc);return plIsIncrease(base,data)?iso(addDays(now(),PRICE_NOTICE_DAYS)):iso(now());}
// price items compared by the 10% / 12 months cap (key, every token, every retained amount). The fee is a 0–3% rate:
// raising it counts as an increase for the 90-day notice but is not measured in percent of itself (see API.md).
function plItems(d){const o={key:d.key};PLANS.forEach(p=>{TERMS.forEach(tm=>{o['tok:'+p+'-'+tm]=d.tokens[p][tm];});o['ret:'+p]=d.retained[p];});return o;}
function plItemLabel(k){if(k==='key')return 'Activation Key';const m=k.match(/^(tok|ret):(\w+)(?:-(\d+))?$/);if(!m)return k;return m[1]==='tok'?`Service Token ${PLAN_EN[m[2]]}, ${m[3]} months`:`Retained Amount ${PLAN_EN[m[2]]}`;}
// check a new price version effective `from` against the rules: {increase, minFrom, noticeOk, cap:[{item,label,base,val,pct}] (items over +10% vs the
// lowest value in force at any time during the 12 months before `from`)}. `skipVer` excludes a version (to re-check an existing one).
function plIncreaseCheck(cc,data,from,skipVer){const vs=plVersions(cc).filter(v=>v.ver!==skipVer);const base=skipVer!=null?vs.filter(v=>v.ver<skipVer).pop()||null:plLatest(cc);
 const increase=plIsIncrease(base,data);const minFrom=increase?iso(addDays(now(),PRICE_NOTICE_DAYS)):iso(now());from=from||minFrom;
 const winStart=iso(addMonths(new Date(from),-12));const inWin=vs.filter(v=>v.from<=from&&(!v.to||v.to>winStart||v===base));
 const ni=plItems(data);const cap=[];
 if(inWin.length)Object.keys(ni).forEach(k=>{const lows=inWin.map(v=>plItems(v)[k]).filter(x=>x!=null&&x>0);if(!lows.length)return;const lo=Math.min(...lows);
  if(ni[k]>r2(lo*(1+PRICE_CAP))+0.004)cap.push({item:k,label:plItemLabel(k),base:lo,val:ni[k],pct:(ni[k]-lo)/lo});});
 return{increase,minFrom,noticeOk:!increase||from>=minFrom.slice(0,10),cap};}
// re-check an existing version (e.g. before issuing its Order Form version): {ok, cap, noticeOk}
function plCheckVersion(cc,ver){const v=((S.priceLists||{})[cc]||[]).find(x=>x.ver===ver);if(!v)return{ok:false,cap:[],noticeOk:false};
 const c=plIncreaseCheck(cc,v,v.from,ver);const created=v.createdAt||v.from;const noticeOk=!v.increase||new Date(v.from)-new Date(created)>=PRICE_NOTICE_DAYS*864e5-6e4;
 return{ok:!c.cap.length&&noticeOk,cap:c.cap,noticeOk};}
// add a price-list version. data: {key,tokens,retained,fee}; o: {from (ISO, clamped to the notice rule), note, justification, docLink}
// An increase needs a justification (supplier / regulatory cost growth) and a link to the supporting document; it never applies to keys, tokens
// or subscription periods already paid (invoices freeze unit prices and priceVer). Returns the version, or {err:'cap'|'justification', cap} (nothing saved).
function plAdd(cc,data,o){o=o||{};S.priceLists=S.priceLists||{};const all=S.priceLists[cc]=S.priceLists[cc]||[];
 const minFrom=plMinFrom(cc,data);let from=o.from&&o.from>minFrom?o.from:minFrom;
 const chk=plIncreaseCheck(cc,data,from);if(chk.cap.length){audit('pricelist.blocked',cc,{reason:'cap_10pct_12m',items:chk.cap.map(x=>x.item)});return{err:'cap',cap:chk.cap};}
 const just=String(o.justification||o.note||'').trim(),docLink=String(o.docLink||'').trim();
 if(chk.increase&&o.strict&&(!just||!docLink)){return{err:'justification',cap:[]};}
 const ts=iso(now());all.forEach(v=>{if(v.status!=='withdrawn'&&v.from>ts){v.status='withdrawn';v.withdrawnAt=ts;}}); // a new version replaces pending ones
 const prev=plVersions(cc).filter(v=>v.from<=from).pop();if(prev)prev.to=from;
 const ver=all.reduce((m,v)=>Math.max(m,v.ver),0)+1;
 const v={ver,from,to:null,key:r2(data.key),tokens:JSON.parse(JSON.stringify(data.tokens)),retained:Object.assign({},data.retained),fee:+data.fee||0,createdAt:ts,by:actorName(),note:o.note||'',increase:plIsIncrease(prev||null,data)};
 if(v.increase){v.justification=just;v.docLink=docLink;if(!just||!docLink)v.justMissing=true;}
 all.push(v);audit('pricelist.version',cc+' v'+ver,{from,increase:v.increase,note:v.note,justification:v.justification||'',docLink:v.docLink||''});return v;}

/* legacy pricing API kept for other modules (20_catalog): prices are USD from the primary country's price list */
function unitPrice(item,cur,cc){ // item: 'key' | 'sim'(=key, legacy) | {plan,term}
 const usd=(item==='key'||item==='sim')?keyPrice(cc):tokenPrice(item.plan,item.term,cc);
 return cur==='UAH'?r2(usd*FX):usd;}
function hasOverride(item,cur,cc){cc=cc||primaryCc();const sd=plSeed(cc);const v=priceList(cc);if(!v)return false;
 if(item==='key'||item==='sim')return Math.abs(v.key-sd.key)>0.004;return Math.abs(v.tokens[item.plan][item.term]-sd.tokens[item.plan][item.term])>0.004;}
function setPrice(item,cur,val,note){ // creates (or extends, within the same demo minute) a price-list version of the primary country
 const cc=primaryCc();const base=plLatest(cc);if(!base)return false;const v=val==null?null:r2(val);
 const data={key:base.key,tokens:JSON.parse(JSON.stringify(base.tokens)),retained:Object.assign({},base.retained),fee:base.fee||0};
 const sd=plSeed(cc);
 if(item==='key'||item==='sim'){const nv=v==null?sd.key:v;if(Math.abs(nv-data.key)<0.005)return false;data.key=nv;}
 else{const nv=v==null?sd.tokens[item.plan][item.term]:v;if(Math.abs(nv-data.tokens[item.plan][item.term])<0.005)return false;data.tokens[item.plan][item.term]=nv;}
 if(base.createdAt===iso(now())&&base.by===actorName()){const merged=Object.assign({},data);const inc=plIsIncrease(plVersions(cc).filter(x=>x!==base).pop(),merged);
  base.key=data.key;base.tokens=data.tokens;if(inc&&!base.increase){base.increase=true;base.from=iso(addDays(now(),PRICE_NOTICE_DAYS));}return true;}
 plAdd(cc,data,{note:note||''});return true;}
function priceKeyOf(item){return item==='key'||item==='sim'?'key':pkgKey(item.plan,item.term);}
function priceItemLabel(k){if(k==='key'||k==='sim')return t('c.keyItem');const {plan,term}=pkgSplit(k);return pkgLabel(plan,term);}
// per-partner order rules (OTA can change): minimum Activation Keys in the first / next orders
function orgMin(){const o=S.org||{};return{first:o.minFirst||1000,next:o.minNext||100};}

/* ---------- OTA data (ТЗ §3 "Данные OTA"): S.ota = {KEY: value}. Empty = N/A (never printed) ---------- */
const OTA_KEYS=['OTA_NAME','OTA_REGNO','OTA_LICENCE','OTA_TRN','OTA_ADDR_EN','OTA_ADDR_L2','OTA_SIGNATORY','OTA_SIGNATORY_L2_GEN','OTA_TITLE_EN','OTA_TITLE_L2','OTA_TITLE_L2_GEN',
 'OTA_BANK_BENEF','OTA_BANK_NAME','OTA_BANK_ADDR','OTA_BANK_ACCOUNT','OTA_BANK_IBAN','OTA_BANK_SWIFT','OTA_BANK_CUR','OTA_BANK_INTER','OTA_BANK_INTER_SWIFT',
 'OTA_EMAIL_OPS','OTA_EMAIL_LEGAL','OTA_EMAIL_FIN','OTA_EMAIL_SUPPORT','OTA_EMAIL_PRIVACY','OTA_SUBPROC_EMAIL','OTA_SUBPROC_EMAIL_LOC','OTA_SUPPORT_HOURS','CARD_DESCRIPTOR'];
const OTA_REMOVED_KEYS=['OTA_CUSTOMS_CODE'];   // + legacy flat OTA_VAT_{CC} / OTA_REP_{CC} (v10: per-country S.ota.countries, see otaLocal)
const otaRemovedKey=k=>OTA_REMOVED_KEYS.includes(k)||/^OTA_(VAT|REP)_[A-Z]{2}$/.test(k);  // v10 (ТЗ 1.2): SIMs ship only from the EU — no Dubai Customs code anywhere
/* per-country OTA settings (ТЗ v10 2.6, 4.5, part 6): S.ota.countries[CC] = {vat_local, rep_local, delay_hours, ownership_v10_enabled}
   vat_local → OTA_VAT_LOCAL, rep_local → OTA_REP_LOCAL: printed ONLY when set and ONLY in documents of that country (EUT annex row, PN 1.3, OF requisites,
   payment page / receipts of Direct Subscriptions). delay_hours: transfer cooling-off, integer 1–24, default 24. ownership_v10_enabled: technical launch switch. */
const OTA_DELAY_DEFAULT=24,OTA_DELAY_MIN=1,OTA_DELAY_MAX=24;
function otaCountries(){S.ota=S.ota||{};if(!S.ota.countries||typeof S.ota.countries!=='object')S.ota.countries={};return S.ota.countries;}
function otaCountry(cc){const c=(S.ota&&S.ota.countries&&S.ota.countries[cc])||{};const s=x=>x==null?'':String(x).trim();
 const d=parseInt(c.delay_hours,10);return{vat_local:s(c.vat_local),rep_local:s(c.rep_local),delay_hours:d>=OTA_DELAY_MIN&&d<=OTA_DELAY_MAX?d:OTA_DELAY_DEFAULT,ownership_v10_enabled:!!c.ownership_v10_enabled};}
// validate + save; returns '' or an error code: 'delay' (not an integer 1–24)
function otaCountrySet(cc,patch){const cur=otaCountry(cc);const n=Object.assign({},cur,patch||{});
 if(patch&&'delay_hours' in patch){const raw=String(patch.delay_hours).trim();if(!/^\d+$/.test(raw)||+raw<OTA_DELAY_MIN||+raw>OTA_DELAY_MAX)return 'delay';n.delay_hours=+raw;}
 n.vat_local=String(n.vat_local||'').trim();n.rep_local=String(n.rep_local||'').trim();n.ownership_v10_enabled=!!n.ownership_v10_enabled;
 otaCountries()[cc]=n;return '';}
// template values for ONE country: only keys that are set (N/A → absent, never printed)
function otaLocal(cc){const c=otaCountry(cc);const o={};const na=x=>!x||x.toUpperCase()==='N/A';if(!na(c.vat_local))o.OTA_VAT_LOCAL=c.vat_local;if(!na(c.rep_local))o.OTA_REP_LOCAL=c.rep_local;return o;}
// demo per-country values shipped by the template agent (LEGAL_DEMO_VALUES.countries[CC].OTA_VAT_LOCAL / OTA_REP_LOCAL), fictional
function otaCountryDemo(cc){const D=legalDemo();const c=D&&D.countries&&D.countries[cc]||{};return{vat_local:c.OTA_VAT_LOCAL||'',rep_local:c.OTA_REP_LOCAL||''};}
function otaDelayHours(cc){return otaCountry(cc).delay_hours;}
function ownershipEnabled(cc){return otaCountry(cc).ownership_v10_enabled;}

/* ---------- UAE Central Bank USD→AED reference rates (ТЗ v10 2.2): S.fx.aed = [{date:'YYYY-MM-DD', usd_aed, src}] ----------
   Every OTA Tax Invoice / Tax Credit Note stores the rate of its own date (inv.aedRate, inv.aedRateDate). Edited by OTA Finance (perm ota.vat). */
const AED_DEMO_RATE=3.6725;
function fxAed(){S.fx=S.fx||{};if(!Array.isArray(S.fx.aed))S.fx.aed=[];return S.fx.aed;}
function aedRate(date){const d=String(date?(typeof date==='string'?date:iso(date)):iso(now())).slice(0,10);
 const list=fxAed().slice().sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0);let r=null;list.forEach(x=>{if(x.date<=d)r=x;});
 if(!r)r=list[0]||{date:d,usd_aed:AED_DEMO_RATE,src:'CBUAE (demo)'};return{rate:+r.usd_aed,date:r.date,src:r.src||''};}
// add/replace the rate of a date; returns '' or 'date' | 'rate'
function aedRateSet(date,rate,src){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date||''))||isNaN(new Date(date)))return 'date';const r=parseFloat(String(rate).replace(',','.'));if(!(r>0)||r>100)return 'rate';
 const list=fxAed();const ex=list.find(x=>x.date===date);const row={date,usd_aed:Math.round(r*1e6)/1e6,src:src||'CBUAE'};if(ex)Object.assign(ex,row);else list.push(row);list.sort((a,b)=>a.date<b.date?-1:1);return '';}
const fmtAed=r=>{const x=+r;return isFinite(x)?String(Math.round(x*1e6)/1e6).replace(/^(\d+)$/,'$1.0'):'';};
// hard fallback (ТЗ §3); the real seed merges LEGAL_DEMO_VALUES.ota from 60_legal_templates.js (see otaSeed)
function otaDefaults(){return{OTA_NAME:'OTA TECHNOLOGY DMCC',OTA_REGNO:'DMCC100200',OTA_LICENCE:'DMCC-100200',OTA_TRN:'100000000000003',
 OTA_ADDR_EN:'Unit No. 0101, Demo Business Centre, Level 1, Demo Tower, Dubai, UAE',OTA_ADDR_L2:'',OTA_SIGNATORY:'Anna Petrova',OTA_SIGNATORY_L2_GEN:'',OTA_TITLE_EN:'Manager',OTA_TITLE_L2:'',OTA_TITLE_L2_GEN:'',
 OTA_BANK_BENEF:'OTA TECHNOLOGY DMCC',OTA_BANK_NAME:'Demo Bank PJSC',OTA_BANK_ADDR:'1 Demo Street, Business Bay, Dubai, UAE',OTA_BANK_ACCOUNT:'1234567890123',
 OTA_BANK_IBAN:'AE070331234567890123456',OTA_BANK_SWIFT:'DEMOAEADXXX',OTA_BANK_CUR:'USD',OTA_BANK_INTER:'',OTA_BANK_INTER_SWIFT:'',
  OTA_EMAIL_OPS:'',OTA_EMAIL_LEGAL:'',OTA_EMAIL_FIN:'',OTA_EMAIL_SUPPORT:'',OTA_EMAIL_PRIVACY:'',OTA_SUBPROC_EMAIL:'',OTA_SUBPROC_EMAIL_LOC:'',OTA_SUPPORT_HOURS:'Mon–Fri 09:00–21:00 UTC+4; P1 24/7',CARD_DESCRIPTOR:''};}
// LEGAL_DEMO_VALUES is a const in 60_legal_templates.js (loaded later): read it lazily, guarded against the temporal dead zone
function legalDemo(){try{return LEGAL_DEMO_VALUES;}catch(e){return null;}}
function otaSeed(){const o=otaDefaults();try{const LD=legalDemo();if(LD&&LD.ota){const L=LD.ota;
  Object.keys(L).forEach(k=>{if(k==='P_CODE'||otaRemovedKey(k))return;o[k]=L[k]==null?'':String(L[k]);});}}catch(e){}return o;}
function otaVal(k){const v=S.ota&&S.ota[k];if(v&&typeof v==='object')return null;const s=v==null?'':String(v).trim();return s&&s.toUpperCase()!=='N/A'?s:null;} // null = N/A → hide
function otaKeys(){return OTA_KEYS.slice();}   // per-country keys: otaLocal(cc)

/* ---------- roles & demo users (ТЗ §9) ---------- */
const ROLES={
 ota_admin:{side:'ota',perms:['ota.settings','ota.codes','ota.countries','ota.prices','ota.na','ota.ship','ota.view','p.view']},
 ota_legal:{side:'ota',perms:['ota.templates','ota.versions','ota.release','ota.sign','ota.audit','ota.view','p.view']},
 ota_finance:{side:'ota',perms:['ota.invoices','ota.payments','ota.statements','ota.vat','ota.issue','ota.cn','ota.view','p.view']},
 p_admin:{side:'partner',perms:['p.form','p.users','p.view','p.docs','p.orders','p.imei','p.receipt','p.codes']},
 p_sign:{side:'partner',perms:['p.sign','p.confirm','p.view','p.docs']},
 p_ops:{side:'partner',perms:['p.orders','p.imei','p.receipt','p.codes','p.view']}};
function demoUsers(){const o=S.org||{};const u=S.user||{};return[
 {id:'u_ota_admin',name:'Platform Admin',email:'admin@ota.demo',role:'ota_admin'},
 {id:'u_ota_legal',name:'Anna Petrova',email:'legal@ota.demo',role:'ota_legal',title:'Manager'},
 {id:'u_ota_fin',name:'Finance Desk',email:'finance@ota.demo',role:'ota_finance'},
 {id:'u_p_admin',name:u.name||u.email||'Partner Admin',email:u.email||'',role:'p_admin'},
 {id:'u_p_sign',name:o.signatory||'Signatory',email:o.signatoryEmail||'',role:'p_sign',title:o.title||''},
 {id:'u_p_ops',name:o.opsName||'Operations',email:o.opsEmail||'',role:'p_ops'}];}
// HOOKS.users: fns returning extra users (e.g. dealers / installers from 80_ownership); appended once, by id
function users(){const base=S.users&&S.users.length?S.users:demoUsers();const ex=[];(typeof HOOKS!=='undefined'&&HOOKS.users||[]).forEach(f=>{try{(f()||[]).forEach(u=>{if(u&&!base.some(b=>b.id===u.id)&&!ex.some(b=>b.id===u.id))ex.push(u);});}catch(e){}});return ex.length?base.concat(ex):base;}
function actor(){const us=users();return us.find(u=>u.id===S.actor)||us.find(u=>u.role===(S.admin?'ota_admin':'p_admin'))||us[0];}
function actorName(){const a=actor();return a?a.name:'';}
function roleName(r){return t('c.role.'+r);}
function can(perm){const a=actor();if(!a)return false;const R=ROLES[a.role];if(!R)return false;if(perm.startsWith('ota.')&&!S.admin)return false;return R.perms.includes(perm);}
function setActor(id){const u=users().find(x=>x.id===id);if(!u)return;S.actor=id;audit('user.switch',u.role,{name:u.name});}

/* ---------- audit (append-only, ТЗ §9): never edit or delete entries ---------- */
function audit(action,object,details){S.audit=S.audit||[];const a=actor()||{};
 const e={id:'au_'+(S.audit.length+1),ts:iso(now()),actor:a.name||'',email:a.email||'',role:a.role||'',action:String(action),object:object==null?'':String(object),details:details||{},
  ip:'203.0.113.'+(10+(a.role?Object.keys(ROLES).indexOf(a.role):0)),ua:(typeof navigator!=='undefined'?navigator.userAgent:'').slice(0,160)};
 S.audit.push(e);return e;}

/* ---------- document numbering (ТЗ §5). Numbers are never reused. ----------
   docNo(kind, opts):
     'MPA' | 'TRT' | 'SLA' | 'BL' | 'DPA' | 'SIM'  → OTA-PPP-TTT-NNN-vN   (counter per partner & type; opts.base → next version of that number, same NNN)
     'BOA'                                         → OTA-PPP-BOA-NNN
     'OF'  {cc}                                    → OTA-PPP-OF-CC-NNN-vN (counter per partner & country; opts.base → next version)
     'RS'  {cc, ym:'YYYYMM'|Date}                  → OTA-PPP-RS-CC-YYYYMM (one per month, no counter)
     'INV' | 'CN'                                  → OTA-INV-YYYY-NNNNNN / OTA-CN-YYYY-NNNNNN (global, all partners)
     'PF'                                          → OTA-PF-YYYY-NNNN (global)
     'SR'  {pf}                                    → OTA-SR-YYYY-NNNN with the same YYYY-NNNN as the pro forma
     'EUT' | 'PN' {cc, lang, ver:'1.0'}            → OTA-EUT-CC-lang-v1.0
     'TPL' {type, ver}                             → T-TTT-vN
   opts.peek=true returns the next number without consuming it. */
const GKEY=APP_KEY+'-global';   // survives partner resets: global counters + used partner codes
function gStore(){try{return JSON.parse(localStorage.getItem(GKEY))||{seq:{},codes:[]};}catch(e){return{seq:{},codes:[]};}}
function gSave(g){try{localStorage.setItem(GKEY,JSON.stringify(g));}catch(e){}}
function seqNext(key,global,peek){S.seq=S.seq||{};let n=S.seq[key]||0;let g=null;if(global){g=gStore();n=Math.max(n,g.seq[key]||0);}
 n++;if(!peek){S.seq[key]=n;if(g){g.seq[key]=n;gSave(g);}}return n;}
function docNo(kind,o){o=o||{};const P=(S.org&&S.org.code)||'PPP';const d=o.date?new Date(o.date):now();const Y=d.getFullYear();
 const bump=b=>{const m=String(b).match(/^(.*)-v(\d+)$/);return m?m[1]+'-v'+(+m[2]+1):b+'-v2';};
 switch(kind){
  case 'MPA':case 'TRT':case 'SLA':case 'BL':case 'DPA':case 'SIM':
   if(o.base)return bump(o.base);return `OTA-${P}-${kind}-${pad(seqNext(P+':'+kind,false,o.peek),3)}-v${o.ver||1}`;
  case 'BOA':return `OTA-${P}-BOA-${pad(seqNext(P+':BOA',false,o.peek),3)}`;
  case 'OF':{if(o.base)return bump(o.base);const cc=o.cc||'XX';return `OTA-${P}-OF-${cc}-${pad(seqNext(P+':OF:'+cc,false,o.peek),3)}-v${o.ver||1}`;}
  case 'RS':{const ym=o.ym instanceof Date?o.ym.getFullYear()+pad(o.ym.getMonth()+1):(o.ym||(Y+pad(d.getMonth()+1)));return `OTA-${P}-RS-${o.cc||'XX'}-${ym}`;}
  case 'INV':case 'CN':return `OTA-${kind}-${Y}-${pad(seqNext(kind+':'+Y,true,o.peek),6)}`;
  case 'PF':return `OTA-PF-${Y}-${pad(seqNext('PF:'+Y,true,o.peek),4)}`;
  case 'SR':{const m=String(o.pf||'').match(/^OTA-PF-(\d{4}-\d{4})$/);if(!m)throw new Error('docNo SR needs {pf}');return 'OTA-SR-'+m[1];}
  case 'EUT':case 'PN':return `OTA-${kind}-${o.cc||'XX'}-${o.lang||'en'}-v${o.ver||'1.0'}`;
  case 'TPL':return `T-${o.type||'TTT'}-v${o.ver||1}`;}
 throw new Error('docNo: unknown kind '+kind);}

/* ---------- partner code PPP: 3 Latin letters, unique forever, OTA/INV/TST reserved ---------- */
const TRANSLIT={'А':'A','Б':'B','В':'V','Г':'H','Ґ':'G','Д':'D','Е':'E','Є':'E','Ж':'Z','З':'Z','И':'Y','І':'I','Ї':'I','Й':'Y','К':'K','Л':'L','М':'M','Н':'N','О':'O','П':'P','Р':'R','С':'S','Т':'T','У':'U','Ф':'F','Х':'K','Ц':'C','Ч':'C','Ш':'S','Щ':'S','Ь':'','Ю':'U','Я':'Y','Ё':'E','Ы':'Y','Э':'E','Ъ':''};
function codesUsed(){const g=gStore();return (g.codes||[]).concat(['ACM','TEL']);} // ACM, TEL: other demo partners already registered
function codeAvailable(code,own){code=String(code||'').toUpperCase();if(!/^[A-Z]{3}$/.test(code))return 'format';if(RESERVED_CODES.includes(code))return 'reserved';
 if(code!==own&&codesUsed().includes(code))return 'taken';return '';}
function proposeCode(name){const words=String(name||'').toUpperCase().split('').map(c=>TRANSLIT[c]!=null?TRANSLIT[c]:c).join('')
  .replace(/[«»"'“”().,]/g,' ').split(/\s+/).filter(w=>w&&!/^(LIMITED|LTD|LLC|INC|GMBH|DMCC|FZE|FZCO|PLC|LLP|TOV|TOB|TZOV|OOO|TOO|PP|FOP|AO|JSC|SP|ZOO|SRL|CO|THE|AND|COMPANY|GROUP)$/.test(w));
 const L=words.join('').replace(/[^A-Z]/g,'');const cands=[];
 if(L){const cons=L.slice(1).replace(/[AEIOUY]/g,'');cands.push((L[0]+cons).slice(0,3));if(words.length>=3)cands.push(words.slice(0,3).map(w=>w[0]).join(''));cands.push(L.slice(0,3));
  for(let i=1;i<L.length;i++)for(let j=i+1;j<L.length;j++)cands.push(L[0]+L[i]+L[j]);}
 for(const c of cands)if(c.length===3&&!codeAvailable(c))return c;
 for(let i=0;i<26*26;i++){const c=(L[0]||'X')+String.fromCharCode(65+Math.floor(i/26))+String.fromCharCode(65+i%26);if(!codeAvailable(c))return c;}return 'XXX';}
function codeRegister(code){const g=gStore();g.codes=g.codes||[];if(!g.codes.includes(code)){g.codes.push(code);gSave(g);}}

/* ---------- state ---------- */
function freshState(){return{v:3,lang:'uk',admin:false,clock:0,authed:false,
 user:null,           // {email,name} — the signed-in partner user (Partner Admin)
 org:null,            // {name,code:'ARV',codeStatus:'proposed'|'approved',lang2:'ru',country:'GB'(registration, drives VAT),countries:['UA','KZ'](Order Forms),regNo,taxId,address,
                      //  signatory,title,phone,bank:{benef,iban,bank,bankAddr,swift,interSwift},delivery:{CC:{company,recipient,phone,address,city,importer}},
                      //  currency:'USD',prefix,commit:3000,minFirst,minNext,serials:{},createdAt}
 ota:otaSeed(),otaSeeded:!!legalDemo(), // OTA data keys (see OTA_KEYS); edited on the "OTA data" admin page
 priceLists:{},       // {CC:[version…]} see plAdd()
 seq:{},              // number counters, never reused (see docNo)
 audit:[],            // append-only [{id,ts,actor,email,role,action,object,details,ip,ua}]
 users:[],            // demo users (see demoUsers); S.actor = id of the acting user
 actor:null,
 brands:[],           // [{id,name,color,domain,createdAt,categories:[{id,name,models:[{id,name,sku,plan:null|'light'|'std'|'prem',planStatus:'review'|'approved',imei:[],createdAt}]}]}]
 keyOrders:[],        // [{id,no:'K-0001',cc,qty,unit,status:'draft'|'awaiting_payment'|'paid'|'cancelled',invoiceId,group,priceVer,createdAt,paidAt,cancelledAt}]
 tokenOrders:[],      // [{id,no:'T-0001',cc,lines:[{plan,term,qty,unit}],status,invoiceId,group,priceVer,createdAt,paidAt,cancelledAt}]
 invoices:[],         // OTA Tax Invoices, see mkInvoice() in 02_shared
 creditNotes:[],      // [{id,number:'OTA-CN-YYYY-NNNNNN',invoiceId,invoiceNo,amount,vat,total,reason,createdAt,by}]
 shipments:[],        // SIM shipments in custody [{id,pf,sr,cc,qty,iccidFrom,iccidTo,simType,unitValue,dap:{…},carrier,waybill,status:'prepared'|'shipped'|'delivered'|'received',events:[[status,ts]],receipt:{…}}]
 sims:[],             // [{iccid,shipmentId,status:'stock'|'active'|'blocked',imei,modelId,plan,term,paidUntil,code,keyLotId,linked,lastSeen,reseller,events:[]}]
 keyLots:[],          // Activation Key lots [{id,cc,qty,used,unit,invoiceId,invoiceNo,issuedAt,revoked}] consumed FIFO, one key per device
 tokenLots:[],        // Service Token lots [{id,key:'std-24',plan,term,cc,qty,used,reserved,unit,invoiceId,invoiceNo,issuedAt,expiresAt,src:'invoice'|'exchange',revoked}]
 exchanges:[],        // token exchanges [{id,from,to,qty,cc,diffUnit,invoiceId,status:'awaiting_payment'|'done'|'cancelled',createdAt,doneAt}]
 codes:[],            // [{code,plan,term,reseller,status:'issued'|'activated'|'void',createdAt,activatedAt,iccid,voidAt,lotId,keyLotId}]
 resellers:[],        // [{id,name,type:'installer'|'shop'|'branch'|'dealer',city,contact,createdAt}]
 form:{},             // partner questionnaire {KEY:{value,status:'filled'|'empty'|'na',comment,by,at}} (legal module)
 templates:{},docs:[],statements:[],commissionInvoices:[], // legal / ops modules
 fx:{aed:[]},         // UAE Central Bank USD→AED reference rates [{date,usd_aed,src}] (see aedRate)
 subs:[],             // Direct Subscriptions (card payment on the portal, OTA = seller) [{id,iccid,imei,plan,cc,status:'active'|'cancelled',startedAt,paidUntil,autoRenew}]
 subproc:null,        // sub-processor directory (Document 06 Annex 1), see subprocList() in 02_shared
 notices:[],          // notices without signature [{id,type:'subproc'|'of_terminate',…}] (shown by the legal module)
 activity:[],         // [{ts,text}]
 ui:{}};}
let S;
try{S=JSON.parse(localStorage.getItem(APP_KEY))||freshState();}catch(e){S=freshState();}
if(!S||S.v!==3)S=freshState();
function save(){try{localStorage.setItem(APP_KEY,JSON.stringify(S));}catch(e){}}
function log(text){S.activity.unshift({ts:iso(now()),text});S.activity=S.activity.slice(0,200);}
// lookups
function allModels(){const out=[];S.brands.forEach(b=>b.categories.forEach(c=>c.models.forEach(m=>out.push({brand:b,cat:c,model:m}))));return out;}
function findModel(id){return allModels().find(x=>x.model.id===id)||null;}
function findBrand(id){return S.brands.find(b=>b.id===id)||null;}

/* ---------- Service Tokens & Activation Keys (issued only from paid invoices) ---------- */
function lotExpired(l,at){return !!l.expiresAt&&iso(at||now())>=l.expiresAt;}
function lotFree(l){return l.revoked?0:Math.max(0,l.qty-l.used-(l.reserved||0));}
// token balance for a package key ('std-24'): {bought, used, reserved, expired (unused part of expired lots), avail}
function tokenStats(k,cc){const r={bought:0,used:0,reserved:0,expired:0,avail:0,revoked:0};
 for(const l of S.tokenLots||[]){if(l.key!==k||(cc&&l.cc!==cc))continue;if(l.revoked){r.revoked+=l.qty-l.used;r.used+=l.used;r.bought+=l.qty;continue;}
  r.bought+=l.qty;r.used+=l.used;r.reserved+=l.reserved||0;if(lotExpired(l))r.expired+=lotFree(l);else r.avail+=lotFree(l);}return r;}
function tokensAvail(k,cc){return tokenStats(k,cc).avail;}
function addTokenLot(k,qty,o){o=o||{};S.tokenLots=S.tokenLots||[];const {plan,term}=pkgSplit(k);const issued=o.issuedAt||iso(now());
 const lot={id:uid('tl'),key:k,plan,term,cc:o.cc||primaryCc(),qty,used:0,reserved:0,unit:o.unit||0,invoiceId:o.invoiceId||null,invoiceNo:o.invoiceNo||'',issuedAt:issued,
  expiresAt:o.expiresAt||iso(addMonths(issued,TOKEN_VALID_MONTHS)),src:o.src||'invoice'};S.tokenLots.push(lot);return lot;}
// consume one token of the exact package: soonest-expiring valid lot first
function consumeToken(k){const lot=(S.tokenLots||[]).filter(l=>l.key===k&&!l.revoked&&lotFree(l)>0&&!lotExpired(l)).sort((a,b)=>a.expiresAt<b.expiresAt?-1:a.expiresAt>b.expiresAt?1:0)[0];
 if(!lot)return null;lot.used++;return lot;}
function keyStats(cc){const r={bought:0,used:0,avail:0,revoked:0};for(const l of S.keyLots||[]){if(cc&&l.cc!==cc)continue;r.bought+=l.qty;r.used+=l.used;if(l.revoked)r.revoked+=l.qty-l.used;else r.avail+=lotFree(l);}return r;}
function keysAvail(cc){return keyStats(cc).avail;}
function addKeyLot(qty,o){o=o||{};S.keyLots=S.keyLots||[];const lot={id:uid('kl'),cc:o.cc||primaryCc(),qty,used:0,unit:o.unit||0,invoiceId:o.invoiceId||null,invoiceNo:o.invoiceNo||'',issuedAt:o.issuedAt||iso(now())};S.keyLots.push(lot);return lot;}
function consumeKey(){const lot=(S.keyLots||[]).filter(l=>!l.revoked&&lotFree(l)>0).sort((a,b)=>a.issuedAt<b.issuedAt?-1:1)[0];if(!lot)return null;lot.used++;return lot;}
// a device (IMEI) needs one key for life: true when a SIM in that device already holds a key
function deviceKeyed(imei){if(!imei)return false;return S.sims.some(s=>s.imei===imei&&s.keyLotId);}
// legacy names (older modules)
function creditsAvail(k){return tokensAvail(k);}
function consumeCredit(k){return consumeToken(k);}

function orgMark(size){const o=S.org||{};size=size||30;const ini=(o.name||'?').replace(/^(ТОВ|ФОП|ПП|ООО|LLC|ТзОВ)\s*/i,'').replace(/[«»"'“”]/g,'').trim().split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase()||'•';
 return o.logo?`<span class="orgmark" style="width:${size}px;height:${size}px"><img src="${esc(o.logo)}" alt=""></span>`:`<span class="orgmark" style="width:${size}px;height:${size}px;background:${esc(o.color||'var(--accent)')}">${esc(ini)}</span>`;}
function copyright(){return `<footer class="copy">${t('c.copyright',{y:now().getFullYear(),p:t('c.program')})}</footer>`;}

/* ---------- icons (inline stroke) ---------- */
const ICONS={
home:'<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
tag:'<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
box:'<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
cart:'<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L22 7H6"/>',
file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h6"/>',
sim:'<path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><rect x="8" y="11" width="8" height="7" rx="1"/>',
key:'<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.3-9.3M17 6l3 3M14 9l2 2"/>',
users:'<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M16 3.1a4 4 0 0 1 0 7.8M22 21a7 7 0 0 0-4-6.3"/>',
store:'<path d="M3 9 4.5 4h15L21 9"/><path d="M3 9v11h18V9"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M9 20v-6h6v6"/>',
calc:'<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h8"/>',
price:'<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
plus:'<path d="M12 5v14M5 12h14"/>',check:'<path d="M20 6 9 17l-5-5"/>',x:'<path d="M18 6 6 18M6 6l12 12"/>',
right:'<path d="m9 18 6-6-6-6"/>',left:'<path d="m15 18-6-6 6-6"/>',down:'<path d="m6 9 6 6 6-6"/>',
search:'<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',menu:'<path d="M3 6h18M3 12h18M3 18h18"/>',
upload:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',download:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
copy:'<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
truck:'<path d="M1 3h15v13H1zM16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
factory:'<path d="M2 20V8l6 4V8l6 4V4h8v16z"/><path d="M6 16h2M11 16h2M16 16h2"/>',
warehouse:'<path d="M3 21V8l9-5 9 5v13"/><path d="M7 21v-8h10v8M7 17h10"/>',
card:'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
alert:'<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
info:'<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
globe:'<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>',
chart:'<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
spark:'<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>',
logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
mail:'<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/>',
trash:'<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',edit:'<path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
layers:'<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
clock:'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
bolt:'<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
filter:'<path d="M22 3H2l8 9.5V19l4 2v-8.5z"/>',
eye:'<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>',
send:'<path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/>',
printer:'<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
};
function icon(n,cls){return `<svg class="i ${cls||''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[n]||''}</svg>`;}

/* ---------- UI kit (return HTML strings) ---------- */
const ui={
 btn(label,o={}){const tag=o.href?'a':'button';const at=o.href?`href="${o.href}"`:`type="${o.type||'button'}"`;
  return `<${tag} class="btn ${o.kind||''} ${o.size||''} ${o.block?'block':''}" ${at} ${o.act?`data-act="${o.act}"`:''} ${o.arg!=null?`data-arg="${esc(o.arg)}"`:''} ${o.disabled?'disabled':''} ${o.id?`id="${o.id}"`:''} ${o.title?`title="${esc(o.title)}"`:''}>${o.icon?icon(o.icon,'sm'):''}${label?`<span>${label}</span>`:''}</${tag}>`;},
 iconbtn(ic,label,o={}){return `<button type="button" class="iconbtn" aria-label="${esc(label)}" title="${esc(label)}" ${o.act?`data-act="${o.act}"`:''} ${o.arg!=null?`data-arg="${esc(o.arg)}"`:''}>${icon(ic)}</button>`;},
 badge(text,tone,dot){return `<span class="badge ${tone||''}">${dot?'<span class="d"></span>':''}${text}</span>`;},
 page(o){ // {title,sub,crumbs:[[label,href]],actions,body}
  return `${o.crumbs?`<nav class="crumbs" aria-label="breadcrumbs">${o.crumbs.map((c,i)=>c[1]?`<a href="${c[1]}">${esc(c[0])}</a><span aria-hidden="true">/</span>`:`<span>${esc(c[0])}</span>`).join('')}</nav>`:''}
  <div class="ph"><div class="grow"><h1 tabindex="-1">${o.title}</h1>${o.sub?`<p class="sub">${o.sub}</p>`:''}</div>${o.actions?`<div class="row wrap g8">${o.actions}</div>`:''}</div>${o.body||''}`;},
 card(o){ // {title,actions,body,foot,pad:true}
  return `<section class="card">${o.title||o.actions?`<div class="hd">${o.title?`<h2>${o.title}</h2>`:'<span></span>'}${o.actions?`<div class="row wrap g8">${o.actions}</div>`:''}</div>`:''}${o.pad===false?o.body:`<div class="bd">${o.body||''}</div>`}${o.foot?`<div class="ft">${o.foot}</div>`:''}</section>`;},
 kpi(label,value,sub,o={}){return `<div class="card kpi">${o.href?`<a href="${o.href}" style="color:inherit;text-decoration:none" class="col g4">`:''}<span class="k">${label}</span><span class="v">${value}</span>${sub?`<span class="s">${sub}</span>`:''}${o.href?'</a>':''}</div>`;},
 field(o){ // {id,label,type,value,hint,err,options:[[v,l]],placeholder,attrs,rows}
  const a=o.attrs||'';const inv=o.err?'aria-invalid="true"':'';const desc=(o.hint||o.err)?`aria-describedby="${o.id}-h"`:'';
  let ctl;
  if(o.type==='select')ctl=`<select class="inp" id="${o.id}" name="${o.id}" ${inv} ${desc} ${a}>${o.options.map(([v,l])=>`<option value="${esc(v)}" ${String(v)===String(o.value)?'selected':''}>${esc(l)}</option>`).join('')}</select>`;
  else if(o.type==='textarea')ctl=`<textarea class="inp" id="${o.id}" name="${o.id}" rows="${o.rows||5}" placeholder="${esc(o.placeholder||'')}" ${inv} ${desc} ${a}>${esc(o.value||'')}</textarea>`;
  else ctl=`<input class="inp ${o.mono?'mono':''}" id="${o.id}" name="${o.id}" type="${o.type||'text'}" value="${esc(o.value==null?'':o.value)}" placeholder="${esc(o.placeholder||'')}" ${inv} ${desc} ${a}>`;
  return `<div class="field"><label for="${o.id}">${o.label}</label>${ctl}${o.err?`<span class="err" id="${o.id}-h">${o.err}</span>`:o.hint?`<span class="hint" id="${o.id}-h">${o.hint}</span>`:''}</div>`;},
 table(cols,rows,o={}){ // cols:[{label,cls}], rows:[{cells:[html],href?,act?,arg?}]
  if(!rows.length)return o.empty||ui.empty('search',t('c.nothing'),'');
  return `<div class="tblwrap"><table class="tbl"><thead><tr>${cols.map(c=>`<th class="${c.cls||''}" scope="col">${c.label}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr ${r.href?`class="click" data-href="${r.href}"`:r.act?`class="click" data-act="${r.act}" data-arg="${esc(r.arg)}"`:''}>${r.cells.map((c,i)=>`<td class="${cols[i]&&cols[i].cls||''}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;},
 empty(ic,title,text,action){return `<div class="empty"><span class="ic">${icon(ic,'lg')}</span><h3>${title}</h3>${text?`<p>${text}</p>`:''}${action||''}</div>`;},
 note(tone,html,ic){return `<div class="note ${tone}">${icon(ic||(tone==='warn'||tone==='bad'?'alert':tone==='admin'?'shield':'info'),'sm')}<div>${html}</div></div>`;},
 bar(fraction,tone){return `<div class="bar ${tone||''}" role="img" aria-label="${Math.round(fraction*100)}%"><i style="width:${clamp(fraction,0,1)*100}%"></i></div>`;},
 seg(id,opts,val,act){return `<div class="seg" role="group" id="${id}">${opts.map(([v,l])=>`<button type="button" data-act="${act}" data-arg="${esc(v)}" aria-pressed="${String(v)===String(val)}">${l}</button>`).join('')}</div>`;},
 tabs(items,cur){return `<nav class="tabs">${items.map(([k,l,href])=>`<a href="${href}" ${k===cur?'aria-current="page"':''}>${l}</a>`).join('')}</nav>`;},
 pager(page,total,per,act){const pages=Math.max(1,Math.ceil(total/per));return `<div class="pager"><span>${fmtNum(Math.min(total,(page-1)*per+1))}–${fmtNum(Math.min(total,page*per))} ${t('c.of')} ${fmtNum(total)}</span><span class="row g8">${ui.btn(t('c.prev'),{size:'sm',act,arg:page-1,disabled:page<=1})}${ui.btn(t('c.next'),{size:'sm',act,arg:page+1,disabled:page>=pages})}</span></div>`;},
 adminOnly(html){return S.admin?html:'';},
};

/* ---------- overlays & toasts ---------- */
let _lastFocus=null;
function modal(title,body,foot,o={}){_lastFocus=document.activeElement;
 $('#overlay').innerHTML=`<div class="ovbg" data-act="ovclose" data-self="1"><div class="modal ${o.wide?'wide':''}" role="dialog" aria-modal="true" aria-labelledby="ovT"><div class="mh"><h2 id="ovT">${title}</h2>${ui.iconbtn('x',t('c.close'),{act:'ovclose'})}</div><div class="mb">${body}</div>${foot?`<div class="mf">${foot}</div>`:''}</div></div>`;
 const f=$('#overlay .mb input, #overlay .mb select, #overlay .mb textarea, #overlay .mf .btn.primary');if(f)f.focus();}
function drawer(title,body,foot){_lastFocus=document.activeElement;
 $('#overlay').innerHTML=`<div class="scrim" data-act="ovclose" data-self="1"></div><aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="ovT"><div class="mh"><h2 id="ovT" style="font-size:16px">${title}</h2>${ui.iconbtn('x',t('c.close'),{act:'ovclose'})}</div><div class="mb">${body}</div>${foot?`<div class="mf" style="padding:14px 20px;border-top:1px solid var(--line);display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">${foot}</div>`:''}</aside>`;
 const f=$('#overlay .drawer button');if(f)f.focus();}
function closeOverlay(){$('#overlay').innerHTML='';if(_lastFocus&&document.contains(_lastFocus))_lastFocus.focus();_lastFocus=null;}
function toast(msg,tone){const el=document.createElement('div');el.className='toast';el.setAttribute('role','status');el.innerHTML=icon(tone==='bad'?'alert':'check','sm')+'<span>'+msg+'</span>';$('#toasts').appendChild(el);setTimeout(()=>el.remove(),3400);}
function copyText(txt){try{navigator.clipboard.writeText(txt).then(()=>toast(t('c.copied')),()=>toast(t('c.copyFail'),'bad'));}catch(e){toast(t('c.copyFail'),'bad');}}

/* ---------- router & nav ---------- */
const ROUTES={};   // name -> {render(params)->html, nav:'key', auth:true}
const NAVS=[];     // {key,label:()=>,icon,href,section,order,count:()=>}
const ACT={};      // data-act handlers (arg, el, event)
const FORM={};     // data-form submit handlers (formEl, event)
const HOOKS={afterRender:[],onBoot:[],seedDemo:[],users:[],simDrawer:[]};   // simDrawer: fns(sim) → extra footer HTML in the SIM drawer
function route(name,def){ROUTES[name]=Object.assign({auth:true},def);}
function nav(def){NAVS.push(def);NAVS.sort((a,b)=>(a.order||0)-(b.order||0));}
function parseHash(){const h=(location.hash||'').slice(1);if(!h)return{name:'',params:[]};const p=h.split('--');return{name:p[0],params:p.slice(1)};}
// hash format: #name or #name--param1--param2  (only letters/digits/hyphens/underscores)
function link(name,...params){return '#'+[name].concat(params).join('--');}
function go(name,...params){const h=link(name,...params);if(location.hash===h)render();else location.hash=h;}
function shell(content,curNav){
 const items=NAVS.filter(n=>!n.admin||S.admin);let lastSec=null;
 const navHtml=items.map(n=>{let h='';if(n.section){const st=n.section();if(st!==lastSec){h+=`<div class="sec">${st}</div>`;lastSec=st;}}
  const c=n.count?n.count():null;
  return h+`<a href="${n.href}" ${curNav===n.key?'aria-current="page"':''}>${icon(n.icon)}<span>${n.label()}</span>${c?`<span class="cnt">${c}</span>`:''}</a>`;}).join('');
 const langSel=langBtn('sidelang');
 const curLbl=(()=>{const n=NAVS.find(x=>x.key===curNav);return n?n.label():'';})();
 return `<div class="app"><aside class="side" id="side" aria-label="${t('c.menu')}">
  <button class="orgsw" type="button" data-act="orgmenu">${orgMark(34)}<span class="grow" style="min-width:0"><b class="orgname">${esc(S.org?S.org.name:'—')}</b><span class="xs faint">${t('c.console')}</span></span>${icon('down','sm')}</button>
  ${S.admin?`<div class="adminbar" style="margin:0 0 8px">${icon('shield','sm')}<span>${t('c.adminOn')}</span></div>`:''}
  <nav class="nav">${navHtml}</nav>
  <div class="foot">
   <label class="chk small" style="padding:8px;border-radius:8px;background:${S.admin?'var(--violet-bg)':'transparent'}"><input type="checkbox" data-act="toggleAdmin" ${S.admin?'checked':''}><span><b>${t('c.adminMode')}</b><br><span class="faint xs">${t('c.adminHint')}</span></span></label>
   ${S.admin?`<label class="sidelang actorsel"><span>${icon('users','sm')}</span><select class="inp" data-act="setActor" aria-label="${t('c.actingAs')}">${users().map(u=>`<option value="${u.id}" ${actor().id===u.id?'selected':''}>${esc(roleName(u.role))} · ${esc(u.name)}</option>`).join('')}</select></label>`:''}
   ${langSel}
   <button class="userbtn" type="button" data-act="usermenu">${icon('users','sm')}<span>${esc(S.user?S.user.email:'')}</span>${icon('down','sm')}</button>
  </div></aside>
  <div class="main"><header class="top">
   <button class="iconbtn burger" type="button" data-act="burger" aria-label="${t('c.menu')}">${icon('menu')}</button>
   <span class="top-mark">${orgMark(26)}<b>${esc(curLbl||(S.org?S.org.name:''))}</b></span>
  </header><main class="content" id="content">${content}${copyright()}</main></div></div>`;}
let _curRoute='';
function render(keepScroll){
 const {name,params}=parseHash();let r=ROUTES[name];
 if(!S.authed){if(!r||r.auth!==false){r=ROUTES['signup'];}}
 else if(!r||r.auth===false){r=ROUTES['home'];}
 const y=window.scrollY;
 const html=r.render(...params);
 const app=$('#app');const _sc=$('#sidescrim');if(_sc)_sc.remove();
 app.innerHTML=r.auth===false?html:shell(html,r.nav);
 document.documentElement.lang=S.lang;
 const h1=$('#app h1');document.title=(h1?h1.textContent.trim()+' · ':'')+(S.org&&S.authed?S.org.name:t('c.program'));
 const key=name+'|'+params.join('|');
 if(keepScroll||key===_curRoute)window.scrollTo(0,y);else{window.scrollTo(0,0);if(h1&&!keepScroll)h1.focus({preventScroll:true});}
 _curRoute=key;
 HOOKS.afterRender.forEach(f=>{try{f(name,params);}catch(e){console.error(e);}});
 save();}
function rerender(){render(true);}
// right-edge fade on horizontally scrollable tables (hint that there is more)
function tblFade(root){$$('.tblwrap',root).forEach(w=>w.classList.toggle('fade-r',w.scrollWidth-w.clientWidth>2&&w.scrollLeft+w.clientWidth<w.scrollWidth-2));}
HOOKS.afterRender.push(()=>tblFade());
window.addEventListener('resize',()=>tblFade());
document.addEventListener('scroll',e=>{const w=e.target;if(w&&w.classList&&w.classList.contains('tblwrap'))tblFade(w.parentElement);},true);
new MutationObserver(()=>tblFade($('#overlay'))).observe(document.getElementById('overlay'),{childList:true});

/* ---------- global events ---------- */
document.addEventListener('click',e=>{
 const tr=e.target.closest('tr[data-href]');if(tr&&!e.target.closest('a,button,input,select,label')){location.hash=tr.dataset.href;return;}
 const a=e.target.closest('[data-act]');if(!a)return;
 if(a.tagName==='SELECT'||(a.tagName==='INPUT'&&(a.type==='checkbox'||a.type==='radio'||a.type==='text'||a.type==='number')))return; // handled on change/input
 if(a.dataset.self&&e.target!==a)return;
 const fn=ACT[a.dataset.act];if(!fn)return;e.preventDefault();fn(a.dataset.arg,a,e);});
document.addEventListener('change',e=>{const a=e.target.closest('[data-act]');if(!a||!(a.tagName==='SELECT'||a.tagName==='INPUT'))return;const fn=ACT[a.dataset.act];if(fn)fn(a.tagName==='SELECT'?a.value:(a.type==='checkbox'?a.checked:a.value),a,e);});
document.addEventListener('submit',e=>{const f=e.target.closest('form[data-form]');if(!f)return;e.preventDefault();const fn=FORM[f.dataset.form];if(fn){fn(f,e);try{save();}catch(x){}}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#overlay').innerHTML)closeOverlay();});
window.addEventListener('hashchange',()=>{closeOverlay();const s=$('#side');if(s)s.classList.remove('open');render();});
// form helper: read values by name
function formData(f){const o={};$$('[name]',f).forEach(el=>{o[el.name]=el.type==='checkbox'?el.checked:el.value;});return o;}
function setErr(f,name,msg){const el=f.querySelector(`[name="${name}"]`);if(!el)return;el.setAttribute('aria-invalid','true');let h=f.querySelector('#'+CSS.escape(el.id)+'-h');if(!h){h=document.createElement('span');h.id=el.id+'-h';el.after(h);el.setAttribute('aria-describedby',h.id);}h.className='err';h.textContent=msg;}
function clearErrs(f){$$('[aria-invalid="true"]',f).forEach(el=>el.removeAttribute('aria-invalid'));$$('.err',f).forEach(el=>{el.className='hint';el.textContent='';});}

/* core actions */
Object.assign(ACT,{
 ovclose(){closeOverlay();},
 burger(){const s=$('#side');s.classList.toggle('open');let sc=$('#sidescrim');if(s.classList.contains('open')){if(!sc){sc=document.createElement('div');sc.id='sidescrim';sc.className='scrim';sc.style.zIndex=50;sc.dataset.act='burger';sc.dataset.self='1';document.body.appendChild(sc);}}else if(sc)sc.remove();},
 setlang(v){if($('#lgl'))closeOverlay();useLang(v);},
 langpick(){langPicker();},
 toggleAdmin(v){S.admin=!!v;const a=actor();const side=a&&ROLES[a.role]?ROLES[a.role].side:'partner';
  if(S.admin&&side!=='ota')S.actor=(users().find(u=>u.role==='ota_admin')||{}).id||null;
  if(!S.admin&&side==='ota'){S.actor=S.ui.lastPartnerActor||(users().find(u=>u.role==='p_admin')||{}).id||null;}
  audit(S.admin?'ota.mode.on':'ota.mode.off','',{});toast(v?t('c.adminOn'):t('c.adminOff'));rerender();},
 setActor(id){setActor(id);const a=actor();if(a&&ROLES[a.role].side==='partner')S.ui.lastPartnerActor=a.id;toast(t('c.actingNow',{r:esc(roleName(a.role)),n:esc(a.name)}));rerender();},
 nav(h){location.hash=h;},
 copy(txt){copyText(txt);},
 tick(){tick(60);rerender();},
});

/* ---------- core strings ---------- */
I18N.add({
uk:{'c.lg.search':'Пошук: назва мови або код','c.lg.none':'Нічого не знайдено','c.lg.loading':'Завантажуємо мову…','c.lg.fail':'Не вдалося завантажити мову. Перевірте з’єднання.','c.lg.count':'Мов інтерфейсу: {n}','c.lg.g.main':'Основні','c.lg.g.eu':'Європейський Союз','c.lg.g.eur':'Інші країни Європи','c.lg.g.asia':'Кавказ і Центральна Азія','c.keyItem':'Ключ активації','c.monthsShort':'міс.','c.actingAs':'Діяти як (демо-користувач)','c.actingNow':'Тепер ви: {r} · {n}','c.role.ota_admin':'OTA Admin','c.role.ota_legal':'OTA Legal','c.role.ota_finance':'OTA Finance','c.role.p_admin':'Адмін партнера','c.role.p_sign':'Підписант партнера','c.role.p_ops':'Операції партнера','c.noPerm':'Ваша роль ({r}) не може це зробити. Перемкніть користувача або попросіть колегу.','c.program':'CONNECT ДЛЯ БРЕНДІВ','c.copyright':'© {y} {p} — усі права належать OTA TECHNOLOGY DMCC','c.simItem':'SIM-карта (на зберігання)','c.console':'Консоль партнера','c.menu':'Меню','c.language':'Мова','c.close':'Закрити','c.cancel':'Скасувати','c.save':'Зберегти','c.saved':'Збережено','c.create':'Створити','c.delete':'Видалити','c.edit':'Змінити','c.back':'Назад','c.next':'Далі','c.prev':'Назад','c.of':'з','c.nothing':'Нічого не знайдено','c.copied':'Скопійовано','c.copyFail':'Не вдалося скопіювати — виділіть текст вручну','c.adminMode':'Режим OTA (демо)','c.adminHint':'Дії команди OTA: ціни по країнах, оплати, відвантаження SIM, затвердження моделей','c.adminOn':'Режим OTA увімкнено','c.adminOff':'Режим OTA вимкнено','c.monthly':'щомісяця','c.year1':'рік','c.year2':'роки','c.year5':'років','c.search':'Пошук','c.all':'Усі','c.status':'Статус','c.date':'Дата','c.qty':'Кількість','c.total':'Разом','c.actions':'Дії','c.required':'Обов’язкове поле','c.optional':'за бажанням','c.yes':'Так','c.no':'Ні','c.confirm':'Підтвердити','c.download':'Завантажити','c.uah':'Гривня','c.usd':'Долари США'},
en:{'c.lg.search':'Search: language name or code','c.lg.none':'Nothing found','c.lg.loading':'Loading language…','c.lg.fail':'Couldn’t load the language. Check your connection.','c.lg.count':'Interface languages: {n}','c.lg.g.main':'Main','c.lg.g.eu':'European Union','c.lg.g.eur':'Other European countries','c.lg.g.asia':'Caucasus and Central Asia','c.keyItem':'Activation Key','c.monthsShort':'mo','c.actingAs':'Act as (demo user)','c.actingNow':'You are now: {r} · {n}','c.role.ota_admin':'OTA Admin','c.role.ota_legal':'OTA Legal','c.role.ota_finance':'OTA Finance','c.role.p_admin':'Partner Admin','c.role.p_sign':'Partner Signatory','c.role.p_ops':'Partner Operations','c.noPerm':'Your role ({r}) can’t do this. Switch user or ask a colleague.','c.program':'CONNECT FOR BRANDS','c.copyright':'© {y} {p} — all rights belong to OTA TECHNOLOGY DMCC','c.simItem':'SIM card (in custody)','c.console':'Partner console','c.menu':'Menu','c.language':'Language','c.close':'Close','c.cancel':'Cancel','c.save':'Save','c.saved':'Saved','c.create':'Create','c.delete':'Delete','c.edit':'Edit','c.back':'Back','c.next':'Next','c.prev':'Previous','c.of':'of','c.nothing':'Nothing found','c.copied':'Copied','c.copyFail':'Couldn’t copy — select the text manually','c.adminMode':'OTA mode (demo)','c.adminHint':'OTA team actions: country prices, payments, SIM shipments, model approval','c.adminOn':'OTA mode on','c.adminOff':'OTA mode off','c.monthly':'monthly','c.year1':'year','c.year2':'years','c.year5':'years','c.search':'Search','c.all':'All','c.status':'Status','c.date':'Date','c.qty':'Quantity','c.total':'Total','c.actions':'Actions','c.required':'Required','c.optional':'optional','c.yes':'Yes','c.no':'No','c.confirm':'Confirm','c.download':'Download','c.uah':'Hryvnia','c.usd':'US dollars'},
ru:{'c.lg.search':'Поиск: название языка или код','c.lg.none':'Ничего не найдено','c.lg.loading':'Загружаем язык…','c.lg.fail':'Не удалось загрузить язык. Проверьте соединение.','c.lg.count':'Языков интерфейса: {n}','c.lg.g.main':'Основные','c.lg.g.eu':'Европейский союз','c.lg.g.eur':'Другие страны Европы','c.lg.g.asia':'Кавказ и Центральная Азия','c.keyItem':'Ключ активации','c.monthsShort':'мес.','c.actingAs':'Действовать как (демо-пользователь)','c.actingNow':'Теперь вы: {r} · {n}','c.role.ota_admin':'OTA Admin','c.role.ota_legal':'OTA Legal','c.role.ota_finance':'OTA Finance','c.role.p_admin':'Админ партнёра','c.role.p_sign':'Подписант партнёра','c.role.p_ops':'Операции партнёра','c.noPerm':'Ваша роль ({r}) не может это сделать. Переключите пользователя или попросите коллегу.','c.program':'CONNECT ДЛЯ БРЕНДОВ','c.copyright':'© {y} {p} — все права принадлежат OTA TECHNOLOGY DMCC','c.simItem':'SIM-карта (на хранение)','c.console':'Консоль партнёра','c.menu':'Меню','c.language':'Язык','c.close':'Закрыть','c.cancel':'Отмена','c.save':'Сохранить','c.saved':'Сохранено','c.create':'Создать','c.delete':'Удалить','c.edit':'Изменить','c.back':'Назад','c.next':'Далее','c.prev':'Назад','c.of':'из','c.nothing':'Ничего не найдено','c.copied':'Скопировано','c.copyFail':'Не удалось скопировать — выделите текст вручную','c.adminMode':'Режим OTA (демо)','c.adminHint':'Действия команды OTA: цены по странам, оплаты, отгрузки SIM, утверждение моделей','c.adminOn':'Режим OTA включён','c.adminOff':'Режим OTA выключен','c.monthly':'ежемесячно','c.year1':'год','c.year2':'года','c.year5':'лет','c.search':'Поиск','c.all':'Все','c.status':'Статус','c.date':'Дата','c.qty':'Количество','c.total':'Итого','c.actions':'Действия','c.required':'Обязательное поле','c.optional':'необязательно','c.yes':'Да','c.no':'Нет','c.confirm':'Подтвердить','c.download':'Скачать','c.uah':'Гривна','c.usd':'Доллары США'}});
