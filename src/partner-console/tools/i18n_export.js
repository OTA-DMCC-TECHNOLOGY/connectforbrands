// Extract the built-in UI dictionaries (uk/en/ru) from the sources into i18n_src/<lang>.json.
// i18n_src/en.json is the source for every other language in i18n/<code>.json.
// Run from anywhere: node src/partner-console/tools/i18n_export.js
const fs=require('fs'),vm=require('vm'),path=require('path');
const dir=path.join(__dirname,'..');
const files=['src/01_core.js','src/02_shared.js',...fs.readdirSync(dir+'/src/modules').filter(f=>f.endsWith('.js')).sort().map(f=>'src/modules/'+f)];
const out={};
const I18N={add(o){for(const l in o)out[l]=Object.assign(out[l]||{},o[l]);}};
for(const f of files){const s=fs.readFileSync(dir+'/'+f,'utf8');
 // 1) literal I18N.add({...}) calls (balanced-bracket scan; non-literal calls are skipped)
 let i=0;while((i=s.indexOf('I18N.add(',i))>=0){let j=i+9,d=0,q=null;
  for(;j<s.length;j++){const c=s[j];if(q){if(c==='\\'){j++;continue;}if(c===q)q=null;continue;}
   if(c==='"'||c==="'"||c==='`'){q=c;continue;}if('({['.includes(c))d++;if(')}]'.includes(c)){if(d===0)break;d--;}}
  try{I18N.add(vm.runInNewContext('('+s.slice(i+9,j)+')',{}));}catch(e){}i=j;}
 // 2) row tables: (function(){const R=[[key,uk,en,ru],...];...I18N.add(o);})();
 i=0;const END='I18N.add(o);})();';while((i=s.indexOf('(function(){const R=[',i))>=0){const j=s.indexOf(END,i);if(j<0)break;
  vm.runInNewContext(s.slice(i,j+END.length),{I18N});i=j+END.length;}}
// English titles of legal documents (uk/ru have lg.tt.*; English comes from the templates)
const ctx={HOOKS:{onBoot:[]},S:{}};
vm.runInNewContext(fs.readFileSync(dir+'/src/modules/60_legal_templates.js','utf8')+';this.__T=LEGAL_TPL;',ctx);
for(const k in ctx.__T){const ti=ctx.__T[k].title;if(ti&&ti.en)out.en['lg.tt.'+k]=ti.en;}
out.en['lg.tt.CHG']='Notice of Change of Partner Details';
fs.mkdirSync(dir+'/i18n_src',{recursive:true});
for(const l of ['en','uk','ru']){const o={};for(const k of Object.keys(out[l]).sort())o[k]=out[l][k];
 fs.writeFileSync(dir+'/i18n_src/'+l+'.json',JSON.stringify(o,null,1)+'\n');console.log(l,Object.keys(o).length,'keys');}
