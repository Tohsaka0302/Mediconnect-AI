import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/hospitalnavbar.css';


const HospitalNavbar = () => {
  return (
    <nav className="navbar">
      <div className="navbar-logo">Hospital A</div>
      <ul className="navbar-links">a
        <li><Link to="/hospitals/dashboard">Dashboard</Link></li>
        <li><Link to="/hospitals/patient-list">Patients</Link></li>
        <li><Link to="/hospitals/share-data">Share Data</Link></li>
        <li><Link to="/mediconnectai/landing">MediConnectAI</Link></li>
      </ul>
    </nav>
  );
};

export default HospitalNavbar;
