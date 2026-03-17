# 🚀 QUICK START GUIDE - THE GRUVS

## Installation & Setup

### Prerequisites
- Node.js 20.x or higher
- npm or yarn
- Expo CLI (optional but recommended)

### 1. Install Dependencies
```bash
cd "c:\Users\ACER\Desktop\The Gruvs"
npm install
```

### 2. Save Credentials (if using Supabase backend)
Create `.env.local`:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_key
EXPO_PUBLIC_API_URL=https://your-vercel-url.vercel.app
```

### 3. Run the App

#### Web (Recommended for Desktop)
```bash
npm run web
```
Opens at `http://localhost:19006`

#### Web Bundled (Production)
```bash
npm run build:web
```
Output in `dist/` folder

#### Mobile (iOS)
```bash
npm run ios
```

#### Mobile (Android)
```bash
npm run android
```

#### Start Dev Server
```bash
npm start
```
Scan QR code with Expo Go app

---

## 🎮 Using the App

### Authentication
1. **Sign Up**: Create account with email, password, gender, and interests
2. **Login**: Use saved credentials
3. **Skip Login**: Click "CONTINUE AS VISITOR" for browsing only

### Browse Events
1. **Search**: Type in search bar to find events
2. **Filter**: Click category pills (All, Church, Sports, Career, Tech, etc.)
3. **View Details**: Tap event card to expand

### Create Events
1. Click **➕** button in filter row
2. Fill in title, description, location, date/time
3. Click **Create Event**
4. Event appears in feed immediately

### Engage with Events
- **Like**: Click heart icon (❤️) to like event
- **RSVP**: Click star (⭐) to RSVP yes/no
- **Comment**: Type message and click Send

### Manage Profile
1. Tap **👤 Profile** in bottom navigation
2. Edit bio, email, gender, interests
3. Click **✏️ EDIT PROFILE**
4. **LOGOUT** to sign out

---

## 🎨 Features Overview

### Themes
- **Male**: Dark blue theme
- **Female**: Dark magenta theme
- **Other**: Deep purple theme
- **Prefer Not**: Neutral gray
- Auto-applies based on your gender selection

### Search
- Search event titles, author names, descriptions
- Real-time filtering
- Search suggestions (future feature)

### Engagement
- **50 Billionaire Events**: Elon Musk, Jeff Bezos, Warren Buffett, etc.
- **Live Metrics**: See likes, RSVPs, comments in real-time
- **Comments Section**: Collapsed/expandable comment threads
- **Topic Diversity**: Faith, Sports, Career, Social, Tech, Arts, Wellness, etc.

### Notifications
- Toast messages for all actions
- Success (green), Error (red), Info (blue), Warning (yellow)
- Auto-dismiss after 3.5 seconds

---

## 🔧 Troubleshooting

### App Won't Load
```bash
# Clear cache and reinstall
rm -rf node_modules
npm install
npm run web
```

### API Errors
- App automatically falls back to 50 billionaire demo events
- Check console for API endpoint errors
- Verify `.env.local` configuration

### Theme Not Changing
- Select gender in signup/profile
- Theme applies automatically
- Try refreshing the page

### Search Not Working
- Clear search field and try again
- Works on titles, authors, descriptions
- Case-insensitive matching

---

## 📱 Deployment

### Deploy to Vercel
```bash
npm run build:web
# Vercel automatically detects and deploys
```

### Deploy to Expo Go (Mobile)
```bash
npm start
# Scan QR code with Expo Go app on phone
```

### Deploy to App Store/Play Store
```bash
# Requires EAS credentials
eas build --platform ios
eas build --platform android
```

---

## 📊 File Structure

```
The Gruvs/
├── App.js                    # Main app (340+ lines)
├── package.json              # Dependencies
├── vercel.json               # Deployment config
│
├── api/
│   └── events.js             # Backend API (GET/POST/PATCH)
│
├── src/
│   ├── data.js               # Themes, categories, interests
│   ├── components.js         # Reusable UI components
│   ├── screens.js            # Auth & Profile screens
│   ├── storage.js            # Persistence & geolocation
│   ├── descriptors.js        # Character descriptors (2,100+)
│   └── billionaireSeedData.js # 50 billionaire events
│
├── dist/                     # Web build output
├── assets/                   # Images & icons
├── __tests__/                # Unit tests
└── IMPROVEMENTS.md           # What's new!
```

---

## 💡 Pro Tips

1. **Offline Mode**: Seed data loads automatically if API unavailable
2. **Search Focus**: Use category filters + search together
3. **Multiple Themes**: Change gender in profile to switch theme instantly
4. **Engagement Tracking**: Watch heat index update as events get engagement
5. **Mobile Testing**: Use Expo Go app for instant mobile preview

---

## 🐛 Report Issues

Issues or suggestions? Check `IMPROVEMENTS.md` for what's been added!

---

## 📞 Support

- **Questions?** Check the README.md
- **Bugs?** Enable console debugging
- **Feature Ideas?** See IMPROVEMENTS.md for next steps

---

## 🎉 Enjoy!

The Gruvs is ready to revolutionize social event discovery! 🚀

Made with ❤️ using React Native & Expo
