import { Friend, FriendProfile } from "../types";

const FRIENDS_STORAGE_KEY = "leetcode_friends";
const PROFILES_STORAGE_KEY = "leetcode_profiles";

export class StorageService {
  static async getFriends(): Promise<Friend[]> {
    const result = await chrome.storage.local.get(FRIENDS_STORAGE_KEY);
    return result[FRIENDS_STORAGE_KEY] || [];
  }

  static async addFriend(username: string): Promise<void> {
    const friends = await this.getFriends();

    // Check if friend already exists
    if (
      friends.some((f) => f.username.toLowerCase() === username.toLowerCase())
    ) {
      throw new Error("Friend already added");
    }

    friends.push({
      username,
      addedAt: Date.now(),
    });

    await chrome.storage.local.set({ [FRIENDS_STORAGE_KEY]: friends });
  }

  static async removeFriend(username: string): Promise<void> {
    const friends = await this.getFriends();
    const filtered = friends.filter(
      (f) => f.username.toLowerCase() !== username.toLowerCase(),
    );
    await chrome.storage.local.set({ [FRIENDS_STORAGE_KEY]: filtered });

    // Also remove their profile data
    const profiles = await this.getProfiles();
    delete profiles[username.toLowerCase()];
    await chrome.storage.local.set({ [PROFILES_STORAGE_KEY]: profiles });
  }

  static async getProfiles(): Promise<Record<string, FriendProfile>> {
    const result = await chrome.storage.local.get(PROFILES_STORAGE_KEY);
    return result[PROFILES_STORAGE_KEY] || {};
  }

  static async saveProfile(profile: FriendProfile): Promise<void> {
    const profiles = await this.getProfiles();
    profiles[profile.username.toLowerCase()] = {
      ...profile,
      lastFetched: Date.now(),
    };
    await chrome.storage.local.set({ [PROFILES_STORAGE_KEY]: profiles });
  }

  static async getProfile(username: string): Promise<FriendProfile | null> {
    const profiles = await this.getProfiles();
    return profiles[username.toLowerCase()] || null;
  }
}
