import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/landing.css';

const Landing = () => {
  return (
    <div className="landing-container">
      <header className="landing-header">
        <h1>MediConnectAI</h1>
        <p>Connecting hospitals, patients, and AI for smarter healthcare management</p>
      </header>

      <main className="landing-main">
        <div className="landing-card">
          <h2>AI-Powered Insights</h2>
          <p>Unlock powerful insights from aggregated patient data across hospitals to improve treatment outcomes.</p>
        </div>

        <div className="landing-card">
          <h2>Collaborative Healthcare</h2>
          <p>See shared patient profiles across multiple hospitals for a more comprehensive healthcare approach.</p>
        </div>
      </main>
    </div>
  );
};

export default Landing;
