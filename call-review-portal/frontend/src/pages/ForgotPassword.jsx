import React, { useState } from "react";
import axiosInstance from "../api/axiosInstance";
import "./Login.css"; // reuse existing login styling

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axiosInstance.post("/auth/forgot-password/", { email });
      setMessage(response.data.message);
      setError("");
    } catch (err) {
      setError(err.response?.data?.email || "Something went wrong");
      setMessage("");
    }
  };

  return (
    <div className="login-container">
      <form className="login-form" onSubmit={handleSubmit}>
        <h2>Forgot Password</h2>
        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}
        <input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button type="submit">Send Reset Link</button>
      </form>
    </div>
  );
};

export default ForgotPassword;