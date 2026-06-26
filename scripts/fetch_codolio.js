const https = require('https');
const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', 'public', 'sheets');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function getJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
    }).on('error', reject);
  });
}

// Sheets to fetch from Codolio API
const sheets = [
  { slug: 'strivers-a2z-dsa-sheet',            file: 'striversA2Z' },
  { slug: 'striver-sde-sheet',                 file: 'striverSDE' },
  { slug: 'love-babbar-sheet',                 file: 'loveBabbar' },
  { slug: 'neetcode-250',                      file: 'neetcode250' },
  { slug: 'neetcode-150',                      file: 'neetcode150' },
  { slug: 'blind-75',                          file: 'blind75' },
  { slug: 'leetcode-75',                       file: 'leetcode75' },
  { slug: 'top-interview-150',                 file: 'topInterview150' },
  { slug: 'leetcode-100-most-liked-questions', file: 'leetcode100' },
  { slug: 'arsh-dsa-sheet',                    file: 'arshDsa' },
  { slug: 'fraz-dsa-sheet',                    file: 'frazDsa' },
  { slug: '6-companies-30-days',               file: '6companies30days' },
  { slug: 'dsa-by-shradha-didi-and-aman',      file: 'shradhaAman' },
  { slug: 'code-army-sheet',                   file: 'codeArmy' },
  { slug: 'algomaster-300',                    file: 'algoMaster300' },
  { slug: 'striver-79',                        file: 'striver79' },
  { slug: 'algomaster-150',                    file: 'algoMaster150' },
  { slug: 'atharva-patil-s-150',               file: 'atharvaPatil150' },
  { slug: 'nishant-s-151-dsa-sheet',           file: 'nishant151' },
  { slug: 'algomaster-75',                     file: 'algoMaster75' },
  { slug: '20-essential-dsa-patterns',         file: 'kushalVijay' },
  { slug: 'manasi-deshmane-s-dsa',             file: 'manasiDeshmane' },
  { slug: 'dp-mastery-sheet',                  file: 'dpMastery' },
  { slug: 'graph-mastery-sheet',               file: 'graphMastery' },
  { slug: 'string-mastery-sheet',              file: 'stringMastery' },
  { slug: 'binary-search-mastery',             file: 'binarySearchMastery' },
  { slug: 'heap-mastery-sheet',                file: 'heapMastery' },
  { slug: 'striver-cp-sheet',                  file: 'striverCpSheet' },
  { slug: 'codeprime-cp-75',                   file: 'codeprime75' },
];

function mapPlatform(platform) {
  if (!platform) return 'leetcode';
  if (platform.toLowerCase().includes('codeforces')) return 'codeforces';
  if (platform.toLowerCase().includes('cses')) return 'cses';
  if (platform.toLowerCase().includes('gfg') || platform.toLowerCase().includes('geeks')) return 'gfg';
  return 'leetcode';
}

async function fetchSheet(slug, file) {
  const url = `https://node.codolio.com/api/question-tracker/v2/sheet/get-sheet-data-by-slug/${slug}`;
  console.log(`  Fetching ${slug}...`);
  
  const json = await getJSON(url);
  if (!json.data || !json.data.mappings) {
    console.log(`  ❌ No data for ${slug}:`, json.status?.message);
    return 0;
  }

  const mappings = json.data.mappings;
  const topicOrder = json.data.sheet?.config?.topicOrder || [];

  // Build a map of all mappings by id for ordering
  const mappingMap = {};
  mappings.forEach(m => { mappingMap[m._id] = m; });

  const problems = mappings.map(m => {
    const q = m.questionId;
    const platform = mapPlatform(q?.platform);
    let titleSlug = q?.slug || q?.questionSlug || m.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    
    // For CF problems
    if (platform === 'codeforces' && q?.problemUrl) {
      const cfMatch = q.problemUrl.match(/contest\/(\d+)\/problem\/([A-Z0-9]+)/i) || 
                      q.problemUrl.match(/problemset\/problem\/(\d+)\/([A-Z0-9]+)/i);
      if (cfMatch) titleSlug = `${cfMatch[1]}${cfMatch[2]}`;
    }

    return {
      title: m.title || q?.name || q?.title || 'Unknown',
      titleSlug,
      difficulty: q?.difficulty || 'Medium',
      category: m.topic || 'General',
      platform,
      youtubeLink: m.resource || undefined,
    };
  }).filter(p => p.titleSlug && p.titleSlug.length > 1);

  fs.writeFileSync(path.join(outDir, `${file}.json`), JSON.stringify(problems, null, 2));
  console.log(`  ✅ ${file}.json: ${problems.length} problems`);
  return problems.length;
}

async function main() {
  console.log('🚀 Fetching all sheets from Codolio API...\n');
  
  const results = {};
  for (const sheet of sheets) {
    try {
      const count = await fetchSheet(sheet.slug, sheet.file);
      results[sheet.file] = count;
      await sleep(500); // be polite
    } catch(e) {
      console.log(`  ❌ Failed ${sheet.slug}:`, e.message);
      results[sheet.file] = 0;
    }
  }

  console.log('\n📊 Final Summary:');
  Object.entries(results).forEach(([k,v]) => console.log(`  ${k}: ${v} problems`));
}

main().catch(console.error);
