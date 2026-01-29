"use client";

import { useState, useEffect } from 'react';
import { X, Save, Box, Activity, ClipboardList, Layers } from 'lucide-react';
import { Proceso, Etapa } from '@/types';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';


interface ModalEditarProcesoProps {
    proceso: Proceso;
    onClose: () => void;
    onSave: (updates: Partial<Proceso>) => Promise<void>;
}

export default function ModalEditarProceso({ proceso, onClose, onSave }: ModalEditarProcesoProps) {
    const [formData, setFormData] = useState({
        ordenProduccion: proceso.ordenProduccion || '',
        producto: proceso.producto || '',
        lote: proceso.lote || '',
        etapa: proceso.etapa || '',
        cantidadProducir: proceso.cantidadProducir || 0,
        velocidadTeorica: proceso.velocidadTeorica || 0,
        lider: proceso.lider || ''
    });
    const [etapas, setEtapas] = useState<Etapa[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const q = query(collection(db, 'maestro_etapas'), where('activo', '==', true), orderBy('nombre', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setEtapas(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Etapa)));
        });
        return () => unsubscribe();
    }, []);

    const tipoProceso = proceso.clasificacion || (proceso.utilizaTemporizador || proceso.contabilizaSetup ? 'empaque' : 'otros');


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onSave(formData);
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="glass w-full max-w-xl rounded-[2.5rem] overflow-hidden flex flex-col border-white/10 shadow-2xl animate-in zoom-in duration-300">
                <div className="p-8 border-b border-white/10 flex items-center justify-between bg-white/5">
                    <h3 className="text-2xl font-black flex items-center gap-3">
                        <Activity className="h-7 w-7 text-primary-blue" /> EDITAR VALORES
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X className="h-7 w-7" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-auto max-h-[70vh]">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Orden de Producción</label>
                            <input
                                type="text"
                                value={formData.ordenProduccion}
                                onChange={(e) => setFormData({ ...formData, ordenProduccion: e.target.value.toUpperCase() })}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-bold outline-none focus:border-primary-blue transition-all"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Lote</label>
                            <input
                                type="text"
                                value={formData.lote}
                                onChange={(e) => setFormData({ ...formData, lote: e.target.value.toUpperCase() })}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-bold outline-none focus:border-primary-blue transition-all"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Producto</label>
                        <input
                            type="text"
                            value={formData.producto}
                            onChange={(e) => setFormData({ ...formData, producto: e.target.value.toUpperCase() })}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-bold outline-none focus:border-primary-blue transition-all"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Etapa</label>
                        <select
                            value={formData.etapa}
                            onChange={(e) => setFormData({ ...formData, etapa: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-bold outline-none focus:border-primary-blue transition-all text-white"
                            required
                        >
                            <option value="" className="bg-black">Seleccionar etapa...</option>
                            {etapas
                                .filter(e => !e.tiposProceso || e.tiposProceso.includes(tipoProceso as any))
                                .map(etapa => (
                                    <option key={etapa.id} value={etapa.codigo} className="bg-black text-white">
                                        {etapa.codigo} - {etapa.nombre}
                                    </option>
                                ))}
                            {/* Si no hay etapas específicas para este tipo, mostrar las defaults si es empaque/otros */}
                            {etapas.filter(e => !e.tiposProceso || e.tiposProceso.includes(tipoProceso as any)).length === 0 && (
                                <>
                                    <option value="EMP" className="bg-black text-white">EMP - Empaque</option>
                                    <option value="FAB" className="bg-black text-white">FAB - Fabricación</option>
                                    <option value="SUB" className="bg-black text-white">SUB - Subempaque</option>
                                    <option value="GRAN" className="bg-black text-white">GRAN - Granel</option>
                                    <option value="OTROS" className="bg-black text-white">OTROS - Otros</option>
                                </>
                            )}
                            {/* Fallback en caso de que la etapa actual no esté en el maestro y sea un valor manual */}
                            {formData.etapa && !etapas.find(e => e.codigo === formData.etapa) && (
                                <option value={formData.etapa} className="bg-black text-white">{formData.etapa}</option>
                            )}
                        </select>
                    </div>


                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Cantidad a Producir</label>
                            <input
                                type="number"
                                value={formData.cantidadProducir}
                                onChange={(e) => setFormData({ ...formData, cantidadProducir: Number(e.target.value) })}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-mono font-bold outline-none focus:border-primary-blue transition-all"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Velocidad Teórica (u/min)</label>
                            <input
                                type="number"
                                value={formData.velocidadTeorica}
                                onChange={(e) => setFormData({ ...formData, velocidadTeorica: Number(e.target.value) })}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-mono font-bold outline-none focus:border-primary-blue transition-all"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Líder de Línea</label>
                        <input
                            type="text"
                            value={formData.lider}
                            onChange={(e) => setFormData({ ...formData, lider: e.target.value.toUpperCase() })}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-bold outline-none focus:border-primary-blue transition-all"
                            required
                        />
                    </div>

                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary-blue text-white py-5 rounded-3xl font-black text-xl hover:bg-blue-600 transition-all flex items-center justify-center gap-4 shadow-xl shadow-primary-blue/20 disabled:opacity-50"
                        >
                            {loading ? (
                                <div className="h-6 w-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <><Save className="h-6 w-6" /> GUARDAR CAMBIOS</>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
