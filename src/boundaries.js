/* Visible perimeter: anchored worksite fencing, police roadblocks and floating booms. */
(function(R){'use strict';
function external(world){const b=world.bounds,gates=[],booms=[],officers=[],step=28;
 const put=(p,s,color)=>world.addMesh({shape:'box',p,s,color,mat:7,boundary:true,collision:true,outdoor:true});
 for(let side=0;side<4;side++){const vertical=side<2,fixed=side===0?b.minX+7:side===1?b.maxX-7:side===2?b.minZ+7:b.maxZ-7,lo=vertical?b.minZ+7:b.minX+7,hi=vertical?b.maxZ-7:b.maxX-7,n=Math.ceil((hi-lo)/step),length=(hi-lo)/n;
  for(let i=0;i<n;i++){const t=lo+(i+.5)*length,x=vertical?fixed:t,z=vertical?t:fixed;if(world.water(x,z)){world.marineBuoys.push({x,z,boundary:true});continue;}const y=world.ground(x,z);put([x,y+.48,z],vertical?[.48,.96,length+.1]:[length+.1,.96,.48],[.30,.34,.34]);put([x,y+1.8,z],vertical?[.05,.07,length]:[length,.07,.05],[.36,.4,.41]);for(const v of [-length/2,0,length/2])put([x+(vertical?0:v),y+1.1,z+(vertical?v:0)],[.1,2.2,.1],[.36,.4,.41]);if(i%5===0)gates.push({x,z,nx:side===0?1:side===1?-1:0,nz:side===2?1:side===3?-1:0});}
 }
 world.boundaryOfficers=officers;return {gates,officers,booms,inset:7};}
function add(world){if(world.expanded)return external(world);const b=world.bounds,officers=[],gates=[],booms=[],B=[.07,.16,.28],metal=[.36,.40,.41],stone=[.48,.48,.43];
 const put=(shape,p,s,color,cap=0,solid=true)=>{const m={shape,p,s,color,mat:7,r:[0,-cap,0],boundary:true};if(solid)world.addMesh(m);else world.scenery.push(m);return m;};
 const text=(label,x,y,z,cap)=>{const glyphs={P:['110','101','110','100','100'],O:['111','101','101','101','111'],L:['100','100','100','100','111'],I:['111','010','010','010','111'],C:['111','100','100','100','111'],E:['111','100','110','100','111']},c=Math.cos(cap),s=Math.sin(cap),step=.13;for(let j=0;j<label.length;j++)for(let yy=0;yy<5;yy++)for(let xx=0;xx<3;xx++)if(glyphs[label[j]][yy][xx]==='1'){const u=(j*4+xx-label.length*2)*step;put('box',[x+u*c,y+(2-yy)*step,z+u*s],[step*.8,step*.8,.025],[.85,.87,.84],cap,false);}};
 for(const side of [0,1,2,3]){const vertical=side<2,fixed=side===0?b.minX+5:side===1?b.maxX-5:side===2?b.minZ+5:b.maxZ-5,lo=vertical?b.minZ+5:b.minX+5,hi=vertical?b.maxZ-5:b.maxX-5,cap=vertical?Math.PI/2:0,n=Math.ceil((hi-lo)/5.8),step=(hi-lo)/n;
  for(let i=0;i<n;i++){const u=lo+(i+.5)*step,x=vertical?fixed:u,z=vertical?u:fixed,water=world.water(x,z),road=world.city.surChaussee(x,z),at=(a,y,d=0)=>[x+a*Math.cos(cap)-d*Math.sin(cap),y,z+a*Math.sin(cap)+d*Math.cos(cap)];
   if(water){booms.push({x,z,cap,length:step});put('cylinder',at(0,.06),[.28,step+.1,.28],[.89,.39,.08],cap,false).r=vertical?[Math.PI/2,0,0]:[0,0,Math.PI/2];for(const a of [-step/2,step/2]){put('sphere',at(a,.10),[.55,.55,.55],[.89,.39,.08],cap,false);put('cylinder',at(a,.65),[.06,1,.06],metal,cap,false);}continue;}
   // Full curb + closely spaced bars: visible geometry occupies the collision boundary.
   put('box',at(0,.22),[step+.15,.42,.62],stone,cap);for(const a of [-step/2,step/2])put('box',at(a,1.28),[.09,2.5,.09],metal,cap);
   for(const y of [.55,1.35,2.4])put('box',at(0,y),[step+.1,.045,.045],metal,cap);for(let a=-step/2+.2;a<step/2;a+=.24)put('box',at(a,1.48),[.025,1.9,.025],metal,cap);
   if(road&&!gates.some(g=>Math.hypot(g.x-x,g.z-z)<18)){const nx=side===0?1:side===1?-1:0,nz=side===2?1:side===3?-1:0;gates.push({x,z,nx,nz});put('box',at(0,1.42,.12),[3.5,.9,.09],B,cap,false);text('POLICE',...at(0,1.42,.18),cap);
    for(const a of [-1.5,1.5]){const q=at(a,.08,side===0||side===3?-2:2);const spot=world.freeNear(q[0]+nx,q[2]+nz,.3);if(Math.abs(spot[0])<b.maxX-7&&Math.abs(spot[1])<b.maxZ-7)officers.push({id:17000+officers.length,x:spot[0],z:spot[1],yaw:Math.atan2(-nx,nz),baseY:.08,hp:100,civil:true,police:true,renderBody:true});}
   }
  }
 }
 world.boundaryOfficers=officers;return {gates,officers,booms,inset:5};
}
R.boundaries={add};})(globalThis.RADE);
