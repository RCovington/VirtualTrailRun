/**
 * Head Tracker Module
 * Uses TensorFlow.js and MediaPipe Face Mesh to track head movement
 * Specifically tracks vertical head movement (bobbing) for treadmill running/walking
 */

class HeadTracker {
    constructor() {
        this.video = null;
        this.canvas = null;
        this.ctx = null;
        this.detector = null;
        this.isTracking = false;
        this.cameraActive = false;
        
        // Head position tracking
        this.previousNoseY = null;
        this.currentNoseY = null;
        this.verticalMovement = 0;
        this.movementHistory = [];
        this.maxHistoryLength = 30; // Track last 30 frames
        
        // Bob detection
        this.bobThreshold = 5; // Minimum vertical movement to count as a bob
        this.bobCount = 0;
        this.lastBobDirection = null; // 'up' or 'down'
        this.bobsPerMinuteHistory = [];
        this.bobTimestamps = [];
        
        // Callbacks
        this.onBobDetectedCallback = null;
        this.onMovementCallback = null;
        
        // Animation frame
        this.animationFrameId = null;
    }

    /**
     * Initialize the head tracker with camera access
     */
    async init() {
        try {
            this.video = document.getElementById('cameraFeed');
            this.canvas = document.getElementById('trackingCanvas');
            this.ctx = this.canvas.getContext('2d');
            
            // Request camera access
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                }
            });
            
            this.video.srcObject = stream;
            this.cameraActive = true;
            
            // Wait for video to load
            await new Promise((resolve) => {
                this.video.onloadedmetadata = () => {
                    resolve();
                };
            });
            
            // Set canvas size to match video
            this.canvas.width = this.video.videoWidth;
            this.canvas.height = this.video.videoHeight;
            
            // Load face detection model
            await this.loadModel();
            
            console.log('Head tracker initialized successfully');
            return true;
        } catch (error) {
            console.error('Error initializing head tracker:', error);
            throw error;
        }
    }

    /**
     * Load the MediaPipe Face Mesh model
     */
    async loadModel() {
        try {
            console.log('Loading face detection model...');
            
            // Create detector with MediaPipe Face Mesh
            const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
            const detectorConfig = {
                runtime: 'mediapipe',
                solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh',
                refineLandmarks: true,
                maxFaces: 1
            };
            
            this.detector = await faceLandmarksDetection.createDetector(model, detectorConfig);
            console.log('Face detection model loaded');
        } catch (error) {
            console.error('Error loading model:', error);
            throw error;
        }
    }

    /**
     * Start tracking head movement
     */
    startTracking() {
        if (!this.detector) {
            console.error('Model not loaded yet');
            return;
        }
        
        this.isTracking = true;
        this.track();
        console.log('Head tracking started');
    }

    /**
     * Stop tracking head movement
     */
    stopTracking() {
        this.isTracking = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        console.log('Head tracking stopped');
    }

    /**
     * Main tracking loop
     */
    async track() {
        if (!this.isTracking) return;
        
        try {
            // Detect faces
            const faces = await this.detector.estimateFaces(this.video);
            
            // Clear canvas
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            
            if (faces.length > 0) {
                const face = faces[0];
                this.processFaceData(face);
                this.drawFaceKeypoints(face);
            } else {
                // No face detected - reset tracking
                this.previousNoseY = null;
                this.verticalMovement = 0;
            }
            
        } catch (error) {
            console.error('Tracking error:', error);
        }
        
        // Continue tracking
        this.animationFrameId = requestAnimationFrame(() => this.track());
    }

    /**
     * Process face landmark data to detect head movement
     */
    processFaceData(face) {
        // Get nose tip position (keypoint 1 in MediaPipe Face Mesh)
        const noseTip = face.keypoints[1];
        this.currentNoseY = noseTip.y;
        
        if (this.previousNoseY !== null) {
            // Calculate vertical movement
            const movement = this.currentNoseY - this.previousNoseY;
            this.verticalMovement = Math.abs(movement);
            
            // Add to history
            this.movementHistory.push(movement);
            if (this.movementHistory.length > this.maxHistoryLength) {
                this.movementHistory.shift();
            }
            
            // Detect bobs (up and down motion)
            this.detectBob(movement);
            
            // Trigger movement callback
            if (this.onMovementCallback) {
                this.onMovementCallback(this.verticalMovement, movement);
            }
        }
        
        this.previousNoseY = this.currentNoseY;
    }

    /**
     * Detect head bobs (complete up-down or down-up cycles)
     */
    detectBob(movement) {
        const currentDirection = movement > this.bobThreshold ? 'down' : 
                                movement < -this.bobThreshold ? 'up' : null;
        
        if (currentDirection && this.lastBobDirection && 
            currentDirection !== this.lastBobDirection) {
            // Direction changed - count as a bob
            this.bobCount++;
            this.bobTimestamps.push(Date.now());
            
            // Keep only last minute of timestamps
            const oneMinuteAgo = Date.now() - 60000;
            this.bobTimestamps = this.bobTimestamps.filter(t => t > oneMinuteAgo);
            
            if (this.onBobDetectedCallback) {
                this.onBobDetectedCallback(this.bobCount);
            }
        }
        
        if (currentDirection) {
            this.lastBobDirection = currentDirection;
        }
    }

    /**
     * Draw face keypoints on canvas for visual feedback
     */
    drawFaceKeypoints(face) {
        const keypoints = face.keypoints;
        
        // Save the current context state
        this.ctx.save();
        
        // Mirror the canvas horizontally to match the mirrored video feed
        this.ctx.translate(this.canvas.width, 0);
        this.ctx.scale(-1, 1);
        
        // Draw face mesh (simplified - just key points)
        this.ctx.fillStyle = '#00ff00';
        this.ctx.strokeStyle = '#00ff00';
        
        // Draw nose tip (most important for tracking)
        const noseTip = keypoints[1];
        this.ctx.beginPath();
        this.ctx.arc(noseTip.x, noseTip.y, 8, 0, 2 * Math.PI);
        this.ctx.fill();
        
        // Draw face outline points
        const outlinePoints = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
        
        this.ctx.beginPath();
        for (let i = 0; i < outlinePoints.length; i++) {
            const point = keypoints[outlinePoints[i]];
            if (i === 0) {
                this.ctx.moveTo(point.x, point.y);
            } else {
                this.ctx.lineTo(point.x, point.y);
            }
        }
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        // Draw movement indicator line
        if (this.previousNoseY !== null && this.currentNoseY !== null) {
            this.ctx.strokeStyle = this.verticalMovement > this.bobThreshold ? '#ff0000' : '#00ff00';
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.moveTo(noseTip.x, this.previousNoseY);
            this.ctx.lineTo(noseTip.x, this.currentNoseY);
            this.ctx.stroke();
        }
        
        // Restore the context state
        this.ctx.restore();
    }

    /**
     * Get current bobs per minute
     */
    getBobsPerMinute() {
        const oneMinuteAgo = Date.now() - 60000;
        const recentBobs = this.bobTimestamps.filter(t => t > oneMinuteAgo);
        return recentBobs.length;
    }

    /**
     * Get average vertical movement
     */
    getAverageMovement() {
        if (this.movementHistory.length === 0) return 0;
        const sum = this.movementHistory.reduce((a, b) => Math.abs(a) + Math.abs(b), 0);
        return sum / this.movementHistory.length;
    }

    /**
     * Reset all tracking statistics
     */
    resetStats() {
        this.bobCount = 0;
        this.bobTimestamps = [];
        this.movementHistory = [];
        this.verticalMovement = 0;
        this.previousNoseY = null;
        console.log('Tracking stats reset');
    }

    /**
     * Register callback for bob detection
     */
    onBobDetected(callback) {
        this.onBobDetectedCallback = callback;
    }

    /**
     * Register callback for movement updates
     */
    onMovement(callback) {
        this.onMovementCallback = callback;
    }

    /**
     * Stop camera and clean up
     */
    stop() {
        this.stopTracking();
        
        if (this.video && this.video.srcObject) {
            const tracks = this.video.srcObject.getTracks();
            tracks.forEach(track => track.stop());
            this.video.srcObject = null;
        }
        
        this.cameraActive = false;
        console.log('Head tracker stopped and camera released');
    }

    /**
     * Check if camera is active
     */
    isCameraActive() {
        return this.cameraActive;
    }

    /**
     * Check if tracking is active
     */
    isActive() {
        return this.isTracking;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HeadTracker;
}
