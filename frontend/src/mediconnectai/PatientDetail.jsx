import React, { useState, useEffect } from 'react';
import '../styles/dashboard.css';
import { useParams, useNavigate } from 'react-router-dom';

const HOSPITAL_COLORS = {
    'Hospital A': '#764bff',
    'Hospital B': '#00d4ff',
    'Hospital C': '#2ecc71',
    default: '#f39c12',
};

const getHospitalColor = (name) => HOSPITAL_COLORS[name] || HOSPITAL_COLORS.default;

const PatientDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [patient, setPatient] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [chatHistory, setChatHistory] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState(null);
    const [activeHospital, setActiveHospital] = useState(null);

    const fetchAiRecommendation = async (patientData) => {
        const cachedChat = sessionStorage.getItem(`ai_chat_${patientData._id}`);
        if (cachedChat) {
            try {
                const parsed = JSON.parse(cachedChat);
                if (parsed.length > 0) { setChatHistory(parsed); return; }
            } catch (_) { }
        }

        setAiLoading(true);
        setAiError(null);
        try {
            const symptoms = [patientData.primaryCondition || patientData.condition || patientData.illness].filter(Boolean);
            if (symptoms.length === 0) symptoms.push('General consultation');

            // Aggregate all visits for AI context
            let history = 'No historical engagement data.';
            const allVisits = getAllVisits(patientData);
            if (allVisits.length > 0) {
                history = allVisits.map(v => `${v.hospital} - ${v.date}: ${v.notes}`).join(' | ');
            }

            const res = await fetch('http://localhost:8000/predict_treatment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    patient_id: patientData._id?.toString() || id,
                    symptoms,
                    history
                })
            });
            if (!res.ok) throw new Error('AI service error');
            const data = await res.json();
            const newHistory = [{ role: 'ai', content: data.recommended_treatment }];
            setChatHistory(newHistory);
            sessionStorage.setItem(`ai_chat_${patientData._id}`, JSON.stringify(newHistory));
        } catch (err) {
            setAiError('Failed to load AI recommendation.');
        } finally {
            setAiLoading(false);
        }
    };

    const handleSendMessage = async () => {
        if (!chatInput.trim() || isSending) return;
        const userMsg = chatInput.trim();
        setChatInput('');
        const newHistory = [...chatHistory, { role: 'user', content: userMsg }];
        setChatHistory(newHistory);
        setIsSending(true);
        try {
            const symptoms = [patient.primaryCondition || patient.condition || patient.illness].filter(Boolean);
            if (symptoms.length === 0) symptoms.push('General consultation');
            const allVisits = getAllVisits(patient);
            const history = allVisits.length > 0
                ? allVisits.map(v => `${v.hospital} - ${v.date}: ${v.notes}`).join(' | ')
                : 'No historical engagement data.';

            const res = await fetch('http://localhost:8000/chat_gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ patient_id: patient._id?.toString() || id, symptoms, history, messages: newHistory })
            });
            if (!res.ok) throw new Error('AI chat error');
            const data = await res.json();
            const updated = [...newHistory, { role: 'ai', content: data.response }];
            setChatHistory(updated);
            sessionStorage.setItem(`ai_chat_${patient._id}`, JSON.stringify(updated));
        } catch {
            setChatHistory(prev => [...prev, { role: 'ai', content: 'Error communicating with AI. Please try again.' }]);
        } finally {
            setIsSending(false);
        }
    };

    useEffect(() => {
        fetch(`http://localhost:5000/patients/${id}`)
            .then(res => { if (!res.ok) throw new Error('Patient record not found'); return res.json(); })
            .then(data => {
                setPatient(data);
                setLoading(false);
                // Set first hospital as active tab
                const hospitals = Object.keys(data.hospitalRecords || {});
                if (hospitals.length > 0) setActiveHospital(hospitals[0]);
                fetchAiRecommendation(data);
            })
            .catch(err => { setError(err.message); setLoading(false); });
    }, [id]);

    // Flatten all visits from all hospitals with source tag
    const getAllVisits = (p) => {
        if (!p?.hospitalRecords) return p?.visits || [];
        const visits = [];
        Object.entries(p.hospitalRecords).forEach(([hosp, rec]) => {
            (rec.visits || []).forEach(v => visits.push({ ...v, hospital: hosp }));
        });
        return visits.sort((a, b) => new Date(b.date) - new Date(a.date));
    };

    if (loading) return (
        <div className="dashboard">
            <div className="stat-card" style={{ padding: '40px' }}>
                <p>Retrieving patient clinical record...</p>
            </div>
        </div>
    );

    if (error || !patient) return (
        <div className="dashboard">
            <div className="stat-card" style={{ borderLeft: '4px solid var(--accent-danger)' }}>
                <h2>Error</h2>
                <p>{error || 'Unable to load profile.'}</p>
                <button className="btn-outline" style={{ marginTop: '20px' }} onClick={() => navigate('/mediconnectai/shared-patient-directory')}>
                    Back to Directory
                </button>
            </div>
        </div>
    );

    const hospitalRecords = patient.hospitalRecords || {};
    const hospitalNames = Object.keys(hospitalRecords);
    const activeRecord = hospitalRecords[activeHospital] || {};

    return (
        <div className="dashboard" style={{
            background: 'radial-gradient(circle at right, rgba(118, 75, 255, 0.05), transparent 60%)',
            height: '100%'
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ color: 'var(--text-main)', fontSize: '2rem', letterSpacing: '1px' }}>
                        <span style={{ color: 'var(--accent-secondary)' }}>AI</span> Patient Profile
                    </h1>
                    <p style={{ color: 'var(--text-muted)' }}>Aggregated clinical data from {hospitalNames.length} hospital node{hospitalNames.length !== 1 ? 's' : ''}.</p>
                </div>
                <button className="btn-secondary" onClick={() => navigate('/mediconnectai/shared-patient-directory')}>
                    ← Back to Directory
                </button>
            </div>

            {/* Identity Header */}
            <div className="stat-card" style={{
                display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px',
                padding: '30px 40px', marginBottom: '28px',
                background: 'linear-gradient(135deg, rgba(118, 75, 255, 0.1), rgba(41, 196, 219, 0.05))',
                borderLeft: '4px solid var(--accent-primary)'
            }}>
                <div style={{ flex: '1', minWidth: '180px' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>Identity</p>
                    <p style={{ fontSize: '2rem', fontWeight: '600', color: 'var(--text-main)' }}>{patient.name}</p>
                </div>
                <div style={{ flex: '1', minWidth: '140px' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '6px' }}>National ID</p>
                    <p style={{ fontSize: '1.1rem', color: 'var(--accent-secondary)', fontFamily: 'monospace', letterSpacing: '1px' }}>{patient.national_id || '—'}</p>
                </div>
                <div style={{ flex: '1', minWidth: '120px' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '6px' }}>Date of Birth</p>
                    <p style={{ fontSize: '1.1rem', color: 'var(--text-main)' }}>{patient.birth_date || 'N/A'}</p>
                </div>
                <div style={{ flex: '1', minWidth: '100px' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '6px' }}>Gender</p>
                    <p style={{ fontSize: '1.1rem', color: 'var(--text-main)', textTransform: 'capitalize' }}>{patient.gender || 'N/A'}</p>
                </div>
                <div style={{ flex: '1', minWidth: '160px' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '6px' }}>AI Specialty</p>
                    <div style={{
                        display: 'inline-block', padding: '6px 16px',
                        background: 'var(--gradient-primary)', borderRadius: '20px',
                        color: 'white', fontWeight: '600', fontSize: '0.9rem'
                    }}>{patient.suggested || 'Pending'}</div>
                </div>
            </div>

            {/* Hospital source badges */}
            {hospitalNames.length > 0 && (
                <div style={{ display: 'flex', gap: '10px', marginBottom: '28px', flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '13px', alignSelf: 'center' }}>Shared by:</span>
                    {hospitalNames.map(h => (
                        <span key={h} style={{
                            padding: '4px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: '600',
                            background: `${getHospitalColor(h)}22`,
                            border: `1px solid ${getHospitalColor(h)}55`,
                            color: getHospitalColor(h)
                        }}>{h}</span>
                    ))}
                </div>
            )}

            {/* ── Per-hospital records (tabs) ── */}
            {hospitalNames.length > 0 && (
                <div className="stat-card" style={{ marginBottom: '28px', padding: '0', overflow: 'hidden' }}>
                    {/* Tab bar */}
                    <div style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)' }}>
                        {hospitalNames.map(h => (
                            <button
                                key={h}
                                onClick={() => setActiveHospital(h)}
                                style={{
                                    padding: '16px 28px',
                                    background: activeHospital === h ? `${getHospitalColor(h)}18` : 'transparent',
                                    border: 'none',
                                    borderBottom: activeHospital === h ? `3px solid ${getHospitalColor(h)}` : '3px solid transparent',
                                    color: activeHospital === h ? getHospitalColor(h) : 'var(--text-muted)',
                                    cursor: 'pointer',
                                    fontWeight: activeHospital === h ? '700' : '500',
                                    fontSize: '14px',
                                    transition: 'all 0.15s',
                                    letterSpacing: '0.3px'
                                }}
                            >
                                {h}
                            </button>
                        ))}
                    </div>

                    {/* Active hospital content */}
                    <div style={{ padding: '28px 32px' }}>
                        <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap', marginBottom: '28px' }}>
                            <div>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Condition / Illness</p>
                                <p style={{ color: 'var(--text-main)', fontSize: '1.1rem', fontWeight: '500' }}>
                                    {activeRecord.illness || activeRecord.condition || 'N/A'}
                                </p>
                            </div>
                            <div>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Ingested At</p>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                                    {activeRecord.ingestedAt ? new Date(activeRecord.ingestedAt).toLocaleDateString() : 'N/A'}
                                </p>
                            </div>
                        </div>

                        {/* Visits for active hospital */}
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>
                            Clinical Visits — {activeHospital}
                        </p>
                        {(activeRecord.visits || []).length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '14px' }}>No visit records from this hospital.</p>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                                {(activeRecord.visits || []).map((visit, i) => (
                                    <div key={i} style={{
                                        background: 'rgba(0,0,0,0.2)',
                                        border: `1px solid ${getHospitalColor(activeHospital)}33`,
                                        borderRadius: '12px',
                                        padding: '20px'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                            <span style={{ color: getHospitalColor(activeHospital), fontWeight: '700' }}>{visit.date}</span>
                                        </div>
                                        <p style={{ color: 'var(--text-main)', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '12px' }}>{visit.notes}</p>
                                        {visit.treatments?.length > 0 && (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                {visit.treatments.map((t, ti) => (
                                                    <span key={ti} style={{
                                                        padding: '4px 10px',
                                                        background: `${getHospitalColor(activeHospital)}18`,
                                                        border: `1px solid ${getHospitalColor(activeHospital)}44`,
                                                        borderRadius: '20px',
                                                        color: getHospitalColor(activeHospital),
                                                        fontSize: '0.8rem'
                                                    }}>{t}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* AI Chat Section */}
            <div className="stat-card" style={{
                padding: '30px 40px',
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.05), rgba(236, 72, 153, 0.05))',
                border: '1px solid rgba(168, 85, 247, 0.2)',
                borderLeft: '4px solid #a855f7',
                display: 'flex', flexDirection: 'column'
            }}>
                <h2 style={{ color: '#a855f7', marginBottom: '1.5rem', fontSize: '1.2rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span>✨</span> Gemini AI Clinical Context
                </h2>
                <div style={{ flex: 1, maxHeight: '350px', overflowY: 'auto', paddingRight: '10px', display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px' }}>
                    {aiLoading ? (
                        <div style={{ color: 'var(--text-muted)' }}>Generating initial context via Gemini...</div>
                    ) : aiError ? (
                        <div style={{ color: 'var(--accent-danger)' }}>{aiError}</div>
                    ) : chatHistory.map((msg, idx) => (
                        <div key={idx} style={{
                            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                            background: msg.role === 'user' ? 'var(--accent-primary)' : 'rgba(168, 85, 247, 0.15)',
                            color: msg.role === 'user' ? 'white' : 'var(--text-main)',
                            padding: '12px 16px', borderRadius: '12px', maxWidth: '80%',
                            lineHeight: '1.5', whiteSpace: 'pre-line',
                            border: msg.role === 'user' ? 'none' : '1px solid rgba(168, 85, 247, 0.3)'
                        }}>{msg.content}</div>
                    ))}
                    {isSending && <div style={{ color: '#a855f7', fontSize: '0.9rem', alignSelf: 'flex-start' }}>Gemini is typing...</div>}
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                        type="text"
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
                        placeholder="Ask Gemini a follow-up question..."
                        style={{ flex: 1, padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'var(--text-main)', outline: 'none' }}
                    />
                    <button
                        onClick={handleSendMessage}
                        disabled={!chatInput.trim() || isSending || aiLoading}
                        style={{ padding: '0 24px', background: '#a855f7', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', opacity: (!chatInput.trim() || isSending || aiLoading) ? 0.6 : 1 }}
                    >Send</button>
                </div>
            </div>
        </div>
    );
};

export default PatientDetail;
