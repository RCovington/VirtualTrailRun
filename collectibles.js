/**
 * Collectibles Game Module
 * Spawns objects on the trail and detects hand gestures to collect them
 */

class CollectiblesGame {
    constructor() {
        this.collectibles = [];
        this.collectedCount = 0;
        this.isActive = false;
        this.spawnInterval = null;
        this.animationFrame = null;
        this.handDetector = null;
        this.videoElement = null;
        this.canvas = null;
        this.ctx = null;
        this.debugCanvas = null;
        this.debugCtx = null;
        this.lastHandPosition = null;
        this.isGrabbing = false;
        
        // Timing
        this.minSpawnTime = 10000; // 10 seconds
        this.maxSpawnTime = 20000; // 20 seconds
        
        // Collectible properties
        this.types = [
            { emoji: '🌰', name: 'acorn', size: 40 },
            { emoji: '🍄', name: 'mushroom', size: 45 },
            { emoji: '🌲', name: 'pinecone', size: 35 },
            { emoji: '🍂', name: 'leaf', size: 38 },
            { emoji: '🪨', name: 'stone', size: 42 }
        ];
        
        this.init();
    }

    /**
     * Initialize the collectibles game
     */
    async init() {
        console.log('Initializing collectibles game...');
        
        // Get canvas for drawing collectibles
        this.canvas = document.getElementById('collectiblesCanvas');
        if (this.canvas) {
            this.ctx = this.canvas.getContext('2d');
        }
        
        // Get debug canvas for hand tracking visualization
        this.debugCanvas = document.getElementById('handDebugCanvas');
        if (this.debugCanvas) {
            this.debugCtx = this.debugCanvas.getContext('2d');
        }
        
        // Load hand detection model
        try {
            if (typeof handPoseDetection !== 'undefined') {
                const model = handPoseDetection.SupportedModels.MediaPipeHands;
                const detectorConfig = {
                    runtime: 'mediapipe',
                    solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/hands',
                    modelType: 'lite', // Use lite model for better performance
                    maxHands: 1 // Only detect one hand
                };
                
                this.handDetector = await handPoseDetection.createDetector(model, detectorConfig);
                console.log('Hand detection model loaded');
            } else {
                console.warn('Hand pose detection not available');
            }
        } catch (error) {
            console.error('Error loading hand detection:', error);
        }
    }

    /**
     * Start the collectibles game
     */
    start(videoElement) {
        if (this.isActive) return;
        
        this.isActive = true;
        this.videoElement = videoElement;
        
        // Reset canvas sizes to match video (maintain aspect ratio)
        if (this.canvas && this.videoElement) {
            const videoWidth = this.videoElement.videoWidth || 640;
            const videoHeight = this.videoElement.videoHeight || 480;
            
            this.canvas.width = videoWidth;
            this.canvas.height = videoHeight;
            
            // Also set debug canvas
            if (this.debugCanvas) {
                this.debugCanvas.width = videoWidth;
                this.debugCanvas.height = videoHeight;
            }
            
            console.log(`Canvas size set to ${videoWidth}x${videoHeight}`);
        }
        
        // Start spawning collectibles
        this.scheduleNextSpawn();
        
        // Start game loop
        this.gameLoop();
        
        console.log('Collectibles game started');
    }

    /**
     * Stop the collectibles game
     */
    stop() {
        this.isActive = false;
        
        if (this.spawnInterval) {
            clearTimeout(this.spawnInterval);
            this.spawnInterval = null;
        }
        
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        
        // Clear all collectibles
        this.collectibles = [];
        this.clearCanvas();
        
        console.log('Collectibles game stopped');
    }

    /**
     * Schedule the next collectible spawn
     */
    scheduleNextSpawn() {
        if (!this.isActive) return;
        
        const delay = Math.random() * (this.maxSpawnTime - this.minSpawnTime) + this.minSpawnTime;
        
        this.spawnInterval = setTimeout(() => {
            this.spawnCollectible();
            this.scheduleNextSpawn();
        }, delay);
    }

    /**
     * Spawn a new collectible
     */
    spawnCollectible() {
        if (!this.canvas) return;
        
        const type = this.types[Math.floor(Math.random() * this.types.length)];
        
        const collectible = {
            id: Date.now() + Math.random(),
            type: type,
            x: Math.random() * (this.canvas.width - 100) + 50, // Random horizontal position
            y: this.canvas.height * 0.7, // Start at 70% down the screen
            initialY: this.canvas.height * 0.7,
            size: type.size,
            speed: 0.3 + Math.random() * 0.2, // Random speed
            scale: 0.6, // Start smaller
            maxScale: 1.2, // Grow to this size
            createdAt: Date.now()
        };
        
        this.collectibles.push(collectible);
        console.log(`Spawned ${type.name} at (${collectible.x.toFixed(0)}, ${collectible.y.toFixed(0)})`);
    }

    /**
     * Main game loop
     */
    async gameLoop() {
        if (!this.isActive) return;
        
        // Update collectibles
        this.updateCollectibles();
        
        // Detect hand gestures
        if (this.handDetector && this.videoElement) {
            await this.detectGesture();
        }
        
        // Draw everything
        this.draw();
        
        // Continue loop
        this.animationFrame = requestAnimationFrame(() => this.gameLoop());
    }

    /**
     * Update all collectibles positions
     */
    updateCollectibles() {
        const now = Date.now();
        
        this.collectibles = this.collectibles.filter(collectible => {
            // Move collectible forward (down and grow)
            const age = (now - collectible.createdAt) / 1000; // seconds
            collectible.y = collectible.initialY + (age * 50); // Move down 50px per second
            collectible.scale = Math.min(
                collectible.maxScale,
                0.6 + (age * 0.15) // Grow over time
            );
            
            // Remove if past bottom of screen
            return collectible.y < this.canvas.height + 50;
        });
    }

    /**
     * Detect hand gesture for grabbing
     */
    async detectGesture() {
        if (!this.videoElement || this.videoElement.readyState !== 4) return;
        
        // Clear debug canvas
        if (this.debugCtx && this.debugCanvas) {
            this.debugCtx.clearRect(0, 0, this.debugCanvas.width, this.debugCanvas.height);
        }
        
        try {
            const hands = await this.handDetector.estimateHands(this.videoElement, {
                flipHorizontal: true
            });
            
            if (hands && hands.length > 0) {
                const hand = hands[0];
                
                // Draw hand keypoints for debugging
                this.drawHandDebug(hand);
                
                // Check if hand is making a grabbing gesture (closed fist)
                this.isGrabbing = this.isGrabbingGesture(hand);
                
                if (this.isGrabbing) {
                    // Get hand position (use palm center)
                    const handX = this.debugCanvas.width - hand.keypoints[0].x; // Mirror horizontally
                    const handY = hand.keypoints[0].y;
                    
                    this.lastHandPosition = { x: handX, y: handY };
                    
                    // Check for collision with any collectible
                    this.checkCollision(handX, handY);
                } else {
                    // Still track hand position even when not grabbing
                    const handX = this.debugCanvas.width - hand.keypoints[0].x;
                    const handY = hand.keypoints[0].y;
                    this.lastHandPosition = { x: handX, y: handY };
                }
            } else {
                this.lastHandPosition = null;
                this.isGrabbing = false;
            }
        } catch (error) {
            // Silently handle detection errors
            this.lastHandPosition = null;
            this.isGrabbing = false;
        }
    }

    /**
     * Draw hand keypoints for debugging
     */
    drawHandDebug(hand) {
        if (!this.debugCtx || !this.debugCanvas) return;
        
        const keypoints = hand.keypoints;
        const width = this.debugCanvas.width;
        
        // Draw connections between keypoints
        const connections = [
            [0, 1], [1, 2], [2, 3], [3, 4],        // Thumb
            [0, 5], [5, 6], [6, 7], [7, 8],        // Index
            [0, 9], [9, 10], [10, 11], [11, 12],   // Middle
            [0, 13], [13, 14], [14, 15], [15, 16], // Ring
            [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
            [5, 9], [9, 13], [13, 17]              // Palm
        ];
        
        // Determine if currently grabbing for color
        const isGrabbing = this.isGrabbingGesture(hand);
        const lineColor = isGrabbing ? '#00FF00' : '#00BFFF';
        const pointColor = isGrabbing ? '#00FF00' : '#FFFFFF';
        
        // Draw lines
        this.debugCtx.strokeStyle = lineColor;
        this.debugCtx.lineWidth = 2;
        connections.forEach(([start, end]) => {
            const startPoint = keypoints[start];
            const endPoint = keypoints[end];
            
            this.debugCtx.beginPath();
            this.debugCtx.moveTo(width - startPoint.x, startPoint.y);
            this.debugCtx.lineTo(width - endPoint.x, endPoint.y);
            this.debugCtx.stroke();
        });
        
        // Draw keypoints
        keypoints.forEach((point, index) => {
            const x = width - point.x;
            const y = point.y;
            
            this.debugCtx.beginPath();
            this.debugCtx.arc(x, y, index === 0 ? 8 : 4, 0, 2 * Math.PI);
            this.debugCtx.fillStyle = pointColor;
            this.debugCtx.fill();
            
            // Draw palm center larger
            if (index === 0) {
                this.debugCtx.strokeStyle = isGrabbing ? '#00FF00' : '#FF6B35';
                this.debugCtx.lineWidth = 3;
                this.debugCtx.stroke();
            }
        });
        
        // Draw grabbing indicator
        if (isGrabbing) {
            const wrist = keypoints[0];
            const x = width - wrist.x;
            const y = wrist.y;
            
            this.debugCtx.font = 'bold 24px Arial';
            this.debugCtx.fillStyle = '#00FF00';
            this.debugCtx.strokeStyle = '#000000';
            this.debugCtx.lineWidth = 3;
            this.debugCtx.strokeText('GRABBING! ✊', x + 20, y - 20);
            this.debugCtx.fillText('GRABBING! ✊', x + 20, y - 20);
        }
    }

    /**
     * Determine if hand is making a grabbing gesture
     * Returns true if fingers are curled (fist)
     */
    isGrabbingGesture(hand) {
        const keypoints = hand.keypoints;
        
        // Get palm center (wrist) and middle of palm
        const wrist = keypoints[0];
        const palmBase = keypoints[9]; // Middle finger base
        
        // Get fingertips
        const thumbTip = keypoints[4];
        const indexTip = keypoints[8];
        const middleTip = keypoints[12];
        const ringTip = keypoints[16];
        const pinkyTip = keypoints[20];
        
        // Get finger middle joints (PIP joints)
        const indexMid = keypoints[6];
        const middleMid = keypoints[10];
        const ringMid = keypoints[14];
        const pinkyMid = keypoints[18];
        
        // Check if fingertips are closer to palm than middle joints (fingers curled)
        // This is a more reliable indicator of a fist
        const indexCurled = this.distance(indexTip, palmBase) < this.distance(indexMid, palmBase) + 10;
        const middleCurled = this.distance(middleTip, palmBase) < this.distance(middleMid, palmBase) + 10;
        const ringCurled = this.distance(ringTip, palmBase) < this.distance(ringMid, palmBase) + 10;
        const pinkyCurled = this.distance(pinkyTip, palmBase) < this.distance(pinkyMid, palmBase) + 10;
        
        // Also check if thumb is curled in (thumb tip closer to palm)
        const thumbCurled = this.distance(thumbTip, palmBase) < 80;
        
        // Count curled fingers
        const fingersCurled = [indexCurled, middleCurled, ringCurled, pinkyCurled].filter(Boolean).length;
        
        // Consider it a grab if at least 3 fingers are curled OR if all 4 fingers + thumb are curled
        const isGrab = fingersCurled >= 3 || (fingersCurled >= 2 && thumbCurled);
        
        // Debug logging occasionally
        if (Math.random() < 0.02) { // Log 2% of the time
            console.log(`Grab detection: fingers=${fingersCurled}, thumb=${thumbCurled}, isGrab=${isGrab}`);
        }
        
        return isGrab;
    }

    /**
     * Calculate distance between two points
     */
    distance(p1, p2) {
        return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    }

    /**
     * Check for collision between hand and collectibles
     */
    checkCollision(handX, handY) {
        for (let i = this.collectibles.length - 1; i >= 0; i--) {
            const collectible = this.collectibles[i];
            const distance = Math.sqrt(
                Math.pow(handX - collectible.x, 2) + 
                Math.pow(handY - collectible.y, 2)
            );
            
            // Collision detection with scaled size
            const hitRadius = (collectible.size * collectible.scale) / 2 + 30; // Extra margin
            
            if (distance < hitRadius) {
                this.collectCollectible(collectible, i);
                break; // Only collect one at a time
            }
        }
    }

    /**
     * Collect a collectible
     */
    collectCollectible(collectible, index) {
        // Remove from array
        this.collectibles.splice(index, 1);
        
        // Increment counter
        this.collectedCount++;
        
        // Update UI
        this.updateCounter();
        
        // Show feedback
        this.showCollectFeedback(collectible);
        
        console.log(`Collected ${collectible.type.name}! Total: ${this.collectedCount}`);
    }

    /**
     * Update the collectibles counter in the UI
     */
    updateCounter() {
        const counter = document.getElementById('collectiblesCount');
        if (counter) {
            counter.textContent = this.collectedCount;
            
            // Add bounce animation
            counter.style.animation = 'none';
            setTimeout(() => {
                counter.style.animation = 'collectBounce 0.5s ease-out';
            }, 10);
        }
    }

    /**
     * Show visual feedback when collecting
     */
    showCollectFeedback(collectible) {
        // Create floating text
        const feedback = document.createElement('div');
        feedback.className = 'collect-feedback';
        feedback.textContent = `+1 ${collectible.type.emoji}`;
        feedback.style.left = `${collectible.x}px`;
        feedback.style.top = `${collectible.y}px`;
        
        const container = document.getElementById('collectiblesContainer');
        if (container) {
            container.appendChild(feedback);
            
            // Remove after animation
            setTimeout(() => {
                feedback.remove();
            }, 1000);
        }
    }

    /**
     * Draw all collectibles
     */
    draw() {
        if (!this.ctx || !this.canvas) return;
        
        // Clear canvas
        this.clearCanvas();
        
        // Draw each collectible
        this.collectibles.forEach(collectible => {
            const size = collectible.size * collectible.scale;
            
            // Draw emoji
            this.ctx.font = `${size}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            
            // Add shadow for depth
            this.ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
            this.ctx.shadowBlur = 10 * collectible.scale;
            this.ctx.shadowOffsetY = 5 * collectible.scale;
            
            this.ctx.fillText(collectible.type.emoji, collectible.x, collectible.y);
            
            // Reset shadow
            this.ctx.shadowColor = 'transparent';
            this.ctx.shadowBlur = 0;
            this.ctx.shadowOffsetY = 0;
        });
    }

    /**
     * Clear the canvas
     */
    clearCanvas() {
        if (this.ctx && this.canvas) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    /**
     * Reset the game
     */
    reset() {
        this.collectedCount = 0;
        this.collectibles = [];
        this.updateCounter();
        this.clearCanvas();
    }

    /**
     * Get current score
     */
    getScore() {
        return this.collectedCount;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CollectiblesGame;
}
