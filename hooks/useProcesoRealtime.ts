"use client";

import { useEffect, useState } from 'react';
import {
    getProcesoById,
    subscribeColaboradoresLog,
    subscribeEventosLog,
    updateProceso
} from '@/lib/firebase-db';
import { Proceso, ColaboradorLog, EventoLog } from '@/types';
import { onSnapshot, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function useProcesoRealtime(id: string) {
    const [proceso, setProceso] = useState<Proceso | null>(null);
    const [colaboradores, setColaboradores] = useState<ColaboradorLog[]>([]);
    const [eventos, setEventos] = useState<EventoLog[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;

        // Suscripción al Proceso
        const unsubProceso = onSnapshot(doc(db, 'procesos', id), (doc) => {
            if (doc.exists()) {
                setProceso({ id: doc.id, ...doc.data() } as Proceso);
            }
            setLoading(false);
        });

        // Suscripción a Colaboradores
        const unsubColabs = subscribeColaboradoresLog(id, (logs) => {
            setColaboradores(logs);
        });

        // Suscripción a Eventos
        const unsubEventos = subscribeEventosLog(id, (evs) => {
            setEventos(evs);
        });

        return () => {
            unsubProceso();
            unsubColabs();
            unsubEventos();
        };
    }, [id]);

    return { proceso, colaboradores, eventos, loading };
}
