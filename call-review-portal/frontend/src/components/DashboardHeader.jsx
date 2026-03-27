import React from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../api/axiosInstance";
import "../pages/Dashboard.css";
import toast from "react-hot-toast";

const DashboardHeader = ({ title }) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await axiosInstance.post("/auth/logout/");
      localStorage.removeItem("role");
      localStorage.removeItem("selectedOrg");
      localStorage.removeItem("selectedTemplate");
      toast.success("Logout successful");

      setTimeout(() => {
        navigate("/");
      }, 800);
    } catch (error) {
      toast.error("Logout failed");
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