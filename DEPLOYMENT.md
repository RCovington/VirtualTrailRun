# Deployment Guide - Virtual Trail Run

## 🚀 Option 1: GitHub Pages (RECOMMENDED for Testing)

### Why GitHub Pages?
- ✅ **Free** static hosting
- ✅ **HTTPS by default** (REQUIRED for camera access on mobile!)
- ✅ **No server management**
- ✅ **Easy updates** via git push
- ✅ **Custom domain** support (optional)

### Setup Steps:

1. **Create a GitHub repository**
   ```powershell
   # You've already initialized git locally
   # Now create a new repo on GitHub.com
   ```

2. **Push your code**
   ```powershell
   git remote add origin https://github.com/YOUR_USERNAME/virtualTrailRun.git
   git branch -M main
   git push -u origin main
   ```

3. **Enable GitHub Pages**
   - Go to your repo on GitHub.com
   - Click **Settings** > **Pages**
   - Under "Source", select **main** branch
   - Click **Save**
   - Your site will be live at: `https://YOUR_USERNAME.github.io/virtualTrailRun/`

4. **Test on mobile**
   - Open the GitHub Pages URL on your phone
   - Allow camera permissions
   - Start testing!

### Update workflow:
```powershell
git add .
git commit -m "Updated feature X"
git push
# Changes go live in ~1 minute
```

---

## 🏠 Option 2: Local Network Testing (Quick but Limited)

### Using ngrok (Exposes local server with HTTPS)

1. **Install ngrok**
   ```powershell
   # Download from https://ngrok.com/download
   # Or use chocolatey:
   choco install ngrok
   ```

2. **Start local server**
   ```powershell
   cd d:\src\virtualTrailRun
   python -m http.server 8000
   ```

3. **In another terminal, expose with ngrok**
   ```powershell
   ngrok http 8000
   ```

4. **Use the HTTPS URL provided** (e.g., `https://abc123.ngrok.io`)
   - Camera ONLY works with HTTPS!
   - Share this URL with your mobile device
   - ngrok free tier has session limits

### Using VS Code Port Forwarding (Requires VS Code account)

1. **Start local server**
   ```powershell
   python -m http.server 8000
   ```

2. **Forward the port in VS Code**
   - Open "Ports" panel (View > Ports)
   - Click "Forward a Port"
   - Enter `8000`
   - Set visibility to "Public"
   - Copy the forwarded URL (will be HTTPS)

---

## ☁️ Option 3: Cloud Hosting (Production-Ready)

### Netlify (Easiest, Free Tier)
```powershell
# Install Netlify CLI
npm install -g netlify-cli

# Deploy from your directory
cd d:\src\virtualTrailRun
netlify deploy --prod
```

### Vercel
```powershell
# Install Vercel CLI
npm install -g vercel

# Deploy
cd d:\src\virtualTrailRun
vercel --prod
```

### AWS S3 + CloudFront (More complex, but scalable)
- Good for production, but overkill for testing
- Requires AWS account setup
- More configuration needed

---

## 🎯 My Recommendation for Your Workflow

### **For Development/Testing:**
Use **GitHub Pages** because:
1. **One-time setup**, then just git push to update
2. **Always accessible** - test from anywhere
3. **HTTPS by default** - camera works without certificate hassles
4. **Free forever** for public repos
5. **Share easily** - send link to testers

### **Quick local testing workflow:**
```powershell
# 1. Make changes to your files

# 2. Test locally (optional quick check)
python -m http.server 8000
# Note: Camera won't work on mobile via local IP (needs HTTPS)

# 3. Push to GitHub Pages
git add .
git commit -m "Description of changes"
git push

# 4. Test on mobile at your GitHub Pages URL
```

---

## ⚠️ Important: HTTPS Requirement

**Camera access REQUIRES HTTPS** on mobile browsers!

| Method | HTTPS? | Camera Works? |
|--------|--------|---------------|
| `http://localhost:8000` | ❌ | ✅ (localhost exception) |
| `http://192.168.1.x:8000` | ❌ | ❌ (blocked by browser) |
| GitHub Pages | ✅ | ✅ |
| ngrok | ✅ | ✅ |
| VS Code Port Forward | ✅ | ✅ |
| Netlify/Vercel | ✅ | ✅ |

---

## 🔧 Alternative: Local Testing on Same Device

If you have a Windows device with a camera (laptop with webcam):
```powershell
cd d:\src\virtualTrailRun
python -m http.server 8000
# Open http://localhost:8000 on same machine
# Camera will work on localhost
```

---

## 📱 Testing Checklist

Once deployed, test on your mobile device:

- [ ] Page loads correctly
- [ ] Camera permission prompt appears
- [ ] Camera feed displays (mirrored)
- [ ] Face mesh overlay shows
- [ ] Video plays and can go fullscreen
- [ ] Head movement detection works
- [ ] Stats update in real-time
- [ ] No console errors (use mobile browser dev tools)

---

## 🐛 Troubleshooting

### "Camera not working on mobile"
- ✅ Ensure you're using HTTPS
- ✅ Check camera permissions in browser settings
- ✅ Try refreshing the page
- ✅ Check browser console for errors

### "Video won't play"
- ✅ Tap the video (some browsers require user interaction)
- ✅ Check YouTube video IDs are valid
- ✅ Ensure stable internet connection

### "Page won't load"
- ✅ Check GitHub Pages is enabled
- ✅ Wait 1-2 minutes after pushing changes
- ✅ Clear browser cache
- ✅ Check repo is public (or you're logged in if private)

---

## Next Steps

1. **Create GitHub repository** at https://github.com/new
2. **Push your code** using the commands above
3. **Enable GitHub Pages** in repo settings
4. **Test on your mobile device**
5. **Iterate and improve** based on real-device testing

Good luck with testing! 🏃‍♂️📱
