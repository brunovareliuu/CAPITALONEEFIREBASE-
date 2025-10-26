import { initializeApp, getApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { initializeAuth, getAuth, getReactNativePersistence, browserSessionPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from 'react-native';

// Configuración de Firebase para Capital One Hack MTY
const firebaseConfig = {
  apiKey: "AIzaSyCxhsxepEvYiPn6uz5qGRAlNxYWF_XwJs0",
  authDomain: "capitalonehackmty.firebaseapp.com",
  projectId: "capitalonehackmty",
  storageBucket: "capitalonehackmty.firebasestorage.app",
  messagingSenderId: "964817610055",
  appId: "1:964817610055:web:484bcfe2380ff60f375862",
  measurementId: "G-LC9ELCF23T"
};

// Initialize Firebase
let app;
try {
  app = initializeApp(firebaseConfig);
} catch (error) {
  if (error.code === 'app/duplicate-app') {
    // If app already exists, get the existing instance
    app = getApp();
  } else {
    throw error;
  }
}

// Initialize Auth with conditional persistence based on platform
let auth;
try {
  // Choose persistence based on platform
  const persistence = Platform.OS === 'web'
    ? browserSessionPersistence  // Web: session-based persistence
    : getReactNativePersistence(AsyncStorage);  // Mobile: AsyncStorage persistence

  auth = initializeAuth(app, {
    persistence: persistence
  });
} catch (error) {
  // If auth is already initialized, get the existing instance
  if (error.code === 'auth/already-initialized') {
    auth = getAuth(app);
  } else {
    throw error;
  }
}

// Initialize Firestore
const db = getFirestore(app);

// Initialize Analytics only if supported
let analytics = null;
isSupported().then((supported) => {
  if (supported) {
    analytics = getAnalytics(app);
  }
}).catch((error) => {
});

export { auth, db, analytics };
export default app;
