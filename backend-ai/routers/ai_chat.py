from fastapi import APIRouter
import os
import requests
import time
from dotenv import load_dotenv

# Import the refactored schemas
from schemas import SymptomInput, ChatInput, SpecialtyExtractionInput

router = APIRouter()

load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = "gemini-2.5-flash"

def call_gemini(payload, retries=3):
    """Call Gemini API with retry logic for transient 503/429 errors."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
    last_res = None
    for attempt in range(retries + 1):
        last_res = requests.post(url, json=payload)
        if last_res.status_code in (429, 503) and attempt < retries:
            wait = 2 ** (attempt + 1)  # Exponential backoff: 2s, 4s, 8s
            time.sleep(wait)
            continue
        last_res.raise_for_status()
        return last_res.json()
    last_res.raise_for_status()
    return last_res.json()

@router.post("/extract_specialty")
def extract_specialty(data: SpecialtyExtractionInput):
    import json as _json

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
    URGENCY_LEVELS = ["Low", "Medium", "High"]
    MODES = ["Online", "Offline"]

    default_response = {
        "specialty": "Internal Medicine",
        "urgency_level": "Medium",
        "recommended_mode": "Offline"
    }

    if not GEMINI_API_KEY:
        return default_response

    specialties_str = ", ".join(SPECIALTIES)

    try:
        prompt = f"""You are a medical triage AI. Given a patient's condition or illness, perform THREE classifications and return the result as a JSON object (no markdown, no code fences, just raw JSON).

1. **specialty** — classify into EXACTLY ONE of: {specialties_str}
2. **urgency_level** — assess clinical urgency as exactly one of: Low, Medium, High
   - Low: routine/chronic conditions manageable via scheduled visits (e.g., mild allergies, routine check-ups)
   - Medium: conditions needing timely but non-emergency attention (e.g., persistent fever, moderate pain)
   - High: acute/emergency conditions requiring immediate in-person care (e.g., chest pain, severe trauma, stroke symptoms)
3. **recommended_mode** — recommend consultation mode as exactly one of: Online, Offline
   - Online: condition can be safely assessed remotely (e.g., skin rashes, mild symptoms, follow-ups)
   - Offline: condition requires physical examination or emergency care (e.g., surgery cases, high urgency)

Rules:
- Return ONLY a JSON object with keys: specialty, urgency_level, recommended_mode
- Values must be EXACTLY from the allowed lists above, word-for-word.
- No extra text, explanation, or markdown formatting.
- If truly unclear, default to: Internal Medicine, Medium, Offline.

Patient condition: {data.condition}

JSON response:"""

        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.0}  # Zero temp for deterministic output
        }
        result = call_gemini(payload)

        raw = result["candidates"][0]["content"]["parts"][0]["text"].strip()

        # Strip markdown code fences if Gemini wraps them
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
        if raw.endswith("```"):
            raw = raw[:-3].strip()

        parsed = _json.loads(raw)

        # Validate each field
        specialty = next((s for s in SPECIALTIES if s.lower() == parsed.get("specialty", "").lower()), "Internal Medicine")
        urgency = next((u for u in URGENCY_LEVELS if u.lower() == parsed.get("urgency_level", "").lower()), "Medium")
        mode = next((m for m in MODES if m.lower() == parsed.get("recommended_mode", "").lower()), "Offline")

        return {
            "specialty": specialty,
            "urgency_level": urgency,
            "recommended_mode": mode
        }
    except Exception as e:
        print(f"Error extracting specialty: {e}")
        return default_response


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
        
        payload = {
            "contents": [{"parts": [{"text": prompt}]}]
        }
        result = call_gemini(payload)
        
        response_text = result["candidates"][0]["content"]["parts"][0]["text"]
        
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
        
        payload = {
            "contents": contents
        }
        
        result = call_gemini(payload)
        
        response_text = result["candidates"][0]["content"]["parts"][0]["text"]
        
        return {"response": response_text.strip()}
    except Exception as e:
        return {"response": f"Error communicating with AI: {str(e)}"}
