# The Gruvs - Issue Fixes & Checklist

## ✅ COMPLETED TASKS

### 1. AI Components - HIDDEN ✓
All AI features have been disabled and hidden from the UI:
- **App.js**: AIAssistant import commented out, component not rendered
- **ProfilePage.js**: AI bio generation button removed, AI options picker hidden
- **PostEventModal.js**: AI fill step removed (starts at step 1 now)

### 2. Trending Events - ADDED TO CREW FEED ✓  
- CrewFeedScreen now displays trending events in a "TRENDING" section
- TrendingManager.fetch(10) fetches top 10 trending events
- Renders between "Their Gruvs" and "Activity" sections

---

## 🔧 REMAINING FIXES REQUIRED

### Issue #1: Image/Picture Upload Not Working
**Problem**: Photos won't upload for profiles, galleries, events, messages

**Root Cause**: Missing or misconfigured Supabase Storage buckets

**Solution**: Run the SQL patch in Supabase

**Steps**:
1. Go to: https://supabase.com → Your Project → SQL Editor
2. Copy the ENTIRE contents of: `supabase_combined_schema.sql`
3. Paste into SQL Editor
4. Click "Run"
5. This will:
   - Create 4 storage buckets: `avatars`, `covers`, `event-media`, `chat_media`
   - Configure RLS (Row Level Security) policies for each bucket
   - Allow authenticated users to upload and public to view

**Verify Success**:
- Storage → Buckets: Should see 4 buckets listed
- Each bucket should have settings showing "Public" enabled
- File size limits should be set (5MB avatars, 10MB chat, 100MB events)

**Files Involved**:
- `src/services/storageService.js` - Handles uploads
- `src/screens/ProfilePage.js` - Avatar & gallery uploads (lines 899-920)
- `src/components/DirectMessageModal.js` - Message image uploads (line 463)
- `src/components/PostEventModal.js` - Event media uploads (line 131)

---

### Issue #2: Messaging System Not Working
**Problem**: Users can't send/receive direct messages

**Root Cause**: Likely RLS (Row Level Security) policies not configured

**Solution**: Verify and run the supabase_combined_schema.sql

**The Patch Sets Up**:
- Messages table with required columns (message_type, media_url, parent_id, is_request, etc.)
- RLS policies allowing:
  - Message sender and recipient to read messages
  - Authenticated users to send messages
  - Participants to update messages

**Verification Steps**:
1. In Supabase → SQL Editor, run:
   ```sql
   SELECT * FROM messages LIMIT 1;
   ```
   Should show columns: id, sender_id, recipient_id, body, message_type, media_url, is_request, request_accepted, read_at, delivered_at, deleted_at

2. Check RLS policies: Database → Messages → Policies tab
   Should see 3 policies:
   - "Message participants can read"
   - "Users send own messages"  
   - "Users update own messages"

**If Still Not Working**:
- Check Supabase Auth → Users are created correctly
- Verify user can insert into `messages` table directly
- Check toast notifications for specific error messages
- Look at browser console for exact error

**Files Involved**:
- `src/services/dataFlow.js` - MessageManager (lines 1163+)
- `src/components/DirectMessageModal.js` - UI for messaging
- `src/screens/ChatsScreen.js` - Conversation list

---

### Issue #3: SQL Schema Verification
**Status**: Schema file exists but patch may not be applied

**What the Patch Does**:
1. **Profiles Table**: Adds 30+ columns for user data
   - avatar_url, bio, location, interests, vibe_score, etc.
2. **Messages Table**: Adds columns for messaging system
   - message_type, media_url, is_request, read_at, etc.
3. **Storage Buckets**: Creates 4 buckets with RLS policies
4. **RLS Policies**: Enables row-level security on all tables
5. **Functions**: Updates search_path for security

**Verify Applied**:
1. Go to Supabase → SQL Editor
2. Run:
   ```sql
   -- Check messages table has all columns
   SELECT column_name FROM information_schema.columns 
   WHERE table_name='messages' 
   ORDER BY column_name;
   ```
   Should show ~15+ columns including: media_url, is_request, message_type, read_at, delivered_at

3. Run:
   ```sql
   -- Check storage buckets exist
   SELECT id, name, public FROM storage.buckets 
   WHERE id IN ('avatars', 'covers', 'event-media', 'chat_media');
   ```
   Should return 4 rows

4. Run:
   ```sql
   -- Check RLS enabled on messages
   SELECT relname, relrowsecurity 
   FROM pg_class WHERE relname='messages';
   ```
   Should show: relrowsecurity = true

---

## 🚀 QUICK FIX CHECKLIST

- [ ] **Step 1**: Copy `supabase_combined_schema.sql` content
- [ ] **Step 2**: Paste into Supabase → SQL Editor
- [ ] **Step 3**: Click "Run" and wait for completion
- [ ] **Step 4**: Verify buckets in Storage section
- [ ] **Step 5**: Test uploading a profile picture
- [ ] **Step 6**: Test sending a direct message
- [ ] **Step 7**: Verify trending events show on Crew Feed

---

## 📋 FULL STATUS

| Feature | Status | Notes |
|---------|--------|-------|
| AI Components | ✅ Hidden | Fully disabled in UI |
| Trending Events | ✅ Added | Shows in Crew Feed |
| Image Uploads | 🔧 Needs Patch | Blocked by missing buckets |
| Direct Messaging | 🔧 Needs Patch | Blocked by missing RLS |
| SQL Schema | 🔧 Needs Patch | Patch file ready to apply |
| Database Buckets | 🔧 Needs Patch | Created by patch script |

---

## 📞 SUPPORT NOTES

If uploads still fail after running patch:
1. Check bucket names in `storageService.js` match bucket names in Supabase
2. Verify authenticated user token is valid
3. Check file size doesn't exceed bucket limits
4. Try uploading through Supabase dashboard directly to test bucket access
5. Check browser console for CORS errors

If messaging still fails:
1. Verify both users are authenticated
2. Check that sender_id and recipient_id are valid UUIDs
3. Try creating a message directly in Supabase SQL editor
4. Look for "row-level security" errors in app toast notifications
5. Verify RLS policies allow authenticated users

---

## 📝 FILES MODIFIED IN THIS SESSION

1. **App.js**
   - Commented out AIAssistant import
   - Removed AIAssistant component rendering

2. **ProfilePage.js**
   - Removed AI bio generation function
   - Hid AI bio options picker UI

3. **PostEventModal.js**
   - Removed AI fill step (step 0)
   - Changed initial step from 0 to 1
   - Commented out aiDescription and aiLoading state

4. **CrewFeedScreen.js**
   - Added TrendingManager import
   - Added trendingEvents state
   - Integrated TrendingManager.fetch() in loadAll()
   - Added TRENDING section rendering

---

**Last Updated**: 2026-05-14
**Version**: 1.0
