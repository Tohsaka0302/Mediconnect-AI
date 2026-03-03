import React, { useState, useEffect } from 'react';
import '../styles/hospitaloverview.css';

const HospitalOverview = () => {
  const [hospitalStats, setHospitalStats] = useState([]);
  const [analystStats, setAnalystStats] = useState([]);
  const [totalUniquePatients, setTotalUniquePatients] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [patientsRes, analystRes] = await Promise.all([
          fetch('http://localhost:5000/patients'),
          fetch('http://localhost:5000/api/analyst-stats')
        ]);

        if (!patientsRes.ok) throw new Error('Failed to fetch patients');

        const patients = await patientsRes.json();
        setTotalUniquePatients(patients.length);

        // Group patients by hospital
        const hospitalMap = {};
        patients.forEach(p => {
          const hospitalArray = Array.isArray(p.hospitals) && p.hospitals.length > 0
            ? p.hospitals
            : [p.hospital || 'Unknown'];

          hospitalArray.forEach(hosp => {
            if (!hospitalMap[hosp]) {
              hospitalMap[hosp] = { sharedRecords: 0, lastUpdated: null };
            }
            hospitalMap[hosp].sharedRecords++;
            const ingested = p.ingestedAt ? new Date(p.ingestedAt) : null;
            if (ingested && (!hospitalMap[hosp].lastUpdated || ingested > hospitalMap[hosp].lastUpdated)) {
              hospitalMap[hosp].lastUpdated = ingested;
            }
          });
        });

        const hStats = Object.entries(hospitalMap).map(([name, data]) => ({
          name,
          sharedRecords: data.sharedRecords,
          lastUpdated: data.lastUpdated
            ? data.lastUpdated.toLocaleDateString()
            : '—'
        })).sort((a, b) => a.name.localeCompare(b.name));

        setHospitalStats(hStats);

        if (analystRes.ok) {
          setAnalystStats(await analystRes.json());
        }
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) return (
    <div className="overview-container">
      <h1>🏥 Hospital Data Overview</h1>
      <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Loading stats...</p>
    </div>
  );

  if (error) return (
    <div className="overview-container">
      <h1>🏥 Hospital Data Overview</h1>
      <p style={{ color: 'var(--accent-danger)', textAlign: 'center' }}>Error: {error}</p>
    </div>
  );

  return (
    <div className="overview-container">
      <h1>🏥 Hospital Data Overview</h1>

      {/* Summary Cards */}
      <div className="overview-cards">
        <div className="overview-card">
          <span className="card-value">{totalUniquePatients}</span>
          <span className="card-label">Total Shared Patients</span>
        </div>
        <div className="overview-card">
          <span className="card-value">{hospitalStats.length}</span>
          <span className="card-label">Connected Hospitals</span>
        </div>
        <div className="overview-card">
          <span className="card-value">{analystStats.length}</span>
          <span className="card-label">Active Analysts</span>
        </div>
      </div>

      {/* Hospital Records Table */}
      <h2 className="section-title">Shared Records by Hospital</h2>
      {hospitalStats.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
          No shared patients yet. Share data from a hospital to see it here.
        </p>
      ) : (
        <table className="overview-table">
          <thead>
            <tr>
              <th>Hospital</th>
              <th>Records Shared</th>
              <th>Last Ingested</th>
            </tr>
          </thead>
          <tbody>
            {hospitalStats.map((hospital, index) => (
              <tr key={index}>
                <td>{hospital.name}</td>
                <td>
                  <span className="record-count">{hospital.sharedRecords}</span>
                </td>
                <td>{hospital.lastUpdated}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Analyst Distribution Table */}
      {analystStats.length > 0 && (
        <>
          <h2 className="section-title">Analyst Distribution</h2>
          <table className="overview-table">
            <thead>
              <tr>
                <th>Analyst</th>
                <th>Email</th>
                <th>Specialties</th>
                <th>Assigned Patients</th>
              </tr>
            </thead>
            <tbody>
              {analystStats.map(analyst => (
                <tr key={analyst.id}>
                  <td>{analyst.name}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{analyst.email}</td>
                  <td>{analyst.specialties || '—'}</td>
                  <td>
                    <span className="record-count">{analyst.assignedPatientCount}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
};

export default HospitalOverview;
