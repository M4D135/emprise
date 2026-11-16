#!/usr/bin/env python3
"""Run the frozen METAL contract suites against the actual common modules.

Usage: python3 tools/check-ferro-donor.py --metal /path/to/metal/checkout
No source checkout is modified; the harness is recreated under work/.
"""
import argparse, json, pathlib, subprocess, time
ROOT = pathlib.Path(__file__).resolve().parents[1]
p = argparse.ArgumentParser()
p.add_argument('--metal', required=True, type=pathlib.Path)
args = p.parse_args()
spec = json.loads((ROOT/'FERRO.json').read_text())
commit = spec['origins']['metal']
dest = ROOT/'work/common-donor-validation'
dest.mkdir(parents=True, exist_ok=True)
def git(*argv):
    return subprocess.check_output(['git', '-C', str(args.metal), *argv])
for path in git('ls-tree', '-r', '--name-only', commit, 'src', 'checks').decode().splitlines():
    if pathlib.Path(path).suffix not in ['.js', '.mjs', '.json']:
        continue
    target = dest/path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(git('show', commit+':'+path))
for name in ['audio', 'input', 'motion', 'effects', 'renderer', 'music', 'imuse']:
    (dest/'src'/f'{name}.js').write_bytes((ROOT/'src/ferro'/f'{name}.js').read_bytes())
# The engine exposes shared CPU geometry without modifying its source.
effects = dest/'checks/effects.test.mjs'
code = effects.read_text().replace('const geometryScope={window:{}};', 'const geometryScope={};geometryScope.window=geometryScope;').replace('geometryScope.window.FRender.geometry()', 'geometryScope.window.FRender.shared.geometry()').replace('geometryScope.window.FRender.pack,', 'geometryScope.window.FRender.shared.pack,')
effects.write_text(code)
effects.write_text(effects.read_text().replace('range.offset/2', 'range.offset/geometry.indices.BYTES_PER_ELEMENT'))
fixture = dest/'checks/mesh-fixture.mjs'
fixture.write_text(fixture.read_text().replace('scope.window.FRender', 'scope.FRender'))
results = []
out = ROOT/'work/unified-validation'
out.mkdir(parents=True, exist_ok=True)
# Audio synthesis is deliberately isolated to avoid competing test workers.
for suite in ['audio', 'finput', 'effects', 'motion', 'music', 'imuse', 'music-preparation']:
    start = time.monotonic()
    run = subprocess.run(['node', '--test', '--test-reporter=tap', str(dest/'checks'/f'{suite}.test.mjs')], capture_output=True, text=True)
    (out/f'donor-{suite}.tap').write_text(run.stdout+run.stderr)
    result = {'suite': suite, 'exit': run.returncode, 'seconds': round(time.monotonic()-start, 2)}
    results.append(result)
    print(json.dumps(result), flush=True)
(out/'donor.json').write_text(json.dumps({'source': commit, 'suites': results}, indent=2)+'\n')
assert all(result['exit']==0 for result in results), 'A common module violated a donor contract; inspect the saved TAP logs.'
