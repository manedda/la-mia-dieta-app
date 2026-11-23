const PAL={
 verde:{n:'Verde',l:['#2f6f4f','#e8f2ec','#f4f7f5'],d:['#6cc497','#1d2a23','#0f1411','#171e1a','#26302a']},
 petrolio:{n:'Petrolio',l:['#0f766e','#e0f2f0','#f2f7f7'],d:['#5fd0c3','#15302d','#0d1413','#141d1c','#24302f']},
 blu:{n:'Blu',l:['#2457a6','#e7eefa','#f4f6fa'],d:['#7aa7ee','#1a2333','#0e1218','#161b24','#262e3b']},
 viola:{n:'Viola',l:['#6a3fa0','#f0e9f8','#f7f4fa'],d:['#b592e8','#261d33','#121016','#1b1720','#2e2836']},
 rosa:{n:'Rosa',l:['#b03a6b','#f9e6ee','#faf4f6'],d:['#ee8fb6','#331c26','#150f12','#1f171b','#352a30']},
 rosso:{n:'Corallo',l:['#b42318','#fbe8e6','#faf5f4'],d:['#f08a7e','#331b19','#150f0e','#1f1716','#352a28']},
 arancio:{n:'Ambra',l:['#b45309','#fbeedd','#faf6f1'],d:['#f3a35c','#33251a','#15110d','#1f1a15','#352d25']},
 grafite:{n:'Grafite',l:['#374151','#eceef1','#f5f6f7'],d:['#c3c9d3','#23272e','#111316','#191c20','#2b2f35']}
};
const FONTS={sys:['Sistema','ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif'],
 round:['Arrotondato','ui-rounded,"SF Pro Rounded","Nunito","Varela Round",ui-sans-serif,-apple-system,sans-serif'],
 serif:['Classico','ui-serif,"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif'],
 read:['Leggibile','Verdana,"Atkinson Hyperlegible",Tahoma,"DejaVu Sans",sans-serif']};
const UI_DEF={theme:'auto',pal:'verde',font:'sys',size:'m',rad:'m',shadow:'si',dense:'no',emoji:'si'};
const UI_OPT={theme:[['auto','Automatico'],['light','☀️ Chiaro'],['dark','🌙 Scuro']],
 size:[['s','Piccolo'],['m','Normale'],['l','Grande'],['xl','Molto grande']],
 rad:[['s','Squadrati'],['m','Morbidi'],['l','Tondi']],
 shadow:[['si','Sì'],['no','No']],dense:[['no','Comoda'],['si','Compatta']],emoji:[['si','Sì'],['no','No']]};
const mqDark=matchMedia('(prefers-color-scheme: dark)');
function uiState(){let s={};try{s=(JSON.parse(localStorage.getItem('dietaApp.v1')||'{}').ui)||{};}catch(e){}return Object.assign({},UI_DEF,s);}
function applyUI(u){
 u=Object.assign({},UI_DEF,u||uiState());
 const dark=u.theme==='dark'||(u.theme==='auto'&&mqDark.matches), r=document.documentElement, p=PAL[u.pal]||PAL.verde, st=r.style;
 r.dataset.theme=dark?'dark':'light';st.colorScheme=dark?'dark':'light';st.setProperty('--lg',p.l[0]);
 if(dark){const [a,a2,bg,card,line]=p.d;st.setProperty('--acc',a);st.setProperty('--acc2',a2);st.setProperty('--bg',bg);st.setProperty('--card',card);st.setProperty('--line',line);st.setProperty('--ink','#e9eeeb');st.setProperty('--mute','#97a29c');}
 else{const [a,a2,bg]=p.l;st.setProperty('--acc',a);st.setProperty('--acc2',a2);st.setProperty('--bg',bg);st.setProperty('--card','#fff');st.setProperty('--line',`color-mix(in srgb,${a} 12%,#e6e8e7)`);st.setProperty('--ink','#17201b');st.setProperty('--mute','#65706a');}
 st.setProperty('--font',(FONTS[u.font]||FONTS.sys)[1]);
 st.setProperty('--r',{s:'8px',m:'18px',l:'26px'}[u.rad]||'18px');
 st.setProperty('--sh',u.shadow==='no'||dark?'none':'0 1px 2px rgba(16,40,28,.06),0 8px 24px rgba(16,40,28,.06)');
 st.zoom={s:'.92',m:'1',l:'1.1',xl:'1.22'}[u.size]||'1';
 r.classList.toggle('dense',u.dense==='si');r.classList.toggle('noemoji',u.emoji==='no');
 const m=document.querySelector('meta[name=theme-color]');if(m)m.content=dark?(dark?p.d[2]:p.l[2]):p.l[2];
 const b=document.getElementById('themeBtn');if(b){b.innerHTML=dark?'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>':'<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z"/></svg>';b.title=dark?'Passa al tema chiaro':'Passa al tema scuro';}
}
applyUI();
mqDark.addEventListener('change',()=>applyUI());
