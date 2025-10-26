import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { createUserProfile } from '../services/firestoreService';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showWelcomeOverlay, setShowWelcomeOverlay] = useState(false);
  const [forceNavigationUpdate, setForceNavigationUpdate] = useState(0);
  const [dataRefreshTrigger, setDataRefreshTrigger] = useState(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signUp = async (email, password, name, currency) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(userCredential.user, { displayName: name });
    await createUserProfile(userCredential.user.uid, {
      name: name,
      email: email,
      currency: currency,
      uid: userCredential.user.uid,
      createdAt: new Date(),
    });
    // This flag will be read by HomeScreen to show the overlay
    setShowWelcomeOverlay(true);
  };

  const hideWelcomeOverlay = () => {
    setShowWelcomeOverlay(false);
  };

  const triggerNavigationUpdate = () => {
    setForceNavigationUpdate(prev => prev + 1);
  };

  const triggerDataRefresh = () => {
    setDataRefreshTrigger(prev => prev + 1);
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error("Error signing out in AuthContext: ", error);
    }
  };

  const value = {
    user,
    loading,
    showWelcomeOverlay,
    hideWelcomeOverlay,
    signUp,
    signOut,
    triggerNavigationUpdate,
    forceNavigationUpdate,
    triggerDataRefresh,
    dataRefreshTrigger,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
