/* EMPRISE — Notre-Dame de la Garde, original procedural interpretation.
   Position/axis: OSM way69137913, tower1324841042, statue node14174893857.
   Photographic references and dimensional uncertainties: docs/LANDMARKS.md.
   No imported mesh, texture, image, DEM or encoded model. */
(function(R){'use strict';
const center={x:-175.4748537925,z:1361.4844574361,lat:43.28394525,lon:5.3712376},angle=.726,groundLevel=154,rx=330,rz=390,step=10,c=Math.cos(angle),s=Math.sin(angle),smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};let shared=null;
function create(){if(shared)return shared;const geometry=[],terrain=[],lights=[],co=BITUME.voiture,white=[.80,.77,.66],dark=[.34,.38,.37],stone=[.60,.57,.47],gold=[.89,.63,.19],window=[.060,.075,.085],roof=[.41,.45,.43],frame=co.euler(0,-angle,0),maxX=66,maxZ=78,heights=new Float32Array((maxX+1)*(maxZ+1));
 function local(x,z){const dx=x-center.x,dz=z-center.z;return [dx*c+dz*s,-dx*s+dz*c];}
 function at(x,y,z){return [center.x+x*c-z*s,groundLevel+y,center.z+x*s+z*c];}
 function hill(x,z){const d=Math.hypot((x-center.x)/rx,(z-center.z)/rz);if(d>=.95)return .08;const t=(d-.125)/.825;return .08+(groundLevel-.08)*(1-smooth(t));}
 for(let z=0;z<=maxZ;z++)for(let x=0;x<=maxX;x++)heights[z*(maxX+1)+x]=hill(center.x-rx+x*step,center.z-rz+z*step);
 function groundHeight(x,z){if(!Number.isFinite(x)||!Number.isFinite(z)||Math.hypot((x-center.x)/rx,(z-center.z)/rz)>=1)return null;const gx=(x-center.x+rx)/step,gz=(z-center.z+rz)/step,ix=Math.min(maxX-1,Math.max(0,Math.floor(gx))),iz=Math.min(maxZ-1,Math.max(0,Math.floor(gz))),u=gx-ix,v=gz-iz,a=heights[iz*(maxX+1)+ix],b=heights[iz*(maxX+1)+ix+1],d=heights[(iz+1)*(maxX+1)+ix],e=heights[(iz+1)*(maxX+1)+ix+1];return u+v<=1?a+(b-a)*u+(d-a)*v:e+(d-e)*(1-u)+(b-e)*(1-v);}
 function shape(name,triangles,color,extra={}){const normalized=BITUME.carene.normaliser(triangles),id='emprise-bonne-mere-'+name;FRender.forme(id,normalized.triangles);return {shape:id,p:normalized.centre,s:normalized.taille,color,mat:3,outdoor:true,landmark:true,...extra};}
 function triangle(a,b,d){const u=b.map((v,i)=>v-a[i]),v=d.map((v,i)=>v-a[i]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],length=Math.hypot(...n)||1;return [a,b,d,...Array(3).fill(n.map(v=>v/length))];}
 const groups=[[],[],[]];for(let z=0;z<maxZ;z++)for(let x=0;x<maxX;x++){const px=center.x-rx+x*step,pz=center.z-rz+z*step,distance=Math.hypot((px+step/2-center.x)/rx,(pz+step/2-center.z)/rz);if(distance>1.025)continue;const p=(dx,dz)=>[px+dx*step,heights[(z+dz)*(maxX+1)+x+dx],pz+dz*step],a=p(0,0),b=p(1,0),d=p(0,1),e=p(1,1),group=groups[distance<.20?0:distance<.49?1:2];group.push(triangle(a,d,b),triangle(e,b,d));}
 groups.forEach((ts,i)=>terrain.push(shape('hill-'+i,ts,[[.59,.57,.47],[.40,.43,.32],[.29,.37,.27]][i],{terrain:true,collision:false,ground:true})));geometry.push(...terrain);
 function put(kind,x,y,z,size,color=white,mat=3,rotation=[0,0,0],extra={}){const m={shape:kind,p:at(x,y,z),s:size,r:co.angles(co.mulM(frame,co.euler(...rotation))),color,mat,outdoor:true,landmark:true,building:'notre-dame-de-la-garde',collision:true,...extra};geometry.push(m);return m;}
 const box=(x,y,z,size,color=white,extra={})=>put('box',x,y,z,size,color,3,[0,0,0],extra);
 const sphere=(x,y,z,size,color=white,extra={})=>put('sphere',x,y,z,size,color,3,[0,0,0],{collision:false,...extra});
 function bar(a,b,width,color=white,extra={}){const d=b.map((v,i)=>v-a[i]),length=Math.hypot(...d);if(length<.001)return;return put('cylinder',...(a.map((v,i)=>(v+b[i])/2)),[width,length,width],color,3,[Math.acos(d[1]/length),Math.atan2(d[0],d[2]),0],{collision:false,...extra});}
 function banded(x,z,width,depth,y0,height,band=.8){for(let y=0;y<height-.001;y+=band){const h=Math.min(band,height-y);box(x,y0+y+h/2,z,[width,h,depth],Math.round(y/band)%2?dark:white);}}
 function arch(x,y,z,width,height,front=false){const r=width/2,straight=height-r,turn=front?Math.PI/2:0,M=co.euler(0,turn,0),pos=(u,v,w=0)=>{const q=co.mul(M,[u,v,w]);return [x+q[0],y+q[1],z+q[2]];};
  put('box',...pos(0,straight/2),[width,straight,.13],window,3,[0,turn,0],{collision:false});put('sphere',...pos(0,straight),[width,width,.13],window,3,[0,turn,0],{collision:false});
  for(const side of [-1,1])put('box',...pos(side*(r+.19),straight/2),[.38,straight+.20,.28],white,3,[0,turn,0],{collision:false});
  for(let j=0;j<12;j++){const a=(j+.5)*Math.PI/12,rot=co.angles(co.mulM(M,co.euler(0,0,a+Math.PI/2)));put('box',...pos(Math.cos(a)*(r+.20),straight+Math.sin(a)*(r+.20)),[(r+.2)*Math.PI/12+.06,.42,.30],j%2?dark:white,3,rot,{collision:false});}
  put('box',...pos(0,straight*.55,-.08),[.12,straight*1.1,.16],stone,3,[0,turn,0],{collision:false});
 }
 // Existing fort, terrace and crypt support the basilica; the shape is a plan
 // interpretation, not a claim to reproduce inaccessible rooms or surveyed CAD.
 box(0,-1.7,0,[63,3.6,33],stone);box(0,.2,0,[61,.30,31],white,{collision:false});
 for(const z of [-15.3,15.3]){box(0,1.0,z,[61,1.2,.50],stone);box(0,1.65,z,[62,.27,.72],white);for(let x=-29;x<=29;x+=3.1)box(x,1.05,z,[.28,1.1,.52],white,{collision:false});}
 banded(0,0,52,18,0,6,1.05);box(0,6.15,0,[53,.40,19],white);banded(2,0,37,16,6.35,12.6,.85);box(2,19.15,0,[38,.40,17],white);
 for(const z of [-8.1,8.1])for(const x of [-11,-5,1,7,13])arch(x,9.6,z+(z>0?.10:-.10),2.15,6.7);
 for(const z of [-8.8,8.8])for(const x of [-15.7,-8.5,-1,6.5,14,20]){box(x,12.7,z,[.75,12.5,.85],white);box(x,19.25,z,[1.1,.35,1.1],white);}
 for(const side of [-1,1])put('box',2,20.55,side*4.1,[38,.45,8.7],roof,3,[side*.22,0,0]);
 // Three cupolas, dark stone drums and radial ribs read at harbour distance.
 for(const [x,radius]of [[-7,3.3],[2,3.3],[13.5,5.1]]){
  put('cylinder',x,20.8,0,[radius*2,3.1,radius*2],white);for(let k=0;k<8;k++){const a=k*Math.PI/4;put('box',x+Math.cos(a)*radius*.88,20.8,Math.sin(a)*radius*.88,[.55,2.9,.65],dark,3,[0,-a,0],{collision:false});}
  sphere(x,22.4,0,[radius*2.12,radius*1.65,radius*2.12],roof);for(let k=0;k<12;k++){const a=k*Math.PI/6;let last=[x+Math.cos(a)*radius,22.4,Math.sin(a)*radius];for(let j=1;j<=5;j++){const t=j*Math.PI/10,next=[x+Math.cos(a)*radius*Math.cos(t),22.4+radius*.825*Math.sin(t),Math.sin(a)*radius*Math.cos(t)];bar(last,next,.15,white);last=next;}}sphere(x,22.4+radius*.825+.40,0,[.55,.8,.55],white);}
 // The tower centre and statue are anchored to the OSM statue node.
 const tx=-23.5206699705,tz=-.3861332545;banded(tx,tz,9.2,9.2,0,29,.90);box(tx,29.15,tz,[10.3,.65,10.3],white);
 for(const side of [-1,1]){arch(tx+side*4.66,7,tz,3.2,7.1,true);arch(tx+side*4.66,19,tz,3.0,6.5,true);arch(tx,7,tz+side*4.66,3.2,7.1);arch(tx,19,tz+side*4.66,3.0,6.5);}
 banded(tx,tz,8.7,8.7,29.5,10.3,.85);for(const side of [-1,1]){arch(tx+side*4.42,31,tz,4.7,6.4,true);arch(tx,31,tz+side*4.42,4.7,6.4);}
 box(tx,40.4,tz,[10.8,1.1,10.8],white);box(tx,41.05,tz,[11.3,.22,11.3],white);
 for(const z of [-5,5])box(tx,41.8,tz+z,[10.4,1.1,.30],white,{collision:false});for(const x of [-5,5])box(tx+x,41.8,tz,[.30,1.1,10.4],white,{collision:false});
 put('cylinder',tx,43,tz,[7.7,3.4,7.7],white);put('cylinder',tx,47.7,tz,[5.8,6.1,5.8],dark);for(let k=0;k<12;k++){const a=k*Math.PI/6,x=tx+Math.cos(a)*3.25,z=tz+Math.sin(a)*3.25;put('cylinder',x,47.8,z,[.45,6.3,.45],[.65,.52,.43]);sphere(x,50.95,z,[.85,.55,.85],white);}
 put('cylinder',tx,51.4,tz,[8.2,.95,8.2],white);put('cylinder',tx,52.4,tz,[6.5,1.2,6.5],stone);put('cylinder',tx,53.2,tz,[5.0,.6,5.0],white);
 // Four small trumpet-bearing angels on the belfry terrace.
 for(const sx of [-1,1])for(const sz of [-1,1]){const x=tx+sx*4.5,z=tz+sz*4.5;box(x,41.8,z,[1.1,1.4,1.1],white);sphere(x,43,z,[.9,1.6,.8],white);sphere(x,44,z,[.58,.65,.58],white);put('sphere',x+.28,43.2,z,[.40,1.8,1.5],white,3,[.25,0,.35],{collision:false});bar([x-.25,43.55,z],[x-.9,44.3,z],.16,white);bar([x-.9,44.3,z],[x-1.9,44.8,z],.14,white);}
 // Original lofted robe: an unmistakable draped silhouette, no borrowed human mesh.
 const robe=[],rings=12,sides=20,base=53.5;for(let y=0;y<rings;y++)for(let j=0;j<sides;j++){
  const vertex=(iy,k)=>{const t=iy/rings,a=k*Math.PI*2/sides,r=(1.70-.83*t)*(1+.10*Math.cos(a*7+t*1.5));return at(tx+Math.cos(a)*r*(.76+.10*t),base+t*8.6,tz+Math.sin(a)*r);};const a=vertex(y,j),b=vertex(y,j+1),d=vertex(y+1,j),e=vertex(y+1,j+1);robe.push(triangle(a,b,d),triangle(e,d,b));}
 geometry.push(shape('robe',robe,gold,{collision:false,material:'metal',mat:0,emissive:.10}));
 const golden=(x,y,z,size)=>put('sphere',tx+x,base+y,tz+z,size,gold,0,[0,0,0],{collision:false,emissive:.10});
 golden(-.10,8.15,0,[2.5,1.6,2.9]);golden(-.18,9.55,0,[1.13,1.55,1.23]);golden(-.72,9.50,0,[.34,.40,.33]);golden(.15,9.34,0,[1.05,1.55,1.43]);
 put('cylinder',tx-.18,base+10.38,tz,[1.45,.35,1.45],gold,0,[0,0,0],{collision:false,emissive:.12});for(let k=0;k<8;k++){const a=k*Math.PI/4;bar([tx-.18+Math.cos(a)*.62,base+10.46,tz+Math.sin(a)*.62],[tx-.18+Math.cos(a)*.72,base+11.05,tz+Math.sin(a)*.72],.14,gold,{mat:0,emissive:.12});}golden(-.18,11.1,0,[.22,.20,.22]);
 for(const [a,b,width]of [[[.05,8.2,1.1],[-.95,7.7,.45],.60],[[-.95,7.7,.45],[-1.15,8.0,-1.0],.47],[[.05,8.1,-1.1],[-.25,6.95,-1.7],.58],[[-.25,6.95,-1.7],[-.95,7.2,-1.65],.42]])bar([tx+a[0],base+a[1],tz+a[2]],[tx+b[0],base+b[1],tz+b[2]],width,gold,{mat:0,emissive:.10});
 golden(-.53,8.43,-1.55,[1.12,2.1,1.2]);golden(-.60,9.8,-1.53,[.94,1.05,.97]);golden(-1.05,9.76,-1.52,[.23,.25,.20]);bar([tx-.5,base+8.9,tz-2.0],[tx-.67,base+9.85,tz-2.45],.30,gold,{mat:0,emissive:.1});bar([tx-.67,base+9.85,tz-2.45],[tx-.88,base+10.62,tz-2.42],.28,gold,{mat:0,emissive:.1});golden(-.88,10.68,-2.42,[.40,.47,.36]);
 for(const z of [-1.2,-1.9]){bar([tx-.5,base+7.8,tz+z],[tx-1.2,base+7.15,tz+z],.40,gold,{mat:0,emissive:.1});golden(-1.34,6.95,z,[.65,.40,.42]);}
 for(const [x,y,z,power,range]of [[tx-10,24,tz,440,32],[tx+10,31,tz,440,32],[tx,29,tz-10,440,32],[tx,29,tz+10,440,32],[tx-4,59,tz-4,180,19],[tx+4,59,tz+4,180,19],[2,18,-14,380,30],[10,18,14,380,30]])lights.push({p:at(x,y,z),color:[1,.72,.37],power,range,landmark:true});
 // The renderer budgets local point lights around the camera. These bounded,
 // opaque surface copies represent facade floodlighting at harbour distance;
 // they are disabled in daylight and do not add another collision envelope.
 const nightShells=geometry.filter(m=>m.material==='metal'||m.emissive>0||m.shape==='box'&&m.s[0]>7&&m.s[2]>7&&m.s[1]<1.2&&m.p[1]>groundLevel+6).map(m=>{
  // A proportional 0.1% inflation leaves thin cornices less than a millimetre
  // apart, below the world depth precision. Use a physical separation instead;
  // keep small gold details within a restrained fraction of their diameter.
  const offset=m.mat===0?Math.min(.04,Math.min(...m.s)*.12):.04;return {...m,s:m.s.map(v=>v+offset*2),color:m.color.map((v,i)=>v*[1,.90,.70][i]),emissive:0,collision:false,nightFacade:true,nightSource:m,nightOffset:offset};
 });
 let liveGeometry=null,visibleNightShells=nightShells;
 const fullPower=lights.map(l=>l.power),featuresList=['OSM-position','striped-masonry','fort-terrace','crypt','nave','arched-windows','three-cupolas','bell-tower','columned-campanile','four-angels','golden-mother-and-child','night-floodlights','procedural-hill'];
 // Clip the actual footprint against the rotated monument core. A centroid
 // test misses long wings crossing the basilica; bounding-box overlap alone
 // would erase unrelated neighbouring buildings. Courtyard holes stay holes.
 function excludes(b){
  const bounds=b?.bounds,points=Array.isArray(b?.points)&&b.points.length>=3?b.points:Array.isArray(bounds)&&bounds.length===4?[[bounds[0],bounds[1]],[bounds[2],bounds[1]],[bounds[2],bounds[3]],[bounds[0],bounds[3]]]:null;if(!points)return false;
  const ex=Math.abs(c)*32+Math.abs(s)*19,ez=Math.abs(s)*32+Math.abs(c)*19;
  if(Array.isArray(bounds)&&(bounds[2]<center.x-ex||bounds[0]>center.x+ex||bounds[3]<center.z-ez||bounds[1]>center.z+ez))return false;
  function overlapArea(ring){let polygon=ring.map(p=>local(p[0],p[1]));if(polygon.some(p=>!p.every(Number.isFinite)))return 0;
   for(const [axis,edge,greater]of [[0,-32,true],[0,32,false],[1,-19,true],[1,19,false]]){const clipped=[];for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length],inside=p=>greater?p[axis]>=edge:p[axis]<=edge,ia=inside(a),ib=inside(b);if(ia)clipped.push(a);if(ia!==ib){const t=(edge-a[axis])/(b[axis]-a[axis]);clipped.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}}polygon=clipped;if(polygon.length<3)return 0;}
   let area=0;for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length];area+=a[0]*b[1]-b[0]*a[1];}return Math.abs(area)/2;
  }
  const outer=overlapArea(points);if(outer<.0001)return false;return outer-(b.holes||[]).reduce((n,ring)=>n+overlapArea(ring),0)>.0001;
 }

 shared={geometry,terrain,groundHeight,excludes,contains:(x,z)=>groundHeight(x,z)!==null,center:{...center},footprint:{x:center.x,z:center.z,width:64,depth:38,angle},features:featuresList,statue:{lat:43.2840884,lon:5.3710240,position:at(tx,64.7,tz),sourceUrl:'https://www.openstreetmap.org/node/14174893857'},height:64.7,groundLevel,bounds:{minX:center.x-rx,maxX:center.x+rx,minZ:center.z-rz,maxZ:center.z+rz},nightGeometry(night,liveScenery){night=Math.max(0,Math.min(1,Number(night)||0));if(night<.005)return [];if(Array.isArray(liveScenery)&&liveScenery!==liveGeometry){liveGeometry=liveScenery;const living=new Set(liveScenery);visibleNightShells=nightShells.filter(m=>living.has(m.nightSource));}visibleNightShells.forEach(m=>{m.emissive=.42*night;});return visibleNightShells;},lights(environment){const night=Math.max(0,Math.min(1,Number(environment?.night)||0));if(night<.005)return [];lights.forEach((l,i)=>{l.power=fullPower[i]*night;});return lights;},provenance:{geometry:'original-procedural-runtime',importedAssets:0,footprintSource:'https://www.openstreetmap.org/way/69137913',towerSource:'https://www.openstreetmap.org/way/1324841042',heightSource:'https://www.openstreetmap.org/way/1558275296',terrain:'Procedural approximation; no measured DEM',reference:'https://basiliquenotredamedelagarde.com/notre-histoire'}};return shared;
}
R.landmarks={create};
})(globalThis.RADE=globalThis.RADE||{});
