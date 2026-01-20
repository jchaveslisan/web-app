'use client';

import React, { useState } from 'react';
import { executeBulkExit } from '@/lib/firebase-db';

interface ModalBulkExitProps {
  procesoId: string;
  userId: string | undefined;
  onClose: () => void;
  onSuccess: (exitCount: number) => void;
}

export default function ModalBulkExit({ procesoId, userId, onClose, onSuccess }: ModalBulkExitProps) {
  const [supervisorPin, setSupervisorPin] = useState('');
  const [selectedJustification, setSelectedJustification] = useState<'Alimentación' | 'Fin de Jornada' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async (justification: 'Alimentación' | 'Fin de Jornada') => {
    setError('');
    
    if (!supervisorPin.trim()) {
      setError('Debe ingresar la Clave (Pin) del supervisor.');
      return;
    }

    setLoading(true);
    try {
      const result = await executeBulkExit(
        procesoId,
        justification,
        supervisorPin.trim().toUpperCase(),
        userId
      );

      if (result.success) {
        onSuccess(result.exitCount || 0);
        onClose();
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-black border border-gray-700 rounded-lg p-8 max-w-md w-full">
        {/* Title */}
        <h2 className="text-2xl font-bold text-white mb-6">Autorizar Salida Grupal</h2>

        {/* Supervisor PIN Input */}
        <div className="mb-6">
          <label className="block text-white font-semibold mb-2">
            Clave de Supervisor (Pin) para Autorizar:
          </label>
          <input
            type="text"
            value={supervisorPin}
            onChange={(e) => {
              setSupervisorPin(e.target.value);
              setError('');
            }}
            placeholder="Ingrese la clave..."
            className="w-full px-4 py-2 bg-gray-900 border border-gray-600 text-white rounded focus:outline-none focus:border-blue-500"
            disabled={loading}
            autoFocus
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-600 rounded text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-4">
          <button
            onClick={() => handleConfirm('Alimentación')}
            disabled={loading || !supervisorPin.trim()}
            className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded transition-colors"
          >
            {loading ? 'Procesando...' : 'Salida por Alimentación'}
          </button>
          <button
            onClick={() => handleConfirm('Fin de Jornada')}
            disabled={loading || !supervisorPin.trim()}
            className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded transition-colors"
          >
            {loading ? 'Procesando...' : 'Fin de Jornada'}
          </button>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={loading}
          className="w-full mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-white rounded transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
