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
        document.getElementById('reverse-last-btn')?.addEventListener('click', showReverseLastAdditionPopup, { passive: true });
        document.getElementById('clear-animal-data-btn')?.addEventListener('click', confirmClearAnimalData, { passive: true });
    }
    
    function updateDisplays() {
        updateInventoryDisplay();
        updateTransactionsDisplay();
        updateDiscrepanciesDisplay();
    }
    
    function updateInventoryDisplay() {
        const totalAnimalsElem = document.getElementById('total-animals');
        const inventoryBreakdownElem = document.getElementById('inventory-breakdown');
        
        // Calculate total animals
        const totalAnimals = Object.values(animalInventory).reduce((sum, count) => sum + count, 0);
        
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
            
            Object.entries(animalInventory).forEach(([category, count]) => {
                const item = document.createElement('div');
                item.className = 'inventory-item';
                item.innerHTML = `
                    <span class="category">${category}</span>
                    <span class="count">${count}</span>
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
            
            switch (transaction.type) {
                case 'add':
                    description = `Added ${transaction.quantity} ${transaction.category}`;
                    break;
                case 'sell':
                    description = `Sold ${transaction.quantity} ${transaction.category}`;
                    break;
                case 'buy':
                    description = `Purchased ${transaction.quantity} ${transaction.category}`;
                    break;
                case 'move':
                    if (transaction.fromCategory && transaction.toCategory) {
                        description = `Moved ${transaction.quantity} ${transaction.fromCategory} from ${transaction.fromCategory} to ${transaction.toCategory}`;
                    } else if (transaction.fromLocation && transaction.toLocation) {
                        // Handle legacy move records
                        description = `Moved ${transaction.quantity} ${transaction.category} from ${transaction.fromLocation} to ${transaction.toLocation}`;
                    } else {
                        description = `Moved ${transaction.quantity} ${transaction.category || 'animals'}`;
                    }
                    break;
                case 'death':
                    description = `Recorded death of ${transaction.quantity} ${transaction.category}`;
                    break;
                case 'birth':
                    description = `Recorded birth of ${transaction.quantity} ${transaction.category}`;
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
                    <span class="transaction-category">${transaction.category}</span>
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
                    ${discrepancy.notes ? `<div class="notes">Notes: ${discrepancy.notes}</div>` : ''}
                </div>
            `;
            
            discrepanciesElem.appendChild(item);
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
    
    async function showAddAnimalPopup() {
        const categories = await getAnimalCategories();
        
        // We no longer redirect to create category popup
        // if (categories.length === 0) {
        //     showCreateCategoryPopup();
        //     return;
        // }
        
        const popupContent = `
            <div class="popup-content">
                <h3>Add Livestock</h3>
                <form id="add-animal-form">
                    <div class="form-group">
                        <label for="category">Category:</label>
                        <select id="category" name="category" required>
                            <option value="" disabled selected>Select a category</option>
                            ${categories.map(category => 
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
                        <input type="number" id="quantity" name="quantity" min="1" placeholder="Enter quantity" required>
                    </div>
                    <div class="form-group">
                        <label for="add-date">Date:</label>
                        <input type="date" id="add-date" name="add-date" required value="${new Date().toISOString().split('T')[0]}">
                    </div>
                    <div class="form-actions">
                        <button type="button" class="cancel-btn">Cancel</button>
                        <button type="submit" class="save-btn">Add</button>
                    </div>
                </form>
            </div>
        `;
        
        const popup = createPopup(popupContent);
        
        // Category selection handling
        const categorySelect = popup.querySelector('#category');
        const newCategoryInput = popup.querySelector('.new-category-input');
        
        categorySelect.addEventListener('change', () => {
            if (categorySelect.value === 'new') {
                newCategoryInput.style.display = 'block';
                
                // Focus the new category input after a short delay to allow the display change to complete
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
        }, { passive: true });
        
        // Form submission handling
        const form = popup.querySelector('form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            let category;
            if (categorySelect.value === 'new') {
                category = popup.querySelector('#new-category').value.trim();
                if (!category) {
                    alert('Please enter a category name');
                    return;
                }
                
                // Add new category to saved categories
                const categories = await getAnimalCategories();
                if (!categories.includes(category)) {
                    categories.push(category);
                    await mobileStorage.setItem('animalCategories', JSON.stringify(categories));
                    // Also update localStorage for dashboard.js
                    localStorage.setItem('animalCategories', JSON.stringify(categories));
                    // Update our local copy
                    animalCategories = categories;
                }
            } else {
                category = categorySelect.value;
            }
            
            const quantity = parseInt(popup.querySelector('#quantity').value, 10);
            const date = popup.querySelector('#add-date').value;
            
            // Update inventory
            animalInventory[category] = (animalInventory[category] || 0) + quantity;
            await mobileStorage.setItem('animalInventory', JSON.stringify(animalInventory));
            
            // Add to recent activities
            const activity = {
                type: 'add',
                category,
                quantity,
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
                            ${Object.keys(animalInventory).map(category => 
                                `<option value="${category}">${category} (${animalInventory[category]} available)</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="quantity">Quantity:</label>
                        <input type="number" id="quantity" name="quantity" min="1" value="1" required>
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
        
        // Form submission handling
        const form = popup.querySelector('form');
        const categorySelect = popup.querySelector('#category');
        const quantityInput = popup.querySelector('#quantity');
        
        // Update max quantity based on selection
        categorySelect.addEventListener('change', () => {
            const category = categorySelect.value;
            const availableQuantity = animalInventory[category] || 0;
            quantityInput.max = availableQuantity;
            quantityInput.value = Math.min(quantityInput.value, availableQuantity);
        }, { passive: true });
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const category = categorySelect.value;
            const quantity = parseInt(quantityInput.value, 10);
            const price = parseFloat(popup.querySelector('#price').value);
            const buyer = popup.querySelector('#buyer').value.trim();
            const date = popup.querySelector('#sell-date').value;
            
            if (quantity > animalInventory[category]) {
                alert(`Not enough ${category} in inventory. Available: ${animalInventory[category]}`);
                return;
            }
            
            // Update inventory
            animalInventory[category] -= quantity;
            if (animalInventory[category] <= 0) {
                delete animalInventory[category];
            }
            await mobileStorage.setItem('animalInventory', JSON.stringify(animalInventory));
            
            // Add to sales
            const sale = {
                category,
                quantity,
                price,
                amount: price * quantity,
                buyer,
                date,
                currency: selectedCurrency,
                timestamp: new Date().toISOString()
            };
            
            animalSales.unshift(sale);
            await mobileStorage.setItem('animalSales', JSON.stringify(animalSales));
            
            // Add to recent activities
            const activity = {
                type: 'sell',
                category,
                quantity,
                price,
                buyer,
                date,
                currency: selectedCurrency,
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
    }
    
    function showMoveAnimalPopup() {
        // We no longer redirect to create category popup
        // Instead we check if there are animals in inventory
        if (Object.keys(animalInventory).length === 0) {
            alert('No animals in inventory to move');
            return;
        }
        
        const popupContent = `
            <div class="popup-content">
                <h3>Move Animals</h3>
                <form id="move-form">
                    <div class="form-group">
                        <label for="from-category">From Category:</label>
                        <select id="from-category" name="from-category" required>
                            <option value="" disabled selected>Select source category</option>
                            ${Object.keys(animalInventory).map(category => 
                                `<option value="${category}">${category} (${animalInventory[category]} available)</option>`
                            ).join('')}
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
        
        // Update max quantity based on selection
        fromCategorySelect.addEventListener('change', () => {
            const category = fromCategorySelect.value;
            const availableQuantity = animalInventory[category] || 0;
            quantityInput.max = availableQuantity;
            quantityInput.value = Math.min(quantityInput.value, availableQuantity);
        }, { passive: true });
        
        // Handle new category option
        toCategorySelect.addEventListener('change', () => {
            if (toCategorySelect.value === 'new') {
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
        }, { passive: true });
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const fromCategory = fromCategorySelect.value;
            const quantity = parseInt(quantityInput.value, 10);
            
            // Handle destination category (could be new or existing)
            let toCategory;
            if (toCategorySelect.value === 'new') {
                toCategory = popup.querySelector('#new-category').value.trim();
                if (!toCategory) {
                    alert('Please enter a new category name');
                    return;
                }
                
                // Add new category to saved categories
                if (!animalCategories.includes(toCategory)) {
                    animalCategories.push(toCategory);
                    await mobileStorage.setItem('animalCategories', JSON.stringify(animalCategories));
                    // Also update localStorage for dashboard.js
                    localStorage.setItem('animalCategories', JSON.stringify(animalCategories));
                }
            } else {
                toCategory = toCategorySelect.value;
            }
            
            if (fromCategory === toCategory) {
                alert('Source and destination categories cannot be the same');
                return;
            }
            
            const date = popup.querySelector('#move-date').value;
            const notes = popup.querySelector('#notes').value.trim();
            
            if (quantity > animalInventory[fromCategory]) {
                alert(`Not enough ${fromCategory} in inventory. Available: ${animalInventory[fromCategory]}`);
                return;
            }
            
            // Update inventory - reduce from source category
            animalInventory[fromCategory] -= quantity;
            if (animalInventory[fromCategory] <= 0) {
                delete animalInventory[fromCategory];
            }
            
            // Update inventory - add to destination category
            animalInventory[toCategory] = (animalInventory[toCategory] || 0) + quantity;
            await mobileStorage.setItem('animalInventory', JSON.stringify(animalInventory));
            
            // Add to recent activities
            const activity = {
                type: 'move',
                fromCategory,
                toCategory,
                quantity,
                notes,
                date,
                timestamp: new Date().toISOString()
            };
            
            recentActivities.unshift(activity);
            await mobileStorage.setItem('recentActivities', JSON.stringify(recentActivities));
            
            // Update UI
            updateDisplays();
            
            // Close popup and ensure it doesn't reappear immediately
            if (popup && document.body.contains(popup)) {
                document.body.removeChild(popup);
            }
            
            // Add a small delay before allowing another popup to be shown
            const moveButton = document.getElementById('move-animals-btn');
            if (moveButton) {
                moveButton.disabled = true;
                setTimeout(() => {
                    moveButton.disabled = false;
                }, 1000);
            }
            
            // Show success message
            setTimeout(() => {
                alert(`Successfully moved ${quantity} ${fromCategory} to ${toCategory}`);
            }, 300);
        });
        
        // Cancel button handling
        popup.querySelector('.cancel-btn').addEventListener('click', () => {
            popup.remove();
        });
    }
    
    function showDeathPopup() {
        // We no longer redirect to create category popup
        // Instead we check if there are animals in inventory
        if (Object.keys(animalInventory).length === 0) {
            alert('No animals in inventory to record death');
            return;
        }
        
        const popupContent = `
            <div class="popup-content">
                <h3>Record Death</h3>
                <form id="death-form">
                    <div class="form-group">
                        <label for="category">Category:</label>
                        <select id="category" name="category" required>
                            <option value="" disabled selected>Select a category</option>
                            ${Object.keys(animalInventory).map(category => 
                                `<option value="${category}">${category} (${animalInventory[category]} available)</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="quantity">Quantity:</label>
                        <input type="number" id="quantity" name="quantity" min="1" value="1" required>
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
        
        // Update max quantity based on selection
        categorySelect.addEventListener('change', () => {
            const category = categorySelect.value;
            const availableQuantity = animalInventory[category] || 0;
            quantityInput.max = availableQuantity;
            quantityInput.value = Math.min(quantityInput.value, availableQuantity);
        }, { passive: true });
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const category = categorySelect.value;
            const quantity = parseInt(quantityInput.value, 10);
            const reason = popup.querySelector('#reason').value.trim();
            const date = popup.querySelector('#death-date').value;
            
            if (quantity > animalInventory[category]) {
                alert(`Not enough ${category} in inventory. Available: ${animalInventory[category]}`);
                return;
            }
            
            // Update inventory
            animalInventory[category] -= quantity;
            if (animalInventory[category] <= 0) {
                delete animalInventory[category];
            }
            await mobileStorage.setItem('animalInventory', JSON.stringify(animalInventory));
            
            // Add to recent activities
            const activity = {
                type: 'death',
                category,
                quantity,
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
    }
    
    function showBirthPopup() {
        // We no longer redirect to create category popup
        // Instead we check if there are animals in inventory
        if (Object.keys(animalInventory).length === 0) {
            alert('No parent animals in inventory to record birth');
            return;
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
        
        // Form submission handling
        const form = popup.querySelector('form');
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const category = popup.querySelector('#category').value;
            const quantity = parseInt(popup.querySelector('#quantity').value, 10);
            const notes = popup.querySelector('#notes').value.trim();
            const date = popup.querySelector('#birth-date').value;
            
            // Update inventory
            animalInventory[category] = (animalInventory[category] || 0) + quantity;
            await mobileStorage.setItem('animalInventory', JSON.stringify(animalInventory));
            
            // Add to recent activities
            const activity = {
                type: 'birth',
                category,
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
        });
        
        // Cancel button handling
        popup.querySelector('.cancel-btn').addEventListener('click', () => {
            popup.remove();
        });
    }
    
    function showPurchaseAnimalPopup() {
        const categories = animalCategories;
        
        // We no longer redirect to create category popup
        // Instead, we still check if there are categories, but offer guidance if not
        if (!categories || categories.length === 0) {
            alert('No livestock categories exist yet. Please add a category using the "Add Livestock" button first.');
            return;
        }
        
        const popupContent = `
            <div class="popup-content">
                <h3>Purchase Animals</h3>
                <form id="purchase-form">
                        <div class="form-group">
                        <label for="category">Category:</label>
                        <select id="category" name="category" required>
                            <option value="" disabled selected>Select a category</option>
                            ${categories.map(category => 
                                `<option value="${category}">${category}</option>`
                            ).join('')}
                            <option value="new">+ Add New Category</option>
                        </select>
                            </div>
                    <div class="form-group new-category-input" style="display: none;">
                        <label for="new-category">New Category:</label>
                        <input type="text" id="new-category" name="new-category" placeholder="Enter new category name" inputmode="text" autocomplete="off" data-lpignore="true">
                        </div>
                    <div class="form-group">
                        <label for="quantity">Quantity:</label>
                        <input type="number" id="quantity" name="quantity" min="1" value="1" required inputmode="numeric" pattern="[0-9]*">
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
        
        // Category selection handling
        const categorySelect = popup.querySelector('#category');
        const newCategoryInput = popup.querySelector('.new-category-input');
        
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
        }, { passive: true });
        
        // Form submission handling
        const form = popup.querySelector('form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            let category;
            if (categorySelect.value === 'new') {
                category = popup.querySelector('#new-category').value.trim();
                if (!category) {
                    alert('Please enter a category name');
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
            const price = parseFloat(popup.querySelector('#price').value);
            const supplier = popup.querySelector('#supplier').value.trim();
            const date = popup.querySelector('#purchase-date').value;
            const notes = popup.querySelector('#notes').value.trim();
            
            // Update inventory
            animalInventory[category] = (animalInventory[category] || 0) + quantity;
            await mobileStorage.setItem('animalInventory', JSON.stringify(animalInventory));
            
            // Add to purchases
            const purchase = {
                category,
                quantity,
                price,
                amount: price * quantity,
                supplier,
                date,
                notes,
                currency: selectedCurrency,
                timestamp: new Date().toISOString()
            };
            
            animalPurchases.unshift(purchase);
            await mobileStorage.setItem('animalPurchases', JSON.stringify(animalPurchases));
            
            // Add to recent activities
            const activity = {
                type: 'buy',
                category,
                quantity,
                price,
                supplier,
                date,
                notes,
                currency: selectedCurrency,
                timestamp: new Date().toISOString(),
                description: `Purchased ${quantity} ${category} from ${supplier || 'unknown supplier'}`
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
    }
    
    function showStockCountPopup() {
        // Check if we have animals to count
        if (Object.keys(animalInventory).length === 0) {
            alert('No animals in inventory to count. Please add animals first.');
            return;
        }
        
        const popupContent = `
            <div class="popup-content">
                <h3>Stock Count</h3>
                <p class="instructions">Select a category and enter the actual count. Discrepancies will be recorded but inventory will not be changed.</p>
                <form id="stock-count-form">
                    <div class="form-group">
                        <label for="category">Category:</label>
                        <select id="category" name="category" required>
                            <option value="" disabled selected>Select a category</option>
                            ${Object.keys(animalInventory).map(category => 
                                `<option value="${category}">${category} (Current: ${animalInventory[category]})</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="actual-count">Actual Count:</label>
                        <input type="number" id="actual-count" name="actual-count" min="0" required inputmode="numeric" pattern="[0-9]*">
                        <span class="expected-count"></span>
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
        
        // Add category change handler to show current count
        const categorySelect = popup.querySelector('#category');
        const actualCountInput = popup.querySelector('#actual-count');
        const expectedCountSpan = popup.querySelector('.expected-count');
        
        categorySelect.addEventListener('change', (e) => {
            const selectedCategory = e.target.value;
            if (selectedCategory) {
                const expectedCount = animalInventory[selectedCategory] || 0;
                expectedCountSpan.textContent = `Expected count: ${expectedCount}`;
                actualCountInput.placeholder = `Current count is ${expectedCount}`;
                actualCountInput.dataset.expectedCount = expectedCount;
            }
        }, { passive: true });
        
        // Form submission
        const form = popup.querySelector('form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const category = categorySelect.value;
            if (!category) {
                alert('Please select a category');
                return;
            }
            
            const actualCount = parseInt(actualCountInput.value);
            if (isNaN(actualCount)) {
                alert('Please enter a valid count');
                return;
            }
            
            const expectedCount = parseInt(actualCountInput.dataset.expectedCount || 0);
            const notes = popup.querySelector('#notes').value.trim();
            const difference = actualCount - expectedCount;
            const countDate = new Date().toISOString();
            
            // Handle the stock count without changing inventory
            await handleStockCount({
                    category,
                actualCount,
                expectedCount,
                difference,
                notes,
                date: countDate
            });
            
            // Close popup
            popup.remove();
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
        
        // Create stock count record
            const stockCount = {
            type: 'stock-count',
                date: countDate,
            category: category,
            expectedCount: expectedCount,
            actualCount: actualCount,
            difference: difference,
            notes: notes
        };
        
        // Save to stockCounts
        let stockCounts = JSON.parse(await mobileStorage.getItem('stockCounts') || '[]');
        stockCounts.push(stockCount);
        await mobileStorage.setItem('stockCounts', JSON.stringify(stockCounts));
        
        // Create activity record
        const stockCountActivity = {
                type: 'stock-count',
                date: countDate,
            category: category,
            description: `Stock count for ${category}: Expected ${expectedCount}, Actual ${actualCount} (${difference >= 0 ? '+' : ''}${difference})`,
            notes: notes,
            timestamp: countDate
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
            
            // Notify user
            alert(`Stock count recorded. Discrepancy of ${difference >= 0 ? '+' : ''}${difference} ${category} has been recorded.`);
        } else {
            // If this count matches expected count, resolve any existing discrepancy
            if (existingDiscrepancyIndex !== -1) {
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
                
                // Notify user
                alert(`Stock count matches the expected count. Previous discrepancy for ${category} has been resolved.`);
            } else {
                // Notify user of successful count with no discrepancies
                alert(`Stock count matches the expected count. No discrepancies recorded.`);
            }
        }
            
            // Update UI
            updateDisplays();
    }

    // Function to confirm and clear all animal data
    async function confirmClearAnimalData() {
        const confirmed = confirm(
            'Are you sure you want to clear all animal data? This will remove:\n\n' +
            '- All animal categories\n' +
            '- Current inventory\n' +
            '- Purchase history\n' +
            '- Sales history\n' +
            '- Movement records\n' +
            '- Birth and death records\n' +
            '- Stock discrepancies\n\n' +
            'This action cannot be undone!'
        );
        
        if (confirmed) {
            try {
                // Clear all animal-related data
                animalInventory = {};
                animalCategories = [];
                animalSales = [];
                animalPurchases = [];
                stockDiscrepancies = [];
                
                // Filter out animal-related activities
                recentActivities = recentActivities.filter(
                    activity => !['add', 'sell', 'buy', 'move', 'death', 'birth', 'stock-count', 'resolution'].includes(activity.type)
                );
                
                // Save state to storage
                await mobileStorage.setItem('animalInventory', JSON.stringify({}));
                await mobileStorage.setItem('animalCategories', JSON.stringify([]));
                await mobileStorage.setItem('animalSales', JSON.stringify([]));
                await mobileStorage.setItem('animalPurchases', JSON.stringify([]));
                await mobileStorage.setItem('stockDiscrepancies', JSON.stringify([]));
                await mobileStorage.setItem('stockCounts', JSON.stringify([]));
                await mobileStorage.setItem('recentActivities', JSON.stringify(recentActivities));
                
                // Also update localStorage for dashboard
                localStorage.setItem('animalCategories', JSON.stringify([]));
                
                // Update UI
                updateDisplays();
                
                alert('All animal data has been cleared.');
            } catch (error) {
                console.error('Error clearing animal data:', error);
                alert('There was an error clearing data. Please try again.');
            }
        }
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
                
                // Make sure we don't go below zero
                animalInventory[category] = Math.max(0, (animalInventory[category] || 0) - quantity);
                
                // If count is zero, remove the category from inventory
                if (animalInventory[category] === 0) {
                    delete animalInventory[category];
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
}); 