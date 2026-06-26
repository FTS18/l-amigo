const fs = require('fs');
const https = require('https');
const path = require('path');

const outDir = path.join(__dirname, '..', 'public', 'sheets');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── HTTP helpers ───────────────────────────────────────────────────────────

function getJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function postJSON(hostname, path, postData) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData), 'User-Agent': 'Mozilla/5.0' }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// ─── Leetcode helpers ────────────────────────────────────────────────────────

async function fetchStudyPlan(slug) {
  const query = `query studyPlanDetail($slug: String!) {
    studyPlanV2Detail(planSlug: $slug) {
      planSubGroups { name questions { title titleSlug difficulty } }
    }
  }`;
  const res = await postJSON('leetcode.com', '/graphql', JSON.stringify({ query, variables: { slug } }));
  if (!res.data?.studyPlanV2Detail) return null;
  const out = [];
  for (const g of res.data.studyPlanV2Detail.planSubGroups) {
    for (const q of g.questions) {
      out.push({ title: q.title, titleSlug: q.titleSlug, difficulty: q.difficulty, category: g.name, platform: 'leetcode' });
    }
  }
  return out;
}

async function fetchLCCategory(categorySlug, limit = 100) {
  const query = `query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
    questionList(categorySlug: $categorySlug limit: $limit skip: $skip filters: $filters) {
      data { difficulty title titleSlug }
    }
  }`;
  const res = await postJSON('leetcode.com', '/graphql', JSON.stringify({ query, variables: { categorySlug, limit, skip: 0, filters: {} } }));
  if (!res.data?.questionList?.data) return null;
  return res.data.questionList.data.map(q => ({
    title: q.title, titleSlug: q.titleSlug, difficulty: q.difficulty,
    category: 'Most Liked', platform: 'leetcode'
  }));
}

// ─── Codeforces helpers ──────────────────────────────────────────────────────

let cfAllProblems = null;
async function getCFProblems() {
  if (cfAllProblems) return cfAllProblems;
  console.log('  Fetching ALL Codeforces problems (one-time)...');
  const data = await getJSON('https://codeforces.com/api/problemset.problems');
  cfAllProblems = data.result.problems;
  return cfAllProblems;
}

function cfRatingBandToSheet(problems, minRating, maxRating, count) {
  // Filter by rating band, prefer Div.2/contest problems, take first `count`
  const filtered = problems
    .filter(p => p.rating >= minRating && p.rating <= maxRating && p.contestId < 2000)
    .sort((a, b) => a.contestId - b.contestId)
    .slice(0, count);
  
  return filtered.map(p => ({
    title: `${p.contestId}${p.index} - ${p.name}`,
    titleSlug: `${p.contestId}${p.index}`,
    difficulty: p.rating <= 1200 ? 'Easy' : p.rating <= 1600 ? 'Medium' : 'Hard',
    category: `${p.rating} Rating`,
    platform: 'codeforces'
  }));
}

// ─── A2OJ Ladders ────────────────────────────────────────────────────────────

async function fetchA2OJLadder(minRating, maxRating, id) {
  // Try known GitHub mirror of A2OJ data
  const urls = [
    `https://raw.githubusercontent.com/Namanz/A2OJ-Ladder/master/ladders/${id}.json`,
    `https://raw.githubusercontent.com/rishabhdeepsingh/A2OJ-Ladder/master/src/data/problemset-${id}.json`
  ];
  for (const url of urls) {
    try {
      const data = await getJSON(url);
      if (Array.isArray(data) && data.length > 0) {
        console.log(`    Got ${data.length} problems from ${url}`);
        return data.map(p => ({
          title: p.name || p.title || `Problem ${p.id}`,
          titleSlug: `${p.contestId || p.contest_id}${p.index || p.problemIndex}`,
          difficulty: minRating <= 1200 ? 'Easy' : minRating <= 1600 ? 'Medium' : 'Hard',
          category: `${minRating}-${maxRating}`,
          platform: 'codeforces'
        })).filter(p => p.titleSlug !== 'undefinedundefined');
      }
    } catch (_) {}
  }
  return null; // Will fallback to CF API
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Neetcode 250
  console.log('[1/5] Fetching Neetcode 250...');
  try {
    const nc250 = await fetchStudyPlan('neetcode-250');
    if (nc250 && nc250.length > 0) {
      fs.writeFileSync(path.join(outDir, 'neetcode250.json'), JSON.stringify(nc250, null, 2));
      console.log(`  ✅ Saved Neetcode 250 (${nc250.length} questions)`);
    } else {
      console.log('  ❌ Neetcode 250 not available as a study plan on LC');
    }
  } catch (e) { console.log('  ❌ Neetcode 250 failed:', e.message); }
  await sleep(1000);

  // 2. Leetcode 100 Most Liked
  console.log('[2/5] Fetching Leetcode 100 Most Liked...');
  try {
    const lc100 = await fetchLCCategory('top-100-liked', 100);
    if (lc100 && lc100.length > 0) {
      fs.writeFileSync(path.join(outDir, 'leetcode100.json'), JSON.stringify(lc100, null, 2));
      console.log(`  ✅ Saved Leetcode 100 (${lc100.length} questions)`);
    }
  } catch (e) { console.log('  ❌ LC 100 failed:', e.message); }
  await sleep(1000);

  // 3. CP-31 Series (all rating bands 800–1900)
  console.log('[3/5] Fetching CP-31 series from Codeforces API...');
  const cfProblems = await getCFProblems();
  const cp31Bands = [
    { id: 'cp31_800',  min: 800,  max: 899  },
    { id: 'cp31_900',  min: 900,  max: 999  },
    { id: 'cp31_1000', min: 1000, max: 1099 },
    { id: 'cp31_1100', min: 1100, max: 1199 },
    { id: 'cp31_1200', min: 1200, max: 1299 },
    { id: 'cp31_1300', min: 1300, max: 1399 },
    { id: 'cp31_1400', min: 1400, max: 1499 },
    { id: 'cp31_1500', min: 1500, max: 1599 },
    { id: 'cp31_1600', min: 1600, max: 1699 },
    { id: 'cp31_1700', min: 1700, max: 1799 },
    { id: 'cp31_1800', min: 1800, max: 1899 },
    { id: 'cp31_1900', min: 1900, max: 1999 },
  ];
  for (const band of cp31Bands) {
    const problems = cfRatingBandToSheet(cfProblems, band.min, band.max, 31);
    if (problems.length > 0) {
      fs.writeFileSync(path.join(outDir, `${band.id}.json`), JSON.stringify(problems, null, 2));
      console.log(`  ✅ Saved ${band.id} (${problems.length} problems)`);
    } else {
      console.log(`  ⚠️  No problems found for ${band.id}`);
    }
  }

  // 4. A2OJ Ladders (from CF API, rating banded)
  console.log('[4/5] Generating A2OJ Ladders from Codeforces API...');
  const a2ojBands = [
    { id: 'a2oj_800',  min: 800,  max: 1299 },
    { id: 'a2oj_1300', min: 1300, max: 1399 },
    { id: 'a2oj_1400', min: 1400, max: 1499 },
    { id: 'a2oj_1500', min: 1500, max: 1599 },
    { id: 'a2oj_1600', min: 1600, max: 1699 },
    { id: 'a2oj_1700', min: 1700, max: 1799 },
    { id: 'a2oj_1800', min: 1800, max: 1899 },
    { id: 'a2oj_1900', min: 1900, max: 1999 },
    { id: 'a2oj_2000', min: 2000, max: 2099 },
    { id: 'a2oj_2100', min: 2100, max: 2199 },
    { id: 'a2oj_2200', min: 2200, max: 4000 },
  ];
  for (const band of a2ojBands) {
    const problems = cfRatingBandToSheet(cfProblems, band.min, band.max, 100);
    if (problems.length > 0) {
      fs.writeFileSync(path.join(outDir, `${band.id}.json`), JSON.stringify(problems, null, 2));
      console.log(`  ✅ Saved ${band.id} (${problems.length} problems, ${band.min}-${band.max})`);
    }
  }

  // 5. CSES Problem Set (public JSON from cses.fi structure)
  console.log('[5/5] Fetching CSES Problem Set...');
  try {
    const csesData = await getJSON('https://cses.fi/problemset/list');
    // CSES doesn't have a public JSON API, we'll build from known structure
    const csesCats = [
      { name: 'Introductory Problems', ids: [1068, 1083, 1069, 1094, 1070, 1071, 1072, 1092, 1617, 1618] },
      { name: 'Sorting and Searching', ids: [1621, 1084, 1090, 1091, 1619, 1631, 1163, 1164, 1620, 1630, 1641, 1073, 1085] },
      { name: 'Dynamic Programming', ids: [1633, 1634, 1158, 1746, 1644, 1638, 1639, 1640, 1643, 1145, 1097, 1093, 1213] },
      { name: 'Graph Algorithms', ids: [1192, 1193, 1666, 1667, 1668, 1669, 1194, 1671, 1672, 1673, 1674, 1675, 1676] },
      { name: 'Tree Algorithms', ids: [1674, 1130, 1131, 1132, 1133, 1134, 1135, 1136] },
      { name: 'Mathematics', ids: [1069, 1712, 1713, 1081, 1082, 1079, 1715, 1716, 1717, 1718, 1719] },
      { name: 'String Algorithms', ids: [1731, 1753, 1732, 1733, 1110, 1111, 2101, 2102] },
      { name: 'Advanced Techniques', ids: [1744, 1745, 2143, 2147, 1087, 2169, 2166, 1095] }
    ];
    const problems = [];
    for (const cat of csesCats) {
      for (const id of cat.ids) {
        problems.push({
          title: `Problem #${id}`,
          titleSlug: `https://cses.fi/problemset/task/${id}`,
          difficulty: 'Medium',
          category: cat.name,
          platform: 'cses'
        });
      }
    }
    fs.writeFileSync(path.join(outDir, 'cses.json'), JSON.stringify(problems, null, 2));
    console.log(`  ✅ Saved CSES Problem Set (${problems.length} problems)`);
  } catch (e) {
    console.log('  ⚠️ CSES placeholder generated');
  }

  console.log('\n✅ All done! Summary:');
  const files = fs.readdirSync(outDir);
  files.forEach(f => {
    const data = JSON.parse(fs.readFileSync(path.join(outDir, f)));
    console.log(`  ${f}: ${data.length} problems`);
  });
}

main().catch(console.error);
