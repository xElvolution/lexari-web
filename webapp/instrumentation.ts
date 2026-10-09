/** Server start: a light hourly job that reminds people (with push on) about today's mystery box, and the agent task
 * poller (meetings, background jobs, schedules) every 15 s. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production") return;
  const run = () => import("./server/notify").then((m) => m.boxReminders()).catch((e) => console.error(`[notify] box reminders ${(e as Error)?.message}`));
  setTimeout(run, 60_000);
  setInterval(run, 60 * 60_000).unref?.();
  const tasks = () => import("./server/tasks/tasks").then((m) => m.tick()).catch((e) => console.error(`[tasks] tick ${(e as Error)?.message}`));
  setTimeout(tasks, 20_000);
  setInterval(tasks, 15_000).unref?.();
}
