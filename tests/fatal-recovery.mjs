/* Deterministic lifecycle regression: actual game, storage and gamepad modules;
   a small DOM substitute only supplies browser plumbing (no renderer required). */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=name=>fs.readFileSync(new URL('../src/'+name,import.meta.url),'utf8');
const SAVE='rade-solo-v2',SETTINGS='emprise-pad-v1',stored=JSON.stringify({version:2,cash:871,sites:[],player:{x:9.89877439307345,z:176.93137656723448,hp:56}});
function dom(){
 const ids=new Map();let document;
 class Element{
  constructor(tag='div',attrs=''){this.tagName=tag.toUpperCase();this.children=[];this.parentElement=null;this.hidden=/\bhidden\b/.test(attrs);this.disabled=false;this.inert=false;this.style={};this.dataset={};this.classList={add(){},remove(){},toggle(){}};this.listeners={};for(const m of attrs.matchAll(/([\w-]+)="([^"]*)"/g)){this[m[1]]=m[2];if(m[1]==='id')ids.set(m[2],this);if(m[1].startsWith('data-'))this.dataset[m[1].slice(5).replace(/-([a-z])/g,(_,a)=>a.toUpperCase())]=m[2];}}
  addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
  removeEventListener(type,fn){this.listeners[type]=(this.listeners[type]||[]).filter(f=>f!==fn);}
  contains(el){for(let e=el;e;e=e.parentElement)if(e===this)return true;return false;}
  append(...els){for(const e of els){e.parentElement=this;this.children.push(e);}}
  insertBefore(el,before){el.parentElement=this;const i=this.children.indexOf(before);this.children.splice(i<0?this.children.length:i,0,el);}
  replaceChildren(...els){this.children=[];this.append(...els);}
  querySelectorAll(selector){const selectors=selector.split(',').map(s=>s.trim()),all=[];const matches=(e,s)=>s[0]==='#'?e.id===s.slice(1):/^\[data-[\w-]+\]$/.test(s)?e.dataset[s.slice(6,-1).replace(/-([a-z])/g,(_,a)=>a.toUpperCase())]!==undefined:e.tagName===s.toUpperCase();const visit=e=>{for(const child of e.children){if(selectors.some(s=>matches(child,s)))all.push(child);visit(child);}};visit(this);return all;}
  querySelector(s){return this.querySelectorAll(s)[0]||null;}
  closest(s){for(let e=this;e;e=e.parentElement)if(s==='[hidden]'&&e.hidden)return e;return null;}
  getClientRects(){return this.closest('[hidden]')?[]:[{}];}
  focus(){document.activeElement=this;}
  click(){if(!this.disabled)this.onclick?.({target:this});}
  scrollIntoView(){}
 }
 const root=new Element(),stack=[root],voids=new Set(['META','INPUT','BR','HR','LINK']);
 for(const token of read('index.html').matchAll(/<\/?([a-z][\w-]*)([^>]*)>/gi)){const [,tag,attrs]=token;if(token[0][1]==='/'){while(stack.length>1){const el=stack.pop();if(el.tagName===tag.toUpperCase())break;}}else{const el=new Element(tag,attrs);stack.at(-1).append(el);if(!voids.has(el.tagName))stack.push(el);}}
 const listeners={};document={body:root.querySelector('body'),activeElement:null,pointerLockElement:null,getElementById:id=>ids.get(id),createElement:tag=>new Element(tag),querySelector:s=>s==='.game-version small'?null:root.querySelector(s),querySelectorAll:s=>s==='#touch button'?ids.get('touch').querySelectorAll('button'):root.querySelectorAll(s),addEventListener:(type,fn)=>(listeners[type]??=[]).push(fn),exitPointerLock(){this.pointerLockElement=null;}};
 document.activeElement=document.body;return {document,ids};
}
async function fixture({fatal=false,clearFails=false}={}){
 const {document,ids}=dom(),listeners={},timers=[],frames=[],log=[],data=new Map([[SAVE,stored],[SETTINGS,'{"sensitivity":1.6,"invert":true}'],['unrelated','preserved']]);let reloads=0,now=0,pad=null;
 const noop=()=>{},audio={start:noop,setMix:noop,setPlaying:noop},session={world:{scenery:[],navCity:{}},mode:'foot',player:{},campaign:{state:{offline:0}},sim:{state:{dead:false},dispose:noop},tell:noop,save:()=>({version:2,cash:999,sites:[]})};
 const context=vm.createContext({console:{error:e=>log.push(e),log:noop},URLSearchParams,performance:{now:()=>now},document,navigator:{getGamepads:()=>pad?[pad]:[]},localStorage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>{if(clearFails)throw Error('storage denied');data.delete(k);}},location:{search:'',reload(){reloads++;for(const fn of listeners.pagehide||[])fn({});}},matchMedia:()=>({matches:false}),setTimeout:fn=>timers.push(fn),requestAnimationFrame:fn=>frames.push(fn),FInput:{create:()=>({clear:noop,keyDown:noop,keyUp:noop,button:noop}),glyph:k=>k},FMotion:{create:()=>({reset:noop})},FAudio:{create:()=>audio},BITUME:{son:{creer:()=>({suspendre:noop,demarrer:noop,reprendre:noop})}},PDR:{foule:{creerFoule:()=>({regler:noop,liberer:noop})}},FRenderBackends:{create:async canvas=>({canvas,renderer:{setWorld:noop,stats:{backend:'webgl2'}},activate:noop})},RADE:{camera:{create:()=>({reset:noop})},build:{id:'test'},replays:[],materials:{load:async()=>{}},session:{create:({saved})=>{assert(saved);if(fatal)throw Error('Aucun point libre près de '+saved.player.x+','+saved.player.z);return session;}}}});
 context.window={addEventListener:(type,fn)=>(listeners[type]??=[]).push(fn)};
 for(const name of ['replay.js','gamepad.js','mobile.js','game.js'])vm.runInContext(read(name),context,{filename:name});
 timers.shift()();await new Promise(setImmediate);await new Promise(setImmediate);
 const key=(code,shiftKey=false)=>{const event={code,shiftKey,target:document.activeElement,preventDefault(){this.prevented=true;}};for(const fn of listeners.keydown||[])fn(event);return event;};
 const poll=(buttons=[])=>{pad={id:'Test standard',index:0,connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},(_,i)=>({value:buttons.includes(i)?1:0}))};now+=16;const at=frames.findIndex(fn=>fn.name==='recoveryFrame');assert(at>=0,'Fatal gamepad loop exists without a game frame');frames.splice(at,1)[0](now);};
 return {context,document,ids,data,key,poll,session,log,get reloads(){return reloads;}};
}
let f=await fixture({fatal:true});assert.equal(f.ids.get('recovery').hidden,false);assert.equal(f.ids.get('loading').hidden,true);assert.match(f.ids.get('recovery-detail').textContent,/9\.89877439307345,176\.93137656723448/);assert.equal(f.data.get(SAVE),stored);assert.equal(f.document.activeElement.id,'fatal-reload');
f.ids.get('fatal-reset').focus();f.ids.get('fatal-reset').click();assert.equal(f.ids.get('reset-confirm').hidden,false);assert.equal(f.document.activeElement.id,'cancel-reset','Confirmation defaults to keep the save');assert(f.ids.get('recovery').inert);assert(f.key('Escape').prevented);assert(f.ids.get('reset-confirm').hidden);assert(!f.ids.get('recovery').inert);assert.equal(f.document.activeElement.id,'fatal-reset');assert.equal(f.data.get(SAVE),stored);assert.equal(f.reloads,0);
f.ids.get('fatal-reload').focus();assert(f.key('Tab',true).prevented,'Fatal keyboard focus wraps');assert.equal(f.document.activeElement.tagName,'SUMMARY');f.ids.get('fatal-reload').click();assert.equal(f.reloads,1);assert.equal(f.data.get(SAVE),stored,'Reload preserves the failed save');
f=await fixture({fatal:true});f.ids.get('fatal-reset').click();f.ids.get('confirm-reset').click();assert.equal(f.data.has(SAVE),false);assert.equal(f.data.get(SETTINGS),'{"sensitivity":1.6,"invert":true}');assert.equal(f.data.get('unrelated'),'preserved');assert.equal(f.reloads,1);
f=await fixture({fatal:true,clearFails:true});f.ids.get('fatal-reset').click();f.ids.get('confirm-reset').click();assert.equal(f.reloads,0);assert.equal(f.data.get(SAVE),stored);assert.equal(f.ids.get('reset-error').hidden,false);f.ids.get('cancel-reset').click();assert.equal(f.ids.get('reset-confirm').hidden,true);
// Normal live state used to rewrite the just-deleted save in pagehide.
f=await fixture();assert.equal(f.ids.get('recovery').hidden,true);assert(f.context.RADE.game);assert.equal(JSON.parse(f.data.get(SAVE)).cash,999);f.ids.get('title-reset').click();f.ids.get('confirm-reset').click();assert.equal(f.reloads,1);assert.equal(f.data.has(SAVE),false,'pagehide cannot recreate the discarded live campaign');assert(f.data.has(SETTINGS));
// Actual gamepad module: neutral gate, D-pad, A, B and a deliberate confirmation.
f=await fixture({fatal:true});f.poll();f.poll([13]);assert.equal(f.document.activeElement.id,'fatal-reset');f.poll();f.poll([0]);assert.equal(f.document.activeElement.id,'cancel-reset');f.poll();f.poll([1]);assert(f.ids.get('reset-confirm').hidden);assert.equal(f.data.get(SAVE),stored);f.poll();f.poll([0]);assert(!f.ids.get('reset-confirm').hidden);f.poll();f.poll([13]);assert.equal(f.document.activeElement.id,'confirm-reset');f.poll();f.poll([0]);assert.equal(f.reloads,1);assert.equal(f.data.has(SAVE),false);
console.log('PASS: fatal initialization, reload, keyboard/gamepad cancel and confirmation, storage failure, settings preservation, and pagehide reset race.');
