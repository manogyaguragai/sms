/**
 * Next.js Instrumentation — runs once when the server starts.
 * Used to initialize the in-process cron scheduler for reminders.
 * 
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Only run the cron scheduler on the server (not during build or in edge runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startCronScheduler } = await import('@/lib/cron-scheduler');
    startCronScheduler();
  }
}
