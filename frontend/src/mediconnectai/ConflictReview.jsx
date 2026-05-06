import React, { useState, useEffect } from 'react';
import '../styles/dashboard.css';

const ConflictReview = () => {
  const [conflicts, setConflicts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [filter, setFilter] = useState('Pending');

  const fetchConflicts = async () => {
    try {
      const res = await fetch('/api/data-conflicts');
      if (!res.ok) throw new Error('Failed to fetch conflicts');
      const data = await res.json();
      setConflicts(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchConflicts(); }, []);

  const handleAction = async (conflictId, action) => {
    setActionLoading(conflictId);
    try {
      const res = await fetch(`/api/data-conflicts/${conflictId}/${action}`, {
        method: 'PUT'
      });
      if (!res.ok) throw new Error('Action failed');
      await fetchConflicts();
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = conflicts.filter(c => filter === 'All' || c.status === filter);

  const statusColor = (status) => {
    switch (status) {
      case 'Pending': return '#f59e0b';
      case 'Approved': return '#22c55e';
      case 'Created New': return '#3b82f6';
      case 'Cancelled': return '#6b7280';
      default: return '#9ca3af';
    }
  };

  if (loading) return (
    <div className="dashboard">
      <div className="stat-card" style={{ padding: '40px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading conflict data...</p>
      </div>
    </div>
  );

  return (
    <div className="dashboard" style={{ minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ color: 'var(--text-main)', fontSize: '2rem', letterSpacing: '1px' }}>
            ⚠️ Data <span style={{ color: '#f59e0b' }}>Conflict</span> Review
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>
            Review conflicting patient identity data from different hospital sources.
          </p>
        </div>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{
            padding: '10px 20px', borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(0,0,0,0.3)', color: 'var(--text-main)',
            fontSize: '0.95rem'
          }}
        >
          <option value="Pending">Pending</option>
          <option value="All">All</option>
          <option value="Approved">Approved</option>
          <option value="Created New">Created New</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>

      {error && (
        <div className="stat-card" style={{ borderLeft: '4px solid var(--accent-danger)', marginBottom: '20px' }}>
          <p style={{ color: 'var(--accent-danger)' }}>Error: {error}</p>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="stat-card" style={{ textAlign: 'center', padding: '60px 40px' }}>
          <p style={{ fontSize: '3rem', marginBottom: '10px' }}>✅</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
            {filter === 'Pending' ? 'No pending conflicts — all clear!' : 'No conflicts match this filter.'}
          </p>
        </div>
      ) : (
        filtered.map(conflict => (
          <div key={conflict._id} className="stat-card" style={{
            marginBottom: '20px',
            padding: '28px 32px',
            borderLeft: `4px solid ${statusColor(conflict.status)}`
          }}>
            {/* Header row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
                  National ID: <span style={{ color: 'var(--accent-secondary)', fontFamily: 'monospace' }}>{conflict.national_id}</span>
                </p>
                <p style={{ color: 'var(--text-main)', fontSize: '1.2rem', fontWeight: '600' }}>
                  {conflict.existingPatientName} — conflict from <span style={{ color: '#f59e0b' }}>{conflict.incomingHospital}</span>
                </p>
              </div>
              <span style={{
                padding: '6px 16px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: '600',
                background: `${statusColor(conflict.status)}22`,
                color: statusColor(conflict.status),
                border: `1px solid ${statusColor(conflict.status)}55`
              }}>{conflict.status}</span>
            </div>

            {/* Conflict details table */}
            <table style={{
              width: '100%', borderCollapse: 'collapse', marginBottom: '20px',
              background: 'rgba(0,0,0,0.15)', borderRadius: '8px', overflow: 'hidden'
            }}>
              <thead>
                <tr>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>Field</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.8rem', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>Existing Value</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.8rem', color: '#22c55e', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>Incoming Value</th>
                </tr>
              </thead>
              <tbody>
                {conflict.conflicts.map((c, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '12px 16px', color: 'var(--text-main)', fontWeight: '600', textTransform: 'capitalize' }}>{c.field.replace('_', ' ')}</td>
                    <td style={{ padding: '12px 16px', color: '#fca5a5', fontFamily: 'monospace' }}>{String(c.existingValue)}</td>
                    <td style={{ padding: '12px 16px', color: '#86efac', fontFamily: 'monospace' }}>{String(c.incomingValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Action buttons — only show for pending */}
            {conflict.status === 'Pending' && (
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => handleAction(conflict._id, 'approve')}
                  disabled={actionLoading === conflict._id}
                  style={{
                    padding: '10px 24px', border: 'none', borderRadius: '8px', cursor: 'pointer',
                    background: '#22c55e', color: 'white', fontWeight: '600',
                    opacity: actionLoading === conflict._id ? 0.6 : 1,
                    transition: 'all 0.15s'
                  }}
                >✓ Approve (Overwrite)</button>
                <button
                  onClick={() => handleAction(conflict._id, 'create-new')}
                  disabled={actionLoading === conflict._id}
                  style={{
                    padding: '10px 24px', border: '1px solid #3b82f6', borderRadius: '8px', cursor: 'pointer',
                    background: 'rgba(59,130,246,0.15)', color: '#60a5fa', fontWeight: '600',
                    opacity: actionLoading === conflict._id ? 0.6 : 1,
                    transition: 'all 0.15s'
                  }}
                >+ Create New Record</button>
                <button
                  onClick={() => handleAction(conflict._id, 'cancel')}
                  disabled={actionLoading === conflict._id}
                  style={{
                    padding: '10px 24px', border: '1px solid #6b7280', borderRadius: '8px', cursor: 'pointer',
                    background: 'rgba(107,114,128,0.15)', color: '#9ca3af', fontWeight: '600',
                    opacity: actionLoading === conflict._id ? 0.6 : 1,
                    transition: 'all 0.15s'
                  }}
                >✕ Cancel (Keep Existing)</button>
              </div>
            )}

            {/* Resolved info */}
            {conflict.resolvedAt && (
              <p style={{ marginTop: '12px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Resolved at {new Date(conflict.resolvedAt).toLocaleString()}
              </p>
            )}
          </div>
        ))
      )}

      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', marginTop: '20px' }}>
        Showing <strong>{filtered.length}</strong> of <strong>{conflicts.length}</strong> conflicts
      </p>
    </div>
  );
};

export default ConflictReview;
