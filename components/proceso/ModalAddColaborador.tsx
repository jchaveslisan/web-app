"use client";

import { useState, useEffect } from 'react';
import { X, Search, UserPlus } from 'lucide-react';
import { getMaestroColaboradores, addColaboradorToLog, addEventoLog, getColaboradoresActivos } from '@/lib/firebase-db';
import { ColaboradorMaestro } from '@/types';
import { Timestamp } from 'firebase/firestore';

interface Props {
    procesoId: string;
    onClose: () => void;
    currentUser: string;
}

export default function ModalAddColaborador({ procesoId, onClose, currentUser }: Props) {
    const [loading, setLoading] = useState(true);
    const [maestro, setMaestro] = useState<ColaboradorMaestro[]>([]);
    const [activosTotal, setActivosTotal] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [tipo, setTipo] = useState<'colaborador' | 'apoyo' | 'equipo'>('colaborador');

    useEffect(() => {
        const loadData = async () => {
            try {
                const [maestroData, activosData] = await Promise.all([
                    getMaestroColaboradores(),
                    getColaboradoresActivos()
                ]);
                setMaestro(maestroData);
                setActivosTotal(activosData.map((a: any) => a.colaboradorId));
            } catch (error) {
                console.error("Error loading personnel data:", error);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    const handleSelect = async (colab: ColaboradorMaestro) => {
        if (activosTotal.includes(colab.claveRegistro)) {
            alert(`El colaborador ${colab.nombreCompleto} ya se encuentra activo en un proceso.`);
            return;
        }

        try {
            await addColaboradorToLog({
                procesoId,
                colaboradorId: colab.id,
                nombre: colab.nombreCompleto,
                horaIngreso: Timestamp.now(),
                tipo,
                registradoPorUsuario: currentUser,
            });

            await addEventoLog(
                procesoId,
                "Ingreso de Personal",
                `${colab.nombreCompleto} ingresó como ${tipo}`,
                "PERSONAL",
                currentUser
            );

            onClose();
        } catch (error) {
            console.error(error);
            alert("Error al agregar colaborador");
        }
    };

    const filtered = maestro.filter(c =>
        c.nombreCompleto.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.claveRegistro.includes(searchTerm)
    );

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="glass w-full max-w-lg rounded-3xl overflow-hidden flex flex-col max-h-[80vh] border border-white/10 shadow-2xl">
                <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5">
                    <h3 className="text-xl font-black flex items-center gap-2">
                        <UserPlus className="h-6 w-6 text-primary-blue" /> AGREGAR PERSONAL
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X className="h-6 w-6" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div className="flex gap-2">
                        {(['colaborador', 'apoyo', 'equipo'] as const).map((t) => (
                            <button
                                key={t}
                                onClick={() => setTipo(t)}
                                className={cn(
                                    "flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all border",
                                    tipo === t ? "bg-primary-blue border-primary-blue text-white" : "bg-white/5 border-white/10 text-gray-500 hover:bg-white/10"
                                )}
                            >
                                {t}
                            </button>
                        ))}
                    </div>

                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Buscar por nombre o ID..."
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-blue/50 transition-all font-bold"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-auto p-2 space-y-1 text-white">
                    {loading ? (
                        <div className="text-center py-10 text-gray-500 font-bold animate-pulse uppercase tracking-widest text-xs">Cargando maestro...</div>
                    ) : (
                        filtered.map((colab) => {
                            const estaActivo = activosTotal.includes(colab.claveRegistro);
                            return (
                                <button
                                    key={colab.id}
                                    onClick={() => handleSelect(colab)}
                                    className={cn(
                                        "w-full flex items-center justify-between p-4 rounded-2xl transition-all group text-left",
                                        estaActivo ? "opacity-50 cursor-not-allowed bg-white/5" : "hover:bg-primary-blue/10"
                                    )}
                                    disabled={estaActivo}
                                >
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className={cn(
                                                "font-bold uppercase transition-colors",
                                                estaActivo ? "text-gray-500" : "text-white group-hover:text-primary-blue"
                                            )}>
                                                {colab.nombreCompleto}
                                            </p>
                                            {estaActivo && (
                                                <span className="text-[9px] bg-warning-yellow/10 text-warning-yellow px-2 py-0.5 rounded-full font-black border border-warning-yellow/20">
                                                    EN LÍNEA
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500 font-bold font-mono uppercase">ID: {colab.claveRegistro}</p>
                                    </div>
                                    {!estaActivo && <UserPlus className="h-5 w-5 text-gray-700 group-hover:text-primary-blue opacity-0 group-hover:opacity-100 transition-all" />}
                                </button>
                            );
                        })
                    )}
                    {!loading && filtered.length === 0 && (
                        <div className="text-center py-10 text-gray-500 font-bold italic">No se encontraron resultados</div>
                    )}
                </div>
            </div>
        </div>
    );
}

function cn(...inputs: any[]) {
    return inputs.filter(Boolean).join(' ');
}
