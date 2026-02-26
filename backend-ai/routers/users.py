from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Depends
import database
from passlib.context import CryptContext
from jwt_utils import get_current_user

router = APIRouter()
users_collection = database.db["users"]
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class ChangePasswordRequest(BaseModel):
    email: str
    old_password: str
    new_password: str

@router.put("/users/change-password")
async def change_password(request: ChangePasswordRequest, user=Depends(get_current_user)):
    # Only allow changing your own password
    if user.get("sub") != request.email:
        raise HTTPException(status_code=403, detail="You can only change your own password")

    db_user = users_collection.find_one({"email": request.email})
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    if not pwd_context.verify(request.old_password, db_user["password"]):
        raise HTTPException(status_code=400, detail="Incorrect current password")

    hashed_new = pwd_context.hash(request.new_password)
    users_collection.update_one(
        {"email": request.email},
        {"$set": {"password": hashed_new}}
    )

    return {"message": "Password updated successfully"}

@router.get("/users")
async def get_users(user=Depends(get_current_user)):
    users = []
    for u in users_collection.find():
        u["id"] = str(u["_id"])
        del u["_id"]
        # Never return the password field
        u.pop("password", None)
        users.append(u)
    return users