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
    let healthRecords = JSON.parse(await mobileStorage.getItem('healthRecords') || '[]');
    
    // Setup event listeners
    setupEventListeners();
    
    // Initial display updates
    updateDisplays();
    
    // Set up orientation change handling
    window.addEventListener('orientationchange', handleOrientationChange);
    
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
            
            // Set input mode attributes for better mobile keyboard display
            if (input.type === 'number') {
                input.setAttribute('inputmode', 'numeric');
                input.setAttribute('pattern', '[0-9]*');
            }
            
            // For text inputs
            if (input.type === 'text') {
                input.setAttribute('inputmode', 'text');
                input.setAttribute('autocomplete', 'off');
            }
            
            // For date inputs, ensure they're properly formatted
            if (input.type === 'date') {
                input.setAttribute('inputmode', 'none'); // Prefer native date picker
            }
            
            // For textarea
            if (input.tagName === 'TEXTAREA') {
                input.setAttribute('inputmode', 'text');
            }
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
        // Add event listeners to buttons
        document.getElementById('add-health-record-btn')?.addEventListener('click', () => {
            showHealthRecordPopup().catch(err => console.error('Error showing health record popup:', err));
        });
        document.getElementById('add-vaccination-btn')?.addEventListener('click', () => {
            showVaccinationPopup().catch(err => console.error('Error showing vaccination popup:', err));
        });
        document.getElementById('add-treatment-btn')?.addEventListener('click', () => {
            showTreatmentPopup().catch(err => console.error('Error showing treatment popup:', err));
        });
        document.getElementById('add-medication-btn')?.addEventListener('click', () => {
            showMedicationPopup().catch(err => console.error('Error showing medication popup:', err));
        });
        
        // Clear data button
        document.getElementById('clear-health-data')?.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear all health records? This action cannot be undone.')) {
                clearHealthData();
            }
        });
    }
    
    function updateDisplays() {
        updateHealthRecords();
        updateUpcomingTreatments();
        updateActiveMedications();
        updateHealthAlerts();
    }
    
    function updateHealthRecords() {
        const recordsContainer = document.getElementById('health-records');
        if (!recordsContainer) return;
        
        if (healthRecords.length === 0) {
            recordsContainer.innerHTML = '<p class="empty-state">No health records available</p>';
            return;
        }
        
        recordsContainer.innerHTML = '';
        
        // Display the 5 most recent records
        healthRecords.slice(0, 5).forEach(record => {
            const recordElement = document.createElement('div');
            recordElement.className = `record-item ${record.type}`;
            
            const date = new Date(record.date).toLocaleDateString();
            
            let detailsText = '';
            switch (record.type) {
                case 'health-record':
                    detailsText = `${record.condition || ''} - ${record.description || ''}`;
                    break;
                case 'vaccination':
                    detailsText = `${record.vaccine || ''} - ${record.notes || ''}`;
                    if (record.nextDate) {
                        const nextDate = new Date(record.nextDate).toLocaleDateString();
                        detailsText += `<div class="record-next-date">Next vaccination: ${nextDate}</div>`;
                    }
                    break;
                case 'treatment':
                    detailsText = `${record.treatment || ''} - ${record.condition || ''} ${record.notes || ''}`;
                    if (record.duration) {
                        detailsText += ` - Duration: ${record.duration} days`;
                    }
                    break;
                case 'medication':
                    detailsText = `${record.medication || ''} ${record.dosage || ''} - ${record.notes || ''}`;
                    if (record.withdrawalPeriod) {
                        detailsText += ` - Withdrawal: ${record.withdrawalPeriod} days`;
                    }
                    break;
            }
            
            recordElement.innerHTML = `
                <div class="record-header">
                    <span class="record-category">${record.category}</span>
                    <span class="record-date">${date}</span>
                </div>
                <div class="record-details">${detailsText}</div>
            `;
            
            recordsContainer.appendChild(recordElement);
        });
    }
    
    function updateUpcomingTreatments() {
        const treatmentsContainer = document.getElementById('upcoming-treatments');
        if (!treatmentsContainer) return;
        
        const today = new Date();
        
        // Filter upcoming vaccinations (next 14 days)
        const upcomingVaccinations = healthRecords.filter(record => {
            if (record.type === 'vaccination' && record.nextDate) {
                const nextDate = new Date(record.nextDate);
                const daysUntilDue = Math.ceil((nextDate - today) / (1000 * 60 * 60 * 24));
                return daysUntilDue >= 0 && daysUntilDue <= 14;
            }
            return false;
        }).sort((a, b) => new Date(a.nextDate) - new Date(b.nextDate));
        
        // Filter active treatments
        const activeTreatments = healthRecords.filter(record => {
            if (record.type === 'treatment' && record.date && record.duration) {
                const startDate = new Date(record.date);
                const endDate = new Date(startDate);
                endDate.setDate(endDate.getDate() + parseInt(record.duration));
                return endDate >= today;
            }
            return false;
        });
        
        if (upcomingVaccinations.length === 0 && activeTreatments.length === 0) {
            treatmentsContainer.innerHTML = '<p class="empty-state">No upcoming treatments</p>';
            return;
        }
        
        treatmentsContainer.innerHTML = '';
        
        // Display upcoming vaccinations
        upcomingVaccinations.slice(0, 3).forEach(record => {
            const nextDate = new Date(record.nextDate);
            const daysUntilDue = Math.ceil((nextDate - today) / (1000 * 60 * 60 * 24));
            
            const recordElement = document.createElement('div');
            recordElement.className = 'record-item vaccination';
            
            recordElement.innerHTML = `
                <div class="record-header">
                    <span class="record-category">${record.category}</span>
                    <span class="record-date">Due in ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''}</span>
                </div>
                <div class="record-details">
                    ${record.vaccine || 'Vaccination'} - 
                    Due on ${nextDate.toLocaleDateString()}
                </div>
            `;
            
            treatmentsContainer.appendChild(recordElement);
        });
        
        // Display active treatments
        activeTreatments.slice(0, 3).forEach(record => {
            const startDate = new Date(record.date);
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + parseInt(record.duration));
            const daysRemaining = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
            
            const recordElement = document.createElement('div');
            recordElement.className = 'record-item treatment';
            
            recordElement.innerHTML = `
                <div class="record-header">
                    <span class="record-category">${record.category}</span>
                    <span class="record-date">${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining</span>
                </div>
                <div class="record-details">
                    ${record.treatment || 'Treatment'} - 
                    ${record.condition || 'Ongoing treatment'}
                </div>
            `;
            
            treatmentsContainer.appendChild(recordElement);
        });
    }
    
    function updateActiveMedications() {
        const medicationsContainer = document.getElementById('active-medications');
        if (!medicationsContainer) return;
        
        const today = new Date();
        
        // Filter active medications
        const activeMedications = healthRecords.filter(record => {
            if (record.type === 'medication' && record.dateAdded && record.withdrawalPeriod) {
                const startDate = new Date(record.dateAdded);
                const endDate = new Date(startDate);
                endDate.setDate(endDate.getDate() + parseInt(record.withdrawalPeriod));
                return endDate >= today;
            }
            return false;
        });
        
        if (activeMedications.length === 0) {
            medicationsContainer.innerHTML = '<p class="empty-state">No active medications</p>';
            return;
        }
        
        medicationsContainer.innerHTML = '';
        
        // Display active medications
        activeMedications.forEach(record => {
            const startDate = new Date(record.dateAdded);
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + parseInt(record.withdrawalPeriod));
            const daysRemaining = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
            
            const recordElement = document.createElement('div');
            recordElement.className = 'record-item medication';
            
            recordElement.innerHTML = `
                <div class="record-header">
                    <span class="record-category">${record.category}</span>
                    <span class="record-date">Withdrawal: ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}</span>
                </div>
                <div class="record-details">
                    ${record.medication || 'Medication'} ${record.dosage ? `(${record.dosage})` : ''} - 
                    Started on ${startDate.toLocaleDateString()}
                </div>
            `;
            
            medicationsContainer.appendChild(recordElement);
        });
    }
    
    function updateHealthAlerts() {
        const alertsContainer = document.getElementById('health-alerts');
        if (!alertsContainer) return;
        
        const today = new Date();
        
        // Collect alerts
        const alerts = healthRecords.filter(record => {
            if (record.type === 'vaccination' && record.nextDate) {
                const nextDate = new Date(record.nextDate);
                const daysUntilDue = Math.ceil((nextDate - today) / (1000 * 60 * 60 * 24));
                return daysUntilDue <= 7 && daysUntilDue > 0;
            }
            if (record.type === 'medication' && record.dateAdded && record.withdrawalPeriod) {
                const endDate = new Date(new Date(record.dateAdded));
                endDate.setDate(endDate.getDate() + parseInt(record.withdrawalPeriod));
                const daysUntilEnd = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
                return daysUntilEnd <= 3 && daysUntilEnd > 0;
            }
            return false;
        });
        
        if (alerts.length === 0) {
            alertsContainer.innerHTML = '<p class="empty-state">No health alerts</p>';
            return;
        }
        
        alertsContainer.innerHTML = '';
        
        // Display alerts
        alerts.forEach(alert => {
            const alertElement = document.createElement('div');
            alertElement.className = `record-item ${alert.type}`;
            
            if (alert.type === 'vaccination') {
                const nextDate = new Date(alert.nextDate);
                const daysUntil = Math.ceil((nextDate - today) / (1000 * 60 * 60 * 24));
                
                alertElement.innerHTML = `
                    <div class="record-header">
                        <span class="record-category">${alert.category}</span>
                        <span class="record-date">Due in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}</span>
                    </div>
                    <div class="record-details">
                        <strong>Vaccination Due Soon:</strong><br>
                        ${alert.vaccine || 'Vaccination'} - Due on ${nextDate.toLocaleDateString()}
                    </div>
                `;
            } else if (alert.type === 'medication') {
                const endDate = new Date(new Date(alert.dateAdded));
                endDate.setDate(endDate.getDate() + parseInt(alert.withdrawalPeriod));
                const daysUntil = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
                
                alertElement.innerHTML = `
                    <div class="record-header">
                        <span class="record-category">${alert.category}</span>
                        <span class="record-date">Ends in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}</span>
                    </div>
                    <div class="record-details">
                        <strong>Medication Withdrawal Period Ending:</strong><br>
                        ${alert.medication || 'Medication'} - Withdrawal ends on ${endDate.toLocaleDateString()}
                    </div>
                `;
            }
            
            alertsContainer.appendChild(alertElement);
        });
    }
    
    async function showHealthRecordPopup() {
        const animalCategories = await getAnimalCategories();
        
        const popupContent = `
            <div class="popup-content">
                <h3>Add Health Record</h3>
                <form id="health-record-form" data-type="health-record">
                    <div class="form-group">
                        <label for="category">Animal Category:</label>
                        <select id="category" name="category" required>
                            <option value="" disabled selected>Select a category</option>
                            ${animalCategories.map(category => 
                                `<option value="${category}">${category}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="condition">Condition:</label>
                        <input type="text" id="condition" name="condition" required placeholder="e.g., Heat stress, Lameness">
                    </div>
                    <div class="form-group">
                        <label for="severity">Severity:</label>
                        <select id="severity" name="severity" required>
                            <option value="mild">Mild</option>
                            <option value="moderate" selected>Moderate</option>
                            <option value="severe">Severe</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="description">Description:</label>
                        <textarea id="description" name="description" rows="3" required placeholder="Describe the health condition in detail"></textarea>
                    </div>
                    <div class="form-group">
                        <label for="date">Date:</label>
                        <input type="date" id="date" name="date" value="${new Date().toISOString().split('T')[0]}" required>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="cancel-btn">Cancel</button>
                        <button type="submit" class="save-btn">Save</button>
                    </div>
                </form>
            </div>
        `;
        
        const popup = createPopup(popupContent);
        
        // Form submission handling
        const form = popup.querySelector('form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            handleFormSubmission('health-record', form);
            popup.remove();
        });
        
        // Cancel button handling
        popup.querySelector('.cancel-btn').addEventListener('click', () => {
            popup.remove();
        });
    }
    
    async function showVaccinationPopup() {
        const animalCategories = await getAnimalCategories();
        
        const popupContent = `
            <div class="popup-content">
                <h3>Add Vaccination</h3>
                <form id="vaccination-form" data-type="vaccination">
                    <div class="form-group">
                        <label for="category">Animal Category:</label>
                        <select id="category" name="category" required>
                            <option value="" disabled selected>Select a category</option>
                            ${animalCategories.map(category => 
                                `<option value="${category}">${category}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="vaccine">Vaccine:</label>
                        <input type="text" id="vaccine" name="vaccine" required placeholder="e.g., Foot & Mouth, Anthrax">
                    </div>
                    <div class="form-group">
                        <label for="quantity">Number of Animals:</label>
                        <input type="number" id="quantity" name="quantity" min="1" placeholder="Enter number of animals" required>
                    </div>
                    <div class="form-group">
                        <label for="next-date">Next Vaccination Date:</label>
                        <input type="date" id="next-date" name="next-date">
                    </div>
                    <div class="form-group">
                        <label for="date">Date Administered:</label>
                        <input type="date" id="date" name="date" value="${new Date().toISOString().split('T')[0]}" required>
                    </div>
                    <div class="form-group">
                        <label for="notes">Notes:</label>
                        <textarea id="notes" name="notes" rows="2" placeholder="Additional notes"></textarea>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="cancel-btn">Cancel</button>
                        <button type="submit" class="save-btn">Save</button>
                    </div>
                </form>
            </div>
        `;
        
        const popup = createPopup(popupContent);
        
        // Form submission handling
        const form = popup.querySelector('form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            handleFormSubmission('vaccination', form);
            popup.remove();
        });
        
        // Cancel button handling
        popup.querySelector('.cancel-btn').addEventListener('click', () => {
            popup.remove();
        });
    }
    
    async function showTreatmentPopup() {
        const animalCategories = await getAnimalCategories();
        
        const popupContent = `
            <div class="popup-content">
                <h3>Add Treatment</h3>
                <form id="treatment-form" data-type="treatment">
                    <div class="form-group">
                        <label for="category">Animal Category:</label>
                        <select id="category" name="category" required>
                            <option value="" disabled selected>Select a category</option>
                            ${animalCategories.map(category => 
                                `<option value="${category}">${category}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="condition">Condition:</label>
                        <input type="text" id="condition" name="condition" required placeholder="e.g., Infection, Injury">
                    </div>
                    <div class="form-group">
                        <label for="treatment">Treatment:</label>
                        <input type="text" id="treatment" name="treatment" required placeholder="e.g., Antibiotics, Bandaging">
                    </div>
                    <div class="form-group">
                        <label for="quantity">Number of Animals:</label>
                        <input type="number" id="quantity" name="quantity" min="1" placeholder="Enter number of animals" required>
                    </div>
                    <div class="form-group">
                        <label for="duration">Duration (days):</label>
                        <input type="number" id="duration" name="duration" min="1" placeholder="Enter duration (e.g., 7)" required>
                    </div>
                    <div class="form-group">
                        <label for="date">Start Date:</label>
                        <input type="date" id="date" name="date" value="${new Date().toISOString().split('T')[0]}" required>
                    </div>
                    <div class="form-group">
                        <label for="notes">Notes:</label>
                        <textarea id="notes" name="notes" rows="2" placeholder="Additional notes"></textarea>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="cancel-btn">Cancel</button>
                        <button type="submit" class="save-btn">Save</button>
                    </div>
                </form>
            </div>
        `;
        
        const popup = createPopup(popupContent);
        
        // Form submission handling
        const form = popup.querySelector('form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            handleFormSubmission('treatment', form);
            popup.remove();
        });
        
        // Cancel button handling
        popup.querySelector('.cancel-btn').addEventListener('click', () => {
            popup.remove();
        });
    }
    
    async function showMedicationPopup() {
        const animalCategories = await getAnimalCategories();
        
        const popupContent = `
            <div class="popup-content">
                <h3>Record Medication</h3>
                <form id="medication-form" data-type="medication">
                    <div class="form-group">
                        <label for="category">Animal Category:</label>
                        <select id="category" name="category" required>
                            <option value="" disabled selected>Select a category</option>
                            ${animalCategories.map(category => 
                                `<option value="${category}">${category}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="medication">Medication:</label>
                        <input type="text" id="medication" name="medication" required placeholder="e.g., Antibiotic, Pain reliever">
                    </div>
                    <div class="form-group">
                        <label for="dosage">Dosage:</label>
                        <input type="text" id="dosage" name="dosage" required placeholder="e.g., 10mg/kg">
                    </div>
                    <div class="form-group">
                        <label for="quantity">Number of Animals:</label>
                        <input type="number" id="quantity" name="quantity" min="1" placeholder="Enter number of animals" required>
                    </div>
                    <div class="form-group">
                        <label for="withdrawal">Withdrawal Period (days):</label>
                        <input type="number" id="withdrawal" name="withdrawal" min="0" placeholder="Enter withdrawal period" required>
                    </div>
                    <div class="form-group">
                        <label for="date-added">Date Administered:</label>
                        <input type="date" id="date-added" name="date-added" value="${new Date().toISOString().split('T')[0]}" required>
                    </div>
                    <div class="form-group">
                        <label for="notes">Notes:</label>
                        <textarea id="notes" name="notes" rows="2" placeholder="Additional notes"></textarea>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="cancel-btn">Cancel</button>
                        <button type="submit" class="save-btn">Save</button>
                    </div>
                </form>
            </div>
        `;
        
        const popup = createPopup(popupContent);
        
        // Form submission handling
        const form = popup.querySelector('form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            handleFormSubmission('medication', form);
            popup.remove();
        });
        
        // Cancel button handling
        popup.querySelector('.cancel-btn').addEventListener('click', () => {
            popup.remove();
        });
    }
    
    function handleFormSubmission(type, form) {
        // Create base record object
        let record = {
            type: type,
            category: form.querySelector('#category')?.value || '',
            date: form.querySelector('#date')?.value || new Date().toISOString().split('T')[0],
            timestamp: new Date().toISOString()
        };
        
        // Add type-specific fields
        switch(type) {
            case 'health-record':
                record = {
                    ...record,
                    condition: form.querySelector('#condition')?.value || '',
                    description: form.querySelector('#description')?.value || '',
                    severity: form.querySelector('#severity')?.value || 'medium'
                };
                break;
                
            case 'vaccination':
                record = {
                    ...record,
                    vaccine: form.querySelector('#vaccine')?.value || '',
                    quantity: parseInt(form.querySelector('#quantity')?.value || '1'),
                    nextDate: form.querySelector('#next-date')?.value || '',
                    notes: form.querySelector('#notes')?.value || ''
                };
                break;
                
            case 'treatment':
                record = {
                    ...record,
                    condition: form.querySelector('#condition')?.value || '',
                    treatment: form.querySelector('#treatment')?.value || '',
                    quantity: parseInt(form.querySelector('#quantity')?.value || '1'),
                    duration: parseInt(form.querySelector('#duration')?.value || '0'),
                    notes: form.querySelector('#notes')?.value || ''
                };
                break;
                
            case 'medication':
                record = {
                    ...record,
                    medication: form.querySelector('#medication')?.value || '',
                    dosage: form.querySelector('#dosage')?.value || '',
                    quantity: parseInt(form.querySelector('#quantity')?.value || '1'),
                    dateAdded: form.querySelector('#date-added')?.value || record.date,
                    withdrawalPeriod: parseInt(form.querySelector('#withdrawal')?.value || '0'),
                    notes: form.querySelector('#notes')?.value || ''
                };
                break;
        }
        
        // Add record to storage
        healthRecords.unshift(record);
        saveHealthRecords();
        
        // Update displays
        updateDisplays();
    }
    
    async function saveHealthRecords() {
        await mobileStorage.setItem('healthRecords', JSON.stringify(healthRecords));
    }
    
    async function clearHealthData() {
        healthRecords = [];
        await mobileStorage.removeItem('healthRecords');
        updateDisplays();
        alert('All health records have been cleared.');
    }
    
    // Helper function to get animal categories from storage
    async function getAnimalCategories() {
        const categoriesStr = await mobileStorage.getItem('animalCategories');
        if (categoriesStr) {
            return JSON.parse(categoriesStr);
        }
        
        // If no categories found, try to get from animal inventory
        const inventoryStr = await mobileStorage.getItem('animalInventory');
        if (inventoryStr) {
            const inventory = JSON.parse(inventoryStr);
            const categories = Object.keys(inventory);
            if (categories.length > 0) {
                return categories;
            }
        }
        
        // Return empty array if no categories found
        return [];
    }
}); 