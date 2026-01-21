import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    User as FirebaseUser
} from 'firebase/auth';
import { auth } from './firebase';
import { getUsuario, createUsuario, db, collection, getDocs, query, limit } from './firebase-db';
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
    let userMetadata = await getUsuario(result.user.uid);

    if (!userMetadata) {
        // Verificar si es el primer usuario del sistema
        const usuariosSnapshot = await getDocs(query(collection(db, 'usuarios'), limit(1)));
        const isFirstUser = usuariosSnapshot.empty;

        const newUser: User = {
            id: result.user.uid,
            username: result.user.displayName || email.split('@')[0],
            email: email,
            rol: isFirstUser ? 'superadmin' : 'operador',
            activo: isFirstUser ? true : false,
            creadoEn: new Date().toISOString()
        };
        await createUsuario(newUser);
        userMetadata = newUser;
    }

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
