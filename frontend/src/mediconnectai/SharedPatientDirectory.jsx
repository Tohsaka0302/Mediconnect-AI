import React, { useState, useEffect } from 'react';
import '../styles/spd.css';
import { Link } from 'react-router-dom';

const SharedPatientDirectory = () => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPatients = async () => {
      try {
        const response = await fetch('http://localhost:5000/patients');
        if (!response.ok) {
          throw new Error('Failed to fetch patients');
        }
        const data = await response.json();
        setPatients(data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching patients:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchPatients();
  }, []);

  return (
    <div className="shared-directory-container">
      <h1>📂 Shared Patient Directory</h1>

      {loading ? (
        <p style={{ color: 'var(--text-main)', textAlign: 'center' }}>Loading patient data...</p>
      ) : error ? (
        <p style={{ color: 'var(--accent-danger)', textAlign: 'center' }}>Error: {error}</p>
      ) : patients.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No shared patients available yet. Please share data from a hospital.</p>
      ) : (
        <table className="patient-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Illness / Condition</th>
              <th>Hospitals</th>
              <th>AI Suggestion</th>
              <th>Profile</th>
            </tr>
          </thead>
          <tbody>
            {patients.map((patient) => {
              // Normalize data differences between what frontend expected vs what Hospital A sends
              const illness = patient.illness || patient.condition || 'N/A';

              // Handle multiple hospitals format or single string
              let hospitalsList = [];
              if (Array.isArray(patient.hospitals)) {
                hospitalsList = patient.hospitals;
              } else if (patient.hospital) {
                hospitalsList = [patient.hospital];
              } else {
                hospitalsList = ['Unknown'];
              }

              const aiSuggestion = patient.suggested || 'Pending AI analysis';

              const patientId = patient._id || patient.id;

              return (
                <tr key={patientId}>
                  <td>{patient.name}</td>
                  <td>{illness}</td>
                  <td>{hospitalsList.join(', ')}</td>
                  <td>{aiSuggestion}</td>
                  <td>
                    <Link to={`/mediconnectai/patient/${patientId}`}>
                      View
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default SharedPatientDirectory;
