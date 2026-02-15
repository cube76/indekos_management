import React, { useEffect, useState } from 'react';
import api, { API_BASE_URL } from '../services/api';
import { formatCurrency, formatInputPrice, parseInputPrice } from '../utils/format';
import ResetPasswordModal from '../components/ResetPasswordModal';
import Modal from '../components/Modal';
import { useLanguage } from '../context/LanguageContext';

function AdminPanel() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('rooms'); // rooms, buildings, users
  const [loading, setLoading] = useState(false);

  // Data States
  const [rooms, setRooms] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [users, setUserList] = useState([]);

  // Modals & Forms
  const [isRoomModalOpen, setRoomModalOpen] = useState(false);
  const [roomForm, setRoomForm] = useState({ id: null, room_number: '', building_id: '', price: '' });
  
  const [isBuildingModalOpen, setBuildingModalOpen] = useState(false);
  const [buildingForm, setBuildingForm] = useState({ id: null, name: '', address: '', logo: null });

  const [isUserModalOpen, setUserModalOpen] = useState(false);
  const [userForm, setUserForm] = useState({ username: '', password: '', role: 'user' });

  const [resetModal, setResetModal] = useState({ isOpen: false, userId: null, username: '' });

  // Delete Confirmation
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, type: '', id: null });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
        await Promise.all([fetchRooms(), fetchBuildings(), fetchUsers()]);
        
        // Push Subscription
        subscribeToPush();
    } catch (error) {
        console.error("Failed to load admin data", error);
        alert("Failed to load data: " + (error.response?.data || error.message));
    } finally {
        setLoading(false);
    }
  };

  const subscribeToPush = async () => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      try {
        const register = await navigator.serviceWorker.register('/sw.js');
        
        // Check for permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        // Get VAPID Key
        const { data: { publicKey } } = await api.get('/notifications/vapid-key');
        
        const subscription = await register.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey)
        });

        // Send to Backend
        await api.post('/notifications/subscribe', subscription);
        console.log('Push Subscribed!');
      } catch (err) {
        console.error('Push Subscription failed', err);
      }
    }
  };

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
  
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
  
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  const fetchRooms = async () => {
      const res = await api.get('/rooms');
      const sortedRooms = res.data.sort((a, b) => {
          const nameA = a.building_name || '';
          const nameB = b.building_name || '';
          if (nameA < nameB) return -1;
          if (nameA > nameB) return 1;
          return (a.room_number || '').localeCompare(b.room_number || '', undefined, { numeric: true, sensitivity: 'base' });
      });
      setRooms(sortedRooms);
  };
  const fetchBuildings = async () => {
      const res = await api.getBuildings();
      setBuildings(res.data);
  };
  const fetchUsers = async () => {
      try {
        const res = await api.get('/auth/users');
        setUserList(res.data);
      } catch (e) {
          console.warn("Not superadmin or failed to fetch users");
      }
  };

  // --- Building Handlers ---
  const handleSaveBuilding = async (e) => {
      e.preventDefault();
      const formData = new FormData();
      formData.append('name', buildingForm.name);
      formData.append('address', buildingForm.address);
      if (buildingForm.logo) {
          formData.append('logo', buildingForm.logo);
      }

      try {
          if (buildingForm.id) {
              await api.updateBuilding(buildingForm.id, formData);
          } else {
              await api.createBuilding(formData);
          }
          setBuildingModalOpen(false);
          fetchBuildings();
          // Reset form
          setBuildingForm({ id: null, name: '', address: '', logo: null });
      } catch (error) {
          alert(`${t('saveBuildingFail')}: ` + (error.response?.data || error.message));
      }
  };

  const openEditBuilding = (b) => {
      setBuildingForm({ id: b.id, name: b.name, address: b.address || '', logo: null });
      setBuildingModalOpen(true);
  };

  // --- Room Handlers ---
  const handleSaveRoom = async (e) => {
      e.preventDefault();
      try {
          if (roomForm.id) {
              await api.updateRoom(roomForm.id, roomForm);
          } else {
              await api.createRoom(roomForm);
          }
          setRoomModalOpen(false);
          fetchRooms();
          setRoomForm({ id: null, room_number: '', building_id: '', price: '' });
      } catch (error) {
          alert(`${t('saveRoomFail')}: ` + (error.response?.data || error.message));
      }
  };

  const openEditRoom = (r) => {
      setRoomForm({ id: r.id, room_number: r.room_number, building_id: r.building_id || '', price: r.price });
      setRoomModalOpen(true);
  };

  // --- User Handlers ---
  const handleCreateUser = async (e) => {
      e.preventDefault();
      try {
          await api.post('/auth/register', userForm);
          setUserModalOpen(false);
          fetchUsers();
          setUserForm({ username: '', password: '', role: 'user' });
      } catch (error) {
          alert(`${t('createUserFail')}: ` + (error.response?.data || error.message));
      }
  };

  // --- Delete Handlers ---
  // --- Delete Handlers ---
  const confirmDelete = async () => {
      try {
          if (deleteModal.type === 'building') {
              await api.deleteBuilding(deleteModal.id);
              fetchBuildings();
          } else if (deleteModal.type === 'room') {
              await api.deleteRoom(deleteModal.id);
              fetchRooms();
          } else if (deleteModal.type === 'user') {
              await api.deleteUser(deleteModal.id);
              fetchUsers();
          }
          setDeleteModal({ isOpen: false, type: '', id: null });
      } catch (error) {
          alert(`${t('deleteFail')}: ` + (error.response?.data || error.message));
          setDeleteModal({ isOpen: false, type: '', id: null });
      }
  };

  // Tab mapping
  const tabLabels = {
    rooms: t('room'), // Or 'Rooms' if plural needed, but 'Kamar' works for both in logic usually, or duplicate key
    buildings: t('building'),
    users: t('username') // Or new key 'Users'
  };

  return (
    <div className="container">
      <h1>{t('adminPanel')}</h1>
      
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '2px solid #e2e8f0', marginBottom: '2rem' }}>
          {['rooms', 'buildings', 'users'].map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                    padding: '0.75rem 1.5rem',
                    background: 'none',
                    border: 'none',
                    borderBottom: activeTab === tab ? '3px solid var(--primary-color)' : '3px solid transparent',
                    color: activeTab === tab ? 'var(--primary-color)' : 'var(--text-secondary)',
                    fontWeight: activeTab === tab ? 'bold' : 'normal',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    textTransform: 'capitalize'
                }}
              >
                  {/* Simple mapping or use specific keys */}
                  {tab === 'rooms' ? t('roomsTab') : tab === 'buildings' ? t('buildingsTab') : t('usersTab')}
              </button>
          ))}
          <button 
            className="btn btn-warning" 
            style={{ marginLeft: 'auto', padding: '0.5rem 1rem' }} 
            onClick={async () => {
                if (confirm(t('triggerNotifMsg'))) {
                    try {
                        await api.post('/notifications/trigger');
                        alert(t('triggerSuccess'));
                    } catch (e) {
                         alert('Failed: ' + e.message);
                    }
                }
            }}
          >
              {t('testNotif')}
          </button>
      </div>

      {loading && <div className="spinner-container"><div className="spinner"></div></div>}

      {/* --- ROOMS TAB --- */}
      {activeTab === 'rooms' && (
          <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3>{t('manageRooms')}</h3>
                <button className="btn btn-primary" onClick={() => { setRoomForm({ id: null, room_number: '', building_id: '', price: '' }); setRoomModalOpen(true); }}>
                    {t('newRoom')}
                </button>
              </div>
              <div className="table-container card">
                  <table>
                      <thead>
                          <tr>
                              <th>{t('room')}</th>
                              <th>{t('building')}</th>
                              <th>{t('price')}</th>
                              <th>{t('status')}</th>
                              <th>{t('actions')}</th>
                          </tr>
                      </thead>
                      <tbody>
                          {rooms.map(r => (
                              <tr key={r.id}>
                                  <td>{r.room_number}</td>
                                  <td>{r.building_name}</td>
                                  <td>{formatCurrency(r.price)}</td>
                                  <td><span className={`status-badge ${r.status === 'filled' ? 'status-filled' : 'status-empty'}`}>{r.status === 'filled' ? t('filled') : t('empty')}</span></td>
                                  <td>
                                      <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', marginRight: '0.5rem' }} onClick={() => openEditRoom(r)}>{t('edit')}</button>
                                      <button className="btn btn-danger" style={{ padding: '0.25rem 0.5rem' }} onClick={() => setDeleteModal({ isOpen: true, type: 'room', id: r.id })}>{t('delete')}</button>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* --- BUILDINGS TAB --- */}
      {activeTab === 'buildings' && (
           <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3>{t('manageBuildings')}</h3>
              <button className="btn btn-primary" onClick={() => { setBuildingForm({ id: null, name: '', address: '', logo: null }); setBuildingModalOpen(true); }}>
                  {t('newBuilding')}
              </button>
            </div>
            <div className="grid-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                {buildings.map(b => (
                    <div key={b.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            {b.logo_url ? (
                                <img src={`${API_BASE_URL}${b.logo_url}`} alt="logo" style={{ width: '50px', height: '50px', objectFit: 'contain', borderRadius: '4px', border: '1px solid #eee' }} />
                            ) : (
                                <div style={{ width: '50px', height: '50px', background: '#eee', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🏢</div>
                            )}
                            <div>
                                <h4 style={{ margin: 0 }}>{b.name}</h4>
                                <small style={{ color: 'var(--text-secondary)' }}>{b.address}</small>
                            </div>
                        </div>
                        <div style={{ marginTop: 'auto', display: 'flex', gap: '0.5rem', paddingTop: '1rem' }}>
                             <button className="btn btn-secondary" style={{ flex: 1, padding: '0.25rem' }} onClick={() => openEditBuilding(b)}>{t('edit')}</button>
                             <button className="btn btn-danger" style={{ flex: 1, padding: '0.25rem' }} onClick={() => setDeleteModal({ isOpen: true, type: 'building', id: b.id })}>{t('delete')}</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      )}

      {/* --- USERS TAB --- */}
      {activeTab === 'users' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3>{t('manageUsers')}</h3>
              <button className="btn btn-primary" onClick={() => setUserModalOpen(true)}>
                  {t('newUser')}
              </button>
            </div>
             <div className="table-container card">
                <table>
                  <thead>
                    <tr>
                      <th>{t('id')}</th>
                      <th>{t('username')}</th>
                      <th>{t('role')}</th>
                      <th>{t('action')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id}>
                        <td>{u.id}</td>
                        <td>{u.username}</td>
                        <td>
                            <span className={`status-badge ${u.role === 'superadmin' ? 'status-filled' : 'status-empty'}`}>{u.role === 'superadmin' ? t('superAdmin') : t('userAdmin')}</span>
                        </td>
                        <td>
                          <button 
                              className="btn btn-warning" 
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', marginRight: '0.5rem' }}
                              onClick={() => setResetModal({ isOpen: true, userId: u.id, username: u.username })}
                          >
                              {t('resetPassword')}
                          </button>
                          <button 
                              className="btn btn-danger" 
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                              onClick={() => setDeleteModal({ isOpen: true, type: 'user', id: u.id })}
                          >
                              {t('delete')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          </div>
      )}

      {/* --- MODALS --- */}

      {/* Room Modal */}
      <Modal isOpen={isRoomModalOpen} title={roomForm.id ? t('editRoom') : t('createRoom')} onClose={() => setRoomModalOpen(false)}>
          <form onSubmit={handleSaveRoom}>
              <div className="form-group">
                  <label>{t('roomNumber')}</label>
                  <input type="text" value={roomForm.room_number} onChange={e => setRoomForm({...roomForm, room_number: e.target.value})} required />
              </div>
              <div className="form-group">
                  <label>{t('building')}</label>
                  <select value={roomForm.building_id} onChange={e => setRoomForm({...roomForm, building_id: e.target.value})} required>
                      <option value="">{t('selectBank')}</option> {/* Reusing selectBank? Or need 'Select Building'. Using selectBank as placeholder for now or add new key */}
                      {buildings.map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                  </select>
              </div>
              <div className="form-group">
                  <label>{t('price')}</label>
                  <input type="text" value={formatInputPrice(roomForm.price)} onChange={e => setRoomForm({...roomForm, price: parseInputPrice(e.target.value)})} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>{roomForm.id ? t('save') : t('createRoom')}</button>
          </form>
      </Modal>

      {/* Building Modal */}
      <Modal isOpen={isBuildingModalOpen} title={buildingForm.id ? t('editBuilding') : t('createBuilding')} onClose={() => setBuildingModalOpen(false)}>
          <form onSubmit={handleSaveBuilding}>
              <div className="form-group">
                  <label>{t('buildingName')}</label>
                  <input type="text" value={buildingForm.name} onChange={e => setBuildingForm({...buildingForm, name: e.target.value})} required />
              </div>
              <div className="form-group">
                  <label>{t('address')}</label>
                  <textarea value={buildingForm.address} onChange={e => setBuildingForm({...buildingForm, address: e.target.value})} rows="3"></textarea>
              </div>
              <div className="form-group">
                  <label>{t('logo')}</label>
                  <input type="file" accept="image/*" onChange={e => setBuildingForm({...buildingForm, logo: e.target.files[0]})} />
                  <small style={{ color: 'var(--text-secondary)' }}>{t('uploadLogoNote')}</small>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>{buildingForm.id ? t('save') : t('createBuilding')}</button>
          </form>
      </Modal>

      {/* User Modal */}
      <Modal isOpen={isUserModalOpen} title={t('createUser')} onClose={() => setUserModalOpen(false)}>
              <form onSubmit={handleCreateUser}>
                  <div className="form-group">
                      <label>{t('username')}</label>
                      <input type="text" value={userForm.username} onChange={e => setUserForm({...userForm, username: e.target.value})} required />
                  </div>
                  <div className="form-group">
                      <label>{t('password')}</label>
                      <input type="password" value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} required />
                  </div>
                  <div className="form-group">
                      <label>{t('role')}</label>
                      <select value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value})}>
                          <option value="user">{t('userAdmin')}</option>
                          <option value="superadmin">{t('superAdmin')}</option>
                      </select>
                  </div>
                  <button type="submit" className="btn btn-success" style={{ backgroundColor: 'var(--success-color)', color: 'white', width: '100%' }}>{t('createUser')}</button>
              </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={deleteModal.isOpen} title={t('confirmDelete')} onClose={() => setDeleteModal({ isOpen: false })} onConfirm={confirmDelete} confirmText={t('delete')} confirmColor="danger">
          <p>{t('deleteMsg')}</p>
      </Modal>

      {/* Reset Password Modal (Keep existing) */}
      <ResetPasswordModal 
        isOpen={resetModal.isOpen} 
        onClose={() => setResetModal({ isOpen: false, userId: null, username: '' })} 
        userId={resetModal.userId} 
        username={resetModal.username}
      />
    </div>
  );
}

export default AdminPanel;
