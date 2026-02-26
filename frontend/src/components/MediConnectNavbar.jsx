import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/mediconnectnavbar.css';

const MediConnectNavbar = () => {
  const user = JSON.parse(localStorage.getItem('user'));
  const [showModal, setShowModal] = useState(false);
  const [passwords, setPasswords] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [message, setMessage] = useState('');

  const handleLogout = () => {
    localStorage.removeItem('user');
    window.location.href = '/mediconnectai/login';
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      setMessage('New passwords do not match');
      return;
    }

    try {
      const response = await fetch('http://localhost:8000/api/users/change-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          old_password: passwords.oldPassword,
          new_password: passwords.newPassword,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setMessage('Password changed successfully');
        setTimeout(() => setShowModal(false), 2000);
      } else {
        setMessage(data.detail || 'Error changing password');
      }
    } catch (error) {
      setMessage('Network error');
    }
  };

  return (
    <>
      <nav className="navbar">
        <div className="navbar-logo">MediConnectAI</div>
        <ul className="navbar-links">
          {/* Always show */}
          <li><Link to="/mediconnectai/landing">Home</Link></li>

          {/* Analyst or Admin */}
          {(user?.role === 'admin' || user?.role === 'analyst') && (
            <>
              <li><Link to="/mediconnectai/shared-patient-directory">Shared Patients</Link></li>
            </>
          )}

          {/* Admin Only */}
          {user?.role === 'admin' && (
            <>
              <li><Link to="/mediconnectai/hospital-overview">Hospital Overview</Link></li>
              <li><Link to="/mediconnectai/manage-analyst">Manage Analyst</Link></li>
              <li><Link to="/mediconnectai/removal-requests">Removal Requests</Link></li>
            </>
          )}

          {/* Login / Logout */}
          {!user ? (
            <li><Link to="/mediconnectai/login">Login</Link></li>
          ) : (
            <li className="user-dropdown">
              <span className="user-role">{user.role}</span>
              <ul className="dropdown-menu">
                <li><button onClick={() => setShowModal(true)}>Change Password</button></li>
                <li><button onClick={handleLogout}>Logout</button></li>
              </ul>
            </li>
          )}
        </ul>
      </nav>

      {/* Change Password Modal */}
      {showModal && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="modal-content" style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', width: '300px', textAlign: 'center' }}>
            <h2>Change Password</h2>
            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input
                type="password"
                placeholder="Old Password"
                value={passwords.oldPassword}
                onChange={(e) => setPasswords({ ...passwords, oldPassword: e.target.value })}
                required
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', color: '#000' }}
              />
              <input
                type="password"
                placeholder="New Password"
                value={passwords.newPassword}
                onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                required
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', color: '#000' }}
              />
              <input
                type="password"
                placeholder="Confirm New Password"
                value={passwords.confirmPassword}
                onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                required
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', color: '#000' }}
              />
              <button type="submit" style={{ padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                Submit
              </button>
              <button type="button" onClick={() => setShowModal(false)} style={{ padding: '10px', backgroundColor: '#ccc', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                Cancel
              </button>
            </form>
            {message && <p style={{ marginTop: '10px', color: message.includes('success') ? 'green' : 'red' }}>{message}</p>}
          </div>
        </div>
      )}
    </>
  );
};

export default MediConnectNavbar;
