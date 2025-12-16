import React, { useState } from 'react';
import '../styles/dashboard.css';

const ShareData = () => {
  const [isShared, setIsShared] = useState(false);

  const toggleShare = () => {
    setIsShared((prev) => !prev);
    alert(`Data ${!isShared ? 'shared with' : 'unshared from'} MediConnectAI`);
  };
  
  const goToMediConnectAI = () => {

    window.location.href = "http://localhost:3000/mediconnectai/Landing"; 
  };

  return (
    <div className="dashboard">
      <h1>🔄 Share Data with MediConnectAI</h1>
      <p>This setting controls whether your hospital’s patient data is shared with the MediConnectAI system for analysis.</p>

      <div style={{ marginTop: '20px' }}>
        <button
          onClick={toggleShare}
          style={{ backgroundColor: isShared ? 'red' : 'green', color: 'white' }}
        >
          {isShared ? '🔒 Stop Sharing' : '🔓 Share Now'}
        </button>
      </div>

      {/* Button to navigate to MediConnectAI */}
      <div style={{ marginTop: '20px' }}>
        <button onClick={goToMediConnectAI} style={{ backgroundColor: 'blue', color: 'white' }}>
          Go to MediConnectAI Landing Page
        </button>
      </div>
    </div>
  );
};

export default ShareData;
