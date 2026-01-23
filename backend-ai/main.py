from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware # 1. Import CORS
from pydantic import BaseModel
from typing import List, Optional
from routers import patients, analysts, users, auth  # 2. Add auth to imports

app = FastAPI()

# 3. Add CORS Middleware (Essential for React connection)
origins = [
    "http://localhost:3000",  # Allow your React app
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Routers
app.include_router(patients.router)
app.include_router(analysts.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(auth.router, prefix="/api")  # This will now work

# Pydantic model for input validation
class SymptomInput(BaseModel):
    patient_id: int
    symptoms: List[str]
    history: Optional[str] = None

@app.get("/")
def read_root():
    return {"status": "MediConnectAI Prediction Service Running"}

# The Custom AI Recommendation Endpoint 
@app.post("/predict_treatment")
def predict_treatment(data: SymptomInput):
    # This is where we will load the ML model (scikit-learn/TensorFlow)
    # For now, returning a mock response to test connectivity
    return {
        "patient_id": data.patient_id,
        "recommended_treatment": "Suggested treatment based on " + ", ".join(data.symptoms),
        "confidence_score": 0.92
    }