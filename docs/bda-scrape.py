import json,os,urllib.request,concurrent.futures as cf,time
H=os.path.expanduser('~/.aki/tmp/bda');foods=json.load(open(os.path.expanduser('~/.aki/tmp/bda_foods.json')))['foods']
out=os.path.join(H,'raw.json');data=json.load(open(out)) if os.path.exists(out) else {}
def post(ep,fid):
    for k in range(4):
        try:
            r=urllib.request.Request('https://bda.ieo.it/api/BDA/'+ep,data=json.dumps({'language':0,'foodId':fid}).encode(),headers={'Content-Type':'application/json','User-Agent':'dieta-app (uso personale, non commerciale)'})
            return json.load(urllib.request.urlopen(r,timeout=30))
        except Exception as e: time.sleep(2+k*3)
    return None
def one(f):
    fid=f['idFood'];info=post('FoodInfo',fid);comp=post('FoodComponents',fid)
    if not info or not comp: return fid,None
    c={x['dscomp']+'|'+x['cnum']:x['valore'] for g in comp.get('foodComponents',[]) for x in g['components']}
    return fid,{'n':f['description'].strip(),'info':info.get('foodInfo'),'c':c}
todo=[f for f in foods if f['idFood'] not in data]
with cf.ThreadPoolExecutor(4) as ex:
    for i,(fid,v) in enumerate(ex.map(one,todo)):
        if v: data[fid]=v
        if i%100==0: json.dump(data,open(out,'w'));print(i,len(data),flush=True)
json.dump(data,open(out,'w'),ensure_ascii=False);print('done',len(data))
