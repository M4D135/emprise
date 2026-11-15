#!/usr/bin/env python3
"""Record one actual shot from normal spawn through a complete police arrest."""
from browser_support import Browser,ROOT
import time,json,hashlib
with Browser() as b:
 b.load();ev=b.ev
 ev('RADE.game.session.weather.setHour(23);globalThis.initial=RADE.game.session.save();RADE.game.recorder.start("Patrouille à pied · interpellation de nuit");RADE.game.start();true');time.sleep(.2)
 b.cmd('Input.dispatchMouseEvent',{'type':'mousePressed','x':720,'y':450,'button':'left','clickCount':1});time.sleep(.06);b.cmd('Input.dispatchMouseEvent',{'type':'mouseReleased','x':720,'y':450,'button':'left','clickCount':1})
 b.wait('RADE.game.session.police.metrics.exits>0',25);b.capture('police-pursuit-demo.png');b.wait('!!RADE.game.session.campaign.law.lastArrest',25);time.sleep(1.2)
 ev('RADE.game.pause();true');tape=ev('RADE.game.recorder.stop()');tape['initial']=ev('initial');tape['source']='tests/police-demo.py / heure23h préparée, clic réel depuis le départ normal, poursuite et arrestation par la simulation';tape['expected']=ev('({shots:RADE.game.session.sim.state.shots,mode:RADE.game.session.mode,player:[RADE.game.session.player.x,RADE.game.session.player.z],car:[RADE.game.session.car.x,RADE.game.session.car.z],cash:RADE.game.session.campaign.state.cash,arrested:!!RADE.game.session.campaign.law.lastArrest,policeStation:RADE.game.session.interiors.active?.place?.kind==="police",ammo:RADE.game.session.sim.state.inventory.ammo})');assert tape['expected']['arrested'] and tape['expected']['policeStation'];assert not ev('RADE.game.errors')
 (ROOT/'docs/police-recording.json').write_text(json.dumps(tape,ensure_ascii=False,separators=(',',':'))+'\n');print(json.dumps({'duration':tape['duration'],'expected':tape['expected'],'errors':ev('RADE.game.errors')},ensure_ascii=False,indent=2),flush=True)
