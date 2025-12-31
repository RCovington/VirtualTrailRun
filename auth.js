/**
 * Authentication Module
 * Handles user login, signup, guest mode, and session management
 */

class AuthManager {
    constructor(cacheManager, analyticsTracker) {
        this.cache = cacheManager;
        this.analytics = analyticsTracker;
        this.currentUser = null;
        this.isGuest = true;
        
        this.init();
    }

    /**
     * Initialize authentication
     */
    init() {
        // Listen for auth state changes
        if (window.firebaseApp?.auth) {
            firebase.auth().onAuthStateChanged((user) => {
                this.handleAuthStateChange(user);
            });
        }
        
        // Check for guest session
        const guestSession = this.cache.get('guest_session', 'userProfile');
        if (guestSession) {
            this.currentUser = guestSession;
            this.isGuest = true;
            console.log('Guest session restored');
        }
    }

    /**
     * Handle authentication state changes
     */
    handleAuthStateChange(user) {
        if (user) {
            // User logged in
            this.currentUser = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                isAnonymous: user.isAnonymous
            };
            this.isGuest = user.isAnonymous;
            
            // Cache user profile
            this.cache.set(user.uid, this.currentUser, 'userProfile');
            
            // Update analytics
            this.analytics.setUserId(user.uid, this.isGuest);
            
            console.log('User authenticated:', user.email || 'Anonymous');
            
            // Trigger custom event
            window.dispatchEvent(new CustomEvent('userLoggedIn', { detail: this.currentUser }));
        } else {
            // User logged out
            this.currentUser = null;
            this.isGuest = true;
            
            console.log('User logged out');
            
            // Trigger custom event
            window.dispatchEvent(new CustomEvent('userLoggedOut'));
        }
    }

    /**
     * Sign up with email and password
     */
    async signUp(email, password, displayName = null) {
        if (!window.firebaseApp?.auth) {
            throw new Error('Firebase not initialized');
        }
        
        try {
            const result = await firebase.auth().createUserWithEmailAndPassword(email, password);
            
            // Update profile with display name if provided
            if (displayName) {
                await result.user.updateProfile({ displayName });
            }
            
            // Create user document in Firestore
            await this.createUserDocument(result.user.uid, {
                email,
                displayName,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                workoutCount: 0,
                totalDistance: 0,
                totalBobs: 0
            });
            
            this.analytics.trackEvent('user_signed_up', { method: 'email' });
            
            return result.user;
        } catch (error) {
            console.error('Sign up error:', error);
            throw this.handleAuthError(error);
        }
    }

    /**
     * Log in with email and password
     */
    async login(email, password) {
        if (!window.firebaseApp?.auth) {
            throw new Error('Firebase not initialized');
        }
        
        try {
            const result = await firebase.auth().signInWithEmailAndPassword(email, password);
            
            this.analytics.trackEvent('user_logged_in', { method: 'email' });
            
            return result.user;
        } catch (error) {
            console.error('Login error:', error);
            throw this.handleAuthError(error);
        }
    }

    /**
     * Continue as guest (anonymous auth)
     */
    async continueAsGuest() {
        // Create temporary guest session locally (no Firebase call)
        const guestUser = {
            uid: `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            displayName: 'Guest',
            isGuest: true,
            createdAt: Date.now()
        };
        
        this.currentUser = guestUser;
        this.isGuest = true;
        
        // Cache guest session
        this.cache.set('guest_session', guestUser, 'userProfile', 7 * 24 * 60 * 60 * 1000); // 7 days
        
        this.analytics.setUserId(guestUser.uid, true);
        this.analytics.trackEvent('guest_session_created');
        
        console.log('Guest session created:', guestUser.uid);
        
        // Trigger custom event
        window.dispatchEvent(new CustomEvent('userLoggedIn', { detail: this.currentUser }));
        
        return guestUser;
    }

    /**
     * Log out current user
     */
    async logout() {
        if (window.firebaseApp?.auth) {
            await firebase.auth().signOut();
        }
        
        // Clear guest session
        this.cache.remove('guest_session', 'userProfile');
        
        this.analytics.trackEvent('user_logged_out');
    }

    /**
     * Create user document in Firestore
     */
    async createUserDocument(uid, userData) {
        if (!window.firebaseApp?.db) return;
        
        try {
            await window.firebaseApp.db.collection('users').doc(uid).set(userData);
            console.log('User document created');
        } catch (error) {
            console.error('Error creating user document:', error);
        }
    }

    /**
     * Get current user
     */
    getCurrentUser() {
        return this.currentUser;
    }

    /**
     * Check if user is logged in
     */
    isLoggedIn() {
        return this.currentUser !== null;
    }

    /**
     * Check if user is guest
     */
    isGuestUser() {
        return this.isGuest;
    }

    /**
     * Handle authentication errors
     */
    handleAuthError(error) {
        const errorMessages = {
            'auth/email-already-in-use': 'This email is already registered. Please log in instead.',
            'auth/invalid-email': 'Invalid email address.',
            'auth/user-not-found': 'No account found with this email.',
            'auth/wrong-password': 'Incorrect password.',
            'auth/weak-password': 'Password should be at least 6 characters.',
            'auth/too-many-requests': 'Too many failed attempts. Please try again later.'
        };
        
        return new Error(errorMessages[error.code] || 'Authentication failed. Please try again.');
    }

    /**
     * Send password reset email
     */
    async sendPasswordReset(email) {
        if (!window.firebaseApp?.auth) {
            throw new Error('Firebase not initialized');
        }
        
        try {
            await firebase.auth().sendPasswordResetEmail(email);
            this.analytics.trackEvent('password_reset_requested');
            return true;
        } catch (error) {
            console.error('Password reset error:', error);
            throw this.handleAuthError(error);
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthManager;
}
