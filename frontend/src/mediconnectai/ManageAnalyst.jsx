import React, { useState, useEffect, useCallback } from 'react';
import '../styles/manageanalyst.css';
import { authFetch } from '../utils/authFetch';

const ManageAnalyst = () => {
    const [analysts, setAnalysts] = useState([]);
    const [stats, setStats] = useState({});   // { email: assignedPatientCount }
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [editValues, setEditValues] = useState({ specialties: '', hospital: '' });

    const [newAnalyst, setNewAnalyst] = useState({
        name: '',
        email: '',
        hospital: 'A',
        specialties: ''
    });

    const fetchAnalysts = useCallback(async () => {
        try {
            const [analystRes, statsRes] = await Promise.all([
                authFetch('/api/analysts'),
                authFetch('/api/analyst-stats')
            ]);
            if (!analystRes.ok) throw new Error('Failed to fetch analysts');
            const analystData = await analystRes.json();
            setAnalysts(analystData);

            if (statsRes.ok) {
                const statsData = await statsRes.json();
                const statsMap = {};
                statsData.forEach(s => { statsMap[s.email] = s.assignedPatientCount; });
                setStats(statsMap);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchAnalysts(); }, [fetchAnalysts]);

    const addAnalyst = async (e) => {
        e.preventDefault();
        try {
            const response = await authFetch('/api/analysts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newAnalyst)
            });
            if (!response.ok) throw new Error('Failed to add analyst');
            setNewAnalyst({ name: '', email: '', hospital: 'A', specialties: '' });
            fetchAnalysts();
        } catch (err) {
            setError(err.message);
        }
    };

    const deleteAnalyst = async (id) => {
        if (!window.confirm('Are you sure you want to delete this analyst?')) return;
        try {
            await authFetch(`/api/analysts/${id}`, { method: 'DELETE' });
            setAnalysts(analysts.filter(a => a.id !== id));
        } catch (err) {
            setError(err.message);
        }
    };

    const startEdit = (analyst) => {
        setEditingId(analyst.id);
        setEditValues({ specialties: analyst.specialties, hospital: analyst.hospital });
    };

    const cancelEdit = () => { setEditingId(null); };

    const saveEdit = async (analyst) => {
        try {
            const response = await authFetch(`/api/analysts/${analyst.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editValues)
            });
            if (!response.ok) throw new Error('Failed to update analyst');
            setEditingId(null);
            fetchAnalysts(); // Refresh to get updated stats too
        } catch (err) {
            setError(err.message);
        }
    };

    if (loading) return <div className="analyst-container"><p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Loading...</p></div>;

    return (
        <div className="analyst-container">
            <h1>👥 Manage Analysts</h1>
            {error && <p className="analyst-error">⚠ {error}</p>}

            <div className="content-wrapper">

                {/* --- Left: Add Analyst Form --- */}
                <div className="analyst-form">
                    <h3>Add New Analyst</h3>
                    <form onSubmit={addAnalyst}>
                        <input
                            type="text"
                            placeholder="Full Name"
                            value={newAnalyst.name}
                            onChange={(e) => setNewAnalyst({ ...newAnalyst, name: e.target.value })}
                            required
                        />
                        <input
                            type="email"
                            placeholder="Email"
                            value={newAnalyst.email}
                            onChange={(e) => setNewAnalyst({ ...newAnalyst, email: e.target.value })}
                            required
                        />
                        <select
                            value={newAnalyst.hospital}
                            onChange={(e) => setNewAnalyst({ ...newAnalyst, hospital: e.target.value })}
                        >
                            <option value="A">Hospital A</option>
                            <option value="B">Hospital B</option>
                            <option value="C">Hospital C</option>
                        </select>
                        <input
                            type="text"
                            placeholder="Specialties (e.g. Cardiology, Neurology)"
                            value={newAnalyst.specialties}
                            onChange={(e) => setNewAnalyst({ ...newAnalyst, specialties: e.target.value })}
                            required
                        />
                        <p className="form-hint">Default password: <code>analyst123</code></p>
                        <button type="submit">Add Analyst</button>
                    </form>
                </div>

                {/* --- Right: Analyst Table --- */}
                <div className="table-container">
                    <table className="analyst-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Hospital</th>
                                <th>Specialties</th>
                                <th>Patients</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {analysts.length === 0 && (
                                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No analysts yet.</td></tr>
                            )}
                            {analysts.map(analyst => (
                                <tr key={analyst.id}>
                                    <td className="analyst-name">{analyst.name}</td>
                                    <td className="analyst-email">{analyst.email}</td>

                                    {/* Hospital — editable */}
                                    <td>
                                        {editingId === analyst.id ? (
                                            <select
                                                className="inline-select"
                                                value={editValues.hospital}
                                                onChange={e => setEditValues({ ...editValues, hospital: e.target.value })}
                                            >
                                                <option value="A">Hospital A</option>
                                                <option value="B">Hospital B</option>
                                                <option value="C">Hospital C</option>
                                            </select>
                                        ) : (
                                            `Hospital ${analyst.hospital}`
                                        )}
                                    </td>

                                    {/* Specialties — editable */}
                                    <td>
                                        {editingId === analyst.id ? (
                                            <input
                                                className="inline-input"
                                                value={editValues.specialties}
                                                onChange={e => setEditValues({ ...editValues, specialties: e.target.value })}
                                                placeholder="e.g. Cardiology, Neurology"
                                            />
                                        ) : (
                                            <div className="specialty-tags">
                                                {(analyst.specialties || '').split(',').map(s => s.trim()).filter(Boolean).map(sp => (
                                                    <span key={sp} className="specialty-tag">{sp}</span>
                                                ))}
                                            </div>
                                        )}
                                    </td>

                                    {/* Assigned patient count badge */}
                                    <td>
                                        <span className="patient-count-badge">
                                            {stats[analyst.email] ?? '—'}
                                        </span>
                                    </td>

                                    {/* Action buttons */}
                                    <td>
                                        <div className="action-btns">
                                            {editingId === analyst.id ? (
                                                <>
                                                    <button className="save-btn" onClick={() => saveEdit(analyst)}>Save</button>
                                                    <button className="cancel-btn" onClick={cancelEdit}>Cancel</button>
                                                </>
                                            ) : (
                                                <>
                                                    <button className="edit-btn" onClick={() => startEdit(analyst)}>Edit</button>
                                                    <button className="delete-btn" onClick={() => deleteAnalyst(analyst.id)}>Delete</button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ManageAnalyst;