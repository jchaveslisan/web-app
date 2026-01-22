"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft,
    Users,
    Plus,
    Trash2,
    Edit2,
    Check,
    X,
    Pause,
    LogOut
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/auth-service';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ColaboradorMaestro, Justificacion, Etapa, User, UserRole } from '@/types';

export default function AdminPage() {
    const [tab, setTab] = useState<'personal' | 'pausa' | 'salida' | 'etapas' | 'usuarios'>('personal');
    const [colaboradores, setColaboradores] = useState<ColaboradorMaestro[]>([]);
    const [justificacionesPausa, setJustificacionesPausa] = useState<Justificacion[]>([]);
    const [justificacionesSalida, setJustificacionesSalida] = useState<Justificacion[]>([]);
    const [etapas, setEtapas] = useState<Etapa[]>([]);
    const [usuarios, setUsuarios] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [newNombre, setNewNombre] = useState('');
    const [newID, setNewID] = useState('');
    const [newJustificacion, setNewJustificacion] = useState('');
    const [newEtapaCodigo, setNewEtapaCodigo] = useState('');
    const [newEtapaNombre, setNewEtapaNombre] = useState('');
    const [newEtapaTipos, setNewEtapaTipos] = useState<string[]>(['empaque', 'otros', 'anexos']);
    const router = useRouter();

    const user = useAuthStore(state => state.user);

    // Protección de ruta admistrativa - Solo Superadmin
    useEffect(() => {
        if (!loading && (!user || user.rol !== 'superadmin')) {
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
        const q = query(collection(db, 'usuarios'), orderBy('email', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
            setUsuarios(data);
        });
        return () => unsubscribe();
    }, []);

    const handleAddColaborador = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newNombre || !newID) return;
        try {
            await addDoc(collection(db, 'maestro_colaboradores'), {
                nombreCompleto: newNombre.toUpperCase(),
                claveRegistro: newID,
                activo: true
            });
            setNewNombre('');
            setNewID('');
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

    const handleToggleActivo = async (id: string, current: boolean, collection_name: 'maestro_colaboradores' | 'maestro_justificaciones' | 'maestro_etapas') => {
        try {
            await updateDoc(doc(db, collection_name, id), { activo: !current });
        } catch (error) {
            console.error(error);
        }
    };

    const handleDelete = async (id: string, collection_name: 'maestro_colaboradores' | 'maestro_justificaciones' | 'maestro_etapas') => {
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
                        </div>

                        <div className="glass rounded-3xl overflow-hidden border border-white/10">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-white/5 border-b border-white/10">
                                        <th className="p-5 text-xs font-black uppercase text-gray-500">Usuario</th>
                                        <th className="p-5 text-xs font-black uppercase text-gray-500">Email</th>
                                        <th className="p-5 text-xs font-black uppercase text-gray-500">Rol</th>
                                        <th className="p-5 text-xs font-black uppercase text-gray-500">Estado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {usuarios.map((u) => (
                                        <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="p-5 font-bold">{u.username || 'Sin nombre'}</td>
                                            <td className="p-5 text-gray-400 font-mono text-sm">{u.email}</td>
                                            <td className="p-5">
                                                <select
                                                    value={u.rol}
                                                    onChange={(e) => handleUpdateUserRole(u.id, e.target.value as UserRole)}
                                                    className="bg-black/20 border border-white/10 rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-primary-blue outline-none"
                                                >
                                                    <option value="usuario">Usuario</option>
                                                    <option value="supervisor">Supervisor</option>
                                                    <option value="superadmin">Superadmin</option>
                                                </select>
                                            </td>
                                            <td className="p-5">
                                                <button
                                                    onClick={() => handleToggleUserActive(u.id, u.activo)}
                                                    className={cn(
                                                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all",
                                                        u.activo
                                                            ? "bg-success-green/10 border-success-green/20 text-success-green hover:bg-success-green/20"
                                                            : "bg-danger-red/10 border-danger-red/20 text-danger-red hover:bg-danger-red/20"
                                                    )}
                                                >
                                                    {u.activo ? "ACTIVO" : "INACTIVO"}
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
            </div>
        </div >
    );
}
