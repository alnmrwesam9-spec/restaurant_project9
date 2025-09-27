import React from 'react';
import { Navigate } from 'react-router-dom';

const PrivateRoute = ({ token, children }) => {
  if (!token) {
    return <Navigate to="/" replace />;
  }
  return children;
};

export default PrivateRoute;


