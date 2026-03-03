import React, { useState } from 'react';
import axiosInstance from '../api/axiosInstance';
import './Login.css'; 
import { FaEye, FaEyeSlash } from "react-icons/fa";

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false); 

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const response = await axiosInstance.post('/auth/login/', {
        username,
        password
      });

      const { role } = response.data;

      const roleMap = {
        1: 'consultant',
        2: 'lead'
      };

      const userRole = roleMap[role];

      //  STORE ONLY ROLE
      localStorage.setItem('role', userRole);


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


        <div className="password-field">

          <input
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <span
            className="toggle-password"
            onClick={() => setShowPassword(!showPassword)}
          >

            {showPassword ? <FaEyeSlash /> : <FaEye />}

          </span>

        </div>



        <button type="submit">

          Login

        </button>



        <p className="forgot-password" onClick={() => window.location.href="/forgot-password"}>
        Forgot Password?
        </p>

      </form>


    </div>

  );

};


export default Login;