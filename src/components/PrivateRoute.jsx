import React from 'react';
import { Navigate } from 'react-router-dom';

export const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem("iw_token");
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

export const AdminRoute = ({ children }) => {
  const token = localStorage.getItem("iw_token");
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  
  try {
    const userStr = localStorage.getItem("iw_user");
    const user = userStr ? JSON.parse(userStr) : null;
    if (user?.role !== "superAdmin") {
      return <Navigate to="/" replace />;
    }
  } catch (error) {
    console.error("Error parsing user role in AdminRoute:", error);
    return <Navigate to="/" replace />;
  }
  
  return children;
};
