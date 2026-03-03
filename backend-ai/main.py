from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import analysts, users, auth, ai_chat
import os
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

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

app.include_router(analysts.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(ai_chat.router)

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



@app.get("/")
def read_root():
    return {"status": "MediConnectAI Prediction Service Running"}