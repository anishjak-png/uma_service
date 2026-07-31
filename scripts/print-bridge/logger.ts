export const log = {
  started: () => console.log("Print Bridge Started"),
  realtimeConnected: () => console.log("Realtime Connected"),
  realtimeDisconnected: () => console.log("Realtime Disconnected"),
  realtimeReconnected: () => console.log("Realtime Reconnected"),
  newJob: (jobNumber: string) => console.log(`New Print Job Received: ${jobNumber}`),
  printing: (jobNumber: string) => console.log(`Printing Job ${jobNumber}`),
  success: (jobNumber: string) => console.log(`Print Successful: ${jobNumber}`),
  failed: (jobNumber: string, error: string) =>
    console.log(`Print Failed: ${jobNumber} — ${error}`),
  duplicateIgnored: (id: string) => console.log(`Duplicate Event Ignored: ${id}`),
  missedSynced: (count: number) => console.log(`Missed Jobs Synced: ${count}`),
  skipped: (id: string, reason: string) =>
    console.log(`Job Skipped (${id}): ${reason}`),
};
