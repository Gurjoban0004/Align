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

// ─── Metric Name → Align Field Mappings ───
const METRIC_MAP = {
  step_count: 'steps',
  body_mass: 'weight',
  active_energy: 'activeBurn',
  dietary_energy: 'calories',
  dietary_protein: 'protein',
  dietary_carbohydrates: 'carbs',
  dietary_fat_total: 'fat',
  dietary_water: 'water',
  heart_rate: 'heartRate',
  resting_heart_rate: 'restingHeartRate',
  respiratory_rate: 'respiratoryRate',
  blood_oxygen_saturation: 'bloodOxygen',
  body_fat_percentage: 'bodyFat',
};

function extractDate(dateStr) {
  if (!dateStr) return null;
  const match = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function mlToCups(ml) {
  return Math.round((ml / 236.588) * 10) / 10;
}

function lbsToKg(lbs) {
  return Math.round(lbs * 0.453592 * 10) / 10;
}

function processMetric(metric) {
  const result = {};

  if (metric.name === 'sleep_analysis') {
    const sleepByDate = {};
    (metric.data || []).forEach(entry => {
      const date = extractDate(entry.date);
      if (!date || !entry.qty) return;
      const val = (entry.value || '').toLowerCase();
      if (val.includes('asleep') || val.includes('core') || val.includes('deep') || val.includes('rem') || entry.qty > 0) {
        if (!sleepByDate[date]) sleepByDate[date] = 0;
        sleepByDate[date] += parseFloat(entry.qty) || 0;
      }
    });
    Object.entries(sleepByDate).forEach(([date, hours]) => {
      if (!result[date]) result[date] = {};
      result[date].sleep = Math.round(hours * 10) / 10;
    });
    return result;
  }

  const alignField = METRIC_MAP[metric.name];
  if (!alignField) return result;

  const needsAverage = ['heart_rate', 'resting_heart_rate', 'respiratory_rate', 'blood_oxygen_saturation', 'body_fat_percentage'];

  if (needsAverage.includes(metric.name)) {
    const sumByDate = {};
    const countByDate = {};
    (metric.data || []).forEach(entry => {
      const date = extractDate(entry.date);
      if (!date || entry.qty == null) return;
      if (!sumByDate[date]) { sumByDate[date] = 0; countByDate[date] = 0; }
      sumByDate[date] += parseFloat(entry.qty) || 0;
      countByDate[date]++;
    });
    Object.entries(sumByDate).forEach(([date, sum]) => {
      if (!result[date]) result[date] = {};
      result[date][alignField] = Math.round(sum / countByDate[date] * 10) / 10;
    });
    return result;
  }

  (metric.data || []).forEach(entry => {
    const date = extractDate(entry.date);
    if (!date || entry.qty == null) return;
    if (!result[date]) result[date] = {};

    let value = parseFloat(entry.qty) || 0;

    if (metric.name === 'dietary_water') {
      const units = (metric.units || '').toLowerCase();
      if (units === 'ml' || units === 'milliliters') {
        value = mlToCups(value);
      }
    }
    if (metric.name === 'body_mass') {
      const units = (metric.units || '').toLowerCase();
      if (units === 'lbs' || units === 'lb') {
        value = lbsToKg(value);
      }
    }

    if (result[date][alignField] == null) {
      result[date][alignField] = 0;
    }
    result[date][alignField] += value;
  });

  Object.keys(result).forEach(date => {
    if (result[date][alignField] != null) {
      result[date][alignField] = Math.round(result[date][alignField] * 10) / 10;
    }
  });

  return result;
}

export default async function handler(req, res) {
  // Add CORS headers to allow requests from anywhere (like an Apple Shortcut or third party app)
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
    // Robustly parse body in case Content-Type is not set to application/json by the client
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        // Not a JSON string
      }
    } else if (Buffer.isBuffer(body)) {
      try {
        body = JSON.parse(body.toString('utf8'));
      } catch (e) {
        // Not a JSON buffer
      }
    }

    // Default payload fallback
    if (!body || typeof body !== 'object') {
      body = {};
    }

    const syncToken = req.query.token || req.query.syncToken || body.syncToken || body.SyncToken;

    if (!syncToken) {
      return res.status(401).json({ error: 'Unauthorized: Missing syncToken' });
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

    // ─── 1. Health Auto Export Webhook Payload Format ───
    const metrics = body?.data?.metrics;
    if (metrics && Array.isArray(metrics)) {
      const aggregated = {};
      metrics.forEach(metric => {
        const processed = processMetric(metric);
        Object.entries(processed).forEach(([dateStr, fields]) => {
          if (!aggregated[dateStr]) aggregated[dateStr] = {};
          Object.assign(aggregated[dateStr], fields);
        });
      });

      const batch = db.batch();
      const dates = Object.keys(aggregated);

      for (const dStr of dates) {
        const updateData = aggregated[dStr];
        if (Object.keys(updateData).length > 0) {
          updateData._healthSynced = true;
          updateData._healthSyncTime = new Date().toISOString();
          
          const logRef = db.collection('users').doc(userId).collection('dailyLogs').doc(dStr);
          batch.set(logRef, updateData, { merge: true });
        }
      }

      await batch.commit();
      return res.status(200).json({ success: true, message: `Synced Health Auto Export: ${dates.length} date(s)` });
    }

    // ─── 2. Flat Apple Shortcut Payload Format ───
    let date = body.date || body.Date;
    const rawSteps = body.steps || body.Steps || body.Number; // Fallback if they left the default 'Number' key
    const rawSleep = body.sleep || body.Sleep;
    const rawActiveBurn = body.activeBurn || body.ActiveBurn || body.activeburn;

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
        receivedBody: body
      });
    }

    updateData._healthSynced = true;
    updateData._healthSyncTime = new Date().toISOString();

    const logRef = db.collection('users').doc(userId).collection('dailyLogs').doc(date);
    await logRef.set(updateData, { merge: true });

    return res.status(200).json({ success: true, message: 'Health data synced successfully!' });
  } catch (error) {
    console.error('Health Sync Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
