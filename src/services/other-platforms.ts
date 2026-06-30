import { RecentSubmission } from '../types';
import { fetchWithTimeout } from '../utils/network';

export class OtherPlatformsService {

  /**
   * CSES: Scrape the user profile and problemset list.
   * Profile URL: https://cses.fi/user/{handle}
   * Note: CSES actually uses user ID, but some people use handle.
   * Tasks are usually linked as /problemset/task/{id}
   */
  static async getCsesSubmissions(handle: string): Promise<RecentSubmission[]> {
    try {
      let targetHandle = handle;
      if (isNaN(Number(handle))) {
        // Alphanumeric handle: fetch user page to find numeric ID or redirect target
        try {
          const profileRes = await fetch(`https://cses.fi/user/${handle}`);
          if (profileRes.ok) {
            const profileHtml = await profileRes.text();
            const idMatch = /\/problemset\/user\/(\d+)\//.exec(profileHtml);
            if (idMatch && idMatch[1]) {
              targetHandle = idMatch[1];
            } else {
              const finalUrl = profileRes.url;
              const urlMatch = /\/user\/(\d+)/.exec(finalUrl);
              if (urlMatch && urlMatch[1]) {
                targetHandle = urlMatch[1];
              }
            }
          }
        } catch (e) {
          console.warn('[CSES] Failed to resolve numeric ID for handle:', handle, e);
        }
      }

      // Fetch both the user profile page and the main problemset list page (which uses active login cookies)
      const [userRes, listRes] = await Promise.all([
        fetch(`https://cses.fi/problemset/user/${targetHandle}/`, { credentials: 'include' }).catch(() => null),
        fetch(`https://cses.fi/problemset/list/`, { credentials: 'include' }).catch(() => null)
      ]);

      const userText = userRes?.ok ? await userRes.text() : '';
      const listText = listRes?.ok ? await listRes.text() : '';

      const slugs = new Set<string>();

      // Regex 1: Matches problemset list format with "task-score icon full"
      const regexFull = /<a[^>]*href="\/problemset\/task\/(\d+)"[^>]*>(?:(?!<a[^>]*href="\/problemset\/task).)*?<span[^>]*class="task-score icon full"[^>]*>/gs;
      
      // Regex 2: Matches user profile page format where solved tasks might be listed with full score (e.g. 100) or task-score icon full
      const regexProfile = /<a[^>]*href="\/problemset\/task\/(\d+)"[^>]*>(?:(?!<a[^>]*href="\/problemset\/task).)*?(?:<span[^>]*class="task-score icon full"[^>]*>|<td>100<\/td>)/gs;

      for (const text of [userText, listText]) {
        if (!text) continue;
        let match;
        while ((match = regexFull.exec(text)) !== null) {
          slugs.add(match[1]);
        }
        while ((match = regexProfile.exec(text)) !== null) {
          slugs.add(match[1]);
        }
      }

      console.log(`[CSES Debug] Fetched for ${targetHandle}. UserHTML: ${userText.length}, ListHTML: ${listText.length}. Found ${slugs.size} slugs:`, Array.from(slugs));

      const slugsArray = Array.from(slugs);
      const results: RecentSubmission[] = [];
      const CHUNK_SIZE = 5;

      for (let i = 0; i < slugsArray.length; i += CHUNK_SIZE) {
        const chunk = slugsArray.slice(i, i + CHUNK_SIZE);
        const chunkResults = await Promise.all(chunk.map(async slug => {
          let lang = 'C++';
          let code = '';
          try {
            const res = await fetch(`https://cses.fi/problemset/view/${slug}/`, { credentials: 'include' });
            if (res.ok) {
              const text = await res.text();
              const match = /<td><td>(?:<a[^>]*>)?(C\+\+|Java|Python3?|Rust|Go|C|Haskell)(?:<\/a>)?<\/td>/.exec(text) || /<td>(?:<a[^>]*>)?(C\+\+|Java|Python3?|Rust|Go|C|Haskell)(?:<\/a>)?<\/td>/.exec(text);
              if (match) lang = match[1];

              const resultMatch = /href="(\/problemset\/result\/\d+\/)"/.exec(text);
              if (resultMatch) {
                const fullResultUrl = `https://cses.fi${resultMatch[1]}`;
                const resultRes = await fetch(fullResultUrl, { credentials: 'include' });
                if (resultRes.ok) {
                  const resultText = await resultRes.text();
                  const codeMatch = /<pre[^>]*>(.*?)<\/pre>/s.exec(resultText);
                  if (codeMatch) {
                    code = codeMatch[1]
                      .replace(/&lt;/g, '<')
                      .replace(/&gt;/g, '>')
                      .replace(/&amp;/g, '&')
                      .replace(/&quot;/g, '"')
                      .replace(/&#39;/g, "'");
                  }
                  const langMatch = /Language:<\/td><td>([^<]+)<\/td>/.exec(resultText);
                  if (langMatch && langMatch[1].trim()) {
                    lang = langMatch[1].trim();
                  }
                }
              }
            }
          } catch (e) {
            // ignore and fallback to C++
          }
          return {
            title: `CSES Task ${slug}`,
            titleSlug: slug, // CSES slugs are usually numeric IDs
            timestamp: Date.now(),
            statusDisplay: 'Accepted',
            lang,
            code: code || `// Solution for CSES Task ${slug}`,
            platform: 'cses' as any
          };
        }));
        results.push(...chunkResults);
        if (i + CHUNK_SIZE < slugsArray.length) {
          await new Promise(r => setTimeout(r, 400));
        }
      }

      return results;
    } catch (e) {
      console.error('CSES scrape error', e);
      return [];
    }
  }
}
