'use client';

import React, { useState, useMemo } from 'react';
import { Proceso, MedicionVelocidad } from '@/types';
import {
  X,
  Gauge,
  TrendingUp,
  TrendingDown,
  Clock,
  Hash,
  User,
  Search,
  Calendar,
  FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface ModalHistorialVelocidadesProps {
  proceso: Proceso;
  mediciones: MedicionVelocidad[];
  onClose: () => void;
}

export default function ModalHistorialVelocidades({
  proceso,
  mediciones,
  onClose
}: ModalHistorialVelocidadesProps) {
  const [filtroTexto, setFiltroTexto] = useState('');
  const velocidadTeorica = proceso.velocidadTeorica || 0;

  // Filtrado
  const medicionesFiltradas = useMemo(() => {
    if (!filtroTexto.trim()) return mediciones;
    const q = filtroTexto.toLowerCase();
    return mediciones.filter(m =>
      m.nombreColaborador.toLowerCase().includes(q) ||
      m.colaboradorId.toLowerCase().includes(q) ||
      (m.notas && m.notas.toLowerCase().includes(q)) ||
      m.registradoPor.toLowerCase().includes(q)
    );
  }, [mediciones, filtroTexto]);

  // Métricas globales del historial
  const stats = useMemo(() => {
    if (mediciones.length === 0) return null;
    const suma = mediciones.reduce((acc, curr) => acc + (curr.velocidadUPM || 0), 0);
    const prom = Number((suma / mediciones.length).toFixed(1));
    const max = Math.max(...mediciones.map(m => m.velocidadUPM || 0));
    const min = Math.min(...mediciones.map(m => m.velocidadUPM || 0));
    return {
      total: mediciones.length,
      promedio: prom,
      max,
      min
    };
  }, [mediciones]);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 md:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="glass w-full max-w-3xl rounded-[2.5rem] overflow-hidden flex flex-col border border-white/10 shadow-2xl bg-zinc-950/95 max-h-[90vh]">
        {/* Cabecera */}
        <div className="p-6 md:p-7 border-b border-white/10 flex items-center justify-between bg-white/[0.03]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 flex items-center justify-center text-cyan-400 border border-cyan-500/30 shadow-lg shadow-cyan-500/10">
              <Gauge className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-cyan-400 block">
                Historial de Mediciones
              </span>
              <h3 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight">
                Velocidades de Empaque
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
            title="Cerrar"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Resumen y Buscador */}
        <div className="p-6 md:p-7 space-y-5 border-b border-white/5 bg-white/[0.01]">
          {/* Ficha Resumen */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 bg-white/5 rounded-2xl border border-white/5">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">
                  Mediciones
                </span>
                <p className="font-mono text-xl font-black text-white mt-1">
                  {stats.total}
                </p>
              </div>

              <div className="p-3.5 bg-white/5 rounded-2xl border border-white/5">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">
                  Promedio Medido
                </span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="font-mono text-xl font-black text-cyan-400">
                    {stats.promedio}
                  </span>
                  <span className="text-xs text-gray-400 font-bold">UPM</span>
                </div>
              </div>

              <div className="p-3.5 bg-white/5 rounded-2xl border border-white/5">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">
                  Velocidad Teórica
                </span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="font-mono text-xl font-black text-white">
                    {velocidadTeorica > 0 ? velocidadTeorica : '--'}
                  </span>
                  <span className="text-xs text-gray-400 font-bold">UPM</span>
                </div>
              </div>

              <div className="p-3.5 bg-white/5 rounded-2xl border border-white/5">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">
                  Máxima / Mínima
                </span>
                <p className="font-mono text-sm font-black text-white mt-1">
                  <span className="text-success-green">{stats.max}</span> / <span className="text-danger-red">{stats.min}</span>
                </p>
              </div>
            </div>
          )}

          {/* Barra de búsqueda */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
              placeholder="Buscar por colaborador, notas o supervisor..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
            />
          </div>
        </div>

        {/* Lista de Mediciones */}
        <div className="p-6 md:p-7 overflow-y-auto space-y-3 flex-1">
          {medicionesFiltradas.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-white/5 rounded-3xl">
              <Gauge className="h-10 w-10 text-gray-600 mx-auto mb-2 opacity-50" />
              <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">
                {mediciones.length === 0
                  ? 'No hay mediciones registradas en este proceso aún'
                  : 'No se encontraron mediciones con el filtro aplicado'}
              </p>
            </div>
          ) : (
            medicionesFiltradas.map((m) => {
              const teorica = m.velocidadTeorica || velocidadTeorica || 0;
              const hasTeorica = teorica > 0;
              const diff = hasTeorica ? Number((m.velocidadUPM - teorica).toFixed(1)) : 0;
              const esMayorOIgual = diff >= 0;
              const porcentaje = hasTeorica ? Math.round((m.velocidadUPM / teorica) * 100) : null;

              const fechaFormatted = m.fecha?.toDate
                ? format(m.fecha.toDate(), 'dd/MM/yyyy HH:mm:ss')
                : 'Reciente';

              return (
                <div
                  key={m.id || `${m.colaboradorId}-${m.fecha}`}
                  className="p-4 md:p-5 bg-white/[0.03] rounded-2xl border border-white/5 hover:border-white/15 transition-all space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center font-black text-xs text-white uppercase">
                        {m.nombreColaborador.substring(0, 2)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-black text-white uppercase text-base">{m.nombreColaborador}</p>
                          <span className="text-[9px] font-mono font-bold text-gray-400 bg-white/5 px-2 py-0.5 rounded border border-white/5">
                            ID: {m.colaboradorId}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-gray-400 font-bold mt-0.5">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> {fechaFormatted}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" /> Reg: {m.registradoPor}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Métrica de velocidad y comparativa */}
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="flex items-baseline gap-1 justify-end">
                          <span className="font-mono text-2xl font-black text-white">
                            {m.velocidadUPM}
                          </span>
                          <span className="text-xs font-black text-primary-blue font-mono">UPM</span>
                        </div>
                        <p className="text-[10px] text-gray-400 font-mono">
                          {m.muestras} uds en {m.duracionSegundos?.toFixed(1)}s
                        </p>
                      </div>

                      {hasTeorica && (
                        <div
                          className={cn(
                            "px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border flex items-center gap-1 shrink-0",
                            esMayorOIgual
                              ? "bg-success-green/10 text-success-green border-success-green/20"
                              : "bg-danger-red/10 text-danger-red border-danger-red/20"
                          )}
                          title={`Teórica: ${teorica} UPM (${porcentaje}%)`}
                        >
                          {esMayorOIgual ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          <span>
                            {esMayorOIgual ? `+${diff}` : diff} ({porcentaje}%)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Notas si existen */}
                  {m.notas && (
                    <div className="pt-2 border-t border-white/5 flex items-start gap-2 text-xs text-gray-300">
                      <FileText className="h-3.5 w-3.5 text-gray-500 mt-0.5 shrink-0" />
                      <span className="italic">{m.notas}</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 md:p-5 border-t border-white/10 bg-white/[0.02] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-white/10 text-white font-bold text-xs uppercase tracking-widest hover:bg-white/20 transition-all"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
