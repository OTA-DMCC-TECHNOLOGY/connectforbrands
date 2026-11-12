(function(){
'use strict';
const T=__T__;
const LOCALE={uk:'uk-UA',ru:'ru-KZ',en:'en-GB',de:'de-DE',fr:'fr-FR',es:'es-ES',it:'it-IT',pt:'pt-PT',nl:'nl-NL',pl:'pl-PL',cs:'cs-CZ',sk:'sk-SK',hu:'hu-HU',ro:'ro-RO',bg:'bg-BG',el:'el-GR',hr:'hr-HR',sr:'sr-Cyrl-RS',sl:'sl-SI',mk:'mk-MK',sq:'sq-AL',bs:'bs-BA',lt:'lt-LT',lv:'lv-LV',et:'et-EE',fi:'fi-FI',sv:'sv-SE',da:'da-DK',nb:'nb-NO',is:'is-IS',ga:'ga-IE',mt:'mt-MT',ca:'ca-AD',tr:'tr-TR',ka:'ka-GE',hy:'hy-AM',az:'az-AZ',kk:'kk-KZ',uz:'uz-UZ',ky:'ky-KG',tg:'tg-TJ',tk:'tk-TM'};
const LANGS=Object.keys(LOCALE).filter(l=>T[l]);
const loc=()=>LOCALE[S.lang]||'en-GB';
const RD=[30,14,7,3,1];
const NOW0=new Date(2026,9,31,19,30);
const PR={std:{m:299,y:3199,y2:5699,y3:7499,y5:10799},light:{m:149,y:1599,y2:2899,y3:3799,y5:5399}};
const PLANS=[{k:'m',mo:1},{k:'y',mo:12},{k:'y2',mo:24},{k:'y3',mo:36},{k:'y5',mo:60}];
const CAT=[{type:'inverter',model:'H5',plan:'std'},{type:'tracker',model:'T2',plan:'light'},{type:'alarm',model:'A4',plan:'std'},{type:'boiler',model:'R1',plan:'light'}];
const MSG=['Viber','Telegram','WhatsApp'];
// Activation code: [country 1][partner 4][package 1][serial 5][secret 4][check 1] = 16 chars, Crockford Base32
const B32='0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CTRY={K:'UA',P:'PL',Z:'ZA',D:'DE'};const HOME='K';
/* v12: per-country retail (Direct Subscription) prices. UA keeps the legacy demo prices in UAH; Germany (Order Form 02-DE, clause 1.6 / 3.1)
   is priced in EUR, including taxes. Source order: bridge settings.countries[CC].retail → partner console S.ota.countries[CC].retail / S.retail[CC]
   → these demo defaults (fictional). Wholesale price lists (S.priceLists) are partner prices and are never shown to End Users. */
// monthly figures = the console's DE demo (CC_META.DE.month / LEGAL_DEMO_VALUES.countries.DE: Light €3.99, Standard €4.99 incl. 19 % VAT)
const PR_DE={std:{m:4.99,y:49.9,y2:89.9,y3:124.9,y5:189.9},light:{m:3.99,y:39.9,y2:72.9,y3:99.9,y5:149.9}};
const CC_DEF={DE:{currency:'EUR',retail:PR_DE,vat_rate:19,oss:true,cancel_public:true}};   // QA12: DE stays closed until the console writes ownership_v10_enabled + docs_de_published
const PKG={'1':['light',24],'2':['light',36],'3':['light',60],'4':['std',24],'5':['std',36],'6':['std',60],'7':['light',12],'8':['std',12]};
const PLN={light:'Light',std:'Standard'};
function normCode(v){return (v||'').toUpperCase().replace(/O/g,'0').replace(/[IL]/g,'1').replace(/U/g,'V').replace(/[^0-9A-Z]/g,'').split('').filter(c=>B32.includes(c)).join('');}
function luhn32(str){let f=2,sum=0;for(let i=str.length-1;i>=0;i--){let a=f*B32.indexOf(str[i]);f=f===2?1:2;a=Math.floor(a/32)+a%32;sum+=a;}return B32[(32-sum%32)%32];}
function parseCode(raw){const c=normCode(raw);if(c.length!==16)return {err:'c_len'};if(luhn32(c.slice(0,15))!==c[15])return {err:'c_bad'};
 if(!CTRY[c[0]])return {err:'c_bad'};const pk=PKG[c[5]];if(!pk)return {err:'c_bad'};return {ctry:c[0],partner:c.slice(1,5),plan:pk[0],months:pk[1],serial:c.slice(6,11)};}
function demoCode(plan){const rnd=n=>Array.from({length:n},()=>B32[Math.floor(Math.random()*32)]).join('');const body=HOME+'02N5'+(plan==='std'?'4':'1')+rnd(5)+rnd(4);return fmtCode(body+luhn32(body));}
const fmtCode=c=>c.match(/.{1,4}/g).join('-');
const termTxt=m=>{const y=m/12;return t(y===1?'p_y':'p_y'+y);};
const SELLER='+380 44 000 00 00';
const ICO={
home:'<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',bell:'<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
help:'<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',users:'<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M16 3.1a4 4 0 0 1 0 7.8M22 21a7 7 0 0 0-4-6.3"/>',
bolt:'<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',car:'<path d="M5 17h14M3 13l2-6a2 2 0 0 1 2-1.4h10A2 2 0 0 1 19 7l2 6v5a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H6v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><circle cx="7.5" cy="13.5" r="1"/><circle cx="16.5" cy="13.5" r="1"/>',
shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',flame:'<path d="M12 22a7 7 0 0 0 7-7c0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-2 2-5 5-5 8a7 7 0 0 0 7 7z"/>',
right:'<path d="m9 18 6-6-6-6"/>',left:'<path d="m15 18-6-6 6-6"/>',check:'<path d="M20 6 9 17l-5-5"/>',x:'<path d="M18 6 6 18M6 6l12 12"/>',
alert:'<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
signal:'<path d="M2 20h.01M7 20v-4M12 20v-8M17 20V8M22 4v16"/>',nosig:'<path d="M2 20h.01M7 20v-4M12 20v-8M17 20v-3M22 20v-2M3 3l18 18"/>',
card:'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',pin:'<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',plus:'<path d="M12 5v14M5 12h14"/>',
copy:'<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
phone:'<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
msg:'<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.8-.9L3 21l2-5.2A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z"/>',
sim:'<path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><rect x="8" y="11" width="8" height="7" rx="1"/>',mail:'<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/>',
power:'<path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.8 0"/>',pencil:'<path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
globe:'<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>',
flask:'<path d="M9 3h6M10 3v6L4.5 18.5A2 2 0 0 0 6.2 21.5h11.6a2 2 0 0 0 1.7-3L14 9V3"/><path d="M7 15h10"/>',
qr:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM17 17h4v4h-4M20 14h1"/>',
lock:'<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
refresh:'<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',heart:'<path d="M3 12h4l2-5 4 10 2-5h6"/>',key:'<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.3-9.3M17 6l3 3M14 9l2 2"/>'
};
const ic=(n,c='')=>`<svg class="i ${c}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICO[n]||''}</svg>`;
const LOGO='<svg width="38" height="38" viewBox="0 0 40 40" aria-hidden="true" style="flex:none"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4C5BFF"/><stop offset="1" stop-color="#1E2A9C"/></linearGradient></defs><rect width="40" height="40" rx="11" fill="url(#lg)"/><path d="M11 30 20 10l9 20" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M15.2 23.5h9.6" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/><circle cx="30.5" cy="10" r="3" fill="#7CF0C5"/></svg>';
const DEVICON={inverter:'bolt',tracker:'car',alarm:'shield',boiler:'flame'};

/* ---- State (v10). P = portal store shared by all accounts in this browser (localStorage 'cfb-portal-v10'):
   accounts (each with its own profile = legacy S fields), device records (plan/events stay with the DEVICE, so a plan moves with it on transfer),
   OTP hashes, send counters, sign-in log, rate limits. SS = per-tab session (sessionStorage): current account + in-progress flows.
   S = the current account's profile; S.lang / S.tick / S.devices are accessors (global language, demo clock, devices bound to this account). */
function fresh(){return{onboarded:false,name:'',email:'',phones:{},msgs:['Viber'],family:[],geo:false,mute:{},
 alerts:{lost:true,off:true,sim:true,move:true,pay:true},remind:[14,3],cards:[],tx:[],pay:null};}
const PKEY='cfb-portal-v10',BKEY='cfb-demo-ownership',SKEY='cfb-portal-session',IP_DEMO='198.51.100.23';
function freshP(lang){return{v:1,lang:lang||'uk',tick:0,last:null,accts:{},devs:{},otp:{},sends:{},log:[],rl:{fails:{},ip:[],blockA:{},blockIp:0,unk:{},unkIp:[],sig:{}},af:[],notes:[],purge:[]};}
// accounts and devices live in their own keys ('cfb-portal-v10:a:<id>', 'cfb-portal-v10:d:<id>') so a tab never rewrites another account's record
const LS={};const AK=PKEY+':a:',DK=PKEY+':d:';
function loadP(){let p=null;try{p=JSON.parse(localStorage.getItem(PKEY));}catch(e){}
 if(!p||p.v!==1){let lg='uk';try{const o=JSON.parse(localStorage.getItem('connect-demo-v3'));if(o&&o.lang)lg=o.lang;}catch(e){}p=freshP(lg);}
 const f=freshP();for(const k in f)if(p[k]==null)p[k]=f[k];for(const k in f.rl)if(p.rl[k]==null)p.rl[k]=f.rl[k];
 try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);const pre=k.startsWith(AK)?'accts':k.startsWith(DK)?'devs':null;if(!pre)continue;
  const v=localStorage.getItem(k);LS[k]=v;try{p[pre][k.slice(AK.length)]=JSON.parse(v);}catch(e){}}}catch(e){}
 return p;}
function clearSplit(){try{const ks=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.startsWith(AK)||k.startsWith(DK))ks.push(k);}ks.forEach(k=>{localStorage.removeItem(k);delete LS[k];});}catch(e){}}
let P=loadP();
let SS;try{SS=JSON.parse(sessionStorage.getItem(SKEY))||{};}catch(e){SS={};}
if(SS.cur===undefined)SS.cur=P.last||null;
function ssave(){try{sessionStorage.setItem(SKEY,JSON.stringify(SS));}catch(e){}}
let S;
function props(o){Object.defineProperty(o,'lang',{get:()=>P.lang,set:v=>{P.lang=v;},configurable:true,enumerable:false});
 Object.defineProperty(o,'tick',{get:()=>Math.round(((clk().offset_ms)||0)/60000),set:v=>{clockAdd((v-Math.round(((clk().offset_ms)||0)/60000))*60000);},configurable:true,enumerable:false});
 Object.defineProperty(o,'devices',{get:()=>owned(),configurable:true,enumerable:false});return o;}
function acct(){return (SS.cur&&P.accts[SS.cur])||null;}
function bindS(){const a=acct();if(a){const f=fresh();for(const k in f)if(a.prof[k]==null)a.prof[k]=f[k];S=props(a.prof);}else S=props(fresh());}
bindS();
// Several tabs share P: save() and the storage listener do a 3-way merge (base = last state this tab saw), so one tab never overwrites another tab's changes.
let lastSaved=(()=>{try{return localStorage.getItem(PKEY);}catch(e){return null;}})();
const isObj=v=>v&&typeof v==='object'&&!Array.isArray(v);
function merge3(base,mine,theirs){const J=JSON.stringify;base=base||{};
 new Set(Object.keys(mine).concat(Object.keys(theirs))).forEach(k=>{const b=base[k],m=mine[k],t=theirs[k];
  if(J(m)===J(b)){if(t===undefined)delete mine[k];else mine[k]=t;}
  else if(J(t)===J(b)){}
  else if(isObj(m)&&isObj(t))merge3(isObj(b)?b:{},m,t);
  else if(Array.isArray(m)&&Array.isArray(t)){const seen=new Set(m.map(x=>J(x)));t.forEach(x=>{if(!seen.has(J(x)))m.push(x);});}});
 return mine;}
function restOf(o){const r=Object.assign({},o);delete r.accts;delete r.devs;return r;}
function save(){try{
 const W=(k,o)=>{const j=JSON.stringify(o);if(LS[k]===j)return;LS[k]=j;localStorage.setItem(k,j);};
 for(const id in P.accts)W(AK+id,P.accts[id]);for(const id in P.devs)W(DK+id,P.devs[id]);
 const cur=localStorage.getItem(PKEY);const r=restOf(P);
 if(cur&&cur!==lastSaved){const th=restOf(JSON.parse(cur));merge3(lastSaved?restOf(JSON.parse(lastSaved)):{},r,th);Object.assign(P,r);}
 const j=JSON.stringify(Object.assign({},r,{accts:{},devs:{}}));if(j===cur){lastSaved=j;return;}lastSaved=j;localStorage.setItem(PKEY,j);}catch(e){}}   // write only on change (no storage-event ping-pong)

function t(k,v){let s=(T[S.lang]&&T[S.lang][k]);if(s==null)s=T.uk[k];if(s==null)s=k;if(v)for(const a in v)s=s.split('{'+a+'}').join(v[a]);return s;}
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function pf(n,k){const f=(T[S.lang]&&T[S.lang].day_forms)||T.en.day_forms;let c='other';try{c=new Intl.PluralRules(loc()).select(n);}catch(e){}return f[c]||f.other;}
const NB=' ';
const r2=n=>Math.round(n*100)/100;
// money(n, currency): UAH keeps the legacy "1 234 грн" look; other currencies (EUR for Germany) use the locale's currency format with cents
function money(n,cur){cur=cur||'UAH';if(cur==='UAH')return new Intl.NumberFormat(loc()).format(n).replace(/\s/g,NB)+NB+t('cur');
 try{return new Intl.NumberFormat(loc(),{style:'currency',currency:cur,minimumFractionDigits:2,maximumFractionDigits:2}).format(n).replace(/\s/g,NB);}catch(e){return (+n).toFixed(2)+NB+cur;}}
const pad=n=>String(n).padStart(2,'0');
// shared demo clock in the bridge (same for /partner and /portal): demoNow = demo0 + (real now − real0) + offset_ms
function clk(){const b=B();return b.clock;}
const nowMs=()=>{const c=clk();return c.demo0+(Date.now()-c.real0)+(c.offset_ms||0);};
let clkQ=0;
function clockAdd(ms){if(!ms)return;const c=clk();c.offset_ms=(c.offset_ms||0)+ms;clkQ+=ms;const d0=clkQ;
 Promise.resolve().then(()=>{if(!clkQ)return;const dd=clkQ;clkQ=0;bridgeTx(b=>{b.clock.offset_ms=(b.clock.offset_ms||0)+dd;return{};});});}
const now=()=>new Date(nowMs());
const iso=x=>`${x.getFullYear()}-${pad(x.getMonth()+1)}-${pad(x.getDate())}`;
const isoT=x=>iso(x)+`T${pad(x.getHours())}:${pad(x.getMinutes())}`;
function d(s){const [a,b]=s.split('T');const [y,m,dd]=a.split('-').map(Number);const [h,mi]=(b||'12:00').split(':').map(Number);return new Date(y,m-1,dd,h,mi);}
function addMonths(s,m){const x=d(s);const day=x.getDate();const r=new Date(x.getFullYear(),x.getMonth()+m,1,12);const last=new Date(r.getFullYear(),r.getMonth()+1,0).getDate();r.setDate(Math.min(day,last));return iso(r);}
const fdate=s=>d(s).toLocaleDateString(loc(),{day:'numeric',month:'long',year:'numeric'}).replace(/\s?р\.$/,'');
const ftime=s=>d(s).toLocaleTimeString(loc(),{hour:'2-digit',minute:'2-digit'});
function fwhen(s){const x=d(s);const a=now();a.setHours(0,0,0,0);const b=new Date(x);b.setHours(0,0,0,0);const diff=Math.round((a-b)/864e5);
 if(diff===0)return t('today')+', '+ftime(s);if(diff===1)return t('yesterday')+', '+ftime(s);return x.toLocaleDateString(loc(),{day:'numeric',month:'long'})+', '+ftime(s);}
const days=s=>Math.ceil((d(s)-now())/864e5);
const today=()=>iso(now());
const dev=id=>S.devices.find(x=>x.id===id);   // only devices currently bound to this account
const dname=x=>x.custom||`${t('typ_'+x.type)} ${x.model}`;
const paidThrough=x=>x.mode==='sub'?x.next:x.mode==='pkg'?x.paidUntil:null;
function attn(x){if(x.moved)return 'move';if(x.status==='off')return 'off';if(x.mode==='none')return 'none';if(x.mode==='pkg'&&days(x.paidUntil)<=30)return 'soon';return null;}
const sev=x=>({move:4,off:3,none:2,soon:1}[attn(x)]||0);
function greet(){const h=now().getHours();return h<12?t('morning'):h<18?t('day'):t('evening');}
const digits=s=>(s||'').replace(/\D/g,'');
function chans(){const c=[];if(!S.mute.email)c.push(t('a_mail'));S.msgs.forEach(m=>{if(!S.mute[m])c.push(m);});S.family.forEach(m=>{if(!m.off)c.push(m.name||t('fam_row'));});return c;}
function chanCount(){return chans().length;}
const alertsOn=()=>Object.values(S.alerts).some(Boolean);
function fmtPhone(l){return '+380 '+l.replace(/(\d{2})(\d{3})(\d{2})(\d{2})/,'$1 $2 $3 $4');}
function parsePhone(v){const p=digits(v);const l=p.startsWith('380')?p.slice(3):p.startsWith('0')?p.slice(1):p;return l.length===9?l:null;}
const validEmail=e=>/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
/* ======================= v10 ownership (ТЗ v10 part 4; Document 07 section 3 and clause 4.1) =======================
   Demo bridge shared with the partner console (same origin): localStorage 'cfb-demo-ownership' =
   {sims:{ICCID:{partner,status:'issued'|'deactivated',imei,model?,cc?}}, bindings:[], transfers:[], codes:{CODE:{serial,status,device_id,...}},
    events:[], links:[] (installer-started bindings), partner_users:[{email,phone,role}] (for T12), requests:[] (ownership requests, T11),
    settings:{countries:{CC:{delay_hours}}}, t12_overrides:[]}. Every write goes through bridgeTx(): an exclusive cross-tab lock
   (Web Locks API, localStorage mutex fallback) around read → check → write, so "one active binding per ICCID" is an atomic check-and-set. */
const MIN=6e4,HOUR=36e5,DAY=864e5,OTP_TTL=10*MIN,OTP_TRIES=5,OTP_GAP=60e3,OTP_PER_H=5,OPEN_TR=['pending_acceptance','cooling_off'];
const MODEL_TYPE={H5:'inverter',T2:'tracker',A4:'alarm',R1:'boiler'},MODEL_PLAN={H5:'std',T2:'light',A4:'std',R1:'light'},MODELS=['H5','T2','A4','R1'];
const uid=p=>p+'_'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const tok=()=>{const a=new Uint8Array(12);crypto.getRandomValues(a);return [...a].map(b=>B32[b%32]).join('');};
const isoMs=ms=>new Date(ms).toISOString();const isoNow=()=>isoMs(nowMs());
const floorMin=ms=>Math.floor(ms/MIN)*MIN;
const evMs=ts=>d(ts).getTime();
function fdt(ms){const x=new Date(ms);return x.toLocaleDateString(loc(),{day:'numeric',month:'long'})+', '+x.toLocaleTimeString(loc(),{hour:'2-digit',minute:'2-digit'});}
function luhnOk(s){let sum=0,alt=false;for(let i=s.length-1;i>=0;i--){let n=+s[i];if(alt){n*=2;if(n>9)n-=9;}sum+=n;alt=!alt;}return sum%10===0;}
function luhnDigit(body){for(let c=0;c<10;c++)if(luhnOk(body+c))return String(c);return '0';}
const genIccid=n=>{const b='89380012'+String(n).padStart(10,'0');return b+luhnDigit(b);};
const genImei=n=>{const b='35'+String(840000000000+n).padStart(12,'0');return b+luhnDigit(b);};
const fmtIccid=s=>String(s).replace(/(\d{4})(?=\d)/g,'$1 ');
function mkCode(pkg,serial,secret,ctry){const body=(ctry||HOME)+'ARV1'+pkg+serial+secret;return body+luhn32(body);}
const genIccidDE=n=>{const b='89490012'+String(n).padStart(10,'0');return b+luhnDigit(b);};   // v12 Germany demo SIMs (ICCID country code 49)
function deSeed(n){const sims={},codes={};for(let i=1;i<=3;i++)sims[genIccidDE(i)]={partner:'ARV',status:'issued',imei:genImei(100+i),model:MODELS[(i-1)%4],cc:'DE',country:'DE'};
 codes[mkCode('4','00201','D4EV','D')]={serial:'00201',status:'new',device_id:null,cc:'DE'};codes[mkCode('7','00202','D7EV','D')]={serial:'00202',status:'new',device_id:null,cc:'DE'};
 codes[mkCode('8','00203','D8EV','D')]={serial:'00203',status:'new',device_id:null,cc:'DE'};return{sims,codes};}
function seedBridge(){const n=Date.now();const sims={};
 for(let i=1;i<=8;i++)sims[genIccid(i)]={partner:'ARV',status:'issued',imei:genImei(i),model:MODELS[(i-1)%4],cc:'UA'};
 {const de=deSeed();Object.assign(sims,de.sims);}
 sims[genIccid(9)]={partner:'ARV',status:'deactivated',imei:genImei(9),model:'T2',cc:'UA'};
 sims[genIccid(10)]={partner:null,status:'stock',imei:null,model:'H5',cc:'UA'};
 for(let i=21;i<=24;i++)sims[genIccid(i)]={partner:'ARV',status:'issued',imei:genImei(i),model:MODELS[i-21],cc:'UA',demo:'history'};
 const codes={};const c=(pkg,ser,sec,o)=>{codes[mkCode(pkg,ser,sec)]=Object.assign({serial:ser,status:'new',device_id:null,cc:'UA'},o||{});};
 c('4','00101','K7PQ');c('7','00102','M2XR');c('8','00103','T9WZ');c('1','00104','H3NV');
 c('4','00105','B8DS',{status:'redeemed',device_id:genImei(23),iccid:genIccid(23),redeemed_at:isoMs(n-300*DAY),redeemed_by_account_id:'acc_demo_previous'});
 c('4','00106','Q4FJ',{status:'blocked',blocked_at:isoMs(n-2*DAY)});
 c('7','00107','Y6GC',{expires_at:isoMs(n-DAY)});
 Object.assign(codes,deSeed().codes);
 return{sims,bindings:[],transfers:[],codes,events:[],requests:[],t12_overrides:[],cancellations:[],
  links:[],accounts:{},notices:[],t12Exempt:[],
  bindLinks:[{token:'DEMOLINK0001',iccid:genIccid(5),contact:'buyer@example.com',contact_norm:'e:buyer@example.com',created_at:isoMs(n),expires_at:isoMs(n+72*HOUR),status:'pending',created_by:'Demo Installer'},
   {token:'DEMOLINK0002',iccid:genIccid(6),contact:'late@example.com',contact_norm:'e:late@example.com',created_at:isoMs(n-80*HOUR),expires_at:isoMs(n-8*HOUR),status:'pending',created_by:'Demo Installer'}],
  partnerContacts:[{partner:'ARV',user_id:'u_demo_dealer',role:'dealer',contact:'e:dealer@arvelo.demo'},{partner:'ARV',user_id:'u_demo_dealer',role:'dealer',contact:'p:670000001'},
   {partner:'ARV',user_id:'u_demo_inst',role:'installer',contact:'e:installer@arvelo.demo'},{partner:'ARV',user_id:'u_demo_inst',role:'installer',contact:'p:670000002'}],
  partner_users:[{name:'Demo Dealer',email:'dealer@arvelo.demo',phone:'+380670000001',role:'dealer'},{name:'Demo Installer',email:'installer@arvelo.demo',phone:'+380670000002',role:'installer'}],
  settings:{},seeded_by:'portal',rev:1};}
function normBridge(b){['bindings','transfers','events','links','bindLinks','partner_users','partnerContacts','t12Exempt','requests','notices','t12_overrides','cancellations'].forEach(k=>{if(!Array.isArray(b[k]))b[k]=[];});
 if(!b.codes||typeof b.codes!=='object')b.codes={};
 let chc=false;if(!b.clock||typeof b.clock!=='object'||!isFinite(b.clock.demo0)||!isFinite(b.clock.real0)){const n=Date.now();b.clock={demo0:n,real0:n,offset_ms:0,created_by:'portal'};chc=true;}
 if(!isFinite(b.clock.offset_ms))b.clock.offset_ms=0;if(!b.settings||typeof b.settings!=='object')b.settings={};if(!b.accounts||typeof b.accounts!=='object')b.accounts={};if(!b.settings.countries)b.settings.countries={};
 // the portal must work even if the partner console seeded SIMs the portal cannot bind (e.g. no Luhn digit): top up a small demo pool
 const ok=Object.keys(b.sims).filter(i=>/^\d{19,20}$/.test(i)&&luhnOk(i)&&b.sims[i].status==='issued'&&!b.sims[i].demo);
 let ch=false;if(ok.length<3){const s=seedBridge();Object.keys(s.sims).forEach(i=>{if(!b.sims[i]){b.sims[i]=Object.assign(s.sims[i],{src:'portal-demo'});ch=true;}});
  Object.keys(s.codes).forEach(k=>{if(!b.codes[k]){b.codes[k]=s.codes[k];ch=true;}});if(!b.partner_users.length){b.partner_users=s.partner_users;ch=true;}}
 // v12: Germany is a demo country — if neither app has seeded bindable DE SIMs yet, add the portal's own small DE pool (+ DE package codes)
 if(!Object.keys(b.sims).some(i=>simCc(b.sims[i])==='DE'&&/^\d{19,20}$/.test(i)&&luhnOk(i)&&b.sims[i].status==='issued'&&b.sims[i].partner)){const de=deSeed();
  Object.keys(de.sims).forEach(i=>{if(!b.sims[i]){b.sims[i]=Object.assign(de.sims[i],{src:'portal-demo'});ch=true;}});Object.keys(de.codes).forEach(k=>{if(!b.codes[k]){b.codes[k]=Object.assign(de.codes[k],{src:'portal-demo'});ch=true;}});}
 return ch||chc;}
function readBridge(){let b=null;try{b=JSON.parse(localStorage.getItem(BKEY));}catch(e){}
 let ch=false;if(!b||typeof b!=='object'||!b.sims||typeof b.sims!=='object'){b=seedBridge();ch=true;}
 if(normBridge(b))ch=true;if(ch){try{localStorage.setItem(BKEY,JSON.stringify(b));}catch(e){}}return b;}
let BC=null;const B=()=>BC||(BC=readBridge());
function lsLock(fn){const LK=BKEY+'-lock',me=uid('l');
 return new Promise((res,rej)=>{const tryIt=()=>{let cur=null;try{cur=JSON.parse(localStorage.getItem(LK));}catch(e){}
  if(cur&&cur.exp>Date.now()){setTimeout(tryIt,10+Math.random()*30);return;}
  localStorage.setItem(LK,JSON.stringify({id:me,exp:Date.now()+3000}));
  setTimeout(()=>{let c2=null;try{c2=JSON.parse(localStorage.getItem(LK));}catch(e){}
   if(!c2||c2.id!==me){setTimeout(tryIt,10+Math.random()*30);return;}
   try{res(fn());}catch(e){rej(e);}finally{try{if((JSON.parse(localStorage.getItem(LK))||{}).id===me)localStorage.removeItem(LK);}catch(e){}}},30);};tryIt();});}
function withLock(fn){if(navigator.locks&&navigator.locks.request)return navigator.locks.request(BKEY,{mode:'exclusive'},()=>fn());return lsLock(fn);}
function bridgeTx(fn){return Promise.resolve(withLock(()=>{const b=readBridge();const r=fn(b)||{};
 if(r.write!==false){b.rev=(b.rev||0)+1;b.updated_at=isoNow();localStorage.setItem(BKEY,JSON.stringify(b));}BC=b;return r.res;}));}
function bEvent(type,bd,extra){const s=(B().sims||{})[bd.iccid]||{};return Object.assign({id:uid('ev'),type,at:isoNow(),iccid:bd.iccid,imei:s.imei||null,device_id:bd.device_id,partner:bd.partner_id||s.partner||null,by:'portal'},extra||{});}
/* ---- contacts & accounts ---- */
function normContact(v){v=String(v||'').trim();if(!v)return null;if(v.includes('@'))return validEmail(v)?{k:'e',v:v.toLowerCase()}:null;
 if(/[^\d\s+()\-.]/.test(v))return null;let dg=digits(v);if(!v.startsWith('+')&&dg.startsWith('0')&&dg.length===10)dg='380'+dg.slice(1);
 if(dg.length<10||dg.length>15)return null;return{k:'p',v:'+'+dg};}
const cKey=c=>c.k+':'+c.v;
function parseKey(k){k=String(k||'');if(/^e:/.test(k))return{k:'e',v:k.slice(2).toLowerCase()};if(/^p:/.test(k)){const v=k.slice(2);const dg=digits(v);return{k:'p',v:dg.length===9?'+380'+dg:'+'+dg};}return normContact(k);}
const cmpKey=c=>c?(c.k==='e'?'e:'+c.v:'p:'+c.v.replace(/\D/g,'').slice(-9)):'';   // partner console normalisation: e:+lowercase email, p:+last 9 digits
function cShow(c){if(!c)return '';if(c.k==='e')return c.v;const dg=c.v.slice(1);return dg.startsWith('380')&&dg.length===12?fmtPhone(dg.slice(3)):'+'+dg;}
function findAcct(c){return Object.values(P.accts).find(a=>c.k==='e'?a.email===c.v:a.phone===c.v)||null;}
const acctKeys=a=>[a.email&&'e:'+a.email,a.phone&&'p:'+a.phone].filter(Boolean);
const primary=a=>a.email?{k:'e',v:a.email}:{k:'p',v:a.phone};
function login(c){let a=findAcct(c);if(!a){const prof=fresh();if(c.k==='e')prof.email=c.v;if(c.k==='p'&&/^\+380\d{9}$/.test(c.v))prof.phones={Viber:fmtPhone(c.v.slice(4))};a={id:uid('acc'),email:c.k==='e'?c.v:null,phone:c.k==='p'?c.v:null,created:isoNow(),prof};P.accts[a.id]=a;}
 SS.cur=a.id;P.last=a.id;ssave();bindS();save();syncAcct(a);return a;}
function partnerKeys(){const set=new Set();const add=(...v)=>v.forEach(x=>{const c=x&&normContact(x);if(c)set.add(cmpKey(c));});
 B().partnerContacts.forEach(pc=>{const c=parseKey(pc.contact);if(c)set.add(cmpKey(c));});
 B().partner_users.forEach(u=>add(u.email,u.phone));
 try{const ps=JSON.parse(localStorage.getItem('cfb-partner-v3'));if(ps){(ps.users||[]).forEach(u=>add(u.email,u.phone));if(ps.user)add(ps.user.email,ps.user.phone);if(ps.org)add(ps.org.signatoryEmail,ps.org.opsEmail);}}catch(e){}
 return set;}
function isT12(a){const mine=acctKeys(a).map(k=>cmpKey(parseKey(k)));const ex=[].concat(B().t12_overrides||[],B().t12Exempt||[]).map(e=>typeof e==='string'?e:(e&&(e.contact||e.account_id))||'');
 if(ex.includes(a.id)||ex.some(e=>{const c=parseKey(e);return c&&mine.includes(cmpKey(c));}))return false;const s=partnerKeys();return mine.some(k=>s.has(k));}
function syncAcct(a){if(!a)return;bridgeTx(b=>{b.accounts[a.id]={name:a.prof.name||'',email:a.email||null,phone:a.phone||null};return{};});}
/* ---- notifications (demo: shown as a push, kept in an outbox) ---- */
function notify(c,text){if(!c)return;P.notes.unshift({to:cShow(c),text,at:isoNow()});P.notes=P.notes.slice(0,60);save();
 const a=acct();if(a&&acctKeys(a).includes(cKey(c)))push(text);else push(text,(c.k==='e'?t('a_mail'):'SMS')+' → '+cShow(c));}
/* ---- OTP (ТЗ 4.2): 6 digits, 10 min, 5 attempts, resend after 60 s, ≤5 sends/hour/contact; only a salted SHA-256 hash is stored ---- */
const hex=buf=>[...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
function sha256js(str){const K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
 const m=[...new TextEncoder().encode(str)];const l=m.length*8;m.push(0x80);while(m.length%64!==56)m.push(0);for(let i=7;i>=0;i--)m.push(i>3?0:(l>>>(i*8))&255);
 let H=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];const r=(x,n)=>(x>>>n)|(x<<(32-n));
 for(let o=0;o<m.length;o+=64){const w=[];for(let i=0;i<16;i++)w[i]=(m[o+i*4]<<24)|(m[o+i*4+1]<<16)|(m[o+i*4+2]<<8)|m[o+i*4+3];
  for(let i=16;i<64;i++){const s0=r(w[i-15],7)^r(w[i-15],18)^(w[i-15]>>>3),s1=r(w[i-2],17)^r(w[i-2],19)^(w[i-2]>>>10);w[i]=(w[i-16]+s0+w[i-7]+s1)|0;}
  let [a,b,c,dd,e,f,g,h]=H;for(let i=0;i<64;i++){const t1=(h+(r(e,6)^r(e,11)^r(e,25))+((e&f)^(~e&g))+K[i]+w[i])|0,t2=((r(a,2)^r(a,13)^r(a,22))+((a&b)^(a&c)^(b&c)))|0;h=g;g=f;f=e;e=(dd+t1)|0;dd=c;c=b;b=a;a=(t1+t2)|0;}
  H=H.map((x,i)=>(x+[a,b,c,dd,e,f,g,h][i])|0);}
 return H.map(x=>(x>>>0).toString(16).padStart(8,'0')).join('');}
async function sha256(s){try{if(window.crypto&&crypto.subtle)return hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));}catch(e){}return sha256js(s);}
function rnd6(){const a=new Uint32Array(1);crypto.getRandomValues(a);return String(a[0]%1e6).padStart(6,'0');}
function logIn(ck,purpose,result){P.log.unshift({contact:cShow(parseKey(ck)),key:ck,at:isoNow(),ip:IP_DEMO,purpose,result});}
function otpGc(){const n=nowMs();Object.keys(P.otp).forEach(k=>{if(P.otp[k].exp<=n)delete P.otp[k];});
 Object.keys(P.sends).forEach(k=>{P.sends[k]=P.sends[k].filter(x=>x>n-HOUR);if(!P.sends[k].length)delete P.sends[k];});
 P.log=P.log.filter(e=>Date.parse(e.at)>n-365*DAY).slice(0,500);}   // sign-in log kept 12 months (ТЗ 4.10); codes are never kept
function otpWait(ck){const n=nowMs();const s=(P.sends[ck]||[]).filter(x=>x>n-HOUR);if(s.length>=OTP_PER_H)return{limit:s[0]+HOUR};const last=s[s.length-1];if(last&&n-last<OTP_GAP)return{gap:last+OTP_GAP};return null;}
async function otpSend(ck,purpose){otpGc();const w=otpWait(ck);if(w){logIn(ck,purpose,w.limit?'rate_limited':'too_soon');save();return w;}
 const code=rnd6();const salt=tok();const h=await sha256(salt+'|'+ck+'|'+code);
 P.otp[ck]={h,salt,p:purpose,exp:nowMs()+OTP_TTL,tries:0};(P.sends[ck]=P.sends[ck]||[]).push(nowMs());logIn(ck,purpose,'sent');save();
 toast(t('otp_demo',{code}),12000);return{ok:true};}
async function otpCheck(ck,purpose,code){otpGc();const r=P.otp[ck];if(!r||r.p!==purpose){logIn(ck,purpose,'expired');save();return{dead:true};}
 const h=await sha256(r.salt+'|'+ck+'|'+code);if(h===r.h){delete P.otp[ck];logIn(ck,purpose,'ok');save();return{ok:true};}
 r.tries++;if(r.tries>=OTP_TRIES){delete P.otp[ck];logIn(ck,purpose,'too_many');save();return{dead:true};}
 logIn(ck,purpose,'wrong');save();return{left:OTP_TRIES-r.tries};}
async function startFlow(p,c,data,back){const ck=cKey(c);const r=await otpSend(ck,p);
 SS.flow={p,ck,data:data||{},back:back||'home',notSent:!r.ok,err:r.limit?t('otp_limit',{t:fdt(r.limit)}):null};ssave();go('otp');}
/* ---- rate limits & anti-fraud (ТЗ 4.3.5): 5 failed/account/hour or 20/IP/day → 24 h block; ≥10 different unknown ICCIDs/day → signal ---- */
function signal(reason,extra){const e=Object.assign({id:uid('af'),reason,at:isoNow(),ip:IP_DEMO,account_id:SS.cur||null},extra||{});P.af.unshift(e);
 bridgeTx(b=>{b.events.push(Object.assign({type:'antifraud'},e,{by:'portal'}));return{};});}
function blockedUntil(aid){const n=nowMs(),R=P.rl;return Math.max(R.blockA[aid]>n?R.blockA[aid]:0,R.blockIp>n?R.blockIp:0);}
function fail(aid,unknownIccid){const n=nowMs(),R=P.rl;(R.fails[aid]=R.fails[aid]||[]).push(n);R.fails[aid]=R.fails[aid].filter(x=>x>n-DAY);R.ip.push(n);R.ip=R.ip.filter(x=>x>n-DAY);
 if(R.fails[aid].filter(x=>x>n-HOUR).length>=5&&!(R.blockA[aid]>n)){R.blockA[aid]=n+DAY;signal('account_blocked_24h',{failed_last_hour:5});}
 if(R.ip.length>=20&&!(R.blockIp>n)){R.blockIp=n+DAY;signal('ip_blocked_24h',{failed_last_day:R.ip.length});}
 if(unknownIccid){const u=(R.unk[aid]=(R.unk[aid]||[]).filter(e=>e[0]>n-DAY));if(!u.some(e=>e[1]===unknownIccid))u.push([n,unknownIccid]);
  R.unkIp=(R.unkIp||[]).filter(e=>e[0]>n-DAY);if(!R.unkIp.some(e=>e[1]===unknownIccid))R.unkIp.push([n,unknownIccid]);
  const day=iso(now());if((u.length>=10||R.unkIp.length>=10)&&R.sig['enum:'+aid]!==day){R.sig['enum:'+aid]=day;signal('iccid_enumeration',{distinct_unknown_iccids:Math.max(u.length,R.unkIp.length)});}}
 save();}
/* ---- devices & bindings ---- */
const devIdOf=(iccid,b)=>{const s=(b||B()).sims[iccid];return (s&&s.imei)||'d-'+iccid;};   // device_id = IMEI, as in the partner console
function consoleModelPlan(name){try{const ps=JSON.parse(localStorage.getItem('cfb-partner-v3'));let hit=null;
 const walk=o=>{if(hit||!o||typeof o!=='object')return;if(!Array.isArray(o)&&o.name===name&&(o.plan==='std'||o.plan==='light'))hit=o.plan;else Object.values(o).forEach(walk);};walk(ps&&ps.catalog);if(!hit)walk(ps);return hit;}catch(e){return null;}}
function modelInfo(s,iccid){const m=s.model;if(MODEL_TYPE[m])return{type:MODEL_TYPE[m],model:m,plan:MODEL_PLAN[m]};
 if(m){const nm=String(m),short=nm.replace(/^ARVELO\s+/i,'');const ty=/track|gps|T\d/i.test(nm)?'tracker':/alarm|A\d/i.test(nm)?'alarm':/boiler|R\d/i.test(nm)?'boiler':'inverter';
  const pl=(s.plan==='std'||s.plan==='light')?s.plan:consoleModelPlan(nm)||(ty==='tracker'||ty==='boiler'?'light':'std');return{type:ty,model:short,plan:pl};}
 const k=MODELS[parseInt(iccid.slice(-4),10)%4];return{type:MODEL_TYPE[k],model:k,plan:MODEL_PLAN[k]};}
function consolePlan(x){const b=B();const n=nowMs();   // a plan already attached in the console (code redeemed there, recorded by IMEI/ICCID)
 Object.entries(b.codes).forEach(([k,r])=>{if(r.status!=='redeemed'||!r.redeemed_at)return;if(!(r.device_id===x.id||(x.imei&&r.device_id===x.imei)||r.iccid===x.iccid))return;
  const ser=r.serial||normCode(k).slice(6,11);if((x.codes||[]).some(c=>c.serial===ser))return;const pl=codePlan(normCode(k),r);if(!pl)return;
  const until=addMonths(iso(new Date(Date.parse(r.redeemed_at))),pl.months);(x.codes=x.codes||[]).push({serial:ser,at:r.redeemed_at,src:'console'});
  if(!x.paidUntil||x.paidUntil<until){x.paidUntil=until;if(x.mode!=='sub')x.mode='pkg';}});}
function vatLocal(cc){const b=B();let v=((b.settings.countries||{})[cc]||{}).vat_local;
 if(!v){try{const ps=JSON.parse(localStorage.getItem('cfb-partner-v3'));v=ps&&ps.ota&&ps.ota.countries&&ps.ota.countries[cc]&&ps.ota.countries[cc].vat_local;}catch(e){}}return v?String(v).trim():'';}
const simCc=s=>(s&&(s.cc||s.country))||'UA';
const devCc=x=>simCc(B().sims[x.iccid]);
/* ---- v12 country settings: bridge settings.countries[CC] (OTA demo / console mirror) → partner console S.ota.countries[CC] (contract: currency, oss_no)
   → demo defaults (CC_DEF). DE: EUR, German VAT under the EU OSS with OTA as seller (02-DE cl. 1.6), § 312k BGB cancellation button without login. */
function psState(){try{return JSON.parse(localStorage.getItem('cfb-partner-v3'))||null;}catch(e){return null;}}
function ccCfg(cc){const b=((B().settings||{}).countries||{})[cc]||{};const ps=psState();const p=(ps&&ps.ota&&ps.ota.countries&&ps.ota.countries[cc])||{};const d=CC_DEF[cc]||{};
 const has=v=>v!=null&&v!=='';const pick=k=>has(b[k])?b[k]:has(p[k])?p[k]:d[k];
 const psRet=ps&&ps.retail&&ps.retail[cc];
 return{currency:pick('currency')||null,retail_currency:pick('retail_currency')||null,retail:(has(b.retail)&&b.retail)||(has(p.retail)&&p.retail)||psRet||d.retail||null,
  vat_rate:+pick('vat_rate')||0,oss:!!pick('oss')||String(pick('currency')||'')==='EUR',oss_no:String(pick('oss_no')||'').trim(),
  cancel_public:pick('cancel_public')!=null?!!pick('cancel_public'):false,docs_de_published:pick('docs_de_published')===true,ownership_v10_enabled:pick('ownership_v10_enabled'),written:Object.keys(b).length>0||Object.keys(p).length>0};}
/* QA12: a country is open for binding only when the console's launch flag ownership_v10_enabled === true; DE also needs docs_de_published === true
   (02-DE cl. 1.6). Standalone (console wrote nothing for the country): DE closed, other countries open so the portal still works alone. */
function ccOpen(cc){const c=ccCfg(cc);if(cc==='DE')return c.ownership_v10_enabled===true&&c.docs_de_published;if(c.ownership_v10_enabled==null)return true;return c.ownership_v10_enabled===true;}
// country of a package code: the bridge record's cc (written by the console / ownership agent); letter guess only for portal-seeded codes without cc
function codeCc(k,rec){if(rec&&(rec.cc||rec.country))return rec.cc||rec.country;const c=normCode(k);return c.slice(1,5)==='ARV1'||(rec&&rec.src==='portal-demo')?CTRY[c[0]]||null:null;}
// End User (retail) currency: the Order Form currency if it is EUR (Approved Countries in Europe, MPA 8.1); otherwise the legacy local demo currency (UAH)
function retailCur(cc){const c=ccCfg(cc);return c.retail_currency||(c.currency==='EUR'?'EUR':'UAH');}
function retail(cc){const c=ccCfg(cc);const base=retailCur(cc)==='EUR'?PR_DE:PR;const r=c.retail;const out={};
 ['std','light'].forEach(pl=>{out[pl]={};PLANS.forEach(q=>{const v=r&&r[pl]&&+r[pl][q.k];out[pl][q.k]=v>0?v:base[pl][q.k];});});return out;}
const prOf=x=>retail(devCc(x));const curOf=x=>retailCur(devCc(x));const mny=(x,n)=>money(n,curOf(x));
const OTA_NAME=()=>{const ps=psState();const v=ps&&ps.ota&&ps.ota.OTA_NAME;return v&&typeof v==='string'?v:'OTA TECHNOLOGY DMCC';};
// tax info for a gross (tax-inclusive) amount: OSS countries → VAT rate + amount, seller and OSS registration no.
function taxOf(cc,gross){const c=ccCfg(cc);if(!c.oss)return null;const rate=c.vat_rate||19;return{rate,vat:r2(gross-gross/(1+rate/100)),oss_no:c.oss_no,seller:OTA_NAME(),cc};}
function ossHtml(tx,cur,tag){tag=tag||'p';const amt=tx.vat!=null?`<span data-oss-vat>${t('oss_incl',{r:tx.rate,v:money(tx.vat,cur)})}</span> `:'';
 return `<${tag} class="${tag==='p'?'muted small':'s'}" data-oss="${esc(tx.cc)}">${amt}${t('oss_seller',{s:esc(tx.seller)})}${tx.oss_no?` <span data-oss-no>${t('oss_no',{n:esc(tx.oss_no)})}</span>`:''}</${tag}>`;}
function vatLine(x,gross){if(!x)return '';const cc=devCc(x);const tx=taxOf(cc,gross||0);
 if(tx){if(!gross)tx.vat=null;return ossHtml(tx,curOf(x));}   // v12: Germany — German VAT under OSS, OTA as seller (02-DE cl. 1.6)
 const v=vatLocal(cc);return v?`<p class="muted small" data-vat="${esc(cc)}">${t('vat_local',{cc:esc(cc),v:esc(v)})}</p>`:'';}   // ТЗ 2.6: only if set, only for that country
const codePlanActive=x=>!!(x.codes&&x.codes.length&&x.mode==='pkg'&&x.paidUntil&&d(x.paidUntil)>now());
function ensureDev(iccid,boundMs){const b=B();const id=devIdOf(iccid,b);let x=P.devs[id];if(x)return x;const s=b.sims[iccid]||{};
 const mi=modelInfo(s,iccid);const bm=boundMs||nowMs();
 // history from before the binding (factory test, installer check) exists on the device but is never shown to the Owner (ТЗ 4.3.6, 4.8)
 x={id,iccid,imei:s.imei||null,type:mi.type,model:mi.model,plan:mi.plan,status:'ok',mode:'none',loc:true,start:iso(new Date(bm)),
  ev:[['ev_factory',isoT(new Date(bm-9*DAY)),'info'],['ev_install',isoT(new Date(bm-20*HOUR)),'ok']]};P.devs[id]=x;return x;}
const liveB=z=>z.status==='active'||z.status==='frozen';
function myBindings(){const a=acct();if(!a)return[];return B().bindings.filter(z=>z.owner_account_id===a.id&&liveB(z)).sort((p,q)=>p.bound_at.localeCompare(q.bound_at));}
function owned(){return myBindings().map(z=>{const x=ensureDev(z.iccid,Date.parse(z.bound_at));consolePlan(x);Object.defineProperty(x,'_b',{value:z,configurable:true,writable:true,enumerable:false});return x;});}
const bnd=x=>x&&x._b;
const frozen=x=>!!(bnd(x)&&bnd(x).status==='frozen');
const sinceMs=x=>bnd(x)?floorMin(Date.parse(bnd(x).bound_at)):Infinity;
const visEv=x=>x.ev.filter(e=>evMs(e[1])>=sinceMs(x));   // ТЗ 4.8: the Owner sees only data from bound_at
const openTr=x=>B().transfers.find(z=>z.device_id===x.id&&OPEN_TR.includes(z.status));
function delayHours(iccid,b){b=b||B();const cc=((b.sims||{})[iccid]||{}).cc||'UA';const ok=v=>Number.isInteger(+v)&&+v>=1&&+v<=24;
 let v=((b.settings.countries||{})[cc]||{}).delay_hours;if(ok(v))return +v;
 try{const ps=JSON.parse(localStorage.getItem('cfb-partner-v3'));const w=ps&&ps.ota&&ps.ota.countries&&ps.ota.countries[cc]&&ps.ota.countries[cc].delay_hours;if(ok(w))return +w;}catch(e){}
 return 24;}
function autoOff(x,aid,at){if(!x)return;if(x.mode==='sub'){x.mode='pkg';x.paidUntil=x.next;delete x.next;}delete x.auto;delete x.custom;delete x.moved;delete x.movedPin;
 x.status='ok';delete x.offAt;delete x.cause;   // the new owner must not see "not connected since …" from before their bound_at
 x.autoOffFor={account:aid,at};}
function queuePurge(devId,aid,from,to,bindingId,iccid){P.purge.push({device_id:devId,owner_account_id:aid,from,to,binding_id:bindingId||null,iccid:iccid||null,due:isoMs(Date.parse(to)+30*DAY),legal_hold:false,done:false});
 if(bindingId)bridgeTx(b=>{b.history=b.history||[];if(b.history.some(h=>h.binding_id===bindingId))return{write:false};const bd=b.bindings.find(z=>z.id===bindingId)||{};
  b.history.push({id:'hs_'+bindingId,partner_id:bd.partner_id||null,iccid:iccid||bd.iccid,binding_id:bindingId,owner_account_id:aid,from,to,state:'hidden',hidden_at:to,erase_due:isoMs(Date.parse(to)+30*DAY),erased_at:null,legal_hold:false,hold_reason:'',by:'portal'});return{};});}
function onHold(q){const b=B();if(q.legal_hold)return true;   // legal hold: history flag, frozen binding or disputed request on this SIM
 const ic=q.iccid||(P.devs[q.device_id]||{}).iccid;
 if((b.history||[]).some(h=>h.legal_hold&&((q.binding_id&&h.binding_id===q.binding_id)||(ic&&h.iccid===ic))))return true;
 if(ic&&b.bindings.some(z=>z.iccid===ic&&z.status==='frozen'))return true;
 if(ic&&b.requests.some(r=>r.iccid===ic&&(r.status==='disputed'||r.objected_at)&&r.status!=='closed'&&r.status!=='rejected'))return true;return false;}
function runPurge(){const n=nowMs();let ch=false;const er=[];P.purge.forEach(q=>{if(q.done||Date.parse(q.due)>n||onHold(q))return;const x=P.devs[q.device_id];if(q.binding_id)er.push(q.binding_id);
 if(x){const a=floorMin(Date.parse(q.from)),b=floorMin(Date.parse(q.to));x.ev=x.ev.filter(e=>{const m=evMs(e[1]);return m<a||m>=b;});}q.done=true;q.done_at=isoMs(n);ch=true;});if(ch)save();
 if(er.length)bridgeTx(b=>{let w=false;(b.history||[]).forEach(h=>{if(er.includes(h.binding_id)&&!h.erased_at&&!h.legal_hold){h.erased_at=isoMs(n);h.state='erased';w=true;}});return{write:w};});}
/* bind by ICCID (ТЗ 4.3): T3 not found / not issued / deactivated; T2 owned by another account; T4 already mine; T5 bound */
async function bindIccid(iccid,opts){opts=opts||{};const a=acct();if(!a)return{code:'T3'};
 const bu=blockedUntil(a.id);if(bu)return{code:'BLOCK',until:bu};
 if(isT12(a))return{code:'T12'};
 const r=await bridgeTx(b=>{const sim=b.sims[iccid];
  if(!sim||!sim.partner||sim.status!=='issued')return{res:{code:'T3',unknown:!sim},write:false};
  // 02-DE cl. 1.6: the portal for Germany opens only after Documents 07 and 08 with the Germany Country Schedule are published in German
  if(!ccOpen(simCc(sim)))return{res:{code:simCc(sim)==='DE'?'DEGATE':'CCGATE'},write:false};
  const cur=b.bindings.find(z=>z.iccid===iccid&&liveB(z));
  if(cur)return{res:{code:cur.owner_account_id===a.id?'T4':'T2'},write:false};
  let link=null;if(opts.link){link=findLink(b,opts.link);if(!linkOpen(link)||link.iccid!==iccid)return{res:{code:'LINK'},write:false};}
  const bd={id:uid('bnd'),iccid,device_id:devIdOf(iccid,b),owner_account_id:a.id,owner_contact:cShow(primary(a)),partner_id:sim.partner,method:opts.method||'iccid',
   bound_at:opts.boundAt||isoNow(),unbound_at:null,unbind_reason:null,status:'active',started_by_installer:link?link.token:null};
  b.bindings.push(bd);b.events.push(bEvent('device_bound',bd,{method:bd.method}));
  if(link){link.status='confirmed';link.confirmed_at=isoNow();link.account_id=a.id;link.binding_id=bd.id;}
  return{res:{code:'T5',bd}};});
 if(r.code==='T2'||r.code==='T3')fail(a.id,r.unknown?iccid:null);
 if(r.code==='T5'){const x=ensureDev(iccid,Date.parse(r.bd.bound_at));x.ev.push(['ev_bound',isoT(new Date(Date.parse(r.bd.bound_at))),'info']);save();
  notify(primary(a),t('T6',{date:fdate(today())}));}
 return r;}
/* activation codes (ТЗ 4.4): redeemed once, pinned to the device; repeated / blocked / expired / unknown → one message T7 */
function codeLookup(b,c){if(b.codes[c])return[c,b.codes[c]];const k=Object.keys(b.codes).find(k=>normCode(k)===c);return k?[k,b.codes[k]]:null;}
const codeOk=rec=>!!rec&&rec.status==='new'&&!(rec.expires_at&&Date.parse(rec.expires_at)<=nowMs());
function codePlan(c,rec){const m=rec&&(+rec.months||+rec.term);if(rec&&rec.plan&&m){const pn=String(rec.plan).toLowerCase();return{plan:pn.startsWith('st')?'std':pn.startsWith('l')?'light':pn,months:m};}const p=parseCode(c);return p.err?null:{plan:p.plan,months:p.months};}
function codeValid(raw){const c=normCode(raw);const L=codeLookup(B(),c);return !!(L&&codeOk(L[1])&&codePlan(c,L[1]));}
async function redeemCode(raw,devId){const a=acct();const c=normCode(raw);const bu=blockedUntil(a.id);if(bu)return{code:'BLOCK',until:bu};
 const x=dev(devId);if(!x)return{code:'T7'};
 const r=await bridgeTx(b=>{const L=codeLookup(b,c);const rec=L&&L[1];const pl=rec&&codePlan(c,rec);
  if(!codeOk(rec)||!pl)return{res:{code:'T7'},write:false};
  const bd=b.bindings.find(z=>z.device_id===devId&&z.owner_account_id===a.id&&liveB(z));if(!bd)return{res:{code:'T7'},write:false};
  // v12: a Germany package code (EUR, OSS) applies only to a German device and vice versa; other countries keep the v10 behaviour
  const kc=codeCc(L[0],rec);const dc=devCc(x);if(kc&&(kc==='DE'||dc==='DE')&&kc!==dc)return{res:{code:'CTRY'},write:false};
  if(pl.plan!==x.plan)return{res:{code:'TYPE',pl},write:false};
  if(codePlanActive(x))return{res:{code:'ACTIVE'},write:false};
  Object.assign(rec,{status:'redeemed',device_id:devId,iccid:bd.iccid,redeemed_at:isoNow(),redeemed_by_account_id:a.id});
  b.events.push(bEvent('code_redeemed',bd,{serial:rec.serial||c.slice(6,11)}));return{res:{code:'OK',pl,serial:rec.serial||c.slice(6,11)}};});
 if(r.code==='T7')fail(a.id);
 if(r.code==='OK'){const thru=paidThrough(x);const prepaid=!!thru&&d(thru)>now();S.tick+=1;x.paidUntil=addMonths(prepaid&&x.mode==='pkg'?thru:today(),r.pl.months);x.mode='pkg';delete x.next;
  x.ev.push(['ev_code',isoT(now()),'info']);(x.codes=x.codes||[]).push({serial:r.serial,at:isoNow()});
  addTx({dev:x.id,desc:t('c_dec',{a:PLN[r.pl.plan],term:termTxt(r.pl.months)}),sum:0,ok:true,via:'code',code:c.slice(-4)});save();}
 return r;}
/* transfers (ТЗ 4.5): pending_acceptance → cooling_off → effective, + cancelled / expired */
async function doTransfer(data){const a=acct();const x=dev(data.id);if(!x){go('home');return;}
 const r=await bridgeTx(b=>{const bd=b.bindings.find(z=>z.device_id===x.id&&z.owner_account_id===a.id&&z.status==='active');if(!bd)return{res:{err:1},write:false};
  if(b.transfers.some(z=>z.device_id===x.id&&OPEN_TR.includes(z.status)))return{res:{err:1},write:false};
  const tr={id:uid('trf'),token:tok(),binding_id:bd.id,iccid:bd.iccid,device_id:x.id,partner_id:bd.partner_id,from_account_id:a.id,from_name:S.name||'',from_contact:cKey(primary(a)),
   to_contact:data.to,to_account_id:null,status:'pending_acceptance',initiated_at:isoNow(),accept_by:isoMs(nowMs()+72*HOUR),accepted_at:null,effective_at:null,cancelled_at:null,cancelled_by:null,delay_hours:delayHours(bd.iccid,b)};
  b.transfers.push(tr);b.events.push(bEvent('transfer_initiated',bd,{transfer_id:tr.id}));return{res:{tr}};});
 SS.trf=null;ssave();if(r.err){go('device-'+x.id);toast(t('tr_open'));return;}
 x.ev.push(['ev_tr_start',isoT(now()),'info']);save();
 notify(parseKey(data.to),t('T9',{who:S.name||cShow(primary(a))}));go('device-'+x.id);toast(t('tr_sent',{c:cShow(parseKey(data.to))}));}
async function doAccept(data){const tr0=B().transfers.find(z=>z.token===data.token);if(!tr0){go('/t/'+data.token);return;}
 const a=login(parseKey(tr0.to_contact));
 if(isT12(a)){SS.acc={err:'T12'};ssave();go('/t/'+data.token);return;}
 const r=await bridgeTx(b=>{const tr=b.transfers.find(z=>z.token===data.token);const n=nowMs();
  if(!tr||tr.status!=='pending_acceptance'||Date.parse(tr.accept_by)<=n||tr.from_account_id===a.id)return{res:{err:1},write:false};
  Object.assign(tr,{status:'cooling_off',accepted_at:isoMs(n),to_account_id:a.id,effective_at:isoMs(n+tr.delay_hours*HOUR)});
  b.events.push(bEvent('transfer_accepted',{iccid:tr.iccid,device_id:tr.device_id,partner_id:tr.partner_id},{transfer_id:tr.id}));return{res:{tr}};});
 if(r.err){SS.acc={err:'exp'};ssave();go('/t/'+data.token);return;}
 const x=P.devs[r.tr.device_id];if(x){x.ev.push(['ev_tr_accepted',isoT(now()),'info']);save();}
 const msg=t('tr_cool_started',{t:fdt(Date.parse(r.tr.effective_at))});notify(parseKey(r.tr.from_contact),msg);notify(parseKey(r.tr.to_contact),msg);
 if(!S.onboarded){SS.ret='home';ssave();go('start-1');}else go('home');}
async function cancelTransfer(id){const a=acct();
 const r=await bridgeTx(b=>{const tr=b.transfers.find(z=>z.id===id);const n=nowMs();
  if(!tr||tr.from_account_id!==a.id||!OPEN_TR.includes(tr.status))return{res:null,write:false};
  if(tr.status==='cooling_off'&&Date.parse(tr.effective_at)<=n)return{res:null,write:false};
  Object.assign(tr,{status:'cancelled',cancelled_at:isoMs(n),cancelled_by:'previous_owner'});
  b.events.push(bEvent('transfer_cancelled',{iccid:tr.iccid,device_id:tr.device_id,partner_id:tr.partner_id},{transfer_id:tr.id}));return{res:tr};});
 if(!r){rerender();return;}const x=P.devs[r.device_id];if(x){x.ev.push(['ev_tr_cancel',isoT(now()),'info']);save();}
 notify(parseKey(r.from_contact),t('T10'));notify(parseKey(r.to_contact),t('T10'));rerender();}
function dueList(b){const n=nowMs();return b.transfers.filter(z=>(z.status==='pending_acceptance'&&Date.parse(z.accept_by)<=n)||
 (z.status==='cooling_off'&&Date.parse(z.effective_at)<=n&&!b.bindings.some(q=>q.id===z.binding_id&&q.status==='frozen')));}
let dueBusy=false;
async function processDue(){if(dueBusy)return false;dueBusy=true;try{
 const out=await bridgeTx(b=>{const L=dueList(b);if(!L.length)return{res:[],write:false};const o=[];
  L.forEach(tr=>{const ref={iccid:tr.iccid,device_id:tr.device_id,partner_id:tr.partner_id};
   if(tr.status==='pending_acceptance'){tr.status='expired';tr.expired_at=isoNow();b.events.push(bEvent('transfer_expired',ref,{transfer_id:tr.id}));o.push({tr,kind:'expired'});return;}
   const old=b.bindings.find(z=>z.id===tr.binding_id);
   if(!old||old.status!=='active'){Object.assign(tr,{status:'cancelled',cancelled_at:isoNow(),cancelled_by:'system'});o.push({tr,kind:'cancelled'});return;}
   // one transaction: close the old Binding, open the new one (method = transfer) from effective_at
   Object.assign(old,{status:'ended',unbound_at:tr.effective_at,unbind_reason:'transfer'});
   const toA=P.accts[tr.to_account_id];
   const nb={id:uid('bnd'),iccid:old.iccid,device_id:old.device_id,owner_account_id:tr.to_account_id,owner_contact:toA?cShow(primary(toA)):cShow(parseKey(tr.to_contact)),partner_id:old.partner_id,
    method:'transfer',bound_at:tr.effective_at,unbound_at:null,unbind_reason:null,status:'active',transfer_id:tr.id};
   b.bindings.push(nb);tr.status='effective';b.events.push(bEvent('device_transferred',nb,{transfer_id:tr.id}));o.push({tr,kind:'effective',old,nb});});
  return{res:o};});
 out.forEach(o=>{if(o.kind!=='effective')return;const x=P.devs[o.tr.device_id];
  // prepaid plan stays with the device (same end date); previous owner's auto-renewal off; previous history hidden + queued for deletion (30 days)
  autoOff(x,o.tr.from_account_id,o.tr.effective_at);if(x)x.ev.push(['ev_tr_done',isoT(new Date(Date.parse(o.tr.effective_at))),'info']);
  queuePurge(o.tr.device_id,o.tr.from_account_id,o.old.bound_at,o.tr.effective_at,o.old.id,o.old.iccid);
  notify(parseKey(o.tr.from_contact),t('tr_effective'));notify(parseKey(o.tr.to_contact),t('tr_effective'));});
 if(out.length)save();runPurge();return out.length>0;}finally{dueBusy=false;}}
async function doUnbind(data){const a=acct();const x=dev(data.id);if(!x){go('home');return;}
 const r=await bridgeTx(b=>{const bd=b.bindings.find(z=>z.device_id===x.id&&z.owner_account_id===a.id&&z.status==='active');
  if(!bd||b.transfers.some(z=>z.device_id===x.id&&OPEN_TR.includes(z.status)))return{res:null,write:false};
  Object.assign(bd,{status:'ended',unbound_at:isoNow(),unbind_reason:'owner_unbind'});b.events.push(bEvent('device_unbound',bd,{reason:'owner_unbind'}));return{res:bd};});
 if(!r){go('device-'+x.id);toast(t('tr_open'));return;}
 autoOff(x,a.id,r.unbound_at);queuePurge(x.id,a.id,r.bound_at,r.unbound_at,r.id,r.iccid);save();go('home');toast(t('ub_done'));}
const findLink=(b,tk)=>(b.bindLinks||[]).find(z=>z.token===tk)||(b.links||[]).find(z=>z.token===tk)||null;
const linkOpen=l=>!!l&&(l.status==='pending'||l.status==='open')&&Date.parse(l.expires_at)>nowMs();
const linkContact=l=>parseKey(l.contact_norm||l.contact);
async function doLink(data){const l=findLink(B(),data.token);if(!l){go('b/'+data.token);return;}
 const a=login(linkContact(l));const r=await bindIccid(l.iccid,{method:'iccid',link:l.token});
 if(r.code==='T5'){const did=devIdOf(l.iccid);SS.flash={dev:did,code:'T5'};SS.lnk=null;if(!S.onboarded){S.onboarded=true;SS.ret='device-'+did;ssave();save();go('start-1');}else{ssave();go('device-'+did);}}
 else{SS.lnk={res:r.code,until:r.until};ssave();go('b/'+data.token);}}
/* ---- v12: cancellation of subscriptions (EUT 5.1 v12; Germany: § 312k BGB, Order Form 02-DE cl. 1.6).
   Public button (no login) where the country requires it (ccCfg(cc).cancel_public, DE by default): the declaration is identified by the sign-in
   contact + SIM number (ICCID) or IMEI; it is confirmed at once (demo: message to the confirmation e-mail + notice to the account's own contact)
   with reference, time of receipt and end of service. In-account cancellation uses the same flow without the identification fields.
   Effect (EUT 5.1): renewal stops, the service continues until the end of the paid period, nothing is refunded for the current period. */
const subOf=x=>!!x&&(x.mode==='sub'||(x.mode==='pkg'&&!!x.auto));
const subEnd=x=>x.mode==='sub'?x.next:x.paidUntil;
function stopSub(x,at,ref,channel){const end=subEnd(x);if(x.mode==='sub'){x.mode='pkg';x.paidUntil=x.next;delete x.next;}delete x.auto;
 x.cancelled={at,ref,channel,end};x.ev.push(['ev_cancel',isoT(new Date(Date.parse(at))),'info']);return end;}
async function doCancel(v){const at=isoNow();const ref='CX-'+tok().slice(0,8);const b=B();let x=null,bd=null,owner=null,res='ok';
 if(v.mode==='account'){x=dev(v.dev);bd=x&&bnd(x);owner=acct();}
 else{const r=v.devref;bd=b.bindings.find(z=>liveB(z)&&(z.iccid===r||z.device_id===r||((b.sims[z.iccid]||{}).imei===r)))||null;
  owner=bd&&P.accts[bd.owner_account_id];if(!owner||!acctKeys(owner).includes(v.ck)){bd=null;owner=null;}   // the contact must be the sign-in contact of that account
  x=bd&&P.devs[bd.device_id];if(bd&&!ccCfg(simCc(b.sims[bd.iccid])).cancel_public){bd=null;owner=null;x=null;}}   // non-public country: answered like no match (nothing confirmed)
 if(!(x&&subOf(x)))res=bd?'nosub':'nomatch';
 const cc=bd?simCc(b.sims[bd.iccid]):null;let end=null;
 if(res==='ok')end=stopSub(x,at,ref,v.mode==='account'?'account':'public_button');
 const rec={ref,received_at:at,channel:v.mode==='account'?'account':'public_button',name:v.name||(owner&&owner.prof.name)||'',contact:v.ck?cShow(parseKey(v.ck)):(owner?cShow(primary(owner)):''),
  device_ref:v.devref||(bd&&bd.iccid)||null,iccid:bd&&bd.iccid||null,device_id:bd&&bd.device_id||null,cc,type:v.type||'ordinary',reason:v.reason||'',confirm_to:v.mail,
  status:res==='ok'?'done':res==='nosub'?'no_subscription':'needs_review',service_until:end,account_id:owner?owner.id:null,partner_id:bd&&bd.partner_id||null};
 await bridgeTx(bb=>{bb.cancellations.push(rec);bb.events.push(Object.assign(bd?bEvent('subscription_cancel_request',bd):{id:uid('ev'),type:'subscription_cancel_request',at,by:'portal'},{ref,status:rec.status,channel:rec.channel}));return{};});
 save();const dn=x?dname(x):'';
 notify({k:'e',v:v.mail},res==='ok'?t('cx_conf',{ref,t:fdt(Date.parse(at)),d:dn,date:fdate(end)}):t(res==='nomatch'?'cx_conf_neutral':'cx_conf_pending',{ref,t:fdt(Date.parse(at))}));
 if(owner&&cKey(primary(owner))!=='e:'+v.mail&&res==='ok')notify(primary(owner),t('cx_conf',{ref,t:fdt(Date.parse(at)),d:dn,date:fdate(end)}));
 return{res,ref,at,end,dev:dn,mail:v.mail};}
async function finishFlow(f){const c=parseKey(f.ck);
 if(f.p==='login'){login(c);afterLogin();return;}
 if(f.p==='chg_old')return startFlow('chg_new',parseKey(f.data.nv),f.data,f.back);
 if(f.p==='chg_new'){const a=acct();const nv=parseKey(f.data.nv);const o=findAcct(nv);if(o&&o!==a){go('profile');toast(t('sc_taken'));return;}
  a[f.data.field]=nv.v;save();syncAcct(a);go('profile');toast(t('sc_done'));return;}
 if(f.p==='transfer')return doTransfer(f.data);
 if(f.p==='accept')return doAccept(f.data);
 if(f.p==='unbind')return doUnbind(f.data);
 if(f.p==='link')return doLink(f.data);}
function afterLogin(){if(!S.onboarded){go('start-1');return;}const r=SS.ret;if(r){SS.ret=null;ssave();go(r);return;}go('home');}
async function seedDemo(){const a=acct();if(!a||a.prof.seeded)return;a.prof.seeded=true;const n=now();
 const ago=(dd,h,m)=>{const x=new Date(n);x.setDate(x.getDate()-dd);x.setHours(h,m,0,0);return isoT(x);};
 const mk={
  inverter:{days:400,mode:'pkg',paidUntil:addMonths(today(),30),ev:[['ev_restored',ago(0,8,14),'ok'],['ev_off',ago(0,6,2),'warn'],['ev_paid',ago(400,12,40),'info']]},
  tracker:{days:200,mode:'sub',next:addMonths(today(),1).slice(0,8)+'12',ev:[['ev_paid',ago(19,9,0),'info'],['ev_restored',ago(1,14,31),'ok'],['ev_lost',ago(1,14,22),'bad']]},
  alarm:{days:300,mode:'pkg',paidUntil:addMonths(today(),16),auto:{plan:'y2'},ev:[['ev_restored',ago(4,21,19),'ok'],['ev_lost',ago(4,21,7),'bad'],['ev_paid',ago(300,10,5),'info']]},
  boiler:{days:30,mode:'pkg',paidUntil:addMonths(today(),11),ev:[['ev_code',ago(30,15,10),'info']]}};
 const have=S.devices.map(x=>x.type);
 const got=await bridgeTx(b=>{const g=[];Object.keys(b.sims).filter(i=>b.sims[i].demo==='history'&&b.sims[i].status==='issued').forEach(i=>{
   const ty=MODEL_TYPE[b.sims[i].model];if(!ty||have.includes(ty)||g.some(z=>z[1]===ty)||b.bindings.some(z=>z.iccid===i&&liveB(z)))return;
   const at=isoMs(nowMs()-mk[ty].days*DAY-3*HOUR);const bd={id:uid('bnd'),iccid:i,device_id:devIdOf(i,b),owner_account_id:a.id,owner_contact:cShow(primary(a)),partner_id:b.sims[i].partner,method:'iccid',bound_at:at,unbound_at:null,unbind_reason:null,status:'active',demo:true};
   b.bindings.push(bd);g.push([i,ty,at]);});return{res:g,write:g.length>0};});
 const ids={};got.forEach(([i,ty,at])=>{const x=ensureDev(i,Date.parse(at));const o=mk[ty];x.mode=o.mode;if(o.paidUntil)x.paidUntil=o.paidUntil;if(o.next)x.next=o.next;if(o.auto)x.auto=o.auto;
  x.ev=x.ev.slice(0,1).concat([['ev_bound',isoT(new Date(Date.parse(at))),'info']],o.ev);x.start=at.slice(0,10);ids[ty]=x.id;});
 S.cards=[{id:'c0',last4:'4242',exp:'12/29',def:true}];
 if(ids.tracker)S.tx=[{ts:ago(19,9,0),dev:ids.tracker,desc:t('pm_kindM'),sum:PR.light.m,ok:true,via:'card',card:'4242'},{ts:ago(19,8,55),dev:ids.tracker,desc:t('pm_kindM'),sum:PR.light.m,ok:false,via:'card',card:'4242',retried:true},{ts:ago(49,9,0),dev:ids.tracker,desc:t('pm_kindM'),sum:PR.light.m,ok:true,via:'card',card:'4242'}];
 if(ids.alarm)S.tx.push({ts:ago(300,10,5),dev:ids.alarm,desc:t('pm_kindP',{term:t('p_y2')}),sum:PR.std.y2,ok:true,via:'card',card:'4242'});
 save();}
async function resetBridge(){await bridgeTx(b=>{   // merge, never replace: drop what portal accounts created, restore the portal's own demo seed items
 const mine=id=>String(id||'').startsWith('acc_');const sd=seedBridge();
 Object.keys(sd.sims).forEach(i=>{if(!b.sims[i])b.sims[i]=sd.sims[i];});
 Object.keys(sd.codes).forEach(k=>{const r=b.codes[k];if(!r||!r.partner||r.src==='portal-demo')b.codes[k]=sd.codes[k];});
 sd.bindLinks.forEach(l=>{const i=b.bindLinks.findIndex(z=>z.token===l.token);if(i<0)b.bindLinks.push(l);else b.bindLinks[i]=l;});
 b.bindLinks=b.bindLinks.filter(l=>l.src!=='portal-demo');b.requests=b.requests.filter(r=>r.src!=='portal-demo');
 b.history=(b.history||[]).filter(h=>!mine(h.owner_account_id));
 b.bindings=b.bindings.filter(z=>!mine(z.owner_account_id));b.transfers=b.transfers.filter(z=>!mine(z.from_account_id)&&!mine(z.to_account_id));
 Object.values(b.codes).forEach(r=>{if(mine(r.redeemed_by_account_id)){r.status='new';r.device_id=null;delete r.redeemed_at;delete r.redeemed_by_account_id;delete r.iccid;}});
 b.events=b.events.filter(e=>e.by!=='portal');b.bindLinks.forEach(l=>{if(mine(l.account_id)){l.status='pending';delete l.account_id;delete l.confirmed_at;delete l.binding_id;}});
 Object.keys(b.accounts).forEach(k=>{if(mine(k))delete b.accounts[k];});b.notices=b.notices.filter(x=>!mine(x.account_id));return{};});}

const app=document.getElementById('app');
function topbar(o={}){
 const left=o.back?`<button class="back" type="button" ${o.backAct?`data-act="${o.backAct}"`:`data-go="${o.back}"`}>${ic('left')}<span>${t('back')}</span></button>`:
  `<a class="brand" href="#home" aria-label="ARVELO CONNECT" style="text-decoration:none;color:inherit">${LOGO}<span class="bt" style="display:flex;flex-direction:column;line-height:1"><span style="font-size:19px;font-weight:800;letter-spacing:.14em">ARVELO</span><span style="font-size:10px;font-weight:700;letter-spacing:.32em;color:var(--brand);margin-top:3px">CONNECT</span></span></a>`;
 return `<header class="top">${left}<button class="pill" type="button" data-act="lang" aria-label="${t('language')}: ${T[S.lang].lang}">${ic('globe','sm')}<span>${S.lang==='uk'?'УКР':S.lang.toUpperCase()}</span></button></header>`;
}
function tabs(cur){
 const n=S.devices.filter(attn).length;
 const items=[['home','home','t_home'],['map','pin','t_map'],['alerts','bell','t_alerts'],['profile','user','t_profile']];
 return `<button class="fab" type="button" data-act="lab">${ic('flask','sm')}${t('x_btn')}</button><nav class="tabs" aria-label="${t('menu')}">${items.map(([h,i,k])=>`<a class="tab" href="#${h}" ${cur===h?'aria-current="page"':''}>${ic(i)}${h==='home'&&n?`<span class="badge" aria-hidden="true">${n}</span>`:''}<span>${t(k)}${h==='home'&&n?`<span class="sr">, ${t('badge_sr',{n})}</span>`:''}</span></a>`).join('')}</nav>`;
}
const pill=x=>x.status==='off'?`<span class="status bad"><span class="dot" aria-hidden="true"></span>${t('st_off')}</span>`:`<span class="status ok"><span class="dot" aria-hidden="true"></span>${t('st_ok')}</span>`;
const seenTxt=x=>x.status==='off'?t('off_since',{t:ftime(x.offAt)}):t('checked',{t:t('seen_now')});
const payTxt=x=>x.mode==='sub'?t('autopay',{date:fdate(x.next)}):x.mode==='pkg'?t('paid_till',{date:fdate(x.paidUntil)}):t('pay_none');
const noteFor=x=>x.cause==='jam'?t('note_jam'):x.cause==='sim'?t('note_sim'):t('note_power');

function errL(id,txt){return `<span id="${id}" class="err" role="alert">${ic('alert','sm')}<span>${txt}</span></span>`;}
function vSignin(){const act=SS.ret&&SS.ret.startsWith('/a/');const pk=SS.ret==='code';const v=SS.si||{};
 return `${topbar()}<main class="stack s24 fade"><div class="row" style="gap:12px">${LOGO}<div class="stack s8" style="gap:2px"><span style="font-weight:800;letter-spacing:.14em">${esc(t('brand'))}</span><span class="small" style="font-weight:700;letter-spacing:.3em;color:var(--brand)">CONNECT</span></div></div>
 <form class="stack s24" data-form="signin" novalidate><div class="stack s8"><h1>${t('si_title')}</h1><p class="muted" id="sisub">${act?t('si_act')+' ':pk?t('si_pkg')+' ':''}${t('si_sub')}</p></div>
 <label class="f" for="si">${t('si_label')}<input class="inp" id="si" type="text" inputmode="email" autocomplete="username" autocapitalize="off" spellcheck="false" value="${esc(v.v||'')}" ${v.err?'aria-invalid="true" aria-describedby="sih"':''}></label>
 ${v.err?errL('sih',t('si_err')):''}
 <div class="democard">${ic('flask','sm')}<span>${t('otp_demo_hint')}</span></div>
 <button class="btn primary" type="submit">${t('si_btn')} ${ic('right')}</button>
 ${act||pk?'':`<button class="btn ghost" type="button" data-act="pkgsignin" id="pksignin">${ic('key')} ${t('pk_have')}</button>`}</form>
 <p class="muted small" style="text-align:center">${t('beat')}</p></main>`;}
/* v12 EUT 4.1: activation code (package code) — sign in with OTP, enter the code printed under the scratch layer, choose the device.
   The card no longer carries a QR code under the scratch layer (Document B v12: QR to the portal outside it); /a/<code> stays as a convenience
   that opens the "choose device" step with the code already filled in. */
function vCode(){const v=SS.pk||{};
 return `${topbar({back:'home'})}<main class="stack s24 fade"><div class="stack s8"><h1>${t('pk_title')}</h1><p class="muted">${t('pk_sub')}</p></div>${blockedNote()}
 <form class="stack" data-form="pkg" novalidate><label class="f" for="pk">${t('c_label')}<input class="inp" id="pk" maxlength="19" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-XXXX-XXXX" value="${esc(v.v||'')}" style="letter-spacing:.04em;font-weight:700;font-variant-numeric:tabular-nums;font-size:1.05rem;padding:0 14px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace" ${v.err?'aria-invalid="true" aria-describedby="pkres"':'aria-describedby="pkh"'}></label>
 ${v.err?`<div class="note bad" role="alert" id="pkres">${v.err}</div>`:`<span class="hint" id="pkh">${t('pk_hint')}</span>`}
 <button class="btn primary" type="submit" id="pkbtn">${t('pk_next')} ${ic('right')}</button><button class="btn plain small" type="button" data-act="pkdemo">${ic('flask','sm')} ${t('c_demo')}</button></form>
 <section class="card stack s8"><p class="small">${t('L_c41')}</p><p class="muted small">${t('L_c41_ref')}</p></section></main>`;}
function vCancel(){const a=acct();const v=SS.cx||{};const r=v.done;const val=v.vals||{};const err=v.err||{};
 const top=`${topbar(a?{back:'home'}:{back:'welcome'})}<main class="stack s24 fade">`;
 if(r)return top+`<div class="stack" style="align-items:center;text-align:center"><div class="success">${ic('check','lg')}</div><h1>${t(r.res==='nomatch'?'cx_neutral_t':'cx_done_t')}</h1></div>
  <section class="card stack s8" id="cxdone" data-res="${r.res}"><p><span class="muted">${t('cx_ref')}</span> <b id="cxref">${esc(r.ref)}</b></p><p id="cxrec">${t('cx_rec',{t:fdt(Date.parse(r.at))})}</p>
  ${r.res==='ok'?`<p id="cxend">${t('cx_end',{d:esc(r.dev),date:fdate(r.end)})}</p>`:`<p id="cxpend">${t(r.res==='nosub'?'cx_nosub':'cx_neutral')}</p>`}
  <p class="muted small" id="cxsent">${t('cx_sent',{c:`<b>${esc(r.mail)}</b>`})}</p></section>
  <button class="btn ghost" type="button" data-act="cxprint">${t('cx_print')}</button><a class="btn primary" href="#${a?'home':'welcome'}">${t(a?'p_home':'cx_back')}</a></main>`;
 const subs=a?S.devices.filter(subOf):[];const mode=a?'account':'public';
 const fld=(id,lab,typ,im,ac,ek,val0)=>`<label class="f" for="${id}">${lab}<input class="inp" id="${id}" type="${typ}" inputmode="${im}" autocomplete="${ac}" autocapitalize="off" spellcheck="false" value="${esc(val0||'')}" ${err[ek]?`aria-invalid="true" aria-describedby="${id}h"`:''}></label>${err[ek]?errL(id+'h',t('cx_err_'+ek)):''}`;
 const who=a?(subs.length?`<div class="list" role="radiogroup" aria-label="${t('cx_pick')}">${subs.map(x=>`<label class="li" for="cx-${x.id}"><input type="radio" name="cxdev" id="cx-${x.id}" value="${x.id}" style="width:22px;height:22px;accent-color:var(--brand)" ${val.dev===x.id||subs.length===1?'checked':''}><span class="ic">${ic(DEVICON[x.type])}</span><span class="grow"><span class="t" style="display:block">${esc(dname(x))}</span><span class="s" style="display:block">${x.mode==='sub'?t('pm_kindM'):t('pm_kindP',{term:t('p_'+x.auto.plan)})} · ${t('cx_until',{date:fdate(subEnd(x))})}</span></span></label>`).join('')}</div>${err.pick?errL('cxpickh',t('cx_err_pick')):''}`:`<div class="note warn" id="cxnone">${t('cx_none')}</div>`)
  :fld('cxname',t('cx_name'),'text','text','name','name',val.name)+fld('cxcontact',t('cx_contact'),'text','email','username','contact',val.contact)+fld('cxdev',t('cx_dev'),'text','numeric','off','dev',val.devref)+`<span class="hint">${t('cx_dev_hint')}</span>`;
 const ty=val.type||'ordinary';
 return top+`<div class="stack s8"><h1>${t('cx_title')}</h1><p class="muted">${t(a?'cx_sub_acc':'cx_sub')}</p></div>
 <form class="stack" data-form="cancel" data-mode="${mode}" novalidate>${who}
 ${a&&!subs.length?'':`<fieldset class="stack s8" style="border:0;padding:0;margin:0"><legend style="font-weight:600;margin-bottom:4px">${t('cx_type')}</legend>
  <label class="agr" for="cxt1"><input type="radio" name="cxtype" id="cxt1" value="ordinary" ${ty==='ordinary'?'checked':''}><span>${t('cx_type_ord')}</span></label>
  <label class="agr" for="cxt2"><input type="radio" name="cxtype" id="cxt2" value="extra" ${ty==='extra'?'checked':''}><span>${t('cx_type_extra')}</span></label>
  <label class="f" for="cxreason">${t('cx_reason')}<textarea class="inp" id="cxreason" rows="2" style="height:auto;padding:12px 14px" ${err.reason?'aria-invalid="true" aria-describedby="cxreasonh"':''}>${esc(val.reason||'')}</textarea></label>${err.reason?errL('cxreasonh',t('cx_err_reason')):''}</fieldset>
 <p class="small"><b>${t('cx_when_l')}</b> ${t('cx_when')}</p>
 ${fld('cxmail',t('cx_mail'),'email','email','email','mail',val.mail!=null?val.mail:(a?(S.email||acct().email||''):''))}
 <button class="btn danger" type="submit" id="cxbtn">${t('cx_btn')}</button>`}</form>
 <section class="card stack s8"><p class="small">${t('L_c51')}</p><p class="muted small">${t('L_c51_ref')}</p></section></main>`;}
function footer(){return `<footer class="foot" id="foot"><a href="#cancel" data-act="cxopen" id="cxlink">${t('cx_link')}</a><button type="button" class="lnk" data-act="doc" data-arg="terms">${t('doc_terms')}</button><button type="button" class="lnk" data-act="doc" data-arg="priv">${t('doc_priv')}</button></footer>`;}
function vOtp(){const f=SS.flow;if(!f)return vSignin();const c=parseKey(f.ck);const w=otpWait(f.ck);
 return `${topbar({back:true,backAct:'otpback'})}<main class="stack s24 fade"><form class="stack s24" data-form="otp" novalidate>
 <div class="stack s8"><h1>${t('otp_title')}</h1><p class="muted" id="otpsub">${f.notSent?(w&&w.gap?t('otp_gap',{c:`<b>${esc(cShow(c))}</b>`,s:`<span id="otpgs">${Math.max(1,Math.ceil((w.gap-nowMs())/1000))}</span>`}):t('otp_notsent',{c:`<b>${esc(cShow(c))}</b>`})):t('otp_sub',{c:`<b>${esc(cShow(c))}</b>`})}</p><p class="small muted">${t('otp_why_'+f.p)}</p></div>
 <label class="f" for="otp">${t('otp_label')}<input class="inp code" id="otp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" ${f.err?'aria-invalid="true" aria-describedby="otph"':''}></label>
 ${f.err?errL('otph',f.err):''}
 <div class="democard">${ic('flask','sm')}<span>${t('otp_demo_hint')}</span></div>
 <div class="stack s8"><button class="btn primary" type="submit">${t('otp_ok')} ${ic('right')}</button>
 <button class="btn plain" type="button" data-act="otpresend" id="otpres" ${w?'disabled':''}>${otpResTxt(w)}</button></div></form></main>`;}
function otpResTxt(w){return w&&w.limit?t('otp_limit',{t:fdt(w.limit)}):w&&w.gap?t('otp_wait',{s:Math.max(1,Math.ceil((w.gap-nowMs())/1000))}):t('otp_resend');}
function simState(i,b){const s=b.sims[i];if(!s)return 'dst_unknown';if(!s.partner||s.status==='stock')return 'dst_stock';if(s.status!=='issued')return 'dst_off';
 const z=b.bindings.find(q=>q.iccid===i&&liveB(q));return z?(z.owner_account_id===SS.cur?'dst_mine':'dst_owned'):'dst_free';}
function blockedNote(){const bu=acct()&&blockedUntil(acct().id);return bu?`<div class="note bad" role="alert" id="blocked">${t('blocked_acct',{t:fdt(bu)})}</div>`:'';}
function vAdd(){const v=SS.add||{};const ob=!S.onboarded;const back=ob?'start-1':SS.ret&&SS.ret.startsWith('/a/')?SS.ret:'home';const b=B();
 const res=v.res?(v.res==='BLOCK'?'':`<div class="note ${v.res==='T4'?'warn':'bad'}" role="alert" id="addres">${t(v.res)}</div>`):'';
 const pool=Object.keys(b.sims).filter(i=>!b.sims[i].demo&&/^\d{19,20}$/.test(i));
 const demo=pool.filter(i=>simCc(b.sims[i])!=='DE').slice(0,10).concat(pool.filter(i=>simCc(b.sims[i])==='DE').slice(0,3),[genIccid(987654)]);
 return `${topbar({back})}<main class="stack s24 fade">${ob?steps(2):''}<div class="stack s8"><h1>${t('add_device')}</h1><p class="muted">${t('add_hint2')}</p></div>
 ${blockedNote()}
 <form class="stack" data-form="iccid" novalidate>
 <label class="f" for="iccid">${t('iccid_label')}<input class="inp" id="iccid" inputmode="numeric" autocomplete="off" spellcheck="false" maxlength="24" value="${esc(v.v?fmtIccid(String(v.v).replace(/\s+/g,'')):'')}" style="font-variant-numeric:tabular-nums;letter-spacing:.03em" aria-describedby="iccidh" ${v.err?'aria-invalid="true"':''}></label>
 ${v.err?errL('iccidh',t(v.err)):`<span id="iccidh" class="hint">${t('iccid_hint')}</span>`}
 <button class="btn ghost" type="button" data-act="scan">${ic('qr')} ${t('scan_btn')}</button><p id="scanmsg" class="hint" role="status"></p>
 <label class="agr" for="t1"><input type="checkbox" id="t1" ${v.t1?'checked':''} ${v.t1err?'aria-invalid="true" aria-describedby="t1h"':''}><span>${t('T1')}</span></label>
 ${v.t1err?errL('t1h',t('t1_err')):''}
 ${res}
 <button class="btn primary" type="submit" id="bindbtn">${ic('plus')} ${t('bind_btn')}</button></form>
 <section class="card stack s8"><span class="tag">${ic('flask','sm')} ${t('demo_iccids')}</span><div class="list" style="box-shadow:none">${demo.map(i=>`<div class="li" style="min-height:56px;padding:10px 4px"><div class="grow"><div class="t" style="font-variant-numeric:tabular-nums;font-size:.92rem">${fmtIccid(i)}</div><div class="s">${t(simState(i,b))}${b.sims[i]?' · '+esc(simCc(b.sims[i])):''}</div></div><button class="btn plain auto small" type="button" data-act="useiccid" data-arg="${i}">${t('demo_use')}</button></div>`).join('')}</div></section></main>`;}
let actDone=null;   // one-shot success screen: never persisted, so re-opening /a/<code> shows T7
function vActivate(code){const b=B();const L=codeLookup(b,code);const ok=L&&codeOk(L[1])&&codePlan(code,L[1]);
 if(actDone&&actDone.code!==code)actDone=null;
 if(actDone){const o=actDone;const x=dev(o.dev);return `${topbar()}<main class="stack s24 fade" style="align-items:center;text-align:center;padding-top:32px"><div class="success">${ic('check','lg')}</div><h1>${t('p_ok')}</h1>
  <p class="muted">${esc(o.txt)}. ${x?t('p_okS',{device:esc(dname(x)),date:fdate(x.paidUntil)}):''}</p><button class="btn primary" type="button" data-act="actdone">${t('p_back')}</button></main>`;}
 if(!ok){if(SS.actFail!==code){SS.actFail=code;ssave();if(acct())fail(acct().id);}
  return `${topbar({back:'home'})}<main class="stack s24 fade"><h1>${t('act_title')}</h1>${blockedNote()}<div class="note bad" role="alert" id="actres">${t('T7')}</div><a class="btn primary" href="#home">${t('p_home')}</a></main>`;}
 const pl=codePlan(code,L[1]);const v=SS.act||{};const ds=S.devices;
 return `${topbar({back:'home'})}<main class="stack s24 fade"><div class="stack s8"><h1>${t('act_title')}</h1><p class="muted">${t('act_sub',{code:`<b class="nw">${fmtCode(code)}</b>`})}</p>
 <p class="small" style="color:var(--ok);font-weight:600;display:flex;gap:6px;align-items:center">${ic('check','sm')}${t('c_dec',{a:PLN[pl.plan],term:termTxt(pl.months)})}</p></div>${blockedNote()}
 ${ds.length?`<form class="stack" data-form="act" data-code="${code}" novalidate><div class="list" role="radiogroup" aria-label="${t('act_title')}">${ds.map(x=>`<label class="li" for="ad-${x.id}"><input type="radio" name="actdev" id="ad-${x.id}" value="${x.id}" style="width:22px;height:22px;accent-color:var(--brand)" ${codePlanActive(x)?'disabled':(ds.filter(y=>!codePlanActive(y)).length===1&&!codePlanActive(x))||v.dev===x.id?'checked':''}><span class="ic">${ic(DEVICON[x.type])}</span><span class="grow"><span class="t" style="display:block">${esc(dname(x))}</span><span class="s" style="display:block">${PLN[x.plan]} · ${payTxt(x)}</span></span></label>`).join('')}</div>
  ${v.err?errL('acth',v.err):''}<button class="btn primary" type="submit">${ic('key')} ${t('act_btn')}</button></form>
  <button class="btn plain" type="button" data-act="actadd">${ic('plus')} ${t('act_add')}</button>`:
 `<p class="muted">${t('act_none')}</p><button class="btn primary" type="button" data-act="actadd">${ic('plus')} ${t('act_add')}</button>`}</main>`;}
function trBox(x){const tr=openTr(x);if(!tr)return '';const me=tr.from_account_id===SS.cur;if(!me)return '';
 const txt=tr.status==='pending_acceptance'?t('tr_st_pending',{c:esc(cShow(parseKey(tr.to_contact))),t:fdt(Date.parse(tr.accept_by))}):t('tr_st_cool',{t:fdt(Date.parse(tr.effective_at))});
 return `<section class="card stack" id="trbox" style="background:var(--warn-bg)"><h2 style="color:var(--warn)">${t('tr_title')}</h2><p id="trstate">${txt}</p>
 <button class="btn danger" type="button" data-act="trcancel" data-arg="${tr.id}">${ic('x')} ${t('tr_cancel')}</button>
 ${tr.status==='pending_acceptance'?`<button class="btn plain small" type="button" data-go="/t/${tr.token}">${ic('flask','sm')} ${t('tr_link_demo')}</button>`:
  `<div class="row" style="flex-wrap:wrap;gap:8px"><button class="btn plain auto small" type="button" data-act="ff" data-arg="60">${ic('flask','sm')} ${t('tr_ff')}</button><button class="btn plain auto small" type="button" data-act="ffend" data-arg="${tr.id}">${t('tr_ff_end')}</button></div>`}</section>`;}
function reqBox(x){const bd=bnd(x);if(!bd)return '';const n=nowMs();const b=B();
 const nt=b.notices.find(z=>z.code==='T11'&&z.account_id===SS.cur&&z.iccid===x.iccid&&!(z.object_until&&Date.parse(z.object_until)<=n)&&!((b.requests.find(r=>r.id===z.request_id)||{}).objected_at));if(!nt)return '';
 const N=nt.delay_hours||delayHours(x.iccid);const txt=(nt.text&&nt.text[S.lang])||t('T11',{N});
 return `<section class="card stack" style="background:var(--bad-bg)" id="reqbox"><p style="color:var(--bad);font-weight:600">${esc(txt)}</p><button class="btn danger" type="button" data-act="reqobject" data-arg="${esc(nt.request_id)}">${t('obj_btn')}</button></section>`;}
function vTransfer(id){const x=dev(id);if(!x)return vHome();const v=SS.trf&&SS.trf.id===id?SS.trf:{id,step:'to'};
 const blocked=frozen(x)?t('fz_state'):openTr(x)?t('tr_open'):'';
 if(blocked)return `${topbar({back:'device-'+id})}<main class="stack s24 fade"><h1>${t('tr_title')}</h1><div class="note bad" role="alert">${blocked}</div></main>`;
 if(v.step==='conseq'){const N=delayHours(x.iccid);return `${topbar({back:true,backAct:'trback'})}<main class="stack s24 fade"><div class="stack s8"><h1>${t('tr_conseq')}</h1><p class="muted">${esc(dname(x))} · ${t('tr_to_line',{c:`<b>${esc(cShow(parseKey(v.to)))}</b>`})}</p></div>
  <section class="card" id="t8"><p>${t('T8',{N})}</p></section><button class="btn primary" type="button" data-act="trgo">${ic('lock','sm')} ${t('tr_confirm')}</button></main>`;}
 return `${topbar({back:'device-'+id})}<main class="stack s24 fade"><form class="stack s24" data-form="trto" data-id="${id}" novalidate><div class="stack s8"><h1>${t('tr_title')}</h1><p class="muted">${esc(dname(x))}</p></div>
 <label class="f" for="trto">${t('tr_to')}<input class="inp" id="trto" type="text" inputmode="email" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(v.raw||'')}" ${v.err?'aria-invalid="true" aria-describedby="trtoh"':''}></label>
 ${v.err?errL('trtoh',t(v.err)):''}<button class="btn primary" type="submit">${t('tr_next')} ${ic('right')}</button></form></main>`;}
function vUnbind(id){const x=dev(id);if(!x)return vHome();const blocked=frozen(x)?t('fz_state'):openTr(x)?t('tr_open'):'';
 return `${topbar({back:'device-'+id})}<main class="stack s24 fade"><div class="stack s8"><h1>${t('ub_btn')}</h1><p class="muted">${esc(dname(x))}</p></div>
 ${blocked?`<div class="note bad" role="alert">${blocked}</div>`:`<section class="card stack s8"><p>${t('L_unbind')}</p><p class="muted small">${t('L_unbind_ref')}</p></section>
 <button class="btn danger" type="button" data-act="ubgo" data-arg="${id}">${ic('lock','sm')} ${t('tr_confirm')}</button>`}</main>`;}
function vAccept(token){const b=B();const tr=b.transfers.find(z=>z.token===token);const n=nowMs();const v=SS.acc||{};
 const top=`${topbar(acct()?{back:'home'}:{})}<main class="stack s24 fade"><h1>${t('tr_accept_title')}</h1>`;
 if(v.err==='T12')return top+`<div class="note bad" role="alert" id="accres">${t('T12')}</div></main>`;
 if(tr&&tr.status==='cooling_off'&&tr.to_account_id===SS.cur)return top+`<div class="note warn" role="status" id="accres">${t('tr_cool_started',{t:fdt(Date.parse(tr.effective_at))})}</div><a class="btn primary" href="#home">${t('p_home')}</a></main>`;
 if(!tr||tr.status!=='pending_acceptance'||Date.parse(tr.accept_by)<=n||v.err==='exp')return top+`<div class="note bad" role="alert" id="accres">${t('tr_expired')}</div></main>`;
 const x=P.devs[tr.device_id];const who=tr.from_name||cShow(parseKey(tr.from_contact));
 return top+`<section class="card stack s8"><p id="t9">${t('T9',{who:esc(who)})}</p>${x?`<p class="muted small">${t('typ_'+x.type)} ${x.model}</p>`:''}</section>
 <form class="stack" data-form="accept" data-token="${token}" novalidate><p class="muted">${t('tr_accept_contact',{c:`<b>${esc(cShow(parseKey(tr.to_contact)))}</b>`})}</p>
 <label class="agr" for="t1"><input type="checkbox" id="t1" ${v.t1err?'aria-invalid="true" aria-describedby="t1h"':''}><span>${t('T1')}</span></label>${v.t1err?errL('t1h',t('t1_err')):''}
 <button class="btn primary" type="submit">${t('tr_accept_btn')} ${ic('right')}</button></form></main>`;}
function vLink(token){const l=findLink(B(),token);const v=SS.lnk||{};const top=`${topbar(acct()?{back:'home'}:{})}<main class="stack s24 fade"><h1>${t('ln_title')}</h1>`;
 if(v.res)return top+`<div class="note bad" role="alert" id="lnres">${v.res==='BLOCK'?t('blocked_acct',{t:fdt(v.until)}):v.res==='LINK'?t('tr_expired'):t(v.res)}</div></main>`;
 if(!linkOpen(l))return top+`<div class="note bad" role="alert" id="lnres">${t('tr_expired')}</div></main>`;
 const c=linkContact(l);
 return top+`<section class="card stack s8"><p>${t('ln_sub',{n:l.iccid.slice(-4),c:`<b>${esc(cShow(c))}</b>`})}</p><p class="muted small">${t('ln_valid',{t:fdt(Date.parse(l.expires_at))})}</p></section>
 <form class="stack" data-form="link" data-token="${token}" novalidate><label class="agr" for="t1"><input type="checkbox" id="t1" ${v.t1err?'aria-invalid="true" aria-describedby="t1h"':''}><span>${t('T1')}</span></label>${v.t1err?errL('t1h',t('t1_err')):''}
 <button class="btn primary" type="submit">${t('tr_confirm')} ${ic('right')}</button></form></main>`;}
function vChg(field){const a=acct();const v=SS.chg&&SS.chg.field===field?SS.chg:{};
 return `${topbar({back:'profile'})}<main class="stack s24 fade"><form class="stack s24" data-form="chg" data-field="${field}" novalidate><div class="stack s8"><h1>${t(field==='email'?'sc_new_email':'sc_new_phone')}</h1><p class="muted">${t('sc_hint')}</p></div>
 ${a[field]?`<p class="muted">${t(field==='email'?'email':'sc_phone')}: <b>${esc(cShow({k:field[0],v:a[field]}))}</b></p>`:''}
 <label class="f" for="nc">${t(field==='email'?'sc_new_email':'sc_new_phone')}<input class="inp" id="nc" type="text" inputmode="${field==='email'?'email':'tel'}" autocomplete="off" autocapitalize="off" value="${esc(v.raw||'')}" ${v.err?'aria-invalid="true" aria-describedby="nch2"':''}></label>
 ${v.err?errL('nch2',t(v.err)):''}<button class="btn primary" type="submit">${t('tr_confirm')} ${ic('right')}</button></form></main>`;}
function vLog(){const a=acct();const keys=acctKeys(a);const rows=P.log.filter(e=>keys.includes(e.key));
 const li=(h,s)=>`<div class="li" style="min-height:56px"><div class="grow"><div class="t">${h}</div><div class="s">${s}</div></div></div>`;
 return `${topbar({back:'profile'})}<main class="stack s24 fade"><h1>${t('lg_title')}</h1>
 <div class="list" id="loglist">${rows.slice(0,40).map(e=>li(esc(e.contact)+' · '+t('lg_'+e.result),fdt(Date.parse(e.at))+' · IP '+esc(e.ip))).join('')||li(t('lg_empty'),'')}</div>
 <h2>${t('lg_notes')}</h2><div class="list" id="notes">${P.notes.slice(0,20).map(n=>li(esc(n.text),esc(n.to)+' · '+fdt(Date.parse(n.at)))).join('')||li(t('lg_empty'),'')}</div>
 <h2>${t('lg_af')}</h2><div class="list" id="aflist">${P.af.slice(0,20).map(e=>li(esc(e.reason),fdt(Date.parse(e.at))+' · IP '+esc(e.ip))).join('')||li(t('lg_empty'),'')}</div></main>`;}
const steps=n=>`<div class="stack s8"><div class="steps" aria-hidden="true">${[1,2].map(i=>`<i class="${i<=n?'on':''}"></i>`).join('')}</div><span class="muted small">${t('s_step',{n})}</span></div>`;
function remList(){const a=S.remind.slice().sort((x,y)=>y-x);const last=a[a.length-1];const nums=a.map(n=>n);let txt=nums.length>1?nums.slice(0,-1).join(', ')+' '+t('r_and')+' '+nums[nums.length-1]:String(nums[0]);return txt+' '+pf(last,'day');}
function readContacts(f,pfx){const ms=(f.querySelector('.chips').dataset.ms||'').split(',').filter(Boolean);const raw={},phones={},bad={};
 MSG.forEach(m=>{const v=f.querySelector('#'+pfx+'ph-'+m).value.trim();raw[m]=v;if(ms.includes(m)){const l=parsePhone(v);if(l)phones[m]=fmtPhone(l);else bad[m]=1;}});
 return {ms,raw,phones,bad:Object.keys(bad).length?bad:null};}
function famLine(m){return [m.email].concat((m.msgs||[]).map(x=>x+(m.phones&&m.phones[x]?' '+m.phones[x]:''))).filter(Boolean).join(' · ');}
function contactFields(em,ms,ph,err,pfx){const eErr=err.em==='req'?t('fam_email_req'):err.em?t('email_err'):'';
 return `<label class="f" for="${pfx}em">${t('email')}<input class="inp" id="${pfx}em" type="email" inputmode="email" autocomplete="${pfx?'off':'email'}" value="${esc(em)}" aria-describedby="${pfx}emh" ${eErr?'aria-invalid="true"':''}>
  ${eErr?`<span id="${pfx}emh" class="err">${ic('alert','sm')}<span>${eErr}</span></span>`:(pfx?'':`<span id="${pfx}emh" class="hint">${t('email_hint2')}</span>`)}</label>
 <fieldset class="stack s8" style="border:0;padding:0;margin:0"><legend style="font-weight:600;margin-bottom:4px">${t('msgs')}</legend><span class="hint">${t('msgs_hint')}</span>
  <div class="chips" data-ms="${esc(ms.join(','))}" data-pw="${pfx}phs">${MSG.map(m=>`<button type="button" class="chip" data-act="msg" data-arg="${m}" aria-pressed="${ms.includes(m)}">${ic('check','sm ck')}${m}</button>`).join('')}</div></fieldset>
 <div class="stack" id="${pfx}phs">${MSG.map(m=>{const e=err.ph&&err.ph[m];const fid=`${pfx}ph-${m}`;return `<label class="f" for="${fid}" data-ph="${m}" ${ms.includes(m)?'':'hidden'}>${t('phone_m',{m})}<input class="inp" id="${fid}" type="tel" inputmode="tel" maxlength="17" autocomplete="${pfx?'off':'tel'}" placeholder="+380" value="${esc((ph||{})[m]||'')}" ${e?`aria-invalid="true" aria-describedby="${fid}h"`:''}>${e?`<span id="${fid}h" class="err">${ic('alert','sm')}<span>${t('phone_err')}</span></span>`:''}</label>`;}).join('')}
 <p class="hint" data-phhint ${ms.length?'':'hidden'}>${t('phone_hint')}</p></div>`;}
function vFam(key,err={},val={}){const i=key==='new'?-1:+key;const m=i>=0?S.family[i]:null;if(i>=0&&!m)return vProfile();
 const nm=val.nm!=null?val.nm:(m?m.name:''),em=val.em!=null?val.em:(m?m.email:''),ms=val.ms||(m?m.msgs:[]),ph=val.ph!=null?val.ph:(m?m.phones:{});
 return `${topbar({back:'profile'})}<main class="stack s24 fade"><div class="stack s8"><h1>${m?esc(m.name):t('fam_new')}</h1><p class="muted">${t('fam_hint')}</p></div>
 <form class="stack s24" data-form="fam" data-i="${i}" novalidate>
 <label class="f" for="fnm">${t('fam_name')}<input class="inp" id="fnm" autocomplete="off" maxlength="40" value="${esc(nm)}" ${err.nm?'aria-invalid="true" aria-describedby="fnmh"':''}>${err.nm?`<span id="fnmh" class="err">${ic('alert','sm')}<span>${t('fam_name_err')}</span></span>`:''}</label>
 ${contactFields(em,ms,ph,err,'f')}
 <button class="btn primary" type="submit">${t('save')}</button>
 ${m?`<div id="famDel"><button class="btn plain" type="button" data-act="famdel" data-arg="${i}" style="color:var(--bad)">${t('fam_del')}</button></div>`:''}</form></main>`;}
function vContacts(mode,err={},val={}){
 const ob=mode==='ob';const em=val.em!=null?val.em:S.email,ph=val.ph!=null?val.ph:S.phones,ms=val.ms||S.msgs;
  return `${topbar(ob?{}:{back:'profile'})}<main class="stack s24 fade">${ob?steps(1):''}
 <form class="stack s24" data-form="contacts" data-mode="${mode}" novalidate>
 <h1>${ob?t('c_title'):t('c_edit')}</h1>
 ${contactFields(em,ms,ph,err,'')}
 ${ob?`<div class="stack s8"><label class="agr" for="agr"><input type="checkbox" id="agr" ${val.agr?'checked':''} ${err.agr?'aria-invalid="true" aria-describedby="agh"':''}><span>${t('ag_pre')} <button type="button" class="lnk" data-act="doc" data-arg="terms">${t('ag_terms')}</button> ${t('ag_and')} <button type="button" class="lnk" data-act="doc" data-arg="priv">${t('ag_priv')}</button></span></label>
 ${err.agr?`<span id="agh" class="err">${ic('alert','sm')}<span>${t('ag_err')}</span></span>`:''}</div>`:''}
 <button class="btn primary" type="submit">${ob?t('next')+' '+ic('right'):t('save')}</button></form></main>`;
}
function vDone(){
 const fl=SS.flash&&dev(SS.flash.dev);const x=fl||S.devices.slice().sort((p,q)=>bnd(q).bound_at.localeCompare(bnd(p).bound_at))[0];if(!x)return vAdd();
 return `${topbar()}<main class="stack s24 fade" style="padding-top:16px">
 <div class="stack" style="align-items:center;text-align:center"><div class="success">${ic('check','lg')}</div><h1>${t('done_title')}</h1>
 <div class="note ok" role="status" id="t5">${t('T5')}</div>
 <p class="muted">${t('done_sub',{device:esc(dname(x)),ch:chans().join(', ')})}</p></div>
 <form class="stack" data-form="done" novalidate>
 <label class="f" for="nm">${t('done_name')}<input class="inp" id="nm" autocomplete="given-name" value="${esc(S.name)}" maxlength="40"></label>
 <button class="btn primary" type="submit">${ic('check')} ${t('done_yes')}</button><button class="btn ghost" type="button" data-act="notarrived">${t('done_no')}</button></form></main>`;
}
function devCard(x){
 const a=attn(x);
 const note=frozen(x)?`<div class="note warn">${t('fz_title')}</div>`:a==='move'?`<div class="note bad">${t('note_move',{t:ftime(x.moved)})}</div>`:a==='off'?`<div class="note bad">${noteFor(x)}</div>`:a==='none'?`<div class="note warn">${t('hero_noneS')}</div>`:a==='soon'?`<div class="note warn">${t('ends_in',{n:days(x.paidUntil),u:pf(days(x.paidUntil),'day')})}</div>`:'';
 return `<a class="card dev" href="#device-${x.id}"><div class="head"><span class="avatar">${ic(DEVICON[x.type],'lg')}</span><div class="grow"><div class="name">${esc(dname(x))}</div><div class="muted small">${seenTxt(x)}</div></div>${ic('right','chev')}</div>
  <div class="row" style="flex-wrap:wrap;gap:8px 12px">${pill(x)}<span class="muted small" style="display:inline-flex;gap:6px;align-items:center">${ic('card','sm')}${payTxt(x)}</span></div>${note}</a>`;
}
function vHome(){
 const list=S.devices.slice().sort((a,b)=>sev(b)-sev(a));const top=list[0];const a=top&&attn(top);let hero='';
 if(a==='move')hero=`<a class="hero bad" href="#device-${top.id}"><span class="ring">${ic('pin','lg')}</span><div class="grow"><div class="big">${t('hero_move',{device:esc(dname(top))})}</div><div class="sub">${t('note_move',{t:ftime(top.moved)})} ${t('hero_go')}</div></div>${ic('right')}</a>`;
 else if(a==='off')hero=`<a class="hero bad" href="#device-${top.id}"><span class="ring">${ic('alert','lg')}</span><div class="grow"><div class="big">${t('hero_off',{device:esc(dname(top))})}</div><div class="sub">${noteFor(top)} ${t('hero_go')}</div></div>${ic('right')}</a>`;
 else if(a==='none')hero=`<a class="hero warn" href="#pay-${top.id}"><span class="ring">${ic('key','lg')}</span><div class="grow"><div class="big">${t('hero_none',{device:esc(dname(top))})}</div><div class="sub">${t('hero_noneS')}</div></div>${ic('right')}</a>`;
 else if(a==='soon')hero=`<a class="hero warn" href="#pay-${top.id}"><span class="ring">${ic('card','lg')}</span><div class="grow"><div class="big">${t('hero_pay',{device:esc(dname(top))})}</div><div class="sub">${t('ends_in',{n:days(top.paidUntil),u:pf(days(top.paidUntil),'day')})}</div></div>${ic('right')}</a>`;
 else hero=`<div class="hero ok"><span class="ring">${ic('check','lg')}</span><div><div class="big">${t('sum_ok')}</div><div class="sub">${t('sum_okS')}</div></div></div>`;
 const inc=B().transfers.filter(z=>z.status==='cooling_off'&&z.to_account_id===SS.cur).map(z=>`<div class="note warn" role="status" data-incoming="${z.id}">${t('tr_in_cool',{t:fdt(Date.parse(z.effective_at))})}</div>`).join('');
 if(!list.length)hero=`<div class="hero warn"><span class="ring">${ic('qr','lg')}</span><div><div class="big">${t('add_device')}</div><div class="sub">${t('add_hint2')}</div></div></div>`;
 return `${topbar()}<main class="stack s24 fade">${inc}<div class="stack s8"><h1 style="font-size:1.45rem">${greet()}${S.name?', '+esc(S.name):''}</h1>${hero}<p class="beat">${ic('heart','sm')}<span>${t('beat')}</span></p></div>
 <section class="stack" aria-labelledby="hdev"><h2 id="hdev">${t('my_devices')}</h2>${list.map(devCard).join('')}
 <button class="add" type="button" data-go="add"><span class="ic">${ic('qr')}</span><div><div style="font-weight:700">${t('add_device')}</div><div class="muted small">${t('add_hint2')}</div></div></button>
 <button class="add" type="button" data-go="code" id="pkhome"><span class="ic">${ic('key')}</span><div><div style="font-weight:700">${t('pk_title')}</div><div class="muted small">${t('pk_hint')}</div></div></button></section>
 ${S.family.length?'':`<section class="tip"><div class="row"><span class="ic brand" style="background:var(--surface)">${ic('users')}</span><h2 class="grow" style="font-size:1.1rem">${t('fam_t')}</h2></div><p>${t('fam_s')}</p><button class="btn primary" type="button" data-go="fam-new">${ic('plus')} ${t('fam_add')}</button></section>`}
 </main>${tabs('home')}`;
}
function mapSvg(){return `<svg viewBox="0 0 320 200" aria-hidden="true" preserveAspectRatio="xMidYMid slice"><rect width="320" height="200" fill="var(--map)"/><path d="M0 150 C60 135 90 170 150 160 S260 120 320 135 L320 200 L0 200z" fill="var(--water)"/><rect x="200" y="20" width="90" height="60" rx="10" fill="var(--park)"/><g stroke="var(--road)" stroke-width="10" fill="none" stroke-linecap="round"><path d="M-10 60 H330"/><path d="M110 -10 V210"/><path d="M40 -10 L250 210"/></g><circle cx="150" cy="92" r="22" fill="var(--brand)" fill-opacity=".14" stroke="var(--brand)" stroke-opacity=".5" stroke-dasharray="4 4"/><circle cx="150" cy="92" r="10" fill="var(--brand)" stroke="var(--surface)" stroke-width="4"/></svg>`;}
function vDevice(id){
 const x=dev(id);if(!x)return vHome();const off=x.status==='off',a=attn(x);
 const evIc={ok:'check',bad:'nosig',warn:'power',info:'card'};const ch=chans().join(' · ');
 const ev=visEv(x).sort((p,q)=>q[1].localeCompare(p[1]));const fz=frozen(x);const otr=openTr(x);
 const flash=SS.flash&&SS.flash.dev===x.id?`<div class="note ok" role="status" id="t5">${t(SS.flash.code)}</div>`:'';if(SS.flash&&SS.flash.dev===x.id){SS.flash=null;ssave();}
 const fzBox=fz?`<section class="card stack s8" id="fzbox" style="background:var(--warn-bg)"><h2 style="color:var(--warn)">${ic('lock','sm')} ${t('fz_title')}</h2><p>${t('fz_state')}</p><p class="small">${t('L_freeze')}</p><p class="muted small">${t('L_freeze_ref')}</p></section>`:'';
 const offer=x.autoOffFor&&x.autoOffFor.account!==SS.cur&&x.mode==='pkg'?`<div class="note warn">${t('tr_sub_offer')}</div>`:'';
 const ownBox=`<section class="card stack s8" id="ownbox"><h2>${t('d_own')}</h2><p class="muted small">ICCID ${fmtIccid(x.iccid)}</p><p class="muted small">${t('d_since',{date:fdate(iso(new Date(Date.parse(bnd(x).bound_at))))})}</p>
  ${fz||otr?'':`<button class="btn ghost" type="button" data-go="transfer-${x.id}" id="trbtn">${ic('users')} ${t('tr_btn')}</button><button class="btn plain" type="button" data-go="unbind-${x.id}" id="ubbtn" style="color:var(--bad)">${t('ub_btn')}</button>`}</section>`;
 let main='';
 if(off)main=`<a class="btn primary" href="tel:${digits(SELLER)}">${ic('phone')} ${t('call_seller')}</a>`;
 if(x.mode==='none')main+=`<button class="btn ${off?'ghost':'primary'}" type="button" data-go="pay-${x.id}">${ic('key')} ${t('activate')}</button>`;
 else if(x.mode==='sub')main+=`<a class="btn ghost" href="#payments">${ic('refresh')} ${t('ap_btn')}</a>`;
 else main+=(x.auto?`<a class="btn ghost" href="#payments">${ic('refresh')} ${t('ar_on')}</a>`:'')+`<button class="btn ${a==='soon'&&!off&&!x.auto?'primary':'ghost'}" type="button" data-go="pay-${x.id}">${ic('card')} ${a==='soon'?t('renew'):t('prepay')}</button>`;
 const sec=x.type==='alarm'||x.type==='tracker';const steps=x.cause==='jam'?(sec?['d_jam_1','d_jam_2']:['d_lost_1','d_jam_2']):x.cause==='sim'?['d_sim_1','d_jam_2']:['d_power_1','d_power_2'];
 return `${topbar({back:'home'})}<main class="stack s24 fade">
 ${flash}<section class="card bigstatus"><div class="orb ${off?'bad':'ok'}">${ic(DEVICON[x.type],'lg')}</div><h1><button type="button" class="ttl" data-act="rename" data-arg="${x.id}" aria-label="${t('d_rename')}: ${esc(dname(x))}">${esc(dname(x))}${ic('pencil','sm')}</button></h1>${pill(x)}<p class="muted small">${seenTxt(x)} · ${t('beat')}</p></section>
 ${fzBox}${reqBox(x)}${trBox(x)}${offer}${x.cancelled&&!subOf(x)&&x.paidUntil&&d(x.paidUntil)>now()?`<div class="note warn" id="cxnote">${t('cx_dev_note',{date:fdate(x.cancelled.end||x.paidUntil)})}</div>`:''}
 ${x.moved?`<section class="card stack" style="background:var(--bad-bg)"><h2 style="color:var(--bad)">${t('hero_move',{device:esc(dname(x))})}</h2><p>${t('note_move',{t:ftime(x.moved)})}</p><a class="btn primary" href="#map">${ic('pin')} ${t('move_map')}</a><button class="btn ghost" type="button" data-act="moveok" data-arg="${x.id}">${ic('check')} ${t('move_ok')}</button></section>`:''}
 ${off?`<section class="card stack" style="background:var(--bad-bg)"><h2 style="color:var(--bad)">${t('d_what')}</h2><ol class="stack s8" style="margin:0;padding-left:22px">${steps.map(k=>`<li>${t(k)}</li>`).join('')}</ol></section>`:''}
 <div class="stack s8">${main}</div>
 <div class="tiles">
  <div class="tile"><span class="k">${ic(off?'nosig':'signal','sm')}${t('d_conn')}</span><span class="v">${off?t('d_unknown'):t('d_sig')}</span></div>
  <div class="tile"><span class="k">${ic('bell','sm')}${t('d_alerts')}</span><span class="v">${alertsOn()?t('d_alertsOn'):t('d_alertsOff')}</span></div>
  <div class="tile" style="grid-column:1/-1"><span class="k">${ic('card','sm')}${t('d_pay')}</span><span class="v">${payTxt(x)}</span>${x.mode==='sub'||x.auto?`<a class="small" href="#payments" style="color:var(--brand);font-weight:600;display:inline-flex;gap:6px;align-items:center">${ic('refresh','sm')}${t('ar_on')}</a>`:''}</div></div>
 ${fz?`<section class="card stack s8" id="lochidden"><span style="font-weight:600">${t('d_locT')}</span><p class="muted small">${t('fz_title')}</p></section>`:`<section class="card stack"><label class="row" for="loc-${x.id}" style="cursor:pointer"><span class="grow"><span style="display:block;font-weight:600">${t('d_locT')}</span><span class="muted small" style="display:block">${t('d_locS')}</span></span>
  <span class="sw"><input type="checkbox" role="switch" id="loc-${x.id}" data-act="loc" data-arg="${x.id}" ${x.loc&&S.geo?'checked':''}><span></span></span></label>
  ${x.loc&&S.geo?`<div class="map" style="position:relative">${cityTag()}${mapSvg()}</div><p class="muted small" style="display:flex;gap:6px;align-items:center">${ic('pin','sm')}${esc(t('city'))} · ${t('d_locMap')}</p>`:''}</section>`}
 <section class="card stack s8"><h2>${t('d_hist')}</h2><div class="tl">${ev.map(([k,w,c])=>`<div class="e"><span class="dt ${c}">${ic(k==='ev_move'?'pin':evIc[c],'sm')}</span><div><div style="font-weight:600">${t(k)}</div><div class="muted small">${fwhen(w)}</div>${c!=='info'?`<div class="proof">${ic('check','sm')}<span>${esc(t('ev_proof',{ch}))}</span></div>`:''}</div></div>`).join('')}</div></section>${ownBox}</main>${tabs('home')}`;
}
function vPay(id){
 const x=dev(id);if(!x)return vHome();
 if(!S.pay||S.pay.id!==id)S.pay={id,plan:'y',step:'choose'};
 const p=S.pay,pr=prOf(x)[x.plan];const M=n=>mny(x,n);const perMo=v=>curOf(x)==='UAH'?Math.round(v):r2(v);
 if(p.step==='proc')return `<main class="stack s24" style="align-items:center;text-align:center;padding-top:120px"><div class="spinner" role="progressbar" aria-label="${t('p_proc')}"></div><h1 style="font-size:1.3rem">${t('p_proc')}</h1></main>`;
 if(p.step==='ok')return `${topbar()}<main class="stack s24 fade" style="align-items:center;text-align:center;padding-top:32px"><div class="success">${ic('check','lg')}</div><h1>${t('p_ok')}</h1>
  <p class="muted">${p.res==='code'?p.resTxt+'. '+t('p_okS',{device:esc(dname(x)),date:fdate(x.paidUntil)}):p.res==='m'?t('p_okM',{date:fdate(x.next)}):t('p_okS',{device:esc(dname(x)),date:fdate(x.paidUntil)})}</p>${x.auto&&p.res!=='code'&&p.res!=='m'?`<p class="status ok" style="margin:0 auto">${ic('refresh','sm')} ${t('ar_on')}</p><p class="muted small">${t('ar_next',{date:fdate(x.paidUntil)})}</p>`:''}
  <button class="btn primary" type="button" data-act="payback">${t('p_back')}</button><button class="btn plain" type="button" data-act="payhome">${t('p_home')}</button></main>`;
 const plans=PLANS.filter(q=>!(q.k==='m'&&x.mode==='sub'));if(!plans.find(q=>q.k===p.plan))p.plan='y';
 const plan=PLANS.find(q=>q.k===p.plan);const thru=paidThrough(x);const prepaid=!!thru&&d(thru)>now();const base=prepaid?thru:today();
 const deferred=p.plan==='m'&&prepaid;const price=deferred?0:pr[p.plan];const until=addMonths(base,plan.mo);
 const label=deferred?t('p_enable'):t('p_pay',{sum:M(price)});
 if(p.step==='card')return `${topbar({back:true,backAct:'cardback'})}<main class="stack s24 fade"><h1>${t('p_card')}</h1>
  <form class="stack" data-form="card" novalidate>
   <label class="f" for="cn">${t('p_cardno')}<input class="inp" id="cn" inputmode="numeric" autocomplete="cc-number" value="${esc(p.cn!=null?p.cn:'4242 4242 4242 4242')}" maxlength="19" ${p.err?'aria-invalid="true" aria-describedby="cnh"':''}></label>
   ${p.err?`<span id="cnh" class="err">${ic('alert','sm')}<span>${t('p_cardErr')}</span></span>`:''}
   <div class="row" style="align-items:flex-start;flex-wrap:wrap"><label class="f grow" for="ce" style="min-width:130px">${t('p_exp')}<input class="inp" id="ce" inputmode="numeric" value="12/29" maxlength="5"></label><label class="f grow" for="cv" style="min-width:130px">${t('p_cvv')}<input class="inp" id="cv" type="password" inputmode="numeric" value="123" maxlength="4"></label></div>
   ${p.plan==='m'?`<p class="note" style="background:var(--brand-soft);color:var(--ink)">${t('ar_hintM',{sum:M(pr.m)})}</p>`:`<label class="agr" for="ar"><input type="checkbox" id="ar" ${p.ar?'checked':''}><span><b>${t('ar_label')}</b><br><span class="muted small">${t('ar_hint',{sum:M(pr[p.plan])})}</span></span></label>`}
   <div class="democard">${ic('flask','sm')}<span>${t('p_demo')}</span></div>
   <div class="sum"><span class="muted">${deferred?t('p_today'):t('p_total')}</span><b>${M(price)}</b></div>${vatLine(x,price)}
   <button class="btn primary" type="submit">${ic('lock','sm')} ${label}</button></form></main>`;
 const cv=p.code||'';const pc=cv?parseCode(cv):null;const cerr=p.cerr;
 const dec=pc&&!pc.err?`<p class="small" style="color:var(--ok);font-weight:600;display:flex;gap:6px;align-items:center">${ic('check','sm')}${t('c_dec',{a:PLN[pc.plan],term:termTxt(pc.months)})}</p>`:'';
 const codeBlock=`<section class="card stack"><h2 style="font-size:1.1rem">${t('c_title')}</h2><form class="stack" data-form="actcode" novalidate>
  <label class="f" for="ac">${t('c_label')}<input class="inp" id="ac" maxlength="19" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-XXXX-XXXX" value="${esc(cv)}" style="letter-spacing:.04em;font-weight:700;font-variant-numeric:tabular-nums;font-size:1.05rem;padding:0 14px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace" ${cerr?'aria-invalid="true" aria-describedby="ach"':''}></label>
  <div id="acd">${cerr?`<span id="ach" class="err">${ic('alert','sm')}<span>${cerr}</span></span>`:dec}</div>
  <button class="btn primary" type="submit">${ic('key')} ${t('c_btn')}</button><button class="btn plain small" type="button" data-act="democode">${ic('flask','sm')} ${t('c_demo')}</button></form></section>
  <div class="row" style="gap:12px"><span style="flex:1;height:1px;background:var(--line)"></span><span class="muted small">${t('or_pay')}</span><span style="flex:1;height:1px;background:var(--line)"></span></div>`;
 let body;
 {
  const rows=plans.map(q=>{const v=pr[q.k];const sv=pr.m*q.mo-v;const sel=p.plan===q.k;
   return `<button type="button" class="plan" role="radio" aria-checked="${sel}" data-act="plan" data-arg="${q.k}"><span class="radio">${sel?ic('check','sm'):''}</span><span class="grow"><span style="display:block;font-weight:700">${t('p_'+q.k)}</span><span class="muted small" style="display:block">${q.k==='m'?t('p_mS'):t('p_permonth',{sum:M(perMo(v/q.mo))})}</span></span><span class="pr"><span class="price" style="display:block" data-price="${q.k}">${M(v)}</span>${sv>0?`<span class="save" style="display:block">${t('p_save',{p:Math.round(sv/(pr.m*q.mo)*100)})}</span>`:''}</span></button>`;}).join('');
  const info=p.plan==='m'?(deferred?t('p_mStart',{date:fdate(thru)}):t('p_mNext',{date:fdate(addMonths(today(),1))})):(prepaid?t('p_add',{to:fdate(until)}):t('p_until',{date:fdate(until)}));
  const amt=deferred?t('p_enable'):M(price);
  body=`<div class="stack" role="radiogroup" aria-label="${t('p_title')}" style="gap:12px">${rows}</div>
  <div class="card stack s8"><div class="sum"><span class="muted">${deferred?t('p_today'):t('p_total')}</span><b id="ptotal">${M(price)}</b></div><p class="muted small">${info}</p>${vatLine(x,price)}</div>
  <div class="stack s8"><button class="paybtn" type="button" data-act="wallet">Apple Pay · ${amt}</button><button class="paybtn alt" type="button" data-act="wallet">Google Pay · ${amt}</button><button class="btn ghost" type="button" data-act="tocard">${ic('card')} ${t('p_card')}</button></div>
  <p class="muted small" style="display:flex;gap:8px">${ic('sim','sm')}<span>${t('p_sim')}</span></p>
  <p class="muted small" style="text-align:center">${t('pay_terms')} <button type="button" class="lnk" data-act="doc" data-arg="terms">${t('ag_terms')}</button>.</p>`;}
 // EUT 7 v12: no suspension / SIM deactivation for an unpaid subscription — shown while the device has no paid period
 const s7=!prepaid&&!codePlanActive(x)?`<section class="card stack s8" id="eut7"><p class="small">${t('L_s7')}</p><p class="muted small">${t('L_s7_ref')}</p></section>`:'';
 body=(codePlanActive(x)?`<div class="note ok" id="planactive">${ic('check','sm')} ${payTxt(x)}</div>`:codeBlock)+body+s7;
 return `${topbar({back:'device-'+id})}<main class="stack s24 fade"><div class="stack s8"><h1>${t('p_title')}</h1><p class="muted">${t('p_for',{device:esc(dname(x))})}</p></div>${body}</main>`;
}
const defCard=()=>S.cards.find(c=>c.def)||S.cards[0];
function addCard(num,exp){const l4=digits(num).slice(-4);let c=S.cards.find(x=>x.last4===l4);if(!c){c={id:'c'+Date.now().toString(36),last4:l4,exp:exp||'12/29',def:!S.cards.length};S.cards.push(c);}return c;}
function addTx(o){S.tx.unshift(Object.assign({ts:isoT(now())},o));}
function autoItems(){const a=[];S.devices.forEach(x=>{const pr=prOf(x)[x.plan];if(x.mode==='sub')a.push({x,kind:'m',date:x.next,sum:pr.m});else if(x.mode==='pkg'&&x.auto)a.push({x,kind:'p',date:x.paidUntil,sum:pr[x.auto.plan],term:t('p_'+x.auto.plan)});});return a;}
function vPayments(){const it=autoItems();const dc=defCard();
 const txIcon=o=>o.ok?'check':'alert';
 return `${topbar({back:'profile'})}<main class="stack s24 fade"><div class="stack s8"><h1>${t('pm_title')}</h1><p class="muted">${t('pm_sub')}</p></div>
 ${it.length?`<div class="list">${it.map(o=>`<div class="li" style="flex-wrap:wrap"><span class="ic brand">${ic(DEVICON[o.x.type])}</span><div class="grow"><div class="t">${esc(dname(o.x))}</div><div class="s">${o.kind==='m'?t('pm_kindM'):t('pm_kindP',{term:o.term})}${dc?' · '+t('pm_from',{c:dc.last4}):''}</div><div class="s">${t('pm_next',{date:fdate(o.date),sum:mny(o.x,o.sum)})}</div></div><button class="btn danger auto small" type="button" data-act="aroffq" data-arg="${o.x.id}" style="min-height:44px">${t('pm_off')}</button></div>`).join('')}</div>`:`<p class="muted">${t('pm_none')}</p>`}
 <a class="btn plain" href="#cancel" data-act="cxopen" id="cxacc">${ic('x','sm')} ${t('cx_link')}</a>
 <section class="stack s8"><h2>${t('cards')}</h2><div class="list">${S.cards.map(c=>`<div class="li" style="flex-wrap:wrap"><span class="ic">${ic('card')}</span><div class="grow"><div class="t">•••• ${c.last4} ${c.def?`<span class="status ok" style="padding:2px 10px;font-size:.8rem;margin-left:6px">${t('card_def')}</span>`:''}</div><div class="s">${t('card_exp',{d:esc(c.exp)})}</div></div>
  <div class="row" style="gap:4px">${c.def?'':`<button class="btn plain auto small" type="button" data-act="carddef" data-arg="${c.id}">${t('card_mkdef')}</button>`}<button class="btn plain auto small" type="button" data-act="carddel" data-arg="${c.id}" style="color:var(--bad)">${t('card_del')}</button></div></div>`).join('')||`<div class="li muted">${t('card_none')}</div>`}
  <button class="li" type="button" data-act="cardadd"><span class="ic brand">${ic('plus')}</span><span class="grow t">${t('card_add')}</span></button></div></section>
 <section class="stack s8"><h2>${t('tx_title')}</h2>${S.tx.length?`<div class="list">${S.tx.map((o,i)=>{const d=dev(o.dev);const cur=o.cur||(d?curOf(d):'UAH');return `<div class="li" style="flex-wrap:wrap" data-tx="${i}"><span class="dt ${o.ok?'ok':'bad'}">${ic(txIcon(o),'sm')}</span><div class="grow"><div class="t">${o.sum?money(o.sum,cur):esc(o.desc)}</div><div class="s">${d?esc(dname(d)):''}${o.sum?' · '+esc(o.desc):''}</div><div class="s">${fwhen(o.ts)} · ${o.via==='code'?t('tx_code'):o.via==='wallet'?t('tx_wallet'):'•••• '+o.card}</div>${o.sum&&o.oss?ossHtml(o.oss,cur,'div'):o.sum&&d?vatLine(d).replace('<p class="muted small"','<div class="s"').replace('</p>','</div>'):''}${o.sum&&o.ok?`<button class="lnk small" type="button" data-act="receipt" data-arg="${i}">${t('rc_btn')}</button>`:''}${o.ok?'':`<div class="s" style="color:var(--bad);font-weight:600">${t('tx_fail')}: ${t('tx_reason')}</div>`}</div>${o.ok?`<span class="small" style="color:var(--ok);font-weight:600">${t('tx_ok')}</span>`:o.retried?`<span class="small muted" style="font-weight:600">${t('tx_retried_l')}</span>`:`<button class="btn primary auto small" type="button" data-act="txretry" data-arg="${i}" style="min-height:44px">${t('tx_retry')}</button>`}</div>`;}).join('')}</div>`:`<p class="muted">${t('tx_none')}</p>`}</section>
 </main>`;}
function vAlerts(){
 const rows=[['lost','nosig','a_lost','a_lostS'],['off','power','a_off','a_offS'],['sim','sim','a_sim','a_simS'],['move','pin','a_move','a_moveS'],['pay','card','a_pay','a_payS']];
 const recent=[];S.devices.forEach(x=>visEv(x).forEach(e=>{if(e[2]!=='info')recent.push([x,e]);}));recent.sort((a,b)=>b[1][1].localeCompare(a[1][1]));
 const icn={bad:'nosig',warn:'power',ok:'check'};
 return `${topbar()}<main class="stack s24 fade"><div class="stack s8"><h1>${t('a_title')}</h1><p class="muted">${t('a_sub')}</p></div>
 <section class="stack s8"><h2>${t('a_recent')}</h2>${recent.length?`<div class="list">${recent.slice(0,6).map(([x,e])=>`<a class="li" href="#device-${x.id}"><span class="dt ${e[2]}">${ic(e[0]==='ev_remind'?'card':e[0]==='ev_move'?'pin':icn[e[2]],'sm')}</span><div class="grow"><div class="t">${t(e[0])}</div><div class="s">${esc(dname(x))} · ${fwhen(e[1])}</div></div>${ic('right','chev')}</a>`).join('')}</div>`:`<p class="muted">${t('a_none')}</p>`}</section>
 <section class="stack s8"><h2>${t('a_settings')}</h2><div class="list">${rows.map(([k,i,a,b])=>`<label class="li" for="al-${k}"><span class="ic">${ic(i)}</span><span class="grow"><span class="t" style="display:block">${t(a)}</span><span class="s" style="display:block">${k==='pay'?t('a_payS',{list:remList()}):t(b)}</span></span><span class="sw"><input type="checkbox" role="switch" id="al-${k}" data-act="alert" data-arg="${k}" ${S.alerts[k]?'checked':''}><span></span></span></label>`).join('')}
 ${S.alerts.pay?`<div style="padding:4px 18px 18px;border-top:1px solid var(--line)"><p class="tag" style="margin:12px 0 10px">${t('r_when')}</p><div class="chips">${RD.map(n=>`<button type="button" class="chip" data-act="rem" data-arg="${n}" aria-pressed="${S.remind.includes(n)}">${ic('check','sm ck')}${n} ${pf(n,'day')}</button>`).join('')}</div></div>`:''}</div></section>
 <section class="stack s8"><h2>${t('a_where')}</h2><div class="list">
  <div class="li"><span class="ic">${ic('mail')}</span><div class="grow"><div class="t">${t('a_mail')}</div><div class="s">${S.mute.email?t('ch_paused'):esc(S.email)}</div></div><span class="sw"><input type="checkbox" role="switch" data-act="chsw" data-arg="email" aria-label="${t('a_mail')}" ${S.mute.email?'':'checked'}><span></span></span></div>
  ${MSG.map(m=>S.msgs.includes(m)?`<div class="li"><span class="ic">${ic('msg')}</span><div class="grow"><div class="t">${m}</div><div class="s">${S.mute[m]?t('ch_paused'):esc(S.phones[m]||'')}</div></div><span class="sw"><input type="checkbox" role="switch" data-act="chsw" data-arg="${m}" aria-label="${m}" ${S.mute[m]?'':'checked'}><span></span></span></div>`:`<a class="li" href="#contacts"><span class="ic">${ic('msg')}</span><div class="grow"><div class="t">${m}</div><div class="s">${t('none')}</div></div><span class="small" style="color:var(--brand);font-weight:600">${t('ch_add')}</span></a>`).join('')}
  ${S.family.map((m,i)=>`<div class="li"><span class="ic">${ic('users')}</span><a class="grow" href="#fam-${i}" style="color:inherit;text-decoration:none"><div class="t">${esc(m.name)}</div><div class="s">${m.off?t('ch_paused'):esc(famLine(m))}</div></a><span class="sw"><input type="checkbox" role="switch" data-act="chsw" data-arg="fam:${i}" aria-label="${esc(m.name)}" ${m.off?'':'checked'}><span></span></span></div>`).join('')}
  <a class="li" href="#fam-new"><span class="ic brand">${ic('plus')}</span><div class="grow t">${S.family.length?t('fam_more'):t('fam_add')}</div></a></div>
  <a class="btn plain" href="#contacts">${t('a_edit')}</a></section></main>${tabs('alerts')}`;
}
function helpBlock(){
 return `<section class="stack s8" id="help"><h2>${t('h_title')}</h2><div class="card stack"><div class="row"><span class="ic brand">${ic('user')}</span><div class="grow"><div class="muted small">${t('h_seller')}</div><div style="font-weight:700">${t('h_sellerN')}</div><div class="muted small">${t('h_hours')}</div></div></div>
  <p id="sellerNum" style="font-size:1.4rem;font-weight:700;font-variant-numeric:tabular-nums;user-select:all" class="nw">${SELLER}</p>
  <div class="row" style="flex-wrap:wrap"><a class="btn primary grow" style="min-width:210px" href="tel:${digits(SELLER)}">${ic('phone')} ${t('h_call')}</a><button class="btn ghost auto" type="button" data-act="copy">${ic('copy')} ${t('h_copy')}</button></div><p class="muted small">${t('h_msg')}</p></div>
 <h3 style="margin-top:8px">${t('h_faq')}</h3>${[1,2,3,4,5].map(i=>`<details class="faq"><summary>${t('q'+i)}${ic('right','chev')}</summary><p>${t(i===4?'a4b':'a'+i)}</p></details>`).join('')}</section>`;
}
function cityTag(){return `<div style="position:absolute;left:12px;top:12px;background:var(--surface);padding:6px 12px;border-radius:999px;font-weight:700;font-size:.85rem;box-shadow:var(--shadow);display:flex;gap:6px;align-items:center">${ic('pin','sm')}${esc(t('city'))}</div>`;}
function mapPins(list){const pos=[[110,96],[218,70],[176,150],[70,160],[262,138],[140,42]];
 return `<svg viewBox="0 0 320 200" aria-hidden="true" preserveAspectRatio="xMidYMid slice"><rect width="320" height="200" fill="var(--map)"/><path d="M0 150 C60 135 90 170 150 160 S260 120 320 135 L320 200 L0 200z" fill="var(--water)"/><rect x="200" y="20" width="90" height="60" rx="10" fill="var(--park)"/><g stroke="var(--road)" stroke-width="10" fill="none" stroke-linecap="round"><path d="M-10 60 H330"/><path d="M110 -10 V210"/><path d="M40 -10 L250 210"/></g><g stroke="var(--road)" stroke-width="5" fill="none" stroke-linecap="round"><path d="M-10 115 H200"/><path d="M190 -10 V130"/></g>
 ${list.map((x,i)=>{let [cx,cy]=pos[i%pos.length];if(x.moved){cx=Math.min(300,cx+46);cy=Math.max(20,cy-30);}const col=x.status==='off'||x.moved?'var(--bad)':'var(--brand)';return `<circle cx="${cx}" cy="${cy}" r="17" fill="${col}" fill-opacity=".16"/><circle cx="${cx}" cy="${cy}" r="12" fill="${col}" stroke="var(--surface)" stroke-width="3"/><text x="${cx}" y="${cy+4}" text-anchor="middle" font-size="11" font-weight="800" fill="#fff" font-family="system-ui">${i+1}</text>`;}).join('')}</svg>`;}
function vMap(){
 if(!S.geo)return `${topbar()}<main class="stack s24 fade"><h1>${t('m_title')}</h1>
 <section class="card stack" style="align-items:center;text-align:center;padding:28px 20px"><span class="ic brand" style="width:72px;height:72px;border-radius:22px">${ic('pin','lg')}</span><h2>${t('m_ask')}</h2><p class="muted">${t('m_askS')}</p>
 <button class="btn primary" type="button" data-act="geo">${ic('check')} ${t('m_allow')}</button><p class="muted small">${t('m_note')}</p></section></main>${tabs('map')}`;
 const shown=S.devices.filter(x=>x.loc&&!frozen(x)),hidden=S.devices.filter(x=>!x.loc||frozen(x));
 return `${topbar()}<main class="stack s24 fade"><h1>${t('m_title')}</h1>
 <div class="map" style="aspect-ratio:4/3;position:relative">${cityTag()}${mapPins(shown)}</div><p class="muted small" style="display:flex;gap:6px;align-items:center">${ic('pin','sm')}${esc(t('city'))} · ${t('m_approx')}</p>
 <div class="list">${shown.map((x,i)=>`<a class="li" href="#device-${x.id}"><span class="dt ${x.status==='off'?'bad':'info'}" style="font-weight:800">${i+1}</span><div class="grow"><div class="t">${esc(dname(x))}</div><div class="s">${x.status==='off'?t('st_off'):t('st_ok')} · ${seenTxt(x)}</div></div>${ic('right','chev')}</a>`).join('')}
 ${hidden.map(x=>`<a class="li" href="#device-${x.id}"><span class="dt info">${ic(DEVICON[x.type],'sm')}</span><div class="grow"><div class="t">${esc(dname(x))}</div><div class="s">${frozen(x)?t('fz_title'):t('m_hidden')}</div></div>${ic('right','chev')}</a>`).join('')}</div>
 <button class="btn plain" type="button" data-act="geooff" style="color:var(--bad)">${t('m_off')}</button></main>${tabs('map')}`;
}
function vProfile(){
 return `${topbar()}<main class="stack s24 fade"><h1>${t('pr_title')}</h1>
 <div class="list"><button class="li" type="button" data-act="editname"><span class="ic">${ic('user')}</span><div class="grow"><div class="s">${t('pr_name')}</div><div class="t">${S.name?esc(S.name):t('none')}</div></div><span class="muted small">${t('pr_edit')}</span></button></div>
 <div class="list"><a class="li" href="#payments"><span class="ic">${ic('refresh')}</span><div class="grow"><div class="t">${t('pm_title')}</div><div class="s">${autoItems().length?autoItems().map(o=>esc(dname(o.x))).join(', '):t('pm_none')}</div></div>${ic('right','chev')}</a></div>
 <section class="stack s8" id="signin"><h2>${t('sc_title')}</h2><p class="muted small">${t('sc_hint')}</p><div class="list">
  <a class="li" href="#signin-email"><span class="ic">${ic('mail')}</span><div class="grow"><div class="s">${t('email')}</div><div class="t">${acct().email?esc(acct().email):t('none')}</div></div>${ic('right','chev')}</a>
  <a class="li" href="#signin-phone"><span class="ic">${ic('phone')}</span><div class="grow"><div class="s">${t('sc_phone')}</div><div class="t">${acct().phone?esc(cShow({k:'p',v:acct().phone})):t('none')}</div></div>${ic('right','chev')}</a>
  <a class="li" href="#log"><span class="ic">${ic('key')}</span><div class="grow t">${t('lg_title')}</div>${ic('right','chev')}</a></div></section>
 <section class="stack s8"><h2>${t('c_edit')}</h2><div class="list">
  <a class="li" href="#contacts"><span class="ic">${ic('mail')}</span><div class="grow"><div class="s">${t('email')}</div><div class="t">${esc(S.email)}</div></div>${ic('right','chev')}</a>
  ${MSG.map(m=>`<a class="li" href="#contacts"><span class="ic">${ic('msg')}</span><div class="grow"><div class="s">${m}</div><div class="t">${S.msgs.includes(m)?esc(S.phones[m]||''):t('none')}</div></div>${S.msgs.includes(m)?ic('right','chev'):`<span class="small" style="color:var(--brand);font-weight:600">${t('ch_add')}</span>`}</a>`).join('')}
</div></section>
 <section class="stack s8"><h2>${t('fam_list')}</h2><div class="list">${S.family.map((m,i)=>`<a class="li" href="#fam-${i}"><span class="ic">${ic('users')}</span><div class="grow"><div class="t">${esc(m.name)}</div><div class="s">${esc(famLine(m))}</div></div>${ic('right','chev')}</a>`).join('')}
  <a class="li" href="#fam-new"><span class="ic brand">${ic('plus')}</span><div class="grow t">${S.family.length?t('fam_more'):t('fam_add')}</div></a></div></section>
 <section class="stack s8"><h2>${t('language')}</h2><div class="list"><button class="li" type="button" data-act="lang"><span class="ic">${ic('globe')}</span><span class="grow t">${T[S.lang].lang}</span>${ic('right','chev')}</button></div></section>
 ${helpBlock()}
 <section class="stack s8"><h2>${t('docs')}</h2><div class="list"><button class="li" type="button" data-act="doc" data-arg="terms"><span class="ic">${ic('help')}</span><span class="grow t">${t('doc_terms')}</span>${ic('right','chev')}</button><button class="li" type="button" data-act="doc" data-arg="priv"><span class="ic">${ic('lock')}</span><span class="grow t">${t('doc_priv')}</span>${ic('right','chev')}</button></div></section>
 <div id="logoutBox"><button class="btn plain" type="button" data-act="logout" style="color:var(--bad)">${ic('logout')} ${t('pr_logout')}</button></div></main>${tabs('profile')}`;
}

function build(){
 BC=null;let h=(location.hash||'').slice(1);const rp=x=>{h=x;history.replaceState(null,'','#'+x);};
 if(h.startsWith('/l/'))rp('b/'+h.slice(3));
 const pub=h==='welcome'||h==='otp'||h==='cancel'||h.startsWith('/t/')||h.startsWith('b/')||h.startsWith('/a/');   // v12: #cancel works without login (§ 312k BGB)
 if(h==='code'&&!acct()){SS.ret='code';ssave();}
 if(h.startsWith('/a/')){const c=normCode(decodeURIComponent(h.slice(3)));if(c&&('/a/'+c)!==h)rp('/a/'+c);if(!acct()){SS.ret='/a/'+c;ssave();}}
 if(!acct()){if(!pub)rp('welcome');}
 else{if(h==='welcome'||!h)rp(S.onboarded?'home':'start-1');
  if(!S.onboarded&&!['start-1','add','otp','contacts','cancel'].includes(h)&&!h.startsWith('/')&&!h.startsWith('b/'))rp('start-1');
  if(S.onboarded&&h==='start-1')rp('home');
  if(h==='start-done'&&!S.justDone)rp('home');}
 if(dueList(B()).length&&!dueBusy)processDue().then(ch=>{if(ch)rerender();});
 if(!h.startsWith('pay-')&&S.pay&&S.pay.step!=='proc')S.pay=null;
 let v,tb=true;const A1=()=>{tb=false;};
 if(h==='welcome'||(!acct()&&h.startsWith('/a/'))){v=vSignin();A1();}
 else if(h==='otp'){v=vOtp();A1();}
 else if(h.startsWith('/t/')){v=vAccept(h.slice(3));A1();}
 else if(h.startsWith('b/')){v=vLink(h.slice(2));A1();}
 else if(h.startsWith('/a/')){v=vActivate(h.slice(3));A1();}
 else if(h==='cancel'){v=vCancel();A1();}
 else if(h==='code'){v=vCode();A1();}
 else if(h==='add'){v=vAdd();A1();}
 else if(h==='start-1'){v=vContacts('ob');A1();}else if(h==='start-done'){v=vDone();A1();}
 else if(h==='contacts'){v=vContacts('edit');A1();}
 else if(h.startsWith('signin-')){v=vChg(h.slice(7)==='phone'?'phone':'email');A1();}
 else if(h==='log'){v=vLog();A1();}
 else if(h.startsWith('transfer-')){v=vTransfer(h.slice(9));A1();}
 else if(h.startsWith('unbind-')){v=vUnbind(h.slice(7));A1();}
 else if(h.startsWith('fam-')){v=vFam(h.slice(4));A1();}
 else if(h==='payments'){v=vPayments();A1();}
 else if(h.startsWith('device-'))v=vDevice(h.slice(7));else if(h.startsWith('pay-')){v=vPay(h.slice(4));A1();}
 else if(h==='alerts')v=vAlerts();else if(h==='map')v=vMap();else if(h==='help'){v=vProfile();setTimeout(()=>{const e=document.getElementById('help');if(e)e.scrollIntoView();},0);}else if(h==='profile')v=vProfile();else v=vHome();
 const ix=v.lastIndexOf('</main>');if(ix>=0&&!v.includes('class="spinner"'))v=v.slice(0,ix)+footer()+v.slice(ix);   // v12: footer with the cancellation button on every page
 app.className='shell'+(tb?'':' notabs');app.innerHTML=v;document.documentElement.lang=S.lang;
 const h1=app.querySelector('h1');document.title=(h1?h1.textContent.trim()+' · ':'')+'CONNECT';save();
}
function render(inPlace){
 const y=window.scrollY;let key=null;const ae=document.activeElement;
 if(inPlace&&ae&&app.contains(ae))key=ae.id?'#'+CSS.escape(ae.id):(ae.dataset&&ae.dataset.act?`[data-act="${ae.dataset.act}"]${ae.dataset.arg!=null?`[data-arg="${ae.dataset.arg}"]`:''}`:null);
 build();
 if(inPlace){window.scrollTo(0,y);if(key){const el=app.querySelector(key);if(el)el.focus({preventScroll:true});}}
 else{window.scrollTo(0,0);const h1=app.querySelector('h1');if(h1){h1.tabIndex=-1;h1.focus({preventScroll:true});}}
}
const rerender=()=>render(true);
function go(h){closeOverlay(true);if(location.hash==='#'+h)render(false);else location.hash=h;}
window.addEventListener('hashchange',()=>{actDone=null;if(location.hash!=='#cancel'&&SS.cx){SS.cx=null;ssave();}if(location.hash!=='#code'&&SS.pk){SS.pk=null;ssave();}closeOverlay(true);render(false);});

let tt;function toast(msg,ms){const el=document.getElementById('toast');el.innerHTML=ic('check','sm')+'<span>'+msg+'</span>';el.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>el.classList.remove('show'),ms||3200);}
let pt;const pushEl=document.getElementById('push');
function push(text,via0){const via=via0||S.msgs[0]||t('a_mail');
 pushEl.innerHTML=`<span aria-hidden="true" style="flex:none">${LOGO}</span><span class="grow"><span style="display:block;font-weight:700;font-size:.9rem">${esc(via)} · ${esc(t('brand'))} CONNECT <span class="muted" style="font-weight:500">· ${t('seen_now')}</span></span><span style="display:block;font-size:.95rem">${esc(text)}</span></span><button class="x" type="button" data-act="closepush" aria-label="${t('close')}">${ic('x','sm')}</button>`;
 pushEl.hidden=false;requestAnimationFrame(()=>requestAnimationFrame(()=>pushEl.classList.add('show')));clearTimeout(pt);pt=setTimeout(hidePush,10000);}
function hidePush(){pushEl.classList.remove('show');setTimeout(()=>{if(!pushEl.classList.contains('show'))pushEl.hidden=true;},460);}
const overlay=document.getElementById('overlay');let lastFocus=null;
let scanStop=null;
function closeOverlay(silent){if(scanStop){scanStop();scanStop=null;}if(!overlay.innerHTML)return;overlay.innerHTML='';if(!silent&&lastFocus&&document.contains(lastFocus))lastFocus.focus();lastFocus=null;}
function sheet(title,body){if(!overlay.innerHTML)lastFocus=document.activeElement;
 overlay.innerHTML=`<div class="sheetbg" data-act="closeov"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="shT"><h2 id="shT">${title}</h2>${body}</div></div>`;
 const f=overlay.querySelector('.sheet input,.sheet button,.sheet a');if(f)f.focus();}
function alarm(x,kind){if(!overlay.innerHTML)lastFocus=document.activeElement;const tm=ftime(isoT(now()));
 overlay.innerHTML=`<div class="alarm" role="alertdialog" aria-modal="true" aria-labelledby="alh" aria-describedby="als"><div class="in">
 <div class="row between"><span style="font-weight:800;letter-spacing:.12em;font-size:13px">${esc(t('brand'))} CONNECT</span><span style="font-weight:700">${tm}</span></div>
 <div class="mid"><div class="siren">${ic('alert','lg')}</div><p style="font-weight:800;letter-spacing:.14em;text-transform:uppercase;font-size:.9rem">${t('al_title')}</p>
 <h1 id="alh" style="font-size:1.9rem">${t(kind==='sim'?'al_sim':kind==='move'?'al_move':'al_lost',{device:esc(dname(x))})}</h1><p id="als" style="font-size:1.08rem">${t(kind==='move'?'al_subMove':(x.type==='alarm'||x.type==='tracker')?'al_sub':'al_sub2',{time:tm})}</p>
 <div class="stack s8" style="align-items:center"><p style="font-size:.92rem">${t('al_sent')}</p><div class="sent">${chans().map(c=>`<span>${ic('check','sm')}${esc(c)}</span>`).join('')}</div></div></div>
 <div class="stack s8"><button class="btn light" type="button" data-act="alarmdev" data-arg="${x.id}">${t('al_what')}</button>
 <a class="btn line" href="tel:${digits(SELLER)}"><span style="display:flex;gap:8px;align-items:center">${ic('phone','sm')} ${t('call_seller')}</span><span class="nw" style="font-weight:600;opacity:.9">${SELLER}</span></a>
 <button class="btn line" type="button" data-act="alarmok">${t('al_ok')}</button></div></div></div>`;
 overlay.querySelector('.alarm button').focus();}

let labDev=null;
function lab(){const ds=S.devices;if(!labDev||!dev(labDev))labDev=ds[0]?ds[0].id:null;
 const evs=[['lost','nosig','x_lost'],['off','power','x_off'],['sim','sim','x_sim'],['move','pin','x_move'],['back','check','x_back'],['pay','card','x_pay'],['fail','alert','x_fail'],['test','bell','x_test']];
 sheet(t('x_title'),`<p class="muted">${t('x_sub')}</p>
 ${ds.length>1?`<div class="stack s8"><span class="tag">${t('x_dev')}</span><div class="chips">${ds.map(x=>`<button type="button" class="chip" data-act="labdev" data-arg="${x.id}" aria-pressed="${x.id===labDev}">${ic(DEVICON[x.type],'sm')}${esc(dname(x))}</button>`).join('')}</div></div>`:''}
 <div class="list">${evs.map(([k,i,l])=>`<button class="evbtn" type="button" data-act="sim" data-arg="${k}"><span class="ic">${ic(i)}</span><span class="grow">${t(l)}</span>${ic('right','chev')}</button>`).join('')}</div>
 <span class="tag">${t('x_more')}</span>
 <span class="tag">${t('x_own')}</span>
 <div class="list">${[['ff','60','refresh','x_ff1'],['ff','1440','refresh','x_ff24']].concat(labDev?[['labfreeze',labDev,'lock',frozen(dev(labDev))?'x_unfreeze':'x_freeze'],['labreq',labDev,'alert','x_req']]:[]).concat([['lablink','','users','x_link'],['labgolog','','key','x_log']]).map(([a,g,i,l])=>`<button class="evbtn" type="button" data-act="${a}" data-arg="${g}"><span class="ic">${ic(i)}</span><span class="grow">${t(l)}</span></button>`).join('')}</div>
 <form class="stack s8" data-form="delay" novalidate><label class="f" for="dl">${t('x_delay',{cc:'UA'})}<input class="inp" id="dl" inputmode="numeric" value="${delayHours(genIccid(1))}" style="height:52px"></label><span id="dlh"></span><button class="btn ghost" type="submit">${t('save')}</button></form>
 <span class="tag">${t('x_more')}</span>
 <span class="tag">${t('x_de')}</span>
 <div class="list"><button class="evbtn" type="button" data-act="labde" id="labde"><span class="ic">${ic('globe')}</span><span class="grow">${t(ccOpen('DE')?'x_de_close':'x_de_open')}</span></button></div>
 <div class="list"><button class="evbtn" type="button" data-act="labadd"><span class="ic">${ic('plus')}</span><span class="grow">${t('x_add')}</span></button><button class="evbtn" type="button" data-act="labreset"><span class="ic">${ic('refresh')}</span><span class="grow">${t('x_reset')}</span></button></div>
 <button class="btn plain" type="button" data-act="closeov">${t('close')}</button>`);}
function simulate(kind){const x=dev(labDev);if(!x){closeOverlay(true);return;}
 const map={lost:'lost',off:'off',sim:'sim',move:'move',back:'lost',pay:'pay',fail:'pay'};
 if(kind==='move'&&x.type==='tracker'){closeOverlay(true);toast(t('x_moveNA'));return;}
 if(kind!=='test'&&kind!=='back'&&!S.alerts[map[kind]]){closeOverlay(true);toast(t('x_muted'));return;}
 S.tick+=1;const ts=isoT(now());const tm=ftime(ts);const v={d:dname(x),t:tm};
 closeOverlay(true);
 if(kind==='test'){push(t('pe_test'));save();return;}
 if(kind==='fail'){const c=defCard()||addCard('4242424242424242');const pr=prOf(x)[x.plan];const sum=x.mode==='sub'?pr.m:pr[(x.auto&&x.auto.plan)||'y'];addTx({dev:x.id,desc:x.mode==='sub'?t('pm_kindM'):t('pm_kindP',{term:t('p_'+((x.auto&&x.auto.plan)||'y'))}),sum,cur:curOf(x),ok:false,via:'card',card:c.last4});x.ev.push(['ev_payfail',ts,'bad']);save();render(true);push(t('pe_fail',{d:dname(x),sum:mny(x,sum),c:c.last4}));return;}
 if(kind==='lost'||kind==='off'||kind==='sim'){x.status='off';x.cause={lost:'jam',off:'power',sim:'sim'}[kind];x.offAt=ts;x.ev.push([{lost:'ev_lost',off:'ev_off',sim:'ev_sim'}[kind],ts,kind==='off'?'warn':'bad']);}
 if(kind==='back'){x.status='ok';delete x.cause;delete x.offAt;x.ev.push(['ev_restored',ts,'ok']);}
 if(kind==='pay'){x.ev.push(['ev_remind',ts,'warn']);}
 if(kind==='move'){x.moved=ts;x.ev.push(['ev_move',ts,'bad']);}
 save();render(true);
 const rn=Math.max(...S.remind);v.n=rn;v.u=pf(rn,'day');push(t({lost:'pe_lost',off:'pe_off',sim:'pe_sim',move:'pe_move',back:'pe_back',pay:'pe_pay'}[kind],v));
 if(kind==='lost'||kind==='sim'||kind==='move')setTimeout(()=>alarm(x,kind),900);
}

const A={
 lang(){const order=['uk','ru','en'].concat(LANGS.filter(l=>!['uk','ru','en'].includes(l)).sort((a,b)=>T[a].lang.localeCompare(T[b].lang)));
  sheet(t('language'),`<input class="inp" id="lq" type="search" placeholder="🔍" autocomplete="off" aria-label="${t('language')}" style="height:52px;font-size:1rem"><div class="list" id="ll" style="max-height:55vh;overflow:auto">${order.filter(l=>T[l]).map(l=>`<button class="li" type="button" data-act="setlang" data-arg="${l}" lang="${l}" data-q="${esc((T[l].lang+' '+l).toLowerCase())}" style="min-height:56px"><span class="grow t">${T[l].lang}</span><span class="muted small">${l.toUpperCase()}</span>${S.lang===l?ic('check'):''}</button>`).join('')}</div><button class="btn plain" type="button" data-act="closeov">${t('close')}</button>`);},
 setlang(l){S.lang=l;const ov=!!overlay.innerHTML;closeOverlay(true);render(true);if(ov){const b=app.querySelector('[data-act="lang"]');if(b)b.focus();}},
 msg(v,el){const box=el.closest('.chips');let ms=box.dataset.ms?box.dataset.ms.split(','):[];ms=ms.includes(v)?ms.filter(m=>m!==v):ms.concat(v);box.dataset.ms=ms.join(',');
  box.querySelectorAll('.chip').forEach(b=>{b.setAttribute('aria-pressed',ms.includes(b.dataset.arg));});const pw=document.getElementById(box.dataset.pw);if(pw){pw.querySelectorAll('[data-ph]').forEach(l=>{const on=ms.includes(l.dataset.ph);const inp=l.querySelector('input');if(on&&l.hidden&&!inp.value){const other=[...pw.querySelectorAll('[data-ph]:not([hidden]) input')].map(x=>x.value).find(Boolean);if(other)inp.value=other;}l.hidden=!on;});const h=pw.querySelector('[data-phhint]');if(h)h.hidden=!ms.length;}},
 notarrived(){const f=app.querySelector('#nm');if(f)S.name=f.value.trim();S.justDone=false;go('help');},
 add(){go('add');},
 otpback(){const f=SS.flow;SS.flow=null;ssave();go(f&&f.back?f.back:(acct()?'home':'welcome'));},
 async otpresend(){const f=SS.flow;if(!f)return;const r=await otpSend(f.ck,f.p);f.notSent=!r.ok;f.err=r.limit?t('otp_limit',{t:fdt(r.limit)}):null;ssave();render(true);},
 useiccid(i){SS.add=Object.assign({},SS.add||{},{v:i,err:null,res:null});const el=document.getElementById('iccid');if(el){el.value=fmtIccid(i);el.focus();}ssave();},
 scan(){startScan();},
 actadd(){SS.ret=location.hash.slice(1);ssave();go('add');},
 actdone(){const o=actDone;actDone=null;go(o&&dev(o.dev)?'device-'+o.dev:'home');},
 trback(){if(SS.trf)SS.trf.step='to';ssave();render(false);},
 trgo(){const v=SS.trf;if(!v)return;startFlow('transfer',primary(acct()),{id:v.id,to:v.to},'transfer-'+v.id);},
 trcancel(id){cancelTransfer(id);},
 ubgo(id){startFlow('unbind',primary(acct()),{id},'unbind-'+id);},
 ff(min){S.tick+=+min;save();closeOverlay(true);toast('+'+(min>=60?Math.round(min/60)+' h':min+' min'));processDue().then(()=>render(true));},
 ffend(id){const tr=B().transfers.find(z=>z.id===id);if(tr&&tr.effective_at){const m=Math.ceil((Date.parse(tr.effective_at)-nowMs())/MIN)+1;if(m>0)S.tick+=m;save();}processDue().then(()=>render(true));},
 async reqobject(id){await bridgeTx(b=>{const rq=b.requests.find(r=>r.id===id);if(!rq)return{write:false};const at=isoNow();
  // objection (ТЗ 4.7.3): set objected_at and freeze the binding at once. Idempotent with the console (own_dispute keeps objected_at and freezes only an active binding);
  // the console then marks the request disputed. A request made by the portal's own demo lab is also marked disputed here so the portal works alone.
  if(!rq.objected_at){rq.objected_at=at;rq.objected_by_account_id=SS.cur;}
  const bd=b.bindings.find(z=>z.id===rq.binding_id)||b.bindings.find(z=>z.iccid===rq.iccid&&liveB(z));
  if(bd&&bd.status==='active'){bd.status='frozen';bd.frozen_at=at;bd.frozen_reason='ownership_dispute';bd.frozen_by='owner objection';(bd.freeze_log=bd.freeze_log||[]).push({at,action:'freeze',by:'owner',reason:'owner objection',request_id:id});}
  if(rq.src==='portal-demo')rq.status='disputed';b.events.push(bEvent('ownership_objection',bd||{iccid:rq.iccid,device_id:'d-'+rq.iccid},{request_id:id}));return{};});rerender();},
 async labfreeze(id){const x=dev(id);if(!x)return;await bridgeTx(b=>{const bd=b.bindings.find(z=>z.id===bnd(x).id);if(!bd)return{write:false};const fr=bd.status==='active';bd.status=fr?'frozen':'active';
  (bd.freeze_log=bd.freeze_log||[]).push({at:isoNow(),action:fr?'freeze':'unfreeze',by:'OTA support (demo)',reason:'demo'});b.events.push(bEvent(fr?'binding_frozen':'binding_unfrozen',bd));return{};});closeOverlay(true);go('device-'+id);},
 async labreq(id){const x=dev(id);if(!x)return;const N=delayHours(x.iccid);await bridgeTx(b=>{const rid=uid('req'),ou=isoMs(nowMs()+N*HOUR);b.requests.push({id:rid,iccid:x.iccid,binding_id:bnd(x).id,reason:'error',status:'owner_notified',created_by:'Demo Dealer',file:'receipt-demo.pdf',doc_checked:true,created_at:isoNow(),notified_at:isoNow(),delay_hours:N,object_until:ou,src:'portal-demo'});
  b.notices.push({code:'T11',account_id:SS.cur,iccid:x.iccid,request_id:rid,delay_hours:N,object_until:ou,created_at:isoNow()});return{};});
  closeOverlay(true);notify(primary(acct()),t('T11',{N}));go('device-'+id);},
 async lablink(){const a=acct();const b=B();const free=Object.keys(b.sims).find(i=>!b.sims[i].demo&&b.sims[i].status==='issued'&&b.sims[i].partner&&luhnOk(i)&&!b.bindings.some(z=>z.iccid===i&&liveB(z))&&!b.bindLinks.some(l=>l.iccid===i&&linkOpen(l)));
  closeOverlay(true);if(!free){toast(t('x_nofree'));return;}const token=tok();
  const c=primary(a);await bridgeTx(bb=>{bb.bindLinks.push({token,iccid:free,contact:cShow(c),contact_norm:cmpKey(c),created_at:isoNow(),expires_at:isoMs(nowMs()+72*HOUR),status:'pending',created_by:'Demo Installer',src:'portal-demo'});return{};});
  SS.lnk=null;ssave();go('b/'+token);},
 labgolog(){closeOverlay(true);go('log');},
 famdel(i){const m=S.family[+i];document.getElementById('famDel').innerHTML=`<div class="card stack"><p>${t('fam_delQ',{n:esc(m.name)})}</p><button class="btn danger" type="button" data-act="famdelY" data-arg="${i}">${t('fam_del')}</button><button class="btn plain" type="button" data-act="famdelN">${t('cancel')}</button></div>`;},
 famdelY(i){S.family.splice(+i,1);save();go('profile');toast(t('saved'));},
 famdelN(){rerender();},
 chsw(k,el){const on=el.checked;const set=v=>{if(k==='email')S.mute.email=v;else if(k.startsWith('fam:'))S.family[+k.slice(4)].off=v;else S.mute[k]=v;};set(!on);
  if(!on&&chanCount()===0){set(false);el.checked=true;toast(t('ch_last'));return;}save();rerender();},
 moveok(id){const x=dev(id);delete x.moved;x.movedPin=true;save();rerender();toast(t('move_cleared'));},
 cardchg(){toast(t('pm_changed'));},
 carddef(id){S.cards.forEach(c=>c.def=c.id===id);save();rerender();},
 carddel(id){const c=S.cards.find(x=>x.id===id);if(c.def&&S.cards.length===1&&autoItems().length){toast(t('card_last'));return;}S.cards=S.cards.filter(x=>x.id!==id);if(!S.cards.some(x=>x.def)&&S.cards[0])S.cards[0].def=true;save();rerender();toast(t('card_deleted'));},
 cardadd(){sheet(t('card_add'),`<form class="stack" data-form="newcard" novalidate><label class="f" for="nc">${t('p_cardno')}<input class="inp" id="cn" inputmode="numeric" autocomplete="cc-number" maxlength="19" placeholder="0000 0000 0000 0000"></label><span id="nch"></span><label class="f" for="ce">${t('p_exp')}<input class="inp" id="ce" inputmode="numeric" maxlength="5" placeholder="MM/YY"></label><div class="democard">${ic('flask','sm')}<span>${t('p_demo')}</span></div><button class="btn primary" type="submit">${t('save')}</button><button class="btn plain" type="button" data-act="closeov">${t('cancel')}</button></form>`);},
 txretry(i){const o=S.tx[+i];S.tick+=1;o.retried=true;addTx({dev:o.dev,desc:o.desc,sum:o.sum,cur:o.cur,oss:o.oss,seller:o.seller,ok:true,via:'card',card:(defCard()||{last4:o.card}).last4});save();rerender();toast(t('tx_retried'));},
 aroffq(id){const x=dev(id);const dt=x.mode==='sub'?x.next:x.paidUntil;sheet(t('pm_off'),`<p>${t('pm_offQ',{d:esc(dname(x)),date:fdate(dt)})}</p><button class="btn danger" type="button" data-act="aroff" data-arg="${id}">${t('pm_off')}</button><button class="btn primary" type="button" data-act="closeov">${t('cancel')}</button>`);},
 aroff(id){const x=dev(id);if(x.mode==='sub'){x.mode='pkg';x.paidUntil=x.next;delete x.next;}delete x.auto;closeOverlay(true);rerender();toast(t('pm_offDone'));},
 rem(n){n=+n;if(S.remind.includes(n)){if(S.remind.length===1){toast(t('r_none'));return;}S.remind=S.remind.filter(x=>x!==n);}else S.remind.push(n);save();rerender();},
 rename(id){const x=dev(id);sheet(t('d_rename_t'),`<form class="stack" data-form="rename" data-id="${id}"><input class="inp" id="rn" value="${esc(dname(x))}" maxlength="32" aria-label="${t('d_rename_t')}"><button class="btn primary" type="submit">${t('save')}</button><button class="btn plain" type="button" data-act="closeov">${t('cancel')}</button></form>`);},
 loc(id,el){dev(id).loc=el.checked;if(el.checked)S.geo=true;rerender();},
 geo(){S.geo=true;S.devices.forEach(x=>{if(x.loc==null)x.loc=true;});rerender();},
 geooff(){S.geo=false;rerender();toast(t('m_offDone'));},
 alert(k,el){if(!el.checked&&(k==='lost'||k==='sim'||k==='move')){el.checked=true;sheet(t('a_'+k),`<p>${t('a_offQ')}</p><button class="btn danger" type="button" data-act="alertoff" data-arg="${k}">${t('a_offY')}</button><button class="btn primary" type="button" data-act="closeov">${t('a_keep')}</button>`);return;}S.alerts[k]=el.checked;save();},
 alertoff(k){S.alerts[k]=false;closeOverlay(true);rerender();},
 autopay(id){const x=dev(id);sheet(t('ap_t'),`<p>${t('ap_next',{date:fdate(x.next),sum:mny(x,prOf(x)[x.plan].m)})}</p><button class="btn ghost" type="button" data-go="pay-${id}">${ic('card')} ${t('prepay')}</button><button class="btn danger" type="button" data-act="apoffq" data-arg="${id}">${t('ap_off')}</button><button class="btn plain" type="button" data-act="closeov">${t('close')}</button>`);},
 apoffq(id){const x=dev(id);sheet(t('ap_off'),`<p>${t('ap_offQ',{date:fdate(x.next)})}</p><button class="btn danger" type="button" data-act="apoff" data-arg="${id}">${t('ap_offY')}</button><button class="btn primary" type="button" data-act="closeov">${t('ap_keep')}</button>`);},
 apoff(id){const x=dev(id);x.mode='pkg';x.paidUntil=x.next;delete x.next;closeOverlay(true);rerender();toast(t('ap_done'));},
 async democode(){const x=dev(S.pay.id);const b=B();let k=Object.keys(b.codes).find(k=>{const c=normCode(k);const r=b.codes[k];const pl=codeOk(r)&&codePlan(c,r);return pl&&pl.plan===x.plan;});
  if(!k){k=normCode(demoCode(x.plan));await bridgeTx(bb=>{bb.codes[k]={serial:k.slice(6,11),status:'new',device_id:null,src:'portal-demo',cc:devCc(x)};return{};});}
  S.pay.code=fmtCode(normCode(k));S.pay.cerr='';rerender();},
 plan(k){S.pay.plan=k;rerender();},
 tocard(){S.pay.step='card';S.pay.err=false;S.pay.cn=null;render(false);},
 cardback(){S.pay.step='choose';render(false);},
 wallet(){pay();},
 payback(){const id=S.pay.id;S.pay=null;go('device-'+id);},
 payhome(){S.pay=null;go('home');},
 closepush(){hidePush();},
 alarmdev(id){closeOverlay(true);go('device-'+id);},
 alarmok(){closeOverlay();rerender();},
 closeov(){closeOverlay();},
 copy(){const ok=()=>toast(t('h_copied'));try{navigator.clipboard.writeText(SELLER).then(ok,selectNum);}catch(e){selectNum();}},
 editname(){sheet(t('pr_name'),`<form class="stack" data-form="name"><input class="inp" id="pn" value="${esc(S.name)}" maxlength="40" aria-label="${t('pr_name')}"><button class="btn primary" type="submit">${t('save')}</button><button class="btn plain" type="button" data-act="closeov">${t('cancel')}</button></form>`);},
 logout(){document.getElementById('logoutBox').innerHTML=`<div class="card stack"><p>${t('pr_logoutQ')}</p><button class="btn danger" type="button" data-act="logoutY">${t('pr_logoutY')}</button><button class="btn plain" type="button" data-act="logoutN">${t('cancel')}</button></div>`;document.querySelector('[data-act="logoutN"]').focus();},
 logoutY(){SS={cur:null};P.last=null;ssave();save();bindS();go('welcome');},
 logoutN(){rerender();},
 lab(){lab();},
 doc(k){const q=k==='priv'?[['L_pn5','L_pn5_ref']]:[['L_c51','L_c51_ref'],['L_s7','L_s7_ref']];   // v12 changes quoted from Documents 07 / 08
  sheet(k==='priv'?t('doc_priv'):t('doc_terms'),`<p class="muted">${t('doc_demo')}</p>${q.map(([a,b])=>`<div class="stack s8" data-q="${a}"><p class="small">${t(a)}</p><p class="muted small">${t(b)}</p></div>`).join('')}<button class="btn primary" type="button" data-act="closeov">${t('close')}</button>`);},
 pkgsignin(){SS.ret='code';ssave();render(true);const el=app.querySelector('#si');if(el)el.focus();},
 async pkdemo(){const b=B();const ds=S.devices;const k=Object.keys(b.codes).find(k=>{const c=normCode(k);const r=b.codes[k];const pl=codeOk(r)&&codePlan(c,r);if(!pl)return false;const kc=codeCc(k,r);return ds.some(x=>x.plan===pl.plan&&(kc==='DE')===(devCc(x)==='DE'));})||Object.keys(b.codes).find(k=>codeOk(b.codes[k])&&codePlan(normCode(k),b.codes[k]));
  SS.pk={v:k?fmtCode(normCode(k)):''};ssave();rerender();},
 cxopen(){SS.cx=null;ssave();go('cancel');},
 cxprint(){try{window.print();}catch(e){}},
 cxsignin(){SS.cx=null;SS.ret='cancel';ssave();go('welcome');},
 async labde(){await bridgeTx(b=>{const c=b.settings.countries.DE=Object.assign({},b.settings.countries.DE);const on=!ccOpen('DE');c.docs_de_published=on;c.ownership_v10_enabled=on;c.set_by='OTA (demo, portal lab)';return{};});closeOverlay(true);toast(t(ccOpen('DE')?'x_de_on':'x_de_off'));rerender();},
 receipt(i){const o=S.tx[+i];if(!o)return;const x=dev(o.dev)||P.devs[o.dev];const cur=o.cur||(x?curOf(x):'UAH');
  sheet(t('rc_title'),`<div class="stack s8" id="receipt"><p class="muted small">${fwhen(o.ts)}</p><p><span class="muted">${t('rc_seller')}</span> <b>${esc(o.seller||OTA_NAME())}</b></p>
   <p><span class="muted">${t('rc_item')}</span> ${t('rc_desc',{brand:esc(t('brand'))})}${o.desc?' · '+esc(o.desc):''}</p>${x?`<p class="muted small">${esc(dname(x))} · ICCID ${fmtIccid(x.iccid)}</p>`:''}
   <div class="sum"><span class="muted">${t('p_total')}</span><b>${money(o.sum,cur)}</b></div>${o.oss?ossHtml(o.oss,cur):x?vatLine(x):''}
   <p class="muted small">${o.via==='wallet'?t('tx_wallet'):'•••• '+esc(o.card||'')}</p><button type="button" class="lnk" data-act="doc" data-arg="terms">${t('doc_terms')}</button></div>
   <button class="btn primary" type="button" data-act="closeov">${t('close')}</button>`);},
 labdev(id){labDev=id;lab();},
 sim(k){simulate(k);},
 labadd(){closeOverlay(true);go('add');},
 async labreset(){closeOverlay(true);clearSplit();P=freshP(P.lang);SS={cur:null};ssave();save();bindS();await resetBridge();go('welcome');toast(t('x_done'));}
};
function selectNum(){const p=document.getElementById('sellerNum');if(p){const r=document.createRange();r.selectNodeContents(p);const s=getSelection();s.removeAllRanges();s.addRange(r);}}
function pay(){const p=S.pay;const x=dev(p.id);const plan=PLANS.find(q=>q.k===p.plan);const thru=paidThrough(x);const prepaid=!!thru&&d(thru)>now();
 p.step='proc';render(false);
 setTimeout(()=>{if(!S.pay)return;S.tick+=1;
  if(p.plan==='m'){x.next=prepaid?thru:addMonths(today(),1);x.mode='sub';delete x.paidUntil;}
  else{x.paidUntil=addMonths(prepaid?thru:today(),plan.mo);x.mode='pkg';delete x.next;if(p.viaCard&&p.ar)x.auto={plan:p.plan};else if(p.viaCard)delete x.auto;}
  let card=null;if(p.viaCard){card=addCard(p.cnum||'4242424242424242',p.cexp);}
  const sum=p.plan==='m'&&prepaid?0:prOf(x)[x.plan][p.plan];const tax=sum?taxOf(devCc(x),sum):null;   // receipt keeps currency + German VAT (OSS) at the time of payment
  addTx({dev:x.id,desc:p.plan==='m'?t('pm_kindM'):t('pm_kindP',{term:t('p_'+p.plan)}),sum,cur:curOf(x),oss:tax,seller:OTA_NAME(),ok:true,via:card?'card':'wallet',card:card?card.last4:null});
  delete x.cancelled;x.ev.push(['ev_paid',isoT(now()),'info']);p.res=p.plan;p.step='ok';render(false);},1300);}

document.addEventListener('click',e=>{
 const g=e.target.closest('[data-go]');if(g){e.preventDefault();go(g.dataset.go);return;}
 const a=e.target.closest('[data-act]');if(!a)return;if(a.tagName==='INPUT')return;
 if(a.classList.contains('sheetbg')&&e.target!==a)return;
 const fn=A[a.dataset.act];if(!fn)return;e.preventDefault();fn(a.dataset.arg,a);
});
document.addEventListener('change',e=>{if(e.target.id==='agr'&&e.target.checked){e.target.removeAttribute('aria-invalid');const h=document.getElementById('agh');if(h)h.remove();}
 const a=e.target.closest('input[data-act]');if(a&&A[a.dataset.act])A[a.dataset.act](a.dataset.arg,a);});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&overlay.innerHTML){closeOverlay();return;}
 if(e.key==='Tab'&&overlay.innerHTML){const f=[...overlay.querySelectorAll('button,a[href],input')].filter(x=>!x.disabled);if(!f.length)return;const first=f[0],last=f[f.length-1];
  if(!overlay.contains(document.activeElement)){e.preventDefault();first.focus();return;}
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
});
function fmtTyping(v){const tv=v.trim();let d=digits(tv);if(d.length<=3&&d&&'380'.startsWith(d)&&!tv.startsWith('+380 '))return tv;if(tv.startsWith('+380'))d=d.slice(3);else if(d.startsWith('380'))d=d.slice(3);else if(d.startsWith('0'))d=d.slice(1);d=d.slice(0,9);if(!d)return tv.startsWith('+')?'+':'';const parts=[d.slice(0,2),d.slice(2,5),d.slice(5,7),d.slice(7,9)].filter(Boolean);return '+380 '+parts.join(' ');}
document.addEventListener('input',e=>{const id=e.target.id;
 if(e.target.type==='tel'){const el=e.target;const nv=fmtTyping(el.value);if(nv!==el.value){el.value=nv;}if(parsePhone(nv)){el.removeAttribute('aria-invalid');const h=document.getElementById(id+'h');if(h&&h.classList.contains('err'))h.remove();}}
 if(id==='lq'){const q=e.target.value.trim().toLowerCase();document.querySelectorAll('#ll [data-q]').forEach(b=>b.hidden=q&&!b.dataset.q.includes(q));return;}
 if(id==='otp'){e.target.value=digits(e.target.value).slice(0,6);}
 if(id==='iccid'){const el=e.target;const v=digits(el.value).slice(0,20);el.value=fmtIccid(v);if(SS.add){SS.add.v=v;SS.add.res=null;}}
 if(id==='cn'){const v=digits(e.target.value).slice(0,16);e.target.value=v.replace(/(.{4})/g,'$1 ').trim();}
 if(id==='ce'){let v=digits(e.target.value).slice(0,4);if(v.length>2)v=v.slice(0,2)+'/'+v.slice(2);e.target.value=v;}
 if(id==='pk'){const v=normCode(e.target.value).slice(0,16);e.target.value=v?fmtCode(v):'';SS.pk={v:e.target.value};}
 if(id==='ac'){const v=normCode(e.target.value).slice(0,16);e.target.value=v?fmtCode(v):'';if(S.pay){S.pay.code=e.target.value;S.pay.cerr='';}
  const box=document.getElementById('acd');e.target.removeAttribute('aria-invalid');if(box){const pc=v.length===16?parseCode(v):null;box.innerHTML=pc&&!pc.err?`<p class="small" style="color:var(--ok);font-weight:600;display:flex;gap:6px;align-items:center">${ic('check','sm')}${t('c_dec',{a:PLN[pc.plan],term:termTxt(pc.months)})}</p>`:(pc&&pc.err?`<span class="err">${ic('alert','sm')}<span>${t(pc.err)}</span></span>`:'');}}
});
document.addEventListener('submit',e=>{const f=e.target;e.preventDefault();const k=f.dataset.form;
 if(k==='contacts'){const mode=f.dataset.mode;const em=f.querySelector('#em').value.trim();const rc=readContacts(f,'');const ms=rc.ms;const err={};
  if(!em)err.em='req';else if(!validEmail(em))err.em='bad';if(rc.bad)err.ph=rc.bad;const agEl=f.querySelector('#agr');const agr=agEl?agEl.checked:true;if(mode==='ob'&&!agr)err.agr=1;
  if(err.em||err.ph||err.agr){app.innerHTML=vContacts(mode,err,{em,ph:rc.raw,ms,agr});const bad=app.querySelector('[aria-invalid="true"]');if(bad)bad.focus();return;}
  S.email=em;S.phones=rc.phones;S.msgs=ms;if(mode==='ob')S.agreedAt=isoT(now());save();
  if(mode==='edit'){go('profile');toast(t('saved'));}
  else if(SS.ret){const r=SS.ret;SS.ret=null;ssave();S.onboarded=true;save();go(r);}
  else if(S.devices.length){S.onboarded=true;S.justDone=true;save();go('start-done');}
  else go('add');}
 else if(k==='signin'){const raw=f.querySelector('#si').value;const c=normContact(raw);if(!c){SS.si={v:raw,err:1};ssave();render(true);const el=app.querySelector('#si');if(el)el.focus();return;}
  SS.si=null;ssave();startFlow('login',c,{},'welcome');}
 else if(k==='otp'){onOtp(f.querySelector('#otp').value.trim());}
 else if(k==='iccid'){onIccid(f);}
 else if(k==='pkg'){onPkg(f);}
 else if(k==='cancel'){onCancel(f);}
 else if(k==='act'){const r=f.querySelector('input[name="actdev"]:checked');if(!r){SS.act={err:t('act_pick')};ssave();render(true);return;}onRedeem(f.dataset.code,r.value);}
 else if(k==='trto'){const id=f.dataset.id;const raw=f.querySelector('#trto').value;const c=normContact(raw);let err=null;if(!c)err='si_err';else if(acctKeys(acct()).includes(cKey(c)))err='tr_self';
  SS.trf={id,raw,step:err?'to':'conseq',err,to:c?cKey(c):null};ssave();render(false);if(err){const el=app.querySelector('#trto');if(el)el.focus();}}
 else if(k==='accept'){const tk=f.dataset.token;if(!f.querySelector('#t1').checked){SS.acc={t1err:1};ssave();render(true);return;}SS.acc=null;ssave();const tr=B().transfers.find(z=>z.token===tk);if(tr)startFlow('accept',parseKey(tr.to_contact),{token:tk},'/t/'+tk);}
 else if(k==='link'){const tk=f.dataset.token;if(!f.querySelector('#t1').checked){SS.lnk={t1err:1};ssave();render(true);return;}SS.lnk=null;ssave();const l=findLink(B(),tk);if(l)startFlow('link',linkContact(l),{token:tk},'b/'+tk);}
 else if(k==='chg'){const field=f.dataset.field;const raw=f.querySelector('#nc').value;const c=normContact(raw);const a=acct();let err=null;
  if(!c||c.k!==field[0])err=field==='email'?'email_err':'si_err';else if(a[field]===c.v)err='sc_same';else if(findAcct(c))err='sc_taken';
  if(err){SS.chg={field,raw,err};ssave();render(true);const el=app.querySelector('#nc');if(el)el.focus();return;}SS.chg=null;ssave();
  const data={field,nv:cKey(c)};if(a[field])startFlow('chg_old',{k:field[0],v:a[field]},data,'signin-'+field);else startFlow('chg_new',c,data,'signin-'+field);}
 else if(k==='delay'){const v=f.querySelector('#dl').value.trim();const h=document.getElementById('dlh');
  if(!/^\d+$/.test(v)||+v<1||+v>24){h.className='err';h.setAttribute('role','alert');h.innerHTML=ic('alert','sm')+'<span>'+t('x_delay_err')+'</span>';return;}
  bridgeTx(b=>{b.settings.countries.UA=Object.assign({},b.settings.countries.UA,{delay_hours:+v,set_at:isoNow(),set_by:'OTA (demo, portal lab)'});return{};}).then(()=>{closeOverlay(true);toast(t('saved'));});}
 else if(k==='done'){S.name=f.querySelector('#nm').value.trim();S.justDone=false;go('home');}
 else if(k==='card'){const raw=f.querySelector('#cn').value;const arEl=f.querySelector('#ar');S.pay.ar=arEl?arEl.checked:false;S.pay.viaCard=true;S.pay.cnum=raw;S.pay.cexp=f.querySelector('#ce').value;if(digits(raw).length!==16){S.pay.err=true;S.pay.cn=raw;render(true);const c=app.querySelector('#cn');if(c)c.focus();return;}pay();}
 else if(k==='actcode'){const x=dev(S.pay.id);const raw=f.querySelector('#ac').value;S.pay.code=raw;
  redeemCode(raw,x.id).then(r=>{if(r.code==='OK'){S.pay.res='code';S.pay.resTxt=t('c_ok',{a:PLN[r.pl.plan],term:termTxt(r.pl.months)});S.pay.step='ok';render(false);return;}
   S.pay.cerr=r.code==='BLOCK'?t('blocked_acct',{t:fdt(r.until)}):r.code==='CTRY'?t('c_ctry'):r.code==='ACTIVE'?payTxt(x):r.code==='TYPE'?t('c_type',{a:PLN[r.pl.plan],b:PLN[x.plan]}):t('T7');rerender();const c=app.querySelector('#ac');if(c)c.focus();});}
 else if(k==='rename'){const x=dev(f.dataset.id);const v=f.querySelector('#rn').value.trim();if(v&&v!==`${t('typ_'+x.type)} ${x.model}`)x.custom=v;else delete x.custom;closeOverlay();rerender();toast(t('d_renamed'));}
 else if(k==='newcard'){const v=f.querySelector('#cn').value;if(digits(v).length!==16){const h=document.getElementById('nch');h.className='err';h.innerHTML=ic('alert','sm')+'<span>'+t('p_cardErr')+'</span>';f.querySelector('#cn').focus();return;}addCard(v,f.querySelector('#ce').value||'12/29');closeOverlay(true);save();rerender();toast(t('card_added'));}
 else if(k==='name'){S.name=f.querySelector('#pn').value.trim();closeOverlay();rerender();toast(t('saved'));}
 else if(k==='fam'){const i=+f.dataset.i;const nm=f.querySelector('#fnm').value.trim();const em=f.querySelector('#fem').value.trim();const rc=readContacts(f,'f');const ms=rc.ms;const err={};
  if(!nm)err.nm=1;if(!em)err.em='req';else if(!validEmail(em))err.em='bad';if(rc.bad)err.ph=rc.bad;
  if(err.nm||err.em||err.ph){app.innerHTML=vFam(i<0?'new':String(i),err,{nm,em,ph:rc.raw,ms});const bad=app.querySelector('[aria-invalid="true"]');if(bad)bad.focus();return;}
  const rec={name:nm,email:em,msgs:ms,phones:rc.phones};if(i<0)S.family.push(rec);else S.family[i]=rec;save();go('profile');toast(i<0?t('fam_added'):t('saved'));}
});
async function onOtp(code){const f=SS.flow;if(!f)return;if(!/^\d{6}$/.test(code)){f.err=t('otp_fmt');ssave();render(true);const el=app.querySelector('#otp');if(el)el.focus();return;}
 const r=await otpCheck(f.ck,f.p,code);
 if(r.ok){SS.flow=null;ssave();await finishFlow(f);return;}
 f.err=r.dead?t('otp_dead'):t('otp_wrong',{n:r.left});ssave();render(true);const el=app.querySelector('#otp');if(el)el.focus();}
function onPkg(f){const raw=f.querySelector('#pk').value;const c=normCode(raw);const a=acct();const show=c?fmtCode(c):'';let err=null;
 const bu=a&&blockedUntil(a.id);
 if(bu)err=t('blocked_acct',{t:fdt(bu)});else if(c.length!==16)err=t('c_len');
 else if(codeValid(c)){SS.pk=null;SS.act=null;actDone=null;ssave();go('/a/'+c);return;}
 else if(!codeLookup(B(),c)&&parseCode(c).err)err=t('c_bad');   // checksum typo: not counted as a failed attempt
 else{err=t('T7');if(a)fail(a.id);}   // used / blocked / expired / unknown → one message T7 (ТЗ 4.4)
 SS.pk={v:show,err};ssave();render(true);const el=app.querySelector('#pk');if(el)el.focus();}
async function onCancel(f){const mode=f.dataset.mode;const g=sel=>{const e=f.querySelector(sel);return e?e.value.trim():'';};
 const type=(f.querySelector('input[name="cxtype"]:checked')||{}).value||'ordinary';const vals={type,reason:g('#cxreason'),mail:g('#cxmail')};const err={};let c=null;
 if(mode==='public'){vals.name=g('#cxname');vals.contact=g('#cxcontact');vals.devref=g('#cxdev').replace(/[\s-]+/g,'');c=normContact(vals.contact);
  if(!vals.name)err.name=1;if(!c)err.contact=1;if(!/^(\d{15}|\d{19,20})$/.test(vals.devref))err.dev=1;if(!vals.mail&&c&&c.k==='e')vals.mail=c.v;vals.ck=c?cKey(c):null;}
 else{const r=f.querySelector('input[name="cxdev"]:checked');vals.dev=r?r.value:null;if(!vals.dev)err.pick=1;}
 if(type==='extra'&&!vals.reason)err.reason=1;if(!validEmail(vals.mail))err.mail=1;
 if(Object.keys(err).length){SS.cx={vals,err};ssave();render(true);const el=app.querySelector('[aria-invalid="true"]');if(el)el.focus();return;}
 const btn=f.querySelector('#cxbtn');if(btn)btn.disabled=true;
 const r=await doCancel(Object.assign({mode},vals));SS.cx={done:r};ssave();render(false);}
let bindBusy=false;
async function onIccid(f){if(bindBusy)return;const raw=f.querySelector('#iccid').value;const sv=raw.replace(/\s+/g,'');const t1=f.querySelector('#t1').checked;
 let err=null;if(!/^\d+$/.test(sv)||sv.length<19||sv.length>20)err='iccid_len';else if(!luhnOk(sv))err='iccid_bad';
 SS.add={v:sv,err,t1,t1err:!t1,res:null};ssave();
 if(err||!t1){render(true);const el=app.querySelector('[aria-invalid="true"]');if(el)el.focus();return;}
 bindBusy=true;let r;try{r=await bindIccid(sv,{method:'iccid'});}finally{bindBusy=false;}
 const did=devIdOf(sv);if(r.code==='T5'){SS.add=null;SS.flash={dev:did,code:'T5'};
  if(!S.onboarded){S.onboarded=true;S.justDone=true;ssave();save();await seedDemo();go('start-done');setTimeout(()=>push(t('pe_test')),700);return;}
  if(SS.ret&&SS.ret.startsWith('/a/')){const rr=SS.ret;SS.ret=null;SS.flash=null;ssave();go(rr);return;}
  ssave();go('device-'+did);return;}
 SS.add={v:sv,t1:true,res:r.code,until:r.until};ssave();render(true);}
async function onRedeem(code,devId){const r=await redeemCode(code,devId);
 if(r.code==='OK'){SS.act=null;actDone={code:normCode(code),dev:devId,txt:t('c_ok',{a:PLN[r.pl.plan],term:termTxt(r.pl.months)})};ssave();render(false);return;}
 SS.act={dev:devId,err:r.code==='BLOCK'?t('blocked_acct',{t:fdt(r.until)}):r.code==='CTRY'?t('c_ctry'):r.code==='ACTIVE'?payTxt(dev(devId)):r.code==='TYPE'?t('c_type',{a:PLN[r.pl.plan],b:PLN[dev(devId).plan]}):t('T7')};ssave();render(true);}
async function startScan(){const msg=m=>{const e=document.getElementById('scanmsg');if(e)e.textContent=m;};
 if(!('BarcodeDetector' in window)||!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){msg(t('scan_na'));const i=document.getElementById('iccid');if(i)i.focus();return;}
 let det;try{det=new window.BarcodeDetector({formats:['code_128','code_39','itf','ean_13','qr_code','data_matrix']});}catch(e){try{det=new window.BarcodeDetector();}catch(e2){msg(t('scan_na'));return;}}
 let stream;try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});}catch(e){msg(t('scan_err'));return;}
 sheet(t('scan_title'),`<video id="scv" playsinline muted style="width:100%;border-radius:16px;background:#000;aspect-ratio:4/3;object-fit:cover"></video><button class="btn plain" type="button" data-act="closeov">${t('close')}</button>`);
 const v=document.getElementById('scv');v.srcObject=stream;try{await v.play();}catch(e){}
 let stop=false;scanStop=()=>{stop=true;stream.getTracks().forEach(tr=>tr.stop());};
 const loop=async()=>{if(stop||!document.getElementById('scv')){if(!stop&&scanStop)scanStop();return;}
  try{const res=await det.detect(v);const hit=res.map(x=>(x.rawValue||'').replace(/\D/g,'')).find(z=>z.length>=19&&z.length<=20);
   if(hit){closeOverlay(true);SS.add=Object.assign({},SS.add||{},{v:hit,err:null,res:null});ssave();const i=document.getElementById('iccid');if(i)i.value=fmtIccid(hit);const c=document.getElementById('t1');if(c)c.focus();toast(t('scan_ok'));return;}}catch(e){}
  setTimeout(loop,250);};loop();}
setInterval(()=>{if(location.hash==='#otp'&&SS.flow){const b=document.getElementById('otpres');if(b){const w=otpWait(SS.flow.ck);b.disabled=!!w;b.textContent=otpResTxt(w);const g=document.getElementById('otpgs');if(g&&w&&w.gap)g.textContent=Math.max(1,Math.ceil((w.gap-nowMs())/1000));}}},1000);
setInterval(()=>{if(dueList(readBridge()).length&&!dueBusy)processDue().then(ch=>{if(ch)render(true);});},20000);
window.addEventListener('storage',e=>{const k=e.key||'';
 if(k.startsWith(AK)||k.startsWith(DK)){if(e.newValue===LS[k])return;LS[k]=e.newValue;const map=k.startsWith(AK)?P.accts:P.devs,id=k.slice(AK.length);
  if(e.newValue==null)delete map[id];else{try{const o=JSON.parse(e.newValue);if(map[id]&&isObj(map[id])){Object.keys(map[id]).forEach(q=>{if(!(q in o))delete map[id][q];});Object.assign(map[id],o);}else map[id]=o;}catch(x){}}}
 else if(k===PKEY){if(e.newValue===lastSaved)return;try{const r=restOf(P);merge3(lastSaved?restOf(JSON.parse(lastSaved)):{},r,restOf(JSON.parse(e.newValue||'{}')));Object.assign(P,r);}catch(x){}lastSaved=e.newValue;}
 else if(k!==BKEY)return;BC=null;bindS();
 const ae=document.activeElement;if(!(ae&&(ae.tagName==='INPUT'||ae.tagName==='TEXTAREA'))&&!overlay.innerHTML)render(true);});
runPurge();
render(false);
})();
