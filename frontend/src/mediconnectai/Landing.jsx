import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/landing.css';

const Landing = () => {
  return (
    <div className="landing-container">
      <div className="landing-shell">
        <section className="landing-card landing-hero">
          <span className="landing-kicker">Connected care, clearer workflows</span>
          <header className="landing-header">
            <h1>MediConnectAI</h1>
            <p>
              A secure, role-aware workspace for hospitals, analysts, and patients to coordinate care, review insights,
              and move faster with AI-assisted context.
            </p>
          </header>

          <div className="landing-actions">
            <Link to="/mediconnectai/login" className="btn-primary">Sign in</Link>
            <Link to="/mediconnectai/shared-patient-directory" className="btn-secondary">Explore shared patients</Link>
          </div>
        </section>

        <section className="landing-grid">
          <div className="landing-card landing-card--wide">
            <h2>What the platform does</h2>
            <div className="feature-grid">
              <div className="feature-item">
                <strong>Patient visibility</strong>
                <span>Review shared records across hospitals without losing the clinical context.</span>
              </div>
              <div className="feature-item">
                <strong>Role-specific tools</strong>
                <span>Admins, analysts, and patients each get a focused workspace instead of a cluttered dashboard.</span>
              </div>
              <div className="feature-item">
                <strong>AI-assisted triage</strong>
                <span>Highlight urgency, specialty routing, and next steps in a format that is quick to scan.</span>
              </div>
            </div>
          </div>

          <aside className="landing-card landing-card--stack">
            <h2>Design priorities</h2>
            <div className="landing-metrics">
              <div className="landing-metric">
                <strong>Fast</strong>
                <span>Low-friction navigation and clearer action hierarchy.</span>
              </div>
              <div className="landing-metric">
                <strong>Readable</strong>
                <span>Higher contrast, better spacing, and cleaner card surfaces.</span>
              </div>
              <div className="landing-metric">
                <strong>Focused</strong>
                <span>Only the controls that matter for each role appear up front.</span>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
};

export default Landing;
