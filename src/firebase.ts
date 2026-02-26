import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBcyOLcvVcNmO7bKAp6EW-7RZ802P_4jJs",
  authDomain: "reelkamai.firebaseapp.com",
  projectId: "reelkamai",
  storageBucket: "reelkamai.firebasestorage.app",
  messagingSenderId: "794155277309",
  appId: "1:794155277309:web:1c4caa1137527f7d559794",
  measurementId: "G-S7S9Y9S61P"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const analytics = getAnalytics(app);
