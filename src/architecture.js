/* EMPRISE — procedural relief on real OSM footprints. Reference photos are never textures. */
(function(R){'use strict';
let archReady=false;
function registerArch(){
 if(archReady||typeof FRender==='undefined'||typeof BITUME==='undefined')return;
 const triangles=[],outer=1,inner=.80,depth=.18;
 const tri=(a,b,c)=>{const u=b.map((v,i)=>v-a[i]),v=c.map((n,i)=>n-a[i]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...n)||1,nn=n.map(v=>v/l);triangles.push([a,b,c,nn,nn,nn]);};
 const quad=(a,b,c,d)=>{tri(a,b,c);tri(a,c,d);};
 const p=(angle,r,z)=>[Math.cos(angle)*r,Math.sin(angle)*r,z];
 for(let j=0;j<20;j++){const a=j*Math.PI/20,b=(j+1)*Math.PI/20;
  for(const z of [-depth/2,depth/2]){const q=[p(a,outer,z),p(b,outer,z),p(b,inner,z),p(a,inner,z)];if(z<0)q.reverse();quad(...q);}
  for(const r of [outer,inner]){const q=[p(a,r,-depth/2),p(b,r,-depth/2),p(b,r,depth/2),p(a,r,depth/2)];if(r===inner)q.reverse();quad(...q);}
 }
 for(const a of [0,Math.PI]){const q=[p(a,inner,-depth/2),p(a,outer,-depth/2),p(a,outer,depth/2),p(a,inner,depth/2)];if(a===Math.PI)q.reverse();quad(...q);}
 const n=BITUME.carene.normaliser(triangles);FRender.forme('emprise-pouillon-arch',n.triangles);archReady=true;
}
function add(world){
 registerArch();const {city,scenery,blocked}=world,bounds=world.bounds||{minX:-550,maxX:550,minZ:-550,maxZ:550};let facades=0,windows=0,pieces=0,arcades=0,pouillonFacades=0;const views=[];
 // BAN 42–66 quai du Port, matching source building 1546. Only these verified boxes get this profile.
 const anchors=[[-228.215758,-21.764876],[-179.985267,-28.733730]];
 const pouillonBox=b=>anchors.some(a=>Math.hypot(b.x-a[0],b.z-a[1])<2.5);
 const buildings=city.emprises.filter(b=>b.x>bounds.minX+4&&b.x<bounds.maxX-4&&b.z>bounds.minZ+4&&b.z<bounds.maxZ-4&&b.h>6&&b.lx>5&&b.lz>5).sort((a,b)=>(pouillonBox(b)?1:0)-(pouillonBox(a)?1:0)||Math.hypot(a.x-40,a.z-60)-Math.hypot(b.x-40,b.z-60));
 const colors=[[.77,.69,.54],[.74,.65,.53],[.83,.77,.64],[.67,.64,.54],[.80,.72,.60]],shutters=[[.19,.31,.29],[.31,.37,.40],[.37,.22,.18],[.36,.39,.29]];
 for(let index=0;index<buildings.length&&facades<240;index++){
  const b=buildings[index],a=-(b.lacet||0),c=Math.cos(a),s=Math.sin(a),h=Math.min(b.h,27);
  for(const [nx,nz,width,edge]of [[-s,c,b.lx,b.lz/2],[s,-c,b.lx,b.lz/2],[c,s,b.lz,b.lx/2],[-c,-s,b.lz,b.lx/2]]){
   if(facades>=240||width<5||width>180)continue;const tx=nz,tz=-nx,cap=Math.atan2(tz,tx),base=[b.x+nx*edge,b.z+nz*edge];
   if(blocked(base[0]+nx*1.3,base[1]+nz*1.3,.35))continue;
   const pouillon=pouillonBox(b)&&nz>.65,stone=pouillon?[.78,.72,.57]:colors[index%colors.length],frame=stone.map(v=>Math.min(1,v*1.10)),dark=[.11,.14,.145],green=shutters[index%4],baseY=pouillon?4.35:3.4;
   const at=(u,y,d)=>[base[0]+tx*u+nx*d,y,base[1]+tz*u+nz*d];
   const box=(u,y,d,size,color=stone,mat=3,detail=1)=>{scenery.push({shape:mat===3&&size[0]<5&&size[1]<3?'bevel':'box',p:at(u,y,d),s:size,r:[0,-cap,0],color,mat,outdoor:true,detail});pieces++;};
   box(0,(h+baseY)/2,.19,[width-.12,h-baseY,.045],stone,3,0);
   for(const [y,dep,thick]of [[baseY+.10,.28,.17],[h-.40,.27,.15],[h-.17,.38,.20]])box(0,y,dep,[width-.12,thick,.22],frame,3,1);
   if(pouillon){
    pouillonFacades++;let bays=Math.max(1,Math.floor((width-.8)/4.1));if(bays%2===0)bays--;const span=(width-.70)/bays,r=span/2-.16,spring=2.03;
    // Shallow arcaded shop-front relief, kept against the existing footprint. No fake walk-through gallery.
    for(let j=0;j<bays;j++){const u=-width/2+.35+span*(j+.5);
     box(u,1.45,.055,[span-.72,2.65,.025],[.15,.19,.20],19,1);
     box(u,1.45,.10,[.055,2.65,.065],[.22,.24,.22],7,2);
     if(archReady){scenery.push({shape:'emprise-pouillon-arch',p:at(u,spring+r/2,.22),s:[r*2,r,.25],r:[0,-cap,0],color:stone,mat:3,outdoor:true,detail:1});pieces++;arcades++;}
     for(const side of [-1,1])box(u+side*(span/2-.16),spring/2,.20,[.35,spring,.32],stone,3,1);
     box(u,spring+r+.12,.17,[span-.10,.22,.28],frame,3,1);
    }
   }
   // Leave enough clear masonry for complete shutter panels and balcony end rails at both corners.
   const margin=1.15,usable=width-2*margin,cols=Math.max(1,Math.floor(usable/(pouillon?3.35:2.9))),spacing=usable/cols;
   for(let row=0,y=pouillon?6.05:5.0;y+1.03<h-.55;row++,y+=3.1){
    for(let col=0;col<cols;col++){
     const u=-width/2+margin+spacing*(col+.5),ww=Math.min(pouillon?1.35:1.15,spacing*.43),wh=pouillon?1.75:1.65;
     box(u,y,.235,[ww+.20,wh+.22,.07],dark,7,1);box(u,y,.281,[ww,wh,.025],[.17,.24,.27],19,1);
     for(const side of [-1,1])box(u+side*(ww/2+.045),y,.32,[.075,wh+.24,.12],frame,3,1);
     box(u,y+wh/2+.08,.32,[ww+.22,.10,.14],frame,3,1);box(u,y-wh/2-.10,.39,[ww+.35,.11,.34],frame,3,1);
     box(u,y,.34,[.035,wh,.035],[.59,.61,.55],7,2);box(u,y+.06,.34,[ww,.035,.035],[.59,.61,.55],7,2);
     if(!pouillon)for(const side of [-1,1]){const sw=ww*.40,su=u+side*(ww/2+sw/2+.13);box(su,y,.30,[sw,wh+.05,.065],green,7,1);if((index+col+row)%3!==0)for(let k=0;k<6;k++)box(su,y-.65+k*.25,.34,[sw*.85,.032,.018],green.map(v=>v*.68),7,2);}
     if((pouillon&&row===0)||(!pouillon&&row===0&&(index+col)%3===0)){
      const bw=ww+.65;box(u,y-wh/2-.16,.53,[bw+.12,.13,.75],frame,3,1);box(u,y-.17,.88,[bw,.04,.04],dark,0,1);
      for(let k=0;k<7;k++)box(u-bw/2+k*bw/6,y-.51,.88,[.022,.67,.022],dark,0,2);
      for(const side of [-1,1])box(u+side*bw/2,y-.17,.60,[.03,.03,.58],dark,0,2);
     }
     if(!pouillon&&(index+col+row)%11===0){box(u,y-wh/2+.02,.48,[ww*.7,.20,.20],[.47,.25,.14],7,2);for(let k=0;k<3;k++)box(u-.25+k*.25,y-wh/2+.20,.49,[.15,.16,.14],[.24,.37,.19],7,2);}
     windows++;
    }
    if(pouillon||row>0&&row%2===0)box(0,y-1.25,.265,[width-.2,.045,.10],frame,3,2);
   }
   for(const side of [-1,1])for(let y=baseY+.5;y<h-.7;y+=.8)box(side*(width/2-.23),y,.26,[.36,.36,.12],frame,3,2);
   box(width/2-.52,(h+1)/2,.31,[.075,h-1,.085],[.30,.33,.31],7,1);
   for(let y=2;y<h;y+=2.8)box(width/2-.52,y,.36,[.14,.055,.10],[.18,.22,.20],0,2);
   if(!pouillon&&index%3===0){box(0,h+.5,-1.1,[.62,1.0,.62],[.50,.35,.25],3,1);box(0,h+1.04,-1.1,[.82,.13,.82],[.33,.32,.28],3,1);}
   views.push({x:base[0],z:base[1],nx,nz,h,width,profile:pouillon?'pouillon-quai-du-port':'plaster-shutters'});facades++;
  }
 }
 return {facades,windows,pieces,views,arcades,pouillonFacades};
}
R.architecture={add};})(globalThis.RADE);
