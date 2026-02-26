import React, { useState } from 'react';
import axiosInstance, { setAuthToken } from '../api/axiosInstance';
import './Login.css'; // optional for styling if you want custom CSS

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    console.log("LOGIN CLICKED");
    try {
      const response = await axiosInstance.post('/auth/login/', {
        username,
        password
      });

      // make sure backend returns role
      const { access, refresh, role } = response.data;

      const roleMap = {
        1: 'consultant',
        2: 'lead'
      };

      const userRole = roleMap[role];

      // Store tokens and role
      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);
      localStorage.setItem('role', userRole);

      // Set token in axios header
      setAuthToken(access);

      // Redirect based on role
      if (userRole === 'consultant') {
        window.location.href = '/consultant';
      } 
      else if (userRole === 'lead') {
        window.location.href = '/lead';
      }

    } catch (err) {
      setError('Invalid credentials');
    }
  };

  return (
    <div className="login-container">

      <form className="login-form" onSubmit={handleLogin}>

        <h2>Sign In</h2>

        {error && (
          <p className="error">{error}</p>
        )}

        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button type="submit">
          Login
        </button>

        <p className="forgot-password">
          Forgot Password?
        </p>

      </form>

    </div>
  );
};

export default Login;