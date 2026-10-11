function drawBg(ctx,W,H,theme,seed){
  const u=Math.min(W,H)/842;
  const R=seededRandom(String(seed||theme));
  ctx.save();
  if(theme==='gold'){
    let g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#FCF7D3');g.addColorStop(.45,'#FAEC9E');g.addColorStop(1,'#F8DB72');
    ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='#fff';ctx.lineCap='round';
    for(let i=0;i<6;i++){
      ctx.globalAlpha=[.35,.2,.45,.18,.3,.22][i];ctx.lineWidth=[26,7,14,40,5,18][i]*u;
      ctx.beginPath();ctx.moveTo(-.1*W,(.0+.07*i)*H);
      ctx.bezierCurveTo(.3*W,(-.08+.05*i)*H,.62*W,(.28+.05*i)*H,1.1*W,(.42+.06*i)*H);ctx.stroke();
    }
    ctx.globalAlpha=1;
    bubble(ctx,.24*W,.42*H,130*u);bubble(ctx,.9*W,.36*H,70*u);
    [[.62,.2,70],[.66,.36,60],[.58,.33,36],[.73,.27,44],[.55,.4,30]].forEach(([x,y,r])=>sparkle(ctx,x*W,y*H,r*u));
  }else if(theme==='lavender'){
    let g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#FBFAFD');g.addColorStop(.7,'#E2D8F0');
    ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='rgba(255,255,255,.7)';ctx.lineWidth=2*u;
    for(let i=0;i<9;i++){const x=(.5+.06*i)*W,y=(.25+.05*(i%4))*H;ctx.beginPath();ctx.arc(x,y,(18+9*(i%3))*u,0.4,5.6);ctx.stroke();
      ctx.beginPath();ctx.arc(x+30*u,y+40*u,7*u,0,7);ctx.stroke();}
    const hy=.75*H;ctx.beginPath();ctx.moveTo(0,hy+.02*H);ctx.quadraticCurveTo(.5*W,hy-.06*H,W,hy);ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.closePath();
    g=ctx.createLinearGradient(0,hy,0,H);g.addColorStop(0,'#EAF3C5');g.addColorStop(1,'#BFDA74');ctx.fillStyle=g;ctx.fill();
    ctx.fillStyle='rgba(140,160,90,.28)';
    [[.68,.79,40,10],[.72,.82,26,7],[.7,.86,50,12],[.74,.9,30,8],[.9,.93,40,10],[.25,.95,30,8]].forEach(([x,y,rx,ry])=>{ctx.beginPath();ctx.ellipse(x*W,y*H,rx*u,ry*u,0,0,7);ctx.fill()});
    ctx.fillStyle='rgba(255,255,255,.45)';
    for(let i=0;i<22;i++){const x=((i*137)%100)/100*W,y=(.8+((i*53)%20)/100)*H;ctx.beginPath();ctx.ellipse(x,y,(8+i%4*4)*u,(5+i%3*2)*u,0,0,7);ctx.fill()}
    ctx.strokeStyle='rgba(120,170,70,.45)';ctx.lineWidth=3*u;
    for(let i=0;i<14;i++){const x=(.05+i*.07)*W,b=H;ctx.beginPath();ctx.moveTo(x,b);ctx.quadraticCurveTo(x+6*u,b-50*u,x+(i%2?18:-14)*u,b-(70+(i%3)*20)*u);ctx.stroke()}
  }else if(theme==='sky'){
    ctx.fillStyle='#FFFFFF';ctx.fillRect(0,0,W,H);
    const cx=.45*W,cy=1.02*H,R=Math.hypot(W,H)*1.2,cols=['#BFE6E0','#CFE9F6','#DDEFD6','#C7DBF4','#E4E3F8','#D5ECEC'];
    const n=44;for(let i=0;i<n;i++){const a0=Math.PI+i*Math.PI/n,a1=a0+Math.PI/n*.55;
      ctx.fillStyle=cols[i%cols.length];ctx.globalAlpha=.75;ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,R,a0,a1);ctx.closePath();ctx.fill()}
    ctx.globalAlpha=1;
    const g=ctx.createRadialGradient(cx,.75*H,0,cx,.75*H,.75*W);g.addColorStop(0,'rgba(255,255,255,.95)');g.addColorStop(.6,'rgba(255,255,255,.55)');g.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  }else if(theme==='rose'){
    let g=ctx.createLinearGradient(0,0,W,H);g.addColorStop(0,'#FDEEF0');g.addColorStop(1,'#F6C9D2');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    lotus(ctx,.78*W,.5*H,380*u);
    ctx.strokeStyle='rgba(255,255,255,.75)';ctx.lineWidth=1.5*u;
    [[.05,0,.45,1],[.35,0,.55,1],[.75,.0,.78,1],[.4,1,1,.35]].forEach(([a,b,c,d])=>{ctx.beginPath();ctx.moveTo(a*W,b*H);ctx.lineTo(c*W,d*H);ctx.stroke()});
    ctx.fillStyle='rgba(255,255,255,.8)';
    for(let i=0;i<40;i++){const t=i/40,x=(-.05+t*1.1)*W,y=(.95-Math.sin(t*Math.PI)*.18)*H;ctx.beginPath();ctx.arc(x,y,(1.5+(i%3))*u,0,7);ctx.fill()}
  }else if(theme==='pastel'){
    ctx.fillStyle='#F5F7FB';ctx.fillRect(0,0,W,H);
    const M=Math.max(W,H);
    [[.08,.12,'207,227,250'],[.98,.28,'251,217,223'],[.12,.9,'211,245,221'],[.92,.95,'201,244,238'],[.6,.55,'253,236,222']].forEach(([x,y,c])=>{
      const g=ctx.createRadialGradient(x*W,y*H,0,x*W,y*H,.75*M);g.addColorStop(0,`rgba(${c},1)`);g.addColorStop(1,`rgba(${c},0)`);ctx.fillStyle=g;ctx.fillRect(0,0,W,H)});
  }else if(EXTRA_BG[theme]){
    EXTRA_BG[theme](ctx,W,H,u,R);
  }else{
    ctx.fillStyle='#FFFFFF';ctx.fillRect(0,0,W,H);
  }
  ctx.restore();
}
function bubble(ctx,x,y,r){
  ctx.save();
  let g=ctx.createRadialGradient(x,y,r*.6,x,y,r);g.addColorStop(0,'rgba(255,255,255,.12)');g.addColorStop(1,'rgba(255,255,255,.55)');
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,7);ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.5)';ctx.beginPath();ctx.ellipse(x,y-r*.62,r*.45,r*.16,0,0,7);ctx.fill();
  ctx.restore();
}
function sparkle(ctx,x,y,r){
  ctx.save();ctx.shadowColor='rgba(255,255,255,1)';ctx.shadowBlur=r*.4;ctx.fillStyle='#fff';
  ctx.beginPath();ctx.moveTo(x,y-r);ctx.quadraticCurveTo(x,y,x+r*.18,y);ctx.quadraticCurveTo(x,y,x,y+r);ctx.quadraticCurveTo(x,y,x-r*.18,y);ctx.quadraticCurveTo(x,y,x,y-r);ctx.fill();
  ctx.beginPath();ctx.moveTo(x-r*.6,y);ctx.quadraticCurveTo(x,y,x,y-r*.12);ctx.quadraticCurveTo(x,y,x+r*.6,y);ctx.quadraticCurveTo(x,y,x,y+r*.12);ctx.quadraticCurveTo(x,y,x-r*.6,y);ctx.fill();
  ctx.beginPath();ctx.arc(x,y,r*.08,0,7);ctx.fill();ctx.restore();
}
function lotus(ctx,cx,cy,s){
  ctx.save();ctx.strokeStyle='rgba(255,255,255,.5)';ctx.lineWidth=s*.012;
  const petal=(ang,len,wid)=>{ctx.save();ctx.translate(cx,cy+s*.35);ctx.rotate(ang);
    ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(wid,-len*.35,wid*.7,-len*.8,0,-len);ctx.bezierCurveTo(-wid*.7,-len*.8,-wid,-len*.35,0,0);ctx.stroke();ctx.restore()};
  [-1.25,-.85,-.45,0,.45,.85,1.25].forEach((a,i)=>petal(a,s*(i===3?1.05:.85-Math.abs(a)*.12),s*.24));
  [-.6,-.2,.2,.6].forEach(a=>petal(a,s*.62,s*.16));
  ctx.restore();
}
function wrapLines(ctx,text,maxW){
  const out=[];
  for(const para of String(text||'').split(/\n/)){
    const words=para.trim().split(/\s+/).filter(Boolean); let line='';
    if(!words.length){out.push('');continue}
    for(const w of words){const t=line?line+' '+w:w; if(ctx.measureText(t).width>maxW&&line){out.push(line);line=w}else line=t}
    out.push(line);
  }
  return out;
}
function fitBlock(ctx,o){
  let size=o.size;
  for(let i=0;i<40;i++){
    ctx.font=`400 ${size}px ${o.family}`;
    const lines=wrapLines(ctx,o.text,o.maxW), lineH=size*o.lh;
    const citeSize=o.citeStyle==='inline'?size:size*.62;
    ctx.font=`400 ${citeSize}px ${o.family}`;
    const citeLines=o.cite?wrapLines(ctx,o.cite,o.maxW):[];
    const citeLH=o.citeStyle==='inline'?lineH:citeSize*1.5;
    const gap=o.cite?(o.citeStyle==='inline'?0:size*.45):0;
    const h=lines.length*lineH+gap+citeLines.length*citeLH;
    if(h<=o.maxH||size<o.size*.45) return {size,lines,lineH,citeSize,citeLines,citeLH,gap,h,family:o.family};
    size*=.95;
  }
}
function drawBlock(ctx,b,x,y,w,align){
  ctx.fillStyle=INK;ctx.textBaseline='alphabetic';ctx.textAlign=align;
  const ax=align==='left'?x:align==='right'?x+w:x+w/2;
  let yy=y+b.size*.95;
  ctx.font=`400 ${b.size}px ${b.family}`;
  for(const l of b.lines){ctx.fillText(l,ax,yy);yy+=b.lineH}
  if(b.citeLines.length){
    if(b.gap) yy=yy-b.lineH+b.size*.25+b.gap+b.citeSize*.95;
    ctx.font=`400 ${b.citeSize}px ${b.family}`;
    for(const l of b.citeLines){ctx.fillText(l,ax,yy);yy+=b.citeLH}
  }
}
function drawPhoto(ctx,img,fx,fy,fw,fh,c,mirror){
  fw=Math.max(2,Math.round(fw));fh=Math.max(2,Math.round(fh));
  const cv=document.createElement('canvas');cv.width=fw;cv.height=fh;const x=cv.getContext('2d');
  const s=Math.max(fw/img.width,fh/img.height)*(+c.zoom||1);
  const dw=img.width*s,dh=img.height*s;
  const dx=(fw-dw)/2-(+c.ox||0)*(dw-fw+fw*.3)/2, dy=(fh-dh)/2-(+c.oy||0)*(dh-fh+fh*.3)/2;
  x.drawImage(img,dx,dy,dw,dh);
  if(c.gray){try{const d=x.getImageData(0,0,fw,fh),a=d.data;for(let i=0;i<a.length;i+=4){const l=a[i]*.3+a[i+1]*.59+a[i+2]*.11;a[i]=a[i+1]=a[i+2]=l}x.putImageData(d,0,0)}catch(e){}}
  x.globalCompositeOperation='destination-in';
  const fade=(side,len)=>{let g;
    if(side==='l'){g=x.createLinearGradient(0,0,len,0)}else if(side==='r'){g=x.createLinearGradient(fw,0,fw-len,0)}
    else if(side==='t'){g=x.createLinearGradient(0,0,0,len)}else{g=x.createLinearGradient(0,fh,0,fh-len)}
    g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'#000');x.fillStyle=g;x.fillRect(0,0,fw,fh)};
  const m=Math.min(fw,fh);
  if(c.shape==='oval'){
    x.save();x.translate(fw/2,fh/2);x.scale(fw/2,fh/2);
    const g=x.createRadialGradient(0,0,0,0,0,1);g.addColorStop(0,'#000');g.addColorStop(.8,'#000');g.addColorStop(1,'rgba(0,0,0,0)');
    x.fillStyle=g;x.fillRect(-1,-1,2,2);x.restore();
    ctx.save();ctx.translate(fx+fw/2,fy+fh/2);ctx.scale(fw/2,fh/2);
    const h=ctx.createRadialGradient(0,0,.6,0,0,1.12);h.addColorStop(0,'rgba(95,95,105,.45)');h.addColorStop(1,'rgba(95,95,105,0)');
    ctx.fillStyle=h;ctx.beginPath();ctx.arc(0,0,1.12,0,7);ctx.fill();ctx.restore();
  }else if(c.shape==='soft'){
    ['l','r','t','b'].forEach(s=>fade(s,m*.1));
    ctx.save();ctx.shadowColor='rgba(255,255,255,.9)';ctx.shadowBlur=m*.08;ctx.fillStyle='rgba(255,255,255,.35)';
    ctx.fillRect(fx+m*.04,fy+m*.04,fw-m*.08,fh-m*.08);ctx.restore();
  }else if(c.shape==='cutout'){
    fade(mirror?'r':'l',fw*.22);fade('t',fh*.14);
  }
  ctx.drawImage(cv,fx,fy);
}
const HEADER_FONTS={
  script:{css:"400 {S}px Parisienne, cursive",adj:1},
  greatvibes:{css:"400 {S}px 'Great Vibes', cursive",adj:1.1},
  dancing:{css:"500 {S}px 'Dancing Script', cursive",adj:.95},
  allura:{css:"400 {S}px Allura, cursive",adj:1.12},
  pinyon:{css:"400 {S}px 'Pinyon Script', cursive",adj:.95},
  alexbrush:{css:"400 {S}px 'Alex Brush', cursive",adj:1.08},
  tangerine:{css:"700 {S}px Tangerine, cursive",adj:1.35},
  satisfy:{css:"400 {S}px Satisfy, cursive",adj:.9},
  serif:{css:"italic 400 {S}px 'Cormorant Garamond', Georgia, serif",adj:.95},
  playfair:{css:"italic 500 {S}px 'Playfair Display', Georgia, serif",adj:.8},
  lora:{css:"italic 400 {S}px 'Lora', Georgia, serif",adj:.82},
  cinzel:{css:"500 {S}px Cinzel, Georgia, serif",adj:.68},
  marcellus:{css:"400 {S}px Marcellus, Georgia, serif",adj:.75},
  sans:{css:"500 {S}px 'Montserrat', 'DM Sans', sans-serif",adj:.72},
  caps:{css:"500 {S}px 'Montserrat', 'DM Sans', sans-serif",adj:.62}
};
function headerFontKey(c){const k=c.headerFont&&c.headerFont!=='auto'?c.headerFont:(c.layout==='modern'?'serif':'script');return HEADER_FONTS[k]?k:'script'}
function headerFontCss(c,size){return HEADER_FONTS[headerFontKey(c)].css.replace('{S}',size)}
function headerSizeFor(c,base){return base*HEADER_FONTS[headerFontKey(c)].adj*(+c.headerSize||1)}
function headerStr(c,s){return headerFontKey(c)==='caps'?s.toUpperCase():s}
function setSpacing(ctx,c){try{ctx.letterSpacing=headerFontKey(c)==='caps'?'0.12em':'0px'}catch(e){}}
function drawHeaderBar(ctx,x,y,w,h,left,right,c){
  const bar=c.headerBar&&c.headerBar!=='auto'?c.headerBar:'bar';
  if(bar==='bar'){
    ctx.save();ctx.shadowColor='rgba(0,0,0,.14)';ctx.shadowBlur=h*.14;ctx.shadowOffsetY=h*.05;ctx.fillStyle='rgba(255,255,255,.55)';
    const r=h*.12;ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();ctx.fill();ctx.restore();
  }else if(bar==='line'){
    ctx.save();ctx.strokeStyle=c.headerColor||'#2A2622';ctx.globalAlpha=.35;ctx.lineWidth=Math.max(1,h*.025);ctx.beginPath();ctx.moveTo(x,y+h*.95);ctx.lineTo(x+w,y+h*.95);ctx.stroke();ctx.restore();
  }
  ctx.save();ctx.fillStyle=c.headerColor||'#2A2622';ctx.font=headerFontCss(c,headerSizeFor(c,h*.6));ctx.textBaseline='middle';setSpacing(ctx,c);
  ctx.textAlign='left';ctx.fillText(headerStr(c,left),x+h*.3,y+h*.54);
  ctx.textAlign='right';ctx.fillText(headerStr(c,right),x+w-h*.3,y+h*.54);
  ctx.restore();
}
function masterOf(c){return state.settings.masters.find(m=>m.id===c.master)}

async function renderCard(canvas,c){
  const f=FORMATS[c.format]||FORMATS.landscape, W=f.w, H=f.h;
  await ensureFonts(c);
  const src=photoSrc(c); const img=src?await loadImg(src):null;
  if(canvas.width!==W) canvas.width=W; if(canvas.height!==H) canvas.height=H;
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,W,H);
  drawBg(ctx,W,H,c.theme,(c.date||'')+c.theme);
  const hd=headerTexts(c);
  const family=FONTS[c.font]||FONTS.montserrat;
  const wide=W>H*1.2;
  const m=masterOf(c); const sign=m?(m.sign||m.name):'';
  if(c.layout==='modern'){
    const k=Math.min(W/1080,H/1080);
    {const mb=c.headerBar&&c.headerBar!=='auto'?c.headerBar:'none';
    if(mb!=='none'){drawHeaderBar(ctx,.05*W,.035*H,.9*W,78*k,hd.left,hd.right,c)}
    else{ctx.save();ctx.fillStyle=c.headerColor||'#2A2622';ctx.font=headerFontCss(c,headerSizeFor(c,46*k));ctx.textBaseline='alphabetic';setSpacing(ctx,c);
    ctx.textAlign='left';ctx.fillText(headerStr(c,hd.left),.065*W,.07*H+30*k);ctx.textAlign='right';ctx.fillText(headerStr(c,hd.right),.935*W,.07*H+30*k);ctx.restore()}}
    const mirror=c.photoSide==='left';
    let tx=.08*W,tw=.84*W,ty,maxH,align=c.align==='auto'?'center':c.align;
    if(img){
      if(wide){drawPhoto(ctx,img,mirror?0:.62*W,.16*H,.38*W,.84*H,c,mirror);tx=mirror?.42*W:.05*W;tw=.53*W;ty=.2*H;maxH=.52*H}
      else{drawPhoto(ctx,img,mirror?-.02*W:.40*W,.47*H,.62*W,.53*H,c,mirror);ty=.15*H;maxH=.31*H}
      const b=fitBlock(ctx,{text:c.text,cite:c.cite,family,size:52*k*c.size,lh:1.5*c.lh,maxW:tw,maxH,citeStyle:c.citeStyle});
      drawBlock(ctx,b,tx,ty+(maxH-b.h)*.25,tw,align);
      ctx.save();ctx.fillStyle='#2A2622';
      if(c.showName&&sign){ctx.fillStyle=c.nameColor||'#2A2622';ctx.font=`italic 400 ${46*k*(+c.nameSize||1)}px 'Cormorant Garamond', Georgia, serif`;ctx.textAlign=mirror?'right':'left';
        ctx.fillText(sign,mirror?.97*W:.03*W,(wide?.86:.885)*H)}
      if(c.showSite){ctx.font=`400 ${22*k*(+c.siteSize||1)}px 'DM Sans', sans-serif`;ctx.fillStyle=c.siteColor||SITE_GREEN;ctx.textAlign=mirror?'right':'left';
        ctx.fillText(state.settings.site,mirror?.9*W:.1*W,.965*H)}
      ctx.restore();
    }else{
      maxH=.6*H;
      const b=fitBlock(ctx,{text:c.text,cite:c.cite,family,size:52*k*c.size,lh:1.75*c.lh,maxW:tw,maxH,citeStyle:c.citeStyle});
      drawBlock(ctx,b,tx,(H-b.h)/2-.02*H,tw,align);
      ctx.save();ctx.textAlign='center';
      if(c.showName&&sign){ctx.fillStyle=c.nameColor||'#2A2622';ctx.font=`italic 400 ${46*k*(+c.nameSize||1)}px 'Cormorant Garamond', Georgia, serif`;ctx.fillText(sign,W/2,.915*H)}
      if(c.showSite){ctx.fillStyle=c.siteColor||SITE_GREEN;ctx.font=`400 ${22*k*(+c.siteSize||1)}px 'DM Sans', sans-serif`;ctx.fillText(state.settings.site,W/2,.968*H)}
      ctx.restore();
    }
    return;
  }
  // classic
  const k=Math.min(W/1284,H/842);
  const barH=88*k, barX=.06*W, barW=.88*W, barY=wide?.133*H:.045*H;
  drawHeaderBar(ctx,barX,barY,barW,barH,hd.left,hd.right,c);
  const top=barY+barH;
  let tx,tw,ty,maxH,align;
  if(wide){
    if(img){
      const pw=.34*W, fx=c.photoSide==='left'?.06*W:W-.06*W-pw, fy=top+.045*H, fh=H-fy-.06*H;
      drawPhoto(ctx,img,fx,fy,pw,fh,c,false);
      tw=.5*W; tx=c.photoSide==='left'?.44*W:.06*W; align=c.photoSide==='left'?'left':'right';
    }else{tx=.1*W;tw=.8*W;align='center'}
    ty=top+.1*H; maxH=H-ty-.1*H;
  }else{
    if(img){
      const pw=.56*W, ph=Math.min(.4*H,pw*1.15), fy=top+.04*H;
      drawPhoto(ctx,img,(W-pw)/2,fy,pw,ph,c,false);
      ty=fy+ph+.05*H;
    }else ty=top+.1*H;
    tx=.09*W;tw=.82*W;align='center';maxH=H-ty-(c.showSite?.1:.07)*H;
  }
  if(c.align!=='auto') align=c.align;
  const b=fitBlock(ctx,{text:c.text,cite:c.cite,family,size:36*k*c.size*(wide?1:1.25),lh:1.7*c.lh,maxW:tw,maxH,citeStyle:c.citeStyle});
  const offY=(!wide&&!img)?Math.max(0,(maxH-b.h)/2-.03*H):0;
  drawBlock(ctx,b,tx,ty+offY,tw,align);
  ctx.save();
  if(c.showName&&sign){ctx.fillStyle=c.nameColor||'#2A2622';ctx.font=`italic 400 ${b.size*1.05*(+c.nameSize||1)}px 'Cormorant Garamond', Georgia, serif`;ctx.textAlign=align;
    const ax=align==='left'?tx:align==='right'?tx+tw:tx+tw/2;ctx.fillText(sign,ax,ty+offY+b.h+b.size*1.6)}
  if(c.showSite){ctx.fillStyle=c.siteColor||SITE_GREEN;ctx.font=`400 ${20*k*(wide?1:1.25)*(+c.siteSize||1)}px 'DM Sans', sans-serif`;ctx.textAlign='center';ctx.fillText(state.settings.site,W/2,H-.035*H)}
  ctx.restore();
}
