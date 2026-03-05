import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: "http://localhost:8000",
  withCredentials: true,   // VERY IMPORTANT
});

axiosInstance.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        await axiosInstance.post('/auth/refresh/');
        return axiosInstance(originalRequest);
      } catch (err) {
        localStorage.removeItem('role');
        window.location.href = "/";
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;