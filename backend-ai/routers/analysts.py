from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
import database
from bson import ObjectId
from passlib.context import CryptContext
from jwt_utils import get_current_user, require_admin

router = APIRouter()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class AnalystBase(BaseModel):
    name: str
    email: str
    hospital: str
    specialties: str

class Analyst(AnalystBase):
    id: str

class AnalystUpdate(BaseModel):
    hospital: Optional[str] = None
    specialties: Optional[str] = None

analysts_collection = database.db["analysts"]
users_collection = database.db["users"]

@router.get("/analysts", response_model=List[Analyst])
async def get_analysts():
    analysts = []
    for analyst in analysts_collection.find():
        analyst["id"] = str(analyst["_id"])
        del analyst["_id"]
        analysts.append(analyst)
    return analysts

@router.post("/analysts", response_model=Analyst)
async def create_analyst(analyst: AnalystBase, user=Depends(require_admin)):
    if users_collection.find_one({"email": analyst.email}):
        raise HTTPException(status_code=400, detail="Email already registered")

    analyst_dict = analyst.dict()
    result = analysts_collection.insert_one(analyst_dict)
    analyst_dict["id"] = str(result.inserted_id)

    hashed_password = pwd_context.hash("analyst123")
    user_dict = {
        "email": analyst.email,
        "password": hashed_password,
        "role": "analyst",
        "name": analyst.name,
        "linked_analyst_id": str(result.inserted_id)
    }
    users_collection.insert_one(user_dict)

    return analyst_dict

@router.get("/analyst-stats")
async def get_analyst_stats():
    """
    Returns each analyst with a count of patients assigned to them
    based on matching their specialties to patient 'suggested' field.
    Reads from the backend-ai (FastAPI) MongoDB — same DB as /analysts.
    """
    patients_collection = database.db["patients"]
    analysts = list(analysts_collection.find())
    patients = list(patients_collection.find({}, {"suggested": 1}))

    stats = []
    for analyst in analysts:
        specialties_list = [
            s.strip().lower()
            for s in (analyst.get("specialties") or "").split(",")
            if s.strip()
        ]
        count = sum(
            1 for p in patients
            if any(sp in (p.get("suggested") or "").lower() for sp in specialties_list)
        )
        stats.append({
            "id": str(analyst["_id"]),
            "name": analyst.get("name"),
            "email": analyst.get("email"),
            "hospital": analyst.get("hospital"),
            "specialties": analyst.get("specialties"),
            "assignedPatientCount": count
        })

    return stats


@router.get("/analysts/by-email/{email}", response_model=Analyst)
async def get_analyst_by_email(email: str):
    analyst = analysts_collection.find_one({"email": email})
    if not analyst:
        raise HTTPException(status_code=404, detail="Analyst not found")
    analyst["id"] = str(analyst["_id"])
    del analyst["_id"]
    return analyst

@router.put("/analysts/{analyst_id}", response_model=Analyst)
async def update_analyst(analyst_id: str, update: AnalystUpdate, user=Depends(require_admin)):
    if not ObjectId.is_valid(analyst_id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    update_data = {k: v for k, v in update.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = analysts_collection.find_one_and_update(
        {"_id": ObjectId(analyst_id)},
        {"$set": update_data},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Analyst not found")

    result["id"] = str(result["_id"])
    del result["_id"]
    return result

@router.delete("/analysts/{analyst_id}")
async def delete_analyst(analyst_id: str, user=Depends(require_admin)):
    if not ObjectId.is_valid(analyst_id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    try:
        analyst = analysts_collection.find_one({"_id": ObjectId(analyst_id)})
        if not analyst:
            raise HTTPException(status_code=404, detail="Analyst not found")

        analyst_result = analysts_collection.delete_one({"_id": ObjectId(analyst_id)})
        if analyst_result.deleted_count > 0:
            users_collection.delete_one({"email": analyst["email"]})

        return {"message": "Analyst and user account deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))