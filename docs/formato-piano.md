# Formato del piano ("dieta-plan", versione 1)

Un piano è un file JSON con questa forma:

```json
{
  "format": "dieta-plan", "version": 1,
  "title": "Piano alimentare settimanale", "author": "Dott.ssa ...",
  "meals": [ {"key": "col", "name": "Colazione", "icon": "☕"}, ... ],
  "days": [
    { "key": "lun", "name": "Lunedì", "idea": "consigli del giorno (facoltativo)",
      "meals": { "col": [ componente, ... ], "pra": [ ... ] } }
  ]
}
```

Un **componente** è una voce del pasto, con una o più alternative tra cui scegliere:

```json
{ "type": "pane", "label": "Pane",
  "options": [
    {"name": "Pane bianco", "qty": 50, "unit": "g"},
    {"name": "Pane integrale", "qty": 60, "unit": "g"} ] }
```

- `type`: il tipo di alimento. Decide il reparto della spesa, i suggeriti e le ricette. Valori usati: latte, pane, creme, frutta, snack, crackers, legumi, verdure, olio, fruttasecca, carne, pesce, pescecons, salume, primo, formaggio, uova, cerealicol, yogurt, yogurtpro, piattounico, marmellata, dolce, bosco, patate, frenchtoast, minestra, piadina, tofu, soia, piselli, libera.
- `label`: il nome della voce mostrato nel Piano.
- `options`: le alternative. `qty` + `unit` (g, ml, pz, cucchiaini, cucchiai, vasetto, porzione, fetta, tazzina, misurino).
- `buy` (facoltativo, dentro un'opzione): cosa comprare davvero, se diverso dal nome. Esempio: "Pasta e ceci" → `[{"name":"Pasta di semola","qty":50,"unit":"g"},{"name":"Ceci secchi","qty":60,"unit":"g"}]`. `cat` forza il reparto.
- Campi facoltativi del componente: `list` (lettera della lista di scambio del PDF), `note`, `detail` (testo da mostrare al posto della quantità), `free: true` (pasto libero).


## Calorie nel piano (facoltative)

L'app conosce le calorie di molti alimenti comuni. Se il piano usa un alimento che non conosce, puoi scriverle nell'opzione:

- `"kcal100": 120` per gli alimenti in g o ml (kcal per 100 g o 100 ml);
- `"kcalUnit": 75` per quelli a pezzo, vasetto, porzione ecc. (kcal per una unità di `unit`).

Le kcal scritte nel piano valgono più di quelle interne. In ⚙️ Impostazioni, «Preferenze e piano» elenca gli alimenti del piano attivo senza calorie note.

## Note del piano (facoltative)

`"notes"`: testo libero del nutrizionista (integratori, consigli). Compare in ⚙️ Impostazioni → «Piano alimentare».

## Caricare un PDF

In ⚙️ Impostazioni → «Piano alimentare» → «📄 Carica da PDF» l'app manda il PDF a Gemini (Firebase AI Logic), che lo trascrive in questo formato con le calorie stimate. Serve l'accesso con Google.

- Se il PDF è una settimana (lunedì…domenica) i giorni si abbinano da soli.
- Se descrive **giornate tipo** (es. giorni di allenamento ON / OFF, «un giorno della settimana», domenica) scegli quale giornata usare in ciascun giorno. La proposta iniziale mette ON lunedì, mercoledì e venerdì, la giornata speciale il sabato, OFF gli altri giorni.
- Prima di salvare rivedi tutto: nomi, quantità, unità, calorie; puoi togliere voci o alternative. Le calorie mancanti sono evidenziate.
- La revisione resta salvata sul dispositivo finché non la salvi o la scarti («Continua dopo»).
- Le calorie lette dal PDF sono stime dell'AI; il piano lo dice nella riga dei crediti.

## Più piani

In ⚙️ Impostazioni → «Piano alimentare» puoi caricare un nuovo file in questo formato. Il piano attuale va in archivio insieme alle sue scelte (spunte, scambi di giorni, lista della spesa) e alle preferenze; se torni a usarlo le ritrovi. Il diario non cambia: ogni giorno registrato conserva gli alimenti segnati e le kcal previste con il piano di allora.
