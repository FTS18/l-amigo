import { StorageService } from '../src/services/storage';
import { DATA_LIMITS } from '../src/constants';
import { Platform } from '../src/types';

describe('StorageService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('addFriend', () => {
    it('should add a friend successfully', async () => {
      const mockGet = jest.fn().mockResolvedValue({
        storage_migration_v2_done: true,
        friend_identities_v2: []
      });
      const mockSet = jest.fn().mockResolvedValue(undefined);
      
      (chrome.storage.local.get as jest.Mock) = mockGet;
      (chrome.storage.local.set as jest.Mock) = mockSet;

      await StorageService.addFriend('testuser');

      expect(mockSet).toHaveBeenCalledWith({
        friend_identities_v2: [
          expect.objectContaining({
            displayName: 'testuser',
            accounts: [
              expect.objectContaining({
                platform: 'leetcode',
                handle: 'testuser',
              })
            ]
          })
        ]
      });
    });

    it('should reject duplicate friends', async () => {
      const mockGet = jest.fn().mockResolvedValue({
        storage_migration_v2_done: true,
        friend_identities_v2: [
          {
            id: 'id-1',
            displayName: 'testuser',
            aliases: [],
            accounts: [
              {
                platform: 'leetcode',
                handle: 'testuser',
                status: 'active',
                lastFetched: Date.now()
              }
            ],
            addedAt: Date.now(),
            updatedAt: Date.now()
          }
        ]
      });
      
      (chrome.storage.local.get as jest.Mock) = mockGet;

      await expect(StorageService.addFriend('testuser')).rejects.toThrow(
        'Friend already added'
      );
    });

    it('should enforce max friends limit', async () => {
      const mockIdentities = Array.from({ length: DATA_LIMITS.MAX_FRIENDS }, (_, i) => ({
        id: `id-${i}`,
        displayName: `user${i}`,
        aliases: [],
        accounts: [
          {
            platform: 'leetcode' as Platform,
            handle: `user${i}`,
            status: 'active' as const,
            lastFetched: Date.now()
          }
        ],
        addedAt: Date.now(),
        updatedAt: Date.now()
      }));

      const mockGet = jest.fn().mockResolvedValue({
        storage_migration_v2_done: true,
        friend_identities_v2: mockIdentities
      });
      (chrome.storage.local.get as jest.Mock) = mockGet;

      await expect(StorageService.addFriend('newuser')).rejects.toThrow(
        `Maximum ${DATA_LIMITS.MAX_FRIENDS} friends allowed`
      );
    });

    it('should handle case-insensitive duplicates', async () => {
      const mockGet = jest.fn().mockResolvedValue({
        storage_migration_v2_done: true,
        friend_identities_v2: [
          {
            id: 'id-1',
            displayName: 'TestUser',
            aliases: [],
            accounts: [
              {
                platform: 'leetcode',
                handle: 'TestUser',
                status: 'active',
                lastFetched: Date.now()
              }
            ],
            addedAt: Date.now(),
            updatedAt: Date.now()
          }
        ]
      });
      
      (chrome.storage.local.get as jest.Mock) = mockGet;

      await expect(StorageService.addFriend('testuser')).rejects.toThrow(
        'Friend already added'
      );
    });
  });

  describe('removeFriend', () => {
    it('should remove a friend successfully', async () => {
      const mockIdentity1 = {
        id: 'id-1',
        displayName: 'user1',
        aliases: [],
        accounts: [{ platform: 'leetcode' as Platform, handle: 'user1', status: 'active' as const, lastFetched: Date.now() }],
        addedAt: Date.now(),
        updatedAt: Date.now()
      };
      const mockIdentity2 = {
        id: 'id-2',
        displayName: 'user2',
        aliases: [],
        accounts: [{ platform: 'leetcode' as Platform, handle: 'user2', status: 'active' as const, lastFetched: Date.now() }],
        addedAt: Date.now(),
        updatedAt: Date.now()
      };

      const mockGet = jest.fn().mockImplementation((query) => {
        if (query === 'friend_identities_v2' || (Array.isArray(query) && query.includes('friend_identities_v2'))) {
          return Promise.resolve({
            storage_migration_v2_done: true,
            friend_identities_v2: [mockIdentity1, mockIdentity2]
          });
        }
        return Promise.resolve({
          storage_migration_v2_done: true,
          friend_identities_v2: [mockIdentity1, mockIdentity2],
          profile_index_v2: ['leetcode:user1', 'leetcode:user2']
        });
      });

      const mockSet = jest.fn().mockResolvedValue(undefined);
      const mockRemove = jest.fn().mockResolvedValue(undefined);
      
      (chrome.storage.local.get as jest.Mock) = mockGet;
      (chrome.storage.local.set as jest.Mock) = mockSet;
      (chrome.storage.local.remove as jest.Mock) = mockRemove;

      await StorageService.removeFriend('user1');

      expect(mockSet).toHaveBeenCalledWith({
        friend_identities_v2: [expect.objectContaining({ id: 'id-2', displayName: 'user2' })],
      });
      expect(mockRemove).toHaveBeenCalledWith(['profile:v2:leetcode:user1']);
      expect(mockSet).toHaveBeenCalledWith({
        profile_index_v2: ['leetcode:user2'],
      });
    });

    it('should handle case-insensitive removal', async () => {
      const mockIdentity = {
        id: 'id-1',
        displayName: 'TestUser',
        aliases: [],
        accounts: [{ platform: 'leetcode' as Platform, handle: 'TestUser', status: 'active' as const, lastFetched: Date.now() }],
        addedAt: Date.now(),
        updatedAt: Date.now()
      };

      const mockGet = jest.fn().mockResolvedValue({
        storage_migration_v2_done: true,
        friend_identities_v2: [mockIdentity],
        profile_index_v2: ['leetcode:testuser']
      });

      const mockSet = jest.fn().mockResolvedValue(undefined);
      const mockRemove = jest.fn().mockResolvedValue(undefined);
      
      (chrome.storage.local.get as jest.Mock) = mockGet;
      (chrome.storage.local.set as jest.Mock) = mockSet;
      (chrome.storage.local.remove as jest.Mock) = mockRemove;

      await StorageService.removeFriend('testuser');

      expect(mockSet).toHaveBeenCalledWith({ friend_identities_v2: [] });
      expect(mockRemove).toHaveBeenCalledWith(['profile:v2:leetcode:testuser']);
    });
  });

  describe('getFriends', () => {
    it('should return empty array when no friends', async () => {
      const mockGet = jest.fn().mockResolvedValue({
        storage_migration_v2_done: true,
        friend_identities_v2: []
      });
      (chrome.storage.local.get as jest.Mock) = mockGet;

      const friends = await StorageService.getFriends();

      expect(friends).toEqual([]);
    });

    it('should return all friends', async () => {
      const mockIdentities = [
        {
          id: 'id-1',
          displayName: 'user1',
          aliases: [],
          accounts: [{ platform: 'leetcode' as Platform, handle: 'user1', status: 'active' as const, lastFetched: 123456 }],
          addedAt: 123456,
          updatedAt: 123456
        },
        {
          id: 'id-2',
          displayName: 'user2',
          aliases: [],
          accounts: [{ platform: 'leetcode' as Platform, handle: 'user2', status: 'active' as const, lastFetched: 789012 }],
          addedAt: 789012,
          updatedAt: 789012
        }
      ];

      const mockGet = jest.fn().mockResolvedValue({
        storage_migration_v2_done: true,
        friend_identities_v2: mockIdentities
      });
      (chrome.storage.local.get as jest.Mock) = mockGet;

      const friends = await StorageService.getFriends();

      expect(friends).toEqual([
        expect.objectContaining({ username: 'user1' }),
        expect.objectContaining({ username: 'user2' })
      ]);
    });
  });

  describe('saveProfile', () => {
    it('should save profile with individual key', async () => {
      const mockProfile = {
        username: 'testuser',
        platform: 'leetcode' as Platform,
        avatar: 'https://example.com/avatar.jpg',
        problemsSolved: {
          total: 100,
          easy: 50,
          medium: 30,
          hard: 20,
        },
        recentSubmissions: [],
        lastFetched: Date.now(),
      };

      const mockGet = jest.fn().mockResolvedValue({
        storage_migration_v2_done: true,
        profile_index_v2: []
      });
      const mockSet = jest.fn().mockResolvedValue(undefined);
      
      (chrome.storage.local.get as jest.Mock) = mockGet;
      (chrome.storage.local.set as jest.Mock) = mockSet;

      await StorageService.saveProfile(mockProfile);

      expect(mockSet).toHaveBeenCalledWith({
        'profile:v2:leetcode:testuser': expect.objectContaining({
          username: 'testuser',
        }),
      });
    });
  });

  describe('getProfile', () => {
    it('should retrieve profile by username', async () => {
      const mockProfile = {
        username: 'testuser',
        platform: 'leetcode' as Platform,
        totalSolved: 100,
      };

      const mockGet = jest.fn().mockResolvedValue({
        storage_migration_v2_done: true,
        'profile:v2:leetcode:testuser': mockProfile
      });
      (chrome.storage.local.get as jest.Mock) = mockGet;

      const profile = await StorageService.getProfile('testuser');

      expect(profile).toEqual(mockProfile);
    });

    it('should return null for non-existent profile', async () => {
      const mockGet = jest.fn().mockResolvedValue({
        storage_migration_v2_done: true
      });
      (chrome.storage.local.get as jest.Mock) = mockGet;

      const profile = await StorageService.getProfile('nonexistent');

      expect(profile).toBeNull();
    });
  });
});
