const fs = require('fs');
const path = require('path');

const COMPANY_DISPLAY_NAMES = {
  'google': 'Google',
  'amazon': 'Amazon',
  'facebook': 'Meta',
  'microsoft': 'Microsoft',
  'apple': 'Apple',
  'uber': 'Uber',
  'bloomberg': 'Bloomberg',
  'netflix': 'Netflix',
  'adobe': 'Adobe',
  'bytedance': 'ByteDance',
  'linkedin': 'LinkedIn',
  'twitter': 'Twitter (X)',
  'salesforce': 'Salesforce',
  'atlassian': 'Atlassian',
  'oracle': 'Oracle',
  'cisco': 'Cisco',
  'walmart': 'Walmart',
  'goldman-sachs': 'Goldman Sachs',
  'jpmorgan': 'JPMorgan',
  'morgan-stanley': 'Morgan Stanley',
  'paypal': 'PayPal',
  'stripe': 'Stripe',
  'spotify': 'Spotify',
  'snapchat': 'Snapchat',
  'pinterest': 'Pinterest',
  'airbnb': 'Airbnb',
  'intuit': 'Intuit',
  'ebay': 'eBay',
  'visa': 'Visa',
  'nvidia': 'Nvidia',
  'qualcomm': 'Qualcomm',
  'de-shaw': 'DE Shaw',
  'citadel': 'Citadel',
  'two-sigma': 'Two Sigma',
  'jane-street': 'Jane Street',
  'flipkart': 'Flipkart',
  'servicenow': 'ServiceNow',
  'tesla': 'Tesla',
  'reddit': 'Reddit',
  'roblox': 'Roblox',
  'doordash': 'DoorDash',
  'palantir': 'Palantir',
  'dropbox': 'Dropbox',
  'lyft': 'Lyft',
  'square': 'Block (Square)',
  'twilio': 'Twilio',
  'vmware': 'VMware',
  'samsung': 'Samsung',
  'infosys': 'Infosys',
  'zoho': 'Zoho'
};

function formatSlugToTitle(slug) {
  return slug
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

async function build() {
  const companyKeys = Object.keys(COMPANY_DISPLAY_NAMES);
  const problemToCompanies = {};
  const problemMeta = {};
  const companyCounts = {};
  const companyWiseSheet = [];

  console.log(`Fetching CSVs for ${companyKeys.length} companies...`);

  for (const key of companyKeys) {
    const displayName = COMPANY_DISPLAY_NAMES[key];
    const url = `https://raw.githubusercontent.com/krishnadey30/LeetCode-Questions-CompanyWise/master/${key}_alltime.csv`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`Failed to fetch ${key}: ${res.status}`);
        continue;
      }
      const text = await res.text();
      const lines = text.split('\n');
      let count = 0;

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Parse CSV fields carefully: ID,Title,Acceptance,Difficulty,Frequency,Leetcode Question Link
        // Title might contain commas if quoted, so regex match link at end first
        const linkMatch = line.match(/(https?:\/\/(?:www\.)?leetcode\.com\/problems\/([a-z0-9\-]+)[^\s,]*)/i);
        if (!linkMatch) continue;

        const slug = linkMatch[2].toLowerCase();
        const beforeLink = line.slice(0, linkMatch.index).trim().replace(/,\s*$/, '');
        const parts = beforeLink.split(',');

        let title = '';
        let difficulty = 'Medium';

        if (parts.length >= 4) {
          // ID = parts[0], Difficulty is parts[parts.length - 2]
          const diffCandidate = parts[parts.length - 2]?.trim();
          if (['Easy', 'Medium', 'Hard'].includes(diffCandidate)) {
            difficulty = diffCandidate;
            title = parts.slice(1, parts.length - 3).join(',').replace(/^"|"$/g, '').trim();
          } else {
            // Check parts[3]
            const diffCandidate2 = parts[3]?.trim();
            if (['Easy', 'Medium', 'Hard'].includes(diffCandidate2)) {
              difficulty = diffCandidate2;
              title = parts.slice(1, 3).join(',').replace(/^"|"$/g, '').trim();
            }
          }
        }

        if (!title) {
          title = formatSlugToTitle(slug);
        }

        if (!['Easy', 'Medium', 'Hard'].includes(difficulty)) {
          difficulty = 'Medium';
        }

        if (!problemToCompanies[slug]) {
          problemToCompanies[slug] = [];
        }
        if (!problemToCompanies[slug].includes(displayName)) {
          problemToCompanies[slug].push(displayName);
        }

        if (!problemMeta[slug]) {
          problemMeta[slug] = { title, difficulty };
        }

        // Add to companyWise sheet under this company category
        companyWiseSheet.push({
          title,
          titleSlug: slug,
          difficulty,
          category: displayName,
          platform: 'leetcode',
          url: `https://leetcode.com/problems/${slug}/`
        });

        count++;
      }

      companyCounts[displayName] = count;
      console.log(`Processed ${displayName}: ${count} problems`);
    } catch (e) {
      console.error(`Error processing ${key}:`, e.message);
    }
  }

  // Sorted list of companies by problem count
  const sortedCompanies = Object.keys(companyCounts)
    .sort((a, b) => companyCounts[b] - companyCounts[a])
    .map(name => ({ name, count: companyCounts[name] }));

  const tagsData = {
    problems: problemToCompanies,
    problemMeta,
    companies: sortedCompanies
  };

  const tagsPath = path.resolve(__dirname, '../public/data/company_tags.json');
  fs.writeFileSync(tagsPath, JSON.stringify(tagsData, null, 2), 'utf8');
  console.log(`Saved company_tags.json with ${Object.keys(problemToCompanies).length} unique problems.`);

  const sheetPath = path.resolve(__dirname, '../public/sheets/companyWise.json');
  fs.writeFileSync(sheetPath, JSON.stringify(companyWiseSheet, null, 2), 'utf8');
  console.log(`Saved companyWise.json with ${companyWiseSheet.length} company problem entries.`);
}

build();
