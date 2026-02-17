import jsPDF from 'jspdf';
import { formatDate, formatCurrency } from './format';
import { API_BASE_URL } from '../services/api';

// Helper to load image
const getDataUrl = (url) => {
  return new Promise((resolve) => {
    if (!url) { 
        console.warn('Receipt: No logo URL provided');
        resolve(null); 
        return; 
    }
    
    // If it's a relative path, prepend API_BASE_URL
    const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
    console.log('Receipt: Loading logo from', fullUrl);
    
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = fullUrl;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = (e) => {
        console.error('Receipt: Failed to load logo image', e);
        resolve(null);
    };
  });
};

// Internal common function
const generateDocument = async (payment, room, type) => {
  // 1. Fetch Logo first (async)
  const logoDataUrl = await getDataUrl(room.building_logo);

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const margin = 20;
  
  // -- Colors --
  const PRIMARY_COLOR = [37, 99, 235]; // Blue
  const DARK_GREY = [50, 50, 50];
  const BLACK = [0, 0, 0];
  const WHITE = [255, 255, 255];

  let y = 30;

  // --- 1. Header (Logo Left, Title Right) ---
  
  // Logo
  if (logoDataUrl) {
    // Keep aspect ratio roughly. Max width 40, Max height 40
    const props = doc.getImageProperties(logoDataUrl);
    const ratio = props.width / props.height;
    const w = 40;
    const h = w / ratio;
    doc.addImage(logoDataUrl, 'PNG', margin, y - 5, w, h);
    
    // Building Name below logo (Left Aligned)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...PRIMARY_COLOR);
    doc.text(room.building_name || 'RESIDENCE', margin, y + h + 5);
    
    // Address below name (Left Aligned)
    if (room.building_address) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100);
        // Multiline address if needed
        const splitAddr = doc.splitTextToSize(room.building_address, 80); // increased width for left align
        doc.text(splitAddr, margin, y + h + 10);
        
        // Update Y pointer based on address height
        y += h + 10 + (splitAddr.length * 4);
    } else {
        y += h + 10;
    }
  } else {
    // Fallback text if no logo
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(...PRIMARY_COLOR);
    doc.text(room.building_name || 'RESIDENCE', margin, y);
    
    if (room.building_address) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(room.building_address, margin, y + 5);
        y += 15;
    } else {
        y += 10;
    }
  }

  // Right Side: TITLE (KWITANSI or INVOICE)
  const titleText = type === 'INVOICE' ? 'TAGIHAN' : 'KWITANSI';
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(32);
  doc.setTextColor(...DARK_GREY);
  doc.text(titleText, pageWidth - margin, 35, { align: 'right' }); // Fixed Y=35

  // Receipt/Invoice Number
  const buildingCode = (room.building_name || 'RES').substring(0, 3).toUpperCase();
  const idSuffix = payment.id ? String(payment.id).padStart(5, '0') : 'XXXXX';
  const typeCode = type === 'INVOICE' ? 'INV' : 'PYM';
  const numberStr = `# ${new Date().getFullYear()}/${buildingCode}/${typeCode}/${idSuffix}`;

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(numberStr, pageWidth - margin, 42, { align: 'right' }); // Fixed Y=42

  // --- 2. Info Section (Bill To, Date, etc) ---
  // Ensure enough gap before Bill To
  y = Math.max(y + 10, 60); 
  
  const midPoint = pageWidth / 2 + 10;
  const rightColX = pageWidth - margin - 60; // Align values roughly

  // LEFT COLUMN
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text('Kepada:', margin, y);
  doc.text('Lokasi:', midPoint - 50, y); // Simulated 2nd small column

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BLACK);
  
  const tenantName = payment.tenant_name || room.tenant_name || '-';
  const tenantNameWidth = (midPoint - 50) - margin - 5;
  const splitTenantName = doc.splitTextToSize(tenantName, tenantNameWidth);
  doc.text(splitTenantName, margin, y + 6);
  doc.text(room.building_name || '-', midPoint - 50, y + 6);
  
  // RIGHT COLUMN (Date, Payment Terms, Balance Due)
  let ry = y;
  const rLabelX = rightColX; 
  const rValueX = pageWidth - margin;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  
  doc.text('Tanggal:', rLabelX, ry, { align: 'right' });
  doc.setTextColor(...BLACK);
  // For Invoice, Date is today or due date? Usually today (generation date).
  doc.text(formatDate(payment.payment_date || new Date()), rValueX, ry, { align: 'right' });
  
  ry += 7;
  doc.setTextColor(100);
  doc.text('Metode Pembayaran:', rLabelX, ry, { align: 'right' });
  doc.setTextColor(...BLACK);
  
  let paymentMethodText;
  
  if (type === 'INVOICE') {
      paymentMethodText = 'Tunai/Transfer';
  } else {
      paymentMethodText = payment.payment_method === 'transfer' 
        ? `Transfer - ${payment.bank_name || 'Bank'}` 
        : 'Tunai';
  }
  doc.text(paymentMethodText, rValueX, ry, { align: 'right' });

  ry += 12;
  // Balance Due Box
  doc.setFillColor(245, 245, 245);
  // Adjusted height to 12 (less tall) and centered (ry - 8)
  doc.rect(rLabelX - 25, ry - 8, (pageWidth - margin) - (rLabelX - 25), 12, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BLACK);
  // Vertically centered in the box (ry is the baseline)
  doc.text('Total Tagihan:', rLabelX, ry, { align: 'right' });
  doc.text(formatCurrency(payment.amount), rValueX, ry, { align: 'right' });

  // --- 3. Table ---
  y += 30; // Reduced from 50

  // Header
  const tableH = 10;
  doc.setFillColor(...DARK_GREY); // Dark background
  doc.rect(margin, y, pageWidth - (margin * 2), tableH, 'F');
  
  doc.setTextColor(...WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  
  const col1 = margin + 5; // Item
  const col2 = pageWidth - margin - 90; // Quantity
  const col3 = pageWidth - margin - 50; // Rate
  const col4 = pageWidth - margin - 5;  // Amount (Right aligned)

  doc.text('Deskripsi', col1, y + 7);
  doc.text('Jml', col2, y + 7);
  doc.text('Harga', col3, y + 7, { align: 'right'});
  doc.text('Total', col4, y + 7, { align: 'right'});

  // Row
  y += tableH + 8;
  doc.setTextColor(...BLACK);
  doc.setFont('helvetica', 'bold');
  doc.text(`Sewa Bulanan Kamar ${room.room_number}`, col1, y);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100);
  const period = `${formatDate(payment.period_start)} - ${formatDate(payment.period_end)}`;
  doc.text(period, col1, y + 5);

  doc.setTextColor(...BLACK);
  doc.text('1', col2 + 2, y); // Qty 1
  doc.text(formatCurrency(payment.amount), col3, y, { align: 'right' }); // Rate same as amount
  doc.text(formatCurrency(payment.amount), col4, y, { align: 'right' }); // Amount

  // --- 4. Footer Totals ---
  y += 15; // Reduced from 30
  const footerLabelX = pageWidth - margin - 50;
  const footerValueX = pageWidth - margin - 5;
  const fy = 6;

  doc.setFontSize(10);
  doc.text('Subtotal:', footerLabelX, y, { align: 'right' });
  doc.text(formatCurrency(payment.amount), footerValueX, y, { align: 'right' });

  y += fy;
  doc.text('Pajak (0%):', footerLabelX, y, { align: 'right' });
  doc.text('IDR 0.00', footerValueX, y, { align: 'right' });

  y += fy;
  doc.setFont('helvetica', 'bold');
  doc.text('Total:', footerLabelX, y, { align: 'right' });
  doc.text(formatCurrency(payment.amount), footerValueX, y, { align: 'right' });


  // --- 5. Notes & Terms ---
  // Notes at bottom left
  const bottomY = y + 10; // Reduced from 20 
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text('Catatan:', margin, bottomY);
  
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...BLACK);

  // Content based on Type
  let notesContent = '';
  let termsContent = '';

  const bankDetails = `Pembayaran melalui Transfer:\nRek BNI 2002121349 an Ahmad Dzul Jalaali\nRek Mandiri 1120097100130 an Ahmad Yani\nHarap simpan bukti transfer ini sebagai tanda bukti pembayaran yang sah.`;

  if (type === 'INVOICE') {
      notesContent = 'Keterlambatan pembayaran sewa akan dikenakan tarif harian.';
      termsContent = 'Pembayaran dapat dilakukan secara Cash/Transfer ke\nRek BNI 2002121349 an Ahmad Dzul Jalaali\nRek Mandiri 1120097100130 an Ahmad Yani\nHarap mengirimkan bukti transfer jika melakukan pembayaran dengan metode transfer. Terimakasih';
  } else {
      // Receipt
      notesContent = 'LUNAS';
      if (payment.payment_method === 'transfer') {
         termsContent = `Pembayaran telah diterima via Transfer (${payment.bank_name}).\nMohon maaf transaksi yang sudah dibayarkan tidak dapat dikembalikan.`;
      } else {
         termsContent = 'Mohon maaf transaksi yang sudah dibayarkan tidak dapat dikembalikan.';
      }
  }

  const splitNotes = doc.splitTextToSize(notesContent, pageWidth - margin * 2);
  doc.text(splitNotes, margin, bottomY + 5);

  const termsY = bottomY + 15 + (splitNotes.length * 4);
  doc.setTextColor(100);
  doc.text('Ketentuan:', margin, termsY);
  doc.setTextColor(...BLACK);
  
  const splitTerms = doc.splitTextToSize(termsContent, pageWidth - margin * 2);
  doc.text(splitTerms, margin, termsY + 5);

  // Open
  window.open(doc.output('bloburl'), '_blank');
};

export const generateReceipt = (payment, room) => {
    return generateDocument(payment, room, 'RECEIPT');
};

export const generateInvoice = (payment, room) => {
    return generateDocument(payment, room, 'INVOICE');
};
