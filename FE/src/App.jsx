import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import api from './services/api'; // Import API
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import RoomDetail from './pages/RoomDetail';
import PaymentHistory from './pages/PaymentHistory';
import AdminPanel from './pages/AdminPanel';
import GlobalLoader from './components/GlobalLoader';

// Helper to convert VAPID key
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
 
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
 
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const PUBLIC_VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

// Navbar Component
function Navbar() {
  const location = useLocation();
  const [overdueCount, setOverdueCount] = React.useState(0);

  React.useEffect(() => {
    // Only check if logged in
    const token = localStorage.getItem('token');
    if (!token) return;

    // 1. Check/Register Service Worker
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.register('/sw.js')
      .then(async (registration) => {
        console.log('SW Registered');
        
        // Check existing subscription
        let subscription = await registration.pushManager.getSubscription();
        
        if (!subscription) {
           // Subscribe if not exists
           subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
           });
           
           // Send to Backend
           await api.post('/notifications/subscribe', subscription);
           console.log('Subscribed to Push Notifications');
        }
      })
      .catch(err => console.error('SW Error:', err));
    }

    // 2. Poll for Overdue Badge (Visual Fallback)
    const checkNotifications = async () => {
      try {
        const response = await api.get('/rooms');
        const count = response.data.filter(r => r.isOverdue).length;
        setOverdueCount(count);
      } catch (error) {
        console.error('Failed to fetch rooms for notification:', error);
      }
    };

    checkNotifications();
    const interval = setInterval(checkNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [location.pathname]);

  if (location.pathname === '/login') return null;
  
  // Hide Navbar if no token (prevent flashing on protected routes before redirect)
  const token = localStorage.getItem('token');
  if (!token) return null;

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  return (
    <nav className="navbar">
      <div className="container nav-content">
        <Link to="/dashboard" style={{ textDecoration: 'none', color: 'var(--primary-color)', fontSize: '1.5rem', fontWeight: 'bold' }}>
          Residence Admin
        </Link>
        <div className="nav-links">
          <Link to="/dashboard" className={`nav-link ${location.pathname === '/dashboard' ? 'active' : ''}`}>
            Dashboard
            {overdueCount > 0 && (
              <span className="badge" style={{ 
                background: 'var(--danger-color)', 
                color: 'white', 
                borderRadius: '50%', 
                padding: '0.2rem 0.6rem', 
                fontSize: '0.8rem',
                marginLeft: '0.5rem'
              }}>
                {overdueCount}
              </span>
            )}
          </Link>
          <Link to="/payments" className={`nav-link ${location.pathname === '/payments' ? 'active' : ''}`}>Payment History</Link>
          
          {/* Admin Panel Link */}
           {(() => {
              const role = localStorage.getItem('role'); // Get role here or pass as prop
              return role === 'superadmin' && (
                  <Link to="/admin" className={`nav-link ${location.pathname === '/admin' ? 'active' : ''}`}>Admin Panel</Link>
              );
           })()}

          <button onClick={handleLogout} className="btn btn-secondary" style={{ marginLeft: '1rem' }}>Logout</button>
        </div>
      </div>
    </nav>
  );
}

// Protected Route Wrapper
const ProtectedRoute = ({ children }) => {
  const [isValid, setIsValid] = React.useState(null);
  const location = useLocation();

  React.useEffect(() => {
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

function App() {
  return (
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
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
