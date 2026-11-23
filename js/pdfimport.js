/* Import di un piano da PDF: Gemini legge il PDF e restituisce le "giornate" (7 giorni o giornate tipo);
   l'utente abbina una giornata a ogni giorno della settimana e rivede tutto prima di salvare. */
import{askJSON}from'./ai.js';
export const WD=[['lun','Lunedì'],['mar','Martedì'],['mer','Mercoledì'],['gio','Giovedì'],['ven','Venerdì'],['sab','Sabato'],['dom','Domenica']];
export const TYPES=['latte','yogurt','yogurtpro','pane','cerealicol','creme','marmellata','frutta','bosco','snack','crackers','dolce','fruttasecca','legumi','verdure','patate','olio','carne','pesce','pescecons','salume','uova','formaggio','tofu','soia','primo','minestra','piattounico','piadina','integratore','bevanda','condimento','altro'];
export const UNITS=['g','ml','pz','cucchiaini','cucchiai','vasetto','porzione','fetta','tazzina','misurino'];
export const MAX_MB=15;
const SYS=`Sei un assistente che trascrive piani alimentari di nutrizionisti italiani in dati strutturati. Trascrivi fedelmente, senza inventare alimenti o quantità.
Regole:
- "days": se il piano è settimanale, una voce per ciascun giorno (Lunedì…Domenica) con "weekdays" = [quel giorno]. Se invece il piano descrive giornate tipo (es. "giorni ON/allenamento", "giorni OFF", "un giorno della settimana", "domenica"), una voce per ogni giornata tipo con un nome chiaro; in "weekdays" metti solo i giorni indicati esplicitamente nel PDF, altrimenti lascia vuoto.
- "meals": i nomi dei pasti nell'ordine della giornata (es. Colazione, Spuntino, Pranzo, Merenda, Pre allenamento, Cena, Durante la giornata).
- Ogni voce di un pasto ("items") è un alimento con le sue alternative: in "options" metti per primo l'alimento principale e poi TUTTE le alternative, ciascuna con la sua quantità. Se il piano rimanda a liste di scambio o di equivalenza (es. "carne fresca, lista C"), le opzioni sono tutti gli alimenti di quella lista con le quantità indicate.
- Quantità: "qty" numero, "unit" una delle unità ammesse; converti "gr" in "g", "cc" in "ml", "cucchiaino" in "cucchiaini", "1 vasetto" in qty 1 unit "vasetto". Se manca la quantità usa qty 1 unit "porzione".
- Calorie: per ogni opzione stima "kcal100" (kcal per 100 g o 100 ml) se l'unità è g o ml, altrimenti "kcalUnit" (kcal per una unità). Per i prodotti di marca usa i valori di etichetta se li conosci. Per caffè, tè, acqua, integratori senza calorie metti 0.
- Pasti liberi (es. "cena a tua scelta: pizza", "pranzo libero"): una sola voce con "free": true, "label" il testo (es. "Pizza a scelta") e una sola opzione con quel nome, qty 1, unit "porzione".
- "type": la categoria più vicina tra quelle ammesse; integratori (aminoacidi, whey, creatina, vitamine) = "integratore"; caffè/tè/bevande = "bevanda"; spezie, sale, aceto = "condimento".
- "label": nome breve della voce (es. "Pane", "Latte", "Carne fresca", "Yogurt greco").
- "notes": le note generali (integratori, consigli, respirazione, idratazione) come testo semplice e conciso. "note" di una giornata o di una voce: solo indicazioni importanti (es. "dopo l'allenamento").`;
const schema=S=>{
 const opt=S.object({properties:{name:S.string(),qty:S.number(),unit:S.enumString({enum:UNITS}),kcal100:S.number(),kcalUnit:S.number()},optionalProperties:['kcal100','kcalUnit']});
 const item=S.object({properties:{label:S.string(),type:S.enumString({enum:TYPES}),free:S.boolean(),note:S.string(),options:S.array({items:opt})},optionalProperties:['free','note']});
 const meal=S.object({properties:{meal:S.string({description:'nome del pasto, uguale a uno di "meals"'}),items:S.array({items:item})}});
 const day=S.object({properties:{name:S.string(),weekdays:S.array({items:S.enumString({enum:WD.map(w=>w[0])})}),note:S.string(),meals:S.array({items:meal})},optionalProperties:['weekdays','note']});
 return S.object({properties:{title:S.string(),author:S.string({description:'nome del nutrizionista con titolo'}),date:S.string({description:'data della visita o del piano, se indicata'}),notes:S.string(),meals:S.array({items:S.string()}),days:S.array({items:day})},optionalProperties:['title','author','date','notes']});
};
const b64=buf=>{const u=new Uint8Array(buf);let s='';for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));return btoa(s);};
/* legge il PDF con Gemini; restituisce la bozza "grezza" ripulita */
export async function extract(file){
 if(file.size>MAX_MB*1024*1024)throw new Error('troppo grande');
 const data=b64(await file.arrayBuffer());
 const raw=await askJSON([{text:'Trascrivi questo piano alimentare.'},{inlineData:{mimeType:'application/pdf',data}}],schema,SYS,{models:['gemini-3.8-flash','gemini-3.6-flash','gemini-3.5-flash-lite'],timeout:240000});
 return clean(raw);
}
const num=x=>typeof x==='number'&&isFinite(x)?x:+x;
/* testi scritti TUTTI IN MAIUSCOLO: nomi con le iniziali maiuscole, frasi in minuscolo con la maiuscola a inizio frase */
const caps=(t,r=.7)=>{const l=t.replace(/[^A-Za-zÀ-ÿ]/g,'');return l.length>=4&&l.replace(/[^A-ZÀ-Þ]/g,'').length/l.length>r;};
const STOP=new Set(['di','da','de','del','della','dei','delle','e','con','senza','al','alla','ai','in','per','ad','a','la','il','lo','le','gli']);
const fixName=t=>{t=String(t||'').trim().replace(/\s+/g,' ');if(!caps(t))return t;let par=0,first=true;
 /* parola per parola: iniziale maiuscola; congiunzioni in minuscolo; sigle brevi tra parentesi (MD, BIO) restano maiuscole */
 return t.replace(/[A-Za-zÀ-ÿ]+|[()]/g,(w,at)=>{if(w==='(')return par++,w;if(w===')')return par--,w;const l=w.toLowerCase(),f=first;first=false;
  if(par>0&&w.length<=3&&w===w.toUpperCase())return w;if(!f&&STOP.has(l)&&/^(\s|$)/.test(t.slice(at+w.length,at+w.length+1)))return l;return l.charAt(0).toUpperCase()+l.slice(1);});};
const fixText=t=>{t=String(t||'').trim();if(!caps(t,.5))return t;return t.toLowerCase().replace(/(^|[.!?:]\s+|\n\s*)([a-zà-ÿ])/g,(m,a,b)=>a+b.toUpperCase());};
export function clean(r){
 r=r||{};const days=(r.days||[]).filter(d=>d&&Array.isArray(d.meals));
 days.forEach(d=>{d.name=fixName(d.name||'Giornata');d.note=d.note?fixText(d.note):'';d.weekdays=[...new Set((d.weekdays||[]).filter(w=>WD.some(x=>x[0]===w)))];
  d.meals=d.meals.filter(m=>m&&m.meal&&Array.isArray(m.items)).map(m=>({meal:fixName(m.meal),items:m.items.filter(c=>c&&Array.isArray(c.options)&&c.options.length).map(c=>({
   label:fixName(c.label||c.options[0].name||'Alimento'),type:TYPES.includes(c.type)?c.type:'altro',free:!!c.free,note:c.note?fixText(c.note):'',
   options:c.options.filter(o=>o&&o.name).map(o=>{const q=num(o.qty),u=UNITS.includes(o.unit)?o.unit:'porzione',x={name:fixName(o.name),qty:q>0?q:1,unit:u};
    const k=num(u==='g'||u==='ml'?o.kcal100:o.kcalUnit);if(k>=0&&k<=1500)x.kcal=Math.round(k);return x;})})).filter(c=>c.options.length)})).filter(m=>m.items.length);});
 const meals=[...(r.meals||[]).map(m=>String(m).trim()).filter(Boolean)];
 days.forEach(d=>d.meals.forEach(m=>{if(!meals.some(x=>x.toLowerCase()===m.meal.toLowerCase()))meals.push(m.meal);}));
 const t=fixText(r.title||'');return{title:t,author:fixName(r.author||''),date:fixText(r.date||'').toLowerCase(),notes:fixText(r.notes||''),meals:meals.map(fixName),days:days.filter(d=>d.meals.length)};
}
/* abbinamento proposto: indice della giornata per ogni giorno lun…dom */
export function defaultMap(r){
 const n=r.days.length, map=Array(7).fill(null);
 r.days.forEach((d,i)=>d.weekdays.forEach(w=>{const j=WD.findIndex(x=>x[0]===w);if(map[j]==null)map[j]=i;}));
 if(map.every(x=>x!=null))return map;
 const free=i=>r.days[i].meals.some(m=>m.items.some(c=>c.free));
 const nm=i=>r.days[i].name.toLowerCase();
 const left=r.days.map((d,i)=>i).filter(i=>!r.days[i].weekdays.length);
 const off=left.find(i=>/\boff\b|non\s*allen|riposo|recupero/.test(nm(i)));
 const on=left.find(i=>i!==off&&/\bon\b|allenament|training/.test(nm(i)));
 const spec=left.find(i=>i!==off&&i!==on&&(free(i)||/un giorno|libero|sgarro|pizza|weekend/.test(nm(i))));
 if(on!=null&&off!=null){
  [0,2,4].forEach(j=>{if(map[j]==null)map[j]=on;});
  if(map[5]==null&&spec!=null)map[5]=spec;
  map.forEach((x,j)=>{if(x==null)map[j]=off;});
 }else{const pool=left.length?left:r.days.map((d,i)=>i);let k=0;map.forEach((x,j)=>{if(x==null)map[j]=pool[k++%pool.length];});}
 return map.map(x=>Math.min(x,n-1));
}
/* chiavi e icone dei pasti */
const MEAL_KEYS=[[/colazione/,'col','☕'],[/pre.?allen|pre.?workout|prima dell.allen/,'pre','💪'],[/post.?allen|dopo l.allen/,'post','🏋️'],[/pranzo/,'pra','🍽️'],[/merenda|pomerig/,'mer','🥜'],[/spuntino serale|dopo cena|sera/,'spu','🍫'],[/cena/,'cen','🌙'],[/spuntino|met[aà] mattina|mattin/,'mm','🍎'],[/giornata|durante|nel corso/,'gio','💧']];
export function mealKeys(names){const used=new Set();return names.map(n=>{const l=n.toLowerCase();let hit=MEAL_KEYS.find(([re,k])=>re.test(l)&&!used.has(k));
 let key=hit?hit[1]:l.normalize('NFD').replace(/[^\w]+/g,'-').replace(/^-|-$/g,'').slice(0,20)||'pasto';while(used.has(key))key+='2';used.add(key);
 return{key,name:n.charAt(0).toUpperCase()+n.slice(1).toLowerCase(),icon:hit?hit[2]:'🍴'};});}
/* bozza + abbinamento → piano dieta-plan v1 */
export function toPlan(r,map,meta={}){
 const meals=mealKeys(r.meals), key=n=>{const i=r.meals.findIndex(x=>x.toLowerCase()===String(n).toLowerCase());return meals[i<0?0:i].key;};
 const comp=c=>{if(c.free)return{type:'libera',label:c.label,free:true,options:[{name:c.options[0].name||c.label,qty:0,unit:''}],...(c.note?{note:c.note}:{})};
  return{type:c.type,label:c.label,...(c.note?{note:c.note}:{}),options:c.options.map(o=>{const x={name:o.name,qty:o.qty,unit:o.unit};
   if(o.kcal!=null){if(o.unit==='g'||o.unit==='ml')x.kcal100=o.kcal;else x.kcalUnit=o.kcal;}return x;})};};
 const days=WD.map(([k,n],j)=>{const t=r.days[map[j]],ms={};
  t.meals.forEach(m=>{const mk=key(m.meal);(ms[mk]=ms[mk]||[]).push(...m.items.map(comp));});
  const many=new Set(map).size<7||r.days.length!==7;
  return{key:k,name:n,...(many||t.note?{idea:[many?t.name:'',t.note].filter(Boolean).join(' · ')}:{}),meals:ms};});
 const used=new Set(days.flatMap(d=>Object.keys(d.meals)));
 const title=meta.title||r.title||'Piano da PDF', author=meta.author||r.author||'';
 const p={format:'dieta-plan',version:1,title,author,meals:meals.filter(m=>used.has(m.key)),days,
  credits:`Piano${author?' di '+author:''}${r.date?' ('+r.date+')':''}, letto da PDF con l'AI: le calorie sono stime.`};
 const notes=meta.notes!=null?meta.notes:r.notes;if(notes)p.notes=notes;
 return p;
}
