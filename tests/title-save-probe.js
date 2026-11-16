/* Browser-only observer. Captures values, never retains a generated session. */
(()=>{
 const clone=value=>JSON.parse(JSON.stringify(value));
 const p=window.__titleSaveProbe={created:0,initial:null,loaded:null,liveAtFactory:null,liveArguments:null};
 p.state=s=>s?clone({cash:s.campaign.state.cash,hp:s.player.hp,player:s.player,inventory:s.sim.state.inventory,weapon:s.sim.state.weapon,map:s.campaign.state.mapOwned,time:s.time,weather:s.weather.save(),business:s.business.inventory}):null;
 p.freshExpected={cash:200,hp:100,inventory:{weapons:[true,true,true],ammo:[180,36,12]},weapon:0,map:false,time:0,weather:{clockHours:14,elapsed:0,wet:0,cloud:.22,rain:0,wind:.28,storm:0,cloudX:0,cloudZ:0},business:{bandage:0,provision:0,valuable:0,ammo:0}};
 let namespace;const seen=new WeakSet();
 Object.defineProperty(globalThis,'RADE',{configurable:true,get(){return namespace;},set(value){
  namespace=value;if(seen.has(value))return;seen.add(value);let sessionAPI,storageAPI;
  Object.defineProperty(value,'session',{configurable:true,get(){return sessionAPI;},set(api){sessionAPI=api;const create=api.create;api.create=function(options={}){
   const target=value.game?.transition,s=create.call(this,options);p.created++;
   if(target==='play'){p.liveArguments={saved:clone(options.saved??null),now:options.now};p.liveAtFactory=p.state(s);}
   return s;
  };}});
  Object.defineProperty(value,'storage',{configurable:true,get(){return storageAPI;},set(api){storageAPI=api;const load=api.load;api.load=function(...args){const startedAt=Date.now(),result=load.apply(this,args);p.loaded={startedAt,endedAt:Date.now(),value:clone(result)};return result;};}});
 }});
 const hidden=Object.getOwnPropertyDescriptor(HTMLElement.prototype,'hidden');
 Object.defineProperty(HTMLElement.prototype,'hidden',{...hidden,set(value){hidden.set.call(this,value);if(this.id!=='title'||value||p.initial)return;const g=namespace?.game;
  p.initial={at:Date.now(),created:p.created,ready:g?.ready===true,sessionNull:g?.session===null,rendererNull:g?.renderer===null,crowdNull:g?.crowdView===null,drawCount:g?.drawCount,persisted:localStorage.getItem('rade-solo-v2')};
 }});
})();
