# iPhone steps → Align

Align is a PWA. Safari does not expose HealthKit, so installing the website on the Home Screen does not grant Apple Health access. Use a bridge on the iPhone.

## Best long-term option: a small native HealthKit bridge

Keep the current web app, and package it with a native shell such as Capacitor, or build a small Swift companion. The bridge should:

1. Request read-only permission for `HKQuantityTypeIdentifier.stepCount`.
2. Query daily totals with `HKStatisticsQuery` / `HKStatisticsCollectionQuery` and `.cumulativeSum`. Anchor days to the user's local calendar midnight and let HealthKit merge sources. Do not add raw overlapping iPhone and Watch samples together.
3. Send `{date, steps}` over HTTPS using the signed-in user's Firebase ID token to an authenticated endpoint. Verify the ID token server-side and write only that user's daily log. The current Shortcut endpoint instead uses a private sync token; do not treat the public Firebase API key as authentication.
4. Refresh on foreground entry; observe changes with `HKObserverQuery` and request HealthKit background delivery with the required entitlement. Retry after unlock/network recovery, persist failed uploads, and re-query recent days so late Watch syncs or deletions correct earlier totals.
5. Store daily totals by date and overwrite on retry rather than incrementing. Display the last successful sync, not a claim of continuous live tracking.

Apple limits step-count background delivery to at most hourly. iOS scheduling and locked-device data protection mean background updates are not guaranteed to arrive immediately. Foreground refresh and retries remain necessary. Test on a real iPhone; a PWA-only solution cannot provide these native capabilities.

This is a recommended next implementation, not a native bridge included in this change.

## Free bridge for the existing PWA: Apple Shortcuts

The app already has a `POST /api/health-sync` endpoint. The upgrade validates input, preserves zero totals, rejects ambiguous dates, and records when the server receives a sync.

### Server prerequisites

Deploy the project to its existing Vercel project with `firebase-admin` installed and these server-only environment variables:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` (escaped newlines are supported)

Keep the service-account private key out of frontend code. Firestore rules must restrict `/users/{uid}` and its daily logs to that signed-in user; the Admin SDK bypasses those rules, so the webhook validates the sync token first. Sign in to Align, then open Settings → System for your sync token. Keep that token private: it authorizes health-log uploads to your account. Existing tokens remain valid; newly created tokens use cryptographic randomness.

The zero-dependency `npm start` development server serves static files only. It does **not** execute Vercel API routes.

### Shortcut request

Use your deployed Align origin, for example:

```text
POST https://YOUR-ALIGN-DOMAIN/api/health-sync
Content-Type: application/json
```

```json
{
  "syncToken": "YOUR_PRIVATE_TOKEN_FROM_SETTINGS",
  "date": "2026-10-19",
  "steps": 8432
}
```

- Format the date with `yyyy-MM-dd` using the iPhone's local timezone (lowercase `yyyy`, not week-year `YYYY`). Use the date of the total being sent, including for yesterday's catch-up.
- Send the **whole daily total**, not the increase since the last sync. Repeating the same upload is safe and does not double-count it.
- Optional numeric fields are `sleep` (hours) and `activeBurn` (kcal). Omit fields you are not syncing; do not send zero for missing/denied data.
- Check that the response has `success: true`; a shortcut showing “finished” by itself does not establish that the upload succeeded.

In Shortcuts, get today's step total from a Health statistics/aggregation action if your installed iOS provides one, then use **Get Contents of URL → POST → JSON** with the three keys above. Verify the result against Health's daily total. The existing shortcut linked in Settings is a starting point and has not been validated on a physical iPhone in this session.

If your Shortcuts version offers only **Find Health Samples**, do **not** blindly sum samples from every source: an Apple Watch and iPhone can record overlapping steps. Filtering to one device avoids cross-device duplication, but can omit steps and will not necessarily match Health's combined total. For matching totals across devices, use a native HealthKit statistics query or a health export app that explicitly aggregates the sources. Such an exporter may use a different JSON payload and needs an adapter; it is not automatically compatible with this endpoint.

### Automation and reliability

An **App → Is Opened** automation is useful because you are normally using an unlocked phone. Allow the shortcut to access Steps and the destination domain when iOS prompts. Test it manually while unlocked, then test the automation.

A time-of-day trigger can run automatically, but HealthKit reads can fail while the phone is locked. Do not rely on an unattended midnight upload as your only sync. Run again after unlocking and catch up yesterday as well as today. The request needs internet access; the Shortcut does not upload offline. For dependable queueing, catch-up and background behavior, build the native bridge above.

### Verify the full path

1. Unlock iPhone and compare the queried total to Apple Health.
2. Run the Shortcut and check `success: true`.
3. Open the matching date in Align. Steps should match; Fitness → Beyond the gym shows receipt time.
4. Repeat the identical upload: total should stay unchanged.
5. Test a later upload and a previous-day correction.
6. Test denied Health permission, locked device, offline network and invalid token, then confirm that a later successful run recovers.

## Primary references

- [Apple HealthKit](https://developer.apple.com/documentation/healthkit)
- [HealthKit statistics merge sources](https://developer.apple.com/documentation/healthkit/hkstatistics)
- [Statistics collection queries](https://developer.apple.com/documentation/healthkit/executing-statistics-collection-queries)
- [Background delivery and hourly step limit](https://developer.apple.com/documentation/healthkit/hkhealthstore/enablebackgrounddelivery(for:frequency:withcompletion:))
- [Apple Health data protection](https://support.apple.com/en-in/guide/security/sec88be9900f/web)
- [Locked HealthKit database error](https://developer.apple.com/documentation/healthkit/hkerror/errordatabaseinaccessible)
