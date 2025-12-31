# Virtual Trail Run - Testing Guide

## Quick Testing Checklist

### 1. Firebase Setup (Required First!)
- [ ] Go to [Firebase Console](https://console.firebase.google.com/)
- [ ] Click "Add project" or "Create a project"
- [ ] Follow the wizard (enable Google Analytics optional)
- [ ] Click "Add app" → Web (</>) icon
- [ ] Copy the config object values
- [ ] Open `firebase-config.js` and replace the placeholder values:
  ```javascript
  const firebaseConfig = {
      apiKey: "YOUR_ACTUAL_API_KEY",           // Replace this!
      authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
      projectId: "YOUR_PROJECT_ID",
      storageBucket: "YOUR_PROJECT_ID.appspot.com",
      messagingSenderId: "YOUR_SENDER_ID",
      appId: "YOUR_APP_ID",
      measurementId: "YOUR_MEASUREMENT_ID"
  };
  ```

### 2. Enable Firebase Services
**Authentication:**
- In Firebase Console → Build → Authentication
- Click "Get started"
- Enable "Email/Password" provider

**Firestore Database:**
- In Firebase Console → Build → Firestore Database
- Click "Create database"
- Start in **test mode** (we'll secure it later)
- Choose your region

**Analytics:**
- Should be enabled by default
- Check under Build → Analytics

### 3. Local Testing

**Option 1: Using Live Server (Recommended)**
```powershell
# Install if you don't have it
npm install -g live-server

# Run from project directory
cd d:\src\virtualTrailRun
live-server
```

**Option 2: Using Python**
```powershell
# Python 3
python -m http.server 8000

# Then open: http://localhost:8000
```

**Option 3: Using VS Code Extension**
- Install "Live Server" extension by Ritwick Dey
- Right-click `index.html` → "Open with Live Server"

### 4. Testing Workflow

#### Guest Mode (No Firebase Required)
1. Open the app
2. Click "Log In / Sign Up"
3. Click "Continue as Guest" on either tab
4. Select a video
5. Click "Start Workout"
6. Allow camera access
7. Verify head tracking works
8. Check that stats update (bobs, time, distance)
9. Reset stats - confirm workout is NOT saved (guest mode)

#### Account Creation
1. Click "Log In / Sign Up"
2. Switch to "Sign Up" tab
3. Enter name, email, password
4. Click "Sign Up"
5. Check Firebase Console → Authentication → Users to verify account created

#### Login
1. Click "Log In / Sign Up"
2. Enter your email/password
3. Click "Log In"
4. Verify user menu appears in top right

#### Workout with Save
1. Log in with account (not guest)
2. Select a video
3. Click "Start Workout"
4. Do some head bobs (at least 10)
5. Let timer run for at least 30 seconds
6. Click "Reset Stats"
7. Confirm reset
8. Check Firebase Console → Firestore Database → workouts collection
9. Verify your workout was saved

#### Analytics Verification
1. Do the steps above (video selection, workout start, completion)
2. Go to Firebase Console → Analytics → Events
3. Wait a few minutes (analytics has delay)
4. Look for custom events:
   - `video_selected`
   - `workout_started`
   - `workout_completed`
5. Check Analytics → DebugView for real-time events (requires debug mode)

### 5. Mobile Testing

1. Deploy to Firebase Hosting (see below)
2. Open on your phone's browser
3. Test camera access (should prompt for permission)
4. Try a real workout on a treadmill!

### 6. Deploy to Firebase Hosting

```powershell
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase in your project
cd d:\src\virtualTrailRun
firebase init

# Select:
# - Hosting
# - Use existing project (select your project)
# - Public directory: . (current directory)
# - Single-page app: No
# - GitHub deployment: No

# Deploy
firebase deploy --only hosting

# Your app is now live at:
# https://YOUR_PROJECT_ID.web.app
```

## Common Issues & Solutions

### "Firebase not initialized"
- **Cause**: You didn't update `firebase-config.js` with real values
- **Fix**: Copy config from Firebase Console → Project Settings → Your app

### Camera not working on mobile
- **Cause**: App not served over HTTPS
- **Fix**: Deploy to Firebase Hosting (provides HTTPS automatically)

### Analytics events not showing
- **Cause**: Analytics has 24-hour delay for dashboard
- **Fix**: Use Analytics → DebugView for real-time testing
- Enable debug mode: Add `?debug_mode=true` to URL

### Workout not saving
- **Cause**: User is in guest mode OR Firestore not enabled
- **Fix**: Create account (not guest) AND enable Firestore in console

### "Missing or insufficient permissions"
- **Cause**: Firestore security rules too strict
- **Fix**: In Firestore console → Rules tab, use test rules temporarily:
  ```
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /{document=**} {
        allow read, write: if request.time < timestamp.date(2024, 12, 31);
      }
    }
  }
  ```

## Cost Monitoring

### Check Your Usage
1. Firebase Console → Usage and billing
2. Monitor these metrics:
   - **Firestore**: Reads, Writes, Deletes
   - **Authentication**: Active users
   - **Hosting**: Bandwidth
   - **Analytics**: Free unlimited

### Expected Free Tier Usage
With caching and batching optimizations:
- **10 users/day**: ~300 reads, 20 writes = $0
- **100 users/day**: ~3,000 reads, 200 writes = $0
- **500 users/day**: ~15,000 reads, 1,000 writes = $0

Free tier limits:
- 50,000 reads/day
- 20,000 writes/day
- 20,000 deletes/day

### Set Billing Alerts
1. Firebase Console → Project Settings
2. Usage and billing → Details & settings
3. Set budget alert (e.g., $5/month)
4. Add your email for notifications

## Feature Testing Matrix

| Feature | Guest Mode | Logged In | Notes |
|---------|-----------|-----------|-------|
| Video playback | ✅ | ✅ | YouTube API |
| Head tracking | ✅ | ✅ | Local camera only |
| Stats display | ✅ | ✅ | Real-time updates |
| Timer | ✅ | ✅ | Pauses correctly |
| Distance calc | ✅ | ✅ | Based on bobs |
| Save workout | ❌ | ✅ | Requires account |
| Analytics | ✅ | ✅ | Both tracked |
| Workout history | ❌ | ✅ | Future feature |

## Next Steps After Testing

1. **Secure Firestore Rules** (see FIREBASE_SETUP.md)
2. **Add Workout History UI** (view past workouts)
3. **Implement Video Favorites** (save preferred videos)
4. **Add Social Features** (share workouts, leaderboards)
5. **Optimize Performance** (lazy load videos, preload models)

## Support Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [YouTube IFrame API](https://developers.google.com/youtube/iframe_api_reference)
- [TensorFlow.js Models](https://github.com/tensorflow/tfjs-models)
- [MediaPipe Face Mesh](https://github.com/tensorflow/tfjs-models/tree/master/face-landmarks-detection)

## Questions?

Check the main documentation:
- `FIREBASE_SETUP.md` - Detailed Firebase configuration
- `DESIGN.md` - Brand guidelines and UI specs
- `README.md` - Project overview and features

---

**Ready to test?** Start with Guest Mode to verify the core functionality, then create an account to test the full experience!
