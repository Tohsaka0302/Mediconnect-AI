import React, { useState, useEffect } from 'react';
import '../styles/manageanalyst.css'; 

const ManageAnalyst = () => {
    const [analysts, setAnalysts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // State for the form inputs
    const [newAnalyst, setNewAnalyst] = useState({
        name: '',
        email: '',
        hospital: 'A',
        specialties: ''
    });

    useEffect(() => {
        fetchAnalysts();
    }, []);

    const fetchAnalysts = async () => {
        try {
            const response = await fetch('/api/analysts');
            if (!response.ok) throw new Error('Failed to fetch analysts');
            const data = await response.json();
            setAnalysts(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const addAnalyst = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch('/api/analysts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newAnalyst)
            });
            if (!response.ok) throw new Error('Failed to add analyst');
            const addedAnalyst = await response.json();
            
            setAnalysts([...analysts, addedAnalyst]);
            setNewAnalyst({ name: '', email: '', hospital: 'A', specialties: '' });
        } catch (err) {
            setError(err.message);
        }
    };

    const deleteAnalyst = async (id) => {
        if (!window.confirm('Are you sure you want to delete this analyst?')) return;
        try {
            await fetch(`/api/analysts/${id}`, { method: 'DELETE' });
            setAnalysts(analysts.filter(a => a.id !== id));
        } catch (err) {
            setError(err.message);
        }
    };

    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;

    return (
        <div className="analyst-container">
            <h1>Manage Analysts</h1>
            
            <div className="content-wrapper">
                
                {/* --- Left Side: The Input Form --- */}
                <div className="analyst-form">
                    <h3>Add New Analyst</h3>
                    <form onSubmit={addAnalyst}>
                        <input
                            type="text"
                            placeholder="Name"
                            value={newAnalyst.name}
                            onChange={(e) => setNewAnalyst({...newAnalyst, name: e.target.value})}
                            required
                        />
                        <input
                            type="email"
                            placeholder="Email"
                            value={newAnalyst.email}
                            onChange={(e) => setNewAnalyst({...newAnalyst, email: e.target.value})}
                            required
                        />
                        <select
                            value={newAnalyst.hospital}
                            onChange={(e) => setNewAnalyst({...newAnalyst, hospital: e.target.value})}
                            style={{
                                width: '100%', 
                                padding: '10px', 
                                marginBottom: '1rem', 
                                borderRadius: '4px',
                                border: '1px solid #ccc'
                            }}
                        >
                            <option value="A">Hospital A</option>
                            <option value="B">Hospital B</option>
                            <option value="C">Hospital C</option>
                        </select>
                        <input
                            type="text"
                            placeholder="Specialties (comma separated)"
                            value={newAnalyst.specialties}
                            onChange={(e) => setNewAnalyst({...newAnalyst, specialties: e.target.value})}
                            required
                        />
                        <button type="submit">Add Analyst</button>
                    </form>
                </div>

                {/* --- Right Side: The Table --- */}
                <div className="table-container">
                    <table className="analyst-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Hospital</th>
                                <th>Specialties</th>
                                <th>Manage</th>
                            </tr>
                        </thead>
                        <tbody>
                            {analysts.map(analyst => (
                                <tr key={analyst.id}>
                                    <td>{analyst.name}</td>
                                    <td>{analyst.email}</td>
                                    <td>Hospital {analyst.hospital}</td>
                                    <td>{analyst.specialties}</td>
                                    <td>
                                        <button 
                                            className="delete-btn" 
                                            onClick={() => deleteAnalyst(analyst.id)}
                                        >
                                            Delete
                                        </button>
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