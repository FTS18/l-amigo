import { StorageService } from "../../services/storage";
import { LeetCodeService } from "../../services/leetcode";
import { PlatformService } from "../../services/platform-service";
import { Platform } from "../../types";
import { MessageHandler, MessageResponse } from "./types";

export class FriendHandler implements MessageHandler {
  async handle(message: any): Promise<MessageResponse> {
    switch (message.action) {
      case "addFriend":
        return this.handleAddFriend(message.username);
      case "createIdentity":
        return this.handleCreateIdentity(message.payload);
      case "updateIdentity":
        return this.handleUpdateIdentity(message.identityId, message.payload);
      case "addAccountToIdentity":
        return this.handleAddAccountToIdentity(
          message.identityId,
          message.platform,
          message.handle,
        );
      case "addAlias":
        return this.handleAddAlias(message.identityId, message.alias);
      case "removeIdentity":
        return this.handleRemoveIdentity(message.identityId);
      default:
        return { success: false, error: "Unknown action" };
    }
  }

  private async handleAddFriend(username: string): Promise<MessageResponse> {
    try {
      await StorageService.addFriend(username);
      const profile = await LeetCodeService.fetchUserProfile(username);
      await StorageService.saveProfile(profile);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  private async handleCreateIdentity(payload: {
    displayName: string;
    aliases?: string[];
    accounts: Array<{ platform: Platform; handle: string }>;
  }): Promise<MessageResponse> {
    try {
      const identity = await StorageService.createIdentity(payload);
      await Promise.allSettled(
        identity.accounts.map(async (account) => {
          const profile = await PlatformService.fetchProfile(
            account.platform,
            account.handle,
          );
          await StorageService.saveProfile(profile);
        }),
      );
      return { success: true, data: identity };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  private async handleUpdateIdentity(
    identityId: string,
    payload: {
      displayName: string;
      aliases?: string[];
      accounts: Array<{ platform: Platform; handle: string }>;
    }
  ): Promise<MessageResponse> {
    try {
      const identity = await StorageService.updateIdentity(identityId, payload);
      await Promise.allSettled(
        identity.accounts.map(async (account) => {
          const profile = await PlatformService.fetchProfile(
            account.platform,
            account.handle,
          );
          await StorageService.saveProfile(profile);
        }),
      );
      return { success: true, data: identity };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  private async handleAddAccountToIdentity(
    identityId: string,
    platform: Platform,
    handle: string,
  ): Promise<MessageResponse> {
    try {
      await StorageService.addAccountToIdentity(identityId, platform, handle);
      const profile = await PlatformService.fetchProfile(platform, handle);
      await StorageService.saveProfile(profile);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  private async handleAddAlias(
    identityId: string,
    alias: string,
  ): Promise<MessageResponse> {
    try {
      await StorageService.addAlias(identityId, alias);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  private async handleRemoveIdentity(
    identityId: string,
  ): Promise<MessageResponse> {
    try {
      await StorageService.removeIdentity(identityId);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}
