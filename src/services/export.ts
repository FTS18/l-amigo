import { Friend, FriendProfile, Platform } from "../types";

export class ExportService {
  static exportToCSV(
    friends: Friend[],
    profiles: Record<string, FriendProfile>,
  ) {
    // CSV header
    const headers = [
      "Friend Name",
      "Platform",
      "Handle",
      "Real Name",
      "Total Problems",
      "Easy",
      "Medium",
      "Hard",
      "Contest Rating",
      "Platform Rank",
      "Reputation",
      "Added Date",
      "Last Updated",
    ];

    const rows: string[][] = [];

    friends.forEach((friend) => {
      const accounts = friend.accounts && friend.accounts.length > 0
        ? friend.accounts
        : [{ platform: "leetcode" as Platform, handle: friend.username }];

      accounts.forEach((account) => {
        const key = `${account.platform}:${account.handle.toLowerCase()}`;
        const profile = profiles[key] || profiles[account.handle.toLowerCase()];

        if (!profile) {
          rows.push([
            friend.displayName || friend.username,
            account.platform,
            account.handle,
            "",
            "0",
            "0",
            "0",
            "0",
            "",
            "",
            "",
            new Date(friend.addedAt).toISOString(),
            "",
          ]);
        } else {
          rows.push([
            friend.displayName || friend.username,
            account.platform,
            account.handle,
            profile.realName || "",
            profile.problemsSolved?.total?.toString() || "0",
            profile.problemsSolved?.easy?.toString() || "0",
            profile.problemsSolved?.medium?.toString() || "0",
            profile.problemsSolved?.hard?.toString() || "0",
            profile.contestRating?.toFixed(0) || "",
            profile.ranking?.toString() || profile.contestRanking?.toString() || "",
            profile.reputation?.toString() || "",
            new Date(friend.addedAt).toISOString(),
            profile.lastFetched ? new Date(profile.lastFetched).toISOString() : "",
          ]);
        }
      });
    });

    // Combine headers and rows
    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    ExportService.downloadBlob(
      new Blob([csvContent], { type: "text/csv;charset=utf-8;" }),
      `lamigo-friends-${Date.now()}.csv`,
    );
  }

  static exportDetailedCSV(
    friends: Friend[],
    profiles: Record<string, FriendProfile>,
  ) {
    const rows: string[][] = [];

    // Header
    rows.push([
      "Friend Name",
      "Platform",
      "Handle",
      "Real Name",
      "Total Problems",
      "Easy",
      "Medium",
      "Hard",
      "Contest Rating",
      "Platform Rank",
      "Recent Problem 1",
      "Recent Problem 2",
      "Recent Problem 3",
      "Recent Problem 4",
      "Recent Problem 5",
    ]);

    friends.forEach((friend) => {
      const accounts = friend.accounts && friend.accounts.length > 0
        ? friend.accounts
        : [{ platform: "leetcode" as Platform, handle: friend.username }];

      accounts.forEach((account) => {
        const key = `${account.platform}:${account.handle.toLowerCase()}`;
        const profile = profiles[key] || profiles[account.handle.toLowerCase()];

        if (!profile) {
          rows.push([
            friend.displayName || friend.username,
            account.platform,
            account.handle,
            "",
            "0",
            "0",
            "0",
            "0",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
          ]);
        } else {
          const recentProblems = (profile.recentSubmissions || [])
            .slice(0, 5)
            .map((sub) => sub.title);

          rows.push([
            friend.displayName || friend.username,
            account.platform,
            account.handle,
            profile.realName || "",
            profile.problemsSolved?.total?.toString() || "0",
            profile.problemsSolved?.easy?.toString() || "0",
            profile.problemsSolved?.medium?.toString() || "0",
            profile.problemsSolved?.hard?.toString() || "0",
            profile.contestRating?.toFixed(0) || "",
            profile.ranking?.toString() || profile.contestRanking?.toString() || "",
            recentProblems[0] || "",
            recentProblems[1] || "",
            recentProblems[2] || "",
            recentProblems[3] || "",
            recentProblems[4] || "",
          ]);
        }
      });
    });

    const csvContent = rows
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    ExportService.downloadBlob(
      new Blob([csvContent], { type: "text/csv;charset=utf-8;" }),
      `lamigo-friends-detailed-${Date.now()}.csv`,
    );
  }

  static async exportToJSON() {
    const keys = [
      "friend_identities_v2",
      "own_username",
      "own_codeforces_handle",
      "own_codechef_handle",
      "darkMode",
      "notifications_enabled",
      "auto_refresh",
      "refresh_interval",
      "cf_dark_mode",
      "daily_goal",
      "last_backup_time",
      "sync_history"
    ];
    const data = await chrome.storage.local.get(keys);
    const jsonContent = JSON.stringify(data, null, 2);
    ExportService.downloadBlob(
      new Blob([jsonContent], { type: "application/json" }),
      `lamigo-backup-${Date.now()}.json`,
    );
  }

  /**
   * Export only the selected friends in a portable "shareable" JSON.
   * Recipients can import this file to instantly populate their friends list.
   * Contains NO personal settings or auth tokens.
   */
  static exportFriendsShareableJSON(friends: Friend[]) {
    const sharePayload = {
      lamigo_share: true,
      version: "1.0",
      exportDate: new Date().toISOString(),
      friends: friends.map((f) => ({
        displayName: f.displayName || f.username,
        aliases: f.aliases || [],
        accounts: (
          f.accounts && f.accounts.length > 0
            ? f.accounts
            : [{ platform: "leetcode" as Platform, handle: f.username }]
        ).map((a) => ({ platform: a.platform, handle: a.handle })),
      })),
    };

    ExportService.downloadBlob(
      new Blob([JSON.stringify(sharePayload, null, 2)], { type: "application/json" }),
      `lamigo-friends-share-${Date.now()}.json`,
    );
  }

  // ─── Internal helper ────────────────────────────────────────────

  private static downloadBlob(blob: Blob, filename: string) {
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
