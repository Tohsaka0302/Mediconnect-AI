import React, { useState, useEffect } from 'react';
import '../styles/spd.css';
import { Link } from 'react-router-dom';
import { authFetch } from '../utils/authFetch';

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
  const [analysts, setAnalysts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analystProfile, setAnalystProfile] = useState(null);
  const [search, setSearch] = useState('');
  const [searchNationalId, setSearchNationalId] = useState('');
  const [analystFilter, setAnalystFilter] = useState('All');

  const user = JSON.parse(localStorage.getItem('user'));

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch patients (filtered by backend if analyst)
        let fetchUrl = 'http://localhost:5000/patients';
        if (user) {
          fetchUrl += `?email=${encodeURIComponent(user.email)}&role=${encodeURIComponent(user.role)}`;
        }

        const [patientRes, analystRes] = await Promise.all([
          fetch(fetchUrl),
          authFetch('/api/analysts')
        ]);

        if (!patientRes.ok) throw new Error('Failed to fetch patients');
        const patientData = await patientRes.json();
        setPatients(patientData);

        if (analystRes.ok) {
          const analystData = await analystRes.json();
          setAnalysts(analystData);
        }

        // If analyst, also fetch their profile to display specialties
        if (user?.role === 'analyst') {
          try {
            const profileRes = await authFetch(
              `/api/analysts/by-email/${encodeURIComponent(user.email)}`
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
  }, [user]);

  const specialtyList = analystProfile?.specialties
    ? analystProfile.specialties.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  const filtered = patients.filter(p => {
    // 1. Text Search (Name/Condition)
    const q = search.toLowerCase();
    const name = (p.name || '').toLowerCase();
    const cond = (p.condition || p.illness || '').toLowerCase();
    const matchesSearch = !q || name.includes(q) || cond.includes(q);

    // 2. National ID Search
    const nidQ = searchNationalId.toLowerCase();
    const nid = (p.national_id || '').toLowerCase();
    const matchesNationalId = !nidQ || nid.includes(nidQ);

    // 3. Analyst Assignment Filter
    let matchesAnalyst = true;
    if (analystFilter !== 'All') {
      const pSuggested = (p.suggested || '').toLowerCase();

      if (analystFilter === 'Unassigned') {
        // Unassigned if this patient's suggested specialty doesn't match any known analyst's specialty
        matchesAnalyst = !analysts.some(a => {
          const aSpecs = (a.specialties || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
          return aSpecs.some(sp => pSuggested.includes(sp));
        });
      } else {
        // Specific analyst selected
        const selectedAnalyst = analysts.find(a => a.id === analystFilter);
        if (selectedAnalyst) {
          const aSpecs = (selectedAnalyst.specialties || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
          matchesAnalyst = aSpecs.some(sp => pSuggested.includes(sp));
        } else {
          matchesAnalyst = false;
        }
      }
    }

    return matchesSearch && matchesNationalId && matchesAnalyst;
  });

  return (
    <div className="shared-directory-container page-shell">
      <div className="spd-header">
        <div>
          <h1>Shared Patient Directory</h1>
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

      {/* Search and Filters */}
      <div className="spd-search-bar">
        <input
          type="text"
          className="modern-input"
          placeholder="Search by name or condition..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <input
          type="text"
          className="modern-input"
          placeholder="Search by National ID..."
          value={searchNationalId}
          onChange={e => setSearchNationalId(e.target.value)}
        />
        <select
          className="modern-input"
          value={analystFilter}
          onChange={e => setAnalystFilter(e.target.value)}
        >
          <option value="All">All Patients</option>
          <option value="Unassigned">Unassigned (Action Needed)</option>
          {analysts.map(a => (
            <option key={a.id} value={a.id}>Assigned to: {a.name}</option>
          ))}
        </select>
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
        <div className="patient-list">
          <div className="glass-row-header">
            <div>Patient Identity</div>
            <div>Primary Condition</div>
            <div>Origin Node</div>
            <div>AI Blueprint</div>
            <div>Urgency</div>
            <div>Protocol</div>
            <div style={{textAlign: 'center'}}>Action</div>
          </div>
          <div className="glass-rows-container">
            {filtered.map((patient, index) => {
              const illness = patient.illness || patient.condition || 'Pending Assessment';
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
              
              const urgency = patient.urgency_level || 'Medium';
              const urgencyClass = urgency === 'High' ? 'badge-high' : urgency === 'Medium' ? 'badge-medium' : 'badge-low';
              
              const mode = patient.recommended_mode || 'Offline';
              const modeClass = mode === 'Online' ? 'badge-online' : 'badge-offline';

              return (
                <div key={patientId} className="glass-row fade-in-up" style={{ animationDelay: `${index * 0.05}s` }}>
                  <div className="patient-name-cell">
                    <div className="patient-avatar">
                      {patient.name.charAt(0)}
                    </div>
                    {patient.name}
                  </div>
                  <div className="cell-text" style={{ fontWeight: '600' }}>{illness}</div>
                  <div className="cell-text" style={{ color: 'var(--text-muted)' }}>{hospitalsList.join(', ')}</div>
                  <div>
                    <span
                      className="specialty-pill"
                      style={{ background: getSpecialtyColor(aiSuggestion) }}
                    >
                      {aiSuggestion}
                    </span>
                  </div>
                  <div>
                    <span className={`status-badge ${urgencyClass}`}>{urgency}</span>
                  </div>
                  <div>
                    <span className={`status-badge ${modeClass}`}>
                      {mode === 'Online' ? '🌐 Online' : '🏥 Offline'}
                    </span>
                  </div>
                  <div>
                    <Link className="neon-link" to={`/mediconnectai/patient/${patientId}`}>
                      Enter &rarr;
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
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
