/* ===== Actual revenue vs plan (act_) =====
   Plan = the partner's Revenue calculator assumptions spread by month from the programme start.
   Actual = what really happened: devices connected (SIM installed; cost = Activation Key), packages activated (retail price from
   the plan assumptions, cost = price of the country's Service Token lot actually used, in the Order Form currency, × FX), and direct subscriptions of connected
   devices without a package (revenue = retail after deductions, cost = OTA Retained Amount → the difference is the commission).
   Amounts in the calculator's local currency. Pack v12: one country at a time (the calculator's country) — devices, codes and lots of that
   country only, so amounts never mix USD and EUR price lists. */
nav({key:'actual',label:()=>t('act.nav'),icon:'chart',href:'#actual',order:72,section:()=>t('prc.sec')});
function act_cur(){return calc_state().cur;}
function act_ym(d){d=typeof d==='string'?new Date(d):d;return d.getFullYear()*12+d.getMonth();}
function act_mLabel(ym){const d=new Date(Math.floor(ym/12),ym%12,1);return d.toLocaleDateString(LOCALES[S.lang],{month:'short',year:'2-digit'}).replace(/\s?р\.$|\s?г\.$/,'');}
function act_start(){const o=S.org||{};let ym=act_ym(o.createdAt||now());return ym;}
function act_plan(c,M0,M1){const wh=calc_wh(c);const N=Math.max(1,M1-M0+1);const share={std:c.std/100,light:1-c.std/100};
 const H=c.h*12;const prof={light:calc_profile('light',c,wh),std:calc_profile('std',c,wh)};const PL=CALC_PLANS;
 const out=[];for(let i=0;i<N;i++)out.push({dev:0,rev:0,cost:0});
 for(let s=0;s<N;s++){const perMonth=c.dev*Math.pow(1+c.growth/100,Math.floor(s/12))/12;out[s].dev+=perMonth;
  PL.forEach(p=>{const n=perMonth*share[p];if(!n)return;const P=prof[p];for(let k=0;k<N-s&&k<H;k++){out[s+k].rev+=n*P.rev[k];out[s+k].cost+=n*P.cost[k];}});}
 return out;}
function act_actual(c,M0,M1){const N=Math.max(1,M1-M0+1);const out=[];for(let i=0;i<N;i++)out.push({dev:0,pkg:0,subs:0,revPkg:0,revSub:0,cost:0,rev:0});
 const wh=calc_wh(c);const retail={light:c.rLight,std:c.rStd,prem:c.rStd*1.5};const disc={12:10,24:c.d24,36:c.d36,48:35,60:c.d60};
 const shc={};(S.shipments||[]).forEach(h=>{shc[h.id]=h.cc;});const ccOf=s=>shc[s.shipmentId]||primaryCc();const simCcBy={};for(const s of S.sims)simCcBy[s.iccid]=ccOf(s);
 const lots={};(S.tokenLots||[]).forEach(l=>{lots[l.id]=l;});const klots={};(S.keyLots||[]).forEach(l=>{klots[l.id]=l;});const mm={};allModels().forEach(x=>{mm[x.model.id]=x.model;});
 const nowYm=act_ym(now());
 for(const s of S.sims){if(s.status!=='active'||ccOf(s)!==c.cc)continue;const ev=(s.events||[]).find(e=>e[1]==='installed'||e[1]==='whitelisted');if(!ev)continue;
  const i0=act_ym(ev[0])-M0;if(i0>=N)continue;const md=mm[s.modelId];const plan=s.plan||(md&&md.plan)||'std';
  if(i0>=0){out[i0].dev++;const kl=s.keyLotId&&klots[s.keyLotId];out[i0].cost+=kl?kl.unit*c.fx:wh.key;}
  // package or subscription months
  const pkgEv=s.code?S.codes.find(c=>c.code===s.code):null;
  const pkgStart=pkgEv&&pkgEv.activatedAt?act_ym(pkgEv.activatedAt):null;const pkgEnd=pkgStart!=null?pkgStart+s.term:null;
  for(let m=Math.max(0,i0);m<N;m++){const ym=M0+m;if(ym>nowYm)break;
   if(pkgStart!=null&&ym>=pkgStart&&ym<pkgEnd)continue; // covered by package
   out[m].subs++;out[m].revSub+=retail[plan]*(1-wh.ded);out[m].cost+=(wh.month[plan]!=null?wh.month[plan]:retainedAmt(plan,c.cc)*c.fx);}}
 for(const c2 of S.codes){if(c2.status!=='activated'||!c2.activatedAt||(c2.iccid&&simCcBy[c2.iccid]&&simCcBy[c2.iccid]!==c.cc))continue;const i=act_ym(c2.activatedAt)-M0;if(i<0||i>=N)continue;
  const r=retail[c2.plan]*c2.term*(1-(disc[c2.term]||0)/100);const lot=c2.lotId&&lots[c2.lotId];const cost=(lot?lot.unit:tokenPrice(c2.plan,c2.term,c.cc))*c.fx;
  out[i].pkg++;out[i].revPkg+=r;out[i].cost+=cost;}
 out.forEach(o=>{o.rev=o.revPkg+o.revSub;});return out;}
function act_dev(a,p){if(!p)return '<span class="faint">—</span>';const d=(a-p)/p;const tone=d>=0?'ok':d>-0.15?'warn':'bad';return ui.badge((d>=0?'+':'−')+pct(Math.abs(d)),tone);}
function act_chart(lbl,plan,fact){const W=760,H=240,pl=56,pb=28,pt=12;const n=lbl.length;const max=Math.max(1,...plan,...fact)*1.1;
 const bw=(W-pl-10)/n;const y=v=>pt+(H-pt-pb)*(1-v/max);const ticks=4;let g='';
 for(let i=0;i<=ticks;i++){const v=max*i/ticks;g+=`<line x1="${pl}" x2="${W-6}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${pl-8}" y="${y(v)+4}" text-anchor="end" font-size="11" fill="var(--ink3)">${calc_short(v)}</text>`;}
 lbl.forEach((l,i)=>{const x=pl+i*bw;const w=Math.min(28,bw*0.32);
  g+=`<rect x="${x+bw/2-w-2}" y="${y(plan[i])}" width="${w}" height="${y(0)-y(plan[i])}" rx="3" fill="var(--line2)"><title>${esc(l)} · ${esc(t('act.plan'))}: ${money(plan[i],act_cur())}</title></rect>
  <rect x="${x+bw/2+2}" y="${y(fact[i])}" width="${w}" height="${y(0)-y(fact[i])}" rx="3" fill="var(--accent)"><title>${esc(l)} · ${esc(t('act.fact'))}: ${money(fact[i],act_cur())}</title></rect>
  <text x="${x+bw/2}" y="${H-8}" text-anchor="middle" font-size="11" fill="var(--ink3)">${esc(l)}</text>`;});
 const aria=lbl.map((l,i)=>`${l}: ${t('act.plan')} ${money(plan[i],act_cur())}, ${t('act.fact')} ${money(fact[i],act_cur())}`).join('; ');
 return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(aria)}" style="max-height:280px">${g}</svg><div class="row g16 small muted" style="margin-top:6px"><span class="row g4"><i class="act_sw" style="background:var(--line2)"></i>${t('act.plan')}</span><span class="row g4"><i class="act_sw" style="background:var(--accent)"></i>${t('act.fact')}</span></div>`;}
route('actual',{nav:'actual',render(){
 const c=calc_state();const M0=act_start();const M1=act_ym(now());
 const P=act_plan(c,M0,M1),A=act_actual(c,M0,M1);
 {const d=now();const frac=d.getDate()/new Date(d.getFullYear(),d.getMonth()+1,0).getDate();const L=P[P.length-1];L.dev*=frac;L.rev*=frac;L.cost*=frac;}const lbl=P.map((_,i)=>act_mLabel(M0+i));
 const sum=(arr,k)=>arr.reduce((a,o)=>a+(typeof k==='function'?k(o):o[k]),0);
 const pRev=sum(P,'rev'),aRev=sum(A,'rev'),pMar=sum(P,o=>o.rev-o.cost),aMar=sum(A,o=>o.rev-o.cost),pDev=sum(P,'dev'),aDev=sum(A,'dev'),aPkg=sum(A,'pkg');
 const kp=(label,a,p,fmt)=>`<div class="card kpi"><span class="k">${label}</span><span class="v">${fmt(a)}</span><span class="s">${t('act.vsPlan',{p:fmt(p)})} ${act_dev(a,p)}</span></div>`;
 const kpis=`<div class="grid4">${kp(t('act.k.rev'),aRev,pRev,v=>money(v,c.cur))}${kp(t('act.k.margin'),aMar,pMar,v=>money(v,c.cur))}${kp(t('act.k.dev'),aDev,pDev,v=>fmtNum(Math.round(v)))}<div class="card kpi"><span class="k">${t('act.k.pkg')}</span><span class="v">${fmtNum(aPkg)}</span><span class="s">${aDev?t('act.k.pkgS',{p:pct(aPkg/Math.max(1,aDev))}):''}</span></div></div>`;
 const rows=P.map((p,i)=>{const a=A[i];const partial=M0+i===M1;return{cells:[`<b>${esc(lbl[i])}</b>${partial?` <span class="xs faint">${t('act.partial')}</span>`:''}`,
  `<span class="num">${fmtNum(Math.round(p.dev))} / <b>${fmtNum(a.dev)}</b></span>`,`<span class="num">${fmtNum(a.pkg)}</span>`,`<span class="num">${fmtNum(a.subs)}</span>`,
  `<span class="num" style="white-space:nowrap">${money(p.rev,c.cur)}</span>`,`<span class="num" style="white-space:nowrap"><b>${money(a.rev,c.cur)}</b></span>`,act_dev(a.rev,p.rev),
  `<span class="num" style="white-space:nowrap">${money(a.rev-a.cost,c.cur)}</span>`,act_dev(a.rev-a.cost,p.rev-p.cost)]};});
 rows.push({cells:[`<b>${t('c.total')}</b>`,`<span class="num">${fmtNum(Math.round(pDev))} / <b>${fmtNum(aDev)}</b></span>`,`<b class="num">${fmtNum(aPkg)}</b>`,'',`<b class="num" style="white-space:nowrap">${money(pRev,c.cur)}</b>`,`<b class="num" style="white-space:nowrap">${money(aRev,c.cur)}</b>`,act_dev(aRev,pRev),`<b class="num" style="white-space:nowrap">${money(aMar,c.cur)}</b>`,act_dev(aMar,pMar)]});
 const table=ui.card({title:t('act.byMonth'),pad:false,body:ui.table([{label:t('act.month')},{label:t('act.c.dev'),cls:'r'},{label:t('act.c.pkg'),cls:'r'},{label:t('act.c.subs'),cls:'r'},{label:t('act.c.pRev'),cls:'r'},{label:t('act.c.aRev'),cls:'r'},{label:t('act.c.dRev')},{label:t('act.c.aMar'),cls:'r'},{label:t('act.c.dMar')}],rows)});
 const chart=ui.card({title:t('act.chartT'),body:act_chart(lbl,P.map(o=>o.rev),A.map(o=>o.rev))});
 const how=ui.note('info',`${t('act.how',{s:act_mLabel(M0)})} <a href="#calculator">${t('act.toCalc')} →</a>`);
 const ccs=orgCountries();const seg=ccs.length>1?`<div class="row wrap g8" style="align-items:center"><span class="small muted">${t('prc.country')}</span>${ui.seg('act_ccseg',ccs.map(x=>[x,esc(ctyName(x))]),c.cc,'calc_cc')}<span class="xs faint">${esc(c.cur)}</span></div>`:'';
 return ui.page({title:t('act.title'),sub:t('act.sub'),actions:ui.btn(t('act.toCalc'),{icon:'calc',href:'#calculator'}),body:`<div class="stack">${seg}${kpis}${chart}${table}${how}</div>`});}});
I18N.add({
uk:{'act.nav':'Фактичний дохід','act.title':'Фактичний дохід','act.sub':'Що ви реально заробили і наскільки це відрізняється від плану.','act.plan':'План','act.fact':'Факт','act.vsPlan':'план {p}','act.k.rev':'Виручка','act.k.margin':'Ваша маржа','act.k.dev':'Підключено пристроїв','act.k.pkg':'Продано пакетів','act.k.pkgS':'{p} від підключених','act.partial':'(поточний)','act.byMonth':'План і факт по місяцях','act.month':'Місяць','act.c.dev':'Пристрої план / факт','act.c.pkg':'Пакети','act.c.subs':'Прямі підписки','act.c.pRev':'Виручка план','act.c.aRev':'Виручка факт','act.c.dRev':'Відхилення','act.c.aMar':'Маржа факт','act.c.dMar':'Відхилення маржі','act.chartT':'Виручка: план і факт','act.toCalc':'Змінити план','act.how':'План — це ваш калькулятор доходу з початку програми ({s}). Факт рахуємо з реальних підключень (витрата — ключ активації), активацій пакетів (собівартість — ціна партії токенів країни, з якої списано, у валюті Замовлення (USD або EUR), × курс, якщо роздріб в іншій валюті) і прямих підписок: виручка після утримань мінус сума, що утримує OTA, — це ваша комісія.'},
en:{'act.nav':'Actual revenue','act.title':'Actual revenue','act.sub':'What you actually earned and how far it is from the plan.','act.plan':'Plan','act.fact':'Actual','act.vsPlan':'plan {p}','act.k.rev':'Revenue','act.k.margin':'Your margin','act.k.dev':'Devices connected','act.k.pkg':'Packages sold','act.k.pkgS':'{p} of connected','act.partial':'(current)','act.byMonth':'Plan vs actual by month','act.month':'Month','act.c.dev':'Devices plan / actual','act.c.pkg':'Packages','act.c.subs':'Direct subscriptions','act.c.pRev':'Revenue plan','act.c.aRev':'Revenue actual','act.c.dRev':'Deviation','act.c.aMar':'Margin actual','act.c.dMar':'Margin deviation','act.chartT':'Revenue: plan vs actual','act.toCalc':'Change plan','act.how':'The plan is your revenue calculator from the programme start ({s}). Actuals come from real connections (cost = Activation Key), package activations (cost = price of the country’s token lot used, in the Order Form currency (USD or EUR), × rate when retail is in another currency) and direct subscriptions: revenue after deductions minus the OTA Retained Amount — that is your commission.'},
ru:{'act.nav':'Фактический доход','act.title':'Фактический доход','act.sub':'Что вы реально заработали и насколько это отличается от плана.','act.plan':'План','act.fact':'Факт','act.vsPlan':'план {p}','act.k.rev':'Выручка','act.k.margin':'Ваша маржа','act.k.dev':'Подключено устройств','act.k.pkg':'Продано пакетов','act.k.pkgS':'{p} от подключённых','act.partial':'(текущий)','act.byMonth':'План и факт по месяцам','act.month':'Месяц','act.c.dev':'Устройства план / факт','act.c.pkg':'Пакеты','act.c.subs':'Прямые подписки','act.c.pRev':'Выручка план','act.c.aRev':'Выручка факт','act.c.dRev':'Отклонение','act.c.aMar':'Маржа факт','act.c.dMar':'Отклонение маржи','act.chartT':'Выручка: план и факт','act.toCalc':'Изменить план','act.how':'План — это ваш калькулятор дохода с начала программы ({s}). Факт считаем по реальным подключениям (затраты — ключ активации), активациям пакетов (себестоимость — цена партии токенов страны, из которой списано, в валюте Заказа (USD или EUR), × курс, если розница в другой валюте) и прямым подпискам: выручка после удержаний минус сумма, удерживаемая OTA, — это ваша комиссия.'}});
