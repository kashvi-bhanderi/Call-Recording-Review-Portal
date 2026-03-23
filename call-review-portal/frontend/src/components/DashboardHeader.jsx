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
      navigate("/");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const handleUpdatePassword = () => {
    navigate("/update-password");
  };

  return (
    <div className="dashboard-header">
      <h2>{title}</h2>

      <div style={{ display: "flex", gap: "10px" }}>
        <button className="logout-btn" onClick={handleUpdatePassword}>
          Update Password
        </button>

        <button className="logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </div>
  );
};

export default DashboardHeader;