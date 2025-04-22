// Global variables for report settings
let selectedReportType = '';
let selectedMainType = '';
let userCurrency = 'R';

// Add this helper variable at the global level to track demo data notifications
let hasShownDemoDataNotice = false;

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
    
    // Forcefully disable demo data to ensure no sample data is shown after clearing
    await mobileStorage.setItem('showDemoData', 'false');
    console.log('Demo data mode disabled');
    
    // Check if logged in
    const isLoggedIn = await mobileStorage.getItem('isLoggedIn');
    if (isLoggedIn !== 'true') {
        window.location.href = 'index.html';
        return;
    }
    
    // Setup keyboard detection for mobile devices
    setupKeyboardDetection();
    
    // Initialize state
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
    
    /**
     * Format a currency value for display
     * @param {number} amount - The amount to format
     * @returns {string} Formatted currency string
     */
    function formatCurrency(amount) {
        if (amount === undefined || amount === null) return '-';
        
        // Use a fixed userCurrency if available, default to $ otherwise
        const currencySymbol = userCurrency || '$';
        
        // Convert to number to ensure proper formatting
        const numAmount = Number(amount);
        
        // Handle NaN
        if (isNaN(numAmount)) return '-';
        
        // Format with 2 decimal places and thousands separators
        return currencySymbol + numAmount.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
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
    
    // New standardized implementation for generating reports
    async function handleGenerateReport() {
        try {
            console.log('Generate Report function started');
            
            // Make sure the report-loading element exists
            const loadingEl = document.getElementById('report-loading');
            if (loadingEl) {
                loadingEl.style.display = 'flex';
            } else {
                console.log('Warning: report-loading element not found');
            }
            
            // Clear previous results
            clearPreviousReportResults();
            
            // Collect the filters from the form
            const filters = collectFilters();
            if (!filters) {
                console.error('Failed to collect filters');
                alert('Please select all required options');
                if (loadingEl) loadingEl.style.display = 'none';
                return;
            }
            
            console.log('Generating report with filters:', filters);
            
            // Collect the data for the report based on filters
            const reportData = await collectReportData(filters);
            console.log('Collected report data:', reportData);
            
            // Check if data is empty
            const isEmpty = await checkIfDataIsEmpty(reportData, filters.reportType);
            if (isEmpty) {
                console.log('No data for report - showing empty message');
                if (loadingEl) loadingEl.style.display = 'none';
                
                const emptyMsgEl = document.getElementById('empty-report-message');
                if (emptyMsgEl) {
                    emptyMsgEl.style.display = 'block';
                } else {
                    console.log('Warning: empty-report-message element not found');
                    // Fallback - use the report content element
                    const reportContent = document.querySelector('.report-content');
                    if (reportContent) {
                        reportContent.innerHTML = `
                            <div class="empty-state">
                                <h3>No Data Available</h3>
                                <p>No data found for the selected criteria.</p>
                                <p>Try different filters or add data to the system first.</p>
                            </div>
                        `;
                    }
                }
                return;
            }
            
            // Generate HTML content for the report
            const reportHTML = await generateReportHTML(reportData, filters);
            console.log('Generated report HTML length:', reportHTML.length);
            
            // ALSO output to the direct output container for debugging
            const directOutputContent = document.getElementById('direct-output-content');
            if (directOutputContent) {
                directOutputContent.innerHTML = reportHTML;
                console.log('Set report HTML into direct output container');
            }
            
            // Insert the HTML content into the report container - target the correct element
            const reportContent = document.querySelector('.report-content');
            if (reportContent) {
                // Replace the content
                reportContent.innerHTML = reportHTML;
                console.log('Set report HTML into container');
                
                // Make sure the container is visible with explicit style properties
                const reportContainer = document.getElementById('report-container');
                if (reportContainer) {
                    reportContainer.style.display = 'block';
                    reportContainer.style.visibility = 'visible';
                }
                
                // Force visibility on the content element too
                reportContent.style.display = 'block';
                reportContent.style.visibility = 'visible';
                reportContent.style.opacity = '1';
                reportContent.style.minHeight = '400px';  // Ensure it has height
                
                // Add a border to help visualize it
                reportContent.style.border = '2px solid #3498db';
                
                // Add a debug class for styling
                reportContent.classList.add('debug-highlight');
                
                console.log('Report container display style:', window.getComputedStyle(reportContent).display);
                console.log('Report container height:', reportContent.offsetHeight);
                console.log('Report container scrollHeight:', reportContent.scrollHeight);
                
                // Force browser to recognize the content by triggering reflow
                void reportContent.offsetHeight;
            } else {
                console.error('Report content element not found');
                alert('Error: Report content element not found in the page');
            }
            
            // Hide spinner
            if (loadingEl) loadingEl.style.display = 'none';
            
            // Try to find the report container for scrolling
            const reportContainer = document.getElementById('report-container') || reportContent;
            if (reportContainer) {
                // Scroll to the report container
                reportContainer.scrollIntoView({ behavior: 'smooth' });
                console.log('Scrolled to report container');
            }
            
            console.log('Report generation completed successfully');
            
        } catch (error) {
            // Log the full error to help with debugging
            console.error('Error generating report:', error);
            
            // Try to get a meaningful error message
            let errorMessage = 'Unknown error occurred';
            if (error) {
                if (error.message) {
                    errorMessage = error.message;
                } else if (error.toString) {
                    errorMessage = error.toString();
                } else {
                    errorMessage = JSON.stringify(error);
                }
            }
            
            // Show error to the user
            alert(`Error generating report: ${errorMessage}`);
            
            // Hide loading spinner if it exists
            const loadingEl = document.getElementById('report-loading');
            if (loadingEl) loadingEl.style.display = 'none';
        }
    }
    
    /**
     * Standardized function to check if report data is empty
     * @param {Object|Array} reportData - The data for the report
     * @param {string} reportType - The type of report
     * @returns {boolean} True if data is empty, false otherwise
     */
    async function checkIfDataIsEmpty(reportData, reportType) {
        // If we've already set the isEmpty flag, respect it
        if (reportData && reportData.isEmpty === true) {
            console.log(`${reportType} report: isEmpty flag is true`);
            return true;
        }
        
        // Check if the report data is completely empty
        if (!reportData) {
            console.log(`${reportType} report: No data provided`);
            return true;
        }
        
        // Debug log for report data
        if (typeof reportData === 'object') {
            console.log(`${reportType} report data contains:`, 
                reportData.inventory ? `inventory (${Array.isArray(reportData.inventory) ? 
                    reportData.inventory.length + ' items' : 
                    'object with ' + Object.keys(reportData.inventory).length + ' keys'})` : 'no inventory',
                reportData.transactions ? `transactions (${reportData.transactions.length} items)` : 'no transactions'
            );
        }
        
        // Special case for all-animal report type
        if (reportType === 'all-animal') {
            // Check for transactions array
            if (reportData.transactions && reportData.transactions.length > 0) {
                console.log(`${reportType} report: Has transactions (${reportData.transactions.length})`);
                return false;
            }
            
            // Check for inventory array or object
            if (reportData.inventory) {
                if (Array.isArray(reportData.inventory) && reportData.inventory.length > 0) {
                    console.log(`${reportType} report: Has inventory array (${reportData.inventory.length})`);
                    return false;
                }
                
                // Check if inventory is an object with entries
                if (typeof reportData.inventory === 'object' && Object.keys(reportData.inventory).length > 0) {
                    console.log(`${reportType} report: Has inventory object (${Object.keys(reportData.inventory).length} categories)`);
                    return false;
                }
            }
            
            console.log(`${reportType} report: No valid data found`);
        }
        
        // For animal reports
        if (reportType.startsWith('animal-')) {
            // Check for transactions array
            if (reportData.transactions && reportData.transactions.length > 0) {
                return false;
            }
            
            // Check for inventory array or object
            if (reportData.inventory) {
                if (Array.isArray(reportData.inventory) && reportData.inventory.length > 0) {
                    return false;
                }
                
                // Check if inventory is an object with entries
                if (typeof reportData.inventory === 'object' && Object.keys(reportData.inventory).length > 0) {
                    return false;
                }
            }
        }
        
        // For feed reports
        if (reportType.startsWith('feed-')) {
            // Check for transactions array
            if (reportData.transactions && reportData.transactions.length > 0) {
                return false;
            }
            
            // Check for inventory array
            if (reportData.inventory && reportData.inventory.length > 0) {
                return false;
            }
            
            // Check for calculations array
            if (reportData.calculations && reportData.calculations.length > 0) {
                return false;
            }
        }
        
        // For health reports
        if (reportType.startsWith('health-')) {
            // Check for records array
            if (reportData.records && reportData.records.length > 0) {
                return false;
            }
            
            // Check for treatments, vaccinations, medications
            if (reportData.treatments && reportData.treatments.length > 0) return false;
            if (reportData.vaccinations && reportData.vaccinations.length > 0) return false;
            if (reportData.medications && reportData.medications.length > 0) return false;
            
            // Check within data objects
            if (reportData.treatmentData && reportData.treatmentData.treatments && 
                reportData.treatmentData.treatments.length > 0) {
                return false;
            }
            
            if (reportData.vaccinationData && reportData.vaccinationData.vaccinations && 
                reportData.vaccinationData.vaccinations.length > 0) {
                return false;
            }
            
            if (reportData.medicationData && reportData.medicationData.medications && 
                reportData.medicationData.medications.length > 0) {
                return false;
            }
        }
        
        // If we get here, the data is empty
        return true;
    }
    
    /**
     * Generate the HTML for the report based on report type and data
     * @param {Object|Array} reportData - The data for the report
     * @param {Object} filters - The filter criteria used for the report
     * @returns {string} HTML for the report
     */
    async function generateReportHTML(reportData, filters) {
        console.log('Generating HTML for report with type:', filters.reportType);
        
        try {
            const { reportType } = filters;
            let reportHTML = '';
            const dateRange = filters.dateRange;
            const dateRangeText = formatDateRange(dateRange.start, dateRange.end);
            
            // Prepare a default report title and subtitle
            const reportTitle = capitalizeFirstLetter(reportType.replace(/-/g, ' ') + ' Report');
            let reportSubtitle = `${dateRangeText}`;
            if (filters.category && filters.category !== 'all') {
                reportSubtitle += ` • Category: ${filters.category}`;
            }
            
            // Log report data before processing
            console.log(`Processing ${reportType} report data:`, 
                        Array.isArray(reportData) ? `Array with ${reportData.length} items` : 
                        (reportData ? 'Object with properties: ' + Object.keys(reportData).join(', ') : 'No data'));
            
            // Generate table HTML based on report type
            switch (reportType) {
                // Feed reports
                case 'feed-calculation':
                    reportHTML = createFeedCalculationTable(reportData, filters);
                    break;
                case 'all-feed':
                    reportHTML = createAllFeedReportTable(reportData);
                    break;
                case 'feed-purchase':
                    reportHTML = createFeedPurchaseTable(reportData);
                    break;
                case 'feed-usage':
                    reportHTML = createFeedUsageTable(reportData);
                    break;
                case 'feed-inventory':
                    reportHTML = createFeedInventoryTable(reportData);
                    break;
                
                // Animal reports - these return complete report HTML with buttons already included
                case 'all-animal':
                    console.log('Creating all animal report table with data:', reportData);
                    reportHTML = createAllAnimalReportTable(reportData);
                    return reportHTML; // Return directly
                
                // All specialized animal reports return directly to prevent double-wrapping
                case 'animal-inventory':
                    reportHTML = createAnimalInventoryTable(reportData);
                    return reportHTML;
                
                case 'animal-movement':
                    reportHTML = createAnimalMovementTable(reportData);
                    return reportHTML;
                
                case 'animal-purchase':
                    reportHTML = createAnimalPurchaseTable(reportData);
                    return reportHTML;
                
                case 'animal-sale':
                    reportHTML = createAnimalSaleTable(reportData);
                    return reportHTML;
                
                case 'animal-birth':
                    reportHTML = createAnimalBirthTable(reportData);
                    return reportHTML;
                
                case 'animal-death':
                    reportHTML = createAnimalDeathTable(reportData);
                    return reportHTML;
                
                case 'animal-count':
                    reportHTML = createAnimalCountTable(reportData);
                    return reportHTML;
                
                case 'animal-discrepancy':
                    reportHTML = createAnimalDiscrepancyTable(reportData);
                    return reportHTML; // Return directly since the function creates a complete standardized report
                
                // Health reports
                case 'all-health':
                case 'health-treatment':
                case 'health-vaccination':
                case 'health-medication':
                    reportHTML = createHealthReportTable(reportData, reportType.replace('health-', ''));
                    return reportHTML; // Return directly for health reports too
                
                default:
                    console.warn(`No table generator for report type: ${reportType}`);
                    reportHTML = `<div class="error-message">Report type "${reportType}" is not implemented yet.</div>`;
            }
            
            // Log the generated HTML length to avoid flooding the console
            console.log(`Generated ${reportHTML.length} characters of HTML for ${reportType} report`);
            
            // Create standard report structure - only needed for report types that don't create their own structure
            const finalReportHTML = createStandardReportStructure(
                reportTitle,
                reportSubtitle,
                dateRangeText,
                reportHTML,
                null, // No summary data for now
                false, // Not demo data
                reportType // Pass the report type for the export button
            );
            
            return finalReportHTML;
        } catch (error) {
            console.error('Error generating report HTML:', error);
            return `<div class="error-message">Error generating report: ${error.message}</div>`;
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
                    <p>Report date range: ${formatDateRange(filters.dateRange.start, filters.dateRange.end)}</p>
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
     * Create All Animal Report Table
     * @param {Object} data - Object containing animal inventory and transactions
     * @returns {string} HTML for the report
     */
    function createAllAnimalReportTable(data) {
        console.log('Creating all animal report table with data:', data);
        
        // Check for any data to display
        if (!data || ((!data.transactions || data.transactions.length === 0) && 
                     (!data.inventory || (Array.isArray(data.inventory) && data.inventory.length === 0) || 
                     (typeof data.inventory === 'object' && Object.keys(data.inventory).length === 0)))) {
            return `
                <div class="report-header">
                    <h3>All Animal Transactions Report</h3>
                    <div class="report-summary">
                        <p>No animal data found for the selected period.</p>
                    </div>
                    <div class="report-actions">
                        <button onclick="window.print()" class="print-button">Print Report</button>
                        <button onclick="exportReportToCSV('all-animal')" class="export-button">Export to CSV</button>
                    </div>
                </div>
                <div class="empty-state">
                    <h3>No Animal Data Available</h3>
                    <p>There are no animal records in the system for the selected date range.</p>
                    <p>Try adding some animal transactions first, or select a different date range.</p>
                </div>
            `;
        }
        
        const { inventory = [], transactions = [] } = data;
        
        // Calculate totals and summaries
        const totalAnimals = Array.isArray(inventory) ? 
            inventory.reduce((sum, item) => sum + (item.count || 0), 0) : 0;
        
        // Count transaction types
        const transactionCounts = {};
        if (transactions && transactions.length > 0) {
        transactions.forEach(tx => {
            const type = tx.type || 'unknown';
            transactionCounts[type] = (transactionCounts[type] || 0) + 1;
        });
        }
        
        // Create a more detailed and formatted table with proper field references
        let reportHTML = `
            <div class="report-header">
                <h3>All Animal Transactions Report</h3>
                <div class="report-summary">
                    <p>Current total animals: ${totalAnimals}</p>
                    <p>Total transactions: ${transactions ? transactions.length : 0}</p>
                    ${Object.entries(transactionCounts).map(([type, count]) => 
                        `<p>${type.charAt(0).toUpperCase() + type.slice(1)}: ${count} transaction${count !== 1 ? 's' : ''}</p>`
                    ).join('\n')}
                </div>
                <div class="report-actions">
                    <button onclick="window.print()" class="print-button">Print Report</button>
                    <button onclick="exportReportToCSV('all-animal')" class="export-button">Export to CSV</button>
                </div>
            </div>
        `;
            
        // Only show transactions section if there are transactions
        if (transactions && transactions.length > 0) {
            reportHTML += `
            <div class="report-section">
                <h3>Animal Transactions</h3>
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Category</th>
                            <th>Location</th>
                            <th>Quantity</th>
                            <th>Details</th>
                            <th>Notes</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // Add transaction rows
        transactions.forEach(tx => {
            // Format the date nicely
            const dateStr = tx.timestamp || tx.date || 'Unknown';
            const formattedDate = dateStr !== 'Unknown' ? new Date(dateStr).toLocaleDateString() : 'Unknown';
            
            // Get the transaction type in a user-friendly format
            const typeMap = {
                'add': 'Added',
                'buy': 'Purchased',
                'sell': 'Sold',
                'move': 'Moved',
                'death': 'Death',
                'birth': 'Birth',
                'stock-count': 'Stock Count',
                'resolution': 'Count Resolution',
                'reversal': 'Transaction Reversal'
            };
            
            const type = typeMap[tx.type] || tx.type || 'Unknown';
            
                // Get the category field - prioritize fromCategory for move transactions
                let category = 'Unknown';
                if (tx.type === 'move' && tx.fromCategory) {
                    category = tx.fromCategory; // Use source category for moves
                } else {
                    category = tx.category || tx.animalType || 'Unknown';
                }
            
            // Handle location data - could be in different formats depending on when it was entered
            let location = 'Not specified';
            
            // Check different possible location properties
            if (tx.location) {
                location = tx.location;
            } else if (tx.fromLocation && tx.type === 'move') {
                location = tx.fromLocation;
            } else if (tx.toLocation && tx.type === 'move') {
                location = tx.toLocation;
            } else if (tx.locations && typeof tx.locations === 'object') {
                // Handle case where locations is an object with multiple entries
                const locationEntries = Object.entries(tx.locations);
                if (locationEntries.length > 0) {
                    location = locationEntries.map(([name, count]) => `${name}: ${count}`).join(', ');
                }
            }
            
            // Get quantity with fallback
            const quantity = tx.quantity || tx.count || tx.actual || 0;
            
            // Create details based on transaction type
            let details = '';
            if (tx.type === 'move' && tx.fromCategory && tx.toCategory) {
                details = `From ${tx.fromCategory} to ${tx.toCategory}`;
                // Add location details for moves
                if (tx.fromLocation && tx.toLocation) {
                    details += ` (${tx.fromLocation} → ${tx.toLocation})`;
                }
            } else if (tx.type === 'buy' && tx.supplier) {
                details = `Supplier: ${tx.supplier}${tx.price ? `, Price: ${tx.price}` : ''}`;
            } else if (tx.type === 'sell' && tx.buyer) {
                details = `Buyer: ${tx.buyer}${tx.price ? `, Price: ${tx.price}` : ''}`;
            } else if (tx.type === 'birth') {
                details = `Born: ${quantity} ${category}`;
            } else if (tx.type === 'death') {
                details = tx.reason || 'No cause specified';
            } else if (tx.type === 'stock-count') {
                details = `Expected: ${tx.expected}, Actual: ${tx.actual}${tx.counterName ? `, Counted by: ${tx.counterName}` : ''}`;
            }
            
            // Format notes
            const notes = tx.notes || tx.description || '';
            
            reportHTML += `
                <tr>
                    <td>${formattedDate}</td>
                    <td>${type}</td>
                    <td>${category}</td>
                    <td>${location}</td>
                    <td>${quantity}</td>
                    <td>${details}</td>
                    <td>${notes}</td>
                </tr>
            `;
        });
        
        reportHTML += `
                    </tbody>
                </table>
            </div>
        `;
        } else {
            reportHTML += `
                <div class="report-section">
                    <h3>Animal Transactions</h3>
                    <div class="empty-state">
                        <p>No transactions found for the selected period.</p>
                    </div>
                </div>
            `;
        }
        
        // Always show inventory section
        reportHTML += `
            <div class="report-section">
                <h3>Current Animal Inventory</h3>
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Category</th>
                            <th>Location</th>
                            <th>Quantity</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // Add inventory rows
        if (!inventory || (Array.isArray(inventory) && inventory.length === 0) || 
            (typeof inventory === 'object' && Object.keys(inventory).length === 0)) {
            reportHTML += `
                <tr>
                    <td colspan="3" class="no-data">No inventory data available</td>
                </tr>
            `;
        } else {
            // Handle inventory in either array format or object format
            if (Array.isArray(inventory)) {
            inventory.forEach(item => {
                // Handle location data in different possible formats
                let locationDisplay = 'Not specified';
                
                // Check for location directly on the item
                if (item.location) {
                    locationDisplay = item.location;
                } 
                    // Or check for a locations object
                else if (item.locations && typeof item.locations === 'object') {
                    const locationEntries = Object.entries(item.locations);
                    if (locationEntries.length > 0) {
                            locationDisplay = locationEntries.map(([loc, count]) => `${loc}: ${count}`).join(', ');
                    }
                }
                    
                    // Use any available field for category, preferring category > type > animalType
                    const category = item.category || item.type || item.animalType || 'Unknown';
                    const count = item.count || 0;
                
                reportHTML += `
                    <tr>
                            <td>${category}</td>
                        <td>${locationDisplay}</td>
                            <td>${count}</td>
                    </tr>
                `;
            });
            } else if (typeof inventory === 'object') {
                // Handle inventory as an object where keys are categories
                for (const [category, data] of Object.entries(inventory)) {
                    let count = 0;
                    let locationDisplay = 'Not specified';
                    
                    // Check if data is a number (simple count)
                    if (typeof data === 'number') {
                        count = data;
                    } 
                    // Check if it's an object with count property
                    else if (data && typeof data === 'object') {
                        // Get count from the data object
                        count = data.count || 0;
                        
                        // Get location from the data object
                        if (data.location) {
                            locationDisplay = data.location;
                        } 
                        // Or check for locations object 
                        else if (data.locations && typeof data.locations === 'object') {
                            const locationEntries = Object.entries(data.locations);
                            if (locationEntries.length > 0) {
                                locationDisplay = locationEntries.map(([loc, count]) => `${loc}: ${count}`).join(', ');
                            }
                        }
                    }
                    
                    reportHTML += `
                        <tr>
                            <td>${category}</td>
                            <td>${locationDisplay}</td>
                            <td>${count}</td>
                        </tr>
                    `;
                }
            }
        }
        
        reportHTML += `
                    </tbody>
                </table>
            </div>
        `;
        
        return reportHTML;
    }
    
    /**
     * Create Animal Inventory Table
     * @param {Object} data - Object containing animal inventory
     * @returns {string} HTML for the report
     */
    function createAnimalInventoryTable(data) {
        if (!data || !data.inventory) {
            console.error('No data provided to createAnimalInventoryTable');
            return '<div class="error-message">No animal inventory data available</div>';
        }
        
        const { inventory } = data;
        
        // Calculate summary statistics
        const totalAnimals = inventory.reduce((sum, item) => sum + parseInt(item.count || 0), 0);
        
        // Group by animal type
        const typeGroups = inventory.reduce((groups, item) => {
            // Get the category from any of the possible fields, with fallbacks
            const type = item.category || item.type || item.animalType || 'Unknown';
            if (!groups[type]) {
                groups[type] = {
                    count: 0,
                    locations: {}
                };
            }
            
            groups[type].count += parseInt(item.count || 0);
            
            // Track count by location
            const location = item.location || 'Unspecified';
            if (!groups[type].locations[location]) {
                groups[type].locations[location] = 0;
            }
            groups[type].locations[location] += parseInt(item.count || 0);
            
            return groups;
        }, {});
        
        // Create report HTML
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
                    <p>Total animals: ${totalAnimals}</p>
                    <p>Animal types: ${Object.keys(typeGroups).length}</p>
                </div>
            </div>
            
            <div class="report-section">
                <h3>Animal Inventory by Type</h3>
                <table class="report-table summary-table">
                    <thead>
                        <tr>
                            <th>Animal Type</th>
                            <th>Count</th>
                            <th>% of Total</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // Sort animal types by count (highest first)
        const sortedTypes = Object.entries(typeGroups).sort((a, b) => b[1].count - a[1].count);
        
        sortedTypes.forEach(([type, data]) => {
            const percentage = totalAnimals > 0 ? (data.count / totalAnimals * 100).toFixed(1) : 0;
            
            reportHTML += `
                <tr>
                    <td>${type}</td>
                    <td>${data.count}</td>
                    <td>${percentage}%</td>
                </tr>
            `;
        });
        
        reportHTML += `
                </tbody>
            </table>
        </div>
        
        <div class="report-section">
            <h3>Detailed Inventory</h3>
            <table class="report-table" id="animal-inventory-table">
                <thead>
                    <tr>
                        <th>Animal Type</th>
                        <th>Location</th>
                        <th>Count</th>
                        <th>Last Updated</th>
                        <th>Notes</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        // Sort inventory items by animal type and then location
        const sortedInventory = [...inventory].sort((a, b) => {
            if (a.type !== b.type) return a.type.localeCompare(b.type);
            return (a.location || '').localeCompare(b.location || '');
        });
        
        if (sortedInventory.length === 0) {
            reportHTML += `
                <tr>
                    <td colspan="5" class="no-data">No animal inventory found</td>
                </tr>
            `;
        } else {
            sortedInventory.forEach(item => {
                reportHTML += `
                    <tr>
                        <td>${item.type || 'Unknown'}</td>
                        <td>${item.location || 'Not specified'}</td>
                        <td>${item.count || 0}</td>
                        <td>${formatDate(item.lastUpdated) || 'Unknown'}</td>
                        <td>${item.notes || '-'}</td>
                    </tr>
                `;
            });
        }
        
        reportHTML += `
                </tbody>
            </table>
        </div>
        `;
        
        return reportHTML;
    }
    
    /**
     * Create Feed Inventory Table
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
                        <div class="report-actions">
                            <button onclick="window.print()" class="print-button">Print Report</button>
                            <button onclick="exportReportToCSV('feed-inventory')" class="export-button">Export to CSV</button>
                        </div>
                    </div>
                    <div class="report-summary">
                        <p>No feed inventory data found. To view this report, please add feed items to your inventory.</p>
                    </div>
                </div>
            `;
        }
        
        // Calculate total inventory value
        const totalValue = feedInventory.reduce((sum, item) => {
            const quantity = parseFloat(item.quantity) || 0;
            const pricePerUnit = parseFloat(item.pricePerUnit) || parseFloat(item.price) || 0;
            return sum + (quantity * pricePerUnit);
        }, 0);
        
        // Sort inventory by feed type
        const sortedInventory = [...feedInventory].sort((a, b) => {
            return (a.feedType || 'Unknown').localeCompare(b.feedType || 'Unknown');
        });
        
        // Create report HTML
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
                    <p>Total feed items: ${feedInventory.length}</p>
                    <p>Total inventory value: ${formatCurrency(totalValue)}</p>
                    <p>Recent transactions: ${feedTransactions ? feedTransactions.length : 0}</p>
                </div>
            </div>
            
            <div class="report-section">
                <h3>Current Feed Inventory</h3>
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
        
        if (sortedInventory.length === 0) {
            reportHTML += `
                <tr>
                    <td colspan="8" class="no-data">No feed inventory data found</td>
                </tr>
            `;
        } else {
            sortedInventory.forEach(item => {
                const quantity = parseFloat(item.quantity) || 0;
                const pricePerUnit = parseFloat(item.pricePerUnit) || parseFloat(item.price) || 0;
                const totalValue = quantity * pricePerUnit;
                
                reportHTML += `
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
        }
        
        reportHTML += `
                </tbody>
            </table>
        </div>
        `;
        
        // Add transactions section if we have transactions
        if (feedTransactions && feedTransactions.length > 0) {
            // Sort transactions by date (newest first)
            const sortedTransactions = [...feedTransactions].sort((a, b) => {
                return new Date(b.date) - new Date(a.date);
            });
            
            reportHTML += `
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
        }
        
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
     * @returns {Promise<Object|Array>} The filtered data for the report
     */
    async function collectReportData(filters) {
        console.log('Collecting report data with filters:', filters);
        
        const startDate = new Date(filters.dateRange.start);
        const endDate = new Date(filters.dateRange.end);
        const { category, reportType, mainType } = filters;
        
        // Set end date to end of day for more accurate filtering
        endDate.setHours(23, 59, 59, 999);
        
        // Default empty data
        let reportData = null;
        
        try {
            // Group report handlers by main type
            if (reportType.includes('feed')) {
                // Feed report types
                reportData = await collectFeedReportData(reportType, category, startDate, endDate);
            } else if (reportType.includes('animal')) {
                // Animal report types
                reportData = await collectAnimalReportData(reportType, category, startDate, endDate);
            } else if (reportType.includes('health')) {
                // Health report types
                reportData = await collectHealthReportData(reportType, category, startDate, endDate);
            } else {
                console.warn(`Unknown report type: ${reportType}`);
                return null;
            }
            
            console.log(`Collected data for ${reportType} report:`, 
                Array.isArray(reportData) ? `${reportData.length} items` : 'object data');
            
            return reportData;
        } catch (error) {
            console.error(`Error collecting data for ${reportType} report:`, error);
            throw new Error(`Failed to collect report data: ${error.message}`);
        }
    }

    /**
     * Collect feed-related report data
     * @param {string} reportType - Specific feed report type
     * @param {string} category - Feed category filter
     * @param {Date} startDate - Start date for filtering
     * @param {Date} endDate - End date for filtering
     * @returns {Promise<Object|Array>} Feed report data
     */
    async function collectFeedReportData(reportType, category, startDate, endDate) {
        // Clear cache to ensure fresh data
        mobileStorage.clearCache();
        
        switch (reportType) {
            case 'feed-calculation':
                return await loadFeedCalculationData(startDate, endDate, category);
                
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
                return {
                    feedInventory,
                    feedTransactions: filteredTransactions
                };
                
            case 'feed-purchase':
            case 'feed-usage':
            case 'all-feed':
                // Get feed transactions
                const transactionsStr = await mobileStorage.getItem('feedTransactions');
                const transactions = transactionsStr ? JSON.parse(transactionsStr) : [];
                
                // Filter by date
                let dateFiltered = transactions.filter(transaction => {
                    if (!transaction.date) return false;
                    const transactionDate = new Date(transaction.date);
                    return transactionDate >= startDate && transactionDate <= endDate;
                });
                
                // Filter by type if needed
                if (reportType === 'feed-purchase') {
                    dateFiltered = dateFiltered.filter(t => t.type === 'purchase');
                } else if (reportType === 'feed-usage') {
                    dateFiltered = dateFiltered.filter(t => t.type === 'usage');
                }
                // 'all-feed' includes all types, so no additional filtering
                
                // Further filter by category if specified
                if (category !== 'all') {
                    dateFiltered = dateFiltered.filter(t => t.feedType === category);
                }
                
                return dateFiltered;
                
            default:
                console.warn(`Unknown feed report type: ${reportType}`);
                return [];
        }
    }

    /**
     * Collect animal-related report data
     * @param {string} reportType - Specific animal report type
     * @param {string} category - Animal category filter
     * @param {Date} startDate - Start date for filtering
     * @param {Date} endDate - End date for filtering
     * @returns {Promise<Object|Array>} Animal report data
     */
    async function collectAnimalReportData(reportType, category, startDate, endDate) {
        // Clear cache to ensure fresh data
        mobileStorage.clearCache();
        
        switch (reportType) {
            case 'all-animal':
                return await loadAnimalData(category, startDate, endDate);
                
            case 'animal-inventory':
                return await loadAnimalInventoryData(category, startDate, endDate);
                
            case 'animal-movement':
                return await loadAnimalMovementData(category, startDate, endDate);
                
            case 'animal-purchase':
                return await loadAnimalPurchaseData(category, startDate, endDate);
                
            case 'animal-sale':
                return await loadAnimalSaleData(category, startDate, endDate);
                
            case 'animal-death':
                return await loadAnimalDeathData(category, startDate, endDate);
                
            case 'animal-birth':
                return await loadAnimalBirthData(category, startDate, endDate);
                
            case 'animal-count':
                return await loadAnimalCountData(category, startDate, endDate);
                
            case 'animal-discrepancy':
                return await loadAnimalDiscrepancyData(category, startDate, endDate);
                
            default:
                console.warn(`Unknown animal report type: ${reportType}`);
                return {
                    inventory: [],
                    transactions: []
                };
        }
    }

    /**
     * Collect health-related report data
     * @param {string} reportType - Specific health report type
     * @param {string} category - Animal category filter
     * @param {Date} startDate - Start date for filtering
     * @param {Date} endDate - End date for filtering
     * @returns {Promise<Object>} Health report data
     */
    async function collectHealthReportData(reportType, category, startDate, endDate) {
        // Clear cache to ensure fresh data
        mobileStorage.clearCache();
        
        const dateRange = {
            start: startDate.toISOString().split('T')[0],
            end: endDate.toISOString().split('T')[0]
        };
        
        switch (reportType) {
            case 'all-health':
                return await loadAllHealthData(category, dateRange);
                
            case 'health-treatment':
                return await loadHealthTreatmentData(category, dateRange.start, dateRange.end);
                
            case 'health-vaccination':
                return await loadHealthVaccinationData(category, dateRange.start, dateRange.end);
                
            case 'health-medication':
                return await loadHealthMedicationData(category, dateRange.start, dateRange.end);
                
            default:
                console.warn(`Unknown health report type: ${reportType}`);
                return {
                    _hasData: false,
                    hasData: false,
                    nothingFound: true
                };
        }
    }

    /**
     * Load all health data for reports
     * @param {string} category - Animal category to filter by
     * @param {Object} dateRange - Object with startDate and endDate properties
     * @returns {Object} All health data
     */
    async function loadAllHealthData(category = 'all', dateRange = {}) {
        console.log(`Loading all health data for ${category} from ${dateRange.start} to ${dateRange.end}`);
        
        // Ensure we have a valid date range
        const validDateRange = {
            start: dateRange.start || new Date(0),
            end: dateRange.end || new Date()
        };

        // Load data from each health area
        const treatmentData = await loadHealthTreatmentData(category, validDateRange.start, validDateRange.end);
        const vaccinationData = await loadHealthVaccinationData(category, validDateRange.start, validDateRange.end);
        const medicationData = await loadHealthMedicationData(category, validDateRange.start, validDateRange.end);
        
        // Check if we have any data
        const hasData = 
            (treatmentData.records && treatmentData.records.length > 0) ||
            (vaccinationData.records && vaccinationData.records.length > 0) ||
            (medicationData.records && medicationData.records.length > 0);
        
        // Filter records by their specific type to avoid duplication
        if (treatmentData.records) {
            treatmentData.records = treatmentData.records.filter(record => record.type === 'treatment');
        }
        if (vaccinationData.records) {
            vaccinationData.records = vaccinationData.records.filter(record => record.type === 'vaccination');
        }
        if (medicationData.records) {
            medicationData.records = medicationData.records.filter(record => record.type === 'medication');
        }
        
        // Additional debugging
        console.log(`After type filtering: ${treatmentData.records?.length || 0} treatments, ${vaccinationData.records?.length || 0} vaccinations, ${medicationData.records?.length || 0} medications`);
        
        return {
            treatmentData,
            vaccinationData,
            medicationData,
            hasData,
            _hasData: hasData, // For backwards compatibility
            nothingFound: !hasData,
            dateRange: validDateRange
        };
    }

    /**
     * Load health treatment data
     * @param {string} category - Animal category to filter by
     * @param {Date} startDate - Start date for filtering
     * @param {Date} endDate - End date for filtering
     * @returns {Object} Treatment data and related information
     */
    async function loadHealthTreatmentData(category, startDate, endDate) {
        console.log('Loading health treatment data');
        
        try {
            // Load animal inventory for reference
            const animalData = await loadAnimalData(category, startDate, endDate);
            
            // Try multiple possible storage keys - expanded to include more possible keys
            const possibleKeys = [
                'animalTreatments', 
                'treatments', 
                'healthTreatments', 
                'health_treatments',
                'animal_treatments',
                'treatments_data',
                'healthData_treatments',
                'healthRecords_treatments',
                'health', // Check if health data contains treatments
                'healthRecords' // Check if healthRecords contains treatments
            ];
            
            let treatments = [];
            let foundKey = null;
            
            // Try each possible key
            for (const key of possibleKeys) {
                const dataStr = await mobileStorage.getItem(key);
                if (dataStr) {
                    try {
                        const parsed = JSON.parse(dataStr);
                        
                        // Case 1: Direct array
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            treatments = parsed;
                            foundKey = key;
                            console.log(`Found ${treatments.length} treatments using key: ${key} (direct array)`);
                            break;
                        } 
                        // Case 2: Object with array properties
                        else if (typeof parsed === 'object' && parsed !== null) {
                            // Look for treatment arrays in the object
                            if (parsed.treatments && Array.isArray(parsed.treatments) && parsed.treatments.length > 0) {
                                treatments = parsed.treatments;
                                foundKey = `${key}.treatments`;
                                console.log(`Found ${treatments.length} treatments in property 'treatments' of key: ${key}`);
                                break;
                            }
                            
                            if (parsed.animalTreatments && Array.isArray(parsed.animalTreatments) && parsed.animalTreatments.length > 0) {
                                treatments = parsed.animalTreatments;
                                foundKey = `${key}.animalTreatments`;
                                console.log(`Found ${treatments.length} treatments in property 'animalTreatments' of key: ${key}`);
                                break;
                            }
                            
                            // Check for treatment data by animal category
                            if (typeof parsed === 'object' && Object.keys(parsed).length > 0) {
                                // Try to find treatment data by animal category
                                let categoryTreatments = [];
                                
                                // Handle case where data is structured by animal category
                                Object.entries(parsed).forEach(([categoryName, categoryData]) => {
                                    // Skip non-object values
                                    if (typeof categoryData !== 'object' || categoryData === null) return;
                                    
                                    // Check if this category has treatment data
                                    if (Array.isArray(categoryData.treatments)) {
                                        // Add category info to each treatment
                                        const treatmentsWithCategory = categoryData.treatments.map(treatment => ({
                                            ...treatment,
                                            animalCategory: categoryName
                                        }));
                                        categoryTreatments = [...categoryTreatments, ...treatmentsWithCategory];
                                    } else if (Array.isArray(categoryData)) {
                                        // Add category info to each item if it looks like treatment data
                                        const possibleTreatments = categoryData.filter(item => 
                                            item.treatment || item.treatmentType || item.condition
                                        ).map(treatment => ({
                                            ...treatment,
                                            animalCategory: categoryName
                                        }));
                                        
                                        if (possibleTreatments.length > 0) {
                                            categoryTreatments = [...categoryTreatments, ...possibleTreatments];
                                        }
                                    }
                                });
                                
                                if (categoryTreatments.length > 0) {
                                    treatments = categoryTreatments;
                                    foundKey = `${key} (by category)`;
                                    console.log(`Found ${treatments.length} treatments by animal category in key: ${key}`);
                                    break;
                                }
                            }
                            
                            // Generic search for any array property that might contain treatments
                            for (const [propName, propValue] of Object.entries(parsed)) {
                                if (Array.isArray(propValue) && propValue.length > 0) {
                                    // Check if array items have properties suggesting they are treatments
                                    const possibleTreatments = propValue.filter(item => 
                                        item && typeof item === 'object' && 
                                        (item.treatment || item.treatmentType || item.condition || 
                                         (item.type && item.type.toLowerCase().includes('treatment')))
                                    );
                                    
                                    if (possibleTreatments.length > 0) {
                                        treatments = possibleTreatments;
                                        foundKey = `${key}.${propName}`;
                                        console.log(`Found ${treatments.length} possible treatments in property '${propName}' of key: ${key}`);
                                        break;
                                    }
                                }
                            }
                            
                            // If we found treatments, break from the loop
                            if (treatments.length > 0) break;
                        }
                    } catch (e) {
                        console.warn(`Error parsing ${key} data:`, e);
                    }
                }
            }
            
            // If still no records, try to find health data in all storage
            if (!foundKey) {
                console.info('No treatment data found in known keys, trying to scan all storage');
                try {
                    // Special case: check for a "health" record in the main storage
                    const healthDataStr = await mobileStorage.getItem('health');
                    if (healthDataStr) {
                        const healthData = JSON.parse(healthDataStr);
                        if (healthData && typeof healthData === 'object') {
                            console.log('Found health data, checking for treatments');
                            
                            // Extract treatments from health data
                            if (Array.isArray(healthData.treatments)) {
                                treatments = healthData.treatments;
                                foundKey = 'health.treatments';
                                console.log(`Found ${treatments.length} treatments in health.treatments`);
                            } 
                            // Check for treatments by animal category (e.g., health.Cows.treatments)
                            else {
                                let allTreatments = [];
                                Object.entries(healthData).forEach(([key, value]) => {
                                    if (typeof value === 'object' && value !== null) {
                                        // If this is an animal category with a treatments array
                                        if (Array.isArray(value.treatments)) {
                                            const categoryTreatments = value.treatments.map(t => ({
                                                ...t,
                                                animalCategory: key
                                            }));
                                            allTreatments = [...allTreatments, ...categoryTreatments];
                                        }
                                        // If this is an animal category with treatment objects directly
                                        else if (Array.isArray(value)) {
                                            const possibleTreatments = value.filter(item => 
                                                item && typeof item === 'object' && 
                                                (item.treatment || item.treatmentType || item.condition)
                                            ).map(t => ({
                                                ...t,
                                                animalCategory: key
                                            }));
                                            
                                            if (possibleTreatments.length > 0) {
                                                allTreatments = [...allTreatments, ...possibleTreatments];
                                            }
                                        }
                                    }
                                });
                                
                                if (allTreatments.length > 0) {
                                    treatments = allTreatments;
                                    foundKey = 'health (by category)';
                                    console.log(`Found ${treatments.length} treatments in health data by category`);
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.warn('Error scanning all storage for health data:', e);
                }
            }
            
            if (!foundKey) {
                console.info('No treatment data found in storage under any known format');
                treatments = [];
            }
            
            console.log(`Found ${treatments.length} treatment records`);
            
            // Filter by date range
            if (startDate || endDate) {
                const startDateObj = startDate ? new Date(startDate) : null;
                const endDateObj = endDate ? new Date(endDate) : null;
                
                // Set time for endDate to end of day for proper comparison
                if (endDateObj) {
                    endDateObj.setHours(23, 59, 59, 999);
                }
                
                treatments = treatments.filter(treatment => {
                    if (!treatment.date && !treatment.timestamp && !treatment.treatmentDate) return true;
                    
                    const txDate = new Date(treatment.date || treatment.timestamp || treatment.treatmentDate);
                    if (startDateObj && txDate < startDateObj) return false;
                    if (endDateObj && txDate > endDateObj) return false;
                    
                    return true;
                });
                
                console.log(`After date filtering: ${treatments.length} treatment records`);
            }
            
            // Filter by category
            if (category && category !== 'all') {
                treatments = treatments.filter(t => {
                    const recordCategory = t.animalCategory || t.animalType || t.category;
                    return !recordCategory || recordCategory.toLowerCase() === category.toLowerCase();
                });
                
                console.log(`After category filtering: ${treatments.length} treatment records`);
            }
            
            return {
                treatments,
                records: treatments, // Add records property for createHealthReportTable compatibility
                hasData: treatments.length > 0,
                _hasData: treatments.length > 0,
                _isDemoData: false,
                categoryFilter: category,
                dateRange: {
                    start: startDate,
                    end: endDate
                }
            };
        } catch (error) {
            console.error('Error loading health treatment data:', error);
            return {
                treatments: [],
                hasData: false,
                _hasData: false,
                _isDemoData: false,
                categoryFilter: category,
                dateRange: {
                    start: startDate,
                    end: endDate
                }
            };
        }
    }

    /**
     * Load health vaccination data
     * @param {string} category - Animal category to filter by
     * @param {Date} startDate - Start date for filtering
     * @param {Date} endDate - End date for filtering
     * @returns {Object} Vaccination data and related information
     */
    async function loadHealthVaccinationData(category, startDate, endDate) {
        console.log('Loading health vaccination data');
        
        try {
            // Load animal inventory for reference
            const animalData = await loadAnimalData(category, startDate, endDate);
            
            // Try multiple possible storage keys - expanded to include more possible keys
            const possibleKeys = [
                'animalVaccinations', 
                'vaccinations', 
                'healthVaccinations',
                'health_vaccinations',
                'animal_vaccinations',
                'vaccinations_data',
                'healthData_vaccinations',
                'healthRecords_vaccinations',
                'health', // Check if health data contains vaccinations
                'healthRecords' // Check if healthRecords contains vaccinations
            ];
            
            let vaccinations = [];
            let foundKey = null;
            
            // Try each possible key
            for (const key of possibleKeys) {
                const dataStr = await mobileStorage.getItem(key);
                if (dataStr) {
                    try {
                        const parsed = JSON.parse(dataStr);
                        
                        // Case 1: Direct array
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            vaccinations = parsed;
                            foundKey = key;
                            console.log(`Found ${vaccinations.length} vaccinations using key: ${key} (direct array)`);
                            break;
                        } 
                        // Case 2: Object with array properties
                        else if (typeof parsed === 'object' && parsed !== null) {
                            // Look for vaccination arrays in the object
                            if (parsed.vaccinations && Array.isArray(parsed.vaccinations) && parsed.vaccinations.length > 0) {
                                vaccinations = parsed.vaccinations;
                                foundKey = `${key}.vaccinations`;
                                console.log(`Found ${vaccinations.length} vaccinations in property 'vaccinations' of key: ${key}`);
                                break;
                            }
                            
                            if (parsed.animalVaccinations && Array.isArray(parsed.animalVaccinations) && parsed.animalVaccinations.length > 0) {
                                vaccinations = parsed.animalVaccinations;
                                foundKey = `${key}.animalVaccinations`;
                                console.log(`Found ${vaccinations.length} vaccinations in property 'animalVaccinations' of key: ${key}`);
                                break;
                            }
                            
                            // Check for vaccination data by animal category
                            if (typeof parsed === 'object' && Object.keys(parsed).length > 0) {
                                // Try to find vaccination data by animal category
                                let categoryVaccinations = [];
                                
                                // Handle case where data is structured by animal category
                                Object.entries(parsed).forEach(([categoryName, categoryData]) => {
                                    // Skip non-object values
                                    if (typeof categoryData !== 'object' || categoryData === null) return;
                                    
                                    // Check if this category has vaccination data
                                    if (Array.isArray(categoryData.vaccinations)) {
                                        // Add category info to each vaccination
                                        const vaccinationsWithCategory = categoryData.vaccinations.map(vaccination => ({
                                            ...vaccination,
                                            animalCategory: categoryName
                                        }));
                                        categoryVaccinations = [...categoryVaccinations, ...vaccinationsWithCategory];
                                    } else if (Array.isArray(categoryData)) {
                                        // Add category info to each item if it looks like vaccination data
                                        const possibleVaccinations = categoryData.filter(item => 
                                            item.vaccine || item.vaccination || item.disease || 
                                            (item.type && item.type.toLowerCase().includes('vacc'))
                                        ).map(vaccination => ({
                                            ...vaccination,
                                            animalCategory: categoryName
                                        }));
                                        
                                        if (possibleVaccinations.length > 0) {
                                            categoryVaccinations = [...categoryVaccinations, ...possibleVaccinations];
                                        }
                                    }
                                });
                                
                                if (categoryVaccinations.length > 0) {
                                    vaccinations = categoryVaccinations;
                                    foundKey = `${key} (by category)`;
                                    console.log(`Found ${vaccinations.length} vaccinations by animal category in key: ${key}`);
                                    break;
                                }
                            }
                            
                            // Generic search for any array property that might contain vaccinations
                            for (const [propName, propValue] of Object.entries(parsed)) {
                                if (Array.isArray(propValue) && propValue.length > 0) {
                                    // Check if array items have properties suggesting they are vaccinations
                                    const possibleVaccinations = propValue.filter(item => 
                                        item && typeof item === 'object' && 
                                        (item.vaccine || item.vaccination || item.disease || 
                                         (item.type && item.type.toLowerCase().includes('vacc')))
                                    );
                                    
                                    if (possibleVaccinations.length > 0) {
                                        vaccinations = possibleVaccinations;
                                        foundKey = `${key}.${propName}`;
                                        console.log(`Found ${vaccinations.length} possible vaccinations in property '${propName}' of key: ${key}`);
                                        break;
                                    }
                                }
                            }
                            
                            // If we found vaccinations, break from the loop
                            if (vaccinations.length > 0) break;
                        }
                    } catch (e) {
                        console.warn(`Error parsing ${key} data:`, e);
                    }
                }
            }
            
            // If still no records, try to find health data in all storage
            if (!foundKey) {
                console.info('No vaccination data found in known keys, trying to scan all storage');
                try {
                    // Special case: check for a "health" record in the main storage
                    const healthDataStr = await mobileStorage.getItem('health');
                    if (healthDataStr) {
                        const healthData = JSON.parse(healthDataStr);
                        if (healthData && typeof healthData === 'object') {
                            console.log('Found health data, checking for vaccinations');
                            
                            // Extract vaccinations from health data
                            if (Array.isArray(healthData.vaccinations)) {
                                vaccinations = healthData.vaccinations;
                                foundKey = 'health.vaccinations';
                                console.log(`Found ${vaccinations.length} vaccinations in health.vaccinations`);
                            } 
                            // Check for vaccinations by animal category (e.g., health.Cows.vaccinations)
                            else {
                                let allVaccinations = [];
                                Object.entries(healthData).forEach(([key, value]) => {
                                    if (typeof value === 'object' && value !== null) {
                                        // If this is an animal category with a vaccinations array
                                        if (Array.isArray(value.vaccinations)) {
                                            const categoryVaccinations = value.vaccinations.map(v => ({
                                                ...v,
                                                animalCategory: key
                                            }));
                                            allVaccinations = [...allVaccinations, ...categoryVaccinations];
                                        }
                                        // If this is an animal category with vaccination objects directly
                                        else if (Array.isArray(value)) {
                                            const possibleVaccinations = value.filter(item => 
                                                item && typeof item === 'object' && 
                                                (item.vaccine || item.vaccination || item.disease)
                                            ).map(v => ({
                                                ...v,
                                                animalCategory: key
                                            }));
                                            
                                            if (possibleVaccinations.length > 0) {
                                                allVaccinations = [...allVaccinations, ...possibleVaccinations];
                                            }
                                        }
                                    }
                                });
                                
                                if (allVaccinations.length > 0) {
                                    vaccinations = allVaccinations;
                                    foundKey = 'health (by category)';
                                    console.log(`Found ${vaccinations.length} vaccinations in health data by category`);
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.warn('Error scanning all storage for health data:', e);
                }
            }
            
            if (!foundKey) {
                console.info('No vaccination data found in storage under any known format');
                vaccinations = [];
            }
            
            console.log(`Found ${vaccinations.length} vaccination records`);
            
            // Filter by date range
            if (startDate || endDate) {
                const startDateObj = startDate ? new Date(startDate) : null;
                const endDateObj = endDate ? new Date(endDate) : null;
                
                // Set time for endDate to end of day for proper comparison
                if (endDateObj) {
                    endDateObj.setHours(23, 59, 59, 999);
                }
                
                vaccinations = vaccinations.filter(vaccination => {
                    if (!vaccination.date && !vaccination.timestamp && !vaccination.vaccinationDate) return true;
                    
                    const txDate = new Date(vaccination.date || vaccination.timestamp || vaccination.vaccinationDate);
                    if (startDateObj && txDate < startDateObj) return false;
                    if (endDateObj && txDate > endDateObj) return false;
                    
                    return true;
                });
                
                console.log(`After date filtering: ${vaccinations.length} vaccination records`);
            }
            
            // Filter by category
            if (category && category !== 'all') {
                vaccinations = vaccinations.filter(vaccination => {
                    const recordCategory = vaccination.animalCategory || vaccination.animalType || vaccination.category;
                    return !recordCategory || recordCategory.toLowerCase() === category.toLowerCase();
                });
                
                console.log(`After category filtering: ${vaccinations.length} vaccination records`);
            }
            
            return {
                vaccinations,
                records: vaccinations, // Add records property for createHealthReportTable compatibility
                hasData: vaccinations.length > 0,
                _hasData: vaccinations.length > 0,
                _isDemoData: false,
                categoryFilter: category,
                dateRange: {
                    start: startDate,
                    end: endDate
                }
            };
        } catch (error) {
            console.error('Error loading health vaccination data:', error);
            return {
                vaccinations: [],
                records: [], // Also add records property in the error case
                hasData: false,
                _hasData: false,
                _isDemoData: false,
                categoryFilter: category,
                dateRange: {
                    start: startDate,
                    end: endDate
                }
            };
        }
    }

    /**
     * Load health medication data
     * @param {string} category - Animal category to filter by
     * @param {Date} startDate - Start date for filtering
     * @param {Date} endDate - End date for filtering
     * @returns {Object} Medication data and related information
     */
    async function loadHealthMedicationData(category, startDate, endDate) {
        console.log('Loading health medication data');
        
        try {
            // Load animal inventory for reference
            const animalData = await loadAnimalData(category, startDate, endDate);
            
            // Try multiple possible storage keys - expanded to include more possible keys
            const possibleKeys = [
                'animalMedications', 
                'medications', 
                'healthMedications',
                'health_medications',
                'animal_medications',
                'medications_data',
                'healthData_medications',
                'healthRecords_medications',
                'health', // Check if health data contains medications
                'healthRecords' // Check if healthRecords contains medications
            ];
            
            let medications = [];
            let foundKey = null;
            
            // Try each possible key
            for (const key of possibleKeys) {
                const dataStr = await mobileStorage.getItem(key);
                if (dataStr) {
                    try {
                        const parsed = JSON.parse(dataStr);
                        
                        // Case 1: Direct array
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            medications = parsed;
                            foundKey = key;
                            console.log(`Found ${medications.length} medications using key: ${key} (direct array)`);
                            break;
                        } 
                        // Case 2: Object with array properties
                        else if (typeof parsed === 'object' && parsed !== null) {
                            // Look for medication arrays in the object
                            if (parsed.medications && Array.isArray(parsed.medications) && parsed.medications.length > 0) {
                                medications = parsed.medications;
                                foundKey = `${key}.medications`;
                                console.log(`Found ${medications.length} medications in property 'medications' of key: ${key}`);
                                break;
                            }
                            
                            if (parsed.animalMedications && Array.isArray(parsed.animalMedications) && parsed.animalMedications.length > 0) {
                                medications = parsed.animalMedications;
                                foundKey = `${key}.animalMedications`;
                                console.log(`Found ${medications.length} medications in property 'animalMedications' of key: ${key}`);
                                break;
                            }
                            
                            // Check for medication data by animal category
                            if (typeof parsed === 'object' && Object.keys(parsed).length > 0) {
                                // Try to find medication data by animal category
                                let categoryMedications = [];
                                
                                // Handle case where data is structured by animal category
                                Object.entries(parsed).forEach(([categoryName, categoryData]) => {
                                    // Skip non-object values
                                    if (typeof categoryData !== 'object' || categoryData === null) return;
                                    
                                    // Check if this category has medication data
                                    if (Array.isArray(categoryData.medications)) {
                                        // Add category info to each medication
                                        const medicationsWithCategory = categoryData.medications.map(medication => ({
                                            ...medication,
                                            animalCategory: categoryName
                                        }));
                                        categoryMedications = [...categoryMedications, ...medicationsWithCategory];
                                    } else if (Array.isArray(categoryData)) {
                                        // Add category info to each item if it looks like medication data
                                        const possibleMedications = categoryData.filter(item => 
                                            item.medication || item.medicationName || item.dosage || 
                                            (item.type && item.type.toLowerCase().includes('med'))
                                        ).map(medication => ({
                                            ...medication,
                                            animalCategory: categoryName
                                        }));
                                        
                                        if (possibleMedications.length > 0) {
                                            categoryMedications = [...categoryMedications, ...possibleMedications];
                                        }
                                    }
                                });
                                
                                if (categoryMedications.length > 0) {
                                    medications = categoryMedications;
                                    foundKey = `${key} (by category)`;
                                    console.log(`Found ${medications.length} medications by animal category in key: ${key}`);
                                    break;
                                }
                            }
                            
                            // Generic search for any array property that might contain medications
                            for (const [propName, propValue] of Object.entries(parsed)) {
                                if (Array.isArray(propValue) && propValue.length > 0) {
                                    // Check if array items have properties suggesting they are medications
                                    const possibleMedications = propValue.filter(item => 
                                        item && typeof item === 'object' && 
                                        (item.medication || item.medicationName || item.dosage || 
                                         (item.type && item.type.toLowerCase().includes('med')))
                                    );
                                    
                                    if (possibleMedications.length > 0) {
                                        medications = possibleMedications;
                                        foundKey = `${key}.${propName}`;
                                        console.log(`Found ${medications.length} possible medications in property '${propName}' of key: ${key}`);
                                        break;
                                    }
                                }
                            }
                            
                            // If we found medications, break from the loop
                            if (medications.length > 0) break;
                        }
                    } catch (e) {
                        console.warn(`Error parsing ${key} data:`, e);
                    }
                }
            }
            
            // If still no records, try to find health data in all storage
            if (!foundKey) {
                console.info('No medication data found in known keys, trying to scan all storage');
                try {
                    // Special case: check for a "health" record in the main storage
                    const healthDataStr = await mobileStorage.getItem('health');
                    if (healthDataStr) {
                        const healthData = JSON.parse(healthDataStr);
                        if (healthData && typeof healthData === 'object') {
                            console.log('Found health data, checking for medications');
                            
                            // Extract medications from health data
                            if (Array.isArray(healthData.medications)) {
                                medications = healthData.medications;
                                foundKey = 'health.medications';
                                console.log(`Found ${medications.length} medications in health.medications`);
                            } 
                            // Check for medications by animal category (e.g., health.Cows.medications)
                            else {
                                let allMedications = [];
                                Object.entries(healthData).forEach(([key, value]) => {
                                    if (typeof value === 'object' && value !== null) {
                                        // If this is an animal category with a medications array
                                        if (Array.isArray(value.medications)) {
                                            const categoryMedications = value.medications.map(m => ({
                                                ...m,
                                                animalCategory: key
                                            }));
                                            allMedications = [...allMedications, ...categoryMedications];
                                        }
                                        // If this is an animal category with medication objects directly
                                        else if (Array.isArray(value)) {
                                            const possibleMedications = value.filter(item => 
                                                item && typeof item === 'object' && 
                                                (item.medication || item.medicationName || item.dosage)
                                            ).map(m => ({
                                                ...m,
                                                animalCategory: key
                                            }));
                                            
                                            if (possibleMedications.length > 0) {
                                                allMedications = [...allMedications, ...possibleMedications];
                                            }
                                        }
                                    }
                                });
                                
                                if (allMedications.length > 0) {
                                    medications = allMedications;
                                    foundKey = 'health (by category)';
                                    console.log(`Found ${medications.length} medications in health data by category`);
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.warn('Error scanning all storage for health data:', e);
                }
            }
            
            if (!foundKey) {
                console.info('No medication data found in storage under any known format');
                medications = [];
            }
            
            console.log(`Found ${medications.length} medication records`);
            
            // Filter by date range
            if (startDate || endDate) {
                const startDateObj = startDate ? new Date(startDate) : null;
                const endDateObj = endDate ? new Date(endDate) : null;
                
                // Set time for endDate to end of day for proper comparison
                if (endDateObj) {
                    endDateObj.setHours(23, 59, 59, 999);
                }
                
                medications = medications.filter(medication => {
                    if (!medication.date && !medication.timestamp && !medication.medicationDate) return true;
                    
                    const txDate = new Date(medication.date || medication.timestamp || medication.medicationDate);
                    if (startDateObj && txDate < startDateObj) return false;
                    if (endDateObj && txDate > endDateObj) return false;
                    
                    return true;
                });
                
                console.log(`After date filtering: ${medications.length} medication records`);
            }
            
            // Filter by category
            if (category && category !== 'all') {
                medications = medications.filter(medication => {
                    const recordCategory = medication.animalCategory || medication.animalType || medication.category;
                    return !recordCategory || recordCategory.toLowerCase() === category.toLowerCase();
                });
                
                console.log(`After category filtering: ${medications.length} medication records`);
            }
            
            return {
                medications,
                records: medications, // Add records property that matches the expected format in createHealthReportTable
                hasData: medications.length > 0,
                _hasData: medications.length > 0,
                _isDemoData: false,
                categoryFilter: category,
                dateRange: {
                    start: startDate,
                    end: endDate
                }
            };
        } catch (error) {
            console.error('Error loading health medication data:', error);
            return {
                medications: [],
                records: [], // Also add records property in the error case
                hasData: false,
                _hasData: false,
                _isDemoData: false,
                categoryFilter: category,
                dateRange: {
                    start: startDate,
                    end: endDate
                }
            };
        }
    }

    /**
     * Load animal data filtered by category and date range
     * This is a base function that loads inventory and transaction data used by all animal reports
     * @param {string} category - Animal category to filter by
     * @param {Date} startDate - Start date for filtering
     * @param {Date} endDate - End date for filtering
     * @returns {Promise<Object>} Animal inventory and transaction data
     */
    async function loadAnimalData(category, startDate, endDate) {
        console.log('Loading animal data for report');
        
        try {
            // Load animal inventory
            const inventoryStr = await mobileStorage.getItem('animalInventory');
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
                                    category: animalType, // Add category field for consistent access
                                    location: 'Not specified',
                                    count: parseInt(data) || 0
                                });
                            } else if (typeof data === 'object' && data !== null) {
                                // New format with locations
                                if (data.locations && Object.keys(data.locations).length > 0) {
                                    // Add entries for each location
                                    Object.entries(data.locations).forEach(([location, locationCount]) => {
                                        inventory.push({
                                            type: animalType,
                                            category: animalType, // Add category field for consistent access
                                            location: location,
                                            count: parseInt(locationCount) || 0
                                        });
                                    });
                                } else {
                                    // No locations defined, use the total with default location
                                    inventory.push({
                                        type: animalType,
                                        category: animalType, // Add category field for consistent access
                                        location: 'Not specified',
                                        count: parseInt(data.total) || 0
                                    });
                                }
                            }
                        });
                    } else if (Array.isArray(parsedInventory)) {
                        inventory = parsedInventory;
                    }
                    
                    console.log('Converted inventory for report:', inventory);
                } catch (e) {
                    console.error('Error parsing animal inventory:', e);
                }
            }
            
            // Filter by category if specified
            if (category && category !== 'all') {
                inventory = inventory.filter(item => item.type === category);
            }
            
            // Get animal transactions from recentActivities instead of animalTransactions
            const activitiesStr = await mobileStorage.getItem('recentActivities');
            let transactions = [];
            
            if (activitiesStr) {
                try {
                    const parsedActivities = JSON.parse(activitiesStr);
                    if (Array.isArray(parsedActivities)) {
                        // Filter for animal-related activities
                        transactions = parsedActivities.filter(activity => 
                            ['add', 'sell', 'buy', 'move', 'death', 'birth', 'stock-count', 'resolution', 'reversal'].includes(activity.type)
                        );
                        console.log(`Found ${transactions.length} animal-related transactions in recentActivities`);
                    } else {
                        console.warn('Recent activities is not an array, using empty array');
                    }
                } catch (e) {
                    console.error('Error parsing animal activities:', e);
                }
            } else {
                console.warn('No recentActivities found, checking legacy locations');
            }
            
            // If we didn't find any transactions, check legacy storage locations
            if (transactions.length === 0) {
                // Try to load from separate transaction storage locations
                const storageKeys = [
                    'animalTransactions',
                    'animalSales',
                    'animalPurchases',
                    'stockCounts',
                    'animalMovements',
                    'animalBirths',
                    'animalDeaths'
                ];
                
                for (const key of storageKeys) {
                    try {
                        const dataStr = await mobileStorage.getItem(key);
                        if (dataStr) {
                            const parsed = JSON.parse(dataStr);
                            if (Array.isArray(parsed) && parsed.length > 0) {
                                // Convert to standard transaction format as needed
                                let convertedTransactions = [];
                                
                                // Different conversion based on storage key
                                if (key === 'animalSales') {
                                    convertedTransactions = parsed.map(sale => ({
                                        ...sale,
                                        type: 'sell'
                                    }));
                                } else if (key === 'animalPurchases') {
                                    convertedTransactions = parsed.map(purchase => ({
                                        ...purchase,
                                        type: 'buy'
                                    }));
                                } else if (key === 'stockCounts') {
                                    convertedTransactions = parsed.map(count => ({
                                        ...count,
                                        type: 'stock-count'
                                    }));
                                } else {
                                    // Use as is
                                    convertedTransactions = parsed;
                                }
                                
                                console.log(`Found ${convertedTransactions.length} transactions in ${key}`);
                                transactions = [...transactions, ...convertedTransactions];
                            }
                        }
                    } catch (e) {
                        console.error(`Error loading from ${key}:`, e);
                    }
                }
            }
            
            // Deduplicate transactions to avoid double-counting
            console.log(`Before deduplication: ${transactions.length} transactions`);
            const uniqueMap = new Map();
            transactions = transactions.filter(tx => {
                if (!tx) return false;
                
                // Create a unique key for each transaction based on its properties
                const date = tx.timestamp || tx.date || '';
                const formattedDate = date ? new Date(date).toISOString().split('T')[0] : '';
                const category = tx.category || tx.animalType || tx.fromCategory || '';
                const type = tx.type || '';
                
                // Add relevant fields based on transaction type
                let uniqueFields = '';
                if (type === 'move') {
                    // For moves, include from/to categories and quantity
                    const fromCategory = tx.fromCategory || '';
                    const toCategory = tx.toCategory || '';
                    const quantity = tx.quantity || tx.count || 0;
                    uniqueFields = `|${fromCategory}|${toCategory}|${quantity}`;
                } else if (type === 'stock-count') {
                    // For stock counts, include expected, actual, and counted by
                    const expected = tx.expected || 0;
                    const actual = tx.actual || 0;
                    const counterName = tx.counterName || '-';
                    uniqueFields = `|${expected}|${actual}|${counterName}`;
                } else {
                    // For other transactions, include count/quantity, price if available
                    const count = tx.count || tx.quantity || 0;
                    const amount = tx.amount || tx.price || tx.cost || 0;
                    uniqueFields = `|${count}|${amount}`;
                }
                
                const key = `${formattedDate}|${type}|${category}${uniqueFields}`;
                
                // If we haven't seen this key before, keep it
                if (!uniqueMap.has(key)) {
                    uniqueMap.set(key, true);
                    return true;
                }
                // Otherwise it's a duplicate, so filter it out
                return false;
            });
            console.log(`After deduplication: ${transactions.length} transactions`);
            
            // Add date filtering before returning
            if (startDate || endDate) {
                const startDateObj = startDate ? new Date(startDate) : null;
                const endDateObj = endDate ? new Date(endDate) : null;
                
                if (endDateObj) {
                    // Set to end of day for inclusive comparison
                    endDateObj.setHours(23, 59, 59, 999);
                }
                
                console.log(`Date filtering - before: ${transactions.length} transactions`);
                console.log(`Date range: ${startDateObj?.toISOString() || 'any'} to ${endDateObj?.toISOString() || 'any'}`);
                
                transactions = transactions.filter(tx => {
                    // Get date from transaction
                    let txDate;
                    if (tx.timestamp) {
                        txDate = new Date(tx.timestamp);
                    } else if (tx.date) {
                        txDate = new Date(tx.date);
                        
                        // Handle YYYY-MM-DD format without time
                        if (tx.date.indexOf('T') === -1) {
                            // Set to noon to avoid timezone issues
                            txDate.setHours(12, 0, 0, 0);
                        }
                    } else {
                        // No date available
                        return false;
                    }
                    
                    // Check against range
                    const inRange = 
                        (!startDateObj || txDate >= startDateObj) && 
                        (!endDateObj || txDate <= endDateObj);
                    
                    return inRange;
                });
                
                console.log(`Date filtering - after: ${transactions.length} transactions`);
            }
            
            // Add category filtering if needed
            if (category && category !== 'all') {
                const beforeCount = transactions.length;
                transactions = transactions.filter(tx => tx.category === category);
                console.log(`Category filtering (${category}): ${beforeCount} → ${transactions.length} transactions`);
            }
            
            // Log the data we're returning
            console.log(`Found ${inventory.length} inventory items and ${transactions.length} transactions`);
            
            return {
                inventory,
                transactions
            };
        } catch (error) {
            console.error('Error loading animal data:', error);
            return {
                inventory: [],
                transactions: []
            };
        }
    }
    
    /**
     * Load animal inventory data
     * @param {string} category - Animal category to filter by
     * @param {Date} startDate - Start date for filtering
     * @param {Date} endDate - End date for filtering
     * @returns {Promise<Object>} Animal inventory data
     */
    async function loadAnimalInventoryData(category, startDate, endDate) {
        try {
            // Use the base animal data loading function
            const animalData = await loadAnimalData(category, startDate, endDate);
            
            // For inventory report, we just return the data as is
            return animalData;
        } catch (error) {
            console.error('Error loading animal inventory data:', error);
            return {
                inventory: [],
                transactions: []
            };
        }
    }
    
    /**
     * Load animal movement data
     * @param {string} category - Animal category to filter by
     * @param {Date} startDate - Start date for filtering
     * @param {Date} endDate - End date for filtering
     * @returns {Promise<Object>} Animal movement data
     */
    async function loadAnimalMovementData(category, startDate, endDate) {
        try {
            // Use the base animal data loading function
            const animalData = await loadAnimalData(category, startDate, endDate);
            
            console.log(`Total transactions before filtering for movement: ${animalData.transactions.length}`);
            
            // Filter transactions to only include movement-related types
            const movementTransactions = animalData.transactions.filter(t => {
                // Flexible matching for move transactions
                const isMove = t.type === 'move';
                
                // Debug each transaction to see what's available
                if (isMove) {
                    console.log(`Found move transaction:`, t);
                }
                
                return isMove;
            });
            
            console.log(`Found ${movementTransactions.length} movement transactions`);
            
            return {
                inventory: animalData.inventory,
                transactions: movementTransactions
            };
        } catch (error) {
            console.error('Error loading animal movement data:', error);
            return {
                inventory: [],
                transactions: []
            };
        }
    }
    
    /**
     * Load animal purchase data
     * @param {string} category - Animal category to filter by
     * @param {Date} startDate - Start date for filtering
     * @param {Date} endDate - End date for filtering
     * @returns {Promise<Object>} Animal purchase data
     */
    async function loadAnimalPurchaseData(category, startDate, endDate) {
        try {
            // Use the base animal data loading function
            const animalData = await loadAnimalData(category, startDate, endDate);
            
            console.log(`Total transactions before filtering for purchases: ${animalData.transactions.length}`);
            
            // Filter transactions to only include purchases
            const purchaseTransactions = animalData.transactions.filter(t => {
                // Check for buy or purchase type
                const isBuy = t.type === 'buy' || t.type === 'purchase';
                
                // Debug output for all transactions to diagnose issues
                console.log(`Transaction type: ${t.type}, category: ${t.category}, isBuy: ${isBuy}`);
                
                if (isBuy) {
                    console.log(`Found purchase transaction:`, t);
                }
                
                return isBuy;
            });
            
            console.log(`Found ${purchaseTransactions.length} purchase transactions`);
            
            return {
                inventory: animalData.inventory,
                transactions: purchaseTransactions
            };
        } catch (error) {
            console.error('Error loading animal purchase data:', error);
            return {
                inventory: [],
                transactions: []
            };
        }
    }
    
    /**
     * Load animal sale data
     * @param {string} category - Animal category to filter by
     * @param {Date} startDate - Start date for filtering
     * @param {Date} endDate - End date for filtering
     * @returns {Promise<Object>} Animal sale data
     */
    async function loadAnimalSaleData(category, startDate, endDate) {
        try {
            // Use the base animal data loading function
            const animalData = await loadAnimalData(category, startDate, endDate);
            
            console.log(`Total transactions before filtering for sales: ${animalData.transactions.length}`);
            
            // Filter transactions to only include sales
            const saleTransactions = animalData.transactions.filter(t => {
                // Check for sell or sale type
                const isSell = t.type === 'sell' || t.type === 'sale';
                
                // Debug output for all transactions to diagnose issues
                console.log(`Transaction type: ${t.type}, category: ${t.category}, isSell: ${isSell}`);
                
                if (isSell) {
                    console.log(`Found sale transaction:`, t);
                }
                
                return isSell;
            });
            
            console.log(`Found ${saleTransactions.length} sale transactions`);
            
            return {
                inventory: animalData.inventory,
                transactions: saleTransactions
            };
        } catch (error) {
            console.error('Error loading animal sale data:', error);
            return {
                inventory: [],
                transactions: []
            };
        }
    }
    
    /**
     * Load animal birth data
     * @param {string} category - Animal category to filter by
     * @param {Date} startDate - Start date for filtering
     * @param {Date} endDate - End date for filtering
     * @returns {Promise<Object>} Animal birth data
     */
    async function loadAnimalBirthData(category, startDate, endDate) {
        try {
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
            
            console.log(`Found ${birthTransactions.length} birth transactions`);
            
            return {
                inventory: animalData.inventory,
                transactions: birthTransactions
            };
        } catch (error) {
            console.error('Error loading animal birth data:', error);
            return {
                inventory: [],
                transactions: []
            };
        }
    }
    
    /**
     * Load animal death data
     * @param {string} category - Animal category to filter by
     * @param {Date} startDate - Start date for filtering
     * @param {Date} endDate - End date for filtering
     * @returns {Promise<Object>} Animal death data
     */
    async function loadAnimalDeathData(category, startDate, endDate) {
        try {
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
            
            console.log(`Found ${deathTransactions.length} death transactions`);
            
            return {
                inventory: animalData.inventory,
                transactions: deathTransactions
            };
        } catch (error) {
            console.error('Error loading animal death data:', error);
            return {
                inventory: [],
                transactions: []
            };
        }
    }
    
    /**
     * Load animal count data
     * @param {string} category - Animal category to filter by
     * @param {Date} startDate - Start date for filtering
     * @param {Date} endDate - End date for filtering
     * @returns {Promise<Object>} Animal count data
     */
    async function loadAnimalCountData(category, startDate, endDate) {
        try {
            // Use the base animal data loading function
            const animalData = await loadAnimalData(category, startDate, endDate);
            
            console.log(`Total transactions before filtering for counts: ${animalData.transactions.length}`);
            
            // Filter transactions to only include stock counts
            const countTransactions = animalData.transactions.filter(t => {
                // Check for stock-count type
                const isCount = t.type === 'stock-count';
                
                // Debug output for all transactions to diagnose issues
                console.log(`Transaction type: ${t.type}, category: ${t.category}, isCount: ${isCount}`);
                
                if (isCount) {
                    console.log(`Found count transaction:`, t);
                }
                
                return isCount;
            });
            
            console.log(`Found ${countTransactions.length} count transactions`);
            
            return {
                inventory: animalData.inventory,
                transactions: countTransactions
            };
        } catch (error) {
            console.error('Error loading animal count data:', error);
            return {
                inventory: [],
                transactions: []
            };
        }
    }
    
    /**
     * Load animal discrepancy data
     * @param {string} category - Animal category to filter by
     * @param {Date} startDate - Start date for filtering
     * @param {Date} endDate - End date for filtering
     * @returns {Promise<Object>} Animal discrepancy data
     */
    async function loadAnimalDiscrepancyData(category, startDate, endDate) {
        try {
            console.log('Loading animal discrepancy data...');
            
            // Get stock discrepancies from stockDiscrepancies
            const discrepanciesStr = await mobileStorage.getItem('stockDiscrepancies');
            let discrepancies = [];
            
            if (discrepanciesStr) {
                try {
                    discrepancies = JSON.parse(discrepanciesStr);
                    console.log(`Found ${discrepancies.length} stock discrepancies in storage`);
                } catch (e) {
                    console.error('Error parsing stock discrepancies:', e);
                }
            }
            
            // Also get stock-count transactions and resolutions from recentActivities
            const activitiesStr = await mobileStorage.getItem('recentActivities');
            let stockCounts = [];
            let resolutions = [];
            
            if (activitiesStr) {
                try {
                    const activities = JSON.parse(activitiesStr);
                    console.log('Found activities:', activities);
                    
                    // Filter to get stock-count transactions with discrepancies
                    stockCounts = activities.filter(a => a.type === 'stock-count' && a.expected !== a.actual);
                    console.log(`Found ${stockCounts.length} stock count records with discrepancies`);
                    
                    // Get resolution records
                    resolutions = activities.filter(a => a.type === 'resolution');
                    console.log(`Found ${resolutions.length} resolution records:`, resolutions);
                } catch (e) {
                    console.error('Error parsing activities for stock counts:', e);
                }
            }
            
            // Combine stock discrepancies with stock counts
            let combinedTransactions = [...discrepancies, ...stockCounts];
            console.log(`Combined ${combinedTransactions.length} total discrepancy records`);
            
            // Check if we should show sample data
            // Get the user preference for demo data from storage
            const showDemoDataStr = await mobileStorage.getItem('showDemoData');
            const showDemoData = showDemoDataStr ? JSON.parse(showDemoDataStr) : false;
            
            // If no transactions found and demo data is enabled, use sample data
            if (combinedTransactions.length === 0 && showDemoData) {
                console.log('No discrepancy data found, using sample data because demo mode is enabled');
                combinedTransactions = generateSampleDiscrepancyData();
            } else if (combinedTransactions.length === 0) {
                console.log('No discrepancy data found, returning empty array');
                // Just return empty data instead of sample data
                return {
                    inventory: [],
                    transactions: [],
                    dateRange: {
                        start: startDate,
                        end: endDate
                    },
                    isEmpty: true
                };
            }
            
            // Create a map of resolution records by category and timestamp
            const resolutionMap = new Map();
            resolutions.forEach(resolution => {
                if (resolution.category) {
                    // Use category and approximate timestamp (within the same day) as key
                    // This helps match resolutions to their specific stock counts
                    const dateKey = resolution.date ? new Date(resolution.date).toISOString().split('T')[0] : '';
                    const key = `${resolution.category}|${dateKey}`;
                    resolutionMap.set(key, resolution);
                }
            });
            
            // Remove duplicates by comparing date, category, expected and actual values
            const uniqueMap = new Map();
            combinedTransactions = combinedTransactions.filter(tx => {
                if (!tx) return false;
                
                // Create a unique key for each transaction to identify duplicates
                // Use a more comprehensive key to better identify duplicates
                const date = tx.timestamp || tx.date || '';
                const formattedDate = date ? new Date(date).toISOString().split('T')[0] : '';
                const category = tx.category || '';
                const expected = tx.expected || 0;
                const actual = tx.actual || 0;
                const counterId = tx.counterId || '';
                
                // Improved key that considers the counter
                const key = `${formattedDate}|${category}|${expected}|${actual}`;
                
                // If we haven't seen this key before, keep it
                if (!uniqueMap.has(key)) {
                    uniqueMap.set(key, tx);
                    return true;
                }
                
                // If this transaction has more information than the stored one, update the stored one
                const existingTx = uniqueMap.get(key);
                if ((tx.counterName && !existingTx.counterName) || 
                    (tx.notes && !existingTx.notes) || 
                    (tx.resolution && !existingTx.resolution)) {
                    // Keep the most complete record by merging them
                    const mergedTx = {
                        ...existingTx,
                        ...tx,
                        counterName: tx.counterName || existingTx.counterName,
                        notes: tx.notes || existingTx.notes,
                        resolution: tx.resolution || existingTx.resolution
                    };
                    uniqueMap.set(key, mergedTx);
                }
                
                // We've already processed this record in some way, so filter it out
                return false;
            });
            
            // Convert the map values back to an array
            combinedTransactions = Array.from(uniqueMap.values());
            
            console.log(`After removing duplicates: ${combinedTransactions.length} unique records`);
            
            // Add resolution data to transactions
            combinedTransactions = combinedTransactions.map(tx => {
                const category = tx.category;
                if (category) {
                    const dateKey = tx.date ? new Date(tx.date).toISOString().split('T')[0] : 
                                   (tx.timestamp ? new Date(tx.timestamp).toISOString().split('T')[0] : '');
                    const key = `${category}|${dateKey}`;
                    
                    if (resolutionMap.has(key)) {
                        const resolution = resolutionMap.get(key);
                        console.log(`Found resolution for ${category}:`, resolution);
                        
                        return {
                            ...tx,
                            resolved: true,
                            resolution: resolution.description || "Issue resolved",
                            resolutionTimestamp: resolution.timestamp,
                            resolutionDate: resolution.date,
                            finalCount: resolution.finalCount
                        };
                    }
                }
                return tx;
            });
            
            // Filter by date range
            if (startDate || endDate) {
                const startDateObj = startDate ? new Date(startDate) : null;
                const endDateObj = endDate ? new Date(endDate) : null;
                
                // Set time for endDate to end of day for proper comparison
                if (endDateObj) {
                    endDateObj.setHours(23, 59, 59, 999);
                }
                
                combinedTransactions = combinedTransactions.filter(tx => {
                    if (!tx.date && !tx.timestamp) return false;
                    
                    const txDate = new Date(tx.timestamp || tx.date);
                    if (startDateObj && txDate < startDateObj) return false;
                    if (endDateObj && txDate > endDateObj) return false;
                    
                    return true;
                });
                console.log(`After date filtering: ${combinedTransactions.length} records`);
            }
            
            // Filter by category
            if (category && category !== 'all') {
                combinedTransactions = combinedTransactions.filter(tx => tx.category === category);
                console.log(`After category filtering: ${combinedTransactions.length} records`);
            }
            
            // Use the base animal data loading function for inventory
            const animalData = await loadAnimalData(category, startDate, endDate);
            
            return {
                inventory: animalData.inventory,
                transactions: combinedTransactions,
                dateRange: {
                    start: startDate,
                    end: endDate
                }
            };
        } catch (error) {
            console.error('Error loading animal discrepancy data:', error);
            return {
                inventory: [],
                transactions: [],
                dateRange: {
                    start: startDate,
                    end: endDate
                }
            };
        }
    }

    /**
     * Creates the health report table based on the type of health data
     * @param {Object} data - Health data object containing treatments, vaccinations, medications etc.
     * @param {string} reportSubtype - Specific type of health report ('all', 'treatment', 'vaccination', 'medication')
     * @returns {string} HTML for the health report
     */
    function createHealthReportTable(data, reportSubtype = 'all') {
        console.log('Creating health report table with data:', data);
        
        // Initialize arrays for different record types
        let treatmentRecords = [];
        let vaccinationRecords = [];
        let medicationRecords = [];
        let healthRecords = [];
        
        // First attempt - process the consolidated array directly if available
        if (data.records && Array.isArray(data.records)) {
            const allRecords = data.records;
            treatmentRecords = allRecords.filter(r => r.type === 'treatment');
            vaccinationRecords = allRecords.filter(r => r.type === 'vaccination');
            medicationRecords = allRecords.filter(r => r.type === 'medication');
            healthRecords = allRecords.filter(r => r.type === 'health-record');
        }
        // Otherwise, process from the specialized data objects
        else {
            // Process treatmentData
            if (data.treatmentData) {
                let records = [];
                if (Array.isArray(data.treatmentData.treatments)) {
                    records = records.concat(data.treatmentData.treatments);
                }
                if (Array.isArray(data.treatmentData.records)) {
                    records = records.concat(data.treatmentData.records);
                }
                // Filter records by type
                treatmentRecords = records.filter(r => r.type === 'treatment');
                // General health records might be in treatmentData
                healthRecords = records.filter(r => r.type === 'health-record');
            }
            
            // Process vaccinationData
            if (data.vaccinationData) {
                let records = [];
                if (Array.isArray(data.vaccinationData.vaccinations)) {
                    records = records.concat(data.vaccinationData.vaccinations);
                }
                if (Array.isArray(data.vaccinationData.records)) {
                    records = records.concat(data.vaccinationData.records);
                }
                vaccinationRecords = records.filter(r => r.type === 'vaccination');
            }
            
            // Process medicationData
            if (data.medicationData) {
                let records = [];
                if (Array.isArray(data.medicationData.medications)) {
                    records = records.concat(data.medicationData.medications);
                }
                if (Array.isArray(data.medicationData.records)) {
                    records = records.concat(data.medicationData.records);
                }
                medicationRecords = records.filter(r => r.type === 'medication');
            }
        }
        
        // Debug output
        console.log(`Found health records: ${healthRecords.length} health, ${treatmentRecords.length} treatments, ${vaccinationRecords.length} vaccinations, ${medicationRecords.length} medications`);
        
        const dateRange = data.dateRange || { start: null, end: null };
        
        // Determine which records to include based on report subtype
        let recordsToProcess = [];
        // Fix: Check for 'all-health' as well as 'all'
        if (reportSubtype === 'all' || reportSubtype === 'all-health' || !reportSubtype) {
            recordsToProcess = [...healthRecords, ...treatmentRecords, ...vaccinationRecords, ...medicationRecords];
        } else if (reportSubtype === 'treatment') {
            recordsToProcess = treatmentRecords;
        } else if (reportSubtype === 'vaccination') {
            recordsToProcess = vaccinationRecords;
        } else if (reportSubtype === 'medication') {
            recordsToProcess = medicationRecords;
        }
        
        // If we still don't have records and we have raw data, try to extract by type
        if (recordsToProcess.length === 0 && data.treatments) {
            console.log('Attempting to process raw treatments data');
            recordsToProcess = data.treatments.filter(r => {
                if (reportSubtype === 'all' || reportSubtype === 'all-health') return true;
                if (!r.type) return false;
                if (reportSubtype === 'treatment') return r.type === 'treatment';
                if (reportSubtype === 'vaccination') return r.type === 'vaccination';
                if (reportSubtype === 'medication') return r.type === 'medication';
                return false;
            });
        }
        
        // If we STILL don't have records, try a more aggressive approach with all data
        if (recordsToProcess.length === 0) {
            console.log('Trying more aggressive data extraction for health records');
            
            // Try to collect all records from each data object directly
            let allPossibleRecords = [];
            
            // Add all records from the treatment data
            if (data.treatmentData) {
                if (data.treatmentData.records && Array.isArray(data.treatmentData.records)) {
                    allPossibleRecords = allPossibleRecords.concat(data.treatmentData.records);
                }
                if (data.treatmentData.treatments && Array.isArray(data.treatmentData.treatments)) {
                    allPossibleRecords = allPossibleRecords.concat(data.treatmentData.treatments);
                }
            }
            
            // Add all records from the vaccination data
            if (data.vaccinationData) {
                if (data.vaccinationData.records && Array.isArray(data.vaccinationData.records)) {
                    allPossibleRecords = allPossibleRecords.concat(data.vaccinationData.records);
                }
                if (data.vaccinationData.vaccinations && Array.isArray(data.vaccinationData.vaccinations)) {
                    allPossibleRecords = allPossibleRecords.concat(data.vaccinationData.vaccinations);
                }
            }
            
            // Add all records from the medication data
            if (data.medicationData) {
                if (data.medicationData.records && Array.isArray(data.medicationData.records)) {
                    allPossibleRecords = allPossibleRecords.concat(data.medicationData.records);
                }
                if (data.medicationData.medications && Array.isArray(data.medicationData.medications)) {
                    allPossibleRecords = allPossibleRecords.concat(data.medicationData.medications);
                }
            }
            
            console.log(`Found ${allPossibleRecords.length} total possible health records`);
            
            // Filter based on report type
            if (reportSubtype === 'all' || reportSubtype === 'all-health') {
                recordsToProcess = allPossibleRecords;
            } else if (reportSubtype === 'treatment') {
                recordsToProcess = allPossibleRecords.filter(r => r.type === 'treatment');
            } else if (reportSubtype === 'vaccination') {
                recordsToProcess = allPossibleRecords.filter(r => r.type === 'vaccination');
            } else if (reportSubtype === 'medication') {
                recordsToProcess = allPossibleRecords.filter(r => r.type === 'medication');
            }
        }
        
        console.log(`Processing ${recordsToProcess.length} health records for ${reportSubtype} report`);
        
        // Remove duplicates by timestamp
        const uniqueRecords = [];
        const seen = new Set();
        
        recordsToProcess.forEach(record => {
            // Create a unique key using timestamp and type
            const key = `${record.timestamp || record.date || ''}|${record.type}|${record.category || ''}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueRecords.push(record);
            }
        });
        
        console.log(`After removing duplicates: ${uniqueRecords.length} unique records`);
        recordsToProcess = uniqueRecords;
        
        // Sort all records by date
        recordsToProcess.sort((a, b) => {
            const dateA = new Date(a.date || a.dateAdded || a.timestamp || 0);
            const dateB = new Date(b.date || b.dateAdded || b.timestamp || 0);
            return dateB - dateA; // Sort by descending date (newest first)
        });
        
        // Create summary data
        const summaryData = {
            totalRecords: recordsToProcess.length,
            treatments: treatmentRecords.length,
            vaccinations: vaccinationRecords.length,
            medications: medicationRecords.length,
            healthRecords: healthRecords.length
        };
        
        // Group by category for category summary
        const categoryCounts = {};
        recordsToProcess.forEach(record => {
            const category = record.category || 'Unknown';
            if (!categoryCounts[category]) {
                categoryCounts[category] = 0;
            }
            categoryCounts[category]++;
        });
        summaryData.categories = categoryCounts;
        
        // Determine report title and subtitle based on subtype
        let reportTitle = 'Health Report';
        let reportSubtitle = 'Health Management Records';
        
        if (reportSubtype === 'treatment') {
            reportTitle = 'Treatment Report';
            reportSubtitle = 'Animal Treatment Records';
        } else if (reportSubtype === 'vaccination') {
            reportTitle = 'Vaccination Report';
            reportSubtitle = 'Animal Vaccination Records';
        } else if (reportSubtype === 'medication') {
            reportTitle = 'Medication Report';
            reportSubtitle = 'Animal Medication Records';
        } else if (reportSubtype === 'all' || reportSubtype === 'all-health') {
            reportTitle = 'Complete Health Report';
            reportSubtitle = 'All Health Management Records';
        }
        
        // Add report actions
        const reportActions = `
            <div class="report-actions">
                <button onclick="window.print()" class="print-button">Print Report</button>
                <button onclick="exportReportToCSV('health-${reportSubtype}')" class="export-button">Export to CSV</button>
            </div>
        `;
        
        // Generate report HTML
        let tableHTML = '';
        
        // Create type header
        tableHTML += `
            <div class="report-type-header">
                <div class="report-type-title">${reportTitle}</div>
                ${reportActions}
            </div>
        `;
        
        // Start table
        tableHTML += `<table class="report-table health-report-table" id="health-${reportSubtype}-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Animal Category</th>
                    <th>Quantity</th>
                    <th>Details</th>
                    <th>Duration/Period</th>
                    <th>Notes</th>
                </tr>
            </thead>
            <tbody>
`;
        
        // No records message
        if (recordsToProcess.length === 0) {
            tableHTML += `
                <tr>
                    <td colspan="7" class="no-data">No health records found for the selected criteria</td>
                </tr>
            `;
        } else {
            // Add rows for each record
            recordsToProcess.forEach(record => {
                const recordDate = new Date(record.date || record.dateAdded || record.timestamp || 0);
                const formattedDate = recordDate.toISOString() !== '1970-01-01T00:00:00.000Z' 
                    ? formatDate(recordDate)
                    : 'Unknown';
                
                let type = 'Unknown';
                let details = '';
                let durationPeriod = '';
                let notes = record.notes || '';
                let quantity = record.quantity || 1;
                
                if (record.type === 'health-record') {
                    type = 'Health Record';
                    details = `${record.condition || ''} - ${record.description || ''}`;
                    durationPeriod = record.severity || '-';
                } else if (record.type === 'treatment') {
                    type = 'Treatment';
                    details = `${record.treatment || ''} - ${record.condition || ''}`;
                    durationPeriod = record.duration ? `${record.duration} days` : '-';
                } else if (record.type === 'vaccination') {
                    type = 'Vaccination';
                    details = record.vaccine || '';
                    durationPeriod = record.nextDate ? `Next: ${formatDate(new Date(record.nextDate))}` : '-';
                } else if (record.type === 'medication') {
                    type = 'Medication';
                    details = `${record.medication || ''} ${record.dosage ? `(${record.dosage})` : ''}`;
                    durationPeriod = record.withdrawalPeriod ? `${record.withdrawalPeriod} days` : '-';
                }
                
                tableHTML += `
                    <tr>
                        <td>${formattedDate}</td>
                        <td>${type}</td>
                        <td>${record.category || 'All'}</td>
                        <td>${quantity}</td>
                        <td>${details}</td>
                        <td>${durationPeriod}</td>
                        <td>${notes}</td>
                    </tr>
                `;
            });
        }
        
        // End table
        tableHTML += `
            </tbody>
        </table>
`;
        
        // Create full report structure
        return createStandardReportStructure(
            reportTitle,
            reportSubtitle,
            dateRange,
            tableHTML,
            summaryData,
            false,
            `health-${reportSubtype}`
        );
    }
    
    /**
     * Create the animal movement report table with consistent styling
     * @param {Object} data - Animal movement data
     * @returns {string} HTML for the animal movement report
     */
    function createAnimalMovementTable(data) {
        console.log('Creating animal movement report with data:', data);
        
        // Extract data
        const transactions = Array.isArray(data) ? data : (data && data.transactions ? data.transactions : []);
        
        // Get date range
        let dateRangeText = '';
        if (data && data.dateRange) {
            dateRangeText = formatDateRange(data.dateRange.start, data.dateRange.end);
        }
        
        // Create summary data
        const summaryData = {
            'Total movements': transactions.length,
            'Animals affected': transactions.reduce((sum, t) => sum + (parseInt(t.quantity) || parseInt(t.count) || 0), 0)
        };
        
        // Add report actions (print and export buttons)
        const reportActionsHTML = `
            <div class="report-actions">
                <button onclick="window.print()" class="print-button">Print Report</button>
                <button onclick="exportReportToCSV('animal-movement')" class="export-button">Export to CSV</button>
            </div>
        `;
        
        // Create table HTML
        let tableHTML = `
            <div class="report-type-header">
                <div class="report-type-title">Animal Movement Report</div>
                ${reportActionsHTML}
            </div>
            <table class="report-table animal-report-table" id="animal-movement-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Movement Type</th>
                        <th>Source Animal Type</th>
                        <th>Count</th>
                        <th>From Category</th>
                        <th>To Category</th>
                        <th>From Location</th>
                        <th>To Location</th>
                        <th>Notes</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        if (transactions.length === 0) {
            tableHTML += `
                <tr>
                    <td colspan="9" class="no-data">No animal movement data found</td>
                </tr>
            `;
        } else {
            // Sort transactions by date (newest first)
            const sortedTransactions = [...transactions].sort((a, b) => {
                return new Date(b.timestamp || b.date) - new Date(a.timestamp || a.date);
            });
            
            sortedTransactions.forEach(transaction => {
                // Flexible field mapping to handle different possible property names
                const date = transaction.timestamp || transaction.date;
                const count = transaction.quantity || transaction.count || 0;
                const notes = transaction.notes || '-';
                
                // Determine the movement type (category move, location move, or both)
                let movementType = 'Unknown';
                let animalType = 'Unknown';
                
                // Set animal type properly using fromCategory when available
                if (transaction.fromCategory) {
                    animalType = transaction.fromCategory; // Always use source category for the main animal type
                } else {
                    animalType = transaction.category || transaction.animalType || 'Unknown';
                }
                
                let fromCategory = transaction.fromCategory || '-';
                let toCategory = transaction.toCategory || '-';
                let fromLocation = transaction.fromLocation || transaction.location || '-';
                let toLocation = transaction.toLocation || transaction.location || '-';
                
                if (transaction.fromCategory && transaction.toCategory) {
                    // This is a category move
                    movementType = 'Category';
                } 
                    
                    if (transaction.fromLocation && transaction.toLocation) {
                    // This is a location move
                    movementType = movementType === 'Category' ? 'Category & Location' : 'Location';
                } else if (transaction.type === 'move') {
                    // Generic move without specifics
                    movementType = 'Move';
                    
                    // Try to extract more information
                    if (transaction.fromField || transaction.from) {
                        fromCategory = transaction.fromField || transaction.from;
                    }
                    if (transaction.toField || transaction.to) {
                        toCategory = transaction.toField || transaction.to;
                    }
                }
                
                tableHTML += `
                    <tr>
                        <td>${formatDate(date)}</td>
                        <td>${movementType}</td>
                        <td>${animalType}</td>
                        <td>${count}</td>
                        <td>${fromCategory}</td>
                        <td>${toCategory}</td>
                        <td>${fromLocation}</td>
                        <td>${toLocation}</td>
                        <td>${notes}</td>
                    </tr>
                `;
            });
        }
        
        tableHTML += `
                </tbody>
            </table>
        `;
        
        // Create standardized report
        return createStandardReportStructure(
            'Animal Movement Report',
            'Record of Animal Movements',
            dateRangeText,
            tableHTML,
            summaryData,
            false,
            'animal-movement'
        );
    }
    
    /**
     * Create the animal purchase report table
     * @param {Object} data - Animal purchase data
     * @returns {string} HTML for the animal purchase report
     */
    function createAnimalPurchaseTable(data) {
        // Extract data
        const { inventory, transactions } = data;
        
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
            <table class="report-table animal-report-table">
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
        
        if (transactions.length === 0) {
            tableHTML += `
                <tr>
                    <td colspan="7" class="no-data">No animal purchase data found</td>
                </tr>
            `;
        } else {
            // Sort by date (newest first)
            const sortedTransactions = [...transactions].sort((a, b) => {
                return new Date(b.timestamp || b.date) - new Date(a.timestamp || a.date);
            });
            
            sortedTransactions.forEach(tx => {
                const date = formatDate(tx.timestamp || tx.date);
                const animalType = tx.category || tx.animalType || 'Unknown';
                const quantity = tx.quantity || tx.count || 0;
                const location = tx.location || '-';
                const supplier = tx.supplier || tx.source || '-';
                const cost = formatCurrency(tx.cost || tx.amount || tx.price || 0);
                const notes = tx.notes || '-';
                
                tableHTML += `
                    <tr>
                        <td>${date}</td>
                        <td>${animalType}</td>
                        <td>${quantity}</td>
                        <td>${location}</td>
                        <td>${supplier}</td>
                        <td class="cost">${cost}</td>
                        <td>${notes}</td>
                    </tr>
                `;
            });
            
            // Add total row
            tableHTML += `
                <tr class="summary-row">
                    <td colspan="2"><strong>Total</strong></td>
                    <td><strong>${totalAnimals}</strong></td>
                    <td colspan="2"></td>
                    <td class="cost"><strong>${formatCurrency(totalCost)}</strong></td>
                    <td></td>
                </tr>
            `;
        }
        
        tableHTML += `
                </tbody>
            </table>
        `;
        
        // Return standardized report
        return createStandardReportStructure(
            'Animal Purchase Report',
            'Record of Animal Purchases',
            data.dateRange ? formatDateRange(data.dateRange.start, data.dateRange.end) : '',
            tableHTML,
            summaryData,
            false,
            'animal-purchase'
        );
    }
    
    /**
     * Create the animal sale report table
     * @param {Object} data - Animal sale data
     * @returns {string} HTML for the animal sale report
     */
    function createAnimalSaleTable(data) {
        // Extract data
        const { inventory, transactions } = data;
        
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
            <table class="report-table animal-report-table">
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
        
        if (transactions.length === 0) {
            tableHTML += `
                <tr>
                    <td colspan="7" class="no-data">No animal sale data found</td>
                </tr>
            `;
        } else {
            // Sort by date (newest first)
            const sortedTransactions = [...transactions].sort((a, b) => {
                return new Date(b.timestamp || b.date) - new Date(a.timestamp || a.date);
            });
            
            sortedTransactions.forEach(tx => {
                const date = formatDate(tx.timestamp || tx.date);
                const animalType = tx.category || tx.animalType || 'Unknown';
                const quantity = tx.quantity || tx.count || 0;
                const location = tx.location || '-';
                const buyer = tx.buyer || tx.destination || '-';
                const revenue = formatCurrency(tx.revenue || tx.amount || tx.price || 0);
                const notes = tx.notes || '-';
                
                tableHTML += `
                    <tr>
                        <td>${date}</td>
                        <td>${animalType}</td>
                        <td>${quantity}</td>
                        <td>${location}</td>
                        <td>${buyer}</td>
                        <td class="revenue">${revenue}</td>
                        <td>${notes}</td>
                    </tr>
                `;
            });
            
            // Add total row
            tableHTML += `
                <tr class="summary-row">
                    <td colspan="2"><strong>Total</strong></td>
                    <td><strong>${totalAnimals}</strong></td>
                    <td colspan="2"></td>
                    <td class="revenue"><strong>${formatCurrency(totalRevenue)}</strong></td>
                    <td></td>
                </tr>
            `;
        }
        
        tableHTML += `
                </tbody>
            </table>
        `;
        
        // Return standardized report
        return createStandardReportStructure(
            'Animal Sale Report',
            'Record of Animal Sales',
            data.dateRange ? formatDateRange(data.dateRange.start, data.dateRange.end) : '',
            tableHTML,
            summaryData,
            false,
            'animal-sale'
        );
    }

    /**
     * Create the animal birth report table
     * @param {Object} data - Animal birth data
     * @returns {string} HTML for the animal birth report
     */
    function createAnimalBirthTable(data) {
        // Extract data
        const { inventory, transactions } = data;
        
        // Calculate totals
        const totalBirths = transactions.reduce((sum, t) => sum + (parseInt(t.count) || parseInt(t.quantity) || 0), 0);
        
        // Create summary data
        const summaryData = {
            'Total birth records': transactions.length,
            'Total animals born': totalBirths
        };
        
        // Create table HTML
        let tableHTML = `
            <table class="report-table animal-report-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Animal Type</th>
                        <th>Count</th>
                        <th>Location</th>
                        <th>Mother ID</th>
                        <th>Batch ID</th>
                        <th>Notes</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        if (transactions.length === 0) {
            tableHTML += `
                <tr>
                    <td colspan="7" class="no-data">No animal birth data found</td>
                </tr>
            `;
        } else {
            // Sort transactions by date (newest first)
            const sortedTransactions = [...transactions].sort((a, b) => {
                return new Date(b.timestamp || b.date) - new Date(a.timestamp || a.date);
            });
            
            sortedTransactions.forEach(tx => {
                const date = formatDate(tx.timestamp || tx.date);
                const animalType = tx.category || tx.animalType || 'Unknown';
                const count = tx.quantity || tx.count || 0;
                const location = tx.location || '-';
                const motherId = tx.motherId || tx.mother || '-';
                const batchId = tx.batchId || tx.batch || '-';
                const notes = tx.notes || '-';
                
                tableHTML += `
                    <tr>
                        <td>${date}</td>
                        <td>${animalType}</td>
                        <td>${count}</td>
                        <td>${location}</td>
                        <td>${motherId}</td>
                        <td>${batchId}</td>
                        <td>${notes}</td>
                    </tr>
                `;
            });
            
            // Add total row
            tableHTML += `
                <tr class="summary-row">
                    <td colspan="2"><strong>Total</strong></td>
                    <td><strong>${totalBirths}</strong></td>
                    <td colspan="4"></td>
                </tr>
            `;
        }
        
        tableHTML += `
            </tbody>
        </table>
    `;
    
    // Create standardized report
    return createStandardReportStructure(
        'Animal Birth Report',
        'Record of Animal Births',
        data.dateRange ? formatDateRange(data.dateRange.start, data.dateRange.end) : '',
        tableHTML,
        summaryData,
        false,
        'animal-birth'
    );
}

/**
 * Create the animal death report table
 * @param {Object} data - Animal death data
 * @returns {string} HTML for the animal death report
 */
function createAnimalDeathTable(data) {
    // Extract data
    const { inventory, transactions } = data;
    
    // Calculate totals
    const totalDeaths = transactions.reduce((sum, t) => sum + (parseInt(t.count) || parseInt(t.quantity) || 0), 0);
    
    // Create summary data
    const summaryData = {
        'Total death records': transactions.length,
        'Total animal deaths': totalDeaths
    };
    
    // Create table HTML
    let tableHTML = `
        <table class="report-table animal-report-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Animal Type</th>
                    <th>Count</th>
                    <th>Location</th>
                    <th>Cause</th>
                    <th>Notes</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    if (transactions.length === 0) {
        tableHTML += `
            <tr>
                <td colspan="6" class="no-data">No animal death data found</td>
            </tr>
        `;
    } else {
        // Sort transactions by date (newest first)
        const sortedTransactions = [...transactions].sort((a, b) => {
            return new Date(b.timestamp || b.date) - new Date(a.timestamp || a.date);
        });
        
        sortedTransactions.forEach(tx => {
            const date = formatDate(tx.timestamp || tx.date);
            const animalType = tx.category || tx.animalType || 'Unknown';
            const count = tx.quantity || tx.count || 0;
            const location = tx.location || '-';
            const cause = tx.cause || '-';
            const notes = tx.notes || '-';
            
            tableHTML += `
                <tr>
                    <td>${date}</td>
                    <td>${animalType}</td>
                    <td>${count}</td>
                    <td>${location}</td>
                    <td>${cause}</td>
                    <td>${notes}</td>
                </tr>
            `;
        });
        
        // Add total row
        tableHTML += `
            <tr class="summary-row">
                <td colspan="2"><strong>Total</strong></td>
                <td><strong>${totalDeaths}</strong></td>
                <td colspan="3"></td>
            </tr>
        `;
    }
    
    tableHTML += `
            </tbody>
        </table>
    `;
    
    // Create standardized report
    return createStandardReportStructure(
        'Animal Death Report',
        'Record of Animal Deaths',
        data.dateRange ? formatDateRange(data.dateRange.start, data.dateRange.end) : '',
        tableHTML,
        summaryData,
        false,
        'animal-death'
    );
}

/**
 * Create the animal count report table
 * @param {Object} data - Animal count data
 * @returns {string} HTML for the animal count report
 */
function createAnimalCountTable(data) {
    // Extract data
    const { inventory, transactions } = data;
    
    // Calculate totals and stats
    const totalCounts = transactions.length;
    const totalAnimals = transactions.reduce((sum, t) => sum + (parseInt(t.actual) || 0), 0);
    const expectedAnimals = transactions.reduce((sum, t) => sum + (parseInt(t.expected) || 0), 0);
    const difference = totalAnimals - expectedAnimals;
    
    // Create summary data
    const summaryData = {
        'Total count records': totalCounts,
        'Total animals counted': totalAnimals,
        'Expected animals': expectedAnimals,
        'Difference': difference
    };
    
    // Create table HTML
    let tableHTML = `
        <table class="report-table animal-report-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Animal Type</th>
                    <th>Location</th>
                    <th>Expected</th>
                    <th>Actual</th>
                    <th>Difference</th>
                    <th>Counter</th>
                    <th>Notes</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    if (transactions.length === 0) {
        tableHTML += `
            <tr>
                <td colspan="8" class="no-data">No animal count data found</td>
            </tr>
        `;
    } else {
        // Sort transactions by date (newest first)
        const sortedTransactions = [...transactions].sort((a, b) => {
            return new Date(b.timestamp || b.date) - new Date(a.timestamp || a.date);
        });
        
        sortedTransactions.forEach(tx => {
            const date = formatDate(tx.timestamp || tx.date);
            const animalType = tx.category || tx.animalType || 'Unknown';
            const location = tx.location || '-';
            const expected = tx.expected || 0;
            const actual = tx.actual || 0;
            const diff = actual - expected;
            const diffClass = diff === 0 ? 'neutral' : (diff > 0 ? 'positive' : 'negative');
            const counter = tx.counter || tx.countedBy || '-';
            const notes = tx.notes || '-';
            
            tableHTML += `
                <tr>
                    <td>${date}</td>
                    <td>${animalType}</td>
                    <td>${location}</td>
                    <td>${expected}</td>
                    <td>${actual}</td>
                    <td class="${diffClass}">${diff > 0 ? '+' + diff : diff}</td>
                    <td>${counter}</td>
                    <td>${notes}</td>
                </tr>
            `;
        });
        
        // Add total row
        tableHTML += `
            <tr class="summary-row">
                <td colspan="2"><strong>Total</strong></td>
                <td></td>
                <td><strong>${expectedAnimals}</strong></td>
                <td><strong>${totalAnimals}</strong></td>
                <td class="${difference === 0 ? 'neutral' : (difference > 0 ? 'positive' : 'negative')}">
                    <strong>${difference > 0 ? '+' + difference : difference}</strong>
                </td>
                <td colspan="2"></td>
            </tr>
        `;
    }
    
    tableHTML += `
            </tbody>
        </table>
    `;
    
    // Return standardized report
    return createStandardReportStructure(
        'Animal Count Report',
        'Record of Animal Counts',
        data.dateRange ? formatDateRange(data.dateRange.start, data.dateRange.end) : '',
        tableHTML,
        summaryData,
        false,
        'animal-count'
    );
}

/**
 * Create the animal discrepancy report table
 * @param {Object} data - Animal discrepancy data
 * @returns {string} HTML for the animal discrepancy report
 */
function createAnimalDiscrepancyTable(data) {
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
            null, // No summary data
            false, // Not demo data
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
    
    // Create a map to store resolution entries
    const resolutionEntries = [];
    
    // Create table
    var tableHTML = "<table class='report-table animal-discrepancy-table'>";
    tableHTML += "<thead><tr>";
    tableHTML += "<th>Date</th>";
    tableHTML += "<th>Category</th>";
    tableHTML += "<th>Expected</th>";
    tableHTML += "<th>Actual</th>";
    tableHTML += "<th>Difference</th>";
    tableHTML += "<th>Counter</th>";
    tableHTML += "<th>Status</th>";
    tableHTML += "<th>Notes</th>";
    tableHTML += "</tr></thead>";
    tableHTML += "<tbody>";

    if (transactions && transactions.length > 0) {
        var resolved = 0;
        var unresolved = 0;
        var totalDifference = 0;

        for (var i = 0; i < transactions.length; i++) {
            var record = transactions[i];
            var date = record.date ? new Date(record.date) : (record.timestamp ? new Date(record.timestamp) : new Date());
            var formattedDate = formatDate(date);
            var difference = (record.actual - record.expected) || 0;
            totalDifference += difference;

            // Check if resolution exists
            let resolutionText = '';
            let status = 'Unresolved';
            
            if (record.resolution || (record.notes && record.notes.includes('Resolution:'))) {
                status = 'Resolved';
                resolved++;
                
                // Create a separate resolution entry
                if (record.finalCount !== undefined) {
                    // Create a resolution entry that will be added after all discrepancies
                    const resolutionDate = record.resolutionDate || record.date || record.timestamp;
                    const resolutionTimestamp = record.resolutionTimestamp || record.timestamp;
                    
                    resolutionEntries.push({
                        date: resolutionDate,
                        timestamp: resolutionTimestamp,
                        category: record.category,
                        expected: record.actual, // The expected count for the resolution is the actual count from discrepancy
                        actual: record.finalCount,
                        difference: record.finalCount - record.actual,
                        counterName: record.counterName,
                        resolution: record.resolution || "Issue resolved",
                        isResolution: true
                    });
                }
            } else {
                unresolved++;
            }
            
            // Notes field for discrepancy record
            const notes = record.notes || '';

            var counterName = record.counterName || '-';
            
            tableHTML += "<tr>";
            tableHTML += "<td>" + formattedDate + "</td>";
            tableHTML += "<td>" + (record.category || '') + "</td>";
            tableHTML += "<td>" + (record.expected || 0) + "</td>";
            tableHTML += "<td>" + (record.actual || 0) + "</td>";
            tableHTML += "<td class='" + (difference < 0 ? 'negative' : (difference > 0 ? 'positive' : '')) + "'>" + (difference > 0 ? '+' + difference : difference) + "</td>";
            tableHTML += "<td>" + counterName + "</td>";
            tableHTML += "<td class='" + status.toLowerCase() + "'>" + status + "</td>";
            tableHTML += "<td>" + notes + "</td>";
            tableHTML += "</tr>";
        }
        
        // Add resolution entries
        if (resolutionEntries.length > 0) {
            // Sort resolution entries by date
            resolutionEntries.sort((a, b) => {
                const dateA = new Date(a.date || a.timestamp);
                const dateB = new Date(b.date || b.timestamp);
                return dateA - dateB;
            });
            
            // Add all resolution entries
            for (const resolution of resolutionEntries) {
                const resDate = resolution.date ? new Date(resolution.date) : (resolution.timestamp ? new Date(resolution.timestamp) : new Date());
                const resFormattedDate = formatDate(resDate);
                const resDifference = resolution.difference || 0;
                
                tableHTML += "<tr class='resolution-row'>";
                tableHTML += "<td>" + resFormattedDate + "</td>";
                tableHTML += "<td>" + (resolution.category || '') + "</td>";
                tableHTML += "<td>" + (resolution.expected || 0) + "</td>";
                tableHTML += "<td>" + (resolution.actual || 0) + "</td>";
                tableHTML += "<td class='" + (resDifference < 0 ? 'negative' : (resDifference > 0 ? 'positive' : '')) + "'>" + (resDifference > 0 ? '+' + resDifference : resDifference) + "</td>";
                tableHTML += "<td>" + (resolution.counterName || '-') + "</td>";
                tableHTML += "<td class='resolved'>Resolution</td>";
                tableHTML += "<td>" + resolution.resolution + "</td>";
                tableHTML += "</tr>";
            }
        }

        // Add summary row
        tableHTML += "<tr class='summary-row'>";
        tableHTML += "<td colspan='4'><strong>Summary</strong></td>";
        tableHTML += "<td class='" + (totalDifference < 0 ? 'negative' : (totalDifference > 0 ? 'positive' : '')) + "'>" + (totalDifference > 0 ? '+' + totalDifference : totalDifference) + "</td>";
        tableHTML += "<td colspan='3'>Resolved: " + resolved + ", Unresolved: " + unresolved + "</td>";
        tableHTML += "</tr>";
    } else {
        tableHTML += "<tr><td colspan='8' class='text-center'>No discrepancies found</td></tr>";
    }

    tableHTML += "</tbody></table>";
    
    // Wrap in standard report structure
    return createStandardReportStructure(
        'Animal Discrepancy Report',
        'Record of Inventory Adjustments',
        dateRangeText,
        tableHTML,
        null, // No summary data
        false, // Not demo data
        'animal-discrepancy'
    );
}

/**
 * Creates a standard report HTML structure used by all report types
 * @param {string} reportTitle - Title of the report
 * @param {string} reportSubtitle - Optional subtitle or description
 * @param {string|Object} dateRange - Formatted date range string or object with start/end properties
 * @param {string} tableHTML - The HTML content for the report table
 * @param {Object} summaryData - Summary statistics to display
 * @param {boolean} isDemoData - Whether this is demo data
 * @param {string} reportType - Type of report for export purposes
 * @returns {string} Complete standardized report HTML
 */
function createStandardReportStructure(reportTitle, reportSubtitle, dateRange, tableHTML, summaryData, isDemoData = false, reportType = 'report') {
    // Format the date range for display
    let formattedDateRange = '';
    
    if (typeof dateRange === 'string') {
        // If it's already a string, use it directly
        formattedDateRange = dateRange;
    } else if (dateRange && typeof dateRange === 'object') {
        // If it's an object with start and end properties, format it
        if (dateRange.start && dateRange.end) {
            formattedDateRange = formatDateRange(dateRange.start, dateRange.end);
        } else if (dateRange.start) {
            formattedDateRange = `From ${formatDate(dateRange.start)}`;
        } else if (dateRange.end) {
            formattedDateRange = `Until ${formatDate(dateRange.end)}`;
        }
    }
    
    // Build the HTML structure for the report
    let reportHTML = `
        <div class="report-container ${reportType}">
            <div class="report-header">
                <h2 class="report-title">${reportTitle}</h2>
                <div class="report-meta">
                    <p class="report-date-range">Report period: ${formattedDateRange}</p>
                    ${reportSubtitle ? `<p class="report-subtitle">${reportSubtitle}</p>` : ''}
                    ${isDemoData ? '<p class="demo-data-notice">* Using demo data for illustration</p>' : ''}
                </div>
                <div class="report-actions">
                    <button onclick="window.print()" class="print-button">Print Report</button>
                    <button onclick="exportReportToCSV('${reportType}')" class="export-button">Export to CSV</button>
                </div>
            </div>
            <div class="report-body">
                ${tableHTML}
            </div>
            <div class="report-footer">
                <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
            </div>
        </div>
    `;
    
    return reportHTML;
}

/**
 * Format date for display in reports
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date string
 */
function formatDate(date) {
    if (!date) return 'N/A';
    
    try {
        const dateObj = new Date(date);
        
        // Check if date is valid
        if (isNaN(dateObj.getTime())) {
            return 'Invalid date';
        }
        
        // Format date as YYYY-MM-DD
        return dateObj.toISOString().split('T')[0];
    } catch (e) {
        console.error('Error formatting date:', e);
        return 'Error';
    }
}

/**
 * Format date range for display in reports
 * @param {string|Date} startDate - Start date
 * @param {string|Date} endDate - End date
 * @returns {string} Formatted date range
 */
function formatDateRange(startDate, endDate) {
    return `${formatDate(startDate)} to ${formatDate(endDate)}`;
}

/**
 * Helper function to capitalize the first letter of a string
 * @param {string} string - Input string
 * @returns {string} String with first letter capitalized
 */
function capitalizeFirstLetter(string) {
    if (!string) return '';
    return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * Global function to export reports to CSV
 * This can be called from the UI for any report type
 */
window.exportReportToCSV = function(reportType) {
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
        let csvContent = '';
        rows.forEach(row => {
            // Quote cells that contain commas
            const quotedRow = row.map(cell => {
                if (cell.includes(',')) {
                    return `"${cell}"`;
                }
                return cell;
            });
            csvContent += quotedRow.join(',') + '\n';
        });
        
        // Create filename based on report type and date
        const today = new Date();
        const formattedDate = today.toISOString().split('T')[0];
        const filename = `${reportType}-report-${formattedDate}.csv`;
        
        // Download the CSV file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        
        // Browser compatibility for downloads
        if (navigator.msSaveBlob) {
            // IE 10+
            navigator.msSaveBlob(blob, filename);
        } else {
            // Other browsers
            const link = document.createElement('a');
            if (link.download !== undefined) {
                // Feature detection
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute('download', filename);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                // Fallback - open in new window
                window.open('data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent));
            }
        }
        
        console.log(`Exported ${reportType} report to CSV`);
    } catch (error) {
        console.error('Error exporting report to CSV:', error);
        alert('Error exporting report: ' + error.message);
    }
};

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

// Export all functions created inside the DOMContentLoaded event to make them globally accessible
document.addEventListener('DOMContentLoaded', function() {
    console.log('Making all report functions globally accessible');
    
    // Check if animal report functions are defined
    console.log('Animal report functions check:');
    console.log('- createAllAnimalReportTable:', typeof createAllAnimalReportTable === 'function');
    console.log('- createAnimalInventoryTable:', typeof createAnimalInventoryTable === 'function');
    console.log('- createAnimalMovementTable:', typeof createAnimalMovementTable === 'function');
    console.log('- createAnimalPurchaseTable:', typeof createAnimalPurchaseTable === 'function');
    console.log('- createAnimalSaleTable:', typeof createAnimalSaleTable === 'function');
    console.log('- createAnimalBirthTable:', typeof createAnimalBirthTable === 'function');
    console.log('- createAnimalDeathTable:', typeof createAnimalDeathTable === 'function');
    console.log('- createAnimalCountTable:', typeof createAnimalCountTable === 'function');
    console.log('- createAnimalDiscrepancyTable:', typeof createAnimalDiscrepancyTable === 'function');
    
    // Make all animal report functions globally accessible
    if (typeof createAnimalMovementTable === 'function') window.createAnimalMovementTable = createAnimalMovementTable;
    if (typeof createAnimalPurchaseTable === 'function') window.createAnimalPurchaseTable = createAnimalPurchaseTable;
    if (typeof createAnimalSaleTable === 'function') window.createAnimalSaleTable = createAnimalSaleTable;
    if (typeof createAnimalBirthTable === 'function') window.createAnimalBirthTable = createAnimalBirthTable;
    if (typeof createAnimalDeathTable === 'function') window.createAnimalDeathTable = createAnimalDeathTable;
    if (typeof createAnimalCountTable === 'function') window.createAnimalCountTable = createAnimalCountTable;
    if (typeof createAnimalDiscrepancyTable === 'function') window.createAnimalDiscrepancyTable = createAnimalDiscrepancyTable;
    
    // Make all feed report functions globally accessible
    if (typeof createAllFeedReportTable === 'function') window.createAllFeedReportTable = createAllFeedReportTable;
    if (typeof createFeedPurchaseTable === 'function') window.createFeedPurchaseTable = createFeedPurchaseTable;
    if (typeof createFeedUsageTable === 'function') window.createFeedUsageTable = createFeedUsageTable;
    if (typeof createFeedInventoryTable === 'function') window.createFeedInventoryTable = createFeedInventoryTable;
    if (typeof createFeedCalculationTable === 'function') window.createFeedCalculationTable = createFeedCalculationTable;
    
    // Make all data loading functions globally accessible
    if (typeof loadAnimalData === 'function') window.loadAnimalData = loadAnimalData;
    if (typeof loadAnimalInventoryData === 'function') window.loadAnimalInventoryData = loadAnimalInventoryData;
    if (typeof loadAnimalMovementData === 'function') window.loadAnimalMovementData = loadAnimalMovementData;
    if (typeof loadAnimalPurchaseData === 'function') window.loadAnimalPurchaseData = loadAnimalPurchaseData;
    if (typeof loadAnimalSaleData === 'function') window.loadAnimalSaleData = loadAnimalSaleData;
    if (typeof loadAnimalBirthData === 'function') window.loadAnimalBirthData = loadAnimalBirthData;
    if (typeof loadAnimalDeathData === 'function') window.loadAnimalDeathData = loadAnimalDeathData;
    if (typeof loadAnimalCountData === 'function') window.loadAnimalCountData = loadAnimalCountData;
    if (typeof loadAnimalDiscrepancyData === 'function') window.loadAnimalDiscrepancyData = loadAnimalDiscrepancyData;
    
    // Make health report functions globally accessible
    if (typeof loadHealthTreatmentData === 'function') window.loadHealthTreatmentData = loadHealthTreatmentData;
    if (typeof loadVaccinationData === 'function') window.loadVaccinationData = loadVaccinationData;
    if (typeof loadHealthMedicationData === 'function') window.loadHealthMedicationData = loadHealthMedicationData;
});

// Close the DOMContentLoaded event handler
});

/**
 * Create Feed Purchase Table
 * @param {Array} data - Feed purchase transaction data
 * @returns {string} HTML for the report
 */
function createFeedPurchaseTable(data) {
    if (!data || data.length === 0) {
        return `<div class="report-empty">No feed purchase data found for the selected period</div>`;
    }

    // Calculate totals for summary
    let totalQuantity = 0;
    let totalCost = 0;
    let avgPrice = 0;
    const supplierStats = {};
    const feedTypeStats = {};
    
    // Sort data by date (newest first)
    data.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Process data for summary stats
    data.forEach(item => {
        // Extract values with fallbacks
        const quantity = parseFloat(item.quantity) || 0;
        const cost = parseFloat(item.totalPrice || item.cost || item.totalCost || 0);
        
        // Add to totals
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
    avgPrice = totalQuantity > 0 ? totalCost / totalQuantity : 0;
    
    // Create report HTML
    let reportHTML = `
        <div class="report-header">
            <div class="report-type-header">
                <div class="report-type-title">Feed Purchase Report</div>
                <div class="report-actions">
                    <button onclick="window.print()" class="print-button">Print Report</button>
                    <button onclick="exportReportToCSV('feed-purchase')" class="export-button">Export to CSV</button>
                </div>
            </div>
            <div class="report-summary">
                <p>Total purchases: ${data.length}</p>
                <p>Total quantity: ${totalQuantity.toFixed(2)} units</p>
                <p>Total cost: ${formatCurrency(totalCost)}</p>
                <p>Average price per unit: ${formatCurrency(avgPrice)}</p>
            </div>
        </div>
        
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
    
    data.forEach(item => {
        const date = formatDate(item.date);
        const feedType = item.feedType || 'Unknown';
        const quantity = parseFloat(item.quantity) || 0;
        const unit = item.unit || '';
        const totalCost = parseFloat(item.totalPrice || item.cost || item.totalCost || 0);
        const pricePerUnit = quantity > 0 ? totalCost / quantity : 0;
        const supplier = item.supplier || 'Unknown supplier';
        const notes = item.notes || '';
        
        reportHTML += `
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
    
    reportHTML += `
            </tbody>
        </table>
    </div>
    
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
    const sortedFeedTypes = Object.entries(feedTypeStats).sort((a, b) => b[1].totalCost - a[1].totalCost);
    
    sortedFeedTypes.forEach(([feedType, stats]) => {
        const avgPrice = stats.totalQuantity > 0 ? stats.totalCost / stats.totalQuantity : 0;
        
        reportHTML += `
            <tr>
                <td>${feedType}</td>
                <td>${stats.count}</td>
                <td>${stats.totalQuantity.toFixed(2)}</td>
                <td>${formatCurrency(stats.totalCost)}</td>
                <td>${formatCurrency(avgPrice)}</td>
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
 * Create Feed Usage Table
 * @param {Array} data - Feed usage transaction data
 * @returns {string} HTML for the report
 */
function createFeedUsageTable(data) {
    if (!data || data.length === 0) {
        return `<div class="report-empty">No feed usage data found for the selected period</div>`;
    }

    // Calculate totals for summary
    let totalQuantity = 0;
    let totalCost = 0;
    const animalGroupStats = {};
    const feedTypeStats = {};
    
    // Sort data by date (newest first)
    data.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Process data for summary stats
    data.forEach(item => {
        // Extract values with fallbacks
        const quantity = parseFloat(item.quantity) || 0;
        const cost = parseFloat(item.totalCost || item.estimatedCost || 0);
        
        // Add to totals
        totalQuantity += quantity;
        totalCost += cost;
        
        // Track by animal group/type
        const animalGroup = item.animalGroup || item.animalType || 'General use';
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
    
    // Create report HTML
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
                <p>Total quantity used: ${totalQuantity.toFixed(2)} units</p>
                <p>Total cost: ${formatCurrency(totalCost)}</p>
            </div>
        </div>
        
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
    
    data.forEach(item => {
        const date = formatDate(item.date);
        const feedType = item.feedType || 'Unknown';
        const quantity = parseFloat(item.quantity) || 0;
        const unit = item.unit || '';
        const usedFor = item.animalGroup || item.animalType || item.usedFor || 'General use';
        const cost = parseFloat(item.totalCost || item.estimatedCost || 0);
        const notes = item.notes || '';
        
        reportHTML += `
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
    
    reportHTML += `
            </tbody>
        </table>
    </div>
    
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
    const sortedFeedTypes = Object.entries(feedTypeStats).sort((a, b) => b[1].totalQuantity - a[1].totalQuantity);
    
    sortedFeedTypes.forEach(([feedType, stats]) => {
        const percentOfTotal = totalQuantity > 0 ? (stats.totalQuantity / totalQuantity * 100).toFixed(1) : 0;
        
        reportHTML += `
            <tr>
                <td>${feedType}</td>
                <td>${stats.count}</td>
                <td>${stats.totalQuantity.toFixed(2)}</td>
                <td>${formatCurrency(stats.totalCost)}</td>
                <td>${percentOfTotal}%</td>
            </tr>
        `;
    });
    
    reportHTML += `
            </tbody>
        </table>
    </div>
    
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
    const sortedAnimalGroups = Object.entries(animalGroupStats).sort((a, b) => b[1].totalCost - a[1].totalCost);
    
    sortedAnimalGroups.forEach(([animalGroup, stats]) => {
        const percentOfTotal = totalCost > 0 ? (stats.totalCost / totalCost * 100).toFixed(1) : 0;
        
        reportHTML += `
            <tr>
                <td>${animalGroup}</td>
                <td>${stats.count}</td>
                <td>${stats.totalQuantity.toFixed(2)}</td>
                <td>${formatCurrency(stats.totalCost)}</td>
                <td>${percentOfTotal}%</td>
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
 * Format notes for display, extracting resolution information if present
 * @param {string} notes - Notes text that may contain resolution information
 * @returns {string} Formatted notes with resolution highlighted
 */
function formatNotes(notes) {
    if (!notes) return '';
    
    // Check if notes contain resolution information
    if (notes.includes('Resolution:')) {
        const parts = notes.split('Resolution:');
        const regularNotes = parts[0].trim();
        const resolution = parts[1].trim();
        
        // If there are regular notes as well as resolution, format accordingly
        if (regularNotes) {
            return `${regularNotes}<br><span class="resolution-text">Resolution: ${resolution}</span>`;
        } else {
            // Only resolution information
            return `<span class="resolution-text">Resolution: ${resolution}</span>`;
        }
    }
    
    // Regular notes without resolution information
    return notes;
}

/**
 * Generate sample discrepancy data from the debug log
 * @returns {Array} Sample discrepancy records
 */
function generateSampleDiscrepancyData() {
    const today = new Date('2025-04-15');
    
    // Include both discrepancy and resolution information but don't combine them
    return [
        {
            date: new Date('2025-04-15T17:04:22.528Z').toISOString(),
            category: 'Cows',
            expected: 10,
            actual: 9,
            counterName: 'Scott',
            type: 'stock-count',
            resolved: true,
            resolution: 'Stock count discrepancy resolved for Cows',
            resolutionDate: new Date('2025-04-15T17:05:50.576Z').toISOString(),
            resolutionTimestamp: new Date('2025-04-15T17:05:50.576Z').toISOString(),
            finalCount: 11
        },
        {
            date: new Date('2025-04-15T17:04:41.735Z').toISOString(),
            category: 'Cull Cows',
            expected: 10,
            actual: 11,
            counterName: 'Scott',
            type: 'stock-count',
            resolved: true,
            resolution: 'Stock count discrepancy resolved for Cull Cows',
            resolutionDate: new Date('2025-04-15T17:06:04.169Z').toISOString(),
            resolutionTimestamp: new Date('2025-04-15T17:06:04.169Z').toISOString(),
            finalCount: 10
        }
    ];
}

/**
 * Ensure loadAnimalMovementData returns date range for consistency
 */
async function loadAnimalMovementData(category, startDate, endDate) {
    const result = await originalLoadAnimalMovementData(category, startDate, endDate);
    
    // Add date range to the result
    return {
        ...result,
        dateRange: {
            start: startDate,
            end: endDate
        }
    };
}

/**
 * Ensure all animal report data loaders include date range
 */
function updateAnimalDataLoaders() {
    // Store references to original functions
    if (typeof window.originalLoadAnimalMovementData === 'undefined') {
        window.originalLoadAnimalMovementData = window.loadAnimalMovementData || loadAnimalMovementData;
    }
    
    if (typeof window.originalLoadAnimalPurchaseData === 'undefined') {
        window.originalLoadAnimalPurchaseData = window.loadAnimalPurchaseData || loadAnimalPurchaseData;
    }
    
    if (typeof window.originalLoadAnimalSaleData === 'undefined') {
        window.originalLoadAnimalSaleData = window.loadAnimalSaleData || loadAnimalSaleData;
    }
    
    if (typeof window.originalLoadAnimalBirthData === 'undefined') {
        window.originalLoadAnimalBirthData = window.loadAnimalBirthData || loadAnimalBirthData;
    }
    
    if (typeof window.originalLoadAnimalDeathData === 'undefined') {
        window.originalLoadAnimalDeathData = window.loadAnimalDeathData || loadAnimalDeathData;
    }
    
    if (typeof window.originalLoadAnimalCountData === 'undefined') {
        window.originalLoadAnimalCountData = window.loadAnimalCountData || loadAnimalCountData;
    }
    
    if (typeof window.originalLoadAnimalDiscrepancyData === 'undefined') {
        window.originalLoadAnimalDiscrepancyData = window.loadAnimalDiscrepancyData || loadAnimalDiscrepancyData;
    }
    
    if (typeof window.originalLoadAnimalInventoryData === 'undefined') {
        window.originalLoadAnimalInventoryData = window.loadAnimalInventoryData || loadAnimalInventoryData;
    }
    
    // Initialize the function when the page loads
    document.addEventListener('DOMContentLoaded', () => {
        try {
            updateAnimalDataLoaders();
            console.log('Animal data loaders updated for consistency');
        } catch (e) {
            console.error('Error updating animal data loaders:', e);
        }
    });
}