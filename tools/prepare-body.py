#!/usr/bin/env python3
"""Rebuild the clothed CC0 body and two-joint skinning weights from vendored sources."""
from pathlib import Path
import json,math,base64,struct
root=Path(__file__).resolve().parents[1];v=[];faces=[];group=''
for line in (root/'assets/human/base.obj').read_text().splitlines():
 a=line.split()
 if not a:continue
 if a[0]=='v':v.append(list(map(float,a[1:4])))
 elif a[0]=='g':group=a[1]
 elif a[0]=='f' and group=='body':faces.append([int(x.split('/')[0])-1 for x in a[1:]])
skel=json.loads((root/'assets/human/default.mhskel').read_text());weights=json.loads((root/'assets/human/default_weights.mhw').read_text())['weights']
conv=lambda p:[p[0]*.108,p[1]*.108+.89816,p[2]*.108-.055]
sub=lambda a,b:[a[k]-b[k] for k in range(3)]
add=lambda a,b:[a[k]+b[k] for k in range(3)]
mul=lambda a,s:[x*s for x in a]
dot=lambda a,b:sum(x*y for x,y in zip(a,b))
cross=lambda a,b:[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
unit=lambda a:mul(a,1/(math.hypot(*a) or 1))
def joint(bone,end):
 ids=skel['joints'][skel['bones'][bone][end]]
 return conv([sum(v[i][k] for i in ids)/len(ids) for k in range(3)])
def transform(a,b,ta,tb):
 u,w=unit(sub(b,a)),unit(sub(tb,ta));axis=cross(u,w);c=dot(u,w);scale=math.hypot(*sub(tb,ta))/math.hypot(*sub(b,a))
 def apply(p):
  q=mul(sub(p,a),scale);rot=add(add(q,cross(axis,q)),mul(cross(axis,cross(axis,q)),1/(1+c)))
  return add(ta,rot)
 return apply
trans={0:lambda p:p,1:lambda p:p};bones={}
for suffix,sign,arm,fore,thigh,shin in [('L',1,3,19,5,17),('R',-1,2,18,4,16)]:
 trans[arm]=transform(joint('upperarm01.'+suffix,'head'),joint('upperarm02.'+suffix,'tail'),[sign*.235,1.43,0],[sign*.255,1.19,0])
 trans[fore]=transform(joint('lowerarm01.'+suffix,'head'),joint('lowerarm02.'+suffix,'tail'),[sign*.255,1.19,0],[sign*.26,.95,.015])
 trans[thigh]=transform(joint('upperleg01.'+suffix,'head'),joint('upperleg02.'+suffix,'tail'),[sign*.105,.97,0],[sign*.105,.52,0])
 trans[shin]=transform(joint('lowerleg01.'+suffix,'head'),joint('lowerleg02.'+suffix,'tail'),[sign*.105,.52,0],[sign*.105,.10,0])
 for name in weights:
  if not name.endswith('.'+suffix):continue
  if name.startswith('upperarm'):bones[name]=arm
  elif name.startswith(('lowerarm','wrist','finger','metacarpal')):bones[name]=fore
  elif name.startswith('upperleg'):bones[name]=thigh
  elif name.startswith(('lowerleg','foot','toe')):bones[name]=shin
vw=[{} for _ in v];hand=[0. for _ in v]
for name,ws in weights.items():
 code=bones.get(name,1 if name in ['head','jaw'] or any(name.startswith(x) for x in ['neck','eye','oculi','oris','temporalis','levator','orbicularis','risorius','tongue']) else 0)
 for i,w in ws:
  if i>=len(v):continue
  vw[i][code]=vw[i].get(code,0)+w
  if name.startswith(('wrist','finger','metacarpal')):hand[i]+=w
ids=sorted(set(i for f in faces for i in f if max(conv(v[k])[1] for k in f)<1.53));lookup={i:j for j,i in enumerate(ids)};pos=[];skin=[];material=[]
for i in ids:
 p=conv(v[i]);ws=vw[i] or {0:1};total=sum(ws.values());q=[0,0,0]
 for code,w in ws.items():q=add(q,mul(trans.get(code,trans[0])(p),w/total))
 ordered=sorted(ws.items(),key=lambda x:-x[1]);a,wa=ordered[0];b,wb=ordered[1] if len(ordered)>1 else (a,0);skin.append([a,b,round(wb/(wa+wb)*255)])
 cloth=0 if hand[i]>.35 or p[1]>1.48 else 4 if p[1]<.17 else 2 if p[1]<1.04 else 1
 if cloth in [1,2]:
  # A fully clothed outer shell, relaxed at waist, knees and elbows.
  q[0]*=1.025;q[2]=q[2]*1.04+(1 if q[2]>=0 else -1)*.009
 pos.append(q);material.append(cloth)
tri=[]
for f in faces:
 if all(i in lookup for i in f):
  for k in range(1,len(f)-1):tri.append([lookup[f[0]],lookup[f[k]],lookup[f[k+1]]])
adj=[set() for _ in pos]
for f in tri:
 for a in f:adj[a].update(j for j in f if j!=a)
for _ in range(3):
 previous=[p[:] for p in pos]
 for i,p in enumerate(pos):
  if material[i] not in [1,2] or not adj[i]:continue
  avg=[sum(previous[j][k] for j in adj[i])/len(adj[i]) for k in range(3)];pos[i]=[p[k]*.65+avg[k]*.35 for k in range(3)]
norm=[[0,0,0] for _ in pos]
for f in tri:
 a,b,c=[pos[i] for i in f];n=cross(sub(b,a),sub(c,a))
 for i in f:norm[i]=add(norm[i],n)
norm=[unit(n) for n in norm]
# Fine folds affect silhouette as well as lighting, strongest on clothes, not on skin.
for i,p in enumerate(pos):
 if material[i] in [1,2]:
  fold=.0025*math.sin(p[1]*85+p[0]*24)*math.sin(p[2]*31+p[1]*5);pos[i]=add(p,mul(norm[i],fold))
# Clip clothing seams to planes, carrying the two joint influences across each new edge.
# This prevents the old per-vertex colour tags from producing ragged triangular hems.
def vertex(i):return {'p':pos[i],'n':norm[i],'weights':{skin[i][0]:1-skin[i][2]/255,skin[i][1]:skin[i][2]/255} if skin[i][0]!=skin[i][1] else {skin[i][0]:1}}
def interp(a,b,t):
 keys=set(a['weights'])|set(b['weights'])
 return {'p':[a['p'][k]*(1-t)+b['p'][k]*t for k in range(3)],'n':unit([a['n'][k]*(1-t)+b['n'][k]*t for k in range(3)]),'weights':{k:a['weights'].get(k,0)*(1-t)+b['weights'].get(k,0)*t for k in keys}}
def clip(poly,height,above):
 out=[]
 for a,b in zip(poly,poly[1:]+poly[:1]):
  ai=a['p'][1]>=height if above else a['p'][1]<=height;bi=b['p'][1]>=height if above else b['p'][1]<=height
  if ai:out.append(a)
  if ai!=bi:out.append(interp(a,b,(height-a['p'][1])/(b['p'][1]-a['p'][1])))
 return out
packed=[];outtri=[];unique={}
def output(poly,material):
 ids=[]
 for q in poly:
  ws=sorted(q['weights'].items(),key=lambda x:-x[1]);a,wa=ws[0];b,wb=ws[1] if len(ws)>1 else (a,0);bw=round(wb/max(.001,wa+wb)*255)
  row=(*[round(k*10000) for k in q['p']],*[round(k*32767) for k in q['n']],a,b,bw,material)
  if row not in unique:unique[row]=len(packed);packed.append(row)
  ids.append(unique[row])
 for j in range(1,len(ids)-1):outtri.append([ids[0],ids[j],ids[j+1]])
for f in tri:
 poly=[vertex(i) for i in f];fore=sum(sum(q['weights'].get(k,0) for k in [18,19]) for q in poly)/3
 if fore>.55:
  output(clip(poly,.955,False),0);output(clip(poly,.955,True),1)
 else:
  poly=clip(poly,.145,True)
  output(clip(poly,1.035,False),2);output(clip(poly,1.035,True),1)
data=b''.join(struct.pack('<hhhhhhBBBB',*row) for row in packed)
inds=struct.pack('<'+'H'*len(outtri)*3,*[i for f in outtri for i in f]);pos=[None]*len(packed);tri=outtri
payload={'count':len(pos),'vertices':base64.b64encode(data).decode(),'indices':base64.b64encode(inds).decode()}
(root/'src/body-data.js').write_text('/* MakeHuman CC0 body, clothed outer shell and converted joint weights. */\nglobalThis.RADE.bodyData='+json.dumps(payload,separators=(',',':'))+';\n');print({'vertices':len(pos),'triangles':len(tri),'materials':{m:sum(row[-1]==m for row in packed) for m in set(row[-1] for row in packed)}})
