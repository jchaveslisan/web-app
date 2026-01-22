"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, ClipboardList, Package, Layers, Sparkles } from 'lucide-react';
import { createProceso, addEventoLog, getMaestroColaboradores, getEtapas } from '@/lib/firebase-db';
import { useAuthStore } from '@/lib/auth-service';
import { ColaboradorMaestro, Etapa } from '@/types';

export default function NuevoProcesoPage() {
    const router = useRouter();
    const { register, handleSubmit, setValue, watch } = useForm();
    const user = useAuthStore(state => state.user);
    const [tipoProceso, setTipoProceso] = useState<'empaque' | 'otros' | 'anexos' | null>(null);
    const [etapas, setEtapas] = useState<Etapa[]>([]);
    const [colaboradores, setColaboradores] = useState<ColaboradorMaestro[]>([]);

    // Protección de ruta (Solo usuarios autenticados)
    useEffect(() => {
        if (user === null) {
            router.push('/login');
        }
    }, [user, router]);

    useEffect(() => {
        const fetchColaboradores = async () => {
            const data = await getMaestroColaboradores();
            setColaboradores(data);
        };
        fetchColaboradores();
    }, []);

    useEffect(() => {
        const fetchEtapas = async () => {
            const data = await getEtapas();
            setEtapas(data);
        };
        fetchEtapas();
    }, []);

    const onSubmit = async (data: any) => {
        try {
            const procesoId = await createProceso({
                ordenProduccion: tipoProceso === 'empaque' || tipoProceso === 'otros' ? data.op : 'N/A',
                producto: data.producto,
                lote: tipoProceso === 'empaque' || tipoProceso === 'otros' ? data.lote : 'N/A',
                etapa: tipoProceso === 'empaque' || tipoProceso === 'otros' ? data.etapa : 'N/A',
                cantidadProducir: tipoProceso === 'empaque' ? Number(data.cantidad) : 0,
                velocidadTeorica: tipoProceso === 'empaque' ? Number(data.velocidad) : 0,
                lider: tipoProceso === 'empaque' ? data.lider : 'N/A',
                utilizaTemporizador: tipoProceso === 'empaque' ? data.utilizaTimer : false,
                contabilizaSetup: tipoProceso === 'empaque' ? data.contabilizaSetup : false,
                clasificacion: tipoProceso || 'otros',
                registradoPorUsuario: user?.username || 'desconocido',
                unidadGobernadora: typeof window !== 'undefined' ? window.location.hostname : 'web',
            });

            const mensajeLog =
                tipoProceso === 'empaque' ? "Creación inicial del proceso de empaque" :
                    tipoProceso === 'otros' ? "Creación de proceso sin temporizador" :
                        "Creación de proceso anexo";

            await addEventoLog(procesoId, "Proceso Registrado", mensajeLog, "REGISTRO PROCESO", user?.username || 'sistema');

            router.push('/procesos');
        } catch (error) {
            console.error('Error al crear proceso:', error);
            alert('Hubo un error al guardar el proceso en Firebase');
        }
    };

    const handleTipoProcesoSelection = (tipo: 'empaque' | 'otros' | 'anexos') => {
        setTipoProceso(tipo);
        if (tipo === 'empaque') {
            setValue('utilizaTimer', true);
            setValue('contabilizaSetup', true);
        } else {
            setValue('utilizaTimer', false);
            setValue('contabilizaSetup', false);
        }
    };

    return (
        <div className="min-h-screen bg-background text-white p-6 lg:p-10">
            <header className="flex items-center gap-4 mb-10">
                <button
                    onClick={() => router.back()}
                    className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors border border-white/10"
                >
                    <ArrowLeft className="h-6 w-6" />
                </button>
                <div>
                    <h1 className="text-3xl font-black tracking-tight">NUEVO PROCESO</h1>
                    <p className="text-gray-400 font-medium">Configure los parámetros de la orden de producción</p>
                </div>
            </header>

            <div className="max-w-5xl glass rounded-3xl p-8 lg:p-12 border border-white/10 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                    <ClipboardList className="h-40 w-40" />
                </div>

                {tipoProceso === null ? (
                    // Pregunta inicial con 3 opciones
                    <div className="relative z-10 flex flex-col items-center justify-center min-h-[400px] gap-8">
                        <div className="text-center mb-8">
                            <h2 className="text-4xl font-black mb-4 uppercase tracking-tight">Tipo de Proceso</h2>
                            <p className="text-gray-400 text-lg font-medium">Seleccione la categoría del proceso a registrar</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
                            <button
                                onClick={() => handleTipoProcesoSelection('empaque')}
                                className="group relative flex flex-col items-center justify-center p-10 bg-white/5 hover:bg-primary-blue hover:text-white rounded-3xl border-2 border-white/10 hover:border-primary-blue transition-all text-center"
                            >
                                <Package className="h-20 w-20 mb-6 opacity-60 group-hover:opacity-100 transition-opacity" />
                                <p className="text-2xl font-black uppercase mb-2">Empaque</p>
                                <p className="text-sm opacity-60 font-bold uppercase tracking-widest">Con temporizador y métricas</p>
                            </button>

                            <button
                                onClick={() => handleTipoProcesoSelection('otros')}
                                className="group relative flex flex-col items-center justify-center p-10 bg-white/5 hover:bg-warning-yellow hover:text-black rounded-3xl border-2 border-white/10 hover:border-warning-yellow transition-all text-center"
                            >
                                <Layers className="h-20 w-20 mb-6 opacity-60 group-hover:opacity-100 transition-opacity" />
                                <p className="text-2xl font-black uppercase mb-2">Otros Procesos</p>
                                <p className="text-sm opacity-60 font-bold uppercase tracking-widest">Sin temporizador</p>
                            </button>

                            <button
                                onClick={() => handleTipoProcesoSelection('anexos')}
                                className="group relative flex flex-col items-center justify-center p-10 bg-white/5 hover:bg-accent-purple hover:text-white rounded-3xl border-2 border-white/10 hover:border-accent-purple transition-all text-center"
                            >
                                <Sparkles className="h-20 w-20 mb-6 opacity-60 group-hover:opacity-100 transition-opacity" />
                                <p className="text-2xl font-black uppercase mb-2">Procesos Anexos</p>
                                <p className="text-sm opacity-60 font-bold uppercase tracking-widest">Registro simplificado</p>
                            </button>
                        </div>
                    </div>
                ) : (
                    // Formulario
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 relative z-10">
                        <div className="flex items-center justify-between mb-6 pb-6 border-b border-white/10">
                            <div className="flex items-center gap-3">
                                {tipoProceso === 'empaque' ? <Package className="h-6 w-6 text-primary-blue" /> :
                                    tipoProceso === 'otros' ? <Layers className="h-6 w-6 text-warning-yellow" /> :
                                        <Sparkles className="h-6 w-6 text-accent-purple" />}
                                <span className="text-lg font-black uppercase tracking-widest text-gray-400">
                                    {tipoProceso === 'empaque' ? 'Proceso de Empaque' :
                                        tipoProceso === 'otros' ? 'Otros Procesos' :
                                            'Procesos Anexos'}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setTipoProceso(null)}
                                className="text-xs font-bold text-gray-500 hover:text-white transition-colors uppercase tracking-widest"
                            >
                                Cambiar tipo
                            </button>
                        </div>

                        {tipoProceso === 'empaque' ? (
                            // Formulario completo para empaque
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Columna 1 */}
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-black uppercase tracking-widest text-gray-500 mb-2">Orden de Producción (OP)</label>
                                        <input
                                            {...register('op')}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-blue/50 transition-all font-bold text-lg"
                                            placeholder="Ej: OP-55443"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-black uppercase tracking-widest text-gray-500 mb-2">Producto / Proceso</label>
                                        <input
                                            {...register('producto')}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-blue/50 transition-all font-bold text-lg"
                                            placeholder="Nombre del componente"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-black uppercase tracking-widest text-gray-500 mb-2">Lote</label>
                                            <input
                                                {...register('lote')}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-blue/50 transition-all font-mono"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-black uppercase tracking-widest text-gray-500 mb-2">Etapa</label>
                                            <select
                                                {...register('etapa')}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-blue/50 transition-all font-bold text-white"
                                            >
                                                <option value="" className="bg-black text-white">Seleccionar etapa...</option>
                                                {etapas
                                                    .filter(e => !e.tiposProceso || e.tiposProceso.includes('empaque'))
                                                    .map(etapa => (
                                                        <option key={etapa.id} value={etapa.codigo} className="bg-black text-white">
                                                            {etapa.codigo} - {etapa.nombre}
                                                        </option>
                                                    ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Columna 2 */}
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-black uppercase tracking-widest text-gray-500 mb-2">Cantidad</label>
                                            <input
                                                type="number"
                                                {...register('cantidad')}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-blue/50 transition-all font-bold text-lg"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-black uppercase tracking-widest text-gray-500 mb-2">Vel. Teórica</label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                {...register('velocidad')}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-blue/50 transition-all font-bold text-lg"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-black uppercase tracking-widest text-gray-500 mb-2">Líder de Proceso</label>
                                        <select
                                            {...register('lider')}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-blue/50 transition-all font-bold text-white"
                                        >
                                            <option value="" className="bg-black text-white">Seleccionar líder...</option>
                                            {colaboradores.map(colab => (
                                                <option key={colab.id} value={colab.nombreCompleto} className="bg-black text-white">
                                                    {colab.nombreCompleto}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-4 pt-4">
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <input type="checkbox" {...register('utilizaTimer')} className="w-5 h-5 accent-primary-blue rounded" defaultChecked />
                                            <span className="text-sm font-bold text-gray-300 group-hover:text-white transition-colors">Utilizar Temporizador de Línea</span>
                                        </label>
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <input type="checkbox" {...register('contabilizaSetup')} className="w-5 h-5 accent-primary-blue rounded" defaultChecked />
                                            <span className="text-sm font-bold text-gray-300 group-hover:text-white transition-colors">Contabilizar Tiempo de Setup</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        ) : tipoProceso === 'otros' ? (
                            // Formulario para "Otros Procesos" - sin temporizador pero con datos de producción
                            <div className="max-w-2xl mx-auto space-y-6">
                                <div>
                                    <label className="block text-sm font-black uppercase tracking-widest text-gray-500 mb-2">Orden de Producción (OP)</label>
                                    <input
                                        {...register('op')}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-warning-yellow/50 transition-all font-bold text-lg"
                                        placeholder="Ej: OP-55443"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-black uppercase tracking-widest text-gray-500 mb-2">Producto / Artículo</label>
                                    <input
                                        {...register('producto')}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-warning-yellow/50 transition-all font-bold text-lg"
                                        placeholder="Nombre del artículo"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-black uppercase tracking-widest text-gray-500 mb-2">Lote</label>
                                        <input
                                            {...register('lote')}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-warning-yellow/50 transition-all font-mono"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-black uppercase tracking-widest text-gray-500 mb-2">Etapa</label>
                                        <select
                                            {...register('etapa')}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-warning-yellow/50 transition-all font-bold text-white"
                                        >
                                            <option value="" className="bg-black text-white">Seleccionar etapa...</option>
                                            {etapas
                                                .filter(e => e.tiposProceso?.includes('otros'))
                                                .map(etapa => (
                                                    <option key={etapa.id} value={etapa.codigo} className="bg-black text-white">
                                                        {etapa.codigo} - {etapa.nombre}
                                                    </option>
                                                ))}
                                            {/* Si no hay etapas específicas para 'otros', mostrar las defaults */}
                                            {etapas.filter(e => e.tiposProceso?.includes('otros')).length === 0 && (
                                                <>
                                                    <option value="EMP" className="bg-black text-white">EMP - Empaque</option>
                                                    <option value="FAB" className="bg-black text-white">FAB - Fabricación</option>
                                                    <option value="SUB" className="bg-black text-white">SUB - Subempaque</option>
                                                    <option value="GRAN" className="bg-black text-white">GRAN - Granel</option>
                                                </>
                                            )}
                                        </select>
                                    </div>
                                </div>

                                <div className="mt-6 p-4 bg-warning-yellow/10 border border-warning-yellow/20 rounded-xl">
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                                        Este proceso no utilizará temporizador ni setup. Solo se registrarán datos básicos de producción.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            // Formulario simplificado para "Procesos Anexos"
                            <div className="max-w-xl mx-auto">
                                <div>
                                    <label className="block text-sm font-black uppercase tracking-widest text-gray-500 mb-2">Producto / Proceso</label>
                                    <input
                                        {...register('producto')}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-accent-purple/50 transition-all font-bold text-lg"
                                        placeholder="Nombre del área o proceso"
                                    />
                                </div>

                                <div className="mt-6 p-4 bg-accent-purple/10 border border-accent-purple/20 rounded-xl">
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                                        Este proceso no utilizará temporizador ni métricas de producción.
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="pt-8 flex justify-end">
                            <button
                                type="submit"
                                className="flex items-center gap-3 bg-primary-blue hover:bg-blue-600 px-10 py-4 rounded-2xl font-black text-lg transition-all shadow-xl shadow-primary-blue/20 transform hover:scale-105 active:scale-95"
                            >
                                <Save className="h-6 w-6" />
                                REGISTRAR PROCESO
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
