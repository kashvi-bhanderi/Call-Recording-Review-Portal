import React from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../api/axiosInstance";
import "../pages/Dashboard.css";

const DashboardHeader = ({ title }) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await axiosInstance.post("/auth/logout/");
      localStorage.removeItem("role");
      localStorage.removeItem("access");
      localStorage.removeItem("refresh");
      navigate("/");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <div className="dashboard-header">
      <h2>{title}</h2>
      <button className="logout-btn" onClick={handleLogout}>
        Logout
      </button>
    </div>
  );
};

export default DashboardHeader;