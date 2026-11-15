use std::{env,fs};
fn main(){
 let args:Vec<String>=env::args().collect();
 if args.len()!=4 {eprintln!("usage: compiler vert|frag|wgsl source output");std::process::exit(2)}
 let source=fs::read_to_string(&args[2]).unwrap();
 let module=if args[1]=="wgsl" {naga::front::wgsl::parse_str(&source).unwrap_or_else(|e|{eprintln!("{}",e.emit_to_string(&source));std::process::exit(1)})}else{
  let stage=if args[1]=="vert"{naga::ShaderStage::Vertex}else{naga::ShaderStage::Fragment};
  naga::front::glsl::Frontend::default().parse(&naga::front::glsl::Options::from(stage),&source).unwrap_or_else(|e|{eprintln!("{}",e.emit_to_string(&source));std::process::exit(1)})
 };
 let flags=naga::valid::ValidationFlags::all()-naga::valid::ValidationFlags::CONTROL_FLOW_UNIFORMITY;
 let info=naga::valid::Validator::new(flags,naga::valid::Capabilities::all()).validate(&module).unwrap_or_else(|e|{eprintln!("{}",e.emit_to_string(&source));std::process::exit(1)});
 let result=naga::back::wgsl::write_string(&module,&info,naga::back::wgsl::WriterFlags::EXPLICIT_TYPES).unwrap_or_else(|e|{eprintln!("{e:?}");std::process::exit(1)});
 fs::write(&args[3],result).unwrap();
}
