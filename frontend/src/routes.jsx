// src/routes.jsx
import React from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import Landing from './mediconnectai/Landing';
import Login from './mediconnectai/Login';
import HospitalOverview from './mediconnectai/HospitalOverview';
import ManageAnalyst from './mediconnectai/ManageAnalyst';
import SharedPatientDirectory from './mediconnectai/SharedPatientDirectory';
import MediconnectPatientDetail from './mediconnectai/PatientDetail'; // New import
import MediConnectRemovalRequests from './mediconnectai/RemovalRequests';
import RequireRole from './auth/RequireRole';

const RoutesComponent = () => {
  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to="/mediconnectai/landing" replace />} />
        <Route path="/mediconnectai/landing" element={<Landing />} />
        <Route path="/mediconnectai/login" element={<Login />} />
        <Route path="/mediconnectai/hospital-overview" element={<RequireRole allowedRoles={['admin']}> <HospitalOverview /> </RequireRole>} />
        <Route path="/mediconnectai/shared-patient-directory" element={<SharedPatientDirectory />} />
        <Route path="/mediconnectai/manage-analyst" element={<RequireRole allowedRoles={['admin']}> <ManageAnalyst /> </RequireRole>} />
        <Route path="/mediconnectai/removal-requests" element={<RequireRole allowedRoles={['admin']}> <MediConnectRemovalRequests /> </RequireRole>} />
        <Route path="/mediconnectai/patient/:id" element={<MediconnectPatientDetail />} />
      </Routes>
    </>
  );
};

export default RoutesComponent;
