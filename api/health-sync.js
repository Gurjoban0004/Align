const admin = require('firebase-admin');
const { parseHealthPayload } = require('./health-payload.cjs');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const payload = parseHealthPayload(req.body);
  if (payload.error) return res.status(payload.status).json({ error: payload.error });
  try {
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
      }) });
    }
    const db = admin.firestore();
    const users = await db.collection('users').where('profile.syncToken', '==', payload.syncToken).limit(1).get();
    if (users.empty) return res.status(401).json({ error: 'Invalid syncToken' });
    const logRef = db.collection('users').doc(users.docs[0].id).collection('dailyLogs').doc(payload.date);
    // Daily totals replace prior totals, so retries cannot double-count steps.
    await logRef.set({ ...payload.updateData, healthSyncedAt: new Date().toISOString() }, { merge: true });
    return res.status(200).json({ success: true, date: payload.date, message: 'Health data synced successfully!' });
  } catch (error) {
    console.error('Health sync failed:', error.code || 'unknown');
    return res.status(500).json({ error: 'Health sync unavailable. Check server configuration.' });
  }
}
