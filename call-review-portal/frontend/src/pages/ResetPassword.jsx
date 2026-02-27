import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axiosInstance from "../api/axiosInstance";
import "./Login.css"; // reuse styling

const ResetPassword = () => {
  const { uid, token } = useParams();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axiosInstance.post(`/auth/reset-password/${uid}/${token}/`, {
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setMessage("Password reset successful. Redirecting to login...");
      setTimeout(() => navigate("/"), 2000);
    } catch (err) {
      setError(err.response?.data?.non_field_errors || "Invalid or expired link");
    }
  };

  return (
    <div className="login-container">
      <form className="login-form" onSubmit={handleSubmit}>
        <h2>Reset Password</h2>
        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}
        <input
          type="password"
          placeholder="New Password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Confirm Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
        <button type="submit">Reset Password</button>
      </form>
    </div>
  );
};

export default ResetPassword;