import assert from 'node:assert/strict';import fs from 'node:fs';
// Exercise the actual shader's two scalar UV conversions against a geometric
// receiver plane. No renderer helper is introduced solely for this regression.
const source=fs.readFileSync(new URL('../src/ferro/renderer.js',import.meta.url),'utf8'),conversion=source.match(/slope\*=([^;]+);/),sample=source.match(/return step\(depth\+dot\(slope,([^;]+?)\),texture\(uShadowMap,tap\)\.r\);/);assert(conversion&&sample,'Receiver-plane shader expressions are present');const slopeFactor=Function('slot','uShadowSettings','return '+conversion[1]),sampleDelta=Function('centre','uv','return '+sample[1]);
const texel=1/2048,kernel=[[0,0],[-1.25,0],[1.25,0],[0,-1.25],[0,1.25],[-1.25,-1.25],[1.25,-1.25],[-1.25,1.25],[1.25,1.25]],gradients=[[.8,.3],[-.8,.3],[.2,-1.2],[-.01,.03]],depth=.5,bias=.00014;let samples=0,oldFullAtlasAcne=0;
for(const [slot,w,scale,tile] of [[1,2,1,[0,0]],[1,1,.5,[.5,0]],[0,0,.5,[0,0]],[2,0,.5,[0,.5]]])for(const slope of gradients)for(let phase=0;phase<17;phase++){
 const projected=[.43+phase*texel*.17,.48+phase*texel*.31],uv=projected.map((n,i)=>n*scale+tile[i]);
 for(const offset of kernel){const centre=uv.map((n,i)=>(Math.floor((n+offset[i]*texel)/texel)+.5)*texel),actualPlaneDepth=depth+slope.reduce((sum,n,i)=>sum+n*(centre[i]-uv[i])/scale,0),comparison=depth-bias+slope.reduce((sum,n,i)=>sum+n*slopeFactor(slot,{w})*sampleDelta(centre[i],uv[i]),0);
  assert(comparison<=actualPlaneDepth+1e-12,'A sloping surface must not shadow itself in any atlas layout or camera phase');assert(comparison>actualPlaneDepth-.02,'An occluder 2% of the depth range nearer must still shadow the receiver');
  if(scale===1&&depth-bias+slope.reduce((sum,n,i)=>sum+n*(centre[i]-uv[i])*2,0)>actualPlaneDepth)oldFullAtlasAcne++;samples++;
 }
}
assert(oldFullAtlasAcne>0,'Fixture must reproduce the former full-atlas slope defect');console.log(JSON.stringify({samples,oldFullAtlasAcne,checks:['Actual shader UV conversions match geometric receiver depth in full/half atlas','All 9 PCF taps at 17 sub-texel camera phases remain lit without an occluder','A real nearer occluder still shadows the surface']},null,2));
