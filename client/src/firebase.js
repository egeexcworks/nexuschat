import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDn4zvwdpjJ16uNtBp7ts_lZKMt64zgoX8",
  authDomain: "nexuschatofficials.firebaseapp.com",
  projectId: "nexuschatofficials",
  storageBucket: "nexuschatofficials.firebasestorage.app",
  messagingSenderId: "1018817779871",
  appId: "1:1018817779871:web:a6976bb274d13391ae2aaa",
  measurementId: "G-Z3KVH1CK72"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
