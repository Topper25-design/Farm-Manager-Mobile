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
    let userCurrency = await mobileStorage.getItem('currency') || 'R';
    
    // Set default dates (last 30 days)
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    document.getElementById('date-from').value = thirtyDaysAgo.toISOString().split('T')[0];
    document.getElementById('date-to').value = today.toISOString().split('T')[0];
    
    // Set up debug panel
    setupDebugPanel();
    
    // Set up orientation change handling
    window.addEventListener('orientationchange', handleOrientationChange);
    
    // Add event listeners
    setupEventListeners();
    
    // Initialize currency format - fix error with invalid currency code
    // Store the currency symbol for display
    const currencySymbol = typeof userCurrency === 'string' ? userCurrency.trim() : 'R';
    
    // For Intl.NumberFormat, we need an ISO currency code, not just a symbol
    // Map common symbols to ISO codes or default to USD
    let currencyCode = 'ZAR'; // Default to ZAR instead of USD
    
    // Define the formatter at the global scope so it's accessible everywhere
    let currencyFormatter;
    
    try {
        console.log('User currency value:', userCurrency);
        
        if (typeof userCurrency === 'string') {
            const currencyMap = {
                '$': 'USD',
                '£': 'GBP',
                '€': 'EUR',
                '¥': 'JPY',
                '₹': 'INR',
                'R': 'ZAR',
                'R$': 'BRL'
            };
            
            const trimmedCurrency = userCurrency.trim();
            console.log('Trimmed currency symbol:', trimmedCurrency);
            
            // Only use the mapped value if it exists in our map
            if (currencyMap[trimmedCurrency]) {
                currencyCode = currencyMap[trimmedCurrency];
                console.log('Mapped to ISO code:', currencyCode);
            } else {
                // If not in our map but looks like a valid ISO code (3 letters), use it
                if (/^[A-Z]{3}$/.test(trimmedCurrency)) {
                    currencyCode = trimmedCurrency;
                    console.log('Using currency as ISO code:', currencyCode);
                } else {
                    console.log('Using default ZAR code');
                }
            }
        }
        
        // Create the formatter with a guaranteed valid ISO currency code
        console.log('Final currency code for formatter:', currencyCode);
        
        currencyFormatter = new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: currencyCode,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    } catch (e) {
        console.error('Error creating currency formatter:', e);
    }
    
    // Define the formatCurrency function to handle fallback scenarios
    function formatCurrency(amount) {
        if (amount === undefined || amount === null) return `R0.00 ZAR`;
        
        try {
            // Format currency in the requested style: "R187500.00 ZAR"
            const numAmount = Number(amount);
            const formattedAmount = numAmount.toFixed(2);
            return `R${formattedAmount} ZAR`;
        } catch (e) {
            console.error('Error formatting currency:', e);
            // Fallback to simple formatting if formatting fails
            return `R${Number(amount).toFixed(2)} ZAR`;
        }
    }
    
    // Expose formatCurrency to the window object for global access
    window.formatCurrency = formatCurrency;
    
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

                    // Process all activities looking for movement records in recentActivities since animalMovements might be empty
                    console.log('Checking for movement records in recent activities...');
                    const movementRecords = [];
                    
                    // Check if activities contains movement records
                    if (activities && activities.length > 0) {
                        activities.forEach(activity => {
                            if (!activity) return;
                            
                            // Look for explicit movement type or description containing movement keywords
                            const isMovement = 
                                activity.type === 'movement' || 
                                (activity.description && activity.description.toLowerCase().includes('moved')) ||
                                (activity.fromCategory && activity.toCategory); // Having both from/to categories is a strong indicator
                            
                            if (isMovement) {
                                console.log('Found movement record in activities:', activity);
                                
                                // Enhance the movement record with properties needed for display
                                const fromCat = activity.fromCategory || 'Unknown';
                                const toCat = activity.toCategory || 'Unknown';
                                const qty = activity.quantity || 1;
                                
                                // Preserve the inventory values that were calculated at movement time
                                // These values should be present in the activity record from the animals page
                                const movementRecord = {
                                    ...activity,
                                    type: 'movement',
                                    description: activity.description || `Moved ${qty} from ${fromCat} to ${toCat}`,
                                    recordMainType: 'animal',
                                    fromBefore: activity.fromBefore,
                                    fromAfter: activity.fromAfter,
                                    toBefore: activity.toBefore,
                                    toAfter: activity.toAfter
                                };
                                
                                movementRecords.push(movementRecord);
                            }
                        });
                    }
                    
                    console.log('Found', movementRecords.length, 'movement records in recent activities');

                    // Process animal transaction records
                    let transactionRecords = [];
                    
                    // Process purchases - first from dedicated purchases array
                    if (purchases && purchases.length > 0) {
                        console.log('Processing', purchases.length, 'animal purchases');
                        purchases.forEach(purchase => {
                            // Ensure price is per item and cost is total
                            const price = parseFloat(purchase.price || 0);
                            const quantity = parseFloat(purchase.quantity || 1);
                            
                            // Calculate total cost - if amount exists use it, otherwise calculate from price * quantity
                            let cost;
                            if (purchase.amount) {
                                cost = parseFloat(purchase.amount);
                            } else if (price) {
                                cost = price * quantity;
                            } else if (purchase.cost) {
                                cost = parseFloat(purchase.cost);
                            } else {
                                cost = 0;
                            }
                            
                            transactionRecords.push({
                                type: 'purchase',
                                date: purchase.date || purchase.timestamp || new Date().toISOString(),
                                category: purchase.category,
                                quantity: quantity,
                                cost: cost, // Total cost
                                price: price, // Price per item
                                description: `Purchased ${quantity} ${purchase.category} for ${formatCurrency(cost)}`,
                                recordMainType: 'animal',
                                supplier: purchase.supplier
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
                            // Ensure price is per item and revenue is total
                            const price = parseFloat(sale.price || 0);
                            const quantity = parseFloat(sale.quantity || 1);
                            
                            // Calculate total revenue - if amount exists use it, otherwise calculate from price * quantity
                            let revenue;
                            if (sale.amount) {
                                revenue = parseFloat(sale.amount);
                            } else if (price) {
                                revenue = price * quantity;
                            } else if (sale.revenue) {
                                revenue = parseFloat(sale.revenue);
                            } else {
                                revenue = 0;
                            }
                            
                            transactionRecords.push({
                                type: 'sale',
                                date: sale.date || sale.timestamp || new Date().toISOString(),
                                category: sale.category,
                                quantity: quantity,
                                revenue: revenue, // Total revenue
                                price: price, // Price per item
                                description: `Sold ${quantity} ${sale.category} for ${formatCurrency(revenue)}`,
                                recordMainType: 'animal',
                                buyer: sale.buyer
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
                                recordMainType: 'animal',
                                // Preserve inventory values from the movement record
                                fromBefore: movement.fromBefore,
                                fromAfter: movement.fromAfter,
                                toBefore: movement.toBefore,
                                toAfter: movement.toAfter
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
                                recordMainType: 'animal',
                                // Preserve inventory values from the transaction record
                                fromBefore: transaction.fromBefore,
                                fromAfter: transaction.fromAfter,
                                toBefore: transaction.toBefore,
                                toAfter: transaction.toAfter
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
                            // When viewing "All Animal Records", include all discrepancies
                            // Only skip resolved ones for specific discrepancy reports
                            if (filters.reportType !== 'all-animal' && discrepancy.resolved && filters.reportType !== 'animal-discrepancy') {
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
                    console.log('Movements processed:', movementRecords.length);
                    
                    // Filter animal-related activities
                    const animalRecords = activities.filter(activity => {
                        if (!activity) return false;
                        
                        // Map legacy types to standard types
                        if (activity.type === 'buy') {
                            activity.type = 'purchase';
                            console.log('Mapped buy → purchase:', activity);
                        } else if (activity.type === 'sell') {
                            activity.type = 'sale';
                            console.log('Mapped sell → sale:', activity);
                        } else if (activity.type === 'count-discrepancy') {
                            activity.type = 'discrepancy';
                            console.log('Mapped count-discrepancy → discrepancy:', activity);
                        }
                        
                        const animalTypes = ['movement', 'purchase', 'sale', 'death', 'birth', 'stock-count', 'count-correction', 'discrepancy'];
                        
                        // Check if it's an animal record by type
                        const isAnimalType = animalTypes.includes(activity.type);
                        
                        // Additional check for feed categories if type check is ambiguous
                        let isFeedCategory = false;
                        if (activity.category && feedCategoriesGlobal.length > 0) {
                            isFeedCategory = feedCategoriesGlobal.some(cat => 
                                activity.category.toLowerCase().includes(cat.toLowerCase())
                            );
                        }
                        
                        return isAnimalType && !isFeedCategory;
                    }).map(activity => {
                        // For purchases and sales, ensure they have proper cost/revenue
                        if (activity.type === 'purchase') {
                            // Extract price/cost from appropriate field
                            let cost = 0;
                            if (activity.cost) {
                                cost = parseFloat(activity.cost);
                            } else if (activity.price) {
                                cost = parseFloat(activity.price) * parseFloat(activity.quantity || 1);
                            } else if (activity.amount) {
                                cost = parseFloat(activity.amount);
                            }
                            
                            return {
                                ...activity,
                                cost: cost,
                                recordMainType: 'animal'
                            };
                        } else if (activity.type === 'sale') {
                            // Extract revenue from appropriate field
                            let revenue = 0;
                            if (activity.revenue) {
                                revenue = parseFloat(activity.revenue);
                            } else if (activity.price) {
                                revenue = parseFloat(activity.price) * parseFloat(activity.quantity || 1);
                            } else if (activity.amount) {
                                revenue = parseFloat(activity.amount);
                            }
                            
                            return {
                                ...activity,
                                revenue: revenue,
                                recordMainType: 'animal'
                            };
                        }
                        
                        // Add recordMainType to all records
                        return {
                            ...activity,
                            recordMainType: 'animal'
                        };
                    });
                    
                    console.log('Mapped animal records:', animalRecords.length);
                    console.log('Sample animal records:', animalRecords.slice(0, 3));
                    
                    // Add stock discrepancies
                    if (stockDiscrepancies && Array.isArray(stockDiscrepancies)) {
                        allRecords = [...animalRecords, ...stockDiscrepancies
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
                    allRecords = [...animalRecords, ...transactionRecords, ...discrepancyRecords, ...movementRecords];
                    
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
                    
                    // For all-animal case, include all animal record types
                    if (filters.reportType === 'all-animal') {
                        const validTypes = ['movement', 'purchase', 'sale', 'death', 'birth', 'stock-count', 'count-correction', 'discrepancy', 'resolution'];
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
                
                // Filter out duplicate records
                const uniqueRecords = [];
                const seenRecords = new Map();
                
                console.log('Checking for duplicate records in', filteredRecords.length, 'records');
                
                filteredRecords.forEach(record => {
                    // Create a unique key for each record based on its properties
                    const recordKey = createRecordKey(record);
                    
                    if (!seenRecords.has(recordKey)) {
                        // First time seeing this record
                        seenRecords.set(recordKey, 1);
                        uniqueRecords.push(record);
                    } else {
                        // This is a duplicate - increment the count
                        const count = seenRecords.get(recordKey) + 1;
                        seenRecords.set(recordKey, count);
                        console.log(`Found duplicate record (${count}):`, record);
                    }
                });
                
                console.log(`Removed ${filteredRecords.length - uniqueRecords.length} duplicate records`);
                
                // Use unique records instead of original filtered records
                filteredRecords = uniqueRecords;
                
                console.log('Post-filter and deduplication records:', filteredRecords.length);
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
        
        // Process records to link discrepancies with their resolving counts
        const processedRecords = linkDiscrepancyResolutions(records);
        
        // Get report title
        const reportTitle = getReportTitle(filters);
        
        // Create summary data
        const summary = summarizeRecords(filters.reportType, processedRecords);
        
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
                    <table id="reportDetailsTable" class="report-table">
                        <tbody id="reportDetailsBody">
                        </tbody>
                    </table>
                </div>
            </div>
            
            <style>
                .resolved-discrepancy { background-color: #f8f8f8; }
                .unresolved-discrepancy { background-color: #fff0f0; }
                .resolving-count { background-color: #f0fff0; }
                .resolved-count { font-weight: bold; color: green; }
            </style>
        `;
        
        document.querySelector('.report-content').innerHTML = reportContent;
        
        // Display the details separately after the HTML is in place
        displayReportDetails(processedRecords);
        
        // Apply orientation-specific styling
        handleOrientationChange();
    }
    
    // Function to link discrepancies to their resolving counts
    function linkDiscrepancyResolutions(records) {
        // Clone records to avoid modifying the original
        const processedRecords = JSON.parse(JSON.stringify(records));
        
        // Find all resolved discrepancies
        const resolvedDiscrepancies = processedRecords.filter(record => 
            record.type === 'discrepancy' && record.resolved
        );
        
        // Add debug to see if we're finding the resolved discrepancies
        console.log('Found resolved discrepancies:', resolvedDiscrepancies.length);
        if (resolvedDiscrepancies.length > 0) {
            console.log('Sample resolved discrepancy:', resolvedDiscrepancies[0]);
        }
        
        // Link each discrepancy to the stock count that resolved it
        resolvedDiscrepancies.forEach(discrepancy => {
            // Get resolution count - either from resolutionCount field or expected count
            const resolutionCount = discrepancy.resolutionCount !== undefined 
                ? Number(discrepancy.resolutionCount) 
                : Number(discrepancy.expected); // If no resolution count is specified, use the expected count
            
            console.log(`Looking for stock count that resolves discrepancy for ${discrepancy.category}, count: ${resolutionCount}`);
            
            // For each discrepancy, find the stock count that matches its resolution count and category
            const matchingStockCounts = processedRecords.filter(record => 
                record.type === 'stock-count' && 
                record.category === discrepancy.category &&
                // Match either the quantity, actual field, or extract from description
                (Number(record.quantity) === resolutionCount || 
                 Number(record.actual) === resolutionCount ||
                 (record.description && 
                  record.description.includes('Expected') && 
                  record.description.includes(`Actual ${resolutionCount}`)))
            );
            
            console.log(`Found ${matchingStockCounts.length} potential resolving counts`);
            
            // Find the one that's closest in time (same day or after discrepancy)
            if (matchingStockCounts.length > 0) {
                // Sort by date (closest to discrepancy date first)
                matchingStockCounts.sort((a, b) => {
                    const aDate = new Date(a.date);
                    const bDate = new Date(b.date);
                    const discrepancyDate = new Date(discrepancy.date);
                    
                    // Calculate time difference
                    const aDiff = Math.abs(aDate - discrepancyDate);
                    const bDiff = Math.abs(bDate - discrepancyDate);
                    
                    // Sort by closest date first
                    return aDiff - bDiff;
                });
                
                // Take the closest one that's on the same day or after the discrepancy
                const matchingStockCount = matchingStockCounts.find(count => {
                    const countDate = new Date(count.date);
                    const discrepancyDate = new Date(discrepancy.date);
                    
                    // Return stock counts on the same day or after the discrepancy
                    return countDate >= discrepancyDate;
                }) || matchingStockCounts[0]; // If none found after, take the closest one
                
                if (matchingStockCount) {
                    // Mark this stock count as the one that resolved the discrepancy
                    matchingStockCount.resolvedDiscrepancy = true;
                    // Store the discrepancy ID or date to create a clear link
                    matchingStockCount.resolvedDiscrepancyDate = discrepancy.date;
                    
                    console.log(`Linked discrepancy to stock count:`, {
                        discrepancyDate: formatDate(discrepancy.date),
                        stockCountDate: formatDate(matchingStockCount.date),
                        category: discrepancy.category,
                        expected: discrepancy.expected,
                        actual: discrepancy.actual,
                        resolutionCount: resolutionCount
                    });
                }
            }
        });
        
        return processedRecords;
    }
    
    function displayReportDetails(data) {
        const detailsTable = document.getElementById('reportDetailsTable');
        let html = `
            <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Category</th>
                <th>Details</th>
            </tr>
        `;
        
        // Sort data by date (newest first)
        const sortedRecords = [...data].sort((a, b) => new Date(b.date) - new Date(a.date));
        
        console.log('Displaying', sortedRecords.length, 'records');
        
        // Display details for each record
        sortedRecords.forEach(record => {
            let details = '';
            let date = formatDate(record.date);
            
            // Format details based on record type
            if (record.type === 'purchase') {
                // Display unit price and supplier information
                const unitPrice = formatCurrency(record.price || (record.cost / record.quantity) || 0);
                details = `${record.quantity} @ ${unitPrice} each`;
                if (record.supplier) {
                    details += ` from ${record.supplier}`;
                }
            } else if (record.type === 'sale') {
                // Display unit price and buyer information
                const unitPrice = formatCurrency(record.price || (record.revenue / record.quantity) || 0);
                details = `${record.quantity} @ ${unitPrice} each`;
                if (record.buyer) {
                    details += ` to ${record.buyer}`;
                }
            } else if (record.type === 'death') {
                details = `${record.quantity}`;
                if (record.reason) {
                    details += `: ${record.reason}`;
                }
            } else if (record.type === 'birth') {
                details = `${record.quantity}`;
            } else if (record.type === 'stock-count') {
                // Enhanced stock count details to always show the actual count
                if (record.description && record.description.includes('Expected')) {
                    // Extract from description like "Stock count for Cows: Expected 9, Actual 9 (+0)"
                    const match = record.description.match(/Expected (\d+), Actual (\d+) \(([\+\-]\d+)\)/);
                    if (match) {
                        const expected = match[1];
                        const actual = match[2];
                        const diff = match[3];
                        details = `Expected: ${expected}, Actual: ${actual}, Diff: ${diff}`;
                    } else {
                        details = record.description.replace('Stock count for ', '');
                    }
                } else if (record.quantity || record.actual) {
                    const count = record.quantity || record.actual;
                    details = `Count: ${count}`;
                } else if (record.notes) {
                    details = record.notes;
                } else {
                    details = 'Count performed';
                }

                // If this count resolved a discrepancy, highlight it with specific discrepancy info
                if (record.resolvedDiscrepancy && record.resolvedDiscrepancyDate) {
                    const discrepancyDate = formatDate(record.resolvedDiscrepancyDate);
                    details += ` <span class="resolved-badge">Resolved discrepancy</span>`;
                }
            } else if (record.type === 'discrepancy') {
                details = `Expected: ${record.expected}, Actual: ${record.actual}, Diff: ${record.difference > 0 ? '+' : ''}${record.difference}`;
                
                if (record.resolved) {
                    // Use same format as in animals.js for resolution
                    if (record.type === 'discrepancy') {
                        // Change the display type to show resolutions consistently
                        record.displayType = 'Resolution';
                        rowClass = 'resolution';
                        details = `<span class="resolution-text">✓ Discrepancy resolved</span>`;
                        
                        // Show the final count like in the animals page
                        if (record.resolutionCount !== undefined) {
                            details += `<span class="final-count">Final count: ${record.resolutionCount}</span>`;
                        }
                    }
                }
            } else if (record.type === 'movement') {
                details = `${record.quantity} moved`;
                if (record.fromCategory && record.toCategory) {
                    details += ` from ${record.fromCategory} to ${record.toCategory}`;
                    
                    // If the movement has before/after values already stored, use those
                    if (record.fromBefore !== undefined && record.fromAfter !== undefined &&
                        record.toBefore !== undefined && record.toAfter !== undefined) {
                        details += ` (${record.fromCategory} ${record.fromBefore} -${record.quantity} = ${record.fromAfter}; ${record.toCategory} ${record.toBefore} +${record.quantity} = ${record.toAfter})`;
                    }
                }
            }
            
            // Capitalize record type for display
            const displayType = record.displayType || 
                                (record.type.charAt(0).toUpperCase() + record.type.slice(1));
            
            // Determine if we need to highlight this row
            let rowClass = '';
            if (record.type === 'discrepancy') {
                rowClass = record.resolved ? 'resolution' : 'unresolved-discrepancy';
            } else if (record.type === 'stock-count' && record.resolvedDiscrepancy) {
                rowClass = 'resolving-count';
            }
            
            // Build table row
            html += `
                <tr class="${rowClass}">
                    <td>${date}</td>
                    <td>${displayType}</td>
                    <td>${record.category || ''}</td>
                    <td>${details}</td>
                </tr>
            `;
        });
        
        // Update the table body with the new rows
        if (!detailsTable) {
            console.error('Report details table not found');
            return;
        }
        
        detailsTable.innerHTML = html;
    }
    
    // We don't need the updateInventoryForRecord function anymore since the logic is
    // integrated directly in displayReportDetails above
    
    // Helper function to format dates consistently
    function formatDate(dateString) {
        if (!dateString) return 'N/A';
        try {
            return new Date(dateString).toLocaleDateString();
        } catch (e) {
            console.error('Error formatting date:', e);
            return dateString;
        }
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
                
                // If we have description that includes expected/actual, parse that
                if (record.description && record.description.includes('Expected')) {
                    const match = record.description.match(/Expected (\d+), Actual (\d+) \(([\+\-]\d+)\)/);
                    if (match) {
                        return `Expected: ${match[1]}, Actual: ${match[2]}, Diff: ${match[3]}`;
                    }
                }
                
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
                return `Expected: ${expected !== null ? expected : 'N/A'}, Actual: ${actual !== null ? actual : 'N/A'}, Diff: ${diffStr}`;
                
            case 'count-correction':
                return `Adjusted by ${record.difference > 0 ? '+' : ''}${record.difference}`;
                
            case 'discrepancy':
                // Format for stock count discrepancy with resolution details
                const discDetails = `Expected: ${record.expected || 0}, ` +
                       `Actual: ${record.actual || 0}, ` +
                       `Diff: ${record.difference >= 0 ? '+' : ''}${record.difference || 0}`;
                
                if (record.resolved) {
                    let resolutionInfo = ' (Resolved)';
                    
                    // Show resolution count as primary resolution information
                    if (record.resolutionCount !== undefined) {
                        resolutionInfo += ` with count of ${record.resolutionCount}`;
                        
                        // Add resolution date if available
                        if (record.resolvedDate) {
                            const resolvedDate = new Date(record.resolvedDate).toLocaleDateString();
                            resolutionInfo += ` on ${resolvedDate}`;
                        }
                    }
                    
                    // Add any additional resolution notes
                    if (record.resolutionNotes) {
                        resolutionInfo += ` - ${record.resolutionNotes}`;
                    }
                    
                    return discDetails + resolutionInfo;
                }
                return discDetails;
                
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
    
    // Set up debug panel functionality
    function setupDebugPanel() {
        // Get elements
        const debugPanel = document.getElementById('debug-panel');
        const toggleButton = document.getElementById('toggle-debug-panel');
        const debugOutput = document.getElementById('debug-output');
        const copyButton = document.getElementById('copy-debug');
        const clearButton = document.getElementById('clear-debug');
        
        // Toggle debug panel visibility
        toggleButton.addEventListener('click', function() {
            if (debugPanel.style.display === 'none') {
                debugPanel.style.display = 'block';
                toggleButton.textContent = 'Hide Debug Panel';
            } else {
                debugPanel.style.display = 'none';
                toggleButton.textContent = 'Show Debug Panel';
            }
        });
        
        // Copy debug output to clipboard
        copyButton.addEventListener('click', function() {
            debugOutput.select();
            document.execCommand('copy');
            alert('Debug information copied to clipboard!');
        });
        
        // Clear debug output
        clearButton.addEventListener('click', function() {
            debugOutput.value = '';
            debugLogs = [];
        });
        
        // Override console.log to capture logs
        const originalConsoleLog = console.log;
        const originalConsoleError = console.error;
        const originalConsoleWarn = console.warn;
        
        // Array to store logs
        window.debugLogs = [];
        
        // Function to add log to debug panel
        function addLog(type, args) {
            const timestamp = new Date().toLocaleTimeString();
            const logMessage = Array.from(args).map(arg => {
                if (typeof arg === 'object') {
                    try {
                        return JSON.stringify(arg, null, 2);
                    } catch (e) {
                        return String(arg);
                    }
                }
                return String(arg);
            }).join(' ');
            
            const formattedLog = `[${timestamp}] [${type}] ${logMessage}`;
            window.debugLogs.push(formattedLog);
            
            // Keep only the last 500 logs to prevent memory issues
            if (window.debugLogs.length > 500) {
                window.debugLogs.shift();
            }
            
            // Update debug output if panel is visible
            if (debugPanel.style.display !== 'none') {
                debugOutput.value = window.debugLogs.join('\n');
                // Auto-scroll to bottom
                debugOutput.scrollTop = debugOutput.scrollHeight;
            }
        }
        
        // Override console methods
        console.log = function() {
            addLog('INFO', arguments);
            originalConsoleLog.apply(console, arguments);
        };
        
        console.error = function() {
            addLog('ERROR', arguments);
            originalConsoleError.apply(console, arguments);
        };
        
        console.warn = function() {
            addLog('WARN', arguments);
            originalConsoleWarn.apply(console, arguments);
        };
        
        // Add initial log
        console.log('Debug panel initialized');
    }
    
    // Helper function to create a unique key for a record
    function createRecordKey(record) {
        if (!record) return 'null';
        
        // Create a key that includes all relevant fields to identify duplicates
        let key = '';
        
        // Include date (normalize to date only, no time)
        if (record.date) {
            try {
                const dateObj = new Date(record.date);
                key += dateObj.toISOString().split('T')[0] + '|';
            } catch (e) {
                key += record.date + '|';
            }
        }
        
        // Include type
        key += (record.type || 'unknown') + '|';
        
        // Include category or from/to categories for movements
        if (record.type === 'movement') {
            key += (record.fromCategory || '') + '>' + (record.toCategory || '') + '|';
        } else {
            key += (record.category || '') + '|';
        }
        
        // Include quantity
        key += (record.quantity || '') + '|';
        
        // For purchases, include supplier and price
        if (record.type === 'purchase') {
            key += (record.supplier || '') + '|' + (record.price || record.cost || '') + '|';
        }
        
        // For sales, include buyer and price
        if (record.type === 'sale') {
            key += (record.buyer || '') + '|' + (record.price || record.revenue || '') + '|';
        }
        
        return key;
    }
}); 
}); 