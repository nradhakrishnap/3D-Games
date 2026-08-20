// Handles register/login/save-score.
// Uses Firebase (Auth + Firestore) when js/firebase-config.js has real keys.
// Otherwise falls back to a local-storage-based store so the game works
// immediately, per-device, with zero setup. Swap in Firebase later for
// accounts/scores that follow the player across devices.

import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";

const LOCAL_USERS_KEY = "cricket_users";
const LOCAL_SESSION_KEY = "cricket_session_user";

let firebaseState = null; // { auth, db, uid, name } once signed in via Firebase

async function hash(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function sanitizeName(name) {
  return name.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
}

function readLocalUsers() {
  return JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || "{}");
}
function writeLocalUsers(users) {
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
}

async function initFirebase() {
  if (firebaseState) return firebaseState;
  const { initializeApp } = await import(
    "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js"
  );
  const {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
  } = await import(
    "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js"
  );
  const { getFirestore, doc, getDoc, setDoc } = await import(
    "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js"
  );

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  firebaseState = {
    auth,
    db,
    fns: {
      createUserWithEmailAndPassword,
      signInWithEmailAndPassword,
      signOut,
      doc,
      getDoc,
      setDoc,
    },
    name: null,
  };
  return firebaseState;
}

function nameToEmail(name) {
  return `${sanitizeName(name)}@3dcricket.local`;
}

export async function registerUser(name, password) {
  name = name.trim();
  if (!name || !password) return { ok: false, error: "Name and password are required." };

  if (isFirebaseConfigured) {
    const fb = await initFirebase();
    try {
      const cred = await fb.fns.createUserWithEmailAndPassword(
        fb.auth,
        nameToEmail(name),
        password
      );
      await fb.fns.setDoc(fb.fns.doc(fb.db, "players", cred.user.uid), {
        name,
        highScore: 0,
        history: [],
      });
      fb.name = name;
      return { ok: true };
    } catch (e) {
      return { ok: false, error: friendlyFirebaseError(e) };
    }
  }

  const users = readLocalUsers();
  const key = sanitizeName(name);
  if (users[key]) return { ok: false, error: "That name is already taken." };
  users[key] = {
    name,
    passwordHash: await hash(password),
    highScore: 0,
    history: [],
  };
  writeLocalUsers(users);
  localStorage.setItem(LOCAL_SESSION_KEY, key);
  return { ok: true };
}

export async function loginUser(name, password) {
  name = name.trim();
  if (!name || !password) return { ok: false, error: "Name and password are required." };

  if (isFirebaseConfigured) {
    const fb = await initFirebase();
    try {
      await fb.fns.signInWithEmailAndPassword(fb.auth, nameToEmail(name), password);
      fb.name = name;
      return { ok: true };
    } catch (e) {
      return { ok: false, error: friendlyFirebaseError(e) };
    }
  }

  const users = readLocalUsers();
  const key = sanitizeName(name);
  const user = users[key];
  if (!user || user.passwordHash !== (await hash(password))) {
    return { ok: false, error: "Incorrect name or password." };
  }
  localStorage.setItem(LOCAL_SESSION_KEY, key);
  return { ok: true };
}

export async function logoutUser() {
  if (isFirebaseConfigured && firebaseState) {
    await firebaseState.fns.signOut(firebaseState.auth);
    firebaseState.name = null;
  }
  localStorage.removeItem(LOCAL_SESSION_KEY);
}

export function getCurrentUserName() {
  if (isFirebaseConfigured && firebaseState) return firebaseState.name;
  const key = localStorage.getItem(LOCAL_SESSION_KEY);
  if (!key) return null;
  const users = readLocalUsers();
  return users[key]?.name || null;
}

export async function getHighScore() {
  if (isFirebaseConfigured && firebaseState) {
    const uid = firebaseState.auth.currentUser?.uid;
    if (!uid) return 0;
    const snap = await firebaseState.fns.getDoc(
      firebaseState.fns.doc(firebaseState.db, "players", uid)
    );
    return snap.exists() ? snap.data().highScore || 0 : 0;
  }
  const key = localStorage.getItem(LOCAL_SESSION_KEY);
  const users = readLocalUsers();
  return users[key]?.highScore || 0;
}

export async function saveScore(runs, wickets, balls) {
  const entry = { runs, wickets, balls, playedAt: new Date().toISOString() };

  if (isFirebaseConfigured && firebaseState) {
    const uid = firebaseState.auth.currentUser?.uid;
    if (!uid) return { highScore: runs, isNewHighScore: true };
    const ref = firebaseState.fns.doc(firebaseState.db, "players", uid);
    const snap = await firebaseState.fns.getDoc(ref);
    const data = snap.exists() ? snap.data() : { highScore: 0, history: [] };
    const highScore = Math.max(data.highScore || 0, runs);
    const history = [...(data.history || []), entry].slice(-20);
    await firebaseState.fns.setDoc(ref, { ...data, highScore, history }, { merge: true });
    return { highScore, isNewHighScore: runs >= (data.highScore || 0) && runs > 0 };
  }

  const key = localStorage.getItem(LOCAL_SESSION_KEY);
  const users = readLocalUsers();
  const user = users[key];
  if (!user) return { highScore: runs, isNewHighScore: true };
  const wasHigh = runs > (user.highScore || 0);
  user.highScore = Math.max(user.highScore || 0, runs);
  user.history = [...(user.history || []), entry].slice(-20);
  writeLocalUsers(users);
  return { highScore: user.highScore, isNewHighScore: wasHigh };
}

function friendlyFirebaseError(e) {
  const code = e?.code || "";
  if (code.includes("email-already-in-use")) return "That name is already taken.";
  if (code.includes("wrong-password") || code.includes("invalid-credential") || code.includes("user-not-found"))
    return "Incorrect name or password.";
  if (code.includes("weak-password")) return "Password should be at least 6 characters.";
  return "Something went wrong. Please try again.";
}
