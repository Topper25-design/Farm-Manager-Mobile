/**
 * reports.js
 * Main entry point for the reports module - initialization and event handling
 */

import { 
    StorageManager, 
    DateManager, 
    CurrencyManager,
    formatDate, 
    formatCurrency, 
    createStandardReportStructure 
} from './utils.js';
import { setupNavigation } from '../navigation.js';
import { Logger } from '../logger.js';
import {
    createAnimalReportTable,
    createAnimalInventoryTable,
    createAnimalBirthTable,
    createAnimalDeathTable,
    createAnimalMovementTable,
    createAnimalPurchaseTable,
    createAnimalSaleTable,
    createAnimalCountTable,
    createAnimalDiscrepancyTable,
    loadAnimalData,
    loadAnimalInventoryData,
    loadAnimalMovementData,
    loadAnimalPurchaseData,
    loadAnimalSaleData,
    loadAnimalBirthData,
    loadAnimalDeathData,
    loadAnimalCountData,
    loadAnimalDiscrepancyData,
    getAnimalCategories
} from './reports.animals.js';
import {
    loadHealthData,
    loadHealthTreatmentData,
    loadHealthVaccinationData,
    loadHealthMedicationData,
    createHealthReportTable,
    createHealthTreatmentTable,
    createHealthVaccinationTable,
    createHealthMedicationTable,
    createAllHealthReportTable
} from './reports.health.js';

// Initialize state
let selectedReportType = '';
let selectedMainType = '';
let hasShownDemoDataNotice = false;

// Error handling utilities
class ReportError extends Error {
    constructor(message, code, details = {}) {
        super(message);
        this.name = 'ReportError';
        this.code = code;
        this.details = details;
        this.timestamp = new Date();
    }
}

const ErrorCodes = {
    INVALID_REPORT_TYPE: 'INVALID_REPORT_TYPE',
    INVALID_DATE_RANGE: 'INVALID_DATE_RANGE',
    DATA_LOAD_ERROR: 'DATA_LOAD_ERROR',
    CATEGORY_LOAD_ERROR: 'CATEGORY_LOAD_ERROR',
    DISPLAY_ERROR: 'DISPLAY_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR'
};

const ValidationRules = {
    REQUIRED: 'required',
    DATE: 'date',
    CATEGORY: 'category',
    REPORT_TYPE: 'report_type'
};

class DataValidator {
    static isValidDate(date) {
        if (!date) return false;
        
        // Handle ISO date strings (YYYY-MM-DD)
        if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const [year, month, day] = date.split('-').map(Number);
            const d = new Date(year, month - 1, day);
            return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
        }
        
        // Handle other date formats
        const d = new Date(date);
        return d instanceof Date && !isNaN(d.getTime());
    }

    static validate(data, rules) {
        const errors = [];

        // Get default dates for fallback
        const defaultDates = DateManager.getDefaultDateRange();

        for (const [field, rule] of Object.entries(rules)) {
            let value = data[field];

            // Handle nested fields (e.g., dateRange.start)
            if (field.includes('.')) {
                try {
                    value = field.split('.').reduce((obj, key) => obj && obj[key], data);
                } catch (e) {
                    value = null;
                }
            }

            if (rule.includes(ValidationRules.REQUIRED) && !value) {
                // For date fields, use default value instead of showing error
                if (rule.includes(ValidationRules.DATE)) {
                    if (field === 'dateRange.start') {
                        data.dateRange = data.dateRange || {};
                        data.dateRange.start = defaultDates.start;
                        value = defaultDates.start;
                    } else if (field === 'dateRange.end') {
                        data.dateRange = data.dateRange || {};
                        data.dateRange.end = defaultDates.end;
                        value = defaultDates.end;
                    } else {
                        errors.push(`${field} is required`);
                    }
                } else {
                    errors.push(`${field} is required`);
                }
                continue;
            }

            if (value) {
                if (rule.includes(ValidationRules.DATE)) {
                    if (!this.isValidDate(value)) {
                        // Use default date instead of showing error
                        if (field === 'dateRange.start') {
                            data.dateRange.start = defaultDates.start;
                        } else if (field === 'dateRange.end') {
                            data.dateRange.end = defaultDates.end;
                        } else {
                            errors.push(`${field} must be a valid date`);
                        }
                    }
                }

                if (rule.includes(ValidationRules.CATEGORY)) {
                    if (!this.isValidCategory(value)) {
                        errors.push(`${field} must be a valid category`);
                    }
                }

                if (rule.includes(ValidationRules.REPORT_TYPE)) {
                    if (!this.isValidReportType(value)) {
                        errors.push(`${field} must be a valid report type`);
                    }
                }
            }
        }

        // Additional date range validation
        if (data.dateRange) {
            const { start, end } = data.dateRange;
            if (start && end) {
                const startDate = new Date(start);
                const endDate = new Date(end);
                
                if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
                    if (endDate < startDate) {
                        // If end date is before start date, set end date to start date
                        data.dateRange.end = data.dateRange.start;
                    }
                } else {
                    // If either date is invalid, use default dates
                    data.dateRange.start = defaultDates.start;
                    data.dateRange.end = defaultDates.end;
                }
            } else {
                // If either date is missing, use default dates
                data.dateRange.start = defaultDates.start;
                data.dateRange.end = defaultDates.end;
            }
        }

        return errors;
    }

    static isValidCategory(category) {
        return category === 'all' || document.querySelector(`#category-filter option[value="${category}"]`);
    }

    static isValidReportType(type) {
        const validTypes = [
            // Animal report types
            'all-animal', 'animal-inventory', 'animal-movement', 'animal-purchase',
            'animal-sale', 'animal-birth', 'animal-death', 'animal-count', 'animal-discrepancy',
            // Feed report types
            'all-feed', 'feed-inventory', 'feed-purchase', 'feed-usage', 'feed-calculation',
            // Health report types
            'all-health', 'health-treatment', 'health-vaccination', 'health-medication',
            'health-records', 'health-activities'
        ];
        return validTypes.includes(type);
    }
}

class ErrorHandler {
    static retryCount = 0;
    static MAX_RETRIES = 3;
    static lastErrorCode = null;
    static lastError = null;

    static async handleError(error, context = {}) {
        // Log the error
        console.error('Error in reports module:', error);
        Logger.error(Logger.MODULES.REPORTS, 'Error handling report operation', {
            error: error.message,
            code: error.code,
            context
        });

        // Reset retry count if it's a different error
        if (this.lastErrorCode !== error.code) {
            this.retryCount = 0;
            this.lastErrorCode = error.code;
            this.lastError = error;
        }

        // Only attempt recovery if we haven't exceeded max retries
        if (this.retryCount < this.MAX_RETRIES) {
            this.retryCount++;
            await this.attemptRecovery(error, context);
        } else {
            console.warn(`Max retries (${this.MAX_RETRIES}) exceeded for error code ${error.code}`);
            // Show user-friendly error message
            this.displayErrorMessage(error);
            // Reset for next error
            this.retryCount = 0;
            this.lastErrorCode = null;
            this.lastError = null;
        }
    }

    static async attemptRecovery(error, context = {}) {
        switch (error.code) {
            case ErrorCodes.DATA_LOAD_ERROR:
                // Clear specific data cache and retry
                if (context.dataType) {
                    await StorageManager.removeItem(`${context.dataType}Cache`);
                } else {
                    // If no specific type, clear all report-related cache
                    await StorageManager.clearCache();
                }
                break;

            case ErrorCodes.CATEGORY_LOAD_ERROR:
                // Reset category storage and reload defaults
                await StorageManager.removeItem('animalCategories');
                await StorageManager.removeItem('feedCategories');
                await updateCategoryOptions();
                break;

            case ErrorCodes.INVALID_DATE_RANGE:
                // Reset to default date range
                const defaultDates = DateManager.getDefaultDateRange();
                document.getElementById('date-from').value = defaultDates.start;
                document.getElementById('date-to').value = defaultDates.end;
                break;

            case ErrorCodes.DISPLAY_ERROR:
                // Clear the report content and show error state
                const reportContent = document.querySelector('.report-content');
                if (reportContent) {
                    reportContent.innerHTML = `
                        <div class="error-state">
                            <h3>Error Displaying Report</h3>
                            <p>There was an error displaying the report. Please try again.</p>
                            ${error.details ? `<p>Details: ${error.details}</p>` : ''}
                        </div>`;
                }
                break;

            default:
                console.warn('No specific recovery strategy for error:', error.code);
                break;
        }
    }

    static displayErrorMessage(error) {
        const errorContainer = document.querySelector('.error-message') || 
            document.createElement('div');
        errorContainer.className = 'error-message';
        
        let message = 'An error occurred while processing your request.';
        switch (error.code) {
            case ErrorCodes.DATA_LOAD_ERROR:
                message = 'Failed to load report data. Please try again.';
                break;
            case ErrorCodes.CATEGORY_LOAD_ERROR:
                message = 'Failed to load categories. Using default categories.';
                break;
            case ErrorCodes.INVALID_DATE_RANGE:
                message = 'Invalid date range selected. Please check your dates.';
                break;
            case ErrorCodes.DISPLAY_ERROR:
                message = 'Failed to display the report. Please try again.';
                break;
        }
        
        errorContainer.innerHTML = `
            <div class="error-content">
                <p>${message}</p>
                ${error.details ? `<p class="error-details">${error.details}</p>` : ''}
                <button onclick="this.parentElement.remove()">Dismiss</button>
            </div>`;
        
        // Add to document if not already present
        if (!errorContainer.parentElement) {
            document.body.appendChild(errorContainer);
        }
        
        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            if (errorContainer.parentElement) {
                errorContainer.remove();
            }
        }, 5000);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    Logger.info(Logger.MODULES.REPORTS, 'Initializing reports module');
    setupNavigation();

    try {
        // Ensure animal report functions are globally available
        window.loadAnimalData = loadAnimalData;
        window.loadAnimalInventoryData = loadAnimalInventoryData;
        window.loadAnimalMovementData = loadAnimalMovementData;
        window.loadAnimalPurchaseData = loadAnimalPurchaseData;
        window.loadAnimalSaleData = loadAnimalSaleData;
        window.loadAnimalBirthData = loadAnimalBirthData;
        window.loadAnimalDeathData = loadAnimalDeathData;
        window.loadAnimalCountData = loadAnimalCountData;
        window.loadAnimalDiscrepancyData = loadAnimalDiscrepancyData;
        window.createAnimalReportTable = createAnimalReportTable;
        window.createAnimalInventoryTable = createAnimalInventoryTable;
        window.createAnimalMovementTable = createAnimalMovementTable;
        window.createAnimalPurchaseTable = createAnimalPurchaseTable;
        window.createAnimalSaleTable = createAnimalSaleTable;
        window.createAnimalBirthTable = createAnimalBirthTable;
        window.createAnimalDeathTable = createAnimalDeathTable;
        window.createAnimalCountTable = createAnimalCountTable;
        window.createAnimalDiscrepancyTable = createAnimalDiscrepancyTable;

        // Set default dates using DateManager
        const defaultDates = DateManager.getDefaultDateRange();
        const dateFromInput = document.getElementById('date-from');
        const dateToInput = document.getElementById('date-to');
        
        // Create date inputs if they don't exist
        if (!dateFromInput || !dateToInput) {
            console.warn('Date inputs not found, creating them');
            const dateContainer = document.querySelector('.date-range-container') || document.createElement('div');
            dateContainer.className = 'date-range-container';
            
            if (!dateFromInput) {
                const fromInput = document.createElement('input');
                fromInput.type = 'date';
                fromInput.id = 'date-from';
                fromInput.value = defaultDates.start;
                fromInput.addEventListener('change', validateDateInputs);
                dateContainer.appendChild(fromInput);
            }
            
            if (!dateToInput) {
                const toInput = document.createElement('input');
                toInput.type = 'date';
                toInput.id = 'date-to';
                toInput.value = defaultDates.end;
                toInput.addEventListener('change', validateDateInputs);
                dateContainer.appendChild(toInput);
            }
            
            // Add to document if not already present
            if (!dateContainer.parentElement) {
                const reportForm = document.querySelector('.report-form') || document.body;
                reportForm.appendChild(dateContainer);
            }
        } else {
            // Set values and add listeners to existing inputs
            dateFromInput.value = defaultDates.start;
            dateToInput.value = defaultDates.end;
            dateFromInput.addEventListener('change', validateDateInputs);
            dateToInput.addEventListener('change', validateDateInputs);
        }

        // Add event listeners for all report type selects
        document.getElementById('animal-report-type')?.addEventListener('change', handleReportTypeChange);
        document.getElementById('feed-report-type')?.addEventListener('change', handleReportTypeChange);
        document.getElementById('health-report-type')?.addEventListener('change', handleReportTypeChange);
        document.getElementById('category-filter')?.addEventListener('change', handleCategoryChange);
        document.getElementById('generate-report')?.addEventListener('click', handleGenerateReport);
        
        Logger.info(Logger.MODULES.REPORTS, 'Reports module initialization complete');
    } catch (error) {
        console.error('Error initializing reports module:', error);
        Logger.error(Logger.MODULES.REPORTS, 'Error in module initialization', {
            error: error.message,
            stack: error.stack
        });
    }
});

// Add date validation function
function validateDateInputs() {
    const dateFromInput = document.getElementById('date-from');
    const dateToInput = document.getElementById('date-to');
    
    if (!dateFromInput || !dateToInput) return;
    
    const startDate = new Date(dateFromInput.value);
    const endDate = new Date(dateToInput.value);
    
    // Check if dates are valid
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        const defaultDates = DateManager.getDefaultDateRange();
        dateFromInput.value = defaultDates.start;
        dateToInput.value = defaultDates.end;
        return;
    }
    
    // Ensure end date is not before start date
    if (endDate < startDate) {
        dateToInput.value = dateFromInput.value;
    }
}

function handleReportTypeChange(event) {
    // Clear other selects
    const reportSelects = ['animal-report-type', 'feed-report-type', 'health-report-type'];
    reportSelects.forEach(id => {
        if (id !== event.target.id) {
            document.getElementById(id).value = '';
        }
    });

    selectedReportType = event.target.value;
    selectedMainType = event.target.id.split('-')[0]; // 'animal', 'feed', or 'health'

    Logger.debug(Logger.MODULES.REPORTS, 'Report type changed', {
        selectedReportType,
        selectedMainType
    });

    updateCategoryOptions();
}

async function updateCategoryOptions() {
    const categorySelect = document.getElementById('category-filter');
    const categoryHelp = document.querySelector('.category-help');
    
    // Early return if elements don't exist
    if (!categorySelect) {
        console.error('Category select element not found');
        return;
    }

    try {
        if (!selectedMainType) {
            throw new ReportError('No report type selected', ErrorCodes.INVALID_REPORT_TYPE);
        }

        // Clear existing options
        categorySelect.innerHTML = '<option value="all">All Categories</option>';
        
        let categories = [];
        
        // Get categories based on main type
        switch (selectedMainType) {
            case 'animal':
                categories = await getAnimalCategories();
                if (categoryHelp) categoryHelp.textContent = 'Filter by animal category';
                break;
            case 'feed':
                // Use animal categories for feed reports (filter by which animal the feed was used for)
                categories = await getAnimalCategories();
                if (categoryHelp) categoryHelp.textContent = 'Filter by animal category';
                break;
            case 'health':
                categories = await getAnimalCategories();
                if (categoryHelp) categoryHelp.textContent = 'Filter by animal category';
                break;
            default:
                throw new ReportError('Invalid report type', ErrorCodes.INVALID_REPORT_TYPE);
        }

        // Add categories to select (allow empty - "All Categories" only, same as animals)
        if (Array.isArray(categories) && categories.length > 0) {
            categories.forEach(category => {
                if (typeof category === 'string' && category.trim()) {
                    const option = document.createElement('option');
                    option.value = category.trim();
                    option.textContent = category.trim();
                    categorySelect.appendChild(option);
                }
            });
        }
        categorySelect.disabled = false;
    } catch (error) {
        const reportError = error instanceof ReportError ? error :
            new ReportError('Failed to load categories', ErrorCodes.CATEGORY_LOAD_ERROR, { originalError: error });
        await ErrorHandler.handleError(reportError, { mainType: selectedMainType });
        if (categorySelect) categorySelect.disabled = true;
        if (categoryHelp) categoryHelp.textContent = 'Error loading categories';
    }
}

function handleCategoryChange() {
    // No automatic report generation
}

async function handleGenerateReport() {
    try {
        console.log('Starting report generation...');
        const filters = collectFilters();
        console.log('Collected filters:', filters);
        Logger.debug(Logger.MODULES.REPORTS, 'Collected filters', filters);
        
        // Validate filters
        const validationRules = {
            'reportType': [ValidationRules.REQUIRED, ValidationRules.REPORT_TYPE],
            'category': [ValidationRules.REQUIRED, ValidationRules.CATEGORY],
            'dateRange.start': [ValidationRules.REQUIRED, ValidationRules.DATE],
            'dateRange.end': [ValidationRules.REQUIRED, ValidationRules.DATE]
        };

        const errors = DataValidator.validate({
            reportType: filters.reportType,
            category: filters.category,
            'dateRange.start': filters.dateRange.start,
            'dateRange.end': filters.dateRange.end
        }, validationRules);

        if (errors.length > 0) {
            console.log('Validation errors:', errors);
            // Check if errors are date-related
            const dateErrors = errors.filter(err => 
                err.toLowerCase().includes('date') || 
                err.includes('dateRange')
            );
            
            if (dateErrors.length > 0) {
                // Reset dates to default if there are date validation errors
                const defaultDates = DateManager.getDefaultDateRange();
                document.getElementById('date-from').value = defaultDates.start;
                document.getElementById('date-to').value = defaultDates.end;
                
                throw new ReportError(
                    'Invalid date range - reset to default range',
                    ErrorCodes.INVALID_DATE_RANGE,
                    { errors: dateErrors }
                );
            }
            
            throw new ReportError('Validation failed', ErrorCodes.INVALID_DATE_RANGE, { errors });
        }

        console.log('Validation passed, proceeding with report generation');
        Logger.debug(Logger.MODULES.REPORTS, 'Generate report clicked', {
            reportType: selectedReportType,
            mainType: selectedMainType,
            filters
        });

        try {
            console.log('Starting data collection...');
            Logger.debug(Logger.MODULES.REPORTS, 'Collecting report data');
            const reportData = await collectReportData(filters);
            console.log('Report data collected:', {
                hasData: !!reportData,
                dataType: typeof reportData,
                isArray: Array.isArray(reportData),
                data: reportData
            });
            Logger.debug(Logger.MODULES.REPORTS, 'Report data collected', {
                hasData: !!reportData,
                dataType: typeof reportData,
                isArray: Array.isArray(reportData)
            });

            if (!reportData || (Array.isArray(reportData) && reportData.length === 0)) {
                console.log('No data found for report');
                document.querySelector('.report-content').innerHTML = 
                    '<div class="empty-state">No records found for the selected criteria</div>';
                return;
            }
            
            console.log('Displaying report...');
            Logger.debug(Logger.MODULES.REPORTS, 'Displaying report');
            await displayReport(reportData);
            console.log('Report displayed successfully');
            Logger.debug(Logger.MODULES.REPORTS, 'Report displayed successfully');
        } catch (dataError) {
            console.error('Error in data processing:', dataError);
            Logger.error(Logger.MODULES.REPORTS, 'Error in data processing', {
                error: dataError.message,
                stack: dataError.stack,
                phase: dataError.code || 'unknown'
            });
            throw dataError;
        }
    } catch (error) {
        console.error('Final error handler:', error);
        const reportError = error instanceof ReportError ? error :
            new ReportError('Failed to generate report', ErrorCodes.DISPLAY_ERROR, { 
                originalError: error,
                message: error.message,
                stack: error.stack
            });
        await ErrorHandler.handleError(reportError, {
            reportType: selectedReportType,
            mainType: selectedMainType,
            error: error.message,
            stack: error.stack
        });
    }
}

function collectFilters() {
    // Get date elements
    const dateFromInput = document.getElementById('date-from');
    const dateToInput = document.getElementById('date-to');
    
    // Get default dates if inputs don't exist or have no value
    const defaultDates = DateManager.getDefaultDateRange();
    const startDate = dateFromInput && dateFromInput.value ? dateFromInput.value : defaultDates.start;
    const endDate = dateToInput && dateToInput.value ? dateToInput.value : defaultDates.end;
    
    // If the inputs don't exist, create them with default values
    if (!dateFromInput) {
        console.warn('Date-from input not found, using default date');
    }
    if (!dateToInput) {
        console.warn('Date-to input not found, using default date');
    }
    
    return {
        reportType: selectedReportType,
        mainType: selectedMainType,
        category: document.getElementById('category-filter')?.value || 'all',
        dateRange: {
            start: startDate,
            end: endDate
        }
    };
}

async function collectReportData(filters) {
    try {
        const { reportType, category, dateRange } = filters;
        Logger.debug(Logger.MODULES.REPORTS, 'Starting data collection', { reportType, category, dateRange });

        // Validate data before processing
        const validationRules = {
            reportType: [ValidationRules.REQUIRED, ValidationRules.REPORT_TYPE],
            category: [ValidationRules.REQUIRED, ValidationRules.CATEGORY]
        };

        const errors = DataValidator.validate({ reportType, category }, validationRules);
        if (errors.length > 0) {
            throw new ReportError('Invalid data format', ErrorCodes.DATA_LOAD_ERROR, { errors });
        }

        let data;

        // Determine report type category
        if (reportType.startsWith('animal-') || reportType === 'all-animal') {
            Logger.debug(Logger.MODULES.REPORTS, 'Processing animal report');
            // Handle animal reports
            switch (reportType) {
                case 'all-animal':
                    data = await loadAnimalData(category, dateRange.start, dateRange.end);
                    break;
                case 'animal-inventory':
                    data = await loadAnimalInventoryData(category);
                    break;
                case 'animal-movement':
                    data = await loadAnimalMovementData(category, dateRange.start, dateRange.end);
                    break;
                case 'animal-purchase':
                    data = await loadAnimalPurchaseData(category, dateRange.start, dateRange.end);
                    break;
                case 'animal-sale':
                    data = await loadAnimalSaleData(category, dateRange.start, dateRange.end);
                    break;
                case 'animal-birth':
                    data = await loadAnimalBirthData(category, dateRange.start, dateRange.end);
                    break;
                case 'animal-death':
                    data = await loadAnimalDeathData(category, dateRange.start, dateRange.end);
                    break;
                case 'animal-count':
                    data = await loadAnimalCountData(category, dateRange.start, dateRange.end);
                    break;
                case 'animal-discrepancy':
                    data = await loadAnimalDiscrepancyData(category, dateRange.start, dateRange.end);
                    break;
                default:
                    throw new ReportError('Invalid animal report type', ErrorCodes.INVALID_REPORT_TYPE, { reportType });
            }
        } else if (reportType.startsWith('feed-') || reportType === 'all-feed') {
            Logger.debug(Logger.MODULES.REPORTS, 'Processing feed report');
            try {
                // Import feed functions dynamically to avoid circular dependencies
                const { 
                    loadFeedData,
                    loadFeedPurchaseData,
                    loadFeedUsageData,
                    loadFeedCalculationData
                } = await import('./reports.feed.js');
                Logger.debug(Logger.MODULES.REPORTS, 'Feed functions imported successfully');

                // Convert dates to Date objects
                const startDate = new Date(dateRange.start);
                const endDate = new Date(dateRange.end);
                Logger.debug(Logger.MODULES.REPORTS, 'Date range converted', { startDate, endDate });

                // Handle feed reports
                switch (reportType) {
                    case 'all-feed':
                        data = await loadFeedData(category, startDate, endDate);
                        break;
                    case 'feed-inventory':
                        data = await loadFeedData(category, startDate, endDate);
                        break;
                    case 'feed-purchase':
                        data = await loadFeedPurchaseData(startDate, endDate, category);
                        break;
                    case 'feed-usage':
                        data = await loadFeedUsageData(startDate, endDate, category);
                        break;
                    case 'feed-calculation':
                        data = await loadFeedCalculationData(startDate, endDate, category);
                        break;
                    default:
                        throw new ReportError('Invalid feed report type', ErrorCodes.INVALID_REPORT_TYPE, { reportType });
                }
                Logger.debug(Logger.MODULES.REPORTS, 'Feed data loaded successfully', {
                    hasData: !!data,
                    dataType: typeof data
                });
            } catch (feedError) {
                Logger.error(Logger.MODULES.REPORTS, 'Error processing feed report', {
                    error: feedError.message,
                    stack: feedError.stack,
                    reportType
                });
                throw new ReportError('Failed to process feed report', ErrorCodes.DATA_LOAD_ERROR, {
                    originalError: feedError,
                    reportType,
                    category
                });
            }
        } else if (reportType.startsWith('health-') || reportType === 'all-health') {
            Logger.debug(Logger.MODULES.REPORTS, 'Processing health report');
            try {
                // Import health functions dynamically to avoid circular dependencies
                const { 
                    loadHealthData,
                    loadHealthTreatmentData,
                    loadHealthVaccinationData,
                    loadHealthMedicationData
                } = await import('./reports.health.js');
                Logger.debug(Logger.MODULES.REPORTS, 'Health functions imported successfully');

                // Create dateRange object for health functions
                const healthDateRange = {
                    start: dateRange.start,
                    end: dateRange.end
                };
                Logger.debug(Logger.MODULES.REPORTS, 'Date range prepared', { healthDateRange });

                // Handle health reports
                switch (reportType) {
                    case 'all-health':
                        data = await loadHealthData(category, healthDateRange);
                        break;
                    case 'health-treatment':
                        data = await loadHealthTreatmentData(healthDateRange, category);
                        break;
                    case 'health-vaccination':
                        data = await loadHealthVaccinationData(healthDateRange, category);
                        break;
                    case 'health-medication':
                        data = await loadHealthMedicationData(healthDateRange, category);
                        break;
                    default:
                        throw new ReportError('Invalid health report type', ErrorCodes.INVALID_REPORT_TYPE, { reportType });
                }
                Logger.debug(Logger.MODULES.REPORTS, 'Health data loaded successfully', {
                    hasData: !!data,
                    dataType: typeof data
                });
            } catch (healthError) {
                Logger.error(Logger.MODULES.REPORTS, 'Error processing health report', {
                    error: healthError.message,
                    stack: healthError.stack,
                    reportType
                });
                throw new ReportError('Failed to process health report', ErrorCodes.DATA_LOAD_ERROR, {
                    originalError: healthError,
                    reportType,
                    category
                });
            }
        } else {
            throw new ReportError('Invalid report type', ErrorCodes.INVALID_REPORT_TYPE, { reportType });
        }

        if (!data) {
            throw new ReportError('No data returned', ErrorCodes.DATA_LOAD_ERROR, {
                reportType,
                category,
                dateRange
            });
        }

        Logger.debug(Logger.MODULES.REPORTS, 'Data collection completed successfully', {
            reportType,
            hasData: !!data,
            dataType: typeof data
        });
        return data;
    } catch (error) {
        Logger.error(Logger.MODULES.REPORTS, 'Error in data collection', {
            error: error.message,
            stack: error.stack,
            code: error.code || 'unknown'
        });
        const reportError = error instanceof ReportError ? error :
            new ReportError('Failed to load report data', ErrorCodes.DATA_LOAD_ERROR, {
                originalError: error,
                message: error.message,
                stack: error.stack
            });
        throw reportError;
    }
}

async function displayReport(data) {
    try {
        let reportHTML = '';

        // Handle different report types
        if (selectedReportType.startsWith('animal-') || selectedReportType === 'all-animal') {
            // Handle animal reports
            switch (selectedReportType) {
                case 'all-animal':
                    reportHTML = createAnimalReportTable(data);
                    break;
                case 'animal-inventory':
                    reportHTML = createAnimalInventoryTable(data);
                    break;
                case 'animal-movement':
                    reportHTML = createAnimalMovementTable(data);
                    break;
                case 'animal-purchase':
                    reportHTML = createAnimalPurchaseTable(data);
                    break;
                case 'animal-sale':
                    reportHTML = createAnimalSaleTable(data);
                    break;
                case 'animal-birth':
                    reportHTML = createAnimalBirthTable(data);
                    break;
                case 'animal-death':
                    reportHTML = createAnimalDeathTable(data);
                    break;
                case 'animal-count':
                    reportHTML = createAnimalCountTable(data);
                    break;
                case 'animal-discrepancy':
                    reportHTML = createAnimalDiscrepancyTable(data);
                    break;
                default:
                    throw new Error(`Unknown animal report type: ${selectedReportType}`);
            }
        } else if (selectedReportType.startsWith('feed-') || selectedReportType === 'all-feed') {
            // Import feed functions dynamically to avoid circular dependencies
            const { 
                createFeedReportTable,
                createFeedPurchaseTable,
                createFeedInventoryTable,
                createFeedUsageTable,
                createFeedCalculationTable,
                createAllFeedReportTable
            } = await import('./reports.feed.js');

            // Handle feed reports
            switch (selectedReportType) {
                case 'all-feed':
                    reportHTML = createAllFeedReportTable(data);
                    break;
                case 'feed-inventory':
                    reportHTML = createFeedInventoryTable(data);
                    break;
                case 'feed-purchase':
                    reportHTML = createFeedPurchaseTable(data);
                    break;
                case 'feed-usage':
                    reportHTML = createFeedUsageTable(data);
                    break;
                case 'feed-calculation':
                    reportHTML = createFeedCalculationTable(data);
                    break;
                default:
                    throw new Error(`Unknown feed report type: ${selectedReportType}`);
            }
        } else if (selectedReportType.startsWith('health-') || selectedReportType === 'all-health') {
            // Handle health reports
            switch (selectedReportType) {
                case 'all-health':
                    reportHTML = createAllHealthReportTable(data);
                    break;
                case 'health-treatment':
                    reportHTML = createHealthTreatmentTable(data);
                    break;
                case 'health-vaccination':
                    reportHTML = createHealthVaccinationTable(data);
                    break;
                case 'health-medication':
                    reportHTML = createHealthMedicationTable(data);
                    break;
                default:
                    throw new Error(`Unknown health report type: ${selectedReportType}`);
            }
        } else {
            throw new Error(`Unknown report type: ${selectedReportType}`);
        }

        const reportContent = document.querySelector('.report-content');
        if (!reportContent) {
            throw new Error('Report content container not found');
        }
        reportContent.innerHTML = reportHTML;
    } catch (error) {
        Logger.error(Logger.MODULES.REPORTS, 'Error displaying report', {
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
}

// Export functions for use in other modules
export {
    handleReportTypeChange,
    updateCategoryOptions,
    handleCategoryChange,
    handleGenerateReport,
    collectFilters
}; 

/**
 * Collect health-related report data
 * @param {string} reportType - Specific health report type
 * @param {string} category - Health category filter
 * @param {Date} startDate - Start date for filtering
 * @param {Date} endDate - End date for filtering
 * @returns {Promise<Object|Array>} Health report data
 */
async function collectHealthReportData(reportType, category, startDate, endDate) {
    try {
        const dateRange = {
            start: startDate.toISOString().split('T')[0],
            end: endDate.toISOString().split('T')[0]
        };
        
        switch (reportType) {
            case 'all-health':
                return await loadHealthData(category, dateRange);
                
            case 'health-treatment':
                return await loadHealthTreatmentData(dateRange, category);
                
            case 'health-vaccination':
                return await loadHealthVaccinationData(dateRange, category);
                
            case 'health-medication':
                return await loadHealthMedicationData(dateRange, category);
                
            default:
                console.warn(`Unknown health report type: ${reportType}`);
                return {
                    _hasData: false,
                    hasData: false,
                    nothingFound: true
                };
        }
    } catch (error) {
        console.error('Error in collectHealthReportData:', error);
        throw new ReportError('Failed to process health report', ErrorCodes.DATA_LOAD_ERROR, { error });
    }
} 