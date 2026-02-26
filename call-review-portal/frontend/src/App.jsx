import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import ConsultantDashboard from './pages/ConsultantDashboard';
import LeadDashboard from './pages/LeadDashboard';
import ProtectedRoute from './components/ProtectedRoute';

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route 
          path="/consultant" 
          element={
            <ProtectedRoute role="consultant">
              <ConsultantDashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/lead" 
          element={
            <ProtectedRoute role="lead">
              <LeadDashboard />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </Router>
  );
};

export default App;