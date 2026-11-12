/* ===== shared domain helpers + demo seed (core-owned) =====
   Invoices (mkInvoice/invoicePaid/creditNote), token exchange, SIM shipments, seedDemo. */
// Activation code: [country 1][partner 4][package digit 1][serial 5][secret 4][check 1] = 16 chars, Crockford Base32
const B32='0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function luhn32(str){let f=2,sum=0;for(let i=str.length-1;i>=0;i--){let a=f*B32.indexOf(str[i]);f=f===2?1:2;a=Math.floor(a/32)+a%32;sum+=a;}return B32[(32-sum%32)%32];}
function b32(n,len){let s='';for(let i=0;i<len;i++){s=B32[n%32]+s;n=Math.floor(n/32);}return s;}
function rndB32(len){let s='';for(let i=0;i<len;i++)s+=B32[Math.floor(Math.random()*32)];return s;}
function fmtCode(c){return c.match(/.{1,4}/g).join('-');}
// next serial per package is kept in S.org.serials[pkgKey]
function genCode(plan,term){const k=pkgKey(plan,term);S.org.serials=S.org.serials||{};const n=(S.org.serials[k]||0)+1;S.org.serials[k]=n;
 const body=S.org.prefix+PKG_DIGIT[k]+b32(n,5)+rndB32(4);return body+luhn32(body);}
function parseCode(raw){const c=String(raw||'').toUpperCase().replace(/O/g,'0').replace(/[IL]/g,'1').replace(/[^0-9A-Z]/g,'');
 if(c.length!==16)return{err:'len'};if(luhn32(c.slice(0,15))!==c[15])return{err:'check'};
 const k=Object.keys(PKG_DIGIT).find(x=>PKG_DIGIT[x]===c[5]);if(!k)return{err:'pkg'};const [plan,term]=k.split('-');return{prefix:c.slice(0,5),plan,term:+term,serial:c.slice(6,11),code:c};}
// Partner prefix: country letter + 4-char partner code
const COUNTRY_LETTER={UA:'K',PL:'P',ZA:'Z',KZ:'Q',MD:'M',GE:'G',DE:'D',RO:'R'};
function makePrefix(country){const pc=b32(1000+Math.floor(Math.random()*90000),4);return (COUNTRY_LETTER[country]||'X')+pc;}
// IMEI helpers
function imeiCheck(d14){let s=0;for(let i=0;i<14;i++){let n=+d14[i];if(i%2===1){n*=2;if(n>9)n-=9;}s+=n;}return String((10-s%10)%10);}
function genImei(tac,serial){const d14=tac+pad(serial,6);return d14+imeiCheck(d14);}
function validImei(s){return /^\d{15}$/.test(s)&&luhnOk(s);}
// ICCID (demo): 8938 0012 + 10-digit index + Luhn check digit = 19 digits (the customer portal validates Luhn)
function luhnDigit(body){let s=0;for(let i=body.length-1,alt=true;i>=0;i--,alt=!alt){let n=+body[i];if(alt){n*=2;if(n>9)n-=9;}s+=n;}return String((10-s%10)%10);}
function genIccid(n){const b='89380012'+pad(n,10);return b+luhnDigit(b);}
function fmtIccid(s){return s.replace(/(\d{4})(?=\d)/g,'$1 ');}
// order reference (not a legal document number): K-0001 for key orders, T-0001 for token orders
function orderNo(type){return (type==='key'?'K-':'T-')+pad(seqNext(((S.org&&S.org.code)||'PPP')+(type==='key'?':KO':':TO')),4);}
function iccidIndex(s){return parseInt(String(s).slice(8,18),10);}
// legacy status vocabulary (orders no longer ship SIMs; kept for older code)
const ORDER_FLOW=['awaiting_payment','paid'];
const SHIP_FLOW=['prepared','shipped','delivered','received'];
// extension point for the legal module: return a reason string to block new key/token orders for a country (e.g. unsigned class-A Order Form)
HOOKS.orderBlock=HOOKS.orderBlock||[];
function orderBlock(cc){for(const f of HOOKS.orderBlock){try{const r=f(cc);if(r)return r;}catch(e){console.error(e);}}return null;}
// number of the document in force (signed by both / acknowledged, effective date passed), or null → hidden (N/A rule)
function docRef(type,cc){if(typeof lg_docRef==='function'){try{return lg_docRef(type,cc);}catch(e){}}const ts=iso(now());const d=(S.docs||[]).filter(x=>x.type===type&&(!cc||x.cc===cc)&&(x.status==='signed_both'||x.status==='acknowledged')&&(!x.effective||x.effective<=ts)).sort((a,b)=>String(a.createdAt)<String(b.createdAt)?1:-1)[0];return d?d.number:null;}

/* ---------- OTA Tax Invoices (USD, or EUR for Approved Countries in Europe — pack v12) ---------- */
// Pack v12 (MPA 2.6, template 13): every OTA invoice and credit note has ONE VAT line — 0% (zero-rated export of services) or, for a Partner
// in the UAE (resident / VAT-registered / fixed establishment), 5% (vatRateFor). The AED line is always printed, with the real AED VAT amount.
const VAT0_EN='VAT 0% – zero-rated export of services (Article 31, Executive Regulation of Federal Decree-Law No. 8 of 2017 on VAT)';
const VAT0_L2={ru:'НДС 0% – экспорт услуг (ст. 31 Исполнительного регламента Федерального декрета-закона № 8 от 2017 г. о НДС)',uk:'ПДВ 0% – експорт послуг (ст. 31 Виконавчого регламенту Федерального декрету-закону № 8 від 2017 р. про ПДВ)'};
// template 13 v12: "… – or, for a Partner in the UAE: VAT 5% / … или для Партнёра в ОАЭ: НДС 5%"
const VAT5_EN='VAT 5%';
const VAT5_L2={ru:'НДС 5%',uk:'ПДВ 5%'};
function invVat(org){const r=vatInfoFor(org);return r.rate>0?{rate:r.rate,label:VAT5_EN,labelL2:VAT5_L2,warn:false,ae:true,reasons:r.reasons}:{rate:0,label:VAT0_EN,labelL2:VAT0_L2,warn:false,ae:false,reasons:[]};}
// VAT line text of a stored document (its own rate)
function vatLabelOf(d,lang){const five=+(d&&d.vatRate)>0;if(!lang||lang==='en')return five?VAT5_EN:VAT0_EN;return (five?VAT5_L2:VAT0_L2)[lang]||(five?VAT5_L2:VAT0_L2).ru;}
// VAT in AED = VAT × CBUAE rate of the document currency on the document date (2 decimals)
const vatAedOf=(vat,rate)=>r2((+vat||0)*(+rate||0));
// mandatory AED line (ТЗ 2.2) and the credit-note AED correction line (template 13A); {r} = rate stored with the document
const AED_LINE={en:'VAT amount in AED at the UAE Central Bank rate {r} on the invoice date',ru:'Сумма НДС в AED по курсу ЦБ ОАЭ {r} на дату счёта',uk:'Сума ПДВ в AED за курсом ЦБ ОАЕ {r} на дату рахунку'};
const AED_LINE_CN={en:'VAT adjustment in AED at the UAE Central Bank rate {r}',ru:'Корректировка НДС в AED по курсу ЦБ ОАЭ {r}',uk:'Коригування ПДВ в AED за курсом ЦБ ОАЕ {r}'};
function aedLine(rate,lang,cn){const T=cn?AED_LINE_CN:AED_LINE;return (T[lang]||T.en).replace('{r}',fmtAed(rate));}
const LINE_KEY_EN='Activation Keys – copies of the CONNECT computer program (licence activation keys)';
const LINE_KEY_L2={ru:'Ключи активации – экземпляры компьютерной программы CONNECT (лицензионные ключи активации)',uk:'Ключі активації – примірники комп’ютерної програми CONNECT (ліцензійні ключі активації)'};
function ccNameIn(cc,lang){try{return new Intl.DisplayNames([lang],{type:'region'}).of(cc)||cc;}catch(e){return cc;}}
// line: {type:'key'|'token'|'xchg', cc, plan, term, fromPlan, fromTerm, qty, unit, amount}. Key line ends with " – {Approved Country}" (ТЗ 2.2)
function lineDescEn(l){if(l.type==='key')return LINE_KEY_EN+(l.cc?' – '+ctyNameEn(l.cc):'');
 if(l.type==='token')return `Service Tokens ${PLAN_EN[l.plan]}, ${l.term} months`;
 if(l.type==='xchg')return `Service Tokens ${PLAN_EN[l.plan]}, ${l.term} months – exchange of ${PLAN_EN[l.fromPlan]}, ${l.fromTerm} months (price difference)`;return l.desc||'';}
function lineDescL2(l,lang){lang=lang||(S.org&&S.org.lang2)||'ru';if(lang==='en')return lineDescEn(l);const ru=lang==='ru';
 if(l.type==='key')return (LINE_KEY_L2[lang]||LINE_KEY_L2.ru)+(l.cc?' – '+ccNameIn(l.cc,lang==='uk'?'uk':'ru'):'');
 const tok=(p,tm)=>(ru?'Сервисные токены ':'Сервісні токени ')+PLAN_EN[p]+', '+tm+(ru?' мес.':' міс.');
 if(l.type==='token')return tok(l.plan,l.term);
 if(l.type==='xchg')return tok(l.plan,l.term)+(ru?' – обмен ':' – обмін ')+PLAN_EN[l.fromPlan]+', '+l.fromTerm+(ru?' мес. (разница в цене)':' міс. (різниця в ціні)');return l.desc||'';}
function lineDesc(l){return S.lang==='uk'||S.lang==='ru'?lineDescL2(l,S.lang):lineDescEn(l);} // UI language
function invNextNo(){return docNo('INV',{peek:true});}
// create and issue an OTA Tax Invoice. o: {cc, lines, kind:'keys'|'tokens'|'combined'|'exchange', orderIds, exchangeId, created, dueDays}
function mkInvoice(o){const created=o.created||iso(now());const v=invVat();const o2=S.org||{};const currency=ccy(o.cc);const fx=aedRate(created,currency);
 const lines=o.lines.map(l=>Object.assign({},l,{cc:l.cc||o.cc,unit:r2(l.unit),amount:r2(l.unit*l.qty)}));
 const net=r2(lines.reduce((a,l)=>a+l.amount,0));const vat=r2(net*v.rate);
 const inv={id:uid('inv'),number:docNo('INV',{date:created}),title:'Tax Invoice',kind:o.kind,cc:o.cc,currency,lines,net,vatRate:v.rate,vat,total:r2(net+vat),vatLabel:v.label,vatLabelL2:v.labelL2,vatWarn:v.warn,vatReasons:v.reasons,
  buyer:{name:o2.name||'',address:o2.address||'',regNo:o2.regNo||'',taxId:o2.taxId||'',country:o2.country||'',code:o2.code||''},
  seller:Object.assign({},S.ota),mpa:docRef('MPA'),of:docRef('OF',o.cc),priceVer:((o.created?priceList(o.cc,new Date(created)):priceList(o.cc))||{}).ver||null,
  status:'open',createdAt:created,dueAt:iso(addDays(created,o.dueDays||5)),paidAt:null,orderIds:o.orderIds||[],exchangeId:o.exchangeId||null,issued:false,cnId:null,
  aedRate:fx.rate,aedRateDate:fx.date,aedSrc:fx.src,aedCur:currency,vatAed:vatAedOf(vat,fx.rate)};
 S.invoices.unshift(inv);audit('invoice.issue',inv.number,{kind:inv.kind,cc:inv.cc,currency,total:inv.total,vatRate:inv.vatRate,vat:inv.vat,vatAed:inv.vatAed,aedRate:inv.aedRate});
 return inv;}
function invById(id){return S.invoices.find(i=>i.id===id)||null;}
function invStatus(i){if(i.status==='paid'||i.status==='cancelled')return i.status;return new Date(i.dueAt)<now()?'overdue':'open';}
// mark paid (OTA Finance) → issue Activation Keys and Service Tokens automatically
function invoicePaid(inv,at){if(!inv||inv.status!=='open')return false;const ts=at||iso(now());inv.status='paid';inv.paidAt=ts;
 if(!inv.issued){inv.lines.forEach(l=>{
   if(l.type==='key')addKeyLot(l.qty,{cc:l.cc,unit:l.unit,invoiceId:inv.id,invoiceNo:inv.number,issuedAt:ts});
   else if(l.type==='token')addTokenLot(pkgKey(l.plan,l.term),l.qty,{cc:l.cc,unit:l.unit,invoiceId:inv.id,invoiceNo:inv.number,issuedAt:ts});});
  if(inv.exchangeId){const x=(S.exchanges||[]).find(e=>e.id===inv.exchangeId);if(x)exchangeComplete(x,ts);}
  inv.issued=true;}
 [S.keyOrders,S.tokenOrders].forEach(list=>list.forEach(o=>{if(inv.orderIds.includes(o.id)&&o.status==='awaiting_payment'){const all=S.invoices.filter(i=>i.id===o.invoiceId);if(all.every(i=>i.status==='paid')){o.status='paid';o.paidAt=ts;}}}));
 audit('invoice.paid',inv.number,{total:inv.total});
 const k=inv.lines.filter(l=>l.type==='key').reduce((a,l)=>a+l.qty,0),tk=inv.lines.filter(l=>l.type==='token').reduce((a,l)=>a+l.qty,0);
 if(k)audit('keys.issue',inv.number,{qty:k});if(tk)audit('tokens.issue',inv.number,{qty:tk});return true;}
// how many keys/tokens issued from this invoice have been used already
function invUsed(inv){let n=0;(S.keyLots||[]).forEach(l=>{if(l.invoiceId===inv.id)n+=l.used;});(S.tokenLots||[]).forEach(l=>{if(l.invoiceId===inv.id)n+=l.used+(l.reserved||0);});return n;}
/* ---------- Tax Credit Notes (template 13A, OTA-CN-YYYY-NNNNNN, global, never reused) ----------
   Reason (ТЗ v10 2.3): cancel_unpaid | error | refund. Lines are the invoice lines with negative amounts, in the invoice currency, with the invoice's VAT
   rate (0%, or 5% for a UAE partner — v12) and the AED VAT correction at the rate of the credit-note date. Unpaid invoice → status 'cancelled', nothing is ever issued under it. Paid invoice (only while none of its keys/tokens is used) →
   lots revoked and the amount is refunded to the partner's bank account or set off against the next order (o.settle: 'refund' | 'setoff'). */
const CN_REASONS={cancel_unpaid:{en:'Cancellation of an unpaid invoice',ru:'Отмена неоплаченного счёта',uk:'Скасування неоплаченого рахунку'},
 error:{en:'Correction of an error',ru:'Исправление ошибки',uk:'Виправлення помилки'},
 refund:{en:'Refund under clause 4.3 of Document 03 or clause 10.3 of the Master Agreement',ru:'Возврат по п. 4.3 Документа 03 или п. 10.3 Рамочного соглашения',uk:'Повернення за п. 4.3 Документа 03 або п. 10.3 Рамкової угоди'}};
// 13A body text (template wording, EN / RU)
const CN_TEXT={en:"This credit note reduces or cancels the original invoice stated above. Where the original invoice was not paid, no payment is due under it and no Activation Keys or Service Tokens are issued under it. Where it was paid, the credited amount is refunded to Partner's bank account or set off against Partner's next order, as stated in the Reason. Credit note numbers are never reused.",
 ru:'Настоящая кредит-нота уменьшает или аннулирует указанный выше исходный счёт. Если исходный счёт не был оплачен, платёж по нему не причитается и Ключи активации и Сервисные токены по нему не выпускаются. Если он был оплачен, сумма к уменьшению возвращается на банковский счёт Партнёра или засчитывается в следующий заказ Партнёра, как указано в Основании. Номера кредит-нот повторно не используются.'};
function cnReasonsFor(inv){return inv&&inv.status==='paid'?['refund','error']:['cancel_unpaid','error'];}
function cnReasonText(cn,lang){const r=CN_REASONS[cn&&cn.reason];if(r)return r[lang]||r.en;return String((cn&&(cn.reasonNote||cn.reason))||'');}
function creditNote(inv,reason,o){o=o||{};if(!inv||inv.status==='cancelled')return null;if(inv.status==='paid'&&invUsed(inv)>0)return null;
 const paid=inv.status==='paid';let code=CN_REASONS[reason]?reason:(paid?'error':'cancel_unpaid');const note=CN_REASONS[reason]?String(o.note||''):String(reason||'');
 if(!cnReasonsFor(inv).includes(code))return null;
 const ts=iso(now());const currency=docCcy(inv);const fx=aedRate(ts,currency);const vat=r2(+inv.vat||0);
 const cn={id:uid('cn'),number:docNo('CN',{date:ts}),invoiceId:inv.id,invoiceNo:inv.number,invoiceDate:inv.createdAt,currency,cc:inv.cc,
  lines:inv.lines.map(l=>Object.assign({},l,{amount:-Math.abs(l.amount)})),net:inv.net,vat,total:r2(inv.net+vat),vatRate:+inv.vatRate||0,aedRate:fx.rate,aedRateDate:fx.date,aedSrc:fx.src,aedCur:currency,vatAed:vatAedOf(vat,fx.rate),
  reason:code,reasonNote:note,wasPaid:paid,settle:paid?(o.settle==='setoff'?'setoff':'refund'):null,createdAt:ts,by:actorName()};
 S.creditNotes=S.creditNotes||[];S.creditNotes.unshift(cn);
 if(inv.status==='paid'){(S.keyLots||[]).forEach(l=>{if(l.invoiceId===inv.id)l.revoked=iso(now());});(S.tokenLots||[]).forEach(l=>{if(l.invoiceId===inv.id)l.revoked=iso(now());});}
 inv.status='cancelled';inv.cancelledAt=cn.createdAt;inv.cnId=cn.id;
 [S.keyOrders,S.tokenOrders].forEach(list=>list.forEach(o=>{if(o.invoiceId===inv.id&&o.status!=='cancelled'){o.status='cancelled';o.cancelledAt=cn.createdAt;}}));
 if(inv.exchangeId){const x=(S.exchanges||[]).find(e=>e.id===inv.exchangeId);if(x&&x.status==='awaiting_payment')exchangeCancel(x);}
 audit('creditnote.issue',cn.number,{invoice:inv.number,currency,total:-cn.total,vat:-cn.vat,reason:cn.reason,settle:cn.settle,aedRate:cn.aedRate});return cn;}

/* ---------- Service Token exchange: pay the difference if more expensive, no refund if cheaper ---------- */
function exchangeQuote(from,to,cc){const a=pkgSplit(from),b=pkgSplit(to);return r2(tokenPrice(b.plan,b.term,cc)-tokenPrice(a.plan,a.term,cc));}
function exchangeCreate(from,to,qty,cc){if(from===to||!(qty>0))return{err:'same'};if(tokensAvail(from)<qty)return{err:'avail'};
 const lots=(S.tokenLots||[]).filter(l=>l.key===from&&!l.revoked&&!lotExpired(l)&&lotFree(l)>0).sort((a,b)=>a.expiresAt<b.expiresAt?-1:1);
 let left=qty;const res=[];for(const l of lots){if(!left)break;const n=Math.min(left,lotFree(l));l.reserved=(l.reserved||0)+n;res.push({lotId:l.id,n});left-=n;}
 const diff=exchangeQuote(from,to,cc);const x={id:uid('xc'),from,to,qty,cc,diffUnit:Math.max(0,diff),rawDiff:diff,res,invoiceId:null,status:'awaiting_payment',createdAt:iso(now()),doneAt:null};
 S.exchanges=S.exchanges||[];S.exchanges.unshift(x);audit('tokens.exchange.request',from+'→'+to,{qty,diff});
 if(diff>0.004){const b=pkgSplit(to),a=pkgSplit(from);const inv=mkInvoice({cc,kind:'exchange',exchangeId:x.id,lines:[{type:'xchg',plan:b.plan,term:b.term,fromPlan:a.plan,fromTerm:a.term,qty,unit:diff}]});x.invoiceId=inv.id;}
 else exchangeComplete(x);return{x};}
function exchangeComplete(x,at){if(x.status!=='awaiting_payment')return;const ts=at||iso(now());
 x.res.forEach(r=>{const l=(S.tokenLots||[]).find(q=>q.id===r.lotId);if(!l)return;l.reserved=Math.max(0,(l.reserved||0)-r.n);l.used+=r.n;
  addTokenLot(x.to,r.n,{cc:l.cc,unit:r2(l.unit+x.diffUnit),invoiceId:x.invoiceId,invoiceNo:x.invoiceId?(invById(x.invoiceId)||{}).number:'',issuedAt:ts,expiresAt:l.expiresAt,src:'exchange'});});
 x.status='done';x.doneAt=ts;audit('tokens.exchange.done',x.from+'→'+x.to,{qty:x.qty});}
function exchangeCancel(x){x.res.forEach(r=>{const l=(S.tokenLots||[]).find(q=>q.id===r.lotId);if(l)l.reserved=Math.max(0,(l.reserved||0)-r.n);});x.status='cancelled';audit('tokens.exchange.cancel',x.from+'→'+x.to,{qty:x.qty});}

/* ---------- SIM shipments in custody (free of charge, DAP; never invoiced) ----------
   ТЗ v10 1.2: SIMs never enter or transit the UAE. They ship only from an EU warehouse of OTA's supplier or logistics provider (ship_from) and the
   export declaration names an EU exporter of record acting for OTA with its EORI (exporter). OTA TECHNOLOGY DMCC is shown as owner of the goods. */
const EU_CC=['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'];
const SHIP_FROM_DEMO={name:'Demo EU Logistics Warehouse',addr:'Demo Logistics Park 1, 5600 AA Eindhoven',country:'NL'};   // fictional demo values
const EXPORTER_DEMO={name:'Demo EU Logistics B.V., acting for OTA TECHNOLOGY DMCC',eori:'NL000000001'};
function validEori(x){return /^[A-Z]{2}[A-Z0-9]{1,15}$/.test(String(x||'').replace(/\s/g,'').toUpperCase());}
function shipFromLine(h){const f=(h&&h.ship_from)||{};return [f.name,f.addr,f.country?ctyNameEn(f.country):''].filter(Boolean).join(', ');}
function nextIccidIndex(){let max=0;for(const s of S.sims){const n=iccidIndex(s.iccid);if(n>max)max=n;}for(const h of S.shipments||[])if(h.iccidTo>max)max=h.iccidTo;return max+1;}
// o: {cc, qty, iccidFrom, simType, unitValue, dap:{company,recipient,phone,address,city,country}, importer, cartons, gross, net, created,
//     ship_from:{name,addr,country (EU)}, exporter:{name,eori}}
/* ---------- Activation Keys and SIMs 1:1 (pack v12: MPA 7.1, 8.1; Document 09 1.2; OF 2.1 / 4.1) ----------
   "For each Activation Key purchased for an Approved Country, OTA provides one SIM for that country in custody, free of charge … the Activation Keys
   and these SIMs are shown in the cabinet as one batch." (MPA 7.1). "SIMs are shipped free of charge in the quantity of Activation Keys purchased for
   the country, in one or several shipments; a further shipment within that quantity is made when at least seventy per cent (70%) of the SIMs
   previously delivered to Partner for that country have been activated, unless OTA agrees otherwise." (MPA 8.1)
   Demo reading: purchased = key lots issued from paid invoices (not revoked by a credit note); previously delivered = every earlier shipment of the
   country (received quantity once received, otherwise the shipped quantity — in transit counts, conservative); activated = SIM status 'active'.
   The quantity cap is hard; the 70% rule may be waived by OTA ("unless OTA agrees otherwise") with a recorded note. */
const SIM_NEXT_PCT=0.70;
// keys bought for a country = SIMs OTA owes for that country
function simEntitled(cc){return (S.keyLots||[]).filter(l=>l.cc===cc&&!l.revoked).reduce((a,l)=>a+l.qty,0);}
// quota of a country: {cc, entitled, shipped, delivered, transit, activated, stock, pct, left, ok70, need, canShip, reason:''|'no_keys'|'quota'|'70'}
function simQuota(cc){const ent=simEntitled(cc);const ids=new Set();let shipped=0,delivered=0,transit=0;
 (S.shipments||[]).forEach(h=>{if(h.cc!==cc||h.status==='cancelled')return;ids.add(h.id);const n=h.receipt?h.receipt.received:h.qty;shipped+=n;if(h.status==='received'||h.status==='delivered')delivered+=n;else transit+=n;});
 let activated=0,stock=0;for(const x of S.sims){if(!ids.has(x.shipmentId))continue;if(x.status==='active')activated++;else if(x.status==='stock')stock++;}
 const pct=shipped?activated/shipped:0;const ok70=shipped===0||activated>=Math.ceil(shipped*SIM_NEXT_PCT-1e-9);const left=Math.max(0,ent-shipped);
 const need=shipped?Math.max(0,Math.ceil(shipped*SIM_NEXT_PCT-1e-9)-activated):0;
 const reason=left<=0?(ent?'quota':'no_keys'):(!ok70?'70':'');return{cc,entitled:ent,shipped,delivered,transit,activated,stock,pct,left,ok70,need,canShip:!reason,reason};}
// check a new shipment: '' | 'no_keys' | 'quota' (qty above the keys bought) | '70' (fewer than 70% activated, OTA has not agreed otherwise)
function shipCheck(cc,qty,override){const q=simQuota(cc);if(!q.entitled)return 'no_keys';if(qty>q.left)return 'quota';if(!q.ok70&&!(override&&String(override.note||'').trim()))return '70';return '';}
// one batch per Activation Key lot: the keys and the same number of SIMs (shipped SIMs are allocated to the oldest lots first)
function simBatches(cc){const lots=(S.keyLots||[]).filter(l=>!cc||l.cc===cc).sort((a,b)=>a.issuedAt<b.issuedAt?-1:1);const shipped={};const out=[];
 (S.shipments||[]).forEach(h=>{if(h.status==='cancelled')return;shipped[h.cc]=(shipped[h.cc]||0)+(h.receipt?h.receipt.received:h.qty);});
 lots.forEach(l=>{const ord=(S.keyOrders||[]).find(o=>o.invoiceId===l.invoiceId);const simQty=l.revoked?0:l.qty;const left=shipped[l.cc]||0;const alloc=Math.min(simQty,left);shipped[l.cc]=left-alloc;
  out.push({id:l.id,cc:l.cc,lot:l,orderNo:ord?ord.no:'',invoiceId:l.invoiceId,invoiceNo:l.invoiceNo,issuedAt:l.issuedAt,keys:l.qty,keysUsed:l.used,keysFree:lotFree(l),sims:simQty,simsShipped:alloc,simsToShip:simQty-alloc,revoked:!!l.revoked});});
 return out;}
// o: {…, override:{note} (OTA waives the 70% rule), force:true (seed/migration only: no check)} → shipment, or {err} when the rule blocks it
function shipCreate(o){if(!o.force){const e=shipCheck(o.cc,o.qty,o.override);if(e)return{err:e,quota:simQuota(o.cc)};}
 const q0=simQuota(o.cc);const ts=o.created||iso(now());const pf=docNo('PF',{date:ts});
 const sf=Object.assign({},SHIP_FROM_DEMO,o.ship_from||{}),ex=Object.assign({},EXPORTER_DEMO,o.exporter||{});
 const h={id:uid('sh'),pf,sr:docNo('SR',{pf}),cc:o.cc,qty:o.qty,iccidFrom:o.iccidFrom,iccidTo:o.iccidFrom+o.qty-1,simType:o.simType||'',hs:'8523.52',unitValue:o.unitValue,
  ship_from:{name:sf.name,addr:sf.addr,country:sf.country},ship_from_country:sf.country,exporter:{name:ex.name,eori:String(ex.eori||'').replace(/\s/g,'').toUpperCase()},
  dap:Object.assign({},o.dap),importer:o.importer||'',cartons:o.cartons||'',gross:o.gross||'',netw:o.net||'',carrier:'',waybill:'',
  status:'prepared',events:[['prepared',ts]],createdAt:ts,by:actorName(),receipt:null,
  rule:{entitled:q0.entitled,before:q0.shipped,activated:q0.activated,pct:q0.pct,ok70:q0.ok70,override:o.override&&String(o.override.note||'').trim()?{note:String(o.override.note).trim(),by:o.override.by||actorName(),at:ts}:null}};
 S.shipments=S.shipments||[];S.shipments.unshift(h);audit('shipment.create',pf,{qty:h.qty,cc:h.cc,sr:h.sr,ship_from:h.ship_from_country,eori:h.exporter.eori,entitled:q0.entitled,shippedBefore:q0.shipped,activatedPct:Math.round(q0.pct*1000)/10,override70:!!h.rule.override});return h;}
function shipAdvance(h,status,extra,at){const ts=at||iso(now());Object.assign(h,extra||{});h.status=status;h.events.push([status,ts]);audit('shipment.'+status,h.pf,extra||{});}
// partner confirms receipt & condition (SR) → SIMs enter inventory, in custody until installed
function shipReceive(h,r,at){const ts=at||iso(now());const n=clamp(r.received|0,0,h.qty);
 h.receipt={received:n,diff:h.qty-n,condition:r.condition||'intact',note:r.note||'',storage:r.storage||'',person:r.person||'',customsDecl:r.customsDecl||'',at:ts,by:actorName()};
 for(let i=0;i<n;i++)S.sims.push({iccid:genIccid(h.iccidFrom+i),shipmentId:h.id,status:'stock',imei:null,modelId:null,plan:null,term:null,paidUntil:null,code:null,keyLotId:null,linked:false,lastSeen:null,reseller:null,events:[[ts,'in_stock']]});
 h.status='received';h.events.push(['received',ts]);audit('shipment.received',h.sr,{received:n,diff:h.qty-n,condition:h.receipt.condition});return n;}

/* ---------- activation (ТЗ v10 3.1) ----------
   An Activation Key is consumed at activation (one per device for life). The plan comes EITHER from a Service Token (the activation code) OR from an
   active Direct Subscription (card payment on the portal, OTA = seller) — then no token is needed. No key → rejected (code stays valid).
   deviceActivate(sim, {via:'token', code} | {via:'subscription', sub}) → {ok, key:bool} | {err:'no_key'|'no_token'|'no_sub'|'plan'|…} */
function subActive(s,at){const x=(S.subs||[]).find(q=>q.iccid===(s&&s.iccid)&&q.status==='active'&&(!q.paidUntil||q.paidUntil>iso(at||now())));return x||null;}
function deviceActivate(s,o){o=o||{};if(!s)return{err:'no_sim'};const needKey=!s.keyLotId&&!deviceKeyed(s.imei);const kcc=simCc(s);
 if(needKey&&keysAvail(kcc)<=0)return{err:'no_key'};
 const ts=now();let lot=null;
 if(o.via==='subscription'){const sub=o.sub||subActive(s);if(!sub)return{err:'no_sub'};
  if(needKey){const kl=consumeKey(kcc);s.keyLotId=kl?kl.id:null;}
  s.plan=sub.plan;s.term=1;s.sub=sub.id;s.paidUntil=sub.paidUntil;s.code=null;s.lastSeen=iso(ts);s.events=s.events||[];s.events.push([iso(ts),'subscription']);
  audit('activation',s.iccid,{iccid:s.iccid,imei:s.imei,via:'subscription',sub:sub.id,key:needKey});return{ok:true,key:needKey,sub};}
 const c=o.code;if(!c)return{err:'no_code'};const k=pkgKey(c.plan,c.term);
 if(tokensAvail(k)<=0)return{err:'no_token'};
 lot=consumeToken(k);c.lotId=lot?lot.id:null;if(needKey){const kl=consumeKey(kcc);s.keyLotId=kl?kl.id:null;}c.keyLotId=s.keyLotId||null;c.status='activated';c.activatedAt=iso(ts);c.iccid=s.iccid;
 audit('activation',fmtCode(c.code),{iccid:s.iccid,imei:s.imei,via:'token',token:k,key:needKey});
 s.plan=c.plan;s.term=c.term;s.code=c.code;const until=new Date(ts.getTime());until.setMonth(until.getMonth()+c.term);s.paidUntil=iso(until);s.lastSeen=iso(ts);s.events=s.events||[];s.events.push([iso(ts),'package']);
 return{ok:true,key:needKey,lot};}
// demo: the end user pays a Direct Subscription by card on the portal (OTA is the seller) — monthly, auto-renewing
function subCreate(s,plan,o){o=o||{};const ts=o.at||iso(now());const shCc=((S.shipments||[]).find(h=>h.id===s.shipmentId)||{}).cc||primaryCc();
 const sub={id:uid('sub'),iccid:s.iccid,imei:s.imei,plan,cc:shCc,status:'active',startedAt:ts,paidUntil:iso(addMonths(ts,1)),autoRenew:true,src:'card'};
 S.subs=S.subs||[];S.subs.unshift(sub);audit('subscription.start',s.iccid,{plan,cc:sub.cc});return sub;}

/* ---------- notices without signature (shown by the legal module) ---------- */
function noticeAdd(n){S.notices=S.notices||[];const x=Object.assign({id:uid('nt'),createdAt:iso(now()),by:actorName(),signature:false,status:'sent'},n);S.notices.unshift(x);return x;}

/* ---------- sub-processor directory (Document 06, Annex 1) maintained by OTA (ТЗ v10 2.9) ----------
   Rows {id,name:{en,ru},service:{en,ru},location:{en,ru}}. If the e-mail provider is Amazon SES, OTA may merge it into ONE row
   "Amazon Web Services — Hosting, storage, backups, transactional email — {region}" (S.subproc.awsMerged + region).
   Every change → notice to ALL partners 30 days ahead (Document 06 clause 5.1), no signature. */
const SUBPROC_NOTICE_DAYS=30;
function subprocSeed(){const R=(id,n,nr,sv,svr,l,lr)=>({id,name:{en:n,ru:nr},service:{en:sv,ru:svr},location:{en:l,ru:lr}});
 return{awsMerged:false,awsRegion:{en:'UAE',ru:'ОАЭ'},rows:[
  R('aws','Amazon Web Services','Amazon Web Services','Hosting, storage, backups','Хостинг, хранение, резервные копии','UAE','ОАЭ'),
  R('local','Local hosting providers','Местные хостинг-провайдеры','Storage of data where local law requires it (list in the cabinet)','Хранение данных, где этого требует местный закон (перечень в кабинете)','Country concerned','Соответствующая страна'),
  R('twilio','Twilio','Twilio','SMS and messenger notifications','Уведомления по SMS и в мессенджерах','USA, EU','США, ЕС'),
  R('ni','Network International','Network International','Card acquiring and payment processing','Эквайринг и обработка платежей','UAE','ОАЭ'),
  R('net','Network infrastructure provider (name disclosed confidentially)','Поставщик сетевой инфраструктуры (раскрывается конфиденциально)','Connectivity, SIM management, network-based location (LBS)','Связь, управление SIM, определение местоположения по сети (LBS)','EU','ЕС'),
  R('email','','','Transactional emails','Транзакционные письма','','')],updatedAt:null,history:[]};}
function subprocDir(){if(!S.subproc||!Array.isArray(S.subproc.rows))S.subproc=subprocSeed();return S.subproc;}
// rows as printed in Document 06 Annex 1 (the e-mail row only when OTA filled it; AWS merged row when awsMerged)
function subprocRows(){const d=subprocDir();const f=x=>x&&String(x.en||'').trim();let rows=d.rows.map(r=>JSON.parse(JSON.stringify(r)));
 if(d.awsMerged){rows=rows.filter(r=>r.id!=='email');const a=rows.find(r=>r.id==='aws');if(a){a.name={en:'Amazon Web Services',ru:'Amazon Web Services'};
   a.service={en:'Hosting, storage, backups, transactional email',ru:'Хостинг, хранение, резервные копии, транзакционные письма'};a.location=Object.assign({},d.awsRegion);}}
 return rows.filter(r=>f(r.name)&&f(r.service));}
const subprocSig=rows=>JSON.stringify(rows.map(r=>[r.name.en,r.service.en,r.location.en]));
// apply a new directory state; when the printed list changes → notice to all partners (30 days, no signature). Returns the notice or null.
function subprocUpdate(next,note){const d=subprocDir();const before=subprocRows();Object.assign(d,next);const after=subprocRows();
 const em=d.rows.find(r=>r.id==='email');if(S.ota){S.ota.OTA_SUBPROC_EMAIL=d.awsMerged?'':(em&&em.name.en)||'';S.ota.OTA_SUBPROC_EMAIL_LOC=d.awsMerged?'':(em&&em.location.en)||'';}
 if(subprocSig(before)===subprocSig(after))return null;
 const key=r=>r.name.en;const added=after.filter(r=>!before.some(b=>key(b)===key(r))),removed=before.filter(b=>!after.some(r=>key(r)===key(b)));
 const changed=after.filter(r=>{const b=before.find(x=>key(x)===key(r));return b&&(b.service.en!==r.service.en||b.location.en!==r.location.en);});
 const ts=iso(now());d.updatedAt=ts;d.history=d.history||[];
 const n=noticeAdd({type:'subproc',doc:'DPA',to:'all_partners',effective:iso(addDays(ts,SUBPROC_NOTICE_DAYS)),noticeDays:SUBPROC_NOTICE_DAYS,
  clause:'Document 06, clause 5.1',rows:after,before,added:added.map(key),removed:removed.map(key),changed:changed.map(key),note:note||''});
 S.subprocNotices=S.subprocNotices||[];S.subprocNotices.unshift({id:n.id,at:ts,effective:n.effective,text:'Changes to the list of sub-processors (Document 06, Annex 1): '+[n.added.length?'added '+n.added.join(', '):'',n.removed.length?'removed '+n.removed.join(', '):'',n.changed.length?'changed '+n.changed.join(', '):''].filter(Boolean).join('; ')+'. Effective '+n.effective.slice(0,10)+' (30 days notice, clause 5.1 of Document 06).'+(note?' '+note:''),added:n.added,removed:n.removed,changed:n.changed,rows:after});
 d.history.unshift({at:ts,notice:n.id,rows:after});audit('subproc.notice',n.id,{added:n.added,removed:n.removed,changed:n.changed,effective:n.effective});return n;}

/* ---------- terminate the Order Form of one country instead of signing a price-changed version (ТЗ v10 3.5) ---------- */
function ofTerminated(cc){return ((S.org&&S.org.ofTerminated)||{})[cc]||null;}
function ofTerminate(cc,o){o=o||{};if(!S.org||ofTerminated(cc))return null;const of=docRef('OF',cc);const ts=iso(now());
 const n=noticeAdd({type:'of_terminate',cc,of:of||'',from:'partner',to:'OTA',reason:'price_change',priceVer:o.priceVer||null,note:o.note||''});
 S.org.ofTerminated=S.org.ofTerminated||{};S.org.ofTerminated[cc]={at:ts,by:actorName(),notice:n.id,of:of||'',priceVer:o.priceVer||null};
 audit('orderform.terminate',of||cc,{cc,notice:n.id,priceVer:o.priceVer||null});return n;}
HOOKS.orderBlock.push(cc=>ofTerminated(cc)?t('c.ofTermBlock',{c:ctyName(cc),d:fmtDate(ofTerminated(cc).at)}):null);

/* ---------- demo seed: a fully lived-in partner (ARVELO LIMITED, code ARV) ---------- */
function seedDemo(){
 const lang=S.lang;S=freshState();S.lang=lang;
 const n=now();const daysAgo=d=>iso(new Date(n.getTime()-d*864e5));
 S.authed=true;S.user={email:'maria.lind@arvelo.example',name:'Maria Lind'};
 S.org={name:'ARVELO LIMITED',code:'ARV',codeStatus:'approved',lang2:'ru',country:'GB',countries:['UA','KZ','DE'],regNo:'00012345',taxId:'',
  address:'10 Demo Lane, London, N1 0AA, United Kingdom',signatory:'Daniel Hart',title:'Director',opsName:'Andrii Melnyk',
  bank:{benef:'ARVELO LIMITED',iban:'GB29NWBK60161331926819',bank:'Demo Bank Ltd',bankAddr:'2 Demo Square, London, E1 0AA, United Kingdom',swift:'DEMOGB21',interSwift:'DEMOGB2L'},
  brand:'ARVELO',programme:'ARVELO CONNECT',domain:'connect.arvelo.example',
  delivery:{UA:{company:'ARVELO LIMITED',recipient:'Maria Lind',phone:'',address:'Warehouse No. 1',city:'Kyiv',country:'UA',importer:'ARVELO LIMITED'},
   KZ:{company:'ARVELO LIMITED',recipient:'Warehouse manager',phone:'',address:'Warehouse No. 2',city:'Almaty',country:'KZ',importer:'ARVELO LIMITED'},
   DE:{company:'ARVELO LIMITED',recipient:'Lena Vogel',phone:'',address:'Demo Lagerhalle 3',city:'Hamburg',country:'DE',importer:'ARVELO LIMITED'}},
  currency:'USD',prefix:'K02N5',createdAt:daysAgo(60),commit:3000,serials:{},phone:'',color:'#1F6FEB'};
 codeRegister('ARV');
 S.actor='u_p_admin';S.ota=otaSeed();fxSeed();
 otaCountrySet('UA',Object.assign(otaCountryDemo('UA'),{delay_hours:24,ownership_v10_enabled:true,currency:'USD'}));otaCountrySet('KZ',Object.assign(otaCountryDemo('KZ'),{delay_hours:24,ownership_v10_enabled:false,currency:'USD'}));
 // v12: Germany — Order Form in EUR; OTA's EU OSS registration for German VAT on Direct Subscriptions (fictional demo number)
 otaCountrySet('DE',Object.assign(otaCountryDemo('DE'),{delay_hours:24,ownership_v10_enabled:false,currency:'EUR',oss_no:DE_OSS_DEMO}));subprocDir();
 // questionnaire values from the Partner Data Form (legal module owns editing & review)
 const F=(v)=>({value:v,status:v?'filled':'empty',comment:'',by:'Maria Lind',at:daysAgo(58)});
 if(legalDemo()&&legalDemo().partner){const P=legalDemo().partner,ST=legalDemo().status||{};S.form={};Object.keys(P).forEach(k=>{S.form[k]={value:P[k],status:ST[k]||(P[k]==null?'empty':'filled'),comment:'',by:'Maria Lind',at:daysAgo(58)};});}else
 S.form={P_NAME:F('ARVELO LIMITED'),P_FORM_EN:F('a private limited company incorporated in England and Wales'),P_FORM_L2:F('частная компания с ограниченной ответственностью, учреждённая в Англии и Уэльсе'),
  P_COUNTRY:F('GB'),P_REGNO:F('00012345'),P_TAXNO:F(''),P_ADDR_EN:F('10 Demo Lane, London, N1 0AA, United Kingdom'),P_ADDR_L2:F(''),
  P_SIGNATORY:F('Daniel Hart'),P_TITLE_EN:F('Director'),P_TITLE_L2:F('Директор'),P_TITLE_L2_GEN:F('Директора'),P_AUTHORITY:F(''),LANG2:F('ru'),
  P_BRAND:F('ARVELO'),P_PROGRAMME:F('ARVELO CONNECT'),P_TM_OWNER_IS_PARTNER:F(''),P_DOMAIN:F('connect.arvelo.example'),
  P_EMAIL_OPS:F(''),P_EMAIL_LEGAL:F(''),P_EMAIL_FIN:F(''),P_EMAIL_SUPPORT:F(''),P_PHONE:F(''),
  P_BANK_BENEF:F('ARVELO LIMITED'),P_BANK_IBAN:F('GB29NWBK60161331926819'),P_BANK_NAME:F('Demo Bank Ltd'),P_BANK_ADDR:F('2 Demo Square, London, E1 0AA, United Kingdom'),P_BANK_SWIFT:F('DEMOGB21'),P_BANK_INTER_SWIFT:F('DEMOGB2L')};
 // per-country price lists (USD, net) seeded from the current wholesale (LEGAL_SPEC §1)
 S.priceLists={};const seedPL=(cc,d)=>{S.priceLists[cc]=[Object.assign({ver:1,from:daysAgo(d),to:null,currency:ccy(cc),createdAt:daysAgo(d),by:'Platform Admin',note:'',increase:false},plSeed(cc))];};
 seedPL('UA',60);seedPL('KZ',30);seedPL('DE',40);   // DE in EUR (CC_META.DE)
 const tac={inv:'35867310',trk:'86541203',alm:'35299108',gsm:'86221704'};
 const mkImeis=(t,count,start)=>Array.from({length:count},(_,i)=>genImei(t,start+i));
 S.brands=[
  {id:'b1',name:'ARVELO',color:'#1F6FEB',domain:'connect.arvelo.example',createdAt:daysAgo(58),categories:[
   {id:'c1',name:'Гібридні інвертори',models:[
    {id:'m1',name:'ARVELO HX-5',sku:'HX5-48',plan:'std',planStatus:'approved',imei:mkImeis(tac.inv,1200,100000),createdAt:daysAgo(57)},
    {id:'m2',name:'ARVELO HX-8',sku:'HX8-48',plan:'std',planStatus:'approved',imei:mkImeis(tac.inv,400,200000),createdAt:daysAgo(40)}]},
   {id:'c2',name:'GPS-трекери',models:[
    {id:'m3',name:'ARVELO Track T2',sku:'TT2',plan:'light',planStatus:'approved',imei:mkImeis(tac.trk,800,300000),createdAt:daysAgo(50)},
    {id:'m4',name:'ARVELO Track T3 Pro',sku:'TT3P',plan:null,planStatus:'review',imei:[],createdAt:daysAgo(2)}]}]},
  {id:'b2',name:'TEYES',color:'#D92D20',domain:'connect.teyes.ua',createdAt:daysAgo(30),categories:[
   {id:'c3',name:'Охоронні системи',models:[
    {id:'m5',name:'TEYES Guard A4',sku:'GA4',plan:'std',planStatus:'approved',imei:mkImeis(tac.alm,300,400000),createdAt:daysAgo(29)}]}]}];
 // key + token orders and their OTA Tax Invoices (USD)
 const at=d=>new Date(daysAgo(d));
 const placeOrders=(cc,keys,toks,mode,d,paidD)=>{const created=daysAgo(d);const pl=priceList(cc,at(d));const grp=uid('g');const made=[];const ko=keys?{id:uid('ko'),no:orderNo('key'),cc,qty:keys,unit:pl.key,status:'awaiting_payment',invoiceId:null,group:grp,priceVer:pl.ver,createdAt:created}:null;
  const to=toks.length?{id:uid('to'),no:orderNo('token'),cc,lines:toks.map(([p,tm,q])=>({plan:p,term:tm,qty:q,unit:pl.tokens[p][tm]})),status:'awaiting_payment',invoiceId:null,group:grp,priceVer:pl.ver,createdAt:created}:null;
  const kl=ko?[{type:'key',qty:ko.qty,unit:ko.unit}]:[];const tl=to?to.lines.map(l=>({type:'token',plan:l.plan,term:l.term,qty:l.qty,unit:l.unit})):[];
  const groups=mode==='separate'&&ko&&to?[['keys',kl,[ko]],['tokens',tl,[to]]]:[[ko&&to?'combined':ko?'keys':'tokens',kl.concat(tl),[ko,to].filter(Boolean)]];
  groups.forEach(([kind,lines,ords])=>{const inv=mkInvoice({cc,kind,lines,orderIds:ords.map(o=>o.id),created});ords.forEach(o=>{o.invoiceId=inv.id;});made.push(inv);});
  if(ko)S.keyOrders.unshift(ko);if(to)S.tokenOrders.unshift(to);
  if(paidD!=null)made.forEach(inv=>invoicePaid(inv,daysAgo(paidD)));return made;};
 placeOrders('UA',1000,[['std',24,150],['light',24,100],['std',36,50]],'combined',55,54);
 // SIM shipment 1: received into custody
 const sh1=shipCreate({cc:'UA',qty:1000,iccidFrom:1,simType:'Industrial IoT SIM, 2FF/3FF/4FF',unitValue:0.4,dap:S.org.delivery.UA,importer:S.org.delivery.UA.importer,cartons:'2',gross:'7.5',net:'6.0',created:daysAgo(52)});
 shipAdvance(sh1,'shipped',{carrier:'DHL Express',waybill:'4917305528'},daysAgo(48));shipAdvance(sh1,'delivered',{},daysAgo(45));
 shipReceive(sh1,{received:1000,condition:'intact',storage:'Warehouse No. 1, Kyiv',person:'Maria Lind'},daysAgo(44));
 placeOrders('UA',600,[['std',24,100]],'separate',12,11);
 // SIM shipment 2: in transit
 const sh2=shipCreate({cc:'UA',qty:500,iccidFrom:1001,simType:'Industrial IoT SIM, 2FF/3FF/4FF',unitValue:0.4,dap:S.org.delivery.UA,importer:S.org.delivery.UA.importer,cartons:'1',gross:'3.9',net:'3.0',created:daysAgo(3),
  override:{note:'OTA agreed to ship before 70% activation: stock for the heating season (MPA 8.1, “unless OTA agrees otherwise”)',by:'Platform Admin'}});
 shipAdvance(sh2,'shipped',{carrier:'DHL Express',waybill:'4917306691'},daysAgo(1));
 placeOrders('KZ',200,[['light',36,80]],'combined',0,null);
 // points of sale
 S.resellers=[
  {id:'r1',name:'СолярМонтаж Київ',type:'installer',city:'Київ',contact:'+380 67 111 22 33',createdAt:daysAgo(50)},
  {id:'r2',name:'Магазин «Енергія» Львів',type:'shop',city:'Львів',contact:'energy.lviv@example.com',createdAt:daysAgo(45)},
  {id:'r3',name:'Філія Одеса',type:'branch',city:'Одеса',contact:'+380 48 700 00 00',createdAt:daysAgo(40)},
  {id:'r4',name:'АвтоТрек Сервіс',type:'installer',city:'Дніпро',contact:'+380 50 444 55 66',createdAt:daysAgo(20)}];
 // SIM cards of shipment 1: some handed to points of sale; ~360 installed (active), 12 blocked attempts
 const actModels=[['m1',tac.inv,100000,'std'],['m3',tac.trk,300000,'light'],['m5',tac.alm,400000,'std'],['m2',tac.inv,200000,'std']];
 const simRes=i=>i<=300?(i%4===1?'r4':i%3===0?'r3':'r1'):i<=450?'r1':i<=560?'r2':i<=620?'r3':null;
 S.sims.forEach((s,idx)=>{const i=idx+1;s.reseller=simRes(i);
  if(s.reseller)s.events.push([daysAgo(43),'toReseller',(S.resellers.find(r=>r.id===s.reseller)||{}).name||'']);
  if(i<=360){const mm=actModels[i%4];if(mm[0]==='m3')s.reseller='r4';s.status='active';s.modelId=mm[0];s.imei=genImei(mm[1],mm[2]+i);s.lastSeen=iso(new Date(n.getTime()-((i*7)%180)*60000));s.linked=i%3!==0;
   const inst=daysAgo(40-(i%38));s.events.push([inst,'installed']);if(s.linked)s.events.push([inst,'linked']);}
  else if(i<=372){s.status='blocked';s.imei=genImei('35000001',i);s.events.push([daysAgo(i%20),'blocked']);}});
 // activation codes (token codes) are generated for a specific point of sale
 const issue=(res,plan,term,qty,d)=>{for(let i=0;i<qty;i++)S.codes.push({code:genCode(plan,term),plan,term,reseller:res,status:'issued',createdAt:daysAgo(d),activatedAt:null,iccid:null,voidAt:null});};
 issue('r1','std',24,200,48);issue('r3','std',24,150,38);issue('r4','light',24,200,19);issue('r2','std',36,100,28);issue('r1','std',36,40,10);
 // activations: each consumes 1 Service Token of the exact package and 1 Activation Key per device
 const activate=(plan,term,count)=>{let k=0;const sims=S.sims.filter(s=>s.status==='active'&&!s.code);for(const c of S.codes){if(k>=count)break;if(c.plan===plan&&c.term===term&&c.status==='issued'){const sim=sims.find(s=>findModel(s.modelId)&&findModel(s.modelId).model.plan===plan&&!s.code);if(!sim)break;
  c.status='activated';c.activatedAt=daysAgo(40-(k*37/count|0));c.iccid=sim.iccid;sim.code=c.code;sim.plan=plan;sim.term=term;const d=new Date(c.activatedAt);d.setMonth(d.getMonth()+term);sim.paidUntil=iso(d);sim.events.push([c.activatedAt,'package']);
  const lot=consumeToken(pkgKey(plan,term));c.lotId=lot?lot.id:null;const kl=consumeKey('UA');sim.keyLotId=kl?kl.id:null;c.keyLotId=sim.keyLotId;k++;}}};
 activate('std',24,118);activate('light',24,61);activate('std',36,22);
 // Direct Subscriptions: end users paid by card on the portal — these devices activate without a Service Token (the key is still consumed)
 S.sims.filter(s=>s.status==='active'&&!s.code&&findModel(s.modelId)&&findModel(s.modelId).model.planStatus==='approved').slice(0,25).forEach((s,i)=>{const pl=findModel(s.modelId).model.plan;
  const sub=subCreate(s,pl,{at:daysAgo(20-(i%15))});sub.paidUntil=iso(addMonths(daysAgo(20-(i%15)),2));deviceActivate(s,{via:'subscription',sub});});
 // the rule snapshot of shipment 2 as it was when OTA agreed (statuses of shipment 1 are seeded above)
 {const a=S.sims.filter(s=>s.shipmentId===sh1.id&&s.status==='active').length;Object.assign(sh2.rule,{activated:a,pct:a/1000,ok70:a>=700});}
 seedDE(n,daysAgo,placeOrders,tac);
 // deactivate the last 15 unused Standard·3y codes of r2
 let left=15;for(let i=S.codes.length-1;i>=0&&left>0;i--){const c=S.codes[i];if(c.reseller==='r2'&&c.status==='issued'){c.status='void';c.voidAt=daysAgo(5);left--;}}
 S.activity=[];log(t('c.demoLoaded'));audit('demo.seed','ARV',{});
 HOOKS.seedDemo.forEach(f=>{try{f();}catch(e){console.error(e);}});
 bridgeClockEnsure();save();}
/* v12 demo: Germany (DE) — third country. EUR price list (seedPL), a paid key + token order (one batch: 300 Activation Keys + 300 SIMs),
   one SIM shipment from the EU warehouse (200 received in Hamburg), 150 of them activated (75% ≥ 70% → a further shipment of up to 100 is allowed),
   activations by Service Token codes and by Direct Subscriptions (EUR, OTA = merchant of record, German VAT under OSS). Statements for DE are in EUR. */
const DE_OSS_DEMO='EU276900001';   // fictional non-Union OSS number shape (EU + 9 digits)
function seedDE(n,daysAgo,placeOrders,tac){if(!S.org||!orgCountries().includes('DE'))return;
 placeOrders('DE',300,[['std',24,60],['light',12,40]],'combined',38,37);
 const sh=shipCreate({cc:'DE',qty:200,iccidFrom:1501,simType:'Industrial IoT SIM, 2FF/3FF/4FF',unitValue:0.4,dap:S.org.delivery.DE,importer:S.org.delivery.DE.importer,cartons:'1',gross:'1.6',net:'1.2',created:daysAgo(36)});
 if(sh.err)return;shipAdvance(sh,'shipped',{carrier:'DHL Freight',waybill:'4917301144'},daysAgo(35));shipAdvance(sh,'delivered',{},daysAgo(33));
 shipReceive(sh,{received:200,condition:'intact',storage:'Demo Lagerhalle 3, Hamburg',person:'Lena Vogel'},daysAgo(32));
 S.resellers.push({id:'r5',name:'Funk & Technik Hamburg',type:'installer',city:'Hamburg',contact:'+49 40 0000 0000',createdAt:daysAgo(31)});
 const sims=S.sims.filter(s=>s.shipmentId===sh.id);const mods=[['m1',tac.inv,500000,'std'],['m3',tac.trk,600000,'light']];
 sims.forEach((s,i)=>{if(i>=150)return;const mm=mods[i%3===2?1:0];s.status='active';s.modelId=mm[0];s.imei=genImei(mm[1],mm[2]+i);s.reseller='r5';s.linked=i%2===0;
  s.lastSeen=iso(new Date(n.getTime()-((i*11)%240)*60000));const inst=daysAgo(30-(i%28));s.events.push([daysAgo(31),'toReseller','Funk & Technik Hamburg'],[inst,'installed']);});
 // Service Token codes for the German installer; 50 Standard·24 and 30 Light·12 devices activated with them (1 key + 1 token each)
 for(let i=0;i<60;i++)S.codes.push({code:genCode('std',24),plan:'std',term:24,reseller:'r5',status:'issued',createdAt:daysAgo(31),activatedAt:null,iccid:null,voidAt:null});
 for(let i=0;i<40;i++)S.codes.push({code:genCode('light',12),plan:'light',term:12,reseller:'r5',status:'issued',createdAt:daysAgo(31),activatedAt:null,iccid:null,voidAt:null});
 const act=(plan,term,count)=>{let k=0;for(const c of S.codes){if(k>=count)break;if(c.reseller!=='r5'||c.plan!==plan||c.term!==term||c.status!=='issued')continue;
  const s=sims.find(x=>x.status==='active'&&!x.code&&!x.keyLotId&&findModel(x.modelId).model.plan===plan);if(!s)break;const at=daysAgo(29-(k%25));
  const lot=consumeToken(pkgKey(plan,term));const kl=consumeKey('DE');c.status='activated';c.activatedAt=at;c.iccid=s.iccid;c.lotId=lot?lot.id:null;c.keyLotId=kl?kl.id:null;
  s.code=c.code;s.plan=plan;s.term=term;s.keyLotId=c.keyLotId;s.paidUntil=iso(addMonths(at,term));s.events.push([at,'package']);k++;}};
 act('std',24,50);act('light',12,30);
 // Direct Subscriptions in Germany (card payment on the portal, EUR): the key is consumed, no token
 sims.filter(s=>s.status==='active'&&!s.code&&!s.keyLotId).slice(0,40).forEach((s,i)=>{const pl=findModel(s.modelId).model.plan;const at=daysAgo(25-(i%20));
  const sub=subCreate(s,pl,{at});sub.paidUntil=iso(addMonths(at,2));deviceActivate(s,{via:'subscription',sub});});}
I18N.add({uk:{'c.demoLoaded':'Демо-дані завантажено','c.ofTermBlock':'Замовлення (Order Form) для країни {c} розірвано {d}. Нові замовлення для цієї країни недоступні.'},
 en:{'c.demoLoaded':'Demo data loaded','c.ofTermBlock':'The Order Form for {c} was terminated on {d}. New orders for this country are not available.'},
 ru:{'c.demoLoaded':'Демо-данные загружены','c.ofTermBlock':'Заказ (Order Form) по стране {c} расторгнут {d}. Новые заказы по этой стране недоступны.'}});
// AED reference table seed (demo): the AED/USD peg 3.6725 published by the UAE Central Bank, one row per month start
function fxSeed(){const a=fxAed();if(a.length){fxSeedEur();return;}const n=now();for(let k=12;k>=0;k--){const d=new Date(n.getFullYear(),n.getMonth()-k,1);aedRateSet(d.getFullYear()+'-'+pad(d.getMonth()+1)+'-01',AED_DEMO_RATE,'CBUAE (demo)');}fxSeedEur();}
// v12: EUR→AED reference rates for EUR invoices (demo values, fictional but plausible; one per month start, slight drift)
function fxSeedEur(){const a=fxAed();let ch=0;a.forEach((x,i)=>{if(!(+x.eur_aed>0)){x.eur_aed=Math.round((AED_DEMO_RATE_EUR-0.0025*(a.length-1-i))*1e4)/1e4;ch++;}});return ch;}

// boot: fill OTA keys added later (e.g. from LEGAL_DEMO_VALUES) without touching values OTA already edited
HOOKS.onBoot.push(()=>{if(!S.ota)S.ota={};const sd=otaSeed();const full=!S.otaSeeded&&!!legalDemo();let ch=0;
 Object.keys(sd).forEach(k=>{if(!(k in S.ota)||(full&&!S.ota[k]&&sd[k])){S.ota[k]=sd[k];ch++;}});if(legalDemo())S.otaSeeded=true;
 // v10 migration of saved states: no customs code, per-country settings, AED rates, rates frozen into documents, EU ship-from on shipments
 if(!S.ota.countries||typeof S.ota.countries!=='object'){Array.from(new Set(plCountries().concat(S.org?orgCountries():[]))).forEach(cc=>{const dm=otaCountryDemo(cc);otaCountrySet(cc,{vat_local:S.ota['OTA_VAT_'+cc]||dm.vat_local,rep_local:S.ota['OTA_REP_'+cc]||dm.rep_local,ownership_v10_enabled:cc==='UA'});});otaCountries();ch++;}
 Object.keys(S.ota).forEach(k=>{if(otaRemovedKey(k)){delete S.ota[k];ch++;}});
 if(!S.fx||!Array.isArray(S.fx.aed)||!S.fx.aed.length){fxSeed();ch++;}
 if(!S.subs)S.subs=[];if(!S.notices)S.notices=[];
 // v12: 5% VAT is allowed again (UAE partners) — a stored rate is kept; documents without a currency are USD (v10 states); EUR AED rates seeded
 if(fxSeedEur())ch++;
 (S.invoices||[]).forEach(i=>{if(!i.currency){i.currency='USD';ch++;}if(i.aedRate==null){const r=aedRate(i.createdAt,i.currency);i.aedRate=r.rate;i.aedRateDate=r.date;i.aedSrc=r.src;i.vatAed=vatAedOf(i.vat,r.rate);ch++;}if(i.vatAed==null){i.vatAed=vatAedOf(i.vat,i.aedRate);ch++;}});
 (S.creditNotes||[]).forEach(c=>{if(!c.currency){c.currency='USD';ch++;}if(c.aedRate==null){const r=aedRate(c.createdAt,c.currency);c.aedRate=r.rate;c.aedRateDate=r.date;c.aedSrc=r.src;c.vatAed=0;c.vat=0;c.vatRate=0;
  const i=(S.invoices||[]).find(x=>x.id===c.invoiceId);if(!CN_REASONS[c.reason]){c.reasonNote=c.reason||'';c.reason=c.wasPaid?'error':'cancel_unpaid';}if(i){c.invoiceDate=i.createdAt;if(!c.lines)c.lines=i.lines.map(l=>Object.assign({},l,{amount:-Math.abs(l.amount)}));c.total=c.net=i.net;}ch++;}});
 Object.keys(S.priceLists||{}).forEach(cc=>{(S.priceLists[cc]||[]).forEach(v=>{if(!v.currency){v.currency=ccy(cc);ch++;}});});
 if(S.ota.countries)Object.keys(S.ota.countries).forEach(cc=>{const c=S.ota.countries[cc];if(c&&!c.currency){c.currency=ccyDefault(cc);ch++;}});
 (S.shipments||[]).forEach(h=>{if(!h.ship_from){h.ship_from=Object.assign({},SHIP_FROM_DEMO);h.ship_from_country=SHIP_FROM_DEMO.country;h.exporter=Object.assign({},EXPORTER_DEMO);ch++;}});
 bridgeClockEnsure();
 if(ch||full)save();});
