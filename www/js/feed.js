    // Setup keyboard detection for mobile devices
// Global state variables
let feedInventory;
let feedCategories = [];
let feedTransactions;
let feedCalculations = [];
let feedAlertThresholds;
let feedUsageByAnimal;
let recentActivities;
let selectedCurrency;

// Helper function to get feed categories
async function getFeedCategories() {
    try {
        // Get categories from feed inventory first
        const feedInventoryStr = await mobileStorage.getItem('feedInventory');
        console.log('[DEBUG] Raw feed inventory from storage:', feedInventoryStr);
        
        if (feedInventoryStr) {
            try {
                const inventoryEntries = JSON.parse(feedInventoryStr);
                console.log('[DEBUG] Parsed feed inventory:', inventoryEntries);
                if (Array.isArray(inventoryEntries)) {
                    // Extract category names from inventory
                    const categories = inventoryEntries.map(entry => entry[0]);
                    console.log('[DEBUG] Extracted feed categories:', categories);
                    return categories;
                }
            } catch (parseError) {
                console.error('[DEBUG] Error parsing feed inventory:', parseError);
            }
        }
        
        // If no categories found in inventory, return empty array
        console.log('[DEBUG] No feed categories found in inventory');
        return [];
    } catch (error) {
        console.error('[DEBUG] Error getting feed categories:', error);
        return [];
    }
}

// Helper function to get animal categories (all categories recorded on the system, same as Animals page)
async function getAnimalCategories() {
    try {
        const categoriesSet = new Set();
        
        // 1. Use the canonical list from the Animals page (animalCategories)
        const categoriesStr = await mobileStorage.getItem('animalCategories');
        if (categoriesStr) {
            try {
                const parsed = JSON.parse(categoriesStr);
                if (Array.isArray(parsed)) {
                    parsed.forEach(c => { if (c && typeof c === 'string') categoriesSet.add(c.trim()); });
                }
            } catch (e) {
                console.error('[DEBUG] Error parsing animalCategories:', e);
            }
        }
        
        // 2. Add any categories from animal inventory (in case some exist there but not in animalCategories)
        const animalInventoryStr = await mobileStorage.getItem('animalInventory');
        if (animalInventoryStr) {
            try {
                const inventory = JSON.parse(animalInventoryStr);
                if (typeof inventory === 'object' && inventory !== null) {
                    Object.keys(inventory).forEach(c => { if (c && typeof c === 'string') categoriesSet.add(c.trim()); });
                }
            } catch (e) {
                console.error('[DEBUG] Error parsing animal inventory:', e);
            }
        }
        
        // 3. Add any from feed usage by animal (categories that have had feed used for them)
        const feedUsageStr = await mobileStorage.getItem('feedUsageByAnimal');
        if (feedUsageStr) {
            try {
                const usageEntries = JSON.parse(feedUsageStr);
                if (Array.isArray(usageEntries)) {
                    usageEntries.forEach(entry => { if (entry && entry[0]) categoriesSet.add(String(entry[0]).trim()); });
                } else if (typeof usageEntries === 'object') {
                    Object.keys(usageEntries).forEach(c => { if (c) categoriesSet.add(String(c).trim()); });
                }
            } catch (parseError) {
                console.error('[DEBUG] Error parsing feed usage:', parseError);
            }
        }
        
        const categories = Array.from(categoriesSet).filter(Boolean).sort();
        console.log('[DEBUG] Animal categories for Used for dropdown:', categories);
        return categories;
    } catch (error) {
        console.error('[DEBUG] Error getting animal categories:', error);
        return [];
    }
}

// Helper function to generate options for animal categories
async function getAnimalCategoriesOptions() {
    try {
        // Get actual categories from storage
        const categories = await getAnimalCategories();
        return categories.map(category => 
            `<option value="${category}">${category}</option>`
        ).join('');
    } catch (error) {
        console.error('Error generating animal category options:', error);
        return ''; // Return empty string if there's an error
    }
}

// Helper function to generate options for feed categories
async function getFeedCategoriesOptions() {
    const categories = await getFeedCategories();
    return categories.map(category => 
        `<option value="${category}">${category}</option>`
    ).join('');
}

// Add form validation function
function validateForm(form) {
    // Check all visible required fields are filled
    const visibleRequiredFields = Array.from(form.querySelectorAll('input[required]:not([disabled]), select[required]:not([disabled]), textarea[required]:not([disabled])'));
    
    for (const field of visibleRequiredFields) {
        // Skip hidden fields
        if (field.closest('.form-group').style.display === 'none') {
            continue;
        }
        
        if (!field.value) {
            field.focus();
            return false;
        }
    }
    
    return true;
}

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
                
                // Find any open popups and mark them as keyboard-visible
                document.querySelectorAll('.popup').forEach(popup => {
                    popup.classList.add('keyboard-visible');
                });
            } else {
                // Keyboard is likely hidden
                document.body.classList.remove('keyboard-open');
                
                // Remove keyboard-visible class from popups
                document.querySelectorAll('.popup').forEach(popup => {
                    popup.classList.remove('keyboard-visible');
                });
            }
        });
    }
    
    // Add explicit focus handling for input fields
    document.addEventListener('click', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
            // On iOS, explicitly focus the element after a slight delay
            setTimeout(() => {
                e.target.focus();
            }, 100);
        }
    });
    
    // Fallback for devices without visualViewport - use focus/blur events
    document.addEventListener('focusin', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
            document.body.classList.add('keyboard-open');
            
            // Find parent popup if any
            const parentPopup = e.target.closest('.popup');
            if (parentPopup) {
                parentPopup.classList.add('keyboard-visible');
            }
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
                    
                    // Remove keyboard-visible class from popups
                    document.querySelectorAll('.popup').forEach(popup => {
                        popup.classList.remove('keyboard-visible');
                    });
                }
            }, 100);
        }
    });
    
    // Add metadata for better iOS keyboard handling
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    if (viewportMeta) {
        // Update viewport meta to better handle iOS keyboard
        viewportMeta.setAttribute('content', 
            'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
    }
}

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
    try {
        console.log('Starting feed management initialization...');
        
        const feedInventoryStr = await mobileStorage.getItem('feedInventory');
        console.log('Feed inventory from storage:', feedInventoryStr);
        
        if (feedInventoryStr) {
            try {
                const parsed = JSON.parse(feedInventoryStr);
                console.log('Parsed feed inventory:', parsed);
                if (Array.isArray(parsed)) {
                    feedInventory = new Map(parsed);
                    // Extract feed categories from inventory
                    feedCategories = parsed.map(entry => entry[0]);
                } else if (typeof parsed === 'object') {
                    feedInventory = new Map(Object.entries(parsed));
                    // Extract feed categories from inventory
                    feedCategories = Object.keys(parsed);
                } else {
                    feedInventory = new Map();
                    feedCategories = [];
                }
                console.log('Initialized feed inventory:', Array.from(feedInventory.entries()));
                console.log('Initialized feed categories:', feedCategories);
            } catch (parseError) {
                console.warn('Error parsing feed inventory:', parseError);
                feedInventory = new Map();
                feedCategories = [];
            }
        } else {
            feedInventory = new Map();
            feedCategories = [];
        }

        // Load feed transactions
        const feedTransactionsStr = await mobileStorage.getItem('feedTransactions');
        feedTransactions = feedTransactionsStr ? JSON.parse(feedTransactionsStr) : [];
        
        // Load feed calculations with validation
        const feedCalculationsStr = await mobileStorage.getItem('feedCalculations');
        console.log('[DEBUG] Loading feed calculations from storage:', feedCalculationsStr);
        
        if (feedCalculationsStr) {
            try {
                const parsed = JSON.parse(feedCalculationsStr);
                console.log('[DEBUG] Parsed feed calculations:', parsed);
                if (Array.isArray(parsed)) {
                    feedCalculations = parsed;
                } else {
                    console.warn('Feed calculations data is not an array, resetting to empty array');
                    feedCalculations = [];
                }
            } catch (parseError) {
                console.error('Error parsing feed calculations:', parseError);
                feedCalculations = [];
            }
        } else {
            console.log('No feed calculations found in storage, using empty array');
            feedCalculations = [];
        }
        console.log('[DEBUG] Initialized feed calculations:', feedCalculations);
        
        const feedAlertThresholdsStr = await mobileStorage.getItem('feedAlertThresholds');
        console.log('Feed alert thresholds from storage:', feedAlertThresholdsStr);
        
        if (feedAlertThresholdsStr) {
            try {
                const parsed = JSON.parse(feedAlertThresholdsStr);
                console.log('Parsed feed alert thresholds:', parsed);
                if (Array.isArray(parsed)) {
                    feedAlertThresholds = new Map(parsed);
                } else if (typeof parsed === 'object') {
                    feedAlertThresholds = new Map(Object.entries(parsed));
                } else {
                    feedAlertThresholds = new Map();
                }
                console.log('Initialized feed alert thresholds:', Array.from(feedAlertThresholds.entries()));
            } catch (parseError) {
                console.warn('Error parsing feed alert thresholds:', parseError);
                feedAlertThresholds = new Map();
            }
        } else {
            feedAlertThresholds = new Map();
        }
        
        const feedUsageByAnimalStr = await mobileStorage.getItem('feedUsageByAnimal');
        console.log('Feed usage by animal from storage:', feedUsageByAnimalStr);
        
        if (feedUsageByAnimalStr) {
            try {
                const parsed = JSON.parse(feedUsageByAnimalStr);
                console.log('Parsed feed usage by animal:', parsed);
                if (Array.isArray(parsed)) {
                    feedUsageByAnimal = new Map(parsed);
                } else if (typeof parsed === 'object') {
                    feedUsageByAnimal = new Map(Object.entries(parsed));
                } else {
                    feedUsageByAnimal = new Map();
                }
                console.log('Initialized feed usage by animal:', Array.from(feedUsageByAnimal.entries()));
            } catch (parseError) {
                console.warn('Error parsing feed usage by animal:', parseError);
                feedUsageByAnimal = new Map();
            }
        } else {
            feedUsageByAnimal = new Map();
        }

        recentActivities = JSON.parse(await mobileStorage.getItem('recentActivities') || '[]');
        selectedCurrency = await mobileStorage.getItem('selectedCurrency') || 'ZAR';
        
        console.log('Feed management initialization complete:', {
            feedInventorySize: feedInventory.size,
            feedCategoriesCount: feedCategories.length,
            feedTransactionsCount: feedTransactions.length,
            feedCalculationsCount: feedCalculations.length,
            feedAlertThresholdsSize: feedAlertThresholds.size,
            feedUsageByAnimalSize: feedUsageByAnimal.size,
            recentActivitiesCount: recentActivities.length,
            selectedCurrency
        });
    } catch (error) {
        console.error('Error initializing feed state:', error);
        // Set default values if initialization fails
        feedInventory = new Map();
        feedCategories = [];
        feedTransactions = [];
        feedCalculations = [];
        feedAlertThresholds = new Map();
        feedUsageByAnimal = new Map();
        recentActivities = [];
        selectedCurrency = 'ZAR';
    }
    
    // Define currencies
    const worldCurrencies = [
        { code: 'GBP', name: 'British Pound', display: 'Pound', symbol: '\u00A3' },
        { code: 'EUR', name: 'Euro', display: 'Euro', symbol: '\u20AC' },
        { code: 'USD', name: 'US Dollar', display: 'Dollar', symbol: '\u0024' },
        { code: 'AUD', name: 'Australian Dollar', display: 'Dollar', symbol: '\u0024' },
        { code: 'NZD', name: 'New Zealand Dollar', display: 'Dollar', symbol: '\u0024' },
        { code: 'CAD', name: 'Canadian Dollar', display: 'Dollar', symbol: '\u0024' },
        { code: 'ZAR', name: 'South African Rand', display: 'Rand', symbol: 'R' }
    ];
    
    // Make necessary functions globally accessible
    window.getFeedCategories = getFeedCategories;
    window.getFeedCategoriesOptions = getFeedCategoriesOptions;
    window.getAnimalCategories = getAnimalCategories;
    window.getAnimalCategoriesOptions = getAnimalCategoriesOptions;
    window.showFeedCalculatorPopup = showFeedCalculatorPopup;
    window.showFeedPurchasedPopup = showFeedPurchasedPopup;
    window.showFeedUsedPopup = showFeedUsedPopup;
    window.confirmClearFeedData = confirmClearFeedData;
    
    // Setup event listeners
    setupEventListeners();
    
    // Initial display updates
    updateDisplays();
    
    // Add orientation change listener
    window.addEventListener('orientationchange', handleOrientationChange);
    
    console.log('Feed management initialized');
    
    function handleOrientationChange() {
        // Find any open popups and adjust them
        const openPopups = document.querySelectorAll('.popup');
        if (openPopups.length > 0) {
            // Give time for the orientation change to complete
            setTimeout(() => {
                openPopups.forEach(popup => {
                    // Ensure popup is centered in the new orientation
                    const popupContent = popup.querySelector('.popup-content');
                    if (popupContent) {
                        // Reset any inline styles that might interfere
                        popupContent.style.maxHeight = '';
                        
                        // For landscape orientation on small screens, adjust scrollable area
                        if (window.orientation === 90 || window.orientation === -90) {
                            const form = popupContent.querySelector('form');
                            if (form) {
                                // Ensure form is scrollable in landscape mode
                                form.style.maxHeight = `${window.innerHeight * 0.7}px`;
                            }
                        }
                    }
                });
            }, 300); // Small delay to let the resize complete
        }
    }
    
    // Helper function to create popups with proper orientation handling
    function createPopup(contentHTML) {
        const popup = document.createElement('div');
        popup.className = 'popup';
        popup.innerHTML = contentHTML;
        
        document.body.appendChild(popup);
        
        // Initial orientation adjustment
        if (window.orientation === 90 || window.orientation === -90) {
            const popupContent = popup.querySelector('.popup-content');
            const form = popupContent?.querySelector('form');
            if (form) {
                form.style.maxHeight = `${window.innerHeight * 0.7}px`;
            }
        }
        
        // Add auto-selection to input fields with default values
        popup.querySelectorAll('input, textarea').forEach(input => {
            // For all inputs that might have default values, select all text on focus
            input.addEventListener('focus', function() {
                // Slight delay to ensure the field is properly focused
                setTimeout(() => {
                    // Select all text in the field when focused
                    this.select();
                }, 50);
            });
            
            // For number inputs, also select on click to handle cases where
            // the field already has focus but user wants to change the value
            if (input.type === 'number') {
                input.addEventListener('click', function() {
                    this.select();
                });
            }
            
            // Enhanced input field handling for iOS
            if (input.type === 'number') {
                if (input.step && input.step !== '1' && parseFloat(input.step) < 1) {
                    // For decimal number inputs (with step like 0.1, 0.01, etc.)
                    input.setAttribute('inputmode', 'decimal');
                    input.setAttribute('pattern', '[0-9]*[.]?[0-9]*');
                } else {
                    // For integer inputs
                    input.setAttribute('inputmode', 'numeric');
                    input.setAttribute('pattern', '[0-9]*');
                }
            }
            
            // For text inputs
            if (input.type === 'text') {
                input.setAttribute('inputmode', 'text');
                input.setAttribute('autocomplete', 'off');
                input.setAttribute('autocorrect', 'off');
                input.setAttribute('autocapitalize', 'off');
            }
            
            // For date inputs, ensure they're properly formatted
            if (input.type === 'date') {
                input.setAttribute('inputmode', 'none'); // Prefer native date picker
            }
            
            // For textarea
            if (input.tagName === 'TEXTAREA') {
                input.setAttribute('inputmode', 'text');
                input.setAttribute('autocorrect', 'off');
            }
            
            // Add data-lpignore to prevent LastPass from interfering
            input.setAttribute('data-lpignore', 'true');
            
            // Add iOS-specific attributes
            input.setAttribute('autocomplete', 'off');
            input.style.fontSize = '16px'; // Prevents iOS zoom
        });
        
        popup.querySelectorAll('select').forEach(select => {
            // Set attributes for select fields
            select.setAttribute('data-lpignore', 'true');
        });
        
        // Focus the first input or select element to trigger keyboard
        setTimeout(() => {
            const firstInput = popup.querySelector('input:not([type="hidden"]), select, textarea');
            if (firstInput) {
                firstInput.focus();
            }
        }, 300); // Small delay to ensure the popup is rendered
        
        return popup;
    }
    
    function setupEventListeners() {
        // Add Feed Category button
        document.getElementById('add-feed-btn')?.addEventListener('click', showAddFeedCategoryPopup);
        
        // Feed Calculator button
        document.getElementById('feed-calculator-btn')?.addEventListener('click', showFeedCalculatorPopup);
        
        // Record Purchase button
        document.getElementById('feed-purchase-btn')?.addEventListener('click', showFeedPurchasedPopup);
        
        // Record Usage button
        document.getElementById('feed-usage-btn')?.addEventListener('click', showFeedUsedPopup);
        
        // Clear Feed Data button
        document.getElementById('clear-feed-data')?.addEventListener('click', confirmClearFeedData);
        
        // Add event listener for clear feed data button (if it exists)
        const clearFeedDataBtn = document.getElementById('clear-feed-data');
        if (clearFeedDataBtn) {
            clearFeedDataBtn.addEventListener('click', confirmClearFeedData);
        }
    }
    
    function updateDisplays() {
        updateInventoryDisplay();
        updateCalculationsDisplay();
        updateThresholdsDisplay();
        updateUsageDisplay();
        updateAlertsDisplay();
    }
    
    function updateInventoryDisplay() {
        const inventoryElement = document.getElementById('feed-inventory');
        if (!inventoryElement) return;
        
        if (feedInventory.size === 0) {
            inventoryElement.innerHTML = '<p>No feed in inventory</p>';
            return;
        }
        
        inventoryElement.innerHTML = '';
        
        // Convert Map entries to array for easier manipulation
        Array.from(feedInventory.entries()).forEach(([category, data]) => {
            const isLowStock = data.quantity <= data.threshold;
            const item = document.createElement('div');
            item.className = `inventory-item ${isLowStock ? 'low-stock' : 'good-stock'}`;
            
            const currency = worldCurrencies.find(c => c.code === selectedCurrency) || { symbol: 'R' };
            const priceDisplay = data.price ? `${currency.symbol}${data.price.toFixed(2)}` : 'N/A';
            
            item.innerHTML = `
                <div class="inventory-header">
                    <span class="feed-name">${category}</span>
                    <span class="feed-quantity">${data.quantity} ${data.unit}</span>
                </div>
                <div class="feed-details">
                    <div>Threshold: ${data.threshold} ${data.unit} ${isLowStock ? '(Low stock!)' : ''}</div>
                    <div>Supplier: ${data.supplier || 'Not specified'}</div>
                    <div>Price: ${priceDisplay}</div>
                    <div>Last updated: ${new Date(data.lastUpdated).toLocaleDateString()}</div>
                </div>
            `;
            
            inventoryElement.appendChild(item);
        });
    }
    
    function updateCalculationsDisplay() {
        const calculationsElement = document.getElementById('calculations-list');
        if (!calculationsElement) return;
        
        if (feedCalculations.length === 0) {
            calculationsElement.innerHTML = '<p>No calculations yet</p>';
            return;
        }
        
        calculationsElement.innerHTML = '';
        
        // Filter duplicates using timestamp-only approach (matching dashboard.js)
        const uniqueCalculations = [];
        const uniqueTimestamps = new Set();
        
        feedCalculations.forEach(calc => {
            // Create a unique identifier based only on timestamp
            const date = new Date(calc.date || calc.timestamp);
            const uniqueId = date.getTime().toString();
            
            if (!uniqueTimestamps.has(uniqueId)) {
                uniqueTimestamps.add(uniqueId);
                uniqueCalculations.push(calc);
            }
        });
        
        // Sort by date, newest first
        uniqueCalculations.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // Show most recent 3 calculations
        uniqueCalculations.slice(0, 3).forEach(calc => {
            const item = document.createElement('div');
            item.className = 'calculation-item';
            
            const date = new Date(calc.date).toLocaleDateString();
            const animalCategory = calc.animalCategory || calc.category;
            const animalCount = calc.animalCount || calc.numAnimals || 0;
            const feedType = calc.feedType || 'Unknown';
            const duration = calc.duration || 1;
            const dailyIntake = calc.dailyIntake || 0;
            const dailyIntakeKg = dailyIntake / 1000;
            const totalDailyCost = calc.totalDailyCost || 0;
            const totalCost = calc.totalCost || 0;
            const totalFeedNeeded = calc.totalFeedNeeded || (dailyIntakeKg * animalCount * duration);
            
            // Get currency
            const currency = worldCurrencies.find(c => c.code === selectedCurrency)?.symbol || 'R';
            
            item.innerHTML = `
                <div class="calculation-header">
                    <span class="calculation-type">${animalCategory} (${animalCount} animals)</span>
                    <span class="calculation-date">${date}</span>
                </div>
                <div class="calculation-details">
                    <div class="calculation-main">
                        <div>Feed: ${feedType}</div>
                        <div>Daily intake: ${dailyIntakeKg.toFixed(2)}kg per animal</div>
                        <div>Total feed: ${totalFeedNeeded.toFixed(2)}kg (${duration} days)</div>
                    </div>
                    <div class="calculation-costs">
                        <div>Daily cost: ${currency}${totalDailyCost.toFixed(2)}</div>
                        <div>Per animal: ${currency}${(totalDailyCost / animalCount).toFixed(2)}/day</div>
                        <div class="total-cost">Total (${duration} days): ${currency}${totalCost.toFixed(2)}</div>
                    </div>
                </div>
            `;
            
            calculationsElement.appendChild(item);
        });
        
        // If there are more than 3 calculations, add a "show more" note
        if (uniqueCalculations.length > 3) {
            const showMore = document.createElement('p');
            showMore.className = 'show-more';
            showMore.textContent = `+ ${uniqueCalculations.length - 3} more calculations`;
            calculationsElement.appendChild(showMore);
        }
    }
    
    function updateThresholdsDisplay() {
        const thresholdsElement = document.getElementById('thresholds-list');
        if (!thresholdsElement) return;
        
        if (feedInventory.size === 0) {
            thresholdsElement.innerHTML = '<p>No thresholds defined</p>';
            return;
        }
        
        thresholdsElement.innerHTML = '';
        
        // Convert Map entries to array for easier manipulation
        Array.from(feedInventory.entries()).forEach(([category, data]) => {
            const currentStock = data.quantity || 0;
            const threshold = data.threshold || 0;
            const percentRemaining = currentStock / (threshold * 2) * 100; // Use 2x threshold as 100%
            
            let status = 'good';
            if (currentStock <= threshold * 0.5) {
                status = 'critical';
            } else if (currentStock <= threshold) {
                status = 'warning';
            }
            
            const item = document.createElement('div');
            item.className = 'threshold-item';
            
            item.innerHTML = `
                <div class="threshold-info">
                    <span class="threshold-name">${category}</span>
                    <span class="threshold-value">
                        <span class="status-indicator status-${status}"></span>
                        ${currentStock} of ${threshold} ${data.unit} minimum
                    </span>
                </div>
            `;
            
            thresholdsElement.appendChild(item);
        });
    }
    
    function updateUsageDisplay() {
        const usageElement = document.getElementById('usage-list');
        if (!usageElement) return;
        
        const usageTransactions = feedTransactions.filter(t => t.type === 'usage');
        
        if (usageTransactions.length === 0) {
            usageElement.innerHTML = '<p>No usage records</p>';
            return;
        }
        
        usageElement.innerHTML = '';
        
        // Get currency symbol
        const currency = worldCurrencies.find(c => c.code === selectedCurrency) || { symbol: 'R' };
        
        // Show most recent 3 usage records
        usageTransactions.slice(0, 3).forEach(usage => {
            const date = new Date(usage.date).toLocaleDateString();
            
            const item = document.createElement('div');
            item.className = 'usage-item';
            
            item.innerHTML = `
                <div class="usage-header">
                    <span class="usage-type">${usage.feedType}</span>
                    <span class="usage-date">${date}</span>
                </div>
                <div class="usage-details">
                    <div>Used: ${usage.quantity} ${usage.unit}</div>
                    <div>For: ${usage.animalCategory || 'N/A'}</div>
                    ${usage.weightInKg ? `<div>Weight: ${usage.weightInKg.toFixed(2)} kg</div>` : ''}
                    ${usage.totalCost ? `<div>Cost: ${currency.symbol}${usage.totalCost.toFixed(2)}</div>` : ''}
                    ${usage.notes ? `<div>Notes: ${usage.notes}</div>` : ''}
                </div>
            `;
            
            usageElement.appendChild(item);
        });
    }
    
    function updateAlertsDisplay() {
        const alertsElement = document.getElementById('alerts-list');
        if (!alertsElement) return;
        
        // Create alerts for low stock items
        const lowStockItems = Array.from(feedInventory.entries())
            .filter(([_, data]) => data.quantity <= data.threshold);
        
        if (lowStockItems.length === 0) {
            alertsElement.innerHTML = '<p>No alerts</p>';
            return;
        }
        
        alertsElement.innerHTML = '';
        
        lowStockItems.forEach(([category, data]) => {
            const item = document.createElement('div');
            item.className = 'alert-item';
            
            item.innerHTML = `
                <div class="alert-message">
                    Low stock: ${category}
                </div>
                <div class="alert-details">
                    Current: ${data.quantity} ${data.unit}
                    <br>
                    Threshold: ${data.threshold} ${data.unit}
                    <br>
                    Action: Restock soon to avoid shortages
                </div>
            `;
            
            alertsElement.appendChild(item);
        });
    }
    
    async function saveState() {
        try {
            console.log('Saving feed state...');
            
            // Save all state to storage
            await mobileStorage.setItem('feedInventory', JSON.stringify(Array.from(feedInventory.entries())));
            await mobileStorage.setItem('feedTransactions', JSON.stringify(feedTransactions));
            await mobileStorage.setItem('feedCalculations', JSON.stringify(feedCalculations));
            await mobileStorage.setItem('feedAlertThresholds', JSON.stringify(Array.from(feedAlertThresholds.entries())));
            await mobileStorage.setItem('feedUsageByAnimal', JSON.stringify(Array.from(feedUsageByAnimal.entries())));
            await mobileStorage.setItem('recentActivities', JSON.stringify(recentActivities));
            
            console.log('Feed state saved successfully');
        } catch (error) {
            console.error('Error saving feed state:', error);
            alert('There was an error saving data. Please try again.');
        }
    }
    
    function showAddFeedCategoryPopup() {
        const popupContent = `
            <div class="popup-content">
                <h3>Add Feed Category</h3>
                <form id="add-feed-category-form">
                    <div class="form-group">
                        <label for="feed-type">Feed Type:</label>
                        <input type="text" id="feed-type" name="feed-type" placeholder="e.g., Winter Lick, Production Lick" required inputmode="text" autocomplete="off">
                    </div>
                    <div class="form-group">
                        <label for="feed-threshold">Low Stock Threshold:</label>
                        <input type="number" id="feed-threshold" name="feed-threshold" min="0" value="80" required inputmode="numeric" pattern="[0-9]*">
                    </div>
                    <div class="form-group">
                        <label for="feed-unit">Unit:</label>
                        <select id="feed-unit" name="feed-unit" required>
                            <option value="bags">Bags</option>
                            <option value="kg">Kilograms (kg)</option>
                            <option value="lb">Pounds (lb)</option>
                            <option value="bales">Bales</option>
                        </select>
                    </div>
                    <div class="form-group weight-per-unit-group" style="display: none;">
                        <label for="weight-per-unit">Weight per <span class="unit-label">bag</span>:</label>
                        <div class="input-unit-group">
                            <input type="number" id="weight-per-unit" name="weight-per-unit" min="0.1" step="0.1" placeholder="Enter weight" value="50">
                            <select id="weight-unit" name="weight-unit" class="unit-select">
                                <option value="kg">kilograms (kg)</option>
                                <option value="g">grams (g)</option>
                                <option value="lb">pounds (lb)</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="cancel-btn">Cancel</button>
                        <button type="submit" class="save-btn">Add</button>
                    </div>
                </form>
            </div>
        `;
        
        const popup = createPopup(popupContent);
        
        // Setup unit change event to show/hide weight per unit field
        const unitSelect = popup.querySelector('#feed-unit');
        const weightPerUnitGroup = popup.querySelector('.weight-per-unit-group');
        const unitLabel = popup.querySelector('.unit-label');
        
        unitSelect.addEventListener('change', () => {
            const selectedUnit = unitSelect.value;
            const isNonWeightUnit = ['bags', 'bales'].includes(selectedUnit);
            
            // Show/hide weight per unit field based on unit type
            weightPerUnitGroup.style.display = isNonWeightUnit ? 'block' : 'none';
            
            // Update the label
            if (isNonWeightUnit) {
                unitLabel.textContent = selectedUnit.slice(0, -1); // Remove the 's' at the end
            }
        });
        
        // Trigger change event to set initial state
        unitSelect.dispatchEvent(new Event('change'));
        
        // Form submission handling
        const form = popup.querySelector('form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const feedType = popup.querySelector('#feed-type').value.trim();
            const threshold = parseInt(popup.querySelector('#feed-threshold').value, 10);
            const unit = popup.querySelector('#feed-unit').value;
            
            // Get weight per unit if applicable
            const isNonWeightUnit = ['bags', 'bales'].includes(unit);
            let weightPerKg = 0;
            
            if (isNonWeightUnit) {
                const weightPerUnit = parseFloat(popup.querySelector('#weight-per-unit').value);
                const weightUnit = popup.querySelector('#weight-unit').value;
                
                // Validate weight per unit - must be greater than 0
                if (weightPerUnit <= 0) {
                    alert('Weight per unit must be greater than 0');
                    return;
                }
                
                // Convert to kg
                if (weightUnit === 'g') {
                    weightPerKg = weightPerUnit / 1000;
                } else if (weightUnit === 'lb') {
                    weightPerKg = weightPerUnit * 0.45359237; // 1 lb = 0.45359237 kg
                } else { // kg
                    weightPerKg = weightPerUnit;
                }
                
                // Validate final weight per kg - this prevents division by zero errors
                if (weightPerKg <= 0) {
                    alert('Weight equivalent must be greater than 0 kg');
                    return;
                }
            }
            
            if (!feedType) {
                alert('Please enter a feed type');
                return;
            }
            
            // Check if category already exists
            if (feedCategories.includes(feedType)) {
                alert(`Feed category "${feedType}" already exists`);
                return;
            }
            
            // Add new category
            feedCategories.push(feedType);
            
            // Set initial inventory for this category
            feedInventory.set(feedType, {
                quantity: 0,
                unit: unit,
                threshold: threshold,
                price: 0,
                supplier: '',
                lastUpdated: new Date().toISOString(),
                transactions: [],
                weightPerKg: isNonWeightUnit ? weightPerKg : 0 // Store weight per kg for non-weight units
            });
            
            // Add to alert thresholds
            feedAlertThresholds.set(feedType, threshold);
            
            // Save state
            await saveState();
            
            // Update UI
            updateDisplays();
            
            // Add to recent activities
            const activity = {
                type: 'feed-category-added',
                feedType,
                threshold,
                unit,
                weightPerKg: isNonWeightUnit ? weightPerKg : 0,
                timestamp: new Date().toISOString(),
                description: `Added feed category: ${feedType}`
            };
            
            recentActivities.unshift(activity);
            
            // Close popup
            popup.remove();
        });
        
        // Cancel button handling
        popup.querySelector('.cancel-btn').addEventListener('click', () => {
            popup.remove();
        });
    }
    
    function showFeedCalculatorPopup() {
        // Remove any existing popup before creating a new one
        const existingPopup = document.querySelector('.popup');
        if (existingPopup) {
            existingPopup.remove();
        }

        // First ensure we have the latest categories from storage
        Promise.all([
            getFeedCategories(),
            getAnimalCategories()
        ]).then(([feedCategories, animalCategories]) => {
            console.log('Feed categories for popup:', feedCategories);
            console.log('Animal categories for popup:', animalCategories);

            // Check if we have any categories
            if (!feedCategories || feedCategories.length === 0) {
                console.log('No feed categories found, showing add category popup');
                alert('Please add feed categories first before using the calculator.');
                showAddFeedCategoryPopup();
                return;
            }

            if (!animalCategories || animalCategories.length === 0) {
                console.log('No animal categories found');
                alert('No animal categories found. Please add animals first.');
                return;
            }

            // Generate the options HTML
            const feedCategoryOptions = feedCategories.map(category => {
                // Ensure category is a string
                const categoryStr = typeof category === 'string' ? category : JSON.stringify(category);
                return `<option value="${categoryStr}">${categoryStr}</option>`;
            }).join('');
            console.log('Generated feed category options:', feedCategoryOptions);

            const animalCategoryOptions = animalCategories.map(category => 
                `<option value="${category}">${category}</option>`
            ).join('');
            console.log('Generated animal category options:', animalCategoryOptions);

            const popupContent = `
                <div class="popup-content">
                    <h3>Feed Calculator</h3>
                    <form id="feed-calculator-form">
                        <div class="form-group">
                            <label for="animal-category">Animal Category:</label>
                            <select id="animal-category" name="animal-category" required>
                                <option value="">Select a category</option>
                                ${animalCategoryOptions}
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="animal-count">Number of Animals:</label>
                            <input type="number" id="animal-count" name="animal-count" min="1" placeholder="Enter number of animals" required>
                        </div>
                        <div class="form-group">
                            <label for="feed-type">Feed Type:</label>
                            <select id="feed-type" name="feed-type" required>
                                <option value="">Select feed type</option>
                                ${feedCategoryOptions}
                            </select>
                        </div>
                        <div class="form-group weight-per-unit-group" style="display: none;">
                            <label for="weight-per-unit">Weight per <span class="unit-label">bag</span>:</label>
                            <div class="input-unit-group">
                                <input type="number" id="weight-per-unit" name="weight-per-unit" min="0.1" step="0.1" placeholder="Enter weight" inputmode="decimal" pattern="[0-9]*(\.[0-9]+)?" autocomplete="off">
                                <select id="weight-unit" name="weight-unit" class="unit-select">
                                    <option value="kg">kilograms (kg)</option>
                                    <option value="g">grams (g)</option>
                                    <option value="lb">pounds (lb)</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="daily-intake">Daily Intake per Animal:</label>
                            <div class="input-unit-group">
                                <input type="number" id="daily-intake" name="daily-intake" min="0.1" step="0.1" placeholder="Enter daily intake" required>
                                <select id="intake-unit" name="intake-unit" class="unit-select">
                                    <option value="g">grams (g)</option>
                                    <option value="kg">kilograms (kg)</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="duration">Duration (days):</label>
                            <input type="number" id="duration" name="duration" min="1" placeholder="30" required>
                        </div>
                        <div class="form-group calculator-price-group">
                            <label for="calculator-price">Price per <span class="calculator-unit-label">unit</span>:</label>
                            <input type="number" id="calculator-price" name="calculator-price" min="0" step="0.01" placeholder="From last purchase or enter" inputmode="decimal" pattern="[0-9]*\.?[0-9]*">
                            <span class="help-text" id="calculator-price-hint">Uses last recorded price if left blank</span>
                        </div>
                        <div class="calculator-result" style="display: none;">
                            <h4>Calculation Results</h4>
                            <div class="result-items"></div>
                        </div>
                        <div class="form-actions">
                            <button type="button" class="cancel-btn">Cancel</button>
                            <button type="submit" class="save-btn">Calculate</button>
                        </div>
                    </form>
                </div>
            `;
            
            const popup = createPopup(popupContent);
            
            // Helper: get latest purchase price for a feed type (from feedTransactions)
            function getLatestPurchasePriceForFeed(feedType) {
                if (!feedTransactions || !Array.isArray(feedTransactions)) return 0;
                const purchase = feedTransactions.find(t => t.type === 'purchase' && t.feedType === feedType);
                return purchase && (purchase.pricePerUnit != null) ? parseFloat(purchase.pricePerUnit) : 0;
            }

            // Setup feed type change event to show/hide weight per unit field and pre-fill price
            const feedTypeSelect = popup.querySelector('#feed-type');
            const weightPerUnitGroup = popup.querySelector('.weight-per-unit-group');
            const weightPerUnitInput = popup.querySelector('#weight-per-unit');
            const unitLabel = popup.querySelector('.unit-label');
            const calculatorPriceInput = popup.querySelector('#calculator-price');
            const calculatorUnitLabel = popup.querySelector('.calculator-unit-label');
            
            feedTypeSelect.addEventListener('change', () => {
                const selectedFeed = feedTypeSelect.value;
                const feedData = feedInventory.get(selectedFeed);
                
                if (feedData) {
                    // Price: use feedData.price, or latest purchase price, so calculator updates after a purchase
                    const effectivePrice = (feedData.price && parseFloat(feedData.price) > 0)
                        ? parseFloat(feedData.price)
                        : getLatestPurchasePriceForFeed(selectedFeed);
                    if (calculatorPriceInput) {
                        calculatorPriceInput.value = effectivePrice > 0 ? effectivePrice.toFixed(2) : '';
                        calculatorPriceInput.placeholder = effectivePrice > 0 ? 'From last purchase' : 'Enter price per unit';
                    }
                    const unit = feedData.unit || 'kg';
                    const unitLabelText = unit === 'bags' ? 'bag' : (unit === 'bales' ? 'bale' : unit);
                    if (calculatorUnitLabel) calculatorUnitLabel.textContent = unitLabelText;
                    
                    // Check if the unit is a non-weight unit (bags, bales, etc.)
                    const isNonWeightUnit = ['bags', 'bales'].includes(feedData.unit);
                    
                    // Show/hide weight per unit field based on unit type
                    weightPerUnitGroup.style.display = isNonWeightUnit ? 'block' : 'none';
                    
                    // If it's a non-weight unit, update the label and make the field required
                    if (isNonWeightUnit) {
                        unitLabel.textContent = feedData.unit.slice(0, -1); // Remove the 's' at the end
                        weightPerUnitInput.required = true;
                        weightPerUnitInput.disabled = false;
                        
                        // Set default value if available
                        if (feedData.weightPerKg) {
                            weightPerUnitInput.value = feedData.weightPerKg;
                            popup.querySelector('#weight-unit').value = 'kg'; // Default to kg
                        }
                    } else {
                        weightPerUnitInput.required = false;
                        weightPerUnitInput.disabled = true;
                    }
                }
            });
            
            // Form submission handling
            const form = popup.querySelector('form');
            let calculationSaved = false;
            
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                // If we've already calculated and saved, just close the popup
                if (calculationSaved) {
                    popup.remove();
                    return;
                }
                
                // First validate the form
                if (!validateForm(form)) {
                    return;
                }
                
                const animalCategory = form.querySelector('#animal-category').value;
                const animalCount = parseInt(form.querySelector('#animal-count').value);
                const feedType = form.querySelector('#feed-type').value;
                const dailyIntake = parseFloat(form.querySelector('#daily-intake').value);
                const intakeUnit = form.querySelector('#intake-unit').value;
                const duration = parseInt(form.querySelector('#duration').value);
                
                // Get feed data
                const feedData = feedInventory.get(feedType);
                const feedUnit = feedData ? feedData.unit : 'kg';
                
                // Price: from calculator field, or feed inventory, or latest purchase (so it updates after a purchase)
                const priceInputVal = form.querySelector('#calculator-price') && form.querySelector('#calculator-price').value;
                const priceFromInput = priceInputVal !== '' && priceInputVal !== undefined ? parseFloat(priceInputVal) : NaN;
                const priceFromInventory = feedData && feedData.price ? parseFloat(feedData.price) : 0;
                const priceFromPurchase = getLatestPurchasePriceForFeed(feedType);
                const effectivePrice = (!isNaN(priceFromInput) && priceFromInput >= 0) ? priceFromInput : (priceFromInventory || priceFromPurchase);
                
                // If user entered a price in calculator, save to feed inventory for next time
                if (feedData && !isNaN(priceFromInput) && priceFromInput >= 0) {
                    feedData.price = priceFromInput;
                    feedInventory.set(feedType, feedData);
                    await saveState();
                }
                
                // Check if we need to handle weight conversion
                const isNonWeightUnit = ['bags', 'bales'].includes(feedUnit);
                let weightPerKg = 1;
                
                if (isNonWeightUnit) {
                    const weightPerUnit = parseFloat(form.querySelector('#weight-per-unit').value);
                    const weightUnit = form.querySelector('#weight-unit').value;
                    
                    // Validate weight per unit - must be greater than 0
                    if (weightPerUnit <= 0) {
                        alert('Weight per unit must be greater than 0');
                        return;
                    }
                    
                    // Convert weight to kg
                    if (weightUnit === 'g') {
                        weightPerKg = weightPerUnit / 1000;
                    } else if (weightUnit === 'lb') {
                        weightPerKg = weightPerUnit * 0.45359237; // 1 lb = 0.45359237 kg
                    } else {
                        weightPerKg = weightPerUnit;
                    }
                    
                    // Validate final weight per kg - this prevents division by zero errors
                    if (weightPerKg <= 0) {
                        alert('Weight equivalent must be greater than 0 kg');
                        return;
                    }
                }
                
                // Convert to grams for standardization
                let dailyIntakeG = intakeUnit === 'kg' ? dailyIntake * 1000 : dailyIntake;
                
                // Do calculations
                const dailyIntakeKg = dailyIntakeG / 1000;
                const totalDailyIntakeKg = dailyIntakeKg * animalCount;
                const totalFeedNeededKg = totalDailyIntakeKg * duration;
                
                // Calculate costs (use effectivePrice from calculator field, inventory, or last purchase)
                let costPerAnimalPerDay = 0;
                let totalDailyCost = 0;
                let totalCost = 0;
                let feedNeededInUnits = 0;
                let pricePerKg = 0;
                
                if (effectivePrice > 0) {
                    if (isNonWeightUnit) {
                        pricePerKg = effectivePrice / weightPerKg;
                        feedNeededInUnits = totalFeedNeededKg / weightPerKg;
                    } else {
                        if (feedData && feedData.unit === 'lb') {
                            pricePerKg = effectivePrice * 2.20462;
                        } else {
                            pricePerKg = effectivePrice;
                        }
                        feedNeededInUnits = totalFeedNeededKg;
                    }
                    
                    costPerAnimalPerDay = dailyIntakeKg * pricePerKg;
                    totalDailyCost = costPerAnimalPerDay * animalCount;
                    totalCost = totalDailyCost * duration;
                }
                
                // Create calculation record
                const calculation = {
                    date: new Date().toISOString(),
                    animalCategory,
                    animalCount,
                    feedType,
                    feedUnit,
                    dailyIntake: dailyIntakeG,
                    duration,
                    totalFeedNeeded: totalFeedNeededKg,
                    totalFeedNeededInUnits: feedNeededInUnits,
                    pricePerKg,
                    costPerAnimalPerDay,
                    totalDailyCost,
                    totalCost,
                    isNonWeightUnit,
                    weightPerKg: isNonWeightUnit ? weightPerKg : 1
                };
                
                // Add to calculations
                feedCalculations.unshift(calculation);
                
                // Save and update UI
                await saveState();
                updateDisplays();
                
                // Mark as saved
                calculationSaved = true;
                
                // Show calculation results
                const currency = worldCurrencies.find(c => c.code === selectedCurrency) || { symbol: 'R' };
                const resultDiv = popup.querySelector('.calculator-result');
                resultDiv.style.display = 'block';
                resultDiv.querySelector('.result-items').innerHTML = `
                    <div class="result-item">
                        <span>Feed needed per day:</span>
                        <span>${totalDailyIntakeKg.toFixed(2)} kg</span>
                    </div>
                    <div class="result-item">
                        <span>Total feed needed (${duration} days):</span>
                        <span>${totalFeedNeededKg.toFixed(2)} kg${isNonWeightUnit ? ` (${feedNeededInUnits.toFixed(2)} ${feedUnit})` : ''}</span>
                    </div>
                    <div class="result-item">
                        <span>Price per kg:</span>
                        <span>${currency.symbol}${pricePerKg.toFixed(2)}/kg</span>
                    </div>
                    <div class="result-item">
                        <span>Cost per animal per day:</span>
                        <span>${currency.symbol}${costPerAnimalPerDay.toFixed(2)}</span>
                    </div>
                    <div class="result-item">
                        <span>Daily cost (${animalCount} animals):</span>
                        <span>${currency.symbol}${totalDailyCost.toFixed(2)}</span>
                    </div>
                    <div class="result-item total-cost">
                        <span>Total cost for ${duration} days:</span>
                        <span>${currency.symbol}${totalCost.toFixed(2)}</span>
                    </div>
                `;
                
                // Change submit button text to close
                const submitBtn = form.querySelector('.save-btn');
                submitBtn.textContent = 'Close';
            });
            
            // Cancel button handling
            popup.querySelector('.cancel-btn').addEventListener('click', () => {
                popup.remove();
            });
        }).catch(error => {
            console.error('Error setting up feed calculator popup:', error);
            alert('There was an error loading the feed calculator. Please try again.');
        });
    }
    
    function showFeedPurchasedPopup() {
        // Only show popup if there are feed categories
        if (feedCategories.length === 0) {
            alert('Please add a feed category first before recording a purchase.');
            showAddFeedCategoryPopup();
            return;
        }
        
        const popupContent = `
            <div class="popup-content">
                <h3>Record Feed Purchase</h3>
                <form id="feed-purchased-form">
                    <div class="form-group">
                        <label for="feed-type">Feed Type:</label>
                        <select id="feed-type" name="feed-type" required>
                            <option value="" disabled selected>Select feed type</option>
                            ${feedCategories.map(category => {
                                const data = feedInventory.get(category);
                                return `<option value="${category}">${category} (Current: ${data ? data.quantity : 0} ${data ? data.unit : 'units'})</option>`;
                            }).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="quantity">Quantity:</label>
                        <input type="number" id="quantity" name="quantity" min="0.1" step="0.1" placeholder="Enter quantity" required inputmode="decimal" pattern="[0-9]*\.?[0-9]*">
                    </div>
                    <div class="form-group weight-equivalent-group" style="display: none;">
                        <label for="weight-equivalent">Weight per <span class="unit-label">bag</span>:</label>
                        <div class="input-unit-group">
                            <input type="number" id="weight-equivalent" name="weight-equivalent" min="0.1" step="0.1" placeholder="Enter weight" inputmode="decimal" pattern="[0-9]*(\.[0-9]+)?" autocomplete="off">
                            <select id="weight-unit" name="weight-unit" class="unit-select">
                                <option value="kg">kilograms (kg)</option>
                                <option value="g">grams (g)</option>
                                <option value="lb">pounds (lb)</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="price">Price per Unit:</label>
                        <input type="number" id="price" name="price" min="0" step="0.01" placeholder="Enter price per unit" required inputmode="decimal" pattern="[0-9]*\.?[0-9]*">
                    </div>
                    <div class="form-group">
                        <label for="supplier">Supplier (optional):</label>
                        <input type="text" id="supplier" name="supplier" placeholder="Enter supplier name" inputmode="text" autocomplete="off">
                    </div>
                    <div class="form-group">
                        <label for="purchase-date">Date:</label>
                        <input type="date" id="purchase-date" name="purchase-date" required value="${new Date().toISOString().split('T')[0]}">
                    </div>
                    <div class="form-group">
                        <label for="notes">Notes (optional):</label>
                        <textarea id="notes" name="notes" rows="2" inputmode="text"></textarea>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="cancel-btn">Cancel</button>
                        <button type="submit" class="save-btn">Save</button>
                    </div>
                </form>
            </div>
        `;
        
        const popup = createPopup(popupContent);
        
        // Setup feed type change event to show units
        const feedTypeSelect = popup.querySelector('#feed-type');
        const quantityInput = popup.querySelector('#quantity');
        const priceInput = popup.querySelector('#price');
        const weightEquivalentGroup = popup.querySelector('.weight-equivalent-group');
        const weightEquivalentInput = popup.querySelector('#weight-equivalent');
        const unitLabel = popup.querySelector('.unit-label');
        
        feedTypeSelect.addEventListener('change', () => {
            const selectedFeed = feedTypeSelect.value;
            const feedData = feedInventory.get(selectedFeed);
            if (feedData) {
                const unit = feedData.unit || 'kg';
                
                // Update labels with unit
                const unitLabel = popup.querySelector('label[for="quantity"]');
                unitLabel.textContent = `Quantity (${unit}):`;
                const priceLabel = popup.querySelector('label[for="price"]');
                priceLabel.textContent = `Price per ${unit}:`;
                
                // Pre-fill price from last recorded value (from inventory, updated when purchase is recorded)
                const lastPrice = feedData.price && parseFloat(feedData.price) > 0 ? parseFloat(feedData.price) : 0;
                if (priceInput) {
                    priceInput.value = lastPrice > 0 ? lastPrice.toFixed(2) : '';
                    priceInput.placeholder = lastPrice > 0 ? 'From last purchase' : 'Enter price per ' + (unit === 'bags' ? 'bag' : (unit === 'bales' ? 'bale' : unit));
                }
                
                // Check if the unit is a non-weight unit (bags, bales, etc.)
                const isNonWeightUnit = ['bags', 'bales'].includes(unit);
                
                // Show/hide weight equivalent field based on unit type
                weightEquivalentGroup.style.display = isNonWeightUnit ? 'block' : 'none';
                
                // If it's a non-weight unit, update the label and set default value if available
                if (isNonWeightUnit) {
                    const labelSpan = weightEquivalentGroup.querySelector('.unit-label');
                    labelSpan.textContent = unit.slice(0, -1); // Remove the 's' at the end
                    weightEquivalentInput.required = true;
                    weightEquivalentInput.disabled = false;
                    
                    // Set default value if available
                    if (feedData.weightPerKg) {
                        weightEquivalentInput.value = feedData.weightPerKg;
                        popup.querySelector('#weight-unit').value = 'kg'; // Default to kg
                    }
                } else {
                    weightEquivalentInput.required = false;
                    weightEquivalentInput.disabled = true;
                }
            }
        });
        
        // Form submission handling
        const form = popup.querySelector('form');
        const submitButton = form.querySelector('button[type="submit"]');
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Prevent double submission
            if (submitButton.disabled) {
                return;
            }
            
            // First validate the form
            if (!validateForm(form)) {
                return;
            }
            
            submitButton.disabled = true;
            
            try {
                const feedType = feedTypeSelect.value;
                const quantity = parseFloat(quantityInput.value);
                const pricePerUnit = parseFloat(priceInput.value);
                const supplier = popup.querySelector('#supplier').value.trim();
                const date = popup.querySelector('#purchase-date').value;
                const notes = popup.querySelector('#notes').value.trim();
                
                // Validate the feed type exists
                if (!feedCategories.includes(feedType)) {
                    throw new Error(`Invalid feed type: ${feedType}`);
                }
                
                // Generate a unique transaction ID
                const transactionId = `purchase_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                
                // Get current feed data with a fresh read from storage
                const feedInventoryStr = await mobileStorage.getItem('feedInventory');
                feedInventory = new Map(JSON.parse(feedInventoryStr || '[]'));
                let feedData = feedInventory.get(feedType);
                
                // If feed doesn't exist yet, initialize it
                if (!feedData) {
                    feedData = {
                        quantity: 0,
                        unit: 'bags', // Default unit for feed
                        threshold: 80,
                        price: pricePerUnit,
                        supplier: supplier || '',
                        lastUpdated: new Date().toISOString(),
                        transactions: []
                    };
                }
                
                // Get weight equivalent if applicable
                const isNonWeightUnit = ['bags', 'bales'].includes(feedData.unit);
                let weightPerKg = feedData.weightPerKg || 0;
                let weightInKg = 0;
                
                if (isNonWeightUnit && weightEquivalentGroup.style.display !== 'none') {
                    const weightEquivalent = parseFloat(weightEquivalentInput.value);
                    const weightUnit = popup.querySelector('#weight-unit').value;
                    
                    if (!weightEquivalent || weightEquivalent <= 0) {
                        alert('Please enter a valid weight per unit');
                        submitButton.disabled = false;
                        return;
                    }
                    
                    // Convert to kg
                    if (weightUnit === 'g') {
                        weightPerKg = weightEquivalent / 1000;
                    } else if (weightUnit === 'lb') {
                        weightPerKg = weightEquivalent * 0.45359237; // 1 lb = 0.45359237 kg
                    } else { // kg
                        weightPerKg = weightEquivalent;
                    }
                    
                    // Calculate total weight
                    weightInKg = quantity * weightPerKg;
                    
                    // Update weight per unit in feed data
                    feedData.weightPerKg = weightPerKg;
                } else if (feedData.unit === 'kg') {
                    weightInKg = quantity;
                } else if (feedData.unit === 'lb') {
                    weightInKg = quantity * 0.45359237; // Convert lb to kg
                }
                
                // Update feed data
                feedData.quantity += quantity;
                feedData.price = pricePerUnit; // Update to latest price per unit
                if (supplier) feedData.supplier = supplier;
                feedData.lastUpdated = new Date().toISOString();
                
                // Add transaction to feed data
                if (!feedData.transactions) {
                    feedData.transactions = [];
                }
                feedData.transactions.push({
                    id: transactionId,
                    type: 'purchase',
                    quantity: quantity,
                    weightInKg: weightInKg,
                    weightPerKg: weightPerKg,
                    pricePerUnit: pricePerUnit,
                    totalPrice: quantity * pricePerUnit,
                    date: date,
                    timestamp: new Date().toISOString()
                });
                
                // Save to feed inventory
                feedInventory.set(feedType, feedData);
                
                // Add transaction
                const transaction = {
                    id: transactionId,
                    type: 'purchase',
                    feedType,
                    quantity,
                    unit: feedData.unit,
                    weightInKg,
                    weightPerKg,
                    pricePerUnit,
                    totalPrice: quantity * pricePerUnit,
                    supplier,
                    date,
                    notes,
                    timestamp: new Date().toISOString()
                };
                
                feedTransactions.unshift(transaction);
                
                // Add to recent activities
                const activity = {
                    id: transactionId,
                    type: 'feed-purchase',
                    feedType,
                    quantity,
                    unit: feedData.unit,
                    weightInKg,
                    weightPerKg,
                    pricePerUnit,
                    totalPrice: quantity * pricePerUnit,
                    date,
                    timestamp: new Date().toISOString(),
                    description: `Purchased ${quantity} ${feedData.unit} of ${feedType} @ ${pricePerUnit} each${weightInKg ? ` (${weightInKg.toFixed(2)} kg)` : ''}`
                };
                
                recentActivities.unshift(activity);
                
                // Save state
                await saveState();
                
                // Update UI
                updateDisplays();
                
                // Close popup
                popup.remove();
                
                // Show success message
                alert(`Successfully recorded purchase of ${quantity} ${feedData.unit} of ${feedType} @ ${pricePerUnit} each`);
            } catch (error) {
                console.error('Error recording feed purchase:', error);
                alert('There was an error recording the purchase. Please try again.');
                submitButton.disabled = false;
            }
        });
        
        // Cancel button handling
        popup.querySelector('.cancel-btn').addEventListener('click', () => {
            popup.remove();
        });
    }
    
    async function showFeedUsedPopup() {
        // Only show popup if there are feed categories with inventory
        const feedsWithInventory = Array.from(feedInventory.entries())
            .filter(([_, data]) => data.quantity > 0);
            
        if (feedsWithInventory.length === 0) {
            alert('There is no feed in inventory. Please add feed purchases first.');
            showFeedPurchasedPopup();
            return;
        }
        
        // Load animal categories so "Used for" dropdown is populated (getAnimalCategoriesOptions is async)
        const animalCategoryOptions = await getAnimalCategoriesOptions();
        
        const popupContent = `
            <div class="popup-content">
                <h3>Record Feed Usage</h3>
                <form id="feed-usage-form">
                    <div class="form-group">
                        <label for="feed-type">Feed Type:</label>
                        <select id="feed-type" name="feed-type" required>
                            ${feedsWithInventory.map(([category, data]) => 
                                `<option value="${category}">${category} (${data.quantity} ${data.unit} available)</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="quantity">Quantity Used:</label>
                        <input type="number" id="quantity" name="quantity" min="0.1" step="0.1" required inputmode="decimal" pattern="[0-9]*(\.[0-9]+)?" autocomplete="off" placeholder="Enter quantity">
                    </div>
                    <div class="form-group weight-equivalent-group" style="display: none;">
                        <label for="weight-equivalent">Weight Equivalent:</label>
                        <div class="input-unit-group">
                            <input type="number" id="weight-equivalent" name="weight-equivalent" min="0.1" step="0.1" inputmode="decimal" pattern="[0-9]*(\.[0-9]+)?" autocomplete="off">
                            <select id="weight-unit" name="weight-unit" class="unit-select">
                                <option value="kg">kilograms (kg)</option>
                                <option value="g">grams (g)</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="animal-category">Used For:</label>
                        <select id="animal-category" name="animal-category" required>
                            <option value="">Select a category</option>
                            ${animalCategoryOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="usage-date">Usage Date:</label>
                        <input type="date" id="usage-date" name="usage-date" required value="${new Date().toISOString().split('T')[0]}">
                    </div>
                    <div class="form-group">
                        <label for="notes">Notes:</label>
                        <textarea id="notes" name="notes" rows="3"></textarea>
                    </div>
                    <div class="feed-usage-cost-estimate" style="margin-top: 15px; padding: 10px; border: 1px solid #ddd; border-radius: 5px; background-color: #f9f9f9;">
                        <h4 style="margin-top: 0;">Cost Estimate</h4>
                        <div id="cost-estimate-details">Please select a feed type and enter quantity</div>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="cancel-btn">Cancel</button>
                        <button type="submit" class="save-btn">Record Usage</button>
                    </div>
                </form>
            </div>
        `;
        
        const popup = createPopup(popupContent);
        
        // Get form elements
        const form = popup.querySelector('form');
        const feedTypeSelect = form.querySelector('#feed-type');
        const quantityInput = form.querySelector('#quantity');
        const weightEquivalentGroup = form.querySelector('.weight-equivalent-group');
        const weightEquivalentInput = form.querySelector('#weight-equivalent');
        const weightUnitSelect = form.querySelector('#weight-unit');
        const costEstimateDetails = form.querySelector('#cost-estimate-details');
        
        // Setup feed type change event
        feedTypeSelect.addEventListener('change', () => {
            updateUsageCostEstimate();
            
            const selectedFeed = feedTypeSelect.value;
            const feedData = feedInventory.get(selectedFeed);
            
            if (feedData) {
                // Update quantity label to include unit
                const quantityLabel = form.querySelector('label[for="quantity"]');
                quantityLabel.textContent = `Quantity Used (${feedData.unit}):`;
                
                // Check if the unit is a non-weight unit (bags, bales, etc.)
                const isNonWeightUnit = ['bags', 'bales'].includes(feedData.unit);
                
                // Show/hide weight equivalent field based on unit type
                weightEquivalentGroup.style.display = isNonWeightUnit ? 'block' : 'none';
                
                if (isNonWeightUnit) {
                    // Show the field but don't require it - it will be auto-calculated
                    weightEquivalentInput.required = false;
                    weightEquivalentInput.disabled = false;
                    
                    // If weight per unit is known, pre-calculate the equivalent based on current quantity
                    if (feedData.weightPerKg && quantityInput.value) {
                        const qty = parseFloat(quantityInput.value) || 0;
                        const weightPerUnit = parseFloat(feedData.weightPerKg) || 0;
                        if (qty > 0 && weightPerUnit > 0) {
                            // Auto-calculate the weight equivalent
                            weightEquivalentInput.value = (qty * weightPerUnit).toFixed(2);
                        }
                    }
                } else {
                    weightEquivalentInput.required = false;
                    weightEquivalentInput.disabled = true;
                }
            }
        });
        
        // Update cost estimate when quantity or weight equivalent changes
        quantityInput.addEventListener('input', updateUsageCostEstimate);
        weightEquivalentInput.addEventListener('input', function() {
            // Mark the field as manually modified by the user
            this.dataset.userModified = 'true';
            updateUsageCostEstimate();
        });
        weightUnitSelect.addEventListener('change', updateUsageCostEstimate);
        
        function updateUsageCostEstimate() {
            const selectedFeed = feedTypeSelect.value;
            const quantity = parseFloat(quantityInput.value) || 0;
            const feedData = feedInventory.get(selectedFeed);
            
            if (!feedData || !quantity) {
                costEstimateDetails.textContent = 'Please select a feed type and enter quantity';
                return;
            }
            
            // Get currency symbol
            const currency = worldCurrencies.find(c => c.code === selectedCurrency) || { symbol: 'R' };
            
            // Check if the unit is a non-weight unit (bags, bales, etc.)
            const isNonWeightUnit = ['bags', 'bales'].includes(feedData.unit);
            let totalCost = 0;
            let weightInKg = 0;
            let pricePerKg = 0;
            
            if (isNonWeightUnit) {
                // For non-weight units like bags/bales
                let weightEquivalent;
                const weightUnit = weightUnitSelect.value;
                
                // Auto-calculate weight if we have the per-unit weight data
                if (feedData.weightPerKg > 0 && 
                    (!weightEquivalentInput.value || !weightEquivalentInput.dataset.userModified)) {
                    
                    weightEquivalent = quantity * feedData.weightPerKg;
                    weightEquivalentInput.value = weightEquivalent.toFixed(2);
                } else if (weightEquivalentInput.value) {
                    // Use user-provided weight
                    weightEquivalent = parseFloat(weightEquivalentInput.value);
                } else {
                    costEstimateDetails.textContent = 'Please enter a valid weight equivalent';
                    return;
                }
                
                // Convert to kg
                if (weightUnit === 'g') {
                    weightInKg = weightEquivalent / 1000;
                } else { // kg
                    weightInKg = weightEquivalent;
                }
                
                // Calculate price per kg
                const weightPerUnit = feedData.weightPerKg || (weightEquivalent / quantity);
                pricePerKg = feedData.price / weightPerUnit;
                
            } else {
                // For weight units: directly use quantity
                weightInKg = feedData.unit === 'kg' ? quantity : quantity * 0.45359237; // Convert lb to kg if needed
                
                // Calculate price per kg
                if (feedData.unit === 'lb') {
                    pricePerKg = feedData.price * 2.20462; // 1 kg = 2.20462 lb
                } else {
                    pricePerKg = feedData.price;
                }
            }
            
            // Calculate total cost based on weight and price per kg
            totalCost = weightInKg * pricePerKg;
            
            // Update the cost estimate display
            costEstimateDetails.innerHTML = `
                <div><strong>Quantity:</strong> ${quantity} ${feedData.unit}</div>
                ${isNonWeightUnit ? `<div><strong>Weight equivalent:</strong> ${weightInKg.toFixed(2)} kg</div>` : ''}
                <div><strong>Price per kg:</strong> ${currency.symbol}${pricePerKg.toFixed(2)}</div>
                <div><strong>Unit price:</strong> ${currency.symbol}${feedData.price.toFixed(2)} per ${feedData.unit}</div>
                <div><strong>Estimated cost:</strong> ${currency.symbol}${totalCost.toFixed(2)}</div>
            `;
        }
        
        // Form submission handling
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // First validate the form
            if (!validateForm(form)) {
                return;
            }
            
            const feedType = feedTypeSelect.value;
            const quantity = parseFloat(quantityInput.value);
            const animalCategory = form.querySelector('#animal-category').value;
            const date = form.querySelector('#usage-date').value;
            const notes = form.querySelector('#notes').value;
            
            // Update inventory
            const feedData = feedInventory.get(feedType);
            if (!feedData) {
                alert('Feed type not found in inventory.');
                return;
            }
            
            if (quantity > feedData.quantity) {
                alert(`Not enough ${feedType} in inventory. Available: ${feedData.quantity} ${feedData.unit}`);
                return;
            }
            
            // Calculate weight equivalent and cost
            const isNonWeightUnit = ['bags', 'bales'].includes(feedData.unit);
            let weightInKg = 0;
            let totalCost = 0;
            
            if (isNonWeightUnit) {
                // Get weight equivalent - either user-entered or auto-calculated
                let weightEquivalent;
                const weightUnit = weightUnitSelect.value;
                
                if (weightEquivalentInput.value) {
                    // Use user-entered value if provided
                    weightEquivalent = parseFloat(weightEquivalentInput.value);
                } else if (feedData.weightPerKg) {
                    // Auto-calculate based on stored weight per unit
                    weightEquivalent = quantity * parseFloat(feedData.weightPerKg);
                } else {
                    alert('Please enter a valid weight equivalent');
                    return;
                }
                
                // Convert to kg
                if (weightUnit === 'g') {
                    weightInKg = (weightEquivalent * quantity) / 1000;
                } else { // kg
                    weightInKg = weightEquivalent;
                }
            } else {
                // For weight units: directly use quantity
                weightInKg = feedData.unit === 'kg' ? quantity : quantity * 0.45359237; // Convert lb to kg if needed
            }
            
            // Calculate cost
            let pricePerKg = 0;
            
            if (isNonWeightUnit) {
                // Use the same weight equivalent from above
                let weightEquivalent;
                
                if (weightEquivalentInput.value) {
                    weightEquivalent = parseFloat(weightEquivalentInput.value);
                } else if (feedData.weightPerKg) {
                    weightEquivalent = quantity * parseFloat(feedData.weightPerKg);
                } else {
                    alert('Please enter a valid weight equivalent');
                    return;
                }
                
                // Calculate price per kg (using per unit weight)
                const weightPerUnit = weightEquivalent / quantity; // Weight per single unit (bag/bale)
                pricePerKg = feedData.price / weightPerUnit;
                totalCost = weightInKg * pricePerKg;
            } else {
                // Price is already per kg/lb
                if (feedData.unit === 'lb') {
                    pricePerKg = feedData.price * 2.20462; // 1 kg = 2.20462 lb
                } else {
                    pricePerKg = feedData.price;
                }
                totalCost = weightInKg * pricePerKg;
            }
            
            // Update feed data
            feedData.quantity -= quantity;
            feedData.lastUpdated = new Date().toISOString();
            
            // Update the inventory
            feedInventory.set(feedType, feedData);
            
            // Create transaction record with enhanced cost data
            const transaction = {
                type: 'usage',
                feedType,
                quantity,
                unit: feedData.unit,
                weightInKg,
                pricePerKg,
                totalCost,
                unitPrice: feedData.price,
                animalCategory,
                date,
                notes,
                timestamp: new Date().toISOString()
            };
            
            // Add to transactions
            feedTransactions.unshift(transaction);
            
            // Update usage by animal
            const usageData = feedUsageByAnimal.get(animalCategory) || {
                totalUsage: 0,
                totalUsageKg: 0,
                totalCost: 0,
                feedTypes: {}
            };
            
            usageData.totalUsage += quantity;
            usageData.totalUsageKg = (usageData.totalUsageKg || 0) + weightInKg;
            usageData.totalCost = (usageData.totalCost || 0) + totalCost;
            
            if (!usageData.feedTypes[feedType]) {
                usageData.feedTypes[feedType] = {
                    quantity: 0,
                    weightInKg: 0,
                    cost: 0
                };
            }
            
            usageData.feedTypes[feedType].quantity += quantity;
            usageData.feedTypes[feedType].weightInKg = (usageData.feedTypes[feedType].weightInKg || 0) + weightInKg;
            usageData.feedTypes[feedType].cost = (usageData.feedTypes[feedType].cost || 0) + totalCost;
            
            feedUsageByAnimal.set(animalCategory, usageData);
            
            // Add to recent activities
            const activity = {
                type: 'feed-usage',
                feedType,
                quantity,
                unit: feedData.unit,
                weightInKg,
                pricePerKg,
                totalCost,
                animalCategory,
                date,
                timestamp: new Date().toISOString(),
                description: `Used ${quantity} ${feedData.unit} of ${feedType} for ${animalCategory} (Cost: ${worldCurrencies.find(c => c.code === selectedCurrency)?.symbol || 'R'}${totalCost.toFixed(2)})`
            };
            
            recentActivities.unshift(activity);
            
            // Save and update UI
            await saveState();
            updateDisplays();
            
            // Close popup
            popup.remove();
        });
        
        // Cancel button handling
        popup.querySelector('.cancel-btn').addEventListener('click', () => {
            popup.remove();
        });
    }
    
    async function confirmClearFeedData() {
        const confirmed = confirm(
            'Are you sure you want to clear all feed data? This will remove:\n\n' +
            '- All feed inventory\n' +
            '- All feed categories\n' +
            '- All feed transactions\n' +
            '- All feed calculations\n' +
            '- All feed-related activities\n\n' +
            'This action cannot be undone!'
        );
        
        if (confirmed) {
            try {
                // Clear all feed data
                feedInventory = new Map();
                feedCategories = [];
                feedTransactions = [];
                feedCalculations = [];
                
                // Get fresh copy of recent activities from storage
                const recentActivitiesStr = await mobileStorage.getItem('recentActivities');
                let recentActivities = [];
                
                if (recentActivitiesStr) {
                    try {
                        recentActivities = JSON.parse(recentActivitiesStr);
                    } catch (e) {
                        console.error('Error parsing recent activities:', e);
                        recentActivities = [];
                    }
                }
                
                // Filter out all feed-related activities
                const filteredActivities = recentActivities.filter(activity => {
                    // Check if activity exists and has a type
                    if (!activity || !activity.type) return true;
                    
                    // Filter out feed-purchase and feed-usage activities
                    if (activity.type === 'feed-purchase' || activity.type === 'feed-usage') {
                        return false;
                    }
                    
                    // Filter out activities that reference feedType
                    if (activity.feedType) {
                        return false;
                    }
                    
                    return true;
                });
                
                // Log the change for debugging
                console.log(`Filtered activities from ${recentActivities.length} to ${filteredActivities.length}`);
                
                // Save state to storage
                await mobileStorage.setItem('feedInventory', JSON.stringify(Array.from(feedInventory.entries())));
                await mobileStorage.setItem('feedCategories', JSON.stringify(feedCategories));
                await mobileStorage.setItem('feedTransactions', JSON.stringify(feedTransactions));
                await mobileStorage.setItem('feedCalculations', JSON.stringify(feedCalculations));
                await mobileStorage.setItem('recentActivities', JSON.stringify(filteredActivities));
                
                // Try to clear localStorage too
                try {
                    localStorage.setItem('feedCategories', JSON.stringify([]));
                } catch (e) {
                    console.error('Error updating localStorage:', e);
                }
                
                // Update UI
                updateDisplays();
                
                alert('All feed data has been cleared.');
                
                // Reload page to ensure everything is refreshed
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            } catch (error) {
                console.error('Error clearing feed data:', error);
                alert('There was an error clearing feed data. Please try again.');
            }
        }
    }
}); 
