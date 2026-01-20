import { create } from 'zustand';
import { User, Proceso } from '@/types';

interface AppState {
    user: User | null;
    activeProceso: Proceso | null;
    setUser: (user: User | null) => void;
    setActiveProceso: (proceso: Proceso | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
    user: null,
    activeProceso: null,
    setUser: (user) => set({ user }),
    setActiveProceso: (proceso) => set({ activeProceso: proceso }),
}));
