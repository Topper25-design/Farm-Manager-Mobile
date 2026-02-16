/**
 * utils.js
 * Utility functions used across all report types in the Farm Manager Mobile application
 */

// Storage Manager class
class StorageManager {
    static cache = new Map();
    static ttl = 300000; // 5 minutes default TTL

    /**
     * Get an item from storage, using cache if available
     * @param {string} key - Storage key
     * @param {{ bypassCache?: boolean }} options - If bypassCache is true, skip cache read/write (for fresh report data)
     * @returns {Promise<any>} Stored value or null
     */
    static async getItem(key, options = {}) {
        try {
            if (!options.bypassCache) {
                const cachedItem = this.cache.get(key);
                if (cachedItem && Date.now() - cachedItem.timestamp < this.ttl) {
                    return cachedItem.value;
                }
            }

            // Use same storage as app (mobileStorage) when available so reports see animal/feed data
            const storage = typeof window !== 'undefined' && window.mobileStorage && typeof window.mobileStorage.getItem === 'function'
                ? window.mobileStorage
                : null;
            let value;
            if (storage) {
                value = await storage.getItem(key);
                if (typeof value === 'string' && value) {
                    try {
                        value = JSON.parse(value);
                    } catch (_) { /* keep string */ }
                } else if (value != null) {
                    value = typeof value === 'string' ? (value ? JSON.parse(value) : null) : value;
                } else {
                    value = null;
                }
            } else {
                value = localStorage.getItem(key);
                value = value ? JSON.parse(value) : null;
            }

            if (!options.bypassCache && value !== null) {
                this.cache.set(key, {
                    value: value,
                    timestamp: Date.now()
                });
            }

            return value;
        } catch (error) {
            console.error('Error getting item from storage:', error);
            return null;
        }
    }
    
    /**
     * Set an item in storage and cache
     * @param {string} key - Storage key
     * @param {any} value - Value to store
     */
    static async setItem(key, value) {
        try {
            const storage = typeof window !== 'undefined' && window.mobileStorage && typeof window.mobileStorage.setItem === 'function'
                ? window.mobileStorage
                : null;
            const str = typeof value === 'string' ? value : JSON.stringify(value);
            if (storage) {
                await storage.setItem(key, str);
            } else {
                localStorage.setItem(key, str);
            }
            this.cache.set(key, { value, timestamp: Date.now() });
        } catch (error) {
            console.error('Error setting item in storage:', error);
        }
    }

    /**
     * Remove an item from storage and cache
     * @param {string} key - Storage key to remove
     */
    static async removeItem(key) {
        try {
            const storage = typeof window !== 'undefined' && window.mobileStorage && typeof window.mobileStorage.removeItem === 'function'
                ? window.mobileStorage
                : null;
            if (storage) {
                await storage.removeItem(key);
            } else {
                localStorage.removeItem(key);
            }
            this.cache.delete(key);
        } catch (error) {
            console.error('Error removing item from storage:', error);
        }
    }

    /**
     * Clear only the cache, not localStorage
     */
    static async clearCache() {
        try {
            this.cache.clear();
            } catch (error) {
            console.error('Error clearing cache:', error);
        }
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache statistics
     */
    static getCacheStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys()),
            ttl: this.ttl
        };
    }
}

// Date Manager class
class DateManager {
    static getDefaultDateRange() {
        const end = new Date();
        const start = new Date();
        start.setMonth(start.getMonth() - 1);
        return {
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0]
        };
    }

    static formatDate(date) {
        if (!date) return 'N/A';
        try {
            const dateObj = new Date(date);
            if (isNaN(dateObj.getTime())) return 'Invalid date';
            return dateObj.toLocaleDateString();
        } catch (e) {
            console.error('Error formatting date:', e);
            return 'Error';
        }
    }

    static formatDateRange(startDate, endDate) {
        return `${this.formatDate(startDate)} to ${this.formatDate(endDate)}`;
    }
}

// Currency Manager class
class CurrencyManager {
    static userCurrency = 'R';
    static currencyCode = 'ZAR';
    static formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'ZAR'
    });
    
    // Common currency symbols and their ISO codes
    static currencyMap = {
        'R': 'ZAR',   // South African Rand
        '$': 'USD',   // US Dollar
        '£': 'GBP',   // British Pound
        '€': 'EUR',   // Euro
        '¥': 'JPY',   // Japanese Yen
        'A$': 'AUD',  // Australian Dollar
        'C$': 'CAD',  // Canadian Dollar
        'N$': 'NAD',  // Namibian Dollar
        'P': 'BWP',   // Botswana Pula
        'Z$': 'ZWD',  // Zimbabwe Dollar
        'KSh': 'KES', // Kenyan Shilling
        'TSh': 'TZS', // Tanzanian Shilling
        'USh': 'UGX', // Ugandan Shilling
        'MT': 'MZN',  // Mozambican Metical
        'N': 'NGN'    // Nigerian Naira
    };
    
    static async initialize() {
        try {
            // Get user's preferred currency from storage
            const storedCurrency = await StorageManager.getItem('currency');
            this.userCurrency = storedCurrency || 'R';
            
            if (typeof this.userCurrency === 'string') {
                const trimmedCurrency = this.userCurrency.trim();
                this.currencyCode = this.currencyMap[trimmedCurrency] || trimmedCurrency;
            }
            
            // Create Intl formatter with user's currency
            try {
                this.formatter = new Intl.NumberFormat(undefined, {
                    style: 'currency',
                    currency: this.currencyCode,
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                });
            } catch (e) {
                console.warn('Failed to create Intl formatter, will use basic formatting:', e);
                // Ensure we always have a formatter by using the default one
                this.formatter = new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'ZAR'
                });
            }
            
            // Bind the formatCurrency method to ensure it always has the correct context
            this.formatCurrency = this.formatCurrency.bind(this);
            
            console.log('Currency manager initialized:', {
                userCurrency: this.userCurrency,
                currencyCode: this.currencyCode,
                hasFormatter: !!this.formatter
            });
        } catch (error) {
            console.error('Error initializing currency manager:', error);
            // Use default currency (R) if initialization fails
            this.userCurrency = 'R';
            this.currencyCode = 'ZAR';
            this.formatter = new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'ZAR'
            });
        }
    }
    
    static formatCurrency(amount) {
        if (amount === undefined || amount === null) return '-';
        try {
            const numAmount = Number(amount);
            if (isNaN(numAmount)) return '-';
            
            // Ensure we have a formatter
            if (!this.formatter) {
                this.formatter = new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: this.currencyCode || 'ZAR',
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                });
            }
            
            // Try using Intl formatter first
                try {
                    return this.formatter.format(numAmount);
                } catch (e) {
                    console.warn('Intl formatter failed, using basic formatting');
            // Fallback to basic formatting
            const formattedNumber = numAmount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            return `${this.userCurrency} ${formattedNumber}`;
            }
        } catch (error) {
            console.error('Error formatting currency:', error);
            // Last resort fallback
            return `R ${Number(amount).toFixed(2)}`;
        }
    }

    static getCurrencySymbol() {
        return this.userCurrency;
    }

    static getCurrencyCode() {
        return this.currencyCode;
    }
}

/**
 * Creates a standardized structure for all reports
 * @param {string} reportTitle - The main title of the report
 * @param {string} reportSubtitle - Optional subtitle or description
 * @param {Object|string} dateRange - Date range object with start and end dates or formatted string
 * @param {string} tableHTML - The main content HTML of the report
 * @param {Object} summaryData - Optional summary data to display in the header
 * @param {boolean} isDemoData - Whether the report uses demo data
 * @param {string} reportType - Type of report for export functionality
 * @returns {string} Complete HTML for the report
 */
function createStandardReportStructure(reportTitle, reportSubtitle = '', dateRange = '', tableHTML = '', summaryData = null, isDemoData = false, reportType = '') {
    // Format the date range for display
    let formattedDateRange = '';
    
    if (typeof dateRange === 'string') {
        formattedDateRange = dateRange;
    } else if (dateRange && typeof dateRange === 'object') {
        if (dateRange.start && dateRange.end) {
            formattedDateRange = DateManager.formatDateRange(dateRange.start, dateRange.end);
        } else if (dateRange.start) {
            formattedDateRange = `From ${DateManager.formatDate(dateRange.start)}`;
        } else if (dateRange.end) {
            formattedDateRange = `Until ${DateManager.formatDate(dateRange.end)}`;
        }
    }

    // Format summary data if available
    let summaryHTML = '';
    if (summaryData) {
        if (Array.isArray(summaryData.summary)) {
            summaryHTML = `
                <div class="report-summary">
                    ${summaryData.summary.map(item => `<p class="summary-item">${item}</p>`).join('')}
                </div>`;
        } else if (typeof summaryData === 'object') {
            summaryHTML = `
                <div class="report-summary">
                    ${Object.entries(summaryData)
                        .filter(([key]) => key !== 'summary')
                        .map(([key, value]) => `<p class="summary-item"><strong>${key}:</strong> ${value}</p>`)
                        .join('')}
                </div>`;
        }
    }

    // Add print-specific styles
    const printStyles = `
        <style>
            @media print {
                .no-print { display: none !important; }
                .report-container { margin: 0; padding: 0; }
                .report-header { margin-bottom: 20px; }
                .report-content { break-inside: avoid; }
                .report-table { width: 100%; border-collapse: collapse; }
                .report-table th { background-color: #f5f5f5 !important; -webkit-print-color-adjust: exact; }
                .report-table td, .report-table th { border: 1px solid #ddd; padding: 8px; }
                .page-break { page-break-before: always; }
                .summary-item { margin: 5px 0; }
                @page { margin: 2cm; }
            }
            
            /* Standard styles */
            .report-container {
                max-width: 1200px;
                margin: 20px auto;
                padding: 20px;
                font-family: Arial, sans-serif;
            }
            .report-header {
                text-align: center;
                margin-bottom: 30px;
            }
            .report-title {
                font-size: 24px;
                margin: 0 0 10px 0;
            }
            .report-subtitle {
                font-size: 18px;
                color: #666;
                margin: 0 0 15px 0;
            }
            .report-meta {
                font-size: 14px;
                color: #888;
            }
            .report-summary {
                background: #f9f9f9;
                padding: 15px;
                margin: 20px 0;
                border-radius: 5px;
            }
            .summary-item {
                margin: 5px 0;
            }
            .report-table {
                width: 100%;
                border-collapse: collapse;
                margin: 20px 0;
            }
            .report-table th {
                background: #f5f5f5;
                padding: 12px 8px;
                text-align: left;
                font-weight: bold;
                border: 1px solid #ddd;
            }
            .report-table td {
                padding: 8px;
                border: 1px solid #ddd;
            }
            .report-table tr:nth-child(even) {
                background: #fafafa;
            }
            .demo-data-notice {
                color: #ff6b6b;
                font-style: italic;
                margin-left: 10px;
            }
            .report-footer {
                margin-top: 30px;
                text-align: center;
                color: #888;
                font-size: 12px;
            }
            .export-options {
                margin-top: 20px;
                text-align: right;
            }
            .export-options button {
                margin-left: 10px;
                padding: 8px 15px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                background: #007bff;
                color: white;
            }
            .export-options button:hover {
                background: #0056b3;
            }
            .loading-indicator {
                display: none;
                text-align: center;
                padding: 20px;
            }
            .loading-indicator.active {
                display: block;
            }
        </style>`;

    // Create the HTML structure
    return `
        ${printStyles}
        <div class="report-container" data-report-type="${reportType}">
            <div class="loading-indicator">
                <div class="spinner"></div>
                <p>Generating report...</p>
            </div>
            <div class="report-header">
                <h1 class="report-title">${reportTitle}</h1>
                ${reportSubtitle ? `<h2 class="report-subtitle">${reportSubtitle}</h2>` : ''}
                <div class="report-meta">
                    <span class="date-range">${formattedDateRange}</span>
                    ${isDemoData ? '<span class="demo-data-notice">(Demo Data)</span>' : ''}
                </div>
                ${summaryHTML}
            </div>
            <div class="report-content">
                ${tableHTML}
            </div>
            <div class="report-footer">
                <p>Generated on ${new Date().toLocaleString()} | Farm Manager Mobile</p>
            </div>
            <div class="export-options no-print">
                <button onclick="printReport('${reportType}')" class="btn-print">Print Report</button>
                <button onclick="exportReportToCSV('${reportType}')" class="btn-export-csv">Export to CSV</button>
                <button onclick="exportReportToPDF('${reportType}')" class="btn-export-pdf">Export to PDF</button>
            </div>
        </div>
    `;
}

/**
 * Get the table selector for a specific report type
 * @param {string} reportType - The type of report
 * @returns {string} CSS selector for the report table
 */
function getTableSelectorForReportType(reportType) {
    switch (reportType) {
        case 'all-feed':
            return '.feed-report-table';
        case 'feed-purchase':
            return '.feed-purchase-table';
        case 'feed-usage':
            return '.feed-usage-table';
        case 'feed-inventory':
            return '.feed-inventory-table';
        case 'feed-calculations':
            return '.feed-calculation-table';
        case 'all-animal':
            return '.animal-transactions-table';
        case 'animal-inventory':
            return '.animal-inventory-table';
        case 'animal-movement':
        case 'animal-purchase':
        case 'animal-sale':
        case 'animal-birth':
        case 'animal-death':
        case 'animal-count':
        case 'animal-discrepancy':
            return '.animal-report-table';
        case 'all-health':
        case 'health-treatment':
        case 'health-vaccination':
        case 'health-medication':
            return '.health-report-table';
        default:
            return '.report-table';
    }
}

/**
 * Print the current report with proper styling
 * @param {string} reportType - Type of report being printed
 */
function printReport(reportType) {
    try {
        const reportElement = document.querySelector(`.report-content [data-report-type="${reportType}"]`);
        if (!reportElement) {
            alert('Report not found. Generate a report first.');
            return;
        }
        const { reportHtml, styles } = getReportWindowContent(reportElement);
        const printWin = window.open('', '_blank');
        if (!printWin) {
            alert('Please allow popups to print the report.');
            return;
        }
        printWin.document.write(`
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Report - Print</title>
<style>${styles}</style></head>
<body>${reportHtml}</body></html>`);
        printWin.document.close();
        printWin.focus();
        setTimeout(function () {
            try {
                printWin.print();
                printWin.close();
            } catch (e) {
                printWin.close();
            }
        }, 250);
    } catch (error) {
        console.error('Error printing report:', error);
        alert('There was an error printing the report. Please try again.');
    }
}

/**
 * Export report data to CSV file
 * @param {string} reportType - Type of report being exported
 */
function exportReportToCSV(reportType) {
    try {
        // Get the appropriate table based on report type
        const tableSelector = getTableSelectorForReportType(reportType);
        const table = document.querySelector(tableSelector);
        
        if (!table) {
            console.error('No table found for export');
            alert('No data available to export');
            return;
        }
        
        // Extract table data
        const rows = [];
        const headers = [];
        
        // Get headers
        const headerRow = table.querySelector('thead tr');
        if (headerRow) {
            const headerCells = headerRow.querySelectorAll('th');
            headerCells.forEach(cell => {
                headers.push(cell.textContent.trim());
            });
            rows.push(headers);
        }
        
        // Get data rows
        const dataRows = table.querySelectorAll('tbody tr');
        dataRows.forEach(row => {
            // Skip rows that are empty or total rows
            if (row.classList.contains('no-data') || row.classList.contains('type-header')) {
                return;
            }
            
            const rowData = [];
            const cells = row.querySelectorAll('td');
            cells.forEach(cell => {
                rowData.push(cell.textContent.trim());
            });
            
            // Only add non-empty rows
            if (rowData.some(cell => cell !== '')) {
                rows.push(rowData);
            }
        });
        
        // Convert to CSV
        let csvContent = rows.map(row => 
            row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')
        ).join('\n');
        
        // Create and trigger download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${reportType}-report-${timestamp}.csv`;
        
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        console.error('Error exporting report:', error);
        alert('There was an error exporting the report. Please try again.');
    }
}

// Export utility functions and classes
export {
    StorageManager,
    DateManager,
    CurrencyManager,
    MobileUtils,
    filterByDateRange,
    validateDateRange,
    formatValue,
    cleanData,
    generateId,
    deepEqual,
    createStandardReportStructure,
    getTableSelectorForReportType,
    printReport,
    exportReportToCSV,
    exportReportToPDF
};

// Export date and currency functions with proper binding
export const formatDate = DateManager.formatDate.bind(DateManager);
export const formatDateRange = DateManager.formatDateRange.bind(DateManager);
export const getDefaultDateRange = DateManager.getDefaultDateRange.bind(DateManager);
export const formatCurrency = CurrencyManager.formatCurrency.bind(CurrencyManager);

// Initialize event handlers and global access
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('Initializing utils.js functionality');
        
        // Initialize managers
        await CurrencyManager.initialize();
        
        // Make utility functions globally accessible with proper binding
        window.formatCurrency = CurrencyManager.formatCurrency.bind(CurrencyManager);
        window.formatDate = DateManager.formatDate.bind(DateManager);
        window.formatDateRange = DateManager.formatDateRange.bind(DateManager);
        window.getDefaultDateRange = DateManager.getDefaultDateRange.bind(DateManager);
        
        console.log('Utils initialization complete');
    } catch (error) {
        console.error('Error initializing utils:', error);
    }
});

/**
 * Export the report to PDF
 * @param {string} reportType - Type of report being exported
 * @returns {Promise<void>}
 */
/**
 * Build report-only HTML and styles (same as print). Used by both print and PDF export.
 */
function getReportWindowContent(reportElement) {
    const clone = reportElement.cloneNode(true);
    clone.querySelectorAll('.no-print, .export-options').forEach(el => el.remove());
    const reportHtml = clone.outerHTML;
    return {
        reportHtml,
        styles: `
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; font-family: Arial, sans-serif; color: #000; font-size: 12pt; line-height: 1.4; width: 100%; overflow-x: auto; }
    body { padding: 8px; }
    .report-container { width: 100%; max-width: 200mm; margin: 0 auto; }
    .report-header { text-align: center; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #ddd; }
    .report-type-header { margin-bottom: 4px; }
    .report-type-title, .report-title { font-size: 22pt; margin: 0 0 6px 0; color: #000; font-weight: bold; }
    .report-subtitle { font-size: 16pt; color: #333; margin: 0 0 8px 0; }
    .report-meta { font-size: 11pt; color: #555; margin-bottom: 10px; }
    .date-range { font-size: 11pt; color: #555; }
    .report-summary { background: #f9f9f9; padding: 8px 12px; margin: 10px 0; border-radius: 6px; border: 1px solid #eee; }
    .summary-title { font-weight: bold; color: #2c3e50; margin-bottom: 6px; font-size: 12pt; }
    .summary-item { margin: 2px 0; font-size: 11pt; }
    .report-content { margin: 10px 0; }
    .report-section { margin-bottom: 16px; page-break-inside: avoid; page-break-after: auto; }
    .report-section h3 { font-size: 14pt; margin: 0 0 8px 0; padding-bottom: 4px; border-bottom: 1px solid #ddd; color: #2c3e50; page-break-after: avoid; }
    .report-table { width: 100%; max-width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 10pt; page-break-inside: auto; table-layout: fixed; }
    .report-table thead { display: table-header-group; page-break-after: avoid; }
    .report-table tbody tr:first-child { page-break-before: avoid; }
    .report-table tr { page-break-inside: avoid; }
    .report-table th, .report-table td { border: 1px solid #333; padding: 6px 8px; text-align: left; color: #000; word-break: normal; overflow-wrap: break-word; }
    .report-table th { background: #e8e8e8 !important; font-weight: bold; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .report-table tbody tr:nth-child(even) { background: #f5f5f5; }
    .report-table .summary-row, .report-table .total-row { font-weight: bold; background: #eee !important; }
    .report-table .text-right { text-align: right; }
    .report-table .negative { color: #c00; }
    .report-table .positive { color: #080; }
    .report-footer { margin-top: 16px; padding-top: 8px; font-size: 10pt; color: #666; text-align: center; border-top: 1px solid #ddd; }
    .empty-state { text-align: center; color: #555; padding: 16px 12px; font-style: italic; }
    .demo-data-notice { color: #c00; font-style: italic; margin-left: 6px; }
    .calculation-card, .feed-calculation-card { border: 1px solid #ddd; border-radius: 8px; padding: 8px 10px; margin-bottom: 8px; background: #fafafa; }
    .calculation-card .card-header, .feed-calculation-card .card-header { font-weight: bold; margin-bottom: 6px; }
    .calculation-card .card-body, .feed-calculation-card .card-body { font-size: 11pt; }
    .summary-section { margin-bottom: 10px; }
    .summary-header { font-weight: bold; margin-bottom: 8px; color: #2c3e50; }
    .summary-cards { display: block; margin: 8px 0; }
    .summary-card { background: #f8f9fa; border-radius: 8px; padding: 12px; margin-bottom: 8px; border: 1px solid #eee; }
    .summary-card h4 { margin: 0 0 8px 0; font-size: 11pt; color: #555; }
    .summary-value { font-size: 12pt; font-weight: bold; color: #2c3e50; }
    .report-notes { margin-top: 16px; font-size: 10pt; color: #555; }
    .report-notes h4 { margin: 0 0 8px 0; font-size: 11pt; }
    .report-notes ul { margin: 0; padding-left: 20px; }
    .unresolved-discrepancy { background: #fff0f0 !important; }
    .resolved-discrepancy { background: #e8f5e9 !important; }
    .resolution, .resolving-count { background: #f8f9fa !important; }
    .resolution-text { color: #28a745; font-weight: bold; }
    .unresolved-text { color: #dc3545; font-weight: bold; }
    .final-count { color: #28a745; margin-left: 8px; }
    .counter-name { color: #666; font-style: italic; margin-top: 4px; padding-left: 4px; border-left: 2px solid #ddd; }
    .report-summary { page-break-inside: avoid; }
    .report-header { page-break-after: avoid; }
    .report-footer { page-break-inside: avoid; }
    @media print { body { padding: 8px; margin: 0; } .report-section { page-break-inside: avoid; } .report-table tr { page-break-inside: avoid; } .report-table thead { page-break-after: avoid; } .report-table tbody tr:first-child { page-break-before: avoid; } }
`
    };
}

async function exportReportToPDF(reportType = 'report') {
    try {
        const reportElement = document.querySelector(`.report-content [data-report-type="${reportType}"]`);
        if (!reportElement) {
            throw new Error('Report element not found');
        }
        const { reportHtml, styles } = getReportWindowContent(reportElement);
        const filename = `${reportType}_${formatDate(new Date())}.pdf`;
        const pdfWin = window.open('', '_blank');
        if (!pdfWin) {
            alert('Please allow popups to export PDF.');
            return;
        }
        // Same document as print: report only. Then run html2pdf inside this window so it captures only this document.
        const pdfScript = `
            window.__pdfFilename = ${JSON.stringify(filename)};
            var s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
            s.onload = function() {
                var opt = {
                    margin: 5,
                    filename: window.__pdfFilename,
                    image: { type: 'jpeg', quality: 0.92 },
                    html2canvas: { scale: 2, useCORS: true, letterRendering: true, allowTaint: true },
                    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                    pagebreak: { mode: 'legacy', avoid: ['tr', 'thead', '.report-summary', '.report-header', '.report-section h3'] }
                };
                html2pdf().set(opt).from(document.body).save().then(function() { window.close(); }).catch(function(err) { console.error(err); window.close(); });
            };
            s.onerror = function() { alert('Failed to load PDF library.'); window.close(); };
            document.head.appendChild(s);
        `;
        const safeReportHtml = reportHtml.replace(/<\/script/gi, '<\\/script');
        pdfWin.document.write(`
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Report - PDF</title>
<style>${styles}</style></head>
<body>${safeReportHtml}
<script>${pdfScript}<\/script>
</body></html>`);
        pdfWin.document.close();
        console.log('PDF export started in new window.');
    } catch (error) {
        console.error('Error exporting PDF:', error);
        alert('Failed to export PDF. Please try again.');
    }
}

/**
 * Load an external script
 * @param {string} src - Script source URL
 * @returns {Promise<void>}
 */
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Expose report actions on window for inline onclick handlers (report HTML is created by modules)
window.printReport = printReport;
window.exportReportToCSV = exportReportToCSV;
window.exportReportToPDF = exportReportToPDF; 

/**
 * Mobile Device Support
 * Functions for handling mobile-specific features and behaviors
 */

// Mobile Storage Implementation
const MobileStorage = {
    _cache: {},
    _syncCache: {},
    DEFAULT_TTL: 5 * 60 * 1000, // 5 minutes default TTL

    /**
     * Get an item synchronously
     * @param {string} key - Storage key
     * @returns {string} - The stored value or null
     */
    getItemSync(key) {
        try {
            if (this._syncCache[key] !== undefined) {
                return this._syncCache[key];
            }
            
            if (typeof localStorage !== 'undefined') {
                const value = localStorage.getItem(key);
                this._syncCache[key] = value;
                return value;
            }
            return null;
        } catch (error) {
            console.error('Error in getItemSync:', error);
            return null;
        }
    },

    /**
     * Set an item synchronously
     * @param {string} key - Storage key
     * @param {string} value - Value to store
     */
    setItemSync(key, value) {
        try {
            this._syncCache[key] = value;
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem(key, value);
            }
        } catch (error) {
            console.error('Error in setItemSync:', error);
        }
    },

    /**
     * Remove an item synchronously
     * @param {string} key - Storage key to remove
     */
    removeItemSync(key) {
        try {
            delete this._syncCache[key];
            if (typeof localStorage !== 'undefined') {
                localStorage.removeItem(key);
            }
        } catch (error) {
            console.error('Error in removeItemSync:', error);
        }
    },

    /**
     * Clear all storage synchronously
     */
    clearSync() {
        try {
            this._syncCache = {};
            if (typeof localStorage !== 'undefined') {
                localStorage.clear();
            }
        } catch (error) {
            console.error('Error in clearSync:', error);
        }
    },

    /**
     * Get an item asynchronously with TTL support
     * @param {string} key - Storage key
     * @param {Object} options - Optional settings { bypassCache: boolean, ttl: number }
     * @returns {Promise<string>} - The stored value or null
     */
    async getItem(key, options = {}) {
        try {
            // Check TTL cache first unless bypassed
            if (!options.bypassCache && this._cache[key]) {
                const cacheEntry = this._cache[key];
                if (Date.now() < cacheEntry.expiresAt) {
                    return cacheEntry.value;
                }
            }

            // Try capacitor storage if available
            if (typeof window.storageApi !== 'undefined') {
                const value = await window.storageApi.getItem(key);
                if (value !== null) {
                    this._updateCache(key, value, options.ttl);
                    return value;
                }
            }

            // Fallback to sync storage
            return this.getItemSync(key);
        } catch (error) {
            console.error('Error in getItem:', error);
            return null;
        }
    },

    /**
     * Set an item asynchronously with TTL
     * @param {string} key - Storage key
     * @param {string} value - Value to store
     * @param {Object} options - Optional settings { ttl: number }
     */
    async setItem(key, value, options = {}) {
        try {
            // Update TTL cache
            this._updateCache(key, value, options.ttl);

            // Try capacitor storage if available
            if (typeof window.storageApi !== 'undefined') {
                await window.storageApi.setItem(key, value);
            } else {
                // Fallback to sync storage
                this.setItemSync(key, value);
            }
        } catch (error) {
            console.error('Error in setItem:', error);
            throw error;
        }
    },

    /**
     * Remove an item asynchronously
     * @param {string} key - Storage key
     */
    async removeItem(key) {
        try {
            // Clear from caches
            delete this._cache[key];
            delete this._syncCache[key];

            // Try capacitor storage if available
            if (typeof window.storageApi !== 'undefined') {
                await window.storageApi.removeItem(key);
            } else {
                // Fallback to sync storage
                this.removeItemSync(key);
            }
        } catch (error) {
            console.error('Error in removeItem:', error);
            throw error;
        }
    },

    /**
     * Clear all storage asynchronously
     */
    async clear() {
        try {
            // Clear caches
            this._cache = {};
            this._syncCache = {};

            // Try capacitor storage if available
            if (typeof window.storageApi !== 'undefined') {
                await window.storageApi.clear();
            } else {
                // Fallback to sync storage
                this.clearSync();
            }
        } catch (error) {
            console.error('Error in clear:', error);
            throw error;
        }
    },

    /**
     * Update cache with TTL
     * @private
     */
    _updateCache(key, value, ttl = this.DEFAULT_TTL) {
        this._cache[key] = {
            value,
            expiresAt: Date.now() + ttl,
            lastUpdated: Date.now()
        };
        this._syncCache[key] = value;
    },

    /**
     * Clear expired items from cache
     */
    clearExpiredCache() {
        const now = Date.now();
        Object.entries(this._cache).forEach(([key, entry]) => {
            if (now >= entry.expiresAt) {
                delete this._cache[key];
            }
        });
    }
};

// Initialize mobile storage if not already initialized
if (typeof window.mobileStorage === 'undefined') {
    window.mobileStorage = MobileStorage;
}

/**
 * Setup keyboard detection for mobile devices
 */
function setupKeyboardDetection() {
    if ('visualViewport' in window) {
        window.visualViewport.addEventListener('resize', () => {
            const isKeyboardOpen = window.visualViewport.height < window.innerHeight;
            document.body.classList.toggle('keyboard-open', isKeyboardOpen);
            
            if (isKeyboardOpen) {
                // Scroll active element into view
                const activeElement = document.activeElement;
                if (activeElement && activeElement.tagName.toLowerCase() !== 'body') {
                    setTimeout(() => activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
                }
            }
        });
    }
}

/**
 * Handle orientation changes on mobile devices
 */
function handleOrientationChange() {
    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            console.warn('Orientation change handler timed out');
            resolve();
        }, 2000);

        const orientationChangeComplete = () => {
            clearTimeout(timeout);
            
            // Refresh any open dialogs or modals
            const modals = document.querySelectorAll('.modal.show');
            modals.forEach(modal => {
                if (modal.refresh && typeof modal.refresh === 'function') {
                    modal.refresh();
                }
            });

            // Adjust table layouts
            const tables = document.querySelectorAll('.report-table');
            tables.forEach(table => {
                if (table.refresh && typeof table.refresh === 'function') {
                    table.refresh();
                }
            });

            resolve();
        };

        if ('screen' in window && 'orientation' in window.screen) {
            screen.orientation.addEventListener('change', orientationChangeComplete, { once: true });
        } else {
            window.addEventListener('orientationchange', () => {
                // Short delay to allow layout to settle
                setTimeout(orientationChangeComplete, 100);
            }, { once: true });
        }
    });
}

// Export mobile utility functions
const MobileUtils = {
    setupKeyboardDetection,
    handleOrientationChange
};

// Initialize mobile features on load
document.addEventListener('DOMContentLoaded', () => {
    setupKeyboardDetection();
    window.addEventListener('orientationchange', handleOrientationChange);
});

/**
 * Data Collection Utilities
 * Functions for collecting and processing report data
 */

/**
 * Filter data by date range
 * @param {Array} data - Array of data objects with date/timestamp
 * @param {Date} startDate - Start date for filtering
 * @param {Date} endDate - End date for filtering
 * @returns {Array} Filtered data
 */
function filterByDateRange(data, startDate, endDate) {
    if (!Array.isArray(data)) return [];
    
    return data.filter(item => {
        const itemDate = new Date(item.date || item.timestamp);
        return itemDate >= startDate && itemDate <= endDate;
    });
}

/**
 * Process and validate date range
 * @param {string|Date} startDate - Start date
 * @param {string|Date} endDate - End date
 * @returns {Object} Validated date range object
 */
function validateDateRange(startDate, endDate) {
    const validDateRange = {
        start: startDate ? new Date(startDate) : new Date(0),
        end: endDate ? new Date(endDate) : new Date()
    };

    // Ensure valid dates
    if (isNaN(validDateRange.start.getTime())) validDateRange.start = new Date(0);
    if (isNaN(validDateRange.end.getTime())) validDateRange.end = new Date();

    return validDateRange;
}

/**
 * Format data for display
 * @param {any} value - Value to format
 * @param {string} type - Type of formatting to apply
 * @returns {string} Formatted value
 */
function formatValue(value, type = 'text') {
    if (value === undefined || value === null) return '-';

    switch (type) {
        case 'date':
            try {
                return new Date(value).toLocaleDateString();
            } catch (e) {
                return '-';
            }
        case 'number':
            return Number(value).toLocaleString() || '-';
        case 'boolean':
            return value ? 'Yes' : 'No';
        case 'array':
            return Array.isArray(value) ? value.join(', ') : '-';
        default:
            return String(value);
    }
}

/**
 * Clean and validate data object
 * @param {Object} data - Data object to clean
 * @param {Array} requiredFields - Array of required field names
 * @returns {Object} Cleaned data object
 */
function cleanData(data, requiredFields = []) {
    if (!data || typeof data !== 'object') return null;

    const cleaned = {};
    let isValid = true;

    // Check required fields
    for (const field of requiredFields) {
        if (data[field] === undefined || data[field] === null) {
            isValid = false;
            break;
        }
        cleaned[field] = data[field];
    }

    if (!isValid) return null;

    // Clean other fields
    Object.entries(data).forEach(([key, value]) => {
        if (!requiredFields.includes(key)) {
            cleaned[key] = value === undefined || value === null ? '' : value;
        }
    });

    return cleaned;
}

/**
 * Generate unique ID for records
 * @param {string} prefix - Prefix for the ID
 * @returns {string} Unique ID
 */
function generateId(prefix = '') {
    return `${prefix}${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Deep compare two objects
 * @param {any} obj1 - First object
 * @param {any} obj2 - Second object
 * @returns {boolean} Whether objects are equal
 */
function deepEqual(obj1, obj2) {
    if (obj1 === obj2) return true;
    if (typeof obj1 !== typeof obj2) return false;
    if (typeof obj1 !== 'object') return false;
    if (!obj1 || !obj2) return false;

    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    if (keys1.length !== keys2.length) return false;

    return keys1.every(key => deepEqual(obj1[key], obj2[key]));
} 