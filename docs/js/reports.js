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
            
            // Reset table for portrait
            const reportTables = document.querySelectorAll('.report-table');
            reportTables.forEach(table => {
                if (table.querySelectorAll('th').length > 3) {
                    table.style.minWidth = "500px";
                }
            });
        }
    }
    
    function setupEventListeners() {
        // Add event listeners for all report type selects
        document.getElementById('animal-report-type')?.addEventListener('change', handleReportTypeChange);
        document.getElementById('feed-report-type')?.addEventListener('change', handleReportTypeChange);
        document.getElementById('health-report-type')?.addEventListener('change', handleReportTypeChange);
        document.getElementById('category-filter')?.addEventListener('change', handleCategoryChange);
        document.getElementById('generate-report')?.addEventListener('click', handleGenerateReport);
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
        
        updateCategoryOptions();
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
            const reportData = await collectReportData(filters);
            if (!reportData || reportData.length === 0) {
                document.querySelector('.report-content').innerHTML = 
                    '<div class="empty-state">No records found for the selected criteria</div>';
                return;
            }
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
                    
                    // Filter animal-related activities
                    allRecords = activities.filter(activity => {
                        // Check if it's an animal-related activity
                        if (typeof activity === 'string') {
                            // Handle string-based activities
                            const activityLower = activity.toLowerCase();
                            return activityLower.includes('moved') ||
                                activityLower.includes('purchased') ||
                                activityLower.includes('sold') ||
                                activityLower.includes('death') ||
                                activityLower.includes('birth') ||
                                activityLower.includes('stock count');
                        } else if (activity && typeof activity === 'object') {
                            // Handle object-based activities
                            return activity.type === 'movement' ||
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
                        }
                        return false;
                    }).map(activity => {
                        // Convert string activities to objects if needed
                        if (typeof activity === 'string') {
                            return parseActivityString(activity);
                        }
                        return activity;
                    });
                    
                    // Add stock discrepancies
                    if (stockDiscrepancies && Array.isArray(stockDiscrepancies)) {
                        allRecords = [...allRecords, ...stockDiscrepancies];
                    }
                    break;
                    
                case 'feed':
                    // Load feed data
                    const feedInventoryStr = await mobileStorage.getItem('feedInventory');
                    const feedCategoriesStr = await mobileStorage.getItem('feedCategories');
                    const feedTransactionsStr = await mobileStorage.getItem('feedTransactions');
                    
                    const feedInventory = feedInventoryStr ? JSON.parse(feedInventoryStr) : {};
                    const feedCategories = feedCategoriesStr ? JSON.parse(feedCategoriesStr) : [];
                    const feedTransactions = feedTransactionsStr ? JSON.parse(feedTransactionsStr) : [];
                    
                    if (filters.reportType === 'feed-inventory') {
                        // For inventory report, create records from feed categories
                        allRecords = feedCategories.map(category => {
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
                                totalValue: (data.price || data.lastUnitCost || 0) * (data.quantity || 0)
                            };
                        });
                    } else {
                        // For other feed reports, get transactions
                        allRecords = feedTransactions.map(t => ({ ...t, type: t.type || 'unknown' }));
                    }
                    break;
                    
                case 'health':
                    // Get health records
                    const healthRecordsStr = await mobileStorage.getItem('healthRecords');
                    const healthRecords = healthRecordsStr ? JSON.parse(healthRecordsStr) : [];
                    
                    allRecords = healthRecords;
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
            
            // Filter by category if specified
            if (filters.category !== 'all') {
                filteredRecords = filteredRecords.filter(record => {
                    if (!record) return false;
                    
                    // Handle different record structures
                    const recordCategory = record.category || record.fromCategory || record.toCategory;
                    if (!recordCategory) return false;
                    
                    return recordCategory.toLowerCase() === filters.category.toLowerCase();
                });
            }
            
            // Filter by specific type if not "all" type selected
            if (!filters.reportType.startsWith('all-')) {
                const specificType = filters.reportType.split('-')[1]; // 'movement', 'purchase', etc.
                filteredRecords = filteredRecords.filter(record => {
                    if (!record || !record.type) return false;
                    
                    // Filter by specific record types
                    if (specificType === 'movement') {
                        return record.type === 'movement';
                    } else if (specificType === 'purchase') {
                        return record.type === 'purchase';
                    } else if (specificType === 'sale') {
                        return record.type === 'sale';
                    } else if (specificType === 'death') {
                        return record.type === 'death';
                    } else if (specificType === 'birth') {
                        return record.type === 'birth';
                    } else if (specificType === 'count') {
                        return record.type === 'stock-count' || record.type === 'count-correction';
                    } else if (specificType === 'usage') {
                        return record.type === 'usage' || record.type === 'consumption';
                    } else if (specificType === 'treatment') {
                        return record.type === 'treatment';
                    } else if (specificType === 'vaccination') {
                        return record.type === 'vaccination';
                    } else if (specificType === 'medication') {
                        return record.type === 'medication';
                    }
                    
                    return false;
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
                return `${record.quantity || ''} moved from ${record.fromCategory || 'unknown'} to ${record.toCategory || 'unknown'}`;
                
            case 'purchase':
                return `${record.quantity || ''} purchased for ${formatCurrency(record.cost)} (${formatCurrency(record.cost / (record.quantity || 1))} each)`;
                
            case 'sale':
                return `${record.quantity || ''} sold for ${formatCurrency(record.revenue)} (${formatCurrency(record.revenue / (record.quantity || 1))} each)`;
                
            case 'death':
                return `${record.quantity || ''} deaths${record.reason ? ` - Reason: ${record.reason}` : ''}`;
                
            case 'birth':
                return `${record.quantity || ''} births${record.notes ? ` - ${record.notes}` : ''}`;
                
            case 'stock-count':
                return `Expected: ${record.expected || 0}, Actual: ${record.actual || 0}, Difference: ${(record.actual || 0) - (record.expected || 0)}`;
                
            case 'count-correction':
                return `Adjusted inventory by ${record.difference > 0 ? '+' : ''}${record.difference}`;
                
            case 'inventory':
                return `Quantity: ${record.quantity} ${record.unit || ''}, Value: ${formatCurrency(record.totalValue)}`;
                
            case 'usage':
            case 'consumption':
                return `Used ${record.quantity} ${record.unit || ''} for ${record.purpose || 'general use'}`;
                
            case 'treatment':
                return `${record.treatment || 'Treatment'} - Duration: ${record.duration || 'N/A'} days`;
                
            case 'vaccination':
                return `${record.vaccine || 'Vaccination'}${record.nextDate ? ` - Next: ${new Date(record.nextDate).toLocaleDateString()}` : ''}`;
                
            case 'medication':
                return `${record.medication || 'Medication'} ${record.dosage ? `(${record.dosage})` : ''} - Withdrawal: ${record.withdrawalPeriod || 0} days`;
                
            case 'health-record':
                return `${record.condition || ''} - ${record.description || ''} - Severity: ${record.severity || 'N/A'}`;
                
            default:
                // If there's a description, use that
                if (record.description) {
                    return record.description;
                }
                
                // Otherwise, format quantity and notes
                let details = '';
                if (record.quantity) {
                    details += `Quantity: ${record.quantity}`;
                }
                if (record.notes) {
                    details += details ? ` - ${record.notes}` : record.notes;
                }
                return details || 'No details available';
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