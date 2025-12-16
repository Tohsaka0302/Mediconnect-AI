import React from 'react';
import '../styles/hospitaloverview.css';

const HospitalOverview = () => {
  // For demo purposes — static mock data
  const hospitals = [
    { name: 'Hospital A', sharedRecords: 35, lastUpdated: '2025-05-10' },
    { name: 'Hospital B', sharedRecords: 18, lastUpdated: '2025-05-12' },
    { name: 'Hospital C', sharedRecords: 42, lastUpdated: '2025-05-09' },
  ];

  return (
    <div className="overview-container">
      <h1>🏥 Hospital Data Overview</h1>
      <table className="overview-table">
        <thead>
          <tr>
            <th>Hospital Name</th>
            <th>Records Shared</th>
            <th>Last Updated</th>
          </tr>
        </thead>
        <tbody>
          {hospitals.map((hospital, index) => (
            <tr key={index}>
              <td>{hospital.name}</td>
              <td>{hospital.sharedRecords}</td>
              <td>{hospital.lastUpdated}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default HospitalOverview;
