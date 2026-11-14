/* RADE : extraction de drawGun, METAL game.js. */
(function(G){G.FWeapon={build(s,camera,motion){const quality='high',p=s.player,out=[],paired=false,leftMotion=motion; const m=(shape,p,s,mat,r=[0,0,0],emissive=0)=>({shape,p,s,mat,r,emissive});
      function drawGun(weapon,hand){
      const fracture=weapon===1,rocket=weapon===2,grenade=weapon===3,pistol=weapon===4,pose=(hand<0?leftMotion:motion).view.weapon,slide=pose.slide,flash=hand<0?(s.leftFlash||0):s.flash;
      const grip=FMotion.mount(camera,[hand*.255*Math.min(1,Math.max(.45,(innerWidth/innerHeight)/1.2))+pose.offset[0]*hand,(paired?-.34:-.30)+pose.offset[1],(paired?-.70:-.62)+pose.offset[2]],[pose.rotation[0],pose.rotation[1]*hand,pose.rotation[2]*hand]);
      function gun(shape,x,y,z,siz,mat,rx=0,em=0,color){
        const part=FMotion.place(grip,[x*hand,y,z],rx),a=m(shape,part.p,siz,mat,part.r,em);a.overlay=true;a.surface='object';
        if(color)a.color=color;else if(mat===0)a.color=[.16,.19,.21];else if(mat===1)a.color=[.37,.35,.28];
        out.push(a);
      }
      gun('bevel',0,-.09,.12,[.15,.24,.16],7,-.2);
      // A gloved grip and its wrist remain attached to the complete, damped weapon assembly.
      gun('bevel',.013,-.2,.21,[.17,.11,.21],7,-.2);gun('box',.013,-.16,.2,[.18,.025,.18],0,-.2);
      gun('bevel',.018,-.27,.30,[.15,.17,.24],0,-.25,0,[.26,.28,.23]);
      for(let j=0;j<4;j++)gun('box',0,-.035-j*.031,.205,[.16,.023,.042],7,-.2);
      gun('box',-.087,-.07,.15,[.04,.09,.09],7,-.5);
      if(pistol){
        // Compact slide, exposed barrel, serrations and sights share the hand frame.
        const bolt=slide*1.4;
        gun('bevel',0,.035,.015,[.145,.12,.40],0,0,0,[.23,.29,.32]);
        gun('bevel',0,.112,-.015+bolt,[.148,.075,.43],0,0,0,[.38,.43,.44]);
        gun('box',0,.157,-.02+bolt,[.095,.018,.34],7);
        gun('cylinder',0,.074,-.237,[.068,.075,.068],1,Math.PI/2);
        gun('cylinder',0,.074,-.279,[.044,.012,.044],7,Math.PI/2);
        gun('ring',0,.074,-.285,[.071,.014,.071],0,Math.PI/2);
        gun('bevel',0,-.10,.115,[.116,.25,.15],7,-.18);
        gun('box',-.076,.092,.047+bolt,[.006,.043,.089],7);
        gun('box',-.078,.105,.053+bolt,[.008,.014,.052],1);
        gun('box',.078,.014,.112,[.012,.029,.061],1);
        gun('box',0,.189,-.211,[.019,.048,.025],4,0,.28);
        for(const side of [-1,1]){
          for(let j=0;j<5;j++)gun('box',side*.076,.108,.085+j*.017+bolt,[.008,.056,.007],7);
          gun('box',side*.062,-.106,.136,[.009,.15,.085],0,-.18,0,[.25,.28,.24]);
          gun('sphere',side*.068,-.15,.127,[.009,.014,.014],1);
        }
        if(flash>.2){gun('octa',0,.074,-.32,[.075+flash*.055,.075+flash*.055,.12+flash*.16],5,0,2.2);gun('sphere',0,.074,-.307,[.045,.045,.065],4,0,2.8);}
      }else if(rocket){
        // A complete reusable launch tube; all collars, sights and the bore share its frame.
        gun('cylinder',0,.07,-.08,[.295,.96,.295],0,Math.PI/2,0,[.23,.28,.23]);
        gun('bevel',0,-.04,.08,[.25,.20,.36],0);gun('bevel',0,-.17,.01,[.12,.25,.14],7,-.14);
        gun('cylinder',0,.07,.40,[.35,.075,.35],1,Math.PI/2);
        gun('cylinder',0,.07,-.56,[.36,.09,.36],0,Math.PI/2);
        gun('cylinder',0,.07,-.608,[.25,.014,.25],7,Math.PI/2);
        gun('ring',0,.07,-.618,[.28,.026,.28],1,Math.PI/2);
        gun('box',0,.245,.06,[.11,.03,.40],0);gun('box',0,.29,.18,[.08,.10,.045],0);
        gun('box',0,.29,-.12,[.025,.085,.025],5,0,.18);
        if(!paired){gun('bevel',-.075,-.15,-.29,[.20,.10,.23],7,.12);gun('box',-.075,-.205,-.27,[.19,.06,.18],0,.12);}
        for(const side of [-1,1]){
          gun('box',side*.15,.06,-.05,[.022,.045,.33],1);gun('box',side*.157,.12,.12,[.018,.025,.11],5,0,.18);
          for(let j=0;j<4;j++)gun('box',side*.151,.025,-.20+j*.09,[.018,.04,.035],7);
        }
        for(let j=0;j<3;j++)gun('ring',0,.07,-.37+j*.28,[.31,.026,.31],0,Math.PI/2);
        if(flash>.2){gun('octa',0,.07,-.70,[.17+flash*.15,.17+flash*.15,.35+flash*.35],5,0,2.8);gun('octa',0,.07,.47,[.14,.14,.25],5,0,1.7);}
      }else if(grenade){
        gun('bevel',0,.01,.09,[.24,.21,.35],0);gun('box',0,.14,-.07,[.15,.045,.46],1);
        gun('cylinder',0,-.015,-.15,[.34,.23,.34],0,Math.PI/2,0,[.24,.26,.20]);
        for(let j=0;j<6;j++){const angle=j*Math.PI/3+slide*5;gun('cylinder',Math.cos(angle)*.125,-.015+Math.sin(angle)*.125,-.15,[.075,.25,.075],1,Math.PI/2);gun('sphere',Math.cos(angle)*.125,-.015+Math.sin(angle)*.125,-.014,[.055,.055,.025],5,0,.12);}
        for(const z of [-.28,-.015])gun('ring',0,-.015,z,[.36,.035,.36],1,Math.PI/2);
        gun('cylinder',0,.035,-.43+slide*.2,[.15,.34,.15],0,Math.PI/2);gun('ring',0,.035,-.61+slide*.2,[.19,.045,.19],1,Math.PI/2);gun('cylinder',0,.035,-.615+slide*.2,[.12,.018,.12],7,Math.PI/2);
        gun('box',0,.19,-.23,[.035,.055,.04],5,0,.3);gun('box',-.13,.04,.13,[.035,.055,.12],7);gun('box',.13,.035,.13,[.025,.07,.16],1);
        if(flash>.2)gun('octa',0,.035,-.67,[.17+flash*.1,.17+flash*.1,.23+flash*.2],5,0,2.2);
      }else if(fracture){
        gun('bevel',0,0,.01,[.255,.21,.53],0);gun('bevel',0,.124,.03+slide,[.24,.045,.3],1);
        gun('box',0,-.07,-.3,[.29,.09,.22],7);
        if(!paired){gun('bevel',-.06,-.13,-.26,[.2,.08,.2],7,.1);gun('box',-.06,-.17,-.24,[.19,.04,.18],0,.1);}
        for(const side of [-1,1]){
          gun('cylinder',side*.082,.01,-.33+slide*.35,[.135,.38,.135],0,Math.PI/2);
          gun('cylinder',side*.082,.01,-.52+slide*.35,[.16,.055,.16],1,Math.PI/2);
          gun('cylinder',side*.082,.01,-.552+slide*.35,[.095,.015,.095],7,Math.PI/2);
          gun('box',side*.135,.025,.04,[.014,.026,.18],p.overheated?6:5,0,.4);
          for(let j=0;j<3;j++)gun('box',side*.147,.08,-.1+j*.06,[.018,.018,.032],7);
          if(flash>.2)gun('octa',side*.082,.01,-.59,[.16+flash*.13,.16+flash*.13,.24+flash*.3],5,0,2.6);
        }
        gun('box',0,.17,-.13,[.04,.04,.04],5,0,.25);
      }else{
        gun('bevel',0,0,-.03,[.19,.175,.52],0);gun('bevel',0,.105,.04+slide,[.15,.04,.27],1);
        gun('box',-.098,.025,-.04,[.012,.021,.22],p.overheated?6:4,0,.4);gun('box',.098,.025,-.04,[.012,.025,.22],1);
        gun('cylinder',0,.01,-.34+slide*.3,[.112,.24,.112],0,Math.PI/2);gun('cylinder',0,.01,-.47+slide*.3,[.14,.045,.14],1,Math.PI/2);
        gun('cylinder',0,.01,-.497+slide*.3,[.085,.015,.085],7,Math.PI/2);gun('box',0,.14,-.13,[.035,.04,.035],4,0,.25);
        for(let j=0;j<5;j++)gun('box',0,.13,-.04+j*.037+slide,[.13,.012,.012],7);
        // Recessed bolt, ejection port and charging handle break up the receiver.
        gun('box',-.100,.04,.11,[.006,.047,.11],7);gun('box',-.104,.044,.09+slide,[.008,.024,.055],1);
        gun('box',-.125,.058,.14+slide,[.06,.025,.035],0);
        if(flash>.2)gun('octa',0,.01,-.53,[.12+flash*.12,.12+flash*.12,.15+flash*.25],5,0,2.5);
      }
      if(quality!=='low'){
        for(const side of [-1,1])for(const z of [.16,-.08])gun('sphere',side*(rocket?.151:fracture?.132:grenade?.125:pistol?.072:.098),-.043,z,[.012,.018,.018],3);
        if(!rocket&&!pistol){gun('bevel',0,-.17,.03,[.095,.22,.12],0,-.12);for(let j=0;j<4;j++)gun('box',0,-.1-j*.04,.093,[.10,.009,.009],1,-.12);}
      }
      // Open rear sight and paired fasteners remain geometry, with no image maps.
      if(!rocket)for(const side of [-1,1]){
        gun('box',side*.053,.173,.17,[.022,.072,.028],0);gun('sphere',side*(fracture?.13:pistol?.073:.097),-.036,.17,[.012,.024,.024],1);
      }
      if(!rocket)gun('box',0,.139,.17,[.125,.025,.036],0);
      gun('box',-.035,-.108,.1,[.09,.018,.13],0);gun('box',-.035,-.16,.08,[.09,.013,.05],0);
      for(let j=0;j<3;j++)gun('box',rocket?.165:fracture?.143:pistol?.078:.108,-.045,.1-j*.037,[.014,.016,.023],p.overheated?6:j/3<p.heat?5:0,0,j/3<p.heat?.6:0);
      }
drawGun(s.weapon,1);return out;}};})(globalThis);
