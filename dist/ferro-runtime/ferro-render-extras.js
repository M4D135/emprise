/* FERRO 0.3.2 — procedural engine. */
/* FERRO — physical canvas sizing and passive frame budget observations. */
(function(G){'use strict';
function create(canvas,{environment:w=G,limit=16384,maxPixels=8847360,scale=1}={}){
  let device=[1,1],requested=scale,observer=null,started=false;
  const stats={device,buffer:[canvas.width||1,canvas.height||1],scale:1,capped:null,changes:0};
  const bounded=v=>Number.isFinite(v)?Math.max(.5,Math.min(1,v)):1;
  requested=bounded(requested);limit=Number.isFinite(limit)&&limit>0?limit:16384;maxPixels=Number.isFinite(maxPixels)&&maxPixels>0?maxPixels:8847360;
  function measure(){
    const dpr=Math.max(.1,Number(w.devicePixelRatio)||1),r=canvas.getBoundingClientRect?.();
    device[0]=Math.max(1,r?Math.round(r.right*dpr)-Math.round(r.left*dpr):Math.round((canvas.clientWidth||w.innerWidth||800)*dpr));
    device[1]=Math.max(1,r?Math.round(r.bottom*dpr)-Math.round(r.top*dpr):Math.round((canvas.clientHeight||w.innerHeight||600)*dpr));
    return device;
  }
  function size(){
    let factor=requested,capped=null;
    const safety=Math.sqrt(maxPixels/(device[0]*device[1]));if(factor>safety){factor=safety;capped='safety';}
    const hardware=Math.min(limit/device[0],limit/device[1]);if(factor>hardware){factor=hardware;capped='gpu';}
    stats.scale=factor;stats.capped=capped;
    return {width:Math.max(1,Math.floor(device[0]*factor+.000001)),height:Math.max(1,Math.floor(device[1]*factor+.000001)),ratio:factor*(w.devicePixelRatio||1)};
  }
  function record(width,height){if(started&&(stats.buffer[0]!==width||stats.buffer[1]!==height))stats.changes++;started=true;stats.buffer[0]=width;stats.buffer[1]=height;}
  measure();
  if(w.ResizeObserver)try{observer=new w.ResizeObserver(entries=>{const e=entries.find(e=>e.target===canvas)||entries[0],box=e?.devicePixelContentBoxSize,b=box?.[0]||box;
    if(b&&Number.isFinite(b.inlineSize)&&Number.isFinite(b.blockSize)&&b.inlineSize>0&&b.blockSize>0){device[0]=Math.round(b.inlineSize);device[1]=Math.round(b.blockSize);}else measure();
  });try{observer.observe(canvas,{box:'device-pixel-content-box'});}catch{observer.observe(canvas);}}catch{observer=null;}
  return {stats,measure,size,record,setScale(value){requested=bounded(value);},dispose(){observer?.disconnect();}};
}
function budget({target=60,onBudget}={}){
  const samples=new Float64Array(240),sorted=new Float64Array(240),log=[],stats={target,p50:0,p95:0,over:0,sustained:false};let count=0,at=0,ticks=0,elapsed=0,lastCall=-Infinity,announced=false;
  function update(ms){
    if(!Number.isFinite(ms)||ms<=0||ms>=500)return stats;
    elapsed+=ms;samples[at]=ms;at=(at+1)%240;count=Math.min(240,count+1);if(++ticks%60)return stats;
    sorted.fill(Infinity);sorted.set(samples.subarray(0,count));sorted.sort();stats.p50=sorted[Math.floor((count-1)*.5)];stats.p95=sorted[Math.floor((count-1)*.95)];
    let over=0;for(let i=0;i<count;i++)if(samples[i]>1000/stats.target*1.5)over++;stats.over=over/count;stats.sustained=count===240&&stats.over>.2;
    if(!stats.sustained)announced=false;
    if(stats.sustained&&!announced&&elapsed-lastCall>=5000){announced=true;lastCall=elapsed;const entry={...stats,timeMs:elapsed};log.push(entry);if(log.length>32)log.shift();onBudget?.(entry);}
    return stats;
  }
  return {stats,log,update,setTarget(value){if(Number.isFinite(value)&&value>0)stats.target=value;}};
}
G.FSurface={create,budget};
})(typeof window!=='undefined'?window:globalThis);

(function(G){'use strict';
  // Opt-in instrumentation. No query or timing work is performed until create().
  function create(gl,options={}){
    const now=options.now||(()=>performance.now()),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2'),pending=[],history=[],limit=128;
    const stats={gpu:!!ext,frames:0,discarded:0,overflow:0,pending:0,history};
    let frame=0,active=null,row=null,omitted=new Set(options.omit||[]),disposed=false;
    function poll(){
      if(!ext)return;
      if(gl.getParameter(ext.GPU_DISJOINT_EXT)){
        for(const item of pending){gl.deleteQuery(item.query);item.row.valid=false;stats.discarded++;}pending.length=0;
      }else for(let i=0;i<pending.length;){
        const item=pending[i];
        if(frame-item.frame<2||!gl.getQueryParameter(item.query,gl.QUERY_RESULT_AVAILABLE)){i++;continue;}
        const ns=gl.getQueryParameter(item.query,gl.QUERY_RESULT);gl.deleteQuery(item.query);pending.splice(i,1);
        if(Number.isFinite(ns)&&ns>=0){item.row.gpu[item.name]=(item.row.gpu[item.name]||0)+ns/1e6;item.row.completed++;}else{item.row.valid=false;stats.discarded++;}
      }
      stats.pending=pending.length;
    }
    function start(){if(disposed)return;frame++;poll();row={frame,cpu:{},gpu:{},queries:0,completed:0,valid:true};history.push(row);if(history.length>240)history.shift();stats.frames=frame;}
    function begin(name){
      if(disposed||omitted.has(name)||omitted.has(name.replace(/\d+$/,'')))return false;
      if(active)throw new Error('Overlapping GPU profile passes');
      if(!row)start();active={name,time:now(),query:null,row,frame};
      if(ext&&pending.length<limit){const query=gl.createQuery();if(query){gl.beginQuery(ext.TIME_ELAPSED_EXT,query);active.query=query;row.queries++;}}else if(ext){stats.overflow++;row.valid=false;}
      return true;
    }
    function end(){if(!active)return;const item=active;active=null;item.row.cpu[item.name]=(item.row.cpu[item.name]||0)+Math.max(0,now()-item.time);if(item.query){gl.endQuery(ext.TIME_ELAPSED_EXT);pending.push(item);stats.pending=pending.length;}}
    function dispose(){if(disposed)return;end();for(const item of pending)gl.deleteQuery(item.query);pending.length=0;stats.pending=0;disposed=true;}
    return {start,begin,end,poll,dispose,stats,configure(value){omitted=new Set(value?.omit||[]);},reset(){end();for(const item of pending)gl.deleteQuery(item.query);pending.length=0;history.length=0;row=null;stats.pending=0;}};
  }
  G.FGPUProfile={create};
})(typeof window!=='undefined'?window:globalThis);

/* FERRO — FSky : ciel procédural en une seule passe plein écran, sans aucune texture. */
(function(G){
'use strict';
// --- Sources GLSL (référence validée) ---
const VERT=`#version 300 es
precision highp float;
out vec2 vUV;
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));vUV=p;gl_Position=vec4(p*2.-1.,1.,1.);}
`;
const FOG_GLSL=`uniform vec3 uFskyRay[30];
uniform vec3 uFskyMie[30];
uniform vec2 uFskyRefH;
uniform vec4 uFskyRef;
uniform vec4 uFskyGlow;
float fskyPhase(float mu,float g){float g2=g*g,k=1.+g2-2.*g*mu;return .1193662*(1.-g2)*(1.+mu*mu)/((2.+g2)*k*sqrt(k));}
vec3 fskyAtmos(vec3 d){
  float y=clamp(d.y,0.,1.),r=sqrt(y)*5.,l=length(d.xz),c=l>1e-5?clamp(dot(d.xz,uFskyRefH)/l,-1.,1.):1.,k=(1.-c)*2.;
  int r0=min(int(r),4),k0=min(int(k),3),i=r0*5+k0;float fr=r-float(r0),fk=k-float(k0);
  vec3 ray=mix(mix(uFskyRay[i],uFskyRay[i+1],fk),mix(uFskyRay[i+5],uFskyRay[i+6],fk),fr);
  vec3 mie=mix(mix(uFskyMie[i],uFskyMie[i+1],fk),mix(uFskyMie[i+5],uFskyMie[i+6],fk),fr);
  return ray+mie*fskyPhase(dot(d,uFskyRef.xyz),uFskyRef.w)+uFskyGlow.rgb*exp(-y*uFskyGlow.a);
}
vec3 fskyFog(vec3 d){vec2 h=d.xz;float l=length(h);h=l>1e-5?h/l:uFskyRefH;return fskyAtmos(vec3(h.x,0.,h.y));}
`;
const FRAG='#version 300 es\nprecision highp float;\nprecision highp int;\n'+FOG_GLSL+`in vec2 vUV;
uniform vec3 uFskyRight;
uniform vec3 uFskyUp;
uniform vec3 uFskyForward;
uniform vec2 uFskyFov;
uniform float uFskyTime;
uniform float uFskyPixel;
uniform vec4 uFskyPost;
uniform vec3 uFskySun;
uniform vec4 uFskySunDisc;
uniform vec3 uFskyMoon;
uniform vec4 uFskyMoonDisc;
uniform vec3 uFskyMoonRight;
uniform vec3 uFskyMoonUp;
uniform vec4 uFskyCloud;
uniform vec4 uFskyCloud2;
uniform vec3 uFskyCloudSun;
uniform vec3 uFskyCloudAmb;
uniform vec4 uFskyWind;
uniform vec4 uFskySeed;
uniform vec4 uFskyStars;
uniform vec4 uFskyHorizon;
uniform vec4 uFskyLayers;
out vec4 fragColor;
float fskyHash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float fskyNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(fskyHash(i),fskyHash(i+vec2(1.,0.)),f.x),mix(fskyHash(i+vec2(0.,1.)),fskyHash(i+vec2(1.,1.)),f.x),f.y);}
float fskyFbm(vec2 p,int n){float s=0.,a=.5,w=0.;for(int i=0;i<4;i++){if(i>=n)break;s+=a*fskyNoise(p);w+=a;p=mat2(1.6,1.2,-1.2,1.6)*p+vec2(17.3,9.1);a*=.5;}return s/w;}
uvec3 fskyPcg(uvec3 v){v=v*1664525u+1013904223u;v.x+=v.y*v.z;v.y+=v.z*v.x;v.z+=v.x*v.y;v^=v>>16u;v.x+=v.y*v.z;v.y+=v.z*v.x;v.z+=v.x*v.y;return v;}
float fskyHG(float mu,float g){float g2=g*g,k=1.+g2-2.*g*mu;return .0795775*(1.-g2)/(k*sqrt(k));}
void main(){
  vec2 uv=vUV*2.-1.;
  vec3 d=normalize(uFskyForward+uFskyRight*uv.x*uFskyFov.x+uFskyUp*uv.y*uFskyFov.y);
  vec3 col;float mask=0.;
  if(d.y<=0.)col=fskyFog(d);
  else{
    vec3 sky=fskyAtmos(d);col=sky;
    vec3 cc=vec3(0.);float ca=0.;
    if(uFskyLayers.x>0.&&(uFskyCloud.x>0.||uFskyCloud2.z>0.)){
      vec2 p=d.xz/(d.y+uFskyCloud2.w)*uFskyCloud.w;
      p=vec2(dot(p,uFskyWind.zw),dot(p,vec2(-uFskyWind.w,uFskyWind.z)));
      p.x=p.x/uFskyCloud2.x+uFskyWind.x*uFskyTime;p+=uFskySeed.xy;
      float mu=dot(d,uFskyRef.xyz),fade=smoothstep(0.,.08,d.y);
      if(uFskyCloud.x>0.){
        float n=fskyFbm(p,4),th=1.-uFskyCloud.x;
        ca=smoothstep(th-uFskyCloud.y,th+uFskyCloud.y,n)*uFskyCloud.z*fade*uFskyLayers.x;
        if(ca>.002){
          float thick=clamp((n-th)/max(1.-th,.05),0.,1.);
          vec2 sd=vec2(dot(uFskyRefH,uFskyWind.zw),dot(uFskyRefH,vec2(-uFskyWind.w,uFskyWind.z)));
          float ns=fskyFbm(p+sd*.35,2),lit=clamp(.62+(n-ns)*2.6,.12,1.);
          cc=uFskyCloudAmb*(1.-uFskyCloud2.y*thick)+uFskyCloudSun*lit*(.35+2.2*fskyHG(mu,.6));
          cc=mix(cc,sky,(1.-smoothstep(0.,.35,d.y))*.55);
        }
      }
      if(uFskyCloud2.z>0.){
        float v=fskyFbm(p*vec2(.6,1.5)+vec2(31.,7.),2),va=smoothstep(.3,.9,v)*uFskyCloud2.z*.5*fade*uFskyLayers.x;
        vec3 vc=mix(uFskyCloudAmb,uFskyCloudSun*(.5+2.*fskyHG(mu,.7)),.6);
        cc=mix(vc,cc,ca);ca=ca+va*(1.-ca);
      }
    }
    if(uFskyLayers.y>0.){
      float cs=cos(uFskySeed.z),sn=sin(uFskySeed.z);vec3 q=vec3(cs*d.x-sn*d.z,d.y,sn*d.x+cs*d.z);
      if(uFskyStars.x>0.){
        vec3 a=abs(q);vec2 f;float face;
        if(a.x>=a.y&&a.x>=a.z){f=q.yz/a.x;face=q.x>0.?0.:1.;}else if(a.y>=a.z){f=q.xz/a.y;face=q.y>0.?2.:3.;}else{f=q.xy/a.z;face=q.z>0.?4.:5.;}
        vec2 g=(f*.5+.5)*160.,cell=floor(g);
        uvec3 h=fskyPcg(uvec3(uvec2(cell),uint(face)+uint(uFskySeed.w)*6u));
        vec3 rnd=vec3(h>>8u)*(1./16777216.);
        if(rnd.x<uFskyStars.y){
          vec2 cpos=cell+.15+.7*rnd.yz;float px=uFskyPixel*80.*(1.+dot(f,f)),rad=max(px*.75,.04);
          float m=rnd.x/uFskyStars.y,b=.12+2.6*pow(1.-m,7.);
          float s=exp(-dot(g-cpos,g-cpos)/(rad*rad))*b*min(1.,(.08*.08)/(rad*rad));
          col+=mix(vec3(1.,.82,.66),vec3(.72,.84,1.),rnd.z)*s*uFskyStars.x*smoothstep(0.,.25,d.y);
        }
      }
      if(uFskyStars.z>0.){
        float bt=dot(q,vec3(.35,.48,.80))/.22,band=exp(-bt*bt);
        col+=vec3(.55,.62,.8)*band*(.35+.65*fskyFbm(q.xz*9.+q.y*3.,3))*uFskyStars.z*.07*smoothstep(0.,.3,d.y);
      }
      if(uFskyMoonDisc.a>0.){
        vec3 dm=d-uFskyMoon;float t=length(dm)/uFskyMoonDisc.a;
        if(t<1.){
          vec2 q2=vec2(dot(dm,uFskyMoonRight),dot(dm,uFskyMoonUp))/uFskyMoonDisc.a;float z=sqrt(max(0.,1.-dot(q2,q2)));
          vec3 n=q2.x*uFskyMoonRight+q2.y*uFskyMoonUp-z*uFskyMoon;
          float lit=smoothstep(-.06,.12,dot(n,uFskySun)),maria=fskyFbm(q2*2.2+7.,3),alb=mix(.6,1.,smoothstep(.38,.62,maria));
          float w=min(.5,1.5*uFskyPixel/uFskyMoonDisc.a);
          col+=uFskyMoonDisc.rgb*alb*(lit+.03)*(1.-smoothstep(1.-w,1.,t));
        }
        col+=uFskyMoonDisc.rgb*.012*exp(-max(t-1.,0.)*.9);
      }
    }
    if(uFskyLayers.z>0.&&uFskySunDisc.a>0.){
      float t=length(d-uFskySun)/uFskySunDisc.a;
      if(t<1.){float z=sqrt(max(0.,1.-t*t)),w=min(.5,1.5*uFskyPixel/uFskySunDisc.a),e=1.-smoothstep(1.-w,1.,t);
        col+=uFskySunDisc.rgb*(1.-vec3(.5,.62,.78)*(1.-z))*e*smoothstep(0.,.01,d.y);mask=e;}
    }
    col=mix(col,cc,ca);mask*=1.-ca;
    if(uFskyLayers.w>0.&&d.y<uFskyHorizon.x){
      vec2 hz=normalize(d.xz)+uFskySeed.z;
      float far=uFskyHorizon.x*(.2+.8*(fskyNoise(hz*5.)*.75+fskyNoise(hz*13.+3.)*.25));
      float near=uFskyHorizon.y*(fskyNoise(hz*7.+11.)*.8+fskyNoise(hz*19.+5.)*.2);
      float aa=uFskyPixel*1.5;vec3 fog=fskyFog(d);
      col=mix(col,mix(fog,sky,uFskyHorizon.z),1.-smoothstep(far-aa,far+aa,d.y));
      col=mix(col,fog*uFskyHorizon.w,1.-smoothstep(near-aa,near+aa,d.y));
      mask*=smoothstep(far-aa,far+aa,d.y);
    }
  }
  col=col/(col+.76);col=pow(max(col,vec3(0.)),vec3(.4545));
  float v=pow(max(0.,16.*vUV.x*vUV.y*(1.-vUV.x)*(1.-vUV.y)),.13);col*=mix(uFskyPost.x,1.,v);
  col+=(fskyHash(gl_FragCoord.xy)+fskyHash(gl_FragCoord.xy+vec2(113.5,37.25))-1.)/255.*uFskyPost.y;
  fragColor=vec4(col,mix(1.,mask,uFskyPost.z));
}
`;
// --- Uniformes : nom -> [type, nombre, genre] ; listes « Nom:composantes[:nombre] », préfixe uFsky ---
const UNIFORMS={};
for(const[g,l]of[['monde','Ray:3:30 Mie:3:30 RefH:2 Ref:4 Glow:4 Sun:3 SunDisc:4 Moon:3 MoonDisc:4 MoonRight:3 MoonUp:3 Cloud:4 Cloud2:4 CloudSun:3 CloudAmb:3 Wind:4 Seed:4 Stars:4 Horizon:4'],
 ['image','Right:3 Up:3 Forward:3 Fov:2 Time:1 Pixel:1 Post:4 Layers:4']])
 for(const u of l.split(' ')){const[n,t,c=1]=u.split(':');UNIFORMS['uFsky'+n]=[t>1?'vec'+t:'float',+c,g];}
// --- Préréglage par défaut, normalisation, validation ---
const defaults={sun:{el:30,az:0,size:.7,bright:8},moon:{el:-30,az:180,size:.6,bright:3},turbidity:2,absorb:.1,tint:[1,1,1],g:.8,rayleigh:1,ozone:1,multi:.25,key:.25,grade:[1,1,1],floor:[0,0,0],
  clouds:{cover:.35,soft:.18,opacity:.95,scale:1,stretch:1,dark:.5,veil:0,curve:.15,tint:[1,1,1]},wind:{dir:30,speed:1},stars:0,milky:0,glow:{color:[1,.4,.1],strength:0,width:6},horizon:{far:.07,near:.035,mix:.5,dark:1},seed:7};
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k),isObj=v=>Object.prototype.toString.call(v)==='[object Object]';
const dup=v=>Array.isArray(v)?v.slice():v,txt=v=>{try{return String(v);}catch(_){return typeof v;}};
// Fusion clé à clé avec d : une valeur fournie reste telle quelle, même invalide, pour que validate la juge ;
// tableaux copiés, clés inconnues recopiées, undefined vaut absent.
function merge(d,s){const o={};
 for(const k of Object.keys(d)){const x=d[k],v=s[k];o[k]=isObj(x)&&(v===undefined||isObj(v))?merge(x,v||{}):dup(v===undefined?x:v);}
 for(const k of Object.keys(s))if(!own(d,k)&&s[k]!==undefined)o[k]=dup(s[k]);
 return o;}
function normalize(p){return merge(defaults,isObj(p)?p:{});}
// Bornes inclusives : [min,max] pour un nombre, [min,max,3] pour un triplet ; un objet décrit un sous-objet.
const BORNES={sun:{el:[-90,90],az:[-360,360],size:[.1,5],bright:[0,50]},moon:{el:[-90,90],az:[-360,360],size:[.1,6],bright:[0,20]},
 turbidity:[.5,15],absorb:[0,.95],tint:[0,2,3],g:[0,.95],rayleigh:[.1,4],ozone:[0,4],multi:[0,1],key:[.005,.6],grade:[.2,2.5,3],floor:[0,.1,3],
 clouds:{cover:[0,1],soft:[.01,.6],opacity:[0,1],scale:[.1,5],stretch:[1,8],dark:[0,1],veil:[0,1],curve:[.02,.6],tint:[0,2,3]},
 wind:{dir:[-360,360],speed:[0,10]},stars:[0,1],milky:[0,1],glow:{color:[0,2,3],strength:[0,1],width:[1,45]},
 horizon:{far:[0,.2],near:[0,.15],mix:[0,1],dark:[0,2]},seed:[0,65535]};
function validate(p){
 if(!isObj(p))return['preset: objet attendu'];
 const q=normalize(p),e=[],h=q.horizon,hors=(n,v,b)=>{if(v<b[0]||v>b[1])e.push(n+': hors bornes ['+b[0]+','+b[1]+'] ('+v+')');};
 // Un sous-objet qui n'en est pas un est signalé une fois, sans descendre dedans.
 const walk=(o,b,pre)=>{for(const k of Object.keys(o))if(!own(b,k)&&(pre||k!=='id'&&k!=='name'))e.push(pre+k+': clé inconnue');
  for(const k of Object.keys(b)){const v=o[k],x=b[k],n=pre+k;
   if(!Array.isArray(x)){if(isObj(v))walk(v,x,n+'.');else e.push(n+': objet attendu ('+txt(v)+')');}
   else if(!x[2]){if(Number.isFinite(v))hors(n,v,x);else e.push(n+': nombre fini attendu ('+txt(v)+')');}
   else if(Array.isArray(v)&&v.length===3&&[0,1,2].every(i=>Number.isFinite(v[i])))v.forEach((c,i)=>hors(n+'['+i+']',c,x));
   else e.push(n+': 3 nombres finis attendus ('+txt(v)+')');}};
 walk(q,BORNES,'');
 if(Number.isFinite(q.seed)&&!Number.isInteger(q.seed))e.push('seed: entier attendu ('+q.seed+')');
 if(own(q,'id')&&!(typeof q.id==='string'&&/^[a-z0-9]+(-[a-z0-9]+)*$/.test(q.id)))e.push('id: chaîne « mot[-mot] » attendue ('+txt(q.id)+')');
 if(own(q,'name')&&!(typeof q.name==='string'&&q.name.length>=1&&q.name.length<=40))e.push('name: chaîne de 1 à 40 caractères attendue ('+txt(q.name)+')');
 if(isObj(h)&&Number.isFinite(h.near)&&Number.isFinite(h.far)&&h.near>h.far)e.push('horizon: near ('+h.near+') doit rester ≤ far ('+h.far+')');
 return e;
}
// --- Physique de diffusion (Rayleigh, Mie, ozone, sphère terrestre) et résolution ---
const{PI,sin,cos,tan,sqrt,exp,hypot,min,max,floor,round,atan2,acos,abs,pow,imul}=Math;
// km : sol, sommet, observateur ; coefficients par km (Hillaire).
const RAD=PI/180,R=6360,TOP=6460,H0=.2,BR=[5.802e-3,13.558e-3,33.1e-3],BO=[.65e-3,1.881e-3,.085e-3],BM=3.996e-3,K3=[0,1,2];
const direction=(el,az)=>{const e=el*RAD,a=az*RAD;return[cos(e)*sin(a),sin(e),-cos(e)*cos(a)];};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function sphere(o,d,r){const b=o[0]*d[0]+o[1]*d[1]+o[2]*d[2],c=o[0]*o[0]+o[1]*o[1]+o[2]*o[2]-r*r,h=b*b-c;if(h<0)return null;const s=sqrt(h);return[-b-s,-b+s];}
function coeffs(p){const mext=BM*1.11*p.turbidity;return{ray:BR.map(v=>v*p.rayleigh),mext,msca:K3.map(k=>mext*(1-p.absorb)*p.tint[k]),oz:BO.map(v=>v*p.ozone)};}
const dens=h=>[exp(-h/8),exp(-h/1.2),max(0,1-abs(h-25)/15)];
// Épaisseur optique de o vers s, null si le sol la coupe.
function depthTo(o,s,c){const g=sphere(o,s,R);if(g&&g[0]>0)return null;const L=sphere(o,s,TOP)[1],od=[0,0,0];
 for(let i=0;i<12;i++){const a=i/12,b=(i+1)/12,t0=L*a*a,t1=L*b*b,tm=(t0+t1)/2,e=dens(hypot(o[0]+s[0]*tm,o[1]+s[1]*tm,o[2]+s[2]*tm)-R);
  for(let k=0;k<3;k++)od[k]+=(c.ray[k]*e[0]+c.mext*e[1]+c.oz[k]*e[2])*(t1-t0);}
 return od;}
// Diffusion simple le long de v : Rayleigh avec sa phase, Mie sans (le shader l'applique).
function scatter(v,s,c){const o=[0,R+H0,0],L=sphere(o,v,TOP)[1],mu=v[0]*s[0]+v[1]*s[1]+v[2]*s[2],pr=3/(16*PI)*(1+mu*mu),tau=[0,0,0],ray=[0,0,0],mie=[0,0,0];
 for(let i=0;i<32;i++){const a=i/32,b=(i+1)/32,t0=L*a*a,t1=L*b*b,dt=t1-t0,tm=(t0+t1)/2,p=[o[0]+v[0]*tm,o[1]+v[1]*tm,o[2]+v[2]*tm],
  e=dens(hypot(p[0],p[1],p[2])-R),x=K3.map(k=>c.ray[k]*e[0]+c.mext*e[1]+c.oz[k]*e[2]),ts=depthTo(p,s,c);
  if(ts)for(let k=0;k<3;k++){const T=exp(-(tau[k]+x[k]*dt/2+ts[k]));ray[k]+=T*c.ray[k]*e[0]*pr*dt;mie[k]+=T*c.msca[k]*e[1]*dt;}
  for(let k=0;k<3;k++)tau[k]+=x[k]*dt;}
 return{ray,mie};}
const Y=c=>.2126*c[0]+.7152*c[1]+.0722*c[2],nmax=c=>{const m=max(...c);return m>1e-12?c.map(v=>v/m):[0,0,0];};
// Table 6×5 : lignes y=(r/5)², colonnes cos Δaz=1−k/2.
function resolve(p,options){
 const op=options||{},q=normalize(p),err=validate(q);
 if(err.length)throw new Error('FSky.resolve: '+err.join('; '));
 const seed=((imul(op.seed|0,7919)+q.seed)>>>0)%65536,sun=direction(q.sun.el,q.sun.az),moon=direction(q.moon.el,q.moon.az),
  principal=q.sun.el>=-8?'sun':q.moon.el>=-2?'moon':'none',none=principal==='none',src=principal==='moon'?moon:sun,
  az=atan2(src[0],-src[2]),c=coeffs(q),ray=[],mie=[];
 for(let r=0;r<6;r++){const y=(r/5)**2,ce=sqrt(max(0,1-y*y));
  for(let k=0;k<5;k++){const a=az+acos(1-k/2),s=none?{ray:[0,0,0],mie:[0,0,0]}:scatter([sin(a)*ce,y,-cos(a)*ce],src,c);ray.push(s.ray);mie.push(s.mie);}}
 // Diffusion multiple approchée : multi × moyenne de la ligne.
 for(let r=0;r<6;r++){const m=K3.map(k=>{let s=0;for(let j=0;j<5;j++)s+=ray[r*5+j][k]+mie[r*5+j][k]*.0795775;return s/5;});
  for(let j=0;j<5;j++)for(let k=0;k<3;k++)ray[r*5+j][k]+=q.multi*m[k];}
 let L=0;for(let i=0;i<30;i++)L+=Y(ray[i])+Y(mie[i])*.0795775;L/=30;
 const ex=none?1:q.key/max(L,1e-30),gr=q.grade,cl=q.clouds,gw=q.glow,hz=q.horizon,
  RT=ray.map(v=>v.map((x,k)=>x*ex*gr[k]+q.floor[k])),MT=mie.map(v=>v.map((x,k)=>x*ex*gr[k])),
  o=[0,R+H0,0],Ts=depthTo(o,sun,c),Tm=depthTo(o,moon,c),Tc=none?null:depthTo([0,R+2.5,0],src,c),
  sunDisc=q.sun.el>-2?nmax(Ts?Ts.map(v=>exp(-v)):[0,0,0]).map(v=>v*q.sun.bright):[0,0,0],
  moonDisc=q.moon.el>-2?nmax(Tm?Tm.map(v=>exp(-v)):[1,1,1]).map((v,k)=>v*q.moon.bright*[.95,.97,1][k]):[0,0,0],avg=[0,0,0];
 for(let i=0;i<30;i++)for(let k=0;k<3;k++)avg[k]+=RT[i][k]+MT[i][k]*.0795775;
 // Repère du disque lunaire.
 const m0=cross([0,1,0],moon),ml=hypot(m0[0],m0[1],m0[2]),mr=ml<1e-6?[1,0,0]:m0.map(v=>v/ml),
  wd=q.wind.dir*RAD,f=min(1,max(0,-q.sun.el/10)),sf=f*f*(3-2*f),
  U={Ray:RT.flat(),Mie:MT.flat(),RefH:[sin(az),-cos(az)],Ref:[...src,q.g],Glow:[...gw.color.map(v=>v*gw.strength),1/sin(gw.width*RAD)],
  Sun:sun,SunDisc:[...sunDisc,q.sun.el>-2?q.sun.size*RAD:0],Moon:moon,MoonDisc:[...moonDisc,q.moon.el>-2?q.moon.size*RAD:0],
  MoonRight:mr,MoonUp:cross(moon,mr),Cloud:[cl.cover,cl.soft,cl.opacity,cl.scale],Cloud2:[cl.stretch,cl.dark,cl.veil,cl.curve],
  CloudSun:Tc?Tc.map((v,k)=>exp(-v)*.27*ex*gr[k]*cl.tint[k]):[0,0,0],CloudAmb:avg.map((v,k)=>(.85*(v/30)+.3*gw.color[k]*gw.strength)*cl.tint[k]),
  Wind:[.006*q.wind.speed,0,sin(wd),-cos(wd)],Seed:[(seed*37.17)%997,(seed*91.31)%991,seed*2.399963%6.2831853,seed%65536],
  Stars:[q.stars*sf,.02,q.milky*sf,0],Horizon:[hz.far,hz.near,hz.mix,hz.dark]},uniforms={};
 for(const n in UNIFORMS)if(UNIFORMS[n][2]==='monde')uniforms[n]=new Float32Array(U[n.slice(5)]);
 // Lumière clé (CIEL-V2) : source principale (le soleil sans source), élévation relevée à lightFloor.
 const ls=principal==='moon'?q.moon:q.sun,fog=[0,0,0],
  st={id:q.id||'',preset:q,principal,exposure:ex,seed,sun,moon,light:direction(max(ls.el,op.lightFloor??18),ls.az),fog,uniforms};
 // Brouillard (CIEL-07) en dernier, sur les uniformes Float32 définitifs.
 for(let j=0;j<16;j++){const g=fogAt(st,direction(0,j*22.5));for(let k=0;k<3;k++)fog[k]+=g[k];}
 for(let k=0;k<3;k++)fog[k]/=16;
 return st;}
// --- Miroir JS du shader (sans les couches), encodage, signature ---
const phase=(mu,g)=>{const g2=g*g,k=1+g2-2*g*mu;return .1193662*(1-g2)*(1+mu*mu)/((2+g2)*k*sqrt(k));};
// Les mix() de fskyAtmos : table T, cellule i, canal ch.
const lerp2=(T,i,ch,fk,fr)=>{const a=T[i*3+ch]+(T[(i+1)*3+ch]-T[i*3+ch])*fk,b=T[(i+5)*3+ch]+(T[(i+6)*3+ch]-T[(i+5)*3+ch])*fk;return a+(b-a)*fr;};
function atmos(S,d){const U=S.uniforms,h=U.uFskyRefH,f=U.uFskyRef,w=U.uFskyGlow,y=min(1,max(0,d[1])),r=sqrt(y)*5,l=hypot(d[0],d[2]),
 c=l>1e-5?max(-1,min(1,(d[0]*h[0]+d[2]*h[1])/l)):1,k=(1-c)*2,r0=min(floor(r),4),k0=min(floor(k),3),i=r0*5+k0,fr=r-r0,fk=k-k0,
 ph=phase(d[0]*f[0]+d[1]*f[1]+d[2]*f[2],f[3]),o=[0,0,0];
 for(let ch=0;ch<3;ch++)o[ch]=lerp2(U.uFskyRay,i,ch,fk,fr)+lerp2(U.uFskyMie,i,ch,fk,fr)*ph+w[ch]*exp(-y*w[3]);
 return o;}
function fogAt(S,d){const l=hypot(d[0],d[2]),h=l>1e-5?[d[0]/l,d[2]/l]:S.uniforms.uFskyRefH;return atmos(S,[h[0],0,h[1]]);}
function radianceAt(S,d){const l=hypot(d[0],d[1],d[2]),n=l>=1e-12?[d[0]/l,d[1]/l,d[2]/l]:[0,1,0];return n[1]>0?atmos(S,n):fogAt(S,n);}
const encode=(rgb,vignette=1)=>K3.map(k=>{const x=max(0,rgb[k]);return round(255*min(1,max(0,pow(x/(x+.76),.4545)*vignette)));});
// 15 niveaux encodés puis 7 entiers du préréglage.
function signature(S){const h=S.uniforms.uFskyRefH,p=S.preset,D=(e,s)=>[s*cos(e*RAD)*h[0],sin(e*RAD),s*cos(e*RAD)*h[1]],o=[];
 for(const c of[radianceAt(S,[0,1,0]),S.fog,radianceAt(S,D(3,1)),radianceAt(S,D(3,-1)),radianceAt(S,D(45,1))])o.push(...encode(c));
 o.push(...[p.clouds.cover,p.clouds.veil,p.stars,p.milky,p.glow.strength].map(v=>round(100*v)),round(p.sun.el),p.moon.el>-2?round(10*p.moon.size):0);
 return o;}
// --- Caméra, uniformes d'image, pose des uniformes ---
function view(yaw,pitch,fovY,aspect){
 const cy=cos(yaw),sy=sin(yaw),cp=cos(pitch),sp=sin(pitch),t=tan(fovY/2);
 return{right:[cy,0,sy],up:[-sy*sp,cp,cy*sp],forward:[sy*cp,sp,-cy*cp],fov:[aspect*t,t]};
}
// Float32Array de out créés une fois, puis réécrits : aucune allocation par image.
const ONE4=[1,1,1,1],slot=(o,n,k)=>{const a=o[n];return a instanceof Float32Array&&a.length===k?a:o[n]=new Float32Array(k);},
 put=(o,n,v,k)=>{const a=slot(o,n,k);for(let i=0;i<k;i++)a[i]=v[i];};
function frameUniforms({right,up,forward,fov,height,time=0,vignette=1,dither=1,mask=0,layers=ONE4},out={}){
 put(out,'uFskyRight',right,3);put(out,'uFskyUp',up,3);put(out,'uFskyForward',forward,3);put(out,'uFskyFov',fov,2);
 slot(out,'uFskyTime',1)[0]=time;slot(out,'uFskyPixel',1)[0]=2*fov[1]/height;
 const p=slot(out,'uFskyPost',4);p[0]=vignette;p[1]=dither;p[2]=mask;p[3]=0;
 put(out,'uFskyLayers',layers,4);
 return out;}
// cache : emplacements du programme, à vider quand on le relie.
const GLF={float:'uniform1fv',vec2:'uniform2fv',vec3:'uniform3fv',vec4:'uniform4fv'};
function bind(gl,program,values,cache={}){let n=0;
 for(const name in UNIFORMS)if(name in values){const loc=name in cache?cache[name]:cache[name]=gl.getUniformLocation(program,name);
  if(loc!==null){gl[GLF[UNIFORMS[name][0]]](loc,values[name]);n++;}}
 return n;}
// --- Données METAL (CIEL-13) ---
// L'index est le monde de campagne ; valeurs figées.
const presets=[
{id:'lisiere-aube',name:'Aube pâle',seed:7,sun:{el:8,az:-127},turbidity:3,key:.2,clouds:{cover:.25,soft:.35,opacity:.6,scale:1.3,tint:[1,.9,.95]},grade:[.92,1,1.1]}, // 0
{id:'carriere-aube-poussiere',name:'Aube de poussière',seed:108,sun:{el:10,az:-61},turbidity:7,tint:[1,.85,.65],absorb:.25,key:.22,clouds:{cover:.15,stretch:2},grade:[1.05,.97,.9]}, // 1
{id:'jardins-matin',name:'Matin clair',seed:209,sun:{el:22,az:28},key:.24,clouds:{cover:.32,soft:.12,scale:1.1},grade:[.94,1.02,1.04]}, // 2
{id:'lisiere-plein-jour',name:'Plein jour',seed:310,sun:{el:55,az:-127},turbidity:2.2,key:.26,clouds:{cover:.4,soft:.1,scale:.9,dark:.45},grade:[.95,1.03,1]}, // 3
{id:'carriere-midi-voile',name:'Midi voilé',seed:411,sun:{el:50,az:-61},turbidity:3.5,tint:[1,.95,.85],key:.27,clouds:{cover:.1,veil:.6,stretch:2.5},grade:[1.03,1,.94]}, // 4
{id:'jardins-ciel-pur',name:'Ciel pur',seed:512,sun:{el:62,az:28},turbidity:1.4,rayleigh:1.15,key:.24,clouds:{cover:0},grade:[.92,1,1.08]}, // 5
{id:'lisiere-orage-sec',name:'Orage sec',seed:613,sun:{el:32,az:-127},turbidity:4,key:.14,clouds:{cover:.86,dark:.8,scale:1.4,soft:.14,tint:[.75,.72,.78]},wind:{speed:2}}, // 6
{id:'carriere-vent-de-sable',name:'Vent de sable',seed:714,sun:{el:36,az:-61},turbidity:9,tint:[1,.78,.5],absorb:.35,g:.76,key:.2,clouds:{cover:.35,soft:.4,opacity:.6,stretch:4,dark:.3,tint:[1,.85,.65]},wind:{speed:3.5},grade:[1.06,.97,.88]}, // 7
{id:'jardins-apres-midi',name:'Après-midi de cirrus',seed:815,sun:{el:30,az:28},turbidity:2.5,key:.25,clouds:{cover:.45,stretch:3,scale:.8,soft:.2,veil:.25},grade:[.96,1,1.04]}, // 8
{id:'lisiere-couvert',name:'Couvert',seed:916,sun:{el:40,az:-127},turbidity:4,key:.18,clouds:{cover:.92,soft:.3,opacity:1,dark:.62,scale:.8,tint:[.84,.9,.88]},grade:[.92,1,.98]}, // 9
{id:'carriere-cendres',name:'Ciel de cendres',seed:1017,sun:{el:24,az:-61},turbidity:11,tint:[1,.7,.4],absorb:.5,g:.74,key:.17,clouds:{cover:.72,dark:.6,tint:[.8,.6,.42],soft:.3,stretch:2},wind:{dir:60,speed:2.5},glow:{color:[1,.45,.15],strength:.08,width:8},grade:[1.08,.95,.85]}, // 10
{id:'jardins-brume',name:'Brume claire',seed:1118,sun:{el:18,az:28},turbidity:9,tint:[.98,.97,.92],absorb:.3,key:.21,clouds:{cover:.2,soft:.45,opacity:.5,veil:.5},horizon:{far:.05,near:.025,mix:.7},grade:[.95,.99,1.03]}, // 11
{id:'lisiere-couchant',name:'Couchant doré',seed:1219,sun:{el:2,az:-127},turbidity:5,tint:[1,.85,.7],absorb:.3,key:.22,clouds:{cover:.35,stretch:3,scale:.9,dark:.45},grade:[1.08,.97,.88]}, // 12
{id:'carriere-fournaise',name:'Fournaise',seed:1320,sun:{el:.5,az:-61},turbidity:8,tint:[1,.7,.45],absorb:.45,key:.22,clouds:{cover:.4,stretch:3,dark:.55,tint:[1,.75,.6]},glow:{color:[1,.35,.08],strength:.15,width:8},grade:[1.1,.93,.85]}, // 13
{id:'jardins-crepuscule-mauve',name:'Crépuscule mauve',seed:1421,sun:{el:-4.5,az:28},turbidity:1.5,ozone:2.5,multi:.4,key:.08,clouds:{cover:.12},stars:.4,grade:[.72,.9,1.4]}, // 14
{id:'lisiere-nuit-de-lune',name:'Nuit de lune',seed:1522,sun:{el:-30,az:53},moon:{el:30,az:-127,size:1.6},key:.03,clouds:{cover:.25,soft:.3},stars:.7,milky:.3,floor:[.004,.007,.01],grade:[.8,1,1.05]}, // 15
{id:'carriere-nuit-de-braises',name:'Nuit de braises',seed:1623,sun:{el:-25,az:-61},moon:{el:-20,az:0},turbidity:6,clouds:{cover:.45,dark:.7},stars:.35,glow:{color:[1,.38,.1],strength:.35,width:7},floor:[.012,.006,.004]}, // 16
{id:'jardins-dernier-signal',name:'Dernier signal',seed:1724,sun:{el:-35,az:208},moon:{el:-10,az:0},clouds:{cover:.08,stretch:4},stars:1,milky:.8,glow:{color:[.15,.85,.9],strength:.22,width:10},floor:[.004,.008,.014],grade:[.85,.95,1.1]} // 17
];
G.FSky={VERSION:1,VERT,FOG_GLSL,FRAG,UNIFORMS,defaults,presets,normalize,validate,direction,view,resolve,frameUniforms,bind,radianceAt,fogAt,encode,signature};
})(typeof window!=='undefined'?window:globalThis);

/* FERRO — local scene capture and native-resolution screen reflections. No external images. */
(function(G){'use strict';
const faces=[{forward:[1,0,0],right:[0,0,-1],up:[0,-1,0]},{forward:[-1,0,0],right:[0,0,1],up:[0,-1,0]},{forward:[0,1,0],right:[1,0,0],up:[0,0,1]},{forward:[0,-1,0],right:[1,0,0],up:[0,0,-1]},{forward:[0,0,1],right:[1,0,0],up:[0,-1,0]},{forward:[0,0,-1],right:[-1,0,0],up:[0,-1,0]}];
const declarations=`uniform samplerCube uSceneProbe;uniform float uProbeReady;uniform vec3 uProbeOrigin;
layout(location=1) out vec4 reflectionSurface;
vec3 sceneProbe(vec3 point,vec3 direction,float roughness){vec3 t=(uProbeOrigin+sign(direction)*36.-point)/direction;float distance=min(t.x,min(t.y,t.z));vec3 corrected=point+direction*max(0.,distance)-uProbeOrigin;vec3 encoded=textureLod(uSceneProbe,corrected,roughness*5.).rgb;vec3 linear=pow(max(encoded,vec3(0.)),vec3(2.2));return linear*.76/max(vec3(.04),1.-linear);}
`;
function shader(source){return source.replace('out vec4 fragColor;',declarations+'layout(location=0) out vec4 fragColor;')
 .replace('    float pixelSpan=',`    float localWet=0.;if(uProbeReady>.5&&m>1.5&&m<2.5&&n.y>.8&&vOverlay<.5)localWet=smoothstep(.61,.76,noise(vWorld.xz*.37+13.));
    float pixelSpan=`)
 .replace('    roughness=min(.98,',`    if(localWet>0.){roughness=mix(roughness,.12,localWet);n=normalize(n+vec3(sin(vWorld.z*9.+uEffects.x)*.012,0.,cos(vWorld.x*8.+uEffects.x*.8)*.012)*localWet);}
    roughness=min(.98,`)
 .replace('    float nv=max(dot(n,view),0.),',`    if(uProbeReady>.5&&metalness>.25&&roughness<.7)environmentReflection=mix(environmentReflection,sceneProbe(vWorld,reflected,roughness),(1.-smoothstep(.5,.7,roughness)));
    float nv=max(dot(n,view),0.),`)
 .replace('    fragColor=vec4(color,reflection);',`    reflectionSurface=vec4(n*.5+.5,(uProbeReady>.5&&metalness>.25&&roughness<.4&&vOverlay<.5)?clamp((.15+grazing*.8)*(1.-roughness),0.,.65):0.);
    fragColor=vec4(color,reflection);`);}
const vertex=`#version 300 es
precision highp float;out vec2 uv;void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);uv=p;gl_Position=vec4(p*2.-1.,0.,1.);}`;
const fragment=`#version 300 es
precision highp float;in vec2 uv;out vec4 color;uniform sampler2D scene,depth,surface,history;uniform samplerCube probe;uniform mat4 projection,view;uniform vec3 eye,right,up,forward;uniform vec2 tangent,texel,depthProjection;uniform float historyWeight;
float viewDepth(float d){return depthProjection.y/(d*2.-1.+depthProjection.x);}
vec3 positionAt(vec2 p,float d){return eye+(forward+right*(p.x*2.-1.)*tangent.x+up*(p.y*2.-1.)*tangent.y)*viewDepth(d);}
void main(){vec3 base=texture(scene,uv).rgb;float d=texture(depth,uv).r;vec4 material=texture(surface,uv);if(d>=.999999||material.a<.001){color=vec4(base,1.);return;}vec3 normal=normalize(material.xyz*2.-1.),start=positionAt(uv,d),direction=reflect(normalize(start-eye),normal);vec3 origin=start+normal*.06;float last=0.,confidence=0.;vec3 hitColor=base;vec2 hitUV=uv;
for(int i=1;i<=28;i++){float travel=float(i)*(.13+float(i)*.025);vec3 point=origin+direction*travel;vec4 clip=projection*view*vec4(point,1.);if(clip.w<=0.)break;vec2 at=clip.xy/clip.w*.5+.5;if(any(lessThan(at,vec2(.002)))||any(greaterThan(at,vec2(.998))))break;float sd=texture(depth,at).r;if(sd>=.999999)continue;float delta=dot(point-eye,forward)-viewDepth(sd);if(delta>0.&&last<=0.&&delta<.22+travel*.035){hitUV=at;confidence=smoothstep(0.,.09,min(min(at.x,1.-at.x),min(at.y,1.-at.y)))*(1.-smoothstep(12.,24.,travel));hitColor=texture(scene,at).rgb;break;}last=delta;}
vec3 fallback=textureLod(probe,direction,1.).rgb;vec3 result=clamp(base+(hitColor-fallback)*material.a*confidence,0.,1.);vec3 previous=texture(history,uv).rgb;vec3 lo=base,hi=base;for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec3 q=texture(scene,uv+vec2(x,y)*texel).rgb;lo=min(lo,q);hi=max(hi,q);}previous=clamp(previous,lo-.06,hi+.06);color=vec4(mix(result,previous,historyWeight*confidence),1.);}`;
function create(gl,link){
 const size=256,stats={mode:'off',ready:false,faces:0,cycles:0,screenPasses:0,history:0,revision:-1},origin=[0,0,0],pendingOrigin=[0,0,0];let front=null,back=null,fb=null,z=null,cursor=0,pendingKey='',liveKey='',revision=-1,valid=false,screen=null,attached=null,screenProgram=null,lastHistoryKey='',historyCount=0,vao=null;
 function cube(){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_CUBE_MAP,t);for(let f=0;f<6;f++)gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X+f,0,gl.RGBA8,size,size,0,gl.RGBA,gl.UNSIGNED_BYTE,null);gl.texParameteri(gl.TEXTURE_CUBE_MAP,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_CUBE_MAP,gl.TEXTURE_MAG_FILTER,gl.LINEAR);for(const axis of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T,gl.TEXTURE_WRAP_R])gl.texParameteri(gl.TEXTURE_CUBE_MAP,axis,gl.CLAMP_TO_EDGE);gl.generateMipmap(gl.TEXTURE_CUBE_MAP);return t;}
 function initialize(){if(front)return;gl.activeTexture(gl.TEXTURE3);front=cube();back=cube();fb=gl.createFramebuffer();z=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,z);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,size,size);gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,z);vao=gl.createVertexArray();gl.activeTexture(gl.TEXTURE0);}
 function bind(uniforms,enabled=true){gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_CUBE_MAP,front);gl.uniform1i(uniforms.uSceneProbe,3);gl.uniform1f(uniforms.uProbeReady,enabled&&valid?1:0);gl.uniform3fv(uniforms.uProbeOrigin,origin);gl.activeTexture(gl.TEXTURE0);}
 function update(mode,eye,dynamic,stateRevision,time,draw){stats.mode=mode;stats.faces=0;stats.screenPasses=0;if(mode==='off'){valid=false;liveKey=pendingKey='';cursor=0;stats.ready=false;return;}
  initialize();let hash=0;for(const q of dynamic){if(q.overlay)continue;for(const n of [...(q.p||[]),...(q.r||[])])hash=Math.imul(hash^Math.round(n*8),16777619);hash=Math.imul(hash^Math.round((q.emissive||0)*100),16777619);}const key=stateRevision+':'+Math.floor(eye[0]/2)+':'+Math.floor(eye[1]/2)+':'+Math.floor(eye[2]/2)+':'+hash+':'+Math.floor(time*4);
  if(stateRevision!==revision||valid&&Math.hypot(...eye.map((v,k)=>v-origin[k]))>8){valid=false;cursor=0;pendingKey='';revision=stateRevision;historyCount=0;}
  if(!pendingKey&&key!==liveKey){pendingKey=key;pendingOrigin.splice(0,3,...eye);cursor=0;}
  if(pendingKey){gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_CUBE_MAP,null);gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_CUBE_MAP_POSITIVE_X+cursor,back,0);gl.drawBuffers([gl.COLOR_ATTACHMENT0]);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE){pendingKey='';valid=false;stats.error='capture framebuffer';return;}gl.viewport(0,0,size,size);draw(pendingOrigin,faces[cursor],size);stats.faces=1;if(++cursor===6){const old=front;front=back;back=old;gl.bindTexture(gl.TEXTURE_CUBE_MAP,front);gl.generateMipmap(gl.TEXTURE_CUBE_MAP);origin.splice(0,3,...pendingOrigin);valid=true;liveKey=pendingKey;pendingKey='';stats.cycles++;stats.revision=stateRevision;}}
  stats.ready=valid;gl.activeTexture(gl.TEXTURE0);
 }
 function texture(w,h,depth=false){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,depth?gl.DEPTH_COMPONENT24:gl.RGBA8,w,h,0,depth?gl.DEPTH_COMPONENT:gl.RGBA,depth?gl.UNSIGNED_INT:gl.UNSIGNED_BYTE,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t;}
 function freeScreen(){if(!screen)return;for(const t of [screen.depth,screen.normal,...screen.colors])gl.deleteTexture(t);for(const f of screen.frames)gl.deleteFramebuffer(f);screen=null;historyCount=0;}
 function beginScreen(target,mode){
  if(mode!=='screen'||!target){if(attached){gl.bindFramebuffer(gl.FRAMEBUFFER,attached.framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT1,gl.TEXTURE_2D,null,0);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,attached.depth);gl.drawBuffers([gl.COLOR_ATTACHMENT0]);attached=null;}return;}
  const w=target.width,h=target.height;gl.activeTexture(gl.TEXTURE4);if(!screen||screen.w!==w||screen.h!==h){freeScreen();screen={w,h,depth:texture(w,h,true),normal:texture(w,h),colors:[texture(w,h),texture(w,h)],frames:[gl.createFramebuffer(),gl.createFramebuffer()],index:0};for(let i=0;i<2;i++){gl.bindFramebuffer(gl.FRAMEBUFFER,screen.frames[i]);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,screen.colors[i],0);}}
  gl.bindFramebuffer(gl.FRAMEBUFFER,target.framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,screen.depth,0);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT1,gl.TEXTURE_2D,screen.normal,0);gl.drawBuffers([gl.COLOR_ATTACHMENT0,gl.COLOR_ATTACHMENT1]);attached=target;gl.activeTexture(gl.TEXTURE0);
 }
 function resolve(target,mode,camera,axes,projection,view,time,stateRevision,dynamicKey){if(mode!=='screen'||!screen||!valid)return;screenProgram??=link(vertex,fragment);const key=[...camera.pos,...axes.forward,stateRevision,dynamicKey,Math.floor(time*4)].join(':');historyCount=key===lastHistoryKey?Math.min(4,historyCount+1):0;lastHistoryKey=key;
  gl.bindFramebuffer(gl.FRAMEBUFFER,screen.frames[screen.index]);gl.drawBuffers([gl.COLOR_ATTACHMENT0]);gl.viewport(0,0,screen.w,screen.h);gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.bindVertexArray(vao);gl.useProgram(screenProgram);const u=n=>gl.getUniformLocation(screenProgram,n);for(const [i,name,t] of [[0,'scene',target.texture],[1,'depth',screen.depth],[2,'surface',screen.normal],[4,'history',screen.colors[1-screen.index]]]){gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,t);gl.uniform1i(u(name),i);}gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_CUBE_MAP,front);gl.uniform1i(u('probe'),3);gl.uniformMatrix4fv(u('projection'),false,projection);gl.uniformMatrix4fv(u('view'),false,view);for(const [name,value] of [['eye',camera.pos],['right',axes.right],['up',axes.up],['forward',axes.forward]])gl.uniform3fv(u(name),value);gl.uniform2f(u('depthProjection'),projection[10],projection[14]);gl.uniform2f(u('tangent'),1/projection[0],1/projection[5]);gl.uniform2f(u('texel'),1/screen.w,1/screen.h);gl.uniform1f(u('historyWeight'),historyCount?Math.min(.5,historyCount/(historyCount+1)):0);gl.drawArrays(gl.TRIANGLES,0,3);
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER,screen.frames[screen.index]);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,target.framebuffer);gl.drawBuffers([gl.COLOR_ATTACHMENT0]);gl.blitFramebuffer(0,0,screen.w,screen.h,0,0,screen.w,screen.h,gl.COLOR_BUFFER_BIT,gl.NEAREST);screen.index=1-screen.index;gl.bindFramebuffer(gl.FRAMEBUFFER,target.framebuffer);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.activeTexture(gl.TEXTURE0);stats.screenPasses=1;stats.history=historyCount;
 }
 function dispose(){freeScreen();if(front)gl.deleteTexture(front);if(back)gl.deleteTexture(back);if(fb)gl.deleteFramebuffer(fb);if(z)gl.deleteRenderbuffer(z);if(vao)gl.deleteVertexArray(vao);if(screenProgram)gl.deleteProgram(screenProgram);front=back=fb=z=vao=screenProgram=null;valid=false;}
 return {stats,bind,update,beginScreen,resolve,dispose,get key(){return pendingKey||liveKey;},get size(){return size;}};
}
G.FSceneReflections={create,shader};
})(typeof window!=='undefined'?window:globalThis);
