/* RADE — procedural 205 GTI 1.9 / Supercinq GT Turbo phase 2.
   Dimensions and visual references: docs/VEHICULES.md. No downloaded mesh or texture. */
(function(R){'use strict';
const PI=Math.PI,DARK=[.035,.043,.05],BLACK=[.012,.016,.02],SILVER=[.58,.63,.65],RED=[.65,.025,.035],GLASS=[.24,.40,.43];
const SPECS={gti:{name:'Peugeot 205 GTI 1.9',length:3.705,width:1.589,height:1.36,wheelbase:2.42,mass:910},r5:{name:'Renault 5 GT Turbo',length:3.59,width:1.59,height:1.36,wheelbase:2.407,mass:850}};
const PALETTE=['#bb2729','#e7e7db','#18252f','#1a4c92','#8f999c','#19594d','#c5a256','#4b365d'];
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
const fonts={'0':['111','101','101','101','111'],'1':['010','110','010','010','111'],'2':['111','001','111','100','111'],'3':['111','001','111','001','111'],'4':['101','101','111','001','001'],'5':['111','100','111','001','111'],'6':['111','100','111','101','111'],'7':['111','001','010','010','010'],'8':['111','101','111','101','111'],'9':['111','101','111','001','111'],'G':['111','100','101','101','111'],'T':['111','010','010','010','010'],'I':['111','010','010','010','111'],'R':['110','101','110','101','101'],'U':['101','101','101','101','111'],'B':['110','101','110','101','110'],'O':['111','101','101','101','111'],'.':['0','0','0','0','1']};
const models=new Map();let serial=0;
function model(type='gti',color='#bb2729'){
 const key=type+color;if(models.has(key))return models.get(key);
 const r5=type==='r5',spec=SPECS[type],paint=rgb(color),pieces=[],interior=[],wheels=[],W=spec.width/2,L=spec.length/2;
 function part(shape,p,s,c=paint,mat=17,r=[0,0,0],extra={}){const m={shape,p,s,color:c,mat,r,surface:'object',...extra};pieces.push(m);return m;}
 function box(p,s,c=paint,mat=17,r,extra){return part('box',p,s,c,mat,r,extra);}
 function bar(a,b,w,c=paint,mat=17){const d=b.map((v,i)=>v-a[i]),len=Math.hypot(...d);return part('cylinder',a.map((v,i)=>(v+b[i])/2),[w,len,w],c,mat,[Math.acos(d[1]/len),Math.atan2(d[0],d[2]),0]);}
 function surface(name,polys,c=paint,mat=17,extra={}){
  const ts=[];for(const poly of polys)for(let i=1;i<poly.length-1;i++){const a=poly[0],b=poly[i],cc=poly[i+1],u=b.map((v,k)=>v-a[k]),v=cc.map((n,k)=>n-a[k]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],len=Math.hypot(...n)||1,nn=n.map(x=>x/len);ts.push([a,b,cc,nn,nn,nn]);if(extra.double)ts.push([cc,b,a,nn.map(x=>-x),nn.map(x=>-x),nn.map(x=>-x)]);}
  const norm=BITUME.carene.normaliser(extra.smooth?BITUME.carene.lisser(ts.map(t=>t.slice(0,3)),38):ts),shape='rade-'+type+'-'+name; // same geometry shared by every colour
  if(GLOBAL_RENDER())FRender.forme(shape,norm.triangles);
  return part(shape,norm.centre,norm.taille,c,mat,[0,0,0],extra);
 }
 function text(str,x,y,z,size=.009,c=SILVER,plane='front'){
  for(let k=0;k<str.length;k++){const glyph=fonts[str[k]];if(!glyph)continue;for(let j=0;j<5;j++)for(let i=0;i<glyph[j].length;i++)if(glyph[j][i]==='1'){
   const a=(k*4+i)*size,b=-j*size;
   if(plane==='side')box([x-a,y+b,z],[size*.8,size*.8,.004],c,0);else box([x,y+b,z+a],[.004,size*.8,size*.8],c,0);
  }}
 }
 // Body shell. Arch cut-outs are geometry, not dark discs painted on a box.
 box([0,.27,0],[3.15,.18,1.34],DARK,7);
 const wb=spec.wheelbase/2,wr=r5?.277:.293,arch=r5?.348:.35;
 for(const side of [-1,1]){
  const polys=[];for(let i=0;i<120;i++){
   const x0=-L+(2*L)*i/120,x1=-L+(2*L)*(i+1)/120;
   const low=x=>{let y=.29;for(const axle of [-wb,wb]){const d=x-axle;if(Math.abs(d)<arch)y=Math.max(y,wr+Math.sqrt(arch*arch-d*d));}return y;};
   const wide=x=>W-(Math.abs(x)>L-.25?(.25-(L-Math.abs(x)))*.15:0);
   for(let row=0;row<5;row++){const at=(x,t)=>{const y=low(x)+(.84-low(x))*t,bulge=.968+.032*Math.sin(t*Math.PI);return [x,y,side*wide(x)*bulge];},p=[at(x0,row/5),at(x1,row/5),at(x1,(row+1)/5),at(x0,(row+1)/5)];polys.push(side>0?p:p.slice().reverse());}
  }surface('side'+side,polys,paint,17,{smooth:true});
  // Plastic arches (205) / body-colour extensions (Supercinq), continuous segments.
  for(const ax of [-wb,wb])for(let j=0;j<20;j++){const a=PI*j/20,b=PI*(j+1)/20;bar([ax+Math.cos(a)*arch,wr+Math.sin(a)*arch,side*(W+.012)],[ax+Math.cos(b)*arch,wr+Math.sin(b)*arch,side*(W+.012)],r5?.07:.055,r5?paint:DARK,r5?17:7);}
  box([0,.49,side*(W+.015)],[1.66,r5?.14:.09,.025],DARK,7);
  if(!r5)box([0,.513,side*(W+.03)],[1.66,.014,.012],RED,17);
  box([0,.26,side*(W-.01)],[1.85,.085,.09],r5?paint:DARK,r5?17:7);
  // Door outlines, handle, lock and side indicator.
  box([-.47,.65,side*(W+.025)],[.13,.035,.025],BLACK,7);part('cylinder',[-.5,.59,side*(W+.033)],[.018,.012,.018],SILVER,0,[PI/2,0,0]);
  box([-.63,.68,side*(W+.006)],[.008,.29,.008],BLACK,7);box([.77,.7,side*(W+.006)],[.008,.27,.008],BLACK,7);
  box([1.02,.715,side*(W+.02)],[.065,.038,.016],[.95,.38,.06],5);
  box([.64,.94,side*(W+.12)],[.21,.11,.20],r5?paint:DARK,r5?17:7);box([.536,.945,side*(W+.12)],[.006,.078,.147],[.43,.55,.56],8);
  if(r5)text('GT TURBO',-.39,.39,side*(W+.031),.014,SILVER,'side');else{text('GTI',-1.31,1.01,side*.712,.014,RED,'side');text('1.9',-1.30,1.10,side*.682,.011,SILVER,'side');}
 }
 surface('hood',[[[.80,.85,-W+.04],[L-.02,.76,-W+.08],[L-.02,.76,W-.08],[.80,.85,W-.04]]],paint,17,{double:true});
 box([L-.025,.62,0],[.06,.25,1.45],paint);box([-L+.035,.64,0],[.07,.36,1.48],paint);
 const frontRoof=r5?.22:.27,rearRoof=r5?-1.18:-1.04,roofY=1.35,rearBottom=r5?-1.69:-1.72;
 part('bevel',[(rearRoof+frontRoof)/2,roofY,0],[frontRoof-rearRoof+.045,.045,1.25],paint,17);box([(rearRoof+frontRoof)/2,roofY-.03,0],[frontRoof-rearRoof-.06,.018,1.17],[.35,.34,.31],7);for(const side of [-1,1])bar([rearRoof,roofY+.006,side*.622],[frontRoof,roofY+.006,side*.622],.015,DARK,7);
 const wind=[[.84,.86,-.70],[frontRoof,roofY-.015,-.60],[frontRoof,roofY-.015,.60],[.84,.86,.70]];
 surface('windshield',[wind],GLASS,8,{fx:true,alpha:.12,double:true,window:true});for(let j=0;j<wind.length;j++)bar(wind[j],wind[(j+1)%wind.length],.022,BLACK,7);
 const rear=[[rearBottom,.86,.69],[rearRoof,roofY-.015,.60],[rearRoof,roofY-.015,-.60],[rearBottom,.86,-.69]];
 surface('rear-window',[rear],GLASS,8,{fx:true,alpha:.22,double:true,window:true});for(let j=1;j<9;j++){const t=j/10,x=rearBottom+(rearRoof-rearBottom)*t,y=.86+(roofY-.015-.86)*t;bar([x-.006,y,-.66+t*.06],[x-.006,y,.66-t*.06],.0025,[.34,.22,.12],0);}
 for(const side of [-1,1]){
  const A=[.84,.86,side*.70],B=[frontRoof,roofY,side*.61],C=[rearRoof,roofY,side*.61],D=[rearBottom,.86,side*.70];
  for(const [a,b,w]of [[A,B,.045],[B,C,.038],[C,D,r5?.085:.13],[D,A,.035]])bar(a,b,w,paint,17);
  bar([-.53,.86,side*.71],[-.53,roofY,side*.61],.055,DARK,7);
  surface('side-window'+side,[[A,B,C,D]],GLASS,8,{fx:true,alpha:.13,double:true,window:true});
 }
 // Model-specific grille, bumpers, optics and tail lights.
 for(const sign of [-1,1]){
  const x=sign*L;box([x,.455,0],[.11,.16,1.54],r5?paint:DARK,r5?17:7);
  box([x+sign*.063,.46,0],[.012,.055,1.5],DARK,7);
  if(!r5)box([x+sign*.07,.50,0],[.012,.014,1.49],RED,17);
  box([x,.285,0],[.13,.16,1.49],paint);
  box([x+sign*.08,.38,0],[.009,.085,.31],sign===1?[.86,.85,.75]:[.9,.65,.12],7);
 }
 for(const side of [-1,1]){
  box([L+.014,.655,side*.515],[.025,r5?.20:.175,.335],[.83,.87,.80],8);
  box([L+.03,r5?.535:.645,side*.70],[.027,r5?.055:.15,.095],r5?[1,.38,.04]:[.85,.89,.82],8);
  box([L+.075,.29,side*.53],[.025,.105,.17],r5?[1,.75,.15]:[.92,.9,.72],8);
  for(let j=0;j<7;j++)box([L+.03,.58+j*.025,side*.51],[.008,.004,.30],[.58,.65,.65],8);
  box([-L-.009,.75,side*.635],[.023,r5?.31:.22,.18],RED,6);
  box([-L-.025,.81,side*.635],[.006,.064,.18],[.9,.32,.05],5);box([-L-.025,.70,side*.635],[.006,.052,.18],[.78,.82,.78],8);
 }
 box([L+.025,.635,0],[.035,.17,.63],BLACK,7);for(let j=0;j<4;j++)box([L+.046,.575+j*.037,0],[.009,.012,.62],r5?DARK:paint,r5?7:17);
 if(r5){bar([L+.057,.61,.15],[L+.057,.67,.19],.013,SILVER,0);bar([L+.057,.67,.19],[L+.057,.73,.15],.013,SILVER,0);bar([L+.057,.73,.15],[L+.057,.67,.11],.013,SILVER,0);bar([L+.057,.67,.11],[L+.057,.61,.15],.013,SILVER,0);}
 else box([L+.055,.65,0],[.015,.08,.055],SILVER,0);
 box([-L-.023,.86,0],[.03,.11,1.10],DARK,7);for(let j=0;j<4;j++)box([-L-.04,.82+j*.024,0],[.006,.007,1.05],BLACK,7);
 box([rearRoof-.08,1.35,0],[.22,.04,1.24],r5?paint:DARK,r5?17:7);
 bar([.83,.875,-.58],[.72,.89,-.09],.015,BLACK,7);bar([.83,.875,.1],[.72,.89,.58],.015,BLACK,7);
 bar([frontRoof,1.37,0],[frontRoof-.27,1.68,0],.009,DARK,0);
 part('cylinder',[-L-.08,.23,-.48],[.065,.23,.065],SILVER,0,[0,0,PI/2]);
 // Seats, door cards, floor, carpet, rear bench.
 const before=pieces.length;box([-.18,.23,0],[2.45,.035,1.38],r5?[.17,.06,.055]:[.33,.018,.03],18);
 for(const side of [-1,1]){
  box([-.3,.44,side*.35],[.57,.14,.51],DARK,18);box([-.57,.72,side*.35],[.15,.62,.52],DARK,18,[0,0,-.13]);
  box([-.59,1.09,side*.35],[.13,.18,.30],DARK,18);
  box([-.28,.516,side*.35],[.46,.01,.31],[.16,.13,.14],18);box([-.477,.75,side*.35],[.015,.45,.30],[.16,.13,.14],18,[0,0,-.13]);
  for(let j=0;j<7;j++)for(let k=0;k<4;k++)box([-.39+j*.044,.523,side*.35-.11+k*.07],[.018,.006,.02],RED,18);
  box([-.15,.66,side*.747],[1.35,.32,.025],DARK,7);box([-.2,.69,side*.72],[.29,.05,.07],[.075,.083,.085],7);box([-.24,.53,side*.728],[.8,.014,.025],RED,17);
 }
 box([-1.2,.5,0],[.45,.2,1.24],DARK,18);box([-1.43,.75,0],[.16,.5,1.24],DARK,18);
 // The dashboard's major shapes are distinct: Peugeot hood + three rotary knobs; Renault five pods and shelf.
 const dash=r5?[.13,.15,.16]:[.055,.066,.075];
 box([.56,.76,0],[.44,.24,1.38],dash,7);box([.61,.88,0],[.48,.06,1.39],dash,7);
 box([.36,.84,-.34],[.21,.19,.58],dash,7);box([.241,.845,-.34],[.012,.133,.53],BLACK,7);
 if(r5)box([.348,.80,.41],[.018,.045,.48],BLACK,7);else box([.328,.77,.44],[.025,.11,.47],dash,7);
 for(const z of [-.64,.1,.29,.64]){box([.316,.85,z],[.018,.09,.11],BLACK,7);for(let j=0;j<5;j++)box([.303,.817+j*.015,z],[.006,.004,.105],[.22,.24,.24],7);}
 box([.31,.63,.075],[.15,.28,.24],dash,7,[0,0,.13]);box([.205,.58,.075],[.015,.09,.19],BLACK,7);
 for(let j=0;j<3;j++)part('cylinder',[.21,.72,-.015+j*.075],[.044,.019,.044],BLACK,7,[0,0,PI/2]);
 box([.193,.591,.07],[.006,.022,.10],[.06,.3,.26],4);box([.19,.562,.073],[.005,.01,.13],SILVER,0);
 box([-.05,.35,.06],[.62,.20,.23],dash,7);bar([-.08,.43,.06],[-.05,.64,.06],.022,BLACK,7);part('sphere',[-.05,.66,.06],[.065,.065,.065],DARK,7);
 bar([-.37,.42,.07],[-.2,.47,.07],.032,BLACK,7);
 const gauges=r5?[[-.52,.049,'fuel'],[-.41,.073,'rpm'],[-.24,.073,'speed'],[-.10,.047,'temp'],[-.35,.033,'boost']]:[[-.45,.075,'rpm'],[-.25,.075,'speed'],[-.57,.032,'fuel'],[-.12,.032,'temp']];
 for(const [z,rad,kind]of gauges){const gy=kind==='boost'?.803:.851;part('cylinder',[.229,gy,z],[rad*2,.008,rad*2],r5?[.17,.17,.14]:BLACK,7,[0,0,PI/2]);for(let j=0;j<11;j++){const a=-2.3+j*.46;box([.222,gy+Math.cos(a)*rad*.82,z+Math.sin(a)*rad*.82],[.006,.005,.005],[.86,.84,.71],0);} }
 text('GTI',.19,.83,-.367,.008,RED);
 // Rear mirror, pedals and visors are modelled, not a painted UI.
 box([.40,1.19,0],[.04,.075,.19],DARK,7);box([.377,1.19,0],[.005,.055,.17],[.35,.46,.48],8);bar([.43,1.23,0],[.44,1.30,0],.018,DARK,7);
 for(const z of [-.50,-.34,-.21])box([.55,.3,z],[.1,.025,.06],DARK,7,[0,0,.45]);
 for(const z of [-.35,.35])box([.35,1.302,z],[.08,.022,.4],DARK,7);
 interior.push(...pieces.slice(before));
 const result={type,color,spec,pieces,interior,gauges,wr,wb,eye:[-.48,1.10,-.34]};models.set(key,result);return result;
}
function GLOBAL_RENDER(){return typeof FRender!=='undefined';}
function render(car,out,options={}){
 const mod=model(car.model||'gti',car.color||'#bb2729'),M=BITUME.voiture.attitude(car.cap,car.tangage||0,car.roulis||0),rot=BITUME.voiture.angles(M),pos=[car.x,car.y||.16,car.z];
 function put(m){if(options.cockpit&&m.window)return;const p=BITUME.voiture.mul(M,m.p),r=BITUME.voiture.angles(BITUME.voiture.mulM(M,BITUME.voiture.euler(...(m.r||[0,0,0]))));out.push({...m,p:p.map((v,i)=>v+pos[i]),r});}
 for(const m of mod.pieces)put(m);
 // Rolling wheels. Peugeot pepper-pot holes / Renault five-spoke wheels.
 for(const axle of [-1,1])for(const side of [-1,1]){
  const x=axle*mod.wb,z=side*.72,y=mod.wr,steer=axle>0?-(car.braquage||0):0,roll=(car.distance||0)/mod.wr;
  const base={p:[x,y,z],r:[PI/2,steer,0],shape:'cylinder',surface:'object'};
  put({...base,s:[mod.wr*2,.185,mod.wr*2],mat:7,color:BLACK});put({...base,p:[x,y,z+side*.075],s:[mod.wr*1.42,.025,mod.wr*1.42],mat:0,color:[.25,.27,.28]});put({shape:'bevel',p:[x+.10,y,z+side*.084],s:[.08,.23,.055],mat:0,color:[.32,.32,.29]});for(let j=0;j<28;j++){const a=j*2*PI/28+roll;put({shape:'box',p:[x+Math.sin(a)*mod.wr*.992,y+Math.cos(a)*mod.wr*.992,z],s:[.010,.008,.16],r:[0,steer,-a],mat:7,color:[.009,.01,.011],surface:'object'});}
  put({...base,p:[x,y,z+side*.098],s:[mod.wr*1.50,.012,mod.wr*1.50],mat:0,color:SILVER});
  for(let j=0;j<(mod.type==='gti'?8:5);j++){
   const a=j*2*PI/(mod.type==='gti'?8:5)+roll,rad=mod.wr*.51;
   if(mod.type==='gti')put({...base,p:[x+Math.sin(a)*rad,y+Math.cos(a)*rad,z+side*.107],s:[.062,.013,.062],mat:7,color:BLACK});
   else{const mid=mod.wr*.43;put({shape:'box',p:[x+Math.sin(a)*mid,y+Math.cos(a)*mid,z+side*.11],s:[.04,mod.wr*.65,.018],r:[0,steer,-a],mat:7,color:DARK,surface:'object'});}
  }
  put({...base,p:[x,y,z+side*.12],s:[.074,.015,.074],mat:0,color:SILVER});
 }
 // Steering wheel: three spokes in its true cabin position, driven by BITUME's filtered steering.
 const turn=(car.volant||0)*1.7,cx=.10,cy=.79,cz=-.34,rad=.185;
 put({shape:'ring',p:[cx,cy,cz],s:[rad*2,.027,rad*2],r:[0,0,PI/2],mat:7,color:BLACK,surface:'object'});
 for(const a0 of [PI/2,-PI/2,PI]){const a=a0+turn;put({shape:'box',p:[cx,cy+Math.cos(a)*rad*.46,cz+Math.sin(a)*rad*.46],s:[.024,rad,.035],r:[a,0,0],mat:7,color:DARK,surface:'object'});}
 put({shape:'bevel',p:[cx-.018,cy,cz],s:[.05,.08,.105],r:[turn,0,0],mat:7,color:DARK,surface:'object'});
 const rpm=car.moteur?(car.regime||900):0;
 for(const [z,r,kind]of mod.gauges){const v=kind==='speed'?Math.min(1,(car.v||0)*3.6/220):kind==='rpm'?rpm/8000:kind==='boost'?(car.gaz||0)*.9:.48,a=-2.3+v*4.6,y=kind==='boost'?.803:.851;put({shape:'box',p:[.214,y+Math.cos(a)*r*.36,z+Math.sin(a)*r*.36],s:[.006,r*.75,.004],r:[a,0,0],mat:5,color:[1,.32,.12],emissive:.25,surface:'object'});}
 return mod;
}
// Pre-register both geometries before the single WebGL renderer is created.
model('gti');model('r5');
R.vehicles={model,render,SPECS,PALETTE,rgb};
})(globalThis.RADE=globalThis.RADE||{});
