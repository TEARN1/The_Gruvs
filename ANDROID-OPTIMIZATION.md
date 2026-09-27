# 📱 Android Performance Optimization Guide (Low-Spec Devices)

To ensure **The Gruvs** React Native application runs at a buttery-smooth **60 FPS** on mid-to-lower-tier Android devices (e.g., devices with 2GB-4GB RAM and older GPUs), follow these rendering, memory management, and animation best practices.

---

## 🏎️ Performance Emulation Script

We have provided a script to simulate low-spec mobile environments:
```bash
node scripts/profile-android-cpu.js
```
This tool throttles Chromium to **6x CPU slowdown** and restricts network to **Slow 3G** to profile frame rate drops (FPS) and layout freezes during swipes and navigation.

---

## 📋 The Android Optimization Checklist

### 1. Avoid Garbage Collection (GC) Churn in Animations
In React Native, garbage collection pauses (even brief ones of 20–50ms) cause noticeable micro-stutter (jank) during animations.
* [ ] **Use Native Driver**: Always pass `useNativeDriver: true` for layout animations that do not involve layout properties (like width/height).
  ```javascript
  Animated.timing(fadeAnim, {
    toValue: 1,
    duration: 300,
    useNativeDriver: true, // Offloads animation to the native OS thread
  }).start();
  ```
* [ ] **No Inline Objects in Render**: Declaring styles, arrays, or anonymous functions inside render blocks creates new object allocations on every frame tick, triggering the JS garbage collector.
  * *Bad:* `<View style={{ padding: 10, margin: active ? 5 : 0 }} />`
  * *Good:* Combine styles with static sheets: `<View style={[styles.container, active && styles.active]} />`
* [ ] **Memoize Callbacks and Computations**: Wrap expensive calculations in `useMemo` and tap/press event handlers in `useCallback`.

### 2. FlatList & List View Optimization
Long lists of events or chat messages consume massive amounts of memory if not bounded.
* [ ] **Specify Key Extractors**: Ensure all lists declare unique, stable keys. Avoid using index.
  ```javascript
  keyExtractor={(item) => item.id}
  ```
* [ ] **Tune List Parameters**: Limit initial renders and window sizes.
  * `initialNumToRender={6}` (defaults to 10)
  * `windowSize={5}` (reduces off-screen rendering window, defaults to 21)
  * `maxToRenderPerBatch={8}` (lowers CPU burst loads)
* [ ] **Implement `getItemLayout`**: If list elements have fixed heights, providing `getItemLayout` skips dynamic layout measurement calculations.
* [ ] **Enable `removeClippedSubviews`**: Set to `true` to unmount off-screen list items from native parent views.

### 3. Media & Image Memory Footprint
High-resolution images can crash low-spec devices due to Out Of Memory (OOM) exceptions.
* [ ] **Downsize Render Layouts**: Use `expo-image` which handles thread-safe disk/memory caching, progressive loading, and auto-downscaling.
* [ ] **Serve WebP Assets**: Compress all server-uploaded media assets to `.webp` format, which uses up to 30% less memory than JPG/PNG.
* [ ] **Lazy Video Hydration**: For feed-like carousels (Reels), load the video player (`expo-av`) *only* for the active item. Render a static thumbnail placeholder for off-screen items.

### 4. Overdraw Prevention
Overdraw occurs when the application draws the same pixel multiple times in a single frame (e.g., nested backgrounds).
* [ ] **Remove Redundant Backgrounds**: Check nested containers. If a child view covers the entire parent container, remove the background color from the parent.
* [ ] **Verify Layouts via Developer Tools**: Turn on **"Show GPU Overdraw"** in the Android Developer Options menu to identify areas highlighted in deep red (indicating 4x+ overdraw).

### 5. Supabase Real-Time Throttling
Real-time database streams can flood the UI thread with state updates.
* [ ] **Throttle Updates**: Throttle rapid state updates (e.g., active user typing indicators or coordinates) to a maximum of one update every 200–500ms.
* [ ] **Strict Subscription Unmounting**: Always unsubscribe from Supabase channels inside `useEffect` cleanup returns:
  ```javascript
  useEffect(() => {
    const channel = supabase.channel('room-1').subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
  ```
