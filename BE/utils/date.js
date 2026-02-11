const addMonths = (date, months) => {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    // If the day changed (e.g. Jan 31 -> Feb 28 -> March 3), snap back to end of month
    if (d.getDate() !== date.getDate()) {
        d.setDate(0);
    }
    return d;
};

const calculateNextDueDate = (occupiedAt, lastPaymentEnd) => {
    if (!occupiedAt) return null;
    const occupiedDate = new Date(occupiedAt);
    
    // If no payment, due date is the move-in date
    if (!lastPaymentEnd) return occupiedDate;

    const lastPaidDate = new Date(lastPaymentEnd);

    // Find the next billing date that is ON or AFTER the last covered date.
    // We start looking from month 0.
    // Optimization: Calculate approximate month difference to skip iterations?
    // For safety and cycle correctness, a robust loop is fine for reasonable periods.
    
    let monthsToAdd = 0;
    while (true) {
        // Calculate candidate date based on ORIGINAL occupied date
        const futureDate = addMonths(occupiedDate, monthsToAdd);
        
        // If this cycle date covers up to (or is) the end of stored payment,
        // The billing cycle continues.
        // If lastPaymentEnd is Feb 28, next due is Feb 28.
        if (futureDate >= lastPaidDate) {
            return futureDate;
        }
        monthsToAdd++;
        
        // Safety break for infinite loops (e.g. invalid dates)
        if (monthsToAdd > 1200) return futureDate; // 100 years
    }
};

module.exports = { calculateNextDueDate, addMonths };
