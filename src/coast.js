/* EMPRISE — OSM shoreline vectors; original procedural relief, no measured DEM.
   Land and navigation use the same rings. All meshes are generated from code. */
(function(R){'use strict';let shared=null;
function create(){if(shared)return shared;const data=R.coastData;if(!data)throw Error('Missing coastline geographic data');const bounds={...data.meta.bounds},geometry=[],buoys=[],shoreCells=new Set(),waterCache=new Map(),ringCells=new Map(),heightCells=new Map(),cellSize=25;
 const key=(x,z,n)=>Math.floor(x/n)+','+Math.floor(z/n),pointIn=(ring,x,z)=>{let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;};
 const polygons=data.land.map(p=>{const all=p.outer,minX=Math.min(...all.map(q=>q[0])),maxX=Math.max(...all.map(q=>q[0])),minZ=Math.min(...all.map(q=>q[1])),maxZ=Math.max(...all.map(q=>q[1]));return {...p,minX,maxX,minZ,maxZ};});
 polygons.forEach((p,i)=>{for(let x=Math.floor(p.minX/480);x<=Math.floor(p.maxX/480);x++)for(let z=Math.floor(p.minZ/480);z<=Math.floor(p.maxZ/480);z++){const k=x+','+z;if(!ringCells.has(k))ringCells.set(k,[]);ringCells.get(k).push(i);}for(const ring of [p.outer,...p.holes])for(let j=1;j<ring.length;j++){const a=ring[j-1],b=ring[j];for(let x=Math.floor(Math.min(a[0],b[0])/cellSize);x<=Math.floor(Math.max(a[0],b[0])/cellSize);x++)for(let z=Math.floor(Math.min(a[1],b[1])/cellSize);z<=Math.floor(Math.max(a[1],b[1])/cellSize);z++)shoreCells.add(x+','+z);}});
 const land=(x,z)=>{for(const id of ringCells.get(key(x,z,480))||[]){const p=polygons[id];if(x<p.minX||x>p.maxX||z<p.minZ||z>p.maxZ)continue;if(pointIn(p.outer,x,z)&&!p.holes.some(h=>pointIn(h,x,z)))return true;}return false;};
 function water(x,z){if(!Number.isFinite(x)||!Number.isFinite(z))return null;if(x<bounds.minX||x>bounds.maxX||z<bounds.minZ||z>bounds.maxZ)return null;const k=key(x,z,cellSize);if(shoreCells.has(k))return !land(x,z);if(waterCache.has(k))return waterCache.get(k);const value=!land(x,z);if(waterCache.size>=32768)waterCache.clear();waterCache.set(k,value);return value;}
 // Relief is deliberately a procedural interpretation. The measured OSM contour
 // stays fixed; no claim is made about summit heights or navigational soundings.
 function relief(x,z,d){if(z<6000&&x>-1700)return .08;const offshore=x<-1700&&z<6500,islet=z>10500&&x<4200,calanques=z>6500,scale=offshore?.25:islet?.38:calanques?.62:.22,max=offshore?85:islet?190:calanques?360:150,ridge=.65+.20*Math.sin(x*.003+z*.0016)+.15*Math.cos(z*.005-x*.001),grain=Math.sin(x*.021+z*.013)*Math.sin(z*.017-x*.009);return .35+Math.min(max,d*scale)*ridge+Math.min(4,d*.02)*grain;}
 for(let ci=0;ci<data.chunks.length;ci++){const c=data.chunks[ci],points=c.v.map(([x,z,d])=>[x,relief(x,z,d),z]),triangles=[];
  for(const ids of c.t){let a=points[ids[0]],b=points[ids[1]],d=points[ids[2]],u=b.map((v,i)=>v-a[i]),v=d.map((v,i)=>v-a[i]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];if(n[1]<0){[b,d]=[d,b];n=n.map(v=>-v);}const len=Math.hypot(...n);if(len<1e-6)continue;n=n.map(v=>v/len);triangles.push([a,b,d,n,n,n]);}
  if(!triangles.length)continue;const m=BITUME.carene.normaliser(triangles),shape='emprise-coast-'+ci;FRender.forme(shape,m.triangles);const coastal=c.v.some(v=>v[2]<90),south=m.centre[2]>6000;
  geometry.push({shape,p:m.centre,s:m.taille,mat:3,color:south?[.61,.59,.49]:coastal?[.56,.55,.44]:[.34,.40,.28],terrain:true,outdoor:true,coast:true,collision:false});heightCells.set(c.cell.join(','),{points,triangles:c.t});
 }
 function heightAt(x,z){if(water(x,z))return -.04;const c=heightCells.get(key(x,z,480));if(!c)return .35;for(const t of c.triangles){const a=c.points[t[0]],b=c.points[t[1]],d=c.points[t[2]],den=(b[2]-d[2])*(a[0]-d[0])+(d[0]-b[0])*(a[2]-d[2]);if(Math.abs(den)<1e-9)continue;const u=((b[2]-d[2])*(x-d[0])+(d[0]-b[0])*(z-d[2]))/den,v=((d[2]-a[2])*(x-d[0])+(a[0]-d[0])*(z-d[2]))/den,w=1-u-v;if(u>=-1e-5&&v>=-1e-5&&w>=-1e-5)return a[1]*u+b[1]*v+d[1]*w;}return .35;}
 // Visible yellow boundary buoys sit just inside the finite navigable envelope.
 const add=(x,z)=>{if(water(x,z))buoys.push({x,z,boundary:true});};
 for(let x=bounds.minX+12;x<bounds.maxX-12;x+=60){add(x,bounds.minZ+12);add(x,bounds.maxZ-12);}for(let z=bounds.minZ+12;z<bounds.maxZ-12;z+=60){add(bounds.minX+12,z);add(bounds.maxX-12,z);}
 shared={bounds,water,heightAt,geometry,buoys,places:data.places,meta:data.meta,stats:{chunks:geometry.length,triangles:data.meta.triangles,polygons:polygons.length,buoys:buoys.length}};return shared;
}
R.coast={create};})(globalThis.RADE=globalThis.RADE||{});
