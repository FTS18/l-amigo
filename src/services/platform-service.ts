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
}

class CodeforcesAdapter implements PlatformAdapter {
  readonly platform: Platform = "codeforces";

  fetchProfile(handle: string): Promise<FriendProfile> {
    return CodeforcesService.fetchUserProfile(handle);
  }
}

class CodechefAdapter implements PlatformAdapter {
  readonly platform: Platform = "codechef";

  fetchProfile(handle: string): Promise<FriendProfile> {
    return CodeChefService.fetchUserProfile(handle);
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
}
