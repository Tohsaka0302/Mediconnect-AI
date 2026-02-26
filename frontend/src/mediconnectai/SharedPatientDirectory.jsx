import React, { useState, useEffect } from 'react';
import '../styles/spd.css';
import { Link } from 'react-router-dom';

// Maps specialty names to colors for visual pills
const SPECIALTY_COLORS = {
  cardiology: '#e74c3c',
  neurology: '#9b59b6',
  orthopedics: '#3498db',
  oncology: '#e67e22',
  pediatrics: '#2ecc71',
  dermatology: '#1abc9c',
  psychiatry: '#f39c12',
  endocrinology: '#d35400',
  gastroenterology: '#27ae60',
  pulmonology: '#2980b9',
  nephrology: '#8e44ad',
  hematology: '#c0392b',
  rheumatology: '#16a085',
  ophthalmology: '#2c3e50',
  urology: '#7f8c8d',
};

const getSpecialtyColor = (specialty = '') => {
  const key = specialty.toLowerCase().split(' ')[0];
  return SPECIALTY_COLORS[key] || '#764bff';
};

const SharedPatientDirectory = () => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analystProfile, setAnalystProfile] = useState(null);
  const [search, setSearch] = useState('');

  const user = JSON.parse(localStorage.getItem('user'));

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch patients (filtered by backend if analyst)
        let fetchUrl = 'http://localhost:5000/patients';
        if (user) {
          fetchUrl += `?email=${encodeURIComponent(user.email)}&role=${encodeURIComponent(user.role)}`;
        }

        const [patientRes] = await Promise.all([fetch(fetchUrl)]);

        if (!patientRes.ok) throw new Error('Failed to fetch patients');
        const patientData = await patientRes.json();
        setPatients(patientData);

        // If analyst, also fetch their profile to display specialties
        if (user?.role === 'analyst') {
          try {
            const profileRes = await fetch(
              `http://localhost:8000/api/analysts/by-email/${encodeURIComponent(user.email)}`
            );
            if (profileRes.ok) {
              setAnalystProfile(await profileRes.json());
            }
          } catch (_) {
            // Profile fetch is optional — don't block on failure
          }
        }
      } catch (err) {
        console.error('Error fetching patients:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const specialtyList = analystProfile?.specialties
    ? analystProfile.specialties.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  const filtered = patients.filter(p => {
    const q = search.toLowerCase();
    if (!q) return true;
    const name = (p.name || '').toLowerCase();
    const cond = (p.condition || p.illness || '').toLowerCase();
    return name.includes(q) || cond.includes(q);
  });

  return (
    <div className="shared-directory-container">
      <div className="spd-header">
        <div>
          <h1>📂 Shared Patient Directory</h1>
          {user?.role === 'analyst' && (
            <p className="spd-role-hint">
              Showing patients assigned to your specialties
            </p>
          )}
        </div>

        {/* Analyst specialty banner */}
        {user?.role === 'analyst' && specialtyList.length > 0 && (
          <div className="analyst-specialty-banner">
            <span className="banner-label">Your Specialties</span>
            <div className="specialty-pills">
              {specialtyList.map(sp => (
                <span
                  key={sp}
                  className="specialty-pill"
                  style={{ background: getSpecialtyColor(sp) }}
                >
                  {sp}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Search bar */}
      <div className="spd-search-bar">
        <input
          type="text"
          placeholder="🔍  Search by name or condition..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="spd-status-msg">Loading patient data...</p>
      ) : error ? (
        <p className="spd-status-msg spd-error">Error: {error}</p>
      ) : filtered.length === 0 ? (
        <p className="spd-status-msg">
          {search ? 'No patients match your search.' : 'No shared patients available yet.'}
        </p>
      ) : (
        <table className="patient-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Illness / Condition</th>
              <th>Hospital</th>
              <th>AI Specialty</th>
              <th>Profile</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(patient => {
              const illness = patient.illness || patient.condition || 'N/A';
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
                  <td className="patient-name-cell">{patient.name}</td>
                  <td>{illness}</td>
                  <td>{hospitalsList.join(', ')}</td>
                  <td>
                    <span
                      className="specialty-pill"
                      style={{ background: getSpecialtyColor(aiSuggestion) }}
                    >
                      {aiSuggestion}
                    </span>
                  </td>
                  <td>
                    <Link className="view-link" to={`/mediconnectai/patient/${patientId}`}>
                      View →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {!loading && !error && (
        <p className="spd-count">
          Showing <strong>{filtered.length}</strong> of <strong>{patients.length}</strong> patients
        </p>
      )}
    </div>
  );
};

export default SharedPatientDirectory;
