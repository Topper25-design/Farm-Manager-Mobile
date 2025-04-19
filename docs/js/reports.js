// Global variables for report settings
let selectedReportType = '';
let selectedMainType = '';
let userCurrency = 'R';

// Add to the top of the file
// Add a synchronous version of getItem for use in functions that can't be async
mobileStorage.getItemSync = function(key) {
    // Try to get from localStorage first (for backward compatibility)
    if (typeof localStorage !== 'undefined') {
        const value = localStorage.getItem(key);
        if (value) return value;
    }
    
    // For mobileStorage, we need to use a sync version
    // Since we're in a sync function, we'll return the last known value or default
    // This is a compromise but should work for most cases
    return this._cache?.[key] || null;
};

// Initialize cache to store values for sync access
mobileStorage._cache = {};

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

// Add a function to clear the cache - important for data freshness
mobileStorage.clearCache = function() {
    this._cache = {};
};

// Function to set up debug panel
function setupDebugPanel() {
    // Create debug panel elements if they don't exist
    let debugPanel = document.getElementById('debug-panel');
    
    // If debug panel doesn't exist in DOM, create it
    if (!debugPanel) {
        debugPanel = document.createElement('div');
        debugPanel.id = 'debug-panel';
        debugPanel.className = 'debug-panel';
        debugPanel.style.display = 'none';
        
        // Create debug panel header
        const debugHeader = document.createElement('div');
        debugHeader.className = 'debug-header';
        debugHeader.innerHTML = '<h3>Debug Panel</h3>';
        
        // Create debug panel controls
        const debugControls = document.createElement('div');
        debugControls.className = 'debug-controls';
        
        // Add copy button
        const copyBtn = document.createElement('button');
        copyBtn.id = 'copy-debug';
        copyBtn.className = 'debug-btn';
        copyBtn.innerText = 'Copy';
        copyBtn.addEventListener('click', function() {
            const debugOutput = document.getElementById('debug-output');
            if (debugOutput) {
                debugOutput.select();
                document.execCommand('copy');
            }
        });
        
        // Add clear button
        const clearBtn = document.createElement('button');
        clearBtn.id = 'clear-debug';
        clearBtn.className = 'debug-btn';
        clearBtn.innerText = 'Clear';
        clearBtn.addEventListener('click', function() {
            const debugOutput = document.getElementById('debug-output');
            if (debugOutput) {
                debugOutput.value = '';
            }
        });
        
        // Add buttons to controls
        debugControls.appendChild(copyBtn);
        debugControls.appendChild(clearBtn);
        
        // Add textarea for debug output
        const debugOutput = document.createElement('textarea');
        debugOutput.id = 'debug-output';
        debugOutput.className = 'debug-output';
        debugOutput.readOnly = true;
        
        // Assemble debug panel
        debugPanel.appendChild(debugHeader);
        debugPanel.appendChild(debugControls);
        debugPanel.appendChild(debugOutput);
        
        // Append to body
        document.body.appendChild(debugPanel);
        
        // Add toggle button if it doesn't exist
        let debugToggleBtn = document.getElementById('toggle-debug-panel');
        if (!debugToggleBtn) {
            debugToggleBtn = document.createElement('button');
            debugToggleBtn.id = 'toggle-debug-panel';
            debugToggleBtn.className = 'debug-toggle';
            debugToggleBtn.innerText = 'Debug';
            debugToggleBtn.style.position = 'fixed';
            debugToggleBtn.style.bottom = '10px';
            debugToggleBtn.style.right = '10px';
            debugToggleBtn.style.zIndex = '1000';
            
            // Add event listener
            debugToggleBtn.addEventListener('click', function() {
                debugPanel.style.display = debugPanel.style.display === 'none' ? 'block' : 'none';
            });
            
            // Append to body
            document.body.appendChild(debugToggleBtn);
        }
    }
    
    // Override console.log to also output to debug panel
    const originalConsoleLog = console.log;
    console.log = function() {
        // Call original console.log
        originalConsoleLog.apply(console, arguments);
        
        // Add to debug panel
        const debugOutput = document.getElementById('debug-output');
        if (debugOutput) {
            // Convert all arguments to string
            const args = Array.from(arguments).map(arg => {
                if (typeof arg === 'object') {
                    try {
                        return JSON.stringify(arg);
                    } catch (e) {
                        return String(arg);
                    }
                }
                return String(arg);
            });
            
            // Add timestamp
            const now = new Date();
            const timestamp = `[${now.toLocaleTimeString()}]`;
            
            // Append to debug output
            debugOutput.value += `${timestamp} ${args.join(' ')}\n`;
            
            // Scroll to bottom
            debugOutput.scrollTop = debugOutput.scrollHeight;
        }
    };
    
    // Also override console.error
    const originalConsoleError = console.error;
    console.error = function() {
        // Call original console.error
        originalConsoleError.apply(console, arguments);
        
        // Add to debug panel
        const debugOutput = document.getElementById('debug-output');
        if (debugOutput) {
            // Convert all arguments to string
            const args = Array.from(arguments).map(arg => {
                if (typeof arg === 'object') {
                    try {
                        return JSON.stringify(arg);
                    } catch (e) {
                        return String(arg);
                    }
                }
                return String(arg);
            });
            
            // Add timestamp
            const now = new Date();
            const timestamp = `[${now.toLocaleTimeString()}]`;
            
            // Append to debug output with error styling
            debugOutput.value += `${timestamp} ERROR: ${args.join(' ')}\n`;
            
            // Scroll to bottom
            debugOutput.scrollTop = debugOutput.scrollHeight;
        }
    };
}

document.addEventListener('DOMContentLoaded', async () => {
    // Clear cache on page load to ensure fresh data
    if (mobileStorage.clearCache) {
        console.log('Clearing cache on page load for fresh data');
        mobileStorage.clearCache();
    }
    
    // Check if logged in
    const isLoggedIn = await mobileStorage.getItem('isLoggedIn');
    if (isLoggedIn !== 'true') {
        window.location.href = 'index.html';
        return;
    }
    
    // Setup keyboard detection for mobile devices
    setupKeyboardDetection();
    
    // Initialize state
    // let selectedReportType = '';  // Moved to global scope
    // let selectedMainType = '';    // Moved to global scope
    userCurrency = await mobileStorage.getItem('currency') || 'R';
    
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
            // Convert to number and ensure it's a valid number
            const numAmount = Number(amount);
            if (isNaN(numAmount)) return `R0.00 ZAR`;
            
            // Format currency in the requested style: "R187500.00 ZAR"
            const formattedAmount = numAmount.toFixed(2);
            return `R${formattedAmount} ZAR`;
        } catch (e) {
            console.error('Error formatting currency:', e);
            // Fallback to simple formatting if formatting fails
            return `R0.00 ZAR`;
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
        
        // Set global variables
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
    
    /**
     * Collect all filter values from the form
     * @returns {Object} Filter values including date range, report type, and category
     */
    function collectFilters() {
        // Get date range values
        const dateFrom = document.getElementById('date-from')?.value || '';
        const dateTo = document.getElementById('date-to')?.value || '';
        
        // Get selected report type and category
        const category = document.getElementById('category-filter')?.value || 'all';
        
        // Assemble filters object
        return {
            dateRange: {
                start: dateFrom,
                end: dateTo
            },
            reportType: selectedReportType, // Using global variable
            mainType: selectedMainType,     // Using global variable
            category: category
        };
    }
    
    // New simplified implementation for debugging
    async function handleGenerateReport() {
        // Clear cache before generating reports to ensure fresh data
        mobileStorage.clearCache();
        
        const reportResults = document.querySelector('.report-content');
        
        try {
            // Clear previous results
            clearPreviousReportResults();
            
            // Show loading state
            reportResults.innerHTML = '<div class="loading">Loading report data...</div>';
            
            // Collect filters
        const filters = collectFilters();
        
            // Validate date range
            const startDate = new Date(filters.dateRange.start);
            const endDate = new Date(filters.dateRange.end);
            
            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                reportResults.innerHTML = '<div class="error-message">Please enter valid date range</div>';
            return;
        }
        
            if (startDate > endDate) {
                reportResults.innerHTML = '<div class="error-message">Start date must be before end date</div>';
                return;
            }
            
            // Check if we have a report type selected
            if (!filters.reportType) {
                reportResults.innerHTML = '<div class="error-message">Please select a report type</div>';
                return;
            }
            
            // Collect data based on filters
            const reportData = await collectReportData(filters);
            
            // If no data returned, show message
            if (!reportData || (Array.isArray(reportData) && reportData.length === 0) || 
                (reportData.feedTransactions && reportData.feedTransactions.length === 0 && 
                 filters.reportType !== 'feed-inventory' && filters.reportType !== 'feed-calculation')) {
                reportResults.innerHTML = `<div class="empty-state">No data found for the selected criteria</div>`;
                return;
            }
            
            // Generate report based on type
            let reportHTML = '';
            
            try {
                switch (filters.reportType) {
                    case 'all-feed':
                        reportHTML = createAllFeedReportTable(reportData);
                        break;
                        
                    case 'feed-purchase':
                        reportHTML = createFeedPurchaseTable(reportData);
                        break;
                        
                    case 'feed-usage':
                        reportHTML = createFeedUsageTable(reportData);
                        break;
                        
                    case 'feed-calculation':
                        try {
                            const feedCalculations = reportData && reportData.length > 0 ? reportData : [];
                            // Code to generate report HTML
                            reportHTML = createFeedCalculationTable(feedCalculations, filters);
        } catch (error) {
                            console.error('Error generating feed calculation report:', error);
                            reportHTML = `<div class="error-message">Error generating feed calculations: ${error.message}</div>`;
                        }
                        break;
                    
                    case 'feed-inventory':
                        reportHTML = createFeedInventoryTable(reportData);
                        break;
                    
                    // Animal report types
                    case 'all-animal':
                        reportHTML = createAllAnimalReportTable(reportData);
                        break;
                        
                    case 'animal-inventory':
                        reportHTML = createAnimalInventoryTable(reportData);
                        break;
                        
                    case 'animal-movement':
                        reportHTML = createAnimalMovementTable(reportData);
                        break;
                    
                    // Add handlers for the new animal report types
                    case 'animal-purchase':
                        reportHTML = createAnimalPurchaseTable(reportData);
                        break;
                    
                    case 'animal-sale':
                        reportHTML = createAnimalSaleTable(reportData);
                        break;
                    
                    case 'animal-birth':
                        reportHTML = createAnimalBirthTable(reportData);
                        break;
                    
                    case 'animal-death':
                        reportHTML = createAnimalDeathTable(reportData);
                        break;
                    
                    case 'animal-count':
                        reportHTML = createAnimalCountTable(reportData);
                        break;
                    
                    case 'animal-discrepancy':
                        reportHTML = createAnimalDiscrepancyTable(reportData);
                        break;
                    
                    default:
                        reportHTML = `<div class="error-message">Report type not supported yet: ${filters.reportType}</div>`;
                }
                
                // Display the report
                reportResults.innerHTML = reportHTML;
                
                // Log after successfully rendering
                console.log(`Successfully rendered ${filters.reportType} report`);
                
            } catch (error) {
                console.error('Error generating report HTML:', error);
                reportResults.innerHTML = `<div class="error-message">Error generating report: ${error.message}</div>`;
            }
        } catch (error) {
            console.error('Error handling report generation:', error);
            reportResults.innerHTML = `<div class="error-message">Error: ${error.message}</div>`;
        }
    }
    
    // Helper function to create the feed calculation table - extracted from handleGenerateReport
    function createFeedCalculationTable(feedCalculations, filters) {
        let reportHTML = `
            <div class="report-header">
                <div class="report-type-header">
                    <div class="report-type-title">Feed Calculations Report</div>
                    <div class="report-actions">
                        <button onclick="window.print()" class="print-button">Print Report</button>
                        <button onclick="exportReportToCSV('feed-calculations')" class="export-button">Export to CSV</button>
                    </div>
                </div>
                <div class="report-summary">
                    <p>Report date range: ${formatDate(filters.dateRange.start)} to ${formatDate(filters.dateRange.end)}</p>
                    <p>Total number of calculations: ${feedCalculations.length}</p>
                    <p>Total feed cost: ${formatCurrency(feedCalculations.reduce((sum, calc) => sum + (calc.totalCost || 0), 0))}</p>
                </div>
            </div>
            
            <div class="report-section">
                <h3>Feed Calculations</h3>
        `;
        
        // Generate calculation cards
        feedCalculations.forEach(calc => {
            // Map properties safely with fallbacks to prevent undefined errors
            const animalType = calc.animalCategory || calc.category || 'Unknown';
            const count = calc.animalCount || calc.numAnimals || 0;
            const feedType = calc.feedType || 'Unknown';
            
            // Use the daily intake value exactly as stored, without conversion
            const dailyIntake = typeof calc.dailyIntake === 'number' ? calc.dailyIntake : 0;
            
            // Get the intake unit - ensure we use the one stored with the data
            const intakeUnit = calc.intakeUnit || 'g';
            
            const totalFeed = calc.totalFeedNeeded || calc.totalFeed || 0;
            const duration = calc.duration || 1;
            const dailyCost = calc.totalDailyCost || calc.dailyCost || 0;
            const costPerAnimal = calc.costPerAnimalPerDay || calc.costPerAnimal || 
                (count > 0 ? dailyCost / count : 0);
            const totalCost = calc.totalCost || 0;
            
            // Format total feed display - convert to kg if the unit is grams for better readability
            const totalFeedDisplay = intakeUnit === 'g' ? 
                `${(totalFeed).toFixed(2)} kg` : 
                `${totalFeed.toFixed(2)} ${intakeUnit}`;
            
            reportHTML += `
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
        reportHTML += `
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
            
            // Use the daily intake value exactly as stored, without conversion
            const dailyIntake = typeof calc.dailyIntake === 'number' ? calc.dailyIntake : 0;
            
            // Get the intake unit - ensure we use the one stored with the data
            const intakeUnit = calc.intakeUnit || 'g';
            
            const totalFeed = calc.totalFeedNeeded || calc.totalFeed || 0;
            const duration = calc.duration || 1;
            const dailyCost = calc.totalDailyCost || calc.dailyCost || 0;
            const costPerAnimal = calc.costPerAnimalPerDay || calc.costPerAnimal || 
                (count > 0 ? dailyCost / count : 0);
            const totalCost = calc.totalCost || 0;
            
            // Format total feed display - convert to kg if the unit is grams for better readability
            const totalFeedDisplay = intakeUnit === 'g' ? 
                `${(totalFeed).toFixed(2)} kg` : 
                `${totalFeed.toFixed(2)} ${intakeUnit}`;
            
            reportHTML += `
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
        reportHTML += `
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
        
        return reportHTML;
    }
    
    /**
     * Load feed calculation data
     */
    async function loadFeedCalculationData(startDate, endDate, category) {
        console.log('Loading feed calculation data');
        
        // Clear cache to ensure fresh data
        mobileStorage.clearCache();
        
        // Load feed calculations from storage
        const feedCalculationsStr = await mobileStorage.getItem('feedCalculations');
        const feedCalculations = feedCalculationsStr ? JSON.parse(feedCalculationsStr) : [];
        
        console.log(`Found ${feedCalculations.length} feed calculations in storage`);
        
        // Filter by date range if we have dates
        const filteredCalculations = feedCalculations.filter(calc => {
            if (!calc.date) return true; // Include items without dates
            
            // Fix: Convert both dates to simple date strings to compare just the date portion
            const calcDateStr = new Date(calc.date).toISOString().split('T')[0];
            const startDateStr = startDate.toISOString().split('T')[0];
            const endDateStr = endDate.toISOString().split('T')[0];
            
            // Debug date comparison
            console.log(`Comparing dates: calcDate=${calcDateStr}, startDate=${startDateStr}, endDate=${endDateStr}`);
            
            // Check if within range or if dates match
            return calcDateStr >= startDateStr && calcDateStr <= endDateStr;
        });
        
        // Filter by category if specified and not "all"
        const categoryFiltered = category === 'all' ? 
            filteredCalculations : 
            filteredCalculations.filter(calc => {
                return calc.animalType === category || calc.feedType === category;
            });
        
        console.log(`Found ${categoryFiltered.length} feed calculations after filtering`);
        return categoryFiltered;
    }
    
    /**
     * Get animal categories from storage
     * @returns {Promise<Array>} Array of animal categories
     */
    async function getAnimalCategories() {
        try {
            // Get animal categories from storage
            const categoriesStr = await mobileStorage.getItem('animalCategories');
            
            // If no categories found, try to extract from inventory
            if (!categoriesStr) {
                console.log('No animal categories found in storage, trying to extract from inventory');
                const animalInventoryStr = await mobileStorage.getItem('animalInventory') || '{}';
                try {
                    const inventory = JSON.parse(animalInventoryStr);
                    if (typeof inventory === 'object' && inventory !== null) {
                        const categories = Object.keys(inventory);
                        if (categories.length > 0) {
                            console.log('Extracted categories from inventory:', categories);
                            // Save these categories for future use
                            await mobileStorage.setItem('animalCategories', JSON.stringify(categories));
                            return categories;
                        }
                    }
                } catch (e) {
                    console.error('Error extracting categories from inventory:', e);
                }
                
                // Return empty array if no categories found
                console.log('No animal categories found, returning empty array');
                return [];
            }
            
            // Parse and return categories
            try {
            const categories = JSON.parse(categoriesStr);
            console.log(`Found ${categories.length} animal categories in storage`);
                return Array.isArray(categories) ? categories : [];
            } catch (e) {
                console.error('Error parsing animal categories:', e);
                return [];
            }
        } catch (error) {
            console.error('Error getting animal categories:', error);
            return [];
        }
    }
    
    /**
     * Collect report data based on selected filters
     * @param {Object} filters - Filter values including date range, report type and category
     * @returns {Array|Object} The filtered data for the report
     */
    async function collectReportData(filters) {
        console.log('Collecting report data with filters:', filters);
        
        const startDate = new Date(filters.dateRange.start);
        const endDate = new Date(filters.dateRange.end);
        const { category, reportType } = filters;
        
        // Default empty data
        let reportData = [];
        
        // Get data based on report type
        switch (reportType) {
            case 'feed-calculation':
                // Use the feed calculation data loading function
                reportData = await loadFeedCalculationData(startDate, endDate, category);
                    break;
                    
            case 'feed-inventory':
                // Get current feed inventory data
                    const feedInventoryStr = await mobileStorage.getItem('feedInventory');
                const feedInventory = feedInventoryStr ? JSON.parse(feedInventoryStr) : [];
                    
                // Get feed transactions for history
                const feedTransactionsStr = await mobileStorage.getItem('feedTransactions');
                    const feedTransactions = feedTransactionsStr ? JSON.parse(feedTransactionsStr) : [];
                    
                // Filter transactions by date
                const filteredTransactions = feedTransactions.filter(transaction => {
                    if (!transaction.date) return false;
                    const transactionDate = new Date(transaction.date);
                    return transactionDate >= startDate && transactionDate <= endDate;
                });
                
                // Return both current inventory and filtered transactions
                reportData = {
                    feedInventory,
                    feedTransactions: filteredTransactions
                };
                break;
                
            case 'feed-purchase':
            case 'feed-usage':
            case 'all-feed':
                // Get feed transactions
                const transactionsStr = await mobileStorage.getItem('feedTransactions');
                const transactions = transactionsStr ? JSON.parse(transactionsStr) : [];
                
                // Filter by date
                const dateFiltered = transactions.filter(transaction => {
                    if (!transaction.date) return false;
                    const transactionDate = new Date(transaction.date);
                    return transactionDate >= startDate && transactionDate <= endDate;
                });
                
                // Filter by type if needed
                if (reportType === 'feed-purchase') {
                    reportData = dateFiltered.filter(t => t.type === 'purchase');
                } else if (reportType === 'feed-usage') {
                    reportData = dateFiltered.filter(t => t.type === 'usage');
                    } else {
                    // all-feed - include all types
                    reportData = dateFiltered;
                }
                
                // Further filter by category if specified
                if (category !== 'all') {
                    reportData = reportData.filter(t => t.feedType === category);
                    }
                    break;
                    
            // Animal report types
            case 'all-animal':
                // Get animal inventory and transactions
                reportData = await loadAnimalData(category, startDate, endDate);
                break;
                
            case 'animal-inventory':
                // Get current animal inventory data
                reportData = await loadAnimalInventoryData(category, startDate, endDate);
                    break;
                
            case 'animal-movement':
                // Get animal movement data
                reportData = await loadAnimalMovementData(category, startDate, endDate);
                break;
                
            // New implementations for missing animal report types
            case 'animal-purchase':
                // Get animal purchase data
                reportData = await loadAnimalPurchaseData(category, startDate, endDate);
                break;
                
            case 'animal-sale':
                // Get animal sale data
                reportData = await loadAnimalSaleData(category, startDate, endDate);
                break;
                
            case 'animal-death':
                // Get animal death data
                reportData = await loadAnimalDeathData(category, startDate, endDate);
                break;
                
            case 'animal-birth':
                // Get animal birth data
                reportData = await loadAnimalBirthData(category, startDate, endDate);
                break;
                
            case 'animal-count':
                // Get animal count data
                reportData = await loadAnimalCountData(category, startDate, endDate);
                break;
                
            case 'animal-discrepancy':
                // Get animal discrepancy data
                reportData = await loadAnimalDiscrepancyData(category, startDate, endDate);
                break;
                
            default:
                console.warn(`Report type '${reportType}' not implemented yet`);
                reportData = [];
        }
        
        console.log(`Collected ${Array.isArray(reportData) ? reportData.length : 'object'} data items for report`);
        return reportData;
    }
    
    /**
     * Load Animal Data
     * @param {string} category - Optional animal category to filter by
     * @param {Date} startDate - Optional start date for filtering
     * @param {Date} endDate - Optional end date for filtering
     * @returns {Promise<Object>} Object with animal inventory and transactions
     */
    async function loadAnimalData(category, startDate, endDate) {
        try {
            // Load animal inventory from storage - await the result
            const animalInventoryStr = await mobileStorage.getItem('animalInventory') || '{}';
            console.log('Raw animalInventory string:', animalInventoryStr);
            
            let inventoryData;
            try {
                inventoryData = JSON.parse(animalInventoryStr);
                console.log('Parsed inventory data:', inventoryData);
            } catch (e) {
                console.error('Error parsing inventory data:', e);
                inventoryData = {};
            }

            // Convert inventory object to array format with proper structure
            let inventory = [];
            if (typeof inventoryData === 'object' && inventoryData !== null) {
                // Check if the data is already an array
                if (Array.isArray(inventoryData)) {
                    inventory = inventoryData;
                } else {
                    // Convert from object format to array format
                    inventory = Object.entries(inventoryData).map(([category, count]) => ({
                        id: category,
                        category: category,
                        count: typeof count === 'number' ? count : parseInt(count || 0),
                        location: 'Farm', // Default location
                        lastUpdated: new Date().toISOString(),
                        notes: ''
                    }));
                }
            }
            
            console.log('Converted inventory array:', inventory);
            
            // Filter by category if specified
            if (category && category !== 'all') {
                inventory = inventory.filter(item => item && item.category === category);
            }
            
            // Load recent activities
            const recentActivitiesStr = await mobileStorage.getItem('recentActivities') || '[]';
            let allActivities;
            try {
                allActivities = JSON.parse(recentActivitiesStr);
            } catch (e) {
                console.error('Error parsing activities:', e);
                allActivities = [];
            }
            
            // Ensure allActivities is an array
            if (!Array.isArray(allActivities)) {
                allActivities = [];
            }
            
            console.log('Debug - Activities loaded:', allActivities.length);
            
            // Filter activities to include only animal-related activities
            const animalTypes = ['add', 'buy', 'sell', 'birth', 'death', 'move'];
            let transactions = allActivities.filter(tx => 
                tx && animalTypes.includes(tx.type)
            );
            
            console.log('Debug - Animal activities found:', transactions.length);
            
            // Filter by date range if provided - FIX DATE COMPARISON
            if (startDate || endDate) {
                const startDateObj = startDate ? new Date(startDate) : null;
                const endDateObj = endDate ? new Date(endDate) : null;
                
                // Set time for endDate to end of day for proper comparison
                if (endDateObj) {
                    endDateObj.setHours(23, 59, 59, 999);
                }
                
                // Log date range for debugging
                console.log('Filtering by date range:', { 
                    start: startDateObj ? startDateObj.toISOString() : 'none',
                    end: endDateObj ? endDateObj.toISOString() : 'none'
                });
                
                transactions = transactions.filter(tx => {
                    if (!tx || (!tx.date && !tx.timestamp)) return false;
                    
                    // Create a date object from the transaction date
                    let txDate;
                    try {
                        txDate = new Date(tx.timestamp || tx.date);
                        
                        // For debugging, log some sample dates
                        if (transactions.indexOf(tx) < 3) {
                            console.log('Transaction date:', txDate.toISOString(), 'Original:', tx.timestamp || tx.date);
                        }
                        
                        // Skip invalid dates
                        if (isNaN(txDate.getTime())) {
                            console.log('Invalid date found:', tx.timestamp || tx.date);
                            return false;
                        }
                    } catch (e) {
                        console.error('Error parsing transaction date:', e);
                        return false;
                    }
                    
                    // Normalize dates to avoid time issues - compare only the date portion
                    const txDateStr = txDate.toISOString().split('T')[0];
                    const startDateStr = startDateObj ? startDateObj.toISOString().split('T')[0] : null;
                    const endDateStr = endDateObj ? endDateObj.toISOString().split('T')[0] : null;
                    
                    // Check if within range
                    if (startDateStr && txDateStr < startDateStr) return false;
                    if (endDateStr && txDateStr > endDateStr) return false;
                    
                    return true;
                });
            } else {
                // If no date filtering, show all transactions (limited to most recent 50)
                console.log('No date filtering applied, showing all transactions');
                transactions = transactions.slice(0, 50);
            }
            
            // Filter by category if provided
            if (category && category !== 'all') {
                transactions = transactions.filter(tx => tx.category === category);
            }
            
            console.log('Debug - After filtering:', transactions.length);
            if (inventory.length > 0) {
                console.log('Debug - Inventory structure:', inventory[0]);
            }
            
            return {
                inventory,
                transactions
            };
        } catch (error) {
            console.error('Error in loadAnimalData:', error);
            throw error;
        }
    }
    
    /**
     * Load animal inventory data
     * @param {string} category - Animal category to filter by
     * @param {Date} startDate - Start date for filtering
     * @param {Date} endDate - End date for filtering
     * @returns {Object} Filtered animal data
     */
    async function loadAnimalInventoryData(category, startDate, endDate) {
        console.log('Loading animal inventory data');
        
        // Get animal data
        const animalData = await loadAnimalData(category, startDate, endDate);
        
        // Filter inventory by category if needed
        if (category !== 'all') {
            animalData.inventory = animalData.inventory.filter(a => a.category === category);
        }
        
        return animalData;
    }
    
    /**
     * Load animal movement data
     * @param {string} category - Animal category to filter by
     * @param {Date} startDate - Start date for filtering
     * @param {Date} endDate - End date for filtering
     * @returns {Object} Filtered animal data with movement transactions
     */
    async function loadAnimalMovementData(category, startDate, endDate) {
        console.log('Loading animal movement data');
        
        // Get animal data
        const animalData = await loadAnimalData(category, startDate, endDate);
        
        // Filter transactions to include only movement types - using the correct type values
        animalData.transactions = animalData.transactions.filter(tx => 
            tx.type === 'move' || tx.type === 'buy' || tx.type === 'sell');
        
        return animalData;
    }
    
    /**
     * Load animal purchase data
     * @param {string} category - Animal category to filter by
     * @param {Date} startDate - Start date for filtering
     * @param {Date} endDate - End date for filtering
     * @returns {Object} Filtered animal data with purchase transactions
     */
    async function loadAnimalPurchaseData(category, startDate, endDate) {
        console.log('Loading animal purchase data');
        
        // Get animal data
        const animalData = await loadAnimalData(category, startDate, endDate);
        
        // Filter transactions to include only purchase types
        animalData.transactions = animalData.transactions.filter(tx => tx.type === 'buy');
        
        // Load additional purchase data if available
        try {
            const purchasesStr = await mobileStorage.getItem('animalPurchases');
            if (purchasesStr) {
                const purchases = JSON.parse(purchasesStr);
                if (Array.isArray(purchases) && purchases.length > 0) {
                    console.log(`Found ${purchases.length} purchase records in storage`);
                    
                    // Filter by date and category
                    let filteredPurchases = purchases;
                    
                    // Filter by date
                    if (startDate || endDate) {
                        filteredPurchases = filteredPurchases.filter(p => {
                            if (!p || !p.date) return false;
                            const purchaseDate = new Date(p.date);
                            const start = startDate ? new Date(startDate) : null;
                            const end = endDate ? new Date(endDate) : null;
                            
                            if (start && purchaseDate < start) return false;
                            if (end && purchaseDate > end) return false;
                            
                            return true;
                        });
                    }
                    
                    // Filter by category
                    if (category && category !== 'all') {
                        filteredPurchases = filteredPurchases.filter(p => p.category === category);
                    }
                    
                    // Add to data
                    animalData.purchases = filteredPurchases;
                }
            }
        } catch (e) {
            console.error('Error loading animal purchases:', e);
            animalData.purchases = [];
        }
        
        return animalData;
    }
    
    /**
     * Load animal sale data
     * @param {string} category - Animal category to filter by
     * @param {Date} startDate - Start date for filtering
     * @param {Date} endDate - End date for filtering
     * @returns {Object} Filtered animal data with sale transactions
     */
    async function loadAnimalSaleData(category, startDate, endDate) {
        console.log('Loading animal sale data');
        
        // Get animal data
        const animalData = await loadAnimalData(category, startDate, endDate);
        
        // Filter transactions to include only sale types
        animalData.transactions = animalData.transactions.filter(tx => tx.type === 'sell');
        
        // Load additional sales data if available
        try {
            const salesStr = await mobileStorage.getItem('animalSales');
            if (salesStr) {
                const sales = JSON.parse(salesStr);
                if (Array.isArray(sales) && sales.length > 0) {
                    console.log(`Found ${sales.length} sale records in storage`);
                    
                    // Filter by date and category
                    let filteredSales = sales;
                    
                    // Filter by date
                    if (startDate || endDate) {
                        filteredSales = filteredSales.filter(s => {
                            if (!s || !s.date) return false;
                            const saleDate = new Date(s.date);
                            const start = startDate ? new Date(startDate) : null;
                            const end = endDate ? new Date(endDate) : null;
                            
                            if (start && saleDate < start) return false;
                            if (end && saleDate > end) return false;
                            
                            return true;
                        });
                    }
                    
                    // Filter by category
                    if (category && category !== 'all') {
                        filteredSales = filteredSales.filter(s => s.category === category);
                    }
                    
                    // Add to data
                    animalData.sales = filteredSales;
                }
            }
        } catch (e) {
            console.error('Error loading animal sales:', e);
            animalData.sales = [];
        }
        
        return animalData;
    }
    
    /**
     * Load animal birth data
     * @param {string} category - Animal category to filter by
     * @param {Date} startDate - Start date for filtering
     * @param {Date} endDate - End date for filtering
     * @returns {Object} Filtered animal data with birth transactions
     */
    async function loadAnimalBirthData(category, startDate, endDate) {
        console.log('Loading animal birth data');
        
        // Get animal data
        const animalData = await loadAnimalData(category, startDate, endDate);
        
        // Filter transactions to include only birth types
        animalData.transactions = animalData.transactions.filter(tx => tx.type === 'birth');
        
        return animalData;
    }
    
    /**
     * Load animal death data
     * @param {string} category - Animal category to filter by
     * @param {Date} startDate - Start date for filtering
     * @param {Date} endDate - End date for filtering
     * @returns {Object} Filtered animal data with death transactions
     */
    async function loadAnimalDeathData(category, startDate, endDate) {
        console.log('Loading animal death data');
        
        // Get animal data
        const animalData = await loadAnimalData(category, startDate, endDate);
        
        // Filter transactions to include only death types
        animalData.transactions = animalData.transactions.filter(tx => tx.type === 'death');
        
        return animalData;
    }
    
    /**
     * Load animal count data
     * @param {string} category - Animal category to filter by
     * @param {Date} startDate - Start date for filtering
     * @param {Date} endDate - End date for filtering
     * @returns {Object} Filtered animal data with count transactions
     */
    async function loadAnimalCountData(category, startDate, endDate) {
        console.log('Loading animal count data');
        
        // Get animal data
        const animalData = await loadAnimalData(category, startDate, endDate);
        
        // Add stock counts
        try {
            const stockCountsStr = await mobileStorage.getItem('stockCounts');
            if (stockCountsStr) {
                const stockCounts = JSON.parse(stockCountsStr);
                if (Array.isArray(stockCounts) && stockCounts.length > 0) {
                    console.log(`Found ${stockCounts.length} stock count records`);
                    
                    // Filter by date and category
                    let filteredCounts = stockCounts;
                    
                    // Filter by date
                    if (startDate || endDate) {
                        filteredCounts = filteredCounts.filter(c => {
                            if (!c || !c.date) return false;
                            const countDate = new Date(c.date);
                            const start = startDate ? new Date(startDate) : null;
                            const end = endDate ? new Date(endDate) : null;
                            
                            if (start && countDate < start) return false;
                            if (end && countDate > end) return false;
                            
                            return true;
                        });
                    }
                    
                    // Filter by category
                    if (category && category !== 'all') {
                        filteredCounts = filteredCounts.filter(c => c.category === category);
                    }
                    
                    // Add to data
                    animalData.counts = filteredCounts;
                } else {
                    animalData.counts = [];
                }
            } else {
                animalData.counts = [];
            }
        } catch (e) {
            console.error('Error loading stock counts:', e);
            animalData.counts = [];
        }
        
        // Filter transactions to include only stock-count types from activities
        animalData.transactions = animalData.transactions.filter(tx => tx.type === 'stock-count');
        
        return animalData;
    }
    
    /**
     * Load animal discrepancy data
     * @param {string} category - Animal category to filter by
     * @param {Date} startDate - Start date for filtering
     * @param {Date} endDate - End date for filtering
     * @returns {Object} Filtered animal discrepancy data
     */
    async function loadAnimalDiscrepancyData(category, startDate, endDate) {
        console.log('Loading animal discrepancy data');
        
        // Get animal data (for inventory reference)
        const animalData = await loadAnimalData(category, startDate, endDate);
        
        // Load discrepancies
        try {
            const discrepanciesStr = await mobileStorage.getItem('stockDiscrepancies');
            if (discrepanciesStr) {
                const discrepancies = JSON.parse(discrepanciesStr);
                if (Array.isArray(discrepancies) && discrepancies.length > 0) {
                    console.log(`Found ${discrepancies.length} stock discrepancy records`);
                    
                    // Log some data for debugging
                    if (discrepancies.length > 0) {
                        console.log('Sample discrepancy data:', JSON.stringify(discrepancies[0]));
                        console.log('Date field available:', discrepancies[0].timestamp || discrepancies[0].date || 'none');
                    }
                    
                    // Filter by date and category with more flexible date handling
                    let filteredDiscrepancies = [...discrepancies]; // Start with a copy of all discrepancies
                    
                    // Filter by date if dates are provided
                    if (startDate || endDate) {
                        const startDateObj = startDate ? new Date(startDate) : null;
                        const endDateObj = endDate ? new Date(endDate) : null;
                        
                        // Set time for endDate to end of day for proper comparison
                        if (endDateObj) {
                            endDateObj.setHours(23, 59, 59, 999);
                        }
                        
                        filteredDiscrepancies = filteredDiscrepancies.filter(d => {
                            if (!d) return false;
                            
                            // Look for date fields in multiple places with fallbacks
                            let discrepancyDate;
                            try {
                                // Try various possible date fields
                                const dateValue = d.timestamp || d.date || d.createdAt || d.created || null;
                                if (!dateValue) {
                                    console.log('No date field found for record:', JSON.stringify(d));
                                    return true; // Keep records without dates rather than filtering them out
                                }
                                
                                discrepancyDate = new Date(dateValue);
                                
                                // Skip invalid dates
                                if (isNaN(discrepancyDate.getTime())) {
                                    console.log('Invalid date found:', dateValue);
                                    return true; // Keep records with invalid dates
                                }
                            } catch (e) {
                                console.error('Error parsing discrepancy date:', e);
                                return true; // Keep records with problematic dates
                            }
                            
                            // Compare dates - only filter if we have valid dates to compare against
                            if (startDateObj && discrepancyDate < startDateObj) return false;
                            if (endDateObj && discrepancyDate > endDateObj) return false;
                            
                            return true;
                        });
                    }
                    
                    // Filter by category if specified
                    if (category && category !== 'all') {
                        filteredDiscrepancies = filteredDiscrepancies.filter(d => d.category === category);
                    }
                    
                    console.log(`After filtering: ${filteredDiscrepancies.length} discrepancies remaining`);
                    
                    // Add to data
                    animalData.discrepancies = filteredDiscrepancies;
                } else {
                    console.log('No discrepancies found in storage or empty array');
                    animalData.discrepancies = [];
                }
            } else {
                console.log('No discrepancies storage found');
                animalData.discrepancies = [];
            }
        } catch (e) {
            console.error('Error loading stock discrepancies:', e);
            animalData.discrepancies = [];
        }
        
        return animalData;
    }
    
    /**
     * Create All Feed Report Table
     * @param {Array} data - Feed transaction data
     * @returns {string} HTML for the report
     */
    function createAllFeedReportTable(data) {
        // Calculate summary statistics
        const purchaseCount = data.filter(t => t.type === 'purchase').length;
        const usageCount = data.filter(t => t.type === 'usage').length;
        const totalPurchaseCost = data
            .filter(t => t.type === 'purchase')
            .reduce((sum, t) => {
                // Try multiple properties where cost might be stored
                const cost = t.totalPrice || t.cost || t.totalCost || 0;
                return sum + parseFloat(cost);
            }, 0);
        
        let reportHTML = `
            <div class="report-header">
                <div class="report-type-header">
                    <div class="report-type-title">All Feed Transactions Report</div>
                    <div class="report-actions">
                        <button onclick="window.print()" class="print-button">Print Report</button>
                        <button onclick="exportReportToCSV('all-feed')" class="export-button">Export to CSV</button>
                    </div>
                </div>
            <div class="report-summary">
                    <p>Total transactions: ${data.length}</p>
                    <p>Purchases: ${purchaseCount} transactions (${formatCurrency(totalPurchaseCost)})</p>
                    <p>Usage: ${usageCount} transactions</p>
                </div>
            </div>
            
            <div class="report-section">
                <h3>Feed Transactions</h3>
                <table class="report-table" id="all-feed-table">
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
        
        // Sort transactions by date (newest first)
        const sortedData = [...data].sort((a, b) => {
            return new Date(b.date) - new Date(a.date);
        });
        
        // Add rows for each transaction
        sortedData.forEach(transaction => {
            const date = formatDate(transaction.date);
            const type = transaction.type === 'purchase' ? 'Purchase' : 'Usage';
            const feedType = transaction.feedType || 'Unknown';
            const quantity = transaction.quantity || '0';
            const unit = transaction.unit || '';
            
            // Format cost based on transaction type
            let costDisplay = '';
            if (transaction.type === 'purchase') {
                // Try various possible cost property names
                const cost = transaction.totalPrice || transaction.cost || transaction.totalCost || 0;
                costDisplay = formatCurrency(cost);
            } else if (transaction.type === 'usage') {
                // Try various possible cost property names
                const cost = transaction.totalCost || transaction.estimatedCost || 0;
                costDisplay = formatCurrency(cost);
            }
            
            const notes = transaction.notes || '';
            
            reportHTML += `
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
        
        reportHTML += `
                    </tbody>
                </table>
                </div>
            `;
        
        return reportHTML;
    }
    
    /**
     * Create Feed Purchase Report Table
     * @param {Array} data - Feed purchase transaction data
     * @returns {string} HTML for the report
     */
    function createFeedPurchaseTable(data) {
        // Calculate total cost
        const totalCost = data.reduce((sum, t) => {
            // Try multiple properties where cost might be stored
            const cost = t.totalPrice || t.cost || t.totalCost || 0;
            return sum + parseFloat(cost);
        }, 0);
        
        let reportHTML = `
            <div class="report-header">
                <div class="report-type-header">
                    <div class="report-type-title">Feed Purchases Report</div>
                    <div class="report-actions">
                        <button onclick="window.print()" class="print-button">Print Report</button>
                        <button onclick="exportReportToCSV('feed-purchases')" class="export-button">Export to CSV</button>
                    </div>
                </div>
                <div class="report-summary">
                    <p>Total purchases: ${data.length}</p>
                    <p>Total cost: ${formatCurrency(totalCost)}</p>
                </div>
            </div>
            
            <div class="report-section">
                <h3>Feed Purchases</h3>
                <table class="report-table" id="feed-purchases-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                            <th>Feed</th>
                            <th>Quantity</th>
                            <th>Unit</th>
                            <th>Cost</th>
                            <th>Unit Cost</th>
                            <th>Supplier</th>
                            <th>Notes</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        // Sort purchases by date (newest first)
        const sortedData = [...data].sort((a, b) => {
            return new Date(b.date) - new Date(a.date);
        });
        
        // Add rows for each purchase
        sortedData.forEach(purchase => {
            const date = formatDate(purchase.date);
            const feedType = purchase.feedType || 'Unknown';
            const quantity = purchase.quantity || '0';
            const unit = purchase.unit || '';
            
            // Try multiple properties where cost might be stored
            const purchaseCost = purchase.totalPrice || purchase.cost || purchase.totalCost || 0;
            const cost = formatCurrency(purchaseCost);
            
            // Calculate unit cost
            let unitCost = 0;
            if (purchase.quantity > 0 && purchaseCost > 0) {
                unitCost = purchaseCost / purchase.quantity;
            }
            const unitCostDisplay = formatCurrency(unitCost);
            
            const supplier = purchase.supplier || '';
            const notes = purchase.notes || '';
            
            reportHTML += `
                <tr>
                    <td>${date}</td>
                    <td>${feedType}</td>
                    <td>${quantity}</td>
                    <td>${unit}</td>
                    <td>${cost}</td>
                    <td>${unitCostDisplay}</td>
                    <td>${supplier}</td>
                    <td>${notes}</td>
                </tr>
            `;
        });
        
        reportHTML += `
                        </tbody>
                    </table>
                </div>
        `;
        
        return reportHTML;
    }
    
    /**
     * Create Feed Usage Report Table
     * @param {Array} data - Feed usage transaction data
     * @returns {string} HTML for the report
     */
    function createFeedUsageTable(data) {
        // Calculate total cost
        const totalCost = data.reduce((sum, t) => {
            // Try multiple properties where cost might be stored
            const cost = t.totalCost || t.estimatedCost || t.cost || 0;
            return sum + parseFloat(cost);
        }, 0);
        
        let reportHTML = `
            <div class="report-header">
                <div class="report-type-header">
                    <div class="report-type-title">Feed Usage Report</div>
                    <div class="report-actions">
                        <button onclick="window.print()" class="print-button">Print Report</button>
                        <button onclick="exportReportToCSV('feed-usage')" class="export-button">Export to CSV</button>
            </div>
                </div>
                <div class="report-summary">
                    <p>Total usage records: ${data.length}</p>
                    <p>Total cost: ${formatCurrency(totalCost)}</p>
                </div>
            </div>
            
            <div class="report-section">
                <h3>Feed Usage</h3>
                <table class="report-table" id="feed-usage-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Feed</th>
                            <th>Quantity</th>
                            <th>Unit</th>
                            <th>Weight Equivalent</th>
                            <th>Cost</th>
                            <th>Used For</th>
                            <th>Notes</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // Sort usage by date (newest first)
        const sortedData = [...data].sort((a, b) => {
            const aDate = new Date(a.date || a.timestamp || 0);
            const bDate = new Date(b.date || b.timestamp || 0);
            return bDate - aDate;
        });
        
        // Add rows for each usage record
        sortedData.forEach(usage => {
            // Try multiple properties where date might be stored
            const date = formatDate(usage.date || usage.timestamp);
            
            // Try multiple properties where feed type might be stored
            const feedType = usage.feedType || usage.name || usage.type || 'Unknown';
            
            // Try multiple properties where quantity might be stored
            const quantity = usage.quantity || usage.amount || usage.count || 0;
            
            // Try multiple properties where unit might be stored
            const unit = usage.unit || usage.units || '';
            
            // Calculate weight equivalent - try ALL possible properties for weight per unit
            let weightEquivalent = '-';
            const quantityNum = parseFloat(quantity);
            
            if (!isNaN(quantityNum) && quantityNum > 0) {
                // Check if already calculated
                if (usage.weightEquivalent) {
                    weightEquivalent = `${usage.weightEquivalent} kg`;
                }
                // Check for weightPerUnit and variations
                else if (usage.weightPerUnit) {
                    const weight = parseFloat(usage.weightPerUnit) * quantityNum;
                    weightEquivalent = `${weight.toFixed(2)} kg`;
                }
                else if (usage.unitWeight) {
                    const weight = parseFloat(usage.unitWeight) * quantityNum;
                    weightEquivalent = `${weight.toFixed(2)} kg`;
                }
                else if (usage.weightKg) {
                    const weight = parseFloat(usage.weightKg) * quantityNum;
                    weightEquivalent = `${weight.toFixed(2)} kg`;
                }
                else if (usage.weightPerKg) {
                    const weight = parseFloat(usage.weightPerKg) * quantityNum;
                    weightEquivalent = `${weight.toFixed(2)} kg`;
                }
                else if (usage.kgPerUnit) {
                    const weight = parseFloat(usage.kgPerUnit) * quantityNum;
                    weightEquivalent = `${weight.toFixed(2)} kg`;
                }
                else if (usage.weight && usage.weightUnit === 'per unit') {
                    const weight = parseFloat(usage.weight) * quantityNum;
                    weightEquivalent = `${weight.toFixed(2)} kg`;
                }
                // Direct weight property (last resort)
                else if (usage.weight) {
                    weightEquivalent = `${usage.weight} kg`;
                }
                // Try to fetch from feed type definition if available in the system
                else if (usage.feedTypeId || usage.feedId) {
                    // This assumes feedTypes might be in scope - add appropriate logic for your application
                    const feedTypeId = usage.feedTypeId || usage.feedId;
                    if (window.feedTypes && window.feedTypes[feedTypeId] && window.feedTypes[feedTypeId].weightPerUnit) {
                        const weight = parseFloat(window.feedTypes[feedTypeId].weightPerUnit) * quantityNum;
                        weightEquivalent = `${weight.toFixed(2)} kg`;
                    }
                }
            }
            
            // Try multiple properties where cost might be stored
            const cost = usage.totalCost || usage.estimatedCost || usage.cost || 0;
            const costFormatted = formatCurrency(cost);
            
            // Try multiple properties where "used for" might be stored
            const usedFor = usage.usedFor || usage.animalCategory || usage.category || usage.animal || usage.animalType || '-';
            
            // Try multiple properties where notes might be stored
            const notes = usage.notes || usage.description || usage.comment || '';
            
            reportHTML += `
                <tr>
                    <td>${date}</td>
                    <td>${feedType}</td>
                    <td>${quantity}</td>
                    <td>${unit}</td>
                    <td>${weightEquivalent}</td>
                    <td>${costFormatted}</td>
                    <td>${usedFor}</td>
                    <td>${notes}</td>
                </tr>
            `;
        });
        
        reportHTML += `
                    </tbody>
                </table>
            </div>
        `;
        
        return reportHTML;
    }
    
    /**
     * Create Feed Inventory Report Table
     * @param {Object} data - Object containing feed inventory and transactions
     * @returns {string} HTML for the report
     */
    function createFeedInventoryTable(data) {
        const { feedInventory, feedTransactions } = data;
        
        // Check if we have any inventory data
        if (!feedInventory || feedInventory.length === 0) {
            return `
                <div class="report-header">
                    <div class="report-type-header">
                        <div class="report-type-title">Feed Inventory Report</div>
                    </div>
                    <div class="report-summary">
                        <p>No feed inventory data found. To view this report, please add feed items to your inventory.</p>
                    </div>
                </div>
            `;
        }
        
        // Log the entire inventory data structure for debugging
        console.log('Full Feed inventory data:', JSON.stringify(feedInventory));
        
        // Calculate total inventory value with more property checks
        const totalValue = feedInventory.reduce((sum, item) => {
            // Find the key property name - it could be the object key in a Map structure
            let quantity = 0;
            let unitPrice = 0;
            
            // The data might be in a Map.entries() format with [key, value] pairs
            if (Array.isArray(item) && item.length === 2) {
                // If it's a Map entry with [key, value]
                const feedType = item[0];
                const details = item[1];
                
                // Log the structure
                console.log(`Feed item as Map entry: ${feedType}`, details);
                
                // Get values from the details object
                quantity = parseFloat(details.quantity || details.amount || details.count || 0);
                unitPrice = parseFloat(details.price || details.unitPrice || details.costPerUnit || 0);
            } else {
                // Standard object format
                quantity = parseFloat(item.quantity || item.amount || item.count || 0);
                unitPrice = parseFloat(item.unitPrice || item.price || item.costPerUnit || 0);
            }
            
            return sum + (quantity * unitPrice);
        }, 0);
        
        let reportHTML = `
            <div class="report-header">
                <div class="report-type-header">
                    <div class="report-type-title">Feed Inventory Report</div>
                    <div class="report-actions">
                        <button onclick="window.print()" class="print-button">Print Report</button>
                        <button onclick="exportReportToCSV('feed-inventory')" class="export-button">Export to CSV</button>
                    </div>
                </div>
                <div class="report-summary">
                    <p>Total inventory items: ${feedInventory.length}</p>
                    <p>Estimated inventory value: ${formatCurrency(totalValue)}</p>
                    <p>Recent transactions: ${feedTransactions.length}</p>
                </div>
            </div>
            
            <div class="report-section">
                <h3>Current Inventory</h3>
                <table class="report-table" id="feed-inventory-table">
                    <thead>
                        <tr>
                            <th>Feed Type</th>
                            <th>Quantity</th>
                            <th>Unit</th>
                            <th>Unit Price</th>
                            <th>Total Value</th>
                            <th>Last Updated</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // Process inventory items handling different data formats
        const processedInventory = [];
        
        // Process the inventory data which could be in different formats
        feedInventory.forEach(item => {
            if (Array.isArray(item) && item.length === 2) {
                // This is a Map entry [key, value] format
                const feedType = item[0];
                const details = item[1];
                
                processedInventory.push({
                    feedType: feedType,
                    quantity: details.quantity || 0,
                    unit: details.unit || 'kg',
                    price: details.price || 0,
                    supplier: details.supplier || '',
                    lastUpdated: details.lastUpdated || new Date().toISOString()
                });
            } else {
                // Regular object format
                processedInventory.push(item);
            }
        });
        
        // Sort inventory alphabetically by feed type
        const sortedInventory = [...processedInventory].sort((a, b) => {
            const aType = a.feedType || a.name || a.type || 'Unknown';
            const bType = b.feedType || b.name || b.type || 'Unknown';
            return aType.localeCompare(bType);
        });
        
        // Add rows for each inventory item
        sortedInventory.forEach(item => {
            // Try multiple properties where feed type might be stored
            let feedType = 'Unknown';
            if (typeof item.feedType === 'string') feedType = item.feedType;
            else if (item.name) feedType = item.name;
            else if (item.type) feedType = item.type;
            else if (item[0] && typeof item[0] === 'string') feedType = item[0]; // For [key, value] pairs
            
            // Try multiple properties where quantity might be stored
            let quantity = '0';
            let quantityValue = 0;
            
            if (item.quantity !== undefined) {
                quantity = item.quantity;
                quantityValue = parseFloat(item.quantity);
            } else if (item.amount !== undefined) {
                quantity = item.amount;
                quantityValue = parseFloat(item.amount);
            } else if (item.count !== undefined) {
                quantity = item.count;
                quantityValue = parseFloat(item.count);
            } else if (item[1] && item[1].quantity !== undefined) {
                // For [key, value] pairs
                quantity = item[1].quantity;
                quantityValue = parseFloat(item[1].quantity);
            }
            
            // Try multiple properties where unit might be stored
            let unit = 'kg';
            if (item.unit) unit = item.unit;
            else if (item.units) unit = item.units;
            else if (item[1] && item[1].unit) unit = item[1].unit;
            
            // Try multiple properties where unit price might be stored
            let unitPriceValue = 0;
            if (item.unitPrice !== undefined) unitPriceValue = parseFloat(item.unitPrice);
            else if (item.price !== undefined) unitPriceValue = parseFloat(item.price);
            else if (item.costPerUnit !== undefined) unitPriceValue = parseFloat(item.costPerUnit);
            else if (item[1] && item[1].price !== undefined) unitPriceValue = parseFloat(item[1].price);
            
            const unitPrice = formatCurrency(unitPriceValue);
            
            // Calculate total value
            const totalItemValue = quantityValue * unitPriceValue;
            const totalValueDisplay = formatCurrency(totalItemValue);
            
            // Try multiple properties where last updated date might be stored
            let lastUpdated;
            if (item.lastUpdated) lastUpdated = formatDate(item.lastUpdated);
            else if (item.updated) lastUpdated = formatDate(item.updated);
            else if (item.date) lastUpdated = formatDate(item.date);
            else if (item.timestamp) lastUpdated = formatDate(item.timestamp);
            else if (item[1] && item[1].lastUpdated) lastUpdated = formatDate(item[1].lastUpdated);
            else lastUpdated = formatDate(new Date().toISOString());
            
            reportHTML += `
                <tr>
                    <td>${feedType}</td>
                    <td>${quantity}</td>
                    <td>${unit}</td>
                    <td>${unitPrice}</td>
                    <td>${totalValueDisplay}</td>
                    <td>${lastUpdated}</td>
                </tr>
            `;
        });

        reportHTML += `
                    </tbody>
                </table>
            </div>

            <div class="report-section">
                <h3>Recent Transactions</h3>
                <table class="report-table" id="feed-transactions-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Feed</th>
                            <th>Quantity</th>
                            <th>Unit</th>
                            <th>Value</th>
                            <th>Notes</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        // Sort transactions by date (newest first)
        const sortedTransactions = [...feedTransactions].sort((a, b) => {
            const aDate = new Date(a.date || a.timestamp || 0);
            const bDate = new Date(b.date || b.timestamp || 0);
            return bDate - aDate;
        });
        
        // Add rows for recent transactions
        sortedTransactions.forEach(transaction => {
            // Try multiple properties where date might be stored
            const date = formatDate(transaction.date || transaction.timestamp);
            
            // Get transaction type
            const type = transaction.type === 'purchase' ? 'Purchase' : 'Usage';
            
            // Try multiple properties where feed type might be stored
            const feedType = transaction.feedType || transaction.name || transaction.type || 'Unknown';
            
            // Try multiple properties where quantity might be stored
            const quantity = transaction.quantity || transaction.amount || transaction.count || '0';
            
            // Try multiple properties where unit might be stored
            const unit = transaction.unit || transaction.units || '';
            
            // Format value based on transaction type
            let valueDisplay = '';
            if (transaction.type === 'purchase') {
                // Try multiple properties where cost might be stored
                const cost = transaction.totalPrice || transaction.cost || transaction.totalCost || 0;
                valueDisplay = formatCurrency(cost);
            } else if (transaction.type === 'usage') {
                // Try multiple properties where cost might be stored
                const cost = transaction.totalCost || transaction.cost || 0;
                valueDisplay = formatCurrency(cost);
            }
            
            // Try multiple properties where notes might be stored
            const notes = transaction.notes || transaction.description || transaction.comment || '';
            
            reportHTML += `
                <tr class="${transaction.type}-row">
                    <td>${date}</td>
                    <td>${type}</td>
                    <td>${feedType}</td>
                    <td>${quantity}</td>
                    <td>${unit}</td>
                    <td>${valueDisplay}</td>
                    <td>${notes}</td>
                </tr>
            `;
        });

        reportHTML += `
                    </tbody>
                </table>
            </div>
        `;

        return reportHTML;
    }
    
    /**
     * Create All Animal Report Table
     * @param {Object} data - Object with animal inventory and transactions
     * @returns {string} HTML for the report
     */
    function createAllAnimalReportTable(data) {
        // Ensure data exists
        if (!data) {
            console.error('No data provided to createAllAnimalReportTable');
            return `<div class="error-message">Error: No animal data available</div>`;
        }
        
        // Destructure with defaults to ensure we always have arrays
        const { inventory = [], transactions = [] } = data;
        
        // Ensure inventory is an array
        const inventoryArray = Array.isArray(inventory) ? inventory : 
                             (inventory ? Object.values(inventory) : []);
        
        // Log the inventory structure for debugging
        if (inventoryArray.length > 0) {
            console.log('First inventory item structure:', JSON.stringify(inventoryArray[0]));
        } else {
            console.log('No inventory items found');
        }
        
        // Ensure transactions is an array
        const transactionsArray = Array.isArray(transactions) ? transactions : 
                                 (transactions ? Object.values(transactions) : []);
                                 
        // Log the transactions structure for debugging
        if (transactionsArray.length > 0) {
            console.log('First transaction structure:', JSON.stringify(transactionsArray[0]));
            console.log('Transaction types available:', 
                [...new Set(transactionsArray.filter(t => t?.type).map(t => t.type))]);
        } else {
            console.log('No transactions found');
        }
        
        // Count by type with proper transaction type values
        const addCount = transactionsArray.filter(t => t?.type === 'add').length;
        const purchaseCount = transactionsArray.filter(t => t?.type === 'buy').length;
        const saleCount = transactionsArray.filter(t => t?.type === 'sell').length;
        const deathCount = transactionsArray.filter(t => t?.type === 'death').length;
        const birthCount = transactionsArray.filter(t => t?.type === 'birth').length;
        const moveCount = transactionsArray.filter(t => t?.type === 'move').length;
        
        // Calculate animal counts
        const totalAnimals = inventoryArray.reduce((sum, item) => {
            // Handle count field that might be a string or number
            const count = parseInt(item?.count || 0);
            return sum + (isNaN(count) ? 0 : count);
        }, 0);
        
        // Prepare categories for grouping
        const animalsByType = {};
        
        // Group inventory by animal type with proper defaults
        inventoryArray.forEach(item => {
            if (!item) return;
            
            const type = item.category || item.animalType || 'Unknown';
            const count = parseInt(item.count || 0);
            const location = item.location || 'Farm';
            
            if (!animalsByType[type]) {
                animalsByType[type] = {
                    count: 0,
                    locations: {}
                };
            }
            
            animalsByType[type].count += isNaN(count) ? 0 : count;
            
            if (!animalsByType[type].locations[location]) {
                animalsByType[type].locations[location] = 0;
            }
            
            animalsByType[type].locations[location] += isNaN(count) ? 0 : count;
        });
        
        let reportHTML = `
            <div class="report-header">
                <div class="report-type-header">
                    <div class="report-type-title">All Animal Report</div>
                    <div class="report-actions">
                        <button onclick="window.print()" class="print-button">Print Report</button>
                        <button onclick="exportReportToCSV('all-animal')" class="export-button">Export to CSV</button>
                    </div>
                </div>
                <div class="report-summary">
                    <p>Total animals in inventory: <strong>${totalAnimals}</strong></p>
                    <div class="transaction-summary">
                        <h4>Transaction Summary:</h4>
                        <ul>
                            <li>Manual Additions: ${addCount}</li>
                            <li>Purchases: ${purchaseCount}</li>
                            <li>Sales: ${saleCount}</li>
                            <li>Births: ${birthCount}</li>
                            <li>Deaths: ${deathCount}</li>
                            <li>Movements: ${moveCount}</li>
                        </ul>
                    </div>
                </div>
            </div>
            
            <div class="report-section">
                <h3>Current Inventory</h3>
                <table class="report-table" id="animal-inventory-table">
                    <thead>
                        <tr>
                            <th>Animal Type</th>
                            <th>Count</th>
                            <th>Locations</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // Add a row for each animal type with details
        Object.keys(animalsByType).sort().forEach(type => {
            if (type === 'Unknown' && animalsByType[type].count === 0) return;
            
            const typeData = animalsByType[type];
            
            // Format locations as a list
            let locationsHtml = '';
            Object.keys(typeData.locations).forEach(location => {
                if (typeData.locations[location] > 0) {
                    locationsHtml += `<div>${location}: ${typeData.locations[location]}</div>`;
                }
            });
            
            if (!locationsHtml) {
                locationsHtml = 'Unknown';
            }
            
            reportHTML += `
                <tr>
                    <td>${type}</td>
                    <td>${typeData.count}</td>
                    <td>${locationsHtml}</td>
                </tr>
            `;
        });
        
        reportHTML += `
                    </tbody>
                </table>
            </div>
            
            <div class="report-section">
                <h3>Recent Transactions</h3>
                <table class="report-table" id="animal-transactions-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Animal Type</th>
                            <th>Count</th>
                            <th>Details</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // Sort transactions by date (newest first) with safe date handling
        const sortedTransactions = [...transactionsArray].sort((a, b) => {
            const dateA = a?.timestamp ? new Date(a.timestamp) : 
                         (a?.date ? new Date(a.date) : new Date(0));
            const dateB = b?.timestamp ? new Date(b.timestamp) : 
                         (b?.date ? new Date(b.date) : new Date(0));
            return dateB - dateA;
        });
        
        // Limit to most recent 20 transactions
        const recentTransactions = sortedTransactions.slice(0, 20);
        
        // Add a row for each transaction
        recentTransactions.forEach(transaction => {
            if (!transaction) return;
            
            const date = formatDate(transaction.timestamp || transaction.date || new Date());
            
            // Format type
            let typeDisplay = 'Unknown';
            switch (transaction.type) {
                case 'add': typeDisplay = 'Manual Addition'; break;
                case 'buy': typeDisplay = 'Purchase'; break;
                case 'sell': typeDisplay = 'Sale'; break;
                case 'birth': typeDisplay = 'Birth'; break;
                case 'death': typeDisplay = 'Death'; break;
                case 'move': typeDisplay = 'Movement'; break;
                default: typeDisplay = transaction.type || 'Unknown';
            }
            
            const animalType = transaction.category || transaction.animalType || 'Unknown';
            const count = transaction.quantity || transaction.count || '0';
            
            // Compile details based on transaction type
                let details = '';
            switch (transaction.type) {
                case 'add':
                    details = `Added by: ${transaction.addedBy || 'User'}`;
                    break;
                case 'buy':
                    details = `Price: ${formatCurrency(transaction.price)} - Supplier: ${transaction.supplier || 'Unknown'}`;
                    break;
                case 'sell':
                    details = `Price: ${formatCurrency(transaction.price)} - Buyer: ${transaction.buyer || transaction.customer || 'Unknown'}`;
                    break;
                case 'birth':
                    details = `Mother: ${transaction.mother || 'Unknown'}`;
                    break;
                case 'death':
                    details = `Cause: ${transaction.cause || 'Unknown'}`;
                    break;
                case 'move':
                    details = `From: ${transaction.fromLocation || 'Unknown'} - To: ${transaction.toLocation || 'Unknown'}`;
                    break;
                default:
                    details = transaction.notes || '';
            }
            
            reportHTML += `
                <tr class="${transaction.type}-row">
                    <td>${date}</td>
                    <td>${typeDisplay}</td>
                    <td>${animalType}</td>
                    <td>${count}</td>
                    <td>${details}</td>
                </tr>
            `;
        });
        
        reportHTML += `
                    </tbody>
                </table>
            </div>
        `;
        
        return reportHTML;
    }
    
    /**
     * Create Animal Inventory Report Table
     * @param {Object} data - Object with animal inventory and transactions
     * @returns {string} HTML for the report
     */
    function createAnimalInventoryTable(data) {
        // Ensure data exists
        if (!data) {
            console.error('No data provided to createAnimalInventoryTable');
            return `<div class="error-message">Error: No animal data available</div>`;
        }
        
        // Destructure with defaults to ensure we always have arrays
        const { inventory = [] } = data;
        
        // Ensure inventory is an array
        const inventoryArray = Array.isArray(inventory) ? inventory : 
                             (typeof inventory === 'object' ? Object.values(inventory) : []);
        
        // Calculate total count with null checks
        const totalCount = inventoryArray.reduce((sum, item) => {
            const count = parseInt(item?.count || 0);
            return sum + (isNaN(count) ? 0 : count);
        }, 0);
        
        let reportHTML = `
            <div class="report-header">
                <div class="report-type-header">
                    <div class="report-type-title">Animal Inventory Report</div>
                    <div class="report-actions">
                        <button onclick="window.print()" class="print-button">Print Report</button>
                        <button onclick="exportReportToCSV('animal-inventory')" class="export-button">Export to CSV</button>
                    </div>
                </div>
                <div class="report-summary">
                    <p>Total animals: ${totalCount}</p>
                    <p>Categories: ${new Set(inventoryArray.map(i => i?.category || 'Unknown')).size}</p>
                </div>
            </div>
            
            <div class="report-section">
                <h3>Animal Inventory by Type</h3>
                <table class="report-table" id="animal-by-type-table">
                    <thead>
                        <tr>
                            <th>Animal Type</th>
                            <th>Count</th>
                            <th>% of Total</th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    // Group by type with safety checks
    const inventoryByType = inventoryArray.reduce((groups, item) => {
        if (!item) return groups;
        
        const key = item.category || 'Unknown';
        if (!groups[key]) {
            groups[key] = {
                category: key,
                count: 0
            };
        }
        
        const count = parseInt(item.count || 0);
        groups[key].count += isNaN(count) ? 0 : count;
        return groups;
    }, {});
    
    // Convert to array and sort by count (descending)
    const sortedByType = Object.values(inventoryByType).sort((a, b) => {
        return b.count - a.count;
    });
    
    // Add rows
    sortedByType.forEach(item => {
        const percentage = totalCount > 0 ? ((item.count / totalCount) * 100).toFixed(1) : '0.0';
        
        reportHTML += `
            <tr>
                <td>${item.category}</td>
                <td>${item.count}</td>
                <td>${percentage}%</td>
            </tr>
        `;
    });
    
    reportHTML += `
                    </tbody>
                </table>
            </div>
            
            <div class="report-section">
                <h3>Animal Inventory by Location</h3>
                <table class="report-table" id="animal-by-location-table">
                    <thead>
                        <tr>
                            <th>Location</th>
                            <th>Animal Type</th>
                            <th>Count</th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    // Group by location and type with safety checks
    const byLocation = inventoryArray.reduce((locations, item) => {
        if (!item) return locations;
        
        const location = item.location || 'Farm';
        const category = item.category || 'Unknown';
        
        if (!locations[location]) {
            locations[location] = {};
        }
        
        if (!locations[location][category]) {
            locations[location][category] = 0;
        }
        
        const count = parseInt(item.count || 0);
        locations[location][category] += isNaN(count) ? 0 : count;
        return locations;
    }, {});
    
    // Add rows for each location and type
    Object.entries(byLocation).sort((a, b) => a[0].localeCompare(b[0])).forEach(([location, types]) => {
        let isFirstRow = true;
        const locationRowCount = Object.keys(types).length;
        
        Object.entries(types).sort((a, b) => a[0].localeCompare(b[0])).forEach(([type, count]) => {
            reportHTML += `
                <tr>
                    ${isFirstRow ? `<td rowspan="${locationRowCount}">${location}</td>` : ''}
                    <td>${type}</td>
                    <td>${count}</td>
                </tr>
            `;
            isFirstRow = false;
        });
    });
    
    reportHTML += `
                    </tbody>
                </table>
            </div>
        `;
        
        return reportHTML;
    }
    
    /**
     * Create Animal Movement Report Table
     * @param {Object} data - Object with animal movements
     * @returns {string} HTML for the report
     */
    function createAnimalMovementTable(data) {
        // Ensure data exists
        if (!data) {
            console.error('No data provided to createAnimalMovementTable');
            return `<div class="error-message">Error: No animal movement data available</div>`;
        }
        
        // Destructure with defaults to ensure we always have arrays
        const { transactions = [] } = data;
        
        // Ensure transactions is an array
        const transactionsArray = Array.isArray(transactions) ? transactions : [];
        
        // Filter for movement related transactions with null checks - using correct type values from animals.js
        const movements = transactionsArray.filter(tx => 
            tx && (tx.type === 'move' || tx.type === 'buy' || tx.type === 'sell'));
        
        // Count by type with null checks
        const purchaseCount = movements.filter(t => t?.type === 'buy').length;
        const saleCount = movements.filter(t => t?.type === 'sell').length;
        const moveCount = movements.filter(t => t?.type === 'move').length;
        
        let reportHTML = `
            <div class="report-header">
                <div class="report-type-header">
                    <div class="report-type-title">Animal Movement Report</div>
                    <div class="report-actions">
                        <button onclick="window.print()" class="print-button">Print Report</button>
                        <button onclick="exportReportToCSV('animal-movement')" class="export-button">Export to CSV</button>
                    </div>
                </div>
                <div class="report-summary">
                    <p>Total movements: ${movements.length}</p>
                    <ul>
                        <li>Purchases (incoming): ${purchaseCount}</li>
                        <li>Sales (outgoing): ${saleCount}</li>
                        <li>Internal movements: ${moveCount}</li>
                    </ul>
                </div>
            </div>
            
            <div class="report-section">
                <h3>Animal Movements</h3>
                <table class="report-table" id="animal-movement-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Animal Type</th>
                            <th>Count</th>
                            <th>From</th>
                            <th>To</th>
                            <th>Notes</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // Sort by date (newest first) with safe date handling
        const sortedMovements = [...movements].sort((a, b) => {
            const dateA = a?.timestamp ? new Date(a.timestamp) : 
                         (a?.date ? new Date(a.date) : new Date(0));
            const dateB = b?.timestamp ? new Date(b.timestamp) : 
                         (b?.date ? new Date(b.date) : new Date(0));
            return dateB - dateA;
        });
        
        // Add rows for each movement with null checks
        sortedMovements.forEach(movement => {
            if (!movement) return; // Skip invalid entries
            
            const date = formatDate(movement.timestamp || movement.date || new Date());
            
            // Format type
            let typeDisplay = 'Unknown';
            switch (movement.type) {
                case 'buy': typeDisplay = 'Purchase (In)'; break;
                case 'sell': typeDisplay = 'Sale (Out)'; break;
                case 'move': typeDisplay = 'Movement'; break;
                default: typeDisplay = movement.type || 'Unknown';
            }
            
            const animalType = movement.category || 'Unknown';
            const count = movement.quantity || movement.count || '0';
            
            // Format from/to based on type
            let fromLocation = '';
            let toLocation = '';
            
            switch (movement.type) {
                case 'buy':
                    fromLocation = movement.supplier || 'External';
                    toLocation = movement.location || movement.toLocation || 'Farm';
                    break;
                case 'sell':
                    fromLocation = movement.fromLocation || movement.location || 'Farm';
                    toLocation = movement.buyer || movement.customer || 'External';
                    break;
                case 'move':
                    if (movement.fromCategory && movement.toCategory) {
                        fromLocation = movement.fromCategory;
                        toLocation = movement.toCategory;
                    } else {
                        fromLocation = movement.fromLocation || 'Unknown';
                        toLocation = movement.toLocation || 'Unknown';
                    }
                    break;
                default:
                    fromLocation = movement.fromLocation || '-';
                    toLocation = movement.toLocation || '-';
            }
            
            const notes = movement.notes || '';
            
            reportHTML += `
                <tr class="${movement.type}-row">
                    <td>${date}</td>
                    <td>${typeDisplay}</td>
                    <td>${animalType}</td>
                    <td>${count}</td>
                    <td>${fromLocation}</td>
                    <td>${toLocation}</td>
                    <td>${notes}</td>
                </tr>
            `;
        });
        
        reportHTML += `
                    </tbody>
                </table>
            </div>
        `;
        
        return reportHTML;
    }

    /**
     * Create Animal Purchase Report Table
     * @param {Object} data - Object with animal purchase data
     * @returns {string} HTML for the report
     */
    function createAnimalPurchaseTable(data) {
        // Ensure data exists
        if (!data) {
            console.error('No data provided to createAnimalPurchaseTable');
            return `<div class="error-message">Error: No animal purchase data available</div>`;
        }
        
        // Destructure with defaults to ensure we always have arrays
        const { transactions = [], purchases = [] } = data;
        
        // Combine transactions and purchases for complete data
        let allPurchases = [...transactions];
        if (Array.isArray(purchases) && purchases.length > 0) {
            allPurchases = [...allPurchases, ...purchases];
        }
        
        // Remove duplicates (based on timestamp)
        const dedupedPurchases = [];
        const seenTimestamps = new Set();
        
        allPurchases.forEach(purchase => {
            const timestamp = purchase.timestamp || purchase.date;
            if (!seenTimestamps.has(timestamp)) {
                seenTimestamps.add(timestamp);
                dedupedPurchases.push(purchase);
            }
        });
        
        // Sort by date (newest first)
        dedupedPurchases.sort((a, b) => {
            const dateA = new Date(a.timestamp || a.date);
            const dateB = new Date(b.timestamp || b.date);
            return dateB - dateA;
        });
        
        // Calculate total cost and count
        const totalCost = dedupedPurchases.reduce((sum, p) => {
            const price = p.price || 0;
            const quantity = p.quantity || 0;
            return sum + (price * quantity);
        }, 0);
        
        const totalAnimals = dedupedPurchases.reduce((sum, p) => {
            return sum + (p.quantity || 0);
        }, 0);
        
        let reportHTML = `
            <div class="report-header">
                <div class="report-type-header">
                    <div class="report-type-title">Animal Purchase Report</div>
                    <div class="report-actions">
                        <button onclick="window.print()" class="print-button">Print Report</button>
                        <button onclick="exportReportToCSV('animal-purchase')" class="export-button">Export to CSV</button>
                    </div>
                </div>
                <div class="report-summary">
                    <p>Total purchases: ${dedupedPurchases.length}</p>
                    <p>Total animals purchased: ${totalAnimals}</p>
                    <p>Total cost: ${formatCurrency(totalCost)}</p>
                </div>
            </div>
            
            <div class="report-section">
                <h3>Animal Purchases</h3>
                <table class="report-table" id="animal-purchase-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Animal Type</th>
                            <th>Quantity</th>
                            <th>Price per Animal</th>
                            <th>Total Cost</th>
                            <th>Supplier</th>
                            <th>Notes</th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    // Add rows for each purchase
    dedupedPurchases.forEach(purchase => {
        const date = formatDate(purchase.timestamp || purchase.date);
        const animalType = purchase.category || 'Unknown';
        const quantity = purchase.quantity || 0;
        const pricePerAnimal = purchase.price || 0;
        const totalPrice = (pricePerAnimal * quantity) || 0;
        const supplier = purchase.supplier || '-';
        const notes = purchase.notes || '-';
        
        reportHTML += `
            <tr>
                <td>${date}</td>
                <td>${animalType}</td>
                <td>${quantity}</td>
                <td>${formatCurrency(pricePerAnimal)}</td>
                <td>${formatCurrency(totalPrice)}</td>
                <td>${supplier}</td>
                <td>${notes}</td>
            </tr>
        `;
    });
    
    reportHTML += `
                </tbody>
            </table>
        </div>
    `;
    
    return reportHTML;
}

/**
 * Create Animal Sale Report Table
 * @param {Object} data - Object with animal sale data
 * @returns {string} HTML for the report
 */
function createAnimalSaleTable(data) {
    // Ensure data exists
    if (!data) {
        console.error('No data provided to createAnimalSaleTable');
        return `<div class="error-message">Error: No animal sale data available</div>`;
    }
    
    // Destructure with defaults to ensure we always have arrays
    const { transactions = [], sales = [] } = data;
    
    // Combine transactions and sales for complete data
    let allSales = [...transactions];
    if (Array.isArray(sales) && sales.length > 0) {
        allSales = [...allSales, ...sales];
    }
    
    // Remove duplicates (based on timestamp)
    const dedupedSales = [];
    const seenTimestamps = new Set();
    
    allSales.forEach(sale => {
        const timestamp = sale.timestamp || sale.date;
        if (!seenTimestamps.has(timestamp)) {
            seenTimestamps.add(timestamp);
            dedupedSales.push(sale);
        }
    });
    
    // Sort by date (newest first)
    dedupedSales.sort((a, b) => {
        const dateA = new Date(a.timestamp || a.date);
        const dateB = new Date(b.timestamp || b.date);
        return dateB - dateA;
    });
    
    // Calculate total revenue and count
    const totalRevenue = dedupedSales.reduce((sum, s) => {
        const price = s.price || 0;
        const quantity = s.quantity || 0;
        return sum + (price * quantity);
    }, 0);
    
    const totalAnimals = dedupedSales.reduce((sum, s) => {
        return sum + (s.quantity || 0);
    }, 0);
    
    let reportHTML = `
        <div class="report-header">
            <div class="report-type-header">
                <div class="report-type-title">Animal Sale Report</div>
                <div class="report-actions">
                    <button onclick="window.print()" class="print-button">Print Report</button>
                    <button onclick="exportReportToCSV('animal-sale')" class="export-button">Export to CSV</button>
                </div>
            </div>
            <div class="report-summary">
                <p>Total sales: ${dedupedSales.length}</p>
                <p>Total animals sold: ${totalAnimals}</p>
                <p>Total revenue: ${formatCurrency(totalRevenue)}</p>
            </div>
        </div>
        
        <div class="report-section">
            <h3>Animal Sales</h3>
            <table class="report-table" id="animal-sale-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Animal Type</th>
                        <th>Quantity</th>
                        <th>Price per Animal</th>
                        <th>Total Revenue</th>
                        <th>Buyer</th>
                        <th>Notes</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    // Add rows for each sale
    dedupedSales.forEach(sale => {
        const date = formatDate(sale.timestamp || sale.date);
        const animalType = sale.category || 'Unknown';
        const quantity = sale.quantity || 0;
        const pricePerAnimal = sale.price || 0;
        const totalPrice = (pricePerAnimal * quantity) || 0;
        const buyer = sale.buyer || '-';
        const notes = sale.notes || '-';
        
        reportHTML += `
            <tr>
                <td>${date}</td>
                <td>${animalType}</td>
                <td>${quantity}</td>
                <td>${formatCurrency(pricePerAnimal)}</td>
                <td>${formatCurrency(totalPrice)}</td>
                <td>${buyer}</td>
                <td>${notes}</td>
            </tr>
        `;
    });
    
    reportHTML += `
                </tbody>
            </table>
        </div>
    `;
    
    return reportHTML;
}

/**
 * Create Animal Birth Report Table
 * @param {Object} data - Object with animal birth data
 * @returns {string} HTML for the report
 */
function createAnimalBirthTable(data) {
    // Ensure data exists
    if (!data) {
        console.error('No data provided to createAnimalBirthTable');
        return `<div class="error-message">Error: No animal birth data available</div>`;
    }
    
    // Destructure with defaults to ensure we always have arrays
    const { transactions = [] } = data;
    
    // Sort by date (newest first)
    const sortedData = [...transactions].sort((a, b) => {
        const dateA = new Date(a.timestamp || a.date);
        const dateB = new Date(b.timestamp || b.date);
        return dateB - dateA;
    });
    
    // Calculate total births
    const totalBirths = sortedData.reduce((sum, b) => {
        return sum + (b.quantity || 0);
    }, 0);
    
    let reportHTML = `
        <div class="report-header">
            <div class="report-type-header">
                <div class="report-type-title">Animal Birth Report</div>
                <div class="report-actions">
                    <button onclick="window.print()" class="print-button">Print Report</button>
                    <button onclick="exportReportToCSV('animal-birth')" class="export-button">Export to CSV</button>
                </div>
            </div>
            <div class="report-summary">
                <p>Total birth records: ${sortedData.length}</p>
                <p>Total animals born: ${totalBirths}</p>
            </div>
        </div>
        
        <div class="report-section">
            <h3>Animal Births</h3>
            <table class="report-table" id="animal-birth-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Animal Type</th>
                        <th>Quantity</th>
                        <th>Notes</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    // Add rows for each birth record
    sortedData.forEach(birth => {
        const date = formatDate(birth.timestamp || birth.date);
        const animalType = birth.category || 'Unknown';
        const quantity = birth.quantity || 0;
        const notes = birth.notes || '-';
        
        reportHTML += `
            <tr>
                <td>${date}</td>
                <td>${animalType}</td>
                <td>${quantity}</td>
                <td>${notes}</td>
            </tr>
        `;
    });
    
    reportHTML += `
                </tbody>
            </table>
        </div>
    `;
    
    return reportHTML;
}

/**
 * Create Animal Death Report Table
 * @param {Object} data - Object with animal death data
 * @returns {string} HTML for the report
 */
function createAnimalDeathTable(data) {
    // Ensure data exists
    if (!data) {
        console.error('No data provided to createAnimalDeathTable');
        return `<div class="error-message">Error: No animal death data available</div>`;
    }
    
    // Destructure with defaults to ensure we always have arrays
    const { transactions = [] } = data;
    
    // Sort by date (newest first)
    const sortedData = [...transactions].sort((a, b) => {
        const dateA = new Date(a.timestamp || a.date);
        const dateB = new Date(b.timestamp || b.date);
        return dateB - dateA;
    });
    
    // Calculate total deaths
    const totalDeaths = sortedData.reduce((sum, d) => {
        return sum + (d.quantity || 0);
    }, 0);
    
    let reportHTML = `
        <div class="report-header">
            <div class="report-type-header">
                <div class="report-type-title">Animal Death Report</div>
                <div class="report-actions">
                    <button onclick="window.print()" class="print-button">Print Report</button>
                    <button onclick="exportReportToCSV('animal-death')" class="export-button">Export to CSV</button>
                </div>
            </div>
            <div class="report-summary">
                <p>Total death records: ${sortedData.length}</p>
                <p>Total animal deaths: ${totalDeaths}</p>
            </div>
        </div>
        
        <div class="report-section">
            <h3>Animal Deaths</h3>
            <table class="report-table" id="animal-death-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Animal Type</th>
                        <th>Quantity</th>
                        <th>Reason</th>
                        <th>Notes</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    // Add rows for each death record
    sortedData.forEach(death => {
        const date = formatDate(death.timestamp || death.date);
        const animalType = death.category || 'Unknown';
        const quantity = death.quantity || 0;
        const reason = death.reason || '-';
        const notes = death.notes || '-';
        
        reportHTML += `
            <tr>
                <td>${date}</td>
                <td>${animalType}</td>
                <td>${quantity}</td>
                <td>${reason}</td>
                <td>${notes}</td>
            </tr>
        `;
    });
    
    reportHTML += `
                </tbody>
            </table>
        </div>
    `;
    
    return reportHTML;
}

/**
 * Create Animal Count Report Table
 * @param {Object} data - Object with animal count data
 * @returns {string} HTML for the report
 */
function createAnimalCountTable(data) {
    // Ensure data exists
    if (!data) {
        console.error('No data provided to createAnimalCountTable');
        return `<div class="error-message">Error: No animal count data available</div>`;
    }
    
    // Destructure with defaults to ensure we always have arrays
    const { transactions = [], counts = [] } = data;
    
    // Combine transactions and counts
    let allCounts = [...transactions];
    if (Array.isArray(counts) && counts.length > 0) {
        allCounts = [...allCounts, ...counts];
    }
    
    // Sort by date (newest first)
    const sortedData = [...allCounts].sort((a, b) => {
        const dateA = new Date(a.timestamp || a.date);
        const dateB = new Date(b.timestamp || b.date);
        return dateB - dateA;
    });
    
    let reportHTML = `
        <div class="report-header">
            <div class="report-type-header">
                <div class="report-type-title">Animal Count Report</div>
                <div class="report-actions">
                    <button onclick="window.print()" class="print-button">Print Report</button>
                    <button onclick="exportReportToCSV('animal-count')" class="export-button">Export to CSV</button>
                </div>
            </div>
            <div class="report-summary">
                <p>Total count records: ${sortedData.length}</p>
            </div>
        </div>
        
        <div class="report-section">
            <h3>Animal Counts</h3>
            <table class="report-table" id="animal-count-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Animal Type</th>
                        <th>Expected</th>
                        <th>Actual</th>
                        <th>Difference</th>
                        <th>Counter</th>
                        <th>Notes</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    // Add rows for each count record
    sortedData.forEach(count => {
        const date = formatDate(count.timestamp || count.date);
        const animalType = count.category || 'Unknown';
        const expected = count.expected || 0;
        const actual = count.actual || count.quantity || 0;
        const difference = actual - expected;
        const counter = count.counterName || '-';
        const notes = count.notes || '-';
        
        // Add CSS class for positive/negative differences
        const differenceClass = difference > 0 ? 'positive-diff' : 
                              difference < 0 ? 'negative-diff' : 'no-diff';
        
        reportHTML += `
            <tr>
                <td>${date}</td>
                <td>${animalType}</td>
                <td>${expected}</td>
                <td>${actual}</td>
                <td class="${differenceClass}">${difference > 0 ? '+' : ''}${difference}</td>
                <td>${counter}</td>
                <td>${notes}</td>
            </tr>
        `;
    });
    
    reportHTML += `
                </tbody>
            </table>
        </div>
    `;
    
    return reportHTML;
}

/**
 * Create Animal Discrepancy Report Table
 * @param {Object} data - Object with animal discrepancy data
 * @returns {string} HTML for the report
 */
function createAnimalDiscrepancyTable(data) {
    // Ensure data exists
    if (!data) {
        console.error('No data provided to createAnimalDiscrepancyTable');
        return `<div class="error-message">Error: No animal discrepancy data available</div>`;
    }
    
    // Destructure with defaults to ensure we always have arrays
    const { discrepancies = [] } = data;
    
    // Log data for debugging
    console.log(`Processing ${discrepancies.length} discrepancies for report`);
    if (discrepancies.length > 0) {
        console.log('Sample discrepancy for report:', JSON.stringify(discrepancies[0]));
    }
    
    // Sort by date (newest first) with flexible date field handling
    const sortedData = [...discrepancies].sort((a, b) => {
        // Handle potential missing data fields
        if (!a || !b) return 0;
        
        const getDate = (item) => {
            const dateField = item.timestamp || item.date || item.createdAt || item.created;
            if (!dateField) return new Date(0); // Default to epoch if no date
            
            try {
                const dateObj = new Date(dateField);
                if (isNaN(dateObj.getTime())) return new Date(0); // Handle invalid dates
                return dateObj;
            } catch (e) {
                return new Date(0); // Handle parsing errors
            }
        };
        
        return getDate(b) - getDate(a); // Newest first
    });
    
    // Calculate statistics
    const totalDiscrepancies = sortedData.length;
    const openDiscrepancies = sortedData.filter(d => d && !d.resolved).length;
    const resolvedDiscrepancies = sortedData.filter(d => d && d.resolved).length;
    
    let reportHTML = `
        <div class="report-header">
            <div class="report-type-header">
                <div class="report-type-title">Animal Discrepancy Report</div>
                <div class="report-actions">
                    <button onclick="window.print()" class="print-button">Print Report</button>
                    <button onclick="exportReportToCSV('animal-discrepancy')" class="export-button">Export to CSV</button>
                </div>
            </div>
            <div class="report-summary">
                <p>Total discrepancies: ${totalDiscrepancies}</p>
                <p>Open discrepancies: ${openDiscrepancies}</p>
                <p>Resolved discrepancies: ${resolvedDiscrepancies}</p>
            </div>
        </div>
        
        <div class="report-section">
            <h3>Animal Discrepancies</h3>
    `;
    
    // Check if we have discrepancies to display
    if (totalDiscrepancies === 0) {
        reportHTML += `
            <div class="empty-state">
                <p>No discrepancies found for the selected time period and category.</p>
            </div>
        `;
    } else {
        reportHTML += `
            <table class="report-table" id="animal-discrepancy-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Animal Type</th>
                        <th>Expected</th>
                        <th>Actual</th>
                        <th>Difference</th>
                        <th>Status</th>
                        <th>Resolution Date</th>
                        <th>Notes</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        // Add rows for each discrepancy with defensive programming
        sortedData.forEach(discrepancy => {
            // Skip invalid data
            if (!discrepancy) return;
            
            // Handle date fields with fallbacks
            const dateField = discrepancy.timestamp || discrepancy.date || discrepancy.createdAt || '';
            const date = formatDate(dateField);
            
            const animalType = discrepancy.category || 'Unknown';
            
            // Handle numeric fields with defaults and NaN protection
            const expected = parseInt(discrepancy.expected || 0);
            const actual = parseInt(discrepancy.actual || 0);
            
            // Calculate difference if not provided
            let difference = discrepancy.difference;
            if (difference === undefined || difference === null) {
                difference = actual - expected;
            }
            
            // Format status
            const status = discrepancy.resolved ? 'Resolved' : 'Open';
            const statusClass = discrepancy.resolved ? 'resolved-status' : 'open-status';
            
            // Format resolution date
            let resolutionDate = '-';
            if (discrepancy.resolved) {
                const resolvedDateField = discrepancy.resolvedDate || discrepancy.resolutionDate || '';
                resolutionDate = resolvedDateField ? formatDate(resolvedDateField) : '-';
            }
                
            const notes = discrepancy.notes || discrepancy.resolutionNotes || '-';
            
            // Add CSS class for positive/negative differences
            const differenceClass = difference > 0 ? 'positive-diff' : 
                                difference < 0 ? 'negative-diff' : 'no-diff';
            
            reportHTML += `
                <tr class="${statusClass === 'resolved-status' ? 'resolved-row' : ''}">
                    <td>${date}</td>
                    <td>${animalType}</td>
                    <td>${expected}</td>
                    <td>${actual}</td>
                    <td class="${differenceClass}">${difference > 0 ? '+' : ''}${difference}</td>
                    <td class="${statusClass}">${status}</td>
                    <td>${resolutionDate}</td>
                    <td>${notes}</td>
                </tr>
            `;
        });
        
        reportHTML += `
                </tbody>
            </table>
        `;
    }
    
    reportHTML += `
        </div>
    `;
    
    return reportHTML;
}

}); // End of DOMContentLoaded event listener