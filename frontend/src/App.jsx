import React from 'react';
import { useLocation } from 'react-router-dom';
import RoutesComponent from './routes';
import HospitalNavbar from './components/HospitalNavbar';
import MediConnectNavbar from './components/MediConnectNavbar';

const App = () => {
  const location = useLocation();

  const isHospital = location.pathname.startsWith('/hospitals');
  const isMediConnect = location.pathname.startsWith('/mediconnectai');

  return (
    <div>
      {isHospital && <HospitalNavbar />}
      {isMediConnect && <MediConnectNavbar />}

      <RoutesComponent />
    </div>
  );
};

export default App;
