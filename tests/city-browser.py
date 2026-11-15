#!/usr/bin/env python3
"""Expanded Marseille: actual walking after prepared locations, streaming and geographic land checks."""
from browser_support import Browser,ROOT
import time,json,hashlib,math
with Browser() as b:
 b.load();ev=b.ev;ev('RADE.game.start();globalThis.s=RADE.game.session;globalThis.w=s.world;s.campaign.law.wanted=0;s.sim.state.enemies.forEach(e=>e.deployed=false);true');checks=[];views=[]
 ev('''globalThis.locateRoad=(tx,tz)=>{const ix=Math.floor(tx/512),iz=Math.floor(tz/512),found=[];for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){const t=RADE.cityData.decode((ix+dx)+','+(iz+dz));if(!t)continue;for(const r of t.roads){if(r.tunnel||r.bridge)continue;for(let i=1;i<r.points.length;i++){const a=r.points[i-1],b=r.points[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<10)continue;const x=(a[0]+b[0])/2,z=(a[1]+b[1])/2,cap=Math.atan2(b[1]-a[1],b[0]-a[0]);let free=true;for(let d=0;d<6;d+=.5){const xx=x+Math.cos(cap)*d,zz=z+Math.sin(cap)*d;if(w.water(xx,zz)||w.blocked(xx,zz,.32,w.ground(xx,zz),1.8)){free=false;break;}}if(free)found.push({x,z,cap,name:r.name||r.class,d:Math.hypot(tx-x,tz-z)});}}}return found.sort((a,b)=>a.d-b.d)[0]||null;};true''')
 def walk(seconds):
  b.cmd('Input.dispatchKeyEvent',{'type':'keyDown','code':'KeyW','key':'w'});time.sleep(seconds);b.cmd('Input.dispatchKeyEvent',{'type':'keyUp','code':'KeyW','key':'w'});time.sleep(.15)
 places=[('panier',43.301,5.366),('prado',43.270,5.391),('saint-barnabe',43.303,5.414),('estaque',43.362,5.318),('pointe-rouge',43.242,5.371)]
 for name,lat,lon in places:
  x=(lon-5.3734)*111320*math.cos(math.radians(43.2962));z=(43.2962-lat)*111320
  q=ev(f'locateRoad({x},{z})');assert q,(name,'no clear real road found')
  ev('globalThis.place='+json.dumps(q)+';s.sim.relocate(place.x,place.z,place.cap+Math.PI/2);true');time.sleep(.25);b.wait('!w.cityStream.pending&&w.cityStream.stats.residentChunks>0',60)
  assert ev('!w.blocked(s.player.x,s.player.z,.28,s.player.y,1.8)&&!w.water(s.player.x,s.player.z)')
  before=ev('({x:s.player.x,z:s.player.z})');walk(1.1);after=ev('({x:s.player.x,z:s.player.z})');distance=math.hypot(after['x']-before['x'],after['z']-before['z']);assert distance>.4,(name,distance)
  ev('RADE.game.samples.length=0;RADE.game.cpuSamples.length=0;true');time.sleep(1.8);metrics=ev('RADE.game.metrics()');ev('RADE.game.camera={pos:[s.player.x,32+w.ground(s.player.x,s.player.z),s.player.z],yaw:s.player.yaw,pitch:-.22,roll:0,fov:74};true');time.sleep(.25);b.capture('city-'+name+'.png');ev('RADE.game.camera=null;true')
  views.append({'area':name,'location':q,'walkDistance':distance,'metrics':metrics,'stream':ev('({...w.cityStream.stats})')});assert ev('w.cityStream.stats.residentChunks<=9')
 checks.append('Cinq quartiers : coordonnées préparées sur routes OSM, marche W réelle, sols solides et chunks résidents limités à neuf')
 # A prepared unobstructed crossing of the historical 550m edge is walked normally.
 seam=ev('''(()=>{for(let z=-540;z<540;z+=3){let good=true;for(let x=545;x<=559;x+=.5)if(w.blocked(x,z,.3,w.ground(x,z),1.8)){good=false;break;}if(good)return {x:545,z};}return null;})()''');assert seam,'No unobstructed core seam available';ev('s.sim.relocate('+str(seam['x'])+','+str(seam['z'])+',Math.PI/2);true');walk(3);assert ev('s.player.x>552');checks.append('Ancienne limite du centre franchie à pied avec W, sans téléportation pendant le déplacement')
 land=[]
 for name,x,z in [('if',-3834,1826),('riou',1264,13446),('calanques',3600,9100)]:
  state=ev(f'({{water:w.water({x},{z}),ground:w.ground({x},{z}),bounds:w.navigationBounds}})');land.append({'place':name,'x':x,'z':z,**state});assert not state['water'],(name,state)
  ev(f'RADE.game.camera={{pos:[{x-350},260,{z+650}],yaw:Math.atan2(350,-650),pitch:-.25,roll:0,fov:74}};true');time.sleep(.4);b.capture('coast-'+name+'.png')
 ev('RADE.game.camera=null;true');assert ev('w.water(-8000,5000)&&!w.water(1000,-9000)');assert ev('w.marineBuoys.length>500');checks.append('Îles d’If/Riou, Calanques et terre au nord contrôlées ; mer extérieure navigable et bouées de limite présentes')
 assert not ev('RADE.game.errors');report={'checks':checks,'neighbourhoods':views,'coast':land,'errors':ev('RADE.game.errors'),'fixture':'Points de départ et caméras préparés ; déplacements clavier et chargement de quartiers exécutés par le jeu. Contours géographiques OSM, relief côtier procédural non mesuré. Les mesures ci-dessus concernent cette machine et ces vues, sans garantie 60 FPS générale.','buildSha256':hashlib.sha256((ROOT/'dist/index.html').read_bytes()).hexdigest()};(ROOT/'docs/city-browser.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False,indent=2),flush=True)
