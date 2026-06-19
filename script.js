document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    
    // Estado Global
    let currentMediaBlob = null;
    let mediaType = null; // 'image' o 'video'
    let tripEvents = [];
    let stream = null;

    // Referencias DOM
    const phases = {
        register: document.getElementById('phase-register'),
        monitor: document.getElementById('phase-monitor'),
        report: document.getElementById('phase-report')
    };

    // 1. INICIAR RECORRIDO
    document.getElementById('driver-form').addEventListener('submit', (e) => {
        e.preventDefault();
        switchPhase('monitor');
        updateStatus('EN RUTA', '#22C55E');
        
        document.getElementById('monitor-driver-name').textContent = 
            `${document.getElementById('d-name').value} (${document.getElementById('d-id').value})`;
    });

    // 2. GESTIÓN DE CÁMARA WEBRTC
    window.toggleCamera = async () => {
        const video = document.getElementById('webcam-feed');
        const preview = document.getElementById('preview-media');
        const placeholder = document.getElementById('upload-placeholder');
        
        if (stream) {
            // Apagar cámara
            stream.getTracks().forEach(t => t.stop());
            stream = null;
            video.classList.add('hidden');
            placeholder.classList.remove('hidden');
            resetSelection();
        } else {
            // Encender cámara
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: true });
                video.srcObject = stream;
                video.classList.remove('hidden');
                preview.classList.add('hidden');
                placeholder.classList.add('hidden');
                
                // Capturar frame actual como evidencia
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                canvas.getContext('2d').drawImage(video, 0, 0);
                canvas.toBlob(blob => {
                    currentMediaBlob = blob;
                    mediaType = 'image';
                    enableAnalyzeBtn();
                }, 'image/jpeg', 0.8);
            } catch (err) {
                alert("Error accediendo a webcam");
            }
        }
    };

    // 3. VALIDACIÓN Y CARGA DE ARCHIVOS (MAX 5s VIDEO)
    window.handleFileUpload = (input) => {
        const file = input.files[0];
        if (!file) return;

        const preview = document.getElementById('preview-media');
        const video = document.getElementById('webcam-feed');
        const placeholder = document.getElementById('upload-placeholder');

        video.classList.add('hidden');
        if(stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
        
        preview.classList.remove('hidden');
        placeholder.classList.add('hidden');

        if (file.type.startsWith('video/')) {
            // Validar duración máxima 5s
            const tempVideo = document.createElement('video');
            tempVideo.preload = 'metadata';
            tempVideo.onloadedmetadata = () => {
                if (tempVideo.duration > 5) {
                    alert("El video no puede superar los 5 segundos.");
                    resetSelection();
                    return;
                }
                currentMediaBlob = file;
                mediaType = 'video';
                preview.src = URL.createObjectURL(file);
                enableAnalyzeBtn();
            };
            tempVideo.src = URL.createObjectURL(file);
        } else {
            currentMediaBlob = file;
            mediaType = 'image';
            preview.src = URL.createObjectURL(file);
            enableAnalyzeBtn();
        }
    };

    function resetSelection() {
        currentMediaBlob = null;
        mediaType = null;
        document.getElementById('preview-media').classList.add('hidden');
        document.getElementById('upload-placeholder').classList.remove('hidden');
        disableAnalyzeBtn();
    }

    function enableAnalyzeBtn() {
        const btn = document.getElementById('btn-analyze');
        btn.disabled = false;
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
    }

    function disableAnalyzeBtn() {
        const btn = document.getElementById('btn-analyze');
        btn.disabled = true;
        btn.classList.add('opacity-50', 'cursor-not-allowed');
    }

    // 4. ENVÍO A N8N / PYTHON API
    window.sendToN8n = async () => {
        if (!currentMediaBlob) return;
        
        const btn = document.getElementById('btn-analyze');
        btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin inline mr-2"></i> Procesando...`;
        lucide.createIcons();

        // Construir FormData para enviar archivo + metadatos
        const formData = new FormData();
        formData.append('media', currentMediaBlob, `evidence_${Date.now()}.${mediaType === 'video' ? 'mp4' : 'jpg'}`);
        formData.append('driver_id', document.getElementById('d-id').value);
        formData.append('route', document.getElementById('d-route').value);
        formData.append('timestamp', new Date().toISOString());

        try {
            // NOTA PARA HACKATHON: Reemplaza esta URL con tu endpoint real de n8n o Python
            // Ejemplo n8n: 'https://tu-n8n.duckdns.org/webhook/roadguardian'
            // Ejemplo Python: 'http://localhost:8000/analyze'
            const response = await fetch('https://n8n-webhook-url-placeholder/webhook/analyze', {
                method: 'POST',
                body: formData
            });

            // Simulación de respuesta si no hay backend real conectado aún
            const result = response.ok ? await response.json() : mockN8nResponse();
            
            logEvent(result);
            addLogToUI(`✅ ${result.status || 'Analizado'} | Riesgo: ${result.risk_level || 'Bajo'}`, 'success');
            
        } catch (error) {
            console.error(error);
            addLogToUI('❌ Error de conexión con n8n/API', 'error');
        } finally {
            btn.innerHTML = `<i data-lucide="send" class="w-4 h-4 inline mr-2"></i> Enviar a Análisis n8n`;
            lucide.createIcons();
            resetSelection();
        }
    };

    // Mock para demostración sin backend activo
    function mockN8nResponse() {
        const risks = ['BAJO', 'MEDIO', 'ALTO'];
        return {
            status: 'PROCESADO',
            risk_level: risks[Math.floor(Math.random() * risks.length)],
            detection: Math.random() > 0.7 ? 'Fatiga Detectada' : 'Conducción Normal',
            timestamp: new Date().toLocaleTimeString()
        };
    }

    function logEvent(data) {
        tripEvents.push(data);
    }

    function addLogToUI(msg, type) {
        const container = document.getElementById('n8n-logs');
        const div = document.createElement('div');
        div.className = type === 'error' ? 'text-red-600' : 'text-emerald-700';
        div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
        container.prepend(div);
    }

    // 5. FINALIZAR Y REPORTE
    window.finishTrip = () => {
        switchPhase('report');
        updateStatus('FINALIZADO', '#64748b');
        
        document.getElementById('report-total').textContent = tripEvents.length;
        
        const tbody = document.getElementById('report-table-body');
        tbody.innerHTML = tripEvents.map(e => `
            <tr class="border-b border-slate-100 last:border-0">
                <td class="py-2">${e.timestamp || '--:--'}</td>
                <td class="py-2">${e.detection || 'Análisis Visual'}</td>
                <td class="py-2 text-right font-bold ${e.risk_level === 'ALTO' ? 'text-red-600' : 'text-emerald-600'}">${e.risk_level || 'OK'}</td>
            </tr>
        `).join('');

        const avgRisk = tripEvents.some(e => e.risk_level === 'ALTO') ? 'ALTO' : 
                       tripEvents.some(e => e.risk_level === 'MEDIO') ? 'MEDIO' : 'BAJO';
        document.getElementById('report-risk').textContent = avgRisk;
        document.getElementById('report-risk').className = `text-2xl font-bold ${avgRisk === 'ALTO' ? 'text-red-600' : 'text-emerald-600'}`;
    };

    // Utilidades UI
    function switchPhase(phaseName) {
        Object.values(phases).forEach(p => {
            p.classList.remove('active-section');
            p.classList.add('hidden-section');
        });
        phases[phaseName].classList.remove('hidden-section');
        phases[phaseName].classList.add('active-section');
    }

    function updateStatus(text, color) {
        document.getElementById('status-text').textContent = text;
        document.getElementById('status-dot').style.backgroundColor = color;
    }
});