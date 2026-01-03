/**
 * YouTube Video Player Module
 * Handles YouTube IFrame API integration and video playback control
 */

class VideoPlayer {
    constructor() {
        this.player = null;
        this.currentVideoId = 'eg7nQ-H4kbI'; // Default video (Mountain Trail)
        this.isReady = false;
        this.isPlaying = false;
        this.onPlayCallback = null;
        this.onPauseCallback = null;
    }

    /**
     * Initialize the YouTube player
     */
    init() {
        return new Promise((resolve, reject) => {
            // Wait for YouTube IFrame API to be ready
            if (typeof YT === 'undefined' || typeof YT.Player === 'undefined') {
                window.onYouTubeIframeAPIReady = () => {
                    this.createPlayer();
                    resolve();
                };
            } else {
                this.createPlayer();
                resolve();
            }
        });
    }

    /**
     * Create the YouTube player instance
     */
    createPlayer() {
        this.player = new YT.Player('player', {
            height: '100%',
            width: '100%',
            videoId: this.currentVideoId,
            playerVars: {
                'playsinline': 1,
                'controls': 1,
                'rel': 0,
                'modestbranding': 1,
                'iv_load_policy': 3,
                'fs': 0, // Disable YouTube's fullscreen button (we have our own)
                'autoplay': 0
            },
            events: {
                'onReady': this.onPlayerReady.bind(this),
                'onStateChange': this.onPlayerStateChange.bind(this)
            }
        });
    }

    /**
     * Called when player is ready
     */
    onPlayerReady(event) {
        console.log('YouTube player ready');
        this.isReady = true;
    }

    /**
     * Called when player state changes
     */
    onPlayerStateChange(event) {
        const states = {
            '-1': 'unstarted',
            '0': 'ended',
            '1': 'playing',
            '2': 'paused',
            '3': 'buffering',
            '5': 'cued'
        };

        const state = states[event.data];
        console.log('Player state:', state);

        if (event.data === YT.PlayerState.PLAYING) {
            this.isPlaying = true;
            if (this.onPlayCallback) {
                this.onPlayCallback();
            }
        } else if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
            this.isPlaying = false;
            if (this.onPauseCallback) {
                this.onPauseCallback();
            }
        }
    }

    /**
     * Load and play a specific video
     */
    loadVideo(videoId) {
        if (!this.isReady) {
            console.error('Player not ready yet');
            return;
        }

        this.currentVideoId = videoId;
        this.player.loadVideoById(videoId);
        console.log('Loading video:', videoId);
    }

    /**
     * Play the current video
     */
    play() {
        if (this.isReady && this.player) {
            this.player.playVideo();
        }
    }

    /**
     * Pause the current video
     */
    pause() {
        if (this.isReady && this.player) {
            this.player.pauseVideo();
        }
    }

    /**
     * Toggle play/pause
     */
    togglePlay() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    /**
     * Request fullscreen for the video player
     */
    requestFullscreen() {
        const videoContainer = document.querySelector('.video-container');
        
        if (videoContainer) {
            if (videoContainer.requestFullscreen) {
                videoContainer.requestFullscreen();
            } else if (videoContainer.webkitRequestFullscreen) {
                videoContainer.webkitRequestFullscreen();
            } else if (videoContainer.mozRequestFullScreen) {
                videoContainer.mozRequestFullScreen();
            } else if (videoContainer.msRequestFullscreen) {
                videoContainer.msRequestFullscreen();
            }
        }
    }

    /**
     * Get current playback time
     */
    getCurrentTime() {
        if (this.isReady && this.player) {
            return this.player.getCurrentTime();
        }
        return 0;
    }

    /**
     * Get video duration
     */
    getDuration() {
        if (this.isReady && this.player) {
            return this.player.getDuration();
        }
        return 0;
    }

    /**
     * Seek to specific time
     */
    seekTo(seconds) {
        if (this.isReady && this.player) {
            this.player.seekTo(seconds, true);
        }
    }

    /**
     * Set volume (0-100)
     */
    setVolume(volume) {
        if (this.isReady && this.player) {
            this.player.setVolume(volume);
        }
    }

    /**
     * Get current volume
     */
    getVolume() {
        if (this.isReady && this.player) {
            return this.player.getVolume();
        }
        return 50;
    }

    /**
     * Mute the video
     */
    mute() {
        if (this.isReady && this.player) {
            this.player.mute();
        }
    }

    /**
     * Unmute the video
     */
    unmute() {
        if (this.isReady && this.player) {
            this.player.unMute();
        }
    }

    /**
     * Register callback for play event
     */
    onPlay(callback) {
        this.onPlayCallback = callback;
    }

    /**
     * Register callback for pause event
     */
    onPause(callback) {
        this.onPauseCallback = callback;
    }

    /**
     * Check if player is ready
     */
    ready() {
        return this.isReady;
    }

    /**
     * Check if video is playing
     */
    playing() {
        return this.isPlaying;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VideoPlayer;
}
