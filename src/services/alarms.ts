export interface ContestReminderInfo {
  id: string;
  name: string;
  platform: string;
  startTimeSeconds: number;
}

export class AlarmsService {
  private static STORAGE_KEY = "contest_reminders";

  static async getReminders(): Promise<Record<string, ContestReminderInfo>> {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.STORAGE_KEY], (res) => {
        resolve(res[this.STORAGE_KEY] || {});
      });
    });
  }

  static async toggleReminder(contest: ContestReminderInfo): Promise<boolean> {
    const reminders = await this.getReminders();
    const isSet = !!reminders[contest.id];

    if (isSet) {
      // Remove reminder
      delete reminders[contest.id];
      await this.clearAlarms(contest.id);
    } else {
      // Add reminder
      reminders[contest.id] = contest;
      await this.setAlarms(contest);
    }

    return new Promise((resolve) => {
      chrome.storage.local.set({ [this.STORAGE_KEY]: reminders }, () => {
        if (!isSet) {
          // Immediately notify the user that reminders were scheduled
          const platformName = contest.platform === "leetcode" ? "LeetCode" 
                            : contest.platform === "codechef" ? "CodeChef" 
                            : "Codeforces";
                            
          chrome.notifications.create(`notify-scheduled-${contest.id}`, {
            type: "basic",
            iconUrl: "android-chrome-192x192.png",
            title: "Reminder Scheduled!",
            message: `We'll notify you 24h, 1h, and 10m before ${platformName}: ${contest.name} starts.`,
            priority: 1
          });
        }
        resolve(!isSet);
      });
    });
  }

  private static async setAlarms(contest: ContestReminderInfo) {
    const startTimeMs = contest.startTimeSeconds * 1000;
    const now = Date.now();

    const intervals = [
      { id: "24h", msBefore: 24 * 60 * 60 * 1000 },
      { id: "1h", msBefore: 60 * 60 * 1000 },
      { id: "10m", msBefore: 10 * 60 * 1000 },
    ];

    for (const interval of intervals) {
      const alarmTime = startTimeMs - interval.msBefore;
      if (alarmTime > now) {
        chrome.alarms.create(`contest-${contest.id}-${interval.id}`, {
          when: alarmTime,
        });
      }
    }
  }

  private static async clearAlarms(contestId: string) {
    chrome.alarms.clear(`contest-${contestId}-24h`);
    chrome.alarms.clear(`contest-${contestId}-1h`);
    chrome.alarms.clear(`contest-${contestId}-10m`);
  }
}
