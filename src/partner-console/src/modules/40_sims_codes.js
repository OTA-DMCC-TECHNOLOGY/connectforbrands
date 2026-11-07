/* ===== 40_sims_codes: SIM inventory (sim_), activation codes + package credits + resellers (cod_) ===== */

/* ---------- shared helpers ---------- */
const SIM_PER=50;
let sim_liveT=null;
function sim_f(){if(!S.ui.sim_f)S.ui.sim_f={q:'',st:'all',model:'',pkg:'',res:''};return S.ui.sim_f;}
function sim_resName(id){const r=(S.resellers||[]).find(x=>x.id===id);return r?r.name:'';}
function cod_f(){if(!S.ui.cod_f)S.ui.cod_f={pkg:'',st:'',res:'',q:'',batch:''};return S.ui.cod_f;}
function sim_modelMap(){const m={};allModels().forEach(x=>{m[x.model.id]=x;});return m;}
function sim_devName(x){return x?esc(x.brand.name)+' · '+esc(x.model.name):'—';}
function sim_allPkgs(){const out=[];PLANS.forEach(p=>TERMS.forEach(tm=>out.push(pkgKey(p,tm))));return out;}
function sim_pkgLbl(k){const [p,tm]=k.split('-');return pkgLabel(p,+tm);}
function sim_ago(x){if(!x)return '—';const s=(now()-new Date(x))/1000;let rtf;try{rtf=new Intl.RelativeTimeFormat(LOCALES[S.lang],{numeric:'auto'});}catch(e){return fmtDateTime(x);}
 if(s<45)return t('sim.justNow');if(s<3600)return rtf.format(-Math.round(s/60),'minute');if(s<86400)return rtf.format(-Math.round(s/3600),'hour');if(s<86400*30)return rtf.format(-Math.round(s/86400),'day');return fmtDate(x);}
function sim_addMonths(d,m){const x=new Date(d.getTime());x.setMonth(x.getMonth()+m);return x;}
function sim_submit(label,form,kind){return `<button class="btn ${kind||'primary'}" type="submit" form="${form}"><span>${label}</span></button>`;}
function sim_cancel(){return ui.btn(t('c.cancel'),{act:'ovclose'});}
function sim_statusBadge(s){return s.status==='active'?ui.badge(t('sim.st.active'),'ok',true):s.status==='blocked'?ui.badge(t('sim.st.blockedLong'),'bad',true):ui.badge(t('sim.st.stock'),'info',true);}
function sim_approvedModels(){return allModels().filter(x=>x.model.planStatus==='approved'&&x.model.plan);}
function cod_w(n){return plural(n,{one:t('cod.w.one'),few:t('cod.w.few'),many:t('cod.w.many'),other:t('cod.w.other')});}
function sim_opt(v,l,sel){return `<option value="${esc(v)}" ${String(v)===String(sel)?'selected':''}>${esc(l)}</option>`;}

/* live search inputs: data-live="ACTNAME" (debounced, keeps focus) */
document.addEventListener('input',e=>{const el=e.target.closest&&e.target.closest('[data-live]');if(!el)return;clearTimeout(sim_liveT);
 sim_liveT=setTimeout(()=>{const fn=ACT[el.dataset.live];if(!fn)return;const id=el.id,pos=el.selectionStart;fn(el.value,el);const n=id&&document.getElementById(id);if(n&&n!==document.activeElement){n.focus();try{n.setSelectionRange(pos,pos);}catch(x){}}},220);});

/* ---------- nav & routes ---------- */
nav({key:'sims',label:()=>t('sim.nav'),icon:'sim',href:'#sims',order:30});

/* ================= SIM inventory ================= */
function sim_filtered(f,mm){const q=digits(f.q);const out=[];
 for(const s of S.sims){
  if(f.st!=='all'&&s.status!==f.st)continue;
  if(f.model&&s.modelId!==f.model)continue;
  if(f.res){if(f.res==='none'){if(s.reseller)continue;}else if(s.reseller!==f.res)continue;}
  if(f.pkg){if(f.pkg==='none'){if(s.plan)continue;}else if(f.pkg==='any'){if(!s.plan)continue;}else if(pkgKey(s.plan,s.term)!==f.pkg)continue;}
  if(q&&!(s.iccid.indexOf(q)>=0||(s.imei&&s.imei.indexOf(q)>=0)))continue;
  out.push(s);}
 return out;}

route('sims',{nav:'sims',render(){
 const f=sim_f();
 if(S.ui.sim_filterModel){f.model=S.ui.sim_filterModel;f.st='all';S.ui.sim_page=1;delete S.ui.sim_filterModel;}
 const mm=sim_modelMap();if(f.model&&!mm[f.model])f.model='';
 // single pass KPIs
 const k={stock:0,active:0,blocked:0,pkg:0,linked:0};
 for(const s of S.sims){k[s.status]=(k[s.status]||0)+1;if(s.plan)k.pkg++;if(s.linked)k.linked++;}
 const total=S.sims.length;
 const demo=`<details class="sim_demo"><summary class="btn ghost sm">${icon('spark','sm')}<span>${t('sim.demo')}</span></summary><div class="menu" role="menu">
  <button type="button" role="menuitem" data-act="sim_simInstall">${icon('bolt','sm')}<span>${t('sim.simInstall')}</span></button>
  <button type="button" role="menuitem" data-act="sim_simLink">${icon('users','sm')}<span>${t('sim.simLink')}</span></button>
  <button type="button" role="menuitem" data-act="cod_simAct">${icon('key','sm')}<span>${t('cod.simAct')}</span></button></div></details>`;
 const actions=(S.admin?demo:'')+(can('p.orders')&&(can('p.imei')||can('p.receipt'))&&['p_admin','p_ops'].includes(actor().role)?ui.btn(t('sim.export'),{icon:'download',act:'sim_export'}):'')+ui.btn(t('sim.orderMore'),{kind:'primary',icon:'plus',href:'#shipments'});
 if(!total){
  return ui.page({title:t('sim.title'),sub:t('sim.sub'),actions,body:ui.card({body:ui.empty('sim',t('sim.emptyT'),t('sim.emptyP'),ui.btn(t('sim.orderMore'),{kind:'primary',href:'#shipments'}))})});}
 const kpis=`<div class="sim_kpis">
  ${ui.kpi(t('sim.k.stock'),fmtNum(k.stock),pct(k.stock/total)+' '+t('sim.k.ofAll'))}
  ${ui.kpi(t('sim.k.active'),fmtNum(k.active),t('sim.k.activeS'))}
  ${ui.kpi(t('sim.k.blocked'),`<span style="color:${k.blocked?'var(--bad)':'inherit'}">${fmtNum(k.blocked)}</span>`,k.blocked?t('sim.k.blockedS'):t('sim.k.blockedNone'))}
  ${ui.kpi(t('sim.k.pkg'),fmtNum(k.pkg),k.active?pct(k.pkg/Math.max(1,k.active))+' '+t('sim.k.ofActive'):'')}
  ${ui.kpi(t('sim.k.linked'),fmtNum(k.linked),k.active?pct(k.linked/Math.max(1,k.active))+' '+t('sim.k.ofActive'):'')}</div>`;
 const rows=sim_filtered(f,mm);
 const pages=Math.max(1,Math.ceil(rows.length/SIM_PER));const page=clamp(+S.ui.sim_page||1,1,pages);S.ui.sim_page=page;
 const slice=rows.slice((page-1)*SIM_PER,page*SIM_PER);
 const modelOpts=sim_opt('',t('sim.f.allModels'),f.model)+allModels().map(x=>sim_opt(x.model.id,x.brand.name+' · '+x.model.name,f.model)).join('');
 const pkgOpts=sim_opt('',t('sim.f.allPkgs'),f.pkg)+sim_opt('none',t('sim.f.noPkg'),f.pkg)+sim_opt('any',t('sim.f.anyPkg'),f.pkg)+sim_allPkgs().map(p=>sim_opt(p,sim_pkgLbl(p),f.pkg)).join('');
 const toolbar=`<div class="toolbar">
  <label class="sim_search">${icon('search','sm')}<span class="sim_sr">${t('sim.f.search')}</span><input class="inp" id="sim_q" type="search" inputmode="numeric" autocomplete="off" placeholder="${esc(t('sim.f.search'))}" value="${esc(f.q)}" data-live="sim_q"></label>
  ${ui.seg('sim_st',[['all',t('c.all')+' '+fmtNum(total)],['stock',t('sim.st.stock')],['active',t('sim.st.activeShort')],['blocked',t('sim.st.blocked')+(k.blocked?' '+fmtNum(k.blocked):'')]],f.st,'sim_st')}
  <label class="sim_sr" for="sim_fm">${t('sim.f.model')}</label><select class="inp sim_sel" id="sim_fm" data-act="sim_fModel">${modelOpts}</select>
  <label class="sim_sr" for="sim_fp">${t('sim.f.pkg')}</label><select class="inp sim_sel" id="sim_fp" data-act="sim_fPkg">${pkgOpts}</select>
  <label class="sim_sr" for="sim_fr">${t('sim.f.res')}</label><select class="inp sim_sel" id="sim_fr" data-act="sim_fRes">${sim_opt('',t('sim.f.allRes'),f.res)+sim_opt('none',t('sim.f.noRes'),f.res)+(S.resellers||[]).map(r=>sim_opt(r.id,r.name,f.res)).join('')}</select>
  ${(f.q||f.st!=='all'||f.model||f.pkg||f.res)?ui.btn(t('sim.f.reset'),{kind:'ghost',size:'sm',act:'sim_reset',icon:'x'}):''}</div>`;
 const cols=[{label:'ICCID'},{label:t('c.status')},{label:t('sim.c.res')},{label:t('sim.c.device')},{label:'IMEI'},{label:t('sim.c.pkg')},{label:t('sim.c.customer')},{label:t('sim.c.seen')}];
 const trs=slice.map(s=>({act:'sim_open',arg:s.iccid,cells:[
  `<span class="mono" style="white-space:nowrap">${fmtIccid(s.iccid)}</span>`,
  sim_statusBadge(s),
  s.reseller?`<span class="small" style="white-space:nowrap">${esc(sim_resName(s.reseller))}</span>`:'<span class="faint small">'+t('sim.f.noResShort')+'</span>',
  s.modelId&&mm[s.modelId]?`<span style="white-space:nowrap">${esc(mm[s.modelId].model.name)}</span><br><span class="xs faint">${esc(mm[s.modelId].brand.name)}</span>`:'<span class="faint">—</span>',
  s.imei?`<span class="mono small">${esc(s.imei)}</span>`:'<span class="faint">—</span>',
  s.plan?`<span style="white-space:nowrap">${esc(s.sub?PLAN_NAME[s.plan]+' · '+t('cx.via.sub'):pkgLabel(s.plan,s.term))}</span><br><span class="xs faint">${t('sim.until',{d:fmtDate(s.paidUntil)})}</span>`:`<span class="faint small">${t('sim.noPkg')}</span>`,
  s.linked?ui.badge(t('sim.linked'),'ok'):s.status==='active'?ui.badge(t('sim.notLinked'),''):'<span class="faint">—</span>',
  `<span class="small muted" style="white-space:nowrap">${sim_ago(s.lastSeen)}</span>`]}));
 const table=ui.table(cols,trs,{empty:ui.empty('search',t('c.nothing'),t('sim.nothingP'),ui.btn(t('sim.f.reset'),{act:'sim_reset'}))});
 const blockedNote=k.blocked&&f.st!=='blocked'?ui.note('bad',`${t('sim.blockedNote',{n:fmtNum(k.blocked)})} <button type="button" class="sim_lnk" data-act="sim_st" data-arg="blocked">${t('sim.showBlocked')}</button>`):'';
 return ui.page({title:t('sim.title'),sub:t('sim.sub'),actions,body:`<div class="stack">${kpis}${blockedNote}<section class="card sim_tbl">${toolbar}${table}${rows.length>SIM_PER?ui.pager(page,rows.length,SIM_PER,'sim_page'):''}</section></div>`});}});

Object.assign(ACT,{
 sim_q(v){sim_f().q=v;S.ui.sim_page=1;rerender();},
 sim_st(v){sim_f().st=v;S.ui.sim_page=1;if(parseHash().name!=='sims')go('sims');else rerender();},
 sim_fModel(v){sim_f().model=v;S.ui.sim_page=1;rerender();},
 sim_fPkg(v){sim_f().pkg=v;S.ui.sim_page=1;rerender();},
 sim_fRes(v){sim_f().res=v;S.ui.sim_page=1;rerender();},
 sim_reset(){S.ui.sim_f={q:'',st:'all',model:'',pkg:'',res:''};S.ui.sim_page=1;rerender();},
 sim_page(p){S.ui.sim_page=+p;rerender();const c=$('#content .card');if(c)c.scrollIntoView({block:'start'});},
 sim_open(iccid){sim_drawer(iccid);},
 sim_export(){if(!['p_admin','p_ops'].includes(actor().role)){toast(t('c.noPerm',{r:esc(roleName(actor().role))}),'bad');return;}sim_exportModal();},   // ТЗ v10 4.9 p.5: Partner Admin / Operations only, audited
 sim_copyCsv(){const ta=$('#sim_csv');if(ta)copyText(ta.value);},
 sim_simInstall(){sim_installModal();},
 sim_simLink(){sim_simulateLink();},
 sim_wl(iccid){sim_wlModal(iccid);},
 sim_imeiMode(v){const w=$('#sim_imeiCustom');if(w)w.hidden=v!=='custom';},
});

/* ----- drawer ----- */
function sim_evText(ev,s,mm){const [ts,type,detail]=ev;const dev=s.modelId?sim_devName(mm[s.modelId]):'';
 const o=s.shipmentId&&(S.shipments||[]).find(x=>x.id===s.shipmentId);
 switch(type){
  case 'in_stock':return [t('sim.ev.in_stock'),o?t('sim.ev.order',{n:esc(o.pf)}):'','ok'];
  case 'installed':return [t('sim.ev.installed'),(detail?esc(detail):dev)+(s.imei?' · IMEI '+esc(s.imei):''),'ok'];
  case 'linked':return [t('sim.ev.linked'),t('sim.ev.linkedS'),'ok'];
  case 'package':return [t('sim.ev.package'),(s.plan?esc(pkgLabel(s.plan,s.term)):'')+(s.code?' · <span class="mono">'+fmtCode(s.code)+'</span>':''),'ok'];
  case 'subscription':return [t('cx.via.sub'),s.plan?esc(PLAN_NAME[s.plan]):'','ok'];
  case 'blocked':return [t('sim.ev.blocked'),t('sim.ev.blockedS',{imei:esc(detail||s.imei||'—')}),'bad'];
  case 'toReseller':return [t('sim.ev.toRes'),esc(detail||''),'ok'];
  case 'fromReseller':return [t('sim.ev.fromRes'),esc(detail||''),'ok'];
  case 'whitelisted':return [t('sim.ev.whitelisted'),t('sim.ev.whitelistedS',{m:esc(detail||'')}),'ok'];
  default:return [esc(type),esc(detail||''),'ok'];}}
function sim_drawer(iccid){const s=S.sims.find(x=>x.iccid===iccid);if(!s)return;const mm=sim_modelMap();const x=s.modelId&&mm[s.modelId];
 const o=s.shipmentId&&(S.shipments||[]).find(q=>q.id===s.shipmentId);
 const evs=(s.events||[]).slice().sort((a,b)=>new Date(b[0])-new Date(a[0]));
 const tl=`<div class="timeline">${evs.map((ev,i)=>{const [ti,sub,tone]=sim_evText(ev,s,mm);return `<div class="tl ${tone==='bad'?'sim_tlbad':i===0?'cur':'done'}"><span class="dot">${icon(tone==='bad'?'x':'check','sm')}</span><div class="col"><b>${ti}</b>${sub?`<span class="small muted">${sub}</span>`:''}<span class="xs faint">${fmtDateTime(ev[0])}</span></div></div>`;}).join('')}</div>`;
 const dl=`<dl class="dl">
  <dt>ICCID</dt><dd class="mono">${fmtIccid(s.iccid)} ${ui.iconbtn('copy',t('sim.copyIccid'),{act:'copy',arg:s.iccid})}</dd>
  <dt>${t('c.status')}</dt><dd>${sim_statusBadge(s)}</dd>
  <dt>${t('sim.c.device')}</dt><dd>${x?sim_devName(x):'—'}</dd>
  <dt>IMEI</dt><dd class="mono">${s.imei?esc(s.imei):'—'}</dd>
  <dt>${t('sim.c.pkg')}</dt><dd>${s.plan?esc(s.sub?PLAN_NAME[s.plan]+' · '+t('cx.via.sub'):pkgLabel(s.plan,s.term))+'<br><span class="small muted">'+t('sim.until',{d:fmtDate(s.paidUntil)})+'</span>':'<span class="faint">'+t('sim.noPkg')+'</span>'}</dd>
  <dt>${t('sim.d.code')}</dt><dd>${s.code?'<span class="mono">'+fmtCode(s.code)+'</span>':'—'}</dd>
  <dt>${t('sim.c.customer')}</dt><dd>${s.linked?ui.badge(t('sim.linked'),'ok'):t('sim.notLinked')}</dd>
  <dt>${t('sim.c.seen')}</dt><dd>${s.lastSeen?sim_ago(s.lastSeen)+' <span class="xs faint">('+fmtDateTime(s.lastSeen)+')</span>':'—'}</dd>
  <dt>${t('sim.c.res')}</dt><dd>${s.reseller?`<a href="${link('reseller',s.reseller)}">${esc(sim_resName(s.reseller))}</a>`:'<span class="faint">'+t('sim.f.noResShort')+'</span>'}</dd>
  <dt>${t('sim.d.order')}</dt><dd>${o?`<a class="mono" href="${link('shipment',o.id)}">${esc(o.pf)}</a>`:'—'}</dd></dl>`;
 let extra='';
 if(s.status==='blocked')extra=ui.note('bad',`<b>${t('sim.d.blockedT')}</b><br>${t('sim.d.blockedP',{imei:'<span class="mono">'+esc(s.imei||'—')+'</span>'})}`);
 else if(s.status==='stock')extra=ui.note('info',t('sim.d.stockP'));
 else if(s.status==='active'&&!s.plan)extra=ui.note('warn',t('sim.d.noPkgP'));
 let foot=ui.btn(t('c.close'),{act:'ovclose'});
 if(s.status==='blocked')foot=ui.btn(t('sim.d.addWl'),{kind:'primary',icon:'shield',act:'sim_wl',arg:s.iccid})+foot;
 if(s.status==='active'&&!s.plan)foot=ui.btn(t('cod.simActShort'),{icon:'spark',act:'cod_simAct',arg:s.iccid})+foot;
 foot=(foot||'')+HOOKS.simDrawer.map(fn=>{try{return fn(s)||'';}catch(e){console.error(e);return '';}}).join('');
 drawer(t('sim.d.title')+' <span class="mono faint" style="font-weight:500">···'+esc(s.iccid.slice(-6))+'</span>',`${extra}${dl}<h3 class="sim_h3">${t('sim.d.history')}</h3>${tl}`,foot);}

/* ----- whitelist fix ----- */
function sim_wlModal(iccid){const s=S.sims.find(x=>x.iccid===iccid);if(!s)return;const ms=sim_approvedModels();
 if(!ms.length){modal(t('sim.wl.title'),ui.note('warn',t('sim.wl.none')),ui.btn(t('sim.wl.toCatalog'),{href:'#catalog'})+sim_cancel());return;}
 modal(t('sim.wl.title'),`<form id="sim_wlF" data-form="sim_wl" class="stack" novalidate><input type="hidden" name="iccid" value="${esc(iccid)}">
  <p class="muted">${t('sim.wl.p',{imei:'<b class="mono">'+esc(s.imei)+'</b>'})}</p>
  ${ui.field({id:'sim_wlm',label:t('sim.wl.model'),type:'select',options:ms.map(x=>[x.model.id,x.brand.name+' · '+x.model.name+' ('+PLAN_NAME[x.model.plan]+')']),hint:t('sim.wl.hint')})}
  ${ui.note('info',t('sim.wl.note'))}</form>`,sim_cancel()+sim_submit(t('sim.wl.do'),'sim_wlF'));}
FORM.sim_wl=f=>{const d=formData(f);const s=S.sims.find(x=>x.iccid===d.iccid);const x=findModel(d.sim_wlm);if(!s||!x)return;
 if(x.model.imei.indexOf(s.imei)<0)x.model.imei.push(s.imei);
 s.status='active';s.modelId=x.model.id;s.lastSeen=iso(now());s.events=s.events||[];s.events.push([iso(now()),'whitelisted',x.model.name]);
 log(t('sim.wl.log',{imei:s.imei,m:x.model.name,iccid:fmtIccid(s.iccid)}));closeOverlay();toast(t('sim.wl.toast',{m:esc(x.model.name)}));rerender();};

/* ----- export ----- */
function sim_exportModal(){const f=sim_f();const mm=sim_modelMap();const rows=sim_filtered(f,mm);const max=5000;const part=rows.slice(0,max);audit('iccid.export','sims',{count:part.length,filter:f});
 const q=v=>{v=v==null?'':String(v);return /[",\n;]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;};
 const lines=['iccid,status,brand,model,imei,package,paid_until,customer_linked,last_seen'];
 for(const s of part){const x=s.modelId&&mm[s.modelId];lines.push([s.iccid,s.status,x?x.brand.name:'',x?x.model.name:'',s.imei||'',s.plan?pkgKey(s.plan,s.term):'',s.paidUntil?s.paidUntil.slice(0,10):'',s.linked?'yes':'no',s.lastSeen||''].map(q).join(','));}
 modal(t('sim.ex.title'),`<p class="muted">${t('sim.ex.p',{n:fmtNum(part.length)})}</p>${rows.length>max?ui.note('warn',t('sim.ex.cut',{n:fmtNum(rows.length),m:fmtNum(max)})):''}
  <div class="field"><label for="sim_csv">CSV</label><textarea class="inp" id="sim_csv" rows="12" readonly>${esc(lines.join('\n'))}</textarea></div>`,
  ui.btn(t('c.close'),{act:'ovclose'})+ui.btn(t('sim.ex.copy'),{kind:'primary',icon:'copy',act:'sim_copyCsv'}),{wide:true});}

/* ----- demo: installation ----- */
function sim_installModal(){const ms=sim_approvedModels().filter(x=>x.model.imei.length);
 let stock=0;for(const s of S.sims)if(s.status==='stock')stock++;
 if(!stock){modal(t('sim.in.title'),ui.note('warn',t('sim.in.noStock')),ui.btn(t('sim.orderMore'),{kind:'primary',href:'#shipments'})+sim_cancel());return;}
 if(!ms.length){modal(t('sim.in.title'),ui.note('warn',t('sim.in.noModels')),sim_cancel());return;}
 modal(t('sim.in.title'),`<form id="sim_inF" data-form="sim_install" class="stack" novalidate>
  ${ui.note('admin',t('sim.in.demoNote'))}
  <p class="muted small">${t('sim.in.p',{n:fmtNum(stock)})}</p>
  ${ui.field({id:'sim_inm',label:t('sim.in.model'),type:'select',options:ms.map(x=>[x.model.id,x.brand.name+' · '+x.model.name+' · '+fmtNum(x.model.imei.length)+' IMEI'])})}
  <fieldset class="sim_fs"><legend>${t('sim.in.imei')}</legend>
   <label class="chk"><input type="radio" name="mode" value="wl" checked data-act="sim_imeiMode"><span><b>${t('sim.in.wl')}</b><br><span class="small muted">${t('sim.in.wlS')}</span></span></label>
   <label class="chk"><input type="radio" name="mode" value="rnd" data-act="sim_imeiMode"><span><b>${t('sim.in.rnd')}</b><br><span class="small muted">${t('sim.in.rndS')}</span></span></label>
   <label class="chk"><input type="radio" name="mode" value="custom" data-act="sim_imeiMode"><span><b>${t('sim.in.custom')}</b></span></label>
   <div id="sim_imeiCustom" hidden>${ui.field({id:'sim_ini',label:'IMEI',mono:true,placeholder:'358673101000001',attrs:'inputmode="numeric" maxlength="15" autocomplete="off"'})}</div></fieldset></form>`,
  sim_cancel()+sim_submit(t('sim.in.do'),'sim_inF'));}
function sim_whitelistIndex(){const idx=new Map();for(const x of sim_approvedModels())for(const i of x.model.imei)if(!idx.has(i))idx.set(i,x.model.id);return idx;}
FORM.sim_install=f=>{clearErrs(f);const d=formData(f);const mode=(f.querySelector('input[name=mode]:checked')||{}).value||'wl';const x=findModel(d.sim_inm);if(!x)return;
 const sim=S.sims.find(s=>s.status==='stock');if(!sim){closeOverlay();toast(t('sim.in.noStock'),'bad');return;}
 const used=new Set();for(const s of S.sims)if(s.imei)used.add(s.imei);
 let imei=null;
 if(mode==='wl'){const L=x.model.imei;const st=Math.floor(Math.random()*L.length);for(let i=0;i<L.length;i++){const c=L[(st+i)%L.length];if(!used.has(c)){imei=c;break;}}
  if(!imei){setErr(f,'sim_inm',t('sim.in.allUsed'));return;}}
 else if(mode==='rnd'){const idx=sim_whitelistIndex();do{imei=genImei('35'+String(100000+Math.floor(Math.random()*899999)),Math.floor(Math.random()*999999));}while(idx.has(imei)||used.has(imei));}
 else{imei=digits(d.sim_ini);if(!validImei(imei)){setErr(f,'sim_ini',t('sim.in.badImei'));return;}if(used.has(imei)){setErr(f,'sim_ini',t('sim.in.usedImei'));return;}}
 const idx=sim_whitelistIndex();const owner=idx.get(imei);const ts=iso(now());
 sim.imei=imei;sim.lastSeen=ts;sim.events=sim.events||[];
 if(owner){const ox=findModel(owner);sim.status='active';sim.modelId=owner;sim.events.push([ts,'installed',ox.brand.name+' · '+ox.model.name]);
  log(t('sim.in.logOk',{iccid:fmtIccid(sim.iccid),m:ox.model.name}));closeOverlay();toast(t('sim.in.toastOk',{iccid:'···'+sim.iccid.slice(-6),m:esc(ox.model.name)}));}
 else{sim.status='blocked';sim.modelId=null;sim.events.push([ts,'blocked',imei]);
  log(t('sim.in.logBad',{iccid:fmtIccid(sim.iccid),imei}));closeOverlay();toast(t('sim.in.toastBad',{iccid:'···'+sim.iccid.slice(-6)}),'bad');}
 rerender();};

/* ----- demo: customer linking ----- */
function sim_simulateLink(){const c=[];for(const s of S.sims)if(s.status==='active'&&!s.linked)c.push(s);
 const dm=$('.sim_demo');if(dm)dm.removeAttribute('open');
 if(!c.length){toast(t('sim.ln.none'),'bad');return;}
 const s=c[Math.floor(Math.random()*c.length)];s.linked=true;s.lastSeen=iso(now());s.events=s.events||[];s.events.push([iso(now()),'linked']);
 log(t('sim.ln.log',{iccid:fmtIccid(s.iccid)}));toast(t('sim.ln.toast',{iccid:'···'+s.iccid.slice(-6)}));rerender();}

/* ================= i18n ================= */
I18N.add({
uk:{
'sim.nav':'SIM-карти','sim.title':'SIM-карти','sim.sub':'Усі ваші SIM-карти: що на складі, що вже працює в пристроях і що потребує уваги.',
'sim.demo':'Демо','sim.simInstall':'Імітувати встановлення','sim.simLink':'Імітувати прив’язку клієнтом','sim.export':'Експорт','sim.orderMore':'Відвантаження SIM',
'sim.emptyT':'SIM-карт поки немає','sim.emptyP':'Карти з’являться тут, щойно ви підтвердите отримання відвантаження SIM від OTA.',
'sim.k.stock':'На складі','sim.k.active':'Активні','sim.k.blocked':'Заблоковані','sim.k.pkg':'З пакетом','sim.k.linked':'Прив’язані клієнтом','sim.k.ofAll':'від усіх','sim.k.activeS':'онлайн у пристроях','sim.k.blockedS':'IMEI немає у списку','sim.k.blockedNone':'усе гаразд','sim.k.ofActive':'від активних',
'sim.f.search':'ICCID або IMEI','sim.f.model':'Модель','sim.f.allModels':'Усі моделі','sim.f.pkg':'Пакет','sim.f.allPkgs':'Усі пакети','sim.f.noPkg':'Без пакета','sim.f.anyPkg':'З будь-яким пакетом','sim.f.reset':'Скинути',
'sim.st.stock':'На складі','sim.st.active':'Онлайн','sim.st.activeShort':'Активні','sim.st.blocked':'Заблоковані','sim.st.blockedLong':'Заблоковано: IMEI немає у списку',
'sim.c.device':'Пристрій','sim.c.pkg':'Пакет','sim.c.customer':'Клієнт','sim.c.seen':'Остання активність','sim.until':'до {d}','sim.noPkg':'Без пакета','sim.linked':'Прив’язано','sim.notLinked':'Не прив’язано',
'sim.nothingP':'Спробуйте інший запит або скиньте фільтри.','sim.blockedNote':'{n} SIM заблоковано: їх вставили в пристрої, IMEI яких немає в жодному списку моделі.','sim.showBlocked':'Показати',
'sim.justNow':'щойно','sim.copyIccid':'Копіювати ICCID',
'sim.ev.in_stock':'Надійшла на склад','sim.ev.order':'Відвантаження {n}','sim.ev.installed':'Встановлено в пристрій','sim.ev.linked':'Клієнт прив’язав SIM','sim.ev.linkedS':'У клієнтському кабінеті','sim.ev.package':'Активовано пакет','sim.ev.blocked':'Заблоковано','sim.ev.blockedS':'IMEI {imei} немає у списку жодної затвердженої моделі','sim.ev.whitelisted':'IMEI додано до списку','sim.ev.whitelistedS':'Модель {m} — SIM вийшла в мережу',
'sim.d.title':'SIM','sim.d.code':'Код активації','sim.d.order':'Відвантаження','sim.d.history':'Історія','sim.d.blockedT':'Чому SIM заблокована','sim.d.blockedP':'Карту вставили в пристрій з IMEI {imei}, якого немає в списку IMEI жодної затвердженої моделі. Якщо це ваш пристрій — додайте IMEI до списку, і SIM запрацює.','sim.d.stockP':'Карта на вашому складі й ще не вставлена в пристрій.','sim.d.noPkgP':'SIM працює, але пакет ще не активовано: клієнт має ввести код активації.','sim.d.addWl':'Додати цей IMEI до списку моделі',
'sim.wl.title':'Додати IMEI до списку моделі','sim.wl.p':'IMEI {imei} буде додано до списку вибраної моделі, і SIM одразу вийде в мережу.','sim.wl.model':'Модель','sim.wl.hint':'Лише затверджені моделі','sim.wl.note':'Додавайте лише IMEI своїх пристроїв. Пакет потім активує клієнт кодом.','sim.wl.do':'Додати й увімкнути','sim.wl.none':'Немає затверджених моделей. Додайте модель і дочекайтеся затвердження.','sim.wl.toCatalog':'До каталогу','sim.wl.log':'IMEI {imei} додано до моделі {m}; SIM {iccid} онлайн','sim.wl.toast':'IMEI додано до {m} — SIM онлайн',
'sim.ex.title':'Експорт SIM-карт','sim.ex.p':'{n} рядків за поточними фільтрами. Скопіюйте й вставте в Excel чи Google Таблиці.','sim.ex.cut':'Знайдено {n}, у файл увійдуть перші {m}. Звузьте фільтри, щоб отримати решту.','sim.ex.copy':'Копіювати CSV',
'sim.in.title':'Імітувати встановлення','sim.in.demoNote':'Демо: так виглядатиме реальне підключення SIM у пристрої в мережу.','sim.in.p':'Береться перша SIM зі складу ({n} доступно).','sim.in.model':'Модель пристрою','sim.in.imei':'IMEI пристрою','sim.in.wl':'IMEI зі списку моделі','sim.in.wlS':'SIM вийде в мережу','sim.in.rnd':'Випадковий IMEI поза списком','sim.in.rndS':'SIM буде заблоковано','sim.in.custom':'Ввести IMEI вручну','sim.in.do':'Встановити SIM','sim.in.noStock':'На складі немає SIM-карт.','sim.in.noModels':'Немає затверджених моделей зі списком IMEI.','sim.in.allUsed':'Усі IMEI цієї моделі вже використані.','sim.in.badImei':'IMEI — 15 цифр з правильною контрольною цифрою.','sim.in.usedImei':'Цей IMEI вже використовує інша SIM.','sim.in.logOk':'SIM {iccid} встановлено в {m}','sim.in.logBad':'SIM {iccid} заблоковано: IMEI {imei} поза списком','sim.in.toastOk':'SIM {iccid} онлайн у {m}','sim.in.toastBad':'SIM {iccid} заблоковано: IMEI немає у списку',
'sim.ln.none':'Немає активних SIM без прив’язки','sim.ln.log':'Клієнт прив’язав SIM {iccid}','sim.ln.toast':'Клієнт прив’язав SIM {iccid}',
'cod.nav':'Коди активації','cod.rnav':'Точки продажу','cod.title':'Коди активації','cod.sub':'Кредити пакетів, партії кодів і хто які коди отримав.',
'cod.explain':'Коди безкоштовні й без обмежень — давайте точкам продажу скільки потрібно. Кожна реальна активація списує один кредит відповідного пакета. Якщо кредити закінчаться, активації чекатимуть, доки ви не поповните.',
'cod.cr.avail':'доступно','cod.cr.bought':'Куплено','cod.cr.used':'Використано','cod.cr.buy':'Докупити','cod.cr.empty':'Закінчились','cod.cr.low':'Мало','cod.cr.out':'Роздано й не активовано: {n}','cod.cr.outWarn':'Роздано й не активовано: {n} — більше, ніж кредитів','cod.cr.noneT':'Кредитів пакетів ще немає','cod.cr.noneP':'Кредити потрібні, щоб клієнти могли активувати пакети. Додайте їх до замовлення.',
'cod.b.title':'Партії кодів','cod.b.created':'Створено','cod.b.label':'Примітка','cod.b.qty':'Кодів','cod.b.emptyT':'Ще немає кодів','cod.b.emptyP':'Згенеруйте першу партію — це безкоштовно.',
'cod.gen':'Згенерувати коди','cod.hand':'Видати коди','cod.handShort':'Видати','cod.list':'Коди','cod.sum':'Вільні {f} · видані {a} · активовані {x}','cod.nothingP':'Змініть фільтри або пошук.','cod.copyCode':'Копіювати код',
'cod.st.free':'Вільні','cod.st.assigned':'Видані','cod.st.activated':'Активовані',
'cod.c.code':'Код','cod.c.pkg':'Пакет','cod.c.reseller':'Точка продажу','cod.c.activated':'Активація',
'cod.f.search':'Код або ICCID','cod.f.allSt':'Усі статуси','cod.f.allRes':'Усі точки','cod.f.noRes':'Не видані','cod.f.batch':'Партія',
'cod.g.title':'Згенерувати коди','cod.g.p':'Коди безкоштовні. Кредит списується лише тоді, коли клієнт активує пакет.','cod.g.credits':'кредитів: {n}','cod.g.pkgHint':'Лише пакети для типів ваших затверджених моделей','cod.g.qtyHint':'Від 1 до 10 000','cod.g.qtyErr':'Вкажіть ціле число від 1 до 10 000','cod.g.labelPh':'Напр., Для виставки Solar 2026','cod.g.do':'Згенерувати','cod.g.noModels':'Спершу потрібна затверджена модель: тип пакета (Light чи Standard) визначається моделлю.','cod.g.toCatalog':'До каталогу','cod.g.log':'Згенеровано {n} {w} ({p})','cod.g.toast':'Згенеровано {n} {w} · {p}',
'cod.h.title':'Видати коди','cod.h.fromBatch':'З партії від {d} · {p}','cod.h.free':'вільних {n}','cod.h.qtyHint':'Доступно до {n}','cod.h.qtyErr':'Вкажіть ціле число від 1','cod.h.qtyMax':'Вільних кодів цього пакета лише {n}','cod.h.do':'Видати','cod.h.noFreeT':'Немає вільних кодів','cod.h.noFreeP':'Згенеруйте нову партію — це безкоштовно.','cod.h.doneT':'Коди для «{r}»','cod.h.doneP':'{n} {w} ({p}) закріплено за «{r}».','cod.h.listL':'Список кодів','cod.h.send':'Надішліть цей список точці продажу. Кожен код спрацює один раз.','cod.h.copy':'Копіювати список','cod.h.toRes':'До точки продажу','cod.h.log':'Видано {n} {w} ({p}) — {r}',
'cod.simAct':'Імітувати активацію клієнтом','cod.simActShort':'Активувати пакет (демо)',
'cod.a.title':'Імітувати активацію клієнтом','cod.a.demoNote':'Демо: так клієнт вводить код у кабінеті. Діють ті самі правила, що й у реальній системі.','cod.a.code':'Виданий код','cod.a.pick':'Виберіть код…','cod.a.noAssigned':'Немає виданих кодів','cod.a.paste':'Або вставте будь-який код','cod.a.pasteHint':'Має пріоритет над вибраним вище','cod.a.sim':'SIM (активна, без пакета)','cod.a.simHint':'Усього таких SIM: {n}','cod.a.noSims':'Немає активних SIM без пакета. Спершу імітуйте встановлення.','cod.a.do':'Активувати','cod.a.log':'Код {c} ({p}) активовано на SIM {s}','cod.a.toast':'Пакет {p} активовано на SIM {s}',
'cod.e.title':'Активацію відхилено','cod.e.none':'Виберіть або вставте код.','cod.e.invalid':'Це не код активації — перевірте, чи немає помилок.','cod.e.prefix':'Код належить іншому партнеру (префікс {p}, ваш — {m}).','cod.e.unknown':'Такого коду немає серед згенерованих у вашому кабінеті.','cod.e.used':'Код уже використано {d} на SIM {s}.','cod.e.noSim':'Виберіть SIM.','cod.e.simInactive':'SIM не в мережі.','cod.e.simHasPkg':'На цій SIM уже є пакет {p}.','cod.e.notApproved':'Модель {m} ще не затверджена.','cod.e.plan':'Код для пакета {c}, а модель {m} працює на {mp}.','cod.e.credits':'Закінчились кредити пакета {p}. Код залишається дійсним — активація пройде після поповнення.','cod.e.topUp':'Поповнити кредити пакетів',
'cod.r.title':'Точки продажу','cod.r.sub':'Монтажники, магазини й філії, яким ви видаєте коди активації.','cod.r.new':'Нова точка продажу','cod.r.editT':'Змінити точку продажу','cod.r.emptyT':'Ще немає точок продажу','cod.r.emptyP':'Додайте монтажника, магазин чи філію — і видайте їм коди.',
'cod.r.name':'Назва','cod.r.namePh':'Напр., СолярМонтаж Київ','cod.r.nameErr':'Вкажіть назву','cod.r.dup':'Точка з такою назвою вже є','cod.r.type':'Тип','cod.r.city':'Місто','cod.r.contact':'Контакт','cod.r.contactPh':'Телефон або e-mail','cod.r.given':'Видано','cod.r.rate':'Конверсія','cod.r.last':'Остання активація',
'cod.rt.installer':'Монтажник','cod.rt.shop':'Магазин','cod.rt.branch':'Філія','cod.rt.dealer':'Дилер',
'cod.r.k.count':'Точок продажу','cod.r.k.given':'Видано кодів','cod.r.k.act':'Активовано','cod.r.k.rate':'Конверсія','cod.r.k.given1':'Видано кодів','cod.r.k.left':'Залишок','cod.r.k.leftS':'ще не активовані','cod.r.lastAt':'остання {d}',
'cod.r.codes':'Коди цієї точки','cod.r.noCodesT':'Кодів ще не видано','cod.r.noCodesP':'Видайте коди — вони з’являться тут.','cod.r.handMore':'Видати ще','cod.r.takeBack':'Забрати невикористані','cod.r.takeBackT':'Забрати невикористані коди','cod.r.takeBackP':'Невикористані коди точки {r} ({n}) повернуться у вільні.','cod.r.takeBackNote':'Попередьте точку продажу: ці коди більше не будуть закріплені за нею.','cod.r.takeBackDo':'Забрати {n}','cod.r.nothingBack':'Невикористаних кодів немає','cod.r.backToast':'Повернуто {n} {w} від «{r}»','cod.r.logBack':'Повернуто {n} {w} від «{r}»',
'cod.r.delT':'Видалити точку продажу','cod.r.delP':'Видалити {r}? Це не можна скасувати.','cod.r.delCodes':'Невикористані коди ({n}) повернуться у вільні.','cod.r.delNo':'Цю точку не можна видалити: через неї вже були активації ({n}), і ця історія потрібна для звітів. Можна забрати невикористані коди.','cod.r.deleted':'«{n}» видалено','cod.r.logDel':'Видалено точку продажу «{n}»','cod.r.created':'«{n}» додано','cod.r.saved':'«{n}» збережено','cod.r.logNew':'Додано точку продажу «{n}»','cod.r.notFound':'Точку продажу не знайдено','cod.w.one':'код','cod.w.few':'коди','cod.w.many':'кодів','cod.w.other':'коду'},
en:{
'sim.nav':'SIM cards','sim.title':'SIM cards','sim.sub':'All your SIM cards: what’s in the warehouse, what’s working in devices and what needs attention.',
'sim.demo':'Demo','sim.simInstall':'Simulate installation','sim.simLink':'Simulate customer linking','sim.export':'Export','sim.orderMore':'SIM shipments',
'sim.emptyT':'No SIM cards yet','sim.emptyP':'Cards show up here as soon as you confirm receipt of a SIM shipment from OTA.',
'sim.k.stock':'In warehouse','sim.k.active':'Active','sim.k.blocked':'Blocked','sim.k.pkg':'With package','sim.k.linked':'Linked by customer','sim.k.ofAll':'of all','sim.k.activeS':'online in devices','sim.k.blockedS':'IMEI not in whitelist','sim.k.blockedNone':'all good','sim.k.ofActive':'of active',
'sim.f.search':'ICCID or IMEI','sim.f.model':'Model','sim.f.allModels':'All models','sim.f.pkg':'Package','sim.f.allPkgs':'All packages','sim.f.noPkg':'No package','sim.f.anyPkg':'Any package','sim.f.reset':'Reset',
'sim.st.stock':'In warehouse','sim.st.active':'Online','sim.st.activeShort':'Active','sim.st.blocked':'Blocked','sim.st.blockedLong':'Blocked: IMEI not in whitelist',
'sim.c.device':'Device','sim.c.pkg':'Package','sim.c.customer':'Customer','sim.c.seen':'Last seen','sim.until':'until {d}','sim.noPkg':'No package','sim.linked':'Linked','sim.notLinked':'Not linked',
'sim.nothingP':'Try another search or reset the filters.','sim.blockedNote':'{n} SIMs are blocked: they were inserted into devices whose IMEI isn’t in any model’s whitelist.','sim.showBlocked':'Show them',
'sim.justNow':'just now','sim.copyIccid':'Copy ICCID',
'sim.ev.in_stock':'Arrived at warehouse','sim.ev.order':'Shipment {n}','sim.ev.installed':'Installed in a device','sim.ev.linked':'Customer linked the SIM','sim.ev.linkedS':'In the customer portal','sim.ev.package':'Package activated','sim.ev.blocked':'Blocked','sim.ev.blockedS':'IMEI {imei} isn’t in any approved model’s whitelist','sim.ev.whitelisted':'IMEI added to whitelist','sim.ev.whitelistedS':'Model {m} — SIM went online',
'sim.d.title':'SIM','sim.d.code':'Activation code','sim.d.order':'Shipment','sim.d.history':'History','sim.d.blockedT':'Why this SIM is blocked','sim.d.blockedP':'It was inserted into a device with IMEI {imei}, which isn’t in the whitelist of any approved model. If it’s your device, add the IMEI to a whitelist and the SIM will start working.','sim.d.stockP':'This card is in your warehouse and hasn’t been inserted into a device yet.','sim.d.noPkgP':'The SIM is online, but no package is active yet: the customer needs to enter an activation code.','sim.d.addWl':'Add this IMEI to a model’s whitelist',
'sim.wl.title':'Add IMEI to a model’s whitelist','sim.wl.p':'IMEI {imei} will be added to the selected model’s whitelist and the SIM will go online right away.','sim.wl.model':'Model','sim.wl.hint':'Approved models only','sim.wl.note':'Only add IMEIs of your own devices. The customer then activates a package with a code.','sim.wl.do':'Add and bring online','sim.wl.none':'No approved models yet. Add a model and wait for approval.','sim.wl.toCatalog':'Go to catalog','sim.wl.log':'IMEI {imei} added to {m}; SIM {iccid} online','sim.wl.toast':'IMEI added to {m} — SIM is online',
'sim.ex.title':'Export SIM cards','sim.ex.p':'{n} rows for the current filters. Copy and paste into Excel or Google Sheets.','sim.ex.cut':'{n} found; only the first {m} are included. Narrow the filters to get the rest.','sim.ex.copy':'Copy CSV',
'sim.in.title':'Simulate installation','sim.in.demoNote':'Demo: this is what a real SIM coming online in a device looks like.','sim.in.p':'Uses the first SIM in the warehouse ({n} available).','sim.in.model':'Device model','sim.in.imei':'Device IMEI','sim.in.wl':'IMEI from the model’s whitelist','sim.in.wlS':'The SIM will go online','sim.in.rnd':'Random IMEI not in any whitelist','sim.in.rndS':'The SIM will be blocked','sim.in.custom':'Enter IMEI manually','sim.in.do':'Install SIM','sim.in.noStock':'There are no SIMs in the warehouse.','sim.in.noModels':'No approved models with an IMEI whitelist.','sim.in.allUsed':'All IMEIs of this model are already in use.','sim.in.badImei':'An IMEI is 15 digits with a valid check digit.','sim.in.usedImei':'Another SIM already uses this IMEI.','sim.in.logOk':'SIM {iccid} installed in {m}','sim.in.logBad':'SIM {iccid} blocked: IMEI {imei} not in whitelist','sim.in.toastOk':'SIM {iccid} is online in {m}','sim.in.toastBad':'SIM {iccid} blocked: IMEI not in whitelist',
'sim.ln.none':'No active unlinked SIMs','sim.ln.log':'Customer linked SIM {iccid}','sim.ln.toast':'Customer linked SIM {iccid}',
'cod.nav':'Activation codes','cod.rnav':'Points of sale','cod.title':'Activation codes','cod.sub':'Package credits, code batches and who has which codes.',
'cod.explain':'Codes are free and unlimited — give your resellers as many as they need. Each real activation uses one credit of that package. If credits run out, activations wait until you top up.',
'cod.cr.avail':'available','cod.cr.bought':'Bought','cod.cr.used':'Used','cod.cr.buy':'Buy more','cod.cr.empty':'Used up','cod.cr.low':'Low','cod.cr.out':'Handed out, not activated: {n}','cod.cr.outWarn':'Handed out, not activated: {n} — more than credits left','cod.cr.noneT':'No package credits yet','cod.cr.noneP':'Credits let customers activate packages. Add them to an order.',
'cod.b.title':'Code batches','cod.b.created':'Created','cod.b.label':'Label','cod.b.qty':'Codes','cod.b.emptyT':'No codes yet','cod.b.emptyP':'Generate your first batch — it’s free.',
'cod.gen':'Generate codes','cod.hand':'Hand out codes','cod.handShort':'Hand out','cod.list':'Codes','cod.sum':'Free {f} · handed out {a} · activated {x}','cod.nothingP':'Change the filters or search.','cod.copyCode':'Copy code',
'cod.st.free':'Free','cod.st.assigned':'Handed out','cod.st.activated':'Activated',
'cod.c.code':'Code','cod.c.pkg':'Package','cod.c.reseller':'Reseller','cod.c.activated':'Activation',
'cod.f.search':'Code or ICCID','cod.f.allSt':'All statuses','cod.f.allRes':'All resellers','cod.f.noRes':'Not handed out','cod.f.batch':'Batch',
'cod.g.title':'Generate codes','cod.g.p':'Codes are free. A credit is used only when a customer activates a package.','cod.g.credits':'{n} credits','cod.g.pkgHint':'Only packages for the plans of your approved models','cod.g.qtyHint':'From 1 to 10,000','cod.g.qtyErr':'Enter a whole number from 1 to 10,000','cod.g.labelPh':'E.g. For Solar Expo 2026','cod.g.do':'Generate','cod.g.noModels':'You need an approved model first: the package plan (Light or Standard) comes from the model.','cod.g.toCatalog':'Go to catalog','cod.g.log':'Generated {n} {w} ({p})','cod.g.toast':'{n} {w} generated · {p}',
'cod.h.title':'Hand out codes','cod.h.fromBatch':'From the batch of {d} · {p}','cod.h.free':'{n} free','cod.h.qtyHint':'Up to {n} available','cod.h.qtyErr':'Enter a whole number, 1 or more','cod.h.qtyMax':'Only {n} free codes of this package','cod.h.do':'Hand out','cod.h.noFreeT':'No free codes','cod.h.noFreeP':'Generate a new batch — it’s free.','cod.h.doneT':'Codes for “{r}”','cod.h.doneP':'{n} {w} ({p}) assigned to “{r}”.','cod.h.listL':'Code list','cod.h.send':'Send this list to the reseller. Each code works once.','cod.h.copy':'Copy list','cod.h.toRes':'Open reseller','cod.h.log':'Handed out {n} {w} ({p}) to {r}',
'cod.simAct':'Simulate customer activation','cod.simActShort':'Activate package (demo)',
'cod.a.title':'Simulate customer activation','cod.a.demoNote':'Demo: this is how a customer enters a code in their portal. The same rules apply as in the real system.','cod.a.code':'Handed-out code','cod.a.pick':'Choose a code…','cod.a.noAssigned':'No handed-out codes','cod.a.paste':'Or paste any code','cod.a.pasteHint':'Takes priority over the selection above','cod.a.sim':'SIM (online, no package)','cod.a.simHint':'{n} such SIMs in total','cod.a.noSims':'No online SIMs without a package. Simulate an installation first.','cod.a.do':'Activate','cod.a.log':'Code {c} ({p}) activated on SIM {s}','cod.a.toast':'{p} activated on SIM {s}',
'cod.e.title':'Activation rejected','cod.e.none':'Choose or paste a code.','cod.e.invalid':'That isn’t an activation code — check for typos.','cod.e.prefix':'This code belongs to another partner (prefix {p}, yours is {m}).','cod.e.unknown':'This code was never generated in your account.','cod.e.used':'The code was already used on {d} for SIM {s}.','cod.e.noSim':'Choose a SIM.','cod.e.simInactive':'The SIM isn’t online.','cod.e.simHasPkg':'This SIM already has the {p} package.','cod.e.notApproved':'Model {m} isn’t approved yet.','cod.e.plan':'The code is for {c}, but model {m} uses {mp}.','cod.e.credits':'No {p} credits left. The code stays valid — the activation will go through once you top up.','cod.e.topUp':'Top up package credits',
'cod.r.title':'Points of sale','cod.r.sub':'Installers, shops and branches you give activation codes to.','cod.r.new':'New reseller','cod.r.editT':'Edit reseller','cod.r.emptyT':'No resellers yet','cod.r.emptyP':'Add an installer, shop or branch — then hand them codes.',
'cod.r.name':'Name','cod.r.namePh':'E.g. SolarMount Kyiv','cod.r.nameErr':'Enter a name','cod.r.dup':'A reseller with this name already exists','cod.r.type':'Type','cod.r.city':'City','cod.r.contact':'Contact','cod.r.contactPh':'Phone or email','cod.r.given':'Handed out','cod.r.rate':'Activation rate','cod.r.last':'Last activation',
'cod.rt.installer':'Installer','cod.rt.shop':'Shop','cod.rt.branch':'Branch','cod.rt.dealer':'Dealer',
'cod.r.k.count':'Resellers','cod.r.k.given':'Codes handed out','cod.r.k.act':'Activated','cod.r.k.rate':'Activation rate','cod.r.k.given1':'Codes given','cod.r.k.left':'Remaining','cod.r.k.leftS':'not activated yet','cod.r.lastAt':'last on {d}',
'cod.r.codes':'This reseller’s codes','cod.r.noCodesT':'No codes handed out yet','cod.r.noCodesP':'Hand out codes and they’ll show up here.','cod.r.handMore':'Hand out more','cod.r.takeBack':'Take back unused','cod.r.takeBackT':'Take back unused codes','cod.r.takeBackP':'{n} unused codes of {r} will go back to free.','cod.r.takeBackNote':'Let the reseller know: these codes will no longer be assigned to them.','cod.r.takeBackDo':'Take back {n}','cod.r.nothingBack':'No unused codes','cod.r.backToast':'{n} {w} taken back from “{r}”','cod.r.logBack':'Took back {n} {w} from “{r}”',
'cod.r.delT':'Delete reseller','cod.r.delP':'Delete {r}? This can’t be undone.','cod.r.delCodes':'{n} unused codes will go back to free.','cod.r.delNo':'This reseller can’t be deleted: {n} activations went through them and that history is needed for reports. You can take back their unused codes.','cod.r.deleted':'“{n}” deleted','cod.r.logDel':'Deleted reseller “{n}”','cod.r.created':'“{n}” added','cod.r.saved':'“{n}” saved','cod.r.logNew':'Added reseller “{n}”','cod.r.notFound':'Reseller not found','cod.w.one':'code','cod.w.few':'codes','cod.w.many':'codes','cod.w.other':'codes'},
ru:{
'sim.nav':'SIM-карты','sim.title':'SIM-карты','sim.sub':'Все ваши SIM-карты: что на складе, что уже работает в устройствах и что требует внимания.',
'sim.demo':'Демо','sim.simInstall':'Имитировать установку','sim.simLink':'Имитировать привязку клиентом','sim.export':'Экспорт','sim.orderMore':'Отгрузки SIM',
'sim.emptyT':'SIM-карт пока нет','sim.emptyP':'Карты появятся здесь, как только вы подтвердите получение отгрузки SIM от OTA.',
'sim.k.stock':'На складе','sim.k.active':'Активные','sim.k.blocked':'Заблокированные','sim.k.pkg':'С пакетом','sim.k.linked':'Привязаны клиентом','sim.k.ofAll':'от всех','sim.k.activeS':'онлайн в устройствах','sim.k.blockedS':'IMEI нет в списке','sim.k.blockedNone':'всё в порядке','sim.k.ofActive':'от активных',
'sim.f.search':'ICCID или IMEI','sim.f.model':'Модель','sim.f.allModels':'Все модели','sim.f.pkg':'Пакет','sim.f.allPkgs':'Все пакеты','sim.f.noPkg':'Без пакета','sim.f.anyPkg':'С любым пакетом','sim.f.reset':'Сбросить',
'sim.st.stock':'На складе','sim.st.active':'Онлайн','sim.st.activeShort':'Активные','sim.st.blocked':'Заблокированные','sim.st.blockedLong':'Заблокирована: IMEI нет в списке',
'sim.c.device':'Устройство','sim.c.pkg':'Пакет','sim.c.customer':'Клиент','sim.c.seen':'Последняя активность','sim.until':'до {d}','sim.noPkg':'Без пакета','sim.linked':'Привязана','sim.notLinked':'Не привязана',
'sim.nothingP':'Попробуйте другой запрос или сбросьте фильтры.','sim.blockedNote':'{n} SIM заблокировано: их вставили в устройства, IMEI которых нет ни в одном списке модели.','sim.showBlocked':'Показать',
'sim.justNow':'только что','sim.copyIccid':'Копировать ICCID',
'sim.ev.in_stock':'Поступила на склад','sim.ev.order':'Отгрузка {n}','sim.ev.installed':'Установлена в устройство','sim.ev.linked':'Клиент привязал SIM','sim.ev.linkedS':'В клиентском кабинете','sim.ev.package':'Активирован пакет','sim.ev.blocked':'Заблокирована','sim.ev.blockedS':'IMEI {imei} нет в списке ни одной утверждённой модели','sim.ev.whitelisted':'IMEI добавлен в список','sim.ev.whitelistedS':'Модель {m} — SIM вышла в сеть',
'sim.d.title':'SIM','sim.d.code':'Код активации','sim.d.order':'Отгрузка','sim.d.history':'История','sim.d.blockedT':'Почему SIM заблокирована','sim.d.blockedP':'Карту вставили в устройство с IMEI {imei}, которого нет в списке IMEI ни одной утверждённой модели. Если это ваше устройство — добавьте IMEI в список, и SIM заработает.','sim.d.stockP':'Карта на вашем складе и ещё не вставлена в устройство.','sim.d.noPkgP':'SIM работает, но пакет ещё не активирован: клиент должен ввести код активации.','sim.d.addWl':'Добавить этот IMEI в список модели',
'sim.wl.title':'Добавить IMEI в список модели','sim.wl.p':'IMEI {imei} будет добавлен в список выбранной модели, и SIM сразу выйдет в сеть.','sim.wl.model':'Модель','sim.wl.hint':'Только утверждённые модели','sim.wl.note':'Добавляйте только IMEI своих устройств. Пакет затем активирует клиент кодом.','sim.wl.do':'Добавить и включить','sim.wl.none':'Нет утверждённых моделей. Добавьте модель и дождитесь утверждения.','sim.wl.toCatalog':'В каталог','sim.wl.log':'IMEI {imei} добавлен в модель {m}; SIM {iccid} онлайн','sim.wl.toast':'IMEI добавлен в {m} — SIM онлайн',
'sim.ex.title':'Экспорт SIM-карт','sim.ex.p':'{n} строк по текущим фильтрам. Скопируйте и вставьте в Excel или Google Таблицы.','sim.ex.cut':'Найдено {n}, в файл войдут первые {m}. Сузьте фильтры, чтобы получить остальные.','sim.ex.copy':'Копировать CSV',
'sim.in.title':'Имитировать установку','sim.in.demoNote':'Демо: так будет выглядеть реальное подключение SIM в устройстве к сети.','sim.in.p':'Берётся первая SIM со склада (доступно {n}).','sim.in.model':'Модель устройства','sim.in.imei':'IMEI устройства','sim.in.wl':'IMEI из списка модели','sim.in.wlS':'SIM выйдет в сеть','sim.in.rnd':'Случайный IMEI вне списка','sim.in.rndS':'SIM будет заблокирована','sim.in.custom':'Ввести IMEI вручную','sim.in.do':'Установить SIM','sim.in.noStock':'На складе нет SIM-карт.','sim.in.noModels':'Нет утверждённых моделей со списком IMEI.','sim.in.allUsed':'Все IMEI этой модели уже используются.','sim.in.badImei':'IMEI — 15 цифр с правильной контрольной цифрой.','sim.in.usedImei':'Этот IMEI уже использует другая SIM.','sim.in.logOk':'SIM {iccid} установлена в {m}','sim.in.logBad':'SIM {iccid} заблокирована: IMEI {imei} вне списка','sim.in.toastOk':'SIM {iccid} онлайн в {m}','sim.in.toastBad':'SIM {iccid} заблокирована: IMEI нет в списке',
'sim.ln.none':'Нет активных SIM без привязки','sim.ln.log':'Клиент привязал SIM {iccid}','sim.ln.toast':'Клиент привязал SIM {iccid}',
'cod.nav':'Коды активации','cod.rnav':'Точки продаж','cod.title':'Коды активации','cod.sub':'Кредиты пакетов, партии кодов и у кого какие коды.',
'cod.explain':'Коды бесплатны и без ограничений — давайте точкам продаж сколько нужно. Каждая реальная активация списывает один кредит соответствующего пакета. Если кредиты закончатся, активации будут ждать, пока вы не пополните.',
'cod.cr.avail':'доступно','cod.cr.bought':'Куплено','cod.cr.used':'Использовано','cod.cr.buy':'Докупить','cod.cr.empty':'Закончились','cod.cr.low':'Мало','cod.cr.out':'Выдано и не активировано: {n}','cod.cr.outWarn':'Выдано и не активировано: {n} — больше, чем кредитов','cod.cr.noneT':'Кредитов пакетов пока нет','cod.cr.noneP':'Кредиты нужны, чтобы клиенты могли активировать пакеты. Добавьте их в заказ.',
'cod.b.title':'Партии кодов','cod.b.created':'Создано','cod.b.label':'Примечание','cod.b.qty':'Кодов','cod.b.emptyT':'Кодов пока нет','cod.b.emptyP':'Сгенерируйте первую партию — это бесплатно.',
'cod.gen':'Сгенерировать коды','cod.hand':'Выдать коды','cod.handShort':'Выдать','cod.list':'Коды','cod.sum':'Свободные {f} · выданные {a} · активированные {x}','cod.nothingP':'Измените фильтры или поиск.','cod.copyCode':'Копировать код',
'cod.st.free':'Свободные','cod.st.assigned':'Выданные','cod.st.activated':'Активированные',
'cod.c.code':'Код','cod.c.pkg':'Пакет','cod.c.reseller':'Точка продаж','cod.c.activated':'Активация',
'cod.f.search':'Код или ICCID','cod.f.allSt':'Все статусы','cod.f.allRes':'Все точки','cod.f.noRes':'Не выданы','cod.f.batch':'Партия',
'cod.g.title':'Сгенерировать коды','cod.g.p':'Коды бесплатны. Кредит списывается, только когда клиент активирует пакет.','cod.g.credits':'кредитов: {n}','cod.g.pkgHint':'Только пакеты для типов ваших утверждённых моделей','cod.g.qtyHint':'От 1 до 10 000','cod.g.qtyErr':'Укажите целое число от 1 до 10 000','cod.g.labelPh':'Напр., Для выставки Solar 2026','cod.g.do':'Сгенерировать','cod.g.noModels':'Сначала нужна утверждённая модель: тип пакета (Light или Standard) определяется моделью.','cod.g.toCatalog':'В каталог','cod.g.log':'Сгенерировано {n} {w} ({p})','cod.g.toast':'Сгенерировано {n} {w} · {p}',
'cod.h.title':'Выдать коды','cod.h.fromBatch':'Из партии от {d} · {p}','cod.h.free':'свободных {n}','cod.h.qtyHint':'Доступно до {n}','cod.h.qtyErr':'Укажите целое число от 1','cod.h.qtyMax':'Свободных кодов этого пакета только {n}','cod.h.do':'Выдать','cod.h.noFreeT':'Нет свободных кодов','cod.h.noFreeP':'Сгенерируйте новую партию — это бесплатно.','cod.h.doneT':'Коды для «{r}»','cod.h.doneP':'{n} {w} ({p}) закреплено за «{r}».','cod.h.listL':'Список кодов','cod.h.send':'Отправьте этот список точке продаж. Каждый код сработает один раз.','cod.h.copy':'Копировать список','cod.h.toRes':'К точке продаж','cod.h.log':'Выдано {n} {w} ({p}) — {r}',
'cod.simAct':'Имитировать активацию клиентом','cod.simActShort':'Активировать пакет (демо)',
'cod.a.title':'Имитировать активацию клиентом','cod.a.demoNote':'Демо: так клиент вводит код в кабинете. Действуют те же правила, что и в реальной системе.','cod.a.code':'Выданный код','cod.a.pick':'Выберите код…','cod.a.noAssigned':'Нет выданных кодов','cod.a.paste':'Или вставьте любой код','cod.a.pasteHint':'Имеет приоритет над выбранным выше','cod.a.sim':'SIM (активная, без пакета)','cod.a.simHint':'Всего таких SIM: {n}','cod.a.noSims':'Нет активных SIM без пакета. Сначала имитируйте установку.','cod.a.do':'Активировать','cod.a.log':'Код {c} ({p}) активирован на SIM {s}','cod.a.toast':'Пакет {p} активирован на SIM {s}',
'cod.e.title':'Активация отклонена','cod.e.none':'Выберите или вставьте код.','cod.e.invalid':'Это не код активации — проверьте, нет ли ошибок.','cod.e.prefix':'Код принадлежит другому партнёру (префикс {p}, ваш — {m}).','cod.e.unknown':'Такого кода нет среди сгенерированных в вашем кабинете.','cod.e.used':'Код уже использован {d} на SIM {s}.','cod.e.noSim':'Выберите SIM.','cod.e.simInactive':'SIM не в сети.','cod.e.simHasPkg':'На этой SIM уже есть пакет {p}.','cod.e.notApproved':'Модель {m} ещё не утверждена.','cod.e.plan':'Код для пакета {c}, а модель {m} работает на {mp}.','cod.e.credits':'Закончились кредиты пакета {p}. Код остаётся действительным — активация пройдёт после пополнения.','cod.e.topUp':'Пополнить кредиты пакетов',
'cod.r.title':'Точки продаж','cod.r.sub':'Монтажники, магазины и филиалы, которым вы выдаёте коды активации.','cod.r.new':'Новая точка продаж','cod.r.editT':'Изменить точку продаж','cod.r.emptyT':'Точек продаж пока нет','cod.r.emptyP':'Добавьте монтажника, магазин или филиал — и выдайте им коды.',
'cod.r.name':'Название','cod.r.namePh':'Напр., СолярМонтаж Киев','cod.r.nameErr':'Укажите название','cod.r.dup':'Точка с таким названием уже есть','cod.r.type':'Тип','cod.r.city':'Город','cod.r.contact':'Контакт','cod.r.contactPh':'Телефон или e-mail','cod.r.given':'Выдано','cod.r.rate':'Конверсия','cod.r.last':'Последняя активация',
'cod.rt.installer':'Монтажник','cod.rt.shop':'Магазин','cod.rt.branch':'Филиал','cod.rt.dealer':'Дилер',
'cod.r.k.count':'Точек продаж','cod.r.k.given':'Выдано кодов','cod.r.k.act':'Активировано','cod.r.k.rate':'Конверсия','cod.r.k.given1':'Выдано кодов','cod.r.k.left':'Остаток','cod.r.k.leftS':'ещё не активированы','cod.r.lastAt':'последняя {d}',
'cod.r.codes':'Коды этой точки','cod.r.noCodesT':'Коды ещё не выданы','cod.r.noCodesP':'Выдайте коды — они появятся здесь.','cod.r.handMore':'Выдать ещё','cod.r.takeBack':'Забрать неиспользованные','cod.r.takeBackT':'Забрать неиспользованные коды','cod.r.takeBackP':'Неиспользованные коды точки {r} ({n}) вернутся в свободные.','cod.r.takeBackNote':'Предупредите точку продаж: эти коды больше не будут закреплены за ней.','cod.r.takeBackDo':'Забрать {n}','cod.r.nothingBack':'Неиспользованных кодов нет','cod.r.backToast':'Возвращено {n} {w} от «{r}»','cod.r.logBack':'Возвращено {n} {w} от «{r}»',
'cod.r.delT':'Удалить точку продаж','cod.r.delP':'Удалить {r}? Это нельзя отменить.','cod.r.delCodes':'Неиспользованные коды ({n}) вернутся в свободные.','cod.r.delNo':'Эту точку нельзя удалить: через неё уже были активации ({n}), и эта история нужна для отчётов. Можно забрать неиспользованные коды.','cod.r.deleted':'«{n}» удалена','cod.r.logDel':'Удалена точка продаж «{n}»','cod.r.created':'«{n}» добавлена','cod.r.saved':'«{n}» сохранено','cod.r.logNew':'Добавлена точка продаж «{n}»','cod.r.notFound':'Точка продаж не найдена','cod.w.one':'код','cod.w.few':'кода','cod.w.many':'кодов','cod.w.other':'кода'}});

I18N.add({uk:{'sim.f.res':'Точка продажу','sim.f.allRes':'Усі точки продажу','sim.f.noRes':'На вашому складі','sim.f.noResShort':'Ваш склад','sim.c.res':'Де карта','sim.ev.toRes':'Передано точці продажу','sim.ev.fromRes':'Повернуто на ваш склад'},
en:{'sim.f.res':'Point of sale','sim.f.allRes':'All points of sale','sim.f.noRes':'In your warehouse','sim.f.noResShort':'Your warehouse','sim.c.res':'Location','sim.ev.toRes':'Handed to a point of sale','sim.ev.fromRes':'Returned to your warehouse'},
ru:{'sim.f.res':'Точка продаж','sim.f.allRes':'Все точки продаж','sim.f.noRes':'На вашем складе','sim.f.noResShort':'Ваш склад','sim.c.res':'Где карта','sim.ev.toRes':'Передано точке продаж','sim.ev.fromRes':'Возвращено на ваш склад'}});
