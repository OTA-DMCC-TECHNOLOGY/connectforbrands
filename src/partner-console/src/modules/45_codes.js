/* ===== Activation codes per point of sale, Service Tokens & Activation Keys, exchange, SIM hand-over, Excel export =====
   Codes are generated FOR a point of sale (no anonymous batches) and can be deactivated there.
   Service Tokens come in lots (paid token invoice lines, USD, valid 36 months); an activation uses 1 token of the exact plan+term
   and, for a device activated for the first time, 1 Activation Key. */
const CX_PER=50;
function cx_res(id){return (S.resellers||[]).find(r=>r.id===id)||null;}
function cx_yShort(tm){return PLAN_NAME?(tm/12)+t('cx.yShort'):'';}
function cx_short(k){const [p,tm]=k.split('-');return PLAN_NAME[p]+' '+cx_yShort(+tm);}
function cx_plans(){const p={};allModels().forEach(x=>{if(x.model.planStatus==='approved'&&x.model.plan)p[x.model.plan]=1;});return PLANS.filter(x=>p[x]);}
function cx_stats(){const r={},p={};
 for(const c of S.codes){if(c.batchId)continue;   // 12-character print codes (85_print) have their own statuses and statistics
  const k=c.plan+'-'+c.term;const st=c.status;
  const rr=r[c.reseller]||(r[c.reseller]={issued:0,activated:0,void:0,last:null,pk:{}});rr[st]++;
  const rp=rr.pk[k]||(rr.pk[k]={issued:0,activated:0,void:0});rp[st]++;
  if(st==='activated'&&(!rr.last||c.activatedAt>rr.last))rr.last=c.activatedAt;
  const pp=p[k]||(p[k]={issued:0,activated:0,void:0});pp[st]++;}
 return{r,p};}
function cx_simStats(){const r={};let wh=0;for(const s of S.sims){if(!s.reseller){if(s.status==='stock')wh++;continue;}const x=r[s.reseller]||(r[s.reseller]={total:0,stock:0,active:0,blocked:0});x.total++;x[s.status]++;}return{r,wh};}
function cx_stBadge(st){return st==='activated'?ui.badge(t('cx.st.activated'),'ok',true):st==='void'?ui.badge(t('cx.st.void'),'bad',true):ui.badge(t('cx.st.issued'),'info',true);}
function cx_rtBadge(tp){const tone={installer:'accent',shop:'info',branch:'ok',dealer:'warn'}[tp]||'';return ui.badge(t('cod.rt.'+tp),tone);}
function cx_w(n){return fmtNum(n)+' '+plural(n,{one:t('cod.w.one'),few:t('cod.w.few'),many:t('cod.w.many'),other:t('cod.w.other')});}
function cx_opt(v,l,sel){return `<option value="${esc(v)}" ${String(v)===String(sel)?'selected':''}>${esc(l)}</option>`;}
function cx_cancel(){return ui.btn(t('c.cancel'),{act:'ovclose'});}
function cx_submit(label,form,kind){return `<button class="btn ${kind||'primary'}" type="submit" form="${form}"><span>${label}</span></button>`;}

/* ---------- minimal XLSX writer (no library): stored ZIP + SpreadsheetML ---------- */
const CX_CRC=(()=>{const tb=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;tb[n]=c>>>0;}return tb;})();
function cx_crc(u8){let c=0xFFFFFFFF;for(let i=0;i<u8.length;i++)c=CX_CRC[(c^u8[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0;}
function cx_zip(files){const enc=new TextEncoder();const parts=[];const central=[];let off=0;
 const u16=v=>[v&255,(v>>8)&255],u32=v=>[v&255,(v>>8)&255,(v>>16)&255,(v>>>24)&255];
 for(const [name,str] of files){const nm=enc.encode(name),data=enc.encode(str),crc=cx_crc(data);
  const lh=new Uint8Array([0x50,0x4b,3,4,...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0x21),...u32(crc),...u32(data.length),...u32(data.length),...u16(nm.length),...u16(0)]);
  parts.push(lh,nm,data);
  central.push(new Uint8Array([0x50,0x4b,1,2,...u16(20),...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0x21),...u32(crc),...u32(data.length),...u32(data.length),...u16(nm.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(off)]),nm);
  off+=lh.length+nm.length+data.length;}
 const csize=central.reduce((a,b)=>a+b.length,0);
 const end=new Uint8Array([0x50,0x4b,5,6,...u16(0),...u16(0),...u16(files.length),...u16(files.length),...u32(csize),...u32(off),...u16(0)]);
 return new Blob([...parts,...central,end],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});}
function cx_xml(s){return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'');}
function cx_colName(i){let s='';i++;while(i>0){const m=(i-1)%26;s=String.fromCharCode(65+m)+s;i=Math.floor((i-1)/26);}return s;}
function cx_xlsx(sheets){ // sheets: [{name, rows:[[...]], widths:[..]}] first row = header (bold)
 const wb=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s,i)=>`<sheet name="${cx_xml(s.name.slice(0,31))}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`;
 const wbr=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((s,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
 const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
 const sheetXml=s=>`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${s.widths?`<cols>${s.widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')}</cols>`:''}<sheetData>${s.rows.map((r,ri)=>`<row r="${ri+1}">${r.map((v,ci)=>{const ref=cx_colName(ci)+(ri+1);const st=ri===0?' s="1"':'';return typeof v==='number'&&isFinite(v)?`<c r="${ref}"${st}><v>${v}</v></c>`:`<c r="${ref}" t="inlineStr"${st}><is><t xml:space="preserve">${cx_xml(v)}</t></is></c>`;}).join('')}</row>`).join('')}</sheetData></worksheet>`;
 const files=[['[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((s,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
  ['_rels/.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
  ['xl/workbook.xml',wb],['xl/_rels/workbook.xml.rels',wbr],['xl/styles.xml',styles]].concat(sheets.map((s,i)=>['xl/worksheets/sheet'+(i+1)+'.xml',sheetXml(s)]));
 return cx_zip(files);}
async function cx_saveFile(filename,blob){
 try{if(window.claude&&window.claude.use){const dl=await window.claude.use('downloads');if(dl){await dl.save({filename,data:blob});toast(t('cx.x.saved',{f:esc(filename)}));return;}}}
 catch(e){if(e&&e.code==='declined')return;toast(t('cx.x.fail'),'bad');return;}
 try{const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4000);toast(t('cx.x.saved',{f:esc(filename)}));}catch(e){toast(t('cx.x.fail'),'bad');}}
function cx_codeRows(list){const head=[t('cx.x.code'),t('cx.x.pkg'),t('cx.x.ver'),t('c.status'),t('cx.x.res'),t('cx.x.created'),t('cx.x.activated'),'ICCID',t('cx.x.void')];
 return [head].concat(list.map(c=>{const r=cx_res(c.reseller);return [fmtCode(c.code),PLAN_NAME[c.plan],termLabel(c.term),t('cx.st.'+c.status),r?r.name:'',c.createdAt?fmtDate(c.createdAt):'',c.activatedAt?fmtDate(c.activatedAt):'',c.iccid||'',c.voidAt?fmtDate(c.voidAt):''];}));}
function cx_fileStamp(){const d=now();return d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate());}
function cx_slug(s){return String(s||'').replace(/[«»"'“”]/g,'').replace(/[^\p{L}\p{N}]+/gu,'_').replace(/^_|_$/g,'').slice(0,40)||'export';}

/* ---------- nav ---------- */
for(let i=NAVS.length-1;i>=0;i--)if(NAVS[i].key==='codes'||NAVS[i].key==='resellers')NAVS.splice(i,1);
// section shared with 40_sims_codes (SIM cards): one function → one sidebar header
const whs_sec=()=>t('c.secWarehouse');
nav({key:'codes',label:()=>t('cx.nav'),icon:'key',href:'#codes',order:40,section:whs_sec});
nav({key:'resellers',label:()=>t('cod.rnav'),icon:'store',href:'#resellers',order:41,section:whs_sec});
for(const n of NAVS)if(n.key==='sims'&&!n.section)n.section=whs_sec;

/* ---------- route: Service Tokens, Activation Keys & codes overview ---------- */
function cx_lotBadge(l){if(l.revoked)return ui.badge(t('cx.lot.revoked'),'bad');if(lotExpired(l))return lotFree(l)>0?ui.badge(t('cx.lot.expired'),'bad'):ui.badge(t('cx.lot.done'),'');const left=lotFree(l);
 if(left<=0&&!(l.reserved>0))return ui.badge(t('cx.lot.done'),'');if(l.used)return ui.badge(t('cx.lot.inuse'),'info',true);return ui.badge(t('cx.lot.new'),'ok',true);}
route('codes',{nav:'codes',render(){
 const st=cx_stats();const keys=[];PLANS.forEach(p=>TERMS.forEach(tm=>{const k=pkgKey(p,tm);if(tokenStats(k).bought||st.p[k])keys.push(k);}));
 const demo=S.admin?ui.btn(t('cod.simAct'),{kind:'ghost',icon:'spark',act:'cod_simAct'}):'';
 const actions=demo+ui.btn(t('cx.gen'),{kind:'primary',icon:'plus',act:'cx_gen'});
 // Activation Keys
 const ks=keyStats();const kTone=ks.avail<=0?'bad':ks.avail<Math.max(20,ks.bought*0.1)?'warn':'';
 const keyCard=ui.card({title:t('cx.k.title'),actions:ui.btn(t('cx.k.buy'),{size:'sm',icon:'cart',href:'#order-new'}),body:`<div class="row wrap g16" style="align-items:center"><div class="cx_crv"><span class="num">${fmtNum(ks.avail)}</span><span class="small faint">${t('cx.k.avail')}</span></div>
  <div class="grow" style="min-width:180px">${ui.bar(ks.bought?ks.used/ks.bought:0,kTone)}<div class="row between xs muted" style="margin-top:4px"><span>${t('cx.cr.bought')} <b class="num">${fmtNum(ks.bought)}</b></span><span>${t('cx.k.used')} <b class="num">${fmtNum(ks.used)}</b></span></div></div>
  ${ks.avail<=0?ui.badge(t('cx.cr.empty'),'bad'):kTone==='warn'?ui.badge(t('cx.cr.low'),'warn'):''}</div><p class="xs faint" style="margin-top:10px">${t('cx.k.p')}</p>`});
 // pack v12 (MPA 7.1): the keys bought for a country and the same number of SIM cards are shown as ONE batch
 const batchCard=typeof ord_batchTable==='function'?ui.card({title:t('cx.k.batches'),actions:`<a class="small" href="#shipments">${t('cx.k.toShip')} →</a>`,pad:false,body:ord_batchTable()}):'';
 // Service Tokens
 // v12: tokens are bought per country (in its currency) and used only by devices of that country → stock shown per country
 const byCc=k=>{const ccs=orgCountries().filter(cc=>tokenStats(k,cc).bought);return ccs.length>1||(ccs.length===1&&orgCountries().length>1)?`<div class="xs muted">${ccs.map(cc=>`${esc(cc)} <b class="num">${fmtNum(tokenStats(k,cc).avail)}</b>`).join(' · ')}</div>`:'';};
 const cards=keys.map(k=>{const c=tokenStats(k);const out=(st.p[k]||{}).issued||0;const tone=c.avail<=0?'bad':c.avail<Math.max(10,c.bought*0.1)?'warn':'';
  return `<div class="card cx_cr"><div class="row between g8"><b>${esc(cx_short(k))}</b>${c.bought?(c.avail<=0?ui.badge(t('cx.cr.empty'),'bad'):tone==='warn'?ui.badge(t('cx.cr.low'),'warn'):''):ui.badge(t('cx.cr.none'),'')}</div>
   <div class="cx_crv"><span class="num">${fmtNum(c.avail)}</span><span class="small faint">${t('cx.cr.avail')}</span></div>${ui.bar(c.bought?c.used/c.bought:0,tone)}
   <div class="row between xs muted"><span>${t('cx.cr.bought')} <b class="num">${fmtNum(c.bought)}</b></span><span>${t('cx.cr.used')} <b class="num">${fmtNum(c.used)}</b></span></div>
   ${byCc(k)}${c.reserved?`<div class="xs muted">${t('cx.t.reserved',{n:fmtNum(c.reserved)})}</div>`:''}${c.expired?`<div class="xs cx_warn">${t('cx.t.expired',{n:fmtNum(c.expired)})}</div>`:''}
   ${out>c.avail?`<div class="xs cx_warn">${t('cx.cr.over',{n:fmtNum(out),a:fmtNum(c.avail)})}</div>`:''}</div>`;}).join('');
 const tokActs=ui.btn(t('cx.x.exchange'),{size:'sm',icon:'layers',act:'cx_xchg',disabled:!keys.some(k=>tokensAvail(k)>0)||!can('p.orders')})+ui.btn(t('cx.cr.buy'),{size:'sm',icon:'cart',href:'#order-new'});
 const credits=ui.card({title:t('cx.cr.title'),actions:tokActs,body:keys.length?`<div class="cx_crgrid">${cards}</div><p class="xs faint" style="margin-top:10px">${t('cx.t.valid')}</p>`:ui.empty('layers',t('cx.cr.emptyT'),t('cx.cr.emptyP'),ui.btn(t('cx.cr.buy'),{kind:'primary',href:'#order-new'}))});
 // exchanges
 const xs=S.exchanges||[];
 const xCard=xs.length?ui.card({title:t('cx.xc.title'),pad:false,body:ui.table([{label:t('c.date')},{label:t('cx.xc.from')},{label:t('cx.xc.to')},{label:t('c.qty'),cls:'r'},{label:t('cx.xc.diff'),cls:'r'},{label:t('c.status')}],xs.map(x=>{const inv=x.invoiceId&&invById(x.invoiceId);
  return{cells:[`<span class="ord_nw">${fmtDate(x.createdAt)}</span>`,esc(cx_short(x.from)),esc(cx_short(x.to)),`<span class="num">${fmtNum(x.qty)}</span>`,x.diffUnit>0?`<span class="num ord_nw">${moneyCc(r2(x.diffUnit*x.qty),x.cc)}</span>${inv?`<br><a class="mono xs" href="${link('invoice',inv.id)}">${esc(inv.number)}</a>`:''}`:`<span class="faint small">${t('cx.xc.noRefund')}</span>`,ui.badge(t('cx.xc.st.'+x.status),x.status==='done'?'ok':x.status==='cancelled'?'':'warn',true)]};}))}):'';
 // lots (paid token invoice lines)
 const lots=(S.tokenLots||[]).slice().sort((a,b)=>a.issuedAt<b.issuedAt?1:-1);
 const lotRows=lots.map(l=>{const inv=l.invoiceId&&invById(l.invoiceId);const left=lotFree(l);
  return{cells:[`<span class="ord_nw">${fmtDate(l.issuedAt)}</span>`,inv?`<a class="mono" href="${link('invoice',inv.id)}">${esc(inv.number)}</a>`:`<span class="mono">${esc(l.invoiceNo||'—')}</span>`,`<b>${esc(pkgLabel(l.plan,l.term))}</b>${l.src==='exchange'?' '+ui.badge(t('cx.lot.xchg'),''):''}`,
   `<span class="num">${fmtNum(l.qty)}</span>`,`<span class="num">${fmtNum(l.used)}</span>`,`<span class="num">${left>0?fmtNum(left):'<span class="faint">0</span>'}</span>`,
   `<span class="num ord_nw">${moneyCc(l.unit,l.cc)}</span>`,`<span class="ord_nw ${lotExpired(l)?'':'muted'} small">${fmtDate(l.expiresAt)}</span>`,cx_lotBadge(l)]};});
 const lotsCard=ui.card({title:t('cx.lot.title'),pad:false,body:`<p class="small muted cx_pad">${t('cx.lot.p')}</p>`+ui.table([{label:t('cx.lot.issued')},{label:t('cx.lot.inv')},{label:t('cx.x.pkg')},{label:t('cx.lot.qty'),cls:'r'},{label:t('cx.cr.used'),cls:'r'},{label:t('cx.lot.left'),cls:'r'},{label:t('cx.lot.price'),cls:'r'},{label:t('cx.lot.exp')},{label:t('c.status')}],lotRows,{empty:`<div class="cx_pad muted small">${t('cx.lot.empty')}</div>`})});
 // by point of sale
 const rs=S.resellers||[];
 const resRows=rs.map(r=>{const x=st.r[r.id]||{issued:0,activated:0,void:0,pk:{}};const chips=Object.keys(x.pk).filter(k=>x.pk[k].issued).map(k=>`<span class="cx_chip">${esc(cx_short(k))} <b class="num">${fmtNum(x.pk[k].issued)}</b></span>`).join('');
  return{href:link('reseller',r.id),cells:[`<a href="${link('reseller',r.id)}"><b>${esc(r.name)}</b></a><br>${cx_rtBadge(r.type)}`,chips||'<span class="faint small">—</span>',`<span class="num">${fmtNum(x.activated)}</span>`,`<span class="num">${x.void?fmtNum(x.void):'<span class="faint">0</span>'}</span>`]};});
 const resCard=ui.card({title:t('cx.byRes'),actions:ui.btn(t('cod.rnav'),{size:'sm',href:'#resellers'}),pad:false,body:rs.length?ui.table([{label:t('cx.x.res')},{label:t('cx.avail')},{label:t('cx.st.activatedPl'),cls:'r'},{label:t('cx.st.voidPl'),cls:'r'}],resRows):`<div class="cx_pad">${ui.empty('store',t('cod.r.emptyT'),t('cod.r.emptyP'),ui.btn(t('cod.r.new'),{kind:'primary',act:'cod_resNew'}))}</div>`});
 const explain=ui.note('info',t('cx.explain'));
 const pfx=S.org?S.org.prefix:'';const prof=ui.card({title:t('cx.pf.title'),body:`<div class="row wrap g16" style="align-items:flex-start"><div class="col g4" style="min-width:200px"><span class="small muted">${t('cx.pf.prefix')}</span><span class="row g8"><b class="mono" style="font-size:22px">${esc(pfx)}</b>${ui.iconbtn('copy',t('ord.doc.copy'),{act:'copy',arg:pfx})}</span><span class="xs faint">${t('cx.pf.p')}</span></div>
  <div class="grow">${ui.table([{label:t('cx.pf.digit')},{label:t('cx.x.pkg')}],Object.keys(PKG_DIGIT).sort((a,b)=>B32.indexOf(PKG_DIGIT[a])-B32.indexOf(PKG_DIGIT[b])).map(k=>{const [p,tm]=k.split('-');return{cells:[`<b class="mono">${PKG_DIGIT[k]}</b>`,esc(pkgLabel(p,+tm))]};}))}</div></div>`});
 return ui.page({title:t('cx.title'),sub:t('cx.sub'),actions,body:`<div class="stack">${explain}<div class="grid2" style="align-items:start">${keyCard}${ui.card({title:t('cx.how.title'),body:`<ol class="small muted cx_how"><li>${t('cx.how.1')}</li><li>${t('cx.how.2')}</li><li>${t('cx.how.3')}</li></ol>`})}</div>${batchCard}${credits}${xCard}${resCard}${lotsCard}${prof}</div>`});}});

/* ---------- Service Token exchange ---------- */
function cx_xchgModal(){const from=PLANS.flatMap(p=>TERMS.map(tm=>pkgKey(p,tm))).filter(k=>tokensAvail(k)>0);if(!from.length)return;
 const all=PLANS.flatMap(p=>TERMS.map(tm=>pkgKey(p,tm)));const f0=from[0];const to0=all.find(k=>k!==f0);const ccs=orgCountries();
 modal(t('cx.xc.modalT'),`<form id="cx_xcF" data-form="cx_xchg" class="stack" novalidate><p class="small muted">${t('cx.xc.p')}</p>
  <div class="grid2">${ui.field({id:'xc_from',label:t('cx.xc.from'),type:'select',value:f0,options:from.map(k=>[k,cx_short(k)+' · '+t('cx.xc.have',{n:fmtNum(tokensAvail(k))})]),attrs:'data-act="cx_xcQuote"'})}${ui.field({id:'xc_to',label:t('cx.xc.to'),type:'select',value:to0,options:all.map(k=>[k,cx_short(k)]),attrs:'data-act="cx_xcQuote"'})}</div>
  <div class="grid2">${ui.field({id:'xc_qty',label:t('c.qty'),type:'number',value:'10',attrs:'min="1" step="1" inputmode="numeric" data-act="cx_xcQuote"'})}${ccs.length>1?ui.field({id:'xc_cc',label:t('cx.xc.cc'),type:'select',value:ccs[0],options:ccs.map(c=>[c,ctyName(c)]),attrs:'data-act="cx_xcQuote"'}):`<input type="hidden" name="xc_cc" id="xc_cc" value="${ccs[0]}">`}</div>
  <div id="cx_xcQ" aria-live="polite">${cx_xcQuoteHtml(f0,to0,10,ccs[0])}</div></form>`,cx_cancel()+cx_submit(t('cx.xc.do'),'cx_xcF'));}
function cx_xcQuoteHtml(from,to,qty,cc){if(from===to)return ui.note('warn',t('cx.xc.same'));const d=exchangeQuote(from,to,cc);
 if(d>0.004)return ui.note('info',t('cx.xc.pay',{u:moneyCc(d,cc),n:fmtNum(qty||0),tot:moneyCc(r2(d*(qty||0)),cc)}));return ui.note('warn',t('cx.xc.cheaper',{u:moneyCc(-d,cc)}));}
function cx_xcRead(){const g=id=>{const e=$('#'+id);return e?e.value:'';};return{from:g('xc_from'),to:g('xc_to'),qty:Number(g('xc_qty')),cc:g('xc_cc')||orgCountries()[0]};}   // v12: tokens are exchanged within one country (its currency)
FORM.cx_xchg=f=>{clearErrs(f);if(!can('p.orders'))return;const d=cx_xcRead();
 if(d.from===d.to){setErr(f,'xc_to',t('cx.xc.same'));return;}if(!Number.isInteger(d.qty)||d.qty<1||d.qty>tokensAvail(d.from,d.cc)){setErr(f,'xc_qty',t('cx.xc.qtyErr',{n:fmtNum(tokensAvail(d.from,d.cc))}));return;}
 const r=exchangeCreate(d.from,d.to,d.qty,d.cc);if(r.err){toast(t('cx.xc.fail'),'bad');return;}const x=r.x;
 if(x.invoiceId){const inv=invById(x.invoiceId);const msg=t('cx.xc.invoiced',{i:inv.number});log(msg);closeOverlay();toast(msg);go('invoice',inv.id);}
 else{const msg=t('cx.xc.doneMsg',{n:fmtNum(x.qty),a:cx_short(x.from),b:cx_short(x.to)});log(msg);closeOverlay();toast(msg);rerender();}};
Object.assign(ACT,{cx_xchg(){if(can('p.orders'))cx_xchgModal();},cx_xcQuote(){const d=cx_xcRead();const b=$('#cx_xcQ');if(b)b.innerHTML=cx_xcQuoteHtml(d.from,d.to,d.qty,d.cc);}});

/* ---------- generate codes for a point of sale ---------- */
let cx_last=null;
function cx_genModal(resId,pkg){const plans=cx_plans();
 if(!plans.length){modal(t('cx.g.title'),ui.note('warn',t('cx.g.noModels')),ui.btn(t('cod.g.toCatalog'),{href:'#catalog'})+cx_cancel());return;}
 const rs=S.resellers||[];const [pp,pt]=pkg?pkg.split('-'):[plans[0],'24'];
 const resOpts=(rs.length?'':cx_opt('','—',''))+rs.map(r=>cx_opt(r.id,r.name,resId)).join('')+cx_opt('__new',t('cx.g.newRes'),rs.length?'':'__new');
 modal(t('cx.g.title'),`<form id="cx_genF" data-form="cx_gen" class="stack" novalidate>
  <p class="small muted">${t('cx.g.p')}</p>
  <div class="field"><label for="cx_gr">${t('cx.x.res')}</label><select class="inp" id="cx_gr" name="cx_gr" data-act="cx_genRes">${resOpts}</select></div>
  <div class="stack cx_newres" id="cx_newRes" ${rs.length?'hidden':''}><div class="grid2">${ui.field({id:'cx_nn',label:t('cod.r.name'),placeholder:t('cod.r.namePh'),attrs:'maxlength="80"'})}${ui.field({id:'cx_nt',label:t('cod.r.type'),type:'select',value:'installer',options:['installer','shop','branch','dealer'].map(x=>[x,t('cod.rt.'+x)])})}</div>${ui.field({id:'cx_nc',label:t('cod.r.city'),attrs:'maxlength="60"'})}</div>
  <div class="grid2">${ui.field({id:'cx_gp',label:t('cx.x.pkg'),type:'select',value:pp,options:plans.map(p=>[p,PLAN_NAME[p]])})}${ui.field({id:'cx_gt',label:t('cx.x.ver'),type:'select',value:pt,options:TERMS.map(tm=>[tm,termLabel(tm)])})}</div>
  ${ui.field({id:'cx_gq',label:t('cx.g.qty'),type:'number',value:'100',attrs:'min="1" max="10000" step="1" inputmode="numeric"',hint:t('cx.g.qtyHint')})}
 </form>`,cx_cancel()+cx_submit(t('cx.g.do'),'cx_genF'));}
FORM.cx_gen=f=>{clearErrs(f);const d=formData(f);let resId=d.cx_gr;const q=Number(d.cx_gq);const plan=d.cx_gp,term=+d.cx_gt;
 if(resId==='__new'||!resId){const nm=String(d.cx_nn||'').trim();if(!nm){setErr(f,'cx_nn',t('cod.r.nameErr'));return;}
  if((S.resellers||[]).some(r=>r.name.toLowerCase()===nm.toLowerCase())){setErr(f,'cx_nn',t('cod.r.dup'));return;}}
 if(cx_plans().indexOf(plan)<0){setErr(f,'cx_gp',t('c.required'));return;}
 if(!Number.isInteger(q)||q<1||q>10000){setErr(f,'cx_gq',t('cod.g.qtyErr'));return;}
 if(resId==='__new'||!resId){const r={id:uid('r'),name:String(d.cx_nn).trim().slice(0,80),type:d.cx_nt||'installer',city:String(d.cx_nc||'').trim().slice(0,60),contact:'',createdAt:iso(now())};S.resellers=S.resellers||[];S.resellers.push(r);log(t('cod.r.logNew',{n:r.name}));resId=r.id;}
 const r=cx_res(resId);const ts=iso(now());const got=[];
 for(let i=0;i<q;i++){const c={code:genCode(plan,term),plan,term,reseller:resId,status:'issued',createdAt:ts,activatedAt:null,iccid:null,voidAt:null};S.codes.push(c);got.push(c);}
 cx_last={codes:got,res:r};log(t('cx.g.log',{w:cx_w(q),p:pkgLabel(plan,term),r:r.name}));
 const avail=tokensAvail(pkgKey(plan,term));const issued=cx_stats().p[pkgKey(plan,term)].issued;
 modal(t('cx.g.doneT',{w:cx_w(q)}),`<p class="small">${t('cx.g.doneP',{p:'<b>'+esc(pkgLabel(plan,term))+'</b>',r:'<b>'+esc(r.name)+'</b>'})}</p>
  ${issued>avail?ui.note('warn',t('cx.g.creditWarn',{a:fmtNum(Math.max(0,avail)),n:fmtNum(issued)})+` <a href="#order-new">${t('cx.cr.buy')} →</a>`):''}
  <textarea class="inp mono" id="cx_list" rows="8" readonly>${got.map(c=>fmtCode(c.code)).join('\n')}</textarea>`,
  ui.btn(t('cx.copyList'),{icon:'copy',act:'cx_copyLast'})+ui.btn(t('cx.x.btn'),{icon:'download',act:'cx_xlsLast'})+ui.btn(t('c.close'),{kind:'primary',act:'cx_closeGen'}));};

/* ---------- route: points of sale ---------- */
function cx_rf(){if(!S.ui.cx_rf)S.ui.cx_rf={q:'',type:''};return S.ui.cx_rf;}
route('resellers',{nav:'resellers',render(){const rs=S.resellers||[];const st=cx_stats();const ss=cx_simStats();const f=cx_rf();
 const actions=ui.btn(t('cod.r.new'),{kind:'primary',icon:'plus',act:'cod_resNew'});
 if(!rs.length)return ui.page({title:t('cod.r.title'),sub:t('cx.r.sub'),actions,body:ui.card({body:ui.empty('store',t('cod.r.emptyT'),t('cod.r.emptyP'),ui.btn(t('cod.r.new'),{kind:'primary',act:'cod_resNew'}))})});
 let ti=0,ta=0,tsim=0;rs.forEach(r=>{const x=st.r[r.id];if(x){ti+=x.issued;ta+=x.activated;}const y=ss.r[r.id];if(y)tsim+=y.stock;});
 const kpis=`<div class="grid4">${ui.kpi(t('cx.r.k.count'),fmtNum(rs.length))}${ui.kpi(t('cx.avail'),fmtNum(ti),t('cx.r.k.availS'))}${ui.kpi(t('cx.st.activatedPl'),fmtNum(ta))}${ui.kpi(t('cx.r.k.sims'),fmtNum(tsim),t('cx.r.k.simsS'))}</div>`;
 const q=f.q.trim().toLowerCase();const types=['installer','shop','branch','dealer'];
 const cnt={};rs.forEach(r=>{cnt[r.type]=(cnt[r.type]||0)+1;});
 const list=rs.filter(r=>(!f.type||r.type===f.type)&&(!q||r.name.toLowerCase().includes(q)||(r.city||'').toLowerCase().includes(q)));
 const tb=`<div class="toolbar"><label class="sim_search">${icon('search','sm')}<input class="inp" type="search" id="cx_rq" placeholder="${esc(t('cx.r.search'))}" value="${esc(f.q)}" aria-label="${esc(t('cx.r.search'))}"></label>
  ${ui.seg('cx_rt',[['',t('c.all')+' '+rs.length]].concat(types.filter(x=>cnt[x]).map(x=>[x,t('cod.rt.'+x)+' '+cnt[x]])),f.type,'cx_rType')}</div>`;
 const cols=[{label:t('cod.r.name')},{label:t('cod.r.city')},{label:t('cx.avail')},{label:t('cx.st.activatedPl'),cls:'r'},{label:t('cx.r.simCol'),cls:'r'},{label:t('cod.r.rate')},{label:t('cod.r.last')}];
 const rows=list.slice().sort((a,b)=>((st.r[b.id]||{}).activated||0)-((st.r[a.id]||{}).activated||0)).map(r=>{const x=st.r[r.id]||{issued:0,activated:0,void:0,pk:{},last:null};const y=ss.r[r.id]||{total:0,stock:0,active:0};const given=x.issued+x.activated;const rate=given?x.activated/given:0;
  const chips=Object.keys(x.pk).filter(k=>x.pk[k].issued).map(k=>`<span class="cx_chip">${esc(cx_short(k))} <b class="num">${fmtNum(x.pk[k].issued)}</b></span>`).join('');
  return{href:link('reseller',r.id),cells:[`<a href="${link('reseller',r.id)}"><b>${esc(r.name)}</b></a><br>${cx_rtBadge(r.type)}`,esc(r.city||'—'),chips||'<span class="faint small">—</span>',`<span class="num">${fmtNum(x.activated)}</span>`,
   y.total?`<span class="num">${fmtNum(y.stock)}</span><br><span class="xs faint">${t('cx.r.simOf',{a:fmtNum(y.active)})}</span>`:'<span class="faint">—</span>',
   given?`<div class="row g8" style="min-width:110px"><div class="grow">${ui.bar(rate)}</div><span class="small num">${pct(rate)}</span></div>`:'<span class="faint">—</span>',
   x.last?`<span class="small" style="white-space:nowrap">${fmtDate(x.last)}</span>`:'<span class="faint">—</span>']};});
 return ui.page({title:t('cod.r.title'),sub:t('cx.r.sub'),actions,body:`<div class="stack">${kpis}<section class="card">${tb}${ui.table(cols,rows,{empty:ui.empty('filter',t('c.nothing'),'')})}</section></div>`});}});
document.addEventListener('input',e=>{if(e.target&&e.target.id==='cx_rq'){cx_rf().q=e.target.value;const pos=e.target.selectionStart;rerender();const el=$('#cx_rq');if(el){el.focus();try{el.setSelectionRange(pos,pos);}catch(x){}}}
 if(e.target&&e.target.id==='cx_cq'){cx_cf().q=e.target.value;S.ui.cx_cp=1;const pos=e.target.selectionStart;rerender();const el=$('#cx_cq');if(el){el.focus();try{el.setSelectionRange(pos,pos);}catch(x){}}}});

/* ---------- route: one point of sale ---------- */
function cx_cf(){if(!S.ui.cx_cf)S.ui.cx_cf={plan:'',term:'',st:'',q:''};return S.ui.cx_cf;}
function cx_resCodes(id,f){const q=String(f.q||'').toUpperCase().replace(/[^0-9A-Z]/g,'');const out=[];
 for(const c of S.codes){if(c.reseller!==id||c.batchId)continue;if(f.plan&&c.plan!==f.plan)continue;if(f.term&&c.term!==+f.term)continue;if(f.st&&c.status!==f.st)continue;if(q&&c.code.indexOf(q)<0&&!(c.iccid&&c.iccid.indexOf(q)>=0))continue;out.push(c);}
 return out;}
route('reseller',{nav:'resellers',render(id){const r=cx_res(id);
 if(!r)return ui.page({title:t('cod.r.notFound'),crumbs:[[t('cod.r.title'),'#resellers'],['—']],body:ui.card({body:ui.empty('store',t('cod.r.notFound'),'',ui.btn(t('cod.r.title'),{href:'#resellers'}))})});
 if(S.ui.cx_cfRes!==id){S.ui.cx_cf={plan:'',term:'',st:'',q:''};S.ui.cx_cp=1;S.ui.cx_cfRes=id;}
 const st=cx_stats();const x=st.r[r.id]||{issued:0,activated:0,void:0,pk:{},last:null};const y=cx_simStats().r[r.id]||{total:0,stock:0,active:0,blocked:0};
 const kpis=`<div class="grid4">${ui.kpi(t('cx.avail'),fmtNum(x.issued),t('cx.r.k.availS'))}${ui.kpi(t('cx.st.activatedPl'),fmtNum(x.activated),x.last?t('cod.r.lastAt',{d:fmtDate(x.last)}):'')}${ui.kpi(t('cx.r.k.sims'),fmtNum(y.stock),t('cx.r.simsGiven',{n:fmtNum(y.total)}))}${ui.kpi(t('cx.r.k.inst'),fmtNum(y.active),y.blocked?t('cx.r.blocked',{n:fmtNum(y.blocked)}):'')}</div>`;
 // per package & version
 const pk=Object.keys(x.pk).sort();
 const pkRows=pk.map(k=>{const v=x.pk[k];const [p,tm]=k.split('-');return{cells:[`<b>${PLAN_NAME[p]}</b>`,termLabel(+tm),`<span class="num">${fmtNum(v.issued)}</span>`,`<span class="num">${fmtNum(v.activated)}</span>`,`<span class="num">${v.void?fmtNum(v.void):'<span class="faint">0</span>'}</span>`,
  `<span class="row g4" style="justify-content:flex-end;flex-wrap:nowrap">${ui.btn(t('cx.more'),{size:'sm',icon:'plus',act:'cx_genFor',arg:r.id+'|'+k})}${v.issued?ui.btn(t('cx.void'),{size:'sm',kind:'ghost',act:'cx_voidPkg',arg:r.id+'|'+k}):''}</span>`]};});
 const pkCard=ui.card({title:t('cx.r.byPkg'),pad:false,body:ui.table([{label:t('cx.x.pkg')},{label:t('cx.x.ver')},{label:t('cx.avail'),cls:'r'},{label:t('cx.st.activatedPl'),cls:'r'},{label:t('cx.st.voidPl'),cls:'r'},{label:'',cls:'r'}],pkRows,{empty:`<div class="cx_pad">${ui.empty('key',t('cod.r.noCodesT'),t('cx.r.noCodesP'),ui.btn(t('cx.gen'),{kind:'primary',act:'cx_genFor',arg:r.id}))}</div>`})});
 // SIM cards
 const simCard=ui.card({title:t('cx.s.title'),actions:`${y.stock?ui.btn(t('cx.s.back'),{size:'sm',kind:'ghost',act:'cx_simBack',arg:r.id}):''}${ui.btn(t('cx.s.give'),{size:'sm',icon:'send',act:'cx_simGive',arg:r.id})}`,
  body:y.total?`<dl class="dl cx_dl"><dt>${t('cx.s.given')}</dt><dd class="num">${fmtNum(y.total)}</dd><dt>${t('cx.s.atPoint')}</dt><dd class="num">${fmtNum(y.stock)}</dd><dt>${t('cx.s.inst')}</dt><dd class="num">${fmtNum(y.active)}</dd>${y.blocked?`<dt>${t('cx.s.blocked')}</dt><dd class="num">${fmtNum(y.blocked)}</dd>`:''}</dl><p class="small" style="margin-top:8px"><a href="#sims" data-act="cx_simsOf" data-arg="${esc(r.id)}">${t('cx.s.list')} →</a></p>`:`<p class="muted small">${t('cx.s.none')}</p>`});
 // codes list
 const f=cx_cf();const list=cx_resCodes(r.id,f);const pages=Math.max(1,Math.ceil(list.length/CX_PER));const pg=clamp(+S.ui.cx_cp||1,1,pages);S.ui.cx_cp=pg;
 const plansHere=PLANS.filter(p=>pk.some(k=>k.startsWith(p+'-')));
 const tb=`<div class="toolbar"><label class="sim_search">${icon('search','sm')}<input class="inp" type="search" id="cx_cq" placeholder="${esc(t('cx.c.search'))}" value="${esc(f.q)}" aria-label="${esc(t('cx.c.search'))}"></label>
  <select class="inp sim_sel" data-act="cx_cPlan" aria-label="${esc(t('cx.x.pkg'))}">${cx_opt('',t('cx.c.allPkg'),f.plan)+plansHere.map(p=>cx_opt(p,PLAN_NAME[p],f.plan)).join('')}</select>
  <select class="inp sim_sel" data-act="cx_cTerm" aria-label="${esc(t('cx.x.ver'))}">${cx_opt('',t('cx.c.allVer'),f.term)+TERMS.map(tm=>cx_opt(tm,termLabel(tm),f.term)).join('')}</select>
  <select class="inp sim_sel" data-act="cx_cSt" aria-label="${esc(t('c.status'))}">${cx_opt('',t('cx.c.allSt'),f.st)+['issued','activated','void'].map(s=>cx_opt(s,t('cx.st.'+s),f.st)).join('')}</select>
  <span class="grow"></span>${ui.btn(t('cx.x.btnN',{n:fmtNum(list.length)}),{size:'sm',icon:'download',act:'cx_xlsRes',arg:r.id,disabled:!list.length})}</div>`;
 const rows=list.slice((pg-1)*CX_PER,pg*CX_PER).map(c=>({cells:[`<span class="mono" style="white-space:nowrap">${fmtCode(c.code)}</span> ${ui.iconbtn('copy',t('ord.doc.copy'),{act:'copy',arg:fmtCode(c.code)})}`,esc(pkgLabel(c.plan,c.term)),cx_stBadge(c.status),
  c.status==='activated'?`<span class="small">${fmtDate(c.activatedAt)}</span><br><a class="xs mono" href="#sims" data-act="sim_open" data-arg="${esc(c.iccid)}">···${esc((c.iccid||'').slice(-6))}</a>`:c.status==='void'?`<span class="small faint">${fmtDate(c.voidAt)}</span>`:`<span class="small faint">${t('cx.c.since',{d:fmtDate(c.createdAt)})}</span>`,
  c.status==='issued'?ui.iconbtn('x',t('cx.voidOne'),{act:'cx_voidOne',arg:c.code}):'']}));
 const codesCard=`<section class="card" id="cx_clist"><div class="hd"><h2>${t('cod.r.codes')}</h2></div>${tb}${ui.table([{label:t('cx.x.code')},{label:t('cx.x.pkg')},{label:t('c.status')},{label:t('c.date')},{label:''}],rows,{empty:`<div class="cx_pad muted small">${t('c.nothing')}</div>`})}${list.length>CX_PER?ui.pager(pg,list.length,CX_PER,'cx_cPage'):''}</section>`;
 const danger=`<section class="card cx_danger"><div class="bd row between wrap g12"><div><b>${t('cx.r.dangerT')}</b><div class="small muted">${t('cx.r.dangerP')}</div></div><span class="row g8">${ui.btn(t('c.edit'),{icon:'edit',act:'cod_resEdit',arg:r.id})}${ui.btn(t('c.delete'),{kind:'danger',icon:'trash',act:'cx_resDel',arg:r.id})}</span></div></section>`;
 const sub=`<span class="row wrap g8">${cx_rtBadge(r.type)}${r.city?'<span>'+esc(r.city)+'</span>':''}${r.contact?'<span class="faint">·</span><span>'+esc(r.contact)+'</span>':''}</span>`;
 const actions=ui.btn(t('cx.s.give'),{icon:'send',act:'cx_simGive',arg:r.id})+ui.btn(t('cx.gen'),{kind:'primary',icon:'plus',act:'cx_genFor',arg:r.id});
 return ui.page({title:esc(r.name),sub,crumbs:[[t('cod.r.title'),'#resellers'],[r.name]],actions,body:`<div class="stack">${kpis}<div class="cx_two">${pkCard}${simCard}</div>${codesCard}${danger}</div>`});}});

/* ---------- reseller CRUD (modal from 40 i18n) ---------- */
function cx_resModal(r){const e=!!r;r=r||{name:'',type:'installer',city:'',contact:''};
 modal(e?t('cod.r.editT'):t('cod.r.new'),`<form id="cx_resF" data-form="cx_res" class="stack" novalidate><input type="hidden" name="id" value="${e?esc(r.id):''}">
  ${ui.field({id:'cx_rn',label:t('cod.r.name'),value:r.name,placeholder:t('cod.r.namePh'),attrs:'maxlength="80" required'})}
  <div class="grid2">${ui.field({id:'cx_rt2',label:t('cod.r.type'),type:'select',value:r.type,options:['installer','shop','branch','dealer'].map(x=>[x,t('cod.rt.'+x)])})}${ui.field({id:'cx_rc',label:t('cod.r.city'),value:r.city,attrs:'maxlength="60"'})}</div>
  ${ui.field({id:'cx_rk',label:t('cod.r.contact')+' <span class="faint" style="font-weight:400">('+t('c.optional')+')</span>',value:r.contact,placeholder:t('cod.r.contactPh'),attrs:'maxlength="120"'})}</form>`,
  cx_cancel()+cx_submit(e?t('c.save'):t('c.create'),'cx_resF'));}
FORM.cx_res=f=>{clearErrs(f);const d=formData(f);const name=String(d.cx_rn||'').trim();if(!name){setErr(f,'cx_rn',t('cod.r.nameErr'));return;}
 S.resellers=S.resellers||[];if(S.resellers.find(x=>x.name.toLowerCase()===name.toLowerCase()&&x.id!==d.id)){setErr(f,'cx_rn',t('cod.r.dup'));return;}
 const v={name,type:d.cx_rt2,city:String(d.cx_rc||'').trim(),contact:String(d.cx_rk||'').trim()};
 if(d.id){const r=cx_res(d.id);if(!r)return;Object.assign(r,v);closeOverlay();toast(t('cod.r.saved',{n:esc(name)}));rerender();}
 else{const r=Object.assign({id:uid('r'),createdAt:iso(now())},v);S.resellers.push(r);log(t('cod.r.logNew',{n:name}));closeOverlay();toast(t('cod.r.created',{n:esc(name)}));go('reseller',r.id);}};

/* ---------- SIM hand-over ---------- */
function cx_whStock(){return S.sims.filter(s=>s.status==='stock'&&!s.reseller).sort((a,b)=>a.iccid<b.iccid?-1:1);}
function cx_simGiveModal(resId){const r=cx_res(resId);const st=cx_whStock();
 if(!st.length){modal(t('cx.s.give'),ui.note('warn',t('cx.s.noStock')),ui.btn(t('sim.orderMore'),{kind:'primary',href:'#order-new'})+cx_cancel());return;}
 modal(t('cx.s.giveT',{r:esc(r.name)}),`<form id="cx_sgF" data-form="cx_simGive" class="stack" novalidate><input type="hidden" name="id" value="${esc(resId)}">
  <p class="small muted">${t('cx.s.giveP',{n:fmtNum(st.length)})}</p>
  ${ui.field({id:'cx_sq',label:t('cx.s.qty'),type:'number',value:String(Math.min(50,st.length)),attrs:`min="1" max="${st.length}" step="1" inputmode="numeric"`,hint:t('cx.s.qtyHint',{a:fmtIccid(st[0].iccid)})})}</form>`,cx_cancel()+cx_submit(t('cx.s.giveDo'),'cx_sgF'));}
FORM.cx_simGive=f=>{clearErrs(f);const d=formData(f);const r=cx_res(d.id);if(!r)return;const st=cx_whStock();const q=Number(d.cx_sq);
 if(!Number.isInteger(q)||q<1||q>st.length){setErr(f,'cx_sq',t('cx.s.qtyErr',{n:fmtNum(st.length)}));return;}
 const ts=iso(now());const part=st.slice(0,q);part.forEach(s=>{s.reseller=r.id;s.events.push([ts,'toReseller',r.name]);});
 const msg=t('cx.s.gaveLog',{n:fmtNum(q),r:r.name,a:fmtIccid(part[0].iccid),b:fmtIccid(part[part.length-1].iccid)});log(msg);closeOverlay();toast(msg);rerender();};

/* ---------- actions ---------- */
Object.assign(ACT,{
 cx_gen(){cx_genModal('');},
 cx_genFor(arg){const [rid,k]=String(arg||'').split('|');cx_genModal(rid,k);},
 cx_genRes(v){const w=$('#cx_newRes');if(w)w.hidden=v!=='__new';},
 cx_copyLast(){const ta=$('#cx_list');if(ta)copyText(ta.value);},
 cx_closeGen(){closeOverlay();rerender();},
 cx_xlsLast(){if(!cx_last)return;cx_saveFile(`${cx_slug(cx_last.res.name)}_codes_${cx_fileStamp()}.xlsx`,cx_xlsx([{name:t('cx.x.sheet'),rows:cx_codeRows(cx_last.codes),widths:[22,12,12,14,28,12,12,22,14]}]));},
 cx_xlsRes(id){const r=cx_res(id);if(!r)return;const list=cx_resCodes(id,cx_cf());if(!list.length)return;
  const st=cx_stats().r[id]||{pk:{}};const sum=[[t('cx.x.pkg'),t('cx.x.ver'),t('cx.avail'),t('cx.st.activatedPl'),t('cx.st.voidPl')]].concat(Object.keys(st.pk).sort().map(k=>{const [p,tm]=k.split('-');const v=st.pk[k];return [PLAN_NAME[p],termLabel(+tm),v.issued,v.activated,v.void];}));
  cx_saveFile(`${cx_slug(r.name)}_codes_${cx_fileStamp()}.xlsx`,cx_xlsx([{name:t('cx.x.sheet'),rows:cx_codeRows(list),widths:[22,12,12,14,28,12,12,22,14]},{name:t('cx.x.sumSheet'),rows:sum,widths:[14,14,12,14,14]}]));},
 cx_rType(v){cx_rf().type=v||'';rerender();},
 cx_cPlan(v){cx_cf().plan=v;S.ui.cx_cp=1;rerender();},cx_cTerm(v){cx_cf().term=v;S.ui.cx_cp=1;rerender();},cx_cSt(v){cx_cf().st=v;S.ui.cx_cp=1;rerender();},
 cx_cPage(p){S.ui.cx_cp=+p;rerender();const c=$('#cx_clist');if(c)c.scrollIntoView({block:'start'});},
 cx_voidPkg(arg){const [rid,k]=arg.split('|');const r=cx_res(rid);const [p,tm]=k.split('-');const n=S.codes.filter(c=>c.reseller===rid&&c.status==='issued'&&c.plan===p&&c.term===+tm).length;if(!r||!n)return;
  modal(t('cx.v.title'),`<p>${t('cx.v.p',{w:cx_w(n),p:'<b>'+esc(pkgLabel(p,+tm))+'</b>',r:'<b>'+esc(r.name)+'</b>'})}</p>${ui.note('warn',t('cx.v.note'))}`,cx_cancel()+ui.btn(t('cx.v.do',{n:fmtNum(n)}),{kind:'danger',act:'cx_voidPkgDo',arg}));},
 cx_voidPkgDo(arg){const [rid,k]=arg.split('|');const r=cx_res(rid);const [p,tm]=k.split('-');const ts=iso(now());let n=0;for(const c of S.codes)if(c.reseller===rid&&c.status==='issued'&&c.plan===p&&c.term===+tm){c.status='void';c.voidAt=ts;n++;}
  const msg=t('cx.v.log',{w:cx_w(n),p:pkgLabel(p,+tm),r:r?r.name:''});log(msg);closeOverlay();toast(msg);rerender();},
 cx_voidOne(code){const c=S.codes.find(x=>x.code===code);if(!c||c.status!=='issued')return;
  modal(t('cx.v.oneT'),`<p>${t('cx.v.oneP',{c:'<span class="mono">'+fmtCode(c.code)+'</span>'})}</p>`,cx_cancel()+ui.btn(t('cx.voidOne'),{kind:'danger',act:'cx_voidOneDo',arg:code}));},
 cx_voidOneDo(code){const c=S.codes.find(x=>x.code===code);if(!c||c.status!=='issued')return;c.status='void';c.voidAt=iso(now());const msg=t('cx.v.oneLog',{c:fmtCode(c.code)});log(msg);closeOverlay();toast(msg);rerender();},
 cx_simGive(id){cx_simGiveModal(id);},
 cx_simBack(id){const r=cx_res(id);const n=S.sims.filter(s=>s.reseller===id&&s.status==='stock').length;if(!r||!n)return;
  modal(t('cx.s.backT'),`<p>${t('cx.s.backP',{n:fmtNum(n),r:'<b>'+esc(r.name)+'</b>'})}</p>`,cx_cancel()+ui.btn(t('cx.s.backDo',{n:fmtNum(n)}),{kind:'primary',act:'cx_simBackDo',arg:id}));},
 cx_simBackDo(id){const r=cx_res(id);const ts=iso(now());let n=0;S.sims.forEach(s=>{if(s.reseller===id&&s.status==='stock'){s.reseller=null;s.events.push([ts,'fromReseller',r?r.name:'']);n++;}});
  const msg=t('cx.s.backLog',{n:fmtNum(n),r:r?r.name:''});log(msg);closeOverlay();toast(msg);rerender();},
 cx_simsOf(id){S.ui.sim_f={q:'',st:'all',model:'',pkg:'',res:id};S.ui.sim_page=1;go('sims');},
 cod_resNew(){cx_resModal(null);},
 cod_resEdit(id){const r=cx_res(id);if(r)cx_resModal(r);},
 cx_resDel(id){const r=cx_res(id);if(!r)return;const x=cx_stats().r[id]||{issued:0,activated:0};const y=cx_simStats().r[id]||{total:0};
  if(x.activated||y.total){modal(t('cod.r.delT'),ui.note('warn',t('cx.r.delNo',{a:fmtNum(x.activated),s:fmtNum(y.total)})),ui.btn(t('c.close'),{act:'ovclose'}));return;}
  modal(t('cod.r.delT'),`<p>${t('cod.r.delP',{r:'<b>'+esc(r.name)+'</b>'})}</p>${x.issued?ui.note('info',t('cx.r.delCodes',{n:fmtNum(x.issued)})):''}`,cx_cancel()+ui.btn(t('c.delete'),{kind:'danger',icon:'trash',act:'cx_resDelDo',arg:id}));},
 cx_resDelDo(id){const r=cx_res(id);if(!r)return;S.codes=S.codes.filter(c=>c.reseller!==id||c.batchId);S.codes.forEach(c=>{if(c.batchId&&c.reseller===id)c.reseller=null;});/* print codes keep their key reservation and batch */S.resellers=S.resellers.filter(x=>x.id!==id);log(t('cod.r.logDel',{n:r.name}));closeOverlay();toast(t('cod.r.deleted',{n:esc(r.name)}));go('resellers');},
 cod_simAct(arg){const dm=$('.sim_demo');if(dm)dm.removeAttribute('open');cx_simActModal(arg||'');},
});

/* ---------- demo: customer activation (OTA mode) ---------- */
function cx_simActModal(preIccid){const mm={};allModels().forEach(x=>{mm[x.model.id]=x;});
 const codes=[];for(const c of S.codes){if(c.status==='issued'&&!c.batchId){codes.push(c);if(codes.length>=300)break;}}
 const sims=S.sims.filter(s=>s.status==='active'&&!s.plan);const shown=sims.slice(0,300);if(preIccid&&!shown.some(s=>s.iccid===preIccid)){const ps=sims.find(s=>s.iccid===preIccid);if(ps)shown.unshift(ps);}
 const simOpts=shown.map(s=>{const x=mm[s.modelId];return [s.iccid,'···'+s.iccid.slice(-6)+' · '+(x?x.model.name+' ('+(x.model.plan?PLAN_NAME[x.model.plan]:'—')+')':'—')];});
 modal(t('cod.a.title'),`<form id="cx_actF" data-form="cx_act" class="stack" novalidate>${ui.note('admin',t('cod.a.demoNote'))}
  <div class="field"><span class="lbl">${t('cx.via')}</span><div class="radio-cards"><label class="rc"><span class="row g8"><input type="radio" name="cx_via" value="token" checked><b>${t('cx.via.token')}</b></span><span class="xs muted">${t('cx.via.tokenD')}</span></label><label class="rc"><span class="row g8"><input type="radio" name="cx_via" value="sub"><b>${t('cx.via.sub')}</b></span><span class="xs muted">${t('cx.via.subD')}</span></label></div></div>
  ${ui.field({id:'cx_ac',label:t('cod.a.code'),type:'select',options:[['',codes.length?t('cod.a.pick'):t('cod.a.noAssigned')]].concat(codes.map(c=>{const r=cx_res(c.reseller);return [c.code,fmtCode(c.code)+' · '+pkgLabel(c.plan,c.term)+(r?' · '+r.name:'')];}))})}
  ${ui.field({id:'cx_ap',label:t('cod.a.paste'),mono:true,placeholder:S.org?S.org.prefix+'4-XXXX-XXXX-XXXX':'',attrs:'autocomplete="off" spellcheck="false" maxlength="24"',hint:t('cod.a.pasteHint')})}
  ${simOpts.length?ui.field({id:'cx_as',label:t('cod.a.sim'),type:'select',value:preIccid||'',options:simOpts,hint:t('cod.a.simHint',{n:fmtNum(sims.length)})}):ui.note('warn',t('cod.a.noSims'))}
  <div id="cx_actRes" aria-live="polite"></div></form>`,cx_cancel()+(simOpts.length?cx_submit(t('cod.a.do'),'cx_actF'):''));}
// print ТЗ v1.4 code (12 Crockford Base32, Luhn mod-32): only status 'printed' is redeemable; the shared rules run in prnRedeem (85_print),
// which uses the key reserved for the code. Messages never reveal more than needed (used / blocked / expired / not yet printed).
function cx_tryActivateV14(raw,iccid){const c0=typeof prnCodeNorm==='function'?prnCodeNorm(raw):'';
 if(typeof prnCodeCheck!=='function'||!prnCodeCheck(c0))return{err:t('cod.e.invalid')};
 const T7=()=>{const m=t('own.T7');return{err:m&&m!=='own.T7'?m:'This code cannot be used. Check the code or contact the seller.'};};
 const c=S.codes.find(x=>x.code===c0&&x.batchId);if(!c)return T7();
 if(typeof prnRedeem!=='function')return{err:t('cod.e.invalid')};
 const r=prnRedeem(c0,iccid);if(r.ok){log(t('cod.a.log',{c:'••••-••••-'+c0.slice(8),p:pkgLabel(r.c.plan,r.c.term),s:fmtIccid(r.s.iccid)}));return r;}
 const e=r.err;if(e==='no_key')return{err:t('cx.e.noKey'),credits:true};if(e==='no_token')return{err:t('cod.e.credits',{p:esc(pkgLabel(c.plan,c.term))}),credits:true};
 if(e==='nosim')return{err:t('cod.e.noSim')};if(e==='siminactive')return{err:t('cod.e.simInactive')};
 // ТЗ v10 4.4 p.4 / 4.12: used, blocked, expired, unknown or not yet printed → ONE message T7 without details (approved key own.T7, same as the portal)
 if(['used','blocked','expired','unknown','notprinted'].includes(e))return T7();
 const k='prn.rd.e.'+e;const msg=t(k,{d:r.deadline?fmtDate(r.deadline):''});return{err:msg&&msg!==k?msg:t('cod.e.invalid')};}
function cx_isV14(raw){const n=typeof prnCodeNorm==='function'?prnCodeNorm(raw):String(raw||'').replace(/[\s-]/g,'');return n.length===12;}
function cx_tryActivate(raw,iccid){
 if(cx_isV14(raw))return cx_tryActivateV14(raw,iccid);
 const p=parseCode(raw);if(p.err)return{err:t('cod.e.invalid')};
 if(!S.org||p.prefix!==S.org.prefix)return{err:t('cod.e.prefix',{p:esc(p.prefix),m:esc(S.org?S.org.prefix:'—')})};
 const c=S.codes.find(x=>x.code===p.code);if(!c)return{err:t('cod.e.unknown')};
 if(c.status==='void')return{err:t('cx.e.void',{d:fmtDate(c.voidAt)})};
 if(c.status==='activated')return{err:t('cod.e.used',{d:fmtDate(c.activatedAt),s:esc(fmtIccid(c.iccid||''))})};
 const s=S.sims.find(x=>x.iccid===iccid);if(!s)return{err:t('cod.e.noSim')};
 if(s.status!=='active')return{err:t('cod.e.simInactive')};
 if(s.plan)return{err:t('cod.e.simHasPkg',{p:esc(pkgLabel(s.plan,s.term))})};
 const x=findModel(s.modelId);if(!x||x.model.planStatus!=='approved'||!x.model.plan)return{err:t('cod.e.notApproved',{m:esc(x?x.model.name:'—')})};
 if(x.model.plan!==c.plan)return{err:t('cod.e.plan',{c:PLAN_NAME[c.plan],m:esc(x.model.name),mp:PLAN_NAME[x.model.plan]})};
 const k=pkgKey(c.plan,c.term);
 // ТЗ v10 3.1: the key is consumed at activation; the plan comes from the Service Token of this code (or from a Direct Subscription — see cx_trySub)
 const r=deviceActivate(s,{via:'token',code:c});
 if(r.err==='no_key')return{err:t('cx.e.noKey'),credits:true};
 if(r.err==='no_token')return{err:t('cod.e.credits',{p:esc(pkgLabel(c.plan,c.term))})+(tokenStats(k).expired?' '+t('cx.e.expiredToo'):''),credits:true};
 if(r.err)return{err:t('cod.e.invalid')};
 log(t('cod.a.log',{c:fmtCode(c.code),p:pkgLabel(c.plan,c.term),s:fmtIccid(s.iccid)}));return{ok:true,c,s};}
// demo: the end user pays a Direct Subscription by card on the portal (OTA = seller) → activation without a Service Token; no key → rejected
function cx_trySub(iccid){const s=S.sims.find(x=>x.iccid===iccid);if(!s)return{err:t('cod.e.noSim')};if(s.status!=='active')return{err:t('cod.e.simInactive')};
 if(s.plan)return{err:t('cod.e.simHasPkg',{p:esc(pkgLabel(s.plan,s.term))})};
 const x=findModel(s.modelId);if(!x||x.model.planStatus!=='approved'||!x.model.plan)return{err:t('cod.e.notApproved',{m:esc(x?x.model.name:'—')})};
 const needKey=!s.keyLotId&&!deviceKeyed(s.imei);if(needKey&&keysAvail(simCc(s))<=0)return{err:t('cx.e.noKeySub'),credits:true};
 const sub=subActive(s)||subCreate(s,x.model.plan);const r=deviceActivate(s,{via:'subscription',sub});
 if(r.err==='no_key')return{err:t('cx.e.noKeySub'),credits:true};if(r.err)return{err:t('cod.e.invalid')};
 log(t('cx.sub.log',{p:PLAN_NAME[sub.plan],s:fmtIccid(s.iccid)}));return{ok:true,s,sub};}
FORM.cx_act=f=>{const d=formData(f);const raw=String(d.cx_ap||'').trim()||d.cx_ac;const out=$('#cx_actRes');
 const via=(f.querySelector('input[name=cx_via]:checked')||{}).value||'token';
 if(via==='sub'){const r=cx_trySub(d.cx_as);if(r.err){out.innerHTML=ui.note('bad',`<b>${t('cod.e.title')}</b><br>${r.err}${r.credits?`<br><a href="#order-new">${t('cod.e.topUp')} →</a>`:''}`);return;}
  closeOverlay();toast(t('cx.sub.toast',{s:'···'+r.s.iccid.slice(-6),p:PLAN_NAME[r.sub.plan]}));rerender();return;}
 if(!raw){out.innerHTML=ui.note('warn',t('cod.e.none'));return;}
 const r=cx_tryActivate(raw,d.cx_as);
 if(r.err){out.innerHTML=ui.note('bad',`<b>${t('cod.e.title')}</b><br>${r.err}${r.credits?`<br><a href="#order-new">${t('cod.e.topUp')} →</a>`:''}`);return;}
 closeOverlay();toast(t('cod.a.toast',{s:'···'+r.s.iccid.slice(-6),p:esc(pkgLabel(r.c.plan,r.c.term))}));rerender();};

I18N.add({
uk:{'cx.nav':'Коди активації','cx.title':'Коди активації','cx.sub':'Кредити пакетів і коди, які ви видали точкам продажу.','cx.yShort':' р.','cx.gen':'Видати коди',
'cx.explain':'Коди безкоштовні: генеруйте їх під конкретну точку продажу скільки потрібно. Кожна реальна активація клієнтом списує один кредит відповідного пакета — з найстарішої партії. Якщо кредитів немає, активація чекає поповнення.',
'cx.cr.title':'Кредити пакетів','cx.cr.buy':'Купити кредити','cx.cr.avail':'доступно','cx.cr.bought':'Куплено','cx.cr.used':'Використано','cx.cr.empty':'Закінчились','cx.cr.low':'Мало','cx.cr.none':'Не куплено','cx.cr.over':'Видано {n} кодів — більше, ніж кредитів ({a}). Докупіть, щоб усі активації пройшли.','cx.cr.emptyT':'Кредитів ще немає','cx.cr.emptyP':'Купіть кредити пакетів — вони з’являться тут після оплати рахунку.',
'cx.lot.title':'Партії кредитів','cx.lot.p':'Кожна оплата — окрема партія зі своєю ціною закупівлі. Активації списують кредити з найстарішої партії.','cx.lot.inv':'Рахунок','cx.lot.qty':'Куплено','cx.lot.left':'Залишок','cx.lot.price':'Ціна за кредит','cx.lot.net':'без ПДВ','cx.lot.done':'Використано','cx.lot.inuse':'Списується','cx.lot.new':'Нова','cx.lot.empty':'Партій ще немає.',
'cx.byRes':'Коди за точками продажу','cx.avail':'Доступні коди','cx.st.issued':'Видано','cx.st.activated':'Активовано','cx.st.void':'Деактивовано','cx.st.activatedPl':'Активовано','cx.st.voidPl':'Деактивовано',
'cx.g.title':'Видати коди точці продажу','cx.g.p':'Коди генеруються одразу для вибраної точки продажу. Їх можна деактивувати, якщо ви більше не хочете, щоб вона продавала.','cx.g.newRes':'+ Нова точка продажу','cx.g.qty':'Кількість кодів','cx.g.qtyHint':'Від 1 до 10 000. Генерація безкоштовна.','cx.g.do':'Згенерувати й видати','cx.g.noModels':'Коди можна генерувати лише для пакетів, призначених вашим моделям. Дочекайтеся затвердження моделі.','cx.g.log':'{w} {p} видано: {r}','cx.g.doneT':'Готово: {w}','cx.g.doneP':'Коди {p} закріплено за {r}. Скопіюйте список або завантажте Excel і передайте точці продажу.','cx.g.creditWarn':'Кредитів цього пакета {a}, а виданих кодів {n} — частина активацій чекатиме поповнення.',
'cx.copyList':'Копіювати список','cx.more':'Коди','cx.void':'Деактивувати','cx.voidOne':'Деактивувати код',
'cx.x.btn':'Excel','cx.x.btnN':'Excel · {n}','cx.x.code':'Код','cx.x.pkg':'Пакет','cx.x.ver':'Версія (термін)','cx.x.res':'Точка продажу','cx.x.created':'Видано','cx.x.activated':'Активовано','cx.x.void':'Деактивовано','cx.x.sheet':'Коди','cx.x.sumSheet':'Підсумок','cx.x.saved':'Файл {f} готовий','cx.x.fail':'Не вдалося зберегти файл',
'cx.r.sub':'Монтажники, магазини, філії та дилери: які коди й SIM-карти в них є і скільки вже активовано.','cx.r.search':'Назва або місто','cx.r.k.count':'Точок продажу','cx.r.k.availS':'готові до продажу','cx.r.k.sims':'SIM у точках','cx.r.k.simsS':'ще не встановлені','cx.r.k.inst':'SIM встановлено','cx.r.simCol':'SIM у точці','cx.r.simOf':'встановлено {a}','cx.r.simsGiven':'передано всього {n}','cx.r.blocked':'заблоковано {n}',
'cx.r.byPkg':'Коди за пакетами і версіями','cx.r.noCodesP':'Видайте коди потрібного пакета — вони з’являться тут.','cx.r.dangerT':'Керування точкою продажу','cx.r.dangerP':'Видалити можна лише точку без активацій і без SIM-карт.','cx.r.delNo':'У точки є активації ({a}) або SIM-карти ({s}) — видалити її не можна. Деактивуйте коди й поверніть SIM-карти.','cx.r.delCodes':'{n} невикористаних кодів буде видалено.',
'cx.c.search':'Код або ICCID','cx.c.allPkg':'Усі пакети','cx.c.allVer':'Усі версії','cx.c.allSt':'Усі статуси','cx.c.since':'видано {d}',
'cx.v.title':'Деактивувати коди?','cx.v.p':'{w} {p} у {r} перестануть працювати.','cx.v.note':'Деактивовані коди не можна повернути. Активовані раніше пакети продовжують діяти.','cx.v.do':'Деактивувати {n}','cx.v.log':'Деактивовано {w} {p}: {r}','cx.v.oneT':'Деактивувати код?','cx.v.oneP':'Код {c} перестане працювати.','cx.v.oneLog':'Код {c} деактивовано',
'cx.s.title':'SIM-карти','cx.s.give':'Передати SIM-карти','cx.s.giveT':'Передати SIM-карти: {r}','cx.s.giveP':'На вашому складі {n} SIM-карт. Передаються картки з найменшими ICCID.','cx.s.qty':'Кількість','cx.s.qtyHint':'Перша: {a}','cx.s.qtyErr':'Від 1 до {n}','cx.s.giveDo':'Передати','cx.s.gaveLog':'Передано {n} SIM-карт: {r} (ICCID {a} – {b})','cx.s.noStock':'На вашому складі немає вільних SIM-карт.','cx.s.given':'Передано всього','cx.s.atPoint':'У точці, не встановлені','cx.s.inst':'Встановлено в пристрої','cx.s.blocked':'Заблоковано','cx.s.list':'Список SIM-карт','cx.s.none':'Цій точці ще не передавали SIM-карти.','cx.s.back':'Повернути','cx.s.backT':'Повернути SIM-карти на склад?','cx.s.backP':'{n} невстановлених SIM-карт із {r} повернуться на ваш склад.','cx.s.backDo':'Повернути {n}','cx.s.backLog':'Повернуто {n} SIM-карт від {r}',
'cx.e.void':'Код деактивовано {d} — продаж за ним зупинено.','cx.pf.title':'Як побудований код','cx.pf.prefix':'Ваш префікс','cx.pf.p':'Кожен ваш код починається з префікса; 6-й символ означає пакет і версію.','cx.pf.digit':'6-й символ'},
en:{'cx.nav':'Activation codes','cx.title':'Activation codes','cx.sub':'Package credits and the codes you’ve issued to points of sale.','cx.yShort':'y','cx.gen':'Issue codes',
'cx.explain':'Codes are free: generate as many as a point of sale needs. Each real customer activation uses one credit of that package — from the oldest lot. If there are no credits, the activation waits for a top-up.',
'cx.cr.title':'Package credits','cx.cr.buy':'Buy credits','cx.cr.avail':'available','cx.cr.bought':'Bought','cx.cr.used':'Used','cx.cr.empty':'Used up','cx.cr.low':'Low','cx.cr.none':'Not bought','cx.cr.over':'{n} codes issued — more than credits ({a}). Top up so every activation goes through.','cx.cr.emptyT':'No credits yet','cx.cr.emptyP':'Buy package credits — they appear here once the invoice is paid.',
'cx.lot.title':'Credit lots','cx.lot.p':'Each payment is a separate lot with its own purchase price. Activations use credits from the oldest lot first.','cx.lot.inv':'Invoice','cx.lot.qty':'Bought','cx.lot.left':'Left','cx.lot.price':'Price per credit','cx.lot.net':'net','cx.lot.done':'Used up','cx.lot.inuse':'In use','cx.lot.new':'New','cx.lot.empty':'No lots yet.',
'cx.byRes':'Codes by point of sale','cx.avail':'Available codes','cx.st.issued':'Issued','cx.st.activated':'Activated','cx.st.void':'Deactivated','cx.st.activatedPl':'Activated','cx.st.voidPl':'Deactivated',
'cx.g.title':'Issue codes to a point of sale','cx.g.p':'Codes are generated for the chosen point of sale. You can deactivate them if you no longer want it to sell.','cx.g.newRes':'+ New point of sale','cx.g.qty':'Number of codes','cx.g.qtyHint':'1 to 10,000. Generating is free.','cx.g.do':'Generate and issue','cx.g.noModels':'Codes can only be generated for packages assigned to your models. Wait for a model to be approved.','cx.g.log':'{w} {p} issued to {r}','cx.g.doneT':'Done: {w}','cx.g.doneP':'{p} codes are assigned to {r}. Copy the list or download Excel and send it to the point of sale.','cx.g.creditWarn':'You have {a} credits for this package but {n} issued codes — some activations will wait for a top-up.',
'cx.copyList':'Copy list','cx.more':'Codes','cx.void':'Deactivate','cx.voidOne':'Deactivate code',
'cx.x.btn':'Excel','cx.x.btnN':'Excel · {n}','cx.x.code':'Code','cx.x.pkg':'Package','cx.x.ver':'Version (term)','cx.x.res':'Point of sale','cx.x.created':'Issued','cx.x.activated':'Activated','cx.x.void':'Deactivated','cx.x.sheet':'Codes','cx.x.sumSheet':'Summary','cx.x.saved':'{f} is ready','cx.x.fail':'Couldn’t save the file',
'cx.r.sub':'Installers, shops, branches and dealers: which codes and SIM cards they hold and how many are activated.','cx.r.search':'Name or city','cx.r.k.count':'Points of sale','cx.r.k.availS':'ready to sell','cx.r.k.sims':'SIMs at points','cx.r.k.simsS':'not installed yet','cx.r.k.inst':'SIMs installed','cx.r.simCol':'SIMs at point','cx.r.simOf':'{a} installed','cx.r.simsGiven':'{n} handed over in total','cx.r.blocked':'{n} blocked',
'cx.r.byPkg':'Codes by package and version','cx.r.noCodesP':'Issue codes for a package — they’ll appear here.','cx.r.dangerT':'Manage point of sale','cx.r.dangerP':'Only a point with no activations and no SIM cards can be deleted.','cx.r.delNo':'This point has activations ({a}) or SIM cards ({s}), so it can’t be deleted. Deactivate its codes and take the SIM cards back.','cx.r.delCodes':'{n} unused codes will be deleted.',
'cx.c.search':'Code or ICCID','cx.c.allPkg':'All packages','cx.c.allVer':'All versions','cx.c.allSt':'All statuses','cx.c.since':'issued {d}',
'cx.v.title':'Deactivate codes?','cx.v.p':'{w} {p} at {r} will stop working.','cx.v.note':'Deactivated codes can’t be restored. Packages already activated keep working.','cx.v.do':'Deactivate {n}','cx.v.log':'Deactivated {w} {p} at {r}','cx.v.oneT':'Deactivate code?','cx.v.oneP':'Code {c} will stop working.','cx.v.oneLog':'Code {c} deactivated',
'cx.s.title':'SIM cards','cx.s.give':'Hand over SIM cards','cx.s.giveT':'Hand over SIM cards: {r}','cx.s.giveP':'{n} SIM cards in your warehouse. Cards with the lowest ICCIDs go first.','cx.s.qty':'Quantity','cx.s.qtyHint':'First: {a}','cx.s.qtyErr':'1 to {n}','cx.s.giveDo':'Hand over','cx.s.gaveLog':'{n} SIM cards handed to {r} (ICCID {a} – {b})','cx.s.noStock':'No free SIM cards in your warehouse.','cx.s.given':'Handed over in total','cx.s.atPoint':'At the point, not installed','cx.s.inst':'Installed in devices','cx.s.blocked':'Blocked','cx.s.list':'SIM card list','cx.s.none':'No SIM cards handed to this point yet.','cx.s.back':'Take back','cx.s.backT':'Take SIM cards back?','cx.s.backP':'{n} uninstalled SIM cards from {r} return to your warehouse.','cx.s.backDo':'Take back {n}','cx.s.backLog':'{n} SIM cards returned from {r}',
'cx.e.void':'This code was deactivated on {d} — sales with it are stopped.','cx.pf.title':'How a code is built','cx.pf.prefix':'Your prefix','cx.pf.p':'Every code of yours starts with the prefix; the 6th character is the package and version.','cx.pf.digit':'6th character'},
ru:{'cx.nav':'Коды активации','cx.title':'Коды активации','cx.sub':'Кредиты пакетов и коды, выданные точкам продаж.','cx.yShort':' г.','cx.gen':'Выдать коды',
'cx.explain':'Коды бесплатные: генерируйте их под конкретную точку продаж сколько нужно. Каждая реальная активация клиентом списывает один кредит соответствующего пакета — из самой старой партии. Если кредитов нет, активация ждёт пополнения.',
'cx.cr.title':'Кредиты пакетов','cx.cr.buy':'Купить кредиты','cx.cr.avail':'доступно','cx.cr.bought':'Куплено','cx.cr.used':'Использовано','cx.cr.empty':'Закончились','cx.cr.low':'Мало','cx.cr.none':'Не куплено','cx.cr.over':'Выдано {n} кодов — больше, чем кредитов ({a}). Докупите, чтобы все активации прошли.','cx.cr.emptyT':'Кредитов пока нет','cx.cr.emptyP':'Купите кредиты пакетов — они появятся здесь после оплаты счёта.',
'cx.lot.title':'Партии кредитов','cx.lot.p':'Каждая оплата — отдельная партия со своей ценой закупки. Активации списывают кредиты из самой старой партии.','cx.lot.inv':'Счёт','cx.lot.qty':'Куплено','cx.lot.left':'Остаток','cx.lot.price':'Цена за кредит','cx.lot.net':'без НДС','cx.lot.done':'Использована','cx.lot.inuse':'Списывается','cx.lot.new':'Новая','cx.lot.empty':'Партий пока нет.',
'cx.byRes':'Коды по точкам продаж','cx.avail':'Доступные коды','cx.st.issued':'Выдан','cx.st.activated':'Активирован','cx.st.void':'Деактивирован','cx.st.activatedPl':'Активировано','cx.st.voidPl':'Деактивировано',
'cx.g.title':'Выдать коды точке продаж','cx.g.p':'Коды генерируются сразу для выбранной точки продаж. Их можно деактивировать, если вы больше не хотите, чтобы она продавала.','cx.g.newRes':'+ Новая точка продаж','cx.g.qty':'Количество кодов','cx.g.qtyHint':'От 1 до 10 000. Генерация бесплатна.','cx.g.do':'Сгенерировать и выдать','cx.g.noModels':'Коды можно генерировать только для пакетов, назначенных вашим моделям. Дождитесь утверждения модели.','cx.g.log':'{w} {p} выдано: {r}','cx.g.doneT':'Готово: {w}','cx.g.doneP':'Коды {p} закреплены за {r}. Скопируйте список или скачайте Excel и передайте точке продаж.','cx.g.creditWarn':'Кредитов этого пакета {a}, а выданных кодов {n} — часть активаций будет ждать пополнения.',
'cx.copyList':'Копировать список','cx.more':'Коды','cx.void':'Деактивировать','cx.voidOne':'Деактивировать код',
'cx.x.btn':'Excel','cx.x.btnN':'Excel · {n}','cx.x.code':'Код','cx.x.pkg':'Пакет','cx.x.ver':'Версия (срок)','cx.x.res':'Точка продаж','cx.x.created':'Выдан','cx.x.activated':'Активирован','cx.x.void':'Деактивирован','cx.x.sheet':'Коды','cx.x.sumSheet':'Итоги','cx.x.saved':'Файл {f} готов','cx.x.fail':'Не удалось сохранить файл',
'cx.r.sub':'Монтажники, магазины, филиалы и дилеры: какие коды и SIM-карты у них есть и сколько уже активировано.','cx.r.search':'Название или город','cx.r.k.count':'Точек продаж','cx.r.k.availS':'готовы к продаже','cx.r.k.sims':'SIM в точках','cx.r.k.simsS':'ещё не установлены','cx.r.k.inst':'SIM установлено','cx.r.simCol':'SIM в точке','cx.r.simOf':'установлено {a}','cx.r.simsGiven':'передано всего {n}','cx.r.blocked':'заблокировано {n}',
'cx.r.byPkg':'Коды по пакетам и версиям','cx.r.noCodesP':'Выдайте коды нужного пакета — они появятся здесь.','cx.r.dangerT':'Управление точкой продаж','cx.r.dangerP':'Удалить можно только точку без активаций и без SIM-карт.','cx.r.delNo':'У точки есть активации ({a}) или SIM-карты ({s}) — удалить её нельзя. Деактивируйте коды и верните SIM-карты.','cx.r.delCodes':'{n} неиспользованных кодов будет удалено.',
'cx.c.search':'Код или ICCID','cx.c.allPkg':'Все пакеты','cx.c.allVer':'Все версии','cx.c.allSt':'Все статусы','cx.c.since':'выдан {d}',
'cx.v.title':'Деактивировать коды?','cx.v.p':'{w} {p} у {r} перестанут работать.','cx.v.note':'Деактивированные коды нельзя вернуть. Ранее активированные пакеты продолжают действовать.','cx.v.do':'Деактивировать {n}','cx.v.log':'Деактивировано {w} {p}: {r}','cx.v.oneT':'Деактивировать код?','cx.v.oneP':'Код {c} перестанет работать.','cx.v.oneLog':'Код {c} деактивирован',
'cx.s.title':'SIM-карты','cx.s.give':'Передать SIM-карты','cx.s.giveT':'Передать SIM-карты: {r}','cx.s.giveP':'На вашем складе {n} SIM-карт. Передаются карты с наименьшими ICCID.','cx.s.qty':'Количество','cx.s.qtyHint':'Первая: {a}','cx.s.qtyErr':'От 1 до {n}','cx.s.giveDo':'Передать','cx.s.gaveLog':'Передано {n} SIM-карт: {r} (ICCID {a} – {b})','cx.s.noStock':'На вашем складе нет свободных SIM-карт.','cx.s.given':'Передано всего','cx.s.atPoint':'В точке, не установлены','cx.s.inst':'Установлено в устройства','cx.s.blocked':'Заблокировано','cx.s.list':'Список SIM-карт','cx.s.none':'Этой точке ещё не передавали SIM-карты.','cx.s.back':'Вернуть','cx.s.backT':'Вернуть SIM-карты на склад?','cx.s.backP':'{n} неустановленных SIM-карт из {r} вернутся на ваш склад.','cx.s.backDo':'Вернуть {n}','cx.s.backLog':'Возвращено {n} SIM-карт от {r}',
'cx.e.void':'Код деактивирован {d} — продажа по нему остановлена.','cx.pf.title':'Как устроен код','cx.pf.prefix':'Ваш префикс','cx.pf.p':'Каждый ваш код начинается с префикса; 6-й символ означает пакет и версию.','cx.pf.digit':'6-й символ'}});

/* ---------- v09 wording: Service Tokens & Activation Keys (also overrides older cod.*, sim.*, cat.* copy from 20/40) ---------- */
(function(){const R=[
['cx.nav','Коди й токени','Codes & tokens','Коды и токены'],['c.secWarehouse','Склад і продажі','Warehouse & sales','Склад и продажи'],['cx.title','Коди, токени й ключі','Codes, tokens & keys','Коды, токены и ключи'],['cx.sub','Сервісні токени, ключі активації та коди, які ви видали точкам продажу.','Service Tokens, Activation Keys and the codes you gave to points of sale.','Сервисные токены, ключи активации и коды, которые вы выдали точкам продаж.'],
['cx.explain','Коди безкоштовні: генеруйте їх під конкретну точку продажу скільки потрібно. Кожна реальна активація списує один сервісний токен точного тарифу й терміну (спершу ті, що раніше спливають), а для нового пристрою — ще й один ключ активації. Якщо токена або ключа немає, активацію буде відхилено, а код залишиться дійсним.','Codes are free: generate as many as you need for a specific point of sale. Each real activation uses one Service Token of the exact plan and term (soonest-expiring first) and, for a new device, one Activation Key. With no token or no key the activation is rejected; the code stays valid.','Коды бесплатны: генерируйте их под конкретную точку продаж сколько нужно. Каждая реальная активация списывает один сервисный токен точного тарифа и срока (сначала те, что раньше истекают), а для нового устройства — ещё и один ключ активации. Если токена или ключа нет, активация отклоняется, а код остаётся действительным.'],
['cx.k.title','Ключі активації','Activation Keys','Ключи активации'],['cx.k.batches','Партії: ключі + SIM-карти 1:1','Batches: keys + SIM cards 1:1','Партии: ключи + SIM-карты 1:1'],['cx.k.toShip','Відвантаження SIM','SIM shipments','Отгрузки SIM'],['cx.k.buy','Купити ключі','Buy keys','Купить ключи'],['cx.k.avail','вільних ключів','keys available','свободных ключей'],['cx.k.used','Використано (пристроїв)','Used (devices)','Использовано (устройств)'],
['cx.k.p','Один ключ — один пристрій, назавжди. Повторна активація того самого пристрою ключ не списує.','One key per device, for life. Re-activating the same device doesn’t use another key.','Один ключ — одно устройство, навсегда. Повторная активация того же устройства ключ не списывает.'],
['cx.how.title','Що списується під час активації','What an activation uses','Что списывается при активации'],['cx.how.1','Клієнт вводить код із картки — код визначає тариф і термін.','The customer enters the code from the card — it defines plan and term.','Клиент вводит код с карточки — код определяет тариф и срок.'],['cx.how.2','Списується 1 сервісний токен саме цього тарифу й терміну.','1 Service Token of exactly that plan and term is used.','Списывается 1 сервисный токен именно этого тарифа и срока.'],['cx.how.3','Якщо пристрій активують уперше — ще 1 ключ активації.','If the device is activated for the first time — also 1 Activation Key.','Если устройство активируют впервые — ещё 1 ключ активации.'],
['cx.cr.title','Сервісні токени','Service Tokens','Сервисные токены'],['cx.cr.buy','Купити токени','Buy tokens','Купить токены'],['cx.cr.avail','доступно','available','доступно'],['cx.cr.none','Не куплено','Not bought','Не куплено'],
['cx.cr.over','Видано {n} кодів — більше, ніж токенів ({a}). Докупіть, щоб усі активації пройшли.','{n} codes handed out — more than tokens left ({a}). Top up so every activation goes through.','Выдано {n} кодов — больше, чем токенов ({a}). Докупите, чтобы все активации прошли.'],
['cx.cr.emptyT','Токенів ще немає','No tokens yet','Токенов пока нет'],['cx.cr.emptyP','Купіть сервісні токени — вони з’являться тут після оплати рахунку.','Buy Service Tokens — they appear here once the invoice is paid.','Купите сервисные токены — они появятся здесь после оплаты счёта.'],
['cx.t.reserved','у процесі обміну: {n}','being exchanged: {n}','в процессе обмена: {n}'],['cx.t.expired','Прострочено й не використано: {n}','Expired, unused: {n}','Просрочено и не использовано: {n}'],['cx.t.valid','Токен дійсний 36 місяців від видачі. Прострочені токени не списуються.','A token is valid for 36 months from issue. Expired tokens can’t be used.','Токен действует 36 месяцев с выдачи. Просроченные токены не списываются.'],
['cx.lot.title','Партії токенів','Token lots','Партии токенов'],['cx.lot.p','Кожен оплачений рядок рахунку — окрема партія зі своєю ціною (у валюті країни) і терміном дії.','Each paid invoice line is a separate lot with its own price (in the country’s currency) and expiry.','Каждая оплаченная строка счёта — отдельная партия со своей ценой (в валюте страны) и сроком действия.'],['cx.lot.issued','Видано','Issued','Выдано'],['cx.lot.exp','Дійсні до','Valid until','Действуют до'],['cx.lot.price','Ціна за токен','Price per token','Цена за токен'],
['cx.lot.expired','Прострочено','Expired','Просрочено'],['cx.lot.revoked','Відкликано','Revoked','Отозвано'],['cx.lot.xchg','обмін','exchange','обмен'],['cx.lot.net','USD','USD','USD'],
['cx.x.exchange','Обміняти токени','Exchange tokens','Обменять токены'],
['cx.xc.title','Обміни токенів','Token exchanges','Обмены токенов'],['cx.xc.from','Віддаю','Give','Отдаю'],['cx.xc.to','Отримую','Get','Получаю'],['cx.xc.diff','Доплата','Difference','Доплата'],['cx.xc.noRefund','без повернення','no refund','без возврата'],
['cx.xc.st.awaiting_payment','Очікує доплати','Awaiting payment','Ожидает доплаты'],['cx.xc.st.done','Виконано','Done','Выполнено'],['cx.xc.st.cancelled','Скасовано','Cancelled','Отменено'],
['cx.xc.modalT','Обмін сервісних токенів','Exchange Service Tokens','Обмен сервисных токенов'],['cx.xc.p','Можна обміняти токени на інший тариф або термін. Дорожчий — доплатіть різницю (окремий рахунок), дешевший — без повернення. Термін дії токенів не змінюється.','Swap tokens for another plan or term. More expensive — pay the difference (separate invoice); cheaper — no refund. Token validity stays the same.','Можно обменять токены на другой тариф или срок. Дороже — доплатите разницу (отдельный счёт), дешевле — без возврата. Срок действия токенов не меняется.'],
['cx.xc.have','є {n}','{n} on hand','есть {n}'],['cx.xc.cc','Прайс-лист країни','Country price list','Прайс-лист страны'],['cx.xc.do','Обміняти','Exchange','Обменять'],['cx.xc.same','Виберіть інший тариф або термін','Choose another plan or term','Выберите другой тариф или срок'],
['cx.xc.pay','Доплата {u} за токен × {n} = {tot}. Обмін завершиться після оплати рахунку.','Difference {u} per token × {n} = {tot}. The exchange completes once the invoice is paid.','Доплата {u} за токен × {n} = {tot}. Обмен завершится после оплаты счёта.'],['cx.xc.cheaper','Новий токен дешевший на {u}. Різницю не повертаємо; обмін — одразу.','The new token is {u} cheaper. The difference is not refunded; the exchange is immediate.','Новый токен дешевле на {u}. Разницу не возвращаем; обмен — сразу.'],
['cx.xc.qtyErr','Від 1 до {n}','From 1 to {n}','От 1 до {n}'],['cx.xc.fail','Не вдалося — недостатньо токенів','Couldn’t exchange — not enough tokens','Не удалось — недостаточно токенов'],['cx.xc.invoiced','Обмін очікує доплати · рахунок {i}','Exchange awaiting payment · invoice {i}','Обмен ожидает доплаты · счёт {i}'],['cx.xc.doneMsg','Обміняно {n}: {a} → {b}','Exchanged {n}: {a} → {b}','Обменено {n}: {a} → {b}'],
['cx.g.creditWarn','Токенів цього пакета {a}, а виданих кодів {n} — частина активацій буде відхилена, доки ви не докупите.','{a} tokens of this package left but {n} codes handed out — some activations will be rejected until you top up.','Токенов этого пакета {a}, а выданных кодов {n} — часть активаций будет отклонена, пока вы не докупите.'],
['cx.g.noModels','Коди можна генерувати лише для тарифів, призначених вашим моделям. Дочекайтеся затвердження моделі.','Codes can only be generated for plans assigned to your models. Wait until a model is approved.','Коды можно генерировать только для тарифов, назначенных вашим моделям. Дождитесь утверждения модели.'],
['cx.e.noKey','Немає вільного ключа активації для нового пристрою. Купіть ключі — код залишається дійсним.','No Activation Key left for a new device. Buy keys — the code stays valid.','Нет свободного ключа активации для нового устройства. Купите ключи — код остаётся действительным.'],['cx.e.expiredToo','Є прострочені токени цього пакета — вони не списуються.','There are expired tokens of this package — they can’t be used.','Есть просроченные токены этого пакета — они не списываются.'],
['cod.sub','Сервісні токени, коди й хто які коди отримав.','Service Tokens, codes and who has which codes.','Сервисные токены, коды и у кого какие коды.'],
['cod.cr.outWarn','Роздано й не активовано: {n} — більше, ніж токенів','Handed out, not activated: {n} — more than tokens left','Выдано и не активировано: {n} — больше, чем токенов'],['cod.cr.noneT','Сервісних токенів ще немає','No Service Tokens yet','Сервисных токенов пока нет'],['cod.cr.noneP','Токени потрібні, щоб клієнти могли активувати пакети. Додайте їх до замовлення.','Tokens let customers activate packages. Add them to an order.','Токены нужны, чтобы клиенты могли активировать пакеты. Добавьте их в заказ.'],
['cod.g.p','Коди безкоштовні. Токен (і ключ для нового пристрою) списується лише під час активації.','Codes are free. A token (and a key for a new device) is used only at activation.','Коды бесплатны. Токен (и ключ для нового устройства) списывается только при активации.'],['cod.g.credits','токенів: {n}','{n} tokens','токенов: {n}'],
['cod.e.credits','Закінчились сервісні токени {p}. Код залишається дійсним — активація пройде після поповнення.','No {p} Service Tokens left. The code stays valid — the activation will go through once you top up.','Закончились сервисные токены {p}. Код остаётся действительным — активация пройдёт после пополнения.'],['cod.e.topUp','Купити токени або ключі','Buy tokens or keys','Купить токены или ключи'],
['cod.explain','Коди безкоштовні й без обмежень. Кожна активація списує один сервісний токен і, для нового пристрою, один ключ активації.','Codes are free and unlimited. Each activation uses one Service Token and, for a new device, one Activation Key.','Коды бесплатны и без ограничений. Каждая активация списывает один сервисный токен и, для нового устройства, один ключ активации.'],
['sim.ev.in_stock','Прийнята на зберігання','Received into custody','Принята на хранение'],
['cat.usdT','Ціни сервісних токенів {p}, USD (прайс-лист основної країни)','{p} Service Token prices, USD (primary country price list)','Цены сервисных токенов {p}, USD (прайс-лист основной страны)'],
['cat.usdP','Зміна створює нову версію прайс-листа. Підвищення набуває чинності не раніше ніж через 90 днів.','A change creates a new price-list version. Increases take effect no sooner than 90 days.','Изменение создаёт новую версию прайс-листа. Повышение вступает в силу не раньше чем через 90 дней.'],
['cat.usdLog','змінено цін токенів: {n}','token prices changed: {n}','изменено цен токенов: {n}'],
['cat.planExp.prem','Для пристроїв із великим обсягом даних і підвищеними вимогами до сервісу.','For devices with heavy data use and higher service needs.','Для устройств с большим объёмом данных и повышенными требованиями к сервису.'],
['cat.priceNote','ціна сервісного токена на один пристрій, USD без ПДВ','price of one Service Token for one device, USD net','цена сервисного токена на одно устройство, USD без НДС'],['cat.cPrice','Ціна токена','Token price','Цена токена'],['cat.cTerm','Термін','Term','Срок'],['cat.indiv','ціна змінена','custom price','цена изменена'],
['cat.reviewNote','Ми перевіряємо цей пристрій, щоб призначити тариф (Light, Standard або Premium). Зазвичай це займає до 1 робочого дня. Список IMEI можна завантажити вже зараз.','We are checking this device to assign a plan (Light, Standard or Premium). This usually takes up to 1 business day. You can upload the IMEI list already.','Мы проверяем это устройство, чтобы назначить тариф (Light, Standard или Premium). Обычно это занимает до 1 рабочего дня. Список IMEI можно загрузить уже сейчас.'],
];const o={uk:{},en:{},ru:{}};R.forEach(([k,uk,en,ru])=>{o.uk[k]=uk;o.en[k]=en;o.ru[k]=ru;});I18N.add(o);})();
I18N.add({uk:{'cx.via':'Звідки тариф','cx.via.token':'Код активації (сервісний токен)','cx.via.tokenD':'Списується 1 токен пакета коду і, якщо пристрій новий, 1 ключ активації.','cx.via.sub':'Пряма підписка','cx.via.subD':'Покупець оплачує карткою на порталі, продавець — OTA. Токен не потрібен, ключ активації списується.','cx.e.noKeySub':'Немає вільного ключа активації для нового пристрою — активувати за прямою підпискою не можна. Купіть ключі активації.','cx.sub.log':'Активація за прямою підпискою {p}: SIM {s}','cx.sub.toast':'SIM {s}: активовано за прямою підпискою {p}'},
en:{'cx.via':'Plan source','cx.via.token':'Activation code (Service Token)','cx.via.tokenD':'Uses 1 token of the code’s package and, for a new device, 1 Activation Key.','cx.via.sub':'Direct Subscription','cx.via.subD':'The customer pays by card on the portal; OTA is the seller. No token needed; an Activation Key is used.','cx.e.noKeySub':'No free Activation Key for a new device — the Direct Subscription activation can’t go ahead. Buy Activation Keys.','cx.sub.log':'Activation with Direct Subscription {p}: SIM {s}','cx.sub.toast':'SIM {s}: activated with Direct Subscription {p}'},
ru:{'cx.via':'Откуда тариф','cx.via.token':'Код активации (сервисный токен)','cx.via.tokenD':'Списывается 1 токен пакета кода и, если устройство новое, 1 ключ активации.','cx.via.sub':'Прямая подписка','cx.via.subD':'Покупатель оплачивает картой на портале, продавец — OTA. Токен не нужен, ключ активации списывается.','cx.e.noKeySub':'Нет свободного ключа активации для нового устройства — активировать по прямой подписке нельзя. Купите ключи активации.','cx.sub.log':'Активация по прямой подписке {p}: SIM {s}','cx.sub.toast':'SIM {s}: активировано по прямой подписке {p}'}});
/* ---------- customer-portal bridge (ТЗ v10 3.1 / 4.4): codes redeemed in /portal (localStorage cfb-demo-ownership.codes[CODE].status='redeemed')
   are activated here with the same rules: 1 Service Token of the code's package + 1 Activation Key for a new device; no key / no token → stays pending. */
function cx_bridgeSync(){if(!S||!S.authed||!S.codes||!S.codes.length)return 0;let b=null;try{b=JSON.parse(localStorage.getItem('cfb-demo-ownership')||'null');}catch(e){}
 if(!b||!b.codes)return 0;let n=0;const byCode={};for(const c of S.codes)byCode[c.code]=c;
 // only the old 16-character codes: 12-character print codes (format 'v14', batchId) are activated by 85_print prn_fromPortal — never twice
 Object.keys(b.codes).forEach(code=>{const r=b.codes[code];if(!r||r.status!=='redeemed'||r.format==='v14')return;const c=byCode[code];if(!c||c.batchId||c.status!=='issued')return;
  const dev=String(r.device_id||'');const bd=(b.bindings||[]).find(x=>x.device_id===dev&&x.status!=='ended');
  const s=S.sims.find(x=>x.imei===dev||x.iccid===dev||(bd&&x.iccid===bd.iccid));
  const fail=why=>{if(!c.bridgePending||c.bridgePending.reason!==why){c.bridgePending={reason:why,at:iso(now())};n++;}};
  if(!s)return fail('no_sim');if(s.plan)return fail('has_plan');
  const res=deviceActivate(s,{via:'token',code:c});if(res.err)return fail(res.err);
  delete c.bridgePending;c.redeemedIn='portal';c.redeemedBy=r.redeemed_by_account_id||null;log(t('cod.a.log',{c:fmtCode(c.code),p:pkgLabel(c.plan,c.term),s:fmtIccid(s.iccid)}));n++;});
 return n;}
let cx_bridgeBusy=false;
HOOKS.afterRender.push(()=>{if(cx_bridgeBusy)return;try{if(cx_bridgeSync()){cx_bridgeBusy=true;save();rerender();cx_bridgeBusy=false;}}catch(e){cx_bridgeBusy=false;console.error(e);}});
