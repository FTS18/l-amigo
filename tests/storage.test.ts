import { StorageService } from '../src/services/storage';
import { DATA_LIMITS } from '../src/constants';

describe('StorageService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('addFriend', () => {
    it('should add a friend successfully', async () => {
      const mockGet = jest.fn().mockResolvedValue({ leetcode_friends: [] });
      const mockSet = jest.fn().mockResolvedValue(undefined);
      
      (chrome.storage.local.get as jest.Mock) = mockGet;
      (chrome.storage.local.set as jest.Mock) = mockSet;

      await StorageService.addFriend('testuser');

      expect(mockSet).toHaveBeenCalledWith({
        leetcode_friends: [
          {
            username: 'testuser',
            addedAt: expect.any(Number),
          },
        ],
      });
    });

    it('should reject duplicate friends', async () => {
      const mockGet = jest.fn().mockResolvedValue({
        leetcode_friends: [{ username: 'testuser', addedAt: Date.now() }],
      });
      
      (chrome.storage.local.get as jest.Mock) = mockGet;

      await expect(StorageService.addFriend('testuser')).rejects.toThrow(
        'Friend already added'
      );
    });

    it('should enforce max friends limit', async () => {
      const friends = Array.from({ length: DATA_LIMITS.MAX_FRIENDS }, (_, i) => ({
        username: `user${i}`,
        addedAt: Date.now(),
      }));

      const mockGet = jest.fn().mockResolvedValue({ leetcode_friends: friends });
      (chrome.storage.local.get as jest.Mock) = mockGet;

      await expect(StorageService.addFriend('newuser')).rejects.toThrow(
        `Maximum ${DATA_LIMITS.MAX_FRIENDS} friends allowed`
      );
    });

    it('should handle case-insensitive duplicates', async () => {
      const mockGet = jest.fn().mockResolvedValue({
        leetcode_friends: [{ username: 'TestUser', addedAt: Date.now() }],
      });
      
      (chrome.storage.local.get as jest.Mock) = mockGet;

      await expect(StorageService.addFriend('testuser')).rejects.toThrow(
        'Friend already added'
      );
    });
  });

  describe('removeFriend', () => {
    it('should remove a friend successfully', async () => {
      const mockGet = jest.fn()
        .mockResolvedValueOnce({
          leetcode_friends: [
            { username: 'user1', addedAt: Date.now() },
            { username: 'user2', addedAt: Date.now() },
          ],
        })
        .mockResolvedValueOnce({ leetcode_profile_index: ['user1', 'user2'] });

      const mockSet = jest.fn().mockResolvedValue(undefined);
      const mockRemove = jest.fn().mockResolvedValue(undefined);
      
      (chrome.storage.local.get as jest.Mock) = mockGet;
      (chrome.storage.local.set as jest.Mock) = mockSet;
      (chrome.storage.local.remove as jest.Mock) = mockRemove;

      await StorageService.removeFriend('user1');

      expect(mockSet).toHaveBeenCalledWith({
        leetcode_friends: [{ username: 'user2', addedAt: expect.any(Number) }],
      });
      expect(mockRemove).toHaveBeenCalledWith('profile:user1');
    });

    it('should handle case-insensitive removal', async () => {
      const mockGet = jest.fn()
        .mockResolvedValueOnce({
          leetcode_friends: [{ username: 'TestUser', addedAt: Date.now() }],
        })
        .mockResolvedValueOnce({ leetcode_profile_index: ['testuser'] });

      const mockSet = jest.fn().mockResolvedValue(undefined);
      const mockRemove = jest.fn().mockResolvedValue(undefined);
      
      (chrome.storage.local.get as jest.Mock) = mockGet;
      (chrome.storage.local.set as jest.Mock) = mockSet;
      (chrome.storage.local.remove as jest.Mock) = mockRemove;

      await StorageService.removeFriend('testuser');

      expect(mockSet).toHaveBeenCalledWith({ leetcode_friends: [] });
      expect(mockRemove).toHaveBeenCalledWith('profile:testuser');
    });
  });

  describe('getFriends', () => {
    it('should return empty array when no friends', async () => {
      const mockGet = jest.fn().mockResolvedValue({});
      (chrome.storage.local.get as jest.Mock) = mockGet;

      const friends = await StorageService.getFriends();

      expect(friends).toEqual([]);
    });

    it('should return all friends', async () => {
      const mockFriends = [
        { username: 'user1', addedAt: 123456 },
        { username: 'user2', addedAt: 789012 },
      ];

      const mockGet = jest.fn().mockResolvedValue({ leetcode_friends: mockFriends });
      (chrome.storage.local.get as jest.Mock) = mockGet;

      const friends = await StorageService.getFriends();

      expect(friends).toEqual(mockFriends);
    });
  });

  describe('saveProfile', () => {
    it('should save profile with individual key', async () => {
      const mockProfile = {
        username: 'testuser',
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

      const mockGet = jest.fn().mockResolvedValue({ leetcode_profile_index: [] });
      const mockSet = jest.fn().mockResolvedValue(undefined);
      
      (chrome.storage.local.get as jest.Mock) = mockGet;
      (chrome.storage.local.set as jest.Mock) = mockSet;

      await StorageService.saveProfile(mockProfile);

      expect(mockSet).toHaveBeenCalledWith({
        'profile:testuser': expect.objectContaining({
          username: 'testuser',
        }),
      });
    });
  });

  describe('getProfile', () => {
    it('should retrieve profile by username', async () => {
      const mockProfile = {
        username: 'testuser',
        totalSolved: 100,
      };

      const mockGet = jest.fn().mockResolvedValue({ 'profile:testuser': mockProfile });
      (chrome.storage.local.get as jest.Mock) = mockGet;

      const profile = await StorageService.getProfile('testuser');

      expect(profile).toEqual(mockProfile);
    });

    it('should return null for non-existent profile', async () => {
      const mockGet = jest.fn().mockResolvedValue({});
      (chrome.storage.local.get as jest.Mock) = mockGet;

      const profile = await StorageService.getProfile('nonexistent');

      expect(profile).toBeNull();
    });
  });
});
