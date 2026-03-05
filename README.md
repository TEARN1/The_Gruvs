# The Gruvs 🚀

A cross-platform React Native app (mobile + web) built with Expo for managing events and tasks.

## 🌐 Quick Deploy (Web - No Expo Account Needed)
1. **Push to GitHub**: (Already done! ✅)
2. **Connect to Vercel**:
   - Go to [vercel.com](https://vercel.com) and import your repo.
   - **Environment Variables**: Add `EXPO_PUBLIC_API_URL` with your deployment URL.
3. **Live!**: Your app will be accessible via a URL like `the-gruvs.vercel.app`.

---

## 📱 Mobile Testing (Expo Go)
You can test on your physical device without an Expo account:
1. Install **Expo Go** from the App Store/Play Store.
2. Run `npm start` in this folder.
3. Scan the QR code with your phone camera.

---

## 🏗 Project Status
- **Web**: Configured for Vercel with serverless API support.
- **Mobile**: Ready for production build (Requires EAS CLI & Account).
- **Backend**: Serverless API at `/api/events` (Note: Currently volatile/stateless).

---

## 🚧 Next Mission: "Persistent Data"
Since the web version is ready to go, the next logical step is to stop the data from disappearing:
1. Set up a **Supabase** or **MongoDB** database.
2. Update `api/events.js` to save items to the database instead of a local variable.

---

## ⚙️ Development
```bash
npm install
npm run web    # Preview Web
npm start      # Preview Mobile (Expo Go)
```
