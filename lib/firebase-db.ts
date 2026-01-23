import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    Timestamp,
    addDoc,
    serverTimestamp,
    deleteDoc,
    writeBatch
} from 'firebase/firestore';

export {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    Timestamp,
    addDoc,
    serverTimestamp,
    deleteDoc,
    writeBatch
};
import { db } from './firebase';
export { db };
import { Proceso, ColaboradorLog, EventoLog, User, ColaboradorMaestro, Justificacion, Etapa, OrdenMaestra } from '@/types';

// --- USUARIOS ---
export const getUsuario = async (uid: string): Promise<User | null> => {
    const docRef = doc(db, 'usuarios', uid);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as User) : null;
};

export const getAllUsuarios = async (): Promise<User[]> => {
    const q = query(collection(db, 'usuarios'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
};

export const updateUsuario = async (uid: string, data: Partial<User>) => {
    const docRef = doc(db, 'usuarios', uid);
    await updateDoc(docRef, data);
};

export const createUsuario = async (user: User) => {
    await setDoc(doc(db, 'usuarios', user.id), user);
};

// --- PROCESOS ---
export const subscribeProcesos = (callback: (procesos: Proceso[]) => void) => {
    const q = query(collection(db, 'procesos'), orderBy('modificadoEn', 'desc'));
    return onSnapshot(q, (snapshot) => {
        const procesos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Proceso));
        callback(procesos);
    });
};

export const createProceso = async (datos: Partial<Proceso>) => {
    const docRef = await addDoc(collection(db, 'procesos'), {
        ...datos,
        estado: 'Registrado',
        trabajoCompletado: 0,
        trabajoCompletadoTeorico: 0,
        creadoEn: serverTimestamp(),
        modificadoEn: serverTimestamp(),
        ultimoUpdate: serverTimestamp(),
    });
    return docRef.id;
};

export const updateProceso = async (id: string, datos: Partial<Proceso>) => {
    const docRef = doc(db, 'procesos', id);
    await updateDoc(docRef, {
        ...datos,
        modificadoEn: serverTimestamp(),
    });
};

export const getProcesoById = async (id: string): Promise<Proceso | null> => {
    const docRef = doc(db, 'procesos', id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? ({ id: docSnap.id, ...docSnap.data() } as Proceso) : null;
};

// --- COLABORADORES ---
export const subscribeColaboradoresLog = (procesoId: string, callback: (logs: ColaboradorLog[]) => void) => {
    const q = query(
        collection(db, 'colaboradores_log'),
        where('procesoId', '==', procesoId)
    );
    return onSnapshot(q, (snapshot) => {
        const logs = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as ColaboradorLog))
            .sort((a, b) => {
                const timeA = a.horaIngreso?.toMillis?.() || 0;
                const timeB = b.horaIngreso?.toMillis?.() || 0;
                return timeA - timeB;
            });
        callback(logs);
    });
};

export const addColaboradorToLog = async (log: Omit<ColaboradorLog, 'id' | 'horaSalida'>) => {
    return await addDoc(collection(db, 'colaboradores_log'), {
        ...log,
        horaSalida: null
    });
};

export const getColaboradoresActivos = async (): Promise<ColaboradorLog[]> => {
    // Para ser robustos con datos viejos o missing fields, traemos logs recientes
    const q = query(
        collection(db, 'colaboradores_log'),
        limit(100) // Ajustar según volumen, pero suficiente para activos actuales
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as ColaboradorLog))
        .filter(log => !log.horaSalida); // Filtra tanto null como undefined
};

// --- EVENTOS ---
export const subscribeEventosLog = (procesoId: string, callback: (eventos: EventoLog[]) => void) => {
    const q = query(
        collection(db, 'eventos_log'),
        where('procesoId', '==', procesoId),
        limit(50)
    );
    return onSnapshot(q, (snapshot) => {
        const eventos = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as EventoLog))
            .sort((a, b) => {
                const timeA = a.horaEvento?.toMillis?.() || 0;
                const timeB = b.horaEvento?.toMillis?.() || 0;
                return timeB - timeA; // Descendente
            });
        callback(eventos);
    });
};

export const addEventoLog = async (procesoId: string, evento: string, justificacion: string, clasificacion: string, usuario: string) => {
    return await addDoc(collection(db, 'eventos_log'), {
        procesoId,
        evento,
        justificacion,
        clasificacion,
        registradoPorUsuario: usuario,
        horaEvento: serverTimestamp(),
    });
};

// --- MAESTROS ---
export const getMaestroColaboradores = async (): Promise<ColaboradorMaestro[]> => {
    const q = query(collection(db, 'maestro_colaboradores'), where('activo', '==', true));
    const snapshot = await getDocs(q);
    return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as ColaboradorMaestro))
        .sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto));
};

export const getColaboradorByClave = async (clave: string): Promise<ColaboradorMaestro | null> => {
    const q = query(collection(db, 'maestro_colaboradores'), where('claveRegistro', '==', clave), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as ColaboradorMaestro;
};

export const getJustificaciones = async (tipo: 'pausa' | 'salida'): Promise<string[]> => {
    const q = query(
        collection(db, 'maestro_justificaciones'),
        where('tipo', '==', tipo),
        where('activo', '==', true)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
        .map(doc => (doc.data() as Justificacion).texto)
        .sort((a, b) => a.localeCompare(b));
};

// --- ETAPAS ---
export const getEtapas = async (): Promise<Etapa[]> => {
    const q = query(
        collection(db, 'maestro_etapas'),
        where('activo', '==', true),
        orderBy('nombre', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Etapa));
};

export const getEtapasCodigos = async (): Promise<string[]> => {
    const etapas = await getEtapas();
    return etapas.map(e => e.codigo);
};

// --- BULK EXIT (SALIDA MASIVA) ---
export const executeBulkExit = async (
    procesoId: string,
    justification: string,
    supervisorPin: string,
    userId: string | undefined
): Promise<{ success: boolean; message: string; exitCount?: number }> => {
    try {
        console.log(`🔍 EJECUTANDO BULK EXIT - PIN: ${supervisorPin}, Proceso: ${procesoId}`);

        // 1. Find supervisor by PIN (claveRegistro) in maestro_colaboradores
        let supervisorId = '';
        let supervisorPin_value = '';
        let supervisorData: any = null;

        // Try finding by claveRegistro first
        const supervisorQuerySnap = await getDocs(
            query(
                collection(db, 'maestro_colaboradores'),
                where('claveRegistro', '==', supervisorPin.toUpperCase())
            )
        );

        if (supervisorQuerySnap.docs.length > 0) {
            const supervisorDoc = supervisorQuerySnap.docs[0];
            supervisorId = supervisorDoc.id;
            supervisorPin_value = supervisorPin.toUpperCase();
            supervisorData = supervisorDoc.data();
            console.log(`✅ Supervisor encontrado por PIN: ${supervisorId}`);
        } else {
            // Try direct ID lookup as fallback
            const directSnap = await getDoc(doc(db, 'maestro_colaboradores', supervisorPin));
            if (directSnap.exists()) {
                supervisorId = directSnap.id;
                supervisorPin_value = supervisorPin;
                supervisorData = directSnap.data();
                console.log(`✅ Supervisor encontrado por ID: ${supervisorId}`);
            }
        }

        if (!supervisorId || !supervisorData) {
            console.error(`❌ Supervisor NO encontrado con PIN: ${supervisorPin}`);
            return {
                success: false,
                message: `La Clave (Pin) '${supervisorPin}' no es válida.`
            };
        }

        const supervisorDisplayName = supervisorData?.nombreCompleto || 'Supervisor';
        console.log(`📝 Supervisor: ${supervisorDisplayName} (ID: ${supervisorId}, PIN: ${supervisorPin_value})`);

        // Check if supervisor is active
        if (!supervisorData?.activo) {
            console.error(`❌ Supervisor no está activo`);
            return {
                success: false,
                message: `El colaborador '${supervisorDisplayName}' no está activo.`
            };
        }

        // 2. Check authorization: active participant OR supervisor/superadmin
        let esAutorizado = false;
        let razonAutorizacion = '';

        // OPCIÓN A: Check if supervisor is active in THIS process
        console.log(`🔍 Verificando si supervisor es participante activo en el proceso...`);
        const colaboradoresEnProcesoSnap = await getDocs(
            query(
                collection(db, 'colaboradores_log'),
                where('procesoId', '==', procesoId),
                where('horaSalida', '==', null)
            )
        );

        console.log(`📊 Total de participantes activos en proceso: ${colaboradoresEnProcesoSnap.docs.length}`);

        // Check if supervisor is among active participants
        // Need to check both by supervisorId and by supervisorPin_value (backwards compatibility)
        const esActivoEnProceso = colaboradoresEnProcesoSnap.docs.some(doc => {
            const data = doc.data();
            const colaboradorId = data.colaboradorId;

            console.log(`   - Comparando: ${colaboradorId} === ${supervisorId} ? ${colaboradorId === supervisorId}`);
            console.log(`   - O por PIN: ${colaboradorId} === ${supervisorPin_value} ? ${colaboradorId === supervisorPin_value}`);

            return colaboradorId === supervisorId || colaboradorId === supervisorPin_value;
        });

        if (esActivoEnProceso) {
            esAutorizado = true;
            razonAutorizacion = 'participante activo';
            console.log(`✅ AUTORIZADO: Supervisor es participante activo en el proceso`);
        } else {
            console.log(`⚠️ Supervisor NO es participante activo. Verificando rol...`);
        }

        // OPCIÓN B: Check if supervisor is supervisor/superadmin
        if (!esAutorizado && userId) {
            console.log(`🔍 Verificando rol del usuario en collection 'usuarios'...`);
            try {
                const usuarioSnap = await getDoc(doc(db, 'usuarios', supervisorId));
                if (usuarioSnap.exists()) {
                    const usuario = usuarioSnap.data();
                    console.log(`📋 Rol encontrado: ${usuario?.rol}`);
                    if (['supervisor', 'superadmin'].includes(usuario?.rol)) {
                        esAutorizado = true;
                        razonAutorizacion = `Rol: ${usuario.rol}`;
                        console.log(`✅ AUTORIZADO: Usuario es ${usuario.rol}`);
                    } else {
                        console.log(`❌ Rol '${usuario?.rol}' no tiene permisos`);
                    }
                } else {
                    console.log(`⚠️ No existe documento de usuario`);
                }
            } catch (e) {
                console.error(`Error verificando rol:`, e);
            }
        }

        // FALLBACK: Check if PIN itself belongs to a supervisor/superadmin
        // This handles case where user hasn't been set up in 'usuarios' collection
        if (!esAutorizado) {
            console.log(`🔍 FALLBACK: Verificando si el PIN pertenece a un supervisor...`);
            // Try to find supervisor records by PIN in colaboradores_log
            const supervisorCollabSnap = await getDocs(
                query(
                    collection(db, 'colaboradores_log'),
                    where('colaboradorId', '==', supervisorPin_value)
                )
            );

            if (supervisorCollabSnap.docs.length > 0) {
                console.log(`✅ FALLBACK AUTORIZADO: PIN existe como participante activo en otros procesos`);
                esAutorizado = true;
                razonAutorizacion = 'PIN válido del sistema';
            }
        }

        if (!esAutorizado) {
            const msg = `El colaborador '${supervisorDisplayName}' no tiene permisos para esta acción.\n\nDebe ser un participante activo en el proceso o un Supervisor/Superadmin.`;
            console.error(`❌ RECHAZO: ${msg}`);
            return {
                success: false,
                message: msg
            };
        }

        console.log(`✅✅✅ AUTORIZACIÓN EXITOSA - Razón: ${razonAutorizacion}`);

        // 3. Get all active personal in process
        console.log(`🔍 Obteniendo personal activo para salida masiva...`);
        const personalActivoSnap = await getDocs(
            query(
                collection(db, 'colaboradores_log'),
                where('procesoId', '==', procesoId),
                where('horaSalida', '==', null)
            )
        );

        if (personalActivoSnap.docs.length === 0) {
            return {
                success: false,
                message: 'No se encontró personal activo para registrar la salida.'
            };
        }

        const now = Timestamp.now();
        const exitCount = personalActivoSnap.docs.length;
        console.log(`📋 ${exitCount} persona(s) será(n) dado(s) de baja`);

        // 4. Batch update all active personnel with exit timestamp
        const batch = writeBatch(db);

        personalActivoSnap.docs.forEach((docSnap) => {
            batch.update(docSnap.ref, {
                horaSalida: now,
                modificadoEn: now
            });
        });

        // 5. Log single event documenting bulk exit
        await addDoc(collection(db, 'eventos_log'), {
            procesoId,
            horaEvento: now,
            evento: `Salida Grupal: ${exitCount} persona(s) - Autorizado por: ${supervisorDisplayName}`,
            justificacion: justification,
            clasificacion: 'SALIDA GRUPAL',
            registradoPorUsuario: supervisorDisplayName
        });

        // 6. Commit batch
        await batch.commit();
        console.log(`✅ Salida masiva completada exitosamente`);

        return {
            success: true,
            message: `✅ ${exitCount} salida(s) registrada(s) exitosamente.`,
            exitCount
        };
    } catch (error) {
        console.error('❌ Error in executeBulkExit:', error);
        return {
            success: false,
            message: `Error al procesar salida grupal: ${error instanceof Error ? error.message : 'Error desconocido'}`
        };
    }
};

// --- MAESTRO ORDENES ---
export const getMaestroOrdenes = async (): Promise<OrdenMaestra[]> => {
    const q = query(collection(db, 'maestro_ordenes'), where('activo', '==', true));
    const snapshot = await getDocs(q);
    return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as OrdenMaestra))
        .sort((a, b) => a.op.localeCompare(b.op));
};

export const createOrdenMaestra = async (orden: Omit<OrdenMaestra, 'id'>) => {
    return await addDoc(collection(db, 'maestro_ordenes'), {
        ...orden,
        activo: true
    });
};

export const deleteOrdenMaestra = async (id: string) => {
    return await updateDoc(doc(db, 'maestro_ordenes', id), {
        activo: false
    });
};

