// =============================================================
// ALIGN v2 — Health Auto Export Webhook Handler
// Receives Apple Health data from the "Health Auto Export" iOS app
// and stores it as processed daily logs in data/health-latest.json
//
// Health Auto Export format:
// POST /api/health-sync?token=YOUR_TOKEN
// Body: { "data": { "metrics": [ { "name": "step_count", "units": "count", "data": [...] } ] } }
// =============================================================

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const HEALTH_FILE = path.join(DATA_DIR, 'health-latest.json');
const TOKEN_FILE = path.join(DATA_DIR, 'sync-token.json');

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

// Ensure data directory exists
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Load or generate the sync token
function getOrCreateToken() {
  ensureDataDir();
  if (fs.existsSync(TOKEN_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
      return data.token;
    } catch (e) {
      // fall through to generate
    }
  }
  const token = generateToken();
  fs.writeFileSync(TOKEN_FILE, JSON.stringify({ token, createdAt: new Date().toISOString() }));
  return token;
}

function generateToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Parse "2024-06-17 23:59:59 +0530" → "2024-06-17"
function extractDate(dateStr) {
  if (!dateStr) return null;
  const match = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

// Convert water from mL to cups (1 cup = 236.588 mL)
function mlToCups(ml) {
  return Math.round((ml / 236.588) * 10) / 10;
}

// Convert pounds to kg
function lbsToKg(lbs) {
  return Math.round(lbs * 0.453592 * 10) / 10;
}

// Process a single metric into { date: { field: value } }
function processMetric(metric) {
  const result = {};

  // ─── Sleep Analysis ───
  if (metric.name === 'sleep_analysis') {
    const sleepByDate = {};
    (metric.data || []).forEach(entry => {
      const date = extractDate(entry.date);
      if (!date || !entry.qty) return;
      // Only count asleep states, not "inBed"
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

  // ─── Standard Metrics ───
  const alignField = METRIC_MAP[metric.name];
  if (!alignField) return result;

  // For heart rate etc., compute daily average
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

  // Standard: sum per day
  (metric.data || []).forEach(entry => {
    const date = extractDate(entry.date);
    if (!date || entry.qty == null) return;
    if (!result[date]) result[date] = {};

    let value = parseFloat(entry.qty) || 0;

    // Unit conversions
    if (metric.name === 'dietary_water') {
      // Health auto export sends in mL usually
      const units = (metric.units || '').toLowerCase();
      if (units === 'ml' || units === 'milliliters') {
        value = mlToCups(value);
      } else {
        // Assume cups already
      }
    }
    if (metric.name === 'body_mass') {
      const units = (metric.units || '').toLowerCase();
      if (units === 'lbs' || units === 'lb') {
        value = lbsToKg(value);
      }
      // If already kg, use as-is
    }

    if (result[date][alignField] == null) {
      result[date][alignField] = 0;
    }
    result[date][alignField] += value;
  });

  // Round all values
  Object.keys(result).forEach(date => {
    if (result[date][alignField] != null) {
      result[date][alignField] = Math.round(result[date][alignField] * 10) / 10;
    }
  });

  return result;
}

// Merge incoming health data into the stored file
function mergeHealthData(incoming) {
  ensureDataDir();
  let stored = {};
  if (fs.existsSync(HEALTH_FILE)) {
    try {
      stored = JSON.parse(fs.readFileSync(HEALTH_FILE, 'utf8'));
    } catch (e) {
      stored = {};
    }
  }

  // Deep merge: health data wins for its specific fields
  Object.entries(incoming).forEach(([date, fields]) => {
    if (!stored[date]) stored[date] = {};
    Object.assign(stored[date], fields);
    stored[date]._lastHealthSync = new Date().toISOString();
  });

  fs.writeFileSync(HEALTH_FILE, JSON.stringify(stored, null, 2));
  return stored;
}

// ─── Main Handler ───

function handleHealthSync(req, res, token) {
  const validToken = getOrCreateToken();

  // Validate token
  if (!token || token !== validToken) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid or missing token' }));
    return;
  }

  // Collect request body
  let body = '';
  req.on('data', chunk => { body += chunk.toString(); });
  req.on('end', () => {
    try {
      const payload = JSON.parse(body);
      const metrics = payload?.data?.metrics || [];

      if (metrics.length === 0) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, message: 'No metrics received', processed: 0 }));
        return;
      }

      // Process each metric
      const aggregated = {};
      metrics.forEach(metric => {
        const processed = processMetric(metric);
        Object.entries(processed).forEach(([date, fields]) => {
          if (!aggregated[date]) aggregated[date] = {};
          Object.assign(aggregated[date], fields);
        });
      });

      const dateCount = Object.keys(aggregated).length;
      mergeHealthData(aggregated);

      console.log(`[Health Sync] ✓ Received ${metrics.length} metrics for ${dateCount} date(s)`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: true,
        message: `Synced ${metrics.length} metrics across ${dateCount} date(s)`,
        dates: Object.keys(aggregated),
      }));
    } catch (e) {
      console.error('[Health Sync] Parse error:', e.message);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
    }
  });
}

function handleGetHealthData(req, res) {
  ensureDataDir();
  if (!fs.existsSync(HEALTH_FILE)) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({}));
    return;
  }
  try {
    const data = fs.readFileSync(HEALTH_FILE, 'utf8');
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(data);
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Could not read health data' }));
  }
}

function handleGetToken(req, res) {
  const token = getOrCreateToken();
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify({ token }));
}

module.exports = { handleHealthSync, handleGetHealthData, handleGetToken, getOrCreateToken };
