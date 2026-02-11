function getPagination(page, totalPages) {
    const pages = [];
    const maxVisible = 5;
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

console.log('Total 100, Page 1:', getPagination(1, 100).join(' '));
console.log('Total 100, Page 5:', getPagination(5, 100).join(' '));
console.log('Total 100, Page 50:', getPagination(50, 100).join(' '));
console.log('Total 100, Page 98:', getPagination(98, 100).join(' '));
console.log('Total 100, Page 100:', getPagination(100, 100).join(' '));
console.log('Total 5, Page 3:', getPagination(3, 5).join(' ')); // Small total check
