import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, writeBatch, query, where, doc } from 'firebase/firestore';

export async function POST() {
    const appId = process.env.APPSHEET_APP_ID;
    const accessKey = process.env.APPSHEET_ACCESS_KEY;
    const tableName = process.env.APPSHEET_TABLE_NAME;

    if (!appId || !accessKey || !tableName) {
        return NextResponse.json({ error: 'Configuración de AppSheet incompleta en .env.local' }, { status: 500 });
    }

    try {
        const url = `https://api.appsheet.com/api/v2/apps/${appId}/tables/${encodeURIComponent(tableName)}/Action`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'ApplicationAccessKey': accessKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                Action: 'Find',
                Properties: {
                    Locale: 'en-US',
                    Timezone: 'UTC'
                },
                Rows: []
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('AppSheet API Error:', errorText);
            return NextResponse.json({ error: `Error de AppSheet: ${response.statusText}`, details: errorText }, { status: response.status });
        }

        const appSheetData = await response.json();

        if (!Array.isArray(appSheetData)) {
            return NextResponse.json({ error: 'La respuesta de AppSheet no es un array de datos' }, { status: 500 });
        }

        // 1. Obtener órdenes actuales en Firebase para evitar duplicados por OP
        const ordersSnapshot = await getDocs(collection(db, 'maestro_ordenes'));
        const existingOPs = new Set(ordersSnapshot.docs.map(doc => doc.data().op));

        const batch = writeBatch(db);
        let importedCount = 0;
        let alreadyExistsCount = 0;
        let oldYearCount = 0;

        // 2. Mapear y preparar batch
        appSheetData.forEach((row: any) => {
            const op = String(row['ORDEN PRODUCCION'] || '').trim();
            if (!op) return; // Ignorar filas sin OP

            // Limpiar el valor del año por si viene con comas, espacios o formato de texto
            const anioRaw = String(row['AÑO'] || '0').replace(/[^0-9]/g, '');
            const anio = parseInt(anioRaw, 10);

            // Filtro de año: Omitir solo si es estrictamente menor a 2026
            if (anio < 2026) {
                oldYearCount++;
                return;
            }

            // Filtro de duplicados
            if (existingOPs.has(op)) {
                alreadyExistsCount++;
                return;
            }

            // Importación de nueva orden
            const newOrderRef = doc(collection(db, 'maestro_ordenes'));
            batch.set(newOrderRef, {
                op: op,
                producto: String(row['DESCRIPCION'] || '').toUpperCase(),
                lote: String(row['LOTE'] || '').toUpperCase(),
                etapa: '',
                cantidad: Number(row['CANT TEORICA']) || 0,
                velocidadTeorica: 0,
                activo: true,
                importadoDeAppSheet: true,
                fechaSincro: new Date().toISOString()
            });
            importedCount++;
            existingOPs.add(op);
        });

        if (importedCount > 0) {
            await batch.commit();
        }

        return NextResponse.json({
            success: true,
            totalFound: appSheetData.length,
            imported: importedCount,
            alreadyExists: alreadyExistsCount,
            oldYears: oldYearCount
        });

    } catch (error: any) {
        console.error('Sync Error:', error);
        return NextResponse.json({ error: 'Error interno al sincronizar', message: error.message }, { status: 500 });
    }
}
