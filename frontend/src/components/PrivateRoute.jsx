import React from 'react';
import { Navigate } from 'react-router-dom';

const PrivateRoute = ({ token, children }) => {
  const authToken =
    token ||
    sessionStorage.getItem('token') ||
    localStorage.getItem('access_token') ||
    localStorage.getItem('token');

  if (!authToken) {
    return <Navigate to="/" replace />;
  }
  return children;
};

export default PrivateRoute;
