"use client";

import { useEffect, useState } from 'react';
import { subscribeProcesos } from '@/lib/firebase-db';
import { Proceso } from '@/types';

export function useProcesos() {
    const [procesos, setProcesos] = useState<Proceso[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = subscribeProcesos((data) => {
            setProcesos(data);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    return { procesos, loading };
}
