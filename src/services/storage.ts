import { Friend, FriendProfile } from "../types";
import { DATA_LIMITS } from "../constants";

const FRIENDS_STORAGE_KEY = "leetcode_friends";
const PROFILES_STORAGE_KEY = "leetcode_profiles";

export class StorageService {
  static async getFriends(): Promise<Friend[]> {
    const result = await chrome.storage.local.get(FRIENDS_STORAGE_KEY);
    return result[FRIENDS_STORAGE_KEY] || [];
  }

  static async addFriend(username: string): Promise<void> {
    const friends = await this.getFriends();

    // Check max friends limit
    if (friends.length >= DATA_LIMITS.MAX_FRIENDS) {
      throw new Error(`Maximum ${DATA_LIMITS.MAX_FRIENDS} friends allowed`);
    }

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
    
    // Limit recent submissions to prevent bloat
    const limitedProfile = {
      ...profile,
      recentSubmissions: profile.recentSubmissions?.slice(0, DATA_LIMITS.MAX_RECENT_SUBMISSIONS),
      lastFetched: Date.now(),
    };
    
    profiles[profile.username.toLowerCase()] = limitedProfile;

    // Inline cleanup: remove stale profiles without extra storage reads
    const friends = await this.getFriends();
    const friendUsernames = new Set(friends.map(f => f.username.toLowerCase()));
    // Also keep the own username profile
    const { own_username: ownUser } = await chrome.storage.local.get('own_username');
    if (ownUser) friendUsernames.add(ownUser.toLowerCase());

    const now = Date.now();
    for (const username of Object.keys(profiles)) {
      const age = now - (profiles[username].lastFetched || 0);
      if (!friendUsernames.has(username) || age >= DATA_LIMITS.PROFILE_CACHE_DURATION * 7) {
        delete profiles[username];
      }
    }

    await chrome.storage.local.set({ [PROFILES_STORAGE_KEY]: profiles });
  }

  static async getProfile(username: string): Promise<FriendProfile | null> {
    const profiles = await this.getProfiles();
    return profiles[username.toLowerCase()] || null;
  }
}
