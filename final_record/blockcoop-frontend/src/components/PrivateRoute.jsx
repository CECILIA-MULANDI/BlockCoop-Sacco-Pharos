import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function PrivateRoute({ element, requiredRole }) {
  const { loading, isConnected, userRole, connect } = useAuth();
  const [error, setError] = useState(null);

  useEffect(() => {
    const tryConnect = async () => {
      if (!isConnected) {
        try {
          await connect();
          setError(null);
        } catch (err) {
          setError(err.message);
        }
      }
    };

    tryConnect();
  }, [isConnected, connect]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-600">Connecting to wallet...</p>
      </div>
    </div>;
  }

  if (error) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="text-center p-4 bg-red-100 rounded-lg">
        <p className="text-red-600">{error}</p>
        <button 
          onClick={() => connect()}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>;
  }

  if (!isConnected || !userRole) {
    return <Navigate to="/" />;
  }

  if (requiredRole && userRole !== requiredRole) {
    // Redirect to appropriate dashboard based on role
    if (userRole === 'owner') return <Navigate to="/owner-dashboard" />;
    if (userRole === 'fundManager') return <Navigate to="/fund-manager" />;
    return <Navigate to="/dashboard" />;
  }

  return element;
}
