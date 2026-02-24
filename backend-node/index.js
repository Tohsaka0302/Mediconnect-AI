const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// --- NEW: API Key Security Middleware ---
const requireApiKey = (req, res, next) => {
  const providedKey = req.header('x-api-key');
  const expectedKey = process.env.EXPECTED_HOSPITAL_API_KEY;

  if (!providedKey || providedKey !== expectedKey) {
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
  } catch (error) {
    console.error('MongoDB connection error:', error);
  }
}

connectDB();

// Test Endpoint
app.get('/', (req, res) => {
  res.send('MediConnectAI Core Backend is Running!');
});

// Existing endpoint to get patients
app.get('/patients', async (req, res) => {
  try {
    const db = client.db('mediconnect');
    const patients = await db.collection('patients').find({}).toArray();
    res.json(patients);
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

// --- NEW: Ingestion Endpoint for Demo Hospital ---
app.post('/api/ingest-hospital-data', requireApiKey, async (req, res) => {
  try {
    const db = client.db('mediconnect');
    const hospitalData = req.body;

    // Validate that data was actually sent
    if (!hospitalData || Object.keys(hospitalData).length === 0) {
      return res.status(400).json({ error: 'No data provided in the request body.' });
    }

    // Add some metadata to track where it came from and when
    const payload = {
      ...hospitalData,
      source: 'demo_hospital',
      ingestedAt: new Date()
    };

    // Insert the single record into the patients collection
    const result = await db.collection('patients').insertOne(payload);

    res.status(201).json({
      message: 'Data successfully ingested from hospital.',
      insertedId: result.insertedId
    });

  } catch (error) {
    console.error('Ingestion error:', error);
    res.status(500).json({ error: 'Server error during data ingestion' });
  }
});

// --- Removal Requests Handling ---

// 1. Receive Request from Hospital
app.post('/api/removal-requests', requireApiKey, async (req, res) => {
  try {
    const db = client.db('mediconnect');
    const { hospitalRequestId, patientId, patientName, hospital } = req.body;

    if (!patientId) return res.status(400).json({ error: 'Patient ID is required' });

    // Securely pull the actual patient record instead of trusting the request body name
    let query = { id: patientId };
    try {
      if (patientId.length === 24) {
        const { ObjectId } = require('mongodb');
        query = { $or: [{ id: patientId }, { _id: patientId }, { _id: new ObjectId(patientId) }] };
      }
    } catch (e) { }

    const patient = await db.collection('patients').findOne(query);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found in the Mediconnect ecosystem' });
    }

    const newRequest = {
      hospitalRequestId, // To sync status back to hospital if needed
      patientId,
      patientName: patient.name, // Lock to actual clinical record name
      hospital,
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

    // Actually delete the patient data
    await db.collection('patients').deleteMany({ id: request.patientId });

    // Update request status
    await db.collection('removalRequests').updateOne(
      { _id: new ObjectId(requestId) },
      { $set: { status: 'Approved', updatedAt: new Date() } }
    );

    // Call the hospital's webhook to inform them
    // Note: In a production system, this URL would be dynamically looked up from a registry of hospital endpoints.
    // For this demonstration, we assume Hospital A is at localhost:8001
    const axios = require('axios');
    if (request.hospital === 'Hospital A') {
      axios.post('http://localhost:8001/api/webhook/unsync', {
        patientId: request.patientId
      }).then(() => {
        console.log(`Successfully notified ${request.hospital} of deletion.`);
      }).catch((webhookError) => {
        console.error(`Failed to notify ${request.hospital}:`, webhookError.message);
        // We don't fail the request here, but log the error
      });
    }

    res.json({ message: 'Request approved and patient data deleted' });
  } catch (error) {
    console.error('Error approving removal request:', error);
    res.status(500).json({ error: 'Failed to approve request' });
  }
});

// 4. Reject Request
app.put('/api/removal-requests/:id/reject', async (req, res) => {
  try {
    const db = client.db('mediconnect');
    const { ObjectId } = require('mongodb');
    const requestId = req.params.id;

    await db.collection('removalRequests').updateOne(
      { _id: new ObjectId(requestId) },
      { $set: { status: 'Rejected', updatedAt: new Date() } }
    );

    res.json({ message: 'Request rejected' });
  } catch (error) {
    console.error('Error rejecting removal request:', error);
    res.status(500).json({ error: 'Failed to reject request' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});