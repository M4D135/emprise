/* RADE — run-length encoded input recordings, fixed 120 Hz, no persistence during replay. */
(function(R){'use strict';const keys=['moveX','moveY','lookX','lookY','sprint','fire','weapon','dash','melee','pulse','steer','forward','back','brake','drift','interact','engine','camera','paint','siteAction','grab','throw','ignite','repair'];
function clean(input){const o={};for(const k of keys){const v=input[k];if(typeof v==='boolean'){if(v)o[k]=true;}else if(typeof v==='number'&&Number.isFinite(v)){if(v||k==='weapon'||k==='siteAction')o[k]=v;}}return o;}
function recorder(){let tape=null,last='',ticks=0;return {start(label='Commandes réelles'){tape={version:2,hz:120,expanded:true,label,runs:[]};last='';ticks=0;},push(input){if(!tape)return;const c=clean(input),key=JSON.stringify(c);if(key===last&&tape.runs.length)tape.runs.at(-1)[0]++;else{tape.runs.push([1,c]);last=key;}ticks++;},stop(){if(!tape)return null;tape.ticks=ticks;tape.duration=ticks/120;const out=tape;tape=null;return out;},get active(){return !!tape;}};}
function player(tape){let run=0,tick=0,elapsed=0;return {next(){if(run>=tape.runs.length)return null;const [n,c]=tape.runs[run];tick++;elapsed++;if(tick>=n){run++;tick=0;}return c;},get time(){return elapsed/120;},get done(){return run>=tape.runs.length;}};}
const KEY='rade-solo-v2';
const storage={load(){try{const value=JSON.parse(localStorage.getItem(KEY)||'null');return value?.version===2?value:null;}catch{return null;}},save(value){try{localStorage.setItem(KEY,JSON.stringify(value));return true;}catch{return false;}},clear(){try{localStorage.removeItem(KEY);}catch{}}};
R.replay={clean,recorder,player};R.storage=storage;
})(globalThis.RADE);
