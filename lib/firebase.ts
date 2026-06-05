import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBm1yF_Wza0m-3ECLl18CQEM29_NnhV8Q4",
  authDomain: "felhomes.firebaseapp.com",
  projectId: "felhomes",
  storageBucket: "felhomes.firebasestorage.app",
  messagingSenderId: "166547340446",
  appId: "1:166547340446:web:bfa99f93f85635ccd44f8f",
  measurementId: "G-EH04ZTVQ4Q",
};

const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);
export default app;
