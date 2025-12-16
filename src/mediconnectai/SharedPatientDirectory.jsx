import React from 'react';
import '../styles/spd.css';
import { Link } from 'react-router-dom';

const mockPatients = [
  {
    id: 1,
    name: 'Nguyen Van A',
    illness: 'Hypertension',
    hospitals: ['Hospital A', 'Hospital B'],
    suggested: 'Add ARBs to treatment plan',
  },
  {
    id: 2,
    name: 'Tran Thi B',
    illness: 'Diabetes Type 2',
    hospitals: ['Hospital C'],
    suggested: 'Consider switching to GLP-1 analogs',
  },
];

const SharedPatientDirectory = () => {
  return (
    <div className="shared-directory-container">
      <h1>📂 Shared Patient Directory</h1>
      <table className="patient-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Illness</th>
            <th>Hospitals</th>
            <th>AI Suggestion</th>
            <th>Profile</th>
          </tr>
        </thead>
        <tbody>
          {mockPatients.map((patient) => (
            <tr key={patient.id}>
              <td>{patient.name}</td>
              <td>{patient.illness}</td>
              <td>{patient.hospitals.join(', ')}</td>
              <td>{patient.suggested}</td>
              <td>
                <Link to={`/mediconnectai/patient/${patient.id}`}>
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SharedPatientDirectory;
