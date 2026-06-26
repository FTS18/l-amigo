import { FriendProfile, Platform } from "../types";
import { CodeforcesService } from "./codeforces";
import { LeetCodeService } from "./leetcode";
import { PlatformAdapter } from "./platform-adapter";
import { CodeChefService } from "./codechef";

class LeetCodeAdapter implements PlatformAdapter {
  readonly platform: Platform = "leetcode";

  fetchProfile(handle: string): Promise<FriendProfile> {
    return LeetCodeService.fetchUserProfile(handle);
  }
  verifyHandle(handle: string): Promise<boolean> {
    return LeetCodeService.verifyHandle(handle);
  }
}

class CodeforcesAdapter implements PlatformAdapter {
  readonly platform: Platform = "codeforces";

  fetchProfile(handle: string): Promise<FriendProfile> {
    return CodeforcesService.fetchUserProfile(handle);
  }
  verifyHandle(handle: string): Promise<boolean> {
    return CodeforcesService.verifyHandle(handle);
  }
}

class CodechefAdapter implements PlatformAdapter {
  readonly platform: Platform = "codechef";

  fetchProfile(handle: string): Promise<FriendProfile> {
    return CodeChefService.fetchUserProfile(handle);
  }
  verifyHandle(handle: string): Promise<boolean> {
    return CodeChefService.verifyHandle(handle);
  }
}

export class PlatformService {
  private static adapters: Record<Platform, PlatformAdapter> = {
    leetcode: new LeetCodeAdapter(),
    codeforces: new CodeforcesAdapter(),
    codechef: new CodechefAdapter(),
  };

  static getAdapter(platform: Platform): PlatformAdapter {
    return this.adapters[platform];
  }

  static async fetchProfile(
    platform: Platform,
    handle: string,
  ): Promise<FriendProfile> {
    const adapter = this.getAdapter(platform);
    return adapter.fetchProfile(handle);
  }

  static async verifyHandle(
    platform: Platform,
    handle: string,
  ): Promise<boolean> {
    const adapter = this.getAdapter(platform);
    if (adapter.verifyHandle) {
      return adapter.verifyHandle(handle);
    }
    // Fallback: fetch full profile if verify method is missing
    await adapter.fetchProfile(handle);
    return true;
  }
}
