from fastapi import APIRouter
import os
import requests
from dotenv import load_dotenv

# Import the refactored schemas
from schemas import SymptomInput, ChatInput, SpecialtyExtractionInput

router = APIRouter()

load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

@router.post("/extract_specialty")
def extract_specialty(data: SpecialtyExtractionInput):
    if not GEMINI_API_KEY:
        return {"specialty": "Internal Medicine"}
        
    # The 7 canonical specialties used for analyst matching
    SPECIALTIES = [
        "Internal Medicine",
        "Pediatrics",
        "Family Medicine",
        "Surgery",
        "Psychiatry",
        "Radiology",
        "Anesthesiology"
    ]
    specialties_str = ", ".join(SPECIALTIES)
    
    try:
        prompt = f"""You are a medical triage AI. Given a patient's condition or illness, classify it into EXACTLY ONE of the following medical specialties:

{specialties_str}

Rules:
- You MUST return ONLY one of the specialty names listed above, word-for-word.
- Do NOT return any other text, explanation, or specialty not in the list.
- Pick the closest match. If truly unclear, return "Internal Medicine".

Patient condition: {data.condition}

Answer (one specialty name only):"""
        
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.0}  # Zero temp for deterministic output
        }
        res = requests.post(url, json=payload)
        res.raise_for_status()
        
        raw = res.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
        
        # Validate the returned value is one of the allowed specialties
        matched = next((s for s in SPECIALTIES if s.lower() == raw.lower()), None)
        specialty = matched if matched else "Internal Medicine"
        
        return {"specialty": specialty}
    except Exception as e:
        print(f"Error extracting specialty: {e}")
        return {"specialty": "Internal Medicine"}


@router.post("/predict_treatment")
def predict_treatment(data: SymptomInput):
    print(f"Received predict_treatment for patient {data.patient_id}")
    if not GEMINI_API_KEY:
        return {
            "patient_id": data.patient_id,
            "recommended_treatment": "Gemini API key is missing. Cannot generate recommendation.",
            "confidence_score": 0.0
        }
    
    try:
        prompt = f"""
        Act as an advanced medical AI assistant for MediConnect-AI. 
        Based on the following patient data, provide a brief, professional treatment recommendation or clinical insight.
        Keep it concise (2-3 sentences max) and use an authoritative but helpful medical tone. Do not use markdown formatting.
        
        Symptoms/Condition: {', '.join(data.symptoms)}
        Medical History: {data.history if data.history else 'None provided'}
        """
        
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}]
        }
        res = requests.post(url, json=payload)
        res.raise_for_status()
        
        response_text = res.json()["candidates"][0]["content"]["parts"][0]["text"]
        
        return {
            "patient_id": data.patient_id,
            "recommended_treatment": response_text.strip(),
            "confidence_score": 0.95  # Mock confidence score for now
        }
    except Exception as e:
        return {
            "patient_id": data.patient_id,
            "recommended_treatment": f"Error generating recommendation: {str(e)}",
            "confidence_score": 0.0
        }

@router.post("/chat_gemini")
def chat_gemini(data: ChatInput):
    if not GEMINI_API_KEY:
        return {"response": "Gemini API key is missing. Cannot use chat."}

    try:
        # Build the system context
        context_prompt = f"""
        System Context: You are an advanced medical AI assistant for MediConnect-AI.
        Patient Data Context:
        Symptoms/Condition: {', '.join(data.symptoms)}
        Medical History: {data.history if data.history else 'None provided'}
        
        Instructions: You are continuing a conversation with a doctor or analyst regarding this specific patient. Keep your responses professional, concise, and medical. Do not use markdown formatting.
        """
        
        # Convert frontend message format to Gemini's format
        contents = []
        for msg in data.messages[:-1]: # All messages except the last user message
            role = "model" if msg.role == "ai" else "user"
            contents.append({"role": role, "parts": [{"text": msg.content}]})
            
        # Append context to the final user prompt
        final_user_msg = data.messages[-1].content
        combined_prompt = f"{context_prompt}\n\nUser Question: {final_user_msg}"
        contents.append({"role": "user", "parts": [{"text": combined_prompt}]})
        
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
        payload = {
            "contents": contents
        }
        
        res = requests.post(url, json=payload)
        res.raise_for_status()
        
        response_text = res.json()["candidates"][0]["content"]["parts"][0]["text"]
        
        return {"response": response_text.strip()}
    except Exception as e:
        return {"response": f"Error communicating with AI: {str(e)}"}
