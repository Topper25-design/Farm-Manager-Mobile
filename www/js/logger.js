// Logger functionality for Farm Manager Mobile
export const Logger = {
    // Log levels
    LEVELS: {
        DEBUG: 0,
        INFO: 1,
        WARN: 2,
        ERROR: 3
    },

    // Module identifiers
    MODULES: {
        REPORTS: 'reports',
        ANIMALS: 'animals',
        FEED: 'feed',
        HEALTH: 'health',
        UTILS: 'utils'
    },

    // Current log level
    currentLevel: 1, // Default to INFO

    // Logging functions
    debug: function(module, message, ...args) {
        if (this.currentLevel <= this.LEVELS.DEBUG) {
            console.log(`[DEBUG][${module}] ${message}`, ...args);
        }
    },

    info: function(module, message, ...args) {
        if (this.currentLevel <= this.LEVELS.INFO) {
            console.log(`[INFO][${module}] ${message}`, ...args);
        }
    },

    warn: function(module, message, ...args) {
        if (this.currentLevel <= this.LEVELS.WARN) {
            console.warn(`[WARN][${module}] ${message}`, ...args);
        }
    },

    error: function(module, message, ...args) {
        if (this.currentLevel <= this.LEVELS.ERROR) {
            console.error(`[ERROR][${module}] ${message}`, ...args);
        }
    },

    // Set log level
    setLevel: function(level) {
        this.currentLevel = level;
    }
}; 