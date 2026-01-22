"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Plus,
    Search,
    RefreshCw,
    Settings,
    LogOut,
    Play,
    Pause,
    CheckCircle2,
    Clock,
    ChevronDown,
    Share2,
    Check,
    X,
    Users as UsersIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Proceso, ProcesoEstado, TipoProceso } from '@/types';
import { useProcesos } from '@/hooks/useProcesos';
import { useAuthStore } from '@/lib/auth-service';
import { differenceInSeconds, addSeconds } from 'date-fns';
import { collection, query, where, onSnapshot, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User as SystemUser } from '@/types';


const getTipoProcesoReal = (proceso: Proceso) => {
    if (proceso.clasificacion) return proceso.clasificacion;
    // Deducir del contenido si no tiene clasificacion (procesos anteriores)
    if (!proceso.utilizaTemporizador && !proceso.contabilizaSetup) {
        return 'anexos';
    }
    if (proceso.utilizaTemporizador || proceso.contabilizaSetup) {
        return 'empaque';
    }
    return 'otros';
};

export default function ProcesosPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedStates, setExpandedStates] = useState<Record<ProcesoEstado, boolean>>({
        'Registrado': true,
        'Iniciado': true,
        'Pausado': true,
        'Finalizado': false
    });
    const [refreshKey, setRefreshKey] = useState(0);
    const [colaboradoresPorProceso, setColaboradoresPorProceso] = useState<Record<string, any[]>>({});
    const { procesos, loading } = useProcesos();
    const user = useAuthStore(state => state.user);
    const router = useRouter();

    const [activeTab, setActiveTab] = useState<TipoProceso>('empaque');

    // Sharing state
    const [sharingProceso, setSharingProceso] = useState<Proceso | null>(null);
    const [allUsers, setAllUsers] = useState<SystemUser[]>([]);
    const [isSavingShare, setIsSavingShare] = useState(false);

    // Re-renderizar cada segundo para actualizar temporizador y unidades
    useEffect(() => {
        const timer = setInterval(() => {
            setRefreshKey(prev => prev + 1);
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Traer colaboradores en tiempo real para procesos Iniciados
    useEffect(() => {
        const procesosIniciados = procesos.filter(p => p.estado === 'Iniciado');
        if (procesosIniciados.length === 0) return;

        const unsubscribers = procesosIniciados.map(proceso => {
            const q = query(
                collection(db, 'colaboradores_log'),
                where('procesoId', '==', proceso.id)
            );

            return onSnapshot(q, (snapshot) => {
                const colabs = snapshot.docs.map(doc => doc.data());
                setColaboradoresPorProceso(prev => ({
                    ...prev,
                    [proceso.id]: colabs
                }));
            });
        });

        return () => {
            unsubscribers.forEach(unsub => unsub());
        };
    }, [procesos]);

    // Fetch all users for sharing
    useEffect(() => {
        if (!sharingProceso) return;

        const fetchUsers = async () => {
            const q = query(collection(db, 'usuarios'), where('activo', '==', true));
            const snap = await getDocs(q);
            setAllUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as SystemUser)));
        };
        fetchUsers();
    }, [sharingProceso]);

    const handleToggleUserVisibility = async (targetUsername: string) => {
        if (!sharingProceso) return;
        setIsSavingShare(true);
        try {
            const currentVisible = sharingProceso.visiblePara || [];
            const isVisible = currentVisible.includes(targetUsername);

            const newVisible = isVisible
                ? currentVisible.filter(u => u !== targetUsername)
                : [...currentVisible, targetUsername];

            await updateDoc(doc(db, 'procesos', sharingProceso.id), {
                visiblePara: newVisible
            });

            // Local update for immediate feedback
            setSharingProceso({ ...sharingProceso, visiblePara: newVisible });
        } catch (error) {
            console.error("Error updating visibility:", error);
        } finally {
            setIsSavingShare(false);
        }
    };

    const toggleState = (estado: ProcesoEstado) => {
        setExpandedStates(prev => ({
            ...prev,
            [estado]: !prev[estado]
        }));
    };

    const filteredProcesos = procesos.filter(p => {
        // 1. Filtro por Rol: Usuario solo ve los suyos + compartidos. 
        // Superadmin y Supervisor ven TODOS.
        if (user?.rol === 'usuario') {
            const esMio = p.registradoPorUsuario === user.username;
            const compartidoConmigo = p.visiblePara?.includes(user.username);
            if (!esMio && !compartidoConmigo) return false;
        }

        // 2. Filtro por Pestaña (Tipo de Proceso)
        if (getTipoProcesoReal(p) !== activeTab) return false;

        // 3. Filtro por búsqueda
        return p.ordenProduccion.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.producto.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.lote.toLowerCase().includes(searchTerm.toLowerCase());
    });

    // Agrupar procesos por estado
    const procesosPorEstado = {
        'Registrado': filteredProcesos.filter(p => p.estado === 'Registrado'),
        'Iniciado': filteredProcesos.filter(p => p.estado === 'Iniciado'),
        'Pausado': filteredProcesos.filter(p => p.estado === 'Pausado'),
        'Finalizado': filteredProcesos.filter(p => p.estado === 'Finalizado'),
    };

    // Calcular unidades pendientes usando calculatedUnits (igual que el monitor)
    const getUnidadesPendientes = (proceso: Proceso) => {
        if (proceso.estado !== 'Iniciado') {
            // Para procesos no iniciados, usar solo trabajoCompletado
            return Math.max(0, proceso.cantidadProducir - (proceso.trabajoCompletado || 0));
        }

        // Para procesos iniciados, calcular calculatedUnits igual que en el monitor
        const colabs = colaboradoresPorProceso[proceso.id] || [];
        const activos = colabs.filter((c: any) => !c.horaSalida && c.tipo === 'colaborador');
        const vEquipoMin = (proceso.velocidadTeorica || 0) * activos.length;
        const unitsPerSec = vEquipoMin / 60;

        // Calcular tiempo transcurrido desde ultima actualización
        const now = new Date();
        const lastUpdate = (proceso.ultimoUpdate as any)?.toDate?.() || new Date(proceso.ultimoUpdate || Date.now());
        const elapsedSeconds = Math.max(0, differenceInSeconds(now, lastUpdate));

        // Unidades en progreso = unidades en BD + unidades teóricas en progreso
        const baseUnits = proceso.trabajoCompletado || 0;
        const extraUnits = unitsPerSec * elapsedSeconds;
        const calculatedUnits = baseUnits + extraUnits;

        // Unidades pendientes = total - calculadas
        return Math.max(0, proceso.cantidadProducir - calculatedUnits);
    };

    // Replicar exactamente la lógica de calculateProductivity para el temporizador
    const getTiempoRestanteEstimado = (proceso: Proceso) => {
        const {
            cantidadProducir,
            trabajoCompletado,
            velocidadTeorica,
            estado,
            inicioPeriodoGracia,
            horaInicioReal,
            horaFinReal,
            ultimoUpdate
        } = proceso;

        // Calcular calculatedUnits igual que en el monitor (incluyendo trabajo en progreso)
        let calculatedUnits = trabajoCompletado || 0;
        let velocidadEquipoMin = velocidadTeorica || 0; // Velocidad por defecto

        if (estado === 'Iniciado') {
            const colabs = colaboradoresPorProceso[proceso.id] || [];
            const activos = colabs.filter((c: any) => !c.horaSalida && c.tipo === 'colaborador');
            const numPersonas = activos.length;

            // Calcular velocidad del equipo: velocidadTeorica * número de colaboradores
            velocidadEquipoMin = (velocidadTeorica || 0) * numPersonas;
            const unitsPerSec = velocidadEquipoMin / 60;

            const now = new Date();
            const lastUpdate = (ultimoUpdate as any)?.toDate?.() || new Date(ultimoUpdate || Date.now());
            const elapsedSeconds = Math.max(0, differenceInSeconds(now, lastUpdate));

            calculatedUnits = (trabajoCompletado || 0) + (unitsPerSec * elapsedSeconds);
        }

        // Unidades restantes basadas en calculatedUnits
        const unidadesRestantes = Math.max(0, cantidadProducir - calculatedUnits);

        let segundosTotalesRestantes = 0;

        // Cálculo dinámico siempre
        // Tiempo de referencia: si está pausado (incluyendo pausadoPorFaltaDePersonal), usar ultimoUpdate (momento de la pausa)
        // Si está finalizado, usar horaFinReal. Si está en progreso, usar ahora.
        let nowRef = new Date();
        if ((estado === 'Pausado' || (proceso as any).pausadoPorFaltaDePersonal) && ultimoUpdate) {
            nowRef = (ultimoUpdate as any).toDate?.() || new Date(ultimoUpdate);
        } else if (estado === 'Finalizado' && horaFinReal) {
            nowRef = (horaFinReal as any).toDate?.() || new Date(horaFinReal);
        }

        if (inicioPeriodoGracia) {
            // Período de gracia: 15 minutos fijos desde inicioPeriodoGracia
            const inicioGracia = (inicioPeriodoGracia as any).toDate?.() || new Date(inicioPeriodoGracia);
            const finGracia = addSeconds(inicioGracia, 15 * 60);
            segundosTotalesRestantes = differenceInSeconds(finGracia, nowRef);
        } else if (velocidadEquipoMin > 0 && (estado === 'Iniciado' || estado === 'Pausado' || estado === 'Finalizado')) {
            // Cálculo dinámico usando velocidadEquipoMin: trabajo restante / velocidad + 15 min de gracia
            const minutosTrabajoRestante = unidadesRestantes / velocidadEquipoMin;
            const segundosTrabajoRestante = minutosTrabajoRestante * 60;
            const segundosGracia = 15 * 60;
            segundosTotalesRestantes = segundosTrabajoRestante + segundosGracia;
        }

        // Manejar tiempo extra (negativo)
        if (segundosTotalesRestantes < 0) {
            segundosTotalesRestantes = Math.abs(segundosTotalesRestantes);
        }

        // Formatear como HH:MM:SS
        const h = Math.floor(segundosTotalesRestantes / 3600);
        const m = Math.floor((segundosTotalesRestantes % 3600) / 60);
        const s = Math.floor(segundosTotalesRestantes % 60);

        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    // Obtener estado del temporizador (período de gracia, tiempo extra)
    const getEstadoTemporizador = (proceso: Proceso) => {
        const {
            cantidadProducir,
            trabajoCompletado,
            velocidadTeorica,
            estado,
            inicioPeriodoGracia,
            horaFinReal
        } = proceso;

        const unidadesRestantes = Math.max(0, cantidadProducir - trabajoCompletado);
        const nowRef = estado === 'Finalizado' && horaFinReal
            ? (horaFinReal as any).toDate?.() || new Date(horaFinReal)
            : new Date();

        let segundosTotalesRestantes = 0;
        let isGracePeriod = !!inicioPeriodoGracia;

        if (inicioPeriodoGracia) {
            const inicioGracia = (inicioPeriodoGracia as any).toDate?.() || new Date(inicioPeriodoGracia);
            const finGracia = addSeconds(inicioGracia, 15 * 60);
            segundosTotalesRestantes = differenceInSeconds(finGracia, nowRef);
        } else if (velocidadTeorica > 0 && (estado === 'Iniciado' || estado === 'Pausado' || estado === 'Finalizado')) {
            const minutosTrabajoRestante = unidadesRestantes / velocidadTeorica;
            const segundosTrabajoRestante = minutosTrabajoRestante * 60;
            const segundosGracia = 15 * 60;
            segundosTotalesRestantes = segundosTrabajoRestante + segundosGracia;
        }

        const isTiempoExtra = segundosTotalesRestantes < 0;

        return { isGracePeriod, isTiempoExtra };
    };

    const getStatusIcon = (estado: ProcesoEstado) => {
        switch (estado) {
            case 'Iniciado': return <Play className="h-4 w-4 text-success-green" />;
            case 'Pausado': return <Pause className="h-4 w-4 text-warning-yellow" />;
            case 'Finalizado': return <CheckCircle2 className="h-4 w-4 text-gray-400" />;
            default: return <Clock className="h-4 w-4 text-primary-blue" />;
        }
    };

    const getStatusColor = (estado: ProcesoEstado) => {
        switch (estado) {
            case 'Iniciado': return 'border-success-green/20 bg-success-green/10 text-success-green';
            case 'Pausado': return 'border-warning-yellow/20 bg-warning-yellow/10 text-warning-yellow';
            case 'Finalizado': return 'border-white/10 bg-white/5 text-gray-400';
            default: return 'border-primary-blue/20 bg-primary-blue/10 text-primary-blue';
        }
    };

    return (
        <div className="min-h-screen bg-background text-white p-6 lg:p-10">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div>
                    <h1 className="text-4xl font-black tracking-tight mb-2">PROCESOS</h1>
                    <p className="text-gray-400 font-medium tracking-wide">Gestión y monitoreo de producción en tiempo real</p>
                </div>

                <div className="flex items-center gap-3">
                    {user?.rol === 'superadmin' && (
                        <button
                            onClick={() => router.push('/admin')}
                            className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors border border-white/10"
                            title="Administración"
                        >
                            <Settings className="h-6 w-6 text-gray-400" />
                        </button>
                    )}
                    <button
                        onClick={async () => {
                            await import('@/lib/auth-service').then(m => m.logout());
                            router.push('/');
                        }}
                        className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors border border-white/10"
                        title="Cerrar Sesión"
                    >
                        <LogOut className="h-6 w-6 text-danger-red/70" />
                    </button>
                    <button
                        onClick={() => router.push('/procesos/nuevo')}
                        className="flex items-center gap-2 bg-primary-blue hover:bg-blue-600 px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-primary-blue/20"
                    >
                        <Plus className="h-5 w-5" />
                        NUEVO PROCESO
                    </button>
                </div>
            </header>

            {/* Tabs de Tipo de Proceso */}
            <div className="flex p-1 bg-white/5 rounded-2xl border border-white/10 mb-8 w-fit">
                {[
                    { id: 'empaque', label: 'EMPAQUE' },
                    { id: 'otros', label: 'OTROS PROCESOS' },
                    { id: 'anexos', label: 'ANEXOS' },
                ].map((tabItem) => (
                    <button
                        key={tabItem.id}
                        onClick={() => setActiveTab(tabItem.id as TipoProceso)}
                        className={cn(
                            "px-6 py-2.5 rounded-xl text-xs font-black transition-all tracking-widest",
                            activeTab === tabItem.id
                                ? "bg-primary-blue text-white shadow-lg shadow-primary-blue/20"
                                : "text-gray-500 hover:text-gray-300"
                        )}
                    >
                        {tabItem.label}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-6">
                {/* Barra de Herramientas */}
                <div className="flex flex-col sm:flex-row gap-4 mb-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Buscar por OP, Producto o Lote..."
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-blue/50 transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => setRefreshKey(prev => prev + 1)}
                        className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-6 py-3 rounded-xl font-semibold transition-all">
                        <RefreshCw className="h-5 w-5" />
                        Sincronizar
                    </button>
                </div>

                {/* Tabla de Procesos */}
                <div className="space-y-4" key={refreshKey}>
                    {(Object.keys(procesosPorEstado) as ProcesoEstado[]).map((estado) => {
                        const procesosDelEstado = procesosPorEstado[estado];
                        const isExpanded = expandedStates[estado];
                        const totalProcesos = procesosDelEstado.length;

                        return (
                            <div key={estado} className="overflow-hidden glass rounded-2xl border border-white/10">
                                {/* Header del Acordeón */}
                                <button
                                    onClick={() => toggleState(estado)}
                                    className={cn(
                                        "w-full p-5 flex items-center justify-between hover:bg-white/[0.03] transition-colors border-b",
                                        isExpanded ? "border-white/10 bg-white/[0.02]" : "border-white/10"
                                    )}
                                >
                                    <div className="flex items-center gap-4">
                                        <ChevronDown
                                            className={cn(
                                                "h-5 w-5 transition-transform duration-300",
                                                isExpanded && "rotate-180"
                                            )}
                                        />
                                        <div className={cn(
                                            "inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-tight",
                                            getStatusColor(estado)
                                        )}>
                                            {getStatusIcon(estado)}
                                            {estado}
                                        </div>
                                        <span className="text-sm font-bold text-gray-400">
                                            {totalProcesos} {totalProcesos === 1 ? 'proceso' : 'procesos'}
                                        </span>
                                    </div>
                                </button>

                                {/* Contenido del Acordeón */}
                                {isExpanded && totalProcesos > 0 && (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse min-w-[800px]">
                                            <thead>
                                                <tr className="bg-white/[0.02] border-b border-white/10">
                                                    <th className="p-5 text-xs font-black uppercase tracking-widest text-gray-600">OP</th>
                                                    <th className="p-5 text-xs font-black uppercase tracking-widest text-gray-600">Producto</th>
                                                    <th className="p-5 text-xs font-black uppercase tracking-widest text-gray-600">Etapa</th>
                                                    <th className="p-5 text-xs font-black uppercase tracking-widest text-gray-600 text-center">Unidades Pendientes</th>
                                                    <th className="p-5 text-xs font-black uppercase tracking-widest text-gray-600 text-center">Temporizador</th>
                                                    <th className="p-5 text-xs font-black uppercase tracking-widest text-gray-600 text-right">Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/10">
                                                {procesosDelEstado.map((proceso) => (
                                                    <tr
                                                        key={proceso.id}
                                                        className="hover:bg-white/[0.02] transition-colors group"
                                                    >
                                                        <td className="p-5 font-bold text-lg text-white">{proceso.ordenProduccion}</td>
                                                        <td className="p-5">
                                                            <div>
                                                                <div className="font-bold text-white max-w-[200px] truncate" title={proceso.producto}>{proceso.producto}</div>
                                                                <div className="text-xs text-gray-500 font-medium">Lote: {proceso.lote}</div>
                                                            </div>
                                                        </td>
                                                        <td className="p-5">
                                                            <span className="bg-white/10 px-2 py-1 rounded text-sm font-mono text-gray-300">
                                                                {proceso.etapa || '-'}
                                                            </span>
                                                        </td>
                                                        <td className="p-5 text-center">
                                                            <div className="flex flex-col items-center gap-1">
                                                                <span className="text-sm font-bold text-success-green">
                                                                    {proceso.utilizaTemporizador ?
                                                                        `${getUnidadesPendientes(proceso).toLocaleString('es-ES', { maximumFractionDigits: 1 })} / ${proceso.cantidadProducir}`
                                                                        : 'N/A'
                                                                    }
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="p-5 text-center">
                                                            <div className="flex flex-col items-center gap-2">
                                                                {proceso.utilizaTemporizador ? (
                                                                    <>
                                                                        <span className={cn(
                                                                            "text-lg font-bold font-mono transition-colors duration-500",
                                                                            (() => {
                                                                                const { isGracePeriod, isTiempoExtra } = getEstadoTemporizador(proceso);
                                                                                if (isTiempoExtra) return 'text-danger-red animate-pulse';
                                                                                if (isGracePeriod) return 'text-warning-yellow';
                                                                                if (proceso.estado === 'Iniciado') return 'text-white';
                                                                                return 'text-gray-600';
                                                                            })()
                                                                        )}>
                                                                            {getTiempoRestanteEstimado(proceso)}
                                                                        </span>
                                                                    </>
                                                                ) : (
                                                                    <span className="text-lg font-bold font-mono text-gray-500">N/A</span>
                                                                )}
                                                                <span className={cn(
                                                                    "text-xs font-medium px-2 py-0.5 rounded-full",
                                                                    proceso.estado === 'Finalizado' ? 'bg-gray-700/30 text-gray-300' :
                                                                        proceso.estado === 'Pausado' ? 'bg-warning-yellow/20 text-warning-yellow' :
                                                                            proceso.estado === 'Iniciado' ? 'bg-success-green/20 text-success-green' :
                                                                                'bg-primary-blue/20 text-primary-blue'
                                                                )}>
                                                                    {proceso.estado}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="p-5 text-right flex items-center justify-end gap-2">
                                                            {['superadmin', 'supervisor'].includes(user?.rol || '') && (
                                                                <button
                                                                    onClick={() => setSharingProceso(proceso)}
                                                                    className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 group transition-all"
                                                                    title="Compartir visibilidad"
                                                                >
                                                                    <Share2 className="h-5 w-5 group-hover:text-primary-blue" />
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => router.push(`/procesos/${proceso.id}`)}
                                                                className="bg-primary-blue/10 hover:bg-primary-blue text-primary-blue hover:text-white px-4 py-2 rounded-lg text-sm font-bold transition-all border border-primary-blue/20"
                                                            >
                                                                ABRIR
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {isExpanded && totalProcesos === 0 && (
                                    <div className="p-8 text-center text-gray-500">
                                        <p className="font-medium">No hay procesos en este estado</p>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
            {/* MODAL DE COMPARTIR VISIBILIDAD */}
            {sharingProceso && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                    <div className="glass w-full max-w-md rounded-[2.5rem] overflow-hidden flex flex-col border-white/10 shadow-2xl animate-in zoom-in duration-300">
                        <div className="p-8 border-b border-white/10 flex items-center justify-between bg-white/5">
                            <h3 className="text-xl font-black uppercase flex items-center gap-3">
                                <Share2 className="h-6 w-6 text-primary-blue" /> COMPARTIR PROCESO
                            </h3>
                            <button onClick={() => setSharingProceso(null)} className="p-2 hover:bg-white/10 rounded-full">
                                <X className="h-6 w-6" />
                            </button>
                        </div>
                        <div className="p-8 space-y-4">
                            <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">PROCESO SELECCIONADO</p>
                                <p className="font-bold text-white">{sharingProceso.ordenProduccion} - {sharingProceso.producto}</p>
                            </div>

                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-6">Seleccione los usuarios que pueden ver este proceso:</p>

                            <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                {allUsers
                                    .filter(u => u.username !== sharingProceso.registradoPorUsuario && u.rol === 'usuario') // Solo nivel usuario y que no sea el dueño
                                    .map(u => {
                                        const isSelected = sharingProceso.visiblePara?.includes(u.username);
                                        return (
                                            <button
                                                key={u.id}
                                                onClick={() => handleToggleUserVisibility(u.username)}
                                                disabled={isSavingShare}
                                                className={cn(
                                                    "w-full flex items-center justify-between p-4 rounded-2xl border transition-all",
                                                    isSelected
                                                        ? "bg-primary-blue/20 border-primary-blue text-white"
                                                        : "bg-white/5 border-white/10 text-gray-400 hover:border-white/30"
                                                )}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <UsersIcon className="h-4 w-4" />
                                                    <div className="text-left">
                                                        <p className="font-bold uppercase text-sm">{u.username}</p>
                                                        <p className="text-[10px] opacity-60">{u.email}</p>
                                                    </div>
                                                </div>
                                                {isSelected && <Check className="h-5 w-5 text-primary-blue" />}
                                            </button>
                                        );
                                    })
                                }
                                {allUsers.filter(u => u.username !== sharingProceso.registradoPorUsuario && u.rol === 'usuario').length === 0 && (
                                    <p className="text-center py-6 text-gray-500 text-sm italic">No hay otros usuarios de nivel "Usuario" para compartir.</p>
                                )}
                            </div>

                            <button
                                onClick={() => setSharingProceso(null)}
                                className="w-full mt-4 bg-white/10 py-4 rounded-2xl font-black uppercase text-xs tracking-[0.2em] hover:bg-white/20 transition-all"
                            >
                                CERRAR
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
