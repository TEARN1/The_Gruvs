# 🌌 THE GRUVS — Royal Discovery Engine

![The Gruvs Banner](https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&h=400&fit=crop)

> **"Discover your next event. I got you."**

**The Gruvs** is a premium, high-performance event discovery platform built with **React Native**, **Expo**, and **Supabase**. It features a state-of-the-art **Liquid Glass** design system, offering a fluid and immersive user experience across Web, iOS, and Android.

---

## ✨ Key Features

*   **⚡ The Drop:** Real-time feed of the hottest events nearby.
*   **🧩 Smart Discovery:** Personalised event ranking based on follows and interests.
*   **🔮 Liquid Glass UI:** A stunning, translucent interface with dynamic aura effects.
*   **🛠 Advanced Socials:** Vibes (likes), Echoes (comments), Reactions, and Check-ins.
*   **📍 Spatial Search:** PostGIS-powered nearby search with weighted full-text ranking.
*   **🎭 Multi-Theme:** Gender-curated themes (Royal Obsidian, Steel Navy, Rose Noir, etc.).
*   **🔔 Real-time Notifications:** Instant alerts for social interactions.

---

## 🛠 Tech Stack

*   **Frontend:** React Native (Expo SDK 51)
*   **Styling:** Vanilla StyleSheet with Liquid Glass abstractions
*   **Backend:** Supabase (PostgreSQL + PostGIS + RLS)
*   **Authentication:** Supabase Auth (Email & Social)
*   **Storage:** Supabase Storage (Media CDN)
*   **Deployment:** Vercel (Web) / EAS (Mobile)

---

## 🚀 Getting Started

### 1. Prerequisites
*   Node.js (v18+)
*   Expo Go (for mobile testing)

### 2. Installation
```bash
git clone https://github.com/TEARN1/The_Gruvs.git
cd the-gruvs-simple
npm install
```

### 3. Environment Setup
Create a `.env` file in the root directory:
```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Database Schema
Run the SQL found in `supabase_schema.sql` in your Supabase SQL Editor to initialize tables, functions, and RLS policies.

### 5. Run Locally
```bash
npm run start # Expo Go
npm run web   # Web Browser
```

---

## 🎨 Design Philosophy
The Gruvs follows the **Liquid Glass** aesthetic:
1.  **Depth:** Multilayered translucency and high-radius blurs.
2.  **Glow:** Subtle aura effects behind primary interactive elements.
3.  **Fluidity:** Spring-based animations and shared element transitions.
4.  **Premium Typography:** Modern, high-weight headings for a royal feel.

---

## 🛡 License
This project is for demonstration purposes. All rights reserved.

---
Built with 💎 by **The Gruvs Team**
