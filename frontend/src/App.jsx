import React from 'react';
import RoutesComponent from './routes';
import MediConnectNavbar from './components/MediConnectNavbar';

const App = () => {
  return (
    <div className="app-shell">
      <MediConnectNavbar />
      <RoutesComponent />
    </div>
  );
};

export default App;
