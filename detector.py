import cv2
import numpy as np
import mediapipe as mp
from fastapi import FastAPI, UploadFile, File
from pydantic import BaseModel

app = FastAPI()

# Inicialización de MediaPipe Face Mesh
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(static_image_mode=False, max_num_faces=1, min_detection_confidence=0.5)

# Puntos clave de los ojos en Face Mesh (Landmarks)
LEFT_EYE = [362, 385, 387, 263, 373, 380]
RIGHT_EYE = [33, 160, 158, 133, 153, 144]

def calculate_ear(landmarks, eye_indices):
    """Calcula el Eye Aspect Ratio"""
    points = [landmarks[idx] for idx in eye_indices]
    # Distancia vertical (párpados)
    vertical_1 = np.linalg.norm(np.array(points[1]) - np.array(points[5]))
    vertical_2 = np.linalg.norm(np.array(points[2]) - np.array(points[4]))
    # Distancia horizontal (comisuras)
    horizontal = np.linalg.norm(np.array(points[0]) - np.array(points[3]))
    
    if horizontal == 0: return 0
    return (vertical_1 + vertical_2) / (2.0 * horizontal)

@app.post("/analyze")
async def analyze_driver(file: UploadFile = File(...)):
    """Endpoint principal según RoadGuardian AI Plan"""
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    image_np = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    rgb_image = cv2.cvtColor(image_np, cv2.COLOR_BGR2RGB)
    results = face_mesh.process(rgb_image)
    
    fatigue_detected = False
    risk_score = 0
    ear_value = 0
    
    if results.multi_face_landmarks:
        for landmarks in results.multi_face_landmarks:
            h, w, _ = image_np.shape
            lm_list = [(int(l.x * w), int(l.y * h)) for l in landmarks.landmark]
            
            ear_left = calculate_ear(lm_list, LEFT_EYE)
            ear_right = calculate_ear(lm_list, RIGHT_EYE)
            ear_value = (ear_left + ear_right) / 2.0
            
            # Umbral típico de cierre de ojos (< 0.25 suele ser ojo cerrado)
            if ear_value < 0.25:
                fatigue_detected = True
                risk_score += 40  # Suma riesgo crítico
                
    return {
        "fatigue": fatigue_detected,
        "risk_score": risk_score,
        "ear_value": round(ear_value, 3),
        "status": "CRITICAL" if fatigue_detected else "NORMAL"
    }