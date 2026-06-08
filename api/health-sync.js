const admin = require('firebase-admin');

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Replace escaped newlines with actual newlines
        privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
      }),
    });
  } catch (error) {
    console.error('Firebase admin initialization error', error.stack);
  }
}

export default async function handler(req, res) {
  // Add CORS headers to allow requests from anywhere (like an Apple Shortcut)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const syncToken = req.body.syncToken || req.body.SyncToken;
    let date = req.body.date || req.body.Date;
    const rawSteps = req.body.steps || req.body.Steps || req.body.Number; // Fallback if they left the default 'Number' key
    const rawSleep = req.body.sleep || req.body.Sleep;
    const rawActiveBurn = req.body.activeBurn || req.body.ActiveBurn || req.body.activeburn;

    if (!syncToken) {
      return res.status(401).json({ error: 'Unauthorized: Missing syncToken' });
    }
    if (!date) {
      return res.status(400).json({ error: 'Bad Request: Missing date (YYYY-MM-DD)' });
    }

    // Auto-fix Apple's messy localized date strings (e.g. "08/06/26, 12:00 PM")
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const d = new Date();
      d.setHours(d.getHours() + 5);
      d.setMinutes(d.getMinutes() + 30); // Approximate IST timezone
      date = d.toISOString().split('T')[0];
    }

    const db = admin.firestore();
    
    const usersSnapshot = await db.collection('users')
      .where('profile.syncToken', '==', syncToken)
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      return res.status(401).json({ error: 'Unauthorized: Invalid syncToken' });
    }

    const userId = usersSnapshot.docs[0].id;
    const logRef = db.collection('users').doc(userId).collection('dailyLogs').doc(date);
    
    const updateData = {};

    const parseNum = (val) => {
      if (val === undefined || val === null || val === '') return null;
      if (typeof val === 'number') return val;
      const cleaned = String(val).replace(/,/g, '');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? null : parsed;
    };

    const parsedSteps = parseNum(rawSteps);
    if (parsedSteps !== null) updateData.steps = Math.round(parsedSteps);

    const parsedSleep = parseNum(rawSleep);
    if (parsedSleep !== null) updateData.sleep = parsedSleep;

    const parsedBurn = parseNum(rawActiveBurn);
    if (parsedBurn !== null) updateData.activeBurn = Math.round(parsedBurn);

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ 
        error: 'Bad Request: No valid health data (steps, sleep, activeBurn) provided.',
        receivedBody: req.body
      });
    }

    // Merge true ensures we don't overwrite other data like recipes/notes
    await logRef.set(updateData, { merge: true });

    return res.status(200).json({ success: true, message: 'Health data synced successfully!' });
  } catch (error) {
    console.error('Health Sync Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
