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
        this.currentNoseX = null;
        this.verticalMovement = 0;
        this.movementHistory = [];
        this.maxHistoryLength = 30; // Track last 30 frames
        
        // Bob detection
        this.bobThreshold = 5; // Minimum vertical movement to count as a bob
        this.bobCount = 0;
        this.lastBobDirection = null; // 'up' or 'down'
        this.bobsPerMinuteHistory = [];
        this.bobTimestamps = [];
        
        // Wink detection
        this.leftEyeEAR = 1.0;
        this.rightEyeEAR = 1.0;
        this.eyeClosedThreshold = 0.15; // Eye Aspect Ratio threshold for closed eye (stricter)
        this.eyeOpenThreshold = 0.25; // Eye must be clearly open
        this.leftEyeClosed = false;
        this.rightEyeClosed = false;
        this.lastWinkTime = 0;
        this.winkCooldown = 1000; // Minimum milliseconds between winks (increased for reliability)
        
        // Tongue detection
        this.tongueOut = false;
        this.lastTongueTime = 0;
        this.tongueCooldown = 1000; // Minimum milliseconds between tongue detections
        this.mouthOpenThreshold = 0.3; // Mouth Aspect Ratio threshold for open mouth (lowered for easier detection)
        
        // Callbacks
        this.onBobDetectedCallback = null;
        this.onMovementCallback = null;
        this.onWinkCallback = null;
        this.onTongueCallback = null;
        
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
            
            // Get display canvas for debug mode visualization
            this.displayCanvas = document.getElementById('trackingCanvasDisplay');
            if (this.displayCanvas) {
                this.displayCtx = this.displayCanvas.getContext('2d');
            }
            
            // Request camera access
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                }
            });
            
            this.video.srcObject = stream;
            
            // Also set stream on display video for debug mode
            const displayVideo = document.getElementById('cameraFeedDisplay');
            if (displayVideo) {
                displayVideo.srcObject = stream;
            }
            
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
            
            console.log(`Canvas dimensions set to: ${this.video.videoWidth}x${this.video.videoHeight}`);
            
            // Size display canvas to match display video when it loads
            if (this.displayCanvas) {
                const displayVideo = document.getElementById('cameraFeedDisplay');
                if (displayVideo) {
                    const updateDisplayCanvasSize = () => {
                        if (displayVideo.videoWidth > 0) {
                            this.displayCanvas.width = displayVideo.videoWidth;
                            this.displayCanvas.height = displayVideo.videoHeight;
                            console.log(`Display canvas sized to: ${displayVideo.videoWidth}x${displayVideo.videoHeight}`);
                        }
                    };
                    displayVideo.addEventListener('loadedmetadata', updateDisplayCanvasSize);
                    updateDisplayCanvasSize(); // Try immediately in case already loaded
                }
            }
            
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
        
        // Debug counter for periodic logging
        if (!this.trackLoopCounter) this.trackLoopCounter = 0;
        this.trackLoopCounter++;
        
        try {
            // Detect faces
            const faces = await this.detector.estimateFaces(this.video);
            
            // Log every 30 frames to verify tracking is running
            if (this.trackLoopCounter % 30 === 0) {
                console.log(`🎯 Head tracking loop running - Video ready: ${this.video.readyState === 4}, Faces detected: ${faces.length}, Canvas size: ${this.canvas.width}x${this.canvas.height}`);
            }
            
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
        this.currentNoseX = noseTip.x;
        
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
        
        // Detect winks
        this.detectWink(face);
        
        // Detect tongue out
        this.detectTongue(face);
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
     * Calculate Eye Aspect Ratio (EAR) for wink detection
     * EAR = (||p2-p6|| + ||p3-p5||) / (2 * ||p1-p4||)
     */
    calculateEyeAspectRatio(eyePoints) {
        // Calculate vertical distances
        const v1 = this.euclideanDistance(eyePoints[1], eyePoints[5]);
        const v2 = this.euclideanDistance(eyePoints[2], eyePoints[4]);
        
        // Calculate horizontal distance
        const h = this.euclideanDistance(eyePoints[0], eyePoints[3]);
        
        // Calculate EAR
        const ear = (v1 + v2) / (2.0 * h);
        return ear;
    }

    /**
     * Calculate Euclidean distance between two points
     */
    euclideanDistance(p1, p2) {
        return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    }

    /**
     * Detect winks using Eye Aspect Ratio
     * MediaPipe Face Mesh eye landmarks:
     * Left eye: 33, 160, 158, 133, 153, 144
     * Right eye: 362, 385, 387, 263, 373, 380
     */
    detectWink(face) {
        const keypoints = face.keypoints;
        
        // Left eye landmarks (6 points around the eye)
        const leftEye = [
            keypoints[33],  // left corner
            keypoints[160], // top
            keypoints[158], // top
            keypoints[133], // right corner
            keypoints[153], // bottom
            keypoints[144]  // bottom
        ];
        
        // Right eye landmarks (6 points around the eye)
        const rightEye = [
            keypoints[362], // right corner
            keypoints[385], // top
            keypoints[387], // top
            keypoints[263], // left corner
            keypoints[373], // bottom
            keypoints[380]  // bottom
        ];
        
        // Calculate Eye Aspect Ratios
        this.leftEyeEAR = this.calculateEyeAspectRatio(leftEye);
        this.rightEyeEAR = this.calculateEyeAspectRatio(rightEye);
        
        // Validate that both eyes are visible and trackable
        // If either eye has invalid EAR (NaN, undefined, or extremely low), don't detect winks
        const leftEyeVisible = !isNaN(this.leftEyeEAR) && this.leftEyeEAR > 0.05;
        const rightEyeVisible = !isNaN(this.rightEyeEAR) && this.rightEyeEAR > 0.05;
        
        // Only proceed with wink detection if BOTH eyes are clearly visible
        if (!leftEyeVisible || !rightEyeVisible) {
            // One or both eyes not visible - reset states and skip wink detection
            this.leftEyeClosed = false;
            this.rightEyeClosed = false;
            return;
        }
        
        // Determine if eyes are closed or open
        const leftClosed = this.leftEyeEAR < this.eyeClosedThreshold;
        const rightClosed = this.rightEyeEAR < this.eyeClosedThreshold;
        const leftOpen = this.leftEyeEAR > this.eyeOpenThreshold;
        const rightOpen = this.rightEyeEAR > this.eyeOpenThreshold;
        
        // Debug logging every 30 frames to avoid spam
        if (!this.winkDebugCounter) this.winkDebugCounter = 0;
        this.winkDebugCounter++;
        if (this.winkDebugCounter % 30 === 0) {
            console.log(`👁️ EAR - Left: ${this.leftEyeEAR.toFixed(3)} (${leftClosed ? 'CLOSED' : leftOpen ? 'OPEN' : 'mid'}), Right: ${this.rightEyeEAR.toFixed(3)} (${rightClosed ? 'CLOSED' : rightOpen ? 'OPEN' : 'mid'}), Thresholds: closed<${this.eyeClosedThreshold}, open>${this.eyeOpenThreshold}`);
        }
        
        // Check for cooldown
        const now = Date.now();
        const cooldownPassed = (now - this.lastWinkTime) > this.winkCooldown;
        
        // Detect wink (one eye closed, other eye clearly open)
        if (cooldownPassed) {
            if (leftClosed && rightOpen && !this.leftEyeClosed) {
                // Left eye wink detected
                console.log(`👁️✨ LEFT WINK DETECTED! Left EAR: ${this.leftEyeEAR.toFixed(3)}, Right EAR: ${this.rightEyeEAR.toFixed(3)}`);
                this.leftEyeClosed = true;
                this.lastWinkTime = now;
                if (this.onWinkCallback) {
                    this.onWinkCallback('left');
                } else {
                    console.warn('⚠️ No wink callback registered!');
                }
            } else if (rightClosed && leftOpen && !this.rightEyeClosed) {
                // Right eye wink detected
                console.log(`👁️✨ RIGHT WINK DETECTED! Left EAR: ${this.leftEyeEAR.toFixed(3)}, Right EAR: ${this.rightEyeEAR.toFixed(3)}`);
                this.rightEyeClosed = true;
                this.lastWinkTime = now;
                if (this.onWinkCallback) {
                    this.onWinkCallback('right');
                } else {
                    console.warn('⚠️ No wink callback registered!');
                }
            }
        }
        
        // Reset eye closed state when eyes are open
        if (!leftClosed) this.leftEyeClosed = false;
        if (!rightClosed) this.rightEyeClosed = false;
    }

    /**
     * Detect tongue sticking out gesture
     * Uses mouth landmarks to detect when mouth is very open (indicating tongue out)
     */
    detectTongue(face) {
        const keypoints = face.keypoints;
        
        // Mouth landmarks
        // Upper lip: 13 (top center)
        // Lower lip: 14 (bottom center)
        // Left mouth corner: 61
        // Right mouth corner: 291
        const upperLip = keypoints[13];
        const lowerLip = keypoints[14];
        const leftMouth = keypoints[61];
        const rightMouth = keypoints[291];
        
        // Calculate mouth aspect ratio (vertical opening / horizontal width)
        const mouthHeight = Math.abs(lowerLip.y - upperLip.y);
        const mouthWidth = Math.abs(rightMouth.x - leftMouth.x);
        const mouthAspectRatio = mouthHeight / mouthWidth;
        
        // Check for cooldown
        const now = Date.now();
        const cooldownPassed = (now - this.lastTongueTime) > this.tongueCooldown;
        
        // Debug logging every 60 frames to avoid spam
        if (!this.tongueDebugCounter) this.tongueDebugCounter = 0;
        this.tongueDebugCounter++;
        if (this.tongueDebugCounter % 60 === 0) {
            console.log(`👅 Mouth Aspect Ratio: ${mouthAspectRatio.toFixed(3)}, Threshold: ${this.mouthOpenThreshold}`);
        }
        
        // Detect tongue out (mouth very open)
        if (cooldownPassed && mouthAspectRatio > this.mouthOpenThreshold && !this.tongueOut) {
            console.log(`👅✨ TONGUE OUT DETECTED! Mouth Aspect Ratio: ${mouthAspectRatio.toFixed(3)}`);
            this.tongueOut = true;
            this.lastTongueTime = now;
            if (this.onTongueCallback) {
                this.onTongueCallback();
            } else {
                console.warn('⚠️ No tongue callback registered!');
            }
        }
        
        // Reset tongue state when mouth closes
        if (mouthAspectRatio < this.mouthOpenThreshold * 0.7) {
            this.tongueOut = false;
        }
    }

    /**
     * Draw face keypoints on canvas for visual feedback
     */
    drawFaceKeypoints(face) {
        const keypoints = face.keypoints;
        
        // Clear both canvases
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (this.displayCtx && this.displayCanvas) {
            this.displayCtx.clearRect(0, 0, this.displayCanvas.width, this.displayCanvas.height);
        }
        
        // Draw to both canvases
        const contexts = [{ ctx: this.ctx, canvas: this.canvas }];
        if (this.displayCtx && this.displayCanvas) {
            contexts.push({ ctx: this.displayCtx, canvas: this.displayCanvas });
        }
        
        for (const { ctx, canvas } of contexts) {
            // Save the current context state
            ctx.save();
            
            // Mirror the canvas horizontally to match the mirrored video feed
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            
            // Draw face mesh (simplified - just key points)
            ctx.fillStyle = '#00ff00';
            ctx.strokeStyle = '#00ff00';
            
            // Draw nose tip (most important for tracking)
            const noseTip = keypoints[1];
            ctx.beginPath();
            ctx.arc(noseTip.x, noseTip.y, 8, 0, 2 * Math.PI);
            ctx.fill();
            
            // Draw face outline points
            const outlinePoints = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
            
            ctx.beginPath();
            for (let i = 0; i < outlinePoints.length; i++) {
                const point = keypoints[outlinePoints[i]];
                if (i === 0) {
                    ctx.moveTo(point.x, point.y);
                } else {
                    ctx.lineTo(point.x, point.y);
                }
            }
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Draw movement indicator line
            if (this.previousNoseY !== null && this.currentNoseY !== null) {
                ctx.strokeStyle = this.verticalMovement > this.bobThreshold ? '#ff0000' : '#00ff00';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(noseTip.x, this.previousNoseY);
                ctx.lineTo(noseTip.x, this.currentNoseY);
                ctx.stroke();
            }
            
            // Restore the context state
            ctx.restore();
        }
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
     * Register callback for wink detection
     */
    onWink(callback) {
        this.onWinkCallback = callback;
    }

    /**
     * Register callback for tongue out detection
     */
    onTongue(callback) {
        this.onTongueCallback = callback;
    }

    /**
     * Get current nose position
     */
    getNosePosition() {
        if (this.currentNoseX !== null && this.currentNoseY !== null) {
            return { x: this.currentNoseX, y: this.currentNoseY };
        }
        return null;
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
