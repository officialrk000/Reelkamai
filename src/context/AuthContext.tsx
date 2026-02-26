import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';

interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  bio?: string;
  coins?: number;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      // Unsubscribe from previous snapshot listener if exists
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }

      if (firebaseUser) {
        // Subscribe to user document changes
        unsubscribeSnapshot = onSnapshot(doc(db, 'users', firebaseUser.uid), (doc) => {
          if (doc.exists()) {
            setUser({ id: firebaseUser.uid, ...doc.data() } as User);
          } else {
             setUser({
              id: firebaseUser.uid,
              email: firebaseUser.email!,
              username: firebaseUser.displayName || 'User',
              avatar: firebaseUser.photoURL || undefined
            });
          }
          setLoading(false);
        }, (error) => {
          console.error("Auth snapshot error:", error);
          // Only set fallback user if we are still authenticated as this user
          if (auth.currentUser?.uid === firebaseUser.uid) {
            if (error.code === 'permission-denied' || (error.message && error.message.includes('app-check'))) {
              console.warn("FIREBASE AUTH ERROR (Permissions or App Check): Using basic auth fallback.");
              setUser({
                id: firebaseUser.uid,
                email: firebaseUser.email!,
                username: firebaseUser.displayName || 'User',
                avatar: firebaseUser.photoURL || undefined
              });
            }
          }
          setLoading(false);
        });
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
      }
    };
  }, []);

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
