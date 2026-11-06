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
// ICCID: 8938 0012 + 11 digits (demo)
function genIccid(n){return '89380012'+pad(n,11);}
function fmtIccid(s){return s.replace(/(\d{4})(?=\d)/g,'$1 ');}
// order reference (not a legal document number): K-0001 for key orders, T-0001 for token orders
function orderNo(type){return (type==='key'?'K-':'T-')+pad(seqNext(((S.org&&S.org.code)||'PPP')+(type==='key'?':KO':':TO')),4);}
function iccidIndex(s){return parseInt(String(s).slice(8),10);}
// legacy status vocabulary (orders no longer ship SIMs; kept for older code)
const ORDER_FLOW=['awaiting_payment','paid'];
const SHIP_FLOW=['prepared','shipped','delivered','received'];
// extension point for the legal module: return a reason string to block new key/token orders for a country (e.g. unsigned class-A Order Form)
HOOKS.orderBlock=HOOKS.orderBlock||[];
function orderBlock(cc){for(const f of HOOKS.orderBlock){try{const r=f(cc);if(r)return r;}catch(e){console.error(e);}}return null;}
// number of the document in force (signed by both / acknowledged, effective date passed), or null → hidden (N/A rule)
function docRef(type,cc){if(typeof lg_docRef==='function'){try{return lg_docRef(type,cc);}catch(e){}}const ts=iso(now());const d=(S.docs||[]).filter(x=>x.type===type&&(!cc||x.cc===cc)&&(x.status==='signed_both'||x.status==='acknowledged')&&(!x.effective||x.effective<=ts)).sort((a,b)=>String(a.createdAt)<String(b.createdAt)?1:-1)[0];return d?d.number:null;}

/* ---------- OTA Tax Invoices (USD only) ---------- */
const VAT0_EN='VAT 0% – zero-rated export of services (Article 31 of the Executive Regulation of Federal Decree-Law No. 8 of 2017 on VAT)';
const VAT0_L2={ru:'НДС 0% – экспорт услуг (ст. 31 Исполнительного регламента Федерального декрета-закона № 8 от 2017 года об НДС)',uk:'ПДВ 0% – експорт послуг (ст. 31 Виконавчого регламенту Федерального декрету-закону № 8 від 2017 року про ПДВ)'};
// VAT by the partner's country of registration (S.org.country): outside the UAE → 0% zero-rated export; UAE → 5% + warning to OTA Finance
function invVat(country){country=country||(S.org&&S.org.country)||'';
 return country==='AE'?{rate:0.05,label:'VAT 5%',labelL2:{ru:'НДС 5%',uk:'ПДВ 5%'},warn:true}:{rate:0,label:VAT0_EN,labelL2:VAT0_L2,warn:false};}
const LINE_KEY_EN='Activation Keys – copies of the CONNECT computer program (licence activation keys)';
const LINE_KEY_L2={ru:'Ключи активации – экземпляры компьютерной программы CONNECT (лицензионные ключи активации)',uk:'Ключі активації – примірники комп’ютерної програми CONNECT (ліцензійні ключі активації)'};
// line: {type:'key'|'token'|'xchg', cc, plan, term, fromPlan, fromTerm, qty, unit, amount}
function lineDescEn(l){if(l.type==='key')return LINE_KEY_EN;
 if(l.type==='token')return `Service Tokens ${PLAN_EN[l.plan]}, ${l.term} months`;
 if(l.type==='xchg')return `Service Tokens ${PLAN_EN[l.plan]}, ${l.term} months – exchange of ${PLAN_EN[l.fromPlan]}, ${l.fromTerm} months (price difference)`;return l.desc||'';}
function lineDescL2(l,lang){lang=lang||(S.org&&S.org.lang2)||'ru';if(lang==='en')return lineDescEn(l);const ru=lang==='ru';
 if(l.type==='key')return LINE_KEY_L2[lang]||LINE_KEY_L2.ru;
 const tok=(p,tm)=>(ru?'Сервисные токены ':'Сервісні токени ')+PLAN_EN[p]+', '+tm+(ru?' мес.':' міс.');
 if(l.type==='token')return tok(l.plan,l.term);
 if(l.type==='xchg')return tok(l.plan,l.term)+(ru?' – обмен ':' – обмін ')+PLAN_EN[l.fromPlan]+', '+l.fromTerm+(ru?' мес. (разница в цене)':' міс. (різниця в ціні)');return l.desc||'';}
function lineDesc(l){return S.lang==='en'?lineDescEn(l):lineDescL2(l,S.lang);} // UI language
function invNextNo(){return docNo('INV',{peek:true});}
// create and issue an OTA Tax Invoice. o: {cc, lines, kind:'keys'|'tokens'|'combined'|'exchange', orderIds, exchangeId, created, dueDays}
function mkInvoice(o){const created=o.created||iso(now());const v=invVat();const o2=S.org||{};
 const lines=o.lines.map(l=>Object.assign({},l,{cc:l.cc||o.cc,unit:r2(l.unit),amount:r2(l.unit*l.qty)}));
 const net=r2(lines.reduce((a,l)=>a+l.amount,0));const vat=r2(net*v.rate);
 const inv={id:uid('inv'),number:docNo('INV',{date:created}),title:'Tax Invoice',kind:o.kind,cc:o.cc,currency:'USD',lines,net,vatRate:v.rate,vat,total:r2(net+vat),vatLabel:v.label,vatLabelL2:v.labelL2,vatWarn:v.warn,
  buyer:{name:o2.name||'',address:o2.address||'',regNo:o2.regNo||'',taxId:o2.taxId||'',country:o2.country||'',code:o2.code||''},
  seller:Object.assign({},S.ota),mpa:docRef('MPA'),of:docRef('OF',o.cc),priceVer:((o.created?priceList(o.cc,new Date(created)):priceList(o.cc))||{}).ver||null,
  status:'open',createdAt:created,dueAt:iso(addDays(created,o.dueDays||5)),paidAt:null,orderIds:o.orderIds||[],exchangeId:o.exchangeId||null,issued:false,cnId:null};
 S.invoices.unshift(inv);audit('invoice.issue',inv.number,{kind:inv.kind,cc:inv.cc,total:inv.total,vatRate:inv.vatRate});
 if(v.warn){audit('invoice.vat_warning',inv.number,{rate:v.rate});log(t('c.vatWarnLog',{n:inv.number}));}
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
// cancel an issued invoice with a credit note (numbers are never reused; nothing is deleted)
function creditNote(inv,reason){if(!inv||inv.status==='cancelled')return null;if(inv.status==='paid'&&invUsed(inv)>0)return null;
 const cn={id:uid('cn'),number:docNo('CN'),invoiceId:inv.id,invoiceNo:inv.number,currency:'USD',net:inv.net,vat:inv.vat,total:inv.total,vatRate:inv.vatRate,reason:reason||'',wasPaid:inv.status==='paid',createdAt:iso(now()),by:actorName()};
 S.creditNotes=S.creditNotes||[];S.creditNotes.unshift(cn);
 if(inv.status==='paid'){(S.keyLots||[]).forEach(l=>{if(l.invoiceId===inv.id)l.revoked=iso(now());});(S.tokenLots||[]).forEach(l=>{if(l.invoiceId===inv.id)l.revoked=iso(now());});}
 inv.status='cancelled';inv.cancelledAt=cn.createdAt;inv.cnId=cn.id;
 [S.keyOrders,S.tokenOrders].forEach(list=>list.forEach(o=>{if(o.invoiceId===inv.id&&o.status!=='cancelled'){o.status='cancelled';o.cancelledAt=cn.createdAt;}}));
 if(inv.exchangeId){const x=(S.exchanges||[]).find(e=>e.id===inv.exchangeId);if(x&&x.status==='awaiting_payment')exchangeCancel(x);}
 audit('creditnote.issue',cn.number,{invoice:inv.number,total:cn.total,reason:cn.reason});return cn;}

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

/* ---------- SIM shipments in custody (free of charge, DAP; never invoiced) ---------- */
function nextIccidIndex(){let max=0;for(const s of S.sims){const n=iccidIndex(s.iccid);if(n>max)max=n;}for(const h of S.shipments||[])if(h.iccidTo>max)max=h.iccidTo;return max+1;}
// o: {cc, qty, iccidFrom, simType, unitValue, dap:{company,recipient,phone,address,city,country}, importer, cartons, gross, net, created}
function shipCreate(o){const ts=o.created||iso(now());const pf=docNo('PF',{date:ts});
 const h={id:uid('sh'),pf,sr:docNo('SR',{pf}),cc:o.cc,qty:o.qty,iccidFrom:o.iccidFrom,iccidTo:o.iccidFrom+o.qty-1,simType:o.simType||'',hs:'8523.52',unitValue:o.unitValue,
  dap:Object.assign({},o.dap),importer:o.importer||'',cartons:o.cartons||'',gross:o.gross||'',netw:o.net||'',carrier:'',waybill:'',
  status:'prepared',events:[['prepared',ts]],createdAt:ts,by:actorName(),receipt:null};
 S.shipments=S.shipments||[];S.shipments.unshift(h);audit('shipment.create',pf,{qty:h.qty,cc:h.cc,sr:h.sr});return h;}
function shipAdvance(h,status,extra,at){const ts=at||iso(now());Object.assign(h,extra||{});h.status=status;h.events.push([status,ts]);audit('shipment.'+status,h.pf,extra||{});}
// partner confirms receipt & condition (SR) → SIMs enter inventory, in custody until installed
function shipReceive(h,r,at){const ts=at||iso(now());const n=clamp(r.received|0,0,h.qty);
 h.receipt={received:n,diff:h.qty-n,condition:r.condition||'intact',note:r.note||'',storage:r.storage||'',person:r.person||'',customsDecl:r.customsDecl||'',at:ts,by:actorName()};
 for(let i=0;i<n;i++)S.sims.push({iccid:genIccid(h.iccidFrom+i),shipmentId:h.id,status:'stock',imei:null,modelId:null,plan:null,term:null,paidUntil:null,code:null,keyLotId:null,linked:false,lastSeen:null,reseller:null,events:[[ts,'in_stock']]});
 h.status='received';h.events.push(['received',ts]);audit('shipment.received',h.sr,{received:n,diff:h.qty-n,condition:h.receipt.condition});return n;}

/* ---------- demo seed: a fully lived-in partner (GAZER LIMITED, code GZR) ---------- */
function seedDemo(){
 const lang=S.lang;S=freshState();S.lang=lang;
 const n=now();const daysAgo=d=>iso(new Date(n.getTime()-d*864e5));
 S.authed=true;S.user={email:'olena.koval@gazer.example',name:'Olena Koval'};
 S.org={name:'GAZER LIMITED',code:'GZR',codeStatus:'approved',lang2:'ru',country:'GB',countries:['UA','KZ'],regNo:'08778057',taxId:'',
  address:'17 Hanover Square, London, W1S 1BN, United Kingdom',signatory:'Serhii Boiar',title:'Director',opsName:'Andrii Melnyk',
  bank:{benef:'GAZER LIMITED',iban:'GB76REVO00996952368216',bank:'Revolut Ltd',bankAddr:'7 Westferry Circus, London, E14 4HD, United Kingdom',swift:'REVOGB21',interSwift:'CHASGB2L'},
  brand:'GAZER',programme:'GAZER CONNECT',domain:'connect.gazer.com',
  delivery:{UA:{company:'GAZER LIMITED',recipient:'Olena Koval',phone:'',address:'Warehouse No. 1',city:'Kyiv',country:'UA',importer:'GAZER LIMITED'},
   KZ:{company:'GAZER LIMITED',recipient:'Warehouse manager',phone:'',address:'Warehouse No. 2',city:'Almaty',country:'KZ',importer:'GAZER LIMITED'}},
  currency:'USD',prefix:'K02N5',createdAt:daysAgo(60),commit:3000,serials:{},phone:'',color:'#1F6FEB'};
 codeRegister('GZR');
 S.actor='u_p_admin';S.ota=otaSeed();
 // questionnaire values from the Partner Data Form (legal module owns editing & review)
 const F=(v)=>({value:v,status:v?'filled':'empty',comment:'',by:'Olena Koval',at:daysAgo(58)});
 if(legalDemo()&&legalDemo().partner){const P=legalDemo().partner,ST=legalDemo().status||{};S.form={};Object.keys(P).forEach(k=>{S.form[k]={value:P[k],status:ST[k]||(P[k]==null?'empty':'filled'),comment:'',by:'Olena Koval',at:daysAgo(58)};});}else
 S.form={P_NAME:F('GAZER LIMITED'),P_FORM_EN:F('a private limited company incorporated in England and Wales'),P_FORM_L2:F('частная компания с ограниченной ответственностью, учреждённая в Англии и Уэльсе'),
  P_COUNTRY:F('GB'),P_REGNO:F('08778057'),P_TAXNO:F(''),P_ADDR_EN:F('17 Hanover Square, London, W1S 1BN, United Kingdom'),P_ADDR_L2:F(''),
  P_SIGNATORY:F('Serhii Boiar'),P_TITLE_EN:F('Director'),P_TITLE_L2:F('Директор'),P_TITLE_L2_GEN:F('Директора'),P_AUTHORITY:F(''),LANG2:F('ru'),
  P_BRAND:F('GAZER'),P_PROGRAMME:F('GAZER CONNECT'),P_TM_OWNER_IS_PARTNER:F(''),P_DOMAIN:F('connect.gazer.com'),
  P_EMAIL_OPS:F(''),P_EMAIL_LEGAL:F(''),P_EMAIL_FIN:F(''),P_EMAIL_SUPPORT:F(''),P_PHONE:F(''),
  P_BANK_BENEF:F('GAZER LIMITED'),P_BANK_IBAN:F('GB76REVO00996952368216'),P_BANK_NAME:F('Revolut Ltd'),P_BANK_ADDR:F('7 Westferry Circus, London, E14 4HD, United Kingdom'),P_BANK_SWIFT:F('REVOGB21'),P_BANK_INTER_SWIFT:F('CHASGB2L')};
 // per-country price lists (USD, net) seeded from the current wholesale (LEGAL_SPEC §1)
 S.priceLists={};const seedPL=(cc,d)=>{S.priceLists[cc]=[Object.assign({ver:1,from:daysAgo(d),to:null,createdAt:daysAgo(d),by:'Platform Admin',note:'',increase:false},plSeed(cc))];};
 seedPL('UA',60);seedPL('KZ',30);
 const tac={inv:'35867310',trk:'86541203',alm:'35299108',gsm:'86221704'};
 const mkImeis=(t,count,start)=>Array.from({length:count},(_,i)=>genImei(t,start+i));
 S.brands=[
  {id:'b1',name:'GAZER',color:'#1F6FEB',domain:'connect.gazer.com',createdAt:daysAgo(58),categories:[
   {id:'c1',name:'Гібридні інвертори',models:[
    {id:'m1',name:'GAZER HX-5',sku:'HX5-48',plan:'std',planStatus:'approved',imei:mkImeis(tac.inv,1200,100000),createdAt:daysAgo(57)},
    {id:'m2',name:'GAZER HX-8',sku:'HX8-48',plan:'std',planStatus:'approved',imei:mkImeis(tac.inv,400,200000),createdAt:daysAgo(40)}]},
   {id:'c2',name:'GPS-трекери',models:[
    {id:'m3',name:'GAZER Track T2',sku:'TT2',plan:'light',planStatus:'approved',imei:mkImeis(tac.trk,800,300000),createdAt:daysAgo(50)},
    {id:'m4',name:'GAZER Track T3 Pro',sku:'TT3P',plan:null,planStatus:'review',imei:[],createdAt:daysAgo(2)}]}]},
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
 shipReceive(sh1,{received:1000,condition:'intact',storage:'Warehouse No. 1, Kyiv',person:'Olena Koval'},daysAgo(44));
 placeOrders('UA',600,[['std',24,100]],'separate',12,11);
 // SIM shipment 2: in transit
 const sh2=shipCreate({cc:'UA',qty:500,iccidFrom:1001,simType:'Industrial IoT SIM, 2FF/3FF/4FF',unitValue:0.4,dap:S.org.delivery.UA,importer:S.org.delivery.UA.importer,cartons:'1',gross:'3.9',net:'3.0',created:daysAgo(3)});
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
  const lot=consumeToken(pkgKey(plan,term));c.lotId=lot?lot.id:null;const kl=consumeKey();sim.keyLotId=kl?kl.id:null;c.keyLotId=sim.keyLotId;k++;}}};
 activate('std',24,118);activate('light',24,61);activate('std',36,22);
 // deactivate the last 15 unused Standard·3y codes of r2
 let left=15;for(let i=S.codes.length-1;i>=0&&left>0;i--){const c=S.codes[i];if(c.reseller==='r2'&&c.status==='issued'){c.status='void';c.voidAt=daysAgo(5);left--;}}
 S.activity=[];log(t('c.demoLoaded'));audit('demo.seed','GZR',{});
 HOOKS.seedDemo.forEach(f=>{try{f();}catch(e){console.error(e);}});
 save();}
I18N.add({uk:{'c.demoLoaded':'Демо-дані завантажено','c.vatWarnLog':'Рахунок {n}: партнер зареєстрований в ОАЕ — ПДВ 5%, перевірте разом із фінансовою службою OTA'},
 en:{'c.demoLoaded':'Demo data loaded','c.vatWarnLog':'Invoice {n}: partner is registered in the UAE — VAT 5%, check with OTA Finance'},
 ru:{'c.demoLoaded':'Демо-данные загружены','c.vatWarnLog':'Счёт {n}: партнёр зарегистрирован в ОАЭ — НДС 5%, проверьте с финансовой службой OTA'}});

// boot: fill OTA keys added later (e.g. from LEGAL_DEMO_VALUES) without touching values OTA already edited
HOOKS.onBoot.push(()=>{if(!S.ota)S.ota={};const sd=otaSeed();const full=!S.otaSeeded&&!!legalDemo();let ch=0;
 Object.keys(sd).forEach(k=>{if(!(k in S.ota)||(full&&!S.ota[k]&&sd[k])){S.ota[k]=sd[k];ch++;}});if(legalDemo())S.otaSeeded=true;if(ch||full)save();});
