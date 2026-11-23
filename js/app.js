/* ====== PIANO: caricato da un file JSON nel formato "dieta-plan" (vedi docs/formato-piano.md) ======
   Dentro l'app ogni opzione resta un array [nome, quantità, unità, acquisti?] e ogni componente {t, label, opts, ...} */
import * as CERCA from'./cerca.js';
import{loadActivePlan,loadPrefs,isExample,planErrors,readPlans,writePlans,newPlanId,writePrefs,readLocalPrefs,clearPrefs,today,bootDone}from'./store.js';
const {st:PLANS,rec:PLAN_REC}=await loadActivePlan(), {prefs:PREFS,local:PREFS_LOCAL}=await loadPrefs();
const PLAN=PLAN_REC.plan;
const fromJSON=o=>{const a=[o.name,o.qty,o.unit];if(o.buy)a.push(o.buy.map(b=>b.cat?[b.name,b.qty,b.unit,b.cat]:[b.name,b.qty,b.unit]));return a;};
const DAYS=PLAN.days.map(d=>({k:String(d.key),n:d.name,idea:d.idea||'',meals:Object.fromEntries(Object.entries(d.meals).map(([mk,cs])=>[mk,cs.map(({type,label,options,...x})=>({t:type,label,opts:options.map(fromJSON),...x}))]))}));
const MEALS=PLAN.meals.map(m=>[m.key,m.name,m.icon]);
const SHOP_CAT={verdure:'Frutta e verdura',frutta:'Frutta e verdura',bosco:'Frutta e verdura',patate:'Frutta e verdura',minestra:'Frutta e verdura',
 carne:'Carne e salumi',salume:'Carne e salumi',pesce:'Pesce',pescecons:'Pesce',latte:'Latte, yogurt e uova',yogurt:'Latte, yogurt e uova',yogurtpro:'Latte, yogurt e uova',uova:'Latte, yogurt e uova',
 formaggio:'Formaggi e tofu',tofu:'Formaggi e tofu',pane:'Pane e prodotti da forno',piadina:'Pane e prodotti da forno',crackers:'Pane e prodotti da forno',
 cerealicol:'Colazione e dolci',creme:'Colazione e dolci',marmellata:'Colazione e dolci',primo:'Pasta, riso e legumi',legumi:'Pasta, riso e legumi',piattounico:'Pasta, riso e legumi',
 condimento:'Condimenti',bevanda:'Colazione e dolci',
 piselli:'Surgelati',fruttasecca:'Frutta secca',snack:'Snack e dolci',dolce:'Snack e dolci',olio:'Condimenti',soia:'Condimenti'};
const CAT_ORDER=['Frutta e verdura','Carne e salumi','Pesce','Latte, yogurt e uova','Formaggi e tofu','Pane e prodotti da forno','Colazione e dolci','Pasta, riso e legumi','Surgelati','Frutta secca','Snack e dolci','Condimenti','Altro'];
const CAT_ICON={'Frutta e verdura':'🥬','Carne e salumi':'🥩','Pesce':'🐟','Latte, yogurt e uova':'🥛','Formaggi e tofu':'🧀','Pane e prodotti da forno':'🥖','Colazione e dolci':'🍯','Pasta, riso e legumi':'🍝','Surgelati':'❄️','Frutta secca':'🌰','Snack e dolci':'🍫','Condimenti':'🫒','Altro':'🛒'};
/* ====== STATO (salvato nel browser) ====== */
const LS='dietaApp.v1';
const S=Object.assign({picks:{},shopDays:[],checked:{},hidden:{},custom:[],tab:'piano',day:null,diary:{},customFoods:[],conv:null,swap:{},dplan:{},ui:{},shopLog:{}},JSON.parse(localStorage.getItem(LS)||'{}'));
const save=()=>{if(window.dietaFrozen)return;localStorage.setItem(LS,JSON.stringify(S));window.dispatchEvent(new Event('dieta:changed'));};
/* scelte che dipendono dal piano: quando cambi piano vengono messe da parte con il piano vecchio e riprese se torni a usarlo */
const PLAN_KEYS=['picks','swap','dplan','checked','hidden','shopDays','day'];
const PLAN_DEF=()=>({picks:{},swap:{},dplan:{},checked:{},hidden:{},shopDays:[],day:null});
S.dplanned=S.dplanned||{};
S.pantry=S.pantry||{};
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const unitFmt=(q,u)=>{if(!u)return'';if(u==='g')return`${q} g`;if(u==='pz')return q===1?'1 pz':`${q} pz`;
 if(u==='cucchiaini')return q===1?'1 cucchiaino':`${q} cucchiaini`;if(u==='vasetto')return q===1?'1 vasetto':`${q} vasetti`;if(u==='porzione')return q===1?'1 porzione':`${q} porzioni`;return`${q} ${u}`;};
const optDetail=(c,o)=>{if(c.detail)return c.detail;if(c.odet&&c.odet[o[0]])return c.odet[o[0]];if(o[3]&&!(o[3].length===1&&o[3][0][0]===o[0]))return o[3].map(b=>`${b[0]} ${unitFmt(b[1],b[2])}`).join(' + ');return unitFmt(o[1],o[2]);};
const pkey=(d,m,i)=>`${d}|${m}|${i}`;
const todayIdx=()=>(new Date().getDay()+6)%7;
if(S.day==null||!DAYS.some(d=>d.k===S.day))S.day=DAYS[todayIdx()].k;
S.shopDays=S.shopDays.filter(k=>DAYS.some(d=>d.k===k));
if(!S.shopDays.length)S.shopDays=DAYS.filter(d=>d.k!=='').map(d=>d.k);
Object.keys(S.swap).forEach(k=>{if(!DAYS.some(d=>d.k===k)||!DAYS.some(d=>d.k===S.swap[k]))S.swap={};});
Object.keys(S.dplan).forEach(iso=>{if(!DAYS.some(d=>d.k===S.dplan[iso]))delete S.dplan[iso];});
Object.keys(S.picks).forEach(k=>{const [dk,mk,i]=k.split('|'),d=DAYS.find(x=>x.k===dk),c=d&&d.meals[mk]&&d.meals[mk][+i];if(!c||!(+S.picks[k]<c.opts.length))delete S.picks[k];});

/* ====== PIANO ====== */
const wkDate=i=>{const t=new Date();t.setHours(12,0,0,0);t.setDate(t.getDate()+i-todayIdx());return t;};
function renderDays(){
 $('#days').innerHTML=DAYS.map((d,i)=>`<button class="chip ${S.day===d.k?'on':''}${i===todayIdx()?' td':''}" data-day="${esc(d.k)}"><span class="wd">${esc(d.n.slice(0,3))}</span><b class="dn">${wkDate(i).getDate()}</b>${planK(d.k)!==d.k?`<small>⇄ ${esc(planOf(d.k).n.slice(0,3))}</small>`:''}${i===todayIdx()?'<i class="dot"></i>':''}</button>`).join('');
}
/* ====== CALORIE (kcal per 100 g, oppure [kcal, unità] per pezzo/porzione). Valori medi indicativi ====== */
const KCAL={
'Latte parzialmente scremato di vacca':46,'Pane bianco':275,'Pane integrale':243,'Crema di nocciole e cacao':540,'Burro di arachidi cremoso':588,'Crema di anacardi':590,'Crema di mandorle':615,
'Frutta fresca di stagione':[70,'porzione'],'Misto di verdure cotte':[50,'porzione'],'Misto di verdure crude':[40,'porzione'],'Misto di verdure cotte (per minestra)':25,
'Olio extra vergine di oliva':[45,'cucchiaini'],'Olio di oliva':[45,'cucchiaini'],'Snack di parmigiano':392,'Crackers integrali':410,'Triangolini di mais':480,
'Ceci secchi':334,'Fagioli secchi':291,'Lenticchie secche':291,'Misto legumi secchi':305,'Uova di gallina':[75,'pz'],
'Noci secche':689,'Mandorle':603,'Nocciole':655,'Noci pecan':691,'Pinoli':595,
'Cavallo':133,'Coscia di pollo':120,'Coscia di tacchino':115,'Hamburger di manzo':200,'Hamburger di pollo':150,'Maiale magro':140,'Manzo magro':130,'Petto di pollo':100,'Petto di tacchino':107,'Vitello magro':92,
'Calamari':68,'Cozze':84,'Dentice':101,'Gamberi':71,'Merluzzo o Nasello':71,'Orata':121,'Palombo':80,'Pesce San Pietro':81,'Pesce spada':109,'Platessa':83,'Polpo':57,'Salmone fresco':185,'Sarago':100,'Sardine':129,'Seppie':72,'Sgombro':170,'Sogliola':83,'Spigola':82,'Tonno fresco':159,'Trota':86,'Vongole':72,
'Salmone affumicato':147,'Tonno al naturale':103,
'Amaranto':371,'Couscous':360,'Gnocchi di patate':150,'Grano saraceno':343,'Orzo':319,'Pasta di mais':360,'Pasta di semola':353,'Pasta integrale':324,'Polenta':362,'Quinoa':368,'Riso':332,'Riso integrale':337,'Riso selvatico':357,'Farro':335,
'Feta':250,'Feta o Brie':285,'Fiocchi di formaggio magro':100,'Formaggio cremoso light':150,'Galbanino':290,'Gorgonzola':324,'Mozzarella light':[200,'pz'],'Parmigiano':392,'Primosale':260,'Provolone':374,'Ricotta di vacca':146,'Robiola':300,'Scamorza':334,'Taleggio':315,
'Bresaola':151,'Fesa di pollo arrosto':100,'Fesa di tacchino arrosto':110,'Prosciutto cotto':215,'Prosciutto crudo magro':160,'Speck':303,
'Biscotti integrali':440,'Biscotti secchi':416,'Farro soffiato':370,'Fette biscottate':410,'Fette biscottate integrali':400,"Fiocchi d'avena":368,'Fiocchi di farro':340,'Fiocchi di mais':375,'Muesli':365,'Orzo soffiato':365,'Riso soffiato':380,
'Yogurt greco da latte scremato (150 g)':[86,'vasetto'],'Barretta proteica Enervit (40 g)':[150,'pz'],'Pancarrè':270,'Sottilette':[55,'pz'],'Piadina':300,'Tofu fresco':130,
'Yogurt da bere proteico':[170,'pz'],'Yogurt proteico Danone':56,'Ricotta di vacca (30 g)':146,'Marmellata':[22,'cucchiaini'],'Marmellata a ridotto tenore di zucchero':[14,'cucchiaini'],'Miele':[21,'cucchiaini'],
'Cioccolato fondente':515,'Patate':85,'Patate dolci':86,'Mirtilli':45,'Lamponi':40,'More':40,'Piselli surgelati':70,'Salsa di soia':60
};
/* pochi alimenti che la banca dati BDA non ha (tutti gli altri fuori piano vengono da data/alimenti.json) */
const EXTRA={
'Pane e cereali':{'Fregola sarda':360,'Malloreddus (gnocchetti sardi)':350},
'Verdura':{'Funghi champignon':22},
'Condimenti':{'Hummus di ceci':200,'Ketchup':112}
};
const kTab=()=>Object.assign({},KCAL,...Object.values(EXTRA),Object.fromEntries((S.customFoods||[]).map(f=>[f.n,f.k])));
function kcalOf(n,q,u,buy){
 if(buy)return buy.reduce((a,b)=>{const k=kcalOf(b[0],b[1],b[2]);return a==null||k==null?null:a+k;},0);
 const e=kGet(n);if(e==null)return null;
 if(typeof e==='number')return u==='g'||u==='ml'?q*e/100:null;/* per 100 g o 100 ml */
 return u===e[1]?q*e[0]:null;
}
const kFmt=k=>k==null?'':`${Math.round(k)} kcal`;

/* ====== BANCA DATI ALIMENTI (BDA IEO, oltre 1.100 alimenti, caricata a parte) e ricerca tollerante ====== */
let BDA=null,bix=null,fix=null,fixKey='';const BDAM=new Map();
fetch('data/alimenti.json').then(r=>r.json()).then(d=>{BDA=d.alimenti.map(r=>({n:r[0],k:r[1],p:r[2],g:r[3],c:r[4],f:r[5],cat:d.categorie[r[6]],u:r[7]||'g',alias:r[8]||'',src:'bda'}));
 BDA.forEach(e=>BDAM.set(e.n,e));if(S.tab==='calorie')renderCalorie();}).catch(e=>console.warn('Banca dati alimenti non caricata',e));
/* kcal di un nome esatto: piano, aggiunte e tuoi alimenti, poi banca dati */
function kGet(n){const e=kTab()[n];if(e!=null)return e;const b=BDAM.get(n);return b?b.k:null;}
const bdaIx=()=>bix||(BDA?bix=CERCA.index(BDA):[]);
function foodIx(){const cf=S.customFoods||[],key=(BDA?BDA.length:0)+'|'+cf.map(f=>f.n+':'+f.k).join(',');if(fix&&key===fixKey)return fix;fixKey=key;
 const own=new Set(cf.map(f=>f.n)),ex=new Set(Object.values(EXTRA).flatMap(Object.keys)),tab=kTab();
 fix=CERCA.index([...Object.entries(tab).map(([n,k])=>({n,k,u:'g',src:own.has(n)?'tuo':ex.has(n)?'extra':'piano',pri:own.has(n)?2:ex.has(n)?0.5:1.5})),...(BDA||[]).filter(b=>tab[b.n]==null)]);return fix;}
const foodSearch=(q,l)=>CERCA.search(foodIx(),q,l), foodBest=q=>CERCA.best(foodIx(),q);
const nFmt=x=>String(x).replace('.',',');
const perE=e=>Array.isArray(e.k)?`${e.k[0]} kcal / ${unitFmt(1,e.k[1])}`:`${e.k} kcal / 100 ${e.u==='ml'?'ml':'g'}`;

/* ====== ALTERNATIVE FISSE A COLAZIONE (preferenze: breakfastExtras), con quantità a parità di kcal medie ====== */
const XTRA=PREFS.breakfastExtras||[];
XTRA.forEach(x=>{if(x.kcal100!=null)KCAL[x.name]=x.kcal100;});
/* kcal scritte nel piano (facoltative): valgono più della tabella interna */
PLAN.days.forEach(d=>Object.values(d.meals).forEach(cs=>cs.forEach(c=>c.options.forEach(o=>{if(o.kcal100!=null)KCAL[o.name]=o.kcal100;else if(o.kcalUnit!=null)KCAL[o.name]=[o.kcalUnit,o.unit];}))));
const optK=o=>kcalOf(o[0],o[1],o[2],o[3]);
const avgK=c=>{const ks=c.opts.map(optK).filter(k=>k!=null);return ks.reduce((a,b)=>a+b,0)/ks.length;};
const round=(x,s)=>Math.max(s,Math.round(x/s)*s);
DAYS.forEach(d=>{
 const col=d.meals.col||[];
 XTRA.forEach(x=>{
  if(x.skipIfMealHas&&col.some(c=>c.t===x.skipIfMealHas))return;
  const c=x.addTo.map(t=>col.find(c=>c.t===t)).find(Boolean), per100=typeof KCAL[x.name]==='number'?KCAL[x.name]:null;
  if(!c||!per100)return;
  const q=round(avgK(c)/per100*100,x.round||5);
  if(c.detail){c.odet=Object.fromEntries(c.opts.map(o=>[o[0],c.detail]));c.detail=null;}
  const u=x.kcalBase==='ml'?'ml':'g';c.opts.push([x.name,q,u,[[x.name,q,u,x.cat||'Altro']]]);c.label+=x.labelSuffix||'';
 });
});
/* tipo "effettivo" di un'opzione (serve alle ricette quando scegli un'alternativa fissa al posto di altro) */
const XT=Object.fromEntries(XTRA.filter(x=>x.recipeType).map(x=>[x.name,x.recipeType]));
const xShort=n=>(XTRA.find(x=>x.name===n)||{}).short||n;
const effT=(c,o)=>XT[o[0]]&&c.t!==XT[o[0]]?XT[o[0]]:c.t;

/* ====== DATE ====== */
const isoOf=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const dateOf=s=>{const [y,m,dd]=s.split('-').map(Number);return new Date(y,m-1,dd);};
const cap=s=>s.replace(/(^|\s)(\S)/g,(m,a,b)=>a+b.toUpperCase());
const longDate=d=>cap(d.toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long',year:'numeric'}));
const dayIdxOf=d=>(d.getDay()+6)%7;
/* ====== SCAMBIO GIORNI: S.swap = {giorno: piano seguito} (sempre una permutazione), S.dplan = {data: piano} nel diario ====== */
const planK=k=>S.swap[k]||k;
const planOf=k=>DAYS.find(x=>x.k===planK(k));
const wdOf=iso=>DAYS[dayIdxOf(dateOf(iso))];
const dPlanK=iso=>S.dplan[iso]||planK(wdOf(iso).k);
const dPlan=()=>DAYS.find(x=>x.k===dPlanK(diaryDate));
function swapDays(a,t){const pa=planK(a);if(pa===t)return false;const b=DAYS.map(d=>d.k).find(k=>planK(k)===t);S.swap[a]=t;S.swap[b]=pa;DAYS.forEach(d=>{if(S.swap[d.k]===d.k)delete S.swap[d.k];});return b;}
const del=k=>(k==='dom'?'della ':'del ')+DAYS.find(x=>x.k===k).n.toLowerCase();
const swapOpts=(sel,own)=>DAYS.map(d=>`<option value="${esc(d.k)}" ${d.k===sel?'selected':''}>${esc(d.n)}${d.k===own?' (il suo)':''}</option>`).join('');

/* ====== PIANO (tutti gli alimenti visibili, si spunta quello scelto) ====== */
const compK=(c,sel)=>{const ks=(sel!=null&&sel!==''?[c.opts[+sel]]:c.opts).map(optK).filter(k=>k!=null);return ks.length?[Math.min(...ks),Math.max(...ks)]:[0,0];};
const rFmt=([a,b])=>Math.round(a)===Math.round(b)?`${Math.round(a)} kcal`:`${Math.round(a)}–${Math.round(b)} kcal`;
function dayRange(d){let t=[0,0];MEALS.forEach(([mk])=>(d.meals[mk]||[]).forEach((c,i)=>{if(c.free)return;const k=compK(c,S.picks[pkey(d.k,mk,i)]);t[0]+=k[0];t[1]+=k[1];}));return t;}
function renderPlan(){
 const wd=DAYS.find(x=>x.k===S.day), d=planOf(S.day), AP=autoPicks();
 $('#dayTitle').textContent=wd.n+(DAYS[todayIdx()].k===wd.k?' · oggi':'');
 $('#daySwap').innerHTML=swapOpts(d.k,wd.k);$('#daySwap').classList.toggle('alt',d.k!==wd.k);
 $('#swapReset').hidden=!Object.keys(S.swap).length;
 $('#dayIdea').innerHTML=d.idea?`<span>💡 Idee della nutrizionista:</span> ${esc(d.idea)}`:'';
 $('#dayIdea').hidden=!d.idea;
 const hasFree=MEALS.some(([mk])=>(d.meals[mk]||[]).some(c=>c.free));
 const dr=dayRange(d), di=DAYS.findIndex(x=>x.k===S.day), iso=isoOf(wkDate(di)), fut=iso>isoOf(new Date()), got=Math.round((S.diary[iso]||[]).reduce((s,x)=>s+(+x.k||0),0)), mid=(dr[0]+dr[1])/2, pct=mid?Math.min(100,Math.round(got/mid*100)):0;
 $('#dayKcal').innerHTML=`<b>≈ ${rFmt(dr)}</b><small>previste${hasFree?', escluso il pasto libero':''}</small>`;
 const rg=$('#dayRing');rg.dataset.wgo=iso;rg.style.setProperty('--p',fut?0:pct);rg.innerHTML=`<i>${fut||!got?'<svg viewBox="0 0 24 24"><path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3z"/><path d="M9 9h6M9 13h6"/></svg>':pct+'%'}</i>`;
 $('#dayDiary').textContent=fut?`Diario: dal ${wkDate(di).toLocaleDateString('it-IT',{day:'numeric',month:'short'})}`:got?`Diario: ${got} kcal`:'Diario: niente segnato';
 $('#meals').innerHTML=MEALS.map(([mk,mn,ic])=>{
  const comps=d.meals[mk]||[];
  if(!comps.length)return'';
  const free=comps[0].free;let mK=[0,0];
  const rows=comps.map((c,i)=>{
   if(c.free)return`<div class="row free">Pasto libero, goditelo 🙂</div>`;
   const key=pkey(d.k,mk,i), sel=S.picks[key], ck=compK(c,sel), sug=isSel(sel)?-1:(AP[key]??-1);mK[0]+=ck[0];mK[1]+=ck[1];
   if(c.opts.length===1){const o=c.opts[0],k=optK(o);return`<div class="row"><span class="lbl">${esc(c.label)}</span><span class="val"><span class="vn">${esc(o[0])}</span><b>${esc(optDetail(c,o))}</b>${k!=null?`<i class="kc">${Math.round(k)} kcal</i>`:''}${c.note?`<small>${esc(c.note)}</small>`:''}</span></div>`;}
   return`<div class="row"><span class="lbl">${esc(c.label)}${c.list?` <em class="tag">${esc(c.list)}</em>`:''} <span class="state ${sel!=null?'ok':''}">${c.opts.length} alternative</span></span>
    ${(()=>{const sh=isSel(sel)?+sel:sug;const one=(o,j)=>{const k=optK(o),on=String(sel)===String(j);return`<button class="opt main ${on?'on':''}${j===sug?' sug':''}" ${j===sug?'title="Suggerito: è quello che trovi nella lista della spesa. Toccalo per confermarlo."':''} data-pick="${key}" data-j="${j}" aria-pressed="${on}"><i class="ck">${on?'<svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>':''}</i><span class="on1">${esc(o[0])}</span><span class="od">${esc(optDetail(c,o))}${k!=null?` · ${Math.round(k)}`:''}</span></button>`;};
     return(sh>=0&&c.opts[sh]?one(c.opts[sh],sh):'')+`<div class="alts">${c.opts.map((o,j)=>{if(j===sh)return'';const k=optK(o);return`<button class="pill" data-pick="${key}" data-j="${j}" aria-pressed="false" title="${esc(optDetail(c,o))}${k!=null?` · ${Math.round(k)} kcal`:''}">${esc(o[0])}${k!=null?`<small>${Math.round(k)}</small>`:''}</button>`;}).join('')}</div>`;})()}</div>`;
  }).join('');
  return`<article class="meal ${free?'is-free':''}"><header><div><h3><span>${esc(ic||'')}</span>${esc(mn)}</h3>${free?'':`<small class="mk">≈ ${rFmt(mK)}</small>`}</div>${free?'':`<button class="btn ghost sm" data-recipe="${mk}">✨ Ricetta</button>`}</header>${rows}</article>`;
 }).join('');
}

/* ====== DIARIO ====== */
const OH0='Scrivi il nome e la quantità: le kcal si calcolano da sole dalla banca dati (oltre 1.100 alimenti). Se non lo trova, scrivile tu.';
let diaryDate=isoOf(new Date());
const foodNames=()=>Object.keys(kTab()).sort((a,b)=>a.localeCompare(b,'it'));
function renderFoodList(){$('#foodList').innerHTML=foodNames().map(n=>`<option value="${esc(n)}">`).join('');}
function unitOfFood(n){const e=kGet(n);return Array.isArray(e)?e[1]:kTab()[n]==null&&BDAM.has(n)?BDAM.get(n).u:'g';}
function renderDiary(){
 const dt=dateOf(diaryDate), d=dPlan(), log=S.diary[diaryDate]||[];
 $('#dDate').value=diaryDate;
 $('#dSwap').innerHTML=swapOpts(d.k,wdOf(diaryDate).k);$('#dSwap').classList.toggle('alt',d.k!==wdOf(diaryDate).k);
 $('#dTitle').textContent=longDate(dt)+(diaryDate===isoOf(new Date())?' · oggi':'');
 const tot=log.reduce((a,e)=>a+(+e.k||0),0), plan=dayRange(d);
 $('#dTot').innerHTML=`<b>${Math.round(tot)} kcal</b> mangiate · piano ${del(d.k)} ≈ ${rFmt(plan)}`;
 $('#dBar').style.width=`${Math.min(100,tot/(plan[1]||1)*100)}%`;
 const sp=S.dplanned[diaryDate];$('#dOld').hidden=!(sp&&sp.plan!==PLAN_REC.id);
 if(sp&&sp.plan!==PLAN_REC.id)$('#dOld').innerHTML=`Questo giorno è stato registrato con il piano <b>${esc(planTitle(sp.plan))}</b> (previste ≈ ${Math.round(sp.t)} kcal${sp.free?' + pasto libero':''}). Gli alimenti segnati restano quelli; i menu qui sotto sono del piano attuale.`;
 $('#dMeals').innerHTML=MEALS.map(([mk,mn,ic])=>{
  const comps=d.meals[mk]||[], free=comps[0]&&comps[0].free;
  const ents=log.map((e,i)=>({...e,i})).filter(e=>e.m===mk), mt=ents.reduce((a,e)=>a+(+e.k||0),0);
  const groups=comps.map((c,ci)=>c.free?'':`<optgroup label="${esc(c.label)}">${c.opts.map((o,j)=>`<option value="${ci}:${j}">${esc(o[0])} · ${esc(optDetail(c,o))}</option>`).join('')}</optgroup>`).join('');
  return`<article class="meal ${free?'is-free':''}"><header><div><h3><span>${esc(ic||'')}</span>${esc(mn)}</h3><small class="mk">${ents.length?Math.round(mt)+' kcal':free?'pasto libero':comps.length?'nessun alimento segnato':'non previsto dal piano'}</small></div>${groups?`<button class="btn ghost sm" data-asplan="${mk}">✓ Come da piano</button>`:''}</header>
   ${ents.length?`<ul class="log">${ents.map(e=>`<li><span>${esc(e.n)}${e.off?' <em class="tag off">fuori piano</em>':''}</span><b>${e.u?esc(unitFmt(+e.q,e.u))+' · ':''}${Math.round(e.k||0)} kcal</b><button class="x" data-del="${e.i}" aria-label="Elimina">×</button></li>`).join('')}</ul>`:''}
   ${groups?`<div class="dadd" data-meal="${mk}"><select data-dsel><option value="">Alimento del piano…</option>${groups}</select><input type="number" inputmode="decimal" min="0" step="any" data-dq placeholder="q.tà"><span class="u" data-du></span><button class="btn sm" data-dadd="${mk}">+</button></div>`:''}
   <details class="off"><summary>＋ Alimento fuori piano</summary><div class="dadd" data-meal="${mk}"><input data-on data-sug placeholder="Nome (es. Pizza margherita)" autocomplete="off"><input type="number" inputmode="decimal" min="0" step="any" data-oq placeholder="g"><input type="number" inputmode="decimal" min="0" step="any" data-ok placeholder="kcal"><button class="btn sm" data-oadd="${mk}">+</button></div><small class="hint" data-oh>${OH0}</small></details></article>`;
 }).join('');
 const days=Object.keys(S.diary).filter(k=>S.diary[k].length).sort().reverse().slice(0,14);
 $('#dHist').innerHTML=days.length?days.map(k=>`<button class="chip ${k===diaryDate?'on':''}" data-dgo="${k}">${dateOf(k).toLocaleDateString('it-IT',{weekday:'short',day:'numeric',month:'short'})} · ${Math.round(S.diary[k].reduce((a,e)=>a+(+e.k||0),0))}</button>`).join(''):'<span class="hint">Ancora nessun giorno registrato.</span>';
}
function diaryAdd(e){(S.diary[diaryDate]=S.diary[diaryDate]||[]).push(e);snapDay(diaryDate);save();renderDiary();}
/* il diario conserva cosa hai mangiato (nome, quantità, kcal) e le kcal previste quel giorno con il piano di allora:
   così cambiare piano non cambia il passato */
function snapDay(iso){const o=S.dplanned[iso];if(o&&o.plan!==PLAN_REC.id&&S.diary[iso]&&S.diary[iso].length)return;if(S.diary[iso]&&S.diary[iso].length)S.dplanned[iso]=Object.assign(dayPlanned(iso),{plan:PLAN_REC.id,day:dPlanK(iso)});else delete S.dplanned[iso];}
const plannedOf=iso=>{const x=S.dplanned[iso];return x&&x.plan!==PLAN_REC.id?x:dayPlanned(iso);};
const planTitle=id=>{const r=PLANS.list.find(x=>x.id===id);return r?r.title:'un piano eliminato';};
function planEntry(d,mk,ci,j,q){const c=d.meals[mk][ci],o=c.opts[j],base=optK(o);q=q==null||q===''?o[1]:+q;return{m:mk,n:o[0],q,u:o[2],k:base==null?0:base*q/o[1]};}

/* ====== CALORIE E CONVERSIONI ====== */
function planFoods(){
 const m=new Map();
 DAYS.forEach(d=>MEALS.forEach(([mk])=>(d.meals[mk]||[]).forEach(c=>{if(c.free)return;c.opts.forEach(o=>{
  (o[3]||[[o[0],o[1],o[2]]]).forEach(b=>{
   const n=b[0];if(kGet(n)==null)return;const e=m.get(n)||{n,qs:new Set(),u:b[2],cat:b[3]||SHOP_CAT[c.t]||'Altro'};e.qs.add(b[1]);m.set(n,e);});
 });})));
 return[...m.values()].sort((a,b)=>CAT_ORDER.indexOf(a.cat)-CAT_ORDER.indexOf(b.cat)||a.n.localeCompare(b.n,'it'));
}
const per=n=>{const e=kGet(n);return e==null?'':Array.isArray(e)?`${e[0]} kcal / ${unitFmt(1,e[1])}`:`${e} kcal / 100 ${unitOfFood(n)==='ml'?'ml':'g'}`;};
const qRange=e=>{const a=[...e.qs].sort((x,y)=>x-y);return a.length>1?`${a[0]}–${a.at(-1)}`:`${a[0]}`;};
function renderConvFrom(){
 const pf=planFoods();
 $('#cFrom').innerHTML=CAT_ORDER.map(cat=>{const its=pf.filter(f=>f.cat===cat);return its.length?`<optgroup label="${esc(cat)}">${its.map(f=>`<option value="${esc(f.n)}" data-q="${Math.max(...f.qs)}">${esc(f.n)}</option>`).join('')}</optgroup>`:'';}).join('');
 if(S.conv&&S.conv.from&&pf.some(f=>f.n===S.conv.from))$('#cFrom').value=S.conv.from;
 $('#cQ').value=S.conv&&S.conv.q?S.conv.q:($('#cFrom').selectedOptions[0]||{dataset:{q:100}}).dataset.q;
 $('#cTo').value=S.conv&&S.conv.to||'';
}
function convert(){
 const from=$('#cFrom').value, q=+$('#cQ').value, to=$('#cTo').value.trim(), tab=kTab();
 S.conv={from,q,to};save();
 const u=unitOfFood(from);$('#cU').textContent=u==='g'?'g':unitFmt(2,u).replace(/^2 /,'');
 const k=kcalOf(from,q,u);
 let html=k==null?'':`<p><b>${esc(unitFmt(q,u))}</b> di ${esc(lc(from))} = <b>${Math.round(k)} kcal</b></p>`;
 if(to&&k!=null){let tn=to,e=kGet(to),m=null;if(e==null&&to.length>=3){m=foodBest(to);if(m){tn=m.n;e=kGet(tn);}}
  if(e==null)html+=`<p class="hint">"${esc(to)}" non l'ho trovato nella banca dati: se è un prodotto di marca, aggiungilo qui sotto con le kcal dell'etichetta.</p>`;
  else if(!e)html+=`<p class="hint">${esc(tn)} non ha calorie.</p>`;
  else{const amt=Array.isArray(e)?k/e[0]:k/e*100, uu=Array.isArray(e)?e[1]:unitOfFood(tn)==='ml'?'ml':'g';
   html+=`<p class="big">≈ <b>${esc(uu==='ml'?Math.round(amt)+' ml':unitFmt(Array.isArray(e)?Math.round(amt*10)/10:Math.round(amt),uu))}</b> di ${esc(lc(tn))}</p><p class="hint">stesse calorie (${per(tn)})${m?' · trovato cercando "'+esc(to)+'"':''}</p>`;}
 }
 const pf=planFoods(), me=pf.find(f=>f.n===from);
 if(me&&k){const alt=pf.filter(f=>f.cat===me.cat&&f.n!==from&&!Array.isArray(tab[f.n])).slice(0,40);
  if(alt.length)html+=`<h5>Equivalenti nella stessa categoria</h5><ul class="eq">${alt.map(f=>`<li><span>${esc(f.n)}</span><b>${Math.round(k/tab[f.n]*100)} g</b></li>`).join('')}</ul>`;}
 $('#cRes').innerHTML=html;
}
function renderKTable(){
 const q=($('#kSearch').value||'').trim(), hit=n=>!q||CERCA.matches(n,q);
 const pf=planFoods().filter(f=>hit(f.n));
 let html=CAT_ORDER.map(cat=>{const its=pf.filter(f=>f.cat===cat);return its.length?`<section class="cat"><h4>${CAT_ICON[cat]} ${cat}</h4>${its.map(f=>{const k=kcalOf(f.n,Math.max(...f.qs),f.u);return`<div class="krow"><span>${esc(f.n)}<small>in dieta: ${esc(qRange(f))} ${f.u==='g'?'g':esc(unitFmt(Math.max(...f.qs),f.u).replace(/^\S+ /,''))}${f.qs.size===1&&k!=null?` = ${Math.round(k)} kcal`:''}</small></span><b>${per(f.n)}</b></div>`;}).join('')}</section>`:'';}).join('');
 const ex=Object.entries(EXTRA).map(([cat,o])=>{const its=Object.keys(o).filter(hit);return its.length?`<section class="cat"><h4>➕ ${cat} <span class="hint">· fuori piano</span></h4>${its.map(n=>`<div class="krow"><span>${esc(n)}</span><b>${per(n)}</b></div>`).join('')}</section>`:'';}).join('');
 const cu=(S.customFoods||[]).map((f,i)=>({...f,i})).filter(f=>hit(f.n));
 const cuh=cu.length?`<section class="cat"><h4>⭐ I tuoi alimenti</h4>${cu.map(f=>`<div class="krow"><span>${esc(f.n)}</span><b>${f.k} kcal / 100 g</b><button class="x" data-cfdel="${f.i}" aria-label="Elimina">×</button></div>`).join('')}</section>`:'';
 const bd=q?CERCA.search(bdaIx(),q,40):[];
 const bdh=bd.length?`<section class="cat"><h4>📚 Banca dati alimenti <span class="hint">· ${bd.length===40?'i 40 più simili':bd.length+(bd.length===1?' risultato':' risultati')}</span></h4>${bd.map(e=>`<div class="krow"><span>${esc(e.n)}<small>proteine ${nFmt(e.p)} · grassi ${nFmt(e.g)} · carboidrati ${nFmt(e.c)} · fibra ${nFmt(e.f)} g</small></span><b>${esc(perE(e))}</b></div>`).join('')}</section>`:'';
 const tip=!q&&BDA?`<p class="hint ktip">Cerca qui sopra per vedere anche gli oltre ${BDA.length>=1000?Math.floor(BDA.length/100)*100:BDA.length} alimenti della banca dati, con proteine, grassi e carboidrati.</p>`:'';
 $('#kTable').innerHTML=(cuh+html+ex+bdh)?cuh+html+ex+bdh+tip:'<p class="empty">Nessun alimento trovato.</p>';
}
function renderCalorie(){renderWeek();renderFoodList();renderConvFrom();convert();renderKTable();}

/* ====== RICETTE ====== */
function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const pick=(a,r)=>a[Math.floor(r()*a.length)];
const lc=s=>s.charAt(0).toLowerCase()+s.slice(1);
const COOK={'Amaranto':'Sciacqualo e cuocilo in acqua (2,5 volte il suo volume) per circa 20 minuti','Couscous':'Mettilo in una ciotola, coprilo con acqua bollente salata (stesso peso), copri e lascia riposare 5 minuti; sgranalo con una forchetta',
 'Gnocchi di patate':'Cuocili in acqua salata bollente e scolali appena salgono a galla (2-3 minuti)','Grano saraceno':'Tostalo 1 minuto in padella asciutta, poi cuocilo in acqua salata per 15-20 minuti',
 'Orzo':"Sciacqualo e cuocilo in acqua salata per 25-30 minuti (se perlato)",'Pasta di mais':'Cuocila in abbondante acqua salata per il tempo indicato (circa 9-10 minuti), senza scuocerla','Pasta di semola':'Cuocila in abbondante acqua salata al dente (circa 10 minuti)',
 'Pasta integrale':'Cuocila in abbondante acqua salata al dente (circa 11 minuti)','Polenta':"Porta a bollore l'acqua salata (circa 4 volte il peso), versa la farina a pioggia mescolando e cuoci 8-10 minuti se istantanea",
 'Quinoa':'Sciacquala bene sotto acqua corrente e cuocila in acqua (il doppio del volume) per 12-15 minuti','Riso':'Cuocilo in acqua salata per 15-18 minuti (o tostalo e cuocilo come risotto)','Riso integrale':'Cuocilo in acqua salata per 35-40 minuti',
 'Riso selvatico':'Cuocilo in acqua salata per 40-45 minuti','Farro':'Sciacqualo e cuocilo in acqua salata per 25-30 minuti (perlato)'};
const LEGCOOK={'Ceci secchi':'Metti i ceci in ammollo per 12 ore, poi cuocili in acqua non salata per 1,5-2 ore (o 25 minuti in pentola a pressione)','Fagioli secchi':'Metti i fagioli in ammollo per 8-12 ore, poi cuocili per circa 1-1,5 ore (o 20 minuti in pentola a pressione)',
 'Lenticchie secche':'Sciacqua le lenticchie e cuocile senza ammollo per 25-30 minuti','Misto legumi secchi':'Metti il misto in ammollo per 12 ore e cuocilo per circa 1 ora'};
const FISH_KIND=n=>/Cozze|Vongole/.test(n)?'bivalvi':/Polpo/.test(n)?'polpo':/Calamari|Seppie/.test(n)?'molluschi':/Gamberi/.test(n)?'gamberi':'pesce';
/* ====== MOTORE RICETTE: metodo di cottura x stile aromatico x preparazione della base ====== */
const STYLES=[
 {t:'alla mediterranea',a:'origano, basilico e qualche pomodorino preso dalla porzione di verdure'},
 {t:'alle erbe aromatiche',a:'rosmarino, timo e salvia tritati finemente'},
 {t:'al limone e pepe nero',a:'scorza e succo di limone con pepe nero macinato al momento'},
 {t:'alla paprika affumicata',a:'paprika affumicata e un pizzico di aglio in polvere'},
 {t:'al curry leggero',a:'curry, curcuma e un pizzico di zenzero'},
 {t:'alla sarda',a:'zafferano, semi di finocchio (o finocchietto selvatico) e aglio'},
 {t:"all'aceto balsamico",a:'un filo di aceto balsamico e rosmarino'},
 {t:'con aglio e peperoncino',a:'aglio a fettine sottili e peperoncino'},
 {t:'alla menta',a:'menta fresca spezzettata e scorza di limone'},
 {t:'allo zenzero',a:'zenzero fresco grattugiato e aglio'},
 {t:'al cumino',a:'cumino, coriandolo in polvere e un pizzico di pepe'},
 {t:'alla gremolada',a:'prezzemolo, aglio e scorza di limone tritati insieme'}
];
const T=(t,s)=>({t,s});
const isBurger=n=>/Hamburger/.test(n);
const shortMeat=n=>lc(n.replace(/^(Hamburger|Petto|Coscia) di /,'').replace(' magro',''));
const S_BIV=p=>`Lascia ${lc(p.n)} in acqua fredda per 30 minuti per eliminare la sabbia; scarta quelli rotti o aperti.`;
const S_POL=`Cuoci il polpo in acqua bollente per 40-50 minuti (deve essere tenero) e lascialo intiepidire nella sua acqua.`;
const S_GAM=`Sguscia i gamberi ed elimina il filo nero.`;
const FISH_M={
 pesce:[
  (p,a)=>T(`${p.n} al cartoccio`,[`Accendi il forno a 190 °C.`,`Disponi ${lc(p.n)} su un foglio di carta forno con fettine di limone e ${a}.`,`Chiudi bene il cartoccio e cuoci 15-20 minuti (20-25 se il pesce è intero).`]),
  (p,a)=>T(`${p.n} in padella`,[`Scalda una padella antiaderente con uno spicchio d'aglio in camicia.`,`Adagia ${lc(p.n)} (in filetti o a tranci), sala poco e cuoci coperto 8-12 minuti, girandolo a metà.`,`A fuoco spento insaporisci con ${a}.`]),
  (p,a)=>T(`${p.n} in crosta di erbe`,[`Accendi il forno a 200 °C.`,`Trita finemente del prezzemolo con ${a}.`,`Copri la parte superiore di ${lc(p.n)} con il trito e cuoci su carta forno 12-18 minuti.`]),
  (p,a)=>T(`${p.n} al vapore`,[`Cuoci ${lc(p.n)} nel cestello per la cottura a vapore per 10-15 minuti, finché si sfalda facilmente.`,`Condisci subito con ${a}.`]),
  (p,a)=>T(`${p.n} alla griglia`,[`Marina ${lc(p.n)} per 10 minuti con succo di limone e ${a}.`,`Cuoci su una griglia o piastra ben calda 3-5 minuti per lato, senza muoverlo troppo.`]),
  (p,a)=>T(`${p.n} in guazzetto`,[`In una padella fai appassire uno spicchio d'aglio con qualche pomodorino tagliato e mezzo bicchiere d'acqua.`,`Adagia ${lc(p.n)}, copri e cuoci a fuoco medio 10-12 minuti.`,`Completa con ${a}.`]),
  (p,a)=>T(`Spiedini di ${lc(p.n)}`,[`Taglia ${lc(p.n)} a cubotti e infilzali su spiedini alternandoli con pezzi di verdura.`,`Condisci con ${a}.`,`Cuoci in forno a 200 °C per 12-15 minuti o sulla piastra 2-3 minuti per lato.`]),
  (p,a)=>T(`${p.n} al forno in teglia`,[`Accendi il forno a 180 °C.`,`Metti ${lc(p.n)} in una teglia con un dito d'acqua, fettine di limone e ${a}.`,`Cuoci 18-22 minuti, bagnandolo a metà con il fondo di cottura.`])],
 bivalvi:[
  (p,a)=>T(`${p.n} alla marinara`,[S_BIV(p),`In una padella ampia scalda uno spicchio d'aglio con qualche pomodorino, aggiungi ${lc(p.n)}, copri e cuoci a fuoco vivace 4-5 minuti finché si aprono.`,`Completa con ${a}.`]),
  (p,a)=>T(`Impepata di ${lc(p.n)}`,[S_BIV(p),`Mettili in una pentola calda con abbondante pepe nero, copri e cuoci 4-5 minuti finché si aprono.`,`Servi con il loro liquido filtrato, spicchi di limone e ${a}.`]),
  (p,a)=>T(`${p.n} al vapore`,[S_BIV(p),`Cuocili coperti in pentola con un dito d'acqua e una fetta di limone per 4-5 minuti.`,`Sgusciane metà e condisci con ${a}.`]),
  (p,a)=>T(`${p.n} in guazzetto di pomodorini`,[S_BIV(p),`Prepara un guazzetto con pomodorini tagliati, aglio e mezzo bicchiere d'acqua (5 minuti).`,`Aggiungi ${lc(p.n)}, copri, cuoci finché si aprono e completa con ${a}.`])],
 polpo:[
  (p,a)=>T(`Insalata tiepida di polpo`,[S_POL,`Taglialo a pezzi e condiscilo con limone e ${a}.`]),
  (p,a)=>T(`Polpo alla griglia`,[S_POL,`Separa i tentacoli e falli abbrustolire su una griglia molto calda 3-4 minuti per lato.`,`Condisci con ${a}.`]),
  (p,a)=>T(`Polpo in umido`,[`Metti il polpo pulito in una pentola con pomodorini, aglio e ${a}, senza aggiungere acqua.`,`Copri e cuoci a fuoco basso 45-50 minuti: il polpo rilascerà il suo liquido.`]),
  (p,a)=>T(`Polpo alla piastra`,[S_POL,`Taglialo a pezzi e scottalo in padella antiaderente rovente 3-4 minuti finché è croccante.`,`Completa con ${a}.`])],
 molluschi:[
  (p,a)=>T(`${p.n} in umido`,[`Pulisci e taglia ${lc(p.n)} ad anelli o a listarelle.`,`Rosola uno spicchio d'aglio, aggiungi pomodorini tagliati e ${lc(p.n)} e cuoci coperto 15-20 minuti a fuoco medio.`,`Profuma con ${a}.`]),
  (p,a)=>T(`${p.n} alla griglia`,[`Pulisci ${lc(p.n)} lasciandoli interi e incidili leggermente.`,`Cuocili sulla piastra rovente 2-3 minuti per lato (oltre diventano gommosi).`,`Condisci con ${a}.`]),
  (p,a)=>T(`${p.n} saltati in padella`,[`Taglia ${lc(p.n)} ad anelli o a listarelle sottili.`,`Saltali in padella antiaderente a fuoco vivace 3-4 minuti con uno spicchio d'aglio.`,`Completa con ${a}.`]),
  (p,a)=>T(`${p.n} al forno`,[`Accendi il forno a 200 °C.`,`Disponi ${lc(p.n)} a pezzi in una teglia con carta forno e ${a}.`,`Cuoci 12-15 minuti.`])],
 gamberi:[
  (p,a)=>T(`Gamberi saltati in padella`,[S_GAM,`Saltali in padella antiaderente 2-3 minuti con uno spicchio d'aglio.`,`Spegni con succo di limone e completa con ${a}.`]),
  (p,a)=>T(`Spiedini di gamberi`,[S_GAM,`Infilzali su spiedini e condiscili con ${a}.`,`Cuocili sulla piastra calda 1-2 minuti per lato.`]),
  (p,a)=>T(`Gamberi al vapore`,[S_GAM,`Cuocili a vapore 3-4 minuti.`,`Condisci con ${a}.`]),
  (p,a)=>T(`Gamberi al forno`,[`Accendi il forno a 200 °C.`,S_GAM,`Disponili su carta forno con ${a} e cuoci 6-8 minuti.`]),
  (p,a)=>T(`Gamberi in guazzetto`,[S_GAM,`Prepara un guazzetto con pomodorini, aglio e mezzo bicchiere d'acqua (5 minuti).`,`Aggiungi i gamberi, cuoci 3 minuti e completa con ${a}.`])]
};
const CARNE_M=[
 [n=>true,(p,a)=>T(`${p.n} alla piastra`,[`Fai scaldare bene una piastra o una padella antiaderente.`,`Cuoci ${lc(p.n)} ${isBurger(p.n)?'4-5 minuti per lato':'3-6 minuti per lato a seconda dello spessore'}, senza bucarla.`,`Lascia riposare 2 minuti e completa con un pizzico di sale e ${a}.`])],
 [n=>!isBurger(n),(p,a)=>T(`Straccetti di ${shortMeat(p.n)}`,[`Taglia ${lc(p.n)} a listarelle sottili.`,`Salta le verdure in padella 5-6 minuti con un goccio d'acqua, poi aggiungi la carne e cuoci 4-5 minuti a fuoco vivace.`,`Profuma con ${a}.`])],
 [n=>true,(p,a)=>T(`${p.n} al forno`,[`Accendi il forno a 200 °C.`,`Condisci ${lc(p.n)} con ${a} e disponila su carta forno (insieme a patate o verdure se previste).`,`Cuoci ${isBurger(p.n)?'12-15':'20-30'} minuti, girandola a metà cottura.`])],
 [n=>!isBurger(n)&&!/Coscia/.test(n),(p,a)=>T(`Scaloppine di ${shortMeat(p.n)}`,[`Batti ${lc(p.n)} a fette sottili.`,`Cuocile in padella antiaderente calda 1-2 minuti per lato.`,`Sfuma con 2-3 cucchiai d'acqua e succo di limone, poi aggiungi ${a}.`])],
 [n=>true,(p,a)=>T(`Spiedini di ${shortMeat(p.n)}`,[`Taglia ${lc(p.n)} a cubetti${isBurger(p.n)?' (o forma delle piccole polpette)':''} e infilzali su spiedini alternandoli con pezzi di verdura.`,`Condisci con ${a}.`,`Cuoci sulla piastra o in forno a 200 °C per 12-15 minuti, girandoli.`])],
 [n=>!isBurger(n)&&!/Coscia/.test(n),(p,a)=>T(`Involtini di ${shortMeat(p.n)} con verdure`,[`Batti ${lc(p.n)} a fette sottili e condiscile con ${a}.`,`Arrotola ogni fetta attorno a bastoncini di verdura e chiudila con uno stecchino.`,`Cuoci in padella coperta 10-12 minuti con un goccio d'acqua.`])],
 [n=>true,(p,a)=>T(isBurger(p.n)?`Polpette di ${shortMeat(p.n)} al sugo`:`Spezzatino di ${shortMeat(p.n)}`,[isBurger(p.n)?`Sbriciola l'hamburger, condiscilo con ${a} e forma 5-6 polpette.`:`Taglia ${lc(p.n)} a bocconcini e condiscili con ${a}.`,`Rosolali 3 minuti in padella antiaderente, poi aggiungi qualche pomodorino (dalla porzione di verdure) e mezzo bicchiere d'acqua.`,`Cuoci coperto a fuoco basso 15-25 minuti.`])],
 [n=>true,(p,a)=>T(`${p.n} al cartoccio`,[`Accendi il forno a 190 °C.`,`Chiudi ${lc(p.n)} in un cartoccio di carta forno con ${a} e qualche verdura a pezzi.`,`Cuoci 20-25 minuti e apri il cartoccio solo al momento di servire.`])]
];
const UOVA_M=[
 (p,a)=>T(`Frittata al forno con verdure`,[`Accendi il forno a 180 °C.`,`Sbatti ${p.q} uova con un pizzico di sale e ${a}; unisci parte delle verdure tagliate piccole.`,`Versa in una teglia piccola con carta forno e cuoci 15-20 minuti.`]),
 (p,a)=>T(`Uova in purgatorio`,[`Cuoci in padella pomodorini a pezzi con aglio e ${a} per 8-10 minuti.`,`Apri ${p.q} uova sul sugo, copri e cuoci 4-6 minuti finché l'albume è rappreso.`]),
 (p,a)=>T(`Uova sode in insalata`,[`Cuoci ${p.q} uova in acqua bollente per 9 minuti, poi raffreddale in acqua fredda.`,`Sgusciale, tagliale a spicchi e condiscile con ${a}.`]),
 (p,a)=>T(`Omelette ripiena di verdure`,[`Sbatti ${p.q} uova con ${a}.`,`Versale in una padella antiaderente calda, cuoci 2 minuti, distribuisci metà delle verdure su un lato e chiudi a mezzaluna.`,`Cuoci ancora 1-2 minuti.`]),
 (p,a)=>T(`Uova strapazzate`,[`Sbatti ${p.q} uova con un cucchiaio d'acqua e ${a}.`,`Cuocile in padella antiaderente a fuoco basso, mescolando con una spatola, per 2-3 minuti: devono restare cremose.`]),
 (p,a)=>T(`Uova in camicia`,[`Porta a leggero bollore un pentolino d'acqua con un cucchiaio di aceto.`,`Crea un vortice e fai scivolare un uovo alla volta: cuoci 3 minuti e scola con la schiumarola (ripeti per ${p.q} uova).`,`Completa con ${a}.`]),
 (p,a)=>T(`Uova al tegamino`,[`Scalda una padella antiaderente con coperchio.`,`Apri ${p.q} uova, aggiungi un cucchiaio d'acqua, copri e cuoci 4-5 minuti senza grassi.`,`Completa con ${a}.`]),
 (p,a)=>T(`Rotolo di frittata`,[`Accendi il forno a 200 °C.`,`Sbatti ${p.q} uova con ${a} e stendile sottili su una teglia con carta forno; cuoci 8-10 minuti.`,`Farcisci con parte delle verdure, arrotola e taglia a fette.`])
];
const TOFU_M=[
 (p,a)=>T(`Tofu saltato con verdure`,[`Asciuga il tofu con carta da cucina e taglialo a cubetti.`,`Rosolalo in padella antiaderente 6-8 minuti finché è dorato, poi aggiungi le verdure${p.soia?', la salsa di soia':''} e ${a}.`]),
 (p,a)=>T(`Tofu croccante al forno`,[`Accendi il forno a 200 °C.`,`Taglia il tofu a cubetti e condiscilo con ${a}${p.soia?' e la salsa di soia':''}.`,`Cuoci 20-25 minuti su carta forno, girandolo a metà.`]),
 (p,a)=>T(`Tofu marinato alla piastra`,[`Taglia il tofu a fette spesse 1 cm e marinale 20 minuti con succo di limone, ${a}${p.soia?' e la salsa di soia':''}.`,`Cuocile sulla piastra ben calda 3-4 minuti per lato.`]),
 (p,a)=>T(`Tofu strapazzato`,[`Sbriciola il tofu con una forchetta.`,`Cuocilo in padella antiaderente 5 minuti con un pizzico di curcuma e ${a}${p.soia?', poi sfuma con la salsa di soia':''}.`]),
 (p,a)=>T(`Spiedini di tofu e verdure`,[`Taglia il tofu a cubotti e alternalo su spiedini con pezzi di verdura.`,`Condisci con ${a}${p.soia?' e la salsa di soia':''} e cuoci sulla piastra 8-10 minuti, girandoli.`]),
 (p,a)=>T(`Tofu in umido`,[`Fai appassire aglio e pomodorini in padella con mezzo bicchiere d'acqua.`,`Aggiungi il tofu a cubetti e ${a}${p.soia?' e la salsa di soia':''}; cuoci coperto 10 minuti.`])
];
const PCONS_M=[
 (p,a)=>T(`Bowl fredda con ${lc(p.n)}`,[`Sgocciola ${lc(p.n)} e spezzettalo.`,`Unisci le verdure crude tagliate e condisci con ${a}.`]),
 (p,a)=>T(`${p.n} con verdure saltate`,[`Salta le verdure in padella con un goccio d'acqua per 5-6 minuti.`,`A fuoco spento aggiungi ${lc(p.n)} a pezzetti e ${a}.`]),
 (p,a)=>T(`Insalata tiepida con ${lc(p.n)}`,[`Cuoci le verdure al vapore 6-8 minuti e lasciale intiepidire.`,`Condiscile con ${lc(p.n)} spezzettato e ${a}.`]),
 (p,a)=>/Salmone/.test(p.n)?T(`Rotolini di salmone affumicato`,[`Stendi le fette di salmone e farciscile con bastoncini di verdura cruda.`,`Arrotolale e completa con ${a}.`]):T(`Crema di tonno al limone`,[`Frulla il tonno sgocciolato con succo di limone, un cucchiaio d'acqua e ${a}.`,`Servila con le verdure crude da intingere.`])
];
const SALUME_M=[
 (p,a)=>T(`Piatto freddo con ${lc(p.n)}`,[`Disponi ${lc(p.n)} su un piatto con le verdure crude condite.`,`Completa con ${a}.`]),
 (p,a)=>T(`Involtini di ${lc(p.n)}`,[`Stendi le fette di ${lc(p.n)}.`,`Farciscile con verdure tagliate sottili${p.form?' e il formaggio':''}, aggiungi ${a} e arrotolale.`]),
 (p,a)=>T(`${p.n} con verdure grigliate`,[`Griglia le verdure a fette sulla piastra 3-4 minuti per lato.`,`Servile tiepide con ${lc(p.n)} e ${a}.`]),
 (p,a)=>T(`Insalata con ${lc(p.n)}`,[`Taglia ${lc(p.n)} a striscioline.`,`Mescolalo con le verdure crude e condisci con ${a}.`])
];
const FORM_M=[
 (p,a)=>T(`Crema di ${lc(p.n)}`,[`Sciogli ${lc(p.n)} a fuoco dolcissimo con 2-3 cucchiai d'acqua.`,`Aggiungi ${a} e servila con le verdure.`]),
 (p,a)=>T(`Verdure gratinate con ${lc(p.n)}`,[`Disponi le verdure a fette in una pirofila e copri con ${lc(p.n)} a pezzetti e ${a}.`,`Gratina in forno a 200 °C per 12-15 minuti.`]),
 (p,a)=>T(`Insalata con ${lc(p.n)}`,[`Taglia ${lc(p.n)} a cubetti.`,`Uniscilo alle verdure e condisci con ${a}.`])
];
function protMethods(p){
 if(p.t==='pesce')return FISH_M[FISH_KIND(p.n)];
 if(p.t==='carne')return CARNE_M.filter(([ok])=>ok(p.n)).map(x=>x[1]);
 return{uova:UOVA_M,tofu:TOFU_M,pescecons:PCONS_M,salume:SALUME_M,formaggio:FORM_M}[p.t]||[];
}
const PRIMO_M=[
 {t:'in padella',s:(x,a)=>`A cottura ultimata scola (conserva un po' di acqua di cottura) e manteca in padella con ${x} e ${a}.`},
 {t:'al forno',s:(x,a)=>`Scola al dente, mescola con ${x} e ${a}, trasferisci in una piccola pirofila e gratina in forno a 200 °C per 10 minuti.`},
 {t:'in insalata fredda',s:(x,a)=>`Scola, raffredda sotto l'acqua corrente e condisci con ${x} e ${a}; lascia riposare 10 minuti in frigo prima di servire.`,no:/Polenta|Gnocchi/},
 {t:'con crema di verdure',s:(x,a)=>`Frulla metà delle verdure cotte con 2-3 cucchiai di acqua di cottura e ${a}; scola e condisci con la crema e ${x}.`}
];
const PU_M=[
 {t:'in minestra',s:a=>`Unisci cereale e legumi in pentola con un mestolo della loro acqua di cottura, aggiungi ${a} e lascia insaporire 5 minuti.`},
 {t:'in insalata tiepida',s:a=>`Scola cereale e legumi, uniscili in una ciotola con le verdure tagliate e condisci con ${a}.`},
 {t:'saltati in padella',s:a=>`Salta cereale e legumi in padella antiaderente 3-4 minuti con un goccio d'acqua e ${a}, finché si asciugano.`}
];
const LEG_M=[
 {t:'in insalata',s:a=>`Scola i legumi e condiscili ancora tiepidi con ${a}.`},
 {t:'stufati',s:a=>`Ripassa i legumi cotti in padella 10 minuti con pomodorini, un goccio d'acqua e ${a}.`},
 {t:'in vellutata',s:a=>`Frulla i legumi cotti con un po' della loro acqua e ${a} fino a ottenere una crema.`}
];
const PAT_M=[
 {t:'al forno',s:p=>`Taglia le ${lc(p.n)} (${p.q} g) a spicchi e cuocile al forno a 200 °C per 30-35 minuti.`},
 {t:'al vapore',s:p=>`Taglia le ${lc(p.n)} (${p.q} g) a tocchetti e cuocile al vapore per 18-20 minuti.`},
 {t:'schiacciate',s:p=>`Lessa le ${lc(p.n)} (${p.q} g) per 20 minuti, poi schiacciale grossolanamente con una forchetta e un pizzico di sale.`}
];
const legShort=n=>({'Ceci secchi':'ceci','Fagioli secchi':'fagioli','Lenticchie secche':'lenticchie','Misto legumi secchi':'legumi misti'}[n]||lc(n));
const listIt=a=>a.length>1?a.slice(0,-1).join(', ')+' e '+a.at(-1):a[0];
function mainRecipe(items,r){
 const by=t=>items.find(i=>i.t===t);
 const base=['primo','piattounico','legumi','minestra','piadina','pane','patate'].map(by).find(Boolean);
 const prot=['pesce','carne','uova','tofu','pescecons','salume','formaggio'].map(by).find(Boolean);
 const form=by('formaggio'), sal=by('salume'), veg=by('verdure'), olio=by('olio'), soia=by('soia'), pis=by('piselli'), noci=by('fruttasecca'), fr=by('frutta');
 const st=pick(STYLES,r), a=st.a;
 let n=STYLES.length, title='', steps=[];
 /* base */
 let bm=null;
 if(base){
  if(base.t==='primo')steps.push(`${base.n} (${unitFmt(base.q,base.u)}): ${lc(COOK[base.n]||'cuocilo secondo le indicazioni della confezione')}.`);
  if(base.t==='piattounico'){const [c,l]=base.buy;steps.push(`${l[0]} (${l[1]} g): ${lc(LEGCOOK[l[0]])}.`);steps.push(`${c[0]} (${c[1]} g): ${lc(COOK[c[0]])}.`);}
  if(base.t==='legumi'){const l=base.buy?base.buy[0][0]:base.n;steps.push(`${LEGCOOK[l]||LEGCOOK['Misto legumi secchi']} (${base.q} g da secchi).`);if(/Passato/.test(base.n))steps.push(`Frulla i legumi cotti con un po' della loro acqua fino a ottenere una crema; regola di sale.`);}
  if(base.t==='minestra')steps.push(`Cuoci ${base.q} g di verdure miste a pezzi in acqua o brodo vegetale per 25-30 minuti${/Passato/.test(base.n)?', poi frullale fino a ottenere una vellutata':''}.`);
  if(base.t==='piadina')steps.push(`Scalda la piadina (${base.q} g) in padella 1 minuto per lato.`);
  if(base.t==='pane')steps.push(`Tosta leggermente il ${lc(base.n)} (${base.q} g).`);
  if(base.t==='patate'){bm=pick(PAT_M,r);n*=PAT_M.length;steps.push(bm.s(base));}
 }
 const primoDish=base&&base.t==='primo'&&prot&&['formaggio','salume','pescecons','tofu'].includes(prot.t);
 if(primoDish){
  const ms=PRIMO_M.filter(m=>!(m.no&&m.no.test(base.n)));n*=ms.length;const m=pick(ms,r);
  if(prot.t==='tofu'){const tp=pick(TOFU_M,r)({...prot,soia},a);n*=TOFU_M.length;steps.push(...tp.s);}
  const parts=[prot,form,sal].filter((x,i,arr)=>x&&arr.indexOf(x)===i);
  const names=parts.map(x=>lc(x.n));if(soia)names.push('salsa di soia');if(veg)names.push('verdure');
  if(veg)steps.push(veg.n.includes('crude')?`Lava le verdure crude e tagliale a julienne o a cubetti.`:`Cuoci le verdure al vapore o in padella con un goccio d'acqua per 8-10 minuti.`);
  steps.push(m.s(listIt(parts.map(x=>`${lc(x.n)} (${unitFmt(x.q,x.u)})`).concat(soia?[`la salsa di soia (${soia.q} g)`]:[]).concat(veg?['le verdure']:[])),a));
  title=`${base.n} con ${listIt(names)} ${m.t}, ${st.t}`;
 } else if(prot){
  const ms=protMethods(prot);n*=ms.length;const tp=pick(ms,r)({...prot,soia,form},a);
  if(base&&base.t==='piattounico'){
   const m=pick(PU_M,r);n*=PU_M.length;
   steps.push(m.s(a),`Servi con ${lc(prot.n)} (${unitFmt(prot.q,prot.u)}) spezzettato sopra.`);
   title=`${base.n} ${m.t} con ${lc(prot.n)}, ${st.t}`;
  } else {
   steps.push(...tp.s);
   const core=`${tp.t} ${st.t}`;
   if(!base)title=core;
   else if(base.t==='legumi'){if(/Passato/.test(base.n))title=`${core} con ${lc(base.n)}`;else{const m=pick(LEG_M,r);n*=LEG_M.length;steps.push(m.s(a));title=`${core} con ${legShort(base.n)} ${m.t}`;}}
   else if(base.t==='minestra')title=`${core} e ${lc(base.n)}`;
   else if(base.t==='piadina'){title=`Piadina con ${lc(core)}${form&&form!==prot?' e formaggio cremoso':''}`;steps.push(`Spalma il formaggio sulla piadina, aggiungi la farcitura e le verdure e chiudila a metà.`);}
   else if(base.t==='pane')title=`${core} con pane`;
   else if(base.t==='patate')title=`${core} con ${lc(base.n)} ${bm.t}`;
   else title=`${core} con ${lc(base.n)}`;
  }
  if(veg&&!(base&&base.t==='piattounico')){
   if(/verdur/.test(tp.s.join(' ')))steps.push(`Usa la porzione di verdure del pasto per la preparazione: quelle che avanzano servile come contorno.`);
   else steps.push(veg.n.includes('crude')?`Prepara il contorno: lava le verdure crude e tagliale a julienne o a cubetti.`:`Prepara il contorno: cuoci le verdure al vapore o in padella con un goccio d'acqua per 8-10 minuti.`);
  } else if(veg)steps.push(`Aggiungi le verdure, crude a cubetti o appena scottate.`);
 }
 if(!title)title=base?base.n:'Il tuo piatto';
 if(pis){steps.push(`Cuoci i piselli surgelati (${pis.q} g) in padella con un goccio d'acqua per 8 minuti.`);title+=' e piselli';}
 if(!primoDish){
  if(form&&prot&&prot!==form&&base&&base.t!=='piadina')steps.push(`Aggiungi ${lc(form.n)} (${unitFmt(form.q,form.u)}) a cubetti o a scaglie prima di servire.`);
  if(sal&&prot!==sal)steps.push(`Servi accanto ${lc(sal.n)} (${unitFmt(sal.q,sal.u)}).`);
 }
 if(noci)steps.push(`Spezzetta le noci (${noci.q} g) e aggiungile come guarnizione croccante.`);
 if(soia&&!/soia/.test(steps.join(' ')))steps.push(`Condisci con la salsa di soia (${soia.q} g).`);
 if(olio)steps.push(`Condisci con ${olio.q} cucchiaini di ${lc(olio.n)} a crudo, a fine cottura: è la dose per tutto il pasto.`);
 if(fr)steps.push(`Chiudi il pasto con una porzione di frutta fresca di stagione.`);
 title=title.charAt(0).toUpperCase()+title.slice(1);
 return{title,steps,n};
}
function snackRecipe(items,r,meal){
 const by=t=>items.find(i=>i.t===t);
 const sv=by('savoiardi');
 if(sv){const la2=by('latte'),rest=items.filter(i=>i!==sv&&i!==la2);return{title:`${xShort(sv.n).split(' ')[0]}${la2?' inzuppati nel latte':''}${rest.length?' con '+listIt(rest.map(i=>lc(i.n.replace(/ \(.*\)/,'')))):''}`,steps:[la2?`Scalda il latte (${unitFmt(la2.q,la2.u)}) o servilo freddo${pick([' con un pizzico di cannella',' con un cucchiaino di cacao amaro',''],r)}.`:'',`Pesa i ${xShort(sv.n)} (${sv.q} g)${la2?' e inzuppali nel latte':''}.`,...rest.map(i=>`Accompagna con ${lc(i.n)} (${i.detail}).`)].filter(Boolean)};}
 const y=by('yogurt'),fs=by('fruttasecca'),fr=by('frutta'),la=by('latte'),dc=by('cerealicol'),pa=by('pane'),cr=by('creme'),bo=by('bosco'),ft=by('frenchtoast'),to=by('toast'),fo=by('formaggio'),ma=by('marmellata'),ci=by('dolce');
 if(ft)return{title:'French toast ai frutti di bosco',steps:[`Sbatti il latte (${la?la.q:100} g) con un pizzico di cannella e scorza di limone.`,`Immergi il pane integrale (50 g) a fette per qualche secondo per lato.`,`Cuoci in padella antiaderente calda 2-3 minuti per lato, senza grassi.`,`Servi con il miele (1 cucchiaino), il cioccolato fondente a scaglie (10 g)${bo?' e i '+lc(bo.n)+' ('+bo.q+' g)':''}.`]};
 if(to)return{title:'Toast prosciutto e sottiletta',steps:['Farcisci il pancarrè (50 g) con la sottiletta e il prosciutto cotto (10 g).','Cuocilo nel tostapane o in padella antiaderente 2-3 minuti per lato, finché è dorato.']};
 if(pa&&fo&&ma)return{title:`Pane tostato con ricotta, marmellata e cioccolato`,steps:[`Tosta il ${lc(pa.n)} (${pa.q} g).`,`Spalma la ricotta (${fo.q} g) e poi la ${lc(ma.n)} (${unitFmt(ma.q,ma.u)}).`,ci?`Completa con il cioccolato fondente (${ci.q} g) a scaglie.`:''].filter(Boolean)};
 if(y&&(fs||fr||dc))return{title:`Bowl di yogurt greco${fs?' con '+lc(fs.n):''}${fr?' e frutta':''}`,steps:[`Versa lo yogurt greco in una ciotola.`,fr?`Aggiungi la frutta fresca a pezzetti${pick([' con un pizzico di cannella',' e scorza di limone',''],r)}.`:'',dc?`Unisci ${lc(dc.n)} (${dc.q} g).`:'',fs?`Completa con ${lc(fs.n)} (${fs.q} g) tritati grossolanamente, appena tostati in padella per più profumo.`:''].filter(Boolean)};
 if(la&&dc){const porr=/avena|farro/i.test(dc.n);return porr?{title:`Porridge di ${lc(dc.n.replace('Fiocchi ',''))}${fr?' con frutta':''}`,steps:[`Scalda il latte (${la.q} g) in un pentolino con ${lc(dc.n)} (${dc.q} g) e un pizzico di cannella.`,`Cuoci 4-5 minuti mescolando finché si addensa.`,fr?`Completa con la frutta fresca a pezzi.`:''].filter(Boolean)}:{title:`Tazza di latte con ${lc(dc.n)}${fr?' e frutta':''}`,steps:[`Scalda o servi freddo il latte (${la.q} g).`,`Accompagnalo con ${lc(dc.n)} (${dc.q} g).`,fr?`Aggiungi la frutta fresca a pezzi oppure mangiala a parte.`:''].filter(Boolean)};}
 if(pa&&cr)return{title:`Tartine con ${lc(cr.n)}${bo?' e '+lc(bo.n):''}`,steps:[la?`Prepara il latte (${la.q} g), caldo o freddo.`:'',`Tosta il ${lc(pa.n)} (${pa.q} g) e spalma ${lc(cr.n)} (${cr.q} g).`,bo?`Completa con ${lc(bo.n)} (${bo.q} g) schiacciati leggermente.`:'',fr?`Accompagna con la frutta fresca.`:'',y?`Servi accanto lo yogurt greco.`:''].filter(Boolean)};
 return{title:items.length===1?items[0].n:items.map(i=>i.n).join(' + '),steps:[`${items.map(i=>`${i.n}${i.u&&i.u!=='porzione'?' ('+unitFmt(i.q,i.u)+')':''}`).join(', ')}.`,pick(['Ideale da portare con sé: prepara tutto la sera prima.','Mangialo con calma, lontano dallo schermo.','Accompagna con un bicchiere d\'acqua o una tisana senza zucchero.'],r)]};
}
let recipeCtx=null;
function genRecipe(dk,mk,seed){
 const d=DAYS.find(x=>x.k===dk), comps=d.meals[mk], r=rng(seed);
 const items=comps.map((c,i)=>{const sel=S.picks[pkey(d.k,mk,i)], auto=!isSel(sel);const o=c.opts[pickOf(pkey(d.k,mk,i),c)];
  return{t:effT(c,o),label:c.label,n:o[0],q:o[1],u:o[2],buy:o[3],auto:auto&&c.opts.length>1,detail:optDetail(c,o)};});
 const rec=['pra','cen'].includes(mk)?mainRecipe(items,r):snackRecipe(items,r);
 return{d,items,rec};
}
function openRecipe(mk){
 let g,tries=0;
 do{g=genRecipe(planK(S.day),mk,Date.now()+tries*7919);tries++;}while(recipeCtx&&recipeCtx.mk===mk&&recipeCtx.day===g.d.n&&g.rec.title===recipeCtx.rec.title&&tries<15);
 const {d,items,rec}=g, meal=MEALS.find(m=>m[0]===mk)[1];
 recipeCtx={mk,items,rec,meal,day:d.n};
 $('#rTitle').textContent=rec.title;
 $('#rMeta').textContent=`${d.n} · ${meal}${rec.n>1?` · ${rec.n.toLocaleString('it-IT')} varianti con questi ingredienti`:''}`;
 $('#rIng').innerHTML=items.map(i=>`<li><span>${esc(i.n)}</span><b>${esc(i.detail)}</b>${i.auto?'<em title="Non spuntato nel piano: è il suggerito della lista della spesa">suggerito</em>':''}</li>`).join('');
 $('#rSteps').innerHTML=rec.steps.map(s=>`<li>${esc(s)}</li>`).join('');
 $('#rAuto').hidden=!items.some(i=>i.auto);
 if(!$('#recipe').open)$('#recipe').showModal();
}
function aiPrompt(){const c=recipeCtx;return`Sono a dieta. Crea una ricetta per il mio ${c.meal.toLowerCase()} (${c.day}) usando ESATTAMENTE questi ingredienti e quantità, senza aggiungere grassi o altri alimenti calorici (posso usare solo spezie, erbe aromatiche, aglio, cipolla, limone, aceto, sale con moderazione):\n${c.items.map(i=>`- ${i.n}: ${i.detail}`).join('\n')}\nDammi titolo, tempi, passaggi numerati e un consiglio per servirla.`;}

/* ====== SCELTE SUGGERITE: per ogni alimento non spuntato propone un prodotto preciso, uguale per tutta la settimana
   (dispensa) o a rotazione su pochi prodotti (carne, pesce, ecc.), così la spesa ha pochi prodotti e nessun "a scelta" ====== */
const AUTO_FIX=(PREFS.shopping||{}).fixed||{};
/* rotate: {tipo:{options:[nomi in ordine di preferenza] (facoltativo, se manca: tutte nell'ordine del piano), max: prodotti diversi a settimana}} */
const AUTO_ROT=(PREFS.shopping||{}).rotate||{};
const buyOf=o=>(o[3]||[[o[0],o[1],o[2]]]).map(b=>b[0]);
const isSel=v=>v!=null&&v!=='';
let _autoMemo=null;
function autoPicks(){
 const sig=JSON.stringify(S.picks);if(_autoMemo&&_autoMemo.sig===sig)return _autoMemo.a;
 const a={}, used={}, have=new Set(), later=[];
 const note=(t,o)=>{const u=used[t]=used[t]||{};u[o[0]]=(u[o[0]]||0)+1;buyOf(o).forEach(n=>have.add(n));};
 const all=[];DAYS.forEach(d=>MEALS.forEach(([mk])=>(d.meals[mk]||[]).forEach((c,i)=>{if(!c.free)all.push([d,mk,c,i]);})));
 all.forEach(([d,mk,c,i])=>{const s=S.picks[pkey(d.k,mk,i)];if(c.opts.length===1)note(c.t,c.opts[0]);else if(isSel(s)&&c.opts[+s])note(c.t,c.opts[+s]);});
 all.forEach(([d,mk,c,i])=>{const key=pkey(d.k,mk,i);
  if(c.opts.length<2||isSel(S.picks[key]))return;
  if(c.t==='piattounico'){later.push([key,c]);return;}
  let j=0;
  if(AUTO_FIX[c.t]){const f=c.opts.findIndex(o=>o[0]===AUTO_FIX[c.t]);if(f>=0)j=f;}
  else if(AUTO_ROT[c.t]){const {options:list,max=99}=AUTO_ROT[c.t], u=used[c.t]||{};
   let cand=list?list.map(n=>c.opts.findIndex(o=>o[0]===n)).filter(x=>x>=0):c.opts.map((o,x)=>x);
   const chosen=cand.filter(x=>u[c.opts[x][0]]);if(chosen.length>=max)cand=chosen;
   if(cand.length){j=cand[0];cand.forEach(x=>{if((u[c.opts[x][0]]||0)<(u[c.opts[j][0]]||0))j=x;});}}
  else{const f=c.opts.findIndex(o=>buyOf(o).every(n=>have.has(n)));if(f>=0)j=f;}
  a[key]=j;note(c.t,c.opts[j]);});
 /* piatto unico: prima le combinazioni con ingredienti già in lista, poi la meno usata */
 later.forEach(([key,c])=>{const u=used[c.t]||{};let j=0,best=-1;
  c.opts.forEach((o,x)=>{const sc=buyOf(o).filter(n=>have.has(n)).length*10-(u[o[0]]||0);if(sc>best){best=sc;j=x;}});
  a[key]=j;note(c.t,c.opts[j]);});
 _autoMemo={sig,a};return a;
}
/* indice effettivo: spunta vera, altrimenti suggerito */
const pickOf=(key,c,ap)=>c.opts.length===1?0:isSel(S.picks[key])?+S.picks[key]:(ap||autoPicks())[key]??0;
/* vecchie chiavi della spesa "nome|unità" -> "nome" */
['checked','hidden'].forEach(f=>Object.keys(S[f]||{}).forEach(k=>{if(k.includes('|')&&!k.startsWith('custom|')){const n=k.split('|')[0];S[f][n]=S[f][k];delete S[f][k];}}));

/* ====== REPARTI (ordine del supermercato) e DISPENSA ====== */
const catOrd=()=>{const o=(S.catOrder||[]).filter(c=>CAT_ORDER.includes(c));return[...o,...CAT_ORDER.filter(c=>!o.includes(c))];};
function moveCat(c,dir){const o=catOrd(),i=o.indexOf(c),j=i+dir;if(j<0||j>=o.length)return;[o[i],o[j]]=[o[j],o[i]];S.catOrder=o;save();renderShop();}
function renderCatEdit(){const o=catOrd();$('#catEdit').innerHTML=`<p class="hint">Metti i reparti nell'ordine in cui li trovi al supermercato.</p><ol class="catl">${o.map((c,i)=>`<li><span>${CAT_ICON[c]} ${c}</span><button class="btn line sm" data-cmv="${esc(c)}" data-dir="-1" ${i?'':'disabled'} aria-label="Su">▲</button><button class="btn line sm" data-cmv="${esc(c)}" data-dir="1" ${i<o.length-1?'':'disabled'} aria-label="Giù">▼</button></li>`).join('')}</ol><div class="tools"><button class="btn line sm" id="catReset">Ordine predefinito</button><button class="btn sm" id="catDone">Fatto</button></div>`;}
const inPantry=i=>!i.custom&&S.pantry&&S.pantry[i.key];

/* ====== RIEPILOGO SETTIMANALE ====== */
let wkOff=0;
function dayPlanned(iso){const d=DAYS.find(x=>x.k===dPlanK(iso)),ap=autoPicks();let t=0,free=false;
 MEALS.forEach(([mk])=>(d.meals[mk]||[]).forEach((c,i)=>{if(c.free){free=true;return;}const k=optK(c.opts[pickOf(pkey(d.k,mk,i),c,ap)]);if(k!=null)t+=k;}));return{t,free};}
function renderWeek(){
 const end=new Date();end.setDate(end.getDate()-7*wkOff);const isos=[];
 for(let i=6;i>=0;i--){const x=new Date(end);x.setDate(end.getDate()-i);isos.push(isoOf(x));}
 const rows=isos.map(iso=>{const e=S.diary[iso]||[];return{iso,n:e.length,k:e.reduce((s,x)=>s+(+x.k||0),0),off:e.filter(x=>x.off).length,p:plannedOf(iso)};});
 const max=Math.max(...rows.map(r=>Math.max(r.k,r.p.t)),1), reg=rows.filter(r=>r.n);
 const fd=s=>dateOf(s).toLocaleDateString('it-IT',{day:'numeric',month:'short'});
 const avg=a=>a.length?Math.round(a.reduce((s,x)=>s+x,0)/a.length):0;
 $('#wkTitle').textContent=wkOff?`${fd(isos[0])} – ${fd(isos[6])}`:'Ultimi 7 giorni';
 $('#wkNext').disabled=!wkOff;
 const offN=reg.reduce((s,r)=>s+r.off,0);
 $('#wkSum').innerHTML=reg.length?`<div><b>${avg(reg.map(r=>r.k))}</b><small>kcal medie registrate</small></div><div><b>${avg(reg.map(r=>r.p.t))}</b><small>kcal medie previste</small></div><div><b>${reg.length}/7</b><small>giorni nel diario</small></div><div><b>${offN}</b><small>alimenti fuori piano</small></div>`:'<p class="empty">Nessun giorno registrato nel diario in questa settimana.</p>';
 $('#wkBars').innerHTML=rows.map(r=>{const wd=dateOf(r.iso).toLocaleDateString('it-IT',{weekday:'short'}).replace('.','');const diff=r.k-r.p.t;
  return`<button class="wk ${r.n?'':'none'}" data-wgo="${r.iso}" title="Apri il diario di questo giorno"><span class="wd">${wd} ${dateOf(r.iso).getDate()}</span><span class="bar"><i style="width:${r.k/max*100}%" class="${r.n&&!r.p.free&&diff>150?'over':''}"></i><em style="left:${r.p.t/max*100}%"></em></span><span class="val">${r.n?`${Math.round(r.k)} <small>/ ${Math.round(r.p.t)}${r.p.free?' + libero':''}</small>`:'<small>non registrato</small>'}${r.off?`<small class="offn">${r.off} fuori piano</small>`:''}</span></button>`;}).join('');
}

/* ====== PIANI ====== */
const fdate=iso=>iso?dateOf(iso).toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'}):'';
function renderPlans(){
 const a=PLAN_REC, nd=DAYS.length;
 $('#planCur').innerHTML=`<div class="plancur">In uso: <b>${esc(a.title)}</b>${a.author?` · ${esc(a.author)}`:''}<br><small>${nd} giorni · attivo dal ${fdate(a.from)}${isExample(a)?' · piano di esempio':''}</small></div>${PLAN.notes?`<details class="pnotes"><summary>📝 Note del nutrizionista</summary><p>${esc(PLAN.notes)}</p></details>`:''}`;
 const others=PLANS.list.filter(x=>x.id!==a.id).sort((x,y)=>(y.from||y.added).localeCompare(x.from||x.added));
 $('#planList').innerHTML=others.length?`<h4 class="sub">Archivio</h4>`+others.map(x=>`<div class="planrow"><span>${esc(x.title)}${x.author?` · ${esc(x.author)}`:''}<small>${x.from?'usato l\'ultima volta dal '+fdate(x.from):'caricato il '+fdate(x.added)+', mai usato'}</small></span><span class="acts"><button class="btn ghost sm" data-puse="${esc(x.id)}">Usa questo</button><button class="btn line sm" data-pdel="${esc(x.id)}" aria-label="Elimina">🗑️</button></span></div>`).join(''):'';
}
function activatePlan(id){
 const st=JSON.parse(JSON.stringify(readPlans()||PLANS)), cur=st.list.find(x=>x.id===st.active), nx=st.list.find(x=>x.id===id);if(!nx)return;
 const testPrefs=new URLSearchParams(location.search).has('prefs');
 /* il diario tiene le kcal previste con il piano che lascio */
 const S2=JSON.parse(JSON.stringify(S));Object.keys(S.diary).forEach(iso=>{const x=S.dplanned[iso];if(!x||x.plan===PLAN_REC.id)snapDay(iso);});
 /* scelte e preferenze del piano che lascio (null = quelle del file) */
 if(cur)cur.state=Object.assign(Object.fromEntries(PLAN_KEYS.map(k=>[k,S[k]])),{prefs:testPrefs?readLocalPrefs():PREFS_LOCAL?PREFS:null});
 const ns=nx.state||{};delete nx.state;nx.from=today();st.active=id;
 try{writePlans(st);}catch(e){Object.assign(S,S2);alert('Spazio esaurito nella memoria del browser: non riesco a cambiare piano. Elimina dall\'archivio i piani che non usi e riprova.');return;}
 if('prefs' in ns){if(ns.prefs)writePrefs(ns.prefs);else clearPrefs();} /* un piano mai usato parte dalle preferenze attuali */
 delete ns.prefs;Object.assign(S,PLAN_DEF(),ns);save();
 if(testPrefs){const u=new URL(location.href);u.searchParams.delete('prefs');location.replace(u);}else location.reload();
}
function importPlan(file){const fr=new FileReader();fr.onload=()=>{let j;try{j=JSON.parse(fr.result);}catch(e){alert('Il file non è un JSON valido.');return;}
 const err=planErrors(j);if(err.length){alert('Questo file non è un piano valido:\n\n• '+err.join('\n• '));return;}
 addPlan(j,j.title||file.name.replace(/\.json$/i,''));};fr.readAsText(file);}
/* aggiunge un piano valido all'archivio e propone di usarlo; false se non c'è spazio */
function addPlan(j,title){const st=readPlans()||PLANS, id=newPlanId();
 st.list.push({id,title:String(title),author:String(j.author||''),added:today(),plan:j});try{writePlans(st);}catch(e){alert('Spazio esaurito nella memoria del browser: elimina dall\'archivio i piani che non usi e riprova.');return false;}
 if(confirm(`Piano «${title}» caricato (${j.days.length} giorni).\n\nVuoi usarlo da subito? Il piano attuale resta in archivio con le tue scelte.`))activatePlan(id);
 else{PLANS.list=st.list;renderPlans();toast('Piano aggiunto all\'archivio');}return true;}
function exportPlan(){const name=`piano-${String(PLAN_REC.title||'dieta').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}.json`;
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(PLAN,null,1)],{type:'application/json'}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);}
function deletePlan(id){const st=readPlans()||PLANS, x=st.list.find(y=>y.id===id);if(!x||id===st.active)return;
 if(!confirm(`Eliminare il piano «${x.title}» dall'archivio? Il diario resta, ma perdi le scelte legate a quel piano.`))return;
 st.list=st.list.filter(y=>y.id!==id);writePlans(st);PLANS.list=st.list;renderPlans();toast('Piano eliminato');}

/* ====== IMPORT DA PDF (Gemini) ======
   PI = bozza in revisione {raw, map, title, author, notes, file}; resta salvata finché non la salvi o la scarti */
let PI=null, PM=null;const PI_KEY='dietaApp.pdfDraft', piOpen=new Set([0]);
const piSave=()=>{try{const{raw,map,title,author,notes,file}=PI;localStorage.setItem(PI_KEY,JSON.stringify({raw,map,title,author,notes,file}));}catch(e){}};
const piDraft=()=>{try{return JSON.parse(localStorage.getItem(PI_KEY));}catch(e){return null;}};
async function pdfClick(){
 const d=piDraft();
 if(d&&d.raw){if(confirm(`Hai una revisione in sospeso del PDF «${d.file}».\n\nRiprenderla? (Annulla = la scarti e scegli un altro PDF)`)){PM=PM||await import('./pdfimport.js');PI=d;piOpen.clear();piOpen.add(0);$('#pdfImp').showModal();renderPI();return;}
  localStorage.removeItem(PI_KEY);}
 if(!SY||!SY.signedIn()){toast('Per leggere un PDF con l\'AI accedi con Google (Impostazioni → Account)');return;}
 $('#pdfFile').click();
}
async function pdfStart(file){
 PM=PM||await import('./pdfimport.js');
 if(file.size>PM.MAX_MB*1024*1024){alert(`Il PDF è troppo grande (massimo ${PM.MAX_MB} MB).`);return;}
 const dlg=$('#pdfImp'), t0=Date.now(), job={stop:false};PI=job;
 $('#piBody').innerHTML=`<h3>📄 Leggo il PDF</h3><p><b>${esc(file.name)}</b></p><p class="hint">L'AI sta trascrivendo il piano, con tutte le alternative e le calorie stimate. Di solito ci vuole un minuto o due: puoi lasciare aperta questa finestra.</p><p class="pitime"><span class="spin"></span> <span id="piTime">0 s</span> <span id="piProg" class="hint"></span></p><div class="pbar"><button class="btn line sm" id="piStop">Annulla</button></div>`;
 dlg.showModal();
 const tick=setInterval(()=>{const e=$('#piTime');if(e)e.textContent=Math.round((Date.now()-t0)/1000)+' s';},1000);
 const prog=t=>{const n=(t.match(/"qty"/g)||[]).length,e=$('#piProg');if(e&&n)e.textContent=`· ${n} alimenti letti`;};
 try{const raw=await PM.extract(file,{onText:prog});if(job.stop)return;if(!raw.days.length)throw new Error('vuoto');
  PI={raw,map:PM.defaultMap(raw),title:(raw.title&&!/^piano alimentare( personalizzato)?$/i.test(raw.title)?raw.title:(raw.author?'Piano '+raw.author.replace(/^dott\.?(ssa)?\s*/i,''):file.name.replace(/\.pdf$/i,'')))+(raw.date?' · '+raw.date:''),author:raw.author,notes:raw.notes,file:file.name};
  piOpen.clear();piOpen.add(0);piSave();renderPI();}
 catch(e){if(job.stop)return;console.warn(e);dlg.close();PI=null;
  if(e.message==='vuoto')alert('Non ho trovato un piano alimentare in questo PDF.');
  else{const ai=await import('./ai.js');alert(ai.errText(e,'riprova più tardi o carica il piano come file'));}}
 finally{clearInterval(tick);}
}
const piKcalMiss=()=>PI.raw.days.reduce((a,d)=>a+d.meals.reduce((b,m)=>b+m.items.reduce((c,x)=>c+(x.free?0:x.options.filter(o=>o.kcal==null).length),0),0),0);
function renderPI(){
 const r=PI.raw, W=PM.WD, tpl=r.days.length!==7||r.days.some(d=>d.weekdays.length!==1)||new Set(PI.map).size!==7;
 const usedBy=i=>{const w=W.filter((x,j)=>PI.map[j]===i).map(x=>x[1].slice(0,3));return w.length?w.join(', '):'non usata';};
 const uOpt=u=>PM.UNITS.map(x=>`<option ${x===u?'selected':''}>${x}</option>`).join('');
 const miss=piKcalMiss(), box=$('#pdfImp'), top=box.scrollTop;
 $('#piBody').innerHTML=`<h3>📄 Controlla il piano</h3>
  <p class="hint">Letto da «${esc(PI.file)}». L'AI può sbagliare: controlla alimenti, quantità e calorie prima di salvare.${tpl?' Ogni giornata vale per tutti i giorni a cui la abbini: se la correggi, cambia in tutti.':''}</p>
  <div class="setrow"><label for="piT">Titolo</label><input id="piT" data-pif="title" maxlength="80" value="${esc(PI.title||'')}"></div>
  <div class="setrow"><label for="piA">Nutrizionista</label><input id="piA" data-pif="author" maxlength="80" value="${esc(PI.author||'')}"></div>
  ${tpl?`<h4 class="sub">📅 Che giornata fai ogni giorno</h4><p class="hint">Il PDF non è una settimana fissa: scegli quale giornata usare per ciascun giorno. Potrai sempre scambiare i giorni dal Piano.</p>
  <div class="pimap">${W.map((w,j)=>`<label><span>${w[1]}</span><select data-pimap="${j}">${r.days.map((d,i)=>`<option value="${i}" ${PI.map[j]===i?'selected':''}>${esc(d.name)}</option>`).join('')}</select></label>`).join('')}</div>`:''}
  <h4 class="sub">🍽️ ${tpl?'Giornate':'Giorni'}</h4>
  ${miss?`<p class="hint warnk">⚠️ ${miss} ${miss===1?'alimento è':'alimenti sono'} senza calorie (campo evidenziato): puoi scriverle o lasciarle vuote.</p>`:''}
  ${r.days.map((d,i)=>`<details class="ped pid" data-pid="${i}" ${piOpen.has(i)?'open':''}><summary><span>${esc(d.name)}</span><small>${tpl?usedBy(i)+' · ':''}${d.meals.length} pasti</small></summary>
   ${d.note?`<p class="hint">${esc(d.note)}</p>`:''}
   ${d.meals.map((m,mi)=>`<h5 class="pimeal">${esc(m.meal)}</h5>${m.items.map((c,ci)=>{const id=`${i}.${mi}.${ci}`;return`<div class="piitem"><div class="pihead"><b>${esc(c.label)}</b>${c.free?'<small>pasto libero</small>':c.options.length>1?`<small>${c.options.length} alternative</small>`:''}<button type="button" class="btn ghost sm" data-pidel="${id}" aria-label="Togli la voce">🗑️</button></div>
    ${c.free?'':c.options.map((o,oi)=>`<div class="piopt" data-po="${id}.${oi}"><input data-pk="name" value="${esc(o.name)}" aria-label="Alimento"><input data-pk="qty" type="number" min="0" step="any" value="${o.qty}" aria-label="Quantità"><select data-pk="unit" aria-label="Unità">${uOpt(o.unit)}</select><input data-pk="kcal" type="number" min="0" max="1500" class="${o.kcal==null?'miss':''}" value="${o.kcal==null?'':o.kcal}" placeholder="kcal" title="${o.unit==='g'||o.unit==='ml'?'kcal per 100 '+o.unit:'kcal per 1 '+o.unit}" aria-label="Calorie"><button type="button" class="btn ghost sm" data-podel aria-label="Togli l'alternativa">✕</button></div>`).join('')}
    ${c.note?`<p class="hint">${esc(c.note)}</p>`:''}</div>`;}).join('')}`).join('')}
  </details>`).join('')}
  <p class="hint">Calorie: per 100 g o 100 ml se l'unità è g o ml, altrimenti per 1 unità (pezzo, vasetto…).</p>
  <h4 class="sub">📝 Note del nutrizionista</h4><textarea data-pif="notes" rows="4" placeholder="facoltative">${esc(PI.notes||'')}</textarea>
  <div class="pbar"><button class="btn" id="piOk">💾 Salva il piano</button><button class="btn line sm" id="piLater">Continua dopo</button><button class="btn ghost sm" id="piDrop">Scarta</button></div>`;
 box.scrollTop=top;
}
const piAt=s=>{const [i,mi,ci,oi]=s.split('.').map(Number),m=PI.raw.days[i].meals[mi];return{m,c:m.items[ci],ci,oi,d:PI.raw.days[i],mi};};
const piPrune=({d,m,mi})=>{if(!m.items.length)d.meals.splice(mi,1);};
$('#shopList').addEventListener('toggle',e=>{if(e.target.id==='shopAlts')altOpen=e.target.open;},true);
$('#pdfImp').addEventListener('toggle',e=>{const d=e.target.closest&&e.target.closest('details.pid');if(d){const i=+d.dataset.pid;if(d.open)piOpen.add(i);else piOpen.delete(i);}},true);
$('#pdfImp').addEventListener('input',e=>{const el=e.target;if(!PI||!PI.raw)return;
 if(el.dataset.pif){PI[el.dataset.pif]=el.value;piSave();return;}
 const po=el.closest('[data-po]');if(!po||!el.dataset.pk)return;const{c,oi}=piAt(po.dataset.po),o=c.options[oi],k=el.dataset.pk;
 if(k==='name')o.name=el.value;
 if(k==='qty'&&+el.value>0)o.qty=+el.value;
 if(k==='kcal'){if(el.value===''||!(+el.value>=0))delete o.kcal;else o.kcal=Math.round(+el.value);el.classList.toggle('miss',o.kcal==null);}
 piSave();});
$('#pdfImp').addEventListener('change',e=>{const el=e.target;if(!PI||!PI.raw)return;
 if(el.dataset.pimap){PI.map[+el.dataset.pimap]=+el.value;piSave();renderPI();return;}
 const po=el.closest('[data-po]');if(po&&el.dataset.pk==='unit'){const{c,oi}=piAt(po.dataset.po);c.options[oi].unit=el.value;piSave();renderPI();}
 if(po&&el.dataset.pk==='name'&&!el.value.trim()){toast('Il nome non può restare vuoto');}});
$('#pdfImp').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
 if(b.id==='piStop'){if(PI)PI.stop=true;PI=null;$('#pdfImp').close();return;}
 if(!PI||!PI.raw)return;
 if(b.dataset.pidel!=null){const x=piAt(b.dataset.pidel);x.m.items.splice(x.ci,1);piPrune(x);piSave();renderPI();}
 if(b.dataset.podel!=null){const x=piAt(b.closest('[data-po]').dataset.po);x.c.options.splice(x.oi,1);if(!x.c.options.length){x.m.items.splice(x.ci,1);piPrune(x);}piSave();renderPI();}
 if(b.id==='piLater'){$('#pdfImp').close();toast('La ritrovi premendo di nuovo «Carica da PDF»');}
 if(b.id==='piDrop'&&confirm('Scartare questo piano letto dal PDF?')){localStorage.removeItem(PI_KEY);PI=null;$('#pdfImp').close();}
 if(b.id==='piOk'){
  if(PI.raw.days.some(d=>d.meals.some(m=>m.items.some(c=>c.options.some(o=>!o.name.trim()))))){alert('C\'è un alimento senza nome: scrivilo o togli quella riga.');return;}
  const plan=PM.toPlan(PI.raw,PI.map,{title:(PI.title||'').trim(),author:(PI.author||'').trim(),notes:(PI.notes||'').trim()});
  const err=planErrors(plan);if(err.length){alert('Il piano non è ancora valido:\n\n• '+err.slice(0,8).join('\n• '));return;}
  $('#pdfImp').close();if(addPlan(plan,plan.title)){localStorage.removeItem(PI_KEY);PI=null;}}
});

/* ====== CONTROLLO PREFERENZE ↔ PIANO ======
   Le preferenze citano tipi e nomi di alimenti del piano: se il piano cambia, qui si vede cosa non combacia più */
function planTypes(){const m={},xn=new Set(XTRA.map(x=>x.name));DAYS.forEach(d=>Object.values(d.meals).forEach(cs=>cs.forEach(c=>{if(c.free)return;const t=m[c.t]=m[c.t]||{label:c.label,names:new Set()};c.opts.forEach(o=>{if(!xn.has(o[0]))t.names.add(o[0]);});})));return m;}
function checkPrefs(){
 const T=planTypes(), iss=[], sh=PREFS.shopping||{};
 Object.entries(sh.fixed||{}).forEach(([t,n])=>{if(!T[t])iss.push({k:'fixT',t,n});else if(!T[t].names.has(n))iss.push({k:'fixN',t,n,lab:T[t].label,ch:[...T[t].names]});});
 Object.entries(sh.rotate||{}).forEach(([t,r])=>{if(!T[t]){iss.push({k:'rotT',t});return;}if(!r.options)return;const miss=r.options.filter(n=>!T[t].names.has(n)),ch=[...T[t].names].filter(n=>!r.options.includes(n));if(miss.length)iss.push({k:'rotN',t,miss,ch,lab:T[t].label});});
 (PREFS.breakfastExtras||[]).forEach((x,i)=>{if(!(x.addTo||[]).some(t=>T[t]))iss.push({k:'xtra',i,n:x.name});});
 const noK=new Set();DAYS.forEach(d=>Object.values(d.meals).forEach(cs=>cs.forEach(c=>{if(!c.free)c.opts.forEach(o=>{if(optK(o)==null)noK.add(o[0]);});})));
 if(noK.size)iss.push({k:'noK',names:[...noK]});
 return iss;
}
const ISS_MAIN=i=>i.k==='fixN'||i.k==='rotN'||i.k==='xtra';
function renderPrefCheck(){
 const iss=checkPrefs(), q=s=>`«${esc(s)}»`;
 $('#prefCheck').innerHTML=(iss.some(ISS_MAIN)?'':`<p class="okline">✅ Le preferenze combaciano con il piano attivo.</p>`)+iss.map((i,n)=>{
  if(i.k==='fixN')return`<div class="issue"><p>🛒 Nella spesa ${q(i.lab.toLowerCase())} è sempre ${q(i.n)}, ma il piano non lo prevede più.</p><div class="acts"><select data-fixsel="${esc(i.t)}"><option value="">Nessuno fisso: ruota tra le opzioni</option>${i.ch.map(c=>`<option>${esc(c)}</option>`).join('')}</select><button class="btn sm" data-fixapply="${esc(i.t)}">Applica</button></div></div>`;
  if(i.k==='rotN')return`<div class="issue"><p>🔄 Nella rotazione di ${q(i.lab.toLowerCase())} ci sono alimenti che il piano non prevede più. Scegli con cosa sostituirli:</p>${i.miss.map(m=>`<div class="acts"><span>${q(m)} →</span><select data-rotsel="${esc(i.t)}" data-old="${esc(m)}"><option value="">Nessuno (toglilo)</option>${i.ch.map(c=>`<option>${esc(c)}</option>`).join('')}</select></div>`).join('')}<div class="acts" style="margin-top:6px"><button class="btn sm" data-rotfix="${esc(i.t)}">Applica</button></div></div>`;
  if(i.k==='xtra')return`<div class="issue"><p>☕ L'aggiunta a colazione ${q(i.n)} non ha dove andare in questo piano.</p><div class="acts"><button class="btn sm" data-xdel="${i.i}">Toglila</button></div></div>`;
  if(i.k==='fixT')return`<div class="issue info"><p>Preferenza per un tipo di alimento che questo piano non ha (${esc(i.t)}: ${q(i.n)}). Non fa nulla.</p><div class="acts"><button class="btn line sm" data-tdel="fixed|${esc(i.t)}">Rimuovi</button></div></div>`;
  if(i.k==='rotT')return`<div class="issue info"><p>Rotazione per un tipo di alimento che questo piano non ha (${esc(i.t)}). Non fa nulla.</p><div class="acts"><button class="btn line sm" data-tdel="rotate|${esc(i.t)}">Rimuovi</button></div></div>`;
  if(i.k==='noK')return`<div class="issue info"><p>Senza calorie note (${i.names.length}): ${i.names.slice(0,8).map(q).join(', ')}${i.names.length>8?'…':''}. Le kcal di questi alimenti non vengono contate.</p><div class="acts"><button class="btn line sm" data-tab="calorie">Aggiungile in Calorie</button></div></div>`;
 }).join('');
}
function renderWelcome(){const el=$('#welcome'),on=isExample(PLAN_REC);el.hidden=!on;if(!on)return;
 const logged=!!(SY&&SY.status().user);
 el.innerHTML=`<span>👋 <b>Benvenuto!</b> Questo è un <b>piano di esempio</b> per provare l'app. Carica il piano del tuo nutrizionista${logged?'':', oppure accedi con Google se hai già usato l\'app su un altro dispositivo'}.</span><span class="acts"><button class="btn sm" id="wPlan">Carica il mio piano</button>${logged?'':'<button class="btn line sm" id="wIn">🔑 Accedi con Google</button>'}</span>`;}
function renderPrefWarn(){renderWelcome();const n=checkPrefs().filter(ISS_MAIN).length;$('#prefWarn').hidden=!n;
 if(n)$('#prefWarn').innerHTML=`<span>⚠️ ${n===1?'Una preferenza non combacia':n+' preferenze non combaciano'} con il piano attivo: la spesa potrebbe non essere quella che ti aspetti.</span><button class="btn sm" id="prefGo">Rivedi</button>`;}
function changePrefs(f){const p=JSON.parse(JSON.stringify(PREFS));p.shopping=p.shopping||{};p.shopping.fixed=p.shopping.fixed||{};p.shopping.rotate=p.shopping.rotate||{};f(p);savePrefs(p);}
function savePrefs(p){writePrefs(p);reloadNoPrefs();}
function reloadNoPrefs(){if(new URLSearchParams(location.search).has('prefs')){const u=new URL(location.href);u.searchParams.delete('prefs');location.replace(u);}else location.reload();}
/* ====== EDITOR DELLE PREFERENZE ======
   Si lavora su una bozza (PD); «Salva» scrive le preferenze del piano attivo e ricarica l'app */
const PED_SKIP=['piattounico','libera'];
let PD=null, pdDirty=false;
const pdInit=()=>{PD=JSON.parse(JSON.stringify(PREFS));PD.shopping=PD.shopping||{};PD.shopping.fixed=PD.shopping.fixed||{};PD.shopping.rotate=PD.shopping.rotate||{};PD.breakfastExtras=PD.breakfastExtras||[];pdDirty=false;};
const pdTypes=()=>Object.entries(planTypes()).filter(([t,x])=>!PED_SKIP.includes(t)&&x.names.size>1);
const colTypes=()=>{const m=new Map();PLAN.days.forEach(d=>(d.meals.col||[]).forEach(c=>{if(!c.free&&!m.has(c.type))m.set(c.type,c.label);}));return m;};
const pdMode=t=>PD.shopping.fixed[t]!=null?'fix':PD.shopping.rotate[t]?'rot':'auto';
const rotList=(t,names)=>{const r=PD.shopping.rotate[t];return r&&r.options?r.options.filter(n=>names.includes(n)):[...names];};
function pdRotSet(t,names,list){const r=PD.shopping.rotate[t];if(!list.length)return false;
 if(list.length===names.length&&list.every((n,i)=>n===names[i]))delete r.options;else r.options=list;
 r.max=Math.min(Math.max(1,r.max||list.length),list.length);return true;}
function renderPrefEd(){
 if(!PD)pdInit();
 const q=s=>`«${esc(s)}»`, ct=colTypes();
 const rows=pdTypes().map(([t,x])=>{const names=[...x.names], m=pdMode(t), id=esc(t);
  let sum='Automatico', body='';
  if(m==='fix'){const v=PD.shopping.fixed[t], ok=names.includes(v);sum='Sempre '+q(v)+(ok?'':' ⚠️');
   body=`<select data-pfix="${id}">${ok?'':`<option selected>${esc(v)}</option>`}${names.map(n=>`<option ${n===v?'selected':''}>${esc(n)}</option>`).join('')}</select>${ok?'':'<p class="hint">⚠️ Questo prodotto non è nel piano attivo: scegline un altro.</p>'}`;}
  if(m==='rot'){const r=PD.shopping.rotate[t], on=rotList(t,names), off=names.filter(n=>!on.includes(n)), mx=Math.min(r.max||on.length,on.length);
   sum=`A rotazione: ${on.length} ${on.length===1?'prodotto':'prodotti'}, al massimo ${mx} a settimana`;
   body=`<div class="pmax"><span>Prodotti diversi a settimana, al massimo</span><input type="number" min="1" max="${on.length}" value="${mx}" data-pmax="${id}"></div>
   <p class="hint">In ordine di preferenza. Togli la spunta a quello che non vuoi comprare.</p>
   ${on.map((n,i)=>`<label class="prow"><input type="checkbox" checked data-prot="${id}" data-n="${esc(n)}"><span>${esc(n)}</span><button type="button" class="btn line sm" data-pup="${id}" data-i="${i}" ${i?'':'disabled'} aria-label="Più in alto">↑</button></label>`).join('')}
   ${off.map(n=>`<label class="prow off"><input type="checkbox" data-prot="${id}" data-n="${esc(n)}"><span>${esc(n)}</span></label>`).join('')}`;}
  if(m==='auto')body=`<p class="hint">L'app sceglie un prodotto alla volta, preferendo quelli che hai già in lista: così compri meno cose diverse.</p>`;
  return`<details class="ped" data-pt="${id}" ${pdOpen.has(t)?'open':''}><summary><b>${esc(x.label)}</b><small>${sum}</small></summary>
   <div class="pmode">${[['auto','Automatico'],['fix','Sempre lo stesso'],['rot','A rotazione']].map(([k,l])=>`<label><input type="radio" name="pm-${id}" value="${k}" data-pmode="${id}" ${m===k?'checked':''}> ${l}</label>`).join('')}</div>${body}</details>`;}).join('');
 const xs=PD.breakfastExtras.map((x,i)=>`<div class="planrow"><span>${esc(x.name)}<small>in alternativa a: ${(x.addTo||[]).map(t=>esc(ct.get(t)||t)).join(', ')||'—'}${x.kcal100?` · ${x.kcal100} kcal/100 ${x.kcalBase==='ml'?'ml':'g'}${x.kcalSrc==='ai'?' (stima AI)':''}`:''}</small></span><button class="btn line sm" data-pxdel="${i}" aria-label="Togli">🗑️</button></div>`).join('');
 const opts=[...ct].map(([t,l])=>`<label><input type="checkbox" data-pxt="${esc(t)}"> ${esc(l)}</label>`).join('');
 $('#prefEd').innerHTML=`<div class="setrow"><label for="pName">Il tuo nome <small>(compare nel titolo della pagina)</small></label><input id="pName" maxlength="40" value="${esc(PD.name||'')}" placeholder="facoltativo"></div>
  <h4 class="sub">🛒 Spesa: quale prodotto scegliere</h4>
  <p class="hint">Vale per gli alimenti con più alternative, quando nel Piano non ne hai spuntata una.</p>
  ${rows||'<p class="hint">Il piano attivo non ha alimenti con alternative.</p>'}
  <h4 class="sub">☕ Aggiunte a colazione</h4>
  <p class="hint">Un alimento che vuoi avere sempre come alternativa a colazione. La quantità viene calcolata per dare le stesse calorie, in media, delle altre alternative.</p>
  ${xs||'<p class="hint">Nessuna aggiunta.</p>'}
  ${ct.size?`<details class="off"><summary>➕ Aggiungi un alimento</summary><div class="pxform">
   <input id="pxN" data-sug autocomplete="off" placeholder="Nome (es. Fette biscottate integrali)" maxlength="60">
   <div class="pxk"><input id="pxK" type="number" min="1" max="900" placeholder="kcal per 100 g"><button type="button" class="btn line sm" id="pxAI">✨ Stima con AI</button></div>
   <p class="hint" id="pxKi" hidden></p>
   <p class="hint">Mettilo come alternativa a (la prima voce presente quel giorno):</p><div class="pxt">${opts}</div>
   <select id="pxC">${CAT_ORDER.map(c=>`<option ${c==='Colazione e dolci'?'selected':''}>${c}</option>`).join('')}</select>
   <button type="button" class="btn sm" id="pxAdd">Aggiungi</button></div></details>`:''}
  <div class="pbar"><button class="btn" id="pSave" ${pdDirty?'':'disabled'}>💾 Salva preferenze</button>${pdDirty?'<button class="btn line sm" id="pUndo">Annulla modifiche</button>':''}<button class="btn ghost sm" id="pReset">Ripristina le predefinite</button></div>
  ${pdDirty?'<p class="hint pdirty">Modifiche non ancora salvate.</p>':''}`;
}
/* stima kcal con Gemini: riempie il campo, l'utente controlla e conferma con Aggiungi */
let pxAI=null,pxAI0='g';
async function pxEstimate(n,fromAdd){const btn=$('#pxAI'),inf=$('#pxKi');
 btn.disabled=true;btn.textContent='⏳ Stima…';
 try{const ai=await import('./ai.js');const r=await ai.kcalEstimate(n);
  if($('#pxN').value.trim()!==n)return;
  $('#pxK').value=r.kcal100;pxAI={for:n,kcal100:r.kcal100};pxAI0=r.base;
  inf.hidden=false;inf.textContent=`✨ Stima AI: ${r.kcal100} kcal per 100 ${r.base} (${r.name}, affidabilità ${r.conf}). Controlla, correggi se hai l'etichetta${fromAdd?' e premi di nuovo Aggiungi':''}.`;}
 catch(e){console.warn(e);const ai=await import('./ai.js').catch(()=>null);toast(ai?ai.errText(e):'Stima AI non riuscita: scrivi le kcal a mano');}
 finally{const b=$('#pxAI');if(b){b.disabled=false;b.textContent='✨ Stima con AI';}}}
const pdOpen=new Set();
const pdTouch=()=>{pdDirty=true;renderPrefEd();};
$('#prefEd').addEventListener('toggle',e=>{const d=e.target.closest&&e.target.closest('details.ped');if(d){if(d.open)pdOpen.add(d.dataset.pt);else pdOpen.delete(d.dataset.pt);}},true);
$('#prefEd').addEventListener('input',e=>{if(e.target.id==='pxN'||e.target.id==='pxK'){if(e.target.id==='pxN')pxAI=null;else if(pxAI&&+e.target.value!==pxAI.kcal100)pxAI=null;const i=$('#pxKi');if(i&&!pxAI)i.hidden=true;}
 if(e.target.id==='pName'){PD.name=e.target.value.trim();if(!pdDirty){pdDirty=true;$('#pSave').disabled=false;}}});
$('#prefEd').addEventListener('change',e=>{const el=e.target, d=el.dataset, T=planTypes();
 if(d.pmode){const t=d.pmode,names=[...T[t].names];delete PD.shopping.fixed[t];delete PD.shopping.rotate[t];
  if(el.value==='fix')PD.shopping.fixed[t]=names[0];if(el.value==='rot')PD.shopping.rotate[t]={max:Math.min(3,names.length)};pdOpen.add(t);pdTouch();}
 if(d.pfix){PD.shopping.fixed[d.pfix]=el.value;pdTouch();}
 if(d.pmax){const t=d.pmax,r=PD.shopping.rotate[t],n=rotList(t,[...T[t].names]).length;r.max=Math.min(Math.max(1,Math.round(+el.value)||1),n);pdTouch();}
 if(d.prot){const t=d.prot,names=[...T[t].names],list=rotList(t,names);
  const nl=el.checked?[...list,d.n]:list.filter(n=>n!==d.n);
  if(!pdRotSet(t,names,nl)){el.checked=true;toast('Lascia almeno un prodotto');return;}pdTouch();}
});
$('#prefEd').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const d=b.dataset;
 if(d.pup){e.preventDefault();const t=d.pup,names=[...planTypes()[t].names],l=rotList(t,names),i=+d.i;[l[i-1],l[i]]=[l[i],l[i-1]];pdRotSet(t,names,l);pdTouch();}
 if(d.pxdel){PD.breakfastExtras.splice(+d.pxdel,1);pdTouch();}
 if(b.id==='pxAdd'){const n=$('#pxN').value.trim(),k=+$('#pxK').value,to=$$('[data-pxt]').filter(x=>x.checked).map(x=>x.dataset.pxt);
  if(!n){toast('Scrivi il nome');return;}if(!to.length){toast('Scegli a cosa farlo da alternativa');return;}
  if(PD.breakfastExtras.some(x=>x.name.toLowerCase()===n.toLowerCase())){toast('C\'è già');return;}
  {const T=planTypes();if(to.some(t=>T[t]&&[...T[t].names].some(x=>x.toLowerCase()===n.toLowerCase()))){toast('È già tra le alternative del piano');return;}}
  const known=typeof KCAL[n]==='number';
  if(!known&&!(k>0)){const m=foodBest(n);if(m&&typeof m.k==='number'&&m.k>0){$('#pxK').value=m.k;const x=$('#pxKi');x.hidden=false;x.textContent=`📚 Dalla banca dati: ${m.k} kcal per 100 ${m.u==='ml'?'ml':'g'} (${m.n}). Controlla e premi di nuovo Aggiungi.`;return;}
   if(SY&&SY.signedIn()){pxEstimate(n,true);return;}toast('Non è nella banca dati: scrivi le kcal per 100 g dall\'etichetta (o accedi con Google per la stima AI)');return;}
  const short=n.split(' ').slice(0,2).join(' ');
  const ai=pxAI&&pxAI.for===n&&pxAI.kcal100===k;pxAI=null;
  PD.breakfastExtras.push(Object.assign({name:n,cat:$('#pxC').value,addTo:to,labelSuffix:' o '+short.toLowerCase(),round:5},k>0&&!known?{kcal100:k}:{},k>0&&!known&&ai?{kcalSrc:'ai'}:{},k>0&&!known&&ai&&pxAI0==='ml'?{kcalBase:'ml'}:{}));pdTouch();}
 if(b.id==='pxAI'){const n=$('#pxN').value.trim();if(!n){toast('Scrivi prima il nome');return;}
  if(typeof KCAL[n]==='number'){toast(`L'app lo conosce già: ${KCAL[n]} kcal per 100 g`);return;}pxEstimate(n,false);}
 if(b.id==='pUndo'){pdInit();renderPrefEd();}
 if(b.id==='pSave'){const p=JSON.parse(JSON.stringify(PD));if(!p.name)delete p.name;savePrefs(p);}
 if(b.id==='pReset'&&confirm('Tornare alle preferenze predefinite per questo piano? Le tue scelte qui sopra si perdono.')){clearPrefs();reloadNoPrefs();}
});


/* ====== ACCOUNT (Firebase, caricato a parte: se manca la rete l'app funziona lo stesso) ====== */
let SY=null, syState='', syErr=null;
function renderAccount(){
 const el=$('#acct');if(!el)return;
 if(!SY){el.innerHTML=`<p class="hint">${navigator.onLine?'Sto caricando l\'accesso…':'Senza connessione non puoi accedere: l\'app funziona lo stesso e salva i dati su questo dispositivo.'}</p>`;return;}
 const st=SY.status(), u=st.user;
 if(!u){el.innerHTML=`<p class="hint">Accedi con Google per salvare piani, scelte e diario nel cloud e ritrovarli su telefono e computer. Senza accesso l'app funziona lo stesso, solo su questo dispositivo.</p><div class="bkrow"><button class="btn sm" id="acIn">🔑 Accedi con Google</button></div>`;return;}
 const when=st.at?new Date(st.at).toLocaleString('it-IT',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'mai';
 const stTxt=syState==='sync'?'⏳ Sincronizzazione in corso…':syState==='error'?`⚠️ Ultima sincronizzazione non riuscita${navigator.onLine?'':' (sei offline)'}: riprovo da solo.`:`✅ Sincronizzato · ${when}`;
 el.innerHTML=`<div class="acrow">${u.photo?`<img src="${esc(u.photo)}" alt="" referrerpolicy="no-referrer">`:'<span class="av">👤</span>'}<span><b>${esc(u.name||u.email)}</b><small>${esc(u.email||'')}</small></span></div>
  <p class="hint">${stTxt}</p>
  <div class="bkrow"><button class="btn ghost sm" id="acSync">🔄 Sincronizza ora</button><button class="btn line sm" id="acOut">Esci</button></div>
  <details class="off"><summary>Cancella i miei dati dal cloud</summary><p class="hint">Elimina dal cloud piani, scelte e diario e chiude il tuo account in questa app. I dati su questo dispositivo restano (puoi farne un backup).</p><button class="btn line sm" id="acDel">🗑️ Cancella dal cloud</button></details>`;
}
function onSync(ev){syState=ev;if(ev==='choose'&&!$('#syncChoice').open)$('#syncChoice').showModal();
 if(ev==='copy'&&confirm('Hai cambiato account e questo account non ha ancora dati nel cloud. Copiarci i dati di questo dispositivo?'))SY.run('device');if(ev==='in'||ev==='out')renderBackup();renderAccount();renderWelcome();}
import('./sync.js').then(async m=>{SY=m;window.addEventListener('dieta:changed',()=>m.changed());await m.start(onSync);renderAccount();renderWelcome();})
 .catch(e=>{console.warn('Accesso non disponibile:',e);renderAccount();});
async function acAction(id){
 try{
  if(id==='acIn'){await SY.signIn();}
  if(id==='acSync'){const r=await SY.run();if(r.ok&&!r.choose&&!r.queued&&!r.pulled)toast('Dati sincronizzati');}
  if(id==='acOut'){if(!confirm('Uscire dall\'account? I dati restano nel cloud.'))return;const saved=await SY.signOut();
   if(confirm((saved?'':'⚠️ Le ultime modifiche NON sono state salvate nel cloud (connessione assente?): se cancelli, le perdi.\n\n')+'Vuoi cancellare anche i dati da questo dispositivo? Fallo se il dispositivo non è tuo.\n\nOK = cancella da qui · Annulla = tienili')){window.dietaFrozen=true;['dietaApp.v1','dietaApp.plans','dietaApp.prefs'].forEach(k=>localStorage.removeItem(k));location.reload();}else{renderAccount();toast('Sei uscito');}}
  if(id==='acDel'){if(!confirm('Cancellare tutti i tuoi dati dal cloud e chiudere l\'account? Non si può annullare.'))return;await SY.deleteCloud();renderAccount();toast('Dati cancellati dal cloud');}
  if(id==='scCloud'||id==='scDevice'){$('#syncChoice').close();const r=await SY.run(id==='scCloud'?'cloud':'device');if(r.ok&&!r.pulled)toast('Dati di questo dispositivo salvati nel cloud');}
 }catch(e){console.error(e);const c=e&&e.code||'';
  toast(c==='auth/popup-closed-by-user'||c==='auth/cancelled-popup-request'?'Accesso annullato':c==='auth/unauthorized-domain'?'Questo indirizzo non è autorizzato in Firebase':c==='auth/network-request-failed'?'Serve la connessione':'Qualcosa non ha funzionato, riprova');renderAccount();}
}

/* ====== BACKUP ====== */
function renderBackup(){$('#bkLead').textContent=SY&&SY.status().user?'I dati sono salvati su questo dispositivo e nel cloud. Il backup resta utile come copia di sicurezza da tenere tu.':'Piani, preferenze, spunte, diario e lista sono salvati solo in questo browser. Fai un backup ogni tanto, oppure accedi con Google qui sopra.';$('#bkInfo').textContent=S.lastBackup?`Ultimo backup: ${new Date(S.lastBackup).toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'})}.`:'Non hai ancora fatto un backup.';}
function exportBackup(){
 S.lastBackup=new Date().toISOString();save();
 const name=`dieta-backup-${isoOf(new Date())}.json`, txt=JSON.stringify({app:'dietaApp',v:2,date:S.lastBackup,data:S,plans:readPlans(),prefs:readLocalPrefs()});
 const f=new File([txt],name,{type:'application/json'});
 if(matchMedia('(pointer:coarse)').matches&&navigator.canShare&&navigator.canShare({files:[f]}))navigator.share({files:[f],title:'Backup dieta'}).catch(()=>{});
 else{const a=document.createElement('a');a.href=URL.createObjectURL(f);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);}
 renderBackup();toast('Backup creato');
}
function importBackup(file){const fr=new FileReader();fr.onload=()=>{let j;try{j=JSON.parse(fr.result);}catch(e){toast('File non valido');return;}
 const d=j&&['dietaApp','dietaMatteo'].includes(j.app)?j.data:j;if(!d||typeof d!=='object'||!('picks' in d||'diary' in d)){toast('Questo file non è un backup della dieta');return;}
 const when=j.date?new Date(j.date).toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'}):'';
 if(!confirm(`Sostituire i dati di questo dispositivo con il backup${when?' del '+when:''}? Spunte, diario e lista attuali verranno sostituiti${j.plans?', insieme ai piani':''}.`))return;
 if(window.dietaFrozen)return;localStorage.setItem(LS,JSON.stringify(d));window.dispatchEvent(new Event('dieta:changed'));if(j.plans&&Array.isArray(j.plans.list)&&j.plans.list.length)writePlans(j.plans);if(j.prefs&&j.prefs.format==='dieta-prefs')writePrefs(j.prefs);else if(j.v>=2)clearPrefs();location.reload();};fr.readAsText(file);}

/* ====== SPESA ====== */
function shopItems(){
 const map=new Map(), ap=autoPicks();
 const add=(n,cat,src)=>{n=n.replace(' (per minestra)','');if(!CAT_ORDER.includes(cat))cat='Altro';const e=map.get(n)||{key:n,n,cat,src:[]};if(!e.src.includes(src))e.src.push(src);map.set(n,e);};
 DAYS.filter(w=>S.shopDays.includes(w.k)).map(w=>({...planOf(w.k),n:w.n})).forEach(d=>MEALS.forEach(([mk,mn])=>(d.meals[mk]||[]).forEach((c,i)=>{
  if(c.free)return;const cat=SHOP_CAT[c.t]||'Altro', src=`${d.n.slice(0,3)} ${mn.toLowerCase()}`;
  const o=c.opts[pickOf(pkey(d.k,mk,i),c,ap)];
  (o[3]||[[o[0],o[1],o[2]]]).forEach(b=>add(b[0],b[3]||cat,src));
 })));
 S.custom.forEach((c,i)=>map.set('custom|'+i,{key:'custom|'+i,n:c.n,cat:c.cat||'Altro',src:['aggiunto da te'],custom:i}));
 return[...map.values()].filter(e=>!S.hidden[e.key]);
}
/* le alternative non scelte nei giorni della lista: si possono mettere in lista con un tocco */
function shopAlts(inList){
 const g=new Map(), ap=autoPicks();
 DAYS.filter(w=>S.shopDays.includes(w.k)).map(w=>planOf(w.k)).forEach(d=>MEALS.forEach(([mk])=>(d.meals[mk]||[]).forEach((c,i)=>{
  if(c.free||c.opts.length<2)return;const cat=SHOP_CAT[c.t]||'Altro', j=pickOf(pkey(d.k,mk,i),c,ap);
  const e=g.get(c.label)||{label:c.label,chosen:new Set(),alts:new Map()};buyOf(c.opts[j]).forEach(n=>e.chosen.add(n));
  c.opts.forEach((o,k)=>{if(k!==j)(o[3]||[[o[0],o[1],o[2]]]).forEach(b=>{const n=b[0].replace(' (per minestra)','');if(!inList.has(n))e.alts.set(n,CAT_ORDER.includes(b[3]||cat)?(b[3]||cat):'Altro');});});
  g.set(c.label,e);})));
 return[...g.values()].map(e=>{e.chosen.forEach(n=>e.alts.delete(n));return e;}).filter(e=>e.alts.size).sort((a,b)=>a.label.localeCompare(b.label));
}
let altOpen=false;
let shopDate=isoOf(new Date());
const sdFmt=iso=>dateOf(iso).toLocaleDateString('it-IT',{weekday:'short',day:'numeric',month:'short'});
const bought=i=>(S.shopLog[shopDate]||[]).some(x=>x.n===i.n);
const lastBuy=i=>Object.keys(S.shopLog).filter(k=>k!==shopDate&&S.shopLog[k].some(x=>x.n===i.n)).sort().pop();
function shopMark(key,on){const it=shopItems().find(i=>i.key===key)||{n:(S.custom[+key.split('|')[1]]||{}).n||key,cat:'Altro'};
 const l=(S.shopLog[shopDate]||[]).filter(x=>x.n!==it.n);if(on)l.push({n:it.n,cat:it.cat});
 if(l.length)S.shopLog[shopDate]=l;else delete S.shopLog[shopDate];
 save();renderShop();}
function renderShopHist(){const ds=Object.keys(S.shopLog||{}).filter(k=>S.shopLog[k].length).sort().reverse();
 $('#shopHistBox').hidden=!ds.length;
 $('#shopHist').innerHTML=ds.map(k=>{const l=S.shopLog[k];return`<details class="shist"><summary><b>${esc(sdFmt(k))}</b> · ${l.length} ${l.length===1?'prodotto':'prodotti'}${k===shopDate?' · <em>in corso</em>':''}</summary><ul>${catOrd().map(c=>l.filter(x=>x.cat===c).map(x=>`<li>${esc(x.n)}</li>`).join('')).join('')}${l.filter(x=>!catOrd().includes(x.cat)).map(x=>`<li>${esc(x.n)}</li>`).join('')}</ul><div class="tools"><button class="btn line sm" data-sdgo="${k}">Aggiungi a questa spesa</button><button class="btn line sm" data-sldel="${k}">Elimina</button></div></details>`;}).join('');}
const srcFmt=s=>s.length<=3?s.join(' · '):`${s.length} pasti: ${[...new Set(s.map(x=>x.split(' ')[0]))].join(', ')}`;
function renderShop(){
 $('#shopDays').innerHTML=DAYS.map(d=>`<button class="chip ${S.shopDays.includes(d.k)?'on':''}" data-sday="${esc(d.k)}">${esc(d.n.slice(0,3))}</button>`).join('');
 const all=shopItems(), items=all.filter(i=>!inPantry(i)), pan=all.filter(inPantry), done=items.filter(bought).length;
 if(!$('#catEdit').hidden)renderCatEdit();
 $('#sDate').value=shopDate;$('#sToday').hidden=shopDate===isoOf(new Date());renderShopHist();
 $('#shopCount').textContent=items.length?`${done}/${items.length} presi`:'';
 $('#shopBar').style.width=items.length?`${done/items.length*100}%`:'0';
 const hiddenN=Object.keys(S.hidden).length;
 $('#restoreHidden').hidden=!hiddenN;$('#restoreHidden').textContent=`Ripristina ${hiddenN} voci nascoste`;
 if(!S.shopDays.length&&!S.custom.length){$('#shopList').innerHTML='<p class="empty">Seleziona almeno un giorno per creare la lista.</p>';return;}
 $('#shopList').innerHTML=catOrd().map(cat=>{
  const its=items.filter(i=>i.cat===cat).sort((a,b)=>bought(a)-bought(b)||a.n.localeCompare(b.n));
  if(!its.length)return'';
  return`<section class="cat"><h4>${CAT_ICON[cat]} ${cat}</h4>${its.map(i=>`<label class="item ${bought(i)?'done':''}"><input type="checkbox" data-check="${esc(i.key)}" ${bought(i)?'checked':''}><span class="nm">${esc(i.n)}<small>${esc(srcFmt(i.src))}${!bought(i)&&lastBuy(i)?` · ultima volta ${esc(sdFmt(lastBuy(i)))}`:''}</small></span>${i.custom?'':`<button class="pan" data-pantry="${esc(i.key)}" title="Ce l'ho già in dispensa" aria-label="Ce l'ho già">🏠</button>`}<button class="x" data-hide="${esc(i.key)}" aria-label="Rimuovi">×</button></label>`).join('')}</section>`;
 }).join('')+altHtml(all)+(pan.length?`<details class="pantry card"><summary>🏠 In dispensa (${pan.length}): non li devi comprare</summary>${pan.sort((a,b)=>a.n.localeCompare(b.n)).map(i=>`<div class="item"><span class="nm">${esc(i.n)}<small>Ce l'hai dal ${dateOf(S.pantry[i.key]).toLocaleDateString('it-IT',{day:'numeric',month:'short'})}</small></span><button class="btn line sm" data-pantry="${esc(i.key)}">Finito, rimetti in lista</button></div>`).join('')}</details>`:'');
}
function altHtml(all){const inList=new Set(all.map(i=>i.n)), gs=shopAlts(inList), n=gs.reduce((a,e)=>a+e.alts.size,0);
 if(!n)return'';
 return`<details class="alts card" id="shopAlts" ${altOpen?'open':''}><summary>🔄 Altre alternative del piano (${n})<small>In lista c'è un prodotto per voce: quello scelto nel Piano o il suggerito. Qui trovi gli altri, se vuoi comprarli.</small></summary>${gs.map(e=>`<div class="altg"><h5>${esc(e.label)}<small>in lista: ${esc([...e.chosen].join(', '))}</small></h5>${[...e.alts].sort((a,b)=>a[0].localeCompare(b[0])).map(([nm,cat])=>`<div class="item"><span class="nm">${esc(nm)}</span><button class="btn line sm" data-altadd="${esc(nm)}" data-acat="${esc(cat)}">+ Metti in lista</button></div>`).join('')}</div>`).join('')}</details>`;}
function shopText(){const items=shopItems().filter(i=>!bought(i)&&!inPantry(i));return'🛒 Lista della spesa\n'+catOrd().map(c=>{const its=items.filter(i=>i.cat===c);return its.length?`\n${c}\n`+its.map(i=>`☐ ${i.n}`).join('\n'):'';}).join('\n');}

/* ====== IMPOSTAZIONI GRAFICHE ====== */
function renderSettings(){
 const u=Object.assign({},UI_DEF,S.ui);
 $$('.set [data-set]').forEach(el=>{const k=el.dataset.set;
  if(k==='pal')el.innerHTML=Object.entries(PAL).map(([v,p])=>`<button data-v="${v}" class="${u.pal===v?'on':''}" aria-pressed="${u.pal===v}"><i style="background:linear-gradient(135deg,${p.l[0]} 50%,${p.d[0]} 50%)"></i>${p.n}</button>`).join('');
  else if(k==='font')el.innerHTML=Object.entries(FONTS).map(([v,f])=>`<button data-v="${v}" class="${u.font===v?'on':''}" style="font-family:${f[1].replace(/"/g,"'")}">${f[0]}</button>`).join('');
  else el.innerHTML=UI_OPT[k].map(([v,n])=>`<button data-v="${v}" class="${u[k]===v?'on':''}">${n}</button>`).join('');});
}
function setUI(k,v){S.ui=Object.assign({},S.ui,{[k]:v});save();applyUI(S.ui);renderSettings();}
/* ====== EVENTI ====== */
function setTab(t){S.tab=t;save();$$('.tab').forEach(b=>b.classList.toggle('on',b.dataset.tab===t));$$('main > section').forEach(s=>s.hidden=s.id!==t);if(t==='spesa')renderShop();if(t==='diario')renderDiary();if(t==='calorie')renderCalorie();if(t==='impost'){renderAccount();renderSettings();renderPlans();renderPrefCheck();renderPrefEd();renderBackup();}if(t==='piano')renderPrefWarn();window.scrollTo({top:0});}
document.addEventListener('click',e=>{
 const b=e.target.closest('button,[data-tab]');if(!b)return;
 if(b.dataset.tab)setTab(b.dataset.tab);
 if(b.dataset.v&&b.closest('[data-set]'))setUI(b.closest('[data-set]').dataset.set,b.dataset.v);
 if(b.id==='setBtn')setTab('impost');
 if(b.id==='themeBtn')setUI('theme',document.documentElement.dataset.theme==='dark'?'light':'dark');
 if(b.id==='uiReset'){S.ui={};save();applyUI(S.ui);renderSettings();toast('Grafica ripristinata');}
 if(b.id==='swapReset'){S.swap={};save();renderDays();renderPlan();toast('Settimana ripristinata');}
 if(b.dataset.day){S.day=b.dataset.day;save();renderDays();renderPlan();}
 if(b.dataset.recipe)openRecipe(b.dataset.recipe);
 if(b.dataset.sday){const k=b.dataset.sday;S.shopDays=S.shopDays.includes(k)?S.shopDays.filter(x=>x!==k):[...S.shopDays,k];save();renderShop();}
 if(b.dataset.altadd){e.preventDefault();const n=b.dataset.altadd;if(!S.custom.some(c=>c.n===n))S.custom.push({n,cat:b.dataset.acat||'Altro'});altOpen=true;save();renderShop();toast(`${n}: messo in lista`);}
 if(b.dataset.pantry){e.preventDefault();const k=b.dataset.pantry;if(S.pantry[k]){delete S.pantry[k];toast('Rimesso nella lista');}else{S.pantry[k]=isoOf(new Date());delete S.checked[k];toast('Spostato in dispensa');}save();renderShop();}
 if(b.dataset.cmv)moveCat(b.dataset.cmv,+b.dataset.dir);
 if(b.id==='catBtn'){$('#catEdit').hidden=!$('#catEdit').hidden;renderCatEdit();}
 if(b.id==='catDone')$('#catEdit').hidden=true;
 if(b.id==='catReset'){S.catOrder=null;save();renderShop();}
 if(b.dataset.wk){wkOff=Math.max(0,wkOff+ +b.dataset.wk);renderWeek();}
 if(b.dataset.wgo){diaryDate=b.dataset.wgo;setTab('diario');}
 if(['acIn','acSync','acOut','acDel','scCloud','scDevice'].includes(b.id)){acAction(b.id);return;}
 if(b.id==='bkExp')exportBackup();
 if(b.id==='planImp')$('#planFile').click();
 if(b.id==='planPdf')pdfClick();
 if(b.id==='wIn'){acAction('acIn');return;}
 if(b.id==='wPlan'){setTab('impost');$('#planSet').scrollIntoView({behavior:'smooth'});$('#planFile').click();}
 if(b.id==='planExp')exportPlan();
 if(b.dataset.puse){const x=PLANS.list.find(y=>y.id===b.dataset.puse);if(x&&confirm(`Usare il piano «${x.title}»? Quello attuale va in archivio con le tue scelte.`))activatePlan(x.id);}
 if(b.dataset.pdel)deletePlan(b.dataset.pdel);
 if(b.id==='prefGo'){setTab('impost');$('#planSet').scrollIntoView({behavior:'smooth'});}
 if(b.dataset.fixapply){const t=b.dataset.fixapply,v=$(`[data-fixsel="${CSS.escape(t)}"]`).value;changePrefs(p=>{if(v)p.shopping.fixed[t]=v;else delete p.shopping.fixed[t];});}
 if(b.dataset.rotfix){const t=b.dataset.rotfix,sub=Object.fromEntries($$(`[data-rotsel="${CSS.escape(t)}"]`).map(x=>[x.dataset.old,x.value]));changePrefs(p=>{const r=p.shopping.rotate[t];const o=[];(r.options||[]).forEach(n=>{const v=n in sub?sub[n]:n;if(v&&!o.includes(v))o.push(v);});if(o.length)r.options=o;else delete r.options;});}
 if(b.dataset.xdel){const i=+b.dataset.xdel;changePrefs(p=>{p.breakfastExtras.splice(i,1);});}
 if(b.dataset.tdel){const x=b.dataset.tdel,g=x.slice(0,x.indexOf('|')),t=x.slice(x.indexOf('|')+1);changePrefs(p=>{delete p.shopping[g][t];});}
 if(b.id==='bkImp')$('#bkFile').click();
 if(b.dataset.hide){e.preventDefault();const k=b.dataset.hide;if(k.startsWith('custom|')){S.custom.splice(+k.split('|')[1],1);}else S.hidden[k]=true;delete S.checked[k];save();renderShop();}
 if(b.dataset.pick){const k=b.dataset.pick,j=b.dataset.j;if(String(S.picks[k])===j)delete S.picks[k];else S.picks[k]=j;save();renderPlan();}
 if(b.dataset.dshift){const t=dateOf(diaryDate);t.setDate(t.getDate()+(+b.dataset.dshift));diaryDate=isoOf(t);renderDiary();}
 if(b.id==='dToday'){diaryDate=isoOf(new Date());renderDiary();}
 if(b.dataset.dgo){diaryDate=b.dataset.dgo;renderDiary();}
 if(b.dataset.del){S.diary[diaryDate].splice(+b.dataset.del,1);if(!S.diary[diaryDate].length)delete S.diary[diaryDate];snapDay(diaryDate);save();renderDiary();}
 if(b.dataset.asplan){const mk=b.dataset.asplan,d=dPlan(),miss=[],add=[];
  d.meals[mk].forEach((c,ci)=>{if(c.free)return;if(c.opts.length>1&&!isSel(S.picks[pkey(d.k,mk,ci)]))miss.push(c.label);const j=pickOf(pkey(d.k,mk,ci),c);add.push(planEntry(d,mk,ci,j));});
  if(add.length){(S.diary[diaryDate]=S.diary[diaryDate]||[]).push(...add);snapDay(diaryDate);save();renderDiary();}
  toast(miss.length?`Pasto segnato. Per ${miss.join(', ').toLowerCase()} ho usato il suggerito`:'Pasto segnato come da piano');}
 if(b.dataset.dadd){const w=b.closest('.dadd'),v=$('[data-dsel]',w).value;if(!v){toast('Scegli un alimento dal menu');return;}const [ci,j]=v.split(':').map(Number);diaryAdd(planEntry(dPlan(),b.dataset.dadd,ci,j,$('[data-dq]',w).value));}
 if(b.dataset.oadd){const w=b.closest('.dadd'),n=$('[data-on]',w).value.trim(),q=+$('[data-oq]',w).value||0,k=+$('[data-ok]',w).value||0;if(!n){toast("Scrivi il nome dell'alimento");return;}if(!k&&!confirm('Non hai indicato le kcal: vuoi aggiungerlo lo stesso?'))return;diaryAdd({m:b.dataset.oadd,n,q,u:q?unitOfFood(w._fn||n):'',k,off:true});}
 if(b.dataset.cfdel){S.customFoods.splice(+b.dataset.cfdel,1);save();renderCalorie();}
 if(b.id==='today'){S.day=DAYS[todayIdx()].k;save();renderDays();renderPlan();setTab('piano');}
 if(b.id==='allDays'){S.shopDays=DAYS.map(d=>d.k);save();renderShop();}
 if(b.id==='noDays'){S.shopDays=[];save();renderShop();}
 if(b.id==='sToday'){shopDate=isoOf(new Date());renderShop();}
 if(b.dataset.sdgo){shopDate=b.dataset.sdgo;renderShop();$('#sDate').scrollIntoView({block:'center'});}
 if(b.dataset.sldel){const k=b.dataset.sldel;if(!confirm(`Eliminare la spesa del ${sdFmt(k)} dallo storico?`))return;delete S.shopLog[k];save();renderShop();}
 if(b.id==='restoreHidden'){S.hidden={};save();renderShop();}
 if(b.id==='resetPicks'&&confirm('Vuoi azzerare tutte le scelte degli alimenti?')){S.picks={};save();renderPlan();}
 if(b.id==='shareShop'){const t=shopText();if(navigator.share)navigator.share({title:'Lista della spesa',text:t}).catch(()=>{});else navigator.clipboard.writeText(t).then(()=>toast('Lista copiata negli appunti'));}
 if(b.id==='rAgain')openRecipe(recipeCtx.mk);
 if(b.id==='rClose')$('#recipe').close();
 if(b.id==='rAI')window.open('https://chatgpt.com/?q='+encodeURIComponent(aiPrompt()),'_blank','noopener');
 if(b.id==='rCopy'){const c=recipeCtx;navigator.clipboard.writeText(`${c.rec.title}\n\nIngredienti:\n${c.items.map(i=>`- ${i.n}: ${i.detail}`).join('\n')}\n\nProcedimento:\n${c.rec.steps.map((s,i)=>`${i+1}. ${s}`).join('\n')}`).then(()=>toast('Ricetta copiata'));}
});
document.addEventListener('change',e=>{
 const s=e.target;
 if(s.id==='daySwap'){const a=S.day,b=swapDays(a,s.value);save();renderDays();renderPlan();if(b){const n=k=>DAYS.find(x=>x.k===k).n.toLowerCase();toast(`Scambiati: ${n(a)} segue il piano ${del(planK(a))}, ${n(b)} quello ${del(planK(b))}`);}}
 if(s.id==='dSwap'){if(s.value===planK(wdOf(diaryDate).k))delete S.dplan[diaryDate];else S.dplan[diaryDate]=s.value;snapDay(diaryDate);save();renderDiary();}
 if(s.matches('select[data-key]')){if(s.value==='')delete S.picks[s.dataset.key];else S.picks[s.dataset.key]=s.value;s.classList.toggle('picked',s.value!=='');save();}
 if(s.matches('[data-dsel]')){const w=s.closest('.dadd');if(s.value){const [ci,j]=s.value.split(':').map(Number);const o=dPlan().meals[w.dataset.meal][ci].opts[j];$('[data-dq]',w).value=o[1];$('[data-du]',w).textContent=o[2]==='g'?'g':unitFmt(2,o[2]).replace(/^2 /,'');}}
 if(s.id==='dDate'&&s.value){diaryDate=s.value;renderDiary();}
 if(s.id==='cFrom'&&s.selectedOptions[0]){$('#cQ').value=s.selectedOptions[0].dataset.q;convert();}
 if(s.matches('[data-check]'))shopMark(s.dataset.check,s.checked);
 if(s.id==='sDate'&&s.value){shopDate=s.value;renderShop();}
});
$('#addForm').addEventListener('submit',e=>{e.preventDefault();const n=$('#addName').value.trim();if(!n)return;S.custom.push({n,cat:$('#addCat').value});$('#addName').value='';save();renderShop();});
$('#recipe').addEventListener('click',e=>{if(e.target.id==='recipe')e.target.close();});
let tt;function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('on'),1800);}
$('#addCat').innerHTML=CAT_ORDER.map(c=>`<option ${c==='Altro'?'selected':''}>${c}</option>`).join('');
document.addEventListener('change',e=>{if(e.target.id==='bkFile'&&e.target.files[0]){importBackup(e.target.files[0]);e.target.value='';}if(e.target.id==='planFile'&&e.target.files[0]){importPlan(e.target.files[0]);e.target.value='';}if(e.target.id==='pdfFile'&&e.target.files[0]){pdfStart(e.target.files[0]);e.target.value='';}});
document.addEventListener('input',e=>{const s=e.target;
 if(s.matches('[data-on],[data-oq]')){const w=s.closest('.dadd'),n=$('[data-on]',w).value.trim(),h=$('[data-oh]',w.parentNode);
  let fn=kGet(n)!=null?n:null,m=null;if(!fn&&n.length>=3){m=foodBest(n);if(m)fn=m.n;}
  const u=fn?unitOfFood(fn):'g',q=+$('[data-oq]',w).value;w._fn=fn;$('[data-oq]',w).placeholder=u==='g'?'g':u==='ml'?'ml':unitFmt(2,u).replace(/^2 /,'');
  const k=fn&&q?kcalOf(fn,q,u):null;if(k!=null)$('[data-ok]',w).value=Math.round(k);
  if(h)h.innerHTML=m?`≈ Calcolo con <b>${esc(m.n)}</b> (${esc(perE(m))}). Se non è lui, scegli un altro suggerimento o correggi le kcal.`:fn?`${esc(fn)}: ${esc(per(fn))}`:n.length>=3?'Non l\'ho trovato nella banca dati: scrivi tu le kcal (le trovi sull\'etichetta).':OH0;}
 if(s.id==='cQ'||s.id==='cTo')convert();
 if(s.id==='kSearch')renderKTable();
});
/* suggerimenti sotto i campi con il nome di un alimento (ricerca tollerante) */
const SRC={piano:'nel piano',tuo:'tuo',extra:'',bda:'banca dati'};
let sugI=null,sugR=[],sugJ=-1;
function sugBox(){let b=$('#sugBox');if(!b){b=document.createElement('div');b.id='sugBox';b.className='sug';b.hidden=true;b.setAttribute('role','listbox');document.body.appendChild(b);
 b.addEventListener('mousedown',e=>e.preventDefault());b.addEventListener('click',e=>{const x=e.target.closest('[data-sj]');if(x)sugPick(+x.dataset.sj);});}return b;}
function sugShow(i){const b=sugBox(),q=i.value.trim();sugI=i;sugJ=-1;sugR=q.length<2?[]:foodSearch(q,8);
 if(!sugR.length||sugR[0].n===i.value&&sugR.length===1){b.hidden=true;return;}
 b.innerHTML=sugR.map((e,j)=>`<button type="button" role="option" data-sj="${j}"><span>${esc(e.n)}</span><small>${esc(perE(e))}${SRC[e.src]?' · '+SRC[e.src]:''}</small></button>`).join('');
 const r=i.getBoundingClientRect(),w=Math.min(Math.max(r.width,280),innerWidth-16);
 b.style.width=w+'px';b.style.left=Math.max(8,Math.min(r.left,innerWidth-w-8))+scrollX+'px';b.style.top=r.bottom+scrollY+4+'px';b.hidden=false;}
function sugHide(){const b=$('#sugBox');if(b)b.hidden=true;sugI=null;}
function sugPick(j){const e=sugR[j],i=sugI;if(!e||!i)return;sugHide();i.value=e.n;i._pick=e.n;i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new CustomEvent('foodpick',{bubbles:true,detail:e}));}
document.addEventListener('input',e=>{const i=e.target;if(!i.matches||!i.matches('[data-sug]'))return;if(i._pick===i.value)return;i._pick=null;sugShow(i);},true);
document.addEventListener('focusout',e=>{if(e.target===sugI)setTimeout(()=>{if(sugI&&document.activeElement!==sugI)sugHide();},150);});
document.addEventListener('keydown',e=>{const b=$('#sugBox');if(!sugI||e.target!==sugI||!b||b.hidden)return;const n=sugR.length;
 if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();sugJ=(sugJ+(e.key==='ArrowDown'?1:-1)+n)%n;$$('[data-sj]',b).forEach((x,j)=>x.classList.toggle('on',j===sugJ));}
 else if(e.key==='Enter'&&sugJ>=0){e.preventDefault();sugPick(sugJ);}else if(e.key==='Escape')sugHide();});
addEventListener('resize',()=>sugHide());
document.addEventListener('foodpick',e=>{const i=e.target,f=e.detail;
 if(i.id==='cfN'&&typeof f.k==='number'){$('#cfK').value=f.k;}
 if(i.id==='pxN'&&typeof f.k==='number'){$('#pxK').value=f.k;pxAI=null;const x=$('#pxKi');if(x){x.hidden=false;x.textContent=`📚 Dalla banca dati: ${f.k} kcal per 100 ${f.u==='ml'?'ml':'g'} (${f.n}). Correggi se hai l'etichetta.`;}}});
$('#cfForm').addEventListener('submit',e=>{e.preventDefault();const n=$('#cfN').value.trim(),k=+$('#cfK').value;if(!n||!k){toast('Scrivi nome e kcal per 100 g');return;}S.customFoods=(S.customFoods||[]).filter(f=>f.n!==n);S.customFoods.push({n,k});$('#cfN').value='';$('#cfK').value='';save();renderCalorie();toast('Alimento aggiunto');});
applyUI(S.ui);
const setToday=()=>{$('#today').textContent=longDate(new Date());};
document.addEventListener('visibilitychange',()=>{if(!document.hidden)setToday();});
setToday();renderFoodList();
Object.keys(S.diary).forEach(iso=>{if(!S.dplanned[iso])snapDay(iso);});save();
renderDays();renderPlan();renderPrefWarn();setTab(['piano','diario','spesa','calorie','info'].includes(S.tab)?S.tab:'piano');
/* accesso per test e console del browser (lo script è un modulo, quindi non crea variabili globali) */
/* testi che dipendono dal piano e dalle preferenze */
document.title='La mia dieta'+(PREFS.name?' · '+PREFS.name:'');
$('#listInfo').hidden=!PLAN.days.some(d=>Object.values(d.meals).some(cs=>cs.some(c=>c.list)));
$('#credits').textContent=PLAN.credits||(PLAN.author?'Piano alimentare elaborato da '+PLAN.author+'.':'');
$('#xtraInfo').hidden=!XTRA.length;
if(XTRA.length)$('#xtraInfo').innerHTML=`A colazione trovi sempre anche ${XTRA.map(x=>x.info||`<b>${esc(x.name)}</b>`).join(' e ')}: le quantità sono calcolate per avere le stesse calorie, in media, delle alternative previste quel giorno.`;
bootDone();
window.app={PLANS,PLAN_REC,checkPrefs,activatePlan,PLAN,PREFS,DAYS,MEALS,S,setTab,renderDays,renderPlan,shopText,shopItems,genRecipe,autoPicks,pkey,save};
