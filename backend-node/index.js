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

    // Get AI specialty suggestion
    const axios = require('axios');
    let suggestedSpecialty = 'Pending AI analysis';
    try {
      const conditionText = hospitalData.illness || hospitalData.condition || '';
      if (conditionText) {
        const aiResponse = await axios.post('http://127.0.0.1:8000/extract_specialty', { condition: conditionText });
        if (aiResponse.data?.specialty) suggestedSpecialty = aiResponse.data.specialty;
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
      const updateOp = {
        $set: {
          name: name || 'Unknown',
          birth_date: birth_date,
          gender: gender,
          age: age,
          national_id: nationalId,
          suggested: suggestedSpecialty,
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

    // Helper: run AI specialty extraction for one condition string
    const getSpecialty = async (conditionText) => {
      if (!conditionText) return 'Pending AI analysis';
      try {
        const aiResponse = await axios.post('http://127.0.0.1:8000/extract_specialty', { condition: conditionText }, { timeout: 5000 });
        return aiResponse.data?.specialty || 'Pending AI analysis';
      } catch {
        return 'Pending AI analysis';
      }
    };

    // Run AI calls in parallel with a concurrency limit of 5
    const CONCURRENCY = 5;
    const specialties = new Array(patientsArray.length).fill('Pending AI analysis');
    for (let i = 0; i < patientsArray.length; i += CONCURRENCY) {
      const batch = patientsArray.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map(p => getSpecialty(p.illness || p.condition || ''))
      );
      results.forEach((sp, j) => { specialties[i + j] = sp; });
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
          const suggestedSpecialty = specialties[idx];

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
                  suggested: suggestedSpecialty,
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
              suggested: suggestedSpecialty,
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
        const aiResponse = await axios.post('http://127.0.0.1:8000/extract_specialty', {
          condition: conditionText
        });
        const newSpecialty = aiResponse.data?.specialty || 'Internal Medicine';

        await db.collection('patients').updateOne(
          { _id: patient._id },
          { $set: { suggested: newSpecialty } }
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

