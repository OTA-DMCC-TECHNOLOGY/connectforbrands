"""Build both apps and write the GitHub Pages files:
   partner/index.html  - partner console (src/partner-console)
   portal/index.html   - customer portal demo (src/customer-portal)
Run: python3 tools/publish.py"""
import os,subprocess,sys
R=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def wrap(body,lang):
    body=body.replace('<meta charset="utf-8">\n','',1)
    return ('<!doctype html>\n<html lang="%s">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
            '<meta name="robots" content="noindex">\n</head>\n<body style="margin:0">\n%s\n</body>\n</html>\n')%(lang,body)
import shutil
def valid_langs(d):
    """Language files without real errors (missing keys are fine: they fall back to English)."""
    src_i18n=os.path.join(d,'i18n');ok=[]
    if not os.path.isdir(src_i18n): return ok
    for f in sorted(os.listdir(src_i18n)):
        if not f.endswith('.json'):continue
        r=subprocess.run(['node',os.path.join(d,'tools','i18n_check.js'),'check',f[:-5]],capture_output=True,text=True,cwd=d)
        bad=[l for l in r.stdout.splitlines() if l.strip().startswith('✗') and 'missing:' not in l]
        if bad: print('skipped',f,'(',len(bad),'errors, e.g.',bad[0].strip()[:80],')');continue
        import re;m=re.search(r'keys=(\d+)/(\d+)',r.stdout)
        if m and int(m.group(1))<0.75*int(m.group(2)): print('skipped',f,'(only',m.group(1)+'/'+m.group(2),'keys translated)');continue
        ok.append(f[:-5])
    return ok
for app,out,lang in (('partner-console','partner','uk'),('customer-portal','portal','uk')):
    d=os.path.join(R,'src',app)
    ok=valid_langs(d) if app=='partner-console' else []
    env=dict(os.environ,CFB_I18N_LANGS=' '.join(ok)) if app=='partner-console' else None
    subprocess.run([sys.executable,os.path.join(d,'build.py')],check=True,cwd=d,env=env)
    os.makedirs(os.path.join(R,out),exist_ok=True)
    open(os.path.join(R,out,'index.html'),'w').write(wrap(open(os.path.join(d,'index.html')).read(),lang))
    print('wrote',out+'/index.html')
    src_i18n=os.path.join(d,'i18n')
    if app=='partner-console' and os.path.isdir(src_i18n):
        dst=os.path.join(R,out,'i18n');shutil.rmtree(dst,ignore_errors=True);os.makedirs(dst)
        for l in ok: shutil.copy(os.path.join(src_i18n,l+'.json'),dst)
        print('copied',len(ok),'language files to',out+'/i18n/:',' '.join(ok))
