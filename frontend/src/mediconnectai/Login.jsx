import React, { useState } from 'react';
import '../styles/login.css';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState('admin');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async () => {
    setError('');
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role }),
      });

      const data = await response.json();

      if (response.ok) {
        // Store full response including JWT token
        localStorage.setItem('user', JSON.stringify(data));

        if (data.role === 'admin') {
          window.location.href = '/mediconnectai/hospital-overview';
        } else {
          window.location.href = '/mediconnectai/shared-patient-directory';
        }
      } else {
        setError(data.detail || 'Login failed');
      }
    } catch (err) {
      console.error(err);
      setError('Server error. Is the backend running?');
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>Login to MediConnectAI</h2>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type={showPassword ? 'text' : 'password'}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '20px',
          cursor: 'pointer',
          userSelect: 'none',
          lineHeight: '1',
        }}>
          <input
            type="checkbox"
            checked={showPassword}
            onChange={() => setShowPassword(!showPassword)}
            style={{ width: '15px', height: '15px', margin: '0', cursor: 'pointer', accentColor: 'var(--accent-primary, #764bff)', verticalAlign: 'middle', flexShrink: 0 }}
          />
          <span style={{
            fontSize: '0.82rem',
            color: 'var(--text-muted, #888)',
            letterSpacing: '0.3px',
            lineHeight: '1',
          }}>
            Reveal password
          </span>
        </label>

        <select onChange={(e) => setRole(e.target.value)} value={role}>
          <option value="admin">Admin</option>
          <option value="analyst">Analyst</option>
        </select>

        <button onClick={handleLogin}>Login</button>

        {error && <p style={{ color: 'red' }}>{error}</p>}
      </div>
    </div>
  );
};

export default Login;