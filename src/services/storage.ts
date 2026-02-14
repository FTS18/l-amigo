import { Friend, FriendProfile } from "../types";
import { DATA_LIMITS } from "../constants";
import { sanitizeUsername, extractUsernameFromUrl } from "../utils/sanitize";
import { friendAddRateLimiter } from "../utils/rate-limiter";

const FRIENDS_STORAGE_KEY = "leetcode_friends";
const PROFILE_KEY_PREFIX = "profile:";
const PROFILE_INDEX_KEY = "leetcode_profile_index";

export class StorageService {
  static async getFriends(): Promise<Friend[]> {
    const result = await chrome.storage.local.get(FRIENDS_STORAGE_KEY);
    return result[FRIENDS_STORAGE_KEY] || [];
  }

  static async addFriend(username: string): Promise<void> {
    if (!friendAddRateLimiter.canProceed()) {
      const waitTime = Math.ceil(friendAddRateLimiter.getTimeUntilReset() / 1000);
      throw new Error(`Rate limit exceeded. Please wait ${waitTime} seconds.`);
    }

    let sanitized: string;
    try {
      if (username.includes('leetcode.com')) {
        sanitized = extractUsernameFromUrl(username);
      } else {
        sanitized = sanitizeUsername(username);
      }
    } catch (error) {
      throw new Error(`Invalid username: ${(error as Error).message}`);
    }

    const friends = await this.getFriends();

    if (friends.length >= DATA_LIMITS.MAX_FRIENDS) {
      throw new Error(`Maximum ${DATA_LIMITS.MAX_FRIENDS} friends allowed`);
    }

    if (
      friends.some((f) => f.username.toLowerCase() === sanitized.toLowerCase())
    ) {
      throw new Error("Friend already added");
    }

    friends.push({
      username: sanitized,
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
    
    await chrome.storage.local.remove(`${PROFILE_KEY_PREFIX}${username.toLowerCase()}`);
    
    const res = await chrome.storage.local.get(PROFILE_INDEX_KEY);
    const index = res[PROFILE_INDEX_KEY] || [];
    const newIndex = index.filter((u: string) => u !== username.toLowerCase());
    await chrome.storage.local.set({ [PROFILE_INDEX_KEY]: newIndex });
  }

  static async getProfiles(): Promise<Record<string, FriendProfile>> {
    const res = await chrome.storage.local.get(PROFILE_INDEX_KEY);
    const index = res[PROFILE_INDEX_KEY] || [];
    if (index.length === 0) return {};

    const keys = index.map((u: string) => `${PROFILE_KEY_PREFIX}${u}`);
    const results = (await chrome.storage.local.get(keys)) as any;
    
    const profiles: Record<string, FriendProfile> = {};
    index.forEach((u: string) => {
      const p = results[`${PROFILE_KEY_PREFIX}${u}`];
      if (p) profiles[u] = p;
    });
    return profiles;
  }

  static async saveProfile(profile: FriendProfile): Promise<void> {
    const username = profile.username.toLowerCase();
    
    // Limit recent submissions to prevent bloat
    const limitedProfile = {
      ...profile,
      recentSubmissions: profile.recentSubmissions?.slice(
        0,
        DATA_LIMITS.MAX_RECENT_SUBMISSIONS,
      ),
      lastFetched: Date.now(),
    };

    // Save individual profile
    await chrome.storage.local.set({ [`${PROFILE_KEY_PREFIX}${username}`]: limitedProfile });

    // Update index
    const res = await chrome.storage.local.get(PROFILE_INDEX_KEY);
    const index = res[PROFILE_INDEX_KEY] || [];
    if (!index.includes(username)) {
      index.push(username);
      await chrome.storage.local.set({ [PROFILE_INDEX_KEY]: index });
    }

    // Cleanup stale profiles (async, don't block save)
    this.cleanupProfiles(index).catch(console.error);
  }

  private static async cleanupProfiles(index: string[]): Promise<void> {
    const friends = await this.getFriends();
    const friendUsernames = new Set(friends.map((f) => f.username.toLowerCase()));
    
    const { own_username: ownUser } = await chrome.storage.local.get("own_username");
    if (ownUser) friendUsernames.add(ownUser.toLowerCase());

    const toRemove: string[] = [];
    const newIndex: string[] = [];

    for (const u of index) {
      if (!friendUsernames.has(u)) {
        toRemove.push(`${PROFILE_KEY_PREFIX}${u}`);
      } else {
        newIndex.push(u);
      }
    }

    if (toRemove.length > 0) {
      await chrome.storage.local.remove(toRemove);
      await chrome.storage.local.set({ [PROFILE_INDEX_KEY]: newIndex });
    }
  }

  static async getProfile(username: string): Promise<FriendProfile | null> {
    const key = `${PROFILE_KEY_PREFIX}${username.toLowerCase()}`;
    const res = await chrome.storage.local.get(key);
    return res[key] || null;
  }
}
