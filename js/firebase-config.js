// Configurazione pubblica del progetto Firebase (non è un segreto:
// la protezione dei dati è nelle regole di sicurezza, vedi firestore.rules).
export const firebaseConfig = {
  apiKey: "AIzaSyB5g0HlqKpLdARBtd-3F6MUIij4uCv1WVA",
  authDomain: "dieta-app-ce886.firebaseapp.com",
  projectId: "dieta-app-ce886",
  storageBucket: "dieta-app-ce886.firebasestorage.app",
  messagingSenderId: "830054866333",
  appId: "1:830054866333:web:299fd9aefd7fb3d5c3e374"
};
// ID della chiave Fraud Defense (ex reCAPTCHA Enterprise) per App Check: obbligatoria per usare Gemini (AI Logic).
// È pubblica; i domini ammessi sono impostati nella console Google Cloud.
export const recaptchaSiteKey = "6LcHcy4uAAAAAOqRq0QMnm7tqbtkyucoDfPYpBN-";
