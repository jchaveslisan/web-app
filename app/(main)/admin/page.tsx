"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
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
    RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/auth-service';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, query, orderBy, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ColaboradorMaestro, Justificacion, Etapa, User, UserRole, OrdenMaestra } from '@/types';

export default function AdminPage() {
    const [tab, setTab] = useState<'personal' | 'pausa' | 'salida' | 'etapas' | 'usuarios' | 'ordenes' | 'reportes'>('personal');
    const [colaboradores, setColaboradores] = useState<ColaboradorMaestro[]>([]);
    const [justificacionesPausa, setJustificacionesPausa] = useState<Justificacion[]>([]);
    const [justificacionesSalida, setJustificacionesSalida] = useState<Justificacion[]>([]);
    const [etapas, setEtapas] = useState<Etapa[]>([]);
    const [usuarios, setUsuarios] = useState<User[]>([]);
    const [ordenes, setOrdenes] = useState<OrdenMaestra[]>([]);
    const [allProcesos, setAllProcesos] = useState<any[]>([]);
    const [selectedRepoOP, setSelectedRepoOP] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [newNombre, setNewNombre] = useState('');
    const [newID, setNewID] = useState('');
    const [newJustificacion, setNewJustificacion] = useState('');
    const [newEtapaCodigo, setNewEtapaCodigo] = useState('');
    const [newEtapaNombre, setNewEtapaNombre] = useState('');
    const [newEtapaTipos, setNewEtapaTipos] = useState<string[]>(['empaque', 'otros', 'anexos']);
    const [editingItem, setEditingItem] = useState<{ id: string, type: string, data: any } | null>(null);
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

    // For editing
    const [editValue, setEditValue] = useState<any>({});

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
        const q = query(collection(db, 'maestro_ordenes'), where('activo', '==', true), orderBy('op', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OrdenMaestra));
            setOrdenes(data);
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
                activo: true
            });
            setNewOrderOP('');
            setNewOrderProduct('');
            setNewOrderLote('');
            setNewOrderEtapa('');
            setNewOrderCantidad(0);
            setNewOrderVelocidad(0);
            setShowForm(false);
        } catch (error) {
            console.error(error);
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

            // Header
            doc.setFillColor(0, 102, 204);
            doc.rect(0, 0, 210, 40, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(22);
            doc.text('REPORTE DE PRODUCCIÓN', 105, 20, { align: 'center' });
            doc.setFontSize(10);
            doc.text(`Generado el: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 105, 30, { align: 'center' });

            // OP Info
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(14);
            doc.text(`ORDEN DE PRODUCCIÓN: ${selectedRepoOP}`, 20, 55);
            doc.setFontSize(11);
            doc.text(`Producto: ${procesosOP[0].producto}`, 20, 65);
            doc.text(`Lote: ${procesosOP[0].lote}`, 20, 72);

            let yPos = 85;

            for (const proceso of procesosOP) {
                doc.setFontSize(12);
                doc.setTextColor(0, 102, 204);
                doc.text(`Etapa: ${proceso.etapa || 'N/A'}`, 20, yPos);
                yPos += 7;

                // Fetch logs for this process - Usando getDocs para asegurar datos al momento
                const qLogs = query(collection(db, 'colaboradores_log'), where('procesoId', '==', proceso.id));
                const snapLogs = await getDocs(qLogs);
                const logs = snapLogs.docs.map(d => d.data());

                const tableData = logs.map((log: any) => {
                    const ingreso = log.horaIngreso?.toDate();
                    const salida = log.horaSalida?.toDate();
                    let duracion = '-';
                    if (ingreso && salida) {
                        const diffSecs = Math.floor((salida.getTime() - ingreso.getTime()) / 1000);
                        const h = Math.floor(diffSecs / 3600);
                        const m = Math.floor((diffSecs % 3600) / 60);
                        const s = diffSecs % 60;
                        duracion = `${h}h ${m}m ${s}s`;
                    }
                    return [
                        log.nombreColaborador || 'Desc.',
                        log.tipo === 'colaborador' ? 'DIRECTO' : 'SOLO SETUP',
                        ingreso ? format(ingreso, 'HH:mm:ss') : '-',
                        salida ? format(salida, 'HH:mm:ss') : 'En curso',
                        duracion
                    ];
                });

                autoTable(doc, {
                    startY: yPos,
                    head: [['Colaborador', 'Tipo', 'Ingreso', 'Salida', 'Duración']],
                    body: tableData,
                    theme: 'grid',
                    headStyles: { fillColor: [0, 102, 204] },
                    margin: { left: 20, right: 20 }
                });

                yPos = (doc as any).lastAutoTable.finalY + 15;
                if (yPos > 250) {
                    doc.addPage();
                    yPos = 20;
                }
            }

            doc.save(`Reporte_OP_${selectedRepoOP}.pdf`);

        } catch (error) {
            console.error(error);
            alert("Error al generar PDF");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleAddColaborador = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newNombre || !newID) return;
        try {
            await addDoc(collection(db, 'maestro_colaboradores'), {
                nombreCompleto: newNombre.toUpperCase(),
                claveRegistro: newID,
                mensajeEntrada: newMensajeEntrada || null,
                mensajeSalida: newMensajeSalida || null,
                activo: true
            });
            setNewNombre('');
            setNewID('');
            setNewMensajeEntrada('');
            setNewMensajeSalida('');
            setShowForm(false);
        } catch (error) {
            console.error(error);
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
            }

            await updateDoc(doc(db, collectionName, editingItem.id), editValue);
            setEditingItem(null);
            setEditValue({});
        } catch (error) {
            console.error(error);
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
            <header className="flex items-center gap-4 mb-10">
                <button
                    onClick={() => router.push('/procesos')}
                    className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors border border-white/10"
                >
                    <ArrowLeft className="h-6 w-6" />
                </button>
                <div>
                    <h1 className="text-3xl font-black tracking-tight uppercase">Administración</h1>
                    <p className="text-gray-400 font-medium">Gestión de maestros y configuraciones</p>
                </div>
            </header>

            {/* Tabs */}
            <div className="mb-8 flex gap-3 border-b border-white/10 overflow-x-auto">
                <button
                    onClick={() => { setTab('personal'); setShowForm(false); }}
                    className={cn(
                        "flex items-center gap-2 px-6 py-3 font-bold uppercase tracking-widest border-b-2 transition-all whitespace-nowrap",
                        tab === 'personal'
                            ? "border-primary-blue text-primary-blue"
                            : "border-transparent text-gray-400 hover:text-white"
                    )}
                >
                    <Users className="h-5 w-5" /> Personal
                </button>
                <button
                    onClick={() => { setTab('pausa'); setShowForm(false); }}
                    className={cn(
                        "flex items-center gap-2 px-6 py-3 font-bold uppercase tracking-widest border-b-2 transition-all whitespace-nowrap",
                        tab === 'pausa'
                            ? "border-warning-yellow text-warning-yellow"
                            : "border-transparent text-gray-400 hover:text-white"
                    )}
                >
                    <Pause className="h-5 w-5" /> Justificaciones de Pausa
                </button>
                <button
                    onClick={() => { setTab('salida'); setShowForm(false); }}
                    className={cn(
                        "flex items-center gap-2 px-6 py-3 font-bold uppercase tracking-widest border-b-2 transition-all whitespace-nowrap",
                        tab === 'salida'
                            ? "border-danger-red text-danger-red"
                            : "border-transparent text-gray-400 hover:text-white"
                    )}
                >
                    <LogOut className="h-5 w-5" /> Justificaciones de Salida
                </button>
                <button
                    onClick={() => { setTab('etapas'); setShowForm(false); }}
                    className={cn(
                        "flex items-center gap-2 px-6 py-3 font-bold uppercase tracking-widest border-b-2 transition-all whitespace-nowrap",
                        tab === 'etapas'
                            ? "border-accent-purple text-accent-purple"
                            : "border-transparent text-gray-400 hover:text-white"
                    )}
                >
                    Etapas
                </button>
                <button
                    onClick={() => { setTab('usuarios'); setShowForm(false); }}
                    className={cn(
                        "flex items-center gap-2 px-6 py-3 font-bold uppercase tracking-widest border-b-2 transition-all whitespace-nowrap",
                        tab === 'usuarios'
                            ? "border-emerald-400 text-emerald-400"
                            : "border-transparent text-gray-400 hover:text-white"
                    )}
                >
                    <Users className="h-5 w-5" /> Usuarios
                </button>
                <button
                    onClick={() => { setTab('ordenes'); setShowForm(false); }}
                    className={cn(
                        "flex items-center gap-2 px-6 py-3 font-bold uppercase tracking-widest border-b-2 transition-all whitespace-nowrap",
                        tab === 'ordenes'
                            ? "border-primary-blue text-primary-blue"
                            : "border-transparent text-gray-400 hover:text-white"
                    )}
                >
                    <ClipboardList className="h-5 w-5" /> Ordenes OP
                </button>
                <button
                    onClick={() => { setTab('reportes'); setShowForm(false); }}
                    className={cn(
                        "flex items-center gap-2 px-6 py-3 font-bold uppercase tracking-widest border-b-2 transition-all whitespace-nowrap",
                        tab === 'reportes'
                            ? "border-accent-purple text-accent-purple"
                            : "border-transparent text-gray-400 hover:text-white"
                    )}
                >
                    <FileText className="h-5 w-5" /> Reportes
                </button>
            </div>

            <div className="max-w-4xl mx-auto">
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
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-black text-gray-500 uppercase mb-2">Nombre Completo</label>
                                        <input
                                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary-blue"
                                            value={newNombre}
                                            onChange={(e) => setNewNombre(e.target.value)}
                                            placeholder="Ej: JUAN PEREZ"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black text-gray-500 uppercase mb-2">ID / Clave de Registro</label>
                                        <input
                                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary-blue"
                                            value={newID}
                                            onChange={(e) => setNewID(e.target.value)}
                                            placeholder="Ej: 887766"
                                        />
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
                                        <th className="p-5 text-xs font-black uppercase text-gray-500">ID</th>
                                        <th className="p-5 text-xs font-black uppercase text-gray-500">Estado</th>
                                        <th className="p-5 text-right text-xs font-black uppercase text-gray-500">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {colaboradores.map((colab) => (
                                        <tr key={colab.id} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="p-5 font-bold uppercase">{colab.nombreCompleto}</td>
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
                                                    onClick={() => {
                                                        setEditingItem({ id: colab.id, type: 'personal', data: colab });
                                                        setEditValue({
                                                            nombreCompleto: colab.nombreCompleto,
                                                            claveRegistro: colab.claveRegistro,
                                                            mensajeEntrada: colab.mensajeEntrada || '',
                                                            mensajeSalida: colab.mensajeSalida || ''
                                                        });
                                                    }}
                                                    className="p-2 hover:bg-white/10 text-gray-400 rounded-lg transition-all"
                                                >
                                                    <Edit2 className="h-5 w-5" />
                                                </button>
                                                <button onClick={() => handleDelete(colab.id, 'maestro_colaboradores')} className="p-2 hover:bg-danger-red/20 text-danger-red rounded-lg transition-all">
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
                            <button
                                onClick={() => setShowForm(!showForm)}
                                className="flex items-center gap-2 bg-primary-blue hover:bg-blue-600 px-6 py-3 rounded-xl font-bold transition-all text-white shadow-lg shadow-blue-500/20"
                            >
                                {showForm ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                                {showForm ? "CANCELAR" : "CARGAR ORDEN"}
                            </button>
                        </div>

                        {showForm && (
                            <form onSubmit={handleAddOrder} className="glass p-8 rounded-[2.5rem] mb-8 border border-primary-blue/30 animate-in fade-in slide-in-from-top-4 duration-300">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                                                    <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Lote: {o.lote || 'N/A'}</div>
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
                                <>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Nombre Completo</label>
                                        <input
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-bold outline-none focus:border-primary-blue transition-all"
                                            value={editValue.nombreCompleto}
                                            onChange={(e) => setEditValue({ ...editValue, nombreCompleto: e.target.value.toUpperCase() })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">ID / Código</label>
                                        <input
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-bold outline-none focus:border-primary-blue transition-all"
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
                                </>
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
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Producto</label>
                                        <input
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-bold outline-none focus:ring-2 focus:ring-primary-blue transition-all"
                                            value={editValue.producto}
                                            onChange={(e) => setEditValue({ ...editValue, producto: e.target.value })}
                                        />
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
        </div >
    );
}
