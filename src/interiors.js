/* RADE — one address per urban building; sourced places, furnished interiors and stairs. */
(function(R){'use strict';
const C=1000,types=['logement','hotel','public','bureau','commerce','supermarche','garage','restaurant','kebab','armurerie'];
const names={logement:'Immeuble',hotel:'Hôtel',public:'Établissement public',bureau:'Bureaux',commerce:'Commerce',supermarche:'Supermarché',garage:'Garage',restaurant:'Restaurant',kebab:'Kebab',armurerie:'Armurerie'};
const colors={logement:[.27,.40,.36],hotel:[.54,.20,.16],public:[.19,.34,.52],bureau:[.27,.32,.38],commerce:[.16,.44,.35],supermarche:[.62,.39,.12],garage:[.30,.34,.42],restaurant:[.46,.24,.18],kebab:[.57,.30,.12],armurerie:[.25,.28,.24]};
const dimensions={logement:[16,20],hotel:[18,20],public:[20,20],bureau:[18,20],commerce:[18,20],supermarche:[24,26],garage:[22,24],restaurant:[18,20],kebab:[14,18],armurerie:[18,20]};
const retail=new Set(['commerce','supermarche','garage','armurerie']);
const furniture={wood:[.36,.24,.14],dark:[.13,.17,.18],cloth:[.29,.40,.44],paper:[.8,.77,.65],metal:[.42,.45,.45],steel:[.62,.65,.64],white:[.84,.85,.81],tile:[.58,.64,.63],green:[.16,.30,.20],glass:[.42,.58,.66],wall:[.76,.75,.69]};
const weapons=[{key:'smg',weapon:0,name:'Mitraillette de simulation'},{key:'shotgun',weapon:1,name:'Double pompe de simulation'},{key:'rocket',weapon:2,name:'Lance-roquettes de simulation'},{key:'grenade',weapon:3,name:'Grenades de simulation'},{key:'pistol',weapon:4,name:'Pistolet de service'}];
const font={A:['010','101','111','101','101'],B:['110','101','110','101','110'],C:['011','100','100','100','011'],E:['111','100','110','100','111'],G:['011','100','101','101','011'],H:['101','101','111','101','101'],I:['111','010','010','010','111'],L:['100','100','100','100','111'],M:['101','111','111','101','101'],O:['010','101','101','101','010'],P:['110','101','110','100','100'],R:['110','101','110','101','101'],S:['011','100','010','001','110'],T:['111','010','010','010','010'],U:['101','101','101','101','111'],V:['101','101','101','101','010'],'0':['111','101','101','101','111'],'1':['010','110','010','010','111'],'2':['110','001','010','100','111'],'3':['110','001','010','001','110'],'4':['101','101','111','001','001'],'5':['111','100','110','001','110'],'6':['011','100','111','101','111'],'7':['111','001','010','010','010'],'8':['111','101','111','101','111'],'9':['111','101','111','001','110']};
Object.assign(font,{D:['110','101','101','101','110'],F:['111','100','110','100','100'],J:['001','001','001','101','010'],K:['101','101','110','101','101'],N:['101','111','111','101','101'],Q:['010','101','101','111','011'],W:['101','101','111','111','101'],X:['101','101','010','101','101'],Y:['101','101','010','010','010'],Z:['111','001','010','100','111'],' ':['000','000','000','000','000'],'-':['000','000','111','000','000'],"'":['010','010','000','000','000'],'.':['000','000','000','000','010']});
function lettering(text,at,box,scale=.045,color=[.90,.89,.78]){text=String(text).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();const w=text.length*4-1;for(let j=0;j<text.length;j++)for(let y=0;y<5;y++)for(let x=0;x<3;x++)if((font[text[j]]||font.I)[y][x]==='1')box(...at((j*4+x-w/2)*scale,(2-y)*scale),[scale*.85,scale*.85,.012],color,7);}
function knownAddress(b){const value=typeof b.address==='string'?b.address.trim():'';return value;}
function sourcedPlace(b,place){return !!(place&&(place.sourceUrl||place.sourceURL||place.source||place.osmId||place.sourceId||b.fixture===true&&place.fixture===true));}
function catalog(world){const entries=[];let shared=0;const {city}=world,bounds=world.bounds||{minX:-325,maxX:325,minZ:-325,maxZ:325};
 for(const b of city.batiments||[]){const boxes=b.boites.filter(q=>{const co=Math.abs(Math.cos(q.lacet)),si=Math.abs(Math.sin(q.lacet)),hx=(co*q.lx+si*q.lz)/2,hz=(si*q.lx+co*q.lz)/2;return q.x+hx>bounds.minX+.5&&q.x-hx<bounds.maxX-.5&&q.z+hz>bounds.minZ+.5&&q.z-hz<bounds.maxZ-.5;});if(!boxes.length)continue;let best=null,score=Infinity;
  for(const q of boxes){const c=Math.cos(-q.lacet),s=Math.sin(-q.lacet);for(const [nx,nz,w,edge]of [[-s,c,q.lx,q.lz/2],[s,-c,q.lx,q.lz/2],[c,s,q.lz,q.lx/2],[-c,-s,q.lz,q.lx/2]])for(const u of [0,-.3,.3,-.42,.42]){
   const tx=nz,tz=-nx,dx=q.x+nx*edge+tx*w*u,dz=q.z+nz*edge+tz*w*u;
   for(const gap of [.85,1.3,2]){const x=dx+nx*gap,z=dz+nz*gap;if(world.blocked(x,z,.38)||entries.some(b=>Math.hypot(b.x-x,b.z-z)<.8))continue;const sc=gap+Math.abs(u)*2+(city.surChaussee(x,z)?3:0);if(sc<score){score=sc;best={x,z,dx:dx+nx*.24,dz:dz+nz*.24,nx,nz};}break;}
  }}
  const center=boxes.reduce((v,q)=>[v[0]+q.x/boxes.length,v[1]+q.z/boxes.length],[0,0]);
  if(!best){outer:for(let d=1;d<70;d+=1)for(let j=0;j<48;j++){const a=j*Math.PI/24,x=center[0]+Math.cos(a)*d,z=center[1]+Math.sin(a)*d;if(world.blocked(x,z,.45)||city.surChaussee(x,z)||entries.some(b=>Math.hypot(b.x-x,b.z-z)<.8))continue;best={x,z,dx:x,dz:z,nx:Math.sin(a),nz:-Math.cos(a),passage:true};shared++;break outer;}}
  if(!best)throw Error('Bâtiment sans accès : '+b.id);
  const index=entries.length,area=boxes.reduce((v,q)=>v+q.lx*q.lz,0),id='building-'+b.id;
  const entry={id,index,type:'logement',name:'Immeuble',address:'',area,boxes,h:b.h,floors:Math.max(1,Math.min(10,Math.floor(b.h/3.1))),shop:false,places:[],...best};entries.push(entry);
  const tx=best.nz,tz=-best.nx,cap=Math.atan2(tz,tx),at=(u,y,d=.03)=>[best.dx+tx*u+best.nx*d,y,best.dz+tz*u+best.nz*d];
  const box=(u,y,d,size,color,mat=3)=>world.scenery.push({shape:'box',p:at(u,y,d),s:size,r:[0,-cap,0],mat,color,outdoor:true,building:id});
  if(!best.passage){box(0,1.25,0,[1.4,2.5,.075],[.11,.16,.15]);box(0,1.25,.05,[1.18,2.3,.055],colors.logement,7);for(const u of [-.66,.66])box(u,1.25,.10,[.10,2.6,.11],[.73,.69,.58]);box(.42,1.1,.12,[.035,.21,.06],[.71,.63,.40],0);box(0,2.62,.08,[1.6,.28,.08],colors.logement,7);}
  else{box(0,1.35,0,[.10,2.7,.10],[.24,.27,.25]);box(0,2.2,.02,[1.6,.75,.10],colors.logement,7);}
  // Never paint the procedural index as a fake street number.
 }
 if(R.places&&typeof R.places.assign==='function')R.places.assign(entries,world);
 for(const entry of entries){
  const places=Array.isArray(entry.places)?entry.places.filter(place=>place&&typeof place==='object'):[];entry.places=places;
  const primary=places[0]||null;
  entry.type=primary&&types.includes(primary.type)?primary.type:'logement';
  entry.shop=!!(primary&&primary.shop);
  if(primary&&typeof primary.name==='string'&&primary.name.trim())entry.name=primary.name.trim();
  else{const address=knownAddress(entry);entry.name='Immeuble'+(address?' · '+address:'');}
  const plaque=primary?.name||(/^\d+[^ ,]*/.exec(entry.address||'')||[])[0]||'';
  if(plaque){const text=plaque.slice(0,26),tx=entry.nz,tz=-entry.nx,cap=Math.atan2(tz,tx),at=(u,v)=>[entry.dx+tx*u+entry.nx*.16,2.93+v,entry.dz+tz*u+entry.nz*.16],put=(x,y,z,size,color,mat)=>world.scenery.push({shape:'box',p:[x,y,z],s:size,r:[0,-cap,0],mat,color,outdoor:true,building:entry.id});put(...at(0,0),[Math.max(1.3,text.length*.16),.36,.10],colors[entry.type],7);lettering(text,at,put,.037);}
 }
 return {entries,shared};
}
function roomFor(b,floor,world,placeIndex=0){
 const all=Array.isArray(b.places)?b.places.filter(p=>p&&typeof p==='object'):[],ground=floor===0;
 let pIndex=all.length?Math.max(all.length>1?-1:0,Math.min(all.length-1,Number.isInteger(placeIndex)?placeIndex:0)):0;
 const concourse=ground&&pIndex===-1;
 const chosen=ground&&all.length?all[pIndex]:null;
 const hotelSourced=all.some(p=>p.type==='hotel'&&sourcedPlace(b,p));
 const kebab=chosen&&/(^|[;, ])kebab([;, ]|$)/i.test(chosen.cuisine||chosen.tags?.cuisine||'');
 const type=concourse?'logement':ground?(kebab?'kebab':((chosen&&types.includes(chosen.type))?chosen.type:(types.includes(b.type)?b.type:'logement'))):(hotelSourced?'hotel':'logement');
 const dims=concourse?[16,Math.max(20,Math.ceil(all.length/2)*2+8)]:dimensions[type]||dimensions.logement,w=dims[0],d=dims[1],scenery=[],colliders=[],ceiling=3.55,lights=[],civil=[],services=[],portals=[],features=[],vehicleDisplay=[],zones=[];
 const box=(x,y,z,size,color=furniture.wall,mat=3,solid=true)=>{const m={shape:'box',p:[C+x,y,C+z],s:size,mat,color,room:true,building:b.id};scenery.push(m);if(solid&&size[1]>.12)colliders.push({x:C+x,z:C+z,a:size[0]/2,b:size[2]/2,minY:y-size[1]/2,maxY:y+size[1]/2,c:1,s:0,cap:0,mesh:m});return m;};
 const shape=(kind,x,y,z,size,color=furniture.metal,mat=3,solid=true)=>{const m={shape:kind,p:[C+x,y,C+z],s:size,mat,color,room:true,building:b.id};scenery.push(m);if(solid&&size[1]>.12)colliders.push({x:C+x,z:C+z,a:size[0]/2,b:size[2]/2,minY:y-size[1]/2,maxY:y+size[1]/2,c:1,s:0,cap:0,mesh:m});return m;};
 const collide=(x,z,a,bound,minY=.2,maxY=1.8,mesh=null)=>colliders.push({x:C+x,z:C+z,a,b:bound,minY,maxY,c:1,s:0,cap:0,mesh});
 const feature=tag=>{if(!features.includes(tag))features.push(tag);};
 const subtract=(a,bound,gaps)=>{let segs=[[Math.min(a,bound),Math.max(a,bound)]];for(const gap of gaps){const mid=Array.isArray(gap)?gap[0]:gap.at,width=Array.isArray(gap)?gap[1]:(gap.width||1.3),lo=mid-width/2,hi=mid+width/2,next=[];for(const [u,v] of segs){if(hi<=u||lo>=v){next.push([u,v]);continue;}if(u<lo)next.push([u,lo]);if(hi<v)next.push([hi,v]);}segs=next;}return segs.filter(([u,v])=>v-u>.06);};
 const wallX=(z,x0,x1,gaps=[])=>{for(const [a,e] of subtract(x0,x1,gaps))box((a+e)/2,ceiling/2,z,[e-a,ceiling,.14],furniture.wall,3);};
 const wallZ=(x,z0,z1,gaps=[])=>{for(const [a,e] of subtract(z0,z1,gaps))box(x,ceiling/2,(a+e)/2,[.14,ceiling,e-a],furniture.wall,3);};
 const sign=(text,x,y,z,scale=.09)=>lettering(text,(u,v)=>[x+u,y+v,z],(a,c,e,size,col,mat)=>box(a,c,e,size,col,mat,false),scale);
 const table=(x,z,sx=2,sz=1,h=.78)=>{box(x,h,z,[sx,.11,sz],furniture.wood,7);for(const a of [-1,1])for(const c of [-1,1])box(x+a*(sx/2-.12),h/2,z+c*(sz/2-.12),[.08,h,.08],furniture.dark,0);};
 const chair=(x,z)=>{box(x,.46,z,[.52,.12,.52],furniture.cloth,7);box(x,.83,z+.23,[.52,.65,.08],furniture.cloth,7);for(const a of [-.2,.2])for(const c of [-.2,.2])box(x+a,.25,z+c,[.05,.48,.05],furniture.dark,0);};
 const sofa=(x,z,alongZ=true)=>{const sx=alongZ?1.0:2.6,sz=alongZ?2.6:1.0;box(x,.36,z,[sx,.48,sz],furniture.cloth,7);box(x+(alongZ?-.38:0),.74,z+(alongZ?0:-.38),[alongZ?.22:2.6,.58,alongZ?2.6:.22],furniture.cloth,7);for(const a of [-1,1])box(x+(alongZ?0:a*(sx/2-.08)),.58,z+(alongZ?a*(sz/2-.08):0),[alongZ?.18:.18,.34,alongZ?.18:.18],furniture.cloth,7);};
 const coffee=(x,z)=>table(x,z,1.6,.85,.44);
 const bed=(x,z,alongX=false)=>{const sx=alongX?3.25:2.05,sz=alongX?2.05:3.25;box(x,.25,z,[sx,.4,sz],furniture.wood,7);box(x,.57,z,[sx-.1,.25,sz-.15],furniture.paper,7);box(x,.74,z-(alongX?0:1.05)+(alongX?0:0),[alongX?1.35:1.86,.08,alongX?1.86:1.35],colors[type]||colors.logement,7);box(x+(alongX?1.35:0),.76,z+(alongX?0:1.25),[alongX?.5:1.25,.2,alongX?1.25:.5],furniture.white,7);box(x+(alongX?1.65:0),.8,z+(alongX?0:1.7),[alongX?.12:2.15,1.4,alongX?2.15:.12],furniture.wood,7);};
 const wardrobe=(x,z,sx=.62,sz=1.25)=>{box(x,1.05,z,[sx,2.1,sz],furniture.wood,7);box(x+(sx>.7?0:.02),1.08,z,[.03,1.9,sz-.12],furniture.dark,0);};
 const desk=(x,z,sx=1.8,sz=.8)=>{table(x,z,sx,sz,.76);box(x,.99,z,[.6,.3,.09],furniture.dark,0,false);box(x,.9,z,[.28,.12,.38],furniture.paper,7,false);chair(x,z+.75);};
 const counter=(x,z,sx=4,sz=.85)=>{box(x,.55,z,[sx,1.1,sz],furniture.wood,7);box(x,1.13,z,[sx+.12,.1,sz+.18],furniture.steel,3);box(x+sx*.27,1.32,z,[.48,.30,.42],furniture.dark,0);box(x+sx*.27,1.51,z-.10,[.42,.21,.06],[.12,.32,.28],4,false);box(x+sx*.27,1.49,z+.12,[.35,.03,.18],furniture.metal,0,false);};
 const shelf=(x,z,sx=2.7,sz=.7)=>{for(const y of [.25,.85,1.45,2.05])box(x,y,z,[sx,.07,sz],furniture.wood,7,false);for(const a of [-1,1])box(x+a*sx/2,1.05,z,[.06,2.15,sz],furniture.dark,0);collide(x,z,sx/2,sz/2,.18,2.15);for(const y of [.46,1.06,1.66])for(let j=0;j<Math.floor(sx/.35);j++)box(x-sx/2+.22+j*.35,y,z,[.24,.35,.42],[.22+((j+floor)%3)*.19,.30+((j+2)%4)*.09,.23],7,false);};
 const fridge=(x,z,wdt=1.1,glass=false)=>{box(x,.95,z,[wdt,1.9,.72],[.86,.88,.84],7);box(x,.95,z-.38,[wdt-.1,1.65,.03],glass?furniture.glass:[.78,.80,.77],glass?19:3,false);box(x,1.87,z,[wdt,.05,.72],furniture.metal,0,false);};
 const kitchen=(x,z,len=3.2)=>{box(x,.45,z,[.65,.9,len],furniture.wood,7);box(x,1.02,z,[.74,.12,len+.1],furniture.steel,3);for(const [dz,kind] of [[-len*.28,'stove'],[len*.1,'sink'],[len*.36,'prep']]){if(kind==='stove'){box(x,1.1,z+dz,[.6,.05,.72],furniture.dark,7,false);for(const a of [-1,1])for(const c of [-1,1])shape('cylinder',x+a*.16,1.14,z+dz+c*.18,[.16,.02,.16],furniture.dark,0,false);}else if(kind==='sink'){box(x,1.08,z+dz,[.5,.03,.62],furniture.metal,0,false);shape('cylinder',x,1.18,z+dz,[.06,.28,.06],furniture.steel,0,false);}else box(x,1.09,z+dz,[.58,.03,.68],furniture.white,7,false);}for(const y of [1.7,2.15])box(x+.24,y,z,[.3,.06,len*.72],furniture.wood,7,false);};
 const bath=(x,z)=>{shape('box',x,.09,z,[.95,.16,1.15],furniture.tile,3,false);box(x+(x<0?.46:-.46),1.0,z,[.04,1.9,1.1],furniture.glass,19);box(x,.34,z-1.35,[.46,.62,.58],furniture.white,7);box(x,.82,z+.95,[.62,.16,.5],furniture.white,7);box(x,.55,z+.95,[.22,.5,.22],furniture.white,7,false);feature('bathroom');};
 const mailbox=(x,z)=>{for(let j=0;j<8;j++)box(x,1.55-(j%4)*.36,z-(j>>2)*.36,[.7,.3,.3],[.22,.30,.31],7);collide(x,z,.38,.42,.2,1.85);feature('mailboxes');};
 const rack=(x,z,label)=>{box(x,1.35,z,[.58,2.1,2.3],furniture.dark,7);collide(x,z,.34,1.16,.15,2.3);for(let j=0;j<3;j++){const y=.72+j*.58;box(x+.34,y,z,[.05,.10,1.9],[.09,.10,.09],0,false);box(x+.38,y+.12,z-.55,[.06,.22,1.1],[.16,.17,.16],0,false);box(x+.38,y+.16,z+.5,[.08,.30,.85],[.20,.22,.20],0,false);}sign(label,x,2.62,z, .065);};
 // Floor, ceiling and shell.
 box(0,.025,0,[w,.08,d],[.49,.45,.36],7,false);box(0,ceiling+.06,0,[w,.12,d],[.78,.77,.71],3,false);
 for(const x of [-w/2,w/2])box(x,ceiling/2,0,[.2,ceiling,d]);
 for(const z of [-d/2,d/2])box(0,ceiling/2,z,[w,ceiling,.2]);
 box(0,1.25,d/2-.12,[1.7,2.5,.08],colors[type],7);box(.6,1.08,d/2-.20,[.04,.24,.06],[.7,.62,.35],0);
 sign(floor?'HALL':'RUE',0,2.83,d/2-.24,.10);sign(String(floor),w/2-2.2,2.8,-1,.15);
 for(const z of [-d/2+4,0,d/2-4]){box(0,3.38,z,[2,.06,.55],[.88,.83,.62],5,false).emissive=1.8;lights.push({p:[C,3.1,C+z],color:[1,.82,.60],power:18,range:10});}
 for(const x of [-w/2+.12,w/2-.12])for(const z of [-6,0,6]){box(x,2,z,[.05,1.3,1.6],furniture.glass,19,false);box(x,1.28,z,[.18,.09,1.8],furniture.paper,3,false);}
 // Stairs stay at the historic near-entry coordinates and never block their own interaction points.
 for(let j=0;j<7;j++)box(-.95,.1+j*.13,d/2-4.6-j*.38,[1.25,.2+j*.26,.38],[.52,.52,.47],3,false);
 if(b.floors>1){sign('HAUT',-.8,2.7,d/2-4.2,.075);sign('BAS',.8,2.7,d/2-4.2,.075);feature('stairs');}
 // A dedicated circulation hall keeps every sourced local reachable, even in dense buildings.
 if(ground&&all.length>1){
  const destinations=concourse?all.map((place,i)=>({place,i})): [{place:{id:b.id+'-hall',name:'Hall · tous les locaux'},i:-1}];
  destinations.forEach(({place,i},j)=>{const x=concourse?(j%2?5.5:-5.5):4.0,z=concourse?d/2-6-Math.floor(j/2)*2:d/2-1.8,label=place.name||names[place.type]||'Local';portals.push({id:String(place.id)+':portal',placeIndex:i,x:C+x,z:C+z,label});box(x,1.2,z,[1.4,2.4,.12],colors[place.type]||colors.logement,7,false);sign(label.slice(0,26),x,2.65,z,.045);feature('portals');});
 }
 const sourcePlace=ground&&chosen&&sourcedPlace(b,chosen);
 const sourceId=chosen&&chosen.id!==undefined?String(chosen.id):(b.id||'building');
 const service=(kind,label,price,x,z,extra={})=>{const item={id:sourceId+':'+kind+(extra.key?':'+extra.key:''),kind,label,price,x:C+x,z:C+z,type,placeIndex:pIndex,merchant:!!(civil.length&&civil[civil.length-1]),...extra};delete item.key;services.push(item);return item;};
 const merchant=(x,z,yaw=Math.PI)=>{const q={x:C+x,z:C+z,baseY:.08,y:.08,hp:100,yaw,civil:true,merchant:true,id:10000000+stableHash(b.id+':'+sourceId+':'+floor+':'+civil.length)};civil.push(q);return q;};
 // Type-specific ground/first-floor layouts.
 if(concourse){feature('hall');feature('directory');sign('LOCAUX',0,2.7,-d/2+.2,.1);
 }else if(!ground){
  if(type==='hotel'){
   // Two suites, each with a real doorway and an accessible bathroom alcove.
   for(const side of [-1,1]){wallZ(side*2.25,-d/2+.7,d/2-4.6,[{at:2.8,width:1.5}]);wallX(-5.6,side<0?-w/2+.15:2.25,side<0?-2.25:w/2-.15,[{at:side*4.8,width:1.5}]);bed(side*5.2,-1.8);wardrobe(side*7.7,2.5);desk(side*5.0,3.5);bath(side*7.6,-7.2);zones.push({kind:'bedroom',x:C+side*3.4,z:C},{kind:'bathroom',x:C+side*5,z:C-7.5});}
   feature('hotel-room');feature('bedroom');feature('bathroom');feature('corridor');sign('CHAMBRES',0,2.72,-d/2+.2,.09);
  }else{
   // Upper floors are real apartments, never a repeated hotel-bed maze.
   const variant=((b.index||0)*5+floor)%3,side=variant===1?1:-1,mirror=variant===1?-1:1,beds=variant===2?2:1;
   wallZ(-2.25,-d/2+.8,d/2-4.6,[{at:2.5,width:1.3},{at:-3.4,width:1.3}]);wallZ(2.25,-d/2+.8,d/2-4.6,[{at:1.6,width:1.3},{at:-5.0,width:1.3}]);
   wallX(.0,-w/2+.15,-2.25,[{at:-4.5,width:1.4}]);wallX(-2.6,2.25,w/2-.15,[{at:4.5,width:1.4}]);
   if(beds===2)wallX(-4.4,-w/2+.15,-2.25,[{at:-4.5,width:1.4}]);
   feature('kitchen');feature('bathroom');feature('living-room');feature('bedroom');feature('apartment');
   const kitchenX=side<0?-w/2+.42:w/2-.42,livingX=mirror<0?-w/2+2.4:w/2-2.4;
   kitchen(kitchenX,2.9,3.4);fridge(kitchenX,.55,.82);
   sofa(livingX,2.5,false);coffee(livingX,.8);box(livingX<0?-w/2+.25:w/2-.25,1.05,2.5,[.09,.9,1.8],furniture.dark,0,false);
   bath(side<0?-w/2+.8:w/2-.8,side<0?-2.4:-5.2);
   const bedSide=side<0?1:-1,bedX=bedSide*(w/2-2.0);
   bed(bedX,-6.7,false);wardrobe(bedSide*(w/2-.45),-4.7);desk(bedSide*(w/2-2.1),-4.0);
   if(beds===2){bed(-w/2+2.2,-7.4,false);wardrobe(-w/2+.5,-5.6,.62,1.0);feature('second-bedroom');}
   zones.push({kind:'kitchen',x:C+side*5,z:C+3.8},{kind:'living-room',x:C+livingX,z:C+4.5},{kind:'bathroom',x:C+side*(w/2-2.5),z:C+(side<0?-2.4:-5.2)},{kind:'bedroom',x:C+bedSide*4,z:C-6.2});if(beds===2)zones.push({kind:'second-bedroom',x:C-3.8,z:C-6.3});
   sign('LOGIS',0,2.72,-d/2+.2,.09);
  }
 }else if(type==='logement'){
  mailbox(-w/2+1.0,2.4);sofa(w/2-2.0,2.2,true);coffee(w/2-4.4,2.2);box(-w/2+1.0,1.55,-.2,[1.35,1.0,.55],furniture.wood,7);feature('hall');feature('residential');
 }else if(type==='hotel'){
  counter(4.6,-3.2,5.2,1.0);merchant(4.6,-4.55);sofa(-5.8,-1.5,true);sofa(-5.8,-5.0,true);table(-5.8,-3.25,1.2,.7,.48);
  for(const x of [-3.8,-2.4])for(const z of [2.8,4.0])chair(x,z);
  box(-w/2+.8,1.4,-d/2+3.2,[.7,1.8,1.6],furniture.wood,7);for(let j=0;j<3;j++)box(-w/2+1.1,.45+j*.38,-d/2+2.8+j*.5,[.9,.34,.5],[.20,.23,.24],7);
  feature('reception');feature('lobby');feature('queue');
  sign('RECEPTION',0,2.72,-d/2+.2,.09);
 }else if(type==='public'){
  counter(4.7,-3.0,5.0,1.0);merchant(4.7,-4.35);
  for(const x of [-4.6,-6.4])for(const z of [-3.0,-4.8])chair(x,z);
  box(-4.8,.42,-1.3,[3.0,.16,.55],furniture.wood,7);for(const x of [-6.0,-4.8,-3.6])chair(x,-1.3);
  box(-w/2+.8,1.3,-d/2+3.4,[.8,1.8,1.8],furniture.wood,7);
  if(sourcePlace)service('plan','Informations municipales',0,4.7,-1.35);
  feature('reception');feature('queue');feature('information-desk');feature('public');
  if(chosen?.kind==='police'){
   civil[0].police=true;wallX(-5.6,-w/2+.15,w/2-.15,[{at:0,width:1.8}]);desk(4.5,-7.3,2.3,.9);wallZ(-2.7,-d/2+.2,-5.6);
   for(let j=0;j<11;j++)box(-w/2+.5+j*.6,1.55,-5.65,[.05,3.0,.05],furniture.dark,0,false);
   box(-6.2,.45,-8,[3.2,.35,.9],furniture.metal,0);box(-8.5,.45,-7.3,[.45,.65,.5],furniture.white,7);
   feature('police');feature('holding-cell');feature('administration');sign('POLICE',0,2.72,-d/2+.2,.09);
  }else sign('ACCUEIL',0,2.72,-d/2+.2,.09);
 }else if(type==='bureau'){
  for(const x of [-5.7,5.7])for(const z of [-5.2,.8])desk(x,z,2.2,.9);
  for(const x of [-5.7,5.7])box(x,1.08,-d/2+1.0,[3.4,1.8,.5],furniture.dark,7);
  shelf(-w/2+2.0,-d/2+2.6,2.8);shelf(w/2-2.0,-d/2+2.6,2.8);box(0,1.1,-d/2+1.2,[3.2,1.9,.5],furniture.dark,7);feature('office');feature('desk');feature('monitor');feature('storage');
  sign('BUREAUX',0,2.72,-d/2+.2,.09);
 }else if(type==='commerce'){
  shelf(-5.4,-5.4,2.9);shelf(-5.4,-1.2,2.9);shelf(5.4,-5.4,2.9);shelf(5.4,-1.2,2.9);
  counter(4.0,3.1,4.2,.9);merchant(4.0,1.9);
  if(sourcePlace)service('map','Plan de la ville',60,4.0,4.45);
  feature('shop');feature('shelves');feature('cashier');feature('checkout');
  sign('COMMERCE',0,2.72,-d/2+.2,.09);
 }else if(type==='supermarche'){
  for(const x of [-8.2,-4.2,4.2,8.2])for(const z of [-8.0,-3.6,.8])shelf(x,z,2.9,.75);
  for(const x of [-8.4,-4.6])for(const z of [-11.4])fridge(x,z,1.9);
  wallX(-10.4,2.4,w/2-.15,[{at:7.2,width:1.6}]);fridge(4.7,-11.3,1.7);fridge(6.8,-11.3,1.7);feature('cold-storage');
  counter(-6.0,6.2,5.0,.95);counter(6.0,6.2,4.4,.95);box(-6.0,1.2,6.2,[4.7,.05,.65],furniture.steel,3,false);for(let j=0;j<5;j++)box(-8.1+j*.9,1.24,6.2,[.55,.05,.5],furniture.metal,0,false);box(6.0,1.22,6.2,[3.8,.06,.55],furniture.dark,7,false);
  merchant(-6.0,4.9);if(sourcePlace){service('food','Repas du rayon traiteur',12,-6.0,7.45);service('map','Plan de la ville',60,6.0,7.45);}
  feature('aisles');feature('shelves');feature('checkout');feature('food-counter');feature('shop');
  sign('SUPERMARCHE',0,2.72,-d/2+.2,.08);
 }else if(type==='garage'){
  const display=[{x:-5.0,z:-5.0,model:'gti',color:R.vehicles?R.vehicles.PALETTE?.[0]:'#bb2729'},{x:5.0,z:-5.0,model:'r5',color:R.vehicles?R.vehicles.PALETTE?.[1]:'#e7e7db'}];
  for(const car of display){const before=scenery.length;const state={x:C+car.x,y:.08,z:C+car.z,cap:0,model:car.model,color:car.color};if(R.vehicles&&typeof R.vehicles.render==='function')R.vehicles.render(state,scenery);for(let i=before;i<scenery.length;i++){scenery[i].room=true;scenery[i].building=b.id;}const spec=R.vehicles?.SPECS?.[car.model]||{length:3.7,width:1.6,height:1.36};collide(car.x,car.z,spec.length/2,spec.width/2,.1,spec.height);vehicleDisplay.push({...car,x:C+car.x,z:C+car.z});box(car.x,.09,car.z,[spec.length+.6,.1,spec.width+.6],[.42,.43,.39],3,false);feature('vehicle-display');}
  counter(6.6,2.1,3.4,.9);merchant(6.6,.9);shelf(-w/2+1.8,-d/2+2.8,3.0);box(-4.5,1.0,-d/2+1.3,[3.4,.9,.72],furniture.wood,7);for(const x of [-5.6,-3.4])box(x,1.48,-d/2+1.3,[.06,.16,.55],furniture.dark,0,false);
  if(sourcePlace){service('map','Plan de la ville',60,6.6,3.35);service('vehicle','Véhicules · stock réel non rattaché',0,5.5,3.35,{available:false});}
  feature('garage');feature('desk');
  sign('GARAGE',0,2.72,-d/2+.2,.09);
 }else if(type==='restaurant'){
  for(const x of [-5.6,5.6])for(const z of [2.2,-1.4,-4.8]){table(x,z,1.8,1.0);chair(x,z+1.0);chair(x,z-1.0);for(let j=0;j<3;j++)box(x-.5+j*.5,.84,z,[.22,.025,.22],furniture.white,7,false);}
  counter(4.4,5.4,4.4,.9);merchant(4.4,4.2);for(let j=0;j<4;j++)box(2.6+j*.9,1.18,5.4,[.5,.04,.55],furniture.metal,0,false);
  wallX(-7.0,-w/2+.15,w/2-.15,[{at:0,width:1.8}]);kitchen(-w/2+.55,-8.2,3.8);fridge(w/2-.7,-8.2,1.15);box(0,1.02,-8.2,[3.0,.08,1.6],furniture.steel,3);for(let j=0;j<5;j++)box(-1.0+j*.5,1.08,-8.2,[.35,.04,.6],furniture.white,7,false);
  if(sourcePlace)service('food','Service du restaurant',12,4.4,6.7);
  feature('restaurant');feature('tables');feature('chairs');feature('kitchen');feature('plates');feature('food-counter');
  sign('RESTAURANT',0,2.72,-d/2+.2,.085);
 }else if(type==='kebab'){
  counter(-4.0,2.5,4.0,.9);merchant(-4.0,1.3);for(let j=0;j<4;j++)box(-5.4+j*.8,1.21,2.5,[.55,.05,.55],furniture.metal,0,false);
  shape('cylinder',-5.0,1.0,-4.4,[.32,2.0,.32],furniture.steel,0);for(let j=0;j<5;j++)shape('cylinder',-5.0,.55+j*.28,-4.4,[.55,.24,.55],[.55,.25,.12],7);box(-5.0,2.25,-4.4,[1.5,.35,1.5],furniture.dark,7);box(-5.0,2.48,-4.4,[1.15,.25,.6],furniture.metal,0,false);collide(-5.0,-4.4,.5,.5,.2,2.3);
  fridge(6.1,-3.8,1.0,true);box(6.1,2.15,-3.8,[1.15,.18,.9],furniture.dark,7,false);
  for(const x of [3.5,5.6])for(const z of [2.2,-.2]){table(x,z,1.4,.8);chair(x,z+.8);}
  box(4.6,1.05,-6.2,[3.0,1.8,.6],furniture.wood,7);feature('cold-storage');
  if(sourcePlace)service('food','Assiette kebab',12,-4.0,3.8);
  feature('kebab');feature('rotisserie');feature('food-counter');feature('till');feature('seating');
  sign('KEBAB',0,2.72,-d/2+.2,.09);
 }else if(type==='armurerie'){
  rack(-w/2+1.0,-5.0,'CATALOGUE');rack(-w/2+1.0,-2.1,'SERVICE');rack(w/2-1.0,-5.0,'SIMULATION');
  counter(3.8,-4.0,4.0,.9);merchant(3.8,-5.2);
  if(sourcePlace){for(const [i,item] of weapons.entries()){const z=-6.0+i*1.35;service('weapon',item.name,0,-w/2+2.0,z,{key:item.key,weapon:item.weapon});}service('map','Plan de la ville',60,3.8,-2.55);}
  feature('weapon-rack');feature('service-counter');feature('armory');
  sign('ARMURERIE',0,2.72,-d/2+.2,.075);
 }else{
  shelf(-5.4,-4.0,3.0);shelf(5.4,-4.0,3.0);counter(0,-6.8,4.5,.9);feature('commerce');
 }
 // Ranges useful to callers/tests and the room contract.
 const stairs={up:{x:C-.8,z:C+d/2-3.5},down:{x:C+.8,z:C+d/2-3.5}};
 const contains=(x,z)=>x>C-w/2&&x<C+w/2&&z>C-d/2&&z<C+d/2;
 const blocked=(x,z,r=.28,y=.08,height=1.8)=>{if(!(x-r>C-w/2&&x+r<C+w/2&&z-r>C-d/2&&z+r<C+d/2))return true;return colliders.some(q=>!q.destroyed&&q.maxY>y+.22&&q.minY<y+height&&(x-Math.max(q.x-q.a,Math.min(q.x+q.a,x)))**2+(z-Math.max(q.z-q.b,Math.min(q.z+q.b,z)))**2<r*r);};
 const ray=(o,dir,far)=>{let hit=far;for(const q of colliders)if(!q.destroyed)hit=Math.min(hit,world.rayBox(q,o,dir,hit));if(dir[1]<0)hit=Math.min(hit,Math.max(0,(.08-o[1])/dir[1]));return hit;};
 const serviceNotes=[];
 if(type==='garage'){feature(chosen?.kind==='car'?'dealership':'workshop');serviceNotes.push('Véhicules de démonstration du jeu ; aucun stock commercial réel représenté.');}
 return {building:b,floor,type,sceneId:b.id+':'+floor+':local-'+pIndex+':v2',w,d,ceiling,scenery,colliders,lights,civil,stairs,spawn:{x:C,z:C+d/2-2,yaw:0},exit:{x:C,z:C+d/2-1},merchant:civil[0]||null,contains,blocked,ray,
  services,portals,features,placeIndex:pIndex,place:chosen||null,layoutVariant:ground?(concourse?'commercial-hall':type==='logement'?'residential-hall':chosen?.kind==='police'?'police-ground':type+'-ground'):(type==='hotel'?'hotel-floor-'+((floor-1)%3):'apartment-variant-'+(((b.index||0)*5+floor)%3)),
  reconstruction:'procedural',serviceNotes,vehicleDisplay,zones};
}
function stableHash(value){let h=2166136261;for(const c of String(value))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
function create(world,sim,{saved=null,notify=()=>{}}={}){const data=world.addresses||catalog(world),entries=data.entries,p=sim.state.player,visits=new Set(Array.isArray(saved?.visited)?saved.visited.filter(id=>entries.some(b=>b.id===id)):[]),purchased=new Set(Array.isArray(saved?.purchased)?saved.purchased.filter(id=>typeof id==='string').slice(0,200):[]);let active=null,outside=null,revision=0;const serviceHandlers=new Map();
 function near(){let best=null;for(const b of entries){const distance=Math.hypot(p.x-b.x,p.z-b.z);if(distance<1.85&&(!best||distance<best.distance))best={kind:'building',target:b,label:'E · '+(b.passage?'Passage vers ':'Entrer · ')+b.name,distance};}return best;}
 function context(){if(!active)return near();const q=active,items=[];const add=(v,label,extra)=>{const distance=Math.hypot(p.x-v.x,p.z-v.z);if(distance<1.65)items.push({kind:'interior',distance,label:'E · '+label,...extra});};add(q.exit,q.floor?'Rejoindre le rez-de-chaussée':'Sortir dans la rue',{action:q.floor?'lobby':'exit'});if(q.floor<q.building.floors-1)add(q.stairs.up,'Escalier · étage '+(q.floor+1),{action:'up'});if(q.floor>0)add(q.stairs.down,q.floor===1?'Escalier · rez-de-chaussée':'Escalier · étage '+(q.floor-1),{action:'down'});for(const s of q.services)add(s,s.label+(s.price?' ('+s.price+' €)':''),{action:'service',service:s,placeIndex:q.placeIndex});for(const portal of q.portals)if(portal.placeIndex!==q.placeIndex)add(portal,'Changer · '+portal.label,{action:'local',placeIndex:portal.placeIndex,portal});return items.sort((a,b)=>a.distance-b.distance)[0]||null;}
 function load(b,floor=0,placeIndex=0){active=roomFor(b,floor,world,placeIndex);world.room=active;revision++;visits.add(b.id);const q=active.spawn;sim.relocate(q.x,q.z,q.yaw);notify(b.name+' · '+(floor?'étage '+floor:'rez-de-chaussée')+(active.place&&active.place.name?' · '+active.place.name:''));}
 function enter(b,placeIndex=null){if(active||!entries.includes(b)||Math.hypot(p.x-b.x,p.z-b.z)>1.85)return false;outside={x:p.x,z:p.z,yaw:p.yaw};load(b,0,Number.isInteger(placeIndex)?placeIndex:b.places?.length>1?-1:0);return true;}
 function respawnPolice(){for(const b of entries){const placeIndex=(b.places||[]).findIndex(place=>place.kind==='police'&&sourcedPlace(b,place));if(placeIndex<0)continue;outside={x:b.x,z:b.z,yaw:Math.atan2(b.nx,-b.nz)};load(b,0,placeIndex);notify('Commissariat · '+active.place.name+' · '+(active.place.address||b.address||''));return true;}return false;}
 function leave(){if(!active)return false;const b=active.building;active=null;world.room=null;revision++;const q=world.freeNear(outside?.x??b.x,outside?.z??b.z,.36);sim.relocate(q[0],q[1],outside?.yaw??Math.atan2(b.nx,-b.nz));notify('Rue · '+(b.address||b.name));return true;}
 function finiteCash(campaign){if(!campaign||!campaign.state||!Number.isFinite(campaign.state.cash)){notify('Argent indisponible.');return null;}return campaign.state.cash;}
 function useService(id,campaign){const q=active;if(!q){notify('Aucun commerce ouvert.');return false;}const service=q.services.find(s=>s.id===id);if(!service){notify('Service indisponible ici.');return false;}if(Math.hypot(p.x-service.x,p.z-service.z)>1.65){notify('Approchez-vous du comptoir.');return false;}if(q.merchant&&!(q.merchant.hp>0)){notify('Le commerçant est hors d\'état de servir.');return false;}
  if(service.kind==='food'){const hp=Number(p.hp),cash=finiteCash(campaign);if(cash===null)return false;if(!Number.isFinite(hp)||hp<=0){notify('Vous ne pouvez pas consommer.');return false;}if(hp>=100){notify('Rassasié · aucun soin à payer.');return false;}if(cash<service.price){notify('Il faut '+service.price+' €.');return false;}campaign.state.cash-=service.price;p.hp=Math.min(100,hp+25);purchased.add(service.id);notify(service.label+' · +'+Math.round(p.hp-hp)+' PV · −'+service.price+' €');return true;}
  if(service.kind==='map'){if(!campaign||!campaign.state){notify('Argent indisponible.');return false;}if(campaign.state.mapOwned){notify('Vous possédez déjà le plan.');return false;}const cash=finiteCash(campaign);if(cash===null)return false;if(cash<service.price){notify('Il faut '+service.price+' €.');return false;}campaign.state.cash-=service.price;campaign.state.mapOwned=true;purchased.add(service.id);notify('Plan acheté · M');return true;}
  if(service.kind==='plan'){notify('Consultez les panneaux publics du quartier, ou achetez un plan dans un commerce.');return true;}
  if(service.kind==='weapon'){if(!sim||typeof sim.selectWeapon!=='function'){notify('Armurerie incompatible.');return false;}if(!sim.selectWeapon(service.weapon)){notify('Arme de simulation non débloquée.');return false;}purchased.add(service.id);notify(service.label+' équipée');return true;}
  if(serviceHandlers.has(service.kind))return serviceHandlers.get(service.kind)(service,campaign)===true;
  if(service.kind==='vehicle'){notify('Aucun véhicule réel en stock.');return false;}
  notify('Service indisponible.');return false;}
 function interact(campaign){const target=context();if(!target)return false;if(!active)return enter(target.target);switch(target.action){case'exit':return leave();case'lobby':load(active.building,0,active.placeIndex);return true;case'up':load(active.building,active.floor+1,active.placeIndex);return true;case'down':load(active.building,active.floor-1,active.placeIndex);return true;case'service':return useService(target.service?.id,campaign);case'local':if(Number.isInteger(target.placeIndex)){load(active.building,0,target.placeIndex);return true;}return false;}return false;}
 function save(){return {visited:[...visits],purchased:[...purchased],active:active?{id:active.building.id,floor:active.floor,placeIndex:active.placeIndex,x:p.x,z:p.z,yaw:p.yaw,outside}:null};}
 if(saved?.active){const v=saved.active,b=entries.find(b=>b.id===v.id);if(b&&Number.isInteger(v.floor)&&v.floor>=0&&v.floor<b.floors){const placeIndex=Number.isInteger(v.placeIndex)?v.placeIndex:0;outside={x:b.x,z:b.z,yaw:Math.atan2(b.nx,-b.nz)};load(b,v.floor,placeIndex);if(Number.isFinite(v.x)&&Number.isFinite(v.z)&&!active.blocked(v.x,v.z,.35))sim.relocate(v.x,v.z,Number.isFinite(v.yaw)?v.yaw:0);}}
 return {entries,shared:data.shared,visits,purchased,near,context,interact,useService,setServiceHandler(kind,handler){if(typeof handler==='function')serviceHandlers.set(kind,handler);},respawnPolice,enter,leave,save,get active(){return active;},get outside(){return outside;},get revision(){return revision;},roomFor:(b,f=0,placeIndex=0)=>roomFor(b,f,world,placeIndex)};}
R.interiors={create,roomFor,catalog,types,names,colors};})(globalThis.RADE);
