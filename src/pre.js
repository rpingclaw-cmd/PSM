"use strict";
/* ---------- constants ---------- */
const FORMATS={landscape:{w:1284,h:842,label:'Landscape'},portrait:{w:1080,h:1350,label:'Portrait 4:5'},square:{w:1080,h:1080,label:'Square'},story:{w:1080,h:1920,label:'Story'}};
const THEMES={
  gold:{label:'Golden light',css:'linear-gradient(160deg,#FCF6CF,#F8DC74)'},
  lavender:{label:'Lavender meadow',css:'linear-gradient(#F1EBF8 55%,#CFE38D 56%)'},
  sky:{label:'Sky rays',css:'conic-gradient(from 200deg,#CDEBF5,#DCEFD8,#C8DDF3,#E6E4F8,#CDEBF5)'},
  rose:{label:'Rose lotus',css:'linear-gradient(160deg,#FDECEE,#F5C7D0)'},
  pastel:{label:'Pastel mist',css:'radial-gradient(circle at 20% 20%,#CFE3FA,transparent 60%),radial-gradient(circle at 85% 40%,#FBD9DF,transparent 60%),radial-gradient(circle at 30% 90%,#D3F5DD,transparent 60%),#F5F7FB'},
  white:{label:'Plain white',css:'#FFFFFF'}
};
const FONTS={montserrat:"'Montserrat', 'DM Sans', sans-serif",dmsans:"'DM Sans', sans-serif",cormorant:"'Cormorant Garamond', Georgia, serif",lora:"'Lora', Georgia, serif"};
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEK=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const INK='#221F24', SITE_GREEN='#7BC142';
const DEFAULT_MODEL='gemini-2.5-flash';
const KEY_STORE='sqc-gemini-key';

const uidGen=()=>Math.random().toString(36).slice(2,10);
const clone=o=>JSON.parse(JSON.stringify(o));
const todayStr=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const toDay=s=>{const[y,m,d]=s.split('-').map(Number);return Date.UTC(y,m-1,d)};
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

const DEFAULT_STYLE={headerFont:'auto',headerSize:1,headerColor:'#2A2622',headerBar:'auto',nameSize:1,nameColor:'#2A2622',siteColor:'#7BC142',siteSize:1,format:'landscape',layout:'classic',theme:'gold',font:'montserrat',size:1,lh:1,align:'auto',dash:'dash',photo:'master',photoSide:'right',shape:'soft',gray:true,zoom:1,ox:0,oy:0,showName:false,showSite:false,citeStyle:'small'};

const MODERN_STYLE={format:'portrait',layout:'modern',theme:'pastel',font:'dmsans',dash:'plain',shape:'cutout',showName:true,showSite:true,citeStyle:'inline'};
const DEFAULT_SLOTS=()=>[{id:'a',label:'Afternoon',time:'15:30',master:'babuji',style:{format:'landscape',layout:'classic'}},{id:'b',label:'Evening',time:'19:30',master:'kcv',style:{...MODERN_STYLE}}];
const DEFAULT_IG='Learn Pranahuti meditation — free training, link in bio.\n\n#PranahutiYoga #RajaYoga #Meditation #YogicTransmission #InnerPeace #Spirituality';
const CAPTIONS={babuji:'~ Babuji Maharaj',kcv:'– Dr K. C. Varadachari',kcn:'~ Sri K. C. Narayana'};
function seedData(){
  const lib=[
    {id:'q1',text:'Be happy to eat in constant Divine thought whatever you get, with due regard to honest and pious earnings.',cite:'(Commandment 8)',master:'babuji'},
    {id:'q2',text:'Delight is the aim and end, and it is this that man seeks in God, for God is delight.',cite:'(Vol IX - pg 271)',master:'kcv'},
    {id:'q3',text:'It is a hidden dictum of Nature that every soul must live a happy and restful life.',cite:'(Showers of Divine Grace - pg 37)',master:'babuji'},
    {id:'q4',text:'A happy disposition is a state which percolates its effect upon the lower layers and purifies them.',cite:'(Basic Writings of Sri Ramchandra - pg 162)',master:'babuji'},
    {id:'q5',text:'While taking food we fix our thought upon the Ultimate which we have finally to attain, in order to take in its effect too, and increase our purity all the more.',cite:'(Basic Writings of Sri Ramchandra - pg 163)',master:'babuji'},
    {id:'q6',text:'The modern civilisation is a dinner civilisation.',cite:'(Vol I - pg 84)',master:'kcv'}
  ];
  const mk=(date,q,st)=>({...DEFAULT_STYLE,...st,date,text:q.text,cite:q.cite,master:q.master,headerL:'',headerR:''});
  const plan={
    '2026-09-29|a':mk('2026-09-29',lib[0],{slot:'a',theme:'rose',photoSide:'left',shape:'oval'}),
    '2026-09-30|b':mk('2026-09-30',lib[1],{slot:'b',...MODERN_STYLE}),
    '2026-10-01|a':mk('2026-10-01',lib[2],{slot:'a',theme:'lavender',photoSide:'left'}),
    '2026-10-02|a':mk('2026-10-02',lib[3],{slot:'a',theme:'gold',photoSide:'right'}),
    '2026-10-03|a':mk('2026-10-03',lib[4],{slot:'a',theme:'sky',photoSide:'left',shape:'oval'}),
    '2026-10-03|b':mk('2026-10-03',lib[5],{slot:'b',...MODERN_STYLE})
  };
  return {lib,plan};
}
function defaults(){
  const s=seedData();
  return {
    settings:{
      periods:[{id:'p1',name:'Samadristi',start:'2026-09-16'}],
      masters:[
        {id:'babuji',name:'Babuji Maharaj',sign:'Sri Ramchandra',photo:null,photos:[]},
        {id:'kcv',name:'Dr K C Varadachari',sign:'Dr K C Varadachari',photo:null,photos:[]},
        {id:'kcn',name:'Sri K C Narayana',sign:'Sri K C Narayana',photo:null,photos:[]}
      ],
      site:'pranahutiyoga.org',
      ai:{model:DEFAULT_MODEL},
      slots:DEFAULT_SLOTS(),
      igExtra:DEFAULT_IG,
      draft:{...s.plan['2026-10-02|a']}
    },
    posted:{},
    library:s.lib,
    plan:s.plan
  };
}

/* ---------- storage (IndexedDB in this browser) ---------- */
const IDB={db:null,
  open(){return new Promise((res,rej)=>{try{const r=indexedDB.open('samadristi-studio',1);
    r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>{this.db=r.result;res()};r.onerror=()=>rej(r.error)}catch(e){rej(e)}})},
  get(k){return new Promise(res=>{if(!this.db)return res(undefined);const q=this.db.transaction('kv').objectStore('kv').get(k);q.onsuccess=()=>res(q.result);q.onerror=()=>res(undefined)})},
  set(k,v){return new Promise((res,rej)=>{if(!this.db)return rej(new Error('no db'));const tx=this.db.transaction('kv','readwrite');tx.objectStore('kv').put(v,k);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error)})},
  del(k){return new Promise(res=>{if(!this.db)return res();const tx=this.db.transaction('kv','readwrite');tx.objectStore('kv').delete(k);tx.oncomplete=()=>res();tx.onerror=()=>res()})},
  keys(){return new Promise(res=>{if(!this.db)return res([]);const q=this.db.transaction('kv').objectStore('kv').getAllKeys();q.onsuccess=()=>res(q.result||[]);q.onerror=()=>res([])})}
};
let state=defaults();
let photos={}; // id -> dataURL
let card=clone(state.settings.draft);
let saveTimer=null, storageOK=true;

function migrate(){
  const s=state.settings;
  s.ai=s.ai||{model:DEFAULT_MODEL};
  if(!Array.isArray(s.slots)||!s.slots.length) s.slots=DEFAULT_SLOTS();
  if(!s.calendar) s.calendar='lalaji';
  if(s.igExtra==null) s.igExtra=DEFAULT_IG;
  state.posted=state.posted||{};
  for(const m of s.masters){ if(m.caption==null) m.caption=CAPTIONS[m.id]||('~ '+m.name) }
  for(const k of Object.keys(state.plan)){ if(!k.includes('|')){const c=state.plan[k];delete state.plan[k];c.slot=c.slot||s.slots[0].id;state.plan[k+'|'+c.slot]=c} }
  if(s.draft&&!s.draft.slot) s.draft.slot=s.slots[0].id;
  for(const m of s.masters){ if(!Array.isArray(m.photos)) m.photos=m.photo?[m.photo]:[]; if(m.photo&&!m.photos.includes(m.photo)) m.photos.unshift(m.photo) }
}
function scheduleSave(){
  clearTimeout(saveTimer); setStatus('Saving…'); state.updatedAt=Date.now();
  saveTimer=setTimeout(async()=>{
    try{await IDB.set('state',state);setStatus('Saved in this browser');if(typeof syncPush==='function'&&SRV.ok)syncPush()}
    catch(e){setStatus('Could not save — browser storage is blocked or full')}
  },600);
}
function setStatus(t){$('#saveStatus').textContent=t}
async function savePhoto(id,data){photos[id]=data;try{await IDB.set('photo:'+id,data)}catch(e){setStatus('Photo not saved — browser storage is full')}}
async function deletePhoto(id){delete photos[id];await IDB.del('photo:'+id)}

/* ---------- calendar ---------- */
const LALAJI_MONTHS=[['Samavarti',31],['Prana',30],['Bhuma',30],['Prabhu',31],['Bhanwar',30],['Iswar',31],['Varada',31],['Krishna',31],['Samadristi',30],['Satpad',30],['Radha',30],['Viveka',30]];
function lalajiFor(date){
  const [y,m,d]=date.split('-').map(Number);
  const startY=(m>1||d>=14)?y:y-1;
  let off=Math.round((Date.UTC(y,m-1,d)-Date.UTC(startY,0,14))/864e5);
  const leapIn=((startY%4===0&&(startY%100!==0||startY%400===0))); // year starting Jan 14 contains Feb 29 of startY
  for(const [name,len0] of LALAJI_MONTHS){const len=len0+(name==='Prana'&&leapIn?1:0);if(off<len)return {name,n:off+1,year:startY-1872};off-=len}
  return {name:'Viveka',n:30+off+1,year:startY-1872};
}
function periodFor(date){
  if(!date) return null;
  if(state.settings.calendar!=='custom') return lalajiFor(date);
  const d=toDay(date); let best=null;
  for(const p of state.settings.periods){
    if(!p.name||!p.start) continue;
    const s=toDay(p.start);
    if(s<=d&&(!best||s>toDay(best.start))) best=p;
  }
  return best?{name:best.name,n:Math.round((d-toDay(best.start))/864e5)+1}:null;
}
function headerTexts(c){
  const f=c.dash||'dash';const sep=f==='plain'?' ':f==='dot'?' · ':f==='comma'?', ':' – ';
  const p=periodFor(c.date);
  let right='',left='';
  if(c.date){const[,m,d]=c.date.split('-').map(Number);right=f==='dayfirst'?`${d} ${MONTHS[m-1]}`:MONTHS[m-1]+sep+d}
  if(p) left=f==='dayfirst'?`${p.n} ${p.name}`:p.name+sep+p.n;
  return {left:c.headerL||left,right:c.headerR||right,auto:p};
}

/* ---------- images ---------- */
const imgCache=new Map();
function loadImg(src){
  if(imgCache.has(src)) return imgCache.get(src);
  const pr=new Promise((res)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>res(null);i.src=src});
  imgCache.set(src,pr); return pr;
}
function defaultPhotoOf(m){return m?(m.photo&&photos[m.photo]?m.photo:(m.photos||[]).find(id=>photos[id])||null):null}
function photoSrc(c){
  if(c.photo==='none') return null;
  if(c.photo==='master'){const id=defaultPhotoOf(masterOf(c));return id?photos[id]:null}
  return photos[c.photo]||null;
}
async function fileToPhoto(file){
  const url=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file)});
  const img=await loadImg(url); imgCache.delete(url); if(!img) throw new Error('bad image');
  const max=1100, s=Math.min(1,max/Math.max(img.width,img.height));
  const c=document.createElement('canvas');c.width=Math.round(img.width*s);c.height=Math.round(img.height*s);
  c.getContext('2d').drawImage(img,0,0,c.width,c.height);
  const id=uidGen(); await savePhoto(id,c.toDataURL('image/jpeg',0.88));
  return id;
}
async function ensureFonts(c){
  const fam=FONTS[c.font]||FONTS.montserrat;
  try{await Promise.all([
    document.fonts.load('40px Parisienne'),
    document.fonts.load("italic 40px 'Cormorant Garamond'"),
    document.fonts.load('400 40px '+fam),
    document.fonts.load("400 40px 'DM Sans'"),
    document.fonts.load(HEADER_FONTS[headerFontKey(c)].css.replace('{S}','40'))
  ]);await document.fonts.ready}catch(e){}
}
