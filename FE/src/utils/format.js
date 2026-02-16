// Helper to format input as user types (e.g. 1000000 -> 1.000.000)
export const formatInputPrice = (value) => {
  if (value === undefined || value === null || value === '') return '';
  
  // If number, convert to string
  let strVal = value.toString();
  
  // If it has a decimal point (from DB like "2700000.00"), take integer part
  if (strVal.includes('.')) {
    strVal = strVal.split('.')[0];
  }

  // Remove non-digit chars
  const rawValue = strVal.replace(/\D/g, '');
  if (!rawValue) return '';
  
  // Add dots
  return Number(rawValue).toLocaleString('id-ID');
};

// Helper to parse formatted input back to number (1.000.000 -> 1000000)
export const parseInputPrice = (value) => {
  if (!value) return 0;
  return Number(value.toString().replace(/\./g, ''));
};

export const formatDate = (dateString, includeTime = false) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';

  const options = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Jakarta' // Enforce timezone
  };

  if (includeTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
    options.hour12 = false;
  }

  // Intl.DateTimeFormat returns "dd/MM/yyyy" or similar depending on locale.
  // We want "DD-MM-YYYY".
  // 'id-ID' locale usually uses dd/MM/yyyy.
  const formatter = new Intl.DateTimeFormat('id-ID', options);
  const parts = formatter.formatToParts(date);
  
  const day = parts.find(p => p.type === 'day').value;
  const month = parts.find(p => p.type === 'month').value;
  const year = parts.find(p => p.type === 'year').value;
  
  let result = `${day}-${month}-${year}`;

  if (includeTime) {
    const hour = parts.find(p => p.type === 'hour').value;
    const minute = parts.find(p => p.type === 'minute').value;
    // Handle the case where separator might be different or missing in parts
    result += ` ${hour}:${minute}`;
  }

  return result;
};

export const formatCurrency = (amount) => {
  if (amount === undefined || amount === null || amount === '') return '-';
  const num = Number(amount);
  if (isNaN(num)) return '-';
  
  // Format: Rp 1.000.000 (standard Indonesian format)
  return 'Rp ' + num.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};
