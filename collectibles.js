/**
 * Collectibles Game Module
 * Spawns objects on the trail and detects hand gestures to collect them
 */

class CollectiblesGame {
    constructor(headTracker = null) {
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
        this.lastHandKeypoints = null;
        this.isGrabbing = false;
        this.lastMissTime = 0;
        this.missThrottleDelay = 500; // Only show miss feedback every 500ms
        this.headTracker = headTracker; // Reference to head tracker for face position
        
        // Slash gesture tracking
        this.slashHistory = []; // Track hand positions for slash detection
        this.maxSlashHistory = 10; // Keep last 10 positions
        this.isSlashing = false;
        this.slashAnimations = []; // Active slash animations
        
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
                
                // Filter out hands that are likely the face
                if (this.isHandWithinFace(hand)) {
                    // Ignore this detection - it's likely the user's face
                    this.lastHandPosition = null;
                    this.lastHandKeypoints = null;
                    this.isGrabbing = false;
                    return;
                }
                
                // Store keypoints for drawing on video overlay
                this.lastHandKeypoints = hand.keypoints;
                
                // Draw hand keypoints for debugging
                this.drawHandDebug(hand);
                
                // Check for slash gesture
                const slashDetected = this.detectSlashGesture(hand);
                if (slashDetected) {
                    this.createSlashAnimation(slashDetected);
                }
                
                // Check if hand is making a grabbing gesture (pinch)
                this.isGrabbing = this.isGrabbingGesture(hand);
                
                if (this.isGrabbing) {
                    // Get hand position (use pinch point - midpoint between thumb and index)
                    const thumbTip = hand.keypoints[4];
                    const indexTip = hand.keypoints[8];
                    const handX = (thumbTip.x + indexTip.x) / 2;
                    const handY = (thumbTip.y + indexTip.y) / 2;
                    
                    this.lastHandPosition = { x: handX, y: handY };
                    
                    // Check for collision with any collectible
                    const grabbed = this.checkCollision(handX, handY);
                    
                    // If no collision, show miss feedback
                    if (!grabbed) {
                        this.showMissFeedback(handX, handY);
                    }
                } else {
                    // Still track hand position even when not grabbing
                    const handX = hand.keypoints[0].x;
                    const handY = hand.keypoints[0].y;
                    this.lastHandPosition = { x: handX, y: handY };
                }
            } else {
                this.lastHandPosition = null;
                this.lastHandKeypoints = null;
                this.isGrabbing = false;
            }
        } catch (error) {
            // Silently handle detection errors
            this.lastHandPosition = null;
            this.lastHandKeypoints = null;
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
        
        // Draw lines (no manual mirroring - CSS handles it)
        this.debugCtx.strokeStyle = lineColor;
        this.debugCtx.lineWidth = 2;
        connections.forEach(([start, end]) => {
            const startPoint = keypoints[start];
            const endPoint = keypoints[end];
            
            this.debugCtx.beginPath();
            this.debugCtx.moveTo(startPoint.x, startPoint.y);
            this.debugCtx.lineTo(endPoint.x, endPoint.y);
            this.debugCtx.stroke();
        });
        
        // Draw keypoints (no manual mirroring - CSS handles it)
        keypoints.forEach((point, index) => {
            const x = point.x;
            const y = point.y;
            
            // Highlight thumb tip (4) and index tip (8) with larger circles
            const isThumbTip = index === 4;
            const isIndexTip = index === 8;
            const isPinchPoint = isThumbTip || isIndexTip;
            const radius = isPinchPoint ? 8 : (index === 0 ? 8 : 4);
            
            this.debugCtx.beginPath();
            this.debugCtx.arc(x, y, radius, 0, 2 * Math.PI);
            this.debugCtx.fillStyle = pointColor;
            this.debugCtx.fill();
            
            // Special styling for pinch points
            if (isPinchPoint) {
                this.debugCtx.strokeStyle = isGrabbing ? '#00FF00' : '#FFD700'; // Gold when not pinching
                this.debugCtx.lineWidth = 3;
                this.debugCtx.stroke();
            }
            // Draw palm center larger
            else if (index === 0) {
                this.debugCtx.strokeStyle = isGrabbing ? '#00FF00' : '#FF6B35';
                this.debugCtx.lineWidth = 3;
                this.debugCtx.stroke();
            }
        });
        
        // Draw line between thumb and index tip when pinching
        if (isGrabbing) {
            const thumbTip = keypoints[4];
            const indexTip = keypoints[8];
            
            this.debugCtx.beginPath();
            this.debugCtx.moveTo(thumbTip.x, thumbTip.y);
            this.debugCtx.lineTo(indexTip.x, indexTip.y);
            this.debugCtx.strokeStyle = '#00FF00';
            this.debugCtx.lineWidth = 4;
            this.debugCtx.stroke();
        }
        
        // Draw pinching indicator
        if (isGrabbing) {
            const thumbTip = keypoints[4];
            const indexTip = keypoints[8];
            // Position text near the pinch point
            const x = (thumbTip.x + indexTip.x) / 2;
            const y = (thumbTip.y + indexTip.y) / 2;
            
            this.debugCtx.font = 'bold 24px Arial';
            this.debugCtx.fillStyle = '#00FF00';
            this.debugCtx.strokeStyle = '#000000';
            this.debugCtx.lineWidth = 3;
            this.debugCtx.strokeText('PINCHING! 🤏', x + 20, y - 20);
            this.debugCtx.fillText('PINCHING! 🤏', x + 20, y - 20);
        }
    }

    /**
     * Check if a hand is within the face area
     * Returns true if the hand center is within an expanded face bounding box
     */
    isHandWithinFace(hand) {
        // If no head tracker or not tracking, allow all hand detections
        if (!this.headTracker || !this.headTracker.detector) {
            return false;
        }

        try {
            // Get the palm center (keypoint 0)
            const palmCenter = hand.keypoints[0];
            
            // Get current face detection from head tracker
            // The head tracker stores the last face detection internally
            const video = this.videoElement;
            if (!video || video.readyState !== 4) return false;
            
            // We need to check if hand is near where a face would be
            // Use a simple heuristic: check if palm is in the upper 40% of the frame
            // and relatively centered (middle 60% horizontally)
            const videoWidth = video.videoWidth || video.width;
            const videoHeight = video.videoHeight || video.height;
            
            const palmX = palmCenter.x;
            const palmY = palmCenter.y;
            
            // Face is typically in upper portion and centered
            const isInUpperPortion = palmY < videoHeight * 0.4;
            const isHorizontallyCentered = palmX > videoWidth * 0.2 && palmX < videoWidth * 0.8;
            
            // If hand is in typical face area, consider it suspicious
            const isInFaceZone = isInUpperPortion && isHorizontallyCentered;
            
            // Additional check: if hand keypoints are very close together (face features)
            // Calculate average distance between keypoints
            let totalDistance = 0;
            let count = 0;
            for (let i = 0; i < hand.keypoints.length - 1; i++) {
                const dist = this.distance(hand.keypoints[i], hand.keypoints[i + 1]);
                totalDistance += dist;
                count++;
            }
            const avgDistance = totalDistance / count;
            
            // Real hands have larger keypoint spread (>15px avg), faces detect as hands have smaller spread
            const isLikelyFace = avgDistance < 15;
            
            if (isInFaceZone && isLikelyFace) {
                // Debug log occasionally
                if (Math.random() < 0.05) {
                    console.log(`Hand filtered (likely face): avgKeyDist=${avgDistance.toFixed(1)}px, zone=${isInFaceZone}`);
                }
                return true;
            }
            
            return false;
        } catch (error) {
            // On error, allow the hand detection
            return false;
        }
    }

    /**
     * Determine if hand is making a grabbing gesture
     * Returns true if thumb and index finger are pinched together
     */
    isGrabbingGesture(hand) {
        const keypoints = hand.keypoints;
        
        // Get thumb and index finger tips
        const thumbTip = keypoints[4];
        const indexTip = keypoints[8];
        
        // Get thumb and index finger mid joints for reference
        const thumbMid = keypoints[3];
        const indexMid = keypoints[6];
        
        // Calculate distance between thumb tip and index tip
        const pinchDistance = this.distance(thumbTip, indexTip);
        
        // Calculate the "reach" distance (how far apart they could be)
        // This is roughly the distance from thumb mid to index mid
        const reachDistance = this.distance(thumbMid, indexMid);
        
        // Consider it a pinch if the tips are close together
        // Threshold: tips should be within 60 pixels or within 50% of reach distance (more forgiving)
        const pinchThreshold = Math.min(60, reachDistance * 0.5);
        const isPinching = pinchDistance < pinchThreshold;
        
        // Debug logging occasionally
        if (Math.random() < 0.02) { // Log 2% of the time
            console.log(`Pinch detection: distance=${pinchDistance.toFixed(1)}, threshold=${pinchThreshold.toFixed(1)}, isPinching=${isPinching}`);
        }
        
        return isPinching;
    }

    /**
     * Detect slash gesture - flat hand moving quickly
     * Returns slash data if detected, null otherwise
     */
    detectSlashGesture(hand) {
        const keypoints = hand.keypoints;
        
        // Get fingertips and their bases
        const indexTip = keypoints[8];
        const middleTip = keypoints[12];
        const ringTip = keypoints[16];
        const pinkyTip = keypoints[20];
        const thumbTip = keypoints[4];
        
        const indexBase = keypoints[5];
        const middleBase = keypoints[9];
        const ringBase = keypoints[13];
        const pinkyBase = keypoints[17];
        
        // Check if fingers are extended (not curled)
        const indexDist = this.distance(indexTip, indexBase);
        const middleDist = this.distance(middleTip, middleBase);
        const ringDist = this.distance(ringTip, ringBase);
        const pinkyDist = this.distance(pinkyTip, pinkyBase);
        
        const indexExtended = indexDist > 50; // Lowered threshold
        const middleExtended = middleDist > 50;
        const ringExtended = ringDist > 50;
        const pinkyExtended = pinkyDist > 50;
        
        // Check if fingers are roughly parallel (flat hand)
        const yDiff1 = Math.abs(indexTip.y - middleTip.y);
        const yDiff2 = Math.abs(middleTip.y - ringTip.y);
        const yDiff3 = Math.abs(ringTip.y - pinkyTip.y);
        
        const fingersParallel = yDiff1 < 50 && yDiff2 < 50 && yDiff3 < 50; // Relaxed threshold
        
        const isFlat = indexExtended && middleExtended && ringExtended && fingersParallel;
        
        // Debug logging occasionally
        if (Math.random() < 0.05) { // 5% of the time
            console.log(`Slash check: idx=${indexDist.toFixed(0)}, mid=${middleDist.toFixed(0)}, ring=${ringDist.toFixed(0)}, ` +
                       `yDiffs=[${yDiff1.toFixed(0)}, ${yDiff2.toFixed(0)}, ${yDiff3.toFixed(0)}], isFlat=${isFlat}`);
        }
        
        if (!isFlat) {
            this.slashHistory = []; // Reset if not flat
            return null;
        }
        
        // Track hand position for movement detection
        const wrist = keypoints[0];
        const currentPos = { x: wrist.x, y: wrist.y, time: Date.now() };
        
        this.slashHistory.push(currentPos);
        if (this.slashHistory.length > this.maxSlashHistory) {
            this.slashHistory.shift();
        }
        
        // Need at least 5 positions to detect movement
        if (this.slashHistory.length < 5) {
            return null;
        }
        
        // Calculate movement speed and direction
        const oldest = this.slashHistory[0];
        const newest = this.slashHistory[this.slashHistory.length - 1];
        const timeDiff = newest.time - oldest.time;
        const dx = newest.x - oldest.x;
        const dy = newest.y - oldest.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const speed = distance / (timeDiff / 1000); // pixels per second
        
        // Debug logging for movement
        if (Math.random() < 0.1) { // 10% of the time when hand is flat
            console.log(`Slash movement: speed=${speed.toFixed(0)} px/s, distance=${distance.toFixed(0)}px, time=${timeDiff}ms, threshold=120, isSlashing=${this.isSlashing}`);
        }
        
        // Detect slash if moving fast enough (lowered threshold to 120 px/s for more reliable detection)
        if (speed > 120 && !this.isSlashing) {
            this.isSlashing = true;
            
            // Calculate slash angle
            const angle = Math.atan2(dy, dx);
            
            // Determine if it's more horizontal or vertical
            const absAngle = Math.abs(angle);
            const isHorizontal = absAngle < Math.PI / 4 || absAngle > (3 * Math.PI) / 4;
            
            setTimeout(() => { this.isSlashing = false; }, 500); // Cooldown
            
            console.log(`🗡️ SLASH DETECTED! Speed: ${speed.toFixed(0)} px/s, Angle: ${(angle * 180 / Math.PI).toFixed(0)}°`);
            return {
                startX: oldest.x,
                startY: oldest.y,
                endX: newest.x,
                endY: newest.y,
                angle: angle,
                speed: speed,
                isHorizontal: isHorizontal
            };
        }
        
        return null;
    }

    /**
     * Calculate distance between two points
     */
    distance(p1, p2) {
        return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    }

    /**
     * Check for collision between hand and collectibles
     * Returns true if a collectible was grabbed
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
                return true; // Successfully grabbed
            }
        }
        return false; // Missed
    }

    /**
     * Collect a collectible
     */
    collectCollectible(collectible, index) {
        // Remove from array
        this.collectibles.splice(index, 1);
        
        // Don't increment immediately - show pending animation first
        // this.collectedCount++; // Will increment after delay
        
        // Show pending increment
        this.showPendingIncrement();
        
        // Update counter after 2 seconds
        setTimeout(() => {
            this.collectedCount++;
            this.updateCounter();
        }, 2000);
        
        // Show feedback
        this.showCollectFeedback(collectible);
        
        console.log(`Collected ${collectible.type.name}! Pending increment...`);
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
     * Show pending increment next to counter
     */
    showPendingIncrement() {
        const counterContainer = document.querySelector('.collectibles-counter');
        if (!counterContainer) return;
        
        // Create glowing +1 element
        const pending = document.createElement('div');
        pending.className = 'pending-increment';
        pending.textContent = '+1';
        
        // Add to counter container (CSS handles positioning)
        counterContainer.appendChild(pending);
        
        // Remove after animation (2 seconds)
        setTimeout(() => {
            if (pending.parentNode) {
                pending.remove();
            }
        }, 2000);
    }

    /**
     * Show visual feedback when collecting
     */
    showCollectFeedback(collectible) {
        // Convert from video coordinates to display coordinates
        const canvas = this.canvas;
        if (!canvas) return;
        
        const scaleX = canvas.offsetWidth / canvas.width;
        const scaleY = canvas.offsetHeight / canvas.height;
        
        const displayX = collectible.x * scaleX;
        const displayY = collectible.y * scaleY;
        
        // Create floating text
        const feedback = document.createElement('div');
        feedback.className = 'collect-feedback';
        feedback.textContent = `+1 ${collectible.type.emoji}`;
        feedback.style.left = `${displayX}px`;
        feedback.style.top = `${displayY}px`;
        
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
     * Show visual feedback when missing a grab attempt
     */
    showMissFeedback(handX, handY) {
        // Throttle miss feedback to avoid spam
        const now = Date.now();
        if (now - this.lastMissTime < this.missThrottleDelay) {
            return;
        }
        this.lastMissTime = now;
        
        // Convert from video coordinates to display coordinates
        // The canvas element has internal dimensions (canvas.width/height)
        // but displays at CSS dimensions (offsetWidth/offsetHeight)
        const canvas = this.canvas;
        if (!canvas) return;
        
        const scaleX = canvas.offsetWidth / canvas.width;
        const scaleY = canvas.offsetHeight / canvas.height;
        
        const displayX = handX * scaleX;
        const displayY = handY * scaleY;
        
        // Create miss indicator
        const feedback = document.createElement('div');
        feedback.className = 'miss-feedback';
        feedback.textContent = '✗';
        feedback.style.left = `${displayX}px`;
        feedback.style.top = `${displayY}px`;
        
        const container = document.getElementById('collectiblesContainer');
        if (container) {
            container.appendChild(feedback);
            
            // Remove after animation
            setTimeout(() => {
                feedback.remove();
            }, 800);
        }
    }

    /**
     * Create slash animation
     */
    createSlashAnimation(slashData) {
        const animation = {
            ...slashData,
            createdAt: Date.now(),
            duration: 400 // Animation lasts 400ms
        };
        
        this.slashAnimations.push(animation);
        console.log(`✅ Slash animation created! Total animations: ${this.slashAnimations.length}`);
    }

    /**
     * Draw all collectibles
     */
    draw() {
        if (!this.ctx || !this.canvas) return;
        
        // Clear canvas
        this.clearCanvas();
        
        // Draw slash animations
        this.drawSlashAnimations();
        
        // Draw fingertip indicators if hand is detected
        if (this.lastHandKeypoints) {
            this.drawFingertipIndicators(this.lastHandKeypoints);
        }
        
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
     * Draw slash animations
     */
    drawSlashAnimations() {
        if (!this.ctx || !this.canvas) return;
        
        const now = Date.now();
        
        // Remove expired animations
        this.slashAnimations = this.slashAnimations.filter(anim => 
            now - anim.createdAt < anim.duration
        );
        
        // Draw each active slash
        this.slashAnimations.forEach(slash => {
            const progress = (now - slash.createdAt) / slash.duration;
            const opacity = 1 - progress; // Fade out
            
            // Calculate current position along the slash path
            const currentX = slash.startX + (slash.endX - slash.startX) * progress;
            const currentY = slash.startY + (slash.endY - slash.startY) * progress;
            
            // Draw dagger image/emoji
            this.ctx.save();
            this.ctx.translate(currentX, currentY);
            this.ctx.rotate(slash.angle);
            this.ctx.globalAlpha = opacity;
            
            // Draw dagger as text emoji
            this.ctx.font = 'bold 80px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            
            // Add motion blur effect with shadow
            this.ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
            this.ctx.shadowBlur = 20;
            this.ctx.shadowOffsetX = -Math.cos(slash.angle) * 15;
            this.ctx.shadowOffsetY = -Math.sin(slash.angle) * 15;
            
            this.ctx.fillText('🗡️', 0, 0);
            
            // Draw slash trail
            this.ctx.shadowColor = 'transparent';
            const trailLength = 100 * (1 - progress * 0.5);
            this.ctx.strokeStyle = `rgba(200, 200, 255, ${opacity * 0.6})`;
            this.ctx.lineWidth = 8;
            this.ctx.lineCap = 'round';
            
            this.ctx.beginPath();
            this.ctx.moveTo(-trailLength, 0);
            this.ctx.lineTo(0, 0);
            this.ctx.stroke();
            
            this.ctx.restore();
        });
    }

    /**
     * Draw fingertip indicators on the video overlay
     */
    drawFingertipIndicators(keypoints) {
        if (!this.ctx || !this.canvas) return;
        
        // Get thumb and index finger tips
        const thumbTip = keypoints[4];
        const indexTip = keypoints[8];
        
        // Determine color based on pinching state
        const color = this.isGrabbing ? '#00FF00' : '#FFD700'; // Green when pinching, gold otherwise
        const radius = this.isGrabbing ? 4 : 3; // Reduced from 12/10 to 4/3 (about 1/3 size)
        
        // Draw thumb tip
        this.ctx.beginPath();
        this.ctx.arc(thumbTip.x, thumbTip.y, radius, 0, 2 * Math.PI);
        this.ctx.fillStyle = color;
        this.ctx.fill();
        this.ctx.strokeStyle = this.isGrabbing ? '#FFFFFF' : '#FFA500';
        this.ctx.lineWidth = 1; // Reduced from 3 to 1
        this.ctx.stroke();
        
        // Draw index tip
        this.ctx.beginPath();
        this.ctx.arc(indexTip.x, indexTip.y, radius, 0, 2 * Math.PI);
        this.ctx.fillStyle = color;
        this.ctx.fill();
        this.ctx.strokeStyle = this.isGrabbing ? '#FFFFFF' : '#FFA500';
        this.ctx.lineWidth = 1; // Reduced from 3 to 1
        this.ctx.stroke();
        
        // Draw line between them when pinching
        if (this.isGrabbing) {
            this.ctx.beginPath();
            this.ctx.moveTo(thumbTip.x, thumbTip.y);
            this.ctx.lineTo(indexTip.x, indexTip.y);
            this.ctx.strokeStyle = '#00FF00';
            this.ctx.lineWidth = 2; // Reduced from 4 to 2
            this.ctx.stroke();
        }
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
