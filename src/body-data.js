/* Original procedural clothing, limbs and hands with continuous two-joint weights. */
(function(R){'use strict';const G=R.proceduralHuman;if(!G)throw Error('Load procedural human-data before body-data');const m=G.mesh(),{surface,ellipsoid,profile,smooth,clamp}=G;
 const shirt=[[1.035,.195,.140],[1.11,.197,.145],[1.24,.207,.150],[1.36,.222,.146],[1.43,.229,.132],[1.475,.185,.104],[1.51,.062,.062]];
 surface(m,{bottom:1.035,top:1.51,rows:30,sides:36,material:1,point(y,a){const [rx,rz]=profile(y,shirt),fold=.0015*Math.sin(y*58+a*3)*Math.sin(a*5);return [(rx+fold)*Math.cos(a),y,(rz+fold)*Math.sin(a)];}});
 surface(m,{bottom:.87,top:1.035,rows:12,sides:32,material:2,point(y,a){const [rx,rz]=profile(y,[[.87,.158,.108],[.95,.185,.127],[1.035,.195,.140]]);return [rx*Math.cos(a),y,rz*Math.sin(a)];}});
 for(const side of [-1,1]){
  const upper=side>0?3:2,fore=side>0?19:18,thigh=side>0?5:4,shin=side>0?17:16;
  surface(m,{bottom:.955,top:1.485,rows:36,sides:22,material:1,bones(y){if(y>1.40)return [upper,0,smooth(1.40,1.485,y)*.95];return [upper,fore,1-smooth(1.135,1.245,y)];},point(y,a){const [rx,rz]=profile(y,[[.955,.045,.049],[1.04,.053,.058],[1.12,.058,.063],[1.19,.057,.062],[1.30,.069,.076],[1.40,.077,.082],[1.43,.075,.080],[1.465,.050,.056],[1.485,.012,.018]]),t=clamp((1.43-y)/.24),lower=clamp((1.19-y)/.24),cx=side*(y>1.43?.235-.085*smooth(1.43,1.485,y):y<1.19?.255+.005*lower:.235+.020*t),cz=.015*lower,fold=.0012*Math.sin(y*65+a*3);return [cx+(rx+fold)*Math.cos(a),y,cz+(rz+fold)*Math.sin(a)];}});
  ellipsoid(m,[side*.26,.910,.015],[.042,.057,.024],{bone:[fore,fore,0],rows:12,sides:20});
  const lengths=[.045,.057,.054,.043],offsets=[-.027,-.009,.010,.027];
  for(let f=0;f<4;f++)ellipsoid(m,[side*(.26+offsets[f]),.861-lengths[f]/2,.018],[.0095,lengths[f]/2+.009,.0105],{bone:[fore,fore,0],rows:8,sides:10});
  ellipsoid(m,[side*.216,.900,.026],[.012,.030,.014],{bone:[fore,fore,0],tilt:side*.42,rows:10,sides:12});
  surface(m,{bottom:.145,top:1.0,rows:40,sides:24,material:2,bones(y){if(y>.88)return [thigh,0,smooth(.88,1.0,y)*.7];return [thigh,shin,1-smooth(.465,.575,y)];},point(y,a){const [rx,rz]=profile(y,[[.145,.058,.065],[.29,.072,.082],[.45,.078,.086],[.54,.080,.088],[.72,.096,.107],[.88,.103,.115],[1.0,.102,.119]]),fold=.0014*Math.sin(y*52+a*4);return [side*.105+(rx+fold)*Math.cos(a),y,(rz+fold)*Math.sin(a)];}});
 }
 R.bodyData=G.normalise(m);R.bodyData.provenance=G.provenance;
})(globalThis.RADE);
