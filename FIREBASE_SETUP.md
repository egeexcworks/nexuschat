# Nexus Chat - Firebase Setup Guide

## Overview
This project now uses Firebase for:
- **Authentication** (Email/Password)
- **Real-time Database** (Firestore)
- **User Storage** (Firestore)

## Project Structure
```
src/
├── firebase.js              # Firebase configuration
├── App.jsx                  # Updated with ProtectedRoute
├── Chat.jsx                 # Real-time chat with Firestore
├── Login.jsx                # Firebase Auth login
├── Signup.jsx               # Firebase Auth signup
├── pages/
│   ├── Chat.jsx            # Chat component
│   ├── Login.jsx            # Login component
│   ├── Signup.jsx           # Signup component
│   ├── Home.jsx             # Home component
│   └── ProtectedRoute.jsx   # Route protection wrapper
```

## Setup Instructions

### 1. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name (e.g., "Nexus Chat")
4. Complete setup

## Authentication Setup
✅ **Email/Password** - Enabled and implemented
✅ **Google Auth** - Enabled in Firebase Console (not yet implemented in app)

*Note: The current app only supports email/password login. Google sign-in can be added later if needed.*

### 3. Create Firestore Database
1. In Firebase Console, go to **Firestore Database**
2. Click **Create database**
3. Start in **Test mode** (for development)
4. Select a location (preferably close to you)

### 4. Get Firebase Credentials
1. In Firebase Console, go to **Project Settings** (gear icon)
2. Under **Your apps**, click **Web** (or create new web app)
3. Copy the Firebase config object
4. Fill in `.env.local` with these values:

```
VITE_FIREBASE_API_KEY=your_value
VITE_FIREBASE_AUTH_DOMAIN=your_value
VITE_FIREBASE_PROJECT_ID=your_value
VITE_FIREBASE_STORAGE_BUCKET=your_value
VITE_FIREBASE_MESSAGING_SENDER_ID=your_value
VITE_FIREBASE_APP_ID=your_value
```

### 5. Firestore Collections

The app expects these collections in Firestore:

#### `messages` collection
- **Structure**:
  ```json
  {
    "text": "message content",
    "userEmail": "user@example.com",
    "userName": "username",
    "userId": "firebase_user_uid",
    "timestamp": "Firestore timestamp"
  }
  ```

#### `users` collection
- **Structure**:
  ```json
  {
    "uid": "firebase_user_uid",
    "username": "chosen_username",
    "email": "user@example.com",
    "createdAt": "Firestore timestamp"
  }
  ```

## Features Implemented

### Authentication
✅ Signup with email & password
✅ Login with email & password
✅ User profile storage in Firestore
✅ Error handling & validation

### Chat System
✅ Real-time message streaming (onSnapshot)
✅ Send messages to Firestore
✅ Display messages with user info
✅ Timestamps for each message
✅ User identification (own messages highlighted)

### Security
✅ Protected /chat route (redirects to /login if not authenticated)
✅ Auth state listener
✅ User context available in Chat component

## Running the App

```bash
cd client
npm install              # Install dependencies
npm run dev             # Start development server
```

The app will open at `http://localhost:5173`

## Firestore Security Rules (Production Mode)

Since you started your database in **production mode**, you need to set proper security rules. Go to **Firestore Database > Rules** in Firebase Console and update them:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /messages/{docId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
    }
    match /users/{userId} {
      allow read: if true;
      allow create: if request.auth.uid == userId;
      allow update: if request.auth.uid == userId;
    }
  }
}
```

**Important**: Without these rules, users won't be able to read/write messages!

## File Explanations

### firebase.js
Initializes Firebase with modular v9+ syntax. Uses environment variables for configuration.

### ProtectedRoute.jsx
Wraps protected routes. Checks authentication state and redirects to /login if not authenticated.

### Login.jsx
- Email & password login
- Error handling
- Redirects to /chat on success

### Signup.jsx
- Create account with email & password
- Store username & email in Firestore
- Error handling
- Redirects to /chat on success

### Chat.jsx
- Real-time message display using Firestore onSnapshot
- Send messages to Firestore
- Auto-scroll to bottom
- Display user info & timestamps
- Logout functionality
- Discord-style dark theme

## Environment Variables
Create `.env.local` in the `client` folder with your Firebase credentials. This file is git-ignored and contains sensitive data.

## Next Steps (Optional Enhancements)

- [ ] User profiles/avatars
- [ ] Private messaging
- [ ] Channels/rooms
- [ ] Message reactions/emojis
- [ ] Typing indicators
- [ ] Online status
- [ ] Message editing/deletion
- [ ] File uploads
- [ ] Dark/Light theme toggle
- [ ] Search messages

## Troubleshooting

### "No messages yet" appears
- Make sure Firestore database is created and working
- Check browser console for errors
- Verify Firebase credentials in `.env.local`

### Login/Signup not working
- Check Firebase Authentication is enabled
- Verify email/password is correct
- Check browser console for specific error

### Messages not appearing
- Ensure user is authenticated (check console.log(auth.currentUser))
- Verify Firestore database is created
- Check Firestore security rules allow reads

### Build errors
- Run `npm install` in the client folder
- Delete `node_modules` and `package-lock.json`, then reinstall
