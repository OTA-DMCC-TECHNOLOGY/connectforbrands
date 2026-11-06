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
for app,out,lang in (('partner-console','partner','uk'),('customer-portal','portal','uk')):
    d=os.path.join(R,'src',app);subprocess.run([sys.executable,os.path.join(d,'build.py')],check=True,cwd=d)
    os.makedirs(os.path.join(R,out),exist_ok=True)
    open(os.path.join(R,out,'index.html'),'w').write(wrap(open(os.path.join(d,'index.html')).read(),lang))
    print('wrote',out+'/index.html')
