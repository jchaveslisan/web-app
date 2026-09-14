'use client';

import React, { useState, useEffect, useRef } from 'react';
import { getColaboradorByClave, correctComentario } from '@/lib/firebase-db';
import { X, MessageSquare, Key, ArrowRight, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Comentario, MotivoCorreccion } from '@/types';

interface ModalCorregirComentarioProps {
  comentario: Comentario;
  colaboradores?: any[]; // Opcional para restringir a personal del proceso
  onClose: () => void;
  onSuccess: (mensaje: string) => void;
}

export default function ModalCorregirComentario({
  comentario,
  colaboradores,
  onClose,
  onSuccess
}: ModalCorregirComentarioProps) {
  const [step, setStep] = useState<'pin' | 'correccion'>('pin');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState<{ id: string; nombreCompleto: string } | null>(null);
  const [comentarioNuevoText, setComentarioNuevoText] = useState(comentario.comentario);
  const [success, setSuccess] = useState(false);
  const [motivos, setMotivos] = useState<MotivoCorreccion[]>([]);
  const [motivoSeleccionado, setMotivoSeleccionado] = useState('');
  const [motivoOtro, setMotivoOtro] = useState('');

  const pinInputRef = useRef<HTMLInputElement>(null);
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Cargar motivos de la DB en tiempo real
  useEffect(() => {
    const q = query(
      collection(db, 'maestro_motivos_correccion'),
      where('activo', '==', true)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MotivoCorreccion));
      setMotivos(data);
      if (data.length > 0) {
        setMotivoSeleccionado(data[0].texto);
      } else {
        setMotivoSeleccionado('Otro (Especificar)');
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (step === 'pin' && pinInputRef.current) {
      pinInputRef.current.focus();
    } else if (step === 'correccion' && commentTextareaRef.current) {
      commentTextareaRef.current.focus();
    }
  }, [step]);

  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const formattedPin = pin.trim().toUpperCase();
    if (!formattedPin) {
      setError('Por favor, ingrese su PIN de colaborador.');
      return;
    }

    setLoading(true);
    try {
      // 1. Buscar colaborador en el maestro por PIN
      const colabMaestro = await getColaboradorByClave(formattedPin);
      if (!colabMaestro) {
        setError('El PIN ingresado no es válido o el colaborador no está registrado.');
        setPin('');
        setLoading(false);
        return;
      }

      // 2. Restringir la corrección únicamente a quien escribió la observación original (ALCOA)
      if (colabMaestro.id !== comentario.colaboradorId) {
        setError(`Esta observación fue registrada por "${comentario.nombreColaborador}". Bajo el principio de ALCOA, solo el creador original puede realizar correcciones.`);
        setPin('');
        setLoading(false);
        return;
      }

      // 3. Opcional: Verificar si el colaborador está registrado en este proceso
      if (colaboradores && colaboradores.length > 0) {
        const estaRegistrado = colaboradores.some(c => c.colaboradorId === colabMaestro.id);
        if (!estaRegistrado) {
          setError(`El colaborador "${colabMaestro.nombreCompleto}" no está registrado en este proceso. Solo personal asociado puede realizar correcciones.`);
          setPin('');
          setLoading(false);
          return;
        }
      }

      // Autorizado
      setPin('');
      setEditor({
        id: colabMaestro.id,
        nombreCompleto: colabMaestro.nombreCompleto
      });
      setStep('correccion');
    } catch (err) {
      console.error('Error al verificar PIN para corrección:', err);
      setError('Ocurrió un error al verificar la identidad. Inténtelo de nuevo.');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!comentarioNuevoText.trim()) {
      setError('El nuevo comentario no puede estar vacío.');
      return;
    }

    if (comentarioNuevoText.trim() === comentario.comentario.trim()) {
      setError('El comentario no ha cambiado. Modifique el texto para registrar la corrección.');
      return;
    }

    const motivoFinal = motivoSeleccionado === 'Otro (Especificar)' 
      ? motivoOtro.trim() 
      : motivoSeleccionado;

    if (!motivoFinal) {
      setError('Por favor, ingrese o seleccione el motivo de la corrección.');
      return;
    }

    if (!editor) return;

    setLoading(true);
    try {
      await correctComentario(
        comentario.id,
        editor.id,
        editor.nombreCompleto,
        comentario.comentario,
        comentarioNuevoText.trim(),
        motivoFinal
      );

      setSuccess(true);
      setTimeout(() => {
        onSuccess('Corrección registrada exitosamente.');
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Error al guardar corrección de comentario:', err);
      setError('No se pudo guardar la corrección. Inténtelo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="glass w-full max-w-lg rounded-[2.5rem] overflow-hidden flex flex-col border border-white/10 shadow-2xl animate-in zoom-in duration-300 bg-background-dark/95">
        
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5">
          <h3 className="text-xl font-black uppercase flex items-center gap-3 tracking-wider text-warning-yellow">
            <MessageSquare className="h-6 w-6 text-warning-yellow animate-pulse" /> CORREGIR OBSERVACIÓN
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
                <h4 className="text-2xl font-black text-white uppercase">¡Corrección Guardada!</h4>
                <p className="text-gray-400 text-sm mt-1 uppercase tracking-wider">Registrado por: {editor?.nombreCompleto}</p>
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

              {/* ALCOA Principle Warning Banner */}
              <div className="p-4 bg-warning-yellow/10 border border-warning-yellow/20 rounded-2xl flex items-start gap-3 text-warning-yellow text-xs font-semibold leading-relaxed">
                <ShieldAlert className="h-5 w-5 shrink-0 text-warning-yellow mt-0.5 animate-pulse" />
                <div>
                  <p className="uppercase font-black tracking-widest text-[10px] mb-0.5">Integridad de Datos (ALCOA)</p>
                  <p className="text-gray-300">
                    Las observaciones no pueden eliminarse. Esta acción conservará el registro original tachado y registrará este nuevo comentario asociado a su firma y fecha actual.
                  </p>
                </div>
              </div>

              {step === 'pin' ? (
                /* PASO 1: VERIFICAR PIN */
                <form onSubmit={handleVerifyPin} className="space-y-6">
                  <div className="space-y-2 text-center max-w-sm mx-auto">
                    <div className="w-12 h-12 rounded-2xl bg-warning-yellow/10 border border-warning-yellow/20 flex items-center justify-center mx-auto text-warning-yellow mb-2">
                      <Key className="h-6 w-6" />
                    </div>
                    <h4 className="text-lg font-bold text-white">Identificación del Editor</h4>
                    <p className="text-xs text-gray-400">
                      Ingrese su PIN de registro para firmar y autorizar esta corrección en la bitácora.
                    </p>
                  </div>

                  <div className="relative">
                    <input
                      ref={pinInputRef}
                      type="text"
                      autoComplete="new-password"
                      style={{ WebkitTextSecurity: 'disc' } as any}
                      pattern="[0-9]*"
                      inputMode="numeric"
                      value={pin}
                      onChange={(e) => {
                        setPin(e.target.value);
                        setError('');
                      }}
                      placeholder="INGRESE SU PIN..."
                      disabled={loading}
                      className="w-full bg-white border-2 border-warning-yellow rounded-2xl p-4 font-mono text-2xl font-black text-center text-black focus:ring-4 focus:ring-warning-yellow/20 outline-none transition-all placeholder:text-gray-400"
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
                      className="flex-1 py-4 bg-warning-yellow hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed text-black rounded-2xl font-black transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs shadow-lg shadow-warning-yellow/10"
                    >
                      {loading ? 'Verificando...' : 'Siguiente'}
                      {!loading && <ArrowRight className="h-4 w-4" />}
                    </button>
                  </div>
                </form>
              ) : (
                /* PASO 2: INGRESO DE CORRECCIÓN */
                <form onSubmit={handleSaveCorrection} className="space-y-6">
                  {/* Editor Info */}
                  <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                    <div className="w-10 h-10 rounded-full bg-warning-yellow text-black flex items-center justify-center font-black text-sm uppercase">
                      {editor?.nombreCompleto.substring(0, 2)}
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Editor Identificado</p>
                      <h4 className="font-black text-white uppercase text-base">{editor?.nombreCompleto}</h4>
                    </div>
                  </div>

                  {/* Original text readout */}
                  <div className="space-y-1">
                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">Texto Original (Se tachará)</label>
                    <div className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 text-gray-400 font-medium leading-relaxed italic line-through">
                      "{comentario.comentario}"
                    </div>
                  </div>

                  {/* Motivo de la Corrección */}
                  <div className="space-y-2">
                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest font-bold">Motivo de la Corrección</label>
                    <select
                      value={motivoSeleccionado}
                      onChange={(e) => {
                        setMotivoSeleccionado(e.target.value);
                        setError('');
                      }}
                      disabled={loading}
                      className="w-full bg-white border border-gray-300 text-black rounded-2xl p-4 font-bold outline-none focus:ring-4 focus:ring-warning-yellow/20 transition-all text-base cursor-pointer"
                    >
                      {motivos.map((m) => (
                        <option key={m.id} value={m.texto}>{m.texto}</option>
                      ))}
                      <option value="Otro (Especificar)">Otro (Especificar)</option>
                    </select>
                  </div>

                  {motivoSeleccionado === 'Otro (Especificar)' && (
                    <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                      <label className="block text-xs font-black text-gray-500 uppercase tracking-widest font-bold">Especifique el Motivo</label>
                      <input
                        type="text"
                        value={motivoOtro}
                        onChange={(e) => {
                          setMotivoOtro(e.target.value);
                          setError('');
                        }}
                        placeholder="Escriba la razón de la corrección..."
                        disabled={loading}
                        className="w-full bg-white border border-gray-300 rounded-2xl p-4 text-black focus:ring-4 focus:ring-warning-yellow/20 outline-none transition-all placeholder:text-gray-400 font-bold text-base"
                      />
                    </div>
                  )}

                  {/* New text input */}
                  <div className="space-y-2">
                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">Nuevo Comentario / Corrección</label>
                    <textarea
                      ref={commentTextareaRef}
                      value={comentarioNuevoText}
                      onChange={(e) => {
                        setComentarioNuevoText(e.target.value);
                        setError('');
                      }}
                      placeholder="Escriba la corrección del comentario aquí..."
                      disabled={loading}
                      rows={4}
                      className="w-full bg-white border-2 border-warning-yellow rounded-2xl p-4 text-black focus:ring-4 focus:ring-warning-yellow/20 outline-none transition-all placeholder:text-gray-400 font-bold leading-relaxed resize-none text-base"
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
                      disabled={loading || !comentarioNuevoText.trim() || comentarioNuevoText.trim() === comentario.comentario.trim()}
                      className="flex-1 py-4 bg-success-green text-black disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl font-black transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs shadow-lg shadow-success-green/10"
                    >
                      {loading ? 'Guardando...' : 'Aplicar Corrección'}
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
