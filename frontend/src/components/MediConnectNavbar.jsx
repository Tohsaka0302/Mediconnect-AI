import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/mediconnectnavbar.css';

const MediConnectNavbar = () => {
  const user = JSON.parse(localStorage.getItem('user'));

  const handleLogout = () => {
    localStorage.removeItem('user');
    window.location.href = '/mediconnectai/login';
  };

  return (
    <nav className="navbar">
      <div className="navbar-logo">MediConnectAI</div>
      <ul className="navbar-links">
        {/* Always show */}
        <li><Link to="/hospitals/dashboard">Hospital System</Link></li>
        <li><Link to="/mediconnectai/landing">Home</Link></li>

        {/* Analyst or Admin */}
        {(user?.role === 'admin' || user?.role === 'analyst') && (
          <>
            <li><Link to="/mediconnectai/insights">AI Insights</Link></li>
            <li><Link to="/mediconnectai/shared-patient-directory">Shared Patients</Link></li>
          </>
        )}

        {/* Admin Only */}
        {user?.role === 'admin' && (
          <li><Link to="/mediconnectai/hospital-overview">Hospital Overview</Link></li>
        )}
        
        {/* Login / Logout */}
        {!user ? (
          <li><Link to="/mediconnectai/login">Login</Link></li>
        ) : (
          <li className="user-dropdown">
            <span className="user-role">{user.role}</span>
            <ul className="dropdown-menu">
              <li><button onClick={handleLogout}>Logout</button></li>
            </ul>
          </li>
        )}
      </ul>
    </nav>
  );
};

export default MediConnectNavbar;
