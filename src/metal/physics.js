/* FERRO — FPhysics: deterministic rigid bodies (oriented boxes, spheres, capsules) against static boxes.
   Rules: no clock, no random source; Math.sqrt/abs/floor/imul/min/max only (trig only in TRIG blocks);
   fixed iteration order; typed arrays; no allocation per step; canonical derived values; -0 normalised.
   Determinism, the five writing rules:
   1. Math: sqrt, abs, floor, imul, min, max and PI only; sin, cos, atan2 and asin only between the TRIG
      markers (angle conversions, joint limits), never in the solver; no exponent operator.
   2. Fixed order: bodies by increasing index, grid cells z then x, statics by index, contacts in emission
      order, joints by slot; no Map, Set, sort or key enumeration inside step().
   3. Canonical derived values: inertia, rotation, bounds and tolerance come from one function each, called
      at creation, at the end of a sub-step and on restore, from saved values only (inverse mass, never 1/(1/m)).
   4. The fingerprint covers every setting; a snapshot carries it.
   5. -0 is normalised by x+0 at the end of each sub-step, in the impulse cache and in joints.
   Time only enters through dt: the same calls with the same arguments give the same bits.
   Inside step(): no new object, array literal, closure or string; floats never cross a call (SCR scratch). */
(function(G){
  'use strict';
  // Material id = index (the host game keeps the same order).
  const MATERIALS=Object.freeze([
    Object.freeze({name:'metal',friction:.45,restitution:.24,density:65}),
    Object.freeze({name:'stone',friction:.7,restitution:.16,density:28}),
    Object.freeze({name:'wood',friction:.55,restitution:.22,density:8}),
    Object.freeze({name:'glass',friction:.35,restitution:.16,density:25}),
    Object.freeze({name:'dirt',friction:.8,restitution:.05,density:12})
  ]);
  const I32=2147483647;
  // Settings after bounds, in fingerprint order: [name, default, kind, low, high].
  // Kinds: f finite, p > 0, z >= 0, g null or finite, i integer in [low, high].
  // Integer limits keep encodings exact: body handle gen*4096+index, joint handle gen*4096+slot,
  // pair key lo*(capacity+maxStatics+2)+hi below 2^31.
  const SETTINGS=[
    ['cell',2,'p'],['gravity',-12,'f'],['ground',null,'g'],['floorThickness',.5,'p'],['minY',-60,'f'],['tick',1/120,'p'],
    ['maxSubsteps',8,'i',1,I32],['capacity',384,'i',1,4095],['maxStatics',4096,'i',1,65535],['maxContacts',16384,'i',1,1048576],
    ['maxJoints',128,'i',0,4095],['iterations',2,'i',1,I32],['relaxIterations',1,'i',0,I32],['hardIterations',4,'i',0,I32],
    ['hardRelaxIterations',2,'i',0,I32],['hardRatio',8,'z'],['contactHertz',30,'p'],['dampingRatio',10,'z'],['pushout',3,'z'],
    ['restitutionThreshold',1,'z'],['jointHertz',60,'p'],['jointDampingRatio',2,'z'],['linearDamping',.02,'z'],
    ['angularDamping',.06,'z'],['rollingDamping',2,'z'],['maxLinear',40,'p'],['maxAngular',30,'p'],['margin',.02,'z'],
    ['slop',.005,'z'],['slopRatio',.12,'z'],['minHalf',.02,'z'],['sleepLinear',.08,'z'],['sleepAngular',.12,'z'],
    ['sleepTime',.5,'z'],['splitTime',1,'z'],['fallbackTime',6,'z'],['fallbackDistance',.002,'z'],['wakeSpeed',.25,'z'],
    ['supportSpeed',.08,'z'],['massMin',3,'p'],['massMax',120,'p'],['maxAwake',160,'i',0,I32],['spawnBudget',24,'i',1,I32],
    ['eventSpeed',1.2,'z'],['maxEvents',16,'i',0,I32]
  ];
  // Grid cells allowed by bounds and cell (4 MB of cell heads per grid at most).
  const MAX_CELLS=1048576;
  const fail=text=>{throw new TypeError('FPhysics.create: '+text);};
  const wrong=(where,text)=>{throw new TypeError('FPhysics.'+where+': '+text);};
  const finite=v=>typeof v==='number'&&Number.isFinite(v);
  // FNV-1a 32 bits: one step over a 32-bit word.
  const fnv=(h,u)=>Math.imul(h^u,16777619);
  // FNV-1a 32 bits over character codes, as 8 hex digits.
  function textHash(text){
    let h=2166136261;
    for(let i=0;i<text.length;i++)h=fnv(h,text.charCodeAt(i));
    return (h>>>0).toString(16).padStart(8,'0');
  }
  // Validated settings (-0 normalised), plus durations converted to whole sub-steps.
  function settings(o){
    if(!o||typeof o!=='object')fail('options object with bounds required');
    const b=o.bounds;
    if(!b||typeof b!=='object')fail('bounds {minX, maxX, minZ, maxZ} required');
    for(const k of ['minX','maxX','minZ','maxZ'])if(!finite(b[k]))fail('bounds.'+k+' must be a finite number');
    if(!(b.minX<b.maxX&&b.minZ<b.maxZ))fail('bounds need minX < maxX and minZ < maxZ');
    const c={bounds:Object.freeze({minX:b.minX+0,maxX:b.maxX+0,minZ:b.minZ+0,maxZ:b.maxZ+0})};
    for(const [name,def,kind,low,high] of SETTINGS){
      let v=o[name];
      if(v===undefined||kind==='g'&&v===null)v=def;
      else if(!finite(v))fail(name+' must be a finite number'+(kind==='g'?' or null':''));
      else if(kind==='p'&&!(v>0))fail(name+' must be > 0');
      else if(kind==='z'&&!(v>=0))fail(name+' must be >= 0');
      else if(kind==='i'&&!(Number.isInteger(v)&&v>=low&&v<=high))fail(name+' must be an integer from '+low+' to '+high);
      c[name]=v===null?null:v+0;
    }
    if(c.massMin>c.massMax)fail('massMin must not exceed massMax');
    const cells=(Math.floor((c.bounds.maxX-c.bounds.minX)/c.cell)+1)*(Math.floor((c.bounds.maxZ-c.bounds.minZ)/c.cell)+1);
    if(!(cells<=MAX_CELLS))fail('bounds and cell give '+cells+' grid cells (at most '+MAX_CELLS+')');
    const t=c.tick,steps=d=>Math.floor(d/t+.5);
    c.sleepSteps=steps(c.sleepTime);c.splitSteps=steps(c.splitTime);c.fallbackSteps=steps(c.fallbackTime);c.windowSteps=steps(1);
    // clock (bench only, never part of the state) is checked here and kept out of config.
    if(o.clock!==undefined&&o.clock!==null&&typeof o.clock!=='function')fail('clock must be a function or null');
    return Object.freeze(c);
  }
  // Fingerprint: FNV-1a of 'FPhysics2|' + settings in table order, bounds flat, ground 'none' when null.
  function fingerprintOf(c){
    const b=c.bounds,values=[b.minX,b.maxX,b.minZ,b.maxZ];
    for(const s of SETTINGS)values.push(c[s[0]]===null?'none':c[s[0]]);
    return textHash('FPhysics2|'+values.join('|'));
  }
  // Body flags (FL) and shapes (SH).
  const ALIVE=1,ASLEEP=2,KINEMATIC=4,PENDING=8,LOST=16,HARD=32,MOVING=64,SHAPES=['box','sphere','capsule'];
  // Generations wrap at 2^19, so that a handle gen*4096 + index stays below 2^31.
  const GENS=524288;
  // Description checks (outside step). A vector of n finite numbers, copied with -0 normalised.
  function vec(where,name,v,n){
    if(!(Array.isArray(v)||ArrayBuffer.isView(v))||v.length!==n)wrong(where,name+' must be an array of '+n+' numbers');
    const out=new Array(n);
    for(let k=0;k<n;k++){if(!finite(v[k]))wrong(where,name+' must hold finite numbers');out[k]=v[k]+0;}
    return out;
  }
  function inRange(where,name,v,def,low,high){
    if(v===undefined)return def;
    if(!finite(v)||v<low||v>high)wrong(where,name+' must be a number from '+low+' to '+high);
    return v+0;
  }
  // Material: index or name in MATERIALS; -1 (or absent) for none.
  function materialOf(where,m){
    if(m===undefined||m===-1)return -1;
    if(Number.isInteger(m)&&m>=0&&m<MATERIALS.length)return m;
    for(let k=0;k<MATERIALS.length;k++)if(MATERIALS[k].name===m)return k;
    return wrong(where,'material must be a name or an index of MATERIALS');
  }
  function create(o){
    const C=settings(o),fp=fingerprintOf(C),clock=typeof o.clock==='function'?o.clock:null;
    const NB=C.capacity+1,MS=C.maxStatics,MC=C.maxContacts,KM=NB+MS+1;
    const minX=C.bounds.minX,maxX=C.bounds.maxX,minZ=C.bounds.minZ,maxZ=C.bounds.maxZ,cell=C.cell;
    const GW=Math.floor((maxX-minX)/cell)+1,GD=Math.floor((maxZ-minZ)/cell)+1,CELLS=GW*GD;
    // ---- Bodies: columns of NB = capacity + 1 rows; row 0 is the world (immovable: zero inverse mass and inertia).
    // Saved, in snapshot order: SH shape (0 box, 1 sphere, 2 capsule), FL flags, GEN generation, GRP group, MSK mask,
    // MAT material (-1 none), P position, Q quaternion [x, y, z, w], V velocity (linear then angular, world frame),
    // H collision half-size, HR real half-size, IM inverse physical mass, MO original mass, FR friction,
    // RE restitution, ST sub-steps under the sleep thresholds, AT sub-steps awake, FN fallback window,
    // RP fallback reference position, KT kinematic target (position, quaternion), KN target pending.
    const SH=new Uint8Array(NB),FL=new Uint8Array(NB),GEN=new Int32Array(NB),GRP=new Int32Array(NB),MSK=new Int32Array(NB),MAT=new Int32Array(NB).fill(-1);
    const P=new Float64Array(NB*3),Q=new Float64Array(NB*4),V=new Float64Array(NB*6),H=new Float64Array(NB*3),HR=new Float64Array(NB*3);
    const IM=new Float64Array(NB),MO=new Float64Array(NB),FR=new Float64Array(NB),RE=new Float64Array(NB);
    const ST=new Int32Array(NB),AT=new Int32Array(NB),FN=new Int32Array(NB),RP=new Float64Array(NB*3),KT=new Float64Array(NB*7),KN=new Uint8Array(NB);
    // Derived, from saved values only (same functions at creation, end of sub-step and restore): R rotation
    // (row-major, column k = local axis k in the world), IL local inverse inertia, IW world inverse inertia
    // (xx xy xz yy yz zz), BB bounds and FB swept bounds (min x y z, max x y z), SL contact tolerance,
    // PP and PQ pose at the start of the last step() call (render interpolation).
    const R=new Float64Array(NB*9),IL=new Float64Array(NB*3),IW=new Float64Array(NB*6),BB=new Float64Array(NB*6),FB=new Float64Array(NB*6);
    const SL=new Float64Array(NB),PP=new Float64Array(NB*3),PQ=new Float64Array(NB*4);
    // Sub-step scratch: AL active list (increasing index), ACT active mark (1 awake dynamic body, 2 moving kinematic body),
    // WK deferred wake mark, UF union-find, IMIN smallest ST of an island (at its root), TOUCH contact in this sub-step (or woken at its end).
    const AL=new Int32Array(NB),ACT=new Uint8Array(NB),WK=new Uint8Array(NB),UF=new Int32Array(NB),IMIN=new Int32Array(NB),TOUCH=new Uint8Array(NB);
    Q[3]=1;R[0]=R[4]=R[8]=1;SL[0]=C.slop;
    // Saved arrays in snapshot and hash order: [name, array, width, integer low, integer high].
    const FIELDS=[['SH',SH,1,0,2],['FL',FL,1,0,127],['GEN',GEN,1,0,GENS-1],['GRP',GRP,1,0,65535],['MSK',MSK,1,0,65535],['MAT',MAT,1,-1,MATERIALS.length-1],
      ['P',P,3],['Q',Q,4],['V',V,6],['H',H,3],['HR',HR,3],['IM',IM,1],['MO',MO,1],['FR',FR,1],['RE',RE,1],
      ['ST',ST,1,0,I32],['AT',AT,1,0,I32],['FN',FN,1,0,I32],['RP',RP,3],['KT',KT,7],['KN',KN,1,0,1]];
    // Hash views (floats are hashed by their 32-bit words) and the values of row 0, the world.
    const VIEWS=FIELDS.map(f=>f[1] instanceof Float64Array?new Uint32Array(f[1].buffer):null),WORLD=FIELDS.map(f=>Array.from(f[1].subarray(0,f[2])));
    // ---- Statics (setStatics): centre sP, half-size sH, rotation sR (identity for a box), OBB flag sO, bounds sA
    // (min x y z, max x y z), friction sF, restitution sE, material sM, query stamp sT. Grid in compressed rows:
    // cell c lists sItems[sStart[c] .. sStart[c+1]-1], by increasing index.
    let NS=0,sP=new Float64Array(0),sH=sP,sR=sP,sA=sP,sF=sP,sE=sP,sO=new Uint8Array(0),sM=new Int32Array(0),sT=sM,sItems=sM,stamp=0,decor=false;
    const sStart=new Int32Array(CELLS+1);
    // ---- Contacts of the sub-step (prototype columns): bodies cA cB (cB = 0, the world, for a static), pair key cK,
    // point id cI, normal cN (A to B), tangents cT1 cT2, arms cRA cRB, angular responses cAN cA1 cA2 (A then B),
    // separation cS, effective masses cMn cM1 cM2, impulses cJn cJ1 cJ2, friction cFr, restitution cRe,
    // approach speed cV0, peak normal impulse cMax, participating inverse masses cIa cIb (0: immovable side),
    // tolerance cSl, separation after the position update cSR (relaxation). Pairs: first point prF, points prN.
    const cA=new Int32Array(MC),cB=new Int32Array(MC),cK=new Int32Array(MC),cI=new Int32Array(MC),prF=new Int32Array(MC),prN=new Int32Array(MC);
    const cN=new Float64Array(MC*3),cT1=new Float64Array(MC*3),cT2=new Float64Array(MC*3),cRA=new Float64Array(MC*3),cRB=new Float64Array(MC*3);
    const cAN=new Float64Array(MC*6),cA1=new Float64Array(MC*6),cA2=new Float64Array(MC*6);
    const cS=new Float64Array(MC),cMn=new Float64Array(MC),cM1=new Float64Array(MC),cM2=new Float64Array(MC),cJn=new Float64Array(MC),cJ1=new Float64Array(MC),cJ2=new Float64Array(MC);
    const cFr=new Float64Array(MC),cRe=new Float64Array(MC),cV0=new Float64Array(MC),cMax=new Float64Array(MC),cIa=new Float64Array(MC),cIb=new Float64Array(MC),cSl=new Float64Array(MC),cSR=new Float64Array(MC);
    // ---- Impulse cache (warm start of the next sub-step): pn entries of key pK, point id pI, impulses pJn pJ1 pJ2,
    // the entries of one key contiguous. Open addressing over TS slots (power of 2 >= 2*maxContacts): TB = first
    // entry + 1 (0 empty), TC = entry count; TU lists the used slots, so that clearing touches only them.
    let TS=1;while(TS<2*MC)TS*=2;
    const pK=new Int32Array(MC),pI=new Int32Array(MC),pJn=new Float64Array(MC),pJ1=new Float64Array(MC),pJ2=new Float64Array(MC);
    const TB=new Int32Array(TS),TC=new Int32Array(TS),TU=new Int32Array(MC),CU=[pJn,pJ1,pJ2].map(a=>new Uint32Array(a.buffer));
    // ---- Narrow-phase scratch (prototype): box-box axes tt cc qq; point k: normal mN[3k..] (A to B), point mP[3k..],
    // separation mS[k], id mI[k]; face clipping polygons clipA clipB with ids idA idB; kept points pick.
    const tt=new Float64Array(3),cc=new Float64Array(9),qq=new Float64Array(9),mN=new Float64Array(24),mP=new Float64Array(24),mS=new Float64Array(8),mI=new Int32Array(8);
    const clipA=new Float64Array(48),clipB=new Float64Array(48),idA=new Int32Array(16),idB=new Int32Array(16),pick=new Int32Array(4);
    // Float scratch: [0] narrow-phase margin of the pair; [1] [2] clip limits; [3] [4] friction and restitution
    // of the pair; [5] 1/h; [6] bias rate; [7] mass scale; [8] impulse scale (soft contact); [9] h = tick;
    // [10] linear and [11] angular damping factors; [12] gravity*h; [13] last clock mark (bench only).
    // Settings read inside the step, copied once (config is a plain object: a number read from it is a boxed
    // value, and a boxed input can make the optimiser box the floats it meets): [14] margin; [15] maxLinear;
    // [16] maxAngular; [17] pushout; [18] restitutionThreshold; [19] sleepLinear^2; [20] sleepAngular^2;
    // [21] sleepSteps (a float: NOSLEEP gives 1.2e11 sub-steps). Actions (outside the step): [22] [23] [24] world point
    // and [25] [26] [27] impulse of push(). [28] rolling damping factor. Round shapes: [29..31] centre and [32] radius of
    // ball A, [33..35] and [36] of ball B.
    const SCR=new Float64Array(37),ITER=C.iterations,RELAX=C.relaxIterations,MAXSUB=C.maxSubsteps;
    // Integer scratch: [0] [1] [2] [3] cells x0, x1, z0, z1 of the last cellRange; [4] [5] used cells and
    // [6] [7] entries of the body grids 0 and 1.
    const ISCR=new Int32Array(8);
    // World floats kept across steps: [0] time accumulator (s), hashed by its two words.
    const WS=new Float64Array(1),WSU=new Uint32Array(WS.buffer);
    {
      const h=C.tick,hz=Math.min(C.contactHertz,.25*(1/h)),om=6.283185307179586*hz,a1=2*C.dampingRatio+h*om,a2=h*om*a1,a3=1/(1+a2);
      SCR[5]=1/h;SCR[6]=om/a1;SCR[7]=a2*a3;SCR[8]=a3;SCR[9]=h;SCR[10]=1/(1+h*C.linearDamping);SCR[11]=1/(1+h*C.angularDamping);SCR[12]=C.gravity*h;
      SCR[14]=C.margin;SCR[15]=C.maxLinear;SCR[16]=C.maxAngular;SCR[17]=C.pushout;SCR[18]=C.restitutionThreshold;
      SCR[19]=C.sleepLinear*C.sleepLinear;SCR[20]=C.sleepAngular*C.sleepAngular;SCR[21]=C.sleepSteps;SCR[28]=1/(1+h*C.rollingDamping);
    }
    // ---- Body grids, one linked list per cell: 0 = active bodies with FB, rebuilt each sub-step; 1 = resting bodies
    // (sleepers) with FB = BB, rebuilt when restDirty. GH head per cell (-1 empty), GN next and GI item per entry,
    // GU used cells (clearing touches only them). Bodies are inserted by decreasing index at the head, so a cell is
    // walked by increasing index. Entries are sized in addBody (cellsOf): a sub-step never overflows nor allocates.
    const GH=[new Int32Array(CELLS).fill(-1),new Int32Array(CELLS).fill(-1)],GU=[new Int32Array(CELLS),new Int32Array(CELLS)],GN=[null,null],GI=[null,null];
    let GE=0,need=0,restDirty=true,nc=0,nm=0,pn=0,tu=0,top=1,nwake=0;
    function entries(n){GE=n;for(let g=0;g<2;g++){GN[g]=new Int32Array(n);GI[g]=new Int32Array(n);}restDirty=true;}
    entries(64);
    const stats={bodies:0,awake:0,sleeping:0,pending:0,kinematic:0,lost:0,statics:0,joints:0,contacts:0,manifolds:0,tests:0,
      substeps:0,events:0,refused:0,dropContacts:0,forcedSleep:0,fallbackSleep:0,wakes:0,droppedSteps:0,broken:0};
    const PH=new Float64Array(4);

    // ---- Canonical derived values. Sizes: a box has H = max(size/2, minHalf) and HR = size/2; a sphere H = (rc, rc, rc)
    // and HR = (r, r, r); a capsule (axis = local Y) H = (rc, hh + rc, rc) and HR = (r, height/2, r), with the collision
    // radius rc = max(r, minHalf) and the half-segment hh = height/2 - r = HR_y - HR_x (0 for a sphere).
    // Inertia from the saved inverse mass and collision sizes: box; sphere 2.5 im/r^2; capsule as a cylinder of radius r
    // and length L = 2 H_y on Y: ILy = 2 im/r^2, ILx = ILz = 12 im/(3 r^2 + L^2).
    function inertia(i){
      const p=i*3,im=IM[i],hx=H[p],hy=H[p+1],hz=H[p+2];
      if(SH[i]===0){IL[p]=3*im/(hy*hy+hz*hz);IL[p+1]=3*im/(hx*hx+hz*hz);IL[p+2]=3*im/(hx*hx+hy*hy);}
      else if(SH[i]===1)IL[p]=IL[p+1]=IL[p+2]=2.5*im/(hx*hx);
      else{const L=2*hy;IL[p]=IL[p+2]=12*im/(3*hx*hx+L*L);IL[p+1]=2*im/(hx*hx);}
    }
    // Contact tolerance SL = min(slop, slopRatio * m): m = smallest collision half-size of a box, radius of a round body.
    function tolerance(i){const p=i*3;SL[i]=Math.min(C.slop,C.slopRatio*(SH[i]?H[p]:Math.min(H[p],H[p+1],H[p+2])));}
    // Rotation, bounds and world inverse inertia from Q, P, H and IL (prototype derive); tight bounds for a round body.
    function derive(i){
      const q=i*4,x=Q[q],y=Q[q+1],z=Q[q+2],w=Q[q+3],xx=x*x,yy=y*y,zz=z*z,xy=x*y,xz=x*z,yz=y*z,wx=w*x,wy=w*y,wz=w*z,r=i*9;
      const r0=1-2*(yy+zz),r1=2*(xy-wz),r2=2*(xz+wy),r3=2*(xy+wz),r4=1-2*(xx+zz),r5=2*(yz-wx),r6=2*(xz-wy),r7=2*(yz+wx),r8=1-2*(xx+yy);
      R[r]=r0;R[r+1]=r1;R[r+2]=r2;R[r+3]=r3;R[r+4]=r4;R[r+5]=r5;R[r+6]=r6;R[r+7]=r7;R[r+8]=r8;
      const h=i*3,hx=H[h],hy=H[h+1],hz=H[h+2],b=i*6;
      let ex,ey,ez;
      if(SH[i]===0){ex=Math.abs(r0)*hx+Math.abs(r1)*hy+Math.abs(r2)*hz;ey=Math.abs(r3)*hx+Math.abs(r4)*hy+Math.abs(r5)*hz;ez=Math.abs(r6)*hx+Math.abs(r7)*hy+Math.abs(r8)*hz;}
      else{const s=HR[h+1]-HR[h];ex=Math.abs(r1)*s+hx;ey=Math.abs(r4)*s+hx;ez=Math.abs(r7)*s+hx;}
      BB[b]=P[h]-ex;BB[b+1]=P[h+1]-ey;BB[b+2]=P[h+2]-ez;BB[b+3]=P[h]+ex;BB[b+4]=P[h+1]+ey;BB[b+5]=P[h+2]+ez;
      const ix=IL[h],iy=IL[h+1],iz=IL[h+2];
      IW[b]=r0*r0*ix+r1*r1*iy+r2*r2*iz;IW[b+1]=r0*r3*ix+r1*r4*iy+r2*r5*iz;IW[b+2]=r0*r6*ix+r1*r7*iy+r2*r8*iz;
      IW[b+3]=r3*r3*ix+r4*r4*iy+r5*r5*iz;IW[b+4]=r3*r6*ix+r4*r7*iy+r5*r8*iz;IW[b+5]=r6*r6*ix+r7*r7*iy+r8*r8*iz;
    }
    // Upper bound of the grid cells a body can cover: bounds swept by maxLinear*tick plus margin on each side.
    function cellsOf(i){
      const p=i*3,e=Math.sqrt(H[p]*H[p]+H[p+1]*H[p+1]+H[p+2]*H[p+2]),n=Math.floor(2*(e+C.maxLinear*C.tick+C.margin)/cell)+3;
      return Math.min(GW,n)*Math.min(GD,n);
    }

    // ---- Grids.
    const cx=(A,k)=>{const c=Math.floor((A[k]-minX)/cell);return c<0?0:c>=GW?GW-1:c;};
    const cz=(A,k)=>{const c=Math.floor((A[k]-minZ)/cell);return c<0?0:c>=GD?GD-1:c;};
    // ISCR[0..3] = cells x0, x1, z0, z1 covered by the bounds A[b .. b+5].
    function cellRange(A,b){ISCR[0]=cx(A,b);ISCR[1]=cx(A,b+3);ISCR[2]=cz(A,b+2);ISCR[3]=cz(A,b+5);}
    function gridClear(g){const head=GH[g],used=GU[g];for(let k=ISCR[4+g]-1;k>=0;k--)head[used[k]]=-1;ISCR[4+g]=0;ISCR[6+g]=0;}
    function gridAdd(g,i){
      const head=GH[g],used=GU[g],next=GN[g],item=GI[g];cellRange(FB,i*6);
      const x0=ISCR[0],x1=ISCR[1],z0=ISCR[2],z1=ISCR[3];let u=ISCR[4+g],e=ISCR[6+g];
      for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){const c=z*GW+x;if(head[c]<0)used[u++]=c;next[e]=head[c];item[e]=i;head[c]=e++;}
      ISCR[4+g]=u;ISCR[6+g]=e;
    }

    // ---- Impulse cache table.
    function lookup(key){let h=(Math.imul(key,0x9E3779B1)>>>0)&(TS-1);for(;;){const e=TB[h];if(e===0)return -1;if(pK[e-1]===key)return h;h=(h+1)&(TS-1);}}
    function tableBuild(){
      for(let k=0;k<tu;k++){TB[TU[k]]=0;TC[TU[k]]=0;}tu=0;
      for(let c=0;c<pn;){const key=pK[c];let e=c+1;while(e<pn&&pK[e]===key)e++;let h=(Math.imul(key,0x9E3779B1)>>>0)&(TS-1);while(TB[h]!==0)h=(h+1)&(TS-1);TB[h]=c+1;TC[h]=e-c;TU[tu++]=h;c=e;}
    }

    // ---- Static decor. Outside the step, may allocate. Boxes {minX, maxX, minY, maxY, minZ, maxZ} and floors {x, z, w, d,
    // y?, slopeX?, slopeZ?} ((x, z) the centre, height y + (px - x) slopeX + (pz - z) slopeZ, one slope axis at most), each
    // with material?, friction?, restitution?. Order: the ground slab (index 0), the boxes, the flat floors as boxes
    // [x - w/2, y - T, z - d/2]-[x + w/2, y, z + d/2] (T = floorThickness), then the sloped floors as oriented boxes of
    // thickness T under their surface (axes from the slope, no trigonometry). No merging nor face masks yet (module
    // step 4); a changed decor wakes every sleeper and drops the body-static cache entries (exact difference: step 10).
    function setStatics(boxes,floors){
      const where='setStatics';
      if(boxes===undefined||boxes===null)boxes=[];
      if(floors===undefined||floors===null)floors=[];
      if(!Array.isArray(boxes))wrong(where,'boxes must be an array');
      if(!Array.isArray(floors))wrong(where,'floors must be an array');
      const n=(C.ground===null?0:1)+boxes.length+floors.length;
      if(n>MS)wrong(where,n+' statics exceed maxStatics ('+MS+')');
      const nP=new Float64Array(n*3),nH=new Float64Array(n*3),nR=new Float64Array(n*9),nA=new Float64Array(n*6),nF=new Float64Array(n),nE=new Float64Array(n),nO=new Uint8Array(n),nM=new Int32Array(n);
      const put=(s,x0,y0,z0,x1,y1,z1,f,e,m)=>{
        const p=s*3,b=s*6;nP[p]=(x0+x1)/2;nP[p+1]=(y0+y1)/2;nP[p+2]=(z0+z1)/2;nH[p]=(x1-x0)/2;nH[p+1]=(y1-y0)/2;nH[p+2]=(z1-z0)/2;
        nR[s*9]=nR[s*9+4]=nR[s*9+8]=1;for(let k=0;k<3;k++){nA[b+k]=nP[p+k]-nH[p+k];nA[b+3+k]=nP[p+k]+nH[p+k];}nF[s]=f;nE[s]=e;nM[s]=m;
      };
      // Oriented box: centre, half-sizes, rotation r (row-major, columns = local axes), bounds from |r| times the half-sizes.
      const obb=(s,c,hs,r,f,e,m)=>{
        const p=s*3,b=s*6;nO[s]=1;nF[s]=f;nE[s]=e;nM[s]=m;
        for(let k=0;k<9;k++)nR[s*9+k]=r[k]+0;
        for(let k=0;k<3;k++){nP[p+k]=c[k]+0;nH[p+k]=hs[k];const x=Math.abs(r[3*k])*hs[0]+Math.abs(r[3*k+1])*hs[1]+Math.abs(r[3*k+2])*hs[2];nA[b+k]=c[k]-x;nA[b+3+k]=c[k]+x;}
      };
      // Friction, restitution and material of a box or a floor: explicit values, then the material, then 0.7 and 0.05.
      const surface=(o,name)=>{const m=materialOf(where,o.material);return [inRange(where,name+'.friction',o.friction,m<0?.7:MATERIALS[m].friction,0,2),
        inRange(where,name+'.restitution',o.restitution,m<0?.05:MATERIALS[m].restitution,0,1),m];};
      let s=0;
      if(C.ground!==null)put(s++,minX,C.ground-C.floorThickness,minZ,maxX,C.ground,maxZ,.8,.05,-1);
      for(let k=0;k<boxes.length;k++){
        const b=boxes[k],name='boxes['+k+']';
        if(!b||typeof b!=='object')wrong(where,name+' must be an object');
        // RADE: retain urban box orientation instead of filling its enclosing AABB.
        if(b.center||b.half||b.rotation){
          if(!Array.isArray(b.center)||b.center.length!==3||!b.center.every(finite)||!Array.isArray(b.half)||b.half.length!==3||!b.half.every(v=>finite(v)&&v>0)||!Array.isArray(b.rotation)||b.rotation.length!==9||!b.rotation.every(finite))wrong(where,name+' invalid oriented box');
          const r=b.rotation;for(let i=0;i<3;i++)for(let j=i;j<3;j++){let dot=0;for(let k=0;k<3;k++)dot+=r[k*3+i]*r[k*3+j];if(Math.abs(dot-(i===j?1:0))>1e-5)wrong(where,name+' rotation must be orthonormal');}
          obb(s++,b.center,b.half,r,...surface(b,name));continue;
        }
        for(const a of ['X','Y','Z']){
          if(!finite(b['min'+a])||!finite(b['max'+a]))wrong(where,name+'.min'+a+' and max'+a+' must be finite numbers');
          if(!(b['min'+a]<=b['max'+a]))wrong(where,name+' needs min'+a+' <= max'+a);
        }
        put(s++,b.minX+0,b.minY+0,b.minZ+0,b.maxX+0,b.maxY+0,b.maxZ+0,...surface(b,name));
      }
      const slopes=[],T=C.floorThickness;
      for(let k=0;k<floors.length;k++){
        const f=floors[k],name='floors['+k+']',opt=v=>v===undefined?0:v;
        if(!f||typeof f!=='object')wrong(where,name+' must be an object');
        const v=[f.x,f.z,f.w,f.d,opt(f.y),opt(f.slopeX),opt(f.slopeZ)];
        if(!v.every(finite))wrong(where,name+': x, z, w, d, y, slopeX and slopeZ must be finite numbers');
        if(!(v[2]>0&&v[3]>0))wrong(where,name+' needs w > 0 and d > 0');
        if(v[5]!==0&&v[6]!==0)wrong(where,name+' slopes on two axes (one at most)');
        const [x,z,fw,fd,y]=v.map(u=>u+0),sf=surface(f,name);
        if(v[5]===0&&v[6]===0)put(s++,x-fw/2,y-T,z-fd/2,x+fw/2,y,z+fd/2,...sf);else slopes.push([x,z,fw,fd,y,v[5]+0,v[6]+0,sf]);
      }
      // Slope a on X, L = sqrt(1 + a^2): axes X = (1, a, 0)/L, Y = (-a, 1, 0)/L, Z = (0, 0, 1), half-sizes (w L/2, T/2, d/2);
      // slope c on Z: X = (1, 0, 0), Y = (0, 1, -c)/L, Z = (0, c, 1)/L, half-sizes (w/2, T/2, d L/2); centre (x, y, z) - Y T/2.
      for(const [x,z,fw,fd,y,a,c,sf] of slopes){
        const t=a||c,L=Math.sqrt(1+t*t),u=1/L,g=T/2*u;
        if(a)obb(s++,[x+a*g,y-g,z],[fw/2*L,T/2,fd/2],[u,-a*u,0,a*u,u,0,0,0,1],...sf);
        else obb(s++,[x,y-g,z+c*g],[fw/2,T/2,fd/2*L],[1,0,0,0,u,c*u,0,-c*u,u],...sf);
      }
      const same=(a,b)=>{for(let k=0;k<a.length;k++)if(!Object.is(a[k],b[k]))return false;return true;};
      if(decor&&n===NS&&same(nP,sP)&&same(nH,sH)&&same(nR,sR)&&same(nO,sO)&&same(nF,sF)&&same(nE,sE)&&same(nM,sM))return {statics:NS,merged:0,masked:0,woken:0};
      decor=true;NS=n;sP=nP;sH=nH;sR=nR;sA=nA;sF=nF;sE=nE;sO=nO;sM=nM;sT=new Int32Array(n);stamp=0;
      sStart.fill(0);
      for(let t=0;t<n;t++){cellRange(sA,t*6);for(let z=ISCR[2];z<=ISCR[3];z++)for(let x=ISCR[0];x<=ISCR[1];x++)sStart[z*GW+x+1]++;}
      for(let c=0;c<CELLS;c++)sStart[c+1]+=sStart[c];
      sItems=new Int32Array(sStart[CELLS]);
      const at=sStart.slice(0,CELLS);
      for(let t=0;t<n;t++){cellRange(sA,t*6);for(let z=ISCR[2];z<=ISCR[3];z++)for(let x=ISCR[0];x<=ISCR[1];x++)sItems[at[z*GW+x]++]=t;}
      let kept=0;
      for(let c=0;c<pn;c++){if(pK[c]-Math.floor(pK[c]/KM)*KM>=NB)continue;pK[kept]=pK[c];pI[kept]=pI[c];pJn[kept]=pJn[c];pJ1[kept]=pJ1[c];pJ2[kept]=pJ2[c];kept++;}
      pn=kept;tableBuild();
      let woken=0;
      for(let i=1;i<top;i++)if((FL[i]&(ALIVE|ASLEEP|PENDING))===(ALIVE|ASLEEP)){wake(i);woken++;}
      let h=fnv(2166136261,n);
      const words=a=>{const u=new Uint32Array(a.buffer);for(let k=0;k<u.length;k++)h=fnv(h,u[k]);};
      words(sP);words(sH);words(sR);for(let k=0;k<n;k++)h=fnv(h,sO[k]);words(sF);words(sE);for(let k=0;k<n;k++)h=fnv(h,sM[k]>>>0);
      w.staticsHash=(h>>>0).toString(16).padStart(8,'0');stats.statics=n;
      return {statics:n,merged:0,masked:0,woken};
    }

    // ---- Bodies (outside the step; may allocate): boxes, spheres and capsules, dynamic (awake, asleep or pending) or
    // kinematic (infinite mass, moved by setKinematic only, never pending nor asleep; vel and ang are not used).
    function addBody(d){
      const where='addBody';
      if(!d||typeof d!=='object')wrong(where,'description object required');
      const shape=d.shape===undefined?'box':d.shape,sh=SHAPES.indexOf(shape);
      if(sh<0)wrong(where,'shape must be box, sphere or capsule');
      // Real half-sizes and, for a round shape, its volume (capsule: pi r^2 (height - 2r) + 4/3 pi r^3).
      let size=null,hr,vol=0;
      if(sh===0){
        size=vec(where,'size',d.size,3);
        if(!(size[0]>0&&size[1]>0&&size[2]>0))wrong(where,'size must be > 0 on each axis');
        hr=[size[0]/2,size[1]/2,size[2]/2];
      }else{
        const r=d.radius,ht=sh===2?d.height:2*r;
        if(!finite(r)||!(r>0))wrong(where,'radius must be a number > 0');
        if(!finite(ht)||!(ht>=2*r))wrong(where,'height must be a number >= 2 radius');
        hr=[r+0,ht/2,r+0];vol=Math.PI*r*r*(ht-2*r)+4/3*Math.PI*r*r*r;
      }
      const pos=vec(where,'pos',d.pos,3);
      if(d.quat!==undefined&&d.rot!==undefined)wrong(where,'give quat or rot, not both');
      const q=d.rot!==undefined?(r=>eulerToQuat(r[0],r[1],r[2]))(vec(where,'rot',d.rot,3)):d.quat!==undefined?vec(where,'quat',d.quat,4):[0,0,0,1];
      const ql=Math.sqrt(q[0]*q[0]+q[1]*q[1]+q[2]*q[2]+q[3]*q[3]);
      if(!(ql>=1e-9))wrong(where,'quat must not be null');
      const vel=d.vel===undefined?[0,0,0]:vec(where,'vel',d.vel,3),ang=d.ang===undefined?[0,0,0]:vec(where,'ang',d.ang,3);
      const mat=materialOf(where,d.material);
      if(d.kinematic!==undefined&&typeof d.kinematic!=='boolean')wrong(where,'kinematic must be a boolean');
      const kin=d.kinematic===true;
      let mass=d.mass;
      if(mass===undefined){if(mat>=0){const D=MATERIALS[mat].density;mass=sh?D*vol:D*size[0]*size[1]*size[2];}else if(kin)mass=0;else wrong(where,'mass or material required');}
      else if(!finite(mass)||!(mass>0))wrong(where,'mass must be a number > 0');
      const fr=inRange(where,'friction',d.friction,mat<0?.6:MATERIALS[mat].friction,0,2),re=inRange(where,'restitution',d.restitution,mat<0?.1:MATERIALS[mat].restitution,0,1);
      const bits=(name,v,def)=>{if(v===undefined)return def;if(!Number.isInteger(v)||v<0||v>65535)wrong(where,name+' must be an integer from 0 to 65535');return v;};
      const grp=bits('group',d.group,2),msk=bits('mask',d.mask,65535);
      if(d.asleep!==undefined&&typeof d.asleep!=='boolean')wrong(where,'asleep must be a boolean');
      let i=1;while(i<NB&&(FL[i]&ALIVE))i++;
      if(i>=NB){stats.refused++;return -1;}
      const p=i*3,v=i*6,qi=i*4,rc=Math.max(hr[0],C.minHalf);
      SH[i]=sh;GRP[i]=grp;MSK[i]=msk;MAT[i]=mat;MO[i]=mass+0;IM[i]=kin?0:1/Math.min(Math.max(mass,C.massMin),C.massMax);FR[i]=fr;RE[i]=re;
      for(let k=0;k<3;k++){P[p+k]=pos[k];RP[p+k]=pos[k];HR[p+k]=hr[k];H[p+k]=sh?k===1?hr[1]-hr[0]+rc:rc:Math.max(hr[k],C.minHalf);}
      for(let k=0;k<4;k++){Q[qi+k]=q[k]/ql+0;PQ[qi+k]=Q[qi+k];}
      PP[p]=P[p];PP[p+1]=P[p+1];PP[p+2]=P[p+2];
      const l=Math.sqrt(vel[0]*vel[0]+vel[1]*vel[1]+vel[2]*vel[2]),a=Math.sqrt(ang[0]*ang[0]+ang[1]*ang[1]+ang[2]*ang[2]);
      const kl=kin?0:l>C.maxLinear?C.maxLinear/l:1,ka=kin?0:a>C.maxAngular?C.maxAngular/a:1;
      for(let k=0;k<3;k++){V[v+k]=vel[k]*kl+0;V[v+3+k]=ang[k]*ka+0;}
      ST[i]=0;AT[i]=0;FN[i]=0;KN[i]=0;for(let k=0;k<7;k++)KT[i*7+k]=0;
      inertia(i);tolerance(i);derive(i);
      need+=cellsOf(i);if(need>GE)entries(Math.max(need,2*GE));
      if(kin){FL[i]=ALIVE|KINEMATIC;stats.kinematic++;restDirty=true;}
      else if(d.asleep){FL[i]=ALIVE|ASLEEP;stats.sleeping++;restDirty=true;}else{FL[i]=ALIVE|PENDING;stats.pending++;}
      stats.bodies++;if(i+1>top)top=i+1;
      return GEN[i]*4096+i;
    }
    // Row of a live body handle gen*4096 + index, or 0 (stale, invalid or the world).
    function slot(h){
      if(typeof h!=='number'||!(h>=1&&h<=I32)||h!==Math.floor(h))return 0;
      const i=h&4095;
      return i<NB&&(FL[i]&ALIVE)&&GEN[i]===(h-i)/4096?i:0;
    }
    const valid=h=>slot(h)>0;
    const isAsleep=h=>{const i=slot(h);return i>0&&(FL[i]&ASLEEP)!==0;};
    const isLost=h=>{const i=slot(h);return i>0&&(FL[i]&LOST)!==0;};
    // Plain description of a body (tests, debugging; allocates). size = collision size (bounding box of a round body in
    // its frame), realSize = given size; radius and height as given (null for a box, height null for a sphere).
    function body(h){
      const i=slot(h);if(!i)return null;
      const p=i*3,v=i*6,f=FL[i],part=(A,k,n)=>Array.from(A.subarray(k,k+n));
      return {handle:h,shape:SHAPES[SH[i]],size:[2*H[p],2*H[p+1],2*H[p+2]],radius:SH[i]?HR[p]:null,height:SH[i]===2?2*HR[p+1]:null,realSize:[2*HR[p],2*HR[p+1],2*HR[p+2]],
        pos:part(P,p,3),quat:part(Q,i*4,4),vel:part(V,v,3),ang:part(V,v+3,3),mass:f&KINEMATIC?Infinity:Math.min(Math.max(MO[i],C.massMin),C.massMax),originalMass:MO[i],material:MAT[i],
        friction:FR[i],restitution:RE[i],group:GRP[i],mask:MSK[i],kinematic:(f&KINEMATIC)!==0,asleep:(f&ASLEEP)!==0,pending:(f&PENDING)!==0,
        lost:(f&LOST)!==0,hard:(f&HARD)!==0};
    }
    // Render pose [x, y, z, qx, qy, qz, qw]: PP..P and PQ..Q blended by alpha in [0, 1] (normalised, short arc),
    // raised by SL/2; for a box, the real shape sits on the bottom of its collision box (axis k: H_k > HR_k).
    function pose(h,alpha,out){
      const i=slot(h);if(!i)return null;
      if(!out)out=new Array(7);
      const a=alpha>0?(alpha<1?alpha:1):0,b=1-a,p=i*3,q=i*4;
      let x=PP[p]*b+P[p]*a,y=PP[p+1]*b+P[p+1]*a,z=PP[p+2]*b+P[p+2]*a;
      const t=PQ[q]*Q[q]+PQ[q+1]*Q[q+1]+PQ[q+2]*Q[q+2]+PQ[q+3]*Q[q+3]<0?-a:a;
      let qx=PQ[q]*b+Q[q]*t,qy=PQ[q+1]*b+Q[q+1]*t,qz=PQ[q+2]*b+Q[q+2]*t,qw=PQ[q+3]*b+Q[q+3]*t;
      const l=1/Math.sqrt(qx*qx+qy*qy+qz*qz+qw*qw);qx*=l;qy*=l;qz*=l;qw*=l;
      y+=SL[i]/2;
      if(SH[i]===0){
        // Columns of the blended rotation (local axes in the world) and their Y components.
        const c0x=1-2*(qy*qy+qz*qz),c0y=2*(qx*qy+qw*qz),c0z=2*(qx*qz-qw*qy),c1x=2*(qx*qy-qw*qz),c1y=1-2*(qx*qx+qz*qz),c1z=2*(qy*qz+qw*qx);
        const c2x=2*(qx*qz+qw*qy),c2y=2*(qy*qz-qw*qx),c2z=1-2*(qx*qx+qy*qy),d0=(H[p]-HR[p])*c0y,d1=(H[p+1]-HR[p+1])*c1y,d2=(H[p+2]-HR[p+2])*c2y;
        x-=c0x*d0+c1x*d1+c2x*d2;y-=c0y*d0+c1y*d1+c2y*d2;z-=c0z*d0+c1z*d1+c2z*d2;
      }
      out[0]=x;out[1]=y;out[2]=z;out[3]=qx;out[4]=qy;out[5]=qz;out[6]=qw;
      return out;
    }
    // Rotation of the current pose, row-major (column k = local axis k).
    function matrix(h,out){
      const i=slot(h);if(!i)return null;
      if(!out)out=new Array(9);
      for(let k=0;k<9;k++)out[k]=R[i*9+k];
      return out;
    }
    // Wake one body (never a whole island).
    function wake(i){FL[i]&=~ASLEEP;ST[i]=0;AT[i]=0;FN[i]=0;const p=i*3;RP[p]=P[p];RP[p+1]=P[p+1];RP[p+2]=P[p+2];stats.wakes++;stats.sleeping--;restDirty=true;}

    // ---- Actions (outside the step, no allocation). A pending body only has its kept velocity changed.
    // Speed caps: |v| <= maxLinear and |w| <= maxAngular (end of each sub-step, and after every action, so that a
    // snapshot taken between two steps always restores).
    function cap(i){
      const v=i*6,ml=SCR[15],ma=SCR[16],l2=V[v]*V[v]+V[v+1]*V[v+1]+V[v+2]*V[v+2],w2=V[v+3]*V[v+3]+V[v+4]*V[v+4]+V[v+5]*V[v+5];
      if(l2>ml*ml){const k=ml/Math.sqrt(l2);V[v]*=k;V[v+1]*=k;V[v+2]*=k;}
      if(w2>ma*ma){const k=ma/Math.sqrt(w2);V[v+3]*=k;V[v+4]*=k;V[v+5]*=k;}
    }
    // Impulse SCR[25..27] at the world point SCR[22..24] (prototype impulseAt): V += J*IM, W += IW*((p - P) x J), caps.
    function push(i){
      const p=i*3,v=i*6,im=IM[i],jx=SCR[25],jy=SCR[26],jz=SCR[27],rx=SCR[22]-P[p],ry=SCR[23]-P[p+1],rz=SCR[24]-P[p+2];
      const tx=ry*jz-rz*jy,ty=rz*jx-rx*jz,tz=rx*jy-ry*jx;
      V[v]+=jx*im;V[v+1]+=jy*im;V[v+2]+=jz*im;
      V[v+3]+=IW[v]*tx+IW[v+1]*ty+IW[v+2]*tz;V[v+4]+=IW[v+1]*tx+IW[v+3]*ty+IW[v+4]*tz;V[v+5]+=IW[v+2]*tx+IW[v+4]*ty+IW[v+5]*tz;
      cap(i);
    }
    // Explicit wake of an action: a sleeper wakes alone; an awake body restarts its sleep count (prototype wake).
    function rouse(i){if(FL[i]&ASLEEP)wake(i);else ST[i]=0;}
    const finite6=(a,b,c,d,e,f)=>finite(a)&&finite(b)&&finite(c)&&finite(d)&&finite(e)&&finite(f);
    // Row of the target of impulse or setVelocity (live, dynamic, not lost), or 0; non-finite numbers throw.
    function target(where,h,a,b,c,d,e,f){
      if(!finite6(a,b,c,d,e,f))wrong(where,'the six numbers after the handle must be finite');
      const i=slot(h);return i&&!(FL[i]&(KINEMATIC|LOST))?i:0;
    }
    // Impulse (jx, jy, jz) at the world point (px, py, pz); the body wakes. false: invalid handle, kinematic or lost.
    function impulse(h,px,py,pz,jx,jy,jz){
      const i=target('impulse',h,px,py,pz,jx,jy,jz);if(!i)return false;
      SCR[22]=px;SCR[23]=py;SCR[24]=pz;SCR[25]=jx;SCR[26]=jy;SCR[27]=jz;push(i);rouse(i);return true;
    }
    // Linear and angular velocities (world frame, capped); the body wakes. false as for impulse.
    function setVelocity(h,vx,vy,vz,wx,wy,wz){
      const i=target('setVelocity',h,vx,vy,vz,wx,wy,wz);if(!i)return false;
      const v=i*6;V[v]=vx+0;V[v+1]=vy+0;V[v+2]=vz+0;V[v+3]=wx+0;V[v+4]=wy+0;V[v+5]=wz+0;cap(i);rouse(i);return true;
    }
    // Target pose of a kinematic body (position, quaternion normalised) for the next step() call that runs sub-steps.
    // false: invalid handle or dynamic body; non-finite numbers or a null quaternion throw.
    function setKinematic(h,x,y,z,qx,qy,qz,qw){
      if(!finite6(x,y,z,qx,qy,qz)||!finite(qw))wrong('setKinematic','the seven numbers after the handle must be finite');
      const l=Math.sqrt(qx*qx+qy*qy+qz*qz+qw*qw);
      if(!(l>=1e-9))wrong('setKinematic','quaternion must not be null');
      const i=slot(h);if(!i||!(FL[i]&KINEMATIC))return false;
      const k=i*7;KT[k]=x+0;KT[k+1]=y+0;KT[k+2]=z+0;KT[k+3]=qx/l+0;KT[k+4]=qy/l+0;KT[k+5]=qz/l+0;KT[k+6]=qw/l+0;KN[i]=1;
      return true;
    }
    // Radial blast (prototype explode), for each live, active, dynamic body that is not lost, by increasing index: at the
    // body point nearest to the centre (distance d < radius), the impulse strength*(1 - d/radius), capped at maxDv times
    // the physical mass, along (body centre - centre + (0, 0.35, 0)) normalised; the body wakes alone. Returns the bodies
    // pushed. occlude (static boxes that shelter a body) comes with module step 7: until then every body in range is pushed.
    function blast(x,y,z,radius,strength,maxDv=14,occlude=true){
      if(!finite6(x,y,z,radius,strength,maxDv)||radius<0||strength<0||maxDv<0)wrong('blast','centre, radius, strength and maxDv must be finite, the last three >= 0');
      if(typeof occlude!=='boolean')wrong('blast','occlude must be a boolean');
      let n=0;
      for(let i=1;i<top;i++){
        if((FL[i]&(ALIVE|PENDING|KINEMATIC|LOST))!==ALIVE)continue;
        const p=i*3,r=i*9,hx=H[p],hy=H[p+1],hz=H[p+2],dx=x-P[p],dy=y-P[p+1],dz=z-P[p+2];
        let ax,ay,az;
        if(SH[i]===0){
          // Nearest point of the box: the centre in the local frame, clamped to the collision half-sizes.
          let lx=dx*R[r]+dy*R[r+3]+dz*R[r+6],ly=dx*R[r+1]+dy*R[r+4]+dz*R[r+7],lz=dx*R[r+2]+dy*R[r+5]+dz*R[r+8];
          lx=lx>hx?hx:lx<-hx?-hx:lx;ly=ly>hy?hy:ly<-hy?-hy:ly;lz=lz>hz?hz:lz<-hz?-hz:lz;
          ax=P[p]+R[r]*lx+R[r+1]*ly+R[r+2]*lz;ay=P[p+1]+R[r+3]*lx+R[r+4]*ly+R[r+5]*lz;az=P[p+2]+R[r+6]*lx+R[r+7]*ly+R[r+8]*lz;
        }else{
          // Round body: the segment point nearest to the centre, moved by the radius towards it (not when inside).
          const e=HR[p+1]-HR[p],t0=dx*R[r+1]+dy*R[r+4]+dz*R[r+7],t=t0>e?e:t0<-e?-e:t0,sx=P[p]+R[r+1]*t,sy=P[p+1]+R[r+4]*t,sz=P[p+2]+R[r+7]*t;
          const ux=x-sx,uy=y-sy,uz=z-sz,l=Math.sqrt(ux*ux+uy*uy+uz*uz),f=l>hx?hx/l:0;
          ax=sx+ux*f;ay=sy+uy*f;az=sz+uz*f;
        }
        const d=Math.sqrt((ax-x)*(ax-x)+(ay-y)*(ay-y)+(az-z)*(az-z));if(d>=radius)continue;
        let ex=P[p]-x,ey=P[p+1]-y+.35,ez=P[p+2]-z;const l=Math.sqrt(ex*ex+ey*ey+ez*ez);
        if(l<1e-6){ex=0;ey=1;ez=0;}else{ex/=l;ey/=l;ez/=l;}
        let j=strength*(1-d/radius);const c=maxDv/IM[i];if(j>c)j=c;
        SCR[22]=ax;SCR[23]=ay;SCR[24]=az;SCR[25]=ex*j;SCR[26]=ey*j;SCR[27]=ez*j;push(i);rouse(i);n++;
      }
      return n;
    }

    // ---- Step: whole sub-steps of tick seconds through an accumulator.
    function step(dt){
      if(typeof dt!=='number'||!(dt>=0)||dt===Infinity)wrong('step','dt must be a finite number >= 0');
      for(let i=1;i<top;i++)if(FL[i]&ALIVE){const p=i*3,q=i*4;PP[p]=P[p];PP[p+1]=P[p+1];PP[p+2]=P[p+2];PQ[q]=Q[q];PQ[q+1]=Q[q+1];PQ[q+2]=Q[q+2];PQ[q+3]=Q[q+3];}
      const t=SCR[9],e=t*1e-9;let a=WS[0]+dt,n=0;
      while(a>=t-e&&n<MAXSUB){a-=t;n++;}
      if(a>=t-e){const k=Math.floor(a/t+1e-9);stats.droppedSteps+=k;a-=k*t;}
      if(a<e)a=0;
      WS[0]=a;stats.substeps=n;
      if(n>0&&stats.kinematic>0)for(let i=1;i<top;i++)if((FL[i]&(ALIVE|KINEMATIC))===(ALIVE|KINEMATIC))steer(i,n);
      for(let s=0;s<n;s++)substep(s===n-1);
      return n;
    }
    // Kinematic body i for a call of n sub-steps (T = n tick): towards its pending target, v = (target - P)/T and
    // w = 2 dq.xyz/T with dq = target (x) conj(Q) on the short arc, both capped; without a target it stops (V = 0) and
    // joins the resting grid.
    function steer(i,n){
      const v=i*6,moving=FL[i]&MOVING;
      if(!KN[i]){if(moving){FL[i]&=~MOVING;V.fill(0,v,v+6);restDirty=true;}return;}
      KN[i]=0;if(!moving){FL[i]|=MOVING;restDirty=true;}
      const p=i*3,q=i*4,k=i*7,T=n*SCR[9],tx=KT[k+3],ty=KT[k+4],tz=KT[k+5],tw=KT[k+6],qx=Q[q],qy=Q[q+1],qz=Q[q+2],qw=Q[q+3];
      V[v]=(KT[k]-P[p])/T;V[v+1]=(KT[k+1]-P[p+1])/T;V[v+2]=(KT[k+2]-P[p+2])/T;
      const g=(tw*qw+tx*qx+ty*qy+tz*qz<0?-2:2)/T;
      V[v+3]=(tx*qw-tw*qx-ty*qz+tz*qy)*g;V[v+4]=(ty*qw-tw*qy+tx*qz-tz*qx)*g;V[v+5]=(tz*qw-tw*qz-tx*qy+ty*qx)*g;
      cap(i);
    }
    // Adds the time since the last clock mark to phase k (bench only, never read by the simulation).
    function phase(k){const t=clock();PH[k]+=t-SCR[13];SCR[13]=t;}
    function substep(last){
      if(clock)SCR[13]=clock();
      // 1. Activation of the pending bodies (module step 2a: all of them), by increasing index.
      if(stats.pending>0)for(let i=1;i<top;i++)if(FL[i]&PENDING){
        FL[i]&=~PENDING;ST[i]=0;AT[i]=0;FN[i]=0;const p=i*3;RP[p]=P[p];RP[p+1]=P[p+1];RP[p+2]=P[p+2];stats.pending--;if(FL[i]&ASLEEP)restDirty=true;
      }
      // 2. Active list: awake dynamic bodies (ACT 1) and moving kinematic bodies (ACT 2), by increasing index; nothing
      // active: leave (the cache is kept).
      let na=0,nk=0;
      for(let i=1;i<top;i++){
        const f=FL[i];
        if((f&(ALIVE|ASLEEP|PENDING|KINEMATIC|LOST))===ALIVE){AL[na++]=i;ACT[i]=1;}
        else if((f&(ALIVE|KINEMATIC|MOVING|LOST))===(ALIVE|KINEMATIC|MOVING)){AL[na++]=i;ACT[i]=2;nk++;}
      }
      if(na===0){stats.awake=0;stats.contacts=0;stats.manifolds=0;stats.tests=0;if(clock)phase(3);return;}
      if(clock)phase(3);
      collide(na);                                        // 3. broad and narrow phases
      if(clock)phase(0);
      prepare();                                          // 4.
      // 5. Velocities of the dynamic bodies: gravity and damping, plus rolling damping for a round body in contact.
      const ld=SCR[10],ad=SCR[11],gh=SCR[12],rd=SCR[28];
      for(let n=0;n<na;n++){
        const i=AL[n],v=i*6;if(ACT[i]!==1)continue;
        V[v]*=ld;V[v+1]=(V[v+1]+gh)*ld;V[v+2]*=ld;V[v+3]*=ad;V[v+4]*=ad;V[v+5]*=ad;
        if(SH[i]&&TOUCH[i]){V[v+3]*=rd;V[v+4]*=rd;V[v+5]*=rd;}
      }
      warm();                                             // 6.
      for(let it=0;it<ITER;it++)solve(true);      // 7.
      integrate(na,last);                                 // 8.
      relaxSeparation();
      for(let it=0;it<RELAX;it++)solve(false);// 9.
      restitution();                                      // 10.
      clamp(na);
      if(clock)phase(1);
      cacheStore();                                       // 14.
      if(nwake>0){for(let i=1;i<top;i++)if(WK[i]){WK[i]=0;if(FL[i]&ASLEEP){wake(i);TOUCH[i]=1;}}nwake=0;}   // 15. deferred wakes
      const slept=islands(na);                            // 17.
      if(clock)phase(2);
      for(let n=0;n<na;n++){                              // 20. -0 normalised, derived values
        const i=AL[n],p=i*3,q=i*4,v=i*6;
        P[p]+=0;P[p+1]+=0;P[p+2]+=0;Q[q]+=0;Q[q+1]+=0;Q[q+2]+=0;Q[q+3]+=0;V[v]+=0;V[v+1]+=0;V[v+2]+=0;V[v+3]+=0;V[v+4]+=0;V[v+5]+=0;
        derive(i);ACT[i]=0;
      }
      stats.awake=na-nk-slept;stats.contacts=nc;stats.manifolds=nm;
      if(clock)phase(3);
    }

    // ---- Broad phase: for each active body a, by increasing index, the cells of FB_a, z then x: statics (stamped; a
    // dynamic a only), active bodies b > a (never two kinematic ones), resting bodies (sleepers and stopped kinematic
    // bodies: immovable for the contact, a sleeper woken at the end of the sub-step; a moving kinematic a only marks the
    // sleepers it touches). A pair seen in several cells is tested in the cell of the low corner of the overlap only.
    function collide(na){
      nc=0;nm=0;let tests=0;
      const h=SCR[9],mg=SCR[14],lim=SCR[15];
      TOUCH.fill(0,0,top);
      for(let n=0;n<na;n++){
        const b=AL[n]*6,vx=Math.abs(V[b]),vy=Math.abs(V[b+1]),vz=Math.abs(V[b+2]);
        const ex=(vx<lim?vx:lim)*h+mg,ey=(vy<lim?vy:lim)*h+mg,ez=(vz<lim?vz:lim)*h+mg;
        FB[b]=BB[b]-ex;FB[b+1]=BB[b+1]-ey;FB[b+2]=BB[b+2]-ez;FB[b+3]=BB[b+3]+ex;FB[b+4]=BB[b+4]+ey;FB[b+5]=BB[b+5]+ez;
      }
      if(restDirty){
        gridClear(1);
        for(let i=top-1;i>=1;i--){
          const f=FL[i];
          if((f&(ALIVE|ASLEEP|PENDING|LOST))===(ALIVE|ASLEEP)||(f&(ALIVE|KINEMATIC|MOVING|LOST))===(ALIVE|KINEMATIC)){const b=i*6;for(let k=0;k<6;k++)FB[b+k]=BB[b+k];gridAdd(1,i);}
        }
        restDirty=false;
      }
      gridClear(0);for(let n=na-1;n>=0;n--)gridAdd(0,AL[n]);
      for(let n=0;n<na;n++){
        const a=AL[n],a6=a*6,a3=a*3,a9=a*9,kin=ACT[a]===2,speedA=Math.sqrt(V[a6]*V[a6]+V[a6+1]*V[a6+1]+V[a6+2]*V[a6+2]),marginA=mg+speedA*h;
        cellRange(FB,a6);const x0=ISCR[0],x1=ISCR[1],z0=ISCR[2],z1=ISCR[3];
        if(!kin&&MSK[a]&1){
          if(++stamp>1073741823){sT.fill(0);stamp=1;}
          for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){
            const c=z*GW+x;
            for(let q=sStart[c],e=sStart[c+1];q<e;q++){
              const s=sItems[q];if(sT[s]===stamp)continue;sT[s]=stamp;const s6=s*6;
              if(FB[a6]>sA[s6+3]||FB[a6+3]<sA[s6]||FB[a6+1]>sA[s6+4]||FB[a6+4]<sA[s6+1]||FB[a6+2]>sA[s6+5]||FB[a6+5]<sA[s6+2])continue;
              // A round body against a static: the static is the box A, then the normals are turned (body to static).
              tests++;SCR[0]=marginA;const k=SH[a]?turn(boxRound(sP,sH,s*3,sR,s*9,a)):boxBox(P,H,a3,R,a9,sP,sH,s*3,sR,s*9);
              if(k){SCR[3]=Math.sqrt(FR[a]*sF[s]);SCR[4]=RE[a]>sE[s]?RE[a]:sE[s];emit(a,0,a*KM+NB+s,k);}
            }
          }
        }
        for(let g=0;g<2;g++){
          const head=GH[g],next=GN[g],item=GI[g];
          for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++)for(let e=head[z*GW+x];e>=0;e=next[e]){
            const b=item[e];if(g===0&&b<=a)continue;const b6=b*6;
            if(FB[a6]>FB[b6+3]||FB[a6+3]<FB[b6]||FB[a6+1]>FB[b6+4]||FB[a6+4]<FB[b6+1]||FB[a6+2]>FB[b6+5]||FB[a6+5]<FB[b6+2])continue;
            if(cx(FB,FB[a6]>FB[b6]?a6:b6)!==x||cz(FB,FB[a6+2]>FB[b6+2]?a6+2:b6+2)!==z)continue;
            if(!(GRP[a]&MSK[b])||!(GRP[b]&MSK[a]))continue;
            if(kin&&(g||FL[b]&KINEMATIC)){if(g&&!(FL[b]&KINEMATIC)&&!WK[b]){WK[b]=1;nwake++;}continue;}
            tests++;const lo=a<b?a:b,hi=a<b?b:a,sb=Math.sqrt(V[b6]*V[b6]+V[b6+1]*V[b6+1]+V[b6+2]*V[b6+2]);
            SCR[0]=marginA+sb*h;const k=SH[lo]|SH[hi]?bodies(lo,hi):boxBox(P,H,lo*3,R,lo*9,P,H,hi*3,R,hi*9);
            if(k){SCR[3]=Math.sqrt(FR[a]*FR[b]);SCR[4]=RE[a]>RE[b]?RE[a]:RE[b];emit(lo,hi,lo*KM+hi,k);if(g===1&&!WK[b]&&!(FL[b]&KINEMATIC)){WK[b]=1;nwake++;}}
          }
        }
      }
      stats.tests=tests;
    }

    // ---- Narrow phase (prototype boxBox, face and clip, unchanged but for one normal per point): writes, for point k,
    // mN[3k..] (A to B), mP[3k..] (midpoint between the surfaces), mS[k] (separation), mI[k] (stable id); returns the
    // point count. Statics pass their own rotation.
    function clip(src,sid,n,dst,did,co,sg,li,plane){
      if(n===0)return 0;const lim=SCR[li];let m=0,pi=n-1,pd=sg*src[pi*3+co]-lim;
      for(let i=0;i<n;i++){
        const cd=sg*src[i*3+co]-lim;
        if(cd<=0){
          if(pd>0){const t=pd/(pd-cd),a=pi*3,b=i*3,d=m*3;dst[d]=src[a]+(src[b]-src[a])*t;dst[d+1]=src[a+1]+(src[b+1]-src[a+1])*t;dst[d+2]=src[a+2]+(src[b+2]-src[a+2])*t;did[m++]=64+((sid[pi]*31+sid[i]*17+plane*7)%191);}
          const b=i*3,d=m*3;dst[d]=src[b];dst[d+1]=src[b+1];dst[d+2]=src[b+2];did[m++]=sid[i];
        }else if(pd<=0){const t=pd/(pd-cd),a=pi*3,b=i*3,d=m*3;dst[d]=src[a]+(src[b]-src[a])*t;dst[d+1]=src[a+1]+(src[b+1]-src[a+1])*t;dst[d+2]=src[a+2]+(src[b+2]-src[a+2])*t;did[m++]=64+((sid[pi]*31+sid[i]*17+plane*7)%191);}
        pi=i;pd=cd;
      }
      return m;
    }
    // Reference box (PR, HF, r3, RR, r9) face `axis`; incident box (PI, HI, i3, RI, i9).
    function face(PR,HF,r3,RR,r9,PI,HI,i3,RI,i9,axis,flip){
      const margin=SCR[0];
      let nx=RR[r9+axis],ny=RR[r9+3+axis],nz=RR[r9+6+axis];
      const dx=PI[i3]-PR[r3],dy=PI[i3+1]-PR[r3+1],dz=PI[i3+2]-PR[r3+2],sgn=dx*nx+dy*ny+dz*nz>=0?1:-1;nx*=sgn;ny*=sgn;nz*=sgn;
      let jb=0,best=-1,sj=1;
      for(let j=0;j<3;j++){const d=nx*RI[i9+j]+ny*RI[i9+3+j]+nz*RI[i9+6+j],ad=Math.abs(d);if(ad>best){best=ad;jb=j;sj=d>0?-1:1;}}
      const j1=(jb+1)%3,j2=(jb+2)%3,e=HI[i3+jb]*sj,fx=dx+RI[i9+jb]*e,fy=dy+RI[i9+3+jb]*e,fz=dz+RI[i9+6+jb]*e;
      const h1=HI[i3+j1],h2=HI[i3+j2],ux=RI[i9+j1]*h1,uy=RI[i9+3+j1]*h1,uz=RI[i9+6+j1]*h1,wx=RI[i9+j2]*h2,wy=RI[i9+3+j2]*h2,wz=RI[i9+6+j2]*h2;
      const a1=(axis+1)%3,a2=(axis+2)%3,t1x=RR[r9+a1],t1y=RR[r9+3+a1],t1z=RR[r9+6+a1],t2x=RR[r9+a2],t2y=RR[r9+3+a2],t2z=RR[r9+6+a2],e1=HF[r3+a1],e2=HF[r3+a2],hn=HF[r3+axis];
      for(let k=0;k<4;k++){const s1=k===0||k===3?1:-1,s2=k<2?1:-1,vx=fx+s1*ux+s2*wx,vy=fy+s1*uy+s2*wy,vz=fz+s1*uz+s2*wz;clipA[k*3]=vx*t1x+vy*t1y+vz*t1z;clipA[k*3+1]=vx*t2x+vy*t2y+vz*t2z;clipA[k*3+2]=vx*nx+vy*ny+vz*nz-hn;idA[k]=jb*8+(sj>0?4:0)+k;}
      SCR[1]=e1;SCR[2]=e2;let n=clip(clipA,idA,4,clipB,idB,0,1,1,0);n=clip(clipB,idB,n,clipA,idA,0,-1,1,1);n=clip(clipA,idA,n,clipB,idB,1,1,2,2);n=clip(clipB,idB,n,clipA,idA,1,-1,2,3);
      let m=0;for(let i=0;i<n;i++)if(clipA[i*3+2]<=margin){clipB[m*3]=clipA[i*3];clipB[m*3+1]=clipA[i*3+1];clipB[m*3+2]=clipA[i*3+2];idB[m++]=idA[i];}
      if(m===0)return 0;
      let outCount=m;
      if(m>4){
        let a=0;for(let i=1;i<m;i++)if(clipB[i*3+2]<clipB[a*3+2])a=i;
        let b=-1,bd=-1;for(let i=0;i<m;i++){if(i===a)continue;const du=clipB[i*3]-clipB[a*3],dw=clipB[i*3+1]-clipB[a*3+1],d=du*du+dw*dw;if(d>bd){bd=d;b=i;}}
        const eu=clipB[b*3]-clipB[a*3],ew=clipB[b*3+1]-clipB[a*3+1];
        let c=-1,cd=0,d2=-1,dd=0;
        for(let i=0;i<m;i++){if(i===a||i===b)continue;const ar=eu*(clipB[i*3+1]-clipB[a*3+1])-ew*(clipB[i*3]-clipB[a*3]);if(ar>cd){cd=ar;c=i;}if(ar<dd){dd=ar;d2=i;}}
        pick[0]=a;pick[1]=b;outCount=2;if(c>=0)pick[outCount++]=c;if(d2>=0)pick[outCount++]=d2;
      }else for(let i=0;i<m;i++)pick[i]=i;
      const code=((flip?6:0)+axis*2+(sgn>0?1:0))*256,px=PR[r3],py=PR[r3+1],pz=PR[r3+2],gx=flip?-nx:nx,gy=flip?-ny:ny,gz=flip?-nz:nz;
      for(let k=0;k<outCount;k++){const i=pick[k],u=clipB[i*3],w=clipB[i*3+1],d=clipB[i*3+2],hgt=hn+d/2;mP[k*3]=px+u*t1x+w*t2x+hgt*nx;mP[k*3+1]=py+u*t1y+w*t2y+hgt*ny;mP[k*3+2]=pz+u*t1z+w*t2z+hgt*nz;mN[k*3]=gx;mN[k*3+1]=gy;mN[k*3+2]=gz;mS[k]=d;mI[k]=code+idB[i];}
      return outCount;
    }
    // Separating axes (3 + 3 faces, 9 edges): early out beyond the margin, faces preferred (0.95 x + 0.002 for B,
    // edges 0.95 x + 0.01), then face clipping or the closest points of the two supporting edges.
    function boxBox(PA,HA,a3,RA,a9,PB,HB,b3,RB,b9){
      const margin=SCR[0];
      const dx=PB[b3]-PA[a3],dy=PB[b3+1]-PA[a3+1],dz=PB[b3+2]-PA[a3+2];
      for(let i=0;i<3;i++){const ax=RA[a9+i],ay=RA[a9+3+i],az=RA[a9+6+i];tt[i]=dx*ax+dy*ay+dz*az;for(let j=0;j<3;j++){const v=ax*RB[b9+j]+ay*RB[b9+3+j]+az*RB[b9+6+j];cc[i*3+j]=v;qq[i*3+j]=Math.abs(v)+1e-9;}}
      const ha0=HA[a3],ha1=HA[a3+1],ha2=HA[a3+2],hb0=HB[b3],hb1=HB[b3+1],hb2=HB[b3+2];
      let bestA=-1e30,axisA=0,bestB=-1e30,axisB=0,bestE=-1e30,axisE=-1;
      for(let i=0;i<3;i++){const s=Math.abs(tt[i])-(HA[a3+i]+hb0*qq[i*3]+hb1*qq[i*3+1]+hb2*qq[i*3+2]);if(s>margin)return 0;if(s>bestA){bestA=s;axisA=i;}}
      for(let j=0;j<3;j++){const s=Math.abs(tt[0]*cc[j]+tt[1]*cc[3+j]+tt[2]*cc[6+j])-(HB[b3+j]+ha0*qq[j]+ha1*qq[3+j]+ha2*qq[6+j]);if(s>margin)return 0;if(s>bestB){bestB=s;axisB=j;}}
      for(let i=0;i<3;i++){
        const i1=(i+1)%3,i2=(i+2)%3;
        for(let j=0;j<3;j++){
          const c=cc[i*3+j],l2=1-c*c;if(l2<1e-6)continue;const j1=(j+1)%3,j2=(j+2)%3;
          const s=(Math.abs(tt[i2]*cc[i1*3+j]-tt[i1]*cc[i2*3+j])-(HA[a3+i1]*qq[i2*3+j]+HA[a3+i2]*qq[i1*3+j]+HB[b3+j1]*qq[i*3+j2]+HB[b3+j2]*qq[i*3+j1]))/Math.sqrt(l2);
          if(s>margin)return 0;if(s>bestE){bestE=s;axisE=i*3+j;}
        }
      }
      const useB=bestB>0.95*bestA+0.002,bestF=useB?bestB:bestA;
      if(axisE>=0&&bestE>0.95*bestF+0.01){
        const i=(axisE/3)|0,j=axisE-i*3,aix=RA[a9+i],aiy=RA[a9+3+i],aiz=RA[a9+6+i],bjx=RB[b9+j],bjy=RB[b9+3+j],bjz=RB[b9+6+j];
        let lx=aiy*bjz-aiz*bjy,ly=aiz*bjx-aix*bjz,lz=aix*bjy-aiy*bjx;const inv=1/Math.sqrt(lx*lx+ly*ly+lz*lz),sg=lx*dx+ly*dy+lz*dz<0?-inv:inv;lx*=sg;ly*=sg;lz*=sg;
        // Supporting edges: centre of the A edge farthest along +l, of the B edge farthest along -l.
        let ax=PA[a3],ay=PA[a3+1],az=PA[a3+2],bx=PB[b3],by=PB[b3+1],bz=PB[b3+2],bits=0;
        for(let k=0;k<3;k++){if(k!==i){const kx=RA[a9+k],ky=RA[a9+3+k],kz=RA[a9+6+k],s=lx*kx+ly*ky+lz*kz>0?HA[a3+k]:-HA[a3+k];ax+=kx*s;ay+=ky*s;az+=kz*s;bits=bits*2+(s>0?1:0);}}
        for(let k=0;k<3;k++){if(k!==j){const kx=RB[b9+k],ky=RB[b9+3+k],kz=RB[b9+6+k],s=lx*kx+ly*ky+lz*kz>0?-HB[b3+k]:HB[b3+k];bx+=kx*s;by+=ky*s;bz+=kz*s;bits=bits*2+(s>0?1:0);}}
        const rx=ax-bx,ry=ay-by,rz=az-bz,bq=cc[i*3+j],c=aix*rx+aiy*ry+aiz*rz,f=bjx*rx+bjy*ry+bjz*rz,den=1-bq*bq;
        let s=(bq*f-c)/den,u=(f-bq*c)/den;const la=HA[a3+i],lb=HB[b3+j];s=s>la?la:s<-la?-la:s;u=u>lb?lb:u<-lb?-lb:u;
        const p1x=ax+aix*s,p1y=ay+aiy*s,p1z=az+aiz*s,p2x=bx+bjx*u,p2y=by+bjy*u,p2z=bz+bjz*u;
        mP[0]=(p1x+p2x)/2;mP[1]=(p1y+p2y)/2;mP[2]=(p1z+p2z)/2;mS[0]=(p2x-p1x)*lx+(p2y-p1y)*ly+(p2z-p1z)*lz;mI[0]=4096+axisE*16+bits;mN[0]=lx;mN[1]=ly;mN[2]=lz;return 1;
      }
      return useB?face(PB,HB,b3,RB,b9,PA,HA,a3,RA,a9,axisB,true):face(PA,HA,a3,RA,a9,PB,HB,b3,RB,b9,axisA,false);
    }
    // Round shapes: a segment (local Y, half-length e = HR_y - HR_x, 0 for a sphere) swept by the collision radius H_x.
    // Ball SCR[33..35] of radius SCR[36] against box A: l = R^T (c - P), q = l clamped to [-H, H]; a centre inside leaves
    // by the face of least penetration H_k - |l_k| (x, then y, then z on ties). Point k (id) when s <= margin; returns 1
    // or 0. mP = midpoint between the box point P + R q and c - n r.
    function ball(PA,HA,a3,RA,a9,k,id){
      const r=SCR[36],cx=SCR[33],cy=SCR[34],cz=SCR[35],dx=cx-PA[a3],dy=cy-PA[a3+1],dz=cz-PA[a3+2],hx=HA[a3],hy=HA[a3+1],hz=HA[a3+2];
      const lx=dx*RA[a9]+dy*RA[a9+3]+dz*RA[a9+6],ly=dx*RA[a9+1]+dy*RA[a9+4]+dz*RA[a9+7],lz=dx*RA[a9+2]+dy*RA[a9+5]+dz*RA[a9+8];
      let qx=lx>hx?hx:lx<-hx?-hx:lx,qy=ly>hy?hy:ly<-hy?-hy:ly,qz=lz>hz?hz:lz<-hz?-hz:lz,nx=lx-qx,ny=ly-qy,nz=lz-qz,s;
      if(nx!==0||ny!==0||nz!==0){const d=Math.sqrt(nx*nx+ny*ny+nz*nz);nx/=d;ny/=d;nz/=d;s=d-r;}
      else{
        const ex=hx-Math.abs(lx),ey=hy-Math.abs(ly),ez=hz-Math.abs(lz);
        if(ex<=ey&&ex<=ez){nx=lx<0?-1:1;qx=nx*hx;s=-ex-r;}else if(ey<=ez){ny=ly<0?-1:1;qy=ny*hy;s=-ey-r;}else{nz=lz<0?-1:1;qz=nz*hz;s=-ez-r;}
      }
      if(s>SCR[0])return 0;
      const wx=RA[a9]*nx+RA[a9+1]*ny+RA[a9+2]*nz,wy=RA[a9+3]*nx+RA[a9+4]*ny+RA[a9+5]*nz,wz=RA[a9+6]*nx+RA[a9+7]*ny+RA[a9+8]*nz,m=k*3;
      mN[m]=wx;mN[m+1]=wy;mN[m+2]=wz;mS[k]=s;mI[k]=id;
      mP[m]=(PA[a3]+RA[a9]*qx+RA[a9+1]*qy+RA[a9+2]*qz+cx-wx*r)/2;
      mP[m+1]=(PA[a3+1]+RA[a9+3]*qx+RA[a9+4]*qy+RA[a9+5]*qz+cy-wy*r)/2;
      mP[m+2]=(PA[a3+2]+RA[a9+6]*qx+RA[a9+7]*qy+RA[a9+8]*qz+cz-wz*r)/2;
      return 1;
    }
    // Box A against the round body b: a sphere is one ball (id 1); a capsule tests its ends c + u e (id 1) and c - u e
    // (id 2), then, when fewer than two touch, the segment point nearest to the box (id 3; from the middle, three times:
    // clamp to the box, project on the segment; skipped when it is an end).
    function boxRound(PA,HA,a3,RA,a9,b){
      const p=b*3,r9=b*9,e=HR[p+1]-HR[p],ux=R[r9+1],uy=R[r9+4],uz=R[r9+7];SCR[36]=H[p];
      let n=0;
      for(let j=0;j<2;j++){
        const t=j?-e:e;SCR[33]=P[p]+ux*t;SCR[34]=P[p+1]+uy*t;SCR[35]=P[p+2]+uz*t;n+=ball(PA,HA,a3,RA,a9,n,j+1);
        if(e===0)return n;
      }
      if(n===2)return 2;
      const dx=P[p]-PA[a3],dy=P[p+1]-PA[a3+1],dz=P[p+2]-PA[a3+2],hx=HA[a3],hy=HA[a3+1],hz=HA[a3+2];
      const cx=dx*RA[a9]+dy*RA[a9+3]+dz*RA[a9+6],cy=dx*RA[a9+1]+dy*RA[a9+4]+dz*RA[a9+7],cz=dx*RA[a9+2]+dy*RA[a9+5]+dz*RA[a9+8];
      const vx=ux*RA[a9]+uy*RA[a9+3]+uz*RA[a9+6],vy=ux*RA[a9+1]+uy*RA[a9+4]+uz*RA[a9+7],vz=ux*RA[a9+2]+uy*RA[a9+5]+uz*RA[a9+8];
      let t=0;
      for(let it=0;it<3;it++){
        let x=cx+vx*t,y=cy+vy*t,z=cz+vz*t;x=x>hx?hx:x<-hx?-hx:x;y=y>hy?hy:y<-hy?-hy:y;z=z>hz?hz:z<-hz?-hz:z;
        t=(x-cx)*vx+(y-cy)*vy+(z-cz)*vz;t=t>e?e:t<-e?-e:t;
      }
      if(t===e||t===-e)return n;
      SCR[33]=P[p]+ux*t;SCR[34]=P[p+1]+uy*t;SCR[35]=P[p+2]+uz*t;return n+ball(PA,HA,a3,RA,a9,n,3);
    }
    // Ball SCR[29..31] (radius SCR[32]) against ball SCR[33..35] (radius SCR[36]): n = (cB - cA)/d, or (0, 1, 0) when
    // d < 1e-9; s = d - rA - rB; point cA + n (rA + s/2). Point k (id) when s <= margin; returns 1 or 0.
    function ballBall(k,id){
      const ax=SCR[29],ay=SCR[30],az=SCR[31],ra=SCR[32];let nx=SCR[33]-ax,ny=SCR[34]-ay,nz=SCR[35]-az;
      const d=Math.sqrt(nx*nx+ny*ny+nz*nz),s=d-ra-SCR[36];if(s>SCR[0])return 0;
      if(d<1e-9){nx=0;ny=1;nz=0;}else{nx/=d;ny/=d;nz/=d;}
      const m=k*3,g=ra+s/2;mN[m]=nx;mN[m+1]=ny;mN[m+2]=nz;mP[m]=ax+nx*g;mP[m+1]=ay+ny*g;mP[m+2]=az+nz*g;mS[k]=s;mI[k]=id;return 1;
    }
    // Round a against round b, shapes in order (a sphere is a segment of length 0): parameter s on A by the classical
    // clamped formula, B's point nearest to A(s), then ballBall (id 1). Nearly parallel segments (1 - (u.v)^2 < 1e-3):
    // the two ends of the part of A facing B (the ends of A when B covers them), each against its nearest point on B
    // (ids 1 and 2; one point when that part is a single end).
    function roundRound(a,b){
      const p=a*3,q=b*3,ea=HR[p+1]-HR[p],eb=HR[q+1]-HR[q],ux=R[a*9+1],uy=R[a*9+4],uz=R[a*9+7],vx=R[b*9+1],vy=R[b*9+4],vz=R[b*9+7];
      const wx=P[p]-P[q],wy=P[p+1]-P[q+1],wz=P[p+2]-P[q+2],k=ux*vx+uy*vy+uz*vz,c=ux*wx+uy*wy+uz*wz,f=vx*wx+vy*wy+vz*wz,den=1-k*k;
      SCR[32]=H[p];SCR[36]=H[q];
      let s0,s1;
      if(den<1e-3){const g=Math.abs(k)*eb;s0=-c-g;s1=-c+g;s0=s0>ea?ea:s0<-ea?-ea:s0;s1=s1>ea?ea:s1<-ea?-ea:s1;}
      else{s0=(k*f-c)/den;s0=s0>ea?ea:s0<-ea?-ea:s0;const t=k*s0+f;if(t>eb||t<-eb){s0=k*(t>eb?eb:-eb)-c;s0=s0>ea?ea:s0<-ea?-ea:s0;}s1=s0;}
      let n=0;
      for(let j=0;j<2;j++){
        const s=j?s1:s0;if(j&&s1===s0)break;
        let t=k*s+f;t=t>eb?eb:t<-eb?-eb:t;
        SCR[29]=P[p]+ux*s;SCR[30]=P[p+1]+uy*s;SCR[31]=P[p+2]+uz*s;SCR[33]=P[q]+vx*t;SCR[34]=P[q+1]+vy*t;SCR[35]=P[q+2]+vz*t;
        n+=ballBall(n,j+1);
      }
      return n;
    }
    // Body pair (lo, hi) with a round side, in shape order (box < sphere < capsule): a reversed pair is called as (hi, lo)
    // and its normals turned.
    function bodies(lo,hi){
      const a=SH[lo],b=SH[hi];
      if(a===0)return boxRound(P,H,lo*3,R,lo*9,hi);
      if(b===0)return turn(boxRound(P,H,hi*3,R,hi*9,lo));
      return a<=b?roundRound(lo,hi):turn(roundRound(hi,lo));
    }
    function turn(n){for(let k=0;k<3*n;k++)mN[k]=-mN[k];return n;}
    // Contacts of a pair (n points in mN, mP, mS, mI), warm-started from the cache by point id; TOUCH marks both sides.
    // Friction SCR[3] and restitution SCR[4]; a side that does not take part (world, sleeper, kinematic body) gets a zero
    // inverse mass.
    function emit(a,b,key,n){
      TOUCH[a]=1;TOUCH[b]=1;
      if(nc+n>MC){stats.dropContacts+=n;return;}
      prF[nm]=nc;prN[nm]=n;nm++;
      const friction=SCR[3],restitution=SCR[4],hit=pn?lookup(key):-1,from=hit>=0?TB[hit]-1:0,old=hit>=0?TC[hit]:0,a3=a*3,b3=b*3;
      const ima=ACT[a]?IM[a]:0,imb=ACT[b]?IM[b]:0,tol=SL[a]<SL[b]?SL[a]:SL[b];
      for(let k=0;k<n;k++){
        const c=nc++,c3=c*3,k3=k*3,id=mI[k];cA[c]=a;cB[c]=b;cK[c]=key;cI[c]=id;cN[c3]=mN[k3];cN[c3+1]=mN[k3+1];cN[c3+2]=mN[k3+2];
        cRA[c3]=mP[k3]-P[a3];cRA[c3+1]=mP[k3+1]-P[a3+1];cRA[c3+2]=mP[k3+2]-P[a3+2];cRB[c3]=mP[k3]-P[b3];cRB[c3+1]=mP[k3+1]-P[b3+1];cRB[c3+2]=mP[k3+2]-P[b3+2];
        cS[c]=mS[k];cFr[c]=friction;cRe[c]=restitution;cIa[c]=ima;cIb[c]=imb;cSl[c]=tol;cJn[c]=cJ1[c]=cJ2[c]=0;
        for(let m=0;m<old;m++)if(pI[from+m]===id){cJn[c]=pJn[from+m];cJ1[c]=pJ1[from+m];cJ2[c]=pJ2[from+m];break;}
      }
    }

    // ---- Solver (prototype, soft contact). An immovable side has zero inverse mass and zero angular response
    // (row 0 of IW is zero); its velocity is read, and the writes to it add exact zeros.
    function prepare(){
      for(let c=0;c<nc;c++){
        const a6=cA[c]*6,b6=cB[c]*6,c3=c*3,c6=c*6,ima=cIa[c],imb=cIb[c],ia=ima>0?a6:0,ib=imb>0?b6:0;
        const nx=cN[c3],ny=cN[c3+1],nz=cN[c3+2];
        // Tangent basis from the normal (sqrt only).
        let t1x,t1y,t1z;if(Math.abs(nx)<0.57735){const l=1/Math.sqrt(ny*ny+nz*nz);t1x=0;t1y=-nz*l;t1z=ny*l;}else{const l=1/Math.sqrt(nx*nx+nz*nz);t1x=nz*l;t1y=0;t1z=-nx*l;}
        const t2x=ny*t1z-nz*t1y,t2y=nz*t1x-nx*t1z,t2z=nx*t1y-ny*t1x;
        cT1[c3]=t1x;cT1[c3+1]=t1y;cT1[c3+2]=t1z;cT2[c3]=t2x;cT2[c3+1]=t2y;cT2[c3+2]=t2z;
        const rax=cRA[c3],ray=cRA[c3+1],raz=cRA[c3+2],rbx=cRB[c3],rby=cRB[c3+1],rbz=cRB[c3+2];
        for(let d=0;d<3;d++){
          const dx=d===0?nx:d===1?t1x:t2x,dy=d===0?ny:d===1?t1y:t2y,dz=d===0?nz:d===1?t1z:t2z,out=d===0?cAN:d===1?cA1:cA2;
          const ux=ray*dz-raz*dy,uy=raz*dx-rax*dz,uz=rax*dy-ray*dx,wx=rby*dz-rbz*dy,wy=rbz*dx-rbx*dz,wz=rbx*dy-rby*dx;
          const ax=IW[ia]*ux+IW[ia+1]*uy+IW[ia+2]*uz,ay=IW[ia+1]*ux+IW[ia+3]*uy+IW[ia+4]*uz,az=IW[ia+2]*ux+IW[ia+4]*uy+IW[ia+5]*uz;
          const bx=IW[ib]*wx+IW[ib+1]*wy+IW[ib+2]*wz,by=IW[ib+1]*wx+IW[ib+3]*wy+IW[ib+4]*wz,bz=IW[ib+2]*wx+IW[ib+4]*wy+IW[ib+5]*wz;
          out[c6]=ax;out[c6+1]=ay;out[c6+2]=az;out[c6+3]=bx;out[c6+4]=by;out[c6+5]=bz;
          const k=ima+imb+ux*ax+uy*ay+uz*az+wx*bx+wy*by+wz*bz,m=k>0?1/k:0;if(d===0)cMn[c]=m;else if(d===1)cM1[c]=m;else cM2[c]=m;
        }
        const dvx=V[b6]+V[b6+4]*rbz-V[b6+5]*rby-V[a6]-(V[a6+4]*raz-V[a6+5]*ray),dvy=V[b6+1]+V[b6+5]*rbx-V[b6+3]*rbz-V[a6+1]-(V[a6+5]*rax-V[a6+3]*raz),dvz=V[b6+2]+V[b6+3]*rby-V[b6+4]*rbx-V[a6+2]-(V[a6+3]*ray-V[a6+4]*rax);
        cV0[c]=dvx*nx+dvy*ny+dvz*nz;cMax[c]=0;
      }
    }
    function warm(){
      for(let c=0;c<nc;c++){
        const a6=cA[c]*6,b6=cB[c]*6,c3=c*3,c6=c*6,ima=cIa[c],imb=cIb[c],jn=cJn[c],j1=cJ1[c],j2=cJ2[c];
        const px=cN[c3]*jn+cT1[c3]*j1+cT2[c3]*j2,py=cN[c3+1]*jn+cT1[c3+1]*j1+cT2[c3+1]*j2,pz=cN[c3+2]*jn+cT1[c3+2]*j1+cT2[c3+2]*j2;
        V[a6]-=px*ima;V[a6+1]-=py*ima;V[a6+2]-=pz*ima;V[b6]+=px*imb;V[b6+1]+=py*imb;V[b6+2]+=pz*imb;
        V[a6+3]-=cAN[c6]*jn+cA1[c6]*j1+cA2[c6]*j2;V[a6+4]-=cAN[c6+1]*jn+cA1[c6+1]*j1+cA2[c6+1]*j2;V[a6+5]-=cAN[c6+2]*jn+cA1[c6+2]*j1+cA2[c6+2]*j2;
        V[b6+3]+=cAN[c6+3]*jn+cA1[c6+3]*j1+cA2[c6+3]*j2;V[b6+4]+=cAN[c6+4]*jn+cA1[c6+4]*j1+cA2[c6+4]*j2;V[b6+5]+=cAN[c6+5]*jn+cA1[c6+5]*j1+cA2[c6+5]*j2;
      }
    }
    // One pass: friction on the two tangents, then the normal. Separation: cS + cSl in the biased passes, cSR (after
    // the position update) in the relaxation; speculative (s > 0) bias s/h, otherwise the soft bias, capped by pushout.
    function solve(useBias){
      const invH=SCR[5],biasRate=SCR[6],massScale=SCR[7],impulseScale=SCR[8],pushout=SCR[17];
      for(let c=0;c<nc;c++){
        const a6=cA[c]*6,b6=cB[c]*6,c3=c*3,c6=c*6,ima=cIa[c],imb=cIb[c];
        let vax=V[a6],vay=V[a6+1],vaz=V[a6+2],wax=V[a6+3],way=V[a6+4],waz=V[a6+5],vbx=V[b6],vby=V[b6+1],vbz=V[b6+2],wbx=V[b6+3],wby=V[b6+4],wbz=V[b6+5];
        const rax=cRA[c3],ray=cRA[c3+1],raz=cRA[c3+2],rbx=cRB[c3],rby=cRB[c3+1],rbz=cRB[c3+2],maxF=cFr[c]*cJn[c];
        for(let d=0;d<2;d++){
          const T=d?cT2:cT1,AR=d?cA2:cA1,tx=T[c3],ty=T[c3+1],tz=T[c3+2];
          const dvx=vbx+wby*rbz-wbz*rby-vax-(way*raz-waz*ray),dvy=vby+wbz*rbx-wbx*rbz-vay-(waz*rax-wax*raz),dvz=vbz+wbx*rby-wby*rbx-vaz-(wax*ray-way*rax);
          const old=d?cJ2[c]:cJ1[c];let nj=old-(d?cM2[c]:cM1[c])*(dvx*tx+dvy*ty+dvz*tz);nj=nj>maxF?maxF:nj<-maxF?-maxF:nj;const j=nj-old;if(d)cJ2[c]=nj;else cJ1[c]=nj;
          vax-=tx*j*ima;vay-=ty*j*ima;vaz-=tz*j*ima;wax-=AR[c6]*j;way-=AR[c6+1]*j;waz-=AR[c6+2]*j;vbx+=tx*j*imb;vby+=ty*j*imb;vbz+=tz*j*imb;wbx+=AR[c6+3]*j;wby+=AR[c6+4]*j;wbz+=AR[c6+5]*j;
        }
        const nx=cN[c3],ny=cN[c3+1],nz=cN[c3+2],s=useBias?cS[c]+cSl[c]:cSR[c];
        let bias=0,ms=1,is=0;if(s>0)bias=s*invH;else if(useBias){bias=biasRate*s;if(bias<-pushout)bias=-pushout;ms=massScale;is=impulseScale;}
        const dvx=vbx+wby*rbz-wbz*rby-vax-(way*raz-waz*ray),dvy=vby+wbz*rbx-wbx*rbz-vay-(waz*rax-wax*raz),dvz=vbz+wbx*rby-wby*rbx-vaz-(wax*ray-way*rax);
        const old=cJn[c];let nj=old-cMn[c]*ms*(dvx*nx+dvy*ny+dvz*nz+bias)-is*old;if(nj<0)nj=0;const j=nj-old;cJn[c]=nj;if(nj>cMax[c])cMax[c]=nj;
        V[a6]=vax-nx*j*ima;V[a6+1]=vay-ny*j*ima;V[a6+2]=vaz-nz*j*ima;V[a6+3]=wax-cAN[c6]*j;V[a6+4]=way-cAN[c6+1]*j;V[a6+5]=waz-cAN[c6+2]*j;
        V[b6]=vbx+nx*j*imb;V[b6+1]=vby+ny*j*imb;V[b6+2]=vbz+nz*j*imb;V[b6+3]=wbx+cAN[c6+3]*j;V[b6+4]=wby+cAN[c6+4]*j;V[b6+5]=wbz+cAN[c6+5]*j;
      }
    }
    // Velocities capped (maxLinear, maxAngular), then positions and quaternions integrated (prototype); a moving
    // kinematic body ends the last sub-step of the call exactly on its target.
    function integrate(na,last){
      const h=SCR[9],ml=SCR[15],ma=SCR[16],ml2=ml*ml,ma2=ma*ma;
      for(let n=0;n<na;n++){
        const i=AL[n],v=i*6,p=i*3,q=i*4;
        if(last&&ACT[i]===2){const k=i*7;for(let j=0;j<3;j++)P[p+j]=KT[k+j];for(let j=0;j<4;j++)Q[q+j]=KT[k+3+j];continue;}
        let vx=V[v],vy=V[v+1],vz=V[v+2],wx=V[v+3],wy=V[v+4],wz=V[v+5];
        const l2=vx*vx+vy*vy+vz*vz;if(l2>ml2){const k=ml/Math.sqrt(l2);vx*=k;vy*=k;vz*=k;V[v]=vx;V[v+1]=vy;V[v+2]=vz;}
        const w2=wx*wx+wy*wy+wz*wz;if(w2>ma2){const k=ma/Math.sqrt(w2);wx*=k;wy*=k;wz*=k;V[v+3]=wx;V[v+4]=wy;V[v+5]=wz;}
        P[p]+=vx*h;P[p+1]+=vy*h;P[p+2]+=vz*h;
        const qx=Q[q],qy=Q[q+1],qz=Q[q+2],qw=Q[q+3],k=0.5*h;
        const nx=qx+k*(wx*qw+wy*qz-wz*qy),ny=qy+k*(wy*qw+wz*qx-wx*qz),nz=qz+k*(wz*qw+wx*qy-wy*qx),nw=qw-k*(wx*qx+wy*qy+wz*qz),inv=1/Math.sqrt(nx*nx+ny*ny+nz*nz+nw*nw);
        Q[q]=nx*inv;Q[q+1]=ny*inv;Q[q+2]=nz*inv;Q[q+3]=nw*inv;
      }
    }
    // Separation after the position update, for the relaxation: cS + (dB - dA).n + cSl, with d = v*h + (w*h) x r for a
    // body moved in this sub-step and 0 otherwise (the prototype's displacement D, computed once per point).
    function relaxSeparation(){
      const h=SCR[9];
      for(let c=0;c<nc;c++){
        const a=cA[c],b=cB[c],c3=c*3,rax=cRA[c3],ray=cRA[c3+1],raz=cRA[c3+2],rbx=cRB[c3],rby=cRB[c3+1],rbz=cRB[c3+2];
        let dax=0,day=0,daz=0,dbx=0,dby=0,dbz=0;
        if(ACT[a]){const v=a*6,lx=V[v]*h,ly=V[v+1]*h,lz=V[v+2]*h,wx=V[v+3]*h,wy=V[v+4]*h,wz=V[v+5]*h;dax=lx+wy*raz-wz*ray;day=ly+wz*rax-wx*raz;daz=lz+wx*ray-wy*rax;}
        if(ACT[b]){const v=b*6,lx=V[v]*h,ly=V[v+1]*h,lz=V[v+2]*h,wx=V[v+3]*h,wy=V[v+4]*h,wz=V[v+5]*h;dbx=lx+wy*rbz-wz*rby;dby=ly+wz*rbx-wx*rbz;dbz=lz+wx*rby-wy*rbx;}
        cSR[c]=cS[c]+(dbx-dax)*cN[c3]+(dby-day)*cN[c3+1]+(dbz-daz)*cN[c3+2]+cSl[c];
      }
    }
    // Bounce for the points that pushed and approached faster than restitutionThreshold (prototype).
    function restitution(){
      const threshold=SCR[18];
      for(let c=0;c<nc;c++){
        if(cRe[c]===0||cV0[c]>-threshold||cMax[c]===0)continue;
        const a6=cA[c]*6,b6=cB[c]*6,c3=c*3,c6=c*6,ima=cIa[c],imb=cIb[c],nx=cN[c3],ny=cN[c3+1],nz=cN[c3+2],rax=cRA[c3],ray=cRA[c3+1],raz=cRA[c3+2],rbx=cRB[c3],rby=cRB[c3+1],rbz=cRB[c3+2];
        const dvx=V[b6]+V[b6+4]*rbz-V[b6+5]*rby-V[a6]-(V[a6+4]*raz-V[a6+5]*ray),dvy=V[b6+1]+V[b6+5]*rbx-V[b6+3]*rbz-V[a6+1]-(V[a6+5]*rax-V[a6+3]*raz),dvz=V[b6+2]+V[b6+3]*rby-V[b6+4]*rbx-V[a6+2]-(V[a6+3]*ray-V[a6+4]*rax);
        const old=cJn[c];let nj=old-cMn[c]*(dvx*nx+dvy*ny+dvz*nz+cRe[c]*cV0[c]);if(nj<0)nj=0;const j=nj-old;cJn[c]=nj;
        V[a6]-=nx*j*ima;V[a6+1]-=ny*j*ima;V[a6+2]-=nz*j*ima;V[a6+3]-=cAN[c6]*j;V[a6+4]-=cAN[c6+1]*j;V[a6+5]-=cAN[c6+2]*j;V[b6]+=nx*j*imb;V[b6+1]+=ny*j*imb;V[b6+2]+=nz*j*imb;V[b6+3]+=cAN[c6+3]*j;V[b6+4]+=cAN[c6+4]*j;V[b6+5]+=cAN[c6+5]*j;
      }
    }
    // Velocity caps again after the bounce: |v| <= maxLinear and |w| <= maxAngular at the end of each sub-step.
    function clamp(na){for(let n=0;n<na;n++)cap(AL[n]);}
    // The points of this sub-step become the cache of the next one (-0 normalised); emptied only by setStatics and
    // restore, never when nothing is active.
    function cacheStore(){
      pn=nc;
      for(let c=0;c<nc;c++){pK[c]=cK[c];pI[c]=cI[c];pJn[c]=cJn[c]+0;pJ1[c]=cJ1[c]+0;pJ2[c]=cJ2[c]+0;}
      tableBuild();
    }
    // Islands of the dynamic participants (union-find over the pairs whose two sides take part; larger root under the
    // smaller), timers in whole sub-steps, and sleep of the islands whose smallest ST reached sleepSteps. Returns the
    // bodies put to sleep. Kinematic bodies (ACT 2) have neither island nor timers.
    function find(i){while(UF[i]!==i){UF[i]=UF[UF[i]];i=UF[i];}return i;}
    function islands(na){
      for(let n=0;n<na;n++){const i=AL[n];UF[i]=i;}
      for(let m=0;m<nm;m++){const c=prF[m],a=cA[c],b=cB[c];if(ACT[a]!==1||ACT[b]!==1)continue;const ra=find(a),rb=find(b);if(ra!==rb){if(ra<rb)UF[rb]=ra;else UF[ra]=rb;}}
      const l2=SCR[19],a2=SCR[20];
      for(let n=0;n<na;n++){
        const i=AL[n],v=i*6;if(ACT[i]!==1)continue;
        if(V[v]*V[v]+V[v+1]*V[v+1]+V[v+2]*V[v+2]<l2&&V[v+3]*V[v+3]+V[v+4]*V[v+4]+V[v+5]*V[v+5]<a2){if(ST[i]<I32)ST[i]++;}else ST[i]=0;
        if(AT[i]<I32)AT[i]++;IMIN[i]=I32;
      }
      for(let n=0;n<na;n++){const i=AL[n];if(ACT[i]!==1)continue;const r=find(i);if(ST[i]<IMIN[r])IMIN[r]=ST[i];}
      let slept=0;
      for(let n=0;n<na;n++){const i=AL[n];if(ACT[i]===1&&IMIN[find(i)]>=SCR[21]){FL[i]|=ASLEEP;const v=i*6;V[v]=V[v+1]=V[v+2]=V[v+3]=V[v+4]=V[v+5]=0;slept++;}}
      if(slept>0){stats.sleeping+=slept;restDirty=true;}
      return slept;
    }

    // ---- Save, restore, hash.
    // Plain JSON-safe object (no -0, finite numbers only); never changes the state.
    function snapshot(){
      const n=top,b={},copy=(a,m)=>{const out=new Array(m);for(let k=0;k<m;k++)out[k]=a[k]+0;return out;};
      for(let f=0;f<FIELDS.length;f++)b[FIELDS[f][0]]=copy(FIELDS[f][1],n*FIELDS[f][2]);
      return {v:2,fp,statics:w.staticsHash,acc:WS[0]+0,n,b,c:{n:pn,K:copy(pK,pn),I:copy(pI,pn),Jn:copy(pJn,pn),J1:copy(pJ1,pn),J2:copy(pJ2,pn)}};
    }
    // Validates everything first; at the first defect throws Error('FPhysics.restore: ...') and changes nothing.
    function restore(snap,opts){
      const no=text=>{throw new Error('FPhysics.restore: '+text);};
      if(!snap||typeof snap!=='object')no('snapshot object required');
      if(snap.v!==2)no('version '+snap.v+', expected 2');
      if(snap.fp!==fp)no('settings fingerprint '+snap.fp+' differs from '+fp);
      if(!(opts&&opts.ignoreStatics)&&snap.statics!==w.staticsHash)no('statics hash '+snap.statics+' differs from '+w.staticsHash);
      const n=snap.n;
      if(!Number.isInteger(n)||n<1||n>NB)no('n must be an integer from 1 to '+NB);
      if(!finite(snap.acc)||snap.acc<0||snap.acc>=C.tick)no('acc must be a number in [0, tick)');
      const b=snap.b;
      if(!b||typeof b!=='object')no('body arrays missing');
      for(let f=0;f<FIELDS.length;f++){
        const [name,,wd,low,high]=FIELDS[f],a=b[name];
        if(!Array.isArray(a)||a.length!==n*wd)no(name+' must be an array of '+n*wd+' numbers');
        for(let k=0;k<a.length;k++){
          const x=a[k];if(!finite(x))no(name+'['+k+'] is not a finite number');
          if(low!==undefined&&!(Number.isInteger(x)&&x>=low&&x<=high))no(name+'['+k+'] = '+x+' is not an integer from '+low+' to '+high);
        }
        for(let k=0;k<wd;k++)if(a[k]!==WORLD[f][k])no(name+' changes row 0, the world');
      }
      const live=j=>j>=1&&j<n&&(b.FL[j]&ALIVE)!==0;
      for(let i=1;i<n;i++){
        const fl=b.FL[i],p=i*3,q=i*4,v=i*6;
        if(!(fl&ALIVE)){if(fl!==0)no('free row '+i+' has flags '+fl);continue;}
        const kin=(fl&KINEMATIC)!==0,hr=b.HR,t=b.KT,k7=i*7;
        if(fl&(LOST|HARD))no('body '+i+' flags '+fl+' are not available yet');
        if(kin?fl&(ASLEEP|PENDING):fl&MOVING||b.KN[i])no('body '+i+' flags '+fl+' or target do not fit a '+(kin?'kinematic':'dynamic')+' body');
        for(let k=0;k<3;k++)if(!(b.H[p+k]>0&&b.H[p+k]>=C.minHalf-1e-12&&hr[p+k]>0))no('body '+i+' half-sizes out of range');
        // Round body: HR = (r, height/2, r), H = (rc, ., rc), a sphere with height/2 = r.
        if(b.SH[i]&&!(hr[p]===hr[p+2]&&hr[p+1]>=hr[p]&&b.H[p]===b.H[p+2]&&(b.SH[i]===2||hr[p+1]===hr[p])))no('body '+i+' sizes do not fit its shape');
        if(kin?b.IM[i]!==0:!(b.IM[i]>=1/C.massMax-1e-12&&b.IM[i]<=1/C.massMin+1e-12))no('body '+i+' inverse mass out of range');
        if(!((kin?b.MO[i]>=0:b.MO[i]>0)&&b.FR[i]>=0&&b.FR[i]<=2&&b.RE[i]>=0&&b.RE[i]<=1))no('body '+i+' mass, friction or restitution out of range');
        const qq=b.Q[q]*b.Q[q]+b.Q[q+1]*b.Q[q+1]+b.Q[q+2]*b.Q[q+2]+b.Q[q+3]*b.Q[q+3],tq=t[k7+3]*t[k7+3]+t[k7+4]*t[k7+4]+t[k7+5]*t[k7+5]+t[k7+6]*t[k7+6];
        if(!(qq>=1-2e-6&&qq<=1+2e-6))no('body '+i+' quaternion is not unit');
        if(b.KN[i]&&!(tq>=1-2e-6&&tq<=1+2e-6))no('body '+i+' target quaternion is not unit');
        const x=b.P[p],y=b.P[p+1],z=b.P[p+2];
        if(!(x>=minX-80&&x<=maxX+80&&z>=minZ-80&&z<=maxZ+80&&y>=C.minY-80&&y<=10000))no('body '+i+' position out of range');
        const l2=b.V[v]*b.V[v]+b.V[v+1]*b.V[v+1]+b.V[v+2]*b.V[v+2],w2=b.V[v+3]*b.V[v+3]+b.V[v+4]*b.V[v+4]+b.V[v+5]*b.V[v+5],ml=C.maxLinear*(1+1e-6),ma=C.maxAngular*(1+1e-6);
        if(!(l2<=ml*ml&&w2<=ma*ma))no('body '+i+' velocity out of range');
      }
      const c=snap.c;
      if(!c||typeof c!=='object')no('impulse cache missing');
      const m=c.n;
      if(!Number.isInteger(m)||m<0||m>MC)no('cache n must be an integer from 0 to '+MC);
      for(const name of ['K','I','Jn','J1','J2']){
        const a=c[name];if(!Array.isArray(a)||a.length!==m)no('cache '+name+' must be an array of '+m+' numbers');
        for(let k=0;k<m;k++)if(!finite(a[k]))no('cache '+name+'['+k+'] is not a finite number');
      }
      const keys=new Set();
      for(let k=0;k<m;k++){
        const key=c.K[k];
        if(!Number.isInteger(key)||key<0||key>I32)no('cache key '+key+' is not a pair key');
        if(k===0||key!==c.K[k-1]){
          if(keys.has(key))no('cache entries of key '+key+' are not contiguous');keys.add(key);
          const lo=Math.floor(key/KM),r=key-lo*KM;
          if(!live(lo)||(r<NB?!(r>lo&&live(r)):r-NB>=NS))no('cache key '+key+' names no live pair');
        }
        if(!Number.isInteger(c.I[k])||c.I[k]<0||c.I[k]>I32)no('cache point id '+c.I[k]+' out of range');
        if(!(c.Jn[k]>=0))no('cache normal impulse '+c.Jn[k]+' is negative');
      }
      // Valid: copy (-0 normalised), reset the rows above n, recompute the derived values.
      for(let f=0;f<FIELDS.length;f++){const a=FIELDS[f][1],src=b[FIELDS[f][0]];a.fill(a===MAT?-1:0);for(let k=0;k<src.length;k++)a[k]=src[k]+0;}
      for(const a of [R,IL,IW,BB,FB,SL,PP,PQ])a.fill(0);
      R[0]=R[4]=R[8]=1;SL[0]=C.slop;PQ[3]=1;
      top=n;need=0;stats.bodies=0;stats.sleeping=0;stats.pending=0;stats.kinematic=0;
      for(let i=1;i<n;i++)if(FL[i]&ALIVE){
        inertia(i);tolerance(i);derive(i);need+=cellsOf(i);stats.bodies++;
        if(FL[i]&KINEMATIC)stats.kinematic++;else if(FL[i]&PENDING)stats.pending++;else if(FL[i]&ASLEEP)stats.sleeping++;
        const p=i*3,q=i*4;PP[p]=P[p];PP[p+1]=P[p+1];PP[p+2]=P[p+2];PQ[q]=Q[q];PQ[q+1]=Q[q+1];PQ[q+2]=Q[q+2];PQ[q+3]=Q[q+3];
      }
      if(need>GE)entries(Math.max(need,2*GE));
      pn=m;for(let k=0;k<m;k++){pK[k]=c.K[k];pI[k]=c.I[k];pJn[k]=c.Jn[k]+0;pJ1[k]=c.J1[k]+0;pJ2[k]=c.J2[k]+0;}
      tableBuild();
      WS[0]=snap.acc+0;restDirty=true;
    }
    // FNV-1a over n, acc, the body arrays of rows 0 .. n-1 (snapshot order; floats by 32-bit words, integers as
    // v >>> 0), then the cache (n, K, I, Jn, J1, J2). 8 hex digits.
    function hash(){
      let h=fnv(2166136261,top);h=fnv(h,WSU[0]);h=fnv(h,WSU[1]);
      for(let f=0;f<FIELDS.length;f++){
        const a=FIELDS[f][1],u=VIEWS[f],m=top*FIELDS[f][2];
        if(u)for(let k=0;k<2*m;k++)h=fnv(h,u[k]);else for(let k=0;k<m;k++)h=fnv(h,a[k]>>>0);
      }
      h=fnv(h,pn);
      for(let k=0;k<pn;k++)h=fnv(h,pK[k]>>>0);
      for(let k=0;k<pn;k++)h=fnv(h,pI[k]>>>0);
      for(let j=0;j<3;j++){const u=CU[j];for(let k=0;k<2*pn;k++)h=fnv(h,u[k]);}
      return (h>>>0).toString(16).padStart(8,'0');
    }

    const w={config:C,fingerprint:fp,staticsHash:'',stats,phaseMs:PH,setStatics,updateStatics:setStatics,addBody,valid,isAsleep,isLost,body,
      impulse,setVelocity,setKinematic,blast,pose,matrix,step,snapshot,restore,hash};
    setStatics([],[]);
    return w;
  }
  // TRIG-BEGIN
  // Angle conversions, game convention: rotation [rx, ry, rz] with M = Rz*Ry*Rx (outside step only).
  function eulerToQuat(rx,ry,rz,out=[0,0,0,0]){
    const cx=Math.cos(rx/2),sx=Math.sin(rx/2),cy=Math.cos(ry/2),sy=Math.sin(ry/2),cz=Math.cos(rz/2),sz=Math.sin(rz/2);
    out[0]=cz*cy*sx-sz*sy*cx;out[1]=cz*sy*cx+sz*cy*sx;out[2]=sz*cy*cx-cz*sy*sx;out[3]=cz*cy*cx+sz*sy*sx;
    return out;
  }
  function quatToEuler(x,y,z,w,out=[0,0,0]){
    const r0=1-2*(y*y+z*z),r1=2*(x*y-w*z),r3=2*(x*y+w*z),r4=1-2*(x*x+z*z),r6=2*(x*z-w*y),r7=2*(y*z+w*x),r8=1-2*(x*x+y*y);
    const m=Math.max(-1,Math.min(1,-r6));
    out[1]=Math.asin(m);
    if(Math.abs(m)<.9999999){out[0]=Math.atan2(r7,r8);out[2]=Math.atan2(r3,r0);}
    else{out[0]=0;out[2]=Math.atan2(-r1,r4);}
    return out;
  }
  // TRIG-END
  G.FPhysics={VERSION:2,MATERIALS,create,eulerToQuat,quatToEuler};
})(typeof window!=='undefined'?window:globalThis);
