/**
 * reports.animals.js
 * Animal-related reporting functions for Farm Manager Mobile
 */

import { 
    StorageManager,
    DateManager,
    CurrencyManager,
    formatDate, 
    formatCurrency, 
    printReport, 
    exportReportToCSV, 
    createStandardReportStructure 
} from './utils.js';

// Report type constants
const REPORT_TYPES = {
    ANIMAL: {
        ALL: 'all-animal',
        INVENTORY: 'animal-inventory',
        MOVEMENT: 'animal-movement',
        PURCHASE: 'animal-purchase',
        SALE: 'animal-sale',
        DEATH: 'animal-death',
        BIRTH: 'animal-birth',
        COUNT: 'animal-count',
        DISCREPANCY: 'animal-discrepancy'
    }
};

// Initialize event handlers and global access
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log('Initializing animal report functionality');
        
        // Make all animal data loading functions globally accessible
        window.loadAnimalData = loadAnimalData;
        window.getAnimalCategories = getAnimalCategories;
        window.loadAnimalInventoryData = loadAnimalInventoryData;
        window.loadAnimalMovementData = loadAnimalMovementData;
        window.loadAnimalPurchaseData = loadAnimalPurchaseData;
        window.loadAnimalSaleData = loadAnimalSaleData;
        window.loadAnimalBirthData = loadAnimalBirthData;
        window.loadAnimalDeathData = loadAnimalDeathData;
        window.loadAnimalCountData = loadAnimalCountData;
        window.loadAnimalDiscrepancyData = loadAnimalDiscrepancyData;
        window.createAnimalReportTable = createAnimalReportTable;
        window.createAnimalInventoryTable = createAnimalInventoryTable;
        window.createAnimalDiscrepancyTable = createAnimalDiscrepancyTable;
        
        // Store original function references for consistency
        window.originalLoadAnimalData = loadAnimalData;
        window.originalGetAnimalCategories = getAnimalCategories;
        window.originalLoadAnimalInventoryData = loadAnimalInventoryData;
        window.originalLoadAnimalMovementData = loadAnimalMovementData;
        window.originalLoadAnimalPurchaseData = loadAnimalPurchaseData;
        window.originalLoadAnimalSaleData = loadAnimalSaleData;
        window.originalLoadAnimalBirthData = loadAnimalBirthData;
        window.originalLoadAnimalDeathData = loadAnimalDeathData;
        window.originalLoadAnimalCountData = loadAnimalCountData;
        window.originalLoadAnimalDiscrepancyData = loadAnimalDiscrepancyData;
        window.originalCreateAnimalDiscrepancyTable = createAnimalDiscrepancyTable;
        
        console.log('Animal report initialization complete');
    } catch (error) {
        console.error('Error initializing animal reports:', error);
    }
});

/**
 * Load animal data from storage
 * @param {string} category - Animal category to filter by (optional)
 * @param {Date|string} startDate - Start date for filtering (optional)
 * @param {Date|string} endDate - End date for filtering (optional)
 * @returns {Promise<Object>} Object containing inventory and transactions data
 */
async function loadAnimalData(category, startDate, endDate) {
    try {
    console.log('Loading animal data for report:', { category, startDate, endDate });
    
        // Bypass cache so report always sees latest data from storage (same as Animals page)
        const cacheOpt = { bypassCache: true };
        const inventoryData = await StorageManager.getItem('animalInventory', cacheOpt);
        const inventory = typeof inventoryData === 'string' ? JSON.parse(inventoryData) : inventoryData || {};
        console.log('Parsed animal inventory:', inventory);

        const activitiesData = await StorageManager.getItem('recentActivities', cacheOpt);
        const activities = typeof activitiesData === 'string' ? JSON.parse(activitiesData) : activitiesData || [];
        console.log('Found', activities.length, 'total activities in recentActivities');

        // Filter out feed-related activities (animal reports should only show animal activities)
        const feedActivityTypes = ['feed-purchase', 'feed-usage', 'feed-category-added'];
        const animalActivities = activities.filter(activity => {
            if (!activity || !activity.type) return false;
            const activityType = (activity.type || '').toString().toLowerCase();
            // Exclude feed activities - only include animal activities
            // Valid animal types: add, buy, purchase, sell, sale, move, death, birth, stock-count, count, resolution, reversal
            const isFeedActivity = feedActivityTypes.includes(activityType) || activityType.startsWith('feed-');
            return !isFeedActivity;
        });
        console.log('Found', animalActivities.length, 'animal-related transactions after filtering out feed activities (from', activities.length, 'total)');

        // Filter activities by date range; use end of day for end date so same-day activities are included
        let filteredActivities = animalActivities;
        if (startDate && endDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            filteredActivities = animalActivities.filter(activity => {
                const activityDate = new Date(activity.date || activity.timestamp);
                return activityDate >= start && activityDate <= end;
            });
        }

        // Filter by category if specified (exact match, case-sensitive, trimmed)
        if (category && category !== 'all') {
            const categoryTrimmed = category.trim();
            filteredActivities = filteredActivities.filter(activity => {
                // Handle different transaction types
                switch (activity.type) {
                    case 'move':
                        // For moves, only match on fromCategory since that's what's displayed in the Category column
                        // This prevents showing moves where the destination matches but source doesn't
                        const fromCat = (activity.fromCategory || '').toString().trim();
                        return fromCat === categoryTrimmed;
                    case 'stock-count':
                    case 'count':
                        const countCat = (activity.category || '').toString().trim();
                        return countCat === categoryTrimmed;
                    default:
                        const defaultCat = (activity.category || '').toString().trim();
                        return defaultCat === categoryTrimmed;
                }
            });
        }

        // Normalize count-like types to 'stock-count' for consistency (match stock-count, count, stockcount, etc.)
        filteredActivities = filteredActivities.map(activity => {
            const t = (activity.type || '').toString().toLowerCase().replace(/[\s_-]/g, '');
            if (t === 'count' || t === 'stockcount') {
                return { ...activity, type: 'stock-count' };
            }
            return activity;
        });

        // Convert inventory object to array format
        let inventoryArray = Object.entries(inventory).map(([cat, data]) => {
            if (typeof data === 'number') {
                // Simple number format
                return {
                    category: cat,
                    count: data,
                    location: 'Default'
                };
            } else if (typeof data === 'object') {
                // Location-based format
                return Object.entries(data).map(([location, count]) => ({
                    category: cat,
                    location,
                    count
                }));
            }
            return null;
        }).flat().filter(Boolean);
        
        // Filter inventory by category if specified (exact match, case-sensitive, trimmed)
        if (category && category !== 'all') {
            const categoryTrimmed = category.trim();
            inventoryArray = inventoryArray.filter(item => {
                const itemCategory = (item.category || '').toString().trim();
                return itemCategory === categoryTrimmed;
            });
        }
        
        return {
            inventory: inventoryArray,
            transactions: filteredActivities,
            hasData: filteredActivities.length > 0,
            dateRange: startDate && endDate ? { start: startDate, end: endDate } : null
        };
        
    } catch (error) {
        console.error('Error loading animal data:', error);
        throw error;
    }
}

/**
 * Get animal categories from storage
 * @returns {Promise<Array<string>>} Array of animal categories
 */
async function getAnimalCategories() {
    console.log('Loading animal categories');
    
    try {
        const categoriesSet = new Set();
        
        // 1. Get categories from canonical list (animalCategories)
        const categoriesStr = await StorageManager.getItem('animalCategories', { bypassCache: true });
        if (categoriesStr) {
            try {
                let parsed = categoriesStr;
                if (typeof categoriesStr === 'string') {
                    if (categoriesStr.startsWith('[')) {
                        parsed = JSON.parse(categoriesStr);
                    } else if (categoriesStr.includes(',')) {
                        parsed = categoriesStr.split(',').map(c => c.trim());
                    } else {
                        parsed = [categoriesStr.trim()];
                    }
                }
                if (Array.isArray(parsed)) {
                    parsed.forEach(c => { 
                        if (c && typeof c === 'string' && c.trim()) {
                            categoriesSet.add(c.trim()); 
                        }
                    });
                }
            } catch (parseError) {
                console.error('Error parsing animalCategories:', parseError);
            }
        }

        // 2. Add categories from animal inventory
        const inventoryStr = await StorageManager.getItem('animalInventory', { bypassCache: true });
        if (inventoryStr) {
            try {
                let inventory = inventoryStr;
                if (typeof inventoryStr === 'string') {
                    if (inventoryStr.startsWith('[') || inventoryStr.startsWith('{')) {
                        inventory = JSON.parse(inventoryStr);
                    } else {
                        inventory = { [inventoryStr]: true };
                    }
                }
                if (inventory && typeof inventory === 'object') {
                    Object.keys(inventory).forEach(c => { 
                        if (c && typeof c === 'string' && c.trim()) {
                            categoriesSet.add(c.trim()); 
                        }
                    });
                }
            } catch (error) {
                console.error('Error getting categories from inventory:', error);
            }
        }

        // 3. Add categories from feed usage by animal
        const feedUsageStr = await StorageManager.getItem('feedUsageByAnimal', { bypassCache: true });
        if (feedUsageStr) {
            try {
                const usageEntries = typeof feedUsageStr === 'string' ? JSON.parse(feedUsageStr) : feedUsageStr;
                if (Array.isArray(usageEntries)) {
                    usageEntries.forEach(entry => { 
                        if (entry && entry[0]) {
                            const cat = String(entry[0]).trim();
                            if (cat) categoriesSet.add(cat);
                        }
                    });
                } else if (typeof usageEntries === 'object' && usageEntries !== null) {
                    Object.keys(usageEntries).forEach(c => { 
                        if (c && typeof c === 'string' && c.trim()) {
                            categoriesSet.add(c.trim()); 
                        }
                    });
                }
            } catch (parseError) {
                console.error('Error parsing feed usage:', parseError);
            }
        }

        // 4. Add categories from health records
        const healthRecordsStr = await StorageManager.getItem('healthRecords', { bypassCache: true });
        if (healthRecordsStr) {
            try {
                const healthRecords = Array.isArray(healthRecordsStr) ? healthRecordsStr : 
                                    (typeof healthRecordsStr === 'string' ? JSON.parse(healthRecordsStr) : []);
                if (Array.isArray(healthRecords)) {
                    healthRecords.forEach(record => {
                        const category = record.category || record.animalCategory || record.animalType;
                        if (category && typeof category === 'string' && category.trim()) {
                            categoriesSet.add(category.trim());
                        }
                    });
                }
            } catch (parseError) {
                console.error('Error parsing health records:', parseError);
            }
        }

        // 5. Add categories from animal transactions (purchases, sales, etc.)
        const transactionsStr = await StorageManager.getItem('animalTransactions', { bypassCache: true });
        if (transactionsStr) {
            try {
                const transactions = Array.isArray(transactionsStr) ? transactionsStr : 
                                   (typeof transactionsStr === 'string' ? JSON.parse(transactionsStr) : []);
                if (Array.isArray(transactions)) {
                    transactions.forEach(transaction => {
                        const category = transaction.category || transaction.fromCategory || transaction.toCategory;
                        if (category && typeof category === 'string' && category.trim()) {
                            categoriesSet.add(category.trim());
                        }
                    });
                }
            } catch (parseError) {
                console.error('Error parsing animal transactions:', parseError);
            }
        }

        // Convert Set to sorted array
        const categories = Array.from(categoriesSet)
            .filter(category => typeof category === 'string' && category.trim().length > 0)
            .sort();

        console.log('Loaded categories from all sources:', categories);
        return categories.length > 0 ? categories : [];
    } catch (error) {
        console.error('Error in getAnimalCategories:', error);
        return [];
    }
}

/**
 * Load animal inventory data with optional filtering
 * @param {string} category - Animal category to filter by (optional)
 * @param {string} location - Location to filter by (optional)
 * @returns {Promise<Array>} Array of inventory items
 */
async function loadAnimalInventoryData(category = null, location = null) {
    console.log('Loading animal inventory data:', { category, location });
    
    try {
        // Load inventory from storage
        const inventoryStr = await StorageManager.getItem('animalInventory');
        let inventory = [];
        
        if (inventoryStr) {
            try {
                const parsedInventory = JSON.parse(inventoryStr);
                console.log('Parsed animal inventory:', parsedInventory);
                
                // Convert object-based inventory to array format if needed
                if (typeof parsedInventory === 'object' && !Array.isArray(parsedInventory)) {
                    // Create inventory items based on the new format with locations
                    Object.entries(parsedInventory).forEach(([animalType, data]) => {
                        if (typeof data === 'number') {
                            // Old format without locations - use a single entry
                            inventory.push({
                                type: animalType,
                                category: animalType,
                                location: 'Not specified',
                                count: parseInt(data) || 0
                            });
                        } else if (typeof data === 'object') {
                            // New format with locations
                            Object.entries(data).forEach(([location, count]) => {
                                inventory.push({
                                    type: animalType,
                                    category: animalType,
                                    location: location,
                                    count: parseInt(count) || 0
                                });
                            });
                        }
                    });
                } else if (Array.isArray(parsedInventory)) {
                    // Already in array format
                    inventory = parsedInventory.map(item => ({
                        ...item,
                        count: parseInt(item.count) || 0
                    }));
                }
            } catch (parseError) {
                console.error('Error parsing animal inventory:', parseError);
            }
        }
        
        return inventory;
        
    } catch (error) {
        console.error('Error loading animal inventory:', error);
        return [];
    }
}

/**
 * Load animal movement data
 * @param {string} category - Animal category to filter by
 * @param {Date|string} startDate - Start date for filtering
 * @param {Date|string} endDate - End date for filtering
 * @returns {Promise<Object>} Animal movement data with enhanced movement details
 */
async function loadAnimalMovementData(category, startDate, endDate) {
    console.log('Loading animal movement data:', { category, startDate, endDate });
    
    try {
        // Use the base animal data loading function
        const animalData = await loadAnimalData(category, startDate, endDate);
        
        console.log(`Total transactions before filtering for movement: ${animalData.transactions.length}`);
        
        // Filter transactions to only include movement-related types
        const movementTransactions = animalData.transactions.filter(t => {
            // Flexible matching for move transactions
            const isMove = t.type === 'move';
            
            // Enhanced movement transaction logging
            if (isMove) {
                console.log('Found move transaction:', {
                    date: t.date,
                    fromCategory: t.fromCategory,
                    toCategory: t.toCategory,
                    fromLocation: t.fromLocation,
                    toLocation: t.toLocation,
                    quantity: t.quantity
                });
            }
            
            return isMove;
        }).map(t => ({
            ...t,
            // Ensure consistent property names
            category: t.fromCategory || t.category,
            fromCategory: t.fromCategory || t.category,
            toCategory: t.toCategory || t.category,
            fromLocation: t.fromLocation || 'Not specified',
            toLocation: t.toLocation || 'Not specified',
            quantity: t.quantity || t.count || 0,
            date: t.date || t.timestamp,
            notes: t.notes || t.description || ''
        }));
        
        console.log(`Found ${movementTransactions.length} movement transactions`);
        
        // Sort transactions by date (newest first)
        movementTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        return {
            inventory: animalData.inventory,
            transactions: movementTransactions,
            summary: {
                totalMoves: movementTransactions.length,
                dateRange: {
                    start: startDate,
                    end: endDate
                }
            }
        };
    } catch (error) {
        console.error('Error loading animal movement data:', error);
        return {
            inventory: [],
            transactions: [],
            summary: {
                totalMoves: 0,
                dateRange: {
                    start: startDate,
                    end: endDate
                }
            }
        };
    }
}

/**
 * Load animal purchase data
 * @param {string} category - Animal category to filter by
 * @param {Date|string} startDate - Start date for filtering
 * @param {Date|string} endDate - End date for filtering
 * @returns {Promise<Object>} Animal purchase data with enhanced purchase details
 */
async function loadAnimalPurchaseData(category, startDate, endDate) {
    console.log('Loading animal purchase data:', { category, startDate, endDate });
    
    try {
        // Use the base animal data loading function
        const animalData = await loadAnimalData(category, startDate, endDate);
        
        console.log(`Total transactions before filtering for purchases: ${animalData.transactions.length}`);
        
        // Filter and enhance purchase transactions
        const purchaseTransactions = animalData.transactions.filter(t => {
            // Check for buy or purchase type
            const isBuy = t.type === 'buy' || t.type === 'purchase';
            
            // Enhanced purchase transaction logging
            if (isBuy) {
                console.log('Found purchase transaction:', {
                    date: t.date,
                    category: t.category,
                    quantity: t.quantity,
                    supplier: t.supplier,
                    price: t.price,
                    location: t.location
                });
            }
            
            return isBuy;
        }).map(t => ({
            ...t,
            // Ensure consistent property names and types
            category: t.category || 'Unknown',
            quantity: t.quantity || t.count || 0,
            date: t.date || t.timestamp,
            supplier: t.supplier || 'Not specified',
            price: parseFloat(t.price || t.totalPrice || 0).toFixed(2),
            pricePerAnimal: t.quantity ? (parseFloat(t.price || t.totalPrice || 0) / t.quantity).toFixed(2) : '0.00',
            location: t.location || 'Not specified',
            notes: t.notes || t.description || ''
        }));
        
        console.log(`Found ${purchaseTransactions.length} purchase transactions`);
        
        // Sort transactions by date (newest first)
        purchaseTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // Calculate summary statistics
        const totalSpent = purchaseTransactions.reduce((sum, t) => sum + parseFloat(t.price), 0);
        const totalAnimals = purchaseTransactions.reduce((sum, t) => sum + t.quantity, 0);
        const averagePrice = totalAnimals > 0 ? (totalSpent / totalAnimals).toFixed(2) : '0.00';
        
        return {
            inventory: animalData.inventory,
            transactions: purchaseTransactions,
            summary: {
                totalPurchases: purchaseTransactions.length,
                totalAnimals: totalAnimals,
                totalSpent: parseFloat(totalSpent.toFixed(2)),
                averagePricePerAnimal: averagePrice,
                dateRange: {
                    start: startDate,
                    end: endDate
                }
            }
        };
    } catch (error) {
        console.error('Error loading animal purchase data:', error);
        return {
            inventory: [],
            transactions: [],
            summary: {
                totalPurchases: 0,
                totalAnimals: 0,
                totalSpent: 0,
                averagePricePerAnimal: '0.00',
                dateRange: {
                    start: startDate,
                    end: endDate
                }
            }
        };
    }
}

/**
 * Load animal sale data
 * @param {string} category - Animal category to filter by
 * @param {Date|string} startDate - Start date for filtering
 * @param {Date|string} endDate - End date for filtering
 * @returns {Promise<Object>} Animal sale data with enhanced sale details
 */
async function loadAnimalSaleData(category, startDate, endDate) {
    console.log('Loading animal sale data:', { category, startDate, endDate });
    
    try {
        // Use the base animal data loading function
        const animalData = await loadAnimalData(category, startDate, endDate);
        
        console.log(`Total transactions before filtering for sales: ${animalData.transactions.length}`);
        
        // Filter and enhance sale transactions
        const saleTransactions = animalData.transactions.filter(t => {
            // Check for sell or sale type
            const isSell = t.type === 'sell' || t.type === 'sale';
            
            // Enhanced sale transaction logging
            if (isSell) {
                console.log('Found sale transaction:', {
                    date: t.date,
                    category: t.category,
                    quantity: t.quantity,
                    buyer: t.buyer,
                    price: t.price,
                    location: t.location
                });
            }
            
            return isSell;
        }).map(t => ({
            ...t,
            // Ensure consistent property names and types
            category: t.category || 'Unknown',
            quantity: t.quantity || t.count || 0,
            date: t.date || t.timestamp,
            buyer: t.buyer || 'Not specified',
            price: parseFloat(t.price || t.totalPrice || 0).toFixed(2),
            pricePerAnimal: t.quantity ? (parseFloat(t.price || t.totalPrice || 0) / t.quantity).toFixed(2) : '0.00',
            location: t.location || 'Not specified',
            notes: t.notes || t.description || '',
            profit: t.profit || t.profitPerAnimal ? (parseFloat(t.profit || t.profitPerAnimal) * (t.quantity || 1)).toFixed(2) : null
        }));
        
        console.log(`Found ${saleTransactions.length} sale transactions`);
        
        // Sort transactions by date (newest first)
        saleTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // Calculate summary statistics
        const totalRevenue = saleTransactions.reduce((sum, t) => sum + parseFloat(t.price), 0);
        const totalAnimals = saleTransactions.reduce((sum, t) => sum + t.quantity, 0);
        const averagePrice = totalAnimals > 0 ? (totalRevenue / totalAnimals).toFixed(2) : '0.00';
        const totalProfit = saleTransactions.reduce((sum, t) => sum + (t.profit ? parseFloat(t.profit) : 0), 0);
        
        return {
            inventory: animalData.inventory,
            transactions: saleTransactions,
            summary: {
                totalSales: saleTransactions.length,
                totalAnimals: totalAnimals,
                totalRevenue: parseFloat(totalRevenue.toFixed(2)),
                averagePricePerAnimal: averagePrice,
                totalProfit: parseFloat(totalProfit.toFixed(2)),
                dateRange: {
                    start: startDate,
                    end: endDate
                }
            }
        };
    } catch (error) {
        console.error('Error loading animal sale data:', error);
        return {
            inventory: [],
            transactions: [],
            summary: {
                totalSales: 0,
                totalAnimals: 0,
                totalRevenue: 0,
                averagePricePerAnimal: '0.00',
                totalProfit: 0,
                dateRange: {
                    start: startDate,
                    end: endDate
                }
            }
        };
    }
}

/**
 * Load animal birth data
 * @param {string} category - Animal category to filter by
 * @param {Date} startDate - Start date for filtering
 * @param {Date} endDate - End date for filtering
 * @returns {Promise<Object>} Animal birth data with enhanced statistics
 */
async function loadAnimalBirthData(category, startDate, endDate) {
    try {
        console.log(`Loading animal birth data for category: ${category}`);
        console.log(`Date range: ${startDate} to ${endDate}`);

        // Use the base animal data loading function
        const animalData = await loadAnimalData(category, startDate, endDate);
        
        console.log(`Total transactions before filtering for births: ${animalData.transactions.length}`);
        
        // Filter transactions to only include births
        const birthTransactions = animalData.transactions.filter(t => {
            // Check for birth type
            const isBirth = t.type === 'birth';
            
            // Debug output for all transactions to diagnose issues
            console.log(`Transaction type: ${t.type}, category: ${t.category}, isBirth: ${isBirth}`);
            
            if (isBirth) {
                console.log(`Found birth transaction:`, t);
            }
            
            return isBirth;
        });
        
        // Calculate enhanced statistics
        const statistics = {
            totalBirths: birthTransactions.length,
            totalAnimalsBorn: birthTransactions.reduce((sum, t) => sum + (parseInt(t.count) || parseInt(t.quantity) || 0), 0),
            birthsByCategory: {},
            birthsByMonth: {},
            mothersWithMultipleBirths: new Set()
        };

        // Process transactions for enhanced statistics
        birthTransactions.forEach(transaction => {
            // Count by category
            const category = transaction.category || 'Uncategorized';
            statistics.birthsByCategory[category] = (statistics.birthsByCategory[category] || 0) + 1;

            // Count by month
            const birthDate = new Date(transaction.date);
            const monthKey = `${birthDate.getFullYear()}-${(birthDate.getMonth() + 1).toString().padStart(2, '0')}`;
            statistics.birthsByMonth[monthKey] = (statistics.birthsByMonth[monthKey] || 0) + 1;

            // Track mothers with multiple births
            if (transaction.mother) {
                statistics.mothersWithMultipleBirths.add(transaction.mother);
            }
        });

        // Convert Set to array for the final output
        statistics.mothersWithMultipleBirths = Array.from(statistics.mothersWithMultipleBirths);

        console.log(`Found ${birthTransactions.length} birth transactions`);
        console.log('Birth statistics:', statistics);
        
        return {
            inventory: animalData.inventory,
            transactions: birthTransactions,
            statistics: statistics
        };
    } catch (error) {
        console.error('Error loading animal birth data:', error);
        return {
            inventory: [],
            transactions: [],
            statistics: {
                totalBirths: 0,
                totalAnimalsBorn: 0,
                birthsByCategory: {},
                birthsByMonth: {},
                mothersWithMultipleBirths: []
            }
        };
    }
}

/**
 * Load animal death data
 * @param {string} category - Animal category to filter by
 * @param {Date} startDate - Start date for filtering
 * @param {Date} endDate - End date for filtering
 * @returns {Promise<Object>} Animal death data with enhanced statistics
 */
async function loadAnimalDeathData(category, startDate, endDate) {
    try {
        console.log(`Loading animal death data for category: ${category}`);
        console.log(`Date range: ${startDate} to ${endDate}`);

        // Use the base animal data loading function
        const animalData = await loadAnimalData(category, startDate, endDate);
        
        console.log(`Total transactions before filtering for deaths: ${animalData.transactions.length}`);
        
        // Filter transactions to only include deaths
        const deathTransactions = animalData.transactions.filter(t => {
            // Check for death type
            const isDeath = t.type === 'death';
            
            // Debug output for all transactions to diagnose issues
            console.log(`Transaction type: ${t.type}, category: ${t.category}, isDeath: ${isDeath}`);
            
            if (isDeath) {
                console.log(`Found death transaction:`, t);
            }
            
            return isDeath;
        });
        
        // Calculate enhanced statistics
        const statistics = {
            totalDeaths: deathTransactions.length,
            totalAnimalsDied: deathTransactions.reduce((sum, t) => sum + (parseInt(t.count) || parseInt(t.quantity) || 0), 0),
            deathsByCategory: {},
            deathsByMonth: {},
            deathsByReason: {},
            averageAgeAtDeath: 0,
            locationStats: {}
        };

        let totalAge = 0;
        let ageCount = 0;

        // Process transactions for enhanced statistics
        deathTransactions.forEach(transaction => {
            // Count by category
            const category = transaction.category || 'Uncategorized';
            statistics.deathsByCategory[category] = (statistics.deathsByCategory[category] || 0) + 1;

            // Count by month
            const deathDate = new Date(transaction.date);
            const monthKey = `${deathDate.getFullYear()}-${(deathDate.getMonth() + 1).toString().padStart(2, '0')}`;
            statistics.deathsByMonth[monthKey] = (statistics.deathsByMonth[monthKey] || 0) + 1;

            // Count by reason
            const reason = transaction.reason || 'Unknown';
            statistics.deathsByReason[reason] = (statistics.deathsByReason[reason] || 0) + 1;

            // Track location statistics
            const location = transaction.location || 'Unknown';
            if (!statistics.locationStats[location]) {
                statistics.locationStats[location] = {
                    totalDeaths: 0,
                    deathsByReason: {}
                };
            }
            statistics.locationStats[location].totalDeaths++;
            if (transaction.reason) {
                statistics.locationStats[location].deathsByReason[transaction.reason] = 
                    (statistics.locationStats[location].deathsByReason[transaction.reason] || 0) + 1;
            }

            // Calculate average age at death if age data is available
            if (transaction.age) {
                totalAge += parseFloat(transaction.age);
                ageCount++;
            }
        });

        // Calculate final average age if we have age data
        if (ageCount > 0) {
            statistics.averageAgeAtDeath = totalAge / ageCount;
        }

        console.log(`Found ${deathTransactions.length} death transactions`);
        console.log('Death statistics:', statistics);
        
        return {
            inventory: animalData.inventory,
            transactions: deathTransactions,
            statistics: statistics
        };
    } catch (error) {
        console.error('Error loading animal death data:', error);
        return {
            inventory: [],
            transactions: [],
            statistics: {
                totalDeaths: 0,
                totalAnimalsDied: 0,
                deathsByCategory: {},
                deathsByMonth: {},
                deathsByReason: {},
                averageAgeAtDeath: 0,
                locationStats: {}
            }
        };
    }
}

/**
 * Load animal count data from both recentActivities and stockCounts storage so report reflects all counts.
 * @param {string} category - Animal category to filter by
 * @param {Date} startDate - Start date for filtering
 * @param {Date} endDate - End date for filtering
 * @returns {Promise<Object>} Animal count data with enhanced statistics
 */
async function loadAnimalCountData(category, startDate, endDate) {
    try {
        console.log('Loading animal count data for category:', category);
        console.log('Date range:', startDate, 'to', endDate);

        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        // Load dedicated stockCounts from storage (bypass cache for fresh data)
        const stockCountsRaw = await StorageManager.getItem('stockCounts', { bypassCache: true });
        const stockCountsList = Array.isArray(stockCountsRaw) ? stockCountsRaw : [];
        const fromStorage = stockCountsList
            .filter(t => {
                const d = new Date(t.date || t.timestamp);
                if (d < start || d > end) return false;
                if (category && category !== 'all' && t.category !== category) return false;
                return true;
            })
            .map(t => ({
                type: 'stock-count',
                date: t.date || t.timestamp,
                timestamp: t.timestamp || t.date,
                category: t.category || 'Unknown',
                expected: parseInt(t.expected) || 0,
                actual: parseInt(t.actual) || parseInt(t.quantity) || 0,
                counterName: t.counterName || t.counter || 'Unspecified',
                counter: t.counterName || t.counter || 'Unspecified',
                notes: t.notes || ''
            }));

        // Load from recentActivities (via loadAnimalData - uses same storage)
        let baseData;
        try {
            baseData = await loadAnimalData(category, startDate, endDate);
        } catch (error) {
            console.error('Error loading base animal data:', error);
            baseData = { inventory: [], transactions: [] };
        }

        // Include any count-like activity (loadAnimalData already normalizes to 'stock-count')
        const fromActivities = (baseData.transactions || []).filter(t => {
            const typ = (t.type || '').toString().toLowerCase().replace(/[\s_-]/g, '');
            return typ === 'stock-count' || typ === 'count' || typ === 'stockcount';
        });

        // Merge: prefer stockCounts (authoritative), add activity-only counts not already in storage
        const seenKey = new Set(fromStorage.map(t => `${t.category}|${(t.date || t.timestamp).toString().slice(0, 10)}`));
        const fromActivitiesOnly = fromActivities.filter(t => {
            const d = t.date || t.timestamp;
            const key = `${t.category || 'Unknown'}|${(d && new Date(d).toISOString().slice(0, 10)) || ''}`;
            if (seenKey.has(key)) return false;
            seenKey.add(key);
            return true;
        });
        const countTransactions = [
            ...fromStorage,
            ...fromActivitiesOnly.map(t => ({
                ...t,
                type: 'stock-count',
                date: t.date || t.timestamp,
                expected: parseInt(t.expected) || 0,
                actual: parseInt(t.actual) || parseInt(t.count) || parseInt(t.quantity) || 0,
                counterName: t.counterName || t.counter || 'Unspecified',
                counter: t.counterName || t.counter || 'Unspecified'
            }))
        ];

        console.log('Stock count report: from storage', fromStorage.length, ', from activities', fromActivitiesOnly.length, ', total', countTransactions.length);

        // Calculate statistics
        const statistics = {
            totalCounts: countTransactions.length,
            discrepancies: countTransactions.filter(t => (parseInt(t.expected) || 0) !== (parseInt(t.actual) || parseInt(t.count) || parseInt(t.quantity) || 0)).length,
            countsByCategory: {},
            discrepanciesByCategory: {},
            counterStats: {}
        };

        countTransactions.forEach(transaction => {
            const cat = transaction.category || 'Unknown';
            const counter = transaction.counterName || transaction.counter || 'Unspecified';
            const expected = parseInt(transaction.expected) || 0;
            const actual = parseInt(transaction.actual) || parseInt(transaction.count) || parseInt(transaction.quantity) || 0;
            const isDiscrepancy = expected !== actual;

            statistics.countsByCategory[cat] = (statistics.countsByCategory[cat] || 0) + 1;
            if (isDiscrepancy) {
                statistics.discrepanciesByCategory[cat] = (statistics.discrepanciesByCategory[cat] || 0) + 1;
            }
            if (!statistics.counterStats[counter]) {
                statistics.counterStats[counter] = {
                    totalCounts: 0,
                    accurateCounts: 0,
                    discrepancies: 0
                };
            }
            statistics.counterStats[counter].totalCounts++;
            if (isDiscrepancy) {
                statistics.counterStats[counter].discrepancies++;
            } else {
                statistics.counterStats[counter].accurateCounts++;
            }
        });

        return {
            transactions: countTransactions,
            statistics,
            dateRange: { start: startDate, end: endDate },
            isEmpty: countTransactions.length === 0
        };
    } catch (error) {
        console.error('Error loading animal count data:', error);
        throw error;
    }
}

/**
 * Load animal discrepancy data
 * @param {string} category - Animal category to filter by
 * @param {Date} startDate - Start date for filtering
 * @param {Date} endDate - End date for filtering
 * @returns {Promise<Object>} Animal discrepancy data with enhanced statistics
 */
async function loadAnimalDiscrepancyData(category, startDate, endDate) {
    try {
        console.log(`Loading animal discrepancy data for category: ${category}`);
        console.log(`Date range: ${startDate} to ${endDate}`);

        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        // Load stockDiscrepancies from storage (bypass cache for fresh data)
        const stockDiscrepanciesRaw = await StorageManager.getItem('stockDiscrepancies', { bypassCache: true });
        const stockDiscrepanciesList = Array.isArray(stockDiscrepanciesRaw) ? stockDiscrepanciesRaw : [];
        const fromStorage = stockDiscrepanciesList
            .filter(d => {
                const dDate = new Date(d.date || d.timestamp);
                if (dDate < start || dDate > end) return false;
                if (category && category !== 'all' && d.category !== category) return false;
                return true;
            })
            .map(d => ({
                date: d.date || d.timestamp,
                timestamp: d.timestamp || d.date,
                category: d.category || 'Unknown',
                expected: parseInt(d.expected) || 0,
                actual: parseInt(d.actual) || 0,
                counterName: d.counterName || d.counter || 'Unknown',
                resolved: !!d.resolved,
                notes: d.notes || '',
                type: 'stock-count'
            }));

        // Use the base animal data loading function (uses same storage via StorageManager)
        const animalData = await loadAnimalData(category, startDate, endDate);
        
        console.log(`Total transactions before filtering for discrepancies: ${animalData.transactions.length}`);
        
        // Filter transactions to only include stock counts with discrepancies (flexible type match)
        const fromActivities = animalData.transactions.filter(t => {
            const typ = (t.type || '').toString().toLowerCase().replace(/[\s_-]/g, '');
            const isCount = typ === 'count' || typ === 'stockcount';
            if (!isCount) return false;
            const expected = parseInt(t.expected) || 0;
            const actual = parseInt(t.actual) || parseInt(t.count) || parseInt(t.quantity) || 0;
            return Math.abs(actual - expected) > 0;
        });

        // Merge: prefer stockDiscrepancies (has resolved status); add activity-only discrepancies not already in storage
        const seenKey = new Set(fromStorage.map(t => `${t.category}|${(t.date || t.timestamp).toString().slice(0, 10)}`));
        const fromActivitiesOnly = fromActivities.filter(t => {
            const d = t.date || t.timestamp;
            const key = `${t.category || 'Unknown'}|${(d && new Date(d).toISOString().slice(0, 10)) || ''}`;
            if (seenKey.has(key)) return false;
            seenKey.add(key);
            return true;
        });
        const discrepancyTransactions = [
            ...fromStorage,
            ...fromActivitiesOnly.map(t => ({
                ...t,
                date: t.date || t.timestamp,
                expected: parseInt(t.expected) || 0,
                actual: parseInt(t.actual) || parseInt(t.count) || parseInt(t.quantity) || 0,
                counterName: t.counterName || t.counter || 'Unknown',
                resolved: !!t.resolved
            }))
        ];
        
        // Initialize statistics object
        const statistics = {
            totalDiscrepancies: discrepancyTransactions.length,
            totalMagnitude: 0,
            discrepanciesByCategory: {},
            discrepanciesByLocation: {},
            discrepanciesByMonth: {},
            severityLevels: {
                minor: 0,    // 1-5 animals
                moderate: 0, // 6-20 animals
                major: 0,    // 21-50 animals
                critical: 0  // 50+ animals
            },
            trends: {
                byCategory: {},
                byLocation: {},
                overall: []
            },
            counters: {
                total: 0,
                byPerson: {},
                performance: {},
                discrepancyRates: {}
            }
        };

        // Process each discrepancy for statistics
        discrepancyTransactions.forEach(t => {
            const expected = parseInt(t.expected) || 0;
            const actual = parseInt(t.actual) || parseInt(t.count) || parseInt(t.quantity) || 0;
            const difference = Math.abs(actual - expected);
            const category = t.category || t.animalType || 'Unknown';
            const location = t.location || 'Unknown';
            const counter = t.counterName || t.counter || t.countedBy || t.recorded_by || 'Unknown';
            const date = new Date(t.date || t.timestamp);
            const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
            
            // Update total magnitude
            statistics.totalMagnitude += difference;

            // Update category statistics
            statistics.discrepanciesByCategory[category] = (statistics.discrepanciesByCategory[category] || 0) + 1;

            // Update location statistics
            statistics.discrepanciesByLocation[location] = (statistics.discrepanciesByLocation[location] || 0) + 1;

            // Update monthly statistics
            statistics.discrepanciesByMonth[monthKey] = (statistics.discrepanciesByMonth[monthKey] || 0) + 1;

            // Update severity levels
            if (difference <= 5) statistics.severityLevels.minor++;
            else if (difference <= 20) statistics.severityLevels.moderate++;
            else if (difference <= 50) statistics.severityLevels.major++;
            else statistics.severityLevels.critical++;

            // Update counter statistics
            statistics.counters.total++;
            statistics.counters.byPerson[counter] = (statistics.counters.byPerson[counter] || 0) + 1;

            // Update trends
            if (!statistics.trends.byCategory[category]) {
                statistics.trends.byCategory[category] = [];
            }
            statistics.trends.byCategory[category].push({ date, difference });

            if (!statistics.trends.byLocation[location]) {
                statistics.trends.byLocation[location] = [];
            }
            statistics.trends.byLocation[location].push({ date, difference });

            statistics.trends.overall.push({ date, difference, category, location });
        });

        // Calculate counter performance metrics
        Object.entries(statistics.counters.byPerson).forEach(([counter, count]) => {
            statistics.counters.performance[counter] = {
                totalCounts: count,
                accuracyRate: (count / statistics.counters.total) * 100
            };
        });

        // Sort trends by date
        statistics.trends.overall.sort((a, b) => a.date - b.date);
        Object.values(statistics.trends.byCategory).forEach(trend => trend.sort((a, b) => a.date - b.date));
        Object.values(statistics.trends.byLocation).forEach(trend => trend.sort((a, b) => a.date - b.date));
        
        return {
            transactions: discrepancyTransactions,
            statistics,
            dateRange: { start: startDate, end: endDate },
            isEmpty: discrepancyTransactions.length === 0
        };
    } catch (error) {
        console.error('Error loading animal discrepancy data:', error);
        throw error;
    }
}

// Report generation functions
function createAnimalReportTable(data, reportType) {
    try {
        console.log(`Creating animal report table for type: ${reportType}`);
        console.log('Report data:', data);

        if (!data || !data.transactions || data.transactions.length === 0) {
            return createStandardReportStructure(
                'Animal Report',
                'No Data Available',
                '',
                `<div class="empty-state">
                    <h3>No Animal Records Available</h3>
                    <p>There are no animal records for the selected criteria.</p>
                </div>`,
                null,
                false,
                'animal-report'
            );
        }

        // Filter out feed activities from transactions before displaying (defensive filtering - declare once at top)
        const feedActivityTypes = ['feed-purchase', 'feed-usage', 'feed-category-added'];
        const animalOnlyTransactions = data.transactions.filter(t => {
            if (!t || !t.type) return false;
            const activityType = (t.type || '').toString().toLowerCase();
            return !feedActivityTypes.includes(activityType) && !activityType.startsWith('feed-');
        });

        // Create table content
        let tableHTML = `
            <table class="report-table animal-report-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Category</th>
                        <th>Quantity</th>
                        <th>Location</th>
                        <th>Details</th>
                        <th>Amount</th>
                        <th>Notes</th>
                    </tr>
                </thead>
                <tbody>`;
        
        // Sort transactions by date (newest first)
        animalOnlyTransactions
            .sort((a, b) => new Date(b.date || b.timestamp) - new Date(a.date || a.timestamp))
            .forEach(transaction => {
                const date = formatDate(transaction.date || transaction.timestamp);
                const type = transaction.type || '';
                const category = transaction.category || transaction.fromCategory || '';
                const quantity = transaction.quantity || transaction.count || 0;
                const location = transaction.location || '';
                
                // Build details based on transaction type
                let details = '';
                let amount = '';
                
                switch (type) {
                    case 'move':
                        details = `From: ${transaction.fromLocation || ''} To: ${transaction.toLocation || ''}<br>
                                 From: ${transaction.fromCategory || ''} To: ${transaction.toCategory || ''}`;
                        break;
                    case 'buy':
                        details = `Supplier: ${transaction.supplier || ''}`;
                        amount = formatCurrency(transaction.price || transaction.amount || transaction.cost || 0);
                        break;
                    case 'sell':
                        details = `Buyer: ${transaction.buyer || ''}`;
                        amount = formatCurrency(transaction.price || transaction.amount || transaction.revenue || 0);
                        break;
                    case 'death':
                        details = `Reason: ${transaction.reason || ''}`;
                        break;
                    case 'birth':
                        details = `Mother: ${transaction.mother || 'Not specified'}`;
                        break;
                    case 'stock-count':
                    case 'count':
                        details = `Expected: ${transaction.expected || 0}, Actual: ${transaction.actual || 0}<br>
                                 Counter: ${transaction.counterName || transaction.counter || ''}`;
                        break;
                    case 'add':
                        details = 'Initial stock entry';
                        break;
                }

                tableHTML += `
                    <tr>
                        <td>${date}</td>
                        <td>${type}</td>
                        <td>${category}</td>
                        <td>${quantity}</td>
                        <td>${location}</td>
                        <td>${details}</td>
                        <td>${amount}</td>
                        <td>${transaction.notes || transaction.description || ''}</td>
                    </tr>`;
            });

        tableHTML += '</tbody></table>';

        // Calculate summary statistics: use actual inventory total, not sum of transaction quantities
        const getNumericCount = (item) => {
            const c = item.count ?? item.quantity ?? 0;
            if (typeof c === 'number' && !isNaN(c)) return c;
            if (c && typeof c === 'object' && typeof c.total === 'number') return c.total;
            return 0;
        };
        const totalAnimals = (data.inventory && Array.isArray(data.inventory))
            ? data.inventory.reduce((sum, item) => sum + getNumericCount(item), 0)
            : null;
        
        // Use the already-filtered animalOnlyTransactions (declared above) for summary
        const summary = {
            totalTransactions: animalOnlyTransactions.length,
            transactionTypes: [...new Set(animalOnlyTransactions.map(t => t.type))],
            totalAnimals,
            categories: [...new Set(animalOnlyTransactions.map(t => t.category || t.fromCategory).filter(Boolean))]
        };

        // Return complete report using standard structure
        return createStandardReportStructure(
            'Animal Report',
            'All Animal Transactions',
            data.dateRange ? formatDateRange(data.dateRange.start, data.dateRange.end) : '',
            tableHTML,
            {
                summary: [
                    `Total Transactions: ${summary.totalTransactions}`,
                    `Transaction Types: ${summary.transactionTypes.join(', ')}`,
                    `Total Animals: ${summary.totalAnimals != null ? summary.totalAnimals : '—'}`,
                    `Categories: ${summary.categories.join(', ')}`
                ]
            },
            false,
            'animal-report'
        );
    } catch (error) {
        console.error('Error creating animal report table:', error);
        return createStandardReportStructure(
            'Animal Report',
            'Error',
            '',
            `<div class="error-state">
                <h3>Error Creating Report</h3>
                <p>There was an error generating the report. Please try again.</p>
            </div>`,
            null,
            false,
            'animal-report'
        );
    }
}

/**
 * Create an animal inventory report table
 * @param {Object} data - The inventory data to display
 * @returns {string} HTML table for the inventory report
 */
function createAnimalInventoryTable(data) {
    try {
        console.log('Creating animal inventory table');
        console.log('Inventory data:', data);

        if (!data || !data.inventory || data.inventory.length === 0) {
            return createStandardReportStructure(
                'Animal Inventory Report',
                'No Data Available',
                '',
                `<div class="empty-state">
                    <h3>No Inventory Data Available</h3>
                    <p>There are no animals currently in inventory.</p>
                </div>`,
                null,
                false,
                'animal-inventory'
            );
        }

        // Create table content
        let tableHTML = `
            <table class="report-table animal-report-table inventory-table">
                <thead>
                    <tr>
                        <th>Category</th>
                        <th>Location</th>
                        <th>Quantity</th>
                        <th>Last Updated</th>
                    </tr>
                </thead>
                <tbody>`;

        // Group inventory by category and location
        const groupedInventory = {};
        data.inventory.forEach(item => {
            const category = item.category || 'Uncategorized';
            const location = item.location || 'Unknown';
            const key = `${category}-${location}`;

            if (!groupedInventory[key]) {
                groupedInventory[key] = {
                    category,
                    location,
                    quantity: 0,
                    lastUpdated: item.lastUpdated || item.date || new Date().toISOString()
                };
            }

            groupedInventory[key].quantity += parseInt(item.quantity) || parseInt(item.count) || 0;
            
            // Update lastUpdated if this item is more recent
            const itemDate = new Date(item.lastUpdated || item.date || '');
            const currentDate = new Date(groupedInventory[key].lastUpdated);
            if (itemDate > currentDate) {
                groupedInventory[key].lastUpdated = item.lastUpdated || item.date;
            }
        });

        // Add table rows
        Object.values(groupedInventory)
            .sort((a, b) => a.category.localeCompare(b.category) || a.location.localeCompare(b.location))
            .forEach(group => {
                tableHTML += `
                    <tr>
                        <td>${group.category}</td>
                        <td>${group.location}</td>
                        <td>${group.quantity}</td>
                        <td>${formatDate(group.lastUpdated)}</td>
                    </tr>`;
            });

        // Close table
        tableHTML += '</tbody></table>';

        // Calculate summary data
        const summary = {
            totalAnimals: Object.values(groupedInventory).reduce((sum, group) => sum + group.quantity, 0),
            totalCategories: new Set(Object.values(groupedInventory).map(g => g.category)).size,
            totalLocations: new Set(Object.values(groupedInventory).map(g => g.location)).size
        };

        // Return complete report using standard structure
        return createStandardReportStructure(
            'Animal Inventory Report',
            'Current Animal Inventory Status',
            data.dateRange ? formatDateRange(data.dateRange.start, data.dateRange.end) : '',
            tableHTML,
            {
                summary: [
                    `Total Animals: ${summary.totalAnimals}`,
                    `Total Categories: ${summary.totalCategories}`,
                    `Total Locations: ${summary.totalLocations}`
                ]
            },
            false,
            'animal-inventory'
        );
    } catch (error) {
        console.error('Error creating animal inventory table:', error);
        return createStandardReportStructure(
            'Animal Inventory Report',
            'Error',
            '',
            `<div class="error-state">
                <h3>Error Creating Inventory Report</h3>
                <p>There was an error generating the inventory report. Please try again.</p>
            </div>`,
            null,
            false,
            'animal-inventory'
        );
    }
}

/**
 * Create an animal birth report table
 * @param {Object} data - The birth data to display
 * @returns {string} HTML table for the birth report
 */
function createAnimalBirthTable(data) {
    try {
        console.log('Creating animal birth table');
        console.log('Birth data:', data);

        if (!data || !data.transactions || data.transactions.length === 0) {
            return createStandardReportStructure(
                'Animal Birth Report',
                'No Data Available',
                '',
                `<div class="empty-state">
                    <h3>No Birth Data Available</h3>
                    <p>There are no animal birth records for the selected period.</p>
                </div>`,
                null,
                false,
                'animal-birth'
            );
        }

        // Create table content
        let tableHTML = `
            <table class="report-table animal-report-table birth-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Category</th>
                        <th>Quantity</th>
                        <th>Location</th>
                        <th>Mother ID</th>
                        <th>Batch ID</th>
                        <th>Notes</th>
                    </tr>
                </thead>
                <tbody>`;

        // Sort transactions by date (newest first)
        data.transactions
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .forEach(birth => {
                tableHTML += `
                    <tr>
                        <td>${formatDate(birth.date)}</td>
                        <td>${birth.category || 'Uncategorized'}</td>
                        <td>${birth.quantity || birth.count || 0}</td>
                        <td>${birth.location || 'Unknown'}</td>
                        <td>${birth.mother || '-'}</td>
                        <td>${birth.batchId || birth.batch || '-'}</td>
                        <td>${birth.notes || ''}</td>
                    </tr>`;
            });

        // Close table
        tableHTML += '</tbody></table>';

        // Calculate summary data
        const stats = data.statistics || {
            totalBirths: data.transactions.length,
            totalAnimalsBorn: data.transactions.reduce((sum, birth) => sum + (birth.quantity || birth.count || 0), 0),
            birthsByCategory: data.transactions.reduce((acc, birth) => {
                const category = birth.category || 'Uncategorized';
                acc[category] = (acc[category] || 0) + (birth.quantity || birth.count || 0);
                return acc;
            }, {})
        };

        // Create category breakdown HTML
        let categoryBreakdownHTML = '';
            if (stats.birthsByCategory && Object.keys(stats.birthsByCategory).length > 0) {
            categoryBreakdownHTML = `
                <div class="category-breakdown">
                    <h4>Births by Category</h4>
                    <ul>
                        ${Object.entries(stats.birthsByCategory)
                            .map(([category, count]) => `<li>${category}: ${count}</li>`)
                            .join('')}
                    </ul>
                </div>`;
        }

        // Return complete report using standard structure
        return createStandardReportStructure(
            'Animal Birth Report',
            'Birth Records',
            data.dateRange ? formatDateRange(data.dateRange.start, data.dateRange.end) : '',
            tableHTML + categoryBreakdownHTML,
            {
                summary: [
                    `Total Birth Records: ${stats.totalBirths}`,
                    `Total Animals Born: ${stats.totalAnimalsBorn}`,
                    `Categories: ${Object.keys(stats.birthsByCategory).length}`
                ]
            },
            false,
            'animal-birth'
        );
    } catch (error) {
        console.error('Error creating animal birth table:', error);
        return createStandardReportStructure(
            'Animal Birth Report',
            'Error',
            '',
            `<div class="error-state">
                <h3>Error Creating Birth Report</h3>
                <p>There was an error generating the birth report. Please try again.</p>
            </div>`,
            null,
            false,
            'animal-birth'
        );
    }
}

/**
 * Create an animal death report table
 * @param {Object} data - The death data to display
 * @returns {string} HTML table for the death report
 */
function createAnimalDeathTable(data) {
    try {
        console.log('Creating animal death table');
        console.log('Death data:', data);

        if (!data || !data.transactions || data.transactions.length === 0) {
            return createStandardReportStructure(
                'Animal Death Report',
                'No Data Available',
                '',
                `<div class="empty-state">
                    <h3>No Death Records Available</h3>
                    <p>There are no animal death records for the selected period.</p>
                </div>`,
                {
                    summary: [
                        'Total Death Records: 0',
                        'Total Animals Lost: 0',
                        'Categories Affected: 0',
                        'Reasons Recorded: 0',
                        'Locations Affected: 0'
                    ]
                },
                false,
                'animal-death'
            );
        }

        // Calculate statistics
        const stats = {
            totalDeaths: data.transactions.length,
            totalAnimalsDied: data.transactions.reduce((sum, death) => sum + (parseInt(death.quantity) || parseInt(death.count) || 0), 0),
            deathsByCategory: {},
            deathsByReason: {},
            locationStats: {},
            averageAgeAtDeath: 0
        };

        let totalAge = 0;
        let ageCount = 0;

        // Process transactions for statistics
        data.transactions.forEach(death => {
            // Count by category
            const category = death.category || 'Uncategorized';
            stats.deathsByCategory[category] = (stats.deathsByCategory[category] || 0) + (parseInt(death.quantity) || parseInt(death.count) || 0);

            // Count by reason
            const reason = death.reason || 'Not specified';
            stats.deathsByReason[reason] = (stats.deathsByReason[reason] || 0) + (parseInt(death.quantity) || parseInt(death.count) || 0);

            // Track location statistics
            const location = death.location || 'Unknown';
            if (!stats.locationStats[location]) {
                stats.locationStats[location] = { totalDeaths: 0 };
            }
            stats.locationStats[location].totalDeaths += (parseInt(death.quantity) || parseInt(death.count) || 0);

            // Calculate average age if available
            if (death.age && !isNaN(parseFloat(death.age))) {
                totalAge += parseFloat(death.age);
                ageCount++;
            }
        });

        // Calculate average age
        if (ageCount > 0) {
            stats.averageAgeAtDeath = totalAge / ageCount;
        }

        // Create table content
        let tableHTML = `
            <table class="report-table animal-report-table death-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Category</th>
                        <th>Quantity</th>
                        <th>Location</th>
                        <th>Reason</th>
                        <th>Age</th>
                        <th>Notes</th>
                    </tr>
                </thead>
                <tbody>`;

        // Sort transactions by date (newest first)
        data.transactions
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .forEach(death => {
                tableHTML += `
                    <tr>
                        <td>${formatDate(death.date)}</td>
                        <td>${death.category || 'Uncategorized'}</td>
                        <td>${death.quantity || death.count || 0}</td>
                        <td>${death.location || 'Unknown'}</td>
                        <td>${death.reason || 'Not specified'}</td>
                        <td>${death.age || '-'}</td>
                        <td>${death.notes || ''}</td>
                    </tr>`;
            });

        tableHTML += '</tbody></table>';

        // Create summary sections
        let summaryHTML = `
                <div class="report-summary">
                <div class="summary-item">
                    <strong>Total Deaths:</strong> ${stats.totalAnimalsDied}
                </div>
                <div class="summary-item">
                    <strong>Records:</strong> ${stats.totalDeaths}
                </div>
                ${stats.averageAgeAtDeath ? `
                <div class="summary-item">
                    <strong>Average Age:</strong> ${stats.averageAgeAtDeath.toFixed(1)}
                </div>` : ''}
            </div>`;

        // Create breakdowns HTML
        let breakdownsHTML = '';
        
        // Category breakdown
        if (Object.keys(stats.deathsByCategory).length > 0) {
            breakdownsHTML += `
                <div class="breakdown-section">
                    <h4>Deaths by Category</h4>
                    <ul>
                        ${Object.entries(stats.deathsByCategory)
                            .map(([category, count]) => `<li>${category}: ${count}</li>`)
                            .join('')}
                    </ul>
                </div>`;
        }

        // Reason breakdown
        if (Object.keys(stats.deathsByReason).length > 0) {
            breakdownsHTML += `
                <div class="breakdown-section">
                    <h4>Deaths by Reason</h4>
                    <ul>
                        ${Object.entries(stats.deathsByReason)
                            .map(([reason, count]) => `<li>${reason}: ${count}</li>`)
                            .join('')}
                    </ul>
                </div>`;
        }

        // Location breakdown
        if (Object.keys(stats.locationStats).length > 0) {
            breakdownsHTML += `
                <div class="breakdown-section">
                    <h4>Deaths by Location</h4>
                    <ul>
                        ${Object.entries(stats.locationStats)
                            .map(([location, data]) => `<li>${location}: ${data.totalDeaths} deaths</li>`)
                            .join('')}
                    </ul>
                </div>`;
        }

        // Return complete report using standard structure
        return createStandardReportStructure(
            'Animal Death Report',
            'Death Records',
            data.dateRange ? formatDateRange(data.dateRange.start, data.dateRange.end) : '',
            summaryHTML + tableHTML + breakdownsHTML,
            {
                summary: [
                    `Total Death Records: ${stats.totalDeaths}`,
                    `Total Animals Lost: ${stats.totalAnimalsDied}`,
                    `Categories Affected: ${Object.keys(stats.deathsByCategory).length}`,
                    `Reasons Recorded: ${Object.keys(stats.deathsByReason).length}`,
                    `Locations Affected: ${Object.keys(stats.locationStats).length}`,
                    stats.averageAgeAtDeath ? `Average Age at Death: ${stats.averageAgeAtDeath.toFixed(1)}` : null
                ].filter(Boolean)
            },
            false,
            'animal-death'
        );
    } catch (error) {
        console.error('Error creating animal death table:', error);
        return createStandardReportStructure(
            'Animal Death Report',
            'Error',
            '',
            `<div class="error-state">
                <h3>Error Creating Death Report</h3>
                <p>There was an error generating the death report. Please try again.</p>
                <p class="error-details">${error.message}</p>
            </div>`,
            {
                summary: ['Error generating report']
            },
            false,
            'animal-death'
        );
    }
}

/**
 * Create an animal movement report table
 * @param {Object} data - The movement data to display
 * @returns {string} HTML table for the movement report
 */
function createAnimalMovementTable(data) {
    try {
        console.log('Creating animal movement table');
        console.log('Movement data:', data);

        if (!data || !data.transactions || data.transactions.length === 0) {
            return createStandardReportStructure(
                'Animal Movement Report',
                'No Data Available',
                '',
                `<div class="empty-state">
                    <h3>No Movement Records Available</h3>
                    <p>There are no animal movement records for the selected period.</p>
                </div>`,
                null,
                false,
                'animal-movement'
            );
        }

        // Calculate statistics
        const stats = {
            totalMovements: data.transactions.length,
            totalAnimalsMoved: data.transactions.reduce((sum, t) => sum + (t.quantity || t.count || 0), 0),
            movementsByCategory: {},
            locationStats: {},
            categoryMovements: {} // Track movements between categories
        };

        // Process transactions for statistics
        data.transactions.forEach(movement => {
            const fromCategory = movement.fromCategory || movement.category || 'Unknown';
            const toCategory = movement.toCategory || movement.category || 'Unknown';
            const fromLocation = movement.fromLocation || 'Unknown';
            const toLocation = movement.toLocation || 'Unknown';
            const quantity = parseInt(movement.quantity) || parseInt(movement.count) || 0;

            // Category stats (using fromCategory as primary)
            stats.movementsByCategory[fromCategory] = (stats.movementsByCategory[fromCategory] || 0) + quantity;

            // Category movement tracking
            const categoryKey = `${fromCategory}→${toCategory}`;
            if (!stats.categoryMovements[categoryKey]) {
                stats.categoryMovements[categoryKey] = {
                    from: fromCategory,
                    to: toCategory,
                    count: 0,
                    quantity: 0
                };
            }
            stats.categoryMovements[categoryKey].count++;
            stats.categoryMovements[categoryKey].quantity += quantity;

            // Location stats
            if (!stats.locationStats[fromLocation]) {
                stats.locationStats[fromLocation] = { incoming: 0, outgoing: 0 };
            }
            if (!stats.locationStats[toLocation]) {
                stats.locationStats[toLocation] = { incoming: 0, outgoing: 0 };
            }
            stats.locationStats[fromLocation].outgoing += quantity;
            stats.locationStats[toLocation].incoming += quantity;
        });

        // Create table content
        let tableHTML = `
            <table class="report-table animal-movement-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>From Category</th>
                        <th>To Category</th>
                        <th>Quantity</th>
                        <th>From Location</th>
                        <th>To Location</th>
                        <th>Reason</th>
                        <th>Notes</th>
                    </tr>
                </thead>
                <tbody>`;

        // Sort transactions by date (newest first)
        data.transactions
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .forEach(movement => {
                const fromCategory = movement.fromCategory || movement.category || 'Unknown';
                const toCategory = movement.toCategory || movement.category || 'Unknown';
                tableHTML += `
                    <tr>
                        <td>${formatDate(movement.date)}</td>
                        <td>${fromCategory}</td>
                        <td>${toCategory}</td>
                        <td>${movement.quantity || movement.count || 0}</td>
                        <td>${movement.fromLocation || 'Unknown'}</td>
                        <td>${movement.toLocation || 'Unknown'}</td>
                        <td>${movement.reason || 'Not specified'}</td>
                        <td>${movement.notes || ''}</td>
                    </tr>`;
            });

        tableHTML += '</tbody></table>';

        // Format summary data for createStandardReportStructure
        const summaryData = {
            'Total Movements': stats.totalMovements,
            'Total Animals Moved': stats.totalAnimalsMoved,
            'Category Movements': Object.keys(stats.categoryMovements).length,
            'Locations': Object.keys(stats.locationStats).length,
            'Movement Details': Object.entries(stats.categoryMovements).map(([key, data]) => 
                `${data.from} → ${data.to}: ${data.quantity} (${data.count} moves)`
            ),
            'Location Statistics': Object.entries(stats.locationStats).map(([location, data]) =>
                `${location}: In: ${data.incoming}, Out: ${data.outgoing}, Net: ${data.incoming - data.outgoing}`
            )
        };

        // Return the complete report structure
        return createStandardReportStructure(
            'Animal Movement Report',
            'Record of Animal Movements',
            data.dateRange ? formatDateRange(data.dateRange.start, data.dateRange.end) : '',
            tableHTML,
            summaryData,
            false,
            'animal-movement'
        );

    } catch (error) {
        console.error('Error creating animal movement table:', error);
        return createStandardReportStructure(
            'Animal Movement Report',
            'Error',
            '',
            `<div class="error-state">
                <h3>Error Creating Movement Report</h3>
                <p>There was an error generating the movement report. Please try again.</p>
            </div>`,
            null,
            false,
            'animal-movement'
        );
    }
}

/**
 * Create the animal purchase report table
 * @param {Object} data - Animal purchase data
 * @returns {string} HTML for the animal purchase report
 */
function createAnimalPurchaseTable(data) {
    try {
        // Extract data
        const { inventory, transactions } = data;
        
        // If no data, return empty report
        if (!transactions || transactions.length === 0) {
            return createStandardReportStructure(
                'Animal Purchase Report',
                'No Data Available',
                '',
                `<div class="empty-state">
                    <h3>No Animal Purchase Data Available</h3>
                    <p>There are no animal purchase records in the system for the selected date range.</p>
                    <p>Try adding some animal purchase records first, or select a different date range.</p>
                </div>`,
                null,
                false,
                'animal-purchase'
            );
        }
        
        // Calculate totals
        const totalCost = transactions.reduce((sum, t) => sum + (parseFloat(t.cost) || parseFloat(t.amount) || parseFloat(t.price) || 0), 0);
        const totalAnimals = transactions.reduce((sum, t) => sum + (parseInt(t.count) || parseInt(t.quantity) || 0), 0);
        
        // Create summary data
        const summaryData = {
            'Total purchases': transactions.length,
            'Total animals purchased': totalAnimals,
            'Total cost': formatCurrency(totalCost)
        };
        
        // Create table HTML
        let tableHTML = `
            <table class="report-table animal-report-table purchase-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Animal Type</th>
                        <th>Quantity</th>
                        <th>Location</th>
                        <th>Supplier</th>
                        <th>Cost</th>
                        <th>Notes</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        // Sort transactions by date (newest first)
        transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // Process each transaction
        transactions.forEach(transaction => {
            const date = transaction.date || '';
            const animalType = transaction.category || transaction.type || transaction.animalType || 'Unknown';
            const quantity = parseInt(transaction.count) || parseInt(transaction.quantity) || 0;
            const location = transaction.location || 'Unspecified';
            const supplier = transaction.supplier || transaction.from || 'Unknown';
            const cost = parseFloat(transaction.cost) || parseFloat(transaction.amount) || parseFloat(transaction.price) || 0;
            const notes = transaction.notes || '';
            
            // Add row to table
            tableHTML += `
                <tr>
                    <td>${formatDate(date)}</td>
                    <td>${animalType}</td>
                    <td>${quantity}</td>
                    <td>${location}</td>
                    <td>${supplier}</td>
                    <td>${formatCurrency(cost)}</td>
                    <td>${notes}</td>
                </tr>
            `;
        });
        
        tableHTML += `
                </tbody>
            </table>
        `;
        
        // Return the complete report structure
        return createStandardReportStructure(
            'Animal Purchase Report',
            'Record of Animal Purchases',
            data.dateRange ? formatDateRange(data.dateRange.start, data.dateRange.end) : '',
            tableHTML,
            summaryData,
            false,
            'animal-purchase'
        );
    } catch (error) {
        console.error('Error creating animal purchase table:', error);
        return `
            <div class="error-state">
                <h3>Error Creating Purchase Report</h3>
                <p>There was an error generating the purchase report. Please try again.</p>
            </div>`;
    }
}

/**
 * Create the animal sale report table
 * @param {Object} data - Animal sale data
 * @returns {string} HTML for the animal sale report
 */
function createAnimalSaleTable(data) {
    try {
        // Extract data
        const { inventory, transactions } = data;
        
        // If no data, return empty report
        if (!transactions || transactions.length === 0) {
            return createStandardReportStructure(
                'Animal Sale Report',
                'No Data Available',
                '',
                `<div class="empty-state">
                    <h3>No Animal Sale Data Available</h3>
                    <p>There are no animal sale records in the system for the selected date range.</p>
                    <p>Try adding some animal sale records first, or select a different date range.</p>
                </div>`,
                null,
                false,
                'animal-sale'
            );
        }
        
        // Calculate totals
        const totalRevenue = transactions.reduce((sum, t) => sum + (parseFloat(t.revenue) || parseFloat(t.amount) || parseFloat(t.price) || 0), 0);
        const totalAnimals = transactions.reduce((sum, t) => sum + (parseInt(t.count) || parseInt(t.quantity) || 0), 0);
        
        // Create summary data
        const summaryData = {
            'Total sales': transactions.length,
            'Total animals sold': totalAnimals,
            'Total revenue': formatCurrency(totalRevenue)
        };
        
        // Create table HTML
        let tableHTML = `
            <table class="report-table animal-report-table sale-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Animal Type</th>
                        <th>Quantity</th>
                        <th>Location</th>
                        <th>Buyer</th>
                        <th>Revenue</th>
                        <th>Notes</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        // Sort transactions by date (newest first)
        transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // Process each transaction
        transactions.forEach(transaction => {
            const date = transaction.date || '';
            const animalType = transaction.category || transaction.type || transaction.animalType || 'Unknown';
            const quantity = parseInt(transaction.count) || parseInt(transaction.quantity) || 0;
            const location = transaction.location || 'Unspecified';
            const buyer = transaction.buyer || transaction.to || 'Unknown';
            const revenue = parseFloat(transaction.revenue) || parseFloat(transaction.amount) || parseFloat(transaction.price) || 0;
            const notes = transaction.notes || '';
            
            // Add row to table
            tableHTML += `
                <tr>
                    <td>${formatDate(date)}</td>
                    <td>${animalType}</td>
                    <td>${quantity}</td>
                    <td>${location}</td>
                    <td>${buyer}</td>
                    <td>${formatCurrency(revenue)}</td>
                    <td>${notes}</td>
                </tr>
            `;
        });
        
        tableHTML += `
                </tbody>
            </table>
        `;
        
        // Return the complete report structure
        return createStandardReportStructure(
            'Animal Sale Report',
            'Record of Animal Sales',
            data.dateRange ? formatDateRange(data.dateRange.start, data.dateRange.end) : '',
            tableHTML,
            summaryData,
            false,
            'animal-sale'
        );
    } catch (error) {
        console.error('Error creating animal sale table:', error);
        return `
            <div class="error-state">
                <h3>Error Creating Sale Report</h3>
                <p>There was an error generating the sale report. Please try again.</p>
            </div>`;
    }
}

/**
 * Create the animal count report table
 * @param {Object} data - Animal count data
 * @returns {string} HTML for the animal count report
 */
function createAnimalCountTable(data) {
    try {
        console.log('Creating animal count table');
        console.log('Count data:', data);
        
        if (!data || !data.transactions || data.transactions.length === 0 || data.isEmpty) {
            return createStandardReportStructure(
                'Animal Count Report',
                'Stock Count Records',
                '',
                `<div class="empty-state">
                    <h3>No Stock Count Records Available</h3>
                    <p>There are no stock count records for the selected period.</p>
                </div>`,
                { summary: ['No stock count records found.'] },
                false,
                'animal-count'
            );
        }

        const { transactions, statistics, dateRange } = data;

        // Initialize statistics if not provided
        const stats = {
            totalCounts: transactions.length,
            discrepancies: transactions.filter(t => {
                const expected = parseInt(t.expected) || 0;
                const actual = parseInt(t.actual) || 0;
                return expected !== actual;
            }).length,
            countsByCategory: {},
            counterStats: {}
        };

        // Calculate counter statistics
        transactions.forEach(transaction => {
            const counter = transaction.counterName || transaction.counter || 'Unknown';
            const expected = parseInt(transaction.expected) || 0;
            const actual = parseInt(transaction.actual) || 0;
            const isAccurate = expected === actual;

            if (!stats.counterStats[counter]) {
                stats.counterStats[counter] = {
                    totalCounts: 0,
                    accurateCounts: 0,
                    totalExpected: 0,
                    totalActual: 0,
                    totalDifference: 0
                };
            }

            stats.counterStats[counter].totalCounts++;
            if (isAccurate) stats.counterStats[counter].accurateCounts++;
            stats.counterStats[counter].totalExpected += expected;
            stats.counterStats[counter].totalActual += actual;
            stats.counterStats[counter].totalDifference += (actual - expected);
        });

        // Calculate category statistics
        transactions.forEach(transaction => {
            const category = transaction.category;
            const expected = parseInt(transaction.expected) || 0;
            const actual = parseInt(transaction.actual) || 0;
            const isDiscrepancy = expected !== actual;

            if (!stats.countsByCategory[category]) {
                stats.countsByCategory[category] = {
                    counts: 0,
                    discrepancies: 0,
                    expected: 0,
                    actual: 0,
                    difference: 0
                };
            }

            stats.countsByCategory[category].counts++;
            if (isDiscrepancy) stats.countsByCategory[category].discrepancies++;
            stats.countsByCategory[category].expected += expected;
            stats.countsByCategory[category].actual += actual;
            stats.countsByCategory[category].difference += (actual - expected);
        });

        // Create table content
        let tableHTML = `
            <table class="report-table animal-count-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Category</th>
                        <th>Expected</th>
                        <th>Actual</th>
                        <th>Difference</th>
                        <th>Counter</th>
                        <th>Status</th>
                        <th>Notes</th>
                    </tr>
                </thead>
                <tbody>`;
        
        // Sort transactions by date, most recent first
        transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Add transaction rows
        transactions.forEach(transaction => {
            const date = new Date(transaction.date).toLocaleDateString();
            const expected = parseInt(transaction.expected) || 0;
            const actual = parseInt(transaction.actual) || 0;
            const difference = actual - expected;
            const counter = transaction.counterName || transaction.counter || 'Unknown';
            const status = difference === 0 ? 'Match' : (difference > 0 ? 'Surplus' : 'Shortage');
            const notes = transaction.notes || '';
            
            tableHTML += `
                <tr class="${status.toLowerCase()}">
                    <td>${date}</td>
                    <td>${transaction.category}</td>
                    <td>${expected}</td>
                    <td>${actual}</td>
                    <td>${difference >= 0 ? '+' : ''}${difference}</td>
                    <td>${counter}</td>
                        <td>${status}</td>
                    <td>${notes}</td>
                    </tr>`;
            });

        tableHTML += '</tbody></table>';

        // Create summary sections
        let summaryHTML = `
            <div class="report-summary">
                <div class="summary-section">
                    <div class="summary-header">
                        <span>Total Counts: ${stats.totalCounts}</span>
                        <span>Total Discrepancies: ${stats.discrepancies}</span>
                    </div>
                    <div class="counters-section">
                        <h4>Counter Performance</h4>
                        ${Object.entries(stats.counterStats).map(([counter, stats]) => `
                            <div class="counter-row">
                                <div class="counter-name">${counter}</div>
                                <div class="counter-stats">
                                    <span>${Math.round((stats.accurateCounts / stats.totalCounts) * 100)}% accuracy</span>
                                    <span>(${stats.accurateCounts}/${stats.totalCounts})</span>
                                    <span>Expected: ${stats.totalExpected}</span>
                                    <span>Actual: ${stats.totalActual}</span>
                                    <span>Diff: ${stats.totalDifference >= 0 ? '+' : ''}${stats.totalDifference}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <div class="categories-section">
                        <h4>Categories</h4>
                        ${Object.entries(stats.countsByCategory).map(([category, stats]) => `
                            <div class="category-row">
                                <div class="category-name">${category}</div>
                                <div class="category-stats">
                                    <span>${stats.counts} counts (${stats.discrepancies} disc.)</span>
                                    <span>Expected: ${stats.expected}</span>
                                    <span>Actual: ${stats.actual}</span>
                                    <span>Diff: ${stats.difference >= 0 ? '+' : ''}${stats.difference}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>`;

        // Add CSS styles for compact layout
        const styles = `
            <style>
                .report-summary {
                    font-family: Arial, sans-serif;
                    margin-bottom: 20px;
                }
                .summary-header {
                    display: flex;
                    justify-content: space-between;
                    padding: 5px 10px;
                    background: #f8f9fa;
                    border-radius: 4px;
                    margin-bottom: 10px;
                }
                .counters-section, .categories-section {
                    margin-top: 10px;
                }
                .counters-section h4, .categories-section h4 {
                    margin: 5px 0;
                    font-size: 14px;
                    color: #666;
                }
                .counter-row, .category-row {
                    display: flex;
                    padding: 5px;
                    border-bottom: 1px solid #eee;
                }
                .counter-name, .category-name {
                    width: 100px;
                    font-weight: bold;
                }
                .counter-stats, .category-stats {
                    display: flex;
                    gap: 15px;
                }
                .counter-stats span, .category-stats span {
                    white-space: nowrap;
                }
                .animal-count-table {
                    margin-top: 10px;
                }
            </style>`;

        // Return complete report
        return createStandardReportStructure(
            'Animal Count Report',
            'Stock Count Records',
            dateRange ? `${formatDate(dateRange.start)} to ${formatDate(dateRange.end)}` : '',
            styles + summaryHTML + tableHTML,
            {
                summary: [
                    `Total Stock Counts: ${stats.totalCounts}`,
                    `Total Discrepancies: ${stats.discrepancies}`,
                    `Categories Counted: ${Object.keys(stats.countsByCategory).length}`
                ]
            },
            false,
            'animal-count'
        );

    } catch (error) {
        console.error('Error creating animal count table:', error);
        return createStandardReportStructure(
            'Animal Count Report',
            'Error',
            '',
            `<div class="error-state">
                <h3>Error Creating Report</h3>
                <p>There was an error generating the stock count report. Please try again.</p>
                <p class="error-details">${error.message}</p>
            </div>`,
            { summary: ['Error generating report'] },
            false,
            'animal-count'
        );
    }
}

/**
 * Create an animal discrepancy report table
 * @param {Object} data - Animal discrepancy data
 * @returns {string} HTML for the animal discrepancy report
 */
function createAnimalDiscrepancyTable(data) {
    try {
        console.log('Creating discrepancy table with data:', data);
        
        // Check if we have the isEmpty flag
        if (data && data.isEmpty === true) {
            return createStandardReportStructure(
                'Animal Discrepancy Report',
                'Record of Inventory Adjustments',
                data.dateRange ? formatDateRange(data.dateRange.start, data.dateRange.end) : '',
                `<div class="no-data-message">
                    <p>No discrepancies found for this period.</p>
                    <p>If you've just cleared all animal data, that's expected - new discrepancies will appear here when stock counts are performed.</p>
                </div>`,
                null,
                false,
                'animal-discrepancy'
            );
        }
        
        // Extract transactions from data object
        const transactions = Array.isArray(data) ? data : (data && data.transactions ? data.transactions : []);
        
        console.log(`Processing ${transactions.length} discrepancy transactions`);
        
        // Format date range if available
        let dateRangeText = '';
        if (data && data.dateRange) {
            dateRangeText = formatDateRange(data.dateRange.start, data.dateRange.end);
        }

        // Create table content
        let tableHTML = `
            <table class="report-table animal-discrepancy-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Category</th>
                        <th>Expected</th>
                        <th>Actual</th>
                        <th>Difference</th>
                        <th>Counter</th>
                        <th>Status</th>
                            <th>Notes</th>
                    </tr>
                </thead>
                <tbody>`;

        let totalDifference = 0;
        let resolved = 0;
        let unresolved = 0;

        // Sort transactions by date (newest first)
        transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Process each transaction
        transactions.forEach(transaction => {
            const expected = parseInt(transaction.expected) || 0;
            const actual = parseInt(transaction.actual) || parseInt(transaction.count) || 0;
            const difference = actual - expected;
            const status = transaction.resolved ? 'Resolved' : 'Pending';
            
            totalDifference += difference;
            if (transaction.resolved) {
                resolved++;
            } else {
                unresolved++;
            }
            
            tableHTML += `
                <tr class="${difference === 0 ? 'match' : (difference < 0 ? 'shortage' : 'surplus')}">
                    <td>${formatDate(transaction.date)}</td>
                    <td>${transaction.category || 'Unknown'}</td>
                    <td>${expected}</td>
                    <td>${actual}</td>
                    <td class="${difference < 0 ? 'negative' : (difference > 0 ? 'positive' : '')}">${difference >= 0 ? '+' : ''}${difference}</td>
                    <td>${transaction.counterName || transaction.counter || 'Unknown'}</td>
                    <td>${status}</td>
                    <td>${transaction.notes || ''}</td>
                </tr>`;
        });

        // Add summary row if there are transactions
        if (transactions.length > 0) {
        tableHTML += `
                <tr class="summary-row">
                    <td colspan="4"><strong>Summary</strong></td>
                    <td class="${totalDifference < 0 ? 'negative' : (totalDifference > 0 ? 'positive' : '')}">${totalDifference >= 0 ? '+' : ''}${totalDifference}</td>
                    <td colspan="3">Resolved: ${resolved}, Unresolved: ${unresolved}</td>
                </tr>`;
        } else {
            tableHTML += `
                <tr>
                    <td colspan="8" class="text-center">No discrepancies found</td>
                </tr>`;
        }

        tableHTML += '</tbody></table>';

        // Return complete report
        return createStandardReportStructure(
            'Animal Discrepancy Report',
            'Record of Inventory Adjustments',
            dateRangeText,
            tableHTML,
            {
                summary: [
                    `Total Discrepancies: ${transactions.length}`,
                    `Net Difference: ${totalDifference >= 0 ? '+' : ''}${totalDifference}`,
                    `Resolution Status: ${resolved} resolved, ${unresolved} pending`
                ]
            },
            false,
            'animal-discrepancy'
        );

    } catch (error) {
        console.error('Error creating animal discrepancy table:', error);
        return createStandardReportStructure(
            'Animal Discrepancy Report',
            'Error',
            '',
            `<div class="error-state">
                <h3>Error Creating Report</h3>
                <p>There was an error generating the discrepancy report. Please try again.</p>
                <p class="error-details">${error.message}</p>
            </div>`,
            { summary: ['Error generating report'] },
            false,
            'animal-discrepancy'
        );
    }
}

// Export all functions
export {
    REPORT_TYPES,
    loadAnimalData,
    getAnimalCategories,
    loadAnimalInventoryData,
    loadAnimalMovementData,
    loadAnimalPurchaseData,
    loadAnimalSaleData,
    loadAnimalBirthData,
    loadAnimalDeathData,
    loadAnimalCountData,
    loadAnimalDiscrepancyData,
    createAnimalReportTable,
    createAnimalInventoryTable,
    createAnimalBirthTable,
    createAnimalDeathTable,
    createAnimalMovementTable,
    createAnimalPurchaseTable,
    createAnimalSaleTable,
    createAnimalCountTable,
    createAnimalDiscrepancyTable
}; 