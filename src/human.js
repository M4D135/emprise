/* Anatomical mesh from MakeHuman CC0, with shared smooth normals for crowd and FPS actors. */
(function(R){'use strict';const d=R.humanData;if(!d)return;
 const decode=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0)),v=new Int16Array(decode(d.vertices).buffer),ix=new Uint16Array(decode(d.indices).buffer),positions=[],normals=[];
 for(let i=0;i<d.count;i++){positions.push([...v.slice(i*6,i*6+3)].map(n=>n/10000));normals.push([...v.slice(i*6+3,i*6+6)].map(n=>n/32767));}
 const head={positions,normals,indices:[...ix],eyes:d.eyes},hair={positions:positions.map(p=>[p[0]*1.025,1.68+(p[1]-1.68)*1.025,p[2]*1.025]),normals,indices:[]};
 for(let i=0;i<ix.length;i+=3){const ids=[ix[i],ix[i+1],ix[i+2]],p=ids.map(j=>positions[j]),y=p.reduce((s,p)=>s+p[1]/3,0),z=p.reduce((s,p)=>s+p[2]/3,0);if(y>1.752||y>1.65&&z<-.065)hair.indices.push(...ids);}
 function register(data,name){const triangles=[];for(let i=0;i<data.indices.length;i+=3){const ids=[data.indices[i],data.indices[i+2],data.indices[i+1]],point=j=>[data.positions[j][0],data.positions[j][1],-data.positions[j][2]],normal=j=>[data.normals[j][0],data.normals[j][1],-data.normals[j][2]];triangles.push([...ids.map(point),...ids.map(normal)]);}const n=BITUME.carene.normaliser(triangles);FRender.forme(name,n.triangles);return {shape:name,p:n.centre,s:n.taille};}
 const bd=R.bodyData,body={positions:[],normals:[],bones:[],materials:[],indices:[]},parts=[];
 if(bd){const raw=decode(bd.vertices),words=new Int16Array(raw.buffer);body.indices=[...new Uint16Array(decode(bd.indices).buffer)];
  for(let i=0;i<bd.count;i++){body.positions.push([...words.slice(i*8,i*8+3)].map(v=>v/10000));body.normals.push([...words.slice(i*8+3,i*8+6)].map(v=>v/32767));body.bones.push([raw[i*16+12],raw[i*16+13],raw[i*16+14]/255]);body.materials.push(raw[i*16+15]);}
  const groups=new Map();for(let i=0;i<body.indices.length;i+=3){const ids=body.indices.slice(i,i+3),vote=new Map(),mat=new Map();for(const j of ids){const [a,b,w]=body.bones[j];vote.set(a,(vote.get(a)||0)+1-w);vote.set(b,(vote.get(b)||0)+w);mat.set(body.materials[j],(mat.get(body.materials[j])||0)+1);}const code=[...vote].sort((a,b)=>b[1]-a[1])[0][0],material=[...mat].sort((a,b)=>b[1]-a[1])[0][0],key=code+','+material;if(!groups.has(key))groups.set(key,{code,material,indices:[]});groups.get(key).indices.push(...ids);}
  for(const [key,part] of groups)parts.push({...register({...body,indices:part.indices},'rade-body-'+key),code:part.code,material:part.material});
 }
 const scarf={positions:[],normals:[],indices:[]},steps=24,rings=16;
 for(let j=0;j<=rings;j++)for(let i=0;i<=steps;i++){const v=j*Math.PI/rings,u=i*Math.PI*2/steps,n=[Math.sin(v)*Math.cos(u),Math.cos(v),Math.sin(v)*Math.sin(u)];scarf.positions.push([n[0]*.119,1.676+n[1]*.179,-.015+n[2]*.137]);scarf.normals.push(n);}
 for(let j=0;j<rings;j++)for(let i=0;i<steps;i++){const a=j*(steps+1)+i,b=a+steps+1,ids=[a,b+1,b,a,a+1,b+1];const center=[0,0,0];for(const k of [a,b,b+1,a+1])for(let axis=0;axis<3;axis++)center[axis]+=scarf.positions[k][axis]/4;if(center[2]>.035&&center[1]<1.78&&center[1]>1.54)continue;scarf.indices.push(...ids);}
 const skinPalette=[[.28,.17,.12],[.37,.23,.16],[.45,.29,.20],[.51,.34,.23],[.60,.41,.29],[.66,.46,.32],[.79,.60,.46],[.87,.70,.57]];
 const hash=n=>{n=(n^(n>>>16))>>>0;n=Math.imul(n,0x7feb352d)>>>0;n=(n^(n>>>15))>>>0;n=Math.imul(n,0x846ca68b)>>>0;return (n^(n>>>16))>>>0;};
 function appearance(id){const seed=id>=10000&&id<12000?id-10000:id,type=seed%10,h=hash(seed);return {skin:skinPalette[(h>>>8)&7],type,feminine:[2,5,7,9].includes(type),veil:[5,7].includes(type),streetwear:[0,3,8].includes(type)};}
 R.human={body,parts,head,hair,scarf,appearance,skinPalette,scarfShape:register(scarf,'rade-human-scarf'),headShape:register(head,'rade-human-head'),hairShape:register(hair,'rade-human-hair')};
})(globalThis.RADE);
