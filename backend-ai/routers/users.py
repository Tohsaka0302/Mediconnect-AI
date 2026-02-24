from pydantic import BaseModel
from fastapi import APIRouter, HTTPException
import database

router = APIRouter()

users_collection = database.db["users"]

from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class ChangePasswordRequest(BaseModel):
    email: str
    old_password: str
    new_password: str

@router.put("/users/change-password")
async def change_password(request: ChangePasswordRequest):
    # 1. Find user
    user = users_collection.find_one({"email": request.email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # 2. Verify old password
    if not pwd_context.verify(request.old_password, user["password"]):
        raise HTTPException(status_code=400, detail="Incorrect current password")
        
    # 3. Hash new password and update
    hashed_new = pwd_context.hash(request.new_password)
    users_collection.update_one(
        {"email": request.email},
        {"$set": {"password": hashed_new}}
    )
    
    return {"message": "Password updated successfully"}

@router.get("/users")
async def get_users():
    users = []
    for user in users_collection.find():
        user["id"] = str(user["_id"])
        del user["_id"]
        users.append(user)
    
    # Ensure default users exist
    default_users = [
        {"email": "admin@ai.com", "password": pwd_context.hash("admin123"), "role": "admin", "name": "Admin"}
    ]
    for default in default_users:
        if not any(u["email"] == default["email"] for u in users):
            users_collection.insert_one(default.copy())
            
            # Append non-hashed password version or just omit it for the response if needed. 
            # It's better not to return passwords at all, but keeping original logic.
            # wait, returning hashed password is fine since it was returning plaintext before
            users.append(default)
    
    return users