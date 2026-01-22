import { db, collection, getDocs, query, where, addDoc, doc, getDoc, limit } from './firebase-db';
import { User } from '@/types';
import { create } from 'zustand';

interface AuthState {
    user: User | null;
    loading: boolean;
    setUser: (user: User | null) => void;
    setLoading: (loading: boolean) => void;
}

const STORAGE_KEY = 'ag_auth_user';

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    loading: true,
    setUser: (user) => {
        if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
        else localStorage.removeItem(STORAGE_KEY);
        set({ user, loading: false });
    },
    setLoading: (loading) => set({ loading }),
}));

export const signIn = async (usernameOrEmail: string, pass: string) => {
    // 1. Verificar si existen usuarios (si no, el primero es Superadmin)
    const usuariosRef = collection(db, 'usuarios');
    const uSnapshot = await getDocs(query(usuariosRef, limit(1)));

    if (uSnapshot.empty) {
        // Crear primer superadmin por defecto si no hay nadie
        const firstUser: User = {
            id: 'admin_initial',
            username: 'admin',
            email: usernameOrEmail,
            password: pass,
            rol: 'superadmin',
            activo: true,
            creadoEn: new Date().toISOString()
        };
        const docAdded = await addDoc(usuariosRef, firstUser);
        firstUser.id = docAdded.id;
        useAuthStore.getState().setUser(firstUser);
        return { success: true, user: firstUser };
    }

    // 2. Intentar buscar por username o email
    let q = query(usuariosRef, where('username', '==', usernameOrEmail), where('password', '==', pass));
    let snapshot = await getDocs(q);

    if (snapshot.empty) {
        q = query(usuariosRef, where('email', '==', usernameOrEmail), where('password', '==', pass));
        snapshot = await getDocs(q);
    }

    if (snapshot.empty) {
        throw new Error('Credenciales inválidas o usuario inactivo');
    }

    const userData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as User;

    if (!userData.activo) {
        throw new Error('El usuario está inactivo. Contacte al administrador.');
    }

    useAuthStore.getState().setUser(userData);
    return { success: true, user: userData };
};

export const logout = () => {
    useAuthStore.getState().setUser(null);
};

export const initAuthListener = () => {
    const savedUser = localStorage.getItem(STORAGE_KEY);
    if (savedUser) {
        try {
            useAuthStore.getState().setUser(JSON.parse(savedUser));
        } catch (e) {
            localStorage.removeItem(STORAGE_KEY);
            useAuthStore.getState().setUser(null);
        }
    } else {
        useAuthStore.getState().setLoading(false);
    }
};
