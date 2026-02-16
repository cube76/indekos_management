import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { API_BASE_URL } from '../services/api';
import { formatDate, formatCurrency, formatInputPrice, parseInputPrice } from '../utils/format';
import { generateReceipt, generateInvoice } from '../utils/receipt';
import Modal from '../components/Modal';
import { useLanguage } from '../context/LanguageContext';

function RoomDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Modal State
  const [modal, setModal] = useState({ isOpen: false, title: '', type: '', data: null });
  const [successModal, setSuccessModal] = useState({ isOpen: false, message: '' });

  // Payment Form State
  const [amount, setAmount] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash' or 'transfer'
  const [bankName, setBankName] = useState(''); // 'BCA', 'BNI', 'Mandiri'
  
  // Tenant Form State
  const [tenantName, setTenantName] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [tenantPhone, setTenantPhone] = useState('');
  const [occupiedAt, setOccupiedAt] = useState('');

  // Pagination State for History
  const [history, setHistory] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Responsive Pagination
  const [maxVisiblePages, setMaxVisiblePages] = useState(5);

  useEffect(() => {
    const handleResize = () => {
      setMaxVisiblePages(window.innerWidth <= 480 ? 3 : 5);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    fetchRoomDetails();
  }, [id]);

  useEffect(() => {
    fetchHistory();
  }, [id, page]);

  const fetchRoomDetails = async () => {
    try {
      const res = await api.get(`/rooms/${id}`);
      setRoom(res.data);
      
      // Reset forms on refresh
      setShowPaymentForm(false);
      setShowTenantForm(false);
    } catch (error) {
      console.error('Failed to fetch room:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await api.get(`/payments/${id}`, { params: { page, limit: 10 }});
      if (res.data.meta) {
          setHistory(res.data.data);
          setTotalPages(res.data.meta.totalPages);
      } else {
          setHistory(res.data);
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
  };

  // Helper to Calculate Next Period
  const getNextPeriod = () => {
    if (!room) return { start: '', end: '' };
    
    // nextDueDate comes from backend (latest_payment_end or occupied_at)
    let start = new Date(room.nextDueDate || new Date());
    
    // If no nextDueDate (shouldn't happen for filled), default to today
    if (isNaN(start.getTime())) start = new Date();

    // End is +1 month from Start
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    
    // Check for month overflow (e.g. Jan 30 -> Mar 2)
    if (end.getDate() !== start.getDate()) {
        end.setDate(0); // Snap to last day of previous month (Feb 28/29)
    }

    // FIX: Use local time string construction instead of toISOString() (which is UTC)
    // AND enforce Asia/Jakarta timezone as per requirement
    const toLocalYMD = (d) => {
        const options = {
            timeZone: 'Asia/Jakarta',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        };
        const formatter = new Intl.DateTimeFormat('id-ID', options);
        const parts = formatter.formatToParts(d);
        const year = parts.find(p => p.type === 'year').value;
        const month = parts.find(p => p.type === 'month').value;
        const day = parts.find(p => p.type === 'day').value;
        return `${year}-${month}-${day}`;
    };

    return {
      start: toLocalYMD(start),
      end: toLocalYMD(end)
    };
  };

  // --- Modal Openers ---

  const openPaymentModal = () => {
    const { start, end } = getNextPeriod();
    setAmount(room.price || '');
    setPeriodStart(start);
    setPeriodEnd(end);
    setPaymentDate(new Date().toISOString().split('T')[0]); // Default to Today
    setPaymentMethod('cash');
    setBankName('');
    setModal({
        isOpen: true,
        title: t('recordPayment'),
        type: 'PAYMENT_FORM',
        data: null
    });
  };

  const openTenantModal = () => {
      // Reset fields
      setTenantName('');
      setTenantId('');
      setTenantPhone('');
      setOccupiedAt('');
      
      setModal({
        isOpen: true,
        title: t('assignTenantBtn'),
        type: 'TENANT_FORM',
        data: null
      });
  };

  const triggerMoveOut = () => {
    setModal({
        isOpen: true,
        title: isSevereOverdue() ? t('confirmForceMoveOutTitle') : t('confirmMoveOutTitle'),
        type: 'MOVEOUT',
        data: null
    });
  };

  const handleGenerateInvoice = () => {
    const { start, end } = getNextPeriod();
    const predictedPayment = {
        id: 'DRAFT', // No ID yet
        amount: room.price,
        tenant_name: room.tenant_name,
        payment_date: new Date(), // Invoice Date = Today
        period_start: start,
        period_end: end
    };
    generateInvoice(predictedPayment, room);
  };

  // --- Central Action Handler ---
  const handleConfirmAction = async () => {
    if (modal.type === 'TENANT_FORM') {
         // Validate Required Fields
        if (!tenantName.trim() || !tenantPhone.trim() || !tenantId.trim() || !occupiedAt) {
            alert('Please fill in all tenant details.');
            return;
        }

        // Validate Date
        const moveIn = new Date(occupiedAt);
        const today = new Date();
        const maxDate = new Date();
        maxDate.setMonth(maxDate.getMonth() + 2);
        const minDate = new Date(today.getFullYear(), today.getMonth(), 1); 
        minDate.setHours(0, 0, 0, 0); 
        moveIn.setHours(0, 0, 0, 0);

        if (moveIn > maxDate) {
            alert('Move-in date cannot be more than 2 months in the future.');
            return;
        }
        if (moveIn < minDate) {
            alert('Cannot assign move-in date for a past month.');
            return;
        }
    }

    setIsSubmitting(true);
    try {
        if (modal.type === 'PAYMENT_FORM') {
            if (paymentMethod === 'transfer' && !bankName) {
                alert('Please select a Bank Name for the transfer.');
                setIsSubmitting(false);
                return;
            }

            await api.post(`/payments/${id}`, { 
                amount, 
                period_start: periodStart, 
                period_end: periodEnd,
                payment_date: paymentDate,
                payment_method: paymentMethod,
                bank_name: paymentMethod === 'transfer' ? bankName : null
            });
            setSuccessModal({ isOpen: true, message: t('paymentSuccess') });
            fetchHistory();
        } 
        else if (modal.type === 'TENANT_FORM') {
            await api.post(`/rooms/${id}/tenant`, { tenant_name: tenantName, tenant_id_number: tenantId, tenant_phone: tenantPhone, occupied_at: occupiedAt });
            setSuccessModal({ isOpen: true, message: t('tenantSuccess') });
            fetchHistory();
        } 
        else if (modal.type === 'MOVEOUT') {
            await api.post(`/rooms/${id}/moveout`);
            setSuccessModal({ isOpen: true, message: t('moveOutSuccess') });
        }
        
        // Refresh Data
        await fetchRoomDetails();
        
        // Cleanup UI
        setModal({ isOpen: false, title: '', type: '', data: null });

    } catch (error) {
        console.error(error);
        alert('Action failed: ' + (error.response?.data || error.message));
    } finally {
        setIsSubmitting(false);
    }
  };

  // Check for Severe Overdue (> 1 Month)
  const isSevereOverdue = () => {
      if (!room.nextDueDate) return false;
      const due = new Date(room.nextDueDate);
      const now = new Date();
      
      // Calculate 1 month after due date
      const threshold = new Date(due);
      threshold.setMonth(threshold.getMonth() + 1);
      
      return now > threshold;
  };

  // Logic to show Payment Button
  const canShowPaymentButton = () => {
    if (room.status !== 'filled') return false;
    
    // STRICT RULE: If overdue > 1 month, disable payment (Must Move Out)
    // if (isSevereOverdue()) return false; // DISABLED: Allow payment anytime

    if (room.isOverdue) return true;

    // Show if Due Date is approaching (e.g., within 7 days)
    if (room.nextDueDate) {
      const today = new Date();
      const due = new Date(room.nextDueDate);
      
      // Calculate difference in milliseconds
      const diffTime = due - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      // Show if due within 7 days (or passed)
      return diffDays <= 7; 
    }
    return true; 
  };

  if (loading) return <div className="container">Loading...</div>;
  if (!room) return <div className="container">Room not found</div>;


  // Check if Due Soon (within 7 days) but not overdue
  const isDueSoon = () => {
      if (!room.nextDueDate || room.isOverdue) return false;
      const today = new Date();
      const due = new Date(room.nextDueDate);
      const diffTime = due - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 7 && diffDays >= 0;
  };

  return (
    <div className="container">
      <button onClick={() => navigate('/dashboard')} className="btn btn-secondary" style={{ marginBottom: '1rem' }}>
        &larr; {t('backToDashboard')}
      </button>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
             <h1 style={{ marginBottom: 0, fontSize: '1.8rem' }}>{t('room')} {room.room_number}</h1>
             <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                 {room.building_logo && (
                     <img 
                      src={`${API_BASE_URL}${room.building_logo}`} 
                      alt="logo" 
                      style={{ width: '24px', height: '24px', objectFit: 'contain' }} 
                     />
                 )}
                 <span>{room.building_name}</span>
             </div>
          </div>
          <div style={{display:'flex', gap:'0.5rem'}}>
             <span className={`status-badge ${room.status === 'filled' ? 'status-filled' : 'status-empty'}`}>
                {room.status.toUpperCase()}
            </span>
            {room.status === 'filled' && (
               <>
               <span className={`status-badge ${
                   room.isOverdue ? 'status-overdue' : 
                   isDueSoon() ? 'status-warning' : 'status-paid'
               }`}>
                 {room.isOverdue ? t('overdue') : isDueSoon() ? t('dueSoon') : t('paid')}
               </span>
               

               </>
            )}
          </div>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginTop: '1rem' }}>
          <div>
            <h3>{t('roomDetails')}</h3>
            <p><strong>{t('price')}:</strong> {formatCurrency(room.price)}</p>
            {room.status === 'filled' ? (
              <div style={{ 
                backgroundColor: '#f0f9ff', 
                border: '1px solid #bae6fd', 
                padding: '1rem', 
                borderRadius: '8px', 
                marginTop: '0.5rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: '#0369a1' }}>
                    <strong>{t('currentTenant')}</strong>
                </div>
                <p style={{ margin: '0.2rem 0', fontSize: '1.1rem', fontWeight: 'bold' }}>{room.tenant_name}</p>
                <p style={{ margin: '0.2rem 0' }}>📞 {room.tenant_phone}</p>
                <p style={{ margin: '0.2rem 0' }}>🆔 {room.tenant_id_number}</p>
                <hr style={{ borderColor: '#bae6fd', margin: '0.5rem 0' }}/>
                <p style={{ margin: '0.2rem 0', fontSize: '0.9rem' }}>{t('occupiedSince')}: {formatDate(room.occupied_at)}</p>
                <p style={{ margin: '0.2rem 0', fontSize: '0.9rem' }}>{t('nextDue')}: {formatDate(room.nextDueDate)}</p>
              </div>
            ) : (
                <p><em>{t('empty')}</em></p>
            )}
          </div>

          <div>
            <h3>{t('actions')}</h3>
            {room.status === 'filled' ? (
                <>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    {canShowPaymentButton() && (
                        <button onClick={openPaymentModal} className="btn btn-primary" style={{ flex: '1 1 auto' }}>
                             {t('recordPayment')}
                        </button>
                    )}
                    {(isDueSoon() || room.isOverdue) && (
                    <button 
                        onClick={handleGenerateInvoice} 
                        className="btn btn-secondary" 
                        style={{ flex: '1 1 auto', backgroundColor: '#64748b', borderColor: '#64748b' }}
                    >
                        📄 {t('invoiceBtn')}
                    </button>
                    )}
                    <button onClick={triggerMoveOut} className="btn btn-danger" style={{ flex: '1 1 auto' }}>
                        {isSevereOverdue() ? t('forceMoveOutBtn') : t('moveOutBtn')}
                    </button>
                </div>
                {isSevereOverdue() && (
                    <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#fee2e2', color: '#dc2626', borderRadius: '4px', border: '1px solid #fca5a5' }}>
                        <strong>{t('statusCritical')}:</strong> {t('statusCriticalMsg')}
                    </div>
                )}
                </>
            ) : (
                <button onClick={openTenantModal} className="btn btn-primary">
                    {t('assignTenantBtn')}
                </button>
            )}
          </div>
        </div>
        
      </div>

      <div className="card">
        <h3>{t('room')} {t('paymentHistory')}</h3>
        {loadingHistory ? (
           <div className="spinner-container">
             <div className="spinner"></div>
           </div>
        ) : history.length === 0 ? <p>{t('noPayments')}</p> : (
          <>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>{t('tenant')}</th>
                  <th>{t('period')}</th>
                  <th>{t('dateRecorded')}</th>
                  <th>{t('method')}</th>
                  <th>{t('amount')}</th>
                  <th>{t('action')}</th>
                </tr>
              </thead>
              <tbody>
                {history.map(p => (
                  <tr key={p.id}>
                    <td>{p.tenant_name || '-'}</td>
                    <td>{formatDate(p.period_start)} - {formatDate(p.period_end)}</td>
                    <td>{formatDate(p.payment_date)}</td>
                    <td>
                        {p.payment_method === 'transfer' 
                            ? `${t('transfer')} (${p.bank_name || '-'})` 
                            : t('cash')}
                    </td>
                    <td>{formatCurrency(p.amount)}</td>
                    <td>
                        <button 
                            onClick={() => generateReceipt(p, room)}
                            className="btn btn-secondary"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                            title={t('downloadReceipt')}
                        >
                            🧾 {t('receipt')}
                        </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Detailed Pagination Controls */}
            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                
                {/* First Page */}
                <button 
                    className="btn btn-secondary pagination-btn" 
                    disabled={page === 1} 
                    onClick={() => handlePageChange(1)}
                    title={t('firstPage')}
                >
                    &laquo;
                </button>

                {/* Previous */}
                <button 
                    className="btn btn-secondary pagination-btn" 
                    disabled={page === 1} 
                    onClick={() => handlePageChange(page - 1)}
                    title={t('prevPage')}
                >
                    &lsaquo;
                </button>

                {/* Page Numbers */}
                {(() => {
                    const pages = [];
                    let start = Math.max(1, page - Math.floor(maxVisiblePages / 2));
                    let end = Math.min(totalPages, start + maxVisiblePages - 1);

                    if (end - start + 1 < maxVisiblePages) {
                        start = Math.max(1, end - maxVisiblePages + 1);
                    }

                    if (start > 1) {
                        pages.push(
                            <button key={1} className={`btn ${page === 1 ? 'btn-primary' : 'btn-secondary'} pagination-btn`} onClick={() => handlePageChange(1)}>1</button>
                        );
                        if (start > 2) pages.push(<span key="dots1" style={{ margin: '0 0.5rem' }}>...</span>);
                    }

                    for (let i = start; i <= end; i++) {
                        pages.push(
                            <button 
                                key={i} 
                                className={`btn ${page === i ? 'btn-primary' : 'btn-secondary'} pagination-btn`} 
                                style={page === i ? { backgroundColor: 'var(--primary-color)', color: 'white', borderColor: 'var(--primary-color)' } : {}}
                                onClick={() => handlePageChange(i)}
                            >
                                {i}
                            </button>
                        );
                    }

                    if (end < totalPages) {
                        if (end < totalPages - 1) pages.push(<span key="dots2" style={{ margin: '0 0.5rem' }}>...</span>);
                        pages.push(
                            <button key={totalPages} className={`btn ${page === totalPages ? 'btn-primary' : 'btn-secondary'} pagination-btn`} onClick={() => handlePageChange(totalPages)}>{totalPages}</button>
                        );
                    }

                    return pages;
                })()}

                {/* Next */}
                <button 
                    className="btn btn-secondary pagination-btn" 
                    disabled={page === totalPages} 
                    onClick={() => handlePageChange(page + 1)}
                    title={t('nextPage')}
                >
                    &rsaquo;
                </button>

                {/* Last Page */}
                <button 
                    className="btn btn-secondary pagination-btn" 
                    disabled={page === totalPages} 
                    onClick={() => handlePageChange(totalPages)}
                    title={t('lastPage')}
                >
                    &raquo;
                </button>
            </div>
          </>
        )}
      </div>

      {/* Unified Modal */}
      <Modal
        isOpen={modal.isOpen}
        title={modal.title}
        onClose={() => setModal({ ...modal, isOpen: false })}
        onConfirm={handleConfirmAction}
        isLoading={isSubmitting}
        confirmText={
            modal.type === 'PAYMENT_FORM' ? t('save') :
            modal.type === 'TENANT_FORM' ? t('assignTenantBtn') :
            modal.type === 'MOVEOUT' ? t('confirmMoveOutTitle') : t('confirm')
        }
        confirmColor={modal.type === 'MOVEOUT' ? 'danger' : 'primary'}
      >
        {modal.type === 'PAYMENT_FORM' && (
            <form id="payment-form">
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label style={{display:'block', marginBottom:'0.2rem'}}>{t('paymentDate')}</label>
                    <input 
                        type="date" 
                        value={paymentDate} 
                        onChange={e => setPaymentDate(e.target.value)} 
                        required 
                        style={{width:'100%', padding:'0.5rem'}}
                    />
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label style={{display:'block', marginBottom:'0.2rem'}}>{t('paymentMethod')}</label>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <label style={{ cursor: 'pointer' }}>
                            <input 
                                type="radio" 
                                name="paymentMethod" 
                                value="cash" 
                                checked={paymentMethod === 'cash'} 
                                onChange={() => setPaymentMethod('cash')} 
                            /> {t('cash')}
                        </label>
                        <label style={{ cursor: 'pointer' }}>
                            <input 
                                type="radio" 
                                name="paymentMethod" 
                                value="transfer" 
                                checked={paymentMethod === 'transfer'} 
                                onChange={() => setPaymentMethod('transfer')} 
                            /> {t('transfer')}
                        </label>
                    </div>
                </div>

                {paymentMethod === 'transfer' && (
                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                        <label style={{display:'block', marginBottom:'0.2rem'}}>{t('bankName')}</label>
                        <select 
                            value={bankName} 
                            onChange={e => setBankName(e.target.value)} 
                            required 
                            style={{width:'100%', padding:'0.5rem'}}
                        >
                            <option value="">{t('selectBank')}</option>
                            <option value="BCA">BCA</option>
                            <option value="BNI">BNI</option>
                            <option value="Mandiri">Mandiri</option>
                        </select>
                    </div>
                )}

                <div className="form-group">
                <label>{t('amountFixed')}</label>
                <input type="text" value={formatCurrency(amount)} readOnly style={{ backgroundColor: '#e2e8f0', width: '100%', padding: '0.5rem', marginBottom: '1rem' }} />
                </div>
                
                <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#e2e8f0', borderRadius: '8px' }}>
                    <label style={{ marginBottom: '0.2rem', display: 'block' }}>{t('paymentPeriod')}</label>
                    <strong>
                    {formatDate(periodStart)} &mdash; {formatDate(periodEnd)}
                    </strong>
                </div>
            </form>
        )}

        {modal.type === 'TENANT_FORM' && (
            <form id="tenant-form">
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label style={{display:'block', marginBottom:'0.2rem'}}>{t('tenantName')}</label>
                    <input type="text" value={tenantName} onChange={e => setTenantName(e.target.value)} required style={{width:'100%', padding:'0.5rem'}} />
                </div>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label style={{display:'block', marginBottom:'0.2rem'}}>{t('phoneNumber')}</label>
                    <input type="number" value={tenantPhone} onChange={e => setTenantPhone(e.target.value)} required style={{width:'100%', padding:'0.5rem'}} />
                </div>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label style={{display:'block', marginBottom:'0.2rem'}}>{t('idNumber')}</label>
                    <input type="text" value={tenantId} onChange={e => setTenantId(e.target.value)} required style={{width:'100%', padding:'0.5rem'}} />
                </div>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label style={{display:'block', marginBottom:'0.2rem'}}>{t('moveInDate')}</label>
                    <input 
                    type="date" 
                    value={occupiedAt} 
                    onChange={e => setOccupiedAt(e.target.value)} 
                    max={new Date(new Date().setMonth(new Date().getMonth() + 2)).toISOString().split('T')[0]}
                    min={new Date(new Date().setDate(1)).toISOString().split('T')[0]} 
                    required 
                    style={{width:'100%', padding:'0.5rem'}}
                    />
                    <small style={{ color: 'var(--text-secondary)' }}>{t('moveInDateNote')}</small>
                </div>
            </form>
        )}

        {modal.type === 'MOVEOUT' && (
            <p>{t('confirmMoveOutMsg')}</p>
        )}
      </Modal>

      {/* Success Modal */}
      <Modal
        isOpen={successModal.isOpen}
        title="Success"
        onClose={() => setSuccessModal({ ...successModal, isOpen: false })}
        // No confirm button for success
      >
        <div style={{ textAlign: 'center', padding: '1rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
            <p style={{ fontSize: '1.1rem' }}>{successModal.message}</p>
        </div>
      </Modal>
    </div>
  );
}

export default RoomDetail;
