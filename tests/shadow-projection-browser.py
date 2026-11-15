#!/usr/bin/env python3
"""Compare real native solar projection at the reported spawn angle.

Fixed-view center-only cases isolate shadow-map movement from camera parallax.
Camera-moving cases are visual records, not temporal-instability assertions.
All pixels come from real canvas captures, without altering shaders or depth.
"""
import json,argparse
from pathlib import Path
from browser_support import Browser, ROOT
import struct,zlib
def readpng(path):
 data=path.read_bytes();at=8;compressed=bytearray()
 while at<len(data):
  n=struct.unpack('>I',data[at:at+4])[0];tag=data[at+4:at+8];body=data[at+8:at+8+n];at+=12+n
  if tag==b'IHDR':w,h,depth,kind,_,_,interlace=struct.unpack('>IIBBBBB',body);assert depth==8 and kind in (2,6) and interlace==0
  if tag==b'IDAT':compressed.extend(body)
 stride=w*(4 if kind==6 else 3);bpp=4 if kind==6 else 3;raw=zlib.decompress(compressed);out=bytearray();previous=bytearray(stride)
 for y in range(h):
  f=raw[y*(stride+1)];row=bytearray(raw[y*(stride+1)+1:(y+1)*(stride+1)])
  for i in range(stride):
   a=row[i-bpp] if i>=bpp else 0;b=previous[i];c=previous[i-bpp] if i>=bpp else 0
   if f==1:v=a
   elif f==2:v=b
   elif f==3:v=(a+b)//2
   elif f==4:
    p=a+b-c;aa=abs(p-a);bb=abs(p-b);cc=abs(p-c);v=a if aa<=bb and aa<=cc else b if bb<=cc else c
   else:v=0
   row[i]=(row[i]+v)&255
  out.extend(row);previous=row
 return w,h,bpp,out
p=argparse.ArgumentParser();p.add_argument('--html',type=Path,default=ROOT/'dist/index.html');p.add_argument('--label',choices=['before','after'],default='after');a=p.parse_args();rows=[]
with Browser() as b:
 b.cmd('Page.navigate',{'url':a.html.resolve().as_uri()+'?test=1&renderer=webgpu'});b.wait('globalThis.RADE?.game?.drawCount>2',90);b.ev('RADE.game.testing=true;true');b.ev((ROOT/'tests/render-benchmark-scenes.js').read_text());b.ev('prepareRenderBenchmark("port-day")')
 b.ev('''globalThis.baseYaw=122*Math.PI/180;globalThis.sunCentre=yaw=>[74.5+Math.sin(yaw)*25,.08,130-Math.cos(yaw)*25];globalThis.shadowCam={pos:[74.5,1.7,130],yaw:baseYaw,pitch:.04,fov:74,near:.15,overlayNear:.035,far:26000,allStatic:true,chunked:true,sun:{center:sunCentre(baseYaw),extent:110,depth:150}};RADE.game.camera=shadowCam;globalThis.lastSunMatrix=[];const q=RADE.game.renderer.gpu.device.queue,write=q.writeBuffer.bind(q);q.writeBuffer=function(buffer,offset,data,...args){if(buffer.label==='depth:sun'){const values=data instanceof ArrayBuffer?new Float32Array(data):new Float32Array(data.buffer,data.byteOffset,data.byteLength/4);lastSunMatrix=Array.from(values.slice(0,16));}return write(buffer,offset,data,...args);};true''')
 cases=[('on',0,0,True,False),('off',0,0,False,False),('centre-003',.003,0,True,False),('centre-025',.25,0,True,False),('centre-turn-tiny',0,.0001,True,False),('centre-turn',0,.2,True,False),('camera-003',.003,0,True,True),('camera-025',.25,0,True,True),('camera-turn',0,.2,True,True)]
 for name,shift,turn,on,move in cases:
  b.ev('''(()=>{shadowCam.pos=[74.5+%s,1.7,130];shadowCam.yaw=baseYaw+%s;shadowCam.sun.center=sunCentre(baseYaw+%s);shadowCam.sun.center[0]+=%s;RADE.game.graphics.shadows=%s;})()'''%(shift if move else 0,turn if move else 0,turn,shift,json.dumps(on)))
  b.ev('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');b.capture('shadow-projection-'+a.label+'-'+name+'.png');r=b.ev('({matrix:lastSunMatrix,stats:{...RADE.game.renderer.stats},cam:shadowCam,backend:RADE.game.renderer.stats.backend,errors:RADE.game.errors})');r['case']=name;rows.append(r)
 w,h,bpp,base=readpng(ROOT/'docs'/('shadow-projection-'+a.label+'-on.png'))
 for row in rows:
  ww,hh,step,im=readpng(ROOT/'docs'/('shadow-projection-'+a.label+'-'+row['case']+'.png'));assert (w,h,bpp)==(ww,hh,step);total=0;maximum=0;count=0;pixels=w*min(h,850)
  for k in range(0,pixels*bpp,bpp):
   differences=[abs(base[k+i]-im[k+i]) for i in range(3)];m=max(differences);total+=sum(differences);maximum=max(maximum,m);count+=m>2
  row['differenceVsFixedView']={'absoluteMean':total/(pixels*3),'maxChannel':maximum,'pixelsAbove2':count}
 (ROOT/'docs'/('shadow-projection-'+a.label+'.json')).write_text(json.dumps(rows,indent=2)+'\n');print(json.dumps([{'case':r['case'],'diff':r['differenceVsFixedView'],'matrix':r['matrix']} for r in rows]),flush=True)
