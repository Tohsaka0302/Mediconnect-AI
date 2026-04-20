from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import database
from passlib.context import CryptContext
from jwt_utils import create_access_token

router = APIRouter()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class LoginRequest(BaseModel):
    email: str
    password: str
    role: str

@router.post("/login")
async def login(request: LoginRequest):
    # ------- Patient login by National ID -------
    # Patients use their national_id as both the "email" field and the password
    if request.role == "patient":
        # First try: look up by national_id in the patients collection
        patient = database.db["patients"].find_one({"national_id": request.email})

        if patient:
            # Verify: the password must also be the national_id
            if request.password != request.email:
                raise HTTPException(status_code=400, detail="Wrong password. Use your National ID as the password.")

            # Auto-create or find user account for this patient
            user = database.db["users"].find_one({"national_id": request.email})
            if not user:
                # Create a user record so future lookups work
                database.db["users"].insert_one({
                    "email": request.email,
                    "password": pwd_context.hash(request.email),
                    "role": "patient",
                    "name": patient.get("name", "Patient"),
                    "national_id": request.email
                })
                user = database.db["users"].find_one({"national_id": request.email})

            token = create_access_token({"sub": request.email, "role": "patient"})
            return {
                "token": token,
                "email": request.email,
                "name": patient.get("name", "Patient"),
                "role": "patient",
                "national_id": request.email
            }

        # Fallback: try normal email-based patient login (existing behavior)
        user = database.db["users"].find_one({"email": request.email})
        if user and user.get("role") == "patient":
            if not pwd_context.verify(request.password, user["password"]):
                raise HTTPException(status_code=400, detail="Wrong password")
            token = create_access_token({"sub": user["email"], "role": "patient"})
            response_data = {
                "token": token,
                "email": user["email"],
                "name": user["name"],
                "role": "patient"
            }
            if user.get("national_id"):
                response_data["national_id"] = user["national_id"]
            return response_data

        raise HTTPException(status_code=400, detail="No patient found with this National ID or email")

    # ------- Admin / Analyst login (email + password) -------
    user = database.db["users"].find_one({"email": request.email})

    if not user:
        # For analysts, also check the analysts collection
        if request.role == "analyst":
            analyst = database.db["analysts"].find_one({"email": request.email})
            if analyst:
                # Verify plain-text password stored in analysts collection
                if request.password != analyst.get("password", ""):
                    raise HTTPException(status_code=400, detail="Wrong password")
                token = create_access_token({"sub": analyst["email"], "role": "analyst"})
                return {
                    "token": token,
                    "email": analyst["email"],
                    "name": analyst.get("name", "Analyst"),
                    "role": "analyst"
                }
        raise HTTPException(status_code=400, detail="No user found")

    if not pwd_context.verify(request.password, user["password"]):
        raise HTTPException(status_code=400, detail="Wrong password or email")

    if user.get("role") != request.role:
        raise HTTPException(status_code=400, detail="Role mismatch")

    token = create_access_token({"sub": user["email"], "role": user["role"]})

    response_data = {
        "token": token,
        "email": user["email"],
        "name": user["name"],
        "role": user["role"]
    }

    if user.get("role") == "patient" and user.get("national_id"):
        response_data["national_id"] = user["national_id"]

    return response_data