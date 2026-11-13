# SafeGuardian (RoadGuardian AI)

Sistema de monitoreo de conductores que detecta señales de **fatiga y somnolencia** a partir de fotos o videos cortos tomados durante un recorrido. Cuando el riesgo es alto, avisa al supervisor por Telegram y correo, y deja todo registrado para auditoría.

Proyecto desarrollado en un hackatón.

## Cómo funciona

```
Webapp (cámara) ──► Webhook n8n ──► Validación, duplicados y rate limiting
                                          │
                                   Motor de riesgo
                                          │
                     ┌────────────────────┴────────────────────┐
              Riesgo > 70                                  Riesgo normal
   Telegram + Gmail al supervisor                    Registro en Google Sheets
   + registro del incidente crítico
                                          │
                           Log de auditoría y respuesta a la webapp
```

1. El operador inicia un recorrido, elige conductor y ruta, y captura evidencia con la cámara del navegador (WebRTC).
2. La webapp envía la foto o el video al webhook de n8n.
3. El workflow valida la entrada, descarta duplicados, aplica rate limiting y calcula un puntaje de riesgo.
4. Si el riesgo supera 70, notifica al supervisor por Telegram y Gmail y registra el incidente crítico. Si no, registra el evento normal.
5. Cualquier error del flujo se notifica por Telegram y correo, y queda en un log.

Además, `detector.py` es un microservicio en **FastAPI** que usa **MediaPipe Face Mesh** para calcular el *Eye Aspect Ratio* (EAR) y detectar ojos cerrados en una imagen.

## Tecnologías

- **Frontend:** HTML, Tailwind CSS, JavaScript, WebRTC (cámara), Lucide Icons
- **Automatización:** n8n (22 nodos: validación, motor de riesgo, manejo de errores)
- **Visión por computador:** Python, FastAPI, OpenCV, MediaPipe
- **Integraciones:** Telegram Bot API, Gmail, Google Sheets

## Estructura

```
index.html                     Webapp de operaciones
script.js                      Lógica de la webapp (cámara, envío y resumen del recorrido)
styles.css                     Estilos adicionales
detector.py                    API de detección de fatiga (FastAPI + MediaPipe)
requirements.txt               Dependencias de Python
n8n/safeguardian-workflow.json Workflow de n8n para importar
```

## Cómo ejecutarlo

**Webapp:** abre `index.html` con Live Server (o cualquier servidor estático). Para que analice evidencias necesita el webhook de n8n activo (ver abajo).

**Detector de fatiga:**

```bash
python -m venv .venv
source .venv/bin/activate        # En Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn detector:app --reload
```

La API queda en `http://localhost:8000/analyze` (recibe una imagen en el campo `file`).

**Workflow de n8n:**

1. Importa `n8n/safeguardian-workflow.json` en tu n8n.
2. Configura las credenciales de Telegram, Gmail y Google Sheets.
3. Reemplaza `TU_GOOGLE_SHEET_ID`, `TU_CHAT_ID_DE_TELEGRAM` y `correo-del-supervisor@ejemplo.com` por tus datos.
4. Activa el workflow y pon la URL del webhook en `script.js` (constante del `fetch`).

## Autor

Jonatan David Sarmiento Sierra — [GitHub](https://github.com/Jonatan-17) · [LinkedIn](https://www.linkedin.com/in/jonatan-sarmiento-16a206366/)
