/* RADE — one address per urban building; furnished, streamed interiors and stairs. */
(function(R){'use strict';
const C=1000,types=['logement','hotel','public','bureau','commerce','supermarche','garage'],names={logement:'Résidence',hotel:'Hôtel',public:'Maison publique',bureau:'Bureaux',commerce:'Commerce',supermarche:'Grande surface',garage:'Garage'},colors={logement:[.27,.40,.36],hotel:[.54,.20,.16],public:[.19,.34,.52],bureau:[.27,.32,.38],commerce:[.16,.44,.35],supermarche:[.62,.39,.12],garage:[.30,.34,.42]};
const font={A:['010','101','111','101','101'],B:['110','101','110','101','110'],C:['011','100','100','100','011'],E:['111','100','110','100','111'],G:['011','100','101','101','011'],H:['101','101','111','101','101'],I:['111','010','010','010','111'],L:['100','100','100','100','111'],M:['101','111','111','101','101'],O:['010','101','101','101','010'],P:['110','101','110','100','100'],R:['110','101','110','101','101'],S:['011','100','010','001','110'],T:['111','010','010','010','010'],U:['101','101','101','101','111'],V:['101','101','101','101','010'],'0':['111','101','101','101','111'],'1':['010','110','010','010','111'],'2':['110','001','010','100','111'],'3':['110','001','010','001','110'],'4':['101','101','111','001','001'],'5':['111','100','110','001','110'],'6':['011','100','111','101','111'],'7':['111','001','010','010','010'],'8':['111','101','111','101','111'],'9':['111','101','111','001','110']};
function lettering(text,at,box,scale=.045,color=[.90,.89,.78]){const w=text.length*4-1;for(let j=0;j<text.length;j++)for(let y=0;y<5;y++)for(let x=0;x<3;x++)if((font[text[j]]||font.I)[y][x]==='1')box(...at((j*4+x-w/2)*scale,(2-y)*scale),[scale*.85,scale*.85,.012],color,7);}
function catalog(world){const entries=[];let shared=0;const {city}=world;
 for(const b of city.batiments||[]){const boxes=b.boites.filter(q=>Math.abs(q.x)<322&&Math.abs(q.z)<322);if(!boxes.length)continue;let best=null,score=Infinity;
  for(const q of boxes){const c=Math.cos(-q.lacet),s=Math.sin(-q.lacet);for(const [nx,nz,w,edge]of [[-s,c,q.lx,q.lz/2],[s,-c,q.lx,q.lz/2],[c,s,q.lz,q.lx/2],[-c,-s,q.lz,q.lx/2]])for(const u of [0,-.3,.3,-.42,.42]){
   const tx=nz,tz=-nx,dx=q.x+nx*edge+tx*w*u,dz=q.z+nz*edge+tz*w*u;
   for(const gap of [.85,1.3,2]){const x=dx+nx*gap,z=dz+nz*gap;if(world.blocked(x,z,.38)||entries.some(b=>Math.hypot(b.x-x,b.z-z)<.8))continue;const sc=gap+Math.abs(u)*2+(city.surChaussee(x,z)?3:0);if(sc<score){score=sc;best={x,z,dx:dx+nx*.24,dz:dz+nz*.24,nx,nz};}break;}
  }}
  const center=boxes.reduce((v,q)=>[v[0]+q.x/boxes.length,v[1]+q.z/boxes.length],[0,0]);
  if(!best){outer:for(let d=1;d<70;d+=1)for(let j=0;j<48;j++){const a=j*Math.PI/24,x=center[0]+Math.cos(a)*d,z=center[1]+Math.sin(a)*d;if(world.blocked(x,z,.45)||city.surChaussee(x,z)||entries.some(b=>Math.hypot(b.x-x,b.z-z)<.8))continue;best={x,z,dx:x,dz:z,nx:Math.sin(a),nz:-Math.cos(a),passage:true};shared++;break outer;}}
  if(!best)throw Error('Bâtiment sans accès : '+b.id);
  const index=entries.length,area=boxes.reduce((v,q)=>v+q.lx*q.lz,0),type=b.public?'public':area>260&&index%3===0?'supermarche':types[index%types.length],id='building-'+b.id,shop=['commerce','supermarche','garage'].includes(type)||(type==='logement'&&index%3===0)||type==='hotel';
  const entry={id,index,type,name:names[type]+' '+(index+1),area,boxes,h:b.h,floors:Math.max(1,Math.min(10,Math.floor(b.h/3.1))),shop,...best};entries.push(entry);
  const tx=best.nz,tz=-best.nx,cap=Math.atan2(tz,tx),at=(u,y,d=.03)=>[best.dx+tx*u+best.nx*d,y,best.dz+tz*u+best.nz*d];
  const box=(u,y,d,size,color,mat=3)=>world.scenery.push({shape:'box',p:at(u,y,d),s:size,r:[0,-cap,0],mat,color,outdoor:true,building:id});
  if(!best.passage){box(0,1.25,0,[1.4,2.5,.075],[.11,.16,.15]);box(0,1.25,.05,[1.18,2.3,.055],colors[type],7);for(const u of [-.66,.66])box(u,1.25,.10,[.10,2.6,.11],[.73,.69,.58]);box(.42,1.1,.12,[.035,.21,.06],[.71,.63,.40],0);box(0,2.62,.08,[1.6,.28,.08],colors[type],7);
   if(shop)box(0,2.96,.34,[3.2,.12,.8],colors[type],7);
  }else{box(0,1.35,0,[.10,2.7,.10],[.24,.27,.25]);box(0,2.2,.02,[1.6,.75,.10],colors[type],7);}
  lettering(String(index+1),(u,v)=>[u,(best.passage?2.2:2.62)+v,.14],box,.037);
 }
 return {entries,shared};
}
function roomFor(b,floor,world){const w=b.type==='supermarche'?24:b.type==='public'?20:b.type==='garage'?18:16,d=b.type==='supermarche'?26:20,scenery=[],colliders=[],ceiling=3.55,lights=[],civil=[];
 const box=(x,y,z,size,color=[.73,.70,.61],mat=3,solid=true)=>{const m={shape:'box',p:[C+x,y,C+z],s:size,mat,color,room:true,building:b.id};scenery.push(m);if(solid&&size[1]>.12)colliders.push({x:C+x,z:C+z,a:size[0]/2,b:size[2]/2,minY:y-size[1]/2,maxY:y+size[1]/2,c:1,s:0,cap:0,mesh:m});return m;};
 const wood=[.36,.24,.14],dark=[.13,.17,.18],cloth=[.29,.40,.44],paper=[.8,.77,.65];
 box(0,.025,0,[w,.08,d],[.49,.45,.36],7,false);box(0,ceiling+.06,0,[w,.12,d],[.78,.77,.71],3,false);
 for(const x of [-w/2,w/2])box(x,ceiling/2,0,[.2,ceiling,d]);for(const z of [-d/2,d/2])box(0,ceiling/2,z,[w,ceiling,.2]);
 // Entry remains a solid visible door; E is the explicit transition, never an invisible wall.
 box(0,1.25,d/2-.12,[1.7,2.5,.08],colors[b.type],7);box(.6,1.08,d/2-.20,[.04,.24,.06],[.7,.62,.35],0);
 const sign=(text,x,y,z,scale=.09)=>lettering(text,(u,v)=>[x+u,y+v,z],(a,c,e,size,col,mat)=>box(a,c,e,size,col,mat,false),scale);
 sign(floor?'HALL':'RUE',0,2.83,d/2-.24,.10);sign(String(floor),w/2-2.2,2.8,-1,.15);
 for(const z of [-d/2+4,0,d/2-4]){box(0,3.38,z,[2,.06,.55],[.88,.83,.62],5,false).emissive=1.8;lights.push({p:[C,3.1,C+z],color:[1,.82,.60],power:18,range:10});}
 for(const x of [-w/2+.12,w/2-.12])for(const z of [-6,0,6]){box(x,2,z,[.05,1.3,1.6],[.42,.58,.66],19,false);box(x,1.28,z,[.18,.09,1.8],paper,3,false);}
 const table=(x,z,sx=2,sz=1)=>{box(x,.78,z,[sx,.12,sz],wood,7);for(const a of [-1,1])for(const c of [-1,1])box(x+a*(sx/2-.12),.4,z+c*(sz/2-.12),[.08,.76,.08],dark,0);};
 const chair=(x,z)=>{box(x,.46,z,[.52,.12,.52],cloth,7);box(x,.83,z+.23,[.52,.65,.08],cloth,7);for(const a of [-.2,.2])for(const c of [-.2,.2])box(x+a,.25,z+c,[.05,.48,.05],dark,0);};
 const shelf=(x,z,sx=2.7)=>{for(const y of [.25,.85,1.45,2.05]){box(x,y,z,[sx,.07,.7],wood,7);for(let j=0;j<Math.floor(sx/.35);j++)box(x-sx/2+.22+j*.35,y+.21,z,[.24,.35,.42],[.22+((j+floor)%3)*.19,.30+((j+2)%4)*.09,.23],7);}for(const a of [-1,1])box(x+a*sx/2,1.05,z,[.06,2.15,.76],dark,0);};
 const bed=(x,z)=>{box(x,.25,z,[2.05,.4,3.25],wood,7);box(x,.57,z,[1.95,.25,3.1],paper,7);box(x,.74,z-.8,[1.86,.08,1.35],colors[b.type],7);box(x,.76,z+1.1,[1.25,.20,.50],[.86,.84,.76],7);box(x,.8,z+1.65,[2.15,1.4,.12],wood,7);};
 const counter=(x,z,size=4)=>{box(x,.55,z,[size,1.1,.85],wood,7);box(x,1.13,z,[size+.12,.10,1.03],[.31,.34,.34]);box(x+.7,1.32,z,[.43,.3,.33],dark,0);};
 // Furniture leaves a broad central aisle from entrance to stairs and every room.
 if(floor===0&&b.type==='supermarche'){
  for(const x of [-7,-3.5,3.5,7])for(const z of [-6,-2,2])shelf(x,z,2.7);counter(-5,7,5);counter(5,7,4);civil.push({x:C-5,z:C+6,baseY:.08,yaw:Math.PI,civil:true,id:20000+b.index*10+floor});
 }else if(floor===0&&b.type==='garage'){
  for(const x of [-5,0]){box(x,.16,-3,[2.7,.3,5.4],dark,0);box(x,.85,-3,[1.65,.65,3.4],colors[b.type],0);box(x,1.4,-3.4,[1.4,.55,1.7],[.19,.28,.31],19);for(const side of [-1,1])for(const z of [-4,-2])box(x+side*.85,.48,z,[.18,.54,.54],[.04,.05,.05],7);}shelf(-6,6,3.5);counter(4,6,3);
 }else if(floor>0&&(b.type==='hotel'||b.type==='logement')){
  for(const side of [-1,1]){box(side*2.0,1.7,-5.8,[.14,3.4,8]);box(side*2.0,1.7,6.5,[.14,3.4,6.6]);box(side*5.0,1.7,0,[6,3.4,.14]);for(const z of [-5,5]){bed(side*5,z);table(side*6.2,z-2,1,.8);box(side*6.3,1.1,z+2.1,[1.8,2.2,.55],wood,7);}}sign(b.type==='hotel'?'HOTEL':'LOGIS',0,2.8,-d/2+.15,.12);
 }else if(floor>0||b.type==='bureau'||b.type==='public'){
  for(const x of [-4,3])for(const z of [-5,2]){table(x,z,2.4,1.2);chair(x,z+1);box(x,.99,z,[.72,.36,.09],dark,0);box(x+.8,.9,z,[.3,.12,.4],paper,7);}shelf(-w/2+2,d/2-3,2.5);if(!floor){counter(0,-7,5);civil.push({x:C,z:C-8.2,baseY:.08,yaw:Math.PI,civil:true,id:20000+b.index*10+floor});}
 }else{
  counter(-4,-5,5);civil.push({x:C-4,z:C-6.2,baseY:.08,yaw:Math.PI,civil:true,id:20000+b.index*10+floor});for(const z of [0,4]){table(-4,z);chair(-4,z+1);}for(let j=0;j<5;j++)box(-w/2+.2,1.4,d/2-3-j*.6,[.22,.35,.4],dark,0);shelf(3,-7,3.2);if(b.shop){shelf(4,4,3.2);shelf(4,7,3.2);}
 }
 // Two distinct landings prevent accidental repeated floor changes on a held key.
 const stairs={up:{x:C-.8,z:C+d/2-3.5},down:{x:C+.8,z:C+d/2-3.5}};
 for(let j=0;j<7;j++)box(-.95,.1+j*.13,d/2-4.6-j*.38,[1.25,.2+j*.26,.38],[.52,.52,.47]);
 if(b.floors>1){sign('HAUT',-.8,2.7,d/2-4.2,.075);sign('BAS',.8,2.7,d/2-4.2,.075);}
 const contains=(x,z)=>x>C-w/2&&x<C+w/2&&z>C-d/2&&z<C+d/2;
 const blocked=(x,z,r=.28,y=.08,height=1.8)=>{if(x-r<C-w/2||x+r>C+w/2||z-r<C-d/2||z+r>C+d/2)return true;return colliders.some(q=>!q.destroyed&&q.maxY>y+.22&&q.minY<y+height&&(x-Math.max(q.x-q.a,Math.min(q.x+q.a,x)))**2+(z-Math.max(q.z-q.b,Math.min(q.z+q.b,z)))**2<r*r);};
 const ray=(o,d,far)=>{let hit=far;for(const q of colliders)if(!q.destroyed)hit=Math.min(hit,world.rayBox(q,o,d,hit));if(d[1]<0)hit=Math.min(hit,Math.max(0,(.08-o[1])/d[1]));return hit;};
 return {building:b,floor,w,d,ceiling,scenery,colliders,lights,civil,stairs,spawn:{x:C,z:C+d/2-2,yaw:0},exit:{x:C,z:C+d/2-1},merchant:civil[0]||null,contains,blocked,ray};
}
function create(world,sim,{saved=null,notify=()=>{}}={}){const data=world.addresses||catalog(world),entries=data.entries,p=sim.state.player,visits=new Set(Array.isArray(saved?.visited)?saved.visited.filter(id=>entries.some(b=>b.id===id)):[]);let active=null,outside=null,revision=0;
 function near(){let best=null;for(const b of entries){const d=Math.hypot(p.x-b.x,p.z-b.z);if(d<1.85&&(!best||d<best.distance))best={kind:'building',target:b,label:'E · '+(b.passage?'Passage vers ':'Entrer · ')+b.name,distance:d};}return best;}
 function context(){if(!active)return near();const q=active,b=q.building,items=[];const add=(v,label,action)=>{const distance=Math.hypot(p.x-v.x,p.z-v.z);if(distance<1.65)items.push({kind:'interior',distance,label:'E · '+label,action});};add(q.exit,q.floor?'Rejoindre le rez-de-chaussée':'Sortir dans la rue',q.floor?'lobby':'exit');if(q.floor<b.floors-1)add(q.stairs.up,'Escalier · étage '+(q.floor+1),'up');if(q.floor>0)add(q.stairs.down,q.floor===1?'Escalier · rez-de-chaussée':'Escalier · étage '+(q.floor-1),'down');if(q.floor===0&&b.shop&&q.merchant&&q.merchant.hp!==0)add({x:q.merchant.x,z:q.merchant.z+2},'Comptoir · acheter un plan (60 €)','map');return items.sort((a,b)=>a.distance-b.distance)[0]||null;}
 function load(b,floor=0,stair=false){active=roomFor(b,floor,world);world.room=active;revision++;visits.add(b.id);const q=active.spawn;sim.relocate(q.x,q.z,q.yaw);notify(b.name+' · '+(floor?'étage '+floor:'rez-de-chaussée'));}
 function enter(b){if(active||!entries.includes(b)||Math.hypot(p.x-b.x,p.z-b.z)>1.85)return false;outside={x:p.x,z:p.z,yaw:p.yaw};load(b);return true;}
 function leave(){if(!active)return false;const b=active.building;active=null;world.room=null;revision++;const q=world.freeNear(outside?.x??b.x,outside?.z??b.z,.36);sim.relocate(q[0],q[1],outside?.yaw??Math.atan2(b.nx,-b.nz));notify('Rue · '+b.name);return true;}
 function interact(campaign){const target=context();if(!target)return false;if(!active)return enter(target.target);switch(target.action){case'exit':return leave();case'lobby':load(active.building,0);break;case'up':load(active.building,active.floor+1,true);break;case'down':load(active.building,active.floor-1,true);break;case'map':if(campaign){if(campaign.state.mapOwned)notify('Vous possédez déjà le plan · M');else if(campaign.state.cash>=60){campaign.state.cash-=60;campaign.state.mapOwned=true;notify('Plan acheté · M');}else notify('Il faut 60 €.');}break;}return true;}
 function save(){return {visited:[...visits],active:active?{id:active.building.id,floor:active.floor,x:p.x,z:p.z,yaw:p.yaw,outside}:null};}
 if(saved?.active){const v=saved.active,b=entries.find(b=>b.id===v.id);if(b&&Number.isInteger(v.floor)&&v.floor>=0&&v.floor<b.floors){outside={x:b.x,z:b.z,yaw:Math.atan2(b.nx,-b.nz)};load(b,v.floor);if(Number.isFinite(v.x)&&Number.isFinite(v.z)&&!active.blocked(v.x,v.z,.35))sim.relocate(v.x,v.z,Number.isFinite(v.yaw)?v.yaw:0);}}
 return {entries,shared:data.shared,visits,near,context,interact,enter,leave,save,get active(){return active;},get outside(){return outside;},get revision(){return revision;},roomFor:(b,f=0)=>roomFor(b,f,world)};
}
R.interiors={create,roomFor,catalog,types,names};})(globalThis.RADE);
