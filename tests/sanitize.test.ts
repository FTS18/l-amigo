import {
  sanitizeUsername,
  sanitizeUrl,
  extractUsernameFromUrl,
  validateGitHubToken,
  validateRepositoryName,
  sanitizeHtml,
} from '../src/utils/sanitize';

describe('sanitize utilities', () => {
  describe('sanitizeUsername', () => {
    it('should sanitize valid username', () => {
      expect(sanitizeUsername('TestUser123')).toBe('testuser123');
      expect(sanitizeUsername('user_name-123')).toBe('user_name-123');
    });

    it('should remove invalid characters', () => {
      expect(sanitizeUsername('user@name!')).toBe('username');
      expect(sanitizeUsername('test user')).toBe('testuser');
    });

    it('should throw error for empty username after sanitization', () => {
      expect(() => sanitizeUsername('!!!')).toThrow('Username cannot be empty');
    });

    it('should throw error for short username', () => {
      expect(() => sanitizeUsername('ab')).toThrow('Username must be at least 3 characters');
    });

    it('should throw error for invalid input', () => {
      expect(() => sanitizeUsername(null as any)).toThrow('Invalid username input');
      expect(() => sanitizeUsername(123 as any)).toThrow('Invalid username input');
      expect(() => sanitizeUsername('' as any)).toThrow('Invalid username input');
    });

    it('should truncate long usernames', () => {
      const longUsername = 'a'.repeat(100);
      const result = sanitizeUsername(longUsername);
      expect(result.length).toBe(50);
    });
  });

  describe('sanitizeUrl', () => {
    it('should accept valid LeetCode URLs', () => {
      const url = 'https://leetcode.com/u/testuser';
      expect(sanitizeUrl(url)).toBe(url);
    });

    it('should throw error for non-LeetCode URLs', () => {
      expect(() => sanitizeUrl('https://google.com')).toThrow('URL must be from leetcode.com');
    });

    it('should throw error for invalid URL format', () => {
      expect(() => sanitizeUrl('not-a-url')).toThrow('Invalid URL');
    });

    it('should throw error for empty input', () => {
      expect(() => sanitizeUrl('')).toThrow('Invalid URL input');
      expect(() => sanitizeUrl(null as any)).toThrow('Invalid URL input');
    });
  });

  describe('extractUsernameFromUrl', () => {
    it('should extract username from /u/ format', () => {
      expect(extractUsernameFromUrl('https://leetcode.com/u/john_doe')).toBe('john_doe');
    });

    it('should extract username from profile URL', () => {
      expect(extractUsernameFromUrl('https://leetcode.com/john_doe/')).toBe('john_doe');
    });

    it('should sanitize extracted username', () => {
      expect(extractUsernameFromUrl('https://leetcode.com/u/Test_User')).toBe('test_user');
    });

    it('should throw error for invalid URL', () => {
      expect(() => extractUsernameFromUrl('https://google.com')).toThrow('Failed to extract username');
    });
  });

  describe('validateGitHubToken', () => {
    it('should accept valid ghp_ token', () => {
      const token = 'ghp_' + 'x'.repeat(36);
      expect(validateGitHubToken(token)).toBe(true);
    });

    it('should accept valid github_pat_ token', () => {
      const token = 'github_pat_' + 'x'.repeat(50);
      expect(validateGitHubToken(token)).toBe(true);
    });

    it('should reject invalid tokens', () => {
      expect(validateGitHubToken('invalid')).toBe(false);
      expect(validateGitHubToken('ghp_short')).toBe(false);
      expect(validateGitHubToken('')).toBe(false);
      expect(validateGitHubToken(null as any)).toBe(false);
    });
  });

  describe('validateRepositoryName', () => {
    it('should accept valid repository names', () => {
      expect(validateRepositoryName('my-repo')).toBe(true);
      expect(validateRepositoryName('my_repo_123')).toBe(true);
      expect(validateRepositoryName('MyRepo')).toBe(true);
    });

    it('should reject invalid repository names', () => {
      expect(validateRepositoryName('my repo')).toBe(false);
      expect(validateRepositoryName('my@repo')).toBe(false);
      expect(validateRepositoryName('')).toBe(false);
      expect(validateRepositoryName(null as any)).toBe(false);
    });

    it('should reject too long names', () => {
      const longName = 'a'.repeat(101);
      expect(validateRepositoryName(longName)).toBe(false);
    });
  });

  describe('sanitizeHtml', () => {
    it('should escape HTML special characters', () => {
      expect(sanitizeHtml('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;'
      );
    });

    it('should escape ampersands', () => {
      expect(sanitizeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
    });

    it('should handle empty input', () => {
      expect(sanitizeHtml('')).toBe('');
      expect(sanitizeHtml(null as any)).toBe('');
    });
  });
});
