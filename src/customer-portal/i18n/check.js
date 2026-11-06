// usage: node check.js xx [yy ...]
const fs=require('fs');const uk=JSON.parse(fs.readFileSync(__dirname+'/uk.json'));
let ok=true;for(const l of process.argv.slice(2)){let d;try{d=JSON.parse(fs.readFileSync(__dirname+'/'+l+'.json'));}catch(e){console.log(l,'INVALID JSON',e.message);ok=false;continue;}
const miss=Object.keys(uk).filter(k=>!(k in d));const extra=Object.keys(d).filter(k=>!(k in uk)&&k!=='day_forms');
const ph=Object.keys(uk).filter(k=>k in d).filter(k=>{const a=(uk[k].match(/\{\w+\}/g)||[]).sort().join();const b=(String(d[k]).match(/\{\w+\}/g)||[]).sort().join();return a!==b;});
const df=d.day_forms&&typeof d.day_forms==='object'&&d.day_forms.other;
console.log(l,'missing:',miss.length,miss.slice(0,5).join(','),'extra:',extra.join(','),'placeholder mismatch:',ph.join(','),'day_forms:',!!df);
if(miss.length||ph.length||!df)ok=false;}
process.exit(ok?0:1);
