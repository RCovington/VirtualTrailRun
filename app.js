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
        
        // Distance calculation
        // Average adult stride length is ~2.5 feet, ~2 steps per bob
        // So roughly: 1 bob = 2 steps = 5 feet = 0.000947 miles
        this.milesPerBob = 0.000947;
        
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
    resetStats() {
        if (confirm('Reset all workout statistics?')) {
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
