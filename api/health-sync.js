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
    const { syncToken, date, steps, sleep, activeBurn } = req.body;

    if (!syncToken) {
      return res.status(401).json({ error: 'Unauthorized: Missing syncToken' });
    }
    if (!date) {
      return res.status(400).json({ error: 'Bad Request: Missing date (YYYY-MM-DD)' });
    }

    const db = admin.firestore();
    
    // Find the user with this syncToken
    const usersSnapshot = await db.collection('users')
      .where('profile.syncToken', '==', syncToken)
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      return res.status(401).json({ error: 'Unauthorized: Invalid syncToken' });
    }

    const userId = usersSnapshot.docs[0].id;

    // Update the user's daily log
    const logRef = db.collection('users').doc(userId).collection('dailyLogs').doc(date);
    
    const updateData = {};
    if (steps !== undefined && steps !== null) updateData.steps = parseInt(steps, 10);
    if (sleep !== undefined && sleep !== null) updateData.sleep = parseFloat(sleep);
    if (activeBurn !== undefined && activeBurn !== null) updateData.activeBurn = parseInt(activeBurn, 10);

    // Merge true ensures we don't overwrite other data like recipes/notes
    await logRef.set(updateData, { merge: true });

    return res.status(200).json({ success: true, message: 'Health data synced successfully!' });
  } catch (error) {
    console.error('Health Sync Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
