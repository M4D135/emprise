/* Original procedural anatomy and clothing, shared by crowd and FPS actors. */
(function(R){'use strict';const d=R.humanData;if(!d)return;
 const positions=d.positions,normals=d.normals,ix=d.indices;
 const head={positions,normals,indices:[...ix],eyes:d.eyes},hair={positions:positions.map(p=>[p[0]*1.025,1.68+(p[1]-1.68)*1.025,p[2]*1.025]),normals,indices:[]};
 for(let i=0;i<ix.length;i+=3){const ids=[ix[i],ix[i+1],ix[i+2]],p=ids.map(j=>positions[j]),y=p.reduce((s,p)=>s+p[1]/3,0),z=p.reduce((s,p)=>s+p[2]/3,0);if(y>1.752||y>1.65&&z<-.065)hair.indices.push(...ids);}
 function register(data,name){const triangles=[];for(let i=0;i<data.indices.length;i+=3){const ids=[data.indices[i],data.indices[i+2],data.indices[i+1]],point=j=>[data.positions[j][0],data.positions[j][1],-data.positions[j][2]],normal=j=>[data.normals[j][0],data.normals[j][1],-data.normals[j][2]];triangles.push([...ids.map(point),...ids.map(normal)]);}const n=BITUME.carene.normaliser(triangles);FRender.forme(name,n.triangles);return {shape:name,p:n.centre,s:n.taille};}
 const bd=R.bodyData,body={positions:[],normals:[],bones:[],materials:[],indices:[]},parts=[];
 if(bd){body.positions=bd.positions;body.normals=bd.normals;body.bones=bd.bones;body.materials=bd.materials;body.indices=bd.indices;
  const groups=new Map();for(let i=0;i<body.indices.length;i+=3){const ids=body.indices.slice(i,i+3),vote=new Map(),mat=new Map();for(const j of ids){const [a,b,w]=body.bones[j];vote.set(a,(vote.get(a)||0)+1-w);vote.set(b,(vote.get(b)||0)+w);mat.set(body.materials[j],(mat.get(body.materials[j])||0)+1);}const code=[...vote].sort((a,b)=>b[1]-a[1])[0][0],material=[...mat].sort((a,b)=>b[1]-a[1])[0][0],key=code+','+material;if(!groups.has(key))groups.set(key,{code,material,indices:[]});groups.get(key).indices.push(...ids);}
  for(const [key,part] of groups)parts.push({...register({...body,indices:part.indices},'rade-body-'+key),code:part.code,material:part.material});
 }
 // Reusable nearby actor slots: deform shared vertices with both joint weights.
 // GPU crowd keeps its own continuous skinning. Only visible, nearby CPU actors upload poses.
 const groupsByMaterial=new Map();for(let i=0;i<body.indices.length;i+=3){const ids=body.indices.slice(i,i+3),mat=body.materials[ids[0]];if(!groupsByMaterial.has(mat))groupsByMaterial.set(mat,[]);groupsByMaterial.get(mat).push(ids[0],ids[2],ids[1]);}
 const slots=[];let renderer=null,used=0;
 for(let slot=0;slot<6;slot++){const list=[];for(const [material,ids] of groupsByMaterial){const name='rade-skinned-'+slot+'-'+material,triangles=[];for(let j=0;j<ids.length;j+=3){const ii=ids.slice(j,j+3);triangles.push([...ii.map(i=>[body.positions[i][0],body.positions[i][1]/2-.5,-body.positions[i][2]]),...ii.map(i=>[body.normals[i][0],body.normals[i][1]*2,-body.normals[i][2]])]);}FRender.forme(name,triangles);list.push({shape:name,p:[0,1,0],s:[1,2,1],material,ids,values:new Float32Array(ids.length*6)});}slots.push({list,key:null});}
 const posed=new Float32Array(body.positions.length*6);
 // Same relaxed fit for CPU actors and GPU crowd; no pinched female waist.
 function fit(position,normal,feminine=false){const p=position.slice(),n=normal.slice(),raw=(p[1]-1.20)/.24,t=Math.max(0,Math.min(1,raw)),scale=feminine?1-.025*t*t*(3-2*t):1,derivative=feminine&&raw>0&&raw<1?-.025*6*t*(1-t)/.24:0;p[0]*=scale;n[1]-=position[0]*derivative*n[0]/scale;n[0]/=scale;const len=Math.hypot(...n)||1;return {p,n:n.map(v=>v/len)};}
 // Clothing is static. Compute both fits once, outside the per-frame skinning loop.
 const fittedBodies=[false,true].map(feminine=>{const positions=[],normals=[];for(let i=0;i<body.positions.length;i++){const fitted=fit(body.positions[i],body.normals[i],feminine);positions.push(fitted.p);normals.push(fitted.n);}return {positions,normals};});
 function poseBody({phase=0,walk=0,seated=false,aim=false,feminine=false}){
  const fitted=fittedBodies[feminine?1:0],hl=seated?1.65:Math.sin(phase)*.30*walk,hr=seated?1.65:-Math.sin(phase)*.30*walk,matrices=new Map();
  function matrix(code){if(matrices.has(code))return matrices.get(code);const side=[3,19,5,17].includes(code)?1:-1,leg=[4,5,16,17].includes(code),arm=[2,3,18,19].includes(code),hip=side<0?hl:hr,a=leg?hip:arm?seated?.82:aim?1.20:-hip*.7:0,secondary=leg&&code>=16?seated?-1.65:-Math.max(0,hip)*1.25:arm&&code>=18?seated?.4:aim?.35:.1:0,pivot=leg?[side*.105,.97,0]:[side*.235,1.43,0],joint=leg?[side*.105,.52,0]:[side*.255,1.19,0];
   const cy=Math.cos(secondary),sy=Math.sin(secondary),ca=Math.cos(a),sa=Math.sin(a),ty=joint[1]*(1-cy)+joint[2]*sy,tz=joint[2]*(1-cy)-joint[1]*sy,translation=[ca*ty-sa*tz+pivot[1]*(1-ca)+pivot[2]*sa,sa*ty+ca*tz+pivot[2]*(1-ca)-pivot[1]*sa],m=[Math.cos(a+secondary),Math.sin(a+secondary),...translation];matrices.set(code,m);return m;}
  for(let i=0;i<body.positions.length;i++){const p=fitted.positions[i],n=fitted.normals[i],[a,b,w]=body.bones[i],ma=matrix(a),mb=matrix(b),c=ma[0]*(1-w)+mb[0]*w,ss=ma[1]*(1-w)+mb[1]*w,ty=ma[2]*(1-w)+mb[2]*w,tz=ma[3]*(1-w)+mb[3]*w;let nx=n[0],ny=(c*n[1]-ss*n[2])*2,nz=-(ss*n[1]+c*n[2]),l=Math.hypot(nx,ny,nz)||1;const at=i*6;posed[at]=p[0];posed[at+1]=(c*p[1]-ss*p[2]+ty)/2-.5;posed[at+2]=-(ss*p[1]+c*p[2]+tz);posed[at+3]=nx/l;posed[at+4]=ny/l;posed[at+5]=nz/l;}
  return posed;
 }
 function skin(pose){if(!renderer?.updateShape||used>=slots.length)return null;const slot=slots[used++],key=[pose.walk?pose.phase:0,pose.walk,pose.seated,pose.aim,pose.feminine].join(',');if(slot.key!==key){poseBody(pose);for(const part of slot.list){let at=0;for(const i of part.ids){for(let k=0;k<6;k++)part.values[at++]=posed[i*6+k];}renderer.updateShape(part.shape,part.values);}slot.key=key;}return slot.list;}
 function beginFrame(r){renderer=r;used=0;}
 const scarf={positions:[],normals:[],indices:[]},steps=32,rings=20;
 for(let j=0;j<=rings;j++)for(let i=0;i<=steps;i++){const v=j*Math.PI/rings,u=i*Math.PI*2/steps,n=[Math.sin(v)*Math.cos(u),Math.cos(v),Math.sin(v)*Math.sin(u)],r=[.135,.195,.155],nn=n.map((v,k)=>v/r[k]),len=Math.hypot(...nn)||1;scarf.positions.push([n[0]*r[0],1.68+n[1]*r[1],-.018+n[2]*r[2]]);scarf.normals.push(nn.map(v=>v/len));}
 for(let j=0;j<rings;j++)for(let i=0;i<steps;i++){const a=j*(steps+1)+i,b=a+steps+1,center=[0,0,0];for(const k of [a,b,b+1,a+1])for(let axis=0;axis<3;axis++)center[axis]+=scarf.positions[k][axis]/4;if(center[2]>.075&&center[1]<1.755&&center[1]>1.565)continue;scarf.indices.push(a,b+1,b,a,a+1,b+1);}
 const scarfDrape={positions:[],normals:[],indices:[]},drapeRings=[[1.395,.245,.153],[1.435,.22,.146],[1.48,.18,.128],[1.53,.14,.112],[1.585,.112,.096]];
 for(let j=0;j<drapeRings.length;j++)for(let i=0;i<=steps;i++){const [y,rx,rz]=drapeRings[j],angle=i*Math.PI*2/steps,co=Math.cos(angle),si=Math.sin(angle),a=drapeRings[Math.max(0,j-1)],b=drapeRings[Math.min(drapeRings.length-1,j+1)],dy=b[0]-a[0]||1,n=[co,-((b[1]-a[1])*co*co+(b[2]-a[2])*si*si)/dy,si],len=Math.hypot(...n);scarfDrape.positions.push([rx*co,y-.006*Math.sin(angle*3),-.012+rz*si]);scarfDrape.normals.push(n.map(v=>v/len));}
 for(let j=0;j<drapeRings.length-1;j++)for(let i=0;i<steps;i++){const a=j*(steps+1)+i,b=a+steps+1;scarfDrape.indices.push(a,b,a+1,a+1,b,b+1);}
 const skinPalette=[[.28,.17,.12],[.37,.23,.16],[.45,.29,.20],[.51,.34,.23],[.60,.41,.29],[.66,.46,.32],[.79,.60,.46],[.87,.70,.57]];
 const hash=n=>{n=(n^(n>>>16))>>>0;n=Math.imul(n,0x7feb352d)>>>0;n=(n^(n>>>15))>>>0;n=Math.imul(n,0x846ca68b)>>>0;return (n^(n>>>16))>>>0;};
 function appearance(id){const seed=id>=10000&&id<12000?id-10000:id,type=seed%10,h=hash(seed);return {skin:skinPalette[(h>>>8)&7],type,feminine:[2,5,7,9].includes(type),veil:[5,7].includes(type),scarfColor:((h>>>12)&1)?[.30,.14,.12]:[.09,.12,.17],streetwear:[0,3,8].includes(type)};}
 R.human={provenance:R.proceduralHuman.provenance,fit,skin,beginFrame,poseBody,body,parts,head,hair,scarf,scarfDrape,appearance,skinPalette,scarfShape:register(scarf,'rade-human-scarf'),scarfDrapeShape:register(scarfDrape,'rade-human-scarf-drape'),headShape:register(head,'rade-human-head'),hairShape:register(hair,'rade-human-hair')};
})(globalThis.RADE);
