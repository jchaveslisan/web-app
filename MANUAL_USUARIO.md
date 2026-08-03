# Manual de Usuario Extendido: Temporizador Operativo Web

Este documento es la guía oficial definitiva para el uso del sistema de control de producción. Contiene detalles técnicos, lógicos y operativos para asegurar el correcto registro de la productividad.

---

## 1. Conceptos Fundamentales
Antes de operar el sistema, es vital comprender estos términos:
*   **Velocidad Teórica:** Es la cantidad de unidades que un (1) colaborador puede producir en un minuto bajo condiciones estándar.
*   **Velocidad del Equipo:** Es la sumatoria de las velocidades teóricas de todos los "Colaboradores" activos en la línea.
*   **Periodo de Gracia:** Son 15 minutos adicionales que el sistema otorga automáticamente al finalizar el trabajo teórico para actividades de limpieza o cierre.
*   **Unidades Calculadas:** Es el progreso teórico que el sistema muestra segundo a segundo basándose en el personal activo.

---

## 2. Gestión de Procesos (Panel Principal)

### Estados de un Proceso
Los procesos se agrupan visualmente por su estado actual:
*   🔵 **Registrado:** La orden ha sido creada pero no se ha iniciado el Setup ni la Producción.
*   🟢 **Iniciado:** El proceso tiene el temporizador corriendo o hay personal trabajando.
*   🟡 **Pausado:** La operación se detuvo por un motivo justificado. El tiempo no corre.
*   ⚪ **Finalizado:** La orden se completó. No permite más registros ni cambios.

### Pestañas de Clasificación
*   **EMPAQUE:** Procesos estándar que requieren temporizador de línea y cálculo de eficiencia.
*   **OTROS PROCESOS:** Procesos que requieren registro de OP y personal, pero cuyo tiempo de finalización no es crítico.
*   **ANEXOS:** Tareas de soporte (limpieza, preparación de área) que solo registran personal y producto, sin OP.
*   **PERSONAL:** Monitor global que muestra el estado de todos los colaboradores de la planta, indicando en qué línea están trabajando o si están disponibles.

---

## 3. Registro de un Nuevo Proceso (Paso a Paso)

### 3.1 Selección del Tipo
Al hacer clic en **+ NUEVO PROCESO**, debe elegir la categoría correcta. Esta elección es irreversible para esa orden:
1.  **Empaque:** Activa el temporizador gigante y métricas de OEE.
2.  **Otros:** Registra datos de producción pero el tiempo es informativo.
3.  **Anexos:** Solo pide el nombre de la tarea.

### 3.2 Completar el Formulario (Modo Detallado)
1.  **Buscador Inteligente:** Escriba la OP en el buscador superior. El sistema consultará el "Maestro de Órdenes" y autocompletará: *Producto, Lote, Etapa, Cantidad Sugerida y Velocidad Estándar*.
2.  **Campos Manuales:**
    *   **Líder de Proceso:** Debe seleccionar a la persona responsable de la línea en ese turno.
    *   **Línea:** Seleccione si el producto es para consumo "Humano" o "Veterinario" (esto afecta los reportes finales).
    *   **Fechas de Fabricación/Expira:** Ingrese en formato MM/AAAA. El sistema validará que tengan el formato correcto.
3.  **Opciones de Control:**
    *   **Utilizar Temporizador:** Si se desmarca, no habrá cuenta regresiva.
    *   **Contabilizar Setup:** Si se marca, el proceso iniciará obligatoriamente en fase de preparación.

---

## 4. El Monitor de Línea (Control Total)

### 4.1 La Lógica del Cronómetro Gigante
El reloj central cambia de color según la situación de la línea:
*   **Blanco:** Producción normal dentro del tiempo estimado.
*   **Amarillo:** El tiempo teórico terminó y ha iniciado el **Periodo de Gracia (15 min)**.
*   **Rojo Parpadeante:** Se ha agotado el tiempo de gracia. La línea está en **Tiempo Extra**.
*   **"PERSONAL REQUERIDO":** El reloj mostrará este mensaje si la producción está "Iniciada" pero no hay colaboradores registrados en la línea. El tiempo no puede calcularse sin personal.

### 4.2 Control de Setup (Fase Naranja)
El Setup es el tiempo de alistamiento de máquinas y materiales:
1.  Haga clic en **INICIAR SETUP**.
2.  Si falta un material o hay una interrupción, use **PAUSAR SETUP**.
3.  Al hacer clic en **FINALIZAR SETUP**, el sistema:
    *   Guarda el tiempo total de preparación.
    *   Limpia la lista de personal (hace salida automática).
    *   Habilita los controles de producción.

### 4.3 Control de Producción (Fase Verde)
1.  **Iniciar:** El botón verde activa la lógica de productividad.
2.  **Pausar:** Al presionar pausa, **es obligatorio** seleccionar una justificación:
    *   *Almuerzo/Cena:* Tiempo de descanso programado.
    *   *Falla Mecánica:* Problemas con maquinaria.
    *   *Falta de Personal/Material:* Interrupciones de flujo.
    *   *Reproceso:* Si la pausa es para corregir errores del lote.

---

## 5. Gestión de Personal (Ingresos y Salidas)

### 5.1 Registro de Ingreso
Para que el tiempo corra correctamente, debe registrar al personal:
1.  Ubique el campo de texto blanco en la parte inferior.
2.  Escriba o escanee el código del colaborador.
3.  **Importante:** Seleccione si ingresa como **"Colaborador"** o **"Apoyo"**.
    *   **Colaborador:** Suma velocidad a la línea (acelera el reloj).
    *   **Apoyo:** Registra la presencia del trabajador pero **no afecta la velocidad** (ej. entrenadores, supervisores observando, personal de limpieza).

### 5.2 Notificaciones Visuales de Personal
Al registrar un ID, aparecerá una ventana gigante de 4 segundos con un color:
*   **Verde:** Ingreso exitoso.
*   **Rojo:** El colaborador ya está en otra línea o el código no existe.
*   **Amarillo:** Se ha registrado la salida del colaborador.

---

## 6. Aseguramiento de Calidad

### Secuencia Obligatoria de Calidad
El sistema mide cuánto tiempo tarda Calidad en responder y cuánto en inspeccionar:
1.  **Llamada:** Presione el botón morado **CALIDAD**. El reloj de calidad inicia en modo "Espera".
2.  **Llegada:** Cuando el inspector llegue, abra la ventana de calidad y presione **INICIO CALIDAD**. El reloj cambia a modo "Inspección".
3.  **Aprobación:** Una vez dada la aprobación, presione **APROBACIÓN DE CALIDAD**. Esto libera la línea y registra los tiempos de respuesta.

---

## 7. Ajustes y Auditoría (Supervisores)

### 7.1 Historial de Eventos
Haga clic en el botón de **Historial** para ver la "Caja Negra" del proceso. Cada acción queda grabada con:
*   Hora exacta del evento.
*   Usuario que realizó la acción.
*   Justificación o motivo ingresado.
*   Cambios de estado.

### 7.2 Ajuste Manual de Unidades
Si el contador teórico no coincide con el físico (ej. por unidades defectuosas no contabilizadas):
1.  Use los botones de **Ajuste Manual** (+10, +100, -5, etc.).
2.  Esto resincroniza el "Trabajo Completado" y ajusta el tiempo restante inmediatamente.

### 7.3 Edición de Proceso
Si se cometió un error al registrar la cantidad total o la velocidad:
1.  Presione el icono del **Lápiz**.
2.  Modifique los valores necesarios.
3.  El sistema recalculará toda la proyección del proceso basándose en los nuevos datos.

---

## 8. Finalización del Proceso
**¡Atención!** Finalizar un proceso es una acción permanente:
1.  Presione el botón rojo **TERMINAR**.
2.  Confirme en la ventana de advertencia.
3.  El sistema cerrará automáticamente las sesiones de todos los colaboradores activos para asegurar que no queden "colgados" en el sistema.
4.  La orden pasará al archivo histórico para su posterior reporte.
