// Fill these in once you create a free Firebase project (see README.md).
// Until you do, the game automatically falls back to saving accounts/scores
// in the browser's local storage instead (works immediately, but per-device only).
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

export const isFirebaseConfigured =
  firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("YOUR_");
