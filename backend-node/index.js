const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

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

// Example endpoint to get patients
app.get('/patients', async (req, res) => {
  try {
    const db = client.db('mediconnect');
    const patients = await db.collection('patients').find({}).toArray();
    res.json(patients);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});