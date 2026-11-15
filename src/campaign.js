/* RADE — fictional gang territory, businesses and local persistent progression. */
(function(R){'use strict';
const GANGS=[{id:'rade',name:'Votre équipe',color:[.18,.75,.64]},{id:'marins',name:'Les Marins',color:[.18,.43,.78]},{id:'cendres',name:'Les Cendres',color:[.86,.29,.14]},{id:'onyx',name:'Le Cercle Onyx',color:[.55,.30,.75]}];
const catalog=[['Épicerie du Quai',60,105,'shop',1,45],['Garage des Docks',-140,-2,'shop',2,65],['Café du Panier',-230,-80,'shop',2,55],['Atelier République',10,-160,'shop',3,75],['Comptoir Canebière',170,15,'shop',3,85],['Halles du Soleil',180,-190,'shop',1,60],['Quai Sud',62,205,'deal',1,90],['Passage des Docks',-185,15,'deal',2,100],['Traverse du Panier',-150,-160,'deal',2,110],['République Est',100,-85,'deal',3,120],['Traverse Belsunce',245,-60,'deal',3,130],['Passage Colbert',30,-260,'deal',1,95]];
function layout(world){
 const sites=[],box=(p,s,color,mat=0)=>world.addMesh({shape:'box',p,s,color,mat,outdoor:true});
 for(let i=0;i<catalog.length;i++){
  const [name,tx,tz,kind,gang,rate]=catalog[i],radius=kind==='shop'?3.1:1.4;let spot=null;
  for(let d=0;d<=65&&!spot;d+=1.5)for(let j=0;j<(d?32:1);j++){const x=tx+Math.cos(j*Math.PI/16)*d,z=tz+Math.sin(j*Math.PI/16)*d;if(Math.abs(x)>300||Math.abs(z)>300||world.blocked(x,z,radius)||sites.some(s=>Math.hypot(s.x-x,s.z-z)<18))continue;let road=false;for(const[dx,dz]of [[0,0],[radius,0],[-radius,0],[0,radius],[0,-radius]])if(world.city.surChaussee(x+dx,z+dz))road=true;if(!road){spot=[x,z];break;}}
  if(!spot)continue;const [x,z]=spot,site={id:'site-'+i,name,x,z,kind,gang,originalGang:gang,rate,guards:[],level:gang===3?3:gang===2?2:1};sites.push(site);const col=GANGS[gang].color;
  if(kind==='shop'){
   // Open-front commercial room: usable floor, two sides, rear wall and counter.
   box([x,.08,z],[4.4,.08,4.4],[.50,.47,.39]);box([x,1.5,z-2.13],[4.4,2.9,.13],[.64,.61,.50]);for(const side of [-1,1])box([x+side*2.13,1.5,z],[.13,2.9,4.4],[.64,.61,.50]);
   box([x,3.0,z],[4.6,.12,4.6],[.27,.31,.29]);box([x,2.65,z+2.24],[4.5,.46,.12],col,7);box([x,.62,z-.85],[2.3,1.08,.55],[.30,.23,.16]);
   for(let k=0;k<5;k++)box([x-1.4+k*.7,1.6,z-1.98],[.42,.65,.15],[.21+.08*k,.27,.27],7);
   box([x+.75,1.23,z-.85],[.25,.22,.27],[.06,.09,.11],7);
  }else{for(const [dx,dz]of [[-.5,-.4],[.5,.4]])box([x+dx,.36,z+dz],[.6,.62,.6],[.35,.29,.19]);box([x,1.65,z-.7],[.08,3.2,.08],[.25,.3,.29]);}
  const guardCount=kind==='shop'?2+Math.floor(site.level/2):3+Math.floor(site.level/3);
  for(let j=0;j<guardCount;j++){const [gx,gz]=world.freeNear(x+(j-1)*4,z+6+j*1.7,.7),id=world.combatWorld.enemies.length;site.guards.push(id);world.combatWorld.enemies.push({x:gx,z:gz,y:.08,yaw:Math.PI,type:j===1?1:0,gang,site:site.id,radeReserve:true});}
 }
 const boards=[];
 for(const [tx,tz]of [[72,121],[52,18],[-110,-28],[75,-110]]){const [x,z]=world.freeNear(tx,tz,.75);const b={x,z,id:'plan-'+boards.length};boards.push(b);box([x,1,z],[.08,2,.08],[.17,.25,.26]);box([x,1.7,z],[1.25,1,.12],[.13,.33,.37]);box([x,1.7,z+.07],[1.08,.81,.02],[.73,.72,.60]);for(let j=0;j<4;j++)box([x-.42+j*.28,1.7,z+.087],[.018,.70,.006],[.29,.43,.42]);box([x,1.7,z+.09],[.96,.02,.006],[.29,.43,.42]);}
 world.boards=boards;
 const reserves=[];for(let j=0;j<6;j++){reserves.push(world.combatWorld.enemies.length);world.combatWorld.enemies.push({x:world.combatWorld.spawn.x,z:world.combatWorld.spawn.z+30,y:.08,yaw:0,type:j%3===1?1:0,gang:2,radeReserve:true});}
 return {sites,reserves};
}
function create(world,sim,layout,{saved=null,now=Date.now(),notify=()=>{}}={}){
 const sites=layout.sites,initial=sim.state.enemies.map(e=>structuredClone(e)),p=sim.state.player,random=PDR.villeReelle.hasard(441);
 const law={heat:0,wanted:0,seen:false,lastKnown:null,quiet:0,arrest:0,mode:'calme',reportRevision:0,cooldown:0,lastArrest:null};
 const state={cash:200,xp:0,income:0,earned:0,kills:0,active:null,hold:0,raid:null,nextRaid:115,attackCount:0,offline:0,savedAt:now,mapOwned:false};let time=0,lastSiren=0,crimeTime=-100,lastSave=0;
 const finite=(v,f=0)=>Number.isFinite(v)?v:f;
 const inWorld=(x,z,margin=0)=>{const b=world.bounds||{minX:-325,maxX:325,minZ:-325,maxZ:325};return Number.isFinite(x)&&Number.isFinite(z)&&x>b.minX+margin&&x<b.maxX-margin&&z>b.minZ+margin&&z<b.maxZ-margin;};
 const owner=s=>GANGS[s.gang],income=()=>sites.filter(s=>s.gang===0&&!s.closed).reduce((v,s)=>v+s.rate*(1+(s.upgrade||0)*.35),0);
 function crime(amount=1){law.heat=Math.min(5,law.heat+amount);law.wanted=Math.ceil(law.heat);law.quiet=0;crimeTime=time;const point=world.room?.building||p;law.lastKnown={x:point.x,z:point.z};law.reportRevision=(law.reportRevision||0)+1;}
 function spawn(ids,site,gang,raid=false){ids.forEach((id,j)=>{const e=sim.state.enemies[id],base=initial[id];if(!e||!base)return;const [x,z]=world.freeNear(site.x+(raid?18:4)*(j%2?1:-1),site.z+(raid?14:5)+j*2,.6);Object.assign(e,structuredClone(base),{x,z,baseY:.08,y:.08+(e.type===1?1.05:1.35),hp:base.maxHp,deployed:true,combatEnabled:true,encounterReleased:true,injury:null,gang,hasMemory:true,lastSeenX:p.x,lastSeenZ:p.z,lastSeenY:p.y+1.6,memory:9,alert:1,awareness:'engage',goalX:p.x,goalZ:p.z});Object.assign(world.combatWorld.enemies[id],{x,z});});}
 function near(){return sites.filter(s=>Math.hypot(p.x-s.x,p.z-s.z)<(s.kind==='shop'?2.4:3)).sort((a,b)=>Math.hypot(p.x-a.x,p.z-a.z)-Math.hypot(p.x-b.x,p.z-b.z))[0]||null;}
 function begin(site,ambush=false){
  if(site?.closed){notify('Commerce fermé : le commerçant ne peut plus travailler.');return false;}
  if(!site||state.active||state.raid||(!ambush&&near()!==site))return false;
  if(site.gang===0){if(state.cash>=250&&(site.upgrade||0)<3){state.cash-=250;site.upgrade=(site.upgrade||0)+1;notify('Équipe renforcée · revenus +35 % · défense prolongée');}else notify('Sous votre contrôle · revenus automatiques : '+site.rate+' €/min.');return true;}
  state.active=site.id;state.hold=0;spawn(site.guards,site,site.gang);crime(1);notify((site.kind==='shop'?'Protection contestée : ':'Point de deal contesté : ')+site.name+'. Éliminez les gardes de '+owner(site).name+'.');return true;
 }
 function arrest(){if((law.cooldown||0)>0)return 0;const fine=Math.min(state.cash,Math.max(80,Math.round(state.cash*.25)));state.cash-=fine;law.heat=law.wanted=law.arrest=0;law.mode='calme';law.lastKnown=null;law.cooldown=10;law.lastArrest={fine,time};notify('Interpellé · '+fine+' € saisis.');return fine;}
 function capture(site){const former=site.gang;site.gang=0;state.cash+=100;state.xp+=100+site.level*25;state.active=null;state.hold=0;state.income=income();site.lastGang=former;notify(site.name+' rejoint votre réseau · +'+site.rate+' €/min.');crime(.5);}
 function raid(site,gang){if(state.raid||!site||site.gang!==0)return false;state.raid={site:site.id,gang,timer:100+(site.upgrade||0)*35,ids:layout.reserves.slice(0,3+Math.min(2,site.level)),presence:0};spawn(state.raid.ids,site,gang,true);state.attackCount++;notify('CONTRE-ATTAQUE · '+GANGS[gang].name+' attaque '+site.name+' !');return true;}
 function tick(dt,events=[]){
  time+=dt;law.cooldown=Math.max(0,(law.cooldown||0)-dt);state.income=income();const credit=state.income*dt/60;state.cash+=credit;state.earned+=credit;state.nextRaid-=dt;
  for(const e of events)if(e.name==='shot'||e.name==='fracture')crime(.22);else if(e.name==='kill'){state.xp+=20;state.kills++;}
  if(law.wanted){law.quiet=law.seen?0:law.quiet+dt;law.mode=law.seen?'poursuite':'recherche';if(law.quiet>22&&time-crimeTime>22)law.heat=Math.max(0,law.heat-dt*.13);law.wanted=Math.ceil(law.heat);if(!law.wanted){law.mode='calme';law.lastKnown=null;notify('Recherche abandonnée.');}}
  if(state.active){const site=sites.find(s=>s.id===state.active),remaining=site.guards.filter(id=>sim.state.enemies[id].hp>0).length,d=Math.hypot(p.x-site.x,p.z-site.z);
   if(!remaining){state.hold=d<5?Math.min(5,state.hold+dt):Math.max(0,state.hold-dt);if(state.hold>=5)capture(site);}
   if(d>120){site.guards.forEach(id=>sim.state.enemies[id].deployed=false);state.active=null;state.hold=0;notify('Prise abandonnée : vous avez quitté le secteur.');}
  }
  const own=sites.filter(s=>s.gang===0);if(state.nextRaid<=0&&!state.active&&!state.raid){if(own.length)raid(own[Math.floor(random()*own.length)],1+Math.floor(random()*3));state.nextRaid=145+random()*65;}
  if(state.raid){const a=state.raid,site=sites.find(s=>s.id===a.site),alive=a.ids.filter(id=>sim.state.enemies[id].hp>0);
   a.timer-=dt;if(!alive.length){state.cash+=180;state.xp+=100;state.raid=null;notify('Territoire défendu · +180 €');}
   else if(a.timer<=0){site.gang=a.gang;site.upgrade=0;a.ids.forEach(id=>sim.state.enemies[id].deployed=false);state.raid=null;notify(site.name+' a été repris par '+GANGS[site.gang].name+'.');}
  }
  // A higher-risk gang's controlled site can repel a prolonged armed incursion.
  if(!state.active&&!state.raid&&law.wanted>=2){const hostile=sites.find(s=>s.gang!==0&&s.level>=2&&Math.hypot(s.x-p.x,s.z-p.z)<15);if(hostile)begin(hostile,true);}
 }
 function area(){let site=null,d=Infinity;for(const s of sites){const q=Math.hypot(p.x-s.x,p.z-s.z);if(q<d){site=s;d=q;}}return site&&d<75?{name:site.name,gang:site.gang,risk:site.gang===0?0:site.level}: {name:'Vieux-Port',gang:1,risk:1};}
 function save(){return {version:2,savedAt:Date.now(),mapOwned:state.mapOwned,cash:state.cash,xp:state.xp,earned:state.earned,kills:state.kills,nextRaid:state.nextRaid,sites:sites.map(s=>({id:s.id,gang:s.gang,upgrade:s.upgrade||0,closed:!!s.closed})),active:state.active,hold:state.hold,raid:state.raid,law:{heat:law.heat,quiet:law.quiet,lastKnown:law.lastKnown,reportRevision:law.reportRevision,cooldown:law.cooldown,lastArrest:law.lastArrest},enemies:sim.state.enemies.map(e=>({id:e.id,x:e.x,z:e.z,hp:e.hp,deployed:e.deployed,gang:e.gang})),player:{x:p.x,z:p.z,yaw:p.yaw,hp:p.hp},cars:world.fleet.filter(c=>!c.ai).map(c=>({id:c.id,model:c.model,x:c.x,z:c.z,cap:c.cap,color:c.color}))};}
 function restore(v){
  if(!v||v.version!==2||!Number.isFinite(v.cash)||v.cash<0||!Array.isArray(v.sites))return false;
  state.mapOwned=v.mapOwned===true;state.cash=Math.min(v.cash,1e9);state.xp=Math.max(0,Math.min(finite(v.xp),1e8));state.earned=Math.max(0,finite(v.earned));state.kills=Math.max(0,finite(v.kills));state.nextRaid=Math.max(30,Math.min(240,finite(v.nextRaid,115)));
  for(const item of v.sites){const s=sites.find(s=>s.id===item?.id);if(s&&Number.isInteger(item.gang)&&item.gang>=0&&item.gang<4){s.gang=item.gang;s.closed=!!item.closed;s.upgrade=Math.max(0,Math.min(3,Math.floor(finite(item.upgrade))));}}
  const elapsed=Math.max(0,Math.min(8*3600,(now-(Number(v.savedAt)||now))/1000));state.offline=income()*elapsed/60;state.cash+=state.offline;state.earned+=state.offline;
  if(v.player&&inWorld(v.player.x,v.player.z,5)&&Number.isFinite(v.player.hp)&&v.player.hp>0){const q=world.freeNear(v.player.x,v.player.z,.34);Object.assign(p,{x:q[0],z:q[1],yaw:finite(v.player.yaw),hp:Math.max(1,Math.min(100,v.player.hp))});}
  for(const data of Array.isArray(v.enemies)?v.enemies:[]){const e=sim.state.enemies[data?.id];if(!e||!inWorld(data.x,data.z))continue;Object.assign(e,{x:data.x,z:data.z,hp:Math.max(0,Math.min(e.maxHp,Number(data.hp)||0)),deployed:!!data.deployed,gang:Number.isInteger(data.gang)&&data.gang>=0&&data.gang<4?data.gang:e.gang});}
  state.active=sites.some(s=>s.id===v.active&&s.gang!==0)?v.active:null;state.hold=Math.min(4.9,Math.max(0,finite(v.hold)));
  if(v.raid&&Array.isArray(v.raid.ids)&&v.raid.ids.length&&sites.some(s=>s.id===v.raid.site)&&Number.isInteger(v.raid.gang)&&v.raid.gang>0&&v.raid.gang<4){state.raid={site:v.raid.site,gang:v.raid.gang,timer:Math.max(15,Math.min(200,finite(v.raid.timer,100))),ids:layout.reserves.filter(id=>(Array.isArray(v.raid.ids)?v.raid.ids:[]).includes(id)),presence:0};}
  law.heat=Math.max(0,Math.min(5,finite(v.law?.heat)));law.wanted=Math.ceil(law.heat);law.quiet=0;if(v.law?.lastKnown&&inWorld(v.law.lastKnown.x,v.law.lastKnown.z))law.lastKnown={x:v.law.lastKnown.x,z:v.law.lastKnown.z};
  law.reportRevision=Math.max(0,Math.min(1e9,Math.floor(finite(v.law?.reportRevision,0))));law.cooldown=Math.max(0,Math.min(10,finite(v.law?.cooldown,0)));const lastArrest=v.law?.lastArrest;law.lastArrest=lastArrest&&Number.isFinite(lastArrest.fine)&&Number.isFinite(lastArrest.time)?{fine:Math.max(0,lastArrest.fine),time:lastArrest.time}:null;
  for(const data of Array.isArray(v.cars)?v.cars:[]){const c=world.fleet.find(c=>c.id===data?.id);if(!c||c.model!==data.model||![data.x,data.z,data.cap].every(Number.isFinite)||!inWorld(data.x,data.z,5))continue;const old={x:c.x,z:c.z,cap:c.cap,ai:c.ai};Object.assign(c,{x:data.x,z:data.z,cap:data.cap,ai:false});if(world.carContact(c))Object.assign(c,old);if(/^#[0-9a-f]{6}$/i.test(data.color))c.color=data.color;}
  return true;
 }
 if(saved)restore(saved);
 return {state,sites,law,near,heal(site=near()){if(!site||site.closed||near()!==site||site.gang!==0||p.hp>=100||p.hp<=0||state.cash<40)return false;state.cash-=40;p.hp=100;notify('Soins reçus · −40 €');return true;},buyMap(site=near()){if(!site||site.closed||site.kind!=='shop'||near()!==site||state.mapOwned||state.cash<60)return false;state.cash-=60;state.mapOwned=true;notify('Plan acheté · M pour le consulter.');return true;},begin,tick,crime,arrest,area,save,restore,raid,owner,income,get time(){return time;}};
}
R.campaign={GANGS,layout,create};})(globalThis.RADE);
