from database import db
from schemas import PatientCreate

def get_patients():
    patients = list(db.patients.find())
    for patient in patients:
        patient["id"] = str(patient["_id"])  # Convert ObjectId to string
        del patient["_id"]
    return patients

def create_patient(patient: PatientCreate):
    patient_dict = patient.dict()
    result = db.patients.insert_one(patient_dict)
    patient_dict["id"] = str(result.inserted_id)
    return patient_dict