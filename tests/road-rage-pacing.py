"""Compare identical replay seconds 1–9, excluding both title and loading."""
from browser_support import Browser,ROOT
import json,hashlib
probe='''(()=>{const raf=requestAnimationFrame;window.pacing={rows:[],last:0,done:false};window.requestAnimationFrame=function(f){return raf.call(window,function(t){if(f.name!=='frame')return f(t);const start=performance.now();try{return f(t);}finally{const g=globalThis.RADE?.game,p=pacing,s=g?.session;if(g?.demo&&g.ready&&!g.transition&&s&&document.getElementById('attract-label').textContent.startsWith('Tir et conduite')){if(s.time>=1&&s.time<=9){p.rows.push([s.time,p.last?start-p.last:0,performance.now()-start]);p.last=start;}if(s.time>9)p.done=true;}}});};})();'''
results=[]
def stats(values):
 values=sorted(values);return dict(n=len(values),p50=values[len(values)//2],p95=values[int(len(values)*.95)],max=max(values))
for label,file in [('before',ROOT/'work/road-rage-before.html'),('after',ROOT/'dist/index.html')]:
 with Browser() as b:
  b.cmd('Emulation.setDeviceMetricsOverride',{'width':1710,'height':1000,'deviceScaleFactor':2,'mobile':False})
  b.cmd('Page.addScriptToEvaluateOnNewDocument',{'source':probe})
  b.cmd('Page.navigate',{'url':file.as_uri()+'?renderer=webgl2'});b.cmd('Page.bringToFront');b.wait('globalThis.pacing?.done',90)
  result=b.ev('({rows:pacing.rows,metrics:RADE.game.metrics(),errors:RADE.game.errors})')
  assert len(result['rows'])>150 and not result['errors'],result
  result.update(label=label,sha256=hashlib.sha256(file.read_bytes()).hexdigest(),callback=stats([r[1] for r in result['rows'][1:]]),cpu=stats([r[2] for r in result['rows']]))
  results.append(result);print(json.dumps({k:result[k] for k in ['label','callback','cpu']}),flush=True)
keys=['msaa','shadows','reflections','renderScale','width','height','staticTotal']
assert all(results[0]['metrics']['renderer'][k]==results[1]['metrics']['renderer'][k] for k in keys)
assert all(r['metrics']['pedestrians']==480 and r['metrics']['traffic']==15 for r in results)
report={'pass':True,'protocol':'Fresh Chrome profiles, forced WebGL2, same recorded inputs at simulation seconds 1–9, 480 NPCs and 15 traffic agents, 1710x1000 DPR2, unchanged quality. Callback/CPU timings, not physical display or native Safari. Single pair cannot establish a small regression or improvement.','runs':results}
(ROOT/'docs/road-rage-pacing.json').write_text(json.dumps(report,indent=2)+'\n')
