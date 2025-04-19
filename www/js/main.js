/**
 * Farm Manager Mobile - Main JS
 * Utility functions and initialization for the application
 */

// Format a date for display
function formatDate(dateString) {
    if (!dateString) return '-';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Format currency
function formatCurrency(value) {
    if (value === undefined || value === null) return '-';
    
    const amount = parseFloat(value);
    if (isNaN(amount)) return '-';
    
    // Get currency from storage or default to ZAR
    const selectedCurrency = localStorage.getItem('selectedCurrency') || 'ZAR';
    
    // Define currency symbols
    const currencySymbols = {
        'ZAR': 'R',
        'USD': '$',
        'EUR': '€',
        'GBP': '£',
        'AUD': 'A$',
        'CAD': 'C$',
        'NZD': 'NZ$'
    };
    
    const symbol = currencySymbols[selectedCurrency] || 'R';
    
    // Format with 2 decimal places
    return `${symbol}${amount.toFixed(2)}`;
}

// Helper function to export table to CSV
function exportTableToCSV(tableId, filename) {
    const table = document.getElementById(tableId);
    if (!table) {
        console.error(`Table with ID ${tableId} not found`);
        return;
    }
    
    let csv = [];
    const rows = table.querySelectorAll('tr');
    
    for (let i = 0; i < rows.length; i++) {
        const row = [], cols = rows[i].querySelectorAll('td, th');
        
        for (let j = 0; j < cols.length; j++) {
            // Replace HTML entities and handle commas
            let data = cols[j].innerText.replace(/(\r\n|\n|\r)/gm, ' ').replace(/"/g, '""');
            row.push('"' + data + '"');
        }
        
        csv.push(row.join(','));
    }
    
    // Download CSV file
    downloadCSV(csv.join('\n'), filename);
}

// Download CSV helper
function downloadCSV(csv, filename) {
    const csvFile = new Blob([csv], {type: 'text/csv'});
    const downloadLink = document.createElement('a');
    
    // File name
    downloadLink.download = filename + '_' + new Date().toISOString().split('T')[0] + '.csv';
    
    // Create a link to the file
    downloadLink.href = window.URL.createObjectURL(csvFile);
    
    // Hide download link
    downloadLink.style.display = 'none';
    
    // Add the link to DOM
    document.body.appendChild(downloadLink);
    
    // Click download link
    downloadLink.click();
    
    // Clean up
    document.body.removeChild(downloadLink);
}

// Export function for reports
function exportReportToCSV(reportType) {
    const reportContent = document.querySelector('.report-content');
    if (!reportContent) return;
    
    const table = reportContent.querySelector('table.report-table');
    if (!table) {
        console.error('No report table found to export');
        return;
    }
    
    // Create a temporary table ID for export
    const tempId = 'temp-export-table';
    table.id = tempId;
    
    // Export the table
    exportTableToCSV(tempId, reportType);
    
    // Remove the temporary ID
    table.removeAttribute('id');
}

// Document ready function
document.addEventListener('DOMContentLoaded', function() {
    console.log('Farm Manager Mobile initialized');
    
    // Add event listener for debug panel toggle if present
    const debugToggleBtn = document.getElementById('toggle-debug-panel');
    if (debugToggleBtn) {
        debugToggleBtn.addEventListener('click', function() {
            const debugPanel = document.getElementById('debug-panel');
            if (debugPanel) {
                debugPanel.style.display = debugPanel.style.display === 'none' ? 'block' : 'none';
            }
        });
    }
    
    // Add event listener for copy debug button if present
    const copyDebugBtn = document.getElementById('copy-debug');
    if (copyDebugBtn) {
        copyDebugBtn.addEventListener('click', function() {
            const debugOutput = document.getElementById('debug-output');
            if (debugOutput) {
                debugOutput.select();
                document.execCommand('copy');
            }
        });
    }
    
    // Add event listener for clear debug button if present
    const clearDebugBtn = document.getElementById('clear-debug');
    if (clearDebugBtn) {
        clearDebugBtn.addEventListener('click', function() {
            const debugOutput = document.getElementById('debug-output');
            if (debugOutput) {
                debugOutput.value = '';
            }
        });
    }
}); 