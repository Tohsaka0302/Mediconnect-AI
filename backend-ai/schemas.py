from pydantic import BaseModel
from datetime import date
from typing import List, Optional

# --- Patient Models ---

class PatientBase(BaseModel):
    name: str
    gender: str
    dob: date

class PatientCreate(PatientBase):
    pass

class Patient(PatientBase):
    id: str

# --- AI Chat Models ---
class SymptomInput(BaseModel):
    patient_id: str
    symptoms: List[str]
    history: Optional[str] = None

class SpecialtyExtractionInput(BaseModel):
    condition: str

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatInput(BaseModel):
    patient_id: str
    symptoms: List[str]
    history: Optional[str] = None
    messages: List[ChatMessage]
