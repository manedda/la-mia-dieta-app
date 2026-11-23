import json,re,os
d=json.load(open(os.path.expanduser('~/.aki/tmp/bda/raw.json')))
ACC={'E':'è','A':'à','O':'ò','U':'ù','I':'ì'}
PROPER=['Grana Padano','Parmigiano Reggiano','Ritz','Ferrarese','Mars','Kit-Kat','Brie','Emmental','Fontina','Asiago','Montasio','Bitto','Castelmagno','Gorgonzola','Taleggio','Italico','Provolone','Bel Paese','Camembert','Edam','Gruyère','Cheddar','Feta','Pecorino Romano','Pecorino Sardo','Pecorino Toscano','Caciocavallo','Coca-Cola','Nutella','Grana','San Daniele','Parma','Rhum','Martini']
def clean(s):
    s=re.sub(r"([AEIOU])'(?=[\s,)]|$)",lambda m:ACC[m.group(1)],s)
    s=re.sub(r',?\s+NS\b','',s)
    s=s.lower()
    s=s[0].upper()+s[1:]
    for p in PROPER:
        s=re.sub(r'\b'+re.escape(p.lower())+r'\b',p,s)
    return re.sub(r'\s+',' ',s).strip(' ,')
def cat(c,n):
    c=c or ''
    R=[('frutta secca|semi edibili','Frutta secca'),('paste alimentari','Pasta, riso e legumi'),('tuberi|patate','Frutta e verdura'),('zucchero|sciroppi|torrone','Colazione e dolci'),('panna|yogurt|uova','Latte, yogurt e uova'),('sale','Condimenti'),('frutta|bacche|verdur|insalata|crucifere|agliacee|germogli|funghi|alghe|olive|radice|legumi','Frutta e verdura'),
       ('pesc|crostacei|molluschi','Pesce'),('carne|frattaglie|insaccati|salumi|volatili|animali','Carne e salumi'),
       ('formaggi|soia','Formaggi e tofu'),('latte','Latte, yogurt e uova'),('pane|grissini|crackers|fette biscottate|farine|amidi','Pane e prodotti da forno'),
       ('cereali|fiocchi','Pasta, riso e legumi'),('biscotti|brioche|merendine|torte|pasticcini|marmellate|dolcificanti|creme|cacao|caramelle|cioccolat|gelati|candita','Colazione e dolci'),
       ('oli |grassi|burro|margarina|aceto|salse|erbe|spezie|dadi|brodi|lievitazione','Condimenti')]
    for k,v in R:
        if re.search(k,c):return v
    return 'Altro'
FIX={'Pane, Pasta e legumi':0}
ALIAS={'Pizza con pomodoro e mozzarella':'pizza margherita','Cocomero':'anguria','Pane, tipo pancarrè, bianco':'pancarrè pan carrè','Pane, tipo pancarrè, integrale':'pancarrè pan carrè',
 'Mele, con buccia':'mela','Uovo di gallina, intero':'uova uovo','Pomodori, maturi':'pomodoro pomodorini',"Tonno, sott'olio, sgocciolato":'scatola scatoletta','Tonno, in salamoia, sgocciolato':'scatola scatoletta naturale',
 'Riso, brillato, crudo':'riso bianco','Pasta di semola, cruda':'pasta','Bovino, vitellone, 15-18 mesi, carne magra, con grasso visibile':'carne rossa','Pollo, petto, senza pelle':'pollo petto',
 'Pane, tipo 0, pezzatura da 100g':'pane bianco comune','Mozzarella di vacca':'fior di latte vaccina','Latte di vacca, parzialmente scremato, uht':'latte','Olio di oliva extravergine':'evo','Lattuga':'insalata','Patate':'patata','Caffè moka, in tazza':'caffè espresso','Kaki o loti':'cachi','Patatine, in sacchetto, salate':'busta chips','Cornetto o brioche':'croissant semplice','Pecorino':'sardo','Grana':'grana padano',
 'Salsiccia di suino, fresca':'maiale','Bevanda a base di cola':'coca cola','Datteri, deglet noor, disidratati':'secchi','Uovo di gallina, albume':'albume','Yogurt di latte intero':'bianco',
 'Bevanda di mandorle, preparata da ricetta':'mandorla latte','Gelato confezionato, panna o fiordilatte, in vaschetta':'fior di latte','Broccolo a testa':'broccoli'}
CATI=['Frutta e verdura','Carne e salumi','Pesce','Latte, yogurt e uova','Formaggi e tofu','Pane e prodotti da forno','Colazione e dolci','Pasta, riso e legumi','Surgelati','Frutta secca','Snack e dolci','Condimenti','Altro']
def num(x):
    try:return round(float(str(x).replace(',','.')),1)
    except:return 0
out=[];seen=set()
for fid,v in d.items():
    c=v['c'];info=v['info'] or {}
    n=clean(v['n'])
    if n.lower() in seen: n+=' ('+fid+')'
    seen.add(n.lower())
    k=num(c.get('Energia, Ric con fibra|kcal'))
    ct=cat(info.get('catMercDescription'),n)
    if ct=='Altro' and not re.search(r'bevande|birra|vino|liquori|distillati|alcool|succhi|caffè|acqua|tè|sidro',info.get('catMercDescription') or ''): print('ALTRO',n,info.get('catMercDescription'))
    if re.search(r'yogurt|uov',n.lower()): ct='Latte, yogurt e uova'
    if re.search(r'^(pasta|riso|orzo|farro|couscous|gnocchi|polenta|quinoa|grano|miglio|teff|amaranto)',n.lower()) : ct='Pasta, riso e legumi'
    if 'legumi' in (info.get('catMercDescription') or '') : ct='Pasta, riso e legumi'
    if re.search(r'bevande|birra|\bvino\b|liquori|distillati|alcool|succhi|caffè|acqua',info.get('catMercDescription') or '') and 'aceto' not in (info.get('catMercDescription') or ''): ct='Altro'
    row=[n,round(k),num(c.get('Proteine totali|g')),num(c.get('Lipidi totali|g')),num(c.get('Carboidrati disponibili (MSE)|g')),num(c.get('Fibra alimentare totale|g')),CATI.index(ct)]
    if info.get('composeUm')=='ml': row.append('ml')
    a=' '.join(x for x in [ALIAS.get(n,''),'manzo' if n.startswith('Bovino') else '','maiale' if n.startswith('Suino') else ''] if x)
    if a: row+=[0]*(8-len(row)) if len(row)<8 else []; 
    if a:
        if len(row)==7: row.append(0)
        row.append(a)
    out.append(row)
out.sort(key=lambda r:r[0].lower())
doc={'fonte':'Gnagnarella P, Salvini S, Parpinel M. Banca Dati di Composizione degli Alimenti per Studi Epidemiologici in Italia. Versione 1.2022 sito web https://bda.ieo.it/',
 'campi':['nome','kcal per 100 g (o 100 ml)','proteine g','grassi g','carboidrati g','fibra g','categoria (indice)','unità (0=g, ml)','sinonimi'],'categorie':CATI,'alimenti':out}
p=os.path.expanduser('~/Desktop/dieta-app/data/alimenti.json')
print(len(out)); s=json.dumps(doc,ensure_ascii=False,separators=(',',':'));print(len(s))
open(os.path.expanduser('~/.aki/tmp/bda/alimenti.json'),'w').write(s)
import collections;print(collections.Counter(CATI[r[6]] for r in out))
for r in out[::40]:print(r)
