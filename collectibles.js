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
        
        // Reset canvas size to match video
        if (this.canvas && this.videoElement) {
            this.canvas.width = this.videoElement.videoWidth || 640;
            this.canvas.height = this.videoElement.videoHeight || 480;
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
        
        try {
            const hands = await this.handDetector.estimateHands(this.videoElement, {
                flipHorizontal: true
            });
            
            if (hands && hands.length > 0) {
                const hand = hands[0];
                
                // Check if hand is making a grabbing gesture (closed fist)
                const isGrabbing = this.isGrabbingGesture(hand);
                
                if (isGrabbing) {
                    // Get hand position (use palm center)
                    const handX = this.canvas.width - hand.keypoints[0].x; // Mirror horizontally
                    const handY = hand.keypoints[0].y;
                    
                    // Check for collision with any collectible
                    this.checkCollision(handX, handY);
                }
            }
        } catch (error) {
            // Silently handle detection errors
        }
    }

    /**
     * Determine if hand is making a grabbing gesture
     * Returns true if fingers are curled (fist)
     */
    isGrabbingGesture(hand) {
        const keypoints = hand.keypoints;
        
        // Get palm center (wrist)
        const wrist = keypoints[0];
        
        // Get fingertips
        const indexTip = keypoints[8];
        const middleTip = keypoints[12];
        const ringTip = keypoints[16];
        const pinkyTip = keypoints[20];
        
        // Get finger bases
        const indexBase = keypoints[5];
        const middleBase = keypoints[9];
        const ringBase = keypoints[13];
        const pinkyBase = keypoints[17];
        
        // Check if fingertips are closer to wrist than bases (fingers curled)
        const indexCurled = this.distance(indexTip, wrist) < this.distance(indexBase, wrist) + 30;
        const middleCurled = this.distance(middleTip, wrist) < this.distance(middleBase, wrist) + 30;
        const ringCurled = this.distance(ringTip, wrist) < this.distance(ringBase, wrist) + 30;
        const pinkyCurled = this.distance(pinkyTip, wrist) < this.distance(pinkyBase, wrist) + 30;
        
        // At least 3 fingers should be curled for a grab
        const curledCount = [indexCurled, middleCurled, ringCurled, pinkyCurled].filter(Boolean).length;
        
        return curledCount >= 3;
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
