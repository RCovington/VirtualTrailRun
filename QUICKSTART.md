# 🚀 Quick Start Checklist

Use this checklist to get Virtual Trail Run up and running quickly!

## ✅ Phase 1: Firebase Setup (15 minutes)

### 1. Create Firebase Project
- [ ] Go to https://console.firebase.google.com/
- [ ] Click "Add project" or "Create a project"
- [ ] Enter project name (e.g., "virtual-trail-run")
- [ ] Enable/disable Google Analytics (your choice)
- [ ] Click "Create project"
- [ ] Wait for project to be created

### 2. Register Web App
- [ ] In Firebase Console, click "Add app" → Web (</>) icon
- [ ] Enter app nickname (e.g., "Virtual Trail Run Web")
- [ ] Check "Also set up Firebase Hosting" (optional but recommended)
- [ ] Click "Register app"
- [ ] **IMPORTANT**: Copy the `firebaseConfig` object
- [ ] Click "Continue to console"

### 3. Update Config File
- [ ] Open `firebase-config.js` in your code editor
- [ ] Replace the placeholder values with your actual config:
  ```javascript
  const firebaseConfig = {
      apiKey: "AIza...",              // From Firebase Console
      authDomain: "your-project.firebaseapp.com",
      projectId: "your-project",
      storageBucket: "your-project.appspot.com",
      messagingSenderId: "123456789",
      appId: "1:123:web:abc123",
      measurementId: "G-ABC123"       // Optional
  };
  ```
- [ ] Save the file

### 4. Enable Authentication
- [ ] In Firebase Console → Build → Authentication
- [ ] Click "Get started"
- [ ] Click "Email/Password" under Sign-in method
- [ ] Enable "Email/Password" (toggle switch)
- [ ] Click "Save"

### 5. Enable Firestore Database
- [ ] In Firebase Console → Build → Firestore Database
- [ ] Click "Create database"
- [ ] Select "Start in test mode" (we'll secure it later)
- [ ] Choose your database location (closest to your users)
- [ ] Click "Enable"
- [ ] Wait for database to be created

### 6. Verify Analytics (Optional)
- [ ] In Firebase Console → Build → Analytics
- [ ] Should already be enabled if you chose it during project creation
- [ ] If not, follow prompts to enable

---

## ✅ Phase 2: Local Testing (10 minutes)

### 7. Run Local Server
Choose one method:

**Option A: Live Server (Recommended)**
- [ ] Install: `npm install -g live-server`
- [ ] Navigate to project: `cd d:\src\virtualTrailRun`
- [ ] Run: `live-server`
- [ ] Browser should open automatically to http://127.0.0.1:8080

**Option B: Python**
- [ ] Navigate to project: `cd d:\src\virtualTrailRun`
- [ ] Run: `python -m http.server 8000`
- [ ] Open browser to: http://localhost:8000

**Option C: VS Code Live Server**
- [ ] Install "Live Server" extension in VS Code
- [ ] Right-click `index.html`
- [ ] Select "Open with Live Server"

### 8. Test Guest Mode
- [ ] Page loads without errors (check browser console)
- [ ] Click "Log In / Sign Up" button
- [ ] Click "Continue as Guest"
- [ ] Modal closes and you see "Welcome, Guest!" message
- [ ] User menu appears in top right (shows "Guest")

### 9. Test Video Playback
- [ ] Click on a video option (e.g., "Mountain Trail")
- [ ] Video preview loads in player
- [ ] Click "Start Workout" button
- [ ] Video starts playing

### 10. Test Head Tracking
- [ ] When prompted, click "Allow" for camera access
- [ ] Your face appears in the small camera feed
- [ ] Green dots appear on your face (MediaPipe tracking)
- [ ] Bob your head up and down
- [ ] "Total Bobs" counter increases
- [ ] "Bobs/min" updates
- [ ] Distance increases
- [ ] Timer runs

### 11. Test Pause/Resume
- [ ] Click video to pause
- [ ] Timer stops
- [ ] Camera tracking continues
- [ ] Click video to play
- [ ] Timer resumes
- [ ] All stats continue from where they left off

---

## ✅ Phase 3: Account Testing (5 minutes)

### 12. Create Account
- [ ] Click "Log In / Sign Up" button
- [ ] Switch to "Sign Up" tab
- [ ] Enter name: "Test User"
- [ ] Enter email: "test@example.com" (or your real email)
- [ ] Enter password: at least 6 characters
- [ ] Re-enter password (must match)
- [ ] Click "Sign Up"
- [ ] Modal closes, success message appears
- [ ] User menu shows your name/email

### 13. Verify Account in Firebase
- [ ] Go to Firebase Console
- [ ] Navigate to Authentication → Users
- [ ] Your new account should be listed
- [ ] Note the UID (User ID)

### 14. Test Logout
- [ ] Click user menu in top right
- [ ] Click "Log Out"
- [ ] User menu disappears
- [ ] "Log In / Sign Up" button reappears
- [ ] "Logged out successfully" message appears

### 15. Test Login
- [ ] Click "Log In / Sign Up" button
- [ ] Enter your email and password
- [ ] Click "Log In"
- [ ] Modal closes
- [ ] User menu appears with your name

---

## ✅ Phase 4: Workout Save Testing (5 minutes)

### 16. Complete a Workout (Logged In)
- [ ] Make sure you're logged in (not guest)
- [ ] Select a video
- [ ] Click "Start Workout"
- [ ] Allow camera if prompted
- [ ] Do at least 10-15 head bobs
- [ ] Let timer run for at least 30 seconds
- [ ] Click "Reset Stats" button
- [ ] Confirm the reset

### 17. Verify Workout Saved
- [ ] Go to Firebase Console
- [ ] Navigate to Firestore Database
- [ ] Look for "workouts" collection
- [ ] You should see a document with your workout data
- [ ] Click document to view fields:
  - userId (your UID)
  - videoId
  - videoTitle
  - date
  - duration
  - totalBobs
  - distance
  - avgBobsPerMinute

### 18. Check Analytics Events
- [ ] Go to Firebase Console
- [ ] Navigate to Analytics → Events
- [ ] Wait a few minutes (analytics has delay)
- [ ] Look for custom events:
  - `video_selected`
  - `workout_started`
  - `workout_completed`
- [ ] Note: May take up to 24 hours to appear in dashboard
- [ ] For real-time: Use Analytics → DebugView (add `?debug_mode=true` to URL)

---

## ✅ Phase 5: Production Deployment (10 minutes)

### 19. Install Firebase CLI
- [ ] Run: `npm install -g firebase-tools`
- [ ] Verify: `firebase --version`

### 20. Login to Firebase
- [ ] Run: `firebase login`
- [ ] Browser opens for Google login
- [ ] Select your Google account
- [ ] Allow Firebase CLI access
- [ ] Terminal shows "Success!"

### 21. Initialize Firebase Hosting
- [ ] Navigate to project: `cd d:\src\virtualTrailRun`
- [ ] Run: `firebase init`
- [ ] Select "Hosting" (use spacebar to select)
- [ ] Select "Use an existing project"
- [ ] Choose your project from the list
- [ ] Public directory: `.` (current directory)
- [ ] Configure as single-page app: `N`
- [ ] Set up automatic builds: `N`
- [ ] Don't overwrite existing files when prompted

### 22. Deploy to Production
- [ ] Run: `firebase deploy --only hosting`
- [ ] Wait for deployment to complete
- [ ] Note the hosting URL: `https://YOUR-PROJECT.web.app`
- [ ] Visit the URL in your browser
- [ ] Test everything again on the live site

---

## ✅ Phase 6: Mobile Testing (5 minutes)

### 23. Test on Your Phone
- [ ] Open your hosting URL on your phone: `https://YOUR-PROJECT.web.app`
- [ ] Page loads properly
- [ ] Tap "Continue as Guest"
- [ ] Select a video
- [ ] Tap "Start Workout"
- [ ] Allow camera access when prompted
- [ ] Mount phone on treadmill (portrait mode)
- [ ] Start walking
- [ ] Verify head tracking works
- [ ] Check stats update in real-time

### 24. Test Fullscreen
- [ ] Tap the fullscreen button
- [ ] Video goes fullscreen
- [ ] Head tracking continues
- [ ] Exit fullscreen works

---

## ✅ Phase 7: Security & Monitoring (5 minutes)

### 25. Secure Firestore Rules
- [ ] Go to Firebase Console → Firestore Database → Rules
- [ ] Replace test rules with production rules (see FIREBASE_SETUP.md)
- [ ] Click "Publish"

### 26. Set Up Billing Alerts
- [ ] Go to Project Settings → Usage and billing
- [ ] Click "Details & settings"
- [ ] Set budget alert: $5/month (or your preference)
- [ ] Add your email for notifications

### 27. Monitor Usage
- [ ] Check Firebase Console → Usage and billing
- [ ] Review current usage:
  - Firestore reads/writes
  - Authentication users
  - Hosting bandwidth
- [ ] Bookmark this page to check regularly

---

## 🎉 Congratulations!

You've successfully set up Virtual Trail Run! 

### What's Working:
✅ Firebase Authentication (guest + account mode)  
✅ Firestore Database (workout saving)  
✅ Firebase Analytics (event tracking)  
✅ Firebase Hosting (production deployment)  
✅ YouTube video streaming  
✅ AI-powered head tracking  
✅ Real-time workout metrics  

### Next Steps:
- [ ] Share with friends for testing
- [ ] Try different videos
- [ ] Test on different devices
- [ ] Monitor Firebase usage
- [ ] Check analytics dashboard
- [ ] Consider future features (workout history UI, favorites, etc.)

### Need Help?
- Check `TESTING_GUIDE.md` for detailed troubleshooting
- See `FIREBASE_SETUP.md` for Firebase configuration details
- Review `README.md` for feature overview
- Check browser console for errors

---

## 📊 Success Metrics

By the end of this checklist, you should have:
- ✅ Working Firebase project with all services enabled
- ✅ Local development environment running
- ✅ Guest mode tested and working
- ✅ User authentication tested (signup, login, logout)
- ✅ Workout saving verified in Firestore
- ✅ Analytics events tracked
- ✅ Production deployment live
- ✅ Mobile testing completed
- ✅ Security rules configured
- ✅ Billing alerts set up

**Time to complete:** ~55 minutes total

**Cost:** $0 (using Firebase free tier)

Happy running! 🏃‍♂️🎉
