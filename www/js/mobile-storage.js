/**
 * Mobile Storage API
 * 
 * This is an adapter for the capacitor-storage.js implementation that provides
 * synchronous versions of the storage methods for backward compatibility with code
 * that expects localStorage-like behavior.
 */

// Cache for synchronous operations
const syncCache = {};

// Synchronous version of the mobile storage API
const mobileStorage = {
    /**
     * Get an item synchronously
     * @param {string} key - Storage key
     * @returns {string} - The stored value or null
     */
    getItemSync(key) {
        if (syncCache[key] !== undefined) {
            return syncCache[key];
        }
        
        try {
            const value = localStorage.getItem(key);
            syncCache[key] = value;
            return value;
        } catch (e) {
            console.error('Error getting item from storage:', e);
            return null;
        }
    },
    
    /**
     * Set an item synchronously
     * @param {string} key - Storage key
     * @param {string} value - Value to store
     */
    setItemSync(key, value) {
        try {
            syncCache[key] = value;
            localStorage.setItem(key, value);
        } catch (e) {
            console.error('Error setting item in storage:', e);
        }
    },
    
    /**
     * Remove an item synchronously
     * @param {string} key - Storage key to remove
     */
    removeItemSync(key) {
        try {
            delete syncCache[key];
            localStorage.removeItem(key);
        } catch (e) {
            console.error('Error removing item from storage:', e);
        }
    },
    
    /**
     * Clear all storage synchronously
     */
    clearSync() {
        try {
            Object.keys(syncCache).forEach(key => delete syncCache[key]);
            localStorage.clear();
        } catch (e) {
            console.error('Error clearing storage:', e);
        }
    }
};

// Add asynchronous API methods that wrap capacitor-storage.js if available
if (typeof window.storageApi !== 'undefined') {
    mobileStorage.getItem = window.storageApi.getItem;
    mobileStorage.setItem = window.storageApi.setItem;
    mobileStorage.removeItem = window.storageApi.removeItem;
    mobileStorage.clear = window.storageApi.clear;
} else {
    // Fallback to localStorage-based async methods
    mobileStorage.getItem = async (key) => mobileStorage.getItemSync(key);
    mobileStorage.setItem = async (key, value) => mobileStorage.setItemSync(key, value);
    mobileStorage.removeItem = async (key) => mobileStorage.removeItemSync(key);
    mobileStorage.clear = async () => mobileStorage.clearSync();
}

// Make it globally accessible
window.mobileStorage = mobileStorage; 