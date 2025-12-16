import React, { useState } from 'react';
import '../styles/login.css';
import { useNavigate } from 'react-router-dom';


const mockUsers = [
  { email: 'admin@ai.com', password: 'admin123', role: 'admin' },
  { email: 'analyst@ai.com', password: 'analyst123', role: 'analyst' },
];

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('admin');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = () => {
    const user = mockUsers.find(
      (u) => u.email === email && u.password === password && u.role === role
    );

    if (user) {
      localStorage.setItem('user', JSON.stringify(user));

      if (role === 'admin') {
        navigate('/mediconnectai/hospital-overview');
      } else {
        navigate('/mediconnectai/insights');
      }
    } else {
      setError('Invalid credentials or role mismatch.');
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
