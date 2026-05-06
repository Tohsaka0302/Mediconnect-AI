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

// --- Consultation & Payment Sub-Component ---
const ConsultationSection = ({ patient, patientId }) => {
    const userRole = JSON.parse(localStorage.getItem('user'))?.role;
    const [consultations, setConsultations] = useState([]);
    const [payingId, setPayingId] = useState(null);
    const [booking, setBooking] = useState(false);
    const [updatingStatus, setUpdatingStatus] = useState(null);
    const [offlineLocType, setOfflineLocType] = useState('Hospital A');
    const [offlineLocOther, setOfflineLocOther] = useState('');

    useEffect(() => {
        if (!patient) return;
        fetch(`/api/consultations/${patient._id || patientId}`)
            .then(r => r.ok ? r.json() : [])
            .then(setConsultations)
            .catch(() => {});
    }, [patient, patientId]);

    const handleStatusUpdate = async (id, status) => {
        setUpdatingStatus(id);
        try {
            await fetch(`/api/consultations/${id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });
            const updated = await fetch(`/api/consultations/${patient._id || patientId}`);
            if (updated.ok) setConsultations(await updated.json());
        } catch (err) { console.error(err); }
        finally { setUpdatingStatus(null); }
    };

    const handleBook = async (type) => {
        setBooking(true);
        try {
            const res = await fetch('/api/consultations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    patient_id: (patient._id || patientId).toString(),
                    national_id: patient.national_id,
                    type,
                    location: type === 'Offline' ? (offlineLocType === 'Other' ? offlineLocOther : offlineLocType) : null,
                    proposed_by: 'analyst'
                })
            });
            if (res.ok) {
                const updated = await fetch(`/api/consultations/${patient._id || patientId}`);
                if (updated.ok) setConsultations(await updated.json());
            }
        } catch (err) { console.error(err); }
        finally { setBooking(false); }
    };

    const handlePay = async (consultationId) => {
        setPayingId(consultationId);
        try {
            await fetch('/api/payment/simulate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ consultation_id: consultationId })
            });
            const updated = await fetch(`/api/consultations/${patient._id || patientId}`);
            if (updated.ok) setConsultations(await updated.json());
        } catch (err) { console.error(err); }
        finally { setPayingId(null); }
    };

    return (
        <div className="glass-card" style={{
            padding: '28px 32px', marginBottom: '28px',
            borderLeft: '4px solid #3b82f6',
            boxShadow: '0 8px 30px rgba(59, 130, 246, 0.1)'
        }}>
            <h2 style={{ color: '#60a5fa', marginBottom: '16px', fontSize: '1.15rem', fontWeight: '600' }}>
                📋 Consultations & Payment
            </h2>
            {userRole !== 'patient' && (
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <button onClick={() => handleBook('Online')} disabled={booking} style={{
                        padding: '10px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer',
                        background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white', fontWeight: '600',
                        opacity: booking ? 0.6 : 1
                    }}>🌐 Propose Online Consultation</button>
                    
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '4px', borderRadius: '8px' }}>
                        <select value={offlineLocType} onChange={e => setOfflineLocType(e.target.value)} style={{ padding: '8px', borderRadius: '8px', background: 'rgba(0,0,0,0.5)', color: 'white', border: '1px solid #6b7280', outline: 'none' }}>
                            <option value="Hospital A">Hospital A</option>
                            <option value="Hospital B">Hospital B</option>
                            <option value="Other">Other...</option>
                        </select>
                        {offlineLocType === 'Other' && (
                            <input type="text" value={offlineLocOther} onChange={e => setOfflineLocOther(e.target.value)} placeholder="Specify location" style={{ padding: '8px', borderRadius: '8px', background: 'rgba(0,0,0,0.5)', color: 'white', border: '1px solid #6b7280', width: '130px', outline: 'none' }} />
                        )}
                        <button onClick={() => handleBook('Offline')} disabled={booking} style={{
                            padding: '10px 20px', border: '1px solid #6b7280', borderRadius: '8px', cursor: 'pointer',
                            background: 'rgba(107,114,128,0.15)', color: '#9ca3af', fontWeight: '600',
                            opacity: booking ? 0.6 : 1
                        }}>🏥 Propose Offline Visit</button>
                    </div>
                </div>
            )}
            {consultations.filter(c => c.status !== 'Declined').length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>No consultations yet.</p>
            ) : (
                <div style={{ display: 'grid', gap: '10px' }}>
                    {consultations.filter(c => c.status !== 'Declined').map(c => (
                        <div key={c._id} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '12px 18px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px',
                            border: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap', gap: '8px'
                        }}>
                            <div>
                                <span style={{
                                    padding: '3px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: '600',
                                    background: c.type === 'Online' ? 'rgba(59,130,246,0.2)' : 'rgba(107,114,128,0.2)',
                                    color: c.type === 'Online' ? '#60a5fa' : '#9ca3af', marginRight: '10px'
                                }}>{c.type}</span>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                    {new Date(c.createdAt).toLocaleDateString()}
                                </span>
                                {c.location && (
                                    <span style={{ color: 'var(--text-main)', fontSize: '0.8rem', marginLeft: '10px' }}>
                                        📍 {c.location}
                                    </span>
                                )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                {c.status === 'Pending Approval' && c.proposed_by === 'patient' && (
                                    <>
                                        <button onClick={() => handleStatusUpdate(c._id, 'Scheduled')} disabled={updatingStatus === c._id} style={{
                                            padding: '4px 12px', background: '#22c55e', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer'
                                        }}>Accept</button>
                                        <button onClick={() => handleStatusUpdate(c._id, 'Declined')} disabled={updatingStatus === c._id} style={{
                                            padding: '4px 12px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer'
                                        }}>Decline</button>
                                    </>
                                )}
                                {c.status === 'Pending Approval' && c.proposed_by === 'analyst' && (
                                    <span style={{ color: '#f59e0b', fontSize: '0.8rem' }}>Awaiting Patient</span>
                                )}
                                {c.payment_status === 'Pending' && (
                                    <>
                                        <span style={{ color: '#f59e0b', fontSize: '0.85rem' }}>{c.amount?.toLocaleString()} VND</span>
                                        {userRole === 'patient' && (
                                            <button onClick={() => handlePay(c._id)} disabled={payingId === c._id} style={{
                                                padding: '6px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer',
                                                background: '#22c55e', color: 'white', fontWeight: '600', fontSize: '0.8rem',
                                                opacity: payingId === c._id ? 0.6 : 1
                                            }}>{payingId === c._id ? 'Processing...' : '💳 Pay'}</button>
                                        )}
                                    </>
                                )}
                                {c.payment_status === 'Paid' && (
                                    <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: '600', background: 'rgba(34,197,94,0.2)', color: '#22c55e' }}>✓ Paid</span>
                                )}
                                {c.payment_status === 'Waiting Approval' && (
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Pending Approval</span>
                                )}
                                {c.payment_status === 'N/A' && c.status !== 'Pending Approval' && (
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>In-person</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// --- Feedback Sub-Component ---
const FeedbackSection = ({ patient, patientId }) => {
    const userRole = JSON.parse(localStorage.getItem('user'))?.role;
    const [feedbackList, setFeedbackList] = useState([]);
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!patient) return;
        fetch(`/api/feedback/${patient._id || patientId}`)
            .then(r => r.ok ? r.json() : [])
            .then(setFeedbackList)
            .catch(() => {});
    }, [patient, patientId]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    patient_id: (patient._id || patientId).toString(),
                    national_id: patient.national_id,
                    rating,
                    comment
                })
            });
            if (res.ok) {
                setComment('');
                setRating(5);
                // Refresh list
                const updated = await fetch(`/api/feedback/${patient._id || patientId}`);
                if (updated.ok) setFeedbackList(await updated.json());
            }
        } catch (err) { console.error(err); }
        finally { setSubmitting(false); }
    };

    return (
        <div className="glass-card" style={{
            padding: '28px 32px', marginBottom: '28px',
            borderLeft: '4px solid #10b981',
            boxShadow: '0 8px 30px rgba(16, 185, 129, 0.1)'
        }}>
            <h2 style={{ color: '#34d399', marginBottom: '16px', fontSize: '1.15rem', fontWeight: '600' }}>
                ⭐ Patient Experience & Feedback
            </h2>
            
            {userRole === 'patient' && (
                <form onSubmit={handleSubmit} style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Rating:</span>
                        <div style={{ display: 'flex', gap: '5px' }}>
                            {[1, 2, 3, 4, 5].map(star => (
                                <button 
                                    key={star} 
                                    type="button"
                                    onClick={() => setRating(star)}
                                    style={{
                                        background: 'none', border: 'none', cursor: 'pointer',
                                        fontSize: '1.5rem', color: star <= rating ? '#f59e0b' : '#374151',
                                        transition: 'transform 0.1s'
                                    }}
                                    onMouseEnter={(e) => e.target.style.transform = 'scale(1.2)'}
                                    onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                                >★</button>
                            ))}
                        </div>
                    </div>
                    <textarea 
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Share your experience or clinical outcome feedback..."
                        style={{
                            width: '100%', padding: '12px', borderRadius: '8px',
                            background: 'rgba(0,0,0,0.2)', color: 'var(--text-main)',
                            border: '1px solid rgba(255,255,255,0.1)', minHeight: '80px',
                            marginBottom: '12px', resize: 'vertical', fontSize: '0.9rem'
                        }}
                    />
                    <button type="submit" disabled={submitting || !comment.trim()} style={{
                        padding: '10px 24px', border: 'none', borderRadius: '8px', cursor: 'pointer',
                        background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', fontWeight: '600',
                        opacity: (submitting || !comment.trim()) ? 0.6 : 1
                    }}>{submitting ? 'Submitting...' : 'Submit Feedback'}</button>
                </form>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '4px' }}>PREVIOUS FEEDBACK</p>
                {feedbackList.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>No feedback submitted yet.</p>
                ) : (
                    feedbackList.map(f => (
                        <div key={f._id} style={{
                            padding: '12px 18px', background: 'rgba(0,0,0,0.1)', borderRadius: '10px',
                            border: '1px solid rgba(255,255,255,0.04)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                <span style={{ color: '#f59e0b', fontSize: '0.9rem' }}>{'★'.repeat(f.rating)}{'☆'.repeat(5 - f.rating)}</span>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{new Date(f.createdAt).toLocaleDateString()}</span>
                            </div>
                            <p style={{ color: 'var(--text-main)', fontSize: '0.9rem', lineHeight: '1.4' }}>{f.comment}</p>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

// --- Analyst Notes Sub-Component ---
const AnalystNotesSection = ({ patient, patientId }) => {
    const user = JSON.parse(localStorage.getItem('user'));
    const userRole = user?.role;
    const userName = user?.name || 'Analyst';
    
    const [notesList, setNotesList] = useState([]);
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!patient) return;
        fetch(`/api/analyst-notes/${patient._id || patientId}`)
            .then(r => r.ok ? r.json() : [])
            .then(setNotesList)
            .catch(() => {});
    }, [patient, patientId]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await fetch('/api/analyst-notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    patient_id: (patient._id || patientId).toString(),
                    national_id: patient.national_id,
                    analyst_name: userName,
                    note
                })
            });
            if (res.ok) {
                setNote('');
                const updated = await fetch(`/api/analyst-notes/${patient._id || patientId}`);
                if (updated.ok) setNotesList(await updated.json());
            }
        } catch (err) { console.error(err); }
        finally { setSubmitting(false); }
    };

    if (userRole === 'patient') return null; // Patients do not see analyst notes component

    return (
        <div className="glass-card" style={{
            padding: '28px 32px', marginBottom: '28px',
            borderLeft: '4px solid #a855f7',
            boxShadow: '0 8px 30px rgba(168, 85, 247, 0.15)'
        }}>
            <h2 style={{ color: '#a855f7', marginBottom: '16px', fontSize: '1.15rem', fontWeight: '600' }}>
                🩺 Analyst Private Notes & Feedback
            </h2>
            
            <form onSubmit={handleSubmit} style={{ marginBottom: '24px' }}>
                <textarea 
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Enter your clinical observations, diagnosis, or private notes for this patient..."
                    style={{
                        width: '100%', padding: '12px', borderRadius: '8px',
                        background: 'rgba(0,0,0,0.2)', color: 'var(--text-main)',
                        border: '1px solid rgba(255,255,255,0.1)', minHeight: '80px',
                        marginBottom: '12px', resize: 'vertical', fontSize: '0.9rem'
                    }}
                />
                <button type="submit" disabled={submitting || !note.trim()} style={{
                    padding: '10px 24px', border: 'none', borderRadius: '8px', cursor: 'pointer',
                    background: 'linear-gradient(135deg, #a855f7, #9333ea)', color: 'white', fontWeight: '600',
                    opacity: (submitting || !note.trim()) ? 0.6 : 1
                }}>{submitting ? 'Saving...' : 'Save Note'}</button>
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '4px' }}>PREVIOUS ANALYST NOTES</p>
                {notesList.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>No clinical notes added yet.</p>
                ) : (
                    notesList.map(n => (
                        <div key={n._id} style={{
                            padding: '12px 18px', background: 'rgba(0,0,0,0.1)', borderRadius: '10px',
                            border: '1px solid rgba(255,255,255,0.04)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                <span style={{ color: '#a855f7', fontSize: '0.85rem', fontWeight: 'bold' }}>{n.analyst_name}</span>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{new Date(n.createdAt).toLocaleString()}</span>
                            </div>
                            <p style={{ color: 'var(--text-main)', fontSize: '0.9rem', lineHeight: '1.4' }}>{n.note}</p>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

const PatientDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [patient, setPatient] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const userRole = JSON.parse(localStorage.getItem('user'))?.role;
    const [chatHistory, setChatHistory] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState(null);
    const [activeHospital, setActiveHospital] = useState(null);
    const [aiNotes, setAiNotes] = useState([]);
    const [isEditingTriage, setIsEditingTriage] = useState(false);
    const [triageData, setTriageData] = useState({ suggested: '', urgency_level: '', recommended_mode: '' });
    const [isSavingTriage, setIsSavingTriage] = useState(false);

    const SPECIALTIES = ["Internal Medicine", "Pediatrics", "Family Medicine", "Surgery", "Psychiatry", "Radiology", "Anesthesiology"];
    const URGENCY_LEVELS = ["Low", "Medium", "High"];
    const MODES = ["Online", "Offline"];

    useEffect(() => {
        if (!patient) return;
        fetch(`/api/ai-notes/${patient._id || id}`)
            .then(r => r.ok ? r.json() : [])
            .then(setAiNotes)
            .catch(() => {});
    }, [patient, id]);

    const handleDeleteAiNote = async (noteId) => {
        try {
            const res = await fetch(`/api/ai-notes/${noteId}`, { method: 'DELETE' });
            if (res.ok) {
                setAiNotes(prev => prev.filter(n => n._id !== noteId));
            }
        } catch (err) {}
    };

    const handleSaveTriage = async () => {
        setIsSavingTriage(true);
        try {
            const res = await fetch(`/api/patients/${patient._id || id}/triage`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(triageData)
            });
            if (res.ok) {
                const updated = await res.json();
                setPatient(updated);
                setIsEditingTriage(false);
            } else {
                alert('Failed to save triage data.');
            }
        } catch (err) {
            console.error('Save triage error:', err);
            alert('Service error while saving triage.');
        } finally {
            setIsSavingTriage(false);
        }
    };

    const generateAiRecommendation = async () => {
        setAiLoading(true);
        setAiError(null);
        try {
            const symptoms = [patient.primaryCondition || patient.condition || patient.illness].filter(Boolean);
            if (symptoms.length === 0) symptoms.push('General consultation');

            let history = 'No historical engagement data.';
            const allVisits = getAllVisits(patient);
            if (allVisits.length > 0) {
                history = allVisits.map(v => `${v.hospital} - ${v.date}: ${v.notes}`).join(' | ');
            }

            try {
                const notesRes = await fetch(`/api/analyst-notes/${patient._id || id}`);
                if (notesRes.ok) {
                    const notesData = await notesRes.json();
                    if (notesData.length > 0) {
                        history += ` \n[LATEST ANALYST NOTES: ${notesData.map(n => n.note).join(' | ')}]`;
                    }
                }
            } catch(e) {}

            const res = await fetch('/predict_treatment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    patient_id: patient._id?.toString() || id,
                    symptoms,
                    history
                })
            });
            if (!res.ok) throw new Error('AI service error');
            const data = await res.json();
            if (data.recommended_treatment && data.recommended_treatment.startsWith('Error')) {
                throw new Error(data.recommended_treatment);
            }
            const newHistory = [{ role: 'ai', content: data.recommended_treatment }];
            setChatHistory(newHistory);
            sessionStorage.setItem(`ai_chat_${patient._id}`, JSON.stringify(newHistory));

            try {
                const saveRes = await fetch('/api/ai-notes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        patient_id: patient._id?.toString() || id,
                        national_id: patient.national_id,
                        note: data.recommended_treatment
                    })
                });
                if (saveRes.ok) {
                    const updatedNotes = await fetch(`/api/ai-notes/${patient._id || id}`);
                    if (updatedNotes.ok) setAiNotes(await updatedNotes.json());
                }
            } catch (saveErr) {}
        } catch (err) {
            setAiError('Failed to generate. (' + err.message + ')');
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
            
            let history = 'No historical engagement data.';
            const allVisits = getAllVisits(patient);
            if (allVisits.length > 0) {
                history = allVisits.map(v => `${v.hospital} - ${v.date}: ${v.notes}`).join(' | ');
            }

            try {
                const notesRes = await fetch(`/api/analyst-notes/${patient._id || id}`);
                if (notesRes.ok) {
                    const notesData = await notesRes.json();
                    if (notesData.length > 0) {
                        history += ` \n[LATEST ANALYST NOTES: ${notesData.map(n => n.note).join(' | ')}]`;
                    }
                }
            } catch(e) {}

            const res = await fetch('/chat_gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ patient_id: patient._id?.toString() || id, symptoms, history, messages: newHistory })
            });
            if (!res.ok) throw new Error('AI chat error');
            const data = await res.json();
            if (data.response && data.response.startsWith('Error')) {
                throw new Error(data.response);
            }
            const updated = [...newHistory, { role: 'ai', content: data.response }];
            setChatHistory(updated);
            sessionStorage.setItem(`ai_chat_${patient._id}`, JSON.stringify(updated));
        } catch (err) {
            setChatHistory(prev => [...prev, { role: 'ai', content: 'Connection issue. (' + err.message + ')' }]);
        } finally {
            setIsSending(false);
        }
    };

    useEffect(() => {
        fetch(`/patients/${id}`)
            .then(res => { if (!res.ok) throw new Error('Patient record not found'); return res.json(); })
            .then(data => {
                setPatient(data);
                setLoading(false);
                // Set first hospital as active tab
                const hospitals = Object.keys(data.hospitalRecords || {});
                if (hospitals.length > 0) setActiveHospital(hospitals[0]);
                
                // Load cached history but DO NOT auto-fetch
                const cachedChat = sessionStorage.getItem(`ai_chat_${data._id}`);
                if (cachedChat) {
                    try {
                        const parsed = JSON.parse(cachedChat);
                        if (parsed.length > 0 && !parsed[0].content.startsWith('Error')) { 
                            setChatHistory(parsed); 
                        } else {
                            sessionStorage.removeItem(`ai_chat_${data._id}`);
                        }
                    } catch (_) {}
                }
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
        <div className="dashboard ambient-container" style={{ minHeight: '100vh', paddingBottom: '40px', display: 'flex', flexDirection: 'column' }}>
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
            <div className="glass-card" style={{
                display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px',
                padding: '30px 40px', marginBottom: '28px',
                background: 'linear-gradient(135deg, rgba(118, 75, 255, 0.15), rgba(41, 196, 219, 0.1))',
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
                    {isEditingTriage ? (
                        <select 
                            value={triageData.suggested} 
                            onChange={e => setTriageData({...triageData, suggested: e.target.value})}
                            style={{ padding: '6px 12px', background: 'rgba(0,0,0,0.4)', color: 'white', borderRadius: '8px', border: '1px solid var(--accent-primary)', outline: 'none', fontSize: '0.9rem', width: '100%' }}
                        >
                            {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    ) : (
                        <div style={{
                            display: 'inline-block', padding: '6px 16px',
                            background: 'var(--gradient-primary)', borderRadius: '20px',
                            color: 'white', fontWeight: '600', fontSize: '0.9rem'
                        }}>{patient.suggested || 'Pending'}</div>
                    )}
                </div>
                <div style={{ flex: '1', minWidth: '120px' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '6px' }}>Urgency</p>
                    {isEditingTriage ? (
                        <select 
                            value={triageData.urgency_level} 
                            onChange={e => setTriageData({...triageData, urgency_level: e.target.value})}
                            style={{ padding: '6px 12px', background: 'rgba(0,0,0,0.4)', color: 'white', borderRadius: '8px', border: '1px solid var(--accent-primary)', outline: 'none', fontSize: '0.9rem', width: '100%' }}
                        >
                            {URGENCY_LEVELS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                    ) : (
                        <div style={{
                            display: 'inline-block', padding: '6px 16px',
                            background: (patient.urgency_level || 'Medium') === 'High' ? '#ef4444' : (patient.urgency_level || 'Medium') === 'Medium' ? '#f59e0b' : '#22c55e',
                            borderRadius: '20px', color: 'white', fontWeight: '600', fontSize: '0.9rem'
                        }}>{patient.urgency_level || 'Medium'}</div>
                    )}
                </div>
                <div style={{ flex: '1', minWidth: '120px' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '6px' }}>Mode</p>
                    {isEditingTriage ? (
                        <select 
                            value={triageData.recommended_mode} 
                            onChange={e => setTriageData({...triageData, recommended_mode: e.target.value})}
                            style={{ padding: '6px 12px', background: 'rgba(0,0,0,0.4)', color: 'white', borderRadius: '8px', border: '1px solid var(--accent-primary)', outline: 'none', fontSize: '0.9rem', width: '100%' }}
                        >
                            {MODES.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    ) : (
                        <div style={{
                            display: 'inline-block', padding: '6px 16px',
                            background: (patient.recommended_mode || 'Offline') === 'Online' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(156, 163, 175, 0.2)',
                            border: (patient.recommended_mode || 'Offline') === 'Online' ? '1px solid #3b82f6' : '1px solid #6b7280',
                            borderRadius: '20px',
                            color: (patient.recommended_mode || 'Offline') === 'Online' ? '#60a5fa' : '#9ca3af',
                            fontWeight: '600', fontSize: '0.9rem'
                        }}>{(patient.recommended_mode || 'Offline') === 'Online' ? '🌐 Online' : '🏥 Offline'}</div>
                    )}
                </div>

                {/* Edit Controls for Analysts */}
                {userRole !== 'patient' && (
                    <div style={{ alignSelf: 'center', marginLeft: '10px' }}>
                        {isEditingTriage ? (
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button 
                                    onClick={handleSaveTriage} 
                                    disabled={isSavingTriage}
                                    style={{ padding: '8px 16px', background: '#22c55e', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '0.85rem' }}
                                >
                                    {isSavingTriage ? '...' : 'Save'}
                                </button>
                                <button 
                                    onClick={() => setIsEditingTriage(false)} 
                                    style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '0.85rem' }}
                                >
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <button 
                                onClick={() => {
                                    setTriageData({
                                        suggested: patient.suggested || 'Internal Medicine',
                                        urgency_level: patient.urgency_level || 'Medium',
                                        recommended_mode: patient.recommended_mode || 'Offline'
                                    });
                                    setIsEditingTriage(true);
                                }} 
                                style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem' }}
                            >
                                ✎ Edit Triage
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* ---- Dual Column Dashboard Layout ---- */}
            <div className="detail-grid-wrapper">

                {/* Left Column: Context & History */}
                <div className="grid-col-left">

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
                <div className="glass-card" style={{ marginBottom: '28px', padding: '0', overflow: 'hidden' }}>
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

            {/* Consultation & Payment Section */}
            <ConsultationSection patient={patient} patientId={id} />

            {/* Features (Feedback) */}
            <FeedbackSection patient={patient} patientId={id} />

                </div> {/* end grid-col-left */}

                {/* Right Column: Actions & Generation */}
                <div className="grid-col-right">

                    <AnalystNotesSection patient={patient} patientId={id} />

            {/* AI Notes Database Rendering */}
            {aiNotes.length > 0 && userRole !== 'patient' && (
                <div className="glass-card" style={{
                    padding: '28px 32px', marginBottom: '28px',
                    borderLeft: '4px solid #f43f5e',
                    boxShadow: '0 8px 30px rgba(244, 63, 94, 0.1)'
                }}>
                    <h2 style={{ color: '#fb7185', marginBottom: '16px', fontSize: '1.15rem', fontWeight: '600' }}>
                        🤖 Saved AI Impressions
                    </h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {aiNotes.map(n => (
                            <div key={n._id} style={{
                                padding: '12px 18px', background: 'rgba(0,0,0,0.1)', borderRadius: '10px',
                                border: '1px solid rgba(255,255,255,0.04)', position: 'relative'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                    <span style={{ color: '#fb7185', fontSize: '0.85rem', fontWeight: 'bold' }}>Gemini Output</span>
                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{new Date(n.createdAt).toLocaleString()}</span>
                                        <button onClick={() => handleDeleteAiNote(n._id)} style={{
                                            background: 'transparent', border: 'none', color: '#f43f5e', cursor: 'pointer', fontSize: '1.1rem'
                                        }}>×</button>
                                    </div>
                                </div>
                                <p style={{ color: 'var(--text-main)', fontSize: '0.9rem', lineHeight: '1.4', whiteSpace: 'pre-line' }}>{n.note}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* AI Chat Section */}
            <div className="glass-card" style={{
                padding: '30px 40px',
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.05), rgba(41, 196, 219, 0.05))',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                boxShadow: '0 8px 30px rgba(168, 85, 247, 0.15)',
                borderLeft: '4px solid #a855f7',
                display: 'flex', flexDirection: 'column',
                flex: 1
            }}>
                <h2 style={{ color: '#a855f7', marginBottom: '1.5rem', fontSize: '1.2rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span>✨</span> Gemini AI Clinical Context
                </h2>
                <div style={{ flex: 1, minHeight: '350px', overflowY: 'auto', paddingRight: '10px', display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px' }}>
                    {aiLoading ? (
                        <div style={{ color: 'var(--text-muted)' }}>Generating context via Gemini (This may take a moment)...</div>
                    ) : aiError ? (
                        <div style={{ color: 'var(--accent-danger)' }}>{aiError}</div>
                    ) : chatHistory.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '30px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>No AI analysis has run for this session.</p>
                            <button onClick={generateAiRecommendation} style={{
                                padding: '16px 36px', background: 'var(--gradient-primary)', color: 'white', border: 'none', borderRadius: '30px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.05rem', transition: 'all 0.3s', animation: 'pulseGlow 2s infinite'
                            }}>🧠 Generate Latest AI Analysis</button>
                        </div>
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
            
                </div> {/* end grid-col-right */}
            </div> {/* end detail-grid-wrapper */}

        </div>
    );
};

export default PatientDetail;
