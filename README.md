# 🏃 Virtual Trail Run - Proof of Concept

A web-based application that combines scenic YouTube videos with real-time head tracking for an immersive treadmill workout experience. This POC demonstrates the technical feasibility of creating a web app similar to iFit or BitGym.

## 🎯 Project Goals

This proof-of-concept validates two critical technical requirements:

1. **YouTube Video Streaming**: Full-screen video playback on mobile/tablet devices
2. **Head Movement Tracking**: Using the device's front-facing camera to detect and track head bobbing during exercise

## ✨ Features

### Current Implementation
- ✅ YouTube video player integration with full-screen support
- ✅ Real-time face detection and head tracking using TensorFlow.js
- ✅ Vertical head movement (bobbing) detection
- ✅ "Bobs per minute" calculation for workout intensity tracking
- ✅ Multiple scenic trail video options
- ✅ Live camera feed with face mesh overlay
- ✅ Workout timer and statistics
- ✅ Responsive design for mobile and desktop
- ✅ Progressive Web App (PWA) ready structure

### Future Enhancements (Ideas)
- 🔮 Video speed adjustment based on movement intensity
- 🔮 Workout history and progress tracking
- 🔮 Custom video playlist creation
- 🔮 Social features and challenges
- 🔮 Integration with fitness trackers
- 🔮 Offline video caching
- 🔮 More advanced pose detection (full body)

## 🚀 Quick Start

### Prerequisites
- Modern web browser (Chrome, Safari, Firefox, Edge)
- Webcam or front-facing camera
- Internet connection (for CDN resources and YouTube videos)

### Installation

1. **Clone or download this repository**
   ```bash
   cd d:\src\virtualTrailRun
   ```

2. **Open in browser**
   - Simply open `index.html` in your web browser
   - OR use a local web server (recommended for testing):
   
   **Using Python:**
   ```bash
   python -m http.server 8000
   # Then open http://localhost:8000
   ```
   
   **Using Node.js (with http-server):**
   ```bash
   npx http-server -p 8000
   # Then open http://localhost:8000
   ```
   
   **Using VS Code:**
   - Install "Live Server" extension
   - Right-click on `index.html` and select "Open with Live Server"

3. **Allow camera permissions** when prompted by your browser

## 📱 Usage

1. **Choose Your Trail**: Click on one of the preset scenic video options
2. **Start Workout**: Click the "🎥 Start Workout" button to begin video playback
3. **Enable Camera**: Click "📹 Enable Camera" to activate head tracking
4. **Start Moving**: Begin walking or running on your treadmill
5. **Monitor Stats**: Watch your head movement stats update in real-time

### Controls
- **Fullscreen Video**: Click the fullscreen button to expand the video
- **Reset Stats**: Clear all workout statistics
- **Switch Videos**: Select different trail videos during your workout

## 🏗️ Technical Architecture

### Technology Stack

#### Frontend Framework
- **Vanilla JavaScript**: No framework dependencies for maximum compatibility
- **HTML5 Canvas**: For rendering face tracking overlay
- **CSS3**: Responsive design with CSS Grid and Flexbox

#### Key Libraries
- **YouTube IFrame API**: Video playback and control
- **TensorFlow.js**: Machine learning framework
- **MediaPipe Face Mesh**: High-fidelity face landmark detection (468 3D landmarks)
- **WebRTC**: Camera access via `getUserMedia` API

### File Structure
```
virtualTrailRun/
├── index.html          # Main HTML structure
├── styles.css          # All styling and responsive design
├── app.js              # Main application controller
├── videoPlayer.js      # YouTube player integration
├── headTracker.js      # Head tracking and face detection
└── README.md          # This file
```

### How It Works

#### Video Streaming
The app uses the YouTube IFrame Player API to embed videos directly in the page. The player supports:
- Full-screen playback on mobile devices
- Programmatic control (play, pause, seek)
- Event handling for playback state changes

#### Head Tracking
The head tracking system works in several steps:

1. **Camera Access**: Uses WebRTC `getUserMedia` API to access the front-facing camera
2. **Face Detection**: TensorFlow.js with MediaPipe Face Mesh detects facial landmarks
3. **Position Tracking**: Monitors the nose tip position (landmark #1) for vertical movement
4. **Bob Detection**: Identifies complete up-down or down-up motion cycles
5. **Statistics**: Calculates bobs per minute by tracking timestamps

**Key Tracking Metrics:**
- **Vertical Movement**: Real-time vertical displacement in pixels
- **Bob Count**: Total number of complete head bobbing cycles
- **Bobs Per Minute**: Intensity metric calculated from recent bob timestamps

## 🔧 Customization

### Adding New Videos

Edit the video selection buttons in `index.html`:

```html
<button class="video-option" data-video-id="YOUR_VIDEO_ID">
    🏔️ Your Video Title
</button>
```

Replace `YOUR_VIDEO_ID` with any YouTube video ID.

### Adjusting Tracking Sensitivity

In `headTracker.js`, modify these parameters:

```javascript
this.bobThreshold = 5;           // Minimum movement to count as a bob
this.maxHistoryLength = 30;      // Number of frames to track
```

### Styling

All styles are in `styles.css` with CSS custom properties for easy theming:

```css
:root {
    --primary-color: #2563eb;
    --secondary-color: #10b981;
    /* ... more variables ... */
}
```

## 📊 Browser Compatibility

| Feature | Chrome | Safari | Firefox | Edge |
|---------|--------|--------|---------|------|
| YouTube IFrame API | ✅ | ✅ | ✅ | ✅ |
| WebRTC Camera | ✅ | ✅ | ✅ | ✅ |
| TensorFlow.js | ✅ | ✅ | ✅ | ✅ |
| MediaPipe | ✅ | ✅ | ✅ | ✅ |
| Fullscreen API | ✅ | ⚠️* | ✅ | ✅ |

*Safari on iOS has some fullscreen limitations in web apps

### Mobile Testing
- **iOS Safari**: Works well, but requires user interaction before camera access
- **Android Chrome**: Full functionality with excellent performance
- **iPad/Tablet**: Optimal experience with larger screen

## ⚠️ Known Limitations

### Current POC Limitations
1. **Performance**: Running video + camera + ML simultaneously is resource-intensive
2. **Battery Drain**: Continuous camera use drains battery quickly
3. **Background Processing**: Mobile browsers limit background tasks
4. **Fullscreen + Camera**: Some browsers restrict camera access in fullscreen mode
5. **Accuracy**: Head tracking works best with good lighting and clear face visibility

### Web App vs Native App Trade-offs

**Web App Advantages:**
- ✅ No installation required
- ✅ Cross-platform (iOS, Android, Desktop)
- ✅ Easier updates
- ✅ Lower development cost

**Native App Advantages:**
- ✅ Better performance optimization
- ✅ More reliable camera access
- ✅ Background execution
- ✅ App store presence
- ✅ Offline capabilities
- ✅ Better battery management

## 🎓 Learning Resources

- [YouTube IFrame API Documentation](https://developers.google.com/youtube/iframe_api_reference)
- [TensorFlow.js Face Landmarks Detection](https://github.com/tensorflow/tfjs-models/tree/master/face-landmarks-detection)
- [MediaPipe Face Mesh](https://google.github.io/mediapipe/solutions/face_mesh.html)
- [WebRTC getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)

## 🚀 Next Steps

### For Development
1. **Test on actual devices**: Try the app on various phones and tablets
2. **Measure performance**: Use Chrome DevTools to profile CPU/memory usage
3. **User testing**: Get feedback from actual treadmill users
4. **Optimize tracking**: Fine-tune bob detection parameters

### Migration to Production
If this POC is successful, consider:

1. **Progressive Web App (PWA)**: Add service worker for offline support
2. **Capacitor/Cordova**: Wrap as native app if needed
3. **React Native**: For fully native performance with shared codebase
4. **Backend Integration**: Add user accounts, workout history, etc.

## 🤝 Contributing

This is a proof-of-concept project. Feel free to:
- Fork and experiment
- Report issues
- Suggest improvements
- Share your findings

## 📄 License

This is an educational proof-of-concept project. Use freely for learning and evaluation.

## 🙏 Acknowledgments

- YouTube for the IFrame API
- TensorFlow.js team for the ML framework
- Google MediaPipe for face detection models
- All the content creators whose trail videos make this possible

---

**Built with ❤️ as a technical feasibility study**

*Last Updated: December 30, 2025*
