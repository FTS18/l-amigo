import { FriendProfile, Platform } from "../types";

export interface PlatformAdapter {
  readonly platform: Platform;
  fetchProfile(handle: string): Promise<FriendProfile>;
}
