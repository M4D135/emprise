#!/usr/bin/env python3
"""Validate the original runtime body generator; no external model or mesh inputs."""
from pathlib import Path
import subprocess
root=Path(__file__).resolve().parents[1]
subprocess.run(['node','--input-type=module','-e',"await import('./src/human-data.js');await import('./src/body-data.js');const m=RADE.bodyData;if(!m.positions.flat().every(Number.isFinite)||m.indices.some(i=>i>=m.count))throw Error('Invalid procedural body');console.log(JSON.stringify({provenance:m.provenance,vertices:m.count,triangles:m.indices.length/3}));"],cwd=root,check=True)
