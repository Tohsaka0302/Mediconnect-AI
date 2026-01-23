from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
import database
from bson import ObjectId
from passlib.context import CryptContext # Import for password hashing

router = APIRouter()

# Setup password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class AnalystBase(BaseModel):
    name: str
    email: str
    hospital: str
    specialties: str

class Analyst(AnalystBase):
    id: str

analysts_collection = database.db["analysts"]
users_collection = database.db["users"] # Define this at the top level

@router.get("/analysts", response_model=List[Analyst])
async def get_analysts():
    analysts = []
    for analyst in analysts_collection.find():
        analyst["id"] = str(analyst["_id"])
        del analyst["_id"]
        analysts.append(analyst)
    return analysts

@router.post("/analysts", response_model=Analyst)
async def create_analyst(analyst: AnalystBase):
    # 1. Check if email already exists in users to avoid duplicates
    if users_collection.find_one({"email": analyst.email}):
        raise HTTPException(status_code=400, detail="Email already registered")

    # 2. Prepare analyst data
    analyst_dict = analyst.dict()
    result = analysts_collection.insert_one(analyst_dict)
    analyst_dict["id"] = str(result.inserted_id)
    
    # 3. Securely hash the default password
    hashed_password = pwd_context.hash("analyst123")
    
    # 4. Create the user account with the HASHED password
    user_dict = {
        "email": analyst.email,
        "password": hashed_password, # NEVER store plain text
        "role": "analyst",
        "name": analyst.name,
        "linked_analyst_id": str(result.inserted_id) # Optional: Link back to analyst profile
    }
    users_collection.insert_one(user_dict)
    
    return analyst_dict

@router.delete("/analysts/{analyst_id}")
async def delete_analyst(analyst_id: str):
    if not ObjectId.is_valid(analyst_id):
        raise HTTPException(status_code=400, detail="Invalid ID format")
        
    try:
        # Find the analyst to get email
        analyst = analysts_collection.find_one({"_id": ObjectId(analyst_id)})
        if not analyst:
            raise HTTPException(status_code=404, detail="Analyst not found")
        
        # Delete analyst
        analyst_result = analysts_collection.delete_one({"_id": ObjectId(analyst_id)})
        
        # Delete corresponding user
        # Only delete if analyst deletion was successful
        if analyst_result.deleted_count > 0:
            users_collection.delete_one({"email": analyst["email"]})
        
        return {"message": "Analyst and user account deleted"}
    except Exception as e:
        # Log the error here in a real app
        raise HTTPException(status_code=500, detail=str(e))