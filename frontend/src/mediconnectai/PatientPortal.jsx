import React, { useEffect, useState } from 'react';
import '../styles/dashboard.css';

const URGENCY_CLASS = {
  High: 'badge-high',
  Medium: 'badge-medium',
  Low: 'badge-low',
};

const PatientPortal = () => {
  const user = JSON.parse(localStorage.getItem('user'));
  const nationalId = user?.national_id || '';

  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [feedbackList, setFeedbackList] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  const [consultations, setConsultations] = useState([]);
  const [payingId, setPayingId] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [offlineLocType, setOfflineLocType] = useState('Hospital A');
  const [offlineLocOther, setOfflineLocOther] = useState('');

  const [analystNotes, setAnalystNotes] = useState([]);
  const aiLoading = false;
  const aiError = null;
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!nationalId) {
      setError('No National ID linked to your account. Please contact an administrator.');
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const [patientRes, feedbackRes, consultRes, notesRes] = await Promise.all([
          fetch(`/api/patient-portal/${encodeURIComponent(nationalId)}`),
          fetch(`/api/feedback/${encodeURIComponent(nationalId)}`),
          fetch(`/api/consultations/${encodeURIComponent(nationalId)}`),
          fetch(`/api/analyst-notes/${encodeURIComponent(nationalId)}`),
        ]);

        if (!patientRes.ok) throw new Error('No medical record found for your National ID.');

        setPatient(await patientRes.json());
        if (feedbackRes.ok) setFeedbackList(await feedbackRes.json());
        if (consultRes.ok) setConsultations(await consultRes.json());
        if (notesRes.ok) setAnalystNotes(await notesRes.json());
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [nationalId]);

  useEffect(() => {
    if (!patient) return;

    const cachedChat = sessionStorage.getItem(`patient_portal_chat_${patient._id}`);
    if (!cachedChat) return;

    try {
      const parsed = JSON.parse(cachedChat);
      if (parsed.length > 0 && !parsed[0].content.startsWith('Error')) {
        setChatHistory(parsed);
      } else {
        sessionStorage.removeItem(`patient_portal_chat_${patient._id}`);
      }
    } catch (_) {}
  }, [patient]);

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isSending) return;

    const userMsg = chatInput.trim();
    setChatInput('');
    const newHistory = [...chatHistory, { role: 'user', content: userMsg }];
    setChatHistory(newHistory);
    setIsSending(true);

    try {
      const symptoms = [patient?.primaryCondition || patient?.condition || patient?.illness].filter(Boolean);
      if (symptoms.length === 0) symptoms.push('General consultation');

      let history = 'No historical engagement data.';
      if (consultations.length > 0) {
        history = consultations
          .map((c) => `${c.type} - ${new Date(c.createdAt).toLocaleDateString()}: ${c.notes || 'No notes'}`)
          .join(' | ');
      }
      if (analystNotes.length > 0) {
        history += ` \n[LATEST ANALYST DIAGNOSES: ${analystNotes
          .map((n) => `${n.analyst_name} (${new Date(n.createdAt).toLocaleDateString()}): ${n.note}`)
          .join(' | ')}]`;
      }

      const res = await fetch('/chat_gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patient._id?.toString() || nationalId,
          symptoms,
          history,
          messages: newHistory,
        }),
      });

      if (!res.ok) throw new Error('AI chat error');
      const data = await res.json();
      if (data.response && data.response.startsWith('Error')) throw new Error(data.response);

      const updated = [...newHistory, { role: 'ai', content: data.response }];
      setChatHistory(updated);
      sessionStorage.setItem(`patient_portal_chat_${patient._id}`, JSON.stringify(updated));
    } catch (err) {
      setChatHistory((prev) => [...prev, { role: 'ai', content: `Connection issue. (${err.message})` }]);
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!rating) return;
    setSubmitting(true);

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patient?._id?.toString(),
          national_id: nationalId,
          rating,
          comment,
        }),
      });

      if (!res.ok) throw new Error('Failed to submit feedback');

      setFeedbackSuccess(true);
      setRating(0);
      setComment('');

      const updatedFeedback = await fetch(`/api/feedback/${encodeURIComponent(nationalId)}`);
      if (updatedFeedback.ok) setFeedbackList(await updatedFeedback.json());

      setTimeout(() => setFeedbackSuccess(false), 3000);
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBookConsultation = async (type) => {
    try {
      const res = await fetch('/api/consultations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patient?._id?.toString(),
          national_id: nationalId,
          type,
          location: type === 'Offline' ? (offlineLocType === 'Other' ? offlineLocOther : offlineLocType) : null,
          proposed_by: 'patient',
        }),
      });

      if (!res.ok) throw new Error('Failed to book consultation');

      const updated = await fetch(`/api/consultations/${encodeURIComponent(nationalId)}`);
      if (updated.ok) setConsultations(await updated.json());
    } catch (err) {
      alert(err.message);
    }
  };

  const handleStatusUpdate = async (id, status) => {
    setUpdatingStatus(id);
    try {
      await fetch(`/api/consultations/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const updated = await fetch(`/api/consultations/${encodeURIComponent(nationalId)}`);
      if (updated.ok) setConsultations(await updated.json());
    } catch (err) {
      alert(err.message);
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handlePayment = async (consultationId) => {
    setPayingId(consultationId);
    try {
      const res = await fetch('/api/payment/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consultation_id: consultationId }),
      });
      if (!res.ok) throw new Error('Payment failed');

      const updated = await fetch(`/api/consultations/${encodeURIComponent(nationalId)}`);
      if (updated.ok) setConsultations(await updated.json());
    } catch (err) {
      alert(err.message);
    } finally {
      setPayingId(null);
    }
  };

  if (loading) {
    return (
      <div className="dashboard page-shell">
        <div className="stat-card portal-loading">
          <p className="loading-state">Loading your medical profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard page-shell">
        <div className="stat-card portal-error">
          <h2 style={{ color: 'var(--accent-danger)', marginBottom: '10px' }}>Unable to Load Profile</h2>
          <p className="error-state">{error}</p>
        </div>
      </div>
    );
  }

  const urgencyClass = URGENCY_CLASS[patient?.urgency_level] || 'badge-medium';
  const recommendationClass = patient?.recommended_mode === 'Online' ? 'portal-chip-online' : 'portal-chip-offline';

  return (
    <div className="dashboard ambient-container page-shell" style={{ paddingBottom: '40px' }}>
      <div className="portal-hero">
        <div>
          <h1 className="page-title">
            My <span style={{ color: 'var(--accent-primary)' }}>Health</span> Portal
          </h1>
          <p className="page-subtitle">
            Welcome, {patient?.name}. View your medical records, AI analysis, consultation status, and feedback history
            in one place.
          </p>
        </div>
      </div>

      <div className="portal-profile glass-card">
        <div className="portal-meta-grid">
          <div className="portal-field">
            <span className="portal-label">Patient Name</span>
            <span className="portal-value" style={{ fontSize: '1.6rem' }}>{patient?.name}</span>
          </div>
          <div className="portal-field">
            <span className="portal-label">National ID</span>
            <span className="portal-value portal-value-mono">{patient?.national_id}</span>
          </div>
          <div className="portal-field">
            <span className="portal-label">DOB</span>
            <span className="portal-value">{patient?.birth_date || 'N/A'}</span>
          </div>
          <div className="portal-field">
            <span className="portal-label">Gender</span>
            <span className="portal-value" style={{ textTransform: 'capitalize' }}>{patient?.gender || 'N/A'}</span>
          </div>
        </div>

        <div className="portal-stats-grid">
          <div className="portal-field">
            <span className="portal-label">Primary Condition</span>
            <span className="portal-value" style={{ fontSize: '1.1rem' }}>{patient?.primaryCondition || 'N/A'}</span>
          </div>
          <div className="portal-field">
            <span className="portal-label">AI Specialty</span>
            <span className="portal-chip portal-chip-accent">{patient?.suggested || 'Pending'}</span>
          </div>
          <div className="portal-field">
            <span className="portal-label">Urgency</span>
            <span className={`portal-chip ${urgencyClass}`}>{patient?.urgency_level || 'Medium'}</span>
          </div>
          <div className="portal-field">
            <span className="portal-label">Recommended Mode</span>
            <span className={`portal-chip ${recommendationClass}`}>
              {patient?.recommended_mode === 'Online' ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      </div>

      <div className="portal-chip-row" style={{ marginTop: '18px' }}>
        <span className="portal-label">Records from</span>
        {patient?.hospitals?.length > 0 ? (
          patient.hospitals.map((hospital) => (
            <span key={hospital} className="portal-chip portal-chip-accent">{hospital}</span>
          ))
        ) : (
          <span className="portal-chip">No connected hospitals listed</span>
        )}
      </div>

      <div className="portal-grid" style={{ marginTop: '20px' }}>
        <div className="portal-side-grid">
          {analystNotes.length > 0 && (
            <div className="glass-card portal-consult-panel">
              <h2 className="portal-section-title" style={{ color: '#8fc0ff' }}>Analyst Diagnosis & Clinical Notes</h2>
              <div className="portal-note-list">
                {analystNotes.map((note) => (
                  <article key={note._id} className="portal-note">
                    <div className="portal-note-head">
                      <strong>Dr. {note.analyst_name}</strong>
                      <span className="section-note">{new Date(note.createdAt).toLocaleString()}</span>
                    </div>
                    <p>{note.note}</p>
                  </article>
                ))}
              </div>
            </div>
          )}

          <div className="glass-card portal-chat-panel">
            <h2 className="portal-chat-title">
              <span className="portal-chip portal-chip-accent">AI</span>
              Ask AI About Your Diagnosis
            </h2>

            <div className="portal-chat-window">
              {aiLoading ? (
                <div className="loading-state">Retrieving your full AI assessment...</div>
              ) : aiError ? (
                <div className="error-state">{aiError}</div>
              ) : chatHistory.length === 0 ? (
                <div className="portal-chat-empty">
                  Hello! Your doctor's diagnoses and notes have been processed securely. Ask a question about your
                  condition below.
                </div>
              ) : (
                chatHistory.map((message, index) => (
                  <div key={index} className={`portal-chat-message ${message.role === 'user' ? 'user' : 'ai'}`}>
                    {message.content}
                  </div>
                ))
              )}
              {isSending && <div className="portal-typed">AI is typing...</div>}
            </div>

            <div className="portal-chat-composer">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Ask the AI a question about your diagnosis..."
              />
              <button
                onClick={handleSendMessage}
                disabled={!chatInput.trim() || isSending || aiLoading}
                className="btn-primary"
              >
                Send
              </button>
            </div>
          </div>
        </div>

        <div className="portal-side-grid">
          <div className="glass-card portal-consult-panel">
            <h2 className="portal-section-title" style={{ color: '#8fb7ff' }}>Consultations & Payment</h2>

            <div className="portal-consult-toolbar">
              <button className="btn-primary" onClick={() => handleBookConsultation('Online')}>
                Request Online Consultation
              </button>
              <div className="portal-select-group">
                <select value={offlineLocType} onChange={(e) => setOfflineLocType(e.target.value)}>
                  <option value="Hospital A">Hospital A</option>
                  <option value="Hospital B">Hospital B</option>
                  <option value="Other">Other...</option>
                </select>
                {offlineLocType === 'Other' && (
                  <input
                    type="text"
                    value={offlineLocOther}
                    onChange={(e) => setOfflineLocOther(e.target.value)}
                    placeholder="Specify location"
                  />
                )}
                <button className="btn-secondary" onClick={() => handleBookConsultation('Offline')}>
                  Request Offline Visit
                </button>
              </div>
            </div>

            {consultations.filter((c) => c.status !== 'Declined').length === 0 ? (
              <p className="empty-state">No consultations yet.</p>
            ) : (
              <div className="portal-consult-list">
                {consultations
                  .filter((c) => c.status !== 'Declined')
                  .map((consultation) => {
                    const isOnline = consultation.type === 'Online';
                    const typeClass = isOnline ? 'portal-chip-online' : 'portal-chip-offline';
                    const statusChip =
                      consultation.status === 'Pending Approval' && consultation.proposed_by === 'patient'
                        ? 'portal-chip'
                        : consultation.status === 'Pending Approval'
                          ? 'portal-chip-accent'
                          : 'portal-chip';

                    return (
                      <article key={consultation._id} className="portal-consult-card">
                        <div className="portal-consult-head">
                          <div className="portal-chip-row">
                            <span className={`portal-chip ${typeClass}`}>{consultation.type}</span>
                            <span className="section-note">{new Date(consultation.createdAt).toLocaleDateString()}</span>
                            {consultation.location && <span className="portal-chip">{consultation.location}</span>}
                          </div>
                          <div className="portal-consult-actions">
                            {consultation.status === 'Pending Approval' && consultation.proposed_by === 'analyst' && (
                              <>
                                <button
                                  className="btn-primary"
                                  onClick={() => handleStatusUpdate(consultation._id, 'Scheduled')}
                                  disabled={updatingStatus === consultation._id}
                                >
                                  Accept
                                </button>
                                <button
                                  className="btn-secondary"
                                  onClick={() => handleStatusUpdate(consultation._id, 'Declined')}
                                  disabled={updatingStatus === consultation._id}
                                >
                                  Decline
                                </button>
                              </>
                            )}

                            {consultation.payment_status === 'Pending' && (
                              <>
                                <span className="portal-chip portal-chip-accent">
                                  {consultation.amount?.toLocaleString()} VND
                                </span>
                                <button
                                  className="btn-primary"
                                  onClick={() => handlePayment(consultation._id)}
                                  disabled={payingId === consultation._id}
                                >
                                  {payingId === consultation._id ? 'Processing...' : 'Pay now'}
                                </button>
                              </>
                            )}
                            {consultation.payment_status === 'Paid' && (
                              <span className="portal-chip portal-chip-online">Paid</span>
                            )}
                            {consultation.payment_status === 'Waiting Approval' && (
                              <span className="portal-chip">Pending approval</span>
                            )}
                            {consultation.payment_status === 'N/A' &&
                              consultation.status !== 'Pending Approval' && (
                                <span className="portal-chip">In-person visit</span>
                              )}
                            {consultation.status === 'Pending Approval' && consultation.proposed_by === 'patient' && (
                              <span className={statusChip}>Awaiting doctor</span>
                            )}
                          </div>
                        </div>

                        {consultation.notes && (
                          <div className="portal-consult-note">
                            <p className="portal-label">Analyst Diagnosis / Notes</p>
                            <p>{consultation.notes}</p>
                          </div>
                        )}
                      </article>
                    );
                  })}
              </div>
            )}
          </div>

          <div className="glass-card portal-feedback-panel">
            <h2 className="portal-section-title" style={{ color: '#d7b8ff' }}>Service Feedback</h2>

            {feedbackSuccess && <div className="portal-feedback-banner">Thank you for your feedback!</div>}

            <p className="portal-section-copy">How was your experience?</p>
            <div className="portal-feedback-stars">
              {[1, 2, 3, 4, 5].map((star) => {
                const active = star <= (hoverRating || rating);
                return (
                  <span
                    key={star}
                    className={active ? 'active' : ''}
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                  >
                    ★
                  </span>
                );
              })}
            </div>

            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share your thoughts about the service (optional)..."
            />

            <button
              onClick={handleSubmitFeedback}
              disabled={!rating || submitting}
              className="btn-primary"
            >
              {submitting ? 'Submitting...' : 'Submit Feedback'}
            </button>

            {feedbackList.length > 0 && (
              <div className="portal-feedback-history">
                <p className="portal-label" style={{ marginBottom: '12px' }}>Your Previous Feedback</p>
                <div className="portal-feedback-list">
                  {feedbackList.map((fb) => (
                    <article key={fb._id} className="portal-feedback-item">
                      <div className="portal-feedback-item-head">
                        <span style={{ color: '#ffb84d' }}>{'★'.repeat(fb.rating)}{'☆'.repeat(5 - fb.rating)}</span>
                        <span className="section-note">{new Date(fb.createdAt).toLocaleDateString()}</span>
                      </div>
                      {fb.comment && <p>{fb.comment}</p>}
                    </article>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientPortal;
