// Translation tools for the customer (end-user) portal.
//   node tools/i18n_check.js missing <code>  → i18n_work/<code>/portal_src.json (English strings missing in i18n/<code>.json)
//   node tools/i18n_check.js merge <code>    → i18n_work/<code>/portal.json merged into i18n/<code>.json, then check
//   node tools/i18n_check.js check [<code>…] → validate i18n/<code>.json against i18n_base/en.json
// Checks: identical {placeholder} sets, identical HTML tags, non-empty strings, no Cyrillic in Latin-script languages,
// nested plural objects (e.g. day_forms) keep their shape.
const fs=require('fs'),path=require('path');
const dir=path.join(__dirname,'..');const EN=JSON.parse(fs.readFileSync(dir+'/i18n_base/en.json','utf8'));
const CYR=new Set(['uk','ru','bg','mk','sr','kk','ky','tg']);
const ph=s=>(String(s).match(/\{[a-zA-Z0-9_]+\}/g)||[]).sort().join(' ');
const tags=s=>(String(s).match(/<\/?[a-z][a-z0-9]*/gi)||[]).map(x=>x.toLowerCase()).join(' ');
const file=c=>{const a=dir+'/i18n/'+c+'.json',b=dir+'/i18n_base/'+c+'.json';return fs.existsSync(a)?a:b;};
function check(code){const errs=[];let d;try{d=JSON.parse(fs.readFileSync(file(code),'utf8'));}catch(e){return{code,errs:['cannot read: '+e.message],miss:0};}
 let miss=0;
 for(const k in EN){const e=EN[k],v=d[k];if(v==null){miss++;continue;}
  if(typeof e!=='string'){if(typeof v!=='object'||Array.isArray(v))errs.push('shape: '+k);continue;}
  if(typeof v!=='string'||!v.trim()){errs.push('empty/non-string: '+k);continue;}
  if(ph(v)!==ph(e))errs.push(`placeholders differ: ${k} en[${ph(e)}] ${code}[${ph(v)}]`);
  if(tags(v)!==tags(e))errs.push('HTML tags differ: '+k);
  if(!CYR.has(code)&&/[Ѐ-ӿ]/.test(v)&&!/[Ѐ-ӿ]/.test(e))errs.push('Cyrillic in a non-Cyrillic language: '+k);}
 return{code,errs,miss,total:Object.keys(EN).length};}
function report(r){console.log(`${r.code}: ${r.errs.length?'FAIL':'OK'}  missing=${r.miss}/${r.total}  errors=${r.errs.length}`);r.errs.slice(0,40).forEach(e=>console.log('  ✗ '+e));}
const [cmd,...args]=process.argv.slice(2);
if(cmd==='missing'){const code=args[0];const d=JSON.parse(fs.readFileSync(file(code),'utf8'));const o={};
 for(const k in EN)if(d[k]==null)o[k]=EN[k];const wd=dir+'/i18n_work/'+code;fs.mkdirSync(wd,{recursive:true});
 fs.writeFileSync(wd+'/portal_src.json',JSON.stringify(o,null,1)+'\n');console.log(code,Object.keys(o).length,'missing keys →',wd+'/portal_src.json');}
else if(cmd==='merge'){const code=args[0];const f=file(code);const d=JSON.parse(fs.readFileSync(f,'utf8'));
 const w=JSON.parse(fs.readFileSync(dir+'/i18n_work/'+code+'/portal.json','utf8'));for(const k in w)if(k in EN)d[k]=w[k];
 fs.writeFileSync(f,JSON.stringify(d,null,1)+'\n');const r=check(code);report(r);process.exit(r.errs.length||r.miss?1:0);}
else if(cmd==='check'){const codes=args.length?args:fs.readdirSync(dir+'/i18n').filter(f=>f.endsWith('.json')).map(f=>f.slice(0,-5)).sort();
 let bad=0;for(const c of codes){const r=check(c);report(r);if(r.errs.length)bad++;}console.log(`${codes.length} languages, ${bad} failing`);process.exit(bad?1:0);}
else console.log('usage: missing <code> | merge <code> | check [<code>…]');
