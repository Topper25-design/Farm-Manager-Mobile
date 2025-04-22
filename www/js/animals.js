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
    let animalInventory = JSON.parse(await mobileStorage.getItem('animalInventory') || '{}');
    let animalCategories = JSON.parse(await mobileStorage.getItem('animalCategories') || '[]');
    let recentActivities = JSON.parse(await mobileStorage.getItem('recentActivities') || '[]');
    let selectedCurrency = await mobileStorage.getItem('selectedCurrency') || 'ZAR';
    let animalSales = JSON.parse(await mobileStorage.getItem('animalSales') || '[]');
    let animalPurchases = JSON.parse(await mobileStorage.getItem('animalPurchases') || '[]');
    let stockDiscrepancies = JSON.parse(await mobileStorage.getItem('stockDiscrepancies') || '[]');
    let stockCounts = [];  // Add stockCounts variable
    
    // Check for animal categories and initialize if needed
    await initializeAnimalCategories();
    
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
    
    // Setup event listeners
    setupEventListeners();
    
    // Initial display updates
    updateDisplays();
    
    // Add orientation change listener
    window.addEventListener('orientationchange', handleOrientationChange, { passive: true });
    
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
            }, { passive: true });
        }
        
        // Add explicit focus handling for input fields
        document.addEventListener('click', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
                // On iOS, explicitly focus the element after a slight delay
                setTimeout(() => {
                    e.target.focus();
                }, 100);
            }
        }, { passive: true });
        
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
        }, { passive: true });
            
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
        }, { passive: true });
        
        // Add metadata for better iOS keyboard handling
        const viewportMeta = document.querySelector('meta[name="viewport"]');
        if (viewportMeta) {
            // Update viewport meta to better handle iOS keyboard
            viewportMeta.setAttribute('content', 
                'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
        }
    }
    
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
                input.setAttribute('inputmode', 'numeric');
                input.setAttribute('pattern', '[0-9]*');
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
        
        // Automatically set up cancel button functionality for all popups
        const cancelBtn = popup.querySelector('.cancel-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                popup.remove();
            });
        }
        
        // Add Escape key support to close popup
        const handleEscapeKey = (event) => {
            if (event.key === 'Escape') {
                popup.remove();
                document.removeEventListener('keydown', handleEscapeKey);
            }
        };
        document.addEventListener('keydown', handleEscapeKey);
        
        // Ensure popup is automatically removed when a new popup is created
        popup.addEventListener('remove', () => {
            document.removeEventListener('keydown', handleEscapeKey);
        });
        
        // Focus the first input or select element to trigger keyboard
        setTimeout(() => {
            const firstInput = popup.querySelector('input:not([type="hidden"]), select, textarea');
            if (firstInput) {
                firstInput.focus();
                // On iOS, sometimes the keyboard doesn't appear, so we try focusing again
                if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
                    setTimeout(() => {
                        firstInput.blur();
                        firstInput.focus();
                    }, 100);
                }
            }
        }, 100); // Reduced delay for faster appearance
        
        return popup;
    }
    
    function setupEventListeners() {
        // Add Animal button
        document.getElementById('add-animal-btn')?.addEventListener('click', showAddAnimalPopup, { passive: true });
        
        // Stock Count button
        document.getElementById('stock-count-btn')?.addEventListener('click', showStockCountPopup, { passive: true });
        
        // Animal action buttons
        document.getElementById('move-animals-btn')?.addEventListener('click', showMoveAnimalPopup, { passive: true });
        document.getElementById('sell-animals-btn')?.addEventListener('click', showSellAnimalPopup, { passive: true });
        document.getElementById('purchase-animals-btn')?.addEventListener('click', showPurchaseAnimalPopup, { passive: true });
        document.getElementById('record-death-btn')?.addEventListener('click', showDeathPopup, { passive: true });
        document.getElementById('record-birth-btn')?.addEventListener('click', showBirthPopup, { passive: true });
        
        // Management buttons
        document.getElementById('undo-last-action-btn')?.addEventListener('click', showUndoLastActionPopup, { passive: true });
        document.getElementById('reverse-last-btn')?.addEventListener('click', showReverseLastAdditionPopup, { passive: true });
        document.getElementById('clear-animal-data-btn')?.addEventListener('click', confirmClearAnimalData, { passive: true });
    }
    
    function updateDisplays() {
        updateInventoryDisplay();
        updateTransactionsDisplay();
        updateDiscrepanciesDisplay();
        updateRecentCountsDisplay();
    }
    
    function updateInventoryDisplay() {
        const totalAnimalsElem = document.getElementById('total-animals');
        const inventoryBreakdownElem = document.getElementById('inventory-breakdown');
        
        // Calculate total animals with new structure
        const totalAnimals = Object.values(animalInventory).reduce((sum, value) => {
            // Handle both old (number) and new (object) formats
            if (typeof value === 'number') {
                return sum + value;
            } else if (value && typeof value === 'object') {
                return sum + (value.total || 0);
            }
            return sum;
        }, 0);
        
        // Update total count
        if (totalAnimalsElem) {
            totalAnimalsElem.textContent = totalAnimals;
        }
        
        // Update inventory breakdown
        if (inventoryBreakdownElem) {
            inventoryBreakdownElem.innerHTML = '';
            
            // Check if we have categories, if not show message directing to Add Livestock
            if (animalCategories.length === 0) {
                inventoryBreakdownElem.innerHTML = `
                    <div class="no-categories-message">
                        <p>No animal categories exist yet.</p>
                        <p>Click the "Add Livestock" button above to create your first category.</p>
                    </div>
                `;
                return;
            }
            
            Object.entries(animalInventory).forEach(([category, value]) => {
                const item = document.createElement('div');
                item.className = 'inventory-item';
                
                // Get the count based on the data structure
                let count;
                let locationInfo = '';
                
                if (typeof value === 'number') {
                    count = value;
                } else if (value && typeof value === 'object') {
                    count = value.total || 0;
                    
                    // Add location breakdown if available
                    if (value.locations && Object.keys(value.locations).length > 0) {
                        locationInfo = '<div class="location-breakdown">';
                        Object.entries(value.locations).forEach(([location, locationCount]) => {
                            locationInfo += `<div class="location-item"><span class="location-name">${location}:</span> <span class="location-count">${locationCount}</span></div>`;
                        });
                        locationInfo += '</div>';
                    }
                } else {
                    count = 0;
                }
                
                item.innerHTML = `
                    <div class="main-info">
                        <span class="category">${category}</span>
                        <span class="count">${count}</span>
                    </div>
                    ${locationInfo}
                `;
                inventoryBreakdownElem.appendChild(item);
            });
            
            if (Object.keys(animalInventory).length === 0) {
                inventoryBreakdownElem.innerHTML = '<p>No animals in inventory</p>';
            }
        }
    }
    
    function updateTransactionsDisplay() {
        const transactionsList = document.getElementById('transactions-list');
        if (!transactionsList) return;
        
        // Get all relevant transactions
        const transactions = [...recentActivities].filter(activity => 
            ['add', 'sell', 'buy', 'move', 'death', 'birth'].includes(activity.type)
        );
        
        if (transactions.length === 0) {
            transactionsList.innerHTML = '<p>No recent transactions</p>';
            return;
        }
        
        // Sort by date (newest first)
        transactions.sort((a, b) => new Date(b.timestamp || b.date) - new Date(a.timestamp || a.date));
        
        transactionsList.innerHTML = '';
        
        // Display most recent 5 transactions
        transactions.slice(0, 5).forEach(transaction => {
            const transactionItem = document.createElement('div');
            transactionItem.className = `transaction-item ${transaction.type}`;
            
            const date = new Date(transaction.timestamp || transaction.date).toLocaleDateString();
            let description = '';
            
            // Handle location information
            const locationInfo = transaction.location ? ` at ${transaction.location}` : '';
            
            switch (transaction.type) {
                case 'add':
                    description = `Added ${transaction.quantity} ${transaction.category}${locationInfo}`;
                    break;
                case 'sell':
                    description = `Sold ${transaction.quantity} ${transaction.category}${locationInfo}`;
                    break;
                case 'buy':
                    description = `Purchased ${transaction.quantity} ${transaction.category}${locationInfo}`;
                    break;
                case 'move':
                    if (transaction.fromCategory && transaction.toCategory) {
                        // Handle category moves
                        const fromLocationInfo = transaction.fromLocation ? ` (${transaction.fromLocation})` : '';
                        const toLocationInfo = transaction.toLocation ? ` (${transaction.toLocation})` : '';
                        description = `Moved ${transaction.quantity} from ${transaction.fromCategory}${fromLocationInfo} to ${transaction.toCategory}${toLocationInfo}`;
                    } else if (transaction.fromLocation && transaction.toLocation) {
                        // Handle location moves
                        description = `Moved ${transaction.quantity} ${transaction.category} from ${transaction.fromLocation} to ${transaction.toLocation}`;
                    } else {
                        description = `Moved ${transaction.quantity} ${transaction.category || 'animals'}`;
                    }
                    break;
                case 'death':
                    description = `Recorded death of ${transaction.quantity} ${transaction.category}${locationInfo}`;
                    break;
                case 'birth':
                    description = `Recorded birth of ${transaction.quantity} ${transaction.category}${locationInfo}`;
                    break;
            }
            
            let priceInfo = '';
            if (transaction.price) {
                const currency = worldCurrencies.find(c => c.code === (transaction.currency || selectedCurrency));
                const symbol = currency ? currency.symbol : '';
                const totalPrice = transaction.price * transaction.quantity;
                priceInfo = `
                    <span class="transaction-price">Price: ${symbol}${transaction.price.toFixed(2)} each</span>
                    <span class="transaction-total ${transaction.type === 'sell' ? 'income' : 'expense'}">
                        Total: ${symbol}${totalPrice.toFixed(2)}
                    </span>
                `;
            }
            
            transactionItem.innerHTML = `
                <div class="transaction-details">
                    <span class="transaction-date">${date}</span>
                    <span class="transaction-category">${
                        transaction.type === 'move' ? 'Stock Moved' : 
                        transaction.type === 'sell' ? 'Stock Sold' : 
                        transaction.type === 'buy' ? 'Stock Purchased' : 
                        transaction.type === 'death' ? 'Stock Deaths' : 
                        transaction.type === 'birth' ? 'Stock Births' : 
                        transaction.category
                    }</span>
                    <span class="transaction-description">${description}</span>
                    ${priceInfo}
                </div>
            `;
            
            transactionsList.appendChild(transactionItem);
        });
    }
    
    function updateDiscrepanciesDisplay() {
        const discrepanciesElem = document.getElementById('discrepancies-list');
        if (!discrepanciesElem) return;
        
        // Filter for unresolved discrepancies
        const unresolvedDiscrepancies = stockDiscrepancies.filter(d => !d.resolved);
        
        if (unresolvedDiscrepancies.length === 0) {
            discrepanciesElem.innerHTML = '<p class="no-data">No active stock discrepancies</p>';
            return;
        }
        
        // Sort by date, newest first
        unresolvedDiscrepancies.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        discrepanciesElem.innerHTML = '';
        
        // Show most recent discrepancies
        unresolvedDiscrepancies.forEach(discrepancy => {
            const item = document.createElement('div');
            item.className = 'discrepancy-item';
            
            const date = new Date(discrepancy.timestamp).toLocaleDateString();
            const differenceClass = discrepancy.difference > 0 ? 'positive-diff' : 'negative-diff';
            const differencePrefix = discrepancy.difference > 0 ? '+' : '';
            
            // Find any resolution attempts for this category
            const resolutionAttempts = recentActivities.filter(activity => 
                activity.type === 'stock-count' && 
                activity.category === discrepancy.category &&
                new Date(activity.timestamp) > new Date(discrepancy.timestamp)
            );
            
            // Get the latest resolution attempt if any
            const latestResolution = resolutionAttempts.length > 0 ? 
                resolutionAttempts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0] : null;
            
            item.innerHTML = `
                <div class="discrepancy-header">
                    <span class="discrepancy-category">${discrepancy.category}</span>
                    <span class="discrepancy-date">${date}</span>
                </div>
                <div class="discrepancy-details">
                    <div class="expected">Expected: ${discrepancy.expected}</div>
                    <div class="actual">Actual: ${discrepancy.actual}</div>
                    <div class="difference ${differenceClass}">
                        Difference: ${differencePrefix}${discrepancy.difference}
                    </div>
                    ${latestResolution ? `
                        <div class="resolution-attempt">
                            <div class="resolution-count">Latest Count: ${latestResolution.actual}</div>
                            <div class="counter-name">Counted by: ${latestResolution.counterName || 'Unknown'}</div>
                            <div class="resolution-date">Date: ${new Date(latestResolution.timestamp).toLocaleDateString()}</div>
                        </div>
                    ` : ''}
                    ${discrepancy.notes ? `<div class="notes">Notes: ${discrepancy.notes}</div>` : ''}
                </div>
            `;
            
            discrepanciesElem.appendChild(item);
        });
    }
    
    function updateRecentCountsDisplay() {
        const recentCountsList = document.getElementById('recent-counts-list');
        if (!recentCountsList) return;
        
        // Get stock count activities from recentActivities
        const stockCounts = recentActivities.filter(activity => 
            activity.type === 'stock-count' || activity.type === 'resolution'
        );
        
        if (stockCounts.length === 0) {
            recentCountsList.innerHTML = '<p class="no-data">No recent stock counts</p>';
            return;
        }
        
        // Sort by date, most recent first
        const sortedCounts = [...stockCounts].sort((a, b) => {
            const dateA = new Date(a.timestamp || a.date);
            const dateB = new Date(b.timestamp || b.date);
            return dateB - dateA;
        });
        
        recentCountsList.innerHTML = '';
        
        // Remove duplicates by category + date (keep only the most recent count for each category on the same day)
        const countsByDay = {};
        sortedCounts.forEach(count => {
            const dateStr = new Date(count.timestamp || count.date).toLocaleDateString();
            const key = `${dateStr}-${count.category}`;
            if (!countsByDay[key]) {
                countsByDay[key] = count;
            }
        });
        
        const dedupedCounts = Object.values(countsByDay);
        
        // Display the most recent counts
        dedupedCounts.slice(0, 10).forEach(count => {
            const countItem = document.createElement('div');
            countItem.className = 'count-item';
            
            // Format the date
            const countDate = new Date(count.timestamp || count.date);
            const date = countDate.toLocaleDateString();
            
            if (count.type === 'resolution') {
                // This is a discrepancy resolution
                countItem.classList.add('resolution');
                
                countItem.innerHTML = `
                    <div class="count-date">${date}</div>
                    <div class="count-category">${count.category}</div>
                    <div class="count-details">
                        Resolved discrepancy: ${count.description || 'Stock count discrepancy resolved'}
                    </div>
                    ${count.notes ? `<div class="count-notes">Notes: ${count.notes}</div>` : ''}
                    ${count.counterName ? `<div class="counter-name">Counted by: ${count.counterName}</div>` : ''}
                `;
            } else {
                // Regular stock count
                const expected = count.expected || 0;
                const actual = count.actual || count.quantity || 0;
                const difference = actual - expected;
                const differenceClass = difference === 0 ? 'match' : (difference > 0 ? 'surplus' : 'shortage');
                const counterName = count.counterName || 'Unknown';
                const locationInfo = count.location ? ` at ${count.location}` : '';
                
                // Check if this count resolved a discrepancy
                const resolvedDiscrepancy = difference === 0 && 
                    stockDiscrepancies.some(d => 
                        d.category === count.category && 
                        d.resolved && 
                        d.resolvedDate === count.timestamp
                    );
                
                countItem.innerHTML = `
                    <div class="count-date">${date}</div>
                    <div class="count-category">${count.category}${locationInfo}</div>
                    <div class="count-details">
                        Expected: ${expected}, 
                        Actual: ${actual}, 
                        <span class="diff ${differenceClass}">
                            Diff: ${difference > 0 ? '+' : ''}${difference}
                        </span>
                        ${resolvedDiscrepancy ? '<span class="resolved-badge">Resolved discrepancy</span>' : ''}
                    </div>
                    ${count.notes ? `<div class="count-notes">Notes: ${count.notes}</div>` : ''}
                    <div class="counter-name">Counted by: ${counterName}</div>
                `;
            }
            
            recentCountsList.appendChild(countItem);
        });
    }
    
    async function getAnimalCategories() {
        // First try to get from Capacitor storage
        const categoriesStr = await mobileStorage.getItem('animalCategories');
        
        if (categoriesStr) {
            try {
                const parsedCategories = JSON.parse(categoriesStr);
                if (Array.isArray(parsedCategories) && parsedCategories.length > 0) {
                    return parsedCategories;
                }
            } catch (e) {
                console.error('Error parsing animal categories:', e);
            }
        }
        
        // Try to extract categories from inventory if no saved categories
        if (animalInventory && Object.keys(animalInventory).length > 0) {
            const categoriesFromInventory = Object.keys(animalInventory);
            // Save these categories for future use
            await mobileStorage.setItem('animalCategories', JSON.stringify(categoriesFromInventory));
            return categoriesFromInventory;
        }
        
        // Return empty array if no categories found
        return [];
    }
    
    async function initializeAnimalCategories() {
        // Check if we already have categories
        const categories = await getAnimalCategories();
        
        // Update localStorage for dashboard.js to use
        localStorage.setItem('animalCategories', JSON.stringify(categories));
        
        // We no longer automatically show the popup, but we'll update the UI to show a message
        // if (!categories || categories.length === 0) {
        //     showCreateCategoryPopup();
        // }
    }
    
    function showCreateCategoryPopup() {
        const popupContent = `
            <div class="popup-content">
                <h3>Create Animal Category</h3>
                <p>You don't have any animal categories yet. Please create your first category.</p>
                <form id="create-category-form">
                    <div class="form-group">
                        <label for="new-category">Category Name:</label>
                        <input type="text" id="new-category" name="new-category" placeholder="Enter category name" required>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="save-btn">Create Category</button>
                    </div>
                </form>
            </div>
        `;
        
        const popup = createPopup(popupContent);
        
        // Form submission handling
        const form = popup.querySelector('form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const categoryName = popup.querySelector('#new-category').value.trim();
            if (!categoryName) {
                alert('Please enter a category name');
                return;
            }
            
            // Save the new category
            const categories = [];
            categories.push(categoryName);
            
            // Save to both mobileStorage and localStorage for consistency
            await mobileStorage.setItem('animalCategories', JSON.stringify(categories));
            localStorage.setItem('animalCategories', JSON.stringify(categories));
            
            // Update our local copy of the categories
            animalCategories = categories;
            
            // Close popup and update display
            popup.remove();
            updateDisplays();
        });
    }
    
    // Store the user's input when they go to manage properties
    let cachedAddAnimalData = {
        category: '',
        newCategory: '',
        quantity: 1,
        date: '',
        notes: ''
    };
    
    async function showAddAnimalPopup() {
        // Ensure we have the latest farm properties before showing the popup
        await initializeProperties();
        console.log("showAddAnimalPopup - Current farmProperties:", farmProperties);
        
        // Create popup content HTML
        const categoriesHTML = animalCategories.map(category => `<option value="${category}">${category}</option>`).join('');
        
        // Create the locations dropdown with the latest properties
        const locationsHTML = farmProperties.map(property => `<option value="${property}">${property}</option>`).join('');
        
        // Get today's date in ISO format
        const today = new Date().toISOString().split('T')[0];
        
        // Use cached values if available, otherwise use defaults
        const selectedCategory = cachedAddAnimalData.category || '';
        const newCategoryValue = cachedAddAnimalData.newCategory || '';
        const quantityValue = cachedAddAnimalData.quantity || 1;
        const dateValue = cachedAddAnimalData.date || today;
        const notesValue = cachedAddAnimalData.notes || '';
        
        // Determine if we should show the new category input
        const showNewCategoryStyle = selectedCategory === 'new' ? 'display: block;' : 'display: none;';
        
        const popupContent = `
            <div class="popup-content">
                <h3>Add Livestock</h3>
                <form id="add-form">
                    <div class="form-group">
                        <label for="category">Animal Category:</label>
                        <select id="category" required>
                            <option value="" disabled ${selectedCategory ? '' : 'selected'}>Select category</option>
                            ${categoriesHTML}
                            <option value="new" ${selectedCategory === 'new' ? 'selected' : ''}>+ Add New Category</option>
                        </select>
                    </div>
                    <div class="form-group new-category-input" style="${showNewCategoryStyle}">
                        <label for="new-category">New Category:</label>
                        <input type="text" id="new-category" placeholder="Enter new category name" inputmode="text" autocomplete="off" value="${newCategoryValue}">
                    </div>
                    <div class="form-group">
                        <label for="quantity">Quantity:</label>
                        <input type="number" id="quantity" value="${quantityValue}" min="1" required>
                    </div>
                    <div class="form-group">
                        <label for="location">Location:</label>
                        <select id="location" required>
                            <option value="" selected>Select location</option>
                            ${locationsHTML}
                            <option value="manage">+ Manage Properties</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="date">Date:</label>
                        <input type="date" id="date" value="${dateValue}" required>
                    </div>
                    <div class="form-group">
                        <label for="notes">Notes:</label>
                        <textarea id="notes" rows="2" placeholder="Optional notes">${notesValue}</textarea>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="cancel-btn">Cancel</button>
                        <button type="submit" class="save-btn">Add</button>
                    </div>
                </form>
            </div>
        `;
        
        const popup = createPopup(popupContent);
        
        // Get form elements
        const form = popup.querySelector('#add-form');
        const categorySelect = popup.querySelector('#category');
        const newCategoryInput = popup.querySelector('.new-category-input');
        const newCategoryField = popup.querySelector('#new-category');
        const quantityField = popup.querySelector('#quantity');
        const locationSelect = popup.querySelector('#location');
        const dateField = popup.querySelector('#date');
        const notesField = popup.querySelector('#notes');
        const cancelBtn = popup.querySelector('.cancel-btn');
        
        // If we have a cached category value, select it
        if (selectedCategory && selectedCategory !== 'new') {
            // Find and select the option with the cached value
            Array.from(categorySelect.options).forEach(option => {
                if (option.value === selectedCategory) {
                    option.selected = true;
                }
            });
        }
        
        // Handle new category option
        categorySelect.addEventListener('change', () => {
            if (categorySelect.value === 'new') {
                newCategoryInput.style.display = 'block';
                
                // Focus the new category input after a short delay
                setTimeout(() => {
                    const inputField = newCategoryInput.querySelector('input');
                    if (inputField) {
                        inputField.focus();
                        
                        // Force keyboard to show on mobile devices
                        if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
                            inputField.blur();  // First blur
                            inputField.focus(); // Then focus again to ensure keyboard appears
                        }
                    }
                }, 100);
            } else {
                newCategoryInput.style.display = 'none';
            }
        });
        
        // Handle manage properties option
        locationSelect.addEventListener('change', () => {
            if (locationSelect.value === 'manage') {
                // Save current form data
                cachedAddAnimalData = {
                    category: categorySelect.value,
                    newCategory: newCategoryField.value,
                    quantity: quantityField.value,
                    date: dateField.value,
                    notes: notesField.value
                };
                
                console.log('Saved form data:', cachedAddAnimalData);
                
                // Open properties management popup
                popup.remove(); // Close the current popup
                showManagePropertiesPopup().then(() => {
                    showAddAnimalPopup();
                });
            }
        });
        
        // Explicitly handle cancel button click
        cancelBtn.addEventListener('click', () => {
            // Clear cached data when cancel is clicked
            cachedAddAnimalData = {
                category: '',
                newCategory: '',
                quantity: 1,
                date: '',
                notes: ''
            };
            
            popup.remove();
        });
        
        // Form submission handling
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Disable the submit button to prevent double-clicks
            const submitBtn = form.querySelector('.save-btn');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Adding...';
            
            try {
                // Get values from form
                const quantity = parseInt(popup.querySelector('#quantity').value, 10);
                const date = popup.querySelector('#date').value;
                const notes = popup.querySelector('#notes').value.trim();
                const location = locationSelect.value === 'manage' ? '' : locationSelect.value;
                
                // Handle category (could be new or existing)
                let category;
                if (categorySelect.value === 'new') {
                    category = popup.querySelector('#new-category').value.trim();
                    if (!category) {
                        alert('Please enter a new category name');
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Add';
                        return;
                    }
                    
                    // Add new category to saved categories
                    if (!animalCategories.includes(category)) {
                        animalCategories.push(category);
                        await mobileStorage.setItem('animalCategories', JSON.stringify(animalCategories));
                        // Also update localStorage for dashboard.js
                        localStorage.setItem('animalCategories', JSON.stringify(animalCategories));
                    }
                } else {
                    category = categorySelect.value;
                }
                
                // Create transaction record
                const transaction = {
                    type: 'add',
                    category,
                    quantity,
                    location,
                    date,
                    timestamp: new Date().toISOString()
                };
                
                if (notes) {
                    transaction.notes = notes;
                }
                
                // Add transaction to the list
                recentActivities.unshift(transaction);
                await mobileStorage.setItem('recentActivities', JSON.stringify(recentActivities));
                
                // Update inventory
                if (!animalInventory[category]) {
                    // Initialize with new format
                    animalInventory[category] = {
                        total: quantity,
                        locations: {}
                    };
                    
                    // Add location if provided
                    if (location) {
                        animalInventory[category].locations[location] = quantity;
                    } else {
                        animalInventory[category].locations['Unspecified'] = quantity;
                    }
                } else {
                    // Convert old format to new format if needed
                    if (typeof animalInventory[category] === 'number') {
                        animalInventory[category] = {
                            total: animalInventory[category] + quantity,
                            locations: {
                                'Unspecified': animalInventory[category]
                            }
                        };
                        
                        // Add location if provided
                        if (location) {
                            animalInventory[category].locations[location] = quantity;
                        } else {
                            animalInventory[category].locations['Unspecified'] += quantity;
                        }
                    } else {
                        // Update new format
                        animalInventory[category].total += quantity;
                        
                        // Update location
                        if (location) {
                            if (!animalInventory[category].locations[location]) {
                                animalInventory[category].locations[location] = 0;
                            }
                            animalInventory[category].locations[location] += quantity;
                        } else {
                            // Default to Unspecified location
                            if (!animalInventory[category].locations['Unspecified']) {
                                animalInventory[category].locations['Unspecified'] = 0;
                            }
                            animalInventory[category].locations['Unspecified'] += quantity;
                        }
                    }
                }
                
                // Save updated inventory
                await mobileStorage.setItem('animalInventory', JSON.stringify(animalInventory));
                
                // Update displays
                updateDisplays();
                
                // Close the popup
                popup.remove();
            } catch (error) {
                console.error('Error adding livestock:', error);
                alert('There was an error adding livestock. Please try again.');
                
                // Re-enable the submit button
                submitBtn.disabled = false;
                submitBtn.textContent = 'Add';
            }
            
            // Clear cached data after successful form submission
            cachedAddAnimalData = {
                category: '',
                newCategory: '',
                quantity: 1,
                date: '',
                notes: ''
            };
        });
    }
    
    function showSellAnimalPopup() {
        // We no longer redirect to create category popup
        // Instead we check if there are animals in inventory
        if (Object.keys(animalInventory).length === 0) {
            alert('No animals in inventory to sell');
            return;
        }
        
        const popupContent = `
            <div class="popup-content">
                <h3>Sell Animals</h3>
                <form id="sell-form">
                    <div class="form-group">
                        <label for="category">Category:</label>
                        <select id="category" name="category" required>
                            <option value="" disabled selected>Select a category</option>
                            ${Object.keys(animalInventory).map(category => {
                                // Get count based on structure
                                const count = typeof animalInventory[category] === 'number' ? 
                                    animalInventory[category] : 
                                    (animalInventory[category]?.total || 0);
                                return `<option value="${category}">${category} (${count} available)</option>`;
                            }).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="quantity">Quantity:</label>
                        <input type="number" id="quantity" name="quantity" min="1" value="1" required>
                    </div>
                    <div class="form-group">
                        <label for="location">Location:</label>
                        <select id="location" name="location" required>
                            <option value="" selected>Select location</option>
                            ${farmProperties.map(property => 
                                `<option value="${property}">${property}</option>`
                            ).join('')}
                            <option value="manage">+ Manage Properties</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="price">Price per Animal (${worldCurrencies.find(c => c.code === selectedCurrency)?.symbol || 'R'}):</label>
                        <input type="number" id="price" name="price" step="0.01" min="0" required>
                    </div>
                    <div class="form-group">
                        <label for="buyer">Buyer:</label>
                        <input type="text" id="buyer" name="buyer">
                    </div>
                    <div class="form-group">
                        <label for="sell-date">Date:</label>
                        <input type="date" id="sell-date" name="sell-date" required value="${new Date().toISOString().split('T')[0]}">
                    </div>
                    <div class="form-actions">
                        <button type="button" class="cancel-btn">Cancel</button>
                        <button type="submit" class="save-btn">Sell</button>
                    </div>
                </form>
            </div>
        `;
        
        const popup = createPopup(popupContent);
        
        // Get form elements
        const form = popup.querySelector('#sell-form');
        const categorySelect = popup.querySelector('#category');
        const quantityInput = popup.querySelector('#quantity');
        const locationSelect = popup.querySelector('#location');
        const cancelBtn = popup.querySelector('.cancel-btn');
        
        // Explicitly handle cancel button click
        cancelBtn.addEventListener('click', () => {
            popup.remove();
        });
        
        // Update location options when category changes
        categorySelect.addEventListener('change', () => {
            const category = categorySelect.value;
            const categoryData = animalInventory[category];
            
            // Populate location dropdown with all farm properties
            locationSelect.innerHTML = '<option value="">Select location (or leave blank)</option>';
            farmProperties.forEach(property => {
                // Check if this property has animals of this category
                let locationCount = 0;
                if (categoryData && typeof categoryData === 'object' && categoryData.locations && categoryData.locations[property]) {
                    locationCount = categoryData.locations[property];
                }
                locationSelect.innerHTML += `<option value="${property}">${property}${locationCount > 0 ? ` (${locationCount} available)` : ''}</option>`;
            });
            locationSelect.innerHTML += '<option value="manage">+ Manage Properties</option>';
            
            // Update max quantity based on the data structure
            let availableQuantity = 0;
            if (typeof categoryData === 'number') {
                availableQuantity = categoryData;
            } else if (categoryData && typeof categoryData === 'object') {
                availableQuantity = categoryData.total || 0;
            }
            
            quantityInput.max = availableQuantity;
            quantityInput.value = Math.min(quantityInput.value, availableQuantity);
        });
        
        // Handle manage properties option in location dropdown
        locationSelect.addEventListener('change', () => {
            if (locationSelect.value === 'manage') {
                // Save current form state to restore later
                const formValues = {
                    category: categorySelect.value,
                    quantity: quantityInput.value,
                    price: popup.querySelector('#price').value,
                    buyer: popup.querySelector('#buyer').value,
                    date: popup.querySelector('#sell-date').value
                };
                
                // Store form state in session storage
                sessionStorage.setItem('sellFormValues', JSON.stringify(formValues));
                
                // Open properties management popup
                popup.remove(); // Close the current popup
                showManagePropertiesPopup().then(() => {
                    showSellAnimalPopup();
                    
                    // Restore values manually since handleRestore is causing issues
                    try {
                        const savedValues = JSON.parse(sessionStorage.getItem('sellFormValues'));
                        if (savedValues) {
                            const newPopup = document.querySelector('.popup');
                            if (newPopup) {
                                // Restore category and update location dropdown
                                if (savedValues.category) {
                                    const categoryField = newPopup.querySelector('#category');
                                    if (categoryField) {
                                        categoryField.value = savedValues.category;
                                        const event = new Event('change');
                                        categoryField.dispatchEvent(event);
                                    }
                                }
                                
                                if (savedValues.quantity) {
                                    const quantityField = newPopup.querySelector('#quantity');
                                    if (quantityField) {
                                        quantityField.value = savedValues.quantity;
                                    }
                                }
                                
                                if (savedValues.price) {
                                    const priceField = newPopup.querySelector('#price');
                                    if (priceField) {
                                        priceField.value = savedValues.price;
                                    }
                                }
                                
                                if (savedValues.buyer) {
                                    const buyerField = newPopup.querySelector('#buyer');
                                    if (buyerField) {
                                        buyerField.value = savedValues.buyer;
                                    }
                                }
                                
                                if (savedValues.date) {
                                    const dateField = newPopup.querySelector('#sell-date');
                                    if (dateField) {
                                        dateField.value = savedValues.date;
                                    }
                                }
                            }
                        }
                    } catch (error) {
                        console.error("Error restoring form values:", error);
                    }
                });
            }
        });
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Disable the submit button to prevent double-clicks
            const submitBtn = form.querySelector('.save-btn');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Processing...';
            
            try {
            const category = categorySelect.value;
            const quantity = parseInt(quantityInput.value, 10);
            const location = locationSelect.value;
            const price = parseFloat(popup.querySelector('#price').value);
            const buyer = popup.querySelector('#buyer').value.trim();
            const date = popup.querySelector('#sell-date').value;
            
            // Check if there are enough animals
            const categoryData = animalInventory[category];
            let availableQuantity = 0;
            
            if (typeof categoryData === 'number') {
                availableQuantity = categoryData;
            } else if (categoryData && typeof categoryData === 'object') {
                if (location && categoryData.locations && categoryData.locations[location]) {
                    // If specific location, check that location's count
                    availableQuantity = categoryData.locations[location];
                } else {
                    // If no specific location, use total
                    availableQuantity = categoryData.total || 0;
                }
            }
            
            if (quantity > availableQuantity) {
                const locationText = location ? ` in ${location}` : '';
                alert(`Not enough ${category}${locationText}. Available: ${availableQuantity}`);
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Sell';
                return;
            }
            
            // Update inventory
            if (typeof categoryData === 'number') {
                // Convert old format to new format
                animalInventory[category] = {
                    total: categoryData - quantity,
                    locations: {}
                };
                if (animalInventory[category].total <= 0) {
                    delete animalInventory[category];
                }
            } else {
                // Update total
                categoryData.total -= quantity;
                
                // Update specific location if provided
                if (location) {
                    categoryData.locations[location] -= quantity;
                    
                    // Remove location if count is 0
                    if (categoryData.locations[location] <= 0) {
                        delete categoryData.locations[location];
                    }
                } else {
                    // If no specific location, reduce from 'Unspecified'
                    const unspecifiedLocation = 'Unspecified';
                    if (!categoryData.locations[unspecifiedLocation]) {
                        categoryData.locations[unspecifiedLocation] = categoryData.total + quantity;
                    }
                    categoryData.locations[unspecifiedLocation] -= quantity;
                    
                    if (categoryData.locations[unspecifiedLocation] <= 0) {
                        delete categoryData.locations[unspecifiedLocation];
                    }
                }
                
                    // Remove category if no locations or count is 0
                    if (categoryData.total <= 0 || Object.keys(categoryData.locations).length === 0) {
                    delete animalInventory[category];
                }
            }
            
                // Save updated inventory
            await mobileStorage.setItem('animalInventory', JSON.stringify(animalInventory));
            
                // Calculate total revenue
                const totalRevenue = price * quantity;
                
                // Add to sales transactions
                const transaction = {
                type: 'sell',
                category,
                quantity,
                price,
                    revenue: totalRevenue,
                buyer,
                    location,
                date,
                timestamp: new Date().toISOString()
            };
            
                recentActivities.unshift(transaction);
            await mobileStorage.setItem('recentActivities', JSON.stringify(recentActivities));
            
            // Update UI
            updateDisplays();
            
            // Close popup
            popup.remove();
            } catch (error) {
                console.error('Error selling animals:', error);
                alert('There was an error processing the sale. Please try again.');
                
                // Re-enable the submit button
                submitBtn.disabled = false;
                submitBtn.textContent = 'Sell';
            }
        });
    }
    
    async function showMoveAnimalPopup() {
        // We no longer redirect to create category popup
        // Instead we check if there are animals in inventory
        if (Object.keys(animalInventory).length === 0) {
            alert('No animals in inventory to move');
            return;
        }
        
        // Make sure farmProperties is initialized
        // Reload from storage to ensure we have the latest data
        try {
            const propertiesStr = await mobileStorage.getItem('farmProperties');
            if (propertiesStr) {
                farmProperties = JSON.parse(propertiesStr);
            }
        } catch (error) {
            console.error('Error loading farm properties:', error);
            if (!farmProperties || farmProperties.length === 0) {
                farmProperties = [];
            }
        }
        
        // Get the properties/locations options for dropdowns
        const propertiesOptions = farmProperties.map(property => 
            `<option value="${property}">${property}</option>`
        ).join('');
        
        const popupContent = `
            <div class="popup-content">
                <h3>Move Animals</h3>
                <form id="move-form">
                    <div class="form-group">
                        <label for="from-category">From Category:</label>
                        <select id="from-category" name="from-category" required>
                            <option value="" disabled selected>Select source category</option>
                            ${Object.keys(animalInventory).map(category => {
                                // Get count based on structure
                                const count = typeof animalInventory[category] === 'number' ? 
                                    animalInventory[category] : 
                                    (animalInventory[category]?.total || 0);
                                return `<option value="${category}">${category} (${count} available)</option>`;
                            }).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="from-location">From Location:</label>
                        <select id="from-location" name="from-location" required>
                            <option value="" selected>Select source location</option>
                            ${farmProperties.map(property => 
                                `<option value="${property}">${property}</option>`
                            ).join('')}
                            <option value="manage">+ Manage Properties</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="quantity">Quantity:</label>
                        <input type="number" id="quantity" name="quantity" min="1" value="1" required>
                    </div>
                    <div class="form-group">
                        <label for="to-category">To Category:</label>
                        <select id="to-category" name="to-category" required>
                            <option value="" disabled selected>Select destination category</option>
                            ${animalCategories.map(category => 
                                `<option value="${category}">${category}</option>`
                            ).join('')}
                            <option value="new">+ Add New Category</option>
                        </select>
                    </div>
                    <div class="form-group new-category-input" style="display: none;">
                        <label for="new-category">New Category:</label>
                        <input type="text" id="new-category" name="new-category" placeholder="Enter new category name" inputmode="text" autocomplete="off">
                    </div>
                    <div class="form-group">
                        <label for="to-location">To Location:</label>
                        <select id="to-location" name="to-location" required>
                            <option value="" selected>Select destination location</option>
                            ${propertiesOptions}
                            <option value="manage">+ Manage Properties</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="move-date">Date:</label>
                        <input type="date" id="move-date" name="move-date" required value="${new Date().toISOString().split('T')[0]}">
                    </div>
                    <div class="form-group">
                        <label for="notes">Notes:</label>
                        <textarea id="notes" name="notes" rows="2" placeholder="Optional notes about this movement"></textarea>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="cancel-btn">Cancel</button>
                        <button type="submit" class="save-btn">Move</button>
                    </div>
                </form>
            </div>
        `;
        
        const popup = createPopup(popupContent);
        
        // Form submission handling
        const form = popup.querySelector('form');
        const fromCategorySelect = popup.querySelector('#from-category');
        const toCategorySelect = popup.querySelector('#to-category');
        const newCategoryInput = popup.querySelector('.new-category-input');
        const quantityInput = popup.querySelector('#quantity');
        const fromLocationSelect = popup.querySelector('#from-location');
        const toLocationSelect = popup.querySelector('#to-location');
        
        // Update location dropdowns initially if a category is already selected
        if (fromCategorySelect.value) {
            const event = new Event('change');
            fromCategorySelect.dispatchEvent(event);
        }
        
        // Update from location options when category changes
        fromCategorySelect.addEventListener('change', () => {
            const category = fromCategorySelect.value;
            const categoryData = animalInventory[category];
            
            // Update max quantity based on selection
            let availableQuantity = 0;
            if (typeof categoryData === 'number') {
                availableQuantity = categoryData;
            } else if (categoryData && typeof categoryData === 'object') {
                availableQuantity = categoryData.total || 0;
            }
            
            quantityInput.max = availableQuantity;
            quantityInput.value = Math.min(quantityInput.value, availableQuantity);
            
            // Populate from-location dropdown with farm properties
            fromLocationSelect.innerHTML = '<option value="">Select source location (or leave blank)</option>';
            farmProperties.forEach(property => {
                // Check if this property has animals of this category
                let locationCount = 0;
                if (categoryData && typeof categoryData === 'object' && categoryData.locations && categoryData.locations[property]) {
                    locationCount = categoryData.locations[property];
                }
                fromLocationSelect.innerHTML += `<option value="${property}">${property}${locationCount > 0 ? ` (${locationCount} available)` : ''}</option>`;
            });
            fromLocationSelect.innerHTML += '<option value="manage">+ Manage Properties</option>';
        });
        
        // Handle new category option
        toCategorySelect.addEventListener('change', () => {
            if (toCategorySelect.value === 'new') {
                newCategoryInput.style.display = 'block';
                
                // Focus the new category input after a short delay
                setTimeout(() => {
                    const inputField = newCategoryInput.querySelector('input');
                    if (inputField) {
                        inputField.focus();
                    }
                }, 100);
            } else {
                newCategoryInput.style.display = 'none';
            }
        });
        
        // Handle manage properties option in toLocation dropdown
        toLocationSelect.addEventListener('change', () => {
            if (toLocationSelect.value === 'manage') {
                // Save current form state to restore later
                const formValues = {
                    fromCategory: fromCategorySelect.value,
                    toCategory: toCategorySelect.value,
                    newCategory: newCategoryInput.querySelector('input')?.value || '',
                    quantity: quantityInput.value,
                    fromLocation: fromLocationSelect.value,
                    notes: popup.querySelector('#notes').value,
                    date: popup.querySelector('#move-date').value
                };
                
                // Store form state in session storage
                sessionStorage.setItem('moveFormValues', JSON.stringify(formValues));
                
                // Open properties management popup
                popup.remove(); // Close the current popup
                showManagePropertiesPopup().then(() => {
                    showMoveAnimalPopup();
                    
                    // Restore values manually
                    try {
                        const savedValues = JSON.parse(sessionStorage.getItem('moveFormValues'));
                        if (savedValues) {
                            const newPopup = document.querySelector('.popup');
                            if (newPopup) {
                                // Restore from category and update from location dropdown
                                if (savedValues.fromCategory) {
                                    const fromCatSelect = newPopup.querySelector('#from-category');
                                    if (fromCatSelect) {
                                        fromCatSelect.value = savedValues.fromCategory;
                                        
                                        // Trigger change event to populate from location dropdown
                                        const event = new Event('change');
                                        fromCatSelect.dispatchEvent(event);
                                        
                                        // After populating locations, restore selected location
                                        setTimeout(() => {
                                            if (savedValues.fromLocation) {
                                                const fromLocSelect = newPopup.querySelector('#from-location');
                                                if (fromLocSelect) {
                                                    fromLocSelect.value = savedValues.fromLocation;
                                                }
                                            }
                                        }, 100);
                                    }
                                }
                                
                                // Restore to category
                                if (savedValues.toCategory && savedValues.toCategory !== 'new') {
                                    const toCatSelect = newPopup.querySelector('#to-category');
                                    if (toCatSelect) {
                                        toCatSelect.value = savedValues.toCategory;
                                    }
                                } else if (savedValues.toCategory === 'new' && savedValues.newCategory) {
                                    const toCatSelect = newPopup.querySelector('#to-category');
                                    if (toCatSelect) {
                                        toCatSelect.value = 'new';
                                        const event = new Event('change');
                                        toCatSelect.dispatchEvent(event);
                                        
                                        setTimeout(() => {
                                            const newCatInput = newPopup.querySelector('#new-category');
                                            if (newCatInput) {
                                                newCatInput.value = savedValues.newCategory;
                                            }
                                        }, 100);
                                    }
                                }
                                
                                // Restore other fields
                                if (savedValues.quantity) {
                                    const quantityField = newPopup.querySelector('#quantity');
                                    if (quantityField) quantityField.value = savedValues.quantity;
                                }
                                
                                if (savedValues.notes) {
                                    const notesField = newPopup.querySelector('#notes');
                                    if (notesField) notesField.value = savedValues.notes;
                                }
                                
                                if (savedValues.date) {
                                    const dateField = newPopup.querySelector('#move-date');
                                    if (dateField) dateField.value = savedValues.date;
                                }
                            }
                        }
                    } catch (error) {
                        console.error("Error restoring form values:", error);
                    }
                });
            }
        });
        
        // Handle manage properties option in fromLocation dropdown
        fromLocationSelect.addEventListener('change', () => {
            if (fromLocationSelect.value === 'manage') {
                // Save current form state
                const formValues = {
                    category: fromCategorySelect.value,
                    fromLocation: '', // We'll need to select a new one after returning
                    toCategory: toCategorySelect.value,
                    toLocation: toLocationSelect.value,
                    quantity: quantityInput.value,
                    date: popup.querySelector('#move-date').value
                };
                
                // Store form state in session storage
                sessionStorage.setItem('moveFormValues', JSON.stringify(formValues));
                
                // Open properties management popup
                popup.remove();
                showManagePropertiesPopup().then(() => {
                    showMoveAnimalPopup();
                    
                    // Restore form values
                    try {
                        const savedValues = JSON.parse(sessionStorage.getItem('moveFormValues'));
                        if (savedValues) {
                            const newPopup = document.querySelector('.popup');
                            if (newPopup) {
                                // Restore category selections first to trigger the dropdowns to update
                                if (savedValues.category) {
                                    const fromCategoryField = newPopup.querySelector('#from-category');
                                    if (fromCategoryField) {
                                        fromCategoryField.value = savedValues.category;
                                        const event = new Event('change');
                                        fromCategoryField.dispatchEvent(event);
                                    }
                                }
                                
                                if (savedValues.toCategory) {
                                    const toCategoryField = newPopup.querySelector('#to-category');
                                    if (toCategoryField) {
                                        toCategoryField.value = savedValues.toCategory;
                                        const event = new Event('change');
                                        toCategoryField.dispatchEvent(event);
                                    }
                                }
                                
                                if (savedValues.toLocation) {
                                    const toLocationField = newPopup.querySelector('#to-location');
                                    if (toLocationField) {
                                        toLocationField.value = savedValues.toLocation;
                                    }
                                }
                                
                                if (savedValues.quantity) {
                                    const quantityField = newPopup.querySelector('#quantity');
                                    if (quantityField) {
                                        quantityField.value = savedValues.quantity;
                                    }
                                }
                                
                                if (savedValues.date) {
                                    const dateField = newPopup.querySelector('#move-date');
                                    if (dateField) dateField.value = savedValues.date;
                                }
                            }
                        }
                    } catch (error) {
                        console.error('Error restoring move form values:', error);
                    }
                });
            }
        });
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Disable submit button to prevent double submission
            const submitBtn = form.querySelector('.save-btn');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Processing...';
            
            try {
            const fromCategory = fromCategorySelect.value;
                const fromLocation = fromLocationSelect.value;
            
                // Get or create destination category
            let toCategory;
            if (toCategorySelect.value === 'new') {
                    toCategory = newCategoryInput.querySelector('input').value.trim();
                if (!toCategory) {
                        alert('Please enter a name for the new category');
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Move';
                    return;
                }
                
                // Add new category to saved categories
                if (!animalCategories.includes(toCategory)) {
                    animalCategories.push(toCategory);
                    await mobileStorage.setItem('animalCategories', JSON.stringify(animalCategories));
                    localStorage.setItem('animalCategories', JSON.stringify(animalCategories));
                }
            } else {
                toCategory = toCategorySelect.value;
            }
            
                const toLocation = toLocationSelect.value === 'manage' ? '' : toLocationSelect.value;
                const quantity = parseInt(quantityInput.value, 10);
            const notes = popup.querySelector('#notes').value.trim();
                const date = popup.querySelector('#move-date').value;
            
                // Validate: Check if we have enough animals in the source category
            const fromCategoryData = animalInventory[fromCategory];
            let availableQuantity = 0;
            
            if (typeof fromCategoryData === 'number') {
                availableQuantity = fromCategoryData;
            } else if (fromCategoryData && typeof fromCategoryData === 'object') {
                if (fromLocation && fromCategoryData.locations && fromCategoryData.locations[fromLocation]) {
                    // If specific location, check that location's count
                    availableQuantity = fromCategoryData.locations[fromLocation];
                } else {
                    // If no specific location, use total
                    availableQuantity = fromCategoryData.total || 0;
                }
            }
            
            if (quantity > availableQuantity) {
                const locationText = fromLocation ? ` in ${fromLocation}` : '';
                alert(`Not enough ${fromCategory}${locationText}. Available: ${availableQuantity}`);
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Move';
                return;
            }
            
                // Update inventory: Remove from source
            if (typeof fromCategoryData === 'number') {
                // Convert old format to new format
                animalInventory[fromCategory] = {
                    total: fromCategoryData - quantity,
                        locations: {
                            'Unspecified': fromCategoryData - quantity
                        }
                };
            } else {
                // Update total
                fromCategoryData.total -= quantity;
                
                // Update specific location if provided
                    if (fromLocation && fromCategoryData.locations[fromLocation]) {
                    fromCategoryData.locations[fromLocation] -= quantity;
                    
                    // Remove location if count is 0
                    if (fromCategoryData.locations[fromLocation] <= 0) {
                        delete fromCategoryData.locations[fromLocation];
                    }
                } else {
                    // If no specific location, reduce from 'Unspecified'
                    const unspecifiedLocation = 'Unspecified';
                    if (!fromCategoryData.locations[unspecifiedLocation]) {
                        fromCategoryData.locations[unspecifiedLocation] = fromCategoryData.total + quantity;
                    }
                    fromCategoryData.locations[unspecifiedLocation] -= quantity;
                    
                    if (fromCategoryData.locations[unspecifiedLocation] <= 0) {
                        delete fromCategoryData.locations[unspecifiedLocation];
                    }
                }
                
                    // Remove category if total is 0 or no locations left
                    if (fromCategoryData.total <= 0 || Object.keys(fromCategoryData.locations).length === 0) {
                    delete animalInventory[fromCategory];
                }
            }
            
            // Update inventory for destination category
            if (!animalInventory[toCategory]) {
                animalInventory[toCategory] = {
                    total: 0,
                    locations: {}
                };
            } else if (typeof animalInventory[toCategory] === 'number') {
                // Convert old format to new format
                animalInventory[toCategory] = {
                    total: animalInventory[toCategory],
                        locations: {
                            'Unspecified': animalInventory[toCategory]
                        }
                };
            }
            
            // Update total count
            animalInventory[toCategory].total += quantity;
            
            // Update location count
            const toLocationKey = toLocation || 'Unspecified';
                if (!animalInventory[toCategory].locations[toLocationKey]) {
                    animalInventory[toCategory].locations[toLocationKey] = 0;
                }
                animalInventory[toCategory].locations[toLocationKey] += quantity;
            
            await mobileStorage.setItem('animalInventory', JSON.stringify(animalInventory));
            
            // Add to recent activities
            const activity = {
                type: 'move',
                fromCategory,
                toCategory,
                fromLocation,
                toLocation,
                quantity,
                notes,
                date,
                timestamp: new Date().toISOString()
            };
            
            recentActivities.unshift(activity);
            await mobileStorage.setItem('recentActivities', JSON.stringify(recentActivities));
            
            // Update UI
            updateDisplays();
            
                // Close popup
                popup.remove();
            
            // Show success message
            setTimeout(() => {
                alert(`Successfully moved ${quantity} ${fromCategory} to ${toCategory}`);
            }, 300);
            } catch (error) {
                console.error('Error moving animals:', error);
                alert('There was an error moving the animals. Please try again.');
                
                // Re-enable the submit button
                submitBtn.disabled = false;
                submitBtn.textContent = 'Move';
            }
        });
        
        // Cancel button handling
        popup.querySelector('.cancel-btn').addEventListener('click', () => {
            popup.remove();
        });
    }
    
    async function showDeathPopup() {
        // We no longer redirect to create category popup
        // Instead we check if there are animals in inventory
        if (Object.keys(animalInventory).length === 0) {
            alert('No animals in inventory to record death for');
            return;
        }
        
        // Reload farm properties to ensure we have the latest data
        try {
            const propertiesStr = await mobileStorage.getItem('farmProperties');
            if (propertiesStr) {
                farmProperties = JSON.parse(propertiesStr);
            }
        } catch (error) {
            console.error('Error loading farm properties:', error);
            if (!farmProperties || farmProperties.length === 0) {
                farmProperties = [];
            }
        }
        
        const popupContent = `
            <div class="popup-content">
                <h3>Record Death</h3>
                <form id="death-form">
                    <div class="form-group">
                        <label for="category">Category:</label>
                        <select id="category" name="category" required>
                            <option value="" disabled selected>Select a category</option>
                            ${Object.keys(animalInventory).map(category => {
                                // Get count based on structure
                                const count = typeof animalInventory[category] === 'number' ? 
                                    animalInventory[category] : 
                                    (animalInventory[category]?.total || 0);
                                return `<option value="${category}">${category} (${count} available)</option>`;
                            }).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="quantity">Quantity:</label>
                        <input type="number" id="quantity" name="quantity" min="1" value="1" required>
                    </div>
                    <div class="form-group">
                        <label for="location">Location:</label>
                        <select id="location" name="location" required>
                            <option value="" selected>Select location</option>
                            ${farmProperties.map(property => 
                                `<option value="${property}">${property}</option>`
                            ).join('')}
                            <option value="manage">+ Manage Properties</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="reason">Reason:</label>
                        <textarea id="reason" name="reason" rows="3"></textarea>
                    </div>
                    <div class="form-group">
                        <label for="death-date">Date:</label>
                        <input type="date" id="death-date" name="death-date" required value="${new Date().toISOString().split('T')[0]}">
                    </div>
                    <div class="form-actions">
                        <button type="button" class="cancel-btn">Cancel</button>
                        <button type="submit" class="save-btn">Record</button>
                    </div>
                </form>
            </div>
        `;
        
        const popup = createPopup(popupContent);
        
        // Form submission handling
        const form = popup.querySelector('form');
        const categorySelect = popup.querySelector('#category');
        const quantityInput = popup.querySelector('#quantity');
        const locationSelect = popup.querySelector('#location');
        
        // Update location dropdown initially if a category is already selected
        if (categorySelect.value) {
            const event = new Event('change');
            categorySelect.dispatchEvent(event);
        }
        
        // Update locations dropdown and max quantity based on category selection
        categorySelect.addEventListener('change', () => {
            const category = categorySelect.value;
            const categoryData = animalInventory[category];
            
            // Update max quantity based on selection
            let availableQuantity = 0;
            if (typeof categoryData === 'number') {
                availableQuantity = categoryData;
            } else if (categoryData && typeof categoryData === 'object') {
                availableQuantity = categoryData.total || 0;
            }
            
            quantityInput.max = availableQuantity;
            quantityInput.value = Math.min(quantityInput.value, availableQuantity);
            
            // Populate location dropdown with all farm properties
            locationSelect.innerHTML = '<option value="">Select location (or leave blank)</option>';
            farmProperties.forEach(property => {
                // Check if this property has animals of this category
                let locationCount = 0;
                if (categoryData && typeof categoryData === 'object' && categoryData.locations && categoryData.locations[property]) {
                    locationCount = categoryData.locations[property];
                }
                locationSelect.innerHTML += `<option value="${property}">${property}${locationCount > 0 ? ` (${locationCount} available)` : ''}</option>`;
            });
            locationSelect.innerHTML += '<option value="manage">+ Manage Properties</option>';
        }, { passive: true });
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const category = categorySelect.value;
            const quantity = parseInt(quantityInput.value, 10);
            const location = locationSelect.value;
            const reason = popup.querySelector('#reason').value.trim();
            const date = popup.querySelector('#death-date').value;
            
            // Check if there are enough animals
            const categoryData = animalInventory[category];
            let availableQuantity = 0;
            
            if (typeof categoryData === 'number') {
                availableQuantity = categoryData;
            } else if (categoryData && typeof categoryData === 'object') {
                if (location && categoryData.locations && categoryData.locations[location]) {
                    // If specific location, check that location's count
                    availableQuantity = categoryData.locations[location];
                } else {
                    // If no specific location, use total
                    availableQuantity = categoryData.total || 0;
                }
            }
            
            if (quantity > availableQuantity) {
                const locationText = location ? ` in ${location}` : '';
                alert(`Not enough ${category}${locationText}. Available: ${availableQuantity}`);
                return;
            }
            
            // Update inventory
            if (typeof categoryData === 'number') {
                // Convert old format to new format
                animalInventory[category] = {
                    total: categoryData - quantity,
                    locations: {}
                };
                if (animalInventory[category].total <= 0) {
                    delete animalInventory[category];
                }
            } else {
                // Update total
                categoryData.total -= quantity;
                
                // Update specific location if provided
                if (location) {
                    categoryData.locations[location] -= quantity;
                    
                    // Remove location if count is 0
                    if (categoryData.locations[location] <= 0) {
                        delete categoryData.locations[location];
                    }
                } else {
                    // If no specific location, reduce from 'Unspecified'
                    const unspecifiedLocation = 'Unspecified';
                    if (!categoryData.locations[unspecifiedLocation]) {
                        categoryData.locations[unspecifiedLocation] = categoryData.total + quantity;
                    }
                    categoryData.locations[unspecifiedLocation] -= quantity;
                    
                    if (categoryData.locations[unspecifiedLocation] <= 0) {
                        delete categoryData.locations[unspecifiedLocation];
                    }
                }
                
                // Remove category if total is 0
                if (categoryData.total <= 0) {
                    delete animalInventory[category];
                }
            }
            
            await mobileStorage.setItem('animalInventory', JSON.stringify(animalInventory));
            
            // Add to recent activities
            const activity = {
                type: 'death',
                category,
                quantity,
                location,
                reason,
                date,
                timestamp: new Date().toISOString()
            };
            
            recentActivities.unshift(activity);
            await mobileStorage.setItem('recentActivities', JSON.stringify(recentActivities));
            
            // Update UI
            updateDisplays();
            
            // Close popup
            popup.remove();
        });
        
        // Cancel button handling
        popup.querySelector('.cancel-btn').addEventListener('click', () => {
            popup.remove();
        });
        
        // Handle manage properties option
        locationSelect.addEventListener('change', () => {
            if (locationSelect.value === 'manage') {
                // Save current form state to restore later
                const formValues = {
                    category: categorySelect.value,
                    quantity: quantityInput.value,
                    reason: popup.querySelector('#reason').value,
                    date: popup.querySelector('#death-date').value
                };
                
                // Store form state in session storage
                sessionStorage.setItem('deathFormValues', JSON.stringify(formValues));
                
                // Open properties management popup
                popup.remove();
                showManagePropertiesPopup().then(() => {
                    showDeathPopup();
                    
                    // Restore values manually
                    try {
                        const savedValues = JSON.parse(sessionStorage.getItem('deathFormValues'));
                        if (savedValues) {
                            const newPopup = document.querySelector('.popup');
                            if (newPopup) {
                                // Restore category and update location dropdown
                                if (savedValues.category) {
                                    const categoryField = newPopup.querySelector('#category');
                                    if (categoryField) {
                                        categoryField.value = savedValues.category;
                                        const event = new Event('change');
                                        categoryField.dispatchEvent(event);
                                    }
                                }
                                
                                if (savedValues.quantity) {
                                    const quantityField = newPopup.querySelector('#quantity');
                                    if (quantityField) {
                                        quantityField.value = savedValues.quantity;
                                    }
                                }
                                
                                if (savedValues.reason) {
                                    const reasonField = newPopup.querySelector('#reason');
                                    if (reasonField) {
                                        reasonField.value = savedValues.reason;
                                    }
                                }
                                
                                if (savedValues.date) {
                                    const dateField = newPopup.querySelector('#death-date');
                                    if (dateField) {
                                        dateField.value = savedValues.date;
                                    }
                                }
                            }
                        }
                    } catch (error) {
                        console.error("Error restoring form values:", error);
                    }
                });
            }
        });
    }
    
    async function showBirthPopup() {
        // We no longer redirect to create category popup
        // Instead we check if there are animals in inventory
        if (Object.keys(animalInventory).length === 0) {
            alert('No parent animals in inventory to record birth');
            return;
        }
        
        // Reload farm properties to ensure we have the latest data
        try {
            const propertiesStr = await mobileStorage.getItem('farmProperties');
            if (propertiesStr) {
                farmProperties = JSON.parse(propertiesStr);
            }
        } catch (error) {
            console.error('Error loading farm properties:', error);
            if (!farmProperties || farmProperties.length === 0) {
                farmProperties = [];
            }
        }
        
        const popupContent = `
            <div class="popup-content">
                <h3>Record Birth</h3>
                <form id="birth-form">
                    <div class="form-group">
                        <label for="category">Category:</label>
                        <select id="category" name="category" required>
                            <option value="" disabled selected>Select a category</option>
                            ${Object.keys(animalInventory).map(category => 
                                `<option value="${category}">${category}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="quantity">Quantity:</label>
                        <input type="number" id="quantity" name="quantity" min="1" value="1" required>
                    </div>
                    <div class="form-group">
                        <label for="location">Location:</label>
                        <select id="location" name="location" required>
                            <option value="" selected>Select location</option>
                            ${farmProperties.map(property => 
                                `<option value="${property}">${property}</option>`
                            ).join('')}
                            <option value="manage">+ Manage Properties</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="notes">Notes:</label>
                        <textarea id="notes" name="notes" rows="3"></textarea>
                    </div>
                    <div class="form-group">
                        <label for="birth-date">Date:</label>
                        <input type="date" id="birth-date" name="birth-date" required value="${new Date().toISOString().split('T')[0]}">
                    </div>
                    <div class="form-actions">
                        <button type="button" class="cancel-btn">Cancel</button>
                        <button type="submit" class="save-btn">Record</button>
                    </div>
                </form>
            </div>
        `;
        
        const popup = createPopup(popupContent);
        
        // Form elements
        const form = popup.querySelector('#birth-form');
        const categorySelect = popup.querySelector('#category');
        const locationSelect = popup.querySelector('#location');
        
        // Update location dropdown initially if a category is already selected
        if (categorySelect.value) {
            const event = new Event('change');
            categorySelect.dispatchEvent(event);
        }
        
        // Add change listener to update location options
        categorySelect.addEventListener('change', () => {
            // Populate location dropdown with all farm properties
            locationSelect.innerHTML = '<option value="">Select location (or leave blank)</option>';
            farmProperties.forEach(property => {
                locationSelect.innerHTML += `<option value="${property}">${property}</option>`;
            });
            locationSelect.innerHTML += '<option value="manage">+ Manage Properties</option>';
        }, { passive: true });
        
        // Form submission handling
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Disable submit button to prevent double submission
            const submitBtn = form.querySelector('.save-btn');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Recording...';
            
            try {
            const category = categorySelect.value;
            const quantity = parseInt(popup.querySelector('#quantity').value, 10);
                const location = locationSelect.value === 'manage' ? '' : locationSelect.value;
            const notes = popup.querySelector('#notes').value.trim();
            const date = popup.querySelector('#birth-date').value;
            
                // Update inventory with proper location handling
                if (!animalInventory[category]) {
                    // Initialize with new format if category doesn't exist
                    animalInventory[category] = {
                        total: quantity,
                        locations: {}
                    };
                    
                    // Add location if provided
                    if (location) {
                        animalInventory[category].locations[location] = quantity;
                    } else {
                        animalInventory[category].locations['Unspecified'] = quantity;
                    }
                } else {
                    // Convert old format to new format if needed
                    if (typeof animalInventory[category] === 'number') {
                        animalInventory[category] = {
                            total: animalInventory[category] + quantity,
                            locations: {
                                'Unspecified': animalInventory[category]
                            }
                        };
                        
                        // Add location if provided
                        if (location) {
                            animalInventory[category].locations[location] = quantity;
                        } else {
                            animalInventory[category].locations['Unspecified'] += quantity;
                        }
                    } else {
                        // Update new format
                        animalInventory[category].total += quantity;
                        
                        // Update location
                        if (location) {
                            if (!animalInventory[category].locations[location]) {
                                animalInventory[category].locations[location] = 0;
                            }
                            animalInventory[category].locations[location] += quantity;
                        } else {
                            // Default to Unspecified location
                            if (!animalInventory[category].locations['Unspecified']) {
                                animalInventory[category].locations['Unspecified'] = 0;
                            }
                            animalInventory[category].locations['Unspecified'] += quantity;
                        }
                    }
                }
                
                // Save updated inventory
            await mobileStorage.setItem('animalInventory', JSON.stringify(animalInventory));
            
            // Add to recent activities
            const activity = {
                type: 'birth',
                category,
                quantity,
                    location,
                notes,
                date,
                timestamp: new Date().toISOString()
            };
            
            recentActivities.unshift(activity);
            await mobileStorage.setItem('recentActivities', JSON.stringify(recentActivities));
            
            // Update UI
            updateDisplays();
            
            // Close popup
            popup.remove();
            } catch (error) {
                console.error('Error recording birth:', error);
                alert('There was an error recording the birth. Please try again.');
                
                // Re-enable the submit button
                submitBtn.disabled = false;
                submitBtn.textContent = 'Record';
            }
        });
        
        // Handle manage properties option
        locationSelect.addEventListener('change', () => {
            if (locationSelect.value === 'manage') {
                // Save current form state to restore later
                const formValues = {
                    category: categorySelect.value,
                    quantity: popup.querySelector('#quantity').value,
                    notes: popup.querySelector('#notes').value,
                    date: popup.querySelector('#birth-date').value
                };
                
                // Store form state in session storage
                sessionStorage.setItem('birthFormValues', JSON.stringify(formValues));
                
                // Open properties management popup
                popup.remove(); // Close the current popup
                showManagePropertiesPopup().then(() => {
                    showBirthPopup();
                    
                    // Restore values manually
                    try {
                        const savedValues = JSON.parse(sessionStorage.getItem('birthFormValues'));
                        if (savedValues) {
                            const newPopup = document.querySelector('.popup');
                            if (newPopup) {
                                if (savedValues.category) {
                                    const categoryField = newPopup.querySelector('#category');
                                    if (categoryField) {
                                        categoryField.value = savedValues.category;
                                        const event = new Event('change');
                                        categoryField.dispatchEvent(event);
                                    }
                                }
                                if (savedValues.quantity) {
                                    const quantityField = newPopup.querySelector('#quantity');
                                    if (quantityField) quantityField.value = savedValues.quantity;
                                }
                                if (savedValues.notes) {
                                    const notesField = newPopup.querySelector('#notes');
                                    if (notesField) notesField.value = savedValues.notes;
                                }
                                if (savedValues.date) {
                                    const dateField = newPopup.querySelector('#birth-date');
                                    if (dateField) dateField.value = savedValues.date;
                                }
                            }
                        }
                    } catch (error) {
                        console.error('Error restoring form values:', error);
                    }
                });
            }
        });
    }
    
    async function showPurchaseAnimalPopup() {
        // Reload farm properties to ensure we have the latest data
        try {
            const propertiesStr = await mobileStorage.getItem('farmProperties');
            if (propertiesStr) {
                farmProperties = JSON.parse(propertiesStr);
            }
        } catch (error) {
            console.error('Error loading farm properties:', error);
            if (!farmProperties || farmProperties.length === 0) {
                farmProperties = [];
            }
        }
        
        const popupContent = `
            <div class="popup-content">
                <h3>Purchase Animals</h3>
                <form id="purchase-form">
                        <div class="form-group">
                        <label for="category">Category:</label>
                        <select id="category" name="category" required>
                            <option value="" disabled selected>Select a category</option>
                            ${animalCategories.map(category => 
                                `<option value="${category}">${category}</option>`
                            ).join('')}
                            <option value="new">+ Add New Category</option>
                        </select>
                            </div>
                    <div class="form-group new-category-input" style="display: none;">
                        <label for="new-category">New Category:</label>
                        <input type="text" id="new-category" name="new-category" placeholder="Enter new category name" inputmode="text" autocomplete="off">
                        </div>
                    <div class="form-group">
                        <label for="quantity">Quantity:</label>
                        <input type="number" id="quantity" name="quantity" min="1" value="1" required inputmode="numeric" pattern="[0-9]*">
                    </div>
                    <div class="form-group">
                        <label for="location">Location:</label>
                        <select id="location" name="location" required>
                            <option value="" selected>Select location</option>
                            ${farmProperties.map(property => 
                                `<option value="${property}">${property}</option>`
                            ).join('')}
                            <option value="manage">+ Manage Properties</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="price">Price per Animal (${worldCurrencies.find(c => c.code === selectedCurrency)?.symbol || 'R'}):</label>
                        <input type="number" id="price" name="price" step="0.01" min="0" required inputmode="decimal" pattern="[0-9]*\.?[0-9]*">
                    </div>
                    <div class="form-group">
                        <label for="supplier">Supplier:</label>
                        <input type="text" id="supplier" name="supplier" inputmode="text" autocomplete="off">
                    </div>
                    <div class="form-group">
                        <label for="purchase-date">Date:</label>
                        <input type="date" id="purchase-date" name="purchase-date" required value="${new Date().toISOString().split('T')[0]}">
                    </div>
                    <div class="form-group">
                        <label for="notes">Notes:</label>
                        <textarea id="notes" name="notes" rows="3" inputmode="text"></textarea>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="cancel-btn">Cancel</button>
                        <button type="submit" class="save-btn">Purchase</button>
                    </div>
                </form>
            </div>
        `;
        
        const popup = createPopup(popupContent);
        
        // Get form elements
        const form = popup.querySelector('#purchase-form');
        const categorySelect = popup.querySelector('#category');
        const newCategoryInput = popup.querySelector('.new-category-input');
        const locationSelect = popup.querySelector('#location');
        
        // Category selection handling
        categorySelect.addEventListener('change', () => {
            if (categorySelect.value === 'new') {
                newCategoryInput.style.display = 'block';
                
                // Focus the new category input after a short delay
                setTimeout(() => {
                    const inputField = newCategoryInput.querySelector('input');
                    if (inputField) {
                        inputField.focus();
                        
                        // Force keyboard to show on mobile devices
                        if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
                            inputField.blur();  // First blur
                            inputField.focus(); // Then focus again to ensure keyboard appears
                        }
                    }
                }, 100);
                } else {
                newCategoryInput.style.display = 'none';
            }
        });
        
        // Handle manage properties option
        locationSelect.addEventListener('change', () => {
            if (locationSelect.value === 'manage') {
                // Save current form state to restore later
                const formValues = {
                    category: categorySelect.value,
                    newCategory: newCategoryInput.querySelector('input')?.value || '',
                    quantity: popup.querySelector('#quantity').value,
                    price: popup.querySelector('#price').value,
                    supplier: popup.querySelector('#supplier').value,
                    date: popup.querySelector('#purchase-date').value,
                    notes: popup.querySelector('#notes').value
                };
                
                // Store form state in session storage
                sessionStorage.setItem('purchaseFormValues', JSON.stringify(formValues));
                
                // Open properties management popup
                popup.remove(); // Close the current popup
                showManagePropertiesPopup().then(() => {
                    showPurchaseAnimalPopup();
                    
                    // Restore values manually
                    try {
                        const savedValues = JSON.parse(sessionStorage.getItem('purchaseFormValues'));
                        if (savedValues) {
                            const newPopup = document.querySelector('.popup');
                            if (newPopup) {
                                if (savedValues.category) {
                                    const categorySelect = newPopup.querySelector('#category');
                                    if (categorySelect) {
                                        categorySelect.value = savedValues.category;
                                        
                                        // If it was a new category, show the new category input
                                        if (savedValues.category === 'new') {
                                            const newCategoryInput = newPopup.querySelector('.new-category-input');
                                            if (newCategoryInput) {
                                                const newCategoryField = newCategoryInput.querySelector('input');
                                                newCategoryInput.style.display = 'block';
                                                if (newCategoryField && savedValues.newCategory) {
                                                    newCategoryField.value = savedValues.newCategory;
                                                }
                                            }
                                        }
                                    }
                                }
                                if (savedValues.quantity) {
                                    const quantityField = newPopup.querySelector('#quantity');
                                    if (quantityField) quantityField.value = savedValues.quantity;
                                }
                                if (savedValues.price) {
                                    const priceField = newPopup.querySelector('#price');
                                    if (priceField) priceField.value = savedValues.price;
                                }
                                if (savedValues.supplier) {
                                    const supplierField = newPopup.querySelector('#supplier');
                                    if (supplierField) supplierField.value = savedValues.supplier;
                                }
                                if (savedValues.date) {
                                    const dateField = newPopup.querySelector('#purchase-date');
                                    if (dateField) dateField.value = savedValues.date;
                                }
                                if (savedValues.notes) {
                                    const notesField = newPopup.querySelector('#notes');
                                    if (notesField) notesField.value = savedValues.notes;
                                }
                            }
                        }
                    } catch (e) {
                        console.error('Error restoring form values:', e);
                    }
                });
            }
        });
        
        // Form submission handling
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Disable the submit button to prevent double-clicks
            const submitBtn = form.querySelector('.save-btn');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Processing...';
            
            try {
            let category;
            if (categorySelect.value === 'new') {
                category = popup.querySelector('#new-category').value.trim();
                if (!category) {
                    alert('Please enter a category name');
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Purchase';
                    return;
                }
                
                // Add new category to saved categories
                if (!animalCategories.includes(category)) {
                    animalCategories.push(category);
                    await mobileStorage.setItem('animalCategories', JSON.stringify(animalCategories));
                    // Also update localStorage for dashboard.js
                    localStorage.setItem('animalCategories', JSON.stringify(animalCategories));
                }
            } else {
                category = categorySelect.value;
            }
            
            const quantity = parseInt(popup.querySelector('#quantity').value, 10);
                const location = locationSelect.value === 'manage' ? '' : locationSelect.value;
            const price = parseFloat(popup.querySelector('#price').value);
            const supplier = popup.querySelector('#supplier').value.trim();
            const date = popup.querySelector('#purchase-date').value;
            const notes = popup.querySelector('#notes').value.trim();
            
                // Update inventory with proper location handling
                if (!animalInventory[category]) {
                    // Initialize with new format if category doesn't exist
                    animalInventory[category] = {
                        total: quantity,
                        locations: {}
                    };
                    
                    // Add location if provided
                    if (location) {
                        animalInventory[category].locations[location] = quantity;
                    } else {
                        animalInventory[category].locations['Unspecified'] = quantity;
                    }
                } else {
                    // Convert old format to new format if needed
                    if (typeof animalInventory[category] === 'number') {
                        animalInventory[category] = {
                            total: animalInventory[category] + quantity,
                            locations: {
                                'Unspecified': animalInventory[category]
                            }
                        };
                        
                        // Add location if provided
                        if (location) {
                            animalInventory[category].locations[location] = quantity;
                        } else {
                            animalInventory[category].locations['Unspecified'] += quantity;
                        }
                    } else {
                        // Update new format
                        animalInventory[category].total += quantity;
                        
                        // Update location
                        if (location) {
                            if (!animalInventory[category].locations[location]) {
                                animalInventory[category].locations[location] = 0;
                            }
                            animalInventory[category].locations[location] += quantity;
                        } else {
                            // Default to Unspecified location
                            if (!animalInventory[category].locations['Unspecified']) {
                                animalInventory[category].locations['Unspecified'] = 0;
                            }
                            animalInventory[category].locations['Unspecified'] += quantity;
                        }
                    }
                }
                
                // Save updated inventory
                await mobileStorage.setItem('animalInventory', JSON.stringify(animalInventory));
                
                // Calculate total cost
                const totalCost = price * quantity;
            
            // Add to recent activities
            const activity = {
                type: 'buy',
                category,
                quantity,
                price,
                    cost: totalCost,
                supplier,
                    location,
                date,
                    timestamp: new Date().toISOString()
            };
            
            recentActivities.unshift(activity);
            await mobileStorage.setItem('recentActivities', JSON.stringify(recentActivities));
            
            // Update UI
            updateDisplays();
            
            // Close popup
            popup.remove();
            } catch (error) {
                console.error('Error processing purchase:', error);
                alert('There was an error processing the purchase. Please try again.');
                
                // Re-enable the submit button
                submitBtn.disabled = false;
                submitBtn.textContent = 'Purchase';
            }
        });
    }
    
    async function showStockCountPopup() {
        // We no longer redirect to create category popup
        // Instead we check if there are animals in inventory
        if (Object.keys(animalInventory).length === 0) {
            alert('No animals in inventory to count');
            return;
        }
        
        // Reload farm properties to ensure we have the latest data
        try {
            const propertiesStr = await mobileStorage.getItem('farmProperties');
            if (propertiesStr) {
                farmProperties = JSON.parse(propertiesStr);
            }
        } catch (error) {
            console.error('Error loading farm properties:', error);
            if (!farmProperties || farmProperties.length === 0) {
                farmProperties = [];
            }
        }
        
        const popupContent = `
            <div class="popup-content">
                <h3>Stock Count</h3>
                <form id="stock-count-form">
                    <div class="form-group">
                        <label for="category">Category:</label>
                        <select id="category" name="category" required>
                            <option value="" disabled selected>Select a category</option>
                            ${Object.keys(animalInventory).map(category => {
                                // Format the count based on the data structure
                                let countText;
                                if (typeof animalInventory[category] === 'number') {
                                    countText = animalInventory[category];
                                } else if (animalInventory[category] && typeof animalInventory[category] === 'object') {
                                    countText = animalInventory[category].total || 0;
                                } else {
                                    countText = 0;
                                }
                                return `<option value="${category}">${category} (Total: ${countText})</option>`;
                            }).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="location">Location:</label>
                        <select id="location" name="location" required>
                            <option value="" selected>Select location</option>
                            ${farmProperties.map(property => 
                                `<option value="${property}">${property}</option>`
                            ).join('')}
                            <option value="manage">+ Manage Properties</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="actual-count">Actual Count:</label>
                        <input type="number" id="actual-count" name="actual-count" min="0" required inputmode="numeric" pattern="[0-9]*">
                        <span class="expected-count"></span>
                    </div>
                    <div class="form-group">
                        <label for="counter-name">Name of Person Counting:</label>
                        <input type="text" id="counter-name" name="counter-name" required placeholder="Enter your name">
                    </div>
                    <div class="form-group">
                        <label for="notes">Notes:</label>
                        <textarea id="notes" name="notes" placeholder="Add any notes about this count" inputmode="text"></textarea>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="cancel-btn">Cancel</button>
                        <button type="submit" class="save-btn">Record Count</button>
                    </div>
                </form>
            </div>
        `;
        
        const popup = createPopup(popupContent);
        
        // Get form elements
        const categorySelect = popup.querySelector('#category');
        const locationSelect = popup.querySelector('#location');
        const actualCountInput = popup.querySelector('#actual-count');
        const expectedCountSpan = popup.querySelector('.expected-count');
        
        // Handle category change to update location options
        categorySelect.addEventListener('change', (e) => {
            const selectedCategory = e.target.value;
            if (!selectedCategory) return;
            
            const categoryData = animalInventory[selectedCategory];
            
            // Update display based on selected category
            updateExpectedCount(selectedCategory, locationSelect.value);
            
            // Update locations dropdown if using new inventory format
            if (categoryData && typeof categoryData === 'object' && categoryData.locations) {
                // Clear existing options except first and last
                while (locationSelect.options.length > 2) {
                    locationSelect.remove(1);
                }
                
                // Add each property with count info
                let index = 1;
                farmProperties.forEach(property => {
                    const locationCount = categoryData.locations[property] || 0;
                    const option = new Option(
                        `${property}${locationCount > 0 ? ` (${locationCount})` : ''}`, 
                        property
                    );
                    locationSelect.add(option, index++);
                });
            }
        }, { passive: true });
        
        // Handle location selection change
        locationSelect.addEventListener('change', (e) => {
            const locationValue = e.target.value;
            const selectedCategory = categorySelect.value;
            
            if (locationValue === 'manage') {
                // Save current form state
                const formValues = {
                    category: categorySelect.value,
                    count: actualCountInput.value,
                    counterName: popup.querySelector('#counter-name').value,
                    notes: popup.querySelector('#notes').value
                };
                
                // Store form state
                sessionStorage.setItem('stockCountFormValues', JSON.stringify(formValues));
                
                // Open properties management popup
                popup.remove();
                showManagePropertiesPopup().then(() => {
                    showStockCountPopup();
                    
                    // Restore values manually
                    try {
                        const savedValues = JSON.parse(sessionStorage.getItem('stockCountFormValues'));
                        if (savedValues) {
                            const newPopup = document.querySelector('.popup');
                            if (newPopup) {
                                if (savedValues.category) {
                                    const categoryField = newPopup.querySelector('#category');
                                    if (categoryField) {
                                        categoryField.value = savedValues.category;
                                        // Trigger change event to update location options
                                        const event = new Event('change');
                                        categoryField.dispatchEvent(event);
                                    }
                                }
                                if (savedValues.count) {
                                    const countField = newPopup.querySelector('#actual-count');
                                    if (countField) countField.value = savedValues.count;
                                }
                                if (savedValues.counterName) {
                                    const nameField = newPopup.querySelector('#counter-name');
                                    if (nameField) nameField.value = savedValues.counterName;
                                }
                                if (savedValues.notes) {
                                    const notesField = newPopup.querySelector('#notes');
                                    if (notesField) notesField.value = savedValues.notes;
                                }
                            }
                        }
                    } catch (error) {
                        console.error('Error restoring stock count form values:', error);
                    }
                });
                return;
            }
            
            // Update expected count based on selected category and location
            if (selectedCategory) {
                updateExpectedCount(selectedCategory, locationValue);
            }
        }, { passive: true });
        
        // Helper function to update expected count display
        function updateExpectedCount(category, location) {
            if (!category) return;
            
            let expectedCount = 0;
            const categoryData = animalInventory[category];
            
            if (typeof categoryData === 'number') {
                // Old format - no location tracking
                expectedCount = categoryData;
            } else if (categoryData && typeof categoryData === 'object') {
                if (location && location !== '' && categoryData.locations && categoryData.locations[location]) {
                    // Specific location count
                    expectedCount = categoryData.locations[location];
                } else {
                    // Total count
                    expectedCount = categoryData.total || 0;
                }
            }
            
                expectedCountSpan.textContent = `Expected count: ${expectedCount}`;
                actualCountInput.placeholder = `Current count is ${expectedCount}`;
                actualCountInput.dataset.expectedCount = expectedCount;
            }
        
        // Form submission
        const form = popup.querySelector('form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const category = categorySelect.value;
            if (!category) {
                alert('Please select a category');
                return;
            }
            
            const location = locationSelect.value === 'manage' ? '' : locationSelect.value;
            
            const actualCount = parseInt(actualCountInput.value);
            if (isNaN(actualCount)) {
                alert('Please enter a valid count');
                return;
            }
            
            const counterName = popup.querySelector('#counter-name').value.trim();
            if (!counterName) {
                alert('Please enter the name of the person counting');
                return;
            }
            
            const expectedCount = parseInt(actualCountInput.dataset.expectedCount || 0);
            const notes = popup.querySelector('#notes').value.trim();
            const difference = actualCount - expectedCount;
            const countDate = new Date().toISOString();
            
            // Disable the submit button to prevent double submission
            const submitButton = form.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            
            try {
                // Handle the stock count without changing inventory
                await handleStockCount({
                    category,
                    location,
                    actualCount,
                    expectedCount,
                    difference,
                    notes,
                    date: countDate,
                    counterName
                });
                
                // Close popup
                popup.remove();
                
                // Disable the stock count button temporarily
                const stockCountBtn = document.getElementById('stock-count-btn');
                if (stockCountBtn) {
                    stockCountBtn.disabled = true;
                    setTimeout(() => {
                        stockCountBtn.disabled = false;
                    }, 1000);
                }
            } catch (error) {
                console.error('Error handling stock count:', error);
                alert('An error occurred while recording the stock count. Please try again.');
                submitButton.disabled = false;
            }
        });
        
        // Cancel button handling
        popup.querySelector('.cancel-btn').addEventListener('click', () => {
            popup.remove();
        });
    }
    
    // Function to handle stock count without changing inventory
    async function handleStockCount(data) {
        if (!data || !data.category || isNaN(data.actualCount)) {
            console.error('Invalid stock count data', data);
            return;
        }
        
        const category = data.category;
        const actualCount = data.actualCount;
        const expectedCount = data.expectedCount;
        const difference = data.difference;
        const notes = data.notes || '';
        const countDate = data.date;
        const counterName = data.counterName;
        
        // Create stock count record with explicit expected and actual values
        const stockCount = {
            type: 'stock-count',
            date: countDate,
            category: category,
            expected: expectedCount,   // Use consistent property names
            actual: actualCount,       // Use consistent property names
            quantity: actualCount,     // Keep quantity for backward compatibility
            difference: difference,
            notes: notes,
            counterName: counterName   // Add counter name to the record
        };
        
        // Save to stockCounts
        let stockCounts = JSON.parse(await mobileStorage.getItem('stockCounts') || '[]');
        stockCounts.push(stockCount);
        await mobileStorage.setItem('stockCounts', JSON.stringify(stockCounts));
        
        // Create activity record with expected and actual values
        const stockCountActivity = {
            type: 'stock-count',
            date: countDate,
            category: category,
            expected: expectedCount,   // Add these fields to the activity record
            actual: actualCount,       // so they are available in reports
            quantity: actualCount,     // Keep quantity for backward compatibility
            description: `Stock count for ${category}: Expected ${expectedCount}, Actual ${actualCount} (${difference >= 0 ? '+' : ''}${difference}) by ${counterName}`,
            notes: notes,
            timestamp: countDate,
            counterName: counterName   // Add counter name to the activity record
        };
        
        // Add to recent activities
        recentActivities.unshift(stockCountActivity);
        await mobileStorage.setItem('recentActivities', JSON.stringify(recentActivities));
        
        // Handle discrepancy
        const existingDiscrepancyIndex = stockDiscrepancies.findIndex(d => 
            d.category === category && !d.resolved
        );
        
        if (difference !== 0) {
            // Add or update discrepancy
            const discrepancy = {
                type: 'count-discrepancy',
                date: countDate,
                category: category,
                expected: expectedCount,
                actual: actualCount,
                difference: difference,
                description: `Stock count discrepancy in ${category}: Expected ${expectedCount}, Actual ${actualCount} (Difference: ${difference >= 0 ? '+' : ''}${difference})`,
                notes: notes,
                resolved: false,
                timestamp: countDate
            };
            
            if (existingDiscrepancyIndex !== -1) {
                stockDiscrepancies[existingDiscrepancyIndex] = discrepancy;
            } else {
                stockDiscrepancies.push(discrepancy);
            }
            
            // Save discrepancies
            await mobileStorage.setItem('stockDiscrepancies', JSON.stringify(stockDiscrepancies));
            
            // Only show alert for discrepancies
            alert(`Stock count recorded. Discrepancy of ${difference >= 0 ? '+' : ''}${difference} ${category} has been recorded.`);
        } else if (existingDiscrepancyIndex !== -1) {
            // If this count matches expected count, resolve any existing discrepancy
            stockDiscrepancies[existingDiscrepancyIndex] = {
                ...stockDiscrepancies[existingDiscrepancyIndex],
                resolved: true,
                resolvedDate: countDate,
                resolutionNotes: 'Resolved by matching count',
                resolutionCount: actualCount
            };
            
            // Save discrepancies
            await mobileStorage.setItem('stockDiscrepancies', JSON.stringify(stockDiscrepancies));
            
            // Add resolution activity
            const resolutionActivity = {
                type: 'resolution',
                date: countDate,
                description: `Stock count discrepancy resolved for ${category}`,
                category: category,
                finalCount: actualCount,
                timestamp: countDate
            };
            
            recentActivities.unshift(resolutionActivity);
            await mobileStorage.setItem('recentActivities', JSON.stringify(recentActivities));
        } else {
            // Show a success message for matching counts with no existing discrepancy
            alert(`Stock count recorded successfully for ${category}.`);
        }
            
        // Update UI
        updateDisplays();
    }

    // Function to confirm and clear all animal data
    async function confirmClearAnimalData() {
        const popup = createPopup(`
            <div class="popup-content">
                <h2>Clear All Animal Data</h2>
                <p>Are you sure you want to clear all animal data? This action cannot be undone.</p>
                <p>This will clear:</p>
                <ul>
                    <li>All animal inventory</li>
                    <li>All animal transactions</li>
                    <li>All stock counts</li>
                    <li>All stock discrepancies</li>
                    <li>All animal-related activities</li>
                    <li>All farm properties/locations</li>
                </ul>
                <div class="popup-buttons">
                    <button class="cancel-btn">Cancel</button>
                    <button class="confirm-btn" id="confirm-clear">Clear All Data</button>
                </div>
            </div>
        `);

        document.getElementById('confirm-clear').addEventListener('click', async () => {
            try {
                console.log('Starting to clear all animal data');
                
                // List of all animal-related storage keys to clear
                const keysToSetEmpty = [
                    'animalInventory',
                    'animalCategories',
                    'animalSales',
                    'animalPurchases',
                    'stockDiscrepancies',
                    'stockCounts',
                    'animalMovements',
                    'animalBirths',
                    'animalDeaths',
                    'farmProperties', // Add farmProperties to the list
                    // Additional possible keys
                    'animalData',
                    'animalInventoryBackup',
                    'animalTransactions',
                    'stockCountHistory',
                    'lastAnimalCount',
                    'animalCounts'
                ];
                
                // Clear each key - setting to empty default values
                for (const key of keysToSetEmpty) {
                    const defaultValue = key.endsWith('Inventory') || key === 'animalData' ? '{}' : '[]';
                    console.log(`Clearing ${key}, setting to ${defaultValue}`);
                    await mobileStorage.setItem(key, defaultValue);
                }
                
                // Clear farmProperties in memory as well
                farmProperties = [];
                propertiesList = [];
                
                // Disable demo data mode for reports
                console.log('Disabling demo data mode');
                await mobileStorage.setItem('showDemoData', 'false');
                
                // Get all recentActivities and filter out animal-related ones
                console.log('Clearing animal-related activities');
                const recentActivities = JSON.parse(await mobileStorage.getItem('recentActivities') || '[]');
                console.log(`Found ${recentActivities.length} total activities before filtering`);
                
                const filteredActivities = recentActivities.filter(activity => {
                    // Check if the activity should be kept (non-animal related)
                    const isAnimalRelated = 
                        activity.type?.includes('animal') || 
                        activity.type?.includes('stock') ||
                        activity.type?.includes('count') ||
                        activity.type?.includes('resolution') ||
                        activity.category?.includes('Cow') ||
                        activity.category?.includes('Calf') ||
                        activity.category?.includes('Cattle') ||
                        activity.type?.includes('property') ||  // Also remove property-related activities
                        activity.description?.includes('animal') ||
                        activity.description?.includes('property'); // Also remove property mentions
                    
                    // Keep the activity if it's NOT animal related
                    return !isAnimalRelated;
                });
                
                console.log(`After filtering: ${filteredActivities.length} activities remain`);
                await mobileStorage.setItem('recentActivities', JSON.stringify(filteredActivities));
                
                // Forcefully remove any caches
                console.log('Clearing cache to ensure fresh data');
                if (mobileStorage.clearCache) {
                    mobileStorage.clearCache();
                }
                
                // Force localStorage clear as well (for backward compatibility)
                if (typeof localStorage !== 'undefined') {
                    for (const key of keysToSetEmpty) {
                        const defaultValue = key.endsWith('Inventory') || key === 'animalData' ? '{}' : '[]';
                        console.log(`Clearing ${key} from localStorage`);
                        localStorage.setItem(key, defaultValue);
                    }
                    localStorage.setItem('showDemoData', 'false');
                }
                
                // Update displays
                console.log('Updating displays after data clear');
                updateDisplays();
                
                // Show success message
                showMessage('All animal data and farm properties have been cleared successfully. The page will reload to ensure all data is refreshed.', false, 5000);
                console.log('Animal data and farm properties clear operation completed successfully');
                
                // Close the popup
                popup.remove();
                
                // Set a short timeout to let the message be seen before reloading
                setTimeout(() => {
                    // Force page reload to ensure all data is cleared from memory
                    window.location.reload(true);
                }, 2000);
            } catch (error) {
                console.error('Error clearing animal data:', error);
                showMessage('Error clearing animal data. Please try again.', true);
            }
        });
    }
    
    // Function to show popup for reversing the last animal addition
    function showReverseLastAdditionPopup() {
        // Find the most recent livestock addition
        const recentAdditions = recentActivities.filter(
            activity => activity.type === 'add' || activity.type === 'buy' || activity.type === 'birth'
        );
        
        if (recentAdditions.length === 0) {
            alert('No recent livestock additions found to reverse.');
            return;
        }
        
        // Get the most recent addition
        const lastAddition = recentAdditions[0];
        const formattedDate = new Date(lastAddition.timestamp || lastAddition.date).toLocaleDateString();
        const additionType = lastAddition.type === 'add' ? 'Added' : 
                             lastAddition.type === 'buy' ? 'Purchased' : 'Recorded birth of';
        
        // Format the description based on the addition type
        let description = `${additionType} ${lastAddition.quantity} ${lastAddition.category} on ${formattedDate}`;
        if (lastAddition.type === 'buy' && lastAddition.supplier) {
            description += ` from ${lastAddition.supplier}`;
        }
        
        const popupContent = `
            <div class="popup-content">
                <h3>Reverse Last Addition</h3>
                <p>This will remove the following addition from inventory and records:</p>
                <div class="last-addition-details">
                    <p><strong>${description}</strong></p>
                </div>
                <form id="reverse-form">
                    <div class="form-group">
                        <label for="reason">Reason for reversal:</label>
                        <textarea id="reason" name="reason" rows="3" placeholder="Enter reason for reversing this addition" required></textarea>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="cancel-btn">Cancel</button>
                        <button type="submit" class="save-btn danger-btn">Reverse Addition</button>
                    </div>
                </form>
            </div>
        `;
        
        const popup = createPopup(popupContent);
        
        // Form submission handling
        const form = popup.querySelector('form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const reason = popup.querySelector('#reason').value.trim();
            if (!reason) {
                alert('Please enter a reason for the reversal');
                return;
            }
            
            try {
                // Update inventory - remove the animals
                const category = lastAddition.category;
                const quantity = lastAddition.quantity;
                const location = lastAddition.location || 'Unspecified';
                
                // Handle inventory with the new structure (with locations)
                if (animalInventory[category]) {
                    if (typeof animalInventory[category] === 'number') {
                        // Old format
                        animalInventory[category] = Math.max(0, animalInventory[category] - quantity);
                        
                        // If count is zero, remove the category
                if (animalInventory[category] === 0) {
                    delete animalInventory[category];
                        }
                    } else if (typeof animalInventory[category] === 'object') {
                        // New format with locations
                        // First update the total
                        animalInventory[category].total = Math.max(0, animalInventory[category].total - quantity);
                        
                        // Then update the specific location if it exists
                        if (animalInventory[category].locations && animalInventory[category].locations[location]) {
                            animalInventory[category].locations[location] = Math.max(0, animalInventory[category].locations[location] - quantity);
                            
                            // If location count is zero, remove the location
                            if (animalInventory[category].locations[location] === 0) {
                                delete animalInventory[category].locations[location];
                            }
                        }
                        
                        // If total is zero or no locations remain, remove the category
                        if (animalInventory[category].total === 0 || Object.keys(animalInventory[category].locations).length === 0) {
                            delete animalInventory[category];
                        }
                    }
                }
                
                // Remove the original activity from the list
                const activityIndex = recentActivities.findIndex(a => 
                    a.timestamp === lastAddition.timestamp && 
                    a.type === lastAddition.type &&
                    a.category === lastAddition.category
                );
                
                if (activityIndex !== -1) {
                    recentActivities.splice(activityIndex, 1);
                }
                
                // Create a reversal activity
                const reversalActivity = {
                    type: 'reversal',
                    category: lastAddition.category,
                    quantity: lastAddition.quantity,
                    originalType: lastAddition.type,
                    reason: reason,
                    date: new Date().toISOString().split('T')[0],
                    timestamp: new Date().toISOString(),
                    description: `Reversed ${description.toLowerCase()} (${reason})`
                };
                
                // Add to activity log
                recentActivities.unshift(reversalActivity);
                
                // If it was a purchase, remove from purchases
                if (lastAddition.type === 'buy') {
                    const purchaseIndex = animalPurchases.findIndex(p => 
                        p.timestamp === lastAddition.timestamp && 
                        p.category === lastAddition.category
                    );
                    
                    if (purchaseIndex !== -1) {
                        animalPurchases.splice(purchaseIndex, 1);
                    }
                }
                
                // Save updates to storage
                await mobileStorage.setItem('animalInventory', JSON.stringify(animalInventory));
                await mobileStorage.setItem('recentActivities', JSON.stringify(recentActivities));
                
                if (lastAddition.type === 'buy') {
                    await mobileStorage.setItem('animalPurchases', JSON.stringify(animalPurchases));
                }
                
                // Update UI
                updateDisplays();
            
            // Close popup
            popup.remove();
                
                // Notify user
                alert('Addition has been reversed successfully.');
            } catch (error) {
                console.error('Error reversing addition:', error);
                alert('There was an error reversing the addition. Please try again.');
            }
        });
        
        // Cancel button handling
        popup.querySelector('.cancel-btn').addEventListener('click', () => {
            popup.remove();
        });
    }

    // Add this near the top of the document.ready function
    let farmProperties = []; // Will store the list of farm properties/locations

    // Initialize farm properties
    async function initializeProperties() {
        try {
            console.log("Initializing farm properties...");
            
            // Load properties from storage
            const storedProperties = await mobileStorage.getItem('farmProperties');
            if (storedProperties) {
                farmProperties = JSON.parse(storedProperties);
                console.log("Loaded farm properties from storage:", farmProperties);
            } else {
                // No default properties - start with empty array
                farmProperties = [];
                await mobileStorage.setItem('farmProperties', JSON.stringify(farmProperties));
                console.log("Initialized with empty farm properties");
            }
            
            // Reset and update the propertiesList
            propertiesList = [...farmProperties];
            
            // Extract unique properties from inventory
            const uniqueLocationsFromInventory = extractUniqueLocationsFromInventory();
            
            // Add any locations from inventory that aren't in the properties list
            for (const location of uniqueLocationsFromInventory) {
                if (!propertiesList.includes(location)) {
                    propertiesList.push(location);
                    console.log(`Added location "${location}" from inventory to properties list`);
                }
            }
            
            console.log("Updated properties list:", propertiesList);
            return propertiesList;
        } catch (error) {
            console.error("Error initializing properties:", error);
            return []; // Empty array fallback instead of defaults
        }
    }

    // Helper function to extract unique locations from inventory
    function extractUniqueLocationsFromInventory() {
        const uniqueLocations = new Set();
        
        if (animalInventory) {
            Object.values(animalInventory).forEach(categoryData => {
                if (categoryData && typeof categoryData === 'object') {
                    Object.keys(categoryData).forEach(location => {
                        if (location !== 'total') {
                            uniqueLocations.add(location);
                        }
                    });
                }
            });
        }
        
        return Array.from(uniqueLocations);
    }

    // Call this in the initialization section
    await initializeProperties();

    // Add this after initializeAnimalCategories function
    function showManagePropertiesPopup() {
        return new Promise(async (resolve) => {
            // Always load the latest properties from storage
            try {
                const propertiesStr = await mobileStorage.getItem('farmProperties');
                if (propertiesStr) {
                    farmProperties = JSON.parse(propertiesStr);
                }
            } catch (error) {
                console.error('Error loading farm properties:', error);
            }
            
            console.log("Current farmProperties:", farmProperties);
            
            const propertiesList = farmProperties.map(property => 
                `<li>${property} <button type="button" class="delete-property" data-property="${property}">×</button></li>`
            ).join('');
            
            const popupContent = `
                <div class="popup-content">
                    <h3>Manage Farm Properties</h3>
                    <p>Add or remove properties/locations in your farm</p>
                    
                    <form id="add-property-form">
                        <div class="form-group">
                            <label for="property-name">New Property Name:</label>
                            <input type="text" id="property-name" name="property-name" placeholder="Enter property name" required>
                        </div>
                        <button type="submit" class="save-btn">Add Property</button>
                    </form>
                    
                    <div class="properties-list-container">
                        <h4>Existing Properties</h4>
                        <ul class="properties-list">
                            ${propertiesList}
                        </ul>
                    </div>
                    
                    <div class="form-actions">
                        <button type="button" class="done-btn">Done</button>
                    </div>
                </div>
            `;
            
            const popup = createPopup(popupContent);
            
            // Handle new property form submission
            const form = popup.querySelector('#add-property-form');
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const propertyName = popup.querySelector('#property-name').value.trim();
                
                if (!propertyName) {
                    alert('Please enter a property name');
                    return;
                }
                
                if (farmProperties.includes(propertyName)) {
                    alert('Property already exists');
                    return;
                }
                
                // Add new property
                farmProperties.push(propertyName);
                await saveProperties();
                
                // Update list
                const propertiesList = popup.querySelector('.properties-list');
                const newItem = document.createElement('li');
                newItem.innerHTML = `${propertyName} <button type="button" class="delete-property" data-property="${propertyName}">×</button>`;
                propertiesList.appendChild(newItem);
                
                // Add click event to the new delete button
                const deleteButton = newItem.querySelector('.delete-property');
                deleteButton.addEventListener('click', async () => {
                    const property = deleteButton.getAttribute('data-property');
                    
                    if (confirm(`Are you sure you want to delete "${property}"?`)) {
                        // Remove property from list
                        farmProperties = farmProperties.filter(p => p !== property);
                        await saveProperties();
                        
                        // Remove from display
                        deleteButton.parentElement.remove();
                    }
                });
                
                // Clear input
                popup.querySelector('#property-name').value = '';
            });
            
            // Handle property deletion
            popup.querySelectorAll('.delete-property').forEach(button => {
                button.addEventListener('click', async () => {
                    const property = button.getAttribute('data-property');
                    
                    if (confirm(`Are you sure you want to delete "${property}"?`)) {
                        // Check if the property is used in any animal inventory
                        let inUse = false;
                        let affectedCategories = [];
                        
                        // Scan inventory for usage of this location
                        Object.entries(animalInventory).forEach(([category, data]) => {
                            if (typeof data === 'object' && data.locations && data.locations[property]) {
                                inUse = true;
                                affectedCategories.push(category);
                            }
                        });
                        
                        if (inUse) {
                            const moveConfirm = confirm(`This location "${property}" is currently in use by the following animal categories: ${affectedCategories.join(', ')}. 
                            
Animals at this location will be moved to "Unspecified". Do you want to continue?`);
                            
                            if (!moveConfirm) {
                                return; // Cancel the deletion
                            }
                            
                            // Move animals from the deleted location to Unspecified
                            Object.entries(animalInventory).forEach(([category, data]) => {
                                if (typeof data === 'object' && data.locations && data.locations[property]) {
                                    // Get count from the location before removing it
                                    const count = data.locations[property];
                                    
                                    // Add to Unspecified location
                                    if (!data.locations['Unspecified']) {
                                        data.locations['Unspecified'] = 0;
                                    }
                                    data.locations['Unspecified'] += count;
                                    
                                    // Remove the deleted location
                                    delete data.locations[property];
                                }
                            });
                            
                            // Save updated inventory
                            await mobileStorage.setItem('animalInventory', JSON.stringify(animalInventory));
                        }
                        
                        // Remove property from list
                        farmProperties = farmProperties.filter(p => p !== property);
                        await saveProperties();
                        
                        // Remove from display
                        button.parentElement.remove();
                    }
                });
            });
            
            // Handle done button
            popup.querySelector('.done-btn').addEventListener('click', () => {
                popup.remove();
                resolve();
            });
        });
    }

    // Helper function to save properties
    async function saveProperties() {
        console.log("Saving farmProperties:", farmProperties);
        await mobileStorage.setItem('farmProperties', JSON.stringify(farmProperties));
    }

    // Add this function after showReverseLastAdditionPopup
    function showUndoLastActionPopup() {
        // Find the most recent activity that can be undone (excluding reversals)
        const recentActions = recentActivities.filter(
            activity => ['add', 'buy', 'sell', 'move', 'death', 'birth', 'stock-count'].includes(activity.type) 
                     && activity.type !== 'reversal'
        );
        
        if (recentActions.length === 0) {
            alert('No recent actions to undo.');
            return;
        }
        
        // Get the most recent action
        const lastAction = recentActions[0];
        const formattedDate = new Date(lastAction.timestamp || lastAction.date).toLocaleDateString();
        
        // Format the description based on the action type
        let description = '';
        switch(lastAction.type) {
            case 'add':
                description = `Added ${lastAction.quantity} ${lastAction.category}`;
                if (lastAction.location) description += ` at ${lastAction.location}`;
                break;
            case 'buy':
                description = `Purchased ${lastAction.quantity} ${lastAction.category}`;
                if (lastAction.location) description += ` at ${lastAction.location}`;
                if (lastAction.supplier) description += ` from ${lastAction.supplier}`;
                break;
            case 'sell':
                description = `Sold ${lastAction.quantity} ${lastAction.category}`;
                if (lastAction.location) description += ` from ${lastAction.location}`;
                break;
            case 'move':
                if (lastAction.fromCategory && lastAction.toCategory) {
                    const fromLocationInfo = lastAction.fromLocation ? ` (${lastAction.fromLocation})` : '';
                    const toLocationInfo = lastAction.toLocation ? ` (${lastAction.toLocation})` : '';
                    description = `Moved ${lastAction.quantity} from ${lastAction.fromCategory}${fromLocationInfo} to ${lastAction.toCategory}${toLocationInfo}`;
                } else if (lastAction.fromLocation && lastAction.toLocation) {
                    description = `Moved ${lastAction.quantity} ${lastAction.category} from ${lastAction.fromLocation} to ${lastAction.toLocation}`;
                } else {
                    description = `Moved ${lastAction.quantity} ${lastAction.category || 'animals'}`;
                }
                break;
            case 'death':
                description = `Recorded death of ${lastAction.quantity} ${lastAction.category}`;
                if (lastAction.location) description += ` at ${lastAction.location}`;
                break;
            case 'birth':
                description = `Recorded birth of ${lastAction.quantity} ${lastAction.category}`;
                if (lastAction.location) description += ` at ${lastAction.location}`;
                break;
            case 'stock-count':
                description = `Stock count of ${lastAction.category}`;
                if (lastAction.location) description += ` at ${lastAction.location}`;
                break;
        }
        
        description += ` on ${formattedDate}`;
        
        const popupContent = `
            <div class="popup-content">
                <h3>Undo Last Action</h3>
                <p>This will undo the following action and adjust inventory accordingly:</p>
                <div class="last-action-details">
                    <p><strong>${description}</strong></p>
                </div>
                <form id="undo-form">
                    <div class="form-group">
                        <label for="reason">Reason for undoing:</label>
                        <textarea id="reason" name="reason" rows="3" placeholder="Enter reason for undoing this action" required></textarea>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="cancel-btn">Cancel</button>
                        <button type="submit" class="save-btn danger-btn">Undo Action</button>
                    </div>
                </form>
            </div>
        `;
        
        const popup = createPopup(popupContent);
        
        // Form submission handling
        const form = popup.querySelector('form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const reason = popup.querySelector('#reason').value.trim();
            if (!reason) {
                alert('Please enter a reason for undoing the action');
                return;
            }
            
            try {
                // Handle different types of actions
                switch(lastAction.type) {
                    case 'add':
                    case 'buy':
                    case 'birth':
                        // Similar to reversing an addition - decrease inventory
                        await undoAddition(lastAction, reason);
                        break;
                    case 'sell':
                    case 'death':
                        // Opposite of addition - increase inventory
                        await undoRemoval(lastAction, reason);
                        break;
                    case 'move':
                        // Move animals back to original location/category
                        await undoMove(lastAction, reason);
                        break;
                    case 'stock-count':
                        // Restore previous count
                        await undoStockCount(lastAction, reason);
                        break;
                }
                
                // Close popup
                popup.remove();
                
                // Notify user
                alert('Action has been undone successfully.');
            } catch (error) {
                console.error('Error undoing action:', error);
                alert('There was an error undoing the action. Please try again.');
            }
        });
        
        // Cancel button handling
        popup.querySelector('.cancel-btn').addEventListener('click', () => {
            popup.remove();
        });
    }
    
    // Helper functions for undoing different types of actions
    async function undoAddition(action, reason) {
        const category = action.category;
        const quantity = action.quantity;
        const location = action.location || 'Unspecified';
        
        // Handle inventory with the location structure
        if (animalInventory[category]) {
            if (typeof animalInventory[category] === 'number') {
                // Old format
                animalInventory[category] = Math.max(0, animalInventory[category] - quantity);
                
                // If count is zero, remove the category
                if (animalInventory[category] === 0) {
                    delete animalInventory[category];
                }
            } else if (typeof animalInventory[category] === 'object') {
                // New format with locations
                // First update the total
                animalInventory[category].total = Math.max(0, animalInventory[category].total - quantity);
                
                // Then update the specific location if it exists
                if (animalInventory[category].locations && animalInventory[category].locations[location]) {
                    animalInventory[category].locations[location] = Math.max(0, animalInventory[category].locations[location] - quantity);
                    
                    // If location count is zero, remove the location
                    if (animalInventory[category].locations[location] === 0) {
                        delete animalInventory[category].locations[location];
                    }
                }
                
                // If total is zero or no locations remain, remove the category
                if (animalInventory[category].total === 0 || Object.keys(animalInventory[category].locations).length === 0) {
                    delete animalInventory[category];
                }
            }
        }
        
        // Remove the original activity from the list
        const activityIndex = recentActivities.findIndex(a => 
            a.timestamp === action.timestamp && 
            a.type === action.type &&
            a.category === action.category
        );
        
        if (activityIndex !== -1) {
            recentActivities.splice(activityIndex, 1);
        }
        
        // Create an undo activity
        const undoActivity = {
            type: 'reversal',
            category: action.category,
            quantity: action.quantity,
            originalType: action.type,
            reason: reason,
            date: new Date().toISOString().split('T')[0],
            timestamp: new Date().toISOString(),
            description: `Undid ${action.type} of ${quantity} ${category} (${reason})`
        };
        
        // Add to activity log
        recentActivities.unshift(undoActivity);
        
        // If it was a purchase, remove from purchases
        if (action.type === 'buy') {
            const purchaseIndex = animalPurchases.findIndex(p => 
                p.timestamp === action.timestamp && 
                p.category === action.category
            );
            
            if (purchaseIndex !== -1) {
                animalPurchases.splice(purchaseIndex, 1);
            }
        }
        
        // Save updates to storage
        await mobileStorage.setItem('animalInventory', JSON.stringify(animalInventory));
        await mobileStorage.setItem('recentActivities', JSON.stringify(recentActivities));
        
        if (action.type === 'buy') {
            await mobileStorage.setItem('animalPurchases', JSON.stringify(animalPurchases));
        }
        
        // Update UI
        updateDisplays();
    }
    
    async function undoRemoval(action, reason) {
        const category = action.category;
        const quantity = action.quantity;
        const location = action.location || 'Unspecified';
        
        // Increase inventory - add animals back
        if (!animalInventory[category]) {
            // Create new entry
            animalInventory[category] = {
                total: quantity,
                locations: {}
            };
            animalInventory[category].locations[location] = quantity;
        } else {
            // Add to existing entry
            if (typeof animalInventory[category] === 'number') {
                // Convert old format to new format
                animalInventory[category] = {
                    total: animalInventory[category] + quantity,
                    locations: {
                        'Unspecified': animalInventory[category]
                    }
                };
                
                // Add to specified location
                if (location !== 'Unspecified') {
                    animalInventory[category].locations[location] = quantity;
                } else {
                    animalInventory[category].locations['Unspecified'] += quantity;
                }
            } else {
                // Update new format
                animalInventory[category].total += quantity;
                
                // Add to specified location
                if (!animalInventory[category].locations[location]) {
                    animalInventory[category].locations[location] = 0;
                }
                animalInventory[category].locations[location] += quantity;
            }
        }
        
        // Remove the original activity from the list
        const activityIndex = recentActivities.findIndex(a => 
            a.timestamp === action.timestamp && 
            a.type === action.type &&
            a.category === action.category
        );
        
        if (activityIndex !== -1) {
            recentActivities.splice(activityIndex, 1);
        }
        
        // Create an undo activity
        const undoActivity = {
            type: 'reversal',
            category: action.category,
            quantity: action.quantity,
            originalType: action.type,
            reason: reason,
            date: new Date().toISOString().split('T')[0],
            timestamp: new Date().toISOString(),
            description: `Undid ${action.type} of ${quantity} ${category} (${reason})`
        };
        
        // Add to activity log
        recentActivities.unshift(undoActivity);
        
        // If it was a sale, remove from sales
        if (action.type === 'sell') {
            const saleIndex = animalSales.findIndex(s => 
                s.timestamp === action.timestamp && 
                s.category === action.category
            );
            
            if (saleIndex !== -1) {
                animalSales.splice(saleIndex, 1);
            }
        }
        
        // Save updates to storage
        await mobileStorage.setItem('animalInventory', JSON.stringify(animalInventory));
        await mobileStorage.setItem('recentActivities', JSON.stringify(recentActivities));
        
        if (action.type === 'sell') {
            await mobileStorage.setItem('animalSales', JSON.stringify(animalSales));
        }
        
        // Update UI
        updateDisplays();
    }
    
    async function undoMove(action, reason) {
        // Complex case - need to move animals back to original location
        try {
            if (action.fromCategory && action.toCategory) {
                // Category move
                const quantity = action.quantity;
                const fromCategory = action.toCategory; // Reverse direction
                const toCategory = action.fromCategory;
                const fromLocation = action.toLocation || 'Unspecified';
                const toLocation = action.fromLocation || 'Unspecified';
                
                // First, ensure both categories exist 
                if (!animalInventory[fromCategory]) {
                    throw new Error(`Cannot undo move: ${fromCategory} doesn't exist in inventory`);
                }
                
                // Check if there are enough animals to move back
                if (typeof animalInventory[fromCategory] === 'number') {
                    if (animalInventory[fromCategory] < quantity) {
                        throw new Error(`Cannot undo move: not enough ${fromCategory} in inventory`);
                    }
                } else if (animalInventory[fromCategory].total < quantity) {
                    throw new Error(`Cannot undo move: not enough ${fromCategory} in inventory`);
                }
                
                // Remove from current category and location
                if (typeof animalInventory[fromCategory] === 'number') {
                    animalInventory[fromCategory] -= quantity;
                    if (animalInventory[fromCategory] <= 0) {
                        delete animalInventory[fromCategory];
                    }
                } else {
                    // Adjust total
                    animalInventory[fromCategory].total -= quantity;
                    
                    // Adjust location count
                    if (animalInventory[fromCategory].locations && animalInventory[fromCategory].locations[fromLocation]) {
                        animalInventory[fromCategory].locations[fromLocation] -= quantity;
                        if (animalInventory[fromCategory].locations[fromLocation] <= 0) {
                            delete animalInventory[fromCategory].locations[fromLocation];
                        }
                    }
                    
                    // If category is now empty, remove it
                    if (animalInventory[fromCategory].total <= 0 || 
                        Object.keys(animalInventory[fromCategory].locations).length === 0) {
                        delete animalInventory[fromCategory];
                    }
                }
                
                // Add to original category and location
                if (!animalInventory[toCategory]) {
                    animalInventory[toCategory] = {
                        total: quantity,
                        locations: {}
                    };
                    animalInventory[toCategory].locations[toLocation] = quantity;
                } else {
                    // Add to existing entry
                    if (typeof animalInventory[toCategory] === 'number') {
                        animalInventory[toCategory] += quantity;
                    } else {
                        animalInventory[toCategory].total += quantity;
                        
                        // Add to specified location
                        if (!animalInventory[toCategory].locations[toLocation]) {
                            animalInventory[toCategory].locations[toLocation] = 0;
                        }
                        animalInventory[toCategory].locations[toLocation] += quantity;
                    }
                }
            } else if (action.fromLocation && action.toLocation) {
                // Location-only move
                const quantity = action.quantity;
                const category = action.category;
                const fromLocation = action.toLocation; // Reverse direction
                const toLocation = action.fromLocation;
                
                if (!animalInventory[category] || typeof animalInventory[category] === 'number') {
                    throw new Error(`Cannot undo move: ${category} doesn't exist in proper format`);
                }
                
                // Check if there are enough animals at the current location
                if (!animalInventory[category].locations[fromLocation] || 
                    animalInventory[category].locations[fromLocation] < quantity) {
                    throw new Error(`Cannot undo move: not enough ${category} at ${fromLocation}`);
                }
                
                // Move animals back to original location
                animalInventory[category].locations[fromLocation] -= quantity;
                
                // Remove location if empty
                if (animalInventory[category].locations[fromLocation] <= 0) {
                    delete animalInventory[category].locations[fromLocation];
                }
                
                // Add to original location
                if (!animalInventory[category].locations[toLocation]) {
                    animalInventory[category].locations[toLocation] = 0;
                }
                animalInventory[category].locations[toLocation] += quantity;
            }
            
            // Remove the original move activity
            const activityIndex = recentActivities.findIndex(a => 
                a.timestamp === action.timestamp && 
                a.type === action.type &&
                ((a.category === action.category) || 
                 (a.fromCategory === action.fromCategory && a.toCategory === action.toCategory))
            );
            
            if (activityIndex !== -1) {
                recentActivities.splice(activityIndex, 1);
            }
            
            // Create an undo activity
            const undoActivity = {
                type: 'reversal',
                originalType: 'move',
                reason: reason,
                date: new Date().toISOString().split('T')[0],
                timestamp: new Date().toISOString()
            };
            
            // Set appropriate description based on move type
            if (action.fromCategory && action.toCategory) {
                undoActivity.fromCategory = action.toCategory;
                undoActivity.toCategory = action.fromCategory;
                undoActivity.fromLocation = action.toLocation;
                undoActivity.toLocation = action.fromLocation;
                undoActivity.quantity = action.quantity;
                undoActivity.description = `Undid move of ${action.quantity} from ${action.fromCategory} to ${action.toCategory} (${reason})`;
            } else {
                undoActivity.category = action.category;
                undoActivity.fromLocation = action.toLocation;
                undoActivity.toLocation = action.fromLocation;
                undoActivity.quantity = action.quantity;
                undoActivity.description = `Undid move of ${action.quantity} ${action.category} from ${action.fromLocation} to ${action.toLocation} (${reason})`;
            }
            
            // Add to activity log
            recentActivities.unshift(undoActivity);
            
            // Save updates to storage
            await mobileStorage.setItem('animalInventory', JSON.stringify(animalInventory));
            await mobileStorage.setItem('recentActivities', JSON.stringify(recentActivities));
            
            // Update UI
            updateDisplays();
        } catch (error) {
            console.error('Error undoing move:', error);
            alert(`Error: ${error.message}`);
            throw error;
        }
    }
    
    async function undoStockCount(action, reason) {
        // For stock counts, we need to look for discrepancy records that might have been created
        // and reverse those changes
        
        // First, check if this count created any discrepancies
        const relatedDiscrepancy = stockDiscrepancies.find(d => 
            d.countTimestamp === action.timestamp &&
            d.category === action.category &&
            (d.location === action.location || (!d.location && !action.location))
        );
        
        if (relatedDiscrepancy) {
            // If there was a discrepancy, we need to revert the inventory back to what it was before
            const category = action.category;
            const location = action.location || 'Unspecified';
            const expectedCount = relatedDiscrepancy.expectedCount;
            
            // Update inventory to expected count (what it was before the count)
            if (!animalInventory[category]) {
                // Create new entry if needed
                animalInventory[category] = {
                    total: expectedCount,
                    locations: {}
                };
                animalInventory[category].locations[location] = expectedCount;
            } else if (typeof animalInventory[category] === 'number') {
                // Convert old format
                animalInventory[category] = {
                    total: expectedCount,
                    locations: {
                        'Unspecified': expectedCount
                    }
                };
            } else {
                // Update location count
                animalInventory[category].total = animalInventory[category].total - 
                    (animalInventory[category].locations[location] || 0) + expectedCount;
                
                animalInventory[category].locations[location] = expectedCount;
            }
            
            // Remove the discrepancy record
            stockDiscrepancies = stockDiscrepancies.filter(d => d !== relatedDiscrepancy);
            await mobileStorage.setItem('stockDiscrepancies', JSON.stringify(stockDiscrepancies));
        }
        
        // Remove the original count activity
        const activityIndex = recentActivities.findIndex(a => 
            a.timestamp === action.timestamp && 
            a.type === action.type &&
            a.category === action.category
        );
        
        if (activityIndex !== -1) {
            recentActivities.splice(activityIndex, 1);
        }
        
        // Create an undo activity
        const undoActivity = {
            type: 'reversal',
            category: action.category,
            originalType: 'stock-count',
            reason: reason,
            date: new Date().toISOString().split('T')[0],
            timestamp: new Date().toISOString(),
            description: `Undid stock count of ${action.category} ${action.location ? `at ${action.location}` : ''} (${reason})`
        };
        
        // Add to activity log
        recentActivities.unshift(undoActivity);
        
        // Save updates to storage
        await mobileStorage.setItem('animalInventory', JSON.stringify(animalInventory));
        await mobileStorage.setItem('recentActivities', JSON.stringify(recentActivities));
        
        // Update UI
        updateDisplays();
    }

    // Add this function at the top level, before confirmClearAnimalData
    function showMessage(message, isError = false, duration = 3000) {
        // Create message element if it doesn't exist
        let messageElement = document.getElementById('global-message');
        if (!messageElement) {
            messageElement = document.createElement('div');
            messageElement.id = 'global-message';
            messageElement.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                padding: 15px 25px;
                border-radius: 5px;
                background-color: ${isError ? '#ff4444' : '#4CAF50'};
                color: white;
                z-index: 1000;
                box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                transition: opacity 0.3s ease-in-out;
            `;
            document.body.appendChild(messageElement);
        }

        // Set message content and style
        messageElement.textContent = message;
        messageElement.style.opacity = '1';
        messageElement.style.display = 'block';
        messageElement.style.backgroundColor = isError ? '#ff4444' : '#4CAF50';

        // Auto-hide after specified duration
        setTimeout(() => {
            messageElement.style.opacity = '0';
            setTimeout(() => {
                messageElement.style.display = 'none';
            }, 300);
        }, duration);
    }
}); 