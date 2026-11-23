/* ====== ARCHIVIO DEI PIANI E DELLE PREFERENZE ======
   Qui passa tutto ciò che riguarda dove sono salvati piani e preferenze.
   Oggi: memoria del browser (localStorage). Con Firebase questo file sincronizzerà anche il cloud.
   Piani: {active:id, list:[{id, title, author, added, from, src?, plan, state?}], cal:[{from:data, plan:id}]}
   - src: file da cui è stato caricato (i piani inclusi nell'app si aggiornano da soli se il file cambia)
   - state.prefs: preferenze del piano quando non è quello in uso
   - cal: calendario. Ogni piano vale dalla sua data di inizio fino al giorno prima dell'inizio successivo;
     lo stesso piano può comparire più volte (piano ripreso). "active" è sempre il piano in vigore oggi */
const PK='dietaApp.plans', FK='dietaApp.prefs', BK='dietaApp.boot';
export const DEFAULT_PLAN_URL='data/piano-esempio.json', EXAMPLE_ID='esempio';
/* versioni precedenti: il piano personale era incluso nell'app; ora diventa un piano dell'utente come gli altri */
const LEGACY_PLAN='data/piano-uccheddu.json', LEGACY_PREFS='data/preferenze-matteo.json', LK='dietaApp.legacyPrefs';
/* piani personali messi da parte in archivio (file non pubblicati: esistono solo aprendo l'app dal Mac, poi la sincronizzazione li porta altrove) */
const SEED=['data/piano-uccheddu-2026-03.json'], SK='dietaApp.seeded', LOCAL=/^(localhost|127\.0\.0\.1)$/.test(location.hostname)&&!navigator.webdriver; /* le prove automatiche partono senza */
async function seedPlans(st){if(!LOCAL)return;let done=read(SK)||[];
 for(const u of SEED){if(done.includes(u))continue;
  try{const plan=await getJSON(u);if(planErrors(plan).length)continue;
   if(!st.list.some(r=>r.title===plan.title&&(r.plan||{}).validFrom===plan.validFrom)){const from=plan.validFrom||today(),id=newPlanId();
    st.list.push({id,title:plan.title||'Piano',author:plan.author||'',added:today(),from,plan});
    if(!calOf(st).some(e=>e.from===from))setStart(st,id,from);writePlans(st);}
   done=[...done,u];localStorage.setItem(SK,JSON.stringify(done));}catch(e){/* file assente: niente da aggiungere */}}}
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
/* calendario ordinato, solo con piani che esistono ancora */
export const calOf=st=>(st&&Array.isArray(st.cal)?st.cal:[]).filter(e=>e&&e.from&&st.list.some(r=>r.id===e.plan)).sort((a,b)=>a.from.localeCompare(b.from))
 .reduce((c,e)=>{if(!c.length||c[c.length-1].plan!==e.plan)c.push(e);return c;},[]); /* due inizi di fila dello stesso piano = uno solo */
/* piano in vigore in una data: l'ultimo iniziato entro quel giorno; prima del primo inizio vale il primo */
export function planAt(st,iso){const c=calOf(st);let id=c.length?c[0].plan:st.active;c.forEach(e=>{if(e.from<=iso)id=e.plan;});return id;}
/* periodo di un inizio: {from, to (ultimo giorno, null se in corso), plan} */
export function periods(st){const c=calOf(st);return c.map((e,i)=>({...e,i,to:c[i+1]?addDay(c[i+1].from,-1):null}));}
const addDay=(iso,n)=>{const [y,m,d]=iso.split('-').map(Number),t=new Date(y,m-1,d+n);return`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;};
/* aggiunge (o sposta, se old è dato) un inizio nel calendario; due inizi nello stesso giorno non sono ammessi: vince l'ultimo */
export function setStart(st,plan,from,old){let c=calOf(st);if(old!=null)c=c.filter(e=>!(e.from===old));c=c.filter(e=>e.from!==from);c.push({from,plan});st.cal=c.sort((a,b)=>a.from.localeCompare(b.from));return st;}
/* il piano in uso cambia: le preferenze di quello che lascio restano con lui, quelle del nuovo tornano (se le aveva) */
function switchTo(st,id){const cur=st.list.find(r=>r.id===st.active),nx=st.list.find(r=>r.id===id);if(!nx||cur===nx)return;
 if(cur)cur.state={prefs:read(FK)};
 const ns=nx.state||{};delete nx.state;
 if('prefs' in ns){if(ns.prefs)localStorage.setItem(FK,JSON.stringify(ns.prefs));else localStorage.removeItem(FK);} /* mai usato: parte dalle preferenze attuali */
 st.active=id;}

/* piano attivo; al primo avvio si parte dal piano di esempio */
export async function loadActivePlan(){
 let st=readPlans();
 if(st&&Array.isArray(st.list)&&st.list.some(r=>r.src&&r.src!==DEFAULT_PLAN_URL)){
  st.list.forEach(r=>{if(r.src&&r.src!==DEFAULT_PLAN_URL){if(r.src===LEGACY_PLAN)localStorage.setItem(LK,r.id);delete r.src;}});writePlans(st);}
 if(!st||!Array.isArray(st.list)||!st.list.length){
  st={active:EXAMPLE_ID,list:[await exampleRec()],cal:[{from:today(),plan:EXAMPLE_ID}]};
  writePlans(st);
 }
 let rec=st.list.find(r=>r.id===st.active);
 if(!rec){rec=st.list[0];st.active=rec.id;writePlans(st);}
 /* versioni precedenti: niente calendario (il piano attivo parte dalla sua data di attivazione) e scelte messe da parte con i piani in archivio */
 if(!calOf(st).length){st.cal=[{from:rec.from||today(),plan:rec.id}];writePlans(st);}
 if(st.list.some(r=>r.state&&Object.keys(r.state).some(k=>k!=='prefs'))){st.list.forEach(r=>{if(r.state)r.state='prefs' in r.state?{prefs:r.state.prefs}:undefined;if(!r.state)delete r.state;});writePlans(st);}
 await seedPlans(st);
 /* il piano in vigore oggi secondo il calendario (un piano programmato parte da solo) */
 const want=planAt(st,today());
 if(want!==st.active&&!new URLSearchParams(location.search).has('prefs')){switchTo(st,want);writePlans(st);rec=st.list.find(r=>r.id===st.active);}
 /* se l'ultimo avvio con questo piano non è arrivato in fondo (piano difettoso), torno al piano incluso nell'app */
 if(localStorage.getItem(BK)===rec.id&&!rec.src){let def=st.list.find(isExample);
  if(!def){try{def=await exampleRec();st.list.push(def);}catch(e){def=null;}}
  if(def){switchTo(st,def.id);setStart(st,def.id,today());writePlans(st);rec=def;
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
