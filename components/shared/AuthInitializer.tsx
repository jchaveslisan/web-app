"use client";

import { useEffect } from 'react';
import { initAuthListener } from '@/lib/auth-service';

export default function AuthInitializer() {
    useEffect(() => {
        initAuthListener();
    }, []);

    return null;
}
