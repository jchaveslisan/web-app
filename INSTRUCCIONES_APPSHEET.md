# 📋 INSTRUCCIONES PARA REPLICAR LA CONEXIÓN CON APPSHEET

## ❌ ERROR ACTUAL EN LA OTRA PLATAFORMA
```
403 Forbidden - The ApplicationAccessKey in the HTTP header did not match any of the valid ApplicationAccessKeys for the called application.
```

---

## ✅ CONFIGURACIÓN QUE **SÍ FUNCIONA** (Esta Plataforma)

### 1️⃣ ARCHIVO `.env.local` (Variables de Entorno)

Crear o actualizar el archivo `.env.local` en la raíz del proyecto con estas variables:

```env
# APPSHEET INTEGRATION
APPSHEET_APP_ID=CUMPLIMIENTOPROGRAMA-3632696
APPSHEET_ACCESS_KEY=V2-hzhey-qI2mu-WpNFK-XIjgT-7MSDe-4qCKb-4zbv6-9vPvN
APPSHEET_TABLE_NAME=PLANIFICACION
```

**⚠️ IMPORTANTE:**
- Estas variables **NO** deben tener el prefijo `NEXT_PUBLIC_` (son variables del servidor)
- El nombre debe ser **exactamente** como se muestra arriba
- No debe haber espacios antes o después del `=`

---

### 2️⃣ ESTRUCTURA DE LA API ROUTE

Crear el archivo: `app/api/appsheet/sync/route.ts`

**Estructura de carpetas:**
```
app/
  api/
    appsheet/
      sync/
        route.ts
```

---

### 3️⃣ CÓDIGO COMPLETO DE LA API ROUTE

```typescript
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

        // Aquí va tu lógica de procesamiento de datos
        // Este ejemplo es de esta plataforma, ajusta según tus necesidades

        return NextResponse.json({
            success: true,
            totalFound: appSheetData.length,
            data: appSheetData
        });

    } catch (error: any) {
        console.error('Sync Error:', error);
        return NextResponse.json({ error: 'Error interno al sincronizar', message: error.message }, { status: 500 });
    }
}
```

---

## 🔑 PUNTOS CRÍTICOS PARA QUE FUNCIONE

### ✅ 1. URL de la API
```typescript
const url = `https://api.appsheet.com/api/v2/apps/${appId}/tables/${encodeURIComponent(tableName)}/Action`;
```

### ✅ 2. Headers (EXACTAMENTE así)
```typescript
headers: {
    'ApplicationAccessKey': accessKey,  // ← Nombre exacto del header
    'Content-Type': 'application/json'
}
```

**⚠️ CRÍTICO:** El header debe llamarse **`ApplicationAccessKey`** (no `Authorization`, no `X-API-Key`, no otro nombre)

### ✅ 3. Body del Request
```typescript
body: JSON.stringify({
    Action: 'Find',
    Properties: {
        Locale: 'en-US',
        Timezone: 'UTC'
    },
    Rows: []
})
```

---

## 🚀 CÓMO LLAMAR A LA API DESDE EL FRONTEND

```typescript
const handleSyncAppSheet = async () => {
    try {
        const response = await fetch('/api/appsheet/sync', { method: 'POST' });
        
        if (!response.ok) {
            throw new Error('Error en la sincronización');
        }
        
        const result = await response.json();
        console.log('Sincronización exitosa:', result);
        
    } catch (error) {
        console.error('Error:', error);
    }
};
```

---

## 🔍 VERIFICACIÓN PASO A PASO

### 1. Verificar que las variables de entorno se lean correctamente
Agregar este console.log temporal en `route.ts`:

```typescript
export async function POST() {
    const appId = process.env.APPSHEET_APP_ID;
    const accessKey = process.env.APPSHEET_ACCESS_KEY;
    const tableName = process.env.APPSHEET_TABLE_NAME;

    console.log('🔍 Verificando variables:');
    console.log('AppId:', appId ? '✅ Definido' : '❌ NO definido');
    console.log('AccessKey:', accessKey ? '✅ Definido' : '❌ NO definido');
    console.log('TableName:', tableName ? '✅ Definido' : '❌ NO definido');
    
    // ... resto del código
}
```

### 2. Reiniciar el servidor de desarrollo
Después de modificar `.env.local`, **SIEMPRE** reiniciar:

```bash
# Detener el servidor (Ctrl+C)
# Luego volver a iniciar:
npm run dev
```

### 3. Verificar la respuesta de AppSheet
Si el error persiste, agregar más logs:

```typescript
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

console.log('📡 Status:', response.status);
console.log('📡 Status Text:', response.statusText);

if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Error completo:', errorText);
    // ...
}
```

---

## 📝 CHECKLIST DE IMPLEMENTACIÓN

- [ ] Crear archivo `.env.local` con las 3 variables (sin `NEXT_PUBLIC_`)
- [ ] Crear carpeta `app/api/appsheet/sync/`
- [ ] Crear archivo `route.ts` con el código exacto
- [ ] Verificar que el header sea `ApplicationAccessKey` (no otro nombre)
- [ ] Reiniciar el servidor de desarrollo (`npm run dev`)
- [ ] Probar la sincronización
- [ ] Verificar los logs en la consola del servidor

---

## 🆘 SI AÚN DA ERROR 403

1. **Verificar que la clave de acceso sea la correcta** en AppSheet
2. **Verificar que el App ID sea el correcto** en AppSheet
3. **Verificar que la tabla exista** con ese nombre exacto
4. **Verificar que la clave de acceso esté activa** en AppSheet (no haya sido revocada)
5. **Verificar que no haya espacios** en las variables del `.env.local`

---

## 📞 INFORMACIÓN DE CONTACTO CON APPSHEET

- **URL Base:** `https://api.appsheet.com/api/v2/apps/`
- **Método:** `POST`
- **Header de autenticación:** `ApplicationAccessKey`
- **Formato del body:** JSON con estructura `{ Action, Properties, Rows }`

---

**✨ Esta configuración está probada y funcionando en esta plataforma (TEMPORIZADOR OPERATIVO)**
