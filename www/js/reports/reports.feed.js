/**
 * reports.feed.js
 * Feed-related reporting functions for Farm Manager Mobile
 */

import { 
    StorageManager,
    DateManager,
    CurrencyManager,
    formatDate, 
    formatCurrency,
    formatDateRange,
    printReport, 
    exportReportToCSV, 
    createStandardReportStructure 
} from './utils.js';

// Report type constants
const REPORT_TYPES = {
    FEED: {
        ALL: 'all-feed',
        INVENTORY: 'feed-inventory',
        PURCHASE: 'feed-purchase',
        USAGE: 'feed-usage',
        CALCULATION: 'feed-calculation'
    }
};

// Module state
let selectedReportType = '';
let selectedFeedCategory = 'all';

// Initialize event handlers and global access
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log('Initializing feed report functionality');
        
        // Make feed data loading functions globally accessible
        const feedReportFunctions = {
            loadFeedData,
            loadFeedPurchaseData,
            loadFeedUsageData,
            loadFeedCalculationData,
            getFeedCategories,
            handleFeedReportTypeChange,
            handleFeedCategoryChange
        };
        
        // Assign functions to window object
        Object.entries(feedReportFunctions).forEach(([key, func]) => {
            window[key] = func;
        });
        
        // Add event listeners for feed-specific controls
        const reportTypeSelect = document.getElementById('feed-report-type');
        const categorySelect = document.getElementById('category-select');
        
        if (reportTypeSelect) {
            reportTypeSelect.addEventListener('change', handleFeedReportTypeChange);
            console.log('Added feed report type change listener');
        }
        
        if (categorySelect) {
            categorySelect.addEventListener('change', handleFeedCategoryChange);
            console.log('Added feed category change listener');
        }
        
        // Initialize report type if selected
        if (reportTypeSelect && reportTypeSelect.value) {
            console.log('Triggering initial report type change');
            reportTypeSelect.dispatchEvent(new Event('change'));
        }
        
        console.log('Feed report initialization complete');
    } catch (error) {
        console.error('Error initializing feed reports:', error);
    }
});

// Data loading functions
/**
 * Load feed data based on category and date range
 * @param {string} category - Feed category filter
 * @param {Date} startDate - Start date for filtering
 * @param {Date} endDate - End date for filtering
 * @returns {Promise<Object>} Object containing feed data
 */
async function loadFeedData(category, startDate, endDate) {
    console.log(`Loading feed data for category: ${category}, from ${startDate} to ${endDate}`);
    
    try {
        // Bypass cache so report always sees latest data (same as animals)
        const cacheOpt = { bypassCache: true };
        // Get current feed inventory
        const feedInventoryRaw = await StorageManager.getItem('feedInventory', cacheOpt);
        let feedInventoryMap = new Map();
        
        try {
            if (feedInventoryRaw) {
                // StorageManager returns already-parsed value; feed.js stores Array.from(entries()) so we often get an array
                if (Array.isArray(feedInventoryRaw)) {
                    feedInventoryMap = new Map(feedInventoryRaw);
                } else if (typeof feedInventoryRaw === 'string') {
                    try {
                        const parsed = JSON.parse(feedInventoryRaw);
                        if (Array.isArray(parsed)) {
                            feedInventoryMap = new Map(parsed);
                        } else if (typeof parsed === 'object') {
                            feedInventoryMap = new Map(Object.entries(parsed));
                        }
                    } catch (parseError) {
                        feedInventoryMap.set(feedInventoryRaw, {
                            quantity: 0,
                            unit: 'kg',
                            lastUpdated: new Date().toISOString()
                        });
                    }
                } else if (typeof feedInventoryRaw === 'object') {
                    if (feedInventoryRaw instanceof Map) {
                        feedInventoryMap = feedInventoryRaw;
                    } else {
                        feedInventoryMap = new Map(Object.entries(feedInventoryRaw));
                    }
                }
            }
        } catch (parseError) {
            console.warn('Error parsing feed inventory, using empty inventory:', parseError);
        }
        
        // Load purchase and usage data
        const purchaseData = await loadFeedPurchaseData(startDate, endDate, category);
        const usageData = await loadFeedUsageData(startDate, endDate, category);
        
        // Calculate current stock levels (include price from inventory so report shows correct Price per Unit / Total Value)
        // Note: Inventory is organized by feed type, not animal category, so we show all feed types
        // Animal category filtering only applies to transactions (purchases/usage)
        const stockLevels = {};
        feedInventoryMap.forEach((data, feedType) => {
            const price = data.price != null && data.price !== '' ? parseFloat(data.price) : 0;
            stockLevels[feedType] = {
                quantity: data.quantity || 0,
                unit: data.unit || 'kg',
                lastUpdated: data.lastUpdated,
                price: !isNaN(price) ? price : 0,
                pricePerUnit: !isNaN(price) ? price : 0  // Add pricePerUnit for calculateTotalStockValue
            };
        });
        
        // Build feedInventory array and feedTransactions for createFeedInventoryTable (same pattern as animals)
        const feedInventoryArray = Object.entries(stockLevels).map(([feedType, stock]) => ({
            feedType,
            quantity: stock.quantity || 0,
            unit: stock.unit || 'kg',
            pricePerUnit: stock.price ?? 0,
            price: stock.price ?? 0,
            lastUpdated: stock.lastUpdated
        }));
        const feedTransactions = [...purchaseData, ...usageData].sort((a, b) => new Date(b.date) - new Date(a.date));

        // Check if we have any data
        const hasData = 
            Object.keys(stockLevels).length > 0 ||
            purchaseData.length > 0 ||
            usageData.length > 0;
        
        console.log(`Feed data loaded: ${purchaseData.length} purchases, ${usageData.length} usage records, ${Object.keys(stockLevels).length} inventory items`);
        
        return {
            currentStock: stockLevels,
            purchases: purchaseData,
            usage: usageData,
            feedInventory: feedInventoryArray,
            feedTransactions,
            hasData,
            category,
            dateRange: {
                start: startDate,
                end: endDate
            }
        };
    } catch (error) {
        console.error('Error loading feed data:', error);
        throw new Error(`Failed to load feed data: ${error.message}`);
    }
}

/**
 * Load feed purchase data
 * @param {Date} startDate - Start date for filtering
 * @param {Date} endDate - End date for filtering
 * @param {string} category - Feed category filter
 * @returns {Promise<Array>} Array of feed purchase transactions
 */
async function loadFeedPurchaseData(startDate, endDate, category) {
    console.log('Loading feed purchase data');
    
    try {
        // Load feed transactions from storage (bypass cache for fresh report data, same as animals)
        const transactionsStr = await StorageManager.getItem('feedTransactions', { bypassCache: true });
        let transactions = [];
        
        try {
            if (transactionsStr) {
                if (typeof transactionsStr === 'string') {
                    transactions = JSON.parse(transactionsStr);
                } else if (Array.isArray(transactionsStr)) {
                    transactions = transactionsStr;
                } else if (typeof transactionsStr === 'object') {
                    // If it's a single transaction object
                    transactions = [transactionsStr];
                }
            }
        } catch (parseError) {
            console.warn('Error parsing feed transactions:', parseError);
        }
        
        if (!Array.isArray(transactions)) {
            console.warn('Transactions data is not an array, converting:', transactions);
            transactions = transactions ? [transactions] : [];
        }
        
        console.log(`Found ${transactions.length} feed transactions in storage`);
        
        // Filter by date range; use end of day for endDate so same-day transactions are included (same as animals)
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        const dateFiltered = transactions.filter(transaction => {
            if (!transaction || !transaction.date) return false;
            const transactionDate = new Date(transaction.date);
            return transactionDate >= start && transactionDate <= end;
        });
        
        // Filter by type (purchase only)
        const purchaseFiltered = dateFiltered.filter(t => t && t.type === 'purchase');
        
        // Filter by animal category if specified and not "all"
        const categoryFiltered = category === 'all' ? 
            purchaseFiltered : 
            purchaseFiltered.filter(t => {
                const animalCategory = t.animalCategory || t.animalGroup || t.animalType || t.usedFor || t.category;
                return animalCategory && animalCategory.toLowerCase() === category.toLowerCase();
            });
        
        console.log(`Found ${categoryFiltered.length} feed purchase transactions after filtering`);
        return categoryFiltered;
    } catch (error) {
        console.error('Error loading feed purchase data:', error);
        throw new Error(`Failed to load feed purchase data: ${error.message}`);
    }
}

/**
 * Load feed usage data
 * @param {Date} startDate - Start date for filtering
 * @param {Date} endDate - End date for filtering
 * @param {string} category - Feed category filter
 * @returns {Promise<Array>} Array of feed usage transactions
 */
async function loadFeedUsageData(startDate, endDate, category) {
    console.log('Loading feed usage data');
    
    try {
        // Load feed transactions from storage (bypass cache for fresh report data, same as animals)
        const transactionsStr = await StorageManager.getItem('feedTransactions', { bypassCache: true });
        let transactions = [];
        
        try {
            if (transactionsStr) {
                if (typeof transactionsStr === 'string') {
                    transactions = JSON.parse(transactionsStr);
                } else if (Array.isArray(transactionsStr)) {
                    transactions = transactionsStr;
                } else if (typeof transactionsStr === 'object') {
                    // If it's a single transaction object
                    transactions = [transactionsStr];
                }
            }
        } catch (parseError) {
            console.warn('Error parsing feed transactions:', parseError);
        }
        
        if (!Array.isArray(transactions)) {
            console.warn('Transactions data is not an array, converting:', transactions);
            transactions = transactions ? [transactions] : [];
        }
        
        console.log(`Found ${transactions.length} feed transactions in storage`);
        
        // Filter by date range; use end of day for endDate so same-day transactions are included (same as animals)
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        const dateFiltered = transactions.filter(transaction => {
            if (!transaction || !transaction.date) return false;
            const transactionDate = new Date(transaction.date);
            return transactionDate >= start && transactionDate <= end;
        });
        
        // Filter by type (usage only)
        const usageFiltered = dateFiltered.filter(t => t && t.type === 'usage');
        
        // Filter by animal category if specified and not "all"
        const categoryFiltered = category === 'all' ? 
            usageFiltered : 
            usageFiltered.filter(t => {
                const animalCategory = t.animalCategory || t.animalGroup || t.animalType || t.usedFor || t.category;
                return animalCategory && animalCategory.toLowerCase() === category.toLowerCase();
            });
        
        console.log(`Found ${categoryFiltered.length} feed usage transactions after filtering`);
        return categoryFiltered;
    } catch (error) {
        console.error('Error loading feed usage data:', error);
        throw new Error(`Failed to load feed usage data: ${error.message}`);
    }
}

/**
 * Load feed calculation data
 * @param {Date} startDate - Start date for filtering
 * @param {Date} endDate - End date for filtering
 * @param {string} category - Category filter
 * @returns {Promise<Array>} Array of feed calculations
 */
async function loadFeedCalculationData(startDate, endDate, category) {
    console.log('Loading feed calculation data');
    
    try {
        // Get feed calculations from storage (use StorageManager, bypass cache - same as animals)
        const feedCalculationsStr = await StorageManager.getItem('feedCalculations', { bypassCache: true });
        console.log('[DEBUG] Raw feed calculations from storage:', feedCalculationsStr);
        
        let feedCalculations = [];
        if (feedCalculationsStr) {
            try {
                const parsed = typeof feedCalculationsStr === 'string' ? JSON.parse(feedCalculationsStr) : feedCalculationsStr;
                feedCalculations = Array.isArray(parsed) ? parsed : [];
                console.log('[DEBUG] Parsed feed calculations:', feedCalculations.length);
                if (!Array.isArray(feedCalculations)) {
                    feedCalculations = [];
                }
            } catch (error) {
                console.error('Error parsing feed calculations:', error);
                feedCalculations = [];
            }
        } else {
            console.log('No feed calculations found in storage, using empty array');
        }
        
        // Filter by date range if provided; end of day for endDate (same as animals)
        let dateFiltered = feedCalculations;
        if (startDate && endDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            dateFiltered = feedCalculations.filter(calc => {
                const calcDate = new Date(calc.date);
                return calcDate >= start && calcDate <= end;
            });
        }
        console.log(`Found ${dateFiltered.length} feed calculations after date filtering`);
        
        // Filter by animal category if provided
        let categoryFiltered = dateFiltered;
        if (category && category !== 'all') {
            categoryFiltered = dateFiltered.filter(calc => {
                const animalCategory = calc.animalCategory || calc.category;
                return animalCategory && animalCategory.toLowerCase() === category.toLowerCase();
            });
        }
        console.log(`Found ${categoryFiltered.length} feed calculations after category filtering`);
        
        return { calculations: categoryFiltered, dateRange: startDate && endDate ? { start: startDate, end: endDate } : null };
    } catch (error) {
        console.error('Error loading feed calculation data:', error);
        throw new Error(`Failed to load feed calculation data: ${error.message}`);
    }
}

// Report generation functions
/**
 * Create main feed report table that shows all feed-related data
 * @param {Object} data - Object containing all feed data
 * @returns {string} HTML for the report
 */
function createFeedReportTable(data) {
    console.log('Creating feed report table with data:', data);
    
    // Check if data is empty
    if (!data || !data.hasData) {
        return createStandardReportStructure(
            REPORT_TYPES.FEED.ALL,
            'Feed Report',
            '',
            `<div class="empty-state">
                <h3>No Feed Data Available</h3>
                <p>There are no feed records in the system for the selected criteria.</p>
                <p>Try adding some feed transactions first, or adjust your filters.</p>
            </div>`,
            { message: 'No feed data found.' },
            false
        );
    }

    // Calculate summary statistics
    const purchaseCount = data.purchases.length;
    const usageCount = data.usage.length;
    const totalPurchaseCost = data.purchases.reduce((sum, t) => {
        const cost = t.totalPrice || t.cost || t.totalCost || 0;
        return sum + parseFloat(cost);
    }, 0);

    // Create inventory summary
    let inventoryHTML = `
        <div class="report-section">
            <h3>Current Stock Levels</h3>
            <table class="report-table inventory-table">
                <thead>
                    <tr>
                        <th>Feed Type</th>
                        <th>Quantity</th>
                        <th>Unit</th>
                        <th>Last Updated</th>
                    </tr>
                </thead>
                <tbody>
    `;

    Object.entries(data.currentStock).forEach(([feedType, stock]) => {
        inventoryHTML += `
            <tr>
                <td>${feedType}</td>
                <td>${stock.quantity.toFixed(2)}</td>
                <td>${stock.unit}</td>
                <td>${formatDate(stock.lastUpdated)}</td>
            </tr>
        `;
    });

    inventoryHTML += `
                </tbody>
            </table>
        </div>
    `;

    // Create transactions table
    let transactionsHTML = `
        <div class="report-section">
            <h3>Recent Transactions</h3>
            <table class="report-table transactions-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Feed</th>
                        <th>Quantity</th>
                        <th>Unit</th>
                        <th>Price/Cost</th>
                        <th>Notes</th>
                    </tr>
                </thead>
                <tbody>
    `;

    // Combine and sort transactions
    const allTransactions = [
        ...data.purchases.map(t => ({...t, type: 'purchase'})),
        ...data.usage.map(t => ({...t, type: 'usage'}))
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    allTransactions.forEach(transaction => {
        const date = formatDate(transaction.date);
        const type = transaction.type === 'purchase' ? 'Purchase' : 'Usage';
        const feedType = transaction.feedType || 'Unknown';
        const quantity = transaction.quantity || '0';
        const unit = transaction.unit || '';
        
        let costDisplay = '';
        if (transaction.type === 'purchase') {
            const cost = transaction.totalPrice || transaction.cost || transaction.totalCost || 0;
            costDisplay = formatCurrency(cost);
        } else {
            const cost = transaction.totalCost || transaction.estimatedCost || 0;
            costDisplay = formatCurrency(cost);
        }
        
        const notes = transaction.notes || '';

        transactionsHTML += `
            <tr class="${transaction.type}-row">
                <td>${date}</td>
                <td>${type}</td>
                <td>${feedType}</td>
                <td>${quantity}</td>
                <td>${unit}</td>
                <td>${costDisplay}</td>
                <td>${notes}</td>
            </tr>
        `;
    });

    transactionsHTML += `
                </tbody>
            </table>
        </div>
    `;

    // Return complete report
    return createStandardReportStructure(
        REPORT_TYPES.FEED.ALL,
        'Feed Report',
        data.dateRange,
        inventoryHTML + transactionsHTML,
        {
            summary: [
                `Current stock types: ${Object.keys(data.currentStock).length}`,
                `Total transactions: ${allTransactions.length}`,
                `Purchases: ${purchaseCount} (${formatCurrency(totalPurchaseCost)})`,
                `Usage records: ${usageCount}`
            ]
        },
        false
    );
}

/**
 * Create feed purchase report table
 * @param {Array} data - Array of feed purchase transactions
 * @returns {string} HTML for the report
 */
function createFeedPurchaseTable(data) {
    if (!data || data.length === 0) {
        return createStandardReportStructure(
            'Feed Purchase Report',
            'No Data Available',
            '',
            `<div class="empty-state">
                <h3>No Feed Purchase Data Available</h3>
                <p>There are no feed purchase records in the system for the selected date range.</p>
                <p>Try adding some feed purchase records first, or select a different date range.</p>
            </div>`,
            { summary: ['No feed purchase data found.'] },
            false,
            'feed-purchase'
        );
    }

    // Calculate totals for summary
    let totalQuantity = 0;
    let totalCost = 0;
    const supplierStats = {};
    const feedTypeStats = {};
    
    // Sort data by date (newest first)
    const sortedData = [...data].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Process data for summary stats
    sortedData.forEach(item => {
        const quantity = parseFloat(item.quantity) || 0;
        const cost = parseFloat(item.totalPrice || item.cost || item.totalCost || 0);
        
        totalQuantity += quantity;
        totalCost += cost;
        
        // Track by supplier
        const supplier = item.supplier || 'Unknown supplier';
        if (!supplierStats[supplier]) {
            supplierStats[supplier] = {
                count: 0,
                totalQuantity: 0,
                totalCost: 0
            };
        }
        supplierStats[supplier].count++;
        supplierStats[supplier].totalQuantity += quantity;
        supplierStats[supplier].totalCost += cost;
        
        // Track by feed type
        const feedType = item.feedType || 'Unknown';
        if (!feedTypeStats[feedType]) {
            feedTypeStats[feedType] = {
                count: 0,
                totalQuantity: 0,
                totalCost: 0
            };
        }
        feedTypeStats[feedType].count++;
        feedTypeStats[feedType].totalQuantity += quantity;
        feedTypeStats[feedType].totalCost += cost;
    });
    
    // Calculate average price per unit
    const avgPrice = totalQuantity > 0 ? totalCost / totalQuantity : 0;

    // Create transactions table
    let transactionsHTML = `
        <div class="report-section">
            <h3>Purchase Transactions</h3>
            <table class="report-table" id="feed-purchase-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Feed Type</th>
                        <th>Quantity</th>
                        <th>Unit</th>
                        <th>Price per Unit</th>
                        <th>Total Cost</th>
                        <th>Supplier</th>
                        <th>Notes</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    sortedData.forEach(item => {
        const date = formatDate(item.date);
        const feedType = item.feedType || 'Unknown';
        const quantity = parseFloat(item.quantity) || 0;
        const unit = item.unit || '';
        const totalCost = parseFloat(item.totalPrice || item.cost || item.totalCost || 0);
        const pricePerUnit = quantity > 0 ? totalCost / quantity : 0;
        const supplier = item.supplier || 'Unknown supplier';
        const notes = item.notes || '';
        
        transactionsHTML += `
            <tr>
                <td>${date}</td>
                <td>${feedType}</td>
                <td>${quantity.toFixed(2)}</td>
                <td>${unit}</td>
                <td>${formatCurrency(pricePerUnit)}</td>
                <td>${formatCurrency(totalCost)}</td>
                <td>${supplier}</td>
                <td>${notes}</td>
            </tr>
        `;
    });
    
    transactionsHTML += `
                </tbody>
            </table>
        </div>
    `;

    // Create feed type summary table
    let summaryHTML = `
        <div class="report-section">
            <h3>Purchase Summary by Feed Type</h3>
            <table class="report-table summary-table">
                <thead>
                    <tr>
                        <th>Feed Type</th>
                        <th>Purchases</th>
                        <th>Total Quantity</th>
                        <th>Total Cost</th>
                        <th>Avg. Price/Unit</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    // Sort feed types by total cost (highest first)
    const sortedFeedTypes = Object.entries(feedTypeStats)
        .sort((a, b) => b[1].totalCost - a[1].totalCost);
    
    sortedFeedTypes.forEach(([feedType, stats]) => {
        const avgPrice = stats.totalQuantity > 0 ? stats.totalCost / stats.totalQuantity : 0;
        
        summaryHTML += `
            <tr>
                <td>${feedType}</td>
                <td>${stats.count}</td>
                <td>${stats.totalQuantity.toFixed(2)}</td>
                <td>${formatCurrency(stats.totalCost)}</td>
                <td>${formatCurrency(avgPrice)}</td>
            </tr>
        `;
    });
    
    summaryHTML += `
                </tbody>
            </table>
        </div>
    `;

    // Return complete report
    return createStandardReportStructure(
        'Feed Purchase Report',
        'Record of Feed Purchases',
        null,
        transactionsHTML + summaryHTML,
        {
            summary: [
                `Total purchases: ${data.length}`,
                `Total quantity: ${totalQuantity.toFixed(2)} units`,
                `Total cost: ${formatCurrency(totalCost)}`,
                `Average price per unit: ${formatCurrency(avgPrice)}`,
                `Number of suppliers: ${Object.keys(supplierStats).length}`,
                `Feed types purchased: ${Object.keys(feedTypeStats).length}`
            ]
        },
        false,
        'feed-purchase'
    );
}

/**
 * Create feed inventory report table
 * @param {Object} data - Object containing feed inventory and transactions
 * @returns {string} HTML for the report
 */
function createFeedInventoryTable(data) {
    if (!data || !data.feedInventory || data.feedInventory.length === 0) {
        return createStandardReportStructure(
            REPORT_TYPES.FEED.INVENTORY,
            'Feed Inventory Report',
            '',
            `<div class="empty-state">
                <h3>No Feed Inventory Data Available</h3>
                <p>There are no feed inventory records in the system for the selected date range.</p>
                <p>Try adding some feed inventory records first, or select a different date range.</p>
            </div>`,
            { message: 'No feed inventory data found.' },
            false
        );
    }

    // Calculate total inventory value
    const totalValue = data.feedInventory.reduce((sum, item) => {
        const quantity = parseFloat(item.quantity) || 0;
        const pricePerUnit = parseFloat(item.pricePerUnit) || parseFloat(item.price) || 0;
        return sum + (quantity * pricePerUnit);
    }, 0);

    // Sort inventory by feed type
    const sortedInventory = [...data.feedInventory].sort((a, b) => {
        return (a.feedType || 'Unknown').localeCompare(b.feedType || 'Unknown');
    });

    // Create inventory table (single heading "Feed Inventory Report" is in report header)
    let inventoryHTML = `
        <div class="report-section">
            <table class="report-table" id="feed-inventory-table">
                <thead>
                    <tr>
                        <th>Feed Type</th>
                        <th>Quantity</th>
                        <th>Unit</th>
                        <th>Price per Unit</th>
                        <th>Total Value</th>
                        <th>Expiry Date</th>
                        <th>Location</th>
                        <th>Notes</th>
                    </tr>
                </thead>
                <tbody>
    `;

    sortedInventory.forEach(item => {
        const quantity = parseFloat(item.quantity) || 0;
        const pricePerUnit = parseFloat(item.pricePerUnit) || parseFloat(item.price) || 0;
        const totalValue = quantity * pricePerUnit;
        
        inventoryHTML += `
            <tr>
                <td>${item.feedType || 'Unknown'}</td>
                <td>${quantity.toFixed(2)}</td>
                <td>${item.unit || '-'}</td>
                <td>${formatCurrency(pricePerUnit)}</td>
                <td>${formatCurrency(totalValue)}</td>
                <td>${item.expiryDate ? formatDate(item.expiryDate) : 'N/A'}</td>
                <td>${item.location || 'Not specified'}</td>
                <td>${item.notes || '-'}</td>
            </tr>
        `;
    });

    inventoryHTML += `
                </tbody>
            </table>
        </div>
    `;

    // Add transactions section if available
    let transactionsHTML = '';
    if (data.feedTransactions && data.feedTransactions.length > 0) {
        const sortedTransactions = [...data.feedTransactions]
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        transactionsHTML = `
            <div class="report-section">
                <h3>Recent Feed Transactions</h3>
                <table class="report-table" id="feed-transactions-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Feed Type</th>
                            <th>Quantity</th>
                            <th>Unit</th>
                            <th>Price/Cost</th>
                            <th>Notes</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        sortedTransactions.forEach(transaction => {
            const date = formatDate(transaction.date);
            const type = transaction.type === 'purchase' ? 'Purchase' : 'Usage';
            const feedType = transaction.feedType || 'Unknown';
            const quantity = transaction.quantity || '0';
            const unit = transaction.unit || '';
            
            let costDisplay = '';
            if (transaction.type === 'purchase') {
                const cost = transaction.totalPrice || transaction.cost || transaction.totalCost || 0;
                costDisplay = formatCurrency(cost);
            } else {
                const cost = transaction.totalCost || transaction.estimatedCost || 0;
                costDisplay = formatCurrency(cost);
            }
            
            const notes = transaction.notes || '';

            transactionsHTML += `
                <tr class="${transaction.type}-row">
                    <td>${date}</td>
                    <td>${type}</td>
                    <td>${feedType}</td>
                    <td>${quantity}</td>
                    <td>${unit}</td>
                    <td>${costDisplay}</td>
                    <td>${notes}</td>
                </tr>
            `;
        });

        transactionsHTML += `
                    </tbody>
                </table>
            </div>
        `;
    }

    // Return complete report
    return createStandardReportStructure(
        REPORT_TYPES.FEED.INVENTORY,
        'Feed Inventory Report',
        null,
        inventoryHTML + transactionsHTML,
        {
            summary: [
                `Total feed items: ${data.feedInventory.length}`,
                `Total inventory value: ${formatCurrency(totalValue)}`,
                `Recent transactions: ${data.feedTransactions ? data.feedTransactions.length : 0}`
            ]
        },
        false
    );
}

/**
 * Create feed usage report table
 * @param {Array} data - Array of feed usage transactions
 * @returns {string} HTML for the report
 */
function createFeedUsageTable(data) {
    if (!data || data.length === 0) {
        return createStandardReportStructure(
            'Feed Usage Report',
            'No Data Available',
            '',
            `<div class="empty-state">
                <h3>No Feed Usage Data Available</h3>
                <p>There are no feed usage records in the system for the selected date range.</p>
                <p>Try adding some feed usage records first, or select a different date range.</p>
            </div>`,
            { summary: ['No feed usage data found.'] },
            false,
            'feed-usage'
        );
    }

    // Calculate totals for summary
    let totalQuantity = 0;
    let totalCost = 0;
    const animalGroupStats = {};
    const feedTypeStats = {};

    // Sort data by date (newest first)
    const sortedData = [...data].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Process data for summary stats
    sortedData.forEach(item => {
        const quantity = parseFloat(item.quantity) || 0;
        const cost = parseFloat(item.totalCost || item.estimatedCost || 0);
        
        totalQuantity += quantity;
        totalCost += cost;
        
        // Track by animal group/type
        const animalGroup = item.animalCategory || item.animalGroup || item.animalType || item.usedFor || 'General use';
        if (!animalGroupStats[animalGroup]) {
            animalGroupStats[animalGroup] = {
                count: 0,
                totalQuantity: 0,
                totalCost: 0
            };
        }
        animalGroupStats[animalGroup].count++;
        animalGroupStats[animalGroup].totalQuantity += quantity;
        animalGroupStats[animalGroup].totalCost += cost;
        
        // Track by feed type
        const feedType = item.feedType || 'Unknown';
        if (!feedTypeStats[feedType]) {
            feedTypeStats[feedType] = {
                count: 0,
                totalQuantity: 0,
                totalCost: 0
            };
        }
        feedTypeStats[feedType].count++;
        feedTypeStats[feedType].totalQuantity += quantity;
        feedTypeStats[feedType].totalCost += cost;
    });

    // Create transactions table
    let transactionsHTML = `
        <div class="report-section">
            <h3>Usage Transactions</h3>
            <table class="report-table" id="feed-usage-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Feed Type</th>
                        <th>Quantity</th>
                        <th>Unit</th>
                        <th>Used For</th>
                        <th>Cost</th>
                        <th>Notes</th>
                    </tr>
                </thead>
                <tbody>
    `;

    sortedData.forEach(item => {
        const date = formatDate(item.date);
        const feedType = item.feedType || 'Unknown';
        const quantity = parseFloat(item.quantity) || 0;
        const unit = item.unit || '';
        const usedFor = item.animalCategory || item.animalGroup || item.animalType || item.usedFor || 'General use';
        const cost = parseFloat(item.totalCost || item.estimatedCost || 0);
        const notes = item.notes || '';
        
        transactionsHTML += `
            <tr>
                <td>${date}</td>
                <td>${feedType}</td>
                <td>${quantity.toFixed(2)}</td>
                <td>${unit}</td>
                <td>${usedFor}</td>
                <td>${formatCurrency(cost)}</td>
                <td>${notes}</td>
            </tr>
        `;
    });

    transactionsHTML += `
                </tbody>
            </table>
        </div>
    `;

    // Create feed type summary
    let feedTypeSummaryHTML = `
        <div class="report-section">
            <h3>Usage Summary by Feed Type</h3>
            <table class="report-table summary-table">
                <thead>
                    <tr>
                        <th>Feed Type</th>
                        <th>Usage Records</th>
                        <th>Total Quantity</th>
                        <th>Total Cost</th>
                        <th>% of Total Usage</th>
                    </tr>
                </thead>
                <tbody>
    `;

    // Sort feed types by total quantity (highest first)
    const sortedFeedTypes = Object.entries(feedTypeStats)
        .sort((a, b) => b[1].totalQuantity - a[1].totalQuantity);

    sortedFeedTypes.forEach(([feedType, stats]) => {
        const percentageOfTotal = totalQuantity > 0 ? 
            ((stats.totalQuantity / totalQuantity) * 100).toFixed(1) : '0.0';
        
        feedTypeSummaryHTML += `
            <tr>
                <td>${feedType}</td>
                <td>${stats.count}</td>
                <td>${stats.totalQuantity.toFixed(2)}</td>
                <td>${formatCurrency(stats.totalCost)}</td>
                <td>${percentageOfTotal}%</td>
            </tr>
        `;
    });

    feedTypeSummaryHTML += `
                </tbody>
            </table>
        </div>
    `;

    // Create animal group summary
    let animalGroupSummaryHTML = `
        <div class="report-section">
            <h3>Usage Summary by Animal Group</h3>
            <table class="report-table summary-table">
                <thead>
                    <tr>
                        <th>Animal Group</th>
                        <th>Usage Records</th>
                        <th>Total Quantity</th>
                        <th>Total Cost</th>
                        <th>% of Total Cost</th>
                    </tr>
                </thead>
                <tbody>
    `;

    // Sort animal groups by total cost (highest first)
    const sortedAnimalGroups = Object.entries(animalGroupStats)
        .sort((a, b) => b[1].totalCost - a[1].totalCost);

    sortedAnimalGroups.forEach(([group, stats]) => {
        const percentageOfTotal = totalCost > 0 ? 
            ((stats.totalCost / totalCost) * 100).toFixed(1) : '0.0';
        
        animalGroupSummaryHTML += `
            <tr>
                <td>${group}</td>
                <td>${stats.count}</td>
                <td>${stats.totalQuantity.toFixed(2)}</td>
                <td>${formatCurrency(stats.totalCost)}</td>
                <td>${percentageOfTotal}%</td>
            </tr>
        `;
    });

    animalGroupSummaryHTML += `
                </tbody>
            </table>
        </div>
    `;

    // Return complete report
    return createStandardReportStructure(
        'Feed Usage Report',
        'Record of Feed Usage',
        null,
        transactionsHTML + feedTypeSummaryHTML + animalGroupSummaryHTML,
        {
            summary: [
                `Total usage records: ${data.length}`,
                `Total quantity used: ${totalQuantity.toFixed(2)} units`,
                `Total cost: ${formatCurrency(totalCost)}`,
                `Feed types used: ${Object.keys(feedTypeStats).length}`,
                `Animal groups: ${Object.keys(animalGroupStats).length}`
            ]
        },
        false,
        'feed-usage'
    );
}

/**
 * Create feed calculation report table
 * @param {Array|Object} feedCalculationsOrData - Array of feed calculations, or { calculations, dateRange }
 * @param {Object} filters - Report filters including date range (optional)
 * @returns {string} HTML for the report
 */
function createFeedCalculationTable(feedCalculationsOrData, filters) {
    const feedCalculations = Array.isArray(feedCalculationsOrData)
        ? feedCalculationsOrData
        : (feedCalculationsOrData && feedCalculationsOrData.calculations) || [];
    const dateRange = (filters && filters.dateRange) || (feedCalculationsOrData && feedCalculationsOrData.dateRange);
    if (!feedCalculations || feedCalculations.length === 0) {
        return createStandardReportStructure(
            'Feed Calculations Report',
            'No Data Available',
            '',
            `<div class="empty-state">
                <h3>No Feed Calculations Available</h3>
                <p>There are no feed calculations in the system for the selected criteria.</p>
                <p>Try adding some feed calculations first, or adjust your filters.</p>
            </div>`,
            { summary: ['No feed calculations found.'] },
            false,
            'feed-calculation'
        );
    }

    // Create the main content
    let tableHTML = `
        <div class="report-section">
            <h3>Feed Calculations</h3>
    `;
    
    // Generate calculation cards
    feedCalculations.forEach(calc => {
        // Map properties safely with fallbacks
        const animalType = calc.animalCategory || calc.category || 'Unknown';
        const count = calc.animalCount || calc.numAnimals || 0;
        const feedType = calc.feedType || 'Unknown';
        const dailyIntake = typeof calc.dailyIntake === 'number' ? calc.dailyIntake : 0;
        const intakeUnit = calc.intakeUnit || 'g';
        const totalFeed = calc.totalFeedNeeded || calc.totalFeed || 0;
        const duration = calc.duration || 1;
        const dailyCost = calc.totalDailyCost || calc.dailyCost || 0;
        const costPerAnimal = calc.costPerAnimalPerDay || calc.costPerAnimal || 
            (count > 0 ? dailyCost / count : 0);
        const totalCost = calc.totalCost || 0;
        
        // Format total feed display - convert to kg if the unit is grams
        const totalFeedDisplay = intakeUnit === 'g' ? 
            `${(totalFeed).toFixed(2)} kg` : 
            `${totalFeed.toFixed(2)} ${intakeUnit}`;
        
        tableHTML += `
            <div class="calculation-card feed-calculation-card">
                <div class="card-header">
                    <h4>${animalType} (${count} animals)</h4>
                    <div class="calculation-date">${formatDate(calc.date)}</div>
                </div>
                <div class="card-body">
                    <div class="feed-details">
                        <p><strong>Feed:</strong> ${feedType}</p>
                        <p><strong>Daily intake:</strong> ${dailyIntake.toFixed(2)}${intakeUnit} per animal</p>
                        <p><strong>Total feed:</strong> ${totalFeedDisplay} (${duration} days)</p>
                    </div>
                    <div class="cost-details">
                        <p><strong>Daily cost:</strong> ${formatCurrency(dailyCost)}</p>
                        <p><strong>Per animal:</strong> ${formatCurrency(costPerAnimal)}/day</p>
                        <p><strong>Total (${duration} days):</strong> ${formatCurrency(totalCost)}</p>
                    </div>
                </div>
            </div>
        `;
    });
    
    // Add summary table
    tableHTML += `
        <h3>Summary Table</h3>
        <table class="report-table">
            <thead>
                <tr>
                    <th>Animal Type</th>
                    <th>Count</th>
                    <th>Feed Type</th>
                    <th>Daily Intake</th>
                    <th>Total Feed</th>
                    <th>Duration</th>
                    <th>Daily Cost</th>
                    <th>Cost per Animal</th>
                    <th>Total Cost</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    feedCalculations.forEach(calc => {
        // Use the same property mapping for consistency
        const animalType = calc.animalCategory || calc.category || 'Unknown';
        const count = calc.animalCount || calc.numAnimals || 0;
        const feedType = calc.feedType || 'Unknown';
        const dailyIntake = typeof calc.dailyIntake === 'number' ? calc.dailyIntake : 0;
        const intakeUnit = calc.intakeUnit || 'g';
        const totalFeed = calc.totalFeedNeeded || calc.totalFeed || 0;
        const duration = calc.duration || 1;
        const dailyCost = calc.totalDailyCost || calc.dailyCost || 0;
        const costPerAnimal = calc.costPerAnimalPerDay || calc.costPerAnimal || 
            (count > 0 ? dailyCost / count : 0);
        const totalCost = calc.totalCost || 0;
        
        // Format total feed display
        const totalFeedDisplay = intakeUnit === 'g' ? 
            `${(totalFeed).toFixed(2)} kg` : 
            `${totalFeed.toFixed(2)} ${intakeUnit}`;
        
        tableHTML += `
            <tr>
                <td>${animalType}</td>
                <td>${count}</td>
                <td>${feedType}</td>
                <td>${dailyIntake.toFixed(2)}${intakeUnit}</td>
                <td>${totalFeedDisplay}</td>
                <td>${duration} days</td>
                <td>${formatCurrency(dailyCost)}</td>
                <td>${formatCurrency(costPerAnimal)}/day</td>
                <td>${formatCurrency(totalCost)}</td>
            </tr>
        `;
    });
    
    // Add totals row
    const totalCost = feedCalculations.reduce((sum, calc) => sum + (calc.totalCost || 0), 0);
    tableHTML += `
            <tr class="total-row">
                <td colspan="8" class="text-right"><strong>Total Cost:</strong></td>
                <td>${formatCurrency(totalCost)}</td>
            </tr>
        </tbody>
        </table>
        
        <div class="report-notes">
            <h4>Notes:</h4>
            <ul>
                <li>Feed calculations are based on standard nutritional requirements for each animal type.</li>
                <li>Costs are calculated using current feed prices stored in the system.</li>
                <li>Actual consumption may vary based on animal health, weather conditions, and other factors.</li>
            </ul>
        </div>
    </div>
    `;

    // Return complete report
    return createStandardReportStructure(
        'Feed Calculations Report',
        'Feed Requirements and Cost Analysis',
        dateRange || '',
        tableHTML,
        {
            summary: [
                `Total calculations: ${feedCalculations.length}`,
                `Total cost: ${formatCurrency(totalCost)}`,
                `Animal types: ${new Set(feedCalculations.map(c => c.animalCategory || c.category)).size}`,
                `Feed types: ${new Set(feedCalculations.map(c => c.feedType)).size}`
            ]
        },
        false,
        'feed-calculation'
    );
}

/**
 * Get feed categories from feed inventory
 * @returns {Promise<Array<string>>} Array of feed categories
 */
async function getFeedCategories() {
    console.log('Loading feed categories from inventory');
    
    try {
        // Use StorageManager (same as animals), bypass cache for fresh list
        const feedInventoryStr = await StorageManager.getItem('feedInventory', { bypassCache: true });
        console.log('Getting feed categories from inventory:', !!feedInventoryStr);
        
        if (feedInventoryStr) {
            try {
                const inventoryEntries = typeof feedInventoryStr === 'string' ? JSON.parse(feedInventoryStr) : feedInventoryStr;
                if (Array.isArray(inventoryEntries)) {
                    // Extract unique category names from inventory (entries are [key, value] from Map)
                    const categories = [...new Set(inventoryEntries.map(entry => entry && entry[0]))].filter(Boolean);
                    console.log('Loaded categories from inventory:', categories);
                    return categories;
                } else if (typeof inventoryEntries === 'object') {
                    const categories = Object.keys(inventoryEntries);
                    console.log('Loaded categories from inventory object:', categories);
                    return categories;
                }
            } catch (parseError) {
                console.error('Error parsing feed inventory:', parseError);
            }
        }
        
        // Return empty array if no categories found (same as animals - no throw)
        console.log('No feed categories found in inventory');
        return [];
    } catch (error) {
        console.error('Error loading feed categories:', error);
        return [];
    }
}

/**
 * Get animal categories from feed usage and animal inventory
 * @returns {Promise<Array<string>>} Array of animal categories
 */
async function getAnimalCategories() {
    console.log('Loading animal categories');
    
    try {
        const categories = new Set();
        
        // Get categories from feed usage by animal
        const feedUsageStr = await mobileStorage.getItem('feedUsageByAnimal');
        console.log('Getting animal categories from feed usage:', feedUsageStr);
        
        if (feedUsageStr) {
            try {
                const usageData = JSON.parse(feedUsageStr);
                if (Array.isArray(usageData)) {
                    // Extract categories from array format
                    usageData.forEach(([category]) => {
                        if (category && typeof category === 'string') {
                            categories.add(category);
                        }
                    });
                } else if (typeof usageData === 'object') {
                    // Extract categories from object format
                    Object.keys(usageData).forEach(category => {
                        if (category && typeof category === 'string') {
                            categories.add(category);
                        }
                    });
                }
            } catch (parseError) {
                console.error('Error parsing feed usage data:', parseError);
            }
        }
        
        // Get categories from animal inventory
        const animalInventoryStr = await mobileStorage.getItem('animalInventory');
        console.log('Getting animal categories from inventory:', animalInventoryStr);
        
        if (animalInventoryStr) {
            try {
                const inventoryData = JSON.parse(animalInventoryStr);
                if (Array.isArray(inventoryData)) {
                    // Extract categories from array format
                    inventoryData.forEach(animal => {
                        if (animal && animal.category && typeof animal.category === 'string') {
                            categories.add(animal.category);
                        }
                    });
                } else if (typeof inventoryData === 'object') {
                    // Extract categories from object format
                    Object.values(inventoryData).forEach(animal => {
                        if (animal && animal.category && typeof animal.category === 'string') {
                            categories.add(animal.category);
                        }
                    });
                }
            } catch (parseError) {
                console.error('Error parsing animal inventory data:', parseError);
            }
        }
        
        // Convert Set to Array and sort
        const categoryArray = Array.from(categories).sort();
        console.log('Loaded animal categories:', categoryArray);
        
        return categoryArray;
    } catch (error) {
        console.error('Error loading animal categories:', error);
        return [];
    }
}

/**
 * Create combined feed report table showing all feed-related data
 * @param {Object} data - Object containing all feed data
 * @returns {string} HTML for the report
 */
function createAllFeedReportTable(data) {
    console.log('Creating all feed report table with data:', data);
    
    // Check if data is empty
    if (!data || !data.hasData) {
        return createStandardReportStructure(
            REPORT_TYPES.FEED.ALL,
            'All Feed Report',
            '',
            `<div class="empty-state">
                <h3>No Feed Data Available</h3>
                <p>There are no feed records in the system for the selected criteria.</p>
                <p>Try adding some feed records first, or adjust your filters.</p>
            </div>`,
            { message: 'No feed data found.' },
            false
        );
    }

    // Create summary cards
    let summaryHTML = `
        <div class="report-section summary-cards">
            <div class="summary-card">
                <h4>Inventory Summary</h4>
                <p>Total Feed Types: ${Object.keys(data.currentStock).length}</p>
                <p>Total Stock Value: ${formatCurrency(calculateTotalStockValue(data.currentStock))}</p>
            </div>
            <div class="summary-card">
                <h4>Purchase Summary</h4>
                <p>Total Purchases: ${data.purchases.length}</p>
                <p>Total Cost: ${formatCurrency(calculateTotalPurchases(data.purchases))}</p>
            </div>
            <div class="summary-card">
                <h4>Usage Summary</h4>
                <p>Usage Records: ${data.usage.length}</p>
                <p>Total Used: ${formatCurrency(calculateTotalUsage(data.usage))}</p>
            </div>
        </div>
    `;

    // Create inventory overview
    let inventoryHTML = `
        <div class="report-section">
            <h3>Current Inventory</h3>
            <table class="report-table inventory-table">
                <thead>
                    <tr>
                        <th>Feed Type</th>
                        <th>Quantity</th>
                        <th>Unit</th>
                        <th>Last Updated</th>
                    </tr>
                </thead>
                <tbody>
    `;

    Object.entries(data.currentStock).forEach(([feedType, stock]) => {
        inventoryHTML += `
            <tr>
                <td>${feedType}</td>
                <td>${stock.quantity.toFixed(2)}</td>
                <td>${stock.unit}</td>
                <td>${formatDate(stock.lastUpdated)}</td>
            </tr>
        `;
    });

    inventoryHTML += `
                </tbody>
            </table>
        </div>
    `;

    // Create recent transactions table
    let transactionsHTML = `
        <div class="report-section">
            <h3>Recent Transactions</h3>
            <table class="report-table transactions-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Feed</th>
                        <th>Quantity</th>
                        <th>Unit</th>
                        <th>Amount</th>
                        <th>Notes</th>
                    </tr>
                </thead>
                <tbody>
    `;

    // Combine and sort transactions
    const allTransactions = [
        ...data.purchases.map(t => ({...t, type: 'Purchase'})),
        ...data.usage.map(t => ({...t, type: 'Usage'}))
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Show only the 10 most recent transactions
    allTransactions.slice(0, 10).forEach(transaction => {
        transactionsHTML += `
            <tr class="${transaction.type.toLowerCase()}-row">
                <td>${formatDate(transaction.date)}</td>
                <td>${transaction.type}</td>
                <td>${transaction.feedType || 'Unknown'}</td>
                <td>${transaction.quantity || '0'}</td>
                <td>${transaction.unit || ''}</td>
                <td>${formatCurrency(transaction.totalPrice || transaction.totalCost || 0)}</td>
                <td>${transaction.notes || ''}</td>
            </tr>
        `;
    });

    transactionsHTML += `
                </tbody>
            </table>
        </div>
    `;

    // Return complete report
    return createStandardReportStructure(
        REPORT_TYPES.FEED.ALL,
        'All Feed Report',
        data.dateRange,
        summaryHTML + inventoryHTML + transactionsHTML,
        {
            summary: [
                `Feed Types: ${Object.keys(data.currentStock).length}`,
                `Total Transactions: ${allTransactions.length}`,
                `Recent Transactions: ${Math.min(allTransactions.length, 10)}`,
                `Date Range: ${formatDateRange(data.dateRange.start, data.dateRange.end)}`
            ]
        },
        false
    );
}

// Helper functions for createAllFeedReportTable
function calculateTotalStockValue(stock) {
    return Object.values(stock).reduce((total, item) => {
        const quantity = parseFloat(item.quantity) || 0;
        // Try pricePerUnit first, then price, then 0
        const pricePerUnit = parseFloat(item.pricePerUnit) || parseFloat(item.price) || 0;
        return total + (quantity * pricePerUnit);
    }, 0);
}

function calculateTotalPurchases(purchases) {
    return purchases.reduce((total, purchase) => {
        return total + (purchase.totalPrice || purchase.cost || 0);
    }, 0);
}

function calculateTotalUsage(usage) {
    return usage.reduce((total, record) => {
        return total + (record.totalCost || record.estimatedCost || 0);
    }, 0);
}

// Event Handlers
function handleFeedReportTypeChange(event) {
    console.log('Feed report type changed:', event.target.value);
    selectedReportType = event.target.value;
    
    // Update category filter visibility and help text
    const categoryFilter = document.getElementById('category-filter');
    const categoryHelp = document.getElementById('category-help');
    
    if (categoryFilter && categoryHelp) {
        categoryFilter.style.display = 'block';
        categoryHelp.textContent = 'Filter by feed type';
        
        // Update categories based on report type
        updateFeedCategories();
    }
}

async function updateFeedCategories() {
    console.log('Updating feed categories');
    
    try {
        const categories = await getFeedCategories();
        const categorySelect = document.getElementById('category-select');
        
        if (categorySelect) {
            // Clear existing options
            categorySelect.innerHTML = '<option value="all">All Categories</option>';
            
            // Add categories
            categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = category;
                categorySelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error updating feed categories:', error);
    }
}

/**
 * Handle feed category change
 * @param {Event} event - Change event
 */
async function handleFeedCategoryChange(event) {
    try {
        const category = event.target.value;
        console.log('Feed category changed:', category);
        
        // Update selected category
        selectedFeedCategory = category;
        
        // Trigger report generation
        const generateReportBtn = document.getElementById('generate-report');
        if (generateReportBtn) {
            generateReportBtn.click();
        }
    } catch (error) {
        console.error('Error handling feed category change:', error);
    }
}
// Export functions for module usage
export {
    loadFeedData,
    loadFeedPurchaseData,
    loadFeedUsageData,
    loadFeedCalculationData,
    createFeedReportTable,
    createFeedPurchaseTable,
    createFeedInventoryTable,
    createFeedUsageTable,
    createFeedCalculationTable,
    createAllFeedReportTable,
    getFeedCategories,
    handleFeedReportTypeChange,
    handleFeedCategoryChange
};
