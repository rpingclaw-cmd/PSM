
/* ---------- extra backgrounds ---------- */
function seededRandom(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)>>>0}
  return ()=>{h=(Math.imul(h,1664525)+1013904223)>>>0;return h/4294967296}}
function vgrad(ctx,W,H,stops){const g=ctx.createLinearGradient(0,0,0,H);stops.forEach(([o,c])=>g.addColorStop(o,c));ctx.fillStyle=g;ctx.fillRect(0,0,W,H)}
function softCircle(ctx,x,y,r,rgb,a){const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,`rgba(${rgb},${a})`);g.addColorStop(1,`rgba(${rgb},0)`);ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,7);ctx.fill()}
function leaf(ctx,x,y,len,ang,fill,stroke,lw){
  ctx.save();ctx.translate(x,y);ctx.rotate(ang);
  ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(len*.5,-len*.32,len,0);ctx.quadraticCurveTo(len*.5,len*.32,0,0);
  ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.stroke();
  ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(len*.92,0);ctx.stroke();ctx.restore();
}
const EXTRA_BG={
  saffron(ctx,W,H,u,R){
    vgrad(ctx,W,H,[[0,'#FFF6E6'],[.55,'#FFE1B5'],[1,'#FBC892']]);
    const sx=.82*W,sy=1.02*H;
    ctx.save();ctx.strokeStyle='rgba(255,255,255,.55)';ctx.lineWidth=3*u;
    for(let i=0;i<22;i++){const a=Math.PI+i*Math.PI/21;ctx.beginPath();ctx.moveTo(sx+Math.cos(a)*200*u,sy+Math.sin(a)*200*u);ctx.lineTo(sx+Math.cos(a)*1400*u,sy+Math.sin(a)*1400*u);ctx.stroke()}
    ctx.restore();
    softCircle(ctx,sx,sy,420*u,'255,255,235',.95);softCircle(ctx,sx,sy,190*u,'255,214,120',.6);
  },
  mint(ctx,W,H,u,R){
    vgrad(ctx,W,H,[[0,'#F4FCF7'],[1,'#D3EEDD']]);
    const corners=[[0,0],[W,H],[W,0]];
    corners.forEach(([cx,cy],k)=>{for(let i=0;i<(k===2?4:7);i++){
      const x=cx+(cx?-1:1)*R()*.22*W,y=cy+(cy?-1:1)*R()*.3*H;
      leaf(ctx,x,y,(90+R()*120)*u,R()*Math.PI*2,'rgba(120,185,140,.20)','rgba(95,160,115,.45)',2*u)}});
  },
  ocean(ctx,W,H,u,R){
    vgrad(ctx,W,H,[[0,'#F6FBFF'],[.6,'#DDF0F9'],[1,'#BFE2F2']]);
    const cols=['rgba(170,214,236,.45)','rgba(140,200,228,.4)','rgba(120,188,222,.38)'];
    for(let L=0;L<3;L++){const base=(.72+L*.09)*H,amp=(14+L*6)*u,f=(2+L*.7+R())*Math.PI/W,ph=R()*6;
      ctx.beginPath();ctx.moveTo(0,H);for(let x=0;x<=W;x+=8)ctx.lineTo(x,base+Math.sin(x*f+ph)*amp);ctx.lineTo(W,H);ctx.closePath();ctx.fillStyle=cols[L];ctx.fill();
      ctx.beginPath();for(let x=0;x<=W;x+=8)ctx.lineTo(x,base+Math.sin(x*f+ph)*amp);ctx.strokeStyle='rgba(255,255,255,.7)';ctx.lineWidth=2*u;ctx.stroke()}
  },
  clouds(ctx,W,H,u,R){
    vgrad(ctx,W,H,[[0,'#E3F0FD'],[1,'#F8FBFF']]);
    ctx.save();ctx.shadowColor='rgba(255,255,255,.9)';ctx.shadowBlur=30*u;ctx.fillStyle='rgba(255,255,255,.92)';
    for(let c=0;c<5;c++){const cx=R()*W,cy=(.08+R()*.85)*H,s=(50+R()*60)*u;
      for(let i=0;i<6;i++){ctx.beginPath();ctx.arc(cx+(i-2.5)*s*.7,cy-Math.sin(i/5*Math.PI)*s*.5,s*(.55+R()*.35),0,7);ctx.fill()}}
    ctx.restore();
  },
  hills(ctx,W,H,u,R){
    vgrad(ctx,W,H,[[0,'#FAF7FC'],[1,'#E6E1F2']]);
    const cols=['rgba(214,208,234,.8)','rgba(196,193,226,.75)','rgba(178,184,218,.7)'];
    for(let L=0;L<3;L++){const base=(.62+L*.12)*H;ctx.beginPath();ctx.moveTo(0,H);
      const pts=6;let prev=[0,base-R()*80*u];ctx.lineTo(...prev);
      for(let i=1;i<=pts;i++){const x=i*W/pts,y=base-R()*110*u;ctx.quadraticCurveTo(prev[0]+(x-prev[0])/2,Math.min(prev[1],y)-40*u*R(),x,y);prev=[x,y]}
      ctx.lineTo(W,H);ctx.closePath();ctx.fillStyle=cols[L];ctx.fill();
      const g=ctx.createLinearGradient(0,base-60*u,0,base+40*u);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(1,'rgba(255,255,255,.35)');ctx.fillStyle=g;ctx.fillRect(0,base-60*u,W,100*u)}
  },
  mandala(ctx,W,H,u,R){
    vgrad(ctx,W,H,[[0,'#FFFAEE'],[1,'#F7E8C6']]);
    const cx=W>H?.86*W:.5*W,cy=W>H?.5*H:.82*H,r=Math.min(W,H)*.62;
    ctx.save();ctx.translate(cx,cy);ctx.strokeStyle='rgba(185,140,50,.28)';ctx.lineWidth=2*u;
    [1,.8,.62,.45,.3,.16].forEach(k=>{ctx.beginPath();ctx.arc(0,0,r*k,0,7);ctx.stroke()});
    [[24,.8,1,.09],[16,.62,.8,.11],[12,.45,.62,.14],[8,.3,.45,.18]].forEach(([n,a,b,w])=>{
      for(let i=0;i<n;i++){ctx.save();ctx.rotate(i*2*Math.PI/n);ctx.beginPath();ctx.moveTo(r*a,0);
        ctx.quadraticCurveTo(r*(a+b)/2,-r*w,r*b,0);ctx.quadraticCurveTo(r*(a+b)/2,r*w,r*a,0);ctx.stroke();ctx.restore()}});
    ctx.restore();
  },
  bokeh(ctx,W,H,u,R){
    vgrad(ctx,W,H,[[0,'#FFF5EF'],[1,'#F9DDE2']]);
    const cols=['255,214,150','255,190,200','255,235,200','245,200,230'];
    for(let i=0;i<26;i++){const x=R()*W,y=R()*H,r=(25+R()*90)*u;
      softCircle(ctx,x,y,r,cols[i%4],.35+R()*.35);
      ctx.strokeStyle='rgba(255,255,255,.35)';ctx.lineWidth=1.5*u;ctx.beginPath();ctx.arc(x,y,r*.7,0,7);ctx.stroke()}
  },
  petals(ctx,W,H,u,R){
    vgrad(ctx,W,H,[[0,'#FFF8F5'],[1,'#FDE2E7']]);
    for(let i=0;i<30;i++){const x=R()*W,y=R()*H,s=(10+R()*16)*u;
      ctx.save();ctx.translate(x,y);ctx.rotate(R()*6.3);ctx.fillStyle=`rgba(${R()<.5?'244,167,185':'250,196,206'},${.4+R()*.35})`;
      ctx.beginPath();ctx.moveTo(0,-s);ctx.bezierCurveTo(s,-s,s,s*.6,0,s);ctx.bezierCurveTo(-s,s*.6,-s,-s,0,-s);ctx.fill();ctx.restore()}
    ctx.strokeStyle='rgba(170,120,110,.35)';ctx.lineWidth=3*u;ctx.beginPath();ctx.moveTo(W,.05*H);ctx.quadraticCurveTo(.8*W,.12*H,.68*W,.06*H);ctx.stroke();
  },
  parchment(ctx,W,H,u,R){
    ctx.fillStyle='#FBF3E1';ctx.fillRect(0,0,W,H);
    for(let i=0;i<1600;i++){ctx.fillStyle=`rgba(150,110,60,${R()*.07})`;ctx.fillRect(R()*W,R()*H,(1+R()*2)*u,(1+R()*2)*u)}
    const g=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*.35,W/2,H/2,Math.max(W,H)*.75);g.addColorStop(0,'rgba(160,120,70,0)');g.addColorStop(1,'rgba(160,120,70,.28)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='rgba(150,110,55,.45)';ctx.lineWidth=2*u;ctx.strokeRect(22*u,22*u,W-44*u,H-44*u);ctx.lineWidth=1*u;ctx.strokeRect(30*u,30*u,W-60*u,H-60*u);
  },
  pond(ctx,W,H,u,R){
    vgrad(ctx,W,H,[[0,'#F5FBF9'],[.6,'#DDF1EC'],[1,'#C3E5DE']]);
    ctx.strokeStyle='rgba(255,255,255,.75)';ctx.lineWidth=2*u;
    for(let i=0;i<7;i++){const x=R()*W,y=(.65+R()*.33)*H;ctx.beginPath();ctx.ellipse(x,y,(40+R()*80)*u,(8+R()*10)*u,0,0,7);ctx.stroke()}
    for(let i=0;i<5;i++){const x=(.05+R()*.9)*W,y=(.78+R()*.2)*H,r=(30+R()*30)*u,a=R()*6;
      ctx.fillStyle='rgba(130,190,120,.55)';ctx.beginPath();ctx.ellipse(x,y,r,r*.4,0,a,a+5.6);ctx.lineTo(x,y);ctx.closePath();ctx.fill()}
    ctx.save();ctx.fillStyle='rgba(244,160,185,.55)';const lx=.12*W,ly=.86*H,s=40*u;
    [-1,-.5,0,.5,1].forEach(k=>{ctx.save();ctx.translate(lx,ly);ctx.rotate(k*.6);ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(s*.5,-s*.4,s*.3,-s,0,-s*1.2);ctx.bezierCurveTo(-s*.3,-s,-s*.5,-s*.4,0,0);ctx.fill();ctx.restore()});ctx.restore();
  },
  dusk(ctx,W,H,u,R){
    vgrad(ctx,W,H,[[0,'#ECE6FA'],[.5,'#FBE6EE'],[1,'#FFEEDD']]);
    for(let i=0;i<40;i++){const x=R()*W,y=R()*.45*H;ctx.fillStyle=`rgba(255,255,255,${.5+R()*.5})`;ctx.beginPath();ctx.arc(x,y,(1+R()*2.2)*u,0,7);ctx.fill()}
    [[.15,.12],[.45,.2],[.7,.08]].forEach(([x,y])=>sparkle(ctx,x*W,y*H,22*u));
    ctx.save();ctx.fillStyle='rgba(255,255,255,.9)';const mx=.9*W,my=.14*H,mr=36*u;ctx.beginPath();ctx.arc(mx,my,mr,0,7);ctx.fill();
    ctx.globalCompositeOperation='destination-out';ctx.beginPath();ctx.arc(mx+14*u,my-8*u,mr*.85,0,7);ctx.fill();ctx.restore();
  },
  sage(ctx,W,H,u,R){
    vgrad(ctx,W,H,[[0,'#F2F5EE'],[1,'#E2EADB']]);
    ctx.strokeStyle='rgba(120,140,110,.06)';ctx.lineWidth=1;for(let x=-H;x<W;x+=6*u){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+H,H);ctx.stroke()}
    ctx.save();ctx.strokeStyle='rgba(110,140,100,.5)';ctx.lineWidth=2.5*u;const bx=W*.98,by=H*.98;
    ctx.beginPath();ctx.moveTo(bx,by);ctx.quadraticCurveTo(bx-140*u,by-120*u,bx-260*u,by-330*u);ctx.stroke();
    for(let i=1;i<9;i++){const t=i/9,x=bx-260*u*t,y=by-330*u*t+Math.sin(t*3)*20*u;leaf(ctx,x,y,(60-i*3)*u,(i%2?-2.4:-0.7)+R()*.3,'rgba(150,180,135,.22)','rgba(110,140,100,.5)',2*u)}
    ctx.restore();
  }
};
const EXTRA_THEMES={
  saffron:{label:'Saffron sunrise',css:'radial-gradient(circle at 80% 100%,#FFFBE8,transparent 55%),linear-gradient(#FFF6E6,#FBC892)'},
  mint:{label:'Mint leaves',css:'linear-gradient(#F4FCF7,#C9EBD5)'},
  ocean:{label:'Calm sea',css:'linear-gradient(#F6FBFF 50%,#A9D6EC)'},
  clouds:{label:'Soft clouds',css:'radial-gradient(circle at 35% 45%,#fff 22%,transparent 24%),radial-gradient(circle at 60% 55%,#fff 18%,transparent 20%),linear-gradient(#D6E9FC,#F8FBFF)'},
  hills:{label:'Misty hills',css:'linear-gradient(#FAF7FC 55%,#C4C1E2 56%)'},
  mandala:{label:'Golden mandala',css:'repeating-radial-gradient(circle at 70% 50%,#F7E8C6 0 6px,#FFFAEE 6px 12px)'},
  bokeh:{label:'Warm bokeh',css:'radial-gradient(circle at 30% 30%,#FFD9A0 15%,transparent 30%),radial-gradient(circle at 70% 65%,#FFC0CC 15%,transparent 32%),#FFF2EE'},
  petals:{label:'Falling petals',css:'radial-gradient(ellipse at 30% 35%,#F4A7B9 9%,transparent 11%),radial-gradient(ellipse at 65% 60%,#F8C4CE 9%,transparent 11%),#FFF4F2'},
  parchment:{label:'Old paper',css:'radial-gradient(circle,#FBF3E1 55%,#E6CFA6)'},
  pond:{label:'Lotus pond',css:'linear-gradient(#F5FBF9 50%,#BFE3D9)'},
  dusk:{label:'Lilac dusk',css:'linear-gradient(#E6DEF8,#FBE6EE,#FFEEDD)'},
  sage:{label:'Sage linen',css:'linear-gradient(#F2F5EE,#D9E4D0)'}
};
Object.assign(THEMES,EXTRA_THEMES);
