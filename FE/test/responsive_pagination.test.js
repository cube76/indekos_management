function getPagination(page, totalPages, maxVisible) {
    const pages = [];
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
        start = Math.max(1, end - maxVisible + 1);
    }

    const output = [];
    if (start > 1) {
        output.push(1);
        if (start > 2) output.push('...');
    }

    for (let i = start; i <= end; i++) {
        output.push(i);
    }

    if (end < totalPages) {
        if (end < totalPages - 1) output.push('...');
        output.push(totalPages);
    }
    return output;
}

console.log('Mobile (Max 3):');
console.log('Page 1 of 100:', getPagination(1, 100, 3).join(' '));
console.log('Page 50 of 100:', getPagination(50, 100, 3).join(' '));
console.log('Page 100 of 100:', getPagination(100, 100, 3).join(' '));

console.log('\nDesktop (Max 5):');
console.log('Page 1 of 100:', getPagination(1, 100, 5).join(' '));
console.log('Page 50 of 100:', getPagination(50, 100, 5).join(' '));
console.log('Page 100 of 100:', getPagination(100, 100, 5).join(' '));
