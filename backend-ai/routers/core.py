from datetime import datetime
from typing import Any, Dict, List, Optional
import os

from bson import ObjectId
from dotenv import load_dotenv
from fastapi import APIRouter, Body, Depends, Header
from fastapi.responses import JSONResponse
from pymongo import ReturnDocument
import requests

import database
from routers.ai_chat import extract_specialty
from schemas import SpecialtyExtractionInput

load_dotenv()

router = APIRouter()


def ensure_indexes() -> None:
    try:
        patients = database.db["patients"]
        patients.create_index([("national_id", 1)], sparse=True)
        patients.create_index([("hospitals", 1)])
    except Exception as exc:
        print(f"MongoDB index setup failed: {exc}")


def serialize(value: Any) -> Any:
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, list):
        return [serialize(item) for item in value]
    if isinstance(value, dict):
        return {key: serialize(item) for key, item in value.items()}
    return value


def error_response(status_code: int, message: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"error": message})


def created(content: Any) -> JSONResponse:
    return JSONResponse(status_code=201, content=serialize(content))


def object_id(value: Any) -> Optional[ObjectId]:
    if value is None:
        return None
    text = str(value)
    if not ObjectId.is_valid(text):
        return None
    return ObjectId(text)


def patient_lookup_query(patient_id: str) -> Dict[str, Any]:
    clauses: List[Dict[str, Any]] = [{"id": patient_id}, {"_id": patient_id}]
    oid = object_id(patient_id)
    if oid:
        clauses.append({"_id": oid})
    return {"$or": clauses}


def normalize_hospital(raw_hospital: Any) -> str:
    raw = str(raw_hospital or "").strip()
    if not raw:
        return "Unknown"
    if raw.lower().startswith("hospital"):
        return raw
    return f"Hospital {raw}"


def valid_api_keys() -> set[str]:
    return {
        os.getenv("HOSPITAL_A_API_KEY") or "sk_test_12345hospitalA",
        os.getenv("HOSPITAL_B_API_KEY") or "sk_test_12345hospitalB",
    }


def require_api_key(x_api_key: Optional[str] = Header(default=None)) -> None:
    if not x_api_key or x_api_key not in valid_api_keys():
        from fastapi import HTTPException

        raise HTTPException(status_code=403, detail="Access denied. Invalid or missing API key.")


def triage_condition(condition: str) -> Dict[str, str]:
    defaults = {
        "specialty": "Pending AI analysis",
        "urgency_level": "Medium",
        "recommended_mode": "Offline",
    }
    if not condition:
        return defaults

    try:
        result = extract_specialty(SpecialtyExtractionInput(condition=condition))
        return {
            "specialty": result.get("specialty") or defaults["specialty"],
            "urgency_level": result.get("urgency_level") or defaults["urgency_level"],
            "recommended_mode": result.get("recommended_mode") or defaults["recommended_mode"],
        }
    except Exception as exc:
        print(f"AI specialty extraction failed: {exc}")
        return defaults


def build_hospital_record(hospital_data: Dict[str, Any]) -> Dict[str, Any]:
    excluded = {"name", "birth_date", "gender", "age", "national_id", "hospital"}
    record = {key: value for key, value in hospital_data.items() if key not in excluded}
    record["hospitalPatientId"] = hospital_data.get("id") or hospital_data.get("_id")
    record["ingestedAt"] = datetime.utcnow()
    return record


def incoming_condition(hospital_data: Dict[str, Any]) -> str:
    return hospital_data.get("illness") or hospital_data.get("condition") or "N/A"


@router.get("/patients")
def list_patients(role: Optional[str] = None, email: Optional[str] = None):
    try:
        patients = list(database.db["patients"].find({}))

        if role == "analyst" and email:
            analyst = database.db["analysts"].find_one({"email": email})
            if analyst and analyst.get("specialties"):
                specialties = [
                    item.strip().lower()
                    for item in analyst.get("specialties", "").split(",")
                    if item.strip()
                ]
                patients = [
                    patient
                    for patient in patients
                    if any(
                        specialty in (patient.get("suggested") or "").lower()
                        for specialty in specialties
                    )
                ]

        result = []
        for patient in patients:
            hospitals = patient.get("hospitals") or ([f"Hospital {patient.get('hospital')}"] if patient.get("hospital") else [])
            result.append(
                {
                    "_id": patient.get("_id"),
                    "id": patient.get("_id"),
                    "national_id": patient.get("national_id"),
                    "name": patient.get("name"),
                    "birth_date": patient.get("birth_date"),
                    "gender": patient.get("gender"),
                    "age": patient.get("age"),
                    "condition": patient.get("primaryCondition") or patient.get("condition") or patient.get("illness"),
                    "illness": patient.get("primaryCondition") or patient.get("illness") or patient.get("condition"),
                    "hospitals": hospitals,
                    "hospital": ", ".join(hospitals) if hospitals else "Unknown",
                    "suggested": patient.get("suggested"),
                    "urgency_level": patient.get("urgency_level") or "Medium",
                    "recommended_mode": patient.get("recommended_mode") or "Offline",
                    "ingestedAt": patient.get("ingestedAt"),
                }
            )
        return serialize(result)
    except Exception as exc:
        return error_response(500, str(exc))


@router.get("/patients/{patient_id}")
def get_patient(patient_id: str):
    try:
        patient = database.db["patients"].find_one(patient_lookup_query(patient_id))
        if not patient:
            return error_response(404, "Patient not found")
        return serialize(patient)
    except Exception:
        return error_response(500, "Failed to fetch patient details")


@router.put("/api/patients/{patient_id}/triage")
def update_patient_triage(patient_id: str, body: Dict[str, Any] = Body(default_factory=dict)):
    try:
        update_fields: Dict[str, Any] = {}
        for field in ("suggested", "urgency_level", "recommended_mode"):
            if field in body:
                update_fields[field] = body[field]
        update_fields["updatedAt"] = datetime.utcnow()

        result = database.db["patients"].find_one_and_update(
            patient_lookup_query(patient_id),
            {"$set": update_fields},
            return_document=ReturnDocument.AFTER,
        )
        if not result:
            return error_response(404, "Patient not found")
        return serialize(result)
    except Exception:
        return error_response(500, "Failed to update patient triage")


@router.post("/api/ingest-hospital-data", dependencies=[Depends(require_api_key)])
def ingest_hospital_data(hospital_data: Dict[str, Any] = Body(default_factory=dict)):
    try:
        if not hospital_data:
            return error_response(400, "No data provided in the request body.")

        hospital_name = normalize_hospital(hospital_data.get("hospital") or hospital_data.get("hospitalName"))
        national_id = hospital_data.get("national_id")
        condition = hospital_data.get("illness") or hospital_data.get("condition") or ""
        triage = triage_condition(condition)
        hospital_record = build_hospital_record(hospital_data)

        patients = database.db["patients"]
        if national_id:
            existing = patients.find_one({"national_id": national_id})
            if existing:
                incoming_fields = {
                    "name": hospital_data.get("name") or "Unknown",
                    "birth_date": hospital_data.get("birth_date"),
                    "gender": hospital_data.get("gender"),
                    "age": hospital_data.get("age"),
                    "primaryCondition": incoming_condition(hospital_data),
                }
                conflicts = []
                for field in ("name", "birth_date", "gender", "age", "primaryCondition"):
                    existing_value = existing.get(field)
                    incoming_value = incoming_fields.get(field)
                    if str(existing_value or "") and str(incoming_value or "") and str(existing_value) != str(incoming_value):
                        conflicts.append(
                            {
                                "field": field,
                                "existingValue": existing_value,
                                "incomingValue": incoming_value,
                            }
                        )

                if conflicts:
                    conflict_record = {
                        "national_id": national_id,
                        "patientId": str(existing["_id"]),
                        "existingPatientName": existing.get("name"),
                        "incomingHospital": hospital_name,
                        "conflicts": conflicts,
                        "incomingData": {
                            "name": hospital_data.get("name"),
                            "birth_date": hospital_data.get("birth_date"),
                            "gender": hospital_data.get("gender"),
                            "age": hospital_data.get("age"),
                            "condition": condition,
                        },
                        "hospitalRecord": hospital_record,
                        "status": "Pending",
                        "createdAt": datetime.utcnow(),
                    }
                    database.db["dataConflicts"].insert_one(conflict_record)

                    patients.update_one(
                        {"national_id": national_id},
                        {
                            "$set": {
                                f"hospitalRecords.{hospital_name}": hospital_record,
                                "suggested": triage["specialty"],
                                "urgency_level": triage["urgency_level"],
                                "recommended_mode": triage["recommended_mode"],
                                "primaryCondition": incoming_condition(hospital_data),
                            },
                            "$addToSet": {"hospitals": hospital_name},
                        },
                    )
                    return created(
                        {
                            "message": f"Data ingested from {hospital_name} but identity conflicts detected. Awaiting admin review.",
                            "patientId": existing["_id"],
                            "hasConflicts": True,
                            "conflictCount": len(conflicts),
                        }
                    )

            result = patients.find_one_and_update(
                {"national_id": national_id},
                {
                    "$set": {
                        "name": hospital_data.get("name") or "Unknown",
                        "birth_date": hospital_data.get("birth_date"),
                        "gender": hospital_data.get("gender"),
                        "age": hospital_data.get("age"),
                        "national_id": national_id,
                        "suggested": triage["specialty"],
                        "urgency_level": triage["urgency_level"],
                        "recommended_mode": triage["recommended_mode"],
                        "primaryCondition": incoming_condition(hospital_data),
                        f"hospitalRecords.{hospital_name}": hospital_record,
                    },
                    "$addToSet": {"hospitals": hospital_name},
                    "$setOnInsert": {"ingestedAt": datetime.utcnow()},
                },
                upsert=True,
                return_document=ReturnDocument.AFTER,
            )
            return created(
                {
                    "message": f"Patient data merged for national_id {national_id} from {hospital_name}.",
                    "patientId": result["_id"],
                }
            )

        payload = {
            **hospital_data,
            "suggested": triage["specialty"],
            "urgency_level": triage["urgency_level"],
            "recommended_mode": triage["recommended_mode"],
            "primaryCondition": incoming_condition(hospital_data),
            "hospitals": [hospital_name],
            "hospitalRecords": {hospital_name: hospital_record},
            "ingestedAt": datetime.utcnow(),
        }
        result = patients.insert_one(payload)
        return created({"message": "Data ingested (no national_id - inserted as new record).", "insertedId": result.inserted_id})
    except Exception as exc:
        print(f"Ingestion error: {exc}")
        return error_response(500, "Failed to ingest hospital data.")


@router.post("/api/ingest-hospital-data/bulk", dependencies=[Depends(require_api_key)])
def bulk_ingest_hospital_data(body: Any = Body(...)):
    try:
        if not isinstance(body, list) or not body:
            return error_response(400, "Request body must be a non-empty array of patients.")

        results = []
        patients = database.db["patients"]
        for hospital_data in body:
            if not isinstance(hospital_data, dict):
                results.append({"ok": False, "error": "Patient entry must be an object."})
                continue

            try:
                hospital_name = normalize_hospital(hospital_data.get("hospital") or hospital_data.get("hospitalName"))
                national_id = hospital_data.get("national_id")
                triage = triage_condition(hospital_data.get("illness") or hospital_data.get("condition") or "")
                hospital_record = build_hospital_record(hospital_data)

                if national_id:
                    result = patients.find_one_and_update(
                        {"national_id": national_id},
                        {
                            "$set": {
                                "name": hospital_data.get("name") or "Unknown",
                                "birth_date": hospital_data.get("birth_date"),
                                "gender": hospital_data.get("gender"),
                                "age": hospital_data.get("age"),
                                "national_id": national_id,
                                "suggested": triage["specialty"],
                                "urgency_level": triage["urgency_level"],
                                "recommended_mode": triage["recommended_mode"],
                                "primaryCondition": incoming_condition(hospital_data),
                                f"hospitalRecords.{hospital_name}": hospital_record,
                            },
                            "$addToSet": {"hospitals": hospital_name},
                            "$setOnInsert": {"ingestedAt": datetime.utcnow()},
                        },
                        upsert=True,
                        return_document=ReturnDocument.AFTER,
                    )
                    results.append({"ok": True, "patientId": result["_id"]})
                else:
                    payload = {
                        **hospital_data,
                        "suggested": triage["specialty"],
                        "urgency_level": triage["urgency_level"],
                        "recommended_mode": triage["recommended_mode"],
                        "primaryCondition": incoming_condition(hospital_data),
                        "hospitals": [hospital_name],
                        "hospitalRecords": {hospital_name: hospital_record},
                        "ingestedAt": datetime.utcnow(),
                    }
                    result = patients.insert_one(payload)
                    results.append({"ok": True, "patientId": result.inserted_id})
            except Exception as exc:
                results.append({"ok": False, "error": str(exc)})

        succeeded = len([item for item in results if item.get("ok")])
        failed = len(results) - succeeded
        return created(
            {
                "message": f"Bulk ingestion complete. {succeeded} succeeded, {failed} failed out of {len(body)}.",
                "results": results,
            }
        )
    except Exception as exc:
        print(f"Bulk ingestion error: {exc}")
        return error_response(500, "Failed to bulk ingest hospital data.")


@router.post("/api/removal-requests", dependencies=[Depends(require_api_key)])
def create_removal_request(body: Dict[str, Any] = Body(default_factory=dict)):
    try:
        patient_id = body.get("patientId")
        national_id = body.get("national_id")
        if not patient_id and not national_id:
            return error_response(400, "Patient ID or National ID is required")

        normalized_hospital = normalize_hospital(body.get("hospital")) if body.get("hospital") else ""
        clauses: List[Dict[str, Any]] = []
        if national_id:
            clauses.append({"national_id": national_id})
        if patient_id:
            if normalized_hospital:
                clauses.append({f"hospitalRecords.{normalized_hospital}.hospitalPatientId": patient_id})
            clauses.append({"id": patient_id})
            oid = object_id(patient_id)
            if oid:
                clauses.append({"_id": oid})

        patient = database.db["patients"].find_one({"$or": clauses}) if clauses else None
        request_doc = {
            "hospitalRequestId": body.get("hospitalRequestId"),
            "patientId": str(patient["_id"]) if patient else None,
            "hospitalPatientId": patient_id,
            "patientName": patient.get("name") if patient else (body.get("patientName") or "Unknown"),
            "hospital": normalized_hospital or body.get("hospital"),
            "status": "Pending MediConnect Approval",
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow(),
        }
        result = database.db["removalRequests"].insert_one(request_doc)
        return created({"message": "Removal request received", "id": result.inserted_id})
    except Exception as exc:
        print(f"Error receiving removal request: {exc}")
        return error_response(500, "Failed to process removal request")


@router.get("/api/removal-requests")
def list_removal_requests():
    try:
        requests_list = list(database.db["removalRequests"].find({}).sort("createdAt", -1))
        return serialize(requests_list)
    except Exception:
        return error_response(500, "Failed to fetch removal requests")


def notify_hospital(webhooks: Dict[str, str], hospital: str, patient_id: Optional[str]) -> None:
    webhook_url = webhooks.get(hospital)
    if not webhook_url:
        print(f"No webhook configured for hospital: {hospital}")
        return
    try:
        requests.post(webhook_url, json={"patientId": patient_id}, timeout=3)
    except Exception as exc:
        print(f"Failed to notify {hospital}: {exc}")


@router.put("/api/removal-requests/{request_id}/approve")
def approve_removal_request(request_id: str):
    try:
        request_oid = object_id(request_id)
        if not request_oid:
            return error_response(400, "Invalid request ID")

        request_doc = database.db["removalRequests"].find_one({"_id": request_oid})
        if not request_doc:
            return error_response(404, "Request not found")

        if request_doc.get("patientId"):
            patient_oid = object_id(request_doc.get("patientId"))
            patient = database.db["patients"].find_one({"_id": patient_oid}) if patient_oid else None
            if patient:
                hospital_key = request_doc.get("hospital")
                updated_hospitals = [item for item in patient.get("hospitals", []) if item != hospital_key]
                if not updated_hospitals:
                    database.db["patients"].delete_one({"_id": patient_oid})
                else:
                    database.db["patients"].update_one(
                        {"_id": patient_oid},
                        {
                            "$unset": {f"hospitalRecords.{hospital_key}": ""},
                            "$pull": {"hospitals": hospital_key},
                        },
                    )

        database.db["removalRequests"].update_one(
            {"_id": request_oid},
            {"$set": {"status": "Approved", "updatedAt": datetime.utcnow()}},
        )
        notify_hospital(
            {
                "Hospital A": "http://localhost:8001/api/webhook/unsync",
                "Hospital B": "http://localhost:8002/api/webhook/unsync",
            },
            request_doc.get("hospital"),
            request_doc.get("hospitalPatientId") or request_doc.get("patientId"),
        )
        return {"message": "Request approved and patient data deleted"}
    except Exception as exc:
        print(f"Error approving removal request: {exc}")
        return error_response(500, "Failed to approve request")


@router.put("/api/removal-requests/{request_id}/reject")
def reject_removal_request(request_id: str):
    try:
        request_oid = object_id(request_id)
        if not request_oid:
            return error_response(400, "Invalid request ID")

        request_doc = database.db["removalRequests"].find_one({"_id": request_oid})
        if not request_doc:
            return error_response(404, "Request not found")

        database.db["removalRequests"].update_one(
            {"_id": request_oid},
            {"$set": {"status": "Rejected", "updatedAt": datetime.utcnow()}},
        )
        notify_hospital(
            {
                "Hospital A": "http://localhost:8001/api/webhook/reject",
                "Hospital B": "http://localhost:8002/api/webhook/reject",
            },
            request_doc.get("hospital"),
            request_doc.get("hospitalPatientId") or request_doc.get("patientId"),
        )
        return {"message": "Request rejected"}
    except Exception as exc:
        print(f"Error rejecting removal request: {exc}")
        return error_response(500, "Failed to reject request")


@router.post("/api/retag-patients")
def retag_patients():
    try:
        patients = list(database.db["patients"].find({}))
        updated = 0
        failed = 0

        for patient in patients:
            condition = patient.get("primaryCondition") or patient.get("illness") or patient.get("condition") or ""
            if not condition:
                failed += 1
                continue
            triage = triage_condition(condition)
            database.db["patients"].update_one(
                {"_id": patient["_id"]},
                {
                    "$set": {
                        "suggested": triage.get("specialty") or "Internal Medicine",
                        "urgency_level": triage.get("urgency_level") or "Medium",
                        "recommended_mode": triage.get("recommended_mode") or "Offline",
                    }
                },
            )
            updated += 1

        return {"message": f"Retagging complete. Updated: {updated}, Failed: {failed}, Total: {len(patients)}"}
    except Exception:
        return error_response(500, "Failed to retag patients")


@router.get("/api/data-conflicts")
def list_data_conflicts():
    try:
        conflicts = list(database.db["dataConflicts"].find({}).sort("createdAt", -1))
        return serialize(conflicts)
    except Exception:
        return error_response(500, "Failed to fetch data conflicts")


@router.put("/api/data-conflicts/{conflict_id}/approve")
def approve_data_conflict(conflict_id: str):
    try:
        conflict_oid = object_id(conflict_id)
        if not conflict_oid:
            return error_response(400, "Invalid conflict ID")

        conflict = database.db["dataConflicts"].find_one({"_id": conflict_oid})
        if not conflict:
            return error_response(404, "Conflict not found")

        update_fields: Dict[str, Any] = {}
        incoming = conflict.get("incomingData") or {}
        for field in ("name", "birth_date", "gender", "age"):
            if incoming.get(field):
                update_fields[field] = incoming[field]
        if incoming.get("condition"):
            update_fields["primaryCondition"] = incoming["condition"]

        patient_oid = object_id(conflict.get("patientId"))
        if patient_oid and update_fields:
            database.db["patients"].update_one({"_id": patient_oid}, {"$set": update_fields})

        database.db["dataConflicts"].update_one(
            {"_id": conflict_oid},
            {"$set": {"status": "Approved", "resolvedAt": datetime.utcnow()}},
        )
        return {"message": "Conflict resolved - patient updated with incoming data."}
    except Exception:
        return error_response(500, "Failed to approve conflict")


@router.put("/api/data-conflicts/{conflict_id}/create-new")
def create_patient_from_conflict(conflict_id: str):
    try:
        conflict_oid = object_id(conflict_id)
        if not conflict_oid:
            return error_response(400, "Invalid conflict ID")

        conflict = database.db["dataConflicts"].find_one({"_id": conflict_oid})
        if not conflict:
            return error_response(404, "Conflict not found")

        incoming = conflict.get("incomingData") or {}
        incoming_hospital = conflict.get("incomingHospital")
        new_patient = {
            "name": incoming.get("name") or "Unknown",
            "birth_date": incoming.get("birth_date"),
            "gender": incoming.get("gender"),
            "age": incoming.get("age"),
            "national_id": f"{conflict.get('national_id')}_dup",
            "primaryCondition": incoming.get("condition") or "N/A",
            "hospitals": [incoming_hospital],
            "hospitalRecords": {incoming_hospital: conflict.get("hospitalRecord")},
            "suggested": "Pending AI analysis",
            "urgency_level": "Medium",
            "recommended_mode": "Offline",
            "ingestedAt": datetime.utcnow(),
        }
        result = database.db["patients"].insert_one(new_patient)

        patient_oid = object_id(conflict.get("patientId"))
        if patient_oid:
            database.db["patients"].update_one(
                {"_id": patient_oid},
                {
                    "$unset": {f"hospitalRecords.{incoming_hospital}": ""},
                    "$pull": {"hospitals": incoming_hospital},
                },
            )

        database.db["dataConflicts"].update_one(
            {"_id": conflict_oid},
            {
                "$set": {
                    "status": "Created New",
                    "resolvedAt": datetime.utcnow(),
                    "newPatientId": str(result.inserted_id),
                }
            },
        )
        return serialize({"message": "Conflict resolved - new patient record created.", "newPatientId": result.inserted_id})
    except Exception:
        return error_response(500, "Failed to create new patient")


@router.put("/api/data-conflicts/{conflict_id}/cancel")
def cancel_data_conflict(conflict_id: str):
    try:
        conflict_oid = object_id(conflict_id)
        if not conflict_oid:
            return error_response(400, "Invalid conflict ID")

        conflict = database.db["dataConflicts"].find_one({"_id": conflict_oid})
        if not conflict:
            return error_response(404, "Conflict not found")

        database.db["dataConflicts"].update_one(
            {"_id": conflict_oid},
            {"$set": {"status": "Cancelled", "resolvedAt": datetime.utcnow()}},
        )
        return {"message": "Conflict cancelled - existing patient data kept unchanged."}
    except Exception:
        return error_response(500, "Failed to cancel conflict")


@router.get("/api/patient-portal/{national_id}")
def patient_portal(national_id: str):
    try:
        patient = database.db["patients"].find_one({"national_id": national_id})
        if not patient:
            return error_response(404, "No patient record found for this National ID.")
        return serialize(
            {
                "_id": patient.get("_id"),
                "name": patient.get("name"),
                "birth_date": patient.get("birth_date"),
                "gender": patient.get("gender"),
                "age": patient.get("age"),
                "national_id": patient.get("national_id"),
                "hospitals": patient.get("hospitals") or [],
                "primaryCondition": patient.get("primaryCondition"),
                "suggested": patient.get("suggested"),
                "urgency_level": patient.get("urgency_level") or "Medium",
                "recommended_mode": patient.get("recommended_mode") or "Offline",
                "hospitalRecords": patient.get("hospitalRecords") or {},
                "ingestedAt": patient.get("ingestedAt"),
            }
        )
    except Exception:
        return error_response(500, "Failed to fetch patient data")


@router.post("/api/feedback")
def create_feedback(body: Dict[str, Any] = Body(default_factory=dict)):
    try:
        rating = int(body.get("rating") or 0)
        if rating < 1 or rating > 5:
            return error_response(400, "Rating must be between 1 and 5.")
        if not body.get("patient_id") and not body.get("national_id"):
            return error_response(400, "Patient ID or National ID is required.")

        feedback = {
            "patient_id": body.get("patient_id") or None,
            "national_id": body.get("national_id") or None,
            "rating": rating,
            "comment": body.get("comment") or "",
            "createdAt": datetime.utcnow(),
        }
        result = database.db["feedback"].insert_one(feedback)
        return created({"message": "Feedback submitted successfully.", "id": result.inserted_id})
    except ValueError:
        return error_response(400, "Rating must be between 1 and 5.")
    except Exception:
        return error_response(500, "Failed to submit feedback")


@router.get("/api/feedback/{patient_id}")
def list_feedback(patient_id: str):
    try:
        feedback = list(
            database.db["feedback"]
            .find({"$or": [{"patient_id": patient_id}, {"national_id": patient_id}]})
            .sort("createdAt", -1)
        )
        return serialize(feedback)
    except Exception:
        return error_response(500, "Failed to fetch feedback")


@router.post("/api/analyst-notes")
def create_analyst_note(body: Dict[str, Any] = Body(default_factory=dict)):
    try:
        if not body.get("note"):
            return error_response(400, "Note content is required.")
        note = {
            "patient_id": body.get("patient_id") or None,
            "national_id": body.get("national_id") or None,
            "analyst_name": body.get("analyst_name") or "Analyst",
            "analyst_id": body.get("analyst_id") or None,
            "note": body.get("note"),
            "createdAt": datetime.utcnow(),
        }
        result = database.db["analyst_notes"].insert_one(note)
        return created({"message": "Analyst note saved.", "id": result.inserted_id, "note": note})
    except Exception:
        return error_response(500, "Failed to save analyst note")


@router.get("/api/analyst-notes/{patient_id}")
def list_analyst_notes(patient_id: str):
    try:
        notes = list(
            database.db["analyst_notes"]
            .find({"$or": [{"patient_id": patient_id}, {"national_id": patient_id}]})
            .sort("createdAt", -1)
        )
        return serialize(notes)
    except Exception:
        return error_response(500, "Failed to fetch analyst notes")


@router.post("/api/ai-notes")
def create_ai_note(body: Dict[str, Any] = Body(default_factory=dict)):
    try:
        if not body.get("note"):
            return error_response(400, "Note content is required.")
        note = {
            "patient_id": body.get("patient_id") or None,
            "national_id": body.get("national_id") or None,
            "note": body.get("note"),
            "createdAt": datetime.utcnow(),
        }
        result = database.db["ai_notes"].insert_one(note)
        return created({"message": "AI note saved.", "id": result.inserted_id, "note": note})
    except Exception:
        return error_response(500, "Failed to save AI note")


@router.get("/api/ai-notes/{patient_id}")
def list_ai_notes(patient_id: str):
    try:
        notes = list(
            database.db["ai_notes"]
            .find({"$or": [{"patient_id": patient_id}, {"national_id": patient_id}]})
            .sort("createdAt", -1)
        )
        return serialize(notes)
    except Exception:
        return error_response(500, "Failed to fetch AI notes")


@router.delete("/api/ai-notes/{note_id}")
def delete_ai_note(note_id: str):
    try:
        note_oid = object_id(note_id)
        if not note_oid:
            return error_response(400, "Invalid note ID")
        result = database.db["ai_notes"].delete_one({"_id": note_oid})
        if result.deleted_count == 0:
            return error_response(404, "Note not found")
        return {"message": "AI note deleted"}
    except Exception:
        return error_response(500, "Failed to delete AI note")


@router.post("/api/consultations")
def create_consultation(body: Dict[str, Any] = Body(default_factory=dict)):
    try:
        if not body.get("patient_id") and not body.get("national_id"):
            return error_response(400, "Patient ID or National ID is required.")

        consultation_type = body.get("type") or "Offline"
        consultation = {
            "patient_id": body.get("patient_id") or None,
            "national_id": body.get("national_id") or None,
            "analyst_id": body.get("analyst_id") or None,
            "proposed_by": body.get("proposed_by") or "patient",
            "type": consultation_type,
            "location": (body.get("location") or "Not Specified") if consultation_type == "Offline" else "Online link will be provided",
            "status": "Pending Approval",
            "payment_status": "Waiting Approval" if consultation_type == "Online" else "N/A",
            "amount": 150000 if consultation_type == "Online" else 0,
            "notes": body.get("notes") or "",
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow(),
        }
        result = database.db["consultations"].insert_one(consultation)
        return created({"message": "Consultation created.", "id": result.inserted_id, "consultation": consultation})
    except Exception:
        return error_response(500, "Failed to create consultation")


@router.put("/api/consultations/{consultation_id}/status")
def update_consultation_status(consultation_id: str, body: Dict[str, Any] = Body(default_factory=dict)):
    try:
        status = body.get("status")
        if not status:
            return error_response(400, "status is required.")
        consultation_oid = object_id(consultation_id)
        if not consultation_oid:
            return error_response(400, "Invalid consultation ID")

        consultation = database.db["consultations"].find_one({"_id": consultation_oid})
        if not consultation:
            return error_response(404, "Consultation not found")

        update_fields = {"status": status, "updatedAt": datetime.utcnow()}
        if status == "Scheduled" and consultation.get("type") == "Online":
            update_fields["payment_status"] = "Pending"

        result = database.db["consultations"].find_one_and_update(
            {"_id": consultation_oid},
            {"$set": update_fields},
            return_document=ReturnDocument.AFTER,
        )
        return serialize(result)
    except Exception:
        return error_response(500, "Failed to update status")


@router.post("/api/payment/simulate")
def simulate_payment(body: Dict[str, Any] = Body(default_factory=dict)):
    try:
        consultation_id = body.get("consultation_id")
        if not consultation_id:
            return error_response(400, "consultation_id is required.")
        consultation_oid = object_id(consultation_id)
        if not consultation_oid:
            return error_response(400, "Invalid consultation ID")

        result = database.db["consultations"].find_one_and_update(
            {"_id": consultation_oid},
            {"$set": {"payment_status": "Paid", "updatedAt": datetime.utcnow()}},
            return_document=ReturnDocument.AFTER,
        )
        if not result:
            return error_response(404, "Consultation not found.")
        return serialize({"message": "Payment simulated successfully.", "consultation": result})
    except Exception:
        return error_response(500, "Failed to simulate payment")


@router.get("/api/consultations/{patient_id}")
def list_consultations(patient_id: str):
    try:
        consultations = list(
            database.db["consultations"]
            .find({"$or": [{"patient_id": patient_id}, {"national_id": patient_id}]})
            .sort("createdAt", -1)
        )
        return serialize(consultations)
    except Exception:
        return error_response(500, "Failed to fetch consultations")
