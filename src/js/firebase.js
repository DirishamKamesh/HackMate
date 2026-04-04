import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Replace this configuration with your actual Firebase project config
const firebaseConfig = {
  apiKey: "AIzaSyAlX2fBJKrUdar36iIH3WcwD1p0BR5re0g",
  authDomain: "hackmate-376c3.firebaseapp.com",
  projectId: "hackmate-376c3",
  storageBucket: "hackmate-376c3.firebasestorage.app",
  messagingSenderId: "811871945224",
  appId: "1:811871945224:web:69ca43c1f2338a863d07bd",
  measurementId: "G-KNBLRJ06Y7",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
