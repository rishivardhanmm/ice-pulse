/**
 * Runs once when the Next.js server boots — in both `next dev` and the production
 * custom server (app.js). Starts the in-process sync scheduler here so it works the
 * same way locally and on Plesk without depending on app.js specifically.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startScheduler } = await import('./server/services/scheduler.service');
    startScheduler();
  }
}
