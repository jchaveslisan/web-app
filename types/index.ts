export type UserRole = 'usuario' | 'supervisor' | 'superadmin';

export interface User {
    id: string;
    username: string;
    email: string;
    password?: string;
    rol: UserRole;
    activo: boolean;
    creadoEn: string;
}

export interface ColaboradorMaestro {
    id: string;
    claveRegistro: string;
    nombreCompleto: string;
    mensajeEntrada?: string;
    mensajeSalida?: string;
    activo: boolean;
}

export type ProcesoEstado = 'Registrado' | 'Iniciado' | 'Pausado' | 'Finalizado';
export type TipoProceso = 'empaque' | 'otros' | 'anexos';

export interface Proceso {
    id: string;
    ordenProduccion: string;
    lote: string;
    producto: string;
    etapa: string;
    fechaExpira: string;
    fechaFabricacion: string;
    clasificacion?: TipoProceso;
    cantidadProducir: number;
    velocidadTeorica: number;
    lider: string;
    estado: ProcesoEstado;
    utilizaTemporizador: boolean;
    contabilizaSetup: boolean;
    trabajoCompletado: number;
    unidadGobernadora: string;
    horaInicioReal?: any; // Firestore Timestamp
    horaFinReal?: any; // Firestore Timestamp
    registradoPorUsuario: string;
    modificadoEn: any; // Firestore Timestamp
    pausaIniciadaEn?: any; // Firestore Timestamp
    inicioPeriodoGracia?: any; // Firestore Timestamp
    segundosRestantesPausa?: number;
    setupEstado?: 'en curso' | 'pausado' | 'finalizado' | null;
    setupTiempoAcumulado?: number;
    tiempoSetupSegundos?: number;
    setupStartTime?: any; // Firestore Timestamp
    ultimoUpdate?: any; // Firestore Timestamp
    trabajoCompletadoTeorico?: number;
    pausadoPorFaltaDePersonal?: boolean;
    visiblePara?: string[]; // IDs o Usernames de usuarios con acceso manual
    calidadEstado?: 'ninguno' | 'esperando' | 'inspeccion' | 'aprobado';
    calidadLlamadaEn?: any;
    calidadLlegadaEn?: any;
    calidadAprobadaEn?: any;
}

export interface ColaboradorLog {
    id: string;
    procesoId: string;
    colaboradorId: string;
    nombre: string;
    horaIngreso: any; // Firestore Timestamp
    horaSalida?: any; // Firestore Timestamp
    tipo: 'colaborador' | 'apoyo' | 'equipo';
    registradoPorUsuario: string;
}

export interface EventoLog {
    id: string;
    procesoId: string;
    horaEvento: any; // Firestore Timestamp
    evento: string;
    justificacion?: string;
    clasificacion: string;
    registradoPorUsuario: string;
}

export interface Justificacion {
    id: string;
    texto: string;
    tipo: 'pausa' | 'salida';
    activo: boolean;
}

export interface Etapa {
    id: string;
    codigo: string;
    nombre: string;
    activo: boolean;
    tiposProceso?: TipoProceso[];
}

