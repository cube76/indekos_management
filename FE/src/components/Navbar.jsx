import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { Home, CreditCard, ShieldCheck, LogOut, Globe, Bell, BellOff, Menu, X } from 'lucide-react';
import api from '../services/api';
import { checkNotificationPermission, subscribeUser } from '../utils/notifications';

function Navbar() {
  const location = useLocation();
  const [overdueCount, setOverdueCount] = useState(0);
  const [notifPermission, setNotifPermission] = useState(Notification.permission);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { t, language, toggleLanguage } = useLanguage();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    // 1. Poll for Overdue Badge
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
    
    // 2. Check Notification Permission
    setNotifPermission(Notification.permission);

    return () => clearInterval(interval);
  }, [location.pathname]);

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const handleNotificationClick = async () => {
    if (notifPermission === 'granted') {
        alert(t('enableNotifDesc')); 
        return;
    }

    const permission = await checkNotificationPermission();
    setNotifPermission(permission);
    if (permission === 'granted') {
        alert(t('enableNotifDesc'));
    }
  };

  if (location.pathname === '/login') return null;
  const token = localStorage.getItem('token');
  if (!token) return null;

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  const isActive = (path) => location.pathname === path;

  const NavItem = ({ to, icon: Icon, label, badgeCount, onClick }) => (
    <Link 
      to={to} 
      className={`nav-link ${isActive(to) ? 'active' : ''}`}
      onClick={onClick}
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '0.75rem', 
        textDecoration: 'none', 
        color: isActive(to) ? 'var(--primary-color)' : '#64748b', 
        fontWeight: 500,
        padding: '0.5rem 0'
      }}
    >
      <Icon size={20} />
      <span>{label}</span>
      {badgeCount > 0 && (
        <span className="badge" style={{ 
          background: 'var(--danger-color)', 
          color: 'white', 
          borderRadius: '999px', 
          padding: '0.1rem 0.5rem', 
          fontSize: '0.7rem',
          marginLeft: 'auto'
        }}>
          {badgeCount}
        </span>
      )}
    </Link>
  );

  const role = localStorage.getItem('role');

  return (
    <>
      <nav className="navbar" style={{ 
          background: 'white', 
          borderBottom: '1px solid #e2e8f0', 
          padding: '0.75rem 0',
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          position: 'relative',
          zIndex: 50
      }}>
        <div className="container nav-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          
          {/* Mobile Hamburger Button - Moved to Left */}
          <button 
            className="mobile-menu-btn"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-main)', padding: '0.5rem', marginLeft: '-0.5rem' }}
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          {/* Desktop Navigation */}
          <div className="nav-links desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            <NavItem to="/dashboard" icon={Home} label={t('dashboard')} badgeCount={overdueCount} />
            <NavItem to="/payments" icon={CreditCard} label={t('paymentHistory')} />
            {role === 'superadmin' && (
               <NavItem to="/admin" icon={ShieldCheck} label="Admin Panel" />
            )}
          </div>

          {/* Right Side: Language & Logout (Desktop) */}
          <div className="desktop-actions" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
             {/* Notification Bell */}
             <button 
              onClick={handleNotificationClick}
              className="btn-icon"
              style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  padding: '0.4rem', 
                  cursor: 'pointer',
                  color: notifPermission === 'granted' ? 'var(--primary-color)' : '#94a3b8',
                  display: 'flex',
                  alignItems: 'center'
              }}
              title={notifPermission === 'granted' ? 'Notifications Enabled' : t('enableNotif')}
            >
              {notifPermission === 'granted' ? <Bell size={20} /> : <BellOff size={20} />}
            </button>

            <button 
              onClick={toggleLanguage} 
              className="btn-icon"
              style={{ 
                  background: 'transparent', 
                  border: '1px solid #e2e8f0', 
                  borderRadius: '8px',
                  padding: '0.4rem 0.8rem', 
                  fontSize: '0.9rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem',
                  cursor: 'pointer',
                  color: '#475569'
              }}
            >
              <Globe size={18} />
              <span style={{ fontWeight: 500 }}>{language === 'id' ? 'ID' : 'EN'}</span>
            </button>

            <button 
              onClick={handleLogout} 
              className="btn-icon"
              style={{ 
                  background: '#fee2e2', 
                  border: 'none', 
                  borderRadius: '8px', 
                  padding: '0.4rem 0.8rem', 
                  color: '#dc2626',
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem',
                  cursor: 'pointer',
                  fontWeight: 500
              }}
            >
              <LogOut size={18} />
              {t('logout')}
            </button>
          </div>

          {/* Mobile Hamburger Button */}
          

        </div>
      </nav>

      {/* Mobile Sidebar Overlay */}
      <div 
        className={`mobile-sidebar-overlay ${isMobileMenuOpen ? 'open' : ''}`}
        onClick={() => setIsMobileMenuOpen(false)}
      ></div>

      {/* Mobile Sidebar */}
      <div className={`mobile-sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
        <div className="sidebar-header" style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
            <button onClick={() => setIsMobileMenuOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
              <X size={24} />
            </button>
        </div>
        
        <div className="sidebar-content" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <NavItem to="/dashboard" icon={Home} label={t('dashboard')} badgeCount={overdueCount} />
            <NavItem to="/payments" icon={CreditCard} label={t('paymentHistory')} />
            {role === 'superadmin' && (
               <NavItem to="/admin" icon={ShieldCheck} label="Admin Panel" />
            )}

            <div style={{ height: '1px', background: '#e2e8f0', margin: '0.5rem 0' }}></div>

            {/* Notification Toggle in Mobile */}
             <button 
              onClick={handleNotificationClick}
              className="nav-link"
              style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  padding: '0.5rem 0', 
                  cursor: 'pointer',
                  color: notifPermission === 'granted' ? 'var(--primary-color)' : '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  width: '100%',
                  fontSize: '1rem',
                  fontWeight: 500
              }}
            >
              {notifPermission === 'granted' ? <Bell size={20} /> : <BellOff size={20} />}
              <span>{notifPermission === 'granted' ? 'Notifications On' : 'Enable Notifications'}</span>
            </button>

            <button 
              onClick={toggleLanguage} 
              className="nav-link"
              style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  padding: '0.5rem 0', 
                  cursor: 'pointer',
                  color: '#64748b',
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.75rem',
                  width: '100%',
                  fontSize: '1rem',
                  fontWeight: 500
              }}
            >
              <Globe size={20} />
              <span>{language === 'id' ? 'Bahasa Indonesia' : 'English'}</span>
            </button>

             <button 
              onClick={handleLogout} 
              className="nav-link"
              style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  padding: '0.5rem 0', 
                  color: '#dc2626',
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.75rem',
                  width: '100%',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: 500,
                  marginTop: 'auto'
              }}
            >
              <LogOut size={20} />
              <span>{t('logout')}</span>
            </button>
        </div>
      </div>
    </>
  );
}

export default Navbar;
