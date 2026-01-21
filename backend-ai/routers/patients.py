from fastapi import APIRouter
import schemas, crud

router = APIRouter()

@router.get("/patients", response_model=list[schemas.Patient])
def read_patients():
    return crud.get_patients()

@router.post("/patients", response_model=schemas.Patient)
def create_patient(patient: schemas.PatientCreate):
    return crud.create_patient(patient)
