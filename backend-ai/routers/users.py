from fastapi import APIRouter
import database

router = APIRouter()

users_collection = database.db["users"]

@router.get("/users")
async def get_users():
    users = []
    for user in users_collection.find():
        user["id"] = str(user["_id"])
        del user["_id"]
        users.append(user)
    
    # Ensure default users exist
    default_users = [
        {"email": "admin@ai.com", "password": "admin123", "role": "admin", "name": "Admin"},
        {"email": "analyst@ai.com", "password": "analyst123", "role": "analyst", "name": "Analyst"}
    ]
    for default in default_users:
        if not any(u["email"] == default["email"] for u in users):
            users_collection.insert_one(default)
            users.append(default)
    
    return users