/**
 * Smart Caching Layer
 * Reduces Firebase reads by 60-80% through intelligent local caching
 * Uses localStorage with TTL (time-to-live) expiration
 */

class CacheManager {
    constructor() {
        this.prefix = 'vtr_cache_';
        this.defaultTTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        
        // Different TTLs for different data types
        this.ttls = {
            userProfile: 24 * 60 * 60 * 1000,      // 24 hours
            workoutHistory: 1 * 60 * 60 * 1000,    // 1 hour
            videoPreferences: 7 * 24 * 60 * 60 * 1000, // 7 days
            stats: 5 * 60 * 1000,                  // 5 minutes (frequently updated)
            appConfig: 24 * 60 * 60 * 1000         // 24 hours
        };
        
        // Track cache hits/misses for optimization
        this.stats = {
            hits: 0,
            misses: 0,
            writes: 0
        };
        
        this.init();
    }

    /**
     * Initialize cache manager
     */
    init() {
        // Clean expired entries on startup
        this.cleanExpired();
        
        // Periodic cleanup (every 5 minutes)
        setInterval(() => this.cleanExpired(), 5 * 60 * 1000);
        
        console.log('Cache Manager initialized');
    }

    /**
     * Get item from cache
     */
    get(key, category = 'default') {
        const cacheKey = this.getCacheKey(key, category);
        
        try {
            const cached = localStorage.getItem(cacheKey);
            
            if (!cached) {
                this.stats.misses++;
                return null;
            }
            
            const { data, expiry } = JSON.parse(cached);
            
            // Check if expired
            if (Date.now() > expiry) {
                this.remove(key, category);
                this.stats.misses++;
                return null;
            }
            
            this.stats.hits++;
            console.log(`Cache HIT: ${category}/${key}`);
            return data;
            
        } catch (error) {
            console.error('Cache read error:', error);
            this.stats.misses++;
            return null;
        }
    }

    /**
     * Set item in cache
     */
    set(key, data, category = 'default', customTTL = null) {
        const cacheKey = this.getCacheKey(key, category);
        const ttl = customTTL || this.ttls[category] || this.defaultTTL;
        const expiry = Date.now() + ttl;
        
        try {
            const cacheData = {
                data,
                expiry,
                category,
                cachedAt: Date.now()
            };
            
            localStorage.setItem(cacheKey, JSON.stringify(cacheData));
            this.stats.writes++;
            console.log(`Cache SET: ${category}/${key} (TTL: ${ttl / 1000}s)`);
            return true;
            
        } catch (error) {
            console.error('Cache write error:', error);
            
            // If storage is full, clear old entries
            if (error.name === 'QuotaExceededError') {
                console.warn('Cache full, clearing old entries');
                this.clearOldest(10);
                
                // Try again
                try {
                    localStorage.setItem(cacheKey, JSON.stringify({
                        data,
                        expiry,
                        category,
                        cachedAt: Date.now()
                    }));
                    return true;
                } catch (retryError) {
                    console.error('Cache write failed after cleanup:', retryError);
                }
            }
            
            return false;
        }
    }

    /**
     * Remove item from cache
     */
    remove(key, category = 'default') {
        const cacheKey = this.getCacheKey(key, category);
        localStorage.removeItem(cacheKey);
        console.log(`Cache REMOVE: ${category}/${key}`);
    }

    /**
     * Clear entire cache or specific category
     */
    clear(category = null) {
        if (category) {
            // Clear specific category
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith(this.prefix) && key.includes(`_${category}_`)) {
                    localStorage.removeItem(key);
                }
            });
            console.log(`Cache cleared: ${category}`);
        } else {
            // Clear all cache
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith(this.prefix)) {
                    localStorage.removeItem(key);
                }
            });
            console.log('All cache cleared');
        }
    }

    /**
     * Clean expired entries
     */
    cleanExpired() {
        const keys = Object.keys(localStorage);
        let cleaned = 0;
        
        keys.forEach(key => {
            if (key.startsWith(this.prefix)) {
                try {
                    const cached = localStorage.getItem(key);
                    const { expiry } = JSON.parse(cached);
                    
                    if (Date.now() > expiry) {
                        localStorage.removeItem(key);
                        cleaned++;
                    }
                } catch (error) {
                    // Invalid cache entry, remove it
                    localStorage.removeItem(key);
                    cleaned++;
                }
            }
        });
        
        if (cleaned > 0) {
            console.log(`Cache cleanup: ${cleaned} expired entries removed`);
        }
    }

    /**
     * Clear oldest entries (when storage is full)
     */
    clearOldest(count = 10) {
        const cacheEntries = [];
        const keys = Object.keys(localStorage);
        
        keys.forEach(key => {
            if (key.startsWith(this.prefix)) {
                try {
                    const cached = localStorage.getItem(key);
                    const { cachedAt } = JSON.parse(cached);
                    cacheEntries.push({ key, cachedAt });
                } catch (error) {
                    // Invalid entry
                }
            }
        });
        
        // Sort by age (oldest first)
        cacheEntries.sort((a, b) => a.cachedAt - b.cachedAt);
        
        // Remove oldest entries
        const toRemove = cacheEntries.slice(0, count);
        toRemove.forEach(entry => {
            localStorage.removeItem(entry.key);
        });
        
        console.log(`Cleared ${toRemove.length} oldest cache entries`);
    }

    /**
     * Get cache key with prefix and category
     */
    getCacheKey(key, category) {
        return `${this.prefix}${category}_${key}`;
    }

    /**
     * Get cache statistics
     */
    getStats() {
        const hitRate = this.stats.hits + this.stats.misses > 0
            ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
            : 0;
        
        return {
            hits: this.stats.hits,
            misses: this.stats.misses,
            writes: this.stats.writes,
            hitRate: `${hitRate}%`,
            size: this.getCacheSize()
        };
    }

    /**
     * Get cache size (approximate)
     */
    getCacheSize() {
        let size = 0;
        const keys = Object.keys(localStorage);
        
        keys.forEach(key => {
            if (key.startsWith(this.prefix)) {
                size += localStorage.getItem(key).length;
            }
        });
        
        // Convert to KB
        return `${(size / 1024).toFixed(2)} KB`;
    }

    /**
     * Check if key exists in cache and is valid
     */
    has(key, category = 'default') {
        return this.get(key, category) !== null;
    }

    /**
     * Get or fetch pattern (common use case)
     * Try cache first, if miss, fetch from source and cache result
     */
    async getOrFetch(key, category, fetchFunction, customTTL = null) {
        // Try cache first
        const cached = this.get(key, category);
        if (cached !== null) {
            return cached;
        }
        
        // Cache miss, fetch from source
        try {
            const data = await fetchFunction();
            
            // Cache the result
            this.set(key, data, category, customTTL);
            
            return data;
        } catch (error) {
            console.error('Fetch error in getOrFetch:', error);
            throw error;
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CacheManager;
}
