import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './ErrorBoundary';

// Mock Chrome APIs for previewing in local browser
declare const __DEV__: boolean;

if (typeof __DEV__ !== 'undefined' && __DEV__) {
  const connect = (): void => {
    const socket = new WebSocket("ws://localhost:9091");
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(String(event.data));
        if (payload?.type === "reload") {
          window.location.reload();
        }
      } catch {}
    };
    socket.onerror = () => socket.close();
    socket.onclose = () => globalThis.setTimeout(connect, 1000);
  };
  connect();
}
if (typeof chrome === 'undefined' || !chrome.storage) {
  console.log('Using browser mock of chrome storage APIs');
  const mockStorage: Record<string, any> = {
    onboarding_complete: true,
    own_username: 'demo_user',
    own_display_name: 'Demo User',
    own_codeforces_handle: 'tourist',
    friends: [
      {
        id: 'tourist',
        username: 'tourist',
        displayName: 'Gennady',
        accounts: [
          { platform: 'leetcode', username: 'tourist' },
          { platform: 'codeforces', username: 'tourist' }
        ]
      },
      {
        id: 'benq',
        username: 'benq',
        displayName: 'Benjamin Qi',
        accounts: [
          { platform: 'leetcode', username: 'benq' },
          { platform: 'codeforces', username: 'benq' }
        ]
      }
    ],
    darkMode: true,
    profile_index_v2: [
      'profile:v2:leetcode:demo_user',
      'profile:v2:leetcode:tourist',
      'profile:v2:codeforces:tourist',
      'profile:v2:leetcode:benq',
      'profile:v2:codeforces:benq'
    ],
    'profile:v2:leetcode:demo_user': {
      platform: 'leetcode',
      username: 'demo_user',
      realName: 'Demo User',
      avatar: 'https://assets.leetcode.com/users/default_avatar.jpg',
      ranking: 15420,
      problemsSolved: { total: 420, easy: 200, medium: 170, hard: 50 },
      contestRating: 1950,
      contestRanking: 8500,
      contestCount: 15,
      lastFetched: Date.now(),
      recentSubmissions: [
        { title: 'Two Sum', titleSlug: 'two-sum', timestamp: Date.now() - 3600 * 1000, difficulty: 'Easy', status: 'Accepted' },
        { title: 'Add Two Numbers', titleSlug: 'add-two-numbers', timestamp: Date.now() - 7200 * 1000, difficulty: 'Medium', status: 'Accepted' }
      ]
    },
    'profile:v2:leetcode:tourist': {
      platform: 'leetcode',
      username: 'tourist',
      realName: 'Gennady Korotkevich',
      avatar: '',
      ranking: 120,
      problemsSolved: { total: 1850, easy: 450, medium: 900, hard: 500 },
      contestRating: 3250,
      contestRanking: 2,
      contestCount: 45,
      lastFetched: Date.now(),
      recentSubmissions: [
        { title: 'Median of Two Sorted Arrays', titleSlug: 'median-of-two-sorted-arrays', timestamp: Date.now() - 1800 * 1000, difficulty: 'Hard', status: 'Accepted' }
      ]
    },
    'profile:v2:codeforces:tourist': {
      platform: 'codeforces',
      username: 'tourist',
      realName: 'Gennady Korotkevich',
      avatar: 'https://userpic.codeforces.org/33747/avatar/7f2f11ffc91b5c92.jpg',
      ranking: 1,
      problemsSolved: { total: 3200, easy: 800, medium: 1200, hard: 1200 },
      contestRating: 3842,
      contestRanking: 1,
      contestCount: 180,
      lastFetched: Date.now(),
      recentSubmissions: [
        { title: 'A. Watermelon', titleSlug: '4/A', timestamp: Date.now() - 4500 * 1000, rating: 800, status: 'Accepted' }
      ],
      codeforcesStats: {
        rankLabel: 'Legendary Grandmaster',
        ratingDelta: 12,
        dailyPulse: 5,
        divisionCounts: { div1: 150, div2: 30, div3: 0, other: 0 }
      }
    },
    'profile:v2:leetcode:benq': {
      platform: 'leetcode',
      username: 'benq',
      realName: 'Benjamin Qi',
      avatar: '',
      ranking: 85,
      problemsSolved: { total: 2100, easy: 500, medium: 1100, hard: 500 },
      contestRating: 2950,
      contestRanking: 12,
      contestCount: 50,
      lastFetched: Date.now(),
      recentSubmissions: [
        { title: 'Edit Distance', titleSlug: 'edit-distance', timestamp: Date.now() - 9000 * 1000, difficulty: 'Hard', status: 'Accepted' }
      ]
    },
    'profile:v2:codeforces:benq': {
      platform: 'codeforces',
      username: 'benq',
      realName: 'Benjamin Qi',
      avatar: '',
      ranking: 5,
      problemsSolved: { total: 2500, easy: 600, medium: 1000, hard: 900 },
      contestRating: 3520,
      contestRanking: 5,
      contestCount: 120,
      lastFetched: Date.now(),
      recentSubmissions: [
        { title: 'C. Beautiful Numbers', titleSlug: '300/C', timestamp: Date.now() - 12000 * 1000, rating: 1900, status: 'Accepted' }
      ],
      codeforcesStats: {
        rankLabel: 'International Grandmaster',
        ratingDelta: -8,
        dailyPulse: 2,
        divisionCounts: { div1: 100, div2: 20, div3: 0, other: 0 }
      }
    }
  };

  const chromeMock = {
    storage: {
      local: {
        get: (keys: any) => {
          return new Promise((resolve) => {
            const res: Record<string, any> = {};
            if (typeof keys === 'string') {
              const val = localStorage.getItem(`mock_storage_${keys}`);
              res[keys] = val ? JSON.parse(val) : mockStorage[keys];
            } else if (Array.isArray(keys)) {
              keys.forEach(k => {
                const val = localStorage.getItem(`mock_storage_${k}`);
                res[k] = val ? JSON.parse(val) : mockStorage[k];
              });
            } else if (keys && typeof keys === 'object') {
              Object.keys(keys).forEach(k => {
                const val = localStorage.getItem(`mock_storage_${k}`);
                res[k] = val ? JSON.parse(val) : (mockStorage[k] !== undefined ? mockStorage[k] : keys[k]);
              });
            } else {
              Object.keys(mockStorage).forEach(k => {
                const val = localStorage.getItem(`mock_storage_${k}`);
                res[k] = val ? JSON.parse(val) : mockStorage[k];
              });
            }
            resolve(res);
          });
        },
        set: (items: Record<string, any>) => {
          return new Promise<void>((resolve) => {
            Object.keys(items).forEach(k => {
              localStorage.setItem(`mock_storage_${k}`, JSON.stringify(items[k]));
            });
            resolve();
          });
        },
        remove: (keys: string | string[]) => {
          return new Promise<void>((resolve) => {
            const arr = Array.isArray(keys) ? keys : [keys];
            arr.forEach(k => localStorage.removeItem(`mock_storage_${k}`));
            resolve();
          });
        },
        clear: () => {
          return new Promise<void>((resolve) => {
            Object.keys(localStorage).forEach(k => {
              if (k.startsWith('mock_storage_')) localStorage.removeItem(k);
            });
            resolve();
          });
        }
      }
    },
    runtime: {
      lastError: null,
      sendMessage: () => {}
    }
  };
  (window as any).chrome = chromeMock;
}

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
