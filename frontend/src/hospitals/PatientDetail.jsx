import React from 'react';
import '../styles/dashboard.css';
import { useParams } from 'react-router-dom';

const PatientDetail = () => {
  const { id } = useParams(); 

  const patient = {
    full_name: 'John Doe',
    birth_date: '1990-05-12',
    gender: 'male',
    national_id: 'ABC123456',
    visits: [
      {
        date: '2025-04-01',
        doctor: 'Dr. Smith',
        notes: 'Patient had high fever and cough.',
        treatments: ['Paracetamol', 'Rest & hydration']
      },
      {
        date: '2025-04-15',
        doctor: 'Dr. Lee',
        notes: 'Symptoms improved. Mild fatigue reported.',
        treatments: ['Vitamin B supplements']
      }
    ]
  };

  return (
    <div className="dashboard">
      <h1>👤 Patient Detail</h1>

      <div className="stat-card">
        <p><strong>Name:</strong> {patient.full_name}</p>
        <p><strong>Birth Date:</strong> {patient.birth_date}</p>
        <p><strong>Gender:</strong> {patient.gender}</p>
        <p><strong>National ID:</strong> {patient.national_id}</p>
      </div>

      <h2 style={{ marginTop: '2rem' }}>🩺 Visit History</h2>

      {patient.visits.map((visit, index) => (
        <div key={index} className="stat-card" style={{ background: '#f9f9f9' }}>
          <p><strong>Date:</strong> {visit.date}</p>
          <p><strong>Doctor:</strong> {visit.doctor}</p>
          <p><strong>Notes:</strong> {visit.notes}</p>
          <p><strong>Treatments:</strong></p>
          <ul>
            {visit.treatments.map((treatment, i) => (
              <li key={i}>{treatment}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

export default PatientDetail;
