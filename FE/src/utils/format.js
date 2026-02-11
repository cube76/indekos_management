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

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  let result = `${day}-${month}-${year}`;

  if (includeTime) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    result += ` ${hours}:${minutes}`;
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
