import React, { useState } from 'react';
import '../styles/login.css';

const roleCopy = {
  admin: 'Hospital operations, analyst oversight, and policy controls.',
  analyst: 'Shared patient review and specialty-specific triage.',
  patient: 'Personal health portal and AI-assisted consultation view.',
};

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState('admin');
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('user', JSON.stringify(data));

        if (data.role === 'admin') {
          window.location.href = '/mediconnectai/hospital-overview';
        } else if (data.role === 'patient') {
          window.location.href = '/mediconnectai/patient-portal';
        } else {
          window.location.href = '/mediconnectai/shared-patient-directory';
        }
      } else {
        setError(data.detail || 'Login failed');
      }
    } catch (err) {
      setError('Server error. Is the backend running?');
    }
  };

  return (
    <div className="login-container">
      <div className="login-shell">
        <section className="landing-card login-intro">
          <span className="landing-kicker">Secure access</span>
          <h1>Sign in to MediConnectAI</h1>
          <p>
            Choose the role that matches the task you need to perform. The interface adapts to keep the important
            actions visible and the rest out of the way.
          </p>

          <div className="login-points">
            <div className="login-point">
              <div className="status-pill">Admin</div>
              <div>
                <strong>Operational control</strong>
                <span>{roleCopy.admin}</span>
              </div>
            </div>
            <div className="login-point">
              <div className="status-pill">Analyst</div>
              <div>
                <strong>Clinical routing</strong>
                <span>{roleCopy.analyst}</span>
              </div>
            </div>
            <div className="login-point">
              <div className="status-pill">Patient</div>
              <div>
                <strong>Patient portal</strong>
                <span>{roleCopy.patient}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="login-box">
          <h2>Welcome back</h2>
          <p className="login-subtitle">Use your role credentials to continue.</p>

          <form className="login-form" onSubmit={handleLogin}>
            <div className="role-selector">
              <div className="role-selector-label">
                <span>Account role</span>
                <span>{roleCopy[role]}</span>
              </div>
              <div className="role-toggle">
                {['admin', 'analyst', 'patient'].map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={option === role ? 'active' : ''}
                    onClick={() => setRole(option)}
                  >
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <input
              type={role === 'patient' ? 'text' : 'email'}
              placeholder={role === 'patient' ? 'National ID' : 'Email address'}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />

            <input
              type={showPassword ? 'text' : 'password'}
              placeholder={role === 'patient' ? 'National ID password' : 'Password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />

            <div className="helper-row">
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={() => setShowPassword((value) => !value)}
                />
                Reveal password
              </label>
            </div>

            <button type="submit">Login</button>
            {error && <p className="login-feedback">{error}</p>}
          </form>
        </section>
      </div>
    </div>
  );
};

export default Login;
