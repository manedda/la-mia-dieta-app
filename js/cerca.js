/* Ricerca alimenti tollerante: ignora maiuscole, accenti, ordine delle parole e parole come "di", "con";
   accetta singolare/plurale (zucchina/zucchine), parole iniziate (parmig) e piccoli errori di battitura (zuchine). */
const STOP=new Set('di e o a al alla allo ai agli alle con in da per il la lo le gli i un una del della dello dei degli delle nel nella tipo'.split(' '));
export const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
export const stem=t=>{if(t.length<=3||/\d/.test(t))return t;let s=t.replace(/[aeiou]$/,'');if(/[cg]h$/.test(s))s=s.slice(0,-1);return s.length>=3?s:t;};
export const toks=s=>norm(s).split(' ').filter(t=>t&&!STOP.has(t));
/* distanza di modifica (con scambio di due lettere vicine), si ferma appena supera max */
function lev(a,b,max){if(Math.abs(a.length-b.length)>max)return max+1;
 let p2=null,p=Array.from({length:b.length+1},(_,j)=>j);
 for(let i=1;i<=a.length;i++){const c=[i];let lo=i;
  for(let j=1;j<=b.length;j++){let v=Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));
   if(p2&&i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])v=Math.min(v,p2[j-2]+1);c[j]=v;if(v<lo)lo=v;}
  if(lo>max)return max+1;p2=p;p=c;}
 return p[b.length];}
/* stessa radice vale solo per singolare/plurale (zucchina/zucchine, pomodoro/pomodori), non polpo/polpa */
const END=new Set(['oi','io','ae','ea','ei','ie']);
const tail=(t,s)=>t.length>s.length?t[t.length-1]:'';
function sameWord(t,q,s){const a=tail(t,s),b=tail(q,s);return a===b||END.has(a+b)||s==='uov';}
function tokScore(q,qs,e,fz){let best=0,pos=-1;
 for(let i=0;i<e.t.length;i++){const t=e.t[i],s=e.s[i];let v=0;
  if(t===q)v=10;else if(s===qs&&sameWord(t,q,s))v=9;
  else if(q.length>=2&&t.startsWith(q))v=7;
  else if(qs.length>=4&&s.length>qs.length&&s.startsWith(qs))v=6.5;
  else if(fz&&q.length>=4&&t.length>=4&&lev(qs,s,qs.length>=8?2:1)<=(qs.length>=8?2:1))v=5;
  else if(fz&&q.length>=4&&t.length>=5&&[0,1,-1].some(d=>lev(qs,s.slice(0,qs.length+d),1)<=1))v=4.5;/* parola iniziata con un errore */
  else if(q.length>=4&&t.includes(q))v=4;
  if(v>=9&&i>=e.nt)v+=1.5;/* sinonimo scelto apposta (es. "uova" → uovo di gallina) */
  if(v>best){best=v;pos=i;}}
 return[best,pos];}
/* items: [{n, alias?, pri?, ...}] → indice riusabile */
export const index=items=>items.map(it=>{const t=toks(it.n+' '+(it.alias||''));return Object.assign({},it,{t,s:t.map(stem),nt:toks(it.n).length,nn:norm(it.n)});});
function scoreOf(e,qt,qs,nq,fz,full){let sc=0,miss=0,first=false;
 for(let j=0;j<qt.length;j++){const[v,p]=tokScore(qt[j],qs[j],e,fz);if(!v){miss++;continue;}if(full&&full[j]&&v<9)return null;sc+=v;if(j===0&&(p===0||p>=e.nt))first=true;/* prima parola o sinonimo */}
 if(miss&&(qt.length<3||miss>1))return null;
 sc=sc/qt.length-miss*3+(first?2:0)-Math.max(0,e.nt-qt.length)*0.5+(e.pri||0)+(e.nn===nq?8:0)+(e.nn.startsWith(nq)?1:0);
 return sc;}
/* risultati ordinati dal più simile; score medio per parola (10 = identico) */
/* gli errori di battitura contano solo se non c'è nessun risultato scritto giusto: "pollo" non deve trovare "polpo" */
/* una parola scritta per intero ("mela") non deve trovare parole più lunghe (Melanzane, Melagrane) */
const fullWords=(ix,qt,qs)=>qt.map((q,j)=>ix.some(e=>e.t.some((t,i)=>tokScore(q,qs[j],{t:[t],s:[e.s[i]],nt:1},false)[0]>=9)));
export function search(ix,query,lim=10){const qt=toks(query);if(!qt.length)return[];const qs=qt.map(stem),nq=norm(query),full=fullWords(ix,qt,qs);let out=[];
 for(const fz of[false,true]){for(const e of ix){const sc=scoreOf(e,qt,qs,nq,fz,full);if(sc!=null)out.push([sc,e]);}if(out.length)break;}
 out.sort((a,b)=>b[0]-a[0]||a[1].n.length-b[1].n.length);
 return out.slice(0,lim).map(([score,e])=>Object.assign({},e,{score}));}
/* il risultato migliore solo se è abbastanza sicuro (per calcolare le kcal da solo) */
export function best(ix,query){const r=search(ix,query,1)[0];return r&&r.score>=6?r:null;}
/* filtro semplice per un nome (tabella calorie) */
/* full: parole della ricerca scritte per intero, calcolate su un indice (vedi fullFor) */
export function matches(name,query,fz=false,full=null){const qt=toks(query);if(!qt.length)return true;const e=index([{n:name}])[0];return scoreOf(e,qt,qt.map(stem),norm(query),fz,full)!=null;}
export function fullFor(ix,query){const qt=toks(query);return fullWords(ix,qt,qt.map(stem));}
