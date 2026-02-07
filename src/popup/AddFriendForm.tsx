import React, { useState } from 'react';

interface AddFriendFormProps {
  onAdd: (username: string) => Promise<void>;
  isDarkMode?: boolean;
}

export const AddFriendForm: React.FC<AddFriendFormProps> = ({ onAdd }) => {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  // Extract username from URL or return as-is if already a username
  const extractUsername = (input: string): string => {
    const trimmed = input.trim();
    
    // Check if it's a URL
    if (trimmed.includes('leetcode.com/')) {
      // Extract username from URL like: https://leetcode.com/username or leetcode.com/username
      const match = trimmed.match(/leetcode\.com\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    // Return as-is if it's just a username
    return trimmed;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const extractedUsername = extractUsername(username);
    if (!extractedUsername) return;

    setLoading(true);
    try {
      await onAdd(extractedUsername);
      setUsername('');
    } catch (error) {
      // Error is already handled in parent
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="add-friend-form" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Enter username or LeetCode profile URL"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        disabled={loading}
      />
      <button type="submit" disabled={loading || !username.trim()}>
        {loading ? 'Adding...' : '+ Add Friend'}
      </button>
    </form>
  );
};
