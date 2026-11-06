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
const CTRY={K:'UA',P:'PL',Z:'ZA'};const HOME='K';
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
const P={
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
const ic=(n,c='')=>`<svg class="i ${c}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${P[n]||''}</svg>`;
const LOGO='<svg width="38" height="38" viewBox="0 0 40 40" aria-hidden="true" style="flex:none"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4C5BFF"/><stop offset="1" stop-color="#1E2A9C"/></linearGradient></defs><rect width="40" height="40" rx="11" fill="url(#lg)"/><path d="M11 30 20 10l9 20" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M15.2 23.5h9.6" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/><circle cx="30.5" cy="10" r="3" fill="#7CF0C5"/></svg>';
const DEVICON={inverter:'bolt',tracker:'car',alarm:'shield',boiler:'flame'};

function fresh(lang){return{lang:lang||'uk',onboarded:false,tick:0,name:'',email:'',phones:{},msgs:['Viber'],family:[],geo:false,
 alerts:{lost:true,off:true,sim:true,move:true,pay:true},remind:[14,3],cards:[],tx:[],devices:[],pend:null,pay:null,sim:'8938 0012 ···· 4821'};}
let S;
try{S=JSON.parse(localStorage.getItem('connect-demo-v3'))||fresh();}catch(e){S=fresh();}
if(!S||!S.alerts||!Array.isArray(S.devices))S=fresh();
if(!S.phones){S.phones={};(S.msgs||[]).forEach(m=>{if(S.phone)S.phones[m]=S.phone;});}
S.family.forEach&&S.family.forEach(m=>{if(!m.phones){m.phones={};(m.msgs||[]).forEach(x=>{if(m.phone)m.phones[x]=m.phone;});}});
if(!S.mute)S.mute={};
if(S.alerts.move==null)S.alerts.move=true;
if(!Array.isArray(S.cards))S.cards=S.card?[{id:'c1',last4:S.card,exp:'12/29',def:true}]:[];if(!Array.isArray(S.tx))S.tx=[];
if(!Array.isArray(S.remind))S.remind=[14,3];
if(!Array.isArray(S.family))S.family=S.family?[{name:'',email:'',msgs:['Viber'],phone:S.family}]:[];
function save(){try{localStorage.setItem('connect-demo-v3',JSON.stringify(S));}catch(e){}}

function t(k,v){let s=(T[S.lang]&&T[S.lang][k]);if(s==null)s=T.uk[k];if(s==null)s=k;if(v)for(const a in v)s=s.split('{'+a+'}').join(v[a]);return s;}
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function pf(n,k){const f=(T[S.lang]&&T[S.lang].day_forms)||T.en.day_forms;let c='other';try{c=new Intl.PluralRules(loc()).select(n);}catch(e){}return f[c]||f.other;}
const NB=' ';
const money=n=>new Intl.NumberFormat(loc()).format(n).replace(/\s/g,NB)+NB+t('cur');
const pad=n=>String(n).padStart(2,'0');
const now=()=>new Date(NOW0.getTime()+S.tick*60000);
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
const dev=id=>S.devices.find(x=>x.id===id);
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
function newDevice(c){let n=1;while(dev(c.type+n))n++;const ts=isoT(now());
 return{id:c.type+n,type:c.type,model:c.model,plan:c.plan,status:'ok',mode:'none',loc:true,start:today(),ev:[['ev_bound',ts,'info']]};}

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

function vPick(mode){
 const add=mode==='add';
 return `${topbar(add?{back:'home'}:{})}<main class="stack s24 fade">
 ${add?'':`<span class="simok">${ic('sim','sm')} ${t('w_sim')}</span>`}
 <div class="stack s8"><h1>${add?t('add_title'):t('w_title')}</h1><p class="muted">${add?t('add_sub'):t('w_sub')}</p></div>
 <div class="pick">${CAT.map((c,i)=>`<button class="pk" type="button" data-act="pick" data-arg="${i}"><span class="avatar">${ic(DEVICON[c.type],'lg')}</span><span>${t('typ_'+c.type)} ${c.model}<small>${esc(t('brand'))}</small></span></button>`).join('')}</div>
 ${add?'':`<p class="muted small" style="text-align:center">${t('beat')}</p>`}
 </main>`;
}
const steps=n=>`<div class="stack s8"><div class="steps" aria-hidden="true">${[1,2].map(i=>`<i class="${i<=n?'on':''}"></i>`).join('')}</div><span class="muted small">${t('s_step',{n})}</span></div>`;
function remList(){const a=S.remind.slice().sort((x,y)=>y-x);const last=a[a.length-1];const nums=a.map(n=>n);let txt=nums.length>1?nums.slice(0,-1).join(', ')+' '+t('r_and')+' '+nums[nums.length-1]:String(nums[0]);return txt+' '+pf(last,'day');}
function readContacts(f,pfx){const ms=(f.querySelector('.chips').dataset.ms||'').split(',').filter(Boolean);const raw={},phones={},bad={};
 MSG.forEach(m=>{const v=f.querySelector('#'+pfx+'ph-'+m).value.trim();raw[m]=v;if(ms.includes(m)){const l=parsePhone(v);if(l)phones[m]=fmtPhone(l);else bad[m]=1;}});
 return {ms,raw,phones,bad:Object.keys(bad).length?bad:null};}
function famLine(m){return [m.email].concat((m.msgs||[]).map(x=>x+(m.phones&&m.phones[x]?' '+m.phones[x]:''))).filter(Boolean).join(' · ');}
function contactFields(em,ms,ph,err,pfx){const eErr=err.em==='req'?(pfx?t('fam_email_req'):t('email_req')):err.em?t('email_err'):'';
 return `<label class="f" for="${pfx}em">${t('email')}<input class="inp" id="${pfx}em" type="email" inputmode="email" autocomplete="${pfx?'off':'email'}" value="${esc(em)}" aria-describedby="${pfx}emh" ${eErr?'aria-invalid="true"':''}>
  ${eErr?`<span id="${pfx}emh" class="err">${ic('alert','sm')}<span>${eErr}</span></span>`:(pfx?'':`<span id="${pfx}emh" class="hint">${t('email_hint')}</span>`)}</label>
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
  return `${topbar({back:ob?'welcome':'profile'})}<main class="stack s24 fade">${ob?steps(1):''}
 <form class="stack s24" data-form="contacts" data-mode="${mode}" novalidate>
 <h1>${ob?t('c_title'):t('c_edit')}</h1>
 ${contactFields(em,ms,ph,err,'')}
 ${ob?`<div class="stack s8"><label class="agr" for="agr"><input type="checkbox" id="agr" ${val.agr?'checked':''} ${err.agr?'aria-invalid="true" aria-describedby="agh"':''}><span>${t('ag_pre')} <button type="button" class="lnk" data-act="doc" data-arg="terms">${t('ag_terms')}</button> ${t('ag_and')} <button type="button" class="lnk" data-act="doc" data-arg="priv">${t('ag_priv')}</button></span></label>
 ${err.agr?`<span id="agh" class="err">${ic('alert','sm')}<span>${t('ag_err')}</span></span>`:''}</div>`:''}
 <button class="btn primary" type="submit">${ob?t('next')+' '+ic('right'):t('save')}</button></form></main>`;
}
function vCode(err){
 return `${topbar({back:'start-1'})}<main class="stack s24 fade">${steps(2)}
 <form class="stack s24" data-form="code" novalidate>
 <div class="stack s8"><h1>${t('code_title')}</h1><p class="muted">${t('code_sub',{email:`<b>${esc(S.email)}</b>`})}</p></div>
 <label class="f" for="cd">${t('code_label')}<input class="inp code" id="cd" inputmode="numeric" autocomplete="one-time-code" maxlength="4" ${err?'aria-invalid="true" aria-describedby="cdh"':''}></label>
 ${err?`<span id="cdh" class="err">${ic('alert','sm')}<span>${t('code_err')}</span></span>`:''}
 <div class="democard">${ic('flask','sm')}<span>${t('code_demo')}</span></div>
 <div class="stack s8"><button class="btn primary" type="submit">${t('next')} ${ic('right')}</button><button class="btn plain" type="button" data-act="resend">${t('code_resend')}</button></div></form></main>`;
}
function vDone(){
 const x=S.devices.find(d=>!d.id.endsWith('0'))||S.devices[0];
 return `${topbar()}<main class="stack s24 fade" style="padding-top:16px">
 <div class="stack" style="align-items:center;text-align:center"><div class="success">${ic('check','lg')}</div><h1>${t('done_title')}</h1>
 <p class="muted">${t('done_sub',{device:esc(dname(x)),ch:chans().join(', ')})}</p></div>
 <form class="stack" data-form="done" novalidate>
 <label class="f" for="nm">${t('done_name')}<input class="inp" id="nm" autocomplete="given-name" value="${esc(S.name)}" maxlength="40"></label>
 <button class="btn primary" type="submit">${ic('check')} ${t('done_yes')}</button><button class="btn ghost" type="button" data-act="notarrived">${t('done_no')}</button></form></main>`;
}
function devCard(x){
 const a=attn(x);
 const note=a==='move'?`<div class="note bad">${t('note_move',{t:ftime(x.moved)})}</div>`:a==='off'?`<div class="note bad">${noteFor(x)}</div>`:a==='none'?`<div class="note warn">${t('hero_noneS')}</div>`:a==='soon'?`<div class="note warn">${t('ends_in',{n:days(x.paidUntil),u:pf(days(x.paidUntil),'day')})}</div>`:'';
 return `<a class="card dev" href="#device-${x.id}"><div class="head"><span class="avatar">${ic(DEVICON[x.type],'lg')}</span><div class="grow"><div class="name">${esc(dname(x))}</div><div class="muted small">${seenTxt(x)}</div></div>${ic('right','chev')}</div>
  <div class="row" style="flex-wrap:wrap;gap:8px 12px">${pill(x)}<span class="muted small" style="display:inline-flex;gap:6px;align-items:center">${ic('card','sm')}${payTxt(x)}</span></div>${note}</a>`;
}
function vHome(){
 const list=S.devices.slice().sort((a,b)=>sev(b)-sev(a));const top=list[0];const a=top&&attn(top);let hero;
 if(a==='move')hero=`<a class="hero bad" href="#device-${top.id}"><span class="ring">${ic('pin','lg')}</span><div class="grow"><div class="big">${t('hero_move',{device:esc(dname(top))})}</div><div class="sub">${t('note_move',{t:ftime(top.moved)})} ${t('hero_go')}</div></div>${ic('right')}</a>`;
 else if(a==='off')hero=`<a class="hero bad" href="#device-${top.id}"><span class="ring">${ic('alert','lg')}</span><div class="grow"><div class="big">${t('hero_off',{device:esc(dname(top))})}</div><div class="sub">${noteFor(top)} ${t('hero_go')}</div></div>${ic('right')}</a>`;
 else if(a==='none')hero=`<a class="hero warn" href="#pay-${top.id}"><span class="ring">${ic('key','lg')}</span><div class="grow"><div class="big">${t('hero_none',{device:esc(dname(top))})}</div><div class="sub">${t('hero_noneS')}</div></div>${ic('right')}</a>`;
 else if(a==='soon')hero=`<a class="hero warn" href="#pay-${top.id}"><span class="ring">${ic('card','lg')}</span><div class="grow"><div class="big">${t('hero_pay',{device:esc(dname(top))})}</div><div class="sub">${t('ends_in',{n:days(top.paidUntil),u:pf(days(top.paidUntil),'day')})}</div></div>${ic('right')}</a>`;
 else hero=`<div class="hero ok"><span class="ring">${ic('check','lg')}</span><div><div class="big">${t('sum_ok')}</div><div class="sub">${t('sum_okS')}</div></div></div>`;
 return `${topbar()}<main class="stack s24 fade"><div class="stack s8"><h1 style="font-size:1.45rem">${greet()}${S.name?', '+esc(S.name):''}</h1>${hero}<p class="beat">${ic('heart','sm')}<span>${t('beat')}</span></p></div>
 <section class="stack" aria-labelledby="hdev"><h2 id="hdev">${t('my_devices')}</h2>${list.map(devCard).join('')}
 <button class="add" type="button" data-act="add"><span class="ic">${ic('qr')}</span><div><div style="font-weight:700">${t('add_device')}</div><div class="muted small">${t('add_hint')}</div></div></button></section>
 ${S.family.length?'':`<section class="tip"><div class="row"><span class="ic brand" style="background:var(--surface)">${ic('users')}</span><h2 class="grow" style="font-size:1.1rem">${t('fam_t')}</h2></div><p>${t('fam_s')}</p><button class="btn primary" type="button" data-go="fam-new">${ic('plus')} ${t('fam_add')}</button></section>`}
 </main>${tabs('home')}`;
}
function mapSvg(){return `<svg viewBox="0 0 320 200" aria-hidden="true" preserveAspectRatio="xMidYMid slice"><rect width="320" height="200" fill="var(--map)"/><path d="M0 150 C60 135 90 170 150 160 S260 120 320 135 L320 200 L0 200z" fill="var(--water)"/><rect x="200" y="20" width="90" height="60" rx="10" fill="var(--park)"/><g stroke="var(--road)" stroke-width="10" fill="none" stroke-linecap="round"><path d="M-10 60 H330"/><path d="M110 -10 V210"/><path d="M40 -10 L250 210"/></g><circle cx="150" cy="92" r="22" fill="var(--brand)" fill-opacity=".14" stroke="var(--brand)" stroke-opacity=".5" stroke-dasharray="4 4"/><circle cx="150" cy="92" r="10" fill="var(--brand)" stroke="var(--surface)" stroke-width="4"/></svg>`;}
function vDevice(id){
 const x=dev(id);if(!x)return vHome();const off=x.status==='off',a=attn(x);
 const evIc={ok:'check',bad:'nosig',warn:'power',info:'card'};const ch=chans().join(' · ');
 const ev=x.ev.slice().sort((p,q)=>q[1].localeCompare(p[1]));
 let main='';
 if(off)main=`<a class="btn primary" href="tel:${digits(SELLER)}">${ic('phone')} ${t('call_seller')}</a>`;
 if(x.mode==='none')main+=`<button class="btn ${off?'ghost':'primary'}" type="button" data-go="pay-${x.id}">${ic('key')} ${t('activate')}</button>`;
 else if(x.mode==='sub')main+=`<a class="btn ghost" href="#payments">${ic('refresh')} ${t('ap_btn')}</a>`;
 else main+=(x.auto?`<a class="btn ghost" href="#payments">${ic('refresh')} ${t('ar_on')}</a>`:'')+`<button class="btn ${a==='soon'&&!off&&!x.auto?'primary':'ghost'}" type="button" data-go="pay-${x.id}">${ic('card')} ${a==='soon'?t('renew'):t('prepay')}</button>`;
 const sec=x.type==='alarm'||x.type==='tracker';const steps=x.cause==='jam'?(sec?['d_jam_1','d_jam_2']:['d_lost_1','d_jam_2']):x.cause==='sim'?['d_sim_1','d_jam_2']:['d_power_1','d_power_2'];
 return `${topbar({back:'home'})}<main class="stack s24 fade">
 <section class="card bigstatus"><div class="orb ${off?'bad':'ok'}">${ic(DEVICON[x.type],'lg')}</div><h1><button type="button" class="ttl" data-act="rename" data-arg="${x.id}" aria-label="${t('d_rename')}: ${esc(dname(x))}">${esc(dname(x))}${ic('pencil','sm')}</button></h1>${pill(x)}<p class="muted small">${seenTxt(x)} · ${t('beat')}</p></section>
 ${x.moved?`<section class="card stack" style="background:var(--bad-bg)"><h2 style="color:var(--bad)">${t('hero_move',{device:esc(dname(x))})}</h2><p>${t('note_move',{t:ftime(x.moved)})}</p><a class="btn primary" href="#map">${ic('pin')} ${t('move_map')}</a><button class="btn ghost" type="button" data-act="moveok" data-arg="${x.id}">${ic('check')} ${t('move_ok')}</button></section>`:''}
 ${off?`<section class="card stack" style="background:var(--bad-bg)"><h2 style="color:var(--bad)">${t('d_what')}</h2><ol class="stack s8" style="margin:0;padding-left:22px">${steps.map(k=>`<li>${t(k)}</li>`).join('')}</ol></section>`:''}
 <div class="stack s8">${main}</div>
 <div class="tiles">
  <div class="tile"><span class="k">${ic(off?'nosig':'signal','sm')}${t('d_conn')}</span><span class="v">${off?t('d_unknown'):t('d_sig')}</span></div>
  <div class="tile"><span class="k">${ic('bell','sm')}${t('d_alerts')}</span><span class="v">${alertsOn()?t('d_alertsOn'):t('d_alertsOff')}</span></div>
  <div class="tile" style="grid-column:1/-1"><span class="k">${ic('card','sm')}${t('d_pay')}</span><span class="v">${payTxt(x)}</span>${x.mode==='sub'||x.auto?`<a class="small" href="#payments" style="color:var(--brand);font-weight:600;display:inline-flex;gap:6px;align-items:center">${ic('refresh','sm')}${t('ar_on')}</a>`:''}</div></div>
 <section class="card stack"><label class="row" for="loc-${x.id}" style="cursor:pointer"><span class="grow"><span style="display:block;font-weight:600">${t('d_locT')}</span><span class="muted small" style="display:block">${t('d_locS')}</span></span>
  <span class="sw"><input type="checkbox" role="switch" id="loc-${x.id}" data-act="loc" data-arg="${x.id}" ${x.loc&&S.geo?'checked':''}><span></span></span></label>
  ${x.loc&&S.geo?`<div class="map" style="position:relative">${cityTag()}${mapSvg()}</div><p class="muted small" style="display:flex;gap:6px;align-items:center">${ic('pin','sm')}${esc(t('city'))} · ${t('d_locMap')}</p>`:''}</section>
 <section class="card stack s8"><h2>${t('d_hist')}</h2><div class="tl">${ev.map(([k,w,c])=>`<div class="e"><span class="dt ${c}">${ic(k==='ev_move'?'pin':evIc[c],'sm')}</span><div><div style="font-weight:600">${t(k)}</div><div class="muted small">${fwhen(w)}</div>${c!=='info'?`<div class="proof">${ic('check','sm')}<span>${esc(t('ev_proof',{ch}))}</span></div>`:''}</div></div>`).join('')}</div></section></main>${tabs('home')}`;
}
function vPay(id){
 const x=dev(id);if(!x)return vHome();
 if(!S.pay||S.pay.id!==id)S.pay={id,plan:'y',step:'choose'};
 const p=S.pay,pr=PR[x.plan];
 if(p.step==='proc')return `<main class="stack s24" style="align-items:center;text-align:center;padding-top:120px"><div class="spinner" role="progressbar" aria-label="${t('p_proc')}"></div><h1 style="font-size:1.3rem">${t('p_proc')}</h1></main>`;
 if(p.step==='ok')return `${topbar()}<main class="stack s24 fade" style="align-items:center;text-align:center;padding-top:32px"><div class="success">${ic('check','lg')}</div><h1>${t('p_ok')}</h1>
  <p class="muted">${p.res==='code'?p.resTxt+'. '+t('p_okS',{device:esc(dname(x)),date:fdate(x.paidUntil)}):p.res==='m'?t('p_okM',{date:fdate(x.next)}):t('p_okS',{device:esc(dname(x)),date:fdate(x.paidUntil)})}</p>${x.auto&&p.res!=='code'&&p.res!=='m'?`<p class="status ok" style="margin:0 auto">${ic('refresh','sm')} ${t('ar_on')}</p><p class="muted small">${t('ar_next',{date:fdate(x.paidUntil)})}</p>`:''}
  <button class="btn primary" type="button" data-act="payback">${t('p_back')}</button><button class="btn plain" type="button" data-act="payhome">${t('p_home')}</button></main>`;
 const plans=PLANS.filter(q=>!(q.k==='m'&&x.mode==='sub'));if(!plans.find(q=>q.k===p.plan))p.plan='y';
 const plan=PLANS.find(q=>q.k===p.plan);const thru=paidThrough(x);const prepaid=!!thru&&d(thru)>now();const base=prepaid?thru:today();
 const deferred=p.plan==='m'&&prepaid;const price=deferred?0:pr[p.plan];const until=addMonths(base,plan.mo);
 const label=deferred?t('p_enable'):t('p_pay',{sum:money(price)});
 if(p.step==='card')return `${topbar({back:true,backAct:'cardback'})}<main class="stack s24 fade"><h1>${t('p_card')}</h1>
  <form class="stack" data-form="card" novalidate>
   <label class="f" for="cn">${t('p_cardno')}<input class="inp" id="cn" inputmode="numeric" autocomplete="cc-number" value="${esc(p.cn!=null?p.cn:'4242 4242 4242 4242')}" maxlength="19" ${p.err?'aria-invalid="true" aria-describedby="cnh"':''}></label>
   ${p.err?`<span id="cnh" class="err">${ic('alert','sm')}<span>${t('p_cardErr')}</span></span>`:''}
   <div class="row" style="align-items:flex-start;flex-wrap:wrap"><label class="f grow" for="ce" style="min-width:130px">${t('p_exp')}<input class="inp" id="ce" inputmode="numeric" value="12/29" maxlength="5"></label><label class="f grow" for="cv" style="min-width:130px">${t('p_cvv')}<input class="inp" id="cv" type="password" inputmode="numeric" value="123" maxlength="4"></label></div>
   ${p.plan==='m'?`<p class="note" style="background:var(--brand-soft);color:var(--ink)">${t('ar_hintM',{sum:money(pr.m)})}</p>`:`<label class="agr" for="ar"><input type="checkbox" id="ar" ${p.ar?'checked':''}><span><b>${t('ar_label')}</b><br><span class="muted small">${t('ar_hint',{sum:money(pr[p.plan])})}</span></span></label>`}
   <div class="democard">${ic('flask','sm')}<span>${t('p_demo')}</span></div>
   <div class="sum"><span class="muted">${deferred?t('p_today'):t('p_total')}</span><b>${money(price)}</b></div>
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
   return `<button type="button" class="plan" role="radio" aria-checked="${sel}" data-act="plan" data-arg="${q.k}"><span class="radio">${sel?ic('check','sm'):''}</span><span class="grow"><span style="display:block;font-weight:700">${t('p_'+q.k)}</span><span class="muted small" style="display:block">${q.k==='m'?t('p_mS'):t('p_permonth',{sum:money(Math.round(v/q.mo))})}</span></span><span class="pr"><span class="price" style="display:block">${money(v)}</span>${sv>0?`<span class="save" style="display:block">${t('p_save',{p:Math.round(sv/(pr.m*q.mo)*100)})}</span>`:''}</span></button>`;}).join('');
  const info=p.plan==='m'?(deferred?t('p_mStart',{date:fdate(thru)}):t('p_mNext',{date:fdate(addMonths(today(),1))})):(prepaid?t('p_add',{to:fdate(until)}):t('p_until',{date:fdate(until)}));
  const amt=deferred?t('p_enable'):money(price);
  body=`<div class="stack" role="radiogroup" aria-label="${t('p_title')}" style="gap:12px">${rows}</div>
  <div class="card stack s8"><div class="sum"><span class="muted">${deferred?t('p_today'):t('p_total')}</span><b>${money(price)}</b></div><p class="muted small">${info}</p></div>
  <div class="stack s8"><button class="paybtn" type="button" data-act="wallet">Apple Pay · ${amt}</button><button class="paybtn alt" type="button" data-act="wallet">Google Pay · ${amt}</button><button class="btn ghost" type="button" data-act="tocard">${ic('card')} ${t('p_card')}</button></div>
  <p class="muted small" style="display:flex;gap:8px">${ic('sim','sm')}<span>${t('p_sim')}</span></p>
  <p class="muted small" style="text-align:center">${t('pay_terms')} <button type="button" class="lnk" data-act="doc" data-arg="terms">${t('ag_terms')}</button>.</p>`;}
 body=codeBlock+body;
 return `${topbar({back:'device-'+id})}<main class="stack s24 fade"><div class="stack s8"><h1>${t('p_title')}</h1><p class="muted">${t('p_for',{device:esc(dname(x))})}</p></div>${body}</main>`;
}
const defCard=()=>S.cards.find(c=>c.def)||S.cards[0];
function addCard(num,exp){const l4=digits(num).slice(-4);let c=S.cards.find(x=>x.last4===l4);if(!c){c={id:'c'+Date.now().toString(36),last4:l4,exp:exp||'12/29',def:!S.cards.length};S.cards.push(c);}return c;}
function seedDemo(chosenType){const n=now();const ago=(dd,h,m)=>{const x=new Date(n);x.setDate(x.getDate()-dd);x.setHours(h,m,0,0);return isoT(x);};
 const mk={
  inverter:{model:'H5',plan:'std',mode:'pkg',paidUntil:addMonths(today(),30),start:ago(400,12,0).slice(0,10),ev:[['ev_restored',ago(0,8,14),'ok'],['ev_off',ago(0,6,2),'warn'],['ev_paid',ago(400,12,40),'info']]},
  tracker:{model:'T2',plan:'light',mode:'sub',next:addMonths(today(),1).slice(0,8)+'12',start:ago(200,9,0).slice(0,10),ev:[['ev_paid',ago(19,9,0),'info'],['ev_restored',ago(1,14,31),'ok'],['ev_lost',ago(1,14,22),'bad']]},
  alarm:{model:'A4',plan:'std',mode:'pkg',paidUntil:addMonths(today(),16),auto:{plan:'y2'},start:ago(300,10,0).slice(0,10),ev:[['ev_restored',ago(4,21,19),'ok'],['ev_lost',ago(4,21,7),'bad'],['ev_paid',ago(300,10,5),'info']]},
  boiler:{model:'R1',plan:'light',mode:'pkg',paidUntil:addMonths(today(),11),start:ago(30,15,0).slice(0,10),ev:[['ev_code',ago(30,15,10),'info']]}};
 Object.keys(mk).filter(k=>k!==chosenType).forEach(k=>{const o=mk[k];S.devices.push(Object.assign({id:k+'0',type:k,status:'ok',loc:true},o));});
 S.cards=[{id:'c0',last4:'4242',exp:'12/29',def:true}];
 S.tx=[{ts:ago(19,9,0),dev:'tracker0',desc:t('pm_kindM'),sum:PR.light.m,ok:true,via:'card',card:'4242'},{ts:ago(19,8,55),dev:'tracker0',desc:t('pm_kindM'),sum:PR.light.m,ok:false,via:'card',card:'4242',retried:true},{ts:ago(49,9,0),dev:'tracker0',desc:t('pm_kindM'),sum:PR.light.m,ok:true,via:'card',card:'4242'},{ts:ago(300,10,5),dev:'alarm0',desc:t('pm_kindP',{term:t('p_y2')}),sum:PR.std.y2,ok:true,via:'card',card:'4242'}].filter(o=>dev(o.dev));
 S.devices.sort((a,b)=>a.id.localeCompare(b.id));}
function addTx(o){S.tx.unshift(Object.assign({ts:isoT(now())},o));}
function autoItems(){const a=[];S.devices.forEach(x=>{if(x.mode==='sub')a.push({x,kind:'m',date:x.next,sum:PR[x.plan].m});else if(x.mode==='pkg'&&x.auto)a.push({x,kind:'p',date:x.paidUntil,sum:PR[x.plan][x.auto.plan],term:t('p_'+x.auto.plan)});});return a;}
function vPayments(){const it=autoItems();const dc=defCard();
 const txIcon=o=>o.ok?'check':'alert';
 return `${topbar({back:'profile'})}<main class="stack s24 fade"><div class="stack s8"><h1>${t('pm_title')}</h1><p class="muted">${t('pm_sub')}</p></div>
 ${it.length?`<div class="list">${it.map(o=>`<div class="li" style="flex-wrap:wrap"><span class="ic brand">${ic(DEVICON[o.x.type])}</span><div class="grow"><div class="t">${esc(dname(o.x))}</div><div class="s">${o.kind==='m'?t('pm_kindM'):t('pm_kindP',{term:o.term})}${dc?' · '+t('pm_from',{c:dc.last4}):''}</div><div class="s">${t('pm_next',{date:fdate(o.date),sum:money(o.sum)})}</div></div><button class="btn danger auto small" type="button" data-act="aroffq" data-arg="${o.x.id}" style="min-height:44px">${t('pm_off')}</button></div>`).join('')}</div>`:`<p class="muted">${t('pm_none')}</p>`}
 <section class="stack s8"><h2>${t('cards')}</h2><div class="list">${S.cards.map(c=>`<div class="li" style="flex-wrap:wrap"><span class="ic">${ic('card')}</span><div class="grow"><div class="t">•••• ${c.last4} ${c.def?`<span class="status ok" style="padding:2px 10px;font-size:.8rem;margin-left:6px">${t('card_def')}</span>`:''}</div><div class="s">${t('card_exp',{d:esc(c.exp)})}</div></div>
  <div class="row" style="gap:4px">${c.def?'':`<button class="btn plain auto small" type="button" data-act="carddef" data-arg="${c.id}">${t('card_mkdef')}</button>`}<button class="btn plain auto small" type="button" data-act="carddel" data-arg="${c.id}" style="color:var(--bad)">${t('card_del')}</button></div></div>`).join('')||`<div class="li muted">${t('card_none')}</div>`}
  <button class="li" type="button" data-act="cardadd"><span class="ic brand">${ic('plus')}</span><span class="grow t">${t('card_add')}</span></button></div></section>
 <section class="stack s8"><h2>${t('tx_title')}</h2>${S.tx.length?`<div class="list">${S.tx.map((o,i)=>{const d=dev(o.dev);return `<div class="li" style="flex-wrap:wrap"><span class="dt ${o.ok?'ok':'bad'}">${ic(txIcon(o),'sm')}</span><div class="grow"><div class="t">${o.sum?money(o.sum):esc(o.desc)}</div><div class="s">${d?esc(dname(d)):''}${o.sum?' · '+esc(o.desc):''}</div><div class="s">${fwhen(o.ts)} · ${o.via==='code'?t('tx_code'):o.via==='wallet'?t('tx_wallet'):'•••• '+o.card}</div>${o.ok?'':`<div class="s" style="color:var(--bad);font-weight:600">${t('tx_fail')}: ${t('tx_reason')}</div>`}</div>${o.ok?`<span class="small" style="color:var(--ok);font-weight:600">${t('tx_ok')}</span>`:o.retried?`<span class="small muted" style="font-weight:600">${t('tx_retried_l')}</span>`:`<button class="btn primary auto small" type="button" data-act="txretry" data-arg="${i}" style="min-height:44px">${t('tx_retry')}</button>`}</div>`;}).join('')}</div>`:`<p class="muted">${t('tx_none')}</p>`}</section>
 </main>`;}
function vAlerts(){
 const rows=[['lost','nosig','a_lost','a_lostS'],['off','power','a_off','a_offS'],['sim','sim','a_sim','a_simS'],['move','pin','a_move','a_moveS'],['pay','card','a_pay','a_payS']];
 const recent=[];S.devices.forEach(x=>x.ev.forEach(e=>{if(e[2]!=='info')recent.push([x,e]);}));recent.sort((a,b)=>b[1][1].localeCompare(a[1][1]));
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
 <h3 style="margin-top:8px">${t('h_faq')}</h3>${[1,2,3,4,5].map(i=>`<details class="faq"><summary>${t('q'+i)}${ic('right','chev')}</summary><p>${t('a'+i)}</p></details>`).join('')}</section>`;
}
function cityTag(){return `<div style="position:absolute;left:12px;top:12px;background:var(--surface);padding:6px 12px;border-radius:999px;font-weight:700;font-size:.85rem;box-shadow:var(--shadow);display:flex;gap:6px;align-items:center">${ic('pin','sm')}${esc(t('city'))}</div>`;}
function mapPins(list){const pos=[[110,96],[218,70],[176,150],[70,160],[262,138],[140,42]];
 return `<svg viewBox="0 0 320 200" aria-hidden="true" preserveAspectRatio="xMidYMid slice"><rect width="320" height="200" fill="var(--map)"/><path d="M0 150 C60 135 90 170 150 160 S260 120 320 135 L320 200 L0 200z" fill="var(--water)"/><rect x="200" y="20" width="90" height="60" rx="10" fill="var(--park)"/><g stroke="var(--road)" stroke-width="10" fill="none" stroke-linecap="round"><path d="M-10 60 H330"/><path d="M110 -10 V210"/><path d="M40 -10 L250 210"/></g><g stroke="var(--road)" stroke-width="5" fill="none" stroke-linecap="round"><path d="M-10 115 H200"/><path d="M190 -10 V130"/></g>
 ${list.map((x,i)=>{let [cx,cy]=pos[i%pos.length];if(x.moved){cx=Math.min(300,cx+46);cy=Math.max(20,cy-30);}const col=x.status==='off'||x.moved?'var(--bad)':'var(--brand)';return `<circle cx="${cx}" cy="${cy}" r="17" fill="${col}" fill-opacity=".16"/><circle cx="${cx}" cy="${cy}" r="12" fill="${col}" stroke="var(--surface)" stroke-width="3"/><text x="${cx}" y="${cy+4}" text-anchor="middle" font-size="11" font-weight="800" fill="#fff" font-family="system-ui">${i+1}</text>`;}).join('')}</svg>`;}
function vMap(){
 if(!S.geo)return `${topbar()}<main class="stack s24 fade"><h1>${t('m_title')}</h1>
 <section class="card stack" style="align-items:center;text-align:center;padding:28px 20px"><span class="ic brand" style="width:72px;height:72px;border-radius:22px">${ic('pin','lg')}</span><h2>${t('m_ask')}</h2><p class="muted">${t('m_askS')}</p>
 <button class="btn primary" type="button" data-act="geo">${ic('check')} ${t('m_allow')}</button><p class="muted small">${t('m_note')}</p></section></main>${tabs('map')}`;
 const shown=S.devices.filter(x=>x.loc),hidden=S.devices.filter(x=>!x.loc);
 return `${topbar()}<main class="stack s24 fade"><h1>${t('m_title')}</h1>
 <div class="map" style="aspect-ratio:4/3;position:relative">${cityTag()}${mapPins(shown)}</div><p class="muted small" style="display:flex;gap:6px;align-items:center">${ic('pin','sm')}${esc(t('city'))} · ${t('m_approx')}</p>
 <div class="list">${shown.map((x,i)=>`<a class="li" href="#device-${x.id}"><span class="dt ${x.status==='off'?'bad':'info'}" style="font-weight:800">${i+1}</span><div class="grow"><div class="t">${esc(dname(x))}</div><div class="s">${x.status==='off'?t('st_off'):t('st_ok')} · ${seenTxt(x)}</div></div>${ic('right','chev')}</a>`).join('')}
 ${hidden.map(x=>`<a class="li" href="#device-${x.id}"><span class="dt info">${ic(DEVICON[x.type],'sm')}</span><div class="grow"><div class="t">${esc(dname(x))}</div><div class="s">${t('m_hidden')}</div></div>${ic('right','chev')}</a>`).join('')}</div>
 <button class="btn plain" type="button" data-act="geooff" style="color:var(--bad)">${t('m_off')}</button></main>${tabs('map')}`;
}
function vProfile(){
 return `${topbar()}<main class="stack s24 fade"><h1>${t('pr_title')}</h1>
 <div class="list"><button class="li" type="button" data-act="editname"><span class="ic">${ic('user')}</span><div class="grow"><div class="s">${t('pr_name')}</div><div class="t">${S.name?esc(S.name):t('none')}</div></div><span class="muted small">${t('pr_edit')}</span></button></div>
 <div class="list"><a class="li" href="#payments"><span class="ic">${ic('refresh')}</span><div class="grow"><div class="t">${t('pm_title')}</div><div class="s">${autoItems().length?autoItems().map(o=>esc(dname(o.x))).join(', '):t('pm_none')}</div></div>${ic('right','chev')}</a></div>
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

const OB=['welcome','start-1','start-2','start-done'];
function build(){
 let h=(location.hash||'').slice(1);
 if(!S.onboarded&&!OB.includes(h)){h='welcome';history.replaceState(null,'','#welcome');}
 if(S.onboarded&&OB.includes(h)&&!(h==='start-done'&&S.justDone)){h='home';history.replaceState(null,'','#home');}
 if(!S.onboarded&&h!=='welcome'&&!S.pend&&!S.devices.length){h='welcome';history.replaceState(null,'','#welcome');}
 if(!h)h='home';
 if(!h.startsWith('pay-')&&S.pay&&S.pay.step!=='proc')S.pay=null;
 let v,tb=true;
 if(h==='welcome'){v=vPick('ob');tb=false;}else if(h==='add'){v=vPick('add');tb=false;}
 else if(h==='start-1'){v=vContacts('ob');tb=false;}else if(h==='start-2'){v=vCode();tb=false;}else if(h==='start-done'){v=vDone();tb=false;}
 else if(h==='contacts'){v=vContacts('edit');tb=false;}
 else if(h.startsWith('fam-')){v=vFam(h.slice(4));tb=false;}
 else if(h==='payments'){v=vPayments();tb=false;}
 else if(h.startsWith('device-'))v=vDevice(h.slice(7));else if(h.startsWith('pay-')){v=vPay(h.slice(4));tb=false;}
 else if(h==='alerts')v=vAlerts();else if(h==='map')v=vMap();else if(h==='help'){v=vProfile();setTimeout(()=>{const e=document.getElementById('help');if(e)e.scrollIntoView();},0);}else if(h==='profile')v=vProfile();else v=vHome();
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
window.addEventListener('hashchange',()=>{closeOverlay(true);render(false);});

let tt;function toast(msg){const el=document.getElementById('toast');el.innerHTML=ic('check','sm')+'<span>'+msg+'</span>';el.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>el.classList.remove('show'),3200);}
let pt;const pushEl=document.getElementById('push');
function push(text){const via=S.msgs[0]||t('a_mail');
 pushEl.innerHTML=`<span aria-hidden="true" style="flex:none">${LOGO}</span><span class="grow"><span style="display:block;font-weight:700;font-size:.9rem">${esc(via)} · ${esc(t('brand'))} CONNECT <span class="muted" style="font-weight:500">· ${t('seen_now')}</span></span><span style="display:block;font-size:.95rem">${esc(text)}</span></span><button class="x" type="button" data-act="closepush" aria-label="${t('close')}">${ic('x','sm')}</button>`;
 pushEl.hidden=false;requestAnimationFrame(()=>requestAnimationFrame(()=>pushEl.classList.add('show')));clearTimeout(pt);pt=setTimeout(hidePush,10000);}
function hidePush(){pushEl.classList.remove('show');setTimeout(()=>{if(!pushEl.classList.contains('show'))pushEl.hidden=true;},460);}
const overlay=document.getElementById('overlay');let lastFocus=null;
function closeOverlay(silent){if(!overlay.innerHTML)return;overlay.innerHTML='';if(!silent&&lastFocus&&document.contains(lastFocus))lastFocus.focus();lastFocus=null;}
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
function lab(){const ds=S.devices;if(!labDev||!dev(labDev))labDev=ds[0]&&ds[0].id;
 const evs=[['lost','nosig','x_lost'],['off','power','x_off'],['sim','sim','x_sim'],['move','pin','x_move'],['back','check','x_back'],['pay','card','x_pay'],['fail','alert','x_fail'],['test','bell','x_test']];
 sheet(t('x_title'),`<p class="muted">${t('x_sub')}</p>
 ${ds.length>1?`<div class="stack s8"><span class="tag">${t('x_dev')}</span><div class="chips">${ds.map(x=>`<button type="button" class="chip" data-act="labdev" data-arg="${x.id}" aria-pressed="${x.id===labDev}">${ic(DEVICON[x.type],'sm')}${esc(dname(x))}</button>`).join('')}</div></div>`:''}
 <div class="list">${evs.map(([k,i,l])=>`<button class="evbtn" type="button" data-act="sim" data-arg="${k}"><span class="ic">${ic(i)}</span><span class="grow">${t(l)}</span>${ic('right','chev')}</button>`).join('')}</div>
 <span class="tag">${t('x_more')}</span>
 <div class="list"><button class="evbtn" type="button" data-act="labadd"><span class="ic">${ic('plus')}</span><span class="grow">${t('x_add')}</span></button><button class="evbtn" type="button" data-act="labreset"><span class="ic">${ic('refresh')}</span><span class="grow">${t('x_reset')}</span></button></div>
 <button class="btn plain" type="button" data-act="closeov">${t('close')}</button>`);}
function simulate(kind){const x=dev(labDev);if(!x)return;
 const map={lost:'lost',off:'off',sim:'sim',move:'move',back:'lost',pay:'pay',fail:'pay'};
 if(kind==='move'&&x.type==='tracker'){closeOverlay(true);toast(t('x_moveNA'));return;}
 if(kind!=='test'&&kind!=='back'&&!S.alerts[map[kind]]){closeOverlay(true);toast(t('x_muted'));return;}
 S.tick+=1;const ts=isoT(now());const tm=ftime(ts);const v={d:dname(x),t:tm};
 closeOverlay(true);
 if(kind==='test'){push(t('pe_test'));save();return;}
 if(kind==='fail'){const c=defCard()||addCard('4242424242424242');const sum=x.mode==='sub'?PR[x.plan].m:PR[x.plan][(x.auto&&x.auto.plan)||'y'];addTx({dev:x.id,desc:x.mode==='sub'?t('pm_kindM'):t('pm_kindP',{term:t('p_'+((x.auto&&x.auto.plan)||'y'))}),sum,ok:false,via:'card',card:c.last4});x.ev.push(['ev_payfail',ts,'bad']);save();render(true);push(t('pe_fail',{d:dname(x),sum:money(sum),c:c.last4}));return;}
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
 pick(i){const c=CAT[+i];const x=newDevice(c);
  if(S.onboarded){S.devices.push(x);save();go('device-'+x.id);toast(t('ev_bound'));}
  else{S.pend=x;save();go('start-1');}},
 msg(v,el){const box=el.closest('.chips');let ms=box.dataset.ms?box.dataset.ms.split(','):[];ms=ms.includes(v)?ms.filter(m=>m!==v):ms.concat(v);box.dataset.ms=ms.join(',');
  box.querySelectorAll('.chip').forEach(b=>{b.setAttribute('aria-pressed',ms.includes(b.dataset.arg));});const pw=document.getElementById(box.dataset.pw);if(pw){pw.querySelectorAll('[data-ph]').forEach(l=>{const on=ms.includes(l.dataset.ph);const inp=l.querySelector('input');if(on&&l.hidden&&!inp.value){const other=[...pw.querySelectorAll('[data-ph]:not([hidden]) input')].map(x=>x.value).find(Boolean);if(other)inp.value=other;}l.hidden=!on;});const h=pw.querySelector('[data-phhint]');if(h)h.hidden=!ms.length;}},
 resend(){toast(t('code_sent'));},
 notarrived(){const f=app.querySelector('#nm');if(f)S.name=f.value.trim();S.justDone=false;go('help');},
 add(){sheet(t('add_device'),`<p class="muted">${t('add_sheet')}</p><button class="btn primary" type="button" data-go="add">${ic('qr')} ${t('add_demo')}</button><button class="btn plain" type="button" data-act="closeov">${t('close')}</button>`);},
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
 txretry(i){const o=S.tx[+i];S.tick+=1;o.retried=true;addTx({dev:o.dev,desc:o.desc,sum:o.sum,ok:true,via:'card',card:(defCard()||{last4:o.card}).last4});save();rerender();toast(t('tx_retried'));},
 aroffq(id){const x=dev(id);const dt=x.mode==='sub'?x.next:x.paidUntil;sheet(t('pm_off'),`<p>${t('pm_offQ',{d:esc(dname(x)),date:fdate(dt)})}</p><button class="btn danger" type="button" data-act="aroff" data-arg="${id}">${t('pm_off')}</button><button class="btn primary" type="button" data-act="closeov">${t('cancel')}</button>`);},
 aroff(id){const x=dev(id);if(x.mode==='sub'){x.mode='pkg';x.paidUntil=x.next;delete x.next;}delete x.auto;closeOverlay(true);rerender();toast(t('pm_offDone'));},
 rem(n){n=+n;if(S.remind.includes(n)){if(S.remind.length===1){toast(t('r_none'));return;}S.remind=S.remind.filter(x=>x!==n);}else S.remind.push(n);save();rerender();},
 rename(id){const x=dev(id);sheet(t('d_rename_t'),`<form class="stack" data-form="rename" data-id="${id}"><input class="inp" id="rn" value="${esc(dname(x))}" maxlength="32" aria-label="${t('d_rename_t')}"><button class="btn primary" type="submit">${t('save')}</button><button class="btn plain" type="button" data-act="closeov">${t('cancel')}</button></form>`);},
 loc(id,el){dev(id).loc=el.checked;if(el.checked)S.geo=true;rerender();},
 geo(){S.geo=true;S.devices.forEach(x=>{if(x.loc==null)x.loc=true;});rerender();},
 geooff(){S.geo=false;rerender();toast(t('m_offDone'));},
 alert(k,el){if(!el.checked&&(k==='lost'||k==='sim'||k==='move')){el.checked=true;sheet(t('a_'+k),`<p>${t('a_offQ')}</p><button class="btn danger" type="button" data-act="alertoff" data-arg="${k}">${t('a_offY')}</button><button class="btn primary" type="button" data-act="closeov">${t('a_keep')}</button>`);return;}S.alerts[k]=el.checked;save();},
 alertoff(k){S.alerts[k]=false;closeOverlay(true);rerender();},
 autopay(id){const x=dev(id);sheet(t('ap_t'),`<p>${t('ap_next',{date:fdate(x.next),sum:money(PR[x.plan].m)})}</p><button class="btn ghost" type="button" data-go="pay-${id}">${ic('card')} ${t('prepay')}</button><button class="btn danger" type="button" data-act="apoffq" data-arg="${id}">${t('ap_off')}</button><button class="btn plain" type="button" data-act="closeov">${t('close')}</button>`);},
 apoffq(id){const x=dev(id);sheet(t('ap_off'),`<p>${t('ap_offQ',{date:fdate(x.next)})}</p><button class="btn danger" type="button" data-act="apoff" data-arg="${id}">${t('ap_offY')}</button><button class="btn primary" type="button" data-act="closeov">${t('ap_keep')}</button>`);},
 apoff(id){const x=dev(id);x.mode='pkg';x.paidUntil=x.next;delete x.next;closeOverlay(true);rerender();toast(t('ap_done'));},
 democode(){const x=dev(S.pay.id);S.pay.code=demoCode(x.plan);S.pay.cerr='';rerender();},
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
 logoutY(){S=fresh(S.lang);save();go('welcome');},
 logoutN(){rerender();},
 lab(){lab();},
 doc(k){sheet(k==='priv'?t('doc_priv'):t('doc_terms'),`<p class="muted">${t('doc_demo')}</p><button class="btn primary" type="button" data-act="closeov">${t('close')}</button>`);},
 labdev(id){labDev=id;lab();},
 sim(k){simulate(k);},
 labadd(){closeOverlay(true);go('add');},
 labreset(){S=fresh(S.lang);closeOverlay(true);save();go('welcome');toast(t('x_done'));}
};
function selectNum(){const p=document.getElementById('sellerNum');if(p){const r=document.createRange();r.selectNodeContents(p);const s=getSelection();s.removeAllRanges();s.addRange(r);}}
function pay(){const p=S.pay;const x=dev(p.id);const plan=PLANS.find(q=>q.k===p.plan);const thru=paidThrough(x);const prepaid=!!thru&&d(thru)>now();
 p.step='proc';render(false);
 setTimeout(()=>{if(!S.pay)return;S.tick+=1;
  if(p.plan==='m'){x.next=prepaid?thru:addMonths(today(),1);x.mode='sub';delete x.paidUntil;}
  else{x.paidUntil=addMonths(prepaid?thru:today(),plan.mo);x.mode='pkg';delete x.next;if(p.viaCard&&p.ar)x.auto={plan:p.plan};else if(p.viaCard)delete x.auto;}
  let card=null;if(p.viaCard){card=addCard(p.cnum||'4242424242424242',p.cexp);}
  addTx({dev:x.id,desc:p.plan==='m'?t('pm_kindM'):t('pm_kindP',{term:t('p_'+p.plan)}),sum:p.plan==='m'&&prepaid?0:PR[x.plan][p.plan],ok:true,via:card?'card':'wallet',card:card?card.last4:null});
  x.ev.push(['ev_paid',isoT(now()),'info']);p.res=p.plan;p.step='ok';render(false);},1300);}

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
 if(id==='cd'){e.target.value=digits(e.target.value).slice(0,4);if(e.target.value.length===4)setTimeout(()=>{if(location.hash==='#start-2'){const f=app.querySelector('form[data-form="code"]');if(f)f.requestSubmit();}},300);}
 if(id==='cn'){const v=digits(e.target.value).slice(0,16);e.target.value=v.replace(/(.{4})/g,'$1 ').trim();}
 if(id==='ce'){let v=digits(e.target.value).slice(0,4);if(v.length>2)v=v.slice(0,2)+'/'+v.slice(2);e.target.value=v;}
 if(id==='ac'){const v=normCode(e.target.value).slice(0,16);e.target.value=v?fmtCode(v):'';if(S.pay){S.pay.code=e.target.value;S.pay.cerr='';}
  const box=document.getElementById('acd');e.target.removeAttribute('aria-invalid');if(box){const pc=v.length===16?parseCode(v):null;box.innerHTML=pc&&!pc.err?`<p class="small" style="color:var(--ok);font-weight:600;display:flex;gap:6px;align-items:center">${ic('check','sm')}${t('c_dec',{a:PLN[pc.plan],term:termTxt(pc.months)})}</p>`:(pc&&pc.err?`<span class="err">${ic('alert','sm')}<span>${t(pc.err)}</span></span>`:'');}}
});
document.addEventListener('submit',e=>{const f=e.target;e.preventDefault();const k=f.dataset.form;
 if(k==='contacts'){const mode=f.dataset.mode;const em=f.querySelector('#em').value.trim();const rc=readContacts(f,'');const ms=rc.ms;const err={};
  if(!em)err.em='req';else if(!validEmail(em))err.em='bad';if(rc.bad)err.ph=rc.bad;const agEl=f.querySelector('#agr');const agr=agEl?agEl.checked:true;if(mode==='ob'&&!agr)err.agr=1;
  if(err.em||err.ph||err.agr){app.innerHTML=vContacts(mode,err,{em,ph:rc.raw,ms,agr});const bad=app.querySelector('[aria-invalid="true"]');if(bad)bad.focus();return;}
  S.email=em;S.phones=rc.phones;S.msgs=ms;if(mode==='ob')S.agreedAt=isoT(now());save();
  if(mode==='edit'){go('profile');toast(t('saved'));}else go('start-2');}
 else if(k==='code'){if(digits(f.querySelector('#cd').value).length<4){app.innerHTML=vCode(true);app.querySelector('#cd').focus();return;}
  if(S.pend){const ct=S.pend.type;S.devices.push(S.pend);S.pend=null;if(!S.devices.some(x=>x.id.endsWith('0')))seedDemo(ct);}S.onboarded=true;S.justDone=true;save();go('start-done');setTimeout(()=>push(t('pe_test')),700);}
 else if(k==='done'){S.name=f.querySelector('#nm').value.trim();S.justDone=false;go('home');}
 else if(k==='card'){const raw=f.querySelector('#cn').value;const arEl=f.querySelector('#ar');S.pay.ar=arEl?arEl.checked:false;S.pay.viaCard=true;S.pay.cnum=raw;S.pay.cexp=f.querySelector('#ce').value;if(digits(raw).length!==16){S.pay.err=true;S.pay.cn=raw;render(true);const c=app.querySelector('#cn');if(c)c.focus();return;}pay();}
 else if(k==='actcode'){const x=dev(S.pay.id);const raw=f.querySelector('#ac').value;const pc=parseCode(raw);S.pay.code=raw;
  let e=pc.err?t(pc.err):pc.ctry!==HOME?t('c_ctry'):pc.plan!==x.plan?t('c_type',{a:PLN[pc.plan],b:PLN[x.plan]}):'';
  if(e){S.pay.cerr=e;rerender();const c=app.querySelector('#ac');if(c)c.focus();return;}
  const thru=paidThrough(x);const prepaid=!!thru&&d(thru)>now();S.tick+=1;x.paidUntil=addMonths(prepaid&&x.mode==='pkg'?thru:today(),pc.months);x.mode='pkg';delete x.next;x.ev.push(['ev_code',isoT(now()),'info']);addTx({dev:x.id,desc:t('c_dec',{a:PLN[pc.plan],term:termTxt(pc.months)}),sum:0,ok:true,via:'code',code:normCode(raw).slice(-4)});S.pay.res='code';S.pay.resTxt=t('c_ok',{a:PLN[pc.plan],term:termTxt(pc.months)});S.pay.step='ok';render(false);}
 else if(k==='rename'){const x=dev(f.dataset.id);const v=f.querySelector('#rn').value.trim();if(v&&v!==`${t('typ_'+x.type)} ${x.model}`)x.custom=v;else delete x.custom;closeOverlay();rerender();toast(t('d_renamed'));}
 else if(k==='newcard'){const v=f.querySelector('#cn').value;if(digits(v).length!==16){const h=document.getElementById('nch');h.className='err';h.innerHTML=ic('alert','sm')+'<span>'+t('p_cardErr')+'</span>';f.querySelector('#cn').focus();return;}addCard(v,f.querySelector('#ce').value||'12/29');closeOverlay(true);save();rerender();toast(t('card_added'));}
 else if(k==='name'){S.name=f.querySelector('#pn').value.trim();closeOverlay();rerender();toast(t('saved'));}
 else if(k==='fam'){const i=+f.dataset.i;const nm=f.querySelector('#fnm').value.trim();const em=f.querySelector('#fem').value.trim();const rc=readContacts(f,'f');const ms=rc.ms;const err={};
  if(!nm)err.nm=1;if(!em)err.em='req';else if(!validEmail(em))err.em='bad';if(rc.bad)err.ph=rc.bad;
  if(err.nm||err.em||err.ph){app.innerHTML=vFam(i<0?'new':String(i),err,{nm,em,ph:rc.raw,ms});const bad=app.querySelector('[aria-invalid="true"]');if(bad)bad.focus();return;}
  const rec={name:nm,email:em,msgs:ms,phones:rc.phones};if(i<0)S.family.push(rec);else S.family[i]=rec;save();go('profile');toast(i<0?t('fam_added'):t('saved'));}
});
render(false);
})();
