import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, serverTimestamp } from 'firebase/firestore';
import { getAnalytics } from "firebase/analytics";
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyBAlgwfh3YqP83dM4kIDTVDmTmLizZUl_Y",
  authDomain: "smart-pad-box.firebaseapp.com",
  projectId: "smart-pad-box",
  storageBucket: "smart-pad-box.firebasestorage.app",
  messagingSenderId: "385818571107",
  appId: "1:385818571107:web:be74bd7e76719487902356",
  measurementId: "G-80F5WPGGV7"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const serverTime = () => serverTimestamp();

// HTTP POST endpoint handler for smart pad box
export const handlePadBoxData = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { unitId, weight_g, est_ml, imageUrl, timestamp } = req.body;

    // Validate required fields
    if (!unitId || weight_g === undefined || est_ml === undefined) {
      res.status(400).json({ 
        error: 'Missing required fields: unitId, weight_g, est_ml' 
      });
      return;
    }

    // Add measurement to hospital_measurements collection
    const measurementData = {
      unitId,
      weight_g: parseFloat(weight_g),
      est_ml: parseFloat(est_ml),
      imageUrl: imageUrl || null,
      timestamp: timestamp ? new Date(timestamp) : serverTime(),
      assigned: false,
      createdAt: serverTime()
    };

    // This would be handled by Firebase Functions in production
    // For now, we'll create a client-side function to handle this
    console.log('Pad box measurement received:', measurementData);

    res.status(200).json({ 
      success: true, 
      message: 'Measurement received successfully',
      data: measurementData 
    });

  } catch (error) {
    console.error('Error handling pad box data:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
};