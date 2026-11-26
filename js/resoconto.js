/* ====== RESOCONTO PER LA VISITA: pagina da stampare o salvare in PDF ======
   Periodo (di solito dall'ultima visita a oggi): calorie registrate e previste, pasti come da piano,
   alimenti scelti e fuori piano, peso e misure, domande per il nutrizionista. */
import{fmtN,fmtD}from'./misure.js';
export function initReport(C){
 const {S,save,esc,$,todayIso,addDays,dateOf,MEALS,plannedOf,dayOf,periods,planTitle,name,MS}=C;
 const fl=iso=>dateOf(iso).toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'});
 const fs=iso=>dateOf(iso).toLocaleDateString('it-IT',{day:'numeric',month:'short'});
 const days=(a,b)=>{const o=[];for(let d=a;d<=b;d=addDays(d,1))o.push(d);return o;};
 const avg=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:0;
 const R=x=>Math.round(x).toLocaleString('it-IT');
 function defRange(){const t=todayIso(),lv=MS.visits().filter(v=>v.d<t).pop();return[lv?addDays(lv.d,1):addDays(t,-27),t];}
 /* stato di un pasto registrato */
 function mealOf(iso,mk){const l=(S.diary[iso]||[]).filter(e=>e.m===mk&&!e.x),comps=(dayOf(iso).meals[mk]||[]);
  if(!comps.length&&!l.length)return null;
  if(l.some(e=>e.skip))return'skip';
  if(comps[0]&&comps[0].free)return l.length?'free':'none';
  const inP=l.some(e=>!e.off),off=l.some(e=>e.off);
  return inP&&off?'plus':inP?'plan':off?'off':'none';}
 function build(from,to){
  const all=days(from,to),rows=all.map(iso=>{const e=(S.diary[iso]||[]).filter(x=>!x.x);return{iso,n:e.length,k:e.reduce((s,x)=>s+(+x.k||0),0),p:plannedOf(iso),e};});
  const reg=rows.filter(r=>r.n);
  const used=[...new Set(all.map(iso=>{let p=null;periods.forEach(e=>{if(e.from<=iso)p=e;});return p&&p.plan;}).filter(Boolean))].map(planTitle);
  /* pasti */
  const ST={plan:'come da piano',plus:'piano + extra',off:'cambiato (fuori piano)',free:'pasto libero',skip:'saltato',none:'non segnato'};
  const mt={};reg.forEach(r=>MEALS.forEach(([mk])=>{const s=mealOf(r.iso,mk);if(!s)return;(mt[mk]=mt[mk]||{})[s]=(mt[mk][s]||0)+1;}));
  const tot={};Object.values(mt).forEach(o=>Object.entries(o).forEach(([s,n])=>tot[s]=(tot[s]||0)+n));const allM=Object.values(tot).reduce((a,b)=>a+b,0);
  /* alimenti */
  const pick={},off={},offL=[];reg.forEach(r=>r.e.forEach(e=>{if(e.skip)return;const mn=(MEALS.find(m=>m[0]===e.m)||[,e.m||''])[1];
   if(e.off){const o=off[e.n]=off[e.n]||{n:e.n,c:0,k:0,q:{},m:new Set()};o.c++;o.k+=+e.k||0;o.m.add(mn);if(+e.q){const u=e.u||'g';o.q[u]=(o.q[u]||0)+(+e.q);}offL.push({iso:r.iso,mn,n:e.n,q:+e.q||0,u:e.u||'g',k:+e.k||0});}
   else{const key=mn+'|'+e.n,o=pick[key]=pick[key]||{n:e.n,m:mn,c:0};o.c++;}}));
  const picks=Object.values(pick).sort((a,b)=>b.c-a.c).slice(0,15),offs=Object.values(off).sort((a,b)=>b.k-a.k);
  /* settimane */
  const wk={};rows.forEach(r=>{const d=dateOf(r.iso),ws=addDays(r.iso,-((d.getDay()+6)%7));(wk[ws]=wk[ws]||[]).push(r);});
  /* peso nel periodo: ultima misura prima o all'inizio, ultima alla fine */
  const ws=MS.weights(),w0=[...ws].reverse().find(w=>w.d<=from)||ws.find(w=>w.d>=from&&w.d<=to),w1=[...ws].reverse().find(w=>w.d<=to);
  const kAvg=avg(reg.map(r=>r.k)),pAvg=avg(reg.map(r=>r.p.t));
  const box=(b,s)=>`<div><b>${b}</b><small>${s}</small></div>`;
  let h=`<header class="rph"><h1>Resoconto per la visita</h1><p><b>${esc(name||'')}</b>${name?' · ':''}dal ${fl(from)} al ${fl(to)} (${all.length} giorni)</p>${used.length?`<p>Piano: ${used.map(esc).join('; ')}</p>`:''}</header>`;
  h+=`<section><h2>In sintesi</h2><div class="rpsum">${box(`${reg.length}/${all.length}`,'giorni registrati nel diario')}${reg.length?box(R(kAvg),'kcal medie al giorno')+box(R(pAvg),'kcal medie previste dal piano')+box(`${allM?Math.round(((tot.plan||0)+(tot.plus||0))/allM*100):0}%`,'pasti come da piano'):''}${w0&&w1&&w1!==w0?box(fmtD(w1.v.peso-w0.v.peso)+' kg',`peso: ${fmtN(w0.v.peso)} → ${fmtN(w1.v.peso)}`):w1?box(fmtN(w1.v.peso)+' kg','ultimo peso, '+fs(w1.d)):''}</div>
   ${reg.length<all.length?`<p class="hint">I giorni senza niente nel diario sono indicati come «non registrato» e non entrano nelle medie.</p>`:''}</section>`;
  if(reg.length){
   /* grafico kcal giorno per giorno */
   const max=Math.max(...rows.map(r=>Math.max(r.k,r.p.t)),500)*1.08,n=rows.length,bw=Math.min(28,560/n),X=i=>40+i*(560/n)+(560/n-bw)/2,Y=k=>10+(1-k/max)*170;
   const ticks=[0,max/2/1.08,max/1.08].map(k=>Math.round(k/100)*100);
   h+=`<section><h2>Calorie giorno per giorno</h2><svg class="rpch" viewBox="0 0 610 210" role="img" aria-label="Calorie registrate e previste">${ticks.map(k=>`<line class="gr" x1="38" x2="602" y1="${Y(k)}" y2="${Y(k)}"/><text x="34" y="${Y(k)+4}" text-anchor="end">${R(k)}</text>`).join('')}
    ${rows.map((r,i)=>r.n?`<rect x="${X(i).toFixed(1)}" y="${Y(r.k).toFixed(1)}" width="${bw.toFixed(1)}" height="${(180-Y(r.k)).toFixed(1)}" class="${r.k-r.p.t>150?'over':''}"><title>${fs(r.iso)}: ${R(r.k)} kcal (previste ${R(r.p.t)})</title></rect>`:`<text class="nr" x="${(X(i)+bw/2).toFixed(1)}" y="176" text-anchor="middle">·</text>`).join('')}
    <polyline class="pl" points="${rows.map((r,i)=>`${(X(i)+bw/2).toFixed(1)},${Y(r.p.t).toFixed(1)}`).join(' ')}"/>
    ${rows.map((r,i)=>n<=16||i%Math.ceil(n/12)===0?`<text class="ax" x="${(X(i)+bw/2).toFixed(1)}" y="198" text-anchor="middle">${dateOf(r.iso).getDate()}/${dateOf(r.iso).getMonth()+1}</text>`:'').join('')}</svg>
    <p class="hint"><span class="rlg b"></span> kcal registrate <span class="rlg o"></span> oltre 150 kcal sopra il previsto <span class="rlg l"></span> previste dal piano · un punto = giorno non registrato</p></section>`;
   h+=`<section><h2>Settimana per settimana</h2><table class="rpt"><thead><tr><th>Settimana</th><th>Giorni registrati</th><th>kcal medie</th><th>Previste</th><th>Differenza</th><th>Fuori piano</th></tr></thead><tbody>${Object.entries(wk).map(([w,rs])=>{const g=rs.filter(r=>r.n),k=avg(g.map(r=>r.k)),p=avg(g.map(r=>r.p.t));
    return`<tr><td>${fs(rs[0].iso)} – ${fs(rs[rs.length-1].iso)}</td><td>${g.length}/${rs.length}</td><td>${g.length?R(k):'–'}</td><td>${g.length?R(p):'–'}</td><td>${g.length?fmtD(Math.round(k-p)):'–'}</td><td>${g.reduce((s,r)=>s+r.e.filter(e=>e.off).length,0)}</td></tr>`;}).join('')}</tbody></table></section>`;
   const cols=['plan','plus','off','free','skip','none'].filter(s=>tot[s]);
   h+=`<section><h2>Pasti</h2><table class="rpt"><thead><tr><th>Pasto</th>${cols.map(s=>`<th>${ST[s]}</th>`).join('')}</tr></thead><tbody>${MEALS.filter(([mk])=>mt[mk]).map(([mk,mn])=>`<tr><td>${esc(mn)}</td>${cols.map(s=>`<td>${mt[mk][s]||''}</td>`).join('')}</tr>`).join('')}</tbody></table>
    <p class="hint">Conteggi sui ${reg.length} giorni registrati. «Piano + extra»: alimenti del piano più qualcosa fuori piano.</p></section>`;
   if(picks.length)h+=`<section><h2>Alimenti del piano scelti più spesso</h2><table class="rpt"><thead><tr><th>Alimento</th><th>Pasto</th><th>Volte</th></tr></thead><tbody>${picks.map(p=>`<tr><td>${esc(p.n)}</td><td>${esc(p.m)}</td><td>${p.c}</td></tr>`).join('')}</tbody></table></section>`;
   const qt=(q,u)=>q?`${fmtN(Math.round(q*10)/10)} ${u}`:'—',fd=iso=>dateOf(iso).toLocaleDateString('it-IT',{weekday:'short',day:'numeric',month:'short'}),offK=offs.reduce((s,o)=>s+o.k,0),rep=offs.filter(o=>o.c>1);
   h+=`<section><h2>Fuori piano</h2>${offL.length?`<table class="rpt"><thead><tr><th>Giorno</th><th>Pasto</th><th>Alimento</th><th>Quantità</th><th>kcal</th></tr></thead><tbody>${offL.map(o=>`<tr><td>${esc(fd(o.iso))}</td><td>${esc(o.mn)}</td><td>${esc(o.n)}</td><td>${qt(o.q,o.u)}</td><td>${R(o.k)}</td></tr>`).join('')}</tbody></table><p class="hint">In tutto ${offL.length} ${offL.length===1?'volta':'volte'} e ${R(offK)} kcal fuori piano, in media ${R(offK/reg.length)} al giorno registrato.</p>${rep.length?`<p class="hint">Ripetuti: ${rep.map(o=>`${esc(o.n)} ${o.c} volte${Object.keys(o.q).length?' ('+Object.entries(o.q).map(([u,q])=>qt(q,u)).join(' + ')+')':''}, ${R(o.k)} kcal`).join('; ')}.</p>`:''}`:'<p>Nessun alimento fuori piano.</p>'}</section>`;
  }
  const vs=MS.visits().filter(v=>v.d<=to);
  if(vs.length)h+=`<section><h2>Misure</h2>${MS.table(vs.slice(-4),{edit:false})}${vs.length>4?'<p class="hint">Ultime 4 visite.</p>':''}</section>`;
  const wp=ws.filter(w=>w.d>=addDays(from,-60)&&w.d<=to);
  if(wp.length>1)h+=`<section><h2>Peso</h2>${MS.wchart(wp)}<p class="hint">Pallini pieni: visite; vuoti: pesate a casa.</p></section>`;
  h+=`<section class="rpn"><h2>Note e domande</h2><textarea id="rpNote" rows="5" placeholder="Scrivi qui cosa vuoi chiedere o raccontare al nutrizionista (fame, sonno, allenamento, pasti difficili…)">${esc(S.repNote||'')}</textarea><div class="rpnp" id="rpNoteP"></div></section>`;
  h+=`<footer class="hint">Creato con La mia dieta il ${fl(todayIso())}. Calorie indicative (banca dati IEO e Open Food Facts).</footer>`;
  return h;}
 function show(from,to){const [a,b]=from?[from,to]:defRange(),el=$('#report');
  el.innerHTML=`<div class="rptool noprint"><label>Dal <input type="date" id="rpFrom" value="${a}" max="${todayIso()}"></label><label>al <input type="date" id="rpTo" value="${b}" max="${todayIso()}"></label><span style="flex:1"></span><button class="btn sm" id="rpPdf">📄 Crea il PDF</button><button class="btn line sm" id="rpPrint">🖨️ Stampa</button><button class="btn line sm" id="rpClose">Chiudi</button></div><article class="rpbody">${build(a,b)}</article>`;
  el.hidden=false;document.documentElement.classList.add('rpopen');el.scrollTop=0;
  const sync=()=>{$('#rpNoteP').textContent=$('#rpNote').value;};sync();
  $('#rpNote').oninput=()=>{S.repNote=$('#rpNote').value;sync();save();};
  const re=()=>{const f=$('#rpFrom').value,t=$('#rpTo').value;if(f&&t&&f<=t)show(f,t);};$('#rpFrom').onchange=re;$('#rpTo').onchange=re;
  $('#rpPrint').onclick=()=>{const o=document.title;document.title=`Resoconto ${name?name+' ':''}${a} ${b}`;window.print();setTimeout(()=>document.title=o,1000);};
  $('#rpPdf').onclick=()=>makePdf(a,b);
  $('#rpClose').onclick=close;}
 /* PDF creato nel telefono (window.print non funziona nell'app installata su iPhone): immagine della pagina divisa in fogli A4 */
 const loadJs=src=>new Promise((ok,ko)=>{if(document.querySelector(`script[data-v="${src}"]`))return ok();const s=document.createElement('script');s.src=src;s.dataset.v=src;s.onload=ok;s.onerror=()=>ko(new Error('Non riesco a caricare '+src));document.head.appendChild(s);});
 let pdfFile=null;
 async function sharePdf(){const f=pdfFile;if(!f)return;
  if(navigator.canShare&&navigator.canShare({files:[f]})){try{await navigator.share({files:[f],title:f.name});return;}catch(e){if(e.name==='AbortError')return;}}
  const u=URL.createObjectURL(f),l=document.createElement('a');l.href=u;l.download=f.name;document.body.appendChild(l);l.click();l.remove();setTimeout(()=>URL.revokeObjectURL(u),60000);}
 async function makePdf(a,b){const btn=$('#rpPdf');
  if(pdfFile&&btn.dataset.ready===a+b){sharePdf();return;}
  btn.disabled=true;btn.textContent='⏳ Preparo il PDF…';let box;
  try{await loadJs('js/vendor/html2canvas-pro.min.js');await loadJs('js/vendor/jspdf.umd.min.js');
   const W=760,PH=Math.floor(W*277/190);
   box=document.createElement('div');box.className='rpbody rpdf';box.innerHTML=$('#report .rpbody').innerHTML;
   const n=box.querySelector('#rpNote');if(n){n.remove();}box.querySelectorAll('[id]').forEach(e=>e.removeAttribute('id'));
   document.body.appendChild(box);
   /* i grafici SVG perdono il foglio di stile: copio i colori negli attributi */
   box.querySelectorAll('svg *').forEach(e=>{const c=getComputedStyle(e);['fill','stroke','stroke-width','stroke-dasharray','opacity','font-size','font-family','font-weight'].forEach(p=>{const v=c.getPropertyValue(p);if(v)e.setAttribute(p,v);});});
   box.querySelectorAll('svg').forEach(s=>{const r=s.getBoundingClientRect();s.setAttribute('width',r.width);s.setAttribute('height',r.height);});
   /* tagli tra un blocco e l'altro, mai a metà di una riga */
   const top0=box.getBoundingClientRect().top,H=box.scrollHeight;
   const cand=[...new Set([...box.querySelectorAll('h2,tr,svg,p,.rpsum,.rph,footer,.mtw,.rpnp')].map(e=>Math.round(e.getBoundingClientRect().top-top0-4)))].sort((x,y)=>x-y);
   const cuts=[0];while(H-cuts[cuts.length-1]>PH){const s=cuts[cuts.length-1],lim=s+PH,c=cand.filter(x=>x>s+PH*.35&&x<=lim).pop();cuts.push(c||lim);}cuts.push(H);
   const cv=await html2canvas(box,{scale:2,backgroundColor:'#ffffff',windowWidth:W,width:W,height:H});
   const {jsPDF}=window.jspdf,doc=new jsPDF({unit:'mm',format:'a4'}),k=cv.width/W;
   for(let i=0;i<cuts.length-1;i++){const h=cuts[i+1]-cuts[i],pc=document.createElement('canvas');pc.width=cv.width;pc.height=Math.ceil(h*k);
    const g=pc.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,pc.width,pc.height);g.drawImage(cv,0,Math.floor(cuts[i]*k),cv.width,pc.height,0,0,cv.width,pc.height);
    if(i)doc.addPage();doc.addImage(pc.toDataURL('image/jpeg',.9),'JPEG',10,10,190,h*190/W);
    doc.setFontSize(8);doc.setTextColor(140);doc.text(`${i+1}/${cuts.length-1}`,200,290,{align:'right'});}
   const nm=`Resoconto ${name?name+' ':''}${a} ${b}.pdf`.replace(/[\/:*?"<>|]/g,'');
   pdfFile=new File([doc.output('blob')],nm,{type:'application/pdf'});
   box.remove();box=null;
   btn.dataset.ready=a+b;btn.textContent='📤 Apri o condividi il PDF';btn.disabled=false;
   await sharePdf();
  }catch(e){console.warn(e);btn.disabled=false;btn.textContent='📄 Crea il PDF';alert('Non riesco a creare il PDF ('+(e&&e.message||e)+'). Riprova con la connessione attiva.');}
  finally{if(box)box.remove();}}
 window.__rpPdf=()=>pdfFile;
 function close(){const el=$('#report');el.hidden=true;el.innerHTML='';document.documentElement.classList.remove('rpopen');}
 return{show,close,build,defRange};
}
