/* FERRO — original articulated mechanical actors. No models or textures imported. */
(function (G) {
  'use strict';
  const PI=Math.PI,TAU=PI*2,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const identity=[1,0,0,0,1,0,0,0,1];
  // Renderer order is Rz * Ry * Rx. Compose complete joint frames so a rolled
  // shoulder, gun elevation and world heading keep the same physical axes.
  function rotation(x=0,y=0,z=0){
    const a=Math.cos(x),b=Math.sin(x),c=Math.cos(y),d=Math.sin(y),e=Math.cos(z),f=Math.sin(z);
    return [e*c,e*d*b-f*a,e*d*a+f*b,f*c,f*d*b+e*a,f*d*a-e*b,-d,c*b,c*a];
  }
  function product(a,b){const c=new Array(9);for(let r=0;r<3;r++)for(let k=0;k<3;k++)c[r*3+k]=a[r*3]*b[k]+a[r*3+1]*b[k+3]+a[r*3+2]*b[k+6];return c;}
  function angles(a){const y=Math.asin(clamp(-a[6],-1,1));return Math.abs(Math.cos(y))>.000001?[Math.atan2(a[7],a[8]),y,Math.atan2(a[3],a[0])]:[Math.atan2(-a[5],a[4]),y,0];}
  function point(f,p){const a=f.b;return [f.p[0]+a[0]*p[0]+a[1]*p[1]+a[2]*p[2],f.p[1]+a[3]*p[0]+a[4]*p[1]+a[5]*p[2],f.p[2]+a[6]*p[0]+a[7]*p[1]+a[8]*p[2]];}
  function frame(parent,p,r=[0,0,0]){const b=product(parent.b,rotation(...r));return {p:point(parent,p),b,r:angles(b)};}
  function build(e,options={}) {
    if(e.hp!==undefined&&e.hp<=0)return [];
    const time=Number.isFinite(options.time)?options.time:0,type=clamp(Math.floor(e.type||0),0,3),distance=Math.max(0,Number(options.distance)||0);
    const scale=type===3&&Number.isFinite(e.bossScale)?clamp(e.bossScale,1,9):1,giant=scale>1;
    const canvas=options.backend==='canvas2d',low=options.quality==='low',near=low?7:canvas?9:11,far=canvas?22:low?26:35;
    // A thirty-metre silhouette needs close geometry at a very different distance
    // from a human-sized patrol. The LOD decision follows its projected size.
    const lod=distance/scale<near?0:distance/scale<far?1:2,stun=e.stun>0,charge=e.windup>0?clamp(1-e.windup/(e.windupMax||1),0,1):0;
    const rich=lod===0&&!canvas&&!low;
    const airborne=!!e.airborne;
    const aim=e.attackState==='aim'||e.attackState==='burst'||e.windup>0?1:0,rush=e.attackState==='rush';
    const phase=Number.isFinite(options.phase)?options.phase:time*(e.moveSpeed||0)*4.8/scale+(e.id||0)*.7;
    const blend=stun?0:clamp(options.blend??(e.moveSpeed||0)/1.4,0,1),base=Number.isFinite(e.baseY)?e.baseY:(Number(e.y)||[1.35,1.05,1.6,1.8][type])-[1.35,1.05,1.6,1.8][type];
    const yaw=Number.isFinite(e.yaw)?-e.yaw:0,b=rotation(0,yaw,0),root={p:[e.x||0,base,e.z||0],b,r:angles(b)},out=[];
    const hurt=clamp((e.hurt||0)*3,0,.45),mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
    const palette={shell:mix([.24,.28,.31],[.61,.54,.43],hurt),steel:[.56,.62,.64],edge:[.34,.39,.42],trim:[.34,.29,.22],dark:[.085,.105,.12],rubber:[.055,.068,.078],glass:[.10,.20,.23]};
    if(giant){
      const scheme=e.bossKind==='siegebreaker'?[[.23,.20,.18],[.37,.29,.22],[.60,.34,.13]]:e.bossKind==='custodian'?[[.43,.46,.43],[.25,.32,.34],[.57,.52,.36]]:[[.25,.29,.25],[.37,.41,.32],[.49,.37,.23]];
      palette.shell=mix(scheme[0],[.66,.49,.30],hurt);palette.edge=scheme[1];palette.trim=scheme[2];
    }
    const peaceful=e.awareness==='patrol',scanning=e.awareness==='search'||e.awareness==='investigate';
    const signal=stun||peaceful?[.20,.67,.70]:charge||scanning?[.86,.49,.14]:[.80,.20,.075];
    const emission=stun?.20+.08*Math.sin(time*9):.28+charge*.45,signalMat=stun||peaceful?4:charge||scanning?5:6;
    function piece(name,shape,p,s,skin='shell',f=root,r=null,mat=0,emissive=0){
      const color=Array.isArray(skin)?skin:palette[skin],rot=r?angles(product(f.b,rotation(...r))):f.r;
      const m={shape,p:point(f,p),s,r:rot,mat,color,emissive,surface:'object',actorPart:name,actorLod:lod};out.push(m);return m;
    }
    const box=(n,p,s,skin='shell',f=root,r=null)=>piece(n,'box',p,s,skin,f,r,skin==='rubber'?7:0);
    const armor=(n,p,s,skin='shell',f=root,r=null)=>piece(n,lod===0?'bevel':'box',p,s,skin,f,r);
    const cyl=(n,p,s,skin='steel',f=root,r=null)=>piece(n,'cylinder',p,s,skin,f,r,skin==='rubber'?7:0);
    const ring=(n,p,s,skin='edge',f=root,r=null)=>piece(n,'ring',p,s,skin,f,r);
    const eye=(n,p,s,f=root,r=null,shape='box')=>piece(n,shape,p,s,signal,f,r,signalMat,emission);
    function limb(name,a,c,width,depth,skin='edge',shape='box',reference=root.b){
      const dy=c.map((v,i)=>v-a[i]),length=Math.hypot(...dy);
      if(length<.0001)return;
      const y=dy.map(v=>v/length),axis=Math.abs(reference[0]*y[0]+reference[3]*y[1]+reference[6]*y[2])>.95?2:0;
      const ref=[reference[axis],reference[axis+3],reference[axis+6]],dot=ref[0]*y[0]+ref[1]*y[1]+ref[2]*y[2];
      const side=ref.map((v,i)=>v-dot*y[i]),n=Math.hypot(...side),x=side.map(v=>v/n),z=[x[1]*y[2]-x[2]*y[1],x[2]*y[0]-x[0]*y[2],x[0]*y[1]-x[1]*y[0]];
      const b=[x[0],y[0],z[0],x[1],y[1],z[1],x[2],y[2],z[2]],f={p:a.map((v,i)=>(v+c[i])/2),b,r:angles(b)};
      const inset=/(?:thigh|shin|upper-arm|forearm)/.test(name)?Math.min(length*.24,width*.42):0;
      return piece(name,shape,[0,0,0],[width,length-inset,depth],skin,f);
    }
    function joint(name,p,size,skin='dark',f=root){return cyl(name,p,[size,size*.62,size],skin,f,[0,0,PI/2]);}
    function pitch(height){return Number.isFinite(e.aimY)&&Number.isFinite(e.aimX)&&Number.isFinite(e.aimZ)?clamp(Math.atan2(e.aimY-base-height*scale,Math.hypot(e.aimX-(e.x||0),e.aimZ-(e.z||0))),-.9,.9):0;}
    function heavy(){
      const launcher=e.weapon==='rocket',grenadier=e.weapon==='grenade',armed=launcher||grenadier;
      const bounce=airborne?0:Math.sin(phase*2)*.025*blend,lean=stun?-.10:airborne?.07:rush?.15:.025*blend;
      const body=frame(root,[0,.9+bounce,0],[-lean,0,stun?Math.sin(time*23)*.035:airborne?0:Math.sin(phase)*.018*blend]);
      const head=frame(body,[0,.98,-.035],[.10,0,0]);
      const gun=frame(body,[.23,.43,-.29],[aim?pitch(1.33)+lean:-.23,0,0]);
      const legs=[];
      for(const side of [-1,1]){
        const t=phase+(side<0?0:PI),lift=airborne?.18+.15*clamp(((e.airVY||0)+10)/22,0,1):Math.max(0,Math.cos(t))*.16*blend,stride=airborne?.12+side*.035:Math.sin(t)*.29*blend*(rush?1.25:1);
        const hip=point(body,[side*.25,-.025,0]),ankle=point(root,[side*.27,.23+lift,stride+.015]);
        const kneeY=airborne?.68:.49+lift*.4,kneeZ=airborne?-.25:stride*.52-.095,knee=point(root,[side*.28,kneeY,kneeZ]);
        legs.push({side,hip,knee,ankle,lift,stride,kneeY,kneeZ});
      }
      if(lod===2){
        box('torso',[0,.46,-.01],[1.08,.64,.65],'shell',body);box('helmet',[0,0,0],[.5,.4,.49],'dark',head);
        eye('visor',[0,.035,-.247],[.34,.055,.022],head);
        for(const l of legs)limb('leg-'+l.side,l.hip,l.ankle,.29,.36,'dark');
        box(launcher?'rocket-launcher':grenadier?'grenade-launcher':'rifle',[0,.015,-.30],launcher?[.31,.32,1.25]:grenadier?[.28,.27,1.05]:[.19,.20,.91],launcher?'trim':'dark',gun);return;
      }
      box('pelvis',[0,-.005,.02],[.69,.27,.47],'dark',body);
      armor('torso',[0,.48,-.015],[.98,.56,.61],'shell',body);
      armor('helmet',[0,0,0],[.5,.4,.49],'shell',head);
      eye('visor',[0,.035,-.247],[.34,.055,.022],head);
      ring('neck-bearing',[0,.765,-.015],[.40,.075,.40],'steel',body);
      box('backpack',[0,.48,.37],launcher?[.64,.65,.30]:[.60,.55,.22],'dark',body);
      for(const side of [-1,1]){
        armor('shoulder-'+side,[side*.61,.57,.005],[.34,.34,.48],'shell',body,[0,0,-side*.12]);
        const shoulder=point(body,[side*.54,.51,.005]),elbow=point(body,[side>0?.60:-.44,side>0?.19:.22,side>0?.015:-.24]);
        const hand=point(gun,side>0?[.03,-.14,.12]:[-.18,-.07,-.31]);
        if(lod===1)limb('arm-'+side,shoulder,hand,.23,.27,'edge');
        else{
          limb('upper-arm-'+side,shoulder,elbow,.245,.27,'edge');
          joint('elbow-'+side,[side>0?.60:-.44,side>0?.19:.22,side>0?.015:-.24],.25,'steel',body);
          limb('forearm-'+side,elbow,hand,.23,.29,'shell');
          box('hand-'+side,side>0?[.03,-.14,.12]:[-.18,-.07,-.31],[.15,.15,.20],'rubber',gun);
        }
      }
      for(const l of legs){
        if(lod===1)limb('leg-'+l.side,l.hip,l.ankle,.30,.34,'edge');
        else{
          limb('thigh-'+l.side,l.hip,l.knee,.31,.34,'shell');
          limb('shin-'+l.side,l.knee,l.ankle,.26,.29,'edge');
          joint('hip-'+l.side,[l.side*.25,-.025,0],.25,'steel',body);
          joint('knee-'+l.side,[l.side*.28,l.kneeY,l.kneeZ],.265,'steel');
          box('knee-plate-'+l.side,[l.side*.28,l.kneeY+.01,l.kneeZ-.163],[.25,.25,.075],'trim');
          limb('leg-piston-'+l.side,point(root,[l.side*.37,.73,l.stride*.20+.12]),point(root,[l.side*.37,.27+l.lift,l.stride+.12]),.065,.065,'steel','cylinder');
        }
        box('boot-'+l.side,[l.side*.27,.11+l.lift,l.stride-.07],[.34,.22,.51],'rubber');
      }
      if(launcher){
        cyl('launcher-tube',[0,.045,-.43],[.32,1.08,.32],'shell',gun,[PI/2,0,0]);
        box('launcher-grip',[0,-.17,-.13],[.14,.27,.19],'dark',gun);
      }else{
        box('rifle-receiver',[0,.015,-.14],grenadier?[.30,.27,.60]:[.23,.23,.55],'dark',gun);
        cyl('rifle-barrel',[0,.045,-.67],grenadier?[.23,.58,.23]:[.11,.58,.11],'steel',gun,[PI/2,0,0]);
      }
      if(lod===1)return;
      cyl('abdomen',[0,.17,.015],[.48,.25,.38],'rubber',body);
      for(const side of [-1,1])armor('chest-plate-'+side,[side*.188,.52,-.33],[.34,.35,.12],'edge',body,[0,side*.08,side*.035]);
      box('visor-frame',[0,.035,-.237],[.425,.135,.035],'dark',head);
      box('face-guard',[0,-.11,-.242],[.25,.12,.10],'dark',head,[.18,0,0]);
      box('chest-breather',[0,.53,-.410],[.065,.22,.022],'dark',body);
      box('unit-badge',[-.28,.68,-.403],[.14,.035,.020],launcher?[.75,.27,.10]:grenadier?[.72,.58,.18]:'trim',body);
      if(!launcher)box('rifle-handguard',[0,.045,-.43],grenadier?[.27,.24,.30]:[.20,.19,.30],'shell',gun);
      cyl(armed?'launcher-muzzle':'rifle-muzzle',[0,.045,-.96],launcher?[.38,.09,.38]:grenadier?[.30,.09,.30]:[.165,.09,.165],'dark',gun,[PI/2,0,0]);
      cyl(armed?'launcher-bore':'rifle-bore',[0,.045,-1.005],launcher?[.25,.012,.25]:grenadier?[.17,.012,.17]:[.085,.012,.085],'rubber',gun,[PI/2,0,0]);
      if(launcher){
        for(const side of [-1,1]){cyl('spare-rocket-'+side,[side*.19,.49,.57],[.15,.63,.15],'trim',body);piece('rocket-tip-'+side,'octa',[side*.19,.87,.57],[.15,.18,.15],'dark',body);}
        ring('launcher-rear',[0,.045,.13],[.36,.08,.36],'trim',gun,[PI/2,0,0]);
        box('launcher-sight',[0,.25,-.20],[.065,.13,.25],'dark',gun);
        eye('launcher-arming',[.168,.08,-.17],[.012,.025,.11],gun);
      }else if(grenadier){
        cyl('grenade-drum',[.09,-.15,-.20],[.37,.32,.37],'trim',gun,[0,0,PI/2]);
        for(let j=0;j<3;j++){cyl('grenade-belt-'+j,[-.26+j*.25,.20,-.37],[.14,.25,.14],'trim',body);box('grenade-cap-'+j,[-.26+j*.25,.335,-.37],[.085,.04,.085],'dark',body);}
        box('grenade-range-sight',[0,.23,-.19],[.055,.12,.27],'dark',gun);
      }else{
        box('rifle-magazine',[0,-.18,-.13],[.15,.26,.18],'trim',gun,[-.13,0,0]);
        cyl('rifle-scope',[0,.205,-.18],[.115,.25,.115],'dark',gun,[PI/2,0,0]);
        eye('scope-lens',[0,.205,-.309],[.075,.015,.075],gun,[PI/2,0,0],'cylinder');
      }
      if(rich)for(const side of [-1,1]){
        for(const y of [-.12,.12])cyl('detail-helmet-bolt-'+side+'-'+y,[side*.20,y,-.251],[.035,.012,.035],'steel',head,[PI/2,0,0]);
        box('detail-chest-seam-'+side,[side*.35,.50,-.404],[.018,.21,.014],'steel',body);
        const plate=frame(body,[side*.188,.52,-.33],[0,side*.08,side*.035]);
        box('detail-chest-laminate-'+side,[0,.015,-.072],[.265,.27,.024],'trim',plate);
        box('detail-chest-intake-'+side,[0,-.005,-.087],[.17,.13,.006],'rubber',plate);
      }
      if(rich)for(const l of legs){
        const upper=point(root,[l.side*.37,.73,l.stride*.20+.12]),lower=point(root,[l.side*.37,.27+l.lift,l.stride+.12]);
        limb('detail-leg-jacket-'+l.side,upper,upper.map((v,i)=>v+(lower[i]-v)*.55),.108,.108,'dark','cylinder');
        cyl('detail-knee-cap-'+l.side,[l.side*.37,l.kneeY,l.kneeZ],[.14,.025,.14],'steel',root,[0,0,PI/2]);
      }
    }
    function drone(){
      const hover=1.35+Math.sin(time*2.2+(e.id||0))*.045,bank=stun?.18:Math.sin(time*1.5+(e.id||0))*.025+(e.tactic==='flank'?.075:0);
      const body=frame(root,[0,hover,0],[stun?.16:-blend*.055,0,bank]);
      const hubs=[];for(const side of [-1,1])for(const end of [-1,1])hubs.push([side*.58,0,end*.36]);
      if(lod===2){
        box('drone-hull',[0,0,0],[.72,.60,.82],'shell',body);eye('camera',[0,-.04,-.43],[.23,.13,.04],body);
        for(const [i,h] of hubs.entries())cyl('rotor-pod-'+i,h,[.44,.10,.44],'dark',body);return;
      }
      armor('drone-hull',[0,0,0],[.72,.34,.82],'shell',body);
      armor('drone-carapace',[0,.20,.055],[.60,.16,.58],'edge',body);
      eye('camera',[0,-.12,-.66],[.18,.035,.18],body,[PI/2,0,0],'cylinder');
      cyl('drone-gun',[0,-.24,-.36],[.12,.55,.12],'dark',body,[PI/2,0,0]);
      for(const [i,h] of hubs.entries()){
        limb('rotor-arm-'+i,point(body,[Math.sign(h[0])*.20,0,Math.sign(h[2])*.13]),point(body,h),.105,.14,'steel');
        ring('rotor-duct-'+i,h,[.48,.10,.48],'shell',body);
        cyl('rotor-motor-'+i,[h[0],.035,h[2]],[.14,.14,.14],'dark',body);
        if(lod===0)for(let k=0;k<2;k++)box('rotor-blade-'+i+'-'+k,[h[0],.074,h[2]],[.39,.018,.045],'edge',body,[0,time*(stun?1.2:31)*(i%2?-1:1)+i*.7+k*PI/2,0]);
      }
      if(lod===1)return;
      armor('drone-nose',[0,-.015,-.415],[.46,.25,.22],'trim',body);
      cyl('camera-gimbal',[0,-.12,-.465],[.28,.23,.28],'dark',body,[0,0,PI/2]);
      ring('camera-bezel',[0,-.12,-.625],[.27,.075,.27],'steel',body,[PI/2,0,0]);
      box('drone-keel',[0,-.235,.08],[.28,.19,.43],'dark',body);
      ring('drone-muzzle',[0,-.24,-.64],[.17,.065,.17],'steel',body,[PI/2,0,0]);
      for(const side of [-1,1]){
        box('drone-exhaust-'+side,[side*.18,.035,.424],[.19,.13,.035],'rubber',body);
        box('landing-skid-'+side,[side*.27,-.35,.04],[.055,.07,.49],'steel',body);
      }
      cyl('drone-aerial',[0,.40,.19],[.026,.29,.026],'edge',body);
      eye('drone-status',[0,.55,.19],[.055,.055,.055],body,null,'sphere');
      if(rich)for(const side of [-1,1]){
        for(const z of [-.31,.31])cyl('detail-drone-bolt-'+side+'-'+z,[side*.28,.177,z],[.035,.014,.035],'steel',body);
        box('detail-drone-grille-'+side,[side*.15,-.015,-.529],[.05,.09,.012],'dark',body);
        box('detail-drone-intake-'+side,[side*.374,-.025,-.23],[.028,.17,.28],'rubber',body);
        for(const y of [-.07,.025])box('detail-drone-louver-'+side+'-'+y,[side*.395,y,-.23],[.014,.018,.24],'steel',body);
        limb('detail-drone-optic-feed-'+side,point(body,[side*.285,-.13,-.38]),point(body,[side*.1,-.11,-.56]),.045,.045,'steel','cylinder',body.b);
      }
    }
    function sentinel(){
      const fixed={p:root.p,b:identity,r:[0,0,0]},body=frame(root,[0,1.60,0],[stun?-.12:0,0,stun?Math.sin(time*15)*.025:0]);
      const recoil=e.attackState==='burst'?Math.max(0,Math.sin(time*37))*.07:0,gun=frame(body,[0,-.10,recoil],[aim?pitch(1.50):-.035,0,0]);
      if(lod===2){
        cyl('turret-foot',[0,.14,0],[1.28,.28,1.28],'dark',fixed);cyl('turret-pivot',[0,.80,0],[.33,1.1,.33],'edge',fixed);
        box('turret-hull',[0,0,0],[.87,.55,.74],'shell',body);eye('turret-optic',[0,.13,-.405],[.23,.14,.055],body);
        for(const side of [-1,1])box('turret-barrel-'+side,[side*.36,0,-.58],[.15,.18,.95],'dark',gun);return;
      }
      const feet=[],motionYaw=Number.isFinite(e.goalX)&&Number.isFinite(e.goalZ)?Math.atan2(e.goalX-(e.x||0),(e.z||0)-e.goalZ):-yaw;
      for(let i=0;i<3;i++){
        const a=i*TAU/3+PI/6,x=Math.cos(a)*.76,z=Math.sin(a)*.76,t=((phase+i*TAU/3)%TAU+TAU)%TAU;
        const swing=t<TAU/3,u=swing?t/(TAU/3):(t-TAU/3)/(TAU*2/3),stride=airborne?0:(swing?-1+2*u:1-2*u)*.25*blend,lift=airborne?.22:swing?Math.sin(u*PI)*.115*blend:0;
        const footX=x*(airborne?.85:1)+Math.sin(motionYaw)*stride,footZ=z*(airborne?.85:1)-Math.cos(motionYaw)*stride;
        box('turret-pad-'+i,[footX,.08+lift,footZ],[.33,.16,.40],'rubber',fixed,[0,-a,0]);
        limb('turret-strut-'+i,point(fixed,[footX,.18+lift,footZ]),point(fixed,[x*.37,.78,z*.37]),.17,.19,'edge','box',fixed.b);feet.push({x,z,a,footX,footZ,lift});
      }
      cyl('turret-pivot',[0,1.02,0],[.37,.78,.37],'steel',fixed);
      ring('turret-swivel',[0,1.28,0],[.64,.10,.64],'dark',fixed);
      armor('turret-hull',[0,0,0],[.86,.54,.76],'shell',body);
      armor('turret-rear',[0,.06,.31],[.68,.38,.27],'edge',body);
      eye('turret-optic',[0,.14,-.497],[.22,.15,.055],body,null,'sphere');
      for(const side of [-1,1]){
        box('turret-receiver-'+side,[side*.37,0,-.25],[.22,.29,.47],'dark',gun);
        cyl('turret-barrel-'+side,[side*.37,0,-.79],[.14,.73,.14],'steel',gun,[PI/2,0,0]);
      }
      if(lod===1)return;
      cyl('turret-foundation',[0,.19,0],[.64,.29,.64],'dark',fixed);
      for(const [i,f] of feet.entries()){
        joint('turret-hinge-'+i,[f.x*.37,.78,f.z*.37],.24,'dark',fixed);
        limb('turret-piston-'+i,point(fixed,[f.footX*.82,.29+f.lift,f.footZ*.82]),point(fixed,[f.x*.23,.92,f.z*.23]),.058,.058,'steel','cylinder',fixed.b);
      }
      for(const side of [-1,1])armor('turret-cheek-'+side,[side*.40,.09,-.10],[.13,.40,.47],'trim',body,[0,0,-side*.12]);
      armor('turret-sensor-housing',[0,.15,-.395],[.39,.29,.17],'dark',body);
      cyl('turret-optic-bezel',[0,.14,-.465],[.28,.065,.28],'steel',body,[PI/2,0,0]);
      box('turret-sensor-hood',[0,.315,-.42],[.44,.07,.23],'shell',body);
      for(const side of [-1,1]){
        ring('turret-barrel-collar-'+side,[side*.37,0,-.54],[.235,.11,.235],'trim',gun,[PI/2,0,0]);
        cyl('turret-muzzle-'+side,[side*.37,0,-1.165],[.20,.09,.20],'dark',gun,[PI/2,0,0]);
        cyl('turret-bore-'+side,[side*.37,0,-1.213],[.105,.013,.105],'rubber',gun,[PI/2,0,0]);
        box('turret-rail-'+side,[side*.37,.157,-.30],[.095,.035,.35],'edge',gun);
      }
      for(let i=0;i<3;i++)box('turret-heat-fin-'+i,[(i-1)*.18,.09,.468],[.08,.35,.055],'dark',body);
      cyl('turret-aerial',[.32,.45,.22],[.025,.43,.025],'steel',body);eye('turret-status',[.32,.67,.22],[.055,.055,.055],body,null,'sphere');
      if(rich)for(const side of [-1,1]){
        for(const y of [.05,.25])cyl('detail-sensor-bolt-'+side+'-'+y,[side*.16,y,-.486],[.035,.012,.035],'steel',body,[PI/2,0,0]);
        box('detail-turret-conductor-'+side,[side*.18,.09,.474],[.026,.26,.018],'trim',body);
        limb('detail-turret-feed-'+side,point(body,[side*.40,-.20,.10]),point(gun,[side*.37,-.16,-.25]),.055,.055,'rubber','cylinder',body.b);
      }
      if(rich){
        box('detail-turret-plastron',[0,-.16,-.407],[.57,.17,.055],'trim',body);
        box('detail-turret-intake',[0,-.16,-.438],[.40,.075,.007],'rubber',body);
        ring('detail-turret-bearing',[0,1.14,0],[.46,.07,.46],'trim',fixed);
        for(const [i,f] of feet.entries()){
          const upper=point(fixed,[f.x*.23,.92,f.z*.23]),lower=point(fixed,[f.footX*.82,.29+f.lift,f.footZ*.82]);
          limb('detail-turret-jacket-'+i,upper,upper.map((v,k)=>v+(lower[k]-v)*.48),.105,.105,'trim','cylinder',fixed.b);
        }
      }
    }
    function custodian(){
      const bounce=giant?0:Math.sin(phase*2)*.035*blend,body=frame(root,[0,1.5+bounce,0],giant?[0,0,0]:[stun?.075:rush?-.085:0,0,stun?Math.sin(time*19)*.023:0]);
      const feet=[];for(const side of [-1,1])for(const end of [-1,1]){
        const t=phase+(side===end?0:PI),lift=Math.max(0,Math.cos(t))*.17*blend,stride=Math.sin(t)*.20*blend;
        feet.push({side,end,lift,stride,hip:point(body,[side*.62,-.13,end*.40]),knee:point(root,[side*.89,.77+lift*.4,end*.65+stride*.5]),ankle:point(root,[side*.98,.24+lift,end*.78+stride])});
      }
      if(lod===2){
        box('custodian-torso',[0,.40,.025],[1.65,1.4,1.2],'shell',body);box('custodian-helmet',[0,1.39,-.08],[1,.5,.75],'dark',body);
        eye('custodian-optic',[0,1.40,-.47],[.67,.13,.04],body);
        for(const side of [-1,1])box('custodian-cannon-'+side,[side*1.04,.77,-.43],[.40,.44,1.40],'dark',body);
        cyl('custodian-stance',[0,.30,.03],[2.06,.58,1.85],'edge');return;
      }
      armor('custodian-torso',[0,.40,.025],[1.65,1.4,1.2],'shell',body);
      armor('custodian-helmet',[0,1.39,-.08],[1,.5,.75],'edge',body);
      eye('custodian-optic',[0,1.40,-.468],[.67,.13,.04],body);
      box('custodian-pack',[0,.48,.73],[1.10,.94,.33],'dark',body);
      for(const [i,l] of feet.entries()){
        if(lod===1)limb('custodian-leg-'+i,l.hip,l.ankle,.32,.39,'edge');
        else{
          joint('custodian-hip-'+i,[l.side*.62,-.13,l.end*.4],.39,'dark',body);
          limb('custodian-thigh-'+i,l.hip,l.knee,.38,.42,'shell');
          joint('custodian-knee-'+i,[l.side*.89,.77+l.lift*.4,l.end*.65+l.stride*.5],.34,'dark');
          limb('custodian-shin-'+i,l.knee,l.ankle,.29,.34,'edge');
          limb('custodian-piston-'+i,point(root,[l.side*1.015,1.13,l.end*.5]),point(root,[l.side*1.045,.34+l.lift,l.end*.76+l.stride]),.08,.08,'steel','cylinder');
        }
        box('custodian-boot-'+i,[l.side*.98,.12+l.lift,l.end*.78+l.stride-.04],[.43,.24,.59],'rubber');
      }
      for(const side of [-1,1]){
        const recoil=e.attackState==='burst'?Math.max(0,Math.sin(time*31+side))*.12:0;
        const gun=frame(body,[side*1.04,.78,recoil],[aim?pitch(2.28):-.04,0,0]);
        armor('custodian-shoulder-'+side,[0,.07,.12],[.58,.58,.74],'trim',gun);
        cyl('custodian-barrel-'+side,[0,0,-.87],[.23,1.05,.23],'steel',gun,[PI/2,0,0]);
        if(lod===0){
          joint('custodian-gun-pivot-'+side,[0,.03,.16],.38,'dark',gun);
          box('custodian-receiver-'+side,[0,0,-.27],[.38,.36,.57],'dark',gun);
          cyl('custodian-muzzle-'+side,[0,0,-1.41],[.34,.14,.34],'dark',gun,[PI/2,0,0]);
          cyl('custodian-bore-'+side,[0,0,-1.486],[.18,.016,.18],'rubber',gun,[PI/2,0,0]);
          box('custodian-ammo-'+side,[side*.29,-.04,.13],[.17,.48,.56],'edge',gun);
        }
      }
      if(lod===1)return;
      armor('custodian-plastron',[0,.43,-.62],[1.21,.87,.16],'edge',body);
      cyl('custodian-neck',[0,1.03,-.03],[.52,.23,.52],'steel',body);
      cyl('custodian-jaw',[0,1.18,-.44],[.28,.11,.28],'dark',body,[PI/2,0,0]);
      cyl('custodian-reactor',[0,.54,.96],[.56,.22,.56],'trim',body,[PI/2,0,0]);
      ring('custodian-reactor-cage',[0,.54,1.08],[.71,.11,.71],'steel',body,[PI/2,0,0]);
      for(let j=0;j<4;j++)box('custodian-heat-fin-'+j,[(j-1.5)*.23,.54,.94],[.065,.80,.34],'dark',body);
      for(const side of [-1,1]){
        cyl('custodian-aerial-'+side,[side*.43,1.60,.12],[.035,.45,.035],'steel',body);
        eye('custodian-core-strip-'+side,[side*.36,.43,-.712],[.045,.42,.025],body);
      }
      if(rich)for(const side of [-1,1]){
        for(const y of [.11,.75])cyl('detail-plastron-bolt-'+side+'-'+y,[side*.5,y,-.709],[.055,.018,.055],'steel',body,[PI/2,0,0]);
        box('detail-plastron-seam-'+side,[side*.36,.08,-.709],[.16,.025,.018],'trim',body);
        box('detail-plastron-laminate-'+side,[side*.19,.43,-.728],[.25,.60,.056],'trim',body);
        box('detail-plastron-intake-'+side,[side*.19,.43,-.760],[.145,.27,.008],'rubber',body);
      }
      if(rich)for(const [i,l] of feet.entries()){
        const upper=point(root,[l.side*1.015,1.13,l.end*.5]),lower=point(root,[l.side*1.045,.34+l.lift,l.end*.76+l.stride]);
        limb('detail-custodian-jacket-'+i,upper,upper.map((v,k)=>v+(lower[k]-v)*.55),.14,.14,'trim','cylinder');
      }
    }
    if(type===0)drone();else if(type===1)heavy();else if(type===2)sentinel();else custodian();
    if(giant){
      const awake=e.bossAwake!==false,open=!!e.weakPointOpen,kind=e.bossKind||'colossus';
      const glow=open?[.20,.90,.80]:kind==='siegebreaker'?[.98,.33,.055]:kind==='custodian'?[.37,.70,.78]:[.89,.61,.20];
      const energy=awake?(open?.72+.12*Math.sin(time*8):.25+.06*Math.sin(time*2.2)):.055;
      // This centre and diameter are the simulation's real, targetable weak point.
      // It stays attached to the torso; gait only animates the articulated supports.
      piece('titan-heart','sphere',[0,1.93,-.90],[.72,.72,.72],glow,root,null,open?4:5,energy);
      ring('titan-heart-collar',[0,1.93,-.79],[.94,.15,.94],'trim',root,[PI/2,0,0]);
      for(let j=0;j<6;j++){
        const a=j*TAU/6,r=open?.51:.27;
        armor('titan-heart-shutter-'+j,[Math.cos(a)*r,1.93+Math.sin(a)*r,-1.035],[.22,.28,.10],'edge',root,[open?.20:0,0,a-PI/2]);
      }
      if(lod<2){
        for(const side of [-1,1]){
          armor('titan-shoulder-buttress-'+side,[side*.83,2.30,.12],[.33,.91,.64],'edge',root,[0,0,-side*.12]);
          box('titan-cheek-'+side,[side*.45,2.86,-.43],[.13,.41,.18],'trim',root,[0,0,-side*.09]);
          if(kind==='colossus'){
            limb('titan-horn-root-'+side,point(root,[side*.41,3.03,.10]),point(root,[side*.63,3.23,.10]),.13,.16,'trim');
            limb('titan-horn-tip-'+side,point(root,[side*.63,3.23,.10]),point(root,[side*.90,3.05,.10]),.085,.12,'steel');
            cyl('titan-spine-'+side,[side*.44,2.15,.91],[.24,1.31,.24],'dark');
          }else if(kind==='siegebreaker'){
            cyl('titan-chimney-'+side,[side*.62,2.56,.73],[.29,1.18,.29],'dark');
            ring('titan-chimney-rim-'+side,[side*.62,3.15,.73],[.37,.08,.37],'steel');
            armor('titan-siege-jaw-'+side,[side*.30,2.65,-.51],[.42,.29,.34],'trim',root,[.18,0,side*.10]);
          }else{
            armor('titan-crown-'+side,[side*.32,3.15,.04],[.14,.30,.27],'trim',root,[0,0,-side*.17]);
            armor('titan-mantle-'+side,[side*.75,1.65,.69],[.34,1.69,.27],'edge',root,[0,0,side*.11]);
            limb('titan-halo-support-'+side,point(root,[side*.47,2.19,.76]),point(root,[side*.65,2.65,.78]),.09,.10,'steel');
          }
        }
        if(kind==='custodian')ring('titan-halo',[0,2.60,.77],[1.22,.11,1.22],'trim',root,[PI/2,0,0]);
      }
      if(lod===0){
        for(const side of [-1,1]){
          for(let j=0;j<3;j++){
            box('titan-rib-'+side+'-'+j,[side*.69,1.66+j*.19,-.60],[.21,.075,.14],'steel',root,[0,0,side*.17]);
            cyl('titan-rivet-'+side+'-'+j,[side*.69,1.67+j*.19,-.685],[.055,.025,.055],'trim',root,[PI/2,0,0]);
          }
          for(let j=0;j<3;j++)box('titan-back-vent-'+side+'-'+j,[side*.26,1.72+j*.26,.98],[.25,.10,.12],'dark');
          piece('titan-reactor-seal-'+side,'box',[side*.46,2.29,.99],[.035,.39,.025],glow,root,null,5,energy*.55);
        }
        if(rich)for(let j=0;j<4;j++){
          const a=j*PI/2+PI/4;
          cyl('detail-reactor-coupling-'+j,[Math.cos(a)*.52,1.93+Math.sin(a)*.52,-.875],[.09,.06,.09],'steel',root,[PI/2,0,0]);
        }
      }
      for(const mesh of out){
        mesh.p=[root.p[0]+(mesh.p[0]-root.p[0])*scale,base+(mesh.p[1]-base)*scale,root.p[2]+(mesh.p[2]-root.p[2])*scale];
        mesh.s=mesh.s.map(v=>v*scale);mesh.actorScale=scale;
        if(!awake&&mesh.actorPart!=='titan-heart'&&mesh.emissive)mesh.emissive*=.16;
      }
    }
    return out;
  }
  G.FActors={build};
})(typeof window!=='undefined'?window:globalThis);
