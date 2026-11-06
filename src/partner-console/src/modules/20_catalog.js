/* ===== 20_catalog: brands → categories → device models → IMEI whitelist =====
   Routes: #catalog, #brand--<brandId>, #model--<modelId>
   Extra model fields (optional, set here): desc, volume, imeiUpdatedAt, uploads:[{ts,mode:'add'|'replace',n,source}], approvedAt
   Brand extra field: logo (dataURL | null)
*/
const CAT_PRESETS=['#1F6FEB','#D92D20','#079455','#F79009','#7A5AF8','#101828'];
const CAT_PER=50;
const CAT_LOGO_MAX=200*1024;
const CAT_FILE_MAX=5*1024*1024;
let cat_draft={logo:null,domainTouched:false};
let cat_up={modelId:null,fileText:'',fileName:'',paste:'',res:null};
let cat_qTimer=null;

/* ---------- helpers ---------- */
const CAT_TR={'а':'a','б':'b','в':'v','г':'h','ґ':'g','д':'d','е':'e','є':'ie','ж':'zh','з':'z','и':'y','і':'i','ї':'i','й':'i','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'shch','ь':'','ю':'iu','я':'ia','ы':'y','э':'e','ё':'e','ъ':''};
function cat_slug(s){return String(s||'').toLowerCase().split('').map(c=>CAT_TR[c]!=null?CAT_TR[c]:c).join('').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40);}
function cat_domainFor(name){const s=cat_slug(name);return s?'connect.'+s+'.ua':'';}
function cat_color(hex){return /^#[0-9a-f]{6}$/i.test(hex||'')?hex:'#5F6B7D';}
function cat_ink(hex){const n=parseInt(cat_color(hex).slice(1),16);const L=(0.299*(n>>16&255)+0.587*(n>>8&255)+0.114*(n&255))/255;return L>0.62?'#101828':'#FFFFFF';}
function cat_initial(name){return (String(name||'?').trim().charAt(0)||'?').toUpperCase();}
function cat_mark(b,size){const sz=size||40;
 if(b.logo)return `<span class="cat_mark logo" style="width:${sz}px;height:${sz}px"><img src="${esc(b.logo)}" alt=""></span>`;
 const c=cat_color(b.color);
 return `<span class="cat_mark" aria-hidden="true" data-i="${esc(cat_initial(b.name))}" style="width:${sz}px;height:${sz}px;background:${c};color:${cat_ink(c)};font-size:${Math.round(sz*.42)}px"></span>`;}
function cat_n(n,w,plain){const f={};['one','few','many','other'].forEach(k=>f[k]=t('cat.n.'+w+'.'+k));const word=plural(n,f);return plain?fmtNum(n)+' '+word:`<span class="num">${fmtNum(n)}</span> ${word}`;}
function cat_simStats(){const m={};for(const s of S.sims){if(!s.modelId)continue;const o=m[s.modelId]||(m[s.modelId]={active:0,blocked:0});if(s.status==='active')o.active++;else if(s.status==='blocked')o.blocked++;}return m;}
function cat_brandStats(b,ss){let models=0,imei=0,active=0,review=0,noImei=0;
 b.categories.forEach(c=>c.models.forEach(m=>{models++;imei+=m.imei.length;active+=(ss[m.id]&&ss[m.id].active)||0;if(m.planStatus!=='approved'||!m.plan)review++;if(!m.imei.length)noImei++;}));
 return{cats:b.categories.length,models,imei,active,review,noImei};}
function cat_planBadge(m){if(m.planStatus!=='approved'||!m.plan)return ui.badge(t('cat.review'),'warn',true);return ui.badge(PLAN_NAME[m.plan],m.plan==='std'?'accent':'info');}
function cat_404(){return ui.page({title:t('cat.nf'),crumbs:[[t('cat.title'),'#catalog']],body:ui.card({body:ui.empty('search',t('cat.nf'),t('cat.nfP'),ui.btn(t('cat.toCatalog'),{href:'#catalog',kind:'primary'}))})});}
function cat_cur(){return (S.org&&S.org.currency)||'UAH';}
function cat_vfield(id,label,inner,hint){return `<div class="field"><label for="${id}">${label}</label>${inner}<span class="hint" id="${id}-h">${hint||''}</span></div>`;}
function cat_portal(o){const c=cat_color(o.color);const ink=cat_ink(c);
 return `<div class="cat_portal" aria-hidden="true"><div class="pbar" style="background:${c};color:${ink}">${o.logo?`<span class="cat_mark logo" style="width:26px;height:26px"><img src="${esc(o.logo)}" alt=""></span>`:''}<span class="pname">${esc((o.name||t('cat.brandPh')).toUpperCase())} CONNECT</span></div>
 <div class="pbody"><b>${t('cat.pvTitle')}</b><span class="small muted">${t('cat.pvText')}</span><span class="pinp">XXXX-XXXX-XXXX-XXXX</span><span class="pbtn" style="background:${c};color:${ink}">${t('cat.pvBtn')}</span></div>
 <div class="purl">${icon('globe','sm')} https://${esc(o.domain||'connect.brand.ua')}</div></div>`;}

/* ---------- nav & catalog route ---------- */
nav({key:'catalog',label:()=>t('cat.nav'),icon:'tag',href:'#catalog',order:10,section:()=>t('cat.sec')});

function cat_steps(){return `<ol class="cat_steps">${[1,2,3,4].map(i=>`<li><b>${t('cat.step'+i)}</b><span class="small muted">${t('cat.step'+i+'p')}</span></li>`).join('')}</ol>`;}

route('catalog',{nav:'catalog',render(){
 const newBtn=ui.btn(t('cat.newBrand'),{kind:'primary',icon:'plus',act:'cat_brandNew'});
 if(!S.brands.length)return ui.page({title:t('cat.title'),sub:t('cat.sub'),actions:newBtn,
  body:ui.card({pad:false,body:ui.empty('tag',t('cat.emptyT'),t('cat.emptyP'),ui.btn(t('cat.createBrand'),{kind:'primary',icon:'plus',act:'cat_brandNew'}))+cat_steps()})});
 const ss=cat_simStats();let review=0,noImei=0,models=0;
 const cards=S.brands.map(b=>{const st=cat_brandStats(b,ss);review+=st.review;noImei+=st.noImei;models+=st.models;
  const chips=[];
  if(!st.models)chips.push(ui.badge(t('cat.noModels')));
  if(st.review)chips.push(ui.badge(t('cat.chipReview',{n:fmtNum(st.review)}),'warn',true));
  if(st.noImei)chips.push(ui.badge(t('cat.chipNoImei',{n:fmtNum(st.noImei)}),'bad',true));
  if(st.models&&!st.review&&!st.noImei)chips.push(ui.badge(t('cat.chipReady'),'ok',true));
  return `<a class="card cat_bcard" href="${link('brand',b.id)}">
   <div class="cat_bhead">${cat_mark(b,44)}<div class="grow"><span class="cat_bname">${esc(b.name)}</span><span class="small faint mono cat_dom">${esc(b.domain)}</span></div>${icon('right')}</div>
   <dl class="cat_stats"><div><dt>${t('cat.kCats')}</dt><dd>${fmtNum(st.cats)}</dd></div><div><dt>${t('cat.kModels')}</dt><dd>${fmtNum(st.models)}</dd></div><div><dt>IMEI</dt><dd>${fmtNum(st.imei)}</dd></div><div><dt>${t('cat.kActive')}</dt><dd>${fmtNum(st.active)}</dd></div></dl>
   <div class="row wrap g8">${chips.join('')}</div></a>`;}).join('');
 const notes=[];
 if(noImei)notes.push(ui.note('warn',t('cat.attnNoImei',{n:cat_n(noImei,'model')})));
 if(review)notes.push(ui.note('info',t('cat.attnReview',{n:cat_n(review,'model')})));
 return ui.page({title:t('cat.title'),sub:t('cat.subN',{b:cat_n(S.brands.length,'brand'),m:cat_n(models,'model')}),actions:newBtn,
  body:`<div class="stack">${notes.join('')}<div class="cat_grid">${cards}</div></div>`});}});

/* ---------- brand route ---------- */
route('brand',{nav:'catalog',render(id){const b=findBrand(id);if(!b)return cat_404();
 const ss=cat_simStats();const st=cat_brandStats(b,ss);
 const actions=ui.btn(t('cat.edit'),{kind:'ghost',icon:'edit',act:'cat_brandEdit',arg:b.id})+ui.btn(t('cat.newCat'),{icon:'plus',act:'cat_catNew',arg:b.id})+ui.btn(t('cat.newModel'),{kind:'primary',icon:'plus',act:'cat_modelNew',arg:b.id});
 const sub=`<span class="row wrap g8 cat_domline">${icon('globe','sm')}<span class="mono">${esc(b.domain)}</span>${ui.iconbtn('copy',t('cat.copyDomain'),{act:'copy',arg:b.domain})}</span>`;
 const kpis=`<div class="grid4 cat_kpis">${ui.kpi(t('cat.kCats'),fmtNum(st.cats))}${ui.kpi(t('cat.kModels'),fmtNum(st.models),st.review?t('cat.chipReview',{n:fmtNum(st.review)}):'')}${ui.kpi(t('cat.kImei'),fmtNum(st.imei))}${ui.kpi(t('cat.kActive'),fmtNum(st.active))}</div>`;
 let cats;
 if(!b.categories.length)cats=ui.card({body:ui.empty('layers',t('cat.noCatsT'),t('cat.noCatsP'),ui.btn(t('cat.newCat'),{kind:'primary',icon:'plus',act:'cat_catNew',arg:b.id}))});
 else cats=b.categories.map(c=>{
  const acts=ui.iconbtn('edit',t('cat.renameCat'),{act:'cat_catEdit',arg:b.id+'|'+c.id})+ui.iconbtn('trash',t('cat.delCat'),{act:'cat_catDel',arg:b.id+'|'+c.id})+ui.btn(t('cat.model'),{size:'sm',icon:'plus',act:'cat_modelNew',arg:b.id+'|'+c.id});
  const body=c.models.length?ui.table([{label:t('cat.cModel')},{label:'SKU'},{label:t('cat.cPkg')},{label:'IMEI',cls:'r'},{label:t('cat.kActive'),cls:'r'},{label:'<span class="cat_vh">'+t('c.actions')+'</span>',cls:'r'}],
   c.models.map(m=>{const s=ss[m.id]||{active:0};return{href:link('model',m.id),cells:[
    `<a href="${link('model',m.id)}" class="cat_mlink">${esc(m.name)}</a>${m.desc?`<div class="xs faint cat_clip">${esc(m.desc)}</div>`:''}`,
    `<span class="mono small">${esc(m.sku)}</span>`,cat_planBadge(m),
    m.imei.length?`<span class="num">${fmtNum(m.imei.length)}</span>`:ui.badge(t('cat.noList'),'bad'),
    `<span class="num">${fmtNum(s.active)}</span>`,
    `<span class="row g4" style="justify-content:flex-end">${ui.iconbtn('upload',t('cat.uploadImei'),{act:'cat_upOpen',arg:m.id})}${ui.iconbtn('edit',t('cat.editModel'),{act:'cat_modelEdit',arg:m.id})}</span>`]};}))
   :`<div class="cat_catempty">${ui.empty('box',t('cat.catEmptyT'),t('cat.catEmptyP'),ui.btn(t('cat.newModel'),{icon:'plus',act:'cat_modelNew',arg:b.id+'|'+c.id}))}</div>`;
  return ui.card({title:`${esc(c.name)} <span class="badge">${fmtNum(c.models.length)}</span>`,actions:acts,pad:false,body});}).join('');
 const aside=ui.card({title:t('cat.pvCard'),body:`<div class="stack">${cat_portal(b)}<p class="small muted">${t('cat.pvNote',{name:esc(b.name)})}</p></div>`});
 return ui.page({title:`<span class="row g12">${cat_mark(b,36)}<span>${esc(b.name)}</span></span>`,sub,crumbs:[[t('cat.title'),'#catalog'],[b.name]],actions,
  body:`<div class="stack">${kpis}<div class="cat_bwrap"><div class="stack">${cats}</div><div class="stack">${aside}</div></div></div>`});}});

/* ---------- model route ---------- */
route('model',{nav:'catalog',render(id){const f=findModel(id);if(!f)return cat_404();const {brand:b,cat:c,model:m}=f;
 const ss=cat_simStats();const s=ss[m.id]||{active:0,blocked:0};const cur=cat_cur();const approved=m.planStatus==='approved'&&m.plan;
 const actions=ui.btn(t('cat.editModel'),{icon:'edit',act:'cat_modelEdit',arg:m.id})+ui.btn(t('cat.uploadImei'),{kind:'primary',icon:'upload',act:'cat_upOpen',arg:m.id});
 // package card
 let pkg='';
 if(!approved)pkg=ui.note('info',`<b>${t('cat.reviewNoteT')}</b><br>${t('cat.reviewNote')}`,'clock');
 else{const rows=TERMS.map(term=>{const p=unitPrice({plan:m.plan,term},cur);return{cells:[termLabel(term)+(hasOverride({plan:m.plan,term})?' '+ui.badge(t('cat.indiv'),'violet'):''),`<span class="num">${money(p,cur)}</span>`,`<span class="num muted">${money(p/term,cur,cur==='USD'?2:0)}</span>`]};});
  pkg=`<div class="row wrap g8">${cat_planBadge(m)}<span class="muted">${t('cat.planExp.'+m.plan)}</span></div>
  <div class="cat_prices">${ui.table([{label:t('cat.cTerm')},{label:t('cat.cPrice'),cls:'r'},{label:t('cat.cMonth'),cls:'r'}],rows)}</div>
  <p class="xs faint">${cur==='UAH'?t('c.uah'):t('c.usd')} · ${t('cat.priceNote')}</p>`;}
 const dl=`<dl class="dl small"><dt>${t('cat.brand')}</dt><dd><a href="${link('brand',b.id)}">${esc(b.name)}</a></dd><dt>${t('cat.category')}</dt><dd>${esc(c.name)}</dd><dt>SKU</dt><dd class="mono">${esc(m.sku)}</dd>${m.desc?`<dt>${t('cat.desc')}</dt><dd>${esc(m.desc)}</dd>`:''}${m.volume?`<dt>${t('cat.volume')}</dt><dd class="num">${fmtNum(m.volume)}</dd>`:''}<dt>${t('cat.created')}</dt><dd>${fmtDate(m.createdAt)}</dd>${approved&&m.approvedAt?`<dt>${t('cat.approvedAt')}</dt><dd>${fmtDate(m.approvedAt)}</dd>`:''}</dl>`;
 const pkgCard=ui.card({title:t('cat.pkgCard'),body:`<div class="stack">${pkg}<hr class="sep">${dl}</div>`});
 // admin card
 const adminCard=S.admin?ui.card({title:`${t('cat.assignT')} ${ui.badge('OTA','violet')}`,body:`<form data-form="cat_approve" class="stack"><input type="hidden" name="id" value="${esc(m.id)}">${ui.note('admin',t('cat.adminNote'))}
  <div class="radio-cards" role="radiogroup" aria-label="${esc(t('cat.assignT'))}">${PLANS.map(p=>`<label class="rc cat_rc"><span class="row g8"><input type="radio" name="cat_plan" value="${p}" data-act="cat_planPick" ${approved&&m.plan===p?'checked':''}><b>${PLAN_NAME[p]}</b></span><span class="small muted">${t('cat.planExp.'+p)}</span></label>`).join('')}</div>
  ${PLANS.map(p=>`<div class="cat_usd" data-plan="${p}" ${approved&&m.plan===p?'':'hidden'}><b class="small">${t('cat.usdT',{p:PLAN_NAME[p]})}</b><p class="xs faint" style="margin:2px 0 8px">${t('cat.usdP')}</p><div class="cat_usdg">${TERMS.map(tm=>`<label class="field"><span class="small">${termLabel(tm)}</span><span class="prc_inw"><input class="inp num" name="cat_usd_${p}_${tm}" inputmode="decimal" value="${unitPrice({plan:p,term:tm},'USD')}"><span class="prc_unit">$</span></span></label>`).join('')}</div></div>`).join('')}
  <div class="row wrap g8">${ui.btn(approved?t('cat.saveApprove'):t('cat.approve'),{kind:'primary',icon:'check',type:'submit',disabled:!approved,id:'cat_apprBtn'})}${approved?ui.btn(t('cat.toReview'),{act:'cat_unapprove',arg:m.id}):''}</div></form>`}):'';
 // SIM card
 const simNotes=[];
 if(!m.imei.length)simNotes.push(ui.note('warn',t('cat.simNoImei')));
 if(!approved)simNotes.push(ui.note('info',t('cat.simNoPlan')));
 const simCard=ui.card({title:t('cat.simCard'),body:`<div class="stack"><div class="grid2 cat_simk"><div><span class="small muted">${t('cat.simActive')}</span><b class="num">${fmtNum(s.active)}</b></div><div><span class="small muted">${t('cat.simBlocked')}</span><b class="num">${fmtNum(s.blocked)}</b></div></div>${simNotes.join('')}<div>${ui.btn(t('cat.openSims'),{icon:'sim',act:'cat_sims',arg:m.id})}</div></div>`});
 // whitelist
 const last=m.uploads&&m.uploads[0];
 const lastTxt=m.imeiUpdatedAt?t('cat.lastUp',{d:fmtDate(m.imeiUpdatedAt)})+(last?` · ${last.mode==='replace'?t('cat.upReplaced',{n:fmtNum(last.n)}):'+'+fmtNum(last.n)}${last.source?' · '+esc(last.source):''}`:''):t('cat.neverUp');
 const wlActs=m.imei.length?ui.btn(t('cat.export'),{size:'sm',icon:'download',act:'cat_export',arg:m.id})+ui.btn(t('cat.uploadImei'),{size:'sm',kind:'primary',icon:'upload',act:'cat_upOpen',arg:m.id}):'';
 const w=cat_wlState(m.id);
 const wlBody=m.imei.length?`<div class="bd cat_wlhead"><div class="col g4"><span class="cat_big num">${fmtNum(m.imei.length)}</span><span class="small muted">${t('cat.inList')} · ${lastTxt}</span></div>${ui.note('info',t('cat.wlExplain'))}</div>
  <div class="toolbar"><label class="cat_search">${icon('search','sm')}<span class="cat_vh">${t('cat.searchImei')}</span><input class="inp mono" id="cat_q" type="search" inputmode="numeric" autocomplete="off" placeholder="${esc(t('cat.searchPh'))}" value="${esc(w.q)}"></label></div>
  <div id="cat_wlbody" class="cat_wl">${cat_wlBody(m)}</div>`
  :ui.empty('upload',t('cat.wlEmptyT'),t('cat.wlEmptyP'),ui.btn(t('cat.uploadImei'),{kind:'primary',icon:'upload',act:'cat_upOpen',arg:m.id}));
 const wlCard=ui.card({title:t('cat.wlTitle'),actions:wlActs,pad:false,body:wlBody});
 return ui.page({title:esc(m.name),sub:`<span class="row wrap g8"><span class="mono">SKU ${esc(m.sku)}</span>${cat_planBadge(m)}</span>`,crumbs:[[t('cat.title'),'#catalog'],[b.name,link('brand',b.id)],[c.name]],actions,
  body:`<div class="stack"><div class="cat_mgrid"><div class="stack">${pkgCard}${adminCard}</div><div class="stack">${simCard}</div></div>${wlCard}</div>`});}});

/* ---------- whitelist table (partial redraw) ---------- */
function cat_wlState(id){let w=S.ui.cat_wl;if(!w||w.id!==id)w=S.ui.cat_wl={id,q:'',page:1};return w;}
function cat_simByImei(list){const set=new Set(list);const out=new Map();if(!set.size)return out;for(const s of S.sims){if(s.imei&&set.has(s.imei))out.set(s.imei,s);}return out;}
function cat_wlBody(m){const w=cat_wlState(m.id);const q=digits(w.q);
 let idx=null;if(q){idx=[];for(let i=0;i<m.imei.length;i++)if(m.imei[i].startsWith(q))idx.push(i);}
 const total=idx?idx.length:m.imei.length;const pages=Math.max(1,Math.ceil(total/CAT_PER));w.page=clamp(+w.page||1,1,pages);
 const from=(w.page-1)*CAT_PER;const slice=[];for(let k=from;k<Math.min(total,from+CAT_PER);k++)slice.push(idx?idx[k]:k);
 const sims=cat_simByImei(slice.map(i=>m.imei[i]));
 const rows=slice.map(i=>{const im=m.imei[i];const s=sims.get(im);
  return{cells:[`<span class="num faint">${fmtNum(i+1)}</span>`,`<span class="mono">${im}</span>`,
   s?(s.status==='active'?ui.badge(t('cat.simOn'),'ok',true):ui.badge(t('cat.simOff'),'bad',true))+` <span class="mono xs faint">${esc(s.iccid.slice(-6))}</span>`:'<span class="faint">—</span>',
   ui.iconbtn('trash',t('cat.rmImei',{imei:im}),{act:'cat_imeiDel',arg:im})]};});
 const head=q?`<div class="cat_qinfo small muted">${t('cat.qFound',{n:cat_n(total,'imei'),q:esc(q)})}</div>`:'';
 return head+ui.table([{label:'#'},{label:'IMEI'},{label:t('cat.cSim')},{label:'<span class="cat_vh">'+t('c.actions')+'</span>',cls:'r'}],rows,
  {empty:ui.empty('search',t('cat.wlNoMatch',{q:esc(q)}),t('cat.wlNoMatchP'))})+(total>CAT_PER?ui.pager(w.page,total,CAT_PER,'cat_page'):'');}
function cat_wlRedraw(){const w=S.ui.cat_wl;if(!w)return;const f=findModel(w.id);const el=$('#cat_wlbody');if(f&&el)el.innerHTML=cat_wlBody(f.model);save();}
document.addEventListener('input',e=>{const el=e.target;if(!el||!el.id)return;
 if(el.id.startsWith('cat_')&&el.getAttribute('aria-invalid')==='true'){el.removeAttribute('aria-invalid');const h=document.getElementById(el.id+'-h');if(h&&h.className==='err'){h.className='hint';h.textContent='';}}
 if(el.id==='cat_q'){clearTimeout(cat_qTimer);cat_qTimer=setTimeout(()=>{const w=S.ui.cat_wl;if(!w)return;w.q=el.value;w.page=1;cat_wlRedraw();},120);}
 else if(el.id==='cat_name'||el.id==='cat_dom'||el.id==='cat_color'){
  if(el.id==='cat_dom')cat_draft.domainTouched=true;
  if(el.id==='cat_name'&&!cat_draft.domainTouched){const d=$('#cat_dom');if(d)d.value=cat_domainFor(el.value);}
  if(el.id==='cat_color')cat_swSync(el.value);
  cat_brandPreview();}});

/* ---------- brand modal ---------- */
function cat_brandPreview(){const box=$('#cat_pvbox');if(!box)return;
 box.innerHTML=cat_portal({name:($('#cat_name')||{}).value,color:($('#cat_color')||{}).value,domain:($('#cat_dom')||{}).value,logo:cat_draft.logo});
 const lp=$('#cat_logoPrev');if(lp)lp.innerHTML=cat_mark({name:($('#cat_name')||{}).value||'?',color:($('#cat_color')||{}).value,logo:cat_draft.logo},48);
 const rm=$('#cat_logoRm');if(rm)rm.hidden=!cat_draft.logo;}
function cat_swSync(v){$$('.cat_sw').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.arg.toLowerCase()===String(v).toLowerCase())));const l=$('#cat_colv');if(l)l.textContent=String(v).toUpperCase();}
function cat_brandModal(b){cat_draft={logo:b?b.logo||null:null,domainTouched:!!b};
 const color=b?cat_color(b.color):CAT_PRESETS[0];
 const body=`<form id="cat_fb" data-form="cat_brand" class="stack" novalidate><input type="hidden" name="id" value="${b?esc(b.id):''}">
  ${ui.field({id:'cat_name',label:t('cat.fName'),value:b?b.name:'',placeholder:'GAZER',hint:t('cat.fNameH'),attrs:'maxlength="40" autocomplete="off" required'})}
  <div class="field"><span class="lbl" id="cat_colL">${t('cat.fColor')}</span><div class="row wrap g8"><input type="color" class="cat_col" id="cat_color" name="cat_color" value="${color}" aria-labelledby="cat_colL">
   ${CAT_PRESETS.map(p=>`<button type="button" class="cat_sw" style="background:${p}" data-act="cat_sw" data-arg="${p}" aria-label="${esc(t('cat.swatch',{c:p}))}" aria-pressed="${p.toLowerCase()===color.toLowerCase()}"></button>`).join('')}
   <span class="mono small muted" id="cat_colv">${color.toUpperCase()}</span></div></div>
  ${cat_vfield('cat_dom',t('cat.fDomain'),`<div class="cat_adorn"><span>https://</span><input class="inp mono" id="cat_dom" name="cat_dom" value="${esc(b?b.domain:'')}" placeholder="connect.brand.ua" autocomplete="off" spellcheck="false" aria-describedby="cat_dom-h"></div>`,t('cat.fDomainH'))}
  <div class="field"><span class="lbl">${t('cat.fLogo')} <span class="faint">(${t('c.optional')})</span></span>
   <div class="row wrap g12"><span id="cat_logoPrev"></span><label class="btn sm cat_filebtn">${icon('upload','sm')}<span>${t('cat.fLogoBtn')}</span><input type="file" class="cat_vh" id="cat_logo" accept="image/png,image/jpeg,image/svg+xml,image/webp" data-act="cat_logo" aria-describedby="cat_logo-h"></label>
   <button type="button" class="btn sm ghost" id="cat_logoRm" data-act="cat_logoRm" hidden>${t('cat.fLogoRm')}</button></div>
   <span class="hint" id="cat_logo-h">${t('cat.fLogoH')}</span></div>
  <div class="field"><span class="lbl">${t('cat.pvCard')}</span><div id="cat_pvbox"></div></div></form>`;
 const foot=(b?`<span class="grow">${ui.btn(t('cat.delBrand'),{kind:'danger',icon:'trash',act:'cat_brandDel',arg:b.id})}</span>`:'')+ui.btn(t('c.cancel'),{act:'ovclose'})+`<button type="submit" form="cat_fb" class="btn primary">${b?t('c.save'):t('cat.createBrand')}</button>`;
 modal(b?t('cat.editBrandT'):t('cat.newBrandT'),body,foot);cat_brandPreview();}
Object.assign(ACT,{
 cat_brandNew(){cat_brandModal(null);},
 cat_brandEdit(id){const b=findBrand(id);if(b)cat_brandModal(b);},
 cat_sw(c){const i=$('#cat_color');if(i)i.value=c;cat_swSync(c);cat_brandPreview();},
 cat_logo(v,el){const f=el.files&&el.files[0];const h=$('#cat_logo-h');if(!f)return;
  const bad=msg=>{if(h){h.className='err';h.textContent=msg;}el.value='';};
  if(!/^image\/(png|jpeg|svg\+xml|webp)$/.test(f.type))return bad(t('cat.eLogoType'));
  if(f.size>CAT_LOGO_MAX)return bad(t('cat.eLogoSize',{kb:fmtNum(Math.ceil(f.size/1024))}));
  const r=new FileReader();r.onload=()=>{cat_draft.logo=String(r.result);if(h){h.className='hint';h.textContent=t('cat.logoOk',{name:f.name,kb:fmtNum(Math.ceil(f.size/1024))});}cat_brandPreview();};
  r.onerror=()=>bad(t('cat.eLogoRead'));r.readAsDataURL(f);},
 cat_logoRm(){cat_draft.logo=null;const i=$('#cat_logo');if(i)i.value='';const h=$('#cat_logo-h');if(h){h.className='hint';h.textContent=t('cat.fLogoH');}cat_brandPreview();},
 cat_brandDel(id){const b=findBrand(id);if(!b)return;const st=cat_brandStats(b,{});
  if(st.models)return modal(t('cat.delBrandT',{name:esc(b.name)}),ui.note('warn',t('cat.delBrandNo',{n:cat_n(st.models,'model')})),ui.btn(t('cat.gotIt'),{kind:'primary',act:'ovclose'}));
  modal(t('cat.delBrandT',{name:esc(b.name)}),`<p>${t('cat.delBrandQ',{name:esc(b.name)})}</p>`,ui.btn(t('c.cancel'),{act:'ovclose'})+ui.btn(t('cat.delBrand'),{kind:'danger',icon:'trash',act:'cat_brandDelOk',arg:b.id}));},
 cat_brandDelOk(id){const b=findBrand(id);if(!b)return;S.brands=S.brands.filter(x=>x.id!==id);log(t('cat.logBrandDel',{name:b.name}));closeOverlay();toast(t('cat.tBrandDel',{name:esc(b.name)}));go('catalog');},
});
FORM.cat_brand=f=>{clearErrs(f);const d=formData(f);const name=(d.cat_name||'').trim().replace(/\s+/g,' ');
 const dom=(d.cat_dom||'').trim().toLowerCase().replace(/^https?:\/\//,'').replace(/\/+$/,'');let ok=true;
 const other=S.brands.filter(x=>x.id!==d.id);
 if(!name){setErr(f,'cat_name',t('cat.eName'));ok=false;}
 else if(other.some(x=>x.name.trim().toLowerCase()===name.toLowerCase())){setErr(f,'cat_name',t('cat.eNameDup',{name:esc(name)}));ok=false;}
 if(!dom){setErr(f,'cat_dom',t('cat.eDom'));ok=false;}
 else if(!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(dom)||dom.length>80){setErr(f,'cat_dom',t('cat.eDomFmt'));ok=false;}
 else{const o=other.find(x=>(x.domain||'').toLowerCase()===dom);if(o){setErr(f,'cat_dom',t('cat.eDomDup',{name:esc(o.name)}));ok=false;}}
 if(!ok){const e=f.querySelector('[aria-invalid="true"]');if(e)e.focus();return;}
 const color=cat_color(d.cat_color);
 if(d.id){const b=findBrand(d.id);if(!b)return;Object.assign(b,{name,color,domain:dom,logo:cat_draft.logo});log(t('cat.logBrandEd',{name}));closeOverlay();toast(t('cat.tBrandSaved',{name:esc(name)}));rerender();}
 else{const b={id:uid('b'),name,color,domain:dom,logo:cat_draft.logo,createdAt:iso(now()),categories:[]};S.brands.push(b);log(t('cat.logBrandNew',{name}));closeOverlay();toast(t('cat.tBrandNew',{name:esc(name)}));go('brand',b.id);}};

/* ---------- categories ---------- */
function cat_catModal(b,c){const body=`<form id="cat_fc" data-form="cat_cat" class="stack" novalidate><input type="hidden" name="bid" value="${esc(b.id)}"><input type="hidden" name="cid" value="${c?esc(c.id):''}">
 ${ui.field({id:'cat_cname',label:t('cat.fCat'),value:c?c.name:'',placeholder:t('cat.fCatPh'),hint:t('cat.fCatH'),attrs:'maxlength="60" autocomplete="off"'})}</form>`;
 modal(c?t('cat.renameCat'):t('cat.newCatT',{brand:esc(b.name)}),body,ui.btn(t('c.cancel'),{act:'ovclose'})+`<button type="submit" form="cat_fc" class="btn primary">${c?t('c.save'):t('c.create')}</button>`);}
function cat_bc(arg){const [bid,cid]=String(arg).split('|');const b=findBrand(bid);return{b,c:b&&cid?b.categories.find(x=>x.id===cid):null};}
Object.assign(ACT,{
 cat_catNew(bid){const b=findBrand(bid);if(b)cat_catModal(b,null);},
 cat_catEdit(arg){const {b,c}=cat_bc(arg);if(c)cat_catModal(b,c);},
 cat_catDel(arg){const {b,c}=cat_bc(arg);if(!c)return;
  if(c.models.length)return modal(t('cat.delCatT',{name:esc(c.name)}),ui.note('warn',t('cat.delCatNo',{n:cat_n(c.models.length,'model')})),ui.btn(t('cat.gotIt'),{kind:'primary',act:'ovclose'}));
  modal(t('cat.delCatT',{name:esc(c.name)}),`<p>${t('cat.delCatQ',{name:esc(c.name)})}</p>`,ui.btn(t('c.cancel'),{act:'ovclose'})+ui.btn(t('c.delete'),{kind:'danger',icon:'trash',act:'cat_catDelOk',arg}));},
 cat_catDelOk(arg){const {b,c}=cat_bc(arg);if(!c)return;b.categories=b.categories.filter(x=>x!==c);log(t('cat.logCatDel',{name:c.name,brand:b.name}));closeOverlay();toast(t('cat.tCatDel',{name:esc(c.name)}));rerender();},
});
FORM.cat_cat=f=>{clearErrs(f);const d=formData(f);const b=findBrand(d.bid);if(!b)return;const name=(d.cat_cname||'').trim().replace(/\s+/g,' ');
 if(!name)return setErr(f,'cat_cname',t('cat.eCat'));
 if(b.categories.some(x=>x.id!==d.cid&&x.name.toLowerCase()===name.toLowerCase()))return setErr(f,'cat_cname',t('cat.eCatDup',{name:esc(name)}));
 if(d.cid){const c=b.categories.find(x=>x.id===d.cid);if(c){c.name=name;toast(t('cat.tCatRen',{name:esc(name)}));}}
 else{b.categories.push({id:uid('c'),name,models:[]});log(t('cat.logCatNew',{name,brand:b.name}));toast(t('cat.tCatNew',{name:esc(name)}));}
 closeOverlay();rerender();};

/* ---------- models ---------- */
function cat_modelModal(b,m,catId){const opts=b.categories.map(c=>[c.id,c.name]).concat([['__new',t('cat.fNewCatOpt')]]);
 const sel=catId||(b.categories[0]?b.categories[0].id:'__new');
 const body=`<form id="cat_fm" data-form="cat_model" class="stack" novalidate><input type="hidden" name="bid" value="${esc(b.id)}"><input type="hidden" name="mid" value="${m?esc(m.id):''}">
  <div class="grid2">${ui.field({id:'cat_mname',label:t('cat.fModel'),value:m?m.name:'',placeholder:'GAZER HX-5',attrs:'maxlength="60" autocomplete="off"'})}
  ${ui.field({id:'cat_msku',label:'SKU',value:m?m.sku:'',placeholder:'HX5-48',mono:true,hint:t('cat.fSkuH'),attrs:'maxlength="40" autocomplete="off" spellcheck="false"'})}</div>
  ${ui.field({id:'cat_mcat',label:t('cat.category'),type:'select',options:opts,value:sel,attrs:'data-act="cat_catSel"'})}
  <div id="cat_newcatw" ${sel==='__new'?'':'hidden'}>${ui.field({id:'cat_mnewcat',label:t('cat.fCat'),placeholder:t('cat.fCatPh'),attrs:'maxlength="60" autocomplete="off"'})}</div>
  ${ui.field({id:'cat_mdesc',label:`${t('cat.desc')} <span class="faint">(${t('c.optional')})</span>`,type:'textarea',rows:2,value:m?m.desc||'':'',placeholder:t('cat.fDescPh'),attrs:'maxlength="200" style="font-family:var(--f);font-size:14px;min-height:64px"'})}
  ${ui.field({id:'cat_mvol',label:`${t('cat.volume')} <span class="faint">(${t('c.optional')})</span>`,type:'number',value:m&&m.volume?m.volume:'',placeholder:'1000',hint:t('cat.fVolH'),attrs:'min="1" step="1" inputmode="numeric"'})}
  ${m?'':ui.note('info',t('cat.newModelNote'))}</form>`;
 const foot=(m?`<span class="grow">${ui.btn(t('cat.delModel'),{kind:'danger',icon:'trash',act:'cat_modelDel',arg:m.id})}</span>`:'')+ui.btn(t('c.cancel'),{act:'ovclose'})+`<button type="submit" form="cat_fm" class="btn primary">${m?t('c.save'):t('cat.createModel')}</button>`;
 modal(m?t('cat.editModelT'):t('cat.newModelT',{brand:esc(b.name)}),body,foot);}
Object.assign(ACT,{
 cat_modelNew(arg){const {b,c}=cat_bc(arg);if(b)cat_modelModal(b,null,c?c.id:null);},
 cat_modelEdit(id){const f=findModel(id);if(f)cat_modelModal(f.brand,f.model,f.cat.id);},
 cat_catSel(v){const w=$('#cat_newcatw');if(w){w.hidden=v!=='__new';if(v==='__new'){const i=$('#cat_mnewcat');if(i)i.focus();}}},
 cat_modelDel(id){const f=findModel(id);if(!f)return;const s=cat_simStats()[id]||{active:0};
  if(s.active)return modal(t('cat.delModelT',{name:esc(f.model.name)}),ui.note('warn',t('cat.delModelNo',{n:cat_n(s.active,'sim')})),ui.btn(t('cat.gotIt'),{kind:'primary',act:'ovclose'}));
  modal(t('cat.delModelT',{name:esc(f.model.name)}),`<p>${t('cat.delModelQ',{name:esc(f.model.name),n:cat_n(f.model.imei.length,'imei')})}</p>`,ui.btn(t('c.cancel'),{act:'ovclose'})+ui.btn(t('cat.delModel'),{kind:'danger',icon:'trash',act:'cat_modelDelOk',arg:id}));},
 cat_modelDelOk(id){const f=findModel(id);if(!f)return;f.cat.models=f.cat.models.filter(x=>x.id!==id);log(t('cat.logModelDel',{name:f.model.name}));closeOverlay();toast(t('cat.tModelDel',{name:esc(f.model.name)}));go('brand',f.brand.id);},
});
FORM.cat_model=f=>{clearErrs(f);const d=formData(f);const b=findBrand(d.bid);if(!b)return;
 const name=(d.cat_mname||'').trim().replace(/\s+/g,' ');const sku=(d.cat_msku||'').trim();const desc=(d.cat_mdesc||'').trim();const volRaw=String(d.cat_mvol||'').trim();
 const others=[];b.categories.forEach(c=>c.models.forEach(m=>{if(m.id!==d.mid)others.push(m);}));let ok=true;
 if(!name){setErr(f,'cat_mname',t('cat.eModel'));ok=false;}
 else if(others.some(m=>m.name.toLowerCase()===name.toLowerCase())){setErr(f,'cat_mname',t('cat.eModelDup',{name:esc(name),brand:esc(b.name)}));ok=false;}
 if(!sku){setErr(f,'cat_msku',t('cat.eSku'));ok=false;}
 else if(!/^[A-Za-z0-9._\/-]+$/.test(sku)){setErr(f,'cat_msku',t('cat.eSkuFmt'));ok=false;}
 else{const o=others.find(m=>(m.sku||'').toLowerCase()===sku.toLowerCase());if(o){setErr(f,'cat_msku',t('cat.eSkuDup',{sku:esc(sku),name:esc(o.name)}));ok=false;}}
 let newCat=null;
 if(d.cat_mcat==='__new'){newCat=(d.cat_mnewcat||'').trim().replace(/\s+/g,' ');
  if(!newCat){setErr(f,'cat_mnewcat',t('cat.eCat'));ok=false;}
  else if(b.categories.some(c=>c.name.toLowerCase()===newCat.toLowerCase())){setErr(f,'cat_mnewcat',t('cat.eCatDup',{name:esc(newCat)}));ok=false;}}
 let volume=null;if(volRaw){volume=Number(volRaw);if(!Number.isInteger(volume)||volume<1||volume>10000000){setErr(f,'cat_mvol',t('cat.eVol'));ok=false;}}
 if(!ok){const e=f.querySelector('[aria-invalid="true"]');if(e)e.focus();return;}
 let cat;if(newCat){cat={id:uid('c'),name:newCat,models:[]};b.categories.push(cat);log(t('cat.logCatNew',{name:newCat,brand:b.name}));}else cat=b.categories.find(c=>c.id===d.cat_mcat);
 if(!cat)return;
 if(d.mid){const fm=findModel(d.mid);if(!fm)return;const m=fm.model;Object.assign(m,{name,sku,desc,volume});
  if(fm.cat!==cat){fm.cat.models=fm.cat.models.filter(x=>x!==m);cat.models.push(m);}
  closeOverlay();toast(t('cat.tModelSaved',{name:esc(name)}));rerender();}
 else{const m={id:uid('m'),name,sku,plan:null,planStatus:'review',imei:[],createdAt:iso(now()),desc,volume,uploads:[]};cat.models.push(m);
  log(t('cat.logModelNew',{name,brand:b.name}));closeOverlay();toast(t('cat.tModelNew',{name:esc(name)}));go('model',m.id);}};

/* ---------- OTA approval ---------- */
FORM.cat_approve=f=>{const id=f.querySelector('[name=id]').value;const r=f.querySelector('input[name=cat_plan]:checked');const fm=findModel(id);if(!fm||!r)return;
 const m=fm.model;const plan=r.value;const usd=[];let bad=false;
 TERMS.forEach(tm=>{const el=f.querySelector(`[name="cat_usd_${plan}_${tm}"]`);if(!el)return;const v=parseFloat(String(el.value).replace(/[\s ]/g,'').replace(',','.'));
  if(!(v>0)||v>100000){el.setAttribute('aria-invalid','true');bad=true;}else usd.push([tm,Math.round(v*100)/100]);});
 if(bad){toast(t('prc.err.fix'),'bad');return;}
 const was=m.planStatus==='approved'?m.plan:null;m.plan=plan;m.planStatus='approved';m.approvedAt=iso(now());
 let n=0;usd.forEach(([tm,v])=>{if(Math.abs(v-unitPrice({plan,term:tm},'USD'))>0.004&&setPrice({plan,term:tm},'USD',v,'approve'))n++;});
 log(t(was&&was!==m.plan?'cat.logPlanChg':'cat.logApproved',{name:m.name,plan:PLAN_NAME[m.plan],was:was?PLAN_NAME[was]:''})+(n?' · '+t('cat.usdLog',{n}):''));
 toast(t('cat.tApproved',{name:esc(m.name),plan:PLAN_NAME[m.plan]}));rerender();};
ACT.cat_planPick=v=>{$$('.cat_usd').forEach(d=>{d.hidden=d.dataset.plan!==v;});const b=$('#cat_apprBtn');if(b)b.disabled=false;};
ACT.cat_unapprove=id=>{const fm=findModel(id);if(!fm)return;const m=fm.model;m.planStatus='review';m.plan=null;m.approvedAt=null;log(t('cat.logReview',{name:m.name}));toast(t('cat.tReview',{name:esc(m.name)}));rerender();};
ACT.cat_sims=id=>{S.ui.sim_filterModel=id;go('sims');};

/* ---------- IMEI upload ---------- */
function cat_otherIndex(exceptId){const mp=new Map();allModels().forEach(x=>{if(x.model.id===exceptId)return;for(const im of x.model.imei)mp.set(im,x.model.id);});return mp;}
function cat_parse(text,model){
 const res={found:0,invalid:[],dups:0,already:0,conflicts:{},conflictN:0,ignored:0,add:[],keep:[],validN:0};
 const own=new Set(model.imei);const other=cat_otherIndex(model.id);const seen=new Set();
 const lines=String(text).split(/\r\n|\n|\r/);
 for(let li=0;li<lines.length;li++){const toks=lines[li].split(/[\s,;|]+/);
  for(const tok of toks){const c=tok.replace(/["'\-.]/g,'');if(!c)continue;
   const cands=/^\d+$/.test(c)?[c]:(c.match(/\d+/g)||[]);
   if(!cands.length){res.ignored++;continue;}
   for(const d of cands){const L=d.length;
    if(L<13||L>17){res.ignored++;continue;}
    res.found++;
    if(L!==15){res.invalid.push({line:li+1,v:d,why:'len',L});continue;}
    if(seen.has(d)){res.dups++;continue;}
    seen.add(d);
    if(!validImei(d)){res.invalid.push({line:li+1,v:d,why:'check'});continue;}
    res.validN++;
    const om=other.get(d);
    if(om){res.conflictN++;(res.conflicts[om]=res.conflicts[om]||[]).push(d);continue;}
    res.keep.push(d);
    if(own.has(d))res.already++;else res.add.push(d);}}}
 return res;}
function cat_upStep1(){const fm=findModel(cat_up.modelId);if(!fm)return;
 const body=`<p class="muted small">${t('cat.upIntro',{name:esc(fm.model.name)})}</p>
  <label class="cat_drop">${icon('upload','lg')}<b>${t('cat.upFile')}</b><span class="small muted">${t('cat.upFileH')}</span><input type="file" class="cat_vh" id="cat_upf" accept=".csv,.txt,text/csv,text/plain" data-act="cat_upFile"></label>
  <div id="cat_upfile">${cat_upFileChip()}</div>
  ${ui.field({id:'cat_paste',label:t('cat.upPaste'),type:'textarea',rows:7,value:cat_up.paste,placeholder:'358673101000013\n358673101000021, 358673101000039',hint:t('cat.upPasteH'),attrs:'spellcheck="false"'})}
  ${S.admin?ui.note('admin',`<div class="row wrap between g8"><span>${t('cat.genNote')}</span>${ui.btn(t('cat.gen'),{size:'sm',icon:'spark',act:'cat_gen'})}</div>`):''}`;
 modal(t('cat.upTitle',{name:esc(fm.model.name)}),body,ui.btn(t('c.cancel'),{act:'ovclose'})+ui.btn(t('cat.check'),{kind:'primary',icon:'check',act:'cat_upCheck'}),{wide:true});}
function cat_upFileChip(){if(!cat_up.fileName)return '';const lines=cat_up.fileText.split(/\r\n|\n|\r/).filter(x=>x.trim()).length;
 return `<div class="cat_chip">${icon('file','sm')}<span class="grow"><b>${esc(cat_up.fileName)}</b> <span class="muted small">· ${cat_n(lines,'line')}</span></span>${ui.iconbtn('x',t('cat.upFileRm'),{act:'cat_upFileRm'})}</div>`;}
function cat_upPreview(){const fm=findModel(cat_up.modelId);const r=cat_up.res;if(!fm||!r)return;const m=fm.model;
 const v=(n,l,tone)=>`<div class="cat_v ${n&&tone?tone:''}"><b>${fmtNum(n)}</b><span>${l}</span></div>`;
 let body=`<div class="cat_vgrid">${v(r.found,t('cat.vFound'))}${v(r.add.length,t('cat.vNew'),'ok')}${v(r.invalid.length,t('cat.vInvalid'),'bad')}${v(r.dups,t('cat.vDups'),'warn')}${v(r.already,t('cat.vAlready'))}${v(r.conflictN,t('cat.vConflict'),'warn')}</div>`;
 if(r.ignored)body+=`<p class="xs faint">${t('cat.vIgnored',{n:fmtNum(r.ignored)})}</p>`;
 if(!r.invalid.length&&!r.conflictN&&!r.dups)body+=ui.note('ok',t('cat.vAllOk'));
 if(r.invalid.length){body+=`<div class="stack" style="gap:8px"><h3 class="cat_h3">${t('cat.vInvT')}</h3>`+ui.table([{label:t('cat.cLine')},{label:t('cat.cValue')},{label:t('cat.cReason')}],
  r.invalid.slice(0,20).map(x=>({cells:[`<span class="num">${fmtNum(x.line)}</span>`,`<span class="mono">${esc(x.v)}</span>`,x.why==='len'?t('cat.whyLen',{n:x.L}):t('cat.whyCheck')]})))+
  (r.invalid.length>20?`<p class="xs faint">${t('cat.vMore',{n:fmtNum(r.invalid.length-20)})}</p>`:'')+'</div>';}
 if(r.conflictN){const lis=Object.keys(r.conflicts).map(id=>{const o=findModel(id);const list=r.conflicts[id];
   return `<li><b>${o?esc(o.model.name):'—'}</b>${o?` <span class="faint">(${esc(o.brand.name)})</span>`:''} — ${cat_n(list.length,'imei')} <span class="mono xs">${list.slice(0,3).join(', ')}${list.length>3?'…':''}</span></li>`;}).join('');
  body+=ui.note('warn',`<b>${t('cat.vConfT')}</b><br>${t('cat.vConfP')}<ul class="cat_ul">${lis}</ul>`);}
 if(!r.add.length&&r.keep.length)body+=ui.note('info',t('cat.vNothingNew'));
 const foot=`<span class="grow">${ui.btn(t('c.back'),{kind:'ghost',icon:'left',act:'cat_upBack'})}</span>`+ui.btn(t('cat.replace'),{act:'cat_upReplaceAsk',disabled:!r.keep.length})+ui.btn(r.add.length?t('cat.addN',{n:cat_n(r.add.length,'validImei',true)}):t('cat.addNone'),{kind:'primary',icon:'plus',act:'cat_upAdd',disabled:!r.add.length});
 modal(t('cat.vTitle',{name:esc(m.name)}),body,foot,{wide:true});}
function cat_record(m,mode,n){m.imeiUpdatedAt=iso(now());m.uploads=m.uploads||[];m.uploads.unshift({ts:m.imeiUpdatedAt,mode,n,source:cat_up.fileName||t('cat.srcPaste')});m.uploads=m.uploads.slice(0,10);}
Object.assign(ACT,{
 cat_upOpen(id){cat_up={modelId:id,fileText:'',fileName:'',paste:'',res:null};cat_upStep1();},
 cat_upFile(v,el){const f=el.files&&el.files[0];if(!f)return;
  const box=$('#cat_upfile');
  if(f.size>CAT_FILE_MAX){if(box)box.innerHTML=ui.note('bad',t('cat.eFileSize',{mb:fmtNum(f.size/1048576,1)}));el.value='';return;}
  if(!/\.(csv|txt)$/i.test(f.name)&&!/^text\//.test(f.type)){if(box)box.innerHTML=ui.note('bad',t('cat.eFileType'));el.value='';return;}
  const r=new FileReader();r.onload=()=>{cat_up.fileText=String(r.result||'');cat_up.fileName=f.name;if(box)box.innerHTML=cat_upFileChip();};
  r.onerror=()=>{if(box)box.innerHTML=ui.note('bad',t('cat.eFileRead'));};r.readAsText(f);},
 cat_upFileRm(){cat_up.fileText='';cat_up.fileName='';const i=$('#cat_upf');if(i)i.value='';const box=$('#cat_upfile');if(box)box.innerHTML='';},
 cat_gen(){const ta=$('#cat_paste');if(!ta)return;const tac=String(10000000+Math.floor(Math.random()*90000000));const start=Math.floor(Math.random()*899000);
  const list=[];for(let i=0;i<100;i++)list.push(genImei(tac,start+i));ta.value=(ta.value.trim()?ta.value.trim()+'\n':'')+list.join('\n');toast(t('cat.tGen',{tac}));},
 cat_upCheck(){const fm=findModel(cat_up.modelId);if(!fm)return;const ta=$('#cat_paste');cat_up.paste=ta?ta.value:'';
  const text=(cat_up.fileText||'')+'\n'+cat_up.paste;const f=$('#overlay .mb');
  const err=msg=>{if(ta){ta.setAttribute('aria-invalid','true');const h=$('#cat_paste-h');if(h){h.className='err';h.textContent=msg;}ta.focus();}};
  if(!text.trim())return err(t('cat.eEmpty'));
  const r=cat_parse(text,fm.model);
  if(!r.found)return err(t('cat.eNoImei'));
  cat_up.res=r;cat_upPreview();},
 cat_upBack(){cat_upStep1();},
 cat_upAdd(){const fm=findModel(cat_up.modelId);const r=cat_up.res;if(!fm||!r||!r.add.length)return;const m=fm.model;
  // re-check against current state (another model could have changed meanwhile)
  const own=new Set(m.imei);let n=0;for(const im of r.add){if(!own.has(im)){m.imei.push(im);n++;}}
  cat_record(m,'add',n);log(t('cat.logAdd',{n:fmtNum(n),name:m.name}));closeOverlay();
  toast(t('cat.tAdd',{n:cat_n(n,'imei',true),name:esc(m.name)}));rerender();},
 cat_upReplaceAsk(){const fm=findModel(cat_up.modelId);const r=cat_up.res;if(!fm||!r)return;const m=fm.model;
  const keep=new Set(r.keep);const removed=m.imei.filter(x=>!keep.has(x));
  const sims=cat_simByImei(removed);let act=0;sims.forEach(s=>{if(s.status==='active')act++;});
  const body=`<p>${t('cat.repQ',{name:esc(m.name)})}</p><dl class="dl small"><dt>${t('cat.repNow')}</dt><dd class="num">${fmtNum(m.imei.length)}</dd><dt>${t('cat.repNew')}</dt><dd class="num">${fmtNum(r.keep.length)}</dd><dt>${t('cat.repRm')}</dt><dd class="num">${fmtNum(removed.length)}</dd></dl>
   ${removed.length?ui.note('warn',t('cat.repWarn')+(act?'<br><b>'+t('cat.repAct',{n:cat_n(act,'sim')})+'</b>':'')):''}`;
  modal(t('cat.repT'),body,`<span class="grow">${ui.btn(t('c.back'),{kind:'ghost',icon:'left',act:'cat_upPrev'})}</span>`+ui.btn(t('cat.repOk',{n:fmtNum(r.keep.length)}),{kind:'danger',act:'cat_upReplace'}));},
 cat_upPrev(){cat_upPreview();},
 cat_upReplace(){const fm=findModel(cat_up.modelId);const r=cat_up.res;if(!fm||!r)return;const m=fm.model;m.imei=r.keep.slice();
  cat_record(m,'replace',m.imei.length);if(S.ui.cat_wl&&S.ui.cat_wl.id===m.id){S.ui.cat_wl.q='';S.ui.cat_wl.page=1;}
  log(t('cat.logRep',{n:fmtNum(m.imei.length),name:m.name}));closeOverlay();toast(t('cat.tRep',{n:cat_n(m.imei.length,'imei',true),name:esc(m.name)}));rerender();},
 cat_page(p){const w=S.ui.cat_wl;if(!w)return;w.page=+p||1;cat_wlRedraw();const el=$('#cat_wlbody');if(el){const top=el.getBoundingClientRect().top;if(top<70)window.scrollBy(0,top-120);}},
 cat_imeiDel(im){const w=S.ui.cat_wl;const fm=w&&findModel(w.id);if(!fm)return;const m=fm.model;
  const s=cat_simByImei([im]).get(im);
  if(s&&s.status==='active')return modal(t('cat.rmT'),ui.note('warn',t('cat.rmActive',{imei:im,iccid:fmtIccid(s.iccid)})),ui.btn(t('c.cancel'),{act:'ovclose'})+ui.btn(t('cat.rmOk'),{kind:'danger',icon:'trash',act:'cat_imeiDelOk',arg:im}));
  ACT.cat_imeiDelOk(im);},
 cat_imeiDelOk(im){const w=S.ui.cat_wl;const fm=w&&findModel(w.id);if(!fm)return;const m=fm.model;const i=m.imei.indexOf(im);if(i<0)return;
  m.imei.splice(i,1);m.imeiUpdatedAt=iso(now());log(t('cat.logRm',{imei:im,name:m.name}));closeOverlay();toast(t('cat.tRm',{imei:im}));rerender();},
 cat_export(id){const fm=findModel(id);if(!fm)return;const m=fm.model;const txt=m.imei.join('\n');let href='';
  try{href=URL.createObjectURL(new Blob([txt+'\n'],{type:'text/plain'}));}catch(e){}
  const fname=(cat_slug(m.name)||'model')+'-imei.txt';
  modal(t('cat.expT',{name:esc(m.name)}),`<p class="small muted">${t('cat.expP',{n:cat_n(m.imei.length,'imei')})}</p>${ui.field({id:'cat_exp',label:t('cat.expL'),type:'textarea',rows:12,value:txt,attrs:'readonly'})}`,
   (href?`<a class="btn" href="${href}" download="${esc(fname)}">${icon('download','sm')}<span>${t('cat.expDl')}</span></a>`:'')+ui.btn(t('cat.expCopy'),{kind:'primary',icon:'copy',act:'cat_expCopy'}),{wide:true});},
 cat_expCopy(){const ta=$('#cat_exp');if(!ta)return;ta.select();copyText(ta.value);},
});

/* ---------- demo seed extras ---------- */
HOOKS.seedDemo.push(()=>{const src={m1:'hx5_batch_01.csv',m2:'hx8_batch_01.csv',m3:'tt2_imei.csv',m5:'guard_a4.txt'};
 allModels().forEach(({model:m})=>{if(m.imei.length&&!m.imeiUpdatedAt){const d=new Date(new Date(m.createdAt).getTime()+864e5);m.imeiUpdatedAt=iso(d);m.uploads=[{ts:m.imeiUpdatedAt,mode:'add',n:m.imei.length,source:src[m.id]||''}];}
  if(m.planStatus==='approved'&&!m.approvedAt)m.approvedAt=iso(new Date(new Date(m.createdAt).getTime()+864e5));});});

/* ---------- strings ---------- */
(function(){const R=[
['nav','Бренди та пристрої','Brands & devices','Бренды и устройства'],
['sec','Продукти','Products','Продукты'],
['title','Бренди та пристрої','Brands & devices','Бренды и устройства'],
['sub','Бренди, категорії та моделі пристроїв, у яких працюватимуть ваші SIM-карти.','Brands, categories and device models your SIM cards will work in.','Бренды, категории и модели устройств, в которых будут работать ваши SIM-карты.'],
['subN','{b} · {m}. Відкрийте бренд, щоб керувати категоріями, моделями та списками IMEI.','{b} · {m}. Open a brand to manage categories, models and IMEI lists.','{b} · {m}. Откройте бренд, чтобы управлять категориями, моделями и списками IMEI.'],
['newBrand','Новий бренд','New brand','Новый бренд'],
['createBrand','Створити бренд','Create brand','Создать бренд'],
['emptyT','Створіть перший бренд','Create your first brand','Создайте первый бренд'],
['emptyP','Бренд — це назва, яку бачить кінцевий клієнт: наприклад, «GAZER CONNECT» на порталі connect.gazer.ua, де він активує пристрій. Далі додайте категорії, моделі та списки IMEI.','A brand is the name your end customer sees — for example “GAZER CONNECT” on connect.gazer.ua, where they activate their device. Then add categories, models and IMEI lists.','Бренд — это название, которое видит конечный клиент: например, «GAZER CONNECT» на портале connect.gazer.ua, где он активирует устройство. Затем добавьте категории, модели и списки IMEI.'],
['step1','Бренд','Brand','Бренд'],['step1p','Назва та колір, які бачить клієнт','Name and color your customer sees','Название и цвет, которые видит клиент'],
['step2','Категорії','Categories','Категории'],['step2p','Групи моделей: інвертори, трекери…','Groups of models: inverters, trackers…','Группы моделей: инверторы, трекеры…'],
['step3','Моделі','Models','Модели'],['step3p','OTA призначає пакет Light або Standard','OTA assigns a Light or Standard package','OTA назначает пакет Light или Standard'],
['step4','Список IMEI','IMEI list','Список IMEI'],['step4p','SIM працює лише в пристроях зі списку','SIMs work only in devices on the list','SIM работает только в устройствах из списка'],
['noModels','Немає моделей','No models yet','Нет моделей'],
['chipReview','{n} на перевірці','{n} under review','{n} на проверке'],
['chipNoImei','{n} без списку IMEI','{n} without IMEI list','{n} без списка IMEI'],
['chipReady','Усе готово','All set','Всё готово'],
['kCats','Категорії','Categories','Категории'],['kModels','Моделі','Models','Модели'],['kImei','IMEI у списках','IMEIs listed','IMEI в списках'],['kActive','Активні SIM','Active SIMs','Активные SIM'],
['attnNoImei','Без списку IMEI: {n}. SIM-карти в таких пристроях не вийдуть у мережу — завантажте списки.','Without an IMEI list: {n}. SIM cards in these devices won’t go online — upload the lists.','Без списка IMEI: {n}. SIM-карты в таких устройствах не выйдут в сеть — загрузите списки.'],
['attnReview','На перевірці: {n}. OTA призначить пакет Light або Standard протягом 1 робочого дня.','Under review: {n}. OTA will assign a Light or Standard package within 1 business day.','На проверке: {n}. OTA назначит пакет Light или Standard в течение 1 рабочего дня.'],
['n.model.one','модель','model','модель'],['n.model.few','моделі','models','модели'],['n.model.many','моделей','models','моделей'],['n.model.other','моделі','models','модели'],
['n.brand.one','бренд','brand','бренд'],['n.brand.few','бренди','brands','бренда'],['n.brand.many','брендів','brands','брендов'],['n.brand.other','бренду','brands','бренда'],
['n.imei.one','IMEI','IMEI','IMEI'],['n.imei.few','IMEI','IMEIs','IMEI'],['n.imei.many','IMEI','IMEIs','IMEI'],['n.imei.other','IMEI','IMEIs','IMEI'],
['n.validImei.one','коректний IMEI','valid IMEI','корректный IMEI'],['n.validImei.few','коректні IMEI','valid IMEIs','корректных IMEI'],['n.validImei.many','коректних IMEI','valid IMEIs','корректных IMEI'],['n.validImei.other','коректного IMEI','valid IMEIs','корректного IMEI'],
['n.sim.one','активна SIM-карта','active SIM card','активная SIM-карта'],['n.sim.few','активні SIM-карти','active SIM cards','активные SIM-карты'],['n.sim.many','активних SIM-карт','active SIM cards','активных SIM-карт'],['n.sim.other','активної SIM-карти','active SIM cards','активной SIM-карты'],
['n.line.one','рядок','line','строка'],['n.line.few','рядки','lines','строки'],['n.line.many','рядків','lines','строк'],['n.line.other','рядка','lines','строки'],
['nf','Не знайдено','Not found','Не найдено'],['nfP','Можливо, цей запис видалено або посилання застаріло.','This item may have been deleted, or the link is out of date.','Возможно, запись удалена или ссылка устарела.'],['toCatalog','До брендів','Back to brands','К брендам'],
['edit','Змінити бренд','Edit brand','Изменить бренд'],['newCat','Нова категорія','New category','Новая категория'],['newModel','Нова модель','New model','Новая модель'],['model','Модель','Model','Модель'],
['copyDomain','Скопіювати адресу порталу','Copy portal address','Скопировать адрес портала'],
['noCatsT','Додайте першу категорію','Add your first category','Добавьте первую категорию'],
['noCatsP','Категорії групують моделі, наприклад «Гібридні інвертори» чи «GPS-трекери». Модель можна створити й одразу з новою категорією.','Categories group your models, e.g. “Hybrid inverters” or “GPS trackers”. You can also create a model together with a new category.','Категории группируют модели, например «Гибридные инверторы» или «GPS-трекеры». Модель можно создать сразу с новой категорией.'],
['renameCat','Перейменувати категорію','Rename category','Переименовать категорию'],['delCat','Видалити категорію','Delete category','Удалить категорию'],
['cModel','Модель','Model','Модель'],['cPkg','Пакет','Package','Пакет'],['noList','Немає списку','No list','Нет списка'],
['uploadImei','Завантажити IMEI','Upload IMEIs','Загрузить IMEI'],['editModel','Змінити модель','Edit model','Изменить модель'],
['catEmptyT','У категорії ще немає моделей','No models in this category yet','В категории ещё нет моделей'],
['catEmptyP','Додайте модель — OTA перевірить її та призначить пакет.','Add a model — OTA will check it and assign a package.','Добавьте модель — OTA проверит её и назначит пакет.'],
['pvCard','Попередній перегляд порталу','Customer portal preview','Предпросмотр портала'],
['pvNote','Так кінцеві клієнти бачитимуть {name} під час активації SIM-карти. Портал за цією адресою запрацює після запуску — ми налаштуємо його разом із вами.','This is how end customers will see {name} when activating a SIM card. The portal at this address goes live after launch — we’ll set it up with you.','Так конечные клиенты увидят {name} при активации SIM-карты. Портал по этому адресу заработает после запуска — мы настроим его вместе с вами.'],
['pvTitle','Активуйте пристрій','Activate your device','Активируйте устройство'],['pvText','Введіть код активації з картки в коробці.','Enter the activation code from the card in the box.','Введите код активации с карточки в коробке.'],['pvBtn','Активувати','Activate','Активировать'],['brandPh','Бренд','Brand','Бренд'],
['review','На перевірці','Under review','На проверке'],
['reviewNoteT','Перевіряємо пристрій','We’re checking this device','Проверяем устройство'],
['reviewNote','Ми перевіряємо цей пристрій, щоб призначити пакет (Light або Standard). Зазвичай це займає до 1 робочого дня. Список IMEI можна завантажити вже зараз.','We are checking this device to assign a package (Light or Standard). This usually takes up to 1 business day. You can upload the IMEI list already.','Мы проверяем это устройство, чтобы назначить пакет (Light или Standard). Обычно это занимает до 1 рабочего дня. Список IMEI можно загрузить уже сейчас.'],
['planExp.light','Для пристроїв, що надсилають короткі повідомлення та команди.','For devices that send short messages and commands.','Для устройств, которые отправляют короткие сообщения и команды.'],
['planExp.std','Для пристроїв, що надсилають телеметрію з даними.','For devices that send telemetry with data.','Для устройств, которые отправляют телеметрию с данными.'],
['indiv','інд. ціна','custom price','инд. цена'],['cTerm','Термін пакета','Package term','Срок пакета'],['cPrice','Ціна пакета','Package price','Цена пакета'],['cMonth','≈ за місяць','≈ per month','≈ в месяц'],
['priceNote','ціна одного пакета на один пристрій','price of one package for one device','цена одного пакета на одно устройство'],
['brand','Бренд','Brand','Бренд'],['category','Категорія','Category','Категория'],['desc','Короткий опис','Short description','Краткое описание'],['volume','Очікуваний обсяг на рік','Expected yearly volume','Ожидаемый объём в год'],['created','Створено','Created','Создано'],['approvedAt','Пакет призначено','Package assigned','Пакет назначен'],
['pkgCard','Пакет і деталі','Package & details','Пакет и детали'],
['assignT','Призначити пакет','Assign package','Назначить пакет'],
['adminNote','Дія команди OTA: після затвердження модель може отримувати коди активації цього пакета.','OTA team action: once approved, the model can receive activation codes for this package.','Действие команды OTA: после утверждения модель может получать коды активации этого пакета.'],
['approve','Затвердити','Approve','Утвердить'],['saveApprove','Зберегти пакет','Save package','Сохранить пакет'],['toReview','Повернути на перевірку','Return to review','Вернуть на проверку'],
['simCard','SIM-карти в цій моделі','SIM cards in this model','SIM-карты в этой модели'],['simActive','Активні','Active','Активные'],['simBlocked','Заблоковані','Blocked','Заблокированные'],
['simNoImei','Завантажте список IMEI — інакше SIM-карти в цих пристроях будуть заблоковані.','Upload the IMEI list — otherwise SIM cards in these devices will be blocked.','Загрузите список IMEI — иначе SIM-карты в этих устройствах будут заблокированы.'],
['simNoPlan','Поки пакет не призначено, SIM-карти в цій моделі не можна активувати.','Until a package is assigned, SIM cards in this model can’t be activated.','Пока пакет не назначен, SIM-карты в этой модели нельзя активировать.'],
['openSims','Відкрити в SIM-картах','Open in SIM cards','Открыть в SIM-картах'],
['wlTitle','Список дозволених IMEI','IMEI whitelist','Список разрешённых IMEI'],
['inList','IMEI у списку','IMEIs on the list','IMEI в списке'],['lastUp','оновлено {d}','updated {d}','обновлено {d}'],['upReplaced','список замінено ({n})','list replaced ({n})','список заменён ({n})'],['neverUp','ще не завантажувався','never uploaded','ещё не загружался'],
['wlExplain','SIM-карти виходять у мережу лише в пристроях із цього списку.','SIM cards go online only in devices from this list.','SIM-карты выходят в сеть только в устройствах из этого списка.'],
['export','Експорт','Export','Экспорт'],['searchImei','Пошук IMEI','Search IMEI','Поиск IMEI'],['searchPh','Пошук за початком IMEI','Search by IMEI prefix','Поиск по началу IMEI'],
['wlEmptyT','Завантажте список IMEI','Upload the IMEI list','Загрузите список IMEI'],
['wlEmptyP','SIM-карти виходять у мережу лише в пристроях із цього списку. Додайте IMEI файлом CSV/TXT або вставте списком.','SIM cards go online only in devices from this list. Add IMEIs as a CSV/TXT file or paste them.','SIM-карты выходят в сеть только в устройствах из этого списка. Добавьте IMEI файлом CSV/TXT или вставьте списком.'],
['cSim','SIM-карта','SIM card','SIM-карта'],['simOn','У мережі','Online','В сети'],['simOff','Заблокована','Blocked','Заблокирована'],
['rmImei','Видалити IMEI {imei}','Remove IMEI {imei}','Удалить IMEI {imei}'],
['qFound','Знайдено {n} за «{q}»','{n} found for “{q}”','Найдено {n} по «{q}»'],
['wlNoMatch','Немає IMEI, що починаються з «{q}»','No IMEIs start with “{q}”','Нет IMEI, начинающихся с «{q}»'],['wlNoMatchP','Перевірте цифри або очистьте пошук.','Check the digits or clear the search.','Проверьте цифры или очистите поиск.'],
['fName','Назва бренду','Brand name','Название бренда'],['fNameH','Так його бачитиме кінцевий клієнт, напр. GAZER → «GAZER CONNECT».','How the end customer will see it, e.g. GAZER → “GAZER CONNECT”.','Так его увидит конечный клиент, напр. GAZER → «GAZER CONNECT».'],
['fColor','Колір бренду','Brand color','Цвет бренда'],['swatch','Колір {c}','Color {c}','Цвет {c}'],
['fDomain','Адреса клієнтського порталу','Customer portal address','Адрес клиентского портала'],['fDomainH','Тут клієнти активують пристрої. Ми налаштуємо адресу після запуску.','Customers activate devices here. We’ll set the address up after launch.','Здесь клиенты активируют устройства. Мы настроим адрес после запуска.'],
['fLogo','Логотип','Logo','Логотип'],['fLogoBtn','Завантажити логотип','Upload logo','Загрузить логотип'],['fLogoRm','Прибрати','Remove','Убрать'],
['fLogoH','PNG, JPG, SVG або WebP до 200 КБ. Найкраще — квадратний.','PNG, JPG, SVG or WebP up to 200 KB. Square works best.','PNG, JPG, SVG или WebP до 200 КБ. Лучше всего — квадратный.'],
['logoOk','{name} · {kb} КБ','{name} · {kb} KB','{name} · {kb} КБ'],
['eLogoType','Потрібне зображення PNG, JPG, SVG або WebP.','Please choose a PNG, JPG, SVG or WebP image.','Нужно изображение PNG, JPG, SVG или WebP.'],
['eLogoSize','Файл займає {kb} КБ, а максимум — 200 КБ. Стисніть зображення або оберіть менше.','This file is {kb} KB; the limit is 200 KB. Compress the image or pick a smaller one.','Файл весит {kb} КБ, а максимум — 200 КБ. Сожмите изображение или выберите меньше.'],
['eLogoRead','Не вдалося прочитати файл. Спробуйте інший.','Couldn’t read the file. Try another one.','Не удалось прочитать файл. Попробуйте другой.'],
['delBrand','Видалити бренд','Delete brand','Удалить бренд'],['delBrandT','Видалити бренд «{name}»?','Delete brand “{name}”?','Удалить бренд «{name}»?'],
['delBrandNo','Бренд можна видалити, лише коли в ньому немає моделей. Зараз у ньому {n} — спершу видаліть їх.','A brand can be deleted only when it has no models. It has {n} — delete them first.','Бренд можно удалить, только когда в нём нет моделей. Сейчас в нём {n} — сначала удалите их.'],
['delBrandQ','Бренд «{name}» і його порожні категорії буде видалено. Цю дію не можна скасувати.','Brand “{name}” and its empty categories will be deleted. This can’t be undone.','Бренд «{name}» и его пустые категории будут удалены. Это действие нельзя отменить.'],
['gotIt','Зрозуміло','Got it','Понятно'],
['newBrandT','Новий бренд','New brand','Новый бренд'],['editBrandT','Змінити бренд','Edit brand','Изменить бренд'],
['eName','Вкажіть назву бренду.','Enter a brand name.','Укажите название бренда.'],['eNameDup','Бренд «{name}» уже є у вашому каталозі.','You already have a brand called “{name}”.','Бренд «{name}» уже есть в вашем каталоге.'],
['eDom','Вкажіть адресу порталу, напр. connect.gazer.ua.','Enter the portal address, e.g. connect.gazer.ua.','Укажите адрес портала, напр. connect.gazer.ua.'],
['eDomFmt','Адреса може містити латинські літери, цифри, дефіси й крапки — напр. connect.gazer.ua.','Use Latin letters, digits, hyphens and dots — e.g. connect.gazer.ua.','Адрес может содержать латинские буквы, цифры, дефисы и точки — напр. connect.gazer.ua.'],
['eDomDup','Цю адресу вже використовує бренд «{name}».','This address is already used by brand “{name}”.','Этот адрес уже использует бренд «{name}».'],
['logBrandNew','Створено бренд «{name}»','Brand “{name}” created','Создан бренд «{name}»'],['logBrandEd','Змінено бренд «{name}»','Brand “{name}” updated','Изменён бренд «{name}»'],['logBrandDel','Видалено бренд «{name}»','Brand “{name}” deleted','Удалён бренд «{name}»'],
['tBrandNew','Бренд «{name}» створено. Тепер додайте категорію та моделі.','Brand “{name}” created. Now add a category and models.','Бренд «{name}» создан. Теперь добавьте категорию и модели.'],['tBrandSaved','Бренд «{name}» збережено','Brand “{name}” saved','Бренд «{name}» сохранён'],['tBrandDel','Бренд «{name}» видалено','Brand “{name}” deleted','Бренд «{name}» удалён'],
['fCat','Назва категорії','Category name','Название категории'],['fCatPh','Гібридні інвертори','Hybrid inverters','Гибридные инверторы'],['fCatH','Наприклад: інвертори, GPS-трекери, сигналізації.','E.g. inverters, GPS trackers, alarms.','Например: инверторы, GPS-трекеры, сигнализации.'],
['newCatT','Нова категорія · {brand}','New category · {brand}','Новая категория · {brand}'],
['eCat','Вкажіть назву категорії.','Enter a category name.','Укажите название категории.'],['eCatDup','Категорія «{name}» уже є в цьому бренді.','This brand already has a category “{name}”.','Категория «{name}» уже есть в этом бренде.'],
['delCatT','Видалити категорію «{name}»?','Delete category “{name}”?','Удалить категорию «{name}»?'],
['delCatNo','Видалити можна лише порожню категорію. Зараз у ній {n} — перенесіть їх в іншу категорію (Змінити модель) або видаліть.','Only an empty category can be deleted. It has {n} — move them to another category (Edit model) or delete them.','Удалить можно только пустую категорию. Сейчас в ней {n} — перенесите их в другую категорию (Изменить модель) или удалите.'],
['delCatQ','Категорію «{name}» буде видалено.','Category “{name}” will be deleted.','Категория «{name}» будет удалена.'],
['logCatNew','Створено категорію «{name}» у бренді {brand}','Category “{name}” created in {brand}','Создана категория «{name}» в бренде {brand}'],['logCatDel','Видалено категорію «{name}» з бренду {brand}','Category “{name}” deleted from {brand}','Удалена категория «{name}» из бренда {brand}'],
['tCatNew','Категорію «{name}» створено','Category “{name}” created','Категория «{name}» создана'],['tCatRen','Категорію перейменовано на «{name}»','Category renamed to “{name}”','Категория переименована в «{name}»'],['tCatDel','Категорію «{name}» видалено','Category “{name}” deleted','Категория «{name}» удалена'],
['fNewCatOpt','+ Нова категорія…','+ New category…','+ Новая категория…'],['fModel','Назва моделі','Model name','Название модели'],['fSkuH','Артикул, як у вашому каталозі.','Article number, as in your catalog.','Артикул, как в вашем каталоге.'],
['fDescPh','Гібридний інвертор 5 кВт з Wi-Fi/4G модулем','5 kW hybrid inverter with Wi-Fi/4G module','Гибридный инвертор 5 кВт с Wi-Fi/4G модулем'],['fVolH','Скільки пристроїв плануєте продати за рік — допомагає нам підготувати SIM-карти.','How many devices you plan to sell per year — helps us prepare SIM cards.','Сколько устройств планируете продать за год — помогает нам подготовить SIM-карты.'],
['newModelNote','Після створення OTA перевірить модель і призначить пакет Light або Standard протягом 1 робочого дня.','After you create it, OTA will check the model and assign a Light or Standard package within 1 business day.','После создания OTA проверит модель и назначит пакет Light или Standard в течение 1 рабочего дня.'],
['createModel','Створити модель','Create model','Создать модель'],['newModelT','Нова модель · {brand}','New model · {brand}','Новая модель · {brand}'],['editModelT','Змінити модель','Edit model','Изменить модель'],
['delModel','Видалити модель','Delete model','Удалить модель'],['delModelT','Видалити модель «{name}»?','Delete model “{name}”?','Удалить модель «{name}»?'],
['delModelNo','Модель не можна видалити: у ній {n}. Спершу SIM-карти мають бути деактивовані.','This model can’t be deleted: it has {n}. Those SIM cards must be deactivated first.','Модель нельзя удалить: в ней {n}. Сначала SIM-карты должны быть деактивированы.'],
['delModelQ','Модель «{name}» та її список ({n}) буде видалено. Цю дію не можна скасувати.','Model “{name}” and its list ({n}) will be deleted. This can’t be undone.','Модель «{name}» и её список ({n}) будут удалены. Это действие нельзя отменить.'],
['eModel','Вкажіть назву моделі.','Enter a model name.','Укажите название модели.'],['eModelDup','Модель «{name}» уже є в бренді {brand}.','{brand} already has a model “{name}”.','Модель «{name}» уже есть в бренде {brand}.'],
['eSku','Вкажіть SKU (артикул) моделі.','Enter the model’s SKU (article number).','Укажите SKU (артикул) модели.'],['eSkuFmt','SKU може містити латинські літери, цифри та . _ / -','SKU may contain Latin letters, digits and . _ / -','SKU может содержать латинские буквы, цифры и . _ / -'],
['eSkuDup','SKU {sku} уже використовує модель «{name}».','SKU {sku} is already used by “{name}”.','SKU {sku} уже использует модель «{name}».'],
['eVol','Вкажіть ціле число від 1 до 10 000 000 або залиште порожнім.','Enter a whole number from 1 to 10,000,000, or leave it empty.','Укажите целое число от 1 до 10 000 000 или оставьте пустым.'],
['logModelNew','Створено модель «{name}» ({brand}) — на перевірці','Model “{name}” ({brand}) created — under review','Создана модель «{name}» ({brand}) — на проверке'],['logModelDel','Видалено модель «{name}»','Model “{name}” deleted','Удалена модель «{name}»'],
['tModelNew','Модель «{name}» створено. OTA призначить пакет Light або Standard протягом 1 робочого дня.','Model “{name}” created. OTA will assign Light or Standard within 1 business day.','Модель «{name}» создана. OTA назначит пакет Light или Standard в течение 1 рабочего дня.'],
['tModelSaved','Модель «{name}» збережено','Model “{name}” saved','Модель «{name}» сохранена'],['tModelDel','Модель «{name}» видалено','Model “{name}” deleted','Модель «{name}» удалена'],
['logApproved','OTA затвердила модель «{name}»: пакет {plan}','OTA approved “{name}”: {plan} package','OTA утвердила модель «{name}»: пакет {plan}'],
['logPlanChg','OTA змінила пакет моделі «{name}»: {was} → {plan}','OTA changed the package of “{name}”: {was} → {plan}','OTA изменила пакет модели «{name}»: {was} → {plan}'],
['logReview','Модель «{name}» повернуто на перевірку','Model “{name}” returned to review','Модель «{name}» возвращена на проверку'],
['tApproved','«{name}»: призначено пакет {plan}','“{name}”: {plan} package assigned','«{name}»: назначен пакет {plan}'],['tReview','«{name}» повернуто на перевірку','“{name}” returned to review','«{name}» возвращена на проверку'],
['upTitle','Завантаження IMEI · {name}','Upload IMEIs · {name}','Загрузка IMEI · {name}'],
['upIntro','Додайте IMEI пристроїв моделі {name}. Перед збереженням ми покажемо, що знайдено і що буде пропущено.','Add the IMEIs of {name} devices. Before saving we’ll show what was found and what will be skipped.','Добавьте IMEI устройств модели {name}. Перед сохранением мы покажем, что найдено и что будет пропущено.'],
['upFile','Оберіть файл CSV або TXT','Choose a CSV or TXT file','Выберите файл CSV или TXT'],['upFileH','До 5 МБ. IMEI — 15 цифр, по одному в рядку або через кому чи крапку з комою.','Up to 5 MB. IMEI = 15 digits, one per line or separated by commas or semicolons.','До 5 МБ. IMEI — 15 цифр, по одному в строке или через запятую или точку с запятой.'],
['upFileRm','Прибрати файл','Remove file','Убрать файл'],['upPaste','Або вставте IMEI','Or paste IMEIs','Или вставьте IMEI'],['upPasteH','Можна копіювати прямо зі стовпця Excel.','You can copy straight from an Excel column.','Можно копировать прямо из столбца Excel.'],
['genNote','Демо: згенерувати 100 коректних IMEI з випадковим TAC.','Demo: generate 100 valid IMEIs with a random TAC.','Демо: сгенерировать 100 корректных IMEI со случайным TAC.'],['gen','Згенерувати 100 тестових IMEI','Generate 100 test IMEIs','Сгенерировать 100 тестовых IMEI'],
['tGen','Додано 100 тестових IMEI (TAC {tac}). Натисніть «Перевірити».','100 test IMEIs added (TAC {tac}). Click “Check list”.','Добавлено 100 тестовых IMEI (TAC {tac}). Нажмите «Проверить».'],
['check','Перевірити','Check list','Проверить'],
['eEmpty','Оберіть файл або вставте IMEI.','Choose a file or paste IMEIs.','Выберите файл или вставьте IMEI.'],
['eNoImei','Не знайшли жодного IMEI. IMEI — це 15 цифр; розділяйте їх новим рядком, комою або крапкою з комою.','No IMEIs found. An IMEI is 15 digits; separate them with new lines, commas or semicolons.','Не нашли ни одного IMEI. IMEI — это 15 цифр; разделяйте их новой строкой, запятой или точкой с запятой.'],
['eFileSize','Файл займає {mb} МБ, максимум — 5 МБ. Розділіть його на частини.','The file is {mb} MB; the limit is 5 MB. Split it into parts.','Файл весит {mb} МБ, максимум — 5 МБ. Разделите его на части.'],
['eFileType','Потрібен файл .csv або .txt. Excel-файл збережіть як CSV.','Please choose a .csv or .txt file. Save an Excel file as CSV.','Нужен файл .csv или .txt. Excel-файл сохраните как CSV.'],
['eFileRead','Не вдалося прочитати файл. Спробуйте ще раз.','Couldn’t read the file. Please try again.','Не удалось прочитать файл. Попробуйте ещё раз.'],
['vTitle','Перевірка списку · {name}','Check results · {name}','Проверка списка · {name}'],
['vFound','знайдено всього','found in total','найдено всего'],['vNew','нові коректні — буде додано','new & valid — will be added','новые корректные — будут добавлены'],['vInvalid','з помилкою','with errors','с ошибкой'],
['vDups','повтори у файлі','repeated in the file','повторы в файле'],['vAlready','вже є в цій моделі','already in this model','уже есть в этой модели'],['vConflict','належать іншій моделі','belong to another model','принадлежат другой модели'],
['vIgnored','Пропущено {n} значень, не схожих на IMEI (номери рядків, заголовки тощо).','Skipped {n} values that don’t look like IMEIs (row numbers, headers, etc.).','Пропущено {n} значений, не похожих на IMEI (номера строк, заголовки и т. п.).'],
['vAllOk','Усі знайдені IMEI коректні.','All IMEIs found are valid.','Все найденные IMEI корректны.'],
['vInvT','IMEI з помилками — їх буде пропущено','IMEIs with errors — they’ll be skipped','IMEI с ошибками — они будут пропущены'],
['cLine','Рядок','Line','Строка'],['cValue','Значення','Value','Значение'],['cReason','Причина','Reason','Причина'],
['whyLen','{n} цифр замість 15','{n} digits instead of 15','{n} цифр вместо 15'],['whyCheck','Неправильна контрольна цифра — перевірте, чи немає помилки','Wrong check digit — look for a typo','Неверная контрольная цифра — проверьте, нет ли опечатки'],
['vMore','…і ще {n}','…and {n} more','…и ещё {n}'],
['vConfT','Ці IMEI вже є в іншій моделі й будуть пропущені','These IMEIs are already in another model and will be skipped','Эти IMEI уже есть в другой модели и будут пропущены'],
['vConfP','Один пристрій може бути лише в одній моделі. Якщо IMEI потрапив не туди — спершу видаліть його з тієї моделі.','A device can belong to one model only. If an IMEI is in the wrong model, remove it there first.','Одно устройство может быть только в одной модели. Если IMEI попал не туда — сначала удалите его из той модели.'],
['vNothingNew','Нових IMEI немає — усі коректні вже є в цьому списку.','Nothing new — all valid IMEIs are already on this list.','Новых IMEI нет — все корректные уже есть в этом списке.'],
['replace','Замінити весь список','Replace whole list','Заменить весь список'],['addN','Додати {n}','Add {n}','Добавить {n}'],['addNone','Немає що додати','Nothing to add','Нечего добавить'],
['srcPaste','вставлено вручну','pasted','вставлено вручную'],
['logAdd','Додано {n} IMEI до моделі «{name}»','{n} IMEIs added to “{name}”','Добавлено {n} IMEI в модель «{name}»'],['tAdd','Додано {n} до «{name}»','Added {n} to “{name}”','Добавлено {n} в «{name}»'],
['repT','Замінити весь список?','Replace the whole list?','Заменить весь список?'],['repQ','Поточний список моделі {name} буде повністю замінено новим.','The current list of {name} will be fully replaced with the new one.','Текущий список модели {name} будет полностью заменён новым.'],
['repNow','Зараз у списку','On the list now','Сейчас в списке'],['repNew','Буде після заміни','After replacing','Будет после замены'],['repRm','Буде видалено','Will be removed','Будет удалено'],
['repWarn','У пристроях із видаленими IMEI нові SIM-карти не вийдуть у мережу.','New SIM cards won’t go online in devices whose IMEIs are removed.','В устройствах с удалёнными IMEI новые SIM-карты не выйдут в сеть.'],
['repAct','Серед видалених — пристрої, де вже працює {n}.','Among the removed are devices that already have {n}.','Среди удалённых — устройства, где уже работает {n}.'],
['repOk','Замінити ({n} IMEI)','Replace ({n} IMEIs)','Заменить ({n} IMEI)'],
['logRep','Список IMEI моделі «{name}» замінено ({n})','IMEI list of “{name}” replaced ({n})','Список IMEI модели «{name}» заменён ({n})'],['tRep','Список «{name}» замінено: тепер {n}','“{name}” list replaced: now {n}','Список «{name}» заменён: теперь {n}'],
['rmT','Видалити IMEI зі списку?','Remove IMEI from the list?','Удалить IMEI из списка?'],
['rmActive','У пристрої {imei} уже працює SIM-карта {iccid}. Після видалення нові SIM-карти в ньому не вийдуть у мережу.','Device {imei} already has SIM card {iccid} online. After removal, new SIM cards won’t go online in it.','В устройстве {imei} уже работает SIM-карта {iccid}. После удаления новые SIM-карты в нём не выйдут в сеть.'],
['rmOk','Видалити IMEI','Remove IMEI','Удалить IMEI'],['logRm','IMEI {imei} видалено з моделі «{name}»','IMEI {imei} removed from “{name}”','IMEI {imei} удалён из модели «{name}»'],['tRm','IMEI {imei} видалено зі списку','IMEI {imei} removed from the list','IMEI {imei} удалён из списка'],
['expT','Експорт IMEI · {name}','Export IMEIs · {name}','Экспорт IMEI · {name}'],['expP','{n}, по одному в рядку.','{n}, one per line.','{n}, по одному в строке.'],['expL','Список IMEI','IMEI list','Список IMEI'],['expDl','Завантажити .txt','Download .txt','Скачать .txt'],['expCopy','Скопіювати все','Copy all','Скопировать всё'],
];const o={uk:{},en:{},ru:{}};R.forEach(([k,uk,en,ru])=>{o.uk['cat.'+k]=uk;o.en['cat.'+k]=en;o.ru['cat.'+k]=ru;});I18N.add(o);})();

I18N.add({uk:{'cat.usdT':'Ціна пакета {p} у доларах для партнера','cat.usdP':'Без ПДВ, для міжнародних рахунків. Змініть за потреби — зміна потрапить в історію цін.','cat.usdLog':'змінено цін у $: {n}'},
en:{'cat.usdT':'{p} package price in USD for this partner','cat.usdP':'Net, for international invoices. Adjust if needed — changes go to the price history.','cat.usdLog':'USD prices changed: {n}'},
ru:{'cat.usdT':'Цена пакета {p} в долларах для партнёра','cat.usdP':'Без НДС, для международных счетов. Измените при необходимости — изменение попадёт в историю цен.','cat.usdLog':'изменено цен в $: {n}'}});
