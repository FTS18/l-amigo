export interface GitHubSyncConfig {
  token: string;
  gistId?: string;
}

export class GitHubSyncService {
  private static readonly GITHUB_API = "https://api.github.com";
  private static readonly STORAGE_KEY = "github_sync_config";

  static async saveConfig(config: GitHubSyncConfig): Promise<void> {
    await chrome.storage.local.set({ [this.STORAGE_KEY]: config });
  }

  static async getConfig(): Promise<GitHubSyncConfig | null> {
    const result = await chrome.storage.local.get(this.STORAGE_KEY);
    return result[this.STORAGE_KEY] || null;
  }

  static async syncToGitHub(data: any): Promise<void> {
    const config = await this.getConfig();
    if (!config?.token) {
      throw new Error("GitHub token not configured");
    }

    const content = JSON.stringify(data, null, 2);

    if (config.gistId) {
      // Update existing gist
      await this.updateGist(config.token, config.gistId, content);
    } else {
      // Create new gist
      const gistId = await this.createGist(config.token, content);
      config.gistId = gistId;
      await this.saveConfig(config);
    }
  }

  static async syncFromGitHub(): Promise<any> {
    const config = await this.getConfig();
    if (!config?.token || !config?.gistId) {
      throw new Error("GitHub sync not configured");
    }

    const response = await fetch(`${this.GITHUB_API}/gists/${config.gistId}`, {
      headers: {
        Authorization: `token ${config.token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch from GitHub");
    }

    const gist = await response.json();
    const file = gist.files["leetcode-friends-backup.json"];
    if (!file) {
      throw new Error("Backup file not found in gist");
    }

    return JSON.parse(file.content);
  }

  private static async createGist(
    token: string,
    content: string,
  ): Promise<string> {
    const response = await fetch(`${this.GITHUB_API}/gists`, {
      method: "POST",
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        description: "L'Amigo - Auto Backup",
        public: false,
        files: {
          "leetcode-friends-backup.json": {
            content,
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to create gist");
    }

    const gist = await response.json();
    return gist.id;
  }

  private static async updateGist(
    token: string,
    gistId: string,
    content: string,
  ): Promise<void> {
    const response = await fetch(`${this.GITHUB_API}/gists/${gistId}`, {
      method: "PATCH",
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        files: {
          "leetcode-friends-backup.json": {
            content,
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to update gist");
    }
  }

  static async disconnect(): Promise<void> {
    await chrome.storage.local.remove(this.STORAGE_KEY);
  }
}
