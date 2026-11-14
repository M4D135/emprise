#!/usr/bin/env python3
"""Rebuild the CC0 head mesh from the vendored MakeHuman OBJ."""
from pathlib import Path
import math,json,base64,struct,hashlib
root=Path(__file__).resolve().parents[1];src=root/'assets/human/base.obj';v=[];faces=[];groups={};group=''
for line in src.read_text().splitlines():
 a=line.split()
 if not a:continue
 if a[0]=='v':v.append(list(map(float,a[1:4])))
 elif a[0]=='g':group=a[1]
 elif a[0]=='f':
  f=[int(i.split('/')[0])-1 for i in a[1:]]
  if group=='body' and min(v[i][1] for i in f)>5.75:faces.append(f)
  if group in ['joint-l-eye','joint-r-eye']:groups.setdefault(group,set()).update(f)
ids=sorted(set(i for f in faces for i in f));lookup={i:j for j,i in enumerate(ids)}
pos=[[v[i][0]*.108,1.49+(v[i][1]-5.48)*.108,v[i][2]*.108-.055] for i in ids]
tri=[]
for f in faces:
 for k in range(1,len(f)-1):tri.append([lookup[f[0]],lookup[f[k]],lookup[f[k+1]]])
norm=[[0,0,0] for _ in pos]
for f in tri:
 a,b,c=[pos[i] for i in f];u=[b[k]-a[k] for k in range(3)];w=[c[k]-a[k] for k in range(3)];n=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]]
 for i in f:
  for k in range(3):norm[i][k]+=n[k]
for n in norm:
 length=math.hypot(*n) or 1
 for k in range(3):n[k]/=length
# Keep source topology, quantize positions to 0.1 mm and normals to signed 16-bit.
data=bytearray()
for p,n in zip(pos,norm):data.extend(struct.pack('<hhhhhh',*[round(k*10000) for k in p],*[round(k*32767) for k in n]))
inds=struct.pack('<'+'H'*len(tri)*3,*[i for f in tri for i in f])
eyes=[[sum(v[i][k] for i in q)/len(q) for k in range(3)] for q in groups.values()]
eyes=[[p[0]*.108,1.49+(p[1]-5.48)*.108,p[2]*.108-.055] for p in eyes]
payload={'count':len(pos),'vertices':base64.b64encode(data).decode(),'indices':base64.b64encode(inds).decode(),'eyes':eyes}
(root/'src/human-data.js').write_text('/* MakeHuman CC0 anatomical head; source and conversion: assets/human, tools/prepare-head.py. */\nglobalThis.RADE.humanData='+json.dumps(payload,separators=(',',':'))+';\n')
print({'vertices':len(pos),'triangles':len(tri),'eyes':eyes,'bounds':[[min(p[k] for p in pos),max(p[k] for p in pos)] for k in range(3)]})
