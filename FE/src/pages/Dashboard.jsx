import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { formatCurrency } from '../utils/format';
import { useLanguage } from '../context/LanguageContext';
import { checkNotificationPermission } from '../utils/notifications';

function Dashboard() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(null);
  const { t } = useLanguage();

  useEffect(() => {
    fetchRooms();
    checkNotificationPermission();
  }, []);

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const res = await api.get('/rooms');
      const sortedRooms = res.data.sort((a, b) => {
        // Primary Sort: Building Name
        const nameA = a.building_name || '';
        const nameB = b.building_name || '';
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;

        // Secondary Sort: Room Number (Numeric Aware)
        // This handles "1, 2, 10" correctly instead of "1, 10, 2"
        return (a.room_number || '').localeCompare(b.room_number || '', undefined, { numeric: true, sensitivity: 'base' });
      });
      setRooms(sortedRooms);
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  const role = localStorage.getItem('role');

  if (loading) return <div className="container">Loading...</div>;

  return (
    <div className="container">
      {/* Building Tabs */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '2px solid #e2e8f0', marginBottom: '2rem' }}>
          {Object.keys(rooms.reduce((acc, room) => {
              const name = room.building_name || t('unassigned');
              acc[name] = true;
              return acc;
          }, {})).sort().map((buildingName, index) => {
              // Set initial active tab if not set
              if (index === 0 && !activeTab) setActiveTab(buildingName);
              
              const isActive = activeTab === buildingName || (!activeTab && index === 0);
              return (
                  <button 
                    key={buildingName} 
                    onClick={() => setActiveTab(buildingName)}
                    style={{
                        padding: '0.75rem 1.5rem',
                        background: 'none',
                        border: 'none',
                        borderBottom: isActive ? '3px solid var(--primary-color)' : '3px solid transparent',
                        color: isActive ? 'var(--primary-color)' : 'var(--text-secondary)',
                        fontWeight: isActive ? 'bold' : 'normal',
                        cursor: 'pointer',
                        fontSize: '1rem',
                        textTransform: 'capitalize'
                    }}
                  >
                      {buildingName}
                  </button>
              );
          })}
      </div>

      {/* Render Selected Building */}
      {(() => {
          const buildings = Object.keys(rooms.reduce((acc, room) => {
              const name = room.building_name || t('unassigned');
              acc[name] = true;
              return acc;
          }, {})).sort();
          
          const currentTab = activeTab || buildings[0];
          
          if (!currentTab) return <div>{t('noBuildings')}</div>;

          const buildingRooms = rooms.filter(r => (r.building_name || t('unassigned')) === currentTab);
          
          return (
            <div className="card">
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>{t('room')}</th>
                      <th>{t('price')}</th>
                      <th>{t('status')}</th>
                      <th>{t('paymentStatus')}</th>
                      <th>{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buildingRooms.map((room) => (
                      <tr key={room.id}>
                        <td>{room.room_number}</td>
                        <td>{formatCurrency(room.price)}</td>
                        <td>
                          <span className={`status-badge ${room.status === 'filled' ? 'status-filled' : 'status-empty'}`}>
                            {room.status === 'filled' ? t('filled') : t('empty')}
                          </span>
                        </td>
                        <td>
                          {room.status === 'filled' ? (
                            (() => {
                              const isDueSoon = () => {
                                  if (!room.nextDueDate || room.isOverdue) return false;
                                  const today = new Date();
                                  const due = new Date(room.nextDueDate);
                                  const diffTime = due - today;
                                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                  return diffDays <= 7 && diffDays >= 0;
                              };
                              const dueSoon = isDueSoon();
                              return (
                                <span className={`status-badge ${
                                    room.isOverdue ? 'status-overdue' : 
                                    dueSoon ? 'status-warning' : 'status-paid'
                                }`}>
                                  {room.isOverdue ? t('overdue') : dueSoon ? t('dueSoon') : t('paid')}
                                </span>
                              );
                            })()
                          ) : '-'}
                        </td>
                        <td>
                          <Link to={`/room/${room.id}`} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
                            {t('roomDetails')}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
      })()}
    </div>
  );
}

export default Dashboard;
