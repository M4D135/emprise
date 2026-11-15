import assert from 'node:assert/strict';
await import('../src/mobile.js');
const {create,bind,fovFor}=RADE.mobile;
const near=(a,b)=>assert(Math.abs(a-b)<1e-9,`${a} != ${b}`);
let c=create({acceleration:0});
assert(c.begin('move',1,80,200,50));assert(!c.begin('move',2,90,200));assert(!c.begin('look',1,200,200));
assert(c.begin('look',2,240,200));assert(c.begin('fire',3,300,200));
c.move(1,110,160);c.move(2,250,180);c.move(3,310,200);c.frame(1/60);
let out=c.step();near(out.moveX,.6);near(out.moveY,.8);near(out.lookX,.08);near(out.lookY,.08);assert(out.fire);assert(!out.sprint);
out=c.step();near(out.lookX,0);near(out.lookY,0);assert(out.fire,'Held fire survives successive fixed ticks');
c.end(2,true);assert.equal(c.count,2);assert(c.step().fire,'Cancelling look does not release another fire finger');
c.move(1,110,120);assert(c.step().sprint,'Outer stick ring runs');c.move(1,80,200);assert(!c.step().sprint);
c.end(3);assert(!c.step().fire);c.end(1);near(c.step().moveX,0);near(c.step().moveY,0);
assert(c.begin('fire',4,300,200));c.end(4);assert(c.step().fire,'Short tap fires once even between fixed ticks');assert(!c.step().fire);
assert(c.begin('fire',5,300,200));c.end(5,true);assert(!c.step().fire,'Cancelled short tap never fires later');
c.queue('cycle');assert.equal(c.step(2).weapon,0);assert.equal(c.step(2).weapon,undefined);
c.queue('interact');c.clear();assert(!c.step().interact,'Pause clears queued taps');assert.equal(c.count,0);
assert(!c.begin('move',NaN,0,0));assert(!c.begin('unknown',4,0,0));assert(!c.begin('move',4,Infinity,0));

// Driving keeps steering independent of both pedals and free camera movement.
c.setMode('car');c.begin('move',10,80,200,50);c.move(10,105,200);c.begin('forward',11,300,200);c.begin('look',12,220,100);c.move(12,240,100);c.frame(1/60);
out=c.step();assert(out.steer>0&&out.steer<1);assert.equal(out.forward,1);assert.equal(out.back,0);assert.equal(out.moveY,0);assert(!out.fire);near(out.lookX,.08);
c.begin('back',13,240,200);c.begin('brake',14,240,260);out=c.step();assert.equal(out.back,1);assert(out.brake);c.end(11,true);assert.equal(c.step().forward,0);assert.equal(c.step().back,1);
c.setMode('swim');assert.equal(c.count,0,'Entering/exiting a vehicle requires new touch ownership');c.begin('move',20,80,200,50);c.move(20,80,120);assert(c.step().sprint);assert(!c.step().fire);
c.setMode('boat','helm');c.begin('move',21,80,200,50);c.move(21,30,200);c.begin('forward',22,300,200);out=c.step();assert.equal(out.steer,-1);assert.equal(out.forward,1);
c.setMode('boat','trim');assert.equal(c.count,0,'Changing crank releases the previous pedal');c.begin('forward',23,300,200);out=c.step();assert.equal(out.sailAngle,1);assert.equal(out.forward,0);assert.equal(out.back,0);
c.setMode('boat','hoist');c.begin('back',24,300,200);out=c.step();assert.equal(out.sailHoist,-1);assert.equal(out.forward,0);assert.equal(out.back,0);c.end(24);c.begin('move',25,80,200,50);c.move(25,80,150);assert.equal(c.step().sailHoist,1);
c=create({sensitivity:2,acceleration:0,invertY:true});c.begin('look',1,100,100);c.move(1,110,120);c.frame(1/60);out=c.step();near(out.lookX,.08);near(out.lookY,.16);
assert.equal(fovFor(16/9,74),74);assert(fovFor(390/844,74)>74);assert(fovFor(320/900,74)<=104);

// Exercise real DOM binding with pointer captures and actual cancellation paths.
class Target{
 constructor(dataset={}){this.dataset=dataset;this.listeners=new Map();this.style={};this.hidden=false;this.disabled=false;this.captured=new Set();this.parent=null;this.classList={toggle(){}};}
 addEventListener(k,fn){if(!this.listeners.has(k))this.listeners.set(k,[]);this.listeners.get(k).push(fn);}
 removeEventListener(k,fn){this.listeners.set(k,(this.listeners.get(k)||[]).filter(x=>x!==fn));}
 emit(type,props={}){const e={type,target:this,pointerId:1,pointerType:'touch',clientX:100,clientY:200,preventDefault(){this.prevented=true;},...props};for(const fn of [...this.listeners.get(type)||[]])fn(e);return e;}
 setPointerCapture(id){this.captured.add(id);}hasPointerCapture(id){return this.captured.has(id);}releasePointerCapture(id){this.captured.delete(id);}
 contains(el){return el===this||el.parent===this;}
 closest(){return this.dataset.mobileRole||this.dataset.mobileAction?this:null;}
 querySelector(s){return s==='[data-mobile-stick]'?stick:s==='[data-mobile-knob]'?knob:null;}
}
const doc=new Target(),host=new Target(),root=new Target(),stick=new Target({mobileRole:'move'}),knob=new Target(),fire=new Target({mobileRole:'fire'}),interact=new Target({mobileAction:'interact'}),menu=new Target({mobileAction:'actions'});
for(const el of [stick,fire,interact,menu])el.parent=root;host.innerWidth=390;host.innerHeight=844;let canvas=new Target(),playing=true,activated=0,ui;c=create({acceleration:0});
ui=bind({controls:c,root,scene:()=>canvas,document:doc,host,canPlay:()=>playing,activate:()=>activated++,action:id=>{if(id==='actions'){playing=false;ui.clear();}else c.queue(id);}});
doc.emit('pointerdown',{target:canvas,pointerId:1,clientX:70});doc.emit('pointerdown',{target:canvas,pointerId:2,clientX:260});doc.emit('pointerdown',{target:fire,pointerId:3});assert.equal(c.count,3);
host.emit('pointermove',{pointerId:1,clientX:90,clientY:150});host.emit('pointermove',{pointerId:2,clientX:280,clientY:210});c.frame(1/60);out=c.step();assert(out.moveY>0);assert(out.lookX>0);assert(out.fire);
host.emit('pointercancel',{pointerId:3});assert(!c.step().fire);assert.equal(c.count,2);host.emit('lostpointercapture',{pointerId:1});assert.equal(c.count,1);assert.equal(c.step().moveY,0);
doc.emit('pointerdown',{target:interact,pointerId:4});assert(!c.step().interact,'Tap actions wait for release/native click');host.emit('pointerup',{pointerId:4});root.emit('click',{target:interact,detail:1});assert(c.step().interact);assert(!c.step().interact);
doc.emit('pointerdown',{target:fire,pointerId:5});doc.emit('pointerdown',{target:menu,pointerId:6});assert(playing,'A sheet must not open beneath a held pointer');host.emit('pointerup',{pointerId:6});root.emit('click',{target:menu,detail:1});assert.equal(c.count,0);assert(!c.step().fire);assert.equal(fire.captured.size,0);assert.equal(canvas.captured.size,0);
host.emit('pointermove',{pointerId:5,clientX:200});assert.equal(c.count,0);playing=true;host.emit('pointerup',{pointerId:5});assert(!c.step().fire,'Resume cannot restore an old held finger');
doc.emit('pointerdown',{target:fire,pointerId:7});host.emit('blur');assert.equal(c.count,0);assert(!c.step().fire);
for(const event of ['resize','orientationchange','pagehide']){doc.emit('pointerdown',{target:fire,pointerId:8});host.emit(event);assert.equal(c.count,0);assert(!c.step().fire);}
doc.emit('pointerdown',{target:fire,pointerId:9});doc.hidden=true;doc.emit('visibilitychange');assert.equal(c.count,0);doc.hidden=false;
canvas=new Target();doc.emit('pointerdown',{target:canvas,pointerId:10,clientX:260});assert(c.has(10),'Replacement canvas is accepted');ui.syncMode('car');assert.equal(c.count,0);assert.equal(canvas.captured.size,0);
doc.emit('pointerdown',{target:interact,pointerId:30});ui.clear();host.emit('pointerup',{pointerId:30});root.emit('click',{target:interact,detail:1});assert(!c.step().interact,'A tap held across pause/resume is rejected');
doc.emit('pointerdown',{target:interact,pointerId:31});host.emit('pointercancel',{pointerId:31});root.emit('click',{target:interact,detail:1});assert(!c.step().interact,'Cancelled action cannot activate through a late click');
root.emit('click',{target:interact,detail:0});assert(c.step().interact,'Independent keyboard/assistive activation still works');
assert(activated>0);ui.destroy();doc.emit('pointerdown',{target:canvas,pointerId:11});assert.equal(c.count,0,'Destroy removes all listeners');
console.log('PASS mobile controls: multitouch ownership, analog run/swim, drag aiming while firing, tap/cancel, driving/pedals, both sail cranks, pause/resume gates, capture loss, blur/rotation/visibility, replaced canvas and portrait FOV');
