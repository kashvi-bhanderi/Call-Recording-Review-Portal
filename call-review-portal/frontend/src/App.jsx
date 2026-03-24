import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from "react-hot-toast";

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
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: "#ffffff",
            color: "#1f2937",
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            padding: "14px 16px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
            fontSize: "14px",
            fontWeight: "500",
          },
          success: {
            style: {
              borderLeft: "5px solid #10b981",
            },
            iconTheme: {
              primary: "#10b981",
              secondary: "#ffffff",
            },
          },
          error: {
            style: {
              borderLeft: "5px solid #ef4444",
            },
            iconTheme: {
              primary: "#ef4444",
              secondary: "#ffffff",
            },
          },
        }}
      />

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
    </>
  );
};

export default App;