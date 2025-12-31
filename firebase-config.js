/**
 * Firebase Configuration and Initialization
 * Cost-optimized setup with smart caching and analytics
 */

// Firebase configuration - YOU NEED TO REPLACE THESE WITH YOUR VALUES
// Get these from Firebase Console > Project Settings > General
const firebaseConfig = {
    apiKey: "YOUR_API_KEY_HERE",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID",
    measurementId: "YOUR_MEASUREMENT_ID" // Optional for Analytics
};

// Initialize Firebase (only if config is set)
let firebaseAppInstance = null;
let auth = null;
let db = null;
let analytics = null;

function initializeFirebase() {
    // Check if config is set
    if (firebaseConfig.apiKey === "YOUR_API_KEY_HERE") {
        console.warn('Firebase not configured yet. Running in demo mode.');
        return false;
    }

    try {
        // Initialize Firebase
        firebaseAppInstance = firebase.initializeApp(firebaseConfig);
        
        // Initialize Authentication
        auth = firebase.auth();
        
        // Initialize Firestore with offline persistence
        db = firebase.firestore();
        
        // Enable offline persistence (reduces reads when offline)
        db.enablePersistence({ synchronizeTabs: true })
            .catch((err) => {
                if (err.code == 'failed-precondition') {
                    console.warn('Multiple tabs open, persistence only in first tab');
                } else if (err.code == 'unimplemented') {
                    console.warn('Browser does not support offline persistence');
                }
            });
        
        // Initialize Analytics (tracks sessions automatically)
        if (firebaseConfig.measurementId) {
            analytics = firebase.analytics();
            console.log('Firebase Analytics enabled');
        }
        
        // Configure Firestore settings for cost optimization
        db.settings({
            cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
        });
        
        console.log('Firebase initialized successfully');
        return true;
    } catch (error) {
        console.error('Error initializing Firebase:', error);
        return false;
    }
}

// Export for use in other modules
window.firebaseApp = {
    app: firebaseAppInstance,
    auth,
    db,
    analytics,
    initialized: false,
    init: initializeFirebase
};
