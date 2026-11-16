/* EMPRISE — persistent danger memory and local, bounded pedestrian steering. */
(function(R){'use strict';
// Separate stable behavioural seed: neither skin, clothing nor sex enters this choice.
function temperament(id){let h=Math.imul(id^0x6d2b79f5,0x45d9f3b);h=Math.imul(h^(h>>>16),0x45d9f3b);return ((h^(h>>>16))>>>0)%23===7?'provocateur':'civil';}
function create(world,n=480,{hurt=()=>{},notify=()=>{},allowAggression=false}={}){
 const nav=PDR.nav.creer(world.navCity,{capaciteChamps:16}),random=PDR.villeReelle.hasard(135),people=[],packed=new Float32Array(n*4),locomotion=new Float32Array(n*4),goals=[];
 const free=[];for(let i=0;i<nav.n;i++)if(nav.libre[i])free.push(i);
 if(!free.length)throw new Error('La foule nécessite des cellules piétonnes libres.');
 for(let i=0;i<12;i++){const cell=free[Math.floor(random()*free.length)];goals.push(cell);const k=nav.demander(cell,0);nav.prendre(k);}nav.avancer(12);
 for(let i=0;i<n;i++){
  let cell=free[Math.floor(random()*free.length)];if(i<140){const x=60+(random()-.5)*70,z=20+random()*180;cell=nav.caseProche(x*1000,z*1000);if(cell<0)cell=free[i%free.length];}
  people.push({hp:100,x:nav.centreX(cell)/1000,z:nav.centreZ(cell)/1000,cap:0,goal:i%goals.length,speed:.85+random()*.6,panic:0,fear:0,temperament:temperament(10000+i),hostility:0,aggression:0,encounter:0,provocationCooldown:8+(i%13),blocked:0,moveSpeed:0,walkDistance:0,gait:{phase:i*.618,amount:0},threat:null,turnWait:0,escapeX:0,escapeZ:0});
 }
 let tick=0,avoids=0;const angles=[0,.58,-.58,1.16,-1.16,1.8,-1.8,Math.PI];
 const turns=[-1,1].map(sign=>angles.map(a=>[Math.cos(a*sign),Math.sin(a*sign)])),noiseNames=['shot','enemyShot','explosion','vehicleExplosion'],pureQueries=world.collisionQueriesPure===true;
 // Scratch belongs to a single invocation. A callback can re-enter update;
 // its own depth slot must not overwrite the outer call's traffic or hash.
 let updateDepth=0;const scratch=[];
 function workAt(depth){return scratch[depth]||(scratch[depth]={moving:[],selected:[],vehicles:[],noises:[],hash:new Map(),rows:[],buckets:[]});}
 function move(p,dx,dz){if(!world.blocked(p.x+dx,p.z,.24))p.x+=dx;if(!world.blocked(p.x,p.z+dz,.24))p.z+=dz;}
 function route(p,vx,vz,i){
  const d=Math.hypot(vx,vz);if(d<.001)return [0,0];vx/=d;vz/=d;
  let best=-Infinity,bx=0,bz=0;
  for(let k=0;k<angles.length;k++){
   const turn=turns[i%2][k],c=turn[0],s=turn[1],x=vx*c-vz*s,z=vx*s+vz*c;
   // The production world promises side-effect-free collision queries. A
   // losing direction needs no geometry probes; keep strict > and tie order.
   // Custom worlds retain their original callback order unless they opt in.
   let score;if(pureQueries){score=x*vx+z*vz+(x*p.escapeX+z*p.escapeZ)*.16;if(!(score>best))continue;}
   const tx=p.x+x*1.35,tz=p.z+z*1.35,cell=nav.caseDe(tx*1000,tz*1000);
   if(cell<0||cell>=nav.n||!nav.libre[cell]||world.blocked(p.x+x*.6,p.z+z*.6,.27)||world.blocked(tx,tz,.27))continue;
   if(!pureQueries)score=x*vx+z*vz+(x*p.escapeX+z*p.escapeZ)*.16;
   if(score>best){best=score;bx=x;bz=z;}
  }
  return [bx,bz];
 }
 // Loading-only preparation of this crowd's actual route closure. No update,
 // random draw, navigation edit, motion, or callback belongs in this pass.
 function prewarmRouting(){
  if(!pureQueries)return 0;let count=0;
  for(let i=0;i<n;i++){const p=people[i];if(p.hp<=0)continue;const a=i*2.399963;route(p,Math.cos(a),Math.sin(a),i);count++;}
  return count;
 }
 function update(dt,events=[]){
  dt=Number.isFinite(dt)?Math.max(0,Math.min(.2,dt)):0;tick++;
  const work=workAt(updateDepth++);try{
  const {moving,selected,vehicles,noises,hash,rows,buckets}=work;moving.length=selected.length=0;
  const fleet=world.fleet;for(let i=0,length=fleet.length;i<length;i++){if(!(i in fleet))continue;const c=fleet[i];if(!c.hidden&&c.v>.3)selected.push(c);}
  for(const c of selected){const index=moving.length,q=vehicles[index]||(vehicles[index]={});q.x=c.x;q.z=c.z;q.cc=Math.cos(c.cap);q.ss=Math.sin(c.cap);q.direction=c.u<0?-1:1;q.speed=c.v;moving.push(q);}
  let aggressors=0;for(const p of people)if(p.hp>0&&p.aggression>0)aggressors++;
  noises.length=0;for(let i=0,length=events.length;i<length;i++){if(!(i in events))continue;const e=events[i];if(noiseNames.includes(e.name)&&Number.isFinite(e.x)&&Number.isFinite(e.z))noises.push(e);}
  hash.clear();let rowCount=0,bucketCount=0;
  for(let i=0;i<n;i++){const p=people[i];if(p.hp<=0)continue;const hx=Math.floor(p.x/2),hz=Math.floor(p.z/2);let row=hash.get(hz);if(!row){row=rows[rowCount]||(rows[rowCount]=new Map());rowCount++;row.clear();hash.set(hz,row);}let bucket=row.get(hx);if(!bucket){bucket=buckets[bucketCount]||(buckets[bucketCount]=[]);bucketCount++;bucket.length=0;row.set(hx,bucket);}bucket.push(i);}
  for(let i=0;i<n;i++){
   const p=people[i];if(p.hp<=0){p.moveSpeed=0;packed[i*4]=p.x;packed[i*4+1]=p.z;packed[i*4+2]=p.cap;packed[i*4+3]=PDR.regles.coder(3,i%10,0,0,0);continue;}
   // A nearby altercation owns the pose; moving traffic still takes priority.
   if(p._altercationPose&&!p.altercation){if(Number.isFinite(p.yaw))p.cap=Math.PI-p.yaw;delete p.yaw;delete p._altercationPose;}
   if(p.altercation){
    const danger=moving.some(car=>{const dx=p.x-car.x,dz=p.z-car.z,u=(dx*car.cc+dz*car.ss)*car.direction,v=-dx*car.ss+dz*car.cc;return u>=-3&&u<=6+car.speed*.7&&Math.abs(v)<=2.4;});
    if(danger)p.altercation.danger=true;
    else{
     const old=p._altercationPose,moved=old?Math.hypot(p.x-old.x,p.z-old.z):0;p._altercationPose={x:p.x,z:p.z};p.walkDistance+=moved;
     if(Number.isFinite(p.yaw))p.cap=Math.PI-p.yaw;
     const gait=p.gait,phase=gait.phase,amount=gait.amount;R.people.advanceGait(gait,moved,p.moveSpeed||0,dt);
     locomotion[i*4]=phase;locomotion[i*4+1]=gait.phase;locomotion[i*4+2]=amount;locomotion[i*4+3]=gait.amount;
     packed[i*4]=p.x;packed[i*4+1]=p.z;packed[i*4+2]=p.cap;packed[i*4+3]=PDR.regles.coder(3,i%10,0,63,0);continue;
    }
   }
   const cell=nav.caseDe(p.x*1000,p.z*1000),field=nav.champs[p.goal],code=cell>=0&&cell<nav.n&&field?field.dir[cell]:PDR.nav.AUCUN;
   if(code===PDR.nav.BUT||(code===PDR.nav.AUCUN&&tick%20===i%20))p.goal=(p.goal+1+(i%3))%goals.length;
   let vx=0,vz=0;if(code>=0&&code<128){vx=PDR.nav.DX[code*2]/1024||0;vz=PDR.nav.DZ[code*2]/1024||0;}
   const fearless=p.temperament==='provocateur',target=world.player,canReachPlayer=target&&target.hp>0&&!world.playerSeated&&!world.room;
   p.aggression=Math.max(0,(p.aggression||0)-dt);p.provocationCooldown=Math.max(0,(p.provocationCooldown||0)-dt);p.attackWait=Math.max(0,(p.attackWait||0)-dt);p.strike=Math.max(0,(p.strike||0)-dt);
   p.panic=Math.max(0,p.panic-dt);p.fear=Math.max(0,(p.fear||0)-dt*.06);p.turnWait=Math.max(0,p.turnWait-dt);
   for(const e of fearless?[]:noises){
    const d=Math.hypot(p.x-e.x,p.z-e.z),blast=e.name==='explosion'||e.name==='vehicleExplosion';if(d>(blast?65:36))continue;
    if(!p.threat||p.panic<2||d<Math.hypot(p.x-p.threat.x,p.z-p.threat.z)+5){p.threat={x:e.x,z:e.z};p.turnWait=0;}
    p.fear=Math.min(1,p.fear+(blast?.8:.4)*(1-d/(blast?80:45)));
    p.panic=Math.max(p.panic,blast?7:4.5+(i%5)*.25);
   }
   if(fearless){p.fear=0;p.panic=0;p.threat=null;}
   let pursuing=false;
   if(allowAggression&&fearless&&canReachPlayer&&!p.altercation){
    const dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz);
    const visible=d<18&&(!world.ray||world.ray([p.x,1.25,p.z],[dx/(d||1),0,dz/(d||1)],d)>=d);
    if(!p.aggression&&p.provocationCooldown<=0&&aggressors<2&&d<5&&visible&&!p.injury?.leg){p.encounter=(p.encounter||0)+dt;if(p.encounter>.8){p.aggression=12;p.hostility=1;p.encounter=0;aggressors++;notify('Un passant vous prend à partie.');}}else p.encounter=0;
    if(p.aggression>0){
     if(d>20||!visible){p.aggression=Math.max(0,p.aggression-dt*2);}else{pursuing=true;const direction=route(p,dx,dz,i);vx=d>1.05?direction[0]:0;vz=d>1.05?direction[1]:0;
      if(d<1.5&&p.attackWait<=0&&!p.injury?.leg){hurt(p.injury?.arm?2:5,p);p.strike=.4;p.attackWait=1.25;}
     }
     p.provocationCooldown=45;
    }
   }else if(p.aggression>0){p.aggression=0;p.provocationCooldown=45;}
   if(!p.aggression)p.hostility=Math.max(0,(p.hostility||0)-dt*.1);
   let trafficDanger=false;
   for(const car of moving){
    const dx=p.x-car.x,dz=p.z-car.z,u=(dx*car.cc+dz*car.ss)*car.direction,v=-dx*car.ss+dz*car.cc;
    if(u<-3||u>6+car.speed*.7||Math.abs(v)>2.4)continue;
    const side=v===0?(i%2?1:-1):Math.sign(v);vx=-car.ss*side;vz=car.cc*side;
    p.threat={x:car.x,z:car.z};p.panic=Math.max(p.panic,1.3);p.escapeX=vx;p.escapeZ=vz;p.turnWait=0;trafficDanger=true;avoids++;break;
   }
   if(p.fear>.32&&p.threat)p.panic=Math.max(p.panic,.4);
   if(p.panic>0&&p.threat){
    if(!trafficDanger){vx=p.x-p.threat.x;vz=p.z-p.threat.z;if(Math.hypot(vx,vz)<.05){const a=i*2.399963;vx=Math.cos(a);vz=Math.sin(a);}}
    if(p.turnWait<=0){const direction=route(p,vx,vz,i);p.escapeX=direction[0];p.escapeZ=direction[1];p.turnWait=.28+(i%5)*.035;}
    vx=p.escapeX;vz=p.escapeZ;
   }else{p.threat=null;if(p.blocked>.25){const direction=route(p,vx||Math.sin(p.cap),vz||Math.cos(p.cap),i);vx=direction[0];vz=direction[1];}}
   const hx=Math.floor(p.x/2),hz=Math.floor(p.z/2);
   for(let zz=-1;zz<=1;zz++){const row=hash.get(hz+zz);if(!row)continue;for(let xx=-1;xx<=1;xx++){const bucket=row.get(hx+xx);if(!bucket)continue;for(const j of bucket){if(j===i)continue;const q=people[j],a=p.x-q.x,b=p.z-q.z,d=Math.hypot(a,b);if(d>.001&&d<.78){vx+=a/d*(.78-d)*2;vz+=b/d*(.78-d)*2;}}}}
   const length=Math.hypot(vx,vz),speed=p.injury?.leg?.35:p.panic?3.1:pursuing?2.25:p.speed,scale=length>.001?speed*dt/Math.max(1,length):0,dx2=vx*scale,dz2=vz*scale,ox=p.x,oz=p.z;
   if(world.blocked(p.x,p.z,.24))world.withoutCar(()=>move(p,dx2,dz2));else move(p,dx2,dz2);
   const moved=Math.hypot(p.x-ox,p.z-oz);p.moveSpeed=dt?moved/dt:0;p.walkDistance+=moved;p.blocked=moved<.002?p.blocked+dt:0;
   const gait=p.gait,previousPhase=gait.phase,previousAmount=gait.amount;R.people.advanceGait(gait,moved,p.moveSpeed,dt);locomotion[i*4]=previousPhase;locomotion[i*4+1]=gait.phase;locomotion[i*4+2]=previousAmount;locomotion[i*4+3]=gait.amount;
   if(p.blocked>.4)p.turnWait=0;
   if(p.blocked>2){p.goal=(p.goal+1)%goals.length;p.blocked=0;}
   if(moved>.001){const target=Math.atan2(p.x-ox,p.z-oz),delta=Math.atan2(Math.sin(target-p.cap),Math.cos(target-p.cap));p.cap+=Math.max(-dt*9,Math.min(dt*9,delta));}
   packed[i*4]=p.x;packed[i*4+1]=p.z;packed[i*4+2]=p.cap;packed[i*4+3]=PDR.regles.coder(p.injury||p.aggression>0||p.altercation?3:i%3,i%10,moved>.001?(p.panic?8:1):0,63,0);
  }
  }finally{updateDepth--;}
 }
 update(0);return {people,packed,locomotion,nav,update,prewarmRouting,get avoids(){return avoids;},n,get version(){return tick;}};
}R.crowd={create,temperament};})(globalThis.RADE=globalThis.RADE||{});
