# Mediconnect-AI Development TODO List

## 🚀 Priority: Supervisor Feedback Implementation

### 1. Database Schema Updates (MongoDB)
- [x] **Patient Document:** Add `urgency_level` (Enum: Low, Medium, High).
- [x] **Patient Document:** Add `consultation_pref` (Enum: Online, Offline) - Implemented as `recommended_mode`.
- [x] **New Consultation Collection:** Create schema for `consultation_id`, `patient_id`, `analyst_id`, `type`, `status`, `payment_status`, and `feedback`.

### 2. AI Backend Refinement (backend-ai)
- [x] **Update Gemini Prompt (`ai_chat.py`):** Modify the specialty extraction prompt to also suggest `urgency_level` and `recommended_mode` (Online/Offline) based on symptoms.
- [x] **Data Mapping:** Categorize common symptoms in the prompt logic (e.g., "Fever" -> Online, "Chest Pain" -> Offline).

### 3. Core Logic & Flow (backend-node)
- [x] **Deduplication Audit:** Ensure `national_id` merging logic in `index.js` correctly handles conflicting data fields from different hospitals.
- [x] **Payment Mock-up:** Implement a simple `/api/payment/simulate` endpoint that updates `payment_status` to "Paid".
- [x] **Feedback Endpoint:** Create a route to receive and store patient ratings/comments.

### 4. Frontend Enhancements (frontend)
- [x] **Patient Detail Page:** Display AI-recommended consultation mode (Online/Offline).
- [x] **Payment Simulation:** Add a "Proceed to Payment" button for online consultations.
- [x] **Feedback Form:** Add a simple 5-star rating and comment box in the Patient view.
- [ ] **Data Seeding:** Update `seed_random_patients.js` to include the new fields for demo purposes.

### 5. Documentation & Screenshots
- [ ] **Step-by-Step Demo:** Prepare a sequence of actions (Input -> Share -> AI Triage -> Payment -> Feedback) for screen capture.

---
*Note: Use `coding-agent` or sub-agents for implementing specific code changes. Follow the academic style defined in `memory/thesis/style_reference.md`.*
