/* ====== MISURE: visite dal nutrizionista (peso, circonferenze, pliche) e pesate a casa ======
   S.meas = {fields:[{k,n,u,g,d}], visits:[{id,d:'AAAA-MM-GG',home?:1,v:{campo:numero}}], gone:[id visita o 'f:'+campo eliminati]}
   g = gruppo (b base, c circonferenze, p pliche, x altro); d = -1 se scendere è un miglioramento, 0 neutro */
export const MF=[
 {k:'alt',n:'Altezza',u:'cm',g:'b',d:0},{k:'peso',n:'Peso',u:'kg',g:'b',d:-1},
 {k:'vs',n:'Vita (più stretta)',u:'cm',g:'c',d:-1},{k:'vl',n:'Addome (più largo)',u:'cm',g:'c',d:-1},{k:'fia',n:'Fianchi',u:'cm',g:'c',d:-1},
 {k:'cos',n:'Coscia',u:'cm',g:'c',d:0},{k:'bra',n:'Braccio',u:'cm',g:'c',d:0},{k:'pet',n:'Petto',u:'cm',g:'c',d:0},
 {k:'ptr',n:'Tricipite',u:'mm',g:'p',d:-1},{k:'psc',n:'Sottoscapolare',u:'mm',g:'p',d:-1},{k:'psi',n:'Sovrailiaca',u:'mm',g:'p',d:-1},{k:'pad',n:'Addominale',u:'mm',g:'p',d:-1},{k:'ppe',n:'Petto',u:'mm',g:'p',d:-1}];
export const GROUPS={b:'Peso e altezza',c:'Circonferenze',p:'Pliche',x:'Altre misure'};
/* parole per riconoscere le righe di una tabella incollata */
const KW=[['alt',/altezz|statura/],['peso',/peso/],['vs',/strett|vita/],['vl',/largo|addom.*circ|circ.*addom|ombelic/],['fia',/fianc/],['cos',/cosc/],['bra',/bracc/],['pet',/^(circ\.?\s*)?(\+\s*)?pett|circ.*pett/],
 ['ptr',/tricip/],['psc',/sottoscap/],['psi',/sovrail/],['pad',/plic.*addom|addominal/],['ppe',/plic.*pett|pettoral/]];
export const num=s=>{if(s==null)return null;const t=String(s).trim().replace(/\s/g,'').replace(/(cm|kg|mm)$/i,'').replace(',','.');return/^-?\d+(\.\d+)?$/.test(t)?+t:null;};
export const fmtN=x=>x==null?'':x.toLocaleString('it-IT',{maximumFractionDigits:1});
export const fmtD=x=>(x>0?'+':x<0?'−':'±')+Math.abs(x).toLocaleString('it-IT',{maximumFractionDigits:1});
export function initMisure(C){
 const {S,save,esc,$,toast,todayIso,dateOf}=C;
 const M=()=>S.meas||{fields:MF.map(f=>({...f})),visits:[],gone:[]};
 const W=()=>{if(!S.meas)S.meas=M();S.meas.gone=S.meas.gone||[];return S.meas;};
 const fields=()=>M().fields;
 const visits=()=>M().visits.filter(v=>!v.home).sort((a,b)=>a.d.localeCompare(b.d));
 const weights=()=>M().visits.filter(v=>v.v&&v.v.peso!=null).sort((a,b)=>a.d.localeCompare(b.d));
 const fd=iso=>dateOf(iso).toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit',year:'2-digit'});
 const fl=iso=>dateOf(iso).toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'});
 const newId=()=>'v'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
 const height=(upTo)=>{const v=visits().filter(x=>!upTo||x.d<=upTo).reverse().find(x=>x.v.alt);return v?v.v.alt:null;};
 const bmi=v=>{const h=v.v.alt||height(v.d)||height();return v.v.peso&&h?v.v.peso/((h/100)**2):null;};
 const pk=()=>fields().filter(f=>f.g==='p').map(f=>f.k);
 /* somma delle pliche: solo quelle misurate in tutte le visite considerate, così il confronto è giusto */
 const common=vs=>{const w=vs.filter(v=>pk().some(k=>v.v[k]!=null));return pk().filter(k=>w.length&&w.every(v=>v.v[k]!=null));};
 const psum=(v,ks=pk())=>{const got=ks.filter(k=>v.v[k]!=null);return got.length?{s:got.reduce((a,k)=>a+v.v[k],0),n:got.length}:null;};
 const sumLbl=ks=>{const miss=pk().filter(k=>!ks.includes(k)).map(k=>fields().find(f=>f.k===k).n.toLowerCase());return miss.length?` <small class="hint">senza ${miss.join(', ')}</small>`:'';};
 /* colore della variazione: verde se migliora, arancio se peggiora, grigio se neutro */
 const cls=(f,dx)=>!dx||!f.d?'nd':dx*f.d>0?'ok':'ko';
 const spark=(vals,w=64,h=18)=>{const p=vals.map((y,i)=>[i,y]).filter(x=>x[1]!=null);if(p.length<2)return'';const ys=p.map(x=>x[1]),lo=Math.min(...ys),hi=Math.max(...ys),n=vals.length-1||1;
  const pt=([i,y])=>`${(i/n*(w-4)+2).toFixed(1)},${(hi===lo?h/2:h-2-(y-lo)/(hi-lo)*(h-4)).toFixed(1)}`;
  return`<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><polyline points="${p.map(pt).join(' ')}"/><circle r="2" cx="${pt(p[p.length-1]).split(',')[0]}" cy="${pt(p[p.length-1]).split(',')[1]}"/></svg>`;};
 /* tabella di confronto: righe = misure, colonne = visite; usata anche nel resoconto */
 function table(vs,{edit=true}={}){
  if(!vs.length)return'';
  const F=fields(),first=vs[0],last=vs[vs.length-1];
  const row=(name,u,vals,f,extra='')=>{const has=vals.some(x=>x!=null);if(!has)return'';
   const fi=vals.findIndex(x=>x!=null),li=vals.length-1-[...vals].reverse().findIndex(x=>x!=null),tot=li>fi?vals[li]-vals[fi]:null;
   return`<tr><th>${esc(name)}${u?` <small>${esc(u)}</small>`:''}${extra}</th>${vals.map((x,i)=>{let pv=null;for(let j=i-1;j>=0;j--)if(vals[j]!=null){pv=vals[j];break;}const dx=x!=null&&pv!=null?x-pv:null;
     return`<td>${x==null?'<span class="na">–</span>':fmtN(x)}${dx!=null&&Math.abs(dx)>=0.05?`<small class="dl ${cls(f,dx)}">${fmtD(dx)}</small>`:''}</td>`;}).join('')}<td class="tot">${tot!=null&&Math.abs(tot)>=0.05?`<b class="dl ${cls(f,tot)}">${fmtD(tot)}</b>`:'<span class="na">–</span>'}${spark(vals,48,14)}</td></tr>`;};
  let body='';
  Object.keys(GROUPS).forEach(g=>{const fs=F.filter(f=>(f.g||'x')===g);let r=fs.map(f=>row(f.n,f.u,vs.map(v=>v.v[f.k]??null),f)).join('');
   if(g==='b'){const b=vs.map(bmi);r+=row('IMC','',b.map(x=>x==null?null:Math.round(x*10)/10),{d:-1},' <small class="hint">peso/altezza²</small>');}
   if(g==='p'&&fs.length){const ks=common(vs);if(ks.length>1)r+=row('Somma pliche','mm',vs.map(v=>{const x=psum(v,ks);return x?x.s:null;}),{d:-1},sumLbl(ks));}
   if(r)body+=`<tr class="mg"><td colspan="${vs.length+2}">${GROUPS[g]}</td></tr>`+r;});
  return`<div class="mtw"><table class="mtab"><thead><tr><th></th>${vs.map(v=>`<th>${edit?`<button class="lnk" data-medit="${esc(v.id)}" title="Modifica">${fd(v.d)}</button>`:fd(v.d)}</th>`).join('')}<th class="tot">${vs.length>1?'Totale':''}</th></tr></thead><tbody>${body}</tbody></table></div>`;
 }
 /* grafico del peso: visite (pieni) e pesate a casa (vuoti) */
 function wchart(ws,from,to){if(ws.length<2)return'';
  const t=s=>dateOf(s).getTime(),x0=t(from||ws[0].d),x1=Math.max(t(to||ws[ws.length-1].d),x0+864e5),ys=ws.map(w=>w.v.peso),lo=Math.floor(Math.min(...ys)-.5),hi=Math.ceil(Math.max(...ys)+.5);
  const X=s=>(50+(t(s)-x0)/(x1-x0)*(600-62)).toFixed(1),Y=y=>(14+(hi-y)/(hi-lo||1)*170).toFixed(1);
  const grid=[lo,(lo+hi)/2,hi].map(y=>`<line x1="46" x2="592" y1="${Y(y)}" y2="${Y(y)}"/><text x="40" y="${+Y(y)+6}" text-anchor="end">${fmtN(Math.round(y*10)/10)}</text>`).join('');
  return`<svg class="wch" viewBox="0 0 600 225" role="img" aria-label="Andamento del peso"><g class="gr">${grid}</g><polyline points="${ws.map(w=>X(w.d)+','+Y(w.v.peso)).join(' ')}"/>${ws.map(w=>`<circle class="${w.home?'home':''}" r="${w.home?6:8}" cx="${X(w.d)}" cy="${Y(w.v.peso)}"><title>${fl(w.d)}: ${fmtN(w.v.peso)} kg${w.home?' (a casa)':''}</title></circle>`).join('')}<text x="50" y="218" class="ax">${fd(from||ws[0].d)}</text><text x="592" y="218" class="ax" text-anchor="end">${fd(to||ws[ws.length-1].d)}</text></svg>`;}
 function render(){
  const vs=visits(),ws=weights(),homes=M().visits.filter(v=>v.home).sort((a,b)=>b.d.localeCompare(a.d)),last=vs[vs.length-1],first=vs[0];
  const lw=ws[ws.length-1];
  const box=(b,s)=>`<div><b>${b}</b><small>${s}</small></div>`;
  let sum='';
  if(lw){const dx=first&&lw!==first&&first.v.peso!=null?lw.v.peso-first.v.peso:null;
   sum+=box(fmtN(lw.v.peso)+' kg',`peso${lw.home?' a casa':''} del ${fd(lw.d)}${dx!=null?` · <span class="dl ${cls({d:-1},dx)}">${fmtD(dx)}</span> dalla prima visita`:''}`);
   const b=bmi(lw);if(b)sum+=box(fmtN(Math.round(b*10)/10),'IMC');}
  if(last&&first&&last!==first){const f=fields().find(f=>f.k==='vs');if(f&&last.v.vs!=null&&first.v.vs!=null){const dx=last.v.vs-first.v.vs;sum+=box(`<span class="dl ${cls(f,dx)}">${fmtD(dx)}</span> cm`,'vita dalla prima visita');}
   const ks=common([first,last]),a=psum(first,ks),z=psum(last,ks);if(ks.length>1&&a&&z){const dx=z.s-a.s;sum+=box(`<span class="dl ${cls({d:-1},dx)}">${fmtD(dx)}</span> mm`,`somma di ${ks.length} pliche dalla prima visita`);}}
  $('#msSum').innerHTML=sum||'<p class="empty">Ancora nessuna misura: aggiungi la prima visita.</p>';
  $('#msTab').innerHTML=vs.length?table(vs)+'<p class="hint">Sotto ogni valore la differenza dalla visita prima; nell\'ultima colonna dalla prima all\'ultima. In verde quando va nella direzione giusta. Tocca una data per correggere quella visita.</p>':'';
  $('#msW').innerHTML=ws.length?`${wchart(ws)}<p class="wkleg"><i></i> visite <i class="home"></i> pesate a casa</p>${homes.length?`<details class="mhome"><summary>Pesate a casa (${homes.length})</summary><ul class="log">${homes.map(h=>`<li><span>${fl(h.d)}</span><b>${fmtN(h.v.peso)} kg</b><button class="x" data-mdel="${esc(h.id)}" aria-label="Elimina">×</button></li>`).join('')}</ul></details>`:''}`:'<p class="hint">Qui vedrai l\'andamento del peso, dalle visite e dalle pesate a casa.</p>';
  $('#msFields').innerHTML=fields().map((f,i)=>`<div class="mfr"><input data-mfn="${i}" value="${esc(f.n)}" aria-label="Nome"><span class="u">${esc(f.u||'')}</span><small>${GROUPS[f.g||'x']}</small><button class="x" data-mfdel="${i}" aria-label="Togli">×</button></div>`).join('');
 }
 /* finestra visita / pesata */
 function edit(id,home){const m=M(),v=id?m.visits.find(x=>x.id===id):null;home=v?!!v.home:home;
  const F=home?fields().filter(f=>f.k==='peso'):fields(), prev=visits().filter(x=>!v||x.d<v.d).pop();
  $('#msBody').innerHTML=`<h3>${home?'⚖️ Peso a casa':v?'Visita del '+fl(v.d):'＋ Nuova visita'}</h3>
   <label class="field">Data<input type="date" id="msD" value="${v?v.d:todayIso()}" max="${todayIso()}"></label>
   ${home?'<p class="hint">Pesati la mattina, a digiuno e dopo il bagno: così le pesate si confrontano meglio.</p>':'<p class="hint">Lascia vuoto quello che non è stato misurato.</p>'}
   ${Object.keys(GROUPS).map(g=>{const fs=F.filter(f=>(f.g||'x')===g);return fs.length?`${home?'':`<h4 class="sub">${GROUPS[g]}</h4>`}<div class="mgrid">${fs.map(f=>`<label class="field">${esc(f.n)}${f.u?` (${esc(f.u)})`:''}<input data-mv="${esc(f.k)}" inputmode="decimal" autocomplete="off" value="${v&&v.v[f.k]!=null?fmtN(v.v[f.k]):''}" placeholder="${!v&&prev&&prev.v[f.k]!=null?'prima: '+fmtN(prev.v[f.k]):''}"></label>`).join('')}</div>`:'';}).join('')}
   <p class="hint" id="msErr"></p>
   <div class="tools">${v?'<button class="btn line sm" id="msDel">🗑️ Elimina</button>':''}<span style="flex:1"></span><button class="btn line sm" id="msNo">Annulla</button><button class="btn sm" id="msOk">Salva</button></div>`;
  const dlg=$('#msDlg');dlg.showModal();
  $('#msNo').onclick=()=>dlg.close();
  if(v)$('#msDel').onclick=()=>{if(!confirm(home?'Elimino questa pesata?':'Elimino questa visita e le sue misure?'))return;del(v.id);dlg.close();toast('Eliminata');};
  $('#msOk').onclick=()=>{const d=$('#msD').value,o={};let bad='';
   if(!d){$('#msErr').textContent='Scegli la data';return;}
   dlg.querySelectorAll('[data-mv]').forEach(i=>{const t=i.value.trim();if(!t)return;const x=num(t);if(x==null||x<=0)bad=bad||i.closest('label').firstChild.textContent;else o[i.dataset.mv]=x;});
   if(bad){$('#msErr').textContent='Controlla il valore di '+bad+': scrivi solo il numero (es. 82,5)';return;}
   if(!Object.keys(o).length){$('#msErr').textContent=home?'Scrivi il peso':'Scrivi almeno una misura';return;}
   const w=W();if(v){const x=w.visits.find(y=>y.id===v.id);x.d=d;x.v=o;}else w.visits.push({id:newId(),d,...(home?{home:1}:{}),v:o});
   save();dlg.close();render();toast(home?'Peso salvato':'Visita salvata');};
 }
 function del(id){const w=W();w.visits=w.visits.filter(x=>x.id!==id);w.gone.push(id);save();render();}
 /* tabella incollata (da Excel, Numbers, Google Fogli o dal PDF): una riga per misura, una colonna per data (o il contrario) */
 function parseTable(txt){
  let rows=txt.replace(/\r/g,'').split('\n').map(l=>l.trim()).filter(Boolean).map(l=>(l.includes('\t')?l.split('\t'):l.includes(';')?l.split(';'):l.includes('|')?l.split('|').filter((c,i,a)=>!(c.trim()===''&&(i===0||i===a.length-1))):l.split(/\s{2,}|\s(?=[\d/–-]+(?:[.,]\d+)?(?:\s|$))/)).map(c=>c.trim()));
  rows=rows.filter(r=>!r.every(c=>/^[-:|\s]*$/.test(c)));
  const isD=c=>/^\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}$/.test(c);
  const toIso=c=>{const [d,m,y]=c.split(/[\/.-]/).map(Number);const Y=y<100?2000+y:y;return`${Y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;};
  let hi=rows.findIndex(r=>r.filter(isD).length>=1);
  if(hi<0||rows[hi].filter(isD).length<1)return{err:'Non trovo le date (es. 21/02/2026) nella prima riga o nella prima colonna.'};
  /* date nella prima colonna: giro la tabella */
  if(rows[hi].filter(isD).length===1&&rows.filter(r=>isD(r[0])).length>1){const hdr=rows.find(r=>!isD(r[0]))||[],data=rows.filter(r=>isD(r[0]));rows=[['',...data.map(r=>r[0])],...hdr.slice(1).map((h,j)=>[h,...data.map(r=>r[j+1]??'')])];hi=0;}
  const hdr=rows[hi],cols=hdr.map((c,i)=>isD(c)?i:-1).filter(i=>i>=0),dates=cols.map(i=>toIso(hdr[i]));
  const F=fields().map(f=>({...f})),out=dates.map(d=>({d,v:{}})),unk=[];let plica=false;
  rows.slice(hi+1).forEach(r=>{const lab=r[0]||'',l=lab.toLowerCase();if(/plic/.test(l))plica=true;
   /* le celle numeriche sono quelle sotto le date; se la riga ha meno colonne, allineo da destra */
   const vals=r.length>=hdr.length?cols.map(i=>r[i]):r.slice(1).slice(-cols.length);
   if(!vals.some(x=>num(x)!=null))return;
   const isP=/plic/.test(l)||(plica&&!/circ|peso|altez/.test(l));
   let k=(KW.find(([kk,re])=>{const f=MF.find(x=>x.k===kk);if(f.g==='p'&&!isP&&!/tricip|sottoscap|sovrail/.test(l))return false;if(f.g==='c'&&isP)return false;return re.test(l);})||[])[0];
   let f=k&&F.find(x=>x.k===k);
   if(!f){const n=lab.replace(/^circ\.?\s*/i,'').trim()||'Misura';f=F.find(x=>x.n.toLowerCase()===n.toLowerCase());if(!f){f={k:'u'+Math.random().toString(36).slice(2,7),n:n.charAt(0).toUpperCase()+n.slice(1),u:isP?'mm':/peso/.test(l)?'kg':'cm',g:isP?'p':'x',d:0};F.push(f);unk.push(f.n);}}
   vals.forEach((x,j)=>{const y=num(x);if(y!=null&&out[j])out[j].v[f.k]=y;});});
  const ok=out.filter(o=>Object.keys(o.v).length);
  return ok.length?{visits:ok,fields:F,unk}:{err:'Non trovo valori numerici sotto le date.'};}
 function importTable(txt){const r=parseTable(txt);if(r.err)return r;
  const w=W();w.fields=r.fields;let n=0,m=0;
  r.visits.forEach(o=>{const ex=w.visits.find(x=>!x.home&&x.d===o.d);if(ex){ex.v={...ex.v,...o.v};m++;}else{w.visits.push({id:newId(),d:o.d,v:o.v});n++;}});
  save();render();return{n,m,unk:r.unk};}
 function onClick(b){
  if(b.id==='msNew')edit(null,false);
  if(b.id==='msHome')edit(null,true);
  if(b.dataset.medit)edit(b.dataset.medit);
  if(b.dataset.mdel){if(confirm('Elimino questa pesata?'))del(b.dataset.mdel);}
  if(b.dataset.mfdel!=null){const w=W(),f=w.fields[+b.dataset.mfdel];if(!f||!confirm(`Tolgo «${f.n}» dalle misure? I valori già scritti restano salvati ma non si vedono più.`))return;w.fields.splice(+b.dataset.mfdel,1);w.gone.push('f:'+f.k);save();render();}
  if(b.id==='msFAdd'){const n=$('#msFN').value.trim(),u=$('#msFU').value.trim(),g=$('#msFG').value;if(!n){toast('Scrivi il nome della misura');return;}const w=W();w.fields.push({k:'u'+Date.now().toString(36),n,u,g,d:g==='p'?-1:0});$('#msFN').value='';$('#msFU').value='';save();render();toast('Misura aggiunta');}
  if(b.id==='msImp'){const r=importTable($('#msPaste').value);if(r.err){$('#msImpMsg').textContent=r.err;return;}$('#msPaste').value='';$('#msImpMsg').textContent='';
   toast(`${r.n} visite importate${r.m?`, ${r.m} aggiornate`:''}`);if(r.unk.length)$('#msImpMsg').textContent='Misure nuove aggiunte: '+r.unk.join(', ')+'. Se una era già in elenco, rinominala o toglila qui sotto.';}
 }
 function onChange(el){if(el.dataset.mfn!=null){const w=W(),f=w.fields[+el.dataset.mfn],n=el.value.trim();if(f&&n){f.n=n;save();render();}}}
 return{render,table,wchart,visits,weights,bmi,psum,onClick,onChange,parseTable,fields};
}
