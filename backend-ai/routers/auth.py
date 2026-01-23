from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import database
from passlib.context import CryptContext

router = APIRouter()

# Setup password hashing (must match your analyst file)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class LoginRequest(BaseModel):
    email: str
    password: str
    role: str

@router.post("/login")
async def login(request: LoginRequest):
    # 1. Find the user in MongoDB
    user = database.db["users"].find_one({"email": request.email})

    # 2. Check if user exists
    if not user:
        raise HTTPException(status_code=400, detail="Invalid Credentials")

    # 3. Verify the password (compare input vs stored hash)
    if not pwd_context.verify(request.password, user["password"]):
        raise HTTPException(status_code=400, detail="Invalid Credentials")

    # 4. Check if the role matches
    if user.get("role") != request.role:
        raise HTTPException(status_code=400, detail="Role mismatch")

    # 5. Return success (and user info for the frontend to store)
    return {
        "email": user["email"],
        "name": user["name"],
        "role": user["role"]
    }