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
    let feedInventory = new Map(JSON.parse(await mobileStorage.getItem('feedInventory') || '[]'));
    let feedCategories = JSON.parse(await mobileStorage.getItem('feedCategories') || '[]');
    let feedTransactions = JSON.parse(await mobileStorage.getItem('feedTransactions') || '[]');
    let feedCalculations = JSON.parse(await mobileStorage.getItem('feedCalculations') || '[]');
    let feedAlertThresholds = new Map(JSON.parse(await mobileStorage.getItem('feedAlertThresholds') || '[]'));
    let feedUsageByAnimal = new Map(JSON.parse(await mobileStorage.getItem('feedUsageByAnimal') || '[]'));
    let recentActivities = JSON.parse(await mobileStorage.getItem('recentActivities') || '[]');
    let selectedCurrency = await mobileStorage.getItem('selectedCurrency') || 'ZAR';
    
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
    window.addEventListener('orientationchange', handleOrientationChange);
    
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
            // Save all state to storage
            await mobileStorage.setItem('feedInventory', JSON.stringify(Array.from(feedInventory.entries())));
            await mobileStorage.setItem('feedCategories', JSON.stringify(feedCategories));
            await mobileStorage.setItem('feedTransactions', JSON.stringify(feedTransactions));
            await mobileStorage.setItem('feedCalculations', JSON.stringify(feedCalculations));
            await mobileStorage.setItem('feedAlertThresholds', JSON.stringify(Array.from(feedAlertThresholds.entries())));
            await mobileStorage.setItem('feedUsageByAnimal', JSON.stringify(Array.from(feedUsageByAnimal.entries())));
            await mobileStorage.setItem('recentActivities', JSON.stringify(recentActivities));
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
                        <input type="text" id="feed-type" name="feed-type" placeholder="e.g., Hay, Grain, Silage" required inputmode="text" autocomplete="off">
                    </div>
                    <div class="form-group">
                        <label for="feed-threshold">Low Stock Threshold:</label>
                        <input type="number" id="feed-threshold" name="feed-threshold" min="0" value="100" required inputmode="numeric" pattern="[0-9]*">
                    </div>
                    <div class="form-group">
                        <label for="feed-unit">Unit:</label>
                        <select id="feed-unit" name="feed-unit" required>
                            <option value="kg">Kilograms (kg)</option>
                            <option value="lb">Pounds (lb)</option>
                            <option value="bags">Bags</option>
                            <option value="bales">Bales</option>
                        </select>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="cancel-btn">Cancel</button>
                        <button type="submit" class="save-btn">Add</button>
                    </div>
                </form>
            </div>
        `;
        
        const popup = createPopup(popupContent);
        
        // Form submission handling
        const form = popup.querySelector('form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const feedType = popup.querySelector('#feed-type').value.trim();
            const threshold = parseInt(popup.querySelector('#feed-threshold').value, 10);
            const unit = popup.querySelector('#feed-unit').value;
            
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
                lastUpdated: new Date().toISOString()
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
        const popupContent = `
            <div class="popup-content">
                <h3>Feed Calculator</h3>
                <form id="feed-calculator-form">
                    <div class="form-group">
                        <label for="animal-category">Animal Category:</label>
                        <select id="animal-category" name="animal-category" required>
                            <option value="">Select a category</option>
                            ${getAnimalCategoriesOptions()}
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
                            ${getFeedCategoriesOptions()}
                        </select>
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
        
        // Form submission handling
        const form = popup.querySelector('form');
        let calculationSaved = false; // Flag to prevent duplicate saves
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // If we've already calculated and saved, just close the popup
            if (calculationSaved) {
                popup.remove();
                return;
            }
            
            const animalCategory = form.querySelector('#animal-category').value;
            const animalCount = parseInt(form.querySelector('#animal-count').value);
            const feedType = form.querySelector('#feed-type').value;
            const dailyIntake = parseFloat(form.querySelector('#daily-intake').value);
            const intakeUnit = form.querySelector('#intake-unit').value;
            const duration = parseInt(form.querySelector('#duration').value);
            
            // Convert to grams for standardization
            let dailyIntakeG = intakeUnit === 'kg' ? dailyIntake * 1000 : dailyIntake;
            
            // Do calculations (simplified version of the Electron app's calculations)
            const dailyIntakeKg = dailyIntakeG / 1000;
            const totalDailyIntakeKg = dailyIntakeKg * animalCount;
            const totalFeedNeededKg = totalDailyIntakeKg * duration;
            
            // Assume cost calculations based on feed price in inventory
            const feedData = feedInventory.get(feedType);
            let costPerAnimalPerDay = 0;
            let totalDailyCost = 0;
            let totalCost = 0;
            let costPerKg = 0;
            
            if (feedData && feedData.price && feedData.quantity) {
                // Calculate price per kg
                costPerKg = feedData.price / feedData.quantity;
                
                // Daily cost calculations
                costPerAnimalPerDay = dailyIntakeKg * costPerKg;
                totalDailyCost = costPerAnimalPerDay * animalCount;
                
                // Total cost calculations
                totalCost = totalDailyCost * duration;
            }
            
            // Create calculation record with enhanced fields
            const calculation = {
                date: new Date().toISOString(),
                animalCategory,
                animalCount,
                feedType,
                dailyIntake: dailyIntakeG,
                duration,
                totalFeedNeeded: totalFeedNeededKg,
                costPerKg,
                costPerAnimalPerDay,
                totalDailyCost,
                totalCost,
                
                // Add normalized fields for dashboard display
                category: animalCategory,
                numAnimals: animalCount,
                result: totalFeedNeededKg,
                unit: 'kg',
                period: duration > 1 ? duration + ' days' : 'daily',
                type: 'Feed calculation',
                method: 'Standard intake',
                notes: `Feed type: ${feedType}, Intake: ${dailyIntake}${intakeUnit}/animal/day`
            };
            
            // Add to calculations
            feedCalculations.unshift(calculation);
            
            // Save and update UI
            await saveState();
            updateDisplays();
            
            // Mark as saved to prevent duplication
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
                    <span>${totalFeedNeededKg.toFixed(2)} kg</span>
                </div>
                <div class="result-item">
                    <span>Feed cost:</span>
                    <span>${currency.symbol}${costPerKg.toFixed(2)}/kg</span>
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
            
            // Record has already been saved, so next submission just closes
        });
        
        // Cancel button handling
        popup.querySelector('.cancel-btn').addEventListener('click', () => {
            popup.remove();
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
                            ${feedCategories.map(category => 
                                `<option value="${category}">${category}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="quantity">Quantity:</label>
                        <input type="number" id="quantity" name="quantity" min="0.1" step="0.1" placeholder="Enter quantity" required inputmode="decimal" pattern="[0-9]*\.?[0-9]*">
                    </div>
                    <div class="form-group">
                        <label for="price">Price:</label>
                        <input type="number" id="price" name="price" min="0" step="0.01" placeholder="Enter price" required inputmode="decimal" pattern="[0-9]*\.?[0-9]*">
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
        
        feedTypeSelect.addEventListener('change', () => {
            const selectedFeed = feedTypeSelect.value;
            const feedData = feedInventory.get(selectedFeed);
            if (feedData) {
                const unitLabel = popup.querySelector('label[for="quantity"]');
                unitLabel.textContent = `Quantity (${feedData.unit}):`;
            }
        });
        
        // Form submission handling
        const form = popup.querySelector('form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const feedType = feedTypeSelect.value;
            const quantity = parseFloat(quantityInput.value);
            const price = parseFloat(popup.querySelector('#price').value);
            const supplier = popup.querySelector('#supplier').value.trim();
            const date = popup.querySelector('#purchase-date').value;
            const notes = popup.querySelector('#notes').value.trim();
            
            // Get current feed data
            let feedData = feedInventory.get(feedType);
            
            // If feed doesn't exist yet, initialize it
            if (!feedData) {
                feedData = {
                    quantity: 0,
                    unit: 'kg', // Default unit
                    threshold: 0,
                    price: 0,
                    supplier: '',
                    lastUpdated: new Date().toISOString()
                };
            }
            
            // Update feed data
            feedData.quantity += quantity;
            feedData.price = price;
            if (supplier) feedData.supplier = supplier;
            feedData.lastUpdated = new Date().toISOString();
            
            // Save to feed inventory
            feedInventory.set(feedType, feedData);
            
            // Add transaction
            const transaction = {
                type: 'purchase',
                feedType,
                quantity,
                price,
                supplier,
                date,
                notes,
                timestamp: new Date().toISOString()
            };
            
            feedTransactions.unshift(transaction);
            
            // Add to recent activities
            const activity = {
                type: 'feed-purchase',
                feedType,
                quantity,
                price,
                date,
                timestamp: new Date().toISOString(),
                description: `Purchased ${quantity} ${feedData.unit} of ${feedType}`
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
    
    function showFeedUsedPopup() {
        // Only show popup if there are feed categories with inventory
        const feedsWithInventory = Array.from(feedInventory.entries())
            .filter(([_, data]) => data.quantity > 0);
            
        if (feedsWithInventory.length === 0) {
            alert('There is no feed in inventory. Please add feed purchases first.');
            showFeedPurchasedPopup();
            return;
        }
        
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
                        <input type="number" id="quantity" name="quantity" min="0.1" step="0.1" required>
                    </div>
                    <div class="form-group">
                        <label for="animal-category">Used For:</label>
                        <select id="animal-category" name="animal-category" required>
                            <option value="">Select a category</option>
                            ${getAnimalCategoriesOptions()}
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
                    <div class="form-actions">
                        <button type="button" class="cancel-btn">Cancel</button>
                        <button type="submit" class="save-btn">Record Usage</button>
                    </div>
                </form>
            </div>
        `;
        
        const popup = createPopup(popupContent);
        
        // Form submission handling
        const form = popup.querySelector('form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const feedType = form.querySelector('#feed-type').value;
            const quantity = parseFloat(form.querySelector('#quantity').value);
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
            
            // Update feed data
            feedData.quantity -= quantity;
            feedData.lastUpdated = new Date().toISOString();
            
            // Update the inventory
            feedInventory.set(feedType, feedData);
            
            // Create transaction record
            const transaction = {
                type: 'usage',
                feedType,
                quantity,
                unit: feedData.unit,
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
                feedTypes: {}
            };
            
            usageData.totalUsage += quantity;
            usageData.feedTypes[feedType] = (usageData.feedTypes[feedType] || 0) + quantity;
            
            feedUsageByAnimal.set(animalCategory, usageData);
            
            // Add to recent activities
            const activity = {
                type: 'feed-usage',
                feedType,
                quantity,
                animalCategory,
                date,
                timestamp: new Date().toISOString(),
                description: `Used ${quantity} ${feedData.unit} of ${feedType} for ${animalCategory}`
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
            '- All feed categories\n' +
            '- Current inventory\n' +
            '- Purchase history\n' +
            '- Usage history\n' +
            '- Feed calculations\n\n' +
            'This action cannot be undone!'
        );
        
        if (confirmed) {
            try {
                // Clear all feed-related data
                feedInventory = new Map();
                feedCategories = [];
                feedTransactions = [];
                feedCalculations = [];
                feedAlertThresholds = new Map();
                feedUsageByAnimal = new Map();
                
                // Filter out feed-related activities
                recentActivities = recentActivities.filter(
                    activity => !['feed-purchase', 'feed-usage'].includes(activity.type)
                );
                
                // Save state
                await saveState();
                
                // Reset storage keys
                await mobileStorage.setItem('feedInventory', '[]');
                await mobileStorage.setItem('feedCategories', '[]');
                await mobileStorage.setItem('feedTransactions', '[]');
                await mobileStorage.setItem('feedCalculations', '[]');
                await mobileStorage.setItem('feedAlertThresholds', '[]');
                await mobileStorage.setItem('feedUsageByAnimal', '[]');
                
                // Update UI
                updateDisplays();
                
                alert('All feed data has been cleared.');
            } catch (error) {
                console.error('Error clearing feed data:', error);
                alert('There was an error clearing data. Please try again.');
            }
        }
    }
    
    // Helper function to get animal categories
    async function getAnimalCategories() {
        const categoriesStr = await mobileStorage.getItem('animalCategories');
        return categoriesStr ? JSON.parse(categoriesStr) : [];
    }
    
    // Helper function to generate options for animal categories
    function getAnimalCategoriesOptions() {
        return getAnimalCategories.value?.map(category => 
            `<option value="${category}">${category}</option>`
        ).join('') || '';
    }
    
    // Helper function to generate options for feed categories
    function getFeedCategoriesOptions() {
        return feedCategories.map(category => 
            `<option value="${category}">${category}</option>`
        ).join('');
    }
    
    // Initialize animal categories accessor
    getAnimalCategories.value = [];
    
    // Get animal categories on page load
    (async function() {
        getAnimalCategories.value = await getAnimalCategories();
    })();
}); 
