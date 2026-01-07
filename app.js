/**
 * Main Application Controller
 * Coordinates the video player and head tracker
 */

class VirtualTrailRunApp {
    constructor() {
        this.videoPlayer = new VideoPlayer();
        this.headTracker = new HeadTracker();
        this.collectiblesGame = new CollectiblesGame(this.headTracker);
        this.workoutStartTime = null;
        this.workoutTimerInterval = null;
        this.isWorkoutActive = false;
        this.elapsedTime = 0; // Track total elapsed seconds
        this.lastPauseTime = null; // Track when we paused
        this.currentVideoId = null;
        this.currentVideoTitle = null;
        
        // Health and Magic system
        this.health = 100; // Start at full health
        this.maxHealth = 100;
        this.magic = 0; // Start with no magic
        this.maxMagic = 100;
        // About 1 mile worth of bobs = full magic bar
        // 1 mile = ~1056 bobs (1 mile / 0.000947 miles per bob)
        this.bobsForFullMagic = 1056;
        this.lastBobTime = null; // Track last head bob time
        this.magicDecayInterval = null; // Interval for magic decay
        this.lastTotalBobs = 0; // Track last bob count
        
        // XP and Level system
        this.xp = 0; // Current experience points
        this.level = 0; // Current level (0 = no level yet)
        this.xpForNextLevel = 100; // XP needed for level 1
        
        // Shield system
        this.shieldActive = false;
        this.shieldStrength = 0; // Current shield points
        this.maxShield = 50; // Maximum shield capacity
        
        // Game mode toggle
        this.gameModeEnabled = true; // Default to game mode ON
        
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
            healthBar: document.getElementById('healthBar'),
            magicBar: document.getElementById('magicBar'),
            xpBar: document.getElementById('xpBar'),
            levelDisplay: document.getElementById('levelDisplay'),
            xpText: document.getElementById('xpText'),
            shieldBar: document.getElementById('shieldBar'),
            gameModeCheckbox: document.getElementById('gameModeCheckbox'),
            statsBars: document.getElementById('statsBars'),
            collectiblesContainer: document.getElementById('collectiblesContainer'),
            shieldVisual: document.getElementById('shieldVisual')
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
                // Restart collectibles game if camera is active and game mode is enabled
                if (this.gameModeEnabled && this.collectiblesGame && this.headTracker.isCameraActive() && !this.collectiblesGame.isActive) {
                    const cameraFeed = document.getElementById('cameraFeed');
                    if (cameraFeed) {
                        this.collectiblesGame.start(cameraFeed);
                    }
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
        // Wait for auth UI to load (retry up to 10 times)
        let attempts = 0;
        const maxAttempts = 10;
        
        const trySetup = () => {
            attempts++;
            const loginButton = document.getElementById('loginButton');
            
            if (loginButton) {
                // Auth UI is loaded, set up event listeners
                this.initAuthUIListeners();
            } else if (attempts < maxAttempts) {
                // Not loaded yet, try again
                setTimeout(trySetup, 100);
            } else {
                console.warn('Auth UI not loaded after timeout');
            }
        };
        
        trySetup();
    }
    
    /**
     * Initialize auth UI event listeners (called once UI is loaded)
     */
    initAuthUIListeners() {
        console.log('Setting up auth UI listeners');
        
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
        
        // Game mode toggle
        this.elements.gameModeCheckbox.addEventListener('change', (e) => {
            this.toggleGameMode(e.target.checked);
        });
    }

    /**
     * Start the workout
     */
    async startWorkout() {
        console.log('Starting workout...');
        
        // Hide overlay
        this.elements.videoOverlay.classList.add('hidden');
        
        // Start video (with ready check)
        if (this.videoPlayer && this.videoPlayer.isReady) {
            this.videoPlayer.play();
        } else {
            console.error('Video player not ready');
            alert('Video player is still loading. Please wait a moment and try again.');
            this.elements.videoOverlay.classList.remove('hidden');
            return;
        }
        
        // Track workout start in analytics
        if (this.analytics) {
            this.analytics.trackEvent('workout_started', {
                videoId: this.currentVideoId,
                videoTitle: this.currentVideoTitle
            });
        }
        
        // Initialize health and magic bars
        this.health = this.maxHealth;
        this.magic = 0;
        this.lastBobTime = Date.now();
        this.lastTotalBobs = 0;
        this.updateStatBars();
        this.startMagicDecayMonitor();
        
        // Initialize camera if not already active
        if (!this.headTracker.isCameraActive()) {
            try {
                await this.toggleCamera();
            } catch (error) {
                console.error('Could not start camera:', error);
                alert('Camera access is required for head tracking. Please enable camera access.');
            }
        }
        
        // Start collectibles game if game mode is enabled
        const cameraFeed = document.getElementById('cameraFeed');
        if (this.gameModeEnabled && cameraFeed && this.collectiblesGame) {
            this.collectiblesGame.start(cameraFeed);
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
     * Toggle game mode on/off
     */
    toggleGameMode(enabled) {
        this.gameModeEnabled = enabled;
        console.log(`Game mode ${enabled ? 'enabled' : 'disabled'}`);
        
        if (enabled) {
            // Show game overlays
            if (this.elements.statsBars) {
                this.elements.statsBars.style.display = 'flex';
            }
            if (this.elements.collectiblesContainer) {
                this.elements.collectiblesContainer.style.display = 'block';
            }
            
            // Start collectibles game if camera is active and video is playing
            if (this.collectiblesGame && this.headTracker.isCameraActive() && 
                this.videoPlayer && !this.videoPlayer.isPaused()) {
                const cameraFeed = document.getElementById('cameraFeed');
                if (cameraFeed && !this.collectiblesGame.isActive) {
                    this.collectiblesGame.start(cameraFeed);
                }
            }
        } else {
            // Hide game overlays
            if (this.elements.statsBars) {
                this.elements.statsBars.style.display = 'none';
            }
            if (this.elements.collectiblesContainer) {
                this.elements.collectiblesContainer.style.display = 'none';
            }
            if (this.elements.shieldVisual) {
                this.elements.shieldVisual.classList.remove('active');
            }
            
            // Stop collectibles game
            if (this.collectiblesGame && this.collectiblesGame.isActive) {
                this.collectiblesGame.stop();
            }
        }
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
        
        // Check if bobs increased (person is walking)
        if (totalBobs > this.lastTotalBobs) {
            this.lastBobTime = Date.now();
            const bobsIncrement = totalBobs - this.lastTotalBobs;
            this.lastTotalBobs = totalBobs;
            
            // DEBUG: 2x regeneration rate
            const debugMultiplier = 2;
            
            // Increment magic bar gradually based on new bobs (not total)
            // Each bob adds a small amount to magic
            const magicIncrement = (bobsIncrement / this.bobsForFullMagic) * 100 * debugMultiplier;
            this.magic = Math.min(this.magic + magicIncrement, this.maxMagic);
            
            // Increment health at half the rate of magic
            const healthIncrement = magicIncrement / 2;
            this.health = Math.min(this.health + healthIncrement, this.maxHealth);
            
            // Add glowing class when increasing
            this.elements.magicBar.classList.add('magic-increasing');
            
            // Start monitoring for inactivity
            this.startMagicDecayMonitor();
        }
        
        this.updateStatBars();
    }

    /**
     * Start monitoring for magic decay when user stops walking
     */
    startMagicDecayMonitor() {
        // Clear existing interval if any
        if (this.magicDecayInterval) {
            clearInterval(this.magicDecayInterval);
        }
        
        this.magicDecayInterval = setInterval(() => {
            const timeSinceLastBob = Date.now() - (this.lastBobTime || Date.now());
            
            // If more than 2 seconds since last bob and video is playing
            if (timeSinceLastBob > 2000 && this.isWorkoutActive && !this.videoPlayer.isPaused()) {
                // Remove glowing effect, add decay effect
                this.elements.magicBar.classList.remove('magic-increasing');
                this.elements.magicBar.classList.add('magic-decaying');
                
                // Decay magic at twice the rate it increases
                // Rate: (100 / 1056 bobs) * 2 = ~0.189 per second
                const decayRate = (100 / this.bobsForFullMagic) * 2;
                this.magic = Math.max(0, this.magic - decayRate);
                this.updateStatBars();
            } else if (timeSinceLastBob <= 2000) {
                // User is walking, remove decay effect
                this.elements.magicBar.classList.remove('magic-decaying');
            }
        }, 1000); // Check every second
    }

    /**
     * Stop magic decay monitor
     */
    stopMagicDecayMonitor() {
        if (this.magicDecayInterval) {
            clearInterval(this.magicDecayInterval);
            this.magicDecayInterval = null;
        }
        this.elements.magicBar.classList.remove('magic-increasing', 'magic-decaying');
    }


    /**     * Add experience points and check for level up
     */
    addXP(amount) {
        this.xp += amount;
        console.log(`⭐ Gained ${amount} XP! Total: ${this.xp}/${this.xpForNextLevel}`);
        
        // Check for level up
        if (this.xp >= this.xpForNextLevel) {
            this.levelUp();
        }
        
        this.updateStatBars();
    }

    /**
     * Level up the player
     */
    levelUp() {
        this.level++;
        this.xp = this.xp - this.xpForNextLevel; // Carry over excess XP
        
        // Increase max health and max magic by 10%
        const oldMaxHealth = this.maxHealth;
        const oldMaxMagic = this.maxMagic;
        this.maxHealth = Math.floor(this.maxHealth * 1.1);
        this.maxMagic = Math.floor(this.maxMagic * 1.1);
        
        // Also restore some health and magic on level up
        this.health = Math.min(this.maxHealth, this.health + (this.maxHealth - oldMaxHealth));
        this.magic = Math.min(this.maxMagic, this.magic + (this.maxMagic - oldMaxMagic));
        
        // Increase XP needed for next level (100 per level)
        this.xpForNextLevel = (this.level + 1) * 100;
        
        console.log(`🎉 LEVEL UP! Now level ${this.level}! Max Health: ${oldMaxHealth} → ${this.maxHealth}, Max Magic: ${oldMaxMagic} → ${this.maxMagic}`);
        console.log(`📊 Next level at ${this.xpForNextLevel} XP`);
        
        // Show level up feedback
        this.showLevelUpFeedback();
    }

    /**
     * Show visual feedback for level up
     */
    showLevelUpFeedback() {
        const feedback = document.createElement('div');
        feedback.className = 'level-up-feedback';
        feedback.innerHTML = `<div class="level-up-text">🎉 LEVEL ${this.level}! 🎉</div>`;
        feedback.style.position = 'fixed';
        feedback.style.top = '50%';
        feedback.style.left = '50%';
        feedback.style.transform = 'translate(-50%, -50%)';
        feedback.style.fontSize = '3rem';
        feedback.style.fontWeight = 'bold';
        feedback.style.color = '#FFD700';
        feedback.style.textShadow = '0 0 20px #FF6B35, 0 0 40px #FFA500';
        feedback.style.animation = 'levelUpPulse 2s ease-out forwards';
        feedback.style.pointerEvents = 'none';
        feedback.style.zIndex = '10000';
        
        document.body.appendChild(feedback);
        
        setTimeout(() => {
            feedback.remove();
        }, 2000);
    }

    /**     * Update the health and magic bar displays
     */
    updateStatBars() {
        const healthPercent = (this.health / this.maxHealth) * 100;
        const magicPercent = (this.magic / this.maxMagic) * 100;
        
        this.elements.healthBar.style.width = `${healthPercent}%`;
        this.elements.magicBar.style.width = `${magicPercent}%`;
        
        // XP bar and text are in the dynamically created inventory panel
        // Query them directly instead of using cached references
        const xpBar = document.getElementById('xpBar');
        if (xpBar) {
            const xpPercent = (this.xp / this.xpForNextLevel) * 100;
            xpBar.style.width = `${xpPercent}%`;
        }
        
        const levelDisplay = document.getElementById('levelDisplay');
        if (levelDisplay) {
            levelDisplay.textContent = this.level;
        }
        
        const xpText = document.getElementById('xpText');
        if (xpText) {
            xpText.textContent = `${this.xp}/${this.xpForNextLevel} XP`;
        }
        
        if (this.elements.shieldBar) {
            const shieldPercent = (this.shieldStrength / this.maxShield) * 100;
            this.elements.shieldBar.style.width = `${shieldPercent}%`;
            this.elements.shieldBar.style.display = this.shieldActive ? 'block' : 'none';
        }
    }

    /**
     * Take damage (reduces health)
     */
    takeDamage(amount) {
        // Shield absorbs damage first
        if (this.shieldStrength > 0) {
            const shieldAbsorbed = Math.min(this.shieldStrength, amount);
            this.shieldStrength -= shieldAbsorbed;
            amount -= shieldAbsorbed;
            console.log(`🛡️ Shield absorbed ${shieldAbsorbed.toFixed(1)} damage! Shield: ${this.shieldStrength.toFixed(1)}/${this.maxShield}`);
            
            if (this.shieldStrength <= 0) {
                this.shieldActive = false;
                console.log('🛡️ Shield depleted!');
                
                // Hide shield visual
                if (this.elements.shieldVisual) {
                    this.elements.shieldVisual.classList.remove('active');
                }
            }
        }
        
        // Remaining damage goes to health
        if (amount > 0) {
            this.health = Math.max(0, this.health - amount);
        }
        
        this.updateStatBars();
        
        if (this.health === 0) {
            // Game over logic could go here
            console.log('Health depleted!');
        }
    }

    /**
     * Activate shield (from fist + elbow gesture)
     */
    activateShield() {
        console.log(`🛡️ activateShield() called. shieldActive=${this.shieldActive}, element exists=${!!this.elements.shieldVisual}`);
        
        if (!this.shieldActive) {
            this.shieldActive = true;
            this.shieldStrength = this.maxShield;
            console.log(`🛡️ Shield activated! Strength: ${this.shieldStrength}/${this.maxShield}`);
            this.updateStatBars();
            
            // Show shield visual
            if (this.elements.shieldVisual) {
                console.log('🛡️ Adding active class to shield visual');
                this.elements.shieldVisual.classList.add('active');
                console.log('🛡️ Shield visual classes:', this.elements.shieldVisual.className);
            } else {
                console.error('🛡️ ERROR: shieldVisual element not found!');
            }
        } else {
            console.log('🛡️ Shield already active');
        }
    }

    /**
     * Deactivate shield (when gesture stops)
     */
    deactivateShield() {
        if (this.shieldActive) {
            this.shieldActive = false;
            this.shieldStrength = 0;
            console.log('🛡️ Shield deactivated');
            this.updateStatBars();
            
            // Hide shield visual
            if (this.elements.shieldVisual) {
                this.elements.shieldVisual.classList.remove('active');
            }
        }
    }

    /**
     * Use magic (reduces magic bar)
     */
    useMagic(amount) {
        if (this.magic >= amount) {
            this.magic = Math.max(0, this.magic - amount);
            this.updateStatBars();
            return true;
        }
        return false;
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
        
        // Restart collectibles game if not already active and game mode is enabled
        if (this.gameModeEnabled && this.collectiblesGame && !this.collectiblesGame.isActive && this.headTracker.isCameraActive()) {
            const cameraFeed = document.getElementById('cameraFeed');
            if (cameraFeed) {
                this.collectiblesGame.start(cameraFeed);
            }
        }
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
        
        // Stop collectibles game
        if (this.collectiblesGame) {
            this.collectiblesGame.stop();
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
            
            // Reset health and magic
            this.health = this.maxHealth;
            this.magic = 0;
            this.lastBobTime = null;
            this.lastTotalBobs = 0;
            this.stopMagicDecayMonitor();
            this.updateStatBars();
            
            // Reset collectibles game
            if (this.collectiblesGame) {
                this.collectiblesGame.reset();
            }
            
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
        const bobsPerMinute = parseInt(this.elements.bobsPerMinute.textContent) || 0;
        const durationSeconds = this.elapsedTime + 
            (this.workoutStartTime ? Math.floor((Date.now() - this.workoutStartTime) / 1000) : 0);
        const collectiblesScore = this.collectiblesGame ? this.collectiblesGame.getScore() : 0;

        const workoutData = {
            userId: this.auth.user.uid,
            videoId: this.currentVideoId,
            videoTitle: this.currentVideoTitle,
            date: new Date().toISOString(),
            duration: durationSeconds,
            totalBobs: totalBobs,
            magic: Math.floor(this.magic),
            health: Math.floor(this.health),
            avgBobsPerMinute: bobsPerMinute,
            collectiblesScore: collectiblesScore,
            completedAt: Date.now()
        };

        try {
            // Save to Firestore
            const db = window.firebaseApp.db;
            if (db) {
                await db.collection('workouts').add(workoutData);
                console.log('Workout saved successfully');
                this.showMessage('Workout saved!', 'success');
            } else {
                console.log('Firestore not initialized - workout not saved');
            }
            
            // Track in analytics
            if (this.analytics) {
                this.analytics.trackEvent('workout_completed', {
                    videoId: this.currentVideoId,
                    videoTitle: this.currentVideoTitle,
                    duration: durationSeconds,
                    totalBobs: totalBobs,
                    distance: miles,
                    collectiblesScore: collectiblesScore
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
    window.app = app; // Expose to window for collectibles access
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
