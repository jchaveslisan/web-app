import { Proceso, ColaboradorLog } from "@/types";
import { differenceInSeconds, addSeconds } from "date-fns";

export interface ProductivityStats {
    velocidadActual: number;
    eficiencia: number;
    tiempoRestanteStr: string;
    segundosTotalesRestantes: number;
    porcentajeCompletado: number;
    isTiempoExtra: boolean;
    isGracePeriod: boolean;
    numColaboradores: number;
}

export function calculateProductivity(proceso: Proceso, colaboradores: ColaboradorLog[]): ProductivityStats {
    const {
        cantidadProducir,
        trabajoCompletado,
        velocidadTeorica, // Vper (units per minute)
        estado,
        inicioPeriodoGracia
    } = proceso;

    // 1. Filtrar colaboradores activos de tipo 'colaborador'
    const activos = colaboradores.filter(c => !c.horaSalida && c.tipo === 'colaborador');
    const numColaboradores = activos.length;

    // 2. Cálculo de Velocidad del Equipo (Vequipo)
    const velocidadEquipoMin = velocidadTeorica * numColaboradores;

    // 3. Trabajo Restante
    const unidadesRestantes = Math.max(0, cantidadProducir - trabajoCompletado);
    const porcentajeCompletado = Math.min(100, (trabajoCompletado / cantidadProducir) * 100);

    let segundosTotalesRestantes = 0;
    let isTiempoExtra = false;
    let isGracePeriod = !!inicioPeriodoGracia;

    // --- LÓGICA DE TIEMPO RESTANTE DINÁMICA ---
    let nowRef = new Date();
    const isPausado = estado === 'Pausado' || (proceso as any).pausadoPorFaltaDePersonal;

    if (isPausado && proceso.ultimoUpdate) {
        nowRef = (proceso.ultimoUpdate as any).toDate?.() || new Date(proceso.ultimoUpdate);
    } else if (estado === 'Finalizado' && proceso.horaFinReal) {
        nowRef = (proceso.horaFinReal as any).toDate?.() || new Date(proceso.horaFinReal);
    }

    if (isGracePeriod) {
        // Lógica: Período de gracia fijo (15 minutos) desde que se activó
        const inicioGracia = (inicioPeriodoGracia as any).toDate?.() || new Date(inicioPeriodoGracia);
        const finGracia = addSeconds(inicioGracia, 15 * 60);
        segundosTotalesRestantes = differenceInSeconds(finGracia, nowRef);
    } else if (numColaboradores > 0 && (estado === 'Iniciado' || estado === 'Pausado' || estado === 'Finalizado')) {
        // Lógica: Cálculo dinámico basado en velocidad actual del equipo
        if (velocidadEquipoMin > 0) {
            const minutosTrabajoRestante = unidadesRestantes / velocidadEquipoMin;
            const segundosTrabajoRestante = minutosTrabajoRestante * 60;
            const segundosGracia = 15 * 60;
            segundosTotalesRestantes = segundosTrabajoRestante + segundosGracia;
        }
    }

    // Manejo de tiempo extra (negativo)
    if (segundosTotalesRestantes < 0) {
        isTiempoExtra = true;
        segundosTotalesRestantes = Math.abs(segundosTotalesRestantes);
    }

    // Formatear string
    let tiempoRestanteStr = "00:00:00";
    if (numColaboradores === 0 && estado === 'Iniciado') {
        tiempoRestanteStr = "PERSONAL REQUERIDO";
    } else {
        const h = Math.floor(segundosTotalesRestantes / 3600);
        const m = Math.floor((segundosTotalesRestantes % 3600) / 60);
        const s = Math.floor(segundosTotalesRestantes % 60);
        tiempoRestanteStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    // Eficiencia (%) -> Basada en el cumplimiento del objetivo teórico
    const eficiencia = velocidadTeorica > 0 ? ((trabajoCompletado / (cantidadProducir || 1)) * 100) : 0;

    return {
        velocidadActual: velocidadEquipoMin,
        eficiencia: Number(eficiencia.toFixed(1)),
        tiempoRestanteStr,
        segundosTotalesRestantes,
        porcentajeCompletado: Number(porcentajeCompletado.toFixed(1)),
        isTiempoExtra,
        isGracePeriod,
        numColaboradores
    };
}

export function formatSeconds(totalSeconds: number): string {
    if (totalSeconds < 0) return "00:00:00";
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
