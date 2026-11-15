/* RADE — lazy procedural furnishing behind physically broken building façades.
   Structural damage keeps its original FERRO signature; this derived shell is
   rebuilt only when damage or the nearest exposed rooms change. */
(function(R){'use strict';
const validPoint=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite),EPS=.0001;
function subtract(a,b){const lo=a.lo.map((n,i)=>Math.max(n,b.lo[i])),hi=a.hi.map((n,i)=>Math.min(n,b.hi[i]));if(lo.some((n,i)=>n>=hi[i]-EPS))return [a];const out=[],put=(lo,hi)=>{if(lo.every((n,i)=>hi[i]-n>EPS))out.push({lo,hi});};
 put(a.lo,[lo[0],a.hi[1],a.hi[2]]);put([hi[0],a.lo[1],a.lo[2]],a.hi);
 put([lo[0],a.lo[1],a.lo[2]],[hi[0],lo[1],a.hi[2]]);put([lo[0],hi[1],a.lo[2]],[hi[0],a.hi[1],a.hi[2]]);
 put([lo[0],lo[1],a.lo[2]],[hi[0],hi[1],lo[2]]);put([lo[0],lo[1],hi[2]],[hi[0],hi[1],a.hi[2]]);return out;
}
function create(world,interiors,baseMeshes,{saved=[],legacyDamage=null,onProject=()=>{}}={}){
 const openings=new Map(),indices=new WeakMap();let uniqueSources=true;for(let i=0;i<baseMeshes.length;i++){if(indices.has(baseMeshes[i]))uniqueSources=false;indices.set(baseMeshes[i],i);}let selected=[],lights=[],lastX=Infinity,lastZ=Infinity,elapsed=1,revision=-1,selectionKey='',dirty=false,controller=null;const shellCache=new WeakMap();
 let openingRevision=0,exteriorController=null,exteriorSource=null,exteriorOpeningRevision=-1,exteriorMeshes=null,exteriorCuts=null,combinedMeshes=null,combinedPrefix=null,deltaGeneration=0;
 function register(sourceId,point,floor){const match=/^piece-(\d+)$/.exec(sourceId||''),index=match?Number(match[1]):-1,mesh=baseMeshes[index];if(!mesh||!validPoint(point)||!interiors?.breachFootprint)return false;const found=interiors.breachFootprint(mesh);if(!found)return false;const base=mesh.p[1]-mesh.s[1]/2;
  floor=Number.isInteger(floor)?floor:Math.floor(Math.max(0,point[1]-base)/3.1);if(floor<0||floor>=found.building.floors||base+(floor+1)*3.1>mesh.p[1]+mesh.s[1]/2+.2)return false;const id=sourceId+':'+floor;if(openings.has(id)||openings.size>=256)return false;
  openings.set(id,{id,sourceId,index,point:point.slice(),floor,buildingId:found.building.id,footprint:found.q});openingRevision++;dirty=true;return true;
 }
 for(const o of Array.isArray(saved)?saved.slice(0,256):[])if(o&&validPoint(o.point))register(o.sourceId,o.point,o.floor);
 if(!saved?.length)for(const state of legacyDamage?.states||[])if(!state.removed)for(const cut of state.cuts||[]){const at=[(cut.minX+cut.maxX)/2,(cut.minY+cut.maxY)/2,(cut.minZ+cut.maxZ)/2];register(state.id,at);}
 function observe(result){let changed=false;for(const e of result?.events||[])if(e.name==='materialBreak'){const p=[e.x,e.y,e.z];changed=register(e.sourceId,p)||changed;}return changed;}
 function hollow(mesh,records){let saved=shellCache.get(mesh),key=records.map(r=>r.floor).sort().join(',');if(saved?.key===key)return saved.meshes;const a=BITUME.voiture.euler(...(mesh.r||[0,0,0])),inv=v=>a.map(axis=>axis.reduce((n,x,i)=>n+x*v[i],0));let parts=[{lo:mesh.s.map(v=>-v/2),hi:mesh.s.map(v=>v/2)}];
  for(const record of records){const base=baseMeshes[record.index],center=inv(base.p.map((v,i)=>v-mesh.p[i])),bottom=base.p[1]-base.s[1]/2+record.floor*3.1,cut={lo:[center[0]-base.s[0]/2+.30,bottom+.08-mesh.p[1],center[2]-base.s[2]/2+.30],hi:[center[0]+base.s[0]/2-.30,bottom+3.02-mesh.p[1],center[2]+base.s[2]/2-.30]};parts=parts.flatMap(p=>subtract(p,cut));}
  const meshes=parts.map(p=>{const center=p.lo.map((n,i)=>(n+p.hi[i])/2),offset=BITUME.voiture.mul(a,center);return {...mesh,p:mesh.p.map((n,i)=>n+offset[i]),s:p.hi.map((n,i)=>n-p.lo[i]),breachShell:true};});shellCache.set(mesh,{key,meshes});return meshes;
 }
 function choose(position){const x=position?.x,z=position?.z;if(!Number.isFinite(x)||!Number.isFinite(z))return false;
  const records=[...openings.values()].filter(o=>!controller||controller.isAlive(o.sourceId)).map(o=>({o,d:Math.hypot(o.point[0]-x,o.point[2]-z)})).filter(q=>q.d<=80).sort((a,b)=>a.d-b.d||a.o.id.localeCompare(b.o.id)).slice(0,8),key=records.map(q=>q.o.id).sort().join('|');if(key===selectionKey)return false;
  selectionKey=key;selected=records.map(({o})=>interiors.breachProjection({mesh:baseMeshes[o.index],point:o.point,buildingId:o.buildingId,floor:o.floor})).filter(Boolean);for(const bridge of selected)onProject(bridge);dirty=true;return true;
 }
 // Refine only proposed local replacements. Equal fragments remain retained
 // occurrences, so downstream collision/render deltas never reinsert them.
 function localDelta(before,after,splices){
  const refined=[];for(const q of splices){if(!q.deleteCount&&!q.items.length)continue;
   if(R.world?.diffScenery){const d=R.world.diffScenery(before.slice(q.start,q.start+q.deleteCount),q.items);for(const r of d.splices)refined.push({...r,start:q.start+r.start});}
   else refined.push(q);
  }return {before,after,generation:deltaGeneration,full:false,splices:refined};
 }
 function rebuild(dc){controller=dc;if(!dc)return false;
  // Without a cutaway interior, the destruction output is already the exact
  // visible street. Keep its array identity so world can apply the local delta.
  if(!openings.size&&!selected.length){lights=[];deltaGeneration=Math.max(deltaGeneration,dc.meshDelta?.generation||0);world.replaceScenery(dc.meshes,{meshDelta:dc.meshDelta});revision=dc.revision;dirty=false;return true;}
  let prefixDelta=null;
  // Damage inside a projected room does not change the street controller or
  // its openings. Reuse that exact exterior instead of scanning the city once
  // again for every room touched by the same explosion.
  if(exteriorController!==dc||exteriorSource!==dc.meshes||exteriorOpeningRevision!==openingRevision){
   const groups=new Map();for(const o of openings.values()){if(!groups.has(o.index))groups.set(o.index,[]);groups.get(o.index).push(o);}const source=dc.meshes,spans=[];
   let spanMode=uniqueSources&&typeof dc.sourceSpan==='function';
   if(spanMode){for(const index of groups.keys()){const q=dc.sourceSpan(index);if(!q||!Number.isInteger(q.start)||!Number.isInteger(q.length)||q.start<0||q.length<0||q.start+q.length>source.length){spanMode=false;break;}if(q.length)spans.push(q);}spans.sort((a,b)=>a.start-b.start);for(let i=1;i<spans.length;i++)if(spans[i].start<spans[i-1].start+spans[i-1].length)spanMode=false;}
   const transform=(m,out)=>{const index=indices.get(m)??Number(/^piece-(\d+)$/.exec(m.destructibleId||'')?.[1]),records=groups.get(index);if(records&&m.shape==='box')out.push(...hollow(m,records));else out.push(m);};
   let exterior,cuts=null;
   if(spanMode){
    // Native copies preserve every untouched occurrence; only open building
    // slots execute the shell transformation. No whole-city JS push loop.
    const parts=[];cuts=[];let at=0;
    for(const q of spans){if(q.start>at)parts.push(source.slice(at,q.start));const items=[],end=q.start+q.length;for(let i=q.start;i<end;i++)transform(source[i],items);parts.push(items);cuts.push({start:q.start,deleteCount:q.length,items});at=end;}
    if(at<source.length)parts.push(source.slice(at));exterior=[].concat(...parts);
    // Rebase the existing exterior through the controller's exact edit log.
    // Undo/redo spans are small; composition never visits retained city meshes.
    const change=exteriorSource===source?{before:source,after:source,full:false,splices:[]}:dc.meshDelta;
    if(exteriorController===dc&&exteriorCuts&&change&&!change.full&&change.before===exteriorSource&&change.after===source&&R.world?.composeSceneDeltas){
     let offset=0;const undo=[];for(const q of exteriorCuts){undo.push({start:q.start+offset,deleteCount:q.items.length,items:exteriorSource.slice(q.start,q.start+q.deleteCount)});offset+=q.items.length-q.deleteCount;}
     const composed=R.world.composeSceneDeltas(exteriorMeshes,[{before:exteriorMeshes,after:exteriorSource,full:false,splices:undo},change,{before:source,after:exterior,full:false,splices:cuts}]);
     if(composed)prefixDelta=localDelta(exteriorMeshes,exterior,composed.splices);
    }
   }else{exterior=[];for(const m of source)transform(m,exterior);}
   exteriorController=dc;exteriorSource=source;exteriorOpeningRevision=openingRevision;exteriorMeshes=exterior;exteriorCuts=cuts;
  }
  const suffix=[];lights=[];
  for(const bridge of selected){bridge.refresh();suffix.push(...bridge.scenery);lights.push(...bridge.lights);}
  const meshes=exteriorMeshes.concat(suffix);let meshDelta=null;deltaGeneration++;
  if(combinedMeshes&&world.scenery===combinedMeshes&&(combinedPrefix===exteriorMeshes||prefixDelta?.before===combinedPrefix)){
   const start=combinedPrefix.length,splices=prefixDelta?prefixDelta.splices.slice():[];
   splices.push({start,deleteCount:combinedMeshes.length-start,items:suffix});meshDelta=localDelta(combinedMeshes,meshes,splices);
  }else if(R.world?.diffScenery)meshDelta=R.world.diffScenery(world.scenery,meshes);
  world.replaceScenery(meshes,meshDelta?{meshDelta}:undefined);combinedMeshes=meshes;combinedPrefix=exteriorMeshes;
  for(const bridge of selected)for(const collider of bridge.colliders)world.addBox({...collider});revision=dc.revision;dirty=false;return true;
 }
 function sync(dc,position){controller=dc;choose(position);return rebuild(dc);}
 function update(dt,position){elapsed+=dt;if(elapsed<.25&&!dirty)return false;elapsed=0;if(Math.hypot((position?.x??0)-lastX,(position?.z??0)-lastZ)>3||dirty){lastX=position?.x;lastZ=position?.z;choose(position);}if(dirty||controller&&controller.revision!==revision)return rebuild(controller);return false;}
 function roomChanged(room){if(selected.some(b=>b.room.sceneId===room.sceneId)){dirty=true;return true;}return false;}
 function inside(point){for(const bridge of selected){const q=bridge.toRoom(point);if(q[0]>1000-bridge.room.w/2+.03&&q[0]<1000+bridge.room.w/2-.03&&q[2]>1000-bridge.room.d/2+.03&&q[2]<1000+bridge.room.d/2-.03&&point[1]>bridge.void.minY+.02&&point[1]<bridge.void.maxY-.02)return bridge;}return null;}
 function cross(previous,current){if(world.room||world.playerSeated)return false;return selected.some(b=>interiors.enterBreach(b,previous,current));}
 return {observe,sync,update,roomChanged,inside,cross,rebuild,get projections(){return selected;},get lights(){return lights;},get count(){return openings.size;},save:()=>[...openings.values()].map(({sourceId,point,floor})=>({sourceId,point:point.slice(),floor}))};
}
R.breaches={create};
})(globalThis.RADE);
