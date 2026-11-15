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
  if(r5)text('GT TURBO',-.39,.39,side*(W+.031),.014,SILVER,'side');
 }
 const hood=[];const hx=[.80,L-.27,L-.02],hy=[.85,.805,.765],hz=[-1,-.90,-.52,0,.52,.90,1];
 for(let i=0;i<hx.length-1;i++)for(let j=0;j<hz.length-1;j++){const at=(k,t)=>[hx[k],hy[k]+.024*(1-t*t),t*(W-.045-(k===2?.035:0))];hood.push([at(i,hz[j]),at(i+1,hz[j]),at(i+1,hz[j+1]),at(i,hz[j+1])]);}
 surface('hood',hood,paint,17,{double:true,smooth:true});
 box([L-.025,.62,0],[.06,.25,1.45],paint);box([-L+.035,.64,0],[.07,.36,1.48],paint);
 const frontRoof=r5?.22:.27,rearRoof=r5?-1.18:-1.04,roofY=1.35,rearBottom=r5?-1.69:-1.72;
 part('bevel',[(rearRoof+frontRoof)/2,roofY,0],[frontRoof-rearRoof+.045,.045,1.25],paint,17);box([(rearRoof+frontRoof)/2,roofY-.03,0],[frontRoof-rearRoof-.06,.018,1.17],[.35,.34,.31],7);for(const side of [-1,1])bar([rearRoof,roofY+.006,side*.622],[frontRoof,roofY+.006,side*.622],.015,DARK,7);
 const wind=[[.84,.86,-.70],[frontRoof,roofY-.015,-.60],[frontRoof,roofY-.015,.60],[.84,.86,.70]];
 surface('windshield',[wind],GLASS,8,{fx:true,alpha:.24,double:true,window:true});for(let j=0;j<wind.length;j++)bar(wind[j],wind[(j+1)%wind.length],.022,BLACK,7);
 const rear=[[rearBottom,.86,.69],[rearRoof,roofY-.015,.60],[rearRoof,roofY-.015,-.60],[rearBottom,.86,-.69]];
 surface('rear-window',[rear],GLASS,8,{fx:true,alpha:.30,double:true,window:true});for(let j=1;j<9;j++){const t=j/10,x=rearBottom+(rearRoof-rearBottom)*t,y=.86+(roofY-.015-.86)*t;bar([x-.006,y,-.66+t*.06],[x-.006,y,.66-t*.06],.0025,[.34,.22,.12],0);}
 // Pressed-metal cabin surrounds, with separate inset door and quarter glass.
 // These are broad panels; the window openings remain empty in cockpit view.
 for(const side of [-1,1]){
  const q=(x,y,z)=>[x,y,side*z],A=q(.84,.86,.70),B=q(frontRoof,roofY,.61),C=q(rearRoof,roofY,.61),D=q(rearBottom,.86,.70);
  const F0=q(.775,.89,.697),F1=q(frontRoof-.025,roofY-.055,.608),F2=q(-.48,roofY-.055,.608),F3=q(-.48,.89,.697);
  const Q0=q(-.585,.89,.697),Q1=q(-.585,roofY-.055,.608),Q2=q(rearRoof+.145,roofY-.065,.611),Q3=q(rearBottom+(r5?.17:.255),.89,.697);
  const panel=(name,polys,color=paint,mat=17)=>surface(name+side,polys,color,mat,{double:true});
  panel('a-pillar',[[A,B,F1,F0]]);panel('roof-rail',[[B,C,Q2,Q1,F2,F1]]);
  panel('c-pillar',[[C,D,Q3,Q2]]);panel('belt-rail',[[D,A,F0,F3,Q0,Q3]]);
  panel('b-pillar',[[F3,F2,Q1,Q0]],DARK,7);
  if(!r5){
   // The C-pillar is two slightly different planes. Fit trim and lettering to
   // those exact faces; a free-standing quad crossed the paint and rear glass.
   const pillar=[[C,D,Q3],[C,Q3,Q2]],cross2=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
   const span=y=>{const a=(y-D[1])/(C[1]-D[1]),b=(y-Q3[1])/(Q2[1]-Q3[1]);return [D[0]+(C[0]-D[0])*a,Q3[0]+(Q2[0]-Q3[0])*b];};
   const border=(y,t)=>{const [left,right]=span(y);return [left+(right-left)*t,y];},trim=[border(.925,.12),border(.925,.88),border(1.19,.88),border(1.19,.12)];
   function clip(poly,triangle){
    const sign=Math.sign(cross2(...triangle));let out=poly;
    for(let i=0;i<triangle.length&&out.length;i++){
     const a=triangle[i],b=triangle[(i+1)%triangle.length],input=out;out=[];
     for(let j=0;j<input.length;j++){
      const p=input[j],r=input[(j+1)%input.length],dp=sign*cross2(a,b,p),dr=sign*cross2(a,b,r),inside=dp>=-1e-10;
      if(inside)out.push(p);if(inside!==(dr>=-1e-10)){const t=dp/(dp-dr);out.push([p[0]+(r[0]-p[0])*t,p[1]+(r[1]-p[1])*t]);}
     }
    }return out;
   }
   function onPillar(poly,relief){
    const polys=[];
    for(const face of pillar){
     const clipped=clip(poly,face);if(clipped.length<3)continue;
     const [a,b,c]=face,u=b.map((v,i)=>v-a[i]),v=c.map((n,i)=>n-a[i]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],scale=side*Math.sign(n[2])*relief/Math.hypot(...n),den=cross2(a,b,c);
     polys.push(clipped.map(p=>{const wb=cross2(a,p,c)/den,wc=cross2(a,b,p)/den,z=a[2]+wb*(b[2]-a[2])+wc*(c[2]-a[2]);return [p[0]+n[0]*scale,p[1]+n[1]*scale,z+n[2]*scale];}));
    }return polys;
   }
   panel('quarter-trim',onPillar(trim,.003),DARK,7);
   function trimText(label,top,size,color,mat){
    const polys=[],[left,right]=span(top-size*2),start=(left+right)/2+(label.length*4-1)*size/2;
    for(let k=0;k<label.length;k++){const glyph=fonts[label[k]];for(let j=0;j<5;j++)for(let i=0;i<glyph[j].length;i++)if(glyph[j][i]==='1'){
     const x=start-(k*4+i)*size,y=top-j*size,h=size*.4;polys.push(...onPillar(clip([[x-h,y-h],[x+h,y-h],[x+h,y+h],[x-h,y+h]],trim),.006));
    }}panel('quarter-badge-'+label,polys,color,mat);
   }
   trimText('GTI',1.045,.009,RED,17);trimText('1.9',1.12,.008,SILVER,0);
  }
  for(const [label,win]of [['door',[F0,F1,F2,F3]],['quarter',[Q0,Q1,Q2,Q3]]]){
   panel(label+'-glass',[win],GLASS,8);const glass=pieces[pieces.length-1];glass.fx=true;glass.alpha=.25;glass.window=true;
   for(let j=0;j<win.length;j++)bar(win[j],win[(j+1)%win.length],.013,BLACK,7);
  }
  // The rear hatch corner joins the side shell instead of leaving an open wedge.
  panel('hatch-corner',[[D,C,q(rearRoof,roofY-.015,.60),q(rearBottom,.86,.69)]]);
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
  box([L+.03,r5?.535:.645,side*(r5?.515:.70)],[.027,r5?.055:.15,r5?.335:.095],r5?[1,.38,.04]:[.85,.89,.82],8);
  box([L+.075,.29,side*.53],[.025,.105,.17],r5?[1,.75,.15]:[.92,.9,.72],8);
  for(let j=0;j<7;j++)box([L+.03,.58+j*.025,side*.51],[.008,.004,.30],[.58,.65,.65],8);
  box([-L-.009,.75,side*.635],[.023,r5?.31:.22,.18],RED,6);
  box([-L-.025,.81,side*.635],[.006,.064,.18],[.9,.32,.05],5);box([-L-.025,.70,side*.635],[.006,.052,.18],[.78,.82,.78],8);
 }
 if(r5){box([L+.075,.285,0],[.012,.11,.69],BLACK,7);for(let k=0;k<3;k++)box([L+.084,.245+k*.035,0],[.009,.012,.68],paint,17);}
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
  part('bevel',[-.59,1.09,side*.35],[.13,.18,.30],DARK,18);
  for(const edge of [-1,1]){part('bevel',[-.29,.51,side*.35+edge*.205],[.55,.16,.11],DARK,18);part('bevel',[-.48,.76,side*.35+edge*.20],[.12,.50,.12],DARK,18,[0,0,-.13]);}
  box([-.28,.516,side*.35],[.46,.01,.31],[.16,.13,.14],18);box([-.477,.75,side*.35],[.015,.45,.30],[.16,.13,.14],18,[0,0,-.13]);
  for(let j=0;j<7;j++)for(let k=0;k<4;k++)box([-.39+j*.044,.523,side*.35-.11+k*.07],[.018,.006,.02],RED,18);
  box([-.15,.66,side*.747],[1.35,.32,.025],DARK,7);box([-.2,.69,side*.72],[.29,.05,.07],[.075,.083,.085],7);box([-.24,.53,side*.728],[.8,.014,.025],RED,17);
  box([-.18,.65,side*.727],[.88,.15,.012],[.16,.15,.15],18);
  part('cylinder',[.30,.43,side*.727],[.17,.014,.17],BLACK,7,[PI/2,0,0]);
  box([-.38,.75,side*.712],[.13,.035,.022],BLACK,7);
 }
 box([-1.2,.5,0],[.45,.2,1.24],DARK,18);box([-1.43,.75,0],[.16,.5,1.24],DARK,18);
 // The dashboard's major shapes are distinct: Peugeot hood + three rotary knobs; Renault five pods and shelf.
 const dash=r5?[.13,.15,.16]:[.055,.066,.075];
 box([.56,.76,0],[.44,.24,1.38],dash,7);part('bevel',[.61,.875,0],[.48,.085,1.39],dash,7);
 part('bevel',[.36,.85,-.34],[.23,.22,.60],dash,7);box([.241,.845,-.34],[.012,.133,.53],BLACK,7);
 if(r5)box([.348,.80,.41],[.018,.045,.48],BLACK,7);else box([.328,.77,.44],[.025,.11,.47],dash,7);
 for(const z of [-.64,.1,.29,.64]){box([.316,.85,z],[.018,.09,.11],BLACK,7);for(let j=0;j<5;j++)box([.303,.817+j*.015,z],[.006,.004,.105],[.22,.24,.24],7);}
 box([.31,.63,.075],[.15,.28,.24],dash,7,[0,0,.13]);box([.205,.58,.075],[.015,.09,.19],BLACK,7);
 for(let j=0;j<3;j++)part('cylinder',[.21,.72,-.015+j*.075],[.044,.019,.044],BLACK,7,[0,0,PI/2]);
 box([.193,.591,.07],[.006,.022,.10],[.06,.3,.26],4);box([.19,.562,.073],[.005,.01,.13],SILVER,0);
 box([-.05,.35,.06],[.62,.20,.23],dash,7);part('bevel',[-.08,.45,.06],[.13,.08,.12],BLACK,7);for(let j=0;j<3;j++)part('bevel',[-.08,.458+j*.018,.06],[.12-j*.02,.014,.11-j*.018],DARK,7);
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
// Cosmetic driver pose follows simulation controls; no render-time changes to
// gearbox, steering, physics, saves or civilian drivers. One WeakMap per car.
const cockpitStates=new WeakMap(),clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),smooth=v=>{v=clamp(v);return v*v*(3-2*v);},mix=(a,b,t)=>a.map((v,k)=>v+(b[k]-v)*t),add=(a,b)=>a.map((v,k)=>v+b[k]),norm=v=>{const n=Math.hypot(...v)||1;return v.map(x=>x/n);},dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
const COCKPIT={wheel:[.10,.79,-.34],rim:.185*.87,upperArm:.34,forearm:.32,duration:.78,leverBase:[-.08,.43,.06]};
function gearPosition(gear){if(gear===0)return [-.05,.66,.06];const reverse=gear<0,g=reverse?6:Math.max(1,Math.min(5,gear)),lane=Math.floor((g-1)/2)-1;return [-.05+(g%2?.027:-.027),.66,.06+lane*.034];}
function wheelHand(side,turn){const a=side*PI/2+turn,radial=[0,Math.cos(a),Math.sin(a)],tangent=[0,-Math.sin(a),Math.cos(a)],contact=COCKPIT.wheel.map((v,k)=>v+radial[k]*COCKPIT.rim),at=(normal,rad,tan)=>contact.map((v,k)=>v+(k===0?-normal:0)+radial[k]*rad+tangent[k]*tan),fingers=[];
 for(let j=0;j<4;j++){const t=(j-1.5)*.018,len=1-Math.abs(j-1.4)*.07;fingers.push([at(.023,.030,t),at(-.002,.035*len,t),at(-.025,.014,t),at(-.024,-.012*len,t)]);}
 return {contact,wrist:at(.105,.032,0),palm:at(.044,.026,0),size:[.075,.083,.050],r:[a+PI/2,0,0],fingers,thumb:[at(.070,.015,-side*.035),at(.041,-.014,-side*.038),at(.020,-.020,-side*.021)]};
}
function leverHand(knob){const at=(x,y,z)=>add(knob,[x,y,z]),fingers=[];for(let j=0;j<4;j++){const z=(j-1.5)*.017;fingers.push([at(-.020,.051,z),at(.008,.044,z),at(.031,.013,z),at(.019,-.014,z)]);}return {contact:knob.slice(),wrist:at(-.110,.025,-.005),palm:at(-.039,.033,0),size:[.072,.037,.082],r:[0,0,-.2],fingers,thumb:[at(-.046,.022,-.037),at(-.025,-.003,-.037),at(.003,-.008,-.028)]};}
function blendHand(a,b,t,lift=0){const liftPoint=p=>[p[0],p[1]+lift,p[2]],points=(a,b)=>a.map((p,i)=>liftPoint(mix(p,b[i],t)));return {contact:liftPoint(mix(a.contact,b.contact,t)),wrist:liftPoint(mix(a.wrist,b.wrist,t)),palm:liftPoint(mix(a.palm,b.palm,t)),size:mix(a.size,b.size,t),r:mix(a.r,b.r,t),fingers:a.fingers.map((f,i)=>points(f,b.fingers[i])),thumb:points(a.thumb,b.thumb)};}
function leverTravel(a,b,t){const first=[-.05,.66,a[2]],last=[-.05,.66,b[2]];return t<1/3?mix(a,first,smooth(t*3)):t<2/3?mix(first,last,smooth((t-1/3)*3)):mix(last,b,smooth((t-2/3)*3));}
function poseAt(car,time,state){const turn=clamp(Number(car.volant)||0,-1,1)*1.7,elapsed=time-state.start,phase=clamp(elapsed/COCKPIT.duration),shifting=elapsed>=0&&phase<1,knob=shifting?leverTravel(state.fromKnob,gearPosition(state.gear),smooth((elapsed-.22)/.25)):gearPosition(state.gear),left=wheelHand(-1,turn),wheelRight=wheelHand(1,turn);let right=wheelRight;
 if(shifting){const grip=leverHand(knob);if(elapsed<.22){const t=smooth(elapsed/.22);right=blendHand(state.fromHand||wheelRight,grip,t,.095*4*t*(1-t));}else if(elapsed<.48)right=grip;else{const t=smooth((elapsed-.48)/.30);right=blendHand(grip,wheelRight,t,.085*4*t*(1-t));}}
 const arms=[left,right].map((hand,i)=>{const side=i?1:-1,shoulder=[-.40,.94,-.34+side*.18],target=hand.wrist,delta=target.map((v,k)=>v-shoulder[k]),d=Math.hypot(...delta),axis=norm(delta),hint=[-.10,-.32,side*.12],bend=norm(hint.map((v,k)=>v-axis[k]*dot(hint,axis))),safe=clamp(d,.03,COCKPIT.upperArm+COCKPIT.forearm-.0001),along=(COCKPIT.upperArm**2-COCKPIT.forearm**2+safe**2)/(2*safe),height=Math.sqrt(Math.max(0,COCKPIT.upperArm**2-along**2)),elbow=shoulder.map((v,k)=>v+axis[k]*along+bend[k]*height);return {side,shoulder,elbow,wrist:target,hand,reach:d};});
 return {gear:state.gear,turn,phase,shifting,knob,leverBase:COCKPIT.leverBase.slice(),left,right,arms};
}
function cockpitPose(car,time=0){time=Number.isFinite(time)?time:0;const gear=car.arriere?-1:Math.max(0,Math.min(5,Number.isFinite(car.rapport)?Math.round(car.rapport):1));let state=cockpitStates.get(car);
 if(!state||time<state.time||time-state.time>2){state={gear,start:-Infinity,time,fromKnob:gearPosition(gear),fromHand:null};cockpitStates.set(car,state);}
 if(gear!==state.gear){const previous=poseAt(car,time,state);state={gear,start:time,time,fromKnob:previous.knob.slice(),fromHand:previous.right};cockpitStates.set(car,state);}state.time=time;return poseAt(car,time,state);
}
function cockpitGeometry(pose,put){const cloth=[.065,.10,.14],cuff=[.045,.065,.085],skin=[.55,.36,.25];
 const segment=(a,b,thickness,color,tag,shape='cylinder')=>{const d=b.map((v,i)=>v-a[i]),length=Math.hypot(...d);if(length<.00001)return;put({shape,p:a.map((v,i)=>(v+b[i])/2),s:[thickness,length+(shape==='sphere'?thickness*.55:0),thickness*.90],r:[Math.acos(clamp(d[1]/length,-1,1)),Math.atan2(d[0],d[2]),0],mat:18,color,surface:'object',cockpitDriver:true,cockpitPart:tag});};
 for(const arm of pose.arms){const suffix=arm.side<0?'left':'right',hand=arm.hand;segment(arm.shoulder,arm.elbow,.12,cloth,'upper-arm-'+suffix,'sphere');segment(arm.elbow,arm.wrist,.088,cloth,'forearm-'+suffix,'sphere');put({shape:'sphere',p:arm.elbow,s:[.104,.102,.103],color:cloth,mat:18,cockpitDriver:true,cockpitPart:'elbow-'+suffix,surface:'object'});const direction=norm(arm.wrist.map((v,i)=>v-arm.elbow[i])),back=arm.wrist.map((v,i)=>v-direction[i]*.026);segment(back,arm.wrist,.072,cuff,'cuff-'+suffix);segment(arm.wrist,hand.palm,.045,skin,'wrist-'+suffix,'sphere');put({shape:'sphere',p:hand.palm,s:hand.size,r:hand.r,color:skin,mat:18,surface:'object',cockpitDriver:true,cockpitPart:'palm-'+suffix});
  for(const [finger,chain]of [...hand.fingers,hand.thumb].entries())for(let j=1;j<chain.length;j++){segment(chain[j-1],chain[j],finger===4?.015:.0135,skin,'finger-'+suffix+'-'+finger+'-'+j);put({shape:'sphere',p:chain[j],s:[.014,.014,.014],color:skin,mat:18,surface:'object',cockpitDriver:true,cockpitPart:'joint-'+suffix});}
 }
}

function render(car,out,options={}){
 const mod=model(car.model||'gti',car.color||'#bb2729'),M=BITUME.voiture.attitude(car.cap,car.tangage||0,car.roulis||0),rot=BITUME.voiture.angles(M),pos=[car.x,car.y||.16,car.z];
 function put(m){if(options.cockpit&&m.window)return;const p=BITUME.voiture.mul(M,m.p),r=BITUME.voiture.angles(BITUME.voiture.mulM(M,BITUME.voiture.euler(...(m.r||[0,0,0]))));out.push({...m,p:p.map((v,i)=>v+pos[i]),r});}
 for(const m of mod.pieces)put(m);
 // Rolling wheels. Peugeot perforated alloy / Renault dished, finely vented alloy.
 for(const axle of [-1,1])for(const side of [-1,1]){
  const x=axle*mod.wb,z=side*.72,y=mod.wr,steer=axle>0?-(car.braquage||0):0,roll=(car.distance||0)/mod.wr;
  const base={p:[x,y,z],r:[PI/2,steer,0],shape:'cylinder',surface:'object'};
  put({...base,s:[mod.wr*2,.185,mod.wr*2],mat:7,color:BLACK});
  put({...base,shape:'ring',p:[x,y,z+side*.087],s:[mod.wr*1.91,.035,mod.wr*1.91],mat:7,color:[.022,.024,.026]});put({...base,p:[x,y,z+side*.075],s:[mod.wr*1.42,.025,mod.wr*1.42],mat:0,color:[.25,.27,.28]});put({shape:'bevel',p:[x+.10,y,z+side*.084],s:[.08,.23,.055],mat:0,color:[.32,.32,.29]});for(let j=0;j<28;j++){const a=j*2*PI/28+roll;put({shape:'box',p:[x+Math.sin(a)*mod.wr*.992,y+Math.cos(a)*mod.wr*.992,z],s:[.010,.008,.16],r:[0,steer,-a],mat:7,color:[.009,.01,.011],surface:'object'});}
  put({...base,p:[x,y,z+side*.098],s:[mod.wr*1.50,.012,mod.wr*1.50],mat:0,color:SILVER});
  for(let j=0;j<(mod.type==='gti'?8:12);j++){
   const a=j*2*PI/(mod.type==='gti'?8:12)+roll,rad=mod.wr*.51;
   if(mod.type==='gti')put({...base,p:[x+Math.sin(a)*rad,y+Math.cos(a)*rad,z+side*.107],s:[.062,.013,.062],mat:7,color:BLACK});
   else{const mid=mod.wr*.55;put({shape:'bevel',p:[x+Math.sin(a)*mid,y+Math.cos(a)*mid,z+side*.11],s:[.018,mod.wr*.25,.013],r:[0,steer,-a-.12],mat:7,color:DARK,surface:'object'});}
  }
  put({...base,p:[x,y,z+side*.12],s:[mod.type==='gti'?.074:.13,.015,mod.type==='gti'?.074:.13],mat:0,color:SILVER});
 }
 // Steering wheel: three spokes in its true cabin position, driven by BITUME's filtered steering.
 const pose=options.cockpit?cockpitPose(car,options.time):null,turn=clamp(Number(car.volant)||0,-1,1)*1.7,cx=.10,cy=.79,cz=-.34,rad=.185;
 put({shape:'ring',p:[cx,cy,cz],s:[rad*2,.22,rad*2],r:[0,0,PI/2],mat:7,color:BLACK,surface:'object'});
 for(const a0 of [PI/2,-PI/2,PI]){const a=a0+turn;put({shape:'box',p:[cx,cy+Math.cos(a)*rad*.46,cz+Math.sin(a)*rad*.46],s:[.024,rad,.035],r:[a,0,0],mat:7,color:DARK,surface:'object'});}
 put({shape:'bevel',p:[cx-.018,cy,cz],s:[.05,.08,.105],r:[turn,0,0],mat:7,color:DARK,surface:'object'});
 const knob=pose?.knob||gearPosition(car.arriere?-1:car.rapport||0),lever=knob.map((v,i)=>v-COCKPIT.leverBase[i]),leverLength=Math.hypot(...lever);
 put({shape:'cylinder',p:knob.map((v,i)=>(v+COCKPIT.leverBase[i])/2),s:[.022,leverLength,.022],r:[Math.acos(lever[1]/leverLength),Math.atan2(lever[0],lever[2]),0],mat:7,color:BLACK,surface:'object',cockpitPart:'gear-lever'});
 put({shape:'sphere',p:knob,s:[.065,.065,.065],mat:7,color:DARK,surface:'object',cockpitPart:'gear-knob'});
 // Engraved H pattern stays on the knob; it is geometry, not a texture.
 for(const z of [-.015,0,.015])put({shape:'box',p:[knob[0],knob[1]+.032,knob[2]+z],s:[.023,.0015,.002],mat:0,color:SILVER,surface:'object'});
 put({shape:'box',p:[knob[0],knob[1]+.032,knob[2]],s:[.002,.0015,.032],mat:0,color:SILVER,surface:'object'});
 if(pose)cockpitGeometry(pose,put);
 const rpm=car.moteur?(car.regime||900):0;
 for(const [z,r,kind]of mod.gauges){const v=kind==='speed'?Math.min(1,(car.v||0)*3.6/220):kind==='rpm'?rpm/8000:kind==='boost'?(car.gaz||0)*.9:.48,a=-2.3+v*4.6,y=kind==='boost'?.803:.851;put({shape:'box',p:[.214,y+Math.cos(a)*r*.36,z+Math.sin(a)*r*.36],s:[.006,r*.75,.004],r:[a,0,0],mat:5,color:[1,.32,.12],emissive:.25,surface:'object'});}
 return mod;
}
// Pre-register both geometries before the single WebGL renderer is created.
model('gti');model('r5');
R.vehicles={model,render,SPECS,PALETTE,rgb,cockpitPose,COCKPIT};
})(globalThis.RADE=globalThis.RADE||{});
