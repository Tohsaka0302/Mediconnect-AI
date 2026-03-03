import React, { useState, useEffect } from 'react';
import { Navigate, Link } from 'react-router-dom';
import '../styles/spd.css';

const MediConnectRemovalRequests = () => {
    const user = JSON.parse(localStorage.getItem('user'));
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchRequests = () => {
        setLoading(true);
        fetch('http://localhost:5000/api/removal-requests')
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch requests');
                return res.json();
            })
            .then(data => {
                setRequests(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setError(err.message);
                setLoading(false);
            });
    };

    useEffect(() => {
        const currentUser = JSON.parse(localStorage.getItem('user'));
        if (currentUser && currentUser.role === 'admin') {
            fetchRequests();
        }
    }, []);

    if (!user || user.role !== 'admin') {
        return <Navigate to="/mediconnectai/login" />;
    }

    const handleAction = async (id, action) => {
        setActionLoading(true);
        try {
            const res = await fetch(`http://localhost:5000/api/removal-requests/${id}/${action}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Failed to process request');

            alert(data.message || `Request ${action}d successfully`);
            fetchRequests(); // Refresh list
        } catch (err) {
            console.error(err);
            alert(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleApproveAll = async () => {
        const pendingIds = requests
            .filter(req => req.status === 'Pending MediConnect Approval')
            .map(req => req._id);

        if (pendingIds.length === 0) {
            alert('There are no pending requests to approve.');
            return;
        }

        if (!window.confirm(`Are you sure you want to approve all ${pendingIds.length} pending requests?`)) {
            return;
        }

        setActionLoading(true);
        let successCount = 0;
        let failCount = 0;

        try {
            await Promise.all(pendingIds.map(async (id) => {
                try {
                    const res = await fetch(`http://localhost:5000/api/removal-requests/${id}/approve`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' }
                    });
                    if (res.ok) successCount++;
                    else failCount++;
                } catch (err) {
                    failCount++;
                }
            }));

            alert(`Finished processing. Successfully approved: ${successCount}, Failed: ${failCount}`);
            fetchRequests();
        } finally {
            setActionLoading(false);
        }
    };

    const getStatusStyle = (status) => {
        switch (status) {
            case 'Pending Hospital Approval':
                return { backgroundColor: 'rgba(255, 193, 7, 0.1)', color: 'var(--accent-secondary)' };
            case 'Pending MediConnect Approval':
                return { backgroundColor: 'rgba(23, 162, 184, 0.1)', color: 'var(--accent-primary)' };
            case 'Approved':
                return { backgroundColor: 'rgba(40, 167, 69, 0.1)', color: '#28a745' };
            case 'Rejected':
                return { backgroundColor: 'rgba(220, 53, 69, 0.1)', color: 'var(--accent-danger)' };
            default:
                return { backgroundColor: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)' };
        }
    };

    if (loading) return (
        <div className="shared-directory-container">
            <h2 style={{ color: 'var(--text-main)' }}>Loading removal requests...</h2>
        </div>
    );

    return (
        <div className="shared-directory-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div>
                    <h1>Data Removal Requests</h1>
                    <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>Review requests from hospitals to remove shared patient data from the MediConnect ecosystem.</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                        className="btn-primary"
                        onClick={handleApproveAll}
                        disabled={actionLoading || requests.filter(r => r.status === 'Pending MediConnect Approval').length === 0}
                    >
                        ✅ Approve All Pending
                    </button>
                    <button className="btn-secondary" onClick={fetchRequests} disabled={actionLoading}>
                        🔄 Refresh
                    </button>
                </div>
            </div>

            {error && <div style={{ color: 'var(--accent-danger)', marginBottom: '1rem', padding: '1rem', backgroundColor: 'rgba(255, 107, 107, 0.1)', borderRadius: '8px', border: '1px solid var(--accent-danger)' }}>{error}</div>}

            <table className="patient-table">
                <thead>
                    <tr>
                        <th>Originating Hospital</th>
                        <th>Patient Identity</th>
                        <th>Status</th>
                        <th>Requested On</th>
                        <th style={{ textAlign: 'center' }}>Admin Action</th>
                    </tr>
                </thead>
                <tbody>
                    {requests.length === 0 ? (
                        <tr>
                            <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No removal requests found.</td>
                        </tr>
                    ) : (
                        requests.map(req => (
                            <tr key={req._id}>
                                <td>
                                    <div style={{ fontWeight: '500', color: 'var(--text-main)' }}>{req.hospital}</div>
                                </td>
                                <td>
                                    <Link to={`/mediconnectai/patient/${req.patientId}`} style={{ textDecoration: 'none' }}>
                                        <div style={{ fontWeight: '600', color: 'var(--accent-secondary)' }}>{req.patientName}</div>
                                    </Link>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>ID: {req.patientId}</div>
                                </td>
                                <td>
                                    <span style={{
                                        padding: '6px 14px',
                                        borderRadius: '20px',
                                        fontSize: '0.85rem',
                                        fontWeight: '600',
                                        ...getStatusStyle(req.status)
                                    }}>
                                        {req.status}
                                    </span>
                                </td>
                                <td style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                    {new Date(req.createdAt).toLocaleDateString()}
                                </td>
                                <td>
                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                        {req.status === 'Pending MediConnect Approval' ? (
                                            <>
                                                <button
                                                    className="btn-primary"
                                                    style={{ padding: '8px 16px', fontSize: '0.85rem', minWidth: '120px', opacity: actionLoading ? 0.7 : 1 }}
                                                    onClick={() => handleAction(req._id, 'approve')}
                                                    disabled={actionLoading}
                                                >
                                                    Approve Delete
                                                </button>
                                                <button
                                                    className="btn-secondary"
                                                    style={{ padding: '8px 16px', fontSize: '0.85rem', borderColor: 'var(--accent-danger)', color: 'var(--accent-danger)', opacity: actionLoading ? 0.7 : 1 }}
                                                    onClick={() => handleAction(req._id, 'reject')}
                                                    disabled={actionLoading}
                                                >
                                                    Reject
                                                </button>
                                            </>
                                        ) : (
                                            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                                Completed
                                            </span>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
};

export default MediConnectRemovalRequests;
