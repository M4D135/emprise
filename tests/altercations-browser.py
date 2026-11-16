"""Actual FERRO street frame and integrated session. Isolated Chrome, no port."""
from browser_support import Browser,ROOT
import json,time,os
backend=os.environ.get('EMPRISE_RENDERER','webgl2')
with Browser() as b:
 b.load('?test=1&renderer='+backend)
 b.ev('RADE.game.start();true');b.wait('RADE.game.running&&RADE.game.ready&&!RADE.game.transition')
 b.ev('''(()=>{const g=RADE.game,s=g.session;g.controller=()=>({});
 const hash=id=>{let h=Math.imul(id^0x6d2b79f5,0x45d9f3b);h=Math.imul(h^(h>>>16),0x45d9f3b);return(h^(h>>>16))>>>0;};
 const list=s.traffic.cars.filter(c=>!c.police&&c.driver&&!RADE.vehicles.SPECS[c.model].two),a=list.find(c=>hash(c.id*7+3)%100<20),c=list.find(c=>c!==a);
 s.world.fleet.forEach(v=>{v.x=450;v.z=-450;v.ai=false;});s.sim.state.enemies.forEach(e=>e.deployed=false);s.crowd.people.forEach(p=>p.provocationCooldown=90);
 for(const [i,v] of [a,c].entries()){Object.assign(v,{x:61.5+i*5,z:181,cap:0,v:0,u:0,w:0,ai:true,moteur:true});Object.assign(v.driver,{x:v.x,z:v.z,inside:true,hp:100,fear:0,panic:0,grievance:0});}
 s.sim.relocate(61.5,173,0);s.altercations.noticeTraffic([1,2].map(()=>({name:'carHorn',vehicleId:a.id,reason:'vehicle'})));s.altercations.update(1/120,[]);
 window.disputeCars=[a.id,c.id];g.camera={pos:[64,1.8,175.7],yaw:Math.PI,pitch:-.13,fov:58,near:.05,far:900,thirdPerson:true};return true;})()''')
 b.wait('RADE.game.session.altercations.stats.strikes>=2',20)
 b.capture('altercations-'+backend+'.png')
 before=b.ev('''({stats:RADE.game.session.altercations.stats,cars:disputeCars.map(id=>{const c=RADE.game.session.world.fleet.find(c=>c.id===id);return{id,inside:c.driver.inside,hp:c.driver.hp,ai:c.ai};}),metrics:RADE.game.metrics(),heat:RADE.game.session.campaign.law.heat,errors:RADE.game.errors})''')
 assert all(not c['inside'] and c['hp']<100 and not c['ai'] for c in before['cars']),before
 assert not before['errors'] and before['heat']==0,before
 b.wait('disputeCars.every(id=>RADE.game.session.world.fleet.find(c=>c.id===id).driver.inside)',40)
 after=b.ev('''({stats:RADE.game.session.altercations.stats,cars:disputeCars.map(id=>{const c=RADE.game.session.world.fleet.find(c=>c.id===id);return{id,inside:c.driver.inside,ai:c.ai,engine:c.moteur,hp:c.driver.hp};}),errors:RADE.game.errors})''')
 assert all(c['inside'] and c['ai'] and c['engine'] and c['hp']>=25 for c in after['cars']),after
 assert not after['errors'],after
 report={'pass':True,'backend':backend,'build':json.loads((ROOT/'SIZE.json').read_text())['build'],'during':before,'after':after,'scope':'Scripted road dispute through real integrated session and rendered FERRO frames. 480 pedestrians retained, other vehicles moved away for controlled functional scenario. Not a full traffic stress/performance benchmark.'}
 (ROOT/'docs'/('altercations-browser-'+backend+'.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({'pass':True,'backend':backend,'during':before['stats'],'after':after['stats']}))
