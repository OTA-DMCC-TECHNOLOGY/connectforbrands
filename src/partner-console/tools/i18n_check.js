// Translation tools for the partner console UI.
//   node tools/i18n_check.js split            → i18n_src/parts/part1..6.json (English source, ~410 keys each)
//   (part7.json = keys added/changed after the first split — legal pack v10; later parts follow the same pattern)
//   node tools/i18n_check.js merge <code>     → i18n_work/<code>/part*.json → i18n/<code>.json, then check
//   node tools/i18n_check.js check [<code>…]  → validate i18n/<code>.json against i18n_src/en.json (all files if none given)
// Checks: every key present, no extra keys, non-empty strings, identical {placeholder} sets,
// identical HTML tag sequence, Latin-script languages contain no Cyrillic, programme name starts with "CONNECT ".
const fs=require('fs'),path=require('path');
const dir=path.join(__dirname,'..');const EN=JSON.parse(fs.readFileSync(dir+'/i18n_src/en.json','utf8'));
const CYR=new Set(['uk','ru','bg','mk','sr','kk','ky','tg']);const OWN_SCRIPT=new Set(['el','hy','ka']);
const ph=s=>(String(s).match(/\{[a-zA-Z0-9_]+\}/g)||[]).sort().join(' ');
const tags=s=>(String(s).match(/<\/?[a-z][a-z0-9]*/gi)||[]).map(x=>x.toLowerCase()).join(' ');
function check(code){const f=dir+'/i18n/'+code+'.json';const errs=[],warns=[];let d;
 try{d=JSON.parse(fs.readFileSync(f,'utf8'));}catch(e){return {code,errs:['cannot read/parse '+f+': '+e.message],warns};}
 for(const k in EN){const v=d[k];
  if(v==null){errs.push('missing: '+k);continue;}
  if(typeof v!=='string'||!v.trim()){errs.push('empty/non-string: '+k);continue;}
  if(ph(v)!==ph(EN[k]))errs.push(`placeholders differ: ${k}  en[${ph(EN[k])}] ${code}[${ph(v)}]`);
  if(tags(v)!==tags(EN[k]))errs.push(`HTML tags differ: ${k}`);
  if(!CYR.has(code)&&/[Ѐ-ӿ]/.test(v)&&!/[Ѐ-ӿ]/.test(EN[k]))errs.push('Cyrillic in a non-Cyrillic language: '+k);
  if(v===EN[k]&&/[a-z]{4,}\s+[a-z]{4,}/i.test(v)&&!/^[A-Z0-9 .,:;()\/+\-–—·#%$*{}@_'"’“”«»]+$/.test(v))warns.push('same as English: '+k);}
 for(const k in d)if(!(k in EN))errs.push('extra key: '+k);
 if(d['c.program']&&!/^CONNECT /.test(d['c.program']))errs.push('c.program must start with "CONNECT "');
 return {code,errs,warns,keys:Object.keys(d).length};}
function report(r){console.log(`${r.code}: ${r.errs.length?'FAIL':'OK'}  keys=${r.keys||0}/${Object.keys(EN).length}  errors=${r.errs.length}  same-as-English=${r.warns.length}`);
 r.errs.slice(0,40).forEach(e=>console.log('  ✗ '+e));if(r.errs.length>40)console.log('  … '+(r.errs.length-40)+' more');
 if(r.warns.length>60)console.log('  ! many strings left in English: '+r.warns.slice(0,10).join(', ')+' …');}
const [cmd,...args]=process.argv.slice(2);
if(cmd==='split'){const ks=Object.keys(EN);const n=6,sz=Math.ceil(ks.length/n);fs.mkdirSync(dir+'/i18n_src/parts',{recursive:true});
 for(let i=0;i<n;i++){const o={};ks.slice(i*sz,(i+1)*sz).forEach(k=>o[k]=EN[k]);fs.writeFileSync(`${dir}/i18n_src/parts/part${i+1}.json`,JSON.stringify(o,null,1)+'\n');console.log('part'+(i+1),Object.keys(o).length);}}
else if(cmd==='merge'){const code=args[0];const wd=dir+'/i18n_work/'+code;const o={};
 for(const f of fs.readdirSync(wd).filter(f=>/^part\d+\.json$/.test(f)).sort()){try{Object.assign(o,JSON.parse(fs.readFileSync(wd+'/'+f,'utf8')));}catch(e){console.log('✗ '+f+': '+e.message);process.exit(1);}}
 const out={};for(const k of Object.keys(EN))if(k in o)out[k]=o[k]; // keys no longer in the English source are dropped
 fs.mkdirSync(dir+'/i18n',{recursive:true});fs.writeFileSync(dir+'/i18n/'+code+'.json',JSON.stringify(out,null,0)+'\n');
 const r=check(code);report(r);process.exit(r.errs.length?1:0);}
else if(cmd==='check'){const codes=args.length?args:fs.readdirSync(dir+'/i18n').filter(f=>f.endsWith('.json')).map(f=>f.slice(0,-5)).sort();
 let bad=0;for(const c of codes){const r=check(c);report(r);if(r.errs.length)bad++;}console.log(`${codes.length} languages, ${bad} failing`);process.exit(bad?1:0);}
else console.log('usage: split | merge <code> | check [<code>…]');
