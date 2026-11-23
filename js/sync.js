/* ====== ACCOUNT E SINCRONIZZAZIONE (Firebase) ======
   L'app lavora sempre sui dati del dispositivo (localStorage): funziona anche offline e senza account.
   Se accedi con Google, questo modulo copia i dati nel cloud e li riprende dagli altri dispositivi.
   Cloud: users/{uid}/docs/{nome} = {data: testo JSON, rev: numero, dev: dispositivo}
     main          scelte e impostazioni (tutto tranne il diario)
     prefs         preferenze modificate (se mancano valgono quelle del file)
     plans         elenco dei piani (senza il contenuto)
     plan-{id}     contenuto di un piano
     diary-AAAA-MM diario di un mese
   Per ogni documento ricordo la versione vista all'ultima sincronizzazione: così capisco chi è cambiato
   (questo dispositivo, il cloud o entrambi). Se cambiano entrambi: diario unito giorno per giorno, il resto vince questo dispositivo. */
import{firebaseConfig}from'./firebase-config.js';
const V='13.4.0', CDN=`https://www.gstatic.com/firebasejs/${V}/`;
const LS='dietaApp.v1', PK='dietaApp.plans', FK='dietaApp.prefs', MK='dietaApp.sync';
const NOSYNC=['tab','lastBackup'];
let fb=null, user=null, busy=false, again=false, timer=null, onStatus=()=>{};const tooBig=new Set();
const meta=()=>{try{return JSON.parse(localStorage.getItem(MK)||'null')||{};}catch(e){return{};}};
const setMeta=m=>localStorage.setItem(MK,JSON.stringify(m));
const dev=()=>{const m=meta();if(!m.dev){m.dev=Math.random().toString(36).slice(2,10);setMeta(m);}return m.dev;};
const hash=s=>{let h1=0xdeadbeef,h2=0x41c6ce57;for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);h1=Math.imul(h1^c,2654435761);h2=Math.imul(h2^c,1597334677);}
 h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);return(4294967296*(2097151&h2)+(h1>>>0)).toString(36);};
const J=k=>{try{return JSON.parse(localStorage.getItem(k)||'null');}catch(e){return null;}};

/* ---- dati del dispositivo <-> documenti ---- */
function localDocs(){
 const d={}, S=J(LS)||{};
 const main={...S};NOSYNC.concat(['diary','dplanned']).forEach(k=>delete main[k]);d.main=JSON.stringify(main);
 const months={};Object.entries(S.diary||{}).forEach(([iso,e])=>{if(!e||!e.length)return;const m=iso.slice(0,7);(months[m]=months[m]||{days:{},planned:{}}).days[iso]=e;if(S.dplanned&&S.dplanned[iso])months[m].planned[iso]=S.dplanned[iso];});
 Object.keys(months).sort().forEach(m=>{const x=months[m];d['diary-'+m]=JSON.stringify({days:sortObj(x.days),planned:sortObj(x.planned)});});
 const p=localStorage.getItem(FK);if(p)d.prefs=p;
 const st=J(PK);if(st&&st.list){d.plans=JSON.stringify({active:st.active,list:st.list.map(({plan,...r})=>r)});st.list.forEach(r=>{d['plan-'+r.id]=JSON.stringify(r.plan);});}
 return d;
}
const sortObj=o=>Object.fromEntries(Object.keys(o).sort().map(k=>[k,o[k]]));
function applyDocs(d){
 const cur=J(LS)||{}, S=d.main?JSON.parse(d.main):{};
 NOSYNC.forEach(k=>{if(cur[k]!==undefined)S[k]=cur[k];});
 S.diary={};S.dplanned={};
 Object.keys(d).filter(n=>n.startsWith('diary-')).forEach(n=>{const x=JSON.parse(d[n]);Object.assign(S.diary,x.days||{});Object.assign(S.dplanned,x.planned||{});});
 localStorage.setItem(LS,JSON.stringify(S));
 if(d.prefs)localStorage.setItem(FK,d.prefs);else localStorage.removeItem(FK);
 if(d.plans){const idx=JSON.parse(d.plans);idx.list=idx.list.filter(r=>d['plan-'+r.id]).map(r=>({...r,plan:JSON.parse(d['plan-'+r.id])}));
  if(idx.list.length){if(!idx.list.some(r=>r.id===idx.active))idx.active=idx.list[0].id;localStorage.setItem(PK,JSON.stringify(idx));}else localStorage.removeItem(PK);}
 else localStorage.removeItem(PK);
}
/* stesso documento cambiato qui e nel cloud */
function mergeDoc(n,a,b){
 if(n.startsWith('diary-'))return mergeDiary(a,b);
 const x=JSON.parse(a),y=JSON.parse(b);
 if(n==='prefs'&&x.legacy&&!y.legacy)return b; /* copia automatica dal vecchio file: vince quella nel cloud */
 if(n==='plans'){const ids=new Set(x.list.map(r=>r.id));return JSON.stringify({active:x.active,list:[...x.list,...y.list.filter(r=>!ids.has(r.id))]});}
 if(n==='main'){/* vince questo dispositivo, ma unisco le raccolte per non perdere aggiunte fatte altrove */
  ['picks','pantry','checked','hidden','dplan','shopLog'].forEach(k=>{if(y[k]&&typeof y[k]==='object')x[k]={...y[k],...(x[k]||{})};});
  const uni=(k,key)=>{const a=x[k]||[],seen=new Set(a.map(key));x[k]=[...a,...(y[k]||[]).filter(e=>!seen.has(key(e)))];};
  uni('custom',e=>e.n+'|'+e.cat);uni('customFoods',e=>e.n);uni('brandFoods',e=>e.code||e.n);
  return JSON.stringify(x);}
 return a;
}
function mergeDiary(a,b){/* a = questo dispositivo, b = cloud: unisco i giorni; se lo stesso giorno è diverso tengo questo dispositivo */
 const x=JSON.parse(a),y=JSON.parse(b);return JSON.stringify({days:sortObj({...y.days,...x.days}),planned:sortObj({...y.planned,...x.planned})});}
/* questo dispositivo ha dati suoi? (diversi da un'app appena installata) */
const IGN=['day','shopDays','conv','catOrder','swap'];
const nonEmpty=v=>v!=null&&v!==''&&!(Array.isArray(v)&&!v.length)&&!(typeof v==='object'&&!Array.isArray(v)&&!Object.keys(v).length);
const hasData=d=>{const S=d.main?JSON.parse(d.main):{};const pl=d.plans?JSON.parse(d.plans).list:[];
 return Object.keys(d).some(n=>n.startsWith('diary-'))||!!d.prefs||pl.length>1||pl.some(r=>!r.src)||Object.entries(S).some(([k,v])=>!IGN.includes(k)&&nonEmpty(v));};

/* ---- Firebase ---- */
async function load(){
 if(fb)return fb;
 const [a,au,fs]=await Promise.all(['app','auth','firestore'].map(m=>import(CDN+`firebase-${m}.js`)));
 const app=a.initializeApp(firebaseConfig), auth=au.getAuth(app), db=fs.getFirestore(app);
 auth.languageCode='it';
 fb={au,fs,auth,db,app};return fb;
}
const col=()=>fb.fs.collection(fb.db,'users',user.uid,'docs');
async function remoteDocs(){const s=await(fb.fs.getDocsFromServer||fb.fs.getDocs)(col());const r={};s.forEach(x=>{r[x.id]=x.data();});return r;}
async function write(changes){/* changes: {nome: testo | null (= elimina)} in gruppi da 400 */
 const names=Object.keys(changes).filter(n=>{if(changes[n]!=null&&new Blob([changes[n]]).size>900000){console.warn('Documento troppo grande per il cloud:',n);tooBig.add(n);return false;}return true;}), revs={};
 for(let i=0;i<names.length;i+=400){const b=fb.fs.writeBatch(fb.db);
  names.slice(i,i+400).forEach(n=>{const ref=fb.fs.doc(col(),n);if(changes[n]==null)b.delete(ref);else{const rev=Date.now();revs[n]=rev;b.set(ref,{data:changes[n],rev,dev:dev()});}});
  await b.commit();}
 return revs;
}

/* sincronizzazione; mode: undefined = normale, 'cloud' = prendi tutto dal cloud, 'device' = metti nel cloud questo dispositivo */
export async function sync(mode){
 if(!user)return{ok:false};
 if(busy){again=true;return{ok:true,queued:true};}
 busy=true;onStatus('sync');
 try{
  const m=meta(), R=await remoteDocs(), L=localDocs(), rHas=Object.keys(R).length>0;
  /* primo accesso con questo account, oppure cloud svuotato (mai cancellare qui per questo) */
  const first=m.uid!==user.uid||(!rHas&&Object.keys(m.seen||{}).length>0);
  if(first&&!mode){
   if(!rHas){if(m.uid&&m.uid!==user.uid&&hasData(L)){onStatus('copy');return{ok:true,choose:'copy'};}mode='device';}
   else if(!hasData(L))mode='cloud';
   else{onStatus('choose');return{ok:true,choose:'merge'};}
  }
  const seen=first||mode?{}:(m.seen||{}), push={}, out={...L};let pulled=false;
  if(mode==='cloud'){Object.keys(L).forEach(n=>delete out[n]);Object.entries(R).forEach(([n,x])=>{out[n]=x.data;});pulled=true;}
  else if(mode==='device'){Object.keys(L).forEach(n=>{if(!R[n]||R[n].data!==L[n])push[n]=L[n];});} /* i documenti che esistono solo nel cloud restano */
  else{
   new Set([...Object.keys(L),...Object.keys(R),...Object.keys(seen)]).forEach(n=>{
    const lc=L[n], r=R[n], s=seen[n]||{}, lCh=(lc==null?undefined:hash(lc))!==s.h, rCh=(r?r.rev:undefined)!==s.rev;
    if(lCh&&!rCh)push[n]=lc==null?null:lc;
    else if(!lCh&&rCh){if(r)out[n]=r.data;else delete out[n];pulled=true;}
    else if(lCh&&rCh){
     if(lc==null&&r){out[n]=r.data;pulled=true;}            /* eliminato qui, cambiato altrove: tengo il cloud */
     else if(lc!=null&&!r)push[n]=lc;                         /* cambiato qui, eliminato altrove: tengo questo dispositivo */
     else if(lc!==r.data){const x=mergeDoc(n,lc,r.data);if(x!==lc){out[n]=x;pulled=true;}push[n]=x;}
    }
   });
  }
  if(pulled){window.dietaFrozen=true;applyDocs(out);} /* da qui l'app non salva più finché non si ricarica */
  const finalL=pulled?localDocs():L, revs=Object.keys(push).length?await write(push):{}, R2={...R};
  Object.entries(push).forEach(([n,v])=>{if(v==null)delete R2[n];else R2[n]={data:v,rev:revs[n]};});
  /* ricordo anche i documenti del cloud che qui non servono (es. un piano non in elenco): così non vengono riscaricati all'infinito */
  const ns={};Object.keys(R2).forEach(n=>{ns[n]={h:n in finalL?hash(finalL[n]):undefined,rev:R2[n].rev};});
  setMeta({...meta(),uid:user.uid,email:user.email,seen:ns,at:Date.now()});
  onStatus('ok');return{ok:true,pulled,pushed:Object.keys(push).length};
 }catch(e){console.error(e);onStatus('error',e);return{ok:false,error:e,pulled:!!window.dietaFrozen};}
 finally{busy=false;if(again){again=false;setTimeout(()=>run(),500);}}
}
/* sincronizza e, se sono arrivati dati nuovi, ricarica la pagina (l'app li legge all'avvio) */
export async function run(mode){const r=await sync(mode);if(r&&r.pulled)location.reload();return r;}
export function changed(){if(!user||window.dietaFrozen)return;clearTimeout(timer);timer=setTimeout(()=>run(),2500);}
export async function signIn(){
 await load();const p=new fb.au.GoogleAuthProvider();p.setCustomParameters({prompt:'select_account'});
 try{await fb.au.signInWithPopup(fb.auth,p);}
 catch(e){if(e.code==='auth/popup-blocked'||e.code==='auth/operation-not-supported-in-this-environment')await fb.au.signInWithRedirect(fb.auth,p);else throw e;}
}
/* esce dopo aver provato a salvare le ultime modifiche; restituisce false se non ci è riuscito */
export async function signOut(){await load();clearTimeout(timer);let ok=true;if(user){const r=await sync();ok=!!(r&&r.ok&&!r.choose);}
 await fb.au.signOut(fb.auth);const m=meta();setMeta({dev:m.dev});return ok;}
/* GDPR: cancella i dati nel cloud e l'account; i dati del dispositivo restano */
export async function deleteCloud(){
 await load();if(!user)return;
 clearTimeout(timer);busy=true;
 try{
  /* prima un nuovo accesso (serve per chiudere l'account), così non resto a metà */
  await fb.au.reauthenticateWithPopup(user,new fb.au.GoogleAuthProvider());
  const m=meta();setMeta({dev:m.dev});           /* dimentico subito cosa c'era nel cloud: il dispositivo non verrà svuotato */
  const s=await fb.fs.getDocs(col()), ch={};s.forEach(x=>{ch[x.id]=null;});if(Object.keys(ch).length)await write(ch);
  await fb.au.deleteUser(fb.auth.currentUser);
 }finally{busy=false;}
}
/* per altri moduli Firebase (AI Logic) */
export const firebase=()=>load();
export const signedIn=()=>!!user;
export const status=()=>({user:user?{email:user.email,name:user.displayName,photo:user.photoURL}:null,at:meta().at||null});
/* avvio: aspetta lo stato dell'accesso; cb(evento) per aggiornare l'interfaccia */
export async function start(cb){
 onStatus=cb||onStatus;
 await load();
 fb.au.getRedirectResult(fb.auth).catch(e=>onStatus('error',e));
 fb.au.onAuthStateChanged(fb.auth,u=>{user=u;onStatus(u?'in':'out');if(u)run();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&user)run();});
 window.addEventListener('online',()=>{if(user)run();});
}
/* solo per i test automatici: sostituisce Firebase con un finto cloud */
export function _mock(m,u){fb=m;user=u;}
