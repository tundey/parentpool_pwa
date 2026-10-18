// js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  getDoc 
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-analytics.js";

// TODO: Replace with your actual Firebase project configuration credentials
const firebaseConfig = {
  apiKey: "AIzaSyDHr2sXjCgPYuh0rLbTAM5lLz8PtAdrMos",
  authDomain: "parentpool-ce2b8.firebaseapp.com",
  projectId: "parentpool-ce2b8",
  storageBucket: "parentpool-ce2b8.firebasestorage.app",
  messagingSenderId: "531621477930",
  appId: "1:531621477930:web:69ec39d1ee19cbca7c8d53",
  measurementId: "G-J70H734QKS"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const analytics = getAnalytics(app);
const googleProvider = new GoogleAuthProvider();

export { auth, db, analytics, googleProvider, signInWithPopup, signOut, onAuthStateChanged, collection, doc, getDocs, setDoc, deleteDoc, onSnapshot, getDoc };