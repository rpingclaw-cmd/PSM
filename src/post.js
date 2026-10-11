
/* ---------- preview ---------- */
let renderToken=0, rafPending=false;
function schedulePreview(){
  if(rafPending) return; rafPending=true;
  requestAnimationFrame(async()=>{rafPending=false;const t=++renderToken;
    const off=document.createElement('canvas');await renderCard(off,card);
    if(t!==renderToken) return;
    const cv=$('#preview');cv.width=off.width;cv.height=off.height;cv.getContext('2d').drawImage(off,0,0);
  });
}
let draftTimer=null;
function cardChanged(){
  schedulePreview();updateAutoHeader();
  clearTimeout(draftTimer);draftTimer=setTimeout(()=>{state.settings.draft=clone(card);scheduleSave()},700);
}
function updateAutoHeader(){
  const p=periodFor(card.date);
  $('#autoHeader').textContent=p?`Auto: ${p.name} day ${p.n}. Leave the header fields blank to use it.`:'No calendar period covers this date yet — add one in Setup, or type the header yourself.';
  $('#cardNote').textContent=state.plan[pk(card)]?`Saved for ${fmtTime(slotOf(card.slot).time)} on this day`:'';
}

/* ---------- card form ---------- */
function masterOptions(){return state.settings.masters.map(m=>`<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('')}
function fillSelects(){
  const ms=state.settings.masters,opts=masterOptions();
  document.querySelectorAll('#masterSelect,.masterOpts').forEach(el=>{const v=el.value;el.innerHTML=opts;if(v&&ms.some(m=>m.id===v))el.value=v});
  $('#masterSelect').value=card.master;
  const ss=$('#slotSelect');ss.innerHTML=slots().map(s=>`<option value="${esc(s.id)}">${esc(fmtTime(s.time))} · ${esc(s.label)}</option>`).join('');if(!card.slot)card.slot=slots()[0].id;ss.value=card.slot;
  renderPhotoStrip();
}
function renderPhotoStrip(){
  const m=masterOf(card); const ids=(m?m.photos:[]).filter(id=>photos[id]);
  const def=defaultPhotoOf(m);
  const extra=(card.photo!=='master'&&card.photo!=='none'&&photos[card.photo]&&!ids.includes(card.photo))?[card.photo]:[];
  let h=[...ids,...extra].map((id,i)=>{
    const on=card.photo===id||(card.photo==='master'&&id===def);
    return `<button data-ph="${id}" aria-pressed="${on}" aria-label="Photo ${i+1}${id===def?' (default)':''}"><img src="${photos[id]}" alt=""></button>`}).join('');
  h+=`<button data-ph="none" aria-pressed="${card.photo==='none'}">No photo</button>`;
  h+=`<button data-ph="add" aria-pressed="false">+ Add photos</button>`;
  $('#photoStrip').innerHTML=h;
}
$('#photoStrip').addEventListener('click',e=>{
  const b=e.target.closest('[data-ph]');if(!b)return;const v=b.dataset.ph;
  if(v==='add'){$('#stripPhotoInput').click();return}
  const m=masterOf(card);
  card.photo=(v!=='none'&&v===defaultPhotoOf(m))?'master':v;
  renderPhotoStrip();cardChanged();
});
$('#stripPhotoInput').addEventListener('change',async e=>{
  const files=[...e.target.files];if(!files.length)return;const m=masterOf(card);let last=null;
  for(const f of files){try{const id=await fileToPhoto(f);last=id;if(m){m.photos.push(id);if(!m.photo)m.photo=id}}catch(err){alert('One image could not be read. Try JPG or PNG.')}}
  if(last){card.photo=last;scheduleSave();renderPhotoStrip();cardChanged()}
  e.target.value='';
});
function fillForm(){
  fillSelects();
  document.querySelectorAll('#pane-card [data-k]').forEach(el=>{
    const v=card[el.dataset.k];
    if(el.type==='checkbox') el.checked=!!v; else el.value=v??'';
  });
  document.querySelectorAll('#formatChips .chip').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.f===card.format)));
  document.querySelectorAll('#themeSwatches .sw').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.t===card.theme)));
  cardChanged();
}
function setLayout(v){
  card.layout=v;
  if(v==='modern'){card.dash='plain';card.citeStyle='inline';if(card.shape==='soft')card.shape='cutout';card.showName=true;card.showSite=true;card.font='dmsans'}
  else{card.dash='dash';card.citeStyle='small';if(card.shape==='cutout')card.shape='soft';card.showName=false;card.showSite=false;card.font='montserrat'}
}
function bindCardForm(){
  document.querySelectorAll('#pane-card [data-k]').forEach(el=>{
    const ev=(el.tagName==='SELECT'||el.type==='checkbox'||el.type==='date')?'change':'input';
    el.addEventListener(ev,()=>{
      const k=el.dataset.k;
      let v=el.type==='checkbox'?el.checked:el.type==='range'?parseFloat(el.value):el.value;
      if((k==='date'||k==='slot')){const nk=pk({...card,[k]:v});if(state.plan[nk]&&nk!==pk(card)&&confirm('This post already has a saved card. Open it?')){card={...DEFAULT_STYLE,...clone(state.plan[nk])};fillForm();return}}
      if(k==='layout'){setLayout(v);fillForm();return}
      card[k]=v;
      if(k==='master'){card.photo='master';renderPhotoStrip()}
      cardChanged();
    });
  });
  const fc=$('#formatChips');
  fc.innerHTML=Object.entries(FORMATS).map(([k,f])=>`<button class="chip" data-f="${k}" aria-pressed="false">${f.label}</button>`).join('');
  fc.addEventListener('click',e=>{const b=e.target.closest('.chip');if(!b)return;card.format=b.dataset.f;
    if(b.dataset.f!=='landscape'&&card.layout==='classic') setLayout('modern');
    if(b.dataset.f==='landscape'&&card.layout==='modern') setLayout('classic');
    fillForm()});
  const ts=$('#themeSwatches');
  ts.innerHTML=Object.entries(THEMES).map(([k,t])=>`<button class="sw" data-t="${k}" style="background:${t.css}" aria-label="${t.label}" title="${t.label}" aria-pressed="false"></button>`).join('');
  ts.addEventListener('click',e=>{const b=e.target.closest('.sw');if(!b)return;card.theme=b.dataset.t;fillForm()});
  $('#saveDayBtn').addEventListener('click',()=>{
    if(!card.date){alert('Pick a date first.');return}
    if(!card.slot)card.slot=slots()[0].id;state.plan[pk(card)]={...clone(card),_t:Date.now()};scheduleSave();updateAutoHeader();renderMonth();renderToday();
    $('#cardNote').textContent=`Saved for ${card.date}, ${fmtTime(slotOf(card.slot).time)}`;
  });
  $('#downloadBtn').addEventListener('click',()=>downloadCard(card));
  $('#shareBtn').addEventListener('click',()=>shareCard(card));
  try{ if(navigator.canShare&&navigator.canShare({files:[new File([new Blob(['x'])],'t.png',{type:'image/png'})]})) $('#shareBtn').hidden=false }catch(e){}
}
function fileName(c){
  const p=periodFor(c.date);
  const s=c.slot?slotOf(c.slot):null;
  return `${p?p.name.toLowerCase().replace(/\s+/g,'-')+'-'+p.n+'-':''}${c.date||'card'}${s&&s.time?'-'+s.time.replace(':',''):''}-${c.format}.png`;
}
async function cardBlob(c){const cv=document.createElement('canvas');await renderCard(cv,c);return await new Promise(r=>cv.toBlob(r,'image/png'))}
function saveBlob(blob,name){
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},5000);
}
async function downloadCard(c){
  const blob=await cardBlob(c); if(!blob){alert('Could not create the image.');return}
  saveBlob(blob,fileName(c));
}
async function shareCard(c){
  const blob=await cardBlob(c);const f=new File([blob],fileName(c),{type:'image/png'});
  try{await navigator.share({files:[f],text:[c.text,c.cite].filter(Boolean).join(' ')})}catch(e){if(e.name!=='AbortError'){const url=URL.createObjectURL(blob);$('#modalImg').src=url;$('#modal').classList.add('on')}}
}
$('#modalClose').addEventListener('click',()=>$('#modal').classList.remove('on'));
$('#modal').addEventListener('click',e=>{if(e.target.id==='modal')$('#modal').classList.remove('on')});

/* ---------- tabs ---------- */
document.querySelector('.tabs').addEventListener('click',e=>{
  const b=e.target.closest('button[data-tab]');if(!b)return;
  document.querySelectorAll('.tabs button').forEach(x=>x.setAttribute('aria-selected',String(x===b)));
  document.querySelectorAll('.pane').forEach(p=>p.classList.toggle('on',p.id==='pane-'+b.dataset.tab));
  document.body.dataset.tab=b.dataset.tab;
  if(b.dataset.tab==='month')renderMonth(); if(b.dataset.tab==='today')renderToday(); if(b.dataset.tab==='auto')renderAuto(); if(b.dataset.tab==='bank')renderBank(); if(b.dataset.tab==='studio'){stuRenderInfo();stuRenderTranscript()} if(b.dataset.tab==='library')renderLibrary(); if(b.dataset.tab==='setup')renderSetup(); if(b.dataset.tab==='find')renderSources();
});
function showTab(t){document.querySelector(`.tabs button[data-tab="${t}"]`).click()}

/* ---------- slots, month & today ---------- */
function slots(){return state.settings.slots}
function slotOf(id){return slots().find(s=>s.id===id)||slots()[0]}
function pk(c){return c.date+'|'+(c.slot||slots()[0].id)}
function planFor(date,slot){return state.plan[date+'|'+slot]}
function fmtTime(t){if(!t)return'';const[h,m]=t.split(':').map(Number);return `${(h%12)||12}:${String(m).padStart(2,'0')} ${h<12?'AM':'PM'}`}
function shuffled(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function photosOf(masterId){const m=state.settings.masters.find(x=>x.id===masterId);return m?shuffled(m.photos.filter(id=>photos[id])):[]}
function captionFor(c,kind){
  const m=state.settings.masters.find(x=>x.id===c.master);
  const end=m?(m.caption||('~ '+m.name)):'';
  let t=(c.text||'').replace(/\s*\n\s*/g,' ').trim()+(end?' '+end:'');
  if(kind==='ig'){if(c.cite)t+='\n'+c.cite;if(c.link)t+='\n\nRead it in context: '+c.link;const ex=(state.settings.igExtra||'').trim();if(ex)t+='\n\n'+ex}
  return t;
}
function newCardFor(date,slotId){
  const s=slotOf(slotId);
  return {...DEFAULT_STYLE,...clone(s.style||{}),date,slot:s.id,text:'',cite:'',master:s.master&&s.master!=='any'?s.master:(card.master||'babuji'),photo:'master',headerL:'',headerR:''};
}
function openCard(date,slotId){
  const c=planFor(date,slotId);
  card=c?{...DEFAULT_STYLE,...clone(c)}:newCardFor(date,slotId);
  fillForm();showTab('card');window.scrollTo({top:0,behavior:'smooth'});
}

/* month */
function daysIn(ym){const[y,m]=ym.split('-').map(Number);const n=new Date(y,m,0).getDate();return Array.from({length:n},(_,i)=>`${ym}-${String(i+1).padStart(2,'0')}`)}
function monthKeys(ym){return Object.keys(state.plan).filter(k=>k.startsWith(ym+'-')).sort((a,b)=>a.localeCompare(b)||0)}
function renderMonth(){
  const ym=$('#monthPick').value||todayStr().slice(0,7);
  const days=daysIn(ym);const t=todayStr();let have=0;
  $('#monthList').innerHTML=days.map(d=>{
    const p=periodFor(d),dt=new Date(d+'T12:00:00');
    const rows=slots().map(s=>{const c=planFor(d,s.id);if(c)have++;const posted=state.posted[d+'|'+s.id];
      return `<div style="display:flex;gap:8px;align-items:center;margin:4px 0">
        <div style="flex:1;min-width:0"><div class="h">${esc(fmtTime(s.time))} · ${c?esc(masterName(c.master)):esc(s.label)}${posted?' · ✓ posted':''}</div>
        <div class="q">${c?esc(c.text):'No quote yet'}</div></div>
        <button class="btn small" data-edit="${d}|${s.id}">${c?'Edit':'Create'}</button>${c?`<button class="btn small" data-dl="${d}|${s.id}">PNG</button>`:''}</div>`}).join('');
    return `<div class="day" style="grid-template-columns:62px 1fr"><div class="d">${dt.getDate()}<small>${WEEK[dt.getDay()]}${d===t?' · today':''}</small><small>${p?esc(p.name+' '+p.n):''}</small></div><div>${rows}</div></div>`;
  }).join('');
  $('#monthStatus').textContent=`${have} of ${days.length*slots().length} posts have a card.`;
}
$('#monthPick').addEventListener('change',renderMonth);
$('#monthList').addEventListener('click',e=>{
  const ed=e.target.closest('[data-edit]'),dl=e.target.closest('[data-dl]');
  if(ed){const[d,s]=ed.dataset.edit.split('|');openCard(d,s)}
  if(dl) downloadCard({...DEFAULT_STYLE,...state.plan[dl.dataset.dl]});
});
$('#fillBtn').addEventListener('click',()=>{
  const ym=$('#monthPick').value;const days=daysIn(ym);
  const used=new Set(Object.values(state.plan).map(c=>c.text));
  const themes=shuffled(Object.keys(THEMES).filter(t=>t!=='white'));const rotate=$('#fillThemes').value==='rotate';
  const photoTurn={},pools={};let filled=0,missing=0,ti=0;
  for(const d of days) for(const s of slots()){
    if(planFor(d,s.id)) continue;
    const key=s.master&&s.master!=='any'?s.master:'*';
    if(!pools[key]) pools[key]=state.library.filter(q=>!used.has(q.text)&&(key==='*'||q.master===key));
    const q=pools[key].shift(); if(!q){missing++;continue}
    used.add(q.text);
    const st={...newCardFor(d,s.id),text:q.text,cite:q.cite,master:q.master,link:q.link||''};
    const ph=photosOf(q.master);
    if(ph.length>1){const n=photoTurn[q.master]=(photoTurn[q.master]??-1)+1;st.photo=ph[n%ph.length]}
    if(rotate){st.theme=themes[ti++%themes.length];if(st.layout==='classic'){st.photoSide=Math.random()<.5?'left':'right';st.shape=['soft','oval','soft'][filled%3]}}
    state.plan[d+'|'+s.id]=st;filled++;
  }
  scheduleSave();renderMonth();renderToday();
  $('#monthStatus').textContent+=` Filled ${filled}.`+(missing?` ${missing} posts still empty — the library has no more unused quotes for that master. Add more in Find quotes.`:'');
});
$('#shuffleBtn').addEventListener('click',()=>{
  const ym=$('#monthPick').value;const keys=monthKeys(ym);
  if(!keys.length){alert('No cards saved for this month yet. Fill the month first.');return}
  const themes=shuffled(Object.keys(THEMES).filter(t=>t!=='white'));const pools={},turn={};
  keys.forEach((k,i)=>{const c=state.plan[k];
    if(!pools[c.master]) pools[c.master]=photosOf(c.master);
    const ph=pools[c.master];
    if(ph.length&&c.photo!=='none'){const n=turn[c.master]=(turn[c.master]??-1)+1;c.photo=ph[n%ph.length]}
    c.theme=themes[i%themes.length];
    if(c.layout==='classic'){c.photoSide=Math.random()<.5?'left':'right';c.shape=['soft','oval','soft','rect'][Math.floor(Math.random()*4)]}
    else c.photoSide=Math.random()<.7?'right':'left';
  });
  scheduleSave();renderMonth();renderToday();
  const multi=Object.values(pools).some(p=>p.length>1);
  $('#monthStatus').textContent=`Shuffled ${keys.length} cards.`+(multi?'':' Tip: add more photos for each master in Setup so the photo changes too.');
  if(state.plan[pk(card)]){card={...DEFAULT_STYLE,...clone(state.plan[pk(card)])};fillForm()}
});
$('#zipBtn').addEventListener('click',async()=>{
  const ym=$('#monthPick').value;const keys=monthKeys(ym);
  if(!keys.length){alert('No cards saved for this month yet.');return}
  if(!window.JSZip){alert('The zip tool did not load. Download days one at a time instead.');return}
  const btn=$('#zipBtn');btn.disabled=true;const zip=new JSZip();let txt='';
  try{
    for(let i=0;i<keys.length;i++){$('#monthStatus').textContent=`Drawing card ${i+1} of ${keys.length}…`;
      const c={...DEFAULT_STYLE,...state.plan[keys[i]]};const name=fileName(c);zip.file(name,await cardBlob(c));
      if($('#zipStories').checked){const sc=storyOf(c);zip.file('stories/'+fileName(sc),await cardBlob(sc))}
      txt+=`${c.date}  ${fmtTime(slotOf(c.slot).time)}  ${name}\nWhatsApp:\n${captionFor(c,'wa')}\n\nInstagram / Facebook:\n${captionFor(c,'ig')}\n\n----------\n\n`}
    zip.file('captions.txt',txt);
    saveBlob(await zip.generateAsync({type:'blob'}),`quote-cards-${ym}.zip`);
    $('#monthStatus').textContent=`${keys.length} cards and captions.txt downloaded.`;
  }finally{btn.disabled=false}
});
$('#surpriseBtn').addEventListener('click',()=>{
  const keys=Object.keys(THEMES).filter(t=>t!=='white'&&t!==card.theme);
  card.theme=keys[Math.floor(Math.random()*keys.length)];
  card.photoSide=Math.random()<.5?'left':'right';
  card.shape=card.layout==='modern'?['cutout','soft','oval'][Math.floor(Math.random()*3)]:['soft','oval','soft','rect'][Math.floor(Math.random()*4)];
  const ph=photosOf(card.master);if(ph.length>1&&card.photo!=='none'){const cur=card.photo==='master'?defaultPhotoOf(masterOf(card)):card.photo;const other=ph.filter(x=>x!==cur);card.photo=other[0]||ph[0]}
  fillForm();
});

/* today */
let todayDate=todayStr(); const todayFiles={}; let todayToken=0;
function shiftDate(d,n){const t=new Date(d+'T12:00:00');t.setDate(t.getDate()+n);return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`}
async function renderToday(){
  const box=$('#todayList');if(!box)return;const tok=++todayToken;
  const dt=new Date(todayDate+'T12:00:00');const p=periodFor(todayDate);
  $('#todayLabel').textContent=`${WEEK[dt.getDay()]}, ${MONTHS[dt.getMonth()]} ${dt.getDate()}${p?' · '+p.name+' '+p.n:''}${todayDate===todayStr()?' · today':''}`;
  box.innerHTML=slots().map(s=>{const k=todayDate+'|'+s.id,c=state.plan[k],posted=state.posted[k];
    if(!c) return `<div class="src"><div class="top"><span class="kind">${esc(fmtTime(s.time))} · ${esc(s.label)}</span></div>
      <p class="status">No card for this post yet.</p><button class="btn small primary" data-tcreate="${k}">Create card</button></div>`;
    return `<div class="src" data-tk="${k}"><div class="top"><span class="kind">${esc(fmtTime(s.time))} · ${esc(masterName(c.master))}</span>
      ${posted?'<span class="badge ok" style="margin:0">Posted ✓</span>':''}</div>
      <img data-timg="${k}" alt="Card for ${esc(fmtTime(s.time))}" style="width:100%;border-radius:8px;display:block;min-height:120px;background:var(--soft)">
      <label class="f" style="margin-top:10px"><span>WhatsApp caption</span><textarea rows="3" data-tcap="${k}">${esc(captionFor(c,'wa'))}</textarea></label>
      <div class="under" style="margin-top:0">
        <button class="btn primary small" data-tshare="${k}">Share card + caption</button>
        <button class="btn small" data-tcopy="${k}">Copy caption</button>
        <button class="btn small" data-tig="${k}">Copy Insta/FB caption</button>
        <button class="btn small" data-tdl="${k}">Download</button>
        <button class="btn small" data-tstory="${k}">Story</button>
        <button class="btn small" data-treel="${k}">Reel video</button>
        <button class="btn small" data-tedit="${k}">Edit</button>
        <button class="btn small" data-tposted="${k}">${posted?'Mark not posted':'Mark posted'}</button>
      </div></div>`}).join('');
  for(const s of slots()){const k=todayDate+'|'+s.id,c=state.plan[k];if(!c)continue;
    const blob=await cardBlob({...DEFAULT_STYLE,...c});if(tok!==todayToken)return;
    todayFiles[k]=new File([blob],fileName(c),{type:'image/png'});
    const img=box.querySelector(`[data-timg="${k}"]`);if(img)img.src=URL.createObjectURL(blob);}
}
async function copyText(t){try{await navigator.clipboard.writeText(t);return true}catch(e){const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();let ok=false;try{ok=document.execCommand('copy')}catch(_){}ta.remove();return ok}}
function toast(msg){$('#todayStatus').textContent=msg;clearTimeout(toast.t);toast.t=setTimeout(()=>$('#todayStatus').textContent='',5000)}
$('#todayList').addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b)return;const ds=b.dataset;
  if(ds.tcreate){const[d,s]=ds.tcreate.split('|');openCard(d,s);return}
  const k=ds.tshare||ds.tcopy||ds.tig||ds.tdl||ds.tedit||ds.tposted;if(!k)return;const c=state.plan[k];
  const cap=(document.querySelector(`[data-tcap="${k}"]`)||{}).value||captionFor(c,'wa');
  if(ds.tshare){
    const f=todayFiles[k];
    copyText(cap);
    if(f&&navigator.canShare&&navigator.canShare({files:[f]})){
      try{await navigator.share({files:[f],text:cap});toast('Shared. The caption is also copied — paste it if WhatsApp did not add it.');if(!state.posted[k]){state.posted[k]=true;scheduleSave();renderToday()}}
      catch(err){if(err.name!=='AbortError')toast('Sharing did not work here. Use Download, then paste the copied caption.')}
    }else{if(f)saveBlob(f,f.name);toast('This browser cannot share files, so the card was downloaded and the caption copied.')}
  }
  if(ds.tcopy){toast(await copyText(cap)?'WhatsApp caption copied.':'Could not copy — select the text and copy it.')}
  if(ds.tig){toast(await copyText(captionFor(c,'ig'))?'Instagram / Facebook caption copied.':'Could not copy.')}
  if(ds.tdl){const f=todayFiles[k];if(f)saveBlob(f,f.name)}
  if(ds.tedit){const[d,s]=k.split('|');openCard(d,s)}
  if(ds.tposted){if(state.posted[k])delete state.posted[k];else state.posted[k]=true;scheduleSave();renderToday();renderMonth()}
});
$('#todayPrev').addEventListener('click',()=>{todayDate=shiftDate(todayDate,-1);renderToday()});
$('#todayNext').addEventListener('click',()=>{todayDate=shiftDate(todayDate,1);renderToday()});
$('#todayNow').addEventListener('click',()=>{todayDate=todayStr();renderToday()});
$('#icsBtn').addEventListener('click',()=>{
  const d=todayStr().replace(/-/g,''),url=location.href.split('#')[0];
  const ev=slots().map(s=>{const t=(s.time||'09:00').replace(':','')+'00';return ['BEGIN:VEVENT',`UID:quote-${s.id}-${Date.now()}@daily-quote-cards`,`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').slice(0,15)}Z`,
    `DTSTART:${d}T${t}`,'DURATION:PT10M','RRULE:FREQ=DAILY',`SUMMARY:Post ${s.label} quote card`,`DESCRIPTION:Open ${url} → Today → Share`,`URL:${url}`,
    'BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:Post today\'s quote card','TRIGGER:PT0M','END:VALARM','END:VEVENT'].join('\r\n')}).join('\r\n');
  saveBlob(new Blob([`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Daily Quote Cards//EN\r\n${ev}\r\nEND:VCALENDAR\r\n`],{type:'text/calendar'}),'quote-card-reminders.ics');
  toast('Open the downloaded file to add daily reminders to your calendar.');
});

/* card ↔ slot */
function useLookForSlot(){
  const s=slotOf(card.slot);const keys=['format','layout','theme','font','size','lh','align','dash','photoSide','shape','gray','zoom','ox','oy','showName','showSite','citeStyle','headerFont','headerSize','headerColor','headerBar','nameSize','nameColor','siteColor','siteSize'];
  s.style={};keys.forEach(k=>s.style[k]=card[k]);scheduleSave();
  $('#cardNote').textContent=`New ${s.label.toLowerCase()} cards will use this look.`;
}

/* ---------- library ---------- */
function masterName(id){return (state.settings.masters.find(m=>m.id===id)||{}).name||''}
function renderLibrary(){
  const q=($('#libSearch').value||'').toLowerCase();
  const items=state.library.filter(x=>!q||(x.text+' '+x.cite+' '+masterName(x.master)).toLowerCase().includes(q));
  const used=new Set(Object.values(state.plan).map(c=>c.text));
  $('#libCount').textContent=`${items.length} quote${items.length===1?'':'s'}`;
  $('#libList').innerHTML=items.map(x=>`<div class="item"><p>${esc(x.text)}</p>
    <div class="meta">${esc(x.cite)} · ${esc(masterName(x.master))}${used.has(x.text)?' · on the calendar':''}${x.link?` · <a href="${esc(x.link)}" target="_blank" rel="noopener">open in book</a>`:''}</div>
    <div class="acts"><button class="btn small primary" data-use="${x.id}">Use on card</button><button class="btn small" data-del="${x.id}">Remove</button></div></div>`).join('')||'<p class="status">Nothing here yet. Use Find quotes, or add one by hand.</p>';
}
$('#libSearch').addEventListener('input',renderLibrary);
$('#libList').addEventListener('click',e=>{
  const u=e.target.closest('[data-use]'),d=e.target.closest('[data-del]');
  if(u){const q=state.library.find(x=>x.id===u.dataset.use);card.text=q.text;card.cite=q.cite;card.master=q.master;card.photo='master';card.link=q.link||'';fillForm();showTab('card');window.scrollTo({top:0,behavior:'smooth'})}
  if(d&&confirm('Remove this quote from the library?')){state.tomb=state.tomb||{};state.tomb[d.dataset.del]=Date.now();state.library=state.library.filter(x=>x.id!==d.dataset.del);scheduleSave();renderLibrary()}
});
$('#addQuoteBtn').addEventListener('click',()=>{
  const text=$('#newText').value.trim();if(!text){alert('Type the quote first.');return}
  state.library.unshift({id:uidGen(),text,cite:$('#newCite').value.trim(),master:$('#newMaster').value});
  $('#newText').value='';$('#newCite').value='';scheduleSave();renderLibrary();
});

/* ---------- Gemini ---------- */
const API='https://generativelanguage.googleapis.com';
function geminiKey(){try{return localStorage.getItem(KEY_STORE)||''}catch(e){return window.__key||''}}
function geminiModel(){return (state.settings.ai.model||DEFAULT_MODEL).replace(/^models\//,'').trim()}
function rankModels(names){
  const ok=names.filter(n=>/^gemini-/.test(n)&&/flash|pro/.test(n)&&!/tts|image|embed|live|audio|transcribe|computer|robotics|learnlm|exp-\d/.test(n));
  const ver=n=>{const m=n.match(/gemini-(\d+(?:\.\d+)?)/);return m?parseFloat(m[1]):0};
  const score=n=>{let s=ver(n)*10;if(/pro/.test(n))s-=200;if(/lite/.test(n))s-=100;if(/preview|exp/.test(n))s-=50;if(/latest/.test(n))s-=2;if(/-\d{3}$|-\d{2}-\d{4}$/.test(n))s-=5;return s};
  return [...new Set(ok)].sort((a,b)=>score(b)-score(a));
}
async function listModels(key){
  const r=await fetch(`${API}/v1beta/models?pageSize=1000`,{headers:{'x-goog-api-key':key}});const d=await r.json().catch(()=>({}));
  if(!r.ok) throw {code:r.status,message:(d.error&&d.error.message)||r.statusText};
  return (d.models||[]).filter(m=>(m.supportedGenerationMethods||[]).includes('generateContent')).map(m=>m.name.replace(/^models\//,''));
}
async function testModel(key,model){
  try{const r=await fetch(`${API}/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},
    body:JSON.stringify({contents:[{role:'user',parts:[{text:'Reply with the word OK.'}]}],generationConfig:{maxOutputTokens:200}})});
    const d=await r.json().catch(()=>({}));return {ok:r.ok,status:r.status,message:(d.error&&d.error.message)||''};
  }catch(e){return {ok:false,status:0,message:String(e)}}
}
const isKeyError=t=>t.status===401||t.status===403||(t.status===400&&/api key/i.test(t.message||''));
async function autoPickModel(onStatus){
  const key=geminiKey(); if(!key) throw {code:'nokey'};
  const names=await listModels(key);
  $('#modelList').innerHTML=rankModels(names).map(n=>`<option value="${esc(n)}">`).join('');
  const ranked=rankModels(names);
  let lastErr=null;
  for(const m of ranked.slice(0,10)){
    onStatus&&onStatus('Trying '+m+'…');
    const t=await testModel(key,m);
    if(t.ok){state.settings.ai.model=m;scheduleSave();const box=$('#aiModel');if(box)box.value=m;return m}
    if(isKeyError(t)) throw {code:t.status,message:t.message};
    lastErr=t;
  }
  throw {code:'nomodel',message:lastErr?lastErr.message:'no models listed for this key'};
}
async function gemini(parts,{json=false,signal,maxTokens,onStatus}={}){
  const key=geminiKey(); if(!key) throw {code:'nokey'};
  const body={contents:[{role:'user',parts}],generationConfig:{temperature:0.2}};
  if(json) body.generationConfig.responseMimeType='application/json';
  if(maxTokens) body.generationConfig.maxOutputTokens=maxTokens;
  let switched=false, busyTries=0, rateTries=0;
  for(;;){
    const r=await fetch(`${API}/v1beta/models/${encodeURIComponent(geminiModel())}:generateContent`,{method:'POST',signal,headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify(body)});
    const d=await r.json().catch(()=>({}));
    if(r.ok){
      const c=d.candidates&&d.candidates[0];
      const text=((c&&c.content&&c.content.parts)||[]).filter(p=>!p.thought).map(p=>p.text||'').join('');
      if(!text) throw {code:'empty',message:(d.promptFeedback&&d.promptFeedback.blockReason)||(c&&c.finishReason)||'no answer'};
      return text;
    }
    const msg=(d.error&&d.error.message)||r.statusText;
    if(!switched&&(r.status===404||(r.status===400&&/not (found|supported)|no longer available|unsupported model/i.test(msg)))){
      switched=true;onStatus&&onStatus('That model is not available on your key — finding one that works…');
      await autoPickModel(onStatus);continue;
    }
    if((r.status===500||r.status===503)&&busyTries<3){busyTries++;onStatus&&onStatus('Gemini is busy — retrying…');await sleep(4000*busyTries);continue}
    if(r.status===429&&rateTries<2){
      const info=((d.error&&d.error.details)||[]).find(x=>x.retryDelay);const wait=info?parseFloat(info.retryDelay):30;
      if(wait<=65&&!/per day|PerDay/i.test(msg)){rateTries++;onStatus&&onStatus(`Free-tier speed limit — waiting ${Math.ceil(wait)} seconds…`);await sleep((wait+1)*1000);continue}
    }
    throw {code:r.status,message:msg};
  }
}
function parseJSON(t){try{return JSON.parse(t)}catch(e){const m=String(t).match(/[\[{][\s\S]*[\]}]/);if(m)return JSON.parse(m[0]);throw e}}
function errMsg(e){
  if(!e) return 'Something went wrong.';
  if(e.name==='AbortError') return 'Stopped.';
  if(e.code==='allfailed') return e.message;
  if(e.code==='nokey') return 'Add your free Gemini key in Setup first.';
  if(e.code===400) return 'Gemini could not process this: '+(e.message||'bad request')+'. Try a smaller page range or file.';
  if(e.code===401||e.code===403) return 'The Gemini key was not accepted. Check it in Setup.';
  if(e.code==='nomodel') return 'No Gemini model on this key accepted a request ('+(e.message||'')+'). Try again later or create a new key in AI Studio.';
  if(e.code===404) return 'Gemini model not available: '+(e.message||'')+' Press Check key in Setup.';
  if(e.code===429) return /per day|PerDay|daily|quota|exhausted/i.test(e.message||'')?'daily free limit used up':'speed limit reached';
  if(e.code==='upload') return e.message;
  if(e.code==='empty') return 'Gemini returned no text ('+e.message+'). Try again or use a smaller piece.';
  return 'Something went wrong: '+(e.message||e.code||e);
}
function blobToBase64(blob){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(',')[1]);r.onerror=rej;r.readAsDataURL(blob)})}
const MIME={mp3:'audio/mpeg',m4a:'audio/mp4',mp4:'video/mp4',wav:'audio/wav',aac:'audio/aac',ogg:'audio/ogg',flac:'audio/flac',webm:'audio/webm',pdf:'application/pdf',opus:'audio/ogg',amr:'audio/amr'};
function mimeOf(f){const ext=(f.name.split('.').pop()||'').toLowerCase();return MIME[ext]||f.type||'application/octet-stream'}
async function mediaPart(file,signal,onStatus){
  const mime=mimeOf(file);
  if(file.size<=18*1024*1024) return {inline_data:{mime_type:mime,data:await blobToBase64(file)}};
  onStatus&&onStatus('Uploading large file to Gemini…');
  const key=geminiKey();
  let start;
  try{
    start=await fetch(`${API}/upload/v1beta/files`,{method:'POST',signal,headers:{'x-goog-api-key':key,'X-Goog-Upload-Protocol':'resumable','X-Goog-Upload-Command':'start','X-Goog-Upload-Header-Content-Length':String(file.size),'X-Goog-Upload-Header-Content-Type':mime,'Content-Type':'application/json'},body:JSON.stringify({file:{display_name:file.name}})});
  }catch(e){if(e.name==='AbortError')throw e;throw {code:'upload',message:'Large-file upload was blocked. Please compress the file under 18 MB (e.g. mono MP3 at 48 kbps) and try again.'}}
  const url=start.headers.get('x-goog-upload-url');
  if(!start.ok||!url) throw {code:'upload',message:'Large-file upload did not start. Please compress the file under 18 MB and try again.'};
  const up=await fetch(url,{method:'POST',signal,headers:{'X-Goog-Upload-Offset':'0','X-Goog-Upload-Command':'upload, finalize'},body:file});
  const info=await up.json().catch(()=>({}));let f=info.file;
  if(!f) throw {code:'upload',message:'Upload failed. Compress the file under 18 MB and try again.'};
  let tries=0;
  while(f.state==='PROCESSING'&&tries++<100){onStatus&&onStatus('Gemini is processing the file…');await sleep(4000);
    const g=await fetch(`${API}/v1beta/${f.name}`,{headers:{'x-goog-api-key':key},signal});f=await g.json()}
  if(f.state!=='ACTIVE') throw {code:'upload',message:'Gemini could not process this file.'};
  return {file_data:{mime_type:f.mimeType||mime,file_uri:f.uri}};
}

/* ---------- sources ---------- */
let sources=[], found=[], findCtl=null;
function newSource(kind,extra){return {id:uidGen(),kind,title:'',master:state.settings.masters[0]?.id||'',citeFmt:kind==='audio'?'title':kind==='paste'?'title':'pg',include:true,status:'',...extra}}
$('#addBooks').addEventListener('change',async e=>{
  for(const f of [...e.target.files]){
    const s=newSource('book',{file:f,title:f.name.replace(/\.\w+$/,'').replace(/[_]+/g,' ').trim()});
    sources.push(s);
    if(/\.pdf$/i.test(f.name)||f.type==='application/pdf'){
      s.status='Reading PDF…';renderSources();
      try{
        pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        s.pdf=await pdfjsLib.getDocument({data:await f.arrayBuffer()}).promise;s.numPages=s.pdf.numPages;s.from=1;s.to=Math.min(s.numPages,150);s.offset=0;
        s.status=`${s.numPages} pages. ${s.numPages>150?'Big book: do it in parts of about 150 pages.':''}`;
      }catch(err){s.status='This PDF could not be opened.';s.include=false}
    }else{s.text=(await f.text()).trim();s.status=`${s.text.length.toLocaleString()} characters.`;s.citeFmt='title'}
  }
  e.target.value='';renderSources();
});
$('#addAudio').addEventListener('change',async e=>{
  for(const f of [...e.target.files]){
    if(/\.(srt|vtt)$/i.test(f.name)){
      let t=await f.text();
      t=t.replace(/^WEBVTT.*$/m,'').replace(/^\d+\s*$/gm,'').replace(/^([\d:]+)[.,]\d+\s*-->.*$/gm,(m,a)=>'['+a.replace(/^00:/,'')+']').replace(/<[^>]+>/g,'').replace(/\n{2,}/g,'\n').trim();
      sources.push(newSource('audio',{title:f.name.replace(/\.\w+$/,'').replace(/[_]+/g,' ').trim(),transcript:t,status:'Captions loaded.'}));
    }else sources.push(newSource('audio',{file:f,title:f.name.replace(/\.\w+$/,'').replace(/[_]+/g,' ').trim(),status:`${(f.size/1048576).toFixed(1)} MB audio. It will be transcribed first.`}));
  }
  e.target.value='';renderSources();
});
$('#addPhotos').addEventListener('change',e=>{
  const files=[...e.target.files];if(!files.length)return;
  sources.push(newSource('photos',{images:files,status:`${files.length} page photo${files.length===1?'':'s'}.`}));
  e.target.value='';renderSources();
});
$('#addPaste').addEventListener('click',()=>{sources.push(newSource('paste',{text:''}));renderSources()});
const KIND_LABEL={book:'Book',audio:'Audio talk',photos:'Page photos',paste:'Pasted text'};
function renderSources(){
  const mo=masterOptions();
  $('#srcList').innerHTML=sources.map(s=>`<div class="src" data-sid="${s.id}">
    <div class="top"><label class="check" style="margin:0"><input type="checkbox" data-f="include" ${s.include?'checked':''}> <span class="kind">${KIND_LABEL[s.kind]}${s.file?': '+esc(s.file.name):''}</span></label>
      <button class="btn small" data-act="remove">Remove</button></div>
    <label class="f"><span>Title in citation (for KCV volumes write e.g. Vol IX)</span><input data-f="title" value="${esc(s.title)}"></label>
    <div class="row">
      <label class="f"><span>Master</span><select data-f="master">${mo}</select></label>
      <label class="f"><span>Citation</span><select data-f="citeFmt">
        <option value="pg">(Title - pg N)</option><option value="title">(Title)</option>${s.kind==='audio'?'<option value="time">(Title - mm:ss)</option>':''}</select></label>
    </div>
    ${s.pdf?`<div class="row3">
      <label class="f"><span>From PDF page</span><input type="number" min="1" max="${s.numPages}" data-f="from" value="${s.from}"></label>
      <label class="f"><span>To PDF page</span><input type="number" min="1" max="${s.numPages}" data-f="to" value="${s.to}"></label>
      <label class="f"><span>Page offset</span><input type="number" data-f="offset" value="${s.offset}"></label></div>
      <p class="hint">Printed page = PDF page + offset. If PDF page 15 shows "1", the offset is −14.</p>`:''}
    ${s.kind==='paste'?`<label class="f"><span>Text</span><textarea data-f="text" rows="5" placeholder="Paste a chapter or a transcript…">${esc(s.text)}</textarea></label>`:''}
    ${s.kind==='audio'?`<div class="under" style="margin:0 0 8px">${s.file?`<button class="btn small" data-act="transcribe">${s.transcript?'Transcribe again':'Transcribe now'}</button>`:''}${s.transcript?'<button class="btn small" data-act="savetx">Save transcript (.txt)</button>':''}</div>
      ${s.transcript!=null?`<label class="f"><span>Transcript (you can correct it)</span><textarea data-f="transcript" rows="6">${esc(s.transcript)}</textarea></label>`:''}`:''}
    <p class="status" style="margin:0">${esc(s.status||'')}</p></div>`).join('')||'<p class="status">No sources yet.</p>';
  sources.forEach(s=>{const el=document.querySelector(`[data-sid="${s.id}"]`);el.querySelector('[data-f="master"]').value=s.master;el.querySelector('[data-f="citeFmt"]').value=s.citeFmt});
}
$('#srcList').addEventListener('input',e=>{
  const box=e.target.closest('[data-sid]');if(!box)return;const s=sources.find(x=>x.id===box.dataset.sid);const f=e.target.dataset.f;if(!f)return;
  s[f]=e.target.type==='checkbox'?e.target.checked:e.target.type==='number'?Number(e.target.value):e.target.value;
});
$('#srcList').addEventListener('change',e=>{
  const box=e.target.closest('[data-sid]');if(!box)return;const s=sources.find(x=>x.id===box.dataset.sid);const f=e.target.dataset.f;if(!f)return;
  s[f]=e.target.type==='checkbox'?e.target.checked:e.target.type==='number'?Number(e.target.value):e.target.value;
});
$('#srcList').addEventListener('click',async e=>{
  const b=e.target.closest('[data-act]');if(!b)return;const s=sources.find(x=>x.id===b.closest('[data-sid]').dataset.sid);
  if(b.dataset.act==='remove'){sources=sources.filter(x=>x!==s);renderSources()}
  if(b.dataset.act==='savetx'){saveBlob(new Blob([s.transcript],{type:'text/plain'}),(s.title||'transcript')+'.txt')}
  if(b.dataset.act==='transcribe'){findCtl=new AbortController();setBusy(true);try{await transcribe(s,findCtl.signal)}catch(err){s.status=errMsg(err);renderSources()}finally{setBusy(false)}}
});
async function pdfText(s){
  const from=Math.max(1,s.from||1),to=Math.min(s.numPages,s.to||from),off=Number(s.offset)||0;
  let out='';
  for(let i=from;i<=to;i++){const pg=await s.pdf.getPage(i);const tc=await pg.getTextContent();
    let txt='';for(const it of tc.items){txt+=it.str;if(it.hasEOL)txt+='\n'}
    out+=`\n[[Page ${i+off}]]\n`+txt.replace(/[ \t]+/g,' ')}
  return out;
}
const norm=s=>String(s).replace(/\[\[Page -?\d+\]\]/g,' ').replace(/\[\d{1,2}:\d{2}(:\d{2})?\]/g,' ').replace(/(\w)-\s*\n\s*(\w)/g,'$1$2').replace(/[\u2018\u2019\u02BC]/g,"'").replace(/[\u201C\u201D]/g,'"').replace(/[\u2013\u2014]/g,'-').replace(/\u00AD/g,'').replace(/\s+/g,' ').trim().toLowerCase();
function makeCite(s,x){
  const t=(s.title||'').trim();
  if(s.citeFmt==='pg'&&x.page!=null&&x.page!=='') return `(${t||'Source'} - pg ${x.page})`;
  if(s.citeFmt==='time'&&x.time) return `(${t||'Talk'} - ${x.time})`;
  return t?`(${t})`:'';
}
function quotePrompt(s,n,theme,hasText){
  const who=masterName(s.master)||'the master';
  return `You are helping a Pranahuti Yoga volunteer choose daily reflection quotes from the ${s.kind==='audio'?'talk':'writings'} of ${who}${s.title?` ("${s.title}")`:''}.

Pick up to ${n} passages that stand on their own as a daily thought: 1 to 3 consecutive sentences, ideally 12-45 words, clear without the surrounding context${theme?`, related to: ${theme}`:''}. Prefer passages with practical or inspiring meaning for a meditator. Skip anything spoken by a questioner.

Strict rules:
- Copy each passage EXACTLY as written: same words, spelling (keep British spellings), capitalisation and punctuation. Never paraphrase, shorten inside a sentence, merge text from different places, fix grammar or add words.
- Start at the beginning of a sentence and end at the end of a sentence.
- Do not include headings, footnotes, page markers or timestamps inside the passage.
${hasText?'- The text contains page markers like [[Page 162]]; give the page where the passage begins, or null.':'- Read the printed page number on the page if visible; otherwise null.'}
${s.kind==='audio'?'- Paragraphs start with timestamps like [12:34]; give the timestamp of the paragraph where the passage begins as "time".':''}

Reply with only a JSON array, for example:
[{"text":"A happy disposition is a state which percolates its effect upon the lower layers and purifies them.","page":162${s.kind==='audio'?',"time":"12:34"':''}}]`;
}
/* ---------- multi-provider AI (Gemini + free backups) ---------- */
const PROVIDERS={
  gemini:{label:'Google Gemini',maxChars:110000,gap:5000,vision:true},
  mistral:{label:'Mistral',url:'https://api.mistral.ai/v1',model:'mistral-small-latest',maxChars:70000,gap:1500,vision:true,keyUrl:'console.mistral.ai',pick:[/^mistral-small-latest$/,/^mistral-medium-latest$/,/^mistral-small/,/^mistral-large-latest$/]},
  cerebras:{label:'Cerebras',url:'https://api.cerebras.ai/v1',model:'',maxChars:16000,gap:4000,keyUrl:'cloud.cerebras.ai',pick:[/gpt-oss-120b/,/llama-3\.3-70b/,/qwen-3-235b/,/llama/,/qwen/]},
  groq:{label:'Groq',url:'https://api.groq.com/openai/v1',model:'llama-3.3-70b-versatile',maxChars:11000,gap:12000,keyUrl:'console.groq.com',pick:[/^llama-3\.3-70b-versatile$/,/gpt-oss-120b/,/llama-4-scout/,/llama/]},
  openrouter:{label:'OpenRouter',url:'https://openrouter.ai/api/v1',model:'',maxChars:40000,gap:5000,keyUrl:'openrouter.ai/keys',pick:[/llama-3\.3-70b.*:free$/,/gpt-oss-120b:free$/,/deepseek.*:free$/,/:free$/]}
};
const BACKUPS=['mistral','cerebras','groq','openrouter'];
const cooled={}; // pid -> time until which it is skipped
function pKey(pid){if(pid==='gemini')return geminiKey();try{return localStorage.getItem('sqc-key-'+pid)||''}catch(e){return ''}}
function pModel(pid){if(pid==='gemini')return geminiModel();const m=(state.settings.ai.models||{})[pid];return m||PROVIDERS[pid].model}
function availableProviders(needVision){return ['gemini',...BACKUPS].filter(p=>pKey(p)&&(!needVision||PROVIDERS[p].vision))}
function nextProvider(needVision){const now=Date.now();return availableProviders(needVision).find(p=>!(cooled[p]>now))||null}
async function oaiChat(pid,prompt,{json,signal,images}){
  const P=PROVIDERS[pid];let model=pModel(pid);
  if(!model){model=await autoModel(pid);if(!model)throw {code:404,message:'no model found'}}
  const content=images&&images.length?[{type:'text',text:prompt},...images.map(u=>({type:'image_url',image_url:{url:u}}))]:prompt;
  const body={model,messages:[{role:'user',content}],temperature:0.2};
  if(json&&pid==='mistral') body.response_format={type:'json_object'};
  const headers={'Content-Type':'application/json','Authorization':'Bearer '+pKey(pid)};
  if(pid==='openrouter'){headers['HTTP-Referer']=location.origin;headers['X-Title']='Daily Quote Cards'}
  const r=await fetch(P.url+'/chat/completions',{method:'POST',signal,headers,body:JSON.stringify(body)});
  const d=await r.json().catch(()=>({}));
  if(!r.ok){const msg=(d.error&&(d.error.message||d.error))||d.message||r.statusText;throw {code:r.status,message:typeof msg==='string'?msg:JSON.stringify(msg),retryAfter:+(r.headers.get('retry-after')||0)}}
  const text=d.choices&&d.choices[0]&&d.choices[0].message&&d.choices[0].message.content;
  if(!text) throw {code:'empty',message:'no answer'};
  return Array.isArray(text)?text.map(x=>x.text||'').join(''):text;
}
async function listOaiModels(pid){
  const r=await fetch(PROVIDERS[pid].url+'/models',{headers:{'Authorization':'Bearer '+pKey(pid)}});const d=await r.json().catch(()=>({}));
  if(!r.ok) throw {code:r.status,message:(d.error&&(d.error.message||d.error))||d.message||r.statusText};
  return (d.data||[]).map(m=>m.id);
}
async function autoModel(pid){
  const ids=await listOaiModels(pid);const P=PROVIDERS[pid];let m='';
  for(const re of P.pick){m=ids.find(i=>re.test(i));if(m)break}
  m=m||ids[0]||'';if(m){state.settings.ai.models=state.settings.ai.models||{};state.settings.ai.models[pid]=m;scheduleSave()}
  return m;
}
/* One request to one provider, with a short wait-and-retry on speed limits. */
async function callProvider(pid,prompt,opts){
  const ctl=new AbortController();const outer=opts.signal;const onAbort=()=>ctl.abort();if(outer){if(outer.aborted)ctl.abort();else outer.addEventListener('abort',onAbort)}
  const timer=setTimeout(()=>ctl.abort(),150000);
  try{return await callProviderInner(pid,prompt,{...opts,signal:ctl.signal})}
  catch(e){if(e&&e.name==='AbortError'&&!(outer&&outer.aborted))throw {code:'timeout',message:'the AI took too long to answer'};throw e}
  finally{clearTimeout(timer);if(outer)outer.removeEventListener('abort',onAbort)}
}
async function callProviderInner(pid,prompt,{json,signal,images,parts,onStatus}){
  const maxTry=pid==='mistral'?5:2;
  for(let attempt=0;attempt<maxTry;attempt++){
    try{
      if(pid==='gemini'){
        const gp=[...(parts||[]),...(images||[]).map(u=>({inline_data:{mime_type:u.slice(5,u.indexOf(';')),data:u.split(',')[1]}})),{text:prompt}];
        return await gemini(gp,{json,signal,onStatus});
      }
      return await oaiChat(pid,prompt,{json,signal,images});
    }catch(e){
      if(e&&e.name==='AbortError') throw e;
      const daily=/per day|PerDay|daily|quota/i.test((e&&e.message)||'');
      if(e&&e.code===400&&/validate JSON|failed_generation|json/i.test(e.message||'')&&attempt===0){json=false;continue}
      if(e&&e.code===429&&!daily&&attempt<maxTry-1){const w=Math.min(65,e.retryAfter||(pid==='mistral'?[4,8,15,25][attempt]:30));onStatus&&onStatus(`${PROVIDERS[pid].label} speed limit — waiting ${w}s…`);await sleep(w*1000);continue}
      throw e;
    }
  }
}
function coolDown(pid,e){
  const daily=/per day|PerDay|daily|quota|exhausted/i.test((e&&e.message)||'');
  const temporary=e&&([500,502,503,504,'timeout','empty',0].includes(e.code)||e.name==='TypeError');
  cooled[pid]=Date.now()+(e&&(e.code===401||e.code===403)?864e5:daily?6*3600e3:temporary?20e3:120e3);
}
function providerError(pid,e){return `${PROVIDERS[pid].label}: ${errMsg(e).replace(/^Gemini /,'')}`}
/* Ask the next working provider; on limits, move on to the next one. */
async function askAny(prompt,{json,signal,images,parts,onStatus,needVision,maxLen}){
  const tried=[];
  for(;;){
    const pid=nextProvider(needVision);
    if(!pid){const e=new Error(tried.length?tried.join(' · '):'Add a free AI key in Setup first.');e.code='allfailed';throw e}
    if(maxLen&&maxLen>PROVIDERS[pid].maxChars) return {resize:pid};
    onStatus&&onStatus(`Asking ${PROVIDERS[pid].label}…`);
    try{const text=await callProvider(pid,prompt,{json,signal,images,parts,onStatus});return {text,pid}}
    catch(e){if(e&&e.name==='AbortError')throw e;tried.push(providerError(pid,e));coolDown(pid,e)}
  }
}

/* ---------- audio ---------- */
async function groqTranscribe(file,signal){
  const fd=new FormData();fd.append('file',file,file.name);fd.append('model',(state.settings.ai.models||{}).groqWhisper||'whisper-large-v3-turbo');fd.append('response_format','verbose_json');fd.append('temperature','0');
  const r=await fetch(PROVIDERS.groq.url+'/audio/transcriptions',{method:'POST',signal,headers:{'Authorization':'Bearer '+pKey('groq')},body:fd});
  const d=await r.json().catch(()=>({}));
  if(!r.ok) throw {code:r.status,message:(d.error&&d.error.message)||r.statusText};
  const segs=d.segments||[];if(!segs.length) return (d.text||'').trim();
  const ts=s=>{const m=Math.floor(s/60),x=Math.floor(s%60);return `[${m}:${String(x).padStart(2,'0')}]`};
  let out='',para='',start=0;
  segs.forEach((g,i)=>{if(!para)start=g.start;para+=(para?' ':'')+g.text.trim();
    if(g.end-start>40&&/[.?!]$/.test(para)||i===segs.length-1){out+=`${ts(start)} ${para}\n\n`;para=''}});
  return out.trim();
}
async function transcribe(s,signal){
  s.status='Transcribing… a long talk can take a few minutes.';renderSources();
  let text='',errs=[];
  if(pKey('groq')&&s.file.size<=25*1024*1024&&!(cooled.groq>Date.now())){
    try{s.status='Transcribing with Groq Whisper (free)…';renderSources();text=await groqTranscribe(s.file,signal)}
    catch(e){if(e&&e.name==='AbortError')throw e;errs.push(providerError('groq',e));coolDown('groq',e)}
  }
  if(!text&&pKey('gemini')){
    try{
      const part=await mediaPart(s.file,signal,t=>{s.status=t;renderSources()});
      s.status='Transcribing with Gemini…';renderSources();
      text=await gemini([part,{text:`Transcribe this recorded spiritual talk word for word.
- Keep the speaker's exact words: do not summarise, shorten, correct grammar or polish.
- Write Sanskrit, Hindi or Telugu terms in Roman letters as spoken.
- Start each paragraph with a timestamp like [12:34].
- If more than one person speaks, start their paragraph with their role, e.g. "Questioner:".
- Output plain text only.`}],{signal,maxTokens:60000,onStatus:t=>{s.status=t;renderSources()}});
    }catch(e){if(e&&e.name==='AbortError')throw e;errs.push(providerError('gemini',e));coolDown('gemini',e)}
  }
  if(!text){const e=new Error(errs.length?errs.join(' · '):'Add a Groq or Gemini key in Setup to transcribe audio.');e.code='allfailed';throw e}
  s.transcript=text.trim();s.status=`Transcribed: about ${s.transcript.split(/\s+/).length.toLocaleString()} words. Check names and terms, then Find quotes.`;
  renderSources();
}

/* ---------- finding quotes, in parts ---------- */
async function sourcePages(s){
  if(s.kind==='book'&&s.pdf){
    const from=Math.max(1,s.from||1),to=Math.min(s.numPages,s.to||from),off=Number(s.offset)||0,out=[];
    for(let i=from;i<=to;i++){const pg=await s.pdf.getPage(i);const tc=await pg.getTextContent();let t='';for(const it of tc.items){t+=it.str;if(it.hasEOL)t+='\n'}
      out.push({mark:`[[Page ${i+off}]]`,text:t.replace(/[ \t]+/g,' ')})}
    return out;
  }
  const text=(s.kind==='audio'?s.transcript:s.text)||'';
  const paras=[];
  for(const para of text.split(/\n{2,}|\n(?=\[\d{1,2}:\d{2})/)){
    if(para.length<=3000){paras.push(para);continue}
    let piece='';for(const sen of para.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g)||[para]){if((piece+sen).length>3000&&piece){paras.push(piece.trim());piece=''}piece+=sen}
    if(piece.trim())paras.push(piece.trim());
  }
  const out=[];let cur='';
  for(const p of paras){if((cur+p).length>3000&&cur){out.push({mark:'',text:cur});cur=''}cur+=(cur?'\n\n':'')+p}
  if(cur)out.push({mark:'',text:cur});
  return out;
}
function toResults(s,arr,chunkText){
  if(!Array.isArray(arr)) arr=(arr&&(arr.quotes||arr.items||arr.passages))||[];
  const hay=chunkText!=null?norm(chunkText):null;
  return arr.filter(x=>x&&typeof x.text==='string'&&x.text.trim()).map(x=>{
    const t=x.text.trim();const verified=hay?hay.includes(norm(t)):null;
    return {id:uidGen(),src:s.title||KIND_LABEL[s.kind],master:s.master,text:t,cite:makeCite(s,x),verified,pick:verified!==false};
  });
}
const JSON_NOTE='\n\nIf you must reply with a JSON object instead of an array, use {"quotes":[...]}.';
async function quotesFrom(s,n,theme,signal){
  const say=t=>{s.status=t;renderSources()};
  if(s.kind==='audio'&&!s.transcript){if(!s.file)throw {code:'empty',message:'no audio'};await transcribe(s,signal)}
  // page photos
  if(s.kind==='photos'){
    const imgs=[];for(const f of s.images) imgs.push(await new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(fr.result);fr.readAsDataURL(f)}));
    const {text,pid}=await askAny(quotePrompt(s,n,theme,false)+JSON_NOTE+'\n\nSOURCE: the attached page photos.',{json:true,signal,images:imgs,needVision:true,onStatus:say});
    const res=toResults(s,parseJSON(text),null);say(`${res.length} found with ${PROVIDERS[pid].label} — check them against the book.`);return res;
  }
  const pages=await sourcePages(s);
  const total=pages.reduce((a,p)=>a+p.text.length,0);
  if(s.kind==='book'&&s.pdf&&norm(pages.map(p=>p.text).join(' ')).length<300){ // scanned book
    say('No text layer (scanned). Sending the PDF to Gemini to read…');
    if(!pKey('gemini')) throw new Error('This PDF is a scan. Scanned books need a Gemini key, or use "Add page photos" with a Mistral key.');
    const part=await mediaPart(s.file,signal,say);
    const raw=await gemini([part,{text:quotePrompt(s,n,theme,false)+'\n\nSOURCE: the attached file.'}],{json:true,signal,onStatus:say});
    return toResults(s,parseJSON(raw),null);
  }
  if(!total) throw {code:'empty',message:'source is empty'};
  const all=[];let i=0,part=0;const used=new Set();
  while(i<pages.length){
    const pid=nextProvider(false);
    if(!pid){const e=new Error(`All AI keys are resting after hitting free limits. ${all.length} quotes found so far. Try again later, or add another free key in Setup.`);e.code='allfailed';if(all.length){say(e.message);break}throw e}
    const budget=PROVIDERS[pid].maxChars;let chunk='',j=i;
    while(j<pages.length&&(chunk.length+pages[j].text.length<budget||!chunk)){chunk+=(pages[j].mark?'\n'+pages[j].mark+'\n':'\n\n')+pages[j].text;j++}
    if(chunk.length>budget) chunk=chunk.slice(0,budget);
    const want=Math.max(2,Math.ceil(n*chunk.length/total)+1);
    part++;const left=Math.ceil((total-pages.slice(0,i).reduce((a,p)=>a+p.text.length,0))/budget);
    say(`Part ${part}${left>1?` (about ${left} to go)`:''} · ${PROVIDERS[pid].label}…`);
    const prompt=quotePrompt(s,want,theme,!!chunk.match(/\[\[Page/))+JSON_NOTE+`\n\nSOURCE:\n${chunk}`;
    let got;
    try{got=await askAny(prompt,{json:true,signal,onStatus:say,maxLen:chunk.length})}
    catch(e){if(e&&e.name==='AbortError')throw e;if(all.length){say(`Stopped early: ${e.message}. ${all.length} quotes found so far.`);break}throw e}
    if(got.resize) continue; // a smaller provider is next — re-cut this part to fit it
    for(const r of toResults(s,parseJSON(got.text),chunk)){const k=norm(r.text);if(!used.has(k)){used.add(k);all.push(r)}}
    i=j;
    if(i<pages.length) await sleep(PROVIDERS[got.pid].gap);
  }
  all.sort((a,b)=>(b.verified===true)-(a.verified===true));
  const res=all.slice(0,Math.max(n,Math.min(all.length,n)));
  if(!/Stopped early|resting/.test(s.status)) say(`${res.length} found, ${res.filter(r=>r.verified).length} match word for word.`);
  return res;
}

function setBusy(b){$('#findBtn').disabled=b;$('#stopBtn').hidden=!b}
$('#findBtn').addEventListener('click',async()=>{
  const list=sources.filter(s=>s.include);
  if(!list.length){$('#findStatus').textContent='Add a book, audio talk, page photos or text first.';return}
  if(!availableProviders(false).length){$('#findStatus').textContent='Add a free AI key in Setup first (Gemini, Mistral, Groq…).';showTab('setup');$('#aiKey').focus();return}
  const n=Math.max(1,Math.min(40,+$('#howMany').value||10)),theme=$('#srcTheme').value.trim();
  findCtl=new AbortController();setBusy(true);
  for(let i=0;i<list.length;i++){
    const s=list[i];$('#findStatus').textContent=`Source ${i+1} of ${list.length}…`;
    try{found.push(...await quotesFrom(s,n,theme,findCtl.signal));renderFound()}
    catch(err){s.status=errMsg(err);renderSources();if(err&&err.name==='AbortError')break}
  }
  setBusy(false);findCtl=null;
  $('#findStatus').textContent=found.length?`${found.length} quotes to review below.`:'No quotes found yet.';
});
$('#stopBtn').addEventListener('click',()=>findCtl&&findCtl.abort());
function renderFound(){
  const groups={};found.forEach(f=>{(groups[f.src]=groups[f.src]||[]).push(f)});
  $('#findResults').innerHTML=Object.entries(groups).map(([g,items])=>`<h3 class="group-title">${esc(g)}</h3>`+items.map(f=>`<div class="item">
    ${f.verified===true?'<span class="badge ok">Matches source word for word</span>':f.verified===false?'<span class="badge warn">Not found word for word — check against the book</span>':'<span class="badge warn">Read from scan or photo — check against the book</span>'}
    <label class="check" style="align-items:flex-start"><input type="checkbox" data-pick="${f.id}" ${f.pick?'checked':''} style="margin-top:4px"><span>${esc(f.text)}</span></label>
    <input data-cite="${f.id}" value="${esc(f.cite)}" aria-label="Citation"></div>`).join('')).join('');
  $('#addFoundBtn').hidden=!found.length;
}
$('#findResults').addEventListener('change',e=>{const p=e.target.closest('[data-pick]');if(p){found.find(x=>x.id===p.dataset.pick).pick=p.checked}});
$('#findResults').addEventListener('input',e=>{const c=e.target.closest('[data-cite]');if(c){found.find(x=>x.id===c.dataset.cite).cite=c.value}});
$('#addFoundBtn').addEventListener('click',()=>{
  const pick=found.filter(f=>f.pick);if(!pick.length){alert('Tick at least one quote.');return}
  const have=new Set(state.library.map(q=>q.text));let n=0;
  for(const f of pick){if(have.has(f.text))continue;state.library.push({id:uidGen(),text:f.text,cite:f.cite,master:f.master});n++}
  scheduleSave();found=found.filter(f=>!f.pick);renderFound();
  $('#findStatus').textContent=`Added ${n} quote${n===1?'':'s'} to the library.`;
});

/* ---------- setup ---------- */
function renderSetup(){
  $('#periodList').innerHTML=state.settings.periods.map(p=>`<div class="prow">
    <input value="${esc(p.name)}" data-pname="${p.id}" aria-label="Period name" placeholder="Name">
    <input type="date" value="${esc(p.start)}" data-pstart="${p.id}" aria-label="Start date">
    <button class="btn small" data-pdel="${p.id}">Remove</button></div>`).join('')||'<p class="status">No periods yet.</p>';
  $('#masterList').innerHTML=state.settings.masters.map(m=>{
    const def=defaultPhotoOf(m);
    return `<div class="item">
    <div class="row"><label class="f" style="margin:0"><span>Name in lists</span><input value="${esc(m.name)}" data-mname="${m.id}"></label>
    <label class="f" style="margin:0"><span>Name on card</span><input value="${esc(m.sign||'')}" data-msign="${m.id}"></label></div>
    <label class="f" style="margin:8px 0 0"><span>Caption ending (after the quote)</span><input value="${esc(m.caption||'')}" data-mcap="${m.id}" placeholder="~ ${esc(m.name)}"></label>
    <div class="gal">${m.photos.filter(id=>photos[id]).map(id=>`<figure class="${id===def?'def':''}"><img src="${photos[id]}" alt=""><div>
      <button data-mdef="${m.id}|${id}" aria-label="Make default">${id===def?'Default':'★'}</button><button data-mrm="${m.id}|${id}" aria-label="Remove photo">✕</button></div></figure>`).join('')}
      <label class="addph">+ Add photos<input type="file" accept="image/*" multiple class="visually-hidden" data-madd="${m.id}"></label></div>
    ${['babuji','kcv','kcn'].includes(m.id)?'':`<button class="btn small" data-mdel="${m.id}" style="margin-top:8px">Remove person</button>`}</div>`}).join('');
  $('#siteText').value=state.settings.site;
  $('#igExtra').value=state.settings.igExtra||'';
  $('#calMode').value=state.settings.calendar||'lalaji';$('#periodBox').hidden=$('#calMode').value!=='custom';$('#calHint').hidden=!$('#periodBox').hidden;
  {const t=lalajiFor(todayStr());$('#calToday').textContent=`${t.name} ${t.n}, year ${t.year} of the Lalaji Era`;}
  const mo=`<option value="any">Any master</option>`+masterOptions();
  $('#slotList').innerHTML=slots().map(s=>`<div class="item"><div class="row3">
    <label class="f" style="margin:0"><span>Name</span><input value="${esc(s.label)}" data-slabel="${s.id}"></label>
    <label class="f" style="margin:0"><span>Time</span><input type="time" value="${esc(s.time)}" data-stime="${s.id}"></label>
    <label class="f" style="margin:0"><span>Master</span><select data-smaster="${s.id}">${mo}</select></label></div>
    <p class="hint" style="margin:6px 0 0">Look: ${esc((s.style&&s.style.layout)||'classic')}, ${esc((s.style&&FORMATS[s.style.format]||FORMATS.landscape).label)}. To change it, design a card for this post and press "Use this look for new cards".</p>
    ${slots().length>1?`<button class="btn small" data-sdel="${s.id}" style="margin-top:6px">Remove post time</button>`:''}</div>`).join('');
  slots().forEach(s=>{const el=document.querySelector(`[data-smaster="${s.id}"]`);if(el)el.value=s.master||'any'});
  $('#aiKey').value=geminiKey();$('#aiModel').value=geminiModel();
  $('#backupKeys').innerHTML=BACKUPS.map(pid=>{const P=PROVIDERS[pid];return `<div class="item"><div class="row">
    <label class="f" style="margin:0"><span>${P.label} key — free at ${P.keyUrl}</span><input type="password" autocomplete="off" spellcheck="false" data-bkey="${pid}" value="${esc(pKey(pid))}"></label>
    <label class="f" style="margin:0"><span>Model (blank = automatic)</span><input spellcheck="false" data-bmodel="${pid}" value="${esc((state.settings.ai.models||{})[pid]||'')}" placeholder="${esc(P.model||'automatic')}"></label></div>
    <div class="under" style="margin:6px 0 0"><button class="btn small" data-btest="${pid}">Check</button><span class="status" data-bstat="${pid}"></span></div></div>`}).join('');
}
$('#pane-setup').addEventListener('input',e=>{
  const t=e.target,ds=t.dataset;
  if(ds.pname){state.settings.periods.find(p=>p.id===ds.pname).name=t.value}
  else if(ds.pstart){state.settings.periods.find(p=>p.id===ds.pstart).start=t.value}
  else if(ds.mname){state.settings.masters.find(m=>m.id===ds.mname).name=t.value;fillSelects()}
  else if(ds.msign){state.settings.masters.find(m=>m.id===ds.msign).sign=t.value}
  else if(t.id==='siteText'){state.settings.site=t.value}
  else if(ds.mcap){state.settings.masters.find(m=>m.id===ds.mcap).caption=t.value}
  else if(t.id==='igExtra'){state.settings.igExtra=t.value}
  else if(ds.slabel){slotOf(ds.slabel).label=t.value;fillSelects()}
  else if(ds.stime){slotOf(ds.stime).time=t.value;fillSelects()}
  else if(ds.smaster){slotOf(ds.smaster).master=t.value}
  else if(t.id==='aiKey'){try{localStorage.setItem(KEY_STORE,t.value.trim())}catch(err){window.__key=t.value.trim()};secretsPush();return}
  else if(t.id==='aiModel'){state.settings.ai.model=t.value.trim()||DEFAULT_MODEL}
  else if(ds.bkey){try{localStorage.setItem('sqc-key-'+ds.bkey,t.value.trim())}catch(err){};delete cooled[ds.bkey];secretsPush();return}
  else if(ds.bmodel){state.settings.ai.models=state.settings.ai.models||{};state.settings.ai.models[ds.bmodel]=t.value.trim()}
  else return;
  scheduleSave();cardChanged();
});
$('#pane-setup').addEventListener('change',async e=>{
  if(e.target.dataset.smaster){slotOf(e.target.dataset.smaster).master=e.target.value;scheduleSave();return}
  const id=e.target.dataset.madd;if(!id)return;const m=state.settings.masters.find(x=>x.id===id);
  for(const f of [...e.target.files]){try{const pid=await fileToPhoto(f);m.photos.push(pid);if(!m.photo)m.photo=pid}catch(err){alert('One image could not be read. Try JPG or PNG.')}}
  scheduleSave();renderSetup();renderPhotoStrip();cardChanged();
});
$('#pane-setup').addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b)return;const ds=b.dataset;
  if(ds.sdel&&confirm('Remove this post time? Saved cards for it stay in the backup but are hidden.')){state.settings.slots=slots().filter(s=>s.id!==ds.sdel);if(!slotOf(card.slot)||card.slot===ds.sdel)card.slot=slots()[0].id;scheduleSave();renderSetup();fillSelects();renderMonth();renderToday()}
  if(ds.btest){const pid=ds.btest,st=document.querySelector(`[data-bstat="${pid}"]`);if(!pKey(pid)){st.textContent='Paste a key first.';return}
    st.textContent='Checking…';try{if(!(state.settings.ai.models||{})[pid]&&!PROVIDERS[pid].model)await autoModel(pid);const ids=await listOaiModels(pid);const m=pModel(pid);
      if(m&&!ids.includes(m)){const nm=await autoModel(pid);st.textContent=`Key works. ${m} not offered — now using ${nm}.`;renderSetup();return}
      await sleep(1500);
      try{await oaiChat(pid,'Reply with the word OK.',{})}catch(e1){if(e1&&e1.code===429){st.textContent='Busy — trying again in a few seconds…';await sleep(Math.min(20,e1.retryAfter||5)*1000);await oaiChat(pid,'Reply with the word OK.',{})}else throw e1}
      delete cooled[pid];st.textContent=`Key works. Using ${pModel(pid)}.`}catch(err){st.textContent=providerError(pid,err)}}
  if(ds.pdel){state.settings.periods=state.settings.periods.filter(p=>p.id!==ds.pdel);scheduleSave();renderSetup();cardChanged()}
  if(ds.mdef){const[mid,pid]=ds.mdef.split('|');state.settings.masters.find(m=>m.id===mid).photo=pid;scheduleSave();renderSetup();renderPhotoStrip();cardChanged()}
  if(ds.mrm&&confirm('Remove this photo?')){const[mid,pid]=ds.mrm.split('|');const m=state.settings.masters.find(x=>x.id===mid);
    m.photos=m.photos.filter(x=>x!==pid);if(m.photo===pid)m.photo=m.photos[0]||null;
    const usedElsewhere=Object.values(state.plan).some(c=>c.photo===pid)||card.photo===pid;
    if(!usedElsewhere) await deletePhoto(pid);
    scheduleSave();renderSetup();renderPhotoStrip();cardChanged()}
  if(ds.mdel&&confirm('Remove this person?')){state.settings.masters=state.settings.masters.filter(m=>m.id!==ds.mdel);scheduleSave();renderSetup();fillSelects()}
});
$('#addSlotBtn').addEventListener('click',()=>{state.settings.slots.push({id:uidGen(),label:'Morning',time:'07:00',master:'any',style:{}});scheduleSave();renderSetup();fillSelects()});
$('#useLookBtn').addEventListener('click',useLookForSlot);
$('#calMode').addEventListener('change',e=>{state.settings.calendar=e.target.value;scheduleSave();renderSetup();cardChanged();renderMonth();renderToday()});
$('#addPeriodBtn').addEventListener('click',()=>{state.settings.periods.push({id:uidGen(),name:'',start:''});renderSetup();scheduleSave()});
$('#addMasterBtn').addEventListener('click',()=>{state.settings.masters.push({id:uidGen(),name:'New person',sign:'',photo:null,photos:[]});renderSetup();fillSelects();scheduleSave()});
$('#aiTest').addEventListener('click',async()=>{
  const key=geminiKey();const st=$('#aiStatus');if(!key){st.textContent='Paste a key first.';return}
  const btn=$('#aiTest');btn.disabled=true;st.textContent='Checking…';
  try{
    const cur=geminiModel();
    const t=await testModel(key,cur);
    if(t.ok){st.textContent=`Key works. Using ${cur}.`;listModels(key).then(n=>{$('#modelList').innerHTML=rankModels(n).map(x=>`<option value="${esc(x)}">`).join('')}).catch(()=>{})}
    else if(isKeyError(t)) throw {code:t.status,message:t.message};
    else{const m=await autoPickModel(x=>st.textContent=x);st.textContent=`Key works. ${cur} wasn't available, so it now uses ${m}.`}
  }catch(err){st.textContent=errMsg(err)}
  finally{btn.disabled=false}
});
$('#exportBtn').addEventListener('click',()=>{
  saveBlob(new Blob([JSON.stringify({app:'samadristi-studio',state,photos})],{type:'application/json'}),`quote-cards-backup-${todayStr()}.json`);
});
$('#importInput').addEventListener('change',async e=>{
  const f=e.target.files[0];if(!f)return;
  try{const d=JSON.parse(await f.text());if(!d.state||!d.state.settings)throw 0;
    if(!confirm('Replace your current calendar, library and photos with this backup?'))return;
    state=d.state;migrate();
    for(const k of await IDB.keys()) if(String(k).startsWith('photo:')) await IDB.del(k);
    photos={};for(const [id,data] of Object.entries(d.photos||{})) await savePhoto(id,data);
    scheduleSave();card={...DEFAULT_STYLE,...clone(state.settings.draft||card)};refreshAll();
  }catch(err){alert('That file is not a backup from this app.')}
  e.target.value='';
});


/* ---------- media modal (story / reel) ---------- */
let mediaFile=null;
function showMedia(file,kind,title){
  mediaFile=file;const url=URL.createObjectURL(file);
  $('#mediaTitle').textContent=title;
  $('#mediaBox').innerHTML=kind==='video'?`<video src="${url}" controls playsinline autoplay muted loop style="width:100%;max-height:60vh;border-radius:8px;background:#000"></video>`:`<img src="${url}" alt="" style="width:100%;max-height:60vh;object-fit:contain;border-radius:8px">`;
  const canShare=!!(navigator.canShare&&navigator.canShare({files:[file]}));
  $('#mediaShare').hidden=!canShare;
  $('#mediaModal').classList.add('on');
}
$('#mediaClose').addEventListener('click',()=>{$('#mediaModal').classList.remove('on');$('#mediaBox').innerHTML=''});
$('#mediaDownload').addEventListener('click',()=>{if(mediaFile)saveBlob(mediaFile,mediaFile.name)});
$('#mediaShare').addEventListener('click',async()=>{if(!mediaFile)return;try{await navigator.share({files:[mediaFile],text:mediaFile._caption||''})}catch(e){}});
function storyOf(c){return {...DEFAULT_STYLE,...c,format:'story',layout:'modern',dash:'plain',citeStyle:'inline',showName:true,showSite:true,font:c.layout==='modern'?c.font:'dmsans',shape:c.shape==='soft'||c.shape==='rect'?'cutout':c.shape}}
async function storyFile(c){const sc=storyOf(c);const b=await cardBlob(sc);const f=new File([b],fileName(sc),{type:'image/png'});f._caption=captionFor(c,'wa');return f}

/* ---------- Reel video ---------- */
const clamp01=x=>Math.max(0,Math.min(1,x));
function pickVideoType(){
  const types=['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4;codecs=avc1','video/mp4','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'];
  return types.find(t=>window.MediaRecorder&&MediaRecorder.isTypeSupported(t))||'';
}
const REEL_DEFAULTS={showHeader:true,hook:'',music:'calm',volume:.8,audioStart:0,seconds:10,anim:'lines',motion:true,cta:'',textSize:1,safe:true};
function reelOpts(){state.settings.reel={...REEL_DEFAULTS,...(state.settings.reel||{})};return state.settings.reel}
let ownAudio=null; // {name, buf:ArrayBuffer}
IDB.open().then(()=>IDB.get('reelAudio')).then(v=>{if(v&&v.buf)ownAudio=v}).catch(()=>{});

/* ---- music styles, all generated in the browser (copyright-free) ---- */
function envNote(ac,out,{f,type='sine',at,a=.01,peak=.08,decay=2.5,detune=0}){
  const o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.value=f;o.detune.value=detune;
  g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(peak,at+a);g.gain.exponentialRampToValueAtTime(.0004,at+decay);
  o.connect(g);g.connect(out);o.start(at);o.stop(at+decay+.1);
}
function noiseBuf(ac,sec){const b=ac.createBuffer(1,ac.sampleRate*sec,ac.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;return b}
const MUSIC={
  calm:{label:'Calm drone & chimes'},
  bells:{label:'Temple bells'},
  piano:{label:'Soft piano'},
  flute:{label:'Flute & tanpura'},
  ocean:{label:'Ocean & singing bowl'},
  birds:{label:'Morning birds'},
  own:{label:'My own audio file'},
  none:{label:'No music'}
};
function startMusic2(ac,dest,seconds,style){
  const t0=ac.currentTime;
  const master=ac.createGain();master.gain.setValueAtTime(0,t0);master.gain.linearRampToValueAtTime(.32,t0+1.2);
  master.gain.setValueAtTime(.32,t0+seconds-1.6);master.gain.linearRampToValueAtTime(0,t0+seconds);master.connect(dest);
  const lp=ac.createBiquadFilter();lp.type='lowpass';lp.frequency.value=1800;lp.connect(master);
  const delay=ac.createDelay();delay.delayTime.value=.38;const fb=ac.createGain();fb.gain.value=.35;delay.connect(fb);fb.connect(delay);delay.connect(master);
  const drone=(fs,g)=>fs.forEach(([f,type,gg])=>{const o=ac.createOscillator(),gn=ac.createGain();o.type=type;o.frequency.value=f;gn.gain.value=gg*(g||1);o.connect(gn);gn.connect(lp);o.start(t0);o.stop(t0+seconds+.2)});
  if(style==='calm'){
    drone([[130.81,'triangle',.10],[196,'sine',.07],[261.63,'sine',.035]]);
    const n=[523.25,587.33,659.25,783.99,880,1046.5];
    for(let t=.8,i=0;t<seconds-1.2;t+=1.15,i++){envNote(ac,lp,{f:n[(i*3+(i>>1))%n.length],at:t0+t,peak:.07,decay:2.6});envNote(ac,delay,{f:n[(i*3+(i>>1))%n.length],at:t0+t,peak:.03,decay:2.6})}
  }else if(style==='bells'){
    drone([[110,'sine',.06],[164.81,'sine',.04]]);
    const roots=[392,329.63,440,293.66];
    for(let t=.5,i=0;t<seconds-1;t+=2.4,i++){const f=roots[i%roots.length];[[1,.09],[2.0,.05],[2.76,.035],[5.4,.015]].forEach(([m,p])=>{envNote(ac,lp,{f:f*m,at:t0+t,peak:p,decay:4.5});envNote(ac,delay,{f:f*m,at:t0+t,peak:p*.3,decay:4})})}
  }else if(style==='piano'){
    const chords=[[261.63,329.63,392],[220,261.63,329.63],[174.61,220,261.63],[196,246.94,293.66]];
    const beat=60/72;
    for(let t=.3,i=0;t<seconds-1;t+=beat,i++){const ch=chords[Math.floor(i/4)%chords.length];const f=ch[i%3]*(i%4===3?2:1);
      envNote(ac,lp,{f,type:'triangle',at:t0+t,a:.005,peak:.09,decay:1.8});envNote(ac,lp,{f:f*2,type:'sine',at:t0+t,a:.005,peak:.02,decay:1.2});
      if(i%4===0)envNote(ac,lp,{f:ch[0]/2,type:'sine',at:t0+t,a:.01,peak:.07,decay:3.2})}
  }else if(style==='flute'){
    // tanpura: Pa Sa Sa Sa plucks
    const sa=146.83,pat=[sa*1.5,sa*2,sa*2,sa];
    for(let t=0,i=0;t<seconds;t+=.9,i++){const f=pat[i%4];[1,2,3,4,5].forEach(h=>envNote(ac,lp,{f:f*h,type:'sine',at:t0+t,a:.02,peak:.05/h,decay:2.8}))}
    const mel=[587.33,659.25,739.99,880,739.99,659.25,587.33,493.88];
    for(let t=1.4,i=0;t<seconds-1.5;t+=1.3,i++){const o=ac.createOscillator(),g=ac.createGain(),vib=ac.createOscillator(),vg=ac.createGain();
      o.type='sine';o.frequency.value=mel[i%mel.length];vib.frequency.value=5.2;vg.gain.value=6;vib.connect(vg);vg.connect(o.frequency);
      const at=t0+t;g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(.06,at+.25);g.gain.setValueAtTime(.06,at+.9);g.gain.linearRampToValueAtTime(0,at+1.25);
      o.connect(g);g.connect(lp);g.connect(delay);o.start(at);vib.start(at);o.stop(at+1.3);vib.stop(at+1.3)}
  }else if(style==='ocean'){
    const src=ac.createBufferSource();src.buffer=noiseBuf(ac,seconds+1);const bp=ac.createBiquadFilter();bp.type='lowpass';bp.frequency.value=600;
    const g=ac.createGain();g.gain.value=.0;for(let t=0;t<seconds;t+=5){g.gain.linearRampToValueAtTime(.22,t0+t+2.5);g.gain.linearRampToValueAtTime(.05,t0+t+5)}
    src.connect(bp);bp.connect(g);g.connect(master);src.start(t0);src.stop(t0+seconds+.5);
    for(let t=.6;t<seconds-2;t+=4.5){[[220,.08],[221.8,.06],[594,.025]].forEach(([f,p])=>envNote(ac,lp,{f,at:t0+t,a:.05,peak:p,decay:6}))}
  }else if(style==='birds'){
    drone([[196,'sine',.05],[293.66,'sine',.035],[392,'sine',.02]]);
    for(let t=.7;t<seconds-1;t+=.55+Math.random()*1.1){const at=t0+t,n=2+Math.floor(Math.random()*3),base=2200+Math.random()*1600;
      for(let k=0;k<n;k++){const o=ac.createOscillator(),g=ac.createGain(),s=at+k*.12;o.type='sine';o.frequency.setValueAtTime(base,s);o.frequency.exponentialRampToValueAtTime(base*(1.3+Math.random()*.4),s+.08);
        g.gain.setValueAtTime(0,s);g.gain.linearRampToValueAtTime(.03,s+.01);g.gain.exponentialRampToValueAtTime(.0005,s+.1);o.connect(g);g.connect(master);o.start(s);o.stop(s+.12)}}
  }
}
async function startOwnAudio(ac,dest,seconds,o){
  if(!ownAudio)return;
  const buf=await ac.decodeAudioData(ownAudio.buf.slice(0));
  const src=ac.createBufferSource();src.buffer=buf;const g=ac.createGain();const t0=ac.currentTime,vol=Math.max(0,Math.min(1.5,+o.volume||.8));
  g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(vol,t0+.8);g.gain.setValueAtTime(vol,t0+seconds-1.5);g.gain.linearRampToValueAtTime(0,t0+seconds);
  src.connect(g);g.connect(dest);src.start(t0,Math.min(Math.max(0,+o.audioStart||0),Math.max(0,buf.duration-1)));src.stop(t0+seconds+.1);
}

/* ---- video ---- */
async function makeReel(c,{onProgress}={}){
  const o=reelOpts();
  const type=pickVideoType();
  if(!type) throw new Error('This browser cannot record video. Use Chrome or Safari.');
  const seconds=Math.max(6,Math.min(30,+o.seconds||10));
  const W=1080,H=1920,safe=o.safe!==false;
  await ensureFonts(c);
  const src=photoSrc(c);const img=src?await loadImg(src):null;
  const bg=document.createElement('canvas');bg.width=W;bg.height=H;drawBg(bg.getContext('2d'),W,H,c.theme,(c.date||'')+c.theme);
  const top=safe?(o.showHeader?.15:.12):(o.showHeader?.13:.08);
  let layer=null,pw=0,ph=0,px=0,py=0;
  if(img){pw=Math.round(.64*W);ph=Math.round(.32*H);px=(W-pw)/2;py=top*H;layer=document.createElement('canvas');layer.width=pw;layer.height=ph;
    drawPhoto(layer.getContext('2d'),img,0,0,pw,ph,{...c,shape:(c.shape==='oval'?'oval':'soft')},false)}
  const cv=document.createElement('canvas');cv.width=W;cv.height=H;cv.style.cssText='position:fixed;left:-99999px;top:0;width:10px;height:18px';document.body.appendChild(cv);
  const ctx=cv.getContext('2d');
  const family=FONTS[c.font]||FONTS.montserrat;
  const bottomLimit=safe?.70:.80;
  const tyStart=img?py+ph+.04*H:(top+.05)*H;
  const b=fitBlock(ctx,{text:c.text,cite:c.cite,family,size:58*(c.size||1)*(+o.textSize||1),lh:1.5,maxW:.84*W,maxH:bottomLimit*H-tyStart,citeStyle:'small'});
  const ty=img?tyStart:Math.max(tyStart,(bottomLimit*H+tyStart-b.h)/2-.03*H);
  const hd=headerTexts({...c,dash:c.dash==='dash'?'plain':c.dash});
  const m=masterOf(c);const sign=c.showName===false?'':(m?(m.sign||m.name):'');
  const hookT=o.hook&&o.hook.trim()?1.6:0;
  const textStart=hookT+1.1, textWin=Math.max(2.5,seconds*.5-hookT*.5);
  const ctaT=o.cta&&o.cta.trim()?Math.min(2.6,seconds*.22):0;
  const citeAt=textStart+textWin+.15, endAt=citeAt+.5, ctaAt=seconds-ctaT-.3;
  const allWords=b.lines.map(l=>l.split(' ').length).reduce((a,x)=>a+x,0), allChars=b.lines.join(' ').length;
  const nameY=(safe?.745:.87)*H, siteY=(safe?.778:.915)*H, ctaY=(safe?.83:.955)*H;
  function frame(t){
    ctx.globalAlpha=1;
    if(o.motion){const s=1+.06*(t/seconds);ctx.save();ctx.translate(W/2,H/2);ctx.scale(s,s);ctx.drawImage(bg,-W/2,-H/2);ctx.restore()}else ctx.drawImage(bg,0,0);
    // hook
    if(hookT){const a=t<hookT?clamp01(t/.4):clamp01(1-(t-hookT)/.5);if(a>0){ctx.save();ctx.globalAlpha=a;ctx.fillStyle=c.headerColor||'#2A2622';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.font=headerFontCss(c,headerSizeFor(c,92));setSpacing(ctx,c);const hl=wrapLines(ctx,headerStr(c,o.hook.trim()),.82*W);hl.forEach((l,i)=>ctx.fillText(l,W/2,.42*H+(i-(hl.length-1)/2)*100));ctx.restore()}}
    const ft=t-hookT; // main content time
    if(ft>0){
      if(o.showHeader){ctx.save();ctx.globalAlpha=clamp01((ft-.1)/.7);ctx.fillStyle=c.headerColor||'#2A2622';ctx.font=headerFontCss(c,headerSizeFor(c,52));ctx.textBaseline='alphabetic';setSpacing(ctx,c);
        const hy=(top-.035)*H;ctx.textAlign='left';ctx.fillText(headerStr(c,hd.left),.07*W,hy);ctx.textAlign='right';ctx.fillText(headerStr(c,hd.right),.93*W,hy);ctx.restore()}
      if(layer){const a=clamp01((ft-.3)/1.1),s=1+.05*(t/seconds);ctx.save();ctx.globalAlpha=a;ctx.translate(W/2,py+ph/2);ctx.scale(s,s);ctx.drawImage(layer,-pw/2,-ph/2);ctx.restore()}
    }
    ctx.save();ctx.fillStyle=INK;ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.font=`400 ${b.size}px ${b.family}`;
    let y=ty+b.size*.95;const p=clamp01((t-textStart)/textWin);
    if(o.anim==='all'){const a=clamp01((t-textStart)/1.2),s=.96+.04*a;ctx.globalAlpha=a;ctx.save();ctx.translate(W/2,ty+b.h/2);ctx.scale(s,s);ctx.translate(-W/2,-(ty+b.h/2));b.lines.forEach(l=>{ctx.fillText(l,W/2,y);y+=b.lineH});ctx.restore();y=ty+b.size*.95+b.lines.length*b.lineH}
    else if(o.anim==='words'||o.anim==='type'){
      let budget=o.anim==='words'?Math.floor(p*allWords+.0001):Math.floor(p*allChars);
      for(const l of b.lines){if(budget<=0)break;let shown;
        if(o.anim==='words'){const ws=l.split(' ');shown=ws.slice(0,budget).join(' ');budget-=ws.length}else{shown=l.slice(0,budget);budget-=l.length+1}
        ctx.globalAlpha=1;const full=ctx.measureText(l).width,x0=W/2-full/2;ctx.textAlign='left';ctx.fillText(shown,x0,y);ctx.textAlign='center';y+=b.lineH}
      y=ty+b.size*.95+b.lines.length*b.lineH}
    else{const per=textWin/Math.max(1,b.lines.length);b.lines.forEach((l,i)=>{const a=clamp01((t-textStart-i*per)/.7);ctx.globalAlpha=a;ctx.fillText(l,W/2,y+(1-a)*22);y+=b.lineH})}
    if(b.citeLines.length){y=y-b.lineH+b.size*.25+b.gap+b.citeSize*.95;ctx.font=`400 ${b.citeSize}px ${b.family}`;ctx.globalAlpha=clamp01((t-citeAt)/.7);b.citeLines.forEach(l=>{ctx.fillText(l,W/2,y);y+=b.citeLH})}
    const a2=clamp01((t-endAt)/.8);ctx.globalAlpha=a2;
    if(sign){ctx.fillStyle=c.nameColor||'#2A2622';ctx.font=`italic 400 ${56*(+c.nameSize||1)}px 'Cormorant Garamond', Georgia, serif`;ctx.fillText(sign,W/2,nameY)}
    if(c.showSite!==false){ctx.fillStyle=c.siteColor||SITE_GREEN;ctx.font=`500 ${34*(+c.siteSize||1)}px 'DM Sans', sans-serif`;ctx.fillText(state.settings.site,W/2,siteY)}
    if(ctaT){const a=clamp01((t-ctaAt)/.6);if(a>0){ctx.globalAlpha=a;ctx.font="600 40px 'DM Sans', sans-serif";const tw=Math.min(.86*W,ctx.measureText(o.cta).width+80);
      ctx.fillStyle='rgba(255,255,255,.85)';const x=(W-tw)/2,hh=84,yy=ctaY-hh*.68,r=42;ctx.beginPath();ctx.moveTo(x+r,yy);ctx.arcTo(x+tw,yy,x+tw,yy+hh,r);ctx.arcTo(x+tw,yy+hh,x,yy+hh,r);ctx.arcTo(x,yy+hh,x,yy,r);ctx.arcTo(x,yy,x+tw,yy,r);ctx.fill();
      ctx.fillStyle='#2A2622';ctx.fillText(o.cta.trim(),W/2,ctaY)}}
    ctx.restore();
    if(t<.5){ctx.fillStyle=`rgba(255,255,255,${1-t/.5})`;ctx.fillRect(0,0,W,H)}
  }
  frame(0);
  const stream=cv.captureStream(30);
  let ac=null;
  if(o.music!=='none'){try{ac=new (window.AudioContext||window.webkitAudioContext)();await ac.resume();const dest=ac.createMediaStreamDestination();
    if(o.music==='own'){if(!ownAudio)throw new Error('no audio');await startOwnAudio(ac,dest,seconds,o)}else startMusic2(ac,dest,seconds,o.music||'calm');
    dest.stream.getAudioTracks().forEach(tr=>stream.addTrack(tr))}catch(e){if(o.music==='own'){cv.remove();throw new Error('Choose your audio file first (Reel options → My own audio file).')}ac=null}}
  const rec=new MediaRecorder(stream,{mimeType:type,videoBitsPerSecond:6_000_000});
  const chunks=[];rec.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data)};
  const done=new Promise(r=>rec.onstop=r);
  rec.start(500);
  const t0=performance.now();
  await new Promise(resolve=>{
    const tick=()=>{const t=(performance.now()-t0)/1000;frame(Math.min(t,seconds));onProgress&&onProgress(Math.min(1,t/seconds));
      if(t>=seconds){resolve();return}
      if(document.hidden) setTimeout(tick,33); else requestAnimationFrame(tick)};
    tick();
  });
  rec.stop();await done;
  stream.getTracks().forEach(tr=>tr.stop());if(ac)ac.close();cv.remove();
  const ext=type.startsWith('video/mp4')?'mp4':'webm';
  const f=new File([new Blob(chunks,{type:type.split(';')[0]})],fileName(c).replace(/-\w+\.png$/,'')+`-reel.${ext}`,{type:type.split(';')[0]});
  f._caption=captionFor(c,'ig');
  return f;
}
let reelCard=null;
function openReelOptions(c){
  reelCard={...DEFAULT_STYLE,...c};const o=reelOpts();
  $('#rShowHeader').checked=!!o.showHeader;$('#rHook').value=o.hook||'';$('#rCta').value=o.cta||'';
  $('#rMusic').innerHTML=Object.entries(MUSIC).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('');$('#rMusic').value=o.music||'calm';
  $('#rSeconds').value=String(o.seconds||10);$('#rAnim').value=o.anim||'lines';$('#rMotion').checked=o.motion!==false;$('#rSafe').checked=o.safe!==false;
  $('#rVolume').value=o.volume??.8;$('#rStart').value=o.audioStart||0;$('#rTextSize').value=o.textSize||1;
  $('#rOwnName').textContent=ownAudio?`Saved: ${ownAudio.name}`:'No file chosen yet';
  $('#rOwnBox').hidden=$('#rMusic').value!=='own';
  $('#reelModal').classList.add('on');
}
function saveReelForm(){const o=reelOpts();
  Object.assign(o,{showHeader:$('#rShowHeader').checked,hook:$('#rHook').value,cta:$('#rCta').value,music:$('#rMusic').value,seconds:+$('#rSeconds').value,anim:$('#rAnim').value,
    motion:$('#rMotion').checked,safe:$('#rSafe').checked,volume:+$('#rVolume').value,audioStart:+$('#rStart').value||0,textSize:+$('#rTextSize').value});scheduleSave()}
$('#rMusic').addEventListener('change',()=>{$('#rOwnBox').hidden=$('#rMusic').value!=='own'});
$('#rOwnFile').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;
  if(f.size>40*1024*1024){alert('Please choose an audio file under 40 MB.');return}
  ownAudio={name:f.name,buf:await f.arrayBuffer()};try{await IDB.set('reelAudio',ownAudio)}catch(err){}
  $('#rOwnName').textContent=`Saved: ${f.name}`;e.target.value=''});
$('#rPreviewAudio').addEventListener('click',async()=>{saveReelForm();const o=reelOpts();const ac=new (window.AudioContext||window.webkitAudioContext)();await ac.resume();
  try{if(o.music==='own'){if(!ownAudio){alert('Choose your audio file first.');return}await startOwnAudio(ac,ac.destination,6,o)}else if(o.music!=='none')startMusic2(ac,ac.destination,6,o.music)}catch(e){alert('Could not play this audio file.')}
  setTimeout(()=>ac.close(),6500)});
$('#rCancel').addEventListener('click',()=>$('#reelModal').classList.remove('on'));
$('#rMake').addEventListener('click',()=>{saveReelForm();$('#reelModal').classList.remove('on');reelFlow(reelCard)});
async function reelFlow(c){
  $('#mediaTitle').textContent=`Making your Reel… keep this screen open (about ${reelOpts().seconds} seconds)`;
  $('#mediaBox').innerHTML='<div style="height:8px;background:var(--soft);border-radius:4px;overflow:hidden"><div id="reelBar" style="height:100%;width:0;background:var(--accent)"></div></div>';
  $('#mediaShare').hidden=true;$('#mediaModal').classList.add('on');
  try{
    const f=await makeReel({...DEFAULT_STYLE,...c},{onProgress:p=>{const bar=$('#reelBar');if(bar)bar.style.width=Math.round(p*100)+'%'}});
    showMedia(f,'video',f.name.endsWith('.webm')?'Reel ready (WebM). If Instagram will not accept it, make it in Chrome on a computer or Safari on iPhone, which save MP4.':'Reel ready — upload it to Instagram Reels or WhatsApp Status');
  }catch(e){$('#mediaTitle').textContent=e.message||'Could not make the video.';$('#mediaBox').innerHTML=''}
}
$('#reelBtn').addEventListener('click',()=>openReelOptions(card));

$('#todayList').addEventListener('click',async e=>{
  const b=e.target.closest('[data-tstory],[data-treel]');if(!b)return;
  const k=b.dataset.tstory||b.dataset.treel;const c=state.plan[k];if(!c)return;
  if(b.dataset.tstory){showMedia(await storyFile(c),'image','Story version — for Instagram Stories and WhatsApp Status')}
  else openReelOptions(c);
});

/* ---------- server: sync & autopilot ---------- */
const SRV={pw:()=>{try{return localStorage.getItem('sqc-app-pw')||''}catch(e){return ''}},token:()=>{try{return localStorage.getItem('sqc-session')||''}catch(e){return ''}},ok:false,info:null,who:null};
function authHeaders(){const t=SRV.token();return t?{'authorization':'Bearer '+t}:(SRV.pw()?{'x-app-password':SRV.pw()}:{})}
async function api(path,opt={}){
  const r=await fetch('/api/'+path,{...opt,headers:{...authHeaders(),...(opt.body&&typeof opt.body==='string'?{'content-type':'application/json'}:{}),...(opt.headers||{})}});
  const ct=r.headers.get('content-type')||'';const d=ct.includes('json')?await r.json().catch(()=>({})):await r.text();
  if(!r.ok){if(r.status===401&&SRV.token()&&/sign in/i.test((d&&d.error)||'')){try{localStorage.removeItem('sqc-session')}catch(e){}SRV.who=null;renderAccount()}throw new Error((d&&d.error)||`Server error ${r.status}`)}
  return d;
}
function srvStatus(t){const el=$('#srvStatus');if(el)el.textContent=t}
async function connectServer(silent){
  if(location.protocol==='file:'){srvStatus('Online features need the site deployed with GitHub + Netlify (see README).');return false}
  if(!SRV.token()&&!SRV.pw()){if(!silent)srvStatus('Sign in with Google (or enter the app password) first.');renderAccount();return false}
  try{SRV.info=await api('health');SRV.ok=true}
  catch(e){SRV.ok=false;srvStatus(/not found|404/i.test(e.message)?'This site has no server part. Deploy it with GitHub + Netlify to use sync and autopilot (see README).':e.message);renderAuto();return false}
  const c=SRV.info.connected;
  srvStatus(`Connected to your server. ${c?`Posting to Facebook Page "${c.page}"${c.ig?` and Instagram @${c.ig}`:' (no Instagram linked to this Page)'}.`:'Instagram & Facebook not connected yet.'}`);
  $('#metaConnected').hidden=!c;$('#metaForm').hidden=!!c;
  try{SRV.who=await api('me')}catch(e){}renderAccount();
  await secretsPull();await syncPull();renderAuto();renderBank();return true;
}
/* Combine two copies of the work instead of replacing one with the other (nothing found on any device is lost). */
function mergeStates(L,R){
  if(!R)return L;if(!L)return R;
  const newer=(R.updatedAt||0)>(L.updatedAt||0)?R:L;
  const out=clone(newer);
  const tomb={...(L.tomb||{}),...(R.tomb||{})};out.tomb=tomb;
  const unionBy=(a,b,key)=>{const m=new Map();for(const x of [...(a||[]),...(b||[])]){const k=key(x);if(!k||tomb[k]||tomb[x.id])continue;if(!m.has(k))m.set(k,x)}return [...m.values()]};
  out.library=unionBy(L.library,R.library,x=>x.id||norm(x.text||''));
  const lb=L.bank||{},rb=R.bank||{};
  if(lb.items||rb.items){out.bank={...(newer.bank||{}),
    items:unionBy(lb.items,rb.items,x=>norm(x.text||'')),
    done:{...(lb.done||{}),...(rb.done||{})},
    custom:unionBy(lb.custom,rb.custom,x=>x.id),
    books:[...new Set([...((newer.bank||{}).books||[])])]};
    if(tomb['bank:cleared']){const t=tomb['bank:cleared'];out.bank.items=out.bank.items.filter(x=>(x.at||0)>t);for(const [k,v] of Object.entries(out.bank.done))if(v<t)delete out.bank.done[k]}}
  out.plan={...(L.plan||{}),...(R.plan||{})};
  for(const k of Object.keys(out.plan)){const l=(L.plan||{})[k],r=(R.plan||{})[k];if(l&&r)out.plan[k]=((r._t||0)>(l._t||0))?r:l;if(tomb['plan:'+k]&&(out.plan[k]._t||0)<tomb['plan:'+k])delete out.plan[k]}
  out.posted={...(L.posted||{}),...(R.posted||{})};
  out.updatedAt=Math.max(L.updatedAt||0,R.updatedAt||0);
  return out;
}
const sameJSON=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
async function syncPull(){
  if(!SRV.ok)return;
  try{
    const remote=await api('state');
    if(!remote||!remote.state){syncPush();return}
    const merged=mergeStates(state,{...remote.state,updatedAt:remote.updatedAt});
    const localChanged=!sameJSON({...merged,updatedAt:0},{...state,updatedAt:0});
    const remoteChanged=!sameJSON({...merged,updatedAt:0},{...remote.state,updatedAt:0});
    if(localChanged){
      state=merged;migrate();
      const need=new Set();state.settings.masters.forEach(m=>m.photos.forEach(id=>need.add(id)));Object.values(state.plan).forEach(c=>{if(c.photo&&c.photo!=='master'&&c.photo!=='none')need.add(c.photo)});
      for(const id of need){if(!photos[id]){try{const d=await api('photo/'+encodeURIComponent(id));if(typeof d==='string'&&d.startsWith('data:'))await savePhoto(id,d)}catch(e){}}}
      await IDB.set('state',state);if(!bankCtl){card={...DEFAULT_STYLE,...clone(state.settings.draft||card)};refreshAll()}else renderBank();
    }
    if(remoteChanged)syncPush();
  }catch(e){}
}
let pushTimer=null;
setInterval(()=>{if(SRV.ok&&!document.hidden&&!pushTimer)syncPull()},45000);
window.addEventListener('focus',()=>{if(SRV.ok&&!pushTimer)syncPull()});
function syncPush(){
  if(!SRV.ok)return;clearTimeout(pushTimer);
  pushTimer=setTimeout(async()=>{
    try{
      let have=new Set();try{have=new Set((await api('photos')).ids)}catch(e){}
      for(const [id,data] of Object.entries(photos)) if(!have.has(id)) await api('photo/'+encodeURIComponent(id),{method:'PUT',body:data,headers:{'content-type':'text/plain'}});
      try{const remote=await api('state');if(remote&&remote.state){const m=mergeStates(state,{...remote.state,updatedAt:remote.updatedAt});if(!sameJSON({...m,updatedAt:0},{...state,updatedAt:0})){state=m;await IDB.set('state',state);if(!bankCtl)renderBank()}}}catch(e){}
      await api('state',{method:'PUT',body:JSON.stringify({state,updatedAt:Math.max(state.updatedAt||0,Date.now())})});
      setStatus('Saved and synced');pushTimer=null;
    }catch(e){setStatus('Saved here — sync failed: '+e.message)}
  },2500);
}
$('#srvConnect').addEventListener('click',()=>{try{localStorage.setItem('sqc-app-pw',$('#srvPw').value.trim())}catch(e){};connectServer(false)});
$('#metaConnect').addEventListener('click',async()=>{
  const st=$('#metaStatus');st.textContent='Connecting…';
  try{
    const d=await api('connect',{method:'POST',body:JSON.stringify({appId:$('#metaApp').value.trim(),appSecret:$('#metaSecret').value.trim(),userToken:$('#metaToken').value.trim()})});
    if(d.choose){$('#metaPages').innerHTML=d.choose.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}${p.igUsername?' — @'+esc(p.igUsername):' — no Instagram linked'}</option>`).join('');$('#metaPick').hidden=false;st.textContent='Choose which Page to post to.';return}
    st.textContent=`Connected: ${d.page}${d.ig?' + Instagram @'+d.ig:''}.`;$('#metaSecret').value='';$('#metaToken').value='';connectServer(true);
  }catch(e){st.textContent=e.message}
});
$('#metaPickBtn').addEventListener('click',async()=>{
  try{const d=await api('connect',{method:'POST',body:JSON.stringify({pageId:$('#metaPages').value})});$('#metaPick').hidden=true;$('#metaStatus').textContent=`Connected: ${d.page}${d.ig?' + Instagram @'+d.ig:''}.`;connectServer(true)}
  catch(e){$('#metaStatus').textContent=e.message}
});
$('#metaDisconnect').addEventListener('click',async()=>{if(!confirm('Disconnect Instagram & Facebook? Scheduled posts will not go out until you connect again.'))return;await api('disconnect',{method:'POST'});connectServer(true)});

/* autopilot tab */
function localWhen(date,time){return new Date(`${date}T${time||'09:00'}:00`)}
async function jpegBase64(c){const cv=document.createElement('canvas');await renderCard(cv,c);return cv.toDataURL('image/jpeg',.92)}
async function renderAuto(){
  const box=$('#autoList');if(!box)return;
  $('#autoNeed').hidden=SRV.ok;$('#autoMain').hidden=!SRV.ok;
  $('#autoSlots').innerHTML=slots().map(s=>`<label class="check"><input type="checkbox" data-aslot="${s.id}" checked> ${esc(fmtTime(s.time))} · ${esc(s.label)}</label>`).join('');
  if(!SRV.ok)return;
  try{
    const {items}=await api('queue');const now=Date.now();
    const show=items.filter(i=>i.status!=='posted'||now-new Date(i.when).getTime()<3*864e5);
    box.innerHTML=show.length?show.map(i=>{const res=Object.entries(i.results||{}).map(([t,r])=>`${t==='ig'?'Instagram':t==='fb'?'Facebook':t}: ${r.ok?'✓':'✗ '+esc(r.error||'')}`).join(' · ');
      const when=new Date(i.when);
      return `<div class="item"><div class="meta"><strong>${when.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})} ${when.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}</strong> · ${esc((i.targets||[]).map(t=>t==='ig'?'Instagram':'Facebook').join(' + '))} · <span class="badge ${i.status==='posted'?'ok':i.status==='scheduled'?'':'warn'}" style="margin:0">${esc(i.status)}</span></div>
        <p style="font-size:.88rem">${esc((i.captionIg||'').split('\n')[0].slice(0,140))}</p>${res?`<p class="status">${res}</p>`:''}
        <div class="acts">${i.status!=='posted'?`<button class="btn small" data-anow="${esc(i.key)}">Post now</button>`:''}<button class="btn small" data-adel="${esc(i.key)}">Remove</button></div></div>`}).join(''):'<p class="status">Nothing scheduled yet.</p>';
  }catch(e){box.innerHTML=`<p class="status">${esc(e.message)}</p>`}
}
$('#autoSend').addEventListener('click',async()=>{
  const days=Math.max(1,Math.min(62,+$('#autoDays').value||7));
  const targets=[...(($('#autoFb').checked)?['fb']:[]),...(($('#autoIg').checked)?['ig']:[])];
  if(!targets.length){$('#autoStatus').textContent='Tick Facebook and/or Instagram.';return}
  const useSlots=[...document.querySelectorAll('[data-aslot]')].filter(x=>x.checked).map(x=>x.dataset.aslot);
  const list=[];let d=todayStr();
  for(let i=0;i<days;i++){for(const s of slots()){if(!useSlots.includes(s.id))continue;const k=d+'|'+s.id,c=state.plan[k];
    if(c&&localWhen(d,s.time).getTime()>Date.now()+60000) list.push([k,c,s])}d=shiftDate(d,1)}
  if(!list.length){$('#autoStatus').textContent='No future cards in that range. Fill the month first.';return}
  const btn=$('#autoSend');btn.disabled=true;let n=0,skipped=0;
  try{
    for(const [k,c,s] of list){
      const cc={...DEFAULT_STYLE,...c};
      let tg=targets;if(cc.format==='story'&&tg.includes('ig')){tg=tg.filter(t=>t!=='ig');skipped++}
      if(!tg.length)continue;
      $('#autoStatus').textContent=`Uploading ${++n} of ${list.length}…`;
      await api('queue',{method:'POST',body:JSON.stringify({key:k,when:localWhen(c.date,s.time).toISOString(),targets:tg,captionFb:captionFor(cc,'ig'),captionIg:captionFor(cc,'ig'),label:s.label,image:await jpegBase64(cc)})});
    }
    $('#autoStatus').textContent=`${n} post${n===1?'':'s'} scheduled. They go out automatically within 10 minutes of each time.`+(skipped?` ${skipped} Story-size cards were sent to Facebook only, because Instagram feed posts can't be 9:16.`:'');
  }catch(e){$('#autoStatus').textContent='Stopped: '+e.message}
  finally{btn.disabled=false;renderAuto()}
});
$('#autoList').addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.adel&&confirm('Remove this scheduled post?')){await api('queue/'+encodeURIComponent(b.dataset.adel),{method:'DELETE'});renderAuto()}
  if(b.dataset.anow){b.disabled=true;b.textContent='Posting…';try{const d=await api('queue/'+encodeURIComponent(b.dataset.anow)+'/now',{method:'POST'});$('#autoStatus').textContent=d.ok?'Posted.':'Some targets failed — see below.'}catch(err){$('#autoStatus').textContent=err.message}renderAuto()}
});
$('#autoLogBtn').addEventListener('click',async()=>{try{const {log}=await api('log');$('#autoLog').innerHTML=log.slice(0,40).map(l=>`<div class="status">${esc(new Date(l.at).toLocaleString())} · ${esc(l.key)} · ${l.target==='ig'?'Instagram':'Facebook'} · ${l.ok?'✓ posted':'✗ '+esc(l.error)}</div>`).join('')||'<p class="status">No posts yet.</p>'}catch(e){$('#autoLog').textContent=e.message}});


/* ---------- Source bank: new quotes from sriramchandra.org books ---------- */
const BANK_BOOKS=[
  {id:'ery',title:'Efficacy of Raja Yoga',dir:'BW',from:3,to:10,abbr:'BWS',master:'babuji'},
  {id:'cmd',title:'Commentary on Ten Commandments',dir:'BW',from:12,to:21,abbr:'BWS',master:'babuji'},
  {id:'rad',title:'Reality at Dawn',dir:'BW',from:22,to:31,abbr:'BWS',master:'babuji'},
  {id:'ti',title:'Towards Infinity',dir:'BW',from:34,to:36,abbr:'BWS',master:'babuji'},
  {id:'sdg',title:'Showers of Divine Grace',dir:'SDG',from:1,to:43,abbr:'SDG',master:'babuji'},
  {id:'ss',title:'Silence Speaks',dir:'SS',from:1,to:26,abbr:'SS',master:'babuji'},
  {id:'kcv1',title:'Complete Works of Dr K.C. Varadachari, Vol 1',dir:'KCV1',from:1,to:66,abbr:'KCV1',master:'kcv'}
];
const PP_MONTHS=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
let bankCtl=null, ppCache=null;
function bank(){state.bank=state.bank||{items:[],done:{},books:['ery','cmd','rad','ti','sdg','ss'],custom:[]};return state.bank}
function bankBooks(){return [...BANK_BOOKS,...(bank().custom||[])]}
function chapPath(b,i){return `Books/${b.dir}/${b.dir}chap_${i}.htm`}
function chapUrl(b,i){return 'http://www.sriramchandra.org/'+chapPath(b,i)}
function fragEnc(s){return encodeURIComponent(s).replace(/-/g,'%2D').replace(/,/g,'%2C').replace(/&/g,'%26')}
function deepLink(url,quote){
  const w=quote.replace(/\s+/g,' ').trim().split(' ');
  if(w.length<=8) return `${url}#:~:text=${fragEnc(w.join(' '))}`;
  return `${url}#:~:text=${fragEnc(w.slice(0,4).join(' '))},${fragEnc(w.slice(-4).join(' '))}`;
}
function pageText(html){
  const doc=new DOMParser().parseFromString(html,'text/html');
  const el=doc.querySelector('#content_inner')||doc.body;
  el.querySelectorAll('script,style').forEach(x=>x.remove());
  el.querySelectorAll('br').forEach(x=>x.replaceWith('\n'));
  el.querySelectorAll('p,div,tr,h1,h2,h3,h4').forEach(x=>x.append('\n\n'));
  return {text:el.textContent.replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim(),
          title:((doc.querySelector('title')||{}).textContent||'').split('»').pop().trim()};
}
const words=s=>new Set(norm(s).replace(/[^a-z0-9' ]/g,' ').split(/\s+/).filter(w=>w.length>2));
function overlaps(a,b){const A=words(a),B=words(b);if(!A.size||!B.size)return false;let n=0;A.forEach(w=>{if(B.has(w))n++});return n/Math.min(A.size,B.size)>=.7}
async function loadPeerless(say){
  if(ppCache) return ppCache;
  const out=[];
  for(const m of PP_MONTHS){
    say&&say(`Reading Peerless Pearls (${m})…`);
    const html=await api('src?path='+encodeURIComponent(`PeerlessPearls/${m}.htm`));
    const doc=new DOMParser().parseFromString(html,'text/html');
    doc.querySelectorAll('tr').forEach(tr=>{const td=tr.querySelectorAll('td');const a=tr.querySelector('a[href*="/Books/"]');
      if(td.length>=4&&a) out.push({text:td[2].textContent.trim(),href:a.getAttribute('href'),code:a.textContent.trim()})});
  }
  ppCache=out;return out;
}
function bankStatus(t){$('#bankStatus').textContent=t}
function renderBank(){
  const B=bank();
  $('#bankNeed').hidden=SRV.ok;
  $('#bankBooks').innerHTML='<p class="hint" style="margin:0 0 6px">The first four together are the complete <strong>Basic Writings of Sri Ramchandra</strong>.</p>'+bankBooks().map(b=>{const done=Object.keys(B.done).filter(k=>k.startsWith(b.id+':')).length,total=b.to-b.from+1;
    const who=masterName(b.master);const tag=`<span class="badge ok" style="margin:0 4px 0 0">${esc(who||'?')}</span>`;
    if(b.kind==='pdf'){const d2=Object.keys(B.done).filter(k=>k.startsWith(b.id+':p')).length;return `<div class="check">${''}<input type="checkbox" data-bbook="${esc(b.id)}" ${B.books.includes(b.id)?'checked':''}> ${tag}${esc(b.title)} <span class="status">(your PDF · ${b.pages} pages${d2?` · ${d2*8>b.pages?b.pages:d2*8} read`:''})</span> <button class="btn small" data-bdelbook="${esc(b.id)}">Remove</button></div>`}
    return `<label class="check"><input type="checkbox" data-bbook="${esc(b.id)}" ${B.books.includes(b.id)?'checked':''}> ${tag}${esc(b.title)} <span class="status">(${esc(b.dir)} chapters ${b.from}–${b.to}${done?` · ${done}/${total} read`:''})</span></label>`}).join('');
  const items=B.items;
  $('#bankCount').textContent=items.length?`${items.length} new quotes found. ${items.filter(i=>i.verified).length} match the website text word for word.`:'No quotes found yet.';
  $('#bankList').innerHTML=items.slice(-60).reverse().map(i=>`<div class="item"><p>${esc(i.text)}</p>
    <div class="meta">${esc(i.book)} · ${esc(i.chapTitle||'')} · ${esc(i.code)}${i.verified?'':' · ⚠ check wording'}</div>
    <div class="acts"><a class="btn small" href="${esc(i.link)}" target="_blank" rel="noopener">Open in book</a><button class="btn small" data-bdel="${esc(i.id)}">Remove</button></div></div>`).join('')+(items.length>60?`<p class="status">Showing the latest 60. The Excel file has all ${items.length}.</p>`:'');
}
$('#bankBooks').addEventListener('click',async e=>{const b=e.target.closest('[data-bdelbook]');if(!b)return;if(!confirm('Remove this PDF book? Quotes already found stay.'))return;
  const B=bank();B.custom=(B.custom||[]).filter(x=>x.id!==b.dataset.bdelbook);B.books=B.books.filter(x=>x!==b.dataset.bdelbook);await IDB.del('bankpdf:'+b.dataset.bdelbook);scheduleSave();renderBank()});
$('#bankPdfAdd').addEventListener('click',async()=>{
  const f=$('#bankPdfFile').files[0],title=$('#bankPdfTitle').value.trim();
  if(!f||!title){alert('Choose the PDF and type its title.');return}
  if(!window.pdfjsLib){alert('The PDF reader did not load. Refresh and try again.');return}
  pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const buf=await f.arrayBuffer();let pages=0;try{pages=(await pdfjsLib.getDocument({data:new Uint8Array(buf.slice(0))}).promise).numPages}catch(err){alert('This PDF could not be opened.');return}
  const id='p'+uidGen();try{await IDB.set('bankpdf:'+id,buf)}catch(err){alert('Not enough browser storage for this PDF.');return}
  const b={id,kind:'pdf',title,abbr:($('#bankPdfAbbr').value.trim()||bookInitials(title)).toUpperCase(),master:$('#bankPdfMaster').value,offset:+$('#bankPdfOffset').value||0,pages,link:$('#bankPdfLink').value.trim(),from:1,to:pages,dir:'PDF'};
  const B=bank();B.custom=[...(B.custom||[]),b];B.books.push(id);scheduleSave();renderBank();
  $('#bankPdfFile').value='';$('#bankPdfTitle').value='';$('#bankPdfAbbr').value='';$('#bankPdfLink').value='';bankStatus(`${title} added (${pages} pages).`);
});
$('#bankBooks').addEventListener('change',e=>{const id=e.target.dataset.bbook;if(!id)return;const B=bank();B.books=e.target.checked?[...new Set([...B.books,id])]:B.books.filter(x=>x!==id);scheduleSave()});
$('#bankList').addEventListener('click',e=>{const b=e.target.closest('[data-bdel]');if(!b)return;const B=bank();state.tomb=state.tomb||{};const gone=B.items.find(i=>i.id===b.dataset.bdel);if(gone)state.tomb[norm(gone.text)]=Date.now();B.items=B.items.filter(i=>i.id!==b.dataset.bdel);scheduleSave();renderBank()});
$('#bankAddBook').addEventListener('click',()=>{
  const dir=$('#bankDir').value.trim().replace(/[^A-Za-z0-9]/g,''),from=+$('#bankFrom').value,to=+$('#bankTo').value,title=$('#bankTitle').value.trim();
  if(!dir||!from||!to||to<from||!title){alert('Fill in folder, first and last chapter, and title.');return}
  const b={id:'c'+uidGen(),title,dir,from,to,abbr:($('#bankAbbr').value.trim()||dir).toUpperCase(),master:$('#bankMaster').value};
  const B=bank();B.custom=[...(B.custom||[]),b];B.books.push(b.id);scheduleSave();renderBank();
});
$('#bankRun').addEventListener('click',async()=>{
  if(!SRV.ok){bankStatus('Connect to your server first (Setup → Online sync & autopilot).');return}
  if(!availableProviders(false).length){bankStatus('Add a free AI key in Setup first.');return}
  const B=bank();const target=Math.max(1,+$('#bankTarget').value||500);
  const books=bankBooks().filter(b=>B.books.includes(b.id));if(!books.length){bankStatus('Tick at least one book.');return}
  bankCtl=new AbortController();$('#bankRun').disabled=true;$('#bankStop').hidden=false;
  try{
    const pp=await loadPeerless(bankStatus);
    const existing=[...pp,...state.library.map(q=>({text:q.text,href:''}))];
    // read all chapters first, to share the target fairly
    const chapters=[];
    for(const b of books.filter(b=>b.kind==='pdf')){
      const rec=await IDB.get('bankpdf:'+b.id);if(!rec){bankStatus(`The PDF for ${b.title} is missing — add it again.`);continue}
      if(!window.pdfjsLib)throw new Error('The PDF reader did not load. Refresh and try again.');
      pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      const pdf=await pdfjsLib.getDocument({data:new Uint8Array(rec)}).promise;
      for(let s=1;s<=pdf.numPages;s+=8){const key=b.id+':p'+s;if(B.done[key])continue;
        bankStatus(`Reading ${b.title}, pages ${s}–${Math.min(pdf.numPages,s+7)}…`);let text='';
        for(let i=s;i<=Math.min(pdf.numPages,s+7);i++){const pg=await pdf.getPage(i);const tc=await pg.getTextContent();const raw=tc.items.map(t=>t.str+(t.hasEOL?'\n':' ')).join('');
          const head=raw.replace(/\s+/g,' ').trim().slice(0,90);const m=head.match(/^(?:[A-Z][A-Z'’.,:&\- ]{3,}\s)?(\d{1,3})\b|\b(\d{1,3})\s*$/);const pr=m?Number(m[1]||m[2]):null;
          const page=pr&&Math.abs(pr-(i+(+b.offset||0)))<40?pr:i+(+b.offset||0);text+=`\n[[Page ${page}]]\n`+raw.replace(/[ \t]+/g,' ')}
        if(norm(text).length>400)chapters.push({b,i:s,key,text,title:`pages ${s}–${Math.min(pdf.numPages,s+7)}`,pdfMode:true})}
    }
    for(const b of books.filter(b=>b.kind!=='pdf')) for(let i=b.from;i<=b.to;i++){
      const key=b.id+':'+i;if(B.done[key])continue;
      bankStatus(`Reading ${b.title}, chapter ${i}…`);
      try{const {text,title}=pageText(await api('src?path='+encodeURIComponent(chapPath(b,i))));if(text.length>400)chapters.push({b,i,key,text,title})}
      catch(e){if(/404/.test(e.message))continue;throw e}
      if(bankCtl.signal.aborted)throw new DOMException('stop','AbortError');
    }
    const totalLen=chapters.reduce((a,c)=>a+c.text.length,0)||1;
    const need=()=>target-B.items.length;
    for(const ch of chapters){
      if(need()<=0)break;
      const want=Math.max(2,Math.ceil(need()*ch.text.length/totalLen*1.35)+1);
      const avoid=ch.pdfMode?'':pp.filter(p=>p.href&&p.href.toLowerCase().includes(`${ch.b.dir}chap_${ch.i}.htm`.toLowerCase())).map(p=>'- '+p.text).join('\n');
      // split long chapters to fit the current provider
      const pid0=nextProvider(false);const budget=Math.min(30000,pid0?PROVIDERS[pid0].maxChars:30000);
      const parts=[];let cur='';for(const para of ch.text.split(/\n\n/)){if((cur+para).length>budget&&cur){parts.push(cur);cur=''}cur+=(cur?'\n\n':'')+para}if(cur)parts.push(cur);
      for(const part of parts){
        if(need()<=0)break;
        const pw=Math.max(1,Math.ceil(want*part.length/ch.text.length));
        const sLike={kind:'book',title:ch.b.title,master:ch.b.master};
        const prompt=quotePrompt(sLike,pw,'',!!ch.pdfMode)+(avoid?`\n\nThese passages from this chapter are ALREADY USED — do not pick them or anything overlapping them:\n${avoid}`:'')+JSON_NOTE+`\n\nSOURCE (${ch.b.title} — ${ch.title}):\n${part}`;
        bankStatus(`${ch.b.title} · ${ch.title} · ${B.items.length} of ${target} found…`);
        let got;
        let skipPart=false;
        for(let fails=0;;){
          try{got=await askAny(prompt,{json:true,signal:bankCtl.signal,onStatus:t=>bankStatus(`${ch.title}: ${t} (${B.items.length} of ${target})`)});break}
          catch(e){
            if(bankCtl.signal.aborted||(e&&e.name==='AbortError'))throw e;
            let ms;
            if(e&&e.code==='allfailed'){const future=Object.values(cooled).filter(t=>t>Date.now());ms=future.length?Math.min(...future)-Date.now():20000;ms=Math.max(20000,Math.min(ms,15*60e3))}
            else{fails++;if(fails>=6){skipPart=true;bankStatus(`Skipping a part of ${ch.title} that keeps failing…`);await sleep(2000);break}ms=20000}
            for(let s=Math.ceil(ms/1000);s>0;s--){if(bankCtl.signal.aborted)throw new DOMException('stop','AbortError');
              bankStatus(`AI limit reached — trying again by itself in ${s>90?Math.ceil(s/60)+' min':s+'s'} · ${B.items.length} of ${target} found · keep this tab open`);await sleep(1000)}
          }
        }
        if(skipPart)continue;
        let arr=parseJSON(got.text);if(!Array.isArray(arr))arr=(arr&&(arr.quotes||arr.items))||[];
        const hay=norm(part);
        for(const x of arr){
          if(!x||typeof x.text!=='string')continue;const t=x.text.replace(/\s+/g,' ').trim();if(t.split(/\s+/).length<6)continue;
          if(existing.some(e=>overlaps(t,e.text))||B.items.some(e=>overlaps(t,e.text)))continue;
          const verified=hay.includes(norm(t));if(!verified)continue; // only keep exact wording from the website
          if(ch.pdfMode){const pg=x.page!=null&&x.page!==''?Number(x.page):null;
            B.items.push({id:uidGen(),at:Date.now(),text:t,master:ch.b.master,book:ch.b.title,abbr:ch.b.abbr,chapter:null,chapTitle:ch.title,url:'',link:ch.b.link||'',code:pg?`${ch.b.abbr} ${pg}`:ch.b.abbr,page:pg,pageBook:ch.b.title,verified})}
          else{const url=chapUrl(ch.b,ch.i);
          B.items.push({id:uidGen(),at:Date.now(),text:t,master:ch.b.master,book:ch.b.title,abbr:ch.b.abbr,chapter:ch.i,chapTitle:ch.title,url,link:deepLink(url,t),code:`${ch.b.abbr} ch.${ch.i}`,page:null,verified})}
          if(need()<=0)break;
        }
        await sleep(PROVIDERS[got.pid].gap);
      }
      B.done[ch.key]=Date.now();scheduleSave();renderBank();
    }
    bankStatus(need()<=0?`Done — ${B.items.length} new quotes. Download the Excel file.`:`Read every chosen chapter — ${B.items.length} new quotes. Tick more books, or press "Start over" for a fresh pass.`);
  }catch(e){bankStatus((e&&e.name==='AbortError')?`Stopped. ${bank().items.length} quotes saved — press Find new quotes to continue.`:`Paused: ${errMsg(e)} ${bank().items.length} quotes saved — press Find new quotes later to continue where it stopped.`)}
  finally{$('#bankRun').disabled=false;$('#bankStop').hidden=true;bankCtl=null;scheduleSave();renderBank()}
});
$('#bankStop').addEventListener('click',()=>bankCtl&&bankCtl.abort());
$('#bankClear').addEventListener('click',()=>{if(!confirm('Clear the found quotes and start over? (Your library is not affected.)'))return;state.tomb=state.tomb||{};state.tomb['bank:cleared']=Date.now();state.bank={...bank(),items:[],done:{}};scheduleSave();renderBank()});
const BOOK_PDFS={sdg:{path:'Books/sdg/sdg.zip',title:'Showers of Divine Grace',abbr:'SDG'}};
function bookInitials(t){if(/basic writings/i.test(t))return 'BWS';return t.split(/\s+/).filter(w=>!/^(of|at|the|and|to|in|on|a|an|sri|s)$/i.test(w)).map(w=>w[0].toUpperCase()).join('')}
async function pdfPageSet(pdf,offset){
  const out=[];
  for(let i=1;i<=pdf.numPages;i++){const pg=await pdf.getPage(i);const tc=await pg.getTextContent();const raw=tc.items.map(t=>t.str+(t.hasEOL?'\n':' ')).join('');
    const head=raw.replace(/\s+/g,' ').trim().slice(0,90);const m=head.match(/^(?:[A-Z][A-Z'’.,:&\- ]{3,}\s)?(\d{1,3})\b|\b(\d{1,3})\s*$/)||head.match(/\b(\d{1,3})\b/);
    const printed=m?Number(m[1]||m[2]):null;
    out.push({norm:norm(raw),page:printed&&Math.abs(printed-(i+offset))<40?printed:i+offset})}
  return out;
}
async function fetchBin(path){const r=await fetch('/api/srcbin?path='+encodeURIComponent(path),{headers:authHeaders()});if(!r.ok)throw new Error('Could not download the book PDF ('+r.status+')');return r.arrayBuffer()}
$('#bankPages').addEventListener('click',async()=>{
  const items=bank().items.filter(i=>!i.page);if(!items.length){bankStatus('All quotes already have page numbers.');return}
  if(!window.pdfjsLib){bankStatus('The PDF reader did not load. Refresh and try again.');return}
  pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const sets=[];
  // 1) official PDFs from sriramchandra.org (Showers of Divine Grace)
  for(const [id,info] of Object.entries(BOOK_PDFS)){
    if(!items.some(i=>i.abbr===info.abbr)||!SRV.ok)continue;
    try{bankStatus(`Downloading ${info.title} PDF from sriramchandra.org…`);const zipBuf=await fetchBin(info.path);const zip=await JSZip.loadAsync(zipBuf);
      const f=Object.values(zip.files).find(x=>/\.pdf$/i.test(x.name));if(!f)continue;
      const pdf=await pdfjsLib.getDocument({data:await f.async('uint8array')}).promise;bankStatus(`Reading ${info.title} pages…`);
      sets.push({forAbbr:info.abbr,title:info.title,abbr:info.abbr,pages:await pdfPageSet(pdf,0)})}catch(e){bankStatus(e.message)}
  }
  // 2) PDFs you added in Find quotes (e.g. Basic Writings)
  for(const s of sources.filter(s=>s.pdf)){bankStatus(`Reading ${s.title} pages…`);if(!s._set)s._set=await pdfPageSet(s.pdf,Number(s.offset)||0);
    sets.push({forAbbr:null,title:s.title,abbr:bookInitials(s.title),pages:s._set})}
  if(!sets.length){bankStatus('For Basic Writings, add the Basic Writings PDF in Find quotes first, then press this again.');return}
  let n=0;
  for(const it of items){const key=norm(it.text).slice(0,70);
    const order=[...sets.filter(x=>x.forAbbr===it.abbr),...sets.filter(x=>!x.forAbbr)];
    const key2=norm(it.text).slice(0,35);
    for(const st of order){let pg=st.pages.find(p=>p.norm.includes(key));
      if(!pg){const i=st.pages.findIndex((p,k)=>(p.norm+' '+((st.pages[k+1]||{}).norm||'')).includes(key));if(i>=0)pg=st.pages[i]}
      if(!pg)pg=st.pages.find(p=>p.norm.includes(key2));
      if(pg){it.page=pg.page;it.pageBook=st.title;it.code=`${st.abbr} ${pg.page}`;n++;break}}}
  const left=bank().items.filter(i=>!i.page).length;
  scheduleSave();renderBank();bankStatus(`Found page numbers for ${n} quotes.`+(left?` ${left} still need a PDF — e.g. add the Basic Writings PDF in Find quotes and press again.`:''));
});
$('#bankToLib').addEventListener('click',()=>{
  const have=new Set(state.library.map(q=>norm(q.text)));let n=0;
  for(const it of bank().items){if(have.has(norm(it.text)))continue;state.library.push({id:uidGen(),text:it.text,cite:it.page?`(${it.pageBook||it.book} - pg ${it.page})`:`(${it.book})`,master:it.master,link:it.link,code:it.code});n++}
  scheduleSave();bankStatus(`Added ${n} quotes to the library.`);
});
async function ensureXLSX(){
  if(window.XLSX)return;
  await new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';s.onload=res;s.onerror=()=>rej(new Error('Could not load the Excel tool'));document.head.appendChild(s)});
}
function sheetFrom(rows){
  const head=['No.','Quote','Master','Book','Chapter','Code','Citation','Open in book','Link (copy)','Trainer','Approved (Y/N)','Notes'];
  const ws=XLSX.utils.aoa_to_sheet([head,...rows.map((r,i)=>[i+1,r.text,masterName(r.master),r.book||'',r.chapTitle||'',r.code||'',r.page?`(${r.pageBook||r.book} - pg ${r.page})`:(r.cite||''),r.link?'Open':'',r.link||'',r.trainer||'','',''])]);
  rows.forEach((r,i)=>{if(r.link){const ref=XLSX.utils.encode_cell({r:i+1,c:7});
    if(r.link.length<=250) ws[ref]={t:'s',v:'Open',f:`HYPERLINK("${r.link.replace(/"/g,'%22')}","Open")`};
    else ws[ref].l={Target:r.link,Tooltip:'Open this passage on sriramchandra.org'}}});
  ws['!cols']=[{wch:5},{wch:70},{wch:18},{wch:28},{wch:26},{wch:12},{wch:36},{wch:12},{wch:40},{wch:10},{wch:14},{wch:24}];
  return ws;
}
async function downloadXlsx(rows,name,trainers){
  await ensureXLSX();
  const wb=XLSX.utils.book_new();
  if(trainers>1) rows.forEach((r,i)=>r.trainer=`Trainer ${Math.floor(i*trainers/rows.length)+1}`);
  XLSX.utils.book_append_sheet(wb,sheetFrom(rows),'All quotes');
  if(trainers>1) for(let t=1;t<=trainers;t++) XLSX.utils.book_append_sheet(wb,sheetFrom(rows.filter(r=>r.trainer===`Trainer ${t}`)),`Trainer ${t}`);
  const out=XLSX.write(wb,{bookType:'xlsx',type:'array'});
  saveBlob(new Blob([out],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),name);
}
$('#bankXlsx').addEventListener('click',async()=>{
  const items=bank().items;if(!items.length){bankStatus('No quotes yet.');return}
  try{await downloadXlsx(items.map(x=>({...x})),`new-quotes-${todayStr()}.xlsx`,Math.max(1,+$('#bankTrainers').value||1));bankStatus('Excel downloaded.')}catch(e){bankStatus(e.message)}
});
$('#libXlsx').addEventListener('click',async()=>{
  try{await downloadXlsx(state.library.map(q=>({text:q.text,master:q.master,book:(q.cite||'').replace(/^\(|\)$/g,''),code:q.code||'',link:q.link||''})),`quote-library-${todayStr()}.xlsx`,1)}catch(e){alert(e.message)}
});


/* =====================================================================
   STUDIO — podcast / talk editor. Heavy video work is done by ffmpeg on
   the user's own computer; the browser does sync, transcript, editing.
   ===================================================================== */
const STU_DEFAULTS={clean:'standard',res:'orig',enc:'cpu',lang:'',fillers:true,pauses:true,maxPause:1.0,trimEnds:true,srt:true,reelCaps:true,reelRes:'1080',separate:true,proxy:false};
let STU={videoName:'',audioName:'',videoFile:null,proxyFile:null,info:null,wavV:null,wavA:null,dur:0,sync:null,words:[],removed:{},reels:[],settings:{...STU_DEFAULTS},transcribed:false};
const FILLERS=new Set(['um','umm','uh','uhh','erm','er','ah','hmm','mm','mmm','uhm']);
function stuSay(id,t){const el=$(id);if(el)el.textContent=t}
async function stuSave(){try{const {videoFile,proxyFile,wavV,wavA,...rest}=STU;await IDB.set('studio',rest)}catch(e){}}
async function stuLoad(){try{const s=await IDB.get('studio');if(s){STU={...STU,...s,settings:{...STU_DEFAULTS,...(s.settings||{})}}}}catch(e){}}
const fmtT=t=>{t=Math.max(0,t);const h=Math.floor(t/3600),m=Math.floor(t%3600/60),s=(t%60);return (h?h+':'+String(m).padStart(2,'0'):m)+':'+s.toFixed(1).padStart(4,'0')};
const fx=n=>(+n).toFixed(3);

/* ---------- WAV + DSP ---------- */
function parseWav(buf){
  const dv=new DataView(buf);if(dv.getUint32(0,false)!==0x52494646)throw new Error('Not a WAV file');
  let p=12,fmt=null,data=null;
  while(p+8<=dv.byteLength){const id=String.fromCharCode(dv.getUint8(p),dv.getUint8(p+1),dv.getUint8(p+2),dv.getUint8(p+3));const sz=dv.getUint32(p+4,true);
    if(id==='fmt ')fmt={ch:dv.getUint16(p+10,true),rate:dv.getUint32(p+12,true),bits:dv.getUint16(p+22,true)};
    if(id==='data'){data={off:p+8,len:Math.min(sz,dv.byteLength-p-8)};break}
    p+=8+sz+(sz&1)}
  if(!fmt||!data||fmt.bits!==16)throw new Error('Unexpected WAV format — use the prepare file to make it');
  const n=Math.floor(data.len/2/fmt.ch);const out=new Float32Array(n);const s16=new Int16Array(buf,data.off,n*fmt.ch);
  for(let i=0;i<n;i++)out[i]=s16[i*fmt.ch]/32768;
  return {rate:fmt.rate,x:out};
}
function fftInPlace(re,im,inv){
  const n=re.length;for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]]}}
  for(let len=2;len<=n;len<<=1){const ang=2*Math.PI/len*(inv?1:-1),wr=Math.cos(ang),wi=Math.sin(ang);
    for(let i=0;i<n;i+=len){let cr=1,ci=0;for(let k=0;k<len/2;k++){const a=i+k,b=a+len/2;const tr=re[b]*cr-im[b]*ci,ti=re[b]*ci+im[b]*cr;re[b]=re[a]-tr;im[b]=im[a]-ti;re[a]+=tr;im[a]+=ti;const nr=cr*wr-ci*wi;ci=cr*wi+ci*wr;cr=nr}}}
  if(inv)for(let i=0;i<n;i++){re[i]/=n;im[i]/=n}
}
/* r[k] = sum a[n]*b[n+k], for k in [kmin,kmax]; returns {lag, val, conf} of the best peak (with sub-sample refinement) */
function xcorrPeak(a,b,kmin,kmax){
  let N=1;while(N<a.length+b.length)N<<=1;
  const ar=new Float64Array(N),ai=new Float64Array(N),br=new Float64Array(N),bi=new Float64Array(N);
  ar.set(a);br.set(b);fftInPlace(ar,ai,false);fftInPlace(br,bi,false);
  for(let i=0;i<N;i++){const r=ar[i]*br[i]+ai[i]*bi[i],im=ar[i]*bi[i]-ai[i]*br[i];ar[i]=r;ai[i]=im}
  fftInPlace(ar,ai,true);
  const at=k=>ar[(k%N+N)%N];
  let best=-Infinity,bk=0,sum=0,sum2=0,cnt=0;
  for(let k=kmin;k<=kmax;k++){const v=at(k);sum+=v;sum2+=v*v;cnt++;if(v>best){best=v;bk=k}}
  const mean=sum/cnt,sd=Math.sqrt(Math.max(1e-12,sum2/cnt-mean*mean));
  const y0=at(bk-1),y1=best,y2=at(bk+1),den=y0-2*y1+y2;const frac=den!==0?0.5*(y0-y2)/den:0;
  return {lag:bk+Math.max(-1,Math.min(1,frac)),val:best,conf:(best-mean)/sd};
}
function envelope(x,rate,hop){
  hop=hop||Math.round(rate/100);const n=Math.floor(x.length/hop),e=new Float32Array(n);
  for(let i=0;i<n;i++){let s=0;const o=i*hop;for(let j=0;j<hop;j++){const v=x[o+j];s+=v*v}e[i]=Math.log(1e-6+Math.sqrt(s/hop))}
  // onset strength: positive change vs. half-second local mean
  const out=new Float32Array(n);let acc=0;const W=50;
  for(let i=0;i<n;i++){acc+=e[i];if(i>=W)acc-=e[i-W];const m=acc/Math.min(i+1,W);out[i]=Math.max(0,e[i]-m)}
  return out;
}
function window16(x,rate,startSec,lenSec){const s=Math.max(0,Math.round(startSec*rate)),e=Math.min(x.length,s+Math.round(lenSec*rate));return {x:x.subarray(s,e),start:s/rate}}
/* audio time = a + b * video time */
async function computeSync(onStatus){
  const V=STU.wavV,A=STU.wavA;if(!V||!A)throw new Error('Load both prepared sound files first.');
  onStatus('Finding the rough offset…');await sleep(30);
  const ev=envelope(V.x,V.rate),ea=envelope(A.x,A.rate);
  const coarse=xcorrPeak(ev,ea,-(ev.length-1),ea.length-1);
  const a0=coarse.lag/100;
  const durV=V.x.length/V.rate;
  const fine=async(tv)=>{onStatus(`Fine-tuning at ${fmtT(tv)}…`);await sleep(20);
    const w=window16(V.x,V.rate,tv-10,20);const wa=window16(A.x,A.rate,w.start+a0-1.5,23);
    const r=xcorrPeak(w.x,wa.x,-Math.round(3*A.rate),Math.round(3*A.rate));
    return {tv:w.start,off:wa.start+r.lag/A.rate-w.start,conf:r.conf}};
  const t1=Math.max(10,Math.min(durV*0.12,durV/2-10)),t2=Math.max(t1+5,Math.min(durV-30,durV*0.88));
  const p1=await fine(t1),p2=durV>60?await fine(t2):p1;
  let b=1,a=p1.off;
  if(p2!==p1&&p2.tv>p1.tv){const slope=(p2.off-p1.off)/(p2.tv-p1.tv);if(Math.abs(slope)<0.0008){b=1+slope;a=p1.off-slope*p1.tv}}
  const conf=Math.min(coarse.conf,p1.conf,p2.conf);
  return {a,b,conf,coarseConf:coarse.conf,points:[p1,p2]};
}

/* ---------- transcription ---------- */
function wavBlob(x,rate,from,to){
  const n=to-from,buf=new ArrayBuffer(44+n*2),dv=new DataView(buf);const w=(o,s)=>{for(let i=0;i<s.length;i++)dv.setUint8(o+i,s.charCodeAt(i))};
  w(0,'RIFF');dv.setUint32(4,36+n*2,true);w(8,'WAVE');w(12,'fmt ');dv.setUint32(16,16,true);dv.setUint16(20,1,true);dv.setUint16(22,1,true);
  dv.setUint32(24,rate,true);dv.setUint32(28,rate*2,true);dv.setUint16(32,2,true);dv.setUint16(34,16,true);w(36,'data');dv.setUint32(40,n*2,true);
  for(let i=0;i<n;i++){const v=Math.max(-1,Math.min(1,x[from+i]));dv.setInt16(44+i*2,v<0?v*32768:v*32767,true)}
  return new Blob([buf],{type:'audio/wav'});
}
function chunkPoints(x,rate,maxSec){
  const pts=[0];let pos=0;const total=x.length;
  while(total-pos>maxSec*rate){
    const target=pos+Math.round((maxSec-8)*rate),lo=target-Math.round(6*rate),hi=Math.min(total-1,target+Math.round(6*rate));
    let best=target,bestE=Infinity;const win=Math.round(0.2*rate);
    for(let p=lo;p+win<hi;p+=Math.round(0.05*rate)){let e=0;for(let j=0;j<win;j+=4)e+=x[p+j]*x[p+j];if(e<bestE){bestE=e;best=p+win/2|0}}
    pts.push(best);pos=best;
  }
  pts.push(total);return pts;
}
async function groqWords(blob,lang,signal){
  const fd=new FormData();fd.append('file',blob,'chunk.wav');fd.append('model','whisper-large-v3');fd.append('response_format','verbose_json');
  fd.append('timestamp_granularities[]','word');fd.append('timestamp_granularities[]','segment');fd.append('temperature','0');if(lang)fd.append('language',lang);
  const r=await fetch(PROVIDERS.groq.url+'/audio/transcriptions',{method:'POST',signal,headers:{'Authorization':'Bearer '+pKey('groq')},body:fd});
  const d=await r.json().catch(()=>({}));if(!r.ok)throw {code:r.status,message:(d.error&&d.error.message)||r.statusText,retryAfter:+(r.headers.get('retry-after')||0)};
  const words=(d.words||[]).map(w=>({w:String(w.word||'').trim(),s:+w.start,e:+w.end})).filter(w=>w.w);
  // put punctuation back from segment text
  for(const sg of d.segments||[]){const toks=String(sg.text||'').trim().split(/\s+/).filter(Boolean);
    const inSeg=words.filter(w=>w.s>=sg.start-0.05&&w.s<sg.end+0.05);
    if(toks.length===inSeg.length) inSeg.forEach((w,i)=>{if(toks[i].replace(/[^\p{L}\p{N}']/gu,'').toLowerCase()===w.w.replace(/[^\p{L}\p{N}']/gu,'').toLowerCase())w.w=toks[i]})}
  if(!words.length&&d.segments) for(const sg of d.segments){const toks=String(sg.text||'').trim().split(/\s+/).filter(Boolean),dt=(sg.end-sg.start)/Math.max(1,toks.length);toks.forEach((t,i)=>words.push({w:t,s:sg.start+i*dt,e:sg.start+(i+1)*dt}))}
  return words;
}
async function geminiWords(blob,lang,signal){
  const b64=await blobToBase64(blob);
  const txt=await gemini([{inline_data:{mime_type:'audio/wav',data:b64}},{text:`Transcribe this audio word for word${lang?` (language: ${lang})`:''}. Do not summarise or correct. Reply with only JSON: {"segments":[{"start":0.0,"end":4.2,"text":"..."}]} using seconds from the start of this clip, one segment per sentence.`}],{json:true,signal,maxTokens:60000});
  const d=parseJSON(txt);const out=[];
  for(const sg of (d.segments||d||[])){const toks=String(sg.text||'').trim().split(/\s+/).filter(Boolean),s=+sg.start,e=+sg.end;if(!toks.length||!(e>s))continue;const dt=(e-s)/toks.length;toks.forEach((t,i)=>out.push({w:t,s:s+i*dt,e:s+(i+1)*dt}))}
  return out;
}
async function transcribeStudio(onStatus,signal){
  const src=STU.settings.separate&&STU.wavA?STU.wavA:STU.wavV;if(!src)throw new Error('Load the prepared sound files first.');
  const useGroq=!!pKey('groq')&&!(cooled.groq>Date.now());const useGem=!!pKey('gemini');
  if(!useGroq&&!useGem)throw new Error('Add a Groq key (best, free) or a Gemini key in Setup first.');
  const pts=chunkPoints(src.x,src.rate,useGroq?590:290);const all=[];
  for(let i=0;i<pts.length-1;i++){
    const from=pts[i],to=pts[i+1],off=from/src.rate;const blob=wavBlob(src.x,src.rate,from,to);
    let words=null,tries=0;
    while(!words){
      onStatus(`Transcribing part ${i+1} of ${pts.length-1}${useGroq?' with Groq Whisper':' with Gemini'}…`);
      try{words=useGroq?await groqWords(blob,STU.settings.lang,signal):await geminiWords(blob,STU.settings.lang,signal)}
      catch(e){if(e&&e.name==='AbortError')throw e;tries++;
        if(e&&e.code===429&&tries<6){const w=Math.min(90,e.retryAfter||30);for(let s=w;s>0;s--){onStatus(`Free-tier limit — continuing in ${s}s…`);await sleep(1000)}continue}
        if(useGroq&&useGem&&tries>=2){onStatus('Groq failed — using Gemini for this part…');try{words=await geminiWords(blob,STU.settings.lang,signal);break}catch(e2){throw e2}}
        if(tries>=3)throw e;await sleep(3000)}
    }
    for(const w of words)all.push({w:w.w,s:w.s+off,e:w.e+off});
  }
  // to video timeline
  const {a,b}=STU.sync||{a:0,b:1};const map=t=>(STU.settings.separate&&STU.wavA)?(t-a)/b:t;
  STU.words=all.map(w=>({w:w.w,s:map(w.s),e:map(w.e)})).filter(w=>w.e>0&&w.s<STU.dur+1);
  STU.removed={};STU.transcribed=true;autoMarks();await stuSave();
}

/* ---------- edit model ---------- */
const isFiller=w=>FILLERS.has(w.w.toLowerCase().replace(/[^a-z]/g,''));
function autoMarks(){
  for(const k of Object.keys(STU.removed))if(STU.removed[k]==='auto')delete STU.removed[k];
  if(STU.settings.fillers)STU.words.forEach((w,i)=>{if(isFiller(w)&&!STU.removed[i])STU.removed[i]='auto'});
}
function keepSegments(){
  const W=STU.words,D=STU.dur||((W.length?W[W.length-1].e:0)+1),cuts=[];
  const gapMid=(i)=>{const p=W[i-1],n=W[i];return p?((p.e+n.s)/2):Math.max(0,n.s-0.15)};
  for(let i=0;i<W.length;i++){if(!STU.removed[i])continue;let j=i;while(j+1<W.length&&STU.removed[j+1])j++;
    const s=i>0?Math.min(gapMid(i),W[i].s):Math.max(0,W[i].s-0.1),e=j+1<W.length?Math.max((W[j].e+W[j+1].s)/2,W[j].e):Math.min(D,W[j].e+0.15);cuts.push([s,e]);i=j}
  if(STU.settings.pauses){const mp=Math.max(0.4,+STU.settings.maxPause||1);let prev=null;
    for(let i=0;i<W.length;i++){if(STU.removed[i])continue;if(prev!==null){const g=W[i].s-W[prev].e;if(g>mp)cuts.push([W[prev].e+mp/2,W[i].s-mp/2])}prev=i}}
  if(STU.settings.trimEnds&&W.length){const first=W.findIndex((w,i)=>!STU.removed[i]);let last=W.length-1;while(last>=0&&STU.removed[last])last--;
    if(first>=0){if(W[first].s>0.8)cuts.push([0,W[first].s-0.5]);if(D-W[last].e>0.8)cuts.push([W[last].e+0.5,D])}}
  cuts.sort((x,y)=>x[0]-y[0]);const merged=[];
  for(const c of cuts){if(c[1]-c[0]<0.08)continue;const m=merged[merged.length-1];if(m&&c[0]<=m[1]+0.05)m[1]=Math.max(m[1],c[1]);else merged.push([...c])}
  const keep=[];let t=0;for(const c of merged){if(c[0]-t>0.2)keep.push([t,c[0]]);t=Math.max(t,c[1])}if(D-t>0.2)keep.push([t,D]);
  return keep;
}
function clipSegs(segs,s,e){const out=[];for(const [a,b] of segs){const x=Math.max(a,s),y=Math.min(b,e);if(y-x>0.15)out.push([x,y])}return out}
function mapper(segs){const starts=[];let acc=0;for(const [a,b] of segs){starts.push(acc);acc+=b-a}
  return {total:acc,map:t=>{for(let i=0;i<segs.length;i++){if(t>=segs[i][0]-1e-6&&t<=segs[i][1]+1e-6)return starts[i]+(t-segs[i][0])}return null}}}
function captionChunks(segs,maxWords,maxChars){
  const m=mapper(segs),out=[];let cur=[];
  const flush=()=>{if(!cur.length)return;const s=m.map(cur[0].s),e=m.map(cur[cur.length-1].e);if(s!=null&&e!=null&&e>s)out.push({s,e:Math.max(e,s+0.4),t:cur.map(w=>w.w).join(' ')});cur=[]};
  STU.words.forEach((w,i)=>{if(STU.removed[i])return;const ms=m.map(w.s),me=m.map(w.e);if(ms==null||me==null){flush();return}
    const prev=cur[cur.length-1];if(prev&&(w.s-prev.e>0.7||cur.length>=maxWords||(cur.map(x=>x.w).join(' ').length+w.w.length)>maxChars))flush();
    cur.push(w);if(/[.?!]$/.test(w.w))flush()});
  flush();for(let i=0;i<out.length-1;i++)if(out[i].e>out[i+1].s)out[i].e=out[i+1].s;return out;
}
const srtT=t=>{const ms=Math.round(t*1000),h=Math.floor(ms/3600000),m=Math.floor(ms%3600000/60000),s=Math.floor(ms%60000/1000);return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`};
function makeSrt(segs){return captionChunks(segs,10,60).map((c,i)=>`${i+1}\n${srtT(c.s)} --> ${srtT(c.e)}\n${c.t}\n`).join('\n')}
const assT=t=>{const cs=Math.round(t*100),h=Math.floor(cs/360000),m=Math.floor(cs%360000/6000),s=Math.floor(cs%6000/100);return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(cs%100).padStart(2,'0')}`};
function makeAss(segs){
  const head=`[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\nWrapStyle: 0\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Arial,74,&H00FFFFFF,&H00FFFFFF,&H00141414,&H96000000,-1,0,0,0,100,100,0,0,1,5,2,2,90,90,560,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
  return head+captionChunks(segs,5,28).map(c=>`Dialogue: 0,${assT(c.s)},${assT(c.e)},Default,,0,0,0,,${c.t.replace(/[{}\\]/g,'')}`).join('\n')+'\n';
}

/* ---------- scripts for the user's computer ---------- */
const OUT='studio_out';
function isHdr(){const v=(STU.info&&STU.info.streams||[]).find(s=>s.codec_type==='video');return !!(v&&/arib-std-b67|smpte2084/.test(v.color_transfer||''))}
function videoFps(){const v=(STU.info&&STU.info.streams||[]).find(s=>s.codec_type==='video');const r=(v&&(v.avg_frame_rate||v.r_frame_rate)||'30/1').split('/');const f=(+r[0])/(+r[1]||1);return f>0&&f<121?(Math.abs(f-Math.round(f))<0.02?Math.round(f):+f.toFixed(3)):30}
// fixed processing delay of the denoisers (measured): afftdn 25 ms, arnndn 10 ms — removed again so lips stay in sync
function cleanLatency(){const p=STU.settings.clean;return p==='strong'?0.035:(p==='light'||p==='standard')?0.025:0}
function cleanChain(){
  const L=cleanLatency();return cleanChainRaw()+(L?`,atrim=start=${L},asetpts=PTS-STARTPTS`:'');
}
function cleanChainRaw(){
  const p=STU.settings.clean;const tail='acompressor=threshold=-21dB:ratio=3:attack=15:release=250:makeup=2,loudnorm=I=-16:TP=-1.5:LRA=11';
  if(p==='light')return 'highpass=f=70,afftdn=nr=8:nf=-45:tn=1,loudnorm=I=-16:TP=-1.5:LRA=11';
  if(p==='strong')return `highpass=f=85,arnndn=m=${OUT}/voice.rnnn:mix=0.85,afftdn=nr=10:nf=-40:tn=1,deesser=i=0.4,${tail}`;
  if(p==='none')return 'loudnorm=I=-16:TP=-1.5:LRA=11';
  return `highpass=f=80,lowpass=f=16000,afftdn=nr=14:nf=-38:tn=1,deesser=i=0.3,${tail}`;
}
function syncChain(){
  if(!(STU.settings.separate&&STU.audioName&&STU.sync))return '';
  const {a,b}=STU.sync||{a:0,b:1};const parts=[];
  if(a>=0)parts.push(`atrim=start=${fx(a)},asetpts=PTS-STARTPTS`);else parts.push(`adelay=${Math.round(-a*1000)}:all=1`);
  if(Math.abs(b-1)>2e-6)parts.push(`aresample=48000,asetrate=${Math.round(48000*b)},aresample=48000`); // exact speed correction (pitch change far below hearing)
  return parts.join(',')+',';
}
function vcodec(kind){
  const e=STU.settings.enc,full=kind==='full';
  if(e==='mac')return `-c:v h264_videotoolbox -b:v ${full?'40M':'12M'} -allow_sw 1`;
  if(e==='nvidia')return `-c:v h264_nvenc -preset p5 -rc vbr -cq ${full?20:19} -b:v 0`;
  if(e==='intel')return `-c:v h264_qsv -global_quality ${full?22:21}`;
  if(e==='amd')return `-c:v h264_amf -quality quality -rc cqp -qp_i ${full?20:19} -qp_p ${full?22:21}`;
  return `-c:v libx264 -preset ${full?'veryfast':'medium'} -crf ${full?20:19}`;
}
function vfilter(kind){
  const f=[];if(isHdr())f.push('zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv');
  if(kind==='reel'){const h=STU.settings.reelRes==='720'?1280:1920,w=h*9/16;f.push(`scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`)}
  else if(STU.settings.res!=='orig'){const s=+STU.settings.res;f.push(`scale=w='if(gt(iw,ih),-2,${s})':h='if(gt(iw,ih),${s},-2)'`)}
  f.push('format=yuv420p');return f.join(',');
}
function safeName(t){return String(t||'').replace(/[\\/:*?"<>|%!^&$`]/g,'').replace(/\s+/g,' ').trim().slice(0,60)||'Reel'}
function buildScript(os,kind){
  const win=os==='win',L=[],q=s=>`"${s}"`,P=s=>win?s.replace(/\//g,'\\'):s;
  const V=STU.videoName,A=(STU.settings.separate&&STU.audioName)?STU.audioName:STU.videoName;
  const say=t=>L.push(win?`echo ${t.replace(/[<>|&]/g,'')}`:`echo "${t.replace(/"/g,'')}"`);
  const mk=d=>L.push(win?`if not exist ${P(d)} mkdir ${P(d)}`:`mkdir -p "${d}"`);
  const ff='ffmpeg -hide_banner -loglevel error -stats -y';
  if(win){L.push('@echo off','chcp 65001 >nul','cd /d "%~dp0"','where ffmpeg >nul 2>nul || (echo ffmpeg is not installed. Open the Studio tab and follow "Install ffmpeg". & pause & exit /b 1)')}
  else{L.push('#!/bin/bash','cd "$(dirname "$0")" || exit 1','command -v ffmpeg >/dev/null || { echo "ffmpeg is not installed. Open the Studio tab and follow Install ffmpeg."; read -r -p "Press Enter to close"; exit 1; }','set -e')}
  const Vs=V.replace(/[&()<>|^%!]/g,'');
  if(win){L.push(`if not exist ${q(V)} if exist ${q('..\\'+V)} (`,`  if exist ${OUT} xcopy /e /i /y ${OUT} ..\\${OUT} >nul`,`  if exist *.srt copy /y *.srt .. >nul`,`  cd ..`,`)`);
    L.push(`if not exist ${q(V)} (`,`  echo Could not find ${Vs} here. Put these files in the same folder as your video.`,`  pause`,`  exit /b 1`,`)`)}
  else{L.push(`if [ ! -f ${q(V)} ] && [ -f ${q('../'+V)} ]; then mkdir -p ../${OUT}; [ -d ${OUT} ] && cp -R ${OUT}/. ../${OUT}/; cp ./*.srt .. 2>/dev/null || true; cd ..; fi`);
    L.push(`[ -f ${q(V)} ] || { echo "Could not find ${V} here. Put these files in the same folder as your video."; read -r -p "Press Enter"; exit 1; }`)}
  mk(OUT);
  if(kind==='prepare'){
    say('Step 1 of 2: reading the sound from your video (a few minutes for a long video)...');
    L.push(`${ff} -i ${q(V)} -vn -ac 1 -ar 16000 -c:a pcm_s16le ${q(OUT+'/video_16k.wav')}`);
    if(STU.settings.separate&&STU.audioName){L.push(win?`if not exist ${q(A)} (echo Could not find ${A.replace(/[&()<>|^%!]/g,'')} & pause & exit /b 1)`:`[ -f ${q(A)} ] || { echo "Could not find ${A}"; exit 1; }`);
      say('Step 2 of 2: reading your separate audio...');L.push(`${ff} -i ${q(A)} -vn -ac 1 -ar 16000 -c:a pcm_s16le ${q(OUT+'/audio_16k.wav')}`)}
    L.push(`ffprobe -v error -show_streams -show_format -of json ${q(V)} > ${q(P(OUT+'/video_info.json'))}`);
    if(STU.settings.proxy){say('Making a small preview copy (this can take a while)...');L.push(`${ff} -i ${q(V)} -vf "scale=w='if(gt(iw,ih),-2,540)':h='if(gt(iw,ih),540,-2)',format=yuv420p" -c:v libx264 -preset veryfast -crf 30 -c:a aac -b:a 96k ${q(OUT+'/preview.mp4')}`)}
    say('Done! In the Studio tab press "Load prepared files" and choose the files in the studio_out folder.');
  }else{
    const keep=keepSegments();if(!keep.length)throw new Error('Nothing left to render — everything is cut.');
    const fps=videoFps(),afade=d=>`afade=t=in:d=0.012,afade=t=out:st=${fx(Math.max(0,d-0.012))}:d=0.012`;
    if(STU.settings.clean==='strong'){L.push(win?`if not exist ${P(OUT+'/voice.rnnn')} curl -sL -o ${P(OUT+'/voice.rnnn')} https://raw.githubusercontent.com/GregorR/rnnoise-models/master/somnolent-hogwash-2018-09-01/sh.rnnn`:`[ -f "${OUT}/voice.rnnn" ] || curl -sL -o "${OUT}/voice.rnnn" https://raw.githubusercontent.com/GregorR/rnnoise-models/master/somnolent-hogwash-2018-09-01/sh.rnnn`)}
    say('Cleaning and syncing the audio...');
    L.push(`${ff} -i ${q(A)} -vn -af "${syncChain()}${cleanChain()}" -ar 48000 -ac 2 -c:a pcm_s16le ${q(OUT+'/clean_audio.wav')}`);
    const renderSet=(name,segs,kindV,label)=>{
      const dir=`${OUT}/${name}`;mk(dir);const list=[];
      segs.forEach(([s,e],i)=>{const d=e-s,f=`${dir}/part_${String(i+1).padStart(4,'0')}.mp4`;list.push(`file 'part_${String(i+1).padStart(4,'0')}.mp4'`);
        say(`${label}: part ${i+1} of ${segs.length}`);
        L.push(`${ff} -ss ${fx(s)} -i ${q(V)} -ss ${fx(s)} -i ${q(OUT+'/clean_audio.wav')} -t ${fx(d)} -map 0:v:0 -map 1:a:0 -vf "${vfilter(kindV)}" -r ${fps} ${vcodec(kindV)} -af "${afade(d)}" -c:a aac -b:a 192k -ar 48000 ${q(f)}`)});
      const listFile=`${dir}/list.txt`;
      if(win){L.push(`type nul > ${q(P(listFile))}`);list.forEach(l=>L.push(`echo ${l}>> ${q(P(listFile))}`))}else{L.push(`cat > ${q(listFile)} <<'LIST'`,...list,'LIST')}
      return listFile;
    };
    // full edited video + podcast audio
    say('Making the full edited video...');
    const fullList=renderSet('full',keep,'full','Full video');
    L.push(`${ff} -f concat -safe 0 -i ${q(fullList)} -c copy -movflags +faststart ${q('Edited - full video.mp4')}`);
    say('Making the full edited audio (podcast)...');
    L.push(`${ff} -i ${q('Edited - full video.mp4')} -vn -c:a libmp3lame -b:a 192k ${q('Edited - full audio.mp3')}`);
    // reels
    STU.reels.forEach((r,ri)=>{
      const segs=clipSegs(keep,r.start,r.end);if(!segs.length)return;const nm=`Reel ${String(ri+1).padStart(2,'0')} - ${safeName(r.title)}`;
      say(`Making ${nm}...`);const lf=renderSet(`reel_${ri+1}`,segs,'reel',`Reel ${ri+1}`);
      if(STU.settings.reelCaps){L.push(`${ff} -f concat -safe 0 -i ${q(lf)} -c copy ${q(OUT+`/reel_${ri+1}_raw.mp4`)}`);
        L.push(`${ff} -i ${q(OUT+`/reel_${ri+1}_raw.mp4`)} -vf "subtitles=${OUT}/reel_${ri+1}.ass" ${vcodec('reel')} -c:a copy -movflags +faststart ${q(nm+'.mp4')}`)}
      else L.push(`${ff} -f concat -safe 0 -i ${q(lf)} -c copy -movflags +faststart ${q(nm+'.mp4')}`);
    });
    say('All done! Your files are in this folder.');
  }
  if(win){for(let i=0;i<L.length;i++)if(/^(ffmpeg|ffprobe) /.test(L[i]))L[i]+=' || goto fail';L.push('echo.','pause','exit /b 0',':fail','echo.','echo Something went wrong above. Please send a screenshot of this window.','pause','exit /b 1')}
  else L.push('read -r -p "Press Enter to close"');
  return L.join(win?'\r\n':'\n')+(win?'\r\n':'\n');
}
async function downloadRender(os){
  const keep=keepSegments();const files=[];
  files.push({name:os==='win'?'2-render.bat':'2-render.command',data:buildScript(os,'render')});
  if(STU.settings.reelCaps)STU.reels.forEach((r,i)=>{const segs=clipSegs(keep,r.start,r.end);if(segs.length)files.push({name:`${OUT}/reel_${i+1}.ass`,data:makeAss(segs)})});
  files.push({name:'Edited - full video.srt',data:makeSrt(keep)});
  if(!window.JSZip){throw new Error('The zip tool did not load. Refresh and try again.')}
  const zip=new JSZip();files.forEach(f=>zip.file(f.name,f.data));
  zip.file('README - how to render.txt',`1. Unzip into the SAME folder as ${STU.videoName}.\n2. ${os==='win'?'Double-click 2-render.bat':'Open Terminal, type "bash " (with a space), drag 2-render.command into the window and press Enter'}.\n3. Leave it running. When it says "All done", your edited video, podcast audio and reels are in that folder.\n`);
  saveBlob(await zip.generateAsync({type:'blob'}),`studio-render-${os==='win'?'windows':'mac'}.zip`);
}

/* ---------- UI ---------- */
function stuRenderInfo(){
  const v=(STU.info&&STU.info.streams||[]).find(s=>s.codec_type==='video');
  const parts=[];if(STU.videoName)parts.push(`Video: ${STU.videoName}`);if(STU.settings.separate&&STU.audioName)parts.push(`Audio: ${STU.audioName}`);
  if(v)parts.push(`${v.width}×${v.height}, ${videoFps()} fps, ${v.codec_name}${isHdr()?', HDR (will be converted for normal screens)':''}`);
  if(STU.dur)parts.push(`length ${fmtT(STU.dur)}`);
  $('#stuInfo').textContent=parts.join(' · ');
  $('#stuAudioRow').hidden=!STU.settings.separate;
  const s=STU.sync;$('#stuSyncOut').textContent=s?`Offset ${(s.a*1000).toFixed(0)} ms, drift ${((s.b-1)*1e6).toFixed(0)} ppm${s.conf<4?' — low confidence: check lip sync and adjust below':' — confident match'}`:'';
  if(s)$('#stuOffset').value=Math.round(s.a*1000);
  ['clean','res','enc','reelRes','lang'].forEach(k=>{const el=$('#stu_'+k);if(el)el.value=STU.settings[k]});
  ['fillers','pauses','trimEnds','reelCaps','proxy','separate'].forEach(k=>{const el=$('#stu_'+k);if(el)el.checked=!!STU.settings[k]});
  const el=$('#stu_maxPause');if(el)el.value=STU.settings.maxPause;
}
function stuRenderTranscript(){
  const box=$('#stuText');if(!STU.words.length){box.innerHTML='<p class="status">No transcript yet.</p>';stuStats();return}
  let html='',para=[];const flush=()=>{if(para.length)html+=`<p><span class="stu-time">${fmtT(STU.words[para[0]].s)}</span> ${para.map(i=>`<span data-i="${i}" class="stu-w${STU.removed[i]?' cut':''}${isFiller(STU.words[i])?' filler':''}">${esc(STU.words[i].w)}</span>`).join(' ')}</p>`;para=[]};
  STU.words.forEach((w,i)=>{const prev=STU.words[i-1];if(prev&&(w.s-prev.e>1.5||(para.length>45&&/[.?!]$/.test(prev.w))))flush();para.push(i)});flush();
  box.innerHTML=html;stuStats();
}
function stuStats(){
  if(!STU.words.length){$('#stuStats').textContent='';return}
  const keep=keepSegments(),tot=keep.reduce((a,[s,e])=>a+e-s,0);
  $('#stuStats').textContent=`Edited length ${fmtT(tot)} (from ${fmtT(STU.dur)}) · ${keep.length} parts · ${Object.keys(STU.removed).length} words removed`;
  $('#stuReels').innerHTML=STU.reels.map((r,i)=>{const segs=clipSegs(keep,r.start,r.end),d=segs.reduce((a,[s,e])=>a+e-s,0);
    return `<div class="item"><div class="row"><label class="f" style="margin:0"><span>Reel ${i+1} title</span><input data-rtitle="${i}" value="${esc(r.title||'')}"></label>
      <div class="status" style="align-self:end">${fmtT(r.start)} – ${fmtT(r.end)} · ${d.toFixed(0)} s${d>90?' (long for a Reel)':''}</div></div>
      ${r.why?`<p class="hint" style="margin:6px 0 0">${esc(r.why)}</p>`:''}
      <div class="acts" style="margin-top:6px"><button class="btn small" data-rplay="${i}">▶ Play</button><button class="btn small" data-rdel="${i}">Remove</button></div></div>`}).join('')||'<p class="status">No reels yet.</p>';
}
function selectedRange(){
  const sel=window.getSelection();if(!sel||sel.isCollapsed)return null;
  const a=(sel.anchorNode&&(sel.anchorNode.nodeType===1?sel.anchorNode:sel.anchorNode.parentElement)).closest('[data-i]'),b=(sel.focusNode&&(sel.focusNode.nodeType===1?sel.focusNode:sel.focusNode.parentElement)).closest('[data-i]');
  if(!a||!b)return null;const x=+a.dataset.i,y=+b.dataset.i;return [Math.min(x,y),Math.max(x,y)];
}
let stuCtl=null,playEdited=false;
function stuVideo(){return $('#stuVideo')}
function wireStudio(){
  $('#stu_separate').addEventListener('change',e=>{STU.settings.separate=e.target.checked;stuSave();stuRenderInfo()});
  $('#stuVideoFile').addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;STU.videoName=f.name;STU.videoFile=f;stuVideo().src=URL.createObjectURL(f);stuSave();stuRenderInfo()});
  $('#stuAudioFile').addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;STU.audioName=f.name;stuSave();stuRenderInfo()});
  stuVideo().addEventListener('error',()=>stuSay('#stuPrepStatus','Your browser cannot play this video directly. Tick "Make a small preview copy", download the prepare file again and run it, then load preview.mp4.'));
  stuVideo().addEventListener('loadedmetadata',()=>{if(!STU.dur&&isFinite(stuVideo().duration))STU.dur=stuVideo().duration});
  ['clean','res','enc','reelRes','lang'].forEach(k=>$('#stu_'+k).addEventListener('change',e=>{STU.settings[k]=e.target.value;stuSave()}));
  ['fillers','pauses','trimEnds','reelCaps','proxy'].forEach(k=>$('#stu_'+k).addEventListener('change',e=>{STU.settings[k]=e.target.checked;if(k==='fillers')autoMarks();stuSave();stuRenderTranscript()}));
  $('#stu_maxPause').addEventListener('change',e=>{STU.settings.maxPause=+e.target.value||1;stuSave();stuStats()});
  $('#stuPrepWin').addEventListener('click',()=>stuPrep('win'));$('#stuPrepMac').addEventListener('click',()=>stuPrep('mac'));
  $('#stuLoad').addEventListener('change',async e=>{
    const files=[...e.target.files];if(!files.length)return;stuSay('#stuLoadStatus','Reading…');
    try{for(const f of files){const n=f.name.toLowerCase();
      if(n.endsWith('video_16k.wav'))STU.wavV=parseWav(await f.arrayBuffer());
      else if(n.endsWith('audio_16k.wav'))STU.wavA=parseWav(await f.arrayBuffer());
      else if(n.endsWith('.json'))STU.info=JSON.parse(await f.text());
      else if(n.endsWith('preview.mp4')){STU.proxyFile=f;stuVideo().src=URL.createObjectURL(f)}}
      if(STU.wavV)STU.dur=STU.wavV.x.length/STU.wavV.rate;else if(STU.info&&STU.info.format)STU.dur=+STU.info.format.duration;
      const miss=[];if(!STU.wavV)miss.push('video_16k.wav');if(STU.settings.separate&&!STU.wavA)miss.push('audio_16k.wav');if(!STU.info)miss.push('video_info.json');
      stuSay('#stuLoadStatus',miss.length?`Loaded. Still missing: ${miss.join(', ')}.`:'All prepared files loaded.');await stuSave();stuRenderInfo();
    }catch(err){stuSay('#stuLoadStatus',err.message)}e.target.value=''});
  $('#stuSync').addEventListener('click',async()=>{
    try{STU.sync=await computeSync(t=>stuSay('#stuSyncOut',t));await stuSave();stuRenderInfo()}catch(e){stuSay('#stuSyncOut',e.message)}});
  $('#stuOffset').addEventListener('change',e=>{STU.sync={...(STU.sync||{b:1,conf:99}),a:(+e.target.value||0)/1000};stuSave();stuRenderInfo()});
  $('#stuTranscribe').addEventListener('click',async()=>{
    if(STU.settings.separate&&STU.wavA&&!STU.sync){stuSay('#stuTxStatus','Press "Find sync automatically" first.');return}
    if(STU.words.length&&!confirm('Transcribe again? Your current edits will be lost.'))return;
    stuCtl=new AbortController();$('#stuTranscribe').disabled=true;
    try{await transcribeStudio(t=>stuSay('#stuTxStatus',t),stuCtl.signal);stuSay('#stuTxStatus',`Done: ${STU.words.length.toLocaleString()} words.`);stuRenderTranscript()}
    catch(e){stuSay('#stuTxStatus',e.name==='AbortError'?'Stopped.':errMsg(e))}finally{$('#stuTranscribe').disabled=false;stuCtl=null}});
  $('#stuText').addEventListener('click',e=>{const w=e.target.closest('[data-i]');if(!w||!window.getSelection().isCollapsed)return;const v=stuVideo();if(v.src){v.currentTime=Math.max(0,STU.words[+w.dataset.i].s-0.2)}});
  const mark=(val)=>{const r=selectedRange();if(!r){alert('First select some words in the transcript with your mouse.');return}for(let i=r[0];i<=r[1];i++){if(val)STU.removed[i]='user';else delete STU.removed[i]}window.getSelection().removeAllRanges();stuSave();stuRenderTranscript()};
  $('#stuCut').addEventListener('click',()=>mark(true));$('#stuRestore').addEventListener('click',()=>mark(false));
  $('#stuMakeReel').addEventListener('click',()=>{const r=selectedRange();if(!r){alert('Select the words for the reel first.');return}
    STU.reels.push({title:STU.words.slice(r[0],r[0]+6).map(w=>w.w).join(' '),start:Math.max(0,STU.words[r[0]].s-0.15),end:STU.words[r[1]].e+0.25});window.getSelection().removeAllRanges();stuSave();stuStats()});
  $('#stuReels').addEventListener('input',e=>{const i=e.target.dataset.rtitle;if(i!=null){STU.reels[+i].title=e.target.value;stuSave()}});
  $('#stuReels').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
    if(b.dataset.rdel!=null){STU.reels.splice(+b.dataset.rdel,1);stuSave();stuStats()}
    if(b.dataset.rplay!=null){const r=STU.reels[+b.dataset.rplay],v=stuVideo();if(!v.src){alert('Choose your video in step 1 to preview.');return}playEdited=true;$('#stuPlayEdited').checked=true;v.currentTime=r.start;v.play();
      const stop=()=>{if(v.currentTime>=r.end){v.pause();v.removeEventListener('timeupdate',stop)}};v.addEventListener('timeupdate',stop)}});
  $('#stuPlayEdited').addEventListener('change',e=>{playEdited=e.target.checked});
  stuVideo().addEventListener('timeupdate',()=>{if(!playEdited||!STU.words.length)return;const v=stuVideo(),t=v.currentTime,keep=keepSegments();
    if(!keep.some(([s,e])=>t>=s-0.05&&t<e)){const next=keep.find(([s])=>s>t);if(next)v.currentTime=next[0];else v.pause()}});
  $('#stuSuggest').addEventListener('click',stuSuggest);
  $('#stuRenderWin').addEventListener('click',()=>downloadRender('win').catch(e=>alert(e.message)));
  $('#stuRenderMac').addEventListener('click',()=>downloadRender('mac').catch(e=>alert(e.message)));
  $('#stuSrt').addEventListener('click',()=>saveBlob(new Blob([makeSrt(keepSegments())],{type:'text/plain'}),'Edited - full video.srt'));
  $('#stuCsv').addEventListener('click',()=>{const k=keepSegments();saveBlob(new Blob(['part,start,end,length\n'+k.map(([s,e],i)=>`${i+1},${fmtT(s)},${fmtT(e)},${(e-s).toFixed(2)}`).join('\n')],{type:'text/csv'}),'cut-list.csv')});
  $('#stuText2').addEventListener('click',()=>{const k=keepSegments(),m=mapper(k);saveBlob(new Blob([STU.words.filter((w,i)=>!STU.removed[i]).map(w=>w.w).join(' ')],{type:'text/plain'}),'Edited transcript.txt')});
  $('#stuSaveProj').addEventListener('click',()=>{const {videoFile,proxyFile,wavV,wavA,...rest}=STU;saveBlob(new Blob([JSON.stringify(rest)],{type:'application/json'}),`studio-project-${todayStr()}.json`)});
  $('#stuLoadProj').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{const d=JSON.parse(await f.text());if(!('words' in d))throw 0;STU={...STU,...d,settings:{...STU_DEFAULTS,...(d.settings||{})}};await stuSave();stuRenderInfo();stuRenderTranscript()}catch(err){alert('That is not a Studio project file.')}e.target.value=''});
  $('#stuStop').addEventListener('click',()=>stuCtl&&stuCtl.abort());
}
async function stuPrep(os){
  if(!STU.videoName){alert('Choose your video file first.');return}
  if(STU.settings.separate&&!STU.audioName){alert('Choose your separate audio file, or untick "I recorded the audio separately".');return}
  const zip=new JSZip();zip.file(os==='win'?'1-prepare.bat':'1-prepare.command',buildScript(os,'prepare'));
  zip.file('README - how to prepare.txt',`1. Unzip into the SAME folder as ${STU.videoName}${STU.settings.separate?` and ${STU.audioName}`:''}.\n2. ${os==='win'?'Double-click 1-prepare.bat':'Open Terminal, type "bash " (with a space), drag 1-prepare.command into the window and press Enter'}.\n3. When it says Done, go back to the Studio tab and press "Load prepared files" and choose everything inside the new studio_out folder.\n`);
  saveBlob(await zip.generateAsync({type:'blob'}),`studio-prepare-${os==='win'?'windows':'mac'}.zip`);
}
async function stuSuggest(){
  if(!STU.words.length){stuSay('#stuReelStatus','Transcribe first.');return}
  const lines=[];let cur=[];STU.words.forEach((w,i)=>{if(STU.removed[i])return;cur.push(i);if(/[.?!]$/.test(w.w)||cur.length>40){lines.push(cur);cur=[]}});if(cur.length)lines.push(cur);
  const text=lines.map((l,k)=>`[${k}] (${fmtT(STU.words[l[0]].s)}) ${l.map(i=>STU.words[i].w).join(' ')}`).join('\n');
  const n=Math.max(1,Math.min(15,+$('#stuReelCount').value||5));
  stuSay('#stuReelStatus','Asking AI for the best moments…');
  try{
    const prompt=`Below is the transcript of a recorded spiritual talk (Pranahuti Yoga / Sahaj Marg tradition), split into numbered lines.
Choose the ${n} best moments for Instagram Reels / YouTube Shorts. Each moment must:
- be 25 to 60 seconds long (lines show their start time),
- start at the beginning of a line and end at the end of a line,
- contain one complete, self-contained thought that makes sense without context,
- ideally open with a strong first sentence (a hook).
Do not choose moments that overlap. Reply with only JSON: {"reels":[{"start_line":12,"end_line":18,"title":"short catchy title","why":"one sentence why this works"}]}

TRANSCRIPT:
${text}`;
    const got=await askAny(prompt,{json:true,onStatus:t=>stuSay('#stuReelStatus',t)});
    let arr=parseJSON(got.text);arr=Array.isArray(arr)?arr:(arr.reels||[]);let added=0;
    for(const r of arr){const a=+r.start_line,b=+r.end_line;if(!(a>=0&&b>=a&&b<lines.length))continue;
      const s=STU.words[lines[a][0]].s-0.15,e=STU.words[lines[b][lines[b].length-1]].e+0.25;if(e-s<10||e-s>120)continue;
      STU.reels.push({title:String(r.title||'Reel').slice(0,80),why:String(r.why||'').slice(0,200),start:Math.max(0,s),end:e});added++}
    stuSave();stuStats();stuSay('#stuReelStatus',`Added ${added} reel suggestion${added===1?'':'s'} (with ${PROVIDERS[got.pid].label}). Play them, rename or remove any.`);
  }catch(e){stuSay('#stuReelStatus',errMsg(e))}
}
(async()=>{await stuLoad();wireStudio();stuRenderInfo();stuRenderTranscript()})();


/* ---------- Google account sign-in & synced keys ---------- */
const SECRET_IDS=['gemini','mistral','cerebras','groq','openrouter'];
let secretsTimer=null;
function secretsPush(){if(!SRV.ok)return;clearTimeout(secretsTimer);secretsTimer=setTimeout(async()=>{const body={};SECRET_IDS.forEach(id=>body[id]=pKey(id));try{await api('secrets',{method:'PUT',body:JSON.stringify(body)})}catch(e){}},1500)}
async function secretsPull(){
  try{const d=await api('secrets');let changed=false;
    for(const id of SECRET_IDS){const v=d[id];if(typeof v==='string'&&v&&v!==pKey(id)){try{localStorage.setItem(id==='gemini'?KEY_STORE:'sqc-key-'+id,v)}catch(e){}changed=true}}
    const local=SECRET_IDS.some(id=>pKey(id)&&!d[id]);if(local)secretsPush();
    if(changed&&$('#pane-setup').classList.contains('on'))renderSetup();
  }catch(e){}
}
let gsiClientId='';
async function initAccount(){
  if(location.protocol==='file:')return;
  try{const r=await fetch('/api/config');const c=await r.json();gsiClientId=c.googleClientId||''}catch(e){}
  renderAccount();
  if(!gsiClientId)return;
  await new Promise(res=>{const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.async=true;s.onload=res;s.onerror=res;document.head.appendChild(s)});
  if(!window.google||!google.accounts)return;
  google.accounts.id.initialize({client_id:gsiClientId,callback:onGoogleCredential,auto_select:false,ux_mode:'popup'});
  renderAccount();
}
async function onGoogleCredential(resp){
  $('#acctStatus').textContent='Signing in…';
  try{const r=await fetch('/api/auth/google',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({credential:resp.credential})});const d=await r.json();
    if(!r.ok)throw new Error(d.error||'Sign-in failed');
    try{localStorage.setItem('sqc-session',d.token)}catch(e){}
    SRV.who={email:d.email,name:d.name,owner:d.owner};$('#acctStatus').textContent='';await connectServer(false);
  }catch(e){$('#acctStatus').textContent=e.message}
}
function renderAccount(){
  const box=$('#acctBox');if(!box)return;
  const signed=!!(SRV.token()&&SRV.who);
  $('#acctWho').innerHTML=signed?`Signed in as <strong>${esc(SRV.who.email)}</strong>${SRV.who.owner?' (owner)':''}. Your work and AI keys follow you on any device where you sign in.`:(gsiClientId?'Sign in with Google to keep your work and AI keys on every device.':(location.protocol==='file:'?'':'Google sign-in is not set up on the server yet — use the app password below.'));
  $('#acctOut').hidden=!signed;
  const btn=$('#gsiBtn');btn.innerHTML='';btn.hidden=signed||!gsiClientId;
  if(!signed&&gsiClientId&&window.google&&google.accounts)google.accounts.id.renderButton(btn,{theme:'outline',size:'large',text:'signin_with',shape:'pill'});
  if(signed)setStatus(`Signed in as ${SRV.who.email}`);
}
$('#acctOut').addEventListener('click',async()=>{try{await api('auth/logout',{method:'POST'})}catch(e){}try{localStorage.removeItem('sqc-session')}catch(e){}SRV.who=null;SRV.ok=false;
  if(window.google&&google.accounts)google.accounts.id.disableAutoSelect();renderAccount();srvStatus('Signed out. Your work stays safe in your account.');renderAuto()});


$('#bankImport').addEventListener('change',async e=>{
  const f=e.target.files[0];if(!f)return;
  try{await ensureXLSX();const wb=XLSX.read(await f.arrayBuffer(),{type:'array'});const ws=wb.Sheets['All quotes']||wb.Sheets[wb.SheetNames[0]];
    const rows=XLSX.utils.sheet_to_json(ws,{defval:''});const B=bank();const have=new Set(B.items.map(i=>norm(i.text)));let n=0;
    const byName=nm=>{const m=state.settings.masters.find(x=>x.name.toLowerCase()===String(nm).toLowerCase());return m?m.id:'babuji'};
    for(const r of rows){const t=String(r['Quote']||'').trim();if(!t||have.has(norm(t)))continue;
      const link=String(r['Link (copy)']||'').trim(),cite=String(r['Citation']||''),pg=(cite.match(/pg\s*(\d+)/i)||[])[1];
      const book=String(r['Book']||''),bk=bankBooks().find(b=>b.title===book);
      B.items.push({id:uidGen(),at:Date.now(),text:t,master:byName(r['Master']),book,abbr:bk?bk.abbr:'',chapter:null,chapTitle:String(r['Chapter']||''),url:link.split('#')[0],link,code:String(r['Code']||''),page:pg?+pg:null,pageBook:pg?(cite.replace(/^\(|\s*-\s*pg.*$/g,'')):null,verified:true});
      have.add(norm(t));n++}
    scheduleSave();renderBank();bankStatus(`Restored ${n} quote${n===1?'':'s'} from the Excel file. Total now ${B.items.length}.`);
  }catch(err){bankStatus('Could not read that Excel file: '+err.message)}
  e.target.value='';
});
/* ---------- boot ---------- */
function refreshAll(){fillForm();renderMonth();renderLibrary();renderSetup();renderSources();renderToday()}
(async function boot(){
  try{
    await IDB.open();
    const s=await IDB.get('state'); if(s&&s.settings) state=s;
    for(const k of await IDB.keys()){ if(String(k).startsWith('photo:')) photos[String(k).slice(6)]=await IDB.get(k) }
    setStatus('Saved in this browser');
  }catch(e){storageOK=false;setStatus('Private browsing: nothing will be saved')}
  migrate();
  card={...DEFAULT_STYLE,...clone(state.settings.draft||{})}; if(!card.date) card.date=todayStr();
  $('#monthPick').value=todayStr().slice(0,7);
  document.body.dataset.tab='today';
  bindCardForm();
  refreshAll();
  try{$('#srvPw').value=SRV.pw()}catch(e){}
  initAccount();
  if(SRV.token()||SRV.pw()) connectServer(true); else renderAuto();
  if(navigator.storage&&navigator.storage.persist) navigator.storage.persist().catch(()=>{});
})();
