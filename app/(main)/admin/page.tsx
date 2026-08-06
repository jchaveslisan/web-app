"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays } from 'date-fns';
import {
    ArrowLeft,
    Users,
    Plus,
    Trash2,
    Edit2,
    Check,
    X,
    Pause,
    LogOut,
    Settings,
    Key,
    ClipboardList,
    FileText,
    RefreshCw,
    TrendingUp,
    Clock,
    BarChart3,
    MessageSquare,
    ShieldCheck,
    AlertTriangle,
    Package,
    Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/auth-service';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, query, orderBy, where, getDocs, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getComentariosByOP, deleteComentario, correctComentario } from '@/lib/firebase-db';
import ModalCorregirComentario from '@/components/proceso/ModalCorregirComentario';
import { ColaboradorMaestro, Justificacion, Etapa, User, UserRole, OrdenMaestra, MotivoCorreccion } from '@/types';
const formatDuration = (seconds: number) => {
    if (seconds < 0) return '0s';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h}h ${m}m ${s}s`;
};

const adminSections = [
    {
        group: "Control de Personal",
        color: "text-primary-blue bg-primary-blue/10 border-primary-blue/20",
        items: [
            { id: 'personal', title: 'Personal', desc: 'Registro, edición y control de operarios activos en planta.', icon: Users, theme: 'bg-primary-blue/10 border-primary-blue/20 text-primary-blue' },
            { id: 'historialColaborador', title: 'Horas Colaborador', desc: 'Auditoría de timecards, horas trabajadas y efectivas por persona.', icon: Clock, theme: 'bg-pink-400/10 border-pink-400/20 text-pink-400' },
            { id: 'usuarios', title: 'Usuarios del Sistema', desc: 'Gestión de cuentas con acceso administrativo y supervisión.', icon: Key, theme: 'bg-indigo-400/10 border-indigo-400/20 text-indigo-400' },
        ]
    },
    {
        group: "Configuración y Maestros",
        color: "text-accent-purple bg-accent-purple/10 border-accent-purple/20",
        items: [
            { id: 'etapas', title: 'Etapas de Proceso', desc: 'Configuración de etapas operativas, flujos y clasificaciones.', icon: ClipboardList, theme: 'bg-purple-400/10 border-purple-400/20 text-purple-400' },
            { id: 'ordenes', title: 'Órdenes de Producción', desc: 'Importación y parametrización de OPs activas.', icon: Package, theme: 'bg-cyan-400/10 border-cyan-400/20 text-cyan-400' },
            { id: 'articulos', title: 'Maestro de Artículos', desc: 'Velocidades teóricas y descripción de códigos de productos.', icon: Package, theme: 'bg-emerald-400/10 border-emerald-400/20 text-emerald-400' },
            { id: 'pausa', title: 'Motivos de Pausa', desc: 'Justificaciones predefinidas para detenciones de línea.', icon: Pause, theme: 'bg-yellow-400/10 border-yellow-400/20 text-yellow-400' },
            { id: 'salida', title: 'Motivos de Salida', desc: 'Justificaciones para retiros anticipados del personal.', icon: LogOut, theme: 'bg-orange-400/10 border-orange-400/20 text-orange-400' },
            { id: 'motivosCorreccion', title: 'Motivos de Corrección', desc: 'Parametrización de motivos de cambios bajo ALCOA.', icon: Settings, theme: 'bg-rose-400/10 border-rose-400/20 text-rose-400' },
        ]
    },
    {
        group: "Reportes e Indicadores",
        color: "text-success-green bg-success-green/10 border-success-green/20",
        items: [
            { id: 'resumen', title: 'Resumen de Producción', desc: 'Tiempos, eficiencias y auditorías específicas por OP.', icon: BarChart3, theme: 'bg-primary-blue/10 border-primary-blue/20 text-primary-blue' },
            { id: 'reporteFechas', title: 'Reporte de Planta', desc: 'Consolidado general de volumen y tiempos en rangos de fechas.', icon: TrendingUp, theme: 'bg-purple-400/10 border-purple-400/20 text-purple-400' },
            { id: 'compararArticulos', title: 'Comparar Artículos', desc: 'Análisis comparativo de rendimiento entre corridas del mismo producto.', icon: Activity, theme: 'bg-amber-400/10 border-amber-400/20 text-amber-400' },
            { id: 'reportes', title: 'Reportes PDF OP', desc: 'Generación de reportes detallados en PDF por orden de producción.', icon: FileText, theme: 'bg-red-400/10 border-red-400/20 text-red-400' },
        ]
    }
];

export default function AdminPage() {
    const [tab, setTab] = useState<'hub' | 'personal' | 'pausa' | 'salida' | 'etapas' | 'usuarios' | 'ordenes' | 'reportes' | 'resumen' | 'articulos' | 'reporteFechas' | 'motivosCorreccion' | 'compararArticulos' | 'historialColaborador'>('hub');
    
    // Date Range Report States
    const [reportStartDate, setReportStartDate] = useState('');
    const [reportEndDate, setReportEndDate] = useState('');
    const [isGeneratingRangeReport, setIsGeneratingRangeReport] = useState(false);
    const [rangeReportData, setRangeReportData] = useState<{
        processes: any[];
        logs: any[];
        events: any[];
        comments: any[];
    } | null>(null);
    const [expandedOPs, setExpandedOPs] = useState<Record<string, boolean>>({});

    const [colaboradores, setColaboradores] = useState<ColaboradorMaestro[]>([]);
    const [newCedula, setNewCedula] = useState('');

    // Articulos Form states
    const [articulos, setArticulos] = useState<any[]>([]);
    const [newArticuloCodigo, setNewArticuloCodigo] = useState('');
    const [newArticuloDescripcion, setNewArticuloDescripcion] = useState('');
    const [newArticuloVelocidad, setNewArticuloVelocidad] = useState(0);
    const [newArticuloLinea, setNewArticuloLinea] = useState<'Humano' | 'Veterinario'>('Humano');
    const [justificacionesPausa, setJustificacionesPausa] = useState<Justificacion[]>([]);
    const [justificacionesSalida, setJustificacionesSalida] = useState<Justificacion[]>([]);
    const [etapas, setEtapas] = useState<Etapa[]>([]);
    const [usuarios, setUsuarios] = useState<User[]>([]);
    const [ordenes, setOrdenes] = useState<OrdenMaestra[]>([]);
    const [allProcesos, setAllProcesos] = useState<any[]>([]);
    const [selectedRepoOP, setSelectedRepoOP] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [loading, setLoading] = useState(true);
    const [selectedResumenOP, setSelectedResumenOP] = useState('');
    const [resumenComentarios, setResumenComentarios] = useState<any[]>([]);
    const [resumenLogs, setResumenLogs] = useState<any[]>([]);
    const [resumenEvents, setResumenEvents] = useState<any[]>([]);
    const [loadingResumenDetails, setLoadingResumenDetails] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [newNombre, setNewNombre] = useState('');
    const [newID, setNewID] = useState('');
    const [newJustificacion, setNewJustificacion] = useState('');
    const [newEtapaCodigo, setNewEtapaCodigo] = useState('');
    const [newEtapaNombre, setNewEtapaNombre] = useState('');
    const [newEtapaTipos, setNewEtapaTipos] = useState<string[]>(['empaque', 'otros', 'anexos']);
    const [editingItem, setEditingItem] = useState<{ id: string, type: string, data: any } | null>(null);
    const [correctionModal, setCorrectionModal] = useState<{ show: boolean; comentario: any } | null>(null);
    const [motivosCorreccion, setMotivosCorreccion] = useState<MotivoCorreccion[]>([]);
    const [newMotivoCorreccionTexto, setNewMotivoCorreccionTexto] = useState('');
    
    // New states for Comparar Artículos & Horas Colaborador
    const [selectedArticulo, setSelectedArticulo] = useState('');
    const [colaboradorReportId, setColaboradorReportId] = useState('');
    const [colaboradorReportStartDate, setColaboradorReportStartDate] = useState('');
    const [colaboradorReportEndDate, setColaboradorReportEndDate] = useState('');
    const [colaboradorReportLoading, setColaboradorReportLoading] = useState(false);
    const [colaboradorReportData, setColaboradorReportData] = useState<any>(null);
    const [comparacionData, setComparacionData] = useState<any[]>([]);
    const [loadingComparacion, setLoadingComparacion] = useState(false);

    const router = useRouter();

    // Form states for adding
    const [newUsername, setNewUsername] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newRole, setNewRole] = useState<UserRole>('usuario');
    const [newMensajeEntrada, setNewMensajeEntrada] = useState('');
    const [newMensajeSalida, setNewMensajeSalida] = useState('');

    // Ordenes Maestras Form
    const [newOrderOP, setNewOrderOP] = useState('');
    const [newOrderProduct, setNewOrderProduct] = useState('');
    const [newOrderLote, setNewOrderLote] = useState('');
    const [newOrderEtapa, setNewOrderEtapa] = useState('');
    const [newOrderCantidad, setNewOrderCantidad] = useState(0);
    const [newOrderVelocidad, setNewOrderVelocidad] = useState(0);
    const [newOrderArticulo, setNewOrderArticulo] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);

    // For editing
    const [editValue, setEditValue] = useState<any>({});
    const [regeneratedPinInfo, setRegeneratedPinInfo] = useState<{ nombre: string; pin: string } | null>(null);

    const user = useAuthStore(state => state.user);

    // Protección de ruta admistrativa - Solo Superadmin
    useEffect(() => {
        if (!loading && (!user || !['superadmin', 'supervisor'].includes(user.rol))) {
            router.push('/procesos');
        }
    }, [user, loading, router]);

    // Cargar colaboradores
    useEffect(() => {
        const q = query(collection(db, 'maestro_colaboradores'), orderBy('nombreCompleto', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ColaboradorMaestro));
            setColaboradores(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Cargar motivos de corrección
    useEffect(() => {
        const q = query(collection(db, 'maestro_motivos_correccion'), orderBy('texto', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MotivoCorreccion));
            setMotivosCorreccion(data);
        });
        return () => unsubscribe();
    }, []);

    // Cargar justificaciones de pausa
    useEffect(() => {
        const q = query(collection(db, 'maestro_justificaciones'), orderBy('tipo', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const pausa = snapshot.docs
                .filter(d => d.data().tipo === 'pausa')
                .map(doc => ({ id: doc.id, ...doc.data() } as Justificacion));
            setJustificacionesPausa(pausa);

            const salida = snapshot.docs
                .filter(d => d.data().tipo === 'salida')
                .map(doc => ({ id: doc.id, ...doc.data() } as Justificacion));
            setJustificacionesSalida(salida);
        });
        return () => unsubscribe();
    }, []);

    // Cargar etapas
    useEffect(() => {
        const q = query(collection(db, 'maestro_etapas'), orderBy('codigo', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Etapa));
            setEtapas(data);
        });
        return () => unsubscribe();
    }, []);

    // Cargar usuarios
    useEffect(() => {
        const q = query(collection(db, 'usuarios'), orderBy('username', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
            setUsuarios(data);
        });
        return () => unsubscribe();
    }, []);

    // Cargar Ordenes Maestras
    useEffect(() => {
        const q = query(collection(db, 'maestro_ordenes'), orderBy('op', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as OrdenMaestra))
                .filter(o => o.activo);
            setOrdenes(data);
        });
        return () => unsubscribe();
    }, []);

    // Cargar Artículos
    useEffect(() => {
        const q = query(collection(db, 'maestro_articulos'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            data.sort((a: any, b: any) => (a.descripcion || '').localeCompare(b.descripcion || ''));
            setArticulos(data);
        });
        return () => unsubscribe();
    }, []);

    const handleAddOrder = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newOrderOP || !newOrderProduct) return;
        try {
            await addDoc(collection(db, 'maestro_ordenes'), {
                op: newOrderOP.toUpperCase(),
                producto: newOrderProduct,
                lote: newOrderLote,
                etapa: newOrderEtapa,
                cantidad: newOrderCantidad,
                velocidadTeorica: newOrderVelocidad,
                articulo: newOrderArticulo.trim().toUpperCase(),
                activo: true
            });
            setNewOrderOP('');
            setNewOrderProduct('');
            setNewOrderLote('');
            setNewOrderEtapa('');
            setNewOrderCantidad(0);
            setNewOrderVelocidad(0);
            setNewOrderArticulo('');
            setShowForm(false);
        } catch (error) {
            console.error(error);
        }
    };

    const handleSetPeriod = (period: 'hoy' | 'semana' | 'mes') => {
        const now = new Date();
        if (period === 'hoy') {
            const todayStr = format(now, 'yyyy-MM-dd');
            setColaboradorReportStartDate(todayStr);
            setColaboradorReportEndDate(todayStr);
        } else if (period === 'semana') {
            const monday = startOfWeek(now, { weekStartsOn: 1 });
            const sunday = endOfWeek(now, { weekStartsOn: 1 });
            setColaboradorReportStartDate(format(monday, 'yyyy-MM-dd'));
            setColaboradorReportEndDate(format(sunday, 'yyyy-MM-dd'));
        } else if (period === 'mes') {
            const firstDay = startOfMonth(now);
            const lastDay = endOfMonth(now);
            setColaboradorReportStartDate(format(firstDay, 'yyyy-MM-dd'));
            setColaboradorReportEndDate(format(lastDay, 'yyyy-MM-dd'));
        }
        setColaboradorReportData(null);
    };

    const handleGenerateColaboradorReport = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!colaboradorReportId || !colaboradorReportStartDate || !colaboradorReportEndDate) {
            alert('Por favor seleccione colaborador y rango de fechas');
            return;
        }
        setColaboradorReportLoading(true);
        setColaboradorReportData(null);
        try {
            const dayStart = new Date(colaboradorReportStartDate + 'T00:00:00');
            const dayEnd = new Date(colaboradorReportEndDate + 'T23:59:59');
            const dayStartMs = dayStart.getTime();
            const dayEndMs = dayEnd.getTime();

            const q = query(
                collection(db, 'colaboradores_log'),
                where('colaboradorId', '==', colaboradorReportId)
            );
            const snapshot = await getDocs(q);
            const rawLogs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));

            // Query events log in this date range to fetch historical check-out motives
            const eventsQ = query(
                collection(db, 'eventos_log'),
                where('horaEvento', '>=', dayStart),
                where('horaEvento', '<=', dayEnd)
            );
            const eventsSnapshot = await getDocs(eventsQ);
            const periodEvents = eventsSnapshot.docs.map(doc => doc.data() as any);

            const dayLogs = rawLogs.filter(log => {
                const entry = log.horaIngreso?.toMillis?.() || log.horaIngreso?.seconds * 1000 || 0;
                const exit = log.horaSalida?.toMillis?.() || log.horaSalida?.seconds * 1000 || Date.now();
                return entry < dayEndMs && exit > dayStartMs;
            });

            if (dayLogs.length === 0) {
                setColaboradorReportData({
                    colaboradorNombre: colaboradores.find(c => c.id === colaboradorReportId)?.nombreCompleto || 'Colaborador',
                    totalSeconds: 0,
                    effectiveSeconds: 0,
                    breakdown: []
                });
                return;
            }

            const processIds = Array.from(new Set(dayLogs.map(l => l.procesoId)));
            const processesMap: Record<string, any> = {};
            const eventsMap: Record<string, any[]> = {};

            await Promise.all(processIds.map(async (pId) => {
                const pDoc = await getDoc(doc(db, 'procesos', pId));
                if (pDoc.exists()) {
                    processesMap[pId] = { id: pDoc.id, ...pDoc.data() };
                }

                const evtsQ = query(
                    collection(db, 'eventos'),
                    where('procesoId', '==', pId)
                );
                const evtsSnapshot = await getDocs(evtsQ);
                eventsMap[pId] = evtsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            }));

            let totalSeconds = 0;
            let effectiveSeconds = 0;
            const breakdown: any[] = [];

            dayLogs.forEach(log => {
                const process = processesMap[log.procesoId];
                if (!process) return;

                const logStart = log.horaIngreso?.toMillis?.() || log.horaIngreso?.seconds * 1000 || 0;
                const logEnd = log.horaSalida?.toMillis?.() || log.horaSalida?.seconds * 1000 || (process.estado === 'Iniciado' ? Date.now() : (process.horaFinReal?.toMillis?.() || process.horaFinReal?.seconds * 1000 || Date.now()));

                const overlapStart = Math.max(logStart, dayStartMs);
                const overlapEnd = Math.min(logEnd, dayEndMs);

                if (overlapEnd <= overlapStart) return;

                const logTotalDuration = Math.floor((overlapEnd - overlapStart) / 1000);
                totalSeconds += logTotalDuration;

                const runningIntervals: { start: number; end: number }[] = [];
                const pStart = process.horaInicioReal?.toMillis?.() || process.horaInicioReal?.seconds * 1000 || 0;
                if (pStart > 0) {
                    let currentStart = pStart;
                    const pEvents = eventsMap[log.procesoId] || [];
                    const sortedEvents = [...pEvents].sort((a, b) => {
                        const timeA = a.horaEvento?.toMillis?.() || a.horaEvento?.seconds * 1000 || 0;
                        const timeB = b.horaEvento?.toMillis?.() || b.horaEvento?.seconds * 1000 || 0;
                        return timeA - timeB;
                    });

                    sortedEvents.forEach(evt => {
                        const eventText = (evt.evento || "").toUpperCase();
                        const timeMs = evt.horaEvento?.toMillis?.() || evt.horaEvento?.seconds * 1000 || 0;
                        
                        if (eventText.includes('PAUSA')) {
                            if (currentStart > 0 && timeMs > currentStart) {
                                runningIntervals.push({ start: currentStart, end: timeMs });
                                currentStart = 0;
                            }
                        } else if (eventText.includes('REANUDA')) {
                            if (currentStart === 0) {
                                currentStart = timeMs;
                            }
                        }
                    });

                    if (currentStart > 0) {
                        const pEnd = process.horaFinReal?.toMillis?.() || process.horaFinReal?.seconds * 1000 || Date.now();
                        if (pEnd > currentStart) {
                            runningIntervals.push({ start: currentStart, end: pEnd });
                        }
                    }
                }

                let logEffectiveDuration = 0;
                runningIntervals.forEach(interval => {
                    const tripleOverlapStart = Math.max(overlapStart, interval.start);
                    const tripleOverlapEnd = Math.min(overlapEnd, interval.end);
                    if (tripleOverlapEnd > tripleOverlapStart) {
                        logEffectiveDuration += Math.floor((tripleOverlapEnd - tripleOverlapStart) / 1000);
                    }
                });

                effectiveSeconds += logEffectiveDuration;

                breakdown.push({
                    id: log.id,
                    op: process.ordenProduccion,
                    etapa: process.etapa,
                    producto: process.producto,
                    tipo: log.tipo || 'colaborador',
                    entry: new Date(overlapStart),
                    exit: log.horaSalida ? new Date(overlapEnd) : null,
                    totalDuration: logTotalDuration,
                    effectiveDuration: logEffectiveDuration,
                    estadoProceso: process.estado
                });
            });

            // Group and calculate linear presence and gaps per day
            let totalPermanenceSeconds = 0;
            let totalInactiveSeconds = 0;
            const inactiveGaps: any[] = [];

            // 1. Get list of distinct dates in the query range
            const datesList: string[] = [];
            let currentCursor = new Date(colaboradorReportStartDate + 'T00:00:00');
            const endCursor = new Date(colaboradorReportEndDate + 'T23:59:59');
            while (currentCursor <= endCursor) {
                datesList.push(format(currentCursor, 'yyyy-MM-dd'));
                currentCursor = addDays(currentCursor, 1);
            }

            // 2. For each day, find active intervals and compute gaps
            datesList.forEach(dStr => {
                const tS = new Date(dStr + 'T00:00:00').getTime();
                const tE = new Date(dStr + 'T23:59:59').getTime();

                // Get logs overlapping this day
                const dayLogsForGaps = dayLogs.filter(log => {
                    const entry = log.horaIngreso?.toMillis?.() || log.horaIngreso?.seconds * 1000 || 0;
                    const exit = log.horaSalida?.toMillis?.() || log.horaSalida?.seconds * 1000 || Date.now();
                    return entry < tE && exit > tS;
                });

                if (dayLogsForGaps.length === 0) return;

                // Map to intervals clamped to [tS, tE]
                const intervals = dayLogsForGaps.map(log => {
                    const entry = log.horaIngreso?.toMillis?.() || log.horaIngreso?.seconds * 1000 || 0;
                    const exit = log.horaSalida?.toMillis?.() || log.horaSalida?.seconds * 1000 || Date.now();
                    return {
                        start: Math.max(entry, tS),
                        end: Math.min(exit, tE)
                    };
                });

                // Sort intervals by start ascending
                intervals.sort((a, b) => a.start - b.start);

                // Merge overlapping intervals
                const merged: { start: number; end: number }[] = [];
                intervals.forEach(curr => {
                    if (merged.length === 0) {
                        merged.push(curr);
                    } else {
                        const last = merged[merged.length - 1];
                        if (curr.start <= last.end) {
                            last.end = Math.max(last.end, curr.end);
                        } else {
                            merged.push(curr);
                        }
                    }
                });

                if (merged.length > 0) {
                    const earliestStart = merged[0].start;
                    const latestEnd = merged[merged.length - 1].end;
                    const presenceDuration = latestEnd - earliestStart;
                    totalPermanenceSeconds += Math.floor(presenceDuration / 1000);

                    // Check gaps between merged intervals
                    for (let i = 0; i < merged.length - 1; i++) {
                        const gapStart = merged[i].end;
                        const gapEnd = merged[i + 1].start;
                        const gapDuration = gapEnd - gapStart;
                        if (gapDuration >= 5000) { // Gaps longer than 5 seconds
                            const gapSecs = Math.floor(gapDuration / 1000);
                            totalInactiveSeconds += gapSecs;

                            // Find the log that ended at gapStart (or close to it)
                            const endingLog = dayLogsForGaps.find(log => {
                                const exit = log.horaSalida?.toMillis?.() || log.horaSalida?.seconds * 1000 || Date.now();
                                return Math.abs(exit - gapStart) < 2000;
                            });

                             // Try to find a matching exit/completion event in Firestore events log
                             const colabNombre = colaboradores.find(c => c.id === colaboradorReportId)?.nombreCompleto || '';
                             const cleanText = (str: string) => 
                                 (str || "").normalize("NFD")
                                           .replace(/[\u0300-\u036f]/g, "")
                                           .toLowerCase();

                             const cleanColabName = cleanText(colabNombre);
                             const cleanColabId = cleanText(colaboradorReportId);

                             // Find all matching events of the day
                             const candidateEvents = periodEvents.filter(evt => {
                                 const eventText = (evt.evento || "").toUpperCase();
                                 const just = (evt.justificacion || "");

                                 if (eventText.includes("SALIDA DE PERSONAL")) {
                                     const cleanJust = cleanText(just);
                                     return cleanJust.includes(cleanColabName) || cleanJust.includes(cleanColabId);
                                 }
                                 if (eventText.includes("SETUP FINALIZADO") || eventText.includes("PROCESO FINALIZADO")) {
                                     return evt.procesoId === endingLog?.procesoId;
                                 }
                                 return false;
                             });

                             // Find the candidate event closest to gapStart
                             let matchingEvent: any = null;
                             let minTimeDiff = Infinity;

                             candidateEvents.forEach(evt => {
                                 const evtTime = evt.horaEvento?.toMillis?.() || evt.horaEvento?.seconds * 1000 || 0;
                                 const timeDiff = Math.abs(evtTime - gapStart);
                                 if (timeDiff < minTimeDiff && timeDiff <= 120000) { // within 2 minutes
                                     minTimeDiff = timeDiff;
                                     matchingEvent = evt;
                                 }
                             });

                             let reason = endingLog?.justificacionSalida || "";

                             if (matchingEvent) {
                                 const eventText = (matchingEvent.evento || "").toUpperCase();
                                 if (eventText.includes("SALIDA DE PERSONAL")) {
                                     let motiveText = matchingEvent.justificacion || "";
                                     if (motiveText.includes(":")) {
                                         motiveText = motiveText.split(":").slice(1).join(":").trim();
                                     }
                                     reason = motiveText;
                                 } else if (eventText.includes("SETUP FINALIZADO")) {
                                     reason = "Finalización de Setup";
                                 } else if (eventText.includes("PROCESO FINALIZADO")) {
                                     reason = "Finalización de Proceso";
                                 }
                             }

                             if (!reason) {
                                 reason = "Salida Registrada / Fin de turno";
                             }

                            inactiveGaps.push({
                                id: `${dStr}-${gapStart}`,
                                fecha: format(new Date(tS), 'dd/MM/yyyy'),
                                inicio: gapStart,
                                fin: gapEnd,
                                duracion: gapSecs,
                                motivo: reason
                            });
                        }
                    }
                }
            });

            setColaboradorReportData({
                colaboradorNombre: colaboradores.find(c => c.id === colaboradorReportId)?.nombreCompleto || 'Colaborador',
                totalSeconds,
                effectiveSeconds,
                totalPermanenceSeconds,
                totalInactiveSeconds,
                inactiveGaps,
                breakdown
            });
        } catch (error) {
            console.error('Error generating report:', error);
            alert('Error al generar el reporte del colaborador');
        } finally {
            setColaboradorReportLoading(false);
        }
    };

    useEffect(() => {
        if (tab !== 'compararArticulos' || !selectedArticulo) {
            setComparacionData([]);
            return;
        }

        const loadComparacionData = async () => {
            setLoadingComparacion(true);
            try {
                const filteredProcs = allProcesos.filter(p => p.articulo === selectedArticulo);
                if (filteredProcs.length === 0) {
                    setComparacionData([]);
                    return;
                }

                const procIds = filteredProcs.map(p => p.id);
                const processesWithTimes = await Promise.all(filteredProcs.map(async (p) => {
                    const logsQ = query(collection(db, 'colaboradores_log'), where('procesoId', '==', p.id));
                    const logsSnapshot = await getDocs(logsQ);
                    const pLogs = logsSnapshot.docs.map(doc => doc.data());

                    const evtsQ = query(collection(db, 'eventos'), where('procesoId', '==', p.id));
                    const evtsSnapshot = await getDocs(evtsQ);
                    const pEvents = evtsSnapshot.docs.map(doc => doc.data());

                    let procPauseSeconds = 0;
                    let procPauseStart: number | null = null;
                    const sortedEvents = [...pEvents].sort((a, b) => {
                        const timeA = a.horaEvento?.toMillis?.() || a.horaEvento?.seconds * 1000 || 0;
                        const timeB = b.horaEvento?.toMillis?.() || b.horaEvento?.seconds * 1000 || 0;
                        return timeA - timeB;
                    });
                    
                    sortedEvents.forEach(evt => {
                        const eventText = (evt.evento || "").toUpperCase();
                        const timeMs = evt.horaEvento?.toMillis?.() || evt.horaEvento?.seconds * 1000 || 0;
                        if (eventText.includes('PAUSA')) {
                            procPauseStart = timeMs;
                        } else if (eventText.includes('REANUDA') && procPauseStart) {
                            procPauseSeconds += Math.floor((timeMs - procPauseStart) / 1000);
                            procPauseStart = null;
                        }
                    });
                    if (procPauseStart && p.estado === 'Pausado') {
                        procPauseSeconds += Math.floor((Date.now() - procPauseStart) / 1000);
                    }

                    const qCall = p.calidadLlamadaEn?.toMillis?.() || p.calidadLlamadaEn?.seconds * 1000 || 0;
                    const qArrival = p.calidadLlegadaEn?.toMillis?.() || p.calidadLlegadaEn?.seconds * 1000 || 0;
                    const qApproval = p.calidadAprobadaEn?.toMillis?.() || p.calidadAprobadaEn?.seconds * 1000 || 0;
                    
                    let procQualityWaiting = 0;
                    let procQualityInspection = 0;
                    if (qCall > 0 && qArrival > 0) procQualityWaiting = Math.floor((qArrival - qCall) / 1000);
                    else if (qCall > 0 && p.calidadEstado === 'esperando') procQualityWaiting = Math.floor((Date.now() - qCall) / 1000);
                    
                    if (qArrival > 0 && qApproval > 0) procQualityInspection = Math.floor((qApproval - qArrival) / 1000);
                    else if (qArrival > 0 && p.calidadEstado === 'inspeccion') procQualityInspection = Math.floor((Date.now() - qArrival) / 1000);

                    const runningIntervals: { start: number; end: number }[] = [];
                    const pStart = p.horaInicioReal?.toMillis?.() || p.horaInicioReal?.seconds * 1000 || 0;
                    if (pStart > 0) {
                        let currentStart = pStart;
                        sortedEvents.forEach(evt => {
                            const eventText = (evt.evento || "").toUpperCase();
                            const timeMs = evt.horaEvento?.toMillis?.() || evt.horaEvento?.seconds * 1000 || 0;
                            if (eventText.includes('PAUSA')) {
                                if (currentStart > 0 && timeMs > currentStart) {
                                    runningIntervals.push({ start: currentStart, end: timeMs });
                                    currentStart = 0;
                                }
                            } else if (eventText.includes('REANUDA')) {
                                if (currentStart === 0) {
                                    currentStart = timeMs;
                                }
                            }
                        });
                        if (currentStart > 0) {
                            const pEnd = p.horaFinReal?.toMillis?.() || p.horaFinReal?.seconds * 1000 || Date.now();
                            if (pEnd > currentStart) {
                                runningIntervals.push({ start: currentStart, end: pEnd });
                            }
                        }
                    }

                    const effectiveProcessSeconds = runningIntervals.reduce((sum, interval) => sum + Math.floor((interval.end - interval.start) / 1000), 0);

                    let effectiveHHSeconds = 0;
                    pLogs.forEach(log => {
                        const logStart = log.horaIngreso?.toMillis?.() || log.horaIngreso?.seconds * 1000 || 0;
                        const logEnd = log.horaSalida?.toMillis?.() || log.horaSalida?.seconds * 1000 || (p.estado === 'Iniciado' ? Date.now() : (p.horaFinReal?.toMillis?.() || p.horaFinReal?.seconds * 1000 || Date.now()));

                        if (logStart > 0 && logEnd > logStart) {
                            runningIntervals.forEach(interval => {
                                const overlapStart = Math.max(logStart, interval.start);
                                const overlapEnd = Math.min(logEnd, interval.end);
                                if (overlapEnd > overlapStart) {
                                    effectiveHHSeconds += Math.floor((overlapEnd - overlapStart) / 1000);
                                }
                            });
                        }
                    });

                    return {
                        ...p,
                        procPauseSeconds,
                        procQualityWaiting,
                        procQualityInspection,
                        effectiveProcessSeconds,
                        effectiveHHSeconds
                    };
                }));

                processesWithTimes.sort((a, b) => {
                    const timeA = a.creadoEn?.toMillis?.() || a.creadoEn?.seconds * 1000 || 0;
                    const timeB = b.creadoEn?.toMillis?.() || b.creadoEn?.seconds * 1000 || 0;
                    return timeB - timeA;
                });

                setComparacionData(processesWithTimes);
            } catch (error) {
                console.error('Error loading comparison data:', error);
            } finally {
                setLoadingComparacion(false);
            }
        };

        loadComparacionData();
    }, [selectedArticulo, tab, allProcesos]);

    const handleSyncAppSheet = async () => {
        setIsSyncing(true);
        try {
            const response = await fetch('/api/appsheet/sync', { method: 'POST' });
            const result = await response.json();

            if (result.success) {
                alert(`Sincronización completada:\n` +
                    `- ${result.imported} nuevas órdenes importadas.\n` +
                    `- ${result.alreadyExists} ya existían en la plataforma.\n` +
                    `- ${result.oldYears} omitidas por ser años anteriores (<2026).\n\n` +
                    `Total de filas analizadas en AppSheet: ${result.totalFound}`);
            } else {
                alert(`Error: ${result.error || 'No se pudo sincronizar'}`);
            }
        } catch (error) {
            console.error('Sync error:', error);
            alert('Error de conexión con el servidor');
        } finally {
            setIsSyncing(false);
        }
    };

    // Cargar todos los procesos para reportes
    useEffect(() => {
        const q = query(collection(db, 'procesos'), orderBy('creadoEn', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setAllProcesos(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsubscribe();
    }, []);

    // Suscribirse a comentarios de la OP seleccionada para resumen
    useEffect(() => {
        if (!selectedResumenOP) {
            setResumenComentarios([]);
            return;
        }
        const q = query(
            collection(db, 'comentarios'),
            where('ordenProduccion', '==', selectedResumenOP)
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const coms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
            coms.sort((a, b) => {
                const timeA = a.creadoEn?.toMillis?.() || a.creadoEn?.seconds * 1000 || 0;
                const timeB = b.creadoEn?.toMillis?.() || b.creadoEn?.seconds * 1000 || 0;
                return timeA - timeB;
            });
            setResumenComentarios(coms);
        });
        return () => unsubscribe();
    }, [selectedResumenOP]);

    // Cargar logs y eventos en cascada de la OP seleccionada para resumen
    useEffect(() => {
        if (!selectedResumenOP) {
            setResumenLogs([]);
            setResumenEvents([]);
            return;
        }

        const fetchDetails = async () => {
            setLoadingResumenDetails(true);
            try {
                const procesosOP = allProcesos.filter(p => p.ordenProduccion === selectedResumenOP);
                const allLogs: any[] = [];
                const allEvents: any[] = [];

                for (const proceso of procesosOP) {
                    const qLogs = query(collection(db, 'colaboradores_log'), where('procesoId', '==', proceso.id));
                    const snapLogs = await getDocs(qLogs);
                    const logs = snapLogs.docs.map(d => ({ id: d.id, ...d.data(), etapa: proceso.etapa }));
                    allLogs.push(...logs);

                    const qEvents = query(collection(db, 'eventos_log'), where('procesoId', '==', proceso.id));
                    const snapEvents = await getDocs(qEvents);
                    const events = snapEvents.docs.map(d => ({ id: d.id, ...d.data(), etapa: proceso.etapa }));
                    allEvents.push(...events);
                }

                setResumenLogs(allLogs);
                setResumenEvents(allEvents);
            } catch (err) {
                console.error("Error al cargar detalles de resumen:", err);
            } finally {
                setLoadingResumenDetails(false);
            }
        };

        fetchDetails();
    }, [selectedResumenOP, allProcesos]);

    const generatePDF = async () => {
        if (!selectedRepoOP) return;
        setIsGenerating(true);
        try {
            const procesosOP = allProcesos.filter(p => p.ordenProduccion === selectedRepoOP);
            if (procesosOP.length === 0) {
                alert("No hay procesos registrados para esta OP");
                return;
            }

            const doc = new jsPDF();
            const formatDuration = (seconds: number) => {
                const h = Math.floor(seconds / 3600);
                const m = Math.floor((seconds % 3600) / 60);
                const s = Math.floor(seconds % 60);
                return `${h}h ${m}m ${s}s`;
            };

            // 1. RECOLECCIÓN DE DATOS COMPLETA
            const allLogs: any[] = [];
            const allEvents: any[] = [];
            const collaboratorTime: Record<string, number> = {};
            let totalPauseDuration = 0;
            let startTimes: number[] = [];
            let endTimes: number[] = [];

            for (const proceso of procesosOP) {
                if (proceso.horaInicioReal) startTimes.push(proceso.horaInicioReal.toMillis());
                if (proceso.horaFinReal) endTimes.push(proceso.horaFinReal.toMillis());

                const qLogs = query(collection(db, 'colaboradores_log'), where('procesoId', '==', proceso.id));
                const snapLogs = await getDocs(qLogs);
                const logs = snapLogs.docs.map(d => ({ ...d.data(), etapa: proceso.etapa }));
                allLogs.push(...logs);

                const qEvents = query(collection(db, 'eventos_log'), where('procesoId', '==', proceso.id));
                const snapEvents = await getDocs(qEvents);
                const events = snapEvents.docs.map(d => ({ ...d.data(), etapa: proceso.etapa }));
                allEvents.push(...events);

                // Calcular tiempo por colaborador en esta etapa
                logs.forEach((log: any) => {
                    const entry = log.horaIngreso?.toDate();
                    const exit = log.horaSalida?.toDate();
                    if (entry && exit) {
                        const duration = Math.floor((exit.getTime() - entry.getTime()) / 1000);
                        collaboratorTime[log.nombre || (log as any).nombreColaborador] = (collaboratorTime[log.nombre || (log as any).nombreColaborador] || 0) + duration;
                    }
                });
            }

            // Helper para obtener milisegundos de un Timestamp de forma segura
            const getMs = (ts: any) => {
                if (!ts) return 0;
                if (typeof ts.toMillis === 'function') return ts.toMillis();
                if (ts.seconds !== undefined) return ts.seconds * 1000 + (ts.nanoseconds || 0) / 1000000;
                return 0;
            };

            // Calcular pausas desde los eventos para el resumen ejecutivo
            const sortedEvents = allEvents.sort((a, b) => getMs(a.horaEvento) - getMs(b.horaEvento));
            let pauseStart: number | null = null;
            sortedEvents.forEach(evt => {
                const eventText = (evt.evento || "").toUpperCase();
                if (eventText.includes('PAUSA')) pauseStart = getMs(evt.horaEvento);
                if (eventText.includes('REANUDA') && pauseStart) {
                    totalPauseDuration += Math.floor((getMs(evt.horaEvento) - pauseStart) / 1000);
                    pauseStart = null;
                }
            });

            const minStart = startTimes.length ? Math.min(...startTimes) : 0;
            const maxEnd = endTimes.length ? Math.max(...endTimes) : Date.now();
            const totalProcessDuration = minStart && maxEnd ? Math.floor((maxEnd - minStart) / 1000) : 0;

            // --- RENDERIZADO PDF ---
            // Header
            doc.setFillColor(30, 41, 59);
            doc.rect(0, 0, 210, 45, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(24);
            doc.text('REPORTE INTEGRAL DE PRODUCCIÓN', 105, 22, { align: 'center' });
            doc.setFontSize(10);
            doc.text(`ORDEN DE PRODUCCIÓN: ${selectedRepoOP} | GENERADO: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 105, 34, { align: 'center' });

            // 2. RESUMEN GENERAL
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(14);
            doc.text('RESUMEN GENERAL', 20, 60);
            doc.line(20, 62, 190, 62);
            autoTable(doc, {
                startY: 65,
                body: [
                    ['PRODUCTO:', (procesosOP[0].producto || '').toUpperCase()],
                    ['LOTE:', (procesosOP[0].lote || '').toUpperCase()],
                    ['TIEMPO TOTAL DEL PROCESO:', formatDuration(totalProcessDuration)],
                    ['TIEMPO TOTAL DE PAUSAS:', formatDuration(totalPauseDuration)],
                    ['ETAPAS REGISTRADAS:', procesosOP.length.toString()],
                    ['LÍDER DE CUMPLIMIENTO:', procesosOP[0].lider || 'N/A']
                ],
                theme: 'plain',
                styles: { fontSize: 10 },
                columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } }
            });

            // 2.1 CATEGORIZACIÓN DE TIEMPOS
            const setupTotal = procesosOP.reduce((acc, p) => acc + (p.tiempoSetupSegundos || 0), 0);
            const reprocesoTotal = procesosOP.reduce((acc, p) => acc + (p.tiempoReprocesoSegundos || 0), 0);

            // Tiempos de Calidad
            let waitingQualitySecs = 0;
            let inspectionQualitySecs = 0;
            procesosOP.forEach(p => {
                const call = getMs(p.calidadLlamadaEn);
                const arrival = getMs(p.calidadLlegadaEn);
                const approval = getMs(p.calidadAprobadaEn);
                if (call > 0 && arrival > 0) waitingQualitySecs += (arrival - call) / 1000;
                if (arrival > 0 && approval > 0) inspectionQualitySecs += (approval - arrival) / 1000;
            });

            // Desglose de pausas por motivo
            const pauseDetails: Record<string, number> = {};
            let localPauseStart: { time: number, reason: string } | null = null;
            sortedEvents.forEach(evt => {
                const eventText = (evt.evento || "").toUpperCase();
                if (eventText.includes('PAUSA')) {
                    localPauseStart = {
                        time: getMs(evt.horaEvento),
                        reason: evt.justificacion || 'SIN ESPECIFICAR'
                    };
                }
                if (eventText.includes('REANUDA') && localPauseStart) {
                    const dur = (getMs(evt.horaEvento) - localPauseStart.time) / 1000;
                    pauseDetails[localPauseStart.reason] = (pauseDetails[localPauseStart.reason] || 0) + dur;
                    localPauseStart = null;
                }
            });

            doc.setFontSize(14);
            doc.text('ANÁLISIS DE TIEMPOS PRODUCTIVOS Y PAUSAS', 20, (doc as any).lastAutoTable.finalY + 15);
            autoTable(doc, {
                startY: (doc as any).lastAutoTable.finalY + 20,
                head: [['Categoría / Motivo', 'Duración Acumulada']],
                body: [
                    ['[PROD] TIEMPO TOTAL SETUP', formatDuration(setupTotal)],
                    ['[PROD] TIEMPO TOTAL REPROCESO', formatDuration(reprocesoTotal)],
                    ['[CALI] ESPERA POR CALIDAD', formatDuration(waitingQualitySecs)],
                    ['[CALI] INSPECCIÓN DE CALIDAD', formatDuration(inspectionQualitySecs)],
                    ...Object.entries(pauseDetails).map(([reason, time]) => [`[PAUSA] ${reason}`, formatDuration(time)])
                ],
                theme: 'striped',
                headStyles: { fillColor: [30, 41, 59] },
                styles: { fontSize: 9 }
            });

            // 3. RESUMEN COLABORADORES
            doc.setFontSize(14);
            doc.text('TIEMPO TOTAL POR COLABORADOR', 20, (doc as any).lastAutoTable.finalY + 15);
            autoTable(doc, {
                startY: (doc as any).lastAutoTable.finalY + 20,
                head: [['Colaborador', 'Tiempo Total Invertido']],
                body: Object.entries(collaboratorTime).sort((a, b) => b[1] - a[1]).map(([n, t]) => [n, formatDuration(t)]),
                theme: 'striped',
                headStyles: { fillColor: [51, 65, 85] }
            });

            // 4. DETALLE ETAPAS
            doc.addPage();
            doc.setFontSize(16);
            doc.text('DESGLOSE POR ETAPAS', 20, 20);
            let currentY = 30;
            for (const proceso of procesosOP) {
                if (currentY > 240) { doc.addPage(); currentY = 20; }
                const stageLogs = allLogs.filter(l => l.procesoId === proceso.id);
                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                doc.text(`ETAPA: ${proceso.etapa || 'N/A'}`, 20, currentY);
                currentY += 5;
                autoTable(doc, {
                    startY: currentY,
                    head: [['Colaborador', 'Tipo', 'Ingreso', 'Salida', 'Duración']],
                    body: stageLogs.map((log: any) => {
                        const dur = log.horaIngreso && log.horaSalida ? Math.floor((log.horaSalida.toMillis() - log.horaIngreso.toMillis()) / 1000) : 0;
                        return [
                            log.nombre || (log as any).nombreColaborador,
                            log.tipo === 'colaborador' ? 'DIRECTO' : 'SETUP',
                            log.horaIngreso ? format(log.horaIngreso.toDate(), 'dd/MM/yyyy HH:mm:ss') : '-',
                            log.horaSalida ? format(log.horaSalida.toDate(), 'dd/MM/yyyy HH:mm:ss') : '-',
                            dur ? formatDuration(dur) : '-'
                        ];
                    }),
                    styles: { fontSize: 8 },
                    headStyles: { fillColor: [71, 85, 105] }
                });
                currentY = (doc as any).lastAutoTable.finalY + 15;
            }

            // 5. BITACORA
            doc.addPage();
            doc.setFontSize(16);
            doc.text('BITÁCORA INTEGRAL DE EVENTOS', 20, 20);
            autoTable(doc, {
                startY: 30,
                head: [['Hora', 'Etapa', 'Evento', 'Justificación', 'Usuario']],
                body: sortedEvents.map(evt => [
                    evt.horaEvento ? format(evt.horaEvento.toDate(), 'dd/MM/yyyy HH:mm:ss') : '-',
                    evt.etapa || '-',
                    evt.evento,
                    evt.justificacion || '-',
                    evt.registradoPorUsuario || '-'
                ]),
                styles: { fontSize: 8 },
                headStyles: { fillColor: [15, 23, 42] }
            });

            // 6. OBSERVACIONES Y COMENTARIOS
            const coms = await getComentariosByOP(selectedRepoOP);
            if (coms.length > 0) {
                doc.addPage();
                doc.setFontSize(16);
                doc.text('OBSERVACIONES Y COMENTARIOS REGISTRADOS', 20, 20);
                autoTable(doc, {
                    startY: 30,
                    head: [['Hora', 'Etapa', 'Colaborador', 'Observación / Comentario']],
                    body: coms.map(com => {
                        let text = com.comentario;
                        if (com.correcciones && com.correcciones.length > 0) {
                            const history = com.correcciones.map((c: any) => 
                                `[ANTERIOR: "${c.comentarioAnterior}" (Corregido por ${c.nombreColaborador} el ${format(c.fechaCorreccion.toDate(), 'dd/MM/yyyy HH:mm:ss')} | Motivo: ${c.motivo || 'N/E'})]`
                            ).join('\n');
                            text = `${history}\nACTUAL: "${com.comentario}"`;
                        }
                        return [
                            com.creadoEn ? format(com.creadoEn.toDate(), 'dd/MM/yyyy HH:mm:ss') : '-',
                            com.etapa || '-',
                            `${com.nombreColaborador} (${com.colaboradorId})`,
                            text
                        ];
                    }),
                    styles: { fontSize: 8 },
                    headStyles: { fillColor: [30, 41, 59] }
                });
            }

            doc.save(`Reporte_Integral_OP_${selectedRepoOP}.pdf`);

        } catch (error) {
            console.error(error);
            alert("Error al generar PDF");
        } finally {
            setIsGenerating(false);
        }
    };

    const setQuickRange = (preset: 'this-week' | 'last-week' | 'this-month' | 'last-month') => {
        const now = new Date();
        const start = new Date(now);
        const end = new Date(now);

        if (preset === 'this-week') {
            const day = now.getDay();
            const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1);
            start.setDate(diffToMonday);
            end.setDate(diffToMonday + 6);
        } else if (preset === 'last-week') {
            const day = now.getDay();
            const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1) - 7;
            start.setDate(diffToMonday);
            end.setDate(diffToMonday + 6);
        } else if (preset === 'this-month') {
            start.setDate(1);
            end.setMonth(now.getMonth() + 1);
            end.setDate(0);
        } else if (preset === 'last-month') {
            start.setMonth(now.getMonth() - 1);
            start.setDate(1);
            end.setMonth(now.getMonth());
            end.setDate(0);
        }

        const formatDateString = (d: Date) => {
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
        };

        setReportStartDate(formatDateString(start));
        setReportEndDate(formatDateString(end));
    };

    const handleGenerateRangeReport = async () => {
        if (!reportStartDate || !reportEndDate) {
            alert("Por favor seleccione un rango de fechas.");
            return;
        }
        setIsGeneratingRangeReport(true);
        try {
            const startMs = new Date(`${reportStartDate}T00:00:00`).getTime();
            const endMs = new Date(`${reportEndDate}T23:59:59.999`).getTime();

            const procesosInRange = allProcesos.filter(p => {
                const timeMs = p.creadoEn?.toMillis?.() || p.creadoEn?.seconds * 1000 || 0;
                return timeMs >= startMs && timeMs <= endMs;
            });

            if (procesosInRange.length === 0) {
                setRangeReportData({ processes: [], logs: [], events: [], comments: [] });
                setIsGeneratingRangeReport(false);
                return;
            }

            const logsPromises = procesosInRange.map(p => 
                getDocs(query(collection(db, 'colaboradores_log'), where('procesoId', '==', p.id)))
            );
            const eventsPromises = procesosInRange.map(p => 
                getDocs(query(collection(db, 'eventos_log'), where('procesoId', '==', p.id)))
            );
            const commentsPromises = procesosInRange.map(p => 
                getDocs(query(collection(db, 'comentarios'), where('procesoId', '==', p.id)))
            );

            const logsSnaps = await Promise.all(logsPromises);
            const eventsSnaps = await Promise.all(eventsPromises);
            const commentsSnaps = await Promise.all(commentsPromises);

            const logs: any[] = [];
            logsSnaps.forEach((snap, idx) => {
                const proc = procesosInRange[idx];
                snap.docs.forEach(doc => {
                    logs.push({ id: doc.id, ...doc.data(), etapa: proc.etapa, op: proc.ordenProduccion, producto: proc.producto });
                });
            });

            const events: any[] = [];
            eventsSnaps.forEach((snap, idx) => {
                const proc = procesosInRange[idx];
                snap.docs.forEach(doc => {
                    events.push({ id: doc.id, ...doc.data(), etapa: proc.etapa, op: proc.ordenProduccion, producto: proc.producto });
                });
            });

            const comments: any[] = [];
            commentsSnaps.forEach((snap, idx) => {
                const proc = procesosInRange[idx];
                snap.docs.forEach(doc => {
                    comments.push({ id: doc.id, ...doc.data(), etapa: proc.etapa, op: proc.ordenProduccion, producto: proc.producto });
                });
            });

            setRangeReportData({
                processes: procesosInRange,
                logs,
                events,
                comments
            });
        } catch (err) {
            console.error("Error al generar reporte de rango de fechas:", err);
            alert("Ocurrió un error al consultar los datos.");
        } finally {
            setIsGeneratingRangeReport(false);
        }
    };

    const generateRangeReportPDF = async (stats: any) => {
        if (!rangeReportData || !stats) return;
        setIsGeneratingRangeReport(true);
        try {
            const doc = new jsPDF();
            
            doc.setFillColor(15, 23, 42);
            doc.rect(0, 0, 210, 40, 'F');
            doc.setFontSize(22);
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.text('REPORTE CONSOLIDADO DE PLANTA', 105, 20, { align: 'center' });
            
            doc.setFontSize(10);
            doc.setTextColor(200, 200, 200);
            doc.setFont('helvetica', 'normal');
            doc.text(`PERIODO: ${reportStartDate} AL ${reportEndDate} | GENERADO: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 105, 30, { align: 'center' });
            
            doc.setFontSize(16);
            doc.setTextColor(15, 23, 42);
            doc.setFont('helvetica', 'bold');
            doc.text('RESUMEN EJECUTIVO DE PRODUCTIVIDAD', 20, 55);
            
            const formatDuration = (sec: number) => {
                const h = Math.floor(sec / 3600);
                const m = Math.floor((sec % 3600) / 60);
                return `${h}h ${m}m`;
            };

            autoTable(doc, {
                startY: 65,
                head: [['Métrica', 'Valor Consolidado']],
                body: [
                    ['Órdenes de Producción Procesadas', `${stats.totalOPs} OP(s)`],
                    ['Volumen Total Producido', `${stats.totalUnitsProduced.toLocaleString()} Uds`],
                    ['Horas-Hombre Laboradas (Directas/Setup)', formatDuration(stats.totalProductiveSeconds)],
                    ['Tiempo Total en Pausa', formatDuration(stats.totalPauseSeconds)],
                    ['Tiempo Total de Setup de Máquinas', formatDuration(stats.totalSetupSeconds)],
                    ['Tiempo Total en Reproceso', formatDuration(stats.totalReprocesoSeconds)],
                    ['Tiempo de Espera por Calidad', formatDuration(stats.totalQualityWaitingSeconds)],
                    ['Tiempo de Inspección de Calidad', formatDuration(stats.totalQualityInspectionSeconds)],
                ],
                styles: { fontSize: 10 },
                headStyles: { fillColor: [15, 23, 42] }
            });

            doc.addPage();
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text('ANÁLISIS DE TIEMPOS NO PRODUCTIVOS (PAUSAS)', 20, 20);

            const pausesBody = Object.entries(stats.pauseReasons).map(([reason, data]: [string, any]) => [
                reason,
                `${data.count} vez/veces`,
                formatDuration(data.duration)
            ]);

            autoTable(doc, {
                startY: 30,
                head: [['Motivo de la Pausa', 'Frecuencia de Uso', 'Duración Consolidada']],
                body: pausesBody.length ? pausesBody : [['Sin pausas registradas', '-', '-']],
                styles: { fontSize: 9 },
                headStyles: { fillColor: [180, 83, 9] }
            });

            const currentY = (doc as any).lastAutoTable.finalY + 15;
            doc.setFontSize(16);
            doc.text('RESUMEN DE HORAS POR COLABORADOR', 20, currentY);

            const operatorsBody = Object.entries(stats.operatorHours).map(([name, data]: [string, any]) => [
                name,
                data.type,
                formatDuration(data.totalSeconds)
            ]);

            autoTable(doc, {
                startY: currentY + 10,
                head: [['Colaborador', 'Tipo de Ingreso', 'Tiempo Total Registrado']],
                body: operatorsBody.length ? operatorsBody : [['No hay registros', '-', '-']],
                styles: { fontSize: 9 },
                headStyles: { fillColor: [30, 41, 59] }
            });

            doc.addPage();
            doc.setFontSize(16);
            doc.text('BITÁCORA DE MOVIMIENTOS DE PERSONAL', 20, 20);

            const sortedLogs = [...rangeReportData.logs].sort((a,b) => {
                const timeA = a.horaIngreso?.toMillis?.() || a.horaIngreso?.seconds * 1000 || 0;
                const timeB = b.horaIngreso?.toMillis?.() || b.horaIngreso?.seconds * 1000 || 0;
                return timeB - timeA;
            });

            const movementsBody = sortedLogs.map(log => {
                const date = log.horaIngreso ? format(log.horaIngreso.toDate(), 'dd/MM/yyyy HH:mm:ss') : '-';
                const exitDate = log.horaSalida ? format(log.horaSalida.toDate(), 'dd/MM/yyyy HH:mm:ss') : (log.horaSalida === null ? 'ACTIVO' : '-');
                return [
                    log.nombre || log.nombreColaborador,
                    log.tipo || 'colaborador',
                    `Ingresó: ${date}\nSalida: ${exitDate}`,
                    log.etapa || 'N/A',
                    log.op || 'N/A'
                ];
            });

            autoTable(doc, {
                startY: 30,
                head: [['Colaborador', 'Tipo', 'Detalle de Tiempos', 'Etapa', 'OP']],
                body: movementsBody.length ? movementsBody.slice(0, 100) : [['No hay registros en el rango', '-', '-', '-', '-']],
                styles: { fontSize: 8 },
                headStyles: { fillColor: [71, 85, 105] }
            });

            doc.addPage();
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text('RESUMEN POR ORDEN DE PRODUCCIÓN Y ETAPAS', 20, 20);

            const opBody: any[] = [];
            stats.listOps.forEach((op: any) => {
                opBody.push([
                    `OP: ${op.ordenProduccion}\n[${op.articulo}] ${op.producto}`,
                    'GLOBAL',
                    `${op.trabajoCompletado.toLocaleString()} Uds`,
                    formatDuration(op.directSeconds),
                    formatDuration(op.setupSeconds),
                    formatDuration(op.pauseSeconds),
                    formatDuration(op.qualityWaitSeconds + op.qualityInspectionSeconds)
                ]);

                Object.values(op.etapas).forEach((et: any) => {
                    opBody.push([
                        `  ↳ Etapa: ${et.etapa}`,
                        'Etapa',
                        `${et.trabajoCompletado.toLocaleString()} Uds`,
                        formatDuration(et.directSeconds),
                        formatDuration(et.setupSeconds),
                        formatDuration(et.pauseSeconds),
                        formatDuration(et.qualityWaitSeconds + et.qualityInspectionSeconds)
                    ]);
                });
            });

            autoTable(doc, {
                startY: 30,
                head: [['Orden y Producto', 'Nivel', 'Producción', 'H-H Directas', 'Setup', 'Pausas', 'Calidad']],
                body: opBody.length ? opBody : [['No hay datos registrados', '-', '-', '-', '-', '-', '-']],
                styles: { fontSize: 8 },
                headStyles: { fillColor: [15, 23, 42] },
                didParseCell: (data) => {
                    const rawRow = data.row.raw as any[];
                    if (rawRow && rawRow[1] === 'GLOBAL') {
                        data.cell.styles.fontStyle = 'bold';
                        data.cell.styles.fillColor = [241, 245, 249];
                    } else {
                        data.cell.styles.textColor = [100, 116, 139];
                    }
                }
            });

            doc.addPage();
            doc.setFontSize(16);
            doc.text('OBSERVACIONES Y COMENTARIOS REGISTRADOS', 20, 20);

            const sortedComments = [...rangeReportData.comments].sort((a,b) => {
                const timeA = a.creadoEn?.toMillis?.() || a.creadoEn?.seconds * 1000 || 0;
                const timeB = b.creadoEn?.toMillis?.() || b.creadoEn?.seconds * 1000 || 0;
                return timeB - timeA;
            });

            const commentsBody = sortedComments.map(com => {
                let text = com.comentario || '';
                if (com.correcciones && com.correcciones.length > 0) {
                    const history = com.correcciones.map((c: any) => 
                        `[ANTERIOR: "${c.comentarioAnterior}" (Corregido por ${c.nombreColaborador} el ${format(c.fechaCorreccion.toDate(), 'dd/MM/yyyy HH:mm:ss')} | Motivo: ${c.motivo || 'N/E'})]`
                    ).join('\n');
                    text = `${history}\nACTUAL: "${com.comentario}"`;
                }
                return [
                    com.nombreColaborador || 'Desconocido',
                    com.creadoEn ? format(com.creadoEn.toDate(), 'dd/MM/yyyy HH:mm:ss') : '-',
                    com.etapa || 'N/A',
                    com.ordenProduccion || 'N/A',
                    text
                ];
            });

            autoTable(doc, {
                startY: 30,
                head: [['Colaborador', 'Fecha y Hora', 'Etapa', 'OP', 'Observación / Comentario']],
                body: commentsBody.length ? commentsBody.slice(0, 100) : [['No hay observaciones registradas', '-', '-', '-', '-']],
                styles: { fontSize: 8 },
                headStyles: { fillColor: [51, 65, 85] }
            });

            doc.save(`Reporte_Consolidado_Planta_${reportStartDate}_a_${reportEndDate}.pdf`);

        } catch (error) {
            console.error("Error al exportar PDF de rango de fechas:", error);
            alert("Ocurrió un error al generar el archivo PDF.");
        } finally {
            setIsGeneratingRangeReport(false);
        }
    };

    const handleAddColaborador = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newNombre || !newCedula || !newID) {
            alert("Por favor complete todos los campos obligatorios.");
            return;
        }
        try {
            const docRef = doc(db, 'maestro_colaboradores', newCedula.trim());
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                alert(`Ya existe un colaborador registrado con la identificación ${newCedula.trim()}.`);
                return;
            }

            await setDoc(docRef, {
                nombreCompleto: newNombre.toUpperCase().trim(),
                claveRegistro: newID.trim(),
                mensajeEntrada: newMensajeEntrada || null,
                mensajeSalida: newMensajeSalida || null,
                activo: true
            });
            setNewNombre('');
            setNewCedula('');
            setNewID('');
            setNewMensajeEntrada('');
            setNewMensajeSalida('');
            setShowForm(false);
        } catch (error) {
            console.error(error);
            alert("Error al guardar colaborador.");
        }
    };

    const handleAddArticulo = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newArticuloCodigo || !newArticuloDescripcion || !newArticuloVelocidad) {
            alert("Por favor complete todos los campos obligatorios.");
            return;
        }
        try {
            await addDoc(collection(db, 'maestro_articulos'), {
                codigo: newArticuloCodigo.trim().toUpperCase(),
                descripcion: newArticuloDescripcion.trim().toUpperCase(),
                velocidadTeorica: Number(newArticuloVelocidad),
                linea: newArticuloLinea,
                creadoEn: new Date().toISOString()
            });
            setNewArticuloCodigo('');
            setNewArticuloDescripcion('');
            setNewArticuloVelocidad(0);
            setNewArticuloLinea('Humano');
            setShowForm(false);
        } catch (error) {
            console.error('Error al agregar artículo:', error);
            alert('Hubo un error al guardar el artículo.');
        }
    };

    const handleRegeneratePin = async (colabId: string, nombreCompleto: string) => {
        if (!confirm(`¿Está seguro de que desea regenerar el PIN para ${nombreCompleto}?`)) return;

        let newPin = '';
        let isUnique = false;
        let attempts = 0;

        while (!isUnique && attempts < 100) {
            attempts++;
            const rand = Math.floor(1000 + Math.random() * 9000).toString();
            const exists = colaboradores.some(c => c.claveRegistro === rand);
            if (!exists) {
                newPin = rand;
                isUnique = true;
            }
        }

        if (!newPin) {
            alert('No se pudo generar un PIN único. Por favor intente de nuevo.');
            return;
        }

        try {
            await updateDoc(doc(db, 'maestro_colaboradores', colabId), {
                claveRegistro: newPin
            });
            setRegeneratedPinInfo({ nombre: nombreCompleto, pin: newPin });
        } catch (error) {
            console.error('Error regenerando PIN:', error);
            alert('Hubo un error al actualizar el PIN en Firebase');
        }
    };

    const handleGeneratePinForForm = () => {
        let newPin = '';
        let isUnique = false;
        let attempts = 0;

        while (!isUnique && attempts < 100) {
            attempts++;
            const rand = Math.floor(1000 + Math.random() * 9000).toString();
            const exists = colaboradores.some(c => c.id !== editingItem?.id && c.claveRegistro === rand);
            if (!exists) {
                newPin = rand;
                isUnique = true;
            }
        }

        if (newPin) {
            setEditValue((prev: any) => ({ ...prev, claveRegistro: newPin }));
        }
    };

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUsername || !newPassword) return;
        try {
            await addDoc(collection(db, 'usuarios'), {
                username: newUsername.toLowerCase(),
                email: newEmail.toLowerCase(),
                password: newPassword,
                rol: newRole,
                activo: true,
                creadoEn: new Date().toISOString()
            });
            setNewUsername('');
            setNewEmail('');
            setNewPassword('');
            setNewRole('usuario');
            setShowForm(false);
        } catch (error) {
            console.error(error);
        }
    };

    const handleAddJustificacion = async (e: React.FormEvent, tipo: 'pausa' | 'salida') => {
        e.preventDefault();
        if (!newJustificacion) return;
        try {
            await addDoc(collection(db, 'maestro_justificaciones'), {
                texto: newJustificacion,
                tipo: tipo,
                activo: true
            });
            setNewJustificacion('');
            setShowForm(false);
        } catch (error) {
            console.error(error);
        }
    };

    const handleAddEtapa = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEtapaCodigo || !newEtapaNombre) return;
        try {
            await addDoc(collection(db, 'maestro_etapas'), {
                codigo: newEtapaCodigo.toUpperCase(),
                nombre: newEtapaNombre,
                activo: true,
                tiposProceso: newEtapaTipos
            });
            setNewEtapaCodigo('');
            setNewEtapaNombre('');
            setNewEtapaTipos(['empaque', 'otros', 'anexos']);
            setShowForm(false);
        } catch (error) {
            console.error(error);
        }
    };

    const handleAddMotivoCorreccion = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMotivoCorreccionTexto.trim()) return;
        try {
            await addDoc(collection(db, 'maestro_motivos_correccion'), {
                texto: newMotivoCorreccionTexto.trim(),
                activo: true
            });
            setNewMotivoCorreccionTexto('');
            setShowForm(false);
        } catch (error) {
            console.error(error);
            alert("Error al agregar motivo de corrección");
        }
    };

    const handleSaveEdit = async () => {
        if (!editingItem) return;
        try {
            let collectionName = '';
            switch (editingItem.type) {
                case 'personal': collectionName = 'maestro_colaboradores'; break;
                case 'pausa':
                case 'salida': collectionName = 'maestro_justificaciones'; break;
                case 'etapa': collectionName = 'maestro_etapas'; break;
                case 'usuario': collectionName = 'usuarios'; break;
                case 'orden': collectionName = 'maestro_ordenes'; break;
                case 'articulo': collectionName = 'maestro_articulos'; break;
                case 'motivoCorreccion': collectionName = 'maestro_motivos_correccion'; break;
            }

            if (editingItem.type === 'personal' && editValue.id && editValue.id.trim() !== editingItem.id) {
                const newId = editValue.id.trim();
                const docRef = doc(db, 'maestro_colaboradores', newId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    alert(`Ya existe un colaborador registrado con la identificación ${newId}.`);
                    return;
                }

                // Crear nuevo documento con el nuevo ID (Cédula)
                await setDoc(docRef, {
                    nombreCompleto: editValue.nombreCompleto.toUpperCase().trim(),
                    claveRegistro: editValue.claveRegistro.trim(),
                    mensajeEntrada: editValue.mensajeEntrada || null,
                    mensajeSalida: editValue.mensajeSalida || null,
                    activo: editValue.activo !== undefined ? editValue.activo : true
                });

                // Eliminar el documento anterior
                await deleteDoc(doc(db, 'maestro_colaboradores', editingItem.id));
            } else {
                const { id, ...cleanValue } = editValue;
                await updateDoc(doc(db, collectionName, editingItem.id), cleanValue);
            }

            setEditingItem(null);
            setEditValue({});
        } catch (error) {
            console.error(error);
            alert("Error al guardar los cambios.");
        }
    };

    const handleToggleActivo = async (id: string, current: boolean, collection_name: string) => {
        try {
            await updateDoc(doc(db, collection_name, id), { activo: !current });
        } catch (error) {
            console.error(error);
        }
    };

    const handleDelete = async (id: string, collection_name: string) => {
        if (!confirm("¿Eliminar este registro de forma permanente?")) return;
        try {
            await deleteDoc(doc(db, collection_name, id));
        } catch (error) {
            console.error(error);
        }
    };

    const handleUpdateUserRole = async (uid: string, newRole: UserRole) => {
        try {
            await updateDoc(doc(db, 'usuarios', uid), { rol: newRole });
        } catch (error) {
            console.error(error);
        }
    };

    const handleToggleUserActive = async (uid: string, currentStatus: boolean) => {
        try {
            await updateDoc(doc(db, 'usuarios', uid), { activo: !currentStatus });
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="min-h-screen bg-background text-white p-6 lg:p-10">
            <header className="flex items-center justify-between flex-wrap gap-4 mb-10 border-b border-white/5 pb-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => {
                            if (tab === 'hub') {
                                router.push('/procesos');
                            } else {
                                setTab('hub');
                                setShowForm(false);
                            }
                        }}
                        className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors border border-white/10 flex items-center justify-center text-white"
                        title={tab === 'hub' ? "Volver a Procesos" : "Volver al Panel Principal"}
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                    <div>
                        <h1 className="text-2xl lg:text-3xl font-black tracking-tight uppercase flex items-center gap-3">
                            {tab === 'hub' ? "Administración" : (
                                tab === 'personal' ? "Personal Registrado" :
                                tab === 'historialColaborador' ? "Horas Colaborador" :
                                tab === 'usuarios' ? "Usuarios del Sistema" :
                                tab === 'etapas' ? "Etapas de Proceso" :
                                tab === 'ordenes' ? "Órdenes de Producción" :
                                tab === 'articulos' ? "Maestro de Artículos" :
                                tab === 'pausa' ? "Motivos de Pausa" :
                                tab === 'salida' ? "Motivos de Salida" :
                                tab === 'motivosCorreccion' ? "Motivos de Corrección" :
                                tab === 'resumen' ? "Resumen de Producción" :
                                tab === 'reporteFechas' ? "Reporte de Planta" :
                                tab === 'compararArticulos' ? "Comparar Artículos" :
                                tab === 'reportes' ? "Reportes PDF OP" :
                                "Administración"
                            )}
                        </h1>
                        <p className="text-gray-400 font-medium text-xs lg:text-sm">
                            {tab === 'hub' ? "Gestión de maestros, reportes y configuraciones generales" : "Consola de Administración / Control Operativo"}
                        </p>
                    </div>
                </div>

                {tab !== 'hub' && (
                    <div className="relative">
                        <select
                            value={tab}
                            onChange={(e) => {
                                setTab(e.target.value as any);
                                setShowForm(false);
                            }}
                            className="bg-white border border-gray-300 text-black hover:border-gray-400 rounded-xl py-2.5 px-4 outline-none focus:ring-4 focus:ring-primary-blue/20 text-xs font-black uppercase tracking-wider cursor-pointer font-bold"
                        >
                            <option value="hub">-- IR AL PANEL PRINCIPAL --</option>
                            <optgroup label="Personal">
                                <option value="personal">Personal Registrado</option>
                                <option value="historialColaborador">Horas Colaborador</option>
                                <option value="usuarios">Usuarios del Sistema</option>
                            </optgroup>
                            <optgroup label="Configuración y Maestros">
                                <option value="etapas">Etapas de Proceso</option>
                                <option value="ordenes">Órdenes de Producción</option>
                                <option value="articulos">Maestro de Artículos</option>
                                <option value="pausa">Motivos de Pausa</option>
                                <option value="salida">Motivos de Salida</option>
                                <option value="motivosCorreccion">Motivos de Corrección</option>
                            </optgroup>
                            <optgroup label="Reportes e Indicadores">
                                <option value="resumen">Resumen de Producción</option>
                                <option value="reporteFechas">Reporte de Planta</option>
                                <option value="compararArticulos">Comparar Artículos</option>
                                <option value="reportes">Reportes PDF OP</option>
                            </optgroup>
                        </select>
                    </div>
                )}
            </header>

            <div className={cn("mx-auto transition-all duration-500", tab === 'hub' ? "max-w-6xl" : "max-w-4xl")}>
                {/* Admin Hub Landing View */}
                {tab === 'hub' && (
                    <div className="space-y-12 animate-in fade-in duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {adminSections.map((group, groupIdx) => (
                                <div key={groupIdx} className="space-y-4">
                                    <div className={cn(
                                        "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border w-fit font-mono",
                                        group.color
                                    )}>
                                        {group.group}
                                    </div>
                                    <div className="grid grid-cols-1 gap-4">
                                        {group.items.map(item => {
                                            const Icon = item.icon;
                                            return (
                                                <button
                                                    key={item.id}
                                                    onClick={() => { setTab(item.id as any); setShowForm(false); }}
                                                    className="w-full text-left glass p-5 rounded-[2rem] border border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/15 transition-all duration-300 flex items-start gap-4 hover:scale-[1.02] shadow-lg group hover:shadow-xl hover:shadow-black/20"
                                                >
                                                    <div className={cn(
                                                        "p-3.5 rounded-xl border transition-all duration-300 group-hover:scale-105 shrink-0",
                                                        item.theme
                                                    )}>
                                                        <Icon className="h-5 w-5" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <h3 className="font-black text-white uppercase text-sm group-hover:text-amber-400 transition-colors tracking-wide">{item.title}</h3>
                                                        <p className="text-[11px] text-gray-400 font-medium leading-relaxed">{item.desc}</p>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {/* TAB: PERSONAL */}
                {tab === 'personal' && (
                    <>
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-xl font-black uppercase tracking-widest text-primary-blue">Personal Registrado</h2>
                            <button
                                onClick={() => setShowForm(!showForm)}
                                className="flex items-center gap-2 bg-primary-blue hover:bg-blue-600 px-6 py-3 rounded-xl font-bold transition-all text-white"
                            >
                                {showForm ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                                {showForm ? "CANCELAR" : "AGREGAR NUEVO"}
                            </button>
                        </div>

                        {showForm && (
                            <form onSubmit={handleAddColaborador} className="glass p-8 rounded-3xl mb-8 border border-primary-blue/30 animate-in fade-in slide-in-from-top-4 duration-300">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div>
                                        <label className="block text-xs font-black text-gray-500 uppercase mb-2">Nombre Completo *</label>
                                        <input
                                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary-blue"
                                            value={newNombre}
                                            onChange={(e) => setNewNombre(e.target.value)}
                                            placeholder="Ej: JUAN PEREZ"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black text-gray-500 uppercase mb-2">Cédula / Identificación *</label>
                                        <input
                                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary-blue"
                                            value={newCedula}
                                            onChange={(e) => setNewCedula(e.target.value)}
                                            placeholder="Ej: 115100108"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black text-gray-500 uppercase mb-2">PIN / Clave de Registro *</label>
                                        <div className="flex gap-2">
                                            <input
                                                className="flex-1 bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary-blue"
                                                value={newID}
                                                onChange={(e) => setNewID(e.target.value)}
                                                placeholder="Ej: 8877"
                                                required
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    let newPin = '';
                                                    let isUnique = false;
                                                    let attempts = 0;
                                                    while (!isUnique && attempts < 100) {
                                                        attempts++;
                                                        const rand = Math.floor(1000 + Math.random() * 9000).toString();
                                                        const exists = colaboradores.some(c => c.claveRegistro === rand);
                                                        if (!exists) {
                                                            newPin = rand;
                                                            isUnique = true;
                                                        }
                                                    }
                                                    if (newPin) {
                                                        setNewID(newPin);
                                                    }
                                                }}
                                                className="bg-white/10 hover:bg-white/20 text-white font-bold px-4 rounded-xl transition-all flex items-center gap-2 border border-white/10"
                                                title="Generar PIN"
                                            >
                                                <RefreshCw className="h-4 w-4" />
                                                <span className="text-xs font-black uppercase">Generar</span>
                                            </button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:col-span-2">
                                        <div>
                                            <label className="block text-xs font-black text-gray-500 uppercase mb-2">Mensaje Personalizado (Ingreso)</label>
                                            <input
                                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary-blue"
                                                value={newMensajeEntrada}
                                                onChange={(e) => setNewMensajeEntrada(e.target.value)}
                                                placeholder="Ej: ¡Buen trabajo hoy!"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-gray-500 uppercase mb-2">Mensaje Personalizado (Salida)</label>
                                            <input
                                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary-blue"
                                                value={newMensajeSalida}
                                                onChange={(e) => setNewMensajeSalida(e.target.value)}
                                                placeholder="Ej: ¡Hasta mañana!"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <button type="submit" className="mt-6 w-full bg-success-green text-black font-black py-4 rounded-xl flex items-center justify-center gap-2">
                                    <Check className="h-6 w-6" /> GUARDAR EN MAESTRO
                                </button>
                            </form>
                        )}

                        <div className="glass rounded-3xl overflow-hidden border border-white/10">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-white/5 border-b border-white/10">
                                        <th className="p-5 text-xs font-black uppercase text-gray-500">Nombre</th>
                                        <th className="p-5 text-xs font-black uppercase text-gray-500">Cédula</th>
                                        <th className="p-5 text-xs font-black uppercase text-gray-500">PIN</th>
                                        <th className="p-5 text-xs font-black uppercase text-gray-500">Estado</th>
                                        <th className="p-5 text-right text-xs font-black uppercase text-gray-500">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {colaboradores.map((colab) => (
                                        <tr key={colab.id} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="p-5 font-bold uppercase">{colab.nombreCompleto}</td>
                                            <td className="p-5 font-mono text-gray-300">{colab.id}</td>
                                            <td className="p-5 font-mono text-gray-400">{colab.claveRegistro}</td>
                                            <td className="p-5">
                                                <button
                                                    onClick={() => handleToggleActivo(colab.id, colab.activo, 'maestro_colaboradores')}
                                                    className={cn(
                                                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                                                        colab.activo ? "bg-success-green/10 border-success-green/20 text-success-green" : "bg-danger-red/10 border-danger-red/20 text-danger-red"
                                                    )}
                                                >
                                                    {colab.activo ? "ACTIVO" : "INACTIVO"}
                                                </button>
                                            </td>
                                            <td className="p-5 text-right space-x-2">
                                                <button
                                                    onClick={() => handleRegeneratePin(colab.id, colab.nombreCompleto)}
                                                    className="p-2 hover:bg-white/10 text-primary-blue rounded-lg transition-all"
                                                    title="Regenerar PIN"
                                                >
                                                    <Key className="h-5 w-5" />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setEditingItem({ id: colab.id, type: 'personal', data: colab });
                                                        setEditValue({
                                                            id: colab.id,
                                                            nombreCompleto: colab.nombreCompleto,
                                                            claveRegistro: colab.claveRegistro,
                                                            mensajeEntrada: colab.mensajeEntrada || '',
                                                            mensajeSalida: colab.mensajeSalida || ''
                                                        });
                                                    }}
                                                    className="p-2 hover:bg-white/10 text-gray-400 rounded-lg transition-all"
                                                    title="Editar Colaborador"
                                                >
                                                    <Edit2 className="h-5 w-5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(colab.id, 'maestro_colaboradores')}
                                                    className="p-2 hover:bg-danger-red/20 text-danger-red rounded-lg transition-all"
                                                    title="Eliminar Colaborador"
                                                >
                                                    <Trash2 className="h-5 w-5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {loading && <div className="p-20 text-center font-black animate-pulse text-gray-600">CARGANDO MAESTRO...</div>}
                        </div>
                    </>
                )}

                {/* TAB: JUSTIFICACIONES DE PAUSA */}
                {tab === 'pausa' && (
                    <>
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-xl font-black uppercase tracking-widest text-warning-yellow">Justificaciones de Pausa</h2>
                            <button
                                onClick={() => setShowForm(!showForm)}
                                className="flex items-center gap-2 bg-warning-yellow hover:bg-yellow-600 px-6 py-3 rounded-xl font-bold transition-all text-black"
                            >
                                {showForm ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                                {showForm ? "CANCELAR" : "AGREGAR NUEVA"}
                            </button>
                        </div>

                        {showForm && (
                            <form onSubmit={(e) => handleAddJustificacion(e, 'pausa')} className="glass p-8 rounded-3xl mb-8 border border-warning-yellow/30 animate-in fade-in slide-in-from-top-4 duration-300">
                                <div>
                                    <label className="block text-xs font-black text-gray-500 uppercase mb-2">Texto de Justificación</label>
                                    <input
                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:ring-2 focus:ring-warning-yellow"
                                        value={newJustificacion}
                                        onChange={(e) => setNewJustificacion(e.target.value)}
                                        placeholder="Ej: Problema en la línea"
                                    />
                                </div>
                                <button type="submit" className="mt-6 w-full bg-success-green text-black font-black py-4 rounded-xl flex items-center justify-center gap-2">
                                    <Check className="h-6 w-6" /> GUARDAR
                                </button>
                            </form>
                        )}

                        <div className="glass rounded-3xl overflow-hidden border border-white/10">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-white/5 border-b border-white/10">
                                        <th className="p-5 text-xs font-black uppercase text-gray-500">Justificación</th>
                                        <th className="p-5 text-xs font-black uppercase text-gray-500">Estado</th>
                                        <th className="p-5 text-right text-xs font-black uppercase text-gray-500">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {justificacionesPausa.map((just) => (
                                        <tr key={just.id} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="p-5 font-bold">{just.texto}</td>
                                            <td className="p-5">
                                                <button
                                                    onClick={() => handleToggleActivo(just.id, just.activo, 'maestro_justificaciones')}
                                                    className={cn(
                                                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                                                        just.activo ? "bg-success-green/10 border-success-green/20 text-success-green" : "bg-danger-red/10 border-danger-red/20 text-danger-red"
                                                    )}
                                                >
                                                    {just.activo ? "ACTIVO" : "INACTIVO"}
                                                </button>
                                            </td>
                                            <td className="p-5 text-right space-x-2">
                                                <button
                                                    onClick={() => {
                                                        setEditingItem({ id: just.id, type: 'pausa', data: just });
                                                        setEditValue({ texto: just.texto });
                                                    }}
                                                    className="p-2 hover:bg-white/10 text-gray-400 rounded-lg transition-all"
                                                >
                                                    <Edit2 className="h-5 w-5" />
                                                </button>
                                                <button onClick={() => handleDelete(just.id, 'maestro_justificaciones')} className="p-2 hover:bg-danger-red/20 text-danger-red rounded-lg transition-all">
                                                    <Trash2 className="h-5 w-5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {justificacionesPausa.length === 0 && <div className="p-8 text-center text-gray-600">No hay justificaciones de pausa registradas</div>}
                        </div>
                    </>
                )}

                {/* TAB: JUSTIFICACIONES DE SALIDA */}
                {tab === 'salida' && (
                    <>
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-xl font-black uppercase tracking-widest text-danger-red">Justificaciones de Salida</h2>
                            <button
                                onClick={() => setShowForm(!showForm)}
                                className="flex items-center gap-2 bg-danger-red hover:bg-red-600 px-6 py-3 rounded-xl font-bold transition-all text-white"
                            >
                                {showForm ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                                {showForm ? "CANCELAR" : "AGREGAR NUEVA"}
                            </button>
                        </div>

                        {showForm && (
                            <form onSubmit={(e) => handleAddJustificacion(e, 'salida')} className="glass p-8 rounded-3xl mb-8 border border-danger-red/30 animate-in fade-in slide-in-from-top-4 duration-300">
                                <div>
                                    <label className="block text-xs font-black text-gray-500 uppercase mb-2">Texto de Justificación</label>
                                    <input
                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:ring-2 focus:ring-danger-red"
                                        value={newJustificacion}
                                        onChange={(e) => setNewJustificacion(e.target.value)}
                                        placeholder="Ej: Fin de turno"
                                    />
                                </div>
                                <button type="submit" className="mt-6 w-full bg-success-green text-black font-black py-4 rounded-xl flex items-center justify-center gap-2">
                                    <Check className="h-6 w-6" /> GUARDAR
                                </button>
                            </form>
                        )}

                        <div className="glass rounded-3xl overflow-hidden border border-white/10">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-white/5 border-b border-white/10">
                                        <th className="p-5 text-xs font-black uppercase text-gray-500">Justificación</th>
                                        <th className="p-5 text-xs font-black uppercase text-gray-500">Estado</th>
                                        <th className="p-5 text-right text-xs font-black uppercase text-gray-500">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {justificacionesSalida.map((just) => (
                                        <tr key={just.id} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="p-5 font-bold">{just.texto}</td>
                                            <td className="p-5">
                                                <button
                                                    onClick={() => handleToggleActivo(just.id, just.activo, 'maestro_justificaciones')}
                                                    className={cn(
                                                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                                                        just.activo ? "bg-success-green/10 border-success-green/20 text-success-green" : "bg-danger-red/10 border-danger-red/20 text-danger-red"
                                                    )}
                                                >
                                                    {just.activo ? "ACTIVO" : "INACTIVO"}
                                                </button>
                                            </td>
                                            <td className="p-5 text-right space-x-2">
                                                <button
                                                    onClick={() => {
                                                        setEditingItem({ id: just.id, type: 'salida', data: just });
                                                        setEditValue({ texto: just.texto });
                                                    }}
                                                    className="p-2 hover:bg-white/10 text-gray-400 rounded-lg transition-all"
                                                >
                                                    <Edit2 className="h-5 w-5" />
                                                </button>
                                                <button onClick={() => handleDelete(just.id, 'maestro_justificaciones')} className="p-2 hover:bg-danger-red/20 text-danger-red rounded-lg transition-all">
                                                    <Trash2 className="h-5 w-5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {justificacionesSalida.length === 0 && <div className="p-8 text-center text-gray-600">No hay justificaciones de salida registradas</div>}
                        </div>
                    </>
                )}

                {/* TAB: ETAPAS */}
                {tab === 'etapas' && (
                    <>
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-xl font-black uppercase tracking-widest text-accent-purple">Etapas de Producción</h2>
                            <button
                                onClick={() => setShowForm(!showForm)}
                                className="flex items-center gap-2 bg-accent-purple hover:bg-purple-700 px-6 py-3 rounded-xl font-bold transition-all text-white"
                            >
                                {showForm ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                                {showForm ? "CANCELAR" : "AGREGAR NUEVA"}
                            </button>
                        </div>

                        {showForm && (
                            <form onSubmit={handleAddEtapa} className="glass p-8 rounded-3xl mb-8 border border-accent-purple/30 animate-in fade-in slide-in-from-top-4 duration-300">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-black text-gray-500 uppercase mb-2">Código</label>
                                        <input
                                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:ring-2 focus:ring-accent-purple"
                                            value={newEtapaCodigo}
                                            onChange={(e) => setNewEtapaCodigo(e.target.value)}
                                            placeholder="Ej: EMP"
                                            maxLength={4}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black text-gray-500 uppercase mb-2">Nombre</label>
                                        <input
                                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:ring-2 focus:ring-accent-purple"
                                            value={newEtapaNombre}
                                            onChange={(e) => setNewEtapaNombre(e.target.value)}
                                            placeholder="Ej: Empaque"
                                        />
                                    </div>
                                </div>

                                <div className="mt-6">
                                    <label className="block text-xs font-black text-gray-500 uppercase mb-3">Visible en procesos de tipo:</label>
                                    <div className="flex flex-wrap gap-4">
                                        {[
                                            { id: 'empaque', label: 'Empaque' },
                                            { id: 'otros', label: 'Otros' },
                                            { id: 'anexos', label: 'Anexos' }
                                        ].map(tipo => (
                                            <label key={tipo.id} className="flex items-center gap-2 cursor-pointer group">
                                                <input
                                                    type="checkbox"
                                                    checked={newEtapaTipos.includes(tipo.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setNewEtapaTipos([...newEtapaTipos, tipo.id]);
                                                        } else {
                                                            setNewEtapaTipos(newEtapaTipos.filter(t => t !== tipo.id));
                                                        }
                                                    }}
                                                    className="hidden"
                                                />
                                                <div className={cn(
                                                    "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                                                    newEtapaTipos.includes(tipo.id) ? "bg-accent-purple border-accent-purple" : "border-white/20 group-hover:border-white/40"
                                                )}>
                                                    {newEtapaTipos.includes(tipo.id) && <Check className="h-3 w-3 text-white" />}
                                                </div>
                                                <span className="text-sm font-bold">{tipo.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <button type="submit" className="mt-8 w-full bg-success-green text-black font-black py-4 rounded-xl flex items-center justify-center gap-2">
                                    <Check className="h-6 w-6" /> GUARDAR ETAPA
                                </button>
                            </form>
                        )}

                        <div className="glass rounded-3xl overflow-hidden border border-white/10">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-white/5 border-b border-white/10">
                                        <th className="p-5 text-xs font-black uppercase text-gray-500">Código</th>
                                        <th className="p-5 text-xs font-black uppercase text-gray-500">Nombre</th>
                                        <th className="p-5 text-xs font-black uppercase text-gray-500">Tipos de Proceso</th>
                                        <th className="p-5 text-xs font-black uppercase text-gray-500">Estado</th>
                                        <th className="p-5 text-right text-xs font-black uppercase text-gray-500">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {etapas.map((etapa) => (
                                        <tr key={etapa.id} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="p-5 font-bold uppercase">{etapa.codigo}</td>
                                            <td className="p-5">{etapa.nombre}</td>
                                            <td className="p-5">
                                                <div className="flex flex-wrap gap-1">
                                                    {(etapa as any).tiposProceso?.map((t: string) => (
                                                        <span key={t} className="text-[8px] font-black px-2 py-0.5 bg-white/5 rounded border border-white/10 uppercase tracking-tighter">
                                                            {t}
                                                        </span>
                                                    )) || <span className="text-[8px] text-gray-600">TODOS</span>}
                                                </div>
                                            </td>
                                            <td className="p-5">
                                                <button
                                                    onClick={() => handleToggleActivo(etapa.id, etapa.activo, 'maestro_etapas')}
                                                    className={cn(
                                                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                                                        etapa.activo ? "bg-success-green/10 border-success-green/20 text-success-green" : "bg-danger-red/10 border-danger-red/20 text-danger-red"
                                                    )}
                                                >
                                                    {etapa.activo ? "ACTIVO" : "INACTIVO"}
                                                </button>
                                            </td>
                                            <td className="p-5 text-right space-x-2">
                                                <button
                                                    onClick={() => {
                                                        setEditingItem({ id: etapa.id, type: 'etapa', data: etapa });
                                                        setEditValue({ codigo: etapa.codigo, nombre: etapa.nombre, tiposProceso: etapa.tiposProceso });
                                                    }}
                                                    className="p-2 hover:bg-white/10 text-gray-400 rounded-lg transition-all"
                                                >
                                                    <Edit2 className="h-5 w-5" />
                                                </button>
                                                <button onClick={() => handleDelete(etapa.id, 'maestro_etapas')} className="p-2 hover:bg-danger-red/20 text-danger-red rounded-lg transition-all">
                                                    <Trash2 className="h-5 w-5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {etapas.length === 0 && <div className="p-8 text-center text-gray-600">No hay etapas registradas</div>}
                        </div>
                    </>
                )}

                {/* TAB: USUARIOS */}
                {tab === 'usuarios' && (
                    <>
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-xl font-black uppercase tracking-widest text-emerald-400">Control de Usuarios</h2>
                            <button
                                onClick={() => setShowForm(!showForm)}
                                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 px-6 py-3 rounded-xl font-bold transition-all text-black"
                            >
                                {showForm ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                                {showForm ? "CANCELAR" : "CREAR USUARIO"}
                            </button>
                        </div>

                        {showForm && (
                            <form onSubmit={handleAddUser} className="glass p-8 rounded-3xl mb-8 border border-emerald-500/30 animate-in fade-in slide-in-from-top-4 duration-300">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-black text-gray-500 uppercase mb-2">Username</label>
                                        <input
                                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:ring-2 focus:ring-emerald-500"
                                            value={newUsername}
                                            onChange={(e) => setNewUsername(e.target.value.toLowerCase())}
                                            placeholder="ej: jsmith"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black text-gray-500 uppercase mb-2">Password</label>
                                        <input
                                            type="text"
                                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:ring-2 focus:ring-emerald-500"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            placeholder="Contraseña"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black text-gray-500 uppercase mb-2">Email (Opcional)</label>
                                        <input
                                            type="email"
                                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:ring-2 focus:ring-emerald-500"
                                            value={newEmail}
                                            onChange={(e) => setNewEmail(e.target.value)}
                                            placeholder="email@ejemplo.com"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black text-gray-500 uppercase mb-2">Rol de Usuario</label>
                                        <select
                                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:ring-2 focus:ring-emerald-500 outline-none"
                                            value={newRole}
                                            onChange={(e) => setNewRole(e.target.value as UserRole)}
                                        >
                                            <option value="usuario">Usuario</option>
                                            <option value="supervisor">Supervisor</option>
                                            <option value="superadmin">Superadmin</option>
                                        </select>
                                    </div>
                                </div>
                                <button type="submit" className="mt-6 w-full bg-emerald-500 text-black font-black py-4 rounded-xl flex items-center justify-center gap-2">
                                    <Check className="h-6 w-6" /> REGISTRAR ACCESO
                                </button>
                            </form>
                        )}

                        <div className="glass rounded-3xl overflow-hidden border border-white/10">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-white/5 border-b border-white/10">
                                        <th className="p-5 text-xs font-black uppercase text-gray-500">Usuario</th>
                                        <th className="p-5 text-xs font-black uppercase text-gray-500">Password</th>
                                        <th className="p-5 text-xs font-black uppercase text-gray-500">Rol</th>
                                        <th className="p-5 text-xs font-black uppercase text-gray-500">Estado</th>
                                        <th className="p-5 text-right text-xs font-black uppercase text-gray-500">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {usuarios.map((u) => (
                                        <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="p-5">
                                                <div className="font-bold">{u.username}</div>
                                                <div className="text-[10px] text-gray-500">{u.email}</div>
                                            </td>
                                            <td className="p-5 font-mono text-xs text-gray-400">
                                                <div className="flex items-center gap-2">
                                                    <Key className="h-3 w-3" /> {u.password}
                                                </div>
                                            </td>
                                            <td className="p-5">
                                                <span className={cn(
                                                    "px-2 py-1 rounded text-[10px] font-black uppercase",
                                                    u.rol === 'superadmin' ? "bg-primary-blue/20 text-primary-blue" :
                                                        u.rol === 'supervisor' ? "bg-warning-yellow/20 text-warning-yellow" : "bg-white/10 text-gray-400"
                                                )}>
                                                    {u.rol}
                                                </span>
                                            </td>
                                            <td className="p-5">
                                                <button
                                                    onClick={() => handleToggleUserActive(u.id, u.activo)}
                                                    className={cn(
                                                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all",
                                                        u.activo ? "bg-success-green/10 border-success-green/20 text-success-green" : "bg-danger-red/10 border-danger-red/20 text-danger-red"
                                                    )}
                                                >
                                                    {u.activo ? "ACTIVO" : "INACTIVO"}
                                                </button>
                                            </td>
                                            <td className="p-5 text-right space-x-2">
                                                <button
                                                    onClick={() => {
                                                        setEditingItem({ id: u.id, type: 'usuario', data: u });
                                                        setEditValue({ username: u.username, password: u.password, email: u.email, rol: u.rol });
                                                    }}
                                                    className="p-2 hover:bg-white/10 text-gray-400 rounded-lg transition-all"
                                                >
                                                    <Edit2 className="h-5 w-5" />
                                                </button>
                                                <button onClick={() => handleDelete(u.id, 'usuarios')} className="p-2 hover:bg-danger-red/20 text-danger-red rounded-lg transition-all">
                                                    <Trash2 className="h-5 w-5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {usuarios.length === 0 && <div className="p-8 text-center text-gray-600">No hay usuarios registrados</div>}
                        </div>
                    </>
                )}
                {/* TAB: ORDENES MAESTRAS */}
                {tab === 'ordenes' && (
                    <>
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-xl font-black uppercase tracking-widest text-primary-blue">Ordenes de Producción Maestras</h2>
                            <div className="flex gap-3">
                                <button
                                    onClick={handleSyncAppSheet}
                                    disabled={isSyncing}
                                    className="flex items-center gap-2 bg-accent-purple hover:bg-purple-600 px-6 py-3 rounded-xl font-bold transition-all text-white shadow-lg shadow-purple-500/20 disabled:opacity-50"
                                >
                                    <RefreshCw className={cn("h-5 w-5", isSyncing && "animate-spin")} />
                                    {isSyncing ? "SINCRONIZANDO..." : "SINCRO APPSHEET"}
                                </button>
                                <button
                                    onClick={() => setShowForm(!showForm)}
                                    className="flex items-center gap-2 bg-primary-blue hover:bg-blue-600 px-6 py-3 rounded-xl font-bold transition-all text-white shadow-lg shadow-blue-500/20"
                                >
                                    {showForm ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                                    {showForm ? "CANCELAR" : "CARGAR ORDEN"}
                                </button>
                            </div>
                        </div>

                        {showForm && (
                            <form onSubmit={handleAddOrder} className="glass p-8 rounded-[2.5rem] mb-8 border border-primary-blue/30 animate-in fade-in slide-in-from-top-4 duration-300">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                    <div className="md:col-span-1">
                                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Orden de Producción (OP)</label>
                                        <input
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 font-bold focus:ring-2 focus:ring-primary-blue outline-none transition-all"
                                            value={newOrderOP}
                                            onChange={(e) => setNewOrderOP(e.target.value)}
                                            placeholder="Ej: OP-2024-001"
                                            required
                                        />
                                    </div>
                                    <div className="md:col-span-1">
                                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Código de Artículo</label>
                                        <input
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 font-bold focus:ring-2 focus:ring-primary-blue outline-none transition-all"
                                            value={newOrderArticulo}
                                            onChange={(e) => setNewOrderArticulo(e.target.value)}
                                            placeholder="Ej: ART-001"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Producto</label>
                                        <input
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 font-bold focus:ring-2 focus:ring-primary-blue outline-none transition-all"
                                            value={newOrderProduct}
                                            onChange={(e) => setNewOrderProduct(e.target.value)}
                                            placeholder="Nombre del producto"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Lote</label>
                                        <input
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 font-bold focus:ring-2 focus:ring-primary-blue outline-none transition-all"
                                            value={newOrderLote}
                                            onChange={(e) => setNewOrderLote(e.target.value)}
                                            placeholder="Ej: L-2345"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Etapa por defecto</label>
                                        <select
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 font-bold focus:ring-2 focus:ring-primary-blue outline-none transition-all"
                                            value={newOrderEtapa}
                                            onChange={(e) => setNewOrderEtapa(e.target.value)}
                                        >
                                            <option value="">Seleccione etapa...</option>
                                            {etapas.map(e => <option key={e.id} value={e.nombre}>{e.nombre}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Cantidad Total</label>
                                        <input
                                            type="number"
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 font-bold focus:ring-2 focus:ring-primary-blue outline-none transition-all"
                                            value={newOrderCantidad}
                                            onChange={(e) => setNewOrderCantidad(Number(e.target.value))}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Velocidad Teórica (Unid/Eq/Min)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 font-bold focus:ring-2 focus:ring-primary-blue outline-none transition-all"
                                            value={newOrderVelocidad}
                                            onChange={(e) => setNewOrderVelocidad(Number(e.target.value))}
                                        />
                                    </div>
                                </div>
                                <button type="submit" className="mt-8 w-full bg-success-green text-black font-black py-5 rounded-2xl flex items-center justify-center gap-3 shadow-xl shadow-success-green/10 hover:bg-green-400 transition-all">
                                    <Check className="h-6 w-6" /> GUARDAR ORDEN MAESTRA
                                </button>
                            </form>
                        )}

                        <div className="glass rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="bg-white/5 border-b border-white/10">
                                            <th className="p-6 text-[10px] font-black uppercase tracking-widest text-gray-500">OP</th>
                                            <th className="p-6 text-[10px] font-black uppercase tracking-widest text-gray-500">Producto</th>
                                            <th className="p-6 text-[10px] font-black uppercase tracking-widest text-gray-500 text-center">Cant / Vel</th>
                                            <th className="p-6 text-right text-[10px] font-black uppercase tracking-widest text-gray-500">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {ordenes.map((o) => (
                                            <tr key={o.id} className="hover:bg-white/[0.02] transition-colors group">
                                                <td className="p-6">
                                                    <span className="font-black text-primary-blue text-lg tracking-tight">{o.op}</span>
                                                    <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">
                                                        Lote: {o.lote || 'N/A'}{o.articulo && ` | Art: ${o.articulo}`}
                                                    </div>
                                                </td>
                                                <td className="p-6">
                                                    <div className="font-bold text-white uppercase">{o.producto}</div>
                                                    <div className="text-[10px] text-gray-500 mt-1">Etapa: {o.etapa || 'No def.'}</div>
                                                </td>
                                                <td className="p-6 text-center">
                                                    <div className="inline-flex flex-col items-center">
                                                        <span className="font-black text-white text-sm">{o.cantidad.toLocaleString()}</span>
                                                        <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">{o.velocidadTeorica} u/min/p</span>
                                                    </div>
                                                </td>
                                                <td className="p-6 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => {
                                                                setEditingItem({ id: o.id, type: 'orden', data: o });
                                                                setEditValue({ ...o });
                                                            }}
                                                            className="p-3 hover:bg-white/10 text-gray-400 rounded-xl transition-all"
                                                        >
                                                            <Edit2 className="h-5 w-5" />
                                                        </button>
                                                        <button onClick={() => handleDelete(o.id, 'maestro_ordenes')} className="p-3 hover:bg-danger-red/10 text-danger-red rounded-xl transition-all">
                                                            <Trash2 className="h-5 w-5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {ordenes.length === 0 && <div className="p-20 text-center text-gray-600 font-bold uppercase tracking-widest italic">No hay órdenes maestras cargadas</div>}
                        </div>
                    </>
                )}

                {/* TAB: REPORTES */}
                {tab === 'reportes' && (
                    <>
                        <div className="mb-10 text-center">
                            <h2 className="text-3xl font-black uppercase tracking-tight text-accent-purple mb-4">Generador de Reportes</h2>
                            <p className="text-gray-400 font-medium">Seleccione una Orden de Producción para descargar el historial de tiempos</p>
                        </div>

                        <div className="glass p-12 rounded-[3rem] border border-white/10 shadow-2xl max-w-2xl mx-auto flex flex-col items-center gap-10">
                            <div className="w-full space-y-4">
                                <label className="block text-xs font-black uppercase tracking-[0.2em] text-gray-500 text-center mb-4">Orden de Producción</label>
                                <select
                                    value={selectedRepoOP}
                                    onChange={(e) => setSelectedRepoOP(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-3xl p-6 text-xl font-black text-center outline-none focus:ring-4 focus:ring-accent-purple/20 transition-all appearance-none cursor-pointer"
                                >
                                    <option value="" className="bg-black">-- Seleccione OP --</option>
                                    {Array.from(new Set(allProcesos.map(p => p.ordenProduccion)))
                                        .filter(op => op !== 'N/A')
                                        .sort()
                                        .map(op => (
                                            <option key={op} value={op} className="bg-black">{op}</option>
                                        ))
                                    }
                                </select>
                            </div>

                            <button
                                onClick={generatePDF}
                                disabled={!selectedRepoOP || isGenerating}
                                className={cn(
                                    "w-full bg-accent-purple text-white py-6 rounded-3xl font-black text-xl flex items-center justify-center gap-4 transition-all shadow-xl shadow-accent-purple/20 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:grayscale",
                                    isGenerating && "animate-pulse"
                                )}
                            >
                                {isGenerating ? (
                                    <>
                                        <RefreshCw className="h-7 w-7 animate-spin" /> PROCESANDO...
                                    </>
                                ) : (
                                    <>
                                        <FileText className="h-7 w-7" /> DESCARGAR REPORTE PDF
                                    </>
                                )}
                            </button>

                            {!selectedRepoOP && (
                                <p className="text-[10px] font-black uppercase text-gray-600 tracking-widest text-center">
                                    EL REPORTE INCLUIRÁ TODOS LOS PROCESOS Y COLABORADORES ASOCIADOS A LA OP SELECCIONADA
                                </p>
                            )}
                        </div>
                    </>
                )}

                {/* TAB: RESUMEN DE PRODUCCIÓN */}
                {tab === 'resumen' && (
                    <>
                        <div className="mb-10 text-center animate-in fade-in duration-300">
                            <h2 className="text-3xl font-black uppercase tracking-tight text-primary-blue mb-4">Resumen de Producción</h2>
                            <p className="text-gray-400 font-medium text-sm">Visualización de tiempos, personal, eficiencia y observaciones consolidadas por OP</p>
                        </div>

                        {/* OP Selector */}
                        <div className="glass p-8 rounded-3xl border border-white/10 shadow-2xl mb-8 flex flex-col items-center gap-6 max-w-2xl mx-auto">
                            <div className="w-full space-y-4">
                                <label className="block text-xs font-black uppercase tracking-[0.2em] text-gray-500 text-center mb-2">Orden de Producción (OP)</label>
                                <select
                                    value={selectedResumenOP}
                                    onChange={(e) => setSelectedResumenOP(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-3xl p-6 text-xl font-black text-center outline-none focus:ring-4 focus:ring-primary-blue/20 transition-all appearance-none cursor-pointer"
                                >
                                    <option value="" className="bg-black">-- Seleccione OP --</option>
                                    {Array.from(new Set(allProcesos.map(p => p.ordenProduccion)))
                                        .filter(op => op !== 'N/A')
                                        .sort()
                                        .map(op => (
                                            <option key={op} value={op} className="bg-black">{op}</option>
                                        ))
                                    }
                                </select>
                            </div>
                        </div>

                        {/* If OP is selected, show details */}
                        {selectedResumenOP && (
                            loadingResumenDetails ? (
                                <div className="p-20 text-center font-black animate-pulse text-gray-600 uppercase tracking-widest">
                                    Cargando información del resumen...
                                </div>
                            ) : (() => {
                                const procesosOP = allProcesos.filter(p => p.ordenProduccion === selectedResumenOP);
                                
                                if (procesosOP.length === 0) {
                                    return (
                                        <div className="text-center py-20 text-gray-500 font-bold uppercase tracking-widest italic">
                                            No hay procesos registrados para esta OP
                                        </div>
                                    );
                                }

                                const mainProceso = procesosOP[0];

                                const calculateProcessEffectiveTimes = (p: any, pEvents: any[], pLogs: any[]) => {
                                    const runningIntervals: { start: number; end: number }[] = [];
                                    const pStart = p.horaInicioReal?.toMillis?.() || p.horaInicioReal?.seconds * 1000 || 0;
                                    if (pStart > 0) {
                                        let currentStart = pStart;
                                        const sortedEvents = [...pEvents].sort((a, b) => {
                                            const timeA = a.horaEvento?.toMillis?.() || a.horaEvento?.seconds * 1000 || 0;
                                            const timeB = b.horaEvento?.toMillis?.() || b.horaEvento?.seconds * 1000 || 0;
                                            return timeA - timeB;
                                        });

                                        sortedEvents.forEach(evt => {
                                            const eventText = (evt.evento || "").toUpperCase();
                                            const timeMs = evt.horaEvento?.toMillis?.() || evt.horaEvento?.seconds * 1000 || 0;
                                            
                                            if (eventText.includes('PAUSA')) {
                                                if (currentStart > 0 && timeMs > currentStart) {
                                                    runningIntervals.push({ start: currentStart, end: timeMs });
                                                    currentStart = 0;
                                                }
                                            } else if (eventText.includes('REANUDA')) {
                                                if (currentStart === 0) {
                                                    currentStart = timeMs;
                                                }
                                            }
                                        });
                                        
                                        if (currentStart > 0) {
                                            const pEnd = p.horaFinReal?.toMillis?.() || p.horaFinReal?.seconds * 1000 || Date.now();
                                            if (pEnd > currentStart) {
                                                runningIntervals.push({ start: currentStart, end: pEnd });
                                            }
                                        }
                                    }

                                    const effectiveProcessSeconds = runningIntervals.reduce((sum, interval) => sum + Math.floor((interval.end - interval.start) / 1000), 0);

                                    let effectiveHHSeconds = 0;
                                    pLogs.forEach(log => {
                                        const logStart = log.horaIngreso?.toMillis?.() || log.horaIngreso?.seconds * 1000 || 0;
                                        const logEnd = log.horaSalida?.toMillis?.() || log.horaSalida?.seconds * 1000 || (p.estado === 'Iniciado' ? Date.now() : (p.horaFinReal?.toMillis?.() || p.horaFinReal?.seconds * 1000 || Date.now()));

                                        if (logStart > 0 && logEnd > logStart) {
                                            runningIntervals.forEach(interval => {
                                                const overlapStart = Math.max(logStart, interval.start);
                                                const overlapEnd = Math.min(logEnd, interval.end);
                                                if (overlapEnd > overlapStart) {
                                                    effectiveHHSeconds += Math.floor((overlapEnd - overlapStart) / 1000);
                                                }
                                            });
                                        }
                                    });

                                    return { effectiveProcessSeconds, effectiveHHSeconds };
                                };

                                let totalOPEffectiveProcessSeconds = 0;
                                let totalOPEffectiveHHSeconds = 0;

                                procesosOP.forEach(p => {
                                    const pEvents = resumenEvents.filter(evt => evt.procesoId === p.id);
                                    const pLogs = resumenLogs.filter(log => log.procesoId === p.id);
                                    const { effectiveProcessSeconds, effectiveHHSeconds } = calculateProcessEffectiveTimes(p, pEvents, pLogs);
                                    p._effectiveProcessSeconds = effectiveProcessSeconds;
                                    p._effectiveHHSeconds = effectiveHHSeconds;
                                    totalOPEffectiveProcessSeconds += effectiveProcessSeconds;
                                    totalOPEffectiveHHSeconds += effectiveHHSeconds;
                                });

                                // Time Calculations
                                const startTimes = procesosOP.map(p => p.horaInicioReal?.toMillis?.() || p.horaInicioReal?.seconds * 1000).filter(Boolean);
                                const endTimes = procesosOP.map(p => p.horaFinReal?.toMillis?.() || p.horaFinReal?.seconds * 1000).filter(Boolean);
                                
                                const minStart = startTimes.length ? Math.min(...startTimes) : null;
                                const maxEnd = endTimes.length ? Math.max(...endTimes) : null;
                                const effectiveMaxEnd = maxEnd || Date.now();
                                const totalOPSeconds = minStart ? Math.floor((effectiveMaxEnd - minStart) / 1000) : 0;
                                
                                const totalSetupSeconds = procesosOP.reduce((sum, p) => sum + (p.tiempoSetupSegundos || 0), 0);
                                const totalReprocesoSeconds = procesosOP.reduce((sum, p) => sum + (p.tiempoReprocesoSegundos || 0), 0);
                                
                                // Pause calculations
                                const pauseDurationsByReason: Record<string, number> = {};
                                let totalPauseSeconds = 0;
                                const sortedEvents = [...resumenEvents].sort((a, b) => {
                                    const timeA = a.horaEvento?.toMillis?.() || a.horaEvento?.seconds * 1000 || 0;
                                    const timeB = b.horaEvento?.toMillis?.() || b.horaEvento?.seconds * 1000 || 0;
                                    return timeA - timeB;
                                });
                                
                                let pauseStartMap: Record<string, { timeMs: number; reason: string }> = {};
                                sortedEvents.forEach(evt => {
                                    const eventText = (evt.evento || "").toUpperCase();
                                    const processId = evt.procesoId;
                                    const timeMs = evt.horaEvento?.toMillis?.() || evt.horaEvento?.seconds * 1000 || 0;
                                    const reason = evt.justificacion || "Pausa Automática";
                                    
                                    // Exclude "Acumulado" as a cause of pause (Requirement #2)
                                    if (reason.toUpperCase().includes("ACUMULADO")) {
                                        return;
                                    }

                                    if (eventText.includes('PROCESO PAUSADO')) {
                                        pauseStartMap[processId] = { timeMs, reason };
                                    } else if ((eventText.includes('REANUDA') || eventText.includes('FINALIZADO')) && pauseStartMap[processId]) {
                                        const duration = Math.floor((timeMs - pauseStartMap[processId].timeMs) / 1000);
                                        const r = pauseStartMap[processId].reason;
                                        pauseDurationsByReason[r] = (pauseDurationsByReason[r] || 0) + duration;
                                        totalPauseSeconds += duration;
                                        delete pauseStartMap[processId];
                                    }
                                });
                                // Add ongoing pauses if process is active and paused
                                Object.keys(pauseStartMap).forEach(procId => {
                                    const relatedProc = procesosOP.find(p => p.id === procId);
                                    if (relatedProc && relatedProc.estado === 'Pausado') {
                                        const duration = Math.floor((Date.now() - pauseStartMap[procId].timeMs) / 1000);
                                        const r = pauseStartMap[procId].reason;
                                        pauseDurationsByReason[r] = (pauseDurationsByReason[r] || 0) + duration;
                                        totalPauseSeconds += duration;
                                    }
                                });

                                // Quality calculations
                                let totalQualityWaitingSeconds = 0;
                                let totalQualityInspectionSeconds = 0;
                                
                                procesosOP.forEach(p => {
                                    const call = p.calidadLlamadaEn?.toMillis?.() || p.calidadLlamadaEn?.seconds * 1000 || 0;
                                    const arrival = p.calidadLlegadaEn?.toMillis?.() || p.calidadLlegadaEn?.seconds * 1000 || 0;
                                    const approval = p.calidadAprobadaEn?.toMillis?.() || p.calidadAprobadaEn?.seconds * 1000 || 0;
                                    
                                    if (call > 0 && arrival > 0) {
                                        totalQualityWaitingSeconds += Math.floor((arrival - call) / 1000);
                                    } else if (call > 0 && p.calidadEstado === 'esperando') {
                                        totalQualityWaitingSeconds += Math.floor((Date.now() - call) / 1000);
                                    }
                                    
                                    if (arrival > 0 && approval > 0) {
                                        totalQualityInspectionSeconds += Math.floor((approval - arrival) / 1000);
                                    } else if (arrival > 0 && p.calidadEstado === 'inspeccion') {
                                        totalQualityInspectionSeconds += Math.floor((Date.now() - arrival) / 1000);
                                    }
                                });

                                // Helper to format duration
                                const formatDuration = (seconds: number) => {
                                    if (seconds < 0) return '0s';
                                    const h = Math.floor(seconds / 3600);
                                    const m = Math.floor((seconds % 3600) / 60);
                                    const s = Math.floor(seconds % 60);
                                    return `${h}h ${m}m ${s}s`;
                                };

                                return (
                                    <div className="space-y-8 animate-in fade-in duration-500">
                                        
                                        {/* OP Info Header Card */}
                                        <div className="glass p-6 rounded-3xl border border-white/10 flex flex-col md:flex-row justify-between gap-4 bg-white/5">
                                            <div>
                                                <p className="text-xs font-black text-gray-500 uppercase tracking-widest">Orden de Producción</p>
                                                <h3 className="text-2xl font-black text-white uppercase">{selectedResumenOP}</h3>
                                            </div>
                                            <div>
                                                <p className="text-xs font-black text-gray-500 uppercase tracking-widest">Producto</p>
                                                <h4 className="text-lg font-bold text-gray-200 uppercase">{mainProceso.producto || 'N/A'}</h4>
                                            </div>
                                            <div>
                                                <p className="text-xs font-black text-gray-500 uppercase tracking-widest">Lote</p>
                                                <h4 className="text-lg font-bold text-gray-200 uppercase font-mono">{mainProceso.lote || 'N/A'}</h4>
                                            </div>
                                            <div>
                                                <p className="text-xs font-black text-gray-500 uppercase tracking-widest">Líder del Proceso</p>
                                                <h4 className="text-lg font-bold text-primary-blue uppercase">{mainProceso.lider || 'N/A'}</h4>
                                            </div>
                                        </div>

                                        {/* Executive Cards Grid */}
                                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                            
                                            {/* Duración Total */}
                                            <div className="glass p-5 rounded-2xl border border-white/10 flex flex-col justify-between min-h-[120px] bg-gradient-to-br from-white/5 to-transparent">
                                                <div className="flex justify-between items-start text-gray-400">
                                                    <span className="text-[10px] font-black uppercase tracking-widest">TIEMPO TOTAL OP</span>
                                                    <Clock className="h-5 w-5 text-primary-blue" />
                                                </div>
                                                <div className="mt-3">
                                                    <h3 className="text-xl font-black text-white tracking-tight">{formatDuration(totalOPSeconds)}</h3>
                                                    <p className="text-[9px] text-gray-500 font-bold uppercase mt-1">Desde primer inicio</p>
                                                </div>
                                            </div>

                                            {/* Setup */}
                                            <div className="glass p-5 rounded-2xl border border-white/10 flex flex-col justify-between min-h-[120px] bg-gradient-to-br from-white/5 to-transparent">
                                                <div className="flex justify-between items-start text-gray-400">
                                                    <span className="text-[10px] font-black uppercase tracking-widest">TIEMPO SETUP</span>
                                                    <Settings className="h-5 w-5 text-accent-purple" />
                                                </div>
                                                <div className="mt-3">
                                                    <h3 className="text-xl font-black text-white tracking-tight">{formatDuration(totalSetupSeconds)}</h3>
                                                    <p className="text-[9px] text-gray-500 font-bold uppercase mt-1">Configuración inicial</p>
                                                </div>
                                            </div>

                                            {/* Reproceso */}
                                            <div className="glass p-5 rounded-2xl border border-white/10 flex flex-col justify-between min-h-[120px] bg-gradient-to-br from-white/5 to-transparent">
                                                <div className="flex justify-between items-start text-gray-400">
                                                    <span className="text-[10px] font-black uppercase tracking-widest">REPROCESO</span>
                                                    <AlertTriangle className="h-5 w-5 text-danger-red" />
                                                </div>
                                                <div className="mt-3">
                                                    <h3 className="text-xl font-black text-white tracking-tight">{formatDuration(totalReprocesoSeconds)}</h3>
                                                    <p className="text-[9px] text-gray-500 font-bold uppercase mt-1">Re-trabajo en línea</p>
                                                </div>
                                            </div>

                                            {/* Pausas */}
                                            <div className="glass p-5 rounded-2xl border border-white/10 flex flex-col justify-between min-h-[120px] bg-gradient-to-br from-white/5 to-transparent">
                                                <div className="flex justify-between items-start text-gray-400">
                                                    <span className="text-[10px] font-black uppercase tracking-widest">TIEMPO PAUSAS</span>
                                                    <Pause className="h-5 w-5 text-warning-yellow" />
                                                </div>
                                                <div className="mt-3">
                                                    <h3 className="text-xl font-black text-white tracking-tight">{formatDuration(totalPauseSeconds)}</h3>
                                                    <p className="text-[9px] text-gray-500 font-bold uppercase mt-1">Retrasos e interrupciones</p>
                                                </div>
                                            </div>

                                            {/* Calidad Detalle */}
                                            <div className="glass p-5 rounded-2xl border border-white/10 flex flex-col justify-between min-h-[120px] bg-gradient-to-br from-white/5 to-transparent col-span-1">
                                                <div className="flex justify-between items-start text-gray-400 mb-1">
                                                    <span className="text-[10px] font-black uppercase tracking-widest">TIEMPOS CALIDAD</span>
                                                    <ShieldCheck className="h-5 w-5 text-success-green" />
                                                </div>
                                                <div className="space-y-1 mt-1 text-[11px] font-bold">
                                                    <div className="flex justify-between text-gray-400">
                                                        <span>ESPERA:</span>
                                                        <span className="text-white font-mono">{formatDuration(totalQualityWaitingSeconds)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-gray-400">
                                                        <span>APROBACIÓN:</span>
                                                        <span className="text-white font-mono">{formatDuration(totalQualityInspectionSeconds)}</span>
                                                    </div>
                                                </div>
                                            </div>

                                        </div>

                                        {/* Tiempos Efectivos de la OP */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="glass p-5 rounded-2xl border border-white/10 flex items-center gap-4 bg-gradient-to-br from-success-green/5 to-transparent">
                                                <div className="p-3 bg-success-green/10 rounded-xl text-success-green border border-success-green/20">
                                                    <Clock className="h-6 w-6" />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">TIEMPO EFECTIVO PROCESO (LINEAL)</p>
                                                    <h3 className="text-xl font-black text-white mt-1">{formatDuration(totalOPEffectiveProcessSeconds)}</h3>
                                                    <p className="text-[9px] text-gray-500 font-bold uppercase mt-0.5">Tiempo total de corrida (excluye pausas)</p>
                                                </div>
                                            </div>

                                            <div className="glass p-5 rounded-2xl border border-white/10 flex items-center gap-4 bg-gradient-to-br from-primary-blue/5 to-transparent">
                                                <div className="p-3 bg-primary-blue/10 rounded-xl text-primary-blue border border-primary-blue/20">
                                                    <Users className="h-6 w-6" />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">TIEMPO EFECTIVO HORAS-HOMBRE</p>
                                                    <h3 className="text-xl font-black text-white mt-1">{formatDuration(totalOPEffectiveHHSeconds)}</h3>
                                                    <p className="text-[9px] text-gray-500 font-bold uppercase mt-0.5">Esfuerzo real de mano de obra en marcha</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Detalle de Pausas por Motivo */}
                                        <div className="glass p-6 rounded-3xl border border-white/10 bg-white/5 space-y-6">
                                            <h3 className="text-lg font-black uppercase text-warning-yellow flex items-center gap-2">
                                                <Pause className="h-5 w-5" /> DESGLOSE DETALLADO DE PAUSAS Y TIEMPOS MUERTOS
                                            </h3>
                                            
                                            {Object.keys(pauseDurationsByReason).length === 0 ? (
                                                <p className="text-sm text-gray-500 italic text-center py-6">No se registraron interrupciones o pausas en esta orden de producción.</p>
                                            ) : (
                                                <div className="space-y-4">
                                                    {Object.entries(pauseDurationsByReason)
                                                        .sort((a, b) => b[1] - a[1]) // Sort descending by duration
                                                        .map(([reason, seconds]) => {
                                                            const percentage = totalPauseSeconds > 0 ? (seconds / totalPauseSeconds) * 100 : 0;
                                                            return (
                                                                <div key={reason} className="space-y-2">
                                                                    <div className="flex justify-between items-center text-xs lg:text-sm font-bold">
                                                                        <span className="text-white uppercase tracking-tight">{reason}</span>
                                                                        <span className="text-warning-yellow font-mono font-black">{formatDuration(seconds)} ({percentage.toFixed(1)}%)</span>
                                                                    </div>
                                                                    <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden border border-white/5">
                                                                        <div 
                                                                            className="bg-warning-yellow h-full rounded-full transition-all duration-500" 
                                                                            style={{ width: `${percentage}%` }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                </div>
                                            )}
                                        </div>

                                        {/* Comentarios de la OP */}
                                        <div className="glass p-6 rounded-3xl border border-white/10 bg-white/5">
                                            <h3 className="text-lg font-black uppercase text-primary-blue mb-4 flex items-center gap-2">
                                                <MessageSquare className="h-5 w-5" /> OBSERVACIONES Y COMENTARIOS REGISTRADOS
                                            </h3>
                                            {resumenComentarios.length === 0 ? (
                                                <p className="text-sm text-gray-500 italic text-center py-6">No hay comentarios u observaciones registrados para esta orden.</p>
                                            ) : (
                                                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                                                    {resumenComentarios.map(com => (
                                                        <div key={com.id} className="flex justify-between items-start border-b border-white/5 py-4 last:border-0 hover:bg-white/[0.02] px-3 rounded-2xl transition-all">
                                                            <div>
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <span className="text-[9px] font-black text-primary-blue bg-primary-blue/15 px-2 py-0.5 rounded-lg border border-primary-blue/20 uppercase tracking-widest">{com.etapa}</span>
                                                                    <span className="text-[10px] font-bold text-gray-500 font-mono">
                                                                        {com.creadoEn ? format((com.creadoEn as any).toDate(), 'dd/MM/yyyy HH:mm:ss') : 'Reciente'}
                                                                    </span>
                                                                </div>
                                                                <div className="space-y-1">
                                                                    {com.correcciones && com.correcciones.map((corr: any, idx: number) => (
                                                                        <div key={idx} className="mb-1.5 last:mb-0 border-l border-white/10 pl-2">
                                                                            <div className="text-xs text-white/50 line-through leading-relaxed italic">
                                                                                "{corr.comentarioAnterior}"
                                                                            </div>
                                                                            <p className="text-[8px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">
                                                                                Corregido: {corr.fechaCorreccion ? format((corr.fechaCorreccion as any).toDate(), 'dd/MM/yyyy HH:mm:ss') : 'Reciente'} por {corr.nombreColaborador} • Motivo: {corr.motivo || 'Sin especificar'}
                                                                            </p>
                                                                        </div>
                                                                    ))}
                                                                    <p className="text-sm text-gray-200 font-medium leading-relaxed italic">"{com.comentario}"</p>
                                                                    {com.correcciones && com.correcciones.length > 0 && (
                                                                        <p className="text-[9px] text-warning-yellow font-black uppercase tracking-[0.2em] mt-1 border-l border-warning-yellow/30 pl-2">
                                                                            Última corrección por: {com.correcciones[com.correcciones.length - 1].nombreColaborador} (ID: {com.correcciones[com.correcciones.length - 1].colaboradorId}) • Motivo: {com.correcciones[com.correcciones.length - 1].motivo}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                <p className="text-[10px] text-gray-600 font-bold uppercase mt-1 tracking-tighter">Registrado por: {com.nombreColaborador} (PIN/ID: {com.colaboradorId})</p>
                                                            </div>
                                                            <button
                                                                onClick={() => setCorrectionModal({ show: true, comentario: com })}
                                                                className="p-2 hover:bg-warning-yellow/10 text-warning-yellow rounded-xl transition-all ml-4 shrink-0"
                                                                title="Corregir comentario (Audit Trail)"
                                                            >
                                                                <Edit2 className="h-5 w-5" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Detalle por Etapas */}
                                        <div className="space-y-6">
                                            <h3 className="text-xl font-black uppercase tracking-tight text-white">Desglose por Etapa</h3>
                                            
                                            {procesosOP.map(p => {
                                                // Specific process values
                                                const procLogs = resumenLogs.filter(l => l.procesoId === p.id);
                                                
                                                // Process pause seconds
                                                let procPauseSeconds = 0;
                                                let procPauseStart: number | null = null;
                                                const procEvents = resumenEvents
                                                    .filter(evt => evt.procesoId === p.id)
                                                    .sort((a, b) => (a.horaEvento?.seconds || 0) - (b.horaEvento?.seconds || 0));
                                                    
                                                procEvents.forEach(evt => {
                                                    const eventText = (evt.evento || "").toUpperCase();
                                                    const timeMs = evt.horaEvento?.toMillis?.() || evt.horaEvento?.seconds * 1000 || 0;
                                                    if (eventText.includes('PAUSA')) {
                                                        procPauseStart = timeMs;
                                                    } else if (eventText.includes('REANUDA') && procPauseStart) {
                                                        procPauseSeconds += Math.floor((timeMs - procPauseStart) / 1000);
                                                        procPauseStart = null;
                                                    }
                                                });
                                                if (procPauseStart && p.estado === 'Pausado') {
                                                    procPauseSeconds += Math.floor((Date.now() - procPauseStart) / 1000);
                                                }

                                                // Process quality times
                                                const qCall = p.calidadLlamadaEn?.toMillis?.() || p.calidadLlamadaEn?.seconds * 1000 || 0;
                                                const qArrival = p.calidadLlegadaEn?.toMillis?.() || p.calidadLlegadaEn?.seconds * 1000 || 0;
                                                const qApproval = p.calidadAprobadaEn?.toMillis?.() || p.calidadAprobadaEn?.seconds * 1000 || 0;
                                                
                                                let procQualityWaiting = 0;
                                                let procQualityInspection = 0;
                                                if (qCall > 0 && qArrival > 0) procQualityWaiting = Math.floor((qArrival - qCall) / 1000);
                                                else if (qCall > 0 && p.calidadEstado === 'esperando') procQualityWaiting = Math.floor((Date.now() - qCall) / 1000);
                                                
                                                if (qArrival > 0 && qApproval > 0) procQualityInspection = Math.floor((qApproval - qArrival) / 1000);
                                                else if (qArrival > 0 && p.calidadEstado === 'inspeccion') procQualityInspection = Math.floor((Date.now() - qArrival) / 1000);

                                                // Process progress and efficiency
                                                const progressPercentage = p.cantidadProducir > 0 ? Math.min(100, (p.trabajoCompletado / p.cantidadProducir) * 100) : 0;
                                                const efficiency = p.velocidadTeorica > 0 ? ((p.trabajoCompletado / (p.cantidadProducir || 1)) * 100) : 0;

                                                return (
                                                    <div key={p.id} className="glass p-6 rounded-3xl border border-white/10 space-y-6">
                                                        
                                                        {/* Stage Title and Status */}
                                                        <div className="flex flex-wrap justify-between items-center gap-4 border-b border-white/5 pb-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="h-3 w-3 rounded-full bg-primary-blue animate-pulse" />
                                                                <h4 className="text-lg font-black uppercase text-white tracking-wider">{p.etapa || 'SIN ETAPA'}</h4>
                                                            </div>
                                                            <div className="flex items-center gap-4">
                                                                <span className={cn(
                                                                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                                                                    p.estado === 'Finalizado' && "bg-success-green/10 border-success-green/20 text-success-green",
                                                                    p.estado === 'Iniciado' && "bg-primary-blue/10 border-primary-blue/20 text-primary-blue animate-pulse",
                                                                    p.estado === 'Pausado' && "bg-warning-yellow/10 border-warning-yellow/20 text-warning-yellow",
                                                                    p.estado === 'Creado' && "bg-gray-500/10 border-gray-500/20 text-gray-400"
                                                                )}>
                                                                    {p.estado}
                                                                </span>
                                                                <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">
                                                                    Líder: <strong className="text-gray-300">{p.lider || 'N/A'}</strong>
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Stage Details Grid */}
                                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                                            
                                                            {/* Progress and quantities */}
                                                            <div className="space-y-2">
                                                                <div className="flex justify-between text-xs font-black uppercase tracking-widest text-gray-500">
                                                                    <span>PROGRESO DE PRODUCCIÓN</span>
                                                                    <span className="text-white">{progressPercentage.toFixed(1)}%</span>
                                                                </div>
                                                                <div className="w-full bg-white/5 rounded-full h-3 overflow-hidden border border-white/5">
                                                                    <div 
                                                                        className="bg-primary-blue h-full rounded-full transition-all duration-500"
                                                                        style={{ width: `${progressPercentage}%` }}
                                                                    />
                                                                </div>
                                                                <p className="text-[10px] font-bold text-gray-400 uppercase">
                                                                    Completado: <span className="font-mono text-white">{p.trabajoCompletado}</span> / <span className="font-mono text-white">{p.cantidadProducir}</span> uds
                                                                </p>
                                                            </div>

                                                            {/* Efficiency */}
                                                            <div className="space-y-1">
                                                                <p className="text-xs font-black uppercase tracking-widest text-gray-500">EFICIENCIA DEL PROCESO</p>
                                                                <h3 className="text-2xl font-black text-success-green">{efficiency.toFixed(1)}%</h3>
                                                                <p className="text-[9px] font-bold text-gray-400 uppercase">Basada en velocidad teórica</p>
                                                            </div>

                                                            {/* Production Times Breakdown */}
                                                            <div className="space-y-1 text-xs">
                                                                <p className="font-black uppercase tracking-widest text-gray-500 mb-1">Tiempos Productivos</p>
                                                                <div className="flex justify-between font-bold text-gray-400">
                                                                    <span>SETUP:</span>
                                                                    <span className="text-white font-mono">{formatDuration(p.tiempoSetupSegundos || 0)}</span>
                                                                </div>
                                                                <div className="flex justify-between font-bold text-gray-400">
                                                                    <span>REPROCESO:</span>
                                                                    <span className="text-white font-mono">{formatDuration(p.tiempoReprocesoSegundos || 0)}</span>
                                                                </div>
                                                                <div className="flex justify-between font-bold text-gray-400">
                                                                    <span>PAUSAS:</span>
                                                                    <span className="text-white font-mono">{formatDuration(procPauseSeconds)}</span>
                                                                </div>
                                                                <div className="flex justify-between font-bold text-success-green border-t border-white/5 pt-1 mt-1">
                                                                    <span>EFECTIVO PROCESO:</span>
                                                                    <span className="font-mono">{formatDuration(p._effectiveProcessSeconds || 0)}</span>
                                                                </div>
                                                                <div className="flex justify-between font-bold text-primary-blue">
                                                                    <span>EFECTIVO H-H:</span>
                                                                    <span className="font-mono">{formatDuration(p._effectiveHHSeconds || 0)}</span>
                                                                </div>
                                                            </div>

                                                            {/* Quality Times Breakdown */}
                                                            <div className="space-y-1 text-xs">
                                                                <p className="font-black uppercase tracking-widest text-gray-500 mb-1">Tiempos de Calidad</p>
                                                                <div className="flex justify-between font-bold text-gray-400">
                                                                    <span>ESPERA CALIDAD:</span>
                                                                    <span className="text-white font-mono">{formatDuration(procQualityWaiting)}</span>
                                                                </div>
                                                                <div className="flex justify-between font-bold text-gray-400">
                                                                    <span>INSPECCIÓN:</span>
                                                                    <span className="text-white font-mono">{formatDuration(procQualityInspection)}</span>
                                                                </div>
                                                            </div>

                                                        </div>

                                                        {/* Personnel logs for this stage */}
                                                        <div className="space-y-3">
                                                            <p className="text-xs font-black uppercase tracking-widest text-gray-500">Historial de Personal en esta Etapa</p>
                                                            {procLogs.length === 0 ? (
                                                                <p className="text-xs text-gray-500 italic py-2">No hay registros de ingreso de personal para esta etapa.</p>
                                                            ) : (
                                                                <div className="glass rounded-2xl overflow-hidden border border-white/5 bg-black/20">
                                                                    <table className="w-full text-left text-xs">
                                                                        <thead>
                                                                            <tr className="bg-white/5 border-b border-white/5 text-[9px] font-black uppercase text-gray-500 tracking-wider">
                                                                                <th className="p-3">Colaborador</th>
                                                                                <th className="p-3">Tipo Registro</th>
                                                                                <th className="p-3">Ingreso</th>
                                                                                <th className="p-3">Salida</th>
                                                                                <th className="p-3 text-right">Duración Trabajada</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y divide-white/5 text-gray-300 font-medium">
                                                                            {procLogs.map(log => {
                                                                                const entryDate = log.horaIngreso?.toDate?.() || (log.horaIngreso?.seconds ? new Date(log.horaIngreso.seconds * 1000) : null);
                                                                                const exitDate = log.horaSalida?.toDate?.() || (log.horaSalida?.seconds ? new Date(log.horaSalida.seconds * 1000) : null);
                                                                                
                                                                                let durSec = 0;
                                                                                if (entryDate && exitDate) {
                                                                                    durSec = Math.floor((exitDate.getTime() - entryDate.getTime()) / 1000);
                                                                                } else if (entryDate && p.estado === 'Iniciado') {
                                                                                    durSec = Math.floor((Date.now() - entryDate.getTime()) / 1000);
                                                                                }

                                                                                return (
                                                                                    <tr key={log.id} className="hover:bg-white/[0.01]">
                                                                                        <td className="p-3 uppercase font-bold text-white">{log.nombre || log.nombreColaborador}</td>
                                                                                        <td className="p-3">
                                                                                            <span className={cn(
                                                                                                "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border",
                                                                                                log.tipo === 'setup' ? "bg-accent-purple/10 border-accent-purple/20 text-accent-purple" : "bg-primary-blue/10 border-primary-blue/20 text-primary-blue"
                                                                                            )}>
                                                                                                {log.tipo || 'colaborador'}
                                                                                            </span>
                                                                                        </td>
                                                                                        <td className="p-3 font-mono">{entryDate ? format(entryDate, 'dd/MM/yyyy HH:mm:ss') : '-'}</td>
                                                                                        <td className="p-3 font-mono">
                                                                                            {exitDate ? format(exitDate, 'dd/MM/yyyy HH:mm:ss') : (log.horaSalida === null ? <span className="text-success-green animate-pulse">ACTIVO</span> : '-')}
                                                                                        </td>
                                                                                        <td className="p-3 text-right font-mono font-bold text-white">
                                                                                            {durSec > 0 ? formatDuration(durSec) : '-'}
                                                                                        </td>
                                                                                    </tr>
                                                                                );
                                                                            })}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            )}
                                                        </div>

                                                    </div>
                                                );
                                            })}
                                        </div>

                                    </div>
                                );
                            })()
                        )}
                    </>
                )}

                {/* TAB: REPORTE POR RANGO DE FECHAS */}
                {tab === 'reporteFechas' && (
                    <>
                        <div className="mb-10 text-center animate-in fade-in duration-300">
                            <h2 className="text-3xl font-black uppercase tracking-tight text-accent-purple mb-4">Reporte de Planta por Fechas</h2>
                            <p className="text-gray-400 font-medium text-sm">Análisis consolidado de productividad, tiempos activos, pausas, esperas de calidad y colaboradores</p>
                        </div>

                        {/* Date Filters Card */}
                        <div className="glass p-8 rounded-[2.5rem] border border-white/10 shadow-2xl mb-8 flex flex-col gap-6 max-w-3xl mx-auto bg-white/5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-[0.2em] text-gray-500 mb-2">Fecha de Inicio</label>
                                    <input
                                        type="date"
                                        value={reportStartDate}
                                        onChange={(e) => setReportStartDate(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white font-bold outline-none focus:ring-2 focus:ring-accent-purple transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-[0.2em] text-gray-500 mb-2">Fecha de Fin</label>
                                    <input
                                        type="date"
                                        value={reportEndDate}
                                        onChange={(e) => setReportEndDate(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white font-bold outline-none focus:ring-2 focus:ring-accent-purple transition-all"
                                    />
                                </div>
                            </div>

                            {/* Quick Presets */}
                            <div className="flex flex-wrap gap-3 justify-center">
                                <button
                                    onClick={() => setQuickRange('this-week')}
                                    className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-black uppercase tracking-wider text-gray-300 transition-all"
                                >
                                    Esta Semana
                                </button>
                                <button
                                    onClick={() => setQuickRange('last-week')}
                                    className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-black uppercase tracking-wider text-gray-300 transition-all"
                                >
                                    Semana Pasada
                                </button>
                                <button
                                    onClick={() => setQuickRange('this-month')}
                                    className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-black uppercase tracking-wider text-gray-300 transition-all"
                                >
                                    Este Mes
                                </button>
                                <button
                                    onClick={() => setQuickRange('last-month')}
                                    className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-black uppercase tracking-wider text-gray-300 transition-all"
                                >
                                    Mes Pasado
                                </button>
                            </div>

                            {/* Submit Button */}
                            <button
                                onClick={handleGenerateRangeReport}
                                disabled={isGeneratingRangeReport}
                                className="w-full bg-accent-purple text-white py-4 rounded-2xl font-black text-lg hover:bg-purple-600 transition-all flex items-center justify-center gap-3 shadow-lg shadow-purple-500/20 disabled:opacity-50"
                            >
                                <RefreshCw className={cn("h-5 w-5", isGeneratingRangeReport && "animate-spin")} />
                                {isGeneratingRangeReport ? "CONSULTANDO..." : "GENERAR CONSOLIDADO"}
                            </button>
                        </div>

                        {/* Report Output Content */}
                        {rangeReportData && (() => {
                            const { processes, logs, events, comments } = rangeReportData;

                            if (processes.length === 0) {
                                return (
                                    <div className="text-center py-20 text-gray-500 font-bold uppercase tracking-widest italic animate-in fade-in duration-300">
                                        No se encontraron procesos registrados en este rango de fechas.
                                    </div>
                                );
                            }

                            // Calculate Consolidated Stats
                            const totalOPs = new Set(processes.map(p => p.ordenProduccion).filter(op => op !== 'N/A')).size;
                            const totalUnitsProduced = processes.reduce((sum, p) => sum + (p.trabajoCompletado || 0), 0);

                            const totalSetupSeconds = processes.reduce((sum, p) => sum + (p.tiempoSetupSegundos || 0), 0);
                            const totalReprocesoSeconds = processes.reduce((sum, p) => sum + (p.tiempoReprocesoSegundos || 0), 0);

                            // Pauses grouped by reason
                            let totalPauseSeconds = 0;
                            const pauseReasons: Record<string, { count: number; duration: number }> = {};

                            processes.forEach(p => {
                                const pEvents = events.filter(e => e.procesoId === p.id).sort((a, b) => {
                                    const timeA = a.horaEvento?.toMillis?.() || a.horaEvento?.seconds * 1000 || 0;
                                    const timeB = b.horaEvento?.toMillis?.() || b.horaEvento?.seconds * 1000 || 0;
                                    return timeA - timeB;
                                });

                                let pauseStart: number | null = null;
                                let lastJustification = 'Sin justificar';

                                pEvents.forEach(evt => {
                                    const eventText = (evt.evento || "").toUpperCase();
                                    const timeMs = evt.horaEvento?.toMillis?.() || evt.horaEvento?.seconds * 1000 || 0;

                                    if (eventText.includes('PAUSA')) {
                                        pauseStart = timeMs;
                                        lastJustification = evt.justificacion || 'Sin justificar';
                                        const isAcumulado = lastJustification.toUpperCase().includes('ACUMULADO');
                                        if (!isAcumulado) {
                                            if (!pauseReasons[lastJustification]) {
                                                pauseReasons[lastJustification] = { count: 0, duration: 0 };
                                            }
                                            pauseReasons[lastJustification].count += 1;
                                        } else {
                                            lastJustification = '';
                                        }
                                    } else if (eventText.includes('REANUDA') && pauseStart) {
                                        const duration = Math.floor((timeMs - pauseStart) / 1000);
                                        totalPauseSeconds += duration;
                                        if (lastJustification && pauseReasons[lastJustification]) {
                                            pauseReasons[lastJustification].duration += duration;
                                        }
                                        pauseStart = null;
                                    }
                                });

                                if (pauseStart && p.estado === 'Pausado') {
                                    const duration = Math.floor((Date.now() - pauseStart) / 1000);
                                    totalPauseSeconds += duration;
                                    if (lastJustification && pauseReasons[lastJustification]) {
                                        pauseReasons[lastJustification].duration += duration;
                                    }
                                }
                            });

                            // Quality times
                            let totalQualityWaitingSeconds = 0;
                            let totalQualityInspectionSeconds = 0;
                            
                            processes.forEach(p => {
                                const call = p.calidadLlamadaEn?.toMillis?.() || p.calidadLlamadaEn?.seconds * 1000 || 0;
                                const arrival = p.calidadLlegadaEn?.toMillis?.() || p.calidadLlegadaEn?.seconds * 1000 || 0;
                                const approval = p.calidadAprobadaEn?.toMillis?.() || p.calidadAprobadaEn?.seconds * 1000 || 0;
                                
                                if (call > 0 && arrival > 0) {
                                    totalQualityWaitingSeconds += Math.floor((arrival - call) / 1000);
                                } else if (call > 0 && p.calidadEstado === 'esperando') {
                                    totalQualityWaitingSeconds += Math.floor((Date.now() - call) / 1000);
                                }
                                
                                if (arrival > 0 && approval > 0) {
                                    totalQualityInspectionSeconds += Math.floor((approval - arrival) / 1000);
                                } else if (arrival > 0 && p.calidadEstado === 'inspeccion') {
                                    totalQualityInspectionSeconds += Math.floor((Date.now() - arrival) / 1000);
                                }
                            });

                            // Operator log hours
                            const operatorHours: Record<string, { totalSeconds: number; type: string }> = {};
                            logs.forEach(log => {
                                const entry = log.horaIngreso?.toMillis?.() || log.horaIngreso?.seconds * 1000 || 0;
                                const exit = log.horaSalida?.toMillis?.() || log.horaSalida?.seconds * 1000 || 0;
                                
                                let duration = 0;
                                if (entry && exit) {
                                    duration = Math.floor((exit - entry) / 1000);
                                } else if (entry && processes.some(p => p.id === log.procesoId && p.estado === 'Iniciado')) {
                                    duration = Math.floor((Date.now() - entry) / 1000);
                                }

                                const name = log.nombre || log.nombreColaborador || 'Desconocido';
                                if (!operatorHours[name]) {
                                    operatorHours[name] = { totalSeconds: 0, type: log.tipo === 'apoyo' ? 'Apoyo' : 'Base' };
                                }
                                operatorHours[name].totalSeconds += duration;
                            });

                            let totalProductiveSeconds = 0;
                            Object.values(operatorHours).forEach(op => {
                                totalProductiveSeconds += op.totalSeconds;
                            });

                            // Group stats by OP (Global & Etapa)
                            const opMap: Record<string, any> = {};

                            processes.forEach(p => {
                                const op = p.ordenProduccion || 'N/A';
                                if (!opMap[op]) {
                                    opMap[op] = {
                                        ordenProduccion: op,
                                        producto: p.producto || 'N/A',
                                        articulo: p.articulo || 'N/A',
                                        trabajoCompletado: 0,
                                        setupSeconds: 0,
                                        pauseSeconds: 0,
                                        directSeconds: 0,
                                        qualityWaitSeconds: 0,
                                        qualityInspectionSeconds: 0,
                                        etapas: {}
                                    };
                                }

                                const opStat = opMap[op];
                                opStat.trabajoCompletado += p.trabajoCompletado || 0;
                                opStat.setupSeconds += p.tiempoSetupSegundos || 0;

                                const call = p.calidadLlamadaEn?.toMillis?.() || p.calidadLlamadaEn?.seconds * 1000 || 0;
                                const arrival = p.calidadLlegadaEn?.toMillis?.() || p.calidadLlegadaEn?.seconds * 1000 || 0;
                                const approval = p.calidadAprobadaEn?.toMillis?.() || p.calidadAprobadaEn?.seconds * 1000 || 0;
                                
                                let pQualityWait = 0;
                                let pQualityInsp = 0;

                                if (call > 0 && arrival > 0) {
                                    pQualityWait = Math.floor((arrival - call) / 1000);
                                } else if (call > 0 && p.calidadEstado === 'esperando') {
                                    pQualityWait = Math.floor((Date.now() - call) / 1000);
                                }
                                
                                if (arrival > 0 && approval > 0) {
                                    pQualityInsp = Math.floor((approval - arrival) / 1000);
                                } else if (arrival > 0 && p.calidadEstado === 'inspeccion') {
                                    pQualityInsp = Math.floor((Date.now() - arrival) / 1000);
                                }

                                opStat.qualityWaitSeconds += pQualityWait;
                                opStat.qualityInspectionSeconds += pQualityInsp;

                                const pEvents = events.filter(e => e.procesoId === p.id).sort((a, b) => {
                                    const timeA = a.horaEvento?.toMillis?.() || a.horaEvento?.seconds * 1000 || 0;
                                    const timeB = b.horaEvento?.toMillis?.() || b.horaEvento?.seconds * 1000 || 0;
                                    return timeA - timeB;
                                });

                                let pPauseSec = 0;
                                let pauseStart: number | null = null;
                                pEvents.forEach(evt => {
                                    const eventText = (evt.evento || "").toUpperCase();
                                    const timeMs = evt.horaEvento?.toMillis?.() || evt.horaEvento?.seconds * 1000 || 0;

                                    if (eventText.includes('PAUSA')) {
                                        pauseStart = timeMs;
                                    } else if (eventText.includes('REANUDA') && pauseStart) {
                                        pPauseSec += Math.floor((timeMs - pauseStart) / 1000);
                                        pauseStart = null;
                                    }
                                });
                                if (pauseStart && p.estado === 'Pausado') {
                                    pPauseSec += Math.floor((Date.now() - pauseStart) / 1000);
                                }
                                opStat.pauseSeconds += pPauseSec;

                                const et = p.etapa || 'Desconocida';
                                if (!opStat.etapas[et]) {
                                    opStat.etapas[et] = {
                                        etapa: et,
                                        trabajoCompletado: 0,
                                        setupSeconds: 0,
                                        pauseSeconds: 0,
                                        directSeconds: 0,
                                        qualityWaitSeconds: 0,
                                        qualityInspectionSeconds: 0
                                    };
                                }
                                const etStat = opStat.etapas[et];
                                etStat.trabajoCompletado += p.trabajoCompletado || 0;
                                etStat.setupSeconds += p.tiempoSetupSegundos || 0;
                                etStat.qualityWaitSeconds += pQualityWait;
                                etStat.qualityInspectionSeconds += pQualityInsp;
                                etStat.pauseSeconds += pPauseSec;
                            });

                            logs.forEach(log => {
                                const entry = log.horaIngreso?.toMillis?.() || log.horaIngreso?.seconds * 1000 || 0;
                                const exit = log.horaSalida?.toMillis?.() || log.horaSalida?.seconds * 1000 || 0;
                                
                                let duration = 0;
                                if (entry && exit) {
                                    duration = Math.floor((exit - entry) / 1000);
                                } else if (entry && processes.some(p => p.id === log.procesoId && p.estado === 'Iniciado')) {
                                    duration = Math.floor((Date.now() - entry) / 1000);
                                }

                                if (duration > 0) {
                                    const proc = processes.find(p => p.id === log.procesoId);
                                    if (proc) {
                                        const op = proc.ordenProduccion || 'N/A';
                                        if (opMap[op]) {
                                            opMap[op].directSeconds += duration;
                                            const et = proc.etapa || 'Desconocida';
                                            if (opMap[op].etapas[et]) {
                                                opMap[op].etapas[et].directSeconds += duration;
                                            }
                                        }
                                    }
                                }
                            });

                            const listOps = Object.values(opMap);

                            const stats = {
                                totalOPs,
                                totalUnitsProduced,
                                totalSetupSeconds,
                                totalReprocesoSeconds,
                                totalPauseSeconds,
                                totalQualityWaitingSeconds,
                                totalQualityInspectionSeconds,
                                totalProductiveSeconds,
                                pauseReasons,
                                operatorHours,
                                listOps
                            };

                            const formatDuration = (seconds: number) => {
                                if (seconds < 0) return '0s';
                                const h = Math.floor(seconds / 3600);
                                const m = Math.floor((seconds % 3600) / 60);
                                return `${h}h ${m}m`;
                            };

                            return (
                                <div className="space-y-10 animate-in fade-in duration-500">
                                    
                                    {/* Action PDF Button */}
                                    <div className="flex justify-end">
                                        <button
                                            onClick={() => generateRangeReportPDF(stats)}
                                            className="flex items-center gap-2 bg-success-green text-black px-6 py-3 rounded-xl font-black transition-all shadow-lg hover:bg-green-600 uppercase tracking-widest text-xs"
                                        >
                                            <FileText className="h-4 w-4" /> Exportar Reporte Consolidado a PDF
                                        </button>
                                    </div>

                                    {/* EXECUTIVE METRICS CARDS */}
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                        {/* OP processed */}
                                        <div className="glass p-6 rounded-3xl border border-white/10 bg-white/5 flex flex-col justify-between">
                                            <p className="text-[10px] font-black uppercase text-gray-500 tracking-wider">OPs Procesadas</p>
                                            <h3 className="text-3xl font-black text-white mt-4">{totalOPs} OP(s)</h3>
                                            <p className="text-[10px] text-gray-400 mt-2 font-medium">Órdenes distintas iniciadas</p>
                                        </div>

                                        {/* Produced Units */}
                                        <div className="glass p-6 rounded-3xl border border-white/10 bg-white/5 flex flex-col justify-between">
                                            <p className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Unidades Producidas</p>
                                            <h3 className="text-3xl font-black text-white mt-4">{totalUnitsProduced.toLocaleString()} Uds</h3>
                                            <p className="text-[10px] text-gray-400 mt-2 font-medium">Total de volumen finalizado</p>
                                        </div>

                                        {/* Productive hours */}
                                        <div className="glass p-6 rounded-3xl border border-white/10 bg-white/5 flex flex-col justify-between">
                                            <p className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Horas-Hombre Directas</p>
                                            <h3 className="text-3xl font-black text-white mt-4">{formatDuration(totalProductiveSeconds)}</h3>
                                            <p className="text-[10px] text-gray-400 mt-2 font-medium">Suma de permanencia de personal</p>
                                        </div>

                                        {/* Pauses Time */}
                                        <div className="glass p-6 rounded-3xl border border-white/10 bg-white/5 flex flex-col justify-between">
                                            <p className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Tiempo Perdido Pausas</p>
                                            <h3 className="text-3xl font-black text-danger-red mt-4">{formatDuration(totalPauseSeconds)}</h3>
                                            <p className="text-[10px] text-gray-400 mt-2 font-medium">Tiempo muerto acumulado</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        {/* Setup time card */}
                                        <div className="glass p-6 rounded-3xl border border-white/10 bg-white/5 text-center">
                                            <p className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Ajuste de Máquinas (Setup)</p>
                                            <h4 className="text-2xl font-black text-accent-purple mt-2">{formatDuration(totalSetupSeconds)}</h4>
                                        </div>

                                        {/* Reproceso time card */}
                                        <div className="glass p-6 rounded-3xl border border-white/10 bg-white/5 text-center">
                                            <p className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Trabajo de Reproceso</p>
                                            <h4 className="text-2xl font-black text-warning-yellow mt-2">{formatDuration(totalReprocesoSeconds)}</h4>
                                        </div>

                                        {/* Quality waiting time card */}
                                        <div className="glass p-6 rounded-3xl border border-white/10 bg-white/5 text-center">
                                            <p className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Espera + Inspección Calidad</p>
                                            <h4 className="text-2xl font-black text-primary-blue mt-2">
                                                {formatDuration(totalQualityWaitingSeconds + totalQualityInspectionSeconds)}
                                            </h4>
                                            <p className="text-[9px] text-gray-500 font-bold uppercase mt-1">
                                                Espera: {formatDuration(totalQualityWaitingSeconds)} • Insp: {formatDuration(totalQualityInspectionSeconds)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* RENDIMIENTO POR ORDEN DE PRODUCCIÓN Y ETAPAS */}
                                    <div className="glass rounded-[2rem] border border-white/10 overflow-hidden bg-white/5 p-6 space-y-4">
                                        <h3 className="text-lg font-black uppercase tracking-wider text-primary-blue flex items-center gap-2">
                                            <ClipboardList className="h-5 w-5" /> RENDIMIENTO POR ORDEN DE PRODUCCIÓN Y ETAPAS
                                        </h3>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-xs">
                                                <thead>
                                                    <tr className="border-b border-white/10 text-[10px] font-black uppercase text-gray-500 tracking-wider">
                                                        <th className="pb-3 w-1/3">Orden / Producto</th>
                                                        <th className="pb-3 text-right">Producción</th>
                                                        <th className="pb-3 text-right">H-H Directas</th>
                                                        <th className="pb-3 text-right">Setup</th>
                                                        <th className="pb-3 text-right">Pausas</th>
                                                        <th className="pb-3 text-right">Calidad</th>
                                                        <th className="pb-3 text-center">Desglose</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5 text-gray-300 font-medium">
                                                    {listOps.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={7} className="py-6 text-center text-gray-500 italic">No hay órdenes procesadas en este rango</td>
                                                        </tr>
                                                    ) : (
                                                        listOps.map(op => {
                                                            const isExpanded = !!expandedOPs[op.ordenProduccion];
                                                            return (
                                                                <React.Fragment key={op.ordenProduccion}>
                                                                    {/* OP Row (Global) */}
                                                                    <tr className="hover:bg-white/[0.02] bg-white/[0.01]">
                                                                        <td className="py-4 pr-4">
                                                                            <div className="font-black text-white text-sm uppercase">OP: {op.ordenProduccion}</div>
                                                                            <div className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">
                                                                                Art: {op.articulo} | {op.producto}
                                                                            </div>
                                                                        </td>
                                                                        <td className="py-4 text-right font-bold text-white font-mono">{op.trabajoCompletado.toLocaleString()} Uds</td>
                                                                        <td className="py-4 text-right font-bold text-gray-300 font-mono">{formatDuration(op.directSeconds)}</td>
                                                                        <td className="py-4 text-right font-bold text-gray-400 font-mono">{formatDuration(op.setupSeconds)}</td>
                                                                        <td className="py-4 text-right font-bold text-danger-red font-mono">{formatDuration(op.pauseSeconds)}</td>
                                                                        <td className="py-4 text-right font-bold text-primary-blue font-mono">
                                                                            {formatDuration(op.qualityWaitSeconds + op.qualityInspectionSeconds)}
                                                                        </td>
                                                                        <td className="py-4 text-center">
                                                                            <button
                                                                                onClick={() => {
                                                                                    setExpandedOPs(prev => ({
                                                                                        ...prev,
                                                                                        [op.ordenProduccion]: !prev[op.ordenProduccion]
                                                                                    }));
                                                                                }}
                                                                                className={cn(
                                                                                    "px-3 py-1.5 rounded-xl text-[9px] font-black uppercase border transition-all",
                                                                                    isExpanded
                                                                                        ? "bg-white/10 border-white/20 text-white"
                                                                                        : "bg-primary-blue/15 border-primary-blue/30 text-primary-blue hover:bg-primary-blue/25"
                                                                                )}
                                                                            >
                                                                                {isExpanded ? "Ocultar" : "Ver Etapas"}
                                                                            </button>
                                                                        </td>
                                                                    </tr>

                                                                    {/* Stage Breakdown Rows */}
                                                                    {isExpanded && Object.values(op.etapas).map((et: any) => (
                                                                        <tr key={et.etapa} className="bg-black/20 hover:bg-black/30 border-l-2 border-primary-blue/40">
                                                                            <td className="py-3 pl-8 text-[11px] font-bold text-gray-400 uppercase">
                                                                                ↳ {et.etapa}
                                                                            </td>
                                                                            <td className="py-3 text-right text-[11px] font-bold text-gray-400 font-mono">
                                                                                {et.trabajoCompletado.toLocaleString()} Uds
                                                                            </td>
                                                                            <td className="py-3 text-right text-[11px] font-bold text-gray-400 font-mono">
                                                                                {formatDuration(et.directSeconds)}
                                                                            </td>
                                                                            <td className="py-3 text-right text-[11px] font-bold text-gray-400 font-mono">
                                                                                {formatDuration(et.setupSeconds)}
                                                                            </td>
                                                                            <td className="py-3 text-right text-[11px] font-bold text-gray-400 font-mono">
                                                                                {formatDuration(et.pauseSeconds)}
                                                                            </td>
                                                                            <td className="py-3 text-right text-[11px] font-bold text-gray-400 font-mono">
                                                                                {formatDuration(et.qualityWaitSeconds + et.qualityInspectionSeconds)}
                                                                            </td>
                                                                            <td className="py-3 text-center text-gray-500 font-bold uppercase tracking-wider text-[9px]">
                                                                                Etapa
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </React.Fragment>
                                                            );
                                                        })
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* PAUSES BREAKDOWN TABLE */}
                                    <div className="glass rounded-[2rem] border border-white/10 overflow-hidden bg-white/5 p-6">
                                        <h3 className="text-lg font-black uppercase tracking-wider mb-4 text-warning-yellow">Causas de Pausas (Tiempos Muertos)</h3>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-xs">
                                                <thead>
                                                    <tr className="border-b border-white/10 text-[10px] font-black uppercase text-gray-500 tracking-wider">
                                                        <th className="pb-3 w-1/2">Motivo de la Pausa</th>
                                                        <th className="pb-3 text-center">Frecuencia</th>
                                                        <th className="pb-3 text-right">Tiempo Perdido</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5 text-gray-300 font-medium">
                                                    {Object.keys(pauseReasons).length === 0 ? (
                                                        <tr>
                                                            <td colSpan={3} className="py-6 text-center text-gray-500 italic">No se registraron pausas en este periodo</td>
                                                        </tr>
                                                    ) : (
                                                        Object.entries(pauseReasons).map(([reason, rData]: [string, any]) => (
                                                            <tr key={reason} className="hover:bg-white/[0.01]">
                                                                <td className="py-4 font-bold text-white uppercase">{reason}</td>
                                                                <td className="py-4 text-center font-bold text-gray-400">{rData.count} vez/veces</td>
                                                                <td className="py-4 text-right font-mono font-bold text-danger-red">{formatDuration(rData.duration)}</td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* OPERATORS WORK HOURS TABLE */}
                                    <div className="glass rounded-[2rem] border border-white/10 overflow-hidden bg-white/5 p-6">
                                        <h3 className="text-lg font-black uppercase tracking-wider mb-4 text-emerald-400">Permanencia por Colaborador</h3>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-xs">
                                                <thead>
                                                    <tr className="border-b border-white/10 text-[10px] font-black uppercase text-gray-500 tracking-wider">
                                                        <th className="pb-3 w-1/2">Colaborador</th>
                                                        <th className="pb-3 text-center">Tipo Registro</th>
                                                        <th className="pb-3 text-right">Tiempo Total Registrado</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5 text-gray-300 font-medium">
                                                    {Object.keys(operatorHours).length === 0 ? (
                                                        <tr>
                                                            <td colSpan={3} className="py-6 text-center text-gray-500 italic">No hay registros de horas de personal</td>
                                                        </tr>
                                                    ) : (
                                                        Object.entries(operatorHours)
                                                            .sort((a,b) => b[1].totalSeconds - a[1].totalSeconds)
                                                            .map(([name, data]: [string, any]) => (
                                                                <tr key={name} className="hover:bg-white/[0.01]">
                                                                    <td className="py-4 font-bold text-white uppercase">{name}</td>
                                                                    <td className="py-4 text-center">
                                                                        <span className={cn(
                                                                            "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border",
                                                                            data.type === 'Apoyo'
                                                                                ? "bg-primary-blue/10 border-primary-blue/20 text-primary-blue"
                                                                                : "bg-success-green/10 border-success-green/20 text-success-green"
                                                                        )}>
                                                                            {data.type}
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-4 text-right font-mono font-bold text-white">{formatDuration(data.totalSeconds)}</td>
                                                                </tr>
                                                            ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* OBSERVATIONS AND COMMENTS */}
                                    <div className="glass rounded-[2rem] border border-white/10 overflow-hidden bg-white/5 p-6">
                                        <h3 className="text-lg font-black uppercase tracking-wider mb-4 text-primary-blue">Observaciones Registradas</h3>
                                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                                            {comments.length === 0 ? (
                                                <p className="text-xs text-gray-500 italic py-6 text-center">No hay observaciones registradas en este periodo</p>
                                            ) : (
                                                [...comments]
                                                    .sort((a, b) => {
                                                        const timeA = a.creadoEn?.toMillis?.() || a.creadoEn?.seconds * 1000 || 0;
                                                        const timeB = b.creadoEn?.toMillis?.() || b.creadoEn?.seconds * 1000 || 0;
                                                        return timeB - timeA;
                                                    })
                                                    .map(com => (
                                                        <div key={com.id} className="p-4 bg-white/5 border border-white/5 rounded-2xl space-y-2">
                                                            <div className="flex justify-between items-center text-[10px] font-black uppercase text-gray-500 tracking-wider">
                                                                <span>{com.nombreColaborador} (ID: {com.colaboradorId})</span>
                                                                <span>{com.creadoEn ? format(com.creadoEn.toDate(), 'dd/MM/yyyy HH:mm:ss') : 'Reciente'}</span>
                                                            </div>
                                                            <div className="space-y-1">
                                                                {com.correcciones && com.correcciones.map((corr: any, idx: number) => (
                                                                    <div key={idx} className="mb-1.5 last:mb-0 border-l border-white/10 pl-2">
                                                                        <div className="text-xs text-white/50 line-through leading-relaxed italic">
                                                                            "{corr.comentarioAnterior}"
                                                                        </div>
                                                                        <p className="text-[8px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">
                                                                            Corregido: {corr.fechaCorreccion ? format((corr.fechaCorreccion as any).toDate(), 'dd/MM/yyyy HH:mm:ss') : 'Reciente'} por {corr.nombreColaborador} • Motivo: {corr.motivo || 'Sin especificar'}
                                                                        </p>
                                                                    </div>
                                                                ))}
                                                                <p className="text-sm font-bold text-white">"{com.comentario}"</p>
                                                                {com.correcciones && com.correcciones.length > 0 && (
                                                                    <p className="text-[9px] text-warning-yellow font-black uppercase tracking-[0.2em] mt-1 border-l border-warning-yellow/30 pl-2">
                                                                        Última corrección por: {com.correcciones[com.correcciones.length - 1].nombreColaborador} (ID: {com.correcciones[com.correcciones.length - 1].colaboradorId}) • Motivo: {com.correcciones[com.correcciones.length - 1].motivo}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <div className="flex gap-4 text-[9px] font-bold text-gray-500 uppercase mt-1">
                                                                <span>OP: {com.ordenProduccion}</span>
                                                                <span>Etapa: {com.etapa}</span>
                                                            </div>
                                                        </div>
                                                    ))
                                            )}
                                        </div>
                                    </div>
                                    
                                </div>
                            );
                        })()}
                    </>
                )}

                {/* TAB: MOTIVOS DE CORRECCIÓN */}
                {tab === 'motivosCorreccion' && (
                    <>
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-xl font-black uppercase tracking-widest text-warning-yellow">Maestro de Motivos de Corrección</h2>
                            <button
                                onClick={() => setShowForm(!showForm)}
                                className="flex items-center gap-2 bg-warning-yellow hover:bg-yellow-600 text-black px-6 py-3 rounded-xl font-bold transition-all"
                            >
                                {showForm ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                                {showForm ? "CANCELAR" : "AGREGAR MOTIVO"}
                            </button>
                        </div>

                        {showForm && (
                            <form onSubmit={handleAddMotivoCorreccion} className="glass p-8 rounded-3xl mb-8 border border-warning-yellow/30 animate-in fade-in slide-in-from-top-4 duration-300">
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-xs font-black text-gray-500 uppercase mb-2">Texto / Descripción del Motivo *</label>
                                        <input
                                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:ring-2 focus:ring-warning-yellow"
                                            value={newMotivoCorreccionTexto}
                                            onChange={(e) => setNewMotivoCorreccionTexto(e.target.value)}
                                            placeholder="Ej: Error de digitación, Información incompleta, etc."
                                            required
                                        />
                                    </div>
                                    <div className="flex justify-end">
                                        <button
                                            type="submit"
                                            className="bg-warning-yellow hover:bg-yellow-600 text-black px-8 py-3 rounded-xl font-bold transition-all"
                                        >
                                            GUARDAR MOTIVO
                                        </button>
                                    </div>
                                </div>
                            </form>
                        )}

                        <div className="glass rounded-3xl overflow-hidden border border-white/10 bg-white/5">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="bg-white/5 border-b border-white/10 text-xs font-black uppercase text-gray-500 tracking-wider">
                                        <th className="p-4">Motivo / Descripción</th>
                                        <th className="p-4 text-center">Estado</th>
                                        <th className="p-4 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-gray-300">
                                    {motivosCorreccion.length === 0 ? (
                                        <tr>
                                            <td colSpan={3} className="p-8 text-center text-gray-500 italic">No hay motivos de corrección registrados</td>
                                        </tr>
                                    ) : (
                                        motivosCorreccion.map(mot => (
                                            <tr key={mot.id} className="hover:bg-white/[0.01]">
                                                <td className="p-4 font-bold text-white uppercase">{mot.texto}</td>
                                                <td className="p-4 text-center">
                                                    <button
                                                        onClick={() => handleToggleActivo(mot.id, mot.activo, 'maestro_motivos_correccion')}
                                                        className={cn(
                                                            "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all",
                                                            mot.activo
                                                                ? "bg-success-green/10 border-success-green/20 text-success-green hover:bg-success-green/20"
                                                                : "bg-danger-red/10 border-danger-red/20 text-danger-red hover:bg-danger-red/20"
                                                        )}
                                                    >
                                                        {mot.activo ? "Activo" : "Inactivo"}
                                                    </button>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className="flex gap-2 justify-end">
                                                        <button
                                                            onClick={() => {
                                                                setEditingItem({ id: mot.id, type: 'motivoCorreccion', data: mot });
                                                                setEditValue(mot);
                                                            }}
                                                            className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-all"
                                                        >
                                                            <Edit2 className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(mot.id, 'maestro_motivos_correccion')}
                                                            className="p-2 hover:bg-danger-red/10 rounded-lg text-danger-red transition-all"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {/* TAB: ARTICULOS */}
                {tab === 'articulos' && (
                    <>
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-xl font-black uppercase tracking-widest text-emerald-400">Maestro de Artículos y Velocidades</h2>
                            <button
                                onClick={() => setShowForm(!showForm)}
                                className="flex items-center gap-2 bg-emerald-400 hover:bg-emerald-500 text-black px-6 py-3 rounded-xl font-bold transition-all"
                            >
                                {showForm ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                                {showForm ? "CANCELAR" : "AGREGAR ARTÍCULO"}
                            </button>
                        </div>

                        {showForm && (
                            <form onSubmit={handleAddArticulo} className="glass p-8 rounded-3xl mb-8 border border-emerald-400/30 animate-in fade-in slide-in-from-top-4 duration-300">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-black text-gray-500 uppercase mb-2">Código de Artículo *</label>
                                        <input
                                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:ring-2 focus:ring-emerald-400"
                                            value={newArticuloCodigo}
                                            onChange={(e) => setNewArticuloCodigo(e.target.value)}
                                            placeholder="Ej: ART-10293"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black text-gray-500 uppercase mb-2">Descripción (Nombre del Producto) *</label>
                                        <input
                                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:ring-2 focus:ring-emerald-400"
                                            value={newArticuloDescripcion}
                                            onChange={(e) => setNewArticuloDescripcion(e.target.value)}
                                            placeholder="Ej: IBUPROFENO 400MG"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black text-gray-500 uppercase mb-2">Velocidad Teórica (Unid/Min) *</label>
                                        <input
                                            type="number"
                                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:ring-2 focus:ring-emerald-400"
                                            value={newArticuloVelocidad || ''}
                                            onChange={(e) => setNewArticuloVelocidad(Number(e.target.value))}
                                            placeholder="Ej: 120"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black text-gray-500 uppercase mb-2">Línea *</label>
                                        <select
                                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:ring-2 focus:ring-emerald-400 text-white"
                                            value={newArticuloLinea}
                                            onChange={(e) => setNewArticuloLinea(e.target.value as any)}
                                        >
                                            <option value="Humano" className="bg-black text-white">Humano</option>
                                            <option value="Veterinario" className="bg-black text-white">Veterinario</option>
                                        </select>
                                    </div>
                                </div>
                                <button type="submit" className="mt-6 w-full bg-emerald-400 text-black font-black py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-500 transition-colors">
                                    <Check className="h-6 w-6" /> GUARDAR EN MAESTRO
                                </button>
                            </form>
                        )}

                        <div className="glass rounded-3xl overflow-hidden border border-white/10">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-white/5 border-b border-white/10">
                                        <th className="p-5 text-xs font-black uppercase text-gray-500">Código</th>
                                        <th className="p-5 text-xs font-black uppercase text-gray-500">Descripción</th>
                                        <th className="p-5 text-xs font-black uppercase text-gray-500">Vel. Teórica (u/m)</th>
                                        <th className="p-5 text-xs font-black uppercase text-gray-500">Línea</th>
                                        <th className="p-5 text-right text-xs font-black uppercase text-gray-500">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {articulos.map((art) => (
                                        <tr key={art.id} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="p-5 font-mono text-emerald-400 font-bold uppercase">{art.codigo}</td>
                                            <td className="p-5 font-bold uppercase">{art.descripcion}</td>
                                            <td className="p-5 font-mono">{art.velocidadTeorica}</td>
                                            <td className="p-5">
                                                <span className={cn(
                                                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                                                    art.linea === 'Humano' ? "bg-primary-blue/10 border-primary-blue/20 text-primary-blue" : "bg-warning-yellow/10 border-warning-yellow/20 text-warning-yellow"
                                                )}>
                                                    {art.linea || 'Humano'}
                                                </span>
                                            </td>
                                            <td className="p-5 text-right space-x-2">
                                                <button
                                                    onClick={() => {
                                                        setEditingItem({ id: art.id, type: 'articulo', data: art });
                                                        setEditValue({
                                                            codigo: art.codigo,
                                                            descripcion: art.descripcion,
                                                            velocidadTeorica: art.velocidadTeorica,
                                                            linea: art.linea || 'Humano'
                                                        });
                                                    }}
                                                    className="p-2 hover:bg-white/10 text-gray-400 rounded-lg transition-all"
                                                    title="Editar Artículo"
                                                >
                                                    <Edit2 className="h-5 w-5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(art.id, 'maestro_articulos')}
                                                    className="p-2 hover:bg-danger-red/20 text-danger-red rounded-lg transition-all"
                                                    title="Eliminar Artículo"
                                                >
                                                    <Trash2 className="h-5 w-5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {articulos.length === 0 && (
                                <div className="p-20 text-center text-gray-500 font-bold uppercase tracking-widest text-xs">No hay artículos registrados</div>
                            )}
                        </div>
                    </>
                )}

                {/* TAB: COMPARAR ARTICULOS */}
                {tab === 'compararArticulos' && (
                    <>
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-xl font-black uppercase tracking-widest text-amber-400">Comparar Procesos por Artículo</h2>
                        </div>

                        <div className="glass p-6 rounded-3xl border border-white/10 mb-8 bg-white/5 space-y-6">
                            <div>
                                <label className="block text-xs font-black text-gray-500 uppercase mb-2">Seleccione un Artículo</label>
                                <select
                                    value={selectedArticulo}
                                    onChange={(e) => setSelectedArticulo(e.target.value)}
                                    className="w-full bg-white border border-gray-300 text-black rounded-2xl p-4 font-bold outline-none focus:ring-4 focus:ring-amber-400/20 transition-all text-base cursor-pointer"
                                >
                                    <option value="">-- SELECCIONE UN ARTÍCULO --</option>
                                    {articulos.map(art => (
                                        <option key={art.id} value={art.codigo}>
                                            {art.codigo} - {art.descripcion}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {selectedArticulo && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-white/5 pt-6 text-sm">
                                    <div>
                                        <span className="text-xs text-gray-500 font-bold uppercase block">Código</span>
                                        <strong className="text-white uppercase font-mono">{selectedArticulo}</strong>
                                    </div>
                                    <div>
                                        <span className="text-xs text-gray-500 font-bold uppercase block">Producto</span>
                                        <strong className="text-white uppercase">{articulos.find(a => a.codigo === selectedArticulo)?.descripcion || 'N/A'}</strong>
                                    </div>
                                    <div>
                                        <span className="text-xs text-gray-500 font-bold uppercase block">Velocidad Teórica</span>
                                        <strong className="text-success-green font-mono">{articulos.find(a => a.codigo === selectedArticulo)?.velocidadTeorica || 0} uds/min</strong>
                                    </div>
                                </div>
                            )}
                        </div>

                        {selectedArticulo && (
                            <div className="glass rounded-3xl overflow-hidden border border-white/10 bg-white/5 animate-in fade-in duration-500">
                                {loadingComparacion ? (
                                    <div className="p-20 text-center text-gray-400 font-bold uppercase tracking-widest text-xs flex flex-col items-center justify-center gap-4">
                                        <div className="animate-spin rounded-full h-8 w-8 border-4 border-amber-400 border-t-transparent" />
                                        <span>Procesando y calculando métricas...</span>
                                    </div>
                                ) : comparacionData.length === 0 ? (
                                    <div className="p-20 text-center text-gray-500 font-bold uppercase tracking-widest text-xs">No hay procesos registrados para este artículo</div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs whitespace-nowrap">
                                            <thead>
                                                <tr className="bg-white/5 border-b border-white/10 text-[9px] font-black uppercase text-gray-500 tracking-wider">
                                                    <th className="p-4">OP / Lote / Etapa</th>
                                                    <th className="p-4">Líder</th>
                                                    <th className="p-4">Cantidades (Progreso)</th>
                                                    <th className="p-4 text-center">Eficiencia</th>
                                                    <th className="p-4 text-center">Setup</th>
                                                    <th className="p-4 text-center">Pausas</th>
                                                    <th className="p-4 text-center">Tiempo Proceso</th>
                                                    <th className="p-4 text-center">Tiempo H-H</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5 text-gray-300 font-medium">
                                                {comparacionData.map(p => {
                                                    const progress = p.cantidadProducir > 0 ? Math.min(100, (p.trabajoCompletado / p.cantidadProducir) * 100) : 0;
                                                    const efficiency = p.velocidadTeorica > 0 ? ((p.trabajoCompletado / (p.cantidadProducir || 1)) * 100) : 0;
                                                    
                                                    return (
                                                        <tr key={p.id} className="hover:bg-white/[0.01]">
                                                            <td className="p-4">
                                                                <div className="font-bold text-white uppercase font-mono">{p.ordenProduccion}</div>
                                                                <div className="text-[10px] text-gray-400 font-mono mt-0.5">Lote: {p.lote}</div>
                                                                <span className="inline-block bg-white/5 border border-white/10 text-[8px] font-black text-amber-400 px-2 py-0.5 rounded uppercase mt-1 tracking-wider">{p.etapa}</span>
                                                            </td>
                                                            <td className="p-4 uppercase text-gray-400 font-bold">{p.lider || 'N/A'}</td>
                                                            <td className="p-4">
                                                                <div className="font-mono text-white font-bold">{p.trabajoCompletado} / {p.cantidadProducir}</div>
                                                                <div className="text-[10px] text-gray-500 font-mono mt-0.5">{progress.toFixed(1)}% completo</div>
                                                            </td>
                                                            <td className="p-4 text-center">
                                                                <span className={cn(
                                                                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border",
                                                                    efficiency >= 95 ? "bg-success-green/10 border-success-green/20 text-success-green" :
                                                                    efficiency >= 80 ? "bg-warning-yellow/10 border-warning-yellow/20 text-warning-yellow" :
                                                                    "bg-danger-red/10 border-danger-red/20 text-danger-red"
                                                                )}>
                                                                    {efficiency.toFixed(1)}%
                                                                </span>
                                                            </td>
                                                            <td className="p-4 text-center font-mono">{formatDuration(p.tiempoSetupSegundos || 0)}</td>
                                                            <td className="p-4 text-center font-mono text-warning-yellow">{formatDuration(p.procPauseSeconds || 0)}</td>
                                                            <td className="p-4 text-center font-mono text-success-green font-bold">{formatDuration(p.effectiveProcessSeconds || 0)}</td>
                                                            <td className="p-4 text-center font-mono text-primary-blue font-bold">{formatDuration(p.effectiveHHSeconds || 0)}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}

                {/* TAB: HORAS DE COLABORADOR */}
                {tab === 'historialColaborador' && (
                    <>
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-xl font-black uppercase tracking-widest text-pink-400">Reporte de Tiempos por Colaborador</h2>
                        </div>

                        <form onSubmit={handleGenerateColaboradorReport} className="glass p-6 rounded-3xl border border-white/10 mb-8 bg-white/5">
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6 border-b border-white/5 pb-4">
                                <span className="text-xs font-black uppercase text-gray-400 tracking-widest">Parámetros de Consulta</span>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleSetPeriod('hoy')}
                                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border border-white/10 hover:border-pink-400/30"
                                    >
                                        Hoy
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleSetPeriod('semana')}
                                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border border-white/10 hover:border-pink-400/30"
                                    >
                                        Esta Semana
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleSetPeriod('mes')}
                                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border border-white/10 hover:border-pink-400/30"
                                    >
                                        Este Mes
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                                <div className="space-y-2 md:col-span-1">
                                    <label className="block text-xs font-black text-gray-500 uppercase tracking-wider">Seleccione un Colaborador</label>
                                    <select
                                        value={colaboradorReportId}
                                        onChange={(e) => {
                                            setColaboradorReportId(e.target.value);
                                            setColaboradorReportData(null);
                                        }}
                                        className="w-full bg-white border border-gray-300 text-black rounded-2xl p-4 font-bold outline-none focus:ring-4 focus:ring-pink-400/20 transition-all text-base cursor-pointer"
                                        required
                                    >
                                        <option value="">-- SELECCIONE UN COLABORADOR --</option>
                                        {colaboradores.map(c => (
                                            <option key={c.id} value={c.id}>
                                                {c.nombreCompleto} ({c.id})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-xs font-black text-gray-500 uppercase tracking-wider">Fecha Inicio</label>
                                    <input
                                        type="date"
                                        value={colaboradorReportStartDate}
                                        onChange={(e) => {
                                            setColaboradorReportStartDate(e.target.value);
                                            setColaboradorReportData(null);
                                        }}
                                        className="w-full bg-white border border-gray-300 text-black rounded-2xl p-4 font-bold outline-none focus:ring-4 focus:ring-pink-400/20 transition-all text-base cursor-pointer font-mono"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-xs font-black text-gray-500 uppercase tracking-wider">Fecha Fin</label>
                                    <input
                                        type="date"
                                        value={colaboradorReportEndDate}
                                        onChange={(e) => {
                                            setColaboradorReportEndDate(e.target.value);
                                            setColaboradorReportData(null);
                                        }}
                                        className="w-full bg-white border border-gray-300 text-black rounded-2xl p-4 font-bold outline-none focus:ring-4 focus:ring-pink-400/20 transition-all text-base cursor-pointer font-mono"
                                        required
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={colaboradorReportLoading || !colaboradorReportId || !colaboradorReportStartDate || !colaboradorReportEndDate}
                                className="w-full mt-6 bg-pink-400 hover:bg-pink-500 text-black font-black py-4 rounded-2xl transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2 shadow-lg shadow-pink-400/10 disabled:opacity-50"
                            >
                                {colaboradorReportLoading ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-black border-t-transparent" />
                                        <span>Procesando Rango...</span>
                                    </>
                                ) : (
                                    <>
                                        <BarChart3 className="h-4 w-4" />
                                        <span>Generar Reporte por Rango</span>
                                    </>
                                )}
                            </button>
                        </form>

                        {colaboradorReportData && (
                            <div className="space-y-8 animate-in fade-in duration-500">
                                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                                    {/* Card 1: Tiempo en Planta */}
                                    <div className="glass p-5 rounded-2xl border border-white/10 flex flex-col justify-between min-h-[110px] bg-gradient-to-br from-white/5 to-transparent col-span-1">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Tiempo en Planta</span>
                                        <div className="mt-2">
                                            <h3 className="text-2xl font-black text-white font-mono">{formatDuration(colaboradorReportData.totalPermanenceSeconds || colaboradorReportData.totalSeconds)}</h3>
                                            <p className="text-[9px] text-gray-500 font-bold uppercase mt-1">Presencia lineal (Jornada)</p>
                                        </div>
                                    </div>

                                    {/* Card 2: Tiempo en Procesos */}
                                    <div className="glass p-5 rounded-2xl border border-white/10 flex flex-col justify-between min-h-[110px] bg-gradient-to-br from-primary-blue/15 to-transparent col-span-1">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-primary-blue">Tiempo en Procesos</span>
                                        <div className="mt-2">
                                            <h3 className="text-2xl font-black text-primary-blue font-mono">{formatDuration(colaboradorReportData.totalSeconds)}</h3>
                                            <p className="text-[9px] text-gray-500 font-bold uppercase mt-1">Suma de fichajes</p>
                                        </div>
                                    </div>

                                    {/* Card 3: Tiempo Inactivo */}
                                    <div className="glass p-5 rounded-2xl border border-white/10 flex flex-col justify-between min-h-[110px] bg-gradient-to-br from-warning-yellow/15 to-transparent col-span-1">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-warning-yellow">Tiempo Inactivo</span>
                                        <div className="mt-2">
                                            <h3 className="text-2xl font-black text-warning-yellow font-mono">{formatDuration(colaboradorReportData.totalInactiveSeconds)}</h3>
                                            <p className="text-[9px] text-gray-500 font-bold uppercase mt-1">Fuera de registro</p>
                                        </div>
                                    </div>

                                    {/* Card 4: Tiempo Efectivo */}
                                    <div className="glass p-5 rounded-2xl border border-white/10 flex flex-col justify-between min-h-[110px] bg-gradient-to-br from-success-green/15 to-transparent col-span-1">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-success-green">Tiempo Efectivo</span>
                                        <div className="mt-2">
                                            <h3 className="text-2xl font-black text-success-green font-mono">{formatDuration(colaboradorReportData.effectiveSeconds)}</h3>
                                            <p className="text-[9px] text-gray-500 font-bold uppercase mt-1">Descontando pausas</p>
                                        </div>
                                    </div>

                                    {/* Card 5: Aprovechamiento */}
                                    <div className="glass p-5 rounded-2xl border border-white/10 flex flex-col justify-between min-h-[110px] bg-gradient-to-br from-pink-400/15 to-transparent col-span-2 lg:col-span-1">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-pink-400">Eficiencia Neto</span>
                                        <div className="mt-2">
                                            <h3 className="text-2xl font-black text-pink-400 font-mono">
                                                {colaboradorReportData.totalPermanenceSeconds > 0
                                                    ? ((colaboradorReportData.effectiveSeconds / colaboradorReportData.totalPermanenceSeconds) * 100).toFixed(1)
                                                    : colaboradorReportData.totalSeconds > 0
                                                        ? ((colaboradorReportData.effectiveSeconds / colaboradorReportData.totalSeconds) * 100).toFixed(1)
                                                        : '0.0'}%
                                            </h3>
                                            <p className="text-[9px] text-gray-500 font-bold uppercase mt-1">Efectivo vs Planta</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="glass rounded-3xl overflow-hidden border border-white/10 bg-white/5">
                                    <div className="p-6 border-b border-white/5 bg-white/5">
                                        <h3 className="text-sm font-black uppercase text-white tracking-wider">Desglose de Participación en Líneas</h3>
                                    </div>
                                    {colaboradorReportData.breakdown.length === 0 ? (
                                        <div className="p-20 text-center text-gray-500 font-bold uppercase tracking-widest text-xs">No hay actividad registrada en esta fecha</div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-xs whitespace-nowrap">
                                                <thead>
                                                    <tr className="bg-white/5 border-b border-white/10 text-[9px] font-black uppercase text-gray-500 tracking-wider">
                                                        <th className="p-4">Proceso / OP</th>
                                                        <th className="p-4">Producto</th>
                                                        <th className="p-4">Ingreso</th>
                                                        <th className="p-4">Salida</th>
                                                        <th className="p-4 text-center">Rol</th>
                                                        <th className="p-4 text-right">Tiempo Permanencia</th>
                                                        <th className="p-4 text-right text-success-green">Tiempo Efectivo</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5 text-gray-300 font-medium">
                                                    {colaboradorReportData.breakdown.map((item: any) => (
                                                        <tr key={item.id} className="hover:bg-white/[0.01]">
                                                            <td className="p-4">
                                                                <div className="font-bold text-white uppercase font-mono">{item.op}</div>
                                                                <span className="inline-block bg-white/5 border border-white/10 text-[8px] font-black text-pink-400 px-2 py-0.5 rounded uppercase mt-1 tracking-wider">{item.etapa}</span>
                                                            </td>
                                                            <td className="p-4 uppercase text-gray-400 font-bold max-w-xs truncate">{item.producto || 'N/A'}</td>
                                                            <td className="p-4 font-mono">{format(item.entry, 'dd/MM/yyyy HH:mm:ss')}</td>
                                                            <td className="p-4 font-mono">
                                                                {item.exit ? format(item.exit, 'dd/MM/yyyy HH:mm:ss') : (item.estadoProceso === 'Iniciado' ? <span className="text-success-green animate-pulse">ACTIVO</span> : '-')}
                                                            </td>
                                                            <td className="p-4 text-center">
                                                                <span className={cn(
                                                                    "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border",
                                                                    item.tipo === 'setup' ? "bg-accent-purple/10 border-accent-purple/20 text-accent-purple" : "bg-primary-blue/10 border-primary-blue/20 text-primary-blue"
                                                                )}>
                                                                    {item.tipo}
                                                                </span>
                                                            </td>
                                                            <td className="p-4 text-right font-mono font-bold text-white">{formatDuration(item.totalDuration)}</td>
                                                            <td className="p-4 text-right font-mono font-bold text-success-green">{formatDuration(item.effectiveDuration)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>

                                {/* Desglose de Periodos Inactivos */}
                                <div className="glass rounded-3xl overflow-hidden border border-white/10 bg-white/5">
                                    <div className="p-6 border-b border-white/5 bg-white/5 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                                        <h3 className="text-sm font-black uppercase text-white tracking-wider">Desglose de Periodos Inactivos (Fuera de Línea)</h3>
                                        <span className="text-[10px] font-black uppercase text-warning-yellow bg-warning-yellow/10 border border-warning-yellow/20 px-3 py-1 rounded-full self-start sm:self-auto font-mono">
                                            Total Inactivo: {formatDuration(colaboradorReportData.totalInactiveSeconds)}
                                        </span>
                                    </div>
                                    {colaboradorReportData.inactiveGaps.length === 0 ? (
                                        <div className="p-16 text-center text-gray-500 font-bold uppercase tracking-widest text-xs">No se registraron periodos de inactividad entre procesos en este rango</div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-xs whitespace-nowrap">
                                                <thead>
                                                    <tr className="bg-white/5 border-b border-white/10 text-[9px] font-black uppercase text-gray-500 tracking-wider">
                                                        <th className="p-4">Fecha</th>
                                                        <th className="p-4">Inicio de Inactividad</th>
                                                        <th className="p-4">Fin de Inactividad</th>
                                                        <th className="p-4">Motivo / Causa de Salida</th>
                                                        <th className="p-4 text-right">Duración Inactivo</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5 text-gray-300 font-medium font-mono">
                                                    {colaboradorReportData.inactiveGaps.map((gap: any) => (
                                                        <tr key={gap.id} className="hover:bg-white/[0.01]">
                                                            <td className="p-4 text-gray-400 font-sans font-bold">{gap.fecha}</td>
                                                            <td className="p-4">{format(gap.inicio, 'HH:mm:ss')}</td>
                                                            <td className="p-4">{format(gap.fin, 'HH:mm:ss')}</td>
                                                            <td className="p-4 text-gray-200 uppercase font-sans font-bold">{gap.motivo}</td>
                                                            <td className="p-4 text-right text-warning-yellow font-bold">{formatDuration(gap.duracion)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
            {/* MODAL DE EDICIÓN UNIVERSAL */}
            {editingItem && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                    <div className="glass w-full max-w-xl rounded-[2.5rem] overflow-hidden flex flex-col border-white/10 shadow-2xl animate-in zoom-in duration-300">
                        <div className="p-8 border-b border-white/10 flex items-center justify-between bg-white/5">
                            <h3 className="text-2xl font-black uppercase flex items-center gap-3">
                                <Edit2 className="h-7 w-7 text-primary-blue" /> EDITAR {editingItem.type}
                            </h3>
                            <button onClick={() => setEditingItem(null)} className="p-2 hover:bg-white/10 rounded-full">
                                <X className="h-7 w-7" />
                            </button>
                        </div>
                        <div className="p-8 space-y-6 overflow-auto max-h-[70vh]">
                            {editingItem.type === 'personal' && (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Nombre Completo</label>
                                            <input
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-bold outline-none focus:border-primary-blue transition-all"
                                                value={editValue.nombreCompleto}
                                                onChange={(e) => setEditValue({ ...editValue, nombreCompleto: e.target.value.toUpperCase() })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Cédula / Identificación</label>
                                            <input
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-bold outline-none focus:border-primary-blue transition-all font-mono"
                                                value={editValue.id}
                                                onChange={(e) => setEditValue({ ...editValue, id: e.target.value.trim() })}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">PIN / Clave de Registro</label>
                                        <input
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-bold outline-none focus:border-primary-blue transition-all font-mono"
                                            value={editValue.claveRegistro}
                                            onChange={(e) => setEditValue({ ...editValue, claveRegistro: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Mensaje Ingreso</label>
                                            <input
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-bold outline-none focus:border-primary-blue transition-all"
                                                value={editValue.mensajeEntrada}
                                                onChange={(e) => setEditValue({ ...editValue, mensajeEntrada: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Mensaje Salida</label>
                                            <input
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-bold outline-none focus:border-primary-blue transition-all"
                                                value={editValue.mensajeSalida}
                                                onChange={(e) => setEditValue({ ...editValue, mensajeSalida: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {editingItem.type === 'articulo' && (
                                <>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Código de Artículo</label>
                                        <input
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-bold outline-none focus:border-primary-blue transition-all"
                                            value={editValue.codigo}
                                            onChange={(e) => setEditValue({ ...editValue, codigo: e.target.value.toUpperCase() })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Descripción</label>
                                        <input
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-bold outline-none focus:border-primary-blue transition-all"
                                            value={editValue.descripcion}
                                            onChange={(e) => setEditValue({ ...editValue, descripcion: e.target.value.toUpperCase() })}
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Velocidad Teórica</label>
                                            <input
                                                type="number"
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-bold outline-none focus:border-primary-blue transition-all"
                                                value={editValue.velocidadTeorica}
                                                onChange={(e) => setEditValue({ ...editValue, velocidadTeorica: Number(e.target.value) })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Línea</label>
                                            <select
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-bold outline-none focus:border-primary-blue transition-all text-white"
                                                value={editValue.linea}
                                                onChange={(e) => setEditValue({ ...editValue, linea: e.target.value })}
                                            >
                                                <option value="Humano" className="bg-black text-white">Humano</option>
                                                <option value="Veterinario" className="bg-black text-white">Veterinario</option>
                                            </select>
                                        </div>
                                    </div>
                                </>
                            )}

                            {(editingItem.type === 'pausa' || editingItem.type === 'salida') && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Texto de Justificación</label>
                                    <input
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-bold outline-none focus:border-primary-blue transition-all"
                                        value={editValue.texto}
                                        onChange={(e) => setEditValue({ ...editValue, texto: e.target.value })}
                                    />
                                </div>
                            )}

                            {editingItem.type === 'etapa' && (
                                <>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Código</label>
                                        <input
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-bold outline-none focus:border-primary-blue transition-all"
                                            value={editValue.codigo}
                                            onChange={(e) => setEditValue({ ...editValue, codigo: e.target.value.toUpperCase() })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Nombre</label>
                                        <input
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-bold outline-none focus:border-primary-blue transition-all"
                                            value={editValue.nombre}
                                            onChange={(e) => setEditValue({ ...editValue, nombre: e.target.value })}
                                        />
                                    </div>
                                    <div className="mt-4">
                                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Visible en procesos de tipo:</label>
                                        <div className="flex flex-wrap gap-4">
                                            {[
                                                { id: 'empaque', label: 'Empaque' },
                                                { id: 'otros', label: 'Otros' },
                                                { id: 'anexos', label: 'Anexos' }
                                            ].map(tipo => (
                                                <label key={tipo.id} className="flex items-center gap-2 cursor-pointer group">
                                                    <input
                                                        type="checkbox"
                                                        checked={(editValue.tiposProceso || []).includes(tipo.id)}
                                                        onChange={(e) => {
                                                            const current = editValue.tiposProceso || [];
                                                            if (e.target.checked) {
                                                                setEditValue({ ...editValue, tiposProceso: [...current, tipo.id] });
                                                            } else {
                                                                setEditValue({ ...editValue, tiposProceso: current.filter((t: string) => t !== tipo.id) });
                                                            }
                                                        }}
                                                        className="hidden"
                                                    />
                                                    <div className={cn(
                                                        "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                                                        (editValue.tiposProceso || []).includes(tipo.id) ? "bg-accent-purple border-accent-purple" : "border-white/20 group-hover:border-white/40"
                                                    )}>
                                                        {(editValue.tiposProceso || []).includes(tipo.id) && <Check className="h-3 w-3 text-white" />}
                                                    </div>
                                                    <span className="text-sm font-bold">{tipo.label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}

                            {editingItem.type === 'motivoCorreccion' && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Texto del Motivo de Corrección</label>
                                    <input
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-bold outline-none focus:border-primary-blue transition-all"
                                        value={editValue.texto}
                                        onChange={(e) => setEditValue({ ...editValue, texto: e.target.value })}
                                    />
                                </div>
                            )}

                            {editingItem.type === 'usuario' && (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Username</label>
                                            <input
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-bold outline-none focus:border-primary-blue transition-all"
                                                value={editValue.username}
                                                onChange={(e) => setEditValue({ ...editValue, username: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Password</label>
                                            <input
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-bold outline-none focus:border-primary-blue transition-all"
                                                value={editValue.password}
                                                onChange={(e) => setEditValue({ ...editValue, password: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Email</label>
                                        <input
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-bold outline-none focus:border-primary-blue transition-all"
                                            value={editValue.email}
                                            onChange={(e) => setEditValue({ ...editValue, email: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Rol</label>
                                        <select
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-bold outline-none focus:border-primary-blue transition-all"
                                            value={editValue.rol}
                                            onChange={(e) => setEditValue({ ...editValue, rol: e.target.value as UserRole })}
                                        >
                                            <option value="usuario">Usuario</option>
                                            <option value="supervisor">Supervisor</option>
                                            <option value="superadmin">Superadmin</option>
                                        </select>
                                    </div>
                                </>
                            )}

                            {editingItem.type === 'orden' && (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">OP</label>
                                            <input
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-bold outline-none focus:ring-2 focus:ring-primary-blue transition-all"
                                                value={editValue.op}
                                                onChange={(e) => setEditValue({ ...editValue, op: e.target.value.toUpperCase() })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Lote</label>
                                            <input
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-bold outline-none focus:ring-2 focus:ring-primary-blue transition-all"
                                                value={editValue.lote}
                                                onChange={(e) => setEditValue({ ...editValue, lote: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="md:col-span-1 space-y-2">
                                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Código de Artículo</label>
                                            <input
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-bold outline-none focus:ring-2 focus:ring-primary-blue transition-all font-mono"
                                                value={editValue.articulo || ''}
                                                onChange={(e) => setEditValue({ ...editValue, articulo: e.target.value.toUpperCase() })}
                                            />
                                        </div>
                                        <div className="md:col-span-2 space-y-2">
                                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Producto</label>
                                            <input
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-bold outline-none focus:ring-2 focus:ring-primary-blue transition-all"
                                                value={editValue.producto}
                                                onChange={(e) => setEditValue({ ...editValue, producto: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Cantidad</label>
                                            <input
                                                type="number"
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-bold outline-none focus:ring-2 focus:ring-primary-blue transition-all"
                                                value={editValue.cantidad}
                                                onChange={(e) => setEditValue({ ...editValue, cantidad: Number(e.target.value) })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Velocidad</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-bold outline-none focus:ring-2 focus:ring-primary-blue transition-all"
                                                value={editValue.velocidadTeorica}
                                                onChange={(e) => setEditValue({ ...editValue, velocidadTeorica: Number(e.target.value) })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={handleSaveEdit}
                                className="w-full bg-success-green text-black py-5 rounded-3xl font-black text-xl hover:bg-green-600 transition-all flex items-center justify-center gap-4 shadow-xl"
                            >
                                <Check className="h-6 w-6" /> GUARDAR CAMBIOS
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE PIN REGENERADO */}
            {regeneratedPinInfo && (
                <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
                    <div className="glass w-full max-w-md rounded-[2.5rem] overflow-hidden flex flex-col border border-white/10 shadow-2xl animate-in zoom-in duration-300">
                        <div className="p-8 border-b border-white/10 flex items-center justify-between bg-white/5">
                            <h3 className="text-xl font-black uppercase flex items-center gap-3 text-success-green">
                                <Key className="h-6 w-6" /> PIN Regenerado
                            </h3>
                            <button onClick={() => setRegeneratedPinInfo(null)} className="p-2 hover:bg-white/10 rounded-full text-gray-400">
                                <X className="h-6 w-6" />
                            </button>
                        </div>
                        <div className="p-8 text-center space-y-6">
                            <p className="text-sm text-gray-300">
                                Se ha generado un nuevo PIN único para el colaborador:
                            </p>
                            <h4 className="text-lg font-black uppercase text-white tracking-wide">
                                {regeneratedPinInfo.nombre}
                            </h4>
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 font-mono text-4xl font-bold tracking-[0.3em] text-primary-blue select-all flex items-center justify-center gap-2">
                                {regeneratedPinInfo.pin}
                            </div>
                            <p className="text-xs text-danger-red font-medium">
                                Asegúrese de compartir este PIN de manera privada con el colaborador.
                            </p>
                        </div>
                        <div className="p-8 border-t border-white/10 bg-white/5 flex gap-4">
                            <button
                                onClick={async () => {
                                    try {
                                        await navigator.clipboard.writeText(regeneratedPinInfo.pin);
                                        alert("¡PIN copiado al portapapeles!");
                                    } catch (err) {
                                        console.error("No se pudo copiar", err);
                                    }
                                }}
                                className="flex-1 bg-primary-blue hover:bg-primary-blue-dark text-white font-bold py-3 px-6 rounded-xl transition-all"
                            >
                                Copiar PIN
                            </button>
                            <button
                                onClick={() => setRegeneratedPinInfo(null)}
                                className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3 px-6 rounded-xl transition-all"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {correctionModal && correctionModal.show && (
                <ModalCorregirComentario
                    comentario={correctionModal.comentario}
                    onClose={() => setCorrectionModal(null)}
                    onSuccess={(msg) => alert(msg)}
                />
            )}
        </div >
    );
}
