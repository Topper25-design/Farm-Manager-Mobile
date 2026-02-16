// Import required utilities
import { 
    StorageManager,
    DateManager,
    formatDate, 
    formatCurrency, 
    printReport, 
    exportReportToCSV, 
    createStandardReportStructure 
} from './utils.js';
import { getTableSelectorForReportType } from './utils.js';

// Define report types constants
const REPORT_TYPES = {
    HEALTH: {
        ALL: 'all_health',
        TREATMENT: 'treatment',
        VACCINATION: 'vaccination',
        MEDICATION: 'medication',
        RECORDS: 'health_records',
        ACTIVITIES: 'health_activities'
    }
};


// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initializeHealthReporting();
});

// Core initialization function
function initializeHealthReporting() {
    // Register global functions
    window.handleHealthTypeChange = handleHealthTypeChange;
    window.handleHealthCategoryChange = handleHealthCategoryChange;
    window.generateHealthReport = generateHealthReport;
}

/**
 * Load health data for reports
 * @param {string} category - Animal category to filter by
 * @param {Date} startDate - Start date for filtering
 * @param {Date} endDate - End date for filtering
 * @returns {Object} Health data and related information
 */
async function loadHealthData(category = 'all', startDate = null, endDate = null) {
    try {
        console.log(`Loading health data for ${category} from ${startDate} to ${endDate}`);
        
        // Ensure we have valid dates
        const validStartDate = startDate || new Date(0);
        const validEndDate = endDate || new Date();
        
        const dateRange = {
            start: validStartDate,
            end: validEndDate
        };

        // Load all health data
        const healthData = await loadAllHealthData(dateRange);
        
        // Filter by category if specified
        if (category && category !== 'all') {
            if (healthData.treatments) {
                healthData.treatments = healthData.treatments.filter(t => {
                    const recordCategory = t.animalCategory || t.animalType || t.category;
                    return !recordCategory || recordCategory.toLowerCase() === category.toLowerCase();
                });
            }
            if (healthData.vaccinations) {
                healthData.vaccinations = healthData.vaccinations.filter(v => {
                    const recordCategory = v.animalCategory || v.animalType || v.category;
                    return !recordCategory || recordCategory.toLowerCase() === category.toLowerCase();
                });
            }
            if (healthData.medications) {
                healthData.medications = healthData.medications.filter(m => {
                    const recordCategory = m.animalCategory || m.animalType || m.category;
                    return !recordCategory || recordCategory.toLowerCase() === category.toLowerCase();
                });
            }
            if (healthData.records) {
                healthData.records = healthData.records.filter(r => {
                    const recordCategory = r.animalCategory || r.animalType || r.category;
                    return !recordCategory || recordCategory.toLowerCase() === category.toLowerCase();
                });
            }
            if (healthData.activities) {
                healthData.activities = healthData.activities.filter(a => {
                    const recordCategory = a.animalCategory || a.animalType || a.category;
                    return !recordCategory || recordCategory.toLowerCase() === category.toLowerCase();
                });
            }
        }

        // Add metadata
        return {
            ...healthData,
            hasData: !isHealthReportEmpty(healthData),
            _hasData: !isHealthReportEmpty(healthData),
            _isDemoData: false,
            categoryFilter: category,
            dateRange: {
                start: validStartDate,
                end: validEndDate
            }
        };
    } catch (error) {
        console.error('Error loading health data:', error);
        return {
            treatments: [],
            vaccinations: [],
            medications: [],
            records: [],
            activities: [],
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

// Core data loading functions
async function loadAllHealthData(dateRange = null) {
    try {
        const [treatments, vaccinations, medications, records, activities] = await Promise.all([
            loadHealthTreatmentData(dateRange),
            loadHealthVaccinationData(dateRange),
            loadHealthMedicationData(dateRange),
            loadHealthRecords(dateRange),
            loadHealthActivities(dateRange)
        ]);

        return {
            treatments,
            vaccinations,
            medications,
            records,
            activities
        };
    } catch (error) {
        console.error('Error loading health data:', error);
        throw error;
    }
}

async function loadHealthTreatmentData(dateRange, category = 'all') {
    try {
        // Try multiple possible storage keys - health.js stores everything in 'healthRecords'
        const possibleKeys = [
            'healthRecords',
            'animalTreatments', 
            'treatments', 
            'healthTreatments', 
            'health_treatments',
            'animal_treatments',
            'treatments_data',
            'healthData_treatments',
            'healthRecords_treatments',
            'health'
        ];

        let treatments = [];
        
        // Try each possible key
        for (const key of possibleKeys) {
            const data = await StorageManager.getItem(key, { bypassCache: true }) || [];
            if (Array.isArray(data) && data.length > 0) {
                treatments = treatments.concat(data);
                console.log(`Found ${data.length} records in ${key}, total: ${treatments.length}`);
                if (key === 'healthRecords') break; // Prefer healthRecords
            } else if (data && typeof data === 'object' && (data.treatments || data.records)) {
                const records = data.treatments || data.records || [];
                treatments = treatments.concat(records);
                console.log(`Found ${records.length} records in ${key} (object), total: ${treatments.length}`);
                if (key === 'healthRecords') break;
            }
        }
        
        console.log(`Total treatments loaded before filtering: ${treatments.length}`);
        console.log(`Received dateRange:`, dateRange);
        console.log(`Received category:`, category);
        if (!treatments.length) {
            console.log('No treatments found in storage');
            return [];
        }

        // Convert dateRange strings to Date objects if needed
        let startDate = null;
        let endDate = null;
        
        if (dateRange) {
            startDate = dateRange.start;
            endDate = dateRange.end;
            
            if (startDate) {
                if (typeof startDate === 'string') {
                    startDate = new Date(startDate);
                }
                if (startDate instanceof Date && !isNaN(startDate.getTime())) {
                    startDate.setHours(0, 0, 0, 0);
                } else {
                    startDate = null;
                }
            }
            
            if (endDate) {
                if (typeof endDate === 'string') {
                    endDate = new Date(endDate);
                }
                if (endDate instanceof Date && !isNaN(endDate.getTime())) {
                    endDate.setHours(23, 59, 59, 999);
                } else {
                    endDate = null;
                }
            }
        }

        console.log(`Date range: ${startDate ? startDate.toISOString() : 'none'} to ${endDate ? endDate.toISOString() : 'none'}, category: ${category}`);
        console.log(`Sample treatment types found:`, [...new Set(treatments.map(t => t.type))].slice(0, 5));

        const filtered = treatments
            .filter(treatment => {
                // Filter by type
                const treatmentType = treatment.type || '';
                if (treatmentType !== 'treatment') {
                    return false;
                }
                
                // Filter by category
                if (category && category !== 'all') {
                    const treatmentCategory = treatment.category || treatment.animalCategory || treatment.animalType;
                    if (treatmentCategory !== category) return false;
                }
                
                // Filter by date range
                if (dateRange && startDate && endDate && treatment.date) {
                    const treatmentDate = new Date(treatment.date);
                    return treatmentDate >= startDate && treatmentDate <= endDate;
                }
                return true;
            })
            .map(treatment => ({
                ...treatment,
                type: treatment.type || 'treatment',
                date: new Date(treatment.date),
                cost: parseFloat(treatment.cost || 0),
                followUpDate: treatment.followUpDate ? new Date(treatment.followUpDate) : null,
                animalCategory: treatment.animalCategory || treatment.animalType || treatment.category || 'unknown',
                animalId: treatment.animalId || treatment.animal_id || null,
                treatmentType: treatment.treatmentType || treatment.treatment_type || treatment.treatment || 'general',
                notes: treatment.notes || treatment.description || '',
                administered_by: treatment.administered_by || treatment.administeredBy || 'unknown'
            }))
            .sort((a, b) => b.date - a.date);
        
        console.log(`Filtered treatments: ${filtered.length}`);
        return filtered;
    } catch (error) {
        console.error('Error loading treatment data:', error);
        return [];
    }
}

async function loadHealthVaccinationData(dateRange, category = 'all') {
    try {
        // Try multiple possible storage keys - health.js stores everything in 'healthRecords'
        const possibleKeys = [
            'healthRecords',
            'animalVaccinations', 
            'vaccinations', 
            'healthVaccinations',
            'health_vaccinations',
            'animal_vaccinations',
            'vaccinations_data',
            'healthData_vaccinations',
            'healthRecords_vaccinations',
            'health'
        ];

        let vaccinations = [];
        
        // Try each possible key
        for (const key of possibleKeys) {
            const data = await StorageManager.getItem(key, { bypassCache: true }) || [];
            if (Array.isArray(data) && data.length > 0) {
                vaccinations = vaccinations.concat(data);
                console.log(`Found ${data.length} records in ${key}, total: ${vaccinations.length}`);
                if (key === 'healthRecords') break; // Prefer healthRecords
            } else if (data && typeof data === 'object' && (data.vaccinations || data.records)) {
                const records = data.vaccinations || data.records || [];
                vaccinations = vaccinations.concat(records);
                console.log(`Found ${records.length} records in ${key} (object), total: ${vaccinations.length}`);
                if (key === 'healthRecords') break;
            }
        }
        
        console.log(`Total vaccinations loaded before filtering: ${vaccinations.length}`);
        console.log(`Received dateRange:`, dateRange);
        console.log(`Received category:`, category);
        if (!vaccinations.length) {
            console.log('No vaccinations found in storage');
            return [];
        }

        // Convert dateRange strings to Date objects if needed
        let startDate = null;
        let endDate = null;
        
        if (dateRange) {
            startDate = dateRange.start;
            endDate = dateRange.end;
            
            if (startDate) {
                if (typeof startDate === 'string') {
                    startDate = new Date(startDate);
                }
                if (startDate instanceof Date && !isNaN(startDate.getTime())) {
                    startDate.setHours(0, 0, 0, 0);
                } else {
                    startDate = null;
                }
            }
            
            if (endDate) {
                if (typeof endDate === 'string') {
                    endDate = new Date(endDate);
                }
                if (endDate instanceof Date && !isNaN(endDate.getTime())) {
                    endDate.setHours(23, 59, 59, 999);
                } else {
                    endDate = null;
                }
            }
        }

        console.log(`Date range: ${startDate ? startDate.toISOString() : 'none'} to ${endDate ? endDate.toISOString() : 'none'}, category: ${category}`);
        console.log(`Sample vaccination types found:`, [...new Set(vaccinations.map(v => v.type))].slice(0, 5));

        const filtered = vaccinations
            .filter(vaccination => {
                // Filter by type
                const vaccinationType = vaccination.type || '';
                if (vaccinationType !== 'vaccination') {
                    return false;
                }
                
                // Filter by category
                if (category && category !== 'all') {
                    const vaccinationCategory = vaccination.category || vaccination.animalCategory || vaccination.animalType;
                    if (vaccinationCategory !== category) return false;
                }
                
                // Filter by date range
                if (dateRange && startDate && endDate && vaccination.date) {
                    const vaccinationDate = new Date(vaccination.date);
                    return vaccinationDate >= startDate && vaccinationDate <= endDate;
                }
                return true;
            })
            .map(vaccination => ({
                ...vaccination,
                type: vaccination.type || 'vaccination',
                date: new Date(vaccination.date),
                cost: parseFloat(vaccination.cost || 0),
                nextDueDate: vaccination.nextDueDate ? new Date(vaccination.nextDueDate) : null,
                nextDate: vaccination.nextDate || vaccination.nextDueDate,
                batchNumber: vaccination.batchNumber || vaccination.batch_number || 'N/A',
                effectiveness: parseFloat(vaccination.effectiveness || 100),
                animalCategory: vaccination.animalCategory || vaccination.animalType || vaccination.category || 'unknown',
                animalId: vaccination.animalId || vaccination.animal_id || null,
                vaccineName: vaccination.vaccineName || vaccination.vaccine_name || vaccination.vaccine || 'unknown',
                manufacturer: vaccination.manufacturer || 'unknown',
                administered_by: vaccination.administered_by || vaccination.administeredBy || 'unknown'
            }))
            .sort((a, b) => b.date - a.date);
        
        console.log(`Filtered vaccinations: ${filtered.length}`);
        return filtered;
    } catch (error) {
        console.error('Error loading vaccination data:', error);
        return [];
    }
}

async function loadHealthMedicationData(dateRange, category = 'all') {
    try {
        // Try multiple possible storage keys - health.js stores everything in 'healthRecords'
        const possibleKeys = [
            'healthRecords',
            'animalMedications', 
            'medications', 
            'healthMedications',
            'health_medications',
            'animal_medications',
            'medications_data',
            'healthData_medications',
            'healthRecords_medications',
            'health'
        ];

        let medications = [];
        
        // Try each possible key
        for (const key of possibleKeys) {
            const data = await StorageManager.getItem(key, { bypassCache: true }) || [];
            if (Array.isArray(data) && data.length > 0) {
                medications = medications.concat(data);
                console.log(`Found ${data.length} records in ${key}, total: ${medications.length}`);
                if (key === 'healthRecords') break; // Prefer healthRecords
            } else if (data && typeof data === 'object' && (data.medications || data.records)) {
                const records = data.medications || data.records || [];
                medications = medications.concat(records);
                console.log(`Found ${records.length} records in ${key} (object), total: ${medications.length}`);
                if (key === 'healthRecords') break;
            }
        }
        
        console.log(`Total medications loaded before filtering: ${medications.length}`);
        console.log(`Received dateRange:`, dateRange);
        console.log(`Received category:`, category);
        if (!medications.length) {
            console.log('No medications found in storage');
            return [];
        }

        // Convert dateRange strings to Date objects if needed
        let startDate = null;
        let endDate = null;
        
        if (dateRange) {
            startDate = dateRange.start;
            endDate = dateRange.end;
            
            if (startDate) {
                if (typeof startDate === 'string') {
                    startDate = new Date(startDate);
                }
                if (startDate instanceof Date && !isNaN(startDate.getTime())) {
                    startDate.setHours(0, 0, 0, 0);
                } else {
                    startDate = null;
                }
            }
            
            if (endDate) {
                if (typeof endDate === 'string') {
                    endDate = new Date(endDate);
                }
                if (endDate instanceof Date && !isNaN(endDate.getTime())) {
                    endDate.setHours(23, 59, 59, 999);
                } else {
                    endDate = null;
                }
            }
        }

        console.log(`Date range: ${startDate ? startDate.toISOString() : 'none'} to ${endDate ? endDate.toISOString() : 'none'}, category: ${category}`);
        console.log(`Sample medication types found:`, [...new Set(medications.map(m => m.type))].slice(0, 5));

        const filtered = medications
            .filter(medication => {
                // Filter by type
                const medicationType = medication.type || '';
                if (medicationType !== 'medication') {
                    return false;
                }
                
                // Filter by category
                if (category && category !== 'all') {
                    const medicationCategory = medication.category || medication.animalCategory || medication.animalType;
                    if (medicationCategory !== category) return false;
                }
                
                // Filter by date range
                if (dateRange && startDate && endDate && (medication.date || medication.dateAdded)) {
                    const medicationDate = new Date(medication.date || medication.dateAdded);
                    return medicationDate >= startDate && medicationDate <= endDate;
                }
                return true;
            })
            .map(medication => ({
                ...medication,
                type: medication.type || 'medication',
                date: new Date(medication.date || medication.dateAdded),
                cost: parseFloat(medication.cost || 0),
                dosage: medication.dosage || '',
                duration: parseInt(medication.duration || 0),
                remainingDoses: parseInt(medication.remainingDoses || 0),
                expiryDate: medication.expiryDate ? new Date(medication.expiryDate) : null,
                animalCategory: medication.animalCategory || medication.animalType || medication.category || 'unknown',
                animalId: medication.animalId || medication.animal_id || null,
                medicationName: medication.medicationName || medication.medication_name || medication.medication || 'unknown',
                manufacturer: medication.manufacturer || 'unknown',
                administered_by: medication.administered_by || medication.administeredBy || 'unknown',
                route: medication.route || medication.administration_route || 'unknown',
                frequency: medication.frequency || 'as needed',
                withdrawalPeriod: medication.withdrawalPeriod || medication.withdrawal_period || 0
            }))
            .sort((a, b) => b.date - a.date);
        
        console.log(`Filtered medications: ${filtered.length}`);
        return filtered;
    } catch (error) {
        console.error('Error loading medication data:', error);
        return [];
    }
}

async function loadHealthRecords(dateRange) {
    try {
        // Try multiple possible storage keys - health.js stores everything in 'healthRecords'
        const possibleKeys = [
            'healthRecords',
            'health_records',
            'animalHealthRecords',
            'animal_health_records',
            'health',
            'healthData_records',
            'healthRecords_general'
        ];

        let records = [];
        
        // Try each possible key
        for (const key of possibleKeys) {
            const data = await StorageManager.getItem(key, { bypassCache: true }) || [];
            if (Array.isArray(data) && data.length > 0) {
                records = records.concat(data);
                console.log(`Found ${data.length} records in ${key}, total: ${records.length}`);
                if (key === 'healthRecords') break; // Prefer healthRecords
            } else if (data && typeof data === 'object' && (data.records || data.healthRecords)) {
                const recordData = data.records || data.healthRecords || [];
                records = records.concat(recordData);
                console.log(`Found ${recordData.length} records in ${key} (object), total: ${records.length}`);
                if (key === 'healthRecords') break;
            }
        }
        
        console.log(`Total health records loaded before filtering: ${records.length}`);
        if (!records.length) {
            console.log('No health records found in storage');
            return [];
        }

        // Convert dateRange strings to Date objects if needed
        let startDate = null;
        let endDate = null;
        
        if (dateRange) {
            startDate = dateRange.start;
            endDate = dateRange.end;
            
            if (startDate) {
                if (typeof startDate === 'string') {
                    startDate = new Date(startDate);
                }
                if (startDate instanceof Date && !isNaN(startDate.getTime())) {
                    startDate.setHours(0, 0, 0, 0);
                } else {
                    startDate = null;
                }
            }
            
            if (endDate) {
                if (typeof endDate === 'string') {
                    endDate = new Date(endDate);
                }
                if (endDate instanceof Date && !isNaN(endDate.getTime())) {
                    endDate.setHours(23, 59, 59, 999);
                } else {
                    endDate = null;
                }
            }
        }

        console.log(`Date range: ${startDate ? startDate.toISOString() : 'none'} to ${endDate ? endDate.toISOString() : 'none'}`);
        console.log(`Sample health record types found:`, [...new Set(records.map(r => r.type))].slice(0, 5));

        const filtered = records
            .filter(record => {
                // Filter by type
                const recordType = record.type || '';
                if (recordType !== 'health-record') {
                    return false;
                }
                
                // Filter by date range
                if (dateRange && startDate && endDate && record.date) {
                    const recordDate = new Date(record.date);
                    return recordDate >= startDate && recordDate <= endDate;
                }
                return true;
            })
            .map(record => ({
                ...record,
                type: record.type || 'health-record',
                date: new Date(record.date),
                lastUpdated: new Date(record.lastUpdated || record.date),
                animalCategory: record.animalCategory || record.animalType || record.category || 'unknown',
                animalId: record.animalId || record.animal_id || null,
                recordedBy: record.recordedBy || record.recorded_by || 'unknown',
                condition: record.condition || '',
                severity: record.severity || '',
                description: record.description || '',
                metrics: {
                    ...record.metrics,
                    weight: parseFloat(record.metrics?.weight || 0),
                    temperature: parseFloat(record.metrics?.temperature || 0),
                    heartRate: parseInt(record.metrics?.heartRate || 0),
                    respiratoryRate: parseInt(record.metrics?.respiratoryRate || 0),
                    bodyCondition: record.metrics?.bodyCondition || 'normal',
                    hydration: record.metrics?.hydration || 'normal',
                    appetite: record.metrics?.appetite || 'normal'
                },
                diagnosis: record.diagnosis || '',
                prognosis: record.prognosis || '',
                recommendations: record.recommendations || []
            }))
            .sort((a, b) => b.date - a.date);
        
        console.log(`Filtered health records: ${filtered.length}`);
        return filtered;
    } catch (error) {
        console.error('Error loading health records:', error);
        return [];
    }
}

async function loadHealthActivities(dateRange) {
    try {
        // Try multiple possible storage keys - health.js stores everything in 'healthRecords'
        const possibleKeys = [
            'healthRecords',
            'healthActivities',
            'health_activities',
            'animalHealthActivities',
            'animal_health_activities',
            'health',
            'healthData_activities',
            'healthRecords_activities'
        ];

        let activities = [];
        
        // Try each possible key
        for (const key of possibleKeys) {
            const data = await StorageManager.getItem(key, { bypassCache: true }) || [];
            if (Array.isArray(data) && data.length > 0) {
                activities = activities.concat(data);
                if (key === 'healthRecords') break; // Prefer healthRecords
            } else if (data && typeof data === 'object' && (data.activities || data.healthActivities)) {
                const activityData = data.activities || data.healthActivities || [];
                activities = activities.concat(activityData);
                if (key === 'healthRecords') break;
            }
        }
        
        if (!activities.length) return [];

        // Convert dateRange strings to Date objects if needed
        let startDate = null;
        let endDate = null;
        
        if (dateRange) {
            startDate = dateRange.start;
            endDate = dateRange.end;
            
            if (startDate) {
                if (typeof startDate === 'string') {
                    startDate = new Date(startDate);
                }
                if (startDate instanceof Date && !isNaN(startDate.getTime())) {
                    startDate.setHours(0, 0, 0, 0);
                } else {
                    startDate = null;
                }
            }
            
            if (endDate) {
                if (typeof endDate === 'string') {
                    endDate = new Date(endDate);
                }
                if (endDate instanceof Date && !isNaN(endDate.getTime())) {
                    endDate.setHours(23, 59, 59, 999);
                } else {
                    endDate = null;
                }
            }
        }

        return activities
            .filter(activity => {
                // Filter by type
                const activityType = activity.type || '';
                if (activityType !== 'health-activity' && activityType !== 'activity') {
                    return false;
                }
                
                // Filter by date range
                if (dateRange && startDate && endDate && activity.date) {
                    const activityDate = new Date(activity.date);
                    return activityDate >= startDate && activityDate <= endDate;
                }
                return true;
            })
            .map(activity => ({
                ...activity,
                type: activity.type || 'health-activity',
                date: new Date(activity.date),
                duration: parseInt(activity.duration || 0),
                cost: parseFloat(activity.cost || 0),
                animalCategory: activity.animalCategory || activity.animalType || activity.category || 'unknown',
                activityType: activity.activityType || activity.activity_type || 'general',
                participants: Array.isArray(activity.participants) ? activity.participants : [],
                outcomes: Array.isArray(activity.outcomes) ? activity.outcomes : [],
                location: activity.location || 'unknown',
                conductedBy: activity.conductedBy || activity.conducted_by || 'unknown',
                status: activity.status || 'completed',
                notes: activity.notes || ''
            }))
            .sort((a, b) => b.date - a.date);
    } catch (error) {
        console.error('Error loading health activities:', error);
        return [];
    }
}

// Event handlers
function handleHealthTypeChange(event) {
    const reportType = event.target.value;
    // TODO: Implement health type change handling
}

function handleHealthCategoryChange(event) {
    const category = event.target.value;
    // TODO: Implement health category change handling
}

// Report generation
async function generateHealthReport(reportType = REPORT_TYPES.HEALTH.ALL) {
    try {
        const dateRange = DateManager.getDefaultDateRange();
        const healthData = await loadAllHealthData(dateRange);
        
        switch (reportType) {
            case REPORT_TYPES.HEALTH.ALL:
                return createAllHealthReportTable(healthData);
            case REPORT_TYPES.HEALTH.TREATMENT:
                return createHealthTreatmentTable(healthData.treatments);
            case REPORT_TYPES.HEALTH.VACCINATION:
                return createHealthVaccinationTable(healthData.vaccinations);
            case REPORT_TYPES.HEALTH.MEDICATION:
                return createHealthMedicationTable(healthData.medications);
            case REPORT_TYPES.HEALTH.RECORDS:
                return createHealthRecordsTable(healthData.records);
            case REPORT_TYPES.HEALTH.ACTIVITIES:
                return createHealthActivitiesTable(healthData.activities);
            default:
                throw new Error(`Unknown health report type: ${reportType}`);
        }
    } catch (error) {
        console.error('Error generating health report:', error);
        throw error;
    }
}

// Helper function to check if report data is empty
function isHealthReportEmpty(reportData) {
    // Check for records array
    if (reportData.records && reportData.records.length > 0) {
        return false;
    }
    
    // Check for treatments, vaccinations, medications
    if (reportData.treatments && reportData.treatments.length > 0) return false;
    if (reportData.vaccinations && reportData.vaccinations.length > 0) return false;
    if (reportData.medications && reportData.medications.length > 0) return false;
    
    // Check within data objects
    if (reportData.treatmentData && reportData.treatmentData.records && 
        reportData.treatmentData.records.length > 0) {
        return false;
    }
    
    if (reportData.vaccinationData && reportData.vaccinationData.records && 
        reportData.vaccinationData.records.length > 0) {
        return false;
    }
    
    if (reportData.medicationData && reportData.medicationData.records && 
        reportData.medicationData.records.length > 0) {
        return false;
    }
    
    return true;
}

// Helper function to create report type header
function createReportTypeHeader(title, reportType) {
    return `
        <div class="report-type-header">
            <div class="report-type-title">${title}</div>
            <div class="report-actions">
                <button class="btn btn-export" onclick="exportReportToCSV('${reportType}')">
                    Export Report
                </button>
                <button class="btn btn-print" onclick="printReport('${reportType}')">
                    Print Report
                </button>
            </div>
        </div>
    `;
}

// Update existing report generation functions to include new features
function createAllHealthReportTable(healthData) {
    // Check for empty data
    if (isHealthReportEmpty(healthData)) {
        return createStandardReportStructure(
            REPORT_TYPES.HEALTH.ALL,
            'Complete Health Report',
            '',
            `<div class="empty-state">
                <h3>No Health Data Available</h3>
                <p>There are no health records in the system for the selected criteria.</p>
                <p>Try adding some health records first, or adjust your filters.</p>
            </div>`,
            { message: 'No health records found.' },
            false
        );
    }

    const totalTreatments = healthData.treatments?.length || 0;
    const totalVaccinations = healthData.vaccinations?.length || 0;
    const totalMedications = healthData.medications?.length || 0;
    const totalRecords = healthData.records?.length || 0;
    const totalActivities = healthData.activities?.length || 0;
    
    // Calculate total events
    const totalEvents = totalTreatments + totalVaccinations + totalMedications + totalRecords + totalActivities;

    const totalCost = [
        ...(healthData.treatments || []),
        ...(healthData.vaccinations || []),
        ...(healthData.medications || []),
        ...(healthData.activities || [])
    ].reduce((sum, item) => sum + (parseFloat(item.cost) || 0), 0);

    // Combine and sort all health events by date
    const allEvents = [
        ...(healthData.treatments || []).map(t => ({ ...t, eventType: 'Treatment' })),
        ...(healthData.vaccinations || []).map(v => ({ ...v, eventType: 'Vaccination' })),
        ...(healthData.medications || []).map(m => ({ ...m, eventType: 'Medication' })),
        ...(healthData.records || []).map(r => ({ ...r, eventType: 'Health Record' })),
        ...(healthData.activities || []).map(a => ({ ...a, eventType: 'Activity' }))
    ]
    .filter(event => event.date) // Filter out events without dates
    .sort((a, b) => new Date(b.date) - new Date(a.date));

    // Show all events, not just first 20
    const displayedEvents = allEvents;

    // Helper function to format event details based on type
    function formatEventDetails(event) {
        switch (event.eventType) {
            case 'Treatment':
                return `
                    <strong>Condition:</strong> ${event.condition || 'N/A'}<br>
                    <strong>Treatment:</strong> ${event.treatment || event.treatmentType || 'N/A'}<br>
                    ${event.quantity ? `<strong>Number of Animals:</strong> ${event.quantity}` : ''}
                    ${event.duration ? `<br><strong>Duration:</strong> ${event.duration} days` : ''}
                    ${event.notes ? `<br><strong>Notes:</strong> ${event.notes}` : ''}
                `;
            case 'Vaccination':
                return `
                    <strong>Vaccine:</strong> ${event.vaccine || event.vaccineName || 'N/A'}<br>
                    ${event.quantity ? `<strong>Number of Animals:</strong> ${event.quantity}` : ''}
                    ${event.nextDate || event.nextDueDate ? `<br><strong>Next Vaccination Date:</strong> ${formatDate(event.nextDate || event.nextDueDate)}` : ''}
                    ${event.notes ? `<br><strong>Notes:</strong> ${event.notes}` : ''}
                `;
            case 'Medication':
                return `
                    <strong>Medication:</strong> ${event.medication || event.medicationName || 'N/A'}<br>
                    <strong>Dosage:</strong> ${event.dosage || 'N/A'}<br>
                    ${event.quantity ? `<strong>Number of Animals:</strong> ${event.quantity}` : ''}
                    ${event.withdrawalPeriod ? `<br><strong>Withdrawal Period:</strong> ${event.withdrawalPeriod} days` : ''}
                    ${event.notes ? `<br><strong>Notes:</strong> ${event.notes}` : ''}
                `;
            case 'Health Record':
                return `
                    <strong>Condition:</strong> ${event.condition || 'N/A'}<br>
                    <strong>Severity:</strong> ${event.severity ? event.severity.charAt(0).toUpperCase() + event.severity.slice(1) : 'N/A'}<br>
                    <strong>Description:</strong> ${event.description || 'N/A'}
                `;
            case 'Activity':
                return `
                    <strong>Activity Type:</strong> ${event.activityType || 'N/A'}<br>
                    <strong>Status:</strong> ${event.status || 'N/A'}<br>
                    ${event.location ? `<strong>Location:</strong> ${event.location}` : ''}
                    ${event.duration ? `<br><strong>Duration:</strong> ${event.duration} min` : ''}
                `;
            default:
                return 'No details available';
        }
    }

    return `
        <div class="health-report-container">
            ${createReportTypeHeader('Complete Health Report', 'all-health')}
            <div class="report-summary">
                <h3>Summary Statistics</h3>
                <div class="summary-grid">
                    <div class="summary-item">
                        <span class="label">Total Treatments:</span>
                        <span class="value">${totalTreatments}</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">Total Vaccinations:</span>
                        <span class="value">${totalVaccinations}</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">Total Medications:</span>
                        <span class="value">${totalMedications}</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">Total Records:</span>
                        <span class="value">${totalRecords}</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">Total Activities:</span>
                        <span class="value">${totalActivities}</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">Total Cost:</span>
                        <span class="value">${formatCurrency(totalCost)}</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">Total Events:</span>
                        <span class="value">${totalEvents}</span>
                    </div>
                </div>
            </div>
            <div class="recent-items">
                <h3>All Health Events (${displayedEvents.length} of ${allEvents.length})</h3>
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Animal Category</th>
                            <th>Details</th>
                            <th>Cost</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${displayedEvents.map(event => `
                            <tr>
                                <td>${formatDate(event.date)}</td>
                                <td>${event.eventType}</td>
                                <td>${event.animalCategory || event.category || 'N/A'}</td>
                                <td>${formatEventDetails(event)}</td>
                                <td>${event.cost ? formatCurrency(parseFloat(event.cost)) : 'N/A'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function createHealthTreatmentTable(treatments) {
    // Check for empty data
    if (!treatments || treatments.length === 0) {
        return createStandardReportStructure(
            REPORT_TYPES.HEALTH.TREATMENT,
            'Health Treatment Report',
            '',
            `<div class="empty-state">
                <h3>No Treatment Data Available</h3>
                <p>There are no treatment records in the system for the selected criteria.</p>
                <p>Try adding some treatment records first, or adjust your filters.</p>
            </div>`,
            { message: 'No treatment records found.' },
            false
        );
    }
    
    const totalCost = treatments.reduce((sum, t) => sum + (t.cost || 0), 0);
    const treatmentTypes = new Set(treatments.map(t => t.treatment || t.treatmentType));
    const categoriesCount = new Set(treatments.map(t => t.animalCategory || t.category)).size;

    const tableHTML = `
        ${createReportTypeHeader('Treatment Report', 'health-treatment')}
        <div class="report-summary">
            <h3>Treatment Summary</h3>
            <div class="summary-grid">
                <div class="summary-item">
                    <span class="label">Total Treatments:</span>
                    <span class="value">${treatments.length}</span>
                </div>
                <div class="summary-item">
                    <span class="label">Total Cost:</span>
                    <span class="value">${formatCurrency(totalCost)}</span>
                </div>
                <div class="summary-item">
                    <span class="label">Treatment Types:</span>
                    <span class="value">${treatmentTypes.size}</span>
                </div>
                <div class="summary-item">
                    <span class="label">Animal Categories:</span>
                    <span class="value">${categoriesCount}</span>
                </div>
            </div>
        </div>
        <div class="treatments-table">
            <table class="report-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Animal Category</th>
                        <th>Condition</th>
                        <th>Treatment</th>
                        <th>Number of Animals</th>
                        <th>Duration (days)</th>
                        <th>Notes</th>
                        <th>Cost</th>
                    </tr>
                </thead>
                <tbody>
                    ${treatments.map(treatment => `
                        <tr>
                            <td>${formatDate(treatment.date)}</td>
                            <td>${treatment.animalCategory || treatment.category || 'N/A'}</td>
                            <td>${treatment.condition || 'N/A'}</td>
                            <td>${treatment.treatment || treatment.treatmentType || 'N/A'}</td>
                            <td>${treatment.quantity || 'N/A'}</td>
                            <td>${treatment.duration || 'N/A'}</td>
                            <td>${treatment.notes || 'N/A'}</td>
                            <td>${treatment.cost ? formatCurrency(treatment.cost) : 'N/A'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    return createStandardReportStructure(
        REPORT_TYPES.HEALTH.TREATMENT,
        'Health Treatment Report',
        '',
        tableHTML,
        null,
        false
    );
}

function createHealthVaccinationTable(vaccinations) {
    // Check for empty data
    if (!vaccinations || vaccinations.length === 0) {
        return createStandardReportStructure(
            REPORT_TYPES.HEALTH.VACCINATION,
            'Vaccination Report',
            '',
            `<div class="empty-state">
                <h3>No Vaccination Data Available</h3>
                <p>There are no vaccination records in the system for the selected criteria.</p>
                <p>Try adding some vaccination records first, or adjust your filters.</p>
            </div>`,
            { message: 'No vaccination records found.' },
            false
        );
    }
    
    const totalCost = vaccinations.reduce((sum, v) => sum + (v.cost || 0), 0);
    const vaccineTypes = new Set(vaccinations.map(v => v.vaccine || v.vaccineName));
    const categoriesCount = new Set(vaccinations.map(v => v.animalCategory || v.category)).size;
    const upcomingDue = vaccinations.filter(v => (v.nextDate || v.nextDueDate) && new Date(v.nextDate || v.nextDueDate) > new Date()).length;

    const tableHTML = `
        ${createReportTypeHeader('Vaccination Report', 'health-vaccination')}
        <div class="report-summary">
            <h3>Vaccination Summary</h3>
            <div class="summary-grid">
                <div class="summary-item">
                    <span class="label">Total Vaccinations:</span>
                    <span class="value">${vaccinations.length}</span>
                </div>
                <div class="summary-item">
                    <span class="label">Total Cost:</span>
                    <span class="value">${formatCurrency(totalCost)}</span>
                </div>
                <div class="summary-item">
                    <span class="label">Vaccine Types:</span>
                    <span class="value">${vaccineTypes.size}</span>
                </div>
                <div class="summary-item">
                    <span class="label">Animal Categories:</span>
                    <span class="value">${categoriesCount}</span>
                </div>
                <div class="summary-item">
                    <span class="label">Upcoming Due:</span>
                    <span class="value">${upcomingDue}</span>
                </div>
            </div>
        </div>
        <div class="vaccinations-table">
            <table class="report-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Animal Category</th>
                        <th>Vaccine</th>
                        <th>Number of Animals</th>
                        <th>Next Vaccination Date</th>
                        <th>Notes</th>
                        <th>Cost</th>
                    </tr>
                </thead>
                <tbody>
                    ${vaccinations.map(vaccination => `
                        <tr>
                            <td>${formatDate(vaccination.date)}</td>
                            <td>${vaccination.animalCategory || vaccination.category || 'N/A'}</td>
                            <td>${vaccination.vaccine || vaccination.vaccineName || 'N/A'}</td>
                            <td>${vaccination.quantity || 'N/A'}</td>
                            <td>${vaccination.nextDate || vaccination.nextDueDate ? formatDate(vaccination.nextDate || vaccination.nextDueDate) : 'N/A'}</td>
                            <td>${vaccination.notes || 'N/A'}</td>
                            <td>${vaccination.cost ? formatCurrency(vaccination.cost) : 'N/A'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    return createStandardReportStructure(
        REPORT_TYPES.HEALTH.VACCINATION,
        'Vaccination Report',
        '',
        tableHTML,
        null,
        false
    );
}

// Helper function for event details
function getEventDetails(event) {
    switch (event.eventType) {
        case 'Treatment':
            return `${event.treatmentType} - ${event.notes || 'No notes'}`;
        case 'Vaccination':
            return `${event.vaccineName} (Batch: ${event.batchNumber})`;
        case 'Medication':
            return `${event.medicationName} - ${event.dosage} ${event.route}`;
        case 'Health Record':
            return event.diagnosis || 'Regular checkup';
        case 'Activity':
            return `${event.activityType} - ${event.status}`;
        default:
            return 'No details available';
    }
}

function createHealthMedicationTable(medications) {
    // Check for empty data
    if (!medications || medications.length === 0) {
        return createStandardReportStructure(
            REPORT_TYPES.HEALTH.MEDICATION,
            'Medication Report',
            '',
            `<div class="empty-state">
                <h3>No Medication Data Available</h3>
                <p>There are no medication records in the system for the selected criteria.</p>
                <p>Try adding some medication records first, or adjust your filters.</p>
            </div>`,
            { message: 'No medication records found.' },
            false
        );
    }
    
    const totalCost = medications.reduce((sum, m) => sum + (m.cost || 0), 0);
    const medicationTypes = new Set(medications.map(m => m.medication || m.medicationName));
    const categoriesCount = new Set(medications.map(m => m.animalCategory || m.category)).size;

    const tableHTML = `
        ${createReportTypeHeader('Medication Report', 'health-medication')}
        <div class="report-summary">
            <h3>Medication Summary</h3>
            <div class="summary-grid">
                <div class="summary-item">
                    <span class="label">Total Medications:</span>
                    <span class="value">${medications.length}</span>
                </div>
                <div class="summary-item">
                    <span class="label">Total Cost:</span>
                    <span class="value">${formatCurrency(totalCost)}</span>
                </div>
                <div class="summary-item">
                    <span class="label">Medication Types:</span>
                    <span class="value">${medicationTypes.size}</span>
                </div>
                <div class="summary-item">
                    <span class="label">Animal Categories:</span>
                    <span class="value">${categoriesCount}</span>
                </div>
            </div>
        </div>
        <div class="medications-table">
            <table class="report-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Animal Category</th>
                        <th>Medication</th>
                        <th>Dosage</th>
                        <th>Number of Animals</th>
                        <th>Withdrawal Period (days)</th>
                        <th>Notes</th>
                        <th>Cost</th>
                    </tr>
                </thead>
                <tbody>
                    ${medications.map(medication => `
                        <tr>
                            <td>${formatDate(medication.date || medication.dateAdded)}</td>
                            <td>${medication.animalCategory || medication.category || 'N/A'}</td>
                            <td>${medication.medication || medication.medicationName || 'N/A'}</td>
                            <td>${medication.dosage || 'N/A'}</td>
                            <td>${medication.quantity || 'N/A'}</td>
                            <td>${medication.withdrawalPeriod || 'N/A'}</td>
                            <td>${medication.notes || 'N/A'}</td>
                            <td>${medication.cost ? formatCurrency(medication.cost) : 'N/A'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    return createStandardReportStructure(
        REPORT_TYPES.HEALTH.MEDICATION,
        'Medication Report',
        '',
        tableHTML,
        null,
        false
    );
}

function createHealthRecordsTable(records) {
    // Check for empty data
    if (!records || records.length === 0) {
        return createStandardReportStructure(
            REPORT_TYPES.HEALTH.RECORDS,
            'Health Records Report',
            '',
            `<div class="empty-state">
                <h3>No Health Records Available</h3>
                <p>There are no health records in the system for the selected criteria.</p>
                <p>Try adding some health records first, or adjust your filters.</p>
            </div>`,
            { message: 'No health records found.' },
            false
        );
    }
    
    const structure = createStandardReportStructure('Health Records');
    
    // Add report type header
    structure.appendChild(createReportTypeHeader('Health Records Report', 'health-records'));
    
    // Add summary section
    const summarySection = document.createElement('div');
    summarySection.className = 'report-summary';
    
    const categoriesCount = new Set(records.map(r => r.animalCategory)).size;
    const withDiagnosis = records.filter(r => r.diagnosis).length;
    const withRecommendations = records.filter(r => r.recommendations.length > 0).length;
    
    // Calculate average metrics
    const avgMetrics = records.reduce((acc, record) => {
        acc.weight += record.metrics.weight || 0;
        acc.temperature += record.metrics.temperature || 0;
        acc.heartRate += record.metrics.heartRate || 0;
        acc.respiratoryRate += record.metrics.respiratoryRate || 0;
        return acc;
    }, { weight: 0, temperature: 0, heartRate: 0, respiratoryRate: 0 });
    
    const recordCount = records.length || 1;
    Object.keys(avgMetrics).forEach(key => avgMetrics[key] /= recordCount);

    summarySection.innerHTML = `
        <h3>Health Records Summary</h3>
        <div class="summary-grid">
            <div class="summary-item">
                <span class="label">Total Records:</span>
                <span class="value">${records.length}</span>
            </div>
            <div class="summary-item">
                <span class="label">Animal Categories:</span>
                <span class="value">${categoriesCount}</span>
            </div>
            <div class="summary-item">
                <span class="label">With Diagnosis:</span>
                <span class="value">${withDiagnosis}</span>
            </div>
            <div class="summary-item">
                <span class="label">With Recommendations:</span>
                <span class="value">${withRecommendations}</span>
            </div>
        </div>
        <div class="metrics-summary">
            <h4>Average Metrics</h4>
            <div class="metrics-grid">
                <div class="metric-item">
                    <span class="label">Weight:</span>
                    <span class="value">${avgMetrics.weight.toFixed(1)} kg</span>
                </div>
                <div class="metric-item">
                    <span class="label">Temperature:</span>
                    <span class="value">${avgMetrics.temperature.toFixed(1)}°C</span>
                </div>
                <div class="metric-item">
                    <span class="label">Heart Rate:</span>
                    <span class="value">${avgMetrics.heartRate.toFixed(0)} bpm</span>
                </div>
                <div class="metric-item">
                    <span class="label">Respiratory Rate:</span>
                    <span class="value">${avgMetrics.respiratoryRate.toFixed(0)} /min</span>
                </div>
            </div>
        </div>
    `;
    
    structure.appendChild(summarySection);

    // Add records table
    const tableSection = document.createElement('div');
    tableSection.className = 'health-records-table';
    
    const table = document.createElement('table');
    table.innerHTML = `
        <thead>
            <tr>
                <th>Date</th>
                <th>Animal Category</th>
                <th>Animal ID</th>
                <th>Vital Signs</th>
                <th>Condition</th>
                <th>Diagnosis</th>
                <th>Prognosis</th>
                <th>Recommendations</th>
                <th>Recorded By</th>
            </tr>
        </thead>
        <tbody>
            ${records.map(record => `
                <tr>
                    <td>${formatDate(record.date)}</td>
                    <td>${record.animalCategory}</td>
                    <td>${record.animalId || 'N/A'}</td>
                    <td>
                        Weight: ${record.metrics.weight}kg<br>
                        Temp: ${record.metrics.temperature}°C<br>
                        HR: ${record.metrics.heartRate} bpm<br>
                        RR: ${record.metrics.respiratoryRate} /min
                    </td>
                    <td>
                        Body: ${record.metrics.bodyCondition}<br>
                        Hydration: ${record.metrics.hydration}<br>
                        Appetite: ${record.metrics.appetite}
                    </td>
                    <td>${record.diagnosis || 'N/A'}</td>
                    <td>${record.prognosis || 'N/A'}</td>
                    <td>${record.recommendations.length ? record.recommendations.join('<br>') : 'N/A'}</td>
                    <td>${record.recordedBy}</td>
                </tr>
            `).join('')}
        </tbody>
    `;
    
    tableSection.appendChild(table);
    structure.appendChild(tableSection);

    return structure;
}

function createHealthActivitiesTable(activities) {
    // Check for empty data
    if (!activities || activities.length === 0) {
        return createStandardReportStructure(
            REPORT_TYPES.HEALTH.ACTIVITIES,
            'Health Activities Report',
            '',
            `<div class="empty-state">
                <h3>No Health Activities Available</h3>
                <p>There are no health activities in the system for the selected criteria.</p>
                <p>Try adding some health activities first, or adjust your filters.</p>
            </div>`,
            { message: 'No health activities found.' },
            false
        );
    }
    
    const structure = createStandardReportStructure('Health Activities');
    
    // Add report type header
    structure.appendChild(createReportTypeHeader('Health Activities Report', 'health-activities'));
    
    // Add summary section
    const summarySection = document.createElement('div');
    summarySection.className = 'report-summary';
    
    const totalCost = activities.reduce((sum, a) => sum + (a.cost || 0), 0);
    const activityTypes = new Set(activities.map(a => a.activityType));
    const categoriesCount = new Set(activities.map(a => a.animalCategory)).size;
    const totalDuration = activities.reduce((sum, a) => sum + (a.duration || 0), 0);
    const completedActivities = activities.filter(a => a.status === 'completed').length;
    const pendingActivities = activities.filter(a => a.status === 'pending').length;

    summarySection.innerHTML = `
        <h3>Activities Summary</h3>
        <div class="summary-grid">
            <div class="summary-item">
                <span class="label">Total Activities:</span>
                <span class="value">${activities.length}</span>
            </div>
            <div class="summary-item">
                <span class="label">Total Cost:</span>
                <span class="value">${formatCurrency(totalCost)}</span>
            </div>
            <div class="summary-item">
                <span class="label">Activity Types:</span>
                <span class="value">${activityTypes.size}</span>
            </div>
            <div class="summary-item">
                <span class="label">Animal Categories:</span>
                <span class="value">${categoriesCount}</span>
            </div>
            <div class="summary-item">
                <span class="label">Total Duration:</span>
                <span class="value">${totalDuration} mins</span>
            </div>
            <div class="summary-item">
                <span class="label">Completion Rate:</span>
                <span class="value">${((completedActivities / activities.length) * 100).toFixed(1)}%</span>
            </div>
        </div>
    `;
    
    structure.appendChild(summarySection);

    // Add activities table
    const tableSection = document.createElement('div');
    tableSection.className = 'health-activities-table';
    
    const table = document.createElement('table');
    table.innerHTML = `
        <thead>
            <tr>
                <th>Date</th>
                <th>Animal Category</th>
                <th>Activity Type</th>
                <th>Duration</th>
                <th>Location</th>
                <th>Status</th>
                <th>Participants</th>
                <th>Outcomes</th>
                <th>Conducted By</th>
                <th>Cost</th>
            </tr>
        </thead>
        <tbody>
            ${activities.map(activity => `
                <tr>
                    <td>${formatDate(activity.date)}</td>
                    <td>${activity.animalCategory}</td>
                    <td>${activity.activityType}</td>
                    <td>${activity.duration} mins</td>
                    <td>${activity.location}</td>
                    <td>${activity.status}</td>
                    <td>${activity.participants.join(', ') || 'N/A'}</td>
                    <td>${activity.outcomes.join(', ') || 'N/A'}</td>
                    <td>${activity.conductedBy}</td>
                    <td>${activity.cost ? formatCurrency(activity.cost) : 'N/A'}</td>
                </tr>
            `).join('')}
        </tbody>
    `;
    
    tableSection.appendChild(table);
    structure.appendChild(tableSection);

    return structure;
}

/**
 * Creates a health report table based on the type of health data
 * @param {Object} data - Health data object containing treatments, vaccinations, medications etc.
 * @param {string} reportType - Type of health report to generate
 * @returns {HTMLElement} The report table element
 */
function createHealthReportTable(data, reportType = REPORT_TYPES.HEALTH.ALL) {
    console.log('Creating health report table:', { data, reportType });

    switch (reportType) {
        case REPORT_TYPES.HEALTH.ALL:
            return createAllHealthReportTable(data);
        case REPORT_TYPES.HEALTH.TREATMENT:
            return createHealthTreatmentTable(data.treatments || data);
        case REPORT_TYPES.HEALTH.VACCINATION:
            return createHealthVaccinationTable(data.vaccinations || data);
        case REPORT_TYPES.HEALTH.MEDICATION:
            return createHealthMedicationTable(data.medications || data);
        case REPORT_TYPES.HEALTH.RECORDS:
            return createHealthRecordsTable(data.records || data);
        case REPORT_TYPES.HEALTH.ACTIVITIES:
            return createHealthActivitiesTable(data.activities || data);
        default:
            console.warn(`Unknown health report type: ${reportType}, defaulting to all health report`);
            return createAllHealthReportTable(data);
    }
}

// Export all functions and constants in a single export statement at the end
export {
    REPORT_TYPES,
    loadHealthData,
    loadAllHealthData,
    loadHealthTreatmentData,
    loadHealthVaccinationData,
    loadHealthMedicationData,
    loadHealthRecords,
    loadHealthActivities,
    generateHealthReport,
    createHealthReportTable,
    createHealthTreatmentTable,
    createHealthVaccinationTable,
    createHealthMedicationTable,
    createAllHealthReportTable,
    isHealthReportEmpty,
    handleHealthTypeChange,
    handleHealthCategoryChange,
    // Aliases for backward compatibility
    loadHealthTreatmentData as loadTreatmentData,
    loadHealthVaccinationData as loadVaccinationData,
    loadHealthMedicationData as loadMedicationData,
    createHealthTreatmentTable as createTreatmentTable,
    createHealthVaccinationTable as createVaccinationTable,
    createHealthMedicationTable as createMedicationTable
};