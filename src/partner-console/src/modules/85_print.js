/* ===== Print materials (ТЗ «Печатные материалы партнёра» v1.4) — owner: print materials agent =====
   Brand profile (versioned draft → submitted → approved by OTA), PartnerPlans, live previews of A1 A2 B1 B2 C1 C2 C3 and the brand-rules
   sheet at physical size (with / without zones), pre-release auto-checks (overflow, stress set, QR self-decode, sizes, logo, contrast,
   wording), versioned releases OTA-PPP-PRN-{type}-{NNN}-v{N}, card batches (12-char Crockford Base32 codes + 12-digit serials) with a
   one-time variable-print CSV, blocking by serial / range / batch, shipment labels A1/A2.
   Print texts come ONLY from the reference templates (uk/ru/kk/en/pl/de); a missing string renders PRN_WTA.
   Self-contained encoders: QR (byte mode, ECC M, v1–10) with a matrix self-decoder, Code 128 (B/C).
   Globals other modules / the portal may copy: prnCodeGen(), prnCodeCheck(s), prnCodeNorm(s), prnCodeFmt(s), prnRedeem(raw, iccid). */

const PRN_TPL_VER='1.4';
const PRN_WTA='[wording to be approved]';
const PRN_TYPES=['0','A1','A2','B1','B2','C1','C2','C3'];
const PRN_REL_TYPES=['A1','A2','B1','B2','C1','C2','C3'];
const PRN_PX_MM=96/25.4;                       // CSS px per mm
// physical trim size (mm), design units per mm of the reference template, corner radius (mm)
const PRN_SZ={A1:{w:210,h:297,ppm:96/25.4,r:0},A2:{w:210,h:297,ppm:96/25.4,r:0},B1:{w:85.6,h:54,ppm:10,r:3.2},B2:{w:85.6,h:54,ppm:10,r:3.2},
 C1:{w:58,h:85,ppm:520/58,r:2.45},C2:{w:58,h:85,ppm:520/58,r:2.45},C3:{w:900/9.2,h:760/9.2,ppm:9.2,r:0}};
// partner module sizes (ТЗ 4.2): logo field H × up to W, QR side (mm)
const PRN_SPEC={A1:{logo:[15,45]},A2:{logo:[15,45]},B1:{logo:[10,30],qr:19,prog:2.6},B2:{logo:[6,20],prog:2.1},C1:{logo:[12,36],qr:18,prog:5.8},C2:{logo:[7.5,22],prog:2.3},C3:{logo:[10,10]}};
const PRN_CARD_LANGS={UA:['uk'],KZ:['kk','ru'],DE:['de']};
const PRN_SLEEVE_LANGS=['uk','ru','kk','de','pl','en'];
const PRN_SLEEVE_DEF={UA:'uk',KZ:'ru',DE:'de'};
const PRN_PKG={light:'Light',std:'Standard',prem:'Premium'};
const PRN_CAP=0.727;                           // Inter cap height / em (wordmark height approximation)
const PRN_INK2='#404040',PRN_INK3='#767676';
const PRN_DEF_ACCENT='#1F5FD1',PRN_DEF_INK='#22262C';

/* ---------- activation code format (ТЗ 5.1, coordinator decision) ----------
   12 Crockford Base32 chars (0-9 A-Z without I L O U): 11 random (crypto.getRandomValues) + 1 Luhn mod 32 check char. */
const PRN_B32='0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function prnCodeNorm(s){return String(s==null?'':s).toUpperCase().replace(/[\s\-‐-―_.]/g,'').replace(/O/g,'0').replace(/[IL]/g,'1');}
function prn_luhnChar(body){let f=2,sum=0;for(let i=body.length-1;i>=0;i--){const v=PRN_B32.indexOf(body[i]);if(v<0)return null;let a=f*v;f=f===2?1:2;a=Math.floor(a/32)+a%32;sum+=a;}return PRN_B32[(32-sum%32)%32];}
function prnCodeCheck(s){const c=prnCodeNorm(s);if(c.length!==12||/[^0-9A-HJKMNP-TV-Z]/.test(c))return false;return prn_luhnChar(c.slice(0,11))===c[11];}
function prnCodeGen(){const r=new Uint32Array(11);(window.crypto||window.msCrypto).getRandomValues(r);let b='';for(let i=0;i<11;i++)b+=PRN_B32[r[i]%32];return b+prn_luhnChar(b);}
function prnCodeFmt(c){c=prnCodeNorm(c);return c.length===12?c.slice(0,4)+'-'+c.slice(4,8)+'-'+c.slice(8):c;}
function prn_isNewCode(c){return !!c&&!!c.batchId;}
function prn_serialFmt(n){const s=String(n).padStart(12,'0');return s.slice(0,4)+' '+s.slice(4,8)+' '+s.slice(8);}
function prn_mask(code){const c=prnCodeNorm(code);return '••••-••••-'+c.slice(8);}
const PRN_SERIAL_BASE=100000000000;
function prn_serialAlloc(qty){const key='PRN-SERIAL';S.seq=S.seq||{};let n=S.seq[key]||0;const g=gStore();g.seq=g.seq||{};n=Math.max(n,g.seq[key]||0);
 const from=n+1;n+=qty;S.seq[key]=n;g.seq[key]=n;gSave(g);return PRN_SERIAL_BASE+from;}

/* ---------- QR encoder: byte mode, ECC M, versions 1–10 (portal QR is https://{domain}) ---------- */
const PRN_QR_M={1:[10,[[1,16]]],2:[16,[[1,28]]],3:[26,[[1,44]]],4:[18,[[2,32]]],5:[24,[[2,43]]],6:[16,[[4,27]]],7:[18,[[4,31]]],8:[22,[[2,38],[2,39]]],9:[22,[[3,36],[2,37]]],10:[26,[[4,43],[1,44]]]};
const PRN_QR_AL={1:[],2:[6,18],3:[6,22],4:[6,26],5:[6,30],6:[6,34],7:[6,22,38],8:[6,24,42],9:[6,26,46],10:[6,28,50]};
function prn_gmul(x,y){let z=0;for(let i=7;i>=0;i--){z=(z<<1)^((z>>>7)*0x11D);z^=((y>>>i)&1)*x;}return z&255;}
function prn_rsDiv(deg){const r=new Array(deg).fill(0);r[deg-1]=1;let root=1;for(let i=0;i<deg;i++){for(let j=0;j<r.length;j++){r[j]=prn_gmul(r[j],root);if(j+1<r.length)r[j]^=r[j+1];}root=prn_gmul(root,2);}return r;}
function prn_rsRem(data,div){const r=div.map(()=>0);for(const b of data){const f=b^r.shift();r.push(0);div.forEach((c,i)=>{r[i]^=prn_gmul(c,f);});}return r;}
function prn_qrDataCw(v){return PRN_QR_M[v][1].reduce((a,[n,d])=>a+n*d,0);}
function prn_qrFunc(v){const n=17+4*v;const f=[];for(let y=0;y<n;y++)f.push(new Array(n).fill(false));const m=[];for(let y=0;y<n;y++)m.push(new Array(n).fill(false));
 const set=(x,y,d)=>{if(x<0||y<0||x>=n||y>=n)return;m[y][x]=d;f[y][x]=true;};
 for(let i=0;i<n;i++){set(6,i,i%2===0);set(i,6,i%2===0);}
 const finder=(cx,cy)=>{for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const d=Math.max(Math.abs(dx),Math.abs(dy));set(cx+dx,cy+dy,d!==2&&d!==4);}};
 finder(3,3);finder(n-4,3);finder(3,n-4);
 const al=PRN_QR_AL[v];al.forEach((ay,i)=>al.forEach((ax,j)=>{if((i===0&&j===0)||(i===0&&j===al.length-1)||(i===al.length-1&&j===0))return;for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)set(ax+dx,ay+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1);}));
 // reserve format + version areas (written later), dark module
 for(let i=0;i<9;i++){if(!f[8][i])set(i,8,false);if(!f[i][8])set(8,i,false);}
 for(let i=0;i<8;i++){set(n-1-i,8,false);set(8,n-1-i,false);}set(8,n-8,true);
 if(v>=7){for(let i=0;i<18;i++){const a=n-11+i%3,b=Math.floor(i/3);set(a,b,false);set(b,a,false);}}
 return{n,m,f};}
function prn_qrFormatBits(mask){const data=(0<<3)|mask;let r=data;for(let i=0;i<10;i++)r=(r<<1)^((r>>>9)*0x537);return ((data<<10)|r)^0x5412;}
function prn_qrDrawFormat(m,n,mask){const b=prn_qrFormatBits(mask);const bit=i=>((b>>>i)&1)!==0;
 for(let i=0;i<=5;i++)m[i][8]=bit(i);m[7][8]=bit(6);m[8][8]=bit(7);m[8][7]=bit(8);for(let i=9;i<15;i++)m[8][14-i]=bit(i);
 for(let i=0;i<8;i++)m[8][n-1-i]=bit(i);for(let i=8;i<15;i++)m[n-15+i][8]=bit(i);m[n-8][8]=true;}
function prn_qrDrawVersion(m,n,v){if(v<7)return;let r=v;for(let i=0;i<12;i++)r=(r<<1)^((r>>>11)*0x1F25);const b=(v<<12)|r;for(let i=0;i<18;i++){const d=((b>>>i)&1)!==0;const a=n-11+i%3,c=Math.floor(i/3);m[c][a]=d;m[a][c]=d;}}
const PRN_QR_MASKS=[(x,y)=>(x+y)%2===0,(x,y)=>y%2===0,(x,y)=>x%3===0,(x,y)=>(x+y)%3===0,(x,y)=>(Math.floor(x/3)+Math.floor(y/2))%2===0,(x,y)=>x*y%2+x*y%3===0,(x,y)=>(x*y%2+x*y%3)%2===0,(x,y)=>((x+y)%2+x*y%3)%2===0];
function prn_qrOrder(n,f){const out=[];for(let right=n-1;right>=1;right-=2){if(right===6)right=5;for(let vert=0;vert<n;vert++)for(let j=0;j<2;j++){const x=right-j;const up=((right+1)&2)===0;const y=up?n-1-vert:vert;if(!f[y][x])out.push([x,y]);}}return out;}
function prn_qrPenalty(m,n){let p=0;const line=get=>{let run=1,prev=get(0);for(let i=1;i<n;i++){const c=get(i);if(c===prev){run++;if(run===5)p+=3;else if(run>5)p++;}else{run=1;prev=c;}}};
 for(let y=0;y<n;y++)line(i=>m[y][i]);for(let x=0;x<n;x++)line(i=>m[i][x]);
 for(let y=0;y<n-1;y++)for(let x=0;x<n-1;x++){const c=m[y][x];if(c===m[y][x+1]&&c===m[y+1][x]&&c===m[y+1][x+1])p+=3;}
 const pats=[[1,0,1,1,1,0,1,0,0,0,0],[0,0,0,0,1,0,1,1,1,0,1]];const fl=get=>{for(let i=0;i+11<=n;i++)for(const pt of pats){let ok=true;for(let k=0;k<11;k++)if((get(i+k)?1:0)!==pt[k]){ok=false;break;}if(ok)p+=40;}};
 for(let y=0;y<n;y++)fl(i=>m[y][i]);for(let x=0;x<n;x++)fl(i=>m[i][x]);
 let dark=0;for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(m[y][x])dark++;const tot=n*n;p+=Math.max(0,Math.ceil(Math.abs(dark*20-tot*10)/tot)-1)*10;return p;}
function prnQr(text){const bytes=Array.from(new TextEncoder().encode(String(text)));let v=1;
 for(;v<=10;v++){const cap=prn_qrDataCw(v)*8;if(4+(v<10?8:16)+bytes.length*8<=cap)break;}if(v>10)return null;
 const cap=prn_qrDataCw(v)*8;const bits=[];const put=(val,len)=>{for(let i=len-1;i>=0;i--)bits.push((val>>>i)&1);};
 put(4,4);put(bytes.length,v<10?8:16);bytes.forEach(b=>put(b,8));put(0,Math.min(4,cap-bits.length));while(bits.length%8)bits.push(0);
 const data=[];for(let i=0;i<bits.length;i+=8){let b=0;for(let k=0;k<8;k++)b=(b<<1)|bits[i+k];data.push(b);}for(let pad=0xEC;data.length<cap/8;pad^=0xEC^0x11)data.push(pad);
 const [ec,groups]=PRN_QR_M[v];const div=prn_rsDiv(ec);const blocks=[];let k=0;groups.forEach(([cnt,dl])=>{for(let i=0;i<cnt;i++){const d=data.slice(k,k+dl);k+=dl;blocks.push({d,e:prn_rsRem(d,div)});}});
 const cw=[];const maxD=Math.max(...blocks.map(b=>b.d.length));for(let i=0;i<maxD;i++)blocks.forEach(b=>{if(i<b.d.length)cw.push(b.d[i]);});for(let i=0;i<ec;i++)blocks.forEach(b=>cw.push(b.e[i]));
 const base=prn_qrFunc(v);const n=base.n;const order=prn_qrOrder(n,base.f);let best=null;
 for(let mask=0;mask<8;mask++){const m=base.m.map(r=>r.slice());order.forEach(([x,y],i)=>{const bit=i<cw.length*8?((cw[i>>>3]>>>(7-(i&7)))&1)===1:false;m[y][x]=bit!==PRN_QR_MASKS[mask](x,y);});
  prn_qrDrawFormat(m,n,mask);prn_qrDrawVersion(m,n,v);const pen=prn_qrPenalty(m,n);if(!best||pen<best.pen)best={m,pen,mask};}
 return{version:v,size:n,mask:best.mask,mods:best.m,ecl:'M'};}
// self-decoder from the module matrix: reads format info, unmasks, de-interleaves, verifies Reed–Solomon syndromes, parses byte mode
function prnQrDecodeMatrix(m){try{const n=m.length;const v=(n-17)/4;if(!PRN_QR_M[v])return null;
 let raw=0;const rd=(y,x)=>m[y][x]?1:0;const fb=[];for(let i=0;i<=5;i++)fb[i]=rd(i,8);fb[6]=rd(7,8);fb[7]=rd(8,8);fb[8]=rd(8,7);for(let i=9;i<15;i++)fb[i]=rd(8,14-i);
 for(let i=14;i>=0;i--)raw=(raw<<1)|fb[i];
 let best=-1,bd=99;for(let ecl=0;ecl<4;ecl++)for(let mask=0;mask<8;mask++){const data=(ecl<<3)|mask;let r=data;for(let i=0;i<10;i++)r=(r<<1)^((r>>>9)*0x537);const code=((data<<10)|r)^0x5412;let x=code^raw,d=0;while(x){d+=x&1;x>>>=1;}if(d<bd){bd=d;best=data;}}
 if(bd>3||(best>>>3)!==0)return null;const mask=best&7;
 const base=prn_qrFunc(v);const order=prn_qrOrder(n,base.f);const total=PRN_QR_M[v][1].reduce((a,[c,d])=>a+c*(d+PRN_QR_M[v][0]),0);
 const cw=new Array(total).fill(0);order.forEach(([x,y],i)=>{if(i>=total*8)return;const bit=(m[y][x]?1:0)^(PRN_QR_MASKS[mask](x,y)?1:0);cw[i>>>3]|=bit<<(7-(i&7));});
 const [ec,groups]=PRN_QR_M[v];const lens=[];groups.forEach(([c,d])=>{for(let i=0;i<c;i++)lens.push(d);});const blocks=lens.map(()=>[]);let k=0;
 const maxD=Math.max(...lens);for(let i=0;i<maxD;i++)lens.forEach((l,b)=>{if(i<l)blocks[b].push(cw[k++]);});for(let i=0;i<ec;i++)lens.forEach((l,b)=>{blocks[b].push(cw[k++]);});
 // syndromes: codeword polynomial evaluated at α^i must be 0 (no error correction attempted → a clean self-decode)
 let alpha=1;const pw=[];for(let i=0;i<ec;i++){pw.push(alpha);alpha=prn_gmul(alpha,2);}
 for(const b of blocks)for(const a of pw){let s=0;for(const c of b)s=prn_gmul(s,a)^c;if(s!==0)return null;}
 const data=[];blocks.forEach((b,i)=>data.push(...b.slice(0,lens[i])));const bits=[];data.forEach(b=>{for(let i=7;i>=0;i--)bits.push((b>>>i)&1);});
 let p=0;const take=l=>{let x=0;for(let i=0;i<l;i++)x=(x<<1)|bits[p++];return x;};if(take(4)!==4)return null;const len=take(v<10?8:16);const out=[];for(let i=0;i<len;i++)out.push(take(8));
 return new TextDecoder().decode(new Uint8Array(out));}catch(e){return null;}}
// SVG with a 2-module quiet zone inside the file (ТЗ 2: «поле 2 модуля в файле»)
function prnQrSvg(text,o){o=o||{};const q=prnQr(text);if(!q)return '';const qz=o.quiet==null?2:o.quiet;const n=q.size+qz*2;let d='';
 for(let y=0;y<q.size;y++){let x=0;while(x<q.size){if(!q.mods[y][x]){x++;continue;}let e=x;while(e<q.size&&q.mods[y][e])e++;d+=`M${x+qz} ${y+qz}h${e-x}v1h${x-e}z`;x=e;}}
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="100%" height="100%" shape-rendering="crispEdges" data-qr="${esc(text)}" role="img" aria-label="QR ${esc(text)}"><rect width="${n}" height="${n}" fill="#FFFFFF"/><path d="${d}" fill="${o.color||'#000'}"/></svg>`;}

/* ---------- Code 128 encoder (subset C for digit pairs, subset B otherwise) ---------- */
const PRN_C128=['212222','222122','222221','121223','121322','131222','122213','122312','132212','221213','221312','231212','112232','122132','122231','113222','123122','123221','223211','221132','221231','213212','223112','312131','311222','321122','321221','312212','322112','322211','212123','212321','232121','111323','131123','131321','112313','132113','132311','211313','231113','231311','112133','112331','132131','113123','113321','133121','313121','211331','231131','213113','213311','213131','311123','311321','331121','312113','312311','332111','314111','221411','431111','111224','111422','121124','121421','141122','141221','112214','112412','122114','122411','142112','142211','241211','221114','413111','241112','134111','111242','121142','121241','114212','124112','124211','411212','421112','421211','212141','214121','412121','111143','111341','131141','114113','114311','411113','411311','113141','114131','311141','411131','211412','211214','211232','2331112'];
function prnC128Values(text){text=String(text);const vals=[];const digits=/^\d+$/.test(text);
 if(digits&&text.length>=4){vals.push(105);const ev=text.length-text.length%2;for(let i=0;i<ev;i+=2)vals.push(+text.slice(i,i+2));if(ev<text.length){vals.push(100);vals.push(text.charCodeAt(ev)-32);}}
 else{vals.push(104);for(const ch of text){const c=ch.charCodeAt(0);if(c<32||c>126)return null;vals.push(c-32);}}
 let sum=vals[0];for(let i=1;i<vals.length;i++)sum+=vals[i]*i;vals.push(sum%103);vals.push(106);return vals;}
function prnC128Svg(text,o){o=o||{};const vals=prnC128Values(text);if(!vals)return '';const qz=10;let x=qz,d='';
 vals.forEach(v=>{const p=PRN_C128[v];for(let i=0;i<p.length;i++){const w=+p[i];if(i%2===0)d+=`M${x} 0h${w}v1h${-w}z`;x+=w;}});const W=x+qz;
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 1" preserveAspectRatio="none" width="100%" height="100%" shape-rendering="crispEdges" data-c128="${esc(text)}" role="img" aria-label="Code 128 ${esc(text)}"><rect width="${W}" height="1" fill="#FFFFFF"/><path d="${d}" fill="#000"/></svg>`;}
function prnC128Modules(text){const v=prnC128Values(text);return v?v.reduce((a,x)=>a+PRN_C128[x].split('').reduce((s,c)=>s+ +c,0),0)+20:0;}

/* ---------- demo logos (invented; one colour, vector) ---------- */
const PRN_LOGOS={
 arv_sq:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill="#22262C" fill-rule="evenodd" d="M50 2 L90 68 L10 68 Z M50 30 L69 60 L31 60 Z"/><text x="50" y="98" text-anchor="middle" font-family="Inter, Arial, Helvetica, sans-serif" font-weight="800" font-size="25" textLength="98" lengthAdjust="spacingAndGlyphs" fill="#22262C">ARVELO</text></svg>',
 arv_wide:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 100"><path fill="#22262C" fill-rule="evenodd" d="M50 4 L96 96 L4 96 Z M50 40 L72 84 L28 84 Z"/><text x="118" y="88" font-family="Inter, Arial, Helvetica, sans-serif" font-weight="800" font-size="86" textLength="478" lengthAdjust="spacingAndGlyphs" fill="#22262C">ARVELO</text></svg>',
 sb_wide:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 100"><rect x="2" y="2" width="96" height="96" rx="18" fill="#22262C"/><path fill="#FFFFFF" d="M30 30h40v12H42v6h28v22H30V58h28v-6H30z"/><text x="114" y="74" font-family="Inter, Arial, Helvetica, sans-serif" font-weight="800" font-size="62" textLength="484" lengthAdjust="spacingAndGlyphs" fill="#22262C">SUPERBRAND AUTO</text></svg>',
 sb_sq:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="14" y="0" width="72" height="72" rx="14" fill="#22262C"/><path fill="#FFFFFF" d="M34 18h32v9H44v5h22v22H34v-9h22v-5H34z"/><text x="50" y="96" text-anchor="middle" font-family="Inter, Arial, Helvetica, sans-serif" font-weight="800" font-size="16" textLength="98" lengthAdjust="spacingAndGlyphs" fill="#22262C">SUPERBRAND AUTO</text></svg>'};
function prn_logoUri(svg){return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg||'');}

/* ---------- logo checks (ТЗ 2, 7.2.5): vector, no raster, one colour, wordmark letter height ≥ 1.2 mm in the C2 field ---------- */
function prn_logoCheck(svg){const r={ok:false,errs:[],warns:[],vb:null,texts:0,hasWordmark:false,wordmarkMm:null,colors:[],clean:''};
 if(!svg||!/<svg[\s>]/i.test(svg)){r.errs.push('notsvg');return r;}
 let doc;try{doc=new DOMParser().parseFromString(svg,'image/svg+xml');}catch(e){r.errs.push('parse');return r;}
 const root=doc.documentElement;if(!root||root.nodeName.toLowerCase()!=='svg'||doc.getElementsByTagName('parsererror').length){r.errs.push('parse');return r;}
 const all=[...root.getElementsByTagName('*')];
 if(all.some(e=>/^(image|foreignobject)$/i.test(e.localName))||/data:image\/(png|jpe?g|gif|webp|bmp)/i.test(svg))r.errs.push('raster');
 all.concat([root]).forEach(e=>{[...e.attributes].forEach(a=>{if(/^on/i.test(a.name)||(/href$/i.test(a.name)&&!/^#/.test(a.value)))e.removeAttribute(a.name);});});
 [...root.getElementsByTagName('script')].forEach(s=>s.remove());
 let vb=(root.getAttribute('viewBox')||'').trim().split(/[\s,]+/).map(Number);
 if(vb.length!==4||vb.some(x=>!isFinite(x))||vb[2]<=0||vb[3]<=0){const w=parseFloat(root.getAttribute('width')),h=parseFloat(root.getAttribute('height'));if(w>0&&h>0){vb=[0,0,w,h];root.setAttribute('viewBox','0 0 '+w+' '+h);}else{r.errs.push('size');vb=null;}}
 if(vb)r.vb={w:vb[2],h:vb[3]};
 const cols=new Set();all.forEach(e=>{['fill','stroke'].forEach(k=>{let v=e.getAttribute(k);const st=e.getAttribute('style')||'';const m=st.match(new RegExp(k+'\\s*:\\s*([^;]+)'));if(m)v=m[1];if(v&&!/^(none|transparent|inherit|currentcolor)$/i.test(v.trim())&&!/^url\(/i.test(v.trim()))cols.add(v.trim().toLowerCase().replace(/^#fff$/,'#ffffff').replace(/^white$/,'#ffffff'));});});
 r.colors=[...cols];const nonWhite=r.colors.filter(c=>c!=='#ffffff');if(nonWhite.length>1)r.warns.push('colors');
 const texts=[...root.getElementsByTagName('text')];r.texts=texts.length;r.hasWordmark=texts.length>0;
 if(texts.length&&r.vb){let minFs=Infinity;texts.forEach(tx=>{let fs=parseFloat(tx.getAttribute('font-size'));const st=tx.getAttribute('style')||'';const m=st.match(/font-size\s*:\s*([\d.]+)/);if(m)fs=parseFloat(m[1]);if(!(fs>0))fs=16;minFs=Math.min(minFs,fs);});
  r.wordmarkMm=prn_wordmarkMm(minFs*PRN_CAP,r.vb,PRN_SPEC.C2.logo);if(r.wordmarkMm<1.2)r.warns.push('wordmark');}
 r.clean=new XMLSerializer().serializeToString(root);r.ok=!r.errs.length;return r;}
// letter (cap) height on print when the logo is fitted into a field H × up to W (left-aligned, no distortion)
function prn_logoFit(vb,field){const H=field[0],W=field[1];const k=Math.min(H/vb.h,W/vb.w);return{k,w:vb.w*k,h:vb.h*k};}
function prn_wordmarkMm(capUnits,vb,field){return Math.round(capUnits*prn_logoFit(vb,field).k*100)/100;}

/* ---------- colour ---------- */
function prn_hex(x){const m=String(x||'').trim().match(/^#?([0-9a-f]{6})$/i);return m?'#'+m[1].toUpperCase():null;}
function prn_lum(hex){const h=prn_hex(hex);if(!h)return null;const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4));return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2];}
function prn_contrast(hex,bg){const a=prn_lum(hex),b=prn_lum(bg||'#FFFFFF');if(a==null||b==null)return 0;const hi=Math.max(a,b),lo=Math.min(a,b);return Math.round((hi+0.05)/(lo+0.05)*100)/100;}
function prn_cmyk(hex){const h=prn_hex(hex);if(!h)return '';const [r,g,b]=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255);const k=1-Math.max(r,g,b);if(k>=1)return 'C0 M0 Y0 K100';const f=v=>Math.round((1-v-k)/(1-k)*100);return `C${f(r)} M${f(g)} Y${f(b)} K${Math.round(k*100)}`;}

/* ---------- state ---------- */
function prn_st(){if(!S.prn||typeof S.prn!=='object')S.prn={};const p=S.prn;['brands','plans','batches','runs','csvLog'].forEach(k=>{if(!Array.isArray(p[k]))p[k]=[];});
 if(!p.seq||typeof p.seq!=='object')p.seq={};if(S.org&&!p.brands.length)prn_seedBase();return p;}
function prn_cfg(cc){const o=(S.org&&S.org.countries&&S.org.countries.length?S.org.countries:orgCountries());return cc?o.includes(cc):o;}
function prn_ccs(){return prn_cfg();}
function prn_defCountry(cc,phone){return{cardLangs:(PRN_CARD_LANGS[cc]||['en']).slice(),sleeveLang:PRN_SLEEVE_DEF[cc]||'en',phone:phone||''};}
function prn_seedBase(){const p=S.prn;const o=S.org||{};const ts=iso(addDays(now(),-20));
 const dom=(o.domain&&String(o.domain).trim())||'connect.arvelo.example.com';
 const phones={UA:'+380 44 000 00 00',KZ:'+7 727 000 00 00',DE:'+49 40 000 000 00'};const countries={};prn_ccs().forEach(cc=>{countries[cc]=prn_defCountry(cc,phones[cc]||'');});
 const v1={id:uid('pb'),version:1,status:'approved',brandName:(o.brand||'ARVELO').slice(0,20),logoSvg:PRN_LOGOS.arv_sq,logoName:'arvelo_logo_square.svg',accent:PRN_DEF_ACCENT,accentCmyk:prn_cmyk(PRN_DEF_ACCENT),ink:PRN_DEF_INK,
  domain:dom,domainShort:'',countries,createdAt:ts,by:(S.user&&S.user.name)||'Partner Admin',submittedAt:ts,approvedAt:iso(addDays(now(),-19)),approvedBy:'Anna Petrova (OTA Legal)',note:''};
 v1.logoCheck=prn_logoCheck(v1.logoSvg);delete v1.logoCheck.clean;p.brands=[v1];
 if(!p.plans.length){const mk=(cc,name,sku,pkg,term)=>({id:uid('pp'),cc,name,sku,pkg,term,active:true,createdAt:ts,by:'Maria Lind'});
  const L=[];if(prn_cfg('UA')){L.push(mk('UA','ARVELO HX «Standard»','ARV-HX-24-UA','std',24),mk('UA','ARVELO HX «Standard»','ARV-HX-36-UA','std',36),mk('UA','ARVELO Track «Light»','ARV-TT-24-UA','light',24));}
  if(prn_cfg('KZ'))L.push(mk('KZ','ARVELO Track «Light»','ARV-TT-36-KZ','light',36));
  if(prn_cfg('DE'))L.push(mk('DE','ARVELO HX «Standard»','ARV-HX-24-DE','std',24),mk('DE','ARVELO Track «Light»','ARV-TT-12-DE','light',12));p.plans=L;}}
function prn_latest(){const b=prn_st().brands;return b[b.length-1]||null;}
function prn_approved(){const b=prn_st().brands.filter(x=>x.status==='approved');return b[b.length-1]||null;}
function prn_brandById(id){return prn_st().brands.find(b=>b.id===id)||null;}
function prn_plan(id){return prn_st().plans.find(p=>p.id===id)||null;}
function prn_batch(id){return prn_st().batches.find(b=>b.id===id)||null;}
function prn_run(id){return prn_st().runs.find(r=>r.id===id)||null;}
function prn_agreementNo(){let n=null;try{n=docRef('MPA');}catch(e){}if(n&&typeof n==='object')n=n.number||n.no||null;return n||('OTA-'+((S.org&&S.org.code)||'PPP')+'-MPA-001-v1');}
function prn_canEdit(){return !S.admin&&can('p.form');}
function prn_canOps(){return !S.admin?can('p.codes'):(can('ota.settings')||can('ota.release'));}
function prn_canOta(){return S.admin&&(can('ota.release')||can('ota.settings'));}
function prn_canView(){const a=actor();if(!a)return false;const R=ROLES[a.role];return !!R&&(S.admin||['p_admin','p_sign','p_ops'].includes(a.role));}

/* ---------- validation (ТЗ 2, 3) ---------- */
const PRN_NAME_RE=/^[A-Za-zЀ-ӿ0-9 \-]+$/;
function prn_validate(bv){const e={},w=[];const name=String(bv.brandName||'');
 if(name.trim().length<2||name.length>20)e.brandName=t('prn.v.nameLen');else if(!PRN_NAME_RE.test(name))e.brandName=t('prn.v.nameChars');
 const dom=String(bv.domain||'').trim().toLowerCase();
 if(!/^(?=.{4,253}$)([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(dom))e.domain=t('prn.v.domain');else if(dom.length>30)e.domain=t('prn.v.domain30',{n:dom.length});
 const ds=String(bv.domainShort||'').trim().toLowerCase();
 if(!e.domain&&dom.length>24){if(!ds)e.domainShort=t('prn.v.short24',{n:dom.length});}
 if(ds&&(!/^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(ds)||ds.length>24))e.domainShort=t('prn.v.shortBad');
 const ac=prn_hex(bv.accent);if(!ac)e.accent=t('prn.v.hex');else{const cr=prn_contrast(ac);if(cr<4.5)e.accent=t('prn.v.contrast',{r:fmtNum(cr,2)});}
 const ink=prn_hex(bv.ink);if(!ink)e.ink=t('prn.v.hex');else if(prn_contrast(ink)<7)w.push(t('prn.w.ink',{r:fmtNum(prn_contrast(ink),2)}));
 const lc=bv.logoSvg?prn_logoCheck(bv.logoSvg):null;if(!lc)e.logo=t('prn.v.logoNone');else if(!lc.ok)e.logo=lc.errs.map(x=>t('prn.lc.'+x)).join(' ');
 if(lc&&lc.warns.includes('wordmark'))w.push(t('prn.w.wordmark',{mm:fmtNum(lc.wordmarkMm,2)}));if(lc&&lc.warns.includes('colors'))w.push(t('prn.w.colors',{n:lc.colors.length}));
 if(lc&&lc.ok&&!lc.hasWordmark)w.push(t('prn.w.noText'));
 prn_ccs().forEach(cc=>{const c=(bv.countries||{})[cc]||{};if(!String(c.phone||'').trim())e['phone_'+cc]=t('prn.v.phone');else if(!/^\+?[0-9 ()\-]{6,20}$/.test(String(c.phone).trim()))e['phone_'+cc]=t('prn.v.phoneBad');
  if(!PRN_SLEEVE_LANGS.includes(c.sleeveLang))e['sl_'+cc]=t('prn.v.lang');});
 return{errs:e,warns:w,ok:!Object.keys(e).length,logo:lc};}
function prn_planErrs(d,id){const e={};const nm=String(d.name||'');if(!nm.trim())e.name=t('prn.v.req');else if(nm.length>30)e.name=t('prn.v.plan30',{n:nm.length});
 else if(prn_textLines(nm,470,28,700)>2)e.name=t('prn.v.plan2');
 const sku=String(d.sku||'').trim();if(!sku)e.sku=t('prn.v.req');else if(sku.length>16)e.sku=t('prn.v.sku16');else if(!/^[A-Za-z0-9._\-]+$/.test(sku))e.sku=t('prn.v.skuChars');
 else if(prn_st().plans.some(p=>p.id!==id&&p.sku.toUpperCase()===sku.toUpperCase()))e.sku=t('prn.v.skuDup');
 if(!PRN_PKG[d.pkg])e.pkg=t('prn.v.req');if(!TERMS.includes(+d.term))e.term=t('prn.v.req');if(!prn_cfg(d.cc))e.cc=t('prn.v.req');return e;}
// lines a text takes in a box (B1 plan name box: 470px × font 28px/1.2 bold)
function prn_textLines(txt,w,fs,fw){const el=document.createElement('div');el.style.cssText=`position:fixed;left:-9999px;top:0;width:${w}px;font:${fw} ${fs}px/1.2 Inter, Arial, sans-serif;overflow-wrap:anywhere;visibility:hidden`;el.textContent=txt;document.body.appendChild(el);const n=Math.round(el.scrollHeight/(fs*1.2));el.remove();return n;}

/* ---------- print data (templates' strings, verbatim) ---------- */
function prn_months(cc,term){term=+term;if(cc==='UA'){const a=term%10,b=term%100;return a===1&&b!==11?'місяць':a>=2&&a<=4&&(b<12||b>14)?'місяці':'місяців';}if(cc==='KZ')return 'ай / мес.';return PRN_WTA;}
function prn_ddmmyyyy(x){if(!x)return null;const d=new Date(x);return pad(d.getDate())+'.'+pad(d.getMonth()+1)+'.'+d.getFullYear();}
function prn_B2text(cc,dom,tel,deadline){const dl=prn_ddmmyyyy(deadline);
 if(cc==='KZ')return{codeLabel:'Пакет коды / Код пакета',deadline:'Мерзімі / Активировать до: '+(dl||'[ДД.ММ.ГГГГ]'),bi:true,
  steps:[{a:'Алдыңғы жақтағы QR-ды сканерлеңіз немесе '+dom+' ашыңыз',b:'Отсканируйте QR на лицевой стороне или откройте '+dom},{a:'Кіріңіз не тіркеліңіз',b:'Войдите или зарегистрируйтесь'},{a:'Қорғаныш қабатын өшіріп, пакет кодын енгізіңіз',b:'Сотрите защитный слой и введите код пакета'}],
  footer:['Тариф белсендіруден басталады, код бір реттік.','Тариф с даты активации, код одноразовый.','Шарттар / Условия: '+dom+'/terms · '+tel]};
 if(cc==='UA')return{codeLabel:'Код пакета',deadline:'Активувати до: '+(dl||'[ДД.ММ.РРРР]'),
  steps:[{a:'Відскануйте QR-код на лицьовому боці або відкрийте '+dom},{a:'Увійдіть або зареєструйтеся'},{a:'Зітріть захисний шар і введіть код пакета'}],
  footer:['Тариф діє з дати активації. Код можна використати один раз.','Умови сервісу: '+dom+'/terms','Підтримка: '+tel]};
 // DE (and any country without approved card strings): data stays, wording is pending
 return{codeLabel:PRN_WTA,deadline:PRN_WTA+': '+(dl||'[TT.MM.JJJJ]'),wta:true,steps:[{a:PRN_WTA+' · '+dom},{a:PRN_WTA},{a:PRN_WTA}],footer:[PRN_WTA,PRN_WTA+': '+dom+'/terms',PRN_WTA+': '+tel]};}
function prn_B1text(cc){if(cc==='UA')return{codeLabel:'Код пакета'};if(cc==='KZ')return{codeLabel:'Пакет коды\nКод пакета'};return{codeLabel:PRN_WTA,wta:true};}
function prn_C1text(L,B){const T={en:['Communication module','for '+B+' devices'],uk:['Модуль звʼязку','для пристроїв '+B],ru:['Модуль связи','для устройств '+B],kk:[B+' құрылғыларына','арналған байланыс модулі'],pl:['Moduł komunikacyjny','do urządzeń '+B],de:['Kommunikationsmodul','für '+B+'-Geräte']};return T[L]||T.en;}
function prn_C2text(L,B){const T={
 en:{lead:'For approved '+B+' devices only.',nfs:'NOT FOR SALE',steps:['Open the portal: QR code on the front.','Scan the barcode on the SIM card plastic (bottom one, ICCID).','Follow the instructions in the portal.']},
 uk:{lead:'Лише для схвалених пристроїв '+B+'.',nfs:'НЕ ДЛЯ ПРОДАЖУ',steps:['Відкрийте портал: QR-код на лицьовому боці.','Відскануйте штрихкод на пластику SIM (нижній, ICCID).','Дотримуйтесь інструкцій на порталі.']},
 ru:{lead:'Только для одобренных устройств '+B+'.',nfs:'НЕ ДЛЯ ПРОДАЖИ',steps:['Откройте портал: QR-код на лицевой стороне.','Отсканируйте штрихкод на пластике SIM (нижний, ICCID).','Следуйте инструкциям на портале.']},
 kk:{lead:'Тек мақұлданған '+B+' құрылғыларына.',nfs:'САТУҒА АРНАЛМАҒАН',steps:['Порталды ашыңыз: QR-код алдыңғы жақта.','SIM пластигіндегі штрихкодты сканерлеңіз (төменгі, ICCID).','Порталдағы нұсқауларды орындаңыз.']},
 pl:{lead:'Tylko dla zatwierdzonych urządzeń '+B+'.',nfs:'NIE NA SPRZEDAŻ',steps:['Otwórz portal: kod QR z przodu.','Zeskanuj kod kreskowy na plastiku SIM (dolny, ICCID).','Postępuj zgodnie z instrukcjami w portalu.']},
 de:{lead:'Nur für zugelassene '+B+'-Geräte.',nfs:'NICHT ZUM VERKAUF',steps:['Portal öffnen: QR-Code auf der Vorderseite.','Scannen Sie den Barcode auf dem SIM-Träger (unten, ICCID).','Folgen Sie den Anweisungen im Portal.']}};return T[L]||T.en;}
// brand values → material data
function prn_data(bv,o){o=o||{};const cc=o.cc||'UA';const c=(bv.countries||{})[cc]||prn_defCountry(cc);const lc=bv.logoCheck&&bv.logoCheck.vb?bv.logoCheck:prn_logoCheck(bv.logoSvg);
 const dom=String(bv.domain||'').trim();const short=String(bv.domainShort||'').trim()||dom;
 return{brand:bv.brandName||'',logo:prn_logoUri(bv.logoSvg),vb:lc.vb||{w:1,h:1},accent:prn_hex(bv.accent)||PRN_DEF_ACCENT,ink:prn_hex(bv.ink)||PRN_DEF_INK,domain:dom,domainSleeve:short,
  cc,lang:o.lang||c.sleeveLang||PRN_SLEEVE_DEF[cc]||'en',phone:String(c.phone||'').trim()||'[телефон]',term:o.term||24,planName:o.planName||'',serial:o.serial||'1000 0000 0001',
  deadline:o.deadline||null,scratched:!!o.scratched,zones:!!o.zones,code:o.code||'7K4M-9QXR-2HTD',ship:o.ship||null,pack:o.pack||null,carton:o.carton||null,agreement:o.agreement||prn_agreementNo(),plans:o.plans||[]};}

/* ---------- templates (reference layouts, design px; physical scale applied by prn_sheet) ---------- */
const prn_zl=(txt,right)=>`<div class="prn-zl${right?' r':''}">${txt}</div>`;
function prn_logoBox(d,field,ppm,label,extraCls){const H=field[0]*ppm,W=field[1]*ppm;const f=prn_logoFit(d.vb,[H,W]);
 return `<div class="prn-z prn-logof ${extraCls||''}" data-fix="logo" data-field="${field[0]}x${field[1]}" style="width:${W}px;height:${H}px"><img class="prn-logo" src="${d.logo}" alt="${esc(d.brand)}" style="width:${f.w}px;height:${f.h}px"><div class="prn-zsq" style="width:${Math.min(H,W)}px;height:${H}px"></div>${prn_zl(label)}</div>`;}
function prn_qrBox(d,side,label,right){return `<div class="prn-z prn-qr" data-fix="qr" data-qrmm="${right}" style="width:${side}px;height:${side}px">${prnQrSvg('https://'+d.domain,{color:d.ink})}${prn_zl(label,true)}</div>`;}
function prn_tB1(d){const ppm=10;const tx=prn_B1text(d.cc);
 return `<div class="prn-root" data-root style="width:856px;height:540px;color:${d.ink};border-radius:32px;padding:36px 44px;display:flex;flex-direction:column;justify-content:space-between">
<div style="display:flex;justify-content:space-between;align-items:center;gap:24px;height:100px">${prn_logoBox(d,PRN_SPEC.B1.logo,ppm,'LOGO · 10 mm high · up to 30 mm wide')}
<div class="prn-z" data-fix="prog" style="position:relative;flex:1;min-width:0;align-self:stretch;display:flex;align-items:center;justify-content:flex-end"><div data-prog style="text-align:right;font-size:26px;font-weight:800;letter-spacing:.02em;line-height:1.2;overflow-wrap:anywhere">${esc(d.brand)} <span style="color:${d.accent}">CONNECT</span></div>${prn_zl('PROGRAMME NAME · max 2 lines',true)}</div></div>
<div style="display:flex;align-items:flex-end;justify-content:space-between;gap:32px"><div style="display:flex;flex-direction:column;gap:18px;min-width:0;flex:1">
<div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap"><div style="font-size:136px;font-weight:800;line-height:.9;color:${d.accent}">${esc(d.term)}</div><div style="font-size:34px;font-weight:700;min-width:0">${esc(prn_months(d.cc,d.term))}</div></div>
<div class="prn-z" data-fix="plan" style="position:relative;max-width:470px;max-height:68px"><div style="font-size:28px;font-weight:700;line-height:1.2;overflow-wrap:anywhere">${esc(d.planName||'[PartnerPlan.name]')}</div>${prn_zl('PARTNER PLAN NAME · max 2 lines, 30 chars')}</div></div>
${prn_qrBox(d,190,'QR 19 mm',19)}</div>
<div style="display:flex;justify-content:space-between;align-items:flex-end;gap:24px"><div style="font-size:22px;color:${PRN_INK2};line-height:1.3;white-space:pre-line;min-width:0">${esc(tx.codeLabel)}</div>
<div class="prn-z" data-fixw="domain" style="position:relative;flex:none;font-size:21px;font-weight:700;white-space:nowrap">${esc(d.domain)}${prn_zl('DOMAIN · one line, right-aligned under QR',true)}</div></div></div>`;}
function prn_tB2(d){const ppm=10;const tx=prn_B2text(d.cc,d.domain,d.phone,d.deadline);const bi=!!tx.bi;
 const scratch=d.scratched?`<div style="height:${bi?70:96}px;box-sizing:border-box;border:1px solid #BFBFBF;border-radius:14px;display:flex;align-items:center;justify-content:center;padding:6px 22px"><div class="prn-mono" style="font-size:${bi?36:44}px;font-weight:700;letter-spacing:.08em;white-space:nowrap">${esc(d.code)}</div></div>`
  :`<div class="prn-foil" style="height:${bi?70:96}px"></div>`;
 const steps=bi?`<div data-fix="steps" style="display:grid;grid-template-columns:30px minmax(0,1fr) minmax(0,1fr);gap:4px 14px;align-items:start">${tx.steps.map((s,i)=>`<div class="prn-step" style="width:30px;height:30px;border-radius:15px;font-size:21px;background:${d.accent}">${i+1}</div><div style="font-size:21px;line-height:1.1">${esc(s.a)}</div><div style="font-size:21px;line-height:1.1;color:${PRN_INK2}">${esc(s.b)}</div>`).join('')}</div>`
  :`<div data-fix="steps" style="display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr) minmax(0,1fr);gap:18px">${tx.steps.map((s,i)=>`<div style="display:flex;flex-direction:column;gap:6px"><div class="prn-step" style="width:32px;height:32px;border-radius:16px;font-size:21px;background:${d.accent}">${i+1}</div><div style="font-size:21px;line-height:1.2">${esc(s.a)}</div></div>`).join('')}</div>`;
 return `<div class="prn-root" data-root data-lang="${d.cc==='KZ'?'kk ru':d.cc==='UA'?'uk':'de'}" style="width:856px;height:540px;color:${d.ink};border-radius:32px;padding:30px 40px 26px 40px;display:flex;flex-direction:column;gap:${bi?4:8}px;font-variant-numeric:tabular-nums">
<div style="display:flex;justify-content:space-between;align-items:center;gap:20px;height:60px;flex:none">${prn_logoBox(d,PRN_SPEC.B2.logo,ppm,'LOGO · 6 mm high · up to 20 mm wide')}
<div class="prn-z" data-fix="prog" style="position:relative;flex:1;min-width:0;text-align:right;font-size:21px;font-weight:800;letter-spacing:.02em;line-height:1.2;overflow-wrap:anywhere">${esc(d.brand)} <span style="color:${d.accent}">CONNECT</span>${prn_zl('PROGRAMME NAME',true)}</div></div>
<div style="display:flex;flex-direction:column;gap:${bi?4:8}px;margin-bottom:${bi?2:6}px;flex:none"><div class="prn-z" data-layer="scratch" style="position:relative;border-radius:14px"><div class="prn-scratch" style="border-radius:14px">${scratch}</div>${prn_zl('SCRATCH AREA · code only, 12 chars, no QR (variable print)')}</div>
<div style="display:flex;justify-content:space-between;align-items:baseline;gap:16px;font-size:21px"><div style="font-weight:700;min-width:0">${esc(tx.codeLabel)}</div><div class="prn-z" data-fixw="serial" style="position:relative;color:${PRN_INK2};white-space:nowrap">№ ${esc(d.serial)}${prn_zl('SERIAL · from OTA database',true)}</div></div></div>
${steps}<div style="flex:1"></div><div style="font-size:21px;font-weight:700;flex:none">${esc(tx.deadline)}</div>
<div class="prn-z" style="position:relative;padding-top:${bi?5:8}px;border-top:1px solid ${d.ink};display:flex;flex-direction:column;gap:${bi?0:2}px;font-size:21px;line-height:${bi?1.1:1.2};flex:none">${tx.footer.map(f=>`<div>${esc(f)}</div>`).join('')}${prn_zl('DOMAIN/terms · SUPPORT PHONE',true)}</div></div>`;}
function prn_tC1(d){const ppm=PRN_SZ.C1.ppm;const L=d.lang;const ds=prn_C1text(L,d.brand);const q=18*ppm;
 return `<div class="prn-root" data-root data-lang="${esc(L)}" style="width:520px;height:${Math.round(85*ppm*100)/100}px;color:${d.ink};border-radius:22px;display:flex;flex-direction:column;justify-content:space-between;padding:40px 36px">
<div style="height:${12*ppm}px;display:flex;align-items:center">${prn_logoBox(d,PRN_SPEC.C1.logo,ppm,'LOGO · 12 mm high · up to 36 mm wide')}</div>
<div class="prn-z" data-fix="prog" style="position:relative;display:flex;flex-direction:column;gap:20px">${prn_zl('PROGRAMME NAME + DEVICE LINE · one language')}
<div data-prog style="font-size:52px;font-weight:800;line-height:1.04;letter-spacing:.01em;overflow-wrap:anywhere">${esc(d.brand)}<br><span style="color:${d.accent}">CONNECT</span></div>
<div lang="${esc(L)}" style="font-size:22px;font-weight:500;line-height:1.35;color:${PRN_INK2}"><div>${esc(ds[0])}</div><div>${esc(ds[1])}</div></div></div>
<div style="display:flex;flex-direction:column;align-items:flex-end;gap:10px">${prn_qrBox(d,q,'QR 18 mm',18)}
<div style="align-self:stretch;display:flex;justify-content:flex-end;align-items:flex-end;gap:16px"><div class="prn-z" data-fixw="domain" style="position:relative;font-size:19px;font-weight:700;white-space:nowrap">${esc(d.domainSleeve)}${prn_zl('DOMAIN · one line',true)}</div></div></div></div>`;}
function prn_tC2(d){const ppm=PRN_SZ.C2.ppm;const L=d.lang;const T=prn_C2text(L,d.brand);
 return `<div class="prn-root" data-root data-lang="${esc(L)}" style="width:520px;height:${Math.round(85*ppm*100)/100}px;color:${d.ink};border-radius:22px;display:flex;flex-direction:column;overflow:hidden">
<div style="display:flex;justify-content:space-between;align-items:center;gap:16px;height:96px;box-sizing:border-box;padding:12px 34px 0 34px;border-bottom:1px solid ${d.ink};flex:none">${prn_logoBox(d,PRN_SPEC.C2.logo,ppm,'LOGO · 7.5 mm high · up to 22 mm wide')}
<div class="prn-z" data-fix="prog" style="position:relative;flex:1;min-width:0;text-align:right;font-size:21px;font-weight:800;letter-spacing:.02em;line-height:1.2;overflow-wrap:anywhere">${esc(d.brand)} <span style="color:${d.accent}">CONNECT</span>${prn_zl('PROGRAMME NAME',true)}</div></div>
<div lang="${esc(L)}" style="padding:34px 34px 0 34px;font-size:23px;font-weight:600;line-height:1.3">${esc(T.lead)}</div>
<div lang="${esc(L)}" style="display:flex;flex-direction:column;gap:32px;padding:40px 34px 0 34px">${T.steps.map((s,i)=>`<div style="display:flex;gap:16px;align-items:flex-start"><div class="prn-step" style="flex:none;width:40px;height:40px;border-radius:20px;font-size:20px;background:${d.accent}">${i+1}</div><div style="font-size:23px;line-height:1.35;padding-top:3px;min-width:0">${esc(s)}</div></div>`).join('')}</div>
<div style="flex:1"></div><div lang="${esc(L)}" style="margin:0 34px;padding:18px 0 30px 0;border-top:1px solid ${d.ink};font-size:19px;font-weight:600;letter-spacing:.12em;text-align:center;flex:none">${esc(T.nfs)}</div></div>`;}
function prn_tC3(d){const ppm=9.2;const mono='prn-mono';
 // domain: one line, full width − 2 mm each side, starts at 2.7 mm and shrinks to fit, never below 2.0 mm (ТЗ 4.3 / brand rules)
 const avail=340-2*2*ppm;const fs=prn_fitFont(d.domainSleeve,avail,2.7*ppm,2.0*ppm,700,0.02);
 return `<div class="prn-root" data-root style="width:900px;height:760px;background:#EDEDED;color:#22262C;padding:40px;display:flex;gap:48px">
<div style="display:flex;flex-direction:column;gap:14px;align-items:center"><div style="font-size:13px;font-weight:700;color:${PRN_INK2};letter-spacing:.06em">ЛИЦЕВАЯ СТОРОНА НОСИТЕЛЯ</div>
<div data-carrier style="position:relative;width:340px;height:415px;background:#FFFFFF;border-radius:14px;box-shadow:0 1px 3px rgba(0,0,0,.18)">
<div class="${mono}" style="position:absolute;left:0;right:0;top:18px;text-align:center;font-size:12px;color:#A6A6A6">BIC:#XXXX-XXXX-XXXX-XXXX</div>
<div class="prn-sup" style="left:24px;right:24px;top:38px"></div>
<div class="${mono}" style="position:absolute;left:0;right:0;top:78px;text-align:center;font-size:9px;color:#A6A6A6">eID: 89000000000000000000000000000000</div>
<div class="${mono}" style="position:absolute;left:158px;top:133px;width:120px;height:84px;border:3px solid #4D4D4D;border-radius:6px;box-sizing:border-box;background:#F7F7F7;padding:10px 12px;font-size:9.5px;line-height:1.3;color:#8C8C8C">8938001200<br>00000000</div>
<div class="prn-z" data-fix="logo" data-field="10x10" style="position:absolute;left:36px;top:129px;width:92px;height:92px;display:flex;align-items:center;justify-content:center">${prn_zl('LOGO · 10 × 10 mm')}<img class="prn-logo" src="${d.logo}" alt="${esc(d.brand)}" style="width:${prn_logoFit(d.vb,[92,92]).w}px;height:${prn_logoFit(d.vb,[92,92]).h}px"></div>
<div class="prn-z" data-fixw="domain" data-fs="${fs}" style="position:absolute;left:18px;right:18px;top:244px;height:28px;display:flex;align-items:center;justify-content:center;text-align:center;font-size:${fs}px;font-weight:700;letter-spacing:.02em;white-space:nowrap;color:#22262C">${esc(d.domainSleeve)}${prn_zl('DOMAIN · full width − 2 mm each side')}</div>
<div class="prn-sup" style="left:24px;right:24px;top:292px"></div>
<div class="${mono}" style="position:absolute;left:0;right:0;top:334px;text-align:center;font-size:12px;color:#A6A6A6">ICCID: 8938001200000000000</div>
<div class="${mono}" style="position:absolute;left:0;right:0;top:358px;text-align:center;font-size:12px;color:#A6A6A6">PIN: ••••••</div>
<div class="${mono}" style="position:absolute;left:0;right:0;top:382px;text-align:center;font-size:12px;color:#A6A6A6">MSISDN: ••••••••••••</div></div>
<div style="font-size:12.5px;color:${PRN_INK2};text-align:center;width:340px;line-height:1.4">Серым – то, что уже напечатано поставщиком</div></div>
<div style="flex:1;display:flex;flex-direction:column;gap:14px;font-size:14px;line-height:1.5;padding-top:30px"><div style="font-size:22px;font-weight:800">Тампопечать на носителе</div>
<div><b>Логотип партнёра:</b> слева от SIM, в поле 10 × 10 мм, тот же логотип, что на всех материалах, вписывается по большей стороне. Отступ от вырубки и края носителя не меньше 2 мм.</div>
<div><b>Домен:</b> одна строка по центру, поле на всю ширину носителя минус 2 мм с каждой стороны; не меньше 2 мм до логотипа и до нижнего штрихкода. Длинный домен уменьшается, но не меньше 2 мм по высоте букв.</div>
<div><b>Цвет:</b> логотип и домен одним цветом, одним клише и тампоном за один проход.</div><div><b>Оборот (сторона контактов):</b> не печатается.</div>
<div style="padding:14px 16px;background:#FFFFFF;border-radius:10px;font-size:13px">Не печатать: «SIM», номера, тарифы, цены, названия операторов и поставщика.</div>
<div style="font-size:12.5px;color:${PRN_INK2}">Для клише – логотип в кривых (SVG/EPS/PDF). Тонкие элементы логотипа проверить на пробной печати.</div></div></div>`;}
function prn_fitFont(txt,avail,max,min,fw,ls){const el=document.createElement('span');el.style.cssText=`position:fixed;left:-9999px;top:0;white-space:nowrap;font:${fw} 100px Inter, Arial, sans-serif;letter-spacing:${ls}em;visibility:hidden`;el.textContent=txt;document.body.appendChild(el);const w100=el.getBoundingClientRect().width||1;el.remove();
 const fs=Math.floor(Math.min(max,Math.max(min,avail/w100*100))*10)/10;return fs;}
const PRN_LBL='font-size:12px;font-weight:600;color:'+PRN_INK2+';letter-spacing:.06em';
const prn_kv=(k,v,o)=>`<div style="display:flex;flex-direction:column;gap:3px;${o&&o.span?'grid-column:span 2;':''}"><div style="${o&&o.lbl||PRN_LBL}">${k}</div><div style="font-size:${o&&o.fs||17}px;font-weight:${o&&o.fw||700};${o&&o.mono?'font-family:\'JetBrains Mono\',ui-monospace,monospace;':''}overflow-wrap:anywhere">${v}</div></div>`;
function prn_iccidGrp(s){return String(s).replace(/(\d{4})(?=\d)/g,'$1 ');}
function prn_tA1(d){const ppm=PRN_SZ.A1.ppm;const k=d.pack;const W=210*ppm,H=297*ppm;
 const lot=k?esc(k.lot):'[LOT-YYYY-NNN]',qty=k?fmtNumEn(k.qty)+' pcs':'[500] pcs',rng=k?esc(prn_iccidGrp(k.first))+' – '+esc(prn_iccidGrp(k.last)):'[89xx xxxx xxxx xxxx xxxx] – [89xx xxxx xxxx xxxx xxxx]';
 const bc=k?`<div data-fix="barcode" style="flex:1;height:70px;display:flex;gap:14px;align-items:stretch">${[['FIRST',k.first],['LAST',k.last]].map(([l,v])=>`<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px"><div style="flex:1">${prnC128Svg(v)}</div><div style="font-size:12px;font-family:'JetBrains Mono',monospace;text-align:center;white-space:nowrap">${l} ${esc(v)}</div></div>`).join('')}</div>`
  :`<div style="flex:1;height:70px;border:2px dashed ${PRN_INK3};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;color:${PRN_INK2}">Code 128 barcode · first ICCID – last ICCID</div>`;
 return `<div class="prn-root prn-a" data-root style="width:${W}px;height:${H}px;color:#22262C;padding:40px">
<div data-fix="label" style="height:520px;box-sizing:border-box;display:flex;flex-direction:column;border:2px solid #22262C">
<div style="display:flex;justify-content:space-between;align-items:center;gap:20px;padding:18px 26px;border-bottom:2px solid #22262C"><div style="display:flex;align-items:center;gap:20px;min-width:0">${prn_logoBox(d,PRN_SPEC.A1.logo,ppm,'LOGO · 15 mm high · up to 45 mm wide')}
<div style="display:flex;flex-direction:column;gap:2px;padding-left:20px;border-left:1px solid ${PRN_INK3};min-width:0"><div style="font-size:19px;font-weight:800;letter-spacing:.04em">IoT SIM MODULES</div><div style="font-size:12.5px;font-weight:500;color:${PRN_INK2}">For installation in approved ${esc(d.brand)} devices only</div></div></div>
<div style="flex:none;font-size:13px;font-weight:700;padding:6px 12px;border:2px solid #22262C;letter-spacing:.08em">NOT FOR SALE</div></div>
<div style="padding:10px 26px;border-bottom:1px solid ${PRN_INK3};font-size:12.5px;font-weight:600;line-height:1.35">Supplied for custody under Agreement No. ${esc(d.agreement)} · Not for resale</div>
<div style="flex:1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 26px;padding:18px 26px;align-content:start">
${prn_kv('LOT NO.',lot)}${prn_kv('QUANTITY',qty)}${prn_kv('FORM FACTOR','Triple-cut 2FF / 3FF / 4FF · industrial grade')}${prn_kv('COUNTRY OF ORIGIN','Made in [country]')}${prn_kv('ICCID RANGE',rng,{span:1,fs:16,fw:500,mono:1})}</div>
<div style="display:flex;gap:20px;align-items:stretch;padding:0 26px 18px 26px">${bc}
<div style="width:220px;display:flex;flex-direction:column;justify-content:center;gap:4px;font-size:12px;color:${PRN_INK2};line-height:1.35"><div>Pro forma: ${k?esc(k.pf):'OTA-PF-[YYYY-NNNN]'}</div><div>Receipt: ${k?esc(k.sr):'OTA-SR-[YYYY-NNNN]'}</div><div>Store dry, 0…+40 °C · ESD-sensitive</div></div></div></div></div>`;}
function fmtNumEn(n){return new Intl.NumberFormat('en-US').format(n);}
function prn_tA2(d){const ppm=PRN_SZ.A2.ppm;const c=d.carton;const W=210*ppm,H=297*ppm;const h=c&&c.ship;const dap=(h&&h.dap)||{};
 const shipper=otaValSafe('OTA_NAME')||'OTA TECHNOLOGY DMCC',addr=otaValSafe('OTA_ADDR_EN')||'[OTA address]',reg=otaValSafe('OTA_REGNO');
 const sf=h&&h.ship_from||{},ex=h&&h.exporter||{};const L2='font-size:12px;font-weight:700;color:'+PRN_INK2+';letter-spacing:.08em';const L3='font-size:12px;font-weight:700;color:'+PRN_INK2;
 const kv=(k,v,o)=>prn_kv(k,v,Object.assign({lbl:L3,fs:16},o||{}));
 const qrUrl=h?prn_consoleUrl('#shipment--'+h.id):'';
 return `<div class="prn-root prn-a" data-root style="width:${W}px;height:${H}px;color:#22262C;padding:40px">
<div data-fixmin="label" style="min-height:760px;box-sizing:border-box;border:2px solid #22262C;display:flex;flex-direction:column">
<div style="display:flex;justify-content:space-between;align-items:center;gap:20px;padding:18px 26px;border-bottom:2px solid #22262C">${prn_logoBox(d,PRN_SPEC.A2.logo,ppm,'LOGO · 15 mm high · up to 45 mm wide')}<div style="font-size:12px;color:${PRN_INK2};text-align:right">Agreement No. ${esc(d.agreement)}</div></div>
<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));border-bottom:2px solid #22262C">
<div style="min-height:210px;box-sizing:border-box;padding:16px 26px;display:flex;flex-direction:column;gap:4px;border-right:2px solid #22262C;min-width:0"><div style="${L2}">SHIPPER (OWNER OF GOODS)</div><div style="font-size:16px;font-weight:800">${esc(shipper)}</div><div style="font-size:12.5px;line-height:1.4">${esc(addr)}</div>${reg?`<div style="font-size:12.5px">Reg. no. ${esc(reg)}</div>`:''}
<div style="${L2};margin-top:8px">SHIP FROM</div><div style="font-size:12.5px;line-height:1.4">${h?esc([sf.name,sf.addr,sf.country?ctyNameEn(sf.country):''].filter(Boolean).join(', ')):'[Warehouse, street, postcode, city, EU country]'}<br>Exporter of record: ${h?esc(ex.name||'[name]'):'[name]'} · EORI ${h?esc(ex.eori||'[ ]'):'[ ]'}</div></div>
<div style="padding:16px 26px;display:flex;flex-direction:column;gap:4px;min-width:0"><div style="${L2}">CONSIGNEE / IMPORTER</div><div data-fix="importer" style="font-size:16px;font-weight:800;line-height:1.3;max-height:42px;overflow:hidden">${h?esc(dap.importer||h.importer||dap.company||'[Importer full legal name – up to 2 lines]'):'[Importer full legal name – up to 2 lines]'}</div>
<div style="font-size:12.5px;line-height:1.4">${h?`${esc(dap.address||'[Street, building, office]')}<br>${esc(dap.city||'[Postcode, city, region]')}<br>${esc(dap.country?ctyNameEn(dap.country):'[Country]')}`:'[Street, building, office]<br>[Postcode, city, region]<br>[Country]'}</div>
<div style="font-size:12.5px;line-height:1.4">${h&&dap.taxId?esc(dap.taxId):'[Tax / customs ID]'}<br>Contact: ${h&&dap.recipient?esc(dap.recipient):'[name]'} · Tel. ${h&&dap.phone?esc(dap.phone):'[ ]'}</div></div></div>
<div style="padding:12px 26px;display:flex;justify-content:space-between;align-items:center;gap:16px;border-bottom:2px solid #22262C"><div style="font-size:17px;font-weight:800;letter-spacing:.02em">IoT SIM MODULES – EQUIPMENT HELD IN CUSTODY</div><div style="flex:none;font-size:13px;font-weight:700;padding:6px 12px;border:2px solid #22262C;letter-spacing:.08em">NOT FOR SALE</div></div>
<div style="padding:10px 26px;font-size:12.5px;font-weight:500;line-height:1.4;border-bottom:1px solid ${PRN_INK3}">Supplied for custody under Agreement No. ${esc(d.agreement)} · Not for resale · For approved ${esc(d.brand)} devices only</div>
<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px 18px;padding:14px 26px;align-content:start">
${kv('HS CODE',h?esc(h.hs||'8523.52'):'8523.52')}${kv('INCOTERMS','DAP '+(h?esc(dap.city||'[city]'):'[city]'))}${kv('PACKAGE',c?c.i+' of '+c.n:'[1] of [3]')}${kv('GROSS / NET',c&&c.gross?esc(c.gross)+' / '+esc(c.net)+' kg':'[ ] / [ ] kg')}
${kv('QTY IN CARTON',c?fmtNumEn(c.qty)+' pcs':'[2,000] pcs')}${kv('LOTS',c?esc(c.lots):'[LOT-…] ×[4]')}${kv('ORIGIN','Made in [ ]')}${kv('SEAL NO.','[ ]',{mono:1})}
${kv('PRO FORMA (CUSTOMS ONLY)',h?esc(h.pf):'OTA-PF-[YYYY-NNNN]',{span:1})}${kv('RECEIPT ACKNOWLEDGMENT',h?esc(h.sr):'OTA-SR-[YYYY-NNNN]',{span:1})}</div>
<div style="flex:1"></div>
<div style="display:flex;gap:18px;padding:0 26px 18px 26px;align-items:stretch">${h?`<div style="flex:1;display:flex;gap:14px;align-items:center;min-width:0"><div style="width:86px;height:86px;flex:none">${prnQrSvg(qrUrl)}</div><div style="font-size:12px;font-weight:600;color:${PRN_INK2};min-width:0;overflow-wrap:anywhere">QR · link to ICCID list (secure portal, login required)</div></div>`:`<div style="flex:1;height:62px;border:2px dashed ${PRN_INK3};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;color:${PRN_INK2}">QR · link to ICCID list (secure portal, login required)</div>`}
<div style="width:230px;display:flex;flex-direction:column;justify-content:center;gap:4px;font-size:12px;color:${PRN_INK2}"><div style="font-weight:700;color:#22262C">Handle with care · Keep dry</div><div>Storage 0…+40 °C · ESD-sensitive</div></div></div></div></div>`;}
function otaValSafe(k){try{return otaVal(k);}catch(e){return null;}}
function prn_consoleUrl(hash){try{if(/^https?:/.test(location.protocol))return location.origin+location.pathname+hash;}catch(e){}return 'https://partner.connect.example/'+hash;}
function prn_t0(d){const B=esc(d.brand);const th='text-align:left;font-weight:700;border-bottom:1px solid #22262C;padding:6px 8px;vertical-align:top';const td='border-bottom:1px solid #D9D9D9;padding:6px 8px;vertical-align:top';
 const row=(a,b,c)=>`<tr><td style="${td}">${a}</td><td style="${td}">${b}</td><td style="${td}">${c}</td></tr>`;
 const pn=[...new Set((d.plans||[]).map(p=>p.name))];const terms=[...new Set((d.plans||[]).map(p=>p.term))].sort((a,b)=>a-b);
 const rat=(w,h,l)=>`<div style="display:flex;flex-direction:column;gap:6px"><div style="position:relative;width:192px;height:64px;outline:1.5px dashed #0B5CAD;display:flex;align-items:center"><div style="position:absolute;left:0;top:0;width:64px;height:64px;outline:1px dotted #0B5CAD"></div><div style="width:${w}px;height:${h}px;background:#22262C;${w===64&&h===64?'border-radius:32px':''}"></div></div><div style="font-size:13px;color:${PRN_INK2}">${l}</div></div>`;
 const lf=d.vb?Math.round(d.vb.w/d.vb.h*10)/10:1;
 return `<div class="prn-root prn-rules" data-root style="width:960px;color:#22262C;padding:48px;display:flex;flex-direction:column;gap:28px;font-size:15px;line-height:1.5">
<div style="display:flex;flex-direction:column;gap:6px"><div style="font-size:30px;font-weight:800">Бренд-правила материалов партнёра</div><div style="color:${PRN_INK2}">Все макеты собраны из одних и тех же переменных. Смена партнёра = замена переменных; размеры полей и блоков не меняются.</div></div>
<div style="display:flex;flex-direction:column;gap:8px"><div style="font-size:19px;font-weight:700">1. Переменные бренда</div><table style="border-collapse:collapse;width:100%"><tr><th style="${th};width:190px">Переменная</th><th style="${th};width:230px">Сейчас</th><th style="${th}">Правило</th></tr>
${row('brandName',B,'Название бренда. Программа всегда «brandName CONNECT»; CONNECT – акцентным цветом. До 14 знаков – в одну строку; длиннее – перенос, логотип не сжимается.')}
${row('domain',esc(d.domain),'Домен портала партнёра, до 30 знаков. Всегда одной строкой, без переносов, выровнен по правому краю под QR и растёт влево (до 30 знаков на карте, до 24 – на конверте). Условия – domain/terms.')}
${row('logoUrl',`<img src="${d.logo}" alt="" style="height:32px;width:auto;vertical-align:middle"> ${lf}:1`,'Один файл на все материалы. Вектор (SVG), прозрачный фон, без полей, один цвет. Любые пропорции: вписывается в поле логотипа по большей стороне, не растягивается.')}
${row('planName',pn.length?pn.map(esc).join(' / '):'[PartnerPlan.name]',`Название пакета задаёт партнёр (не Light/Standard/Premium OTA). Сроки ${B}: ${terms.length?terms.join(', ')+' месяцев':'[ ]'}. До 30 знаков, до 2 строк. На один пакет OTA партнёр может завести несколько названий и SKU – каждое печатается своим тиражом.`)}
${row('serial','1000 0000 0001','Серийный номер карты из базы OTA (не SKU партнёра). Печатается открыто: по нему поддержка находит и блокирует карту. SKU партнёра – в его учётной системе, на карте не печатается.')}
${row('phone',esc(d.phone),'Телефон поддержки партнёра (первая линия).')}
${row('qrUrl','QR на '+esc(d.domain),'Генерируется порталом из domain: ECC M, поле 2 модуля, цвет ink. Ведёт только на портал.')}
${row('accent',`<span style="display:inline-block;width:12px;height:12px;background:${d.accent};vertical-align:middle"></span> ${esc(d.accent)}`,'Один фирменный цвет партнёра. Только: CONNECT, срок тарифа, номера шагов. Не для основного текста.')}
${row('ink',`<span style="display:inline-block;width:12px;height:12px;background:${d.ink};vertical-align:middle"></span> ${esc(d.ink)}`,'Цвет текста, линий и рамок. Вторичный текст #404040, подписи #767676 (не светлее).')}
${row('Шрифт','Inter','Латиница, кириллица, казахский. 400 / 600 / 700 / 800.')}</table></div>
<div style="display:flex;flex-direction:column;gap:8px"><div style="font-size:19px;font-weight:700">2. Размеры по материалам</div><table style="border-collapse:collapse;width:100%"><tr><th style="${th};width:200px">Материал</th><th style="${th}">Формат</th><th style="${th}">Поле логотипа (высота × до ширины)</th><th style="${th}">Название программы</th><th style="${th}">Мин. текст</th><th style="${th}">QR</th></tr>
<tr><td style="${td}">A1, A2 – этикетки</td><td style="${td}">A4, офисный принтер, ч/б</td><td style="${td}">15 × до 45 мм</td><td style="${td}">–</td><td style="${td}">9 pt</td><td style="${td}">–</td></tr>
<tr><td style="${td}">B – скретч-карта</td><td style="${td}">85,6 × 54 мм, CR80</td><td style="${td}">10 × до 30 мм (оборот 6 × до 20)</td><td style="${td}">2,6 мм, справа</td><td style="${td}">6 pt</td><td style="${td}">19 мм</td></tr>
<tr><td style="${td}">C1 – конверт, лицо</td><td style="${td}">≈ 58 × 85 мм</td><td style="${td}">12 × до 36 мм</td><td style="${td}">5,8 мм, 2 строки</td><td style="${td}">6 pt</td><td style="${td}">18 мм</td></tr>
<tr><td style="${td}">C2 – конверт, оборот</td><td style="${td}">≈ 58 × 85 мм</td><td style="${td}">7,5 × до 22 мм</td><td style="${td}">2,3 мм, справа</td><td style="${td}">6 pt</td><td style="${td}">–</td></tr>
<tr><td style="${td}">C3 – носитель SIM</td><td style="${td}">носитель поставщика</td><td style="${td}">10 × 10 мм</td><td style="${td}">–</td><td style="${td}">домен 2,7 мм</td><td style="${td}">–</td></tr></table></div>
<div style="display:flex;flex-direction:column;gap:10px"><div style="font-size:19px;font-weight:700">Как вписывается логотип любых пропорций</div><div style="color:${PRN_INK2}">Поле задаётся высотой H и шириной до 3H. Логотип вписывается целиком, без искажения, прижат влево: квадратный занимает квадрат H × H (точечная рамка), широкий растёт вправо до 3H, очень широкий упирается в ширину.</div>
<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:20px">${rat(64,64,'1 : 1 – квадрат H × H')}${rat(128,64,'2 : 1 – 2H по ширине')}${rat(192,44,'4,4 : 1 – по ширине')}${rat(192,32,'6 : 1 – по ширине')}</div>
<div style="color:${PRN_INK2}">Требования к файлу: вектор, без внутренних полей (обрезан по контуру), один цвет. Справа от поля логотипа всегда остаётся место под название программы.</div></div>
<div style="display:flex;flex-direction:column;gap:8px"><div style="font-size:19px;font-weight:700">3. Правила вёрстки</div>
<div>– Синие пунктирные рамки на макетах – допустимые области модулей партнёра. В печать не идут.</div><div>– Логотип всегда слева вверху, в своём поле; название программы – справа на той же линии, выравнивание по правому краю.</div>
<div>– Охранное поле логотипа – 25 % его высоты; к нему ничего не прилегает.</div><div>– Белая бумага, без заливок и без печатной рамки по краю. Край карты и конверта – только линия вырубки (розовый пунктир на макете, в печать не идёт). Разделители 1 px.</div>
<div>– Минимальный размер логотипа: если в логотипе есть надпись, её высота на печати не меньше 1,2 мм. Портал проверяет это при загрузке логотипа и предупреждает партнёра.</div>
<div>– Скретч-карта, переменная печать: код активации (только текстом, без QR – QR под защитным слоем типографии не печатают), серийный номер (из базы OTA) и срок активации – у каждой карты свои. QR на лицевой стороне общий для всего тиража и ведёт на портал.</div>
<div>– Отступы от края: этикетки 10 мм, карта и конверт 3,5–4 мм (безопасная зона), припуск под обрез 2 мм.</div><div>– Языки: скретч-карта – язык(и) страны Заказа; конверт SIM (только для партнёра и монтажников) – один язык, тираж под каждую страну партнёра.</div>
<div>– Не указывать: OTA как собственника, операторов и поставщика, цены, «SIM-карта», MSISDN, PIN.</div></div></div>`;}
const PRN_TPL={B1:prn_tB1,B2:prn_tB2,C1:prn_tC1,C2:prn_tC2,C3:prn_tC3,A1:prn_tA1,A2:prn_tA2,'0':prn_t0};
// physical sheet: page = trim + 2 mm bleed on each side; art scaled to mm; optional CutContour layer (spot colour simulated)
function prn_sheet(type,d,o){o=o||{};const art=PRN_TPL[type](d);if(type==='0')return `<div class="prn-sheet0 ${d.zones?'prn-zones':''}" data-mat="0">${art}</div>`;
 const z=PRN_SZ[type];const k=PRN_PX_MM/z.ppm;const W=Math.round(z.w*100)/100,H=Math.round(z.h*100)/100;
 return `<div class="prn-sheet${o.print?' print':''}" data-mat="${type}" style="width:${W+4}mm;height:${o.print?'calc('+(H+4)+'mm - 0.3mm)':(H+4)+'mm'}"><div class="prn-trim" data-trim style="width:${W}mm;height:${H}mm">
<div class="prn-art ${d.zones?'prn-zones':''}" style="transform:scale(${k})">${art}</div>${o.cut?`<div class="prn-cut" data-layer="CutContour" style="border-radius:${z.r}mm"></div>`:''}</div></div>`;}

/* ---------- datasets: profile, stress (ТЗ 7.2.2) ---------- */
const PRN_STRESS={brandName:'SUPERBRAND AUTO',domain:'connect.superbrand-auto.com',domainShort:'go.superbrand-auto.com',accent:'#B4002D',ink:'#1A1A1A',planName:'SuperBrand Ultimate Plus 3 yrs'};
const PRN_STRESS_MAX={brandName:'SUPERBRAND AUTOMOTIV',domain:'connect.superbrand-automot.com',domainShort:'go.superbrand-auto.com',accent:'#B4002D',ink:'#1A1A1A',planName:'SUPERBRAND ULTIMATE PLUS 3 YRS'};
function prn_stressBrand(which,logo){const s=which==='max'?PRN_STRESS_MAX:PRN_STRESS;const countries={};['UA','KZ','DE'].forEach(cc=>{countries[cc]=Object.assign(prn_defCountry(cc,'+00 000 000 00 00'),{sleeveLang:{UA:'uk',KZ:'kk',DE:'de'}[cc]});});
 const svg=PRN_LOGOS[logo||'sb_wide'];return{brandName:s.brandName,logoSvg:svg,logoCheck:prn_logoCheck(svg),accent:s.accent,ink:s.ink,domain:s.domain,domainShort:s.domainShort,countries,_plan:s.planName};}
// every material × language variant a check run renders
function prn_variants(bv,stress){const out=[];const ccs=stress?['UA','KZ','DE']:prn_ccs();const plans=prn_st().plans.filter(p=>p.active);
 ccs.forEach(cc=>{const pl=stress?[{name:bv._plan,term:36},{name:bv._plan,term:24}]:plans.filter(p=>p.cc===cc);(pl.length?pl:[{name:'[PartnerPlan.name]',term:24}]).forEach(p=>out.push({type:'B1',cc,term:p.term,planName:p.name}));
  out.push({type:'B2',cc},{type:'B2',cc,scratched:true});});
 const langs=stress?PRN_SLEEVE_LANGS:[...new Set(ccs.map(cc=>((bv.countries||{})[cc]||{}).sleeveLang||PRN_SLEEVE_DEF[cc]))];
 langs.forEach(L=>{out.push({type:'C1',lang:L},{type:'C2',lang:L});});out.push({type:'C3'},{type:'A1'},{type:'A2'});
 if(!stress){const h=(S.shipments||[])[0];if(h){const pk=prn_packs(h,500)[0];out.push({type:'A1',pack:pk,ship:h},{type:'A2',carton:prn_cartons(h)[0],ship:h});}}
 return out;}

/* ---------- auto-checks (ТЗ 7.2) ---------- */
let prn_busy=false;
function prn_host(){let h=document.getElementById('prn-host');if(!h){h=document.createElement('div');h.id='prn-host';h.setAttribute('aria-hidden','true');document.body.appendChild(h);}return h;}
function prn_fontLink(){if(document.getElementById('prn-font'))return;const l=document.createElement('link');l.id='prn-font';l.rel='stylesheet';l.href='https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap';document.head.appendChild(l);}
async function prn_fontsReady(){prn_fontLink();try{await Promise.race([Promise.all(['400','500','600','700','800'].map(w=>document.fonts.load(w+' 20px Inter','АаҚқЖж'))),new Promise(r=>setTimeout(r,2500))]);await document.fonts.ready;}catch(e){}
 try{return document.fonts.check('700 20px Inter');}catch(e){return false;}}
const prn_mm=px=>px/PRN_PX_MM;
// inspect one rendered sheet → list of {check, ok, detail}
function prn_inspect(el,type,d){const res=[];const add=(check,ok,detail,warn)=>res.push({check,ok,detail:detail||'',warn:!!warn});
 const root=el.querySelector('[data-root]');
 // 1 overflow: root and every fixed box / overflow:hidden block
 const over=[];const chk=(n,lbl,w)=>{if(n.scrollHeight>n.clientHeight+1)over.push(lbl+' ↕ '+(n.scrollHeight-n.clientHeight)+'px');if(w&&n.scrollWidth>n.clientWidth+1)over.push(lbl+' ↔ '+(n.scrollWidth-n.clientWidth)+'px');};
 if(type!=='0')chk(root,'root',true);
 el.querySelectorAll('[data-fix]').forEach(n=>chk(n,n.getAttribute('data-fix'),false));
 el.querySelectorAll('[data-fixw]').forEach(n=>{const r=n.getBoundingClientRect(),pr=root.getBoundingClientRect();if(r.right>pr.right+0.5||r.left<pr.left-0.5)over.push(n.getAttribute('data-fixw')+' ↔ outside');if(n.scrollWidth>n.clientWidth+1)over.push(n.getAttribute('data-fixw')+' ↔ '+(n.scrollWidth-n.clientWidth)+'px');});
 root.querySelectorAll('*').forEach(n=>{const cs=getComputedStyle(n);if((cs.overflow==='hidden'||cs.overflowY==='hidden')&&n.scrollHeight>n.clientHeight+1)over.push((n.getAttribute('data-fix')||n.tagName.toLowerCase())+' hidden ↕');});
 // children escaping the root box (absolute zone labels excluded)
 const rb=root.getBoundingClientRect();root.querySelectorAll('*').forEach(n=>{if(n.closest('.prn-zl')||n.closest('svg'))return;const b=n.getBoundingClientRect();if(!b.width||!b.height)return;if(type!=='0'&&(b.bottom>rb.bottom+1||b.right>rb.right+1)){over.push('escapes: '+(n.getAttribute('data-fix')||n.getAttribute('data-fixw')||n.tagName.toLowerCase()));}});
 add('overflow',!over.length,[...new Set(over)].slice(0,6).join('; '));
 // 4 sizes: trim / bleed vs spec ±0.1 mm, logo field, QR side
 if(type!=='0'){const z=PRN_SZ[type];const tb=el.querySelector('[data-trim]').getBoundingClientRect(),sb=el.getBoundingClientRect();const tw=prn_mm(tb.width),th=prn_mm(tb.height),bw=prn_mm(sb.width),bh=prn_mm(sb.height);
  const okT=Math.abs(tw-z.w)<=0.1&&Math.abs(th-z.h)<=0.1,okB=Math.abs(bw-z.w-4)<=0.1&&Math.abs(bh-z.h-4)<=0.1;
  const f=el.querySelector('[data-fix=logo]');let lf='';let okL=true;const spec=PRN_SPEC[type];
  if(f&&spec){const fb=f.getBoundingClientRect();const fh=prn_mm(fb.height),fw=prn_mm(fb.width);okL=Math.abs(fh-spec.logo[0])<=0.1&&Math.abs(fw-spec.logo[1])<=0.1;
   const im=f.querySelector('img').getBoundingClientRect();if(prn_mm(im.width)>spec.logo[1]+0.1||prn_mm(im.height)>spec.logo[0]+0.1||im.left<fb.left-0.5)okL=false;lf=` · logo field ${fmtNum(fh,2)} × ${fmtNum(fw,2)} mm, logo ${fmtNum(prn_mm(im.width),2)} × ${fmtNum(prn_mm(im.height),2)} mm`;}
  let qf='';let okQ=true;const q=el.querySelector('[data-fix=qr]');if(q&&spec&&spec.qr){const qb=q.getBoundingClientRect();okQ=Math.abs(prn_mm(qb.width)-spec.qr)<=0.1;qf=` · QR ${fmtNum(prn_mm(qb.width),2)} mm`;}
  add('sizes',okT&&okB&&okL&&okQ,`trim ${fmtNum(tw,2)} × ${fmtNum(th,2)} mm, bleed ${fmtNum(bw,2)} × ${fmtNum(bh,2)} mm${lf}${qf}`);
  // min text: 6 pt (A: 9 pt) on printed material (C3 explanatory panel and zone labels excluded)
  const minPt=type[0]==='A'?9:6;let low=null;const k=PRN_PX_MM/z.ppm;
  (type==='C3'?el.querySelectorAll('[data-carrier] [data-fixw]'):root.querySelectorAll('*')).forEach(n=>{if(n.closest('.prn-zl')||n.closest('svg')||!n.childNodes.length)return;if(![...n.childNodes].some(c=>c.nodeType===3&&c.textContent.trim()))return;
   if(type==='C3')return;const fs=parseFloat(getComputedStyle(n).fontSize)*k;const pt=fs/PRN_PX_MM*72/25.4;if(pt<minPt-0.06&&(!low||pt<low.pt))low={pt,txt:n.textContent.trim().slice(0,30)};});
  if(type==='C3'){const dn=el.querySelector('[data-carrier] [data-fixw=domain]');const fsMm=parseFloat(dn.getAttribute('data-fs'))/9.2;add('mintext',fsMm>=2-0.01,`domain ${fmtNum(fsMm,2)} mm (≥ 2,0 mm)`);}
  else add('mintext',!low,low?`${fmtNum(low.pt,1)} pt < ${minPt} pt: «${low.txt}»`:`≥ ${minPt} pt`);
  // print frame: the edge is the CutContour line only (no printed border on cards / sleeves)
  if(type[0]==='B'||type[0]==='C'){const cs=getComputedStyle(root);const frame=parseFloat(cs.borderTopWidth)>0||(!d.zones&&cs.outlineStyle!=='none'&&parseFloat(cs.outlineWidth)>0);add('noframe',!frame,frame?'border on root':'');}}
 // 3 QR: self-decode every QR on the material
 el.querySelectorAll('svg[data-qr]').forEach(s=>{const want=s.getAttribute('data-qr');const q=prnQr(want);const got=q?prnQrDecodeMatrix(q.mods):null;add('qr',got===want,`v${q?q.version:'?'}-M · ${got==null?'no decode':got}`);});
 // A1 barcodes: values encodable, quiet zone, module ≥ 0.19 mm
 el.querySelectorAll('svg[data-c128]').forEach(s=>{const v=s.getAttribute('data-c128');const mods=prnC128Modules(v);const w=prn_mm(s.getBoundingClientRect().width)*(PRN_SZ.A1.ppm/PRN_PX_MM);const mw=w/mods;add('code128',mods>0&&mw>=0.19,`${v} · ${mods} modules · module ${fmtNum(mw,3)} mm`);});
 // wording
 const txt=root.textContent;add('wording',txt.indexOf(PRN_WTA)<0,txt.indexOf(PRN_WTA)>=0?t('prn.ck.wtaFound'):'');
 return res;}
async function prn_runChecks(bv,o){o=o||{};const fontOk=await prn_fontsReady();const host=prn_host();const out=[];const stress=!!o.stress;
 const add=(mat,variant,check,ok,detail,warn)=>out.push({mat,variant,check,ok,detail,warn:!!warn});
 // contrast + logo (profile level)
 const cr=prn_contrast(bv.accent);add('*','',  'contrast',cr>=4.5,`accent ${bv.accent} · ${fmtNum(cr,2)} : 1`);
 const lc=prn_logoCheck(bv.logoSvg);add('*','','logo',lc.ok,lc.ok?`vector ✓ · raster ✗ · ${lc.vb?fmtNum(lc.vb.w/lc.vb.h,2)+':1':''}${lc.errs.length?' · '+lc.errs.join(','):''}`:lc.errs.map(x=>t('prn.lc.'+x)).join(' '));
 add('*','','wordmark',!lc.warns.includes('wordmark'),lc.hasWordmark?`${fmtNum(lc.wordmarkMm,2)} mm in C2 (≥ 1,2 mm)`:t('prn.w.noText'),true);
 const dom=String(bv.domain||'');add('*','','domain',dom.length<=30&&(dom.length<=24||String(bv.domainShort||'').length>0&&String(bv.domainShort).length<=24),`${dom.length} / 30 · sleeve ${String(bv.domainShort||dom).length} / 24`);
 for(const v of prn_variants(bv,stress)){const d=prn_data(bv,{cc:v.cc||'UA',lang:v.lang,term:v.term,planName:v.planName,scratched:v.scratched,pack:v.pack,carton:v.carton,deadline:v.type==='B2'?iso(addMonths(now(),36)):null,plans:prn_st().plans});
  host.innerHTML=prn_sheet(v.type,d,{cut:true});await new Promise(r=>requestAnimationFrame(()=>r()));const el=host.firstElementChild;
  const label=[v.cc,v.lang,v.term?v.term+'m':'',v.scratched?'scratched':'',v.pack?'shipment':'',v.carton?'shipment':''].filter(Boolean).join(' · ');
  prn_inspect(el,v.type,d).forEach(r=>{if(stress&&r.check==='wording')return;add(v.type,label,r.check,r.ok,r.detail,r.warn);});}
 host.innerHTML='';return{at:iso(now()),font:fontOk,results:out};}
function prn_sumFor(res,type){const r=(res||[]).filter(x=>(x.mat===type||x.mat==='*')&&!x.warn);return{fail:r.filter(x=>!x.ok),n:r.length};}

/* ---------- releases (ТЗ 7.3): OTA-PPP-PRN-{type}-{NNN}-v{N}; released runs are immutable ---------- */
function prn_runKey(r){return [r.type,r.cc||'',r.lang||'',r.planId||''].join('|');}
function prn_runNo(type,key,brandId){const p=prn_st();const prev=p.runs.filter(r=>prn_runKey(r)===key);const P=(S.org&&S.org.code)||'PPP';
 if(prev.length){const last=prev[prev.length-1];if(last.brandId===brandId&&last.tplVer===PRN_TPL_VER)return{dup:last};return{no:last.no.replace(/-v\d+$/,'-v'+(last.v+1)),nnn:last.nnn,v:last.v+1};}
 const nnn=(p.seq[type]||0)+1;return{no:`OTA-${P}-PRN-${type}-${pad(nnn,3)}-v1`,nnn,v:1,fresh:true};}
function prn_release(o){const p=prn_st();const bv=prn_approved();if(!bv)return{err:'noBrand'};
 const chk=p.lastCheck;if(!chk||chk.brandId!==bv.id||chk.tplVer!==PRN_TPL_VER)return{err:'noCheck'};
 const own=chk.results.filter(r=>(r.mat===o.type||r.mat==='*')&&!r.warn&&!r.ok&&(!o.cc||!r.variant||r.variant.indexOf(o.cc)===0||o.type[0]!=='B')&&(!o.lang||o.type[0]!=='C'||!r.variant||r.variant===o.lang));
 const st=(chk.stress||[]).filter(r=>(r.mat===o.type||r.mat==='*')&&!r.warn&&!r.ok);
 if(own.length||st.length)return{err:'checks',fails:own.concat(st)};
 const key=prn_runKey(o);const n=prn_runNo(o.type,key,bv.id);if(n.dup)return{err:'dup',run:n.dup};if(n.fresh)p.seq[o.type]=n.nnn;
 const snap={brandName:bv.brandName,logoSvg:bv.logoSvg,accent:bv.accent,accentCmyk:bv.accentCmyk||prn_cmyk(bv.accent),ink:bv.ink,domain:bv.domain,domainShort:bv.domainShort,countries:JSON.parse(JSON.stringify(bv.countries||{}))};
 const pl=o.planId?prn_plan(o.planId):null;
 const run={id:uid('pr'),no:n.no,nnn:n.nnn,v:n.v,type:o.type,cc:o.cc||'',lang:o.lang||'',planId:o.planId||'',plan:pl?{name:pl.name,sku:pl.sku,pkg:pl.pkg,term:pl.term}:null,brandId:bv.id,brandVer:bv.version,tplVer:PRN_TPL_VER,snap,
  sizes:PRN_SZ[o.type],checkAt:chk.at,createdAt:iso(now()),by:actorName(),role:(actor()||{}).role||''};
 p.runs.push(run);audit('print.release',run.no,{type:run.type,cc:run.cc,lang:run.lang,plan:pl?pl.sku:'',brandVersion:bv.version,template:PRN_TPL_VER});log(t('prn.r.log',{n:run.no}));return{run};}

/* ---------- card batches (ТЗ 5, 8 CardBatch / ActivationCode) ---------- */
// Activation Keys per country: reads the commercial helpers when present (keyLots with cc, or a pooled shape), reserves keys per lot
function prn_keysFree(cc){try{if(typeof keysAvail==='function'){const n=keysAvail(cc);if(isFinite(n))return n;}}catch(e){}
 return (S.keyLots||[]).filter(l=>(l.cc||primaryCc())===cc&&!l.revoked).reduce((a,l)=>a+Math.max(0,l.qty-l.used-(l.reserved||0)),0);}
function prn_keysReserved(cc){return (S.keyLots||[]).filter(l=>(l.cc||primaryCc())===cc&&!l.revoked).reduce((a,l)=>a+(l.prnRes||0),0);}
function prn_reserveKeys(cc,n){const lots=(S.keyLots||[]).filter(l=>(l.cc||primaryCc())===cc&&!l.revoked).sort((a,b)=>a.issuedAt<b.issuedAt?-1:1);const take=[];let left=n;
 for(const l of lots){if(left<=0)break;const free=Math.max(0,l.qty-l.used-(l.reserved||0));const k=Math.min(free,left);if(k>0){l.reserved=(l.reserved||0)+k;l.prnRes=(l.prnRes||0)+k;take.push([l.id,k]);left-=k;}}
 if(left>0){take.forEach(([id,k])=>{const l=S.keyLots.find(x=>x.id===id);l.reserved-=k;l.prnRes-=k;});return null;}return take;}
function prn_releaseKey(c){if(!c||!c.keyResLotId)return;const l=(S.keyLots||[]).find(x=>x.id===c.keyResLotId);if(l){l.reserved=Math.max(0,(l.reserved||0)-1);l.prnRes=Math.max(0,(l.prnRes||0)-1);}delete c.keyResLotId;}
function prn_tokensFree(pkg,term,cc){try{return tokensAvail(pkgKey(pkg,term),cc);}catch(e){return 0;}}
function prn_batchNo(){const p=prn_st();const n=(p.seq.CB||0)+1;p.seq.CB=n;return 'CB-'+((S.org&&S.org.code)||'PPP')+'-'+pad(n,4);}
function prn_codesOf(b){return (S.codes||[]).filter(c=>c.batchId===b.id);}
function prn_batchCreate(o){const pl=prn_plan(o.planId);if(!pl||!pl.active)return{err:'plan'};const qty=o.qty|0;if(qty<1||qty>5000)return{err:'qty'};
 const cc=pl.cc;if(prn_keysFree(cc)<qty)return{err:'keys',free:prn_keysFree(cc)};const bv=prn_approved();if(!bv)return{err:'brand'};
 const run=o.runId?prn_run(o.runId):null;const res=prn_reserveKeys(cc,qty);if(!res)return{err:'keys',free:prn_keysFree(cc)};
 const printDate=o.printDate||iso(now()).slice(0,10);const deadline=o.deadline||iso(addMonths(new Date(printDate+'T12:00:00'),36)).slice(0,10);if(deadline<iso(now()).slice(0,10)){prn_st();(S.keyLots||[]).forEach(l=>{const x=res.find(r=>r[0]===l.id);if(x){l.reserved-=x[1];l.prnRes-=x[1];}});return{err:'deadline'};}
 const sFrom=prn_serialAlloc(qty);const ts=iso(now());const b={id:uid('cb'),no:prn_batchNo(),planId:pl.id,plan:{name:pl.name,sku:pl.sku,pkg:pl.pkg,term:pl.term},cc,qty,serialFrom:sFrom,serialTo:sFrom+qty-1,printDate,deadline,
  runId:run?run.id:'',runNo:run?run.no:'',brandId:bv.id,brandVer:bv.version,status:'generated',createdAt:ts,by:actorName(),keyRes:res,downloads:[],blocks:[]};
 const seen=new Set((S.codes||[]).map(c=>c.code));const lotQ=res.map(x=>x.slice());S.codes=S.codes||[];
 for(let i=0;i<qty;i++){let code;do{code=prnCodeGen();}while(seen.has(code));seen.add(code);const lq=lotQ.find(x=>x[1]>0);lq[1]--;
  S.codes.push({code,serial:prn_serialFmt(sFrom+i),serialNo:sFrom+i,batchId:b.id,planId:pl.id,plan:pl.pkg,term:pl.term,cc,deadline,status:'generated',reseller:o.reseller||null,createdAt:ts,activatedAt:null,iccid:null,voidAt:null,keyResLotId:lq[0]});}
 prn_st().batches.unshift(b);audit('print.batch.create',b.no,{plan:pl.sku,cc,qty,serialFrom:prn_serialFmt(b.serialFrom),serialTo:prn_serialFmt(b.serialTo),deadline,run:b.runNo,keysReserved:qty});
 log(t('prn.b.log',{n:b.no,q:fmtNum(qty)}));return{batch:b};}
function prn_csv(b){const rows=['serial;code;deadline'];prn_codesOf(b).forEach(c=>rows.push(c.serial.replace(/ /g,'')+';'+prnCodeFmt(c.code)+';'+prn_ddmmyyyy(c.deadline)));return rows.join('\r\n')+'\r\n';}
function prn_download(name,text,type){try{const blob=new Blob(['﻿'+text],{type:type||'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);return true;}catch(e){return false;}}
function prn_export(b,o){const first=!b.downloads.length;if(!first&&!(S.admin&&prn_canOta()&&String(o.reason||'').trim()))return{err:'again'};
 const name=`${b.no}_serial-code-deadline.csv`;const ok=prn_download(name,prn_csv(b));if(!ok)return{err:'file'};
 const e={at:iso(now()),by:actorName(),role:(actor()||{}).role||'',to:String(o.to||'').trim(),reason:first?'':String(o.reason).trim(),n:b.qty,file:name};b.downloads.push(e);prn_st().csvLog.push(Object.assign({batch:b.no},e));
 if(first){b.status='exported';b.exportedAt=e.at;prn_codesOf(b).forEach(c=>{if(c.status==='generated')c.status='exported_for_print';});}
 audit(first?'print.csv.export':'print.csv.reexport',b.no,{codes:b.qty,recipient:e.to,reason:e.reason,file:name,encrypted:'demo-simulated'});return{ok:true,e};}
function prn_markPrinted(b){if(b.status!=='exported')return false;b.status='printed';b.printedAt=iso(now());b.printedBy=actorName();let n=0;prn_codesOf(b).forEach(c=>{if(c.status==='exported_for_print'){c.status='printed';n++;}});
 audit('print.batch.printed',b.no,{codes:n,by:actorName()});return n;}
// block by serial, by serial range, by whole batch (lost / stolen run)
function prn_block(o){const reason=o.reason||'lost';const at=iso(now());let list=[];const all=(S.codes||[]).filter(prn_isNewCode);
 if(o.mode==='batch'){const b=prn_batch(o.batchId);if(!b)return{err:'nf'};list=prn_codesOf(b);}
 else{const a=+digits(o.from),z=o.mode==='range'?+digits(o.to):a;if(!a||!z||z<a)return{err:'range'};if(z-a>100000)return{err:'range'};list=all.filter(c=>c.serialNo>=a&&c.serialNo<=z);}
 if(!list.length)return{err:'nf'};let n=0;const touched=new Set();
 list.forEach(c=>{if(['activated','blocked','expired'].includes(c.status))return;c.status='blocked';c.voidAt=at;c.blockedAt=at;c.blockReason=reason;prn_releaseKey(c);touched.add(c.batchId);n++;});
 touched.forEach(id=>{const b=prn_batch(id);if(b)b.blocks.push({at,by:actorName(),mode:o.mode,from:o.from||'',to:o.to||'',n:list.filter(c=>c.batchId===id&&c.blockedAt===at).length,reason});});
 if(n)audit('print.code.block',o.mode==='batch'?(prn_batch(o.batchId)||{}).no:prn_serialFmt(+digits(o.from)),{mode:o.mode,from:o.from||'',to:o.to||'',codes:n,reason});prn_bridgePush();return{n,skipped:list.length-n};}
// demo redeem (ТЗ 5.2): normalise, check character, status checks, then the shared activation rules (1 token of the plan + 1 key for a new device)
function prnRedeem(raw,iccid){const c0=prnCodeNorm(raw);if(c0.length!==12)return{err:'format'};if(!prnCodeCheck(c0))return{err:'check'};
 const c=(S.codes||[]).find(x=>x.code===c0&&prn_isNewCode(x));if(!c)return{err:'unknown'};prn_expire();
 if(c.status==='activated')return{err:'used'};if(c.status==='blocked')return{err:'blocked'};if(c.status==='expired')return{err:'expired',deadline:c.deadline};if(c.status!=='printed')return{err:'notprinted'};
 const s=(S.sims||[]).find(x=>x.iccid===iccid);if(!s)return{err:'nosim'};if(s.status!=='active')return{err:'siminactive'};if(s.plan)return{err:'simhas'};
 const m=findModel(s.modelId);if(!m||m.model.planStatus!=='approved'||m.model.plan!==c.plan)return{err:'plan'};
 let simC=null;try{simC=simCc(s);}catch(e){}if(simC&&c.cc&&simC!==c.cc)return{err:'country'};
 // deviceActivate spends the key reserved for this card (c.keyResLotId); on failure the reservation stays in place
 const r=deviceActivate(s,{via:'token',code:c});if(r.err)return{err:r.err};
 audit('print.code.redeem',prn_mask(c.code),{serial:c.serial,iccid:s.iccid,batch:(prn_batch(c.batchId)||{}).no||''});prn_bridgePush();return{ok:true,c,s};}
function prn_expire(){const ts=iso(now()).slice(0,10);let n=0;(S.codes||[]).forEach(c=>{if(!prn_isNewCode(c))return;if(['generated','exported_for_print','printed'].includes(c.status)&&c.deadline&&c.deadline<ts){c.status='expired';c.expiredAt=iso(now());prn_releaseKey(c);n++;}
  else if(['activated','blocked','expired'].includes(c.status)&&c.keyResLotId)prn_releaseKey(c);});
 prn_st().batches.forEach(b=>{if(b.status==='printed'&&prn_codesOf(b).every(c=>['activated','blocked','expired'].includes(c.status)))b.status='closed';});return n;}
function prn_batchStats(b){const r={generated:0,exported_for_print:0,printed:0,activated:0,blocked:0,expired:0};prn_codesOf(b).forEach(c=>{r[c.status]=(r[c.status]||0)+1;});return r;}
// customer-portal bridge (cfb-demo-ownership.codes): serial + country + status of the new codes; only printed codes are redeemable ('new')
const PRN_BRIDGE='cfb-demo-ownership';
function prn_bridgeStatus(c){return c.status==='activated'?'redeemed':c.status==='printed'?'new':'blocked';}
function prn_bridgePush(){if(!S||!S.authed||!S.org)return false;let b=null;try{b=JSON.parse(localStorage.getItem(PRN_BRIDGE)||'null');}catch(e){}if(!b||typeof b!=='object'||!b.sims)return false;
 b.codes=b.codes&&typeof b.codes==='object'?b.codes:{};const P=(S.org&&S.org.code)||'ARV';let dirty=false;
 (S.codes||[]).forEach(c=>{if(!prn_isNewCode(c))return;let r=b.codes[c.code];
  if(r&&r.status==='redeemed'&&c.status==='printed'){prn_fromPortal(c,r);}
  const st=prn_bridgeStatus(c);const want={partner:P,serial:c.serial.replace(/ /g,''),plan:c.plan,term:c.term,cc:c.cc,batch:(prn_batch(c.batchId)||{}).no||'',deadline:c.deadline,format:'v14'};
  if(!r){r=b.codes[c.code]=Object.assign({status:st,device_id:null,redeemed_at:null,blocked_at:null},want);dirty=true;}
  Object.keys(want).forEach(k=>{if(r[k]!==want[k]){r[k]=want[k];dirty=true;}});
  if(r.status!=='redeemed'&&r.status!==st){r.status=st;if(st==='blocked'){r.blocked_at=c.blockedAt||c.expiredAt||iso(now());r.blocked_reason=c.status==='expired'?'expired':c.status==='blocked'?(c.blockReason||'lost'):'not_printed';}else{r.blocked_at=null;delete r.blocked_reason;}dirty=true;}});
 if(dirty){b.rev=(b.rev||0)+1;b.updated_at=iso(now());b.updated_by='partner-console';try{localStorage.setItem(PRN_BRIDGE,JSON.stringify(b));}catch(e){}}return dirty;}
// a printed code redeemed in the portal → activate here with the shared rules (45_codes handles only the old 16-char codes)
function prn_fromPortal(c,r){const dev=String(r.device_id||'');let b=null;try{b=JSON.parse(localStorage.getItem(PRN_BRIDGE)||'null');}catch(e){}
 const bd=b&&(b.bindings||[]).find(x=>x.device_id===dev&&x.status!=='ended');const s=(S.sims||[]).find(x=>x.imei===dev||x.iccid===dev||(bd&&x.iccid===bd.iccid));
 if(!s||s.plan){c.bridgePending={reason:s?'has_plan':'no_sim',at:iso(now())};return;}const res=deviceActivate(s,{via:'token',code:c});   // spends the reserved key (c.keyResLotId)
 if(res.err){c.bridgePending={reason:res.err,at:iso(now())};return;}
 delete c.bridgePending;c.redeemedIn='portal';audit('print.code.redeem',prn_mask(c.code),{serial:c.serial,iccid:s.iccid,via:'portal'});}

/* ---------- shipment labels (A1 per pack, A2 per carton) ---------- */
function prn_lotNo(h){return 'LOT-'+String(h.pf||'').replace(/^OTA-PF-/,'');}
function prn_packs(h,size){size=size||500;const n=(h.receipt?h.receipt.received:h.qty)||h.qty;const out=[];let i=0,p=1;while(i<h.qty){const q=Math.min(size,h.qty-i);out.push({lot:prn_lotNo(h)+'-P'+p,qty:q,first:genIccid(h.iccidFrom+i),last:genIccid(h.iccidFrom+i+q-1),pf:h.pf,sr:h.sr});i+=q;p++;}return out;}
function prn_cartons(h,size){const M=Math.max(1,parseInt(h.cartons,10)||1);const packs=prn_packs(h,size);const per=Math.ceil(packs.length/M);const out=[];
 for(let i=0;i<M;i++){const ps=packs.slice(i*per,(i+1)*per);const qty=ps.reduce((a,x)=>a+x.qty,0);const g=parseFloat(h.gross),nw=parseFloat(h.netw);
  out.push({i:i+1,n:M,qty,ship:h,lots:ps.length?(ps[0].lot+(ps.length>1?'…'+ps[ps.length-1].lot.split('-').pop():'')+' ×'+ps.length):'—',gross:isFinite(g)?String(Math.round(g/M*10)/10):'',net:isFinite(nw)?String(Math.round(nw/M*10)/10):''});}return out;}

/* ---------- print (browser Print / Save as PDF at physical size; production PDF/X is server-side) ---------- */
function prn_print(sheets,wmm,hmm){prn_fontLink();let root=document.getElementById('prn-print');if(!root){root=document.createElement('div');root.id='prn-print';document.body.appendChild(root);}root.innerHTML=sheets;
 let st=document.getElementById('prn-page');if(!st){st=document.createElement('style');st.id='prn-page';document.head.appendChild(st);}st.textContent=`@page{size:${wmm}mm ${hmm}mm;margin:0}`;
 document.documentElement.classList.add('prn-printing');const done=()=>{document.documentElement.classList.remove('prn-printing');root.innerHTML='';window.removeEventListener('afterprint',done);};window.addEventListener('afterprint',done);
 setTimeout(()=>{try{window.print();}catch(e){done();}},60);}

/* ---------- UI helpers ---------- */
function prn_ui(){S.ui=S.ui||{};if(!S.ui.prn)S.ui.prn={mat:'B1',cc:'',plan:'',lang:'',zones:false,scratched:false,src:'work',ds:'profile',zoom:'1',cut:false,bf:'',bpage:1,cpage:1,cq:'',packSize:500};return S.ui.prn;}
function prn_stBadge(st){const tone={draft:'',submitted:'warn',approved:'ok',rejected:'bad',superseded:''}[st];return ui.badge(t('prn.bs.'+st),tone,true);}
function prn_bBadge(st){const tone={generated:'',exported:'info',printed:'ok',closed:''}[st];return ui.badge(t('prn.bst.'+st),tone,true);}
function prn_cBadge(st){const tone={generated:'',exported_for_print:'info',printed:'accent',activated:'ok',blocked:'bad',expired:'warn'}[st];return ui.badge(t('prn.cst.'+st),tone,true);}
function prn_tabs(cur){return ui.tabs([['prn',t('prn.tab.brand'),'#prn'],['prn-plans',t('prn.tab.plans'),'#prn-plans'],['prn-mat',t('prn.tab.mat'),'#prn-mat'],['prn-checks',t('prn.tab.checks'),'#prn-checks'],['prn-runs',t('prn.tab.runs'),'#prn-runs']],cur);}
function prn_noAccess(){return ui.page({title:t('prn.title'),body:ui.card({body:ui.empty('shield',t('prn.na.t'),t('prn.na.p'))})});}
function prn_logoPreview(bv){if(!bv.logoSvg)return `<div class="prn-lp empty">${t('prn.f.noLogo')}</div>`;const lc=prn_logoCheck(bv.logoSvg);const vb=lc.vb||{w:1,h:1};
 const cell=(lbl,field)=>{const px=4;const H=field[0]*px,W=field[1]*px;const f=prn_logoFit(vb,[H,W]);return `<div class="prn-lpc"><div class="prn-lpf" style="width:${W}px;height:${H}px"><img src="${prn_logoUri(bv.logoSvg)}" alt="" style="width:${f.w}px;height:${f.h}px"><i style="width:${Math.min(H,W)}px;height:${H}px"></i></div><span class="xs muted">${lbl} · ${field[0]} × ${field[1]} mm</span></div>`;};
 return `<div class="prn-lp">${cell('A1/A2',PRN_SPEC.A1.logo)}${cell('B1',PRN_SPEC.B1.logo)}${cell('C1',PRN_SPEC.C1.logo)}${cell('C2',PRN_SPEC.C2.logo)}${cell('B2',PRN_SPEC.B2.logo)}${cell('C3',PRN_SPEC.C3.logo)}</div>`;}
function prn_logoReport(bv){if(!bv.logoSvg)return '';const lc=prn_logoCheck(bv.logoSvg);const li=(ok,txt,warn)=>`<li class="${ok?'ok':warn?'warn':'bad'}">${icon(ok?'check':'alert','sm')}<span>${txt}</span></li>`;
 return `<ul class="prn-ck">${li(!lc.errs.includes('notsvg')&&!lc.errs.includes('parse'),t('prn.lr.vector'))}${li(!lc.errs.includes('raster'),t('prn.lr.raster'))}${li(!lc.warns.includes('colors'),t('prn.lr.colors',{n:lc.colors.filter(c=>c!=='#ffffff').length||1}),true)}
 ${lc.vb?li(true,t('prn.lr.ratio',{r:fmtNum(lc.vb.w/lc.vb.h,2)})):li(false,t('prn.lc.size'))}
 ${lc.hasWordmark?li(!lc.warns.includes('wordmark'),t('prn.lr.wordmark',{mm:fmtNum(lc.wordmarkMm,2)}),true):li(true,t('prn.w.noText'),true)}</ul>`;}
function prn_sw(c){return `<span class="prn-sw" style="background:${esc(prn_hex(c)||'#fff')}"></span>`;}

/* ---------- routes & nav ---------- */
nav({key:'prn',label:()=>t('prn.nav'),icon:'printer',href:'#prn',order:42,section:()=>t('c.secWarehouse'),count:()=>{if(!S.org||!S.prn)return null;const b=prn_latest();return S.admin&&b&&b.status==='submitted'?1:null;}});
nav({key:'prn-batches',label:()=>t('prn.nav.batches'),icon:'card',href:'#prn-batches',order:43,section:()=>t('c.secWarehouse')});

/* ===== Brand profile ===== */
route('prn',{nav:'prn',render(){if(!prn_canView())return prn_noAccess();const p=prn_st();const cur=prn_latest();const ap=prn_approved();
 if(!cur)return ui.page({title:t('prn.title'),body:ui.empty('printer',t('prn.na.t'),'')});
 const editable=cur.status==='draft'&&prn_canEdit();const v=prn_validate(cur);const e=S.ui.prn_errs||{};
 const actions=[];if(cur.status==='draft'&&prn_canEdit())actions.push(ui.btn(t('prn.b.submit'),{kind:'primary',act:'prn_submit',icon:'send',disabled:!v.ok}));
 if((cur.status==='approved'||cur.status==='rejected')&&prn_canEdit())actions.push(ui.btn(t('prn.b.newVer'),{kind:'primary',act:'prn_newVer',icon:'plus'}));
 if(cur.status==='submitted'&&prn_canOta()){actions.push(ui.btn(t('prn.b.reject'),{kind:'danger',act:'prn_reject'}),ui.btn(t('prn.b.approve'),{kind:'primary',act:'prn_approve',icon:'check'}));}
 const head=`<div class="row wrap g8" style="align-items:center">${prn_stBadge(cur.status)}<span class="small muted">${t('prn.verN',{n:cur.version})}${ap&&ap.id!==cur.id?' · '+t('prn.apInUse',{n:ap.version}):''}</span></div>`;
 let notes='';if(cur.status==='submitted')notes+=ui.note(S.admin?'admin':'info',S.admin?t('prn.n.otaReview'):t('prn.n.submitted'));if(cur.status==='rejected'&&cur.note)notes+=ui.note('bad',t('prn.n.rejected',{r:esc(cur.note)}));
 if(cur.status==='approved')notes+=ui.note('ok',t('prn.n.approved',{d:fmtDate(cur.approvedAt),by:esc(cur.approvedBy||'')}));
 if(!prn_canEdit()&&!S.admin)notes+=ui.note('info',t('prn.n.readOnly'));
 if(v.warns.length)notes+=ui.note('warn',v.warns.map(esc).join('<br>'));
 const dis=editable?'':'disabled';const fe=k=>e[k]||(editable?'':'');
 const ctyRows=prn_ccs().map(cc=>{const c=(cur.countries||{})[cc]||prn_defCountry(cc);return `<tr><td><b>${esc(ctyName(cc))}</b> <span class="xs faint">${cc}</span></td><td>${(c.cardLangs||PRN_CARD_LANGS[cc]||['en']).map(l=>ui.badge(l)).join(' ')}</td>
  <td><select class="inp" name="sl_${cc}" ${dis} aria-label="${esc(t('prn.f.sleeve')+' '+cc)}">${PRN_SLEEVE_LANGS.map(l=>`<option value="${l}" ${c.sleeveLang===l?'selected':''}>${l}</option>`).join('')}</select></td>
  <td><input class="inp mono" name="phone_${cc}" value="${esc(c.phone||'')}" ${dis} ${e['phone_'+cc]?'aria-invalid="true"':''} aria-label="${esc(t('prn.f.phone')+' '+cc)}" placeholder="+…">${e['phone_'+cc]?`<span class="err">${e['phone_'+cc]}</span>`:''}</td></tr>`;}).join('');
 const form=`<form data-form="prn_brand" id="prn_bf" class="stack" novalidate>
 <div class="grid2">${ui.field({id:'brandName',label:t('prn.f.brand'),value:cur.brandName,err:fe('brandName'),hint:t('prn.f.brandH'),attrs:`maxlength="20" ${dis}`})}
 ${ui.field({id:'domain',label:t('prn.f.domain'),value:cur.domain,err:fe('domain'),hint:t('prn.f.domainH',{n:String(cur.domain||'').length}),mono:true,attrs:`maxlength="40" ${dis}`})}</div>
 <div class="grid2">${ui.field({id:'domainShort',label:t('prn.f.short'),value:cur.domainShort||'',err:fe('domainShort'),hint:t('prn.f.shortH'),mono:true,attrs:`maxlength="30" ${dis}`})}
 <div class="field"><label for="prn_accent">${t('prn.f.accent')}</label><div class="row g8"><input type="color" class="prn-color" value="${esc(prn_hex(cur.accent)||'#000000')}" data-prncolor="accent" ${dis} aria-label="${esc(t('prn.f.accent'))}"><input class="inp mono" id="prn_accent" name="accent" value="${esc(cur.accent)}" maxlength="7" ${dis} ${e.accent?'aria-invalid="true"':''}></div>
  ${e.accent?`<span class="err">${e.accent}</span>`:`<span class="hint">${t('prn.f.accentH',{r:fmtNum(prn_contrast(cur.accent),2)})}</span>`}</div></div>
 <div class="grid2"><div class="field"><label for="prn_ink">${t('prn.f.ink')}</label><div class="row g8"><input type="color" class="prn-color" value="${esc(prn_hex(cur.ink)||'#000000')}" data-prncolor="ink" ${dis} aria-label="${esc(t('prn.f.ink'))}"><input class="inp mono" id="prn_ink" name="ink" value="${esc(cur.ink)}" maxlength="7" ${dis} ${e.ink?'aria-invalid="true"':''}></div>${e.ink?`<span class="err">${e.ink}</span>`:`<span class="hint">${t('prn.f.inkH')}</span>`}</div>
 ${ui.field({id:'accentCmyk',label:t('prn.f.cmyk'),value:cur.accentCmyk||'',hint:t('prn.f.cmykH',{c:prn_cmyk(cur.accent)}),attrs:`maxlength="40" ${dis}`})}</div>
 <div class="field"><span class="lbl">${t('prn.f.logo')}</span>${prn_logoPreview(cur)}
  <div class="row wrap g8" style="align-items:center">${editable?`<label class="btn sm"><input type="file" accept=".svg,image/svg+xml" class="prn-file" data-act="prn_logoFile" aria-label="${esc(t('prn.f.upload'))}">${icon('upload','sm')}<span>${t('prn.f.upload')}</span></label>`:''}<span class="xs muted">${esc(cur.logoName||'')}</span></div>
  ${e.logo?`<span class="err">${e.logo}</span>`:`<span class="hint">${t('prn.f.logoH')}</span>`}${prn_logoReport(cur)}</div>
 <div class="field"><span class="lbl">${t('prn.f.countries')}</span><div class="tblwrap"><table class="tbl"><thead><tr><th>${t('prn.f.cty')}</th><th>${t('prn.f.cardLangs')}</th><th>${t('prn.f.sleeve')}</th><th>${t('prn.f.phone')}</th></tr></thead><tbody>${ctyRows}</tbody></table></div><span class="hint">${t('prn.f.ctyH')}</span></div>
 ${editable?`<div class="row g8">${ui.btn(t('prn.b.save'),{kind:'primary',type:'submit'})}</div>`:''}</form>`;
 const hist=ui.table([{label:t('prn.h.ver')},{label:t('c.status')},{label:t('prn.f.brand')},{label:t('prn.f.domain')},{label:t('prn.h.by')},{label:t('c.date')}],p.brands.slice().reverse().map(b=>({cells:[`v${b.version}`,prn_stBadge(b.status),esc(b.brandName),`<span class="mono xs">${esc(b.domain)}</span>`,esc(b.approvedBy||b.by||''),`<span class="xs">${fmtDateTime(b.approvedAt||b.submittedAt||b.createdAt)}</span>`]})));
 const prev=`<div class="prn-mini">${prn_miniSheet('B1',cur)}${prn_miniSheet('C1',cur)}</div><p class="xs muted">${t('prn.prevNote')}</p>${ui.btn(t('prn.b.allMat'),{href:'#prn-mat',icon:'eye',size:'sm'})}`;
 return ui.page({title:t('prn.title'),sub:t('prn.sub'),actions:actions.join(''),body:`${prn_tabs('prn')}<div class="stack">${head}${notes}
  <div class="prn-cols">${ui.card({title:t('prn.c.profile'),body:form})}<div class="stack">${ui.card({title:t('prn.c.preview'),body:prev})}${ui.card({title:t('prn.c.history'),body:hist,pad:false})}</div></div></div>`});}});
function prn_miniSheet(type,bv){const pl=prn_st().plans.find(p=>p.active&&p.cc===(prn_ccs()[0]||'UA'));const d=prn_data(bv,{cc:prn_ccs()[0]||'UA',term:pl?pl.term:24,planName:pl?pl.name:''});
 return `<div class="prn-stage mini" style="--z:.62">${prn_sheet(type,d,{})}</div>`;}
function prn_readForm(f){const d=formData(f);const cur=prn_latest();const countries={};prn_ccs().forEach(cc=>{const c=(cur.countries||{})[cc]||prn_defCountry(cc);countries[cc]=Object.assign({},c,{sleeveLang:d['sl_'+cc]||c.sleeveLang,phone:String(d['phone_'+cc]||'').trim(),cardLangs:(PRN_CARD_LANGS[cc]||['en']).slice()});});
 return{brandName:String(d.brandName||'').trim().replace(/\s+/g,' '),domain:String(d.domain||'').trim().toLowerCase(),domainShort:String(d.domainShort||'').trim().toLowerCase(),accent:prn_hex(d.accent)||String(d.accent||'').trim(),ink:prn_hex(d.ink)||String(d.ink||'').trim(),accentCmyk:String(d.accentCmyk||'').trim(),countries};}
FORM.prn_brand=f=>{const cur=prn_latest();if(!cur||cur.status!=='draft'||!prn_canEdit())return;const n=prn_readForm(f);Object.assign(cur,n);if(!cur.accentCmyk)cur.accentCmyk=prn_cmyk(cur.accent);
 const lc=cur.logoSvg?prn_logoCheck(cur.logoSvg):null;if(lc){cur.logoCheck={hasWordmark:lc.hasWordmark,wordmarkMm:lc.wordmarkMm,vb:lc.vb,warns:lc.warns,errs:lc.errs};}
 const v=prn_validate(cur);S.ui.prn_errs=v.errs;cur.updatedAt=iso(now());audit('print.brand.save','v'+cur.version,{brandName:cur.brandName,domain:cur.domain,accent:cur.accent,ink:cur.ink,errors:Object.keys(v.errs).length});
 toast(v.ok?t('prn.t.saved',{n:cur.version}):t('prn.t.savedErr'),v.ok?'':'bad');rerender();};
// colour / date / search inputs: own listeners (the core click handler would intercept data-act on these input types)
document.addEventListener('input',e=>{const el=e.target;if(!el||!el.dataset)return;if(el.dataset.prncolor){const inp=document.querySelector(`#prn_bf [name=${el.dataset.prncolor}]`);if(inp)inp.value=String(el.value).toUpperCase();}});
document.addEventListener('change',e=>{const el=e.target;if(!el||!el.dataset||!el.dataset.prnchg)return;const fn=ACT[el.dataset.prnchg];if(fn)fn(el.value,el,e);});
ACT.prn_logoFile=(val,el)=>{const file=el.files&&el.files[0];if(!file)return;const cur=prn_latest();if(!cur||cur.status!=='draft'||!prn_canEdit())return;
 if(file.size>400*1024){toast(t('prn.t.logoBig'),'bad');return;}if(!/\.svg$/i.test(file.name)&&file.type!=='image/svg+xml'){toast(t('prn.t.logoType'),'bad');return;}
 const rd=new FileReader();rd.onload=()=>{const txt=String(rd.result||'');const lc=prn_logoCheck(txt);const f0=document.getElementById('prn_bf');if(f0)Object.assign(cur,prn_readForm(f0));if(!lc.ok){S.ui.prn_errs=Object.assign({},S.ui.prn_errs||{},{logo:lc.errs.map(x=>t('prn.lc.'+x)).join(' ')});audit('print.brand.logo_rejected','v'+cur.version,{file:file.name,errors:lc.errs});toast(t('prn.t.logoBad'),'bad');rerender();return;}
  cur.logoSvg=lc.clean;cur.logoName=file.name;cur.logoCheck={hasWordmark:lc.hasWordmark,wordmarkMm:lc.wordmarkMm,vb:lc.vb,warns:lc.warns,errs:lc.errs};
  if(S.ui.prn_errs)delete S.ui.prn_errs.logo;audit('print.brand.logo','v'+cur.version,{file:file.name,ratio:lc.vb?Math.round(lc.vb.w/lc.vb.h*100)/100:null,wordmarkMm:lc.wordmarkMm,warnings:lc.warns});toast(lc.warns.length?t('prn.t.logoWarn'):t('prn.t.logoOk'),lc.warns.length?'bad':'');rerender();};rd.readAsText(file);};
ACT.prn_submit=()=>{const cur=prn_latest();if(!cur||cur.status!=='draft'||!prn_canEdit())return;const v=prn_validate(cur);if(!v.ok){S.ui.prn_errs=v.errs;toast(t('prn.t.fix'),'bad');rerender();return;}
 cur.status='submitted';cur.submittedAt=iso(now());cur.submittedBy=actorName();audit('print.brand.submit','v'+cur.version,{brandName:cur.brandName,domain:cur.domain,warnings:v.warns.length});log(t('prn.t.submitted',{n:cur.version}));toast(t('prn.t.submitted',{n:cur.version}));rerender();};
ACT.prn_newVer=()=>{const cur=prn_latest();if(!cur||!prn_canEdit()||cur.status==='draft'||cur.status==='submitted')return;const n=JSON.parse(JSON.stringify(cur));
 Object.assign(n,{id:uid('pb'),version:cur.version+1,status:'draft',createdAt:iso(now()),by:actorName(),submittedAt:null,approvedAt:null,approvedBy:null,note:''});prn_st().brands.push(n);audit('print.brand.version','v'+n.version,{from:'v'+cur.version});toast(t('prn.t.newVer',{n:n.version}));rerender();};
ACT.prn_approve=()=>{const cur=prn_latest();if(!cur||cur.status!=='submitted'||!prn_canOta())return;const v=prn_validate(cur);
 modal(t('prn.ap.t',{n:cur.version}),`<div class="stack">${ui.note('admin',t('prn.ap.p'))}${v.warns.length?ui.note('warn',v.warns.map(esc).join('<br>')):''}${v.ok?'':ui.note('bad',Object.values(v.errs).join('<br>'))}</div>`,ui.btn(t('c.cancel'),{act:'ovclose'})+ui.btn(t('prn.b.approve'),{kind:'primary',act:'prn_approveDo',disabled:!v.ok}));};
ACT.prn_approveDo=()=>{const cur=prn_latest();if(!cur||cur.status!=='submitted'||!prn_canOta())return;const p=prn_st();p.brands.forEach(b=>{if(b.status==='approved'&&b.id!==cur.id)b.status='superseded';});
 cur.status='approved';cur.approvedAt=iso(now());cur.approvedBy=actorName()+' ('+roleName((actor()||{}).role)+')';audit('print.brand.approve','v'+cur.version,{brandName:cur.brandName,domain:cur.domain,wordmarkMm:cur.logoCheck&&cur.logoCheck.wordmarkMm});
 log(t('prn.t.approved',{n:cur.version}));closeOverlay();toast(t('prn.t.approved',{n:cur.version}));rerender();};
ACT.prn_reject=()=>{if(!prn_canOta())return;modal(t('prn.rj.t'),`<form id="prn_rjF" data-form="prn_reject" class="stack" novalidate>${ui.field({id:'note',label:t('prn.rj.reason'),type:'textarea',rows:3})}</form>`,ui.btn(t('c.cancel'),{act:'ovclose'})+`<button class="btn danger" type="submit" form="prn_rjF"><span>${t('prn.b.reject')}</span></button>`);};
FORM.prn_reject=f=>{const cur=prn_latest();if(!cur||cur.status!=='submitted'||!prn_canOta())return;const note=String(formData(f).note||'').trim();if(!note){setErr(f,'note',t('prn.v.req'));return;}
 cur.status='rejected';cur.note=note;cur.rejectedAt=iso(now());audit('print.brand.reject','v'+cur.version,{reason:note});closeOverlay();toast(t('prn.t.rejected',{n:cur.version}));rerender();};

/* ===== PartnerPlans ===== */
route('prn-plans',{nav:'prn',render(){if(!prn_canView())return prn_noAccess();const p=prn_st();const can_=prn_canEdit()||prn_canOta();
 const used=id=>p.batches.some(b=>b.planId===id);
 const rows=p.plans.map(x=>({cells:[`<b>${esc(x.name)}</b>`,`<span class="mono xs">${esc(x.sku)}</span>`,PRN_PKG[x.pkg],`${x.term} ${t('prn.mo')}`,`${esc(ctyName(x.cc))} <span class="xs faint">${x.cc}</span>`,
  `<span class="num">${fmtNum(prn_tokensFree(x.pkg,x.term,x.cc))}</span>`,x.active?ui.badge(t('prn.pl.active'),'ok',true):ui.badge(t('prn.pl.off'),'',true),can_?ui.btn(t('prn.b.edit'),{size:'sm',act:'prn_planEdit',arg:x.id})+(used(x.id)?` <span class="xs faint">${t('prn.pl.used')}</span>`:''):'']}));
 return ui.page({title:t('prn.title'),sub:t('prn.sub'),actions:can_?ui.btn(t('prn.pl.add'),{kind:'primary',act:'prn_planEdit',icon:'plus'}):'',body:`${prn_tabs('prn-plans')}<div class="stack">${ui.note('info',t('prn.pl.note'))}
  ${ui.card({title:t('prn.pl.title'),body:ui.table([{label:t('prn.pl.name')},{label:'SKU'},{label:t('prn.pl.pkg')},{label:t('prn.pl.term')},{label:t('prn.f.cty')},{label:t('prn.pl.tokens'),cls:'num'},{label:t('c.status')},{label:''}],rows,{empty:ui.empty('tag',t('prn.pl.emptyT'),t('prn.pl.emptyP'))}),pad:false})}</div>`});}});
ACT.prn_planEdit=id=>{const x=id?prn_plan(id):null;const used=x&&prn_st().batches.some(b=>b.planId===x.id);const lock=used?'disabled':'';
 drawer(x?t('prn.pl.edit'):t('prn.pl.add'),`<form id="prn_plF" data-form="prn_plan" class="stack" novalidate data-id="${x?x.id:''}">${used?ui.note('info',t('prn.pl.lock')):''}
 ${ui.field({id:'name',label:t('prn.pl.name'),value:x?x.name:'',hint:t('prn.pl.nameH'),attrs:`maxlength="30" ${lock}`})}${ui.field({id:'sku',label:'SKU',value:x?x.sku:'',hint:t('prn.pl.skuH'),mono:true,attrs:`maxlength="16" ${lock}`})}
 ${ui.field({id:'pkg',label:t('prn.pl.pkg'),type:'select',value:x?x.pkg:'std',options:PLANS.map(k=>[k,PRN_PKG[k]]),hint:t('prn.pl.pkgH'),attrs:lock})}
 ${ui.field({id:'term',label:t('prn.pl.term'),type:'select',value:x?x.term:24,options:TERMS.map(m=>[m,m+' '+t('prn.mo')]),attrs:lock})}
 ${ui.field({id:'cc',label:t('prn.f.cty'),type:'select',value:x?x.cc:prn_ccs()[0],options:prn_ccs().map(cc=>[cc,ctyName(cc)]),attrs:lock})}
 <label class="chk"><input type="checkbox" name="active" ${!x||x.active?'checked':''}><span>${t('prn.pl.activeL')}</span></label></form>`,ui.btn(t('c.cancel'),{act:'ovclose'})+`<button class="btn primary" type="submit" form="prn_plF"><span>${t('prn.b.save')}</span></button>`);};
FORM.prn_plan=f=>{if(!(prn_canEdit()||prn_canOta()))return;clearErrs(f);const id=f.dataset.id;const x=id?prn_plan(id):null;const used=x&&prn_st().batches.some(b=>b.planId===x.id);const d=formData(f);
 if(used){x.active=!!d.active;audit('print.plan.update',x.sku,{active:x.active});closeOverlay();toast(t('prn.t.planSaved',{n:esc(x.name)}));rerender();return;}
 const n={name:String(d.name||'').trim().replace(/\s+/g,' '),sku:String(d.sku||'').trim(),pkg:d.pkg,term:+d.term,cc:d.cc,active:!!d.active};const e=prn_planErrs(n,id);if(Object.keys(e).length){Object.keys(e).forEach(k=>setErr(f,k,e[k]));return;}
 if(x){Object.assign(x,n);audit('print.plan.update',x.sku,n);}else{const pl=Object.assign({id:uid('pp'),createdAt:iso(now()),by:actorName()},n);prn_st().plans.push(pl);audit('print.plan.create',pl.sku,n);}
 closeOverlay();toast(t('prn.t.planSaved',{n:esc(n.name)}));rerender();};

/* ===== Materials (live previews at physical size) ===== */
function prn_srcBrand(u){if(u.ds==='stress')return prn_stressBrand('tz',u.logo||'sb_wide');if(u.ds==='max')return prn_stressBrand('max',u.logo||'sb_wide');return u.src==='approved'?(prn_approved()||prn_latest()):prn_latest();}
function prn_matData(u,bv){const ccs=u.ds==='profile'?prn_ccs():['UA','KZ','DE'];const cc=ccs.includes(u.cc)?u.cc:ccs[0];
 const plans=prn_st().plans.filter(p=>p.cc===cc&&p.active);const pl=plans.find(p=>p.id===u.plan)||plans[0];const stress=u.ds!=='profile';
 const lang=u.lang&&PRN_SLEEVE_LANGS.includes(u.lang)?u.lang:(((bv.countries||{})[cc]||{}).sleeveLang||PRN_SLEEVE_DEF[cc]||'en');
 return{cc,ccs,plans,pl,d:prn_data(bv,{cc,lang,term:stress?36:(pl?pl.term:24),planName:stress?bv._plan:(pl?pl.name:''),zones:u.zones,scratched:u.scratched,plans:prn_st().plans})};}
route('prn-mat',{nav:'prn',render(){if(!prn_canView())return prn_noAccess();prn_fontLink();const u=prn_ui();const bv=prn_srcBrand(u);const m=prn_matData(u,bv);const type=PRN_TYPES.includes(u.mat)?u.mat:'B1';
 const segM=ui.seg('prn_segM',PRN_TYPES.map(x=>[x,x==='0'?t('prn.m.rules'):x]),type,'prn_setMat');
 const opt=(v,l,sel)=>`<option value="${esc(v)}" ${String(v)===String(sel)?'selected':''}>${esc(l)}</option>`;
 const ctl=[];ctl.push(`<label class="prn-ctl"><span>${t('prn.m.ds')}</span><select class="inp" data-act="prn_setU" data-arg="ds">${opt('profile',t('prn.m.dsProfile'),u.ds)}${opt('stress',t('prn.m.dsStress'),u.ds)}${opt('max',t('prn.m.dsMax'),u.ds)}</select></label>`);
 if(u.ds==='profile')ctl.push(`<label class="prn-ctl"><span>${t('prn.m.src')}</span><select class="inp" data-act="prn_setU" data-arg="src">${opt('work',t('prn.m.srcWork',{n:prn_latest().version}),u.src)}${prn_approved()?opt('approved',t('prn.m.srcAp',{n:prn_approved().version}),u.src):''}</select></label>`);
 else ctl.push(`<label class="prn-ctl"><span>${t('prn.m.logo')}</span><select class="inp" data-act="prn_setU" data-arg="logo">${opt('sb_wide',t('prn.m.logoWide'),u.logo||'sb_wide')}${opt('sb_sq',t('prn.m.logoSq'),u.logo)}</select></label>`);
 if(['B1','B2'].includes(type))ctl.push(`<label class="prn-ctl"><span>${t('prn.f.cty')}</span><select class="inp" data-act="prn_setU" data-arg="cc">${m.ccs.map(cc=>opt(cc,cc+' · '+(PRN_CARD_LANGS[cc]||['en']).join('+'),m.cc)).join('')}</select></label>`);
 if(type==='B1'&&u.ds==='profile')ctl.push(`<label class="prn-ctl"><span>${t('prn.m.plan')}</span><select class="inp" data-act="prn_setU" data-arg="plan">${m.plans.length?m.plans.map(p=>opt(p.id,p.name+' · '+p.term+' '+t('prn.mo'),m.pl&&m.pl.id)).join(''):opt('',t('prn.m.noPlan'),'')}</select></label>`);
 if(['C1','C2'].includes(type))ctl.push(`<label class="prn-ctl"><span>${t('prn.m.lang')}</span><select class="inp" data-act="prn_setU" data-arg="lang">${PRN_SLEEVE_LANGS.map(l=>opt(l,l,m.d.lang)).join('')}</select></label>`);
 ctl.push(`<label class="prn-ctl"><span>${t('prn.m.zoom')}</span><select class="inp" data-act="prn_setU" data-arg="zoom">${['0.5','1','1.5','2','3'].map(z=>opt(z,z==='1'?t('prn.m.z1'):Math.round(z*100)+'%',u.zoom)).join('')}</select></label>`);
 const tg=(k,l)=>`<label class="chk small"><input type="checkbox" data-act="prn_tog" data-arg="${k}" ${u[k]?'checked':''}><span>${l}</span></label>`;
 const toggles=`<div class="row wrap g12">${tg('zones',t('prn.m.zones'))}${type!=='0'?tg('cut',t('prn.m.cut')):''}${type==='B2'?tg('scratched',t('prn.m.scratched')):''}</div>`;
 const sheet=prn_sheet(type,m.d,{cut:u.cut});const z=parseFloat(u.zoom)||1;
 const spec=type==='0'?t('prn.m.spec0'):t('prn.m.spec',{w:fmtNum(PRN_SZ[type].w,1),h:fmtNum(PRN_SZ[type].h,1)});
 const lc=prn_logoCheck(bv.logoSvg);let wm='';if(lc.hasWordmark)wm=t('prn.m.wm',{mm:fmtNum(lc.wordmarkMm,2)});else wm=t('prn.w.noText');
 const relBtn=PRN_REL_TYPES.includes(type)&&u.ds==='profile'&&(prn_canEdit()||prn_canOta())?ui.btn(t('prn.b.release'),{kind:'primary',act:'prn_releaseAsk',icon:'check'}):'';
 const shipNote=['A1','A2'].includes(type)?ui.note('info',t('prn.m.aNote')+' '+`<a href="#prn-labels">${t('prn.m.aLink')} →</a>`):'';
 const bNote=type==='B2'?ui.note('info',t('prn.m.b2Note')):'';const wta=m.d&&type[0]==='B'&&m.cc!=='UA'&&m.cc!=='KZ'?ui.note('warn',t('prn.m.wta')):'';
 const kzNote=type==='B2'&&m.cc==='KZ'?ui.note('warn',t('prn.m.kzNote')):'';
 return ui.page({title:t('prn.title'),sub:t('prn.sub'),actions:ui.btn(t('prn.b.print'),{act:'prn_printCur',icon:'printer'})+relBtn,body:`${prn_tabs('prn-mat')}<div class="stack">
  <div class="prn-segwrap">${segM}</div><div class="row wrap g12 prn-ctls">${ctl.join('')}</div>${toggles}
  ${u.ds!=='profile'?ui.note('info',t('prn.m.stressNote')):''}${shipNote}${bNote}${kzNote}${wta}
  <div class="prn-stage" style="--z:${z}" data-zoom="${z}">${sheet}</div>
  <p class="xs muted">${esc(spec)} · ${esc(wm)} · ${t('prn.m.pdfNote')}</p></div>`});}});
ACT.prn_setMat=v=>{prn_ui().mat=v;rerender();};
ACT.prn_setU=(v,el)=>{const u=prn_ui();u[el.dataset.arg]=v;if(el.dataset.arg==='cc'){u.plan='';}rerender();};
ACT.prn_tog=(v,el)=>{prn_ui()[el.dataset.arg]=!!v;rerender();};
ACT.prn_printCur=()=>{const u=prn_ui();const bv=prn_srcBrand(u);const m=prn_matData(u,bv);const type=u.mat;if(type==='0'){prn_print(prn_sheet('0',Object.assign({},m.d,{zones:false}),{}),297,420);return;}
 const z=PRN_SZ[type];prn_print(prn_sheet(type,Object.assign({},m.d,{zones:false}),{cut:true,print:true}),z.w+4,z.h+4);audit('print.proof',type,{cc:m.cc,lang:m.d.lang,dataset:u.ds});};
ACT.prn_releaseAsk=()=>{const u=prn_ui();const type=u.mat;const bv=prn_approved();if(!bv){toast(t('prn.t.noApproved'),'bad');return;}const m=prn_matData(Object.assign({},u,{src:'approved'}),bv);
 const o={type,cc:['B1','B2'].includes(type)?m.cc:'',lang:['C1','C2'].includes(type)?m.d.lang:'',planId:type==='B1'&&m.pl?m.pl.id:''};
 if(type==='B1'&&!o.planId){toast(t('prn.m.noPlan'),'bad');return;}
 const key=prn_runKey(o);const n=prn_runNo(type,key,bv.id);const chk=prn_st().lastCheck;const stale=!chk||chk.brandId!==bv.id||chk.tplVer!==PRN_TPL_VER;
 modal(t('prn.rel.t',{m:type}),`<div class="stack"><dl class="dl"><dt>${t('prn.rel.no')}</dt><dd class="mono">${n.dup?esc(n.dup.no):esc(n.no)}</dd><dt>${t('prn.rel.brand')}</dt><dd>v${bv.version} · ${esc(bv.brandName)}</dd>
  ${o.cc?`<dt>${t('prn.f.cty')}</dt><dd>${esc(ctyName(o.cc))}</dd>`:''}${o.lang?`<dt>${t('prn.m.lang')}</dt><dd>${o.lang}</dd>`:''}${o.planId?`<dt>${t('prn.m.plan')}</dt><dd>${esc(m.pl.name)} · ${m.pl.term} ${t('prn.mo')}</dd>`:''}<dt>${t('prn.rel.tpl')}</dt><dd>v${PRN_TPL_VER}</dd></dl>
  ${n.dup?ui.note('info',t('prn.rel.dup',{n:esc(n.dup.no)})):stale?ui.note('warn',t('prn.rel.stale')+` <a href="#prn-checks">${t('prn.tab.checks')} →</a>`):ui.note('info',t('prn.rel.p'))}</div>`,
  ui.btn(t('c.cancel'),{act:'ovclose'})+(n.dup?ui.btn(t('prn.b.openRun'),{href:'#prn-run--'+n.dup.id}):ui.btn(t('prn.b.release'),{kind:'primary',act:'prn_releaseDo',arg:JSON.stringify(o),disabled:stale})));};
ACT.prn_releaseDo=arg=>{if(!(prn_canEdit()||prn_canOta()))return;const o=JSON.parse(arg);const r=prn_release(o);closeOverlay();
 if(r.err==='checks'){toast(t('prn.t.relBlocked',{n:r.fails.length}),'bad');S.ui.prn_relFail=r.fails.slice(0,20);go('prn-checks');return;}if(r.err){toast(t('prn.t.relErr.'+r.err),'bad');return;}
 toast(t('prn.r.log',{n:r.run.no}));go('prn-run',r.run.id);};

/* ===== Checks ===== */
route('prn-checks',{nav:'prn',render(){if(!prn_canView())return prn_noAccess();const p=prn_st();const bv=prn_approved()||prn_latest();const c=p.lastCheck;
 const fresh=c&&c.brandId===bv.id&&c.tplVer===PRN_TPL_VER;const tbl=(res)=>{const by={};res.forEach(r=>{(by[r.mat]=by[r.mat]||[]).push(r);});
  return Object.keys(by).sort().map(mat=>{const rs=by[mat];const bad=rs.filter(x=>!x.ok&&!x.warn).length;const w=rs.filter(x=>!x.ok&&x.warn).length;
   return `<details class="prn-det" ${bad?'open':''}><summary><b>${mat==='*'?t('prn.ck.profile'):mat}</b> ${bad?ui.badge(t('prn.ck.fail',{n:bad}),'bad',true):ui.badge(t('prn.ck.pass'),'ok',true)} ${w?ui.badge(t('prn.ck.warn',{n:w}),'warn'):''} <span class="xs faint">${rs.length}</span></summary>
    ${ui.table([{label:t('prn.ck.variant')},{label:t('prn.ck.check')},{label:t('c.status')},{label:t('prn.ck.detail')}],rs.map(r=>({cells:[esc(r.variant||'—'),t('prn.ck.c.'+r.check),r.ok?ui.badge('OK','ok'):r.warn?ui.badge(t('prn.ck.w'),'warn'):ui.badge(t('prn.ck.f'),'bad'),`<span class="xs">${esc(r.detail||'')}</span>`]})))}</details>`;}).join('');};
 const sum=res=>{const f=res.filter(x=>!x.ok&&!x.warn).length;return f?ui.badge(t('prn.ck.fail',{n:f}),'bad',true):ui.badge(t('prn.ck.allPass'),'ok',true);};
 const relFail=S.ui.prn_relFail;if(relFail)delete S.ui.prn_relFail;
 const body=c?`<div class="stack">${!fresh?ui.note('warn',t('prn.ck.stale')):''}${relFail?ui.note('bad',t('prn.ck.relFail')+'<br>'+relFail.map(r=>esc(r.mat+' '+(r.variant||'')+': '+t('prn.ck.c.'+r.check)+' — '+r.detail)).join('<br>')):''}
  ${ui.card({title:t('prn.ck.prof',{n:c.brandVer}),actions:sum(c.results),body:tbl(c.results)})}${ui.card({title:t('prn.ck.stress'),actions:sum(c.stress||[]),body:`<p class="small muted">${t('prn.ck.stressP')}</p>`+tbl(c.stress||[])})}
  <p class="xs muted">${t('prn.ck.meta',{d:fmtDateTime(c.at),by:esc(c.by||''),tpl:c.tplVer})}${c.font?'':' · '+t('prn.ck.noFont')}</p></div>`:ui.empty('shield',t('prn.ck.noneT'),t('prn.ck.noneP'));
 return ui.page({title:t('prn.title'),sub:t('prn.sub'),actions:ui.btn(prn_busy?t('prn.ck.running'):t('prn.b.run'),{kind:'primary',act:'prn_runChecks',icon:'shield',disabled:prn_busy}),body:`${prn_tabs('prn-checks')}${ui.note('info',t('prn.ck.what'))}${body}`});}});
ACT.prn_runChecks=async()=>{if(prn_busy)return;prn_busy=true;rerender();const bv=prn_approved()||prn_latest();try{
 const a=await prn_runChecks(bv,{});const s1=await prn_runChecks(prn_stressBrand('tz','sb_wide'),{stress:true});const s2=await prn_runChecks(prn_stressBrand('tz','sb_sq'),{stress:true});const s3=await prn_runChecks(prn_stressBrand('max','sb_wide'),{stress:true});
 const tag=(r,l)=>r.results.map(x=>Object.assign({},x,{variant:(l+(x.variant?' · '+x.variant:''))}));
 const p=prn_st();p.lastCheck={at:a.at,brandId:bv.id,brandVer:bv.version,tplVer:PRN_TPL_VER,font:a.font&&s1.font,by:actorName(),results:a.results,stress:tag(s1,'TZ · 6:1').concat(tag(s2,'TZ · 1:1'),tag(s3,'max · 6:1'))};
 const f=p.lastCheck.results.concat(p.lastCheck.stress).filter(x=>!x.ok&&!x.warn).length;audit('print.checks.run','v'+bv.version,{checks:p.lastCheck.results.length+p.lastCheck.stress.length,failed:f,template:PRN_TPL_VER});
 toast(f?t('prn.t.ckFail',{n:f}):t('prn.t.ckOk'),f?'bad':'');}catch(e){console.error(e);toast(String(e&&e.message||e),'bad');}prn_busy=false;save();rerender();};

/* ===== Releases ===== */
route('prn-runs',{nav:'prn',render(){if(!prn_canView())return prn_noAccess();const p=prn_st();
 const rows=p.runs.slice().reverse().map(r=>({href:'#prn-run--'+r.id,cells:[`<span class="mono">${esc(r.no)}</span>`,r.type,esc([r.cc,r.lang,r.plan?r.plan.name+' · '+r.plan.term+' '+t('prn.mo'):''].filter(Boolean).join(' · ')||'—'),'v'+r.brandVer,'v'+r.tplVer,esc(r.by),`<span class="xs">${fmtDateTime(r.createdAt)}</span>`]}));
 const log=p.csvLog.slice().reverse().slice(0,50).map(e=>({cells:[esc(e.batch),`<span class="xs">${fmtDateTime(e.at)}</span>`,esc(e.by),esc(e.to||'—'),e.reason?ui.badge(t('prn.rl.re'),'warn')+' '+esc(e.reason):ui.badge(t('prn.rl.first'),'info'),fmtNum(e.n)]}));
 return ui.page({title:t('prn.title'),sub:t('prn.sub'),body:`${prn_tabs('prn-runs')}<div class="stack">${ui.note('info',t('prn.rl.note'))}
  ${ui.card({title:t('prn.rl.title'),body:ui.table([{label:t('prn.rel.no')},{label:t('prn.rl.type')},{label:t('prn.rl.what')},{label:t('prn.rel.brand')},{label:t('prn.rel.tpl')},{label:t('prn.h.by')},{label:t('c.date')}],rows,{empty:ui.empty('layers',t('prn.rl.emptyT'),t('prn.rl.emptyP'),ui.btn(t('prn.b.allMat'),{href:'#prn-mat'}))}),pad:false})}
  ${ui.card({title:t('prn.rl.csv'),body:ui.table([{label:t('prn.bt.no')},{label:t('c.date')},{label:t('prn.h.by')},{label:t('prn.dl.to')},{label:t('prn.dl.kind')},{label:t('prn.bt.qty')}],log,{empty:`<p class="muted small" style="padding:16px">${t('prn.rl.csvEmpty')}</p>`}),pad:false})}</div>`});}});
route('prn-run',{nav:'prn',render(id){if(!prn_canView())return prn_noAccess();const r=prn_run(id);if(!r)return ui.page({title:t('prn.rl.nf'),crumbs:[[t('prn.rl.title'),'#prn-runs']],body:ui.empty('search',t('prn.rl.nf'),'')});
 const u=prn_ui();const bv=Object.assign({},r.snap,{logoCheck:prn_logoCheck(r.snap.logoSvg)});const d=prn_data(bv,{cc:r.cc||'UA',lang:r.lang||undefined,term:r.plan?r.plan.term:24,planName:r.plan?r.plan.name:'',zones:u.zones,plans:prn_st().plans});
 const z=parseFloat(u.zoom)||1;const batches=prn_st().batches.filter(b=>b.runId===r.id);
 return ui.page({title:`<span class="mono">${esc(r.no)}</span>`,sub:t('prn.run.sub',{m:r.type,d:fmtDateTime(r.createdAt),by:esc(r.by)}),crumbs:[[t('prn.rl.title'),'#prn-runs'],[r.no]],actions:ui.btn(t('prn.b.print'),{act:'prn_printRun',arg:r.id,icon:'printer',kind:'primary'}),
  body:`<div class="stack">${ui.note('ok',t('prn.run.frozen'))}<dl class="dl"><dt>${t('prn.rel.brand')}</dt><dd>v${r.brandVer} · ${esc(r.snap.brandName)} · <span class="mono xs">${esc(r.snap.domain)}</span></dd><dt>${t('prn.rel.tpl')}</dt><dd>v${r.tplVer}</dd>
  ${r.cc?`<dt>${t('prn.f.cty')}</dt><dd>${esc(ctyName(r.cc))}</dd>`:''}${r.lang?`<dt>${t('prn.m.lang')}</dt><dd>${r.lang}</dd>`:''}${r.plan?`<dt>${t('prn.m.plan')}</dt><dd>${esc(r.plan.name)} · ${esc(r.plan.sku)} · ${PRN_PKG[r.plan.pkg]} · ${r.plan.term} ${t('prn.mo')}</dd>`:''}
  <dt>${t('prn.run.size')}</dt><dd>${fmtNum(PRN_SZ[r.type].w,1)} × ${fmtNum(PRN_SZ[r.type].h,1)} mm + 2 mm</dd><dt>${t('prn.run.ac')}</dt><dd>${prn_sw(r.snap.accent)} ${esc(r.snap.accent)} · ${esc(r.snap.accentCmyk||'')}</dd>${batches.length?`<dt>${t('prn.nav.batches')}</dt><dd>${batches.map(b=>`<a href="#prn-batch--${b.id}">${esc(b.no)}</a>`).join(', ')}</dd>`:''}</dl>
  <label class="chk small"><input type="checkbox" data-act="prn_tog" data-arg="zones" ${u.zones?'checked':''}><span>${t('prn.m.zones')}</span></label><div class="prn-stage" style="--z:${z}">${prn_sheet(r.type,d,{cut:true})}</div><p class="xs muted">${t('prn.m.pdfNote')}</p></div>`});}});
ACT.prn_printRun=id=>{const r=prn_run(id);if(!r)return;const bv=Object.assign({},r.snap,{logoCheck:prn_logoCheck(r.snap.logoSvg)});const d=prn_data(bv,{cc:r.cc||'UA',lang:r.lang||undefined,term:r.plan?r.plan.term:24,planName:r.plan?r.plan.name:'',plans:prn_st().plans});
 const z=PRN_SZ[r.type];prn_print(prn_sheet(r.type,d,{cut:true,print:true}),z.w+4,z.h+4);audit('print.pdf',r.no,{type:r.type});};

/* ===== Card batches ===== */
route('prn-batches',{nav:'prn-batches',render(){if(!prn_canView())return prn_noAccess();prn_expire();const p=prn_st();const u=prn_ui();const ops=prn_canOps();
 const kpi=prn_ccs().map(cc=>ui.kpi(`${esc(ctyName(cc))} · ${t('prn.bt.keys')}`,fmtNum(prn_keysFree(cc)),t('prn.bt.keysSub',{r:fmtNum(prn_keysReserved(cc))}))).join('');
 const list=p.batches.filter(b=>!u.bf||b.status===u.bf);const per=50;const pg=Math.max(1,Math.min(u.bpage||1,Math.ceil(list.length/per)||1));
 const rows=list.slice((pg-1)*per,pg*per).map(b=>{const s=prn_batchStats(b);return{href:'#prn-batch--'+b.id,cells:[`<span class="mono">${esc(b.no)}</span>`,`${esc(b.plan.name)}<div class="xs faint mono">${esc(b.plan.sku)}</div>`,b.cc,`<span class="num">${fmtNum(b.qty)}</span>`,`<span class="mono xs">${prn_serialFmt(b.serialFrom)} – ${prn_serialFmt(b.serialTo)}</span>`,prn_ddmmyyyy(b.deadline),prn_bBadge(b.status),`<span class="xs">${fmtNum(s.activated)} / ${fmtNum(s.blocked)} / ${fmtNum(s.expired)}</span>`]};});
 const filt=ui.seg('prn_bf',[['',t('prn.all')],['generated',t('prn.bst.generated')],['exported',t('prn.bst.exported')],['printed',t('prn.bst.printed')],['closed',t('prn.bst.closed')]],u.bf||'','prn_bfSet');
 const block=ops?ui.card({title:t('prn.bl.title'),body:`<form data-form="prn_block" id="prn_blF" class="stack" novalidate><p class="small muted">${t('prn.bl.p')}</p><div class="grid3">
  ${ui.field({id:'mode',label:t('prn.bl.mode'),type:'select',value:'serial',options:[['serial',t('prn.bl.serial')],['range',t('prn.bl.range')]]})}${ui.field({id:'from',label:t('prn.bl.from'),mono:true,placeholder:'1000 0000 0001',attrs:'inputmode="numeric" autocomplete="off"'})}${ui.field({id:'to',label:t('prn.bl.to'),mono:true,placeholder:t('prn.bl.toPh'),attrs:'inputmode="numeric" autocomplete="off"'})}</div>
  <div class="row wrap g8" style="align-items:flex-end">${ui.field({id:'reason',label:t('prn.bl.reason'),type:'select',options:[['lost',t('prn.bl.r.lost')],['stolen',t('prn.bl.r.stolen')],['damaged',t('prn.bl.r.damaged')],['other',t('prn.bl.r.other')]]})}<button class="btn danger" type="submit"><span>${t('prn.bl.do')}</span></button></div></form>`}):'';
 const redeem=S.admin?ui.card({title:t('prn.rd.title'),body:prn_redeemForm()}):'';
 return ui.page({title:t('prn.bt.title'),sub:t('prn.bt.sub'),actions:ops&&!S.admin?ui.btn(t('prn.bt.new'),{kind:'primary',act:'prn_batchNew',icon:'plus'}):'',body:`<div class="stack">
  <div class="grid3">${kpi}</div>${ui.note('info',t('prn.bt.note'))}${!prn_approved()?ui.note('warn',t('prn.bt.noBrand')+` <a href="#prn">${t('prn.tab.brand')} →</a>`):''}
  ${ui.card({title:t('prn.bt.list'),actions:filt,body:ui.table([{label:t('prn.bt.no')},{label:t('prn.m.plan')},{label:t('prn.f.cty')},{label:t('prn.bt.qty'),cls:'num'},{label:t('prn.bt.serials')},{label:t('prn.bt.deadline')},{label:t('c.status')},{label:t('prn.bt.abe')}],rows,{empty:ui.empty('card',t('prn.bt.emptyT'),t('prn.bt.emptyP'),ops&&!S.admin?ui.btn(t('prn.bt.new'),{kind:'primary',act:'prn_batchNew'}):'')})+(list.length>per?ui.pager(pg,list.length,per,'prn_bpage'):''),pad:false})}
  ${block}${redeem}</div>`});}});
ACT.prn_bfSet=v=>{const u=prn_ui();u.bf=v;u.bpage=1;rerender();};ACT.prn_bpage=v=>{prn_ui().bpage=+v;rerender();};
function prn_redeemForm(){const sims=(S.sims||[]).filter(s=>s.status==='active'&&!s.plan).slice(0,200);
 return `<form data-form="prn_redeem" id="prn_rdF" class="stack" novalidate>${ui.note('admin',t('prn.rd.note'))}<div class="grid2">${ui.field({id:'code',label:t('prn.rd.code'),mono:true,placeholder:'XXXX-XXXX-XXXX',attrs:'autocomplete="off" spellcheck="false" maxlength="20"',hint:t('prn.rd.codeH')})}
 ${sims.length?ui.field({id:'iccid',label:t('prn.rd.sim'),type:'select',options:sims.map(s=>{const x=findModel(s.modelId);return [s.iccid,'···'+s.iccid.slice(-6)+' · '+(x?x.model.name+' ('+(x.model.plan?PRN_PKG[x.model.plan]:'—')+')':'—')+' · '+simCc(s)];})}):ui.note('warn',t('prn.rd.noSim'))}</div>
 <div class="row g8">${ui.btn(t('prn.rd.do'),{kind:'primary',type:'submit'})}</div><div id="prn_rdRes" aria-live="polite"></div></form>`;}
FORM.prn_redeem=f=>{if(!S.admin)return;const d=formData(f);const out=document.getElementById('prn_rdRes');const r=prnRedeem(d.code,d.iccid);
 if(r.err){const neutral=['used','blocked','expired','unknown','notprinted','no_code'].includes(r.err);out.innerHTML=ui.note('bad',neutral?esc(t('own.T7')):t('prn.rd.e.'+r.err));return;}/* one neutral text for every status (as console activation & portal); only the typo message differs */toast(t('prn.rd.ok',{s:'···'+r.s.iccid.slice(-6),p:pkgLabel(r.c.plan,r.c.term)}));rerender();};
ACT.prn_batchNew=()=>{if(!prn_canOps()||S.admin)return;const pl=prn_st().plans.filter(p=>p.active);const bv=prn_approved();if(!bv){toast(t('prn.bt.noBrand'),'bad');return;}
 if(!pl.length){toast(t('prn.pl.emptyT'),'bad');return;}const d0=iso(now()).slice(0,10);const dl=iso(addMonths(new Date(d0+'T12:00:00'),36)).slice(0,10);
 const runs=prn_st().runs.filter(r=>r.type==='B2');
 drawer(t('prn.bt.new'),`<form id="prn_bnF" data-form="prn_batch" class="stack" novalidate>
 ${ui.field({id:'planId',label:t('prn.m.plan'),type:'select',options:pl.map(p=>[p.id,`${p.name} · ${p.term} ${t('prn.mo')} · ${p.cc} · ${p.sku}`]),attrs:'data-act="prn_bnPlan"'})}
 <div id="prn_bnInfo">${prn_bnInfo(pl[0].id)}</div>
 ${ui.field({id:'qty',label:t('prn.bt.qty'),type:'number',value:100,attrs:'min="1" max="5000" step="1"',hint:t('prn.bt.qtyH')})}
 <div class="grid2">${ui.field({id:'printDate',label:t('prn.bt.printDate'),type:'date',value:d0,attrs:'data-prnchg="prn_bnDate"'})}${ui.field({id:'deadline',label:t('prn.bt.deadline'),type:'date',value:dl,hint:t('prn.bt.deadlineH')})}</div>
 ${ui.field({id:'runId',label:t('prn.bt.run'),type:'select',options:[['',t('prn.bt.runNone')]].concat(runs.map(r=>[r.id,r.no+' · '+r.cc])),hint:t('prn.bt.runH')})}</form>`,ui.btn(t('c.cancel'),{act:'ovclose'})+`<button class="btn primary" type="submit" form="prn_bnF"><span>${t('prn.bt.create')}</span></button>`);
 const sel=document.querySelector('#prn_bnF [name=runId]');if(sel)prn_bnRunFilter(pl[0].id);};
function prn_bnInfo(id){const p=prn_plan(id);if(!p)return '';const keys=prn_keysFree(p.cc),tok=prn_tokensFree(p.pkg,p.term,p.cc);
 return `<dl class="dl small"><dt>${t('prn.bt.keysFree',{c:esc(ctyName(p.cc))})}</dt><dd><b>${fmtNum(keys)}</b></dd><dt>${t('prn.bt.tokFree',{p:esc(PRN_PKG[p.pkg]+' · '+p.term)})}</dt><dd>${fmtNum(tok)}</dd></dl>${keys?'':ui.note('warn',t('prn.bt.noKeys',{c:esc(ctyName(p.cc))})+` <a href="#order-new">${t('prn.bt.buy')} →</a>`)}`;}
function prn_bnRunFilter(id){const p=prn_plan(id);const sel=document.querySelector('#prn_bnF [name=runId]');if(!sel||!p)return;const runs=prn_st().runs.filter(r=>r.type==='B2'&&r.cc===p.cc);
 sel.innerHTML=`<option value="">${esc(t('prn.bt.runNone'))}</option>`+runs.map(r=>`<option value="${r.id}">${esc(r.no)}</option>`).join('');if(runs.length)sel.value=runs[runs.length-1].id;}
ACT.prn_bnPlan=v=>{const el=document.getElementById('prn_bnInfo');if(el)el.innerHTML=prn_bnInfo(v);prn_bnRunFilter(v);};
ACT.prn_bnDate=v=>{const f=document.getElementById('prn_bnF');if(!f||!/^\d{4}-\d{2}-\d{2}$/.test(v))return;f.querySelector('[name=deadline]').value=iso(addMonths(new Date(v+'T12:00:00'),36)).slice(0,10);};
FORM.prn_batch=f=>{if(!prn_canOps()||S.admin)return;clearErrs(f);const d=formData(f);const p=prn_plan(d.planId);const q=parseInt(d.qty,10);
 if(!p){setErr(f,'planId',t('prn.v.req'));return;}if(!(q>=1&&q<=5000)){setErr(f,'qty',t('prn.bt.qtyBad'));return;}
 if(!/^\d{4}-\d{2}-\d{2}$/.test(d.printDate||'')){setErr(f,'printDate',t('prn.v.req'));return;}
 if(!/^\d{4}-\d{2}-\d{2}$/.test(d.deadline||'')||d.deadline<=d.printDate){setErr(f,'deadline',t('prn.bt.dlBad'));return;}
 if(d.deadline>iso(addMonths(new Date(d.printDate+'T12:00:00'),36)).slice(0,10)){setErr(f,'deadline',t('prn.bt.dlMax'));return;}
 const today=iso(now()).slice(0,10);if(d.deadline<today){setErr(f,'deadline',t('prn.bt.dlPast',{d:prn_ddmmyyyy(today)}));return;}
 const soon=iso(addMonths(now(),1)).slice(0,10);if(d.deadline<soon&&f.dataset.dlOk!==d.deadline){f.dataset.dlOk=d.deadline;setErr(f,'deadline',t('prn.bt.dlSoon'));return;}
 if(!d.runId){setErr(f,'runId',t('prn.bt.runReq'));return;}
 const r=prn_batchCreate({planId:p.id,qty:q,printDate:d.printDate,deadline:d.deadline,runId:d.runId});
 if(r.err==='keys'){setErr(f,'qty',t('prn.bt.keysShort',{n:fmtNum(r.free)}));return;}if(r.err){toast(t('prn.t.bErr'),'bad');return;}
 prn_bridgePush();closeOverlay();toast(t('prn.b.log',{n:r.batch.no,q:fmtNum(q)}));go('prn-batch',r.batch.id);};
route('prn-batch',{nav:'prn-batches',render(id){if(!prn_canView())return prn_noAccess();prn_expire();const b=prn_batch(id);if(!b)return ui.page({title:t('prn.bt.nf'),crumbs:[[t('prn.bt.title'),'#prn-batches']],body:ui.empty('search',t('prn.bt.nf'),'')});
 const u=prn_ui();const s=prn_batchStats(b);const ops=prn_canOps();const codes=prn_codesOf(b);
 const flow=['generated','exported','printed','closed'];const ci=flow.indexOf(b.status);
 const tl=`<div class="timeline">${flow.map((st,i)=>{const at={generated:b.createdAt,exported:b.exportedAt,printed:b.printedAt,closed:null}[st];const done=i<=ci;return `<div class="tl ${done?'done':i===ci+1?'cur':''}"><span class="dot">${done?icon('check','sm'):''}</span><div class="grow"><div class="row between wrap g8"><b class="${done?'':'muted'}">${t('prn.bst.'+st)}</b>${at?`<span class="xs faint">${fmtDateTime(at)}</span>`:''}</div><div class="small muted">${t('prn.bst.'+st+'.d')}</div></div></div>`;}).join('')}</div>`;
 const acts=[];if(ops&&b.status==='generated'&&!S.admin)acts.push(ui.btn(t('prn.dl.btn'),{kind:'primary',act:'prn_dlAsk',arg:b.id,icon:'upload'}));
 if(ops&&b.status!=='generated'&&S.admin)acts.push(ui.btn(t('prn.dl.again'),{act:'prn_dlAsk',arg:b.id,icon:'upload'}));
 if(ops&&b.status==='exported')acts.push(ui.btn(t('prn.pr.btn'),{kind:'primary',act:'prn_printedAsk',arg:b.id,icon:'check'}));
 if(ops&&!['closed'].includes(b.status))acts.push(ui.btn(t('prn.bl.batch'),{kind:'danger',act:'prn_blockBatchAsk',arg:b.id}));
 const q=String(u.cq||'').trim();const qd=digits(q);const qn=prnCodeNorm(q);
 const flt=codes.filter(c=>!q||(qd&&c.serial.replace(/ /g,'').indexOf(qd)>=0)||(qn.length>=4&&c.code.slice(-4)===qn.slice(-4)));
 const per=50;const pg=Math.max(1,Math.min(u.cpage||1,Math.ceil(flt.length/per)||1));
 const crow=flt.slice((pg-1)*per,pg*per).map(c=>({cells:[`<span class="mono">${esc(c.serial)}</span>`,`<span class="mono">${esc(prn_mask(c.code))}</span>`,prn_cBadge(c.status),c.activatedAt?`<span class="xs">${fmtDateTime(c.activatedAt)}</span>`:c.blockedAt?`<span class="xs">${fmtDateTime(c.blockedAt)} · ${esc(t('prn.bl.r.'+(c.blockReason||'lost')))}</span>`:'—',c.iccid?`<span class="mono xs">···${esc(c.iccid.slice(-6))}</span>`:'—']}));
 const dl=b.downloads.length?ui.table([{label:t('c.date')},{label:t('prn.h.by')},{label:t('prn.dl.to')},{label:t('prn.dl.kind')}],b.downloads.map(e=>({cells:[`<span class="xs">${fmtDateTime(e.at)}</span>`,esc(e.by),esc(e.to||'—'),e.reason?ui.badge(t('prn.rl.re'),'warn')+' '+esc(e.reason):ui.badge(t('prn.rl.first'),'info')]}))):`<p class="small muted" style="padding:0 16px 16px">${t('prn.dl.none')}</p>`;
 const bl=b.blocks.length?b.blocks.map(x=>`<li>${fmtDateTime(x.at)} · ${esc(x.by)} · ${t('prn.bl.m.'+x.mode)} ${esc([x.from,x.to].filter(Boolean).join(' – '))} · ${fmtNum(x.n)} · ${esc(t('prn.bl.r.'+x.reason))}</li>`).join(''):'';
 return ui.page({title:`<span class="mono">${esc(b.no)}</span>`,sub:t('prn.bt.dsub',{p:esc(b.plan.name),n:fmtNum(b.qty),c:esc(ctyName(b.cc))}),crumbs:[[t('prn.bt.title'),'#prn-batches'],[b.no]],actions:acts.join(''),body:`<div class="stack">
  <div class="grid4">${ui.kpi(t('prn.cst.printed'),fmtNum(s.printed+s.exported_for_print+s.generated),t('prn.bt.notUsed'))}${ui.kpi(t('prn.cst.activated'),fmtNum(s.activated))}${ui.kpi(t('prn.cst.blocked'),fmtNum(s.blocked))}${ui.kpi(t('prn.cst.expired'),fmtNum(s.expired))}</div>
  <div class="prn-cols">${ui.card({title:t('prn.bt.info'),body:`<dl class="dl"><dt>${t('prn.m.plan')}</dt><dd>${esc(b.plan.name)} · <span class="mono xs">${esc(b.plan.sku)}</span> · ${PRN_PKG[b.plan.pkg]} · ${b.plan.term} ${t('prn.mo')}</dd><dt>${t('prn.f.cty')}</dt><dd>${esc(ctyName(b.cc))}</dd>
   <dt>${t('prn.bt.serials')}</dt><dd class="mono">${prn_serialFmt(b.serialFrom)} – ${prn_serialFmt(b.serialTo)}</dd><dt>${t('prn.bt.printDate')}</dt><dd>${prn_ddmmyyyy(b.printDate)}</dd><dt>${t('prn.bt.deadline')}</dt><dd>${prn_ddmmyyyy(b.deadline)}</dd>
   <dt>${t('prn.bt.run')}</dt><dd>${b.runId?`<a class="mono" href="#prn-run--${b.runId}">${esc(b.runNo)}</a>`:'—'}</dd><dt>${t('prn.rel.brand')}</dt><dd>v${b.brandVer}</dd><dt>${t('prn.bt.keysRes')}</dt><dd>${fmtNum(codes.filter(c=>c.keyResLotId).length)}</dd></dl>`})}
  ${ui.card({title:t('prn.bt.flow'),body:tl})}</div>
  ${ui.card({title:t('prn.dl.log'),body:dl,pad:false})}${bl?ui.card({title:t('prn.bl.log'),body:`<ul class="small prn-ul">${bl}</ul>`}):''}
  ${ui.card({title:t('prn.bt.codes'),actions:`<input class="inp" type="text" data-prnchg="prn_cq" value="${esc(u.cq||'')}" placeholder="${esc(t('prn.bt.cq'))}" aria-label="${esc(t('prn.bt.cq'))}" style="max-width:240px">`,body:`<p class="xs muted" style="padding:0 16px">${t('prn.bt.codesNote')}</p>`+ui.table([{label:t('prn.bt.serial')},{label:t('prn.bt.code')},{label:t('c.status')},{label:t('c.date')},{label:'ICCID'}],crow)+(flt.length>per?ui.pager(pg,flt.length,per,'prn_cpage'):''),pad:false})}</div>`});}});
ACT.prn_cq=v=>{const u=prn_ui();u.cq=v;u.cpage=1;rerender();};ACT.prn_cpage=v=>{prn_ui().cpage=+v;rerender();};
ACT.prn_dlAsk=id=>{const b=prn_batch(id);if(!b||!prn_canOps())return;const again=b.downloads.length>0;if(again&&!S.admin){toast(t('prn.dl.onlyOta'),'bad');return;}
 modal(again?t('prn.dl.againT'):t('prn.dl.t'),`<form id="prn_dlF" data-form="prn_dl" data-id="${b.id}" class="stack" novalidate>${again?ui.note('admin',t('prn.dl.againP')):ui.note('warn',t('prn.dl.p'))}${S.admin?ui.note('admin',t('prn.dl.demo')):''}
  ${ui.field({id:'to',label:t('prn.dl.to'),placeholder:t('prn.dl.toPh'),hint:t('prn.dl.toH')})}${again?ui.field({id:'reason',label:t('prn.dl.reason'),type:'textarea',rows:3}):''}
  <p class="xs muted">${t('prn.dl.fmt')}</p></form>`,ui.btn(t('c.cancel'),{act:'ovclose'})+`<button class="btn primary" type="submit" form="prn_dlF"><span>${t('prn.dl.do')}</span></button>`);};
FORM.prn_dl=f=>{const b=prn_batch(f.dataset.id);if(!b||!prn_canOps())return;clearErrs(f);const d=formData(f);if(!String(d.to||'').trim()){setErr(f,'to',t('prn.v.req'));return;}
 if(b.downloads.length&&!String(d.reason||'').trim()){setErr(f,'reason',t('prn.v.req'));return;}const r=prn_export(b,{to:d.to,reason:d.reason});if(r.err){toast(t('prn.dl.e.'+r.err),'bad');return;}
 prn_bridgePush();closeOverlay();toast(t('prn.dl.done',{n:b.no}));rerender();};
ACT.prn_printedAsk=id=>{const b=prn_batch(id);if(!b)return;modal(t('prn.pr.t'),`<p>${t('prn.pr.p',{n:esc(b.no),q:fmtNum(b.qty)})}</p>`,ui.btn(t('c.cancel'),{act:'ovclose'})+ui.btn(t('prn.pr.btn'),{kind:'primary',act:'prn_printedDo',arg:id}));};
ACT.prn_printedDo=id=>{const b=prn_batch(id);if(!b||!prn_canOps())return;const n=prn_markPrinted(b);prn_bridgePush();closeOverlay();toast(t('prn.pr.done',{n:fmtNum(n)}));rerender();};
ACT.prn_blockBatchAsk=id=>{const b=prn_batch(id);if(!b)return;modal(t('prn.bl.batchT',{n:b.no}),`<form id="prn_bbF" data-form="prn_blockBatch" data-id="${b.id}" class="stack" novalidate><p>${t('prn.bl.batchP')}</p>${ui.field({id:'reason',label:t('prn.bl.reason'),type:'select',options:[['lost',t('prn.bl.r.lost')],['stolen',t('prn.bl.r.stolen')],['damaged',t('prn.bl.r.damaged')],['other',t('prn.bl.r.other')]]})}</form>`,
 ui.btn(t('c.cancel'),{act:'ovclose'})+`<button class="btn danger" type="submit" form="prn_bbF"><span>${t('prn.bl.do')}</span></button>`);};
FORM.prn_blockBatch=f=>{if(!prn_canOps())return;const r=prn_block({mode:'batch',batchId:f.dataset.id,reason:formData(f).reason});closeOverlay();if(r.err){toast(t('prn.bl.e.'+r.err),'bad');return;}toast(t('prn.bl.done',{n:fmtNum(r.n)}));rerender();};
FORM.prn_block=f=>{if(!prn_canOps())return;clearErrs(f);const d=formData(f);if(!digits(d.from)){setErr(f,'from',t('prn.v.req'));return;}if(d.mode==='range'&&!digits(d.to)){setErr(f,'to',t('prn.v.req'));return;}
 const r=prn_block({mode:d.mode,from:digits(d.from),to:digits(d.to),reason:d.reason});if(r.err){setErr(f,'from',t('prn.bl.e.'+r.err));return;}toast(t('prn.bl.done',{n:fmtNum(r.n)})+(r.skipped?' '+t('prn.bl.skipped',{n:fmtNum(r.skipped)}):''));rerender();};

/* ===== Shipment labels A1 / A2 ===== */
route('prn-labels',{nav:'prn',render(id){if(!prn_canView())return prn_noAccess();prn_fontLink();const u=prn_ui();const list=S.shipments||[];
 if(!id){const rows=list.map(h=>({href:'#prn-labels--'+h.id,cells:[`<span class="mono">${esc(h.pf)}</span>`,esc(ctyName(h.cc)),`<span class="num">${fmtNum(h.qty)}</span>`,`<span class="mono xs">${esc(prn_iccidGrp(genIccid(h.iccidFrom)))} – ${esc(prn_iccidGrp(genIccid(h.iccidTo)))}</span>`,esc(h.status)]}));
  return ui.page({title:t('prn.lb.title'),sub:t('prn.lb.sub'),crumbs:[[t('prn.title'),'#prn-mat'],[t('prn.lb.title')]],body:ui.card({title:t('prn.lb.pick'),body:ui.table([{label:'PF'},{label:t('prn.f.cty')},{label:t('prn.bt.qty'),cls:'num'},{label:'ICCID'},{label:t('c.status')}],rows,{empty:ui.empty('truck',t('prn.lb.none'),'')}),pad:false})});}
 const h=list.find(x=>x.id===id);if(!h)return ui.page({title:t('prn.lb.nf'),crumbs:[[t('prn.lb.title'),'#prn-labels']],body:ui.empty('search',t('prn.lb.nf'),'')});
 const bv=prn_approved()||prn_latest();const size=+u.packSize||500;const packs=prn_packs(h,size),cartons=prn_cartons(h,size);const which=u.lbl==='A2'?'A2':'A1';const z=parseFloat(u.zoom)||1;
 const d=o=>prn_data(bv,Object.assign({cc:h.cc,zones:u.zones},o));
 const sheets=which==='A1'?packs.slice(0,3).map(pk=>prn_sheet('A1',d({pack:pk}),{})).join(''):cartons.slice(0,3).map(c=>prn_sheet('A2',d({carton:c}),{})).join('');
 const more=(which==='A1'?packs.length:cartons.length)>3?`<p class="xs muted">${t('prn.lb.more',{n:(which==='A1'?packs.length:cartons.length)-3})}</p>`:'';
 const opt=(v,l,sel)=>`<option value="${v}" ${String(v)===String(sel)?'selected':''}>${l}</option>`;
 return ui.page({title:t('prn.lb.title'),sub:t('prn.lb.dsub',{pf:esc(h.pf),n:fmtNum(h.qty),c:esc(ctyName(h.cc))}),crumbs:[[t('prn.lb.title'),'#prn-labels'],[h.pf]],actions:ui.btn(t('prn.lb.print',{n:which==='A1'?packs.length:cartons.length}),{kind:'primary',act:'prn_printLabels',arg:h.id,icon:'printer'})+ui.btn(t('prn.lb.ship'),{href:'#shipment--'+h.id}),
  body:`<div class="stack">${!prn_approved()?ui.note('warn',t('prn.lb.draft')):''}<div class="row wrap g12 prn-ctls">${ui.seg('prn_lbl',[['A1',t('prn.lb.a1',{n:packs.length})],['A2',t('prn.lb.a2',{n:cartons.length})]],which,'prn_setLbl')}
  <label class="prn-ctl"><span>${t('prn.lb.pack')}</span><select class="inp" data-act="prn_setU" data-arg="packSize">${[100,250,500,1000].map(n=>opt(n,n,size)).join('')}</select></label>
  <label class="prn-ctl"><span>${t('prn.m.zoom')}</span><select class="inp" data-act="prn_setU" data-arg="zoom">${['0.5','1','1.5'].map(x=>opt(x,x==='1'?t('prn.m.z1'):Math.round(x*100)+'%',u.zoom)).join('')}</select></label>
  <label class="chk small"><input type="checkbox" data-act="prn_tog" data-arg="zones" ${u.zones?'checked':''}><span>${t('prn.m.zones')}</span></label></div>
  ${ui.note('info',t('prn.lb.note'))}<div class="prn-stage" style="--z:${z}">${sheets}</div>${more}</div>`});}});
ACT.prn_setLbl=v=>{prn_ui().lbl=v;rerender();};
ACT.prn_printLabels=id=>{const h=(S.shipments||[]).find(x=>x.id===id);if(!h)return;const u=prn_ui();const bv=prn_approved()||prn_latest();const size=+u.packSize||500;const which=u.lbl==='A2'?'A2':'A1';
 const d=o=>prn_data(bv,Object.assign({cc:h.cc,zones:false},o));const html=which==='A1'?prn_packs(h,size).map(pk=>prn_sheet('A1',d({pack:pk}),{print:true})).join(''):prn_cartons(h,size).map(c=>prn_sheet('A2',d({carton:c}),{print:true})).join('');
 prn_print(html,214,301);audit('print.labels',h.pf,{type:which,pages:which==='A1'?prn_packs(h,size).length:prn_cartons(h,size).length,packSize:size,brandVersion:bv.version});};
/* ---------- reconcile: expiry, reservations, bridge (each render) ---------- */
let prn_syncBusy=false;
HOOKS.afterRender.push(()=>{if(prn_syncBusy||!S||!S.authed||!S.org||!S.prn)return;prn_syncBusy=true;try{const before=JSON.stringify([(S.codes||[]).filter(prn_isNewCode).map(c=>c.status).join(''),(S.keyLots||[]).map(l=>l.reserved||0).join(',')]);
 prn_expire();prn_bridgePush();const after=JSON.stringify([(S.codes||[]).filter(prn_isNewCode).map(c=>c.status).join(''),(S.keyLots||[]).map(l=>l.reserved||0).join(',')]);if(before!==after)save();}catch(e){console.error(e);}prn_syncBusy=false;});

/* ---------- demo seed: approved brand v1, plans, released UA runs, one printed UA batch (CSV issued once), one blocked card ---------- */
HOOKS.seedDemo.push(()=>{S.prn=undefined;const p=prn_st();const bv=prn_approved();if(!bv)return;const ts=iso(addDays(now(),-18));
 const mkRun=(type,cc,lang,pl)=>{const o={type,cc,lang,planId:pl?pl.id:''};const n=prn_runNo(type,prn_runKey(o),bv.id);if(n.fresh)p.seq[type]=n.nnn;
  const r={id:uid('pr'),no:n.no,nnn:n.nnn,v:n.v,type,cc,lang,planId:o.planId,plan:pl?{name:pl.name,sku:pl.sku,pkg:pl.pkg,term:pl.term}:null,brandId:bv.id,brandVer:bv.version,tplVer:PRN_TPL_VER,
   snap:{brandName:bv.brandName,logoSvg:bv.logoSvg,accent:bv.accent,accentCmyk:bv.accentCmyk,ink:bv.ink,domain:bv.domain,domainShort:bv.domainShort,countries:JSON.parse(JSON.stringify(bv.countries))},sizes:PRN_SZ[type],createdAt:ts,by:'Anna Petrova',role:'ota_legal'};p.runs.push(r);return r;};
 const plUA=p.plans.find(x=>x.cc==='UA'&&x.term===24&&x.pkg==='std');if(!plUA)return;mkRun('B1','UA','',plUA);const b2=mkRun('B2','UA','',null);mkRun('C1','','uk',null);mkRun('C2','','uk',null);
 if(prn_keysFree('UA')<200)return;const r=prn_batchCreate({planId:plUA.id,qty:200,printDate:iso(addDays(now(),-15)).slice(0,10),runId:b2.id});if(!r.batch)return;const b=r.batch;b.createdAt=ts;b.by='Maria Lind';
 b.downloads.push({at:iso(addDays(now(),-15)),by:'Maria Lind',role:'p_admin',to:'Demo Print House (fictional)',reason:'',n:b.qty,file:b.no+'_serial-code-deadline.csv'});p.csvLog.push(Object.assign({batch:b.no},b.downloads[0]));b.status='exported';b.exportedAt=b.downloads[0].at;
 prn_codesOf(b).forEach(c=>{c.status='printed';c.createdAt=ts;});b.status='printed';b.printedAt=iso(addDays(now(),-10));b.printedBy='Maria Lind';
 const c=prn_codesOf(b)[199];c.status='blocked';c.voidAt=c.blockedAt=iso(addDays(now(),-5));c.blockReason='lost';prn_releaseKey(c);b.blocks.push({at:c.blockedAt,by:'Maria Lind',mode:'serial',from:c.serial.replace(/ /g,''),to:'',n:1,reason:'lost'});});

/* ---------- test / integration handle (pure helpers only) ---------- */
try{window.cfbPrn={prnCodeGen,prnCodeCheck,prnCodeNorm,prnCodeFmt,prnQr,prnQrSvg,prnQrDecodeMatrix,prnC128Values,prnC128Svg,luhnChar:prn_luhnChar,logoCheck:prn_logoCheck,contrast:prn_contrast,months:prn_months,
 runChecks:async which=>{const bv=which==='stress'?prn_stressBrand('tz','sb_wide'):which==='max'?prn_stressBrand('max','sb_wide'):(prn_approved()||prn_latest());return prn_runChecks(bv,{stress:which==='stress'||which==='max'});}};}catch(e){}

/* ---------- UI strings (uk / en / ru). Print texts are NOT here: they come from the templates in their own languages. ---------- */
(()=>{const R=[
['prn.nav','Друковані матеріали','Print materials','Печатные материалы'],
['prn.nav.batches','Партії скретч-карт','Card batches','Партии скретч-карт'],
['prn.title','Друковані матеріали','Print materials','Печатные материалы'],
['prn.sub','Бренд-профіль, пакети, макети карт, конвертів і етикеток — портал збирає їх із ваших даних.','Brand profile, plans and layouts of cards, sleeves and labels — the portal builds them from your data.','Бренд-профиль, пакеты, макеты карт, конвертов и этикеток — портал собирает их из ваших данных.'],
['prn.tab.brand','Бренд-профіль','Brand profile','Бренд-профиль'],['prn.tab.plans','Пакети і SKU','Plans & SKUs','Пакеты и SKU'],['prn.tab.mat','Макети','Layouts','Макеты'],['prn.tab.checks','Перевірки','Checks','Проверки'],['prn.tab.runs','Випуски','Releases','Выпуски'],
['prn.na.t','Немає доступу','No access','Нет доступа'],['prn.na.p','Друковані матеріали бачать адміністратор, підписант і операційний менеджер партнера, а також OTA.','Print materials are visible to the partner’s admin, signatory and operations, and to OTA.','Печатные материалы видят администратор, подписант и операционный менеджер партнёра, а также OTA.'],
['prn.bs.draft','Чернетка','Draft','Черновик'],['prn.bs.submitted','На перевірці OTA','In OTA review','На проверке OTA'],['prn.bs.approved','Затверджено','Approved','Утверждено'],['prn.bs.rejected','Повернуто','Returned','Возвращено'],['prn.bs.superseded','Замінено','Superseded','Заменено'],
['prn.verN','Версія {n}','Version {n}','Версия {n}'],['prn.apInUse','у друці — затверджена v{n}','in print: approved v{n}','в печати — утверждённая v{n}'],
['prn.b.submit','Надіслати на перевірку','Submit for review','Отправить на проверку'],['prn.b.newVer','Нова версія','New version','Новая версия'],['prn.b.approve','Затвердити','Approve','Утвердить'],['prn.b.reject','Повернути','Return','Вернуть'],
['prn.b.save','Зберегти','Save','Сохранить'],['prn.b.edit','Змінити','Edit','Изменить'],['prn.b.allMat','Усі макети','All layouts','Все макеты'],['prn.b.print','Друк / PDF','Print / PDF','Печать / PDF'],['prn.b.release','Випустити','Release','Выпустить'],['prn.b.run','Запустити перевірки','Run checks','Запустить проверки'],['prn.b.openRun','Відкрити випуск','Open release','Открыть выпуск'],
['prn.n.otaReview','Партнер надіслав бренд-профіль. Перевірте логотип, колір і домен і затвердьте або поверніть із причиною.','The partner submitted the brand profile. Check the logo, colour and domain, then approve or return it with a reason.','Партнёр отправил бренд-профиль. Проверьте логотип, цвет и домен и утвердите или верните с причиной.'],
['prn.n.submitted','Профіль на перевірці OTA. Поки її немає, у друк іде попередня затверджена версія.','The profile is in OTA review. Until it is approved, the previous approved version is used for print.','Профиль на проверке OTA. Пока её нет, в печать идёт предыдущая утверждённая версия.'],
['prn.n.rejected','OTA повернула профіль: {r}. Створіть нову версію і виправте.','OTA returned the profile: {r}. Create a new version and fix it.','OTA вернула профиль: {r}. Создайте новую версию и исправьте.'],
['prn.n.approved','Затверджено {d} · {by}. Щоб щось змінити, створіть нову версію — випущені тиражі не зміняться.','Approved {d} · {by}. To change anything, create a new version — released runs stay as they are.','Утверждено {d} · {by}. Чтобы что-то изменить, создайте новую версию — выпущенные тиражи не изменятся.'],
['prn.n.readOnly','Змінювати бренд-профіль може адміністратор партнера.','The partner admin can edit the brand profile.','Изменять бренд-профиль может администратор партнёра.'],
['prn.c.profile','Бренд-профіль','Brand profile','Бренд-профиль'],['prn.c.preview','Попередній перегляд','Preview','Предпросмотр'],['prn.c.history','Версії','Versions','Версии'],
['prn.prevNote','Зменшено. Фізичний розмір і всі макети — у вкладці «Макети».','Scaled down. Physical size and all layouts are on the Layouts tab.','Уменьшено. Физический размер и все макеты — во вкладке «Макеты».'],
['prn.f.brand','Назва бренду (brandName)','Brand name (brandName)','Название бренда (brandName)'],['prn.f.brandH','2–20 знаків: латиниця, кирилиця, цифри, пробіл, дефіс. Програма — «brandName CONNECT».','2–20 characters: Latin, Cyrillic, digits, space, hyphen. The programme is “brandName CONNECT”.','2–20 знаков: латиница, кириллица, цифры, пробел, дефис. Программа — «brandName CONNECT».'],
['prn.f.domain','Домен порталу','Portal domain','Домен портала'],['prn.f.domainH','{n} / 30 знаків (карта). Завжди один рядок.','{n} / 30 characters (card). Always one line.','{n} / 30 знаков (карта). Всегда одна строка.'],
['prn.f.short','Короткий піддомен для конверта','Short subdomain for the sleeve','Короткий поддомен для конверта'],['prn.f.shortH','Потрібен, якщо домен довший за 24 знаки (конверт і носій SIM).','Needed when the domain is longer than 24 characters (sleeve and SIM carrier).','Нужен, если домен длиннее 24 знаков (конверт и носитель SIM).'],
['prn.f.accent','Акцентний колір','Accent colour','Акцентный цвет'],['prn.f.accentH','Контраст з білим {r} : 1 (потрібно ≥ 4,5). Лише «CONNECT», строк і номери кроків.','Contrast with white {r} : 1 (needs ≥ 4.5). Only “CONNECT”, the term and step numbers.','Контраст с белым {r} : 1 (нужно ≥ 4,5). Только «CONNECT», срок и номера шагов.'],
['prn.f.ink','Колір тексту і ліній (ink)','Text and line colour (ink)','Цвет текста и линий (ink)'],['prn.f.inkH','За замовчуванням графіт #22262C.','Default: graphite #22262C.','По умолчанию графит #22262C.'],
['prn.f.cmyk','Pantone / CMYK для друкарні','Pantone / CMYK for the printer','Pantone / CMYK для типографии'],['prn.f.cmykH','Підказка з HEX: {c}. Точне значення — з брендбуку.','From HEX: {c}. Take the exact value from your brand book.','Из HEX: {c}. Точное значение — из брендбука.'],
['prn.f.logo','Логотип (один файл на всі матеріали)','Logo (one file for all materials)','Логотип (один файл на все материалы)'],['prn.f.upload','Завантажити SVG','Upload SVG','Загрузить SVG'],['prn.f.noLogo','Логотип ще не завантажено.','No logo uploaded yet.','Логотип ещё не загружен.'],
['prn.f.logoH','Вектор SVG, прозорий фон, обрізаний по контуру, один колір. PDF/EPS конвертуються в SVG на сервері (буде пізніше).','Vector SVG, transparent background, trimmed to the outline, one colour. PDF/EPS are converted to SVG on the server (coming later).','Вектор SVG, прозрачный фон, обрезан по контуру, один цвет. PDF/EPS конвертируются в SVG на сервере (будет позже).'],
['prn.f.countries','Країни: мови і підтримка','Countries: languages and support','Страны: языки и поддержка'],['prn.f.cty','Країна','Country','Страна'],['prn.f.cardLangs','Мови карти','Card languages','Языки карты'],['prn.f.sleeve','Мова конверта','Sleeve language','Язык конверта'],['prn.f.phone','Телефон підтримки','Support phone','Телефон поддержки'],
['prn.f.ctyH','Мови скретч-карти задає країна Замовлення (UA — українська, KZ — казахська + російська). Конверт — одна мова на тираж країни.','Scratch-card languages follow the Order Form country (UA — Ukrainian, KZ — Kazakh + Russian). The sleeve has one language per country run.','Языки скретч-карты задаёт страна Заказа (UA — украинский, KZ — казахский + русский). Конверт — один язык на тираж страны.'],
['prn.lr.vector','Векторний файл (SVG)','Vector file (SVG)','Векторный файл (SVG)'],['prn.lr.raster','Без растрових вставок','No raster images inside','Без растровых вставок'],['prn.lr.colors','Кольорів у файлі: {n} (потрібен один)','Colours in the file: {n} (one expected)','Цветов в файле: {n} (нужен один)'],['prn.lr.ratio','Пропорції {r} : 1 — вписується в поле зліва','Ratio {r} : 1 — fitted into the field, left-aligned','Пропорции {r} : 1 — вписывается в поле слева'],
['prn.lr.wordmark','Висота напису в полі C2 (7,5 мм): ≈ {mm} мм (потрібно ≥ 1,2 мм)','Lettering height in the C2 field (7.5 mm): ≈ {mm} mm (needs ≥ 1.2 mm)','Высота надписи в поле C2 (7,5 мм): ≈ {mm} мм (нужно ≥ 1,2 мм)'],
['prn.lc.notsvg','Це не SVG-файл.','This is not an SVG file.','Это не SVG-файл.'],['prn.lc.parse','Файл SVG не читається.','The SVG file cannot be read.','Файл SVG не читается.'],['prn.lc.raster','У логотипі є растрове зображення — потрібен чистий вектор.','The logo contains a raster image — a clean vector is needed.','В логотипе есть растровое изображение — нужен чистый вектор.'],['prn.lc.size','У SVG немає viewBox або розміру.','The SVG has no viewBox or size.','В SVG нет viewBox или размера.'],
['prn.w.wordmark','Напис у логотипі на конверті (поле 7,5 мм) буде ≈ {mm} мм — менше 1,2 мм. Рішення за OTA.','The logo lettering on the sleeve (7.5 mm field) would be ≈ {mm} mm — below 1.2 mm. OTA decides.','Надпись в логотипе на конверте (поле 7,5 мм) будет ≈ {mm} мм — меньше 1,2 мм. Решение за OTA.'],
['prn.w.colors','У логотипі {n} кольори — для друку потрібен один.','The logo has {n} colours — print needs one.','В логотипе {n} цвета — для печати нужен один.'],
['prn.w.noText','У SVG немає текстових елементів. Якщо напис намальовано кривими, його висота в полі C2 (7,5 мм) має бути ≥ 1,2 мм — це перевіряє OTA.','The SVG has no text elements. If the lettering is drawn as curves, its height in the C2 field (7.5 mm) must be ≥ 1.2 mm — OTA checks this.','В SVG нет текстовых элементов. Если надпись нарисована кривыми, её высота в поле C2 (7,5 мм) должна быть ≥ 1,2 мм — это проверяет OTA.'],
['prn.w.ink','Колір тексту має контраст {r} : 1 — радимо темніший (≥ 7 : 1).','The text colour has contrast {r} : 1 — a darker one is advised (≥ 7 : 1).','Цвет текста имеет контраст {r} : 1 — советуем темнее (≥ 7 : 1).'],
['prn.v.nameLen','Від 2 до 20 знаків.','2 to 20 characters.','От 2 до 20 знаков.'],['prn.v.nameChars','Лише латиниця, кирилиця, цифри, пробіл і дефіс.','Only Latin, Cyrillic, digits, space and hyphen.','Только латиница, кириллица, цифры, пробел и дефис.'],
['prn.v.domain','Введіть домен, наприклад connect.brand.com.','Enter a domain, e.g. connect.brand.com.','Введите домен, например connect.brand.com.'],['prn.v.domain30','Домен має {n} знаків — на карті вміщується до 30. Потрібен коротший піддомен.','The domain has {n} characters — the card fits up to 30. A shorter subdomain is needed.','В домене {n} знаков — на карте помещается до 30. Нужен короче поддомен.'],
['prn.v.short24','Домен має {n} знаків, а на конверті вміщується 24. Вкажіть короткий піддомен.','The domain has {n} characters and the sleeve fits 24. Enter a short subdomain.','В домене {n} знаков, а на конверте помещается 24. Укажите короткий поддомен.'],['prn.v.shortBad','Короткий піддомен — до 24 знаків, без пробілів.','Short subdomain: up to 24 characters, no spaces.','Короткий поддомен — до 24 знаков, без пробелов.'],
['prn.v.hex','Колір у форматі #RRGGBB.','Colour as #RRGGBB.','Цвет в формате #RRGGBB.'],['prn.v.contrast','Контраст з білим {r} : 1 — потрібно щонайменше 4,5 : 1. Виберіть темніший колір.','Contrast with white is {r} : 1 — at least 4.5 : 1 is needed. Pick a darker colour.','Контраст с белым {r} : 1 — нужно не меньше 4,5 : 1. Выберите цвет темнее.'],
['prn.v.logoNone','Завантажте логотип SVG.','Upload an SVG logo.','Загрузите логотип SVG.'],['prn.v.phone','Вкажіть телефон підтримки для цієї країни.','Enter the support phone for this country.','Укажите телефон поддержки для этой страны.'],['prn.v.phoneBad','Номер у форматі +код номер.','Number as +code number.','Номер в формате +код номер.'],['prn.v.lang','Виберіть мову.','Choose a language.','Выберите язык.'],
['prn.v.req','Обовʼязкове поле.','Required.','Обязательное поле.'],['prn.v.plan30','{n} знаків — максимум 30.','{n} characters — 30 at most.','{n} знаков — максимум 30.'],['prn.v.plan2','На карті назва займе більше 2 рядків. Скоротіть.','On the card the name would take more than 2 lines. Shorten it.','На карте название займёт больше 2 строк. Сократите.'],
['prn.v.sku16','SKU — до 16 знаків.','SKU: up to 16 characters.','SKU — до 16 знаков.'],['prn.v.skuChars','Лише латиниця, цифри, крапка, дефіс, підкреслення.','Only Latin letters, digits, dot, hyphen, underscore.','Только латиница, цифры, точка, дефис, подчёркивание.'],['prn.v.skuDup','Такий SKU вже є.','This SKU already exists.','Такой SKU уже есть.'],
['prn.t.saved','Чернетку v{n} збережено','Draft v{n} saved','Черновик v{n} сохранён'],['prn.t.savedErr','Збережено, але є помилки — виправте перед відправленням','Saved, but there are errors — fix them before submitting','Сохранено, но есть ошибки — исправьте перед отправкой'],
['prn.t.logoBig','Файл більший за 400 КБ','The file is larger than 400 KB','Файл больше 400 КБ'],['prn.t.logoType','Потрібен файл SVG','An SVG file is needed','Нужен файл SVG'],['prn.t.logoBad','Логотип не пройшов перевірку','The logo failed the check','Логотип не прошёл проверку'],['prn.t.logoOk','Логотип завантажено','Logo uploaded','Логотип загружен'],['prn.t.logoWarn','Логотип завантажено з попередженнями','Logo uploaded with warnings','Логотип загружен с предупреждениями'],
['prn.t.fix','Виправте помилки в профілі','Fix the errors in the profile','Исправьте ошибки в профиле'],['prn.t.submitted','Бренд-профіль v{n} надіслано на перевірку OTA','Brand profile v{n} submitted to OTA','Бренд-профиль v{n} отправлен на проверку OTA'],['prn.t.newVer','Створено чернетку v{n}','Draft v{n} created','Создан черновик v{n}'],
['prn.t.approved','Бренд-профіль v{n} затверджено','Brand profile v{n} approved','Бренд-профиль v{n} утверждён'],['prn.t.rejected','Бренд-профіль v{n} повернуто партнеру','Brand profile v{n} returned to the partner','Бренд-профиль v{n} возвращён партнёру'],
['prn.ap.t','Затвердити бренд-профіль v{n}','Approve brand profile v{n}','Утвердить бренд-профиль v{n}'],['prn.ap.p','Після затвердження з цієї версії будуються всі матеріали для друку. Попередня затверджена версія буде замінена; випущені тиражі не зміняться.','Once approved, all print materials are built from this version. The previous approved version is superseded; released runs do not change.','После утверждения из этой версии строятся все материалы для печати. Предыдущая утверждённая версия будет заменена; выпущенные тиражи не изменятся.'],
['prn.rj.t','Повернути бренд-профіль','Return the brand profile','Вернуть бренд-профиль'],['prn.rj.reason','Що виправити','What to fix','Что исправить'],
['prn.h.ver','Версія','Version','Версия'],['prn.h.by','Хто','By','Кто'],
['prn.mo','міс.','mo','мес.'],
['prn.pl.title','Пакети партнера (PartnerPlan)','Partner plans (PartnerPlan)','Пакеты партнёра (PartnerPlan)'],['prn.pl.add','Додати пакет','Add plan','Добавить пакет'],['prn.pl.edit','Змінити пакет','Edit plan','Изменить пакет'],
['prn.pl.note','Light / Standard / Premium — внутрішня класифікація OTA, на друк вона не виводиться. На карті друкується ваша назва пакета; SKU — для ваших облікових систем і звітів, на карті не друкується. Кожна назва — окремий тираж карт.','Light / Standard / Premium is OTA’s internal classification and is never printed. The card shows your plan name; the SKU is for your systems and reports and is not printed. Each name is a separate card run.','Light / Standard / Premium — внутренняя классификация OTA, на печать она не выводится. На карте печатается ваше название пакета; SKU — для ваших учётных систем и отчётов, на карте не печатается. Каждое название — отдельный тираж карт.'],
['prn.pl.name','Назва на карті','Name on the card','Название на карте'],['prn.pl.nameH','До 30 знаків, до 2 рядків на карті.','Up to 30 characters, up to 2 lines on the card.','До 30 знаков, до 2 строк на карте.'],['prn.pl.skuH','До 16 знаків. Не друкується.','Up to 16 characters. Not printed.','До 16 знаков. Не печатается.'],
['prn.pl.pkg','Пакет OTA','OTA package','Пакет OTA'],['prn.pl.pkgH','Має збігатися з тарифом моделей, на яких активують карти.','Must match the plan of the device models the cards are used on.','Должен совпадать с тарифом моделей, на которых активируют карты.'],['prn.pl.term','Строк','Term','Срок'],['prn.pl.tokens','Токенів','Tokens','Токенов'],
['prn.pl.active','Активний','Active','Активный'],['prn.pl.off','Вимкнено','Off','Выключен'],['prn.pl.activeL','Активний (можна створювати партії)','Active (batches can be created)','Активный (можно создавать партии)'],['prn.pl.used','є партії','has batches','есть партии'],
['prn.pl.lock','Для цього пакета вже є партії карт — змінити можна лише «Активний». Для іншої назви чи строку створіть новий пакет.','This plan already has card batches — only “Active” can change. For another name or term, create a new plan.','Для этого пакета уже есть партии карт — изменить можно только «Активный». Для другого названия или срока создайте новый пакет.'],
['prn.pl.emptyT','Пакетів ще немає','No plans yet','Пакетов ещё нет'],['prn.pl.emptyP','Додайте пакет: назва на карті, SKU, пакет OTA, строк і країна.','Add a plan: name on the card, SKU, OTA package, term and country.','Добавьте пакет: название на карте, SKU, пакет OTA, срок и страна.'],['prn.t.planSaved','Пакет «{n}» збережено','Plan “{n}” saved','Пакет «{n}» сохранён'],
['prn.m.rules','0 · Бренд-правила','0 · Brand rules','0 · Бренд-правила'],['prn.m.ds','Дані','Data','Данные'],['prn.m.dsProfile','Мій профіль','My profile','Мой профиль'],['prn.m.dsStress','Стрес-тест (ТЗ)','Stress test (spec)','Стресс-тест (ТЗ)'],['prn.m.dsMax','Стрес-тест (макс. довжини)','Stress test (max lengths)','Стресс-тест (макс. длины)'],
['prn.m.src','Версія профілю','Profile version','Версия профиля'],['prn.m.srcWork','Поточна v{n}','Current v{n}','Текущая v{n}'],['prn.m.srcAp','Затверджена v{n}','Approved v{n}','Утверждённая v{n}'],['prn.m.logo','Логотип','Logo','Логотип'],['prn.m.logoWide','Широкий 6 : 1','Wide 6 : 1','Широкий 6 : 1'],['prn.m.logoSq','Квадратний 1 : 1','Square 1 : 1','Квадратный 1 : 1'],
['prn.m.plan','Пакет','Plan','Пакет'],['prn.m.noPlan','Немає активного пакета для цієї країни','No active plan for this country','Нет активного пакета для этой страны'],['prn.m.lang','Мова','Language','Язык'],['prn.m.zoom','Масштаб','Zoom','Масштаб'],['prn.m.z1','100 % (фізичний розмір)','100% (physical size)','100 % (физический размер)'],
['prn.m.zones','Показати зони (сині — модулі партнера, рожеві — вирубка)','Show zones (blue — partner modules, pink — die line)','Показать зоны (синие — модули партнёра, розовые — вырубка)'],['prn.m.cut','Шар CutContour','CutContour layer','Слой CutContour'],['prn.m.scratched','Показати код під шаром (зразок)','Show the code under the layer (sample)','Показать код под слоем (образец)'],
['prn.m.spec','Обріз {w} × {h} мм + випуск 2 мм з кожного боку','Trim {w} × {h} mm + 2 mm bleed each side','Обрез {w} × {h} мм + вылет 2 мм с каждой стороны'],['prn.m.spec0','Лист для партнера і друкарні (екран / PDF)','Sheet for the partner and the printer (screen / PDF)','Лист для партнёра и типографии (экран / PDF)'],
['prn.m.wm','напис логотипа в полі C2 ≈ {mm} мм','logo lettering in the C2 field ≈ {mm} mm','надпись логотипа в поле C2 ≈ {mm} мм'],
['prn.m.pdfNote','Друк / PDF тут — у фізичному розмірі з браузера. Виробничий PDF/X із вбудованими шрифтами, CMYK і spot-кольором CutContour робить сервер (буде пізніше).','Print / PDF here is the browser’s, at physical size. The production PDF/X with embedded fonts, CMYK and the CutContour spot colour is made server-side (coming later).','Печать / PDF здесь — из браузера в физическом размере. Производственный PDF/X со встроенными шрифтами, CMYK и spot-цветом CutContour делает сервер (будет позже).'],
['prn.m.stressNote','Стрес-набір ТЗ 7.2.2: SUPERBRAND AUTO, connect.superbrand-auto.com, широкий (6 : 1) і квадратний логотипи, мови de і kk. Тексти для DE на карті ще не затверджені.','Stress set (spec 7.2.2): SUPERBRAND AUTO, connect.superbrand-auto.com, wide (6 : 1) and square logos, languages de and kk. DE card wording is not approved yet.','Стресс-набор ТЗ 7.2.2: SUPERBRAND AUTO, connect.superbrand-auto.com, широкий (6 : 1) и квадратный логотипы, языки de и kk. Тексты для DE на карте ещё не утверждены.'],
['prn.m.aNote','Етикетки A1 / A2 друкуються з запису відвантаження: діапазон ICCID, Code 128, номери PF / SR.','Labels A1 / A2 are printed from the shipment record: ICCID range, Code 128, PF / SR numbers.','Этикетки A1 / A2 печатаются из записи отгрузки: диапазон ICCID, Code 128, номера PF / SR.'],['prn.m.aLink','Вибрати відвантаження','Pick a shipment','Выбрать отгрузку'],
['prn.m.b2Note','Під захисним шаром друкується лише код текстом (без QR). Код, серійний номер і строк активації — змінний друк з файлу партії.','Only the code is printed under the scratch layer, as text (no QR). Code, serial number and activation deadline are variable print from the batch file.','Под защитным слоем печатается только код текстом (без QR). Код, серийный номер и срок активации — переменная печать из файла партии.'],
['prn.m.wta','Для цієї країни немає затверджених текстів карти — у макеті «[wording to be approved]». Випуск заблоковано до затвердження текстів.','There is no approved card wording for this country — the layout shows “[wording to be approved]”. Release is blocked until the wording is approved.','Для этой страны нет утверждённых текстов карты — в макете «[wording to be approved]». Выпуск заблокирован до утверждения текстов.'],
['prn.m.kzNote','Еталонний двомовний оборот KZ не вміщується в 85,6 × 54 мм при кеглі 6 pt (у PNG-еталоні низ обрізано). Тут кроки KZ / RU стоять поруч, тексти — дослівно з шаблону.','The reference bilingual KZ back does not fit 85.6 × 54 mm at 6 pt (the reference PNG is cut off at the bottom). Here the KZ / RU steps sit side by side; the texts are verbatim from the template.','Эталонный двуязычный оборот KZ не помещается в 85,6 × 54 мм при кегле 6 pt (в PNG-эталоне низ обрезан). Здесь шаги KZ / RU стоят рядом, тексты — дословно из шаблона.'],
['prn.rel.t','Випуск {m}','Release {m}','Выпуск {m}'],['prn.rel.no','Номер','Number','Номер'],['prn.rel.brand','Бренд-профіль','Brand profile','Бренд-профиль'],['prn.rel.tpl','Шаблон','Template','Шаблон'],
['prn.rel.p','Випуск отримує номер і стає незмінним. Будь-яка зміна профілю, шаблону чи мови — нова версія.','The release gets a number and becomes immutable. Any change of profile, template or language means a new version.','Выпуск получает номер и становится неизменным. Любое изменение профиля, шаблона или языка — новая версия.'],
['prn.rel.dup','Цей матеріал уже випущено з тим самим профілем і шаблоном: {n}.','This material is already released with the same profile and template: {n}.','Этот материал уже выпущен с тем же профилем и шаблоном: {n}.'],
['prn.rel.stale','Спершу запустіть автоперевірки для затвердженої версії профілю.','First run the auto-checks for the approved profile version.','Сначала запустите автопроверки для утверждённой версии профиля.'],
['prn.r.log','Випущено {n}','Released {n}','Выпущено {n}'],['prn.t.noApproved','Немає затвердженого бренд-профілю','No approved brand profile','Нет утверждённого бренд-профиля'],['prn.t.relBlocked','Випуск заблоковано: {n} перевірок не пройдено','Release blocked: {n} checks failed','Выпуск заблокирован: {n} проверок не пройдено'],
['prn.t.relErr.noBrand','Немає затвердженого бренд-профілю','No approved brand profile','Нет утверждённого бренд-профиля'],['prn.t.relErr.noCheck','Спершу запустіть автоперевірки','Run the auto-checks first','Сначала запустите автопроверки'],['prn.t.relErr.dup','Вже випущено','Already released','Уже выпущено'],['prn.t.relErr.checks','Перевірки не пройдено','Checks failed','Проверки не пройдены'],
['prn.ck.what','Перед випуском портал рендерить кожен макет і перевіряє: переповнення блоків, стрес-набір, QR (зворотне декодування), розміри обрізу й полів ±0,1 мм, мінімальний кегль, логотип, контраст акценту, незатверджені тексти. Будь-яка помилка блокує випуск відповідного матеріалу.','Before release the portal renders every layout and checks: block overflow, the stress set, QR (decoded back), trim and field sizes ±0.1 mm, minimum type size, logo, accent contrast, unapproved wording. Any failure blocks the release of that material.','Перед выпуском портал рендерит каждый макет и проверяет: переполнение блоков, стресс-набор, QR (обратное декодирование), размеры обреза и полей ±0,1 мм, минимальный кегль, логотип, контраст акцента, неутверждённые тексты. Любая ошибка блокирует выпуск соответствующего материала.'],
['prn.ck.noneT','Перевірок ще не було','No checks yet','Проверок ещё не было'],['prn.ck.noneP','Запустіть перевірки — це займе кілька секунд.','Run the checks — it takes a few seconds.','Запустите проверки — это займёт несколько секунд.'],['prn.ck.running','Перевіряємо…','Checking…','Проверяем…'],
['prn.ck.stale','Результати застаріли: профіль або шаблон змінився. Запустіть перевірки ще раз.','Results are out of date: the profile or template changed. Run the checks again.','Результаты устарели: профиль или шаблон изменился. Запустите проверки ещё раз.'],
['prn.ck.prof','Профіль v{n}','Profile v{n}','Профиль v{n}'],['prn.ck.stress','Стрес-набір','Stress set','Стресс-набор'],['prn.ck.stressP','SUPERBRAND AUTO / connect.superbrand-auto.com, логотипи 6 : 1 і 1 : 1; плюс максимальні довжини (20 знаків назви, 30 — домену); усі мови карт і конвертів.','SUPERBRAND AUTO / connect.superbrand-auto.com, 6 : 1 and 1 : 1 logos; plus max lengths (20-character name, 30-character domain); all card and sleeve languages.','SUPERBRAND AUTO / connect.superbrand-auto.com, логотипы 6 : 1 и 1 : 1; плюс максимальные длины (20 знаков названия, 30 — домена); все языки карт и конвертов.'],
['prn.ck.profile','Профіль','Profile','Профиль'],['prn.ck.fail','Помилок: {n}','Failed: {n}','Ошибок: {n}'],['prn.ck.pass','Усе гаразд','All passed','Всё в порядке'],['prn.ck.allPass','Усе пройдено','All passed','Всё пройдено'],['prn.ck.warn','Попереджень: {n}','Warnings: {n}','Предупреждений: {n}'],
['prn.ck.variant','Варіант','Variant','Вариант'],['prn.ck.check','Перевірка','Check','Проверка'],['prn.ck.detail','Деталі','Details','Детали'],['prn.ck.f','Помилка','Failed','Ошибка'],['prn.ck.w','Попередження','Warning','Предупреждение'],
['prn.ck.meta','Перевірено {d} · {by} · шаблон v{tpl}','Checked {d} · {by} · template v{tpl}','Проверено {d} · {by} · шаблон v{tpl}'],['prn.ck.noFont','шрифт Inter не завантажився, виміряно на запасному шрифті','the Inter font did not load; measured with the fallback font','шрифт Inter не загрузился, измерено на запасном шрифте'],
['prn.ck.relFail','Випуск заблоковано такими перевірками:','Release was blocked by these checks:','Выпуск заблокирован такими проверками:'],['prn.ck.wtaFound','у макеті є «[wording to be approved]»','the layout contains “[wording to be approved]”','в макете есть «[wording to be approved]»'],
['prn.ck.c.overflow','Переповнення','Overflow','Переполнение'],['prn.ck.c.sizes','Розміри','Sizes','Размеры'],['prn.ck.c.mintext','Мінімальний кегль','Minimum type size','Минимальный кегль'],['prn.ck.c.noframe','Без друкованої рамки','No printed frame','Без печатной рамки'],['prn.ck.c.qr','QR декодується','QR decodes','QR декодируется'],['prn.ck.c.code128','Code 128','Code 128','Code 128'],
['prn.ck.c.wording','Затверджені тексти','Approved wording','Утверждённые тексты'],['prn.ck.c.contrast','Контраст акценту','Accent contrast','Контраст акцента'],['prn.ck.c.logo','Логотип: вектор, без растру','Logo: vector, no raster','Логотип: вектор, без растра'],['prn.ck.c.wordmark','Напис логотипа ≥ 1,2 мм','Logo lettering ≥ 1.2 mm','Надпись логотипа ≥ 1,2 мм'],['prn.ck.c.domain','Довжина домену','Domain length','Длина домена'],
['prn.t.ckFail','Перевірки: {n} помилок — випуск цих матеріалів заблоковано','Checks: {n} failed — release of those materials is blocked','Проверки: {n} ошибок — выпуск этих материалов заблокирован'],['prn.t.ckOk','Усі перевірки пройдено','All checks passed','Все проверки пройдены'],
['prn.rl.title','Випуски матеріалів','Material releases','Выпуски материалов'],['prn.rl.note','Номер OTA-{код}-PRN-{тип}-{NNN}-v{N}. NNN — матеріал (тип, країна, мова, пакет), vN — нова версія після зміни профілю чи шаблону. Випущені тиражі не змінюються.','Number OTA-{code}-PRN-{type}-{NNN}-v{N}. NNN is the material (type, country, language, plan), vN a new version after a profile or template change. Released runs never change.','Номер OTA-{код}-PRN-{тип}-{NNN}-v{N}. NNN — материал (тип, страна, язык, пакет), vN — новая версия после изменения профиля или шаблона. Выпущенные тиражи не меняются.'],
['prn.rl.type','Тип','Type','Тип'],['prn.rl.what','Країна · мова · пакет','Country · language · plan','Страна · язык · пакет'],['prn.rl.emptyT','Випусків ще немає','No releases yet','Выпусков ещё нет'],['prn.rl.emptyP','Відкрийте макет і натисніть «Випустити» після затвердження профілю і перевірок.','Open a layout and press “Release” once the profile is approved and the checks pass.','Откройте макет и нажмите «Выпустить» после утверждения профиля и проверок.'],
['prn.rl.csv','Журнал файлів змінного друку','Variable-print file log','Журнал файлов переменной печати'],['prn.rl.csvEmpty','Файлів ще не видавали.','No files issued yet.','Файлов ещё не выдавали.'],['prn.rl.first','Перша видача','First issue','Первая выдача'],['prn.rl.re','Повторно (OTA)','Re-issue (OTA)','Повторно (OTA)'],['prn.rl.nf','Випуск не знайдено','Release not found','Выпуск не найден'],
['prn.run.sub','{m} · {d} · {by}','{m} · {d} · {by}','{m} · {d} · {by}'],['prn.run.frozen','Випуск незмінний: макет зібрано із знімка профілю на момент випуску.','The release is immutable: the layout is built from the profile snapshot taken at release.','Выпуск неизменный: макет собран из снимка профиля на момент выпуска.'],['prn.run.size','Розмір','Size','Размер'],['prn.run.ac','Акцент','Accent','Акцент'],
['prn.bt.title','Партії скретч-карт','Card batches','Партии скретч-карт'],['prn.bt.sub','Коди пакетів для друку: серійні номери, строк активації, файл змінного друку, блокування.','Package codes for print: serial numbers, activation deadline, variable-print file, blocking.','Коды пакетов для печати: серийные номера, срок активации, файл переменной печати, блокировка.'],
['prn.bt.keys','вільних ключів','free keys','свободных ключей'],['prn.bt.keysSub','{r} зарезервовано під карти','{r} reserved for cards','{r} зарезервировано под карты'],
['prn.bt.note','Кожен код партії резервує один ключ активації країни пакета. Під час активації ключ списується (новий пристрій) або резерв знімається; заблоковані й прострочені коди звільняють ключ. Активувати можна лише код у статусі «Надруковано».','Each code in a batch reserves one Activation Key of the plan’s country. On activation the key is used (new device) or the reservation is released; blocked and expired codes free the key. Only a code in status “Printed” can be activated.','Каждый код партии резервирует один ключ активации страны пакета. При активации ключ списывается (новое устройство) или резерв снимается; заблокированные и просроченные коды освобождают ключ. Активировать можно только код в статусе «Напечатано».'],
['prn.bt.noBrand','Немає затвердженого бренд-профілю — партію створити не можна.','No approved brand profile — a batch cannot be created.','Нет утверждённого бренд-профиля — партию создать нельзя.'],
['prn.bt.list','Партії','Batches','Партии'],['prn.bt.no','Партія','Batch','Партия'],['prn.bt.qty','Кількість','Quantity','Количество'],['prn.bt.serials','Серійні номери','Serial numbers','Серийные номера'],['prn.bt.deadline','Активувати до','Activate by','Активировать до'],['prn.bt.abe','Акт. / блок. / простр.','Act. / blk. / exp.','Акт. / блок. / проср.'],
['prn.bt.emptyT','Партій ще немає','No batches yet','Партий ещё нет'],['prn.bt.emptyP','Створіть партію для пакета і країни — коди генеруються з ваших ключів активації цієї країни.','Create a batch for a plan and country — codes are generated from your Activation Keys for that country.','Создайте партию для пакета и страны — коды генерируются из ваших ключей активации этой страны.'],
['prn.bt.new','Нова партія','New batch','Новая партия'],['prn.bt.create','Згенерувати коди','Generate codes','Сгенерировать коды'],['prn.bt.qtyH','Від 1 до 5 000 карт.','1 to 5,000 cards.','От 1 до 5 000 карт.'],['prn.bt.qtyBad','Від 1 до 5 000.','1 to 5,000.','От 1 до 5 000.'],
['prn.bt.printDate','Дата друку','Print date','Дата печати'],['prn.bt.deadlineH','За замовчуванням — дата друку + 36 місяців (п. 4.1 Документа 03).','Default: print date + 36 months (Document 03, 4.1).','По умолчанию — дата печати + 36 месяцев (п. 4.1 Документа 03).'],['prn.bt.dlBad','Строк має бути пізніше за дату друку.','The deadline must be after the print date.','Срок должен быть позже даты печати.'],['prn.bt.dlPast','Строк активації вже минув — виберіть дату не раніше {d}.','The deadline is already in the past — pick a date no earlier than {d}.','Срок активации уже прошёл — выберите дату не раньше {d}.'],
['prn.bt.dlSoon','До строку менше місяця — карти можуть не встигнути продати. Натисніть «Згенерувати коди» ще раз, щоб підтвердити.','The deadline is less than a month away — the cards may not sell in time. Press “Generate codes” again to confirm.','До срока меньше месяца — карты могут не успеть продать. Нажмите «Сгенерировать коды» ещё раз, чтобы подтвердить.'],
['prn.bt.dlMax','Не пізніше ніж дата друку + 36 місяців.','No later than print date + 36 months.','Не позже даты печати + 36 месяцев.'],
['prn.bt.run','Випуск оборота B2','B2 back release','Выпуск оборота B2'],['prn.bt.runNone','— виберіть —','— choose —','— выберите —'],['prn.bt.runH','Статичний PDF оборота, з яким друкуються ці коди.','The static back PDF these codes are printed with.','Статичный PDF оборота, с которым печатаются эти коды.'],['prn.bt.runReq','Спершу випустіть оборот B2 для цієї країни (Друковані матеріали → Макети).','First release the B2 back for this country (Print materials → Layouts).','Сначала выпустите оборот B2 для этой страны (Печатные материалы → Макеты).'],
['prn.bt.keysFree','Вільні ключі · {c}','Free keys · {c}','Свободные ключи · {c}'],['prn.bt.tokFree','Токени {p} міс.','Tokens {p} mo','Токены {p} мес.'],['prn.bt.noKeys','Немає вільних ключів активації для країни {c}.','No free Activation Keys for {c}.','Нет свободных ключей активации для страны {c}.'],['prn.bt.buy','Купити ключі','Buy keys','Купить ключи'],
['prn.bt.keysShort','Вільних ключів цієї країни: {n}. Зменште кількість або докупіть ключі.','Free keys for this country: {n}. Lower the quantity or buy more keys.','Свободных ключей этой страны: {n}. Уменьшите количество или докупите ключи.'],['prn.t.bErr','Партію не створено','Batch not created','Партия не создана'],
['prn.b.log','Партію {n} створено: {q} кодів','Batch {n} created: {q} codes','Партия {n} создана: {q} кодов'],['prn.bt.nf','Партію не знайдено','Batch not found','Партия не найдена'],['prn.bt.dsub','{p} · {n} карт · {c}','{p} · {n} cards · {c}','{p} · {n} карт · {c}'],
['prn.bt.notUsed','ще не активовано','not activated yet','ещё не активировано'],['prn.bt.info','Партія','Batch','Партия'],['prn.bt.keysRes','Зарезервовано ключів','Keys reserved','Зарезервировано ключей'],['prn.bt.flow','Статус','Status','Статус'],
['prn.bt.codes','Коди','Codes','Коды'],['prn.bt.cq','Серійний номер або останні 4 знаки','Serial number or last 4 characters','Серийный номер или последние 4 знака'],['prn.bt.codesNote','Повний код є лише у файлі змінного друку; тут — останні 4 знаки.','The full code exists only in the variable-print file; here you see the last 4 characters.','Полный код есть только в файле переменной печати; здесь — последние 4 знака.'],['prn.bt.serial','Серійний №','Serial no.','Серийный №'],['prn.bt.code','Код','Code','Код'],
['prn.bst.generated','Згенеровано','Generated','Сгенерировано'],['prn.bst.exported','Файл видано друкарні','File issued to printer','Файл выдан типографии'],['prn.bst.printed','Надруковано','Printed','Напечатано'],['prn.bst.closed','Закрито','Closed','Закрыто'],
['prn.bst.generated.d','Коди створено, ключі зарезервовано.','Codes created, keys reserved.','Коды созданы, ключи зарезервированы.'],['prn.bst.exported.d','Файл serial;code;deadline видано один раз.','The serial;code;deadline file was issued once.','Файл serial;code;deadline выдан один раз.'],['prn.bst.printed.d','Тираж отримано — коди можна активувати.','The run was received — codes can be activated.','Тираж получен — коды можно активировать.'],['prn.bst.closed.d','Усі коди активовано, заблоковано або прострочено.','All codes activated, blocked or expired.','Все коды активированы, заблокированы или просрочены.'],
['prn.cst.generated','Згенеровано','Generated','Сгенерирован'],['prn.cst.exported_for_print','У друкарні','At the printer','В типографии'],['prn.cst.printed','Надруковано','Printed','Напечатан'],['prn.cst.activated','Активовано','Activated','Активирован'],['prn.cst.blocked','Заблоковано','Blocked','Заблокирован'],['prn.cst.expired','Прострочено','Expired','Просрочен'],
['prn.dl.btn','Видати файл друкарні','Issue file to printer','Выдать файл типографии'],['prn.dl.again','Повторна видача (OTA)','Re-issue (OTA)','Повторная выдача (OTA)'],['prn.dl.t','Файл змінного друку','Variable-print file','Файл переменной печати'],['prn.dl.againT','Повторна видача файлу','Re-issue the file','Повторная выдача файла'],
['prn.dl.p','Файл видається один раз і записується в журнал. Повторно — лише за рішенням OTA з причиною.','The file is issued once and logged. A re-issue needs an OTA decision with a reason.','Файл выдаётся один раз и записывается в журнал. Повторно — только по решению OTA с причиной.'],
['prn.dl.againP','Рішення OTA: файл уже видавали. Повторна видача записується в журнал із причиною.','OTA decision: the file was issued before. The re-issue is logged with the reason.','Решение OTA: файл уже выдавали. Повторная выдача записывается в журнал с причиной.'],
['prn.dl.demo','Демо: шифрування файлу й одноразове посилання / SFTP імітуються; завантажується CSV.','Demo: file encryption and the one-time link / SFTP are simulated; a CSV is downloaded.','Демо: шифрование файла и одноразовая ссылка / SFTP имитируются; загружается CSV.'],
['prn.dl.to','Кому видано','Issued to','Кому выдан'],['prn.dl.toPh','Друкарня, контакт','Printing house, contact','Типография, контакт'],['prn.dl.toH','Записується в журнал.','Recorded in the log.','Записывается в журнал.'],['prn.dl.reason','Причина повторної видачі','Reason for the re-issue','Причина повторной выдачи'],
['prn.dl.fmt','Формат: serial;code;deadline (UTF-8, роздільник «;»). Код — групи по 4.','Format: serial;code;deadline (UTF-8, “;” separator). Code in groups of 4.','Формат: serial;code;deadline (UTF-8, разделитель «;»). Код — группы по 4.'],['prn.dl.do','Завантажити файл','Download file','Скачать файл'],
['prn.dl.done','Файл партії {n} видано і записано в журнал','File of batch {n} issued and logged','Файл партии {n} выдан и записан в журнал'],['prn.dl.onlyOta','Файл уже видано. Повторна видача — лише за рішенням OTA.','The file was already issued. A re-issue is an OTA decision only.','Файл уже выдан. Повторная выдача — только по решению OTA.'],
['prn.dl.e.again','Повторна видача — лише OTA з причиною','Re-issue: OTA only, with a reason','Повторная выдача — только OTA с причиной'],['prn.dl.e.file','Не вдалося зберегти файл','Could not save the file','Не удалось сохранить файл'],
['prn.dl.log','Видачі файлу','File issues','Выдачи файла'],['prn.dl.kind','Тип','Type','Тип'],['prn.dl.none','Файл ще не видавали.','The file has not been issued yet.','Файл ещё не выдавали.'],
['prn.pr.btn','Тираж отримано','Run received','Тираж получен'],['prn.pr.t','Підтвердити отримання тиражу','Confirm the run was received','Подтвердить получение тиража'],['prn.pr.p','Партія {n}: {q} карт отримано від друкарні. Після підтвердження коди можна активувати.','Batch {n}: {q} cards received from the printer. After confirmation the codes can be activated.','Партия {n}: {q} карт получено от типографии. После подтверждения коды можно активировать.'],['prn.pr.done','Надруковано: {n} кодів можна активувати','Printed: {n} codes can now be activated','Напечатано: {n} кодов можно активировать'],
['prn.bl.title','Заблокувати карти','Block cards','Заблокировать карты'],['prn.bl.p','Втрата або крадіжка: за серійним номером, діапазоном або всю партію (кнопка в картці партії). Активовані коди не змінюються.','Loss or theft: by serial number, by range, or the whole batch (button on the batch page). Activated codes do not change.','Утеря или кража: по серийному номеру, диапазону или всю партию (кнопка в карточке партии). Активированные коды не меняются.'],
['prn.bl.mode','Як','How','Как'],['prn.bl.serial','Один серійний номер','One serial number','Один серийный номер'],['prn.bl.range','Діапазон','Range','Диапазон'],['prn.bl.from','Серійний № (від)','Serial no. (from)','Серийный № (от)'],['prn.bl.to','До (для діапазону)','To (for a range)','До (для диапазона)'],['prn.bl.toPh','1000 0000 0100','1000 0000 0100','1000 0000 0100'],
['prn.bl.reason','Причина','Reason','Причина'],['prn.bl.r.lost','Втрата','Lost','Утеря'],['prn.bl.r.stolen','Крадіжка','Stolen','Кража'],['prn.bl.r.damaged','Брак друку','Print defect','Брак печати'],['prn.bl.r.other','Інше','Other','Другое'],['prn.bl.do','Заблокувати','Block','Заблокировать'],
['prn.bl.done','Заблоковано кодів: {n}','Codes blocked: {n}','Заблокировано кодов: {n}'],['prn.bl.skipped','Пропущено {n} (вже активовані, заблоковані або прострочені).','{n} skipped (already activated, blocked or expired).','Пропущено {n} (уже активированы, заблокированы или просрочены).'],
['prn.bl.e.nf','Карт із такими номерами немає','No cards with these numbers','Карт с такими номерами нет'],['prn.bl.e.range','Перевірте номери: «до» не менше «від»','Check the numbers: “to” must not be below “from”','Проверьте номера: «до» не меньше «от»'],
['prn.bl.batch','Заблокувати партію','Block batch','Заблокировать партию'],['prn.bl.batchT','Заблокувати партію {n}','Block batch {n}','Заблокировать партию {n}'],['prn.bl.batchP','Усі неактивовані коди партії перестануть працювати, ключі активації звільняться. Скасувати не можна.','All non-activated codes of the batch stop working and their Activation Keys are freed. This cannot be undone.','Все неактивированные коды партии перестанут работать, ключи активации освободятся. Отменить нельзя.'],
['prn.bl.log','Блокування','Blocks','Блокировки'],['prn.bl.m.serial','серійний №','serial no.','серийный №'],['prn.bl.m.range','діапазон','range','диапазон'],['prn.bl.m.batch','уся партія','whole batch','вся партия'],
['prn.rd.title','Демо: активація коду після входу','Demo: code activation after sign-in','Демо: активация кода после входа'],['prn.rd.note','Імітує крок покупця на порталі (ТЗ 5.2): регістр не важливий, дефіси й пробіли ігноруються, O→0, I/L→1, контрольний символ перевіряється до запиту.','Simulates the buyer’s step in the portal (spec 5.2): case-insensitive, hyphens and spaces ignored, O→0, I/L→1, the check character is verified before the request.','Имитирует шаг покупателя на портале (ТЗ 5.2): регистр не важен, дефисы и пробелы игнорируются, O→0, I/L→1, контрольный символ проверяется до запроса.'],
['prn.rd.code','Код пакета','Package code','Код пакета'],['prn.rd.codeH','12 знаків, групи по 4.','12 characters, groups of 4.','12 знаков, группы по 4.'],['prn.rd.sim','Пристрій (SIM без тарифу)','Device (SIM without a plan)','Устройство (SIM без тарифа)'],['prn.rd.noSim','Немає активних SIM без тарифу.','No active SIMs without a plan.','Нет активных SIM без тарифа.'],['prn.rd.do','Активувати','Activate','Активировать'],
['prn.rd.ok','SIM {s}: активовано {p}','SIM {s}: {p} activated','SIM {s}: активирован {p}'],
['prn.rd.e.format','Код має 12 знаків. Перевірте, чи всі введено.','The code has 12 characters. Check you entered them all.','В коде 12 знаков. Проверьте, все ли введены.'],['prn.rd.e.check','Схоже, у коді помилка. Перевірте знаки ще раз.','The code seems to contain a typo. Check the characters again.','Похоже, в коде ошибка. Проверьте знаки ещё раз.'],
['prn.rd.e.unknown','Код не знайдено. Перевірте його або зверніться до продавця.','Code not found. Check it or contact the seller.','Код не найден. Проверьте его или обратитесь к продавцу.'],['prn.rd.e.used','Цей код уже використано.','This code has already been used.','Этот код уже использован.'],
['prn.rd.e.blocked','Цей код не діє. Зверніться до продавця.','This code is not valid. Contact the seller.','Этот код не действует. Обратитесь к продавцу.'],['prn.rd.e.expired','Строк активації цього коду минув ({d}).','The activation deadline of this code has passed ({d}).','Срок активации этого кода истёк ({d}).'],
['prn.rd.e.notprinted','Цей код ще не можна активувати. Зверніться до продавця.','This code cannot be activated yet. Contact the seller.','Этот код ещё нельзя активировать. Обратитесь к продавцу.'],['prn.rd.e.nosim','Пристрій не знайдено.','Device not found.','Устройство не найдено.'],['prn.rd.e.no_sim','Пристрій не знайдено.','Device not found.','Устройство не найдено.'],
['prn.rd.e.siminactive','Пристрій ще не в мережі.','The device is not online yet.','Устройство ещё не в сети.'],['prn.rd.e.simhas','На пристрої вже є тариф.','The device already has a plan.','На устройстве уже есть тариф.'],['prn.rd.e.plan','Цей пакет не підходить для цього пристрою.','This package does not fit this device.','Этот пакет не подходит для этого устройства.'],
['prn.rd.e.country','Код виданий для іншої країни.','The code was issued for another country.','Код выдан для другой страны.'],['prn.rd.e.no_key','Зараз активувати не вдалося. Спробуйте пізніше або зверніться до продавця.','Activation is not possible right now. Try later or contact the seller.','Сейчас активировать не удалось. Попробуйте позже или обратитесь к продавцу.'],
['prn.rd.e.no_token','Зараз активувати не вдалося. Спробуйте пізніше або зверніться до продавця.','Activation is not possible right now. Try later or contact the seller.','Сейчас активировать не удалось. Попробуйте позже или обратитесь к продавцу.'],['prn.rd.e.no_code','Код не знайдено.','Code not found.','Код не найден.'],
['prn.lb.title','Етикетки відвантаження','Shipment labels','Этикетки отгрузки'],['prn.lb.sub','A1 — етикетка пачки, A2 — етикетка короба. A4, офісний принтер, ч/б.','A1 — pack label, A2 — carton label. A4, office printer, b/w.','A1 — этикетка пачки, A2 — этикетка короба. A4, офисный принтер, ч/б.'],
['prn.lb.pick','Виберіть відвантаження','Pick a shipment','Выберите отгрузку'],['prn.lb.none','Відвантажень ще немає','No shipments yet','Отгрузок ещё нет'],['prn.lb.nf','Відвантаження не знайдено','Shipment not found','Отгрузка не найдена'],['prn.lb.dsub','{pf} · {n} SIM · {c}','{pf} · {n} SIMs · {c}','{pf} · {n} SIM · {c}'],
['prn.lb.a1','A1 · пачки ({n})','A1 · packs ({n})','A1 · пачки ({n})'],['prn.lb.a2','A2 · короби ({n})','A2 · cartons ({n})','A2 · коробы ({n})'],['prn.lb.pack','SIM у пачці','SIMs per pack','SIM в пачке'],['prn.lb.print','Друк ({n} арк.)','Print ({n} sheets)','Печать ({n} л.)'],['prn.lb.ship','До відвантаження','To the shipment','К отгрузке'],
['prn.lb.more','І ще {n} аркушів — усі підуть у друк.','And {n} more sheets — all are printed.','И ещё {n} листов — все уйдут в печать.'],['prn.lb.btn','Друк етикеток','Print labels','Печать этикеток'],
['prn.lb.note','Країна походження й номер пломби в записі відвантаження ще не зберігаються — на етикетці лишаються поля для заповнення. QR на A2 веде на список ICCID у кабінеті (лише після входу).','Country of origin and seal number are not stored on the shipment record yet — the label keeps fill-in fields. The QR on A2 leads to the ICCID list in the console (login required).','Страна происхождения и номер пломбы в записи отгрузки пока не хранятся — на этикетке остаются поля для заполнения. QR на A2 ведёт на список ICCID в кабинете (только после входа).'],
['prn.lb.draft','Бренд-профіль ще не затверджено — етикетки з поточною чернеткою.','The brand profile is not approved yet — labels use the current draft.','Бренд-профиль ещё не утверждён — этикетки с текущим черновиком.'],
['prn.all','Усі','All','Все']];
const o={uk:{},en:{},ru:{}};R.forEach(([k,uk,en,ru])=>{o.uk[k]=uk;o.en[k]=en;o.ru[k]=ru;});I18N.add(o);})();
