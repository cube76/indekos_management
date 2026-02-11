// Standalone logic verification
// No db import needed usually, but logic is self contained
const lastPaid = new Date('2024-02-28T00:00:00.000Z'); // Paid 1 month

console.log('Occupied:', occupied.toISOString());
console.log('Last Paid:', lastPaid.toISOString());

// Current flawed logic
let target = new Date(occupied);
while (target < lastPaid) {
    target.setMonth(target.getMonth() + 1);
}
console.log('Current Logic Result:', target.toISOString());

// check drift
if (target.getDate() !== 30 && target.getDate() !== 29 && target.getDate() !== 28) { // 29 for leap year 2024
    console.log('FAIL: Date drifted away from end-of-month!');
} else {
    console.log('PASS: Date is acceptable.');
}

// Proposed Logic (addMonths helper)
function addMonths(date, months) {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    if (d.getDate() !== date.getDate()) {
        d.setDate(0);
    }
    return d;
}

let safeTarget = new Date(occupied);
let i = 0;
// Simulate loop
while (true) {
    let check = addMonths(occupied, i);
    if (check >= lastPaid) {
        safeTarget = check;
        break;
    }
    i++;
}
console.log('Proposed Logic Result:', safeTarget.toISOString());
