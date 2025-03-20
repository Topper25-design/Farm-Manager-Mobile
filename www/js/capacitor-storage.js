/**
 * Capacitor Storage Adapter
 * 
 * This utility provides localStorage-compatible methods that use Capacitor Storage under the hood
 * making it easier to port existing web apps to Capacitor.
 */

// Global storage cache to minimize API calls
const storageCache = {};

// Initialize by attempting to load capacitor
let capacitorAvailable = false;
let Storage = null;

// Check if we're running in a Capacitor environment
document.addEventListener('deviceready', function() {
    try {
        capacitorAvailable = typeof Capacitor !== 'undefined';
        if (capacitorAvailable) {
            Storage = Capacitor.Plugins.Storage;
            console.log('Capacitor Storage initialized');
        }
    } catch (e) {
        console.warn('Capacitor not available, falling back to localStorage');
    }
}, false);

// Storage API that works with both localStorage and Capacitor Storage
const storageApi = {
    /**
     * Get an item from storage
     * @param {string} key - Storage key
     * @returns {Promise<string>} - Resolves to the value or null
     */
    async getItem(key) {
        // Check cache first
        if (storageCache[key] !== undefined) {
            return storageCache[key];
        }
        
        try {
            if (capacitorAvailable && Storage) {
                const { value } = await Storage.get({ key });
                storageCache[key] = value;
                return value;
            } else {
                const value = localStorage.getItem(key);
                storageCache[key] = value;
                return value;
            }
        } catch (e) {
            console.error('Error getting item from storage:', e);
            return null;
        }
    },
    
    /**
     * Set an item in storage
     * @param {string} key - Storage key
     * @param {string} value - Value to store
     * @returns {Promise<void>}
     */
    async setItem(key, value) {
        try {
            // Update cache
            storageCache[key] = value;
            
            if (capacitorAvailable && Storage) {
                await Storage.set({ key, value });
            } else {
                localStorage.setItem(key, value);
            }
        } catch (e) {
            console.error('Error setting item in storage:', e);
        }
    },
    
    /**
     * Remove an item from storage
     * @param {string} key - Storage key to remove
     * @returns {Promise<void>}
     */
    async removeItem(key) {
        try {
            // Update cache
            delete storageCache[key];
            
            if (capacitorAvailable && Storage) {
                await Storage.remove({ key });
            } else {
                localStorage.removeItem(key);
            }
        } catch (e) {
            console.error('Error removing item from storage:', e);
        }
    },
    
    /**
     * Clear all storage
     * @returns {Promise<void>}
     */
    async clear() {
        try {
            // Clear cache
            Object.keys(storageCache).forEach(key => delete storageCache[key]);
            
            if (capacitorAvailable && Storage) {
                await Storage.clear();
            } else {
                localStorage.clear();
            }
        } catch (e) {
            console.error('Error clearing storage:', e);
        }
    }
};

// For backward compatibility with localStorage usage patterns
window.mobileStorage = storageApi; 