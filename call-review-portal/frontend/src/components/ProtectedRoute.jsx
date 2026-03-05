import React from "react";
import { Navigate } from "react-router-dom";

const ProtectedRoute = ({ children, role }) => {
  const userRole = localStorage.getItem("role");

  // Not logged in
  if (!userRole) {
    return <Navigate to="/" replace />;
  }

  // Logged in but wrong role
  if (role && userRole !== role) {
    return <Navigate to={`/${userRole}`} replace />;
  }

  return children;
};

export default ProtectedRoute;