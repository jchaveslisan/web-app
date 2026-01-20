import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    User as FirebaseUser
} from 'firebase/auth';
import { auth } from './firebase';
import { getUsuario } from './firebase-db';
import { User } from '@/types';
import { create } from 'zustand';

interface AuthState {
    user: User | null;
    loading: boolean;
    setUser: (user: User | null) => void;
    setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    loading: true,
    setUser: (user) => set({ user, loading: false }),
    setLoading: (loading) => set({ loading }),
}));

export const signIn = async (email: string, pass: string) => {
    const result = await signInWithEmailAndPassword(auth, email, pass);
    const userMetadata = await getUsuario(result.user.uid);
    return { auth: result.user, metadata: userMetadata };
};

export const logout = () => signOut(auth);

// Listener para cambios de estado de autenticación
export const initAuthListener = () => {
    onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
            const userMetadata = await getUsuario(firebaseUser.uid);
            useAuthStore.getState().setUser(userMetadata);
        } else {
            useAuthStore.getState().setUser(null);
        }
    });
};
