import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
for(const name of ['ferro/renderer','bitume/carene','bitume/main','bitume/voiture','bitume/conduite','vehicles','mobility','pdr/ville-reelle'])await import('../src/'+name+'.js');
const before=execFileSync('git',['show','d22a5eb:src/traffic.js'],{encoding:'utf8',cwd:new URL('..',import.meta.url)}),after=fs.readFileSync(new URL('../src/traffic.js',import.meta.url),'utf8');
const specs={car:{width:2,length:4},narrow:{width:.7,length:.7},point:{width:0,length:0}};
function scan(source,world){
 const clear=source.slice(source.indexOf(' function clearLine('),source.indexOf(' function distanceToIntel(')),obstacle=source.slice(source.indexOf(' function considerObstacle('),source.indexOf(' function startRecovery('));
 return vm.runInNewContext(`(()=>{const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));const staticFree=(x,z,r=.92)=>world.withoutCar(()=>!world.blocked(x,z,r,.08,1.6));${clear}${obstacle}return obstacleScan;})()`,{world,R:{vehicles:{SPECS:specs}}});
}
function worldOf(options={}){
 const calls=[],c={model:'car',x:0,z:0,cap:0,v:10,...options.car};
 const world={fleet:[c,...structuredClone(options.vehicles||[])],pedestrians:structuredClone(options.people||[]),policeOfficers:structuredClone(options.officers||[]),playerSeated:!!options.seated,withoutCar(fn){return fn();},blocked(x,z,r,y,h){calls.push([x,z,r,y,h]);return !Number.isFinite(x)||!Number.isFinite(z)||!!options.blocked?.(x,z,r);}};
 return {world,c,calls};
}
const equal=(a,b)=>a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
function isSubsequence(small,large){let i=0;for(const q of large)if(i<small.length&&equal(small[i],q))i++;assert.equal(i,small.length,'remaining collision probes preserve their exact order and numbers');}
let checks=0,oldQueries=0,newQueries=0;
function compare(label,options={}){
 const a=worldOf(options),b=worldOf(options),player=options.player===undefined?null:options.player,direction=options.direction??1;
 const old=scan(before,a.world)(a.c,player,direction),next=scan(after,b.world)(b.c,player,direction);
 assert.deepEqual({...next},{...old},label);isSubsequence(b.calls,a.calls);oldQueries+=a.calls.length;newQueries+=b.calls.length;checks++;
 if(options.expected)assert.deepEqual({...old},options.expected,label+' expected winner');return {old:oldQueries,now:newQueries,queriesBefore:a.calls.length,queriesAfter:b.calls.length};
}
compare('empty forward');compare('empty reverse',{direction:-1});
compare('vehicle wins exact tie with player/pedestrian/officer',{vehicles:[{model:'narrow',x:5,z:0}],player:{x:5,z:0},people:[{x:5,z:0,hp:100}],officers:[{x:5,z:0,hp:100,inside:false}],expected:{distance:5-2-.35,kind:'vehicle'}});
compare('player wins exact tie with later people',{player:{x:5,z:0},people:[{x:5,z:0,hp:100}],officers:[{x:5,z:0,hp:100,inside:false}],expected:{distance:5-2-.35,kind:'player'}});
compare('closer occulted pedestrian cannot replace farther vehicle',{vehicles:[{model:'narrow',x:8,z:0}],people:[{x:4,z:0,hp:100}],blocked:(x,z,r)=>r===.12&&x>1,expected:{distance:8-2-.35,kind:'vehicle'}});
compare('closer visible pedestrian replaces vehicle',{vehicles:[{model:'narrow',x:8,z:0}],people:[{x:4,z:0,hp:100}],expected:{distance:4-2-.35,kind:'pedestrian'}});
compare('first static hit, later static hits cannot improve',{blocked:(x,z,r)=>r===.32&&x>3});
compare('static exact tie keeps existing vehicle',{vehicles:[{model:'point',x:2+.15,z:0}],blocked:()=>true,expected:{distance:(2+.15)-2,kind:'vehicle'}});
compare('overlapping vehicle with negative clearance',{vehicles:[{model:'car',x:1,z:0}],people:[{x:5,z:0,hp:100}],blocked:()=>true,expected:{distance:-3,kind:'vehicle'}});
compare('reverse pedestrians and near wall',{direction:-1,people:[{x:-8,z:0,hp:100},{x:5,z:0,hp:100}],blocked:(x,z,r)=>r===.32&&x<-3});
compare('seated player and inside/dead officers ignored',{seated:true,player:{x:1,z:0},officers:[{x:2,z:0,hp:100,inside:true},{x:3,z:0,hp:0,inside:false}]});
for(const x of [-1,.25-1e-15,.25,.25+1e-15,25,25+1e-12,NaN,Infinity,-Infinity])for(const z of [0,1.43-1e-15,1.43,1.43+1e-15])compare('person thresholds '+x+'/'+z,{people:[{x,z,hp:100}],vehicles:[{model:'narrow',x:9,z:0}]});
for(const key of ['v','cap','x'])for(const value of [NaN,Infinity,-Infinity])compare('nonfinite '+key+'/'+value,{car:{[key]:value},people:[{x:5,z:0,hp:100}],vehicles:[{model:'car',x:8,z:0}]});
for(const direction of [0,NaN,Infinity,-Infinity])compare('nonstandard direction '+direction,{direction,people:[{x:5,z:0,hp:100}],blocked:(x,z,r)=>r===.32&&Math.abs(x)>3});
let seed=1871;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
for(let i=0;i<120;i++){
 const cap=(random()-.5)*Math.PI*2,people=Array.from({length:80},()=>({x:(random()-.5)*48,z:(random()-.5)*48,hp:random()>.08?100:0})),vehicles=Array.from({length:15},()=>({model:'car',x:(random()-.5)*40,z:(random()-.5)*40}));
 compare('seeded scene '+i,{car:{cap,v:random()*18},people,vehicles,direction:i%2?-1:1,player:{x:random()*14,z:random()*5},blocked:(x,z)=>x>7&&x<7.5&&Math.abs(z)<12});
}
const dense=compare('dense queue structural reduction',{vehicles:[{model:'car',x:5,z:0}],people:Array.from({length:960},(_,i)=>({x:8+i%16,z:(i%5-2)*.1,hp:100}))});
assert(dense.queriesAfter<dense.queriesBefore/20,'skip proven losing visibility rays in dense crowd');

// Whole real traffic update + vehicle physics, not a mocked decision function.
function makeWorld(){const w={fleet:[],car:{x:-500,z:-500},weather:null,playerSeated:false,ground:()=>.08,surface:()=>({mu:1.15,type:'piste'}),city:{rues:{aretes:[]}},pedestrians:Array.from({length:160},(_,i)=>({x:5+i%20,z:-12+Math.floor(i/20)*3,hp:i%17?100:0})),policeOfficers:[],blocked:(x,z)=>Math.abs(x)>210||Math.abs(z)>210||x>7&&x<7.4&&z>10&&z<30,withoutCar:fn=>fn(),carContact:()=>null};w.moveVehicle=(c,dx,dz,cap)=>{const x=c.x+dx,z=c.z+dz;if(w.blocked(x,z))return {nx:-Math.cos(cap),nz:-Math.sin(cap),depth:.1};c.x=x;c.z=z;c.cap=cap;return null;};for(let x=-60;x<=60;x+=20)w.city.rues.aretes.push({sorte:'rue',largeur:6,points:[x,-60,x,60]});for(let z=-60;z<=60;z+=20)w.city.rues.aretes.push({sorte:'rue',largeur:6,points:[-60,z,60,z]});return w;}
function factory(source){const R={vehicles:RADE.vehicles},realm=vm.createContext({RADE:R,PDR,BITUME});vm.runInContext(source,realm);return R.traffic.create;}
const worlds=[makeWorld(),makeWorld()],traffic=[factory(before)(worlds[0],{count:12}),factory(after)(worlds[1],{count:12})],laws=worlds.map(()=>({heat:0,wanted:0,seen:false,lastKnown:null,reportRevision:0,cooldown:0}));
for(let i=0;i<450;i++){
 const player={x:2+Math.sin(i*.02)*10,z:5+Math.cos(i*.02)*8,hp:100};
 for(let j=0;j<2;j++){if(i===25||i===180)Object.assign(laws[j],{heat:3,wanted:3,lastKnown:{x:player.x,z:player.z},reportRevision:laws[j].reportRevision+1});if(i===360)Object.assign(laws[j],{heat:0,wanted:0});worlds[j].playerSeated=i>280&&i<320;traffic[j].update(1/30,laws[j],player);}
 assert.deepEqual(structuredClone(traffic[1].cars),structuredClone(traffic[0].cars),'real trajectory exact '+i);assert.deepEqual(structuredClone(laws[1]),structuredClone(laws[0]));assert.deepEqual({...traffic[1].metrics},{...traffic[0].metrics});
}
console.log(JSON.stringify({pass:true,oracle:'d22a5eb',scenes:checks,queries:{before:oldQueries,after:newQueries,denseBefore:dense.queriesBefore,denseAfter:dense.queriesAfter},productionTrafficTicks:450,vehicles:traffic[0].cars.length,scope:'Exact winners, strict ties, visibility, nonfinite inputs, remaining query order and full AI/physics trajectory; no timing claim.'},null,2));
