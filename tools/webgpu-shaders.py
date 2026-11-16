#!/usr/bin/env python3
"""Offline, reproducible port of the original FERRO GLSL via Naga 30.0.1.
No compiler, imported asset or network request is needed by the playable build.
"""
from pathlib import Path
import re,json,subprocess,hashlib,argparse,os,shutil
ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT.parent.parent/'work/webgpu-shaders';WORK.mkdir(parents=True,exist_ok=True)
NODE=os.environ.get('NODE') or shutil.which('node') or str(Path.home()/'.local/node/bin/node')
COMPILER=ROOT.parent.parent/'work/webgpu-compiler-target/release/ferro-webgpu-compiler'
UNIFORM=re.compile(r'\buniform\s+(?:(?:highp|mediump|lowp)\s+)?(\w+)\s+(\w+)\s*(?:\[\s*(\d+)\s*\])?\s*;')
IO=re.compile(r'(?P<layout>layout\s*\([^)]*\)\s*)?(?P<flat>flat\s+)?(?P<way>in|out)\s+(?P<type>\w+)\s+(?P<name>\w+)\s*;')
RT={'uShadowMap','uDepth','uColor','uScene','uBloom','uReflection','uPdrOmbre'}
DEPTH={'uShadowMap','uDepth','uPdrOmbre'}
def source_programs():
 script="""const fs=require('fs'),vm=require('vm');let source=fs.readFileSync('src/ferro/renderer.js','utf8');source=source.replace('globalThis.FRender=', 'globalThis.__ferroShaders={VERT,FRAG,FX_VERT,FX_FRAG,DEPTH_FRAG,POST_VERT,SKY_FRAG,SSR_FRAG,POST_FRAG,PDR_GLSL};globalThis.FRender=');vm.runInThisContext(source);const s=globalThis.__ferroShaders;const gait=fs.readFileSync('src/human.js','utf8').match(/const gaitGLSL=(`[^`]*`)/);if(!gait)throw Error('Missing original human gait shader');globalThis.RADE={human:{gaitGLSL:vm.runInThisContext(gait[1])}};vm.runInThisContext(fs.readFileSync('src/ferro/crowd.js','utf8'));vm.runInThisContext(fs.readFileSync('src/pdr/foule.js','utf8'));const crowd=PDR.foule.shaderSources(s.PDR_GLSL);const result={world:{vertex:s.VERT,fragment:s.FRAG},depth:{vertex:s.VERT,fragment:s.DEPTH_FRAG},sky:{vertex:s.POST_VERT,fragment:s.SKY_FRAG},fx:{vertex:s.FX_VERT,fragment:s.FX_FRAG},post:{vertex:s.POST_VERT,fragment:s.POST_FRAG},ssr:{vertex:s.POST_VERT,fragment:s.SSR_FRAG},crowd:crowd.crowd,crowdShadow:crowd.crowdShadow,crowdPoint:crowd.crowdPointGPU};console.log(JSON.stringify(result));"""
 result=json.loads(subprocess.check_output([NODE,'-e',script],cwd=ROOT,text=True))
 return result

def strip_comments(src):return re.sub(r'/\*.*?\*/|//[^\n]*','',src,flags=re.S)
def call_replace(src,name,fn):
 # Balanced call parser; handles nested constructors, not a greedy regex.
 pattern=re.compile(r'\b'+re.escape(name)+r'\s*\(');at=0
 while (m:=pattern.search(src,at)):
  end=m.end();depth=1;parts=[];start=end
  while depth:
   c=src[end]
   if c=='(':depth+=1
   elif c==')':
    depth-=1
    if not depth:parts.append(src[start:end]);break
   elif c==',' and depth==1:parts.append(src[start:end]);start=end+1
   end+=1
  replacement=fn(parts)
  if replacement is None:at=end+1;continue
  src=src[:m.start()]+replacement+src[end+1:];at=m.start()+len(replacement)
 return src

def array_replace(src,name):
 pattern=re.compile(r'\b'+re.escape(name)+r'\s*\[');at=0
 while (m:=pattern.search(src,at)):
  end=m.end();start=end;depth=1
  while depth:
   if src[end]=='[':depth+=1
   elif src[end]==']':depth-=1
   if depth:end+=1
  replacement='ferro_'+name+'(int('+src[start:end]+'))'
  src=src[:m.start()]+replacement+src[end+1:];at=m.start()+len(replacement)
 return src

def compile_pair(name,pair):
 srcs={k:strip_comments(pair[k]) for k in ('vertex','fragment')}
 if name=='world':srcs['fragment']=srcs['fragment'].replace('color*=mix(.59,1.,vignette);','color*=mix(uVignette,1.,vignette);')+'\nuniform float uVignette;\n'
 if name=='post':srcs['fragment']=srcs['fragment'].replace('smoothstep(.56,.86,max(max(c.r,c.g),c.b))','smoothstep(uBloomThreshold.x,uBloomThreshold.y,max(max(c.r,c.g),c.b))')+'\nuniform vec2 uBloomThreshold;\n'
 if name in ('crowd','crowdPoint'):
  srcs['fragment']=re.sub(r'mix\(\.(?:59|9|9000),1\.,pow',r'mix(uVignette,1.,pow',srcs['fragment'])+'\nuniform float uVignette;\n'
 declarations={}
 for src in srcs.values():
  for m in UNIFORM.finditer(src):
   value=(m[1],int(m[3] or 1));assert m[2] not in declarations or declarations[m[2]]==value
   declarations[m[2]]=value
 fields=[];textures=[];slots=0;binding=1
 for uname,(typ,count) in declarations.items():
  if 'sampler' in typ:
   depth=uname in DEPTH;uint=typ.startswith('u');array='Array' in typ
   textures.append(dict(name=uname,binding=binding,samplerBinding=binding+1,dimension='2d-array' if array else '2d',depth=depth,sampleType='depth' if depth else 'uint' if uint else 'unfilterable-float' if uname in {'uCour','uPrec','uLocomotion'} else 'float',samplerType='non-filtering' if depth or uint or uname in {'uCour','uPrec','uLocomotion'} else 'filtering',sourceType=typ,renderTarget=uname in RT));binding+=2;continue
  columns=4 if typ=='mat4' else 1
  fields.append(dict(name=uname,type=typ,offset=slots*16,count=count,arrayStride=columns*16,matrixStride=16 if typ=='mat4' else 0));slots+=count*columns
 uniforms={'byteLength':max(16,slots*16),'fields':fields}
 # Vertex output and fragment input locations must match by semantic name.
 varyings={}
 for stage,src in srcs.items():
  for m in IO.finditer(src):
   if (stage=='vertex' and m['way']=='out') or (stage=='fragment' and m['way']=='in'):
    if m['name'] not in varyings:varyings[m['name']]=len(varyings)
 out={'uniforms':uniforms,'textures':textures,'entryPoint':'main','sourceSha256':hashlib.sha256((pair['vertex']+pair['fragment']).encode()).hexdigest()}
 for stage,src in srcs.items():
  src=UNIFORM.sub('',src);src=re.sub(r'#version[^\n]*','',src);src=re.sub(r'precision\s+\w+\s+\w+\s*;','',src)
  src=re.sub(r'\bgl_VertexID\b','gl_VertexIndex',src);src=re.sub(r'\bgl_InstanceID\b','int(gl_InstanceIndex)',src)
  def io(m):
   if m['layout']:return m[0]
   if stage=='vertex' and m['way']=='in':raise ValueError('Vertex input missing location '+m[0])
   loc=0 if stage=='fragment' and m['way']=='out' else varyings[m['name']]
   return f"layout(location={loc}) "+(m['flat'] or '')+m['way']+' '+m['type']+' '+m['name']+';'
  src=IO.sub(io,src)
  definitions=[f'layout(set=0,binding=0,std140) uniform FerroUniforms {{ vec4 data[{max(1,slots)}]; }} ferroUniforms;']
  for f in fields:
   uname,typ,count=f['name'],f['type'],f['count'];slot=f['offset']//16
   base=str(slot) if count==1 else f'{slot}+index*{f["arrayStride"]//16}'
   def word(n=0):return f'ferroUniforms.data[{base}'+(f'+{n}' if n else '')+']'
   if typ=='mat4':expr='mat4('+','.join(word(n) for n in range(4))+')'
   else:
    width=1 if typ in ('float','int','uint','bool') else int(typ[-1]);expr=word()+'.'+'xyzw'[:width]
    if typ.startswith('i') or typ=='int':expr='floatBitsToInt('+expr+')'
    elif typ.startswith('u') or typ=='uint':expr='floatBitsToUint('+expr+')'
    elif typ=='bool':expr='('+expr+'!=0.)'
   if count==1:definitions.append(f'#define {uname} ({expr})')
   else:definitions.append(f'{typ} ferro_{uname}(int index){{return {expr};}}');src=array_replace(src,uname)
  for tex in textures:
   uname=tex['name'];typ=tex['sourceType'];base=typ.replace('sampler','texture')
   definitions.append(f'layout(set=0,binding={tex["binding"]}) uniform {base} {uname}_texture;')
   definitions.append(f'layout(set=0,binding={tex["samplerBinding"]}) uniform sampler {uname}_sampler;')
   definitions.append(f'#define {uname} {typ}({uname}_texture,{uname}_sampler)')
  texture_map={t['name']:t for t in textures}
  # Generated texture accesses retain GL coordinates except render targets,
  # whose physical first row is top-down in WebGPU.
  def texture_call(args):
   uname=args[0].strip();tex=texture_map.get(uname)
   if not tex:return None
   uv=args[1];uv=f'vec2(({uv}).x,1.-({uv}).y)' if tex['renderTarget'] else uv
   if tex['depth'] or stage=='vertex':return 'textureLod('+uname+','+uv+',0.)'
   return 'texture('+uname+','+uv+(' ,'+','.join(args[2:]) if len(args)>2 else '')+')'
  src=call_replace(src,'texture',texture_call)
  # GLSL's lower-left framebuffer makes positive screen Y point upward; WGSL
  # dpdy uses WebGPU's top-left framebuffer. Restore GL derivative orientation,
  # especially the cotangent PBR frame (otherwise both tangent axes invert).
  src=call_replace(src,'dFdy',lambda args:'(-dFdy('+','.join(args)+'))')
  if stage=='vertex':
   # Wrapper is mandatory: early returns in crowd shaders must also convert Z.
   src=re.sub(r'\bvoid\s+main\s*\(', 'void ferro_main(',src)
   src+='\nvoid main(){ferro_main();gl_Position.z=(gl_Position.z+gl_Position.w)*.5;}\n'
  glsl='#version 450 core\n'+'\n'.join(definitions)+'\n'+src
  path=WORK/(name+'.'+('vert' if stage=='vertex' else 'frag'));path.write_text(glsl)
  wgsl=path.with_suffix(path.suffix+'.wgsl')
  result=subprocess.run([str(COMPILER),'vert' if stage=='vertex' else 'frag',str(path),str(wgsl)],capture_output=True,text=True)
  if result.returncode:raise RuntimeError(f'{name} {stage}\n'+result.stdout+result.stderr)
  code=wgsl.read_text()
  # GLSL has no non-comparison depth sampler type. Retype only declared depth
  # inputs and preserve the original vec4 result consumed by .r expressions.
  for tex in textures:
   if not tex['depth']:continue
   var=tex['name']+'_texture';code=code.replace(f'{var}: texture_2d<f32>',f'{var}: texture_depth_2d')
   def depth_call(args):
    if args[0].strip()!=var:return None
    args[-1]='0';return 'vec4<f32>(textureSampleLevel('+','.join(args)+'),0.0,0.0,1.0)'
   code=call_replace(code,'textureSampleLevel',depth_call)
  code='diagnostic(off, derivative_uniformity);\n'+code
  wgsl.write_text(code)
  validated=wgsl.with_suffix('.validated.wgsl');r=subprocess.run([str(COMPILER),'wgsl',str(wgsl),str(validated)],capture_output=True,text=True)
  if r.returncode:raise RuntimeError(f'{name} {stage} post-port validation\n'+r.stdout+r.stderr)
  out[stage]=code
 return out

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--only');args=parser.parse_args()
 if not COMPILER.exists():
  cargo=os.environ.get('CARGO') or shutil.which('cargo') or str(Path.home()/'.cargo/bin/cargo')
  subprocess.run([cargo,'build','--release','--locked','--manifest-path',str(ROOT/'tools/webgpu-compiler/Cargo.toml'),'--target-dir',str(COMPILER.parents[1])],check=True)
 programs=source_programs();output={}
 for name,pair in programs.items():
  if args.only and name not in args.only.split(','):continue
  output[name]=compile_pair(name,pair);print(name,output[name]['uniforms']['byteLength'],len(output[name]['vertex'])+len(output[name]['fragment']),flush=True)
 data={'generator':'FERRO GLSL→WGSL / Naga 30.0.1','programs':output}
 target=ROOT/'src/ferro/webgpu-shaders.js';target.write_text('/* Generated offline from the original procedural FERRO shaders. Regenerate: python3 tools/webgpu-shaders.py */\nglobalThis.FRenderWebGPUShaders='+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n')
 (WORK/'manifest.json').write_text(json.dumps({k:{a:b for a,b in v.items() if a not in ('vertex','fragment')} for k,v in output.items()},indent=2)+'\n')
if __name__=='__main__':main()
