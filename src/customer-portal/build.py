import json,glob,os
p=os.path.dirname(os.path.abspath(__file__))+'/'
T={}
for f in sorted(glob.glob(p+'i18n_base/*.json'))+sorted(glob.glob(p+'i18n/*.json')):
    l=os.path.basename(f)[:-5]
    if l in T: continue
    try: T[l]=json.load(open(f))
    except Exception as e: print('skip',l,e); continue
uk=T['uk']
for l,d in T.items():
    for k,v in uk.items():
        if k not in d: d[k]=T['en'].get(k,v)
    d['brand']='ARVELO'
src=open(p+'app_src.js').read().replace('const T=__T__;','const T='+json.dumps(T,ensure_ascii=False,separators=(',',':'))+';')
open(p+'app_built.js','w').write(src)
c=open(p+'index.html').read();i=c.index('<script>\n')+len('<script>\n');j=c.rindex('</script>')
open(p+'index.html','w').write(c[:i]+src+c[j:])
print('langs',len(T),sorted(T),'size',len(src))
