// src/routes.jsx
import React from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import Dashboard from './hospitals/Dashboard';
import PatientList from './hospitals/PatientList';
import ShareData from './hospitals/ShareData';
import PatientDetail from './hospitals/PatientDetail';
import Landing from './mediconnectai/Landing';
import Insights from './mediconnectai/Insights';
import Login from './mediconnectai/Login';
import HospitalOverview from './mediconnectai/HospitalOverview';
import SharedPatientDirectory from './mediconnectai/SharedPatientDirectory';
import RequireRole from './auth/RequireRole';

const RoutesComponent = () => {
  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to="/mediconnectai/landing" replace />} />
        <Route path="/mediconnectai/landing" element={<Landing />} />
        <Route path="/hospitals/dashboard" element={<Dashboard />} />
        <Route path="/hospitals/patient-list" element={<PatientList />} />
        <Route path="/hospitals/share-data" element={<ShareData />} />
        <Route path="/hospitals/patient/:id" element={<PatientDetail />} />   {}
        <Route path="/mediconnectai/insights" element={<Insights />} />
        <Route path="/mediconnectai/login" element={<Login />} />
        <Route path="/mediconnectai/hospital-overview" element={<RequireRole allowedRoles={['admin']}> <HospitalOverview /> </RequireRole>}/>
        <Route path="/mediconnectai/shared-patient-directory" element={<SharedPatientDirectory />} />
        <Route path="/mediconnectai/patient/:id" element={<PatientDetail />} />
      </Routes>
    </>
  );
};

export default RoutesComponent;
