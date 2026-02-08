import { Friend, FriendProfile } from "../types";

export class ExportService {
  static exportToCSV(
    friends: Friend[],
    profiles: Record<string, FriendProfile>,
  ) {
    // CSV header
    const headers = [
      "Username",
      "Real Name",
      "Total Problems",
      "Easy",
      "Medium",
      "Hard",
      "Contest Rating",
      "Contest Ranking",
      "Ranking",
      "Reputation",
      "Added Date",
      "Last Updated",
    ];

    // CSV rows
    const rows = friends.map((friend) => {
      const profile = profiles[friend.username.toLowerCase()];
      if (!profile) {
        return [
          friend.username,
          "",
          "0",
          "0",
          "0",
          "0",
          "",
          "",
          "",
          "",
          new Date(friend.addedAt).toISOString(),
          "",
        ];
      }

      return [
        profile.username,
        profile.realName || "",
        profile.problemsSolved.total.toString(),
        profile.problemsSolved.easy.toString(),
        profile.problemsSolved.medium.toString(),
        profile.problemsSolved.hard.toString(),
        profile.contestRating?.toFixed(0) || "",
        profile.contestRanking?.toString() || "",
        profile.ranking?.toString() || "",
        profile.reputation?.toString() || "",
        new Date(friend.addedAt).toISOString(),
        profile.lastFetched ? new Date(profile.lastFetched).toISOString() : "",
      ];
    });

    // Combine headers and rows
    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    // Create download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute("download", `leetcode-friends-${Date.now()}.csv`);
    link.style.visibility = "hidden";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  static exportDetailedCSV(
    friends: Friend[],
    profiles: Record<string, FriendProfile>,
  ) {
    // More detailed CSV with recent submissions
    const rows: string[][] = [];

    // Header
    rows.push([
      "Username",
      "Real Name",
      "Total Problems",
      "Easy",
      "Medium",
      "Hard",
      "Contest Rating",
      "Recent Problem 1",
      "Recent Problem 2",
      "Recent Problem 3",
    ]);

    friends.forEach((friend) => {
      const profile = profiles[friend.username.toLowerCase()];
      if (!profile) return;

      const recentProblems = (profile.recentSubmissions || [])
        .slice(0, 3)
        .map((sub) => sub.title);

      rows.push([
        profile.username,
        profile.realName || "",
        profile.problemsSolved.total.toString(),
        profile.problemsSolved.easy.toString(),
        profile.problemsSolved.medium.toString(),
        profile.problemsSolved.hard.toString(),
        profile.contestRating?.toFixed(0) || "",
        recentProblems[0] || "",
        recentProblems[1] || "",
        recentProblems[2] || "",
      ]);
    });

    const csvContent = rows
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `leetcode-friends-detailed-${Date.now()}.csv`,
    );
    link.style.visibility = "hidden";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  static exportToJSON(
    friends: Friend[],
    profiles: Record<string, FriendProfile>,
  ) {
    const exportData = {
      exportDate: new Date().toISOString(),
      totalFriends: friends.length,
      friends: friends.map((friend) => {
        const profile = profiles[friend.username.toLowerCase()];
        if (!profile) {
          return {
            username: friend.username,
            addedAt: new Date(friend.addedAt).toISOString(),
            profile: null,
          };
        }

        return {
          username: profile.username,
          realName: profile.realName || null,
          avatar: profile.avatar || null,
          problemsSolved: profile.problemsSolved,
          contestRating: profile.contestRating || null,
          contestRanking: profile.contestRanking || null,
          ranking: profile.ranking || null,
          reputation: profile.reputation || null,
          recentSubmissions: (profile.recentSubmissions || []).map((sub) => ({
            title: sub.title,
            titleSlug: sub.titleSlug,
            timestamp: new Date(sub.timestamp).toISOString(),
            lang: sub.lang,
          })),
          topicStats: profile.topicStats || null,
          languageStats: profile.languageStats || null,
          submissionStats: profile.submissionStats || null,
          addedAt: new Date(friend.addedAt).toISOString(),
          lastFetched: profile.lastFetched
            ? new Date(profile.lastFetched).toISOString()
            : null,
        };
      }),
    };

    const jsonContent = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonContent], { type: "application/json" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute("download", `leetcode-friends-${Date.now()}.json`);
    link.style.visibility = "hidden";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
