#!/usr/bin/env python3
"""Validate the original parametric face generator without imported mesh data."""
from pathlib import Path
import subprocess
root=Path(__file__).resolve().parents[1]
subprocess.run(['node','--input-type=module','-e',"await import('./src/human-data.js');const m=RADE.humanData;if(!m.positions.flat().every(Number.isFinite)||m.indices.some(i=>i>=m.count))throw Error('Invalid procedural head');console.log(JSON.stringify({provenance:RADE.proceduralHuman.provenance,vertices:m.count,triangles:m.indices.length/3}));"],cwd=root,check=True)
