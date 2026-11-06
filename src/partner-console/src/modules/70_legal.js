/* ===== 70_legal: legal module (ТЗ) — questionnaire, OTA review, document engine, package, e-signing, versions, audit =====
   Public engine API (used by 75_opsdocs):
     lg_values(ctx) → flat {KEY: value} (formatted; KEY_L2 holds the LANG2 form when it differs; non-enumerable __na = Set of N/A keys)
     lg_render(type, ctx) → {html, text, missing:[keys], blocks:[{id,kind,en,l2}], error, untranslated, header, footer, title, number, used}
     lg_number(type, cc, opts) · lg_hash(text) (async SHA-256 hex) · lg_audit(action, object, details) · lg_printView(docIdOrRender)
   ctx for lg_render / lg_values: {cc, docNo, date, effective, extra:{KEY:value}, draft, tplVer, priceVer, vals (frozen map → no live lookup),
     replaces:{ver,date}, signatures:[…], lang2, public:'en'|'ru' (single-language web view, no header), noCert} */

/* ---------- constants ---------- */
const LG_LEGAL_TYPES=['MPA','OF','TRT','SLA','BL','BOA','DPA','SIM','CHG'];
const LG_ALL_TYPES=['MPA','OF','TRT','SLA','BL','BOA','DPA','EUT','PN','SIM','RS','PF','SR','INV','CI'];
const LG_LANG2={ru:{en:'Russian',l2:'русском',name:'Русский',loc:'ru-RU'},uk:{en:'Ukrainian',l2:'українській',name:'Українська',loc:'uk-UA'}};
const LG_CLAUSE={ru:(n)=>`Документ составлен на английском и ${n} языках. При расхождении текстов преимущественную силу имеет английский текст.`,
 uk:(n)=>`Документ складено англійською та ${n} мовами. У разі розбіжностей переважну силу має текст англійською мовою.`};
const LG_REPL={en:(v,d,e)=>`This version replaces version ${v} from ${d}.${e?` Effective date: ${e}.`:''}`,
 ru:(v,d,e)=>`Настоящая версия заменяет версию ${v} от ${d}.${e?` Дата вступления в силу: ${e}.`:''}`,
 uk:(v,d,e)=>`Ця версія замінює версію ${v} від ${d}.${e?` Дата набрання чинності: ${e}.`:''}`};
const LG_SENSITIVE=['P_NAME','P_ADDR_EN','P_ADDR_L2','P_SIGNATORY','P_TITLE_EN','P_TITLE_L2','P_TITLE_L2_GEN','P_AUTHORITY','P_AUTHORITY_FILE',
 'P_BANK_BENEFICIARY','P_BANK_IBAN','P_BANK_NAME','P_BANK_ADDR','P_BANK_SWIFT','P_BANK_INTERMEDIARY'];
const LG_FREE_AFTER=['P_EMAIL_OPS','P_EMAIL_LEGAL','P_EMAIL_FIN','P_EMAIL_SUPPORT','P_PHONE','P_DNS_CONTACT','P_LOGO','P_BRANDBOOK'];
const LG_KYC=['registry','ubo','sanctions','territories','authority','bank'];
const LG_ST_TONE={draft:'',issued:'warn',signed_partner:'info',signed_both:'ok',acknowledged:'ok',superseded:'',terminated:'bad'};
const LG_PAGE={w:794,h:1123};
// derived/system keys never asked in the questionnaire
const LG_COUNTRY_PARTNER=['LAUNCH_DATE','RETAIL_CUR','DELIVERY_ADDR','IMPORTER','INIT_SIMS','INIT_KEYS','INIT_TOKENS','ANNUAL_TARGET','OF_EXCEPTIONS_EN','OF_EXCEPTIONS_L2'];
const LG_COUNTRY_OTA=['CC_NAME_L2','CC_NAME_FULL_EN','CC_NAME_FULL_L2','CC_NAME_LOC_L2','CC_EXCLUSION_EN','CC_EXCLUSION_L2','EUT_LANGS','EUT_CONSUMER_AUTH','EUT_DP_AUTH','EUT_WITHDRAWAL','EUT_OTHER'];
const LG_DEV_COLS=['DEV_BRAND','DEV_MODEL','DEV_HW','DEV_FW','DEV_PLAN','DEV_MB','DEV_SIM'];
const LG_TM_COLS=['TM_MARK','TM_REGNO','TM_COUNTRIES','TM_CLASSES'];
const LG_PLANKEY={light:'LIGHT',std:'STANDARD',prem:'PREMIUM'};
ICONS.lg_pen='<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"/>';
ICONS.lg_hist='<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>';
ICONS.lg_diff='<path d="M12 3v18M5 8h4M7 6v4M15 16h4"/><rect x="2" y="3" width="20" height="18" rx="2"/>';

/* ---------- state ---------- */
function lg_st(){if(!S.lg||typeof S.lg!=='object')S.lg={};const L=S.lg;
 ['tpl','kyc','reviewNa'].forEach(k=>{if(!L[k]||typeof L[k]!=='object')L[k]={};});
 ['changes','pub','reminders','notices','tasks'].forEach(k=>{if(!Array.isArray(L[k]))L[k]=[];});
 if(!S.form)S.form={};if(!S.docs)S.docs=[];return L;}
function lg_docs(){if(!S.docs)S.docs=[];return S.docs;}
function lg_doc(id){return lg_docs().find(d=>d.id===id)||null;}
function lg_demo(){try{return legalDemo();}catch(e){return null;}}
let lg__km=null;
function lg_meta(k){if(!lg__km){lg__km={};let arr=[];try{arr=LEGAL_KEYS;}catch(e){}(arr||[]).forEach(m=>{lg__km[m.key]=m;});}
 if(lg__km[k])return lg__km[k];if(/^OTA_(VAT|REP)_[A-Z]{2}$/.test(k))return{key:k,src:'ota',req:'na'};return null;}
function lg_baseTpl(type){try{return LEGAL_TPL[type]||null;}catch(e){return null;}}
function lg_l2(){const v=lg_fval('LANG2');return (v&&LG_LANG2[v])?v:((S.org&&S.org.lang2&&LG_LANG2[S.org.lang2])?S.org.lang2:'ru');}
function lg_actor(){return actor()||{};}
function lg_role(){return lg_actor().role||'';}
function lg_isOta(){return !!(ROLES[lg_role()]&&ROLES[lg_role()].side==='ota');}

/* ---------- questionnaire values (S.form) ---------- */
function lg_form(k){return (S.form||{})[k]||null;}
function lg_fval(k){const f=lg_form(k);if(!f||f.status==='na')return null;const v=f.value;if(v==null)return null;
 if(Array.isArray(v))return v.length?v:null;if(typeof v==='boolean')return v;const s=String(v).trim();return s?s:null;}
function lg_fset(k,v,o){o=o||{};const f=S.form[k]||(S.form[k]={value:null,status:'empty',comment:'',by:'',at:''});const old=f.value;
 f.value=v;if(f.status!=='na'||o.clearNa)f.status=(Array.isArray(v)?v.length:(v!=null&&String(v).trim()!==''))?'filled':'empty';f.by=actorName();f.at=iso(now());
 if(!o.silent&&JSON.stringify(old)!==JSON.stringify(v))lg_audit('form.edit',k,{from:lg_short(old),to:lg_short(v)});return f;}
function lg_short(v){if(v==null)return '';if(Array.isArray(v))return v.length+' rows';const s=String(v);return s.length>80?s.slice(0,77)+'…':s;}
function lg_ccKey(k,cc){return k+'@'+cc;}

/* ---------- templates & versions (base = LEGAL_TPL v3; later versions are patches in S.lg.tpl[TYPE]) ---------- */
function lg_tplVersions(type){const b=lg_baseTpl(type);if(!b)return [];const L=lg_st();
 return [{ver:b.ver,n:+String(b.ver).replace(/^.*-v/,''),effective:b.effective,cls:b.cls,status:'released',base:true,changes:{},note:''}].concat(L.tpl[type]||[]);}
function lg_tplCurVer(type){const vs=lg_tplVersions(type).filter(v=>v.status==='released');return vs.length?vs[vs.length-1].ver:null;}
const lg__tc={};
function lg_tpl(type,ver){const b=lg_baseTpl(type);if(!b)return null;const vs=lg_tplVersions(type);ver=ver||lg_tplCurVer(type);
 const idx=vs.findIndex(v=>v.ver===ver);const upto=idx<0?vs.filter(v=>v.status==='released').length-1:idx;
 const key=type+'|'+ver+'|'+JSON.stringify(vs.slice(1,upto+1).map(v=>v.changes));if(lg__tc[type]&&lg__tc[type].key===key)return lg__tc[type].t;
 const ch={};for(let i=1;i<=upto;i++)Object.assign(ch,vs[i].changes||{});
 const t2=Object.assign({},b,{ver:vs[upto].ver,effective:vs[upto].effective,cls:vs[upto].cls||b.cls,blocks:b.blocks.map(bl=>ch[bl.id]?Object.assign({},bl,ch[bl.id]):bl)});
 lg__tc[type]={key,t:t2};return t2;}
function lg_tplTitle(type,lang){const b=lg_baseTpl(type);if(type==='CHG')return lang==='en'?'Notice of Change of Partner Details':(lang==='uk'?'Повідомлення про зміну реквізитів партнера':'Уведомление об изменении реквизитов Партнёра');
 return b?(lang==='en'?b.title.en:(b.title[lang]||b.title.ru||b.title.en)):type;}
// built-in notice template (change of partner details) — wording for OTA Legal to approve
const LG_CHG_TPL={type:'CHG',docNo:'—',title:{en:'Notice of Change of Partner Details',ru:'Уведомление об изменении реквизитов Партнёра'},ver:'T-CHG-v1',effective:'2026-11-06',cls:'A',blocks:[
 {id:'CHG-title',kind:'heading',en:'NOTICE OF CHANGE OF PARTNER DETAILS',ru:'УВЕДОМЛЕНИЕ ОБ ИЗМЕНЕНИИ РЕКВИЗИТОВ ПАРТНЁРА'},
 {id:'CHG-ref',kind:'para',en:'Ref. {{DOC_NO}}\nThis document is made in English and {{LANG2_NAME_EN}}. In case of any discrepancy, the English version prevails.',ru:'№ {{DOC_NO}}\nДокумент составлен на английском и {{LANG2_NAME_L2}} языках. При расхождении текстов преимущественную силу имеет английский текст.'},
 {id:'CHG-p1',kind:'para',en:'Date: {{DATE}}',ru:'Дата: {{DATE}}'},
 {id:'CHG-p2',kind:'para',en:'Under the CONNECT FOR BRANDS Master Partner Agreement No. {{DOC_NO_MPA}} dated {{MPA_DATE}} between {{OTA_NAME}} ("OTA") and {{P_NAME}} ("Partner"), Partner notifies OTA of the following change of its details, effective {{EFFECTIVE_DATE}}:',
  ru:'В рамках Рамочного партнёрского соглашения CONNECT FOR BRANDS № {{DOC_NO_MPA}} от {{MPA_DATE}} между {{OTA_NAME}} («OTA») и {{P_NAME}} («Партнёр») Партнёр уведомляет OTA о следующем изменении своих реквизитов с {{EFFECTIVE_DATE}}:'},
 {id:'CHG-t1',kind:'table',rows:[[{en:'Detail',ru:'Реквизит',bi:true},{en:'Previous',ru:'Прежнее значение',bi:true},{en:'New',ru:'Новое значение',bi:true}],
  [{en:'{{CHG_LABEL}}',ru:'{{CHG_LABEL}}'},{en:'{{CHG_OLD}}',ru:'{{CHG_OLD}}'},{en:'{{CHG_NEW}}',ru:'{{CHG_NEW}}'}]],repeat:{row:1,list:'CHG_LIST'}},
 {id:'CHG-p3',kind:'para',en:'Documents signed before this notice remain in force and are not reissued. From the effective date the new details apply to all documents, notices and invoices under the Master Agreement.',
  ru:'Документы, подписанные до настоящего уведомления, сохраняют силу и не переоформляются. С даты вступления в силу новые реквизиты применяются ко всем документам, уведомлениям и счетам по Рамочному соглашению.'},
 {id:'CHG-h1',kind:'heading',en:'Signature',ru:'Подпись'},
 {id:'CHG-sig1',kind:'signature',rows:[[{en:'Company',ru:'Компания',bi:true},{en:'{{P_NAME}}',ru:'{{P_NAME}}'}],[{en:'Name',ru:'ФИО',bi:true},{en:'{{P_SIGNATORY}}',ru:'{{P_SIGNATORY}}'}],
  [{en:'Title',ru:'Должность',bi:true},{en:'{{P_TITLE_EN}}',ru:'{{P_TITLE_L2}}',bi:true}],[{en:'Signature',ru:'Подпись',bi:true},{en:'',ru:''}],[{en:'Date',ru:'Дата',bi:true},{en:'____ / ____ / 20__',ru:'____ / ____ / 20__'}]]}]};
function lg_tplFor(type,ver){return type==='CHG'?LG_CHG_TPL:lg_tpl(type,ver);}
// a language can be chosen as LANG2 only if every package template is fully translated into it
function lg_langComplete(l){return ['MPA','OF','TRT','SLA','BL','BOA','DPA','SIM','EUT','PN'].every(tp=>{const tt=lg_tpl(tp);if(!tt)return false;
 return tt.blocks.every(b=>{if(b.rows)return b.rows.every(r=>r.every(c=>!String(c.en||'').trim()||String(c[l]||'').trim()));return !String(b.en||'').trim()||String(b[l]||'').trim();});});}
function lg_lang2Options(){return Object.keys(LG_LANG2).map(l=>({l,ok:LANG2_AVAILABLE.includes(l)&&lg_langComplete(l)}));}

/* ---------- formatting ---------- */
function lg_fmtInt(n,lang){const x=Math.round(+n);if(!isFinite(x))return String(n);const s=String(Math.abs(x)).replace(/\B(?=(\d{3})+(?!\d))/g,lang==='en'?',':' ');return (x<0?'-':'')+s;}
function lg_fmtUsd(n,lang){const x=+n;if(!isFinite(x))return String(n);const [i,d]=Math.abs(x).toFixed(2).split('.');return (x<0?'-':'')+i.replace(/\B(?=(\d{3})+(?!\d))/g,lang==='en'?',':' ')+'.'+d;}
function lg_fmtDate(v,lang){if(!v)return '';const d=new Date(v);if(isNaN(d))return String(v);const loc=lang==='en'?'en-GB':(LG_LANG2[lang]?LG_LANG2[lang].loc:'ru-RU');
 return d.toLocaleDateString(loc,{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).replace(/\s?(г|р)\.$/,'');}
function lg_fmtUtc(v){const d=new Date(v);return d.getUTCFullYear()+'-'+pad(d.getUTCMonth()+1)+'-'+pad(d.getUTCDate())+' '+pad(d.getUTCHours())+':'+pad(d.getUTCMinutes())+' UTC';}
// put KEY (EN form) and KEY_L2 (LANG2 form, only when different) into V
function lg_put(V,k,raw,fmt,l2){if(raw==null||raw==='')return;let en=raw,ll=raw;
 if(fmt==='int'&&isFinite(+raw)&&String(raw).trim()!==''){en=lg_fmtInt(raw,'en');ll=lg_fmtInt(raw,l2);}
 else if(fmt==='usd'&&isFinite(+raw)&&String(raw).trim()!==''){en=lg_fmtUsd(raw,'en');ll=lg_fmtUsd(raw,l2);}
 else if(fmt==='date'&&/^\d{4}-\d{2}-\d{2}/.test(String(raw))){en=lg_fmtDate(raw,'en');ll=lg_fmtDate(raw,l2);}
 else if(fmt==='pct'&&isFinite(+raw)){en=String(+(+raw).toFixed(2));ll=en;}
 V[k]=en;if(ll!==en&&!/_(EN|L2)$/.test(k))V[k+'_L2']=ll;}
function lg_truthy(v){if(v==null||v===false||v===0)return false;if(Array.isArray(v))return v.length>0;const s=String(v).trim();return !!s&&s!=='0'&&s.toLowerCase()!=='false'&&s.toUpperCase()!=='N/A';}

/* ---------- country data ---------- */
function lg_ccDemo(cc){const D=lg_demo();return (D&&D.countries&&D.countries[cc])||{};}
function lg_ccName(cc,lang){try{return new Intl.DisplayNames([lang==='en'?'en':(LG_LANG2[lang]?LG_LANG2[lang].loc:lang)],{type:'region'}).of(cc)||cc;}catch(e){return cc;}}
function lg_ccDefault(cc,k){const D=lg_ccDemo(cc);const l2=lg_l2();
 if(D[k]!=null&&D[k]!==''&&l2==='ru')return D[k];
 if(k==='CC_NAME_L2'||k==='CC_NAME_FULL_L2'||k==='CC_NAME_LOC_L2')return lg_ccName(cc,l2);
 if(k==='CC_NAME_FULL_EN')return D.CC_NAME_FULL_EN||lg_ccName(cc,'en');
 if(D[k]!=null&&D[k]!==''&&!/_L2$/.test(k))return D[k];return null;}
function lg_ccVal(cc,k){const f=lg_form(lg_ccKey(k,cc));if(f){if(f.status==='na')return null;const v=lg_fval(lg_ccKey(k,cc));if(v!=null)return v;if(f.status==='filled')return null;}
 return LG_COUNTRY_OTA.includes(k)?lg_ccDefault(cc,k):null;}
function lg_devices(cc,all){const v=lg_fval(lg_ccKey('DEVICES',cc));const arr=Array.isArray(v)?v:[];return all?arr:arr.filter(d=>d.ok);}
function lg_plFor(cc,ver){if(!cc)return null;const vs=((S.priceLists||{})[cc]||[]);if(ver!=null){const x=vs.find(v=>v.ver===ver);if(x)return x;}return priceList(cc);}

/* ---------- lg_values: the variable map for rendering ---------- */
function lg_values(ctx){ctx=ctx||{};const V={};const NA=new Set();const cc=ctx.cc||null;const l2=ctx.lang2||lg_l2();
 Object.defineProperty(V,'__na',{value:NA,enumerable:false});
 // OTA data: empty = N/A automatically
 const okeys=new Set(otaKeys());Object.keys(S.ota||{}).forEach(k=>okeys.add(k));
 okeys.forEach(k=>{const v=otaVal(k);if(v!=null)V[k]=v;else NA.add(k);});
 if(S.org&&S.org.code)V.P_CODE=S.org.code;
 // partner questionnaire (status 'na' or empty N/A-able → absent)
 Object.keys(S.form||{}).forEach(k=>{if(k.includes('@'))return;const f=S.form[k];if(!f)return;if(f.status==='na'){NA.add(k);return;}const v=lg_fval(k);if(v==null)return;
  const m=lg_meta(k);if(Array.isArray(v))V[k]=v.map(it=>Object.assign({},it));else lg_put(V,k,v,m&&m.format,l2);});
 // derived flags
 const tm=V.P_TM_OWNER_IS_PARTNER;if(tm==='yes'||tm===true)V.BRAND_DOC_05A=true;if(tm==='no'||tm===false)V.BRAND_DOC_05B=true;
 if(V.P_AUTHORITY==='director')V.P_AUTHORITY='Director (articles of association)';
 V.LANG2=l2;V.LANG2_NAME_EN=LG_LANG2[l2].en;V.LANG2_NAME_L2=LG_LANG2[l2].l2;
 if(cc){V.CC=cc;V.CC_NAME_EN=lg_ccDemo(cc).CC_NAME_EN||ctyNameEn(cc);
  LG_COUNTRY_OTA.forEach(k=>{const v=lg_ccVal(cc,k);if(v!=null)lg_put(V,k,v,null,l2);else NA.add(k);});
  if(!V.CC_NAME_L2)V.CC_NAME_L2=lg_ccName(cc,l2);
  V.CC_NAME_UPPER_EN=String(V.CC_NAME_EN).toUpperCase();V.CC_NAME_UPPER_L2=String(V.CC_NAME_L2).toLocaleUpperCase(LG_LANG2[l2].loc);
  LG_COUNTRY_PARTNER.forEach(k=>{const v=lg_ccVal(cc,k);const m=lg_meta(k);if(v!=null)lg_put(V,k,v,m&&m.format,l2);else if(k.startsWith('OF_EXC'))NA.add(k);});
  if(!V.OF_EXCEPTIONS_EN)V.OF_EXCEPTIONS_NONE=true;
  const devs=lg_devices(cc);if(devs.length)V.DEVICES=devs.map(d=>{const o={};LG_DEV_COLS.forEach(c=>{if(d[c]!=null&&String(d[c]).trim()!=='')o[c]=String(d[c]);});return o;});
  const pl=lg_plFor(cc,ctx.priceVer);
  if(pl){V.__priceVer=pl.ver;lg_put(V,'PRICE_KEY',pl.key,'usd',l2);PLANS.forEach(p=>{const P=LG_PLANKEY[p];TERMS.forEach(tm2=>lg_put(V,`TOK_${P}_${tm2}`,pl.tokens[p]&&pl.tokens[p][tm2],'usd',l2));lg_put(V,'RET_'+P,pl.retained[p],'usd',l2);});
   const fee=+(pl.fee||0);if(fee>0)lg_put(V,'FEE_PCT',r2(fee*100),'pct',l2);else{NA.add('FEE_PCT');}}
  if(!V.FEE_PCT)V.FEE_NONE=true;
  const of=ctx.docOf||lg_latestNo('OF',cc);if(of)V.DOC_NO_OF=of;
 }
 // system keys
 const date=ctx.date||iso(now());lg_put(V,'DATE',date,'date',l2);
 if(ctx.effective)lg_put(V,'EFFECTIVE_DATE',ctx.effective,'date',l2);
 if(ctx.docNo){V.DOC_NO=ctx.docNo;const m=String(ctx.docNo).match(/(\d{4}-\d{4,6})$/);if(m)V.DOC_SEQ=m[1];}
 const mpa=ctx.mpa||lg_mpaRef();if(mpa){V.DOC_NO_MPA=mpa.number;if(mpa.date)lg_put(V,'MPA_DATE',mpa.date,'date',l2);}
 if(ctx.docVer)V.DOC_VER=ctx.docVer;
 // ctx.extra (ops documents etc.)
 Object.keys(ctx.extra||{}).forEach(k=>{const v=ctx.extra[k];if(v==null||v===''){const m=lg_meta(k);if(m&&(m.req==='na'))NA.add(k);delete V[k];return;}
  const m=lg_meta(k);if(Array.isArray(v))V[k]=v;else lg_put(V,k,v,m&&m.format,l2);});
 return V;}
// the MPA the document refers to: the package MPA (draft or live)
function lg_mpaRef(){const ds=lg_docs().filter(d=>d.type==='MPA'&&d.status!=='terminated');const live=ds.filter(d=>d.status!=='draft'&&d.status!=='superseded').sort((a,b)=>b.ver-a.ver)[0]||ds.filter(d=>d.status==='draft')[0];
 return live?{number:live.number,date:live.date||live.createdAt}:null;}
function lg_latestNo(type,cc){const d=lg_inForce(type,cc)||lg_docs().filter(x=>x.type===type&&(!cc||x.cc===cc)&&x.status!=='terminated').sort((a,b)=>b.ver-a.ver)[0];return d?d.number:null;}

/* ---------- rendering engine ---------- */
const LG_V0='\u0001',LG_V1='\u0002',LG_MISS='\u0003',LG_MISS_E='\u0004',LG_NA='\u0005';
// absent key: 'na' (remove line/row), 'blank' (empty), 'missing' (blocks issue)
function lg_absent(k,V){if(V.__na&&V.__na.has(k))return 'na';const m=lg_meta(k);if(!m)return /^RS_[A-D]_/.test(k)?'blank':'missing';
 if(m.src==='ota')return 'na';if(m.req==='optional')return 'blank';if(m.req==='na'&&m.src!=='partner')return 'na';return 'missing';}
function lg_get(V,k,col,scope,st){const look=(o)=>{if(!o)return undefined;
  if(col==='l2'){if(o[k+'_L2']!=null){st&&st.used.add(k+'_L2');return o[k+'_L2'];}}else if(o[k+'_EN']!=null&&!/_(EN|L2)$/.test(k)){st&&st.used.add(k+'_EN');return o[k+'_EN'];}
  if(o[k]!=null){st&&st.used.add(k);return o[k];}return undefined;};
 const a=look(scope);return a!==undefined?a:look(V);}
function lg_sub(str,col,V,st,scope){if(!str)return '';
 str=String(str).replace(/\[\[([A-Z0-9_]+)\|([\s\S]*?)\]\]/g,(m,k,frag)=>{st.used.add(k);return lg_truthy(lg_get(V,k,col,scope,st))?frag:'';});
 return str.replace(/\{\{([A-Z0-9_]+)\}\}/g,(m,k)=>{const v=lg_get(V,k,col,scope,st);
  if(v!=null&&v!==''&&v!==true&&!Array.isArray(v)){const mm=lg_meta(k);const hl=!mm||!['ota','system'].includes(mm.src);return hl?LG_V0+String(v)+LG_V1:String(v);}
  const kind=lg_absent(k,V);if(kind==='na')return LG_NA;if(kind==='blank')return '';st.missing.add(k);return LG_MISS+k+LG_MISS_E;});}
// drop lines that contain an N/A value (no empty brackets, no empty lines)
function lg_lines(s){if(!s)return '';return s.split('\n').filter(l=>!l.includes(LG_NA)).join('\n').replace(/\n{3,}/g,'\n\n').trim();}
function lg_txt(s){return String(s||'').replace(/[\u0001\u0002]/g,'').replace(/\u0003([A-Z0-9_]+)\u0004/g,'[$1]').replace(/\u0005/g,'');}
function lg_htm(s,draft){return esc(s||'').replace(/\u0001/g,draft?'<mark class="lgd-v">':'').replace(/\u0002/g,draft?'</mark>':'')
 .replace(/\u0003([A-Z0-9_]+)\u0004/g,'<span class="lgd-miss" title="missing">[$1]</span>').replace(/\u0005/g,'').replace(/\n/g,'<br>');}
function lg_docLabel(type,cc){const n=type==='OF'&&cc?'02-'+cc:((lg_baseTpl(type)||{}).docNo||'—');return n;}
function lg_header(type,cc,number,tplVer,V){const name=(V&&V.OTA_NAME)||'OTA TECHNOLOGY DMCC';const title=lg_tplTitle(type,'en')+(type==='OF'&&cc?' – '+(lg_ccDemo(cc).CC_NAME_EN||ctyNameEn(cc)):'');
 return [name,'CONNECT FOR BRANDS',type==='CHG'?'Notice':('Doc '+lg_docLabel(type,cc)+' of 14'),title,number||'[number]',tplVer].filter(Boolean).join(' · ');}
function lg_footer(date,number,V){const y=new Date(date||now()).getUTCFullYear();const l2=(V&&V.LANG2)||'ru';const c2={ru:'Конфиденциально',uk:'Конфіденційно'}[l2];return `© ${y} ${(V&&V.OTA_NAME)||'OTA TECHNOLOGY DMCC'}. All rights reserved · Confidential`+(c2?' · '+c2:'')+(number?' · '+number:'');}
function lg_render(type,ctx){ctx=ctx||{};const tpl=ctx.tpl||lg_tplFor(type,ctx.tplVer);const l2=ctx.lang2||lg_l2();const draft=!!ctx.draft;
 const out={html:'',text:'',missing:[],blocks:[],error:null,untranslated:[],title:'',header:'',footer:'',number:ctx.docNo||'',used:[]};
 if(!tpl){out.error='no_template';out.html=`<div class="note bad">${esc(t('lg.e.noTpl',{t:type}))}</div>`;return out;}
 out.title=(tpl.title&&tpl.title.en)||type;out.tplVer=tpl.ver;
 const V=ctx.vals?lg_frozenMap(ctx.vals):lg_values(ctx);
 const st={missing:new Set(),used:new Set()};const pub=ctx.public||null;
 // ТЗ §10.10: a paragraph without LANG2 translation stops generation
 if(!pub){tpl.blocks.forEach(b=>{const bad=b.rows?b.rows.some(r=>r.some(c=>String(c.en||'').trim()&&!String(c[l2]||'').trim())):(String(b.en||'').trim()&&!String(b[l2]||'').trim());if(bad)out.untranslated.push(b.id);});
  if(out.untranslated.length){out.error='no_translation';out.html=`<div class="note bad lg-genstop">${icon('alert','sm')}<div><b>${t('lg.e.stopT')}</b><br>${esc(t('lg.e.stopD',{l:LG_LANG2[l2].en,ids:out.untranslated.join(', ')}))}</div></div>`;return out;}}
 const colOf=c=>c==='en'?'en':l2;
 const rows=[];const textParts=[];
 st.used.add('OTA_NAME');const header=lg_header(type,ctx.cc,ctx.docNo,tpl.ver,V),footer=lg_footer(ctx.date,ctx.docNo,V);out.header=header;out.footer=footer;
 if(!pub)textParts.push(header);
 const addPara=(id,kind,en,ll,cls)=>{en=lg_lines(en);ll=lg_lines(ll);if(!lg_txt(en).trim()&&!lg_txt(ll).trim())return;
  out.blocks.push({id,kind,en:lg_txt(en),l2:lg_txt(ll)});textParts.push(lg_txt(en));if(!pub)textParts.push(lg_txt(ll));
  if(pub){const s=pub==='en'?en:ll;rows.push(`<div class="lgd-r lgd-one lgd-${kind} ${cls||''}" data-b="${esc(id)}"><div>${lg_htm(s,false)}</div></div>`);return;}
  rows.push(`<div class="lgd-r lgd-${kind} ${cls||''}" data-b="${esc(id)}"><div class="en" lang="en">${lg_htm(en,draft)}</div><div class="l2" lang="${l2}">${lg_htm(ll,draft)}</div></div>`);};
 let refSeen=false;
 tpl.blocks.forEach(b=>{
  if(b.cond&&!lg_truthy(lg_get(V,b.cond,'en',null,st)))return;
  if(pub&&/-ref$/.test(b.id))return;
  if(b.kind==='table'||b.kind==='signature'){const r=lg_table(b,V,st,l2,draft,ctx,pub);if(!r)return;rows.push(r.html);out.blocks.push({id:b.id,kind:b.kind,en:r.text,l2:r.text});textParts.push(r.text);return;}
  const cls=b.kind==='annex'?'lgd-break':(/-title$/.test(b.id)?'lgd-title':'');
  addPara(b.id,b.kind,lg_sub(b.en,'en',V,st),lg_sub(b[colOf('l2')],'l2',V,st),cls);
  if(/-ref$/.test(b.id)){refSeen=true;
   const hasClause=String(b.en||'').includes('This document is made in English');
   if(!hasClause)addPara(b.id+'-lang','para',`This document is made in English and ${LG_LANG2[l2].en}. In case of any discrepancy, the English version prevails.`,LG_CLAUSE[l2](LG_LANG2[l2].l2));
   if(ctx.replaces&&!pub){const r=ctx.replaces;addPara(b.id+'-repl','para lgd-repl',LG_REPL.en(r.ver,lg_fmtDate(r.date,'en'),ctx.effective?lg_fmtDate(ctx.effective,'en'):''),(LG_REPL[l2]||LG_REPL.ru)(r.ver,lg_fmtDate(r.date,l2),ctx.effective?lg_fmtDate(ctx.effective,l2):''));}}
 });
 if(!refSeen&&!pub)addPara('lang','para',`This document is made in English and ${LG_LANG2[l2].en}. In case of any discrepancy, the English version prevails.`,LG_CLAUSE[l2](LG_LANG2[l2].l2));
 if(!pub)textParts.push(footer);
 out.missing=[...st.missing];out.used=[...st.used];out.text=textParts.join('\n');
 const cert=ctx.cert?lg_certRows(ctx.cert):'';
 out.html=pub?`<article class="lgd lgd-pub" lang="${pub}"><div class="lgd-flow">${rows.join('')}</div></article>`
  :`<article class="lgd ${draft?'lgd-draft':''}" data-paginate="1" data-header="${esc(header)}" data-footer="${esc(footer)}"><div class="lgd-flow">${rows.join('')}${cert}</div></article>`;
 out.__V=V;return out;}
function lg_frozenMap(vals){const V=Object.assign({},vals);const NA=new Set(vals.__naList||[]);delete V.__naList;Object.defineProperty(V,'__na',{value:NA,enumerable:false});return V;}
// tables & signature blocks
function lg_table(b,V,st,l2,draft,ctx,pub){let rows=b.rows.map((r,i)=>({cells:r,i,scope:null}));
 if(b.repeat){const lst=lg_get(V,b.repeat.list,'en',null,st);const arr=Array.isArray(lst)?lst:[];const ri=b.repeat.row;
  const tplRow=rows.find(r=>r.i===ri);const exp=arr.map(item=>({cells:tplRow.cells,i:ri,scope:lg_itemScope(item,l2)}));
  if(!arr.length&&lg_absent(b.repeat.list,V)==='missing')st.missing.add(b.repeat.list);
  rows=rows.filter(r=>r.i!==ri);rows.splice(ri,0,...exp);}
 if(b.rowCond){Object.keys(b.rowCond).forEach(ix=>{const k=b.rowCond[ix];if(!lg_truthy(lg_get(V,k,'en',null,st)))rows=rows.filter(r=>r.scope||r.i!==+ix);});}
 const sigParty=b.kind==='signature'?(b.rows[0]||[]).map(c=>/OTA_NAME/.test(c.en||'')?'ota':/P_TM_OWNER_NAME/.test(c.en||'')?'owner':/P_NAME/.test(c.en||'')?'partner':null):null;
 const sigs=(ctx.signatures||[]);
 const outRows=[];const txt=[];
 rows.forEach((r,ri)=>{const lbl=String((r.cells[0]||{}).en||'');let naRow=false;
  const cells=r.cells.map((c,ci)=>{let en=lg_sub(c.en,'en',V,st,r.scope),ll=lg_sub(c[l2]!=null?c[l2]:c.en,'l2',V,st,r.scope);
   if(en.includes(LG_NA)||ll.includes(LG_NA)){naRow=true;}
   let h,tx;if(c.bi){h=lg_htm(en,draft)+' / '+lg_htm(ll,draft);tx=lg_txt(en)+' / '+lg_txt(ll);}
   else if(String(c.en||'')===String(c[l2]!=null?c[l2]:c.en)){h=lg_htm(en,draft);tx=lg_txt(en);}
   else{h=lg_htm(en,draft)+`<br><span class="l2c">${lg_htm(ll,draft)}</span>`;tx=lg_txt(en)+' / '+lg_txt(ll);}
   if(pub&&!c.bi){h=lg_htm(pub==='en'?en:ll,false);tx=lg_txt(pub==='en'?en:ll);}else if(pub&&c.bi){h=lg_htm(pub==='en'?en:ll,false);}
   // signatures are shown on the page but are not part of the canonical (hashed) text frozen at issue
   if(sigParty&&ci>0){const party=sigParty[ci];const sg=party&&sigs.find(s=>s.party===party);
    if(lbl==='Signature'&&sg)h=`<div class="lgd-sig">${icon('check','sm')}<span>Signed electronically by ${esc(sg.name)}, ${esc(sg.title||'')}, ${esc(lg_fmtUtc(sg.at))}, ID ${esc(sg.id)}</span></div>`;
    else if(lbl==='Signature'&&party==='owner'&&ctx.scan)h=`<div class="lgd-sig">${icon('check','sm')}<span>Signed scan: ${esc(ctx.scan.file)}</span></div>`;
    else if(lbl==='Date'&&sg){const d=new Date(sg.at);h=esc(pad(d.getUTCDate())+' / '+pad(d.getUTCMonth()+1)+' / '+d.getUTCFullYear());}}
   return{html:h,text:tx};});
  if(naRow)return;
  const isHead=ri===0&&b.kind==='table';
  outRows.push(`<tr>${cells.map((c,ci)=>isHead?`<th>${c.html}</th>`:`<td${sigParty&&ci===0?' class="lgd-sl"':''}>${c.html}</td>`).join('')}</tr>`);
  txt.push(cells.map(c=>c.text).join(' | '));});
 if(!outRows.length)return null;
 return{html:`<div class="lgd-r lgd-full lgd-${b.kind}" data-b="${esc(b.id)}"><table class="lgd-t ${b.kind==='signature'?'lgd-st':''}">${outRows.join('')}</table></div>`,text:txt.join('\n')};}
function lg_itemScope(item,l2){const o={};Object.keys(item||{}).forEach(k=>{if(k==='ok')return;const v=item[k];if(v==null||String(v).trim()==='')return;const m=lg_meta(k);lg_put(o,k,v,m&&m.format,l2);});return o;}

/* ---------- pagination (A4 at 96 dpi) & zoom to fit ---------- */
function lg_paginate(el){if(!el||el.dataset.pg)return;const flow=el.querySelector(':scope > .lgd-flow');if(!flow)return;el.dataset.pg='1';
 const header=el.dataset.header||'',footer=el.dataset.footer||'';const rows=[...flow.children];
 const pages=document.createElement('div');pages.className='lgd-pages';el.appendChild(pages);flow.remove();
 const mk=()=>{const p=document.createElement('section');p.className='lgd-page';p.innerHTML=`<div class="lgd-ph">${esc(header)}</div><div class="lgd-body"></div><div class="lgd-pf"><span>${esc(footer)}</span><span class="lgd-pn"></span></div>`;pages.appendChild(p);return p.querySelector('.lgd-body');};
 let body=mk();
 rows.forEach(r=>{if(r.classList.contains('lgd-break')&&body.children.length)body=mk();body.appendChild(r);
  if(body.scrollHeight>body.clientHeight+1&&body.children.length>1){body.removeChild(r);const prev=body;body=mk();
   const last=prev.lastElementChild;if(last&&(last.classList.contains('lgd-heading')||last.classList.contains('lgd-annex'))&&prev.children.length>1){body.appendChild(last);}body.appendChild(r);}});
 const ps=[...pages.children];ps.forEach((p,i)=>{p.querySelector('.lgd-pn').textContent=`Page ${i+1} / ${ps.length}`;});el.dataset.pages=ps.length;}
function lg_fit(root){$$('.lgd-wrap',root).forEach(w=>{const pg=w.querySelector('.lgd-pages');if(!pg)return;const cs=getComputedStyle(w);const avail=w.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight);
 const z=Math.min(1,avail/LG_PAGE.w);$$('.lgd-pages',w).forEach(x=>{x.style.zoom=z<1?String(Math.max(.3,z)):'';});});}
function lg_paginateAll(root){$$('.lgd[data-paginate]:not([data-pg])',root).forEach(lg_paginate);lg_fit(root);}
HOOKS.afterRender.push(()=>{lg_paginateAll(document);lg_bindScroll();});
window.addEventListener('resize',()=>lg_fit(document));

/* ---------- SHA-256 (WebCrypto; sync fallback for seeding/insecure contexts) ---------- */
function lg_sha256sync(str){const b=new TextEncoder().encode(str);const K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
 const H=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];const l=b.length;const n=((l+9+63)>>6)<<6;const m=new Uint8Array(n);m.set(b);m[l]=0x80;
 const bits=l*8;const dv=new DataView(m.buffer);dv.setUint32(n-4,bits>>>0);dv.setUint32(n-8,Math.floor(bits/4294967296));const w=new Uint32Array(64);const rr=(x,s)=>(x>>>s)|(x<<(32-s));
 for(let o=0;o<n;o+=64){for(let i=0;i<16;i++)w[i]=dv.getUint32(o+i*4);for(let i=16;i<64;i++){const s0=rr(w[i-15],7)^rr(w[i-15],18)^(w[i-15]>>>3),s1=rr(w[i-2],17)^rr(w[i-2],19)^(w[i-2]>>>10);w[i]=(w[i-16]+s0+w[i-7]+s1)>>>0;}
  let [a,b2,c,d,e,f,g,h]=H;for(let i=0;i<64;i++){const S1=rr(e,6)^rr(e,11)^rr(e,25),ch=(e&f)^(~e&g),t1=(h+S1+ch+K[i]+w[i])>>>0,S0=rr(a,2)^rr(a,13)^rr(a,22),mj=(a&b2)^(a&c)^(b2&c),t2=(S0+mj)>>>0;h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b2;b2=a;a=(t1+t2)>>>0;}
  H[0]=(H[0]+a)>>>0;H[1]=(H[1]+b2)>>>0;H[2]=(H[2]+c)>>>0;H[3]=(H[3]+d)>>>0;H[4]=(H[4]+e)>>>0;H[5]=(H[5]+f)>>>0;H[6]=(H[6]+g)>>>0;H[7]=(H[7]+h)>>>0;}
 return H.map(x=>x.toString(16).padStart(8,'0')).join('');}
async function lg_hash(text){try{if(window.crypto&&crypto.subtle){const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(text)));return [...new Uint8Array(buf)].map(x=>x.toString(16).padStart(2,'0')).join('');}}catch(e){}return lg_sha256sync(String(text));}

/* ---------- numbering & audit wrappers ---------- */
function lg_number(type,cc,o){o=o||{};if(type==='CHG'){const P=(S.org&&S.org.code)||'PPP';return `OTA-${P}-CHG-${pad(seqNext(P+':CHG',false,o.peek),3)}`;}
 if(type==='EUT'||type==='PN')return docNo(type,{cc,lang:o.lang,ver:o.ver});return docNo(type,Object.assign({},o,{cc}));}
function lg_audit(action,object,details){const e=audit(action,object,details||{});if(details&&details.hash)e.hash=details.hash;return e;}
function lg_auditAt(action,object,details,at,uid2){const e=lg_audit(action,object,details);if(at)e.ts=at;if(uid2){const u=users().find(x=>x.id===uid2);if(u){e.actor=u.name;e.email=u.email;e.role=u.role;e.ip='203.0.113.'+(10+Object.keys(ROLES).indexOf(u.role));}}return e;}
function lg_ip(role){return '203.0.113.'+(10+Math.max(0,Object.keys(ROLES).indexOf(role||'')));}

/* ---------- documents (S.docs) ---------- */
function lg_docVer(number){const m=String(number||'').match(/-v(\d+)$/);return m?+m[1]:1;}
function lg_newDoc(o){const tp=lg_tplFor(o.type);const d=Object.assign({id:uid('doc'),kind:'pkg',type:'',cc:null,number:'',ver:1,templateVer:tp?tp.ver:null,cls:tp?tp.cls:'A',status:'draft',
  supersedes:null,effective:null,createdAt:iso(now()),createdBy:actorName(),issuedAt:null,date:null,vals:null,hash:null,priceVer:null,lang2:null,signatures:[],kep:[],scan:null,ack:null,decline:null,archived:false},o);
 d.ver=lg_docVer(d.number);lg_docs().push(d);return d;}
function lg_freezeVals(r){const V=r.__V||{};const o={};r.used.forEach(k=>{if(V[k]!=null)o[k]=V[k];});['DOC_NO','DATE','DATE_L2','LANG2','LANG2_NAME_EN','LANG2_NAME_L2','OTA_NAME'].forEach(k=>{if(V[k]!=null)o[k]=V[k];});o.__naList=[...(V.__na||[])];return o;}
function lg_renderDoc(d,o){o=o||{};const prev=d.supersedes?lg_doc(d.supersedes):null;
 const ctx={cc:d.cc,docNo:d.number,date:d.date||iso(now()),tplVer:d.templateVer,priceVer:d.priceVer,effective:d.effective||d.effPlanned||null,lang2:d.lang2||undefined,
  signatures:d.signatures,scan:d.scan,replaces:prev?{ver:'v'+prev.ver,date:prev.date||prev.createdAt}:null,draft:!!o.draft,extra:d.extra||null};
 if(d.vals&&!o.live)ctx.vals=d.vals;
 if(o.cert&&((d.signatures&&d.signatures.length)||d.scan))ctx.cert={d};
 return lg_render(d.type,ctx);}
function lg_isPending(d){return d.status==='issued'||d.status==='signed_partner';}
function lg_inForce(type,cc){const ts=iso(now());return lg_docs().filter(d=>d.type===type&&(!cc||d.cc===cc)&&(d.status==='signed_both'||d.status==='acknowledged')&&(!d.effective||d.effective<=ts))
 .sort((a,b)=>b.ver-a.ver)[0]||null;}
function lg_docRef(type,cc){const d=lg_inForce(type,cc);return d?d.number:null;}
function lg_pkgSpec(){const tm=lg_fval('P_TM_OWNER_IS_PARTNER');return [{type:'MPA'}].concat(orgCountries().map(cc=>({type:'OF',cc})),[{type:'TRT'},{type:'SLA'},{type:tm==='no'?'BOA':'BL'},{type:'DPA'},{type:'SIM'}]);}
function lg_pkgDocs(){const order=['MPA','OF','TRT','SLA','BL','BOA','DPA','SIM'];return lg_docs().filter(d=>d.kind==='pkg'&&d.status!=='terminated').sort((a,b)=>order.indexOf(a.type)-order.indexOf(b.type)||String(a.cc).localeCompare(String(b.cc)));}
function lg_pkgSigned(){const ds=lg_pkgDocs();return ds.length>0&&ds.every(d=>d.status==='signed_both'||d.status==='superseded'||d.status==='acknowledged');}
function lg_pkgStage(){const L=lg_st();const ds=lg_pkgDocs();
 if(!ds.length)return !L.submitted?'form':!L.review?'review':'ready';
 if(ds.some(d=>d.status==='draft'))return 'draft';
 if(lg_pkgSigned())return 'signed';
 const es=ds.filter(d=>d.type!=='BOA');if(es.every(d=>d.status!=='issued'))return 'signed_partner';return 'issued';}
// generate (or refresh) the package drafts — numbers are taken once and never duplicated
function lg_generate(o){o=o||{};const at=o.at||iso(now());const spec=lg_pkgSpec();const made=[],kept=[];
 spec.forEach(s=>{const ex=lg_docs().find(d=>d.kind==='pkg'&&d.type===s.type&&(s.cc?d.cc===s.cc:true)&&d.status!=='terminated');
  if(ex){if(ex.status==='draft'){ex.templateVer=lg_tplCurVer(s.type);ex.updatedAt=at;if(s.type==='OF'){const pl=priceList(s.cc);ex.priceVer=pl?pl.ver:null;}}kept.push(ex);return;}
  const number=lg_number(s.type,s.cc);const pl=s.cc?priceList(s.cc):null;
  made.push(lg_newDoc({type:s.type,cc:s.cc||null,number,kind:'pkg',createdAt:at,priceVer:pl?pl.ver:null}));});
 lg_docs().forEach(d=>{if(d.kind==='pkg'&&d.status==='draft'&&!spec.some(s=>s.type===d.type&&(!s.cc||s.cc===d.cc))){d.status='terminated';d.withdrawnAt=at;lg_audit('doc.withdraw',d.number,{reason:'not in package'});}});
 lg_audit('pkg.generate',(S.org&&S.org.code)||'',{numbers:made.concat(kept).map(d=>d.number),created:made.length});return{made,kept};}
// freeze + hash + status issued (refuses when variables are missing or a paragraph has no LANG2 translation)
// o.sync → returns the result object (seeding); otherwise a Promise (WebCrypto hashing)
function lg_then(v,fn){return v&&typeof v.then==='function'?v.then(fn):fn(v);}
function lg_issueDocs(docs,o){o=o||{};const at=o.at||iso(now());const ok=[],fails=[];
 docs.forEach(d=>{if(d.status!=='draft')return;d.date=at;d.lang2=lg_l2();if(!d.templateVer)d.templateVer=lg_tplCurVer(d.type);if(d.type==='OF'&&d.priceVer==null){const pl=priceList(d.cc);d.priceVer=pl?pl.ver:null;}});
 docs.forEach(d=>{if(d.status!=='draft')return;const r=lg_renderDoc(d,{live:true});if(r.error||r.missing.length)fails.push({d,r});else ok.push({d,r});});
 if(fails.length){docs.forEach(d=>{if(d.status==='draft')d.date=null;});const res={err:fails};return o.sync?res:Promise.resolve(res);}
 const commit=hs=>{ok.forEach((x,i)=>{const d=x.d;d.vals=lg_freezeVals(x.r);d.hash=hs[i];d.textLen=x.r.text.length;d.status='issued';d.issuedAt=at;d.issuedBy=actorName();
   if(o.uid)lg_auditAt('doc.issue',d.number,{hash:d.hash,tpl:d.templateVer,cls:d.cls},at,o.uid);else lg_audit('doc.issue',d.number,{hash:d.hash,tpl:d.templateVer,cls:d.cls});});return{ok:ok.map(x=>x.d)};};
 if(o.sync)return commit(ok.map(x=>lg_sha256sync(x.r.text)));
 return Promise.all(ok.map(x=>lg_hash(x.r.text))).then(commit);}
// signing: one signature (one ID) on every document of the group
function lg_signDocs(docs,party,o){o=o||{};const a=o.user||lg_actor();const at=o.at||iso(now());const sid='SIG-'+rndB32(4)+'-'+rndB32(4);
 docs.forEach(d=>{const sg={party,name:a.name,title:party==='ota'?(otaVal('OTA_TITLE_EN')||a.title||''):(lg_fval('P_TITLE_EN')||a.title||''),email:a.email||'',at,ip:lg_ip(a.role),
   ua:(o.ua||(typeof navigator!=='undefined'?navigator.userAgent:'')).slice(0,160),auth:'E-mail OTP + 2FA',otp:'email',id:sid,viewedAt:o.viewedAt||((S.ui.lg_viewed||{})[d.id])||at};
  d.signatures.push(sg);
  if(party==='partner'){if(d.type==='CHG'){d.status='acknowledged';d.effective=d.effective||at;}else d.status='signed_partner';}
  else{d.status='signed_both';if(!d.effective||(d.sub&&d.sub!=='increase'&&d.effective<at))d.effective=d.effective&&d.effective>at?d.effective:at;}
  if(o.uid)lg_auditAt('doc.sign.'+party,d.number,{sig:sid,hash:d.hash,otp:'email'},at,o.uid);else lg_audit('doc.sign.'+party,d.number,{sig:sid,hash:d.hash,otp:'email'});});
 if(party==='ota'||docs.some(d=>d.type==='CHG'))lg_tick();return sid;}
// status housekeeping: class B auto-effective; previous versions superseded once the new one is in force
function lg_tick(){const ts=iso(now());let ch=false;
 lg_docs().forEach(d=>{if(d.kind==='change'&&d.cls==='B'&&d.status==='issued'&&d.effective&&d.effective<=ts){d.status='acknowledged';d.ack={auto:true,at:d.effective};lg_audit('doc.auto_effective',d.number,{effective:d.effective});ch=true;}});
 lg_docs().forEach(d=>{if(!d.supersedes||!(d.status==='signed_both'||d.status==='acknowledged'))return;if(d.effective&&d.effective>ts)return;const p=lg_doc(d.supersedes);
  if(p&&p.status!=='superseded'&&p.status!=='terminated'){p.status='superseded';p.supersededAt=d.effective||ts;p.supersededBy=d.id;lg_audit('doc.superseded',p.number,{by:d.number});ch=true;}});
 return ch;}
// class-A blocking rule (ТЗ §7): registered in HOOKS.orderBlock
function lg_blockReason(cc){if(!S.org||!S.authed)return null;lg_tick();const ts=iso(now());
 if(!lg_inForce('MPA')||!lg_inForce('OF',cc))return t('lg.block.unsigned',{c:ctyName(cc)});
 const od=lg_docs().find(d=>d.kind==='change'&&d.cls==='A'&&d.type!=='CHG'&&lg_isPending(d)&&d.effective&&d.effective<=ts&&(d.type!=='OF'||d.cc===cc));
 if(od)return t('lg.block.overdue',{n:od.number,d:fmtDate(od.effective),c:ctyName(cc)});return null;}
HOOKS.orderBlock=HOOKS.orderBlock||[];HOOKS.orderBlock.push(lg_blockReason);

/* ---------- changes (ТЗ §7) ---------- */
function lg_detected(){const out=[];if(!lg_inForce('MPA'))return out;
 orgCountries().forEach(cc=>{const ofs=lg_docs().filter(d=>d.type==='OF'&&d.cc===cc&&d.status!=='draft'&&d.status!=='terminated').sort((a,b)=>b.ver-a.ver);const last=ofs[0];const pl=plLatest(cc);
  if(!last){out.push({kind:'country',cc,pl});return;}
  if(pl&&pl.ver>(last.priceVer||0))out.push({kind:'price',cc,pl,last,increase:!!pl.increase});});
 return out;}
function lg_issueOF(cc,o){o=o||{};const det=lg_detected().find(x=>x.cc===cc);if(!det)return{err:'none'};const at=o.at||iso(now());const pl=det.pl;
 let last=det.last||null,sup=last;
 if(last&&lg_isPending(last)){last.status='terminated';last.withdrawnAt=at;lg_audit('doc.withdraw',last.number,{reason:'replaced by a newer price list'});sup=last.supersedes?lg_doc(last.supersedes):null;}
 const number=last?docNo('OF',{base:last.number}):lg_number('OF',cc);const sub=!last?'new_country':(det.increase?'increase':'decrease');
 const eff=sub==='increase'?(pl.from>at?pl.from:iso(addDays(at,PRICE_NOTICE_DAYS))):null;
 const d=lg_newDoc({kind:'change',type:'OF',cc,number,cls:'A',sub,supersedes:sup?sup.id:null,priceVer:pl?pl.ver:null,effective:eff,createdAt:at,templateVer:lg_tplCurVer('OF')});
 return lg_then(lg_issueDocs([d],{at,uid:o.uid,sync:o.sync}),res=>{if(res.err){d.status='terminated';d.withdrawnAt=at;d.archived=true;return res;}
 const L=lg_st();const ch={id:uid('chg'),kind:sub==='new_country'?'country':'price',type:'OF',cc,cls:'A',sub,effective:eff,note:(pl&&pl.note)||'',docIds:[d.id],plVer:pl?pl.ver:null,createdAt:at,by:actorName()};L.changes.unshift(ch);d.changeId=ch.id;
 if(o.uid)lg_auditAt('change.release',number,{cls:'A',sub,cc,effective:eff},at,o.uid);else lg_audit('change.release',number,{cls:'A',sub,cc,effective:eff});return{ok:[d],change:ch};});}
function lg_tplSave(type,changes,o){const L=lg_st();const vs=lg_tplVersions(type);const n=Math.max(...vs.map(v=>v.n||0))+1;const ver='T-'+type+'-v'+n;
 const v={ver,n,changes:changes||{},cls:o.cls||(lg_baseTpl(type)||{}).cls||'B',effective:o.effective,note:o.note||'',status:'draft',createdAt:o.at||iso(now()),by:o.by||actorName()};
 (L.tpl[type]=L.tpl[type]||[]).push(v);lg_audit('tpl.version',ver,{cls:v.cls,effective:v.effective,blocks:Object.keys(v.changes)});return v;}
function lg_tplAffected(type,ver){const live=lg_docs().filter(d=>d.type===type&&!d.archived&&['signed_both','acknowledged','issued','signed_partner'].includes(d.status)&&d.templateVer!==ver);
 return live.filter(d=>!lg_docs().some(x=>x.supersedes===d.id&&x.status!=='terminated'));}
function lg_tplRelease(type,ver,o){o=o||{};const v=lg_tplVersions(type).find(x=>x.ver===ver);if(!v)return{err:'none'};const at=o.at||iso(now());const L=lg_st();
 if(type==='EUT'||type==='PN'){v.status='released';v.releasedAt=at;const made=[];lg_pubCurrent(type).forEach(p=>made.push(lg_pubPublish(type,p.cc,p.lang,{tplVer:ver,note:v.note,at})));
  L.changes.unshift({id:uid('chg'),kind:'template',type,cls:'C',effective:v.effective,note:v.note,docIds:[],pubIds:made.map(p=>p.id),tplVer:ver,createdAt:at,by:actorName()});lg_tplSync(type);lg_audit('change.release',ver,{cls:'C'});return{ok:[],pub:made};}
 const aff=lg_tplAffected(type,ver).filter(d=>d.type!=='BOA');const docs=[];
 aff.forEach(p=>{const number=docNo(p.type,{base:p.number});docs.push(lg_newDoc({kind:'change',type:p.type,cc:p.cc,number,cls:v.cls,sub:'text',supersedes:p.id,priceVer:p.priceVer,effective:v.effective,createdAt:at,templateVer:ver}));});
 // render check first (missing LANG2 translation stops everything)
 const probe=docs.map(d=>lg_renderDoc(d,{live:true})).find(r=>r.error);
 if(probe){docs.forEach(d=>{d.status='terminated';d.withdrawnAt=at;d.archived=true;});return{err:[{r:probe}]};}
 return lg_then(lg_issueDocs(docs,{at,sync:o.sync}),res=>{if(res.err){docs.forEach(d=>{if(d.status==='draft'){d.status='terminated';d.archived=true;}});return res;}
 v.status='released';v.releasedAt=at;lg_tplSync(type);
 const ch={id:uid('chg'),kind:'template',type,cls:v.cls,sub:'text',effective:v.effective,note:v.note,docIds:docs.map(d=>d.id),tplVer:ver,createdAt:at,by:actorName()};L.changes.unshift(ch);docs.forEach(d=>{d.changeId=ch.id;});
 lg_audit('change.release',ver,{cls:v.cls,docs:docs.map(d=>d.number),effective:v.effective});return{ok:docs,change:ch};});}
function lg_tplSync(type){if(S.templates&&S.templates[type]){const tt=lg_tpl(type);S.templates[type]=JSON.parse(JSON.stringify(tt));}}
function lg_reminders(d){if(!d.effective||!lg_isPending(d))return [];const ts=iso(now());const L=lg_st();
 return [30,14,7,1].map(n=>{const at=iso(addDays(d.effective,-n));const man=L.reminders.find(r=>r.docId===d.id&&r.n===n);return{n,at,sent:!!man||at<=ts,manual:man||null};});}
function lg_ack(d,o){o=o||{};const a=lg_actor();const at=o.at||iso(now());d.status='acknowledged';d.ack={at,by:a.name,role:a.role,email:a.email};lg_audit('doc.ack',d.number,{hash:d.hash});lg_tick();}

/* ---------- public documents 07/08 (class C): versions per country + language ---------- */
function lg_pubCurrent(type){return lg_st().pub.filter(p=>p.type===type&&p.status==='current');}
function lg_pubPublish(type,cc,lang,o){o=o||{};const L=lg_st();const at=o.at||iso(now());const cur=L.pub.find(p=>p.type===type&&p.cc===cc&&p.lang===lang&&p.status==='current');
 let ver='1.0';if(cur){const [ma,mi]=cur.ver.split('.').map(Number);ver=o.major?(ma+1)+'.0':ma+'.'+(mi+1);cur.status='superseded';cur.supersededAt=at;}
 const p={id:uid('pub'),type,cc,lang,ver,number:docNo(type,{cc,lang,ver}),tplVer:o.tplVer||lg_tplCurVer(type),publishedAt:at,effective:o.effective||at,notifiedAt:o.notified?at:null,status:'current',note:o.note||'',by:o.by||actorName()};
 L.pub.unshift(p);if(!o.silent)lg_audit('pub.version',p.number,{tpl:p.tplVer});return p;}

/* ---------- change of partner details → OTA check → notice for partner signature ---------- */
function lg_fieldLabel(k,lang){const d=I18N.d[lang]||I18N.d.en;return d['lg.f.'+k]||I18N.d.en['lg.f.'+k]||k;}
function lg_approveDetails(o){o=o||{};const L=lg_st();const rq=L.detailReq;if(!rq||rq.status!=='pending')return null;const at=o.at||iso(now());
 const rows=Object.keys(rq.fields).map(k=>({CHG_LABEL:lg_fieldLabel(k,'en')+' / '+lg_fieldLabel(k,lg_l2()),CHG_OLD:rq.fields[k].old||'—',CHG_NEW:rq.fields[k].new||'—'}));
 Object.keys(rq.fields).forEach(k=>lg_fset(k,rq.fields[k].new,{}));lg_syncOrg();
 const number=lg_number('CHG');const d=lg_newDoc({kind:'notice',type:'CHG',number,cls:'A',createdAt:at,extra:{CHG_LIST:rows,EFFECTIVE_DATE:at}});d.effPlanned=at;
 rq.status='approved';rq.decidedAt=at;rq.decidedBy=actorName();rq.noticeId=d.id;lg_audit('details.approve',number,{fields:Object.keys(rq.fields)});
 return lg_issueDocs([d],{at,sync:o.sync});}

/* ---------- tasks (sidebar badge, signing page) ---------- */
function lg_tasks(side){side=side||(S.admin?'ota':'partner');const L=lg_st();const ds=lg_docs().filter(d=>!d.archived&&d.status!=='terminated');const out=[];
 if(side==='partner'){const pk=lg_pkgDocs().filter(d=>d.status==='issued'&&d.type!=='BOA');if(pk.length)out.push({kind:'sign',key:'pkg',docs:pk});
  ds.filter(d=>d.kind!=='pkg'&&d.status==='issued'&&!(d.kind==='change'&&d.cls==='B')).forEach(d=>out.push({kind:'sign',key:d.id,docs:[d]}));
  ds.filter(d=>d.kind==='change'&&d.cls==='B'&&d.status==='issued').forEach(d=>out.push({kind:'ack',key:d.id,docs:[d]}));
  ds.filter(d=>d.type==='BOA'&&d.status==='issued'&&!d.scan).forEach(d=>out.push({kind:'scan',key:d.id,docs:[d]}));}
 else{const pk=lg_pkgDocs().filter(d=>d.status==='signed_partner');if(pk.length)out.push({kind:'osign',key:'pkg',docs:pk});
  ds.filter(d=>d.kind!=='pkg'&&d.status==='signed_partner').forEach(d=>out.push({kind:'osign',key:d.id,docs:[d]}));
  if(L.submitted&&!L.review)out.push({kind:'review',key:'review',docs:[]});
  if(L.detailReq&&L.detailReq.status==='pending')out.push({kind:'details',key:'details',docs:[]});
  ds.filter(d=>d.decline&&!d.decline.handled).forEach(d=>out.push({kind:'decline',key:d.id,docs:[d]}));
  lg_detected().forEach(x=>out.push({kind:'detected',key:'det_'+x.cc,docs:[],det:x}));}
 return out;}
function lg_groupDocs(key,party){if(key==='pkg')return lg_pkgDocs().filter(d=>d.type!=='BOA'&&d.status===(party==='ota'?'signed_partner':'issued'));const d=lg_doc(key);return d?[d]:[];}
function lg_signCheck(party){const a=lg_actor();if(party==='ota')return can('ota.sign')?'':'role';
 if(a.role!=='p_sign')return 'role';const n=s=>String(s||'').trim().toLowerCase();if(n(a.name)!==n(lg_fval('P_SIGNATORY'))||n(a.title)!==n(lg_fval('P_TITLE_EN')))return 'match';return '';}

/* ---------- print-ready view (A4 pages) ---------- */
function lg_printView(arg,o){o=o||{};let r,title;
 if(arg&&typeof arg==='object'&&arg.html){r=arg;title=arg.number||arg.title||'';}
 else{const d=lg_doc(arg);if(!d){toast(t('lg.e.noDoc'),'bad');return;}r=lg_renderDoc(d,{cert:true,draft:d.status==='draft'&&S.admin});title=d.number;lg_audit('doc.download',d.number,{hash:d.hash||''});}
 modal(esc(title),`<div class="lgd-wrap lg-printwrap">${r.html}</div>`,`<span class="small muted grow lg-noprint">${t('lg.print.hint')}</span>${ui.btn(t('lg.print.go'),{kind:'primary',icon:'printer',act:'lg_doPrint'})}`,{wide:true});
 const m=$('#overlay .modal');if(m)m.classList.add('lg-printmodal');lg_paginateAll($('#overlay'));if(!o.noAuto)setTimeout(lg_doPrint,350);}
function lg_doPrint(){document.body.classList.add('lg-printing');let off=false;const done=()=>{if(off)return;off=true;document.body.classList.remove('lg-printing');window.removeEventListener('afterprint',done);};
 window.addEventListener('afterprint',done);try{window.print();}catch(e){}setTimeout(done,1500);}
// signing certificate (last page) + portal seal
function lg_certRows(c){const d=c.d;const L2=d.lang2||lg_l2();
 const signer=s=>`<tr><td>${s.party==='ota'?'OTA':(s.party==='owner'?'Brand owner':'Partner')}</td><td><b>${esc(s.name)}</b><br>${esc(s.title||'')}<br>${esc(s.email||'—')}</td><td>${esc(s.ip||'')}<br><span class="lgd-ua">${esc((s.ua||'').slice(0,60))}</span></td><td>Viewed ${esc(lg_fmtUtc(s.viewedAt||s.at))}<br>Signed ${esc(lg_fmtUtc(s.at))}</td><td>${esc(s.auth||'E-mail OTP + 2FA')}<br><span class="mono">${esc(s.id)}</span></td></tr>`;
 const rows=[['Document / Документ',lg_tplTitle(d.type,'en')+' / '+lg_tplTitle(d.type,L2)],['Number / Номер',d.number],['Template / Шаблон',d.templateVer||'—'],['Issued / Выпущен',d.issuedAt?lg_fmtUtc(d.issuedAt):'—'],
  ['SHA-256 (issued text)',`<span class="mono lgd-hash">${esc(d.hash||'—')}</span>`],['Status / Статус',d.status==='signed_both'||d.status==='acknowledged'?'Signed by both parties / Подписан обеими сторонами':'Signed by Partner / Подписан Партнёром']];
 return `<div class="lgd-r lgd-full lgd-break lgd-cert"><h4>Signing certificate / Сертификат подписания</h4>
  <table class="lgd-t">${rows.map(r=>`<tr><th>${esc(r[0])}</th><td>${r[1].startsWith('<')?r[1]:esc(r[1])}</td></tr>`).join('')}</table></div>
  <div class="lgd-r lgd-full"><table class="lgd-t lgd-signers"><tr><th>Party</th><th>Signer</th><th>IP / device</th><th>Time (UTC)</th><th>Authentication · ID</th></tr>${(d.signatures||[]).map(signer).join('')}
  ${d.scan?`<tr><td>Brand owner</td><td colspan="4">Signed scan uploaded: <b>${esc(d.scan.file)}</b> · ${esc(lg_fmtUtc(d.scan.at))} · ${esc(d.scan.by||'')}</td></tr>`:''}</table></div>
  ${(d.kep||[]).length?`<div class="lgd-r lgd-full"><p class="lgd-small">Additional copies (qualified e-signature): ${d.kep.map(k=>esc(k.file)+' · '+esc(lg_fmtUtc(k.at))).join('; ')}</p></div>`:''}
  <div class="lgd-r lgd-full"><div class="lgd-seal"><div class="lgd-seal-ic">${icon('shield')}</div><div><b>PAdES seal · CONNECT partner portal</b><br>Sealed by OTA TECHNOLOGY DMCC portal certificate · PAdES-B-LT · SHA-256 <span class="mono">${esc((d.hash||'').slice(0,32))}…</span><br>Any change to this document after signing invalidates the seal.</div></div>
  ${S.admin?`<p class="lgd-small lg-noprint lgd-demo">${esc(t('lg.cert.demo'))}</p>`:''}</div>`;}
/* ======================= UI ======================= */
const LG_GROUPS=[
 {id:'company',ic:'factory',fields:['P_NAME','P_FORM_EN','P_FORM_L2','P_COUNTRY','P_REGNO','P_TAXNO','P_ADDR_EN','P_ADDR_L2']},
 {id:'sign',ic:'lg_pen',fields:['P_SIGNATORY','P_TITLE_EN','P_TITLE_L2','P_TITLE_L2_GEN','P_AUTHORITY','P_AUTHORITY_FILE']},
 {id:'lang',ic:'globe',fields:['LANG2']},
 {id:'brand',ic:'tag',fields:['P_BRAND','P_PROGRAMME','P_TM_OWNER_IS_PARTNER','P_TM_LIST','P_BRAND_CONTACT','P_BRAND_RULES','P_TM_OWNER_NAME','P_TM_OWNER_COUNTRY_EN','P_TM_OWNER_COUNTRY_L2','P_TM_OWNER_REGNO','P_TM_OWNER_ADDR','P_TM_OWNER_RELATION_EN','P_TM_OWNER_RELATION_L2','P_TM_OWNER_TERRITORY_EN','P_TM_OWNER_TERRITORY_L2','P_TM_OWNER_SIGNATORY','P_TM_OWNER_TITLE']},
 {id:'domain',ic:'globe',fields:['P_DOMAIN','P_DNS_CONTACT','P_LOGO','P_BRANDBOOK']},
 {id:'contacts',ic:'mail',fields:['P_EMAIL_OPS','P_EMAIL_LEGAL','P_EMAIL_FIN','P_EMAIL_SUPPORT','P_PHONE']},
 {id:'bank',ic:'card',fields:['P_BANK_BENEFICIARY','P_BANK_IBAN','P_BANK_NAME','P_BANK_ADDR','P_BANK_SWIFT','P_BANK_INTERMEDIARY']}];
const LG_FTYPE={P_COUNTRY:'country',P_AUTHORITY:'authority',P_AUTHORITY_FILE:'file',LANG2:'lang2',P_TM_OWNER_IS_PARTNER:'tmowner',P_TM_LIST:'tmlist',P_LOGO:'file',P_BRANDBOOK:'file',
 P_EMAIL_OPS:'email',P_EMAIL_LEGAL:'email',P_EMAIL_FIN:'email',P_EMAIL_SUPPORT:'email',P_DNS_CONTACT:'email',P_BRAND_CONTACT:'email',P_PHONE:'tel',P_BRAND_RULES:'textarea',P_ADDR_EN:'textarea',P_ADDR_L2:'textarea',P_TM_OWNER_ADDR:'textarea',
 LAUNCH_DATE:'date',INIT_SIMS:'number',INIT_KEYS:'number',INIT_TOKENS:'number',ANNUAL_TARGET:'number',RETAIL_CUR:'cur',DELIVERY_ADDR:'textarea',OF_EXCEPTIONS_EN:'textarea',OF_EXCEPTIONS_L2:'textarea'};
const LG_MONO=['P_REGNO','P_TAXNO','P_BANK_IBAN','P_BANK_SWIFT','P_BANK_INTERMEDIARY','P_DOMAIN'];
const LG_ISO=['GB','UA','KZ','AE','PL','MD','GE','RO','DE','CY','EE','LT','LV','CZ','SK','NL','US'];
function lg_tmOwner(){return lg_fval('P_TM_OWNER_IS_PARTNER');}
function lg_fieldOn(k){const tm=lg_tmOwner();if(k.startsWith('P_TM_OWNER_')&&k!=='P_TM_OWNER_IS_PARTNER')return tm==='no';if(k==='P_BRAND_CONTACT'||k==='P_BRAND_RULES')return tm!=='no';
 if(k==='P_AUTHORITY_FILE')return lg_fval('P_AUTHORITY')==='poa';return true;}
function lg_req(k){if(!lg_fieldOn(k))return false;const base=k.split('@')[0];if(['P_BRANDBOOK','P_BRAND_RULES','OF_EXCEPTIONS_EN','OF_EXCEPTIONS_L2'].includes(base))return false;if(base==='P_AUTHORITY_FILE'||base==='DEVICES'||LG_COUNTRY_PARTNER.includes(base))return true;
 const m=lg_meta(base);if(!m)return true;return m.req==='required'||m.req==='na';}
function lg_listOk(arr,cols){return Array.isArray(arr)&&arr.length>0&&arr.every(r=>cols.every(c=>r&&r[c]!=null&&String(r[c]).trim()!==''));}
function lg_fstat(k){const f=lg_form(k);if(f&&f.status==='na')return 'na';const base=k.split('@')[0];const v=f?f.value:null;
 if(base==='P_TM_LIST')return lg_listOk(v,LG_TM_COLS)?'filled':'empty';if(base==='DEVICES')return lg_listOk(v,LG_DEV_COLS)?'filled':'empty';
 return (v!=null&&String(v).trim()!=='')?'filled':'empty';}
function lg_reqList(){const out=[];LG_GROUPS.forEach(g=>g.fields.forEach(k=>{if(lg_req(k))out.push({k,g:g.id,st:lg_fstat(k)});}));
 orgCountries().forEach(cc=>{LG_COUNTRY_PARTNER.concat(['DEVICES']).forEach(b=>{const k=lg_ccKey(b,cc);if(lg_req(k))out.push({k,g:'cc_'+cc,st:lg_fstat(k)});});});return out;}
function lg_progress(){const l=lg_reqList();const done=l.filter(x=>x.st!=='empty').length;return{done,total:l.length,left:l.filter(x=>x.st==='empty'),ok:done===l.length};}
function lg_issuedAny(){return lg_pkgDocs().some(d=>d.status!=='draft');}
function lg_locked(k){if(!lg_issuedAny())return false;return !LG_FREE_AFTER.includes(k);}
function lg_canEditForm(){return can('p.form');}
// questionnaire → S.org (invoices, demo users, delivery)
function lg_syncOrg(){const o=S.org;if(!o)return;const v=k=>lg_fval(k);
 if(v('P_NAME'))o.name=v('P_NAME');if(v('P_COUNTRY'))o.country=v('P_COUNTRY');if(v('P_REGNO'))o.regNo=v('P_REGNO');o.taxId=v('P_TAXNO')||'';if(v('P_ADDR_EN'))o.address=v('P_ADDR_EN');
 if(v('P_SIGNATORY'))o.signatory=v('P_SIGNATORY');if(v('P_TITLE_EN'))o.title=v('P_TITLE_EN');if(v('P_EMAIL_LEGAL')&&!o.signatoryEmail)o.signatoryEmail=v('P_EMAIL_LEGAL');
 if(v('LANG2'))o.lang2=v('LANG2');if(v('P_BRAND'))o.brand=v('P_BRAND');if(v('P_PROGRAMME'))o.programme=v('P_PROGRAMME');if(v('P_DOMAIN'))o.domain=v('P_DOMAIN');if(v('P_PHONE'))o.phone=v('P_PHONE');
 o.bank=Object.assign({},o.bank||{},{benef:v('P_BANK_BENEFICIARY')||'',iban:v('P_BANK_IBAN')||'',bank:v('P_BANK_NAME')||'',bankAddr:v('P_BANK_ADDR')||'',swift:v('P_BANK_SWIFT')||'',interSwift:v('P_BANK_INTERMEDIARY')||''});
 o.delivery=o.delivery||{};orgCountries().forEach(cc=>{const dv=o.delivery[cc]=o.delivery[cc]||{company:o.name,country:cc};const a=lg_fval(lg_ccKey('DELIVERY_ADDR',cc)),im=lg_fval(lg_ccKey('IMPORTER',cc));if(a)dv.address=a;if(im)dv.importer=im;});}
// first visit: start the questionnaire from what signup already knows
function lg_formInit(){const o=S.org||{};const put=(k,v)=>{if(!S.form[k]&&v)S.form[k]={value:v,status:'filled',comment:'',by:'',at:iso(now())};};
 put('P_NAME',o.name);put('P_COUNTRY',o.country&&o.country!=='XX'?o.country:'');put('P_REGNO',o.regNo);put('LANG2',o.lang2||'ru');put('P_BRAND',o.brand);put('P_DOMAIN',o.domain);
 orgCountries().forEach(cc=>{const d=(o.delivery||{})[cc]||{};put(lg_ccKey('INIT_SIMS',cc),'1000');put(lg_ccKey('INIT_KEYS',cc),String(orgMin().first));put(lg_ccKey('INIT_TOKENS',cc),'300');put(lg_ccKey('ANNUAL_TARGET',cc),String(o.commit||3000));
  put(lg_ccKey('RETAIL_CUR',cc),(CC_META[cc]||{}).cur||'USD');if(d.address&&!/^\[/.test(d.address))put(lg_ccKey('DELIVERY_ADDR',cc),[d.address,d.city].filter(Boolean).join(', '));if(d.importer&&!/^\[/.test(d.importer))put(lg_ccKey('IMPORTER',cc),d.importer);});}
function lg_chip(st){return `<span class="lg-chip lg-chip-${st}">${t('lg.st.f.'+st)}</span>`;}
function lg_fid(k){return 'lgf_'+k.replace(/[@]/g,'_');}
function lg_fileName(v){return String(v||'').split(/[\\/]/).pop();}
function lg_inp(k,o){o=o||{};const f=lg_form(k)||{};const base=k.split('@')[0];const tp=o.type||LG_FTYPE[base]||'text';const na=f.status==='na';
 const ro=o.ro||na||(o.locked)||!o.edit;const id=lg_fid(k);const v=f.value==null?'':f.value;const req=lg_req(k);const st=lg_fstat(k);
 const dis=ro?'disabled':'';const common=`id="${id}" name="${id}" data-lgf="${esc(k)}" ${dis} aria-describedby="${id}-h"`;let ctl='';
 if(tp==='textarea')ctl=`<textarea class="inp lg-ta" rows="2" ${common}>${esc(v)}</textarea>`;
 else if(tp==='country')ctl=`<select class="inp" ${common}><option value="">${t('lg.sel')}</option>${LG_ISO.concat(LG_ISO.includes(v)||!v?[]:[v]).map(c=>`<option value="${c}" ${v===c?'selected':''}>${esc(ctyName(c))} (${c})</option>`).join('')}</select>`;
 else if(tp==='cur')ctl=`<select class="inp" ${common}>${['UAH','KZT','USD','EUR','GBP','PLN','MDL','GEL'].map(c=>`<option ${v===c?'selected':''}>${c}</option>`).join('')}</select>`;
 else if(tp==='authority')ctl=`<select class="inp" ${common}><option value="">${t('lg.sel')}</option><option value="director" ${v==='director'?'selected':''}>${t('lg.auth.director')}</option><option value="poa" ${v==='poa'?'selected':''}>${t('lg.auth.poa')}</option></select>`;
 else if(tp==='lang2')ctl=`<select class="inp" ${common}>${lg_lang2Options().map(x=>`<option value="${x.l}" ${v===x.l?'selected':''} ${x.ok?'':'disabled'}>${esc(LG_LANG2[x.l].name)}${x.ok?'':' — '+t('lg.lang2.na')}</option>`).join('')}</select>`;
 else if(tp==='tmowner')ctl=`<div class="lg-yn" role="radiogroup" aria-labelledby="${id}-l">${['yes','no'].map(x=>`<label class="lg-ynopt ${v===x?'on':''}"><input type="radio" name="${id}" value="${x}" data-lgf="${esc(k)}" ${v===x?'checked':''} ${dis}><span><b>${t('lg.tm.'+x)}</b><span class="xs muted">${t('lg.tm.'+x+'.d')}</span></span></label>`).join('')}</div>`;
 else if(tp==='file')ctl=`<div class="lg-file"><span class="lg-fname ${v?'':'faint'}">${icon('file','sm')}${v?esc(v):t('lg.file.none')}</span>${ro?'':`<label class="btn sm"><input type="file" class="lg-sr" data-lgfile="${esc(k)}" id="${id}">${icon('upload','sm')}<span>${v?t('lg.file.replace'):t('lg.file.choose')}</span></label>`}</div>`;
 else ctl=`<input class="inp ${LG_MONO.includes(base)?'mono':''}" type="${tp==='email'?'email':tp==='tel'?'tel':tp==='date'?'date':tp==='number'?'number':'text'}" ${tp==='number'?'min="0" step="1" inputmode="numeric"':''} value="${esc(tp==='date'?String(v).slice(0,10):v)}" ${common} autocomplete="off">`;
 let hint='';if(na)hint=`<span class="hint lg-nahint" id="${id}-h">${icon('shield','sm')} ${t('lg.na.by')}${f.naReason?': '+esc(f.naReason):''}</span>`;
 else if(f.comment)hint=`<span class="hint lg-cmt" id="${id}-h">${icon('mail','sm')} ${t('lg.cmt.yours')}: ${esc(f.comment)}</span>`;
 else{const h=I18N.d[S.lang]&&I18N.d[S.lang]['lg.h.'+base];hint=`<span class="hint" id="${id}-h">${h?esc(h):''}</span>`;}
 const lbl=t('lg.f.'+base)+(o.ccLabel?'':'');
 const cmtBtn=o.edit&&!ro&&req&&st==='empty'&&!na?`<button type="button" class="lg-link xs" data-act="lg_comment" data-arg="${esc(k)}">${t('lg.cmt.btn')}</button>`:'';
 return `<div class="field lg-field ${o.wide?'lg-wide':''}" data-k="${esc(k)}"><div class="lg-flbl"><label for="${id}" id="${id}-l">${esc(lbl)}${req?'':` <span class="faint xs">· ${t('c.optional')}</span>`}</label><span class="row g4">${f.demo?ui.badge(t('lg.demo'),'violet'):''}<span data-chip="${esc(k)}">${lg_chip(st==='filled'||na?(na?'na':'filled'):'empty')}</span></span></div>${ctl}${hint}${cmtBtn}</div>`;}
function lg_tmTable(edit){const v=lg_form('P_TM_LIST');const arr=Array.isArray(v&&v.value)?v.value:[];
 const rows=arr.map((r,i)=>`<tr>${LG_TM_COLS.map(c=>`<td><input class="inp" aria-label="${esc(t('lg.f.'+c))} ${i+1}" value="${esc(r[c]||'')}" data-lgtm="${i}:${c}" ${edit?'':'disabled'}></td>`).join('')}<td>${edit?ui.iconbtn('trash',t('lg.row.del'),{act:'lg_tmDel',arg:i}):''}</td></tr>`).join('');
 return `<div class="field lg-wide" data-k="P_TM_LIST"><div class="lg-flbl"><span class="lbl">${t('lg.f.P_TM_LIST')}</span><span class="row g4">${v&&v.demo?ui.badge(t('lg.demo'),'violet'):''}<span data-chip="P_TM_LIST">${lg_chip(lg_fstat('P_TM_LIST'))}</span></span></div>
  <div class="tblwrap lg-edtbl"><table class="tbl"><thead><tr>${LG_TM_COLS.map(c=>`<th>${t('lg.f.'+c)}</th>`).join('')}<th></th></tr></thead><tbody>${rows||`<tr><td colspan="5" class="muted small">${t('lg.tm.empty')}</td></tr>`}</tbody></table></div>
  ${edit?`<div>${ui.btn(t('lg.row.add'),{size:'sm',icon:'plus',act:'lg_tmAdd'})}</div>`:''}<span class="hint">${t('lg.h.P_TM_LIST')}</span></div>`;}
function lg_devTable(cc,edit,ota){const arr=lg_devices(cc,true);
 const rows=arr.map((r,i)=>`<tr>${LG_DEV_COLS.map(c=>`<td>${c==='DEV_PLAN'?`<select class="inp" data-lgdev="${cc}:${i}:${c}" ${edit?'':'disabled'} aria-label="${esc(t('lg.f.'+c))}">${['','Light','Standard','Premium'].map(p=>`<option ${r[c]===p?'selected':''}>${p}</option>`).join('')}</select>`
   :`<input class="inp" aria-label="${esc(t('lg.f.'+c))} ${i+1}" value="${esc(r[c]||'')}" data-lgdev="${cc}:${i}:${c}" ${edit?'':'disabled'}>`}</td>`).join('')}
  <td>${ota?`<label class="chk small"><input type="checkbox" data-lgdevok="${cc}:${i}" ${r.ok?'checked':''} ${can('ota.countries')||can('ota.settings')?'':'disabled'}><span>${t('lg.dev.ok')}</span></label>`:(r.ok?ui.badge(t('lg.dev.okB'),'ok'):ui.badge(t('lg.dev.wait'),'warn'))}</td>
  <td>${edit?ui.iconbtn('trash',t('lg.row.del'),{act:'lg_devDel',arg:cc+':'+i}):''}</td></tr>`).join('');
 const k=lg_ccKey('DEVICES',cc);
 return `<div class="field lg-wide" data-k="${k}"><div class="lg-flbl"><span class="lbl">${t('lg.f.DEVICES')}</span><span data-chip="${k}">${lg_chip(lg_fstat(k))}</span></div>
  <div class="tblwrap lg-edtbl"><table class="tbl lg-devtbl"><thead><tr>${LG_DEV_COLS.map(c=>`<th>${t('lg.f.'+c)}</th>`).join('')}<th>${t('lg.dev.st')}</th><th></th></tr></thead><tbody>${rows||`<tr><td colspan="9" class="muted small">${t('lg.dev.empty')}</td></tr>`}</tbody></table></div>
  ${edit?`<div class="row wrap g8">${ui.btn(t('lg.row.add'),{size:'sm',icon:'plus',act:'lg_devAdd',arg:cc})}${ui.btn(t('lg.dev.prefill'),{size:'sm',kind:'ghost',icon:'tag',act:'lg_devPrefill',arg:cc})}</div>`:''}<span class="hint">${t('lg.h.DEVICES')}</span></div>`;}
function lg_formHtml(){lg_st();lg_formInit();const L=lg_st();const edit=lg_canEditForm();const pr=lg_progress();const issued=lg_issuedAny();
 const sub=L.submitted;const stage=L.review?'approved':sub?'submitted':'draft';
 const grp=(g)=>{let body='';const lockedGrp=issued&&g.fields.some(k=>lg_locked(k));
  if(g.id==='brand'){body=['P_BRAND','P_PROGRAMME'].map(k=>lg_inp(k,{edit,locked:lg_locked(k)})).join('')+lg_inp('P_TM_OWNER_IS_PARTNER',{edit,locked:lg_locked('P_TM_OWNER_IS_PARTNER'),wide:true})+lg_tmTable(edit&&!lg_locked('P_TM_LIST'));
   const tm=lg_tmOwner();if(tm==='no')body+=`<div class="lg-wide lg-subh">${t('lg.tm.ownerH')}</div>`+g.fields.filter(k=>k.startsWith('P_TM_OWNER_')&&k!=='P_TM_OWNER_IS_PARTNER').map(k=>lg_inp(k,{edit,locked:lg_locked(k)})).join('');
   else body+=['P_BRAND_CONTACT','P_BRAND_RULES'].map(k=>lg_inp(k,{edit,locked:lg_locked(k),wide:k==='P_BRAND_RULES'})).join('');}
  else body=g.fields.filter(lg_fieldOn).map(k=>lg_inp(k,{edit,locked:lg_locked(k),wide:['P_ADDR_EN','P_ADDR_L2','LANG2'].includes(k)})).join('');
  const req=['company','sign','bank'].includes(g.id)&&issued&&edit?ui.btn(t('lg.chg.req'),{size:'sm',icon:'edit',act:'lg_chgReq',arg:g.id}):'';
  const gl=lg_reqList().filter(x=>x.g===g.id);const gd=gl.filter(x=>x.st!=='empty').length;
  return `<section class="card lg-grp" id="lg-g-${g.id}"><div class="hd"><h2 class="row g8">${icon(g.ic,'sm')}${t('lg.g.'+g.id)}</h2><div class="row g8"><span class="small muted num" data-gp="${g.id}">${gd}/${gl.length}</span>${req}</div></div>
   <div class="bd">${g.id==='lang'?`<p class="small muted lg-wide" style="margin-bottom:12px">${t('lg.lang2.d')}</p>`:''}${lockedGrp&&!req?`<div style="margin-bottom:12px">${ui.note('info',t('lg.locked.d'))}</div>`:''}<div class="lg-fgrid">${body}</div></div></section>`;};
 const ccs=orgCountries().map(cc=>{const gl=lg_reqList().filter(x=>x.g==='cc_'+cc);const gd=gl.filter(x=>x.st!=='empty').length;const lk=issued;
  const pl=priceList(cc);
  return `<section class="card lg-grp" id="lg-g-cc_${cc}"><div class="hd"><h2 class="row g8">${icon('globe','sm')}${t('lg.g.cc',{c:esc(ctyName(cc))})}</h2><span class="small muted num" data-gp="cc_${cc}">${gd}/${gl.length}</span></div><div class="bd">
   <div class="lg-fgrid">${LG_COUNTRY_PARTNER.map(b=>lg_inp(lg_ccKey(b,cc),{edit,locked:lk,wide:/^(DELIVERY_ADDR|OF_EXCEPTIONS)/.test(b)})).join('')}${lg_devTable(cc,edit&&!lk,false)}</div>
   <p class="small muted" style="margin-top:12px">${icon('price','sm')} ${pl?t('lg.cc.prices',{v:pl.ver,k:money(pl.key,'USD')}):t('lg.cc.noprices')} · <a href="#prices">${t('lg.cc.pricesLink')}</a></p></div></section>`;}).join('');
 const stBadge=stage==='approved'?ui.badge(t('lg.form.st.approved'),'ok',true):stage==='submitted'?ui.badge(t('lg.form.st.submitted'),'info',true):ui.badge(t('lg.form.st.draft'),'warn',true);
 const prog=`<div class="card lg-progress" id="lg-progress"><div class="bd"><div class="row between wrap g12"><div class="col g4"><div class="row g8"><b>${t('lg.form.progress')}</b>${stBadge}</div><span class="small muted" id="lg-progT">${t('lg.form.progT',{x:pr.done,n:pr.total})}</span></div>
  <div class="row g8 wrap">${!sub&&edit?ui.btn(t('lg.form.submit'),{kind:'primary',icon:'send',act:'lg_submit',id:'lg-submit',disabled:!pr.ok}):''}${sub&&!issued?`<span class="small muted">${t('lg.form.subAt',{d:fmtDateTime(sub.at)})}</span>`:''}</div></div>
  <div style="margin-top:10px" id="lg-progBar">${ui.bar(pr.total?pr.done/pr.total:0,pr.ok?'ok':'')}</div>
  <div class="small muted" id="lg-progLeft" style="margin-top:8px">${pr.ok?'':t('lg.form.left',{n:pr.left.length})+' '+pr.left.slice(0,4).map(x=>`<a href="#" data-act="lg_jump" data-arg="${esc(x.k)}">${esc(t('lg.f.'+x.k.split('@')[0]))}${x.k.includes('@')?' ('+x.k.split('@')[1]+')':''}</a>`).join(', ')+(pr.left.length>4?'…':'')}</div></div></div>`;
 const notes=[];if(!edit)notes.push(ui.note(S.admin?'admin':'info',S.admin?t('lg.form.otaRo'):t('c.noPerm',{r:esc(roleName(lg_role()))})+(typeof ord_asBtn==='function'?' '+ord_asBtn('p_admin'):'')));
 if(L.detailReq&&L.detailReq.status==='pending')notes.push(ui.note('warn',t('lg.chg.pending')));
 if(L.detailReq&&L.detailReq.status==='approved'&&L.detailReq.noticeId){const nd=lg_doc(L.detailReq.noticeId);if(nd&&nd.status==='issued')notes.push(ui.note('info',t('lg.chg.toSign',{n:esc(nd.number)})+' <a href="'+link('lg-sign')+'">'+t('lg.nav.sign')+'</a>'));}
 return ui.page({title:t('lg.form.title'),sub:t('lg.form.sub'),crumbs:[[t('lg.sec'),link('lg-docs')],[t('lg.form.title')]],
  body:`<div class="stack">${notes.join('')}${prog}${LG_GROUPS.map(grp).join('')}${ccs}</div>`});}
// update chips & progress without re-rendering (keeps focus while typing through the form)
function lg_refreshProgress(){const pr=lg_progress();const el=$('#lg-progT');if(el)el.textContent=t('lg.form.progT',{x:pr.done,n:pr.total});const b=$('#lg-progBar');if(b)b.innerHTML=ui.bar(pr.total?pr.done/pr.total:0,pr.ok?'ok':'');
 const btn=$('#lg-submit');if(btn)btn.disabled=!pr.ok;const lf=$('#lg-progLeft');if(lf)lf.innerHTML=pr.ok?'':t('lg.form.left',{n:pr.left.length})+' '+pr.left.slice(0,4).map(x=>`<a href="#" data-act="lg_jump" data-arg="${esc(x.k)}">${esc(t('lg.f.'+x.k.split('@')[0]))}${x.k.includes('@')?' ('+x.k.split('@')[1]+')':''}</a>`).join(', ')+(pr.left.length>4?'…':'');
 $$('[data-chip]').forEach(c=>{const k=c.dataset.chip;const s=lg_fstat(k);c.innerHTML=lg_chip(s);});
 const rl=lg_reqList();$$('[data-gp]').forEach(e=>{const gl=rl.filter(x=>x.g===e.dataset.gp);e.textContent=gl.filter(x=>x.st!=='empty').length+'/'+gl.length;});}
function lg_validate(k,v){const base=k.split('@')[0];const tp=LG_FTYPE[base];if(v==null||String(v).trim()==='')return '';const s=String(v).trim();
 if(tp==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s))return t('lg.e.email');
 if(base==='P_BANK_IBAN'&&!/^[A-Z]{2}\d{2}[A-Z0-9]{8,30}$/.test(s.replace(/\s/g,'').toUpperCase()))return t('lg.e.iban');
 if((base==='P_BANK_SWIFT'||base==='P_BANK_INTERMEDIARY')&&!/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(s.toUpperCase()))return t('lg.e.swift');
 if(base==='P_DOMAIN'&&!/^([a-z0-9-]+\.)+[a-z]{2,}$/i.test(s))return t('lg.e.domain');
 if(tp==='number'&&!(+s>=0))return t('lg.e.num');return '';}
function lg_setFieldErr(k,msg){const id=lg_fid(k);const el=document.getElementById(id);const h=document.getElementById(id+'-h');if(el){if(msg)el.setAttribute('aria-invalid','true');else el.removeAttribute('aria-invalid');}
 if(h){if(msg){h.className='err';h.textContent=msg;}else if(h.className==='err'){h.className='hint';h.textContent='';}}}
function lg_onField(k,el){if(!lg_canEditForm()&&!(S.admin&&k.includes('@')&&LG_COUNTRY_OTA.includes(k.split('@')[0])))return;let v=el.type==='radio'?el.value:el.value;
 const base=k.split('@')[0];if(['P_BANK_IBAN','P_BANK_SWIFT','P_BANK_INTERMEDIARY'].includes(base))v=String(v).replace(/\s/g,'').toUpperCase();if(base==='P_DOMAIN')v=String(v).trim().toLowerCase();
 const err=lg_validate(k,v);lg_setFieldErr(k,err);if(err)return;
 const f=lg_fset(k,typeof v==='string'?v.trim():v);if(f.comment&&f.status==='filled')f.comment='';if(!lg_issuedAny())lg_syncOrg();save();
 if(['P_TM_OWNER_IS_PARTNER','P_AUTHORITY','LANG2'].includes(k)){rerender();return;}lg_refreshProgress();}
/* ---------- OTA review ---------- */
function lg_noOta(){return ui.page({title:t('lg.ota.only'),body:ui.empty('shield',t('lg.ota.only'),t('lg.ota.onlyD'))});}
function lg_reviewReady(){const L=lg_st();const o=S.org||{};const kyc=LG_KYC.every(k=>L.kyc[k]);const pr=lg_progress();
 return{submitted:!!L.submitted,form:pr.ok,kyc,code:o.codeStatus==='approved',brand:!!lg_tmOwner(),prices:orgCountries().every(cc=>!!priceList(cc)),devices:orgCountries().every(cc=>lg_devices(cc).length>0)};}
function lg_valShow(k){const f=lg_form(k);if(!f)return '<span class="faint">—</span>';const v=f.value;if(f.status==='na')return `<span class="faint">N/A</span>`;
 if(Array.isArray(v))return esc(t('lg.rows',{n:v.length}));if(v==null||String(v).trim()==='')return '<span class="faint">—</span>';const base=k.split('@')[0];
 if(base==='P_TM_OWNER_IS_PARTNER')return esc(t('lg.tm.'+v));if(base==='P_AUTHORITY')return esc(t('lg.auth.'+v));if(base==='LANG2')return esc((LG_LANG2[v]||{}).name||v);if(base==='P_COUNTRY')return esc(ctyName(v));return esc(v);}
function lg_reviewHtml(){if(!S.admin)return lg_noOta();const L=lg_st();const o=S.org||{};const rr=lg_reviewReady();const allOk=Object.values(rr).every(Boolean);
 const steps=[['submitted',rr.submitted],['form',rr.form],['kyc',rr.kyc],['code',rr.code],['brand',rr.brand],['prices',rr.prices],['devices',rr.devices]];
 const head=ui.card({title:t('lg.rv.status'),actions:L.review?ui.badge(t('lg.rv.approvedAt',{d:fmtDate(L.review.at)}),'ok',true):'',body:`<div class="lg-checks">${steps.map(([k,ok])=>`<div class="lg-ck ${ok?'ok':''}">${icon(ok?'check':'clock','sm')}<span>${t('lg.rv.ck.'+k)}</span></div>`).join('')}</div>`,
  foot:L.review?`<span class="small muted grow">${t('lg.rv.next')}</span>${ui.btn(t('lg.rv.toPkg'),{kind:'primary',href:link('lg-docs'),icon:'right'})}`
   :`${ui.btn(t('lg.rv.approve'),{kind:'primary',icon:'check',act:'lg_approveReview',disabled:!allOk||!(can('ota.settings')||can('ota.release'))})}`});
 const kyc=ui.card({title:t('lg.rv.kyc'),actions:ui.badge(t('lg.demo'),'violet'),body:`<div class="col g8">${LG_KYC.map(k=>`<label class="chk small"><input type="checkbox" data-lgkyc="${k}" ${L.kyc[k]?'checked':''} ${can('ota.settings')?'':'disabled'}><span><b>${t('lg.kyc.'+k)}</b><br><span class="muted xs">${t('lg.kyc.'+k+'.d')}</span>${L.kyc[k]?`<br><span class="faint xs">${esc(L.kyc[k].by)} · ${fmtDateTime(L.kyc[k].at)}</span>`:''}</span></label>`).join('')}</div>`});
 const st=codeAvailable(o.code,o.code);
 const code=ui.card({title:t('lg.rv.code'),body:`<div class="col g12"><p class="small muted">${t('lg.rv.codeD')}</p><div class="row g8"><b class="mono lg-code">${esc(o.code||'—')}</b>${o.codeStatus==='approved'?ui.badge(t('lg.rv.codeOk'),'ok',true):ui.badge(t('lg.rv.codeProp'),'warn',true)}</div>
  ${o.codeStatus!=='approved'?`<form data-form="lg_code" class="row wrap g8" novalidate style="align-items:flex-end">${ui.field({id:'code',label:t('lg.rv.codeNew'),value:o.code||'',mono:true,attrs:'maxlength="3" autocomplete="off" style="width:110px;text-transform:uppercase"'+(can('ota.codes')?'':' disabled')})}${ui.btn(t('lg.rv.codeApprove'),{kind:'primary',type:'submit',disabled:!can('ota.codes')})}</form>`:''}
  ${st&&o.codeStatus!=='approved'?ui.note('warn',t('lg.rv.codeBad.'+st)):''}</div>`});
 const tm=lg_tmOwner();
 const brand=ui.card({title:t('lg.rv.brand'),body:`<div class="col g12"><p class="small muted">${t('lg.rv.brandD')}</p>${ui.seg('lg-bsel',[['yes','05A · '+t('lg.rv.b05A')],['no','05B · '+t('lg.rv.b05B')]],tm||'','lg_setBrandDoc')}${tm?'':ui.note('warn',t('lg.rv.brandNone'))}</div>`});
 // fields with N/A flags
 const rowsF=[];LG_GROUPS.forEach(g=>g.fields.filter(lg_fieldOn).forEach(k=>rowsF.push({k,g:g.id})));orgCountries().forEach(cc=>LG_COUNTRY_PARTNER.forEach(b=>rowsF.push({k:lg_ccKey(b,cc),g:'cc'})));
 const q=(S.ui.lg_rvq||'').toLowerCase();const onlyOpen=!!S.ui.lg_rvOpen;
 const list=rowsF.filter(r=>{const st=lg_fstat(r.k);if(onlyOpen&&st!=='empty')return false;if(!q)return true;return (t('lg.f.'+r.k.split('@')[0])+' '+r.k).toLowerCase().includes(q);});
 const fTbl=ui.table([{label:t('lg.rv.f')},{label:t('lg.rv.v')},{label:t('c.status')},{label:t('lg.rv.cmt')},{label:'',cls:'r'}],list.map(r=>{const f=lg_form(r.k)||{};const st=lg_fstat(r.k);const req=lg_req(r.k);
   return{cells:[`<b class="small">${esc(t('lg.f.'+r.k.split('@')[0]))}</b>${r.k.includes('@')?` <span class="badge">${r.k.split('@')[1]}</span>`:''}<div class="xs faint mono">${esc(r.k)}${req?'':' · '+t('c.optional')}</div>`,
    `<span class="small lg-val">${lg_valShow(r.k)}</span>`,lg_chip(st),f.comment?`<span class="small">${esc(f.comment)}</span>`:(f.naReason?`<span class="small faint">${esc(f.naReason)}</span>`:'<span class="faint">—</span>'),
    st==='na'?ui.btn(t('lg.na.clear'),{size:'sm',kind:'ghost',act:'lg_naClear',arg:r.k,disabled:!can('ota.na')}):(st==='empty'&&!['P_TM_LIST','DEVICES'].includes(r.k.split('@')[0])?ui.btn(t('lg.na.set'),{size:'sm',act:'lg_naSet',arg:r.k,disabled:!can('ota.na')}):'')]};}),{empty:ui.empty('check',t('lg.rv.noOpen'),'')});
 const fields=ui.card({title:t('lg.rv.fields'),actions:`<input class="inp" style="max-width:220px;min-height:32px" type="search" placeholder="${t('c.search')}" value="${esc(S.ui.lg_rvq||'')}" data-lgui="lg_rvq" aria-label="${t('c.search')}"><label class="chk small"><input type="checkbox" data-act="lg_rvOpen" ${onlyOpen?'checked':''}><span>${t('lg.rv.onlyOpen')}</span></label>`,pad:false,
  body:`<div class="bd" style="padding-bottom:0">${ui.note('admin',t('lg.rv.naRule'))}</div>${fTbl}`});
 // countries: price lists, OTA country details, Annex 1 approval
 const ccCards=orgCountries().map(cc=>{const pl=priceList(cc);const pend=plPending(cc);
  return ui.card({title:t('lg.g.cc',{c:esc(ctyName(cc))}),actions:`<a class="btn sm" href="#prices">${icon('price','sm')}<span>${t('lg.rv.prices')}</span></a>`,body:`<div class="stack">
   <dl class="dl small"><dt>${t('lg.rv.plCur')}</dt><dd>${pl?`v${pl.ver} · ${t('lg.rv.from')} ${fmtDate(pl.from)} · ${t('c.keyItem')} ${money(pl.key,'USD')} · Standard 24 ${money(pl.tokens.std[24],'USD')} · ${t('lg.rv.fee')} ${pct(pl.fee||0,1)}`:`<span class="faint">${t('lg.cc.noprices')}</span>`}</dd>
   ${pend.length?`<dt>${t('lg.rv.plPend')}</dt><dd>${pend.map(p=>`v${p.ver} · ${t('lg.rv.from')} ${fmtDate(p.from)}${p.increase?' · '+ui.badge(t('lg.ch.increase'),'warn'):''}`).join('<br>')}</dd>`:''}</dl>
   <div class="lg-fgrid">${LG_COUNTRY_OTA.map(b=>{const k=lg_ccKey(b,cc);if(!lg_form(k)){const dv=lg_ccDefault(cc,b);if(dv!=null)S.form[k]={value:dv,status:'filled',comment:'',by:'OTA',at:iso(now())};}return lg_inp(k,{edit:can('ota.countries')||can('ota.settings')});}).join('')}</div>
   ${lg_devTable(cc,false,true)}</div>`});}).join('');
 const otaRows=otaKeys().map(k=>{const v=otaVal(k);return `<div class="lg-ota-r"><span class="mono xs">${esc(k)}</span><span class="small">${v?esc(v):`<span class="badge">N/A</span>`}</span></div>`;}).join('');
 const otaCard=ui.card({title:t('lg.rv.ota'),actions:`<a class="btn sm" href="#requisites">${icon('edit','sm')}<span>${t('lg.rv.otaEdit')}</span></a>`,body:`<p class="small muted" style="margin-bottom:10px">${t('lg.rv.otaD')}</p><div class="lg-ota">${otaRows}</div>`});
 const dr=L.detailReq&&L.detailReq.status==='pending'?ui.card({title:t('lg.chg.reqT'),actions:ui.badge(t('lg.chg.pendingB'),'warn',true),body:ui.table([{label:t('lg.rv.f')},{label:t('lg.chg.old')},{label:t('lg.chg.new')}],Object.keys(L.detailReq.fields).map(k=>({cells:[esc(t('lg.f.'+k)),esc(L.detailReq.fields[k].old||'—'),`<b>${esc(L.detailReq.fields[k].new||'—')}</b>`]}))),
  foot:`${ui.btn(t('lg.chg.reject'),{kind:'ghost',act:'lg_chgReject'})}${ui.btn(t('lg.chg.approve'),{kind:'primary',icon:'check',act:'lg_chgApprove',disabled:!(can('ota.settings')||can('ota.release'))})}`}):'';
 const decl=lg_docs().filter(d=>d.decline&&!d.decline.handled);
 const declCard=decl.length?ui.card({title:t('lg.dec.title'),body:`<div class="col g12">${decl.map(d=>`<div class="lg-decl"><div class="grow"><b class="mono small">${esc(d.number)}</b> · ${esc(d.decline.by)} · ${fmtDateTime(d.decline.at)}<div class="small">“${esc(d.decline.comment)}”</div><div class="xs faint">${t('lg.dec.rule')}</div></div>${ui.btn(t('lg.dec.handled'),{size:'sm',act:'lg_declHandled',arg:d.id})}</div>`).join('')}</div>`}):'';
 return ui.page({title:t('lg.rv.title'),sub:t('lg.rv.sub',{n:esc(o.name||'—')}),crumbs:[[t('lg.otasec'),link('lg-review')],[t('lg.rv.title')]],
  actions:`${ui.btn(t('lg.rv.openForm'),{href:link('lg-form'),icon:'file'})}`,
  body:`<div class="stack">${ui.note('admin',t('lg.rv.adminNote'))}${dr}${declCard}${head}<div class="grid2">${kyc}<div class="stack">${code}${brand}</div></div>${fields}${ccCards}${otaCard}</div>`});}
/* ---------- documents list ---------- */
function lg_stBadge(d){let s=d.status;let label=t('lg.st.'+s);if(d.type==='BOA'&&s==='signed_both')label=t('lg.st.scan');if(d.type==='CHG'&&s==='acknowledged')label=t('lg.st.signedP');
 if(d.ack&&d.ack.auto&&s==='acknowledged')label=t('lg.st.autoEff');
 const ts=iso(now());if((s==='signed_both'||s==='acknowledged')&&d.effective&&d.effective>ts){return ui.badge(t('lg.st.signedFuture',{d:fmtDate(d.effective)}),'info',true);}
 return ui.badge(label,LG_ST_TONE[s]||'',true);}
function lg_docTitle(d,lang){lang=lang||S.lang;const base=lang==='en'?lg_tplTitle(d.type,'en'):(I18N.d[lang]&&I18N.d[lang]['lg.tt.'+d.type])||lg_tplTitle(d.type,'ru');return base+(d.cc?' — '+ctyName(d.cc):'');}
function lg_docNoLbl(d){return d.type==='CHG'?'—':lg_docLabel(d.type,d.cc);}
function lg_clsBadge(c){return c?ui.badge(t('lg.cls.'+c),c==='A'?'bad':c==='B'?'info':'',false):'';}
function lg_stepper(){const st=lg_pkgStage();const order=['form','review','ready','draft','issued','signed_partner','signed'];const idx=order.indexOf(st);
 const items=[['form','lg.stp.form'],['review','lg.stp.review'],['draft','lg.stp.gen'],['issued','lg.stp.psign'],['signed_partner','lg.stp.osign'],['signed','lg.stp.done']];
 return `<ol class="lg-stepper">${items.map(([k,lb])=>{const ki=order.indexOf(k);const done=idx>ki||(st==='signed');const cur=!done&&(idx===ki||(k==='draft'&&st==='ready'));return `<li class="${done?'done':cur?'cur':''}"><span class="lg-stpd">${done?icon('check','sm'):''}</span><span>${t(lb)}</span></li>`;}).join('')}</ol>`;}
function lg_docsHtml(){lg_st();lg_tick();const L=lg_st();const st=lg_pkgStage();const pk=lg_pkgDocs();const tasks=lg_tasks('partner');
 const acts=[];
 if(S.admin){if(st==='ready'||st==='draft')acts.push(ui.btn(st==='draft'?t('lg.pkg.regen'):t('lg.pkg.gen'),{kind:st==='ready'?'primary':'',icon:'layers',act:'lg_generate',disabled:!(can('ota.release')||can('ota.settings'))}));
  if(st==='draft')acts.push(ui.btn(t('lg.pkg.issue'),{kind:'primary',icon:'send',act:'lg_issuePkg',disabled:!(can('ota.release')||can('ota.settings'))}));
  if(st==='signed_partner')acts.push(ui.btn(t('lg.pkg.osign'),{kind:'primary',icon:'lg_pen',href:link('lg-signing','pkg')}));}
 else if(tasks.some(x=>x.key==='pkg'))acts.push(ui.btn(t('lg.pkg.sign'),{kind:'primary',icon:'lg_pen',href:link('lg-signing','pkg')}));
 // package card
 let pkgBody;
 if(!pk.length){pkgBody=ui.empty('layers',t('lg.pkg.emptyT.'+st),t('lg.pkg.emptyD.'+st),st==='form'?ui.btn(t('lg.pkg.toForm'),{kind:'primary',href:link('lg-form')}):(st==='review'&&S.admin?ui.btn(t('lg.rv.title'),{kind:'primary',href:link('lg-review')}):''));}
 else{const rows=pk.map(d=>{let miss='';if(d.status==='draft'){const r=lg_renderDoc(d,{live:true});miss=r.error?ui.badge(t('lg.pkg.noTr'),'bad'):(r.missing.length?ui.badge(t('lg.pkg.miss',{n:r.missing.length}),'warn'):ui.badge(t('lg.pkg.ready'),'ok'));}
   return{href:link('lg-doc',d.id),cells:[`<span class="mono small">${esc(lg_docNoLbl(d))}</span>`,`<b>${esc(lg_docTitle(d))}</b>${d.type==='BOA'?`<div class="xs muted">${t('lg.boa.hint')}</div>`:''}`,`<span class="mono small">${esc(d.number)}</span>`,lg_stBadge(d)+(miss?' '+miss:'')]};});
  pkgBody=ui.table([{label:t('lg.col.no')},{label:t('lg.col.doc')},{label:t('lg.col.num')},{label:t('c.status')}],rows);}
 const pkgCard=ui.card({title:t('lg.pkg.title'),actions:pk.length?`<span class="small muted">${t('lg.pkg.lang',{l:esc(LG_LANG2[lg_l2()].name)})}</span>`:'',pad:!pk.length,body:pkgBody,
  foot:pk.length&&st==='draft'&&S.admin?`<span class="small muted grow">${t('lg.pkg.draftNote')}</span>`:(pk.length&&st==='signed'?`<span class="small muted grow">${t('lg.pkg.signedNote')}</span>`:'')});
 // pending changes
 const chg=lg_docs().filter(d=>d.kind!=='pkg'&&lg_isPending(d)&&!d.archived);
 const chgCard=chg.length?ui.card({title:t('lg.chg.title'),pad:false,body:ui.table([{label:t('lg.col.doc')},{label:t('lg.col.num')},{label:t('lg.col.cls')},{label:t('lg.col.eff')},{label:t('c.status')}],
  chg.map(d=>({href:link('lg-doc',d.id),cells:[`<b>${esc(lg_docTitle(d))}</b><div class="xs muted">${esc(lg_chgDesc(d))}</div>`,`<span class="mono small">${esc(d.number)}</span>`,lg_clsBadge(d.type==='CHG'?'':d.cls),d.effective?fmtDate(d.effective):`<span class="muted small">${t('lg.eff.onSign')}</span>`,lg_stBadge(d)+(d.decline?' '+ui.badge(t('lg.dec.b'),'bad'):'')]})))}):'';
 // all documents
 const f=S.ui.lg_df||'live';const showArch=!!S.ui.lg_arch;
 let all=lg_docs().filter(d=>LG_LEGAL_TYPES.includes(d.type)&&(showArch||!d.archived)&&(S.admin||d.status!=='terminated'));
 if(f==='live')all=all.filter(d=>d.status==='signed_both'||d.status==='acknowledged');else if(f==='pending')all=all.filter(d=>lg_isPending(d)||d.status==='draft');else if(f==='old')all=all.filter(d=>d.status==='superseded'||d.status==='terminated');
 all=all.slice().sort((a,b)=>String(b.issuedAt||b.createdAt).localeCompare(String(a.issuedAt||a.createdAt)));
 const pg=+(S.ui.lg_dpg||1);const per=50;const page=all.slice((pg-1)*per,pg*per);
 const allCard=ui.card({title:t('lg.all.title'),actions:`${ui.seg('lg-df',[['live',t('lg.f.live')],['pending',t('lg.f.pending')],['old',t('lg.f.old')],['all',t('c.all')]],f,'lg_df')}<label class="chk small"><input type="checkbox" data-act="lg_arch" ${showArch?'checked':''}><span>${t('lg.all.arch')}</span></label>`,pad:false,
  body:ui.table([{label:t('lg.col.doc')},{label:t('lg.col.num')},{label:t('lg.col.ver')},{label:t('lg.col.eff')},{label:t('c.status')}],page.map(d=>({href:link('lg-doc',d.id),cells:[`<b>${esc(lg_docTitle(d))}</b>${d.archived?' '+ui.badge(t('lg.arch.b'),''):''}`,`<span class="mono small">${esc(d.number)}</span>`,`<span class="small">v${d.ver} · ${esc(d.templateVer||'')}</span>`,d.effective?fmtDate(d.effective):'<span class="faint">—</span>',lg_stBadge(d)]})),{empty:ui.empty('file',t('lg.all.none'),'')})+(all.length>per?ui.pager(pg,all.length,per,'lg_dpg'):'')});
 // public docs
 const pub=lg_st().pub.filter(p=>p.status==='current');
 const pubCard=ui.card({title:t('lg.pub.title'),actions:S.admin?`<a class="btn sm" href="${link('lg-tpl')}" data-act="lg_tplTab" data-arg="public">${t('lg.pub.manage')}</a>`:'',pad:false,
  body:pub.length?ui.table([{label:t('lg.col.doc')},{label:t('lg.col.num')},{label:t('lg.pub.lang')},{label:t('lg.pub.date')},{label:''}],pub.map(p=>({cells:[`<b>${esc(lg_docTitle({type:p.type,cc:p.cc}))}</b>`,`<span class="mono small">${esc(p.number)}</span>`,esc((LG_LANG2[p.lang]||{name:'English'}).name),fmtDate(p.publishedAt),ui.btn(t('lg.pub.web'),{size:'sm',icon:'globe',act:'lg_pubView',arg:p.id})]}))):`<div class="bd small muted">${t('lg.pub.none')}</div>`});
 const kp=`<div class="grid4">${ui.kpi(t('lg.k.pkg'),t('lg.stage.'+st),'')}${ui.kpi(t('lg.k.live'),fmtNum(lg_docs().filter(d=>LG_LEGAL_TYPES.includes(d.type)&&(d.status==='signed_both'||d.status==='acknowledged')).length),'')}${ui.kpi(t('lg.k.tasks'),fmtNum(lg_tasks().length),'',{href:link('lg-sign')})}${ui.kpi(t('lg.k.chg'),fmtNum(chg.length),'')}</div>`;
 return ui.page({title:t('lg.docs.title'),sub:t('lg.docs.sub'),actions:acts.join(''),body:`<div class="stack">${S.admin?ui.note('admin',t('lg.docs.admin')):''}${kp}${ui.card({body:lg_stepper()})}${chgCard}${pkgCard}${allCard}${pubCard}</div>`});}
function lg_chgDesc(d){if(d.type==='CHG')return t('lg.chg.notice');if(d.sub==='increase')return t('lg.ch.d.increase');if(d.sub==='decrease')return t('lg.ch.d.decrease');if(d.sub==='new_country')return t('lg.ch.d.country');
 const v=lg_tplVersions(d.type).find(x=>x.ver===d.templateVer);return t('lg.ch.d.text',{v:d.templateVer||''})+(v&&v.note?' — '+v.note:'');}

/* ---------- document view ---------- */
function lg_docHtml(id){lg_tick();const d=lg_doc(id);if(!d)return ui.page({title:t('lg.e.noDoc'),body:ui.empty('file',t('lg.e.noDoc'),'',ui.btn(t('c.back'),{href:link('lg-docs')}))});
 const draftHl=d.status==='draft'&&S.admin;const r=lg_renderDoc(d,{cert:true,draft:draftHl,live:d.status==='draft'});const prev=d.supersedes?lg_doc(d.supersedes):null;const nxt=lg_docs().find(x=>x.supersedes===d.id&&x.status!=='terminated');
 const acts=[];const tasks=lg_tasks(S.admin?'ota':'partner');const task=tasks.find(x=>x.docs.includes(d));
 if(d.status!=='draft')acts.push(ui.btn(t('lg.dv.print'),{icon:'printer',act:'lg_print',arg:d.id}));else acts.push(ui.btn(t('lg.dv.preview'),{icon:'printer',act:'lg_printNoAuto',arg:d.id}));
 if(prev)acts.push(ui.btn(t('lg.dv.diff'),{icon:'lg_diff',href:link('lg-diff',d.id)}));
 if(task&&(task.kind==='sign'||task.kind==='osign'||task.kind==='ack'))acts.push(ui.btn(t(task.kind==='ack'?'lg.dv.ack':'lg.dv.sign'),{kind:'primary',icon:'lg_pen',href:link('lg-signing',task.key)}));
 const notes=[];
 if(r.error)notes.push(S.admin&&can('ota.templates')?r.html:ui.note('warn',t('lg.e.prep')));
 if(d.status==='draft')notes.push(ui.note(S.admin?'admin':'info',S.admin?t('lg.dv.draftOta'):t('lg.dv.draftP')));
 if(d.status==='draft'&&r.missing.length)notes.push(ui.note('warn',`<b>${t('lg.dv.missT',{n:r.missing.length})}</b><br>${r.missing.map(k=>`<span class="mono xs lg-mk">${esc(k)}</span> ${esc(t('lg.f.'+k)===('lg.f.'+k)?(lg_meta(k)||{}).label||'':t('lg.f.'+k))}`).join('<br>')}<br><a href="${link(S.admin?'lg-review':'lg-form')}">${t('lg.dv.missFix')}</a>`));
 if(d.status==='superseded'&&nxt)notes.push(ui.note('info',t('lg.dv.superseded',{n:`<a href="${link('lg-doc',nxt.id)}">${esc(nxt.number)}</a>`})));
 if(lg_isPending(d)&&d.kind==='change'&&d.effective)notes.push(ui.note(d.cls==='A'?'warn':'info',t(d.cls==='A'?'lg.dv.effA':'lg.dv.effB',{d:fmtDate(d.effective),c:d.cc?esc(ctyName(d.cc)):''})));
 if(d.decline)notes.push(ui.note('bad',t('lg.dec.note',{c:esc(d.decline.comment),n:esc(d.decline.by)})));
 const integ=d.hash?`<span id="lg-integ" data-doc="${esc(d.id)}" class="small muted">${t('lg.dv.integChk')}</span>`:'';
 const sigs=(d.signatures||[]).map(s=>`<li><b>${esc(s.name)}</b>, ${esc(s.title||'')} <span class="badge ${s.party==='ota'?'violet':'info'}">${s.party==='ota'?'OTA':t('lg.partner')}</span><div class="xs muted">${esc(lg_fmtUtc(s.at))} · ${esc(s.ip)} · ${esc(s.auth)} · <span class="mono">${esc(s.id)}</span></div></li>`).join('');
 const rem=lg_reminders(d);
 const side=`<div class="stack">${ui.card({title:t('lg.dv.details'),body:`<dl class="dl small lg-dl">
   <dt>${t('lg.col.num')}</dt><dd class="mono">${esc(d.number)}</dd><dt>${t('lg.col.no')}</dt><dd>${esc(lg_docNoLbl(d))}${d.cls&&d.type!=='CHG'?' · '+lg_clsBadge(d.cls):''}</dd>
   <dt>${t('lg.col.ver')}</dt><dd>v${d.ver} · ${esc(d.templateVer||'—')}</dd>${d.priceVer?`<dt>${t('lg.dv.pl')}</dt><dd>v${d.priceVer}</dd>`:''}
   <dt>${t('c.status')}</dt><dd>${lg_stBadge(d)}</dd><dt>${t('lg.col.eff')}</dt><dd>${d.effective?fmtDate(d.effective):t('lg.eff.onSign')}</dd>
   ${prev?`<dt>${t('lg.dv.supersedes')}</dt><dd><a class="mono" href="${link('lg-doc',prev.id)}">${esc(prev.number)}</a></dd>`:''}
   <dt>${t('lg.dv.issued')}</dt><dd>${d.issuedAt?fmtDateTime(d.issuedAt):'—'}</dd>
   ${d.hash?`<dt>SHA-256</dt><dd><span class="mono xs lg-hash">${esc(d.hash)}</span><br>${integ}</dd>`:''}</dl>`})}
  ${sigs?ui.card({title:t('lg.dv.sigs'),body:`<ul class="lg-sigl">${sigs}</ul>`}):''}
  ${rem.length?ui.card({title:t('lg.rem.title'),body:`<ul class="lg-rem">${rem.map(x=>`<li class="${x.sent?'sent':''}">${icon(x.sent?'check':'clock','sm')}<span>${t('lg.rem.n',{n:x.n})} · ${fmtDate(x.at)}${x.manual?' · '+t('lg.rem.manual'):''}</span></li>`).join('')}</ul><p class="xs muted" style="margin-top:8px">${t('lg.rem.copy')}</p>`,foot:S.admin?ui.btn(t('lg.rem.send'),{size:'sm',icon:'send',act:'lg_remind',arg:d.id})+ui.badge(t('lg.demo'),'violet'):''}):''}
  ${lg_docExtraCard(d)}
  ${lg_docAuditCard(d)}</div>`;
 return ui.page({title:esc(lg_docTitle(d)),sub:`<span class="mono">${esc(d.number)}</span>`,crumbs:[[t('lg.docs.title'),link('lg-docs')],[d.number]],actions:acts.join(''),
  body:`<div class="stack">${notes.join('')}<div class="lg-dvgrid"><div class="lgd-wrap">${r.error?'':r.html}</div>${side}</div></div>`});}
function lg_docExtraCard(d){const parts=[];
 if(d.type==='BOA'&&(d.status==='issued'||d.status==='signed_both')){parts.push(`<p class="small muted">${t('lg.boa.d')}</p>`);
  parts.push(`<div class="row wrap g8">${ui.btn(t('lg.boa.dl'),{size:'sm',icon:'download',act:'lg_print',arg:d.id})}${d.scan?ui.badge(t('lg.boa.got',{f:esc(d.scan.file)}),'ok',true):(can('p.form')||can('p.sign')?`<label class="btn sm primary"><input type="file" class="lg-sr" data-lgscan="${d.id}" accept=".pdf,.jpg,.png">${icon('upload','sm')}<span>${t('lg.boa.up')}</span></label>`:'')}</div>`);}
 if(d.status==='signed_both'||(d.type==='CHG'&&d.status==='acknowledged')){parts.push(`<p class="small muted">${t('lg.kep.d')}</p>${(d.kep||[]).map(k=>`<div class="small">${icon('file','sm')} ${esc(k.file)} · <span class="muted">${esc(k.by)} · ${fmtDate(k.at)}</span></div>`).join('')}
  ${can('p.form')||can('p.sign')||can('ota.sign')?`<div><label class="btn sm"><input type="file" class="lg-sr" data-lgkep="${d.id}" accept=".pdf,.p7s,.asice,.zip">${icon('upload','sm')}<span>${t('lg.kep.up')}</span></label></div>`:''}`);}
 if(lg_isPending(d)&&d.kind==='change'&&d.cls==='A'&&!S.admin&&!d.decline&&(can('p.sign')||can('p.form')))parts.push(`<p class="small muted">${t('lg.dec.d')}</p><div>${ui.btn(t('lg.dec.btn'),{size:'sm',kind:'danger',act:'lg_decline',arg:d.id})}</div>`);
 if(d.status!=='draft'&&!d.archived&&(S.admin?can('ota.versions'):can('p.form')))parts.push(`<div>${ui.btn(t('lg.arch.btn'),{size:'sm',kind:'ghost',icon:'box',act:'lg_archive',arg:d.id})}</div><p class="xs faint">${t('lg.arch.d')}</p>`);
 return parts.length?ui.card({title:t('lg.dv.more'),body:`<div class="col g12">${parts.join('')}</div>`}):'';}
function lg_docAuditCard(d){const es=(S.audit||[]).filter(e=>e.object===d.number).slice(-8).reverse();if(!es.length)return '';
 return ui.card({title:t('lg.au.title'),actions:`<a class="small" href="${link('lg-audit')}" data-act="lg_auFor" data-arg="${esc(d.number)}">${t('lg.au.all')}</a>`,body:`<ul class="lg-aul">${es.map(e=>`<li><span class="mono xs">${esc(lg_actLabel(e.action))}</span><span class="xs muted">${esc(e.actor)} · ${fmtDateTime(e.ts)}</span></li>`).join('')}</ul>`});}
async function lg_checkInteg(){const el=$('#lg-integ');if(!el||el.dataset.done)return;el.dataset.done='1';const d=lg_doc(el.dataset.doc);if(!d||!d.hash)return;
 const r=lg_renderDoc(d,{});const h=await lg_hash(r.text);if(!document.contains(el))return;el.innerHTML=h===d.hash?`<span class="lg-ok">${icon('shield','sm')} ${t('lg.dv.integOk')}</span>`:`<span class="lg-bad">${icon('alert','sm')} ${t('lg.dv.integBad')}</span>`;}
HOOKS.afterRender.push(()=>{lg_checkInteg();});

/* ---------- signing ---------- */
function lg_signListHtml(){lg_tick();const side=S.admin?'ota':'partner';const tasks=lg_tasks(side);
 const card=(x)=>{const d0=x.docs[0];let title,desc,btn;
  if(x.kind==='sign'||x.kind==='osign'){title=x.key==='pkg'?t('lg.sg.pkgT',{n:x.docs.length}):lg_docTitle(d0);desc=x.key==='pkg'?x.docs.map(d=>d.number).join(' · '):d0.number+' · '+lg_chgDesc(d0);btn=ui.btn(t(x.kind==='osign'?'lg.sg.osign':'lg.sg.open'),{kind:'primary',icon:'lg_pen',href:link('lg-signing',x.key)});}
  else if(x.kind==='ack'){title=lg_docTitle(d0);desc=d0.number+' · '+lg_chgDesc(d0);btn=ui.btn(t('lg.sg.ack'),{kind:'primary',icon:'check',href:link('lg-signing',x.key)});}
  else if(x.kind==='scan'){title=lg_docTitle(d0);desc=t('lg.boa.hint');btn=ui.btn(t('lg.sg.openDoc'),{href:link('lg-doc',d0.id)});}
  else if(x.kind==='review'){title=t('lg.sg.review');desc=t('lg.sg.reviewD');btn=ui.btn(t('lg.rv.title'),{kind:'primary',href:link('lg-review')});}
  else if(x.kind==='details'){title=t('lg.chg.reqT');desc=t('lg.sg.detailsD');btn=ui.btn(t('lg.rv.title'),{kind:'primary',href:link('lg-review')});}
  else if(x.kind==='decline'){title=t('lg.dec.title');desc=d0.number+' — “'+d0.decline.comment+'”';btn=ui.btn(t('lg.rv.title'),{href:link('lg-review')});}
  else if(x.kind==='detected'){title=t('lg.det.'+x.det.kind,{c:ctyName(x.det.cc)});desc=x.det.pl?t('lg.det.d',{v:x.det.pl.ver,d:fmtDate(x.det.pl.from)}):'';btn=ui.btn(t('lg.det.go'),{kind:'primary',href:link('lg-tpl'),act:'lg_tplTab',arg:'changes'});}
  const eff=d0&&d0.effective&&lg_isPending(d0)?`<span class="badge ${d0.cls==='A'?'warn':'info'}">${t('lg.col.eff')}: ${fmtDate(d0.effective)}</span>`:'';
  return `<div class="card lg-task"><div class="bd row wrap g12"><span class="lg-taskic">${icon(x.kind==='ack'?'check':x.kind==='scan'?'upload':x.kind==='review'||x.kind==='details'?'shield':x.kind==='detected'?'bolt':'lg_pen')}</span><div class="grow"><b>${esc(title)}</b><div class="small muted lg-ell">${esc(desc)}</div>${eff}</div>${btn}</div></div>`;};
 const who=lg_actor();
 const roleNote=side==='partner'&&lg_signCheck('partner')&&tasks.some(x=>x.kind==='sign')?ui.note('warn',t('lg.sg.who',{n:esc(lg_fval('P_SIGNATORY')||'—'),ti:esc(lg_fval('P_TITLE_EN')||'—')})+' '+(typeof ord_asBtn==='function'?ord_asBtn('p_sign'):'')):'';
 const otaNote=side==='ota'&&!can('ota.sign')&&tasks.some(x=>x.kind==='osign')?ui.note('admin',t('lg.sg.otaWho')+' '+(typeof ord_asBtn==='function'?ord_asBtn('ota_legal'):'')):'';
 return ui.page({title:t('lg.sg.title'),sub:t(side==='ota'?'lg.sg.subO':'lg.sg.sub'),crumbs:[[t('lg.sec'),link('lg-docs')],[t('lg.sg.title')]],
  body:`<div class="stack">${roleNote}${otaNote}${tasks.length?tasks.map(card).join(''):ui.card({body:ui.empty('check',t('lg.sg.none'),t('lg.sg.noneD'),ui.btn(t('lg.docs.title'),{href:link('lg-docs')}))})}
   <p class="xs faint">${t('lg.sg.as',{n:esc(who.name||''),r:esc(roleName(who.role))})}</p></div>`});}
function lg_signingHtml(key){lg_tick();const party=S.admin?'ota':'partner';let docs=lg_groupDocs(key,party);const single=key!=='pkg'?lg_doc(key):null;
 const isAck=single&&single.kind==='change'&&single.cls==='B'&&single.status==='issued'&&!S.admin;
 if(isAck)docs=[single];
 if(!docs.length)return ui.page({title:t('lg.sg.title'),crumbs:[[t('lg.sg.title'),link('lg-sign')],['—']],body:ui.card({body:ui.empty('check',t('lg.sg.nothing'),t('lg.sg.nothingD'),ui.btn(t('lg.docs.title'),{href:link('lg-docs')}))})});
 const chk=isAck?(can('p.confirm')?'':'role'):lg_signCheck(party);const L=S.ui.lg_sess||{};
 // viewed time (certificate) + audit "view" once per open
 S.ui.lg_viewed=S.ui.lg_viewed||{};const vkey=key+'|'+party;if(S.ui.lg_viewKey!==vkey){S.ui.lg_viewKey=vkey;docs.forEach(d=>{S.ui.lg_viewed[d.id]=iso(now());lg_audit('doc.view',d.number,{hash:d.hash,party});});}
 const pname=lg_fval('P_NAME')||(S.org&&S.org.name)||'';const oname=otaVal('OTA_NAME')||'OTA TECHNOLOGY DMCC';
 const body=docs.map(d=>{const r=lg_renderDoc(d,{});return `<div class="lg-sdoc"><div class="lg-sdh"><b>${esc(lg_docTitle(d))}</b><span class="mono xs">${esc(d.number)}</span></div><div class="lgd-wrap lgd-flat">${r.html}</div></div>`;}).join('');
 const agree=t(isAck?'lg.sg.agreeAck':'lg.sg.agree',{p:esc(party==='ota'?oname:pname)});
 const who=lg_actor();
 const block=chk?ui.note(party==='ota'?'admin':'warn',(chk==='match'?t('lg.sg.mismatch',{n:esc(who.name),ti:esc(who.title||'—'),pn:esc(lg_fval('P_SIGNATORY')||'—'),pt:esc(lg_fval('P_TITLE_EN')||'—')}):t(party==='ota'?'lg.sg.otaWho':(isAck?'lg.sg.ackWho':'lg.sg.roleOnly')))+' '+(typeof ord_asBtn==='function'?ord_asBtn(party==='ota'?'ota_legal':'p_sign'):'')):'';
 const decl=single&&single.kind==='change'&&single.cls==='A'&&party==='partner'&&!single.decline?ui.btn(t('lg.dec.btn'),{kind:'ghost',act:'lg_decline',arg:single.id}):'';
 return ui.page({title:t(isAck?'lg.sg.ackTitle':(party==='ota'?'lg.sg.otaTitle':'lg.sg.signTitle')),sub:docs.length>1?t('lg.sg.allIn',{n:docs.length}):esc(docs[0].number),crumbs:[[t('lg.sg.title'),link('lg-sign')],[key==='pkg'?t('lg.pkg.title'):docs[0].number]],
  body:`<div class="stack">${block}${docs.length>1?ui.note('info',t('lg.sg.oneAction')):''}
   <div class="card"><div class="lg-scrollbox" id="lg-sbox" tabindex="0" aria-label="${esc(t('lg.sg.box'))}">${body}<div class="lg-send" id="lg-send">${icon('check','sm')} ${t('lg.sg.end')}</div></div>
   <div class="ft lg-signft"><div class="col g8 grow"><span class="small muted" id="lg-scrollhint">${icon('down','sm')} ${t('lg.sg.scroll')}</span>
    <label class="chk small"><input type="checkbox" id="lg-agree" ${chk?'disabled':''}><span>${agree}</span></label></div>
    <div class="row wrap g8">${decl}${ui.btn(t(isAck?'lg.sg.ackBtn':'lg.sg.btn'),{kind:'primary',size:'lg',icon:isAck?'check':'lg_pen',act:isAck?'lg_ackGo':'lg_signGo',arg:key,id:'lg-signbtn',disabled:true})}</div></div></div></div>`});}
function lg_bindScroll(){const box=$('#lg-sbox');if(!box||box.dataset.bound)return;box.dataset.bound='1';const upd=()=>{const end=box.scrollTop+box.clientHeight>=box.scrollHeight-24;if(end)box.dataset.end='1';lg_signEnable();};
 box.addEventListener('scroll',upd,{passive:true});setTimeout(upd,60);const ag=$('#lg-agree');if(ag)ag.addEventListener('change',lg_signEnable);}
function lg_signEnable(){const box=$('#lg-sbox'),ag=$('#lg-agree'),btn=$('#lg-signbtn'),h=$('#lg-scrollhint');if(!box||!btn)return;const end=box.dataset.end==='1';
 if(h)h.innerHTML=end?`${icon('check','sm')} ${t('lg.sg.scrolled')}`:`${icon('down','sm')} ${t('lg.sg.scroll')}`;btn.disabled=!(end&&ag&&ag.checked&&!ag.disabled);}
/* ---------- templates & versions (OTA) ---------- */
function lg_tplHtml(){if(!S.admin)return lg_noOta();lg_tick();const tab=S.ui.lg_tplTab||'templates';const det=lg_detected();
 const tabs=`<div class="lg-tabs" role="tablist">${[['templates',t('lg.tp.tab.t')],['changes',t('lg.tp.tab.c')+(det.length?` <span class="lg-dot">${det.length}</span>`:'')],['public',t('lg.tp.tab.p')]].map(([k,l])=>`<button type="button" role="tab" aria-selected="${tab===k}" data-act="lg_tplTab" data-arg="${k}">${l}</button>`).join('')}</div>`;
 let body='';
 if(tab==='templates'){body=ui.card({pad:false,body:ui.table([{label:t('lg.col.no')},{label:t('lg.tp.type')},{label:t('lg.col.doc')},{label:t('lg.tp.cur')},{label:t('lg.col.eff')},{label:t('lg.col.cls')},{label:t('lg.tp.vers')}],
   LG_ALL_TYPES.map(tp=>{const b=lg_baseTpl(tp);const vs=lg_tplVersions(tp);const cur=vs.filter(v=>v.status==='released').pop();const dr=vs.find(v=>v.status==='draft');
    return{href:link('lg-tpled',tp),cells:[`<span class="mono small">${esc(b.docNo)}</span>`,`<span class="mono small">${tp}</span>`,`<b>${esc(lg_tplTitle(tp,'en'))}</b><div class="xs muted">${esc(lg_tplTitle(tp,'ru'))}</div>`,`<span class="mono small">${esc(cur.ver)}</span>${dr?' '+ui.badge(t('lg.tp.draftB',{v:dr.ver}),'warn'):''}`,fmtDate(cur.effective),lg_clsBadge(cur.cls||b.cls),String(vs.length)]};}))});}
 else if(tab==='changes'){
  const detCard=ui.card({title:t('lg.det.title'),body:det.length?`<div class="col g12">${det.map(x=>`<div class="lg-det"><div class="grow"><b>${esc(t('lg.det.'+x.kind,{c:ctyName(x.cc)}))}</b><div class="small muted">${x.pl?t('lg.det.d',{v:x.pl.ver,d:fmtDate(x.pl.from)}):''}${x.last?' · '+t('lg.det.cur',{n:esc(x.last.number),v:x.last.priceVer||'—'}):''}</div>
     <div class="row g8 wrap" style="margin-top:6px">${lg_clsBadge('A')} ${ui.badge(t(x.kind==='country'?'lg.ch.country':x.increase?'lg.ch.increase':'lg.ch.decrease'),x.increase?'warn':'info')} <span class="xs muted">${x.kind==='country'?t('lg.ch.r.country'):x.increase?t('lg.ch.r.increase',{d:fmtDate(x.pl.from)}):t('lg.ch.r.decrease')}</span></div></div>
     ${ui.btn(t('lg.det.issue'),{kind:'primary',icon:'send',act:'lg_issueOF',arg:x.cc,disabled:!(can('ota.release')||can('ota.prices'))})}</div>`).join('')}</div>`:`<p class="small muted">${t('lg.det.none')}</p>`,foot:`<span class="small muted grow">${t('lg.det.how')}</span><a class="btn sm" href="#prices">${icon('price','sm')}<span>${t('lg.rv.prices')}</span></a>`});
  const chs=lg_st().changes;
  const chRows=chs.map(c=>{const ds=c.docIds.map(lg_doc).filter(Boolean);return `<div class="lg-chg"><div class="row wrap between g8"><div class="row wrap g8">${lg_clsBadge(c.cls)}<b>${esc(c.type==='OF'?lg_docTitle({type:'OF',cc:c.cc}):lg_tplTitle(c.type,S.lang==='en'?'en':'ru'))}</b><span class="small muted">${esc(lg_chgKind(c))}</span></div><span class="xs muted">${fmtDateTime(c.createdAt)} · ${esc(c.by||'')}</span></div>
   ${c.note?`<div class="small">${esc(c.note)}</div>`:''}<div class="small muted">${t('lg.col.eff')}: ${c.effective?fmtDate(c.effective):t('lg.eff.onSign')}</div>
   ${ds.length?ui.table([{label:t('lg.col.num')},{label:t('c.status')},{label:t('lg.rem.title')},{label:''}],ds.map(d=>{const rem=lg_reminders(d);return{href:link('lg-doc',d.id),cells:[`<span class="mono small">${esc(d.number)}</span>`,lg_stBadge(d)+(d.decline?' '+ui.badge(t('lg.dec.b'),'bad'):''),rem.length?`<span class="xs">${rem.map(x=>`<span class="lg-remd ${x.sent?'sent':''}" title="${fmtDate(x.at)}">${x.n}</span>`).join('')}</span>`:'<span class="faint">—</span>',lg_isPending(d)?ui.btn(t('lg.rem.send'),{size:'sm',act:'lg_remind',arg:d.id}):'']};})):''}
   ${(c.pubIds||[]).length?`<div class="small">${c.pubIds.map(id=>{const p=lg_st().pub.find(x=>x.id===id);return p?`<span class="mono">${esc(p.number)}</span>`:'';}).join(' · ')}</div>`:''}</div>`;}).join('');
  body=`<div class="stack">${detCard}${ui.card({title:t('lg.ch.title'),body:chs.length?`<div class="col g16">${chRows}</div>`:`<p class="small muted">${t('lg.ch.none')}</p>`})}${ui.card({title:t('lg.cls.title'),body:lg_clsTable()})}</div>`;}
 else body=lg_pubHtml();
 return ui.page({title:t('lg.tp.title'),sub:t('lg.tp.sub'),crumbs:[[t('lg.otasec'),link('lg-review')],[t('lg.tp.title')]],body:`<div class="stack">${ui.note('admin',t('lg.tp.admin')+(can('ota.templates')?'':' '+(typeof ord_asBtn==='function'?ord_asBtn('ota_legal'):'')))}${tabs}${body}</div>`});}
function lg_chgKind(c){if(c.kind==='template')return t('lg.ch.k.tpl',{v:c.tplVer||''});if(c.sub==='increase')return t('lg.ch.increase');if(c.sub==='decrease')return t('lg.ch.decrease');if(c.sub==='new_country')return t('lg.ch.country');return '';}
function lg_clsTable(){return `<div class="tblwrap"><table class="tbl lg-clst"><thead><tr><th>${t('lg.col.cls')}</th><th>${t('lg.cls.what')}</th><th>${t('lg.cls.need')}</th><th>${t('lg.cls.term')}</th><th>${t('lg.cls.miss')}</th></tr></thead><tbody>
 ${['A','Anew','Adown','B','C'].map(k=>`<tr><td>${lg_clsBadge(k[0])} <span class="small">${t('lg.cls.r.'+k+'.n')}</span></td><td class="small">${t('lg.cls.r.'+k+'.w')}</td><td class="small">${t('lg.cls.r.'+k+'.q')}</td><td class="small">${t('lg.cls.r.'+k+'.t')}</td><td class="small">${t('lg.cls.r.'+k+'.m')}</td></tr>`).join('')}</tbody></table></div>`;}
function lg_tplEdHtml(type){if(!S.admin)return lg_noOta();const b=lg_baseTpl(type);if(!b)return ui.page({title:t('lg.e.noTpl',{t:type}),body:''});
 const vs=lg_tplVersions(type);const draft=vs.find(v=>v.status==='draft');const cur=lg_tpl(type);const ed=can('ota.templates');
 const blocks=cur.blocks.filter(x=>x.kind!=='table'&&x.kind!=='signature');const sel=S.ui.lg_edB&&blocks.find(x=>x.id===S.ui.lg_edB)?S.ui.lg_edB:(blocks.find(x=>x.kind==='clause')||blocks[0]).id;const blk=blocks.find(x=>x.id===sel);
 const src=draft&&draft.changes[sel]?Object.assign({},blk,draft.changes[sel]):blk;
 const hist=ui.table([{label:t('lg.tp.ver')},{label:t('lg.col.eff')},{label:t('lg.col.cls')},{label:t('lg.tp.note')},{label:t('c.status')}],vs.slice().reverse().map(v=>({cells:[`<span class="mono small">${esc(v.ver)}</span>`,fmtDate(v.effective),lg_clsBadge(v.cls),`<span class="small">${esc(v.note||(v.base?t('lg.tp.base'):''))}${Object.keys(v.changes||{}).length?` <span class="xs muted">(${Object.keys(v.changes).join(', ')})</span>`:''}</span>`,ui.badge(t('lg.tp.st.'+v.status),v.status==='released'?'ok':'warn')]})));
 const defCls=type==='EUT'||type==='PN'?'C':(b.cls||'B');const minEff=iso(addDays(now(),CLASS_A_NOTICE_DAYS)).slice(0,10);
 const editor=ui.card({title:draft?t('lg.tp.edDraft',{v:draft.ver}):t('lg.tp.edNew'),body:`<form data-form="lg_tplSave" class="col g12" novalidate>
   ${ui.field({id:'blk',label:t('lg.tp.block'),type:'select',value:sel,options:blocks.map(x=>[x.id,x.id+' — '+String(x.en||'').replace(/\{\{|\}\}/g,'').slice(0,60)]),attrs:'data-act="lg_edB"'})}
   <div class="grid2">${ui.field({id:'en',label:'EN',type:'textarea',value:src.en||'',rows:6,attrs:ed?'':'disabled'})}${ui.field({id:'ru',label:'RU ('+t('lg.tp.l2')+')',type:'textarea',value:src.ru||'',rows:6,attrs:ed?'':'disabled',hint:t('lg.tp.ruH')})}</div>
   <div class="grid3">${ui.field({id:'cls',label:t('lg.col.cls'),type:'select',value:draft?draft.cls:defCls,options:(type==='EUT'||type==='PN'?['C']:['A','B']).map(c=>[c,t('lg.cls.'+c)]),attrs:ed?'':'disabled'})}
    ${ui.field({id:'eff',label:t('lg.col.eff'),type:'date',value:(draft&&draft.effective||minEff).slice(0,10),attrs:(ed?'':'disabled ')+`min="${iso(now()).slice(0,10)}"`,hint:t('lg.tp.effH')})}
    ${ui.field({id:'note',label:t('lg.tp.note'),value:draft?draft.note:'',placeholder:t('lg.tp.notePh'),attrs:ed?'':'disabled'})}</div>
   <div class="row wrap g8">${ui.btn(draft?t('lg.tp.saveDraft'):t('lg.tp.saveNew'),{kind:'primary',type:'submit',disabled:!ed})}${draft?'':ui.btn(t('lg.tp.bump'),{act:'lg_tplBump',arg:type,disabled:!ed})}</div></form>`});
 let rel='';if(draft){const aff=lg_tplAffected(type,draft.ver);const r=type==='CHG'?null:lg_render(type,{tplVer:draft.ver,cc:orgCountries()[0],docNo:'[preview]'});
  rel=ui.card({title:t('lg.tp.rel',{v:draft.ver}),body:`<div class="col g12">${r&&r.error?r.html:ui.note('ok',t('lg.tp.relOk'))}
   <p class="small">${type==='EUT'||type==='PN'?t('lg.tp.affPub',{n:lg_pubCurrent(type).length}):t('lg.tp.aff',{n:aff.filter(d=>d.type!=='BOA').length})}</p>
   ${aff.length?`<ul class="lg-affl">${aff.map(d=>`<li><span class="mono small">${esc(d.number)}</span> → <span class="mono small">${esc(d.type==='BOA'?'—':docNo(d.type,{base:d.number}))}</span> ${lg_stBadge(d)}</li>`).join('')}</ul>`:''}</div>`,
   foot:`${ui.btn(t('lg.tp.preview'),{icon:'eye',act:'lg_tplPreview',arg:type})}${ui.btn(t('lg.tp.issue'),{kind:'primary',icon:'send',act:'lg_tplRelease',arg:type,disabled:!can('ota.release')||!!(r&&r.error)})}`});}
 return ui.page({title:`${esc(type)} · ${esc(lg_tplTitle(type,'en'))}`,sub:t('lg.tp.edSub',{v:cur.ver}),crumbs:[[t('lg.tp.title'),link('lg-tpl')],[type]],
  body:`<div class="stack">${ed?'':ui.note('admin',t('lg.tp.legalOnly')+' '+(typeof ord_asBtn==='function'?ord_asBtn('ota_legal'):''))}${rel}${editor}${ui.card({title:t('lg.tp.hist'),pad:false,body:hist})}</div>`});}
/* public docs 07/08 */
function lg_pubHtml(){const L=lg_st();const groups={};L.pub.forEach(p=>{const k=p.type+'|'+p.cc+'|'+p.lang;(groups[k]=groups[k]||[]).push(p);});
 const keys=Object.keys(groups).sort();
 const cards=keys.map(k=>{const [tp,cc,lang]=k.split('|');const list=groups[k].slice().sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt));const cur=list.find(p=>p.status==='current');
  return `<div class="lg-pubg"><div class="row between wrap g8"><div><b>${esc(lg_tplTitle(tp,S.lang==='en'?'en':'ru'))}</b> · ${esc(ctyName(cc))} · ${esc((LG_LANG2[lang]||{name:'English'}).name)}</div>
   <div class="row g8 wrap">${ui.btn(t('lg.pub.minor'),{size:'sm',act:'lg_pubNew',arg:k+'|minor',disabled:!can('ota.release')})}${ui.btn(t('lg.pub.major'),{size:'sm',act:'lg_pubNew',arg:k+'|major',disabled:!can('ota.release')})}</div></div>
   ${ui.table([{label:t('lg.col.num')},{label:t('lg.pub.date')},{label:t('lg.tp.ver')},{label:t('lg.pub.notified')},{label:''}],list.map(p=>({cells:[`<span class="mono small">${esc(p.number)}</span>${p.status==='current'?' '+ui.badge(t('lg.pub.cur'),'ok'):''}`,fmtDate(p.publishedAt),`<span class="mono xs">${esc(p.tplVer)}</span>`,
    p.notifiedAt?ui.badge(t('lg.pub.notifiedAt',{d:fmtDate(p.notifiedAt)}),'ok'):(p.status==='current'?ui.btn(t('lg.pub.notify'),{size:'sm',act:'lg_pubNotify',arg:p.id,disabled:!can('ota.release')}):'<span class="faint">—</span>'),ui.btn(t('lg.pub.web'),{size:'sm',kind:'ghost',icon:'globe',act:'lg_pubView',arg:p.id})]})))}</div>`;}).join('');
 const add=`<form data-form="lg_pubAdd" class="row wrap g8" style="align-items:flex-end">${ui.field({id:'type',label:t('lg.col.doc'),type:'select',value:'EUT',options:[['EUT','07 · End User Terms'],['PN','08 · Privacy Notice']]})}${ui.field({id:'cc',label:t('lg.pub.cc'),type:'select',value:orgCountries()[0],options:orgCountries().map(c=>[c,ctyName(c)])})}
  ${ui.field({id:'lang',label:t('lg.pub.lang'),type:'select',value:'ru',options:[['en','English']].concat(Object.keys(LG_LANG2).filter(l=>lg_langComplete(l)).map(l=>[l,LG_LANG2[l].name]))})}${ui.btn(t('lg.pub.add'),{type:'submit',icon:'plus',disabled:!can('ota.release')})}</form>`;
 return `<div class="stack">${ui.card({title:t('lg.pub.title'),body:`<div class="col g16"><p class="small muted">${t('lg.pub.d')}</p>${cards||`<p class="small muted">${t('lg.pub.none')}</p>`}</div>`,foot:add})}</div>`;}
function lg_pubView(id){const p=lg_st().pub.find(x=>x.id===id);if(!p)return;const r=lg_render(p.type,{cc:p.cc,public:p.lang==='en'?'en':p.lang,tplVer:p.tplVer,effective:p.effective,docVer:'v'+p.ver,lang2:p.lang==='en'?lg_l2():p.lang});
 modal(esc(lg_tplTitle(p.type,p.lang==='en'?'en':p.lang))+` <span class="xs muted mono">v${esc(p.ver)}</span>`,`<div class="lg-web"><div class="lg-webbar">${icon('globe','sm')}<span class="mono xs">https://${esc(lg_fval('P_DOMAIN')||'connect.brand.com')}/${p.type==='EUT'?'terms':'privacy'}</span></div><div class="lg-webbody">${r.html}</div>
  ${r.missing.length&&S.admin?ui.note('admin',t('lg.pub.miss',{k:r.missing.join(', ')})):''}</div>`,ui.btn(t('c.close'),{act:'ovclose'}),{wide:true});lg_audit('doc.view',p.number,{public:true});}

/* ---------- diff (side by side, changed blocks highlighted) ---------- */
function lg_diffHtml(id){const d=lg_doc(id);const p=d&&d.supersedes?lg_doc(d.supersedes):null;if(!d||!p)return ui.page({title:t('lg.e.noDoc'),body:''});
 const a=lg_renderDoc(p,{}),b=lg_renderDoc(d,{live:d.status==='draft'});const lang=S.ui.lg_dl||'en';const only=S.ui.lg_donly!==false;
 const amap={};a.blocks.forEach(x=>{amap[x.id]=x;});const bmap={};b.blocks.forEach(x=>{bmap[x.id]=x;});
 const ids=[];b.blocks.forEach(x=>ids.push(x.id));a.blocks.forEach((x,i)=>{if(!bmap[x.id])ids.splice(Math.min(i,ids.length),0,x.id);});
 const pick=x=>x?(lang==='en'?x.en:x.l2):'';let nch=0;
 const rows=ids.map(k=>{const x=amap[k],y=bmap[k];const ch=pick(x)!==pick(y);if(ch)nch++;if(only&&!ch)return '';
  return `<div class="lg-drow ${ch?'ch':''}"><div class="lg-dc">${x?lg_diffMark(pick(x),pick(y),'del'):`<span class="faint">${t('lg.df.added')}</span>`}</div><div class="lg-dc">${y?lg_diffMark(pick(y),pick(x),'ins'):`<span class="faint">${t('lg.df.removed')}</span>`}</div></div>`;}).join('');
 return ui.page({title:t('lg.df.title'),sub:`<span class="mono">${esc(p.number)}</span> → <span class="mono">${esc(d.number)}</span>`,crumbs:[[t('lg.docs.title'),link('lg-docs')],[d.number,link('lg-doc',d.id)],[t('lg.df.title')]],
  actions:`${ui.seg('lg-dl',[['en','EN'],['l2',(LG_LANG2[d.lang2||lg_l2()]||{}).name||'L2']],lang,'lg_dl')}<label class="chk small"><input type="checkbox" data-act="lg_donly" ${only?'checked':''}><span>${t('lg.df.only')}</span></label>`,
  body:`<div class="stack">${ui.note('info',t('lg.df.sum',{n:nch,e:d.effective?fmtDate(d.effective):t('lg.eff.onSign')}))}<div class="card"><div class="lg-dhead"><div>v${p.ver} · ${esc(p.templateVer||'')}${p.priceVer?' · '+t('lg.dv.pl')+' v'+p.priceVer:''}</div><div>v${d.ver} · ${esc(d.templateVer||'')}${d.priceVer?' · '+t('lg.dv.pl')+' v'+d.priceVer:''}</div></div><div class="lg-diff">${rows||`<div class="bd small muted">${t('lg.df.none')}</div>`}</div></div></div>`});}
// word-level highlight of what differs
function lg_diffMark(s,o,cls){if(s===o)return esc(s).replace(/\n/g,'<br>');const A=String(s).split(/(\s+)/),B=new Set(String(o||'').split(/(\s+)/));return A.map(w=>!/^\s+$/.test(w)&&!B.has(w)?`<${cls}>${esc(w)}</${cls}>`:esc(w)).join('').replace(/\n/g,'<br>');}

/* ---------- audit log ---------- */
const LG_AU_CATS={docs:/^(doc\.|pkg\.|change\.|tpl\.|pub\.|notice\.)/,form:/^(form\.|details\.|kyc\.|review\.|partner\.code)/,sign:/^doc\.(sign|ack|otp|view|download|kep|boa)/,orders:/^(order\.|invoice\.|keys\.|tokens\.|creditnote\.|shipment\.|pricelist\.|activation)/,system:/^(ota\.|user\.|demo\.|partner\.signup)/};
function lg_auCan(){return can('ota.audit')||lg_role()==='p_admin';}
function lg_auList(){const q=(S.ui.lg_auq||'').toLowerCase().trim();const cat=S.ui.lg_auc||'all';const who=S.ui.lg_auw||'';
 let es=(S.audit||[]).slice();if(!lg_isOta())es=es.filter(e=>!/^(ota\.mode|user\.switch)/.test(e.action));
 if(cat!=='all'&&LG_AU_CATS[cat])es=es.filter(e=>LG_AU_CATS[cat].test(e.action));if(who)es=es.filter(e=>e.role===who);
 if(q)es=es.filter(e=>(e.action+' '+e.object+' '+e.actor+' '+e.email+' '+JSON.stringify(e.details||{})).toLowerCase().includes(q));
 return es.map((e,i)=>[e,i]).sort((a,b)=>a[0].ts<b[0].ts?1:a[0].ts>b[0].ts?-1:b[1]-a[1]).map(x=>x[0]);}
function lg_auditHtml(){if(!lg_auCan())return ui.page({title:t('lg.au.title'),body:ui.card({body:ui.empty('shield',t('lg.au.noT'),t('lg.au.noD'),(typeof ord_asBtn==='function'?ord_asBtn(S.admin?'ota_legal':'p_admin'):''))})});
 const es=lg_auList();const pg=+(S.ui.lg_aupg||1);const per=50;const page=es.slice((pg-1)*per,pg*per);
 const cats=[['all',t('c.all')],['docs',t('lg.au.c.docs')],['sign',t('lg.au.c.sign')],['form',t('lg.au.c.form')],['orders',t('lg.au.c.orders')],['system',t('lg.au.c.system')]];
 const det=e=>{const d=Object.assign({},e.details||{});delete d.hash;const s=Object.keys(d).map(k=>k+': '+(typeof d[k]==='object'?JSON.stringify(d[k]):d[k])).join(' · ');return s.length>140?s.slice(0,137)+'…':s;};
 const tbl=ui.table([{label:t('lg.au.when')},{label:t('lg.au.who')},{label:t('lg.au.what')},{label:t('lg.au.obj')},{label:'IP / UA'},{label:t('lg.au.hash')}],page.map(e=>({cells:[
  `<span class="small num">${fmtDateTime(e.ts)}</span>`,`<b class="small">${esc(e.actor||'—')}</b><div class="xs muted">${esc(e.role?roleName(e.role):'')}${e.email?' · '+esc(e.email):''}</div>`,
  `<span class="xs lg-act" title="${esc(e.action)}">${esc(lg_actLabel(e.action))}</span><div class="xs muted lg-audet">${esc(det(e))}</div>`,`<span class="mono xs">${esc(e.object||'')}</span>`,`<span class="mono xs">${esc(e.ip||'')}</span><div class="xs faint lg-ua" title="${esc(e.ua||'')}">${esc((e.ua||'').slice(0,40))}</div>`,
  `<span class="mono xs faint">${esc(((e.hash||(e.details&&e.details.hash))||'').slice(0,12))}${(e.hash||(e.details&&e.details.hash))?'…':''}</span>`]})),{empty:ui.empty('search',t('c.nothing'),'')});
 return ui.page({title:t('lg.au.title'),sub:t('lg.au.sub'),crumbs:[[lg_isOta()?t('lg.otasec'):t('lg.sec'),lg_isOta()?link('lg-review'):link('lg-docs')],[t('lg.au.title')]],
  actions:`${ui.btn(t('lg.au.csv'),{icon:'download',act:'lg_auCsv'})}${ui.btn(t('lg.au.pdf'),{icon:'printer',act:'lg_auPdf'})}`,
  body:`<div class="stack">${ui.note('info',t('lg.au.append'))}${ui.card({pad:false,body:`<div class="toolbar lg-autb"><input class="inp" type="search" placeholder="${t('lg.au.search')}" value="${esc(S.ui.lg_auq||'')}" data-lgui="lg_auq" aria-label="${t('c.search')}">
   ${ui.seg('lg-auc',cats,S.ui.lg_auc||'all','lg_auc')}<select class="inp" data-act="lg_auw" aria-label="${t('lg.au.who')}" style="max-width:200px"><option value="">${t('lg.au.allRoles')}</option>${Object.keys(ROLES).map(r=>`<option value="${r}" ${S.ui.lg_auw===r?'selected':''}>${esc(roleName(r))}</option>`).join('')}</select><span class="small muted">${t('lg.au.n',{n:fmtNum(es.length)})}</span></div>
   <div class="lg-aut">${tbl}</div>${es.length>per?ui.pager(pg,es.length,per,'lg_aupg'):''}`})}</div>`});}
function lg_csvCell(v){const s=String(v==null?'':v);return /[",\n;]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
function lg_auCsvText(es){const head=['id','timestamp_utc','actor','email','role','action','object','details','ip','user_agent','hash'];
 return [head.join(',')].concat(es.map(e=>[e.id,e.ts,e.actor,e.email,e.role,e.action,e.object,JSON.stringify(e.details||{}),e.ip,e.ua,e.hash||(e.details&&e.details.hash)||''].map(lg_csvCell).join(','))).join('\n');}
/* ---------- routes & navigation ---------- */
route('lg-docs',{nav:'lg-docs',render:lg_docsHtml});
route('lg-form',{nav:'lg-form',render:lg_formHtml});
route('lg-doc',{nav:'lg-docs',render:lg_docHtml});
route('lg-diff',{nav:'lg-docs',render:lg_diffHtml});
route('lg-sign',{nav:'lg-sign',render:lg_signListHtml});
route('lg-signing',{nav:'lg-sign',render:lg_signingHtml});
route('lg-review',{nav:'lg-review',render:lg_reviewHtml});
route('lg-tpl',{nav:'lg-tpl',render:lg_tplHtml});
route('lg-tpled',{nav:'lg-tpl',render:lg_tplEdHtml});
route('lg-audit',{nav:'lg-audit',render:lg_auditHtml});
const lg_sec=()=>t('lg.sec');
nav({key:'lg-docs',label:()=>t('lg.nav.docs'),icon:'layers',href:'#lg-docs',section:lg_sec,order:60});
nav({key:'lg-form',label:()=>t('lg.nav.form'),icon:'file',href:'#lg-form',section:lg_sec,order:61,count:()=>{if(!S.org||lg_st().submitted)return null;const p=lg_progress();return p.ok?null:p.total-p.done;}});
nav({key:'lg-sign',label:()=>t('lg.nav.sign'),icon:'lg_pen',href:'#lg-sign',section:lg_sec,order:62,count:()=>S.org?(lg_tasks().length||null):null});
nav({key:'lg-audit',label:()=>t('lg.nav.audit'),icon:'lg_hist',href:'#lg-audit',section:lg_sec,order:63});
nav({key:'lg-review',label:()=>t('lg.nav.review'),icon:'shield',href:'#lg-review',section:()=>t('lg.otasec'),order:96,admin:true,count:()=>{const L=lg_st();return (L.submitted&&!L.review)||(L.detailReq&&L.detailReq.status==='pending')?1:null;}});
nav({key:'lg-tpl',label:()=>t('lg.nav.tpl'),icon:'lg_hist',href:'#lg-tpl',section:()=>t('lg.otasec'),order:97,admin:true,count:()=>S.org?(lg_detected().length||null):null});

/* ---------- events ---------- */
document.addEventListener('change',e=>{const el=e.target;if(!el||!el.dataset)return;const ds=el.dataset;
 if(ds.lgf){lg_onField(ds.lgf,el);return;}
 if(ds.lgtm!=null){if(!lg_canEditForm())return;const [i,c]=ds.lgtm.split(':');const f=lg_form('P_TM_LIST');const arr=(f&&Array.isArray(f.value)?f.value:[]).map(x=>Object.assign({},x));if(!arr[+i])return;arr[+i][c]=el.value.trim();lg_fset('P_TM_LIST',arr);save();lg_refreshProgress();return;}
 if(ds.lgdev!=null){if(!lg_canEditForm())return;const [cc,i,c]=ds.lgdev.split(':');const k=lg_ccKey('DEVICES',cc);const arr=lg_devices(cc,true).map(x=>Object.assign({},x));if(!arr[+i])return;arr[+i][c]=el.value.trim();arr[+i].ok=false;lg_fset(k,arr);save();lg_refreshProgress();return;}
 if(ds.lgdevok!=null){const [cc,i]=ds.lgdevok.split(':');const k=lg_ccKey('DEVICES',cc);const arr=lg_devices(cc,true).map(x=>Object.assign({},x));if(!arr[+i])return;arr[+i].ok=el.checked;lg_fset(k,arr,{silent:true});lg_audit('form.device.'+(el.checked?'approve':'unapprove'),cc,{model:arr[+i].DEV_MODEL});save();rerender();return;}
 if(ds.lgkyc){if(!can('ota.settings'))return;const L=lg_st();if(el.checked)L.kyc[ds.lgkyc]={at:iso(now()),by:actorName()};else delete L.kyc[ds.lgkyc];lg_audit('kyc.check',ds.lgkyc,{ok:el.checked});rerender();return;}
 if(ds.lgui){if((S.ui[ds.lgui]||'')===el.value)return;S.ui[ds.lgui]=el.value;if(ds.lgui==='lg_auq')S.ui.lg_aupg=1;setTimeout(rerender,0);return;}
 if(el.type==='file'){const name=lg_fileName(el.value);if(!name)return;
  if(ds.lgfile){if(!lg_canEditForm())return;lg_fset(ds.lgfile,name);lg_audit('form.file',ds.lgfile,{file:name});if(!lg_issuedAny())lg_syncOrg();toast(t('lg.t.file',{f:esc(name)}));rerender();return;}
  if(ds.lgscan){const d=lg_doc(ds.lgscan);if(!d)return;d.scan={file:name,at:iso(now()),by:actorName()};d.status='signed_both';d.effective=d.effective||iso(now());lg_audit('doc.boa.upload',d.number,{file:name,hash:d.hash});toast(t('lg.t.scan',{f:esc(name)}));rerender();return;}
  if(ds.lgkep){const d=lg_doc(ds.lgkep);if(!d)return;d.kep=d.kep||[];d.kep.push({file:name,at:iso(now()),by:actorName()});lg_audit('doc.kep.upload',d.number,{file:name,hash:d.hash});toast(t('lg.t.kep',{f:esc(name)}));rerender();return;}}});
function lg_busy(on){const b=document.activeElement;if(b&&b.tagName==='BUTTON')b.disabled=!!on;}
function lg_failNote(res){const f=(res&&res.err)||[];if(!Array.isArray(f))return t('lg.e.generic');const tr=f.find(x=>x.r&&x.r.error==='no_translation');if(tr)return t('lg.e.stopD',{l:LG_LANG2[lg_l2()].en,ids:tr.r.untranslated.join(', ')});
 return f.map(x=>`${x.d?x.d.number:''}: ${(x.r.missing||[]).join(', ')}`).join(' · ');}

Object.assign(ACT,{
 lg_jump(k){const el=document.querySelector(`[data-k="${CSS.escape(k)}"]`);if(el){el.scrollIntoView({block:'center',behavior:'smooth'});const i=el.querySelector('input,select,textarea');if(i)setTimeout(()=>i.focus({preventScroll:true}),300);}},
 lg_comment(k){const f=lg_form(k)||{};modal(t('lg.cmt.title'),`<form data-form="lg_cmt" class="col g12" id="lg-cmtf"><input type="hidden" name="k" value="${esc(k)}"><p class="small muted">${t('lg.cmt.d',{f:esc(t('lg.f.'+k.split('@')[0]))})}</p>${ui.field({id:'cmt',label:t('lg.cmt.lbl'),type:'textarea',value:f.comment||t('lg.cmt.def'),rows:3})}</form>`,
  `${ui.btn(t('c.cancel'),{act:'ovclose'})}<button class="btn primary" type="submit" form="lg-cmtf">${t('lg.cmt.send')}</button>`);},
 lg_submit(){if(!lg_canEditForm())return;const p=lg_progress();if(!p.ok){toast(t('lg.t.notDone',{n:p.left.length}),'bad');ACT.lg_jump(p.left[0].k);return;}
  const L=lg_st();L.submitted={at:iso(now()),by:actorName()};lg_syncOrg();lg_audit('form.submit',(S.org&&S.org.code)||'',{fields:p.total});log(t('lg.log.submitted'));toast(t('lg.t.submitted'));rerender();},
 lg_tmAdd(){if(!lg_canEditForm())return;const f=lg_form('P_TM_LIST');const arr=(f&&Array.isArray(f.value)?f.value:[]).slice();arr.push({TM_MARK:lg_fval('P_BRAND')||'',TM_REGNO:'',TM_COUNTRIES:'',TM_CLASSES:''});lg_fset('P_TM_LIST',arr);rerender();},
 lg_tmDel(i){if(!lg_canEditForm())return;const f=lg_form('P_TM_LIST');const arr=(f&&Array.isArray(f.value)?f.value:[]).slice();arr.splice(+i,1);lg_fset('P_TM_LIST',arr);rerender();},
 lg_devAdd(cc){if(!lg_canEditForm())return;const arr=lg_devices(cc,true).slice();arr.push({DEV_BRAND:lg_fval('P_BRAND')||'',DEV_MODEL:'',DEV_HW:'',DEV_FW:'',DEV_PLAN:'',DEV_MB:'',DEV_SIM:'',ok:false});lg_fset(lg_ccKey('DEVICES',cc),arr);rerender();},
 lg_devDel(a){if(!lg_canEditForm())return;const [cc,i]=a.split(':');const arr=lg_devices(cc,true).slice();arr.splice(+i,1);lg_fset(lg_ccKey('DEVICES',cc),arr);rerender();},
 lg_devPrefill(cc){if(!lg_canEditForm())return;const arr=lg_devices(cc,true).slice();let n=0;allModels().forEach(x=>{if(arr.some(d=>d.DEV_MODEL===x.model.name))return;
   arr.push({DEV_BRAND:x.brand.name,DEV_MODEL:x.model.name,DEV_HW:'',DEV_FW:'',DEV_PLAN:x.model.plan?PLAN_EN[x.model.plan]:'',DEV_MB:'',DEV_SIM:'',ok:false});n++;});
  lg_fset(lg_ccKey('DEVICES',cc),arr);toast(n?t('lg.t.prefill',{n}):t('lg.t.prefill0'),n?'':'bad');rerender();},
 lg_chgReq(g){const grp=LG_GROUPS.find(x=>x.id===g);if(!grp)return;const L=lg_st();if(L.detailReq&&L.detailReq.status==='pending'){toast(t('lg.chg.pending'),'bad');return;}
  modal(t('lg.chg.reqT'),`<form data-form="lg_chgReq" id="lg-chgf" class="col g12"><input type="hidden" name="g" value="${g}">${ui.note('info',t('lg.chg.reqD'))}${grp.fields.filter(k=>lg_fieldOn(k)&&!['P_AUTHORITY','P_AUTHORITY_FILE','P_COUNTRY','P_REGNO','P_FORM_EN','P_FORM_L2','P_TAXNO'].includes(k)).map(k=>ui.field({id:'f_'+k,label:t('lg.f.'+k),value:lg_fval(k)||'',type:LG_FTYPE[k]==='textarea'?'textarea':'text',rows:2})).join('')}</form>`,
   `${ui.btn(t('c.cancel'),{act:'ovclose'})}<button class="btn primary" type="submit" form="lg-chgf">${t('lg.chg.send')}</button>`,{wide:true});},
 lg_chgApprove(){if(!(can('ota.settings')||can('ota.release')))return;lg_then(lg_approveDetails({}),res=>{if(res&&res.err){toast(lg_failNote(res),'bad');}else toast(t('lg.t.chgOk'));rerender();});},
 lg_chgReject(){const L=lg_st();if(!L.detailReq)return;L.detailReq.status='rejected';L.detailReq.decidedAt=iso(now());L.detailReq.decidedBy=actorName();lg_audit('details.reject','',{});toast(t('lg.t.chgRej'));rerender();},
 lg_approveReview(){const rr=lg_reviewReady();if(!Object.values(rr).every(Boolean))return;const L=lg_st();L.review={at:iso(now()),by:actorName()};lg_audit('review.approve',(S.org&&S.org.code)||'',{kyc:Object.keys(L.kyc)});log(t('lg.log.review'));toast(t('lg.t.review'));rerender();},
 lg_setBrandDoc(v){if(!(can('ota.settings')||can('ota.na')))return;if(lg_issuedAny()){toast(t('lg.locked.d'),'bad');return;}lg_fset('P_TM_OWNER_IS_PARTNER',v);lg_audit('form.brand_doc',v==='yes'?'05A':'05B',{});rerender();},
 lg_naSet(k){if(!can('ota.na'))return;modal(t('lg.na.title'),`<form data-form="lg_na" id="lg-naf" class="col g12"><input type="hidden" name="k" value="${esc(k)}"><p class="small">${t('lg.na.d',{f:`<b>${esc(t('lg.f.'+k.split('@')[0]))}</b>`})}</p>${ui.field({id:'reason',label:t('lg.na.reason'),value:(lg_form(k)||{}).comment||'',attrs:'required'})}</form>`,
  `${ui.btn(t('c.cancel'),{act:'ovclose'})}<button class="btn primary" type="submit" form="lg-naf">${t('lg.na.set')}</button>`);},
 lg_naClear(k){if(!can('ota.na'))return;const f=lg_form(k);if(!f)return;f.status=(f.value!=null&&String(f.value).trim()!=='')?'filled':'empty';delete f.naReason;lg_audit('form.na.clear',k,{});toast(t('lg.t.naClr'));rerender();},
 lg_rvOpen(v){S.ui.lg_rvOpen=!!v;rerender();},
 lg_generate(){if(!(can('ota.release')||can('ota.settings')))return;if(!lg_st().review){toast(t('lg.pkg.emptyD.review'),'bad');return;}const r=lg_generate();toast(t('lg.t.gen',{n:r.made.length+r.kept.length}));rerender();},
 lg_issuePkg(){if(!(can('ota.release')||can('ota.settings')))return;const ds=lg_pkgDocs().filter(d=>d.status==='draft');lg_busy(true);
  lg_then(lg_issueDocs(ds),res=>{if(res.err){modal(t('lg.e.issueT'),`<div class="col g12">${ui.note('bad',t('lg.e.issueD'))}<p class="small">${esc(lg_failNote(res))}</p></div>`,ui.btn(t('c.close'),{act:'ovclose'}));lg_busy(false);return;}
   log(t('lg.log.issued',{n:res.ok.length}));toast(t('lg.t.issued',{n:res.ok.length}));rerender();});},
 lg_print(id){lg_printView(id);},lg_printNoAuto(id){lg_printView(id,{noAuto:true});},lg_doPrint(){lg_doPrint();},
 lg_df(v){S.ui.lg_df=v;S.ui.lg_dpg=1;rerender();},lg_arch(v){S.ui.lg_arch=!!v;rerender();},lg_dpg(p){S.ui.lg_dpg=Math.max(1,+p);rerender();},
 lg_tplTab(v){S.ui.lg_tplTab=v||'templates';if(parseHash().name!=='lg-tpl')go('lg-tpl');else rerender();},
 lg_pubView(id){lg_pubView(id);},
 lg_remind(id){const d=lg_doc(id);if(!d)return;const rem=lg_reminders(d);const nx=rem.find(x=>!x.sent)||rem[rem.length-1];const L=lg_st();if(nx)L.reminders.push({docId:id,n:nx.n,at:iso(now()),by:actorName()});
  lg_audit('doc.reminder',d.number,{days:nx?nx.n:null,to:lg_fval('P_EMAIL_LEGAL')||'',cc:'OTA manager'});toast(t('lg.t.remind',{e:esc(lg_fval('P_EMAIL_LEGAL')||'partner')}));rerender();},
 lg_decline(id){modal(t('lg.dec.title'),`<form data-form="lg_decl" id="lg-declf" class="col g12"><input type="hidden" name="id" value="${esc(id)}">${ui.note('warn',t('lg.dec.rule'))}${ui.field({id:'cmt',label:t('lg.dec.cmt'),type:'textarea',rows:3,attrs:'required'})}</form>`,
  `${ui.btn(t('c.cancel'),{act:'ovclose'})}<button class="btn danger" type="submit" form="lg-declf">${t('lg.dec.send')}</button>`);},
 lg_declHandled(id){const d=lg_doc(id);if(!d||!d.decline)return;d.decline.handled={at:iso(now()),by:actorName()};lg_audit('doc.decline.handled',d.number,{});rerender();},
 lg_archive(id){const d=lg_doc(id);if(!d)return;modal(t('lg.arch.btn'),`<p>${t('lg.arch.q',{n:`<b class="mono">${esc(d.number)}</b>`})}</p>`,`${ui.btn(t('c.cancel'),{act:'ovclose'})}${ui.btn(t('lg.arch.btn'),{kind:'primary',act:'lg_archiveGo',arg:id})}`);},
 lg_archiveGo(id){const d=lg_doc(id);if(!d)return;d.archived=true;lg_audit('doc.archive',d.number,{hash:d.hash});closeOverlay();toast(t('lg.t.arch',{n:esc(d.number)}));go('lg-docs');},
 lg_signGo(key){const party=S.admin?'ota':'partner';if(lg_signCheck(party))return;const docs=lg_groupDocs(key,party);if(!docs.length)return;
  const code=String(Math.floor(100000+Math.random()*900000));const a=lg_actor();const to=party==='ota'?(a.email||otaVal('OTA_EMAIL_LEGAL')||''):(a.email||lg_fval('P_EMAIL_LEGAL')||'');
  S.ui.lg_otp={code,key,party,at:iso(now()),to};lg_audit('doc.otp.sent',key==='pkg'?t('lg.pkg.title'):docs[0].number,{to,channel:'email'});
  modal(t('lg.otp.title'),`<form data-form="lg_otp" id="lg-otpf" class="col g12" novalidate><p class="small">${t('lg.otp.d',{e:`<b>${esc(lg_mask(to))}</b>`,n:docs.length})}</p>
   ${ui.field({id:'otp',label:t('lg.otp.lbl'),mono:true,attrs:'inputmode="numeric" autocomplete="one-time-code" maxlength="6" style="max-width:180px;letter-spacing:.3em;font-size:18px"'})}
   <p class="xs muted">${t('lg.otp.legal')}</p></form>`,`<button type="button" class="btn ghost" data-act="lg_otpResend">${t('lg.otp.resend')}</button>${ui.btn(t('c.cancel'),{act:'ovclose'})}<button class="btn primary" type="submit" form="lg-otpf">${icon('lg_pen','sm')}<span>${t('lg.otp.go',{n:docs.length})}</span></button>`);
  toast(t('lg.otp.toast',{e:esc(lg_mask(to)),c:code})+(S.admin?' · demo':''));},
 lg_otpResend(){const o=S.ui.lg_otp;if(!o)return;o.code=String(Math.floor(100000+Math.random()*900000));o.at=iso(now());toast(t('lg.otp.toast',{e:esc(lg_mask(o.to)),c:o.code}));},
 lg_ackGo(key){const d=lg_doc(key);if(!d||!can('p.confirm'))return;lg_ack(d);toast(t('lg.t.ack',{n:esc(d.number)}));go('lg-doc',d.id);},
 lg_auFor(n){S.ui.lg_auq=n;S.ui.lg_auc='all';S.ui.lg_aupg=1;go('lg-audit');},
 lg_issueOF(cc){if(!(can('ota.release')||can('ota.prices')))return;lg_busy(true);lg_then(lg_issueOF(cc),res=>{if(res.err){toast(lg_failNote(res),'bad');lg_busy(false);rerender();return;}
  toast(t('lg.t.ofIssued',{n:esc(res.ok[0].number)}));log(t('lg.t.ofIssued',{n:res.ok[0].number}));rerender();});},
 lg_edB(v){S.ui.lg_edB=v;rerender();},
 lg_tplBump(type){if(!can('ota.templates'))return;lg_tplSave(type,{},{cls:type==='EUT'||type==='PN'?'C':((lg_baseTpl(type)||{}).cls||'B'),effective:iso(addDays(now(),CLASS_A_NOTICE_DAYS)),note:t('lg.tp.bumpNote')});toast(t('lg.t.tplSaved'));rerender();},
 lg_tplPreview(type){const vs=lg_tplVersions(type);const dr=vs.find(v=>v.status==='draft');if(!dr)return;const r=lg_render(type,{tplVer:dr.ver,cc:orgCountries()[0],docNo:'[preview]',draft:true});
  if(r.error){modal(t('lg.e.stopT'),r.html,ui.btn(t('c.close'),{act:'ovclose'}));lg_audit('tpl.preview.error',dr.ver,{untranslated:r.untranslated});return;}lg_printView(r,{noAuto:true});},
 lg_tplRelease(type){if(!can('ota.release'))return;const dr=lg_tplVersions(type).find(v=>v.status==='draft');if(!dr)return;lg_busy(true);
  lg_then(lg_tplRelease(type,dr.ver),res=>{if(res.err){const r=res.err[0]&&res.err[0].r;modal(t('lg.e.stopT'),r&&r.error?r.html:ui.note('bad',esc(lg_failNote(res))),ui.btn(t('c.close'),{act:'ovclose'}));lg_audit('tpl.release.error',dr.ver,{});lg_busy(false);rerender();return;}
   toast(t('lg.t.released',{v:dr.ver,n:(res.ok||[]).length+((res.pub||[]).length)}));rerender();});},
 lg_pubNew(a){if(!can('ota.release'))return;const [tp,cc,lang,kind]=a.split('|');const p=lg_pubPublish(tp,cc,lang,{major:kind==='major'});toast(t('lg.t.pub',{n:esc(p.number)}));rerender();},
 lg_pubNotify(id){const p=lg_st().pub.find(x=>x.id===id);if(!p)return;p.notifiedAt=iso(now());lg_audit('pub.notified',p.number,{to:lg_fval('P_EMAIL_LEGAL')||''});toast(t('lg.t.notified'));rerender();},
 lg_dl(v){S.ui.lg_dl=v;rerender();},lg_donly(v){S.ui.lg_donly=!!v;rerender();},
 lg_auc(v){S.ui.lg_auc=v;S.ui.lg_aupg=1;rerender();},lg_auw(v){S.ui.lg_auw=v;S.ui.lg_aupg=1;rerender();},lg_aupg(p){S.ui.lg_aupg=Math.max(1,+p);rerender();},
 lg_auCsv(){if(!lg_auCan())return;const es=lg_auList();const blob=new Blob(['﻿'+lg_auCsvText(es)],{type:'text/csv;charset=utf-8'});lg_audit('audit.export','csv',{rows:es.length});cx_saveFile('audit_'+((S.org&&S.org.code)||'PPP')+'_'+iso(now()).slice(0,10)+'.csv',blob);},
 lg_auPdf(){if(!lg_auCan())return;lg_audit('audit.export','pdf',{});document.body.classList.add('lg-printing-audit');const done=()=>{document.body.classList.remove('lg-printing-audit');window.removeEventListener('afterprint',done);};window.addEventListener('afterprint',done);try{window.print();}catch(e){}setTimeout(done,1500);},
});
function lg_mask(e){const s=String(e||'');const m=s.match(/^(.)(.*)(@.*)$/);return m?m[1]+'•••'+m[3]:s;}
Object.assign(FORM,{
 lg_cmt(f){const d=formData(f);const k=d.k;const fl=S.form[k]||(S.form[k]={value:null,status:'empty',comment:'',by:'',at:''});fl.comment=String(d.cmt||'').trim();fl.by=actorName();fl.at=iso(now());lg_audit('form.comment',k,{comment:fl.comment});closeOverlay();toast(t('lg.t.cmt'));rerender();},
 lg_na(f){const d=formData(f);clearErrs(f);if(!String(d.reason||'').trim()){setErr(f,'reason',t('lg.na.reasonReq'));return;}const fl=S.form[d.k]||(S.form[d.k]={value:null,status:'empty',comment:'',by:'',at:''});
  fl.status='na';fl.naReason=d.reason.trim();fl.naBy=actorName();fl.naAt=iso(now());lg_audit('form.na',d.k,{reason:fl.naReason});closeOverlay();toast(t('lg.t.na',{f:esc(t('lg.f.'+d.k.split('@')[0]))}));rerender();},
 lg_code(f){if(!can('ota.codes'))return;clearErrs(f);const v=String(formData(f).code||'').trim().toUpperCase();const o=S.org;const e=codeAvailable(v,o.code);if(e){setErr(f,'code',t('lg.rv.codeBad.'+e));return;}
  const was=o.code;o.code=v;o.codeStatus='approved';codeRegister(v);audit('partner.code.approve',v,{was});log(t('lg.log.code',{c:v}));toast(t('lg.t.code',{c:v}));rerender();},
 lg_chgReq(f){const d=formData(f);const grp=LG_GROUPS.find(x=>x.id===d.g);const fields={};Object.keys(d).forEach(n=>{if(!n.startsWith('f_'))return;const k=n.slice(2);const nv=String(d[n]).trim();const ov=lg_fval(k)||'';if(nv!==ov)fields[k]={old:ov,new:nv};});
  if(!Object.keys(fields).length){toast(t('lg.chg.none'),'bad');return;}const L=lg_st();L.detailReq={id:uid('req'),g:grp.id,fields,status:'pending',at:iso(now()),by:actorName()};lg_audit('details.request',grp.id,{fields:Object.keys(fields)});closeOverlay();toast(t('lg.t.chgSent'));rerender();},
 lg_decl(f){const d=formData(f);clearErrs(f);if(!String(d.cmt||'').trim()){setErr(f,'cmt',t('lg.dec.req'));return;}const doc=lg_doc(d.id);if(!doc)return;doc.decline={at:iso(now()),by:actorName(),role:lg_role(),comment:d.cmt.trim()};
  lg_audit('doc.decline',doc.number,{comment:doc.decline.comment});closeOverlay();toast(t('lg.t.decl'));go('lg-doc',doc.id);},
 lg_otp(f){const o=S.ui.lg_otp;clearErrs(f);const v=digits(formData(f).otp);if(!o){closeOverlay();return;}if(v!==o.code){setErr(f,'otp',t('lg.otp.bad'));lg_audit('doc.otp.fail',o.key,{});return;}
  const party=o.party;if(lg_signCheck(party)){closeOverlay();return;}const docs=lg_groupDocs(o.key,party);const sid=lg_signDocs(docs,party,{});S.ui.lg_otp=null;S.ui.lg_viewKey=null;closeOverlay();
  log(t(party==='ota'?'lg.log.signedO':'lg.log.signedP',{n:docs.length}));toast(t('lg.t.signed',{n:docs.length,id:sid}));if(docs.length>1)go('lg-docs');else go('lg-doc',docs[0].id);},
 lg_tplSave(f){const d=formData(f);clearErrs(f);const parts=parseHash().params;const type=parts[0];if(!can('ota.templates'))return;const vs=lg_tplVersions(type);let dr=vs.find(v=>v.status==='draft');
  const cur=lg_tpl(type);const blk=cur.blocks.find(b=>b.id===d.blk);const ch={};if(blk&&(d.en!==blk.en||d.ru!==(blk.ru||'')))ch[d.blk]={en:d.en,ru:d.ru};
  const eff=d.eff?new Date(d.eff+'T09:00:00Z'):addDays(now(),30);if(eff<new Date(iso(now()).slice(0,10)+'T00:00:00Z')){setErr(f,'eff',t('lg.tp.effPast'));return;}
  if(dr){Object.assign(dr.changes,ch);dr.cls=d.cls;dr.effective=iso(eff);dr.note=d.note;lg_audit('tpl.version.edit',dr.ver,{blocks:Object.keys(ch)});}else dr=lg_tplSave(type,ch,{cls:d.cls,effective:iso(eff),note:d.note});
  delete lg__tc[type];toast(t('lg.t.tplSaved'));rerender();},
 lg_pubAdd(f){if(!can('ota.release'))return;const d=formData(f);if(lg_st().pub.some(p=>p.type===d.type&&p.cc===d.cc&&p.lang===d.lang&&p.status==='current')){toast(t('lg.pub.exists'),'bad');return;}const p=lg_pubPublish(d.type,d.cc,d.lang,{});toast(t('lg.t.pub',{n:esc(p.number)}));rerender();},
});

/* ---------- demo seed: ARV questionnaire, signed package, one pending class-A and one class-B change ---------- */
function lg_seed(){const D=lg_demo();lg_st();const L=lg_st();const n=now();const ago=d=>iso(new Date(n.getTime()-d*864e5));const F=S.form;
 const mark=()=>S.audit.length;const fix=(m,at,uidd)=>{const u=users().find(x=>x.id===uidd)||{};S.audit.slice(m).forEach(e=>{e.ts=at;if(u.id){e.actor=u.name;e.email=u.email;e.role=u.role;e.ip=lg_ip(u.role);}});};
 const set=(k,v,o)=>{F[k]=Object.assign({value:v,status:(v!=null&&v!==''&&!(Array.isArray(v)&&!v.length))?'filled':'empty',comment:'',by:'Maria Lind',at:ago(60)},o||{});};
 S.org.signatoryEmail='daniel.hart@arvelo.example';
 set('P_TAXNO',null,{status:'na',comment:'No VAT registration',naReason:'Partner has no VAT number (partner comment)',naBy:'Platform Admin',naAt:ago(59)});
 set('P_AUTHORITY','director');set('P_TM_OWNER_IS_PARTNER','yes',{by:'Platform Admin',at:ago(59)});
 // demo values (marked "demo" in the questionnaire): realistic shape, not real registrations
 const tml=(D&&D.partner&&D.partner.P_TM_LIST)||[{TM_MARK:'ARVELO (word / словесный)'},{TM_MARK:'ARVELO (logo / логотип)'}];const tmNo=['UK00003456789','UK00003456790'];
 set('P_TM_LIST',tml.map((x,i)=>({TM_MARK:x.TM_MARK,TM_REGNO:x.TM_REGNO||(tmNo[i]||tmNo[0])+' (UKIPO)',TM_COUNTRIES:x.TM_COUNTRIES||'United Kingdom; Ukraine; Kazakhstan',TM_CLASSES:x.TM_CLASSES||'9, 38, 42'})),{demo:true});
 set('P_BRAND_RULES','Logo on white or #1F6FEB only, clear space = height of “A”; colours #1F6FEB / #101828; font Onest',{demo:true});
 S.ota.OTA_SUBPROC_EMAIL='Amazon Web Services EMEA SARL (Amazon SES)';S.ota.OTA_SUBPROC_EMAIL_LOC='Luxembourg (EU) / Люксембург (ЕС)';
 set('P_DNS_CONTACT','it@arvelo.example');set('P_LOGO','arvelo_logo_v1.svg');set('P_BRANDBOOK','arvelo_brandbook_2026.pdf');set('P_BRAND_CONTACT','marketing@arvelo.example');
 set('P_EMAIL_OPS','ops@arvelo.example');set('P_EMAIL_LEGAL','legal@arvelo.example');set('P_EMAIL_FIN','finance@arvelo.example');set('P_EMAIL_SUPPORT','support@arvelo.example');set('P_PHONE','[+44 …]');
 const devs=allModels().filter(x=>x.model.plan&&x.model.planStatus==='approved').map(x=>({DEV_BRAND:x.brand.name,DEV_MODEL:x.model.name,DEV_HW:'rev. A',DEV_FW:'1.0',DEV_PLAN:PLAN_EN[x.model.plan],DEV_MB:x.model.plan==='light'?'5':'50',DEV_SIM:'Industrial IoT SIM (2FF/3FF/4FF)',ok:true}));
 orgCountries().forEach(cc=>{const C=(D&&D.countries&&D.countries[cc])||{};const dv=(S.org.delivery||{})[cc]||{};
  ['CC_NAME_L2','CC_NAME_FULL_EN','CC_NAME_FULL_L2','CC_NAME_LOC_L2','CC_EXCLUSION_EN','CC_EXCLUSION_L2'].forEach(k=>set(lg_ccKey(k,cc),C[k]==null?null:C[k],{by:'Platform Admin'}));
  set(lg_ccKey('EUT_LANGS',cc),'[languages]',{by:'Platform Admin'});set(lg_ccKey('EUT_CONSUMER_AUTH',cc),'[consumer protection authority]',{by:'Platform Admin'});set(lg_ccKey('EUT_DP_AUTH',cc),'[data protection authority]',{by:'Platform Admin'});
  set(lg_ccKey('LAUNCH_DATE',cc),ago(57).slice(0,10));set(lg_ccKey('RETAIL_CUR',cc),(CC_META[cc]||{}).cur||'USD');set(lg_ccKey('DELIVERY_ADDR',cc),[dv.address,dv.city].filter(Boolean).join(', '));set(lg_ccKey('IMPORTER',cc),dv.importer||'');
  ['INIT_SIMS','INIT_KEYS','INIT_TOKENS','ANNUAL_TARGET'].forEach(k=>set(lg_ccKey(k,cc),String(C[k]!=null?C[k]:'')));set(lg_ccKey('DEVICES',cc),devs.map(x=>Object.assign({},x)));});
 lg_syncOrg();
 let m=mark();L.submitted={at:ago(60),by:'Maria Lind'};LG_KYC.forEach(k=>{L.kyc[k]={at:ago(59),by:'Platform Admin'};});L.review={at:ago(59),by:'Platform Admin'};
 const prevActor=S.actor;S.actor='u_ota_admin';
 lg_generate({at:ago(59)});const res=lg_issueDocs(lg_pkgDocs(),{at:ago(59),sync:true});fix(m,ago(59),'u_ota_admin');
 if(res&&res.ok){const es=res.ok.filter(d=>d.type!=='BOA');const us=users();const ps=us.find(u=>u.role==='p_sign'),ol=us.find(u=>u.role==='ota_legal');
  m=mark();lg_signDocs(es,'partner',{at:ago(58),user:ps,ua:'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15',viewedAt:iso(new Date(new Date(ago(58)).getTime()-22*60000))});fix(m,ago(58),'u_p_sign');
  m=mark();lg_signDocs(es,'ota',{at:ago(57),user:ol,viewedAt:iso(new Date(new Date(ago(57)).getTime()-15*60000))});fix(m,ago(57),'u_ota_legal');}
 // OTA invoices issued after signing refer to the MPA and the Order Form in force
 (S.invoices||[]).forEach(inv=>{if(!inv.mpa)inv.mpa=lg_docRef('MPA');if(!inv.of)inv.of=lg_docRef('OF',inv.cc);});
 // public documents 07/08 (class C)
 m=mark();orgCountries().forEach(cc=>['EUT','PN'].forEach(tp=>['en','ru'].forEach(l=>lg_pubPublish(tp,cc,l,{at:ago(57),notified:true,by:'Anna Petrova'}))));fix(m,ago(57),'u_ota_legal');
 // class A: Kazakhstan price increase (+5%), effective after the 90-day notice
 if(orgCountries().includes('KZ')&&plLatest('KZ')){m=mark();const b=plLatest('KZ');const up=x=>r2(x*1.05);const tok={};PLANS.forEach(p=>{tok[p]={};TERMS.forEach(tm=>{tok[p][tm]=up(b.tokens[p][tm]);});});
  const ret={};PLANS.forEach(p=>{ret[p]=up(b.retained[p]);});plAdd('KZ',{key:b.key,tokens:tok,retained:ret,fee:b.fee||0},{note:'Upstream connectivity cost increase in Kazakhstan (+5%)'});fix(m,ago(1),'u_ota_admin');
  m=mark();lg_issueOF('KZ',{at:ago(1),sync:true});fix(m,ago(1),'u_ota_legal');}
 // class B: editorial update of the Service Terms (04), acknowledgment within 30 days
 const sla=lg_tpl('SLA');const b71=sla&&sla.blocks.find(x=>x.id==='SLA-7.1');
 if(b71){m=mark();const v=lg_tplSave('SLA',{'SLA-7.1':{en:b71.en.replace("email to OTA's support address","email to OTA's support address published in the cabinet"),ru:b71.ru.replace('e-mail на адрес поддержки OTA','e-mail на адрес поддержки OTA, указанный в кабинете')}},
   {cls:'B',effective:iso(addDays(n,28)),note:'Support e-mail address: reference to the cabinet (editorial)',at:ago(2),by:'Anna Petrova'});
  S.actor='u_ota_legal';lg_tplRelease('SLA',v.ver,{at:ago(2),sync:true});fix(m,ago(2),'u_ota_legal');}
 S.actor=prevActor||'u_p_admin';}
HOOKS.seedDemo.push(lg_seed);

/* ---------- strings ---------- */
I18N.add({
uk:{'lg.sec':'Документи','lg.otasec':'OTA · Юридичне','lg.nav.docs':'Документи','lg.nav.form':'Анкета','lg.nav.sign':'Підписання','lg.nav.audit':'Журнал аудиту','lg.nav.review':'Перевірка партнера','lg.nav.tpl':'Шаблони і версії',
'lg.demo':'демо','lg.partner':'Партнер','lg.sel':'— оберіть —','lg.rows':'{n} рядк.',
'lg.e.noTpl':'Шаблон {t} не знайдено','lg.e.stopT':'Генерацію зупинено','lg.e.stopD':'Немає перекладу абзаців другою мовою ({l}): {ids}. Додайте переклад у шаблон і повторіть.','lg.e.noDoc':'Документ не знайдено','lg.e.prep':'Документ готує OTA — він з’явиться тут, щойно буде готовий.','lg.e.generic':'Не вдалося виконати дію','lg.e.issueT':'Пакет не можна випустити','lg.e.issueD':'Бракує обов’язкових даних або перекладу. Заповніть поля чи позначте їх «не застосовується» і повторіть.',
'lg.e.email':'Вкажіть e-mail у форматі name@company.com','lg.e.iban':'Перевірте IBAN: 2 літери країни, 2 цифри, далі номер рахунку','lg.e.swift':'SWIFT/BIC — 8 або 11 символів','lg.e.domain':'Вкажіть домен, наприклад connect.brand.com','lg.e.num':'Вкажіть ціле число',
'lg.block.unsigned':'Замовлення для країни {c} відкриються після підписання пакета документів (Рамкова угода та Замовлення по країні). Перейдіть у «Документи».','lg.block.overdue':'Нова версія Замовлення {n} набрала чинності {d}, але ще не підписана — нові замовлення ключів і токенів для країни {c} заблоковано до підписання. Активовані пристрої та оплачені тарифи не змінюються.',
'lg.print.hint':'A4, дві колонки. У діалозі друку оберіть «Зберегти як PDF».','lg.print.go':'Друк / PDF','lg.cert.demo':'Демо: справжня печатка PAdES ставиться на бекенді; тут показано її блок і хеш.',
'lg.st.f.filled':'заповнено','lg.st.f.empty':'порожньо','lg.st.f.na':'не застосовується',
'lg.auth.director':'Директор (статут)','lg.auth.poa':'Довіреність','lg.lang2.na':'переклад ще не затверджено','lg.tm.yes':'Так, знаки належать нам','lg.tm.no':'Ні, знаки належать іншій компанії','lg.tm.yes.d':'Документ 05A — ліцензія на бренд','lg.tm.no.d':'Документ 05B — лист правовласника (підписаний скан)',
'lg.file.none':'файл не завантажено','lg.file.replace':'Замінити','lg.file.choose':'Завантажити','lg.na.by':'Не застосовується (рішення OTA)','lg.cmt.yours':'Ваш коментар для OTA','lg.cmt.btn':'Немає таких даних?',
'lg.row.del':'Видалити рядок','lg.row.add':'Додати рядок','lg.tm.empty':'Додайте хоча б один знак','lg.dev.ok':'Схвалено','lg.dev.okB':'схвалено OTA','lg.dev.wait':'на перевірці','lg.dev.st':'Статус','lg.dev.empty':'Додайте моделі або заповніть із каталогу','lg.dev.prefill':'Заповнити з каталогу',
'lg.chg.req':'Запросити зміну','lg.g.company':'Компанія','lg.g.sign':'Підписант і повноваження','lg.g.lang':'Мова документів','lg.g.brand':'Бренд і торговельні марки','lg.g.domain':'Домен і файли бренду','lg.g.contacts':'Контакти','lg.g.bank':'Банківські реквізити (USD)','lg.g.cc':'Параметри Замовлення — {c}',
'lg.lang2.d':'Документи завжди англійською; друга колонка — обрана мова. Доступні лише мови з повним затвердженим перекладом усіх шаблонів.','lg.locked.d':'Пакет уже випущено — ці дані змінюються через OTA (нова версія документа або повідомлення про зміну реквізитів).','lg.tm.ownerH':'Правовласник (для листа 05B)',
'lg.cc.prices':'Прайс-лист OTA v{v}: ключ {k}. Ціни встановлює OTA і вони потрапляють у Замовлення при генерації.','lg.cc.noprices':'OTA ще не встановила ціни для цієї країни.','lg.cc.pricesLink':'Ціни',
'lg.form.st.approved':'Перевірено OTA','lg.form.st.submitted':'На перевірці OTA','lg.form.st.draft':'Чернетка','lg.form.progress':'Заповнення анкети','lg.form.progT':'{x} з {n} обов’язкових полів','lg.form.submit':'Надіслати на перевірку','lg.form.subAt':'Надіслано {d}','lg.form.left':'Залишилось {n}:',
'lg.form.otaRo':'Режим OTA: анкету заповнює партнер. Позначки «не застосовується», вибір 05A/05B і дані країн — на сторінці «Перевірка партнера».','lg.chg.pending':'Запит на зміну реквізитів чекає на перевірку OTA.','lg.chg.toSign':'OTA підтвердила зміну реквізитів — підпишіть повідомлення {n}.',
'lg.form.title':'Анкета партнера','lg.form.sub':'Кожне поле підставляється в документи пакета. Якщо даних немає — залиште коментар, OTA вирішить, чи поле не застосовується.',
'lg.ota.only':'Лише для команди OTA','lg.ota.onlyD':'Увімкніть режим OTA в бічному меню.',
'lg.rv.status':'Готовність до генерації пакета','lg.rv.approvedAt':'Перевірено {d}','lg.rv.ck.submitted':'Анкету надіслано','lg.rv.ck.form':'Обов’язкові поля заповнені або N/A','lg.rv.ck.kyc':'KYC і санкції пройдено','lg.rv.ck.code':'Код партнера затверджено','lg.rv.ck.brand':'Обрано 05A / 05B','lg.rv.ck.prices':'Ціни по всіх країнах','lg.rv.ck.devices':'Пристрої Додатка 1 схвалено',
'lg.rv.next':'Перевірку завершено. Сформуйте пакет документів.','lg.rv.toPkg':'До пакета','lg.rv.approve':'Завершити перевірку','lg.rv.kyc':'KYC / санкції',
'lg.kyc.registry':'Реєстр компаній','lg.kyc.registry.d':'Компанія існує, номер і адреса збігаються з анкетою','lg.kyc.ubo':'Кінцеві бенефіціари','lg.kyc.ubo.d':'Бенефіціари встановлені, документи отримані','lg.kyc.sanctions':'Санкційні списки','lg.kyc.sanctions.d':'Компанія, бенефіціари, підписант — OFAC, ЄС, Великобританія, ООН','lg.kyc.territories':'Виключені території','lg.kyc.territories.d':'Немає продажів у РФ, Білорусі, на окупованих територіях','lg.kyc.authority':'Повноваження підписанта','lg.kyc.authority.d':'Посада або довіреність перевірені','lg.kyc.bank':'Банківський рахунок','lg.kyc.bank.d':'Отримувач збігається з назвою компанії',
'lg.rv.code':'Код партнера','lg.rv.codeD':'3 латинські літери, унікальні назавжди; OTA, INV, TST зарезервовані. Код входить у номери всіх документів.','lg.rv.codeOk':'затверджено','lg.rv.codeProp':'запропоновано','lg.rv.codeNew':'Код','lg.rv.codeApprove':'Затвердити код','lg.rv.codeBad.format':'Потрібно рівно 3 латинські літери','lg.rv.codeBad.reserved':'Код зарезервовано (OTA, INV, TST)','lg.rv.codeBad.taken':'Код уже зайнятий іншим партнером',
'lg.rv.brand':'Документ про бренд','lg.rv.brandD':'Якщо знаки належать партнерові — ліцензія 05A; якщо іншій компанії — лист правовласника 05B (підписаний скан).','lg.rv.b05A':'ліцензія','lg.rv.b05B':'лист правовласника','lg.rv.brandNone':'Оберіть варіант — без нього пакет не сформувати.',
'lg.rv.f':'Поле','lg.rv.v':'Значення','lg.rv.cmt':'Коментар / причина','lg.na.clear':'Зняти N/A','lg.na.set':'Не застосовується','lg.rv.noOpen':'Усі поля заповнені','lg.rv.fields':'Поля анкети','lg.rv.onlyOpen':'Лише порожні',
'lg.rv.naRule':'«Не застосовується» ставить лише OTA. Таке поле не виводиться в жодному документі: рядок таблиці або умовний фрагмент прибирається повністю.','lg.rv.prices':'Ціни','lg.rv.plCur':'Чинний прайс-лист','lg.rv.from':'з','lg.rv.fee':'збір','lg.rv.plPend':'Заплановано','lg.ch.increase':'підвищення цін',
'lg.rv.ota':'Дані OTA','lg.rv.otaEdit':'Змінити','lg.rv.otaD':'Одні для всіх партнерів. Порожнє поле = «не застосовується» і не виводиться.',
'lg.chg.reqT':'Зміна реквізитів партнера','lg.chg.pendingB':'чекає OTA','lg.chg.old':'Було','lg.chg.new':'Стане','lg.chg.reject':'Відхилити','lg.chg.approve':'Підтвердити і сформувати повідомлення',
'lg.dec.title':'Відмова від зміни класу A','lg.dec.rule':'Відмова не змінює правило блокування: після дати набрання чинності нові замовлення по країні блокуються до підписання.','lg.dec.handled':'Опрацьовано',
'lg.rv.title':'Перевірка партнера','lg.rv.sub':'{n}: анкета, KYC, код, 05A/05B, ціни та країни','lg.rv.openForm':'Анкета','lg.rv.adminNote':'Дії команди OTA (OTA Admin / OTA Legal). Партнер бачить лише результат.',
'lg.st.draft':'Чернетка','lg.st.issued':'На підписі','lg.st.signed_partner':'Підписано партнером','lg.st.signed_both':'Чинний','lg.st.acknowledged':'Ознайомлено','lg.st.superseded':'Замінено','lg.st.terminated':'Відкликано','lg.st.scan':'Скан отримано','lg.st.signedP':'Підписано партнером','lg.st.autoEff':'Набрав чинності','lg.st.signedFuture':'Підписано · чинний з {d}',
'lg.tt.MPA':'Рамкова партнерська угода','lg.tt.OF':'Замовлення','lg.tt.TRT':'Умови перепродажу сервісних токенів','lg.tt.SLA':'Умови сервісу та SLA','lg.tt.BL':'Ліцензія на бренд','lg.tt.BOA':'Лист правовласника','lg.tt.DPA':'Угода про захист даних','lg.tt.SIM':'Порядок зберігання та постачання SIM','lg.tt.EUT':'Умови для користувачів','lg.tt.PN':'Політика конфіденційності','lg.tt.CHG':'Повідомлення про зміну реквізитів',
'lg.cls.A':'клас A','lg.cls.B':'клас B','lg.cls.C':'клас C','lg.stp.form':'Анкета','lg.stp.review':'Перевірка OTA','lg.stp.gen':'Генерація','lg.stp.psign':'Підпис партнера','lg.stp.osign':'Підпис OTA','lg.stp.done':'Замовлення відкрито',
'lg.pkg.regen':'Оновити чернетки','lg.pkg.gen':'Сформувати пакет','lg.pkg.issue':'Випустити на підпис','lg.pkg.osign':'Підписати від OTA','lg.pkg.sign':'Підписати пакет',
'lg.pkg.emptyT.form':'Почніть з анкети','lg.pkg.emptyD.form':'Пакет документів формується з даних анкети. Заповніть її та надішліть OTA.','lg.pkg.emptyT.review':'Анкета на перевірці OTA','lg.pkg.emptyD.review':'OTA перевіряє дані, присвоює код партнера і встановлює ціни. Після цього пакет буде сформовано.','lg.pkg.emptyT.ready':'Можна формувати пакет','lg.pkg.emptyD.ready':'Перевірку завершено — OTA формує документи.',
'lg.pkg.toForm':'Заповнити анкету','lg.pkg.noTr':'немає перекладу','lg.pkg.miss':'бракує {n}','lg.pkg.ready':'готово','lg.boa.hint':'Підписує правовласник — завантажте підписаний скан','lg.col.no':'Док.','lg.col.doc':'Документ','lg.col.num':'Номер','lg.col.cls':'Клас','lg.col.eff':'Набирає чинності','lg.col.ver':'Версія',
'lg.pkg.title':'Пакет партнера','lg.pkg.lang':'EN + {l}','lg.pkg.draftNote':'Чернетки: номери вже присвоєні й не зміняться при повторній генерації. Дані партнера підсвічені жовтим.','lg.pkg.signedNote':'Пакет підписано обома сторонами. Замовлення ключів і токенів відкриті.',
'lg.chg.title':'Нові версії та зміни','lg.eff.onSign':'після підписання','lg.dec.b':'відмова','lg.f.live':'Чинні','lg.f.pending':'В роботі','lg.f.old':'Архів версій','lg.all.arch':'Показати архівні','lg.all.title':'Усі документи','lg.arch.b':'архів','lg.all.none':'Документів немає',
'lg.pub.manage':'Керувати версіями','lg.pub.title':'Публічні документи 07 / 08','lg.pub.lang':'Мова','lg.pub.date':'Опубліковано','lg.pub.web':'Веб-версія','lg.pub.none':'Ще не опубліковано',
'lg.k.pkg':'Пакет','lg.stage.form':'Анкета','lg.stage.review':'Перевірка','lg.stage.ready':'Генерація','lg.stage.draft':'Чернетка','lg.stage.issued':'На підписі','lg.stage.signed_partner':'Чекає OTA','lg.stage.signed':'Підписано','lg.k.live':'Чинних документів','lg.k.tasks':'Ваші задачі','lg.k.chg':'Нові версії',
'lg.docs.title':'Документи','lg.docs.sub':'Пакет CONNECT FOR BRANDS: генерація з анкети, електронний підпис обома сторонами, версії при змінах умов.','lg.docs.admin':'Режим OTA: генерація, випуск і підпис від OTA. Чернетки з жовтим підсвічуванням бачить лише OTA.',
'lg.chg.notice':'Повідомлення про зміну реквізитів','lg.ch.d.increase':'Нова версія: підвищення цін','lg.ch.d.decrease':'Нова версія: зниження цін','lg.ch.d.country':'Нова країна','lg.ch.d.text':'Новий текст шаблону {v}',
'lg.dv.print':'Завантажити PDF','lg.dv.preview':'Попередній перегляд A4','lg.dv.diff':'Порівняти з попередньою','lg.dv.ack':'Ознайомитися','lg.dv.sign':'Підписати','lg.dv.draftOta':'Чернетка для OTA: дані партнера підсвічені жовтим. У фінальному PDF підсвічування немає.','lg.dv.draftP':'Чернетка — документ ще не випущено на підпис.',
'lg.dv.missT':'Бракує даних: {n}. Документ не можна випустити на підпис.','lg.dv.missFix':'Заповнити дані','lg.dv.superseded':'Цю версію замінено документом {n}. Вона залишається доступною для завантаження.','lg.dv.effA':'Набирає чинності {d}. Якщо не підписати до цієї дати, нові замовлення ключів і токенів по країні {c} буде заблоковано.','lg.dv.effB':'Набирає чинності {d} автоматично. Робота не блокується.',
'lg.dec.note':'Партнер відмовився від зміни: «{c}» ({n}). Правило блокування не змінюється.','lg.dv.integChk':'Перевіряємо цілісність…','lg.dv.details':'Деталі','lg.dv.pl':'Прайс-лист','lg.dv.supersedes':'Замінює','lg.dv.issued':'Випущено','lg.dv.sigs':'Підписи',
'lg.rem.title':'Нагадування','lg.rem.n':'за {n} дн.','lg.rem.manual':'надіслано вручну','lg.rem.copy':'Лист підписантові партнера, копія — менеджеру OTA.','lg.rem.send':'Надіслати зараз',
'lg.boa.d':'Лист підписує правовласник. Завантажте PDF, передайте на підпис і завантажте підписаний скан.','lg.boa.dl':'Завантажити лист','lg.boa.got':'Скан: {f}','lg.boa.up':'Завантажити підписаний скан',
'lg.kep.d':'Потрібна КЕП для бухгалтерії? Завантажте PDF, підпишіть КЕП і додайте файл як додатковий примірник.','lg.kep.up':'Додати примірник з КЕП','lg.dec.d':'Не погоджуєтесь зі зміною? Напишіть коментар — його отримає менеджер OTA.','lg.dec.btn':'Відмовитися від зміни',
'lg.arch.btn':'В архів','lg.arch.d':'Підписані документи не змінюються і не видаляються — лише архівуються.','lg.dv.more':'Дії','lg.au.title':'Журнал аудиту','lg.au.all':'Увесь журнал','lg.dv.integOk':'Цілісність підтверджено (SHA-256 збігається)','lg.dv.integBad':'Хеш не збігається — документ змінено',
'lg.sg.pkgT':'Пакет документів ({n})','lg.sg.osign':'Підписати від OTA','lg.sg.open':'Переглянути й підписати','lg.sg.ack':'Переглянути й ознайомитися','lg.sg.openDoc':'Відкрити','lg.sg.review':'Анкета чекає перевірки','lg.sg.reviewD':'Партнер надіслав анкету','lg.sg.detailsD':'Партнер просить змінити реквізити',
'lg.det.country':'Нова країна: {c} — потрібне Замовлення','lg.det.price':'Змінено ціни: {c}','lg.det.d':'Прайс-лист v{v} з {d}','lg.det.go':'Випустити версію',
'lg.sg.who':'Підписувати може лише підписант з анкети: {n}, {ti}.','lg.sg.otaWho':'Від OTA підписує OTA Legal.','lg.sg.title':'Підписання','lg.sg.subO':'Документи, підписані партнером, чекають підпису OTA.','lg.sg.sub':'Документи, які чекають на ваш підпис або ознайомлення.',
'lg.sg.none':'Немає задач','lg.sg.noneD':'Усе підписано. Нові версії з’являться тут.','lg.sg.as':'Ви дієте як {n} ({r}).','lg.sg.nothing':'Нічого підписувати','lg.sg.nothingD':'Ці документи вже підписані або ще не випущені.',
'lg.sg.agreeAck':'Я ознайомився з новою версією від імені {p}','lg.sg.agree':'Я ознайомився і уповноважений підписати від імені {p}','lg.sg.mismatch':'Ви увійшли як {n} ({ti}), а за анкетою підписант — {pn} ({pt}). Підписати може лише він.','lg.sg.ackWho':'Ознайомлення підтверджує підписант партнера.','lg.sg.roleOnly':'Підписувати може лише користувач з роллю «Підписант партнера».',
'lg.sg.ackTitle':'Ознайомлення з новою версією','lg.sg.otaTitle':'Підпис від OTA','lg.sg.signTitle':'Підписання документів','lg.sg.allIn':'{n} документів — один підпис на всіх','lg.sg.oneAction':'Пакет підписується однією дією: підпис ставиться на всі документи одразу. Підписати частину не можна.','lg.sg.box':'Повний текст документів',
'lg.sg.end':'Кінець документів','lg.sg.scroll':'Прокрутіть до кінця, щоб активувати підпис','lg.sg.scrolled':'Документи переглянуто','lg.sg.ackBtn':'Ознайомлений','lg.sg.btn':'Підписати',
'lg.tp.tab.t':'Шаблони','lg.tp.tab.c':'Зміни','lg.tp.tab.p':'Публічні 07/08','lg.tp.type':'Тип','lg.tp.cur':'Поточна версія','lg.tp.vers':'Версій','lg.tp.draftB':'чернетка {v}',
'lg.det.title':'Знайдено зміни прайс-листів','lg.det.cur':'зараз {n} (ціни v{v})','lg.ch.country':'нова країна','lg.ch.decrease':'зниження цін','lg.ch.r.country':'Продажі в країні відкриються після підписання.','lg.ch.r.increase':'Повідомлення ≥ 90 днів: чинність з {d}; без підпису — блокування замовлень по країні.','lg.ch.r.decrease':'Чинність одразу після підписів; до того діють попередні ціни.',
'lg.det.issue':'Випустити нову версію Замовлення','lg.det.none':'Усі Замовлення відповідають чинним прайс-листам.','lg.det.how':'Портал порівнює прайс-лист країни з версією в чинному Замовленні.','lg.ch.title':'Випущені зміни','lg.ch.none':'Змін ще не було','lg.cls.title':'Класи змін (п. 16.5 Рамкової угоди)',
'lg.tp.title':'Шаблони і версії','lg.tp.sub':'Тексти пакета v09 поабзацно (EN + переклади), версії, класи змін і випуск оновлень.','lg.tp.admin':'OTA Legal: шаблони, версії, класи змін, випуск оновлень. Старі версії не видаляються.','lg.ch.k.tpl':'новий текст {v}',
'lg.cls.what':'Що змінюється','lg.cls.need':'Від партнера','lg.cls.term':'Строк','lg.cls.miss':'Якщо не підписав',
'lg.cls.r.A.n':'критичне','lg.cls.r.A.w':'Ціни й комерційні умови (нова версія Замовлення); права й обов’язки в 01, 03, 05A, 06, 09','lg.cls.r.A.q':'Підпис','lg.cls.r.A.t':'Підвищення цін ≥ 90 днів; інше ≥ 30 днів','lg.cls.r.A.m':'Блокуються нові ключі й токени по країні',
'lg.cls.r.Anew.n':'нова країна','lg.cls.r.Anew.w':'Нове Замовлення','lg.cls.r.Anew.q':'Підпис','lg.cls.r.Anew.t':'—','lg.cls.r.Anew.m':'Продажі в країні не відкриваються',
'lg.cls.r.Adown.n':'зниження цін','lg.cls.r.Adown.w':'Нова версія Замовлення на користь партнера','lg.cls.r.Adown.q':'Підпис','lg.cls.r.Adown.t':'Одразу після підписів','lg.cls.r.Adown.m':'Діють попередні ціни',
'lg.cls.r.B.n':'некритичне','lg.cls.r.B.w':'Уточнення 04, субобробники 06, редакційні правки, шаблони 10–14','lg.cls.r.B.q':'Позначка «Ознайомлений»','lg.cls.r.B.t':'30 днів','lg.cls.r.B.m':'Набирає чинності автоматично, без блокування',
'lg.cls.r.C.n':'публічні','lg.cls.r.C.w':'07, 08 для кінцевих користувачів','lg.cls.r.C.q':'Повідомлення партнера','lg.cls.r.C.t':'Суттєві — 30 днів','lg.cls.r.C.m':'—',
'lg.tp.ver':'Версія','lg.tp.note':'Опис змін','lg.tp.base':'Пакет v09','lg.tp.st.draft':'чернетка','lg.tp.st.released':'випущено','lg.tp.edDraft':'Чернетка {v}','lg.tp.edNew':'Нова версія шаблону','lg.tp.block':'Пункт','lg.tp.l2':'друга мова','lg.tp.ruH':'Порожній переклад зупинить генерацію (перевірка ТЗ §10.10).','lg.tp.effH':'Клас A — не раніше ніж через 30 днів','lg.tp.notePh':'Коротко: що змінилось','lg.tp.saveDraft':'Зберегти чернетку','lg.tp.saveNew':'Створити нову версію','lg.tp.bump':'Нова версія без змін тексту',
'lg.tp.rel':'Випуск {v}','lg.tp.relOk':'Усі абзаци мають переклад — генерацію перевірено.','lg.tp.affPub':'Буде опубліковано нові версії публічних документів: {n}.','lg.tp.aff':'Зачеплено чинних документів: {n}. Для кожного буде створено нову версію з тим самим номером.','lg.tp.preview':'Переглянути','lg.tp.issue':'Випустити',
'lg.tp.edSub':'Поточна версія {v}. Шаблон зберігається поабзацно: EN + переклад кожного пункту.','lg.tp.hist':'Історія версій','lg.tp.legalOnly':'Редагувати шаблони може OTA Legal.','lg.tp.bumpNote':'Нова версія без змін тексту','lg.tp.effPast':'Дата не може бути в минулому',
'lg.pub.minor':'Нова версія x.+1','lg.pub.major':'Суттєва зміна +1.0','lg.pub.cur':'поточна','lg.pub.notified':'Партнера повідомлено','lg.pub.notifiedAt':'повідомлено {d}','lg.pub.notify':'Позначити «повідомлено»','lg.pub.cc':'Країна','lg.pub.add':'Опублікувати',
'lg.pub.d':'Публікуються на домені партнера однією мовою (мова користувача), без шапки й номера. Номер версії: OTA-EUT-CC-lang-vX.Y.','lg.pub.miss':'Для веб-версії бракує: {k}','lg.pub.exists':'Ця версія вже опублікована — випустіть нову',
'lg.df.added':'додано','lg.df.removed':'вилучено','lg.df.title':'Порівняння версій','lg.df.only':'Лише змінені пункти','lg.df.sum':'Змінено пунктів: {n}. Нова версія набирає чинності: {e}.','lg.df.none':'Відмінностей немає',
'lg.au.c.docs':'Документи','lg.au.c.sign':'Підписи й перегляди','lg.au.c.form':'Анкета','lg.au.c.orders':'Замовлення','lg.au.c.system':'Система','lg.au.noT':'Немає доступу','lg.au.noD':'Журнал бачать OTA Legal та адміністратор партнера.',
'lg.au.when':'Коли','lg.au.who':'Хто','lg.au.what':'Дія','lg.au.obj':'Об’єкт','lg.au.hash':'Хеш','lg.au.sub':'Кожна дія з документами: хто, коли, IP, пристрій і хеш документа.','lg.au.csv':'CSV','lg.au.pdf':'PDF','lg.au.append':'Журнал лише доповнюється: записи не редагуються й не видаляються. Зберігання — 10 років.','lg.au.search':'Пошук: дія, номер, людина','lg.au.allRoles':'Усі ролі','lg.au.n':'{n} записів',
'lg.cmt.title':'Немає таких даних','lg.cmt.d':'Поле «{f}». Самі ви не можете позначити його «не застосовується» — напишіть коментар, і OTA вирішить.','lg.cmt.lbl':'Коментар для OTA','lg.cmt.def':'Немає таких даних','lg.cmt.send':'Надіслати',
'lg.t.notDone':'Заповніть ще {n} обов’язкових полів','lg.log.submitted':'Анкету надіслано на перевірку OTA','lg.t.submitted':'Анкету надіслано на перевірку OTA','lg.t.prefill':'Додано моделей з каталогу: {n}. Вкажіть ревізію, прошивку й трафік.','lg.t.prefill0':'Усі моделі каталогу вже в списку',
'lg.chg.reqD':'Підписані документи не перевипускаються. Після перевірки OTA ви підпишете повідомлення про зміну реквізитів.','lg.chg.send':'Надіслати на перевірку','lg.t.chgOk':'Зміну підтверджено — повідомлення випущено на підпис партнерові','lg.t.chgRej':'Запит відхилено',
'lg.log.review':'OTA завершила перевірку партнера','lg.t.review':'Перевірку завершено','lg.na.title':'Позначити «не застосовується»','lg.na.d':'Поле {f} не виводитиметься в жодному документі.','lg.na.reason':'Причина','lg.t.naClr':'Позначку N/A знято',
'lg.t.gen':'Пакет сформовано: {n} док.','lg.log.issued':'Пакет випущено на підпис ({n} док.)','lg.t.issued':'Випущено на підпис: {n} док. Текст зафіксовано, хеш SHA-256 збережено.','lg.t.remind':'Нагадування надіслано на {e} (копія менеджеру OTA)',
'lg.dec.cmt':'Чому ви не погоджуєтесь?','lg.dec.send':'Надіслати відмову','lg.arch.q':'Перенести {n} в архів? Документ залишиться доступним і не зміниться.','lg.t.arch':'{n} перенесено в архів',
'lg.otp.title':'Підтвердження підпису','lg.otp.d':'Ми надіслали 6-значний код на {e}. Одна підпис для {n} док.','lg.otp.lbl':'Код з листа','lg.otp.legal':'Підпис на порталі з одноразовим кодом і журналом аудиту є електронним підписом (п. 2.5 Рамкової угоди).','lg.otp.resend':'Надіслати ще раз','lg.otp.go':'Підписати ({n})','lg.otp.toast':'Код надіслано на {e}: {c}',
'lg.t.ack':'Ознайомлення з {n} підтверджено','lg.t.ofIssued':'Нову версію {n} випущено на підпис','lg.t.tplSaved':'Чернетку версії збережено','lg.t.released':'Версію {v} випущено: {n} док.','lg.t.pub':'Опубліковано {n}','lg.t.notified':'Позначено: партнера повідомлено','lg.t.csv':'Експортовано {n} записів','lg.t.cmt':'Коментар надіслано OTA',
'lg.na.reasonReq':'Вкажіть причину','lg.t.na':'«{f}» — не застосовується','lg.log.code':'Код партнера {c} затверджено','lg.t.code':'Код {c} затверджено','lg.chg.none':'Ви нічого не змінили','lg.t.chgSent':'Запит надіслано OTA','lg.dec.req':'Напишіть коментар','lg.t.decl':'Відмову надіслано менеджерові OTA',
'lg.otp.bad':'Невірний код. Перевірте лист і спробуйте ще раз.','lg.log.signedO':'OTA підписала {n} док.','lg.log.signedP':'Партнер підписав {n} док.','lg.t.signed':'Підписано {n} док. · ID {id}','lg.t.file':'Файл {f} додано','lg.t.scan':'Скан {f} отримано','lg.t.kep':'Примірник з КЕП {f} додано',
'lg.h.P_FORM_EN':'Напр.: a private limited company incorporated in England and Wales','lg.h.P_TITLE_L2_GEN':'Для «в особі …», напр.: директора','lg.h.P_TAXNO':'Якщо номера немає — залиште коментар','lg.h.P_DOMAIN':'Напр.: connect.brand.com','lg.h.P_TM_LIST':'Знак, № реєстрації та відомство, країни, класи МКТУ','lg.h.DEVICES':'Партнер заповнює, OTA схвалює. У Додаток 1 потрапляють лише схвалені моделі.','lg.h.P_BANK_INTERMEDIARY':'Якщо банку-посередника немає — коментар для OTA','lg.h.P_AUTHORITY_FILE':'Довіреність (PDF)',
'lg.f.P_NAME':'Повна назва компанії','lg.f.P_FORM_EN':'Форма й країна реєстрації (англ.)','lg.f.P_FORM_L2':'Форма й країна реєстрації (2-га мова)','lg.f.P_COUNTRY':'Країна реєстрації','lg.f.P_REGNO':'Реєстраційний номер','lg.f.P_TAXNO':'Податковий / VAT-номер','lg.f.P_ADDR_EN':'Юридична адреса (англ.)','lg.f.P_ADDR_L2':'Юридична адреса (2-га мова)',
'lg.f.P_SIGNATORY':'ПІБ підписанта (латиницею)','lg.f.P_TITLE_EN':'Посада (англ.)','lg.f.P_TITLE_L2':'Посада (2-га мова)','lg.f.P_TITLE_L2_GEN':'Посада, родовий відмінок','lg.f.P_AUTHORITY':'Підстава повноважень','lg.f.P_AUTHORITY_FILE':'Файл довіреності','lg.f.LANG2':'Друга мова документів',
'lg.f.P_BRAND':'Бренд','lg.f.P_PROGRAMME':'Назва програми («БРЕНД CONNECT»)','lg.f.P_TM_OWNER_IS_PARTNER':'Чи належать знаки вашій компанії?','lg.f.P_TM_LIST':'Реєстрації знаків','lg.f.P_BRAND_CONTACT':'Контакт для погодження матеріалів','lg.f.P_BRAND_RULES':'Правила логотипа, кольори, шрифти',
'lg.f.P_TM_OWNER_NAME':'Правовласник: назва','lg.f.P_TM_OWNER_COUNTRY_EN':'Країна реєстрації (англ.)','lg.f.P_TM_OWNER_COUNTRY_L2':'Країна реєстрації (2-га мова)','lg.f.P_TM_OWNER_REGNO':'Реєстраційний номер','lg.f.P_TM_OWNER_ADDR':'Адреса','lg.f.P_TM_OWNER_RELATION_EN':'Ваш статус у правовласника (англ.)','lg.f.P_TM_OWNER_RELATION_L2':'Ваш статус (2-га мова)','lg.f.P_TM_OWNER_TERRITORY_EN':'Країни дозволу (англ.)','lg.f.P_TM_OWNER_TERRITORY_L2':'Країни дозволу (2-га мова)','lg.f.P_TM_OWNER_SIGNATORY':'Підписант правовласника','lg.f.P_TM_OWNER_TITLE':'Посада підписанта',
'lg.f.P_DOMAIN':'Домен порталу','lg.f.P_DNS_CONTACT':'Технічний контакт з DNS','lg.f.P_LOGO':'Логотип (файл і версія)','lg.f.P_BRANDBOOK':'Брендбук','lg.f.P_EMAIL_OPS':'E-mail для операцій','lg.f.P_EMAIL_LEGAL':'E-mail для юридичних повідомлень','lg.f.P_EMAIL_FIN':'E-mail фінансів','lg.f.P_EMAIL_SUPPORT':'E-mail підтримки користувачів','lg.f.P_PHONE':'Телефон',
'lg.f.P_BANK_BENEFICIARY':'Отримувач','lg.f.P_BANK_IBAN':'Рахунок / IBAN (USD)','lg.f.P_BANK_NAME':'Банк','lg.f.P_BANK_ADDR':'Адреса банку','lg.f.P_BANK_SWIFT':'SWIFT','lg.f.P_BANK_INTERMEDIARY':'Банк-посередник (SWIFT)',
'lg.f.TM_MARK':'Знак','lg.f.TM_REGNO':'№ і відомство','lg.f.TM_COUNTRIES':'Країни','lg.f.TM_CLASSES':'Класи','lg.f.DEV_BRAND':'Бренд','lg.f.DEV_MODEL':'Модель','lg.f.DEV_HW':'Ревізія','lg.f.DEV_FW':'Прошивка','lg.f.DEV_PLAN':'Тариф','lg.f.DEV_MB':'МБ/міс.','lg.f.DEV_SIM':'Тип SIM','lg.f.DEVICES':'Додаток 1: пристрої',
'lg.f.LAUNCH_DATE':'Дата запуску','lg.f.RETAIL_CUR':'Валюта роздрібу','lg.f.DELIVERY_ADDR':'Адреса доставки SIM','lg.f.IMPORTER':'Імпортер','lg.f.INIT_SIMS':'Перша відвантаження SIM, шт.','lg.f.INIT_KEYS':'Перше замовлення ключів','lg.f.INIT_TOKENS':'Перше замовлення токенів','lg.f.ANNUAL_TARGET':'Річна ціль (активовані пристрої)','lg.f.OF_EXCEPTIONS_EN':'Винятки з п. 5.6 (англ.)','lg.f.OF_EXCEPTIONS_L2':'Винятки з п. 5.6 (2-га мова)',
'lg.f.CC_NAME_L2':'Країна (2-га мова)','lg.f.CC_NAME_FULL_EN':'Офіційна назва країни (англ.)','lg.f.CC_NAME_FULL_L2':'Офіційна назва (2-га мова)','lg.f.CC_NAME_LOC_L2':'Країна, місцевий відмінок','lg.f.CC_EXCLUSION_EN':'Виключені території (англ.)','lg.f.CC_EXCLUSION_L2':'Виключені території (2-га мова)','lg.f.EUT_LANGS':'07: мови публікації','lg.f.EUT_CONSUMER_AUTH':'07: орган захисту прав споживачів','lg.f.EUT_DP_AUTH':'07: орган із захисту даних','lg.f.EUT_WITHDRAWAL':'07: правила відмови й повернення','lg.f.EUT_OTHER':'07: інша обов’язкова інформація'},
en:{'lg.sec':'Documents','lg.otasec':'OTA · Legal','lg.nav.docs':'Documents','lg.nav.form':'Questionnaire','lg.nav.sign':'Signing','lg.nav.audit':'Audit log','lg.nav.review':'Partner review','lg.nav.tpl':'Templates & versions',
'lg.demo':'demo','lg.partner':'Partner','lg.sel':'— select —','lg.rows':'{n} rows',
'lg.e.noTpl':'Template {t} not found','lg.e.stopT':'Generation stopped','lg.e.stopD':'Paragraphs without a {l} translation: {ids}. Add the translation to the template and try again.','lg.e.noDoc':'Document not found','lg.e.prep':'OTA is preparing this document — it will appear here when ready.','lg.e.generic':'Couldn’t complete the action','lg.e.issueT':'The package can’t be issued','lg.e.issueD':'Required data or a translation is missing. Fill in the fields or mark them “not applicable”, then try again.',
'lg.e.email':'Enter an e-mail like name@company.com','lg.e.iban':'Check the IBAN: 2 country letters, 2 digits, then the account number','lg.e.swift':'SWIFT/BIC has 8 or 11 characters','lg.e.domain':'Enter a domain, e.g. connect.brand.com','lg.e.num':'Enter a whole number',
'lg.block.unsigned':'Orders for {c} open once the document package is signed (Master Agreement and the country Order Form). Go to Documents.','lg.block.overdue':'New Order Form version {n} took effect on {d} but isn’t signed — new key and token orders for {c} are blocked until it is signed. Activated devices and paid plans are not affected.',
'lg.print.hint':'A4, two columns. In the print dialog choose “Save as PDF”.','lg.print.go':'Print / PDF','lg.cert.demo':'Demo: the real PAdES seal is applied by the backend; this shows its block and hash.',
'lg.st.f.filled':'filled','lg.st.f.empty':'empty','lg.st.f.na':'not applicable',
'lg.auth.director':'Director (articles of association)','lg.auth.poa':'Power of attorney','lg.lang2.na':'translation not approved yet','lg.tm.yes':'Yes, we own the marks','lg.tm.no':'No, another company owns them','lg.tm.yes.d':'Document 05A — brand licence','lg.tm.no.d':'Document 05B — brand owner letter (signed scan)',
'lg.file.none':'no file uploaded','lg.file.replace':'Replace','lg.file.choose':'Upload','lg.na.by':'Not applicable (OTA decision)','lg.cmt.yours':'Your note to OTA','lg.cmt.btn':'Don’t have this?',
'lg.row.del':'Remove row','lg.row.add':'Add row','lg.tm.empty':'Add at least one mark','lg.dev.ok':'Approved','lg.dev.okB':'approved by OTA','lg.dev.wait':'in review','lg.dev.st':'Status','lg.dev.empty':'Add models or fill from the catalog','lg.dev.prefill':'Fill from catalog',
'lg.chg.req':'Request a change','lg.g.company':'Company','lg.g.sign':'Signatory & authority','lg.g.lang':'Document language','lg.g.brand':'Brand & trademarks','lg.g.domain':'Domain & brand files','lg.g.contacts':'Contacts','lg.g.bank':'Bank details (USD)','lg.g.cc':'Order Form details — {c}',
'lg.lang2.d':'Documents are always in English; the second column is the language you choose. Only languages with a full approved translation of every template are available.','lg.locked.d':'The package has been issued — these details change through OTA (a new document version or a change-of-details notice).','lg.tm.ownerH':'Brand owner (for letter 05B)',
'lg.cc.prices':'OTA price list v{v}: key {k}. OTA sets prices; they enter the Order Form when it is generated.','lg.cc.noprices':'OTA hasn’t set prices for this country yet.','lg.cc.pricesLink':'Prices',
'lg.form.st.approved':'Reviewed by OTA','lg.form.st.submitted':'In OTA review','lg.form.st.draft':'Draft','lg.form.progress':'Questionnaire progress','lg.form.progT':'{x} of {n} required fields','lg.form.submit':'Submit for review','lg.form.subAt':'Submitted {d}','lg.form.left':'{n} left:',
'lg.form.otaRo':'OTA mode: the partner fills in the questionnaire. “Not applicable” flags, the 05A/05B choice and country data are on the Partner review page.','lg.chg.pending':'A change-of-details request is waiting for OTA review.','lg.chg.toSign':'OTA approved the change of details — sign notice {n}.',
'lg.form.title':'Partner questionnaire','lg.form.sub':'Every field goes into the package documents. If you don’t have something, leave a note — OTA decides whether the field is not applicable.',
'lg.ota.only':'OTA team only','lg.ota.onlyD':'Turn on OTA mode in the sidebar.',
'lg.rv.status':'Ready to generate the package','lg.rv.approvedAt':'Reviewed {d}','lg.rv.ck.submitted':'Questionnaire submitted','lg.rv.ck.form':'Required fields filled or N/A','lg.rv.ck.kyc':'KYC & sanctions passed','lg.rv.ck.code':'Partner code approved','lg.rv.ck.brand':'05A / 05B chosen','lg.rv.ck.prices':'Prices for every country','lg.rv.ck.devices':'Annex 1 devices approved',
'lg.rv.next':'Review complete. Generate the document package.','lg.rv.toPkg':'Go to package','lg.rv.approve':'Complete review','lg.rv.kyc':'KYC / sanctions',
'lg.kyc.registry':'Company registry','lg.kyc.registry.d':'Company exists; number and address match the questionnaire','lg.kyc.ubo':'Beneficial owners','lg.kyc.ubo.d':'UBOs identified, documents received','lg.kyc.sanctions':'Sanctions lists','lg.kyc.sanctions.d':'Company, UBOs, signatory — OFAC, EU, UK, UN','lg.kyc.territories':'Excluded Territories','lg.kyc.territories.d':'No sales in Russia, Belarus or occupied territories','lg.kyc.authority':'Signatory authority','lg.kyc.authority.d':'Position or power of attorney verified','lg.kyc.bank':'Bank account','lg.kyc.bank.d':'Beneficiary matches the company name',
'lg.rv.code':'Partner code','lg.rv.codeD':'3 Latin letters, unique forever; OTA, INV, TST are reserved. The code is part of every document number.','lg.rv.codeOk':'approved','lg.rv.codeProp':'proposed','lg.rv.codeNew':'Code','lg.rv.codeApprove':'Approve code','lg.rv.codeBad.format':'Use exactly 3 Latin letters','lg.rv.codeBad.reserved':'This code is reserved (OTA, INV, TST)','lg.rv.codeBad.taken':'Another partner already uses this code',
'lg.rv.brand':'Brand document','lg.rv.brandD':'If the partner owns the marks — licence 05A; if another company does — brand owner letter 05B (signed scan).','lg.rv.b05A':'licence','lg.rv.b05B':'owner letter','lg.rv.brandNone':'Choose one — the package can’t be generated without it.',
'lg.rv.f':'Field','lg.rv.v':'Value','lg.rv.cmt':'Note / reason','lg.na.clear':'Remove N/A','lg.na.set':'Not applicable','lg.rv.noOpen':'All fields are filled','lg.rv.fields':'Questionnaire fields','lg.rv.onlyOpen':'Empty only',
'lg.rv.naRule':'Only OTA sets “not applicable”. Such a field never appears in any document: the table row or the conditional fragment is removed entirely.','lg.rv.prices':'Prices','lg.rv.plCur':'Price list in force','lg.rv.from':'from','lg.rv.fee':'fee','lg.rv.plPend':'Scheduled','lg.ch.increase':'price increase',
'lg.rv.ota':'OTA data','lg.rv.otaEdit':'Edit','lg.rv.otaD':'Shared by all partners. An empty field = “not applicable” and is never printed.',
'lg.chg.reqT':'Change of partner details','lg.chg.pendingB':'waiting for OTA','lg.chg.old':'Was','lg.chg.new':'Becomes','lg.chg.reject':'Reject','lg.chg.approve':'Approve and issue the notice',
'lg.dec.title':'Class A change declined','lg.dec.rule':'Declining doesn’t change the blocking rule: after the effective date new orders for the country are blocked until it’s signed.','lg.dec.handled':'Handled',
'lg.rv.title':'Partner review','lg.rv.sub':'{n}: questionnaire, KYC, code, 05A/05B, prices and countries','lg.rv.openForm':'Questionnaire','lg.rv.adminNote':'OTA team actions (OTA Admin / OTA Legal). The partner only sees the result.',
'lg.st.draft':'Draft','lg.st.issued':'Awaiting signature','lg.st.signed_partner':'Signed by partner','lg.st.signed_both':'In force','lg.st.acknowledged':'Acknowledged','lg.st.superseded':'Superseded','lg.st.terminated':'Withdrawn','lg.st.scan':'Scan received','lg.st.signedP':'Signed by partner','lg.st.autoEff':'In force','lg.st.signedFuture':'Signed · in force from {d}',
'lg.cls.A':'class A','lg.cls.B':'class B','lg.cls.C':'class C','lg.stp.form':'Questionnaire','lg.stp.review':'OTA review','lg.stp.gen':'Generation','lg.stp.psign':'Partner signs','lg.stp.osign':'OTA signs','lg.stp.done':'Orders open',
'lg.pkg.regen':'Refresh drafts','lg.pkg.gen':'Generate package','lg.pkg.issue':'Issue for signature','lg.pkg.osign':'Sign for OTA','lg.pkg.sign':'Sign the package',
'lg.pkg.emptyT.form':'Start with the questionnaire','lg.pkg.emptyD.form':'The package is generated from your questionnaire. Fill it in and submit it to OTA.','lg.pkg.emptyT.review':'Questionnaire in OTA review','lg.pkg.emptyD.review':'OTA checks the data, assigns the partner code and sets prices. Then the package is generated.','lg.pkg.emptyT.ready':'Ready to generate','lg.pkg.emptyD.ready':'Review complete — OTA is generating the documents.',
'lg.pkg.toForm':'Fill in the questionnaire','lg.pkg.noTr':'no translation','lg.pkg.miss':'{n} missing','lg.pkg.ready':'ready','lg.boa.hint':'Signed by the brand owner — upload the signed scan','lg.col.no':'Doc','lg.col.doc':'Document','lg.col.num':'Number','lg.col.cls':'Class','lg.col.eff':'Effective','lg.col.ver':'Version',
'lg.pkg.title':'Partner package','lg.pkg.lang':'EN + {l}','lg.pkg.draftNote':'Drafts: numbers are assigned and won’t change when you regenerate. Partner data is highlighted in yellow.','lg.pkg.signedNote':'Signed by both parties. Key and token orders are open.',
'lg.chg.title':'New versions & changes','lg.eff.onSign':'on signature','lg.dec.b':'declined','lg.f.live':'In force','lg.f.pending':'In progress','lg.f.old':'Old versions','lg.all.arch':'Show archived','lg.all.title':'All documents','lg.arch.b':'archived','lg.all.none':'No documents',
'lg.pub.manage':'Manage versions','lg.pub.title':'Public documents 07 / 08','lg.pub.lang':'Language','lg.pub.date':'Published','lg.pub.web':'Web view','lg.pub.none':'Nothing published yet',
'lg.k.pkg':'Package','lg.stage.form':'Questionnaire','lg.stage.review':'Review','lg.stage.ready':'Generation','lg.stage.draft':'Draft','lg.stage.issued':'Awaiting signature','lg.stage.signed_partner':'Awaiting OTA','lg.stage.signed':'Signed','lg.k.live':'Documents in force','lg.k.tasks':'Your tasks','lg.k.chg':'New versions',
'lg.docs.title':'Documents','lg.docs.sub':'The CONNECT FOR BRANDS package: generated from the questionnaire, e-signed by both parties, versioned when terms change.','lg.docs.admin':'OTA mode: generate, issue and sign for OTA. Yellow-highlighted drafts are visible to OTA only.',
'lg.chg.notice':'Change-of-details notice','lg.ch.d.increase':'New version: price increase','lg.ch.d.decrease':'New version: price decrease','lg.ch.d.country':'New country','lg.ch.d.text':'New template text {v}',
'lg.dv.print':'Download PDF','lg.dv.preview':'A4 preview','lg.dv.diff':'Compare with previous','lg.dv.ack':'Acknowledge','lg.dv.sign':'Sign','lg.dv.draftOta':'OTA draft: partner data is highlighted in yellow. The final PDF has no highlighting.','lg.dv.draftP':'Draft — not issued for signature yet.',
'lg.dv.missT':'Missing data: {n}. The document can’t be issued for signature.','lg.dv.missFix':'Fill in the data','lg.dv.superseded':'This version was superseded by {n}. It stays available for download.','lg.dv.effA':'Takes effect on {d}. If not signed by then, new key and token orders for {c} will be blocked.','lg.dv.effB':'Takes effect automatically on {d}. Nothing is blocked.',
'lg.dec.note':'The partner declined this change: “{c}” ({n}). The blocking rule is unchanged.','lg.dv.integChk':'Checking integrity…','lg.dv.details':'Details','lg.dv.pl':'Price list','lg.dv.supersedes':'Replaces','lg.dv.issued':'Issued','lg.dv.sigs':'Signatures',
'lg.rem.title':'Reminders','lg.rem.n':'{n} days before','lg.rem.manual':'sent manually','lg.rem.copy':'E-mail to the partner signatory, copy to the OTA manager.','lg.rem.send':'Send now',
'lg.boa.d':'The brand owner signs this letter. Download the PDF, have it signed and upload the signed scan.','lg.boa.dl':'Download letter','lg.boa.got':'Scan: {f}','lg.boa.up':'Upload signed scan',
'lg.kep.d':'Need a qualified e-signature (KEP) for your accounting? Download the PDF, sign it and add the file as an additional copy.','lg.kep.up':'Add KEP-signed copy','lg.dec.d':'Don’t agree with the change? Leave a comment — it goes to the OTA manager.','lg.dec.btn':'Decline change',
'lg.arch.btn':'Archive','lg.arch.d':'Signed documents can’t be edited or deleted — only archived.','lg.dv.more':'Actions','lg.au.title':'Audit log','lg.au.all':'Full log','lg.dv.integOk':'Integrity verified (SHA-256 matches)','lg.dv.integBad':'Hash mismatch — the document was changed',
'lg.sg.pkgT':'Document package ({n})','lg.sg.osign':'Sign for OTA','lg.sg.open':'Review and sign','lg.sg.ack':'Review and acknowledge','lg.sg.openDoc':'Open','lg.sg.review':'Questionnaire awaiting review','lg.sg.reviewD':'The partner submitted the questionnaire','lg.sg.detailsD':'The partner asks to change details',
'lg.det.country':'New country: {c} — Order Form needed','lg.det.price':'Prices changed: {c}','lg.det.d':'Price list v{v} from {d}','lg.det.go':'Issue version',
'lg.sg.who':'Only the signatory named in the questionnaire can sign: {n}, {ti}.','lg.sg.otaWho':'OTA Legal signs for OTA.','lg.sg.title':'Signing','lg.sg.subO':'Documents signed by the partner are waiting for OTA’s signature.','lg.sg.sub':'Documents waiting for your signature or acknowledgment.',
'lg.sg.none':'No tasks','lg.sg.noneD':'Everything is signed. New versions will show up here.','lg.sg.as':'You are acting as {n} ({r}).','lg.sg.nothing':'Nothing to sign','lg.sg.nothingD':'These documents are already signed or not issued yet.',
'lg.sg.agreeAck':'I have read the new version on behalf of {p}','lg.sg.agree':'I have read and am authorised to sign on behalf of {p}','lg.sg.mismatch':'You are signed in as {n} ({ti}), but the questionnaire names {pn} ({pt}) as signatory. Only they can sign.','lg.sg.ackWho':'The partner signatory confirms acknowledgments.','lg.sg.roleOnly':'Only a user with the Partner Signatory role can sign.',
'lg.sg.ackTitle':'Acknowledge new version','lg.sg.otaTitle':'Sign for OTA','lg.sg.signTitle':'Sign documents','lg.sg.allIn':'{n} documents — one signature for all','lg.sg.oneAction':'The package is signed in one action: one signature goes on every document at once. You can’t sign part of it.','lg.sg.box':'Full text of the documents',
'lg.sg.end':'End of documents','lg.sg.scroll':'Scroll to the end to enable signing','lg.sg.scrolled':'Documents reviewed','lg.sg.ackBtn':'Acknowledge','lg.sg.btn':'Sign',
'lg.tp.tab.t':'Templates','lg.tp.tab.c':'Changes','lg.tp.tab.p':'Public 07/08','lg.tp.type':'Type','lg.tp.cur':'Current version','lg.tp.vers':'Versions','lg.tp.draftB':'draft {v}',
'lg.det.title':'Price-list changes found','lg.det.cur':'now {n} (prices v{v})','lg.ch.country':'new country','lg.ch.decrease':'price decrease','lg.ch.r.country':'Sales in the country open after signing.','lg.ch.r.increase':'Notice ≥ 90 days: effective {d}; unsigned → country orders blocked.','lg.ch.r.decrease':'Effective right after signatures; old prices apply until then.',
'lg.det.issue':'Issue new Order Form version','lg.det.none':'All Order Forms match the price lists in force.','lg.det.how':'The portal compares each country price list with the version in its Order Form.','lg.ch.title':'Released changes','lg.ch.none':'No changes yet','lg.cls.title':'Change classes (MPA clause 16.5)',
'lg.tp.title':'Templates & versions','lg.tp.sub':'v09 texts paragraph by paragraph (EN + translations), versions, change classes and releases.','lg.tp.admin':'OTA Legal: templates, versions, change classes, releases. Old versions are never deleted.','lg.ch.k.tpl':'new text {v}',
'lg.cls.what':'What changes','lg.cls.need':'From the partner','lg.cls.term':'Term','lg.cls.miss':'If not signed',
'lg.cls.r.A.n':'critical','lg.cls.r.A.w':'Prices and commercial terms (new Order Form version); rights and obligations in 01, 03, 05A, 06, 09','lg.cls.r.A.q':'Signature','lg.cls.r.A.t':'Price increase ≥ 90 days; other ≥ 30 days','lg.cls.r.A.m':'New keys and tokens blocked for the country',
'lg.cls.r.Anew.n':'new country','lg.cls.r.Anew.w':'New Order Form','lg.cls.r.Anew.q':'Signature','lg.cls.r.Anew.t':'—','lg.cls.r.Anew.m':'Sales in the country don’t open',
'lg.cls.r.Adown.n':'price decrease','lg.cls.r.Adown.w':'New Order Form version in the partner’s favour','lg.cls.r.Adown.q':'Signature','lg.cls.r.Adown.t':'Right after signatures','lg.cls.r.Adown.m':'Old prices apply',
'lg.cls.r.B.n':'non-critical','lg.cls.r.B.w':'Clarifications of 04, sub-processors (06), editorial edits, templates 10–14','lg.cls.r.B.q':'“Acknowledged” mark','lg.cls.r.B.t':'30 days','lg.cls.r.B.m':'Takes effect automatically, nothing blocked',
'lg.cls.r.C.n':'public','lg.cls.r.C.w':'07, 08 for end users','lg.cls.r.C.q':'Partner notified','lg.cls.r.C.t':'Material — 30 days','lg.cls.r.C.m':'—',
'lg.tp.ver':'Version','lg.tp.note':'Summary of changes','lg.tp.base':'Pack v09','lg.tp.st.draft':'draft','lg.tp.st.released':'released','lg.tp.edDraft':'Draft {v}','lg.tp.edNew':'New template version','lg.tp.block':'Clause','lg.tp.l2':'second language','lg.tp.ruH':'An empty translation stops generation (spec §10.10 check).','lg.tp.effH':'Class A — no sooner than 30 days','lg.tp.notePh':'In short: what changed','lg.tp.saveDraft':'Save draft','lg.tp.saveNew':'Create new version','lg.tp.bump':'New version, same text',
'lg.tp.rel':'Release {v}','lg.tp.relOk':'Every paragraph is translated — generation checked.','lg.tp.affPub':'New public document versions to publish: {n}.','lg.tp.aff':'Documents in force affected: {n}. Each gets a new version with the same number.','lg.tp.preview':'Preview','lg.tp.issue':'Release',
'lg.tp.edSub':'Current version {v}. The template is stored paragraph by paragraph: EN + a translation of every clause.','lg.tp.hist':'Version history','lg.tp.legalOnly':'Templates are edited by OTA Legal.','lg.tp.bumpNote':'New version, text unchanged','lg.tp.effPast':'The date can’t be in the past',
'lg.pub.minor':'New version x.+1','lg.pub.major':'Material change +1.0','lg.pub.cur':'current','lg.pub.notified':'Partner notified','lg.pub.notifiedAt':'notified {d}','lg.pub.notify':'Mark “notified”','lg.pub.cc':'Country','lg.pub.add':'Publish',
'lg.pub.d':'Published on the partner’s domain in one language (the user’s), without header or document number. Version number: OTA-EUT-CC-lang-vX.Y.','lg.pub.miss':'Missing for the web view: {k}','lg.pub.exists':'This version is already published — release a new one',
'lg.df.added':'added','lg.df.removed':'removed','lg.df.title':'Compare versions','lg.df.only':'Changed clauses only','lg.df.sum':'Clauses changed: {n}. The new version takes effect: {e}.','lg.df.none':'No differences',
'lg.au.c.docs':'Documents','lg.au.c.sign':'Signatures & views','lg.au.c.form':'Questionnaire','lg.au.c.orders':'Orders','lg.au.c.system':'System','lg.au.noT':'No access','lg.au.noD':'The log is available to OTA Legal and the Partner Admin.',
'lg.au.when':'When','lg.au.who':'Who','lg.au.what':'Action','lg.au.obj':'Object','lg.au.hash':'Hash','lg.au.sub':'Every document action: who, when, IP, device and the document hash.','lg.au.csv':'CSV','lg.au.pdf':'PDF','lg.au.append':'Append-only: entries are never edited or deleted. Kept for 10 years.','lg.au.search':'Search: action, number, person','lg.au.allRoles':'All roles','lg.au.n':'{n} entries',
'lg.cmt.title':'Don’t have this data','lg.cmt.d':'Field “{f}”. You can’t mark it “not applicable” yourself — leave a note and OTA will decide.','lg.cmt.lbl':'Note to OTA','lg.cmt.def':'We don’t have this data','lg.cmt.send':'Send',
'lg.t.notDone':'Fill in {n} more required fields','lg.log.submitted':'Questionnaire submitted for OTA review','lg.t.submitted':'Questionnaire submitted for OTA review','lg.t.prefill':'Added {n} models from the catalog. Add revision, firmware and traffic.','lg.t.prefill0':'All catalog models are already listed',
'lg.chg.reqD':'Signed documents are not reissued. After OTA checks the change you’ll sign a change-of-details notice.','lg.chg.send':'Send for review','lg.t.chgOk':'Change approved — notice issued for the partner’s signature','lg.t.chgRej':'Request rejected',
'lg.log.review':'OTA completed the partner review','lg.t.review':'Review completed','lg.na.title':'Mark “not applicable”','lg.na.d':'Field {f} will not appear in any document.','lg.na.reason':'Reason','lg.t.naClr':'N/A flag removed',
'lg.t.gen':'Package generated: {n} documents','lg.log.issued':'Package issued for signature ({n} documents)','lg.t.issued':'Issued for signature: {n} documents. Text frozen, SHA-256 stored.','lg.t.remind':'Reminder sent to {e} (copy to the OTA manager)',
'lg.dec.cmt':'Why don’t you agree?','lg.dec.send':'Send','lg.arch.q':'Archive {n}? It stays available and unchanged.','lg.t.arch':'{n} archived',
'lg.otp.title':'Confirm signature','lg.otp.d':'We sent a 6-digit code to {e}. One signature for {n} documents.','lg.otp.lbl':'Code from the e-mail','lg.otp.legal':'A portal signature confirmed by a one-time code, with the audit trail, is a valid electronic signature (MPA clause 2.5).','lg.otp.resend':'Resend','lg.otp.go':'Sign ({n})','lg.otp.toast':'Code sent to {e}: {c}',
'lg.t.ack':'Acknowledgment of {n} confirmed','lg.t.ofIssued':'New version {n} issued for signature','lg.t.tplSaved':'Version draft saved','lg.t.released':'Version {v} released: {n} documents','lg.t.pub':'Published {n}','lg.t.notified':'Marked: partner notified','lg.t.csv':'Exported {n} entries','lg.t.cmt':'Note sent to OTA',
'lg.na.reasonReq':'Enter a reason','lg.t.na':'“{f}” — not applicable','lg.log.code':'Partner code {c} approved','lg.t.code':'Code {c} approved','lg.chg.none':'You haven’t changed anything','lg.t.chgSent':'Request sent to OTA','lg.dec.req':'Write a comment','lg.t.decl':'Sent to the OTA manager',
'lg.otp.bad':'Wrong code. Check the e-mail and try again.','lg.log.signedO':'OTA signed {n} documents','lg.log.signedP':'Partner signed {n} documents','lg.t.signed':'Signed {n} documents · ID {id}','lg.t.file':'File {f} added','lg.t.scan':'Scan {f} received','lg.t.kep':'KEP-signed copy {f} added',
'lg.h.P_FORM_EN':'E.g. a private limited company incorporated in England and Wales','lg.h.P_TITLE_L2_GEN':'For “represented by …”, e.g. директора','lg.h.P_TAXNO':'No number? Leave a note','lg.h.P_DOMAIN':'E.g. connect.brand.com','lg.h.P_TM_LIST':'Mark, registration no. and office, countries, Nice classes','lg.h.DEVICES':'The partner fills in, OTA approves. Only approved models go into Annex 1.','lg.h.P_BANK_INTERMEDIARY':'No intermediary bank? Leave a note for OTA','lg.h.P_AUTHORITY_FILE':'Power of attorney (PDF)',
'lg.f.P_NAME':'Full company name','lg.f.P_FORM_EN':'Legal form & country (EN)','lg.f.P_FORM_L2':'Legal form & country (2nd language)','lg.f.P_COUNTRY':'Country of registration','lg.f.P_REGNO':'Registration number','lg.f.P_TAXNO':'Tax / VAT number','lg.f.P_ADDR_EN':'Registered address (EN)','lg.f.P_ADDR_L2':'Registered address (2nd language)',
'lg.f.P_SIGNATORY':'Signatory full name (Latin)','lg.f.P_TITLE_EN':'Title (EN)','lg.f.P_TITLE_L2':'Title (2nd language)','lg.f.P_TITLE_L2_GEN':'Title, genitive case','lg.f.P_AUTHORITY':'Basis of authority','lg.f.P_AUTHORITY_FILE':'Power of attorney file','lg.f.LANG2':'Second document language',
'lg.f.P_BRAND':'Brand','lg.f.P_PROGRAMME':'Programme name (“BRAND CONNECT”)','lg.f.P_TM_OWNER_IS_PARTNER':'Does your company own the marks?','lg.f.P_TM_LIST':'Trademark registrations','lg.f.P_BRAND_CONTACT':'Brand approval contact','lg.f.P_BRAND_RULES':'Logo rules, colours, fonts',
'lg.f.P_TM_OWNER_NAME':'Brand owner: name','lg.f.P_TM_OWNER_COUNTRY_EN':'Country of incorporation (EN)','lg.f.P_TM_OWNER_COUNTRY_L2':'Country (2nd language)','lg.f.P_TM_OWNER_REGNO':'Registration number','lg.f.P_TM_OWNER_ADDR':'Address','lg.f.P_TM_OWNER_RELATION_EN':'Your status with the owner (EN)','lg.f.P_TM_OWNER_RELATION_L2':'Your status (2nd language)','lg.f.P_TM_OWNER_TERRITORY_EN':'Authorised countries (EN)','lg.f.P_TM_OWNER_TERRITORY_L2':'Authorised countries (2nd language)','lg.f.P_TM_OWNER_SIGNATORY':'Owner signatory','lg.f.P_TM_OWNER_TITLE':'Signatory title',
'lg.f.P_DOMAIN':'Portal domain','lg.f.P_DNS_CONTACT':'DNS technical contact','lg.f.P_LOGO':'Logo (file and version)','lg.f.P_BRANDBOOK':'Brand book','lg.f.P_EMAIL_OPS':'Operations e-mail','lg.f.P_EMAIL_LEGAL':'Legal notices e-mail','lg.f.P_EMAIL_FIN':'Finance e-mail','lg.f.P_EMAIL_SUPPORT':'End-user support e-mail','lg.f.P_PHONE':'Phone',
'lg.f.P_BANK_BENEFICIARY':'Beneficiary','lg.f.P_BANK_IBAN':'Account / IBAN (USD)','lg.f.P_BANK_NAME':'Bank','lg.f.P_BANK_ADDR':'Bank address','lg.f.P_BANK_SWIFT':'SWIFT','lg.f.P_BANK_INTERMEDIARY':'Intermediary bank (SWIFT)',
'lg.f.TM_MARK':'Mark','lg.f.TM_REGNO':'No. & office','lg.f.TM_COUNTRIES':'Countries','lg.f.TM_CLASSES':'Classes','lg.f.DEV_BRAND':'Brand','lg.f.DEV_MODEL':'Model','lg.f.DEV_HW':'HW revision','lg.f.DEV_FW':'Firmware','lg.f.DEV_PLAN':'Plan','lg.f.DEV_MB':'MB/month','lg.f.DEV_SIM':'SIM type','lg.f.DEVICES':'Annex 1: devices',
'lg.f.LAUNCH_DATE':'Launch date','lg.f.RETAIL_CUR':'Retail currency','lg.f.DELIVERY_ADDR':'SIM delivery address','lg.f.IMPORTER':'Importer of record','lg.f.INIT_SIMS':'Initial SIM shipment, pcs','lg.f.INIT_KEYS':'Initial Activation Keys','lg.f.INIT_TOKENS':'Initial Service Tokens','lg.f.ANNUAL_TARGET':'Annual target (activated devices)','lg.f.OF_EXCEPTIONS_EN':'Exceptions to clause 5.6 (EN)','lg.f.OF_EXCEPTIONS_L2':'Exceptions to clause 5.6 (2nd language)',
'lg.f.CC_NAME_L2':'Country (2nd language)','lg.f.CC_NAME_FULL_EN':'Official country name (EN)','lg.f.CC_NAME_FULL_L2':'Official name (2nd language)','lg.f.CC_NAME_LOC_L2':'Country, locative case','lg.f.CC_EXCLUSION_EN':'Excluded territories (EN)','lg.f.CC_EXCLUSION_L2':'Excluded territories (2nd language)','lg.f.EUT_LANGS':'07: publication languages','lg.f.EUT_CONSUMER_AUTH':'07: consumer authority','lg.f.EUT_DP_AUTH':'07: data protection authority','lg.f.EUT_WITHDRAWAL':'07: withdrawal & refund rules','lg.f.EUT_OTHER':'07: other mandatory information'},
ru:{'lg.sec':'Документы','lg.otasec':'OTA · Юридическое','lg.nav.docs':'Документы','lg.nav.form':'Анкета','lg.nav.sign':'Подписание','lg.nav.audit':'Журнал аудита','lg.nav.review':'Проверка партнёра','lg.nav.tpl':'Шаблоны и версии',
'lg.demo':'демо','lg.partner':'Партнёр','lg.sel':'— выберите —','lg.rows':'{n} строк',
'lg.e.noTpl':'Шаблон {t} не найден','lg.e.stopT':'Генерация остановлена','lg.e.stopD':'Нет перевода абзацев на второй язык ({l}): {ids}. Добавьте перевод в шаблон и повторите.','lg.e.noDoc':'Документ не найден','lg.e.prep':'Документ готовит OTA — он появится здесь, как только будет готов.','lg.e.generic':'Не удалось выполнить действие','lg.e.issueT':'Пакет нельзя выпустить','lg.e.issueD':'Не хватает обязательных данных или перевода. Заполните поля или отметьте их «не применимо» и повторите.',
'lg.e.email':'Укажите e-mail в формате name@company.com','lg.e.iban':'Проверьте IBAN: 2 буквы страны, 2 цифры, затем номер счёта','lg.e.swift':'SWIFT/BIC — 8 или 11 символов','lg.e.domain':'Укажите домен, например connect.brand.com','lg.e.num':'Укажите целое число',
'lg.block.unsigned':'Заказы по стране {c} откроются после подписания пакета документов (Рамочное соглашение и Заказ по стране). Перейдите в «Документы».','lg.block.overdue':'Новая версия Заказа {n} вступила в силу {d}, но не подписана — новые заказы ключей и токенов по стране {c} заблокированы до подписания. Активированные устройства и оплаченные тарифы не затрагиваются.',
'lg.print.hint':'A4, две колонки. В окне печати выберите «Сохранить как PDF».','lg.print.go':'Печать / PDF','lg.cert.demo':'Демо: настоящая печать PAdES ставится на бэкенде; здесь показан её блок и хэш.',
'lg.st.f.filled':'заполнено','lg.st.f.empty':'пусто','lg.st.f.na':'не применимо',
'lg.auth.director':'Директор (устав)','lg.auth.poa':'Доверенность','lg.lang2.na':'перевод ещё не утверждён','lg.tm.yes':'Да, знаки принадлежат нам','lg.tm.no':'Нет, знаки принадлежат другой компании','lg.tm.yes.d':'Документ 05A — лицензия на бренд','lg.tm.no.d':'Документ 05B — письмо правообладателя (подписанный скан)',
'lg.file.none':'файл не загружен','lg.file.replace':'Заменить','lg.file.choose':'Загрузить','lg.na.by':'Не применимо (решение OTA)','lg.cmt.yours':'Ваш комментарий для OTA','lg.cmt.btn':'Нет таких данных?',
'lg.row.del':'Удалить строку','lg.row.add':'Добавить строку','lg.tm.empty':'Добавьте хотя бы один знак','lg.dev.ok':'Одобрено','lg.dev.okB':'одобрено OTA','lg.dev.wait':'на проверке','lg.dev.st':'Статус','lg.dev.empty':'Добавьте модели или заполните из каталога','lg.dev.prefill':'Заполнить из каталога',
'lg.chg.req':'Запросить изменение','lg.g.company':'Компания','lg.g.sign':'Подписант и полномочия','lg.g.lang':'Язык документов','lg.g.brand':'Бренд и товарные знаки','lg.g.domain':'Домен и файлы бренда','lg.g.contacts':'Контакты','lg.g.bank':'Банковские реквизиты (USD)','lg.g.cc':'Параметры Заказа — {c}',
'lg.lang2.d':'Документы всегда на английском; вторая колонка — выбранный язык. Доступны только языки с полным утверждённым переводом всех шаблонов.','lg.locked.d':'Пакет уже выпущен — эти данные меняются через OTA (новая версия документа или уведомление об изменении реквизитов).','lg.tm.ownerH':'Правообладатель (для письма 05B)',
'lg.cc.prices':'Прайс-лист OTA v{v}: ключ {k}. Цены устанавливает OTA, они попадают в Заказ при генерации.','lg.cc.noprices':'OTA ещё не установила цены для этой страны.','lg.cc.pricesLink':'Цены',
'lg.form.st.approved':'Проверено OTA','lg.form.st.submitted':'На проверке OTA','lg.form.st.draft':'Черновик','lg.form.progress':'Заполнение анкеты','lg.form.progT':'{x} из {n} обязательных полей','lg.form.submit':'Отправить на проверку','lg.form.subAt':'Отправлено {d}','lg.form.left':'Осталось {n}:',
'lg.form.otaRo':'Режим OTA: анкету заполняет партнёр. Отметки «не применимо», выбор 05A/05B и данные стран — на странице «Проверка партнёра».','lg.chg.pending':'Запрос на изменение реквизитов ждёт проверки OTA.','lg.chg.toSign':'OTA подтвердила изменение реквизитов — подпишите уведомление {n}.',
'lg.form.title':'Анкета партнёра','lg.form.sub':'Каждое поле подставляется в документы пакета. Если данных нет — оставьте комментарий, OTA решит, применимо ли поле.',
'lg.ota.only':'Только для команды OTA','lg.ota.onlyD':'Включите режим OTA в боковом меню.',
'lg.rv.status':'Готовность к генерации пакета','lg.rv.approvedAt':'Проверено {d}','lg.rv.ck.submitted':'Анкета отправлена','lg.rv.ck.form':'Обязательные поля заполнены или N/A','lg.rv.ck.kyc':'KYC и санкции пройдены','lg.rv.ck.code':'Код партнёра утверждён','lg.rv.ck.brand':'Выбран 05A / 05B','lg.rv.ck.prices':'Цены по всем странам','lg.rv.ck.devices':'Устройства Приложения 1 одобрены',
'lg.rv.next':'Проверка завершена. Сформируйте пакет документов.','lg.rv.toPkg':'К пакету','lg.rv.approve':'Завершить проверку','lg.rv.kyc':'KYC / санкции',
'lg.kyc.registry':'Реестр компаний','lg.kyc.registry.d':'Компания существует, номер и адрес совпадают с анкетой','lg.kyc.ubo':'Конечные бенефициары','lg.kyc.ubo.d':'Бенефициары установлены, документы получены','lg.kyc.sanctions':'Санкционные списки','lg.kyc.sanctions.d':'Компания, бенефициары, подписант — OFAC, ЕС, Великобритания, ООН','lg.kyc.territories':'Исключённые территории','lg.kyc.territories.d':'Нет продаж в РФ, Беларуси, на оккупированных территориях','lg.kyc.authority':'Полномочия подписанта','lg.kyc.authority.d':'Должность или доверенность проверены','lg.kyc.bank':'Банковский счёт','lg.kyc.bank.d':'Получатель совпадает с названием компании',
'lg.rv.code':'Код партнёра','lg.rv.codeD':'3 латинские буквы, уникальны навсегда; OTA, INV, TST зарезервированы. Код входит в номера всех документов.','lg.rv.codeOk':'утверждён','lg.rv.codeProp':'предложен','lg.rv.codeNew':'Код','lg.rv.codeApprove':'Утвердить код','lg.rv.codeBad.format':'Нужно ровно 3 латинские буквы','lg.rv.codeBad.reserved':'Код зарезервирован (OTA, INV, TST)','lg.rv.codeBad.taken':'Код уже занят другим партнёром',
'lg.rv.brand':'Документ о бренде','lg.rv.brandD':'Если знаки принадлежат партнёру — лицензия 05A; если другой компании — письмо правообладателя 05B (подписанный скан).','lg.rv.b05A':'лицензия','lg.rv.b05B':'письмо правообладателя','lg.rv.brandNone':'Выберите вариант — без него пакет не сформировать.',
'lg.rv.f':'Поле','lg.rv.v':'Значение','lg.rv.cmt':'Комментарий / причина','lg.na.clear':'Снять N/A','lg.na.set':'Не применимо','lg.rv.noOpen':'Все поля заполнены','lg.rv.fields':'Поля анкеты','lg.rv.onlyOpen':'Только пустые',
'lg.rv.naRule':'«Не применимо» ставит только OTA. Такое поле не выводится ни в одном документе: строка таблицы или условный фрагмент удаляется целиком.','lg.rv.prices':'Цены','lg.rv.plCur':'Действующий прайс-лист','lg.rv.from':'с','lg.rv.fee':'сбор','lg.rv.plPend':'Запланировано','lg.ch.increase':'повышение цен',
'lg.rv.ota':'Данные OTA','lg.rv.otaEdit':'Изменить','lg.rv.otaD':'Одни для всех партнёров. Пустое поле = «не применимо» и не выводится.',
'lg.chg.reqT':'Изменение реквизитов партнёра','lg.chg.pendingB':'ждёт OTA','lg.chg.old':'Было','lg.chg.new':'Станет','lg.chg.reject':'Отклонить','lg.chg.approve':'Подтвердить и сформировать уведомление',
'lg.dec.title':'Отказ от изменения класса A','lg.dec.rule':'Отказ не меняет правило блокировки: после даты вступления в силу новые заказы по стране блокируются до подписания.','lg.dec.handled':'Обработано',
'lg.rv.title':'Проверка партнёра','lg.rv.sub':'{n}: анкета, KYC, код, 05A/05B, цены и страны','lg.rv.openForm':'Анкета','lg.rv.adminNote':'Действия команды OTA (OTA Admin / OTA Legal). Партнёр видит только результат.',
'lg.st.draft':'Черновик','lg.st.issued':'На подписи','lg.st.signed_partner':'Подписан партнёром','lg.st.signed_both':'Действует','lg.st.acknowledged':'Ознакомлен','lg.st.superseded':'Заменён','lg.st.terminated':'Отозван','lg.st.scan':'Скан получен','lg.st.signedP':'Подписан партнёром','lg.st.autoEff':'Вступил в силу','lg.st.signedFuture':'Подписан · действует с {d}',
'lg.tt.MPA':'Рамочное партнёрское соглашение','lg.tt.OF':'Заказ','lg.tt.TRT':'Условия перепродажи сервисных токенов','lg.tt.SLA':'Условия сервиса и SLA','lg.tt.BL':'Лицензия на бренд','lg.tt.BOA':'Письмо правообладателя','lg.tt.DPA':'Соглашение о защите данных','lg.tt.SIM':'Порядок хранения и поставки SIM','lg.tt.EUT':'Условия для пользователей','lg.tt.PN':'Политика конфиденциальности','lg.tt.CHG':'Уведомление об изменении реквизитов',
'lg.cls.A':'класс A','lg.cls.B':'класс B','lg.cls.C':'класс C','lg.stp.form':'Анкета','lg.stp.review':'Проверка OTA','lg.stp.gen':'Генерация','lg.stp.psign':'Подпись партнёра','lg.stp.osign':'Подпись OTA','lg.stp.done':'Заказы открыты',
'lg.pkg.regen':'Обновить черновики','lg.pkg.gen':'Сформировать пакет','lg.pkg.issue':'Выпустить на подпись','lg.pkg.osign':'Подписать от OTA','lg.pkg.sign':'Подписать пакет',
'lg.pkg.emptyT.form':'Начните с анкеты','lg.pkg.emptyD.form':'Пакет документов формируется из данных анкеты. Заполните её и отправьте OTA.','lg.pkg.emptyT.review':'Анкета на проверке OTA','lg.pkg.emptyD.review':'OTA проверяет данные, присваивает код партнёра и устанавливает цены. После этого пакет будет сформирован.','lg.pkg.emptyT.ready':'Можно формировать пакет','lg.pkg.emptyD.ready':'Проверка завершена — OTA формирует документы.',
'lg.pkg.toForm':'Заполнить анкету','lg.pkg.noTr':'нет перевода','lg.pkg.miss':'не хватает {n}','lg.pkg.ready':'готово','lg.boa.hint':'Подписывает правообладатель — загрузите подписанный скан','lg.col.no':'Док.','lg.col.doc':'Документ','lg.col.num':'Номер','lg.col.cls':'Класс','lg.col.eff':'Вступает в силу','lg.col.ver':'Версия',
'lg.pkg.title':'Пакет партнёра','lg.pkg.lang':'EN + {l}','lg.pkg.draftNote':'Черновики: номера уже присвоены и не изменятся при повторной генерации. Данные партнёра подсвечены жёлтым.','lg.pkg.signedNote':'Пакет подписан обеими сторонами. Заказы ключей и токенов открыты.',
'lg.chg.title':'Новые версии и изменения','lg.eff.onSign':'после подписания','lg.dec.b':'отказ','lg.f.live':'Действующие','lg.f.pending':'В работе','lg.f.old':'Архив версий','lg.all.arch':'Показать архивные','lg.all.title':'Все документы','lg.arch.b':'архив','lg.all.none':'Документов нет',
'lg.pub.manage':'Управлять версиями','lg.pub.title':'Публичные документы 07 / 08','lg.pub.lang':'Язык','lg.pub.date':'Опубликовано','lg.pub.web':'Веб-версия','lg.pub.none':'Ещё не опубликовано',
'lg.k.pkg':'Пакет','lg.stage.form':'Анкета','lg.stage.review':'Проверка','lg.stage.ready':'Генерация','lg.stage.draft':'Черновик','lg.stage.issued':'На подписи','lg.stage.signed_partner':'Ждёт OTA','lg.stage.signed':'Подписан','lg.k.live':'Действующих документов','lg.k.tasks':'Ваши задачи','lg.k.chg':'Новые версии',
'lg.docs.title':'Документы','lg.docs.sub':'Пакет CONNECT FOR BRANDS: генерация из анкеты, электронная подпись обеими сторонами, версии при изменении условий.','lg.docs.admin':'Режим OTA: генерация, выпуск и подпись от OTA. Черновики с жёлтой подсветкой видит только OTA.',
'lg.chg.notice':'Уведомление об изменении реквизитов','lg.ch.d.increase':'Новая версия: повышение цен','lg.ch.d.decrease':'Новая версия: снижение цен','lg.ch.d.country':'Новая страна','lg.ch.d.text':'Новый текст шаблона {v}',
'lg.dv.print':'Скачать PDF','lg.dv.preview':'Предпросмотр A4','lg.dv.diff':'Сравнить с предыдущей','lg.dv.ack':'Ознакомиться','lg.dv.sign':'Подписать','lg.dv.draftOta':'Черновик для OTA: данные партнёра подсвечены жёлтым. В финальном PDF подсветки нет.','lg.dv.draftP':'Черновик — документ ещё не выпущен на подпись.',
'lg.dv.missT':'Не хватает данных: {n}. Документ нельзя выпустить на подпись.','lg.dv.missFix':'Заполнить данные','lg.dv.superseded':'Эта версия заменена документом {n}. Она остаётся доступной для скачивания.','lg.dv.effA':'Вступает в силу {d}. Если не подписать до этой даты, новые заказы ключей и токенов по стране {c} будут заблокированы.','lg.dv.effB':'Вступает в силу {d} автоматически. Работа не блокируется.',
'lg.dec.note':'Партнёр отказался от изменения: «{c}» ({n}). Правило блокировки не меняется.','lg.dv.integChk':'Проверяем целостность…','lg.dv.details':'Детали','lg.dv.pl':'Прайс-лист','lg.dv.supersedes':'Заменяет','lg.dv.issued':'Выпущен','lg.dv.sigs':'Подписи',
'lg.rem.title':'Напоминания','lg.rem.n':'за {n} дн.','lg.rem.manual':'отправлено вручную','lg.rem.copy':'Письмо подписанту партнёра, копия — менеджеру OTA.','lg.rem.send':'Отправить сейчас',
'lg.boa.d':'Письмо подписывает правообладатель. Скачайте PDF, передайте на подпись и загрузите подписанный скан.','lg.boa.dl':'Скачать письмо','lg.boa.got':'Скан: {f}','lg.boa.up':'Загрузить подписанный скан',
'lg.kep.d':'Нужна КЭП для бухгалтерии? Скачайте PDF, подпишите КЭП и добавьте файл как дополнительный экземпляр.','lg.kep.up':'Добавить экземпляр с КЭП','lg.dec.d':'Не согласны с изменением? Напишите комментарий — его получит менеджер OTA.','lg.dec.btn':'Отказаться от изменения',
'lg.arch.btn':'В архив','lg.arch.d':'Подписанные документы не меняются и не удаляются — только архивируются.','lg.dv.more':'Действия','lg.au.title':'Журнал аудита','lg.au.all':'Весь журнал','lg.dv.integOk':'Целостность подтверждена (SHA-256 совпадает)','lg.dv.integBad':'Хэш не совпадает — документ изменён',
'lg.sg.pkgT':'Пакет документов ({n})','lg.sg.osign':'Подписать от OTA','lg.sg.open':'Просмотреть и подписать','lg.sg.ack':'Просмотреть и ознакомиться','lg.sg.openDoc':'Открыть','lg.sg.review':'Анкета ждёт проверки','lg.sg.reviewD':'Партнёр отправил анкету','lg.sg.detailsD':'Партнёр просит изменить реквизиты',
'lg.det.country':'Новая страна: {c} — нужен Заказ','lg.det.price':'Изменены цены: {c}','lg.det.d':'Прайс-лист v{v} с {d}','lg.det.go':'Выпустить версию',
'lg.sg.who':'Подписывать может только подписант из анкеты: {n}, {ti}.','lg.sg.otaWho':'От OTA подписывает OTA Legal.','lg.sg.title':'Подписание','lg.sg.subO':'Документы, подписанные партнёром, ждут подписи OTA.','lg.sg.sub':'Документы, которые ждут вашей подписи или ознакомления.',
'lg.sg.none':'Нет задач','lg.sg.noneD':'Всё подписано. Новые версии появятся здесь.','lg.sg.as':'Вы действуете как {n} ({r}).','lg.sg.nothing':'Нечего подписывать','lg.sg.nothingD':'Эти документы уже подписаны или ещё не выпущены.',
'lg.sg.agreeAck':'Я ознакомился с новой версией от имени {p}','lg.sg.agree':'Я ознакомился и уполномочен подписать от имени {p}','lg.sg.mismatch':'Вы вошли как {n} ({ti}), а по анкете подписант — {pn} ({pt}). Подписать может только он.','lg.sg.ackWho':'Ознакомление подтверждает подписант партнёра.','lg.sg.roleOnly':'Подписывать может только пользователь с ролью «Подписант партнёра».',
'lg.sg.ackTitle':'Ознакомление с новой версией','lg.sg.otaTitle':'Подпись от OTA','lg.sg.signTitle':'Подписание документов','lg.sg.allIn':'{n} документов — одна подпись на все','lg.sg.oneAction':'Пакет подписывается одним действием: подпись ставится на все документы сразу. Подписать часть нельзя.','lg.sg.box':'Полный текст документов',
'lg.sg.end':'Конец документов','lg.sg.scroll':'Прокрутите до конца, чтобы включить подпись','lg.sg.scrolled':'Документы просмотрены','lg.sg.ackBtn':'Ознакомлен','lg.sg.btn':'Подписать',
'lg.tp.tab.t':'Шаблоны','lg.tp.tab.c':'Изменения','lg.tp.tab.p':'Публичные 07/08','lg.tp.type':'Тип','lg.tp.cur':'Текущая версия','lg.tp.vers':'Версий','lg.tp.draftB':'черновик {v}',
'lg.det.title':'Найдены изменения прайс-листов','lg.det.cur':'сейчас {n} (цены v{v})','lg.ch.country':'новая страна','lg.ch.decrease':'снижение цен','lg.ch.r.country':'Продажи в стране откроются после подписания.','lg.ch.r.increase':'Уведомление ≥ 90 дней: в силе с {d}; без подписи — блокировка заказов по стране.','lg.ch.r.decrease':'В силе сразу после подписей; до этого действуют прежние цены.',
'lg.det.issue':'Выпустить новую версию Заказа','lg.det.none':'Все Заказы соответствуют действующим прайс-листам.','lg.det.how':'Портал сравнивает прайс-лист страны с версией в действующем Заказе.','lg.ch.title':'Выпущенные изменения','lg.ch.none':'Изменений ещё не было','lg.cls.title':'Классы изменений (п. 16.5 Рамочного соглашения)',
'lg.tp.title':'Шаблоны и версии','lg.tp.sub':'Тексты пакета v09 поабзацно (EN + переводы), версии, классы изменений и выпуск обновлений.','lg.tp.admin':'OTA Legal: шаблоны, версии, классы изменений, выпуск обновлений. Старые версии не удаляются.','lg.ch.k.tpl':'новый текст {v}',
'lg.cls.what':'Что меняется','lg.cls.need':'От партнёра','lg.cls.term':'Срок','lg.cls.miss':'Если не подписал',
'lg.cls.r.A.n':'критичное','lg.cls.r.A.w':'Цены и коммерческие условия (новая версия Заказа); права и обязанности в 01, 03, 05A, 06, 09','lg.cls.r.A.q':'Подпись','lg.cls.r.A.t':'Повышение цен ≥ 90 дней; прочее ≥ 30 дней','lg.cls.r.A.m':'Блокируются новые ключи и токены по стране',
'lg.cls.r.Anew.n':'новая страна','lg.cls.r.Anew.w':'Новый Заказ','lg.cls.r.Anew.q':'Подпись','lg.cls.r.Anew.t':'—','lg.cls.r.Anew.m':'Продажи в стране не открываются',
'lg.cls.r.Adown.n':'снижение цен','lg.cls.r.Adown.w':'Новая версия Заказа в пользу партнёра','lg.cls.r.Adown.q':'Подпись','lg.cls.r.Adown.t':'Сразу после подписей','lg.cls.r.Adown.m':'Действуют прежние цены',
'lg.cls.r.B.n':'некритичное','lg.cls.r.B.w':'Уточнения 04, субобработчики 06, редакционные правки, шаблоны 10–14','lg.cls.r.B.q':'Отметка «Ознакомлен»','lg.cls.r.B.t':'30 дней','lg.cls.r.B.m':'Вступает в силу автоматически, без блокировки',
'lg.cls.r.C.n':'публичные','lg.cls.r.C.w':'07, 08 для конечных пользователей','lg.cls.r.C.q':'Уведомление партнёра','lg.cls.r.C.t':'Существенные — 30 дней','lg.cls.r.C.m':'—',
'lg.tp.ver':'Версия','lg.tp.note':'Описание изменений','lg.tp.base':'Пакет v09','lg.tp.st.draft':'черновик','lg.tp.st.released':'выпущена','lg.tp.edDraft':'Черновик {v}','lg.tp.edNew':'Новая версия шаблона','lg.tp.block':'Пункт','lg.tp.l2':'второй язык','lg.tp.ruH':'Пустой перевод остановит генерацию (проверка ТЗ §10.10).','lg.tp.effH':'Класс A — не раньше чем через 30 дней','lg.tp.notePh':'Кратко: что изменилось','lg.tp.saveDraft':'Сохранить черновик','lg.tp.saveNew':'Создать новую версию','lg.tp.bump':'Новая версия без изменения текста',
'lg.tp.rel':'Выпуск {v}','lg.tp.relOk':'Все абзацы переведены — генерация проверена.','lg.tp.affPub':'Будут опубликованы новые версии публичных документов: {n}.','lg.tp.aff':'Затронуто действующих документов: {n}. Для каждого будет создана новая версия с тем же номером.','lg.tp.preview':'Просмотреть','lg.tp.issue':'Выпустить',
'lg.tp.edSub':'Текущая версия {v}. Шаблон хранится поабзацно: EN + перевод каждого пункта.','lg.tp.hist':'История версий','lg.tp.legalOnly':'Редактировать шаблоны может OTA Legal.','lg.tp.bumpNote':'Новая версия без изменения текста','lg.tp.effPast':'Дата не может быть в прошлом',
'lg.pub.minor':'Новая версия x.+1','lg.pub.major':'Существенное изменение +1.0','lg.pub.cur':'текущая','lg.pub.notified':'Партнёр уведомлён','lg.pub.notifiedAt':'уведомлён {d}','lg.pub.notify':'Отметить «уведомлён»','lg.pub.cc':'Страна','lg.pub.add':'Опубликовать',
'lg.pub.d':'Публикуются на домене партнёра на одном языке (языке пользователя), без шапки и номера. Номер версии: OTA-EUT-CC-lang-vX.Y.','lg.pub.miss':'Для веб-версии не хватает: {k}','lg.pub.exists':'Эта версия уже опубликована — выпустите новую',
'lg.df.added':'добавлено','lg.df.removed':'удалено','lg.df.title':'Сравнение версий','lg.df.only':'Только изменённые пункты','lg.df.sum':'Изменено пунктов: {n}. Новая версия вступает в силу: {e}.','lg.df.none':'Различий нет',
'lg.au.c.docs':'Документы','lg.au.c.sign':'Подписи и просмотры','lg.au.c.form':'Анкета','lg.au.c.orders':'Заказы','lg.au.c.system':'Система','lg.au.noT':'Нет доступа','lg.au.noD':'Журнал видят OTA Legal и администратор партнёра.',
'lg.au.when':'Когда','lg.au.who':'Кто','lg.au.what':'Действие','lg.au.obj':'Объект','lg.au.hash':'Хэш','lg.au.sub':'Каждое действие с документами: кто, когда, IP, устройство и хэш документа.','lg.au.csv':'CSV','lg.au.pdf':'PDF','lg.au.append':'Журнал только дополняется: записи не редактируются и не удаляются. Хранение — 10 лет.','lg.au.search':'Поиск: действие, номер, человек','lg.au.allRoles':'Все роли','lg.au.n':'{n} записей',
'lg.cmt.title':'Нет таких данных','lg.cmt.d':'Поле «{f}». Сами вы не можете отметить его «не применимо» — напишите комментарий, и OTA решит.','lg.cmt.lbl':'Комментарий для OTA','lg.cmt.def':'Нет таких данных','lg.cmt.send':'Отправить',
'lg.t.notDone':'Заполните ещё {n} обязательных полей','lg.log.submitted':'Анкета отправлена на проверку OTA','lg.t.submitted':'Анкета отправлена на проверку OTA','lg.t.prefill':'Добавлено моделей из каталога: {n}. Укажите ревизию, прошивку и трафик.','lg.t.prefill0':'Все модели каталога уже в списке',
'lg.chg.reqD':'Подписанные документы не переоформляются. После проверки OTA вы подпишете уведомление об изменении реквизитов.','lg.chg.send':'Отправить на проверку','lg.t.chgOk':'Изменение подтверждено — уведомление выпущено на подпись партнёру','lg.t.chgRej':'Запрос отклонён',
'lg.log.review':'OTA завершила проверку партнёра','lg.t.review':'Проверка завершена','lg.na.title':'Отметить «не применимо»','lg.na.d':'Поле {f} не будет выводиться ни в одном документе.','lg.na.reason':'Причина','lg.t.naClr':'Отметка N/A снята',
'lg.t.gen':'Пакет сформирован: {n} док.','lg.log.issued':'Пакет выпущен на подпись ({n} док.)','lg.t.issued':'Выпущено на подпись: {n} док. Текст зафиксирован, хэш SHA-256 сохранён.','lg.t.remind':'Напоминание отправлено на {e} (копия менеджеру OTA)',
'lg.dec.cmt':'Почему вы не согласны?','lg.dec.send':'Отправить отказ','lg.arch.q':'Перенести {n} в архив? Документ останется доступным и не изменится.','lg.t.arch':'{n} перенесён в архив',
'lg.otp.title':'Подтверждение подписи','lg.otp.d':'Мы отправили 6-значный код на {e}. Одна подпись на {n} док.','lg.otp.lbl':'Код из письма','lg.otp.legal':'Подпись на портале с одноразовым кодом и журналом аудита является электронной подписью (п. 2.5 Рамочного соглашения).','lg.otp.resend':'Отправить ещё раз','lg.otp.go':'Подписать ({n})','lg.otp.toast':'Код отправлен на {e}: {c}',
'lg.t.ack':'Ознакомление с {n} подтверждено','lg.t.ofIssued':'Новая версия {n} выпущена на подпись','lg.t.tplSaved':'Черновик версии сохранён','lg.t.released':'Версия {v} выпущена: {n} док.','lg.t.pub':'Опубликовано {n}','lg.t.notified':'Отмечено: партнёр уведомлён','lg.t.csv':'Экспортировано {n} записей','lg.t.cmt':'Комментарий отправлен OTA',
'lg.na.reasonReq':'Укажите причину','lg.t.na':'«{f}» — не применимо','lg.log.code':'Код партнёра {c} утверждён','lg.t.code':'Код {c} утверждён','lg.chg.none':'Вы ничего не изменили','lg.t.chgSent':'Запрос отправлен OTA','lg.dec.req':'Напишите комментарий','lg.t.decl':'Отказ отправлен менеджеру OTA',
'lg.otp.bad':'Неверный код. Проверьте письмо и попробуйте ещё раз.','lg.log.signedO':'OTA подписала {n} док.','lg.log.signedP':'Партнёр подписал {n} док.','lg.t.signed':'Подписано {n} док. · ID {id}','lg.t.file':'Файл {f} добавлен','lg.t.scan':'Скан {f} получен','lg.t.kep':'Экземпляр с КЭП {f} добавлен',
'lg.h.P_FORM_EN':'Напр.: a private limited company incorporated in England and Wales','lg.h.P_TITLE_L2_GEN':'Для «в лице …», напр.: директора','lg.h.P_TAXNO':'Если номера нет — оставьте комментарий','lg.h.P_DOMAIN':'Напр.: connect.brand.com','lg.h.P_TM_LIST':'Знак, № регистрации и ведомство, страны, классы МКТУ','lg.h.DEVICES':'Партнёр заполняет, OTA одобряет. В Приложение 1 попадают только одобренные модели.','lg.h.P_BANK_INTERMEDIARY':'Если банка-посредника нет — комментарий для OTA','lg.h.P_AUTHORITY_FILE':'Доверенность (PDF)',
'lg.f.P_NAME':'Полное наименование компании','lg.f.P_FORM_EN':'Форма и страна учреждения (англ.)','lg.f.P_FORM_L2':'Форма и страна учреждения (2-й язык)','lg.f.P_COUNTRY':'Страна регистрации','lg.f.P_REGNO':'Регистрационный номер','lg.f.P_TAXNO':'Налоговый / VAT-номер','lg.f.P_ADDR_EN':'Юридический адрес (англ.)','lg.f.P_ADDR_L2':'Юридический адрес (2-й язык)',
'lg.f.P_SIGNATORY':'ФИО подписанта (латиницей)','lg.f.P_TITLE_EN':'Должность (англ.)','lg.f.P_TITLE_L2':'Должность (2-й язык)','lg.f.P_TITLE_L2_GEN':'Должность, родительный падеж','lg.f.P_AUTHORITY':'Основание полномочий','lg.f.P_AUTHORITY_FILE':'Файл доверенности','lg.f.LANG2':'Второй язык документов',
'lg.f.P_BRAND':'Бренд','lg.f.P_PROGRAMME':'Название программы («БРЕНД CONNECT»)','lg.f.P_TM_OWNER_IS_PARTNER':'Принадлежат ли знаки вашей компании?','lg.f.P_TM_LIST':'Регистрации знаков','lg.f.P_BRAND_CONTACT':'Контакт для согласования материалов','lg.f.P_BRAND_RULES':'Правила логотипа, цвета, шрифты',
'lg.f.P_TM_OWNER_NAME':'Правообладатель: наименование','lg.f.P_TM_OWNER_COUNTRY_EN':'Страна учреждения (англ.)','lg.f.P_TM_OWNER_COUNTRY_L2':'Страна учреждения (2-й язык)','lg.f.P_TM_OWNER_REGNO':'Регистрационный номер','lg.f.P_TM_OWNER_ADDR':'Адрес','lg.f.P_TM_OWNER_RELATION_EN':'Ваш статус у правообладателя (англ.)','lg.f.P_TM_OWNER_RELATION_L2':'Ваш статус (2-й язык)','lg.f.P_TM_OWNER_TERRITORY_EN':'Страны разрешения (англ.)','lg.f.P_TM_OWNER_TERRITORY_L2':'Страны разрешения (2-й язык)','lg.f.P_TM_OWNER_SIGNATORY':'Подписант правообладателя','lg.f.P_TM_OWNER_TITLE':'Должность подписанта',
'lg.f.P_DOMAIN':'Домен портала','lg.f.P_DNS_CONTACT':'Технический контакт по DNS','lg.f.P_LOGO':'Логотип (файл и версия)','lg.f.P_BRANDBOOK':'Брендбук','lg.f.P_EMAIL_OPS':'E-mail для операций','lg.f.P_EMAIL_LEGAL':'E-mail для юридических уведомлений','lg.f.P_EMAIL_FIN':'E-mail финансов','lg.f.P_EMAIL_SUPPORT':'E-mail поддержки пользователей','lg.f.P_PHONE':'Телефон',
'lg.f.P_BANK_BENEFICIARY':'Получатель','lg.f.P_BANK_IBAN':'Счёт / IBAN (USD)','lg.f.P_BANK_NAME':'Банк','lg.f.P_BANK_ADDR':'Адрес банка','lg.f.P_BANK_SWIFT':'SWIFT','lg.f.P_BANK_INTERMEDIARY':'Банк-посредник (SWIFT)',
'lg.f.TM_MARK':'Знак','lg.f.TM_REGNO':'№ и ведомство','lg.f.TM_COUNTRIES':'Страны','lg.f.TM_CLASSES':'Классы','lg.f.DEV_BRAND':'Бренд','lg.f.DEV_MODEL':'Модель','lg.f.DEV_HW':'Ревизия','lg.f.DEV_FW':'Прошивка','lg.f.DEV_PLAN':'Тариф','lg.f.DEV_MB':'МБ/мес.','lg.f.DEV_SIM':'Тип SIM','lg.f.DEVICES':'Приложение 1: устройства',
'lg.f.LAUNCH_DATE':'Дата запуска','lg.f.RETAIL_CUR':'Валюта розницы','lg.f.DELIVERY_ADDR':'Адрес доставки SIM','lg.f.IMPORTER':'Импортёр','lg.f.INIT_SIMS':'Первая отгрузка SIM, шт.','lg.f.INIT_KEYS':'Первый заказ ключей','lg.f.INIT_TOKENS':'Первый заказ токенов','lg.f.ANNUAL_TARGET':'Годовая цель (активированные устройства)','lg.f.OF_EXCEPTIONS_EN':'Исключения из п. 5.6 (англ.)','lg.f.OF_EXCEPTIONS_L2':'Исключения из п. 5.6 (2-й язык)',
'lg.f.CC_NAME_L2':'Страна (2-й язык)','lg.f.CC_NAME_FULL_EN':'Официальное название страны (англ.)','lg.f.CC_NAME_FULL_L2':'Официальное название (2-й язык)','lg.f.CC_NAME_LOC_L2':'Страна, предложный падеж','lg.f.CC_EXCLUSION_EN':'Исключённые территории (англ.)','lg.f.CC_EXCLUSION_L2':'Исключённые территории (2-й язык)','lg.f.EUT_LANGS':'07: языки публикации','lg.f.EUT_CONSUMER_AUTH':'07: орган по защите прав потребителей','lg.f.EUT_DP_AUTH':'07: орган по защите данных','lg.f.EUT_WITHDRAWAL':'07: правила отказа и возврата','lg.f.EUT_OTHER':'07: иная обязательная информация'}});
/*@@END@@*/

function lg_actLabel(a){const k='lg.act.'+a;const v=t(k);return v&&v!==k?v:a;}
I18N.add({"uk": {"lg.act.doc.sign.partner": "Підписано партнером", "lg.act.doc.sign.ota": "Підписано OTA", "lg.act.doc.issue": "Випущено на підпис", "lg.act.doc.view": "Переглянуто", "lg.act.doc.download": "Завантажено PDF", "lg.act.doc.otp.sent": "Надіслано код підтвердження", "lg.act.doc.otp.fail": "Невірний код", "lg.act.doc.ack": "Ознайомлено", "lg.act.doc.archive": "Архівовано", "lg.act.doc.auto_effective": "Набрав чинності автоматично", "lg.act.doc.superseded": "Замінено новою версією", "lg.act.doc.decline": "Відмова від змін", "lg.act.doc.decline.handled": "Відмову опрацьовано", "lg.act.doc.kep.upload": "Додано примірник з КЕП", "lg.act.doc.boa.upload": "Завантажено лист правовласника", "lg.act.doc.reminder": "Нагадування", "lg.act.doc.withdraw": "Відкликано", "lg.act.pkg.generate": "Пакет сформовано", "lg.act.form.edit": "Змінено поле анкети", "lg.act.form.na": "Позначено «не застосовно»", "lg.act.form.na.clear": "Знято «не застосовно»", "lg.act.form.submit": "Анкету надіслано", "lg.act.form.comment": "Коментар до поля", "lg.act.form.file": "Завантажено файл", "lg.act.review.approve": "Перевірку OTA пройдено", "lg.act.kyc.check": "Перевірка KYC", "lg.act.change.release": "Випущено зміну", "lg.act.tpl.version": "Нова версія шаблону", "lg.act.invoice.issue": "Рахунок виставлено", "lg.act.invoice.paid": "Рахунок оплачено", "lg.act.keys.issue": "Ключі видано", "lg.act.tokens.issue": "Токени видано", "lg.act.order.place": "Замовлення оформлено", "lg.act.activation": "Активація", "lg.act.statement.confirm": "Акт звірки підтверджено", "lg.act.statement.dispute": "Рядок акта оскаржено", "lg.act.user.switch": "Зміна ролі (демо)", "lg.act.audit.export": "Експорт журналу", "lg.act.partner.signup": "Реєстрація партнера"}, "en": {"lg.act.doc.sign.partner": "Signed by partner", "lg.act.doc.sign.ota": "Signed by OTA", "lg.act.doc.issue": "Issued for signature", "lg.act.doc.view": "Viewed", "lg.act.doc.download": "PDF downloaded", "lg.act.doc.otp.sent": "Confirmation code sent", "lg.act.doc.otp.fail": "Wrong code", "lg.act.doc.ack": "Acknowledged", "lg.act.doc.archive": "Archived", "lg.act.doc.auto_effective": "Took effect automatically", "lg.act.doc.superseded": "Superseded", "lg.act.doc.decline": "Change declined", "lg.act.doc.decline.handled": "Decline handled", "lg.act.doc.kep.upload": "Qualified e-signature copy added", "lg.act.doc.boa.upload": "Brand owner letter uploaded", "lg.act.doc.reminder": "Reminder", "lg.act.doc.withdraw": "Withdrawn", "lg.act.pkg.generate": "Package generated", "lg.act.form.edit": "Questionnaire field edited", "lg.act.form.na": "Marked N/A", "lg.act.form.na.clear": "N/A cleared", "lg.act.form.submit": "Questionnaire submitted", "lg.act.form.comment": "Field comment", "lg.act.form.file": "File uploaded", "lg.act.review.approve": "OTA review approved", "lg.act.kyc.check": "KYC check", "lg.act.change.release": "Change released", "lg.act.tpl.version": "New template version", "lg.act.invoice.issue": "Invoice issued", "lg.act.invoice.paid": "Invoice paid", "lg.act.keys.issue": "Keys issued", "lg.act.tokens.issue": "Tokens issued", "lg.act.order.place": "Order placed", "lg.act.activation": "Activation", "lg.act.statement.confirm": "Statement confirmed", "lg.act.statement.dispute": "Statement line disputed", "lg.act.user.switch": "Role switch (demo)", "lg.act.audit.export": "Audit export", "lg.act.partner.signup": "Partner signup"}, "ru": {"lg.act.doc.sign.partner": "Подписано партнёром", "lg.act.doc.sign.ota": "Подписано OTA", "lg.act.doc.issue": "Выпущено на подпись", "lg.act.doc.view": "Просмотрено", "lg.act.doc.download": "Скачан PDF", "lg.act.doc.otp.sent": "Отправлен код подтверждения", "lg.act.doc.otp.fail": "Неверный код", "lg.act.doc.ack": "Ознакомлен", "lg.act.doc.archive": "Архивировано", "lg.act.doc.auto_effective": "Вступил в силу автоматически", "lg.act.doc.superseded": "Заменён новой версией", "lg.act.doc.decline": "Отказ от изменений", "lg.act.doc.decline.handled": "Отказ обработан", "lg.act.doc.kep.upload": "Добавлен экземпляр с КЭП", "lg.act.doc.boa.upload": "Загружено письмо правообладателя", "lg.act.doc.reminder": "Напоминание", "lg.act.doc.withdraw": "Отозвано", "lg.act.pkg.generate": "Пакет сформирован", "lg.act.form.edit": "Изменено поле анкеты", "lg.act.form.na": "Отмечено «не применимо»", "lg.act.form.na.clear": "Снято «не применимо»", "lg.act.form.submit": "Анкета отправлена", "lg.act.form.comment": "Комментарий к полю", "lg.act.form.file": "Загружен файл", "lg.act.review.approve": "Проверка OTA пройдена", "lg.act.kyc.check": "Проверка KYC", "lg.act.change.release": "Выпущено изменение", "lg.act.tpl.version": "Новая версия шаблона", "lg.act.invoice.issue": "Счёт выставлен", "lg.act.invoice.paid": "Счёт оплачен", "lg.act.keys.issue": "Ключи выданы", "lg.act.tokens.issue": "Токены выданы", "lg.act.order.place": "Заказ оформлен", "lg.act.activation": "Активация", "lg.act.statement.confirm": "Акт сверки подтверждён", "lg.act.statement.dispute": "Строка акта оспорена", "lg.act.user.switch": "Смена роли (демо)", "lg.act.audit.export": "Экспорт журнала", "lg.act.partner.signup": "Регистрация партнёра"}});
