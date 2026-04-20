const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// --- API Key Security Middleware ---
// Accepts keys from any registered hospital
const VALID_API_KEYS = new Set([
  process.env.HOSPITAL_A_API_KEY || 'sk_test_12345hospitalA',
  process.env.HOSPITAL_B_API_KEY || 'sk_test_12345hospitalB',
]);

const requireApiKey = (req, res, next) => {
  const providedKey = req.header('x-api-key');
  if (!providedKey || !VALID_API_KEYS.has(providedKey)) {
    return res.status(403).json({ error: 'Access denied. Invalid or missing API key.' });
  }
  next();
};

// MongoDB Connection
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const client = new MongoClient(uri);

async function connectDB() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    // Ensure indexes for fast upsert lookups
    const db = client.db('mediconnect');
    await db.collection('patients').createIndex({ national_id: 1 }, { sparse: true });
    await db.collection('patients').createIndex({ 'hospitals': 1 });
    console.log('MongoDB indexes ensured.');
  } catch (error) {
    console.error('MongoDB connection error:', error);
  }
}

connectDB();

// Test Endpoint
app.get('/', (req, res) => {
  res.send('MediConnectAI Core Backend is Running!');
});

// --- Proxy /api/login to the Python auth backend (backend-ai) ---
app.post('/api/login', async (req, res) => {
  try {
    const axios = require('axios');
    const aiResponse = await axios.post('http://127.0.0.1:8001/api/login', req.body, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });
    res.status(aiResponse.status).json(aiResponse.data);
  } catch (err) {
    if (err.response) {
      // Forward the error from backend-ai as-is
      res.status(err.response.status).json(err.response.data);
    } else {
      console.error('Login proxy error:', err.message);
      res.status(503).json({ detail: 'Authentication service unavailable. Is backend-ai running?' });
    }
  }
});

// Existing endpoint to get patients, now dynamic based on role
app.get('/patients', async (req, res) => {
  try {
    const db = client.db('mediconnect');
    const { role, email } = req.query;
    console.log(`[DEBUG] Received req.query:`, req.query);

    let patients = await db.collection('patients').find({}).toArray();

    // If analyst, filter by specialty (works on top-level 'suggested' field)
    if (role === 'analyst' && email) {
      const analyst = await db.collection('analysts').findOne({ email });
      if (analyst && analyst.specialties) {
        const specialtiesList = analyst.specialties
          .split(',')
          .map(s => s.trim().toLowerCase())
          .filter(s => s.length > 0);
        patients = patients.filter(patient => {
          const suggested = (patient.suggested || '').toLowerCase();
          return specialtiesList.some(sp => suggested.includes(sp));
        });
      }
    }

    // Return list-friendly shape (omit hospitalRecords for performance)
    const list = patients.map(p => {
      // Support both new merged format (p.hospitals array) and legacy flat format (p.hospital = "A")
      const hospitalsList = (p.hospitals && p.hospitals.length > 0)
        ? p.hospitals
        : p.hospital
          ? [`Hospital ${p.hospital}`]
          : [];

      return {
        _id: p._id,
        id: p._id,
        national_id: p.national_id,
        name: p.name,
        birth_date: p.birth_date,
        gender: p.gender,
        age: p.age,
        condition: p.primaryCondition || p.condition || p.illness,
        illness: p.primaryCondition || p.illness || p.condition,
        hospitals: hospitalsList,
        hospital: hospitalsList.join(', ') || 'Unknown',
        suggested: p.suggested,
        urgency_level: p.urgency_level || 'Medium',
        recommended_mode: p.recommended_mode || 'Offline',
        ingestedAt: p.ingestedAt
      };
    });

    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Single patient lookup
app.get('/patients/:id', async (req, res) => {
  try {
    const db = client.db('mediconnect');
    const patientId = req.params.id;

    // Try finding by the custom string id first, then fallback to mongodb ObjectId if needed
    let query = { id: patientId };
    try {
      if (patientId.length === 24) { // valid hex length for objectId
        const { ObjectId } = require('mongodb');
        query = { $or: [{ id: patientId }, { _id: patientId }, { _id: new ObjectId(patientId) }] };
      }
    } catch (e) {
      // Ignored, just use the string id query
    }

    const patient = await db.collection('patients').findOne(query);

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    res.json(patient);
  } catch (error) {
    console.error('Error fetching single patient:', error);
    res.status(500).json({ error: 'Failed to fetch patient details' });
  }
});

// --- Ingestion Endpoint: Merges by national_id ---
app.post('/api/ingest-hospital-data', requireApiKey, async (req, res) => {
  try {
    const db = client.db('mediconnect');
    const hospitalData = req.body;

    if (!hospitalData || Object.keys(hospitalData).length === 0) {
      return res.status(400).json({ error: 'No data provided in the request body.' });
    }

    // Normalize hospital name — handle both 'A' and 'Hospital A' from different hospital backends
    const rawHospital = hospitalData.hospital || hospitalData.hospitalName || '';
    const hospitalName = rawHospital
      ? (rawHospital.toLowerCase().startsWith('hospital') ? rawHospital : `Hospital ${rawHospital}`)
      : 'Unknown';
    const nationalId = hospitalData.national_id;

    // Get AI triage: specialty + urgency + recommended mode
    const axios = require('axios');
    let suggestedSpecialty = 'Pending AI analysis';
    let urgencyLevel = 'Medium';
    let recommendedMode = 'Offline';
    try {
      const conditionText = hospitalData.illness || hospitalData.condition || '';
      if (conditionText) {
        const aiResponse = await axios.post('http://127.0.0.1:8001/extract_specialty', { condition: conditionText });
        if (aiResponse.data?.specialty) suggestedSpecialty = aiResponse.data.specialty;
        if (aiResponse.data?.urgency_level) urgencyLevel = aiResponse.data.urgency_level;
        if (aiResponse.data?.recommended_mode) recommendedMode = aiResponse.data.recommended_mode;
      }
    } catch (aiError) {
      console.error('AI specialty extraction failed:', aiError.message);
    }

    // Hospital-specific record (everything except top-level identity fields)
    const { name, birth_date, gender, age, national_id, hospital, ...rest } = hospitalData;
    const hospitalRecord = {
      ...rest,
      hospitalPatientId: hospitalData.id || hospitalData._id,
      ingestedAt: new Date()
    };

    if (nationalId) {
      // --- MERGE MODE: upsert by national_id ---
      const existing = await db.collection('patients').findOne({ national_id: nationalId });

      if (existing) {
        // --- CONFLICT DETECTION: compare identity fields ---
        const fieldsToCheck = ['name', 'birth_date', 'gender', 'age'];
        const incomingFields = { name: name || 'Unknown', birth_date, gender, age };
        const conflicts = [];
        for (const field of fieldsToCheck) {
          const existingVal = String(existing[field] || '');
          const incomingVal = String(incomingFields[field] || '');
          if (existingVal && incomingVal && existingVal !== incomingVal) {
            conflicts.push({ field, existingValue: existing[field], incomingValue: incomingFields[field] });
          }
        }

        if (conflicts.length > 0) {
          // Store conflict for admin review — do NOT auto-overwrite
          const conflictRecord = {
            national_id: nationalId,
            patientId: existing._id.toString(),
            existingPatientName: existing.name,
            incomingHospital: hospitalName,
            conflicts,
            incomingData: { name, birth_date, gender, age, condition: hospitalData.illness || hospitalData.condition },
            hospitalRecord,
            status: 'Pending',
            createdAt: new Date()
          };
          await db.collection('dataConflicts').insertOne(conflictRecord);

          // Still add the hospital record but don't overwrite identity fields
          await db.collection('patients').updateOne(
            { national_id: nationalId },
            {
              $set: {
                [`hospitalRecords.${hospitalName}`]: hospitalRecord,
                suggested: suggestedSpecialty,
                urgency_level: urgencyLevel,
                recommended_mode: recommendedMode,
                primaryCondition: hospitalData.illness || hospitalData.condition || 'N/A'
              },
              $addToSet: { hospitals: hospitalName }
            }
          );

          return res.status(201).json({
            message: `Data ingested from ${hospitalName} but identity conflicts detected. Awaiting admin review.`,
            patientId: existing._id,
            hasConflicts: true,
            conflictCount: conflicts.length
          });
        }
      }

      // No conflicts (or new patient) — normal upsert
      const updateOp = {
        $set: {
          name: name || 'Unknown',
          birth_date: birth_date,
          gender: gender,
          age: age,
          national_id: nationalId,
          suggested: suggestedSpecialty,
          urgency_level: urgencyLevel,
          recommended_mode: recommendedMode,
          primaryCondition: hospitalData.illness || hospitalData.condition || 'N/A',
          [`hospitalRecords.${hospitalName}`]: hospitalRecord
        },
        $addToSet: { hospitals: hospitalName },
        $setOnInsert: { ingestedAt: new Date() }
      };

      const result = await db.collection('patients').findOneAndUpdate(
        { national_id: nationalId },
        updateOp,
        { upsert: true, returnDocument: 'after' }
      );

      res.status(201).json({
        message: `Patient data merged for national_id ${nationalId} from ${hospitalName}.`,
        patientId: result._id
      });
    } else {
      // --- FALLBACK: no national_id — insert as standalone ---
      const payload = {
        ...hospitalData,
        suggested: suggestedSpecialty,
        urgency_level: urgencyLevel,
        recommended_mode: recommendedMode,
        primaryCondition: hospitalData.illness || hospitalData.condition || 'N/A',
        hospitals: [hospitalName],
        hospitalRecords: { [hospitalName]: hospitalRecord },
        ingestedAt: new Date()
      };
      const result = await db.collection('patients').insertOne(payload);
      res.status(201).json({ message: 'Data ingested (no national_id — inserted as new record).', insertedId: result.insertedId });
    }

  } catch (error) {
    console.error('Ingestion error:', error);
    res.status(500).json({ error: 'Failed to ingest hospital data.' });
  }
});

// --- Bulk Ingestion Endpoint: Accepts array of patients ---
// Replaces N sequential POSTs to /api/ingest-hospital-data with one batched request.
app.post('/api/ingest-hospital-data/bulk', requireApiKey, async (req, res) => {
  try {
    const db = client.db('mediconnect');
    const axios = require('axios');
    const patientsArray = req.body;

    if (!Array.isArray(patientsArray) || patientsArray.length === 0) {
      return res.status(400).json({ error: 'Request body must be a non-empty array of patients.' });
    }

    // Helper: run AI triage for one condition string — returns {specialty, urgency_level, recommended_mode}
    const getTriage = async (conditionText) => {
      const defaults = { specialty: 'Pending AI analysis', urgency_level: 'Medium', recommended_mode: 'Offline' };
      if (!conditionText) return defaults;
      try {
        const aiResponse = await axios.post('http://127.0.0.1:8001/extract_specialty', { condition: conditionText }, { timeout: 5000 });
        return {
          specialty: aiResponse.data?.specialty || defaults.specialty,
          urgency_level: aiResponse.data?.urgency_level || defaults.urgency_level,
          recommended_mode: aiResponse.data?.recommended_mode || defaults.recommended_mode
        };
      } catch {
        return defaults;
      }
    };

    // Run AI calls in parallel with a concurrency limit of 5
    const CONCURRENCY = 5;
    const triageResults = new Array(patientsArray.length).fill(null);
    for (let i = 0; i < patientsArray.length; i += CONCURRENCY) {
      const batch = patientsArray.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map(p => getTriage(p.illness || p.condition || ''))
      );
      results.forEach((tr, j) => { triageResults[i + j] = tr; });
    }

    // Build and run all DB upserts in parallel
    const upsertResults = await Promise.all(
      patientsArray.map(async (hospitalData, idx) => {
        try {
          const rawHospital = hospitalData.hospital || hospitalData.hospitalName || '';
          const hospitalName = rawHospital
            ? (rawHospital.toLowerCase().startsWith('hospital') ? rawHospital : `Hospital ${rawHospital}`)
            : 'Unknown';
          const nationalId = hospitalData.national_id;
          const triage = triageResults[idx];

          const { name, birth_date, gender, age, national_id, hospital, ...rest } = hospitalData;
          const hospitalRecord = {
            ...rest,
            hospitalPatientId: hospitalData.id || hospitalData._id,
            ingestedAt: new Date()
          };

          if (nationalId) {
            const result = await db.collection('patients').findOneAndUpdate(
              { national_id: nationalId },
              {
                $set: {
                  name: name || 'Unknown',
                  birth_date, gender, age,
                  national_id: nationalId,
                  suggested: triage.specialty,
                  urgency_level: triage.urgency_level,
                  recommended_mode: triage.recommended_mode,
                  primaryCondition: hospitalData.illness || hospitalData.condition || 'N/A',
                  [`hospitalRecords.${hospitalName}`]: hospitalRecord
                },
                $addToSet: { hospitals: hospitalName },
                $setOnInsert: { ingestedAt: new Date() }
              },
              { upsert: true, returnDocument: 'after' }
            );
            return { ok: true, patientId: result._id };
          } else {
            const payload = {
              ...hospitalData,
              suggested: triage.specialty,
              urgency_level: triage.urgency_level,
              recommended_mode: triage.recommended_mode,
              primaryCondition: hospitalData.illness || hospitalData.condition || 'N/A',
              hospitals: [hospitalName],
              hospitalRecords: { [hospitalName]: hospitalRecord },
              ingestedAt: new Date()
            };
            const result = await db.collection('patients').insertOne(payload);
            return { ok: true, patientId: result.insertedId };
          }
        } catch (err) {
          return { ok: false, error: err.message };
        }
      })
    );

    const succeeded = upsertResults.filter(r => r.ok).length;
    const failed = upsertResults.filter(r => !r.ok).length;

    res.status(201).json({
      message: `Bulk ingestion complete. ${succeeded} succeeded, ${failed} failed out of ${patientsArray.length}.`,
      results: upsertResults
    });
  } catch (error) {
    console.error('Bulk ingestion error:', error);
    res.status(500).json({ error: 'Failed to bulk ingest hospital data.' });
  }
});

// --- Removal Requests Handling ---


// 1. Receive Request from Hospital
app.post('/api/removal-requests', requireApiKey, async (req, res) => {
  try {
    const db = client.db('mediconnect');
    const { ObjectId } = require('mongodb');
    const { hospitalRequestId, patientId, patientName, hospital, national_id } = req.body;

    if (!patientId && !national_id) return res.status(400).json({ error: 'Patient ID or National ID is required' });

    // Normalize hospital name (same logic as ingestion)
    const rawHospital = hospital || '';
    const normalizedHospital = rawHospital
      ? (rawHospital.toLowerCase().startsWith('hospital') ? rawHospital : `Hospital ${rawHospital}`)
      : '';

    // Try to find the patient in MediConnect's DB to get its internal _id
    const orClauses = [];
    if (national_id) orClauses.push({ national_id });
    if (patientId) {
      if (normalizedHospital) {
        orClauses.push({ [`hospitalRecords.${normalizedHospital}.hospitalPatientId`]: patientId });
      }
      orClauses.push({ id: patientId });
      try {
        if (patientId.length === 24) {
          orClauses.push({ _id: new ObjectId(patientId) });
        }
      } catch (e) { }
    }

    const patient = orClauses.length > 0
      ? await db.collection('patients').findOne({ $or: orClauses })
      : null;

    // Save request regardless — use MediConnect patient _id if found, else use hospital patient ID
    const newRequest = {
      hospitalRequestId,
      patientId: patient ? patient._id.toString() : null,   // MediConnect internal ID (for approve/delete)
      hospitalPatientId: patientId,                          // Hospital-side ID (for reference & webhook)
      patientName: patient ? patient.name : (patientName || 'Unknown'),
      hospital: normalizedHospital || hospital,
      status: 'Pending MediConnect Approval',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('removalRequests').insertOne(newRequest);
    res.status(201).json({ message: 'Removal request received', id: result.insertedId });
  } catch (error) {
    console.error('Error receiving removal request:', error);
    res.status(500).json({ error: 'Failed to process removal request' });
  }
});


// 2. Get all requests (for MediConnect Admin UI)
app.get('/api/removal-requests', async (req, res) => {
  try {
    const db = client.db('mediconnect');
    const requests = await db.collection('removalRequests').find({}).sort({ createdAt: -1 }).toArray();
    res.json(requests);
  } catch (error) {
    console.error('Error fetching removal requests:', error);
    res.status(500).json({ error: 'Failed to fetch removal requests' });
  }
});

// 3. Approve Request (Deletes Patient Data and informs Hospital)
app.put('/api/removal-requests/:id/approve', async (req, res) => {
  try {
    const db = client.db('mediconnect');
    const { ObjectId } = require('mongodb');
    const requestId = req.params.id;

    const request = await db.collection('removalRequests').findOne({ _id: new ObjectId(requestId) });
    if (!request) return res.status(404).json({ error: 'Request not found' });

    // Remove only the requesting hospital's data from the merged record (if patient was found)
    if (request.patientId) {
      const { ObjectId: ObjId } = require('mongodb');
      const patient = await db.collection('patients').findOne({ _id: new ObjId(request.patientId) });
      if (patient) {
        const hospitalKey = request.hospital; // e.g. 'Hospital A'
        const updatedHospitals = (patient.hospitals || []).filter(h => h !== hospitalKey);

        if (updatedHospitals.length === 0) {
          // Last hospital — delete the entire patient record
          await db.collection('patients').deleteOne({ _id: new ObjId(request.patientId) });
        } else {
          // More hospitals remain — just remove this hospital's record
          await db.collection('patients').updateOne(
            { _id: new ObjId(request.patientId) },
            {
              $unset: { [`hospitalRecords.${hospitalKey}`]: '' },
              $pull: { hospitals: hospitalKey }
            }
          );
        }
      }
    }

    // Update request status
    await db.collection('removalRequests').updateOne(
      { _id: new ObjectId(requestId) },
      { $set: { status: 'Approved', updatedAt: new Date() } }
    );

    // Call the hospital's webhook to inform them of the deletion
    const axios = require('axios');
    const HOSPITAL_WEBHOOKS = {
      'Hospital A': 'http://localhost:8001/api/webhook/unsync',
      'Hospital B': 'http://localhost:8002/api/webhook/unsync',
    };
    const webhookUrl = HOSPITAL_WEBHOOKS[request.hospital];
    if (webhookUrl) {
      // Send the hospital's original patient ID so they can find it locally
      // request.hospitalPatientId is the hospital-side ID stored when removal request was created
      axios.post(webhookUrl, { patientId: request.hospitalPatientId || request.patientId })
        .then(() => console.log(`Successfully notified ${request.hospital} of deletion.`))
        .catch(err => console.error(`Failed to notify ${request.hospital}:`, err.message));
    } else {
      console.warn(`No webhook configured for hospital: ${request.hospital}`);
    }

    res.json({ message: 'Request approved and patient data deleted' });
  } catch (error) {
    console.error('Error approving removal request:', error);
    res.status(500).json({ error: 'Failed to approve request' });
  }
});

// 4. Reject Request — update status and notify originating hospital
app.put('/api/removal-requests/:id/reject', async (req, res) => {
  try {
    const db = client.db('mediconnect');
    const { ObjectId } = require('mongodb');
    const requestId = req.params.id;

    const request = await db.collection('removalRequests').findOne({ _id: new ObjectId(requestId) });
    if (!request) return res.status(404).json({ error: 'Request not found' });

    await db.collection('removalRequests').updateOne(
      { _id: new ObjectId(requestId) },
      { $set: { status: 'Rejected', updatedAt: new Date() } }
    );

    // Notify the originating hospital so it can update its local state
    const axios = require('axios');
    const HOSPITAL_REJECT_WEBHOOKS = {
      'Hospital A': 'http://localhost:8001/api/webhook/reject',
      'Hospital B': 'http://localhost:8002/api/webhook/reject',
    };
    const webhookUrl = HOSPITAL_REJECT_WEBHOOKS[request.hospital];
    if (webhookUrl) {
      axios.post(webhookUrl, { patientId: request.hospitalPatientId || request.patientId })
        .then(() => console.log(`Notified ${request.hospital} of rejection.`))
        .catch(err => console.error(`Failed to notify ${request.hospital} of rejection:`, err.message));
    }

    res.json({ message: 'Request rejected' });
  } catch (error) {
    console.error('Error rejecting removal request:', error);
    res.status(500).json({ error: 'Failed to reject request' });
  }
});

// ===============================================================
// --- ANALYST MANAGEMENT CRUD ---
// ===============================================================

// List all analysts
app.get('/api/analysts', async (req, res) => {
  try {
    const db = client.db('mediconnect');
    const analysts = await db.collection('analysts').find({}).toArray();
    const result = analysts.map(a => ({
      id: a._id.toString(),
      name: a.name,
      email: a.email,
      hospital: a.hospital,
      specialties: a.specialties,
      password: a.password
    }));
    res.json(result);
  } catch (error) {
    console.error('Error fetching analysts:', error);
    res.status(500).json({ error: 'Failed to fetch analysts' });
  }
});

// Create a new analyst
app.post('/api/analysts', async (req, res) => {
  try {
    const db = client.db('mediconnect');
    const { name, email, hospital, specialties } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required.' });
    }

    // Check for duplicate email
    const existing = await db.collection('analysts').findOne({ email });
    if (existing) {
      return res.status(409).json({ error: 'An analyst with this email already exists.' });
    }

    const newAnalyst = {
      name,
      email,
      hospital: hospital || 'A',
      specialties: specialties || '',
      password: 'analyst123',  // Default password
      role: 'analyst',
      createdAt: new Date()
    };

    const result = await db.collection('analysts').insertOne(newAnalyst);
    res.status(201).json({
      id: result.insertedId.toString(),
      ...newAnalyst
    });
  } catch (error) {
    console.error('Error creating analyst:', error);
    res.status(500).json({ error: 'Failed to create analyst' });
  }
});

// Update an analyst
app.put('/api/analysts/:id', async (req, res) => {
  try {
    const db = client.db('mediconnect');
    const { ObjectId } = require('mongodb');
    const analystId = req.params.id;
    const { specialties, hospital } = req.body;

    const updateFields = {};
    if (specialties !== undefined) updateFields.specialties = specialties;
    if (hospital !== undefined) updateFields.hospital = hospital;
    updateFields.updatedAt = new Date();

    const result = await db.collection('analysts').findOneAndUpdate(
      { _id: new ObjectId(analystId) },
      { $set: updateFields },
      { returnDocument: 'after' }
    );

    if (!result) {
      return res.status(404).json({ error: 'Analyst not found' });
    }

    res.json({
      id: result._id.toString(),
      name: result.name,
      email: result.email,
      hospital: result.hospital,
      specialties: result.specialties
    });
  } catch (error) {
    console.error('Error updating analyst:', error);
    res.status(500).json({ error: 'Failed to update analyst' });
  }
});

// Delete an analyst
app.delete('/api/analysts/:id', async (req, res) => {
  try {
    const db = client.db('mediconnect');
    const { ObjectId } = require('mongodb');
    const analystId = req.params.id;

    const result = await db.collection('analysts').deleteOne({ _id: new ObjectId(analystId) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Analyst not found' });
    }

    res.json({ message: 'Analyst deleted successfully' });
  } catch (error) {
    console.error('Error deleting analyst:', error);
    res.status(500).json({ error: 'Failed to delete analyst' });
  }
});

// --- Analyst Distribution Stats ---
// Returns each analyst with name, email, specialties, and count of matching patients
app.get('/api/analyst-stats', async (req, res) => {
  try {
    const db = client.db('mediconnect');
    const analysts = await db.collection('analysts').find({}).toArray();
    const patients = await db.collection('patients').find({}, { projection: { suggested: 1 } }).toArray();

    const stats = analysts.map(analyst => {
      const specialtiesList = (analyst.specialties || '')
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(s => s.length > 0);

      const count = patients.filter(p => {
        const suggested = (p.suggested || '').toLowerCase();
        return specialtiesList.some(sp => suggested.includes(sp));
      }).length;

      return {
        id: analyst._id.toString(),
        name: analyst.name,
        email: analyst.email,
        hospital: analyst.hospital,
        specialties: analyst.specialties,
        assignedPatientCount: count
      };
    });

    res.json(stats);
  } catch (error) {
    console.error('Error fetching analyst stats:', error);
    res.status(500).json({ error: 'Failed to fetch analyst stats' });
  }
});

// --- Re-tag existing patients with the new constrained specialties ---
// Call once after updating the AI prompt to update all existing patient records
app.post('/api/retag-patients', async (req, res) => {
  try {
    const db = client.db('mediconnect');
    const axios = require('axios');
    const patients = await db.collection('patients').find({}).toArray();

    let updated = 0;
    let failed = 0;

    for (const patient of patients) {
      // For merged documents, use primaryCondition; fall back to flat fields for legacy
      const conditionText = patient.primaryCondition || patient.illness || patient.condition || '';
      if (!conditionText) { failed++; continue; }

      try {
        const aiResponse = await axios.post('http://127.0.0.1:8001/extract_specialty', {
          condition: conditionText
        });
        const newSpecialty = aiResponse.data?.specialty || 'Internal Medicine';
        const newUrgency = aiResponse.data?.urgency_level || 'Medium';
        const newMode = aiResponse.data?.recommended_mode || 'Offline';

        await db.collection('patients').updateOne(
          { _id: patient._id },
          { $set: { suggested: newSpecialty, urgency_level: newUrgency, recommended_mode: newMode } }
        );
        updated++;
      } catch (err) {
        console.error(`Failed to retag patient ${patient.name}:`, err.message);
        failed++;
      }
    }

    res.json({
      message: `Retagging complete. Updated: ${updated}, Failed: ${failed}, Total: ${patients.length}`
    });
  } catch (error) {
    console.error('Error retagging patients:', error);
    res.status(500).json({ error: 'Failed to retag patients' });
  }
});

// ===============================================================
// --- DATA CONFLICT MANAGEMENT ---
// ===============================================================

// List all pending data conflicts (for Admin UI)
app.get('/api/data-conflicts', async (req, res) => {
  try {
    const db = client.db('mediconnect');
    const conflicts = await db.collection('dataConflicts').find({}).sort({ createdAt: -1 }).toArray();
    res.json(conflicts);
  } catch (error) {
    console.error('Error fetching data conflicts:', error);
    res.status(500).json({ error: 'Failed to fetch data conflicts' });
  }
});

// Approve conflict — overwrite existing patient with incoming data
app.put('/api/data-conflicts/:id/approve', async (req, res) => {
  try {
    const db = client.db('mediconnect');
    const { ObjectId } = require('mongodb');
    const conflictId = req.params.id;

    const conflict = await db.collection('dataConflicts').findOne({ _id: new ObjectId(conflictId) });
    if (!conflict) return res.status(404).json({ error: 'Conflict not found' });

    // Overwrite the patient's identity fields with incoming data
    const updateFields = {};
    if (conflict.incomingData.name) updateFields.name = conflict.incomingData.name;
    if (conflict.incomingData.birth_date) updateFields.birth_date = conflict.incomingData.birth_date;
    if (conflict.incomingData.gender) updateFields.gender = conflict.incomingData.gender;
    if (conflict.incomingData.age) updateFields.age = conflict.incomingData.age;

    await db.collection('patients').updateOne(
      { _id: new ObjectId(conflict.patientId) },
      { $set: updateFields }
    );

    // Mark conflict as resolved
    await db.collection('dataConflicts').updateOne(
      { _id: new ObjectId(conflictId) },
      { $set: { status: 'Approved', resolvedAt: new Date() } }
    );

    res.json({ message: 'Conflict resolved — patient updated with incoming data.' });
  } catch (error) {
    console.error('Error approving conflict:', error);
    res.status(500).json({ error: 'Failed to approve conflict' });
  }
});

// Create New — insert incoming data as a separate patient record
app.put('/api/data-conflicts/:id/create-new', async (req, res) => {
  try {
    const db = client.db('mediconnect');
    const { ObjectId } = require('mongodb');
    const conflictId = req.params.id;

    const conflict = await db.collection('dataConflicts').findOne({ _id: new ObjectId(conflictId) });
    if (!conflict) return res.status(404).json({ error: 'Conflict not found' });

    // Create a brand-new patient from the incoming data
    const newPatient = {
      name: conflict.incomingData.name || 'Unknown',
      birth_date: conflict.incomingData.birth_date,
      gender: conflict.incomingData.gender,
      age: conflict.incomingData.age,
      national_id: conflict.national_id + '_dup',
      primaryCondition: conflict.incomingData.condition || 'N/A',
      hospitals: [conflict.incomingHospital],
      hospitalRecords: { [conflict.incomingHospital]: conflict.hospitalRecord },
      suggested: 'Pending AI analysis',
      urgency_level: 'Medium',
      recommended_mode: 'Offline',
      ingestedAt: new Date()
    };

    const result = await db.collection('patients').insertOne(newPatient);

    // Also remove the incoming hospital from the original patient to avoid duplication
    await db.collection('patients').updateOne(
      { _id: new ObjectId(conflict.patientId) },
      {
        $unset: { [`hospitalRecords.${conflict.incomingHospital}`]: '' },
        $pull: { hospitals: conflict.incomingHospital }
      }
    );

    // Mark conflict as resolved
    await db.collection('dataConflicts').updateOne(
      { _id: new ObjectId(conflictId) },
      { $set: { status: 'Created New', resolvedAt: new Date(), newPatientId: result.insertedId.toString() } }
    );

    res.json({ message: 'Conflict resolved — new patient record created.', newPatientId: result.insertedId });
  } catch (error) {
    console.error('Error creating new patient from conflict:', error);
    res.status(500).json({ error: 'Failed to create new patient' });
  }
});

// Cancel conflict — keep existing data, discard incoming identity changes
app.put('/api/data-conflicts/:id/cancel', async (req, res) => {
  try {
    const db = client.db('mediconnect');
    const { ObjectId } = require('mongodb');
    const conflictId = req.params.id;

    const conflict = await db.collection('dataConflicts').findOne({ _id: new ObjectId(conflictId) });
    if (!conflict) return res.status(404).json({ error: 'Conflict not found' });

    // Just mark as cancelled — existing data remains unchanged
    await db.collection('dataConflicts').updateOne(
      { _id: new ObjectId(conflictId) },
      { $set: { status: 'Cancelled', resolvedAt: new Date() } }
    );

    res.json({ message: 'Conflict cancelled — existing patient data kept unchanged.' });
  } catch (error) {
    console.error('Error cancelling conflict:', error);
    res.status(500).json({ error: 'Failed to cancel conflict' });
  }
});

// ===============================================================
// --- PATIENT PORTAL (self-lookup by national_id) ---
// ===============================================================

app.get('/api/patient-portal/:nationalId', async (req, res) => {
  try {
    const db = client.db('mediconnect');
    const nationalId = req.params.nationalId;

    const patient = await db.collection('patients').findOne({ national_id: nationalId });
    if (!patient) return res.status(404).json({ error: 'No patient record found for this National ID.' });

    // Return full patient data including AI triage results
    res.json({
      _id: patient._id,
      name: patient.name,
      birth_date: patient.birth_date,
      gender: patient.gender,
      age: patient.age,
      national_id: patient.national_id,
      hospitals: patient.hospitals || [],
      primaryCondition: patient.primaryCondition,
      suggested: patient.suggested,
      urgency_level: patient.urgency_level || 'Medium',
      recommended_mode: patient.recommended_mode || 'Offline',
      hospitalRecords: patient.hospitalRecords || {},
      ingestedAt: patient.ingestedAt
    });
  } catch (error) {
    console.error('Error fetching patient portal:', error);
    res.status(500).json({ error: 'Failed to fetch patient data' });
  }
});

// ===============================================================
// --- PATIENT FEEDBACK ---
// ===============================================================

// Submit feedback
app.post('/api/feedback', async (req, res) => {
  try {
    const db = client.db('mediconnect');
    const { patient_id, national_id, rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
    }
    if (!patient_id && !national_id) {
      return res.status(400).json({ error: 'Patient ID or National ID is required.' });
    }

    const feedback = {
      patient_id: patient_id || null,
      national_id: national_id || null,
      rating: parseInt(rating),
      comment: comment || '',
      createdAt: new Date()
    };

    const result = await db.collection('feedback').insertOne(feedback);
    res.status(201).json({ message: 'Feedback submitted successfully.', id: result.insertedId });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

// Get feedback for a patient
app.get('/api/feedback/:patientId', async (req, res) => {
  try {
    const db = client.db('mediconnect');
    const patientId = req.params.patientId;

    // Search by either patient_id string or national_id
    const feedbackList = await db.collection('feedback').find({
      $or: [{ patient_id: patientId }, { national_id: patientId }]
    }).sort({ createdAt: -1 }).toArray();

    res.json(feedbackList);
  } catch (error) {
    console.error('Error fetching feedback:', error);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// ===============================================================
// --- ANALYST NOTES / FEEDBACK ---
// ===============================================================

// Save an analyst note
app.post('/api/analyst-notes', async (req, res) => {
  try {
    const db = client.db('mediconnect');
    const { patient_id, national_id, analyst_name, analyst_id, note } = req.body;

    if (!note) return res.status(400).json({ error: 'Note content is required.' });

    const analystNote = {
      patient_id: patient_id || null,
      national_id: national_id || null,
      analyst_name: analyst_name || 'Analyst',
      analyst_id: analyst_id || null,
      note,
      createdAt: new Date()
    };

    const result = await db.collection('analyst_notes').insertOne(analystNote);
    res.status(201).json({ message: 'Analyst note saved.', id: result.insertedId, note: analystNote });
  } catch (error) {
    console.error('Error saving analyst note:', error);
    res.status(500).json({ error: 'Failed to save analyst note' });
  }
});

// Get analyst notes for a patient
app.get('/api/analyst-notes/:patientId', async (req, res) => {
  try {
    const db = client.db('mediconnect');
    const patientId = req.params.patientId;

    const notesList = await db.collection('analyst_notes').find({
      $or: [{ patient_id: patientId }, { national_id: patientId }]
    }).sort({ createdAt: -1 }).toArray();

    res.json(notesList);
  } catch (error) {
    console.error('Error fetching analyst notes:', error);
    res.status(500).json({ error: 'Failed to fetch analyst notes' });
  }
});

// ===============================================================
// --- AI NOTES ---
// ===============================================================

// Save an AI note
app.post('/api/ai-notes', async (req, res) => {
  try {
    const db = client.db('mediconnect');
    const { patient_id, national_id, note } = req.body;

    if (!note) return res.status(400).json({ error: 'Note content is required.' });

    const aiNote = {
      patient_id: patient_id || null,
      national_id: national_id || null,
      note,
      createdAt: new Date()
    };

    const result = await db.collection('ai_notes').insertOne(aiNote);
    res.status(201).json({ message: 'AI note saved.', id: result.insertedId, note: aiNote });
  } catch (error) {
    console.error('Error saving AI note:', error);
    res.status(500).json({ error: 'Failed to save AI note' });
  }
});

// Get AI notes for a patient
app.get('/api/ai-notes/:patientId', async (req, res) => {
  try {
    const db = client.db('mediconnect');
    const patientId = req.params.patientId;

    const notesList = await db.collection('ai_notes').find({
      $or: [{ patient_id: patientId }, { national_id: patientId }]
    }).sort({ createdAt: -1 }).toArray();

    res.json(notesList);
  } catch (error) {
    console.error('Error fetching AI notes:', error);
    res.status(500).json({ error: 'Failed to fetch AI notes' });
  }
});

// Delete an AI note
app.delete('/api/ai-notes/:id', async (req, res) => {
  try {
    const db = client.db('mediconnect');
    const { ObjectId } = require('mongodb');
    const { id } = req.params;

    const result = await db.collection('ai_notes').deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Note not found' });
    
    res.json({ message: 'AI note deleted' });
  } catch (error) {
    console.error('Error deleting AI note:', error);
    res.status(500).json({ error: 'Failed to delete AI note' });
  }
});


// ===============================================================
// --- MOCK PAYMENT / CONSULTATIONS ---
// ===============================================================

// Create a consultation
app.post('/api/consultations', async (req, res) => {
  try {
    const db = client.db('mediconnect');
    const { patient_id, national_id, analyst_id, type, notes, proposed_by, location } = req.body;

    if (!patient_id && !national_id) {
      return res.status(400).json({ error: 'Patient ID or National ID is required.' });
    }

    const consultation = {
      patient_id: patient_id || null,
      national_id: national_id || null,
      analyst_id: analyst_id || null,
      proposed_by: proposed_by || 'patient', // 'patient' or 'analyst'
      type: type || 'Offline',  // Online or Offline
      location: type === 'Offline' ? (location || 'Not Specified') : 'Online link will be provided',
      status: 'Pending Approval',
      payment_status: type === 'Online' ? 'Waiting Approval' : 'N/A',
      amount: type === 'Online' ? 150000 : 0,   // Mock amount in VND
      notes: notes || '',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('consultations').insertOne(consultation);
    res.status(201).json({ message: 'Consultation created.', id: result.insertedId, consultation });
  } catch (error) {
    console.error('Error creating consultation:', error);
    res.status(500).json({ error: 'Failed to create consultation' });
  }
});

// Approve or Decline a consultation
app.put('/api/consultations/:id/status', async (req, res) => {
  try {
    const db = client.db('mediconnect');
    const { ObjectId } = require('mongodb');
    const { id } = req.params;
    const { status } = req.body; // 'Scheduled' or 'Declined'

    if (!status) return res.status(400).json({ error: 'status is required.' });

    // Fetch the consultation to see its type
    const consultation = await db.collection('consultations').findOne({ _id: new ObjectId(id) });
    if (!consultation) return res.status(404).json({ error: 'Consultation not found' });

    const updateFields = { status, updatedAt: new Date() };

    // If accepted and it's online, advance payment status to Pending
    if (status === 'Scheduled' && consultation.type === 'Online') {
      updateFields.payment_status = 'Pending';
    }

    const result = await db.collection('consultations').findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateFields },
      { returnDocument: 'after' } // return the updated doc
    );

    res.json(result);
  } catch (error) {
    console.error('Error updating consultation status:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// Simulate payment — toggle payment_status to "Paid"
app.post('/api/payment/simulate', async (req, res) => {
  try {
    const db = client.db('mediconnect');
    const { ObjectId } = require('mongodb');
    const { consultation_id } = req.body;

    if (!consultation_id) return res.status(400).json({ error: 'consultation_id is required.' });

    const result = await db.collection('consultations').findOneAndUpdate(
      { _id: new ObjectId(consultation_id) },
      { $set: { payment_status: 'Paid', updatedAt: new Date() } },
      { returnDocument: 'after' }
    );

    if (!result) return res.status(404).json({ error: 'Consultation not found.' });

    res.json({ message: 'Payment simulated successfully.', consultation: result });
  } catch (error) {
    console.error('Error simulating payment:', error);
    res.status(500).json({ error: 'Failed to simulate payment' });
  }
});

// List consultations for a patient
app.get('/api/consultations/:patientId', async (req, res) => {
  try {
    const db = client.db('mediconnect');
    const patientId = req.params.patientId;

    const consultations = await db.collection('consultations').find({
      $or: [{ patient_id: patientId }, { national_id: patientId }]
    }).sort({ createdAt: -1 }).toArray();

    res.json(consultations);
  } catch (error) {
    console.error('Error fetching consultations:', error);
    res.status(500).json({ error: 'Failed to fetch consultations' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

