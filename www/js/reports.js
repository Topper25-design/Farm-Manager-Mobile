document.addEventListener('DOMContentLoaded', async () => {
    // Check if logged in
    const isLoggedIn = await mobileStorage.getItem('isLoggedIn');
    if (isLoggedIn !== 'true') {
        window.location.href = 'index.html';
        return;
    }
    
    // Setup keyboard detection for mobile devices
    setupKeyboardDetection();
    
    // Initialize state
    let selectedReportType = '';
    let selectedMainType = '';
    let userCurrency = await mobileStorage.getItem('currency') || '$';
    
    // Set default dates (last 30 days)
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    document.getElementById('date-from').value = thirtyDaysAgo.toISOString().split('T')[0];
    document.getElementById('date-to').value = today.toISOString().split('T')[0];
    
    // Set up orientation change handling
    window.addEventListener('orientationchange', handleOrientationChange);
    
    // Add event listeners
    setupEventListeners();
    
    // Initialize currency format - fix error with currency trim
    const currencyFormatter = new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: typeof userCurrency === 'string' ? userCurrency.trim() || 'USD' : 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    
    function setupKeyboardDetection() {
        // For iOS using visual viewport API
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', () => {
                // The viewport size gets smaller when the keyboard appears
                const currentHeight = window.visualViewport.height;
                const windowHeight = window.innerHeight;
                
                if (currentHeight < windowHeight * 0.8) {
                    // Keyboard is likely visible
                    document.body.classList.add('keyboard-open');
                } else {
                    // Keyboard is likely hidden
                    document.body.classList.remove('keyboard-open');
                }
            });
        } else {
            // Fallback for other devices - use focus/blur events
            document.addEventListener('focusin', (e) => {
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
                    document.body.classList.add('keyboard-open');
                }
            });
            
            document.addEventListener('focusout', (e) => {
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
                    // Small delay to prevent flashing during focus changes between inputs
                    setTimeout(() => {
                        if (document.activeElement.tagName !== 'INPUT' && 
                            document.activeElement.tagName !== 'TEXTAREA' && 
                            document.activeElement.tagName !== 'SELECT') {
                            document.body.classList.remove('keyboard-open');
                        }
                    }, 100);
                }
            });
        }
    }
    
    function handleOrientationChange() {
        // Adjust UI for different orientations
        if (window.orientation === 90 || window.orientation === -90) {
            // Landscape mode
            document.querySelector('.date-range')?.classList.add('landscape');
            
            // Adjust table display for landscape
            const reportTables = document.querySelectorAll('.report-table');
            reportTables.forEach(table => {
                table.style.minWidth = "auto";
            });
        } else {
            // Portrait mode
            document.querySelector('.date-range')?.classList.remove('landscape');
            
            // Optimize table display for portrait view - no min-width that forces scrolling
            const reportTables = document.querySelectorAll('.report-table');
            reportTables.forEach(table => {
                table.style.minWidth = "auto";
            });
        }
    }
    
    function setupEventListeners() {
        // Add event listeners for all report type selects
        document.getElementById('animal-report-type')?.addEventListener('change', handleReportTypeChange);
        document.getElementById('feed-report-type')?.addEventListener('change', handleReportTypeChange);
        document.getElementById('health-report-type')?.addEventListener('change', handleReportTypeChange);
        document.getElementById('category-filter')?.addEventListener('change', handleCategoryChange);
        
        // Fix for generate report button - add console log and make sure handler is attached
        const generateReportBtn = document.getElementById('generate-report');
        if (generateReportBtn) {
            console.log('Adding event listener to Generate Report button');
            generateReportBtn.addEventListener('click', handleGenerateReport);
            // Add a direct event for testing
            generateReportBtn.onclick = function() {
                console.log('Generate Report clicked via onclick');
                handleGenerateReport();
            };
        } else {
            console.error('Generate Report button not found in the DOM');
        }
    }
    
    function handleReportTypeChange(event) {
        // Clear other selects
        const reportSelects = ['animal-report-type', 'feed-report-type', 'health-report-type'];
        reportSelects.forEach(id => {
            if (id !== event.target.id && document.getElementById(id)) {
                document.getElementById(id).value = '';
            }
        });
        
        selectedReportType = event.target.value;
        selectedMainType = event.target.id.split('-')[0]; // 'animal', 'feed', or 'health'
        
        console.log('Report type changed:', {
            type: selectedReportType,
            mainType: selectedMainType
        });
        
        // Clear any previous report results
        clearPreviousReportResults();
        
        updateCategoryOptions();
    }
    
    function clearPreviousReportResults() {
        // Clear the report content area
        document.querySelector('.report-content').innerHTML = 
            '<div class="empty-state">Select report criteria and click Generate Report</div>';
    }
    
    async function updateCategoryOptions() {
        const categorySelect = document.getElementById('category-filter');
        const categoryHelp = document.querySelector('.help-text');
        
        if (!categorySelect || !categoryHelp) return;
        
        // Clear existing options
        categorySelect.innerHTML = '<option value="all">All Categories</option>';
        
        if (!selectedMainType) {
            categorySelect.disabled = true;
            categoryHelp.textContent = 'Select a report type to see relevant categories';
            return;
        }
        
        try {
            let categories = [];
            
            // Get categories based on main type
            switch (selectedMainType) {
                case 'animal':
                    categories = await getAnimalCategories();
                    categoryHelp.textContent = 'Filter by animal category';
                    break;
                case 'feed':
                    // Get feed categories from storage
                    const feedCategoriesStr = await mobileStorage.getItem('feedCategories');
                    categories = feedCategoriesStr ? JSON.parse(feedCategoriesStr) : [];
                    categoryHelp.textContent = 'Filter by feed type';
                    break;
                case 'health':
                    // Health categories are the same as animal categories
                    categories = await getAnimalCategories();
                    categoryHelp.textContent = 'Filter by animal category';
                    break;
            }
            
            console.log('Retrieved categories:', categories);
            
            // Add categories to select
            categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = category;
                categorySelect.appendChild(option);
            });
            
            // Store the category type to ensure proper filtering
            categorySelect.dataset.categoryType = selectedMainType;
            
            categorySelect.disabled = false;
        } catch (error) {
            console.error('Error updating categories:', error);
            categorySelect.disabled = true;
            categoryHelp.textContent = 'Error loading categories';
        }
    }
    
    function handleCategoryChange() {
        // No automatic report generation
    }
    
    async function handleGenerateReport() {
        console.log('handleGenerateReport function called');
        const filters = collectFilters();
        
        console.log('Generate report clicked', {
            reportType: selectedReportType,
            mainType: selectedMainType,
            filters
        });
        
        if (!selectedReportType) {
            alert('Please select a report type');
            return;
        }
        
        try {
            console.log('Collecting report data...');
            const reportData = await collectReportData(filters);
            console.log('Report data collected:', reportData ? reportData.length : 0, 'records');
            
            if (!reportData || reportData.length === 0) {
                document.querySelector('.report-content').innerHTML = 
                    '<div class="empty-state">No records found for the selected criteria</div>';
                return;
            }
            
            console.log('Displaying report...');
            displayReport(reportData, filters);
        } catch (error) {
            console.error('Error generating report:', error);
            document.querySelector('.report-content').innerHTML = 
                `<div class="empty-state">Error generating report: ${error.message}</div>`;
        }
    }
    
    function collectFilters() {
        return {
            reportType: selectedReportType,
            mainType: selectedMainType,
            category: document.getElementById('category-filter').value,
            dateRange: {
                start: document.getElementById('date-from').value,
                end: document.getElementById('date-to').value
            }
        };
    }
    
    async function collectReportData(filters) {
        let allRecords = [];
        // Declare a variable to hold feed categories at the top level of the function scope
        let feedCategoriesGlobal = [];
        
        try {
            console.log('Starting data collection:', filters);
            
            // Debug: Log all storage keys to check what data is available
            console.log('-------- DEBUG STORAGE DATA START --------');
            
            // Get ALL possible data sources first to ensure nothing is missed
            const dataSourceKeys = [
                'recentActivities',
                'animalInventory',
                'stockDiscrepancies',
                'animalPurchases',
                'animalSales',
                'animalMovements',
                'feedTransactions',
                'feedInventory',
                'feedCategories',
                'healthRecords',
                'animalCategories',
                'userTransactions',
                'allActivities'
            ];
            
            // Create an object to hold all data
            const allDataSources = {};
            
            // Load all possible data sources
            for (const key of dataSourceKeys) {
                try {
                    const value = await mobileStorage.getItem(key);
                    if (value) {
                        allDataSources[key] = value;
                        console.log(`Found data for ${key}: ${value.length} characters`);
                        
                        try {
                            const parsed = JSON.parse(value);
                            if (Array.isArray(parsed)) {
                                console.log(`${key} contains ${parsed.length} records`);
                                if (parsed.length > 0) {
                                    console.log(`Sample ${key} record:`, parsed[0]);
                                }
                            } else if (typeof parsed === 'object') {
                                console.log(`${key} contains ${Object.keys(parsed).length} keys`);
                            }
                        } catch (e) {
                            console.error(`Error parsing ${key}:`, e);
                        }
                    } else {
                        console.log(`No data found for ${key}`);
                    }
                } catch (e) {
                    console.error(`Error retrieving ${key}:`, e);
                }
            }
            
            console.log('-------- DEBUG STORAGE DATA END --------');
            
            // Get all relevant records based on main type
            switch (filters.mainType) {
                case 'animal':
                    // Get data from all relevant sources
                    const activitiesStr = allDataSources.recentActivities || await mobileStorage.getItem('recentActivities');
                    const inventoryStr = allDataSources.animalInventory || await mobileStorage.getItem('animalInventory');
                    const discrepanciesStr = allDataSources.stockDiscrepancies || await mobileStorage.getItem('stockDiscrepancies');
                    const purchasesStr = allDataSources.animalPurchases || await mobileStorage.getItem('animalPurchases');
                    const salesStr = allDataSources.animalSales || await mobileStorage.getItem('animalSales');
                    const movementsStr = allDataSources.animalMovements || await mobileStorage.getItem('animalMovements');
                    
                    // Also check for transactions in userTransactions that might contain animal data
                    const userTransactionsStr = allDataSources.userTransactions || await mobileStorage.getItem('userTransactions');
                    
                    // Parse all the data
                    const activities = activitiesStr ? JSON.parse(activitiesStr) : [];
                    const animalInventory = inventoryStr ? JSON.parse(inventoryStr) : {};
                    const stockDiscrepancies = discrepanciesStr ? JSON.parse(discrepanciesStr) : [];
                    const purchases = purchasesStr ? JSON.parse(purchasesStr) : [];
                    const sales = salesStr ? JSON.parse(salesStr) : [];
                    const movements = movementsStr ? JSON.parse(movementsStr) : [];
                    const userTransactions = userTransactionsStr ? JSON.parse(userTransactionsStr) : [];
                    
                    console.log('Raw activity data:', activities.length);
                    console.log('Purchases data:', purchases.length);
                    console.log('Sales data:', sales.length);
                    console.log('Movements data:', movements.length);
                    console.log('Discrepancies data:', stockDiscrepancies.length);
                    console.log('User transactions:', userTransactions.length);
                    
                    // Get animal categories for later use
                    const animalCategories = await getAnimalCategories();
                    // Get feed categories to help with filtering out feed records
                    const feedCategoriesStr = allDataSources.feedCategories || await mobileStorage.getItem('feedCategories');
                    const feedCategories = feedCategoriesStr ? JSON.parse(feedCategoriesStr) : [];
                    // Store in the function-level variable for use later
                    feedCategoriesGlobal = feedCategories;

                    // Filter userTransactions for animal-related transactions
                    const animalTransactions = userTransactions.filter(transaction => {
                        if (!transaction) return false;
                        
                        // Check if this is an animal transaction
                        const isAnimalTransaction = 
                            (transaction.type === 'purchase' || transaction.type === 'sale' || 
                             transaction.type === 'movement') && 
                            (!transaction.category || !transaction.category.toLowerCase().includes('feed'));
                            
                        return isAnimalTransaction;
                    });
                    
                    console.log('Animal transactions from userTransactions:', animalTransactions.length);

                    // Process animal transaction records
                    let transactionRecords = [];
                    
                    // Process purchases - first from dedicated purchases array
                    if (purchases && purchases.length > 0) {
                        console.log('Processing', purchases.length, 'animal purchases');
                        purchases.forEach(purchase => {
                            // Ensure cost is a proper number
                            const cost = parseFloat(purchase.cost || 0);
                            
                            transactionRecords.push({
                                type: 'purchase',
                                date: purchase.date,
                                category: purchase.category,
                                quantity: purchase.quantity,
                                cost: cost, // Ensure cost is a number
                                description: `Purchased ${purchase.quantity} ${purchase.category} for ${formatCurrency(cost)}`,
                                recordMainType: 'animal'
                            });
                        });
                    }
                    
                    // Also check for purchases in userTransactions
                    animalTransactions.forEach(transaction => {
                        if (transaction.type === 'purchase') {
                            const cost = parseFloat(transaction.cost || 0);
                            
                            transactionRecords.push({
                                type: 'purchase',
                                date: transaction.date,
                                category: transaction.category,
                                quantity: transaction.quantity,
                                cost: cost,
                                description: `Purchased ${transaction.quantity} ${transaction.category} for ${formatCurrency(cost)}`,
                                recordMainType: 'animal'
                            });
                        }
                    });
                    
                    console.log('Total purchases after combining sources:', 
                        transactionRecords.filter(r => r.type === 'purchase').length);
                    
                    // Process sales from dedicated sales array
                    if (sales && sales.length > 0) {
                        console.log('Processing', sales.length, 'animal sales');
                        sales.forEach(sale => {
                            // Ensure revenue is a proper number
                            const revenue = parseFloat(sale.revenue || 0);
                            
                            transactionRecords.push({
                                type: 'sale',
                                date: sale.date,
                                category: sale.category,
                                quantity: sale.quantity,
                                revenue: revenue, // Ensure revenue is a number
                                description: `Sold ${sale.quantity} ${sale.category} for ${formatCurrency(revenue)}`,
                                recordMainType: 'animal'
                            });
                        });
                    }
                    
                    // Also check for sales in userTransactions
                    animalTransactions.forEach(transaction => {
                        if (transaction.type === 'sale') {
                            const revenue = parseFloat(transaction.revenue || 0);
                            
                            transactionRecords.push({
                                type: 'sale',
                                date: transaction.date,
                                category: transaction.category,
                                quantity: transaction.quantity,
                                revenue: revenue,
                                description: `Sold ${transaction.quantity} ${transaction.category} for ${formatCurrency(revenue)}`,
                                recordMainType: 'animal'
                            });
                        }
                    });
                    
                    console.log('Total sales after combining sources:', 
                        transactionRecords.filter(r => r.type === 'sale').length);
                    
                    // Process movements from dedicated movements array
                    if (movements && movements.length > 0) {
                        console.log('Processing', movements.length, 'animal movements');
                        movements.forEach(movement => {
                            transactionRecords.push({
                                type: 'movement',
                                date: movement.date,
                                fromCategory: movement.fromCategory,
                                toCategory: movement.toCategory,
                                quantity: movement.quantity,
                                description: `Moved ${movement.quantity} from ${movement.fromCategory} to ${movement.toCategory}`,
                                recordMainType: 'animal'
                            });
                        });
                    }
                    
                    // Also check for movements in userTransactions
                    animalTransactions.forEach(transaction => {
                        if (transaction.type === 'movement') {
                            transactionRecords.push({
                                type: 'movement',
                                date: transaction.date,
                                fromCategory: transaction.fromCategory,
                                toCategory: transaction.toCategory,
                                quantity: transaction.quantity,
                                description: `Moved ${transaction.quantity} from ${transaction.fromCategory} to ${transaction.toCategory}`,
                                recordMainType: 'animal'
                            });
                        }
                    });
                    
                    console.log('Total movements after combining sources:', 
                        transactionRecords.filter(r => r.type === 'movement').length);
                    
                    // Process discrepancies separately
                    let discrepancyRecords = [];
                    if (stockDiscrepancies && stockDiscrepancies.length > 0) {
                        console.log('Processing', stockDiscrepancies.length, 'stock discrepancies');
                        let skippedCount = 0;
                        
                        stockDiscrepancies.forEach(discrepancy => {
                            // Skip resolved discrepancies (unless specifically looking for them)
                            if (discrepancy.resolved && filters.reportType !== 'animal-discrepancy') {
                                skippedCount++;
                                return;
                            }
                            
                            discrepancyRecords.push({
                                type: 'discrepancy',
                                date: discrepancy.date,
                                category: discrepancy.category,
                                expected: discrepancy.expected,
                                actual: discrepancy.actual,
                                difference: discrepancy.difference,
                                resolved: discrepancy.resolved,
                                description: `Count discrepancy of ${discrepancy.difference > 0 ? '+' : ''}${discrepancy.difference} ${discrepancy.category}`,
                                notes: discrepancy.notes,
                                recordMainType: 'animal'
                            });
                        });
                        
                        console.log('Added', discrepancyRecords.length, 'discrepancy records, skipped', skippedCount, 'resolved records');
                    }
                    
                    console.log('Transactions processed:', transactionRecords.length);
                    console.log('Discrepancies processed:', discrepancyRecords.length);
                    
                    // Filter animal-related activities
                    allRecords = activities.filter(activity => {
                        // Check if it's an animal-related activity
                        if (typeof activity === 'string') {
                            // Handle string-based activities
                            const activityLower = activity.toLowerCase();
                            
                            // Make sure it's an animal record and NOT a feed or health record
                            const isAnimalRecord = activityLower.includes('moved') ||
                                activityLower.includes('purchased') ||
                                activityLower.includes('sold') ||
                                activityLower.includes('death') ||
                                activityLower.includes('birth') ||
                                activityLower.includes('stock count');
                                
                            const isFeedRecord = activityLower.includes('feed');
                            const isHealthRecord = activityLower.includes('treatment') || 
                                                  activityLower.includes('vaccination') || 
                                                  activityLower.includes('medication') ||
                                                  activityLower.includes('health');
                            
                            return isAnimalRecord && !isFeedRecord && !isHealthRecord;
                        } else if (activity && typeof activity === 'object') {
                            // Handle object-based activities
                            const isAnimalRecord = activity.type === 'movement' ||
                                activity.type === 'purchase' ||
                                activity.type === 'sale' ||
                                activity.type === 'death' ||
                                activity.type === 'birth' ||
                                activity.type === 'stock-count' ||
                                activity.type === 'count-correction' ||
                                // Also check description for older records
                                (activity.description && (
                                    activity.description.toLowerCase().includes('moved') ||
                                    activity.description.toLowerCase().includes('purchased') ||
                                    activity.description.toLowerCase().includes('sold') ||
                                    activity.description.toLowerCase().includes('death') ||
                                    activity.description.toLowerCase().includes('birth') ||
                                    activity.description.toLowerCase().includes('stock count')
                                ));
                                
                            // Exclude feed records by checking:
                            // 1. If category contains "feed"
                            // 2. If fromCategory contains "feed"
                            // 3. If toCategory contains "feed"
                            // 4. If description contains "feed"
                            // 5. If category is in the list of feed categories
                            const isFeedRecord = 
                                (activity.category && (
                                    activity.category.toLowerCase().includes('feed') ||
                                    feedCategories.includes(activity.category)
                                )) ||
                                (activity.fromCategory && (
                                    activity.fromCategory.toLowerCase().includes('feed') ||
                                    feedCategories.includes(activity.fromCategory)
                                )) ||
                                (activity.toCategory && (
                                    activity.toCategory.toLowerCase().includes('feed') ||
                                    feedCategories.includes(activity.toCategory)
                                )) ||
                                (activity.description && activity.description.toLowerCase().includes('feed'));
                                
                            const isHealthRecord = 
                                activity.type === 'treatment' || 
                                activity.type === 'vaccination' || 
                                activity.type === 'medication' ||
                                activity.type === 'health-record' ||
                                (activity.description && (
                                    activity.description.toLowerCase().includes('treatment') ||
                                    activity.description.toLowerCase().includes('vaccination') ||
                                    activity.description.toLowerCase().includes('medication') ||
                                    activity.description.toLowerCase().includes('health')
                                ));
                                
                            return isAnimalRecord && !isFeedRecord && !isHealthRecord;
                        }
                        return false;
                    }).map(activity => {
                        // Convert string activities to objects if needed
                        if (typeof activity === 'string') {
                            return parseActivityString(activity);
                        }
                        
                        // Ensure record has a category - use first category as default if needed
                        if (!activity.category && !activity.fromCategory && !activity.toCategory) {
                            activity.category = animalCategories[0] || 'General';
                        }
                        
                        // One final check to ensure no feed categories slip through
                        if (activity.category && feedCategories.includes(activity.category)) {
                            // Skip this record as it's a feed record
                            return null;
                        }
                        
                        // For stock-count activities, add expected and actual values from inventory if available
                        if (activity.type === 'stock-count' && activity.category && animalInventory) {
                            // Check if we have inventory data for this category
                            const categoryInventory = animalInventory[activity.category];
                            if (categoryInventory) {
                                // Add expected count (the previous count before this stock count)
                                if (!activity.expected && categoryInventory.count !== undefined) {
                                    activity.expected = categoryInventory.count;
                                }
                                
                                // Ensure actual is set from quantity if available
                                if (!activity.actual && activity.quantity !== undefined) {
                                    activity.actual = activity.quantity;
                                }
                            }
                        }
                        
                        // Ensure type is properly set for key animal activities
                        // This fixes cases where the type might be missing or using a different format
                        if (activity.description) {
                            const desc = activity.description.toLowerCase();
                            if (!activity.type || activity.type === '') {
                                if (desc.includes('purchased') || desc.includes('bought')) {
                                    activity.type = 'purchase';
                                } else if (desc.includes('sold') || desc.includes('sale')) {
                                    activity.type = 'sale';
                                } else if (desc.includes('moved') || desc.includes('movement')) {
                                    activity.type = 'movement';
                                } else if (desc.includes('birth') || desc.includes('born')) {
                                    activity.type = 'birth';
                                } else if (desc.includes('death') || desc.includes('died')) {
                                    activity.type = 'death';
                                } else if (desc.includes('stock count') || desc.includes('counted')) {
                                    activity.type = 'stock-count';
                                }
                            }
                        }
                        
                        // Mark this as an animal record for filtering
                        return {...activity, recordMainType: 'animal'};
                    }).filter(record => record !== null); // Remove any null records
                    
                    console.log('Mapped animal records:', allRecords.length);
                    console.log('Sample animal records:', allRecords.slice(0, 3));
                    
                    // Add stock discrepancies
                    if (stockDiscrepancies && Array.isArray(stockDiscrepancies)) {
                        allRecords = [...allRecords, ...stockDiscrepancies
                            .filter(record => {
                                // Ensure no feed records in discrepancies
                                if (record.category) {
                                    return !record.category.toLowerCase().includes('feed') && 
                                           !feedCategories.includes(record.category);
                                }
                                return true;
                            })
                            .map(record => {
                                // Ensure record has a category
                                if (!record.category && !record.fromCategory && !record.toCategory) {
                                    record.category = animalCategories[0] || 'General';
                                }
                                return {...record, recordMainType: 'animal'};
                            })];
                    }
                    
                    // Combine all animal records
                    allRecords = [...allRecords, ...transactionRecords, ...discrepancyRecords];
                    
                    console.log('Combined records count:', allRecords.length);
                    break;
                    
                case 'feed':
                    // Load feed data
                    const feedInventoryStr = await mobileStorage.getItem('feedInventory');
                    // Use a different variable name to avoid redeclaration
                    const feedCategoriesData = await mobileStorage.getItem('feedCategories');
                    const feedTransactionsStr = await mobileStorage.getItem('feedTransactions');
                    
                    const feedInventory = feedInventoryStr ? JSON.parse(feedInventoryStr) : {};
                    const feedCategoriesList = feedCategoriesData ? JSON.parse(feedCategoriesData) : [];
                    const feedTransactions = feedTransactionsStr ? JSON.parse(feedTransactionsStr) : [];
                    
                    // Default category if none available
                    const defaultFeedCategory = feedCategoriesList.length > 0 ? feedCategoriesList[0] : 'Feed';
                    
                    // Also check recentActivities for feed-related entries
                    const allActivitiesStr = await mobileStorage.getItem('recentActivities');
                    const allActivities = allActivitiesStr ? JSON.parse(allActivitiesStr) : [];
                    
                    // Filter out feed-related activities from recentActivities
                    const feedActivities = allActivities.filter(activity => {
                        if (typeof activity === 'string') {
                            const activityLower = activity.toLowerCase();
                            return activityLower.includes('feed');
                        } else if (activity && typeof activity === 'object') {
                            return (activity.category && activity.category.toLowerCase().includes('feed')) ||
                                (activity.description && activity.description.toLowerCase().includes('feed'));
                        }
                        return false;
                    }).map(activity => {
                        // Convert string activities to objects if needed
                        if (typeof activity === 'string') {
                            const parsed = parseActivityString(activity);
                            // Ensure feed activities have a category and cost
                            if (!parsed.category) {
                                parsed.category = defaultFeedCategory;
                            }
                            if (parsed.type === 'purchase' && !parsed.cost) {
                                parsed.cost = 0;
                            }
                            return parsed;
                        }
                        
                        // Ensure feed activities have a category and cost
                        if (!activity.category) {
                            activity.category = defaultFeedCategory;
                        }
                        if (activity.type === 'purchase' && !activity.cost) {
                            activity.cost = 0;
                        }
                        
                        // Mark as feed record for filtering
                        return {...activity, recordMainType: 'feed'};
                    });
                    
                    // Ensure feed transactions have categories and costs
                    const processedFeedTransactions = feedTransactions.map(record => {
                        const processedRecord = {...record};
                        if (!processedRecord.category) {
                            processedRecord.category = defaultFeedCategory;
                        }
                        if (processedRecord.type === 'purchase' && !processedRecord.cost) {
                            processedRecord.cost = 0;
                        }
                        return {...processedRecord, recordMainType: 'feed'};
                    });
                    
                    // Combine feed transactions with feed activities
                    const combinedFeedRecords = [
                        ...processedFeedTransactions, 
                        ...feedActivities
                    ];
                    
                    // Filter feed records based on report type
                    switch (filters.reportType) {
                        case 'all-feed':
                            allRecords = combinedFeedRecords;
                            break;
                        case 'feed-purchase':
                            allRecords = combinedFeedRecords.filter(t => 
                                t.type === 'purchase' || 
                                (t.description && t.description.toLowerCase().includes('purchased'))
                            );
                            break;
                        case 'feed-usage':
                            allRecords = combinedFeedRecords.filter(t => 
                                t.type === 'usage' || 
                                t.type === 'consumption' ||
                                (t.description && (
                                    t.description.toLowerCase().includes('used') ||
                                    t.description.toLowerCase().includes('consumed')
                                ))
                            );
                            break;
                        case 'feed-inventory':
                        allRecords = feedCategoriesList.map(category => {
                            const data = feedInventory[category] || {};
                            return {
                                type: 'inventory',
                                date: data.lastUpdated || new Date().toISOString(),
                                category: category,
                                quantity: data.quantity || 0,
                                unit: data.unit || 'kg',
                                threshold: data.threshold || 0,
                                supplier: data.supplier || 'Not specified',
                                unitCost: data.price || data.lastUnitCost || 0,
                                totalValue: (data.price || data.lastUnitCost || 0) * (data.quantity || 0),
                                recordMainType: 'feed'
                            };
                        });
                            break;
                        default:
                            allRecords = [];
                    }
                    break;
                    
                case 'health':
                    // Get health records
                    const healthRecordsStr = await mobileStorage.getItem('healthRecords');
                    const healthRecords = healthRecordsStr ? JSON.parse(healthRecordsStr) : [];
                    
                    // Get animal categories for health records
                    const animalCategoriesForHealth = await getAnimalCategories();
                    const defaultHealthCategory = animalCategoriesForHealth.length > 0 ? animalCategoriesForHealth[0] : 'Animals';
                    
                    // Also check recentActivities for health-related entries
                    const healthActivitiesStr = await mobileStorage.getItem('recentActivities');
                    const healthActivities = healthActivitiesStr ? JSON.parse(healthActivitiesStr) : [];
                    
                    // Filter out health-related activities from recentActivities
                    const healthOnly = healthActivities.filter(activity => {
                        if (typeof activity === 'string') {
                            const activityLower = activity.toLowerCase();
                            return activityLower.includes('treatment') || 
                                   activityLower.includes('vaccination') || 
                                   activityLower.includes('medication') ||
                                   activityLower.includes('health');
                        } else if (activity && typeof activity === 'object') {
                            return (activity.type === 'treatment' || 
                                   activity.type === 'vaccination' || 
                                   activity.type === 'medication') ||
                                   (activity.description && (
                                       activity.description.toLowerCase().includes('treatment') ||
                                       activity.description.toLowerCase().includes('vaccination') ||
                                       activity.description.toLowerCase().includes('medication') ||
                                       activity.description.toLowerCase().includes('health')
                                   ));
                        }
                        return false;
                    }).map(activity => {
                        // Convert string activities to objects if needed
                        if (typeof activity === 'string') {
                            const parsed = parseActivityString(activity);
                            // Ensure health records have a category
                            if (!parsed.category) {
                                parsed.category = defaultHealthCategory;
                            }
                            return parsed;
                        }
                        
                        // Ensure health records have a category
                        if (!activity.category) {
                            activity.category = defaultHealthCategory;
                        }
                        
                        // Mark as health record for filtering
                        return {...activity, recordMainType: 'health'};
                    });
                    
                    // Ensure health records have categories
                    const processedHealthRecords = healthRecords.map(record => {
                        const processedRecord = {...record};
                        if (!processedRecord.category) {
                            processedRecord.category = defaultHealthCategory;
                        }
                        return {...processedRecord, recordMainType: 'health'};
                    });
                    
                    // Combine health records with health activities
                    const combinedHealthRecords = [
                        ...processedHealthRecords, 
                        ...healthOnly
                    ];
                    
                    // Filter health records based on report type
                    switch (filters.reportType) {
                        case 'all-health':
                            allRecords = combinedHealthRecords;
                            break;
                        case 'health-treatment':
                            allRecords = combinedHealthRecords.filter(r => 
                                r.type === 'treatment' || 
                                (r.description && r.description.toLowerCase().includes('treatment'))
                            );
                            break;
                        case 'health-vaccination':
                            allRecords = combinedHealthRecords.filter(r => 
                                r.type === 'vaccination' || 
                                (r.description && r.description.toLowerCase().includes('vaccination'))
                            );
                            break;
                        case 'health-medication':
                            allRecords = combinedHealthRecords.filter(r => 
                                r.type === 'medication' || 
                                (r.description && r.description.toLowerCase().includes('medication'))
                            );
                            break;
                        default:
                            allRecords = [];
                    }
                    break;
            }
            
            // Filter records by date range
            const startDate = new Date(filters.dateRange.start);
            const endDate = new Date(filters.dateRange.end);
            endDate.setHours(23, 59, 59, 999); // Include the entire end date
            
            let filteredRecords = allRecords.filter(record => {
                if (!record || !record.date) return false;
                
                const recordDate = new Date(record.date);
                return recordDate >= startDate && recordDate <= endDate;
            });
            
            // Filter by category if specified - ensure we only filter within the current main type
            if (filters.category !== 'all') {
                filteredRecords = filteredRecords.filter(record => {
                    if (!record) return false;
                    
                    // First verify this record belongs to the current main type
                    // This prevents cross-filtering between different record types
                    if (record.recordMainType && record.recordMainType !== filters.mainType) {
                        return false;
                    }
                    
                    // Handle different record structures
                    const recordCategory = record.category || record.fromCategory || record.toCategory;
                    if (!recordCategory) return false;
                    
                    return recordCategory.toLowerCase() === filters.category.toLowerCase();
                });
            }
            
            // Apply type filtering even if 'all-' type is selected
            if (filters.mainType === 'animal') {
                console.log('Pre-filter records for animal main type:', filteredRecords.length);
                
                // Log distribution of record types before filtering
                const typeCounts = {};
                filteredRecords.forEach(record => {
                    if (record && record.type) {
                        typeCounts[record.type] = (typeCounts[record.type] || 0) + 1;
                    }
                });
                console.log('Record types before filtering:', typeCounts);
                
                // First filter out non-animal records and feed categories
                filteredRecords = filteredRecords.filter(record => {
                    if (!record) {
                        console.log('Skipping null/undefined record');
                        return false;
                    }
                    
                    if (!record.type) {
                        console.log('Skipping record with no type:', record);
                        return false;
                    }
                    
                    // Double check feed categories aren't included
                    const recordCategory = record.category || record.fromCategory || record.toCategory;
                    if (recordCategory && 
                        (recordCategory.toLowerCase().includes('feed') || feedCategoriesGlobal.includes(recordCategory))) {
                        console.log('Skipping feed record:', record);
                        return false;
                    }
                    
                    // Fixed handling for all-animal case to include ALL animal record types
                    if (filters.reportType === 'all-animal') {
                        const validTypes = ['movement', 'purchase', 'sale', 'death', 'birth', 'stock-count', 'count-correction', 'discrepancy'];
                        const isValidType = validTypes.includes(record.type);
                        
                        // Log more details about the record for debugging
                        if (!isValidType) {
                            console.log('Skipping non-animal record type:', record.type, record);
                        }
                        
                        return isValidType;
                    }
                    
                    // For specific animal report types, apply additional filtering
                    const specificType = filters.reportType.split('-')[1]; // 'movement', 'purchase', etc.
                    switch (specificType) {
                        case 'movement':
                            return record.type === 'movement';
                        case 'purchase':
                            return record.type === 'purchase';
                        case 'sale':
                            return record.type === 'sale';
                        case 'death':
                            return record.type === 'death';
                        case 'birth':
                            return record.type === 'birth';
                        case 'count':
                            return record.type === 'stock-count' || record.type === 'count-correction';
                        case 'discrepancy':
                            return record.type === 'discrepancy';
                        default:
                            // Default case - should not reach here but included for safety
                            console.log('Unknown animal record type:', specificType);
                            return ['movement', 'purchase', 'sale', 'death', 'birth', 'stock-count', 'count-correction', 'discrepancy'].includes(record.type);
                    }
                });
                
                console.log('Post-filter records for animal main type:', filteredRecords.length);
                
                // Log distribution of record types after filtering
                const filteredTypeCounts = {};
                filteredRecords.forEach(record => {
                    if (record && record.type) {
                        filteredTypeCounts[record.type] = (filteredTypeCounts[record.type] || 0) + 1;
                    }
                });
                console.log('Record types after filtering:', filteredTypeCounts);
                
                // Debug: Show sample records for each type to verify data
                console.log('-------- SAMPLE RECORDS BY TYPE --------');
                ['movement', 'purchase', 'sale', 'death', 'birth', 'stock-count', 'discrepancy'].forEach(recordType => {
                    const typeRecords = filteredRecords.filter(r => r.type === recordType);
                    if (typeRecords.length > 0) {
                        console.log(`${recordType} sample:`, typeRecords[0]);
                    } else {
                        console.log(`No ${recordType} records found after filtering`);
                    }
                });
                console.log('-------- END SAMPLE RECORDS --------');
            } else if (!filters.reportType.startsWith('all-')) {
                // Filter by specific type for non-all reports
                const specificType = filters.reportType.split('-')[1]; // 'movement', 'purchase', etc.
                filteredRecords = filteredRecords.filter(record => {
                    if (!record || !record.type) return false;
                    
                    // Filter by specific record types
                    switch (specificType) {
                        case 'movement':
                            return record.type === 'movement';
                        case 'purchase':
                            return record.type === 'purchase';
                        case 'sale':
                            return record.type === 'sale';
                        case 'death':
                            return record.type === 'death';
                        case 'birth':
                            return record.type === 'birth';
                        case 'count':
                            return record.type === 'stock-count' || record.type === 'count-correction';
                        case 'usage':
                            return record.type === 'usage' || record.type === 'consumption';
                        case 'treatment':
                            return record.type === 'treatment';
                        case 'vaccination':
                            return record.type === 'vaccination';
                        case 'medication':
                            return record.type === 'medication';
                        case 'inventory':
                            return record.type === 'inventory';
                        default:
                            return false;
                    }
                });
            }
            
            // Sort records by date (newest first)
            filteredRecords.sort((a, b) => {
                if (!a.date) return 1;
                if (!b.date) return -1;
                return new Date(b.date) - new Date(a.date);
            });
            
            return filteredRecords;
        } catch (error) {
            console.error('Error collecting report data:', error);
            throw error;
        }
    }
    
    function parseActivityString(activity) {
        const date = new Date().toISOString(); // Default to current date if not found
        
        let result = {
            date: date,
            description: activity
        };
        
        // Simple parsing logic for string activities
        const activityLower = activity.toLowerCase();
        
        if (activityLower.includes('moved')) {
            result.type = 'movement';
        } else if (activityLower.includes('purchased')) {
            result.type = 'purchase';
        } else if (activityLower.includes('sold')) {
            result.type = 'sale';
        } else if (activityLower.includes('death')) {
            result.type = 'death';
        } else if (activityLower.includes('birth')) {
            result.type = 'birth';
        } else if (activityLower.includes('stock count')) {
            result.type = 'stock-count';
        }
        
        // Try to extract quantity
        const quantityMatch = activity.match(/(\d+)/);
        if (quantityMatch) {
            result.quantity = parseInt(quantityMatch[1]);
        }
        
        // Try to extract category
        const categoryPatterns = [
            /moved (\d+) (.+?) to/i,
            /purchased (\d+) (.+?) for/i,
            /sold (\d+) (.+?) for/i,
            /recorded (\d+) (.+?) deaths/i,
            /recorded birth of (\d+) (.+?)( |$)/i
        ];
        
        for (const pattern of categoryPatterns) {
            const match = activity.match(pattern);
            if (match && match[2]) {
                result.category = match[2].trim();
                break;
            }
        }
        
        return result;
    }
    
    function formatRecordType(type) {
        if (!type) return 'Unknown';
        
        switch (type.toLowerCase()) {
            case 'movement': return 'Movement';
            case 'purchase': return 'Purchase';
            case 'sale': return 'Sale';
            case 'death': return 'Death';
            case 'birth': return 'Birth';
            case 'stock-count': return 'Stock Count';
            case 'count-correction': return 'Count Correction';
            case 'inventory': return 'Inventory';
            case 'usage': case 'consumption': return 'Usage';
            case 'treatment': return 'Treatment';
            case 'vaccination': return 'Vaccination';
            case 'medication': return 'Medication';
            case 'health-record': return 'Health Record';
            default: return type.charAt(0).toUpperCase() + type.slice(1);
        }
    }
    
    function displayReport(records, filters) {
        if (!records || records.length === 0) {
            document.querySelector('.report-content').innerHTML = '<div class="empty-state">No records found for the selected criteria</div>';
            return;
        }
        
        // Get report title
        const reportTitle = getReportTitle(filters);
        
        // Create summary data
        const summary = summarizeRecords(filters.reportType, records);
        
        // Create report content
        let reportContent = `
            <h3>${reportTitle}</h3>
            
            <div class="report-summary">
                <div class="summary-title">Summary</div>
                <div class="summary-cards">
        `;
        
        // Add summary cards
        for (const [key, value] of Object.entries(summary)) {
            reportContent += `
                <div class="summary-card">
                    <h4>${key}</h4>
                    <div class="summary-value">${value}</div>
                </div>
            `;
        }
        
        reportContent += `
                </div>
            </div>
            
            <div class="report-details">
                <div class="summary-title">Details</div>
                <div class="report-table-container">
                    <table class="report-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Type</th>
                                <th>Category</th>
                                <th>Details</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        // Add records
        records.forEach(record => {
            const date = record.date ? new Date(record.date).toLocaleDateString() : 'N/A';
            const type = formatRecordType(record.type);
            const category = record.category || record.fromCategory || record.toCategory || 'N/A';
            const details = formatDetails(record);
            
            reportContent += `
                <tr>
                    <td>${date}</td>
                    <td>${type}</td>
                    <td>${category}</td>
                    <td>${details}</td>
                </tr>
            `;
        });
        
        reportContent += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        document.querySelector('.report-content').innerHTML = reportContent;
        
        // Apply orientation-specific styling
        handleOrientationChange();
    }
    
    function getReportTitle(filters) {
        const reportTypeParts = filters.reportType.split('-');
        const isAllReport = reportTypeParts[0] === 'all';
        const mainType = reportTypeParts[isAllReport ? 1 : 0];
        const specificType = isAllReport ? 'All' : reportTypeParts[1];
        
        let title = '';
        
        // Build title based on report type
        if (mainType === 'animal') {
            title = isAllReport ? 'All Animal Records' : `Animal ${formatRecordType(specificType)}s`;
        } else if (mainType === 'feed') {
            title = isAllReport ? 'All Feed Records' : `Feed ${formatRecordType(specificType)}s`;
        } else if (mainType === 'health') {
            title = isAllReport ? 'All Health Records' : `${formatRecordType(specificType)}s`;
        }
        
        // Add category filter if specified
        if (filters.category && filters.category !== 'all') {
            title += ` - ${filters.category}`;
        }
        
        // Add date range
        const startDate = new Date(filters.dateRange.start).toLocaleDateString();
        const endDate = new Date(filters.dateRange.end).toLocaleDateString();
        title += ` (${startDate} - ${endDate})`;
        
        return title;
    }
    
    function formatDetails(record) {
        if (!record) return 'N/A';
        
        // For string records, return the description
        if (typeof record === 'string') {
            return record;
        }
        
        // For object records, format based on type
        switch (record.type) {
            case 'movement':
                return `${record.quantity || ''} from ${record.fromCategory || 'unknown'} to ${record.toCategory || 'unknown'}`;
                
            case 'purchase':
                // Safely calculate unit price and handle missing cost data
                const cost = parseFloat(record.cost || 0);
                const quantity = parseInt(record.quantity || 1, 10);
                const unitPrice = quantity > 0 ? cost / quantity : 0;
                
                // If the unit price is 0, check if there's a unitCost or price field
                let displayPrice = unitPrice;
                if (displayPrice === 0 && record.unitCost) {
                    displayPrice = parseFloat(record.unitCost);
                } else if (displayPrice === 0 && record.price) {
                    displayPrice = parseFloat(record.price);
                }
                
                return `${record.quantity || ''} @ ${formatCurrency(displayPrice)} each`;
                
            case 'sale':
                // Safely calculate unit price and handle missing revenue data
                const revenue = parseFloat(record.revenue || 0);
                const saleQuantity = parseInt(record.quantity || 1, 10);
                const unitRevenue = saleQuantity > 0 ? revenue / saleQuantity : 0;
                
                // If the unit revenue is 0, check if there's a unitPrice or price field
                let displayRevenue = unitRevenue;
                if (displayRevenue === 0 && record.unitPrice) {
                    displayRevenue = parseFloat(record.unitPrice);
                } else if (displayRevenue === 0 && record.price) {
                    displayRevenue = parseFloat(record.price);
                }
                
                return `${record.quantity || ''} @ ${formatCurrency(displayRevenue)} each`;
                
            case 'death':
                return `${record.quantity || ''}${record.reason ? `: ${record.reason}` : ''}`;
                
            case 'birth':
                return `${record.quantity || ''}${record.notes ? `: ${record.notes}` : ''}`;
                
            case 'stock-count':
                // Improved stock count details display
                const expected = record.expected !== undefined ? Number(record.expected) : 
                                 record.expectedCount !== undefined ? Number(record.expectedCount) : null;
                const actual = record.actual !== undefined ? Number(record.actual) : 
                               record.actualCount !== undefined ? Number(record.actualCount) : 
                               record.quantity !== undefined ? Number(record.quantity) : null;
                
                // If both values are null, try to get count from quantity
                if (expected === null && actual === null) {
                    if (record.quantity) {
                        // Use quantity as the actual count
                        return `Count: ${record.quantity}${record.notes ? ` - ${record.notes}` : ''}`;
                    }
                    return record.notes || 'Count performed';
                }
                
                // Calculate difference with sign
                const diff = actual !== null && expected !== null ? actual - expected : null;
                const diffStr = diff !== null ? (diff >= 0 ? `+${diff}` : `${diff}`) : 'N/A';
                
                // Format to match the shown report format
                return `${record.category}: Expected ${expected !== null ? expected : 'N/A'}, Actual ${actual !== null ? actual : 'N/A'} (${diffStr})`;
                
            case 'count-correction':
                return `Adjusted by ${record.difference > 0 ? '+' : ''}${record.difference}`;
                
            case 'inventory':
                return `${record.quantity} ${record.unit || ''}, Val: ${formatCurrency(record.totalValue)}`;
                
            case 'usage':
            case 'consumption':
                return `${record.quantity} ${record.unit || ''} - ${record.purpose || 'general'}`;
                
            case 'treatment':
                return `${record.treatment || 'Treatment'} - ${record.duration || 'N/A'} days`;
                
            case 'vaccination':
                return `${record.vaccine || 'Vaccination'}${record.nextDate ? ` Next: ${new Date(record.nextDate).toLocaleDateString()}` : ''}`;
                
            case 'medication':
                return `${record.medication || 'Medication'} ${record.dosage ? `(${record.dosage})` : ''}`;
                
            case 'health-record':
                return `${record.condition || ''}: ${record.severity || 'N/A'}`;
                
            case 'discrepancy':
                // Format for stock count discrepancy
                return `Expected: ${record.expected || 0}, ` +
                       `Actual: ${record.actual || 0}, ` +
                       `Diff: ${record.difference >= 0 ? '+' : ''}${record.difference || 0}` +
                       `${record.resolved ? ' (Resolved)' : ''}`;
                
            default:
                // If there's a description, use that
                if (record.description) {
                    return record.description;
                }
                
                // Otherwise, format quantity and notes
                let details = '';
                if (record.quantity) {
                    details += `Qty: ${record.quantity}`;
                }
                if (record.notes) {
                    details += details ? ` - ${record.notes}` : record.notes;
                }
                return details || 'No details';
        }
    }
    
    function formatCurrency(amount) {
        if (amount === undefined || amount === null) return `${userCurrency}0.00`;
        
        try {
            // Use the Intl formatter for proper currency display
            return currencyFormatter.format(Number(amount));
        } catch (e) {
            // Fallback to simple formatting if Intl fails
            return `${userCurrency}${Number(amount).toFixed(2)}`;
        }
    }
    
    function summarizeRecords(reportType, records) {
        const summary = {};
        
        // Base count
        summary['Total Records'] = records.length;
        
        // Type-specific summaries
        if (reportType.startsWith('animal-') || reportType === 'all-animal') {
            // Count by type
            const typeCount = {};
            records.forEach(record => {
                const type = record.type || 'unknown';
                typeCount[type] = (typeCount[type] || 0) + 1;
            });
            
            // Add type summaries for animal reports
            if (typeCount.movement) summary['Movements'] = typeCount.movement;
            if (typeCount.purchase) summary['Purchases'] = typeCount.purchase;
            if (typeCount.sale) summary['Sales'] = typeCount.sale;
            if (typeCount.death) summary['Deaths'] = typeCount.death;
            if (typeCount.birth) summary['Births'] = typeCount.birth;
            if (typeCount['stock-count']) summary['Stock Counts'] = typeCount['stock-count'];
            
            // Total animals
            let totalAnimals = 0;
            records.forEach(record => {
                if (record.type === 'purchase' || record.type === 'birth') {
                    totalAnimals += Number(record.quantity || 0);
                } else if (record.type === 'sale' || record.type === 'death') {
                    totalAnimals -= Number(record.quantity || 0);
                }
            });
            
            if (totalAnimals !== 0) {
                summary['Net Change'] = totalAnimals > 0 ? `+${totalAnimals}` : `${totalAnimals}`;
            }
            
        } else if (reportType.startsWith('feed-') || reportType === 'all-feed') {
            // Calculate total purchases and usage
            let totalPurchased = 0;
            let totalUsed = 0;
            let totalSpent = 0;
            
            records.forEach(record => {
                if (record.type === 'purchase') {
                    totalPurchased += Number(record.quantity || 0);
                    totalSpent += Number(record.cost || 0);
                } else if (record.type === 'usage' || record.type === 'consumption') {
                    totalUsed += Number(record.quantity || 0);
                }
            });
            
            if (totalPurchased > 0) summary['Total Purchased'] = `${totalPurchased} units`;
            if (totalUsed > 0) summary['Total Used'] = `${totalUsed} units`;
            if (totalSpent > 0) summary['Total Spent'] = formatCurrency(totalSpent);
            
        } else if (reportType.startsWith('health-') || reportType === 'all-health') {
            // Count by health record type
            const typeCount = {};
            records.forEach(record => {
                const type = record.type || 'unknown';
                typeCount[type] = (typeCount[type] || 0) + 1;
            });
            
            // Add health type summaries
            if (typeCount.treatment) summary['Treatments'] = typeCount.treatment;
            if (typeCount.vaccination) summary['Vaccinations'] = typeCount.vaccination;
            if (typeCount.medication) summary['Medications'] = typeCount.medication;
            if (typeCount['health-record']) summary['Health Records'] = typeCount['health-record'];
        }
        
        return summary;
    }
    
    async function getAnimalCategories() {
        const categoriesStr = await mobileStorage.getItem('animalCategories');
        if (categoriesStr) {
            try {
                return JSON.parse(categoriesStr);
            } catch (e) {
                console.error('Error parsing animal categories:', e);
            }
        }
        
        // If no categories found or parse error, try to get from inventory
        const inventoryStr = await mobileStorage.getItem('animalInventory');
        if (inventoryStr) {
            try {
                const inventory = JSON.parse(inventoryStr);
                const categories = Object.keys(inventory);
                if (categories.length > 0) {
                    return categories;
                }
            } catch (e) {
                console.error('Error parsing animal inventory:', e);
            }
        }
        
        // Default categories if nothing found
        return ['Cattle', 'Sheep', 'Goats', 'Pigs', 'Chickens'];
    }
}); 