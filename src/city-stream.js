/* EMPRISE — streamed procedural buildings from geographic footprint vectors.
   Runtime art is geometry only. The two right-triangle primitives are registered
   once before the FERRO atlas; loading another neighbourhood registers no shape. */
(function(R){'use strict';
for(const sign of [1,-1]){const a=[-.5,0,-.5*sign],b=[.5,0,-.5*sign],c=[-.5,0,.5*sign],n=[0,1,0],down=[0,-1,0];const front=sign>0?[a,c,b]:[a,b,c];FRender.forme('emprise-roof-right-'+sign,[[...front,n,n,n],[...front.slice().reverse(),down,down,down]]);}
const pointIn=(ring,x,z)=>{let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;};
const contains=(rings,x,z)=>!!rings[0]&&pointIn(rings[0],x,z)&&!rings.slice(1).some(r=>pointIn(r,x,z));
const widthFor=r=>({motorway:13,trunk:12,primary:10,secondary:8,tertiary:7,residential:6,service:4,track:3,path:1.8,footway:2.2,pedestrian:5,cycleway:2.2,steps:2}[r.class]||({motorway:13,trunk:12,primary:10,secondary:8,tertiary:7,residential:6,service:4,path:2,footway:2.2}[r.subclass])||5);
const boundsOf=points=>[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];
const nearBounds=(b,x,z,r)=>x+r>=b[0]&&x-r<=b[2]&&z+r>=b[1]&&z-r<=b[3];
function rightTriangle(out,A,B,C,y,mat,color,extra={}){const es=[[A,B,C],[B,C,A],[C,A,B]].sort((a,b)=>Math.hypot(b[1][0]-b[0][0],b[1][1]-b[0][1])-Math.hypot(a[1][0]-a[0][0],a[1][1]-a[0][1])),[a,b,c]=es[0],L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<.01)return;const ux=(b[0]-a[0])/L,uz=(b[1]-a[1])/L,t=(c[0]-a[0])*ux+(c[1]-a[1])*uz,H=[a[0]+t*ux,a[1]+t*uz];
 const part=(end)=>{const dx=end[0]-H[0],dz=end[1]-H[1],w=Math.hypot(dx,dz),cx=c[0]-H[0],cz=c[1]-H[1],h=Math.hypot(cx,cz);if(w<.01||h<.01)return;const x=dx/w,z=dz/w,sign=(-z*cx+x*cz)>=0?1:-1;out.push({shape:'emprise-roof-right-'+sign,p:[H[0]+dx/2+cx/2,y,H[1]+dz/2+cz/2],s:[w,.08,h],r:[0,-Math.atan2(z,x),0],mat,color,outdoor:true,...extra});};part(a);part(b);
}
function terrainTriangle(out,A,B,C,mat,color,extra={}){const es=[[A,B,C],[B,C,A],[C,A,B]].sort((a,b)=>Math.hypot(...b[1].map((v,i)=>v-b[0][i]))-Math.hypot(...a[1].map((v,i)=>v-a[0][i]))),[a,b,c]=es[0],delta=b.map((v,i)=>v-a[i]),L=Math.hypot(...delta);if(L<.01)return;const u=delta.map(v=>v/L),t=c.reduce((n,v,i)=>n+(v-a[i])*u[i],0),H=a.map((v,i)=>v+t*u[i]);
 const part=end=>{const dx=end.map((v,i)=>v-H[i]),dz=c.map((v,i)=>v-H[i]),w=Math.hypot(...dx),h=Math.hypot(...dz);if(w<.01||h<.01)return;const X=dx.map(v=>v/w),Z=dz.map(v=>v/h),Y=[Z[1]*X[2]-Z[2]*X[1],Z[2]*X[0]-Z[0]*X[2],Z[0]*X[1]-Z[1]*X[0]],sign=Y[1]>=0?1:-1;out.push({shape:'emprise-roof-right-'+sign,p:H.map((v,i)=>v+dx[i]/2+dz[i]/2),s:[w,.08,h],r:BITUME.voiture.angles([X,Y.map(v=>v*sign),Z.map(v=>v*sign)]),mat,color,outdoor:true,...extra});};part(a);part(b);
}
function polygonMesh(out,rings,y,mat,color,extra={}){const flat=[],holes=[];for(let i=0;i<rings.length;i++){if(i)holes.push(flat.length/2);for(const p of rings[i])flat.push(p[0],p[1]);}if(flat.length<6)return;const indices=earcut(flat,holes,2);for(let i=0;i<indices.length;i+=3){const a=indices[i]*2,b=indices[i+1]*2,c=indices[i+2]*2;if(typeof y==='function')terrainTriangle(out,[flat[a],y(flat[a],flat[a+1]),flat[a+1]],[flat[b],y(flat[b],flat[b+1]),flat[b+1]],[flat[c],y(flat[c],flat[c+1]),flat[c+1]],mat,color,extra);else rightTriangle(out,[flat[a],flat[a+1]],[flat[b],flat[b+1]],[flat[c],flat[c+1]],y,mat,color,extra);}}
function create(data=R.cityData,{groundAt=()=>.08,budgetMs=3,maxBuildingsPerTick=64,saved=null,excludeBuilding=()=>false}={}){
 if(!data)throw Error('Missing Marseille vector data');const size=data.chunkSize||512,loaded=new Map(),decoded=new Map(),indices=new Map(),wallCache=new WeakMap(),roomCache=new WeakMap(),breaches=new Map(),brokenLamps=new Set(),lampHits=new Map(),lampIndex=new Map(),known=new Set(Object.keys(data.tiles)),stats={residentChunks:0,queuedChunks:0,pendingBuildings:0,lastBuildMs:0,totalBuilt:0,instances:0},B=data.bounds,bounds=Array.isArray(B)?{minX:B[0],minZ:B[1],maxX:B[2],maxZ:B[3]}:{...B};let geometry=[],revision=0,centre='',wanted=new Set(),queue=[],job=null,lastFocus={x:0,z:0};
 const stamp=()=>globalThis.performance?.now?.()??Date.now(),tileKey=(x,z)=>Math.floor(x/size)+','+Math.floor(z/size),fetch=k=>{if(!known.has(k))return null;if(!decoded.has(k))decoded.set(k,data.decode?data.decode(k):data.tiles[k]);if(decoded.size>32)for(const old of decoded.keys())if(old!==k&&!wanted.has(old)&&!loaded.has(old)&&job?.key!==old){decoded.delete(old);indices.delete(old);data.release?.(old);break;}return decoded.get(k);};
 const localKeys=(x,z,r=0)=>{const keys=[];for(let iz=Math.floor((z-r)/size)-1;iz<=Math.floor((z+r)/size)+1;iz++)for(let ix=Math.floor((x-r)/size)-1;ix<=Math.floor((x+r)/size)+1;ix++)keys.push(ix+','+iz);return keys;};
 function refresh(){geometry=[];lampIndex.clear();for(const c of loaded.values()){for(const m of c.meshes)geometry.push(m);for(const l of c.lamps||[])if(!brokenLamps.has(l.id)){const key=Math.floor(l.x/64)+','+Math.floor(l.z/64);if(!lampIndex.has(key))lampIndex.set(key,[]);if(!lampIndex.get(key).some(q=>q.id===l.id))lampIndex.get(key).push(l);}}stats.residentChunks=loaded.size;stats.instances=geometry.length;revision++;}
 function box(out,p,s,cap,mat,color,extra={}){if(s.some(v=>!Number.isFinite(v)||v<=0))return;out.push({shape:'box',p,s,r:[0,-cap,0],mat,color,outdoor:true,streamed:true,...extra});}
 function start(k){const t=fetch(k),[ix,iz]=k.split(',').map(Number);return t?{key:k,t,meshes:[],indexKeys:localKeys((ix+.5)*size,(iz+.5)*size).filter(id=>known.has(id)),indexCursor:0,index:0,greenIndex:0,waterIndex:0,roadIndex:0,roadSegment:1,roadSub:0,roadPlan:null,lampQueue:[],lampIndex:0,lamps:[],phase:0}:null;}
 function advance(c,focus){
  // Warm one neighbouring spatial index per budget unit; lamp placement must
  // never build all nine dense neighbourhood indices in a single frame.
  if(c.indexCursor<c.indexKeys.length){indexed(c.indexKeys[c.indexCursor++]);return true;}
  while(c.phase<5){
   if(c.phase===0){const q=(c.t.green||[])[c.greenIndex++];if(q){polygonMesh(c.meshes,q.rings,(x,z)=>groundAt(x,z)+.005,8,[.24,.31,.18],{ground:true,streamed:true,collision:false});return true;}c.phase++;}
   else if(c.phase===1){const q=(c.t.water||[])[c.waterIndex++];if(q){polygonMesh(c.meshes,q.rings,-.045,12,[.10,.27,.31],{water:true,ground:true,streamed:true,collision:false});return true;}c.phase++;}
   else if(c.phase===2){const r=(c.t.roads||[])[c.roadIndex];if(!r){c.phase++;continue;}if(r.tunnel||c.roadSegment>=(r.points||[]).length){c.roadIndex++;c.roadSegment=1;c.roadPlan=null;continue;}if(!c.roadPlan){const a=r.points[c.roadSegment-1],b=r.points[c.roadSegment];queueRoadLamps(c,r,a,b);c.roadPlan=planRoad(r,a,b);}drawRoadPatch(c,c.roadPlan);if(c.roadPlan.done){c.roadSegment++;c.roadPlan=null;}return true;}
   else if(c.phase===3){const b=(c.t.buildings||[])[c.index++];if(b){building(c,b,focus);return true;}c.phase++;}
   else{const q=c.lampQueue[c.lampIndex++];if(q){placeLamp(c,q);return true;}c.lampQueue=[];c.phase++;}
  }return false;
 }
 function planRoad(r,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),co=dx/(length||1),si=dz/(length||1),width=widthFor(r),ha=groundAt(...a),hb=groundAt(...b);let error=0;for(const u of [0,.25,.5,.75,1])for(const v of [-.5,0,.5]){const x=a[0]+dx*u-si*width*v,z=a[1]+dz*u+co*width*v;error=Math.max(error,Math.abs(groundAt(x,z)-(ha+(hb-ha)*u)));}return {r,a,b,dx,dz,length,co,si,width,ha,hb,flat:r.bridge||error<=.02,nx:Math.max(1,Math.ceil(length/2)),nz:Math.max(1,Math.ceil(width/2)),cursor:0,stack:[],done:length<.02};}
 function drawRoadPatch(c,p){if(p.done)return;if(p.flat){box(c.meshes,[(p.a[0]+p.b[0])/2,(p.ha+p.hb)/2+.035+(p.r.bridge?Math.max(1,Math.abs(p.r.layer||1))*4.2:0),(p.a[1]+p.b[1])/2],[Math.hypot(p.length,p.hb-p.ha)+.03,.045,p.width],Math.atan2(p.dz,p.dx),14,[.12,.13,.13],{ground:true,road:p.r.id,collision:false,r:BITUME.voiture.angles(BITUME.voiture.attitude(Math.atan2(p.dz,p.dx),Math.atan2(p.hb-p.ha,p.length),0))});p.done=true;return;}
  let cell=p.stack.pop();if(!cell){if(p.cursor>=p.nx*p.nz){p.done=true;return;}const i=p.cursor++,ix=Math.floor(i/p.nz),iz=i%p.nz;cell={u0:ix/p.nx,u1:(ix+1)/p.nx,v0:iz/p.nz-.5,v1:(iz+1)/p.nz-.5,depth:0};}
  const at=(u,v)=>{const x=p.a[0]+p.dx*u-p.si*p.width*v,z=p.a[1]+p.dz*u+p.co*p.width*v;return [x,groundAt(x,z)+.045,z];},u=(cell.u0+cell.u1)/2,v=(cell.v0+cell.v1)/2,A=at(cell.u0,cell.v0),B=at(cell.u0,cell.v1),C=at(cell.u1,cell.v1),D=at(cell.u1,cell.v0),error=Math.max(Math.abs(at(u,v)[1]-(A[1]+C[1])/2),Math.abs(at(cell.u0,v)[1]-(A[1]+B[1])/2),Math.abs(at(u,cell.v1)[1]-(B[1]+C[1])/2),Math.abs(at(cell.u1,v)[1]-(C[1]+D[1])/2),Math.abs(at(u,cell.v0)[1]-(D[1]+A[1])/2));
  if(error>.02&&cell.depth<3){const depth=cell.depth+1;p.stack.push({u0:cell.u0,u1:u,v0:cell.v0,v1:v,depth},{u0:cell.u0,u1:u,v0:v,v1:cell.v1,depth},{u0:u,u1:cell.u1,v0:cell.v0,v1:v,depth},{u0:u,u1:cell.u1,v0:v,v1:cell.v1,depth});return;}
  const extra={ground:true,road:p.r.id,roadRibbon:true,collision:false,streamed:true};terrainTriangle(c.meshes,A,B,C,14,[.12,.13,.13],extra);terrainTriangle(c.meshes,A,C,D,14,[.12,.13,.13],extra);if(!p.stack.length&&p.cursor>=p.nx*p.nz)p.done=true;
 }
 function queueRoadLamps(c,r,a,b){if(r.bridge||r.tunnel||!['minor','tertiary','secondary','primary','residential','living_street','unclassified','service','pedestrian'].includes(r.class))return;const dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz);if(L<.5)return;const co=dx/L,si=dz/L,step=r.class==='primary'?38:34,phase=((a[0]*co+a[1]*si)%step+step)%step;let distance=(step-phase)%step;
  for(;distance<=L;distance+=step)c.lampQueue.push({road:r,x:a[0]+co*distance,z:a[1]+si*distance,co,si,station:Math.round((a[0]*co+a[1]*si+distance)/step)});
 }
 function placeLamp(c,q){const width=widthFor(q.road),offset=width/2+1.1,seed=String(q.road.id).split('').reduce((v,s)=>v+s.charCodeAt(0),0),first=(seed+q.station)%2?1:-1,core=data.coreBounds;for(const side of [first,-first]){const x=q.x-q.si*offset*side,z=q.z+q.co*offset*side,base=groundAt(x,z);if(!Number.isFinite(base)||base<0||core&&x>core[0]&&x<core[2]&&z>core[1]&&z<core[3]||water(x,z)||roadAt(x,z)||blocked(x,z,.65,base,6.1)||c.lamps.some(l=>Math.hypot(l.x-x,l.z-z)<16))continue;const id='city-lamp:'+q.road.id+':'+Math.round(x*10)+':'+Math.round(z*10),poleHeight=q.road.class==='primary'?7:5.8,nx=q.si*side,nz=-q.co*side,arm=1.05,lamp={id,x,z,y:base+poleHeight,base,color:[1,.77,.44],range:19,power:72,meshes:[]};
   box(lamp.meshes,[x,base+.12,z],[.36,.24,.36],0,3,[.30,.31,.29],{lampId:id,streetLamp:true});box(lamp.meshes,[x,base+poleHeight/2,z],[.13,poleHeight,.13],0,0,[.21,.25,.24],{lampId:id,streetLamp:true,material:'metal',mass:55});box(lamp.meshes,[x+nx*arm/2,base+poleHeight-.05,z+nz*arm/2],[arm,.10,.10],Math.atan2(nz,nx),0,[.24,.28,.26],{lampId:id,streetLamp:true,material:'metal',mass:7});box(lamp.meshes,[x+nx*arm,base+poleHeight-.13,z+nz*arm],[.52,.17,.27],Math.atan2(nz,nx),0,[.19,.22,.21],{lampId:id,streetLamp:true,material:'metal',mass:8});box(lamp.meshes,[x+nx*arm,base+poleHeight-.225,z+nz*arm],[.43,.025,.20],Math.atan2(nz,nx),7,[.76,.78,.70],{lampId:id,streetLampLight:true,nightLight:true,emissive:0,collision:false});lamp.mesh=lamp.meshes.at(-1);lamp.lightX=lamp.mesh.p[0];lamp.lightZ=lamp.mesh.p[2];lamp.lightY=lamp.mesh.p[1];c.lamps.push(lamp);if(!brokenLamps.has(id))c.meshes.push(...lamp.meshes);return;
  }
 }
 function nearbyLamps(x,z,r=0){const out=[],seen=new Set();for(let ix=Math.floor((x-r)/64);ix<=Math.floor((x+r)/64);ix++)for(let iz=Math.floor((z-r)/64);iz<=Math.floor((z+r)/64);iz++)for(const l of lampIndex.get(ix+','+iz)||[])if(!seen.has(l.id)&&Math.hypot(l.x-x,l.z-z)<=r+.3){seen.add(l.id);out.push(l);}return out;}
 function streetLights(x,z,radius=110,night=1){if(![x,z,radius,night].every(Number.isFinite)||night<=.01)return [];radius=Math.max(0,Math.min(180,radius));night=Math.min(1,Math.max(0,night));return nearbyLamps(x,z,radius).sort((a,b)=>Math.hypot(a.x-x,a.z-z)-Math.hypot(b.x-x,b.z-z)).slice(0,32).map(l=>({id:l.id,x:l.lightX,y:l.lightY,z:l.lightZ,color:l.color,range:l.range,power:l.power*night,mesh:l.mesh,base:[l.x,l.base,l.z]}));}
 function damageLamps(point,power,radius,direction,result){for(const l of nearbyLamps(point[0],point[2],Math.max(.4,radius)+1.2)){const poleDistance=Math.hypot(l.x-point[0],l.z-point[2],Math.max(0,l.base-point[1],point[1]-l.y)),headDistance=Math.hypot(l.lightX-point[0],l.lightZ-point[2],l.lightY-point[1]),dist=Math.min(poleDistance,Math.max(0,headDistance-.25));if(dist>Math.max(.3,radius))continue;const energy=power*(radius?Math.max(.1,1-dist/(radius+.5)):1),hits=(lampHits.get(l.id)||0)+energy;lampHits.set(l.id,hits);if(hits<30)continue;brokenLamps.add(l.id);lampHits.delete(l.id);result.changed=true;for(const m of l.meshes){if(!m.mass)continue;const parts=FDestruction.fragment(m,Math.max(0,32-result.debris.length));for(const part of parts.pieces){const mesh=part.mesh,mass=m.mass*part.volume/parts.volume,dir=Array.isArray(direction)&&direction.length===3&&direction.every(Number.isFinite)?direction:[.5,.1,.4];result.debris.push({structural:true,sourceId:l.id,shape:'box',x:mesh.p[0],y:mesh.p[1],z:mesh.p[2],size:mesh.s,rotation:mesh.r,velocity:[dir[0]*2,.4+dir[1],dir[2]*2],angularVelocity:[.4,.3,.5],mat:0,color:m.color,material:'metal',mass,volume:part.volume});}if(parts.crumbleVolume>0)result.debris.push({dust:true,x:m.p[0],y:m.p[1],z:m.p[2],size:m.s,volume:parts.crumbleVolume});}for(const c of [...loaded.values(),...(job?[job]:[])])c.meshes=c.meshes.filter(m=>m.lampId!==l.id);result.events.push({name:'collapse',sourceId:l.id,x:l.x,y:(l.base+l.y)/2,z:l.z,power:energy});}if(result.changed)refresh();}
 function indexed(k){const t=fetch(k);if(!t)return null;if(indices.has(k))return indices.get(k);const idx={buildings:new Map(),roads:new Map(),water:new Map()},put=(map,item,bounds)=>{for(let x=Math.floor(bounds[0]/64);x<=Math.floor(bounds[2]/64);x++)for(let z=Math.floor(bounds[1]/64);z<=Math.floor(bounds[3]/64);z++){const id=x+','+z;if(!map.has(id))map.set(id,[]);map.get(id).push(item);}};
  for(const b of t.buildings||[])if(!excludeBuilding(b))put(idx.buildings,b,b.bounds||boundsOf(b.points));
  for(const r of t.roads||[]){if(r.tunnel||r.bridge)continue;const width=widthFor(r);for(let i=1;i<r.points.length;i++){const a=r.points[i-1],b=r.points[i];put(idx.roads,{road:r,a,b,width},[Math.min(a[0],b[0])-width/2,Math.min(a[1],b[1])-width/2,Math.max(a[0],b[0])+width/2,Math.max(a[1],b[1])+width/2]);}}
  for(const q of t.water||[])if(q.rings?.[0]?.length)put(idx.water,q,boundsOf(q.rings[0]));indices.set(k,idx);return idx;
 }
 function nearbyBuildings(x,z,r=0){const found=[],seen=new Set();for(const key of localKeys(x,z,r)){const idx=indexed(key);if(!idx)continue;for(let ix=Math.floor((x-r)/64);ix<=Math.floor((x+r)/64);ix++)for(let iz=Math.floor((z-r)/64);iz<=Math.floor((z+r)/64);iz++)for(const b of idx.buildings.get(ix+','+iz)||[]){if(seen.has(b.id)||!nearBounds(b.bounds||boundsOf(b.points),x,z,r+.3))continue;seen.add(b.id);found.push(b);}}return found;}

 function dimensions(b){const bb=b.bounds||boundsOf(b.points),cx=(bb[0]+bb[2])/2,cz=(bb[1]+bb[3])/2;return {bb,cx,cz,base:groundAt(cx,cz)+(b.minHeight||0),height:Math.max(2,Math.min(180,(b.height||9)-(b.minHeight||0)))};}
 function wallsFor(b){const {base,height}=dimensions(b),out=[],record=breaches.get(String(b.id));for(const [ri,ring]of [b.points,...(b.holes||[])].entries())for(let i=0;i<ring.length;i++){const a=ring[i],d=ring[(i+1)%ring.length],dx=d[0]-a[0],dz=d[1]-a[1],length=Math.hypot(dx,dz);if(length<.05)continue;const id=ri+':'+i,holes=(record?.openings||[]).filter(h=>h.wall===id).map(h=>({u0:Math.max(0,h.start*length),u1:Math.min(length,h.end*length),y0:Math.max(0,h.low),y1:Math.min(height,h.high)}));let pieces=[{u0:0,u1:length,y0:0,y1:height}];
   for(const h of holes){const next=[];for(const r of pieces){const lo=Math.max(r.u0,h.u0),hi=Math.min(r.u1,h.u1),bot=Math.max(r.y0,h.y0),top=Math.min(r.y1,h.y1);if(hi<=lo||top<=bot){next.push(r);continue;}if(lo>r.u0+.01)next.push({...r,u1:lo});if(hi<r.u1-.01)next.push({...r,u0:hi});if(bot>r.y0+.01)next.push({u0:lo,u1:hi,y0:r.y0,y1:bot});if(top<r.y1-.01)next.push({u0:lo,u1:hi,y0:top,y1:r.y1});}pieces=next;}
   out.push({id,a,dx,dz,length,cap:Math.atan2(dz,dx),co:dx/length,si:dz/length,base,height,holes,pieces});
  }return out;
 }
 function roomFor(b){if(roomCache.has(b))return roomCache.get(b);const out=[],{bb,base,height}=dimensions(b),rings=[b.points,...(b.holes||[])];polygonMesh(out,rings,base+.012,15,[.37,.30,.23],{streamed:true,building:b.id,interior:true,floor:true,collision:false});polygonMesh(out,rings,base+Math.min(3.03,height-.08),7,[.63,.61,.55],{streamed:true,building:b.id,interior:true,ceiling:true,collision:false});
  // A few deterministic furnishings only; this generic exposed room is not a
  // real-address shop inventory and never duplicates the authored core interiors.
  let count=0;for(let z=bb[1]+2;z<bb[3]-2&&count<4;z+=3.6)for(let x=bb[0]+2;x<bb[2]-2&&count<4;x+=4.1){if(![[-.8,-.8],[.8,-.8],[.8,.8],[-.8,.8],[0,0]].every(([dx,dz])=>contains(rings,x+dx,z+dz)))continue;const style=count++%2;if(style===0){box(out,[x,base+.72,z],[1.2,.10,.8],0,3,[.28,.20,.13],{building:b.id,interior:true,furniture:true,material:'wood',collision:true});for(const dx of [-.48,.48])for(const dz of [-.3,.3])box(out,[x+dx,base+.34,z+dz],[.07,.68,.07],0,3,[.22,.17,.12],{building:b.id,interior:true,collision:false});}else box(out,[x,base+.42,z],[.8,.84,.8],0,3,[.39,.30,.18],{building:b.id,interior:true,furniture:true,material:'wood',collision:true});}
  roomCache.set(b,out);return out;
 }
 function building(c,b,focus){const points=b.points;if(!points||points.length<3||excludeBuilding(b))return;const {cx,cz,base,height}=dimensions(b),hash=String(b.id).split('').reduce((n,s)=>(Math.imul(n,31)+s.charCodeAt(0))>>>0,135),stone=[[.65,.59,.48],[.70,.66,.56],[.59,.56,.50],[.73,.67,.55]][hash%4],rings=[points,...(b.holes||[])];
  polygonMesh(c.meshes,rings,base+height,9,[.46,.33,.23],{streamed:true,building:b.id,roof:true});
  for(const wall of wallsFor(b)){const {a,dx,dz,length,cap,co,si,pieces,holes}=wall;for(const rect of pieces){const middle=(rect.u0+rect.u1)/2;box(c.meshes,[a[0]+co*middle,base+(rect.y0+rect.y1)/2,a[1]+si*middle],[rect.u1-rect.u0,rect.y1-rect.y0,.30],cap,12.55+(hash%89)/100,stone,{building:b.id,wall:true,wallId:wall.id});}
  }if(breaches.get(String(b.id))?.openings.length)for(const m of roomFor(b))c.meshes.push(m);
 }
 function tick(x,z){if(!Number.isFinite(x)||!Number.isFinite(z))return false;lastFocus={x,z};const now=stamp(),k=tileKey(x,z);if(k!==centre){centre=k;const ix=Math.floor(x/size),iz=Math.floor(z/size),list=[];for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){const id=(ix+dx)+','+(iz+dz);if(known.has(id))list.push({id,d:dx*dx+dz*dz});}list.sort((a,b)=>a.d-b.d);wanted=new Set(list.map(q=>q.id));let changed=false;for(const id of loaded.keys())if(!wanted.has(id)){loaded.delete(id);changed=true;}if(job&&!wanted.has(job.key))job=null;queue=list.map(q=>q.id).filter(id=>!loaded.has(id)&&job?.key!==id);for(const id of decoded.keys())if(!wanted.has(id)){decoded.delete(id);indices.delete(id);data.release?.(id);}if(changed)refresh();}
  if(!job&&queue.length)job=start(queue.shift());let count=0;
  if(job){while(count<maxBuildingsPerTick&&(count===0||stamp()-now<budgetMs)){if(!advance(job,{x,z}))break;count++;}stats.pendingBuildings=Math.max(0,(job.t.buildings||[]).length-job.index);if(job.phase>=5){loaded.set(job.key,job);stats.totalBuilt++;job=null;refresh();}}
  stats.queuedChunks=queue.length+(job?1:0);stats.lastBuildMs=stamp()-now;return count>0;
 }
 function collidersFor(b){if(wallCache.has(b))return wallCache.get(b);const out=[];for(const wall of wallsFor(b)){const {a,co,si,cap,base}=wall;for(const r of wall.pieces){const u=(r.u0+r.u1)/2,x=a[0]+co*u,z=a[1]+si*u,half=(r.u1-r.u0)/2,dx=Math.abs(co*half)+Math.abs(si*.15),dz=Math.abs(si*half)+Math.abs(co*.15);out.push({x,z,a:half,b:.15,c:co,s:si,cap,minY:base+r.y0,maxY:base+r.y1,kind:'streamed-building',buildingId:b.id,wallId:wall.id,minX:x-dx,maxX:x+dx,minZ:z-dz,maxZ:z+dz,mesh:{shape:'box',p:[x,base+(r.y0+r.y1)/2,z],s:[half*2,r.y1-r.y0,.3],r:[0,-cap,0],mat:3,material:'stone',building:b.id,wall:true}});}}
  if(breaches.get(String(b.id))?.openings.length)for(const m of roomFor(b))if(m.furniture&&m.collision)out.push({x:m.p[0],z:m.p[2],a:m.s[0]/2,b:m.s[2]/2,c:1,s:0,cap:0,minY:m.p[1]-m.s[1]/2,maxY:m.p[1]+m.s[1]/2,kind:'streamed-furniture',buildingId:b.id,mesh:m,minX:m.p[0]-m.s[0]/2,maxX:m.p[0]+m.s[0]/2,minZ:m.p[2]-m.s[2]/2,maxZ:m.p[2]+m.s[2]/2});wallCache.set(b,out);return out;
 }
 function candidates(x,z,r=0){const out=[];for(const b of nearbyBuildings(x,z,r+.3))for(const q of collidersFor(b))if(x+r>=q.minX&&x-r<=q.maxX&&z+r>=q.minZ&&z-r<=q.maxZ)out.push(q);for(const l of nearbyLamps(x,z,r+1.2)){out.push({x:l.x,z:l.z,a:.065,b:.065,c:1,s:0,cap:0,minY:l.base,maxY:l.y,kind:'street-lamp',lampId:l.id,minX:l.x-.065,maxX:l.x+.065,minZ:l.z-.065,maxZ:l.z+.065,mesh:l.meshes[1]});const m=l.meshes[3],cap=-m.r[1];out.push({x:m.p[0],z:m.p[2],a:m.s[0]/2,b:m.s[2]/2,c:Math.cos(cap),s:Math.sin(cap),cap,minY:m.p[1]-m.s[1]/2,maxY:m.p[1]+m.s[1]/2,kind:'street-lamp',lampId:l.id,minX:m.p[0]-.3,maxX:m.p[0]+.3,minZ:m.p[2]-.3,maxZ:m.p[2]+.3,mesh:m});}return out;}
 function blocked(x,z,r=.28,y=.08,height=1.8){for(const q of candidates(x,z,r)){if(q.maxY<=y+.22||q.minY>=y+height)continue;const dx=x-q.x,dz=z-q.z,u=dx*q.c+dz*q.s,v=-dx*q.s+dz*q.c;if((u-Math.max(-q.a,Math.min(q.a,u)))**2+(v-Math.max(-q.b,Math.min(q.b,v)))**2<r*r)return true;}for(const b of nearbyBuildings(x,z)){if(breaches.get(String(b.id))?.openings.length)continue;const bb=b.bounds||boundsOf(b.points);if(!nearBounds(bb,x,z,0))continue;const base=groundAt((bb[0]+bb[2])/2,(bb[1]+bb[3])/2);if(base+(b.minHeight||0)>=y+height||base+(b.height||9)<=y+.22)continue;if(contains([b.points,...(b.holes||[])],x,z))return true;}return false;}
 function refreshBuilding(b){wallCache.delete(b);roomCache.delete(b);for(const c of [...loaded.values(),...(job?[job]:[])])if(c.t.buildings?.includes(b)&&(!job||c!==job||c.index>c.t.buildings.indexOf(b))){c.meshes=c.meshes.filter(m=>m.building!==b.id);building(c,b,lastFocus);}refresh();}
 function damage(point,power,radius=0,direction){const result={changed:false,debris:[],events:[]};if(!Array.isArray(point)||point.length!==3||!point.every(Number.isFinite)||!Number.isFinite(power)||power<=0||!Number.isFinite(radius)||radius<0)return result;power=Math.min(1000,power);radius=Math.min(12,radius);damageLamps(point,power,radius,direction,result);const touched=nearbyBuildings(point[0],point[2],Math.max(.4,radius));
  for(const b of touched){const record=breaches.get(String(b.id))||{openings:[],hits:{}},wallList=wallsFor(b);let changed=false;for(const wall of wallList){const {a,co,si,length,base,height}=wall,u=(point[0]-a[0])*co+(point[2]-a[1])*si,v=-(point[0]-a[0])*si+(point[2]-a[1])*co,near=Math.max(0,Math.min(length,u)),dist=Math.hypot(u-near,v,Math.max(0,base-point[1],point[1]-base-height));if(dist>Math.max(.36,radius)||record.openings.length>=12)continue;const force=power*(radius?Math.max(.12,1-dist/(radius+.5)):1),floor=Math.max(0,Math.min(height-1,Math.floor((point[1]-base)/3.1)*3.1)),width=Math.max(1.6,Math.min(4.8,.9+force/70+radius*.35)),lo=Math.max(0,near-width/2),hi=Math.min(length,near+width/2),low=floor,high=Math.min(height,low+2.6);if(high-low<1||record.openings.some(h=>h.wall===wall.id&&h.start*length<=lo+.1&&h.end*length>=hi-.1&&h.low<=low+.1&&h.high>=high-.1))continue;
    record.hits[wall.id]=Math.min(1000,(record.hits[wall.id]||0)+force*(radius>=1?2.6:1));if(record.hits[wall.id]<120){breaches.set(String(b.id),record);continue;}record.hits[wall.id]=0;record.openings.push({wall:wall.id,start:lo/length,end:hi/length,low,high});breaches.set(String(b.id),record);changed=true;
    const mesh={shape:'box',p:[a[0]+co*(lo+hi)/2,base+(low+high)/2,a[1]+si*(lo+hi)/2],s:[hi-lo,high-low,.3],r:[0,-wall.cap,0],mat:3,color:[.63,.58,.48]};
    // Only still-solid rectangles create mass. Enlarging an existing opening
    // must not manufacture the masonry already removed by an earlier shot.
    for(const rect of wall.pieces){const x0=Math.max(lo,rect.u0),x1=Math.min(hi,rect.u1),y0=Math.max(low,rect.y0),y1=Math.min(high,rect.y1);if(x1-x0<.001||y1-y0<.001)continue;const raw={...mesh,p:[a[0]+co*(x0+x1)/2,base+(y0+y1)/2,a[1]+si*(x0+x1)/2],s:[x1-x0,y1-y0,.3]},parts=FDestruction.fragment(raw,Math.max(0,32-result.debris.length));for(const part of parts.pieces){const m=part.mesh,dir=Array.isArray(direction)&&direction.length===3&&direction.every(Number.isFinite)?direction:[-si,.2,co],n=Math.hypot(...dir)||1,mass=Math.max(.035,Math.min(12000,part.volume*2200)),speed=Math.min(3,Math.sqrt(force)*.3/Math.pow(Math.max(1,mass),.22));result.debris.push({structural:true,sourceId:'city:'+b.id,shape:'box',x:m.p[0],y:m.p[1],z:m.p[2],size:m.s,rotation:m.r,angularVelocity:[.3,.5,.2],velocity:[dir[0]/n*speed,.6+dir[1]/n*speed,dir[2]/n*speed],mat:3,color:mesh.color,material:'stone',mass,volume:part.volume});}if(parts.crumbleVolume>0)result.debris.push({dust:true,x:raw.p[0],y:raw.p[1],z:raw.p[2],size:raw.s,volume:parts.crumbleVolume});}
    result.events.push({name:'collapse',sourceId:'city:'+b.id,x:mesh.p[0],y:mesh.p[1],z:mesh.p[2],power:force});if(!radius)break;
   }if(changed){result.changed=true;refreshBuilding(b);}if(result.events.length>=8)break;
  }return result;
 }
 function save(){return {version:1,lamps:[...brokenLamps].slice(0,8192),buildings:[...breaches].filter(([,r])=>r.openings.length).slice(0,2048).map(([id,r])=>({id,openings:r.openings.map(o=>({...o}))}))};}
 function restore(snapshot){breaches.clear();brokenLamps.clear();lampHits.clear();if(snapshot?.version===1&&Array.isArray(snapshot.lamps))for(const id of snapshot.lamps.slice(0,8192))if(typeof id==='string'&&id.startsWith('city-lamp:')&&id.length<200)brokenLamps.add(id);if(snapshot?.version===1&&Array.isArray(snapshot.buildings))for(const row of snapshot.buildings.slice(0,2048)){if(!row||!['string','number'].includes(typeof row.id)||String(row.id).length>120||!Array.isArray(row.openings))continue;const openings=row.openings.slice(0,12).filter(o=>o&&typeof o.wall==='string'&&/^\d{1,5}:\d{1,5}$/.test(o.wall)&&[o.start,o.end,o.low,o.high].every(Number.isFinite)&&o.start>=0&&o.end<=1&&o.end>o.start&&o.low>=0&&o.high<=180&&o.high>o.low).map(o=>({wall:o.wall,start:o.start,end:o.end,low:o.low,high:o.high}));if(openings.length)breaches.set(String(row.id),{openings,hits:{}});}for(const t of decoded.values())for(const b of t.buildings||[]){wallCache.delete(b);roomCache.delete(b);}for(const c of [...loaded.values(),...(job?[job]:[])]){c.meshes=c.meshes.filter(m=>m.building===undefined&&!m.lampId);for(const b of (c.t.buildings||[]).slice(0,c===job?c.index:undefined))building(c,b,lastFocus);for(const l of c.lamps||[])if(!brokenLamps.has(l.id))c.meshes.push(...l.meshes);}if(loaded.size)refresh();return true;}
 function roofHeight(x,z){let roof=0;for(const b of nearbyBuildings(x,z))if(contains([b.points,...(b.holes||[])],x,z)){const {base,height}=dimensions(b);roof=Math.max(roof,base+(breaches.get(String(b.id))?.openings.length?Math.min(3.03,height-.08):height));}return roof;}
 function water(x,z){const idx=indexed(tileKey(x,z));if(!idx)return null;return (idx.water.get(Math.floor(x/64)+','+Math.floor(z/64))||[]).some(w=>contains(w.rings,x,z));}
 function roadAt(x,z){const idx=indexed(tileKey(x,z));if(!idx)return null;let best=null,bestD=Infinity;for(const {road:r,a,b,width} of idx.roads.get(Math.floor(x/64)+','+Math.floor(z/64))||[]){const dx=b[0]-a[0],dz=b[1]-a[1],len=dx*dx+dz*dz,t=len?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/len)):0,d=Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);if(d<width/2&&d<bestD){best=r;bestD=d;}}return best;}

 restore(saved);
 return {tick,candidates,blocked,water,roadAt,bounds,stats,damage,save,restore,roofHeight,streetLights,get geometry(){return geometry;},get revision(){return revision;},get pending(){return !!job||queue.length>0;},surface(x,z){return roadAt(x,z)?{mu:1.15,type:'piste',pente:0,devers:0}:{mu:.85,type:'pave',pente:0,devers:0};}};
}
R.cityStream={create,polygonMesh,rightTriangle};

/* Earcut 3.0.2 — https://github.com/mapbox/earcut
ISC License

Copyright (c) 2024, Mapbox

Permission to use, copy, modify, and/or distribute this software for any purpose
with or without fee is hereby granted, provided that the above copyright notice
and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER
TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
THIS SOFTWARE.
*/

function earcut(data, holeIndices, dim = 2) {

    const hasHoles = holeIndices && holeIndices.length;
    const outerLen = hasHoles ? holeIndices[0] * dim : data.length;
    let outerNode = linkedList(data, 0, outerLen, dim, true);
    const triangles = [];

    if (!outerNode || outerNode.next === outerNode.prev) return triangles;

    let minX, minY, invSize;

    if (hasHoles) outerNode = eliminateHoles(data, holeIndices, outerNode, dim);

    // if the shape is not too simple, we'll use z-order curve hash later; calculate polygon bbox
    if (data.length > 80 * dim) {
        minX = data[0];
        minY = data[1];
        let maxX = minX;
        let maxY = minY;

        for (let i = dim; i < outerLen; i += dim) {
            const x = data[i];
            const y = data[i + 1];
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
        }

        // minX, minY and invSize are later used to transform coords into integers for z-order calculation
        invSize = Math.max(maxX - minX, maxY - minY);
        invSize = invSize !== 0 ? 32767 / invSize : 0;
    }

    earcutLinked(outerNode, triangles, dim, minX, minY, invSize, 0);

    return triangles;
}

// create a circular doubly linked list from polygon points in the specified winding order
function linkedList(data, start, end, dim, clockwise) {
    let last;

    if (clockwise === (signedArea(data, start, end, dim) > 0)) {
        for (let i = start; i < end; i += dim) last = insertNode(i / dim | 0, data[i], data[i + 1], last);
    } else {
        for (let i = end - dim; i >= start; i -= dim) last = insertNode(i / dim | 0, data[i], data[i + 1], last);
    }

    if (last && equals(last, last.next)) {
        removeNode(last);
        last = last.next;
    }

    return last;
}

// eliminate colinear or duplicate points
function filterPoints(start, end) {
    if (!start) return start;
    if (!end) end = start;

    let p = start,
        again;
    do {
        again = false;

        if (!p.steiner && (equals(p, p.next) || area(p.prev, p, p.next) === 0)) {
            removeNode(p);
            p = end = p.prev;
            if (p === p.next) break;
            again = true;

        } else {
            p = p.next;
        }
    } while (again || p !== end);

    return end;
}

// main ear slicing loop which triangulates a polygon (given as a linked list)
function earcutLinked(ear, triangles, dim, minX, minY, invSize, pass) {
    if (!ear) return;

    // interlink polygon nodes in z-order
    if (!pass && invSize) indexCurve(ear, minX, minY, invSize);

    let stop = ear;

    // iterate through ears, slicing them one by one
    while (ear.prev !== ear.next) {
        const prev = ear.prev;
        const next = ear.next;

        if (invSize ? isEarHashed(ear, minX, minY, invSize) : isEar(ear)) {
            triangles.push(prev.i, ear.i, next.i); // cut off the triangle

            removeNode(ear);

            // skipping the next vertex leads to less sliver triangles
            ear = next.next;
            stop = next.next;

            continue;
        }

        ear = next;

        // if we looped through the whole remaining polygon and can't find any more ears
        if (ear === stop) {
            // try filtering points and slicing again
            if (!pass) {
                earcutLinked(filterPoints(ear), triangles, dim, minX, minY, invSize, 1);

            // if this didn't work, try curing all small self-intersections locally
            } else if (pass === 1) {
                ear = cureLocalIntersections(filterPoints(ear), triangles);
                earcutLinked(ear, triangles, dim, minX, minY, invSize, 2);

            // as a last resort, try splitting the remaining polygon into two
            } else if (pass === 2) {
                splitEarcut(ear, triangles, dim, minX, minY, invSize);
            }

            break;
        }
    }
}

// check whether a polygon node forms a valid ear with adjacent nodes
function isEar(ear) {
    const a = ear.prev,
        b = ear,
        c = ear.next;

    if (area(a, b, c) >= 0) return false; // reflex, can't be an ear

    // now make sure we don't have other points inside the potential ear
    const ax = a.x, bx = b.x, cx = c.x, ay = a.y, by = b.y, cy = c.y;

    // triangle bbox
    const x0 = Math.min(ax, bx, cx),
        y0 = Math.min(ay, by, cy),
        x1 = Math.max(ax, bx, cx),
        y1 = Math.max(ay, by, cy);

    let p = c.next;
    while (p !== a) {
        if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1 &&
            pointInTriangleExceptFirst(ax, ay, bx, by, cx, cy, p.x, p.y) &&
            area(p.prev, p, p.next) >= 0) return false;
        p = p.next;
    }

    return true;
}

function isEarHashed(ear, minX, minY, invSize) {
    const a = ear.prev,
        b = ear,
        c = ear.next;

    if (area(a, b, c) >= 0) return false; // reflex, can't be an ear

    const ax = a.x, bx = b.x, cx = c.x, ay = a.y, by = b.y, cy = c.y;

    // triangle bbox
    const x0 = Math.min(ax, bx, cx),
        y0 = Math.min(ay, by, cy),
        x1 = Math.max(ax, bx, cx),
        y1 = Math.max(ay, by, cy);

    // z-order range for the current triangle bbox;
    const minZ = zOrder(x0, y0, minX, minY, invSize),
        maxZ = zOrder(x1, y1, minX, minY, invSize);

    let p = ear.prevZ,
        n = ear.nextZ;

    // look for points inside the triangle in both directions
    while (p && p.z >= minZ && n && n.z <= maxZ) {
        if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1 && p !== a && p !== c &&
            pointInTriangleExceptFirst(ax, ay, bx, by, cx, cy, p.x, p.y) && area(p.prev, p, p.next) >= 0) return false;
        p = p.prevZ;

        if (n.x >= x0 && n.x <= x1 && n.y >= y0 && n.y <= y1 && n !== a && n !== c &&
            pointInTriangleExceptFirst(ax, ay, bx, by, cx, cy, n.x, n.y) && area(n.prev, n, n.next) >= 0) return false;
        n = n.nextZ;
    }

    // look for remaining points in decreasing z-order
    while (p && p.z >= minZ) {
        if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1 && p !== a && p !== c &&
            pointInTriangleExceptFirst(ax, ay, bx, by, cx, cy, p.x, p.y) && area(p.prev, p, p.next) >= 0) return false;
        p = p.prevZ;
    }

    // look for remaining points in increasing z-order
    while (n && n.z <= maxZ) {
        if (n.x >= x0 && n.x <= x1 && n.y >= y0 && n.y <= y1 && n !== a && n !== c &&
            pointInTriangleExceptFirst(ax, ay, bx, by, cx, cy, n.x, n.y) && area(n.prev, n, n.next) >= 0) return false;
        n = n.nextZ;
    }

    return true;
}

// go through all polygon nodes and cure small local self-intersections
function cureLocalIntersections(start, triangles) {
    let p = start;
    do {
        const a = p.prev,
            b = p.next.next;

        if (!equals(a, b) && intersects(a, p, p.next, b) && locallyInside(a, b) && locallyInside(b, a)) {

            triangles.push(a.i, p.i, b.i);

            // remove two nodes involved
            removeNode(p);
            removeNode(p.next);

            p = start = b;
        }
        p = p.next;
    } while (p !== start);

    return filterPoints(p);
}

// try splitting polygon into two and triangulate them independently
function splitEarcut(start, triangles, dim, minX, minY, invSize) {
    // look for a valid diagonal that divides the polygon into two
    let a = start;
    do {
        let b = a.next.next;
        while (b !== a.prev) {
            if (a.i !== b.i && isValidDiagonal(a, b)) {
                // split the polygon in two by the diagonal
                let c = splitPolygon(a, b);

                // filter colinear points around the cuts
                a = filterPoints(a, a.next);
                c = filterPoints(c, c.next);

                // run earcut on each half
                earcutLinked(a, triangles, dim, minX, minY, invSize, 0);
                earcutLinked(c, triangles, dim, minX, minY, invSize, 0);
                return;
            }
            b = b.next;
        }
        a = a.next;
    } while (a !== start);
}

// link every hole into the outer loop, producing a single-ring polygon without holes
function eliminateHoles(data, holeIndices, outerNode, dim) {
    const queue = [];

    for (let i = 0, len = holeIndices.length; i < len; i++) {
        const start = holeIndices[i] * dim;
        const end = i < len - 1 ? holeIndices[i + 1] * dim : data.length;
        const list = linkedList(data, start, end, dim, false);
        if (list === list.next) list.steiner = true;
        queue.push(getLeftmost(list));
    }

    queue.sort(compareXYSlope);

    // process holes from left to right
    for (let i = 0; i < queue.length; i++) {
        outerNode = eliminateHole(queue[i], outerNode);
    }

    return outerNode;
}

function compareXYSlope(a, b) {
    let result = a.x - b.x;
    // when the left-most point of 2 holes meet at a vertex, sort the holes counterclockwise so that when we find
    // the bridge to the outer shell is always the point that they meet at.
    if (result === 0) {
        result = a.y - b.y;
        if (result === 0) {
            const aSlope = (a.next.y - a.y) / (a.next.x - a.x);
            const bSlope = (b.next.y - b.y) / (b.next.x - b.x);
            result = aSlope - bSlope;
        }
    }
    return result;
}

// find a bridge between vertices that connects hole with an outer ring and link it
function eliminateHole(hole, outerNode) {
    const bridge = findHoleBridge(hole, outerNode);
    if (!bridge) {
        return outerNode;
    }

    const bridgeReverse = splitPolygon(bridge, hole);

    // filter collinear points around the cuts
    filterPoints(bridgeReverse, bridgeReverse.next);
    return filterPoints(bridge, bridge.next);
}

// David Eberly's algorithm for finding a bridge between hole and outer polygon
function findHoleBridge(hole, outerNode) {
    let p = outerNode;
    const hx = hole.x;
    const hy = hole.y;
    let qx = -Infinity;
    let m;

    // find a segment intersected by a ray from the hole's leftmost point to the left;
    // segment's endpoint with lesser x will be potential connection point
    // unless they intersect at a vertex, then choose the vertex
    if (equals(hole, p)) return p;
    do {
        if (equals(hole, p.next)) return p.next;
        else if (hy <= p.y && hy >= p.next.y && p.next.y !== p.y) {
            const x = p.x + (hy - p.y) * (p.next.x - p.x) / (p.next.y - p.y);
            if (x <= hx && x > qx) {
                qx = x;
                m = p.x < p.next.x ? p : p.next;
                if (x === hx) return m; // hole touches outer segment; pick leftmost endpoint
            }
        }
        p = p.next;
    } while (p !== outerNode);

    if (!m) return null;

    // look for points inside the triangle of hole point, segment intersection and endpoint;
    // if there are no points found, we have a valid connection;
    // otherwise choose the point of the minimum angle with the ray as connection point

    const stop = m;
    const mx = m.x;
    const my = m.y;
    let tanMin = Infinity;

    p = m;

    do {
        if (hx >= p.x && p.x >= mx && hx !== p.x &&
                pointInTriangle(hy < my ? hx : qx, hy, mx, my, hy < my ? qx : hx, hy, p.x, p.y)) {

            const tan = Math.abs(hy - p.y) / (hx - p.x); // tangential

            if (locallyInside(p, hole) &&
                (tan < tanMin || (tan === tanMin && (p.x > m.x || (p.x === m.x && sectorContainsSector(m, p)))))) {
                m = p;
                tanMin = tan;
            }
        }

        p = p.next;
    } while (p !== stop);

    return m;
}

// whether sector in vertex m contains sector in vertex p in the same coordinates
function sectorContainsSector(m, p) {
    return area(m.prev, m, p.prev) < 0 && area(p.next, m, m.next) < 0;
}

// interlink polygon nodes in z-order
function indexCurve(start, minX, minY, invSize) {
    let p = start;
    do {
        if (p.z === 0) p.z = zOrder(p.x, p.y, minX, minY, invSize);
        p.prevZ = p.prev;
        p.nextZ = p.next;
        p = p.next;
    } while (p !== start);

    p.prevZ.nextZ = null;
    p.prevZ = null;

    sortLinked(p);
}

// Simon Tatham's linked list merge sort algorithm
// http://www.chiark.greenend.org.uk/~sgtatham/algorithms/listsort.html
function sortLinked(list) {
    let numMerges;
    let inSize = 1;

    do {
        let p = list;
        let e;
        list = null;
        let tail = null;
        numMerges = 0;

        while (p) {
            numMerges++;
            let q = p;
            let pSize = 0;
            for (let i = 0; i < inSize; i++) {
                pSize++;
                q = q.nextZ;
                if (!q) break;
            }
            let qSize = inSize;

            while (pSize > 0 || (qSize > 0 && q)) {

                if (pSize !== 0 && (qSize === 0 || !q || p.z <= q.z)) {
                    e = p;
                    p = p.nextZ;
                    pSize--;
                } else {
                    e = q;
                    q = q.nextZ;
                    qSize--;
                }

                if (tail) tail.nextZ = e;
                else list = e;

                e.prevZ = tail;
                tail = e;
            }

            p = q;
        }

        tail.nextZ = null;
        inSize *= 2;

    } while (numMerges > 1);

    return list;
}

// z-order of a point given coords and inverse of the longer side of data bbox
function zOrder(x, y, minX, minY, invSize) {
    // coords are transformed into non-negative 15-bit integer range
    x = (x - minX) * invSize | 0;
    y = (y - minY) * invSize | 0;

    x = (x | (x << 8)) & 0x00FF00FF;
    x = (x | (x << 4)) & 0x0F0F0F0F;
    x = (x | (x << 2)) & 0x33333333;
    x = (x | (x << 1)) & 0x55555555;

    y = (y | (y << 8)) & 0x00FF00FF;
    y = (y | (y << 4)) & 0x0F0F0F0F;
    y = (y | (y << 2)) & 0x33333333;
    y = (y | (y << 1)) & 0x55555555;

    return x | (y << 1);
}

// find the leftmost node of a polygon ring
function getLeftmost(start) {
    let p = start,
        leftmost = start;
    do {
        if (p.x < leftmost.x || (p.x === leftmost.x && p.y < leftmost.y)) leftmost = p;
        p = p.next;
    } while (p !== start);

    return leftmost;
}

// check if a point lies within a convex triangle
function pointInTriangle(ax, ay, bx, by, cx, cy, px, py) {
    return (cx - px) * (ay - py) >= (ax - px) * (cy - py) &&
           (ax - px) * (by - py) >= (bx - px) * (ay - py) &&
           (bx - px) * (cy - py) >= (cx - px) * (by - py);
}

// check if a point lies within a convex triangle but false if its equal to the first point of the triangle
function pointInTriangleExceptFirst(ax, ay, bx, by, cx, cy, px, py) {
    return !(ax === px && ay === py) && pointInTriangle(ax, ay, bx, by, cx, cy, px, py);
}

// check if a diagonal between two polygon nodes is valid (lies in polygon interior)
function isValidDiagonal(a, b) {
    return a.next.i !== b.i && a.prev.i !== b.i && !intersectsPolygon(a, b) && // doesn't intersect other edges
           (locallyInside(a, b) && locallyInside(b, a) && middleInside(a, b) && // locally visible
            (area(a.prev, a, b.prev) || area(a, b.prev, b)) || // does not create opposite-facing sectors
            equals(a, b) && area(a.prev, a, a.next) > 0 && area(b.prev, b, b.next) > 0); // special zero-length case
}

// signed area of a triangle
function area(p, q, r) {
    return (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
}

// check if two points are equal
function equals(p1, p2) {
    return p1.x === p2.x && p1.y === p2.y;
}

// check if two segments intersect
function intersects(p1, q1, p2, q2) {
    const o1 = sign(area(p1, q1, p2));
    const o2 = sign(area(p1, q1, q2));
    const o3 = sign(area(p2, q2, p1));
    const o4 = sign(area(p2, q2, q1));

    if (o1 !== o2 && o3 !== o4) return true; // general case

    if (o1 === 0 && onSegment(p1, p2, q1)) return true; // p1, q1 and p2 are collinear and p2 lies on p1q1
    if (o2 === 0 && onSegment(p1, q2, q1)) return true; // p1, q1 and q2 are collinear and q2 lies on p1q1
    if (o3 === 0 && onSegment(p2, p1, q2)) return true; // p2, q2 and p1 are collinear and p1 lies on p2q2
    if (o4 === 0 && onSegment(p2, q1, q2)) return true; // p2, q2 and q1 are collinear and q1 lies on p2q2

    return false;
}

// for collinear points p, q, r, check if point q lies on segment pr
function onSegment(p, q, r) {
    return q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) && q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y);
}

function sign(num) {
    return num > 0 ? 1 : num < 0 ? -1 : 0;
}

// check if a polygon diagonal intersects any polygon segments
function intersectsPolygon(a, b) {
    let p = a;
    do {
        if (p.i !== a.i && p.next.i !== a.i && p.i !== b.i && p.next.i !== b.i &&
                intersects(p, p.next, a, b)) return true;
        p = p.next;
    } while (p !== a);

    return false;
}

// check if a polygon diagonal is locally inside the polygon
function locallyInside(a, b) {
    return area(a.prev, a, a.next) < 0 ?
        area(a, b, a.next) >= 0 && area(a, a.prev, b) >= 0 :
        area(a, b, a.prev) < 0 || area(a, a.next, b) < 0;
}

// check if the middle point of a polygon diagonal is inside the polygon
function middleInside(a, b) {
    let p = a;
    let inside = false;
    const px = (a.x + b.x) / 2;
    const py = (a.y + b.y) / 2;
    do {
        if (((p.y > py) !== (p.next.y > py)) && p.next.y !== p.y &&
                (px < (p.next.x - p.x) * (py - p.y) / (p.next.y - p.y) + p.x))
            inside = !inside;
        p = p.next;
    } while (p !== a);

    return inside;
}

// link two polygon vertices with a bridge; if the vertices belong to the same ring, it splits polygon into two;
// if one belongs to the outer ring and another to a hole, it merges it into a single ring
function splitPolygon(a, b) {
    const a2 = createNode(a.i, a.x, a.y),
        b2 = createNode(b.i, b.x, b.y),
        an = a.next,
        bp = b.prev;

    a.next = b;
    b.prev = a;

    a2.next = an;
    an.prev = a2;

    b2.next = a2;
    a2.prev = b2;

    bp.next = b2;
    b2.prev = bp;

    return b2;
}

// create a node and optionally link it with previous one (in a circular doubly linked list)
function insertNode(i, x, y, last) {
    const p = createNode(i, x, y);

    if (!last) {
        p.prev = p;
        p.next = p;

    } else {
        p.next = last.next;
        p.prev = last;
        last.next.prev = p;
        last.next = p;
    }
    return p;
}

function removeNode(p) {
    p.next.prev = p.prev;
    p.prev.next = p.next;

    if (p.prevZ) p.prevZ.nextZ = p.nextZ;
    if (p.nextZ) p.nextZ.prevZ = p.prevZ;
}

function createNode(i, x, y) {
    return {
        i, // vertex index in coordinates array
        x, y, // vertex coordinates
        prev: null, // previous and next vertex nodes in a polygon ring
        next: null,
        z: 0, // z-order curve value
        prevZ: null, // previous and next nodes in z-order
        nextZ: null,
        steiner: false // indicates whether this is a steiner point
    };
}

// return a percentage difference between the polygon area and its triangulation area;
// used to verify correctness of triangulation
function deviation(data, holeIndices, dim, triangles) {
    const hasHoles = holeIndices && holeIndices.length;
    const outerLen = hasHoles ? holeIndices[0] * dim : data.length;

    let polygonArea = Math.abs(signedArea(data, 0, outerLen, dim));
    if (hasHoles) {
        for (let i = 0, len = holeIndices.length; i < len; i++) {
            const start = holeIndices[i] * dim;
            const end = i < len - 1 ? holeIndices[i + 1] * dim : data.length;
            polygonArea -= Math.abs(signedArea(data, start, end, dim));
        }
    }

    let trianglesArea = 0;
    for (let i = 0; i < triangles.length; i += 3) {
        const a = triangles[i] * dim;
        const b = triangles[i + 1] * dim;
        const c = triangles[i + 2] * dim;
        trianglesArea += Math.abs(
            (data[a] - data[c]) * (data[b + 1] - data[a + 1]) -
            (data[a] - data[b]) * (data[c + 1] - data[a + 1]));
    }

    return polygonArea === 0 && trianglesArea === 0 ? 0 :
        Math.abs((trianglesArea - polygonArea) / polygonArea);
}

function signedArea(data, start, end, dim) {
    let sum = 0;
    for (let i = start, j = end - dim; i < end; i += dim) {
        sum += (data[j] - data[i]) * (data[i + 1] + data[j + 1]);
        j = i;
    }
    return sum;
}

// turn a polygon in a multi-dimensional array form (e.g. as in GeoJSON) into a form Earcut accepts
function flatten(data) {
    const vertices = [];
    const holes = [];
    const dimensions = data[0][0].length;
    let holeIndex = 0;
    let prevLen = 0;

    for (const ring of data) {
        for (const p of ring) {
            for (let d = 0; d < dimensions; d++) vertices.push(p[d]);
        }
        if (prevLen) {
            holeIndex += prevLen;
            holes.push(holeIndex);
        }
        prevLen = ring.length;
    }
    return {vertices, holes, dimensions};
}

})(globalThis.RADE=globalThis.RADE||{});
