import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/dashboard.css';

const patients = [
  { id: 1, name: 'John Doe', age: 34, condition: 'Diabetes' },
  { id: 2, name: 'Jane Smith', age: 28, condition: 'Hypertension' },
  { id: 3, name: 'Michael Johnson', age: 45, condition: 'Asthma' }
];

const PatientList = () => {
  const navigate = useNavigate();

  const handleView = (id) => {
    navigate(`/hospitals/patient/${id}`);
  };

  return (
    <div className="dashboard">
      <h1>🧑‍⚕️ Patient List</h1>
      <button style={{ marginBottom: '15px' }}>➕ Add New Patient</button>
      <table className="patient-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Age</th>
            <th>Condition</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {patients.map((p) => (
            <tr key={p.id}>
              <td>{p.id}</td>
              <td>{p.name}</td>
              <td>{p.age}</td>
              <td>{p.condition}</td>
              <td>
                <button onClick={() => handleView(p.id)}>👁 View</button>
                <button>✏️ Edit</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PatientList;
