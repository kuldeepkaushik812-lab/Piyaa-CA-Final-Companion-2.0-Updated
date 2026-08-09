import { initializeApp } from 'firebase/app';
import { initializeAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut, browserLocalPersistence, inMemoryPersistence, browserPopupRedirectResolver } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Use initializeAuth to avoid default IndexedDB persistence which fails in cross-origin iframes
export const auth = initializeAuth(app, {
  persistence: [browserLocalPersistence, inMemoryPersistence],
  popupRedirectResolver: browserPopupRedirectResolver
});

const provider = new GoogleAuthProvider();

export const PRIMARY_AUTHORIZED_EMAIL = 'kuldeepkaushik812@gmail.com';

// Sync cloud access control config
export const syncAccessControlFromCloud = async (): Promise<void> => {
  try {
    const configRef = doc(db, 'public_config', 'access_control');
    const snapshot = await getDoc(configRef);
    if (snapshot.exists()) {
      const data = snapshot.data();
      if (Array.isArray(data.emails)) {
        localStorage.setItem('authorized_emails_list', JSON.stringify(data.emails));
      }
      if (data.pin) {
        localStorage.setItem('master_security_pin', data.pin);
      }
    }
  } catch (e) {
    console.warn('Could not fetch cloud access control (using local):', e);
  }
};

// Realtime listener for access control updates from Firestore
export const subscribeAccessControlCloud = (onUpdate?: () => void) => {
  try {
    const configRef = doc(db, 'public_config', 'access_control');
    return onSnapshot(configRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (Array.isArray(data.emails)) {
          localStorage.setItem('authorized_emails_list', JSON.stringify(data.emails));
        }
        if (data.pin) {
          localStorage.setItem('master_security_pin', data.pin);
        }
        if (onUpdate) onUpdate();
      }
    }, (err) => {
      console.warn('Realtime access control sync offline mode:', err.message);
    });
  } catch (e) {
    return () => {};
  }
};

const pushAccessControlToCloud = async (emailsList: string[]) => {
  try {
    const configRef = doc(db, 'public_config', 'access_control');
    await setDoc(configRef, {
      emails: emailsList,
      updatedAt: new Date().toISOString(),
      updatedBy: auth.currentUser?.email || PRIMARY_AUTHORIZED_EMAIL
    }, { merge: true });
  } catch (e) {
    console.error('Error saving access control to cloud:', e);
  }
};

export const getAuthorizedEmails = (): string[] => {
  const allowed = [PRIMARY_AUTHORIZED_EMAIL.toLowerCase()];
  try {
    const extraAllowed = JSON.parse(localStorage.getItem('authorized_emails_list') || '[]');
    if (Array.isArray(extraAllowed)) {
      extraAllowed.forEach(e => {
        if (typeof e === 'string' && e.trim()) {
          const norm = e.toLowerCase().trim();
          if (!allowed.includes(norm)) allowed.push(norm);
        }
      });
    }
  } catch (e) {
    // fallback
  }
  return allowed;
};

export const addAuthorizedEmail = (email: string): string[] => {
  if (!email || !email.trim()) return getAuthorizedEmails();
  const norm = email.toLowerCase().trim();
  const currentList = getAuthorizedEmails();
  
  if (!currentList.includes(norm)) {
    const extra = JSON.parse(localStorage.getItem('authorized_emails_list') || '[]');
    const updatedExtra = Array.isArray(extra) ? extra : [];
    if (!updatedExtra.includes(norm)) updatedExtra.push(norm);
    localStorage.setItem('authorized_emails_list', JSON.stringify(updatedExtra));
    
    // Push update to Cloud Firestore
    pushAccessControlToCloud(getAuthorizedEmails());
  }
  
  return getAuthorizedEmails();
};

export const removeAuthorizedEmail = (email: string): string[] => {
  if (!email) return getAuthorizedEmails();
  const norm = email.toLowerCase().trim();
  if (norm === PRIMARY_AUTHORIZED_EMAIL.toLowerCase()) return getAuthorizedEmails();
  
  try {
    const current = JSON.parse(localStorage.getItem('authorized_emails_list') || '[]');
    const list = Array.isArray(current) ? current.filter((e: string) => e.toLowerCase().trim() !== norm) : [];
    localStorage.setItem('authorized_emails_list', JSON.stringify(list));
    
    // Push update to Cloud Firestore
    pushAccessControlToCloud(getAuthorizedEmails());
  } catch (e) {
    console.error('Failed to remove authorized email:', e);
  }
  return getAuthorizedEmails();
};

export const isAuthorizedEmail = (email?: string | null): boolean => {
  if (!email || !email.trim()) return false;
  const normalized = email.toLowerCase().trim();
  const allowed = getAuthorizedEmails();
  return allowed.includes(normalized);
};

export const getMasterPin = (): string => {
  return 'CA2026';
};

export const setMasterPin = (newPin: string): string => {
  return 'CA2026';
};

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const onAuthUserChanged = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, async (user) => {
    callback(user);
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedAccessToken = credential?.accessToken || null;
    return { user: result.user, accessToken: cachedAccessToken || '' };
  } catch (error: any) {
    if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
      console.log('Sign-in popup closed by user');
      return null;
    }
    if (error.code === 'auth/unauthorized-domain') {
      console.warn('Sign-in blocked by domain authorization. User alerted.');
      throw error;
    }
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};
