/* ===== 75_opsdocs.js — operational documents (ТЗ §5, §8) =====
   13 OTA Tax Invoice / Credit Note (INV)  ·  10 Monthly Reconciliation Statement (RS)  ·  14 Partner Commission Invoice (CI)
   11 SIM Pro Forma (PF)  ·  12 SIM Receipt & Custody Acknowledgment (SR)
   Documents are two-column EN | RU A4 print views built from the legal templates (LEGAL_TPL). Routes:
   #statements, #statement--id, #opsdocs, #opsdoc--type--id (type: inv|cn|rs|ci|pf|sr). State: S.statements, S.commissionInvoices, S.ops (demo payments).
   Engine: lg_render / lg_hash / lg_audit (70_legal.js) are used when present (output verified), otherwise the local renderer below. */

const OPS_PLANS=['light','std','prem'];
const OPS_TYPES=['INV','CN','RS','CI','PF','SR'];

/* ---------- small utils ---------- */
const ops_ymd=x=>{const d=typeof x==='string'?new Date(x):x;return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());};
const ops_n=n=>{n=+n||0;const s=new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Math.abs(n));return (n<0&&Math.abs(n)>=0.005?'−':'')+s;};
const ops_q=n=>new Intl.NumberFormat('en-US').format(+n||0);
const ops_u=n=>{n=+n||0;let s=String(Math.round(n*10000)/10000);if(!/\./.test(s))s+='.00';else if(/\.\d$/.test(s))s+='0';return s;};
const ops_ymOf=d=>String(d.getFullYear()*100+d.getMonth()+1);
const ops_ymLabel=ym=>String(ym).slice(0,4)+'-'+String(ym).slice(4);
const ops_ymName=ym=>new Date(+String(ym).slice(0,4),+String(ym).slice(4)-1,1).toLocaleDateString(LOCALES[S.lang],{month:'long',year:'numeric'}).replace(/\s?г\.$/,'').replace(/\s?р\.$/,'');
const ops_ymStart=ym=>new Date(+String(ym).slice(0,4),+String(ym).slice(4)-1,1);
const ops_ymEnd=ym=>new Date(+String(ym).slice(0,4),+String(ym).slice(4),1,0,0,-1);
const ops_ymDay=(ym,day,h)=>new Date(+String(ym).slice(0,4),+String(ym).slice(4),day,h||23,h?0:59); // day of the month AFTER ym
function ops_addBiz(x,n){const d=new Date(typeof x==='string'?x:x.getTime());let k=0;while(k<n){d.setDate(d.getDate()+1);const w=d.getDay();if(w!==0&&w!==6)k++;}return d;}
const ops_h=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return ((h>>>0)%10000)/10000;};
const ops_filled=x=>x!=null&&String(x).trim()!==''&&!/^(n\/a|0|false)$/i.test(String(x).trim());
const ops_ccL2=cc=>{try{return new Intl.DisplayNames(['ru'],{type:'region'}).of(cc)||cc;}catch(e){return cc;}};
function ops_st(){S.ops=S.ops||{pay:[],ciSeq:{}};S.statements=S.statements||[];S.commissionInvoices=S.commissionInvoices||[];return S.ops;}
function ops_audit(a,o,d){try{if(typeof lg_audit==='function')return lg_audit(a,o,d);}catch(e){}return audit(a,o,d);}
function ops_sha(text){try{if(typeof lg_hash==='function')return Promise.resolve(lg_hash(text));}catch(e){}
 try{return crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)).then(b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join(''));}catch(e){return Promise.resolve('');}}
function ops_asBtn(role){return typeof ord_asBtn==='function'?ord_asBtn(role):'';}
function ops_noPerm(){return ui.note('warn',t('c.noPerm',{r:esc(roleName(actor().role))}));}

/* ---------- direct-subscription payments (demo data: realistic rows per plan, per country, per month) ---------- */
const OPS_RETAIL={UA:{fx:FX,vat:.20,acq:.024,p:{light:129,std:169,prem:249}},KZ:{fx:441.77,vat:.16,acq:.026,p:{light:1490,std:1990,prem:2990}}};
const OPS_MONTHS={UA:{light:[96,142],std:[212,318],prem:[14,27]},KZ:{light:[38,61],std:[74,117],prem:[5,9]}};
function ops_par(cc){return OPS_RETAIL[cc]||OPS_RETAIL.UA;}
function ops_payRows(cc,ym){const o=ops_st();let rows=o.pay.filter(r=>r.cc===cc&&r.ym===ym);if(rows.length)return rows;
 const cur=ops_ymOf(now());if(+ym>=+cur)return [];   // the month must be over
 const P=ops_par(cc),M=OPS_MONTHS[cc]||OPS_MONTHS.UA;const cm=now();const k=(cm.getFullYear()*12+cm.getMonth())-(+String(ym).slice(0,4)*12+(+String(ym).slice(4)-1)); // 1 = previous month
 OPS_PLANS.forEach(pl=>{const base=M[pl];let months=k===1?base[1]:k===2?base[0]:Math.round(base[1]*(k<1?1:1)*(1+(ops_h(cc+ym+pl)-.5)*.2)*(k>2?Math.max(.4,1-.12*(k-2)):1));
  const j=(ops_h(ym+cc+pl+'x')-.5)*.03;const unit=P.p[pl]/P.fx*(1+j);const gross=r2(months*unit);const tax=r2(gross-gross/(1+P.vat));const acq=r2(gross*P.acq);
  const rm=pl==='prem'?0:Math.floor(months*.015);const refund=r2(rm*(P.p[pl]/P.fx/(1+P.vat))*1.02);
  const r={id:uid('pay'),cc,ym,plan:pl,months,gross,tax,acq,refund};o.pay.push(r);rows.push(r);});
 return rows;}

/* ---------- Reconciliation Statement: calculation (frozen into the statement) ---------- */
function ops_calcRS(cc,ym){const rows=ops_payRows(cc,ym);if(!rows.length)return null;
 const end=ops_ymEnd(ym);const pl=priceList(cc,end)||priceList(cc)||plSeed(cc);const fee=pl.fee||0;const ret=pl.retained||plSeed(cc).retained;
 const plans={};const tot={months:0,gross:0,tax:0,acq:0,refunds:0,fee:0,ncr:0,retained:0,corr:0,commission:0};
 OPS_PLANS.forEach(p=>{const r=rows.find(x=>x.plan===p)||{months:0,gross:0,tax:0,acq:0,refund:0};
  const feeAmt=r2((r.gross-r.tax)*fee);const ncr=r2(r.gross-r.tax-r.acq-r.refund-feeAmt);const retained=r2((ret[p]||0)*r.months);
  const o={months:r.months,gross:r.gross,tax:r.tax,acq:r.acq,refunds:r.refund,fee:feeAmt,ncr,retained,corr:0,commission:r2(ncr-retained)};plans[p]=o;Object.keys(tot).forEach(k=>tot[k]=r2(tot[k]+o[k]));});
 tot.months=OPS_PLANS.reduce((a,p)=>a+plans[p].months,0);
 // B: OTA invoices of the month; keys/tokens issued (only after payment)
 const inMonth=x=>{const d=new Date(x);return d>=ops_ymStart(ym)&&d<=end;};
 const invs=S.invoices.filter(i=>i.cc===cc&&i.status!=='cancelled'&&inMonth(i.createdAt));
 const sum=(types,paidOnly)=>r2(invs.filter(i=>!paidOnly||i.status==='paid').reduce((a,i)=>a+i.lines.filter(l=>types.includes(l.type)).reduce((b,l)=>b+l.amount*(1+(i.vatRate||0)),0),0));
 const bk={amount:sum(['key']),paid:sum(['key'],true)};bk.due=r2(bk.amount-bk.paid);const bt={amount:sum(['token','xchg']),paid:sum(['token','xchg'],true)};bt.due=r2(bt.amount-bt.paid);
 const kl=(S.keyLots||[]).filter(l=>l.cc===cc&&!l.revoked),tl=(S.tokenLots||[]).filter(l=>l.cc===cc&&!l.revoked&&l.src!=='exchange');
 const iss={keys:kl.filter(l=>inMonth(l.issuedAt)).reduce((a,l)=>a+l.qty,0),tokens:tl.filter(l=>inMonth(l.issuedAt)).reduce((a,l)=>a+l.qty,0)};
 const kAll=kl.filter(l=>new Date(l.issuedAt)<=end),tAll=tl.filter(l=>new Date(l.issuedAt)<=end);
 const kb=kAll.reduce((a,l)=>a+l.qty,0),ku=kAll.reduce((a,l)=>a+l.used,0);const tb=tAll.reduce((a,l)=>a+l.qty,0),tu=tAll.reduce((a,l)=>a+l.used,0),te=tAll.filter(l=>lotExpired(l,end)).reduce((a,l)=>a+lotFree(l),0);
 const shCc=id=>{const h=(S.shipments||[]).find(x=>x.id===id);return h&&h.cc;};
 const custody=S.sims.filter(s=>s.status==='stock'&&shCc(s.shipmentId)===cc).length;
 const activeTok=S.sims.filter(s=>s.status==='active'&&s.code&&shCc(s.shipmentId)===cc).length;
 const imei=cc===primaryCc()?allModels().filter(x=>inMonth(x.model.createdAt)).reduce((a,x)=>a+x.model.imei.length,0):0;
 return{calc:{plans,tot,fee,retainedRate:ret},b:{keys:bk,tokens:bt,invs:invs.map(i=>i.number)},iss,
  d:{custody,lost:0,keys:[kb,ku,kb-ku],tokens:[tb,tu,tb-tu-te,te],active:[activeTok,tot.months],imei}};}

function ops_genStatement(cc,ym,o){o=o||{};ops_st();const no=docNo('RS',{cc,ym});const ex=S.statements.find(s=>s.no===no);if(ex)return null;
 const c=ops_calcRS(cc,ym);if(!c)return null;const issued=o.issuedAt||iso(now());
 const s=Object.assign({id:uid('rs'),no,cc,ym,issuedAt:issued,deadline:iso(ops_addBiz(issued,5)),status:'issued',tplVer:(ops_tpl('RS')||{}).ver||'T-RS-v3',lines:{},disputes:[],confirmedAt:null,confirmedBy:'',ciId:null},c);
 S.statements.unshift(s);if(!o.silent){ops_audit('statement.generate',no,{cc,ym,commission:s.calc.tot.commission,auto:!!o.auto});log(t('ops.log.gen',{n:no}));}return s;}
function ops_prevYm(){const n=now();return ops_ymOf(new Date(n.getFullYear(),n.getMonth()-1,1));}
function ops_autoConfirm(){let n=0;S.statements.forEach(s=>{if(s.status==='issued'&&now()>=new Date(s.deadline)){s.status='auto';s.confirmedAt=s.deadline;s.confirmedBy='';
  OPS_LINE_KEYS.forEach(k=>{if(!s.lines[k])s.lines[k]={s:'ok'};});ops_audit('statement.auto_confirm',s.no,{deadline:s.deadline});log(t('ops.log.auto',{n:s.no}));n++;}});return n;}
function ops_ensure(){if(!S.authed||!S.org||!S.org.code)return;const o=ops_st();
 if(!o.init){o.init=1;const n=now();const mk=(k)=>ops_ymOf(new Date(n.getFullYear(),n.getMonth()-k,1));const older=mk(2),prev=mk(1);
  orgCountries().forEach(cc=>{ops_payRows(cc,older);ops_payRows(cc,prev);});
  // the older month is already closed: UA confirmed + commission invoice paid, others auto-confirmed (demo history)
  const olderIssued=iso(new Date(n.getFullYear(),n.getMonth()-1,8,9,0));
  orgCountries().forEach((cc,i)=>{const s=ops_genStatement(cc,older,{issuedAt:olderIssued,silent:true});if(!s)return;
   if(i===0){s.status='confirmed';s.confirmedAt=iso(new Date(n.getFullYear(),n.getMonth()-1,12,11,0));s.confirmedBy=(users().find(u=>u.role==='p_sign')||{}).name||'';OPS_LINE_KEYS.forEach(k=>s.lines[k]={s:'ok'});
    const amount=s.calc.tot.commission;const seq=ops_nextSeq(new Date(s.confirmedAt).getFullYear());
    const ci={id:uid('ci'),rsId:s.id,rsNo:s.no,cc,ym:older,mode:'draft',seq,number:(S.org.code||'PPP')+'-INV-'+seq,date:ops_ymd(new Date(n.getFullYear(),n.getMonth()-1,13)),due:ops_ymd(ops_ymDay(older,20)),amount,vatText:'',vat:0,total:amount,file:null,status:'paid',createdAt:iso(new Date(n.getFullYear(),n.getMonth()-1,13,10,0)),createdBy:S.org.signatory||'',
     submittedAt:iso(new Date(n.getFullYear(),n.getMonth()-1,13,10,5)),receivedAt:iso(new Date(n.getFullYear(),n.getMonth()-1,14,9,0)),paidAt:iso(new Date(n.getFullYear(),n.getMonth()-1,20,12,0)),reverseCharge:{done:true,by:'Finance Desk',at:iso(new Date(n.getFullYear(),n.getMonth()-1,14,9,30))}};
    S.commissionInvoices.unshift(ci);s.ciId=ci.id;}
   else{s.status='auto';s.confirmedAt=s.deadline;OPS_LINE_KEYS.forEach(k=>s.lines[k]={s:'ok'});}});
  orgCountries().forEach(cc=>ops_genStatement(cc,prev,{issuedAt:iso(new Date(n.getFullYear(),n.getMonth(),1,8,0)),silent:true}));}
 // automatic job: statement for the previous month (and the month before) exists; deadlines → auto-confirm
 const cur=now();[2,1].forEach(k=>{const ym=ops_ymOf(new Date(cur.getFullYear(),cur.getMonth()-k,1));orgCountries().forEach(cc=>ops_genStatement(cc,ym,{auto:true}));});
 ops_autoConfirm();}
function ops_nextSeq(year){const o=ops_st();o.ciSeq[year]=(o.ciSeq[year]||0)+1;return year+'-'+pad(o.ciSeq[year],4);}

/* ---------- document engine (local renderer for the five templates) ---------- */
function ops_tpl(type){let T=S.templates&&S.templates[type];if(T&&Array.isArray(T.blocks))return T;try{return LEGAL_TPL[type]||null;}catch(e){return null;}}
function ops_sub(s,v,miss,col){s=String(s==null?'':s);const g=k=>col==='ru'&&v[k+'_L2']!=null?v[k+'_L2']:v[k];
 s=s.replace(/\[\[(\w+)\|([\s\S]*?)\]\]/g,(m,k,f)=>ops_filled(g(k))?f:'');
 return s.replace(/\{\{(\w+)\}\}/g,(m,k)=>{if(!(k in v)){miss.add(k);return '';}const x=g(k);return x==null?'':String(x);});}
// long dates like the package documents: 3 September 2026 / 3 сентября 2026
const ops_dl=(x,l)=>{const d=new Date(x);if(isNaN(d))return String(x||'');return d.toLocaleDateString(l==='en'?'en-GB':'ru-RU',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).replace(/\s?г\.$/,'');};
const ops_dv=(v,k,x)=>{v[k]=ops_dl(x,'en');v[k+'_L2']=ops_dl(x,'ru');};
const OPS_TOK_WORD_EN='Service Tokens ',OPS_TOK_WORD_RU='Сервисные токены ';   // ТЗ §8 wording (template 13 says "Service Token"/"Сервисный токен")
const OPS_CI_VAT_DEFAULT='[treatment per Partner\'s tax adviser; for UAE recipient usually outside the scope of Partner\'s VAT, UAE reverse charge by OTA / режим по заключению налогового консультанта Партнёра; для получателя в ОАЭ обычно вне сферы НДС Партнёра, обратное начисление НДС в ОАЭ у OTA]';
const OPS_BLANK='________________';
const ops_f=s=>esc(s).replace(/\n/g,'<br>');
function ops_cellHtml(c){return c.ru&&c.ru!==c.en?`<span lang="en">${ops_f(c.en)}</span><span class="ru" lang="ru">${ops_f(c.ru)}</span>`:ops_f(c.en);}
function ops_table(b,v,miss,txt){
 const sig=b.kind==='signature',cond=b.rowCond||{};
 const res=b.rows.map((r,i)=>({r,i})).filter(x=>!(cond[x.i]!=null&&!ops_filled(v[cond[x.i]]))).map(x=>({i:x.i,cells:x.r.map(c=>({en:ops_sub(c.en,v,miss,'en'),ru:ops_sub(c.ru,v,miss,'ru'),had:/\{\{/.test((c.en||'')+(c.ru||''))}))}));
 const rows=res.filter(r=>{if(sig||r.i===0||/^RS-/.test(b.id))return true;const c0=r.cells[0];if(!(c0.en||c0.ru)||c0.had)return true;const vc=r.cells.slice(1);
  return !(vc.some(c=>c.had)&&vc.every(c=>!c.en&&!c.ru));});          // N/A rule: a row whose data is empty disappears
 if(rows.length<=(sig?0:1))return '';
 const nc=Math.max(...rows.map(r=>r.cells.length));const num=[];
 for(let j=1;j<nc;j++){const xs=rows.filter(r=>r.i>0).map(r=>(r.cells[j]||{}).en||'').filter(Boolean);num[j]=!sig&&xs.length>0&&xs.every(x=>/^[−-]?[\d,]+(\.\d+)?$|^—$/.test(x))&&xs.some(x=>/\d/.test(x));}
 const td=(c,j,tag)=>`<${tag} class="${num[j]?'r':''}">${ops_cellHtml(c)}</${tag}>`;
 const body=rows.map(r=>{txt.push(r.cells.map(c=>c.en+(c.ru&&c.ru!==c.en?' / '+c.ru:'')).join(' | '));
  if(!sig&&r.i===0)return `<tr>${r.cells.map((c,j)=>td(c,j,'th')).join('')}</tr>`;
  return `<tr>${r.cells.map((c,j)=>j===0&&(sig||r.cells.length>2&&false)?td(c,j,'th'):td(c,j,'td')).join('')}</tr>`;}).join('');
 return `<div class="ops_blk ops_tw"><table class="ops_t ${sig?'sig':''}">${body}</table></div>`;}
function ops_block(b,v,miss,txt){
 if(b.cond&&!ops_filled(v[b.cond]))return '';
 if(b.kind==='table'||b.kind==='signature')return ops_table(b,v,miss,txt);
 const en=ops_sub(b.en,v,miss,'en'),ru=ops_sub(b.ru,v,miss,'ru');if(!en&&!ru)return '';txt.push(en);if(ru&&ru!==en)txt.push(ru);
 if(b.kind==='heading'){const big=/-title$/.test(b.id);return `<div class="ops_blk ${big?'ops_title':'ops_hd2'}"><div lang="en">${ops_f(en)}</div><div lang="ru">${ops_f(ru)}</div></div>`;}
 return `<div class="ops_blk ops_p"><div lang="en">${ops_f(en)}</div><div lang="ru">${ops_f(ru)}</div></div>`;}
function ops_render(blocks,v){const miss=new Set(),txt=[];const html=blocks.map(b=>ops_block(b,v,miss,txt)).join('');return{html,text:txt.join('\n'),missing:[...miss]};}
// lg_render (70_legal.js) when present: our template + values are passed in; output is accepted only if it contains our own figures (else local renderer)
function ops_compose(type,T,v,o,expect){let eng=null;
 if(typeof lg_render==='function'&&!o.noEngine){try{const r=lg_render(type.toUpperCase(),{tpl:T,vals:v,docNo:o.no,date:o.date,cc:o.cc||null});
  if(r&&!r.error&&r.html){const tx=String(r.text||'');if(expect.every(e=>tx.indexOf(e)>=0))eng=r;}}catch(e){console.error(e);}}
 const r=eng||ops_render(T.blocks,v);return{html:ops_wrap(T,o,r,eng),text:r.text||String(r.html).replace(/<[^>]+>/g,' '),missing:r.missing||[],engine:!!eng};}

function ops_wrap(T,o,r,eng){const ota=o.ota||S.ota||{};const name=String(ota.OTA_NAME||'OTA TECHNOLOGY DMCC');
 const hd=`${name} · CONNECT FOR BRANDS · Doc ${T.docNo||''} of 14 · ${o.titleEn} · ${o.no} · ${T.ver||''}`;
 const ft=`© ${new Date(o.date).getUTCFullYear()} ${name}. All rights reserved · Confidential · Конфиденциально · ${o.no}`;
 if(eng)return `<div class="lgd-wrap">${eng.html}</div>`;
 if(typeof lg_paginate==='function')return `<div class="lgd-wrap"><article class="lgd ops_lgd" data-paginate="1" data-header="${esc(hd)}" data-footer="${esc(ft)}"><div class="lgd-flow">${r.html}</div></article></div>`;
 return `<article class="ops_sheet" aria-label="${esc(o.titleEn+' '+o.no)}"><div class="ops_hd">${esc(hd)}</div><div class="ops_langs"><span>English</span><span>Русский</span></div><div class="ops_body">${r.html}</div><div class="ops_ft">${esc(ft)}</div></article>`;}

/* ---------- values ---------- */
function ops_F(k,fb){const f=S.form&&S.form[k];let x=f&&f.status!=='na'&&f.value!=null&&typeof f.value!=='object'?String(f.value).trim():'';if(!x&&fb!=null&&!(f&&f.status==='na'))x=String(fb||'').trim();return x;}
// bank details in force = S.org.bank (legal module: a pending change in S.bankChange never applies before signature + callback)
const ops_bk=(b,k,fk)=>{const x=b&&b[k]!=null?String(b[k]).trim():'';return x||ops_F(fk,'');};
function ops_vP(){const o=S.org||{},b=o.bank||{};return{P_NAME:ops_F('P_NAME',o.name),P_REGNO:ops_F('P_REGNO',o.regNo),P_TAXNO:ops_F('P_TAXNO',o.taxId),P_ADDR_EN:ops_F('P_ADDR_EN',o.address),P_SIGNATORY:ops_F('P_SIGNATORY',o.signatory),P_TITLE_EN:ops_F('P_TITLE_EN',o.title),P_TITLE_L2:ops_F('P_TITLE_L2',o.title),
 P_BANK_BENEFICIARY:ops_bk(b,'benef','P_BANK_BENEFICIARY'),P_BANK_IBAN:ops_bk(b,'iban','P_BANK_IBAN'),P_BANK_NAME:ops_bk(b,'bank','P_BANK_NAME'),P_BANK_ADDR:ops_bk(b,'bankAddr','P_BANK_ADDR'),P_BANK_SWIFT:ops_bk(b,'swift','P_BANK_SWIFT'),P_BANK_INTERMEDIARY:ops_bk(b,'interSwift','P_BANK_INTERMEDIARY'),P_CODE:o.code||''};}
const OPS_OTA_KEYS=['OTA_NAME','OTA_ADDR_EN','OTA_REGNO','OTA_LICENCE','OTA_TRN','OTA_BANK_ACCOUNT','OTA_BANK_IBAN','OTA_BANK_NAME','OTA_BANK_ADDR','OTA_BANK_SWIFT','OTA_SIGNATORY','OTA_TITLE_EN','OTA_TITLE_L2'];   // v10: no customs code
function ops_vO(src){src=src||S.ota||{};const v={};OPS_OTA_KEYS.forEach(k=>{const x=src[k];v[k]=x==null||String(x).trim().toUpperCase()==='N/A'?'':String(x).trim();});return v;}
function ops_vSys(){const l=(S.org&&S.org.lang2)||'ru';return{LANG2_NAME_EN:l==='uk'?'Ukrainian':'Russian',LANG2_NAME_L2:l==='uk'?'украинском':'русском'};}
function ops_vCc(cc){return{CC:cc||'',CC_NAME_EN:ctyNameEn(cc),CC_NAME_L2:ops_ccL2(cc)};}
function ops_vRef(cc){return{DOC_NO_MPA:docRef('MPA')||'[MPA no.]',DOC_NO_OF:docRef('OF',cc)||'[Order Form no.]'};}
const ops_seqOf=no=>String(no).replace(/^[A-Z]+-(INV|CN|PF|SR)-/,'');
const OPS_IC='';

/* ---------- INV (13) / CN (13A) ----------
   ТЗ v10 2.2: one VAT line (0%, 0.00) + mandatory "VAT amount in AED at the UAE Central Bank rate {AED_RATE} on the invoice date — AED 0.00"
   (rate stored with the invoice). 2.3: credit notes come ONLY from the 13A template LEGAL_TPL.CN (keys CN_NUMBER, CN_DATE, CN_INV_NUMBER, CN_INV_DATE,
   CN_REASON, CN_LINES, AED_RATE); while it is missing, a fallback built from the 13A wording is rendered and OTA mode says so. Rows are found by content. */
const ops_hasKey=(row,re)=>row.some(c=>re.test(String(c.en||'')+String(c.ru||'')));
function ops_invTpl(inv){const T=JSON.parse(JSON.stringify(ops_tpl('INV')));const by=id=>T.blocks.find(b=>b.id===id);
 const C=(en,ru,bi)=>({en,ru:ru==null?en:ru,bi:!!bi});
 const t4=T.blocks.find(b=>b.rows&&b.rows.some(r=>ops_hasKey(r,/INV_KEY_QTY/)));const R=t4.rows;const find=re=>R.find(r=>ops_hasKey(r,re));
 const hdr=R[0],keyRow=find(/INV_KEY_QTY/),tokRow=find(/INV_TOK_QTY/),subRow=find(/INV_SUBTOTAL/),totRow=find(/INV_TOTAL\b/),vatRow=find(/VAT 0%/),aedRow=find(/\bAED\b/);
 const rows=[hdr];let n=0;
 const clone=(row,m)=>row.map(c=>({en:Object.keys(m).reduce((a,k)=>a.split(k).join(m[k]),c.en||''),ru:Object.keys(m).reduce((a,k)=>a.split(k).join(m[k]),c.ru||''),bi:c.bi}));
 const numRow=r=>{r[0]=C(String(++n),String(n));return r;};
 inv.lines.filter(l=>l.type==='key').forEach(l=>rows.push(numRow(clone(keyRow,{'{{INV_KEY_QTY}}':ops_q(l.qty),'{{INV_KEY_PRICE}}':ops_u(l.unit),'{{INV_KEY_AMOUNT}}':ops_n(l.amount),'{{CC_NAME_EN}}':ctyNameEn(l.cc||inv.cc),'{{CC_NAME_L2}}':ops_ccL2(l.cc||inv.cc)}))));
 inv.lines.filter(l=>l.type==='token').forEach(l=>{const r=clone(tokRow,{'{{INV_TOK_PLAN}}':PLAN_EN[l.plan],'{{INV_TOK_TERM}}':String(l.term),'{{INV_TOK_QTY}}':ops_q(l.qty),'{{INV_TOK_PRICE}}':ops_u(l.unit),'{{INV_TOK_AMOUNT}}':ops_n(l.amount)});
  r[1]={en:r[1].en.replace(/Service Token(?!s) /,OPS_TOK_WORD_EN),ru:r[1].ru.replace(/Сервисный токен /,OPS_TOK_WORD_RU),bi:r[1].bi};rows.push(numRow(r));});
 inv.lines.filter(l=>l.type==='xchg').forEach(l=>rows.push(numRow([C(''),C(lineDescEn(l),lineDescL2(l,'ru'),true),C(ops_q(l.qty)),C(ops_u(l.unit)),C(ops_n(l.amount))])));
 rows.push(clone(subRow,{'{{INV_SUBTOTAL}}':ops_n(inv.net)}));
 rows.push(vatRow?vatRow.map(c=>({en:c.en,ru:c.ru,bi:c.bi})):[C(''),C(VAT0_EN,VAT0_L2.ru,true),C(''),C(''),C('0.00')]);   // always exactly one VAT line, 0%
 rows.push(aedRow?aedRow.map(c=>({en:c.en,ru:c.ru,bi:c.bi})):[C(''),C(AED_LINE.en.replace('{r}','{{AED_RATE}}'),AED_LINE.ru.replace('{r}','{{AED_RATE}}'),true),C(''),C(''),C('AED 0.00')]);
 rows.push(clone(totRow,{'{{INV_TOTAL}}':ops_n(inv.total)}));
 t4.rows=rows;delete t4.rowCond;
 // references (MPA / Order Form): columns only when present
 const t3=T.blocks.find(b=>b.rows&&b.rows.some(r=>ops_hasKey(r,/DOC_NO_MPA/))&&b.kind==='table'&&b!==t4);const mpa=inv.mpa||docRef('MPA')||'',of=inv.of||docRef('OF',inv.cc)||'';
 if(t3){const cols=[];if(mpa)cols.push([t3.rows[0][0],C(mpa)]);if(of)cols.push([t3.rows[0][1],C(of)]);
  if(!cols.length)T.blocks=T.blocks.filter(b=>b!==t3);else t3.rows=[cols.map(c=>c[0]),cols.map(c=>c[1])];}
 return T;}
function ops_vInv(inv,cn){const b=inv.buyer||{};const d=cn||inv;const v=Object.assign({},ops_vO(inv.seller),ops_vSys(),ops_vCc(inv.cc),{P_NAME:b.name||'',P_ADDR_EN:b.address||'',P_REGNO:b.regNo||'',P_TAXNO:b.taxId||'',
  DOC_SEQ:ops_seqOf(cn?cn.number:inv.number),AED_RATE:fmtAed(d.aedRate!=null?d.aedRate:aedRate(d.createdAt).rate)});ops_dv(v,'DATE',cn?cn.createdAt:inv.createdAt);ops_dv(v,'DUE_DATE',inv.dueAt);return v;}
// CN lines as repeat items; keys of the template's repeat row are discovered (…DESC/QTY/PRICE|UNIT/AMOUNT), plus the documented CN_LINE_* names
function ops_cnItems(T,cn,inv){const lines=cn.lines||inv.lines.map(l=>Object.assign({},l,{amount:-Math.abs(l.amount)}));
 const rb=T&&T.blocks.find(b=>b.repeat&&/CN_LINES/.test(b.repeat.list||''));const keys=new Set();
 if(rb){const row=rb.rows[rb.repeat.row]||[];row.forEach(c=>String((c.en||'')+(c.ru||'')).replace(/\{\{(\w+)\}\}/g,(m,k)=>{keys.add(k);return m;}));}
 const pick=(re,dflt)=>[...keys].find(k=>re.test(k))||dflt;
 const kN=pick(/(^|_)(NO|NUM|N)$/,'CN_LINE_NO'),kD=pick(/DESC/,'CN_LINE_DESC'),kDl2=[...keys].find(k=>/DESC.*L2|L2.*DESC/.test(k)),kQ=pick(/QTY/,'CN_LINE_QTY'),kP=pick(/PRICE|UNIT/,'CN_LINE_PRICE'),kA=pick(/AMOUNT|SUM/,'CN_LINE_AMOUNT');
 return lines.map((l,i)=>{const o={};o[kN]=String(i+1);o[kD]=lineDescEn(l)+(kDl2?'':' / '+lineDescL2(l,'ru'));if(kDl2)o[kDl2]=lineDescL2(l,'ru');o[kQ]=ops_q(l.qty);o[kP]=ops_u(l.unit);o[kA]=ops_n(Math.abs(l.amount));   // unsigned: the 13A template prints "–"
  o.CN_LINE_DESC_EN=lineDescEn(l);o.CN_LINE_DESC_L2=lineDescL2(l,'ru');return o;});}
function ops_vCn(cn,inv){const v=ops_vInv(inv,cn);const r=CN_REASONS[cn.reason];
 Object.assign(v,{CN_NUMBER:cn.number,CN_INV_NUMBER:inv.number,CN_REASON:r?cn.reason:'error',CN_REASON_TEXT:r?r.en:(cn.reasonNote||''),CN_REASON_TEXT_L2:r?r.ru:(cn.reasonNote||''),CN_SUBTOTAL:ops_n(Math.abs(cn.net)),CN_TOTAL:ops_n(Math.abs(cn.total)),DOC_NO_MPA:inv.mpa||docRef('MPA')||''});
 ops_dv(v,'CN_DATE',cn.createdAt);ops_dv(v,'CN_INV_DATE',inv.createdAt);
 v['CN_REASON_'+String(v.CN_REASON).toUpperCase()]=true;try{if(typeof legalDerive==='function')legalDerive(v);}catch(e){}return v;}
// fallback 13A body (wording of template 13A, v10 pack) — used only while LEGAL_TPL.CN is missing
function ops_cnFallbackTpl(inv){const C=(en,ru,bi)=>({en,ru:ru==null?en:ru,bi:!!bi});const I=JSON.parse(JSON.stringify(ops_tpl('INV')||{blocks:[]}));const t1=I.blocks.find(b=>b.id==='INV-t1');const sig=I.blocks.find(b=>b.kind==='signature');
 return{type:'CN',docNo:'13A',ver:'T-CN-fallback',title:{en:'Tax Credit Note',ru:'Налоговая кредит-нота'},blocks:[
  {id:'CN-title',kind:'heading',en:'TAX CREDIT NOTE',ru:'НАЛОГОВАЯ КРЕДИТ-НОТА'},
  {id:'CN-ref',kind:'para',en:'Document 13A of 14 · Ref. {{CN_NUMBER}}\nThis document is made in English and {{LANG2_NAME_EN}}. In case of any discrepancy, the English version prevails.',ru:'Документ 13A из 14 · № {{CN_NUMBER}}\nДокумент составлен на английском и русском языках. При расхождении текстов преимущественную силу имеет английский текст.'},
  t1||{id:'CN-t1',kind:'table',rows:[[C('Supplier','Поставщик',true),C('Customer','Покупатель',true)],[C('{{OTA_NAME}}\n{{OTA_ADDR_EN}}'),C('{{P_NAME}}\n{{P_ADDR_EN}}')]]},
  {id:'CN-t2',kind:'table',rows:[[C('Credit note no.','№ кредит-ноты',true),C('Date','Дата',true),C('Original invoice','Исходный счёт',true),C('Currency','Валюта',true)],[C('{{CN_NUMBER}}'),C('{{CN_DATE}}','{{CN_DATE}}'),C('{{CN_INV_NUMBER}} of {{CN_INV_DATE}}','{{CN_INV_NUMBER}} от {{CN_INV_DATE}}'),C('USD')]]},
  {id:'CN-t3',kind:'table',rows:[[C('Reason','Основание',true),C('Master Agreement','Рамочное соглашение',true)],[C('{{CN_REASON_TEXT}}','{{CN_REASON_TEXT}}'),C('{{DOC_NO_MPA}}')]]},
  {id:'CN-t4',kind:'table',repeat:{row:1,list:'CN_LINES'},rows:[[C('No.','№',true),C('Description','Описание',true),C('Qty','Кол-во',true),C('Unit price USD','Цена USD',true),C('Amount USD','Сумма USD',true)],
   [C('{{CN_LINE_NO}}'),C('{{CN_LINE_DESC}}'),C('{{CN_LINE_QTY}}'),C('{{CN_LINE_PRICE}}'),C('–{{CN_LINE_AMOUNT}}')],
   [C(''),C('Subtotal credited','Итого к уменьшению без НДС',true),C(''),C(''),C('–{{CN_SUBTOTAL}}')],[C(''),C(VAT0_EN,VAT0_L2.ru,true),C(''),C(''),C('0.00')],
   [C(''),C(AED_LINE_CN.en.replace('{r}','{{AED_RATE}}'),AED_LINE_CN.ru.replace('{r}','{{AED_RATE}}'),true),C(''),C(''),C('AED –0.00')],[C(''),C('Total credited','Итого к уменьшению',true),C(''),C(''),C('–{{CN_TOTAL}}')]]},
  {id:'CN-p1',kind:'para',en:CN_TEXT.en,ru:CN_TEXT.ru}].concat(sig?[sig]:[])};}
function ops_cnTplOk(){try{return !!(LEGAL_TPL&&LEGAL_TPL.CN&&Array.isArray(LEGAL_TPL.CN.blocks));}catch(e){return false;}}
// expand a repeat block locally (fallback renderer has no repeat support)
function ops_expandRepeat(T,v){T.blocks.forEach(b=>{if(!b.repeat||!b.rows)return;const arr=v[b.repeat.list]||[];const ri=b.repeat.row;const tr=b.rows[ri];
 const exp=arr.map(it=>tr.map(c=>({en:String(c.en||'').replace(/\{\{(\w+)\}\}/g,(m,k)=>k in it?it[k]:m),ru:String(c.ru||'').replace(/\{\{(\w+)\}\}/g,(m,k)=>k in it?it[k]:m),bi:c.bi})));
 b.rows=b.rows.slice(0,ri).concat(exp,b.rows.slice(ri+1));delete b.repeat;});return T;}
function ops_buildInv(type,id){let inv,cn=null;
 if(type==='cn'){cn=(S.creditNotes||[]).find(c=>c.id===id);if(!cn)return null;inv=invById(cn.invoiceId);if(!inv)return null;}else{inv=invById(id);if(!inv)return null;}
 const no=cn?cn.number:inv.number,date=cn?cn.createdAt:inv.createdAt;let T,v,r,fallback=false;
 if(cn){const tplOk=ops_cnTplOk();T=JSON.parse(JSON.stringify(tplOk?ops_tpl('CN')||LEGAL_TPL.CN:ops_cnFallbackTpl(inv)));fallback=!tplOk;v=ops_vCn(cn,inv);v.CN_LINES=ops_cnItems(T,cn,inv);
  const o={no,date,cc:inv.cc,titleEn:'Tax Credit Note',ota:inv.seller};
  r=ops_compose('CN',T,v,o,[no]);if(!r.engine){const T2=ops_expandRepeat(JSON.parse(JSON.stringify(T)),v);r=ops_compose('CN',T2,v,Object.assign({},o,{noEngine:true}),[no]);}}
 else{T=ops_invTpl(inv);v=ops_vInv(inv);r=ops_compose('INV',T,v,{no,date,cc:inv.cc,titleEn:'Tax Invoice',ota:inv.seller},[no,ops_n(inv.total)]);}
 return{type,id,no,date,cc:inv.cc,html:r.html,text:r.text,missing:r.missing,tplVer:T.ver,inv,cn,fallback,src:cn?link('cnote',cn.id):link('invoice',inv.id),
  status:cn?'issued':invStatus(inv),title:cn?'Tax Credit Note':'Tax Invoice'};}

/* ---------- RS ---------- */
function ops_rsVals(s){const c=s.calc,pl=OPS_PLANS;const v=Object.assign({},ops_vO(),ops_vP(),ops_vSys(),ops_vCc(s.cc),ops_vRef(s.cc),{RS_MONTH:ops_ymLabel(s.ym),RS_YYYYMM:s.ym});ops_dv(v,'DATE',s.issuedAt);
 pl.forEach(p=>{const K=({light:'LIGHT',std:'STANDARD',prem:'PREMIUM'})[p],x=c.plans[p];v['RS_A_MONTHS_'+K]=ops_q(x.months);
  [['GROSS','gross'],['TAX','tax'],['ACQ','acq'],['REFUNDS','refunds'],['NCR','ncr'],['RETAINED','retained'],['CORR','corr'],['COMMISSION','commission']].forEach(([a,b])=>v['RS_A_'+a+'_'+K]=ops_n(x[b]));
  v['RS_A_FEE_'+K]=c.fee>0?ops_n(x.fee):'—';});
 const b=s.b;v.RS_B_KEYS_AMOUNT=ops_n(b.keys.amount);v.RS_B_KEYS_PAID=ops_n(b.keys.paid);v.RS_B_KEYS_DUE=ops_n(b.keys.due);v.RS_B_TOKENS_AMOUNT=ops_n(b.tokens.amount);v.RS_B_TOKENS_PAID=ops_n(b.tokens.paid);v.RS_B_TOKENS_DUE=ops_n(b.tokens.due);
 v.RS_B_OTHER_AMOUNT='';v.RS_B_OTHER_PAID='';v.RS_B_OTHER_DUE='';v.RS_B_TOTAL_DESC=b.invs.length?b.invs.join(', '):'—';
 v.RS_B_TOTAL_AMOUNT=ops_n(b.keys.amount+b.tokens.amount);v.RS_B_TOTAL_PAID=ops_n(b.keys.paid+b.tokens.paid);v.RS_B_TOTAL_DUE=ops_n(b.keys.due+b.tokens.due);
 const ci=S.commissionInvoices.find(x=>x.id===s.ciId);const com=c.tot.commission;const cpaid=ci&&ci.status==='paid'?ci.total:0;
 v.RS_C_COMMISSION_AMOUNT=ops_n(com);v.RS_C_COMMISSION_PAID=ops_n(cpaid);v.RS_C_COMMISSION_DUE=ops_n(Math.max(0,com-cpaid));
 const d=s.d;v.RS_D_SIM_CUSTODY=ops_q(d.custody);v.RS_D_SIM_LOST=ops_q(d.lost);v.RS_D_KEYS=d.keys.map(ops_q).join(' / ');v.RS_D_TOKENS=d.tokens.map(ops_q).join(' / ');v.RS_D_ACTIVE=d.active.map(ops_q).join(' / ');v.RS_D_IMEI_ADDED=ops_q(d.imei);return v;}
function ops_buildRS(id){const s=S.statements.find(x=>x.id===id);if(!s)return null;const T=ops_tpl('RS');const v=ops_rsVals(s);
 const r=ops_compose('RS',T,v,{no:s.no,date:s.issuedAt,cc:s.cc,titleEn:'Monthly Reconciliation Statement'},[s.no,v.RS_A_COMMISSION_STANDARD]);
 return{type:'rs',id,no:s.no,date:s.issuedAt,cc:s.cc,html:r.html,text:r.text,missing:r.missing,tplVer:T.ver,s,src:link('statement',s.id),status:s.status,title:'Monthly Reconciliation Statement'};}

/* ---------- CI ---------- */
function ops_buildCI(id){const ci=S.commissionInvoices.find(x=>x.id===id);if(!ci||ci.mode==='upload')return null;const s=S.statements.find(x=>x.id===ci.rsId);const T=JSON.parse(JSON.stringify(ops_tpl('CI')));
 // ТЗ v10 2.1: one partner invoice may reference statements of several countries of the month: "per Statement(s) OTA-ARV-RS-UA-202610, OTA-ARV-RS-KZ-202610"
 const RSRE=/OTA-(?:RS-)?\{\{P_CODE\}\}-(?:RS-)?(?:\{\{CC\}\}-)?\{\{RS_YYYYMM\}\}|OTA-(?:RS-)?\{\{P_CODE\}\}-(?:RS-)?\[CC-YYYYMM\]|\{\{RS_NOS?\}\}/g;
 T.blocks.forEach(b=>{if(b.rows)b.rows=b.rows.map(r=>r.map(c=>({en:String(c.en||'').replace(RSRE,'{{RS_NO}}').replace(/per Statement \{\{RS_NO\}\}/,'per Statement(s) {{RS_NO}}'),ru:String(c.ru||'').replace(RSRE,'{{RS_NO}}'),bi:c.bi})));});
 const nos=ci.rsNos&&ci.rsNos.length?ci.rsNos:[ci.rsNo];
 const v=Object.assign({},ops_vO(),ops_vP(),ops_vSys(),ops_vRef(ci.cc),{DOC_SEQ:ci.seq,RS_MONTH:ops_ymLabel(ci.ym),RS_YYYYMM:ci.ym,RS_NO:nos.join(', '),RS_NOS:nos.join(', '),CI_AMOUNT:ops_n(ci.amount),
  CI_VAT_TREATMENT:ci.vatText||OPS_CI_VAT_DEFAULT,CI_VAT_AMOUNT:ops_n(ci.vat),CI_TOTAL:ops_n(ci.total)});
 ops_dv(v,'DATE',ci.date);ops_dv(v,'DUE_DATE',ci.due);const r=ops_compose('CI',T,v,{no:ci.number,date:ci.date,cc:ci.cc,titleEn:'Partner Commission Invoice'},[ci.number,ops_n(ci.total)]);
 return{type:'ci',id,no:ci.number,date:ci.date,cc:ci.cc,html:r.html,text:r.text,missing:r.missing,tplVer:T.ver,ci,src:s?link('statement',s.id):link('opsdocs'),status:ci.status,title:'Partner Commission Invoice'};}

/* ---------- PF / SR / A2 label ----------
   ТЗ v10 1.2: the pro forma shows OTA TECHNOLOGY DMCC as owner of the goods (no TRN), the EU ship-from address, the exporter of record and EORI and the
   country of dispatch / destination. Until the template agent delivers PF v10, the v09 rows are replaced with the v10 wording of Document 11. */
function ops_pfV10(T){const C=(en,ru)=>({en,ru,bi:true});const V=(en,ru)=>({en,ru:ru==null?en:ru});
 T.blocks.forEach(b=>{if(b.rows)b.rows.forEach(r=>r.forEach(c=>{['en','ru'].forEach(l=>{if(c[l])c[l]=c[l].replace(/\s*·\s*TRN\s*\{\{OTA_TRN\}\}/g,'').replace(/\n?TRN( \(VAT\))?\s*\{\{OTA_TRN\}\}/g,'').replace(/\{\{OTA_CUSTOMS_CODE\}\}/g,'');});}));});
 const t1=T.blocks.find(b=>b.id==='PF-t1'||(b.rows&&b.rows.some(r=>/Consignee/.test((r[0]||{}).en||''))));if(!t1)return;
 if(t1.rows.some(r=>/Owner of the goods/.test((r[0]||{}).en||'')))return;   // already v10
 const ix=t1.rows.findIndex(r=>/^Exporter/.test((r[0]||{}).en||''));const own=[C('Owner of the goods','Собственник товара'),V('{{OTA_NAME}}, {{OTA_ADDR_EN}}\nReg. no. {{OTA_REGNO}}')];
 const add=[own,[C('Ship-from address','Адрес отправки'),V('{{SHIP_FROM}}')],[C('Exporter of record and EORI','Экспортёр и EORI'),V('{{EXPORTER_EU}}, EORI {{EXPORTER_EORI}}','{{EXPORTER_EU}}, № EORI {{EXPORTER_EORI}}')]];
 if(ix>=0)t1.rows.splice(ix,1,...add);else t1.rows.splice(2,0,...add);
 t1.rows.forEach((r,i)=>{if(/Country of export/.test((r[0]||{}).en||''))t1.rows[i]=[C('Country of dispatch / destination','Страна отправки / назначения'),V('{{SHIP_FROM_COUNTRY}} / {{CC_NAME_EN}}','{{SHIP_FROM_COUNTRY_L2}} / {{CC_NAME_L2}}')];});
 const p3=T.blocks.find(b=>b.id==='PF-p3');if(p3&&/exporter's records/.test(p3.en||'')){p3.en='I declare that the information in this document is true and correct and is supported by the records of OTA as owner of the goods.';p3.ru='Подтверждаю, что сведения в настоящем документе достоверны и подтверждаются документами OTA как собственника товара.';}
 const t1r=t1.rows.find(r=>/Reason for export/.test((r[0]||{}).en||''));if(t1r&&t1r[1]&&/property of the exporter/.test(t1r[1].en||''))t1r[1]={en:'Free-of-charge transfer into custody of SIM cards remaining the property of OTA or its supplier, for installation in approved IoT devices; not for retail sale',ru:'Безвозмездная передача на хранение SIM-карт, остающихся собственностью OTA или её поставщика, для установки в одобренные IoT-устройства; не для розничной продажи',bi:true};}
// A2 box label: SHIPPER (OWNER OF GOODS) — OTA TECHNOLOGY DMCC + SHIP FROM block (warehouse, exporter, EORI). Label layout only; no legal text.
function ops_buildA2(id){const h=(S.shipments||[]).find(x=>x.id===id);if(!h)return null;const v=ops_shipVals(h);const d=h.dap||{};const n=Math.max(1,+h.cartons||1);const per=i=>{const base=Math.floor(h.qty/n),rest=h.qty-base*n;return base+(i<=rest?1:0);};/* per-box quantity (QA #11) */const name=v.OTA_NAME||'OTA TECHNOLOGY DMCC';
 const box=i=>`<section class="ops_a2" aria-label="A2 label ${i}/${n}"><div class="ops_a2sh"><span class="ops_a2k">SHIPPER (OWNER OF GOODS)</span><b>— ${esc(name)}</b></div>
  <div class="ops_a2g"><div><span class="ops_a2k">SHIP FROM</span><b>${esc(v.SHIP_FROM_NAME)}</b><span>${esc(v.SHIP_FROM_ADDR)}</span><span>${esc(v.SHIP_FROM_COUNTRY)}</span><span>Exporter: ${esc(v.EXPORTER_EU)}</span><span>EORI: <b class="mono">${esc(v.EXPORTER_EORI)}</b></span></div>
  <div><span class="ops_a2k">SHIP TO (DAP)</span><b>${esc(d.company||'')}</b>${d.recipient?`<span>Attn: ${esc(d.recipient)}</span>`:''}<span>${esc([d.address,d.city].filter(Boolean).join(', '))}</span><span>${esc(ctyNameEn(d.country||h.cc))}</span>${d.phone?`<span>Tel. ${esc(d.phone)}</span>`:''}</div></div>
  <div class="ops_a2f"><span>Pro forma <b class="mono">${esc(h.pf)}</b></span><span>Box <b>${i} / ${n}</b></span><span>${esc(ops_q(per(i)))} SIM · HS 8523.52</span></div></section>`;
 const html=`<div class="ops_a2wrap">${Array.from({length:Math.min(n,20)},(_,i)=>box(i+1)).join('')}</div>`;
 const text=['SHIPPER (OWNER OF GOODS) — '+name,'SHIP FROM',v.SHIP_FROM_NAME,v.SHIP_FROM_ADDR,v.SHIP_FROM_COUNTRY,'Exporter: '+v.EXPORTER_EU,'EORI: '+v.EXPORTER_EORI,'Pro forma '+h.pf].join('\n');
 return{type:'a2',id,no:h.pf+' · A2',date:h.createdAt,cc:h.cc,html,text,missing:[],tplVer:'A2 label',h,src:link('shipment',h.id),status:h.status,title:'A2 box label'};}
function ops_shipVals(h){const d=h.dap||{},cc=h.cc;const place=[d.address,d.city,ctyNameEn(d.country||cc)].filter(Boolean).join(', ');const rc=h.receipt;const blank='______________';
 const ff=String(h.simType||'').split(',').slice(1).join(',').trim()||h.simType||'[form factor]';const dl=(h.events||[]).find(e=>e[0]==='delivered');const ph='[  ]';
 const cond=rc?(rc.condition==='intact'?['intact, no visible damage','целая, без видимых повреждений']:['damaged'+(rc.note?' – '+rc.note:''),'повреждена'+(rc.note?' – '+rc.note:'')]):[blank,blank];
 const sf=h.ship_from||SHIP_FROM_DEMO,ex=h.exporter||EXPORTER_DEMO;
 return Object.assign({},ops_vO(),ops_vP(),ops_vSys(),ops_vCc(cc),ops_vRef(cc),{DOC_SEQ:ops_seqOf(h.pf),
  SHIP_FROM_NAME:sf.name||'',SHIP_FROM_ADDR:sf.addr||'',SHIP_FROM_COUNTRY:sf.country?ctyNameEn(sf.country):'',SHIP_FROM_COUNTRY_L2:sf.country?ops_ccL2(sf.country):'',
  SHIP_FROM:[sf.name,sf.addr,sf.country?ctyNameEn(sf.country):''].filter(Boolean).join(', '),EXPORTER_EU:ex.name||'',EXPORTER_EORI:ex.eori||'',
  SHIP_CONSIGNEE:[d.company,d.recipient?'Attn: '+d.recipient:'',place,d.phone?'Tel. '+d.phone:''].filter(Boolean).join('\n'),SHIP_IMPORTER:h.importer||d.importer||'[importer of record and tax ID]',SHIP_PLACE:place,
  SHIP_WAYBILL:h.waybill?((h.carrier||'')+' '+h.waybill).trim():'[to be advised on dispatch]',SHIP_FORM_FACTOR:ff,SHIP_ORIGIN:'[per manufacturer / по документам производителя]',SHIP_QTY:ops_q(h.qty),SHIP_UNIT_VALUE:h.unitValue!=null?ops_u(h.unitValue):ph,SHIP_TOTAL_VALUE:h.unitValue!=null?ops_n(r2(h.unitValue*h.qty)):ph,
  SHIP_CARTONS:h.cartons||ph,SHIP_GROSS_KG:h.gross||ph,SHIP_NET_KG:h.netw||ph,SHIP_ICCID_REF:h.pf+'/ICCID',SHIP_ICCID_RANGE:genIccid(h.iccidFrom)+' – '+genIccid(h.iccidTo),
  SR_DELIVERY:(dl?ops_dl(dl[1],'en'):blank)+', '+place,SR_DELIVERY_L2:(dl?ops_dl(dl[1],'ru'):blank)+', '+place,SR_IMPORTER_DECL:(h.importer||d.importer||'[importer of record]')+' / '+(rc&&rc.customsDecl?rc.customsDecl:blank),SR_STORAGE:rc&&(rc.storage||rc.person)?[rc.storage,rc.person].filter(Boolean).join(', '):blank,
  SR_SIM_TYPE:h.simType||'[SIM type]',SR_RECEIVED:rc?ops_q(rc.received):blank,SR_DIFF:rc?ops_q(rc.diff):blank,SR_CONDITION_EN:cond[0],SR_CONDITION_L2:cond[1],SR_RECEIVER_NAME:rc&&rc.person?rc.person:OPS_BLANK,SR_RECEIVER_TITLE:OPS_BLANK});}
function ops_buildShip(type,id){const h=(S.shipments||[]).find(x=>x.id===id);if(!h)return null;const pf=type==='pf';const T=JSON.parse(JSON.stringify(ops_tpl(pf?'PF':'SR')));const v=ops_shipVals(h);let custom=false;
 if(pf)ops_pfV10(T);
 const n=+h.cartons;if(pf&&n){const p2=T.blocks.find(b=>b.id==='PF-p2');const ruPl=n%10===1&&n%100!==11?'коробка':(n%10>=2&&n%10<=4&&(n%100<10||n%100>=20))?'коробки':'коробок';
  p2.en=p2.en.replace('{{SHIP_CARTONS}} cartons','{{SHIP_CARTONS}} '+(n===1?'carton':'cartons'));p2.ru=p2.ru.replace('{{SHIP_CARTONS}} коробок','{{SHIP_CARTONS}} '+ruPl);}
 ops_dv(v,'DATE',h.createdAt);const no=pf?h.pf:h.sr;const date=pf?h.createdAt:(h.receipt?h.receipt.at:h.createdAt);
 const r=ops_compose(pf?'PF':'SR',T,v,{no,date,cc:h.cc,titleEn:pf?'Pro Forma Invoice for Customs':'SIM Receipt and Custody Acknowledgment'},[no,v.SHIP_QTY]);
 return{type,id,no,date,cc:h.cc,html:r.html,text:r.text,missing:r.missing,tplVer:T.ver,h,src:link('shipment',h.id),status:h.status,title:pf?'Pro Forma Invoice for Customs':'SIM Receipt and Custody Acknowledgment'};}
function ops_build(type,id){type=String(type||'').toLowerCase();try{
 if(type==='inv'||type==='cn')return ops_buildInv(type,id);if(type==='rs')return ops_buildRS(id);if(type==='ci')return ops_buildCI(id);if(type==='pf'||type==='sr')return ops_buildShip(type,id);if(type==='a2')return ops_buildA2(id);}catch(e){console.error(e);}return null;}

/* ---------- print view route ---------- */
function ops_nf(){return ui.page({title:t('ops.nf'),crumbs:[[t('ops.docs.title'),'#opsdocs']],body:ui.card({body:ui.empty('search',t('ops.nf'),t('ops.nf.p'),ui.btn(t('ops.docs.title'),{href:'#opsdocs'}))})});}
const OPS_TYPE_TONE={INV:'accent',CN:'bad',RS:'info',CI:'violet',PF:'warn',SR:'ok',A2:'warn'};
function ops_typeBadge(T){return ui.badge(t('ops.type.'+T),OPS_TYPE_TONE[T]);}
route('opsdoc',{nav:'opsdocs',render(type,id){ops_ensure();const d=ops_build(type,id);if(!d)return ops_nf();const T=d.type.toUpperCase();
 const notes=[];
 if(d.inv&&!d.cn)notes.push(ui.note('info',t('ops.inv.vat0',{cc:esc(ctyName(d.inv.cc))})));
 if(d.fallback&&S.admin)notes.push(ui.note('admin',t('ops.cn.fallback')));
 if(d.type==='ci'&&d.ci.status==='draft')notes.push(ui.note('info',t('ops.ci.draftNote')));
 if(d.type==='ci'&&S.bankChange&&typeof lg_bankBanner==='function'){try{notes.push(lg_bankBanner());}catch(e){}}
 if(d.type==='sr'&&!d.h.receipt)notes.push(ui.note('info',t('ops.sr.blank')));
 if(d.missing&&d.missing.length)notes.push(ui.note('bad',t('ops.missing',{k:d.missing.map(esc).join(', ')})));
 const arg=d.type+':'+d.id;
 const actions=ui.btn(t('ops.print'),{kind:'primary',icon:'printer',act:'ops_print',arg})+ui.btn(t('ops.openSrc'),{kind:'ghost',href:d.src});
 const meta=`<div class="ops_meta ops_noprint">${ops_typeBadge(T)}<span class="xs faint">${esc(d.tplVer)} · ${esc(fmtDate(d.date))}${d.cc?' · '+esc(ctyName(d.cc)):''}</span><span class="xs faint ops_hash"><span>SHA-256:</span> <span class="mono" id="ops_hash" data-key="${esc(arg)}">…</span></span></div>`;
 return ui.page({title:`<span class="mono">${esc(d.no)}</span>`,sub:esc(d.title),crumbs:[[t('ops.docs.title'),'#opsdocs'],[d.no]],actions,body:`<div class="ops_wrapdoc"><div class="stack ops_noprint ops_notes">${notes.join('')}</div>${meta}${d.html}</div>`});}});
ACT.ops_print=arg=>{const [type,...r]=String(arg).split(':');const d=ops_build(type,r.join(':'));if(!d)return;const el=document.getElementById('ops_hash');
 ops_audit('opsdoc.print',d.no,{type:d.type,tpl:d.tplVer,hash:el&&el.dataset.h||''});try{window.print();}catch(e){}};
HOOKS.afterRender.push((name,params)=>{try{
 if(name==='opsdoc'){const el=document.getElementById('ops_hash');if(el){const d=ops_build(params[0],params[1]);if(d)ops_sha(d.text).then(h=>{const e2=document.getElementById('ops_hash');if(e2&&e2.dataset.key===el.dataset.key){e2.dataset.h=h;e2.textContent=h?h.slice(0,16)+'…'+h.slice(-8):'—';e2.title=h;}});}return;}
 let btns='';
 if(name==='invoice'){const i=invById(params[0]);if(i)btns=ops_pbtn('inv',i.id,t('ops.btn.inv'));}
 else if(name==='cnote'){const c=(S.creditNotes||[]).find(x=>x.id===params[0]);if(c)btns=ops_pbtn('cn',c.id,t('ops.btn.cn'));}
 else if(name==='shipment'){const h=(S.shipments||[]).find(x=>x.id===params[0]);if(h)btns=ops_pbtn('pf',h.id,t('ops.btn.pf'))+ops_pbtn('sr',h.id,t('ops.btn.sr'))+ops_pbtn('a2',h.id,t('ops.btn.a2'));}
 if(btns)ops_inject(btns);}catch(e){console.error(e);}});
function ops_pbtn(type,id,label){return `<a class="btn ghost" data-ops-inj="1" href="${link('opsdoc',type,id)}"><svg class="i sm" viewBox="0 0 24 24" aria-hidden="true">${ICONS.printer||''}</svg><span>${esc(label)}</span></a>`;}
function ops_inject(html){const ph=$('#content .ph');if(!ph||ph.querySelector('[data-ops-inj],[data-ops-print]'))return;let box=ph.querySelector(':scope > .row.wrap');
 if(!box){box=document.createElement('div');box.className='row wrap g8';ph.appendChild(box);}box.insertAdjacentHTML('afterbegin',html);}

/* ---------- Statements ---------- */
const OPS_LINE_KEYS=['months','gross','tax','acq','refunds','fee','ncr','retained','corr','commission','bkeys','btokens'];
const OPS_ST_TONE={issued:'warn',confirmed:'ok',auto:'ok',disputed:'bad'};
const ops_stBadge=s=>ui.badge(t('ops.rs.st.'+s.status),OPS_ST_TONE[s.status]||'',true);
const ops_rsDue=s=>new Date(s.deadline);
function ops_ciOf(s){return S.commissionInvoices.find(c=>c.id===s.ciId)||null;}
function ops_ciState(s){const ci=ops_ciOf(s);if(ci)return ci.status;if(s.status==='confirmed'||s.status==='auto'){return s.calc.tot.commission>0?(now()>ops_ymDay(s.ym,15)?'overdue':'todo'):'none';}return 'wait';}
const OPS_CI_TONE={draft:'',submitted:'info',received:'accent',paid:'ok',overdue:'bad',todo:'warn',none:'',wait:''};
const ops_ciBadge=st=>ui.badge(t('ops.ci.st.'+st),OPS_CI_TONE[st]||'',true);
route('statements',{nav:'statements',render(){ops_ensure();const list=S.statements.slice().sort((a,b)=>b.ym.localeCompare(a.ym)||a.cc.localeCompare(b.cc));const prev=ops_prevYm();
 const wait=list.filter(s=>s.status==='issued').length,disp=list.filter(s=>s.status==='disputed').length;const last=list.filter(s=>s.ym===prev);const com=last.reduce((a,s)=>a+s.calc.tot.commission,0);
 const todo=list.filter(s=>['todo','overdue'].includes(ops_ciState(s))).length;
 const kpis=`<div class="grid4" style="margin-bottom:16px">${ui.kpi(t('ops.rs.k.wait'),fmtNum(wait),t('ops.rs.k.waitS'))}${ui.kpi(t('ops.rs.k.disp'),fmtNum(disp),t('ops.rs.k.dispS'))}${ui.kpi(t('ops.rs.k.comm',{m:esc(ops_ymName(prev))}),money(com,'USD'),t('ops.rs.k.commS'))}${ui.kpi(t('ops.rs.k.ci'),fmtNum(todo),t('ops.rs.k.ciS'))}</div>`;
 const cols=[{label:t('ops.col.number')},{label:t('ops.col.cc')},{label:t('ops.col.month')},{label:t('ops.col.commission'),cls:'r'},{label:t('ops.col.status')},{label:t('ops.col.deadline')},{label:t('ops.col.ci')}];
 const rows=list.map(s=>({href:link('statement',s.id),cells:[`<b class="mono ops_nw">${esc(s.no)}</b>`,esc(ctyName(s.cc)),`<span class="ops_nw">${esc(ops_ymName(s.ym))}</span>`,`<span class="num ops_nw">${money(s.calc.tot.commission,'USD')}</span>`,ops_stBadge(s),
  `<span class="ops_nw ${s.status==='issued'&&now()>ops_rsDue(s)?'':'muted'}">${s.status==='issued'?fmtDate(s.deadline):s.confirmedAt?fmtDate(s.confirmedAt):'—'}</span>`,ops_ciBadge(ops_ciState(s))]}));
 let adm='';if(S.admin){const ok=can('ota.statements');adm=ui.note('admin',`<div class="col g8"><b>${t('ops.adm.h')}</b><span>${t('ops.rs.adm.p',{m:esc(ops_ymName(prev))})}</span><span class="row wrap g8">${ui.btn(t('ops.rs.gen',{m:esc(ops_ymName(prev))}),{kind:'primary',size:'sm',icon:'file',act:'ops_genRS',disabled:!ok})}${ui.btn(t('ops.sim5'),{size:'sm',kind:'ghost',icon:'clock',act:'ops_sim5',disabled:!ok})}${ok?'':ops_asBtn('ota_finance')}</span><span class="xs faint">${t('ops.sim5.h')}</span></div>`);}
 const body=`<div class="stack">${adm}${kpis}${ui.note('info',t('ops.rs.how'))}${ui.card({pad:false,body:ui.table(cols,rows,{empty:ui.empty('file',t('ops.rs.empty'),t('ops.rs.emptyP'))})})}</div>`;
 return ui.page({title:t('ops.rs.title'),sub:t('ops.rs.sub'),body});}});
nav({key:'statements',label:()=>t('ops.nav.rs'),icon:'layers',href:'#statements',order:64,section:()=>t('ops.sec'),count:()=>S.statements&&S.statements.filter(s=>s.status==='issued'||s.status==='disputed').length||null});
nav({key:'opsdocs',label:()=>t('ops.nav.docs'),icon:'file',href:'#opsdocs',order:65,section:()=>t('ops.sec')});
ACT.ops_genRS=()=>{if(!can('ota.statements')){toast(t('c.noPerm',{r:roleName(actor().role)}),'bad');return;}ops_st();const prev=ops_prevYm();let n=0;orgCountries().forEach(cc=>{if(ops_genStatement(cc,prev))n++;});
 toast(n?t('ops.rs.genDone',{n:fmtNum(n),m:ops_ymName(prev)}):t('ops.rs.genNone',{m:ops_ymName(prev)}));rerender();};
ACT.ops_sim5=()=>{if(!can('ota.statements'))return;const d=new Date(now());const target=ops_addBiz(d,5);const mins=Math.ceil((target-d)/60000)+1;tick(mins);const n=ops_autoConfirm();ops_audit('ops.sim5days',ymd0(),{auto:n});toast(t('ops.sim5.done',{n:fmtNum(n)}));rerender();};
const ymd0=()=>ops_ymd(now());

route('statement',{nav:'statements',render(id){ops_ensure();const s=S.statements.find(x=>x.id===id);if(!s)return ops_nf();
 const T=s.calc.tot,P=s.calc.plans,open=s.status==='issued'||s.status==='disputed',canC=can('p.confirm');
 const ci=ops_ciOf(s);
 let banner;
 if(s.status==='issued')banner=ui.note(now()>ops_rsDue(s)?'bad':'info',`<b>${t('ops.rs.b.issued',{d:fmtDate(s.deadline)})}</b> ${t('ops.rs.b.issuedP')}`,'clock');
 else if(s.status==='disputed')banner=ui.note('bad',`<b>${t('ops.rs.b.disputed',{n:s.disputes.filter(d=>!d.resolved).length})}</b> ${t('ops.rs.b.disputedP')}`);
 else if(s.status==='auto')banner=ui.note('ok',`<b>${t('ops.rs.b.auto',{d:fmtDate(s.confirmedAt)})}</b> ${t('ops.rs.b.autoP')}`,'check');
 else banner=ui.note('ok',`<b>${t('ops.rs.b.conf',{d:fmtDate(s.confirmedAt)})}</b> ${s.confirmedBy?esc(s.confirmedBy):''}`,'check');
 const lineAct=k=>{const L=s.lines[k]||{};if(L.s==='disp')return ui.badge(t('ops.ln.disputed'),'bad',true)+(L.comment?`<div class="xs muted ops_cm">${esc(L.comment)}</div>`:'');if(L.s==='ok')return ui.badge(t('ops.ln.ok'),'ok',true);
  return open&&canC?ui.btn(t('ops.ln.dispute'),{size:'sm',kind:'ghost',act:'ops_dispOpen',arg:s.id+':'+k}):'<span class="faint">—</span>';};
 const aRows=[['months','ops.ln.months',1],['gross','ops.ln.gross'],['tax','ops.ln.tax'],['acq','ops.ln.acq'],['refunds','ops.ln.refunds'],['fee','ops.ln.fee'],['ncr','ops.ln.ncr',0,1],['retained','ops.ln.retained'],['corr','ops.ln.corr'],['commission','ops.ln.commission',0,1]];
 const fm=(k,x)=>k==='months'?fmtNum(x):(k==='fee'&&!s.calc.fee?'—':money(x,'USD'));
 const aTbl=ui.table([{label:t('ops.col.line')},{label:'Light',cls:'r'},{label:'Standard',cls:'r'},{label:'Premium',cls:'r'},{label:t('ops.col.total'),cls:'r'},{label:t('ops.col.confirm')}],
  aRows.map(([k,lbl,,strong])=>({cells:[`<span class="${strong?'ops_strong':''}">${t(lbl)}</span>`,...OPS_PLANS.map(p=>`<span class="num ops_nw">${fm(k,P[p][k])}</span>`),`<b class="num ops_nw ${strong?'ops_strong':''}">${fm(k,T[k])}</b>`,lineAct(k)]})));
 const B=s.b;const bTbl=ui.table([{label:t('ops.col.line')},{label:t('ops.col.amount'),cls:'r'},{label:t('ops.col.paid'),cls:'r'},{label:t('ops.col.dueBy20'),cls:'r'},{label:t('ops.col.confirm')}],
  [['bkeys','ops.b.keys',B.keys],['btokens','ops.b.tokens',B.tokens]].map(([k,lbl,x])=>({cells:[t(lbl),`<span class="num ops_nw">${money(x.amount,'USD')}</span>`,`<span class="num ops_nw">${money(x.paid,'USD')}</span>`,`<span class="num ops_nw">${money(x.due,'USD')}</span>`,lineAct(k)]})));
 const iss=ui.card({title:t('ops.iss.t'),body:`<div class="grid2"><div><span class="xs faint">${t('ops.iss.keys')}</span><div class="ops_big num">${fmtNum(s.iss.keys)}</div></div><div><span class="xs faint">${t('ops.iss.tokens')}</span><div class="ops_big num">${fmtNum(s.iss.tokens)}</div></div></div><p class="small muted" style="margin-top:10px">${t('ops.iss.p')}</p>${B.invs.length?`<p class="small" style="margin-top:6px">${B.invs.map(n=>{const i=S.invoices.find(x=>x.number===n);return i?`<a class="mono" href="${link('invoice',i.id)}">${esc(n)}</a>`:esc(n);}).join(', ')}</p>`:''}`});
 const D=s.d;const dCard=ui.card({title:t('ops.d.t'),body:`<dl class="dl ops_dl"><dt>${t('ops.d.custody')}</dt><dd class="num">${fmtNum(D.custody)}</dd><dt>${t('ops.d.keys')}</dt><dd class="num">${D.keys.map(fmtNum).join(' / ')}</dd><dt>${t('ops.d.tokens')}</dt><dd class="num">${D.tokens.map(fmtNum).join(' / ')}</dd><dt>${t('ops.d.active')}</dt><dd class="num">${D.active.map(fmtNum).join(' / ')}</dd><dt>${t('ops.d.imei')}</dt><dd class="num">${fmtNum(D.imei)}</dd></dl>`});
 const disp=s.disputes.length?ui.card({title:t('ops.disp.t'),body:`<div class="stack">${s.disputes.map(d=>`<div class="ops_disp ${d.resolved?'res':''}"><div class="row between wrap g8"><b>${t('ops.ln.'+(d.line==='bkeys'?'bkeys':d.line==='btokens'?'btokens':d.line))}</b>${d.resolved?ui.badge(t('ops.disp.resolved'),'ok',true):ui.badge(t('ops.disp.open'),'bad',true)}</div><p class="small">${esc(d.comment)}</p><span class="xs faint">${esc(d.by)} · ${fmtDateTime(d.at)}</span>${d.resolved?`<p class="small ops_ans"><b>${t('ops.disp.answer')}:</b> ${esc(d.answer)} <span class="xs faint">· ${esc(d.resolvedBy)} · ${fmtDateTime(d.resolvedAt)}</span></p>`:S.admin?`<div style="margin-top:8px">${ui.btn(t('ops.disp.resolve'),{size:'sm',kind:'primary',act:'ops_resOpen',arg:d.id,disabled:!can('ota.statements')})}${can('ota.statements')?'':' '+ops_asBtn('ota_finance')}</div>`:''}</div>`).join('')}</div>`}):'';
 const confBtn=open?ui.btn(t(s.status==='disputed'?'ops.rs.confRest':'ops.rs.conf'),{kind:'primary',icon:'check',act:'ops_confirm',arg:s.id,disabled:!canC}):'';
 const sigNote=open&&!canC?`<div class="ops_noprint">${ops_noPerm()}<div style="margin-top:8px">${ops_asBtn('p_sign')}</div></div>`:'';
 const tl=ops_timeline(s,ci);
 const actions=confBtn+ui.btn(t('ops.print'),{kind:'ghost',icon:'printer',href:link('opsdoc','rs',s.id)});
 return ui.page({title:`<span class="row wrap g12"><span class="mono">${esc(s.no)}</span>${ops_stBadge(s)}</span>`,sub:t('ops.rs.detailSub',{c:esc(ctyName(s.cc)),m:esc(ops_ymName(s.ym)),a:money(T.commission,'USD')}),crumbs:[[t('ops.rs.title'),'#statements'],[s.no]],actions,
  body:`<div class="ops_grid"><div class="stack">${banner}${sigNote}${ui.card({title:t('ops.rs.secA'),pad:false,body:aTbl,foot:`<span class="xs faint">${t('ops.rs.aNote')}</span>`})}${ui.card({title:t('ops.rs.secB'),pad:false,body:bTbl})}${disp}</div>
  <div class="stack">${ui.card({title:t('ops.tl.t'),body:tl})}${ops_ciCard(s,ci)}${iss}${dCard}</div></div>`});}});
function ops_timeline(s,ci){const st=[];const ok=(done,cur)=>done?'done':cur?'cur':'';
 st.push([ok(true),t('ops.tl.issued'),t('ops.tl.issuedD',{d:fmtDateTime(s.issuedAt),n:fmtDate(new Date(+String(s.ym).slice(0,4),+String(s.ym).slice(4),10))})]);
 const conf=s.status==='confirmed'||s.status==='auto';
 st.push([ok(conf,!conf),t('ops.tl.review'),conf?(s.status==='auto'?t('ops.tl.autoD',{d:fmtDate(s.confirmedAt)}):t('ops.tl.confD',{d:fmtDate(s.confirmedAt),n:esc(s.confirmedBy||'—')})):s.status==='disputed'?t('ops.tl.dispD'):t('ops.tl.reviewD',{d:fmtDate(s.deadline)})]);
 const sub=ci&&ci.status!=='draft';st.push([ok(sub,conf&&!sub),t('ops.tl.ci'),sub?t('ops.tl.ciD',{n:esc(ci.number),d:fmtDate(ci.submittedAt)}):t('ops.tl.ciW',{d:fmtDate(ops_ymDay(s.ym,15))})]);
 const rec=ci&&(ci.status==='received'||ci.status==='paid');st.push([ok(rec,sub&&!rec),t('ops.tl.recv'),rec?fmtDate(ci.receivedAt):t('ops.tl.recvW')]);
 const paid=ci&&ci.status==='paid';st.push([ok(paid,rec&&!paid),t('ops.tl.paid'),paid?fmtDate(ci.paidAt):t('ops.tl.paidW',{d:fmtDate(ops_ymDay(s.ym,20))})]);
 return `<div class="timeline">${st.map(([c,h,d])=>`<div class="tl ${c}"><span class="dot">${c==='done'?icon('check','sm'):c==='cur'?'<span class="ord_pulse"></span>':''}</span><div class="grow"><b class="${c?'':'muted'}">${h}</b><div class="small ${c?'muted':'faint'}">${d}</div></div></div>`).join('')}</div>`;}

/* actions: confirm / dispute / resolve */
ACT.ops_confirm=id=>{const s=S.statements.find(x=>x.id===id);if(!s||!(s.status==='issued'||s.status==='disputed'))return;if(!can('p.confirm')){toast(t('c.noPerm',{r:roleName(actor().role)}),'bad');return;}
 OPS_LINE_KEYS.forEach(k=>{if(!s.lines[k])s.lines[k]={s:'ok'};});
 const nd=OPS_LINE_KEYS.filter(k=>s.lines[k].s==='disp').length;
 if(!nd){s.status='confirmed';s.confirmedAt=iso(now());s.confirmedBy=actorName();}
 ops_audit('statement.confirm',s.no,{lines:OPS_LINE_KEYS.length-nd,disputed:nd});const m=t(nd?'ops.rs.confRestDone':'ops.rs.confDone',{n:s.no});log(m);toast(m);rerender();};
ACT.ops_dispOpen=arg=>{const [id,k]=String(arg).split(':');const s=S.statements.find(x=>x.id===id);if(!s||!can('p.confirm'))return;
 modal(t('ops.disp.mT'),`<form id="ops_dF" data-form="ops_disp" class="stack" novalidate><input type="hidden" name="id" value="${esc(id)}"><input type="hidden" name="k" value="${esc(k)}"><p class="small"><b>${esc(s.no)}</b> · ${t('ops.ln.'+k)}</p>${ui.field({id:'ops_dc',label:t('ops.disp.comment'),type:'textarea',rows:4,hint:t('ops.disp.hint'),attrs:'maxlength="600"'})}</form>`,
  ui.btn(t('c.cancel'),{act:'ovclose'})+`<button class="btn danger" type="submit" form="ops_dF"><span>${t('ops.disp.send')}</span></button>`);};
FORM.ops_disp=f=>{const d=formData(f);const s=S.statements.find(x=>x.id===d.id);if(!s||!can('p.confirm'))return;clearErrs(f);const c=String(d.ops_dc||'').trim();if(c.length<5){setErr(f,'ops_dc',t('ops.disp.err'));return;}
 s.lines[d.k]={s:'disp',comment:c,by:actorName(),at:iso(now())};s.disputes.push({id:uid('dp'),line:d.k,comment:c,by:actorName(),at:iso(now()),resolved:false});if(s.status==='issued')s.status='disputed';
 ops_audit('statement.dispute',s.no,{line:d.k,comment:c});const m=t('ops.disp.done',{n:s.no});log(m);closeOverlay();toast(m);rerender();};
ACT.ops_resOpen=id=>{if(!can('ota.statements'))return;modal(t('ops.disp.rT'),`<form id="ops_rF" data-form="ops_res" class="stack" novalidate><input type="hidden" name="id" value="${esc(id)}">${ui.field({id:'ops_ra',label:t('ops.disp.answer'),type:'textarea',rows:4,attrs:'maxlength="600"'})}</form>`,
  ui.btn(t('c.cancel'),{act:'ovclose'})+`<button class="btn primary" type="submit" form="ops_rF"><span>${t('ops.disp.resolve')}</span></button>`);};
FORM.ops_res=f=>{const d=formData(f);if(!can('ota.statements'))return;clearErrs(f);const a=String(d.ops_ra||'').trim();if(a.length<3){setErr(f,'ops_ra',t('ops.disp.err'));return;}
 const s=S.statements.find(x=>x.disputes.some(q=>q.id===d.id));if(!s)return;const dp=s.disputes.find(q=>q.id===d.id);dp.resolved=true;dp.answer=a;dp.resolvedBy=actorName();dp.resolvedAt=iso(now());s.lines[dp.line]={s:'ok'};
 if(s.disputes.every(q=>q.resolved)){s.status='confirmed';s.confirmedAt=iso(now());s.confirmedBy=t('ops.byAgreement');OPS_LINE_KEYS.forEach(k=>{if(!s.lines[k]||s.lines[k].s!=='ok')s.lines[k]={s:'ok'};});}
 ops_audit('statement.dispute.resolve',s.no,{line:dp.line,answer:a});closeOverlay();toast(t('ops.disp.resDone'));rerender();};

/* ---------- Commission invoice (CI) ---------- */
function ops_ciRsList(ci){const ids=ci.rsIds&&ci.rsIds.length?ci.rsIds:[ci.rsId];return ids.map(id=>S.statements.find(x=>x.id===id)).filter(Boolean).map(x=>({id:x.id,no:x.no,cc:x.cc,com:x.calc.tot.commission}));}
// other statements of the same month that can go on the same partner invoice (confirmed, commission > 0, not yet invoiced)
function ops_ciPeers(s,ci){return S.statements.filter(x=>x.id!==s.id&&x.ym===s.ym&&(x.status==='confirmed'||x.status==='auto')&&x.calc.tot.commission>0&&(!x.ciId||(ci&&x.ciId===ci.id)));}
function ops_ciCard(s,ci){const conf=s.status==='confirmed'||s.status==='auto';const com=s.calc.tot.commission;const by15=ops_ymDay(s.ym,15);
 let body='';const can_=can('p.docs');
 if(!conf)body=ui.note('info',t('ops.ci.wait'));
 else if(!ci&&com<=0)body=ui.note('info',t('ops.ci.none'));
 else if(!ci){body=`<p class="small muted">${t('ops.ci.intro',{a:money(com,'USD'),d:fmtDate(by15)})}</p>${now()>by15?ui.note('bad',t('ops.ci.overdue',{d:fmtDate(by15)})):''}<div class="row wrap g8" style="margin-top:12px">${ui.btn(t('ops.ci.propose'),{kind:'primary',icon:'file',act:'ops_ciEdit',arg:s.id+':',disabled:!can_})}${ui.btn(t('ops.ci.upload'),{icon:'upload',act:'ops_ciUp',arg:s.id,disabled:!can_})}</div>${can_?'':`<div style="margin-top:8px">${ops_noPerm()}</div>`}`;}
 else{const up=ci.mode==='upload';
  body=`<dl class="dl ops_dl"><dt>${t('ops.ci.no')}</dt><dd class="mono">${esc(ci.number)}</dd><dt>${t('ops.ci.rs')}</dt><dd>${ops_ciRsList(ci).map(x=>`<a class="mono" href="${link('statement',x.id)}">${esc(x.no)}</a>`).join('<br>')}</dd><dt>${t('ops.col.amount')}</dt><dd class="num">${money(ci.total,'USD')}${ci.vat?` <span class="xs faint">(${t('ops.ci.vat')}: ${money(ci.vat,'USD')})</span>`:''}</dd><dt>${t('ops.ci.date')}</dt><dd>${fmtDate(ci.date)}</dd><dt>${t('ops.ci.due')}</dt><dd>${fmtDate(ci.due)}</dd>${up?`<dt>${t('ops.ci.file')}</dt><dd>${icon('file','sm')} ${esc(ci.file&&ci.file.name||'—')}</dd>`:`<dt>${t('ops.ci.vatT')}</dt><dd>${esc(ci.vatText||'—')}</dd>`}<dt>${t('ops.col.status')}</dt><dd>${ops_ciBadge(ci.status)}</dd></dl>`;
  if(ci.status==='draft')body+=`<div class="row wrap g8" style="margin-top:12px">${ui.btn(t('ops.ci.submit'),{kind:'primary',icon:'send',act:'ops_ciSubmit',arg:ci.id,disabled:!can_})}${ui.btn(t('c.edit'),{icon:'edit',act:'ops_ciEdit',arg:s.id+':'+ci.id,disabled:!can_})}${ui.btn(t('ops.print'),{kind:'ghost',icon:'printer',href:link('opsdoc','ci',ci.id)})}${ui.btn(t('ops.ci.discard'),{kind:'ghost',icon:'trash',act:'ops_ciDiscard',arg:ci.id,disabled:!can_})}</div><p class="xs faint" style="margin-top:8px">${t('ops.ci.bankNote')}</p>${can_?'':`<div style="margin-top:8px">${ops_noPerm()}</div>`}`;
  else if(!up)body+=`<div class="row wrap g8" style="margin-top:12px">${ui.btn(t('ops.print'),{kind:'ghost',icon:'printer',href:link('opsdoc','ci',ci.id)})}</div>`;
  if(ci.reverseCharge&&ci.reverseCharge.done)body+=`<div style="margin-top:10px">${ui.badge(icon('check','sm')+t('ops.ci.rcDone'),'ok')}</div>`;}
 let adm='';
 if(S.admin&&ci&&ci.status!=='draft'){const ok=can('ota.payments'),okv=can('ota.vat');
  adm=ui.note('admin',`<div class="col g8"><b>${t('ops.adm.h')}</b><span class="row wrap g8">${ci.status==='submitted'?ui.btn(t('ops.ci.markRecv'),{size:'sm',kind:'primary',icon:'check',act:'ops_ciRecv',arg:ci.id,disabled:!ok}):''}${ci.status==='received'?ui.btn(t('ops.ci.markPaid'),{size:'sm',kind:'primary',icon:'check',act:'ops_ciPaid',arg:ci.id,disabled:!ok}):''}${ci.status==='paid'?`<span class="small muted">${t('ops.ci.closed')}</span>`:''}</span>
   <label class="chk small"><input type="checkbox" data-act="ops_ciRc" data-arg="${esc(ci.id)}" ${ci.reverseCharge&&ci.reverseCharge.done?'checked':''} ${okv?'':'disabled'}><span><b>${t('ops.ci.rc')}</b><br><span class="faint xs">${t('ops.ci.rcH')}</span></span></label>${ok&&okv?'':ops_asBtn('ota_finance')}</div>`);}
 let bk='';if(S.bankChange&&typeof lg_bankBanner==='function'){try{bk=lg_bankBanner()||'';}catch(e){}}
 return ui.card({title:t('ops.ci.t'),body:`<div class="stack">${bk}${body}${adm}</div>`});}
ACT.ops_ciEdit=arg=>{const [rsId,ciId]=String(arg).split(':');const s=S.statements.find(x=>x.id===rsId);if(!s||!can('p.docs'))return;const ci=ciId?S.commissionInvoices.find(c=>c.id===ciId):null;
 const yr=ci?ci.seq.slice(0,4):String(now().getFullYear());const seq=ci?ci.seq:yr+'-'+pad(((ops_st().ciSeq[yr])||0)+1,4);
 modal(t(ci?'ops.ci.editT':'ops.ci.propT'),`<form id="ops_cF" data-form="ops_ciSave" class="stack" novalidate><input type="hidden" name="rs" value="${esc(rsId)}"><input type="hidden" name="id" value="${esc(ciId||'')}">${ui.note('info',t('ops.ci.propP',{rs:'<span class="mono">'+esc(s.no)+'</span>'}))}
  <div class="grid2">${ui.field({id:'ops_cseq',label:t('ops.ci.seq',{p:esc(S.org.code)}),value:seq,mono:true,hint:t('ops.ci.seqH'),attrs:'maxlength="12"'})}${ui.field({id:'ops_cdate',label:t('ops.ci.date'),type:'date',value:ci?ci.date:ymd0()})}</div>
  ${(()=>{const peers=ops_ciPeers(s,ci);if(!peers.length)return '';const inc=ci&&ci.rsIds?ci.rsIds:[];
   return `<fieldset class="stack" style="border:0;padding:0;margin:0"><legend class="small"><b>${t('ops.ci.multi')}</b></legend><p class="xs faint" style="margin:0">${t('ops.ci.multiH')}</p>${peers.map(x=>`<label class="chk small"><input type="checkbox" name="ops_inc_${esc(x.id)}" ${inc.includes(x.id)?'checked':''}><span><span class="mono">${esc(x.no)}</span> · ${esc(ctyName(x.cc))} · <b class="num">${money(x.calc.tot.commission,'USD')}</b></span></label>`).join('')}</fieldset>`;})()}
  <div class="grid2">${ui.field({id:'ops_camt',label:t('ops.col.amount')+' (USD)',value:money(s.calc.tot.commission,'USD'),attrs:'readonly',hint:ops_ciPeers(s,ci).length?t('ops.ci.amtH'):''})}${ui.field({id:'ops_cvat',label:t('ops.ci.vatA'),type:'number',value:ci?ci.vat:0,attrs:'min="0" step="0.01" inputmode="decimal"'})}</div>
  ${ui.field({id:'ops_cvt',label:t('ops.ci.vatT'),value:ci?ci.vatText:'',placeholder:'[…]',hint:t('ops.ci.vatH'),attrs:'maxlength="200"'})}</form>`,
  ui.btn(t('c.cancel'),{act:'ovclose'})+`<button class="btn primary" type="submit" form="ops_cF"><span>${t('ops.ci.saveDraft')}</span></button>`);};
FORM.ops_ciSave=f=>{const d=formData(f);const s=S.statements.find(x=>x.id===d.rs);if(!s||!can('p.docs'))return;clearErrs(f);let bad=false;
 const seq=String(d.ops_cseq||'').trim();if(!/^\d{4}-\d{4,6}$/.test(seq)){setErr(f,'ops_cseq',t('ops.ci.seqE'));bad=true;}
 if(!/^\d{4}-\d{2}-\d{2}$/.test(d.ops_cdate||'')||isNaN(new Date(d.ops_cdate))){setErr(f,'ops_cdate',t('c.required'));bad=true;}
 const vat=parseFloat(String(d.ops_cvat||'0').replace(',','.'));if(isNaN(vat)||vat<0){setErr(f,'ops_cvat',t('ops.ci.vatE'));bad=true;}if(bad)return;
 const o=ops_st();const yr=seq.slice(0,4);const n=parseInt(seq.slice(5),10);const ex=d.id?S.commissionInvoices.find(c=>c.id===d.id):null;
 if(S.commissionInvoices.some(c=>c.number===S.org.code+'-INV-'+seq&&c!==ex)){setErr(f,'ops_cseq',t('ops.ci.seqDup'));return;}
 o.ciSeq[yr]=Math.max(o.ciSeq[yr]||0,n);
 const prim=ex?(S.statements.find(x=>x.id===ex.rsId)||s):s;const peers=ops_ciPeers(prim,ex).filter(x=>d['ops_inc_'+x.id]);const list=[prim].concat(peers);
 const amount=r2(list.reduce((a,x)=>a+x.calc.tot.commission,0));
 const ci=ex||{id:uid('ci'),rsId:prim.id,rsNo:prim.no,cc:prim.cc,ym:prim.ym,mode:'draft',file:null,status:'draft',createdAt:iso(now()),createdBy:actorName(),reverseCharge:{done:false}};
 (ci.rsIds||[]).forEach(id=>{const x=S.statements.find(q=>q.id===id);if(x&&x.ciId===ci.id&&!list.includes(x))x.ciId=null;});
 Object.assign(ci,{rsIds:list.map(x=>x.id),rsNos:list.map(x=>x.no),seq,number:S.org.code+'-INV-'+seq,date:d.ops_cdate,due:ops_ymd(ops_ymDay(prim.ym,20)),amount,vat:r2(vat),total:r2(amount+vat),vatText:String(d.ops_cvt||'').trim()});
 if(!ex)S.commissionInvoices.unshift(ci);list.forEach(x=>{x.ciId=ci.id;});ops_audit(ex?'ci.draft.update':'ci.draft',ci.number,{rs:ci.rsNos.join(', '),amount});closeOverlay();toast(t('ops.ci.draftDone',{n:ci.number}));rerender();};
ACT.ops_ciUp=rsId=>{const s=S.statements.find(x=>x.id===rsId);if(!s||!can('p.docs'))return;
 modal(t('ops.ci.upT'),`<form id="ops_uF" data-form="ops_ciUpload" class="stack" novalidate><input type="hidden" name="rs" value="${esc(rsId)}">${ui.note('info',t('ops.ci.upP',{a:money(s.calc.tot.commission,'USD')}))}
  <div class="field"><label for="ops_ufile">${t('ops.ci.file')}</label><input class="inp" id="ops_ufile" name="ops_ufile" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"><span class="hint" id="ops_ufile-h">${t('ops.ci.fileH')}</span></div>
  <div class="grid2">${ui.field({id:'ops_unum',label:t('ops.ci.theirNo'),mono:true,attrs:'maxlength="40"'})}${ui.field({id:'ops_udate',label:t('ops.ci.date'),type:'date',value:ymd0()})}</div></form>`,
  ui.btn(t('c.cancel'),{act:'ovclose'})+`<button class="btn primary" type="submit" form="ops_uF"><span>${t('ops.ci.upSubmit')}</span></button>`);};
FORM.ops_ciUpload=f=>{const d=formData(f);const s=S.statements.find(x=>x.id===d.rs);if(!s||!can('p.docs'))return;clearErrs(f);let bad=false;const fi=f.querySelector('input[type=file]').files[0];
 if(!fi){setErr(f,'ops_ufile',t('ops.ci.fileE'));bad=true;}const num=String(d.ops_unum||'').trim();if(!num){setErr(f,'ops_unum',t('c.required'));bad=true;}if(!/^\d{4}-\d{2}-\d{2}$/.test(d.ops_udate||'')){setErr(f,'ops_udate',t('c.required'));bad=true;}if(bad)return;
 const amount=s.calc.tot.commission;const ts=iso(now());const ci={id:uid('ci'),rsId:s.id,rsNo:s.no,cc:s.cc,ym:s.ym,mode:'upload',seq:'',number:num,date:d.ops_udate,due:ops_ymd(ops_ymDay(s.ym,20)),amount,vat:0,total:amount,vatText:'',file:{name:fi.name,size:fi.size},status:'submitted',createdAt:ts,createdBy:actorName(),submittedAt:ts,reverseCharge:{done:false}};
 S.commissionInvoices.unshift(ci);s.ciId=ci.id;ops_audit('ci.upload',num,{rs:s.no,file:fi.name,amount});const m=t('ops.ci.upDone',{n:esc(num)});log(m);closeOverlay();toast(m);rerender();};
ACT.ops_ciSubmit=id=>{const ci=S.commissionInvoices.find(c=>c.id===id);if(!ci||ci.status!=='draft'||!can('p.docs'))return;ci.status='submitted';ci.submittedAt=iso(now());ops_audit('ci.submit',ci.number,{rs:ci.rsNo,amount:ci.total});const m=t('ops.ci.subDone',{n:ci.number});log(m);toast(m);rerender();};
ACT.ops_ciDiscard=id=>{const ci=S.commissionInvoices.find(c=>c.id===id);if(!ci||ci.status!=='draft'||!can('p.docs'))return;S.statements.forEach(x=>{if(x.ciId===ci.id)x.ciId=null;});S.commissionInvoices=S.commissionInvoices.filter(c=>c!==ci);ops_audit('ci.discard',ci.number,{rs:ci.rsNo});toast(t('ops.ci.disDone'));rerender();};
ACT.ops_ciRecv=id=>{const ci=S.commissionInvoices.find(c=>c.id===id);if(!ci||ci.status!=='submitted'||!can('ota.payments'))return;ci.status='received';ci.receivedAt=iso(now());ops_audit('ci.received',ci.number,{rs:ci.rsNo});const m=t('ops.ci.recvDone',{n:ci.number});log(m);toast(m);rerender();};
ACT.ops_ciPaid=id=>{const ci=S.commissionInvoices.find(c=>c.id===id);if(!ci||ci.status!=='received'||!can('ota.payments'))return;tick(5);ci.status='paid';ci.paidAt=iso(now());ops_audit('ci.paid',ci.number,{rs:ci.rsNo,amount:ci.total});const m=t('ops.ci.paidDone',{n:ci.number});log(m);toast(m);rerender();};
ACT.ops_ciRc=(v,el)=>{const id=el&&el.dataset.arg;const ci=S.commissionInvoices.find(c=>c.id===id);if(!ci||!can('ota.vat'))return;ci.reverseCharge={done:!!v,by:actorName(),at:iso(now())};ops_audit('ci.reverse_charge',ci.number,{done:!!v});toast(t(v?'ops.ci.rcOn':'ops.ci.rcOff',{n:ci.number}));rerender();};

/* ---------- Documents → Operations ---------- */
function ops_all(){const out=[];
 S.invoices.forEach(i=>out.push({T:'INV',id:i.id,no:i.number,date:i.createdAt,cc:i.cc,st:invStatus(i),stKey:'ops.st.inv.',tone:{paid:'ok',overdue:'bad',cancelled:'',open:'warn'}[invStatus(i)],href:link('invoice',i.id),print:link('opsdoc','inv',i.id)}));
 (S.creditNotes||[]).forEach(c=>{const i=invById(c.invoiceId);out.push({T:'CN',id:c.id,no:c.number,date:c.createdAt,cc:i?i.cc:'',st:'issued',stKey:'ops.st.',tone:'info',href:link('cnote',c.id),print:link('opsdoc','cn',c.id)});});
 S.statements.forEach(s=>out.push({T:'RS',id:s.id,no:s.no,date:s.issuedAt,cc:s.cc,st:s.status,stKey:'ops.rs.st.',tone:OPS_ST_TONE[s.status],href:link('statement',s.id),print:link('opsdoc','rs',s.id)}));
 S.commissionInvoices.forEach(c=>out.push({T:'CI',id:c.id,no:c.number,date:c.date,cc:c.cc,st:c.status,stKey:'ops.ci.st.',tone:OPS_CI_TONE[c.status],href:link('statement',c.rsId),print:c.mode==='upload'?'':link('opsdoc','ci',c.id)}));
 (S.shipments||[]).forEach(h=>{const tone={prepared:'',shipped:'accent',delivered:'info',received:'ok'}[h.status];out.push({T:'PF',id:h.id,no:h.pf,date:h.createdAt,cc:h.cc,st:h.status,stKey:'ops.st.sh.',tone,href:link('shipment',h.id),print:link('opsdoc','pf',h.id)});
  out.push({T:'SR',id:h.id,no:h.sr,date:h.receipt?h.receipt.at:h.createdAt,cc:h.cc,st:h.receipt?'signed':'await',stKey:'ops.st.sr.',tone:h.receipt?'ok':'warn',href:link('shipment',h.id),print:link('opsdoc','sr',h.id)});});
 return out.sort((a,b)=>String(b.date).localeCompare(String(a.date))||b.no.localeCompare(a.no));}
route('opsdocs',{nav:'opsdocs',render(){ops_ensure();const all=ops_all();const ft=S.ui.ops_type||'all',fc=S.ui.ops_cc||'all',q=(S.ui.ops_q||'').trim().toLowerCase();
 const ccs=[...new Set(all.map(x=>x.cc).filter(Boolean))];
 const list=all.filter(x=>(ft==='all'||x.T===ft)&&(fc==='all'||x.cc===fc)&&(!q||x.no.toLowerCase().includes(q)));
 const per=50,pages=Math.max(1,Math.ceil(list.length/per)),pg=clamp(S.ui.ops_p||1,1,pages);
 const cols=[{label:t('ops.col.type')},{label:t('ops.col.number')},{label:t('ops.col.date')},{label:t('ops.col.cc')},{label:t('ops.col.status')},{label:''}];
 const rows=list.slice((pg-1)*per,pg*per).map(x=>({href:x.href,cells:[ops_typeBadge(x.T),`<b class="mono ops_nw">${esc(x.no)}</b>`,`<span class="ops_nw">${fmtDate(x.date)}</span>`,esc(x.cc?ctyName(x.cc):'—'),ui.badge(t(x.stKey+x.st),x.tone||'',true),
  x.print?`<a class="btn sm ghost ops_nw" href="${x.print}" aria-label="${esc(t('ops.print')+' '+x.no)}">${icon('printer','sm')}<span>${t('ops.print')}</span></a>`:`<span class="xs faint">${t('ops.ci.uploaded')}</span>`]}));
 const tb=`<div class="toolbar ops_tb"><label class="ops_sel"><span class="xs faint">${t('ops.col.type')}</span><select class="inp" data-act="ops_fType" aria-label="${t('ops.col.type')}"><option value="all">${t('c.all')}</option>${OPS_TYPES.map(k=>`<option value="${k}" ${ft===k?'selected':''}>${t('ops.type.'+k)}</option>`).join('')}</select></label>
  <label class="ops_sel"><span class="xs faint">${t('ops.col.cc')}</span><select class="inp" data-act="ops_fCc" aria-label="${t('ops.col.cc')}"><option value="all">${t('c.all')}</option>${ccs.map(c=>`<option value="${c}" ${fc===c?'selected':''}>${esc(ctyName(c))}</option>`).join('')}</select></label>
  <label class="ops_sel grow"><span class="xs faint">${t('c.search')}</span><input class="inp" type="search" data-act="ops_fQ" value="${esc(S.ui.ops_q||'')}" placeholder="OTA-…" aria-label="${t('c.search')}"></label></div>`;
 const body=`<div class="stack">${ui.note('info',t('ops.docs.how'))}${ui.card({pad:false,body:tb+ui.table(cols,rows,{empty:ui.empty('filter',t('ops.docs.emptyF'),'')})+(list.length>per?ui.pager(pg,list.length,per,'ops_pg'):'')})}</div>`;
 return ui.page({title:t('ops.docs.title'),sub:t('ops.docs.sub'),body});}});
Object.assign(ACT,{ops_fType(v){S.ui.ops_type=v;S.ui.ops_p=1;rerender();},ops_fCc(v){S.ui.ops_cc=v;S.ui.ops_p=1;rerender();},ops_fQ(v){S.ui.ops_q=v;S.ui.ops_p=1;rerender();},ops_pg(v){S.ui.ops_p=+v;rerender();}});
HOOKS.seedDemo.push(()=>{try{S.ops=null;ops_ensure();}catch(e){console.error(e);}});

/* ---------- i18n ---------- */
I18N.add({
uk:{'ops.sec':'Документи','ops.nav.rs':'Акти звірки','ops.nav.docs':'Документи → Операції','ops.docs.title':'Документи → Операції','ops.docs.sub':'Усі рахунки, кредит-ноти, акти звірки, рахунки партнера та SIM-документи в одному місці.','ops.docs.how':'Документи формуються з юридичних шаблонів (англійська | російська) у вигляді A4. Кнопка «Друк / PDF» відкриває версію для друку.','ops.docs.emptyF':'Документів за цими фільтрами немає',
 'ops.type.INV':'Рахунок OTA','ops.type.CN':'Кредит-нота','ops.type.RS':'Акт звірки','ops.type.CI':'Рахунок партнера','ops.type.PF':'Проформа','ops.type.SR':'Акт приймання SIM',
 'ops.col.type':'Тип','ops.col.number':'Номер','ops.col.date':'Дата','ops.col.cc':'Країна','ops.col.status':'Статус','ops.col.month':'Місяць','ops.col.commission':'Винагорода','ops.col.deadline':'Термін / дата','ops.col.ci':'Рахунок партнера','ops.col.line':'Рядок','ops.col.total':'Разом','ops.col.confirm':'Підтвердження','ops.col.amount':'Сума','ops.col.paid':'Сплачено','ops.col.dueBy20':'До сплати до 20-го',
 'ops.st.inv.open':'Очікує оплати','ops.st.inv.paid':'Сплачено','ops.st.inv.overdue':'Прострочено','ops.st.inv.cancelled':'Скасовано','ops.st.issued':'Видано','ops.st.sh.prepared':'Підготовлено','ops.st.sh.shipped':'Відправлено','ops.st.sh.delivered':'Доставлено','ops.st.sh.received':'Отримано','ops.st.sr.await':'Очікує підпису','ops.st.sr.signed':'Підтверджено партнером',
 'ops.print':'Друк / PDF','ops.openSrc':'Відкрити джерело','ops.btn.inv':'Рахунок для друку / PDF','ops.btn.cn':'Кредит-нота для друку / PDF','ops.btn.pf':'Проформа (PF)','ops.btn.sr':'Акт приймання SIM (SR)','ops.nf':'Документ не знайдено','ops.nf.p':'Можливо, його видалено або посилання застаріло.','ops.missing':'У шаблоні немає значень для: {k}','ops.adm.h':'Дії OTA (демо)','ops.byAgreement':'за домовленістю сторін',
 'ops.inv.vat0':'ПДВ завжди 0% — експорт послуг (ст. 31 Виконавчого регламенту до Федерального декрету-закону № 8 від 2017 р.); сума ПДВ в AED — за курсом ЦБ ОАЕ на дату рахунку, збереженим разом із рахунком. Країна: {cc}. Ключі й токени видаються лише після відмітки про оплату.','ops.ci.draftNote':'Це чернетка. Рахунок буде подано OTA після кнопки «Подати».','ops.sr.blank':'Партнер ще не підтвердив отримання: поля кількості, стану й місця зберігання залишено порожніми для заповнення від руки.',
 'ops.rs.title':'Акти звірки','ops.rs.sub':'Щомісяця до 10-го числа за попередній місяць, окремо по кожній країні.','ops.rs.how':'Підтвердьте акт або оскаржте окремі рядки протягом 5 робочих днів. Без відповіді акт вважається підтвердженим автоматично. Після підтвердження портал запропонує чернетку рахунку на винагороду (до 15-го).','ops.rs.empty':'Актів ще немає','ops.rs.emptyP':'Перший акт з’явиться після закриття місяця з платежами прямих підписок.',
 'ops.rs.k.wait':'Очікують підтвердження','ops.rs.k.waitS':'у вас на перевірці','ops.rs.k.disp':'Спірні акти','ops.rs.k.dispS':'очікують відповіді OTA','ops.rs.k.comm':'Винагорода за {m}','ops.rs.k.commS':'за всіма країнами','ops.rs.k.ci':'Рахунки до подачі','ops.rs.k.ciS':'винагорода без рахунку',
 'ops.rs.st.issued':'На перевірці','ops.rs.st.confirmed':'Підтверджено','ops.rs.st.auto':'Автопідтверджено','ops.rs.st.disputed':'Є спір',
 'ops.rs.adm.p':'Фінансист OTA формує акти за {m} (автоматично до 10-го числа) і закриває спори.','ops.rs.gen':'Сформувати акти за {m}','ops.rs.genDone':'Сформовано актів: {n} (за {m})','ops.rs.genNone':'Усі акти за {m} уже сформовано','ops.sim5':'Імітувати 5 робочих днів','ops.sim5.h':'Демо: зсуває годинник на 5 робочих днів і підтверджує акти, на які партнер не відповів.','ops.sim5.done':'Годинник зсунуто. Автопідтверджено актів: {n}',
 'ops.rs.b.issued':'Акт чекає на вашу відповідь до {d}.','ops.rs.b.issuedP':'Підтвердьте його або оскаржте окремі рядки. Без відповіді він вважається підтвердженим.','ops.rs.b.disputed':'Спірних рядків: {n}.','ops.rs.b.disputedP':'Безспірні суми сплачуються в строк. OTA відповість на спір, після чого акт буде підтверджено.','ops.rs.b.auto':'Автоматично підтверджено {d}.','ops.rs.b.autoP':'Відповіді партнера в строк не надійшло.','ops.rs.b.conf':'Підтверджено {d}.',
 'ops.rs.detailSub':'{c} · {m} · винагорода {a}','ops.rs.secA':'A. Прямі підписки — розрахунок винагороди (USD)','ops.rs.secB':'B. Рахунки OTA за місяць','ops.rs.aNote':'Валові надходження — у USD за курсом еквайєра. Акт не є податковим рахунком і не здійснює взаєморозрахунок.',
 'ops.ln.months':'Оплачені місяці підписки','ops.ln.gross':'Валові надходження','ops.ln.tax':'Мінус непрямі податки OTA в країні клієнта','ops.ln.acq':'Мінус еквайринг','ops.ln.refunds':'Мінус повернення та chargeback','ops.ln.fee':'Мінус страновий збір','ops.ln.ncr':'Чиста зібрана виручка','ops.ln.retained':'Мінус сума, що утримує OTA (× оплачені місяці)','ops.ln.corr':'Коригування за минулі місяці','ops.ln.commission':'Винагорода партнера','ops.ln.bkeys':'Ключі активації (рахунки місяця)','ops.ln.btokens':'Сервісні токени (рахунки місяця)','ops.b.keys':'Ключі активації','ops.b.tokens':'Сервісні токени',
 'ops.ln.ok':'Підтверджено','ops.ln.disputed':'Оскаржено','ops.ln.dispute':'Оскаржити',
 'ops.rs.conf':'Підтвердити акт','ops.rs.confRest':'Підтвердити решту рядків','ops.rs.confDone':'Акт {n} підтверджено','ops.rs.confRestDone':'Безспірні рядки акту {n} підтверджено',
 'ops.disp.mT':'Оскаржити рядок','ops.disp.comment':'Коментар для OTA','ops.disp.hint':'Поясніть, що саме не збігається з вашими даними.','ops.disp.err':'Напишіть коментар (щонайменше кілька слів)','ops.disp.send':'Надіслати в OTA','ops.disp.done':'Спір по акту {n} надіслано в OTA','ops.disp.t':'Спори','ops.disp.open':'Відкрито','ops.disp.resolved':'Вирішено','ops.disp.answer':'Відповідь OTA','ops.disp.resolve':'Закрити спір','ops.disp.rT':'Відповісти на спір','ops.disp.resDone':'Спір закрито',
 'ops.tl.t':'Хід акту','ops.tl.issued':'Акт сформовано','ops.tl.issuedD':'{d}. Термін формування — до {n}.','ops.tl.review':'Перевірка партнером','ops.tl.reviewD':'до {d} (5 робочих днів), потім автопідтвердження','ops.tl.confD':'{d} · {n}','ops.tl.autoD':'автопідтвердження {d}','ops.tl.dispD':'є спір, очікуємо відповідь OTA','ops.tl.ci':'Рахунок партнера','ops.tl.ciD':'{n} · подано {d}','ops.tl.ciW':'подати до {d}','ops.tl.recv':'OTA отримала рахунок','ops.tl.recvW':'відмітить фінансист OTA','ops.tl.paid':'Сплачено','ops.tl.paidW':'до {d}',
 'ops.iss.t':'Ключі й токени за місяць','ops.iss.keys':'Ключів активації видано','ops.iss.tokens':'Сервісних токенів видано','ops.iss.p':'Видача відбувається лише після відмітки «сплачено» фінансистом OTA.',
 'ops.d.t':'Операційні дані (довідково)','ops.d.custody':'SIM на зберіганні','ops.d.keys':'Ключі: куплено / використано / не використано','ops.d.tokens':'Токени: видано / погашено / не погашено / прострочено','ops.d.active':'Активні пристрої: токен / підписка','ops.d.imei':'IMEI додано до білого списку',
 'ops.ci.t':'Рахунок партнера на винагороду','ops.ci.st.draft':'Чернетка','ops.ci.st.submitted':'Подано в OTA','ops.ci.st.received':'Отримано OTA','ops.ci.st.paid':'Сплачено','ops.ci.st.overdue':'Не подано (прострочено)','ops.ci.st.todo':'Потрібно подати','ops.ci.st.none':'Не потрібен','ops.ci.st.wait':'Після підтвердження акту','ops.ci.uploaded':'завантажений файл',
 'ops.ci.wait':'Рахунок стане доступним після підтвердження акту звірки.','ops.ci.none':'За цей місяць винагороди до виплати немає — рахунок не потрібен.','ops.ci.intro':'Винагорода за актом: {a}. Подайте рахунок до {d}: портал запропонує чернетку за шаблоном 14 або завантажте власний рахунок.','ops.ci.overdue':'Строк подачі рахунку ({d}) минув. Подайте його якнайшвидше.','ops.ci.propose':'Запропонувати чернетку з акту','ops.ci.upload':'Завантажити власний рахунок',
 'ops.ci.no':'Номер','ops.ci.rs':'Акт звірки','ops.ci.vat':'ПДВ','ops.ci.date':'Дата рахунку','ops.ci.due':'Строк оплати OTA','ops.ci.file':'Файл рахунку','ops.ci.vatT':'Режим ПДВ','ops.ci.submit':'Подати в OTA','ops.ci.discard':'Видалити чернетку','ops.ci.bankNote':'Банківські реквізити беруться з анкети партнера (розділ «Реквізити»). Банк-посередник виводиться лише якщо заповнений.',
 'ops.ci.markRecv':'Позначити «отримано»','ops.ci.markPaid':'Позначити «сплачено»','ops.ci.closed':'Рахунок сплачено, цикл завершено.','ops.ci.rc':'ПДВ ОАЕ нараховано за зворотним нарахуванням','ops.ci.rcH':'Відмітка для бухгалтерії OTA.','ops.ci.rcDone':'ПДВ ОАЕ: зворотне нарахування враховано','ops.ci.rcOn':'Рахунок {n}: відмічено зворотне нарахування ПДВ','ops.ci.rcOff':'Рахунок {n}: відмітку знято',
 'ops.ci.propT':'Чернетка рахунку на винагороду','ops.ci.editT':'Змінити чернетку','ops.ci.propP':'Суму взято з акту {rs}. Нумерація — ваша власна; портал зберігає зв’язок із актом.','ops.ci.seq':'Порядковий номер ({p}-INV-…)','ops.ci.seqH':'Формат РРРР-NNNN, наприклад 2026-0001','ops.ci.seqE':'Вкажіть номер у форматі РРРР-NNNN','ops.ci.seqDup':'Такий номер рахунку вже є','ops.ci.vatA':'Сума ПДВ, USD','ops.ci.vatE':'Введіть число від 0','ops.ci.vatH':'За висновком податкового консультанта партнера.','ops.ci.saveDraft':'Зберегти чернетку','ops.ci.draftDone':'Чернетку {n} збережено',
 'ops.ci.upT':'Завантажити власний рахунок','ops.ci.upP':'Рахунок має містити ті самі відомості, що шаблон 14. Сума без ПДВ: {a}.','ops.ci.fileH':'У демо зберігається лише назва файлу.','ops.ci.fileE':'Оберіть файл рахунку','ops.ci.theirNo':'Номер вашого рахунку','ops.ci.upSubmit':'Завантажити й подати','ops.ci.upDone':'Рахунок {n} подано в OTA','ops.ci.subDone':'Рахунок {n} подано в OTA','ops.ci.disDone':'Чернетку видалено','ops.ci.recvDone':'Рахунок {n} отримано OTA','ops.ci.paidDone':'Рахунок {n} позначено сплаченим',
 'ops.log.gen':'Сформовано акт звірки {n}','ops.log.auto':'Акт {n} підтверджено автоматично'},
en:{'ops.sec':'Documents','ops.nav.rs':'Statements','ops.nav.docs':'Documents → Operations','ops.docs.title':'Documents → Operations','ops.docs.sub':'All invoices, credit notes, reconciliation statements, partner invoices and SIM documents in one place.','ops.docs.how':'Documents are built from the legal templates (English | Russian) as A4 pages. “Print / PDF” opens the print view.','ops.docs.emptyF':'No documents match these filters',
 'ops.type.INV':'OTA invoice','ops.type.CN':'Credit note','ops.type.RS':'Statement','ops.type.CI':'Partner invoice','ops.type.PF':'Pro forma','ops.type.SR':'SIM receipt',
 'ops.col.type':'Type','ops.col.number':'Number','ops.col.date':'Date','ops.col.cc':'Country','ops.col.status':'Status','ops.col.month':'Month','ops.col.commission':'Commission','ops.col.deadline':'Deadline / date','ops.col.ci':'Partner invoice','ops.col.line':'Line','ops.col.total':'Total','ops.col.confirm':'Confirmation','ops.col.amount':'Amount','ops.col.paid':'Paid','ops.col.dueBy20':'Due by the 20th',
 'ops.st.inv.open':'Awaiting payment','ops.st.inv.paid':'Paid','ops.st.inv.overdue':'Overdue','ops.st.inv.cancelled':'Cancelled','ops.st.issued':'Issued','ops.st.sh.prepared':'Prepared','ops.st.sh.shipped':'Shipped','ops.st.sh.delivered':'Delivered','ops.st.sh.received':'Received','ops.st.sr.await':'Awaiting signature','ops.st.sr.signed':'Confirmed by partner',
 'ops.print':'Print / PDF','ops.openSrc':'Open source page','ops.btn.inv':'Invoice print / PDF','ops.btn.cn':'Credit note print / PDF','ops.btn.pf':'Pro forma (PF)','ops.btn.sr':'SIM receipt (SR)','ops.nf':'Document not found','ops.nf.p':'It may have been removed or the link is out of date.','ops.missing':'The template has no values for: {k}','ops.adm.h':'OTA actions (demo)','ops.byAgreement':'by agreement of the parties',
 'ops.inv.vat0':'VAT is always 0% — zero-rated export of services (Article 31, Executive Regulation of Federal Decree-Law No. 8 of 2017); the VAT amount in AED uses the UAE Central Bank rate on the invoice date, stored with the invoice. Country: {cc}. Keys and tokens are issued only after the payment mark.','ops.ci.draftNote':'This is a draft. The invoice is sent to OTA when you press “Submit”.','ops.sr.blank':'The partner has not confirmed receipt yet: quantity, condition and storage fields are left blank to be completed by hand.',
 'ops.rs.title':'Reconciliation statements','ops.rs.sub':'Every month by the 10th for the previous month, per country.','ops.rs.how':'Confirm the statement or dispute individual lines within 5 business days. No answer means it is confirmed automatically. After confirmation the portal proposes a draft commission invoice (due by the 15th).','ops.rs.empty':'No statements yet','ops.rs.emptyP':'The first statement appears after a month with direct-subscription payments closes.',
 'ops.rs.k.wait':'Awaiting confirmation','ops.rs.k.waitS':'on your desk','ops.rs.k.disp':'Disputed statements','ops.rs.k.dispS':'waiting for OTA','ops.rs.k.comm':'Commission for {m}','ops.rs.k.commS':'all countries','ops.rs.k.ci':'Invoices to submit','ops.rs.k.ciS':'commission without an invoice',
 'ops.rs.st.issued':'Under review','ops.rs.st.confirmed':'Confirmed','ops.rs.st.auto':'Auto-confirmed','ops.rs.st.disputed':'Disputed',
 'ops.rs.adm.p':'OTA Finance generates the statements for {m} (automatically by the 10th) and closes disputes.','ops.rs.gen':'Generate statements for {m}','ops.rs.genDone':'Statements generated: {n} (for {m})','ops.rs.genNone':'All statements for {m} are already generated','ops.sim5':'Simulate 5 business days','ops.sim5.h':'Demo: moves the clock by 5 business days and auto-confirms statements the partner did not answer.','ops.sim5.done':'Clock moved. Statements auto-confirmed: {n}',
 'ops.rs.b.issued':'This statement awaits your answer until {d}.','ops.rs.b.issuedP':'Confirm it or dispute individual lines. If you stay silent it is deemed confirmed.','ops.rs.b.disputed':'Disputed lines: {n}.','ops.rs.b.disputedP':'Undisputed amounts are paid on time. OTA answers the dispute, then the statement is confirmed.','ops.rs.b.auto':'Auto-confirmed on {d}.','ops.rs.b.autoP':'No answer from the partner within the period.','ops.rs.b.conf':'Confirmed on {d}.',
 'ops.rs.detailSub':'{c} · {m} · commission {a}','ops.rs.secA':'A. Direct subscriptions — commission calculation (USD)','ops.rs.secB':'B. OTA invoices of the month','ops.rs.aNote':'Gross payments are in USD at the acquirer’s rate. The statement is not a tax invoice and does not set off any payment.',
 'ops.ln.months':'Paid subscription months','ops.ln.gross':'Gross payments received','ops.ln.tax':'Less OTA taxes in the customer’s country','ops.ln.acq':'Less acquiring fees','ops.ln.refunds':'Less refunds and chargebacks','ops.ln.fee':'Less country compliance fee','ops.ln.ncr':'Net Collected Revenue','ops.ln.retained':'Less OTA Retained Amount (× paid months)','ops.ln.corr':'Corrections for prior months','ops.ln.commission':'Partner commission','ops.ln.bkeys':'Activation Keys (invoices of the month)','ops.ln.btokens':'Service Tokens (invoices of the month)','ops.b.keys':'Activation Keys','ops.b.tokens':'Service Tokens',
 'ops.ln.ok':'Confirmed','ops.ln.disputed':'Disputed','ops.ln.dispute':'Dispute',
 'ops.rs.conf':'Confirm statement','ops.rs.confRest':'Confirm the remaining lines','ops.rs.confDone':'Statement {n} confirmed','ops.rs.confRestDone':'Undisputed lines of {n} confirmed',
 'ops.disp.mT':'Dispute a line','ops.disp.comment':'Comment to OTA','ops.disp.hint':'Explain what does not match your records.','ops.disp.err':'Write a comment (a few words at least)','ops.disp.send':'Send to OTA','ops.disp.done':'Dispute on statement {n} sent to OTA','ops.disp.t':'Disputes','ops.disp.open':'Open','ops.disp.resolved':'Resolved','ops.disp.answer':'OTA answer','ops.disp.resolve':'Close dispute','ops.disp.rT':'Answer the dispute','ops.disp.resDone':'Dispute closed',
 'ops.tl.t':'Statement progress','ops.tl.issued':'Statement generated','ops.tl.issuedD':'{d}. To be generated by {n}.','ops.tl.review':'Partner review','ops.tl.reviewD':'until {d} (5 business days), then auto-confirmation','ops.tl.confD':'{d} · {n}','ops.tl.autoD':'auto-confirmed {d}','ops.tl.dispD':'disputed, waiting for OTA','ops.tl.ci':'Partner invoice','ops.tl.ciD':'{n} · submitted {d}','ops.tl.ciW':'submit by {d}','ops.tl.recv':'OTA received the invoice','ops.tl.recvW':'OTA Finance marks it','ops.tl.paid':'Paid','ops.tl.paidW':'by {d}',
 'ops.iss.t':'Keys and tokens of the month','ops.iss.keys':'Activation Keys issued','ops.iss.tokens':'Service Tokens issued','ops.iss.p':'Issued only after OTA Finance marks the invoice as paid.',
 'ops.d.t':'Operational data (for information)','ops.d.custody':'SIMs in custody','ops.d.keys':'Keys: purchased / used / unused','ops.d.tokens':'Tokens: issued / redeemed / unredeemed / expired','ops.d.active':'Active devices: token / subscription','ops.d.imei':'IMEI added to the Whitelist',
 'ops.ci.t':'Partner commission invoice','ops.ci.st.draft':'Draft','ops.ci.st.submitted':'Submitted to OTA','ops.ci.st.received':'Received by OTA','ops.ci.st.paid':'Paid','ops.ci.st.overdue':'Not submitted (overdue)','ops.ci.st.todo':'To submit','ops.ci.st.none':'Not needed','ops.ci.st.wait':'After statement is confirmed','ops.ci.uploaded':'uploaded file',
 'ops.ci.wait':'The invoice becomes available once the reconciliation statement is confirmed.','ops.ci.none':'No commission is payable for this month — no invoice is needed.','ops.ci.intro':'Commission per statement: {a}. Submit your invoice by {d}: the portal proposes a draft on template 14, or upload your own invoice.','ops.ci.overdue':'The deadline to submit the invoice ({d}) has passed. Please submit it as soon as possible.','ops.ci.propose':'Propose a draft from the statement','ops.ci.upload':'Upload my own invoice',
 'ops.ci.no':'Number','ops.ci.rs':'Statement','ops.ci.vat':'VAT','ops.ci.date':'Invoice date','ops.ci.due':'OTA payment due','ops.ci.file':'Invoice file','ops.ci.vatT':'VAT treatment','ops.ci.submit':'Submit to OTA','ops.ci.discard':'Discard draft','ops.ci.bankNote':'Bank details come from the partner questionnaire (Bank section). The intermediary bank is shown only when filled in.',
 'ops.ci.markRecv':'Mark as received','ops.ci.markPaid':'Mark as paid','ops.ci.closed':'The invoice is paid; the cycle is complete.','ops.ci.rc':'UAE VAT accounted by reverse charge','ops.ci.rcH':'Flag for OTA accounting.','ops.ci.rcDone':'UAE VAT reverse charge accounted','ops.ci.rcOn':'Invoice {n}: reverse charge flagged','ops.ci.rcOff':'Invoice {n}: flag cleared',
 'ops.ci.propT':'Draft commission invoice','ops.ci.editT':'Edit draft','ops.ci.propP':'The amount comes from statement {rs}. Numbering is your own; the portal stores the link to the statement.','ops.ci.seq':'Sequence number ({p}-INV-…)','ops.ci.seqH':'Format YYYY-NNNN, e.g. 2026-0001','ops.ci.seqE':'Enter the number as YYYY-NNNN','ops.ci.seqDup':'This invoice number already exists','ops.ci.vatA':'VAT amount, USD','ops.ci.vatE':'Enter a number from 0','ops.ci.vatH':'As concluded by the partner’s tax adviser.','ops.ci.saveDraft':'Save draft','ops.ci.draftDone':'Draft {n} saved',
 'ops.ci.upT':'Upload my own invoice','ops.ci.upP':'The invoice must carry the same information as template 14. Amount before VAT: {a}.','ops.ci.fileH':'The demo stores the file name only.','ops.ci.fileE':'Choose the invoice file','ops.ci.theirNo':'Your invoice number','ops.ci.upSubmit':'Upload and submit','ops.ci.upDone':'Invoice {n} submitted to OTA','ops.ci.subDone':'Invoice {n} submitted to OTA','ops.ci.disDone':'Draft discarded','ops.ci.recvDone':'Invoice {n} received by OTA','ops.ci.paidDone':'Invoice {n} marked as paid',
 'ops.log.gen':'Reconciliation statement {n} generated','ops.log.auto':'Statement {n} auto-confirmed'},
ru:{'ops.sec':'Документы','ops.nav.rs':'Акты сверки','ops.nav.docs':'Документы → Операции','ops.docs.title':'Документы → Операции','ops.docs.sub':'Все счета, кредит-ноты, акты сверки, счета партнёра и SIM-документы в одном месте.','ops.docs.how':'Документы формируются из юридических шаблонов (английский | русский) в виде A4. Кнопка «Печать / PDF» открывает версию для печати.','ops.docs.emptyF':'Документов по этим фильтрам нет',
 'ops.type.INV':'Счёт OTA','ops.type.CN':'Кредит-нота','ops.type.RS':'Акт сверки','ops.type.CI':'Счёт партнёра','ops.type.PF':'Проформа','ops.type.SR':'Акт приёмки SIM',
 'ops.col.type':'Тип','ops.col.number':'Номер','ops.col.date':'Дата','ops.col.cc':'Страна','ops.col.status':'Статус','ops.col.month':'Месяц','ops.col.commission':'Вознаграждение','ops.col.deadline':'Срок / дата','ops.col.ci':'Счёт партнёра','ops.col.line':'Строка','ops.col.total':'Итого','ops.col.confirm':'Подтверждение','ops.col.amount':'Сумма','ops.col.paid':'Оплачено','ops.col.dueBy20':'К оплате до 20-го',
 'ops.st.inv.open':'Ждёт оплаты','ops.st.inv.paid':'Оплачен','ops.st.inv.overdue':'Просрочен','ops.st.inv.cancelled':'Отменён','ops.st.issued':'Выдана','ops.st.sh.prepared':'Подготовлена','ops.st.sh.shipped':'Отправлена','ops.st.sh.delivered':'Доставлена','ops.st.sh.received':'Получена','ops.st.sr.await':'Ждёт подписи','ops.st.sr.signed':'Подтверждён партнёром',
 'ops.print':'Печать / PDF','ops.openSrc':'Открыть источник','ops.btn.inv':'Счёт для печати / PDF','ops.btn.cn':'Кредит-нота для печати / PDF','ops.btn.pf':'Проформа (PF)','ops.btn.sr':'Акт приёмки SIM (SR)','ops.nf':'Документ не найден','ops.nf.p':'Возможно, он удалён или ссылка устарела.','ops.missing':'В шаблоне нет значений для: {k}','ops.adm.h':'Действия OTA (демо)','ops.byAgreement':'по согласию сторон',
 'ops.inv.vat0':'НДС всегда 0% — экспорт услуг (ст. 31 Исполнительного регламента к Федеральному декрету-закону № 8 от 2017 г.); сумма НДС в AED — по курсу ЦБ ОАЭ на дату счёта, сохранённому вместе со счётом. Страна: {cc}. Ключи и токены выпускаются только после отметки об оплате.','ops.ci.draftNote':'Это черновик. Счёт уйдёт в OTA после кнопки «Подать».','ops.sr.blank':'Партнёр ещё не подтвердил получение: поля количества, состояния и места хранения оставлены пустыми для заполнения от руки.',
 'ops.rs.title':'Акты сверки','ops.rs.sub':'Ежемесячно до 10-го числа за предыдущий месяц, отдельно по каждой стране.','ops.rs.how':'Подтвердите акт или оспорьте отдельные строки в течение 5 рабочих дней. Без ответа акт считается подтверждённым автоматически. После подтверждения портал предложит черновик счёта на вознаграждение (до 15-го).','ops.rs.empty':'Актов пока нет','ops.rs.emptyP':'Первый акт появится после закрытия месяца с платежами по прямым подпискам.',
 'ops.rs.k.wait':'Ждут подтверждения','ops.rs.k.waitS':'у вас на проверке','ops.rs.k.disp':'Спорные акты','ops.rs.k.dispS':'ждут ответа OTA','ops.rs.k.comm':'Вознаграждение за {m}','ops.rs.k.commS':'по всем странам','ops.rs.k.ci':'Счета к подаче','ops.rs.k.ciS':'вознаграждение без счёта',
 'ops.rs.st.issued':'На проверке','ops.rs.st.confirmed':'Подтверждён','ops.rs.st.auto':'Автоподтверждён','ops.rs.st.disputed':'Есть спор',
 'ops.rs.adm.p':'Финансист OTA формирует акты за {m} (автоматически до 10-го числа) и закрывает споры.','ops.rs.gen':'Сформировать акты за {m}','ops.rs.genDone':'Сформировано актов: {n} (за {m})','ops.rs.genNone':'Все акты за {m} уже сформированы','ops.sim5':'Имитировать 5 рабочих дней','ops.sim5.h':'Демо: сдвигает часы на 5 рабочих дней и подтверждает акты, на которые партнёр не ответил.','ops.sim5.done':'Часы сдвинуты. Автоподтверждено актов: {n}',
 'ops.rs.b.issued':'Акт ждёт вашего ответа до {d}.','ops.rs.b.issuedP':'Подтвердите его или оспорьте отдельные строки. Без ответа он считается подтверждённым.','ops.rs.b.disputed':'Спорных строк: {n}.','ops.rs.b.disputedP':'Бесспорные суммы оплачиваются в срок. OTA ответит на спор, после чего акт будет подтверждён.','ops.rs.b.auto':'Автоматически подтверждён {d}.','ops.rs.b.autoP':'Ответа партнёра в срок не поступило.','ops.rs.b.conf':'Подтверждён {d}.',
 'ops.rs.detailSub':'{c} · {m} · вознаграждение {a}','ops.rs.secA':'A. Прямые подписки — расчёт вознаграждения (USD)','ops.rs.secB':'B. Счета OTA за месяц','ops.rs.aNote':'Валовые поступления — в USD по курсу эквайера. Акт не является налоговым счётом и не производит зачёт платежей.',
 'ops.ln.months':'Оплаченные месяцы подписки','ops.ln.gross':'Валовые поступления','ops.ln.tax':'Минус косвенные налоги OTA в стране клиента','ops.ln.acq':'Минус эквайринг','ops.ln.refunds':'Минус возвраты и chargeback','ops.ln.fee':'Минус страновой сбор','ops.ln.ncr':'Чистая собранная выручка','ops.ln.retained':'Минус сумма, удерживаемая OTA (× оплаченные месяцы)','ops.ln.corr':'Корректировки за прошлые месяцы','ops.ln.commission':'Вознаграждение партнёра','ops.ln.bkeys':'Ключи активации (счета месяца)','ops.ln.btokens':'Сервисные токены (счета месяца)','ops.b.keys':'Ключи активации','ops.b.tokens':'Сервисные токены',
 'ops.ln.ok':'Подтверждено','ops.ln.disputed':'Оспорено','ops.ln.dispute':'Оспорить',
 'ops.rs.conf':'Подтвердить акт','ops.rs.confRest':'Подтвердить остальные строки','ops.rs.confDone':'Акт {n} подтверждён','ops.rs.confRestDone':'Бесспорные строки акта {n} подтверждены',
 'ops.disp.mT':'Оспорить строку','ops.disp.comment':'Комментарий для OTA','ops.disp.hint':'Объясните, что не совпадает с вашими данными.','ops.disp.err':'Напишите комментарий (хотя бы несколько слов)','ops.disp.send':'Отправить в OTA','ops.disp.done':'Спор по акту {n} отправлен в OTA','ops.disp.t':'Споры','ops.disp.open':'Открыт','ops.disp.resolved':'Решён','ops.disp.answer':'Ответ OTA','ops.disp.resolve':'Закрыть спор','ops.disp.rT':'Ответить на спор','ops.disp.resDone':'Спор закрыт',
 'ops.tl.t':'Ход акта','ops.tl.issued':'Акт сформирован','ops.tl.issuedD':'{d}. Срок формирования — до {n}.','ops.tl.review':'Проверка партнёром','ops.tl.reviewD':'до {d} (5 рабочих дней), затем автоподтверждение','ops.tl.confD':'{d} · {n}','ops.tl.autoD':'автоподтверждение {d}','ops.tl.dispD':'есть спор, ждём ответа OTA','ops.tl.ci':'Счёт партнёра','ops.tl.ciD':'{n} · подан {d}','ops.tl.ciW':'подать до {d}','ops.tl.recv':'OTA получила счёт','ops.tl.recvW':'отметит финансист OTA','ops.tl.paid':'Оплачен','ops.tl.paidW':'до {d}',
 'ops.iss.t':'Ключи и токены за месяц','ops.iss.keys':'Ключей активации выпущено','ops.iss.tokens':'Сервисных токенов выпущено','ops.iss.p':'Выпуск происходит только после отметки «оплачено» финансистом OTA.',
 'ops.d.t':'Операционные данные (справочно)','ops.d.custody':'SIM на хранении','ops.d.keys':'Ключи: куплено / использовано / не использовано','ops.d.tokens':'Токены: выпущено / погашено / не погашено / истекло','ops.d.active':'Активные устройства: токен / подписка','ops.d.imei':'IMEI добавлено в Белый список',
 'ops.ci.t':'Счёт партнёра на вознаграждение','ops.ci.st.draft':'Черновик','ops.ci.st.submitted':'Подан в OTA','ops.ci.st.received':'Получен OTA','ops.ci.st.paid':'Оплачен','ops.ci.st.overdue':'Не подан (просрочено)','ops.ci.st.todo':'Нужно подать','ops.ci.st.none':'Не нужен','ops.ci.st.wait':'После подтверждения акта','ops.ci.uploaded':'загруженный файл',
 'ops.ci.wait':'Счёт станет доступен после подтверждения акта сверки.','ops.ci.none':'За этот месяц вознаграждения к выплате нет — счёт не нужен.','ops.ci.intro':'Вознаграждение по акту: {a}. Подайте счёт до {d}: портал предложит черновик по шаблону 14 или загрузите собственный счёт.','ops.ci.overdue':'Срок подачи счёта ({d}) истёк. Подайте его как можно скорее.','ops.ci.propose':'Предложить черновик из акта','ops.ci.upload':'Загрузить собственный счёт',
 'ops.ci.no':'Номер','ops.ci.rs':'Акт сверки','ops.ci.vat':'НДС','ops.ci.date':'Дата счёта','ops.ci.due':'Срок оплаты OTA','ops.ci.file':'Файл счёта','ops.ci.vatT':'Режим НДС','ops.ci.submit':'Подать в OTA','ops.ci.discard':'Удалить черновик','ops.ci.bankNote':'Банковские реквизиты берутся из анкеты партнёра (раздел «Банк»). Банк-посредник выводится только если заполнен.',
 'ops.ci.markRecv':'Отметить «получен»','ops.ci.markPaid':'Отметить «оплачен»','ops.ci.closed':'Счёт оплачен, цикл завершён.','ops.ci.rc':'НДС ОАЭ начислен по обратному начислению','ops.ci.rcH':'Отметка для бухгалтерии OTA.','ops.ci.rcDone':'НДС ОАЭ: обратное начисление учтено','ops.ci.rcOn':'Счёт {n}: отмечено обратное начисление НДС','ops.ci.rcOff':'Счёт {n}: отметка снята',
 'ops.ci.propT':'Черновик счёта на вознаграждение','ops.ci.editT':'Изменить черновик','ops.ci.propP':'Сумма взята из акта {rs}. Нумерация ваша собственная; портал хранит связь с актом.','ops.ci.seq':'Порядковый номер ({p}-INV-…)','ops.ci.seqH':'Формат ГГГГ-NNNN, например 2026-0001','ops.ci.seqE':'Укажите номер в формате ГГГГ-NNNN','ops.ci.seqDup':'Такой номер счёта уже есть','ops.ci.vatA':'Сумма НДС, USD','ops.ci.vatE':'Введите число от 0','ops.ci.vatH':'По заключению налогового консультанта партнёра.','ops.ci.saveDraft':'Сохранить черновик','ops.ci.draftDone':'Черновик {n} сохранён',
 'ops.ci.upT':'Загрузить собственный счёт','ops.ci.upP':'Счёт должен содержать те же сведения, что и шаблон 14. Сумма без НДС: {a}.','ops.ci.fileH':'В демо сохраняется только имя файла.','ops.ci.fileE':'Выберите файл счёта','ops.ci.theirNo':'Номер вашего счёта','ops.ci.upSubmit':'Загрузить и подать','ops.ci.upDone':'Счёт {n} подан в OTA','ops.ci.subDone':'Счёт {n} подан в OTA','ops.ci.disDone':'Черновик удалён','ops.ci.recvDone':'Счёт {n} получен OTA','ops.ci.paidDone':'Счёт {n} отмечен оплаченным',
 'ops.log.gen':'Сформирован акт сверки {n}','ops.log.auto':'Акт {n} подтверждён автоматически'}});
I18N.add({uk:{'ops.type.A2':'Етикетка A2','ops.btn.a2':'Етикетка коробки A2','ops.cn.fallback':'Шаблон 13A не завантажено — показано резервну форму з тексту 13A.','ops.ci.multi':'Додати акти інших країн за цей місяць','ops.ci.multiH':'Один рахунок партнера може посилатися на кілька актів звірки: «per Statement(s) …».','ops.ci.amtH':'Сума — за основним актом; вибрані акти додаються при збереженні.'},
en:{'ops.type.A2':'A2 label','ops.btn.a2':'A2 box label','ops.cn.fallback':'Template 13A is not loaded — showing the fallback built from the 13A wording.','ops.ci.multi':'Add statements of other countries for this month','ops.ci.multiH':'One partner invoice may reference several statements: “per Statement(s) …”.','ops.ci.amtH':'Amount of the main statement; the selected statements are added on save.'},
ru:{'ops.type.A2':'Этикетка A2','ops.btn.a2':'Этикетка коробки A2','ops.cn.fallback':'Шаблон 13A не загружен — показана резервная форма из текста 13A.','ops.ci.multi':'Добавить акты других стран за этот месяц','ops.ci.multiH':'Один счёт партнёра может ссылаться на несколько актов сверки: «per Statement(s) …».','ops.ci.amtH':'Сумма — по основному акту; выбранные акты добавляются при сохранении.'}});
