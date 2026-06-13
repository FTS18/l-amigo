import './codeforces.css';

chrome.storage.local.get(['cf_dark_mode'], (result) => {
  if (result.cf_dark_mode) {
    document.documentElement.classList.add('lamigo-cf-dark');
  }
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.cf_dark_mode) {
    if (changes.cf_dark_mode.newValue) {
      document.documentElement.classList.add('lamigo-cf-dark');
    } else {
      document.documentElement.classList.remove('lamigo-cf-dark');
    }
  }
});

// Inject quick add button
function injectAddButtons() {
  // Find all user links that don't already have the lamigo-processed class
  const userLinks = document.querySelectorAll<HTMLAnchorElement>('a[href^="/profile/"]:not(.lamigo-processed)');
  
  if (userLinks.length === 0) return;

  // Mark them as processed synchronously so subsequent observer triggers don't pick them up
  userLinks.forEach(link => link.classList.add('lamigo-processed'));
  
  chrome.storage.local.get(['friend_identities_v2', 'friends'], (result) => {
    // Collect all existing friends to avoid showing + for already-added people
    const friendUsernames = new Set<string>();
    const list = result.friend_identities_v2 || result.friends || [];
    list.forEach((f: any) => {
      // Cover all possible storage shapes
      if (f.username) friendUsernames.add(f.username.toLowerCase());
      if (f.displayName) friendUsernames.add(f.displayName.toLowerCase());
      if (Array.isArray(f.aliases)) {
        f.aliases.forEach((a: string) => friendUsernames.add(a.toLowerCase()));
      }
      if (Array.isArray(f.accounts)) {
        f.accounts.forEach((a: any) => {
          if (a.handle) friendUsernames.add(a.handle.toLowerCase());
        });
      }
    });

    userLinks.forEach(link => {
      const href = link.href;
      if (!href) return;
      
      let username = '';
      try {
        const url = new URL(href);
        const parts = url.pathname.split('/');
        if (parts[1] === 'profile' && parts[2]) {
          username = decodeURIComponent(parts[2]);
        }
      } catch (e) {
        // fallback
        username = link.getAttribute('href')?.replace('/profile/', '').split('/')[0] || '';
      }
      
      if (!username || username.trim() === '') return;
      
      // If already a friend, skip
      if (friendUsernames.has(username.toLowerCase())) return;

      const btn = document.createElement('button');
      btn.className = 'lamigo-add-btn';
      btn.title = 'Add to L\'Amigo';
      btn.innerHTML = '+';
      
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        btn.disabled = true;
        btn.innerHTML = '...';
        
        chrome.runtime.sendMessage({
          action: 'createIdentity',
          payload: {
            displayName: username,
            accounts: [{ platform: 'codeforces', handle: username }]
          }
        }, (response) => {
          if (response && response.success) {
            btn.innerHTML = '✓';
            btn.classList.add('lamigo-success');
            // Optimistically add to set
            friendUsernames.add(username.toLowerCase());
            setTimeout(() => {
              btn.remove();
            }, 2000);
          } else {
            btn.innerHTML = '+';
            btn.disabled = false;
            alert(response?.error || 'Failed to add friend');
          }
        });
      });
      
      // Insert right after the link
      link.insertAdjacentElement('afterend', btn);
    });
  });
}

// Observe DOM for dynamic content
const observer = new MutationObserver((mutations) => {
  let shouldInject = false;
  for (const mut of mutations) {
    if (mut.addedNodes.length > 0) {
      shouldInject = true;
      break;
    }
  }
  if (shouldInject) injectAddButtons();
});

if (document.body) {
  injectAddButtons();
  observer.observe(document.body, { childList: true, subtree: true });
} else {
  document.addEventListener('DOMContentLoaded', () => {
    injectAddButtons();
    observer.observe(document.body, { childList: true, subtree: true });
  });
}

