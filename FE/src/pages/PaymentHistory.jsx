import React, { useEffect, useState } from 'react';
import api from '../services/api';
import * as XLSX from 'xlsx';
import { formatDate, formatCurrency } from '../utils/format';
import { generateReceipt } from '../utils/receipt';

function PaymentHistory() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination State
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProfit, setTotalProfit] = useState(0);

  // Filters (Default: Current Month)
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(lastDay);

  useEffect(() => {
    fetchPayments();
  }, [page, startDate, endDate]);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const params = {
          page,
          limit: 10,
          startDate,
          endDate
      };
      
      const res = await api.get('/payments', { params });
      
      // Handle new API structure { data, meta }
      if (res.data.meta) {
          setPayments(res.data.data);
          setTotalPages(res.data.meta.totalPages);
          setTotalProfit(res.data.meta.totalProfit);
      } else {
          // Fallback if API structure mismatches (shouldnt happen with my change)
          setPayments(res.data); 
      }
    } catch (error) {
      console.error('Failed to fetch payments:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const exportToExcel = () => {
    if (payments.length === 0) return alert('No data to export');

    // Format data for Excel
    const dataToExport = payments.map(p => ({
        'Date Recorded': formatDate(p.payment_date, true),
        'Room': p.room_number,
        'Building': p.building_name,
        'Tenant': p.tenant_name || '',
        'Method': p.payment_method === 'transfer' ? `Transfer (${p.bank_name || '-'})` : 'Cash',
        'Period Start': formatDate(p.period_start),
        'Period Start': formatDate(p.period_start),
        'Period End': formatDate(p.period_end),
        'Amount': parseFloat(p.amount) // Ensure number format for Excel math
    }));

    // Create Worksheet
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    
    // Auto-width columns (basic approximation)
    const wscols = [
        {wch: 20}, // Date
        {wch: 10}, // Room
        {wch: 15}, // Building
        {wch: 20}, // Tenant
        {wch: 15}, // Start
        {wch: 15}, // End
        {wch: 10}  // Amount
    ];
    ws['!cols'] = wscols;

    // Create Workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Payments");

    // Write File
    XLSX.writeFile(wb, `payment_history_${startDate}_to_${endDate}_page${page}.xlsx`);
  };

  // Responsive Pagination
  const [maxVisiblePages, setMaxVisiblePages] = useState(5);

  useEffect(() => {
    const handleResize = () => {
      // Standard mobile phone breakpoint (e.g. iPhone Pro Max is ~430px)
      // Matching CSS media query for mobile devices
      setMaxVisiblePages(window.innerWidth <= 480 ? 3 : 5);
    };

    // Initial check
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handlePageChange = (newPage) => {
    setPage(newPage);
    // Scroll to top of the card or container for better UX
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="container">
      <h1>Payment History</h1>

      <div className="card">
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ marginBottom: 0, minWidth: '150px', flex: '1 1 200px' }}>
            <label>From Date</label>
            <input 
                type="date" 
                value={startDate} 
                onChange={e => { setStartDate(e.target.value); setPage(1); }} 
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0, minWidth: '150px', flex: '1 1 200px' }}>
            <label>To Date</label>
            <input 
                type="date" 
                value={endDate} 
                onChange={e => { setEndDate(e.target.value); setPage(1); }} 
            />
          </div>
          <button className="btn btn-secondary" onClick={() => { setStartDate(''); setEndDate(''); setPage(1); }} style={{ flex: '0 0 auto' }}>
            Clear Filters
          </button>
          <button className="btn btn-success" onClick={exportToExcel} style={{ backgroundColor: 'var(--success-color)', color: 'white', marginLeft: 'auto', flex: '0 0 auto' }}>
            Export to Excel
          </button>
        </div>

        <div style={{ 
          background: 'var(--primary-color)', 
          color: 'white', 
          padding: '1.5rem', 
          borderRadius: '8px', 
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <h3 style={{ margin: 0, color: 'white' }}>Total Profit</h3>
            <span style={{ fontSize: '0.9rem', opacity: 0.9 }}>Based on current filters</span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
            {formatCurrency(totalProfit)}
            <span style={{ fontSize: '1rem' }}> (Sum)</span>
          </div>
        </div>

        <div className="table-container">
          {loading ? (
             <div className="spinner-container">
                <div className="spinner"></div>
             </div> 
          ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Room</th>
                <th>Building</th>
                <th>Tenant</th>
                <th>Method</th>
                <th>Period</th>
                <th>Amount</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>{formatDate(p.payment_date, true)}</td>
                  <td>{p.room_number}</td>
                  <td>{p.building_name}</td>
                  <td>{p.tenant_name}</td>
                  <td>
                    {p.payment_method === 'transfer' 
                        ? `Transfer (${p.bank_name || '-'})` 
                        : 'Cash'}
                  </td>
                  <td>{formatDate(p.period_start)} - {formatDate(p.period_end)}</td>
                  <td>{formatCurrency(p.amount)}</td>
                  <td>
                      <button 
                          onClick={() => generateReceipt(p, p)}
                          className="btn btn-secondary"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                          title="Download Receipt"
                      >
                          🧾 Receipt
                      </button>
                  </td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>No payments found for this period.</td>
                </tr>
              )}
            </tbody>
          </table>
          )}
        </div>
        
        {/* Pagination Controls */}
        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            
            {/* First Page */}
            <button 
                className="btn btn-secondary pagination-btn" 
                disabled={page === 1} 
                onClick={() => handlePageChange(1)}
                title="First Page"
            >
                &laquo;
            </button>

            {/* Previous */}
            <button 
                className="btn btn-secondary pagination-btn" 
                disabled={page === 1} 
                onClick={() => handlePageChange(page - 1)}
                title="Previous Page"
            >
                &lsaquo;
            </button>

            {/* Page Numbers */}
            {(() => {
                const pages = [];
                // Use dynamic maxVisiblePages
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
                title="Next Page"
            >
                &rsaquo;
            </button>

            {/* Last Page */}
            <button 
                className="btn btn-secondary pagination-btn" 
                disabled={page === totalPages} 
                onClick={() => handlePageChange(totalPages)}
                title="Last Page"
            >
                &raquo;
            </button>
        </div>

      </div>
    </div>
  );
}

export default PaymentHistory;
