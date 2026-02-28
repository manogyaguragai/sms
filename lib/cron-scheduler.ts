import cron from 'node-cron';

let isScheduled = false;

/**
 * Starts the daily cron scheduler for reminder notifications.
 * Runs at 4:15 AM UTC (10:00 AM NPT) every day.
 * 
 * This replaces the Vercel-specific vercel.json cron config
 * and works on any hosting platform (Render, Railway, etc).
 */
export function startCronScheduler() {
  if (isScheduled) {
    console.log('[Cron] Scheduler already running, skipping duplicate init.');
    return;
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[Cron] CRON_SECRET not set. Cron scheduler will not start.');
    return;
  }

  const rawUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000';
  const appUrl = rawUrl.replace(/\/+$/, ''); // strip trailing slashes

  // Run daily at 4:15 AM UTC = 10:00 AM NPT (Nepal Standard Time, UTC+5:45)
  cron.schedule('15 4 * * *', async () => {
    console.log(`[Cron] Running daily reminder check at ${new Date().toISOString()}`);

    try {
      const response = await fetch(`${appUrl}/api/cron/reminders`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${cronSecret}`,
        },
      });

      const data = await response.json();

      if (response.ok) {
        console.log('[Cron] Reminder check completed:', JSON.stringify(data));
      } else {
        console.error('[Cron] Reminder check failed:', response.status, JSON.stringify(data));
      }
    } catch (error) {
      console.error('[Cron] Error calling reminder endpoint:', error);
    }
  }, {
    timezone: 'UTC',
  });

  isScheduled = true;
  console.log('[Cron] Scheduler started — daily reminders at 4:15 AM UTC (10:00 AM NPT)');
}
