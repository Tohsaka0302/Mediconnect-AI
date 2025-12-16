import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/dashboard.css';

const Dashboard = () => {
  const navigate = useNavigate(); 

  const handlePatientList = () => {
    navigate('/hospitals/patient-list');  
  };

  const handleShareData = () => {
    navigate('/hospitals/share-data'); 
  };

  return (
    <div className="dashboard">
      <h1>🏥 Hospital A Dashboard</h1>

      <div className="stats">
        <div className="stat-card">
          <h2>25</h2>
          <p>Total Patients</p>
        </div>
        <div className="stat-card">
          <h2>12</h2>
          <p>Shared with MediConnectAI</p>
        </div>
      </div>

      <div className="dashboard-buttons">
        <button onClick={handlePatientList}>Patient List</button>
        <button onClick={handleShareData}>Share Data</button>
      </div>
    </div>
  );
};

export default Dashboard;

