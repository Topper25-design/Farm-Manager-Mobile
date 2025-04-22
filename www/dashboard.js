// Global variables to hold data
let animalInventory = {};
let feedInventory = {};
let recentActivities = [];
let animalSales = [];
let animalPurchases = [];
let userCurrency = 'R';
let userCurrencyCode = 'ZAR';

// Initialize mobile storage adapter
const mobileStorage = window.storageApi || {
    async getItem(key) {
        return localStorage.getItem(key);
    },
    async setItem(key, value) {
        localStorage.setItem(key, value);
    },
    async removeItem(key) {
        localStorage.removeItem(key);
    }
};

// Add a cache for synchronous operations
mobileStorage._cache = {};

// Helper for synchronous operations
mobileStorage.getItemSync = function(key) {
    // Try to get from cache first
    if (this._cache && this._cache[key]) return this._cache[key];
    
    // Fall back to localStorage
    if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(key);
    }
    
    return null;
};

// Override the original getItem to update cache
const originalGetItem = mobileStorage.getItem;
mobileStorage.getItem = async function(key) {
    // Always fetch fresh data directly from storage
    const value = await originalGetItem.call(this, key);
    // Update cache
    if (!this._cache) this._cache = {};
    this._cache[key] = value;
    return value;
};

// Document ready function
document.addEventListener('DOMContentLoaded', async function() {
    // Check if user is logged in
    const userSession = await mobileStorage.getItem('userSession');
    if (!userSession) {
        window.location.href = 'index.html';
        return;
    }
    
    try {
        // Initialize currency preference
        const currencyPref = await mobileStorage.getItem('userCurrency');
        if (currencyPref) {
            const currencyData = JSON.parse(currencyPref);
            userCurrency = currencyData.symbol || 'R';
            userCurrencyCode = currencyData.code || 'ZAR';
        }
        
        // Load data from storage
        await loadData();
        
        // Update all dashboard sections
        updateAllDashboardSections();
        
        // Set up event listeners
        setupEventListeners();
        
    } catch (error) {
        console.error('Error initializing dashboard:', error);
    }
});

// Load all data from storage
async function loadData() {
    try {
        // Load animal inventory
        const animalInventoryStr = await mobileStorage.getItem('animalInventory');
        if (animalInventoryStr) {
            animalInventory = JSON.parse(animalInventoryStr);
        }
        
        // Load feed inventory
        const feedInventoryStr = await mobileStorage.getItem('feedInventory');
        if (feedInventoryStr) {
            feedInventory = JSON.parse(feedInventoryStr);
        }
        
        // Load recent activities
        const activitiesStr = await mobileStorage.getItem('recentActivities');
        if (activitiesStr) {
            recentActivities = JSON.parse(activitiesStr);
        }
        
        // Load animal sales
        const salesStr = await mobileStorage.getItem('animalSales');
        if (salesStr) {
            animalSales = JSON.parse(salesStr);
        }
        
        // Load animal purchases
        const purchasesStr = await mobileStorage.getItem('animalPurchases');
        if (purchasesStr) {
            animalPurchases = JSON.parse(purchasesStr);
        } else {
            // Try to extract purchases from recentActivities as fallback
            animalPurchases = recentActivities.filter(activity => 
                activity.type === 'buy' && activity.price
            );
        }
        
        console.log('Data loaded successfully:', {
            animalInventory,
            feedInventory,
            recentActivities,
            animalSales,
            animalPurchases
        });
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

// Update all dashboard sections
function updateAllDashboardSections() {
    updateTotalAnimals();
    updateStockDiscrepancies();
    updateTotalSales();
    updateTotalPurchases();
    updateFeedStatus();
    updateFeedCalculations();
    updateRecentActivities();
    updateHealthRecords();
}

// Set up event listeners
function setupEventListeners() {
    // Logout button
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            await mobileStorage.removeItem('userSession');
            window.location.href = 'index.html';
        });
    }
    
    // Currency selector
    const currencySelect = document.getElementById('currency-select');
    if (currencySelect) {
        // Populate currency options
        populateCurrencyOptions(currencySelect);
        
        // Handle currency change
        currencySelect.addEventListener('change', async () => {
            const selectedValue = currencySelect.value;
            const [symbol, code] = selectedValue.split('|');
            
            userCurrency = symbol;
            userCurrencyCode = code;
            
            // Save preference
            await mobileStorage.setItem('userCurrency', JSON.stringify({
                symbol: userCurrency,
                code: userCurrencyCode
            }));
            
            // Update displays that use currency
            updateTotalSales();
            updateTotalPurchases();
        });
    }
}

// Populate currency options
function populateCurrencyOptions(selectElement) {
    const currencies = [
        { symbol: 'R', code: 'ZAR', name: 'South African Rand' },
        { symbol: '$', code: 'USD', name: 'US Dollar' },
        { symbol: '€', code: 'EUR', name: 'Euro' },
        { symbol: '£', code: 'GBP', name: 'British Pound' },
        { symbol: '¥', code: 'JPY', name: 'Japanese Yen' },
    ];
    
    // Clear existing options
    selectElement.innerHTML = '';
    
    // Add options
    currencies.forEach(currency => {
        const option = document.createElement('option');
        option.value = `${currency.symbol}|${currency.code}`;
        option.textContent = `${currency.symbol} ${currency.code}`;
        option.selected = (currency.code === userCurrencyCode);
        selectElement.appendChild(option);
    });
}

// Format currency amount
function formatCurrency(amount) {
    return `${userCurrency}${amount.toFixed(2)} ${userCurrencyCode}`;
}

// Update total animals section
function updateTotalAnimals() {
    const totalAnimalsElem = document.getElementById('total-animals');
    const inventoryBreakdownElem = document.getElementById('inventory-breakdown');
    
    if (!totalAnimalsElem || !inventoryBreakdownElem) return;
    
    // Calculate total animals
    let totalCount = 0;
    const inventoryItems = [];
    
    Object.entries(animalInventory).forEach(([category, data]) => {
        let categoryCount = 0;
        
        // Handle new inventory format
        if (typeof data === 'object' && data.total !== undefined) {
            categoryCount = data.total;
        } 
        // Handle old format (direct number)
        else if (typeof data === 'number') {
            categoryCount = data;
        }
        
        totalCount += categoryCount;
        
        inventoryItems.push({
            category,
            count: categoryCount
        });
    });
    
    // Update total count
    totalAnimalsElem.textContent = totalCount;
    
    // Update inventory breakdown
    if (inventoryItems.length === 0) {
        inventoryBreakdownElem.innerHTML = '<p class="no-data">No animals in inventory</p>';
        return;
    }
    
    let breakdownHTML = '<ul class="inventory-list">';
    inventoryItems.forEach(item => {
        breakdownHTML += `<li><span class="category">${item.category}:</span> <span class="count">${item.count}</span></li>`;
    });
    breakdownHTML += '</ul>';
    
    inventoryBreakdownElem.innerHTML = breakdownHTML;
}

// Update stock discrepancies section
function updateStockDiscrepancies() {
    const discrepanciesElem = document.getElementById('stock-discrepancies');
    if (!discrepanciesElem) return;
    
    // Find discrepancy activities
    const discrepancies = recentActivities.filter(activity => 
        activity.type === 'stock-count' && 
        activity.expected !== undefined && 
        activity.actual !== undefined &&
        activity.expected !== activity.actual
    );
    
    if (discrepancies.length === 0) {
        discrepanciesElem.innerHTML = '<p class="no-data">No stock count discrepancies</p>';
        return;
    }
    
    let discrepanciesHTML = '<ul class="discrepancies-list">';
    
    // Get the 3 most recent discrepancies
    discrepancies.slice(0, 3).forEach(discrepancy => {
        const date = new Date(discrepancy.timestamp || discrepancy.date).toLocaleDateString();
        const diff = discrepancy.actual - discrepancy.expected;
        const diffClass = diff < 0 ? 'negative' : 'positive';
        
        discrepanciesHTML += `
            <li>
                <div class="disc-header">
                    <span class="disc-category">${discrepancy.category}</span>
                    <span class="disc-date">${date}</span>
                </div>
                <div class="disc-details">
                    <span class="disc-expected">Expected: ${discrepancy.expected}</span>
                    <span class="disc-actual">Actual: ${discrepancy.actual}</span>
                    <span class="disc-difference ${diffClass}">Diff: ${diff > 0 ? '+' : ''}${diff}</span>
                </div>
            </li>
        `;
    });
    
    discrepanciesHTML += '</ul>';
    
    if (discrepancies.length > 3) {
        discrepanciesHTML += `<p class="more-link">+${discrepancies.length - 3} more discrepancies</p>`;
    }
    
    discrepanciesElem.innerHTML = discrepanciesHTML;
}

// Update total sales section
function updateTotalSales() {
    const totalSalesElem = document.getElementById('total-sales-display');
    const averagePriceElem = document.querySelector('.average-price');
    const lastSaleInfoElem = document.getElementById('last-sale-info');
    
    if (!totalSalesElem) return;
    
    // First try to use animalSales array
    let salesTransactions = animalSales.length > 0 ? animalSales : [];
    
    // If no dedicated sales array, extract from recentActivities
    if (salesTransactions.length === 0) {
        salesTransactions = recentActivities.filter(activity => 
            (activity.type === 'sell' || activity.type === 'sale') && activity.price
        );
    }
    
    if (salesTransactions.length === 0) {
        totalSalesElem.textContent = formatCurrency(0);
        averagePriceElem.textContent = `Average: ${formatCurrency(0)} per animal`;
        
        if (lastSaleInfoElem) {
            lastSaleInfoElem.innerHTML = `
                <p class="transaction-label">Last Sale:</p>
                <p class="transaction-details">No recent sales</p>
            `;
        }
        return;
    }
    
    // Calculate total sales
    let totalSales = 0;
    let totalAnimals = 0;
    
    salesTransactions.forEach(transaction => {
        // Get price - handle different possible formats
        let price = 0;
        if (typeof transaction.price === 'number') {
            price = transaction.price;
        } else if (typeof transaction.price === 'string') {
            // Try to parse price string
            price = parseFloat(transaction.price.replace(/[^0-9.-]+/g, '')) || 0;
        }
        
        // Get quantity
        const quantity = transaction.quantity || transaction.count || 1;
        
        totalSales += price;
        totalAnimals += quantity;
    });
    
    // Calculate average price per animal
    const averagePrice = totalAnimals > 0 ? totalSales / totalAnimals : 0;
    
    // Update elements
    totalSalesElem.textContent = formatCurrency(totalSales);
    averagePriceElem.textContent = `Average: ${formatCurrency(averagePrice)} per animal`;
    
    // Update last sale info if element exists
    if (lastSaleInfoElem) {
        const lastSale = salesTransactions[0]; // Most recent sale
        const date = new Date(lastSale.timestamp || lastSale.date).toLocaleDateString();
        const buyer = lastSale.buyer || 'Not specified';
        const price = typeof lastSale.price === 'number' ? 
            formatCurrency(lastSale.price) : 
            lastSale.price || formatCurrency(0);
        
        lastSaleInfoElem.innerHTML = `
            <p class="transaction-label">Last Sale:</p>
            <p class="transaction-details">
                ${date} <br>
                ${lastSale.quantity || lastSale.count || 1} ${lastSale.category || 'animals'} <br>
                Buyer: ${buyer} <br>
                Price: ${price}
            </p>
        `;
    }
}

// Update total purchases section
function updateTotalPurchases() {
    const totalPurchasesElem = document.getElementById('total-purchases-display');
    const averagePriceElem = document.querySelector('.average-purchase-price');
    const lastPurchaseInfoElem = document.getElementById('last-purchase-info');
    
    if (!totalPurchasesElem) return;
    
    // First try to use animalPurchases array
    let purchaseTransactions = animalPurchases.length > 0 ? animalPurchases : [];
    
    // If no dedicated purchases array, extract from recentActivities
    if (purchaseTransactions.length === 0) {
        purchaseTransactions = recentActivities.filter(activity => 
            activity.type === 'buy' && activity.price
        );
    }
    
    if (purchaseTransactions.length === 0) {
        totalPurchasesElem.textContent = formatCurrency(0);
        averagePriceElem.textContent = `Average: ${formatCurrency(0)} per animal`;
        
        if (lastPurchaseInfoElem) {
            lastPurchaseInfoElem.innerHTML = `
                <p class="transaction-label">Last Purchase:</p>
                <p class="transaction-details">No recent purchases</p>
            `;
        }
        return;
    }
    
    // Calculate total purchases
    let totalPurchases = 0;
    let totalAnimals = 0;
    
    purchaseTransactions.forEach(transaction => {
        // Get price - handle different possible formats
        let price = 0;
        if (typeof transaction.price === 'number') {
            price = transaction.price;
        } else if (typeof transaction.price === 'string') {
            // Try to parse price string
            price = parseFloat(transaction.price.replace(/[^0-9.-]+/g, '')) || 0;
        }
        
        // Get quantity
        const quantity = transaction.quantity || transaction.count || 1;
        
        totalPurchases += price;
        totalAnimals += quantity;
    });
    
    // Calculate average price per animal
    const averagePrice = totalAnimals > 0 ? totalPurchases / totalAnimals : 0;
    
    // Update elements
    totalPurchasesElem.textContent = formatCurrency(totalPurchases);
    averagePriceElem.textContent = `Average: ${formatCurrency(averagePrice)} per animal`;
    
    // Update last purchase info if element exists
    if (lastPurchaseInfoElem) {
        const lastPurchase = purchaseTransactions[0]; // Most recent purchase
        const date = new Date(lastPurchase.timestamp || lastPurchase.date).toLocaleDateString();
        const supplier = lastPurchase.supplier || 'Not specified';
        const price = typeof lastPurchase.price === 'number' ? 
            formatCurrency(lastPurchase.price) : 
            lastPurchase.price || formatCurrency(0);
        
        lastPurchaseInfoElem.innerHTML = `
            <p class="transaction-label">Last Purchase:</p>
            <p class="transaction-details">
                ${date} <br>
                ${lastPurchase.quantity || lastPurchase.count || 1} ${lastPurchase.category || 'animals'} <br>
                Supplier: ${supplier} <br>
                Price: ${price}
            </p>
        `;
    }
}

function updateFeedStatus() {
    const feedStatusElem = document.getElementById('feed-status');
    if (!feedStatusElem) return;
    
    // Convert feedInventory from string map if needed
    let feedInventoryData;
    if (typeof feedInventory === 'string') {
        try {
            feedInventoryData = JSON.parse(feedInventory);
        } catch (e) {
            console.error('Error parsing feed inventory:', e);
            feedInventoryData = {};
        }
    } else if (feedInventory instanceof Map) {
        feedInventoryData = Object.fromEntries(feedInventory);
    } else if (typeof feedInventory === 'object') {
        feedInventoryData = feedInventory;
    } else {
        feedInventoryData = {};
    }
    
    if (Object.keys(feedInventoryData).length === 0) {
        feedStatusElem.innerHTML = '<p class="no-data">No feed in inventory</p>';
        return;
    }
    
    // Create a DIV container with flexbox layout to center items
    let content = `
        <div style="
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 15px;
            width: 100%;
            padding: 0;
            margin: 0 auto;
        ">
    `;
    
    Object.entries(feedInventoryData).forEach(([feedType, data]) => {
        // Default values if needed
        const quantity = data.quantity || 0;
        const unit = data.unit || 'kg';
        const threshold = data.threshold || 0;
        
        // Determine feed status
        const isLow = quantity <= threshold;
        const statusColor = isLow ? "#e74c3c" : "#2ecc71";
        const quantityColor = isLow ? "#e74c3c" : "#2ecc71";
        
        // Format last update text
        const lastUpdated = data.lastUpdated 
            ? `Last updated: ${new Date(data.lastUpdated).toLocaleDateString()}`
            : 'Never updated';
            
        // Format supplier text
        const supplier = data.supplier 
            ? `Supplier: ${data.supplier}`
            : 'No supplier specified';
        
        // Create each feed item with inline styles for consistency
        content += `
            <div style="
                background-color: #f8f9fa;
                border-radius: 8px;
                border-left: 4px solid ${statusColor};
                padding: 15px;
                width: 280px;
                max-width: 280px;
                margin: 0;
                display: flex;
                flex-direction: column;
                box-sizing: border-box;
            ">
                <div style="
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 10px;
                ">
                    <span style="
                        font-weight: bold;
                        color: #2c3e50;
                    ">${feedType}</span>
                    <span style="
                        font-weight: bold;
                        color: ${quantityColor};
                    ">${quantity} ${unit}</span>
                </div>
                <div style="
                    font-size: 0.9rem;
                    color: #7f8c8d;
                    line-height: 1.5;
                ">
                    Threshold: ${threshold} ${unit}<br>
                    ${supplier}<br>
                    ${lastUpdated}
                </div>
            </div>
        `;
    });
    
    content += '</div>';
    feedStatusElem.innerHTML = content;
    
    // Force re-render to fix layout issues
    const parentCard = feedStatusElem.closest('.stat-card');
    if (parentCard) {
        // Add a tiny delay to ensure DOM has updated
        setTimeout(() => {
            // Force a reflow
            parentCard.style.display = 'none';
            void parentCard.offsetHeight; // This line forces a reflow
            parentCard.style.display = '';
        }, 50);
    }
}

// Update feed calculations section
function updateFeedCalculations() {
    const feedCalcElem = document.getElementById('feed-calculations');
    if (!feedCalcElem) return;
    
    // For now, just display a placeholder
    feedCalcElem.innerHTML = '<p class="no-data">No feed calculations available</p>';
}

// Update recent activities section
function updateRecentActivities() {
    const activitiesListElem = document.getElementById('activities-list');
    if (!activitiesListElem) return;
    
    if (recentActivities.length === 0) {
        activitiesListElem.innerHTML = '<p class="no-data">No recent activities</p>';
        return;
    }
    
    let activitiesHTML = '<ul class="activities-list">';
    
    // Display the 5 most recent activities
    recentActivities.slice(0, 5).forEach(activity => {
        const date = new Date(activity.timestamp || activity.date).toLocaleDateString();
        const type = activity.type || 'unknown';
        const description = activity.description || getActivityDescription(activity);
        
        activitiesHTML += `
            <li>
                <div class="activity-header">
                    <span class="activity-type">${capitalizeFirstLetter(type)}</span>
                    <span class="activity-date">${date}</span>
                </div>
                <p class="activity-description">${description}</p>
            </li>
        `;
    });
    
    activitiesHTML += '</ul>';
    
    if (recentActivities.length > 5) {
        activitiesHTML += `<p class="more-link">+${recentActivities.length - 5} more activities</p>`;
    }
    
    activitiesListElem.innerHTML = activitiesHTML;
}

// Get activity description when none is provided
function getActivityDescription(activity) {
    const type = activity.type || '';
    
    switch (type) {
        case 'add':
            return `Added ${activity.quantity || 1} ${activity.category || 'animals'}`;
        case 'buy':
            return `Purchased ${activity.quantity || 1} ${activity.category || 'animals'}`;
        case 'sell':
            return `Sold ${activity.quantity || 1} ${activity.category || 'animals'}`;
        case 'move':
            return `Moved ${activity.quantity || 1} ${activity.category || 'animals'}`;
        case 'death':
            return `Recorded death of ${activity.quantity || 1} ${activity.category || 'animals'}`;
        case 'birth':
            return `Recorded birth of ${activity.quantity || 1} ${activity.category || 'animals'}`;
        case 'stock-count':
            return `Stock count for ${activity.category || 'animals'}`;
        default:
            return `${capitalizeFirstLetter(type)} activity`;
    }
}

// Update health records section
function updateHealthRecords() {
    const healthStatusElem = document.getElementById('health-status');
    if (!healthStatusElem) return;
    
    // For now, just display a placeholder
    healthStatusElem.innerHTML = '<p class="no-data">No health records available</p>';
}

// Helper: Capitalize first letter of a string
function capitalizeFirstLetter(string) {
    if (!string) return '';
    return string.charAt(0).toUpperCase() + string.slice(1);
} 