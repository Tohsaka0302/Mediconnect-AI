from pydantic import BaseModel
from datetime import date

class PatientBase(BaseModel):
    name: str
    gender: str
    dob: date

class PatientCreate(PatientBase):
    pass

class Patient(PatientBase):
    id: int

    class Config:
        orm_mode = True
