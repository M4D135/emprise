  function transientLights(value,eye,limit){
    if(!Array.isArray(value))return [];
    const valid=[];
    for(const source of value.slice(0,16)){
      if(!source||!Array.isArray(source.p)||source.p.length!==3||!source.p.every(Number.isFinite)||!Number.isFinite(source.power)||source.power<=0||!Number.isFinite(source.range)||source.range<=0)continue;
      const range=Math.min(48,source.range),power=Math.min(64,source.power),p=source.p;
      const distance=(p[0]-eye[0])**2+(p[1]-eye[1])**2+(p[2]-eye[2])**2;
      if(distance>(180+range)**2)continue;
      const color=Array.isArray(source.color)&&source.color.length===3?source.color.map(v=>Number.isFinite(v)?Math.max(0,Math.min(3,v)):0):[1,.42,.09];
      if(!color.some(v=>v>0))continue;
      valid.push({p,color,power,range,dir:source.dir,cone:source.cone,score:power/(1+distance*.1)});
    }
    return valid.sort((a,b)=>b.score-a.score).slice(0,limit);
  }
