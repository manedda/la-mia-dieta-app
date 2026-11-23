/* Prodotti di marca da Open Food Facts (openfoodfacts.org, dati con licenza ODbL): ricerca per nome e per codice a barre.
   Serve internet. I prodotti che usi vengono salvati nell'app (S.brandFoods), così poi li trovi anche offline. */
import {norm,toks,index,search as csearch} from './cerca.js';
const API='https://world.openfoodfacts.org';
const FIELDS='code,product_name_it,product_name,brands,nutriments,quantity,unique_scans_n';
const num=v=>v==null||v===''||isNaN(+v)?null:+v, r1=x=>x==null?null:Math.round(x*10)/10;
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
/* prodotto di Open Food Facts → {n, nm, b, k, p, g, c, f, u, code}; null se mancano nome o kcal o i valori non tornano */
export function fromOFF(p,keepNoBrand=false){
 const n=p.nutriments||{};let k=num(n['energy-kcal_100g']);
 if(k==null&&num(n['energy-kj_100g'])!=null)k=num(n['energy-kj_100g'])/4.184;
 const nm=cap(String(p.product_name_it||p.product_name||'').replace(/\s+/g,' ').trim());
 const b=String(p.brands||'').split(',').map(s=>s.trim()).filter(Boolean)[0]||'';
 if(!nm||k==null||k<0||k>900||(!b&&!keepNoBrand))return null;
 const pr=num(n.proteins_100g),g=num(n.fat_100g),c=num(n.carbohydrates_100g),f=num(n.fiber_100g);
 /* kcal che non tornano con proteine, grassi e carboidrati: dato inserito male */
 if(pr!=null&&g!=null&&c!=null){const calc=4*pr+4*c+9*g+2*(f||0);if(Math.abs(calc-k)>Math.max(40,k*.25))return null;}
 const u=/\d\s*(ml|cl|l)\b/i.test(p.quantity||'')?'ml':'g';
 const bn=norm(b),name=b&&!norm(nm).includes(bn)?`${nm} (${b})`:nm;
 const bt=new Set(toks(p.brands||'').filter(t=>!FILL.has(t)));if(!bt.size)toks(nm).slice(0,1).forEach(t=>bt.add(t));
 return{n:name,nm,b,bt,k:Math.round(k),p:r1(pr),g:r1(g),c:r1(c),f:r1(f),u,code:String(p.code||''),src:'off',sc:p.unique_scans_n||0};
}
/* stesso prodotto in più formati (350 g, 700 g…) o scritto in modi diversi ("Biscotti Pan di Stelle", "Pan di Stelle, Mulino Bianco"):
   stessa azienda, stesso nome senza marche e parole generiche, stesse kcal (±3%) → ne tengo uno solo, il più usato */
const FILL=new Set('biscotti biscotto bisc classico classici classica originale original gusto gr g kg confezione pacco formato famiglia spa srl'.split(' '));
function core(e,o){return new Set(toks(e.nm).filter(t=>!FILL.has(t)&&!e.bt.has(t)&&!o.bt.has(t)));}
/* stessa azienda: una marca in comune, o la marca dell'uno nel nome dell'altro (Barilla "Biscotti Pan di Stelle" e Pan di Stelle) */
const kin=(a,b)=>{const nb=new Set(toks(b.nm));return[...a.bt].some(t=>b.bt.has(t)||nb.has(t));};
function same(a,b){if(!kin(a,b)&&!kin(b,a))return false;/* marche diverse: prodotti diversi anche se si chiamano uguale */
 const ca=core(a,b),cb=core(b,a);if(ca.size!==cb.size||[...ca].some(t=>!cb.has(t)))return false;
 return Math.abs(a.k-b.k)<=Math.max(5,Math.min(a.k,b.k)*.03);}
/* generic: alimenti già presenti nell'app [{n,k}] (banca dati IEO, piano, tuoi): un prodotto con lo stesso nome e le stesse kcal non lo ripeto */
export function dedupe(list,generic=[],codes=new Set()){
 const gen=new Map();generic.forEach(e=>{if(typeof e.k==='number')gen.set(norm(e.n),e.k);});
 const out=[];
 for(const e of[...list].sort((a,b)=>b.sc-a.sc)){
  if(codes.has(e.code))continue;
  const gk=gen.get(norm(e.n))??gen.get(norm(e.nm));if(gk!=null&&Math.abs(gk-e.k)<=Math.max(5,gk*.05))continue;
  if(out.some(o=>same(o,e)))continue;
  out.push(e);}
 return out;}
const mem=new Map();
const wait=ms=>new Promise(r=>setTimeout(r,ms));
/* quando è sovraccarico il servizio risponde 503 senza le intestazioni CORS, e il browser lo vede come errore di rete: riprovo una volta */
async function getJSON(url){let last=null;
 for(let a=0;a<2;a++){if(a)await wait(1500);
  const ac=typeof AbortController!='undefined'?new AbortController():null,to=ac&&setTimeout(()=>ac.abort(),12000);
  try{const r=await fetch(url,ac?{signal:ac.signal}:{});clearTimeout(to);if(r.ok)return await r.json();last=r.status;if(r.status!==503&&r.status!==429&&r.status!==502)throw Object.assign(new Error('HTTP '+r.status),{fatal:true});}
  catch(e){clearTimeout(to);if(e.fatal)throw e;last=e;}}
 throw Object.assign(new Error('busy'),{busy:typeof navigator=='undefined'||navigator.onLine!==false,cause:last});}
/* ricerca per nome tra i prodotti venduti in Italia; ordino e filtro con la stessa ricerca tollerante dell'app */
export function search(q){const key=norm(q);if(mem.has(key))return mem.get(key);
 const url=API+'/cgi/search.pl?'+new URLSearchParams({search_terms:q,search_simple:1,action:'process',json:1,page_size:50,tagtype_0:'countries',tag_contains_0:'contains',tag_0:'italy',fields:FIELDS});
 const pr=getJSON(url).then(d=>{const all=(d.products||[]).map(p=>fromOFF(p)).filter(Boolean);
  const ix=index(all.map(e=>({...e,n:e.nm,alias:e.b,full:e.n})));
  return csearch(ix,q,50).map(e=>({...e,n:e.full}));});
 mem.set(key,pr);pr.catch(()=>mem.delete(key));return pr;}
/* codice a barre → prodotto (anche senza marca), null se non c'è */
export async function byCode(code){const d=await getJSON(`${API}/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`);
 return d&&d.status===1&&d.product?fromOFF({code,...d.product},true):null;}
/* lettore di codici a barre: quello del browser se c'è (Chrome su Android), altrimenti una libreria caricata solo quando serve (iPhone) */
const F=['ean_13','ean_8','upc_a','upc_e'];let lib=null;
export async function detector(){
 if('BarcodeDetector' in self){try{const s=await BarcodeDetector.getSupportedFormats(),ok=F.filter(f=>s.includes(f));if(ok.length)return new BarcodeDetector({formats:ok});}catch(e){}}
 lib=lib||import('https://cdn.jsdelivr.net/npm/barcode-detector@3.2.4/ponyfill/+esm');
 const m=await lib;return new m.BarcodeDetector({formats:F});}
