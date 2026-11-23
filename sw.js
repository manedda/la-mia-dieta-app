/* Service worker: rete prima (così vedi sempre l'ultima versione), copia salvata se sei offline o la rete è troppo lenta */
const C='dieta-app-v31', FILES=['./','index.html','css/app.css','js/theme-head.js','js/app.js','js/store.js','js/sync.js','js/ai.js','js/pdfimport.js','js/cerca.js','js/marca.js','data/alimenti.json','js/firebase-config.js','data/piano-esempio.json','data/preferenze-predefinite.json','manifest.webmanifest','img/apple-touch-icon.png','img/icon-192.png','img/icon-512.png','img/favicon-32.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(C).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 const r=e.request;if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;
 const fromCache=()=>caches.match(r,{ignoreSearch:true}).then(m=>m||(r.mode==='navigate'?caches.match('index.html'):undefined));
 e.respondWith(new Promise(res=>{let done=false;const fin=x=>{if(!done&&x){done=true;res(x);}};
  const t=setTimeout(()=>fromCache().then(fin),3000);
  fetch(r).then(x=>{clearTimeout(t);if(x.ok){const cp=x.clone();caches.open(C).then(c=>c.put(r,cp));}fin(x);})
   .catch(()=>{clearTimeout(t);fromCache().then(m=>{if(m)fin(m);else if(!done){done=true;res(Response.error());}});});
 }));
});
