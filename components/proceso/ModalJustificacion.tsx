"use client";

import { useState, useEffect } from 'react';
import { X, AlertCircle, MessageSquare, Check } from 'lucide-react';
import { getJustificaciones } from '@/lib/firebase-db';
import { cn } from '@/lib/utils';

interface Props {
    tipo: 'pausa' | 'salida';
    onConfirm: (justificacion: string) => void;
    onCancel: () => void;
}

export default function ModalJustificacion({ tipo, onConfirm, onCancel }: Props) {
    const [opciones, setOpciones] = useState<string[]>([]);
    const [seleccionada, setSeleccionada] = useState('');
    const [otra, setOtra] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getJustificaciones(tipo).then(data => {
            setOpciones(data);
            setLoading(false);
        });
    }, [tipo]);

    const handleConfirm = () => {
        const final = seleccionada === 'OTRA' ? otra : seleccionada;
        if (!final) return;
        onConfirm(final.toUpperCase());
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
            <div className="glass w-full max-w-2xl rounded-[3rem] overflow-hidden border border-white/20 shadow-2xl transform animate-in zoom-in-95 duration-300">

                <div className="p-10 pb-6 text-center">
                    <div className="mx-auto w-24 h-24 bg-warning-yellow/20 rounded-full flex items-center justify-center mb-6">
                        <AlertCircle className="h-12 w-12 text-warning-yellow" />
                    </div>
                    <h3 className="text-4xl font-black uppercase tracking-tight">Motivo de la {tipo === 'pausa' ? 'Pausa' : 'Salida'}</h3>
                    <p className="text-gray-400 text-lg font-bold mt-3 uppercase tracking-widest">Seleccione una justificación para continuar</p>
                </div>

                <div className="p-8 space-y-3">
                    {loading ? (
                        <div className="text-center py-10 animate-pulse text-gray-500 font-black">CARGANDO...</div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 gap-3 max-h-96 overflow-auto pr-2 custom-scrollbar">
                                {opciones.map((opcion) => (
                                    <button
                                        key={opcion}
                                        onClick={() => { setSeleccionada(opcion); setOtra(''); }}
                                        className={cn(
                                            "w-full p-6 rounded-3xl text-left font-black text-xl transition-all border flex items-center justify-between group",
                                            seleccionada === opcion
                                                ? "bg-warning-yellow border-warning-yellow text-black"
                                                : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:border-white/20"
                                        )}
                                    >
                                        {opcion}
                                        {seleccionada === opcion && <Check className="h-7 w-7" />}
                                    </button>
                                ))}
                                <button
                                    onClick={() => setSeleccionada('OTRA')}
                                    className={cn(
                                        "w-full p-6 rounded-3xl text-left font-black text-xl transition-all border flex items-center justify-between",
                                        seleccionada === 'OTRA'
                                            ? "bg-warning-yellow border-warning-yellow text-black"
                                            : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
                                    )}
                                >
                                    OTRA (ESPECIFICAR)
                                    {seleccionada === 'OTRA' && <Check className="h-7 w-7" />}
                                </button>
                            </div>

                            {seleccionada === 'OTRA' && (
                                <div className="mt-6 animate-in slide-in-from-top-2">
                                    <textarea
                                        placeholder="Describa el motivo..."
                                        className="w-full bg-black/50 border-2 border-warning-yellow/50 rounded-[2rem] p-6 text-white text-xl focus:outline-none focus:ring-4 focus:ring-warning-yellow/20 transition-all font-black"
                                        rows={3}
                                        value={otra}
                                        onChange={(e) => setOtra(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="p-10 pt-0 flex gap-4">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-6 rounded-[2rem] font-black text-gray-500 hover:bg-white/5 transition-all uppercase tracking-widest text-lg"
                    >
                        Cancelar
                    </button>
                    <button
                        disabled={!seleccionada || (seleccionada === 'OTRA' && !otra)}
                        onClick={handleConfirm}
                        className="flex-1 py-6 bg-warning-yellow text-black rounded-[2rem] font-black hover:bg-yellow-500 transition-all transform active:scale-95 disabled:opacity-30 disabled:grayscale uppercase tracking-widest shadow-lg shadow-warning-yellow/20 text-lg"
                    >
                        Confirmar
                    </button>
                </div>

            </div>
        </div>
    );
}
