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
            
            // Get all relevant records based on main type
            switch (filters.mainType) {
                case 'animal':
                    // Get data from all relevant sources
                    const activitiesStr = await mobileStorage.getItem('recentActivities');
                    const inventoryStr = await mobileStorage.getItem('animalInventory');
                    const discrepanciesStr = await mobileStorage.getItem('stockDiscrepancies');
                    
                    const activities = activitiesStr ? JSON.parse(activitiesStr) : [];
                    const animalInventory = inventoryStr ? JSON.parse(inventoryStr) : {};
                    const stockDiscrepancies = discrepanciesStr ? JSON.parse(discrepanciesStr) : [];
                    
                    // Get animal categories for later use
                    const animalCategories = await getAnimalCategories();
                    // Get feed categories to help with filtering out feed records
                    const feedCategoriesStr = await mobileStorage.getItem('feedCategories');
                    const feedCategories = feedCategoriesStr ? JSON.parse(feedCategoriesStr) : [];
                    // Store in the function-level variable for use later
                    feedCategoriesGlobal = feedCategories;
                    
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
                        
                        // Mark this as an animal record for filtering
                        return {...activity, recordMainType: 'animal'};
                    }).filter(record => record !== null); // Remove any null records
                    
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
                filteredRecords = filteredRecords.filter(record => {
                    if (!record || !record.type) return false;
                    
                    // Double check feed categories aren't included
                    const recordCategory = record.category || record.fromCategory || record.toCategory;
                    if (recordCategory && 
                        (recordCategory.toLowerCase().includes('feed') || feedCategoriesGlobal.includes(recordCategory))) {
                        return false;
                    }
                    
                    // Only include animal record types
                    return ['movement', 'purchase', 'sale', 'death', 'birth', 'stock-count', 'count-correction'].includes(record.type);
                });
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
                const cost = Number(record.cost || 0);
                const quantity = Number(record.quantity || 1);
                const unitPrice = quantity > 0 ? cost / quantity : 0;
                return `${record.quantity || ''} @ ${formatCurrency(unitPrice)}ea`;
                
            case 'sale':
                // Safely calculate unit price and handle missing revenue data
                const revenue = Number(record.revenue || 0);
                const saleQuantity = Number(record.quantity || 1);
                const unitRevenue = saleQuantity > 0 ? revenue / saleQuantity : 0;
                return `${record.quantity || ''} @ ${formatCurrency(unitRevenue)}ea`;
                
            case 'death':
                return `${record.quantity || ''}${record.reason ? `: ${record.reason}` : ''}`;
                
            case 'birth':
                return `${record.quantity || ''}${record.notes ? `: ${record.notes}` : ''}`;
                
            case 'stock-count':
                // Improved stock count details display
                const expected = record.expected !== undefined ? Number(record.expected) : null;
                const actual = record.actual !== undefined ? Number(record.actual) : null;
                
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
                
                return `Expected: ${expected !== null ? expected : 'N/A'}, ` + 
                       `Actual: ${actual !== null ? actual : 'N/A'}, ` + 
                       `Diff: ${diffStr}`;
                
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
        if (amount === undefined || amount === null) return `${userCurrency}0`;
        return `${userCurrency}${Number(amount).toFixed(2)}`;
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