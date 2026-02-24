from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware # 1. Import CORS
from pydantic import BaseModel
from typing import List, Optional
from routers import patients, analysts, users, auth  # 2. Add auth to imports

app = FastAPI()

# 3. Add CORS Middleware (Essential for React connection)
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://localhost:3002",
    "http://127.0.0.1:3002"
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

@app.on_event("startup")
def startup_db_client():
    import database
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    users_collection = database.db["users"]
    
    default_users = [
        {"email": "admin@ai.com", "password": pwd_context.hash("admin123"), "role": "admin", "name": "Admin"},
    ]
    for default in default_users:
        if not users_collection.find_one({"email": default["email"]}):
            users_collection.insert_one(default)

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