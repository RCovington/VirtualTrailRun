/**
 * Main Application Controller
 * Coordinates the video player and head tracker
 */

class VirtualTrailRunApp {
    constructor() {
        this.videoPlayer = new VideoPlayer();
        this.headTracker = new HeadTracker();
        this.workoutStartTime = null;
        this.workoutTimerInterval = null;
        this.isWorkoutActive = false;
        this.elapsedTime = 0; // Track total elapsed seconds
        this.lastPauseTime = null; // Track when we paused
        this.currentVideoId = null;
        this.currentVideoTitle = null;
        
        // Distance calculation
        // Average adult stride length is ~2.5 feet, ~2 steps per bob
        // So roughly: 1 bob = 2 steps = 5 feet = 0.000947 miles
        this.milesPerBob = 0.000947;
        
        // Firebase services (initialized later)
        this.cache = null;
        this.analytics = null;
        this.auth = null;
        
        // DOM elements
        this.elements = {
            startButton: document.getElementById('startButton'),
            videoOverlay: document.getElementById('videoOverlay'),
            toggleCamera: document.getElementById('toggleCamera'),
            toggleFullscreen: document.getElementById('toggleFullscreen'),
            resetStats: document.getElementById('resetStats'),
            cameraStatus: document.getElementById('cameraStatus'),
            verticalMovement: document.getElementById('verticalMovement'),
            bobsPerMinute: document.getElementById('bobsPerMinute'),
            totalBobs: document.getElementById('totalBobs'),
            workoutTime: document.getElementById('workoutTime'),
            indicatorBar: document.getElementById('indicatorBar'),
            videoOptions: document.querySelectorAll('.video-option'),
            distanceValue: document.getElementById('distanceValue')
        };
    }

    /**
     * Initialize the application
     */
    async init() {
        console.log('Initializing Virtual Trail Run app...');
        
        try {
            // Initialize Firebase and services
            this.initializeFirebaseServices();
            
            // Initialize video player
            await this.videoPlayer.init();
            console.log('Video player initialized');
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Set up video player callbacks
            this.videoPlayer.onPlay(() => {
                console.log('Video playing');
                if (this.headTracker.isCameraActive() && !this.headTracker.isActive()) {
                    this.headTracker.startTracking();
                }
                if (this.headTracker.isActive()) {
                    this.startWorkoutTimer();
                }
            });
            
            this.videoPlayer.onPause(() => {
                console.log('Video paused');
                if (this.headTracker.isActive()) {
                    this.headTracker.stopTracking();
                }
                this.pauseWorkoutTimer();
            });
            
            // Set up head tracker callbacks
            this.headTracker.onMovement((verticalMovement, direction) => {
                this.updateMovementUI(verticalMovement);
            });
            
            this.headTracker.onBobDetected((totalBobs) => {
                this.updateBobStats(totalBobs);
            });
            
            console.log('App initialized successfully!');
            
        } catch (error) {
            console.error('Error initializing app:', error);
            alert('Error initializing app. Please check console for details.');
        }
    }

    /**
     * Initialize Firebase services
     */
    initializeFirebaseServices() {
        // Initialize Firebase
        if (typeof window.firebaseApp !== 'undefined' && window.firebaseApp.init) {
            window.firebaseApp.initialized = window.firebaseApp.init();
        }
        
        // Initialize Cache Manager (works with or without Firebase)
        if (typeof CacheManager !== 'undefined') {
            this.cache = new CacheManager();
            console.log('Cache Manager initialized');
        }
        
        // Initialize Analytics Tracker
        if (typeof AnalyticsTracker !== 'undefined') {
            this.analytics = new AnalyticsTracker();
            console.log('Analytics Tracker initialized');
        }
        
        // Initialize Auth Manager
        if (typeof AuthManager !== 'undefined' && this.cache && this.analytics) {
            this.auth = new AuthManager(this.cache, this.analytics);
            console.log('Auth Manager initialized');
            
            // Set up auth UI event listeners
            this.setupAuthUI();
        }
    }

    /**
     * Set up authentication UI event listeners
     */
    setupAuthUI() {
        // Wait for auth UI to load
        setTimeout(() => {
            // Login/Signup button
            const loginButton = document.getElementById('loginButton');
            const authModal = document.getElementById('authModal');
            const authClose = document.getElementById('authClose');
            
            if (loginButton) {
                loginButton.addEventListener('click', () => {
                    authModal?.classList.add('active');
                });
            }
            
            if (authClose) {
                authClose.addEventListener('click', () => {
                    authModal?.classList.remove('active');
                });
            }
            
            // Auth tabs
            const authTabs = document.querySelectorAll('.auth-tab');
            authTabs.forEach(tab => {
                tab.addEventListener('click', (e) => {
                    const tabName = e.target.dataset.tab;
                    
                    // Update tabs
                    authTabs.forEach(t => t.classList.remove('active'));
                    e.target.classList.add('active');
                    
                    // Update forms
                    document.querySelectorAll('.auth-form-container').forEach(form => {
                        form.classList.remove('active');
                    });
                    document.getElementById(`${tabName}Form`)?.classList.add('active');
                });
            });
            
            // Login form
            const loginForm = document.getElementById('loginFormElement');
            if (loginForm) {
                loginForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const email = document.getElementById('loginEmail').value;
                    const password = document.getElementById('loginPassword').value;
                    
                    try {
                        await this.auth.login(email, password);
                        authModal?.classList.remove('active');
                        this.showMessage('Login successful!', 'success');
                    } catch (error) {
                        this.showMessage(error.message, 'error');
                    }
                });
            }
            
            // Signup form
            const signupForm = document.getElementById('signupFormElement');
            if (signupForm) {
                signupForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const name = document.getElementById('signupName').value;
                    const email = document.getElementById('signupEmail').value;
                    const password = document.getElementById('signupPassword').value;
                    const confirm = document.getElementById('signupPasswordConfirm').value;
                    
                    if (password !== confirm) {
                        this.showMessage('Passwords do not match!', 'error');
                        return;
                    }
                    
                    try {
                        await this.auth.signUp(email, password, name);
                        authModal?.classList.remove('active');
                        this.showMessage('Account created successfully!', 'success');
                    } catch (error) {
                        this.showMessage(error.message, 'error');
                    }
                });
            }
            
            // Guest buttons
            const guestButtons = document.querySelectorAll('#guestLoginBtn, #guestSignupBtn');
            guestButtons.forEach(btn => {
                btn?.addEventListener('click', async () => {
                    await this.auth.continueAsGuest();
                    authModal?.classList.remove('active');
                    this.showMessage('Welcome, Guest!', 'success');
                });
            });
            
            // Password reset
            const forgotLink = document.getElementById('forgotPasswordLink');
            if (forgotLink) {
                forgotLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    document.querySelectorAll('.auth-form-container').forEach(form => {
                        form.classList.remove('active');
                    });
                    document.getElementById('resetForm')?.classList.add('active');
                });
            }
            
            const backToLoginLink = document.getElementById('backToLoginLink');
            if (backToLoginLink) {
                backToLoginLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    document.querySelectorAll('.auth-form-container').forEach(form => {
                        form.classList.remove('active');
                    });
                    document.getElementById('loginForm')?.classList.add('active');
                });
            }
            
            // User menu
            const userMenuToggle = document.getElementById('userMenuToggle');
            const userMenuDropdown = document.getElementById('userMenuDropdown');
            
            if (userMenuToggle && userMenuDropdown) {
                userMenuToggle.addEventListener('click', () => {
                    userMenuDropdown.classList.toggle('active');
                });
                
                // Close menu when clicking outside
                document.addEventListener('click', (e) => {
                    if (!e.target.closest('.user-menu')) {
                        userMenuDropdown.classList.remove('active');
                    }
                });
            }
            
            // Logout button
            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', async () => {
                    await this.auth.logout();
                    userMenuDropdown?.classList.remove('active');
                    this.showMessage('Logged out successfully', 'success');
                });
            }
            
            // Listen for auth state changes
            window.addEventListener('userLoggedIn', (e) => {
                this.updateUIForAuth(true, e.detail);
            });
            
            window.addEventListener('userLoggedOut', () => {
                this.updateUIForAuth(false);
            });
            
        }, 500); // Give auth UI time to load
    }

    /**
     * Update UI based on auth state
     */
    updateUIForAuth(loggedIn, user = null) {
        const loginButton = document.getElementById('loginButton');
        const userMenu = document.getElementById('userMenu');
        const userName = document.getElementById('userName');
        const userNameLarge = document.getElementById('userNameLarge');
        const userEmail = document.getElementById('userEmail');
        
        if (loggedIn && user) {
            loginButton?.classList.add('auth-hidden');
            userMenu?.classList.remove('auth-hidden');
            
            const displayName = user.displayName || (user.isGuest ? 'Guest' : user.email);
            if (userName) userName.textContent = displayName;
            if (userNameLarge) userNameLarge.textContent = displayName;
            if (userEmail && !user.isGuest) userEmail.textContent = user.email;
        } else {
            loginButton?.classList.remove('auth-hidden');
            userMenu?.classList.add('auth-hidden');
        }
    }

    /**
     * Show message to user
     */
    showMessage(message, type = 'info') {
        const messageDiv = document.getElementById('authMessage');
        if (messageDiv) {
            messageDiv.textContent = message;
            messageDiv.className = `auth-message ${type}`;
            
            setTimeout(() => {
                messageDiv.className = 'auth-message';
            }, 5000);
        }
    }

    /**
     * Set up all event listeners
     */
    setupEventListeners() {
        // Start button
        this.elements.startButton.addEventListener('click', () => {
            this.startWorkout();
        });
        
        // Toggle camera button
        this.elements.toggleCamera.addEventListener('click', () => {
            this.toggleCamera();
        });
        
        // Toggle fullscreen button
        this.elements.toggleFullscreen.addEventListener('click', () => {
            this.videoPlayer.requestFullscreen();
        });
        
        // Reset stats button
        this.elements.resetStats.addEventListener('click', () => {
            this.resetStats();
        });
        
        // Video selection buttons
        this.elements.videoOptions.forEach(button => {
            button.addEventListener('click', (e) => {
                const videoId = e.target.dataset.videoId;
                this.selectVideo(videoId, e.target);
            });
        });
    }

    /**
     * Start the workout
     */
    async startWorkout() {
        console.log('Starting workout...');
        
        // Hide overlay
        this.elements.videoOverlay.classList.add('hidden');
        
        // Start video
        this.videoPlayer.play();
        
        // Track workout start in analytics
        if (this.analytics) {
            this.analytics.trackEvent('workout_started', {
                videoId: this.currentVideoId,
                videoTitle: this.currentVideoTitle
            });
        }
        
        // Initialize camera if not already active
        if (!this.headTracker.isCameraActive()) {
            try {
                await this.toggleCamera();
            } catch (error) {
                console.error('Could not start camera:', error);
                alert('Camera access is required for head tracking. Please enable camera access.');
            }
        }
        
        this.isWorkoutActive = true;
    }

    /**
     * Toggle camera on/off
     */
    async toggleCamera() {
        if (this.headTracker.isCameraActive()) {
            // Turn off camera
            this.headTracker.stop();
            this.elements.toggleCamera.textContent = '📹 Enable Camera';
            this.elements.toggleCamera.classList.remove('active');
            this.elements.cameraStatus.textContent = 'Camera Off';
            this.elements.cameraStatus.classList.remove('active');
            this.pauseWorkoutTimer();
        } else {
            // Turn on camera
            try {
                this.elements.toggleCamera.textContent = 'Initializing...';
                this.elements.toggleCamera.disabled = true;
                
                await this.headTracker.init();
                this.headTracker.startTracking();
                
                this.elements.toggleCamera.textContent = '📹 Disable Camera';
                this.elements.toggleCamera.classList.add('active');
                this.elements.cameraStatus.textContent = 'Camera Active';
                this.elements.cameraStatus.classList.add('active');
                this.elements.toggleCamera.disabled = false;
                
                // Start workout timer if video is playing
                if (this.videoPlayer.playing()) {
                    this.startWorkoutTimer();
                }
                
            } catch (error) {
                console.error('Error enabling camera:', error);
                this.elements.toggleCamera.textContent = '📹 Enable Camera';
                this.elements.toggleCamera.disabled = false;
                
                let errorMessage = 'Could not access camera. ';
                if (error.name === 'NotAllowedError') {
                    errorMessage += 'Please allow camera access in your browser settings.';
                } else if (error.name === 'NotFoundError') {
                    errorMessage += 'No camera found on this device.';
                } else {
                    errorMessage += 'Please check your camera and try again.';
                }
                
                alert(errorMessage);
                throw error;
            }
        }
    }

    /**
     * Select a video to play
     */
    selectVideo(videoId, buttonElement) {
        console.log('Selecting video:', videoId);
        
        // Update UI
        this.elements.videoOptions.forEach(btn => btn.classList.remove('active'));
        buttonElement.classList.add('active');
        
        // Track current video
        this.currentVideoId = videoId;
        this.currentVideoTitle = buttonElement.textContent.trim();
        
        // Track video selection in analytics
        if (this.analytics) {
            this.analytics.trackEvent('video_selected', {
                videoId: this.currentVideoId,
                videoTitle: this.currentVideoTitle
            });
        }
        
        // Load video
        this.videoPlayer.loadVideo(videoId);
        
        // Show overlay again
        this.elements.videoOverlay.classList.remove('hidden');
    }

    /**
     * Update movement UI
     */
    updateMovementUI(verticalMovement) {
        // Update movement display
        this.elements.verticalMovement.textContent = verticalMovement.toFixed(1);
        
        // Update indicator bar (scale to 0-100%)
        const percentage = Math.min((verticalMovement / 20) * 100, 100);
        this.elements.indicatorBar.style.width = percentage + '%';
    }

    /**
     * Update bob statistics
     */
    updateBobStats(totalBobs) {
        this.elements.totalBobs.textContent = totalBobs;
        
        // Update bobs per minute
        const bobsPerMinute = this.headTracker.getBobsPerMinute();
        this.elements.bobsPerMinute.textContent = bobsPerMinute;
        
        // Calculate and update distance
        const miles = totalBobs * this.milesPerBob;
        this.elements.distanceValue.textContent = miles.toFixed(2);
    }

    /**
     * Start the workout timer
     */
    startWorkoutTimer() {
        if (this.workoutTimerInterval) return; // Already running
        
        // Record when we're starting/resuming
        this.workoutStartTime = Date.now();
        
        this.workoutTimerInterval = setInterval(() => {
            this.updateWorkoutTimer();
        }, 1000);
    }

    /**
     * Pause the workout timer
     */
    pauseWorkoutTimer() {
        if (this.workoutTimerInterval) {
            clearInterval(this.workoutTimerInterval);
            this.workoutTimerInterval = null;
            
            // Add the elapsed time since last start to total
            if (this.workoutStartTime) {
                this.elapsedTime += Math.floor((Date.now() - this.workoutStartTime) / 1000);
                this.workoutStartTime = null;
            }
        }
    }

    /**
     * Update the workout timer display
     */
    updateWorkoutTimer() {
        if (!this.workoutStartTime) return;
        
        // Calculate current session time plus any previous elapsed time
        const currentSessionTime = Math.floor((Date.now() - this.workoutStartTime) / 1000);
        const totalElapsed = this.elapsedTime + currentSessionTime;
        
        const minutes = Math.floor(totalElapsed / 60);
        const seconds = totalElapsed % 60;
        
        this.elements.workoutTime.textContent = 
            `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    /**
     * Reset all statistics
     */
    async resetStats() {
        if (confirm('Reset all workout statistics?')) {
            // Save workout before resetting if user is logged in and workout was substantial
            const totalBobs = parseInt(this.elements.totalBobs.textContent) || 0;
            const workoutMinutes = Math.floor(this.elapsedTime / 60);
            
            if (this.auth && this.auth.user && !this.auth.user.isGuest && totalBobs > 10) {
                try {
                    await this.saveWorkout();
                } catch (error) {
                    console.error('Error saving workout:', error);
                }
            }
            
            this.headTracker.resetStats();
            this.workoutStartTime = null;
            this.elapsedTime = 0;
            this.pauseWorkoutTimer();
            
            this.elements.verticalMovement.textContent = '0.0';
            this.elements.bobsPerMinute.textContent = '0';
            this.elements.totalBobs.textContent = '0';
            this.elements.workoutTime.textContent = '0:00';
            this.elements.indicatorBar.style.width = '0%';
            this.elements.distanceValue.textContent = '0.00';
            
            console.log('Stats reset');
        }
    }

    /**
     * Save completed workout to Firebase
     */
    async saveWorkout() {
        if (!this.auth || !this.auth.user || this.auth.user.isGuest) {
            console.log('Guest user - workout not saved to cloud');
            return;
        }

        const totalBobs = parseInt(this.elements.totalBobs.textContent) || 0;
        const miles = parseFloat(this.elements.distanceValue.textContent) || 0;
        const bobsPerMinute = parseInt(this.elements.bobsPerMinute.textContent) || 0;
        const durationSeconds = this.elapsedTime + 
            (this.workoutStartTime ? Math.floor((Date.now() - this.workoutStartTime) / 1000) : 0);

        const workoutData = {
            userId: this.auth.user.uid,
            videoId: this.currentVideoId,
            videoTitle: this.currentVideoTitle,
            date: new Date().toISOString(),
            duration: durationSeconds,
            totalBobs: totalBobs,
            distance: miles,
            avgBobsPerMinute: bobsPerMinute,
            completedAt: Date.now()
        };

        try {
            // Save to Firestore
            const db = window.firebaseServices.firestore;
            await db.collection('workouts').add(workoutData);
            
            // Track in analytics
            if (this.analytics) {
                this.analytics.trackEvent('workout_completed', {
                    videoId: this.currentVideoId,
                    videoTitle: this.currentVideoTitle,
                    duration: durationSeconds,
                    totalBobs: totalBobs,
                    distance: miles
                });
            }
            
            console.log('Workout saved successfully');
            this.showMessage('Workout saved!', 'success');
        } catch (error) {
            console.error('Error saving workout:', error);
            throw error;
        }
    }
}

// Initialize app when DOM is ready
let app;

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing app...');
    app = new VirtualTrailRunApp();
    app.init();
});

// Handle page visibility changes (pause when tab is hidden)
document.addEventListener('visibilitychange', () => {
    if (document.hidden && app) {
        console.log('Page hidden, pausing...');
        if (app.videoPlayer) {
            app.videoPlayer.pause();
        }
    }
});

// Handle page unload (cleanup)
window.addEventListener('beforeunload', () => {
    if (app && app.headTracker) {
        app.headTracker.stop();
    }
});
