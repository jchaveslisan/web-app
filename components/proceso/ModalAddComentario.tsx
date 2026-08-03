'use client';

import React, { useState, useEffect, useRef } from 'react';
import { getColaboradorByClave, addComentario } from '@/lib/firebase-db';
import { ColaboradorLog, Proceso } from '@/types';
import { X, MessageSquare, Key, ArrowRight, CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalAddComentarioProps {
  proceso: Proceso;
  colaboradores: ColaboradorLog[];
  onClose: () => void;
  onSuccess: (mensaje: string) => void;
}

export default function ModalAddComentario({ proceso, colaboradores, onClose, onSuccess }: ModalAddComentarioProps) {
  const [step, setStep] = useState<'pin' | 'comentario'>('pin');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [collaborator, setCollaborator] = useState<{ id: string; nombreCompleto: string } | null>(null);
  const [comentarioText, setComentarioText] = useState('');
  const [success, setSuccess] = useState(false);

  const pinInputRef = useRef<HTMLInputElement>(null);
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (step === 'pin' && pinInputRef.current) {
      pinInputRef.current.focus();
    } else if (step === 'comentario' && commentTextareaRef.current) {
      commentTextareaRef.current.focus();
    }
  }, [step]);

  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const formattedPin = pin.trim().toUpperCase();
    if (!formattedPin) {
      setError('Por favor, ingrese un PIN de colaborador.');
      return;
    }

    setLoading(true);
    try {
      // 1. Buscar colaborador en el maestro por PIN
      const colabMaestro = await getColaboradorByClave(formattedPin);
      if (!colabMaestro) {
        setError('El PIN ingresado no es válido o el colaborador no está registrado.');
        setLoading(false);
        return;
      }

      // 2. Verificar si el colaborador está registrado en el proceso actual
      // Se permite tanto activos (horaSalida == null) como históricos (con horaSalida)
      const estaRegistrado = colaboradores.some(c => c.colaboradorId === colabMaestro.id);
      
      if (!estaRegistrado) {
        setError(`El colaborador "${colabMaestro.nombreCompleto}" no está registrado en este proceso (${proceso.etapa}). Para comentar, primero debe registrarse en la línea.`);
        setLoading(false);
        return;
      }

      // PIN Verificado y registrado en el proceso
      setCollaborator({
        id: colabMaestro.id,
        nombreCompleto: colabMaestro.nombreCompleto
      });
      setStep('comentario');
    } catch (err) {
      console.error('Error al verificar PIN:', err);
      setError('Ocurrió un error al verificar la identidad. Inténtelo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveComment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!comentarioText.trim()) {
      setError('El comentario no puede estar vacío.');
      return;
    }

    if (!collaborator) return;

    setLoading(true);
    try {
      await addComentario({
        procesoId: proceso.id,
        colaboradorId: collaborator.id,
        nombreColaborador: collaborator.nombreCompleto,
        comentario: comentarioText.trim(),
        ordenProduccion: proceso.ordenProduccion,
        etapa: proceso.etapa,
        producto: proceso.producto
      });

      setSuccess(true);
      setTimeout(() => {
        onSuccess('Observación registrada con éxito.');
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Error al guardar comentario:', err);
      setError('No se pudo guardar el comentario. Inténtelo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="glass w-full max-w-lg rounded-[2.5rem] overflow-hidden flex flex-col border border-white/10 shadow-2xl animate-in zoom-in duration-300 bg-background-dark/95">
        
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5">
          <h3 className="text-xl font-black uppercase flex items-center gap-3 tracking-wider">
            <MessageSquare className="h-6 w-6 text-primary-blue animate-pulse" /> AGREGAR OBSERVACIÓN
          </h3>
          <button 
            onClick={onClose} 
            disabled={loading}
            className="p-2 hover:bg-white/10 text-gray-400 hover:text-white rounded-full transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-8 space-y-6">
          {success ? (
            <div className="flex flex-col items-center justify-center py-10 gap-4 text-center animate-in zoom-in-95 duration-300">
              <CheckCircle2 className="h-16 w-16 text-success-green animate-bounce" />
              <div>
                <h4 className="text-2xl font-black text-white uppercase">¡Guardado Exitosamente!</h4>
                <p className="text-gray-400 text-sm mt-1 uppercase tracking-wider">Registrado bajo: {collaborator?.nombreCompleto}</p>
              </div>
            </div>
          ) : (
            <>
              {error && (
                <div className="p-4 bg-danger-red/10 border border-danger-red/20 rounded-2xl flex items-start gap-3 text-danger-red text-sm animate-in slide-in-from-top-2 duration-300">
                  <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {step === 'pin' ? (
                /* PASO 1: VERIFICAR PIN */
                <form onSubmit={handleVerifyPin} className="space-y-6">
                  <div className="space-y-2 text-center max-w-sm mx-auto">
                    <div className="w-12 h-12 rounded-2xl bg-primary-blue/10 border border-primary-blue/20 flex items-center justify-center mx-auto text-primary-blue mb-2">
                      <Key className="h-6 w-6" />
                    </div>
                    <h4 className="text-lg font-bold text-white">Identificación del Colaborador</h4>
                    <p className="text-xs text-gray-400">
                      Ingrese su PIN de registro para verificar que ha trabajado en la etapa de <span className="text-primary-blue font-bold font-mono">{proceso.etapa}</span>.
                    </p>
                  </div>

                  <div className="relative">
                    <input
                      ref={pinInputRef}
                      type="password"
                      pattern="[0-9]*"
                      inputMode="numeric"
                      value={pin}
                      onChange={(e) => {
                        setPin(e.target.value);
                        setError('');
                      }}
                      placeholder="INGRESE SU PIN..."
                      disabled={loading}
                      className="w-full bg-white border-2 border-primary-blue rounded-2xl p-4 font-mono text-2xl font-black text-center text-black focus:ring-4 focus:ring-primary-blue/20 outline-none transition-all placeholder:text-gray-400"
                    />
                  </div>

                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={loading}
                      className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-bold transition-all border border-white/10 uppercase tracking-widest text-xs"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={loading || !pin.trim()}
                      className="flex-1 py-4 bg-primary-blue hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-black transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs shadow-lg shadow-blue-500/10"
                    >
                      {loading ? 'Verificando...' : 'Siguiente'}
                      {!loading && <ArrowRight className="h-4 w-4" />}
                    </button>
                  </div>
                </form>
              ) : (
                /* PASO 2: INGRESO DE COMENTARIO */
                <form onSubmit={handleSaveComment} className="space-y-6">
                  <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                    <div className="w-10 h-10 rounded-full bg-primary-blue text-white flex items-center justify-center font-black text-sm uppercase">
                      {collaborator?.nombreCompleto.substring(0, 2)}
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Colaborador Identificado</p>
                      <h4 className="font-black text-white uppercase text-base">{collaborator?.nombreCompleto}</h4>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">Observación / Comentario</label>
                    <textarea
                      ref={commentTextareaRef}
                      value={comentarioText}
                      onChange={(e) => {
                        setComentarioText(e.target.value);
                        setError('');
                      }}
                      placeholder="Escriba aquí los detalles sobre el proceso, retraso, ajuste de máquina u otra novedad..."
                      disabled={loading}
                      rows={5}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:ring-2 focus:ring-primary-blue focus:border-primary-blue outline-none transition-all placeholder:text-gray-500 font-medium leading-relaxed resize-none"
                    />
                  </div>

                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => setStep('pin')}
                      disabled={loading}
                      className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-bold transition-all border border-white/10 uppercase tracking-widest text-xs"
                    >
                      Atrás
                    </button>
                    <button
                      type="submit"
                      disabled={loading || !comentarioText.trim()}
                      className="flex-1 py-4 bg-success-green text-black disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl font-black transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs shadow-lg shadow-success-green/10"
                    >
                      {loading ? 'Guardando...' : 'Guardar Observación'}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
