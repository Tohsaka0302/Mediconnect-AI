import React, { useState, useEffect } from 'react';
import { NavLink, Link } from 'react-router-dom';
import '../styles/mediconnectnavbar.css';
import { authFetch } from '../utils/authFetch';

const MediConnectNavbar = () => {
  const user = JSON.parse(localStorage.getItem('user'));
  const [showModal, setShowModal] = useState(false);
  const [passwords, setPasswords] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [message, setMessage] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [hasConflicts, setHasConflicts] = useState(false);

  useEffect(() => {
    if (user?.role === 'admin') {
      const checkConflicts = async () => {
        try {
          const res = await fetch('/api/data-conflicts');
          if (res.ok) {
            const data = await res.json();
            const pending = data.some(c => c.status === 'Pending');
            setHasConflicts(pending);
          }
        } catch (err) {
          console.error('Error checking conflicts:', err);
        }
      };
      checkConflicts();
    }
  }, [user?.role]);

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
      const response = await authFetch('/api/users/change-password', {
        method: 'PUT',
        body: JSON.stringify({
          email: user.email,
          old_password: passwords.oldPassword,
          new_password: passwords.newPassword,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setMessage('Password changed successfully');
        setTimeout(() => setShowModal(false), 1400);
      } else {
        setMessage(data.detail || 'Error changing password');
      }
    } catch (error) {
      setMessage('Network error');
    }
  };

  const navItemClass = ({ isActive }) => (isActive ? 'active' : '');

  return (
    <>
      <nav className="navbar">
        <div className="navbar-brand">
          <Link to="/mediconnectai/landing" className="navbar-logo">MediConnectAI</Link>
          <span className="navbar-tag">Secure care coordination</span>
        </div>

        <ul className="navbar-links">
          <li><NavLink to="/mediconnectai/landing" className={navItemClass}>Home</NavLink></li>

          {(user?.role === 'admin' || user?.role === 'analyst') && (
            <li><NavLink to="/mediconnectai/shared-patient-directory" className={navItemClass}>Shared Patients</NavLink></li>
          )}

          {user?.role === 'admin' && (
            <>
              <li><NavLink to="/mediconnectai/hospital-overview" className={navItemClass}>Hospital Overview</NavLink></li>
              <li><NavLink to="/mediconnectai/manage-analyst" className={navItemClass}>Manage Analysts</NavLink></li>
              <li><NavLink to="/mediconnectai/removal-requests" className={navItemClass}>Removal Requests</NavLink></li>
              {hasConflicts && (
                <li><NavLink to="/mediconnectai/conflict-review" className={navItemClass}>Conflict Review</NavLink></li>
              )}
            </>
          )}

          {user?.role === 'patient' && (
            <li><NavLink to="/mediconnectai/patient-portal" className={navItemClass}>My Health Portal</NavLink></li>
          )}

          {!user ? (
            <li className="nav-cta"><NavLink to="/mediconnectai/login" className={navItemClass}>Login</NavLink></li>
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

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-panel">
            <h2>Change Password</h2>
            <p className="modal-copy">Update your login credentials without leaving the app.</p>
            <form onSubmit={handleChangePassword} className="modal-form">
              <input
                type={showPasswords ? 'text' : 'password'}
                placeholder="Old password"
                value={passwords.oldPassword}
                onChange={(e) => setPasswords({ ...passwords, oldPassword: e.target.value })}
                required
              />
              <input
                type={showPasswords ? 'text' : 'password'}
                placeholder="New password"
                value={passwords.newPassword}
                onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                required
              />
              <input
                type={showPasswords ? 'text' : 'password'}
                placeholder="Confirm new password"
                value={passwords.confirmPassword}
                onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                required
              />
              <label>
                <input
                  type="checkbox"
                  checked={showPasswords}
                  onChange={() => setShowPasswords((value) => !value)}
                />
                Reveal password
              </label>
              <div className="modal-actions">
                <button type="submit" className="btn-primary">Save changes</button>
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              </div>
            </form>
            {message && <p className={message.includes('success') ? 'section-note' : 'login-feedback'}>{message}</p>}
          </div>
        </div>
      )}
    </>
  );
};

export default MediConnectNavbar;
