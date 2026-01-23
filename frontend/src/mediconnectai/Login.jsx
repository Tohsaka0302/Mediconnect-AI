import React, { useState } from 'react';
import '../styles/login.css';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('admin');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async () => {
    setError(''); // Clear previous errors

    try {
      // 1. Send data to your FastAPI backend
      const response = await fetch('http://localhost:8000/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, role }),
      });

      const data = await response.json();

      if (response.ok) {
        // 2. Success: Save user data and redirect
        localStorage.setItem('user', JSON.stringify(data));

        if (data.role === 'admin') {
          navigate('/mediconnectai/hospital-overview');
        } else {
          navigate('/mediconnectai/insights');
        }
      } else {
        // 3. Fail: Show the error message from Python
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
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

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