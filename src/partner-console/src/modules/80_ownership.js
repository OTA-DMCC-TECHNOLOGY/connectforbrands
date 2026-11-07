/* ===== 80_ownership: SIM binding, transfer & ownership requests — partner side (ТЗ v10 part 4) =====
   Prefix own_. Source of truth for Binding / Transfer / OwnershipRequest / activation-code status is the demo bridge
   localStorage['cfb-demo-ownership'] shared with the customer portal (same origin). The partner console never edits a
   binding directly: only approved ownership requests (OTA support mode) and OTA freeze / unfreeze change bindings.
   S.own mirrors this partner's records ({bindings, transfers, requests, codes:{blocked}, feed}) plus partner-only state
   (users = Dealer / Installer accounts, ret = retention runs, hook = webhook settings).
   Visibility (4.8) is built in ONE place — own_view(sim, role) — and reused by the UI, the simulated API, the ICCID
   export and the webhook preview, so location / events can never reach a partner role (criterion 18). */
const OWN_KEY='cfb-demo-ownership';
const OWN_PER=50;
const OWN_LINK_H=72;                 // customer link / transfer acceptance window, hours (4.3 p.7, 4.5 p.2)
const OWN_RET_DAYS=30;               // previous owner's history: hide at once, erase within 30 days (4.10)
const OWN_ONLINE_MIN=120;            // "online" = seen in the last 2 h (demo)
const OWN_LIMITED=['p_dealer','p_installer'];
const OWN_REASONS=['error','unauthorised','previous_owner_unreachable'];
const OWN_CONTACT_ROLES=['p_admin','p_ops','p_sign'];

/* ---------- roles: Dealer and Installer are partner-console users (4.8) ---------- */
ROLES.p_dealer=ROLES.p_dealer||{side:'partner',perms:['own.view','own.request']};
ROLES.p_installer=ROLES.p_installer||{side:'partner',perms:['own.view','own.check']};
function own_users(){if(typeof S==='undefined'||!S||!S.org)return [];return own_st().users;}
HOOKS.users.push(()=>own_users());   // Dealer / Installer appear in users() and the demo user switcher

/* ---------- state ---------- */
function own_defaultUsers(){const ts=iso(now());return[
 {id:'u_p_dealer',name:'Oleh Bondar',email:'oleh.bondar@energy-lviv.example',phone:'+380 67 555 01 01',role:'p_dealer',active:true,createdAt:ts},
 {id:'u_p_installer',name:'Ivan Koval',email:'ivan.koval@solarmontazh.example',phone:'+380 67 555 01 02',role:'p_installer',active:true,createdAt:ts}];}
function own_st(){if(!S.own||typeof S.own!=='object')S.own={};const o=S.own;
 ['bindings','transfers','requests','feed'].forEach(k=>{if(!Array.isArray(o[k]))o[k]=[];});
 if(!o.codes||typeof o.codes!=='object')o.codes={blocked:[]};if(!Array.isArray(o.codes.blocked))o.codes.blocked=[];
 if(!Array.isArray(o.users))o.users=own_defaultUsers();if(!o.ret)o.ret={runs:[],lastDay:null};if(!o.hook)o.hook={url:'https://partner.example/hooks/connect',profile:'full'};return o;}
function own_pc(){return (S.org&&S.org.code)||'ARV';}
function own_id(p){return p+'_'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);}
function own_day(d){return iso(d).slice(0,10);}
function own_tl(lang,k,v){let s=(I18N.d[lang]&&I18N.d[lang][k])||I18N.d.en[k]||k;if(v)for(const a in v)s=s.split('{'+a+'}').join(v[a]);return s;}
function own_T9vars(x){return{'name or contact':x,'имя или контакт':x,'ім’я або контакт':x};}

/* ---------- role helpers ---------- */
function own_role(){const a=actor();return a?a.role:'';}
function own_side(r){const R=ROLES[r||own_role()];return R?R.side:'partner';}
function own_isSupport(){return !!S.admin&&own_side()==='ota';}
function own_limited(r){return OWN_LIMITED.includes(r||own_role());}
function own_me(){return actor()||{};}
function own_userActive(u){u=u||own_me();const x=own_st().users.find(q=>q.id===u.id);return !x||x.active!==false;}
// what a role may SEE (4.8). Location / events / history: never, for any partner role.
function own_canSee(what,role){role=role||own_role();const ota=own_side(role)==='ota';
 switch(what){case 'contacts':case 'feed':case 'history':return ota||OWN_CONTACT_ROLES.includes(role);
  case 'plan':return role!=='p_installer';case 'location':return false;}return false;}
// what the acting user may DO
function own_canDo(act){const r=own_role();if(!own_userActive())return false;
 switch(act){case 'request':return ['p_admin','p_ops','p_dealer'].includes(r);
  case 'export':return ['p_admin','p_ops'].includes(r);
  case 'check':return own_side(r)==='partner'||own_isSupport();
  case 'bindstart':return ['p_admin','p_ops','p_dealer','p_installer'].includes(r);
  case 'block':return ['p_admin','p_ops'].includes(r);
  case 'users':return r==='p_admin'||own_isSupport();
  case 'integr':return ['p_admin','p_ops'].includes(r)||own_isSupport();
  case 'support':return own_isSupport();}return false;}
function own_inScope(s,role,uid){role=role||own_role();uid=uid||own_me().id;
 if(role==='p_dealer')return s.sold_by_user_id===uid;if(role==='p_installer')return s.installed_by_user_id===uid;return true;}
function own_allowedRoutes(){if(!own_userActive())return [];const r=own_role();
 if(r==='p_dealer')return ['own','own-check','own-req'];if(r==='p_installer')return ['own','own-check'];return null;}
function own_userName(id){const u=users().find(x=>x.id===id);return u?u.name:'';}

/* ---------- SIM lookups ---------- */
let own__si=null,own__siN=-1,own__siS=null;
function own_sim(iccid){if(!own__si||own__siN!==S.sims.length||own__siS!==S.sims){own__si=new Map();S.sims.forEach(s=>own__si.set(s.iccid,s));own__siN=S.sims.length;own__siS=S.sims;}return own__si.get(iccid)||null;}
function own_simCc(s){const h=s&&s.shipmentId&&(S.shipments||[]).find(x=>x.id===s.shipmentId);return (h&&h.cc)||primaryCc();}
function own_ctyCfg(cc){const o=S.ota||{};return (o.countries&&o.countries[cc])||(S.otaCountries&&S.otaCountries[cc])||{};}
function own_delay(cc){const v=+own_ctyCfg(cc).delay_hours;return v>=1&&v<=24?Math.round(v):24;}   // 1–24, default 24 (4.5 p.3)
function own_online(s){return !!s&&s.status==='active'&&!!s.lastSeen&&(now()-new Date(s.lastSeen))<OWN_ONLINE_MIN*60000;}
function own_mname(x){if(!x)return null;const m=x.model.name,b=x.brand.name;return m.toLowerCase().startsWith(b.toLowerCase())?m:b+' '+m;}
function own_modelMap(){const m={};allModels().forEach(x=>{m[x.model.id]=x;});return m;}
function own_normIccid(v){return digits(v);}
function own_normContact(v){v=String(v||'').trim();if(!v)return '';if(v.includes('@'))return 'e:'+v.toLowerCase();const d=digits(v);return d.length>=9?'p:'+d.slice(-9):'';}
function own_validContact(v){v=String(v||'').trim();if(v.includes('@'))return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);const d=digits(v);return d.length>=9&&d.length<=15&&/^[+\d\s()-]+$/.test(v);}

/* ---------- bridge I/O ---------- */
let own__b=null;
function own_bRead(){try{const b=JSON.parse(localStorage.getItem(OWN_KEY));return b&&typeof b==='object'&&b.sims?b:null;}catch(e){return null;}}
function own_bNorm(b){['bindings','transfers','events','requests','bindLinks','partnerContacts','t12Exempt','history','notices','seeded_partners'].forEach(k=>{if(!Array.isArray(b[k]))b[k]=[];});
 ['sims','codes','accounts'].forEach(k=>{if(!b[k]||typeof b[k]!=='object')b[k]={};});return b;}
function own_bWrite(b){b.v=1;b.rev=(b.rev||0)+1;b.updated_at=iso(now());b.updated_by='partner-console';try{localStorage.setItem(OWN_KEY,JSON.stringify(b));}catch(e){console.warn('ownership bridge',e);}own__b=b;own_mirror(b);}
// read-modify-write on a fresh copy (the customer portal may have written in between)
function own_tx(fn){const b=own_bNorm(own_bRead()||{sims:{}});const r=fn(b);own_process(b);own_bWrite(b);return r;}
function own_b(){if(!own__b)own_sync();return own__b||own_bNorm({sims:{}});}
function own_event(b,type,d){b.events.push(Object.assign({id:own_id('ev'),type,partner_id:own_pc(),at:iso(now()),src:'partner-console'},d||{}));if(b.events.length>500)b.events=b.events.slice(-500);}
function own_simRec(s){const x=s.modelId&&findModel(s.modelId);return{partner:own_pc(),status:'issued',imei:s.imei||null,model:own_mname(x),cc:own_simCc(s)};}
function own_activeB(b,iccid){return b.bindings.find(x=>x.iccid===iccid&&(x.status==='active'||x.status==='frozen'))||null;}
function own_openTr(b,bid){return b.transfers.find(x=>x.binding_id===bid&&(x.status==='pending_acceptance'||x.status==='cooling_off'))||null;}
function own_acc(b,id){return (id&&b.accounts[id])||null;}
function own_accByContact(b,c){const n=own_normContact(c);if(!n)return null;return Object.keys(b.accounts).find(k=>{const a=b.accounts[k];return own_normContact(a.email)===n||own_normContact(a.phone)===n;})||null;}
function own_mkAcc(b,o){const id=own_id('acc');const c=String(o.contact||'');b.accounts[id]={name:o.name||null,email:c.includes('@')?c:(o.email||null),phone:c.includes('@')?(o.phone||null):(c||o.phone||null),created_at:iso(now()),src:'partner-console'};return id;}
function own_ownerLabel(b,id){const a=own_acc(b,id);return a&&a.name?a.name:(id?t('own.anonOwner'):'—');}

/* ---------- demo seed (bridge + Dealer/Installer scopes) ---------- */
function own_seedScopes(){if(S.sims.some(s=>s.sold_by_user_id||s.installed_by_user_id))return;
 S.sims.forEach((s,idx)=>{if(s.status==='stock')return;
  if(idx%6===1||[1,3,7].includes(idx))s.sold_by_user_id='u_p_dealer';
  if((s.reseller==='r1'&&idx%5===4)||[1,4,6].includes(idx))s.installed_by_user_id='u_p_installer';});}
function own_seedInto(b){const P=own_pc();own_seedScopes();const n=now();const ago=h=>iso(new Date(n.getTime()-h*3600e3));
 // remove this partner's previous demo records (other partners and customer accounts stay)
 Object.keys(b.sims).forEach(k=>{if(b.sims[k].partner===P)delete b.sims[k];});
 Object.keys(b.codes).forEach(k=>{if(b.codes[k].partner===P)delete b.codes[k];});
 const mine=new Set(b.bindings.filter(x=>x.partner_id===P).map(x=>x.id));
 b.bindings=b.bindings.filter(x=>x.partner_id!==P);b.transfers=b.transfers.filter(x=>!mine.has(x.binding_id));
 ['requests','history','bindLinks','events','notices'].forEach(k=>{b[k]=b[k].filter(x=>x.partner_id!==P);});
 S.sims.forEach(s=>{b.sims[s.iccid]=own_simRec(s);});
 const last=S.sims[S.sims.length-1];if(last&&last.status==='stock')Object.assign(b.sims[last.iccid],{status:'deactivated',deactivated_reason:'lost'});
 // activation codes: issued → new, activated → redeemed (pinned to the device), void → blocked
 const imeiOf=ic=>{const s=ic&&own_sim(ic);return s?s.imei:null;};
 (S.codes||[]).forEach(c=>{const pc=parseCode(c.code);b.codes[c.code]={partner:P,serial:pc.serial||'',plan:c.plan,term:c.term,status:c.status==='activated'?'redeemed':c.status==='void'?'blocked':'new',
  device_id:c.status==='activated'?imeiOf(c.iccid):null,redeemed_at:c.activatedAt||null,blocked_at:c.status==='void'?(c.voidAt||ago(120)):null};});
 const st=own_st();const blk=(S.codes||[]).find(c=>c.reseller==='r1'&&c.status==='issued');
 if(blk){blk.status='void';blk.voidAt=ago(30);blk.blockedAt=blk.voidAt;Object.assign(b.codes[blk.code],{status:'blocked',blocked_at:blk.voidAt,blocked_reason:'lost'});
  st.codes.blocked=[{code:blk.code,serial:parseCode(blk.code).serial,plan:blk.plan,term:blk.term,reseller:blk.reseller,at:blk.voidAt,by:(S.user&&S.user.name)||'Partner Admin',reason:'lost',mode:'serial'}];}
 // customer accounts + bindings for every SIM the customer already linked
 const names=['Olena Shevchenko','Petro Ivanenko','Iryna Bondarenko','Serhii Tkachenko','Nataliia Kravets','Andrii Moroz','Oksana Lysenko','Dmytro Savchenko','Yuliia Rudenko','Maksym Polishchuk','Tetiana Hnatiuk','Vasyl Kovalenko','Halyna Melnyk','Roman Shevchuk'];
 let an=0;const mkAcc=nm=>{an++;const id='acc_'+P.toLowerCase()+'_'+pad(an,4);const sl=nm.toLowerCase().replace(/[^a-z]+/g,'.');b.accounts[id]={name:nm,email:sl+an+'@mail.example',phone:'+380 50 '+pad(100+an%900,3)+' '+pad(an%100,2)+' '+pad((an*7)%100,2),created_at:ago(24*40),src:'demo'};return id;};
 const mkB=(s,acc,at,method)=>{const bd={id:'bd_'+P.toLowerCase()+'_'+s.iccid.slice(-6)+'_'+(b.bindings.length+1),iccid:s.iccid,device_id:s.imei||null,owner_account_id:acc,partner_id:P,method,bound_at:at,unbound_at:null,unbind_reason:null,status:'active'};b.bindings.push(bd);return bd;};
 const days=at=>Math.max(1,(new Date(at)-0)/864e5);
 S.sims.forEach((s,idx)=>{if(!s.linked)return;const ev=(s.events||[]).find(e=>e[1]==='linked');const at=ev?ev[0]:ago(24*20);const acc=mkAcc(names[an%names.length]);
  if(idx===4||idx===6){ // transferred to a new owner earlier: 29 days ago (history due for erasure) / 10 days ago (legal hold)
   const tAt=idx===4?ago(24*29+4):ago(24*10);const old=mkB(s,acc,at,'iccid');old.status='ended';old.unbound_at=tAt;old.unbind_reason='transfer';
   const acc2=mkAcc(names[an%names.length]);const nb=mkB(s,acc2,tAt,'transfer');nb.prev_binding_id=old.id;
   b.transfers.push({id:'tr_'+old.id,binding_id:old.id,from_account_id:acc,to_contact:b.accounts[acc2].email,to_account_id:acc2,status:'effective',initiated_at:iso(new Date(new Date(tAt)-30*3600e3)),accepted_at:iso(new Date(new Date(tAt)-24*3600e3)),effective_at:tAt,cancelled_at:null,cancelled_by:null,delay_hours:24});
   const d0=(new Date(tAt)-new Date(at))/864e5;
   b.history.push({id:'hs_'+old.id,partner_id:P,iccid:s.iccid,binding_id:old.id,owner_account_id:acc,from:at,to:tAt,points:Math.round(d0*48),events:Math.round(d0*3),state:'hidden',hidden_at:tAt,erase_due:iso(addDays(tAt,OWN_RET_DAYS)),erased_at:null,
    legal_hold:idx===6,hold_reason:idx===6?'incident':''});
  }else mkB(s,acc,at,'iccid');});
 // pending transfer (awaiting the new owner's acceptance)
 const s3=S.sims[3];const b3=s3&&own_activeB(b,s3.iccid);
 if(b3)b.transfers.push({id:'tr_'+b3.id,binding_id:b3.id,from_account_id:b3.owner_account_id,to_contact:'new.owner@example.com',to_account_id:null,status:'pending_acceptance',initiated_at:ago(5),accepted_at:null,effective_at:null,cancelled_at:null,cancelled_by:null,delay_hours:own_delay(own_simCc(s3))});
 // ownership request awaiting OTA support (submitted by the dealer)
 const s7=S.sims[7];const b7=s7&&own_activeB(b,s7.iccid);
 if(b7){const q={id:'or_'+P.toLowerCase()+'_1',no:'OR-'+P+'-0001',partner_id:P,iccid:s7.iccid,binding_id:b7.id,owner_account_id:b7.owner_account_id,requester_contact:'+380 67 700 12 34',reason:'previous_owner_unreachable',action:'transfer',
  files:[{name:'receipt_2026-10-12.pdf',size:184320,type:'application/pdf',uploaded_at:ago(26),by:'Oleh Bondar'}],doc_checked:true,status:'submitted',submitted_by:'Oleh Bondar',submitted_by_id:'u_p_dealer',submitted_role:'p_dealer',submitted_at:ago(26),log:[[ago(26),'submitted','Oleh Bondar','']]};
  b.requests.push(q);seqNext(P+':OR');}
 if(!b.seeded_partners.includes(P))b.seeded_partners.push(P);
 own_event(b,'partner.seeded',{});}
function own_seedBridge(){const b=own_bNorm(own_bRead()||{sims:{}});own_seedInto(b);own_process(b);own_bWrite(b);}
HOOKS.seedDemo.push(()=>{own__b=null;S.own=undefined;own_st();own_seedBridge();});

/* ---------- partner contacts for the self-binding ban (T12, 4.9 p.3) ---------- */
function own_partnerContacts(){const P=own_pc();const out=[];const seen=new Set();
 const add=(u,v)=>{const n=own_normContact(v);if(!n||seen.has(n))return;seen.add(n);out.push({partner:P,user_id:u.id,role:u.role,contact:n});};
 users().forEach(u=>{if(own_side(u.role)!=='partner')return;add(u,u.email);add(u,u.phone);});
 if(S.user)add({id:'u_p_admin',role:'p_admin'},S.user.email);return out;}
function own_t12Blocked(b,contact){const n=own_normContact(contact);if(!n)return false;if(b.t12Exempt.some(x=>x.contact===n&&!x.revoked_at))return false;return b.partnerContacts.some(x=>x.contact===n);}

/* ---------- state machine (runs on every sync; the customer portal runs the same rules) ---------- */
function own_hide(b,old,at){let h=b.history.find(x=>x.binding_id===old.id);
 if(!h){const d0=Math.max(0,(new Date(old.unbound_at||at)-new Date(old.bound_at))/864e5);h={id:'hs_'+old.id,partner_id:old.partner_id,iccid:old.iccid,binding_id:old.id,owner_account_id:old.owner_account_id,from:old.bound_at,to:old.unbound_at||at,points:Math.round(d0*48),events:Math.round(d0*3),state:'visible',erased_at:null,legal_hold:false,hold_reason:''};b.history.push(h);}
 if(h.state==='visible'){h.state='hidden';h.hidden_at=old.unbound_at||at;h.erase_due=iso(addDays(h.hidden_at,OWN_RET_DAYS));return true;}return false;}
function own_endBinding(b,bd,reason,at){bd.status='ended';bd.unbound_at=at;bd.unbind_reason=reason;own_hide(b,bd,at);}
function own_newBinding(b,old,acc,method,at){if(own_activeB(b,old.iccid))return null;   // one active binding per ICCID
 const nb={id:own_id('bd'),iccid:old.iccid,device_id:old.device_id,owner_account_id:acc,partner_id:old.partner_id,method,bound_at:at,unbound_at:null,unbind_reason:null,status:'active',prev_binding_id:old.id};b.bindings.push(nb);return nb;}
function own_execTransfer(b,tr,at){const old=b.bindings.find(x=>x.id===tr.binding_id);if(!old||old.status!=='active'){tr.status='cancelled';tr.cancelled_at=at;tr.cancelled_by='system';return;}
 const to=tr.to_account_id||own_accByContact(b,tr.to_contact)||own_mkAcc(b,{contact:tr.to_contact});
 own_endBinding(b,old,'transfer',at);const nb=own_newBinding(b,old,to,'transfer',at);
 tr.status='effective';tr.effective_at=at;tr.to_account_id=to;
 own_event(b,'transfer.effective',{iccid:old.iccid,imei:old.device_id,binding_id:nb&&nb.id,transfer_id:tr.id});audit('ownership.transfer.effective',old.iccid,{transfer:tr.id});}
function own_execRequest(b,q,at){const bd=b.bindings.find(x=>x.id===q.binding_id);q.executed_at=at;q.closed_at=at;
 if(!bd||bd.status!=='active'){q.status='cancelled';q.log.push([at,'cancelled','system','binding not active']);return;}
 own_endBinding(b,bd,'support_reset',at);let nb=null;
 if(q.action==='transfer'){const acc=own_accByContact(b,q.requester_contact)||own_mkAcc(b,{contact:q.requester_contact});nb=own_newBinding(b,bd,acc,'support_reset',at);q.new_binding_id=nb&&nb.id;}
 q.status='done';q.log.push([at,q.action==='transfer'?'executed_transfer':'executed_unbind','system','']);
 own_event(b,q.action==='transfer'?'binding.support_transfer':'binding.support_reset',{iccid:bd.iccid,imei:bd.device_id,request_id:q.id,binding_id:nb?nb.id:bd.id});
 audit('ownership.request.executed',bd.iccid,{request:q.no,action:q.action,unbind_reason:'support_reset'});}
function own_process(b){const P=own_pc();const at=iso(now());let ch=false;
 b.bindLinks.forEach(l=>{if(l.partner_id===P&&l.status==='pending'&&at>=l.expires_at){l.status='expired';ch=true;}});
 const mine=new Set(b.bindings.filter(x=>x.partner_id===P).map(x=>x.id));
 b.transfers.forEach(tr=>{if(!mine.has(tr.binding_id))return;
  if(tr.status==='pending_acceptance'&&at>=iso(new Date(new Date(tr.initiated_at).getTime()+OWN_LINK_H*3600e3))){tr.status='expired';ch=true;}
  else if(tr.status==='cooling_off'&&tr.accepted_at&&at>=iso(new Date(new Date(tr.accepted_at).getTime()+clamp(tr.delay_hours||24,1,24)*3600e3))){own_execTransfer(b,tr,at);ch=true;}});
 b.requests.forEach(q=>{if(q.partner_id!==P)return;
  if(q.status==='cooling_off'&&q.objected_at){own_dispute(b,q,q.objected_at,'owner');ch=true;}
  else if(q.status==='cooling_off'&&at>=q.object_deadline){own_execRequest(b,q,at);ch=true;}});
 b.bindings.forEach(bd=>{if(bd.partner_id===P&&bd.status==='ended'&&own_hide(b,bd,at))ch=true;});
 return ch;}
function own_dispute(b,q,at,by){q.status='disputed';q.objected_at=q.objected_at||at;q.log.push([at,'objected',by==='owner'?'owner':by,'']);
 const bd=b.bindings.find(x=>x.id===q.binding_id);if(bd&&bd.status==='active'){bd.status='frozen';bd.frozen_at=at;bd.frozen_reason='ownership_dispute';bd.frozen_by='system';}
 own_event(b,'binding.frozen',{iccid:q.iccid,request_id:q.id});audit('ownership.request.objected',q.iccid,{request:q.no,binding:'frozen'});}

/* ---------- sync bridge ⇄ partner console ---------- */
function own_sync(){if(!S||!S.authed||!S.org||!Array.isArray(S.sims))return null;const P=own_pc();own_st();
 let b=own_bRead();let dirty=false;if(!b){b={sims:{}};dirty=true;}own_bNorm(b);
 if(!b.seeded_partners.includes(P)){
  if(S.own.seededAt&&S.own.bindings.length){ // bridge lost: restore this partner's records from the mirror
   S.sims.forEach(s=>{b.sims[s.iccid]=own_simRec(s);});b.bindings=b.bindings.concat(S.own.bindings);b.transfers=b.transfers.concat(S.own.transfers);b.requests=b.requests.concat(S.own.requests);b.seeded_partners.push(P);}
  else own_seedInto(b);dirty=true;}
 for(const s of S.sims){const r=b.sims[s.iccid];if(!r){b.sims[s.iccid]=own_simRec(s);dirty=true;}else if(r.partner===P&&(s.imei||null)!==r.imei){r.imei=s.imei||null;dirty=true;}}
 for(const c of S.codes||[]){const r=b.codes[c.code];if(!r){b.codes[c.code]={partner:P,serial:parseCode(c.code).serial||'',plan:c.plan,term:c.term,status:c.status==='void'?'blocked':c.status==='activated'?'redeemed':'new',device_id:null,redeemed_at:c.activatedAt||null,blocked_at:c.voidAt||null};dirty=true;}
  else if(c.status==='void'&&r.status==='new'){r.status='blocked';r.blocked_at=c.voidAt||iso(now());dirty=true;}}
 const pc=own_partnerContacts();const old=b.partnerContacts.filter(x=>x.partner===P);
 if(JSON.stringify(pc)!==JSON.stringify(old)){b.partnerContacts=b.partnerContacts.filter(x=>x.partner!==P).concat(pc);dirty=true;}
 if(own_process(b))dirty=true;
 const st=own_st();if(st.ret.lastDay!==own_day(now())&&st.seededAt){own_runRetention(b,{auto:true});dirty=true;}
 if(!st.seededAt){st.seededAt=iso(now());st.ret.lastDay=own_day(now());}
 if(dirty)own_bWrite(b);else{own__b=b;own_mirror(b);}return b;}
function own_mirror(b){const P=own_pc();const st=own_st();
 st.bindings=b.bindings.filter(x=>x.partner_id===P);const ids=new Set(st.bindings.map(x=>x.id));
 st.transfers=b.transfers.filter(x=>ids.has(x.binding_id));st.requests=b.requests.filter(x=>x.partner_id===P);
 st.feed=own_feedItems(b).slice(0,50).map(f=>({type:f.type,iccid:f.bd.iccid,imei:f.bd.device_id,at:f.at}));
 const act=new Set();st.bindings.forEach(x=>{if(x.status!=='ended')act.add(x.iccid);});
 for(const s of S.sims){const l=act.has(s.iccid);if(!!s.linked!==l){s.linked=l;if(l){s.events=s.events||[];s.events.push([iso(now()),'linked']);}}}}
window.addEventListener('storage',e=>{if(e.key!==OWN_KEY)return;own__b=null;try{if(S.authed&&/^own/.test(parseHash().name))rerender();}catch(x){}});

/* ---------- ONE visibility builder for UI, API, export and webhook (4.8, criterion 18) ---------- */
function own_ctx(){const b=own_b();const P=own_pc();const act=new Map();b.bindings.forEach(x=>{if(x.partner_id===P&&x.status!=='ended')act.set(x.iccid,x);});return{b,P,act,mm:own_modelMap()};}
function own_icheck(s,ctx){const r=ctx.b.sims[s.iccid];return{found:!!r||!!s,issued_to_partner:!!r&&r.partner===ctx.P&&r.status==='issued',imei_whitelisted:s.imei?s.status==='active':null,online:own_online(s)};}
function own_view(s,role,ctx){const bd=ctx.act.get(s.iccid)||null;const x=s.modelId&&ctx.mm[s.modelId];
 const v={iccid:s.iccid,imei:s.imei||null,model:own_mname(x),bound:!!bd,bound_at:bd?bd.bound_at:null,online:own_online(s),install_check:own_icheck(s,ctx)};
 if(own_canSee('plan',role))v.plan=s.plan?{plan:s.plan,term_months:s.term,paid_until:s.paidUntil}:null;
 if(own_canSee('contacts',role)){v.binding_status=bd?bd.status:'free';const a=bd&&own_acc(ctx.b,bd.owner_account_id);v.owner=bd?{name:a&&a.name||null,email:a&&a.email||null,phone:a&&a.phone||null}:null;}
 return v;}
function own_hookProfile(role){return own_canSee('contacts',role)?'full':'technical';}
function own_hook(item,profile,ctx){if(!item)return null;const bd=item.bd;const base={event:item.type==='bound'?'device.bound':'device.transferred',iccid:bd.iccid,imei:bd.device_id||null,date:item.at};
 if(profile!=='full')return base;   // roles without contact access: ICCID, IMEI, date, event type only (4.11)
 const a=own_acc(ctx.b,bd.owner_account_id);return Object.assign(base,{binding_id:bd.id,method:bd.method,owner:{name:a&&a.name||null,email:a&&a.email||null,phone:a&&a.phone||null}});}
function own_exportRows(role,ctx,list){if(!['p_admin','p_ops'].includes(role))return null;   // ICCID lists: Partner Admin / Operations only (4.9 p.5)
 return (list||S.sims).map(s=>{const v=own_view(s,role,ctx);return{iccid:v.iccid,imei:v.imei||'',model:v.model||'',bound:v.bound?'yes':'no',bound_at:v.bound_at?v.bound_at.slice(0,10):'',binding_status:v.binding_status||'',online:v.online?'yes':'no',
  plan:v.plan?pkgKey(v.plan.plan,v.plan.term_months):'',paid_until:v.plan&&v.plan.paid_until?v.plan.paid_until.slice(0,10):'',sold_by:own_userName(s.sold_by_user_id),installed_by:own_userName(s.installed_by_user_id)};});}
function own_feedItems(b){const P=own_pc();const out=[];
 b.bindings.forEach(bd=>{if(bd.partner_id!==P)return;out.push({type:bd.method==='transfer'||bd.method==='support_reset'?'transferred':'bound',at:bd.bound_at,bd});});
 return out.sort((a,c)=>a.at<c.at?1:a.at>c.at?-1:0);}
const OWN_FORBID=/^(location|locations|lat|lng|lon|latitude|longitude|gps|coords|coordinates|position|events|event_log|history|track|trip|route)$/i;   // "event" (the event type of a webhook) is allowed
const OWN_CONTACT=/^(owner|email|phone|name|contact)$/i;
function own_keys(o,acc){acc=acc||new Set();if(Array.isArray(o))o.forEach(x=>own_keys(x,acc));else if(o&&typeof o==='object')Object.keys(o).forEach(k=>{acc.add(k);own_keys(o[k],acc);});return acc;}
function own_selfCheck(){const ctx=own_ctx();const roles=['p_admin','p_ops','p_dealer','p_installer'];const feed=own_feedItems(ctx.b);
 return roles.map(role=>{const uid=(users().find(u=>u.role===role)||{}).id;const scope=S.sims.filter(s=>own_inScope(s,role,uid)).slice(0,25);
  const ch={ui:scope.map(s=>own_view(s,role,ctx)),api:scope[0]?own_view(scope[0],role,ctx):{},export:own_exportRows(role,ctx,scope),webhook:own_hook(feed[0],own_hookProfile(role),ctx)};
  const res={};Object.keys(ch).forEach(k=>{const keys=[...own_keys(ch[k])];const bad=keys.filter(x=>OWN_FORBID.test(x)||(!own_canSee('contacts',role)&&OWN_CONTACT.test(x))||(!own_canSee('plan',role)&&x==='plan'));
   res[k]={ok:!bad.length,bad,na:ch[k]==null,n:Array.isArray(ch[k])?ch[k].length:null};});return{role,res,scope:scope.length};});}

/* ---------- UI helpers ---------- */
function own_opt(v,l,sel){return `<option value="${esc(v)}" ${String(v)===String(sel)?'selected':''}>${esc(l)}</option>`;}
function own_submit(label,form,kind){return `<button class="btn ${kind||'primary'}" type="submit" form="${form}"><span>${label}</span></button>`;}
function own_cancel(){return ui.btn(t('c.cancel'),{act:'ovclose'});}
function own_yes(v){return v==null?`<span class="faint">—</span>`:v?`<span class="own_ok">${icon('check','sm')}${t('c.yes')}</span>`:`<span class="own_no">${icon('x','sm')}${t('c.no')}</span>`;}
function own_noAccess(title){return ui.page({title,body:ui.card({body:ui.empty('shield',t('own.noAccessT'),t('own.noAccessP',{r:esc(roleName(own_role()))}),S.admin?'':(typeof ord_asBtn==='function'?ord_asBtn('p_admin'):''))})});}
function own_bBadge(bd,role){if(!bd)return ui.badge(t('own.st.free'),'');if(bd.status==='frozen'&&own_canSee('contacts',role))return ui.badge(t('own.st.frozen'),'bad',true);return ui.badge(t('own.st.bound'),'ok',true);}
function own_reqBadge(st){const tone={submitted:'info',docs_requested:'warn',cooling_off:'violet',disputed:'bad',rejected:'',done:'ok',cancelled:''}[st]||'';return ui.badge(t('own.rq.st.'+st),tone,true);}
function own_demoTag(){return S.admin?' '+ui.badge(t('own.demo'),'violet'):'';}
function own_roleNote(){const r=own_role();if(r==='p_dealer')return ui.note('info',t('own.scope.dealer'));if(r==='p_installer')return ui.note('info',t('own.scope.installer'));return '';}
function own_f(){if(!S.ui.own_f)S.ui.own_f={q:'',st:'all'};return S.ui.own_f;}

/* ---------- nav & routes ---------- */
const own_sec=()=>t('own.sec');
nav({key:'own',label:()=>t('own.nav.devices'),icon:'shield',href:'#own',order:46,section:own_sec});
nav({key:'own-check',label:()=>t('own.nav.check'),icon:'search',href:'#own-check',order:47,section:own_sec});
nav({key:'own-req',label:()=>t('own.nav.req'),icon:'file',href:'#own-req',order:48,section:own_sec,count:()=>{if(!S.own)return null;const P=own_pc();
 const l=(S.own.requests||[]).filter(q=>q.partner_id===P&&(own_isSupport()?q.status==='submitted':q.status==='docs_requested'));return l.length||null;}});
nav({key:'own-feed',label:()=>t('own.nav.feed'),icon:'bolt',href:'#own-feed',order:49,section:own_sec});
nav({key:'own-codes',label:()=>t('own.nav.codes'),icon:'key',href:'#own-codes',order:50,section:own_sec});
nav({key:'own-users',label:()=>t('own.nav.users'),icon:'users',href:'#own-users',order:51,section:own_sec});
nav({key:'own-ret',label:()=>t('own.nav.ret'),icon:'clock',href:'#own-ret',order:98,admin:true,section:()=>t('own.otasec')});

/* ===== Devices & owners ===== */
route('own',{nav:'own',render(){const ctx=own_ctx();const role=own_role();const f=own_f();const q=digits(f.q);
 const scope=[];const k={all:0,bound:0,free:0,frozen:0,tr:0};const open=new Set(ctx.b.transfers.filter(x=>x.status==='pending_acceptance'||x.status==='cooling_off').map(x=>x.binding_id));
 for(const s of S.sims){if(!own_inScope(s,role))continue;const bd=ctx.act.get(s.iccid);k.all++;if(bd){k.bound++;if(bd.status==='frozen')k.frozen++;if(open.has(bd.id))k.tr++;}else k.free++;
  if(f.st==='bound'&&!bd||f.st==='free'&&bd||f.st==='frozen'&&!(bd&&bd.status==='frozen')||f.st==='tr'&&!(bd&&open.has(bd.id)))continue;
  if(q&&!(s.iccid.includes(q)||(s.imei&&s.imei.includes(q))))continue;scope.push(s);}
 const reqs=ctx.b.requests.filter(x=>x.partner_id===ctx.P&&['submitted','docs_requested','cooling_off','disputed'].includes(x.status)).length;
 const actions=(own_canDo('export')?ui.btn(t('own.export'),{icon:'download',act:'own_export'}):'')+(own_canDo('check')?ui.btn(t('own.nav.check'),{icon:'search',href:'#own-check'}):'')+(own_canDo('bindstart')?ui.btn(t('own.bs.btn'),{kind:'primary',icon:'send',act:'own_bindStart',arg:''}):'');
 const full=own_canSee('contacts',role);
 const kpis=`<div class="own_kpis">${ui.kpi(t('own.k.devices'),fmtNum(k.all),own_limited()?t('own.k.devicesMine'):t('own.k.devicesAll'))}${ui.kpi(t('own.k.bound'),fmtNum(k.bound),k.all?pct(k.bound/k.all):'')}${ui.kpi(t('own.k.free'),fmtNum(k.free),t('own.k.freeS'))}
  ${full?ui.kpi(t('own.k.frozen'),fmtNum(k.frozen),t('own.k.frozenS'))+ui.kpi(t('own.k.req'),fmtNum(reqs),t('own.k.reqS'),{href:'#own-req'}):''}</div>`;
 if(!k.all&&own_limited())return ui.page({title:t('own.title'),sub:t('own.sub'),actions,body:`<div class="stack">${own_roleNote()}${ui.card({body:ui.empty('sim',t('own.emptyMineT'),t('own.emptyMineP'),own_canDo('check')?ui.btn(t('own.nav.check'),{kind:'primary',href:'#own-check'}):'')})}</div>`});
 const segs=[['all',t('c.all')],['bound',t('own.st.bound')],['free',t('own.st.free')]].concat(full?[['frozen',t('own.st.frozen')],['tr',t('own.st.transfer')]]:[]);
 const pages=Math.max(1,Math.ceil(scope.length/OWN_PER));const page=clamp(+S.ui.own_page||1,1,pages);S.ui.own_page=page;const slice=scope.slice((page-1)*OWN_PER,page*OWN_PER);
 const cols=[{label:'ICCID'},{label:t('own.c.device')},{label:t('own.c.binding')},{label:t('own.c.online')},{label:t('own.c.check')}].concat(own_canSee('plan',role)?[{label:t('own.c.plan')}]:[]).concat(full?[{label:t('own.c.owner')}]:[]);
 const rows=slice.map(s=>{const v=own_view(s,role,ctx);const bd=ctx.act.get(s.iccid);const ic=v.install_check;const okN=[ic.issued_to_partner,ic.imei_whitelisted,ic.online].filter(Boolean).length;
  const cells=[`<span class="mono nowrap">${fmtIccid(v.iccid)}</span>${v.imei?`<br><span class="xs faint mono">IMEI ${esc(v.imei)}</span>`:''}`,v.model?esc(v.model):'<span class="faint">—</span>',
   own_bBadge(bd,role)+(v.bound_at?`<br><span class="xs faint">${t('own.since',{d:fmtDate(v.bound_at)})}</span>`:'')+(full&&bd&&open.has(bd.id)?`<br>${ui.badge(t('own.st.transfer'),'violet')}`:''),
   v.online?ui.badge(t('own.online'),'ok',true):ui.badge(t('own.offline'),''),`<span class="small">${okN}/3</span>`];
  if('plan' in v)cells.push(v.plan?`<span class="nowrap">${esc(pkgLabel(v.plan.plan,v.plan.term_months))}</span><br><span class="xs faint">${t('own.until',{d:fmtDate(v.plan.paid_until)})}</span>`:'<span class="faint small">—</span>');
  if(full)cells.push(v.owner?`<span class="nowrap">${esc(v.owner.name||t('own.anonOwner'))}</span><br><span class="xs faint">${esc(v.owner.phone||v.owner.email||'')}</span>`:'<span class="faint">—</span>');
  return{act:'own_open',arg:s.iccid,cells};});
 const toolbar=`<div class="toolbar"><label class="own_search">${icon('search','sm')}<span class="own_sr">${t('own.search')}</span><input class="inp" id="own_q" type="search" inputmode="numeric" autocomplete="off" placeholder="${esc(t('own.search'))}" value="${esc(f.q)}" data-live="own_q"></label>${ui.seg('own_st',segs,f.st,'own_st')}</div>`;
 const body=`<div class="stack">${own_roleNote()}${kpis}${ui.note('info',t('own.locNote'))}<section class="card own_tbl">${toolbar}${ui.table(cols,rows,{empty:ui.empty('search',t('c.nothing'),'')})}${scope.length>OWN_PER?ui.pager(page,scope.length,OWN_PER,'own_page'):''}</section></div>`;
 return ui.page({title:t('own.title'),sub:t('own.sub'),actions,body});}});

function own_drawer(iccid){const s=own_sim(iccid);const ctx=own_ctx();const role=own_role();
 if(!s||!own_inScope(s,role)){toast(t('own.notInScope'),'bad');return;}
 const v=own_view(s,role,ctx);const bd=ctx.act.get(iccid)||null;const ic=v.install_check;const full=own_canSee('contacts',role);const br=ctx.b.sims[iccid]||{};
 const dl=`<dl class="dl"><dt>ICCID</dt><dd class="mono">${fmtIccid(iccid)}</dd><dt>IMEI</dt><dd class="mono">${v.imei?esc(v.imei):'—'}</dd><dt>${t('own.c.device')}</dt><dd>${v.model?esc(v.model):'—'}</dd>
  <dt>${t('own.c.binding')}</dt><dd>${own_bBadge(bd,role)}${v.bound_at?` <span class="small muted">${t('own.since',{d:fmtDateTime(v.bound_at)})}</span>`:''}</dd>
  <dt>${t('own.c.online')}</dt><dd>${v.online?ui.badge(t('own.online'),'ok',true):ui.badge(t('own.offline'),'')}</dd>
  ${'plan' in v?`<dt>${t('own.c.plan')}</dt><dd>${v.plan?esc(pkgLabel(v.plan.plan,v.plan.term_months))+' · '+t('own.until',{d:fmtDate(v.plan.paid_until)}):'—'}</dd>`:''}
  ${full?`<dt>${t('own.c.owner')}</dt><dd>${v.owner?`<b>${esc(v.owner.name||t('own.anonOwner'))}</b><br><span class="small">${esc(v.owner.email||'')}${v.owner.email&&v.owner.phone?' · ':''}${esc(v.owner.phone||'')}</span>`:'—'}</dd>`:''}
  ${S.admin?`<dt>${t('own.soldBy')}</dt><dd>${esc(own_userName(s.sold_by_user_id)||'—')}</dd><dt>${t('own.instBy')}</dt><dd>${esc(own_userName(s.installed_by_user_id)||'—')}</dd>`:''}</dl>`;
 const checks=`<h3 class="own_h3">${t('own.ic.title')}</h3>${own_checkList(ic,br)}`;
 let extra='';
 if(full&&bd){const tr=own_openTr(ctx.b,bd.id);if(tr)extra+=ui.note('info',t('own.tr.'+tr.status,{c:esc(tr.to_contact),d:fmtDateTime(tr.initiated_at)}));if(bd.status==='frozen')extra+=ui.note('bad',t('own.frozenNote',{r:esc(bd.frozen_reason||'')}));}
 let hist='';
 if(own_canSee('history',role)){const past=ctx.b.bindings.filter(x=>x.iccid===iccid&&x.status==='ended').sort((a,c)=>a.bound_at<c.bound_at?1:-1);
  if(past.length)hist=`<h3 class="own_h3">${t('own.saleHist')}</h3><p class="xs faint">${t('own.saleHistP')}</p><div class="timeline">${past.map(x=>`<div class="tl done"><span class="dot">${icon('check','sm')}</span><div class="col"><b>${esc(own_ownerLabel(ctx.b,x.owner_account_id))}</b><span class="small muted">${fmtDate(x.bound_at)} – ${fmtDate(x.unbound_at)} · ${t('own.ur.'+(x.unbind_reason||'owner'))}</span></div></div>`).join('')}</div>`;}
 const rq=ctx.b.requests.filter(x=>x.iccid===iccid&&x.partner_id===ctx.P);
 const rqh=own_canDo('request')||own_isSupport()?(rq.length?`<h3 class="own_h3">${t('own.nav.req')}</h3>`+rq.map(x=>`<p class="row g8 wrap"><button type="button" class="own_lnk" data-act="own_reqOpen" data-arg="${esc(x.id)}">${esc(x.no)}</button>${own_reqBadge(x.status)}<span class="xs faint">${fmtDate(x.submitted_at)}</span></p>`).join(''):''):'';
 let foot=ui.btn(t('c.close'),{act:'ovclose'});
 if(own_isSupport()&&bd)foot=ui.btn(bd.status==='frozen'?t('own.fz.unfreeze'):t('own.fz.freeze'),{kind:bd.status==='frozen'?'':'danger',icon:'shield',act:'own_freeze',arg:iccid})+foot;
 if(own_canDo('request')&&bd&&bd.status==='active'&&!rq.some(x=>['submitted','docs_requested','cooling_off','disputed'].includes(x.status)))foot=ui.btn(t('own.rq.btn'),{icon:'file',act:'own_reqNew',arg:iccid})+foot;
 if(own_canDo('bindstart')&&!bd&&br.status!=='deactivated')foot=ui.btn(t('own.bs.btn'),{kind:'primary',icon:'send',act:'own_bindStart',arg:iccid})+foot;
 drawer(t('own.d.title')+' <span class="mono faint" style="font-weight:500">···'+esc(iccid.slice(-6))+'</span>',`${extra}${dl}${checks}${hist}${rqh}`,foot);}
function own_checkList(ic,br){const row=(ok,l,sub)=>`<li class="${ok==null?'na':ok?'ok':'bad'}">${icon(ok==null?'info':ok?'check':'x','sm')}<span><b>${l}</b>${sub?`<br><span class="xs muted">${sub}</span>`:''}</span></li>`;
 return `<ul class="own_checks">${row(ic.found,t('own.ic.found'))}${row(ic.issued_to_partner,t('own.ic.issued'),br&&br.status==='deactivated'?t('own.ic.deact'):'')}${row(ic.imei_whitelisted,t('own.ic.wl'),ic.imei_whitelisted==null?t('own.ic.noImei'):'')}${row(ic.online,t('own.ic.online'))}</ul>`;}

/* ----- ICCID export (Partner Admin / Operations only, logged) ----- */
function own_export(){if(!own_canDo('export')){toast(t('own.noAccessT'),'bad');return;}const ctx=own_ctx();const rows=own_exportRows(own_role(),ctx);
 const head=Object.keys(rows[0]||{iccid:''});const q=v=>{v=v==null?'':String(v);return /[",\n;]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;};
 const csv=[head.join(',')].concat(rows.slice(0,5000).map(r=>head.map(h=>q(r[h])).join(','))).join('\n');
 audit('iccid.export','own',{rows:rows.length,format:'view'});S.ui.own_csvN=rows.length;
 modal(t('own.ex.title'),`${ui.note('warn',t('own.ex.note'))}<p class="muted small">${t('own.ex.p',{n:fmtNum(rows.length)})}</p><div class="field"><label for="own_csv">CSV</label><textarea class="inp mono" id="own_csv" rows="10" readonly>${esc(csv)}</textarea></div>`,
  ui.btn(t('c.close'),{act:'ovclose'})+ui.btn(t('own.ex.copy'),{icon:'copy',act:'own_csvCopy'})+(typeof cx_xlsx==='function'?ui.btn('XLSX',{kind:'primary',icon:'download',act:'own_xlsx'}):''),{wide:true});}

/* ===== Installation check + start binding for a customer ===== */
route('own-check',{nav:'own-check',render(){if(!own_canDo('check'))return own_noAccess(t('own.ic.page'));const ctx=own_ctx();
 const res=S.ui.own_ic?own_sim(S.ui.own_ic):null;const iccid=S.ui.own_ic||'';const br=iccid?ctx.b.sims[iccid]:null;
 const form=`<form id="own_icF" data-form="own_check" class="own_icf" novalidate>${ui.field({id:'own_ci',label:t('own.ic.iccid'),mono:true,value:iccid?fmtIccid(iccid):'',placeholder:'8938 0012 0000 0000 123',hint:t('own.ic.hint'),attrs:'inputmode="numeric" autocomplete="off" maxlength="26"'})}
  <div class="row wrap g8">${ui.btn(t('own.ic.scan'),{icon:'eye',act:'own_scan'})}<button class="btn primary" type="submit"><span>${t('own.ic.do')}</span></button></div></form>`;
 let result='';
 if(iccid){if(!res&&!br)result=ui.note('bad',`<b>${t('own.ic.nf')}</b><br>${t('own.T3')}`);
  else{const s=res||{iccid,status:'stock'};const ic=own_icheck(s,ctx);const mine=res&&res.installed_by_user_id===own_me().id;
   const acts=(own_role()==='p_installer'&&res&&res.status==='active'&&!res.installed_by_user_id?ui.btn(t('own.ic.record'),{icon:'check',act:'own_record',arg:iccid}):'')+(own_canDo('bindstart')&&br&&br.status==='issued'?ui.btn(t('own.bs.btn'),{kind:'primary',icon:'send',act:'own_bindStart',arg:iccid}):'');
   result=ui.card({title:t('own.ic.result')+' <span class="mono faint">···'+esc(iccid.slice(-6))+'</span>',body:`${own_checkList(ic,br)}${mine?`<p class="small muted">${t('own.ic.mine')}</p>`:''}${ui.note('info',t('own.ic.notBinding'))}`,foot:acts||null});}}
 const st=own_st();const links=ctx.b.bindLinks.filter(l=>l.partner_id===ctx.P&&(own_limited()?l.created_by_id===own_me().id:true)).slice().reverse().slice(0,30);
 const lt=links.length?ui.table([{label:'ICCID'},{label:t('own.bs.contact')},{label:t('c.status')},{label:t('own.bs.expires')},{label:''}],links.map(l=>({cells:[`<span class="mono nowrap">···${esc(l.iccid.slice(-6))}</span>`,esc(own_maskContact(l.contact)),ui.badge(t('own.bs.st.'+l.status),{pending:'info',confirmed:'ok',expired:'',cancelled:''}[l.status]),fmtDateTime(l.expires_at),l.status==='pending'?ui.btn(t('own.bs.cancel'),{size:'sm',kind:'ghost',act:'own_linkCancel',arg:l.id}):'']}))):`<p class="muted small">${t('own.bs.none')}</p>`;
 return ui.page({title:t('own.ic.page'),sub:t('own.ic.sub'),body:`<div class="stack">${own_roleNote()}<div class="grid2 own_g">${ui.card({title:t('own.ic.title'),body:form})}${result||ui.card({body:ui.empty('search',t('own.ic.emptyT'),t('own.ic.emptyP'))})}</div>${ui.card({title:t('own.bs.listT'),body:`<p class="small muted">${t('own.bs.listP')}</p>${lt}`})}</div>`});}});
function own_maskContact(c){c=String(c||'');if(c.includes('@')){const [u,d]=c.split('@');return u.slice(0,2)+'•••@'+d;}const d=digits(c);return d.length>4?'•••'+d.slice(-4):c;}
FORM.own_check=f=>{clearErrs(f);const v=own_normIccid(formData(f).own_ci);if(v.length<18||v.length>20){setErr(f,'own_ci',t('own.ic.fmt'));return;}
 S.ui.own_ic=v;audit('ownership.install_check',v,{role:own_role()});rerender();};
function own_bindModal(iccid){if(!own_canDo('bindstart')){toast(t('own.noAccessT'),'bad');return;}
 modal(t('own.bs.title'),`<form id="own_bsF" data-form="own_bind" class="stack" novalidate>${ui.note('info',t('own.bs.p',{h:OWN_LINK_H}))}
  ${ui.field({id:'own_bi',label:'ICCID',mono:true,value:iccid?fmtIccid(iccid):'',attrs:'inputmode="numeric" autocomplete="off" maxlength="26"'})}
  ${ui.field({id:'own_bc',label:t('own.bs.contact'),placeholder:t('own.bs.contactPh'),hint:t('own.bs.contactHint'),attrs:'autocomplete="off"'})}
  <div class="own_preview"><span class="xs faint">${t('own.bs.preview')}</span><label class="chk small"><input type="checkbox" disabled><span>${t('own.T1')}</span></label></div></form>`,own_cancel()+own_submit(t('own.bs.do'),'own_bsF'));}
FORM.own_bind=f=>{clearErrs(f);const d=formData(f);const iccid=own_normIccid(d.own_bi);const contact=String(d.own_bc||'').trim();
 if(iccid.length<18||iccid.length>20){setErr(f,'own_bi',t('own.ic.fmt'));return;}
 if(!own_validContact(contact)){setErr(f,'own_bc',t('own.bs.contactErr'));return;}
 const b=own_bNorm(own_bRead()||own_b());const r=b.sims[iccid];
 if(!r||r.partner!==own_pc()||r.status!=='issued'){setErr(f,'own_bi',t('own.T3'));audit('ownership.bind_link.refused',iccid,{code:'T3'});return;}
 if(own_activeB(b,iccid)){setErr(f,'own_bi',t('own.T2'));audit('ownership.bind_link.refused',iccid,{code:'T2'});return;}
 if(own_t12Blocked(b,contact)){setErr(f,'own_bc',t('own.T12'));audit('ownership.bind_link.refused',iccid,{code:'T12'});return;}
 const s=own_sim(iccid);const me=own_me();
 const l=own_tx(bb=>{const at=iso(now());bb.bindLinks.forEach(x=>{if(x.iccid===iccid&&x.status==='pending'){x.status='cancelled';x.cancelled_at=at;}});
  const ln={id:own_id('bl'),token:rndB32(12),partner_id:own_pc(),iccid,device_id:s&&s.imei||null,contact,contact_norm:own_normContact(contact),created_by_id:me.id,created_by_role:me.role,created_at:at,expires_at:iso(new Date(now().getTime()+OWN_LINK_H*3600e3)),status:'pending'};
  bb.bindLinks.push(ln);own_event(bb,'bind_link.created',{iccid,link_id:ln.id});return ln;});
 audit('ownership.bind_link.create',iccid,{link:l.id,expires:l.expires_at});log(t('own.bs.log',{i:fmtIccid(iccid)}));
 const url=own_portalUrl(l.token);
 modal(t('own.bs.doneT'),`${ui.note('ok',t('own.bs.doneP',{c:esc(contact),h:OWN_LINK_H}))}<div class="field"><label for="own_bl">${t('own.bs.link')}</label><input class="inp mono" id="own_bl" readonly value="${esc(url)}"></div><p class="small muted">${t('own.bs.free')}</p>`,
  ui.btn(t('c.close'),{act:'ovclose'})+ui.btn(t('own.bs.copy'),{kind:'primary',icon:'copy',act:'copy',arg:url}));rerender();};
function own_portalUrl(tok){let base='../portal/';try{const p=location.pathname;if(/\/partner(-console)?\//.test(p))base=p.replace(/\/partner(-console)?\/.*$/,'/portal/');}catch(e){}return location.origin+(base.startsWith('/')?'':'/')+base.replace(/^\.\.\//,'')+'#b/'+tok;}
// camera scan: BarcodeDetector where the browser supports it; otherwise type the number
async function own_scan(){if(!('BarcodeDetector' in window)||!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){toast(t('own.ic.scanNo'),'bad');return;}
 let stream=null;try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});}catch(e){toast(t('own.ic.scanNo'),'bad');return;}
 modal(t('own.ic.scan'),`<video id="own_vid" class="own_vid" autoplay playsinline muted></video><p class="small muted">${t('own.ic.scanP')}</p>`,own_cancel());
 const vid=$('#own_vid');vid.srcObject=stream;const det=new BarcodeDetector();const stop=()=>stream.getTracks().forEach(tr=>tr.stop());
 const loop=async()=>{if(!document.contains(vid)){stop();return;}try{const r=await det.detect(vid);const c=r.map(x=>digits(x.rawValue)).find(x=>x.length>=18&&x.length<=20);if(c){stop();closeOverlay();S.ui.own_ic=c;go('own-check');return;}}catch(e){}requestAnimationFrame(loop);};loop();}

/* ===== Ownership requests (4.7) ===== */
route('own-req',{nav:'own-req',render(){const sup=own_isSupport();if(!own_canDo('request')&&!sup&&!own_canSee('feed'))return own_noAccess(t('own.rq.title'));
 const ctx=own_ctx();const role=own_role();let list=ctx.b.requests.filter(q=>q.partner_id===ctx.P);
 if(own_limited())list=list.filter(q=>{const s=own_sim(q.iccid);return s&&own_inScope(s,role);});
 list=list.slice().sort((a,c)=>a.submitted_at<c.submitted_at?1:-1);
 const rows=list.map(q=>({act:'own_reqOpen',arg:q.id,cells:[`<b class="mono nowrap">${esc(q.no)}</b>`,`<span class="mono nowrap">···${esc(q.iccid.slice(-6))}</span>`,t('own.rq.r.'+q.reason),t('own.rq.a.'+q.action),own_reqBadge(q.status)+(q.status==='cooling_off'?`<br><span class="xs faint">${t('own.rq.until',{d:fmtDateTime(q.object_deadline)})}</span>`:''),`<span class="small">${esc(q.submitted_by)}</span><br><span class="xs faint">${fmtDate(q.submitted_at)}</span>`]}));
 const tbl=ui.table([{label:'№'},{label:'ICCID'},{label:t('own.rq.reason')},{label:t('own.rq.action')},{label:t('c.status')},{label:t('own.rq.by')}],rows,{empty:ui.empty('file',t('own.rq.emptyT'),t('own.rq.emptyP'))});
 const actions=own_canDo('request')?ui.btn(t('own.rq.new'),{kind:'primary',icon:'plus',act:'own_reqNew',arg:''}):'';
 return ui.page({title:t('own.rq.title'),sub:t('own.rq.sub'),actions,body:`<div class="stack">${own_roleNote()}${sup?ui.note('admin',t('own.rq.supNote')):''}<section class="card">${tbl}</section></div>`});}});
function own_reqModal(iccid){if(!own_canDo('request')){toast(t('own.noAccessT'),'bad');return;}const ctx=own_ctx();const role=own_role();
 const opts=S.sims.filter(s=>ctx.act.get(s.iccid)&&ctx.act.get(s.iccid).status==='active'&&own_inScope(s,role)).slice(0,400);
 modal(t('own.rq.new'),`<form id="own_rqF" data-form="own_req" class="stack" novalidate>
  ${iccid?`<input type="hidden" name="own_ri" value="${esc(iccid)}"><p><span class="xs faint">ICCID</span><br><b class="mono">${fmtIccid(iccid)}</b></p>`:ui.field({id:'own_ri',label:'ICCID',type:'select',options:[['',t('own.rq.pick')]].concat(opts.map(s=>[s.iccid,fmtIccid(s.iccid)])),hint:t('own.rq.pickHint')})}
  ${ui.field({id:'own_rc',label:t('own.rq.contact'),placeholder:t('own.bs.contactPh'),hint:t('own.rq.contactHint'),attrs:'autocomplete="off"'})}
  ${ui.field({id:'own_rr',label:t('own.rq.reason'),type:'select',options:[['','—']].concat(OWN_REASONS.map(r=>[r,t('own.rq.r.'+r)]))})}
  ${ui.field({id:'own_ra',label:t('own.rq.action'),type:'select',options:[['unbind',t('own.rq.a.unbind')],['transfer',t('own.rq.a.transfer')]],hint:t('own.rq.actionHint')})}
  <div class="field"><label for="own_rf">${t('own.rq.file')}</label><input class="inp" id="own_rf" name="own_rf" type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,application/pdf,image/*" aria-describedby="own_rf-h"><span class="hint" id="own_rf-h">${t('own.rq.fileHint')}</span></div>
  <label class="chk"><input type="checkbox" name="own_rk" id="own_rk"><span>${t('own.rq.checked')}</span></label><span class="hint" id="own_rk-h"></span>
  ${ui.note('info',t('own.rq.flow'))}</form>`,own_cancel()+own_submit(t('own.rq.send'),'own_rqF'));}
function own_fileMeta(f){const el=f.querySelector('input[type=file]');const x=el&&el.files&&el.files[0];return x?{name:x.name,size:x.size,type:x.type||'',uploaded_at:iso(now()),by:actorName()}:null;}
FORM.own_req=f=>{clearErrs(f);const d=formData(f);let bad=false;const iccid=own_normIccid(d.own_ri);const ctx=own_ctx();const bd=iccid&&ctx.act.get(iccid);const file=own_fileMeta(f);
 if(!iccid||!bd){setErr(f,'own_ri',t('own.rq.iccidErr'));bad=true;}else if(bd.status!=='active'){setErr(f,'own_ri',t('own.rq.frozenErr'));bad=true;}
 const s=iccid&&own_sim(iccid);if(s&&!own_inScope(s)){setErr(f,'own_ri',t('own.notInScope'));bad=true;}
 if(!own_validContact(d.own_rc)){setErr(f,'own_rc',t('own.bs.contactErr'));bad=true;}
 if(!OWN_REASONS.includes(d.own_rr)){setErr(f,'own_rr',t('own.rq.reasonErr'));bad=true;}
 if(!file){setErr(f,'own_rf',t('own.rq.fileErr'));bad=true;}   // criterion 19: never sent without the document
 if(!d.own_rk){setErr(f,'own_rk',t('own.rq.checkedErr'));bad=true;}
 if(bad)return;const me=own_me();const P=own_pc();
 const q=own_tx(b=>{if(b.requests.some(x=>x.iccid===iccid&&['submitted','docs_requested','cooling_off','disputed'].includes(x.status)))return null;const bb=own_activeB(b,iccid);if(!bb)return null;const at=iso(now());
  const r={id:own_id('or'),no:'OR-'+P+'-'+pad(seqNext(P+':OR'),4),partner_id:P,iccid,binding_id:bb.id,owner_account_id:bb.owner_account_id,requester_contact:String(d.own_rc).trim(),reason:d.own_rr,action:d.own_ra==='transfer'?'transfer':'unbind',
   files:[file],doc_checked:true,status:'submitted',submitted_by:me.name,submitted_by_id:me.id,submitted_role:me.role,submitted_at:at,log:[[at,'submitted',me.name,file.name]]};
  b.requests.push(r);own_event(b,'request.submitted',{iccid,request_id:r.id});return r;});
 if(!q){setErr(f,'own_ri',t('own.rq.dupErr'));return;}
 audit('ownership.request.submit',iccid,{request:q.no,reason:q.reason,action:q.action,file:file.name,size:file.size,doc_checked:true});log(t('own.rq.log',{n:q.no}));
 closeOverlay();toast(t('own.rq.sent',{n:esc(q.no)}));if(parseHash().name==='own-req')rerender();else go('own-req');};
function own_reqDrawer(id){const ctx=own_ctx();const q=ctx.b.requests.find(x=>x.id===id);if(!q)return;const sup=own_isSupport();const role=own_role();const s=own_sim(q.iccid);
 if(own_limited()&&!(s&&own_inScope(s,role))){toast(t('own.notInScope'),'bad');return;}
 const full=own_canSee('contacts',role);const a=own_acc(ctx.b,q.owner_account_id);
 const dl=`<dl class="dl"><dt>ICCID</dt><dd class="mono">${fmtIccid(q.iccid)}</dd><dt>${t('c.status')}</dt><dd>${own_reqBadge(q.status)}</dd>
  <dt>${t('own.rq.contact')}</dt><dd>${esc(full?q.requester_contact:own_maskContact(q.requester_contact))}</dd><dt>${t('own.rq.reason')}</dt><dd>${t('own.rq.r.'+q.reason)}</dd><dt>${t('own.rq.action')}</dt><dd>${t('own.rq.a.'+q.action)}</dd>
  <dt>${t('own.rq.file')}</dt><dd>${(q.files||[]).map(x=>x.deleted_at?`<span class="faint">${t('own.rq.fileDeleted')}</span>`:`${icon('file','sm')} ${esc(x.name)} <span class="xs faint">${fmtNum(Math.round((x.size||0)/1024))} KB</span>`).join('<br>')}</dd>
  <dt>${t('own.rq.checkedS')}</dt><dd>${own_yes(q.doc_checked)}</dd>${full||sup?`<dt>${t('own.c.owner')}</dt><dd>${esc(a&&a.name||t('own.anonOwner'))}</dd>`:''}
  ${q.object_deadline?`<dt>${t('own.rq.deadline')}</dt><dd>${fmtDateTime(q.object_deadline)} <span class="xs faint">(${q.delay_hours} h)</span></dd>`:''}</dl>`;
 const tl=`<h3 class="own_h3">${t('own.rq.log')}</h3><div class="timeline">${(q.log||[]).slice().reverse().map(([ts,code,by,note])=>`<div class="tl done"><span class="dot">${icon(code==='objected'||code==='rejected'?'x':'check','sm')}</span><div class="col"><b>${t('own.rq.ev.'+code)}</b>${note?`<span class="small muted">${esc(note)}</span>`:''}<span class="xs faint">${fmtDateTime(ts)} · ${esc(by==='owner'?t('own.rq.byOwner'):by)}</span></div></div>`).join('')}</div>`;
 let t11='';if(q.notified_at&&(sup||full))t11=ui.note('info',`<b>${t('own.rq.t11sent',{d:fmtDateTime(q.notified_at)})}</b><br>EN: ${esc(own_tl('en','own.T11',{N:q.delay_hours}))}<br>RU: ${esc(own_tl('ru','own.T11',{N:q.delay_hours}))}`);
 let foot=ui.btn(t('c.close'),{act:'ovclose'});
 if(sup&&(q.status==='submitted'||q.status==='docs_requested'))foot=ui.btn(t('own.rq.reject'),{kind:'danger',act:'own_reqDecide',arg:'reject|'+q.id})+(q.status==='submitted'?ui.btn(t('own.rq.docs'),{act:'own_reqDecide',arg:'docs|'+q.id}):'')+ui.btn(t('own.rq.approve'),{kind:'primary',icon:'check',act:'own_reqDecide',arg:'approve|'+q.id})+foot;
 if(sup&&q.status==='cooling_off')foot=ui.btn(t('own.rq.simObject'),{kind:'danger',act:'own_reqObject',arg:q.id})+foot;
 if(sup&&q.status==='disputed')foot=ui.btn(t('own.rq.keep'),{act:'own_reqDecide',arg:'keep|'+q.id})+ui.btn(t('own.rq.release'),{kind:'danger',act:'own_reqDecide',arg:'release|'+q.id})+foot;
 if(!sup&&own_canDo('request')&&q.status==='docs_requested')foot=ui.btn(t('own.rq.upload'),{kind:'primary',icon:'upload',act:'own_reqUpload',arg:q.id})+foot;
 drawer(esc(q.no),`${q.status==='docs_requested'&&q.decision_note?ui.note('warn',`<b>${t('own.rq.docsAsked')}</b><br>${esc(q.decision_note)}`):''}${q.status==='disputed'?ui.note('bad',t('own.rq.disputedNote')):''}${dl}${t11}${tl}`,foot);}
function own_decideModal(arg){const [mode,id]=String(arg).split('|');if(!own_isSupport())return;const q=own_b().requests.find(x=>x.id===id);if(!q)return;
 const s=own_sim(q.iccid);const H=own_delay(own_simCc(s));const need=mode!=='approve';
 const body=`<form id="own_dcF" data-form="own_decide" class="stack" novalidate><input type="hidden" name="mode" value="${esc(mode)}"><input type="hidden" name="id" value="${esc(id)}">
  ${ui.note('admin',t('own.dc.'+mode+'P',{h:H}))}${mode==='approve'?`<div class="own_preview"><span class="xs faint">${t('own.dc.t11')}</span><p class="small">EN: ${esc(own_tl('en','own.T11',{N:H}))}</p><p class="small">RU: ${esc(own_tl('ru','own.T11',{N:H}))}</p></div>`:''}
  ${ui.field({id:'own_dn',label:need?t('own.dc.reason'):t('own.dc.note')+' ('+t('c.optional')+')',type:'textarea',rows:3})}</form>`;
 modal(t('own.dc.'+mode),body,own_cancel()+own_submit(t('own.dc.'+mode+'Do'),'own_dcF',mode==='reject'||mode==='release'?'danger':'primary'));}
FORM.own_decide=f=>{clearErrs(f);const d=formData(f);const note=String(d.own_dn||'').trim();if(d.mode!=='approve'&&!note){setErr(f,'own_dn',t('own.dc.reasonErr'));return;}const who=actorName();
 const res=own_tx(b=>{const q=b.requests.find(x=>x.id===d.id);if(!q)return null;const at=iso(now());const bd=b.bindings.find(x=>x.id===q.binding_id);
  if(d.mode==='approve'){if(!['submitted','docs_requested'].includes(q.status)||!bd||bd.status!=='active')return null;const H=own_delay(own_simCc(own_sim(q.iccid)));
   Object.assign(q,{status:'cooling_off',decided_by:who,decided_at:at,decision_note:note,delay_hours:H,notified_at:at,object_deadline:iso(new Date(now().getTime()+H*3600e3))});
   q.log.push([at,'approved',who,note]);q.log.push([at,'t11',who,'e-mail + SMS']);
   b.notices.push({id:own_id('nt'),partner_id:q.partner_id,code:'T11',account_id:bd.owner_account_id,iccid:q.iccid,request_id:q.id,channels:['email','sms'],params:{N:H},text:{en:own_tl('en','own.T11',{N:H}),ru:own_tl('ru','own.T11',{N:H}),uk:own_tl('uk','own.T11',{N:H})},at,object_until:q.object_deadline});
   own_event(b,'request.approved',{iccid:q.iccid,request_id:q.id});own_event(b,'notice.T11',{iccid:q.iccid,request_id:q.id,account_id:bd.owner_account_id});}
  else if(d.mode==='reject'){q.status='rejected';q.closed_at=at;q.decided_by=who;q.decided_at=at;q.decision_note=note;q.log.push([at,'rejected',who,note]);}
  else if(d.mode==='docs'){q.status='docs_requested';q.decision_note=note;q.log.push([at,'docs_requested',who,note]);}
  else if(d.mode==='keep'){if(bd&&bd.status==='frozen'){bd.status='active';bd.unfrozen_at=at;bd.unfrozen_by=who;bd.unfreeze_reason=note;}q.status='rejected';q.closed_at=at;q.log.push([at,'kept',who,note]);own_event(b,'binding.unfrozen',{iccid:q.iccid});}
  else if(d.mode==='release'){if(bd&&bd.status==='frozen'){bd.status='active';bd.unfreeze_reason=note;}q.log.push([at,'released',who,note]);own_execRequest(b,q,at);}
  return q;});
 if(!res){toast(t('own.dc.fail'),'bad');closeOverlay();return;}
 audit('ownership.request.'+d.mode,res.iccid,{request:res.no,note,delay_hours:res.delay_hours||null});if(d.mode==='approve')audit('ownership.notice.T11',res.iccid,{request:res.no,account:res.owner_account_id,channels:'email,sms',at:res.notified_at,object_until:res.object_deadline});
 closeOverlay();toast(t('own.dc.done.'+d.mode,{n:esc(res.no)}));rerender();};
function own_uploadModal(id){modal(t('own.rq.upload'),`<form id="own_upF" data-form="own_upload" class="stack" novalidate><input type="hidden" name="id" value="${esc(id)}">
  <div class="field"><label for="own_uf">${t('own.rq.file')}</label><input class="inp" id="own_uf" name="own_uf" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/*"><span class="hint" id="own_uf-h">${t('own.rq.fileHint')}</span></div>
  <label class="chk"><input type="checkbox" name="own_uk" id="own_uk"><span>${t('own.rq.checked')}</span></label></form>`,own_cancel()+own_submit(t('own.rq.resend'),'own_upF'));}
FORM.own_upload=f=>{clearErrs(f);const d=formData(f);const file=own_fileMeta(f);if(!file){setErr(f,'own_uf',t('own.rq.fileErr'));return;}if(!d.own_uk){setErr(f,'own_uk',t('own.rq.checkedErr'));return;}
 const q=own_tx(b=>{const q=b.requests.find(x=>x.id===d.id);if(!q||q.status!=='docs_requested')return null;q.files.push(file);q.status='submitted';q.log.push([iso(now()),'resubmitted',actorName(),file.name]);return q;});
 if(q)audit('ownership.request.documents',q.iccid,{request:q.no,file:file.name});closeOverlay();rerender();};

/* ----- freeze / unfreeze (OTA support only, reason logged) ----- */
function own_freezeModal(iccid){if(!own_isSupport())return;const bd=own_activeB(own_b(),iccid);if(!bd)return;const un=bd.status==='frozen';
 modal(un?t('own.fz.unfreeze'):t('own.fz.freeze'),`<form id="own_fzF" data-form="own_freeze" class="stack" novalidate><input type="hidden" name="iccid" value="${esc(iccid)}">${ui.note('admin',un?t('own.fz.unP'):t('own.fz.p'))}${ui.field({id:'own_fr',label:t('own.dc.reason'),type:'textarea',rows:3})}</form>`,own_cancel()+own_submit(un?t('own.fz.unfreeze'):t('own.fz.freeze'),'own_fzF',un?'primary':'danger'));}
FORM.own_freeze=f=>{clearErrs(f);const d=formData(f);const note=String(d.own_fr||'').trim();if(!note){setErr(f,'own_fr',t('own.dc.reasonErr'));return;}const who=actorName();
 const r=own_tx(b=>{const bd=own_activeB(b,d.iccid);if(!bd)return null;const at=iso(now());if(bd.status==='frozen'){bd.status='active';bd.unfrozen_at=at;bd.unfrozen_by=who;bd.unfreeze_reason=note;own_event(b,'binding.unfrozen',{iccid:d.iccid});return 'unfreeze';}
  bd.status='frozen';bd.frozen_at=at;bd.frozen_by=who;bd.frozen_reason=note;b.transfers.forEach(tr=>{if(tr.binding_id===bd.id&&(tr.status==='pending_acceptance'||tr.status==='cooling_off')){tr.status='cancelled';tr.cancelled_at=at;tr.cancelled_by='support';}});own_event(b,'binding.frozen',{iccid:d.iccid});return 'freeze';});
 if(r)audit('ownership.binding.'+r,d.iccid,{reason:note});closeOverlay();toast(r==='freeze'?t('own.fz.done'):t('own.fz.unDone'));rerender();};

/* ===== Partner feed + webhook / API preview + criterion-18 self-check ===== */
route('own-feed',{nav:'own-feed',render(){if(!own_canSee('feed'))return own_noAccess(t('own.fd.title'));const ctx=own_ctx();const items=own_feedItems(ctx.b);const full=own_canSee('contacts');
 const pages=Math.max(1,Math.ceil(items.length/OWN_PER));const page=clamp(+S.ui.own_fpage||1,1,pages);S.ui.own_fpage=page;
 const rows=items.slice((page-1)*OWN_PER,page*OWN_PER).map(it=>{const a=own_acc(ctx.b,it.bd.owner_account_id);return{act:'own_open',arg:it.bd.iccid,cells:[it.type==='bound'?ui.badge(t('own.fd.bound'),'ok',true):ui.badge(t('own.fd.transferred'),'violet',true),`<span class="mono nowrap">${fmtIccid(it.bd.iccid)}</span>`,`<span class="mono small">${esc(it.bd.device_id||'—')}</span>`,fmtDateTime(it.at)].concat(full?[esc(a&&a.name||t('own.anonOwner'))]:[])};});
 const trs=ctx.b.transfers.filter(x=>(x.status==='pending_acceptance'||x.status==='cooling_off')&&ctx.b.bindings.some(bd=>bd.id===x.binding_id&&bd.partner_id===ctx.P));
 const trCard=trs.length?ui.card({title:t('own.fd.trT'),body:ui.table([{label:'ICCID'},{label:t('c.status')},{label:t('own.fd.trTo')},{label:t('own.fd.trAt')}],trs.map(x=>{const bd=ctx.b.bindings.find(y=>y.id===x.binding_id);return{cells:[`<span class="mono nowrap">···${esc(bd.iccid.slice(-6))}</span>`,ui.badge(t('own.trs.'+x.status),'violet'),esc(full?x.to_contact:own_maskContact(x.to_contact)),fmtDateTime(x.initiated_at)]};}))}):'';
 const feedCard=`<section class="card"><div class="hd"><h2>${t('own.fd.listT')}</h2></div>${ui.table([{label:t('own.fd.ev')},{label:'ICCID'},{label:'IMEI'},{label:t('c.date')}].concat(full?[{label:t('own.c.owner')}]:[]),rows,{empty:ui.empty('bolt',t('own.fd.emptyT'),t('own.fd.emptyP'))})}${items.length>OWN_PER?ui.pager(page,items.length,OWN_PER,'own_fpage'):''}</section>`;
 return ui.page({title:t('own.fd.title'),sub:t('own.fd.sub'),body:`<div class="stack">${feedCard}${trCard}${own_canDo('integr')?own_integrations(ctx,items):''}</div>`});}});
function own_integrations(ctx,items){const st=own_st();const role=S.ui.own_apiRole||'p_dealer';const uid=(users().find(u=>u.role===role)||{}).id;const sample=S.sims.find(s=>own_inScope(s,role,uid)&&ctx.act.get(s.iccid))||S.sims.find(s=>own_inScope(s,role,uid));
 const it=items[0];const pj=o=>`<pre class="own_json">${esc(JSON.stringify(o,null,2))}</pre>`;
 const roles=['p_admin','p_ops','p_dealer','p_installer'];
 const api=sample?pj(own_view(sample,role,ctx)):`<p class="muted small">${t('own.api.none')}</p>`;
 const hookCard=ui.card({title:t('own.wh.title'),body:`<p class="small muted">${t('own.wh.p')}</p><div class="grid2 own_g">${ui.field({id:'own_whu',label:t('own.wh.url'),value:st.hook.url,attrs:'data-act="own_hookUrl" autocomplete="off"'})}${ui.field({id:'own_whp',label:t('own.wh.profile'),type:'select',value:st.hook.profile,options:[['full',t('own.wh.full')],['technical',t('own.wh.tech')]],attrs:'data-act="own_hookProfile"'})}</div>
  <div class="grid2 own_g"><div><h3 class="own_h3">${t('own.wh.full')}</h3>${it?pj(own_hook(it,'full',ctx)):'—'}</div><div><h3 class="own_h3">${t('own.wh.tech')}</h3>${it?pj(own_hook(it,'technical',ctx)):'—'}</div></div>`});
 const apiCard=ui.card({title:t('own.api.title'),actions:`<label class="own_sr" for="own_apr">${t('own.api.as')}</label><select class="inp own_sel" id="own_apr" data-act="own_apiRole">${roles.map(r=>own_opt(r,t('own.api.as')+': '+roleName(r),role)).join('')}</select>`,body:`<p class="small muted">${t('own.api.p')}</p><p class="mono small">GET /v1/devices/${sample?esc(sample.iccid):'{iccid}'}</p>${api}`});
 const sc=own_selfCheck();const cell=r=>r.na?`<span class="faint">${t('own.sc.na')}</span>`:r.ok?`<span class="own_ok">${icon('check','sm')}${t('own.sc.ok')}</span>`:`<span class="own_no">${icon('x','sm')}${esc(r.bad.join(', '))}</span>`;
 const scCard=ui.card({title:t('own.sc.title'),body:`<p class="small muted">${t('own.sc.p')}</p>${ui.table([{label:t('own.sc.role')},{label:t('own.sc.ui')},{label:'API'},{label:t('own.sc.export')},{label:'Webhook'}],sc.map(x=>({cells:[esc(roleName(x.role))+`<br><span class="xs faint">${t('own.sc.scope',{n:x.scope})}</span>`,cell(x.res.ui),cell(x.res.api),cell(x.res.export),cell(x.res.webhook)]})))}<p class="xs faint">${t('own.sc.foot')}</p>`});
 return apiCard+hookCard+scCard;}

/* ===== Block an unredeemed activation code (4.4 p.5, criterion 17) ===== */
function own_batchKey(c){return c.reseller+'|'+c.plan+'-'+c.term+'|'+String(c.createdAt||'').slice(0,10);}
function own_codeState(c,b){const r=b.codes[c.code];if(r&&r.status==='redeemed'||c.status==='activated')return 'redeemed';if(r&&r.status==='blocked'||c.status==='void')return 'blocked';return 'new';}
route('own-codes',{nav:'own-codes',render(){if(!own_canDo('block'))return own_noAccess(t('own.cb.title'));const b=own_b();const st=own_st();const q=S.ui.own_cq||'';
 let found=[];if(q){const cq=String(q).toUpperCase().replace(/O/g,'0').replace(/[IL]/g,'1').replace(/[^0-9A-Z]/g,'');
  found=(S.codes||[]).filter(c=>cq.length>=16?c.code===cq.slice(0,16):parseCode(c.code).serial===cq.slice(-5)&&(cq.length<=5||c.code.indexOf(cq.slice(0,cq.length-5))===0)).slice(0,20);}
 const res=q?(found.length?ui.table([{label:t('own.cb.code')},{label:t('own.cb.serial')},{label:t('own.c.plan')},{label:t('own.cb.point')},{label:t('c.status')},{label:''}],found.map(c=>{const s=own_codeState(c,b);
  return{cells:[`<span class="mono nowrap">${fmtCode(c.code)}</span>`,`<span class="mono">${esc(parseCode(c.code).serial)}</span>`,esc(pkgLabel(c.plan,c.term)),esc((S.resellers||[]).find(r=>r.id===c.reseller)?.name||'—'),ui.badge(t('own.cs.'+s),{new:'info',redeemed:'ok',blocked:'bad'}[s]),s==='new'?ui.btn(t('own.cb.block'),{size:'sm',kind:'danger',act:'own_blockAsk',arg:'code|'+c.code}):`<span class="xs faint">${t('own.cb.cant.'+s)}</span>`]};})):ui.note('warn',t('own.cb.nf'))):'';
 const batches={};for(const c of S.codes||[]){if(own_codeState(c,b)!=='new')continue;const k=own_batchKey(c);batches[k]=(batches[k]||0)+1;}
 const bopts=Object.keys(batches).sort().reverse().map(k=>{const [rid,pk,d]=k.split('|');const r=(S.resellers||[]).find(x=>x.id===rid);const p=pkgSplit(pk);return [k,`${d} · ${r?r.name:'—'} · ${PLAN_NAME[p.plan]} ${termLabel(p.term)} · ${fmtNum(batches[k])}`];});
 const findCard=ui.card({title:t('own.cb.bySerial'),body:`<form id="own_cbF" data-form="own_codeFind" class="row wrap g8 own_cbf" novalidate><label class="own_sr" for="own_cq">${t('own.cb.q')}</label><input class="inp mono grow" id="own_cq" name="own_cq" value="${esc(q)}" placeholder="${esc(t('own.cb.qPh'))}" autocomplete="off"><button class="btn primary" type="submit"><span>${t('own.cb.find')}</span></button></form>${res?`<div style="margin-top:12px">${res}</div>`:''}`});
 const batchCard=ui.card({title:t('own.cb.byBatch'),body:bopts.length?`<form id="own_cbB" data-form="own_batch" class="row wrap g8 own_cbf" novalidate><label class="own_sr" for="own_cbs">${t('own.cb.batch')}</label><select class="inp grow own_sel" id="own_cbs" name="own_cbs">${bopts.map(([v,l])=>own_opt(v,l,'')).join('')}</select><button class="btn danger" type="submit"><span>${t('own.cb.blockBatch')}</span></button></form><p class="xs faint">${t('own.cb.batchP')}</p>`:`<p class="muted small">${t('own.cb.noBatch')}</p>`});
 const bl=st.codes.blocked.slice().reverse().slice(0,50);
 const hist=ui.card({title:t('own.cb.hist'),body:bl.length?ui.table([{label:t('own.cb.code')},{label:t('own.cb.serial')},{label:t('own.c.plan')},{label:t('own.dc.reason')},{label:t('own.rq.by')}],bl.map(x=>({cells:[`<span class="mono nowrap">${fmtCode(x.code)}</span>`,`<span class="mono">${esc(x.serial)}</span>`,esc(pkgLabel(x.plan,x.term)),esc(t('own.cb.r.'+x.reason)),`${esc(x.by)}<br><span class="xs faint">${fmtDateTime(x.at)}</span>`]}))):`<p class="muted small">${t('own.cb.histNone')}</p>`});
 return ui.page({title:t('own.cb.title'),sub:t('own.cb.sub'),body:`<div class="stack">${ui.note('info',`${t('own.cb.t7')}<br><i>«${esc(t('own.T7'))}»</i>`)}<div class="grid2 own_g">${findCard}${batchCard}</div>${hist}</div>`});}});
FORM.own_codeFind=f=>{S.ui.own_cq=String(formData(f).own_cq||'').trim();rerender();};
FORM.own_batch=f=>{own_blockAsk('batch|'+formData(f).own_cbs);};
function own_blockAsk(arg){const i=String(arg).indexOf('|');const mode=arg.slice(0,i),val=arg.slice(i+1);const b=own_b();
 const list=mode==='code'?(S.codes||[]).filter(c=>c.code===val):(S.codes||[]).filter(c=>own_batchKey(c)===val);const ok=list.filter(c=>own_codeState(c,b)==='new');if(!ok.length){toast(t('own.cb.nothing'),'bad');return;}
 modal(t('own.cb.confirmT'),`<form id="own_bkF" data-form="own_block" class="stack" novalidate><input type="hidden" name="arg" value="${esc(arg)}"><p>${t('own.cb.confirmP',{n:fmtNum(ok.length)})}</p>${mode==='code'?`<p class="mono">${fmtCode(val)}</p>`:''}
  ${ui.field({id:'own_br',label:t('own.dc.reason'),type:'select',options:[['lost',t('own.cb.r.lost')],['stolen',t('own.cb.r.stolen')],['other',t('own.cb.r.other')]]})}${ui.note('warn',t('own.cb.irrev'))}</form>`,own_cancel()+own_submit(t('own.cb.block'),'own_bkF','danger'));}
FORM.own_block=f=>{const d=formData(f);const i=d.arg.indexOf('|');const mode=d.arg.slice(0,i),val=d.arg.slice(i+1);const reason=['lost','stolen','other'].includes(d.own_br)?d.own_br:'other';const who=actorName();const st=own_st();
 const list=mode==='code'?(S.codes||[]).filter(c=>c.code===val):(S.codes||[]).filter(c=>own_batchKey(c)===val);let n=0;const at=iso(now());
 own_tx(b=>{list.forEach(c=>{if(own_codeState(c,b)!=='new')return;const pc=parseCode(c.code);const r=b.codes[c.code]||(b.codes[c.code]={partner:own_pc(),serial:pc.serial,plan:c.plan,term:c.term});
  Object.assign(r,{status:'blocked',blocked_at:at,blocked_by:who,blocked_reason:reason});c.status='void';c.voidAt=at;c.blockedAt=at;
  st.codes.blocked.push({code:c.code,serial:pc.serial,plan:c.plan,term:c.term,reseller:c.reseller,at,by:who,reason,mode});n++;});own_event(b,'code.blocked',{n,mode});});
 if(st.codes.blocked.length>2000)st.codes.blocked=st.codes.blocked.slice(-2000);
 audit('code.block',mode==='code'?val:val.split('|').slice(1).join(' '),{mode,n,reason});log(t('own.cb.log',{n}));closeOverlay();toast(t('own.cb.done',{n:fmtNum(n)}));rerender();};

/* ===== Dealers & installers (partner users), customer message texts ===== */
route('own-users',{nav:'own-users',render(){if(own_limited())return own_noAccess(t('own.us.title'));const st=own_st();const can=own_canDo('users');
 const cnt=u=>S.sims.reduce((a,s)=>a+((u.role==='p_dealer'?s.sold_by_user_id:s.installed_by_user_id)===u.id?1:0),0);
 const rows=st.users.map(u=>({cells:[`<b>${esc(u.name)}</b><br><span class="xs faint">${esc(u.email||'')}${u.phone?' · '+esc(u.phone):''}</span>`,esc(roleName(u.role)),fmtNum(cnt(u)),u.active!==false?ui.badge(t('own.us.active'),'ok',true):ui.badge(t('own.us.revoked'),'bad',true),
  `<span class="row g8 wrap">${can?ui.btn(u.active!==false?t('own.us.revoke'):t('own.us.restore'),{size:'sm',kind:u.active!==false?'danger':'',act:'own_userToggle',arg:u.id}):''}${S.admin?ui.btn(t('own.us.actAs'),{size:'sm',kind:'ghost',icon:'users',act:'own_as',arg:u.id}):''}</span>`]}));
 const tbl=ui.table([{label:t('own.us.user')},{label:t('own.us.role')},{label:t('own.us.devices')},{label:t('c.status')},{label:''}],rows,{empty:ui.empty('users',t('own.us.emptyT'),'')});
 const texts=ui.card({title:t('own.tx.title'),body:`<p class="small muted">${t('own.tx.p')}</p>${ui.table([{label:t('own.tx.code')},{label:t('own.tx.text')}],Array.from({length:12},(_,i)=>({cells:[`<b>T${i+1}</b>`,esc(t('own.T'+(i+1)))]})))}`});
 return ui.page({title:t('own.us.title'),sub:t('own.us.sub'),actions:can?ui.btn(t('own.us.add'),{kind:'primary',icon:'plus',act:'own_userAdd'}):'',
  body:`<div class="stack">${S.admin?'':ui.note('info',t('own.us.switchHint'))}<section class="card">${tbl}</section>${ui.note('info',t('own.us.t12'))}${texts}</div>`});}});
function own_userModal(){modal(t('own.us.add'),`<form id="own_usF" data-form="own_user" class="stack" novalidate>${ui.field({id:'own_un',label:t('own.us.name')})}${ui.field({id:'own_ue',label:'E-mail',type:'email'})}${ui.field({id:'own_up',label:t('own.us.phone'),attrs:'inputmode="tel"'})}
 ${ui.field({id:'own_ur',label:t('own.us.role'),type:'select',options:[['p_dealer',roleName('p_dealer')],['p_installer',roleName('p_installer')]]})}</form>`,own_cancel()+own_submit(t('c.create'),'own_usF'));}
FORM.own_user=f=>{clearErrs(f);const d=formData(f);let bad=false;if(!String(d.own_un).trim()){setErr(f,'own_un',t('c.required'));bad=true;}if(!own_validContact(d.own_ue)||!String(d.own_ue).includes('@')){setErr(f,'own_ue',t('own.bs.contactErr'));bad=true;}
 if(d.own_up&&!own_validContact(d.own_up)){setErr(f,'own_up',t('own.bs.contactErr'));bad=true;}if(bad)return;
 const u={id:own_id('u'),name:String(d.own_un).trim(),email:String(d.own_ue).trim(),phone:String(d.own_up||'').trim(),role:d.own_ur==='p_installer'?'p_installer':'p_dealer',active:true,createdAt:iso(now())};
 own_st().users.push(u);audit('user.create',u.role,{name:u.name,email:u.email});closeOverlay();toast(t('own.us.added',{n:esc(u.name)}));rerender();};

/* ===== OTA support: retention job (4.10), clock, T12 exemptions ===== */
function own_held(b,h){if(h.legal_hold)return true;const bd=own_activeB(b,h.iccid);if(bd&&bd.status==='frozen')return true;return b.requests.some(q=>q.iccid===h.iccid&&q.status==='disputed');}
function own_runRetention(b,o){o=o||{};const st=own_st();const at=now();const ts=iso(at);const lim=iso(new Date(at.getTime()+864e5));const P=own_pc();
 const r={at:ts,auto:!!o.auto,by:o.auto?'system':actorName(),hidden:0,erased:0,held:0,files:0,anon:0};
 b.bindings.forEach(bd=>{if(bd.partner_id===P&&bd.status==='ended'&&own_hide(b,bd,ts))r.hidden++;});
 b.history.forEach(h=>{if(h.partner_id!==P||h.state!=='hidden')return;if(own_held(b,h)){r.held++;return;}
  if(h.erase_due<=lim){h.state='erased';h.erased_at=ts;h.points=0;h.events=0;h.owner_account_id=null;r.erased++;}});   // next daily run would be after the 30-day limit
 b.requests.forEach(q=>{if(q.partner_id!==P||!q.closed_at)return;const due=iso(addMonths(q.closed_at,24));(q.files||[]).forEach(fl=>{if(!fl.deleted_at&&due<=ts){fl.deleted_at=ts;fl.name=null;r.files++;}});});
 b.bindings.forEach(bd=>{if(bd.partner_id!==P||bd.status!=='ended'||bd.anonymised_at)return;const s=own_sim(bd.iccid);const base=s&&s.paidUntil&&s.paidUntil>bd.unbound_at?s.paidUntil:bd.unbound_at;
  if(iso(addMonths(base,24))<=ts){bd.owner_account_id=null;bd.anonymised_at=ts;r.anon++;}});
 st.ret.runs.unshift(r);st.ret.runs=st.ret.runs.slice(0,30);st.ret.lastDay=own_day(at);
 audit('retention.run','4.10',{auto:r.auto,hidden:r.hidden,erased:r.erased,held:r.held,files:r.files,anon:r.anon});return r;}
route('own-ret',{nav:'own-ret',render(){if(!own_isSupport())return own_noAccess(t('own.rt.title'));const b=own_b();const st=own_st();const P=own_pc();
 const hs=b.history.filter(h=>h.partner_id===P).slice().sort((a,c)=>String(a.hidden_at)<String(c.hidden_at)?1:-1);const ts=iso(now());
 const rows=hs.map(h=>{const held=own_held(b,h);const over=h.state==='hidden'&&h.erase_due<ts&&!held;return{cells:[`<span class="mono nowrap">···${esc(h.iccid.slice(-6))}</span>`,`${fmtDate(h.from)} – ${fmtDate(h.to)}`,h.state==='erased'?'—':`${fmtNum(h.points)} / ${fmtNum(h.events)}`,
  ui.badge(t('own.rt.st.'+h.state),{visible:'info',hidden:'warn',erased:'ok'}[h.state])+(held&&h.state==='hidden'?' '+ui.badge(t('own.rt.held'),'bad'):'')+(over?' '+ui.badge(t('own.rt.overdue'),'bad'):''),
  h.state==='erased'?fmtDateTime(h.erased_at):fmtDate(h.erase_due),h.state==='erased'?'':ui.btn(h.legal_hold?t('own.rt.release'):t('own.rt.hold'),{size:'sm',kind:'ghost',act:'own_hold',arg:h.id})]};});
 const runs=st.ret.runs.slice(0,10);
 const ccs=orgCountries();
 const cfg=ui.table([{label:t('own.rt.cc')},{label:'delay_hours'},{label:'ownership_v10_enabled'}],ccs.map(cc=>{const c=own_ctyCfg(cc);return{cells:[esc(ctyName(cc)),fmtNum(own_delay(cc))+(c.delay_hours==null?` <span class="xs faint">(${t('own.rt.default')})</span>`:''),c.ownership_v10_enabled==null?`<span class="faint">${t('own.rt.unset')}</span>`:own_yes(!!c.ownership_v10_enabled)]};}));
 const ex=b.t12Exempt.filter(x=>x.partner_id===P||!x.partner_id);
 const exCard=ui.card({title:t('own.ex12.title'),actions:ui.btn(t('own.ex12.add'),{size:'sm',icon:'plus',act:'own_exemptAdd'}),body:`<p class="small muted">${t('own.ex12.p')}</p>${ex.length?ui.table([{label:t('own.bs.contact')},{label:t('own.dc.reason')},{label:t('own.rq.by')}],ex.map(x=>({cells:[`<span class="mono small">${esc(x.contact)}</span>`,esc(x.reason),`${esc(x.by)}<br><span class="xs faint">${fmtDateTime(x.at)}</span>`]}))):''}`});
 return ui.page({title:t('own.rt.title'),sub:t('own.rt.sub'),actions:ui.btn(t('own.rt.tick1'),{size:'sm',act:'own_tick',arg:1440})+ui.btn(t('own.rt.tick30'),{size:'sm',act:'own_tick',arg:1440*30})+ui.btn(t('own.rt.run'),{kind:'primary',icon:'bolt',act:'own_retRun'}),
  body:`<div class="stack">${ui.note('admin',t('own.rt.note',{d:fmtDateTime(now())}))}${ui.card({title:t('own.rt.rules'),body:`<ul class="own_rules"><li>${t('own.rt.r1')}</li><li>${t('own.rt.r2')}</li><li>${t('own.rt.r3')}</li><li>${t('own.rt.r4')}</li></ul>`})}
  <section class="card"><div class="hd"><h2>${t('own.rt.queue')}</h2></div>${ui.table([{label:'ICCID'},{label:t('own.rt.period')},{label:t('own.rt.data')},{label:t('c.status')},{label:t('own.rt.due')},{label:''}],rows,{empty:ui.empty('clock',t('own.rt.emptyT'),'')})}</section>
  ${ui.card({title:t('own.rt.runs'),body:runs.length?ui.table([{label:t('c.date')},{label:t('own.rt.by')},{label:t('own.rt.res')}],runs.map(r=>({cells:[fmtDateTime(r.at),esc(r.auto?t('own.rt.auto'):r.by),t('own.rt.resTxt',{e:r.erased,h:r.held,f:r.files,a:r.anon})]}))):`<p class="muted small">${t('own.rt.noRuns')}</p>`})}
  ${ui.card({title:t('own.rt.cfg'),body:cfg+`<p class="xs faint">${t('own.rt.cfgP')}</p>`})}${exCard}</div>`});}});
function own_holdModal(id){const h=own_b().history.find(x=>x.id===id);if(!h)return;
 modal(h.legal_hold?t('own.rt.release'):t('own.rt.hold'),`<form id="own_hdF" data-form="own_hold" class="stack" novalidate><input type="hidden" name="id" value="${esc(id)}">${h.legal_hold?'':ui.field({id:'own_hk',label:t('own.rt.holdWhy'),type:'select',options:[['dispute',t('own.rt.hk.dispute')],['incident',t('own.rt.hk.incident')],['authority',t('own.rt.hk.authority')]]})}${ui.field({id:'own_hn',label:t('own.dc.reason'),type:'textarea',rows:2})}</form>`,own_cancel()+own_submit(t('c.confirm'),'own_hdF'));}
FORM.own_hold=f=>{clearErrs(f);const d=formData(f);const note=String(d.own_hn||'').trim();if(!note){setErr(f,'own_hn',t('own.dc.reasonErr'));return;}
 const h=own_tx(b=>{const h=b.history.find(x=>x.id===d.id);if(!h)return null;h.legal_hold=!h.legal_hold;h.hold_reason=h.legal_hold?(d.own_hk||'dispute'):'';h.hold_note=note;h.hold_by=actorName();h.hold_at=iso(now());return h;});
 if(h)audit(h.legal_hold?'retention.legal_hold.on':'retention.legal_hold.off',h.iccid,{reason:h.hold_reason,note});closeOverlay();rerender();};
FORM.own_exempt=f=>{clearErrs(f);const d=formData(f);const n=own_normContact(d.own_xc);const note=String(d.own_xr||'').trim();if(!n){setErr(f,'own_xc',t('own.bs.contactErr'));return;}if(!note){setErr(f,'own_xr',t('own.dc.reasonErr'));return;}
 own_tx(b=>{b.t12Exempt.push({partner_id:own_pc(),contact:n,reason:note,by:actorName(),at:iso(now())});});audit('ownership.t12.exempt',n,{reason:note});closeOverlay();rerender();};

/* ---------- actions ---------- */
Object.assign(ACT,{
 own_q(v){own_f().q=v;S.ui.own_page=1;rerender();},
 own_st(v){own_f().st=v;S.ui.own_page=1;rerender();},
 own_page(p){S.ui.own_page=+p;rerender();},
 own_fpage(p){S.ui.own_fpage=+p;rerender();},
 own_open(iccid){own_drawer(iccid);},
 own_export(){own_export();},
 own_csvCopy(){const ta=$('#own_csv');if(ta)copyText(ta.value);},
 own_xlsx(){if(!own_canDo('export'))return;const rows=own_exportRows(own_role(),own_ctx());const head=Object.keys(rows[0]||{iccid:''});
  audit('iccid.export','own',{rows:rows.length,format:'xlsx'});cx_saveFile('ICCID_'+own_pc()+'_'+own_day(now()).replace(/-/g,'')+'.xlsx',cx_xlsx([{name:'ICCID',rows:[head].concat(rows.map(r=>head.map(h=>r[h]))),widths:head.map(h=>h==='iccid'?24:16)}]));},
 own_scan(){own_scan();},
 own_record(iccid){if(own_role()!=='p_installer')return;const s=own_sim(iccid);if(!s||s.installed_by_user_id)return;s.installed_by_user_id=own_me().id;audit('ownership.installation.record',iccid,{});toast(t('own.ic.recorded'));rerender();},
 own_bindStart(iccid){own_bindModal(iccid||'');},
 own_linkCancel(id){const l=own_tx(b=>{const l=b.bindLinks.find(x=>x.id===id&&x.status==='pending');if(l){l.status='cancelled';l.cancelled_at=iso(now());}return l;});if(l)audit('ownership.bind_link.cancel',l.iccid,{link:id});rerender();},
 own_reqNew(iccid){own_reqModal(iccid||'');},
 own_reqOpen(id){own_reqDrawer(id);},
 own_reqDecide(arg){own_decideModal(arg);},
 own_reqUpload(id){own_uploadModal(id);},
 own_reqObject(id){if(!own_isSupport())return;const q=own_tx(b=>{const q=b.requests.find(x=>x.id===id&&x.status==='cooling_off');if(q){q.objected_at=iso(now());own_dispute(b,q,q.objected_at,'owner');}return q;});closeOverlay();if(q)toast(t('own.rq.objected'));rerender();},
 own_freeze(iccid){own_freezeModal(iccid);},
 own_blockAsk(arg){own_blockAsk(arg);},
 own_retRun(){if(!own_isSupport())return;const r=own_tx(b=>own_runRetention(b,{}));toast(t('own.rt.done',{e:r.erased,h:r.held}));rerender();},
 own_tick(min){if(!own_isSupport())return;tick(+min||60);toast(t('own.rt.clock',{d:esc(fmtDateTime(now()))}));rerender();},
 own_hold(id){own_holdModal(id);},
 own_exemptAdd(){modal(t('own.ex12.add'),`<form id="own_xF" data-form="own_exempt" class="stack" novalidate>${ui.field({id:'own_xc',label:t('own.bs.contact'),placeholder:t('own.bs.contactPh')})}${ui.field({id:'own_xr',label:t('own.dc.reason'),type:'textarea',rows:2})}</form>`,own_cancel()+own_submit(t('c.confirm'),'own_xF'));},
 own_userAdd(){own_userModal();},
 own_userToggle(id){if(!own_canDo('users'))return;const u=own_st().users.find(x=>x.id===id);if(!u)return;u.active=u.active===false;audit(u.active?'user.restore':'user.revoke',u.role,{name:u.name});toast(u.active?t('own.us.restored',{n:esc(u.name)}):t('own.us.revokedT',{n:esc(u.name)}));rerender();},
 own_as(id){ACT.setActor(id);const a=actor();if(a&&own_limited(a.role))go('own');},
 own_apiRole(v){S.ui.own_apiRole=v;rerender();},
 own_hookUrl(v){own_st().hook.url=String(v||'').slice(0,300);audit('webhook.update','url',{});rerender();},
 own_hookProfile(v){own_st().hook.profile=v==='technical'?'technical':'full';audit('webhook.update','profile',{profile:own_st().hook.profile});rerender();},
});

/* ---------- route guard for Dealer / Installer / revoked users + sync on every render ---------- */
HOOKS.afterRender.push(name=>{if(!S.authed||!S.org)return;own_sync();const allowed=own_allowedRoutes();if(!allowed)return;
 $$('.side .nav a').forEach(el=>{const h=(el.getAttribute('href')||'').slice(1).split('--')[0];if(!allowed.includes(h))el.remove();});
 $$('.side .nav .sec').forEach(sec=>{let n=sec.nextElementSibling;if(!n||n.classList.contains('sec'))sec.remove();});
 if(!allowed.length){const c=$('#content');if(c)c.innerHTML=ui.page({title:t('own.revT'),body:ui.card({body:ui.empty('shield',t('own.revT'),t('own.revP'))})});return;}
 if(!allowed.includes(name))setTimeout(()=>go(allowed[0]),0);});
// "Ownership" entry on the SIM card drawer of the SIM inventory (4.7 p.1)
HOOKS.simDrawer.push(sim=>sim&&!own_limited()&&own_sim(sim.iccid)?ui.btn(t('own.d.fromSim'),{icon:'shield',act:'own_open',arg:sim.iccid}):'');

/* ================= i18n ================= */
I18N.add({
uk:{
'c.role.p_dealer':'Дилер','c.role.p_installer':'Монтажник',
'own.T1':'Підтверджую, що пристрій належить мені або його власник дозволив мені ним користуватися, і приймаю Умови використання.',
'own.T2':'Ця SIM-картка вже має власника. Зверніться до продавця пристрою.',
'own.T3':'Ми не знайшли цю SIM-картку. Перевірте номер або зверніться до продавця пристрою.',
'own.T4':'Цей пристрій уже є у вашому обліковому записі.',
'own.T5':'Пристрій додано до вашого облікового запису. Місцезнаходження та події показуються з цього моменту.',
'own.T6':'{date} до вашого облікового запису CONNECT додано пристрій. Якщо це були не ви, зверніться до служби підтримки.',
'own.T7':'Цей код не можна використати. Перевірте код або зверніться до продавця.',
'own.T8':'Після передачі: передплачений тариф залишається за пристроєм; автоподовження вашої підписки припиняється; історія за цим пристроєм стане вам недоступною і не показується новому власникові. Скасувати передачу можна протягом {N} год після того, як новий власник її прийме.',
'own.T9':'{ім’я або контакт} хоче передати вам пристрій у CONNECT. Прийміть передачу протягом 72 годин.',
'own.T10':'Передачу пристрою скасовано.',
'own.T11':'Продавець запросив відв’язку пристрою від вашого облікового запису. Якщо ви проти, натисніть «Заперечити» протягом {N} год.',
'own.T12':'Цей пристрій не можна додати до облікового запису, пов’язаного з дилером або монтажником. Зверніться до служби підтримки.',
'own.sec':'Власники пристроїв','own.otasec':'Підтримка OTA','own.nav.devices':'Пристрої та власники','own.nav.check':'Перевірка встановлення','own.nav.req':'Запити про власника','own.nav.feed':'Стрічка подій','own.nav.codes':'Блокування кодів','own.nav.users':'Дилери й монтажники','own.nav.ret':'Строки зберігання',
'own.demo':'демо','own.noAccessT':'Немає доступу','own.noAccessP':'Роль «{r}» не має доступу до цього розділу.','own.notInScope':'Цей пристрій не належить до ваших продажів чи встановлень.','own.anonOwner':'Власник (дані приховано)',
'own.revT':'Доступ закрито','own.revP':'Адмін партнера відкликав ваш доступ до кабінету. Зверніться до нього, якщо це помилка.',
'own.scope.dealer':'Ви бачите лише пристрої, які продали, і лише технічний статус: прив’язано чи ні, у мережі, тариф і строк. Контакти власників і місцезнаходження недоступні.','own.scope.installer':'Ви бачите лише пристрої, які встановили, і лише технічний статус: прив’язано чи ні, у мережі, перевірка встановлення. Контакти власників, тариф і місцезнаходження недоступні.',
'own.title':'Пристрої та власники','own.sub':'Чи прив’язав покупець SIM, чи пристрій у мережі і хто власник. Прив’язку робить лише сам покупець у клієнтському кабінеті.',
'own.export':'Експорт ICCID','own.k.devices':'Пристроїв','own.k.devicesMine':'ваші продажі / встановлення','own.k.devicesAll':'усі SIM партнера','own.k.bound':'Прив’язано','own.k.free':'Вільні','own.k.freeS':'чекають на покупця','own.k.frozen':'Заморожено','own.k.frozenS':'спір про власника','own.k.req':'Відкриті запити','own.k.reqS':'про власника',
'own.emptyMineT':'Поки немає ваших пристроїв','own.emptyMineP':'Тут з’являться пристрої, які ви продали чи встановили.',
'own.st.free':'Вільна','own.st.bound':'Прив’язано','own.st.frozen':'Заморожено','own.st.transfer':'Передача',
'own.c.device':'Пристрій','own.c.binding':'Прив’язка','own.c.online':'У мережі','own.c.check':'Перевірка','own.c.plan':'Тариф і строк','own.c.owner':'Власник',
'own.since':'з {d}','own.until':'до {d}','own.online':'У мережі','own.offline':'Не в мережі','own.search':'ICCID або IMEI',
'own.locNote':'Місцезнаходження та події пристроїв у кабінеті партнера не показуються для жодної ролі. Їх бачить лише власник — з моменту своєї прив’язки.',
'own.d.title':'Пристрій','own.d.fromSim':'Власник і прив’язка','own.soldBy':'Продав','own.instBy':'Встановив','own.saleHist':'Історія продажу','own.saleHistP':'Попередні власники: лише ім’я та дати, без контактів.',
'own.ur.transfer':'передано новому власнику','own.ur.support_reset':'знято підтримкою OTA','own.ur.owner':'відв’язано власником',
'own.tr.pending_acceptance':'Власник передає пристрій на {c} ({d}). Чекаємо, доки новий власник прийме.','own.tr.cooling_off':'Новий власник прийняв передачу; триває захисна затримка.','own.frozenNote':'Прив’язку заморожено підтримкою OTA ({r}). Передача й відв’язка недоступні.',
'own.ic.title':'Перевірка встановлення','own.ic.page':'Перевірка встановлення','own.ic.sub':'Скануйте або введіть ICCID: SIM знайдено, видано вам, IMEI у списку, пристрій у мережі. Це не прив’язка до покупця.',
'own.ic.iccid':'ICCID','own.ic.hint':'19–20 цифр, пробіли не важливі','own.ic.scan':'Сканувати штрихкод','own.ic.scanP':'Наведіть камеру на штрихкод ICCID.','own.ic.scanNo':'Сканування недоступне на цьому пристрої — введіть номер вручну.','own.ic.do':'Перевірити','own.ic.fmt':'ICCID має містити 19–20 цифр.',
'own.ic.found':'SIM знайдено','own.ic.issued':'Видано вашому партнеру','own.ic.deact':'SIM деактивовано (втрата, крадіжка або повернення)','own.ic.wl':'IMEI у списку моделі','own.ic.noImei':'SIM ще не вставлена в пристрій','own.ic.online':'Пристрій у мережі',
'own.ic.nf':'SIM не знайдено','own.ic.result':'Результат','own.ic.notBinding':'Перевірка не прив’язує SIM до покупця. Власником стає лише покупець після підтвердження кодом.','own.ic.mine':'Записано як ваше встановлення.','own.ic.record':'Записати як моє встановлення','own.ic.recorded':'Встановлення записано',
'own.ic.emptyT':'Введіть ICCID','own.ic.emptyP':'Результат перевірки з’явиться тут.',
'own.bs.btn':'Почати прив’язку для покупця','own.bs.title':'Почати прив’язку для покупця','own.bs.p':'Покупець отримає посилання й сам підтвердить прив’язку кодом. Посилання діє {h} год. Доки покупець не підтвердить, SIM залишається вільною.',
'own.bs.contact':'Телефон або e-mail покупця','own.bs.contactPh':'+380 67 000 00 00 або name@example.com','own.bs.contactHint':'Не вказуйте свій контакт чи контакт колег — таку прив’язку буде заблоковано.','own.bs.contactErr':'Вкажіть коректний телефон або e-mail.',
'own.bs.preview':'Покупець побачить і має відмітити:','own.bs.do':'Надіслати посилання','own.bs.doneT':'Посилання надіслано','own.bs.doneP':'Посилання для {c} діє {h} год.','own.bs.link':'Посилання для покупця','own.bs.copy':'Копіювати посилання','own.bs.free':'SIM залишається вільною, доки покупець не підтвердить прив’язку.','own.bs.log':'Надіслано посилання на прив’язку SIM {i}',
'own.bs.listT':'Розпочаті прив’язки','own.bs.listP':'Посилання, які ви надіслали покупцям.','own.bs.none':'Ще немає надісланих посилань.','own.bs.expires':'Діє до','own.bs.cancel':'Скасувати',
'own.bs.st.pending':'Очікує','own.bs.st.confirmed':'Підтверджено','own.bs.st.expired':'Минуло','own.bs.st.cancelled':'Скасовано',
'own.rq.title':'Запити про власника','own.rq.sub':'Зняття або перенесення прив’язки за документом про покупку чи встановлення. Розглядає підтримка OTA.','own.rq.supNote':'Режим підтримки OTA: схваліть, відхиліть або запросіть документи. Після схвалення власник отримує повідомлення і має час заперечити.',
'own.rq.btn':'Запит про власника','own.rq.new':'Новий запит про власника','own.rq.pick':'Виберіть SIM…','own.rq.pickHint':'Лише SIM із чинною прив’язкою','own.rq.contact':'Хто звернувся (контакт покупця)','own.rq.contactHint':'Телефон або e-mail людини, яка звернулася',
'own.rq.reason':'Підстава','own.rq.r.error':'Помилкова прив’язка','own.rq.r.unauthorised':'Прив’язка без дозволу власника','own.rq.r.previous_owner_unreachable':'Попередній власник недоступний',
'own.rq.action':'Що зробити','own.rq.a.unbind':'Зняти прив’язку','own.rq.a.transfer':'Перенести на заявника','own.rq.actionHint':'Після схвалення й захисної затримки','own.rq.file':'Документ про покупку або встановлення','own.rq.fileHint':'PDF або фото. Без файлу запит не надсилається.',
'own.rq.checked':'Документ перевірено','own.rq.checkedS':'Документ перевірено','own.rq.flow':'Далі: підтримка OTA розглядає запит → власник отримує повідомлення та має час заперечити → якщо заперечень немає, прив’язку знімають або переносять. Якщо власник заперечить — прив’язку заморожують до рішення підтримки.',
'own.rq.send':'Надіслати запит','own.rq.iccidErr':'Виберіть SIM із чинною прив’язкою.','own.rq.frozenErr':'Прив’язка заморожена — новий запит неможливий.','own.rq.reasonErr':'Виберіть підставу.','own.rq.fileErr':'Додайте файл документа — без нього запит не надсилається.','own.rq.checkedErr':'Підтвердьте, що документ перевірено.','own.rq.dupErr':'Для цієї SIM уже є відкритий запит.',
'own.rq.sent':'Запит {n} надіслано до підтримки OTA','own.rq.log':'Журнал','own.rq.by':'Хто','own.rq.until':'заперечення до {d}','own.rq.deadline':'Строк для заперечення','own.rq.fileDeleted':'Файл видалено за строком зберігання','own.rq.byOwner':'власник',
'own.rq.emptyT':'Запитів ще немає','own.rq.emptyP':'Запит створюють на картці SIM, якщо покупець звернувся з документом.',
'own.rq.st.submitted':'На розгляді','own.rq.st.docs_requested':'Потрібні документи','own.rq.st.cooling_off':'Час на заперечення','own.rq.st.disputed':'Спір — заморожено','own.rq.st.rejected':'Відхилено','own.rq.st.done':'Виконано','own.rq.st.cancelled':'Скасовано',
'own.rq.ev.submitted':'Запит подано','own.rq.ev.resubmitted':'Документи додано','own.rq.ev.docs_requested':'Підтримка запросила документи','own.rq.ev.approved':'Схвалено підтримкою OTA','own.rq.ev.t11':'Власнику надіслано повідомлення T11','own.rq.ev.rejected':'Відхилено','own.rq.ev.objected':'Власник заперечив — прив’язку заморожено','own.rq.ev.kept':'Заморозку знято, власник залишився','own.rq.ev.released':'Рішення: зняти прив’язку попри заперечення','own.rq.ev.executed_unbind':'Прив’язку знято (support_reset)','own.rq.ev.executed_transfer':'Прив’язку перенесено на заявника (support_reset)','own.rq.ev.cancelled':'Скасовано',
'own.rq.t11sent':'Повідомлення T11 надіслано {d} (e-mail і SMS)','own.rq.approve':'Схвалити','own.rq.reject':'Відхилити','own.rq.docs':'Запросити документи','own.rq.simObject':'Імітувати заперечення власника','own.rq.objected':'Власник заперечив — прив’язку заморожено','own.rq.keep':'Зняти заморозку, залишити власника','own.rq.release':'Зняти прив’язку','own.rq.upload':'Додати документ','own.rq.resend':'Надіслати повторно','own.rq.docsAsked':'Підтримка OTA просить документи','own.rq.disputedNote':'Власник заперечив. Прив’язку заморожено до рішення підтримки OTA.',
'own.dc.approve':'Схвалити запит','own.dc.reject':'Відхилити запит','own.dc.docs':'Запросити документи','own.dc.keep':'Залишити власника','own.dc.release':'Зняти прив’язку',
'own.dc.approveP':'Власник отримає повідомлення T11 на e-mail і телефон. Якщо протягом {h} год заперечень не буде, запит буде виконано.','own.dc.rejectP':'Запит буде закрито. Прив’язка не зміниться.','own.dc.docsP':'Партнер отримає прохання додати документи.','own.dc.keepP':'Заморозку буде знято, власник залишиться. Підставу буде записано в журнал.','own.dc.releaseP':'Прив’язку буде знято або перенесено попри заперечення. Підставу буде записано в журнал.',
'own.dc.t11':'Текст повідомлення власнику (T11):','own.dc.reason':'Підстава','own.dc.note':'Коментар','own.dc.reasonErr':'Вкажіть підставу — її буде записано в журнал.',
'own.dc.approveDo':'Схвалити й повідомити власника','own.dc.rejectDo':'Відхилити','own.dc.docsDo':'Запросити','own.dc.keepDo':'Зняти заморозку','own.dc.releaseDo':'Зняти прив’язку','own.dc.fail':'Дію неможливо виконати: стан запиту змінився.',
'own.dc.done.approve':'Запит {n} схвалено, власника повідомлено','own.dc.done.reject':'Запит {n} відхилено','own.dc.done.docs':'Документи за запитом {n} запрошено','own.dc.done.keep':'Заморозку знято','own.dc.done.release':'Прив’язку знято',
'own.fz.freeze':'Заморозити прив’язку','own.fz.unfreeze':'Зняти заморозку','own.fz.p':'Поки прив’язку заморожено, передача й відв’язка недоступні, а власник не бачить місцезнаходження. Зв’язок і сповіщення працюють.','own.fz.unP':'Прив’язка знову стане активною.','own.fz.done':'Прив’язку заморожено','own.fz.unDone':'Заморозку знято',
'own.fd.title':'Стрічка подій','own.fd.sub':'Прив’язки покупцями й передачі новим власникам. Ці ж події надходять у ваш webhook.','own.fd.listT':'Події','own.fd.ev':'Подія','own.fd.bound':'Пристрій прив’язано покупцем','own.fd.transferred':'Пристрій передано новому власнику','own.fd.emptyT':'Подій ще немає','own.fd.emptyP':'Щойно покупець прив’яже SIM, подія з’явиться тут.',
'own.fd.trT':'Передачі в процесі','own.fd.trTo':'Кому','own.fd.trAt':'Розпочато','own.trs.pending_acceptance':'Чекає на прийняття','own.trs.cooling_off':'Захисна затримка',
'own.wh.title':'Webhook','own.wh.p':'Події «Пристрій прив’язано» та «Пристрій передано» надсилаються на вашу адресу. Для ролей без доступу до контактів — лише ICCID, IMEI, дата й тип події.','own.wh.url':'Адреса webhook','own.wh.profile':'Склад даних','own.wh.full':'Адмін / Операції (з контактами)','own.wh.tech':'Дилер / Монтажник (лише технічні дані)',
'own.api.title':'API: що бачить роль','own.api.as':'Роль','own.api.p':'Відповідь API для пристрою — ті самі поля, що й в інтерфейсі. Місцезнаходження й події не повертаються для жодної ролі.','own.api.none':'У цієї ролі немає пристроїв.',
'own.sc.title':'Перевірка: місцезнаходження й події не потрапляють до ролей партнера','own.sc.p':'Автоматична перевірка чотирьох каналів: інтерфейс, API, вивантаження, webhook.','own.sc.role':'Роль','own.sc.ui':'Інтерфейс','own.sc.export':'Вивантаження','own.sc.ok':'чисто','own.sc.na':'недоступно ролі','own.sc.scope':'пристроїв: {n}','own.sc.foot':'Інші розділи кабінету для дилера й монтажника закриті.',
'own.cb.title':'Блокування кодів активації','own.cb.sub':'Заблокуйте втрачений чи викрадений непогашений код за серійним номером або всю партію.','own.cb.t7':'Покупець, який введе заблокований код, побачить:',
'own.cb.bySerial':'За серійним номером','own.cb.q':'Серійний номер або код','own.cb.qPh':'Серійний номер (5 символів) або повний код','own.cb.find':'Знайти','own.cb.nf':'Код не знайдено.','own.cb.code':'Код','own.cb.serial':'Серійний №','own.cb.point':'Точка продажу','own.cb.block':'Заблокувати код',
'own.cb.cant.redeemed':'погашено — блокування неможливе','own.cb.cant.blocked':'уже заблоковано','own.cs.new':'Не погашено','own.cs.redeemed':'Погашено','own.cs.blocked':'Заблоковано',
'own.cb.byBatch':'Усю партію','own.cb.batch':'Партія','own.cb.blockBatch':'Заблокувати партію','own.cb.batchP':'Блокуються лише непогашені коди партії. Погашені коди закріплені за пристроями й не змінюються.','own.cb.noBatch':'Немає партій із непогашеними кодами.',
'own.cb.hist':'Заблоковані коди','own.cb.histNone':'Ще нічого не заблоковано.','own.cb.confirmT':'Заблокувати коди','own.cb.confirmP':'Буде заблоковано непогашених кодів: {n}.','own.cb.irrev':'Блокування не можна скасувати. Заміну видають за Документом 03, п. 4.2.','own.cb.nothing':'Немає непогашених кодів для блокування',
'own.cb.r.lost':'Утрачено','own.cb.r.stolen':'Викрадено','own.cb.r.other':'Інше','own.cb.done':'Заблоковано кодів: {n}','own.cb.log':'Заблоковано кодів активації: {n}',
'own.us.title':'Дилери й монтажники','own.us.sub':'Користувачі кабінету, які бачать лише свої продажі чи встановлення й лише технічний статус.','own.us.add':'Додати користувача','own.us.user':'Користувач','own.us.role':'Роль','own.us.devices':'Пристроїв','own.us.active':'Активний','own.us.revoked':'Доступ відкликано',
'own.us.revoke':'Відкликати доступ','own.us.restore':'Відновити доступ','own.us.actAs':'Діяти як','own.us.emptyT':'Ще немає дилерів і монтажників','own.us.name':'Ім’я','own.us.phone':'Телефон','own.us.added':'Користувача {n} додано','own.us.restored':'Доступ {n} відновлено','own.us.revokedT':'Доступ {n} відкликано — закрито одразу',
'own.us.switchHint':'Щоб побачити кабінет очима дилера чи монтажника, увімкніть режим OTA (демо) і виберіть користувача в меню.','own.us.t12':'Контакти всіх користувачів кабінету не можна використати для прив’язки пристрою покупцем (T12). Зняти обмеження може лише підтримка OTA.',
'own.tx.title':'Повідомлення для покупців (T1–T12)','own.tx.p':'Затверджені тексти клієнтського кабінету. Їх не можна змінювати в порталі.','own.tx.code':'Код','own.tx.text':'Текст',
'own.rt.title':'Строки зберігання','own.rt.sub':'Щоденна задача: приховати й видалити історію попереднього власника після передачі чи відв’язки.','own.rt.note':'Демо: годинник кабінету — {d}. Задача запускається автоматично раз на демо-день; кнопка запускає її одразу.',
'own.rt.run':'Запустити зараз','own.rt.tick1':'+1 день','own.rt.tick30':'+30 днів','own.rt.done':'Задачу виконано: видалено {e}, пропущено через legal hold {h}','own.rt.clock':'Годинник: {d}',
'own.rt.rules':'Правила (ТЗ 4.10)','own.rt.r1':'Історія місцезнаходження й подій попереднього власника — одразу прихована, видаляється чи знеособлюється протягом 30 днів; пропускається при legal hold.','own.rt.r2':'Binding, Transfer, OwnershipRequest, погашення кодів — строк тарифу + 24 місяці, потім знеособлення.','own.rt.r3':'Журнали входів і OTP — 12 місяців (самі коди не зберігаються).','own.rt.r4':'Файли документів із запитів — до закриття запиту + 24 місяці, потім видалення.',
'own.rt.queue':'Черга історії попередніх власників','own.rt.period':'Період власника','own.rt.data':'Точок / подій','own.rt.due':'Видалити до','own.rt.st.visible':'Видима','own.rt.st.hidden':'Прихована','own.rt.st.erased':'Видалена','own.rt.held':'legal hold','own.rt.overdue':'прострочено',
'own.rt.hold':'Legal hold','own.rt.release':'Зняти legal hold','own.rt.holdWhy':'Підстава утримання','own.rt.hk.dispute':'Спір','own.rt.hk.incident':'Інцидент','own.rt.hk.authority':'Запит органу','own.rt.emptyT':'Черга порожня',
'own.rt.runs':'Запуски задачі','own.rt.by':'Хто','own.rt.res':'Результат','own.rt.auto':'автоматично (щодня)','own.rt.resTxt':'видалено {e} · legal hold {h} · файлів {f} · знеособлено {a}','own.rt.noRuns':'Ще не запускалась.',
'own.rt.cfg':'Налаштування країн','own.rt.cc':'Країна','own.rt.default':'типово','own.rt.unset':'не задано','own.rt.cfgP':'Змінюються на сторінці «Дані OTA». Затримка — від 1 до 24 год.',
'own.ex12.title':'Винятки із заборони T12','own.ex12.add':'Додати виняток','own.ex12.p':'Наприклад, монтажник сам купив пристрій. Лише підтримка OTA.',
'own.ex.title':'Експорт ICCID','own.ex.note':'Списки ICCID — конфіденційні. Не публікуйте їх і не передавайте покупцям. Експорт записано в журнал.','own.ex.p':'Рядків: {n}. Без контактів власників і без місцезнаходження.','own.ex.copy':'Копіювати CSV'},
en:{
'c.role.p_dealer':'Dealer','c.role.p_installer':'Installer',
'own.T1':'I confirm that I own this device or am authorised by its owner to use it, and I accept the End User Terms.',
'own.T2':'This SIM already has an owner. Please contact the seller of the device.',
'own.T3':'We could not find this SIM. Check the number or contact the seller of the device.',
'own.T4':'This device is already in your account.',
'own.T5':'The device has been added to your account. Location and events are shown from now on.',
'own.T6':'A device was added to your CONNECT account on {date}. If this was not you, contact support.',
'own.T7':'This code cannot be used. Check the code or contact the seller.',
'own.T8':'After the transfer: the prepaid plan stays with the device; automatic renewal of your subscription stops; your history for this device will no longer be visible to you and is not shown to the new owner. You can cancel within {N} hours after the new owner accepts.',
'own.T9':'{name or contact} wants to transfer a device to you in CONNECT. Accept within 72 hours.',
'own.T10':'The transfer of the device was cancelled.',
'own.T11':'The seller has asked to release your device from your account. If you object, tap "Object" within {N} hours.',
'own.T12':'This device cannot be added to an account linked to a dealer or installer. Contact support.',
'own.sec':'Device owners','own.otasec':'OTA support','own.nav.devices':'Devices & owners','own.nav.check':'Installation check','own.nav.req':'Ownership requests','own.nav.feed':'Event feed','own.nav.codes':'Block codes','own.nav.users':'Dealers & installers','own.nav.ret':'Data retention',
'own.demo':'demo','own.noAccessT':'No access','own.noAccessP':'The “{r}” role has no access to this section.','own.notInScope':'This device is not one of your sales or installations.','own.anonOwner':'Owner (details hidden)',
'own.revT':'Access closed','own.revP':'Your Partner Admin revoked your access to the console. Contact them if this is a mistake.',
'own.scope.dealer':'You see only devices you sold, and only their technical status: bound or not, online, plan and term. Owner contacts and location are not available.','own.scope.installer':'You see only devices you installed, and only their technical status: bound or not, online, installation check. Owner contacts, plan and location are not available.',
'own.title':'Devices & owners','own.sub':'Whether the buyer has bound the SIM, whether the device is online and who owns it. Only the buyer can bind, in the customer portal.',
'own.export':'Export ICCIDs','own.k.devices':'Devices','own.k.devicesMine':'your sales / installations','own.k.devicesAll':'all partner SIMs','own.k.bound':'Bound','own.k.free':'Free','own.k.freeS':'waiting for a buyer','own.k.frozen':'Frozen','own.k.frozenS':'ownership dispute','own.k.req':'Open requests','own.k.reqS':'ownership',
'own.emptyMineT':'No devices of yours yet','own.emptyMineP':'Devices you sold or installed will appear here.',
'own.st.free':'Free','own.st.bound':'Bound','own.st.frozen':'Frozen','own.st.transfer':'Transfer',
'own.c.device':'Device','own.c.binding':'Binding','own.c.online':'Online','own.c.check':'Check','own.c.plan':'Plan & term','own.c.owner':'Owner',
'own.since':'since {d}','own.until':'until {d}','own.online':'Online','own.offline':'Offline','own.search':'ICCID or IMEI',
'own.locNote':'Device location and events are not shown in the partner console for any role. Only the owner sees them — from the moment of their own binding.',
'own.d.title':'Device','own.d.fromSim':'Owner & binding','own.soldBy':'Sold by','own.instBy':'Installed by','own.saleHist':'Sale history','own.saleHistP':'Previous owners: name and dates only, no contacts.',
'own.ur.transfer':'transferred to a new owner','own.ur.support_reset':'released by OTA support','own.ur.owner':'unbound by the owner',
'own.tr.pending_acceptance':'The owner is transferring the device to {c} ({d}). Waiting for the new owner to accept.','own.tr.cooling_off':'The new owner accepted; the protective delay is running.','own.frozenNote':'Binding frozen by OTA support ({r}). Transfer and unbinding are not available.',
'own.ic.title':'Installation check','own.ic.page':'Installation check','own.ic.sub':'Scan or type the ICCID: SIM found, issued to you, IMEI whitelisted, device online. This is not a binding to the buyer.',
'own.ic.iccid':'ICCID','own.ic.hint':'19–20 digits, spaces don’t matter','own.ic.scan':'Scan barcode','own.ic.scanP':'Point the camera at the ICCID barcode.','own.ic.scanNo':'Scanning isn’t available on this device — type the number instead.','own.ic.do':'Check','own.ic.fmt':'An ICCID has 19–20 digits.',
'own.ic.found':'SIM found','own.ic.issued':'Issued to your company','own.ic.deact':'SIM deactivated (loss, theft or return)','own.ic.wl':'IMEI on the model whitelist','own.ic.noImei':'SIM not yet in a device','own.ic.online':'Device online',
'own.ic.nf':'SIM not found','own.ic.result':'Result','own.ic.notBinding':'The check does not bind the SIM to the buyer. Only the buyer becomes the owner, after confirming with a code.','own.ic.mine':'Recorded as your installation.','own.ic.record':'Record as my installation','own.ic.recorded':'Installation recorded',
'own.ic.emptyT':'Enter an ICCID','own.ic.emptyP':'The check result will appear here.',
'own.bs.btn':'Start binding for customer','own.bs.title':'Start binding for customer','own.bs.p':'The buyer gets a link and confirms the binding with a code. The link is valid for {h} hours. Until the buyer confirms, the SIM stays free.',
'own.bs.contact':'Buyer’s phone or e-mail','own.bs.contactPh':'+380 67 000 00 00 or name@example.com','own.bs.contactHint':'Don’t use your own or a colleague’s contact — such a binding is blocked.','own.bs.contactErr':'Enter a valid phone number or e-mail.',
'own.bs.preview':'The buyer will see and must tick:','own.bs.do':'Send link','own.bs.doneT':'Link sent','own.bs.doneP':'The link for {c} is valid for {h} hours.','own.bs.link':'Link for the buyer','own.bs.copy':'Copy link','own.bs.free':'The SIM stays free until the buyer confirms the binding.','own.bs.log':'Binding link sent for SIM {i}',
'own.bs.listT':'Bindings you started','own.bs.listP':'Links you sent to buyers.','own.bs.none':'No links sent yet.','own.bs.expires':'Valid until','own.bs.cancel':'Cancel',
'own.bs.st.pending':'Pending','own.bs.st.confirmed':'Confirmed','own.bs.st.expired':'Expired','own.bs.st.cancelled':'Cancelled',
'own.rq.title':'Ownership requests','own.rq.sub':'Release or move a binding based on a purchase or installation document. Reviewed by OTA support.','own.rq.supNote':'OTA support mode: approve, reject or ask for documents. After approval the owner is notified and has time to object.',
'own.rq.btn':'Ownership request','own.rq.new':'New ownership request','own.rq.pick':'Choose a SIM…','own.rq.pickHint':'Only SIMs with a current binding','own.rq.contact':'Who contacted you (buyer’s contact)','own.rq.contactHint':'Phone or e-mail of the person who contacted you',
'own.rq.reason':'Reason','own.rq.r.error':'Bound by mistake','own.rq.r.unauthorised':'Bound without the owner’s permission','own.rq.r.previous_owner_unreachable':'Previous owner unreachable',
'own.rq.action':'Action','own.rq.a.unbind':'Release the binding','own.rq.a.transfer':'Move to the requester','own.rq.actionHint':'After approval and the protective delay','own.rq.file':'Purchase or installation document','own.rq.fileHint':'PDF or photo. The request can’t be sent without a file.',
'own.rq.checked':'Document checked','own.rq.checkedS':'Document checked','own.rq.flow':'Next: OTA support reviews the request → the owner is notified and has time to object → with no objection the binding is released or moved. If the owner objects, the binding is frozen until support decides.',
'own.rq.send':'Send request','own.rq.iccidErr':'Choose a SIM with a current binding.','own.rq.frozenErr':'The binding is frozen — a new request isn’t possible.','own.rq.reasonErr':'Choose a reason.','own.rq.fileErr':'Attach the document file — the request can’t be sent without it.','own.rq.checkedErr':'Confirm that the document was checked.','own.rq.dupErr':'This SIM already has an open request.',
'own.rq.sent':'Request {n} sent to OTA support','own.rq.log':'Log','own.rq.by':'By','own.rq.until':'objection until {d}','own.rq.deadline':'Objection deadline','own.rq.fileDeleted':'File deleted after the retention period','own.rq.byOwner':'owner',
'own.rq.emptyT':'No requests yet','own.rq.emptyP':'Create a request on the SIM card when a buyer comes with a document.',
'own.rq.st.submitted':'Under review','own.rq.st.docs_requested':'Documents needed','own.rq.st.cooling_off':'Objection period','own.rq.st.disputed':'Dispute — frozen','own.rq.st.rejected':'Rejected','own.rq.st.done':'Done','own.rq.st.cancelled':'Cancelled',
'own.rq.ev.submitted':'Request submitted','own.rq.ev.resubmitted':'Documents added','own.rq.ev.docs_requested':'Support asked for documents','own.rq.ev.approved':'Approved by OTA support','own.rq.ev.t11':'Notice T11 sent to the owner','own.rq.ev.rejected':'Rejected','own.rq.ev.objected':'Owner objected — binding frozen','own.rq.ev.kept':'Unfrozen, owner kept','own.rq.ev.released':'Decision: release despite the objection','own.rq.ev.executed_unbind':'Binding released (support_reset)','own.rq.ev.executed_transfer':'Binding moved to the requester (support_reset)','own.rq.ev.cancelled':'Cancelled',
'own.rq.t11sent':'Notice T11 sent {d} (e-mail and SMS)','own.rq.approve':'Approve','own.rq.reject':'Reject','own.rq.docs':'Request documents','own.rq.simObject':'Simulate owner objection','own.rq.objected':'The owner objected — binding frozen','own.rq.keep':'Unfreeze, keep owner','own.rq.release':'Release binding','own.rq.upload':'Add document','own.rq.resend':'Send again','own.rq.docsAsked':'OTA support asks for documents','own.rq.disputedNote':'The owner objected. The binding is frozen until OTA support decides.',
'own.dc.approve':'Approve request','own.dc.reject':'Reject request','own.dc.docs':'Request documents','own.dc.keep':'Keep the owner','own.dc.release':'Release binding',
'own.dc.approveP':'The owner gets notice T11 by e-mail and phone. If there is no objection within {h} hours, the request is carried out.','own.dc.rejectP':'The request is closed. The binding doesn’t change.','own.dc.docsP':'The partner is asked to add documents.','own.dc.keepP':'The binding is unfrozen and the owner stays. The reason is logged.','own.dc.releaseP':'The binding is released or moved despite the objection. The reason is logged.',
'own.dc.t11':'Notice to the owner (T11):','own.dc.reason':'Reason','own.dc.note':'Comment','own.dc.reasonErr':'Enter a reason — it is written to the log.',
'own.dc.approveDo':'Approve and notify the owner','own.dc.rejectDo':'Reject','own.dc.docsDo':'Request','own.dc.keepDo':'Unfreeze','own.dc.releaseDo':'Release binding','own.dc.fail':'Can’t do this: the request has changed.',
'own.dc.done.approve':'Request {n} approved, owner notified','own.dc.done.reject':'Request {n} rejected','own.dc.done.docs':'Documents requested for {n}','own.dc.done.keep':'Binding unfrozen','own.dc.done.release':'Binding released',
'own.fz.freeze':'Freeze binding','own.fz.unfreeze':'Unfreeze','own.fz.p':'While frozen, transfer and unbinding are unavailable and the owner doesn’t see the location. Connectivity and alerts keep working.','own.fz.unP':'The binding becomes active again.','own.fz.done':'Binding frozen','own.fz.unDone':'Binding unfrozen',
'own.fd.title':'Event feed','own.fd.sub':'Bindings by buyers and transfers to new owners. The same events go to your webhook.','own.fd.listT':'Events','own.fd.ev':'Event','own.fd.bound':'Device bound by customer','own.fd.transferred':'Device transferred to a new owner','own.fd.emptyT':'No events yet','own.fd.emptyP':'When a buyer binds a SIM, the event appears here.',
'own.fd.trT':'Transfers in progress','own.fd.trTo':'To','own.fd.trAt':'Started','own.trs.pending_acceptance':'Awaiting acceptance','own.trs.cooling_off':'Protective delay',
'own.wh.title':'Webhook','own.wh.p':'“Device bound” and “Device transferred” events are sent to your endpoint. For roles without contact access: only ICCID, IMEI, date and event type.','own.wh.url':'Webhook URL','own.wh.profile':'Payload','own.wh.full':'Admin / Operations (with contacts)','own.wh.tech':'Dealer / Installer (technical only)',
'own.api.title':'API: what a role sees','own.api.as':'Role','own.api.p':'The API response for a device — the same fields as the interface. Location and events are never returned to any role.','own.api.none':'This role has no devices.',
'own.sc.title':'Check: no location or events reach partner roles','own.sc.p':'Automatic check of four channels: interface, API, export, webhook.','own.sc.role':'Role','own.sc.ui':'Interface','own.sc.export':'Export','own.sc.ok':'clean','own.sc.na':'not available to role','own.sc.scope':'devices: {n}','own.sc.foot':'Other console sections are closed to Dealers and Installers.',
'own.cb.title':'Block activation codes','own.cb.sub':'Block a lost or stolen unredeemed code by serial number, or a whole batch.','own.cb.t7':'A buyer who enters a blocked code will see:',
'own.cb.bySerial':'By serial number','own.cb.q':'Serial number or code','own.cb.qPh':'Serial number (5 characters) or full code','own.cb.find':'Find','own.cb.nf':'Code not found.','own.cb.code':'Code','own.cb.serial':'Serial No.','own.cb.point':'Point of sale','own.cb.block':'Block code',
'own.cb.cant.redeemed':'redeemed — can’t be blocked','own.cb.cant.blocked':'already blocked','own.cs.new':'Not redeemed','own.cs.redeemed':'Redeemed','own.cs.blocked':'Blocked',
'own.cb.byBatch':'Whole batch','own.cb.batch':'Batch','own.cb.blockBatch':'Block batch','own.cb.batchP':'Only unredeemed codes of the batch are blocked. Redeemed codes stay pinned to their devices.','own.cb.noBatch':'No batches with unredeemed codes.',
'own.cb.hist':'Blocked codes','own.cb.histNone':'Nothing blocked yet.','own.cb.confirmT':'Block codes','own.cb.confirmP':'Unredeemed codes to block: {n}.','own.cb.irrev':'Blocking can’t be undone. Replacements are issued under Document 03, clause 4.2.','own.cb.nothing':'No unredeemed codes to block',
'own.cb.r.lost':'Lost','own.cb.r.stolen':'Stolen','own.cb.r.other':'Other','own.cb.done':'Codes blocked: {n}','own.cb.log':'Activation codes blocked: {n}',
'own.us.title':'Dealers & installers','own.us.sub':'Console users who see only their own sales or installations, and only the technical status.','own.us.add':'Add user','own.us.user':'User','own.us.role':'Role','own.us.devices':'Devices','own.us.active':'Active','own.us.revoked':'Access revoked',
'own.us.revoke':'Revoke access','own.us.restore':'Restore access','own.us.actAs':'Act as','own.us.emptyT':'No dealers or installers yet','own.us.name':'Name','own.us.phone':'Phone','own.us.added':'User {n} added','own.us.restored':'Access restored for {n}','own.us.revokedT':'Access revoked for {n} — closed immediately',
'own.us.switchHint':'To see the console as a dealer or installer, turn on OTA mode (demo) and pick the user in the menu.','own.us.t12':'The contacts of all console users can’t be used by a buyer to bind a device (T12). Only OTA support can lift this.',
'own.tx.title':'Customer messages (T1–T12)','own.tx.p':'Approved texts of the customer portal. They can’t be edited in the portal.','own.tx.code':'Code','own.tx.text':'Text',
'own.rt.title':'Data retention','own.rt.sub':'Daily job: hide and erase the previous owner’s history after a transfer or unbinding.','own.rt.note':'Demo: console clock — {d}. The job runs automatically once per demo day; the button runs it now.',
'own.rt.run':'Run now','own.rt.tick1':'+1 day','own.rt.tick30':'+30 days','own.rt.done':'Job done: erased {e}, skipped for legal hold {h}','own.rt.clock':'Clock: {d}',
'own.rt.rules':'Rules (ТЗ 4.10)','own.rt.r1':'Previous owner’s location and event history — hidden at once, erased or anonymised within 30 days; skipped under legal hold.','own.rt.r2':'Binding, Transfer, OwnershipRequest, code redemptions — plan term + 24 months, then anonymised.','own.rt.r3':'Sign-in and OTP logs — 12 months (codes themselves are not stored).','own.rt.r4':'Document files from requests — until the request closes + 24 months, then deleted.',
'own.rt.queue':'Previous owners’ history queue','own.rt.period':'Owner period','own.rt.data':'Points / events','own.rt.due':'Erase by','own.rt.st.visible':'Visible','own.rt.st.hidden':'Hidden','own.rt.st.erased':'Erased','own.rt.held':'legal hold','own.rt.overdue':'overdue',
'own.rt.hold':'Legal hold','own.rt.release':'Release legal hold','own.rt.holdWhy':'Hold reason','own.rt.hk.dispute':'Dispute','own.rt.hk.incident':'Incident','own.rt.hk.authority':'Authority request','own.rt.emptyT':'Queue is empty',
'own.rt.runs':'Job runs','own.rt.by':'By','own.rt.res':'Result','own.rt.auto':'automatic (daily)','own.rt.resTxt':'erased {e} · legal hold {h} · files {f} · anonymised {a}','own.rt.noRuns':'Hasn’t run yet.',
'own.rt.cfg':'Country settings','own.rt.cc':'Country','own.rt.default':'default','own.rt.unset':'not set','own.rt.cfgP':'Edited on the “OTA data” page. Delay: 1 to 24 hours.',
'own.ex12.title':'Exceptions to the T12 ban','own.ex12.add':'Add exception','own.ex12.p':'For example, an installer bought the device for themselves. OTA support only.',
'own.ex.title':'Export ICCIDs','own.ex.note':'ICCID lists are confidential. Don’t publish them or hand them to buyers. This export is logged.','own.ex.p':'Rows: {n}. No owner contacts, no location.','own.ex.copy':'Copy CSV'},
ru:{
'c.role.p_dealer':'Дилер','c.role.p_installer':'Монтажник',
'own.T1':'Подтверждаю, что устройство принадлежит мне или его собственник разрешил мне им пользоваться, и принимаю Условия использования.',
'own.T2':'У этой SIM-карты уже есть владелец. Обратитесь к продавцу устройства.',
'own.T3':'Мы не нашли эту SIM-карту. Проверьте номер или обратитесь к продавцу устройства.',
'own.T4':'Это устройство уже есть в вашей учётной записи.',
'own.T5':'Устройство добавлено в вашу учётную запись. Местоположение и события показываются с этого момента.',
'own.T6':'{date} в вашу учётную запись CONNECT добавлено устройство. Если это были не вы, обратитесь в поддержку.',
'own.T7':'Этот код нельзя использовать. Проверьте код или обратитесь к продавцу.',
'own.T8':'После передачи: предоплаченный тариф остаётся за устройством; автопродление вашей подписки прекращается; история по этому устройству станет вам недоступна и не показывается новому владельцу. Отменить передачу можно в течение {N} ч после того, как новый владелец её примет.',
'own.T9':'{имя или контакт} хочет передать вам устройство в CONNECT. Примите передачу в течение 72 часов.',
'own.T10':'Передача устройства отменена.',
'own.T11':'Продавец запросил отвязку устройства от вашей учётной записи. Если вы против, нажмите «Возразить» в течение {N} ч.',
'own.T12':'Это устройство нельзя добавить в учётную запись, связанную с дилером или монтажником. Обратитесь в поддержку.',
'own.sec':'Владельцы устройств','own.otasec':'Поддержка OTA','own.nav.devices':'Устройства и владельцы','own.nav.check':'Проверка установки','own.nav.req':'Запросы о владении','own.nav.feed':'Лента событий','own.nav.codes':'Блокировка кодов','own.nav.users':'Дилеры и монтажники','own.nav.ret':'Сроки хранения',
'own.demo':'демо','own.noAccessT':'Нет доступа','own.noAccessP':'У роли «{r}» нет доступа к этому разделу.','own.notInScope':'Это устройство не относится к вашим продажам или установкам.','own.anonOwner':'Владелец (данные скрыты)',
'own.revT':'Доступ закрыт','own.revP':'Админ партнёра отозвал ваш доступ к кабинету. Обратитесь к нему, если это ошибка.',
'own.scope.dealer':'Вы видите только проданные вами устройства и только технический статус: привязано или нет, в сети, тариф и срок. Контакты владельцев и местоположение недоступны.','own.scope.installer':'Вы видите только установленные вами устройства и только технический статус: привязано или нет, в сети, проверка установки. Контакты владельцев, тариф и местоположение недоступны.',
'own.title':'Устройства и владельцы','own.sub':'Привязал ли покупатель SIM, в сети ли устройство и кто владелец. Привязку делает только сам покупатель в клиентском кабинете.',
'own.export':'Экспорт ICCID','own.k.devices':'Устройств','own.k.devicesMine':'ваши продажи / установки','own.k.devicesAll':'все SIM партнёра','own.k.bound':'Привязано','own.k.free':'Свободные','own.k.freeS':'ждут покупателя','own.k.frozen':'Заморожено','own.k.frozenS':'спор о владении','own.k.req':'Открытые запросы','own.k.reqS':'о владении',
'own.emptyMineT':'Пока нет ваших устройств','own.emptyMineP':'Здесь появятся устройства, которые вы продали или установили.',
'own.st.free':'Свободна','own.st.bound':'Привязано','own.st.frozen':'Заморожено','own.st.transfer':'Передача',
'own.c.device':'Устройство','own.c.binding':'Привязка','own.c.online':'В сети','own.c.check':'Проверка','own.c.plan':'Тариф и срок','own.c.owner':'Владелец',
'own.since':'с {d}','own.until':'до {d}','own.online':'В сети','own.offline':'Не в сети','own.search':'ICCID или IMEI',
'own.locNote':'Местоположение и события устройств в кабинете партнёра не показываются ни для одной роли. Их видит только владелец — с момента своей привязки.',
'own.d.title':'Устройство','own.d.fromSim':'Владелец и привязка','own.soldBy':'Продал','own.instBy':'Установил','own.saleHist':'История продажи','own.saleHistP':'Прежние владельцы: только имя и даты, без контактов.',
'own.ur.transfer':'передано новому владельцу','own.ur.support_reset':'снято поддержкой OTA','own.ur.owner':'отвязано владельцем',
'own.tr.pending_acceptance':'Владелец передаёт устройство на {c} ({d}). Ждём, пока новый владелец примет.','own.tr.cooling_off':'Новый владелец принял передачу; идёт защитная задержка.','own.frozenNote':'Привязка заморожена поддержкой OTA ({r}). Передача и отвязка недоступны.',
'own.ic.title':'Проверка установки','own.ic.page':'Проверка установки','own.ic.sub':'Отсканируйте или введите ICCID: SIM найдена, выдана вам, IMEI в списке, устройство в сети. Это не привязка к покупателю.',
'own.ic.iccid':'ICCID','own.ic.hint':'19–20 цифр, пробелы не важны','own.ic.scan':'Сканировать штрихкод','own.ic.scanP':'Наведите камеру на штрихкод ICCID.','own.ic.scanNo':'Сканирование недоступно на этом устройстве — введите номер вручную.','own.ic.do':'Проверить','own.ic.fmt':'ICCID содержит 19–20 цифр.',
'own.ic.found':'SIM найдена','own.ic.issued':'Выдана вашей компании','own.ic.deact':'SIM деактивирована (утрата, хищение или возврат)','own.ic.wl':'IMEI в списке модели','own.ic.noImei':'SIM ещё не вставлена в устройство','own.ic.online':'Устройство в сети',
'own.ic.nf':'SIM не найдена','own.ic.result':'Результат','own.ic.notBinding':'Проверка не привязывает SIM к покупателю. Владельцем становится только покупатель после подтверждения кодом.','own.ic.mine':'Записано как ваша установка.','own.ic.record':'Записать как мою установку','own.ic.recorded':'Установка записана',
'own.ic.emptyT':'Введите ICCID','own.ic.emptyP':'Результат проверки появится здесь.',
'own.bs.btn':'Начать привязку для покупателя','own.bs.title':'Начать привязку для покупателя','own.bs.p':'Покупатель получит ссылку и сам подтвердит привязку кодом. Ссылка действует {h} ч. Пока покупатель не подтвердил, SIM остаётся свободной.',
'own.bs.contact':'Телефон или e-mail покупателя','own.bs.contactPh':'+380 67 000 00 00 или name@example.com','own.bs.contactHint':'Не указывайте свой контакт или контакт коллег — такая привязка будет заблокирована.','own.bs.contactErr':'Укажите корректный телефон или e-mail.',
'own.bs.preview':'Покупатель увидит и должен отметить:','own.bs.do':'Отправить ссылку','own.bs.doneT':'Ссылка отправлена','own.bs.doneP':'Ссылка для {c} действует {h} ч.','own.bs.link':'Ссылка для покупателя','own.bs.copy':'Копировать ссылку','own.bs.free':'SIM остаётся свободной, пока покупатель не подтвердит привязку.','own.bs.log':'Отправлена ссылка на привязку SIM {i}',
'own.bs.listT':'Начатые привязки','own.bs.listP':'Ссылки, которые вы отправили покупателям.','own.bs.none':'Ссылок пока нет.','own.bs.expires':'Действует до','own.bs.cancel':'Отменить',
'own.bs.st.pending':'Ожидает','own.bs.st.confirmed':'Подтверждено','own.bs.st.expired':'Истекла','own.bs.st.cancelled':'Отменена',
'own.rq.title':'Запросы о владении','own.rq.sub':'Снятие или перенос привязки по документу о покупке или установке. Рассматривает поддержка OTA.','own.rq.supNote':'Режим поддержки OTA: одобрите, отклоните или запросите документы. После одобрения владелец получает уведомление и может возразить.',
'own.rq.btn':'Запрос о владении','own.rq.new':'Новый запрос о владении','own.rq.pick':'Выберите SIM…','own.rq.pickHint':'Только SIM с действующей привязкой','own.rq.contact':'Кто обратился (контакт покупателя)','own.rq.contactHint':'Телефон или e-mail обратившегося',
'own.rq.reason':'Основание','own.rq.r.error':'Ошибочная привязка','own.rq.r.unauthorised':'Привязка без разрешения владельца','own.rq.r.previous_owner_unreachable':'Прежний владелец недоступен',
'own.rq.action':'Что сделать','own.rq.a.unbind':'Снять привязку','own.rq.a.transfer':'Перенести на заявителя','own.rq.actionHint':'После одобрения и защитной задержки','own.rq.file':'Документ о покупке или установке','own.rq.fileHint':'PDF или фото. Без файла запрос не отправляется.',
'own.rq.checked':'Документ проверен','own.rq.checkedS':'Документ проверен','own.rq.flow':'Дальше: поддержка OTA рассматривает запрос → владелец получает уведомление и может возразить → если возражений нет, привязку снимают или переносят. Если владелец возразит — привязку замораживают до решения поддержки.',
'own.rq.send':'Отправить запрос','own.rq.iccidErr':'Выберите SIM с действующей привязкой.','own.rq.frozenErr':'Привязка заморожена — новый запрос невозможен.','own.rq.reasonErr':'Выберите основание.','own.rq.fileErr':'Приложите файл документа — без него запрос не отправляется.','own.rq.checkedErr':'Подтвердите, что документ проверен.','own.rq.dupErr':'По этой SIM уже есть открытый запрос.',
'own.rq.sent':'Запрос {n} отправлен в поддержку OTA','own.rq.log':'Журнал','own.rq.by':'Кто','own.rq.until':'возражение до {d}','own.rq.deadline':'Срок для возражения','own.rq.fileDeleted':'Файл удалён по сроку хранения','own.rq.byOwner':'владелец',
'own.rq.emptyT':'Запросов пока нет','own.rq.emptyP':'Запрос создают на карточке SIM, если покупатель обратился с документом.',
'own.rq.st.submitted':'На рассмотрении','own.rq.st.docs_requested':'Нужны документы','own.rq.st.cooling_off':'Время на возражение','own.rq.st.disputed':'Спор — заморожено','own.rq.st.rejected':'Отклонён','own.rq.st.done':'Выполнен','own.rq.st.cancelled':'Отменён',
'own.rq.ev.submitted':'Запрос подан','own.rq.ev.resubmitted':'Документы добавлены','own.rq.ev.docs_requested':'Поддержка запросила документы','own.rq.ev.approved':'Одобрено поддержкой OTA','own.rq.ev.t11':'Владельцу отправлено уведомление T11','own.rq.ev.rejected':'Отклонено','own.rq.ev.objected':'Владелец возразил — привязка заморожена','own.rq.ev.kept':'Заморозка снята, владелец остался','own.rq.ev.released':'Решение: снять привязку несмотря на возражение','own.rq.ev.executed_unbind':'Привязка снята (support_reset)','own.rq.ev.executed_transfer':'Привязка перенесена на заявителя (support_reset)','own.rq.ev.cancelled':'Отменено',
'own.rq.t11sent':'Уведомление T11 отправлено {d} (e-mail и SMS)','own.rq.approve':'Одобрить','own.rq.reject':'Отклонить','own.rq.docs':'Запросить документы','own.rq.simObject':'Имитировать возражение владельца','own.rq.objected':'Владелец возразил — привязка заморожена','own.rq.keep':'Снять заморозку, оставить владельца','own.rq.release':'Снять привязку','own.rq.upload':'Добавить документ','own.rq.resend':'Отправить повторно','own.rq.docsAsked':'Поддержка OTA просит документы','own.rq.disputedNote':'Владелец возразил. Привязка заморожена до решения поддержки OTA.',
'own.dc.approve':'Одобрить запрос','own.dc.reject':'Отклонить запрос','own.dc.docs':'Запросить документы','own.dc.keep':'Оставить владельца','own.dc.release':'Снять привязку',
'own.dc.approveP':'Владелец получит уведомление T11 на e-mail и телефон. Если в течение {h} ч возражений не будет, запрос будет выполнен.','own.dc.rejectP':'Запрос будет закрыт. Привязка не изменится.','own.dc.docsP':'Партнёр получит просьбу добавить документы.','own.dc.keepP':'Заморозка будет снята, владелец останется. Основание будет записано в журнал.','own.dc.releaseP':'Привязка будет снята или перенесена несмотря на возражение. Основание будет записано в журнал.',
'own.dc.t11':'Текст уведомления владельцу (T11):','own.dc.reason':'Основание','own.dc.note':'Комментарий','own.dc.reasonErr':'Укажите основание — оно будет записано в журнал.',
'own.dc.approveDo':'Одобрить и уведомить владельца','own.dc.rejectDo':'Отклонить','own.dc.docsDo':'Запросить','own.dc.keepDo':'Снять заморозку','own.dc.releaseDo':'Снять привязку','own.dc.fail':'Действие невозможно: состояние запроса изменилось.',
'own.dc.done.approve':'Запрос {n} одобрен, владелец уведомлён','own.dc.done.reject':'Запрос {n} отклонён','own.dc.done.docs':'Документы по запросу {n} запрошены','own.dc.done.keep':'Заморозка снята','own.dc.done.release':'Привязка снята',
'own.fz.freeze':'Заморозить привязку','own.fz.unfreeze':'Снять заморозку','own.fz.p':'Пока привязка заморожена, передача и отвязка недоступны, а владелец не видит местоположение. Связь и уведомления работают.','own.fz.unP':'Привязка снова станет активной.','own.fz.done':'Привязка заморожена','own.fz.unDone':'Заморозка снята',
'own.fd.title':'Лента событий','own.fd.sub':'Привязки покупателями и передачи новым владельцам. Эти же события приходят в ваш webhook.','own.fd.listT':'События','own.fd.ev':'Событие','own.fd.bound':'Устройство привязано покупателем','own.fd.transferred':'Устройство передано новому владельцу','own.fd.emptyT':'Событий пока нет','own.fd.emptyP':'Как только покупатель привяжет SIM, событие появится здесь.',
'own.fd.trT':'Передачи в процессе','own.fd.trTo':'Кому','own.fd.trAt':'Начата','own.trs.pending_acceptance':'Ждёт принятия','own.trs.cooling_off':'Защитная задержка',
'own.wh.title':'Webhook','own.wh.p':'События «Устройство привязано» и «Устройство передано» отправляются на ваш адрес. Для ролей без доступа к контактам — только ICCID, IMEI, дата и тип события.','own.wh.url':'Адрес webhook','own.wh.profile':'Состав данных','own.wh.full':'Админ / Операции (с контактами)','own.wh.tech':'Дилер / Монтажник (только технические данные)',
'own.api.title':'API: что видит роль','own.api.as':'Роль','own.api.p':'Ответ API по устройству — те же поля, что и в интерфейсе. Местоположение и события не возвращаются ни одной роли.','own.api.none':'У этой роли нет устройств.',
'own.sc.title':'Проверка: местоположение и события не попадают к ролям партнёра','own.sc.p':'Автоматическая проверка четырёх каналов: интерфейс, API, выгрузка, webhook.','own.sc.role':'Роль','own.sc.ui':'Интерфейс','own.sc.export':'Выгрузка','own.sc.ok':'чисто','own.sc.na':'недоступно роли','own.sc.scope':'устройств: {n}','own.sc.foot':'Остальные разделы кабинета для дилера и монтажника закрыты.',
'own.cb.title':'Блокировка кодов активации','own.cb.sub':'Заблокируйте утерянный или похищенный непогашенный код по серийному номеру или всю партию.','own.cb.t7':'Покупатель, который введёт заблокированный код, увидит:',
'own.cb.bySerial':'По серийному номеру','own.cb.q':'Серийный номер или код','own.cb.qPh':'Серийный номер (5 символов) или полный код','own.cb.find':'Найти','own.cb.nf':'Код не найден.','own.cb.code':'Код','own.cb.serial':'Серийный №','own.cb.point':'Точка продаж','own.cb.block':'Заблокировать код',
'own.cb.cant.redeemed':'погашен — блокировка невозможна','own.cb.cant.blocked':'уже заблокирован','own.cs.new':'Не погашен','own.cs.redeemed':'Погашен','own.cs.blocked':'Заблокирован',
'own.cb.byBatch':'Всю партию','own.cb.batch':'Партия','own.cb.blockBatch':'Заблокировать партию','own.cb.batchP':'Блокируются только непогашенные коды партии. Погашенные коды закреплены за устройствами и не меняются.','own.cb.noBatch':'Нет партий с непогашенными кодами.',
'own.cb.hist':'Заблокированные коды','own.cb.histNone':'Пока ничего не заблокировано.','own.cb.confirmT':'Заблокировать коды','own.cb.confirmP':'Будет заблокировано непогашенных кодов: {n}.','own.cb.irrev':'Блокировку нельзя отменить. Замену выдают по Документу 03, п. 4.2.','own.cb.nothing':'Нет непогашенных кодов для блокировки',
'own.cb.r.lost':'Утерян','own.cb.r.stolen':'Похищен','own.cb.r.other':'Другое','own.cb.done':'Заблокировано кодов: {n}','own.cb.log':'Заблокировано кодов активации: {n}',
'own.us.title':'Дилеры и монтажники','own.us.sub':'Пользователи кабинета, которые видят только свои продажи или установки и только технический статус.','own.us.add':'Добавить пользователя','own.us.user':'Пользователь','own.us.role':'Роль','own.us.devices':'Устройств','own.us.active':'Активен','own.us.revoked':'Доступ отозван',
'own.us.revoke':'Отозвать доступ','own.us.restore':'Вернуть доступ','own.us.actAs':'Действовать как','own.us.emptyT':'Дилеров и монтажников пока нет','own.us.name':'Имя','own.us.phone':'Телефон','own.us.added':'Пользователь {n} добавлен','own.us.restored':'Доступ {n} восстановлен','own.us.revokedT':'Доступ {n} отозван — закрыт сразу',
'own.us.switchHint':'Чтобы увидеть кабинет глазами дилера или монтажника, включите режим OTA (демо) и выберите пользователя в меню.','own.us.t12':'Контакты всех пользователей кабинета нельзя использовать для привязки устройства покупателем (T12). Снять ограничение может только поддержка OTA.',
'own.tx.title':'Сообщения для покупателей (T1–T12)','own.tx.p':'Утверждённые тексты клиентского кабинета. Менять их в портале нельзя.','own.tx.code':'Код','own.tx.text':'Текст',
'own.rt.title':'Сроки хранения','own.rt.sub':'Ежедневная задача: скрыть и удалить историю прежнего владельца после передачи или отвязки.','own.rt.note':'Демо: часы кабинета — {d}. Задача запускается автоматически раз в демо-день; кнопка запускает её сразу.',
'own.rt.run':'Запустить сейчас','own.rt.tick1':'+1 день','own.rt.tick30':'+30 дней','own.rt.done':'Задача выполнена: удалено {e}, пропущено из-за legal hold {h}','own.rt.clock':'Часы: {d}',
'own.rt.rules':'Правила (ТЗ 4.10)','own.rt.r1':'История местоположения и событий прежнего владельца — сразу скрыта, удаляется или обезличивается в течение 30 дней; пропускается при legal hold.','own.rt.r2':'Binding, Transfer, OwnershipRequest, погашение кодов — срок тарифа + 24 месяца, затем обезличивание.','own.rt.r3':'Журналы входов и OTP — 12 месяцев (сами коды не хранятся).','own.rt.r4':'Файлы документов из запросов — до закрытия запроса + 24 месяца, затем удаление.',
'own.rt.queue':'Очередь истории прежних владельцев','own.rt.period':'Период владельца','own.rt.data':'Точек / событий','own.rt.due':'Удалить до','own.rt.st.visible':'Видима','own.rt.st.hidden':'Скрыта','own.rt.st.erased':'Удалена','own.rt.held':'legal hold','own.rt.overdue':'просрочено',
'own.rt.hold':'Legal hold','own.rt.release':'Снять legal hold','own.rt.holdWhy':'Основание удержания','own.rt.hk.dispute':'Спор','own.rt.hk.incident':'Инцидент','own.rt.hk.authority':'Запрос органа','own.rt.emptyT':'Очередь пуста',
'own.rt.runs':'Запуски задачи','own.rt.by':'Кто','own.rt.res':'Результат','own.rt.auto':'автоматически (ежедневно)','own.rt.resTxt':'удалено {e} · legal hold {h} · файлов {f} · обезличено {a}','own.rt.noRuns':'Ещё не запускалась.',
'own.rt.cfg':'Настройки стран','own.rt.cc':'Страна','own.rt.default':'по умолчанию','own.rt.unset':'не задано','own.rt.cfgP':'Меняются на странице «Данные OTA». Задержка — от 1 до 24 ч.',
'own.ex12.title':'Исключения из запрета T12','own.ex12.add':'Добавить исключение','own.ex12.p':'Например, монтажник сам купил устройство. Только поддержка OTA.',
'own.ex.title':'Экспорт ICCID','own.ex.note':'Списки ICCID конфиденциальны. Не публикуйте их и не передавайте покупателям. Экспорт записан в журнал.','own.ex.p':'Строк: {n}. Без контактов владельцев и без местоположения.','own.ex.copy':'Копировать CSV'}});
