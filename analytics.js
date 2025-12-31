/**
 * Analytics & Session Tracking Module
 * Tracks user sessions, duration, repeat visitors, and engagement metrics
 * Cost-optimized: Batches events and uses local storage to minimize writes
 */

class AnalyticsTracker {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.sessionStartTime = Date.now();
        this.lastActivityTime = Date.now();
        this.isNewUser = false;
        this.userId = null;
        this.isGuest = true;
        
        // Batch events to reduce writes
        this.eventQueue = [];
        this.batchInterval = 30000; // Send batched events every 30 seconds
        this.maxBatchSize = 10;
        
        // Local analytics data
        this.sessionData = {
            sessionId: this.sessionId,
            startTime: this.sessionStartTime,
            endTime: null,
            duration: 0,
            workoutsCompleted: 0,
            videosWatched: [],
            bobs: 0,
            distance: 0,
            events: []
        };
        
        this.init();
    }

    /**
     * Initialize analytics tracking
     */
    init() {
        // Check if user has visited before
        this.checkVisitorStatus();
        
        // Track page load
        this.trackPageView();
        
        // Start batch processor
        this.startBatchProcessor();
        
        // Track session end on page unload
        window.addEventListener('beforeunload', () => this.endSession());
        
        // Track activity (update last activity time)
        this.setupActivityTracking();
        
        console.log('Analytics initialized - Session:', this.sessionId);
    }

    /**
     * Generate unique session ID
     */
    generateSessionId() {
        return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Check if user is new or returning
     */
    checkVisitorStatus() {
        const lastVisit = localStorage.getItem('vtr_last_visit');
        const visitorId = localStorage.getItem('vtr_visitor_id');
        const visitCount = parseInt(localStorage.getItem('vtr_visit_count') || '0');
        
        if (!visitorId) {
            // New user
            this.isNewUser = true;
            const newVisitorId = `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            localStorage.setItem('vtr_visitor_id', newVisitorId);
            localStorage.setItem('vtr_visit_count', '1');
            localStorage.setItem('vtr_first_visit', new Date().toISOString());
            
            this.trackEvent('new_user', { visitorId: newVisitorId });
        } else {
            // Returning user
            this.isNewUser = false;
            const newVisitCount = visitCount + 1;
            localStorage.setItem('vtr_visit_count', newVisitCount.toString());
            
            // Calculate days since last visit
            const daysSinceLastVisit = lastVisit 
                ? Math.floor((Date.now() - new Date(lastVisit).getTime()) / (1000 * 60 * 60 * 24))
                : 0;
            
            this.trackEvent('returning_user', { 
                visitorId,
                visitCount: newVisitCount,
                daysSinceLastVisit 
            });
        }
        
        localStorage.setItem('vtr_last_visit', new Date().toISOString());
    }

    /**
     * Track page view
     */
    trackPageView() {
        // Use Firebase Analytics if available
        if (window.firebaseApp?.analytics) {
            firebase.analytics().logEvent('page_view', {
                page_title: document.title,
                page_location: window.location.href
            });
        }
        
        this.trackEvent('page_view', {
            url: window.location.href,
            referrer: document.referrer
        });
    }

    /**
     * Setup activity tracking (detect when user is active)
     */
    setupActivityTracking() {
        const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
        
        events.forEach(event => {
            document.addEventListener(event, () => {
                this.lastActivityTime = Date.now();
            }, { passive: true });
        });
        
        // Check for idle users every minute
        setInterval(() => {
            const idleTime = Date.now() - this.lastActivityTime;
            if (idleTime > 300000) { // 5 minutes idle
                this.trackEvent('user_idle', { idleMinutes: Math.floor(idleTime / 60000) });
            }
        }, 60000);
    }

    /**
     * Track custom event
     */
    trackEvent(eventName, eventData = {}) {
        const event = {
            name: eventName,
            timestamp: Date.now(),
            data: eventData
        };
        
        this.eventQueue.push(event);
        this.sessionData.events.push(event);
        
        // Log to Firebase Analytics if available
        if (window.firebaseApp?.analytics) {
            firebase.analytics().logEvent(eventName, eventData);
        }
        
        // If batch is full, send immediately
        if (this.eventQueue.length >= this.maxBatchSize) {
            this.sendBatchedEvents();
        }
        
        console.log('Event tracked:', eventName, eventData);
    }

    /**
     * Track workout start
     */
    trackWorkoutStart(videoId, videoTitle) {
        this.trackEvent('workout_start', {
            videoId,
            videoTitle,
            sessionId: this.sessionId
        });
    }

    /**
     * Track workout complete
     */
    trackWorkoutComplete(stats) {
        this.sessionData.workoutsCompleted++;
        this.sessionData.bobs += stats.totalBobs;
        this.sessionData.distance += stats.distance;
        
        if (!this.sessionData.videosWatched.includes(stats.videoId)) {
            this.sessionData.videosWatched.push(stats.videoId);
        }
        
        this.trackEvent('workout_complete', {
            videoId: stats.videoId,
            duration: stats.duration,
            totalBobs: stats.totalBobs,
            distance: stats.distance,
            bobsPerMinute: stats.bobsPerMinute
        });
    }

    /**
     * Track video selection
     */
    trackVideoSelection(videoId, videoTitle) {
        this.trackEvent('video_selected', { videoId, videoTitle });
    }

    /**
     * Track camera enable/disable
     */
    trackCameraToggle(enabled) {
        this.trackEvent('camera_toggled', { enabled });
    }

    /**
     * Start batch processor
     */
    startBatchProcessor() {
        this.batchIntervalId = setInterval(() => {
            if (this.eventQueue.length > 0) {
                this.sendBatchedEvents();
            }
        }, this.batchInterval);
    }

    /**
     * Send batched events to Firestore
     */
    async sendBatchedEvents() {
        if (!window.firebaseApp?.db || this.eventQueue.length === 0) {
            return;
        }
        
        const eventsToSend = [...this.eventQueue];
        this.eventQueue = [];
        
        try {
            // Send as single batch document to minimize writes
            await window.firebaseApp.db.collection('analytics_events').add({
                sessionId: this.sessionId,
                userId: this.userId,
                isGuest: this.isGuest,
                events: eventsToSend,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            console.log(`Sent ${eventsToSend.length} batched events`);
        } catch (error) {
            console.error('Error sending analytics:', error);
            // Put events back in queue if failed
            this.eventQueue = [...eventsToSend, ...this.eventQueue];
        }
    }

    /**
     * End session and save summary
     */
    async endSession() {
        clearInterval(this.batchIntervalId);
        
        this.sessionData.endTime = Date.now();
        this.sessionData.duration = Math.floor((this.sessionData.endTime - this.sessionData.startTime) / 1000);
        
        // Send any remaining batched events
        await this.sendBatchedEvents();
        
        // Save session summary (only 1 write per session)
        if (window.firebaseApp?.db) {
            try {
                await window.firebaseApp.db.collection('sessions').add({
                    sessionId: this.sessionId,
                    userId: this.userId,
                    isGuest: this.isGuest,
                    isNewUser: this.isNewUser,
                    startTime: new Date(this.sessionData.startTime),
                    endTime: new Date(this.sessionData.endTime),
                    duration: this.sessionData.duration,
                    workoutsCompleted: this.sessionData.workoutsCompleted,
                    videosWatched: this.sessionData.videosWatched,
                    totalBobs: this.sessionData.bobs,
                    totalDistance: this.sessionData.distance,
                    eventCount: this.sessionData.events.length,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                console.log('Session summary saved');
            } catch (error) {
                console.error('Error saving session:', error);
            }
        }
    }

    /**
     * Set user ID when user logs in
     */
    setUserId(userId, isGuest = false) {
        this.userId = userId;
        this.isGuest = isGuest;
        
        this.trackEvent('user_identified', { 
            userId, 
            isGuest,
            sessionId: this.sessionId 
        });
    }

    /**
     * Get session statistics
     */
    getSessionStats() {
        return {
            sessionId: this.sessionId,
            duration: Math.floor((Date.now() - this.sessionStartTime) / 1000),
            workoutsCompleted: this.sessionData.workoutsCompleted,
            videosWatched: this.sessionData.videosWatched.length,
            totalBobs: this.sessionData.bobs,
            totalDistance: this.sessionData.distance,
            isNewUser: this.isNewUser
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AnalyticsTracker;
}
