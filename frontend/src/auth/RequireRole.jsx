import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

const RequireRole = ({ children, allowedRoles }) => {
  const user = JSON.parse(localStorage.getItem('user'));
  const location = useLocation();

  // If not logged in, redirect to login and save the current location
  if (!user) {
    return <Navigate to="/mediconnectai/login" replace state={{ from: location }} />;
  }

  // If role is not allowed
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/mediconnectai/login" replace />;
  }

  return children;
};

export default RequireRole;
