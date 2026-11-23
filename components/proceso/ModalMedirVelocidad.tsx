'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Proceso, ColaboradorLog } from '@/types';
import { addMedicionVelocidad } from '@/lib/firebase-db';
import {
  X,
  Gauge,
  RotateCcw,
  Save,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Clock,
  Hash,
  AlertCircle,
  FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalMedirVelocidadProps {
  proceso: Proceso;
  colaborador: ColaboradorLog;
  onClose: () => void;
  onSuccess: (mensaje: string) => void;
  currentUser: string;
}

export default function ModalMedirVelocidad({
  proceso,
  colaborador,
  onClose,
  onSuccess,
  currentUser
}: ModalMedirVelocidadProps) {
  const [timestamps, setTimestamps] = useState<number[]>([]);
  const [elapsedLiveSec, setElapsedLiveSec] = useState<number>(0);
  const [notas, setNotas] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [isPressing, setIsPressing] = useState<boolean>(false);

  // Cronómetro en vivo mientras haya comenzado el muestreo
  useEffect(() => {
    if (timestamps.length === 0) {
      setElapsedLiveSec(0);
      return;
    }

    const interval = setInterval(() => {
      const start = timestamps[0];
      const now = Date.now();
      setElapsedLiveSec(Math.max(0, (now - start) / 1000));
    }, 100);

    return () => clearInterval(interval);
  }, [timestamps]);

  // Cálculos de métricas
  const muestrasCompletadas = Math.max(0, timestamps.length - 1);
  const duracionRealSegundos = useMemo(() => {
    if (timestamps.length < 2) return 0;
    return (timestamps[timestamps.length - 1] - timestamps[0]) / 1000;
  }, [timestamps]);

  const velocidadUPM = useMemo(() => {
    if (muestrasCompletadas === 0 || duracionRealSegundos <= 0) return 0;
    const upm = (muestrasCompletadas / duracionRealSegundos) * 60;
    return Number(upm.toFixed(1));
  }, [muestrasCompletadas, duracionRealSegundos]);

  const ultimoCicloSegundos = useMemo(() => {
    if (timestamps.length < 2) return 0;
    const delta = (timestamps[timestamps.length - 1] - timestamps[timestamps.length - 2]) / 1000;
    return Number(delta.toFixed(2));
  }, [timestamps]);

  const velocidadTeorica = proceso.velocidadTeorica || 0;
  const comparativa = useMemo(() => {
    if (!velocidadTeorica || velocidadUPM === 0) return null;
    const diff = Number((velocidadUPM - velocidadTeorica).toFixed(1));
    const porcentaje = Math.round((velocidadUPM / velocidadTeorica) * 100);
    const esMayorOIgual = diff >= 0;
    return {
      diff,
      porcentaje,
      esMayorOIgual
    };
  }, [velocidadUPM, velocidadTeorica]);

  // Manejador del clic de medición
  const handleTap = () => {
    const now = Date.now();
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(40);
      }
    } catch {}

    setIsPressing(true);
    setTimeout(() => setIsPressing(false), 120);

    setTimestamps(prev => [...prev, now]);
    setError('');
  };

  // Reiniciar medición
  const handleReset = () => {
    setTimestamps([]);
    setElapsedLiveSec(0);
    setError('');
  };

  // Guardar medición
  const handleSave = async () => {
    if (muestrasCompletadas < 1 || velocidadUPM <= 0) {
      setError('Debe registrar al menos 2 clics (1 muestra completa) para calcular la velocidad.');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      await addMedicionVelocidad({
        procesoId: proceso.id,
        colaboradorId: colaborador.colaboradorId,
        colaboradorLogId: colaborador.id,
        nombreColaborador: colaborador.nombre,
        ordenProduccion: proceso.ordenProduccion,
        producto: proceso.producto,
        lote: proceso.lote,
        etapa: proceso.etapa,
        velocidadUPM,
        velocidadTeorica: velocidadTeorica || undefined,
        muestras: muestrasCompletadas,
        duracionSegundos: duracionRealSegundos,
        notas: notas.trim() || undefined,
        registradoPor: currentUser
      });

      onSuccess(`Velocidad de ${colaborador.nombre} registrada exitosamente: ${velocidadUPM} UPM.`);
      onClose();
    } catch (err: any) {
      console.error('Error al guardar medición:', err);
      setError('Ocurrió un error al guardar la medición. Intente de nuevo.');
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 md:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="glass w-full max-w-xl rounded-[2.5rem] overflow-hidden flex flex-col border border-white/10 shadow-2xl bg-zinc-950/95 max-h-[92vh]">
        {/* Cabecera */}
        <div className="p-6 md:p-7 border-b border-white/10 flex items-center justify-between bg-white/[0.03]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary-blue/20 flex items-center justify-center text-primary-blue border border-primary-blue/30 shadow-lg shadow-primary-blue/10">
              <Gauge className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-primary-blue block">
                Herramienta de Medición
              </span>
              <h3 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight">
                Velocidad de Empaque
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="p-2.5 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
            title="Cerrar"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Contenido scrolleable */}
        <div className="p-6 md:p-7 overflow-y-auto space-y-6 flex-1">
          {/* Ficha del Colaborador y Proceso */}
          <div className="p-4 bg-white/[0.03] rounded-2xl border border-white/10 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Colaborador en Línea</p>
              <p className="text-base md:text-lg font-black text-white uppercase mt-0.5">{colaborador.nombre}</p>
              <p className="text-[11px] text-gray-500 font-mono font-bold mt-0.5">
                ID: {colaborador.colaboradorId} • {colaborador.tipo.toUpperCase()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Velocidad Teórica</p>
              <p className="text-lg md:text-xl font-black font-mono text-cyan-400 mt-0.5">
                {velocidadTeorica > 0 ? `${velocidadTeorica} UPM` : 'No asignada'}
              </p>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                OP: {proceso.ordenProduccion}
              </p>
            </div>
          </div>

          {/* Tablero Principal de Velocidad Calculada */}
          <div className="relative p-6 rounded-3xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/10 text-center overflow-hidden">
            <span className="text-[11px] font-black uppercase tracking-[0.3em] text-gray-400 block mb-2">
              Velocidad Promedio Calculada
            </span>

            <div className="flex items-baseline justify-center gap-2">
              <span className="font-mono text-5xl md:text-6xl font-black text-white tracking-tight drop-shadow-md">
                {muestrasCompletadas >= 1 ? velocidadUPM.toFixed(1) : '--'}
              </span>
              <span className="text-lg md:text-xl font-black text-primary-blue uppercase font-mono">
                UPM
              </span>
            </div>
            <p className="text-xs text-gray-400 font-medium mt-1">
              Unidades por minuto
            </p>

            {/* Comparativa con Velocidad Teórica */}
            {comparativa && (
              <div className="mt-4 inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border transition-all animate-in fade-in"
                style={{
                  backgroundColor: comparativa.esMayorOIgual ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  borderColor: comparativa.esMayorOIgual ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)',
                  color: comparativa.esMayorOIgual ? '#4ade80' : '#f87171'
                }}
              >
                {comparativa.esMayorOIgual ? (
                  <TrendingUp className="h-4 w-4 shrink-0 text-success-green" />
                ) : (
                  <TrendingDown className="h-4 w-4 shrink-0 text-danger-red" />
                )}
                <span>
                  {comparativa.esMayorOIgual
                    ? `+${comparativa.diff} UPM (${comparativa.porcentaje}%) por encima de la teórica`
                    : `${comparativa.diff} UPM (${comparativa.porcentaje}%) por debajo de la teórica`}
                </span>
              </div>
            )}

            {/* Submétricas: Muestras, Tiempo, Último ciclo */}
            <div className="grid grid-cols-3 gap-2 mt-6 pt-5 border-t border-white/10">
              <div className="p-2.5 rounded-xl bg-white/[0.02]">
                <div className="flex items-center justify-center gap-1.5 text-gray-400 mb-1">
                  <Hash className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Muestras</span>
                </div>
                <p className="font-mono text-lg md:text-xl font-black text-white">
                  {muestrasCompletadas} <span className="text-[10px] text-gray-500 font-normal">uds</span>
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-white/[0.02]">
                <div className="flex items-center justify-center gap-1.5 text-gray-400 mb-1">
                  <Clock className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Tiempo</span>
                </div>
                <p className="font-mono text-lg md:text-xl font-black text-white">
                  {elapsedLiveSec > 0 ? `${elapsedLiveSec.toFixed(1)}s` : '0.0s'}
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-white/[0.02]">
                <div className="flex items-center justify-center gap-1.5 text-gray-400 mb-1">
                  <Gauge className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Último Ciclo</span>
                </div>
                <p className="font-mono text-lg md:text-xl font-black text-white">
                  {ultimoCicloSegundos > 0 ? `${ultimoCicloSegundos}s` : '--'}
                </p>
              </div>
            </div>
          </div>

          {/* BOTÓN GIGANTE DE CLIC / TAPPING */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleTap}
              disabled={isSaving}
              className={cn(
                "w-full py-8 md:py-10 px-6 rounded-3xl font-black uppercase transition-all duration-150 select-none shadow-2xl flex flex-col items-center justify-center gap-2 border-2",
                timestamps.length === 0
                  ? "bg-gradient-to-r from-primary-blue to-blue-600 border-blue-400 text-white hover:brightness-110 active:scale-[0.98] shadow-blue-500/25"
                  : "bg-gradient-to-r from-emerald-600 to-success-green border-emerald-400 text-white hover:brightness-110 active:scale-[0.98] shadow-emerald-500/25",
                isPressing && "scale-95 brightness-125"
              )}
            >
              <div className="text-2xl md:text-3xl tracking-wide flex items-center gap-3">
                {timestamps.length === 0 ? (
                  <>
                    <span>1.er CLIC: MARCAR INICIO</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-7 w-7 animate-pulse" />
                    <span>¡REGISTRAR UNIDAD! (CLIC #{timestamps.length + 1})</span>
                  </>
                )}
              </div>
              <p className="text-xs md:text-sm font-semibold text-white/80 normal-case tracking-normal">
                {timestamps.length === 0
                  ? "Presione exactamente cuando el colaborador termine la primera unidad de referencia."
                  : `Haga clic cada vez que el operario termine un empaque (Muestras tomadas: ${muestrasCompletadas}).`}
              </p>
            </button>

            {/* Botón de Reiniciar / Descartar */}
            {timestamps.length > 0 && (
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-danger-red transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reiniciar Medición
                </button>
              </div>
            )}
          </div>

          {/* Campo de Notas / Observaciones */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Observaciones / Notas (Opcional)
            </label>
            <input
              type="text"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Ej: Cambio de bobina, ritmo constante, primer lote del día..."
              disabled={isSaving}
              maxLength={200}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-primary-blue focus:ring-1 focus:ring-primary-blue transition-all"
            />
          </div>

          {error && (
            <div className="p-3.5 bg-danger-red/15 border border-danger-red/30 rounded-xl flex items-center gap-2.5 text-danger-red text-xs font-bold">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer / Botones de acción */}
        <div className="p-5 md:p-6 border-t border-white/10 bg-white/[0.02] flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-5 py-3 rounded-xl border border-white/10 text-gray-400 font-bold text-xs uppercase tracking-widest hover:bg-white/5 hover:text-white transition-all"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || muestrasCompletadas < 1}
            className={cn(
              "px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg",
              muestrasCompletadas >= 1 && !isSaving
                ? "bg-primary-blue text-white hover:bg-blue-600 shadow-blue-500/20 active:scale-95 cursor-pointer"
                : "bg-white/10 text-gray-500 cursor-not-allowed border border-white/5"
            )}
          >
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Guardar Medición ({muestrasCompletadas} uds)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
