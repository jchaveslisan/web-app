"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    ArrowLeft,
    Users,
    Activity,
    Clock,
    Play,
    Pause,
    Square,
    UserPlus,
    LogOut,
    AlertTriangle,
    History,
    Check,
    X,
    ClipboardList,
    ShieldCheck,
    Timer
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProcesoRealtime } from '@/hooks/useProcesoRealtime';
import { format, differenceInSeconds, addSeconds } from 'date-fns';
import { updateProceso, addEventoLog, updateDoc, getColaboradorByClave, addColaboradorToLog, getColaboradoresActivos } from '@/lib/firebase-db';
import { useAuthStore } from '@/lib/auth-service';
import ModalAddColaborador from '@/components/proceso/ModalAddColaborador';
import ModalJustificacion from '@/components/proceso/ModalJustificacion';
import ModalBulkExit from '@/components/proceso/ModalBulkExit';
import { doc, Timestamp, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { calculateProductivity, ProductivityStats, formatSeconds } from '@/lib/productivity-utils';
import { ColaboradorMaestro } from '@/types';

// Helper para determinar el tipo de proceso (backward compatibility)
const getTipoProcesoReal = (proceso: any) => {
    if (proceso.clasificacion) return proceso.clasificacion;

    // Deducir del contenido si no tiene clasificacion (procesos anteriores)
    if (!proceso.utilizaTemporizador && !proceso.contabilizaSetup) {
        // Si no tiene temporizador ni setup, podría ser anexo
        return 'anexos';
    }
    if (proceso.utilizaTemporizador || proceso.contabilizaSetup) {
        return 'empaque';
    }
    return 'otros';
};

export default function MonitoreoPage() {
    const params = useParams();
    const id = params.id as string;
    const router = useRouter();
    const { proceso, colaboradores, eventos, loading } = useProcesoRealtime(id);
    const user = useAuthStore(state => state.user);

    const [stats, setStats] = useState<ProductivityStats>({
        velocidadActual: 0,
        eficiencia: 0,
        tiempoRestanteStr: "00:00:00",
        segundosTotalesRestantes: 0,
        porcentajeCompletado: 0,
        isTiempoExtra: false,
        isGracePeriod: false,
        numColaboradores: 0
    });
    const [calculatedUnits, setCalculatedUnits] = useState(0);
    const [setupTimerStr, setSetupTimerStr] = useState("00:00:00");
    const [showModalAdd, setShowModalAdd] = useState(false);
    const [showStaffModal, setShowStaffModal] = useState(false);
    const [showEventsModal, setShowEventsModal] = useState(false);
    const [modalJustificacion, setModalJustificacion] = useState<{ show: boolean, tipo: 'pausa' | 'salida' }>({ show: false, tipo: 'pausa' });
    const [staffCode, setStaffCode] = useState('');
    const [staffActionLoading, setStaffActionLoading] = useState(false);
    const [staffMessage, setStaffMessage] = useState<{ text: string, type: 'success' | 'error' | 'info' | 'exit' } | null>(null);
    const [showStaffTypeModal, setShowStaffTypeModal] = useState(false);
    const [pendingStaffMaestro, setPendingStaffMaestro] = useState<any>(null);
    const [pendingExitLog, setPendingExitLog] = useState<{ id: string, nombre: string } | null>(null);
    const [showModalBulkExit, setShowModalBulkExit] = useState(false);
    const [calidadTimerStr, setCalidadTimerStr] = useState("00:00:00");

    // Sincronizar unidades calculadas con el valor de la base de datos cuando cambia
    useEffect(() => {
        if (proceso) {
            setCalculatedUnits(proceso.trabajoCompletado || 0);
        }
    }, [proceso?.id, proceso?.trabajoCompletado]);

    // LÓGICA DE CÁLCULO DE PROGRESO TEÓRICO (CATCH-UP)
    useEffect(() => {
        if (!proceso || proceso.estado !== 'Iniciado') {
            if (proceso) setCalculatedUnits(proceso.trabajoCompletado || 0);
            return;
        }

        const syncCalculatedUnits = () => {
            const now = new Date();
            const lastUpdate = (proceso.ultimoUpdate as any)?.toDate
                ? (proceso.ultimoUpdate as any).toDate()
                : new Date(proceso.ultimoUpdate || Date.now());

            const elapsedSeconds = Math.max(0, differenceInSeconds(now, lastUpdate));

            const activos = colaboradores.filter(c => !c.horaSalida && c.tipo === 'colaborador');
            const vEquipoMin = (proceso.velocidadTeorica || 0) * activos.length;
            const unitsPerSec = vEquipoMin / 60;

            // Unidades progresadas = unidades en DB + (unidades por segundo * tiempo transcurrido)
            const baseUnits = proceso.trabajoCompletado || 0;
            const extraUnits = unitsPerSec * elapsedSeconds;

            setCalculatedUnits(baseUnits + extraUnits);
        };

        syncCalculatedUnits();
        const timerProgress = setInterval(syncCalculatedUnits, 1000);
        return () => clearInterval(timerProgress);
    }, [proceso?.id, proceso?.estado, proceso?.ultimoUpdate, proceso?.trabajoCompletado, colaboradores, proceso?.velocidadTeorica]);

    useEffect(() => {
        if (!proceso) return;

        const update = () => {
            const colabs = colaboradores || [];
            const latestProceso = { ...proceso, trabajoCompletado: calculatedUnits };
            const newStats = calculateProductivity(latestProceso, colabs);
            setStats(newStats);

            // Reloj de Setup (usa diferencia de tiempo real)
            if (proceso.setupEstado === 'en curso' && proceso.setupStartTime) {
                const start = (proceso.setupStartTime as any).toDate ? (proceso.setupStartTime as any).toDate() : new Date(proceso.setupStartTime);
                const duracion = Math.max(0, differenceInSeconds(new Date(), start));
                const total = (proceso.setupTiempoAcumulado || 0) + duracion;
                setSetupTimerStr(formatSeconds(total));
            } else {
                const total = proceso.setupTiempoAcumulado || proceso.tiempoSetupSegundos || 0;
                setSetupTimerStr(formatSeconds(total));
            }

            // Reloj de Calidad
            if (proceso.calidadEstado === 'esperando' && proceso.calidadLlamadaEn) {
                const start = (proceso.calidadLlamadaEn as any).toDate ? (proceso.calidadLlamadaEn as any).toDate() : new Date(proceso.calidadLlamadaEn);
                const duracion = Math.max(0, differenceInSeconds(new Date(), start));
                setCalidadTimerStr(formatSeconds(duracion));
            } else if (proceso.calidadEstado === 'inspeccion' && proceso.calidadLlegadaEn) {
                const start = (proceso.calidadLlegadaEn as any).toDate ? (proceso.calidadLlegadaEn as any).toDate() : new Date(proceso.calidadLlegadaEn);
                const duracion = Math.max(0, differenceInSeconds(new Date(), start));
                setCalidadTimerStr(formatSeconds(duracion));
            }

            // AUTO-ACTIVACIÓN DEL PERÍODO DE GRACIA
            if (proceso.estado === 'Iniciado' && !proceso.inicioPeriodoGracia && (proceso.cantidadProducir - calculatedUnits <= 0)) {
                updateProceso(id, {
                    inicioPeriodoGracia: Timestamp.now(),
                    trabajoCompletado: calculatedUnits,
                    ultimoUpdate: Timestamp.now()
                });
                addEventoLog(id, "Período de gracia iniciado", "El tiempo restante ahora es fijo (15 minutos).", "SISTEMA", "Sistema");
            }
        };

        update();
        const timer = setInterval(update, 1000);
        return () => clearInterval(timer);
    }, [proceso, colaboradores, calculatedUnits]);

    const handleConfirmJustificacion = async (justificacion: string) => {
        if (!proceso) return;

        if (modalJustificacion.tipo === 'pausa') {
            // Calcular el tiempo restante en el momento de la pausa
            const stats = calculateProductivity(proceso, colaboradores);
            const tiempoRestanteAlPausar = stats.segundosTotalesRestantes;

            await updateProceso(id, {
                estado: 'Pausado',
                trabajoCompletado: calculatedUnits,
                ultimoUpdate: Timestamp.now(), // Snap del tiempo al pausar
            });
            await addEventoLog(id, `Proceso Pausado`, justificacion, "ESTADO", user?.username || 'sistema');
        } else if (modalJustificacion.tipo === 'salida' && pendingExitLog) {
            try {
                const docRef = doc(db, 'colaboradores_log', pendingExitLog.id);
                await updateDoc(docRef, {
                    horaSalida: Timestamp.now()
                });
                // Al cambiar personal, sincronizamos las unidades calculadas y el tiempo
                const updatesToProcess: any = {
                    trabajoCompletado: calculatedUnits,
                    ultimoUpdate: Timestamp.now()
                };

                // Auto-pausar cuando no queda personal (independiente del tipo de proceso)
                const personalRestante = colaboradores.filter(c => c.id !== pendingExitLog.id && !c.horaSalida).length;
                const tipoActual = getTipoProcesoReal(proceso);
                if (proceso.estado === 'Iniciado' && personalRestante === 0) {
                    updatesToProcess.estado = 'Pausado';
                    updatesToProcess.pausadoPorFaltaDePersonal = true; // Marcar como pausa automática
                }

                await updateProceso(id, updatesToProcess);
                await addEventoLog(id, "Salida de Personal", `Salida de ${pendingExitLog.nombre}: ${justificacion}`, "PERSONAL", user?.username || 'sistema');

                if (personalRestante === 0) {
                    await addEventoLog(id, 'Proceso Pausado Automáticamente', `Proceso pausado automáticamente al no quedar colaboradores activos`, 'SISTEMA', 'Sistema');
                }

                setStaffMessage({ text: `${pendingExitLog.nombre} - QUE DIOS LO ACOMPAÑE`, type: 'exit' });
                setTimeout(() => setStaffMessage(null), 4000);
            } catch (error) {
                console.error(error);
            }
            setPendingExitLog(null);
        }

        setModalJustificacion({ show: false, tipo: 'pausa' });
    };

    const handleSetupAction = async (action: 'start' | 'pause' | 'finish') => {
        if (!proceso || proceso.estado === 'Finalizado') return;

        try {
            const updates: any = {};
            if (action === 'start') {
                updates.setupEstado = 'en curso';
                updates.setupStartTime = Timestamp.now();
                await addEventoLog(id, "Setup Iniciado", "Inicio de preparación de línea", "SETUP", user?.username || 'sistema');
            } else if (action === 'pause') {
                const start = (proceso.setupStartTime as any).toDate();
                const duracion = differenceInSeconds(new Date(), start);
                updates.setupTiempoAcumulado = (proceso.setupTiempoAcumulado || 0) + duracion;
                updates.setupEstado = 'pausado';
                updates.setupStartTime = null;
                await addEventoLog(id, "Setup Pausado", `Acumulado: ${setupTimerStr}`, "SETUP", user?.username || 'sistema');
            } else if (action === 'finish') {
                let total = proceso.setupTiempoAcumulado || 0;
                if (proceso.setupEstado === 'en curso' && proceso.setupStartTime) {
                    const start = (proceso.setupStartTime as any).toDate();
                    total += differenceInSeconds(new Date(), start);
                }
                updates.setupEstado = 'finalizado';
                updates.tiempoSetupSegundos = total;
                updates.setupStartTime = null;
                await addEventoLog(id, "Setup Finalizado", `Duración total: ${setupTimerStr}`, "SETUP", user?.username || 'sistema');
            }
            await updateProceso(id, updates);
        } catch (error) {
            console.error(error);
        }
    };

    const handleCalidadAction = async (action: 'call' | 'arrival' | 'approval' | 'reset') => {
        if (!proceso || proceso.estado === 'Finalizado') return;

        try {
            const updates: any = {};
            if (action === 'call') {
                updates.calidadEstado = 'esperando';
                updates.calidadLlamadaEn = Timestamp.now();
                await addEventoLog(id, "Calidad Solicitada", "Se requiere inspección de calidad", "CALIDAD", user?.username || 'sistema');
            } else if (action === 'arrival') {
                updates.calidadEstado = 'inspeccion';
                updates.calidadLlegadaEn = Timestamp.now();
                await addEventoLog(id, "Calidad Llegada", "Personal de calidad en la línea", "CALIDAD", user?.username || 'sistema');
            } else if (action === 'approval') {
                updates.calidadEstado = 'aprobado';
                updates.calidadAprobadaEn = Timestamp.now();
                await addEventoLog(id, "Calidad Aprobada", "Proceso aprobado por calidad", "CALIDAD", user?.username || 'sistema');
            } else if (action === 'reset') {
                updates.calidadEstado = 'ninguno';
                updates.calidadLlamadaEn = null;
                updates.calidadLlegadaEn = null;
                updates.calidadAprobadaEn = null;
            }
            await updateProceso(id, updates);
        } catch (error) {
            console.error(error);
        }
    };

    const handleToggleEstado = async () => {
        if (!proceso || proceso.estado === 'Finalizado') return;

        if (proceso.estado === 'Iniciado') {
            setModalJustificacion({ show: true, tipo: 'pausa' });
        } else {
            const updates: any = {
                estado: 'Iniciado',
                ultimoUpdate: Timestamp.now() // Snap del tiempo al reanudar
                // NO borrar tiempoRestanteAlPausar: se mantiene como base
            };
            if (!proceso.horaInicioReal) {
                updates.horaInicioReal = Timestamp.now();
            }
            await updateProceso(id, updates);
            await addEventoLog(id, `Proceso Reanudado`, `Reinicio de operación manual`, "ESTADO", user?.username || 'sistema');
        }
    };

    const handleManualProgress = async (val: number) => {
        if (!proceso || proceso.estado === 'Finalizado') return;
        try {
            const docRef = doc(db, 'procesos', id);
            await updateDoc(docRef, {
                trabajoCompletado: calculatedUnits + val,
                ultimoUpdate: Timestamp.now() // Resincronizamos tiempo
            });
        } catch (error) {
            console.error(error);
        }
    };

    const handleSalidaColaborador = async (logId: string, nombre: string) => {
        setPendingExitLog({ id: logId, nombre });
        setModalJustificacion({ show: true, tipo: 'salida' });
    };

    const handleFinalizarProceso = async () => {
        if (!proceso) return;
        if (!confirm("¿Está seguro de que desea FINALIZAR este proceso? Esta acción no se puede deshacer. Todo el personal activo será marcado como fuera de línea.")) return;

        try {
            const now = Timestamp.now();

            // 1. Finalizar el proceso
            await updateProceso(id, {
                estado: 'Finalizado',
                horaFinReal: now,
                trabajoCompletado: calculatedUnits // Sincronizamos final
            });

            // 2. Marcar salida de todo el personal activo
            const activos = colaboradores.filter(c => !c.horaSalida);
            for (const colab of activos) {
                await updateDoc(doc(db, 'colaboradores_log', colab.id), {
                    horaSalida: now
                });
            }

            await addEventoLog(id, "Proceso Finalizado", `El proceso ha sido marcado como COMPLETADO. Salida automática de ${activos.length} colaboradores.`, "ESTADO", user?.username || 'sistema');
            router.push('/procesos');
        } catch (error) {
            console.error(error);
        }
    };

    if (loading) return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center text-white gap-4">
            <div className="h-12 w-12 border-4 border-primary-blue border-t-transparent rounded-full animate-spin" />
            <p className="font-black tracking-widest uppercase">Cargando Monitor de Línea...</p>
        </div>
    );

    if (!proceso) return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center text-white gap-4">
            <AlertTriangle className="h-16 w-16 text-danger-red" />
            <p className="font-black tracking-widest uppercase text-2xl">Proceso no encontrado</p>
            <button onClick={() => router.push('/procesos')} className="bg-white/10 px-6 py-3 rounded-xl font-bold">Volver al inicio</button>
        </div>
    );

    const handleStaffAction = async (actionType: 'entry' | 'exit') => {
        if (!staffCode.trim()) return;
        setStaffActionLoading(true);
        setStaffMessage(null);

        try {
            const maestro = await getColaboradorByClave(staffCode.trim());
            if (!maestro) {
                setStaffMessage({ text: 'CÓDIGO NO ENCONTRADO', type: 'error' });
                setTimeout(() => setStaffMessage(null), 4000);
                return;
            }

            if (actionType === 'entry') {
                // Verificar si ya está en ESTE proceso
                const yaEnProceso = colaboradores.find(c => c.colaboradorId === maestro.id && !c.horaSalida);
                if (yaEnProceso) {
                    setStaffMessage({ text: `${maestro.nombreCompleto} YA ESTÁ EN LÍNEA`, type: 'info' });
                    setTimeout(() => setStaffMessage(null), 4000);
                    return;
                }

                // Verificar si está activo en OTRO proceso
                const activosGlobales = await getColaboradoresActivos();
                const yaActivoGlobal = activosGlobales.find(c => (c.colaboradorId === maestro.id || c.id === maestro.id) && c.procesoId !== id && !c.horaSalida);
                if (yaActivoGlobal) {
                    setStaffMessage({ text: `${maestro.nombreCompleto} ESTÁ EN OTRA LÍNEA`, type: 'error' });
                    setTimeout(() => setStaffMessage(null), 4000);
                    return;
                }

                // Para procesos anexos u otros, agregar directamente como colaborador sin mostrar modal
                const tipoActual = getTipoProcesoReal(proceso);
                if (tipoActual === 'anexos' || tipoActual === 'otros') {
                    await handleConfirmStaffEntry('colaborador', maestro);
                    setStaffCode('');
                } else {
                    // Para otros procesos, mostrar modal para elegir tipo
                    setPendingStaffMaestro(maestro);
                    setShowStaffTypeModal(true);
                    setStaffCode('');
                }
            } else {
                // SALIDA
                const logActivo = colaboradores.find(c => c.colaboradorId === maestro.id && !c.horaSalida);
                if (!logActivo) {
                    setStaffMessage({ text: `${maestro.nombreCompleto} NO ESTÁ AQUÍ`, type: 'error' });
                    setTimeout(() => setStaffMessage(null), 4000);
                    return;
                }

                setStaffCode('');
                handleSalidaColaborador(logActivo.id, maestro.nombreCompleto);
            }
        } catch (error) {
            console.error('Error en acción de personal:', error);
            setStaffMessage({ text: 'ERROR AL PROCESAR', type: 'error' });
            setTimeout(() => setStaffMessage(null), 4000);
        } finally {
            setStaffActionLoading(false);
        }
    };

    const handleConfirmStaffEntry = async (tipo: 'colaborador' | 'apoyo', maestroToAdd?: ColaboradorMaestro) => {
        const maestroActual = maestroToAdd || pendingStaffMaestro;
        if (!maestroActual || !proceso) return;
        try {
            await addColaboradorToLog({
                procesoId: id,
                colaboradorId: maestroActual.id,
                nombre: maestroActual.nombreCompleto,
                tipo: tipo,
                registradoPorUsuario: user?.username || 'Sistema',
                horaIngreso: Timestamp.now()
            });

            // Auto-iniciar procesos anexos u 'otros' cuando se agrega el primer personal
            const tipoActual = getTipoProcesoReal(proceso);
            const personalActivoPrev = colaboradores.filter(c => !c.horaSalida).length;

            if ((tipoActual === 'anexos' || tipoActual === 'otros') && proceso.estado === 'Registrado' && personalActivoPrev === 0) {
                const updates: any = {
                    estado: 'Iniciado',
                    ultimoUpdate: Timestamp.now()
                };
                if (!proceso.horaInicioReal) {
                    updates.horaInicioReal = Timestamp.now();
                }
                await updateProceso(id, updates);
                await addEventoLog(id, 'Proceso Iniciado Automáticamente', `Proceso ${tipoActual} iniciado al registrar primer colaborador`, 'SISTEMA', 'Sistema');
            } else if (proceso.estado === 'Iniciado') {
                // SI EL PROCESO YA ESTÁ INICIADO: Sincronizar unidades y tiempo ANTES de que el nuevo personal cambie la velocidad
                // Esto evita el "salto" de tiempo que vio el usuario
                await updateProceso(id, {
                    trabajoCompletado: calculatedUnits,
                    ultimoUpdate: Timestamp.now()
                });
            }

            // Auto-reanudar si está pausado y no hay personal activo (fue pausado automáticamente por falta de personal)
            if (proceso.estado === 'Pausado' && personalActivoPrev === 0 && (proceso as any).pausadoPorFaltaDePersonal) {
                await updateProceso(id, {
                    estado: 'Iniciado',
                    ultimoUpdate: Timestamp.now(),
                    pausadoPorFaltaDePersonal: false // Limpiar el flag
                });
                await addEventoLog(id, 'Proceso Reanudado Automáticamente', `Proceso reanudado al registrar colaborador después de pausa automática por falta de personal`, 'SISTEMA', 'Sistema');
            }

            setStaffMessage({ text: `${maestroActual.nombreCompleto} - QUÉ MOP!`, type: 'success' });
            setTimeout(() => setStaffMessage(null), 4000);
        } catch (error) {
            console.error(error);
        } finally {
            setShowStaffTypeModal(false);
            setPendingStaffMaestro(null);
        }
    };

    const personalActivo = colaboradores.filter(c => !c.horaSalida).length;
    const porcentaje = Math.min(100, Math.round((proceso.trabajoCompletado / proceso.cantidadProducir) * 100) || 0);

    return (
        <div className="h-screen bg-background text-white flex flex-col overflow-hidden">
            {/* Header Compacto */}
            <header className="border-b border-white/10 bg-black/50 backdrop-blur-md p-4 flex items-center justify-between sticky top-0 z-50">
                <div className="flex flex-wrap items-center gap-4">
                    <button
                        onClick={() => router.push('/procesos')}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors border border-white/5 bg-white/5"
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                    <div>
                        <h1 className="text-lg md:text-xl font-black tracking-tight flex flex-wrap items-center gap-2 md:gap-3">
                            <span className="text-primary-blue">MONITOREO</span>
                            <span className="hidden md:block w-1.5 h-1.5 rounded-full bg-white/20" />
                            <span className="text-gray-400 font-mono text-xs md:text-sm">{proceso.ordenProduccion}</span>
                        </h1>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowEventsModal(true)}
                        className="flex items-center gap-2 bg-white/5 hover:bg-white/10 px-4 py-1.5 rounded-full border border-white/10 text-xs font-black uppercase tracking-widest transition-all"
                    >
                        <History className="h-4 w-4" /> Historial ({eventos.length})
                    </button>
                    {proceso.contabilizaSetup && (
                        <div className={cn(
                            "px-4 py-1.5 rounded-full border text-sm font-black uppercase tracking-widest flex items-center gap-2",
                            proceso.setupEstado === 'en curso' ? "border-orange-500/20 bg-orange-500/10 text-orange-500" :
                                proceso.setupEstado === 'pausado' ? "border-yellow-500/20 bg-yellow-500/10 text-yellow-500" :
                                    proceso.setupEstado === 'finalizado' ? "border-blue-500/20 bg-blue-500/10 text-blue-500" :
                                        "border-white/10 text-gray-400"
                        )}>
                            SETUP: {proceso.setupEstado || 'Pendiente'}
                        </div>
                    )}
                    <div className={cn(
                        "px-4 py-1.5 rounded-full border text-sm font-black uppercase tracking-widest flex items-center gap-2",
                        !proceso.utilizaTemporizador && !proceso.contabilizaSetup ? (
                            personalActivo > 0 ? "border-success-green/20 bg-success-green/10 text-success-green" : "border-warning-yellow/20 bg-warning-yellow/10 text-warning-yellow"
                        ) : (
                            proceso.estado === 'Iniciado' ? "border-success-green/20 bg-success-green/10 text-success-green" :
                                proceso.estado === 'Pausado' ? "border-warning-yellow/20 bg-warning-yellow/10 text-warning-yellow" :
                                    "border-white/10 text-gray-400"
                        )
                    )}>
                        <div className={cn(
                            "h-2 w-2 rounded-full",
                            !proceso.utilizaTemporizador && !proceso.contabilizaSetup ? (
                                personalActivo > 0 ? "bg-success-green animate-pulse" : "bg-warning-yellow"
                            ) : (
                                proceso.estado === 'Iniciado' ? "bg-success-green animate-pulse" : "bg-current"
                            )
                        )} />
                        {!proceso.utilizaTemporizador && !proceso.contabilizaSetup ? (
                            personalActivo > 0 ? "EN PROCESO" : "EN PAUSA"
                        ) : (
                            `PRODUCCIÓN: ${proceso.estado}`
                        )}
                    </div>
                </div>
            </header>

            {/* Main Layout Grid */}
            <main className="flex-1 p-4 md:p-6 grid grid-cols-12 gap-4 md:gap-6 overflow-hidden max-w-[1900px] mx-auto w-full h-full">

                {/* Left Column: Giant Timer */}
                <div className={cn("flex flex-col gap-6 h-full", proceso.utilizaTemporizador ? "col-span-12 lg:col-span-8" : "col-span-12")}>
                    {/* INFORMACIÓN DEL PROCESO - Interfaz adaptada según tipo de proceso */}
                    {(() => {
                        const tipoProc = getTipoProcesoReal(proceso);

                        // Para procesos de tipo 'otros' (con orden de producción, sin temporizador)
                        if (tipoProc === 'otros') {
                            return (
                                <div className="glass rounded-[2.5rem] p-6 bg-gradient-to-br from-white/[0.05] to-transparent border-white/5 shrink-0">
                                    <div className="space-y-6">
                                        {/* Producto */}
                                        <div className="space-y-1">
                                            <p className="text-[clamp(0.5rem,0.8vw,0.65rem)] font-black text-gray-500 uppercase tracking-widest">Producto en proceso</p>
                                            <h4 className="text-[clamp(1.2rem,2vw,1.5rem)] font-black text-white leading-tight uppercase line-clamp-2">{proceso.producto}</h4>
                                        </div>

                                        {/* Orden de Producción y Lote - lado a lado */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center">
                                                <p className="text-[clamp(0.5rem,0.8vw,0.75rem)] font-black text-gray-500 uppercase mb-1">Orden de Producción</p>
                                                <p className="text-[clamp(1.2rem,2vw,1.5rem)] font-mono font-black text-white break-all">{proceso.ordenProduccion}</p>
                                            </div>

                                            <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center">
                                                <p className="text-[clamp(0.5rem,0.8vw,0.75rem)] font-black text-gray-500 uppercase mb-1">Lote</p>
                                                <p className="text-[clamp(1.2rem,2vw,1.5rem)] font-black text-white uppercase break-all">{proceso.lote}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        }

                        // Para procesos de tipo 'anexos' (sin orden de producción, sin temporizador)
                        if (tipoProc === 'anexos') {
                            return (
                                <div className="glass rounded-[2.5rem] p-6 bg-gradient-to-br from-white/[0.05] to-transparent border-white/5 shrink-0">
                                    <div className="space-y-1">
                                        {/* Producto */}
                                        <p className="text-[clamp(0.5rem,0.8vw,0.65rem)] font-black text-gray-500 uppercase tracking-widest">Proceso</p>
                                        <h4 className="text-[clamp(1.5rem,2.5vw,2rem)] font-black text-white leading-tight uppercase line-clamp-2">{proceso.producto}</h4>
                                    </div>
                                </div>
                            );
                        }

                        // Para procesos de tipo 'empaque' o por defecto, no mostrar sección (se muestra en columna derecha)
                        return null;
                    })()}

                    <div className="glass rounded-[3rem] p-8 md:p-12 flex flex-col items-center justify-center relative overflow-hidden group shadow-2xl border-white/5 flex-1 min-h-0">
                        {/* Progress Bar */}
                        {proceso.estado !== 'Registrado' && (
                            <div className="absolute top-0 left-0 w-full h-1.5 bg-white/5">
                                <div
                                    className="h-full bg-primary-blue shadow-[0_0_20px_rgba(59,130,246,1)] transition-all duration-1000"
                                    style={{ width: `${stats.porcentajeCompletado}%` }}
                                />
                            </div>
                        )}

                        {!proceso.utilizaTemporizador && !proceso.contabilizaSetup ? (
                            // Procesos sin temporizador: mostrar estado basado en personal
                            <>
                                <p className="text-[clamp(0.7rem,1.2vw,0.875rem)] font-black text-gray-500 uppercase tracking-[0.6em] mb-4 md:mb-6">ESTADO DEL PROCESO</p>
                                <h2 className={cn(
                                    "text-[clamp(4rem,15vw,9rem)] font-black tracking-tighter leading-none transition-colors duration-500 select-none",
                                    personalActivo > 0 ? "text-success-green" : "text-warning-yellow"
                                )}>
                                    {personalActivo > 0 ? "EN PROCESO" : "EN PAUSA"}
                                </h2>
                            </>
                        ) : (
                            // Procesos con temporizador: mostrar reloj normal
                            <>
                                <p className="text-[clamp(0.7rem,1.2vw,0.875rem)] font-black text-gray-500 uppercase tracking-[0.6em] mb-4 md:mb-6">
                                    {proceso.contabilizaSetup && proceso.setupEstado !== 'finalizado' ? 'TIEMPO DE SETUP' : 'TIEMPO RESTANTE ESTIMADO'}
                                </p>

                                <h2 className={cn(
                                    "font-black tracking-tighter leading-none transition-colors duration-500 tabular-nums select-none text-center",
                                    stats.tiempoRestanteStr === "PERSONAL REQUERIDO"
                                        ? "text-[clamp(2rem,8vw,6rem)]"
                                        : "text-[clamp(4rem,18vw,14rem)]",
                                    (proceso.estado === 'Iniciado' || proceso.setupEstado === 'en curso') ? "text-white" : "text-gray-600",
                                    stats.isGracePeriod && "text-warning-yellow",
                                    stats.isTiempoExtra && "text-danger-red animate-pulse"
                                )}>
                                    {proceso.contabilizaSetup && proceso.setupEstado !== 'finalizado' ? setupTimerStr : stats.tiempoRestanteStr}
                                </h2>
                            </>
                        )}

                        <div className="mt-8 md:mt-12 flex flex-col sm:flex-row flex-wrap justify-center gap-4 md:gap-6 w-full px-4">
                            {/* Setup Buttons */}
                            {proceso.contabilizaSetup && proceso.setupEstado !== 'finalizado' && proceso.estado !== 'Finalizado' && (
                                <>
                                    {proceso.setupEstado !== 'en curso' ? (
                                        <button
                                            onClick={() => handleSetupAction('start')}
                                            className="w-full sm:w-auto px-8 md:px-12 py-4 md:py-5 bg-orange-500 text-black rounded-3xl font-black text-lg md:text-xl flex items-center justify-center gap-4 transition-all transform hover:scale-105 shadow-xl shadow-orange-500/20"
                                        >
                                            <Play className="h-6 w-6 md:h-7 md:w-7 fill-current" /> {proceso.setupEstado === 'pausado' ? 'REANUDAR' : 'INICIAR SETUP'}
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handleSetupAction('pause')}
                                            className="w-full sm:w-auto px-8 md:px-12 py-4 md:py-5 bg-yellow-500 text-black rounded-3xl font-black text-lg md:text-xl flex items-center justify-center gap-4 transition-all transform hover:scale-105 shadow-xl shadow-yellow-500/20"
                                        >
                                            <Pause className="h-6 w-6 md:h-7 md:w-7 fill-current" /> PAUSAR SETUP
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleSetupAction('finish')}
                                        className="w-full sm:w-auto px-8 md:px-12 py-4 md:py-5 bg-blue-500 text-white rounded-3xl font-black text-lg md:text-xl flex items-center justify-center gap-4 transition-all transform hover:scale-105 shadow-xl shadow-blue-500/20"
                                    >
                                        <Check className="h-6 w-6 md:h-7 md:w-7" /> FINALIZAR SETUP
                                    </button>
                                </>
                            )}

                            {/* Production Buttons */}
                            {(!proceso.contabilizaSetup || proceso.setupEstado === 'finalizado') && getTipoProcesoReal(proceso) !== 'anexos' && (
                                <>
                                    {proceso.estado !== 'Finalizado' && (
                                        (proceso as any).pausadoPorFaltaDePersonal ? (
                                            // Mostrar leyenda cuando está pausado por falta de personal
                                            <div className="px-12 py-5 bg-warning-yellow/10 border-2 border-warning-yellow rounded-3xl font-black text-xl flex items-center gap-4">
                                                <AlertTriangle className="h-7 w-7 text-warning-yellow" />
                                                <span className="text-warning-yellow">PAUSADO - FALTA DE PERSONAL</span>
                                            </div>
                                        ) : (
                                            // Botón de control normal
                                            <button
                                                onClick={handleToggleEstado}
                                                className={cn(
                                                    "w-full sm:w-auto px-8 md:px-12 py-4 md:py-5 rounded-3xl font-black text-lg md:text-xl flex items-center justify-center gap-4 transition-all transform hover:scale-105 shadow-xl",
                                                    (proceso.estado === 'Pausado' || proceso.estado === 'Registrado') ? "bg-success-green text-black hover:bg-green-600 shadow-success-green/20" : "bg-warning-yellow text-black hover:bg-yellow-600 shadow-warning-yellow/20"
                                                )}
                                            >
                                                {(proceso.estado === 'Pausado' || proceso.estado === 'Registrado') ? (
                                                    <><Play className="h-7 w-7 fill-current" /> {proceso.estado === 'Registrado' ? 'INICIAR PRODUCCIÓN' : 'REANUDAR'}</>
                                                ) : (
                                                    <><Pause className="h-6 w-6 md:h-7 md:w-7 fill-current" /> PAUSAR</>
                                                )}
                                            </button>
                                        )
                                    )}
                                    {proceso.estado !== 'Finalizado' && (
                                        <button
                                            className="w-full sm:w-auto bg-accent-purple/10 hover:bg-accent-purple hover:text-black text-accent-purple border border-accent-purple/20 px-8 md:px-12 py-4 md:py-5 rounded-3xl font-black text-lg md:text-xl flex items-center justify-center gap-4 transition-all"
                                            onClick={() => handleCalidadAction(proceso.calidadEstado === 'aprobado' ? 'reset' : 'call')}
                                        >
                                            <ShieldCheck className="h-6 w-6 md:h-7 md:w-7" /> {proceso.calidadEstado === 'aprobado' ? 'CALIDAD (LISTO)' : 'CALIDAD'}
                                        </button>
                                    )}
                                    {proceso.estado !== 'Finalizado' && (
                                        <button
                                            className="w-full sm:w-auto bg-danger-red/10 hover:bg-danger-red hover:text-white text-danger-red border border-danger-red/20 px-8 md:px-12 py-4 md:py-5 rounded-3xl font-black text-lg md:text-xl flex items-center justify-center gap-4 transition-all"
                                            onClick={handleFinalizarProceso}
                                        >
                                            <Square className="h-6 w-6 md:h-7 md:w-7 fill-current" /> TERMINAR
                                        </button>
                                    )}
                                </>
                            )}
                        </div>

                        {/* LINEA DIVISORA Y CONTROL DE PERSONAL EXPRESS (DENTRO DE LA SECCIÓN) */}
                        <div className="mt-12 w-full pt-10 border-t border-white/5 max-w-4xl">
                            <div className="flex items-center justify-between mb-4 md:mb-6">
                                <div className="flex items-center gap-3">
                                    <Users className="h-5 w-5 text-success-green" />
                                    <h3 className="text-[clamp(0.6rem,1vw,0.875rem)] font-black tracking-[0.3em] uppercase text-gray-400">CONTROL DE PERSONAL</h3>
                                </div>
                                <button
                                    onClick={() => setShowStaffModal(true)}
                                    className="px-4 py-1.5 bg-success-green/10 text-success-green rounded-full text-[clamp(0.5rem,0.8vw,0.65rem)] font-black border border-success-green/20 hover:bg-success-green/20 transition-all uppercase tracking-widest"
                                >
                                    {personalActivo} EN LÍNEA – Ver Lista
                                </button>
                            </div>

                            <div className="flex flex-col md:flex-row gap-4 items-stretch">
                                <div className="relative flex-1">
                                    <input
                                        type="text"
                                        placeholder={proceso.estado === 'Finalizado' ? "CONTROL CERRADO - PROCESO FINALIZADO" : "ESCANEAR O DIGITAR CÓDIGO ID"}
                                        value={staffCode}
                                        onChange={(e) => setStaffCode(e.target.value.toUpperCase())}
                                        disabled={staffActionLoading || proceso.estado === 'Finalizado'}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-mono text-xl font-black text-center focus:border-primary-blue focus:ring-1 focus:ring-primary-blue outline-none transition-all placeholder:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleStaffAction('entry');
                                        }}
                                    />
                                    {staffActionLoading && (
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary-blue border-t-transparent" />
                                        </div>
                                    )}

                                    {/* Mensaje de Feedback de Personal */}
                                    {staffMessage && (
                                        <div className={cn(
                                            "absolute -top-12 left-0 right-0 py-2 px-4 rounded-xl text-center font-black text-xs uppercase tracking-widest animate-in slide-in-from-bottom-2 fade-in duration-300",
                                            staffMessage.type === 'success' ? "bg-success-green text-black" :
                                                staffMessage.type === 'error' ? "bg-danger-red text-white" :
                                                    staffMessage.type === 'info' ? "bg-primary-blue text-white" : "bg-warning-yellow text-black"
                                        )}>
                                            {staffMessage.text}
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => handleStaffAction('entry')}
                                        disabled={staffActionLoading || !staffCode || proceso.estado === 'Finalizado'}
                                        className="bg-success-green text-black px-8 py-4 rounded-2xl font-black text-sm uppercase flex items-center gap-3 hover:bg-green-600 disabled:opacity-50 transition-colors shadow-lg shadow-green-500/10"
                                    >
                                        <UserPlus className="h-5 w-5" /> Ingreso
                                    </button>
                                    <button
                                        onClick={() => handleStaffAction('exit')}
                                        disabled={staffActionLoading || !staffCode || proceso.estado === 'Finalizado'}
                                        className="bg-danger-red text-white px-8 py-4 rounded-2xl font-black text-sm uppercase flex items-center gap-3 hover:bg-red-600 disabled:opacity-50 transition-colors shadow-lg shadow-red-500/10"
                                    >
                                        <LogOut className="h-5 w-5" /> Salida
                                    </button>
                                    {/* BULK EXIT BUTTON */}
                                    {['supervisor', 'superadmin'].includes(user?.rol || '') && personalActivo > 0 && proceso.estado === 'Pausado' && (
                                        <button
                                            onClick={() => setShowModalBulkExit(true)}
                                            disabled={(proceso.estado as string) === 'Finalizado'}
                                            className="bg-warning-yellow text-black px-8 py-4 rounded-2xl font-black text-sm uppercase flex items-center gap-3 hover:bg-yellow-600 disabled:opacity-50 transition-colors shadow-lg shadow-yellow-500/10 ml-auto"
                                        >
                                            <LogOut className="h-5 w-5" /> Salida Grupal
                                        </button>
                                    )}
                                </div>
                            </div>

                        </div>
                    </div>
                </div >

                {/* Right Column: Metrics & Production Data - Solo si usa temporizador */}
                {
                    proceso.utilizaTemporizador && (
                        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6 overflow-auto pr-1">


                            {/* PRODUCTION DATA (SIDEBAR) */}
                            <div className="glass rounded-[2.5rem] p-8 bg-gradient-to-br from-white/[0.05] to-transparent border-white/5">
                                <div className="space-y-8">
                                    {/* Producto */}
                                    <div className="space-y-1">
                                        <p className="text-[clamp(0.5rem,0.8vw,0.65rem)] font-black text-gray-500 uppercase tracking-widest">Producto en proceso</p>
                                        <h4 className="text-[clamp(1.1rem,2vw,1.5rem)] font-black text-white leading-tight uppercase line-clamp-2">{proceso.producto}</h4>
                                    </div>

                                    {/* Líder de Línea - Solo para procesos con temporizador */}
                                    {proceso.utilizaTemporizador && (
                                        <div className="space-y-1 bg-primary-blue/10 p-4 md:p-5 rounded-2xl border border-primary-blue/10">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Users className="h-4 w-4 text-primary-blue" />
                                                <p className="text-[clamp(0.5rem,0.8vw,0.65rem)] font-black text-primary-blue uppercase tracking-widest">Líder de Línea</p>
                                            </div>
                                            <h4 className="text-[clamp(1rem,1.5vw,1.25rem)] font-black text-white uppercase truncate">{proceso.lider}</h4>
                                        </div>
                                    )}

                                    {/* Orden / Lote / Etapa Grid */}
                                    <div className="grid grid-cols-1 gap-4">
                                        <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                                            <p className="text-[clamp(0.5rem,0.8vw,0.75rem)] font-black text-gray-500 uppercase mb-1">Orden de Producción</p>
                                            <p className="text-[clamp(1.5rem,2.5vw,2.5rem)] font-mono font-black text-white break-all">{proceso.ordenProduccion}</p>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                                                <p className="text-[clamp(0.5rem,0.8vw,0.75rem)] font-black text-gray-500 uppercase mb-1">Lote</p>
                                                <p className="text-[clamp(1.2rem,2vw,1.875rem)] font-black text-white uppercase break-all">{proceso.lote}</p>
                                            </div>
                                            <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                                                <p className="text-[clamp(0.5rem,0.8vw,0.75rem)] font-black text-gray-500 uppercase mb-1">Etapa</p>
                                                <p className="text-[clamp(1.2rem,2vw,1.875rem)] font-black text-white uppercase">{proceso.etapa}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* METRICS (SIDEBAR) - Solo para procesos con temporizador */}
                            {proceso.utilizaTemporizador && (
                                <div className="space-y-4">
                                    <div className="glass p-4 md:p-6 rounded-3xl flex items-center gap-4 md:gap-5 border-l-4 border-primary-blue shadow-md">
                                        <div className="p-3 md:p-4 bg-primary-blue/10 rounded-2xl shrink-0">
                                            <Activity className="h-6 w-6 md:h-7 md:w-7 text-primary-blue" />
                                        </div>
                                        <div>
                                            <p className="text-[clamp(0.5rem,0.8vw,0.65rem)] font-black text-gray-400 uppercase tracking-widest mb-1">Velocidad Equipo</p>
                                            <h3 className="text-[clamp(1.5rem,2.5vw,2rem)] font-black tracking-tight">{stats.velocidadActual} <span className="text-xs text-gray-500">est/min</span></h3>
                                        </div>
                                    </div>

                                    <div className="glass p-4 md:p-6 rounded-3xl flex items-center gap-4 md:gap-5 border-l-4 border-accent-purple shadow-md">
                                        <div className="p-3 md:p-4 bg-accent-purple/10 rounded-2xl shrink-0">
                                            <ClipboardList className="h-6 w-6 md:h-7 md:w-7 text-accent-purple" />
                                        </div>
                                        <div>
                                            <p className="text-[clamp(0.5rem,0.8vw,0.65rem)] font-black text-gray-400 uppercase tracking-widest mb-1">Unidades Pendientes</p>
                                            <h3 className="text-[clamp(1.5rem,2.5vw,2rem)] font-black tracking-tight">
                                                {Math.max(0, proceso.cantidadProducir - calculatedUnits).toLocaleString()}
                                                <span className="text-[10px] text-gray-500 ml-2">por empacar</span>
                                            </h3>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                }
            </main >


            {
                modalJustificacion.show && (
                    <ModalJustificacion
                        tipo={modalJustificacion.tipo}
                        onConfirm={handleConfirmJustificacion}
                        onCancel={() => {
                            setModalJustificacion({ ...modalJustificacion, show: false });
                            setPendingExitLog(null);
                        }}
                    />
                )
            }

            {
                showModalBulkExit && (
                    <ModalBulkExit
                        procesoId={id}
                        userId={(user as any)?.uid}
                        onClose={() => setShowModalBulkExit(false)}
                        onSuccess={(exitCount) => {
                            setStaffMessage({
                                text: `✅ ${exitCount} salida(s) registrada(s)`,
                                type: 'success'
                            });
                            setTimeout(() => setStaffMessage(null), 4000);
                        }}
                    />
                )
            }

            {/* MODAL TIPO DE PERSONAL (INGRESO) */}
            {
                showStaffTypeModal && pendingStaffMaestro && (
                    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
                        <div className="glass w-full max-w-lg rounded-[3rem] overflow-hidden border-white/10 shadow-2xl flex flex-col items-center p-12 gap-8 text-center animate-in zoom-in duration-300">
                            <div className="p-6 bg-primary-blue/20 rounded-full">
                                <UserPlus className="h-12 w-12 text-primary-blue" />
                            </div>
                            <div>
                                <h3 className="text-3xl font-black mb-2 uppercase tracking-tight">{pendingStaffMaestro.nombreCompleto}</h3>
                                <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Seleccione el tipo de ingreso para este proceso</p>
                            </div>

                            <div className="grid grid-cols-1 w-full gap-4">
                                <button
                                    onClick={() => handleConfirmStaffEntry('colaborador')}
                                    className="group relative flex items-center justify-between p-6 bg-white/5 hover:bg-success-green hover:text-black rounded-3xl border border-white/10 transition-all text-left"
                                >
                                    <div>
                                        <p className="text-xl font-black uppercase">Colaborador</p>
                                        <p className="text-[10px] opacity-60 font-bold uppercase tracking-widest mt-1">Personal base de la línea</p>
                                    </div>
                                    <Activity className="h-6 w-6 opacity-40 group-hover:opacity-100" />
                                </button>

                                <button
                                    onClick={() => handleConfirmStaffEntry('apoyo')}
                                    className="group relative flex items-center justify-between p-6 bg-white/5 hover:bg-primary-blue hover:text-white rounded-3xl border border-white/10 transition-all text-left"
                                >
                                    <div>
                                        <p className="text-xl font-black uppercase">Apoyo</p>
                                        <p className="text-[10px] opacity-60 font-bold uppercase tracking-widest mt-1">Personal de refuerzo temporal</p>
                                    </div>
                                    <Users className="h-6 w-6 opacity-40 group-hover:opacity-100" />
                                </button>
                            </div>

                            <button
                                onClick={() => {
                                    setShowStaffTypeModal(false);
                                    setPendingStaffMaestro(null);
                                }}
                                className="text-gray-500 font-black text-[10px] uppercase tracking-[0.3em] hover:text-white transition-colors"
                            >
                                Cancelar registro
                            </button>
                        </div>
                    </div>
                )
            }

            {/* MODAL DE PERSONAL */}
            {
                showStaffModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                        <div className="glass w-full max-w-2xl rounded-[2.5rem] overflow-hidden flex flex-col max-h-[85vh] border-white/10 shadow-2xl">
                            <div className="p-8 border-b border-white/10 flex items-center justify-between bg-white/5">
                                <h3 className="text-2xl font-black flex items-center gap-3">
                                    <Users className="h-7 w-7 text-primary-blue" /> PERSONAL EN LINEA
                                </h3>
                                <button onClick={() => setShowStaffModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                    <X className="h-7 w-7" />
                                </button>
                            </div>
                            <div className="p-8 overflow-auto flex-1 space-y-4">
                                <div className="flex justify-between items-center mb-4">
                                    <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">Colaboradores cargados en el proceso</p>
                                </div>
                                <div className="grid grid-cols-1 gap-3">
                                    {colaboradores.map((colab) => (
                                        <div key={colab.id} className="flex items-center justify-between p-5 bg-white/5 rounded-3xl border border-white/5 group hover:border-white/20 transition-all">
                                            <div className="flex items-center gap-5">
                                                <div className="w-12 h-12 bg-primary-blue/20 rounded-2xl flex items-center justify-center font-black text-sm text-primary-blue">
                                                    {colab.nombre.substring(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-black text-lg uppercase">{colab.nombre}</p>
                                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em]">
                                                        ID: {colab.colaboradorId} | Tipo: {colab.tipo}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-8">
                                                {colab.horaSalida ? (
                                                    <div className="text-right">
                                                        <p className="text-[10px] font-black text-gray-500 uppercase">Salida registrada</p>
                                                        <p className="font-mono text-sm text-gray-400">
                                                            {format((colab.horaSalida as any).toDate(), 'HH:mm:ss')}
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <div className="text-right">
                                                        <p className="text-[10px] font-black text-gray-500 uppercase">Estado</p>
                                                        <p className="font-mono text-sm text-success-green font-bold animate-pulse">EN LINEA</p>
                                                    </div>
                                                )}
                                                {!colab.horaSalida && proceso.estado !== 'Finalizado' && (
                                                    <button
                                                        onClick={() => handleSalidaColaborador(colab.id, colab.nombre)}
                                                        className="p-3 bg-danger-red/10 text-danger-red rounded-xl hover:bg-danger-red hover:text-white transition-all"
                                                        title="Registrar Salida"
                                                    >
                                                        <LogOut className="h-5 w-5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* MODAL DE EVENTOS */}
            {
                showEventsModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                        <div className="glass w-full max-w-2xl rounded-[2.5rem] overflow-hidden flex flex-col max-h-[85vh] border-white/10 shadow-2xl">
                            <div className="p-8 border-b border-white/10 flex items-center justify-between bg-white/5">
                                <h3 className="text-2xl font-black flex items-center gap-3">
                                    <History className="h-7 w-7 text-primary-blue" /> HISTORIAL DE EVENTOS
                                </h3>
                                <button onClick={() => setShowEventsModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                    <X className="h-7 w-7" />
                                </button>
                            </div>
                            <div className="p-8 overflow-auto flex-1 space-y-6">
                                {eventos.map((ev) => (
                                    <div key={ev.id} className="relative pl-8 border-l-2 border-primary-blue/30 pb-6 last:pb-0">
                                        <div className="absolute top-0 -left-[9px] h-4 w-4 rounded-full bg-primary-blue border-4 border-black" />
                                        <div className="flex justify-between items-start mb-2">
                                            <p className="text-xs font-black text-primary-blue uppercase tracking-widest">
                                                {ev.horaEvento ? format((ev.horaEvento as any).toDate(), 'HH:mm:ss') : 'Reciente'}
                                            </p>
                                            <span className="text-[10px] font-bold text-gray-500 bg-white/5 px-2 py-1 rounded-lg">
                                                {ev.clasificacion}
                                            </span>
                                        </div>
                                        <p className="text-lg font-black text-gray-100 mb-1">{ev.evento}</p>
                                        {ev.justificacion && (
                                            <div className="bg-white/5 p-4 rounded-2xl border border-white/5 mt-3">
                                                <p className="text-sm text-gray-400 italic font-medium leading-relaxed">"{ev.justificacion}"</p>
                                            </div>
                                        )}
                                        <p className="text-[10px] text-gray-600 font-bold mt-4 uppercase tracking-tighter">Registrado por: {ev.registradoPorUsuario}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* VENTANA DE CALIDAD */}
            {(proceso.calidadEstado === 'esperando' || proceso.calidadEstado === 'inspeccion') && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md">
                    <div className="bg-warning-yellow p-10 rounded-[4rem] shadow-[0_0_100px_rgba(251,191,36,0.5)] max-w-xl w-full transform animate-in fade-in zoom-in duration-300 border-4 border-black/10">
                        <div className="flex flex-col items-center text-center gap-8">
                            <div className="bg-black/10 p-6 rounded-full shadow-inner">
                                <ShieldCheck className="h-20 w-20 text-black animate-pulse" />
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-[clamp(2rem,6vw,4rem)] font-black uppercase tracking-tighter text-black leading-tight">
                                    {proceso.calidadEstado === 'esperando' ? 'En espera de calidad' : 'Inspección de calidad'}
                                </h3>
                                <div className="flex items-center justify-center gap-2 text-black/50 font-black uppercase tracking-[0.2em] text-[clamp(0.7rem,1.2vw,0.875rem)]">
                                    <Clock className="h-4 w-4" />
                                    {proceso.calidadEstado === 'esperando' ? 'Tiempo transcurrido' : 'Tiempo en inspección'}
                                </div>
                                <div className="text-[clamp(4rem,15vw,8rem)] font-mono font-black text-black mt-4 tracking-tighter drop-shadow-sm">
                                    {calidadTimerStr}
                                </div>
                            </div>

                            <div className="flex flex-col gap-4 w-full mt-2">
                                {proceso.calidadEstado === 'esperando' ? (
                                    <button
                                        onClick={() => handleCalidadAction('arrival')}
                                        className="w-full bg-black text-warning-yellow py-6 rounded-3xl font-black text-2xl hover:bg-gray-900 transition-all flex items-center justify-center gap-4 shadow-xl translate-y-0 active:translate-y-1"
                                    >
                                        <Timer className="h-8 w-8" /> INICIO CALIDAD
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleCalidadAction('approval')}
                                        className="w-full bg-black text-success-green py-6 rounded-3xl font-black text-2xl hover:bg-gray-900 transition-all flex items-center justify-center gap-4 shadow-xl translate-y-0 active:translate-y-1"
                                    >
                                        <Check className="h-8 w-8" /> APROBACIÓN DE CALIDAD
                                    </button>
                                )}

                                <button
                                    onClick={() => handleCalidadAction('reset')}
                                    className="text-black/40 font-black uppercase tracking-widest text-xs hover:text-black transition-colors mt-2"
                                >
                                    Cancelar o Reiniciar Proceso de Calidad
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* POPUP DE NOTIFICACIÓN DE PERSONAL (4 SEGUNDOS) */}
            {
                staffMessage && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 pointer-events-none">
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
                        <div className={cn(
                            "glass relative min-w-[600px] p-16 rounded-[4rem] border-4 shadow-[0_0_150px_rgba(0,0,0,0.8)] transform animate-in fade-in zoom-in duration-500 flex flex-col items-center gap-10",
                            staffMessage.type === 'success' ? "border-success-green/60 bg-success-green/10" :
                                (staffMessage.type === 'error' || staffMessage.type === 'exit') ? "border-danger-red/60 bg-danger-red/10" :
                                    "border-primary-blue/60 bg-primary-blue/10"
                        )}>
                            <div className={cn(
                                "p-10 rounded-full shadow-2xl",
                                staffMessage.type === 'success' ? "bg-success-green text-black" :
                                    (staffMessage.type === 'error' || staffMessage.type === 'exit') ? "bg-danger-red text-white" :
                                        "bg-primary-blue text-white"
                            )}>
                                {staffMessage.type === 'success' ? <UserPlus className="h-24 w-24" /> :
                                    staffMessage.type === 'exit' ? <LogOut className="h-24 w-24" /> :
                                        staffMessage.type === 'error' ? <X className="h-24 w-24" /> :
                                            <Users className="h-24 w-24" />}
                            </div>
                            <h4 className={cn(
                                "text-6xl font-black text-center uppercase tracking-tighter leading-tight max-w-[800px]",
                                staffMessage.type === 'success' ? "text-success-green" :
                                    (staffMessage.type === 'error' || staffMessage.type === 'exit') ? "text-danger-red" :
                                        "text-primary-blue"
                            )}>
                                {staffMessage.text}
                            </h4>
                            <div className="w-full max-w-sm h-2 bg-white/10 rounded-full overflow-hidden mt-4">
                                <div className={cn(
                                    "h-full animate-[progress_4s_linear]",
                                    staffMessage.type === 'success' ? "bg-success-green" :
                                        (staffMessage.type === 'error' || staffMessage.type === 'exit') ? "bg-danger-red" :
                                            "bg-primary-blue"
                                )} />
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
