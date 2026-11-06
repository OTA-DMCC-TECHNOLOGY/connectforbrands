/* ===== 50_pricing: per-country price lists (prc_) + Revenue calculator (calc_) =====
   OTA sets, per country, a versioned price list (USD, net): Activation Key, Service Tokens 3 plans × 5 terms,
   OTA Retained Amount per paid month (direct subscriptions) and a country compliance fee 0–3%. */
const prc_sec=()=>t('prc.sec');
function prc_cc(){const ccs=orgCountries();const c=S.ui.prc_cc;return ccs.includes(c)?c:ccs[0];}
function prc_num(v){const s=String(v==null?'':v).replace(/[\s  ]/g,'').replace(',','.');if(!/^-?\d*\.?\d+$/.test(s))return NaN;return parseFloat(s);}
function prc_vStatus(v){if(v.status==='withdrawn')return 'withdrawn';const cur=priceList(v.cc||prc_curCc);if(cur&&v.ver===cur.ver)return 'current';if(cur&&v.ver>cur.ver)return plAwaitingSign(v)?'awaiting':'pending';return 'past';}
let prc_curCc='UA';
function prc_vBadge(v){const s=prc_vStatus(v);return ui.badge(t('prc.v.'+s),s==='current'?'ok':s==='pending'||s==='awaiting'?'warn':'',s==='current');}
nav({key:'prices',label:()=>t('prc.nav'),icon:'price',href:'#prices',order:70,section:prc_sec});
nav({key:'calculator',label:()=>t('calc.nav'),icon:'calc',href:'#calculator',order:71,section:prc_sec});

function prc_table(v,prev){const cols=[{label:t('prc.plan')}].concat(TERMS.map(m=>({label:termLabel(m),cls:'r'})));
 const rows=PLANS.map(p=>({cells:[`<div class="col g4 prc_pcol"><b>${PLAN_NAME[p]}</b><span class="xs faint">${t('prc.ret')} ${money(v.retained[p],'USD')}${t('prc.perMoShort')}</span></div>`].concat(TERMS.map(tm=>{const x=v.tokens[p][tm];const o=prev&&prev.tokens[p][tm];const ch=o!=null&&Math.abs(x-o)>0.004;
  return `<div class="col g4 prc_cell"><span class="num"><b>${money(x,'USD')}</b></span>${ch?ui.badge((x>o?'+':'−')+pct(Math.abs(x-o)/o,1),x>o?'warn':'ok'):''}<span class="xs faint">${money(r2(x/tm),'USD')} ${t('prc.perMo')}</span></div>`;}))}));
 return ui.table(cols,rows);}
route('prices',{nav:'prices',render(){
 const ccs=orgCountries();const cc=prc_cc();prc_curCc=cc;const v=priceList(cc);const pend=plPending(cc);
 const seg=ccs.length>1?`<div class="col g4"><span class="small muted">${t('prc.country')}</span>${ui.seg('prc_ccseg',ccs.map(c=>[c,esc(ctyName(c))]),cc,'prc_cc')}</div>`:'';
 if(!v)return ui.page({title:t('prc.title'),sub:t('prc.sub'),body:`<div class="stack">${seg}${ui.card({body:ui.empty('price',t('prc.noPl'),t('prc.noPlP'),'')})}${S.admin?prc_adminCard(cc):''}</div>`});
 const head=`<div class="row between wrap g12">${seg}<span class="xs faint">${t('prc.verLine',{v:v.ver,d:fmtDate(v.from)})} · ${t('prc.usdNet')}</span></div>`;
 const pendNote=pend.map(p=>ui.note('warn',`<b>${t(plAwaitingSign(p)?'prc.pendSign':'prc.pendT',{d:fmtDate(p.from),v:p.ver})}</b> ${t(p.increase?'prc.pendInc':'prc.pendDec')} <a href="#" data-act="prc_showVer" data-arg="${esc(cc+'|'+p.ver)}">${t('prc.seeChanges')}</a>`,'clock')).join('');
 const keyCard=`<section class="card prc_sim"><div class="bd row g16 wrap"><span class="prc_ic">${icon('key','lg')}</span>
  <div class="grow col g4"><h2 class="prc_h2">${t('prc.keyTitle')}</h2><p class="muted small">${t('prc.keyText')}</p></div>
  <div class="col g4 prc_simv"><span class="prc_big num">${money(v.key,'USD')}</span><span class="xs faint">${t('prc.perKey')}</span></div></div></section>`;
 const tokCard=ui.card({title:t('prc.tokTitle'),actions:`<span class="xs faint">${t('prc.tokValid')}</span>`,pad:false,body:prc_table(v)+`<div class="bd prc_expl grid3"><div class="col g4"><b>Light</b><p class="muted small">${t('prc.desc.light')}</p></div><div class="col g4"><b>Standard</b><p class="muted small">${t('prc.desc.std')}</p></div><div class="col g4"><b>Premium</b><p class="muted small">${t('prc.desc.prem')}</p></div></div>`});
 const fee=v.fee||0;const ret=PLANS.map(p=>`<dt>${PLAN_NAME[p]}</dt><dd class="num">${money(v.retained[p],'USD')} ${t('prc.perPaidMo')}</dd>`).join('');
 const comCard=ui.card({title:t('prc.comTitle'),body:`<div class="stack"><p class="small muted">${t('prc.comP')}</p>
  <div class="prc_formula">${t('prc.formula')}</div>
  <div class="grid2" style="align-items:start"><dl class="dl ord_dl"><dt class="small"><b>${t('prc.retTitle')}</b></dt><dd></dd>${ret}</dl><dl class="dl ord_dl"><dt>${t('prc.fee')}</dt><dd class="num">${pct(fee,1)}</dd><dt>${t('prc.rs')}</dt><dd>${t('prc.rsD')}</dd></dl></div>
  ${ui.note('info',t('prc.comEx',{r:money(retainedAmt('std',cc),'USD')}))}</div>`});
 const hist=plVersions(cc).slice().reverse().concat(((S.priceLists||{})[cc]||[]).filter(x=>x.status==='withdrawn'));
 const histCard=ui.card({title:t('prc.hist.title'),pad:false,body:ui.table([{label:t('prc.v.col')},{label:t('prc.v.from')},{label:t('prc.keyShort'),cls:'r'},{label:'Standard · '+termLabel(24),cls:'r'},{label:t('c.status')},{label:''}],
  hist.map(x=>({cells:[`<b class="num">v${x.ver}</b>${x.increase?' '+ui.badge(t('prc.inc'),'warn'):''}`,`<span class="ord_nw">${fmtDate(x.from)}</span>`,`<span class="num">${money(x.key,'USD')}</span>`,`<span class="num">${money(x.tokens.std[24],'USD')}</span>`,prc_vBadge(x),ui.btn(t('prc.view'),{size:'sm',kind:'ghost',act:'prc_showVer',arg:cc+'|'+x.ver})]})))});
 const ms=allModels();
 const mrows=ms.map(({brand,model})=>({href:link('model',model.id),cells:[`<b>${esc(brand.name)}</b> <span class="faint">·</span> ${esc(model.name)}`,model.planStatus==='approved'&&model.plan?ui.badge(PLAN_NAME[model.plan],model.plan==='std'?'accent':'info',true):ui.badge(t('prc.review'),'warn',true),model.planStatus==='approved'&&model.plan?`<span class="num">${money(v.tokens[model.plan][24],'USD')}</span> <span class="xs faint">/ ${termLabel(24)}</span>`:'<span class="faint">—</span>']}));
 const modelsCard=ui.card({title:t('prc.models'),pad:false,body:ms.length?ui.table([{label:t('prc.model')},{label:t('prc.plan')},{label:t('prc.from24'),cls:'r'}],mrows):ui.empty('box',t('prc.noModels'),t('prc.noModelsT'),ui.btn(t('prc.addModel'),{kind:'primary',href:'#catalog',icon:'plus'}))});
 return ui.page({title:t('prc.title'),sub:t('prc.sub'),actions:ui.btn(t('prc.toCalc'),{href:'#calculator',icon:'calc'}),
  body:`<div class="stack">${head}${pendNote}${S.admin?prc_adminCard(cc):''}${keyCard}${tokCard}${comCard}${histCard}${modelsCard}</div>`});}});

/* ---------- OTA: price list editor (new version) ---------- */
function prc_adminCard(cc){const base=plLatest(cc)||Object.assign({ver:0},plSeed(cc));const mn=orgMin();const ed=can('ota.prices');
 const inp=(id,val,unit,lbl)=>`<div class="prc_inw"><input class="inp num" id="${id}" name="${id}" type="text" inputmode="decimal" value="${esc(val)}" aria-label="${esc(lbl)}" ${ed?'':'disabled'}><span class="prc_unit" aria-hidden="true">${unit}</span></div>`;
 const rows=PLANS.map(p=>`<tr><th scope="row"><b>${PLAN_NAME[p]}</b></th>${TERMS.map(tm=>`<td>${inp('pl_t_'+p+'_'+tm,base.tokens[p][tm],'$',PLAN_NAME[p]+' '+termLabel(tm))}</td>`).join('')}<td>${inp('pl_r_'+p,base.retained[p],'$',t('prc.ret')+' '+PLAN_NAME[p])}</td></tr>`).join('');
 return `<section class="card prc_admin"><form data-form="prc_pl" novalidate><input type="hidden" name="cc" value="${esc(cc)}">
  <div class="hd"><h2 class="row g8">${icon('shield','sm')}${t('prc.adm.title',{c:esc(ctyName(cc))})}</h2>${ui.badge('OTA','violet')}</div>
  <div class="bd stack">${ui.note('admin',t('prc.adm.note3',{v:base.ver}))}${ed?'':ord_noPerm('ota.prices')+' '+ord_asBtn('ota_admin')}
   <div class="grid3">${ui.field({id:'pl_key',label:t('prc.keyShort')+', USD',value:base.key,attrs:ed?'inputmode="decimal"':'disabled'})}${ui.field({id:'pl_fee',label:t('prc.fee')+', %',value:r2((base.fee||0)*100),attrs:ed?'inputmode="decimal"':'disabled',hint:'0–3%'})}${ui.field({id:'pl_from',label:t('prc.v.from'),type:'date',value:iso(now()).slice(0,10),attrs:ed?'':'disabled',hint:t('prc.adm.fromH')})}</div>
   <div class="tblwrap"><table class="tbl prc_atbl"><thead><tr><th scope="col">${t('prc.plan')}</th>${TERMS.map(tm=>`<th scope="col">${termLabel(tm)}</th>`).join('')}<th scope="col">${t('prc.ret')}</th></tr></thead><tbody>${rows}</tbody></table></div>
   ${ui.field({id:'pl_note',label:t('prc.adm.noteF'),hint:t('c.optional'),attrs:ed?'maxlength="160"':'disabled'})}
   <div class="grid2">${ui.field({id:'prc_minFirst',label:t('prc.adm.minFirst'),type:'number',value:mn.first,attrs:'min="1" step="1" inputmode="numeric" '+(ed?'':'disabled'),hint:t('prc.adm.minFirstH')})}${ui.field({id:'prc_minNext',label:t('prc.adm.minNext'),type:'number',value:mn.next,attrs:'min="1" step="1" inputmode="numeric" '+(ed?'':'disabled'),hint:t('prc.adm.minNextH')})}</div>
   <div id="prc_plMsg" role="alert"></div></div>
  <div class="ft">${ui.btn(t('prc.adm.seed'),{act:'prc_seedFill',kind:'ghost',disabled:!ed})}${ui.btn(t('prc.adm.save'),{kind:'primary',type:'submit',icon:'check',disabled:!ed})}</div></form></section>`;}
FORM.prc_pl=f=>{if(!can('ota.prices'))return;clearErrs(f);const d=formData(f);const cc=d.cc;let bad=false;const num=(id,min,max)=>{const n=prc_num(d[id]);if(!(n>=min)||n>max){setErr(f,id,t('prc.err.price'));bad=true;return 0;}return r2(n);};
 const data={key:num('pl_key',0.01,1e5),tokens:{},retained:{},fee:0};PLANS.forEach(p=>{data.tokens[p]={};TERMS.forEach(tm=>{data.tokens[p][tm]=num('pl_t_'+p+'_'+tm,0.01,1e6);});data.retained[p]=num('pl_r_'+p,0,1e5);});
 const fee=prc_num(d.pl_fee);if(!(fee>=0&&fee<=3)){setErr(f,'pl_fee',t('prc.err.fee'));bad=true;}else data.fee=r2(fee)/100;
 const mf=Number(d.prc_minFirst),mx=Number(d.prc_minNext);
 if(!Number.isInteger(mf)||mf<1||mf>1e6){setErr(f,'prc_minFirst',t('prc.err.min'));bad=true;}if(!Number.isInteger(mx)||mx<1||mx>1e6){setErr(f,'prc_minNext',t('prc.err.min'));bad=true;}
 if(bad){const el=f.querySelector('[aria-invalid="true"]');if(el)el.focus();toast(t('prc.err.fix'),'bad');return;}
 const mn=orgMin();let msgs=[];
 if(mf!==mn.first||mx!==mn.next){S.org.minFirst=mf;S.org.minNext=mx;audit('partner.order_minimums',S.org.code||'',{first:mf,next:mx});msgs.push(t('prc.toast.min'));}
 const base=plLatest(cc);const same=base&&base.key===data.key&&base.fee===data.fee&&PLANS.every(p=>base.retained[p]===data.retained[p]&&TERMS.every(tm=>base.tokens[p][tm]===data.tokens[p][tm]));
 if(!same){const want=d.pl_from?iso(new Date(d.pl_from+'T10:00:00')):null;const minFrom=plMinFrom(cc,data);const v=plAdd(cc,data,{from:want,note:String(d.pl_note||'').trim()});
  const clamped=want&&want<minFrom&&v.increase;msgs.push(t(v.increase?'prc.toast.inc':'prc.toast.ver',{v:v.ver,d:fmtDate(v.from),c:ctyName(cc)})+(clamped?' '+t('prc.toast.clamped'):''));log(t('prc.log.ver',{v:v.ver,c:ctyName(cc)}));}
 if(!msgs.length){toast(t('prc.toast.nochange'));return;}toast(msgs.join(' · '));rerender();};
Object.assign(ACT,{
 prc_cc(v){S.ui.prc_cc=v;rerender();},
 prc_seedFill(){const f=$('form[data-form="prc_pl"]');if(!f)return;const sd=plSeed(f.elements.cc.value);f.elements.pl_key.value=sd.key;f.elements.pl_fee.value=0;PLANS.forEach(p=>{TERMS.forEach(tm=>{f.elements['pl_t_'+p+'_'+tm].value=sd.tokens[p][tm];});f.elements['pl_r_'+p].value=sd.retained[p];});toast(t('prc.adm.seeded'));},
 prc_showVer(arg){const [cc,ver]=String(arg).split('|');prc_curCc=cc;const all=(S.priceLists||{})[cc]||[];const v=all.find(x=>x.ver===+ver);if(!v)return;const prev=plVersions(cc).filter(x=>x.ver<v.ver).pop();
  modal(t('prc.verT',{c:esc(ctyName(cc)),v:v.ver}),`<div class="stack"><div class="row wrap g8">${prc_vBadge(v)}<span class="small muted">${t('prc.verLine',{v:v.ver,d:fmtDate(v.from)})}${v.by?' · '+esc(v.by):''}</span></div>${v.note?`<p class="small">${esc(v.note)}</p>`:''}
   <dl class="dl ord_dl"><dt>${t('prc.keyShort')}</dt><dd class="num">${money(v.key,'USD')}${prev&&prev.key!==v.key?` <span class="faint">(${money(prev.key,'USD')})</span>`:''}</dd><dt>${t('prc.fee')}</dt><dd class="num">${pct(v.fee||0,1)}</dd></dl>${prc_table(v,prev)}</div>`,ui.btn(t('c.close'),{kind:'primary',act:'ovclose'}),{wide:true});},
});

/* ---------- calculator ---------- */
const CALC_DEF={dev:3000,growth:0,std:70,rLight:149,rStd:299,pk:30,mix24:30,mix36:40,mix60:30,d24:20,d36:30,d60:40,churn:10,ded:19,h:5,fx:FX};
const CALC_PLANS=['light','std'];       // the calculator models Light and Standard; Premium prices are on the price list
const CALC_CC_DEF={UA:{rLight:149,rStd:299,ded:19},KZ:{rLight:1490,rStd:2990,ded:16}};
function calc_cc(){const ccs=orgCountries();const c=(S.ui.calc||{}).cc;return ccs.includes(c)?c:ccs[0];}
function calc_cur(cc){return (CC_META[cc]||CC_META.UA).cur;}
const CALC_FIELDS={ // [min,max,integer]
 dev:[0,10000000,1],growth:[-90,500,0],std:[0,100,0],rLight:[0,100000,0],rStd:[0,100000,0],pk:[0,100,0],
 mix24:[0,100,0],mix36:[0,100,0],mix60:[0,100,0],d24:[0,95,0],d36:[0,95,0],d60:[0,95,0],churn:[0,100,0],ded:[0,60,0],fx:[0.01,100000,0]};
const CALC_PTERMS=[24,36,60];
let calc_errs={};   // field -> message (transient, per page view)
function calc_state(){const cc=calc_cc();const m=CC_META[cc]||CC_META.UA;const st=S.ui.calc||{};const c=Object.assign({},CALC_DEF,{fx:m.fx},CALC_CC_DEF[cc]||{},st.cc===cc?st:{h:st.h||5});c.cc=cc;c.cur=m.cur;if(c.h!==3&&c.h!==5)c.h=5;return c;}
// partner economics in the retail currency: USD price list × FX. sim = up-front Activation Key; month = OTA Retained Amount per paid month; pkg = Service Token price
function calc_wh(c){c=c||calc_state();const cc=c.cc;const fx=c.fx;
 const month={};CALC_PLANS.forEach(p=>{month[p]=retainedAmt(p,cc)*fx;});
 const pkg={};CALC_PLANS.forEach(p=>CALC_PTERMS.forEach(m=>{pkg[pkgKey(p,m)]=tokenPrice(p,m,cc)*fx;}));
 return {sim:keyPrice(cc)*fx,key:keyPrice(cc)*fx,month,pkg,cur:c.cur,ded:(c.ded||0)/100};}
// per-device monthly profile for one plan (blended over subscribers / package buyers): rev, cost, act per month of age
function calc_profile(plan,c,wh){
 const N=c.h*12;const rev=new Float64Array(N),cost=new Float64Array(N),act=new Float64Array(N);
 const retail=(plan==='std'?c.rStd:c.rLight)*(1-wh.ded);const whM=wh.month[plan];const q=1-c.churn/100;const pkRetail=plan==='std'?c.rStd:c.rLight;
 const pk=c.pk/100,ws=1-pk;const mixS=c.mix24+c.mix36+c.mix60||1;
 cost[0]+=wh.sim;
 for(let k=0;k<N;k++){const s=Math.pow(q,k/12);rev[k]+=ws*retail*s;cost[k]+=ws*whM*s;act[k]+=ws*s;}
 CALC_PTERMS.forEach(m=>{const w=pk*(c['mix'+m]/mixS);if(!w)return;
  rev[0]+=w*pkRetail*m*(1-c['d'+m]/100);cost[0]+=w*wh.pkg[pkgKey(plan,m)];
  for(let k=0;k<N;k++){if(k<m){act[k]+=w;}else{const s=Math.pow(q,(k-m)/12);rev[k]+=w*retail*s;cost[k]+=w*whM*s;act[k]+=w*s;}}});
 return {rev,cost,act};}
function calc_run(c){
 const wh=calc_wh(c);const H=c.h,N=H*12;const share={std:c.std/100,light:1-c.std/100};
 const prof={light:calc_profile('light',c,wh),std:calc_profile('std',c,wh)};
 const years=[];for(let y=0;y<H;y++)years.push({y:y+1,sold:Math.round(c.dev*Math.pow(1+c.growth/100,y)),rev:0,cost:0,active:0});
 for(let s=0;s<N;s++){const yr=Math.floor(s/12);const perMonth=years[yr].sold/12;
  CALC_PLANS.forEach(p=>{const n=perMonth*share[p];if(!n)return;const P=prof[p];
   for(let k=0;k<N-s;k++){const Y=years[Math.floor((s+k)/12)];Y.rev+=n*P.rev[k];Y.cost+=n*P.cost[k];}});}
 years.forEach((Y,yi)=>{const e=yi*12+11;let a=0;for(let s=0;s<=e;s++){const n=years[Math.floor(s/12)].sold/12;
  a+=n*(share.light*prof.light.act[e-s]+share.std*prof.std.act[e-s]);}Y.active=a;Y.margin=Y.rev-Y.cost;});
 const tot={sold:0,rev:0,cost:0,margin:0};years.forEach(Y=>{tot.sold+=Y.sold;tot.rev+=Y.rev;tot.cost+=Y.cost;tot.margin+=Y.margin;});
 const perDev={};CALC_PLANS.forEach(p=>{let r=0,co=0;const P=prof[p];for(let k=0;k<N;k++){r+=P.rev[k];co+=P.cost[k];}perDev[p]={rev:r,margin:r-co};});
 const pb={};CALC_PLANS.forEach(p=>{const mm=(p==='std'?c.rStd:c.rLight)*(1-wh.ded)-wh.month[p];pb[p]=mm>0?wh.sim/mm:null;});
 const bm=share.std*(c.rStd*(1-wh.ded)-wh.month.std)+share.light*(c.rLight*(1-wh.ded)-wh.month.light);pb.blend=bm>0?wh.sim/bm:null;
 return {years,tot,perDev,pb,wh};}

route('calculator',{nav:'calculator',render(){
 calc_errs={};
 const c=calc_state();
 const body=`<div class="calc_layout">
  <section class="card calc_in" aria-labelledby="calc_inH"><div class="hd"><h2 id="calc_inH">${t('calc.inputs')}</h2>${ui.btn(t('calc.reset'),{kind:'ghost',size:'sm',act:'calc_reset'})}</div>
   <div class="bd stack" id="calc_form">${calc_inputs(c)}</div></section>
  <div class="calc_out" id="calc_out" aria-live="polite">${calc_results(c)}</div>
 </div>`;
 return ui.page({title:t('calc.title'),sub:t('calc.sub'),
  actions:ui.btn(t('calc.copy'),{act:'calc_copy',icon:'copy'}),body});
}});

function calc_inputs(c){
 const cur=c.cur==='UAH'?(S.lang==='en'?'UAH':'грн'):c.cur==='KZT'?'₸':c.cur;const ccs=orgCountries();
 const f=(k,label,unit,hint)=>{const id='calc_f_'+k;return `<div class="field"><label for="${id}">${label}</label><div class="prc_inw"><input class="inp num" id="${id}" type="text" inputmode="decimal" autocomplete="off" data-calc="${k}" value="${esc(c[k])}" aria-describedby="${id}-h"><span class="prc_unit" aria-hidden="true">${unit}</span></div><span class="hint" id="${id}-h">${hint||''}</span></div>`;};
 let gi=0;const grp=(title,html)=>{const id='calc_g'+(++gi);return `<div class="calc_grp" role="group" aria-labelledby="${id}"><h3 class="calc_gh" id="${id}">${title}</h3>${html}</div>`;};
 return (ccs.length>1?`<div class="field"><span class="lbl">${t('prc.country')}</span>${ui.seg('calc_ccseg',ccs.map(x=>[x,esc(ctyName(x))]),c.cc,'calc_cc')}</div>`:'')+grp(t('calc.g.sales'),`<div class="calc_2">${f('dev',t('calc.dev'),t('calc.u.pcs'))}${f('growth',t('calc.growth'),'%')}</div>${f('std',t('calc.std'),'%',t('calc.stdH'))}`)
  +grp(t('calc.g.retail'),`<div class="calc_2">${f('rLight','Light',cur+t('calc.u.mo'))}${f('rStd','Standard',cur+t('calc.u.mo'))}</div><p class="xs faint">${t('calc.retailH')}</p>`)
  +grp(t('calc.g.pkg'),`${f('pk',t('calc.pk'),'%',t('calc.pkH'))}
   <div class="calc_lbl small"><b>${t('calc.mix')}</b></div><div class="calc_3">${CALC_PTERMS.map(m=>f('mix'+m,termLabel(m),'%')).join('')}</div>
   <span class="err calc_mixerr" id="calc_mixerr" role="alert"></span>
   <div class="calc_lbl small"><b>${t('calc.disc')}</b></div><div class="calc_3">${CALC_PTERMS.map(m=>f('d'+m,termLabel(m),'%')).join('')}</div>`)
  +grp(t('calc.g.direct'),`${f('ded',t('calc.ded'),'%',t('calc.dedH'))}<p class="xs faint">${t('calc.directH',{r:money(retainedAmt('std',c.cc),'USD')})}</p>`)
  +grp(t('calc.g.other'),`${f('churn',t('calc.churn'),'%',t('calc.churnH'))}
   <div class="field"><span class="lbl" id="calc_hL">${t('calc.horizon')}</span><div aria-labelledby="calc_hL">${ui.seg('calc_hseg',[[3,termLabel(36)],[5,termLabel(60)]],c.h,'calc_h')}</div></div>
   ${f('fx',t('calc.fx'),cur+'/$',t('calc.fxH2',{fx:fmtNum((CC_META[c.cc]||CC_META.UA).fx,2)}))}`);}

function calc_usd(n,c){return '≈ '+money(n/c.fx,'USD',0);}
function calc_results(c){
 const R=calc_run(c);const T=R.tot;const H=c.h;const mp=T.rev>0?T.margin/T.rev:0;
 const pbTxt=v=>v==null?'—':fmtNum(v,1);
 const stale=Object.keys(calc_errs).length>0;
 const kpis=`<div class="calc_kpis">
  ${ui.kpi(t('calc.k.rev',{h:termLabel(H*12)}),`<span class="num">${money(T.rev,c.cur)}</span>`,calc_usd(T.rev,c))}
  ${ui.kpi(t('calc.k.margin'),`<span class="num calc_pos">${money(T.margin,c.cur)}</span>`,calc_usd(T.margin,c))}
  ${ui.kpi(t('calc.k.mp'),`<span class="num">${pct(mp,1)}</span>`,t('calc.k.mpS',{c:money(T.cost,c.cur),u:money(T.cost/c.fx,'USD',0)}))}
  ${ui.kpi(t('calc.k.pb'),`<span class="num">${R.pb.blend==null?t('calc.never'):fmtNum(R.pb.blend,1)+' '+t('calc.u.months')}</span>`,`Light ${pbTxt(R.pb.light)} · Standard ${pbTxt(R.pb.std)} ${t('calc.u.months')} · ${t('calc.k.pbS',{s:money(R.wh.sim,c.cur)})}`)}
 </div>`;
 // per-year table
 const th=[t('calc.t.year'),t('calc.t.sold'),t('calc.t.active'),t('calc.t.rev'),t('calc.t.margin'),t('calc.t.mp')];
 const cell=(n)=>`<span class="num">${money(n,c.cur)}</span><span class="xs faint calc_sub">${calc_usd(n,c)}</span>`;
 const tr=R.years.map(Y=>`<tr><td>${t('calc.t.yearN',{n:Y.y})}</td><td class="r num">${fmtNum(Y.sold)}</td><td class="r num">${fmtNum(Math.round(Y.active))}</td><td class="r">${cell(Y.rev)}</td><td class="r">${cell(Y.margin)}</td><td class="r num">${Y.rev>0?pct(Y.margin/Y.rev,1):'—'}</td></tr>`).join('');
 const table=`<div class="tblwrap"><table class="tbl calc_tbl"><thead><tr>${th.map((h,i)=>`<th scope="col" class="${i?'r':''}">${h}</th>`).join('')}</tr></thead><tbody>${tr}</tbody>
  <tfoot><tr><th scope="row">${t('c.total')}</th><td class="r num">${fmtNum(T.sold)}</td><td class="r num faint">—</td><td class="r">${cell(T.rev)}</td><td class="r">${cell(T.margin)}</td><td class="r num">${pct(mp,1)}</td></tr></tfoot></table></div>`;
 const perDev=CALC_PLANS.slice().reverse().map(p=>{const d=R.perDev[p];return `<div class="col g4 calc_pd"><span class="small muted">${t('calc.pd.per',{p:PLAN_NAME[p]})}</span>
  <dl class="calc_dl"><dt>${t('calc.pd.rev')}</dt><dd class="num">${money(d.rev,c.cur)} <span class="xs faint">${calc_usd(d.rev,c)}</span></dd>
  <dt>${t('calc.pd.margin')}</dt><dd class="num"><b>${money(d.margin,c.cur)}</b> <span class="xs faint">${calc_usd(d.margin,c)}</span></dd></dl></div>`;}).join('');
 return `${stale?ui.note('warn',t('calc.stale')):''}<div class="stack ${stale?'calc_stale':''}">
  ${kpis}
  ${ui.card({title:t('calc.chart'),actions:`<span class="row g12 xs muted calc_leg"><span class="row g4"><i class="calc_sw m"></i>${t('calc.t.margin')}</span><span class="row g4"><i class="calc_sw c"></i>${t('calc.costs')}</span></span>`,body:calc_chart(R,c)})}
  ${ui.card({title:t('calc.byYear'),pad:false,body:table})}
  ${ui.card({title:t('calc.pd.title',{h:termLabel(H*12)}),body:`<div class="grid2">${perDev}</div><p class="xs faint" style="margin-top:12px">${t('calc.pd.note')}</p>`})}
  <p class="xs faint calc_foot">${t('calc.foot')} <a href="#prices">${t('calc.toPrices')}</a></p></div>`;}

function calc_nice(max){if(max<=0)return 1;const e=Math.pow(10,Math.floor(Math.log10(max)));const f=max/e;return (f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10)*e;}
function calc_short(n){const a=Math.abs(n);if(a>=1e9)return fmtNum(n/1e9,a>=1e10?0:1)+t('calc.u.bn');if(a>=1e6)return fmtNum(n/1e6,a>=1e7?0:1)+t('calc.u.mn');if(a>=1e3)return fmtNum(n/1e3,0)+t('calc.u.k');return fmtNum(n,0);}
function calc_chart(R,c){
 const narrow=window.innerWidth<640;const W=narrow?360:640,Hh=narrow?240:260,L=narrow?44:56,Rp=12,T=14,B=30;const pw=W-L-Rp,ph=Hh-T-B;
 const maxV=Math.max(0,...R.years.map(Y=>Math.max(Y.rev,Y.margin)));const step=calc_nice(maxV/4);const top=step*Math.max(1,Math.ceil(maxV/step));
 const minV=Math.min(0,...R.years.map(Y=>Y.margin));const bot=minV<0?-step*Math.ceil(-minV/step):0;const span=top-bot||1;
 const yy=v=>T+ph*(top-v)/span;
 let g='';for(let v=bot;v<=top+1e-6;v+=step){const y=yy(v).toFixed(1);g+=`<line x1="${L}" x2="${W-Rp}" y1="${y}" y2="${y}" class="calc_grid${Math.abs(v)<1e-6?' z':''}"/><text x="${L-8}" y="${y}" dy="4" text-anchor="end" class="calc_ax">${calc_short(v)}</text>`;}
 const n=R.years.length;const slot=pw/n;const bw=Math.min(64,slot*(narrow?0.62:0.56));let bars='';
 R.years.forEach((Y,i)=>{const x=L+slot*i+(slot-bw)/2;const m=Math.max(0,Y.margin),cst=Math.max(0,Y.rev-m);
  const y0=yy(0),ym=yy(m),yr=yy(m+cst);
  bars+=`<g><title>${esc(t('calc.t.yearN',{n:Y.y})+': '+t('calc.t.rev')+' '+money(Y.rev,c.cur)+', '+t('calc.t.margin')+' '+money(Y.margin,c.cur))}</title>`
   +(Y.margin<0?`<rect x="${x.toFixed(1)}" y="${y0.toFixed(1)}" width="${bw.toFixed(1)}" height="${(yy(Y.margin)-y0).toFixed(1)}" class="calc_bneg"/>`:'')
   +`<rect x="${x.toFixed(1)}" y="${ym.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0,y0-ym).toFixed(1)}" class="calc_bm"/>`
   +`<rect x="${x.toFixed(1)}" y="${yr.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0,ym-yr).toFixed(1)}" class="calc_bc"/>`
   +`<text x="${(x+bw/2).toFixed(1)}" y="${(yr-5).toFixed(1)}" text-anchor="middle" class="calc_val">${calc_short(Y.rev)}</text>`
   +`<text x="${(x+bw/2).toFixed(1)}" y="${Hh-10}" text-anchor="middle" class="calc_ax">${esc(narrow?String(Y.y):t('calc.t.yearN',{n:Y.y}))}</text></g>`;});
 const aria=t('calc.chartAria')+' '+R.years.map(Y=>t('calc.t.yearN',{n:Y.y})+': '+t('calc.t.rev')+' '+money(Y.rev,c.cur)+', '+t('calc.t.margin')+' '+money(Y.margin,c.cur)).join('; ')+'.';
 return `<svg class="chart calc_chart" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="${esc(aria)}">${g}${bars}</svg><p class="xs faint" style="margin-top:6px">${t('calc.chartNote')}</p>`;}

function calc_validate(k,raw){
 const v=prc_num(raw);const spec=CALC_FIELDS[k];
 if(String(raw).trim()==='')return {err:t('calc.err.empty')};
 if(isNaN(v))return {err:t('calc.err.num')};
 if(v<spec[0]||v>spec[1])return {err:t('calc.err.range',{a:fmtNum(spec[0]),b:fmtNum(spec[1])})};
 if(spec[2]&&Math.round(v)!==v)return {err:t('calc.err.int')};
 return {v};}
function calc_setFieldErr(k,msg){const el=document.getElementById('calc_f_'+k);if(!el)return;const h=document.getElementById('calc_f_'+k+'-h');
 if(msg){el.setAttribute('aria-invalid','true');if(h){if(h.dataset.hint==null)h.dataset.hint=h.textContent;h.className='err';h.textContent=msg;}}
 else{el.removeAttribute('aria-invalid');if(h&&h.className==='err'){h.className='hint';h.textContent=h.dataset.hint||'';}}}
function calc_mixCheck(vals){
 const s=vals.mix24+vals.mix36+vals.mix60;const box=document.getElementById('calc_mixerr');const ok=Math.abs(s-100)<0.001;
 if(box)box.textContent=ok?'':t('calc.err.mix',{s:fmtNum(s,s%1?1:0)});
 CALC_PTERMS.forEach(m=>{const el=document.getElementById('calc_f_mix'+m);if(el&&!calc_errs['mix'+m]){if(ok)el.removeAttribute('aria-invalid');else el.setAttribute('aria-invalid','true');}});
 return ok;}
function calc_onInput(el){
 if(!CALC_FIELDS[el.dataset.calc])return;
 // read every field from the DOM so the state always reflects what the user sees
 const cand=calc_state();calc_errs={};
 $$('[data-calc]').forEach(inp=>{const k=inp.dataset.calc;if(!CALC_FIELDS[k])return;const r=calc_validate(k,inp.value);
  if(r.err)calc_errs[k]=r.err;else cand[k]=r.v;calc_setFieldErr(k,r.err);});
 const mixFieldsOk=CALC_PTERMS.every(m=>!calc_errs['mix'+m]);
 if(mixFieldsOk&&!calc_mixCheck(cand))calc_errs._mix=1;
 else if(!mixFieldsOk){const box=document.getElementById('calc_mixerr');if(box)box.textContent='';}
 if(!Object.keys(calc_errs).length){const st={};for(const k in CALC_FIELDS)st[k]=cand[k];st.h=cand.h;st.cc=cand.cc;S.ui.calc=st;save();}
 const out=document.getElementById('calc_out');if(out)out.innerHTML=calc_results(calc_state());}
document.addEventListener('input',e=>{const el=e.target;if(el&&el.dataset&&el.dataset.calc)calc_onInput(el);});

Object.assign(ACT,{
 calc_h(v){S.ui.calc=Object.assign({},calc_state(),{h:+v===3?3:5});rerender();},
 calc_cc(v){S.ui.calc={cc:v,h:calc_state().h};rerender();},
 calc_reset(){S.ui.calc={cc:calc_cc()};toast(t('calc.toast.reset'));rerender();},
 calc_copy(){const c=calc_state();const R=calc_run(c);const T=R.tot;const L=[];
  L.push(t('calc.title')+' — '+(S.org?S.org.name:''));
  L.push(t('calc.s.inputs',{d:fmtNum(c.dev),g:fmtNum(c.growth),s:fmtNum(c.std),l:money(c.rLight,c.cur),st:money(c.rStd,c.cur),p:fmtNum(c.pk),ch:fmtNum(c.churn),h:termLabel(c.h*12)}));
  L.push(t('calc.s.mix',{a:c.mix24,b:c.mix36,c:c.mix60,da:c.d24,db:c.d36,dc:c.d60}));
  L.push('');
  L.push(t('calc.t.rev')+': '+money(T.rev,c.cur)+' ('+calc_usd(T.rev,c)+')');
  L.push(t('calc.k.margin')+': '+money(T.margin,c.cur)+' ('+calc_usd(T.margin,c)+')');
  L.push(t('calc.k.mp')+': '+pct(T.rev>0?T.margin/T.rev:0,1));
  L.push(t('calc.k.pb')+': '+(R.pb.blend==null?t('calc.never'):fmtNum(R.pb.blend,1)+' '+t('calc.u.months')));
  L.push('');
  R.years.forEach(Y=>L.push(t('calc.t.yearN',{n:Y.y})+': '+fmtNum(Y.sold)+' '+t('calc.u.pcs')+' · '+t('calc.t.rev')+' '+money(Y.rev,c.cur)+' · '+t('calc.t.margin')+' '+money(Y.margin,c.cur)+' ('+(Y.rev>0?pct(Y.margin/Y.rev,1):'—')+')'));
  L.push('');CALC_PLANS.forEach(p=>L.push(t('calc.pd.per',{p:PLAN_NAME[p]})+': '+t('calc.pd.rev')+' '+money(R.perDev[p].rev,c.cur)+', '+t('calc.pd.margin')+' '+money(R.perDev[p].margin,c.cur)));
  L.push('');L.push(t('calc.foot').replace(/<[^>]+>/g,''));
  copyText(L.join('\n'));},
});

/* ---------- strings ---------- */
I18N.add({
uk:{'prc.sec':'Фінанси','prc.nav':'Пакети та ціни','calc.nav':'Калькулятор доходу',
 'prc.title':'Пакети та ціни','prc.sub':'Ваші ціни на SIM-карти та пакети зв’язку. Тип пакета (Light чи Standard) для кожної моделі призначає OTA.','prc.toCalc':'Порахувати дохід',
 'prc.showIn':'Показати ціни в','prc.curUAH':'Гривня з ПДВ','prc.curUSD':'Долари США без ПДВ','prc.inclVat':'з ПДВ 20%','prc.noVat':'без ПДВ','prc.fxNote':'Курс для довідки: {fx} грн за $1',
 'prc.simTitle':'SIM-карта з активацією','prc.simText':'Однакова ціна для будь-якого пристрою. Включає SIM-карту, підключення та налаштування профілю.','prc.perSim':'за SIM',
 'prc.pkgTitle':'Пакети зв’язку','prc.pkg':'Пакет','prc.m1':'1 місяць','prc.refMonth':'за місяць, для довідки','prc.save':'−{p}','prc.more':'+{p}','prc.perMo':'/міс','prc.custom':'Індивідуальна ціна',
 'prc.desc.light.short':'Мало даних, рідкі звернення','prc.desc.std.short':'Регулярний обмін даними',
 'prc.lightT':'Light — для простих пристроїв','prc.desc.light':'Трекери, сигналізації, реле: пристрій надсилає невеликі повідомлення кілька разів на годину або рідше.',
 'prc.stdT':'Standard — для «розумних» пристроїв','prc.desc.std':'Інвертори, контролери, лічильники: постійний онлайн, телеметрія, оновлення прошивки через мережу.',
 'prc.howAssigned':'Пакет для моделі обирає OTA після перевірки — за тим, скільки даних реально передає пристрій. Знижка за пакет рахується від щомісячної ціни × кількість місяців.',
 'prc.models':'Ваші моделі пристроїв','prc.model':'Бренд · модель','prc.pkgCol':'Пакет','prc.from24':'Пакет на 2 роки','prc.review':'На перевірці','prc.noModels':'Ще немає моделей','prc.noModelsT':'Додайте модель — OTA перевірить її та призначить пакет.','prc.addModel':'Додати модель',
 'prc.adm.title':'Ціни партнера','prc.adm.badge':'Дія OTA','prc.adm.note':'<b>Тільки для команди OTA.</b> Встановіть індивідуальні ціни для цього партнера. SIM — у доларах без ПДВ, пакети — у гривнях з ПДВ. Зміни діють лише для нових рахунків.',
 'prc.adm.save':'Зберегти ціни','prc.adm.reset':'Повернути базові ціни','prc.adm.resetQ':'Повернути базові ціни?','prc.adm.resetT':'Усі індивідуальні ціни цього партнера буде видалено. Уже виставлені рахунки не зміняться.',
 'prc.simShort':'SIM з активацією','prc.base':'База','prc.err.price':'Вкажіть ціну більше нуля','prc.err.fix':'Виправте позначені ціни',
 'prc.toast.saved':'Ціни оновлено ({n}) — діятимуть для нових рахунків','prc.toast.nochange':'Ціни не змінились','prc.toast.reset':'Повернуто базові ціни',
 'prc.log.changed':'OTA змінила ціни для {org}','prc.log.reset':'OTA повернула базові ціни',
 'calc.title':'План доходу','calc.sub':'Вкажіть свої продажі та роздрібні ціни — побачите дохід, свою маржу і окупність у гривні та доларах.','calc.copy':'Скопіювати підсумок','calc.toPrices':'Наші ціни','calc.reset':'Скинути',
 'calc.inputs':'Ваші параметри','calc.g.sales':'Продажі','calc.g.retail':'Роздрібна ціна для клієнта, з ПДВ','calc.g.pkg':'Пакети при встановленні','calc.g.other':'Інше',
 'calc.dev':'Пристроїв на рік','calc.growth':'Зростання на рік','calc.std':'Частка Standard','calc.stdH':'Решта — пристрої Light','calc.retailH':'Скільки клієнт платить вам щомісяця. Наші оптові ціни підставляються автоматично.',
 'calc.pk':'Купують пакет одразу','calc.pkH':'Решта платить щомісячну підписку','calc.mix':'Розподіл пакетів, %','calc.disc':'Ваша знижка на пакет, %',
 'calc.churn':'Відтік абонентів на рік','calc.churnH':'Скільки підписників щороку припиняють оплату','calc.horizon':'Горизонт','calc.fx':'Курс','calc.fxH':'НБУ: {fx}',
 'calc.u.pcs':'шт','calc.u.mo':'/міс','calc.u.months':'міс','calc.u.k':' тис','calc.u.mn':' млн','calc.u.bn':' млрд','calc.never':'не окупається',
 'calc.k.rev':'Дохід за {h}','calc.k.margin':'Ваша маржа','calc.k.mp':'Маржа, %','calc.k.mpS':'Оптові витрати {c} (≈ {u})','calc.k.pb':'Окупність SIM для підписника','calc.k.pbS':'SIM {s}',
 'calc.chart':'Дохід і маржа по роках','calc.costs':'Оптові витрати','calc.chartNote':'Висота стовпчика — дохід; нижня частина — ваша маржа.','calc.chartAria':'Стовпчикова діаграма доходу і маржі по роках.',
 'calc.byYear':'По роках','calc.t.year':'Рік','calc.t.yearN':'Рік {n}','calc.t.sold':'Продано','calc.t.active':'Активних на кінець року','calc.t.rev':'Дохід','calc.t.margin':'Маржа','calc.t.mp':'Маржа, %',
 'calc.pd.title':'На один пристрій за {h}','calc.pd.per':'Пристрій {p}','calc.pd.rev':'Дохід','calc.pd.margin':'Маржа','calc.pd.note':'Пристрій, проданий на початку першого року, з урахуванням вашої частки пакетів і відтоку; мінус вартість SIM.',
 'calc.foot':'Розрахунок ілюстративний і базується на ваших припущеннях — це не гарантія доходу. Усі суми з ПДВ; платежі за межами горизонту не враховано. Продажі розподілені рівномірно протягом року.',
 'calc.stale':'Виправте позначені поля — показано останній коректний розрахунок.',
 'calc.err.empty':'Вкажіть значення','calc.err.num':'Лише число','calc.err.range':'Від {a} до {b}','calc.err.int':'Ціле число','calc.err.mix':'Сума має дорівнювати 100% — зараз {s}%',
 'calc.toast.reset':'Параметри скинуто до типових',
 'calc.s.inputs':'Пристроїв на рік: {d} (зростання {g}%), Standard {s}%. Роздріб: Light {l}/міс, Standard {st}/міс. Пакет одразу: {p}%. Відтік: {ch}%/рік. Горизонт: {h}.','calc.s.mix':'Пакети 2/3/5 років: {a}/{b}/{c}%, знижки {da}/{db}/{dc}%.'},
en:{'prc.sec':'Finance','prc.nav':'Packages & prices','calc.nav':'Revenue calculator',
 'prc.title':'Packages & prices','prc.sub':'Your prices for SIM cards and connectivity packages. OTA assigns the package type (Light or Standard) to each device model.','prc.toCalc':'Plan your revenue',
 'prc.showIn':'Show prices in','prc.curUAH':'UAH incl. VAT','prc.curUSD':'US dollars, no VAT','prc.inclVat':'incl. 20% VAT','prc.noVat':'no VAT','prc.fxNote':'Reference rate: {fx} UAH per $1',
 'prc.simTitle':'SIM card with activation','prc.simText':'Same price for every device. Includes the SIM card, connection and profile setup.','prc.perSim':'per SIM',
 'prc.pkgTitle':'Connectivity packages','prc.pkg':'Package','prc.m1':'1 month','prc.refMonth':'per month, for reference','prc.save':'−{p}','prc.more':'+{p}','prc.perMo':'/mo','prc.custom':'Custom price',
 'prc.desc.light.short':'Little data, infrequent check-ins','prc.desc.std.short':'Regular data exchange',
 'prc.lightT':'Light — for simple devices','prc.desc.light':'Trackers, alarms, relays: the device sends small messages a few times an hour or less.',
 'prc.stdT':'Standard — for smart devices','prc.desc.std':'Inverters, controllers, meters: always online, telemetry, over-the-air firmware updates.',
 'prc.howAssigned':'OTA picks the package for each model after review, based on how much data the device really sends. Package savings are shown against the monthly price × number of months.',
 'prc.models':'Your device models','prc.model':'Brand · model','prc.pkgCol':'Package','prc.from24':'2-year package','prc.review':'Under review','prc.noModels':'No models yet','prc.noModelsT':'Add a model — OTA will review it and assign a package.','prc.addModel':'Add model',
 'prc.adm.title':'Partner prices','prc.adm.badge':'OTA action','prc.adm.note':'<b>OTA team only.</b> Set custom prices for this partner. SIM in USD without VAT, packages in UAH incl. VAT. Changes apply to new invoices only.',
 'prc.adm.save':'Save prices','prc.adm.reset':'Reset to base prices','prc.adm.resetQ':'Reset to base prices?','prc.adm.resetT':'All custom prices for this partner will be removed. Invoices already issued won’t change.',
 'prc.simShort':'SIM with activation','prc.base':'Base','prc.err.price':'Enter a price above zero','prc.err.fix':'Fix the highlighted prices',
 'prc.toast.saved':'{n} price(s) updated — they apply to new invoices','prc.toast.nochange':'No prices changed','prc.toast.reset':'Base prices restored',
 'prc.log.changed':'OTA changed prices for {org}','prc.log.reset':'OTA restored base prices',
 'calc.title':'Revenue plan','calc.sub':'Enter your sales and retail prices to see revenue, your margin and payback in UAH and USD.','calc.copy':'Copy summary','calc.toPrices':'Our prices','calc.reset':'Reset to defaults',
 'calc.inputs':'Your assumptions','calc.g.sales':'Sales','calc.g.retail':'Retail price to the customer, incl. VAT','calc.g.pkg':'Packages at installation','calc.g.other':'Other',
 'calc.dev':'Devices per year','calc.growth':'Yearly growth','calc.std':'Share of Standard','calc.stdH':'The rest are Light devices','calc.retailH':'What the customer pays you each month. Our wholesale prices are applied automatically.',
 'calc.pk':'Buy a package upfront','calc.pkH':'The rest pay a monthly subscription','calc.mix':'Package mix, %','calc.disc':'Your package discount, %',
 'calc.churn':'Yearly subscriber churn','calc.churnH':'Share of subscribers who stop paying each year','calc.horizon':'Horizon','calc.fx':'Exchange rate','calc.fxH':'NBU: {fx}',
 'calc.u.pcs':'pcs','calc.u.mo':'/mo','calc.u.months':'mo','calc.u.k':'k','calc.u.mn':'M','calc.u.bn':'B','calc.never':'no payback',
 'calc.k.rev':'Revenue over {h}','calc.k.margin':'Your margin','calc.k.mp':'Margin %','calc.k.mpS':'Wholesale costs {c} (≈ {u})','calc.k.pb':'SIM payback per subscriber','calc.k.pbS':'SIM {s}',
 'calc.chart':'Revenue and margin by year','calc.costs':'Wholesale costs','calc.chartNote':'Bar height is revenue; the lower part is your margin.','calc.chartAria':'Bar chart of revenue and margin by year.',
 'calc.byYear':'By year','calc.t.year':'Year','calc.t.yearN':'Year {n}','calc.t.sold':'Sold','calc.t.active':'Active at year end','calc.t.rev':'Revenue','calc.t.margin':'Margin','calc.t.mp':'Margin %',
 'calc.pd.title':'Per device over {h}','calc.pd.per':'{p} device','calc.pd.rev':'Revenue','calc.pd.margin':'Margin','calc.pd.note':'A device sold at the start of year 1, with your package share and churn applied; SIM cost deducted.',
 'calc.foot':'Illustrative estimate based on your assumptions — not a guarantee of income. All amounts incl. VAT; payments beyond the horizon are not counted. Sales are spread evenly through each year.',
 'calc.stale':'Fix the highlighted fields — showing the last valid result.',
 'calc.err.empty':'Enter a value','calc.err.num':'Numbers only','calc.err.range':'From {a} to {b}','calc.err.int':'Whole number','calc.err.mix':'Must add up to 100% — now {s}%',
 'calc.toast.reset':'Assumptions reset to defaults',
 'calc.s.inputs':'Devices per year: {d} (growth {g}%), Standard {s}%. Retail: Light {l}/mo, Standard {st}/mo. Package upfront: {p}%. Churn: {ch}%/yr. Horizon: {h}.','calc.s.mix':'Packages 2/3/5 years: {a}/{b}/{c}%, discounts {da}/{db}/{dc}%.'},
ru:{'prc.sec':'Финансы','prc.nav':'Пакеты и цены','calc.nav':'Калькулятор дохода',
 'prc.title':'Пакеты и цены','prc.sub':'Ваши цены на SIM-карты и пакеты связи. Тип пакета (Light или Standard) для каждой модели назначает OTA.','prc.toCalc':'Рассчитать доход',
 'prc.showIn':'Показать цены в','prc.curUAH':'Гривна с НДС','prc.curUSD':'Доллары США без НДС','prc.inclVat':'с НДС 20%','prc.noVat':'без НДС','prc.fxNote':'Курс для справки: {fx} грн за $1',
 'prc.simTitle':'SIM-карта с активацией','prc.simText':'Одинаковая цена для любого устройства. Включает SIM-карту, подключение и настройку профиля.','prc.perSim':'за SIM',
 'prc.pkgTitle':'Пакеты связи','prc.pkg':'Пакет','prc.m1':'1 месяц','prc.refMonth':'в месяц, для справки','prc.save':'−{p}','prc.more':'+{p}','prc.perMo':'/мес','prc.custom':'Индивидуальная цена',
 'prc.desc.light.short':'Мало данных, редкие выходы на связь','prc.desc.std.short':'Регулярный обмен данными',
 'prc.lightT':'Light — для простых устройств','prc.desc.light':'Трекеры, сигнализации, реле: устройство отправляет небольшие сообщения несколько раз в час или реже.',
 'prc.stdT':'Standard — для «умных» устройств','prc.desc.std':'Инверторы, контроллеры, счётчики: постоянно онлайн, телеметрия, обновление прошивки по сети.',
 'prc.howAssigned':'Пакет для модели выбирает OTA после проверки — по тому, сколько данных реально передаёт устройство. Экономия пакета считается от месячной цены × количество месяцев.',
 'prc.models':'Ваши модели устройств','prc.model':'Бренд · модель','prc.pkgCol':'Пакет','prc.from24':'Пакет на 2 года','prc.review':'На проверке','prc.noModels':'Пока нет моделей','prc.noModelsT':'Добавьте модель — OTA проверит её и назначит пакет.','prc.addModel':'Добавить модель',
 'prc.adm.title':'Цены партнёра','prc.adm.badge':'Действие OTA','prc.adm.note':'<b>Только для команды OTA.</b> Установите индивидуальные цены для этого партнёра. SIM — в долларах без НДС, пакеты — в гривнах с НДС. Изменения действуют только для новых счетов.',
 'prc.adm.save':'Сохранить цены','prc.adm.reset':'Вернуть базовые цены','prc.adm.resetQ':'Вернуть базовые цены?','prc.adm.resetT':'Все индивидуальные цены этого партнёра будут удалены. Уже выставленные счета не изменятся.',
 'prc.simShort':'SIM с активацией','prc.base':'База','prc.err.price':'Укажите цену больше нуля','prc.err.fix':'Исправьте отмеченные цены',
 'prc.toast.saved':'Цены обновлены ({n}) — будут действовать для новых счетов','prc.toast.nochange':'Цены не изменились','prc.toast.reset':'Базовые цены восстановлены',
 'prc.log.changed':'OTA изменила цены для {org}','prc.log.reset':'OTA вернула базовые цены',
 'calc.title':'План дохода','calc.sub':'Укажите свои продажи и розничные цены — увидите доход, свою маржу и окупаемость в гривне и долларах.','calc.copy':'Скопировать итог','calc.toPrices':'Наши цены','calc.reset':'Сбросить',
 'calc.inputs':'Ваши параметры','calc.g.sales':'Продажи','calc.g.retail':'Розничная цена для клиента, с НДС','calc.g.pkg':'Пакеты при установке','calc.g.other':'Прочее',
 'calc.dev':'Устройств в год','calc.growth':'Рост в год','calc.std':'Доля Standard','calc.stdH':'Остальные — устройства Light','calc.retailH':'Сколько клиент платит вам ежемесячно. Наши оптовые цены подставляются автоматически.',
 'calc.pk':'Покупают пакет сразу','calc.pkH':'Остальные платят ежемесячную подписку','calc.mix':'Распределение пакетов, %','calc.disc':'Ваша скидка на пакет, %',
 'calc.churn':'Отток абонентов в год','calc.churnH':'Сколько подписчиков ежегодно прекращают оплату','calc.horizon':'Горизонт','calc.fx':'Курс','calc.fxH':'НБУ: {fx}',
 'calc.u.pcs':'шт','calc.u.mo':'/мес','calc.u.months':'мес','calc.u.k':' тыс','calc.u.mn':' млн','calc.u.bn':' млрд','calc.never':'не окупается',
 'calc.k.rev':'Доход за {h}','calc.k.margin':'Ваша маржа','calc.k.mp':'Маржа, %','calc.k.mpS':'Оптовые затраты {c} (≈ {u})','calc.k.pb':'Окупаемость SIM для подписчика','calc.k.pbS':'SIM {s}',
 'calc.chart':'Доход и маржа по годам','calc.costs':'Оптовые затраты','calc.chartNote':'Высота столбца — доход; нижняя часть — ваша маржа.','calc.chartAria':'Столбчатая диаграмма дохода и маржи по годам.',
 'calc.byYear':'По годам','calc.t.year':'Год','calc.t.yearN':'Год {n}','calc.t.sold':'Продано','calc.t.active':'Активных на конец года','calc.t.rev':'Доход','calc.t.margin':'Маржа','calc.t.mp':'Маржа, %',
 'calc.pd.title':'На одно устройство за {h}','calc.pd.per':'Устройство {p}','calc.pd.rev':'Доход','calc.pd.margin':'Маржа','calc.pd.note':'Устройство, проданное в начале первого года, с учётом вашей доли пакетов и оттока; за вычетом стоимости SIM.',
 'calc.foot':'Расчёт иллюстративный и основан на ваших допущениях — это не гарантия дохода. Все суммы с НДС; платежи за пределами горизонта не учтены. Продажи распределены равномерно в течение года.',
 'calc.stale':'Исправьте отмеченные поля — показан последний корректный расчёт.',
 'calc.err.empty':'Укажите значение','calc.err.num':'Только число','calc.err.range':'От {a} до {b}','calc.err.int':'Целое число','calc.err.mix':'Сумма должна быть 100% — сейчас {s}%',
 'calc.toast.reset':'Параметры сброшены к стандартным',
 'calc.s.inputs':'Устройств в год: {d} (рост {g}%), Standard {s}%. Розница: Light {l}/мес, Standard {st}/мес. Пакет сразу: {p}%. Отток: {ch}%/год. Горизонт: {h}.','calc.s.mix':'Пакеты 2/3/5 лет: {a}/{b}/{c}%, скидки {da}/{db}/{dc}%.'}});

I18N.add({uk:{'prc.adm.note2':'Ціни саме для цього партнера. Гривня — з ПДВ, долар — без ПДВ. Зміни діють для нових рахунків і записуються в історію, яку бачить і партнер.','prc.adm.minFirst':'Мінімум першого замовлення SIM','prc.adm.minFirstH':'Стартова партія, штук','prc.adm.minNext':'Мінімум повторного замовлення SIM','prc.adm.minNextH':'Штук','prc.err.min':'Ціле число від 1','prc.hist.title':'Історія змін цін','prc.hist.p':'Коли і що змінювалося у ваших цінах та умовах замовлення.','prc.hist.cur':'Валюта','prc.hist.change':'Було → стало','prc.hist.uah':'грн з ПДВ','prc.hist.usd':'$ без ПДВ','prc.hist.empty':'Ціни ще не змінювалися — діють базові.'},
en:{'prc.adm.note2':'Prices for this partner only. Hryvnia incl. VAT, dollars without VAT. Changes apply to new invoices and are recorded in a history the partner sees too.','prc.adm.minFirst':'First SIM order minimum','prc.adm.minFirstH':'Starter batch, cards','prc.adm.minNext':'Repeat SIM order minimum','prc.adm.minNextH':'Cards','prc.err.min':'Whole number from 1','prc.hist.title':'Price change history','prc.hist.p':'When and what changed in your prices and order terms.','prc.hist.cur':'Currency','prc.hist.change':'Was → now','prc.hist.uah':'UAH incl. VAT','prc.hist.usd':'$ net','prc.hist.empty':'No changes yet — base prices apply.'},
ru:{'prc.adm.note2':'Цены именно для этого партнёра. Гривна — с НДС, доллар — без НДС. Изменения действуют для новых счетов и записываются в историю, которую видит и партнёр.','prc.adm.minFirst':'Минимум первого заказа SIM','prc.adm.minFirstH':'Стартовая партия, штук','prc.adm.minNext':'Минимум повторного заказа SIM','prc.adm.minNextH':'Штук','prc.err.min':'Целое число от 1','prc.hist.title':'История изменения цен','prc.hist.p':'Когда и что менялось в ваших ценах и условиях заказа.','prc.hist.cur':'Валюта','prc.hist.change':'Было → стало','prc.hist.uah':'грн с НДС','prc.hist.usd':'$ без НДС','prc.hist.empty':'Цены ещё не менялись — действуют базовые.'}});

/* ---------- v09 strings (price lists per country, USD) ---------- */
(function(){const R=[
['prc.nav','Ціни','Prices','Цены'],['prc.title','Ціни по країнах','Prices by country','Цены по странам'],['prc.sub','Ваш поточний прайс-лист OTA для кожної країни: ключі активації, сервісні токени й умови прямих підписок. Усе в USD без ПДВ.','Your current OTA price list for each country: Activation Keys, Service Tokens and direct subscription terms. All in USD, net.','Ваш текущий прайс-лист OTA для каждой страны: ключи активации, сервисные токены и условия прямых подписок. Всё в USD без НДС.'],
['prc.country','Країна','Country','Страна'],['prc.verLine','Версія {v} · діє з {d}','Version {v} · effective {d}','Версия {v} · действует с {d}'],['prc.usdNet','USD без ПДВ','USD, net','USD без НДС'],
['prc.noPl','Прайс-листа ще немає','No price list yet','Прайс-листа пока нет'],['prc.noPlP','OTA додасть ціни для цієї країни після погодження умов.','OTA adds prices for this country once terms are agreed.','OTA добавит цены для этой страны после согласования условий.'],
['prc.pendT','З {d} діятиме версія {v}.','Version {v} takes effect on {d}.','С {d} будет действовать версия {v}.'],['prc.pendInc','Ціни зростають — ми повідомляємо щонайменше за 90 днів, як передбачено угодою.','Prices go up — we give at least 90 days’ notice, as the agreement requires.','Цены растут — мы предупреждаем минимум за 90 дней, как предусмотрено соглашением.'],['prc.pendDec','Ціни знижуються.','Prices go down.','Цены снижаются.'],['prc.seeChanges','Що змінюється','See changes','Что меняется'],
['prc.keyTitle','Ключ активації','Activation Key','Ключ активации'],['prc.keyText','Ліцензійний ключ програми CONNECT — один на пристрій, назавжди. Не прив’язаний до відвантажень SIM.','Licence key for the CONNECT program — one per device, for life. Not tied to SIM shipments.','Лицензионный ключ программы CONNECT — один на устройство, навсегда. Не привязан к отгрузкам SIM.'],['prc.perKey','за ключ · USD без ПДВ','per key · USD, net','за ключ · USD без НДС'],['prc.keyShort','Ключ активації','Activation Key','Ключ активации'],
['prc.tokTitle','Сервісні токени','Service Tokens','Сервисные токены'],['prc.tokValid','дійсні 36 місяців від видачі','valid 36 months from issue','действуют 36 месяцев с выдачи'],['prc.plan','Тариф','Plan','Тариф'],['prc.perMo','/ міс.','/ mo','/ мес.'],['prc.perMoShort','/міс.','/mo','/мес.'],['prc.ret','Утримання OTA','OTA retained','Удержание OTA'],
['prc.desc.prem','Для пристроїв із великим обсягом даних і пріоритетною підтримкою.','For data-heavy devices with priority support.','Для устройств с большим объёмом данных и приоритетной поддержкой.'],
['prc.comTitle','Прямі підписки: ваша комісія','Direct subscriptions: your commission','Прямые подписки: ваша комиссия'],
['prc.comP','Кінцеві клієнти можуть платити OTA напряму на сторінці оплати (щомісяця, щороку або передоплатою на 12–60 місяців) за роздрібними цінами, які встановлюєте ви (не нижче мінімальних). Вашу комісію ми рахуємо щомісяця.','End customers can pay OTA directly on the payment page (monthly, yearly or prepaid for 12–60 months) at retail prices you set (not below the minimum). We calculate your commission every month.','Конечные клиенты могут платить OTA напрямую на странице оплаты (ежемесячно, ежегодно или предоплатой на 12–60 месяцев) по розничным ценам, которые устанавливаете вы (не ниже минимальных). Вашу комиссию мы считаем ежемесячно.'],
['prc.formula','Комісія = Чиста зібрана виручка (оплати клієнтів − податки OTA в країні клієнта − еквайринг − повернення − збір країни) − Сума, що утримує OTA × оплачені місяці','Commission = Net Collected Revenue (customer payments − OTA taxes in the customer’s country − acquiring − refunds − country fee) − OTA Retained Amount × paid months','Комиссия = Чистая собранная выручка (оплаты клиентов − налоги OTA в стране клиента − эквайринг − возвраты − сбор страны) − Сумма, удерживаемая OTA × оплаченные месяцы'],
['prc.retTitle','Сума, що утримує OTA','OTA Retained Amount','Сумма, удерживаемая OTA'],['prc.perPaidMo','за оплачений місяць','per paid month','за оплаченный месяц'],['prc.fee','Збір країни (compliance fee)','Country compliance fee','Сбор страны (compliance fee)'],['prc.rs','Акт звірки','Reconciliation','Акт сверки'],['prc.rsD','до 10-го числа; рахунок на комісію — до 15-го','by the 10th; commission invoice by the 15th','до 10-го числа; счёт на комиссию — до 15-го'],
['prc.comEx','Приклад: клієнт оплатив місяць Standard; після податків і комісій лишилось $6,00 — ваша комісія $6,00 − {r} утримання OTA.','Example: a customer paid one Standard month; after taxes and fees $6.00 remains — your commission is $6.00 − {r} OTA retained.','Пример: клиент оплатил месяц Standard; после налогов и комиссий осталось $6,00 — ваша комиссия $6,00 − {r} удержание OTA.'],
['prc.hist.title','Версії прайс-листа','Price list versions','Версии прайс-листа'],['prc.v.col','Версія','Version','Версия'],['prc.v.from','Діє з','Effective from','Действует с'],['prc.inc','підвищення','increase','повышение'],['prc.view','Переглянути','View','Посмотреть'],
['prc.v.current','Чинна','Current','Действует'],['prc.v.awaiting','Чекає підпису Заказу','Awaiting Order Form signature','Ждёт подписи Заказа'],['prc.pendSign','Версія {v} (з {d}) почне діяти після підписання нової версії Заказу обома сторонами.','Version {v} (from {d}) applies once the new Order Form version is signed by both parties.','Версия {v} (с {d}) начнёт действовать после подписания новой версии Заказа обеими сторонами.'],['prc.v.pending','Запланована','Scheduled','Запланирована'],['prc.v.past','Попередня','Past','Прошлая'],['prc.v.withdrawn','Відкликана','Withdrawn','Отозвана'],['prc.verT','Прайс-лист {c} · версія {v}','{c} price list · version {v}','Прайс-лист {c} · версия {v}'],
['prc.from24','Токен на 2 роки','2-year token','Токен на 2 года'],
['prc.adm.title','Новий прайс-лист: {c}','New price list: {c}','Новый прайс-лист: {c}'],['prc.adm.note3','Збереження створює нову версію (зараз остання — v{v}). Підвищення будь-якої ціни, утримання чи збору набуває чинності не раніше ніж через 90 днів; зниження — з вибраної дати. У Заказ ціни потрапляють лише під час його формування.','Saving creates a new version (latest is v{v}). Any increase in a price, retained amount or fee takes effect no sooner than 90 days; decreases apply from the chosen date. Prices enter the Order Form only when it is generated.','Сохранение создаёт новую версию (сейчас последняя — v{v}). Повышение любой цены, удержания или сбора вступает в силу не раньше чем через 90 дней; снижение — с выбранной даты. В Заказ цены попадают только при его формировании.'],
['prc.adm.fromH','Для підвищення — щонайменше +90 днів','For increases — at least +90 days','Для повышения — минимум +90 дней'],['prc.adm.noteF','Коментар до версії','Version note','Комментарий к версии'],['prc.adm.seed','Заповнити базовими цінами','Fill with base prices','Заполнить базовыми ценами'],['prc.adm.seeded','Базові ціни підставлено — перевірте й збережіть','Base prices filled in — check and save','Базовые цены подставлены — проверьте и сохраните'],['prc.adm.save','Зберегти нову версію','Save new version','Сохранить новую версию'],
['prc.adm.minFirst','Мінімум ключів у першому замовленні','Minimum keys in the first order','Минимум ключей в первом заказе'],['prc.adm.minNext','Мінімум ключів у наступних','Minimum keys in later orders','Минимум ключей в следующих'],['prc.adm.minFirstH','Для цього партнера','For this partner','Для этого партнёра'],['prc.adm.minNextH','Для цього партнера','For this partner','Для этого партнёра'],
['prc.err.fee','Від 0 до 3','From 0 to 3','От 0 до 3'],['prc.toast.min','мінімуми замовлення оновлено','order minimums updated','минимумы заказа обновлены'],['prc.toast.ver','Версія {v} ({c}) діє з {d}','Version {v} ({c}) effective {d}','Версия {v} ({c}) действует с {d}'],['prc.toast.inc','Підвищення: версія {v} ({c}) набуде чинності {d}','Increase: version {v} ({c}) takes effect on {d}','Повышение: версия {v} ({c}) вступит в силу {d}'],['prc.toast.clamped','Дату перенесено, щоб дотримати 90 днів.','Date moved to respect the 90-day notice.','Дата перенесена, чтобы соблюсти 90 дней.'],['prc.log.ver','Новий прайс-лист: {c}, версія {v}','New price list: {c}, version {v}','Новый прайс-лист: {c}, версия {v}'],
['calc.sub','Вкажіть продажі й роздрібні ціни — побачите дохід, маржу й окупність. Оптові ціни OTA в USD перераховуються за курсом.','Enter your sales and retail prices to see revenue, margin and payback. OTA’s USD wholesale prices are converted at your rate.','Укажите продажи и розничные цены — увидите доход, маржу и окупаемость. Оптовые цены OTA в USD пересчитываются по курсу.'],
['calc.g.retail','Роздрібна ціна для клієнта, з податками','Retail price to the customer, incl. taxes','Розничная цена для клиента, с налогами'],['calc.retailH','Місячна ціна в місцевій валюті. Пакет = місяці × ціна × (1 − знижка).','Monthly price in local currency. Package = months × price × (1 − discount).','Месячная цена в местной валюте. Пакет = месяцы × цена × (1 − скидка).'],
['calc.pkH','Решта платить OTA напряму щомісяця (пряма підписка) — ви отримуєте комісію','The rest pay OTA directly every month (direct subscription) — you earn a commission','Остальные платят OTA напрямую ежемесячно (прямая подписка) — вы получаете комиссию'],
['calc.g.direct','Прямі підписки','Direct subscriptions','Прямые подписки'],['calc.ded','Утримання з оплат клієнтів','Deducted from customer payments','Удержания из оплат клиентов'],['calc.dedH','Податки OTA в країні клієнта, еквайринг, повернення, збір країни','OTA taxes in the customer’s country, acquiring, refunds, country fee','Налоги OTA в стране клиента, эквайринг, возвраты, сбор страны'],
['calc.directH','Ваша комісія за місяць = роздрібна ціна × (1 − утримання) − сума, що утримує OTA (Standard: {r}).','Your monthly commission = retail × (1 − deductions) − OTA Retained Amount (Standard: {r}).','Ваша комиссия за месяц = розничная цена × (1 − удержания) − сумма, удерживаемая OTA (Standard: {r}).'],
['calc.fxH2','Базовий курс: {fx}','Reference rate: {fx}','Базовый курс: {fx}'],['calc.k.mpS','Витрати {c} (≈ {u})','Costs {c} (≈ {u})','Затраты {c} (≈ {u})'],['calc.k.pbS','ключ {s}','key {s}','ключ {s}'],['calc.costs','Ключі, токени й утримання OTA','Keys, tokens & OTA retained','Ключи, токены и удержание OTA'],
['calc.pd.note','Пристрій, проданий на початку першого року, з урахуванням частки пакетів і відтоку; мінус ключ активації.','A device sold at the start of year 1, with package share and churn applied; Activation Key deducted.','Устройство, проданное в начале первого года, с учётом доли пакетов и оттока; за вычетом ключа активации.'],
['calc.foot','Розрахунок ілюстративний і базується на ваших припущеннях — це не гарантія доходу. Виручка прямих підписок показана після утримань; платежі за межами горизонту не враховано.','Illustrative estimate based on your assumptions — not a guarantee of income. Direct subscription revenue is shown after deductions; payments beyond the horizon are not counted.','Расчёт иллюстративный и основан на ваших допущениях — это не гарантия дохода. Выручка прямых подписок показана после удержаний; платежи за пределами горизонта не учтены.'],
];const o={uk:{},en:{},ru:{}};R.forEach(([k,uk,en,ru])=>{o.uk[k]=uk;o.en[k]=en;o.ru[k]=ru;});I18N.add(o);})();
