/* ====== ARCHIVIO DEI PIANI E DELLE PREFERENZE ======
   Qui passa tutto ciò che riguarda dove sono salvati piani e preferenze.
   Oggi: memoria del browser (localStorage). Con Firebase questo file sincronizzerà anche il cloud.
   Piani: {active:id, list:[{id, title, author, added, from, src?, plan, state?}]}
   - src: file da cui è stato caricato (i piani inclusi nell'app si aggiornano da soli se il file cambia)
   - from: data dell'ultima attivazione; state: scelte legate a quel piano quando non è attivo */
const PK='dietaApp.plans', FK='dietaApp.prefs', BK='dietaApp.boot';
export const DEFAULT_PLAN_URL='data/piano-esempio.json', EXAMPLE_ID='esempio';
/* versioni precedenti: il piano personale era incluso nell'app; ora diventa un piano dell'utente come gli altri */
const LEGACY_PLAN='data/piano-uccheddu.json', LEGACY_PREFS='data/preferenze-matteo.json', LK='dietaApp.legacyPrefs';
const exampleRec=async()=>{const plan=await getJSON(DEFAULT_PLAN_URL);return{id:EXAMPLE_ID,title:plan.title||'Piano di esempio',author:plan.author||'',added:today(),from:today(),src:DEFAULT_PLAN_URL,plan};};
export const isExample=r=>!!r&&r.src===DEFAULT_PLAN_URL;
export const today=()=>{const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
export const getJSON=u=>fetch(u,{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error('File non trovato: '+u);return r.json();});
const read=k=>{try{return JSON.parse(localStorage.getItem(k)||'null');}catch(e){return null;}};

/* controllo di un piano nel formato "dieta-plan" (vedi docs/formato-piano.md): restituisce l'elenco dei problemi */
export function planErrors(p){
 const err=[];
 if(!p||typeof p!=='object')return['non è un file JSON valido'];
 if(p.format!=='dieta-plan')err.push('manca "format": "dieta-plan"');
 if(!Array.isArray(p.meals)||!p.meals.length)err.push('manca l\'elenco dei pasti ("meals")');
 if(!Array.isArray(p.days)||!p.days.length)err.push('manca l\'elenco dei giorni ("days")');
 if(err.length)return err;
 if(p.days.length!==7)err.push(`servono 7 giorni, da lunedì a domenica (ce ne sono ${p.days.length})`);
 p.meals.forEach((m,i)=>{if(!m||typeof m.key!=='string'||!/^[\w-]+$/.test(m.key)||!m.name)err.push(`pasto ${i+1}: servono "key" (lettere, numeri, - o _) e "name"`);});
 if(p.title!=null&&typeof p.title!=='string')err.push('"title" deve essere un testo');
 const mk=new Set(p.meals.map(m=>m.key)), dk=new Set();
 p.days.forEach((d,i)=>{const w=`giorno ${i+1}${d&&d.name?' ('+d.name+')':''}`;
  if(!d||typeof d.key!=='string'||!/^[\w-]+$/.test(d.key)||typeof d.name!=='string'||!d.name){err.push(`${w}: servono "key" (lettere, numeri, - o _) e "name"`);return;}
  if(dk.has(d.key))err.push(`${w}: la chiave "${d.key}" è ripetuta`);dk.add(d.key);
  if(!d.meals||typeof d.meals!=='object'){err.push(`${w}: mancano i pasti`);return;}
  Object.entries(d.meals).forEach(([m,cs])=>{
   if(!mk.has(m))err.push(`${w}: il pasto "${m}" non è nell'elenco dei pasti`);
   if(!Array.isArray(cs)){err.push(`${w}, ${m}: i componenti devono essere un elenco`);return;}
   cs.forEach((c,j)=>{if(!c||!c.type||!c.label||!Array.isArray(c.options)||!c.options.length)err.push(`${w}, ${m}, componente ${j+1}: servono "type", "label" e almeno un'opzione`);
    else if(!c.free)c.options.forEach((o,k)=>{const wo=`${w}, ${m}, ${c.label}, opzione ${k+1}`;if(!o||typeof o.name!=='string'||!o.name||typeof o.qty!=='number'||!o.unit)err.push(`${wo}: servono "name", "qty" (numero) e "unit"`);
     else if(o.buy!=null&&(!Array.isArray(o.buy)||o.buy.some(b=>!b||typeof b.name!=='string'||typeof b.qty!=='number'||!b.unit)))err.push(`${wo}: "buy" deve essere un elenco di {name, qty, unit}`);});});
  });
 });
 return err.slice(0,12);
}

export const readPlans=()=>read(PK);
const changed=()=>window.dispatchEvent(new Event('dieta:changed'));
export const writePlans=st=>{if(window.dietaFrozen)return;localStorage.setItem(PK,JSON.stringify(st));changed();};
export const newPlanId=()=>'p'+Date.now().toString(36);

/* piano attivo; al primo avvio si parte dal piano di esempio */
export async function loadActivePlan(){
 let st=readPlans();
 if(st&&Array.isArray(st.list)&&st.list.some(r=>r.src&&r.src!==DEFAULT_PLAN_URL)){
  st.list.forEach(r=>{if(r.src&&r.src!==DEFAULT_PLAN_URL){if(r.src===LEGACY_PLAN)localStorage.setItem(LK,r.id);delete r.src;}});writePlans(st);}
 if(!st||!Array.isArray(st.list)||!st.list.length){
  st={active:EXAMPLE_ID,list:[await exampleRec()]};
  writePlans(st);
 }
 let rec=st.list.find(r=>r.id===st.active);
 if(!rec){rec=st.list[0];st.active=rec.id;writePlans(st);}
 /* se l'ultimo avvio con questo piano non è arrivato in fondo (piano difettoso), torno al piano incluso nell'app */
 if(localStorage.getItem(BK)===rec.id&&!rec.src){let def=st.list.find(isExample);
  if(!def){try{def=await exampleRec();st.list.push(def);}catch(e){def=null;}}
  if(def){st.active=def.id;writePlans(st);rec=def;
   setTimeout(()=>alert('L\'app non riusciva ad aprirsi con l\'ultimo piano usato: ho ripreso il piano di esempio. L\'altro piano resta in archivio, da Impostazioni puoi riattivarlo.'),800);}}
 localStorage.setItem(BK,rec.id);
 if(rec.src){try{const fresh=await getJSON(rec.src);if(!planErrors(fresh).length&&JSON.stringify(fresh)!==JSON.stringify(rec.plan)){rec.plan=fresh;writePlans(st);}}catch(e){/* offline: va bene la copia salvata */}}
 return{st,rec};
}

/* preferenze: ?prefs=nome forza un file (per prove); altrimenti quelle salvate in questo browser; altrimenti le predefinite.
   Da chiamare dopo loadActivePlan: chi aveva il piano incluso nelle versioni precedenti si tiene anche le sue preferenze */
export async function loadPrefs(){
 const q=new URLSearchParams(location.search).get('prefs');
 /* migrazione: le preferenze del vecchio file vanno al piano di allora (attivo o in archivio); se il file non si legge riprovo al prossimo avvio */
 const lid=!q&&localStorage.getItem(LK);
 if(lid){try{const p=await getJSON(LEGACY_PREFS);if(p&&p.format==='dieta-prefs'){p.legacy=true;const st=readPlans(), r=st&&st.list.find(x=>x.id===lid);
   if(r&&st.active!==lid){r.state=r.state||{};if(!r.state.prefs)r.state.prefs=p;writePlans(st);}
   else if(r&&!read(FK))writePrefs(p,true);
   localStorage.removeItem(LK);}}catch(e){console.warn('Preferenze precedenti non ancora recuperate:',e);}}
 if(!q){const p=read(FK);if(p&&p.format==='dieta-prefs')return{prefs:p,local:true};}
 const name=(q||'predefinite').replace(/[^\w-]/g,'');
 const prefs=await getJSON('data/preferenze-'+name+'.json').catch(()=>getJSON('data/preferenze-predefinite.json'));
 return{prefs,local:false};
}
export const readLocalPrefs=()=>read(FK);
/* legacy: preferenze copiate dal vecchio file; nel cloud non vincono su quelle già salvate da un altro dispositivo. Ogni modifica toglie il segno */
export const writePrefs=(p,legacy)=>{if(window.dietaFrozen)return;if(!legacy&&p&&p.legacy){p={...p};delete p.legacy;}localStorage.setItem(FK,JSON.stringify(p));changed();};
export const clearPrefs=()=>{if(window.dietaFrozen)return;localStorage.removeItem(FK);changed();};
export const bootDone=()=>localStorage.removeItem(BK);
