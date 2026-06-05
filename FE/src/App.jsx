import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { useLanguage } from './context/LanguageContext';
import api from './services/api'; // Import API
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import RoomDetail from './pages/RoomDetail';
import PaymentHistory from './pages/PaymentHistory';
import AdminPanel from './pages/AdminPanel';
import PdfPreviewPage from './pages/PdfPreviewPage';
import GlobalLoader from './components/GlobalLoader';


import { subscribeUser } from './utils/notifications';

// Navbar Component moved to ./components/Navbar.jsx
import Navbar from './components/Navbar';

// Protected Route Wrapper
const ProtectedRoute = ({ children }) => {
  const [isValid, setIsValid] = React.useState(null);
  const location = useLocation();

  React.useEffect(() => {
    // 1. Initial SW Registration (Global)
    if ('serviceWorker' in navigator) {
      // 1. First, clear out any old ghosts
      navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for(let registration of registrations) {
          registration.unregister();
        }
      }).then(() => {
        // 2. Then, safely register your brand new Service Worker
        navigator.serviceWorker.register('/sw.js')
          .then(registration => {
              console.log('NEW Service Worker Registered successfully!');
          })
          .catch(err => console.error('SW Error:', err));
      });
    }

    const verifyToken = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setIsValid(false);
        return;
      }

      try {
        await api.get('/auth/verify');
        setIsValid(true);
      } catch (error) {
        console.error('Token verification failed:', error);
        localStorage.removeItem('token');
        setIsValid(false);
      }
    };

    verifyToken();
  }, [location.pathname]);

  if (isValid === null) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>; // Or a spinner
  }

  if (!isValid) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

import { LanguageProvider } from './context/LanguageContext';

function App() {
  return (
    <LanguageProvider>
      <Router>
        <GlobalLoader />
      <Navbar />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
         {/* Placeholders until files are created */}
        <Route path="/room/:id" element={
          <ProtectedRoute>
             <RoomDetail />
          </ProtectedRoute>
        } />
        <Route path="/payments" element={
          <ProtectedRoute>
             <PaymentHistory />
          </ProtectedRoute>
        } />
        <Route path="/admin" element={
          <ProtectedRoute>
             <AdminPanel />
          </ProtectedRoute>
        } />
        <Route path="/preview" element={
          <ProtectedRoute>
             <PdfPreviewPage />
          </ProtectedRoute>
        } />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
    </LanguageProvider>
  );
}

export default App;
