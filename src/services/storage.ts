import { DATA_LIMITS } from "../constants";
import {
  Friend,
  FriendIdentity,
  FriendProfile,
  Platform,
  PlatformAccount,
} from "../types";
import { sanitizeUsername, extractUsernameFromUrl } from "../utils/sanitize";
import { friendAddRateLimiter } from "../utils/rate-limiter";

const IDENTITIES_KEY = "friend_identities_v2";
const PROFILE_V2_KEY_PREFIX = "profile:v2:";
const PROFILE_V2_INDEX_KEY = "profile_index_v2";

type CreateIdentityInput = {
  displayName: string;
  aliases?: string[];
  accounts: Array<{ platform: Platform; handle: string }>;
};

type UpdateIdentityInput = {
  displayName: string;
  aliases?: string[];
  accounts: Array<{ platform: Platform; handle: string }>;
};

export class StorageService {
  private static async ensureMigration(): Promise<void> {
    // Migration is fully deprecated and pruned.
  }

  private static normalizeAlias(alias: string): string {
    return alias.trim().toLowerCase().replace(/\s+/g, " ");
  }

  private static normalizeHandle(platform: Platform, handle: string): string {
    if (platform === "leetcode") {
      if (handle.includes("leetcode.com")) {
        return extractUsernameFromUrl(handle).toLowerCase();
      }
      return sanitizeUsername(handle).toLowerCase();
    }

    const trimmed = handle.trim();
    const cfUrlMatch = trimmed.match(/codeforces\.com\/profile\/([a-zA-Z0-9_-]+)/i);
    const normalized = cfUrlMatch?.[1] || trimmed;
    if (!/^[a-zA-Z0-9_-]+$/.test(normalized)) {
      throw new Error("Invalid Codeforces handle");
    }
    return normalized;
  }

  private static getProfileV2Key(platform: Platform, handle: string): string {
    return `${PROFILE_V2_KEY_PREFIX}${platform}:${handle.toLowerCase()}`;
  }

  private static profileRef(platform: Platform, handle: string): string {
    return `${platform}:${handle.toLowerCase()}`;
  }

  private static makeId(): string {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      return crypto.randomUUID();
    }
    return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private static toLegacyFriend(identity: FriendIdentity): Friend {
    const preferred =
      identity.accounts.find((a) => a.platform === "leetcode") ||
      identity.accounts[0];

    return {
      id: identity.id,
      displayName: identity.displayName,
      aliases: identity.aliases,
      accounts: identity.accounts,
      username: preferred?.handle || identity.displayName,
      addedAt: identity.addedAt,
    };
  }


  static async getIdentities(): Promise<FriendIdentity[]> {
    await this.ensureMigration();
    const result = await chrome.storage.local.get(IDENTITIES_KEY);
    return result[IDENTITIES_KEY] || [];
  }

  private static async saveIdentities(
    identities: FriendIdentity[],
  ): Promise<void> {
    await chrome.storage.local.set({ [IDENTITIES_KEY]: identities });
  }

  static async createIdentity(
    input: CreateIdentityInput,
  ): Promise<FriendIdentity> {
    await this.ensureMigration();

    const displayName = input.displayName.trim();
    if (!displayName) {
      throw new Error("Display name is required");
    }

    if (!input.accounts || input.accounts.length === 0) {
      throw new Error("At least one account is required");
    }

    const identities = await this.getIdentities();
    if (identities.length >= DATA_LIMITS.MAX_FRIENDS) {
      throw new Error(`Maximum ${DATA_LIMITS.MAX_FRIENDS} friends allowed`);
    }

    const aliases = (input.aliases || [])
      .map((a) => this.normalizeAlias(a))
      .filter(Boolean)
      .slice(0, DATA_LIMITS.MAX_ALIASES_PER_IDENTITY);

    const dedupedInputAccounts = Array.from(
      new Map(
        input.accounts.map((a) => [
          `${a.platform}:${this.normalizeHandle(a.platform, a.handle).toLowerCase()}`,
          a,
        ]),
      ).values(),
    );

    const accounts: PlatformAccount[] = dedupedInputAccounts
      .map((a) => ({
        platform: a.platform,
        handle: this.normalizeHandle(a.platform, a.handle),
        status: "active" as const,
        lastFetched: Date.now(),
      }))
      .slice(0, DATA_LIMITS.MAX_ACCOUNTS_PER_IDENTITY);

    for (const account of accounts) {
      const exists = identities.find((i) =>
        i.accounts.some(
          (a) =>
            a.platform === account.platform &&
            a.handle.toLowerCase() === account.handle.toLowerCase(),
        ),
      );
      if (exists) {
        throw new Error(
          `${account.platform} handle already linked to another friend`,
        );
      }
    }

    const now = Date.now();
    const identity: FriendIdentity = {
      id: this.makeId(),
      displayName,
      aliases,
      accounts,
      addedAt: now,
      updatedAt: now,
    };

    identities.push(identity);
    await this.saveIdentities(identities);
    return identity;
  }

  static async updateIdentity(
    identityId: string,
    input: UpdateIdentityInput,
  ): Promise<FriendIdentity> {
    await this.ensureMigration();

    const displayName = input.displayName.trim();
    if (!displayName) {
      throw new Error("Display name is required");
    }

    if (!input.accounts || input.accounts.length === 0) {
      throw new Error("At least one account is required");
    }

    const identities = await this.getIdentities();
    const target = identities.find((i) => i.id === identityId);
    if (!target) {
      throw new Error("Identity not found");
    }

    const aliases = (input.aliases || [])
      .map((a) => this.normalizeAlias(a))
      .filter(Boolean)
      .slice(0, DATA_LIMITS.MAX_ALIASES_PER_IDENTITY);

    const dedupedInputAccounts = Array.from(
      new Map(
        input.accounts.map((a) => [
          `${a.platform}:${this.normalizeHandle(a.platform, a.handle).toLowerCase()}`,
          a,
        ]),
      ).values(),
    );

    const normalizedAccounts: PlatformAccount[] = dedupedInputAccounts
      .map((a) => ({
        platform: a.platform,
        handle: this.normalizeHandle(a.platform, a.handle),
        status: "active" as const,
        lastFetched: Date.now(),
      }))
      .slice(0, DATA_LIMITS.MAX_ACCOUNTS_PER_IDENTITY);

    for (const account of normalizedAccounts) {
      const duplicated = identities.some(
        (i) =>
          i.id !== identityId &&
          i.accounts.some(
            (a) =>
              a.platform === account.platform &&
              a.handle.toLowerCase() === account.handle.toLowerCase(),
          ),
      );
      if (duplicated) {
        throw new Error(
          `${account.platform} handle already linked to another friend`,
        );
      }
    }

    const prevRefs = new Set(
      target.accounts.map((a) => this.profileRef(a.platform, a.handle)),
    );
    const nextRefs = new Set(
      normalizedAccounts.map((a) => this.profileRef(a.platform, a.handle)),
    );

    target.displayName = displayName;
    target.aliases = aliases;
    target.accounts = normalizedAccounts;
    target.updatedAt = Date.now();

    await this.saveIdentities(identities);

    // Remove cached profiles for accounts detached from this identity.
    const removedRefs = Array.from(prevRefs).filter((r) => !nextRefs.has(r));
    if (removedRefs.length > 0) {
      const keysToRemove = removedRefs.map((r) => {
        const [platform, handle] = r.split(":");
        return this.getProfileV2Key(platform as Platform, handle);
      });
      await chrome.storage.local.remove(keysToRemove);

      const indexRes = await chrome.storage.local.get(PROFILE_V2_INDEX_KEY);
      const index: string[] = indexRes[PROFILE_V2_INDEX_KEY] || [];
      const newIndex = index.filter((r) => !removedRefs.includes(r));
      await chrome.storage.local.set({ [PROFILE_V2_INDEX_KEY]: newIndex });
    }

    return target;
  }

  static async addAccountToIdentity(
    identityId: string,
    platform: Platform,
    handle: string,
  ): Promise<void> {
    await this.ensureMigration();
    const normalizedHandle = this.normalizeHandle(platform, handle);
    const identities = await this.getIdentities();
    const identity = identities.find((i) => i.id === identityId);
    if (!identity) {
      throw new Error("Identity not found");
    }

    if (identity.accounts.length >= DATA_LIMITS.MAX_ACCOUNTS_PER_IDENTITY) {
      throw new Error("Maximum accounts reached for this friend");
    }

    const duplicated = identities.some(
      (i) =>
        i.id !== identityId &&
        i.accounts.some(
          (a) =>
            a.platform === platform &&
            a.handle.toLowerCase() === normalizedHandle.toLowerCase(),
        ),
    );
    if (duplicated) {
      throw new Error(`${platform} handle already linked to another friend`);
    }

    const alreadyExists = identity.accounts.some(
      (a) =>
        a.platform === platform &&
        a.handle.toLowerCase() === normalizedHandle.toLowerCase(),
    );
    if (alreadyExists) {
      throw new Error("Account already exists on this friend");
    }

    identity.accounts.push({
      platform,
      handle: normalizedHandle,
      status: "active",
      lastFetched: Date.now(),
    });
    identity.updatedAt = Date.now();
    await this.saveIdentities(identities);
  }

  static async addAlias(identityId: string, alias: string): Promise<void> {
    await this.ensureMigration();
    const normalizedAlias = this.normalizeAlias(alias);
    if (!normalizedAlias) {
      throw new Error("Alias is empty");
    }

    const identities = await this.getIdentities();
    const identity = identities.find((i) => i.id === identityId);
    if (!identity) {
      throw new Error("Identity not found");
    }

    if (identity.aliases.includes(normalizedAlias)) {
      throw new Error("Alias already exists");
    }

    if (identity.aliases.length >= DATA_LIMITS.MAX_ALIASES_PER_IDENTITY) {
      throw new Error("Maximum aliases reached for this friend");
    }

    identity.aliases.push(normalizedAlias);
    identity.updatedAt = Date.now();
    await this.saveIdentities(identities);
  }

  static async removeIdentity(identityId: string): Promise<void> {
    await this.ensureMigration();
    const identities = await this.getIdentities();
    const identity = identities.find((i) => i.id === identityId);
    if (!identity) return;

    const filtered = identities.filter((i) => i.id !== identityId);
    await this.saveIdentities(filtered);

    const profileKeys = identity.accounts.map((a) =>
      this.getProfileV2Key(a.platform, a.handle),
    );
    if (profileKeys.length > 0) {
      await chrome.storage.local.remove(profileKeys);
    }

    const res = await chrome.storage.local.get(PROFILE_V2_INDEX_KEY);
    const index: string[] = res[PROFILE_V2_INDEX_KEY] || [];
    const accountRefs = new Set(
      identity.accounts.map((a) => this.profileRef(a.platform, a.handle)),
    );
    const newIndex = index.filter((ref) => !accountRefs.has(ref));
    await chrome.storage.local.set({ [PROFILE_V2_INDEX_KEY]: newIndex });
  }

  static async getFriends(): Promise<Friend[]> {
    const identities = await this.getIdentities();
    return identities.map((i) => this.toLegacyFriend(i));
  }

  static async addFriend(username: string): Promise<void> {
    await this.ensureMigration();

    if (!friendAddRateLimiter.canProceed()) {
      const waitTime = Math.ceil(
        friendAddRateLimiter.getTimeUntilReset() / 1000,
      );
      throw new Error(`Rate limit exceeded. Please wait ${waitTime} seconds.`);
    }

    let sanitized: string;
    try {
      if (username.includes("leetcode.com")) {
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

    await this.createIdentity({
      displayName: sanitized,
      aliases: [],
      accounts: [{ platform: "leetcode", handle: sanitized }],
    });
  }

  static async removeFriend(username: string): Promise<void> {
    await this.ensureMigration();
    const identities = await this.getIdentities();
    const target = identities.find((i) =>
      i.accounts.some(
        (a) => a.handle.toLowerCase() === username.toLowerCase(),
      ),
    );

    if (target) {
      await this.removeIdentity(target.id);
      return;
    }

    const fallback = identities.find(
      (i) => i.displayName.toLowerCase() === username.toLowerCase(),
    );
    if (fallback) {
      await this.removeIdentity(fallback.id);
    }
  }

  static async getProfiles(): Promise<Record<string, FriendProfile>> {
    await this.ensureMigration();

    const identities = await this.getIdentities();
    const allProfiles = await this.getAllPlatformProfiles();

    const profiles: Record<string, FriendProfile> = {};

    // 1. Populate platform-prefixed keys {platform}:{handle}
    for (const [ref, profile] of Object.entries(allProfiles)) {
      const [platform, handle] = ref.split(":");
      const lowercaseHandle = handle.toLowerCase();

      // Find identity for this account to attach its id if it exists
      const identity = identities.find((i) =>
        i.accounts.some(
          (a) =>
            a.platform === platform &&
            a.handle.toLowerCase() === lowercaseHandle,
        ),
      );

      const profileWithId = {
        ...profile,
        id: identity?.id,
        platform: platform as Platform,
      };

      // Key by lowercased platform:handle (e.g., "leetcode:tourist")
      profiles[ref.toLowerCase()] = profileWithId;

      // Key by lowercase handle for backwards/fallback compatibility
      if (!profiles[lowercaseHandle] || platform === "leetcode") {
        profiles[lowercaseHandle] = profileWithId;
      }
    }

    // 2. Ensure legacy friend username lookup is supported
    for (const identity of identities) {
      const legacyFriend = this.toLegacyFriend(identity);
      const legacyKey = legacyFriend.username.toLowerCase();
      
      const preferred =
        identity.accounts.find((a) => a.platform === "leetcode") ||
        identity.accounts[0];
      if (preferred) {
        const ref = this.profileRef(preferred.platform, preferred.handle).toLowerCase();
        const profile = profiles[ref];
        if (profile && !profiles[legacyKey]) {
          profiles[legacyKey] = {
            ...profile,
            id: identity.id,
          };
        }
      }
    }

    return profiles;
  }

  static async saveProfile(profile: FriendProfile): Promise<void> {
    await this.ensureMigration();
    const platform = profile.platform || "leetcode";
    const username = this.normalizeHandle(platform, profile.username);

    // Limit recent submissions to prevent bloat
    const limitedProfile = {
      ...profile,
      username,
      platform,
      recentSubmissions: profile.recentSubmissions?.slice(
        0,
        DATA_LIMITS.MAX_RECENT_SUBMISSIONS,
      ),
      lastFetched: Date.now(),
    };

    const profileKey = this.getProfileV2Key(platform, username);
    await chrome.storage.local.set({ [profileKey]: limitedProfile });

    const res = await chrome.storage.local.get(PROFILE_V2_INDEX_KEY);
    const index: string[] = res[PROFILE_V2_INDEX_KEY] || [];
    const ref = this.profileRef(platform, username);
    if (!index.includes(ref)) {
      index.push(ref);
      await chrome.storage.local.set({ [PROFILE_V2_INDEX_KEY]: index });
    }

    this.cleanupProfiles(index).catch(console.error);
  }

  private static async getAllPlatformProfiles(): Promise<
    Record<string, FriendProfile>
  > {
    const res = await chrome.storage.local.get(PROFILE_V2_INDEX_KEY);
    const index: string[] = res[PROFILE_V2_INDEX_KEY] || [];
    if (index.length === 0) return {};

    const keys = index.map((ref) => {
      const [platform, handle] = ref.split(":");
      return this.getProfileV2Key(platform as Platform, handle);
    });

    const results = (await chrome.storage.local.get(keys)) as Record<
      string,
      FriendProfile
    >;
    const profiles: Record<string, FriendProfile> = {};
    for (const ref of index) {
      const [platform, handle] = ref.split(":");
      const p = results[this.getProfileV2Key(platform as Platform, handle)];
      if (p) profiles[ref] = p;
    }
    return profiles;
  }

  private static async cleanupProfiles(index: string[]): Promise<void> {
    // console.log("[StorageService.cleanupProfiles] Starting cleanup process. Input index:", index);
    const identities = await this.getIdentities();
    const allowedRefs = new Set<string>();
    identities.forEach((identity) => {
      identity.accounts.forEach((account) => {
        allowedRefs.add(this.profileRef(account.platform, account.handle));
      });
    });

    const { own_username: ownUser, own_codeforces_handle: ownCodeforcesHandle, own_codechef_handle: ownCodechefHandle } =
      await chrome.storage.local.get(["own_username", "own_codeforces_handle", "own_codechef_handle"]);
    if (ownUser) {
      allowedRefs.add(
        this.profileRef("leetcode", String(ownUser).toLowerCase()),
      );
    }
    if (ownCodeforcesHandle) {
      allowedRefs.add(
        this.profileRef("codeforces", String(ownCodeforcesHandle).trim().toLowerCase()),
      );
    }
    if (ownCodechefHandle) {
      allowedRefs.add(
        this.profileRef("codechef", String(ownCodechefHandle).trim().toLowerCase()),
      );
    }
    // console.log("[StorageService.cleanupProfiles] Allowed profile references:", Array.from(allowedRefs));

    // To prevent orphaned profiles that aren't even in the index, scan all chrome.storage.local keys
    const allStorage = await chrome.storage.local.get(null);
    const allStorageKeys = Object.keys(allStorage);
    const profileKeysInStorage = allStorageKeys.filter(key => key.startsWith(PROFILE_V2_KEY_PREFIX));
    // console.log("[StorageService.cleanupProfiles] Profile keys currently in storage:", profileKeysInStorage);

    const toRemove: string[] = [];

    // Check keys in storage
    for (const key of profileKeysInStorage) {
      const refPart = key.slice(PROFILE_V2_KEY_PREFIX.length);
      if (!allowedRefs.has(refPart)) {
        // console.log(`[StorageService.cleanupProfiles] Found orphaned profile in storage: ${key}. Queueing for removal.`);
        toRemove.push(key);
      }
    }

    // Also check index entries that are not allowed or not in storage
    const newIndex: string[] = [];
    for (const ref of index) {
      if (allowedRefs.has(ref)) {
        newIndex.push(ref);
      } else {
        // console.log(`[StorageService.cleanupProfiles] Found disallowed index entry: ${ref}`);
        const [platform, handle] = ref.split(":");
        const key = this.getProfileV2Key(platform as Platform, handle);
        if (!toRemove.includes(key)) {
          toRemove.push(key);
        }
      }
    }

    if (toRemove.length > 0) {
      // console.log("[StorageService.cleanupProfiles] Removing keys from storage:", toRemove);
      await chrome.storage.local.remove(toRemove);
    }

    // console.log("[StorageService.cleanupProfiles] Updating profile index to:", newIndex);
    await chrome.storage.local.set({ [PROFILE_V2_INDEX_KEY]: newIndex });
    // console.log("[StorageService.cleanupProfiles] Cleanup complete.");
  }

  static async getProfile(username: string): Promise<FriendProfile | null> {
    await this.ensureMigration();
    return this.getProfileByAccount("leetcode", username);
  }

  static async getProfileByAccount(
    platform: Platform,
    handle: string,
  ): Promise<FriendProfile | null> {
    await this.ensureMigration();
    const normalized = this.normalizeHandle(platform, handle);
    const key = this.getProfileV2Key(platform, normalized);
    const res = await chrome.storage.local.get(key);
    return res[key] || null;
  }
}
