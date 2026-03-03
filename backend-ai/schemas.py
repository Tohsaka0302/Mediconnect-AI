from pydantic import BaseModel
from typing import List, Optional

# --- AI Chat Models --- (used by ai_chat.py router)

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
