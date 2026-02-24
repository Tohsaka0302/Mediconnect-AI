import React from 'react';
import { useLocation } from 'react-router-dom';
import RoutesComponent from './routes';
import MediConnectNavbar from './components/MediConnectNavbar';

const App = () => {
  return (
    <div>
      <MediConnectNavbar />
      <RoutesComponent />
    </div>
  );
};

export default App;
