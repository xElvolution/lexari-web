/** Agent tasks as the app sees them: meetings, long jobs, schedules, videos and deploys (server/tasks). */
export type TaskKind = "meeting" | "job" | "schedule" | "video" | "deploy";
export type TaskStatus = "running" | "waiting" | "done" | "failed" | "stopped" | "active" | "paused";
export type MeetPlatform = "zoom" | "meet" | "teams" | "jitsi";
export type TaskView = {
  id: string; kind: TaskKind; status: TaskStatus; title: string; agent: string; convo: string;
  /** what the job is doing now, e.g. joining, waiting, in_meeting, transcribing, rendering */
  phase?: string;
  /** a short line for failures or results */
  detail?: string;
  createdAt: number; finishedAt?: number;
  /** meetings: when the agent got in, how long it stayed, who it joined as */
  joinedAt?: number; secs?: number; mode?: "me" | "agent"; platform?: MeetPlatform; name?: string;
  /** schedules */
  every?: string; nextRun?: number; runs?: number;
  /** deploys / previews */
  link?: string;
};
/** A message card that points at a task (its live state comes from the tasks store). */
export type TaskRef = { id: string; kind: TaskKind; title: string };
/** The join card an agent offers for a meeting link: you pick as me / as my agent and tap Join. */
export type MeetAsk = { url: string; platform: MeetPlatform; as?: "me" | "agent"; taskId?: string; agentName?: string; userName?: string };

export const PLATFORM_LABEL: Record<MeetPlatform, string> = { zoom: "Zoom", meet: "Google Meet", teams: "Microsoft Teams", jitsi: "Jitsi Meet" };
export const ACTIVE: TaskStatus[] = ["running", "waiting"];
