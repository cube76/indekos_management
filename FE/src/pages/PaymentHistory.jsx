import React, { useEffect, useState } from 'react';
import api from '../services/api';
import XLSX from 'xlsx-js-style';
import { formatDate, formatCurrency } from '../utils/format';
import { generateReceipt } from '../utils/receipt';
import { useLanguage } from '../context/LanguageContext';

function PaymentHistory() {
  const { t } = useLanguage();
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
  
  // Building Filter
  const [buildings, setBuildings] = useState([]);
  const [selectedBuilding, setSelectedBuilding] = useState('');

  useEffect(() => {
    fetchBuildings();
  }, []);

  useEffect(() => {
    fetchPayments();
  }, [page, startDate, endDate, selectedBuilding]);

  const fetchBuildings = async () => {
      try {
          const res = await api.get('/rooms'); // Reuse rooms endpoint to extract buildings (or separate endpoint if available)
          // Extract unique buildings
          const uniqueBuildings = {};
          res.data.forEach(r => {
             if(r.building_id && r.building_name) {
                 uniqueBuildings[r.building_id] = r.building_name;
             }
          });
          
          setBuildings(Object.keys(uniqueBuildings).map(id => ({ id, name: uniqueBuildings[id] })).sort((a,b) => a.name.localeCompare(b.name)));
      } catch (err) {
          console.error("Failed to fetch buildings", err);
      }
  };

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const params = {
          page,
          limit: 10,
          startDate,
          endDate,
          building_id: selectedBuilding
      };
      
      const res = await api.get('/payments', { params });
      
      if (res.data.meta) {
          setPayments(res.data.data);
          setTotalPages(res.data.meta.totalPages);
          setTotalProfit(res.data.meta.totalProfit);
      } else {
          setPayments(res.data); 
      }
    } catch (error) {
      console.error('Failed to fetch payments:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const exportToExcel = async () => {
    setLoading(true);
    try {
        const params = {
            page: 1,
            limit: 10000,
            startDate,
            endDate,
            building_id: selectedBuilding
        };
        
        const res = await api.get('/payments', { params });
        const allPayments = res.data.data || res.data;

        if (allPayments.length === 0) {
            alert('No data to export');
            return;
        }

        // Format data for Excel
        const dataToExport = allPayments.map(p => ({
            [t('building')]: p.building_name,
            [t('room')]: p.room_number,
            [t('tenant')]: p.tenant_name || '',
            [t('period')]: `${formatDate(p.period_start)} - ${formatDate(p.period_end)}`,
            [t('date')]: formatDate(p.payment_date, true),
            [t('method')]: p.payment_method === 'transfer' ? `Transfer (${p.bank_name || '-'})` : t('cash'),
            [t('amount')]: parseFloat(p.amount)
        }));

        // Add Total Row
        // Total is under Amount (Index 6)
        const totalRow = {
            [t('building')]: '',
            [t('room')]: '',
            [t('tenant')]: '',
            [t('period')]: '',
            [t('date')]: '',
            [t('method')]: t('sum').toUpperCase(),
            [t('amount')]: parseFloat(totalProfit)
        };
        dataToExport.push(totalRow);

        // Create Worksheet
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        
        // Auto-width columns
        const wscols = [
            {wch: 15}, // Building
            {wch: 10}, // Room
            {wch: 20}, // Tenant
            {wch: 25}, // Period
            {wch: 20}, // Date
            {wch: 20}, // Method
            {wch: 15}  // Amount
        ];
        ws['!cols'] = wscols;

        // Apply Styles
        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let R = range.s.r; R <= range.e.r; ++R) {
           for (let C = range.s.c; C <= range.e.c; ++C) {
              const cell_address = {c:C, r:R};
              const cell_ref = XLSX.utils.encode_cell(cell_address);
              
              if (!ws[cell_ref]) continue;

              // Header Row Style
              if (R === 0) {
                  ws[cell_ref].s = {
                      font: { bold: true, color: { rgb: "FFFFFF" } },
                      fill: { fgColor: { rgb: "4F81BD" } },
                      alignment: { horizontal: "center", vertical: "center" }
                  };
              } else {
                 // Data Rows
                 // Apply Number Format to Amount Column (index 6, moved from 5)
                 if (C === 6) {
                     ws[cell_ref].z = '"Rp" #,##0'; // Standard Excel Format String
                     ws[cell_ref].s = { alignment: { horizontal: "right" } };
                 }
                 // Apply Center alignment to Date, Room, Period columns for better look
                 // Building(0), Room(1), Period(3), Date(4)
                 if ([0, 1, 3, 4].includes(C)) {
                     if (!ws[cell_ref].s) ws[cell_ref].s = {};
                     ws[cell_ref].s.alignment = { horizontal: "center" };
                 }
              }
              
              // Last Row (Total) Style
              if (R === range.e.r) {
                 ws[cell_ref].s = {
                     font: { bold: true },
                     fill: { fgColor: { rgb: "E2E8F0" } }
                 };
                 // Ensure format is also applied to total amount
                 if (C === 6) {
                     ws[cell_ref].z = '"Rp" #,##0';
                     ws[cell_ref].s.alignment = { horizontal: "right" };
                 }
              }
           }
        }

        // Create Workbook
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Payments");

        // Write File
        let filename = 'Payment_History';
        if (selectedBuilding) {
            const building = buildings.find(b => b.id == selectedBuilding);
            if (building) {
                filename += `_${building.name.replace(/\s+/g, '_')}`;
            }
        }
        filename += `_${startDate}_to_${endDate}.xlsx`;
        
        XLSX.writeFile(wb, filename);

    } catch (error) {
        console.error("Export failed", error);
        alert("Export failed");
    } finally {
        setLoading(false);
    }
  };

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

  const handlePageChange = (newPage) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="container">
      <h1>{t('paymentHistory')}</h1>

      <div className="card">
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ marginBottom: 0, minWidth: '150px', flex: '1 1 200px' }}>
            <label>{t('filterFrom')}</label>
            <input 
                type="date" 
                value={startDate} 
                onChange={e => { setStartDate(e.target.value); setPage(1); }} 
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0, minWidth: '150px', flex: '1 1 200px' }}>
            <label>{t('filterTo')}</label>
            <input 
                type="date" 
                value={endDate} 
                onChange={e => { setEndDate(e.target.value); setPage(1); }} 
            />
          </div>
          
          <div className="form-group" style={{ marginBottom: 0, minWidth: '150px', flex: '1 1 200px' }}>
              <label>{t('building')}</label>
              <select 
                  value={selectedBuilding} 
                  onChange={e => { setSelectedBuilding(e.target.value); setPage(1); }}
                  style={{ width: '100%', padding: '0.6rem' }}
              >
                  <option value="">All Buildings</option>
                  {buildings.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
              </select>
          </div>

          <button className="btn btn-secondary" onClick={() => { setStartDate(''); setEndDate(''); setSelectedBuilding(''); setPage(1); }} style={{ flex: '0 0 auto' }}>
            {t('clearFilters')}
          </button>
          <button className="btn btn-success" onClick={exportToExcel} style={{ backgroundColor: 'var(--success-color)', color: 'white', marginLeft: 'auto', flex: '0 0 auto' }}>
            {t('exportExcel')}
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
            <h3 style={{ margin: 0, color: 'white' }}>{t('totalProfit')}</h3>
            <span style={{ fontSize: '0.9rem', opacity: 0.9 }}>Based on current filters</span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
            {formatCurrency(totalProfit)}
            <span style={{ fontSize: '1rem' }}> ({t('sum')})</span>
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
                <th>{t('building')}</th>
                <th>{t('room')}</th>
                <th>{t('tenant')}</th>
                <th>{t('period')}</th>
                <th>{t('date')}</th>
                <th>{t('method')}</th>
                <th>{t('amount')}</th>
                <th>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>{p.building_name}</td>
                  <td>{p.room_number}</td>
                  <td>{p.tenant_name}</td>
                  <td>{formatDate(p.period_start)} - {formatDate(p.period_end)}</td>
                  <td>{formatDate(p.payment_date, true)}</td>
                  <td>
                    {p.payment_method === 'transfer' 
                        ? `${t('transfer')} (${p.bank_name || '-'})` 
                        : t('cash')}
                  </td>
                  <td>{formatCurrency(p.amount)}</td>
                  <td>
                      <button 
                          onClick={() => generateReceipt(p, p)}
                          className="btn btn-secondary"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                          title="Download Receipt"
                      >
                          🧾 {t('receipt')}
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
