# Preferenze personali ("dieta-prefs", versione 1)

Le scelte che non vengono dal piano della nutrizionista ma dalla persona. Si parte da un file in `data/`:
- `preferenze-predefinite.json`: quelle di partenza per ogni nuovo utente (usate di default); le modifiche di ciascuno restano nel suo browser e nel suo account

Per provare l'app con un altro file: `http://localhost:8080/?prefs=nome` (carica `data/preferenze-nome.json`).

```json
{
  "format": "dieta-prefs", "version": 1,
  "name": "Matteo",
  "shopping": {
    "fixed":  { "pane": "Pane integrale", ... },
    "rotate": { "carne": {"options": ["Petto di pollo", "Manzo magro"], "max": 5}, ... }
  },
  "breakfastExtras": [ ... ]
}
```

- `name`: compare nel titolo della pagina.
- `shopping.fixed`: per un tipo di alimento, il prodotto suggerito per tutta la settimana (dispensa).
- `shopping.rotate`: per un tipo, i prodotti da alternare in ordine di preferenza (`options`, facoltativo: se manca valgono tutte le alternative del piano) e quanti prodotti diversi al massimo a settimana (`max`).
- Per i tipi non elencati, il suggerito è la prima alternativa i cui ingredienti sono già nella lista, altrimenti la prima del piano. Le spunte nel Piano vincono sempre.
- `breakfastExtras`: alternative aggiunte a ogni colazione, con quantità calcolata per avere le stesse kcal medie delle altre alternative:
  - `name`, `kcal100` (se l'alimento non è nella tabella calorie), `cat` (reparto della spesa)
  - `addTo`: tipi a cui aggiungerla, in ordine di priorità (si usa il primo presente a colazione)
  - `skipIfMealHas`: non aggiungerla se la colazione ha già quel tipo
  - `labelSuffix`, `round` (arrotondamento in grammi), `recipeType` (come la trattano le ricette), `short` e `info` (testi)


## Quando cambia il piano

Le preferenze citano tipi e nomi di alimenti del piano. Se carichi un piano nuovo, ⚙️ Impostazioni → «Preferenze e piano» mostra cosa non combacia più (un alimento fisso o in rotazione che non c'è più, un'aggiunta a colazione senza posto) e ti fa scegliere il sostituto. Sul Piano compare un avviso finché resta qualcosa da sistemare.

Le correzioni vengono salvate in questo browser e diventano le tue preferenze; ogni piano ricorda le proprie. Il file `data/preferenze-*.json` resta il punto di partenza. Per riprovare un file da zero: `?prefs=nome`.
