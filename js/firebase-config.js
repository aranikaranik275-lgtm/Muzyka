import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  getRedirectResult, signOut, onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, updateDoc, deleteDoc,
  getDocs, query, where, orderBy, limit, serverTimestamp, arrayUnion, arrayRemove }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyAmxnfmsOO4mVa9VbokU4MhghMS_pD1nfo",
  authDomain: "muzyka-app-8e19b.firebaseapp.com",
  projectId: "muzyka-app-8e19b",
  storageBucket: "muzyka-app-8e19b.firebasestorage.app",
  messagingSenderId: "321383766638",
  appId: "1:321383766638:web:383ae84e37f182f6f8e47f"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export {
  signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged,
  doc, setDoc, getDoc, collection, addDoc, updateDoc, deleteDoc,
  getDocs, query, where, orderBy, limit, serverTimestamp, arrayUnion, arrayRemove
};
