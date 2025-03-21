// Setup keyboard detection for mobile devices
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
    let animalInventory = JSON.parse(await mobileStorage.getItem('animalInventory') || '{}');
    let recentActivities = JSON.parse(await mobileStorage.getItem('recentActivities') || '[]');
    let selectedCurrency = await mobileStorage.getItem('selectedCurrency') || 'ZAR';
    let stockDiscrepancies = JSON.parse(await mobileStorage.getItem('stockDiscrepancies') || '[]');
    let feedInventory = new Map(JSON.parse(await mobileStorage.getItem('feedInventory') || '[]'));
    let feedCalculations = JSON.parse(await mobileStorage.getItem('feedCalculations') || '[]');
    let healthRecords = JSON.parse(await mobileStorage.getItem('healthRecords') || '[]');
    let animalSales = JSON.parse(await mobileStorage.getItem('animalSales') || '[]');
    let animalPurchases = JSON.parse(await mobileStorage.getItem('animalPurchases') || '[]');
    
    // Initialize animal categories
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
    await updateDisplays();
    
    function setupEventListeners() {
        // Add Livestock button
        document.getElementById('add-livestock-btn')?.addEventListener('click', showAddLivestockPopup);
        
        // Logout button
        document.getElementById('logout-button').addEventListener('click', async () => {
            await mobileStorage.setItem('isLoggedIn', 'false');
            window.location.href = 'index.html';
        });
        
        // Currency selector
        const currencySelector = document.getElementById('currency-select');
        if (currencySelector) {
            currencySelector.addEventListener('change', async (e) => {
                selectedCurrency = e.target.value;
                await mobileStorage.setItem('selectedCurrency', selectedCurrency);
                updateFinancialDisplays();
            });
        }
    }
    
    function showAddLivestockPopup() {
        const popup = document.createElement('div');
        popup.className = 'popup';
        popup.innerHTML = `
            <div class="popup-content">
                <h3>Add Livestock</h3>
                <form id="add-livestock-form">
                    <div class="form-group">
                        <label for="category">Category:</label>
                        <select id="category" name="category" required>
                            <option value="" disabled selected>Select a category</option>
                            ${getAnimalCategories().map(category => 
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
        
        document.body.appendChild(popup);
        
        // Category selection handling
        const categorySelect = popup.querySelector('#category');
        const newCategoryInput = popup.querySelector('.new-category-input');
        
        categorySelect.addEventListener('change', () => {
            if (categorySelect.value === 'new') {
                newCategoryInput.style.display = 'block';
                // Focus the new category input when it becomes visible
                setTimeout(() => {
                    popup.querySelector('#new-category').focus();
                }, 100);
            } else {
                newCategoryInput.style.display = 'none';
            }
        });
        
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
                const categories = getAnimalCategories();
                if (!categories.includes(category)) {
                    categories.push(category);
                    // Save to both storage systems for consistency
                    await mobileStorage.setItem('animalCategories', JSON.stringify(categories));
                    localStorage.setItem('animalCategories', JSON.stringify(categories));
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
            if (recentActivities.length > 10) recentActivities.pop();
            await mobileStorage.setItem('recentActivities', JSON.stringify(recentActivities));
            
            // Update UI
            await updateDisplays();
            
            // Close popup
            popup.remove();
        });
        
        // Cancel button handling
        popup.querySelector('.cancel-btn').addEventListener('click', () => {
            popup.remove();
        });
        
        // Focus the first interactive element
        setTimeout(() => {
            popup.querySelector('#category').focus();
        }, 300);
    }
    
    function getAnimalCategories() {
        // First try to get from mobile storage (Capacitor)
        let categoriesFromStorage = null;
        
        try {
            const storedCategories = localStorage.getItem('animalCategories');
            if (storedCategories) {
                categoriesFromStorage = JSON.parse(storedCategories);
                if (Array.isArray(categoriesFromStorage) && categoriesFromStorage.length > 0) {
                    return categoriesFromStorage;
                }
            }
        } catch (e) {
            console.error('Error parsing animal categories from localStorage:', e);
        }
        
        // Try to extract categories from inventory if no saved categories
        if (animalInventory && Object.keys(animalInventory).length > 0) {
            const categoriesFromInventory = Object.keys(animalInventory);
            // Save these categories for next time
            localStorage.setItem('animalCategories', JSON.stringify(categoriesFromInventory));
            
            // Also save to mobileStorage for consistency across pages
            mobileStorage.setItem('animalCategories', JSON.stringify(categoriesFromInventory))
                .catch(e => console.error('Error saving categories to mobileStorage:', e));
                
            return categoriesFromInventory;
        }
        
        // Return empty array if no categories found
        return [];
    }
    
    async function updateDisplays() {
        updateInventoryDisplay();
        await updateStockDiscrepancies();
        updateRecentActivities();
        updateFeedStatus();
        await updateFeedCalculations();
        updateFinancialDisplays();
        updateHealthStatus();
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
            if (Object.keys(animalInventory).length === 0) {
                inventoryBreakdownElem.innerHTML = '<p class="no-data">No animals in inventory</p>';
                return;
            }
            
            inventoryBreakdownElem.innerHTML = '';
            
            // Sort categories alphabetically
            const sortedCategories = Object.keys(animalInventory).sort();
            
            sortedCategories.forEach(category => {
                const count = animalInventory[category];
                const item = document.createElement('div');
                item.className = 'inventory-item';
                
                // Removed stock status indicator
                item.innerHTML = `
                    <span class="inventory-category">${category}</span>
                    <span class="inventory-count">${count}</span>
                `;
                inventoryBreakdownElem.appendChild(item);
            });
        }
    }
    
    async function updateStockDiscrepancies() {
        const discrepanciesElem = document.getElementById('stock-discrepancies');
        if (!discrepanciesElem) return;
        
        // Reload stockDiscrepancies from storage to ensure we have the latest data
        stockDiscrepancies = JSON.parse(await mobileStorage.getItem('stockDiscrepancies') || '[]');
        
        if (!stockDiscrepancies || stockDiscrepancies.length === 0) {
            discrepanciesElem.innerHTML = '<p class="no-data">No stock count discrepancies</p>';
            return;
        }
        
        // Filter out resolved discrepancies
        const unresolvedDiscrepancies = stockDiscrepancies.filter(d => !d.resolved);
        
        if (unresolvedDiscrepancies.length === 0) {
            discrepanciesElem.innerHTML = '<p class="no-data">No active stock discrepancies</p>';
            return;
        }
        
        // Sort discrepancies by date, most recent first
        const sortedDiscrepancies = [...unresolvedDiscrepancies].sort((a, b) => 
            new Date(b.date || b.timestamp) - new Date(a.date || a.timestamp)
        );
        
        discrepanciesElem.innerHTML = '';
        
        // Display the most recent 3 discrepancies
        sortedDiscrepancies.slice(0, 3).forEach(discrepancy => {
            const item = document.createElement('div');
            item.className = 'discrepancy-item';
            
            const date = new Date(discrepancy.date || discrepancy.timestamp).toLocaleDateString();
            const category = discrepancy.category || 'Unknown';
            const expected = discrepancy.expected || 0;
            const actual = discrepancy.actual || 0;
            const difference = actual - expected;
            
            // Determine if it's a positive or negative difference
            const diffClass = difference < 0 ? 'negative-diff' : 'positive-diff';
            const diffPrefix = difference > 0 ? '+' : '';
            
            item.innerHTML = `
                <div class="discrepancy-details">
                    <span class="discrepancy-category">${category}</span>
                    <span class="discrepancy-date">${date}</span>
                </div>
                <div class="discrepancy-counts">
                    <div class="expected-count">Expected: <span>${expected}</span></div>
                    <div class="actual-count">Actual: <span>${actual}</span></div>
                    <div class="difference ${diffClass}">Difference: <span>${diffPrefix}${difference}</span></div>
                </div>
            `;
            
            discrepanciesElem.appendChild(item);
        });
        
        // If there are more than 3 discrepancies, add a "show more" note
        if (sortedDiscrepancies.length > 3) {
            const showMore = document.createElement('p');
            showMore.className = 'show-more';
            showMore.textContent = `+ ${sortedDiscrepancies.length - 3} more discrepancies`;
            discrepanciesElem.appendChild(showMore);
        }
    }
    
    function updateRecentActivities() {
        const activitiesElem = document.getElementById('activities-list');
        if (!activitiesElem) return;
        
        if (recentActivities.length === 0) {
            activitiesElem.innerHTML = '<p class="no-data">No recent activities</p>';
            return;
        }
        
        activitiesElem.innerHTML = '';
        
        // Display most recent 5 activities
        recentActivities.slice(0, 5).forEach(activity => {
            const activityItem = document.createElement('div');
            activityItem.className = 'activity-item';
            
            // Add activity-specific class based on type
            if (activity.type) {
                activityItem.classList.add(`activity-${activity.type}`);
            }
            
            const date = new Date(activity.timestamp || activity.date).toLocaleString();
            let actionText = '';
            let detailsText = '';
            let priceInfo = '';
            let categoryText = '';
            
            // Set standard category text based on activity type
            if (activity.type === 'add') categoryText = 'Stock Added';
            else if (activity.type === 'sell' || activity.type === 'sale') categoryText = 'Stock Sold';
            else if (activity.type === 'buy' || activity.type === 'purchase') categoryText = 'Stock Purchased';
            else if (activity.type === 'move' || activity.type === 'movement') categoryText = 'Stock Moved';
            else if (activity.type === 'death') categoryText = 'Stock Deaths';
            else if (activity.type === 'birth') categoryText = 'Stock Births';
            else categoryText = activity.category || '';
            
            // Format currency if present
            const formatCurrency = (amount, currencyCode) => {
                const currency = worldCurrencies.find(c => c.code === (currencyCode || selectedCurrency));
                const symbol = currency ? currency.symbol : '';
                return `${symbol}${parseFloat(amount).toFixed(2)}`;
            };
            
            // Handle different types of activities
            if (typeof activity === 'string') {
                // For old string-based activities
                actionText = activity;
            } else if (activity.type) {
                // For new object-based activities
                switch (activity.type) {
                    case 'add':
                        actionText = `Added ${activity.quantity} ${activity.category}`;
                        detailsText = `${new Date(activity.date).toLocaleDateString()}`;
                        break;
                        
                    case 'remove':
                        actionText = `Removed ${activity.quantity} ${activity.category}`;
                        if (activity.reason) {
                            detailsText = `Reason: ${activity.reason}`;
                        }
                        break;
                        
                    case 'sell':
                    case 'sale':
                        actionText = `Sold ${activity.quantity} ${activity.category}`;
                        if (activity.buyer) {
                            detailsText = `Buyer: ${activity.buyer}`;
                        }
                        if (activity.price) {
                            const total = activity.price * activity.quantity;
                            priceInfo = `
                                <div class="activity-financial">
                                    <span class="price">Price: ${formatCurrency(activity.price, activity.currency)} each</span>
                                    <span class="total income">Total: ${formatCurrency(total, activity.currency)}</span>
                                </div>
                            `;
                        }
                        break;
                        
                    case 'buy':
                    case 'purchase':
                        actionText = `Purchased ${activity.quantity} ${activity.category}`;
                        if (activity.supplier) {
                            detailsText = `Supplier: ${activity.supplier}`;
                        }
                        if (activity.price) {
                            const total = activity.price * activity.quantity;
                            priceInfo = `
                                <div class="activity-financial">
                                    <span class="price">Price: ${formatCurrency(activity.price, activity.currency)} each</span>
                                    <span class="total expense">Total: ${formatCurrency(total, activity.currency)}</span>
                                </div>
                            `;
                        }
                        break;
                        
                    case 'move':
                    case 'movement':
                        if (activity.fromCategory && activity.toCategory) {
                            actionText = `Moved ${activity.quantity} from ${activity.fromCategory} to ${activity.toCategory}`;
                        } else if (activity.fromLocation && activity.toLocation) {
                            actionText = `Moved ${activity.quantity} ${activity.category} from ${activity.fromLocation} to ${activity.toLocation}`;
                        } else {
                            actionText = `Moved ${activity.quantity} ${activity.fromCategory || activity.category || 'animals'}`;
                        }
                        if (activity.notes) {
                            detailsText = `Notes: ${activity.notes}`;
                        }
                        break;
                        
                    case 'death':
                        actionText = `Recorded ${activity.quantity} ${activity.category} deaths`;
                        if (activity.reason) {
                            detailsText = `Reason: ${activity.reason}`;
                        }
                        break;
                        
                    case 'birth':
                        actionText = `Recorded birth of ${activity.quantity} ${activity.category}`;
                        if (activity.notes) {
                            detailsText = `Notes: ${activity.notes}`;
                        }
                        break;
                        
                    case 'feed-purchase':
                        actionText = `Purchased ${activity.quantity} ${activity.unit || 'units'} of ${activity.feedType}`;
                        if (activity.supplier) {
                            detailsText = `Supplier: ${activity.supplier}`;
                        }
                        if (activity.price) {
                            const total = activity.price * activity.quantity;
                            priceInfo = `
                                <div class="activity-financial">
                                    <span class="price">Price: ${formatCurrency(activity.price, activity.currency)} per ${activity.unit || 'unit'}</span>
                                    <span class="total expense">Total: ${formatCurrency(total, activity.currency)}</span>
                                </div>
                            `;
                        }
                        break;
                        
                    case 'feed-usage':
                        actionText = `Used ${activity.quantity} ${activity.unit || 'units'} of ${activity.feedType}`;
                        if (activity.notes) {
                            detailsText = `Notes: ${activity.notes}`;
                        }
                        if (activity.animals) {
                            detailsText = detailsText ? `${detailsText}, For: ${activity.animals}` : `For: ${activity.animals}`;
                        }
                        break;
                        
                    case 'health':
                        actionText = `Added health record for ${activity.category}`;
                        if (activity.condition) {
                            detailsText = `Condition: ${activity.condition}`;
                        }
                        break;
                        
                    case 'vaccination':
                        actionText = `Vaccinated ${activity.category} with ${activity.vaccine}`;
                        if (activity.notes) {
                            detailsText = `Notes: ${activity.notes}`;
                        }
                        break;
                        
                    case 'treatment':
                        actionText = `Started treatment for ${activity.category}`;
                        if (activity.treatment) {
                            detailsText = `Treatment: ${activity.treatment}`;
                        }
                        break;
                        
                    case 'medication':
                        actionText = `Administered medication to ${activity.category}`;
                        if (activity.medication) {
                            detailsText = `Medication: ${activity.medication}`;
                        }
                        break;
                        
                    case 'stock-count':
                        if (activity.difference) {
                            const diffPrefix = activity.difference > 0 ? '+' : '';
                            actionText = `Stock count for ${activity.category}`;
                            detailsText = `Expected: ${activity.expectedCount}, Actual: ${activity.actualCount} (${diffPrefix}${activity.difference})`;
                        } else if (activity.description) {
                            actionText = activity.description;
                        } else {
                            actionText = `Stock count for ${activity.category}`;
                        }
                        break;
                        
                    case 'resolution':
                        actionText = activity.description || `Resolved discrepancy for ${activity.category}`;
                        if (activity.finalCount) {
                            detailsText = `Final count: ${activity.finalCount}`;
                        }
                        break;
                        
                    case 'reversal':
                        actionText = `Reversed ${activity.originalType} of ${activity.quantity} ${activity.category}`;
                        if (activity.reason) {
                            detailsText = `Reason: ${activity.reason}`;
                        }
                        break;
                        
                    default:
                        actionText = activity.description || `Activity: ${activity.type}`;
                }
            } else if (activity.description) {
                // Fallback to description field
                actionText = activity.description;
            } else {
                // If all else fails
                actionText = 'Unknown activity';
            }
            
            // Build the HTML content
            let content = `
                <div class="activity-header">
                    <span class="activity-category">${categoryText}</span>
                    <span class="activity-date">${date}</span>
                </div>
                <div class="activity-details">
                    <span class="activity-action">${actionText}</span>
                    ${detailsText ? `<span class="activity-extra">${detailsText}</span>` : ''}
                    ${priceInfo}
                </div>
            `;
            
            activityItem.innerHTML = content;
            activitiesElem.appendChild(activityItem);
        });
    }
    
    function updateFeedStatus() {
        const feedStatusElem = document.getElementById('feed-status');
        if (!feedStatusElem) return;
        
        // Convert feedInventory from string map if needed
        let feedInventoryData;
        if (typeof feedInventory === 'string') {
            try {
                feedInventoryData = JSON.parse(feedInventory);
            } catch (e) {
                console.error('Error parsing feed inventory:', e);
                feedInventoryData = {};
            }
        } else if (feedInventory instanceof Map) {
            feedInventoryData = Object.fromEntries(feedInventory);
        } else if (typeof feedInventory === 'object') {
            feedInventoryData = feedInventory;
        } else {
            feedInventoryData = {};
        }
        
        if (Object.keys(feedInventoryData).length === 0) {
            feedStatusElem.innerHTML = '<p class="no-data">No feed in inventory</p>';
            return;
        }
        
        // Create grid view for feed items - with full width style
        let content = '<div class="feed-status-grid" style="width:100%; box-sizing:border-box;">';
        
        Object.entries(feedInventoryData).forEach(([feedType, data]) => {
            // Default values if needed
            const quantity = data.quantity || 0;
            const unit = data.unit || 'kg';
            const threshold = data.threshold || 0;
            
            // Determine feed status
            const isLow = quantity <= threshold;
            const statusClass = isLow ? 'low-feed' : 'good-feed';
            const quantityColor = isLow ? 'color: #e74c3c;' : 'color: #2ecc71;';
            
            // Format last update text
            const lastUpdated = data.lastUpdated 
                ? `Last updated: ${new Date(data.lastUpdated).toLocaleDateString()}`
                : 'Never updated';
                
            // Format supplier text
            const supplier = data.supplier 
                ? `Supplier: ${data.supplier}`
                : 'No supplier specified';
            
            content += `
                <div class="feed-item ${statusClass}" style="width:100%; box-sizing:border-box;">
                    <div class="feed-item-header">
                        <span class="feed-name">${feedType}</span>
                        <span class="feed-quantity" style="${quantityColor}">${quantity} ${unit}</span>
                    </div>
                    <div class="feed-details">
                        Threshold: ${threshold} ${unit}<br>
                        ${supplier}<br>
                        ${lastUpdated}
                    </div>
                </div>
            `;
        });
        
        content += '</div>';
        feedStatusElem.innerHTML = content;
    }
    
    // Function to reload feed calculations from storage
    async function reloadFeedCalculations() {
        // Reload the latest feed calculations from storage
        feedCalculations = JSON.parse(await mobileStorage.getItem('feedCalculations') || '[]');
        return feedCalculations;
    }

    async function updateFeedCalculations() {
        const calculationsElem = document.getElementById('feed-calculations');
        if (!calculationsElem) return;
        
        // Reload from storage to ensure we have the latest data
        await reloadFeedCalculations();
        
        if (!feedCalculations || feedCalculations.length === 0) {
            calculationsElem.innerHTML = '<p class="no-data">No feed calculations available</p>';
            return;
        }
        
        // Filter out duplicates by using a unique timestamp-based identifier
        const uniqueCalculations = [];
        const uniqueTimestamps = new Set();
        
        feedCalculations.forEach(calc => {
            // Create a unique identifier based only on timestamp (to match the exact data from feed.js)
            const date = new Date(calc.date || calc.timestamp);
            const uniqueId = date.getTime().toString();
            
            if (!uniqueTimestamps.has(uniqueId)) {
                uniqueTimestamps.add(uniqueId);
                uniqueCalculations.push(calc);
            }
        });
        
        // Sort calculations by date, most recent first
        const sortedCalculations = uniqueCalculations.sort((a, b) => 
            new Date(b.date || b.timestamp) - new Date(a.date || a.timestamp)
        );
        
        calculationsElem.innerHTML = '';
        
        // Display the most recent 3 calculations with enhanced details using normalized field mapping
        sortedCalculations.slice(0, 3).forEach(calc => {
            const item = document.createElement('div');
            item.className = 'calculation-item';
            
            // Get standardized values (with fallbacks) to ensure consistency between pages
            const date = new Date(calc.date || calc.timestamp).toLocaleDateString();
            const category = calc.animalCategory || calc.category || 'All animals';
            const animalCount = calc.animalCount || calc.numAnimals || 0;
            const feedType = calc.feedType || 'Unknown';
            const duration = calc.duration || 1;
            const dailyIntake = calc.dailyIntake || 0;
            const dailyIntakeKg = dailyIntake / 1000;
            const totalDailyCost = calc.totalDailyCost || 0;
            const totalCost = calc.totalCost || 0;
            const totalFeedNeeded = calc.totalFeedNeeded || (dailyIntakeKg * animalCount * duration);
            
            // Get currency symbol
            const currency = worldCurrencies.find(c => c.code === selectedCurrency)?.symbol || 'R';
            
            item.innerHTML = `
                <div class="calculation-header">
                    <span class="calculation-title">${category} (${animalCount} animals)</span>
                    <span class="calculation-result">${totalFeedNeeded.toFixed(2)} kg</span>
                </div>
                <div class="calculation-details">
                    <div class="calculation-main-details">
                        <span>Feed: ${feedType}</span>
                        <span class="per-animal">${dailyIntakeKg.toFixed(2)} kg/animal/day</span>
                    </div>
                    <div class="calculation-costs">
                        <div>Daily cost: ${currency}${totalDailyCost.toFixed(2)}</div>
                        <div>Per animal: ${currency}${(animalCount > 0 ? totalDailyCost / animalCount : 0).toFixed(2)}/day</div>
                        <div class="total-cost">Total (${duration} days): ${currency}${totalCost.toFixed(2)}</div>
                    </div>
                    <div class="calculation-date">Calculated: ${date}</div>
                </div>
            `;
            
            calculationsElem.appendChild(item);
        });
        
        // If there are more than 3 calculations, add a "show more" note
        if (sortedCalculations.length > 3) {
            const showMore = document.createElement('p');
            showMore.className = 'show-more';
            showMore.textContent = `+ ${sortedCalculations.length - 3} more calculations`;
            calculationsElem.appendChild(showMore);
        }
    }
    
    function updateFinancialDisplays() {
        updateTotalSales();
        updateTotalPurchases();
    }
    
    function updateTotalSales() {
        const salesDisplayElem = document.getElementById('total-sales-display');
        const lastSaleInfoElem = document.getElementById('last-sale-info');
        const currencySelectElem = document.getElementById('currency-select');
        
        if (currencySelectElem) {
            // Populate currency selector if empty
            if (currencySelectElem.children.length === 0) {
                worldCurrencies.forEach(currency => {
                    const option = document.createElement('option');
                    option.value = currency.code;
                    option.textContent = `${currency.name} (${currency.symbol})`;
                    option.selected = currency.code === selectedCurrency;
                    currencySelectElem.appendChild(option);
                });
            }
        }
        
        // Calculate total sales
        const totalSales = animalSales.reduce((sum, sale) => sum + (sale.amount || 0), 0);
        const totalAnimalsSold = animalSales.reduce((sum, sale) => sum + (sale.quantity || 0), 0);
        const averagePrice = totalAnimalsSold > 0 ? totalSales / totalAnimalsSold : 0;
        
        // Update total sales display
        if (salesDisplayElem) {
            const currency = worldCurrencies.find(c => c.code === selectedCurrency) || worldCurrencies[6]; // Default to ZAR
            salesDisplayElem.textContent = `${currency.symbol}${totalSales.toFixed(2)} ${currency.code}`;
            
            // Update average price
            const averagePriceElem = salesDisplayElem.nextElementSibling;
            if (averagePriceElem && averagePriceElem.classList.contains('average-price')) {
                averagePriceElem.textContent = `Average: ${currency.symbol}${averagePrice.toFixed(2)} per animal`;
            }
        }
        
        // Update last sale info with more details
        if (lastSaleInfoElem) {
            if (animalSales.length > 0) {
                // Get the last 3 sales
                const recentSales = animalSales.slice(0, 3);
                let salesContent = '';
                
                // Loop through recent sales to create detailed content
                recentSales.forEach((sale, index) => {
                    const currency = worldCurrencies.find(c => c.code === (sale.currency || selectedCurrency)) || worldCurrencies[6];
                    const date = new Date(sale.date).toLocaleDateString();
                    const pricePerUnit = sale.price || (sale.amount / sale.quantity);
                    
                    salesContent += `
                        <div class="sale-item ${index === 0 ? 'latest-sale' : ''}">
                            <div class="sale-header">
                                <span class="sale-category">${sale.quantity} ${sale.category}</span>
                                <span class="sale-amount">${currency.symbol}${sale.amount.toFixed(2)}</span>
                            </div>
                            <div class="sale-details">
                                <div class="sale-info">
                                    <span class="sale-date">Date: ${date}</span>
                                    ${sale.buyer ? `<span class="sale-buyer">Buyer: ${sale.buyer}</span>` : ''}
                                </div>
                                <div class="sale-pricing">
                                    <span class="price-per-unit">${currency.symbol}${pricePerUnit.toFixed(2)} each</span>
                                </div>
                            </div>
                            ${sale.notes ? `<div class="sale-notes">${sale.notes}</div>` : ''}
                        </div>
                    `;
                });
                
                // If there are more sales, add a note
                if (animalSales.length > 3) {
                    salesContent += `<div class="more-sales">+ ${animalSales.length - 3} more sales</div>`;
                }
                
                lastSaleInfoElem.innerHTML = `
                    <p class="transaction-label">Recent Sales:</p>
                    <div class="sales-list">
                        ${salesContent}
                    </div>
                `;
            } else {
                lastSaleInfoElem.innerHTML = `
                    <p class="transaction-label">Recent Sales:</p>
                    <p class="transaction-details">No recent sales</p>
                `;
            }
        }
    }
    
    function updateTotalPurchases() {
        const purchasesDisplayElem = document.getElementById('total-purchases-display');
        const lastPurchaseInfoElem = document.getElementById('last-purchase-info');
        
        // Calculate total purchases
        const totalPurchases = animalPurchases.reduce((sum, purchase) => sum + (purchase.amount || 0), 0);
        const totalAnimalsPurchased = animalPurchases.reduce((sum, purchase) => sum + (purchase.quantity || 0), 0);
        const averagePrice = totalAnimalsPurchased > 0 ? totalPurchases / totalAnimalsPurchased : 0;
        
        // Update total purchases display
        if (purchasesDisplayElem) {
            const currency = worldCurrencies.find(c => c.code === selectedCurrency) || worldCurrencies[6]; // Default to ZAR
            purchasesDisplayElem.textContent = `${currency.symbol}${totalPurchases.toFixed(2)} ${currency.code}`;
            
            // Update average price
            const averagePriceElem = purchasesDisplayElem.nextElementSibling;
            if (averagePriceElem && averagePriceElem.classList.contains('average-purchase-price')) {
                averagePriceElem.textContent = `Average: ${currency.symbol}${averagePrice.toFixed(2)} per animal`;
            }
        }
        
        // Update purchase info with more details
        if (lastPurchaseInfoElem) {
            if (animalPurchases.length > 0) {
                // Get the last 3 purchases
                const recentPurchases = animalPurchases.slice(0, 3);
                let purchasesContent = '';
                
                // Loop through recent purchases to create detailed content
                recentPurchases.forEach((purchase, index) => {
                    const currency = worldCurrencies.find(c => c.code === (purchase.currency || selectedCurrency)) || worldCurrencies[6];
                    const date = new Date(purchase.date).toLocaleDateString();
                    const pricePerUnit = purchase.price || (purchase.amount / purchase.quantity);
                    
                    purchasesContent += `
                        <div class="purchase-item ${index === 0 ? 'latest-purchase' : ''}">
                            <div class="purchase-header">
                                <span class="purchase-category">${purchase.quantity} ${purchase.category}</span>
                                <span class="purchase-amount">${currency.symbol}${purchase.amount.toFixed(2)}</span>
                            </div>
                            <div class="purchase-details">
                                <div class="purchase-info">
                                    <span class="purchase-date">Date: ${date}</span>
                                    ${purchase.supplier ? `<span class="purchase-supplier">Supplier: ${purchase.supplier}</span>` : ''}
                                </div>
                                <div class="purchase-pricing">
                                    <span class="price-per-unit">${currency.symbol}${pricePerUnit.toFixed(2)} each</span>
                                </div>
                            </div>
                            ${purchase.notes ? `<div class="purchase-notes">${purchase.notes}</div>` : ''}
                        </div>
                    `;
                });
                
                // If there are more purchases, add a note
                if (animalPurchases.length > 3) {
                    purchasesContent += `<div class="more-purchases">+ ${animalPurchases.length - 3} more purchases</div>`;
                }
                
                lastPurchaseInfoElem.innerHTML = `
                    <p class="transaction-label">Recent Purchases:</p>
                    <div class="purchases-list">
                        ${purchasesContent}
                    </div>
                `;
            } else {
                lastPurchaseInfoElem.innerHTML = `
                    <p class="transaction-label">Recent Purchases:</p>
                    <p class="transaction-details">No recent purchases</p>
                `;
            }
        }
    }
    
    function updateHealthStatus() {
        const healthStatusElem = document.getElementById('health-status');
        if (!healthStatusElem) return;
        
        if (!healthRecords || healthRecords.length === 0) {
            healthStatusElem.innerHTML = '<p class="no-data">No health records available</p>';
            return;
        }
        
        // Sort records by date, most recent first
        const sortedRecords = [...healthRecords].sort((a, b) => 
            new Date(b.date || b.timestamp) - new Date(a.date || a.timestamp)
        );
        
        // Categorize records
        const vaccinations = sortedRecords.filter(record => record.type === 'vaccination');
        const treatments = sortedRecords.filter(record => record.type === 'treatment');
        const medications = sortedRecords.filter(record => record.type === 'medication');
        const healthRecordsGeneral = sortedRecords.filter(record => 
            record.type === 'health-record' || !record.type
        );
        
        // Count severity for general health records
        const severityCounts = {
            mild: healthRecordsGeneral.filter(r => r.severity === 'mild').length,
            moderate: healthRecordsGeneral.filter(r => r.severity === 'moderate').length,
            severe: healthRecordsGeneral.filter(r => r.severity === 'severe').length
        };
        
        // Get counts of recent activity (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentRecords = sortedRecords.filter(record => 
            new Date(record.date || record.timestamp) >= thirtyDaysAgo
        );
        
        // Create health dashboard content
        let content = `
            <div class="health-summary">
                <div class="summary-stats">
                    <div class="summary-stat">
                        <span class="stat-value">${sortedRecords.length}</span>
                        <span class="stat-label">Total Records</span>
                    </div>
                    <div class="summary-stat">
                        <span class="stat-value">${recentRecords.length}</span>
                        <span class="stat-label">Last 30 Days</span>
                    </div>
                    <div class="summary-stat ${severityCounts.severe > 0 ? 'alert' : ''}">
                        <span class="stat-value">${severityCounts.severe}</span>
                        <span class="stat-label">Severe Cases</span>
                    </div>
                </div>
            </div>
            <div class="health-status-content">
        `;
        
        // Recent health records
        content += `
            <div class="health-stat">
                <div class="health-stat-header">
                    <span class="health-stat-title">Health Issues</span>
                    <span class="health-stat-count">${healthRecordsGeneral.length}</span>
                </div>
                <ul class="health-details">
        `;
        
        if (healthRecordsGeneral.length > 0) {
            healthRecordsGeneral.slice(0, 3).forEach(record => {
                const date = new Date(record.date || record.timestamp).toLocaleDateString();
                const severity = record.severity || 'unknown';
                const severityClass = `severity-${severity}`;
                
                content += `
                    <li class="${severityClass}">
                        <div class="record-header">
                            <strong>${record.category || 'Animal'}</strong>: ${record.condition || 'Health issue'}
                            <span class="record-date">${date}</span>
                        </div>
                        <div class="record-details">
                            <span class="severity-badge ${severityClass}">${severity}</span>
                            ${record.description ? `<p class="description">${record.description.substring(0, 80)}${record.description.length > 80 ? '...' : ''}</p>` : ''}
                        </div>
                    </li>
                `;
            });
            
            if (healthRecordsGeneral.length > 3) {
                content += `<li class="show-more">+ ${healthRecordsGeneral.length - 3} more records</li>`;
            }
        } else {
            content += `<li class="show-more">No health issues recorded</li>`;
        }
        
        content += `
            </ul>
        </div>
        `;
        
        // Vaccinations
        content += `
            <div class="health-stat">
                <div class="health-stat-header">
                    <span class="health-stat-title">Vaccinations</span>
                    <span class="health-stat-count">${vaccinations.length}</span>
                </div>
                <ul class="health-details">
        `;
        
        if (vaccinations.length > 0) {
            vaccinations.slice(0, 3).forEach(vaccination => {
                const date = new Date(vaccination.date || vaccination.timestamp).toLocaleDateString();
                const dueDate = vaccination.nextDate ? new Date(vaccination.nextDate).toLocaleDateString() : 'Not scheduled';
                
                content += `
                    <li class="vaccination">
                        <div class="record-header">
                            <strong>${vaccination.category}</strong>: ${vaccination.vaccine || 'Vaccination'}
                            <span class="record-date">${date}</span>
                        </div>
                        <div class="record-details">
                            <span class="due-date">Next due: ${dueDate}</span>
                            ${vaccination.notes ? `<p class="description">${vaccination.notes.substring(0, 60)}${vaccination.notes.length > 60 ? '...' : ''}</p>` : ''}
                        </div>
                    </li>
                `;
            });
            
            if (vaccinations.length > 3) {
                content += `<li class="show-more">+ ${vaccinations.length - 3} more vaccinations</li>`;
            }
        } else {
            content += `<li class="show-more">No vaccination records</li>`;
        }
        
        content += `
            </ul>
        </div>
        `;
        
        // Treatments
        content += `
            <div class="health-stat">
                <div class="health-stat-header">
                    <span class="health-stat-title">Treatments</span>
                    <span class="health-stat-count">${treatments.length}</span>
                </div>
                <ul class="health-details">
        `;
        
        if (treatments.length > 0) {
            treatments.slice(0, 3).forEach(treatment => {
                const date = new Date(treatment.date || treatment.timestamp).toLocaleDateString();
                const endDate = treatment.endDate ? new Date(treatment.endDate).toLocaleDateString() : 'Ongoing';
                const status = new Date(treatment.endDate) < new Date() ? 'Completed' : 'Active';
                
                content += `
                    <li class="treatment ${status.toLowerCase()}">
                        <div class="record-header">
                            <strong>${treatment.category}</strong>: ${treatment.treatment || 'Treatment'}
                            <span class="record-date">${date}</span>
                        </div>
                        <div class="record-details">
                            <span class="status-badge">${status}</span>
                            <span class="end-date">End date: ${endDate}</span>
                            ${treatment.notes ? `<p class="description">${treatment.notes.substring(0, 60)}${treatment.notes.length > 60 ? '...' : ''}</p>` : ''}
                        </div>
                    </li>
                `;
            });
            
            if (treatments.length > 3) {
                content += `<li class="show-more">+ ${treatments.length - 3} more treatments</li>`;
            }
        } else {
            content += `<li class="show-more">No treatment records</li>`;
        }
        
        content += `
            </ul>
        </div>
        `;
        
        // Medications
        content += `
            <div class="health-stat">
                <div class="health-stat-header">
                    <span class="health-stat-title">Medications</span>
                    <span class="health-stat-count">${medications.length}</span>
                </div>
                <ul class="health-details">
        `;
        
        if (medications.length > 0) {
            medications.slice(0, 3).forEach(medication => {
                const date = new Date(medication.date || medication.timestamp).toLocaleDateString();
                const endDate = medication.endDate ? new Date(medication.endDate).toLocaleDateString() : 'Ongoing';
                const dosage = medication.dosage ? `${medication.dosage}` : '';
                
                content += `
                    <li class="medication">
                        <div class="record-header">
                            <strong>${medication.category}</strong>: ${medication.medication || 'Medication'}
                            <span class="record-date">${date}</span>
                        </div>
                        <div class="record-details">
                            ${dosage ? `<span class="dosage">Dosage: ${dosage}</span>` : ''}
                            <span class="end-date">End date: ${endDate}</span>
                            ${medication.notes ? `<p class="description">${medication.notes.substring(0, 60)}${medication.notes.length > 60 ? '...' : ''}</p>` : ''}
                        </div>
                    </li>
                `;
            });
            
            if (medications.length > 3) {
                content += `<li class="show-more">+ ${medications.length - 3} more medications</li>`;
            }
        } else {
            content += `<li class="show-more">No medication records</li>`;
        }
        
        content += `
            </ul>
        </div>
        `;
        
        content += '</div>';
        healthStatusElem.innerHTML = content;
    }
    
    // Initialize animal categories
    async function initializeAnimalCategories() {
        try {
            // Get categories from server storage first
            const categoriesStr = await mobileStorage.getItem('animalCategories');
            
            if (categoriesStr) {
                const categories = JSON.parse(categoriesStr);
                if (Array.isArray(categories) && categories.length > 0) {
                    // Save to local storage for quicker access
                    localStorage.setItem('animalCategories', JSON.stringify(categories));
                    return;
                }
            }
            
            // If no categories in storage, extract from inventory
            if (animalInventory && Object.keys(animalInventory).length > 0) {
                const categoriesFromInventory = Object.keys(animalInventory);
                await mobileStorage.setItem('animalCategories', JSON.stringify(categoriesFromInventory));
                localStorage.setItem('animalCategories', JSON.stringify(categoriesFromInventory));
                return;
            }
            
            // Just initialize with empty array if no categories found
            await mobileStorage.setItem('animalCategories', JSON.stringify([]));
            localStorage.setItem('animalCategories', JSON.stringify([]));
        } catch (error) {
            console.error('Error initializing animal categories:', error);
        }
    }

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
            
            // For inputs that need numeric keyboard
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
            
            // Add touch event handling
            input.addEventListener('touchstart', (e) => {
                // Prevent default only for non-input fields to avoid double focus
                if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'SELECT') {
                    e.preventDefault();
                }
                // Focus the element on touch
                setTimeout(() => e.target.focus(), 100);
            }, { passive: false });
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
});