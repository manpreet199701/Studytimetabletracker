// Firebase Auto-Sync Module
// This syncs your data to Firebase Firestore automatically

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getFirestore, doc, setDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

let db = null;
let userId = null;

// Initialize Firebase if configured
if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  userId = localStorage.getItem('user_id');
}

// Auto-sync function
export async function syncToCloud() {
  if (!db || !userId) return;
  
  try {
    const data = {
      studyLog: JSON.parse(localStorage.getItem('cfa_study_log') || '[]'),
      dailyGoal: localStorage.getItem('cfa_daily_goal') || '3',
      completed: JSON.parse(localStorage.getItem('cfa_completed') || '{}'),
      customSubjects: JSON.parse(localStorage.getItem('cfa_custom_subjects') || '[]'),
      subjectOverlays: JSON.parse(localStorage.getItem('cfa_subject_overlays') || '{}'),
      lastSync: new Date().toISOString()
    };
    
    await setDoc(doc(db, 'users', userId), data);
    console.log('Data synced to cloud');
  } catch (error) {
    console.error('Sync failed:', error);
  }
}

// Sync every time localStorage changes
window.addEventListener('storage', syncToCloud);

// Sync when page loads
if (userId) {
  syncToCloud();
}
