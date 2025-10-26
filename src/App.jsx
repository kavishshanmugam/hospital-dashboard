import React, { useEffect, useState, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { auth } from './config/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import PatientDetail from './pages/PatientDetail';
import AddPatient from './pages/AddPatient';
import Archive from './pages/Archive';
import { createMockMeasurement, padBoxAPI } from './utils/ehrDummyData';

// Create context for user authentication
const AuthContext = createContext(null);

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // Real Firebase user logged in
        setUser(firebaseUser);
      } else {
        // No user logged in
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Simulate smart pad box measurements for demo (remove for production)
  useEffect(() => {
    if (!user) return;

    const simulateMeasurement = async () => {
      try {
        const mockMeasurement = createMockMeasurement({
          unitId: 'DEMO-PAD-001'
        });
        
        await padBoxAPI.submitMeasurement(mockMeasurement);
        console.log('Demo measurement sent:', mockMeasurement);
      } catch (error) {
        console.error('Failed to send demo measurement:', error);
      }
    };

    // Send a demo measurement every 30 seconds
    const interval = setInterval(simulateMeasurement, 30000);
    
    // Send first measurement immediately
    setTimeout(simulateMeasurement, 5000);

    return () => clearInterval(interval);
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Loading Smart Pad Box System...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, handleLogout }}>
        <div className="min-h-screen bg-gray-50">
          {user && <Navbar user={user} onLogout={handleLogout} />}
          <Routes>
            <Route 
              path="/login" 
              element={!user ? <Login /> : <Navigate to="/dashboard" replace />} 
            />
            <Route 
              path="/dashboard" 
              element={user ? <Dashboard /> : <Navigate to="/login" replace />} 
            />
            <Route 
              path="/patients" 
              element={user ? <Patients /> : <Navigate to="/login" replace />} 
            />
            <Route 
              path="/patients/:id" 
              element={user ? <PatientDetail /> : <Navigate to="/login" replace />} 
            />
            <Route 
              path="/add-patient" 
              element={user ? <AddPatient /> : <Navigate to="/login" replace />} 
            />
            <Route 
              path="/archive" 
              element={user ? <Archive /> : <Navigate to="/login" replace />} 
            />
            <Route 
              path="/" 
              element={<Navigate to={user ? "/dashboard" : "/login"} replace />} 
            />
          </Routes>
        </div>
    </AuthContext.Provider>
  );
}

export default App;