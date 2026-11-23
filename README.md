# La mia dieta (app)

Nuova versione dell'app, separata dal vecchio sito (`~/Downloads/dieta-sito/`, repo `piano_alimentare`).
Obiettivo: lo stesso scheletro per qualsiasi piano alimentare, con utenti e sincronizzazione (Firebase) e piano importato dal PDF.

## Struttura
- `index.html`: la pagina (solo struttura)
- `css/app.css`: grafica
- `js/theme-head.js`: tema e colori, caricato subito per evitare lampi di colore
- `js/app.js`: tutta la logica (piano, spesa, diario, calorie, ricette, impostazioni)
- `js/store.js`: dove sono salvati piani e preferenze (archivio dei piani, controllo del formato); qui si aggancerà Firebase
- `js/firebase-config.js`, `firestore.rules`: configurazione pubblica del progetto Firebase e regole di sicurezza
- `data/piano-esempio.json`: piano di esempio mostrato al primo avvio, nel formato descritto in `docs/formato-piano.md`
- `data/preferenze-predefinite.json`: preferenze di partenza per ogni nuovo utente (`docs/preferenze.md`)
- `data/piano-uccheddu.json`, `data/preferenze-matteo.json`: dati personali di Matteo, **da non pubblicare** (sono in `.gitignore`). Servono solo una volta, per spostare piano e preferenze delle versioni precedenti nel suo account; poi si possono togliere.

## Utenti
Ogni utente parte dal piano di esempio, carica il proprio piano (⚙️ Impostazioni → Piano alimentare) e, se accede con Google, ritrova piani, preferenze e diario su tutti i dispositivi. I dati di ciascuno sono visibili solo a lui (`firestore.rules`).
- `sw.js`: funzionamento offline
- `manifest.webmanifest`, `img/`: icone e installazione sul telefono

## Provarla sul Mac
Il piano si carica da un file JSON, quindi la pagina va aperta da un piccolo server (non con doppio clic):

    cd ~/Desktop/dieta-app && python3 -m http.server 8080

poi apri http://localhost:8080

## Stato
- Passo 1 (fatto): piano separato dal codice, in JSON. L'app si comporta esattamente come la vecchia.
- Passo 2 (fatto): preferenze personali in `data/preferenze-*.json` (vedi `docs/preferenze.md`): nome, suggeriti della spesa, alternative fisse a colazione.
- Passo 3 (fatto): Firebase (accesso con Google, dati sincronizzati). L'app non contiene più dati personali: si parte dal piano di esempio.
- Passo 4 (fatto): importazione del piano dal PDF con Gemini (Firebase AI Logic) e revisione, anche per piani a giornate tipo (vedi `docs/formato-piano.md`); stima AI delle kcal nell'editor delle preferenze.

## AI (Gemini)
- `js/ai.js`: chiamate a Gemini tramite Firebase AI Logic (provider Gemini Developer API), solo per chi ha fatto l'accesso, massimo 60 richieste al giorno per dispositivo; nuovo tentativo e modello di riserva se il servizio è occupato.
- App Check è obbligatorio: chiave Fraud Defense (ex reCAPTCHA Enterprise) in `js/firebase-config.js`, valida solo sui domini pubblicati. In locale l'AI funziona solo con un token di debug registrato nella console Firebase e salvato in `localStorage['dietaApp.acDebug']`.
- `js/pdfimport.js`: estrazione del PDF, abbinamento delle giornate ai giorni, conversione nel formato del piano.
