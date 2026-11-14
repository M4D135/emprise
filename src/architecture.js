/* RADE — relief façades over the OSM footprints. No new geometry on roads. */
(function(R){'use strict';
function add(world){const {city,scenery,blocked}=world;let facades=0,windows=0,pieces=0;const views=[];
 const buildings=city.emprises.filter(b=>Math.abs(b.x)<310&&Math.abs(b.z)<310&&b.h>6&&b.lx>5&&b.lz>5).sort((a,b)=>Math.hypot(a.x-74,a.z-130)-Math.hypot(b.x-74,b.z-130));
 const colors=[[.77,.69,.54],[.74,.61,.48],[.83,.77,.64],[.67,.64,.54],[.80,.70,.58]],shutters=[[.19,.31,.29],[.31,.37,.40],[.37,.22,.18],[.36,.39,.29]];
 for(let index=0;index<buildings.length&&facades<240;index++){const b=buildings[index],a=-(b.lacet||0),c=Math.cos(a),s=Math.sin(a),h=Math.min(b.h,27),stone=colors[index%colors.length];
  for(const [nx,nz,width,edge]of [[-s,c,b.lx,b.lz/2],[s,-c,b.lx,b.lz/2],[c,s,b.lz,b.lx/2],[-c,-s,b.lz,b.lx/2]]){
   if(facades>=240||width<5||width>180)continue;const tx=nz,tz=-nx,cap=Math.atan2(tz,tx),base=[b.x+nx*edge,b.z+nz*edge];
   if(blocked(base[0]+nx*1.3,base[1]+nz*1.3,.35))continue;
   const at=(u,y,d)=>[base[0]+tx*u+nx*d,y,base[1]+tz*u+nz*d];
   const box=(u,y,d,size,color=stone,mat=3)=>{scenery.push({shape:mat===3&&size[0]<5&&size[1]<3?'bevel':'box',p:at(u,y,d),s:size,r:[0,-cap,0],color,mat,outdoor:true});pieces++;};
   // Blank plaster skin replaces the flat shader windows; modeled bays sit in front.
   box(0,(h+3.4)/2,.19,[width-.12,h-3.4,.045],stone,3);
   for(const [y,dep,thick]of [[3.5,.28,.17],[h-.40,.27,.15],[h-.17,.38,.20]])box(0,y,dep,[width+.25,thick,.22],stone.map(v=>v*1.06));
   const cols=Math.max(2,Math.floor((width-1)/2.9)),spacing=(width-.8)/cols,frame=stone.map(v=>Math.min(1,v*1.13)),dark=[.10,.14,.15],green=shutters[index%4];
   for(let row=0,y=5.0;y+1.03<h-.55;row++,y+=3.1){
    for(let col=0;col<cols;col++){const u=-width/2+.4+spacing*(col+.5),ww=Math.min(1.15,spacing*.44),wh=1.65;
     box(u,y,.235,[ww+.20,wh+.22,.07],dark,7);
     box(u,y,.281,[ww,wh,.025],[(index+col)%3?.16:.28,.25,.29],19);
     for(const side of [-1,1])box(u+side*(ww/2+.045),y,.32,[.075,wh+.24,.12],frame);
     box(u,y+wh/2+.08,.32,[ww+.22,.10,.14],frame);box(u,y-wh/2-.10,.39,[ww+.35,.11,.34],frame);
     box(u,y,.34,[.035,wh,.035],[.63,.65,.58]);box(u,y+.06,.34,[ww,.035,.035],[.63,.65,.58]);
     // Real shutter panels, slats and hinges, varied open/closed positions.
     for(const side of [-1,1]){const sw=ww*.43,su=u+side*(ww/2+sw/2+.14);box(su,y,.30,[sw,wh+.05,.065],green,7);if((index+col+row)%3!==0)for(let k=0;k<6;k++)box(su,y-.65+k*.25,.34,[sw*.85,.032,.018],green.map(v=>v*.68),7);}
     if(row===0&&(index+col)%3===0){box(u,y-wh/2-.16,.57,[ww+1,.13,.92],frame);box(u,y-.17,.99,[ww+.9,.045,.045],dark);for(let k=0;k<8;k++)box(u-(ww+.8)/2+k*(ww+.8)/7,y-.51,.99,[.023,.67,.023],dark);for(const side of [-1,1])box(u+side*(ww+.85)/2,y-.17,.64,[.03,.03,.72],dark);}
     if((index+col+row)%7===0){box(u,y-wh/2+.02,.48,[ww*.7,.20,.20],[.47,.25,.14],7);for(let k=0;k<3;k++)box(u-.25+k*.25,y-wh/2+.20,.49,[.15,.16,.14],[.24,.37,.19],7);}
     windows++;
    }
    if(row>0&&row%2===0)box(0,y-1.25,.28,[width,.075,.15],frame);
   }
   // Corner ashlar, downpipe and roof chimney remain outside the walking envelope.
   for(const side of [-1,1])for(let y=3.9;y<h-.7;y+=.8)box(side*(width/2-.23),y,.26,[.36,.36,.12],frame);
   box(width/2-.52,(h+1)/2,.31,[.075,h-1,.085],[.30,.33,.31]);for(let y=2;y<h;y+=2.8)box(width/2-.52,y,.36,[.14,.055,.10],[.18,.22,.20],0);
   if(index%3===0){box(0,h+.5,-1.1,[.62,1.0,.62],[.50,.35,.25]);box(0,h+1.04,-1.1,[.82,.13,.82],[.33,.32,.28]);}
   views.push({x:base[0],z:base[1],nx,nz,h,width});facades++;
  }
 }
 return {facades,windows,pieces,views};
}
R.architecture={add};})(globalThis.RADE);
