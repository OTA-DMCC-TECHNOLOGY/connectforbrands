import glob,os,sys
R=os.path.dirname(os.path.abspath(__file__))
css=''.join(open(f).read() for f in sorted(glob.glob(R+'/src/*.css'))+sorted(glob.glob(R+'/src/modules/*.css')))
js_files=[R+'/src/01_core.js',R+'/src/02_shared.js']+sorted(glob.glob(R+'/src/modules/*.js'))+[R+'/src/99_boot.js']
js=''.join('\n/* ---- '+os.path.basename(f)+' ---- */\n'+open(f).read() for f in js_files)
html=f'''<meta charset="utf-8">
<title>CONNECT FOR BRANDS</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap">
<style>
{css}</style>
<div id="app"></div>
<div id="overlay"></div>
<div id="toasts" class="toasts" aria-live="polite"></div>
<script>
(function(){{
{js}
}})();
</script>
'''
open(R+'/index.html','w').write(html)
open(R+'/bundle.js','w').write('(function(){'+js+'})();')
print('ok',len(html),[os.path.basename(f) for f in js_files])
