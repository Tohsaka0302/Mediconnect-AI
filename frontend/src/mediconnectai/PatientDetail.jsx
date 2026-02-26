import React, { useState, useEffect } from 'react';
import '../styles/dashboard.css';
import { useParams, useNavigate } from 'react-router-dom';

const PatientDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [patient, setPatient] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [aiRecommendation, setAiRecommendation] = useState(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState(null);
    const [chatHistory, setChatHistory] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [isSending, setIsSending] = useState(false);

    const fetchAiRecommendation = async (patientData) => {
        const cachedChat = sessionStorage.getItem(`ai_chat_${patientData.id}`);
        if (cachedChat) {
            try {
                const parsedChat = JSON.parse(cachedChat);
                if (parsedChat.length > 0) {
                    setChatHistory(parsedChat);
                    return;
                }
            } catch (e) {
                console.error("Failed to parse cached chat history", e);
            }
        }

        setAiLoading(true);
        setAiError(null);
        try {
            const symptoms = [patientData.condition || patientData.illness].filter(Boolean);
            if (symptoms.length === 0) symptoms.push("General consultation");

            let history = "No historical engagement data.";
            if (patientData.visits && patientData.visits.length > 0) {
                history = patientData.visits.map(v => `${v.date}: ${v.notes}`).join(' | ');
            }

            const res = await fetch('http://localhost:8000/predict_treatment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    patient_id: patientData.id.toString(),
                    symptoms: symptoms,
                    history: history
                })
            });

            if (!res.ok) throw new Error('AI service error');
            const data = await res.json();
            const newHistory = [{ role: 'ai', content: data.recommended_treatment }];
            setChatHistory(newHistory);
            sessionStorage.setItem(`ai_chat_${patientData.id}`, JSON.stringify(newHistory));
        } catch (err) {
            console.error(err);
            setAiError("Failed to load AI recommendation.");
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
            const symptoms = [patient.condition || patient.illness].filter(Boolean);
            if (symptoms.length === 0) symptoms.push("General consultation");
            let history = "No historical engagement data.";
            if (patient.visits && patient.visits.length > 0) {
                history = patient.visits.map(v => `${v.date}: ${v.notes}`).join(' | ');
            }

            const res = await fetch('http://localhost:8000/chat_gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    patient_id: patient.id.toString(),
                    symptoms: symptoms,
                    history: history,
                    messages: newHistory
                })
            });

            if (!res.ok) throw new Error('AI chat service error');
            const data = await res.json();

            const updatedHistory = [...newHistory, { role: 'ai', content: data.response }];
            setChatHistory(updatedHistory);
            sessionStorage.setItem(`ai_chat_${patient.id}`, JSON.stringify(updatedHistory));

        } catch (err) {
            console.error(err);
            setChatHistory(prev => [...prev, { role: 'ai', content: "Error communicating with AI. Please try again." }]);
        } finally {
            setIsSending(false);
        }
    };

    useEffect(() => {
        fetch(`http://localhost:5000/patients/${id}`)
            .then(res => {
                if (!res.ok) throw new Error('Patient record not found');
                return res.json();
            })
            .then(data => {
                setPatient(data);
                setLoading(false);
                fetchAiRecommendation(data);
            })
            .catch(err => {
                console.error(err);
                setError(err.message);
                setLoading(false);
            });
    }, [id]);

    if (loading) return (
        <div className="dashboard">
            <div className="stat-card" style={{ padding: '40px' }}>
                <p>Retrieving patient clinical record...</p>
            </div>
        </div>
    );

    if (error || !patient) return (
        <div className="dashboard">
            <div className="stat-card" style={{ borderLeft: '4px solid var(--danger)' }}>
                <h2>Error</h2>
                <p>{error || 'Unable to load profile.'}</p>
                <button className="btn-outline" style={{ marginTop: '20px' }} onClick={() => navigate('/mediconnectai/shared-patient-directory')}>
                    Back to Directory
                </button>
            </div>
        </div>
    );

    return (
        <div className="dashboard" style={{
            background: 'radial-gradient(circle at right, rgba(118, 75, 255, 0.05), transparent 60%)',
            height: '100%'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ color: 'var(--text-main)', fontSize: '2rem', letterSpacing: '1px' }}>
                        <span style={{ color: 'var(--accent-secondary)' }}>AI</span> Patient Profile
                    </h1>
                    <p style={{ color: 'var(--text-muted)' }}>Aggregated clinical data from remote hospital nodes.</p>
                </div>
                <button className="btn-secondary" style={{ backdropFilter: 'blur(5px)', borderColor: 'rgba(255,255,255,0.1)' }} onClick={() => navigate('/mediconnectai/shared-patient-directory')}>
                    ← Back to Directory
                </button>
            </div>

            {/* Neon Cinematic Header */}
            <div className="stat-card" style={{
                display: 'flex',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '20px',
                padding: '30px 40px',
                marginBottom: '40px',
                background: 'linear-gradient(135deg, rgba(118, 75, 255, 0.1) 0%, rgba(41, 196, 219, 0.05) 100%)',
                borderLeft: '4px solid var(--accent-primary)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
            }}>
                <div style={{ flex: '1', minWidth: '200px' }}>
                    <p style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>Identity</p>
                    <p style={{ fontSize: '2rem', fontWeight: '600', color: 'var(--text-main)', lineHeight: '1.2' }}>{patient.name}</p>
                </div>

                <div style={{ flex: '1', minWidth: '150px' }}>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '8px' }}>Date of Birth</p>
                    <p style={{ fontSize: '1.2rem', color: 'var(--text-main)' }}>{patient.birth_date || 'N/A'}</p>
                </div>

                <div style={{ flex: '1', minWidth: '150px' }}>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '8px' }}>Gender</p>
                    <p style={{ fontSize: '1.2rem', color: 'var(--text-main)', textTransform: 'capitalize' }}>{patient.gender || 'N/A'}</p>
                </div>

                <div style={{ flex: '1', minWidth: '200px' }}>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '8px' }}>Primary Condition</p>
                    <div style={{
                        display: 'inline-block',
                        padding: '6px 16px',
                        background: 'var(--gradient-primary)',
                        borderRadius: '20px',
                        color: 'white',
                        fontWeight: '600',
                        fontSize: '0.95rem'
                    }}>
                        {patient.condition || patient.illness || 'N/A'}
                    </div>
                </div>
            </div>

            {/* AI Insights Section */}
            <div className="stat-card" style={{
                marginBottom: '40px',
                padding: '30px 40px',
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.05) 0%, rgba(236, 72, 153, 0.05) 100%)',
                border: '1px solid rgba(168, 85, 247, 0.2)',
                borderLeft: '4px solid #a855f7',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
                display: 'flex',
                flexDirection: 'column'
            }}>
                <h2 style={{ color: '#a855f7', marginBottom: '1.5rem', fontSize: '1.25rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.5rem' }}>✨</span> Gemini AI Clinical Context
                </h2>

                <div style={{
                    flex: 1,
                    maxHeight: '350px',
                    overflowY: 'auto',
                    paddingRight: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '15px',
                    marginBottom: '20px'
                }}>
                    {aiLoading ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)' }}>
                            <span style={{ animation: 'pulse 1.5s infinite', display: 'inline-block', width: '8px', height: '8px', background: '#a855f7', borderRadius: '50%' }}></span>
                            Generating initial context via Gemini...
                        </div>
                    ) : aiError ? (
                        <div style={{ color: 'var(--accent-danger)', padding: '10px', background: 'rgba(220, 53, 69, 0.1)', borderRadius: '8px' }}>
                            {aiError}
                        </div>
                    ) : (
                        chatHistory.map((msg, idx) => (
                            <div key={idx} style={{
                                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                background: msg.role === 'user' ? 'var(--accent-primary)' : 'rgba(168, 85, 247, 0.15)',
                                color: msg.role === 'user' ? 'white' : 'var(--text-main)',
                                padding: '12px 16px',
                                borderRadius: '12px',
                                maxWidth: '80%',
                                lineHeight: '1.5',
                                border: msg.role === 'user' ? 'none' : '1px solid rgba(168, 85, 247, 0.3)',
                                whiteSpace: 'pre-line'
                            }}>
                                {msg.content}
                            </div>
                        ))
                    )}

                    {isSending && (
                        <div style={{ color: '#a855f7', fontSize: '0.9rem', padding: '10px', alignSelf: 'flex-start' }}>
                            Gemini is typing...
                        </div>
                    )}
                </div>

                {/* Chat Input Area */}
                <div style={{ display: 'flex', gap: '10px', marginTop: 'auto' }}>
                    <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="Ask Gemini a follow-up question..."
                        style={{
                            flex: 1,
                            padding: '12px 16px',
                            borderRadius: '8px',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            background: 'rgba(0,0,0,0.2)',
                            color: 'var(--text-main)',
                            outline: 'none'
                        }}
                    />
                    <button
                        onClick={handleSendMessage}
                        disabled={!chatInput.trim() || isSending || aiLoading}
                        style={{
                            padding: '0 24px',
                            background: '#a855f7',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: (!chatInput.trim() || isSending || aiLoading) ? 'not-allowed' : 'pointer',
                            fontWeight: '600',
                            opacity: (!chatInput.trim() || isSending || aiLoading) ? 0.6 : 1
                        }}
                    >
                        Send
                    </button>
                </div>
            </div>

            {/* Hovering Pulse Cards Timeline */}
            <h2 style={{ color: 'var(--text-main)', marginBottom: '1.5rem', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{
                    display: 'inline-block',
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: 'var(--accent-secondary)',
                    boxShadow: '0 0 10px var(--accent-secondary)'
                }}></span>
                Clinical Engagements
            </h2>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                gap: '24px'
            }}>
                {patient.visits && patient.visits.length > 0 ? (
                    patient.visits.map((visit, index) => (
                        <div key={index} className="stat-card" style={{
                            padding: '25px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            height: '100%',
                            borderTop: '2px solid rgba(255,255,255,0.05)'
                        }}>
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                    <span style={{
                                        fontWeight: '700',
                                        color: 'var(--accent-secondary)',
                                        fontSize: '1.1rem'
                                    }}>{visit.date}</span>
                                    <span style={{
                                        fontSize: '0.8rem',
                                        padding: '4px 10px',
                                        background: 'rgba(255,255,255,0.05)',
                                        borderRadius: '12px',
                                        color: 'var(--text-muted)'
                                    }}>Source: {patient.hospital || 'Remote Node'}</span>
                                </div>
                                <p style={{ fontSize: '0.95rem', color: 'var(--text-main)', lineHeight: '1.6', marginBottom: '20px' }}>
                                    {visit.notes}
                                </p>
                            </div>

                            {visit.treatments && visit.treatments.length > 0 && (
                                <div style={{
                                    borderTop: '1px solid rgba(255,255,255,0.05)',
                                    paddingTop: '16px',
                                    marginTop: 'auto'
                                }}>
                                    <p style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '12px', letterSpacing: '1px' }}>ADMINISTERED LOG</p>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {visit.treatments.map((treatment, i) => (
                                            <span key={i} style={{
                                                padding: '6px 12px',
                                                background: 'rgba(41, 196, 219, 0.1)',
                                                border: '1px solid rgba(41, 196, 219, 0.3)',
                                                borderRadius: '20px',
                                                color: 'var(--accent-secondary)',
                                                fontSize: '0.85rem'
                                            }}>
                                                {treatment}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                ) : (
                    <div style={{
                        padding: '40px',
                        background: 'rgba(0,0,0,0.2)',
                        border: '1px dashed rgba(255,255,255,0.1)',
                        borderRadius: '16px',
                        color: 'var(--text-muted)',
                        gridColumn: '1 / -1',
                        textAlign: 'center'
                    }}>
                        No historical engagement data synchronized for this identity.
                    </div>
                )}
            </div>
        </div>
    );
};

export default PatientDetail;
