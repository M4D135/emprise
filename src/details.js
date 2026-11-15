/* EMPRISE — original procedural vegetation and pedestrian-scale Marseille dressing. */
(function(R){'use strict';
const treeShapes=[],treeFootprint=[],treeLobes=[[-1.08,4.05,-.45,.75,.66,.70],[-.25,4.70,-.93,.78,.78,.68],[.87,4.12,-.79,.73,.68,.72],[1.18,4.64,.30,.66,.72,.71],[.40,5.20,.26,.77,.69,.70],[-.66,4.96,.48,.69,.66,.75],[-1.04,4.10,.94,.65,.60,.63],[.20,3.95,1.17,.72,.61,.64],[.05,4.38,.04,.72,.70,.67]];
const hash=(x,z)=>{let n=Math.imul(Math.round(x*97),374761393)^Math.imul(Math.round(z*89),668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;};
function registerTrees(){
 if(treeShapes.length)return;
 const tri=(out,a,b,c)=>{const u=b.map((v,i)=>v-a[i]),v=c.map((n,i)=>n-a[i]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...n)||1;out.push([a,b,c,...Array(3).fill(n.map(v=>v/l))]);};
 const tube=(out,a,b,r0,r1)=>{const d=b.map((v,i)=>v-a[i]),length=Math.hypot(...d),v=d.map(v=>v/length),u=Math.abs(v[1])<.95?[v[2],0,-v[0]]:[1,0,0],ul=Math.hypot(...u);for(let i=0;i<3;i++)u[i]/=ul;const w=[v[1]*u[2]-v[2]*u[1],v[2]*u[0]-v[0]*u[2],v[0]*u[1]-v[1]*u[0]],point=(p,r,j)=>p.map((n,k)=>n+r*(Math.cos(j*Math.PI/3)*u[k]+Math.sin(j*Math.PI/3)*w[k]));for(let j=0;j<6;j++){const p=point(a,r0,j),q=point(a,r0,j+1),r=point(b,r1,j),s=point(b,r1,j+1);tri(out,p,s,r);tri(out,p,q,s);tri(out,a,q,p);tri(out,b,r,s);}};
 // Keep the physical preparation independent of the renderer (headless simulation uses this path too).
 const store=(name,triangles)=>{const points=triangles.flatMap(t=>t.slice(0,3)),lo=[0,1,2].map(k=>Math.min(...points.map(p=>p[k]))),hi=[0,1,2].map(k=>Math.max(...points.map(p=>p[k]))),size=hi.map((v,k)=>Math.max(.001,v-lo[k])),center=hi.map((v,k)=>(v+lo[k])/2),normalized=triangles.map(t=>t.map((p,j)=>{const q=p.map((v,k)=>j<3?(v-center[k])/size[k]:v*size[k]);if(j<3)return q;const length=Math.hypot(...q)||1;return q.map(v=>v/length);}));if(typeof FRender!=='undefined')FRender.forme(name,normalized);const shape={shape:name,p:center,s:size,triangles:triangles.length};treeShapes.push(shape);return shape;};
 for(let variant=0;variant<1;variant++){
  const triangles=[];
  for(let k=0;k<treeLobes.length;k++){
   const [x,y,z,rx,ry,rz]=treeLobes[k],sides=8,rows=4,point=(row,i)=>{const a=i*Math.PI*2/sides,b=row*Math.PI/rows,wave=1+.13*Math.sin(i*2.7+k*1.3+variant);return [x+Math.sin(b)*Math.cos(a)*rx*wave,y+Math.cos(b)*ry*(1+.08*Math.sin(a*3+k)),z+Math.sin(b)*Math.sin(a)*rz*wave];};
   for(let j=0;j<rows;j++)for(let i=0;i<sides;i++){const a=point(j,i),b=point(j,i+1),c=point(j+1,i),d=point(j+1,i+1);if(j>0)tri(triangles,a,b,c);if(j<rows-1)tri(triangles,b,d,c);}
  }
  const seen=new Set();for(const triangle of triangles)for(let i=0;i<3;i++)for(const p of [triangle[i],triangle[i].map((v,k)=>(v+triangle[(i+1)%3][k])/2)]){const key=p[0].toFixed(5)+','+p[2].toFixed(5);if(!seen.has(key)){seen.add(key);treeFootprint.push([p[0],p[2]]);}}
  store('emprise-tree-crown-'+variant,triangles);
 }
 const branches=[],twigs=[];
 for(let k=0;k<treeLobes.length;k++){const [x,y,z]=treeLobes[k],fork=[x*.37,2.75+(k%3)*.13,z*.37];if(k%3===0)tube(branches,[0,2.20,0],fork,.115,.065);tube(branches,fork,[x,y-.20,z],.065,.021);const side=k%2?-1:1;tube(twigs,[x*.72,y-.65,z*.72],[x+side*.38,y+.20,z-side*.20],.025,.008);}
 store('emprise-tree-branches',branches.concat(twigs));
}
// Replace whole source trees before world colliders are built. No new planting coordinates are invented.
function prepareVegetation(scenery,city,bounds){
 registerTrees();if(!treeShapes.length)return {trees:0,removed:0,meshes:0,views:[]};
 const result=[],views=[];let trees=0,removed=0,meshes=0;
 const onRoad=(x,z,r)=>{if(city.surChaussee(x,z))return true;for(let i=0;i<12;i++)if(city.surChaussee(x+Math.cos(i*Math.PI/6)*r,z+Math.sin(i*Math.PI/6)*r))return true;return false;};
 for(let i=0;i<scenery.length;i++){
  const old=scenery[i],a=scenery[i+1],b=scenery[i+2];
  if(!(old.shape==='cylinder'&&old.mat===10&&a?.shape==='foliage'&&b?.shape==='foliage')){result.push(old);continue;}
  i+=2;const [x,,z]=old.p,seed=hash(x,z),yaw=seed*Math.PI*2,c=Math.cos(yaw),s=Math.sin(yaw),base=old.p[1]-old.s[1]/2,height=old.s[1]/(5.4*.72),original=a.s[0]/4.25;
  let spread=original,clear=false;
  if(!onRoad(x,z,Math.max(.72,old.s[0]/2+.35)))for(let shrink=0;shrink<4;shrink++){
   spread=original*(1-shrink*.10);clear=treeLobes.every(([u,,v,rx,,rz])=>!onRoad(x+(u*c-v*s)*spread,z+(u*s+v*c)*spread,Math.max(rx,rz)*spread*1.16))&&treeFootprint.every(([u,v])=>!city.surChaussee(x+(u*c-v*s)*spread,z+(u*s+v*c)*spread));if(clear)break;
  }
  if(!clear){removed++;continue;}
  const id='tree:'+trees++,color=[[.25,.36,.17],[.30,.40,.20],[.27,.38,.22],[.34,.41,.21]][Math.floor(seed*4)],put=(shape,mat,col,detail,part)=>{const q={...shape,p:[x+(shape.p[0]*c-shape.p[2]*s)*spread,base+shape.p[1]*height,z+(shape.p[0]*s+shape.p[2]*c)*spread],s:[shape.s[0]*spread,shape.s[1]*height,shape.s[2]*spread],r:[0,-yaw,0],color:col,mat,outdoor:true,detail,collision:false,vegetationPart:part,treeId:id};delete q.triangles;result.push(q);meshes++;};
  result.push({shape:'cylinder',p:[x,base+1.44*height,z],s:[Math.min(.36,old.s[0]*.90),2.88*height,Math.min(.36,old.s[2]*.90)],color:old.color,mat:10,outdoor:true,detail:0,vegetationPart:'trunk',treeId:id});meshes++;
  put(treeShapes[0],11,color,0,'canopy');put(treeShapes[1],10,old.color,1,'branches');
  if([[3,0],[-3,0],[0,3],[0,-3]].some(([dx,dz])=>city.surChaussee(x+dx,z+dz))){result.push({shape:'cylinder',p:[x,.104,z],s:[1.12,.014,1.12],color:[.24,.235,.17],mat:7,outdoor:true,detail:1,collision:false,vegetationPart:'pit',treeId:id});meshes++;}
  if(x>bounds.minX&&x<bounds.maxX&&z>bounds.minZ&&z<bounds.maxZ)views.push({x,z,height:height*5.9,spread,yaw,clearance:.72,id});
 }
 scenery.length=0;for(const mesh of result)scenery.push(mesh);
 return {trees,removed,meshes,views,shapeTriangles:treeShapes.map(s=>({shape:s.shape,triangles:s.triangles}))};
}
function add(w){const {city,scenery,blocked,addMesh}=w,bounds=w.bounds||{minX:-325,maxX:325,minZ:-325,maxZ:325},rand=PDR.villeReelle.hasard(6513);let count=0,groundDetails=0,storefronts=0;
 const add=(m,solid=true)=>{if(solid)addMesh(m);else scenery.push(m);count++;};
 const box=(p,s,c,cap=0,mat=0,solid=true)=>add({shape:'box',p,s,r:[0,-cap,0],color:c,mat,outdoor:true,detail:solid?1:2},solid);
 const cyl=(p,s,c)=>add({shape:'cylinder',p,s,color:c,mat:0,outdoor:true});
 // Drain covers, worn asphalt repairs and service paint: flush with the road.
 for(let i=0;i<950;i++){const x=bounds.minX+rand()*(bounds.maxX-bounds.minX),z=bounds.minZ+rand()*(bounds.maxZ-bounds.minZ);if(!city.surChaussee(x,z)||blocked(x,z,.7))continue;
  if(i%3===0){box([x,.096,z],[.62,.012,.62],[.15,.19,.20],0,0,false);for(let j=0;j<5;j++)box([x-.24+j*.12,.105,z],[.025,.006,.5],[.07,.10,.11],0,0,false);}
  else box([x,.095,z],[.35+rand()*1.2,.007,.5+rand()*2],[.21,.23,.23],rand(),0,false);
 }
 // Façade attachments use the existing building footprints; they never occupy a traffic lane.
 const dressedBuildings=city.emprises.slice().sort((a,b)=>Math.hypot(a.x-40,a.z-60)-Math.hypot(b.x-40,b.z-60));
 for(let i=0;i<dressedBuildings.length&&storefronts<260;i++){
  const b=dressedBuildings[i];if(b.x<bounds.minX+8||b.x>bounds.maxX-8||b.z<bounds.minZ+8||b.z>bounds.maxZ-8||b.lx<4||b.lz<4)continue;
  const cap=-(b.lacet||0),c=Math.cos(cap),s=Math.sin(cap),local=(u,y,v)=>[b.x+c*u-s*v,y,b.z+s*u+c*v];
  for(const side of [-1,1]){
   const z=side*(b.lz/2+.08),face=local(0,0,z+side*.9);if(storefronts>=260||city.surChaussee(face[0],face[2])||blocked(face[0],face[2],.35))continue;storefronts++;
   // Shopfront, striped awning, shutter, brass door trim, service pipe.
   const width=Math.min(4.5,b.lx*.55),accent=[[.14,.30,.31],[.38,.18,.14],[.20,.28,.39],[.37,.35,.20]][i%4];
   box(local(0,1.25,z),[width,2.25,.12],accent,cap,7);
   box(local(0,1.27,z+side*.071),[width*.88,1.87,.04],[.10,.18,.20],cap,8);
   for(const u of [-width*.43,0,width*.43])box(local(u,1.27,z+side*.11),[.055,1.93,.07],[.55,.49,.34],cap,0);
   box(local(0,2.54,z+side*.08),[width+.2,.27,.18],accent,cap,7);
   box(local(0,2.78,z+side*.45),[width+.4,.07,.94],[.78,.71,.54],cap,18);
   for(let j=0;j<9;j++)box(local(-width/2+j*width/8,2.825,z+side*.45),[width/18,.012,.94],accent,cap,18,false);
   box(local(width/2+.32,1.1,z),[.055,2.2,.055],[.30,.33,.30],cap);
   // Upper-floor air conditioner and wrought iron balcony in a restrained density.
   box(local(width*.32,3.7,z+side*.22),[.75,.48,.37],[.67,.67,.58],cap);
   for(let j=0;j<7;j++)box(local(width*.32-.28+j*.09,3.7,z+side*.42),[.025,.32,.012],[.23,.28,.28],cap,0,false);
   if(i%3===0){box(local(-.6,4.0,z+side*.45),[2.1,.12,.8],[.60,.57,.48],cap);box(local(-.6,4.72,z+side*.83),[2.1,.04,.04],[.12,.17,.18],cap);for(let j=0;j<10;j++)box(local(-1.58+j*.22,4.40,z+side*.83),[.022,.65,.022],[.12,.17,.18],cap);}
  }
 }
 // Small groups of café tables, crates, bins, delivery pallets, bicycle stands on clear pavements.
 let groups=0;for(let i=0;i<3000&&groups<95;i++){
  const x=bounds.minX+12+rand()*(bounds.maxX-bounds.minX-24),z=bounds.minZ+12+rand()*(bounds.maxZ-bounds.minZ-24);if(blocked(x,z,2.4)||city.surChaussee(x,z))continue;
  let road=false,safe=true;for(const [dx,dz]of [[2,0],[-2,0],[0,2],[0,-2]]){if(city.surChaussee(x+dx,z+dz))safe=false;if(city.surChaussee(x+dx*3,z+dz*3))road=true;}if(!safe||!road)continue;
  groups++;const kind=groups%4;
  if(kind===0){cyl([x,.73,z],[.83,.045,.83],[.65,.56,.39]);cyl([x,.39,z],[.055,.68,.055],[.18,.24,.24]);for(const side of [-1,1]){box([x,.43,z+side*.75],[.42,.065,.40],[.25,.34,.29]);box([x,.69,z+side*.93],[.42,.5,.04],[.25,.34,.29]);for(const dx of [-.15,.15])for(const dz of [-.13,.13])box([x+dx,.22,z+side*.75+dz],[.025,.4,.025],[.17,.21,.20]);}}
  else if(kind===1){box([x,.43,z],[.55,.78,.55],[.16,.28,.25]);box([x,.84,z],[.60,.06,.60],[.08,.15,.14]);box([x,.43,z-.285],[.17,.23,.015],[.54,.59,.48],0,0,false);}
  else if(kind===2){for(let j=0;j<3;j++){box([x+j*.45,.25,z],[.4,.4,.5],[.43,.30,.18]);for(let k=0;k<3;k++)box([x+j*.45,.16+k*.11,z+.255],[.38,.02,.01],[.23,.16,.10],0,0,false);}}
  else{for(let j=0;j<3;j++){box([x+j*.5,.43,z],[.035,.78,.035],[.42,.46,.45]);box([x+j*.5,.43,z+.6],[.035,.78,.035],[.42,.46,.45]);box([x+j*.5,.82,z+.3],[.035,.035,.6],[.42,.46,.45]);}}
 }
 // Small settled paving repairs and seams, in clear pedestrian space only. Flush, non-solid and near LOD.
 for(let i=0;i<2400&&groundDetails<130;i++){
  const x=bounds.minX+10+rand()*(bounds.maxX-bounds.minX-20),z=bounds.minZ+10+rand()*(bounds.maxZ-bounds.minZ-20),radius=.65;
  if(blocked(x,z,radius)||w.water?.(x,z)||city.surChaussee(x,z))continue;
  if([[radius,radius],[-radius,radius],[radius,-radius],[-radius,-radius]].some(([dx,dz])=>city.surChaussee(x+dx,z+dz)||blocked(x+dx,z+dz,.1)))continue;
  if(![[3,0],[-3,0],[0,3],[0,-3]].some(([dx,dz])=>city.surChaussee(x+dx,z+dz)))continue;
  const tone=.41+rand()*.11,cap=rand()*Math.PI,width=.52+rand()*.22;
  box([x,.101,z],[width,.008,.85],[tone*1.04,tone,tone*.90],cap,15,false);
  for(let j=0;j<2;j++)box([x+(j-.5)*.20,.107,z],[.015,.003,.55],[.25,.26,.23],cap,7,false);
  groundDetails++;
 }
 return {meshes:count,groups,groundDetails,storefronts};
}R.details={add,prepareVegetation,treeLobes};})(globalThis.RADE=globalThis.RADE||{});
