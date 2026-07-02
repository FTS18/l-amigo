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
  const cp31Problems = {
    cp31_800: ['1903A', '1901A', '1900A', '1899A', '1896A', '1890A', '1881A', '1878A', '1877A', '1873C', '1866A', '1862B', '1859A', '1858A', '1857A', '1853A', '1845A', '1837A', '1834A', '1831A', '1829B', '1814A', '1806A', '1805A', '1791C', '1789A', '1788A', '1783A', '1777A', '1766A', '1761A'],
    cp31_900: ['1904A', '1883B', '1878C', '1875A', '1869A', '1855B', '1850D', '1837B', '1828B', '1807D', '1794B', '1726A', '1696B', '1679A', '1675B', '1666D', '1665B', '1624B', '1607B', '1606A', '1593B', '1582B', '1559A', '1543A', '1537B', '1475A', '1471A', '1440B', '1380A', '1373B', '1374B'],
    cp31_1000: ['1913B', '1883C', '1876A', '1859B', '1849B', '1840C', '1831B', '1791D', '1765M', '1744C', '1725B', '1715B', '1704B', '1691B', '1690D', '1659A', '1632B', '1620B', '1614B', '1567B', '1506C', '1485A', '1474B', '1447B', '1438B', '1418A', '1411B', '1374C', '1362A', '1312B', '1155A'],
    cp31_1100: ['1917B', '1914C', '1904B', '1899C', '1899B', '1891B', '1873E', '1869B', '1850E', '1842B', '1832B', '1827A', '1826B', '1821B', '1820B', '1807G2', '1797B', '1791G1', '1791E', '1780B', '1742D', '1731B', '1708B', '1682B', '1673B', '1669F', '1656B', '1631B', '1618C', '1610B', '1511C'],
    cp31_1200: ['1914D', '1909B', '1872D', '1857C', '1848B', '1832C', '1808B', '1793C', '1790D', '1742E', '1734C', '1729D', '1704C', '1703E', '1692E', '1679B', '1671C', '1635C', '1594C', '1582C', '1541B', '1539C', '1536B', '1527B1', '1520D', '1514B', '1504B', '1497B', '1487B', '1433D', '1420B'],
    cp31_1300: ['1931D', '1927D', '1915E', '1881D', '1879C', '1857D', '1846E1', '1794C', '1775B', '1703F', '1676G', '1669H', '1612C', '1601A', '1561C', '1498B', '1470A', '1459B', '1372B', '1366B', '1364B', '1360D', '1294C', '1285B', '1237B', '1178B', '1119B', '1077C', '862B', '808B', '665C'],
    cp31_1400: ['1931E', '1919C', '1907D', '1904C', '1883G1', '1878E', '1837D', '1830A', '1771B', '1759D', '1714E', '1701C', '1692G', '1648A', '1634B', '1520E', '1519C', '1513B', '1475C', '1374D', '1362C', '1350B', '1320A', '1215B', '1195C', '1183D', '1167C', '1167B', '1143C', '1110B', '414B'],
    cp31_1500: ['1915F', '1891C', '1881E', '1872E', '1795C', '1776L', '1673C', '1659C', '1646C', '1516B', '1486B', '1466D', '1418C', '1416A', '1404A', '1338A', '1332C', '1325C', '1323B', '1201B', '1139C', '1133D', '1106D', '1101C', '1084C', '982C', '976C', '960B', '891A', '845C', '276C'],
    cp31_1600: ['1920C', '1907E', '1886C', '1856C', '1843E', '1833E', '1829G', '1798D', '1795D', '1781C', '1778C', '1775C', '1741E', '1730B', '1702E', '1698D', '1660D', '1633D', '1610C', '1555D', '1537E1', '1528A', '1498C', '1475E', '1458A', '1407C', '1398C', '1389B', '1349A', '1336A', '1305C'],
    cp31_1700: ['2050F', '2041D', '2018C', '2006A', '1999G2', '1983D', '1982D', '1948D', '1931F', '1893B', '1879D', '1833F', '1829H', '1826D', '1822G1', '1792D', '1777C', '1760G', '1735D', '1731C', '1715C', '1709D', '1695C', '1692H', '1690F', '1625C', '1598D', '1594D', '1557C', '1528B', '1516C'],
    cp31_1800: ['2022C', '2014E', '1974E', '1935D', '1915G', '1912K', '1824B1', '1805D', '1775D', '1768D', '1732C1', '1725M', '1709C', '1691D', '1517D', '1509C', '1491D', '1468J', '1466E', '1462F', '1446B', '1442B', '1437C', '1401D', '1396B', '1355C', '1338B', '1335E2', '1290B', '1286B', '1283D'],
    cp31_1900: ['2044F', '2042D', '2036F', '2014H', '2009G1', '2001D', '1994D', '1992F', '1986F', '1957D', '1950G', '1932F', '1925D', '1918D', '1912A', '1906E', '1902E', '1898D', '1882D', '1842D', '1819B', '1817B', '1799D1', '1794D', '1777D', '1759G', '1747D', '1744E2', '1739D', '1715D', '1700D']
  };

  function findCFProblem(problems, code) {
    const match = code.match(/^(\d+)(.+)$/);
    if (!match) return null;
    const contestId = parseInt(match[1]);
    const index = match[2];
    return problems.find(p => p.contestId === contestId && p.index === index);
  }

  const cp31Bands = [
    { id: 'cp31_800',  min: 800 },
    { id: 'cp31_900',  min: 900 },
    { id: 'cp31_1000', min: 1000 },
    { id: 'cp31_1100', min: 1100 },
    { id: 'cp31_1200', min: 1200 },
    { id: 'cp31_1300', min: 1300 },
    { id: 'cp31_1400', min: 1400 },
    { id: 'cp31_1500', min: 1500 },
    { id: 'cp31_1600', min: 1600 },
    { id: 'cp31_1700', min: 1700 },
    { id: 'cp31_1800', min: 1800 },
    { id: 'cp31_1900', min: 1900 },
  ];

  for (const band of cp31Bands) {
    const codes = cp31Problems[band.id] || [];
    const problems = [];
    for (const code of codes) {
      const p = findCFProblem(cfProblems, code);
      if (p) {
        problems.push({
          title: `${p.contestId}${p.index} - ${p.name}`,
          titleSlug: `${p.contestId}${p.index}`,
          difficulty: p.rating <= 1200 ? 'Easy' : p.rating <= 1600 ? 'Medium' : 'Hard',
          category: `${p.rating} Rating`,
          platform: 'codeforces'
        });
      } else {
        // Fallback placeholder
        problems.push({
          title: `${code} - Problem ${code}`,
          titleSlug: code,
          difficulty: band.min <= 1200 ? 'Easy' : band.min <= 1600 ? 'Medium' : 'Hard',
          category: `${band.min} Rating`,
          platform: 'codeforces'
        });
        console.log(`  ⚠️  Problem ${code} not found in Codeforces API list, using fallback.`);
      }
    }
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
