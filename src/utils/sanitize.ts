export function sanitizeUsername(input: string): string {
  if (!input || typeof input !== 'string') {
    throw new Error('Invalid username input');
  }

  const sanitized = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 50);

  if (sanitized.length === 0) {
    throw new Error('Username cannot be empty');
  }

  if (sanitized.length < 3) {
    throw new Error('Username must be at least 3 characters');
  }

  return sanitized;
}

export function sanitizeUrl(input: string): string {
  if (!input || typeof input !== 'string') {
    throw new Error('Invalid URL input');
  }

  try {
    const url = new URL(input.trim());
    
    if (!url.hostname.includes('leetcode.com')) {
      throw new Error('URL must be from leetcode.com');
    }

    if (!url.pathname.includes('/')) {
      throw new Error('Invalid LeetCode URL format');
    }

    return url.toString();
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Invalid URL format');
    }
    throw error;
  }
}

export function extractUsernameFromUrl(url: string): string {
  try {
    const sanitizedUrl = sanitizeUrl(url);
    const urlObj = new URL(sanitizedUrl);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    
    const usernameIndex = pathParts.indexOf('u') + 1;
    if (usernameIndex > 0 && usernameIndex < pathParts.length) {
      return sanitizeUsername(pathParts[usernameIndex]);
    }

    if (pathParts.length > 0) {
      return sanitizeUsername(pathParts[pathParts.length - 1]);
    }

    throw new Error('Could not extract username from URL');
  } catch (error) {
    throw new Error(`Failed to extract username: ${(error as Error).message}`);
  }
}

export function validateGitHubToken(token: string): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }

  const trimmed = token.trim();
  
  if (trimmed.startsWith('ghp_') && trimmed.length === 40) {
    return true;
  }
  
  if (trimmed.startsWith('github_pat_') && trimmed.length > 40) {
    return true;
  }

  return false;
}

export function validateRepositoryName(repo: string): boolean {
  if (!repo || typeof repo !== 'string') {
    return false;
  }

  const pattern = /^[a-zA-Z0-9_-]+$/;
  const trimmed = repo.trim();
  
  return pattern.test(trimmed) && trimmed.length > 0 && trimmed.length <= 100;
}

export function sanitizeHtml(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}
