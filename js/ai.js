/* Gemini tramite Firebase AI Logic (provider Gemini Developer API).
   Usato solo da chi ha fatto l'accesso; un tetto giornaliero per dispositivo evita di consumare la quota per sbaglio. */
import{firebase,signedIn}from'./sync.js';
import{recaptchaSiteKey}from'./firebase-config.js';
const V='13.4.0', MODELS=['gemini-3.8-flash','gemini-3.5-flash-lite','gemini-flash-latest'], LIMIT_KEY='dietaApp.aiUse', DAY_MAX=60;
let sdk=null;export let last='';/* ultimo modello che ha risposto */
async function load(){if(sdk)return sdk;const fb=await firebase();
 /* App Check (obbligatorio per AI Logic): Fraud Defense (reCAPTCHA Enterprise) invisibile; in locale, per i test, un token di debug registrato nella console */
 const dbg=location.hostname==='localhost'&&localStorage.getItem('dietaApp.acDebug');if(dbg)self.FIREBASE_APPCHECK_DEBUG_TOKEN=dbg;
 if(!recaptchaSiteKey&&!dbg)throw new Error('appcheck');
 const ac=await import(`https://www.gstatic.com/firebasejs/${V}/firebase-app-check.js`);
 try{ac.initializeAppCheck(fb.app,{provider:new ac.ReCaptchaEnterpriseProvider(recaptchaSiteKey||'debug'),isTokenAutoRefreshEnabled:true});}catch(e){/* già inizializzato */}
 const ai=await import(`https://www.gstatic.com/firebasejs/${V}/firebase-ai.js`);
 sdk={ai,inst:ai.getAI(fb.app,{backend:new ai.GoogleAIBackend()})};return sdk;}
function use(){const d=new Date().toISOString().slice(0,10);let u={};try{u=JSON.parse(localStorage.getItem(LIMIT_KEY))||{};}catch{}
 if(u.d!==d)u={d,n:0};if(u.n>=DAY_MAX)throw new Error('limite');u.n++;localStorage.setItem(LIMIT_KEY,JSON.stringify(u));}
export const available=()=>signedIn();
/* chiede una risposta JSON che rispetta lo schema; parts = testo o [testo, {inlineData}] */
export async function askJSON(parts,schema,sys,opt={}){
 if(!signedIn())throw new Error('login');use();
 const{ai,inst}=await load();let err;
 /* modello occupato (500/503/429) o non disponibile (404): un secondo tentativo, poi il modello successivo */
 const retry=e=>/not.?found|404|unsupported|high demand|overloaded|unavailable|\[5\d\d|\[429|exhausted|timeout|timed out|abort/i.test(String(e&&e.message));
 for(const model of opt.models||MODELS)for(let k=0;k<2;k++){
  try{const m=ai.getGenerativeModel(inst,{model,systemInstruction:sys,generationConfig:{responseMimeType:'application/json',responseSchema:schema(ai.Schema),temperature:0}},{timeout:opt.timeout||40000});
   const r=await m.generateContent(parts);last=model;return JSON.parse(r.response.text());}
  catch(e){err=e;console.warn('AI',model,String(e&&e.message).slice(0,160));if(!retry(e))throw e;if(/404|not.?found|unsupported|\[429|exhausted/i.test(String(e.message)))break;/* quota finita: subito il modello successivo */if(k===0)await new Promise(r=>setTimeout(r,1500));}
 }
 throw err;
}
/* kcal per 100 g (o 100 ml) di un alimento, anche di marca */
export async function kcalEstimate(food){
 const r=await askJSON(`Alimento: "${food}"`,S=>S.object({properties:{
   kcal100:S.number({description:'kcal per 100 g (o per 100 ml se è un liquido), del prodotto come si mangia; se ha senso, crudo'}),
   base:S.enumString({enum:['g','ml']}),
   affidabilita:S.enumString({enum:['alta','media','bassa']}),
   nome:S.string({description:'nome dell\'alimento come l\'hai interpretato, in italiano'})}}),
  'Sei un esperto di composizione degli alimenti (tabelle CREA, etichette dei prodotti venduti in Italia). Dai il valore energetico medio. Se il nome è un prodotto di marca usa i valori della sua etichetta se li conosci, altrimenti quelli di un prodotto equivalente e metti affidabilità bassa. Non inventare precisione: arrotonda all\'unità.',{models:['gemini-3.5-flash-lite','gemini-3.8-flash'],timeout:20000});
 const k=Math.round(+r.kcal100);if(!(k>0&&k<=900))throw new Error('risposta');
 return{kcal100:k,base:r.base||'g',conf:r.affidabilita||'media',name:r.nome||food};
}
export function errText(e,alt='scrivi le kcal a mano'){const m=String(e&&e.message||e);
 if(m==='login')return'Per la stima con l\'AI accedi con Google (Impostazioni → Account)';
 if(m==='limite')return'Hai raggiunto il limite giornaliero di richieste all\'AI: riprova domani';
 if(m==='appcheck'||/app.?check/i.test(m))return'L\'AI non è configurata su questo indirizzo (App Check): '+alt;
 if(!navigator.onLine)return'Sei offline: '+alt;
 if(/quota|429|exhausted/i.test(m))return'L\'AI è occupata (quota del servizio): riprova tra qualche minuto';
 return'Richiesta all\'AI non riuscita: '+alt;}
