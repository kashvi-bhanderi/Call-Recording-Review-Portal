import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import ConsultantDashboard from './pages/ConsultantDashboard';
import LeadDashboard from './pages/LeadDashboard';
import ProtectedRoute from './components/ProtectedRoute';
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

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
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:uid/:token" element={<ResetPassword />} /> 
      </Routes>
    </Router>
  );
};

export default App;
