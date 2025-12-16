from sqlalchemy.orm import Session
import models, schemas

def get_patients(db: Session):
    return db.query(models.Patient).all()

def create_patient(db: Session, patient: schemas.PatientCreate):
    new = models.Patient(**patient.dict())
    db.add(new)
    db.commit()
    db.refresh(new)
    return new
