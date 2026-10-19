function parseHealthPayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Expected a JSON object.', status: 400 };
  const syncToken = body.syncToken ?? body.SyncToken;
  if (typeof syncToken !== 'string' || syncToken.length < 16 || syncToken.length > 256) return { error: 'Missing or invalid syncToken.', status: 401 };
  const date = body.date ?? body.Date;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date) return { error: 'Use a valid local date formatted YYYY-MM-DD.', status: 400 };
  const updateData = {};
  const fields = [
    ['steps',body.steps ?? body.Steps ?? body.Number,200000,true],
    ['sleep',body.sleep ?? body.Sleep,24,false],
    ['activeBurn',body.activeBurn ?? body.ActiveBurn ?? body.activeburn,30000,true]
  ];
  for (const [key,raw,max,round] of fields) {
    if (raw === undefined || raw === null) continue;
    if (typeof raw !== 'number' && (typeof raw !== 'string' || !/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(raw.trim()))) return {error:`Invalid ${key}. Send a non-negative number.`,status:400};
    const value=typeof raw==='number'?raw:Number(raw.trim().replaceAll(',',''));
    if (!Number.isFinite(value) || value < 0 || value > max) return {error:`Invalid ${key}. Expected a value between 0 and ${max}.`,status:400};
    updateData[key]=round?Math.round(value):value;
  }
  if (!Object.keys(updateData).length) return {error:'Send steps, sleep or activeBurn.',status:400};
  return {syncToken,date,updateData};
}
module.exports = { parseHealthPayload };
