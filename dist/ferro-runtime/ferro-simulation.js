/* FERRO 0.3.2 — procedural engine. */
/* FPassages — passages obligatoires, analysés sur données plates.
   Brique de moteur générique : elle ne connaît ni salles, ni pièges, ni METAL.
   Elle reçoit des rectangles, des solides et un graphe de liens, et répond à
   deux questions : « ce bloc barre-t-il le chemin ? » et « ce lien est-il le
   seul qui relie ces deux zones ? ». Tout est déterministe : ni horloge, ni
   hasard, ni ordre d'itération dépendant de l'environnement. */
(function () {
  'use strict';
  const FMath = (typeof window!=='undefined'?window:globalThis).FMath;
  const FPassages = {};

  // Grille d'occupation d'un corps de rayon `radius` et de hauteur `height`.
  // `heightAt(x,z)` renvoie la hauteur du sol ou null hors du sol praticable ;
  // `solidAt(x,z,y)` renvoie vrai si un solide gêne le corps à cette hauteur.
  // Deux cellules ne communiquent que si la marche entre elles reste <= `step`.
  FPassages.grid = function ({ bounds, cell = 0.8, heightAt, solidAt, radius = 0.38, height = 1.8, step = 0.42 } = {}) {
    if (!bounds || typeof heightAt !== 'function') throw new Error('FPassages.grid : bounds et heightAt sont requis');
    const nx = Math.max(1, Math.ceil((bounds.maxX - bounds.minX) / cell));
    const nz = Math.max(1, Math.ceil((bounds.maxZ - bounds.minZ) / cell));
    const free = new Uint8Array(nx * nz), levels = new Float64Array(nx * nz);
    for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
      const x = bounds.minX + (ix + 0.5) * cell, z = bounds.minZ + (iz + 0.5) * cell, i = iz * nx + ix;
      const y = heightAt(x, z);
      levels[i] = y === null || !Number.isFinite(y) ? NaN : y;
      if (Number.isFinite(levels[i]) && !(solidAt && solidAt(x, z, levels[i]))) free[i] = 1;
    }
    return { bounds: { ...bounds }, cell, nx, nz, free, levels, radius, height, step, index: (x, z) => Math.min(nz - 1, Math.max(0, Math.floor((z - bounds.minZ) / cell))) * nx + Math.min(nx - 1, Math.max(0, Math.floor((x - bounds.minX) / cell))) };
  };

  // Un solide de plus sur la grille : les cellules dont le centre est à moins de
  // `radius` du rectangle, et dont le corps (y .. y+height) recoupe le solide.
  function applyBlocker(grid, box) {
    const { minX, maxX, minZ, maxZ } = box, r = grid.radius, h = grid.height;
    const ix0 = Math.max(0, Math.floor((minX - r - grid.bounds.minX) / grid.cell));
    const ix1 = Math.min(grid.nx - 1, Math.ceil((maxX + r - grid.bounds.minX) / grid.cell));
    const iz0 = Math.max(0, Math.floor((minZ - r - grid.bounds.minZ) / grid.cell));
    const iz1 = Math.min(grid.nz - 1, Math.ceil((maxZ + r - grid.bounds.minZ) / grid.cell));
    const touched = [];
    for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) {
      const i = iz * grid.nx + ix;
      if (!grid.free[i]) continue;
      const y = grid.levels[i];
      if (box.maxY <= y + 0.05 || box.minY >= y + h - 0.05) continue;
      const x = grid.bounds.minX + (ix + 0.5) * grid.cell, z = grid.bounds.minZ + (iz + 0.5) * grid.cell;
      const dx = Math.max(minX - x, 0, x - maxX), dz = Math.max(minZ - z, 0, z - maxZ);
      if (dx * dx + dz * dz <= r * r) { touched.push(i); grid.free[i] = 0; }
    }
    return touched;
  }

  // Inonde depuis `sources` (indices de cellule) et rend un masque de visite.
  // `blockers` est une liste optionnelle de rectangles ajoutés le temps du test ;
  // ils sont retirés avant le retour, la grille reste réutilisable. `region`
  // borne le déplacement à un rectangle (un couloir, par exemple) : on teste
  // ainsi si un bloc barre le passage *dans ce passage*, sans faire le tour.
  FPassages.flood = function (grid, sources, blockers = [], region = null) {
    const seen = new Uint8Array(grid.nx * grid.nz), queue = new Int32Array(grid.nx * grid.nz);
    const touched = [];
    const inRegion = region ? (ix, iz) => {
      const x = grid.bounds.minX + (ix + 0.5) * grid.cell, z = grid.bounds.minZ + (iz + 0.5) * grid.cell;
      return x >= region.minX && x <= region.maxX && z >= region.minZ && z <= region.maxZ;
    } : null;
    for (const box of blockers) touched.push(...applyBlocker(grid, box));
    let head = 0, tail = 0;
    for (const i of sources) if (i >= 0 && i < seen.length && grid.free[i] && !seen[i] && (!inRegion || inRegion(i % grid.nx, Math.floor(i / grid.nx)))) { seen[i] = 1; queue[tail++] = i; }
    while (head < tail) {
      const i = queue[head++], x = i % grid.nx, y = grid.levels[i];
      const neighbours = [x ? i - 1 : -1, x < grid.nx - 1 ? i + 1 : -1, i - grid.nx, i + grid.nx];
      for (const j of neighbours) {
        if (j < 0 || j >= seen.length || !grid.free[j] || seen[j]) continue;
        if (Math.abs(grid.levels[j] - y) > grid.step) continue;
        const jx = j % grid.nx;
        if (inRegion && !inRegion(jx, Math.floor(j / grid.nx))) continue;
        seen[j] = 1; queue[tail++] = j;
      }
    }
    for (const i of touched) grid.free[i] = 1;
    return seen;
  };

  // Vrai si la cible est atteignable depuis au moins une source.
  FPassages.reaches = function (grid, sources, target, blockers = [], region = null) {
    const seen = FPassages.flood(grid, Array.isArray(sources) ? sources : [grid.index(sources.x, sources.z)], blockers, region);
    return seen[grid.index(target.x, target.z)] === 1;
  };

  // Le bloc barre-t-il le chemin ? atteignable sans lui, injoignable avec lui.
  FPassages.cuts = function (grid, source, target, box) {
    const from = [grid.index(source.x, source.z)], sources = grid.free[from[0]] ? from : FPassages.nearestFree(grid, source);
    if (!sources.length || !FPassages.reaches(grid, sources, target)) return false;
    return !FPassages.reaches(grid, sources, target, [box]);
  };

  // Cellule libre la plus proche d'un point (pour poser une source mal placée).
  FPassages.nearestFree = function (grid, point, radius = 3) {
    const reach = Math.max(1, Math.ceil(radius / grid.cell)), cx = Math.floor((point.x - grid.bounds.minX) / grid.cell), cz = Math.floor((point.z - grid.bounds.minZ) / grid.cell);
    let best = -1, bestD = Infinity;
    for (let dz = -reach; dz <= reach; dz++) for (let dx = -reach; dx <= reach; dx++) {
      const ix = cx + dx, iz = cz + dz;
      if (ix < 0 || iz < 0 || ix >= grid.nx || iz >= grid.nz) continue;
      const i = iz * grid.nx + ix;
      if (!grid.free[i]) continue;
      const d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = i; }
    }
    return best < 0 ? [] : [best];
  };

  // Liens obligatoires d'un graphe : ceux dont le retrait déconnecte l'une des
  // cibles du point de départ. `links` = [{from,to}] sur des entiers de 0 à nodes-1.
  function connected(links, start, targets, skip) {
    const nodes = new Set([start]);
    let grew = true;
    while (grew) {
      grew = false;
      for (let k = 0; k < links.length; k++) {
        if (k === skip) continue;
        const { from, to } = links[k];
        const a = nodes.has(from), b = nodes.has(to);
        if (a && !b) { nodes.add(to); grew = true; } else if (b && !a) { nodes.add(from); grew = true; }
      }
    }
    return targets.every(t => nodes.has(t));
  }
  FPassages.mandatoryLinks = function ({ links = [], start = 0, objectives = [] } = {}) {
    const targets = objectives.filter(t => t !== start);
    if (!targets.length || !connected(links, start, targets, -1)) return [];
    const forced = [];
    for (let k = 0; k < links.length; k++) if (!connected(links, start, targets, k)) forced.push(k);
    return forced;
  };

  // Liens traversés par une tournée gloutonne : départ, puis la cible la plus
  // proche en longueur de liens, jusqu'à les avoir toutes vues. Rend l'ensemble
  // des liens empruntés, pour ne poser un piège que là où le joueur passe.
  if (!FMath) throw new Error('FPassages: charger src/fmath.js avant src/passages.js');
  FPassages.tourLinks = function ({ links = [], start = 0, objectives = [], length = link => FMath.hypot2((link.x2 ?? 0) - (link.x1 ?? 0), (link.z2 ?? 0) - (link.z1 ?? 0)) } = {}) {
    const adjacency = new Map();
    for (let k = 0; k < links.length; k++) {
      const { from, to } = links[k], w = Math.max(0.001, length(links[k]));
      if (!adjacency.has(from)) adjacency.set(from, []);
      if (!adjacency.has(to)) adjacency.set(to, []);
      adjacency.get(from).push({ node: to, link: k, w });
      adjacency.get(to).push({ node: from, link: k, w });
    }
    const path = (from, to) => {
      if (from === to) return { nodes: [from], links: [] };
      const dist = new Map([[from, 0]]), prev = new Map();
      const todo = [{ node: from, d: 0 }];
      while (todo.length) {
        todo.sort((a, b) => a.d - b.d || a.node - b.node);
        const { node, d } = todo.shift();
        if (d > (dist.get(node) ?? Infinity)) continue;
        for (const e of adjacency.get(node) || []) {
          const nd = d + e.w;
          if (nd < (dist.get(e.node) ?? Infinity)) { dist.set(e.node, nd); prev.set(e.node, { node, link: e.link }); todo.push({ node: e.node, d: nd }); }
        }
      }
      if (!dist.has(to)) return null;
      const nodes = [], used = [];
      for (let at = to; at !== undefined;) {
        nodes.unshift(at);
        const p = prev.get(at);
        if (!p) break;
        used.unshift(p.link); at = p.node;
      }
      return { nodes, links: used };
    };
    const used = new Set();
    let at = start, remaining = objectives.filter((t, i, a) => t !== start && a.indexOf(t) === i).sort((a, b) => a - b);
    while (remaining.length) {
      let pick = null, pickPath = null;
      for (const target of remaining) {
        const found = path(at, target);
        if (!found) continue;
        const cost = found.links.reduce((n, k) => n + Math.max(0.001, length(links[k])), 0);
        if (!pickPath || cost < pickPath.cost || (cost === pickPath.cost && target < pick)) { pick = target; pickPath = { ...found, cost }; }
      }
      if (!pickPath) break;
      for (const k of pickPath.links) used.add(k);
      at = pick;
      remaining = remaining.filter(t => t !== pick);
    }
    return [...used].sort((a, b) => a - b);
  };

  (typeof window!=='undefined'?window:globalThis).FPassages = FPassages;
}());

/* METAL — original procedural tactical network, not a trained/imported model.
 * WebNN API: https://www.w3.org/TR/2026/CRD-webnn-20261021/
 * Accelerated is reported by the API; the exact GPU/NPU is deliberately hidden.
 */
(function(G){
  'use strict';
  const INPUTS=16,HIDDEN=20,OUTPUTS=8,BATCH=16,VERSION=1;
  const ACTIONS=['advance','flank','retreat','hold','slam','ring','rocketZone','sweep'];
  // Inputs contain only an actor's own state, visible allies and last observation:
  // distance, proximity, injury, sight, memory, crowd, observed speed/height,
  // assault/flanker/suppressor role, readiness, phase, giant, pain, variation.
  const w1=new Float32Array(INPUTS*HIDDEN),b1=new Float32Array(HIDDEN),w2=new Float32Array(HIDDEN*OUTPUTS);
  for(let i=0;i<INPUTS;i++)w1[i*HIDDEN+i]=1;
  for(const [h,b,terms] of [[16,-.65,[[1,1],[14,.8]]],[17,-.65,[[5,1],[7,.7]]],[18,-.8,[[6,1],[0,.7]]],[19,-.6,[[2,1],[3,.5]]]]){b1[h]=b;for(const [i,w] of terms)w1[i*HIDDEN+h]=w;}
  const b2=new Float32Array([.25,.15,-.7,.15,.1,.15,.2,.1]);
  const weights=[
    [[0,2.5],[1,-1.2],[2,-.8],[3,.3],[4,.2],[5,-.7],[7,-.3],[8,.7],[14,-.4]],
    [[0,.85],[1,-.35],[2,-.2],[3,.4],[5,1.25],[6,.5],[7,.75],[9,1.1],[17,.6]],
    [[0,-.6],[1,2.5],[2,1.25],[5,.8],[10,.5],[14,.9],[16,.6],[19,.6]],
    [[0,-.55],[1,-.8],[3,.8],[5,-.65],[7,-.2],[10,1.35],[11,.5]],
    [[0,-1],[1,3],[3,.2],[6,-.8]],
    [[0,1.5],[1,-.5],[6,.9],[12,.8],[15,.25],[18,.3]],
    [[0,2.2],[6,-.7],[7,.7],[12,.6]],
    [[0,.8],[6,1.3],[12,.6],[15,.3],[18,.6]]
  ];
  weights.forEach((terms,o)=>{for(const [h,w] of terms)w2[h*OUTPUTS+o]=w;});
  const clamp=v=>Math.max(0,Math.min(1,v));
  function packed(rows){
    if(!Array.isArray(rows)||rows.length<1||rows.length>BATCH)throw new RangeError('Invalid tactical batch');
    const input=new Float32Array(BATCH*INPUTS);
    for(let n=0;n<rows.length;n++){const row=rows[n];if(!row||row.length!==INPUTS)throw new RangeError('Invalid tactical features');for(let i=0;i<INPUTS;i++){if(!Number.isFinite(row[i]))throw new TypeError('Non-finite tactical feature');input[n*INPUTS+i]=clamp(row[i]);}}
    return input;
  }
  function infer(input,count){
    const result=new Float32Array(count*OUTPUTS),hidden=new Float32Array(HIDDEN);
    for(let n=0;n<count;n++){
      for(let h=0;h<HIDDEN;h++){let v=0;for(let i=0;i<INPUTS;i++)v+=input[n*INPUTS+i]*w1[i*HIDDEN+h];hidden[h]=Math.max(0,Math.fround(Math.fround(v)+b1[h]));}
      for(let o=0;o<OUTPUTS;o++){let v=0;for(let h=0;h<HIDDEN;h++)v+=hidden[h]*w2[h*OUTPUTS+o];result[n*OUTPUTS+o]=Math.fround(Math.fround(v)+b2[o]);}
    }
    return result;
  }
  const cpu=rows=>infer(packed(rows),rows.length);
  function create(options={}){
    let mode=options.mode==='cpu'?'cpu':'auto',generation=0,disposed=false,resource=null,candidate=null,preparing=null,busy=null;
    let backend='cpu',reason=mode==='cpu'?'selected':'not-prepared';
    const metrics={batches:0,actors:0,acceleratedBatches:0,cpuBatches:0,failures:0};
    const status=()=>({mode,backend,accelerated:backend==='webnn',reason,generation,
      label:backend==='preparing'?'Préparation de l’IA accélérée…':backend==='webnn'?'WebNN accéléré · type GPU/NPU non exposé':reason==='selected'?'CPU · compatibilité':reason==='unavailable'?'CPU · WebNN indisponible':reason==='unverified'?'CPU · accélérateur non confirmé':reason==='disposed'?'CPU · arrêté':reason==='not-prepared'?'CPU · en attente de préparation':'CPU · repli de compatibilité'});
    function destroy(q){if(!q)return;q.destroyed=true;for(const key of ['input','output','graph','context']){try{q[key]?.destroy?.();}catch(_){/* An already-lost device may reject destruction. */}q[key]=null;}}
    function release(){destroy(resource);destroy(candidate);resource=candidate=null;busy=null;}
    function fallback(why,ticket){if(ticket!==generation||disposed)return;metrics.failures++;generation++;release();backend='cpu';reason=why;}
    function deadline(promise,ms){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('timeout')),ms);})]).finally(()=>clearTimeout(timer));}
    function valid(q,ticket){if(disposed||ticket!==generation||q.destroyed)throw new Error('superseded');}
    async function run(q,input){
      q.context.writeTensor(q.input,input);q.context.dispatch(q.graph,{features:q.input},{scores:q.output});
      const raw=await q.context.readTensor(q.output),values=new Float32Array(raw);
      if(values.length!==BATCH*OUTPUTS||!values.every(v=>Number.isFinite(v)&&Math.abs(v)<100))throw new Error('invalid-output');
      return values;
    }
    async function build(ticket){
      const q={context:null,graph:null,input:null,output:null,destroyed:false};candidate=q;
      try{
        q.context=await G.navigator.ml.createContext({powerPreference:'low-power',accelerated:true});valid(q,ticket);
        // Never mistake an ignored legacy deviceType hint for proof of an NPU.
        if(q.context.accelerated!==true)throw new Error('unverified');
        const c=q.context;if(!['createTensor','writeTensor','dispatch','readTensor'].every(k=>typeof c[k]==='function'))throw new Error('unsupported-api');
        if(c.lost&&typeof c.lost.then==='function')c.lost.then(()=>fallback('context-lost',ticket),()=>fallback('context-lost',ticket));
        const builder=new G.MLGraphBuilder(c),constant=(shape,value)=>builder.constant({dataType:'float32',shape},value);
        const input=builder.input('features',{dataType:'float32',shape:[BATCH,INPUTS]});
        const hidden=builder.relu(builder.add(builder.matmul(input,constant([INPUTS,HIDDEN],w1)),constant([HIDDEN],b1)));
        const output=builder.add(builder.matmul(hidden,constant([HIDDEN,OUTPUTS],w2)),constant([OUTPUTS],b2));
        q.graph=await builder.build({scores:output});valid(q,ticket);
        q.input=await c.createTensor({dataType:'float32',shape:[BATCH,INPUTS],writable:true});valid(q,ticket);
        q.output=await c.createTensor({dataType:'float32',shape:[BATCH,OUTPUTS],readable:true});valid(q,ticket);
        // A tiny real dispatch verifies arithmetic before gameplay trusts this path.
        const probe=new Float32Array(BATCH*INPUTS);for(let i=0;i<probe.length;i++)probe[i]=((i*13+5)%31)/30;
        const actual=await run(q,probe),expected=infer(probe,BATCH);valid(q,ticket);
        if(actual.some((v,i)=>Math.abs(v-expected[i])>1e-4))throw new Error('numeric-mismatch');
        return q;
      }catch(error){destroy(q);throw error;}
    }
    function prepare(){
      if(disposed||mode==='cpu'||resource)return Promise.resolve(status());
      if(preparing)return preparing;
      if(!G.navigator?.ml?.createContext||typeof G.MLGraphBuilder!=='function'){backend='cpu';reason='unavailable';return Promise.resolve(status());}
      const ticket=++generation;backend='preparing';reason='initializing';
      const job=deadline(build(ticket),2500).then(q=>{
        if(disposed||ticket!==generation){destroy(q);return status();}
        candidate=null;resource=q;backend='webnn';reason='accelerated-reported';return status();
      }).catch(error=>{fallback(error?.message==='unverified'?'unverified':error?.message==='timeout'?'prepare-timeout':'prepare-failed',ticket);return status();}).finally(()=>{if(preparing===job)preparing=null;});
      preparing=job;return job;
    }
    function evaluate(rows){
      const input=packed(rows),count=rows.length,ticket=generation;
      metrics.batches++;metrics.actors+=count;
      const local=()=>{metrics.cpuBatches++;return {scores:infer(input,count),count,backend:'cpu',generation};};
      if(disposed||!resource||backend!=='webnn'||busy)return local();
      const q=resource,request={ticket};busy=request;
      return deadline(run(q,input),120).then(values=>{
        if(disposed||generation!==ticket||q!==resource)return local();
        metrics.acceleratedBatches++;return {scores:values.slice(0,count*OUTPUTS),count,backend:'webnn',generation:ticket};
      }).catch(error=>{fallback(error?.message==='timeout'?'inference-timeout':'inference-failed',ticket);return local();}).finally(()=>{if(busy===request)busy=null;});
    }
    function setMode(next){
      if(next!=='auto'&&next!=='cpu')return Promise.resolve(status());
      if(disposed)return Promise.resolve(status());
      if(next===mode&&(resource||preparing||mode==='cpu'))return prepare();
      generation++;release();preparing=null;mode=next;backend='cpu';reason=mode==='cpu'?'selected':'not-prepared';return prepare();
    }
    function dispose(){if(disposed)return;disposed=true;generation++;release();preparing=null;backend='cpu';reason='disposed';}
    return {prepare,setMode,evaluate,dispose,get status(){return status();},get metrics(){return {...metrics};}};
  }
  G.FBrain={create,cpu,version:VERSION,inputs:INPUTS,outputs:OUTPUTS,batchSize:BATCH,actions:ACTIONS.slice()};
})(typeof window!=='undefined'?window:globalThis);

/* FERRO — fixed-step loop: accumulator, display-period lock, bounded catch-up, render interpolation. Reads no clock. */
(function(G){
  'use strict';
  const TAU=Math.PI*2;
  function create(o={}){
    const hz=o.hz??60,maxSteps=o.maxSteps??5;
    if(!Number.isFinite(hz)||hz<1||hz>1000)throw new TypeError('FLoop: hz must be in [1, 1000]');
    if(!Number.isInteger(maxSteps)||maxSteps<1||maxSteps>60)throw new TypeError('FLoop: maxSteps must be an integer in [1, 60]');
    const maxFrameMs=o.maxFrameMs??250,N=o.samples??30,minSamples=o.minSamples??8,snap=o.snap??.2,sampleTol=o.sampleTol??.3,
      lockTol=o.lock??.01,unlockTol=o.unlock??.02,debtRate=o.debtRate??.1,debtCap=o.debtCap??2,fill=o.fill??.999;
    const H=1000/hz,h=1/hz,ring=new Float64Array(N);
    let count=0,at=0,misses=0,last=NaN,acc=fill*H,debt=0,locked=false,period=0;
    const frame={steps:0,alpha:fill,raw:0,dt:0,dropped:0,locked:false,period:0};
    const stats={frames:0,steps:0,zeroStepFrames:0,multiStepFrames:0,realMs:0,droppedMs:0,clampedMs:0,abortedMs:0,dilationMs:0,maxDebtMs:0,lockChanges:0};
    // Display period: mean of the last N intervals, each divided by its whole number of periods.
    function sample(raw){
      const k=Math.max(1,Math.round(raw/(count?period:raw))),v=raw/k;
      if(count>=minSamples&&Math.abs(v-period)>sampleTol*period){if(++misses<minSamples)return;count=at=0;}
      misses=0;ring[at]=v;at=(at+1)%N;if(count<N)count++;
      let s=0;for(let i=0;i<count;i++)s+=ring[i];period=s/count;
    }
    // Phase reset: the accumulator restarts just below one step; the jump is booked as dilation.
    function rebase(){stats.dilationMs+=fill*H-acc-debt;acc=fill*H;debt=0;}
    function lock(){
      const m=Math.max(1,Math.round(period/H)),dev=Math.abs(period-m*H)/(m*H);
      const want=count>=minSamples&&dev<=(locked?unlockTol:lockTol);
      if(want===locked)return;
      locked=want;stats.lockChanges++;if(locked)rebase();
    }
    function clear(){frame.steps=0;frame.raw=0;frame.dt=0;frame.dropped=0;}
    function finish(){frame.alpha=Math.max(0,Math.min(1,acc/H));frame.locked=locked;frame.period=period;return frame;}
    function run(n,step){
      let done=step?0:n;
      try{if(step)while(done<n){done++;if(step(h,done-1)===false)break;}}
      finally{
        if(done<n)stats.abortedMs+=(n-done)*H;
        frame.steps=done;stats.steps+=done;stats.frames++;
        if(!done)stats.zeroStepFrames++;else if(done>1)stats.multiStepFrames++;
        finish();
      }
      return frame;
    }
    function advance(now,step){
      if(step!=null&&typeof step!=='function')throw new TypeError('FLoop.advance: step must be a function');
      clear();
      if(!Number.isFinite(now))return finish();
      if(!Number.isFinite(last)){last=now;stats.dilationMs+=H;frame.dt=H;return run(1,step);}
      let raw=now-last;
      if(raw<0){last=now;return finish();}
      last=now;
      if(raw>maxFrameMs){stats.clampedMs+=raw-maxFrameMs;raw=maxFrameMs;}else if(raw>0)sample(raw);
      frame.raw=raw;stats.realMs+=raw;lock();
      let n=0;
      if(locked){
        n=Math.round(raw/H);stats.dilationMs+=n*H-raw;frame.dt=n*H;
        if(n>maxSteps){frame.dropped=(n-maxSteps)*H;n=maxSteps;}
      }else{
        let dt=raw;
        if(count>=minSamples){const k=Math.max(1,Math.round(raw/period));if(Math.abs(raw-k*period)<snap*period){dt=k*period;debt+=raw-dt;}}
        let fix=Math.max(-debtCap,Math.min(debtCap,debt))*debtRate;
        if(debt-fix>H)fix=debt-H;else if(debt-fix<-H)fix=debt+H;
        dt+=fix;debt-=fix;frame.dt=dt;acc+=dt;
        while(acc>=H*(1-1e-9)&&n<maxSteps){acc-=H;n++;}
        if(n===maxSteps&&acc>=H*(1-1e-9)){frame.dropped=acc-fill*H;acc=fill*H;}
      }
      stats.droppedMs+=frame.dropped;if(Math.abs(debt)>stats.maxDebtMs)stats.maxDebtMs=Math.abs(debt);
      return run(n,step);
    }
    function abort(done){
      if(!Number.isInteger(done)||done<0||done>frame.steps)throw new TypeError('FLoop.abort: done must be an integer in [0, frame.steps]');
      const cut=frame.steps-done;
      if(cut){stats.abortedMs+=cut*H;stats.steps-=cut;if(frame.steps>1&&done<2)stats.multiStepFrames--;if(!done)stats.zeroStepFrames++;frame.steps=done;}
      return frame;
    }
    function observe(now){
      clear();
      if(Number.isFinite(now)){if(now>last&&now-last<=maxFrameMs)sample(now-last);last=now;lock();}
      return finish();
    }
    function reset(){clear();rebase();last=NaN;return finish();}
    function resetPeriod(){clear();count=at=misses=0;period=0;if(locked){locked=false;stats.lockChanges++;}return finish();}
    return {advance,observe,abort,reset,resetPeriod,frame,stats,hz,step:h,stepMs:H,
      get period(){return period;},get locked(){return locked;},get acc(){return acc;},get debt(){return debt;}};
  }
  // View angles shown this frame: simulation angles plus look not yet consumed, same operations as the step.
  function aim(yaw,pitch,lookX,lookY,min=-Infinity,max=Infinity,out={}){
    out.yaw=yaw+(Number.isFinite(lookX)?lookX:0);
    out.pitch=Math.max(min,Math.min(max,pitch+(Number.isFinite(lookY)?lookY:0)));
    return out;
  }
  // Previous poses for render interpolation; one tracker per entity kind (ids are per kind).
  function track(o={}){
    const snap=o.snap??2,map=new Map();let gen=0;
    const wrap=d=>d-TAU*Math.round(d/TAU);
    return {
      begin(){gen++;},
      save(id,x,y,z,a=0){let e=map.get(id);if(!e)map.set(id,e=new Float64Array(5));e[0]=x;e[1]=y;e[2]=z;e[3]=a;e[4]=gen;},
      pose(id,x,y,z,a=0,alpha=1,out={}){
        const e=map.get(id);
        if(e){const dx=x-e[0],dy=y-e[1],dz=z-e[2];if(dx*dx+dy*dy+dz*dz<=snap*snap){out.x=e[0]+dx*alpha;out.y=e[1]+dy*alpha;out.z=e[2]+dz*alpha;out.a=e[3]+wrap(a-e[3])*alpha;return out;}}
        out.x=x;out.y=y;out.z=z;out.a=a;return out;
      },
      prune(){for(const [id,e] of map)if(e[4]!==gen)map.delete(id);},
      clear(){map.clear();},
      get size(){return map.size;}
    };
  }
  // Reusable render mirrors. Histories are keyed by object identity, so newly
  // spawned/replaced bodies never inherit another body's previous position.
  function view({single=[],many=[]}={}){
    let previous=new WeakMap(),mirrors=new WeakMap();const result={},lists=Object.fromEntries(many.map(key=>[key,[]]));
    function save(e){let q=previous.get(e);if(!q)previous.set(e,q=new Float64Array(5));q[0]=e.x;q[1]=e.y||0;q[2]=e.z;q[3]=e.yaw||0;q[4]=e.baseY||0;}
    function body(e,alpha,angles){let q=mirrors.get(e);if(!q)mirrors.set(e,q={});Object.assign(q,e);const before=previous.get(e);if(!before)return q;
      const dx=e.x-before[0],dy=(e.y||0)-before[1],dz=e.z-before[2];if(dx*dx+dy*dy+dz*dz>4)return q;
      q.x=before[0]+dx*alpha;q.y=before[1]+dy*alpha;q.z=before[2]+dz*alpha;
      if(e.baseY!==undefined)q.baseY=before[4]+(e.baseY-before[4])*alpha;
      if(angles&&e.yaw!==undefined){const delta=e.yaw-before[3];q.yaw=before[3]+(delta-TAU*Math.round(delta/TAU))*alpha;}return q;
    }
    return {capture(state){for(const key of single)save(state[key]);for(const key of Object.keys(lists))for(const e of state[key]||[])save(e);},
      render(state,alpha=1){alpha=Math.max(0,Math.min(1,alpha));Object.assign(result,state);for(const key of single)result[key]=body(state[key],alpha,false);
        for(const [key,list] of Object.entries(lists)){const source=state[key]||[];list.length=source.length;for(let i=0;i<source.length;i++)list[i]=body(source[i],alpha,true);result[key]=list;}return result;},
      clear(){previous=new WeakMap();mirrors=new WeakMap();for(const list of Object.values(lists))list.length=0;}};
  }
  G.FLoop={create,aim,track,view};
})(typeof window!=='undefined'?window:globalThis);

/* FERRO — task scheduler: 'frame' lane on a per-frame time budget, 'sim' lane in deterministic work units. Reads no clock of its own. */
(function(G){
  'use strict';
  function create(o={}){
    const now=o.now,aging=o.agingFrames??30;
    if(now!==undefined&&typeof now!=='function')throw new TypeError('FSchedule: now must be a function');
    if(!Number.isInteger(aging)||aging<1)throw new TypeError('FSchedule: agingFrames must be a positive integer');
    const frameQ=[],simQ=[],stats={ran:0,skipped:0,flushes:0,overrunMs:0,maxSliceMs:0,simUnits:0,errors:0};
    let seq=0,pumps=0;
    const queue=t=>t.lane==='sim'?simQ:frameQ,eff=t=>t.priority-Math.floor(t.age/aging);
    function drop(t){const q=queue(t),i=q.indexOf(t);if(i>=0)q.splice(i,1);t.removed=true;}
    function find(key){return frameQ.find(t=>t.key===key)||simQ.find(t=>t.key===key);}
    function call(t,arg){try{return t.run(arg,t);}catch(e){drop(t);stats.errors++;throw e;}}
    // Sim tasks report the integer units they used; anything else is a bug in the task.
    function units(t,left){
      const used=call(t,left);t.runs++;
      if(!Number.isInteger(used)||used<0||used>left){drop(t);stats.errors++;throw new TypeError('FSchedule: a sim task must return an integer in [0, units]');}
      stats.simUnits+=used;if(t.done)drop(t);return used;
    }
    function add(task){
      if(!task||typeof task.run!=='function')throw new TypeError('FSchedule.add: run must be a function');
      const lane=task.lane??'frame';if(lane!=='frame'&&lane!=='sim')throw new TypeError("FSchedule.add: lane must be 'frame' or 'sim'");
      const q=lane==='sim'?simQ:frameQ;
      if(task.key!==undefined)for(const t of q.slice())if(t.key===task.key)drop(t);
      const t={lane,key:task.key,priority:Number.isFinite(task.priority)?task.priority:5,cost:Number.isFinite(task.cost)&&task.cost>=0?task.cost:1,
        run:task.run,seq:seq++,age:0,runs:0,spentMs:0,done:false,removed:false,lastPump:0};
      q.push(t);return t;
    }
    function cancel(key){let hit=false;for(const t of [...frameQ,...simQ])if(t.key===key){drop(t);hit=true;}return hit;}
    function pump(budget){
      if(!now)throw new TypeError('FSchedule.pump: create({now}) is required');
      if(!(budget>0)||!frameQ.length)return 0;
      const id=++pumps,list=frameQ.slice().sort((a,b)=>eff(a)-eff(b)||a.seq-b.seq),start=now();
      let used=0,ran=0;
      for(const t of list){
        if(t.removed)continue;
        const left=budget-used;if(left<=0)break;
        if(ran&&t.cost>left){stats.skipped++;continue;}
        const t0=now(),r=call(t,t0+left),d=now()-t0;
        t.cost=t.cost*.5+d*.5;t.runs++;t.spentMs+=d;t.age=0;t.lastPump=id;ran++;stats.ran++;if(d>stats.maxSliceMs)stats.maxSliceMs=d;
        if(r!==false){t.done=true;drop(t);}
        used=now()-start;
      }
      for(const t of list)if(!t.removed&&t.lastPump!==id)t.age++;
      if(used>budget)stats.overrunMs+=used-budget;
      return used;
    }
    function pumpSim(n){
      if(!Number.isInteger(n)||n<0)throw new TypeError('FSchedule.pumpSim: units must be a non-negative integer');
      let left=n;
      for(const t of simQ.slice().sort((a,b)=>a.priority-b.priority||a.seq-b.seq)){
        if(!left)break;if(t.removed)continue;
        left-=units(t,left);
      }
      return n-left;
    }
    function flush(key){
      const t=find(key);if(!t)return false;stats.flushes++;
      for(let i=0;i<1e6;i++){
        if(t.lane==='sim'){units(t,Number.MAX_SAFE_INTEGER);if(t.done)return true;}
        else{const r=call(t,Infinity);t.runs++;if(r!==false){t.done=true;drop(t);return true;}}
      }
      throw new Error('FSchedule.flush: task never finished');
    }
    return {add,cancel,has:key=>!!find(key),pump,pumpSim,flush,stats,
      count:lane=>lane==='frame'?frameQ.length:lane==='sim'?simQ.length:frameQ.length+simQ.length};
  }
  // Frame-lane budget: what is left of 85 % of the display period, at most cap ms, never negative.
  function budget(period,work,cap=4){
    const P=Number.isFinite(period)&&period>0?period:1000/60;
    return Number.isFinite(work)?Math.max(0,Math.min(cap,.85*P-work)):0;
  }
  G.FSchedule={create,budget};
})(typeof window!=='undefined'?window:globalThis);

/* FERRO — optional background jobs, chunked values and a complete in-page fallback. */
(function(G){'use strict';
  const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  function transfers(value,out=[],seen=new Set()){
    if(!value||typeof value!=='object'||seen.has(value))return out;seen.add(value);
    if(ArrayBuffer.isView(value)){if(!seen.has(value.buffer)){seen.add(value.buffer);out.push(value.buffer);}return out;}
    if(value instanceof ArrayBuffer){out.push(value);return out;}
    for(const v of Object.values(value))transfers(v,out,seen);return out;
  }
  function stream(id,value,send,size=2000){
    if(!Number.isInteger(size)||size<1||size>2000)throw new RangeError('Chunk size must be in [1, 2000]');
    const object=value&&typeof value==='object'&&!Array.isArray(value)&&!ArrayBuffer.isView(value)&&!(value instanceof ArrayBuffer),arrays=[];
    let head=value;if(object){head={};for(const [key,v] of Object.entries(value)){if(key==='__proto__')throw new Error('Unsupported key');if(Array.isArray(v)){head[key]=[];arrays.push([key,v]);}else head[key]=v;}}
    send({t:'head',id,value:head},transfers(head));
    for(const [key,list] of arrays)for(let at=0;at<list.length;at+=size){const part=list.slice(at,at+size);send({t:'part',id,key,at,value:part},transfers(part));}
    send({t:'done',id});
  }
  function serve(handlers,endpoint=G){
    const send=(value,transfer)=>endpoint.postMessage(value,transfer||[]);
    endpoint.onmessage=async event=>{const q=event.data;if(!q||typeof q!=='object')return;
      if(q.t==='ping'){send({t:'pong'});return;}
      if(q.t!=='job'||!Number.isSafeInteger(q.id)||!own(handlers,q.name))return;
      try{stream(q.id,await handlers[q.name](q.data),send);}catch(error){send({t:'error',id:q.id,message:String(error?.message||error)});}
    };
    send({t:'ready'});
  }
  function create({environment:Genv=G,handlers={},bootstrap='',selector='script[data-worker]',forceMain=false,name='ferro-jobs'}={}){
    const w=Genv,pending=new Map();let worker=null,url=null,timer=null,serial=0,mode='main',reason='unavailable',disposed=false,lastAck=0;
    const now=()=>w.performance?.now?.()??Date.now(),stats={requests:0,completed:0,fallbacks:0,chunks:0};
    function close(){if(timer!==null)w.clearInterval?.(timer);timer=null;try{worker?.terminate();}catch{}worker=null;if(url){w.URL.revokeObjectURL(url);url=null;}}
    function local(q){Promise.resolve().then(()=>handlers[q.name](q.data)).then(value=>{if(pending.delete(q.id)){stats.completed++;q.resolve(value);}},error=>{if(pending.delete(q.id))q.reject(error);});}
    function fallback(why){if(disposed)return;const previous=mode;mode='main';reason=why;close();if(previous!=='main'){stats.fallbacks++;for(const q of pending.values()){q.value=undefined;q.started=false;local(q);}}}
    function receive(event){const m=event.data;if(!m||typeof m!=='object'||disposed||mode==='main')return;lastAck=now();
      if(m.t==='ready'){if(mode!=='starting')return;mode='worker';reason='ready';if(url){w.URL.revokeObjectURL(url);url=null;}try{for(const q of pending.values())worker.postMessage({t:'job',id:q.id,name:q.name,data:q.data});}catch{fallback('post-error');}return;}
      if(m.t==='pong')return;const q=pending.get(m.id);if(!q)return;
      if(m.t==='head'){q.value=m.value;q.started=true;return;}
      if(m.t==='part'){
        if(!q.started||!q.value||!own(q.value,m.key)||!Array.isArray(q.value[m.key])||!Array.isArray(m.value)||m.value.length>2000||m.at!==q.value[m.key].length){fallback('invalid-stream');return;}
        const list=q.value[m.key];for(const item of m.value)list.push(item);stats.chunks++;return;
      }
      if(m.t==='done'){if(!q.started){fallback('invalid-stream');return;}pending.delete(m.id);stats.completed++;q.resolve(q.value);}
      else if(m.t==='error'){pending.delete(m.id);q.reject(new Error(m.message||'Background job failed'));}
    }
    try{
      const mobile=w.matchMedia?.('(pointer:coarse)')?.matches;
      if(!forceMain&&(!mobile||(w.navigator?.hardwareConcurrency||0)>=4)&&w.Worker&&w.Blob&&w.URL?.createObjectURL&&bootstrap){
        const nodes=w.document?.querySelectorAll?.(selector)||[],source=Array.from(nodes,n=>n.textContent).join('\n;\n');
        if(source){mode='starting';reason='starting';lastAck=now();url=w.URL.createObjectURL(new w.Blob(['self.window=self;\n',source,'\n;',bootstrap],{type:'text/javascript'}));worker=new w.Worker(url,{name});worker.onmessage=receive;worker.onerror=e=>{e.preventDefault?.();fallback('worker-error');};worker.onmessageerror=()=>fallback('message-error');
          timer=w.setInterval?.(()=>{if(w.document?.hidden){lastAck=now();return;}if(now()-lastAck>3000){fallback('timeout');return;}if(mode==='worker')worker.postMessage({t:'ping'});},1000)??null;
        }
      }else if(forceMain)reason='selected';else if(mobile)reason='mobile-capacity';
    }catch{fallback('startup-error');}
    function request(job,data){
      if(disposed)return Promise.reject(new Error('Background jobs disposed'));
      if(typeof job!=='string'||!own(handlers,job)||typeof handlers[job]!=='function')return Promise.reject(new Error('Unknown background job'));
      stats.requests++;return new Promise((resolve,reject)=>{const q={id:++serial,name:job,data,resolve,reject,value:undefined,started:false};pending.set(q.id,q);
        if(mode==='main')local(q);else if(mode==='worker')try{worker.postMessage({t:'job',id:q.id,name:job,data});}catch{fallback('post-error');}
      });
    }
    function dispose(){if(disposed)return;disposed=true;close();for(const q of pending.values())q.reject(new Error('Background jobs disposed'));pending.clear();}
    return {request,dispose,stats,get mode(){return mode;},get reason(){return reason;}};
  }
  G.FJobs={create,serve,stream};
})(typeof window!=='undefined'?window:globalThis);

/* FERRO — mode démo : outils déterministes, enregistrement et rejeu d'entrées, réalisateur, enchaînement de scènes. Sans DOM, horloge injectée pour l’accueil ; noyau de rejeu sans aléa global. */
(function(G){
  'use strict';
  const TAU=Math.PI*2,FNV=2166136261,PRIME=16777619,FORMAT=1,MAGIC='FDM1';
  const fail=(code,message,extra)=>{throw Object.assign(new Error('FDemo : '+message),{code},extra);};
  function utf8(text){
    const s=unescape(encodeURIComponent(text)),bytes=new Uint8Array(s.length);
    for(let i=0;i<s.length;i++)bytes[i]=s.charCodeAt(i);
    return bytes;
  }
  function fromUtf8(bytes){
    let s='';
    for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode.apply(null,bytes.subarray(i,i+8192));
    try{return decodeURIComponent(escape(s));}catch{return fail('FDEMO_FORMAT','texte encodé hors UTF-8');}
  }
  // États en tableaux typés : un nombre gardé dans une fermeture serait mis en boîte à chaque écriture.
  function rng(seed){
    const state=new Int32Array(1);state[0]=seed;
    function u32(){
      let a=state[0];
      a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;
      state[0]=a;return (t^(t>>>14))>>>0;
    }
    const next=()=>u32()/4294967296,weight=w=>Number.isFinite(w)&&w>0?w:0;
    function pick(weights,n=weights.length){
      let sum=0,cum=0,last=-1;
      for(let i=0;i<n;i++)sum+=weight(weights[i]);
      const r=next()*sum;
      if(!(sum>0))return -1;
      for(let i=0;i<n;i++){const w=weight(weights[i]);if(w>0){cum+=w;last=i;if(r<cum)return i;}}
      return last;
    }
    return {u32,next,pick,int:n=>n>=1?Math.floor(next()*n):0,range:(lo,hi)=>lo+(hi-lo)*next(),
      get state(){return state[0]>>>0;},set state(v){state[0]=v;}};
  }
  function hasher(seed=FNV){
    const state=new Uint32Array(1),view=new DataView(new ArrayBuffer(8));
    const byte=v=>{state[0]=Math.imul(state[0]^(v&255),PRIME);return api;};
    const word=v=>{let h=state[0];for(let k=0;k<32;k+=8)h=Math.imul(h^(v>>>k&255),PRIME);state[0]=h;return api;};
    function number(v){view.setFloat64(0,v,true);let h=state[0];for(let i=0;i<8;i++)h=Math.imul(h^view.getUint8(i),PRIME);state[0]=h;return api;}
    function text(s){
      word(s.length);let h=state[0];
      for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);h=Math.imul(Math.imul(h^(c&255),PRIME)^(c>>>8),PRIME);}
      state[0]=h;return api;
    }
    const api={byte,word,number,bool:v=>byte(v?1:0),text,result:()=>state[0],reset(s=FNV){state[0]=s;return api;}};
    state[0]=seed;
    return api;
  }
  const seedFor=(seed,a,b)=>hasher().word(seed).word(a).word(b).result();
  function smootherstep(t){
    if(!Number.isFinite(t))return 0;
    t=t<0?0:t>1?1:t;
    return t*t*t*(t*(t*6-15)+10);
  }
  function wrapAngle(a){
    if(!Number.isFinite(a))return 0;
    a%=TAU;
    return a<=-Math.PI?a+TAU:a>Math.PI?a-TAU:a;
  }
  function lookAt(from,to,out){
    const dx=to[0]-from[0],dy=to[1]-from[1],dz=to[2]-from[2],h=Math.hypot(dx,dz);
    if(h!==0||dy!==0){out.yaw=Math.atan2(dx,-dz);out.pitch=Math.atan2(dy,h);}
    return out;
  }
  const usable=key=>typeof key==='string'&&key!==''&&key!=='__proto__';
  const quantize=(v,scale,max)=>{
    if(!Number.isFinite(v))return 0;
    const q=Math.round(v*scale);
    return q<-max?-max:q>max?max:q;
  };
  function schema(fields){
    if(!Array.isArray(fields)||!fields.length)fail('FDEMO_ARG','schéma : tableau de champs non vide attendu');
    const ops=[],copy=[],names=[],seen=new Map();let size=0;
    const claim=(key,index)=>{
      if(seen.has(key))fail('FDEMO_ARG','schéma : propriété '+key+' en double',{field:key,index});
      seen.set(key,index);names.push(key);
    };
    for(let i=0;i<fields.length;i++){
      const f=fields[i];
      if(!f||typeof f!=='object'||Array.isArray(f))fail('FDEMO_ARG','schéma : champ '+i+' : objet attendu',{index:i});
      const {name,type,scale,names:list}=f;
      if(!usable(name))fail('FDEMO_ARG','schéma : champ '+i+' : name attendu, chaîne non vide',{index:i});
      const bad=why=>fail('FDEMO_ARG','schéma : '+name+' : '+why,{field:name,index:i});
      const kind=type==='i8'?1:type==='i16'?2:type==='u8'?3:type==='u16'?4:type==='bits'?5:0,max=kind===1?127:kind===2?32767:0;
      if(!kind)bad('type inconnu');
      if(max&&!(Number.isFinite(scale)&&scale>0&&Number.isFinite(max/scale)))bad('scale attendu, nombre fini > 0');
      if(!max&&scale!==undefined)bad('scale interdit pour '+type);
      if(kind!==5&&list!==undefined)bad('names réservé au type bits');
      const op={kind,name,at:size,scale:max?scale:0,bias:max+1,names:null,count:0,pages:max?new Array(max+1>>7).fill(null):null};
      if(kind===5){
        if(!Array.isArray(list)||list.length<1||list.length>32)bad('names attendu, de 1 à 32 chaînes');
        op.names=[];
        for(let k=0;k<list.length;k++){
          const key=list[k];
          if(!usable(key))bad('nom de bit '+k+' vide ou invalide');
          claim(key,i);op.names.push(key);
        }
        op.count=list.length;size+=list.length+7>>3;
        copy.push({name,type,names:op.names.slice()});
      }else{
        claim(name,i);size+=kind===2||kind===4?2:1;
        copy.push(max?{name,type,scale}:{name,type});
      }
      ops.push(op);
    }
    function encode(input,view,offset){
      for(let i=0;i<ops.length;i++){
        const o=ops[i],at=offset+o.at;
        if(o.kind===1)view.setInt8(at,quantize(input[o.name],o.scale,127));
        else if(o.kind===2)view.setInt16(at,quantize(input[o.name],o.scale,32767),true);
        else if(o.kind===3){const v=input[o.name];view.setUint8(at,Number.isInteger(v)&&v>=0&&v<=254?v:255);}
        else if(o.kind===4){const v=input[o.name];view.setUint16(at,Number.isInteger(v)&&v>=0&&v<=65534?v:65535,true);}
        else for(let b=0,k=0;k<o.count;b++){
          let bits=0;
          for(let j=0;j<8&&k<o.count;j++,k++)if(input[o.names[k]])bits|=1<<j;
          view.setUint8(at+b,bits);
        }
      }
    }
    // Nombres déjà en boîte, par pages de 256 créées au premier usage : decode n'alloue plus ensuite.
    function decode(view,offset,out){
      for(let i=0;i<ops.length;i++){
        const o=ops[i],at=offset+o.at;
        if(o.kind<3){
          const q=o.kind===1?view.getInt8(at):view.getInt16(at,true),u=q+o.bias;
          const page=o.pages[u>>8]||(o.pages[u>>8]=new Array(256).fill(null));
          let v=page[u&255];
          if(v===null)v=page[u&255]=q/o.scale;
          out[o.name]=v;
        }else if(o.kind===3){const v=view.getUint8(at);out[o.name]=v===255?undefined:v;}
        else if(o.kind===4){const v=view.getUint16(at,true);out[o.name]=v===65535?undefined:v;}
        else for(let k=0;k<o.count;k++)out[o.names[k]]=(view.getUint8(at+(k>>3))>>(k&7)&1)===1;
      }
      return out;
    }
    return {fields:copy,size,names,encode,decode};
  }
  const NONE=Object.freeze([]);
  const text=(v,what)=>{try{return JSON.stringify(v);}catch{return fail('FDEMO_ARG',what+' : valeur hors JSON');}},json=(v,what)=>text(v,what)??'null';
  function ticker(perSecond){
    const pages=new Array(256).fill(null);
    return t=>{const page=pages[t>>8]||(pages[t>>8]=new Array(256).fill(null));return page[t&255]??(page[t&255]=t/perSecond);};
  }
  function settings(h,code,fill){
    if(!h||typeof h!=='object'||Array.isArray(h))fail(code,'en-tête : objet attendu');
    const s={gameVersion:'',engine:'',hz:60,dtTicks:0,checksumEvery:600},str=v=>typeof v==='string';
    for(const k of ['game','gameVersion','simHash','engine','hz','dtTicks','checksumEvery'])if(!fill||h[k]!==undefined)s[k]=h[k];
    const {game,simHash,hz,dtTicks:t,checksumEvery:c}=s,ok={game:str(game)&&game!=='',gameVersion:str(s.gameVersion),simHash:str(simHash)&&simHash!=='',
      engine:str(s.engine),hz:Number.isFinite(hz)&&hz>0&&1/hz<Infinity,dtTicks:Number.isInteger(t)&&t>=0&&t<=1e6,checksumEvery:Number.isSafeInteger(c)&&c>0};
    for(const k in ok)if(!ok[k])fail(code,'en-tête : '+k+' invalide',{field:k});
    try{s.sc=schema(h.fields);}catch(e){if(e&&e.code==='FDEMO_ARG')e.code=code;throw e;}
    return s;
  }
  function recorder(header,options={}){
    const {game,gameVersion,simHash,engine,hz,dtTicks,checksumEvery,sc}=settings(header,'FDEMO_ARG',true);
    const copy=(v,what)=>JSON.parse(json(v,what)),simVersion=copy(header.simVersion,'simVersion'),meta=copy(header.meta,'meta');
    const {maxBytes=4194304,initialSteps=3600}=options||fail('FDEMO_ARG','options : objet attendu');
    if(!(Number.isInteger(maxBytes)&&maxBytes>=0&&maxBytes<=2**30))fail('FDEMO_ARG','options : maxBytes invalide',{field:'maxBytes'});
    if(!(Number.isSafeInteger(initialSteps)&&initialSteps>=0))fail('FDEMO_ARG','options : initialSteps invalide',{field:'initialSteps'});
    const skip=dtTicks?2:0,R=sc.size+skip,tick=skip&&ticker(dtTicks),spare=new DataView(new ArrayBuffer(R)),out=sc.decode(spare,skip,{}),scenes=[];
    const grow=(bytes,n)=>{const next=new Uint8Array(Math.min(maxBytes,2*bytes.length+n));next.set(bytes);return next;};
    let records=new Uint8Array(Math.min(maxBytes,initialSteps*R)),view=new DataView(records.buffer),sums=new Uint8Array(512),sumView=new DataView(sums.buffer);
    let used=0,count=0,size=0,steps=0,taken=-1,dt=tick?0:1/hz,full=false,open=false,closed=false,now=null;
    const live=()=>{if(closed)fail('FDEMO_STATE','enregistreur fermé');},opened=what=>{live();if(!open)fail('FDEMO_STATE',what+' sans scène');};
    function room(n){if(!full&&size+n>maxBytes)full=now.truncated=true;return !full;}
    function step(input,seconds){
      opened('pas');
      if(!input||typeof input!=='object')fail('FDEMO_ARG','pas : entrée attendue');
      const store=room(R);
      if(store&&used+R>records.length){records=grow(records,R);view=new DataView(records.buffer);}
      const v=store?view:spare,at=store?used:0,t=tick&&(Number.isFinite(seconds)?Math.min(65535,Math.max(0,Math.round(seconds*dtTicks))):0);
      if(tick)v.setUint16(at,t,true);
      sc.encode(input,v,at+skip);sc.decode(v,at+skip,out);
      if(tick)dt=tick(t);
      if(store){used+=R;size+=R;now.steps++;}
      steps++;
      return out;
    }
    function build(){
      const head=utf8(JSON.stringify({format:FORMAT,game,gameVersion,simHash,simVersion,engine,hz,dtTicks,checksumEvery,fields:sc.fields,meta,
        scenes:scenes.map(s=>({info:s.info,steps:s.steps,checksums:s.checksums,commandBytes:s.commandBytes,truncated:s.truncated}))}));
      const all=new Uint8Array(8+head.length+size);
      let p=8+head.length;
      for(let i=0;i<4;i++)all[i]=MAGIC.charCodeAt(i);
      new DataView(all.buffer).setUint32(4,head.length,true);all.set(head,8);
      for(const s of scenes){
        all.set(records.subarray(s.at,s.at+s.steps*R),p);p+=s.steps*R;
        all.set(sums.subarray(s.sums,s.sums+8*s.checksums),p);p+=8*s.checksums;
        if(s.commandBytes)all.set(utf8('['+s.commands.join(',')+']'),p);
        p+=s.commandBytes;
      }
      return all;
    }
    return {
      scene(info){
        live();
        const copied=copy(info,'info');
        open=true;steps=0;taken=-1;if(tick)dt=0;
        if(!full)scenes.push(now={info:copied,steps:0,checksums:0,commandBytes:0,truncated:false,at:used,sums:8*count,commands:[]});
      },
      step,
      checksumDue(){live();return !full&&open&&steps%checksumEvery===0&&taken!==steps;},
      checksum(value){
        opened('empreinte');
        if(taken===steps)fail('FDEMO_STATE','deux empreintes au pas '+steps);
        taken=steps;
        if(!room(8))return;
        if(8*count+8>sums.length){sums=grow(sums,8);sumView=new DataView(sums.buffer);}
        sumView.setUint32(8*count,steps,true);sumView.setUint32(8*count+4,value>>>0,true);
        count++;size+=8;now.checksums++;
      },
      command(type,data=null){
        opened('commande');
        if(typeof type!=='string'||!type)fail('FDEMO_ARG','commande : type invalide');
        const line=json([steps,type,data],'commande '+type),cost=utf8(line).length+(now.commands.length?1:2);
        if(room(cost)){now.commands.push(line);now.commandBytes+=cost;size+=cost;}
      },
      bytes(){live();return build();},
      end(){live();closed=true;return build();},
      get input(){return out;},get dt(){return dt;},get steps(){return steps;},get size(){return size;},get full(){return full;}};
  }
  function player(bytes,expect){
    const view=ArrayBuffer.isView(bytes)?new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength)
      :Object.prototype.toString.call(bytes)==='[object ArrayBuffer]'?new DataView(bytes):fail('FDEMO_ARG','lecteur : octets attendus');
    const u8=new Uint8Array(view.buffer,view.byteOffset,view.byteLength),n=u8.length,bad=why=>fail('FDEMO_FORMAT','lecture : '+why);
    const read=(at,length,what)=>{try{return JSON.parse(fromUtf8(u8.subarray(at,at+length)));}catch{return bad(what+' illisible');}};
    if(n<8||String.fromCharCode(u8[0],u8[1],u8[2],u8[3])!==MAGIC)bad('signature '+MAGIC+' absente');
    const L=view.getUint32(4,true),header=L>n-8?bad('en-tête tronqué'):read(8,L,'en-tête');
    if(!header||header.format!==FORMAT)bad('format '+FORMAT+' attendu');
    const {hz,dtTicks,sc}=settings(header,'FDEMO_FORMAT'),list=header.scenes,R=sc.size+(dtTicks?2:0),parts=[];
    if(header.simVersion===undefined||header.meta===undefined||!Array.isArray(list))bad('en-tête incomplet');
    function commandsOf(part,k){
      if(!part.commandBytes)return NONE;
      const all=read(part.commands,part.commandBytes,'commandes de la scène '+k);
      if(!Array.isArray(all)||!all.length)bad('commandes de la scène '+k+' vides');
      let last=0;
      for(const c of all){
        if(!Array.isArray(c)||c.length!==3||!Number.isSafeInteger(c[0])||c[0]<last||c[0]>part.steps||typeof c[1]!=='string'||!c[1])bad('commande invalide, scène '+k);
        last=c[0];
      }
      return all;
    }
    let p=8+L;
    for(let k=0;k<list.length;k++){
      const s=list[k]||{},{steps,checksums,commandBytes}=s,sums=p+steps*R,commands=sums+checksums*8;
      if(s.info===undefined||typeof s.truncated!=='boolean'||![steps,checksums,commandBytes].every(v=>Number.isSafeInteger(v)&&v>=0))bad('scène '+k+' invalide');
      if(steps*R>n-p||checksums*8>n-sums||commandBytes>n-commands)bad('scène '+k+' tronquée');
      for(let i=0,last=-1;i<checksums;i++){
        const at=view.getUint32(sums+8*i,true);
        if(at<=last||at>steps)bad('scène '+k+' : empreintes hors ordre');
        last=at;
      }
      const part={at:p,steps,sums,checksums,commands,commandBytes};
      commandsOf(part,k);parts.push(part);p=commands+commandBytes;
    }
    if(p!==n)bad(n+' octets au lieu de '+p);
    if(expect!==undefined&&expect!==null){
      if(typeof expect!=='object')fail('FDEMO_ARG','lecteur : expect invalide');
      for(const key of Object.keys(expect))if(text(header[key],'expect')!==text(expect[key],'expect'))fail('FDEMO_MISMATCH','enregistrement refusé : '+key,{field:key});
    }
    const fixed=dtTicks?0:1/hz,tick=dtTicks&&ticker(dtTicks);
    let scene=0,base=0,count=0,cursor=0,dt=fixed,commands=new Map(),sums=new Map(),divergence=null;
    const play={header,sceneCount:parts.length,
      select(k){
        const part=Number.isInteger(k)&&parts[k]||fail('FDEMO_ARG','lecteur : scène '+k+' inexistante'),byStep=new Map(),expected=new Map();
        for(const [at,type,data] of commandsOf(part,k))(byStep.get(at)||byStep.set(at,[]).get(at)).push({type,data});
        for(let i=0;i<part.checksums;i++)expected.set(view.getUint32(part.sums+8*i,true),view.getUint32(part.sums+8*i+4,true));
        scene=k;base=part.at;count=part.steps;cursor=0;dt=fixed;commands=byStep;sums=expected;
        return play;
      },
      next(out){
        if(cursor>=count)return false;
        let at=base+cursor*R;
        if(tick){dt=tick(view.getUint16(at,true));at+=2;}
        sc.decode(view,at,out);cursor++;
        return true;
      },
      commandsAt:at=>commands.get(at)||NONE,
      expected:at=>sums.get(at),
      verify(at,value){
        const want=sums.get(at);
        if(want===undefined||want===value>>>0)return true;
        divergence=divergence||{scene,step:at,expected:want,actual:value>>>0};
        return false;
      },
      get scene(){return scene;},get steps(){return count;},get step(){return cursor;},get dt(){return dt;},get divergence(){return divergence;}};
    if(parts.length)play.select(0);
    return play;
  }
  function replay(bytes,game,options){
    const {expect,stopOnDesync=true}=options??{};
    if(!game||typeof game.open!=='function'||typeof stopOnDesync!=='boolean')fail('FDEMO_ARG','rejeu : game.open ou stopOnDesync invalide');
    const play=player(bytes,expect),header=play.header,input={},result={ok:true,steps:0,checked:0,divergence:null,scenes:[]};
    let k=0,h=null,part=null,done=false,busy=false;
    const close=()=>{const x=h;h=null;if(typeof x.dispose==='function')x.dispose();};
    function check(at){
      const want=play.expected(at);
      if(want===undefined)return true;
      const actual=h.checksum()>>>0;
      result.checked++;part.checked++;
      if(actual===want)return true;
      const d={scene:k,step:at,expected:want,actual};
      part.divergence=part.divergence||d;
      if(result.ok){result.ok=false;result.divergence=d;}
      return !stopOnDesync;
    }
    function advance(max=Infinity){
      if(!(max>=0&&(Number.isInteger(max)||max===Infinity)))fail('FDEMO_ARG','rejeu : maxSteps invalide');
      if(busy)fail('FDEMO_STATE','rejeu : advance imbriqué');
      busy=true;
      try{
        for(let taken=0;!done;){
          if(!h){
            if(k>=play.sceneCount){done=true;break;}
            if(taken>=max)break;
            play.select(k);result.scenes.push(part={index:k,steps:0,checked:0,divergence:null});
            h=game.open(header.scenes[k].info,k,header);
            if(!h||typeof h.step!=='function'||typeof h.checksum!=='function')fail('FDEMO_ARG','rejeu : poignée invalide, scène '+k);
            if(!check(0)){close();done=true;break;}
          }
          if(play.step<play.steps&&taken>=max)break;
          const list=play.commandsAt(play.step);
          if(list.length&&typeof h.command!=='function')fail('FDEMO_COMMAND','rejeu : commande '+list[0].type+' sans h.command');
          for(let i=0;i<list.length;i++)h.command(list[i].type,list[i].data);
          if(!play.next(input)){close();k++;continue;}
          h.step(input,play.dt);
          taken++;result.steps++;part.steps++;
          if(!check(play.step)){close();done=true;}
        }
      }catch(e){done=true;if(h)try{close();}catch{}throw e;}
      finally{busy=false;}
      return done;
    }
    return {advance,run(){advance();return result;},get done(){return done;},get result(){return result;}};
  }
  // Réalisateur : temps simulé, tirages dans l'ordre plan, cible si needs, durée.
  const START={shot:null,target:null,changed:false,cut:false,flying:false,reason:null,age:0,hold:0,flight:0};
  function director(options){
    const ok=Number.isFinite,bad=why=>fail('FDEMO_ARG','réalisateur : '+why);
    const {seed=1,shots,fov=74,fly,avoid}=options||bad('options attendues'),{base=1.8,speed=160,min:low=2.2,max:high=5.5}=fly||{},{count=2,radius=12,factor=.3}=avoid||{};
    if(![seed,fov,base,speed,low,high,radius,factor].every(ok)||!(Number.isInteger(count)&&count>=0&&count<=16))bad('options invalides');
    const ids=new Set(),plans=(Array.isArray(shots)&&shots.length?shots:bad('plans attendus')).map((s,i)=>{
      const {id,duration:d,transition='cut'}=s||{};
      if(typeof id!=='string'||!id||ids.has(id)||!(Array.isArray(d)&&ok(d[0])&&ok(d[1])&&d[0]>0&&d[0]<=d[1])||typeof s.pose!=='function'||transition!=='cut'&&transition!=='fly')bad('plan '+i+' invalide');
      ids.add(id);return {...s,min:d[0],max:d[1],fly:transition==='fly'};
    });
    const n=plans.length,draw=rng(seed),weights=new Float64Array(n),ring=new Float64Array(3*count),blank=()=>({pos:[0,0,0],yaw:0,pitch:0,roll:0,fov});
    const live=blank(),from=blank(),own=live.pos,frame={...START,pose:blank()},out=frame.pose;
    let spots=new Float64Array(8),cur,prev,aim,why,cutting,shown,stored,slot;
    const copy=(a,b)=>{const p=a.pos,q=b.pos;p[0]=q[0];p[1]=q[1];p[2]=q[2];a.yaw=b.yaw;a.pitch=b.pitch;a.roll=b.roll;a.fov=b.fov;};
    const mix=(a,b,k)=>a+(b-a)*k,worth=p=>{const w=p.weight===undefined?1:p.weight;return ok(w)&&w>0?w:0;};
    const seek=(list,key,kind)=>{for(let j=0;j<list.length;j++){const p=list[j];if(p&&(kind?p.kind===key&&worth(p)>0:p.id===key))return p;}return null;};
    function choose(ctx,list){
      let positive=0;
      for(let i=0;i<n;i++){
        const s=plans[i],w=typeof s.weight==='function'?s.weight(ctx):s.weight;
        if((weights[i]=ok(w)&&w>0&&(!s.valid||s.valid(ctx))&&(s.needs===undefined||seek(list,s.needs,1))?w:0)>0)positive++;
      }
      if(positive>1&&prev>=0)weights[prev]=0;
      const i=draw.pick(weights,n),s=plans[i];
      if(i<0)return false;
      prev=i;frame.target=null;
      if(s.needs!==undefined){
        if(spots.length<list.length)spots=new Float64Array(list.length);
        for(let j=0;j<list.length;j++){
          const p=list[j];let w=p&&p.kind===s.needs?worth(p):0;
          for(let k=0;w>0&&k<3*stored;k+=3){const q=p.pos,x=q[0]-ring[k],y=q[1]-ring[k+1],z=q[2]-ring[k+2];if(x*x+y*y+z*z<radius*radius){w*=factor;break;}}
          spots[j]=w;
        }
        const t=frame.target=list[draw.pick(spots,list.length)];
        if(!t)return false;
        aim=t.id;
        if(count){const q=t.pos,k=3*slot;ring[k]=q[0];ring[k+1]=q[1];ring[k+2]=q[2];slot=(slot+1)%count;stored=Math.min(stored+1,count);}
      }
      frame.hold=draw.range(s.min,s.max);frame.age=frame.flight=0;cur=i;
      return true;
    }
    function update(dt,ctx){
      dt=ok(dt)&&dt>0?dt:0;
      const list=ctx&&Array.isArray(ctx.points)?ctx.points:NONE,p=out.pos,f=from.pos;
      frame.changed=frame.cut=false;
      if(cutting){cutting=false;cur=-1;why='external';}
      else if(cur>=0){
        const s=plans[cur],age=frame.age+=dt,t=s.needs===undefined?null:seek(list,aim);
        const end=s.needs!==undefined&&!t?'lost':s.valid&&!s.valid(ctx)?'invalid':age>=frame.flight+frame.hold?'time':s.cutIf&&age>=frame.flight&&s.cutIf(ctx,age,t)?'cutIf':'';
        if(end){cur=-1;why=end;}else frame.target=t;
      }
      for(let tries=0;tries<n;tries++){
        const fresh=cur<0;
        if(fresh&&!choose(ctx,list))break;
        const s=plans[cur],age=frame.age;
        live.pos=own;live.roll=0;live.fov=fov;s.pose(ctx,age,frame.target,live);
        const q=live.pos;
        if(!(q&&ok(q[0])&&ok(q[1])&&ok(q[2])&&ok(live.yaw)&&ok(live.pitch)&&ok(live.roll)&&ok(live.fov))){cur=-1;why='pose';continue;}
        if(fresh){
          const x=q[0]-p[0],y=q[1]-p[1],z=q[2]-p[2],span=s.fly&&shown?Math.min(high,Math.max(low,base+Math.sqrt(x*x+y*y+z*z)/speed)):0;
          frame.flight=span>0?span:0;frame.changed=true;if(!(frame.cut=!frame.flight))copy(from,out);
        }
        if(frame.flying=age<frame.flight){
          const k=smootherstep(age/frame.flight);
          for(let i=0;i<3;i++)p[i]=mix(f[i],q[i],k);
          out.yaw=from.yaw+wrapAngle(live.yaw-from.yaw)*k;out.pitch=mix(from.pitch,live.pitch,k);out.roll=mix(from.roll,live.roll,k);out.fov=mix(from.fov,live.fov,k);
        }else copy(out,live);
        shown=true;break;
      }
      if(cur<0)Object.assign(frame,START);else frame.shot=plans[cur].id;
      frame.reason=why;
      return frame;
    }
    function reset(s=seed){
      if(!ok(s))bad('graine invalide');
      draw.state=s;cur=prev=-1;why='start';cutting=shown=false;stored=slot=0;Object.assign(frame,START);live.pos=own;
      for(const o of [live,from,out])copy(o,blank());
    }
    reset();
    return {frame,update,reset,cut(){cutting=true;shown=false;stored=slot=0;}};
  }
  // Independent title-screen lifecycle; no game globals, saving or simulation.
  function attract(o={}){
    const win=o.window||G,doc=o.document||win.document,now=o.now||(()=>performance.now()),read=v=>typeof v==='function'?v():v;
    let state='idle',since=now(),swallowUntil=0,disposed=false,serial=0,padDown=false,consumePad=false,hiddenAt=null;
    const mute=e=>{e?.preventDefault?.();e?.stopImmediatePropagation?.();e?.stopPropagation?.();};
    function stop(reason='gesture'){
      const live=state==='running'||state==='starting';serial++;state='idle';since=now();if(live){swallowUntil=since+(o.swallowMs??600);o.stop?.(reason);}return live;
    }
    function poke(e){
      if(disposed)return;const key=e?.code||e?.key||'',modifier=/^(Shift|Control|Alt|Meta|CapsLock)/.test(key),browser=!!(e?.ctrlKey||e?.metaKey||e?.altKey||/^F\d{1,2}$/.test(key));
      if(modifier)return;if(now()<swallowUntil&&!browser){mute(e);return;}
      if(stop('gesture')){if(!e)consumePad=true;if(!browser)mute(e);}since=now();
    }
    const listeners=['pointerdown','keydown','wheel','touchstart','click','pointerup'];for(const name of listeners)win.addEventListener?.(name,poke,{capture:true,passive:false});
    function tick(){
      if(disposed)return;const t=now();let down=false;try{for(const p of win.navigator?.getGamepads?.()||[])if(p?.connected&&(p.buttons?.some(b=>b.pressed||b.value>.5)||p.axes?.some(a=>Math.abs(a)>.5)))down=true;}catch{}
      if(down&&!padDown)poke();padDown=down;if(!down)consumePad=false;
      if(doc?.hidden){if(hiddenAt===null){hiddenAt=t;o.onPause?.();}since=t;return;}if(hiddenAt!==null){const elapsed=t-hiddenAt;hiddenAt=null;o.onResume?.(elapsed);since=t;}
      if(state==='starting'||state==='running')return;
      if(down||read(o.enabled)===false||read(o.canStart)===false||win.matchMedia?.('(prefers-reduced-motion: reduce)').matches){state='idle';since=t;o.onCountdown?.(null);return;}
      state='armed';const left=Math.max(0,(read(o.idleMs)??5000)-(t-since));o.onCountdown?.(left);if(left>0)return;
      state='starting';const ticket=++serial;
      try{const work=o.start?.();if(work&&typeof work.then==='function')work.then(ok=>{if(!disposed&&ticket===serial){state=ok===false?'idle':'running';since=now();}}).catch(error=>{if(ticket===serial){stop('error');o.onError?.(error);}});else{state=work===false?'idle':'running';since=t;}}
      catch(error){stop('error');o.onError?.(error);}
    }
    return {tick,poke,stop,get state(){return state;},get swallowing(){return consumePad||now()<swallowUntil;},dispose(){if(disposed)return;stop('dispose');disposed=true;for(const name of listeners)win.removeEventListener?.(name,poke,true);}};
  }
  function runner(o={}){
    const scenes=o.scenes||[];if(!scenes.length)throw Error('Demo scenes required');let at=-1,current=null,age=0,stalled=0,key='',recoveries=0,disposed=false,errors=[],time=0,opening=0;
    const stats={scenes:0,steps:0,deaths:0,stalls:0,errors:0,seconds:0};
    function next(reason='next'){
      if(disposed)return;current?.dispose?.();current=null;age=stalled=0;recoveries=0;key='';at=(at+1)%scenes.length;const ticket=++opening;
      try{const result=o.open(scenes[at],reason);const accept=value=>{if(disposed||ticket!==opening){value?.dispose?.();return;}current=value;stats.scenes++;o.onScene?.(scenes[at],reason);};if(result?.then)result.then(accept).catch(error=>{if(ticket===opening&&!disposed)fail(error);});else accept(result);}catch(error){fail(error);}
    }
    function fail(error){stats.errors++;errors=errors.filter(t=>time-t<60);errors.push(time);o.onError?.(error);if(errors.length>=3){dispose();o.onStop?.('errors');}else next('error');}
    function step(dt){
      if(disposed||!current||!(dt>0))return;
      try{current.step(dt);time+=dt;age+=dt;stats.steps++;stats.seconds+=dt;const value=String(current.progressKey?.()??'');if(value!==key){key=value;stalled=0;}else stalled+=dt;
        if(current.dead?.()){stats.deaths++;if(recoveries++<2&&current.recover?.()){stalled=0;return;}next('death');return;}
        if(current.done?.()||age>=(scenes[at].maxSeconds||o.sceneSeconds||240)){next('end');return;}
        if(stalled>=(o.stallSeconds||50)){stats.stalls++;if(recoveries++===0){current.reset?.();stalled=0;}else next('stall');}
      }catch(error){fail(error);}
    }
    function dispose(){if(disposed)return;disposed=true;opening++;current?.dispose?.();current=null;}
    return {step,next,dispose,stats,get scene(){return scenes[at];},get waiting(){return !current;},get stopped(){return disposed;}};
  }
  G.FDemo={FORMAT,MAGIC,rng,hasher,seedFor,smootherstep,wrapAngle,lookAt,schema,recorder,player,replay,director,attract,runner};
})(typeof window!=='undefined'?window:globalThis);
