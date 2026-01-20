import fs from 'fs';

const project_id = 'temporizador-operativo';
const collection = 'maestro_colaboradores';

async function migrate() {
    const data = JSON.parse(fs.readFileSync('colaboradores_old.json', 'utf8'));
    console.log(`Leídos ${data.length} colaboradores de Supabase.`);

    for (const item of data) {
        const firestoreDoc = {
            fields: {
                nombreCompleto: { stringValue: item.nombre_completo },
                claveRegistro: { stringValue: item.clave_registro },
                activo: { booleanValue: item.activo }
            }
        };

        const docId = item.id;
        const url = `https://firestore.googleapis.com/v1/projects/${project_id}/databases/(default)/documents/${collection}?documentId=${docId}`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(firestoreDoc)
            });

            if (response.ok) {
                console.log(`✅ Migrado: ${item.nombre_completo}`);
            } else {
                const err = await response.json();
                console.error(`❌ Error migrando ${item.nombre_completo}:`, err);
            }
        } catch (e) {
            console.error(`❌ Error de red migrando ${item.nombre_completo}:`, e);
        }
    }
}

migrate();
