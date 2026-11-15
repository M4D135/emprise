from browser_support import Browser,ROOT
import time,json,hashlib
with Browser() as b:
 b.load('');b.wait('RADE.game.demo',10);first=b.ev('document.getElementById("attract-label").textContent');duration=b.ev('RADE.replays[0].duration')
 b.wait('!RADE.game.demo',duration+10);returned=time.monotonic();assert not b.ev('document.getElementById("title").hidden');b.wait('RADE.game.demo',9);delay=time.monotonic()-returned
 assert 4.5<delay<6.5,delay;second=b.ev('document.getElementById("attract-label").textContent');assert first!=second;assert 'Commerce' in second;assert not b.ev('RADE.game.errors')
 data={'first':first,'next':second,'titlePauseSeconds':delay,'errors':b.ev('RADE.game.errors'),'buildSha256':hashlib.sha256((ROOT/'dist/index.html').read_bytes()).hexdigest()};(ROOT/'docs/demo-cycle.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');print(data,flush=True)
