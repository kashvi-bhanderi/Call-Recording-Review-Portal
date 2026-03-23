
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ProtectedRoute from './components/ProtectedRoute';
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import CallReview from "./pages/CallReview";
import LeadReview from "./pages/LeadReview";
import UpdatePassword from "./pages/UpdatePassword";
const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />

        <Route 
          path="/consultant" 
          element={
            <ProtectedRoute role="consultant">
              <Dashboard role="consultant" />
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/lead" 
          element={
            <ProtectedRoute role="lead">
              <Dashboard role="lead" />
            </ProtectedRoute>
          } 
        />
        <Route path="/consultant/review/:uuid" element={<CallReview />} />
        <Route path="/lead/review/:uuid" element={<LeadReview />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:uid/:token" element={<ResetPassword />} /> 
        <Route path="/update-password" element={<UpdatePassword />} />
      </Routes>
    </Router>
  );
};

export default App;