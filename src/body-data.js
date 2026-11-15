/* Original procedural clothing, limbs and hands with continuous two-joint weights. */
(function(R){'use strict';const G=R.proceduralHuman;if(!G)throw Error('Load procedural human-data before body-data');const m=G.mesh(),{surface,ellipsoid,profile,smooth,clamp}=G;
 // Rounded shoulder fall and raised neckline use the existing rings.
 const shirt=[[1.035,.195,.140],[1.11,.197,.145],[1.24,.207,.150],[1.36,.219,.143],[1.43,.216,.122],[1.475,.150,.088],[1.495,.077,.066],[1.512,.070,.064],[1.532,.067,.061]];
 surface(m,{bottom:1.035,top:1.532,rows:26,sides:28,material:1,point(y,a){const [rx,rz]=profile(y,shirt),fold=.0015*Math.sin(y*58+a*3)*Math.sin(a*5);return [(rx+fold)*Math.cos(a),y-.018*smooth(1.475,1.532,y)*Math.max(0,Math.sin(a))**2,(rz+fold)*Math.sin(a)];}});
 surface(m,{bottom:.87,top:1.035,rows:10,sides:28,material:2,point(y,a){const [rx,rz]=profile(y,[[.87,.158,.108],[.95,.185,.127],[1.035,.195,.140]]);return [rx*Math.cos(a),y,rz*Math.sin(a)];}});
 for(const side of [-1,1]){
  const upper=side>0?3:2,fore=side>0?19:18,thigh=side>0?5:4,shin=side>0?17:16,foot=side>0?21:20;
  surface(m,{bottom:.955,top:1.485,rows:30,sides:18,material:1,bones(y){if(y>1.40)return [upper,0,smooth(1.40,1.485,y)*.95];return [upper,fore,1-smooth(1.135,1.245,y)];},point(y,a){const [rx,rz]=profile(y,[[.955,.045,.049],[1.04,.053,.058],[1.12,.058,.063],[1.19,.057,.062],[1.30,.069,.076],[1.40,.070,.076],[1.43,.061,.068],[1.465,.036,.043],[1.485,.012,.018]]),t=clamp((1.43-y)/.24),lower=clamp((1.19-y)/.24),cx=side*(y>1.43?.235-.085*smooth(1.43,1.485,y):y<1.19?.255+.005*lower:.235+.020*t),cz=.015*lower,fold=.0012*Math.sin(y*65+a*3);return [cx+(rx+fold)*Math.cos(a),y-.026*smooth(1.27,1.43,y)*Math.max(0,side*Math.cos(a))**2,cz+(rz+fold)*Math.sin(a)];}});
  ellipsoid(m,[side*.26,.910,.015],[.042,.057,.024],{bone:[fore,fore,0],rows:10,sides:16});
  const lengths=[.045,.057,.054,.043],offsets=[-.027,-.009,.010,.027];
  for(let f=0;f<4;f++)ellipsoid(m,[side*(.26+offsets[f]),.861-lengths[f]/2,.018],[.0095,lengths[f]/2+.009,.0105],{bone:[fore,fore,0],rows:7,sides:8});
  ellipsoid(m,[side*.216,.900,.026],[.012,.030,.014],{bone:[fore,fore,0],tilt:side*.42,rows:10,sides:12});
  surface(m,{bottom:.145,top:1.0,rows:32,sides:20,material:2,bones(y){if(y>.88)return [thigh,0,smooth(.88,1.0,y)*.7];return [thigh,shin,1-smooth(.465,.575,y)];},point(y,a){const [rx,rz]=profile(y,[[.145,.058,.065],[.29,.072,.082],[.45,.078,.086],[.54,.080,.088],[.72,.096,.107],[.88,.103,.115],[1.0,.102,.119]]),fold=.0014*Math.sin(y*52+a*4);return [side*.105+(rx+fold)*Math.cos(a),y,(rz+fold)*Math.sin(a)];}});
  // Rounded shoes are part of the same rig, with a separate ankle pivot.
  surface(m,{bottom:.005,top:.145,rows:12,sides:20,material:4,bones:()=>[foot,foot,0],point(y,a){const [rx,rz,cz]=profile(y,[[.005,.052,.110,.027],[.020,.059,.126,.035],[.052,.060,.124,.032],[.088,.055,.105,.023],[.115,.047,.071,.010],[.145,.041,.052,0]]);return [side*.105+rx*Math.cos(a)*(1-.08*Math.max(0,Math.sin(a))),y,cz+rz*Math.sin(a)];}});

 }
 R.bodyData=G.normalise(m);R.bodyData.feet=true;R.bodyData.provenance=G.provenance;
})(globalThis.RADE);
