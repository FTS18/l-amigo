export const SHEET_METADATA = [
  // ── Striver (takeUforward) ───────────────────────────────────────────────
  { id: 'striversA2Z', name: 'Strivers A2Z DSA Sheet', group: 'Striver', questions: 455, available: true },
  { id: 'striverSDE', name: 'Striver SDE Sheet', group: 'Striver', questions: 191, available: true },
  { id: 'striver79', name: 'Striver 79', group: 'Striver', questions: 79, available: true },
  { id: 'striverCpSheet', name: 'Striver CP Sheet', group: 'Striver', questions: 30, available: true },

  // ── NeetCode ─────────────────────────────────────────────────────────────
  { id: 'neetcode250', name: 'Neetcode 250', group: 'NeetCode', questions: 250, available: true },
  { id: 'neetcode150', name: 'Neetcode 150', group: 'NeetCode', questions: 150, available: true },
  { id: 'blind75', name: 'Blind 75', group: 'NeetCode', questions: 75, available: true },

  // ── AlgoMaster ───────────────────────────────────────────────────────────
  { id: 'algoMaster300', name: 'AlgoMaster 300', group: 'AlgoMaster', questions: 300, available: true },
  { id: 'algoMaster150', name: 'AlgoMaster 150', group: 'AlgoMaster', questions: 150, available: true },
  { id: 'algoMaster75', name: 'AlgoMaster 75', group: 'AlgoMaster', questions: 75, available: true },

  // ── Popular Creator Sheets ───────────────────────────────────────────────
  { id: 'loveBabbar', name: 'Love Babbar Sheet', group: 'Creators', questions: 445, available: true },
  { id: 'arshDsa', name: 'Arsh DSA Sheet', group: 'Creators', questions: 286, available: true },
  { id: 'frazDsa', name: 'Fraz DSA Sheet', group: 'Creators', questions: 279, available: true },
  { id: 'shradhaAman', name: 'DSA by Shradha Didi & Aman', group: 'Creators', questions: 418, available: true },
  { id: 'codeArmy', name: 'Code Army Sheet', group: 'Creators', questions: 726, available: true },
  { id: 'kushalVijay', name: '20 Essential DSA Patterns', group: 'Creators', questions: 180, available: true },
  { id: 'atharvaPatil150', name: "Atharva Patil's 150", group: 'Creators', questions: 150, available: true },
  { id: 'nishant151', name: "Nishant's 151", group: 'Creators', questions: 151, available: true },
  { id: 'manasiDeshmane', name: "Manasi Deshmane", group: 'Creators', questions: 70, available: true },

  // ── Essential Collections ────────────────────────────────────────────────
  { id: 'topInterview150', name: 'Top Interview 150', group: 'Collections', questions: 150, available: true },
  { id: 'leetcode100', name: 'Leetcode 100 Most Liked', group: 'Collections', questions: 100, available: true },
  { id: 'leetcode75', name: 'LeetCode 75', group: 'Collections', questions: 75, available: true },
  { id: '6companies30days', name: '6 Companies 30 Days', group: 'Collections', questions: 90, available: true },

  // ── Topic Specific ─────────────────────────────────────────────────────────
  { id: 'dpMastery', name: 'DP Mastery Sheet', group: 'Topic Specific', questions: 67, available: true },
  { id: 'graphMastery', name: 'Graph Mastery Sheet', group: 'Topic Specific', questions: 29, available: true },
  { id: 'stringMastery', name: 'String Mastery Sheet', group: 'Topic Specific', questions: 51, available: true },
  { id: 'binarySearchMastery', name: 'Binary Search Mastery', group: 'Topic Specific', questions: 11, available: true },
  { id: 'heapMastery', name: 'Heap Mastery Sheet', group: 'Topic Specific', questions: 22, available: true },

  // ── Competitive (Meta Sheets) ─────────────────────────────────────────────
  { id: 'cses', name: 'CSES Problem Set', group: 'Competitive', questions: 150, available: true },
  { id: 'codeprime75', name: 'Codeprime CP 75', group: 'Competitive', questions: 75, available: true },
  { 
    id: 'cp31_all', 
    name: 'CP-31 Series (All Ratings)', 
    group: 'Competitive', 
    questions: 372, 
    available: true,
    subSheets: ['cp31_800', 'cp31_900', 'cp31_1000', 'cp31_1100', 'cp31_1200', 'cp31_1300', 'cp31_1400', 'cp31_1500', 'cp31_1600', 'cp31_1700', 'cp31_1800', 'cp31_1900'] 
  },
  { 
    id: 'a2oj_all', 
    name: 'A2OJ Ladders (All Ratings)', 
    group: 'Competitive', 
    questions: 1100, 
    available: true,
    subSheets: ['a2oj_800', 'a2oj_1300', 'a2oj_1400', 'a2oj_1500', 'a2oj_1600', 'a2oj_1700', 'a2oj_1800', 'a2oj_1900', 'a2oj_2000', 'a2oj_2100', 'a2oj_2200'] 
  },

  // CP-31 Series (Hidden individual sheets)
  { id: 'cp31_800',  name: '800 Rated',  group: 'Competitive', questions: 31, available: true, hidden: true },
  { id: 'cp31_900',  name: '900 Rated',  group: 'Competitive', questions: 31, available: true, hidden: true },
  { id: 'cp31_1000', name: '1000 Rated', group: 'Competitive', questions: 31, available: true, hidden: true },
  { id: 'cp31_1100', name: '1100 Rated', group: 'Competitive', questions: 31, available: true, hidden: true },
  { id: 'cp31_1200', name: '1200 Rated', group: 'Competitive', questions: 31, available: true, hidden: true },
  { id: 'cp31_1300', name: '1300 Rated', group: 'Competitive', questions: 31, available: true, hidden: true },
  { id: 'cp31_1400', name: '1400 Rated', group: 'Competitive', questions: 31, available: true, hidden: true },
  { id: 'cp31_1500', name: '1500 Rated', group: 'Competitive', questions: 31, available: true, hidden: true },
  { id: 'cp31_1600', name: '1600 Rated', group: 'Competitive', questions: 31, available: true, hidden: true },
  { id: 'cp31_1700', name: '1700 Rated', group: 'Competitive', questions: 31, available: true, hidden: true },
  { id: 'cp31_1800', name: '1800 Rated', group: 'Competitive', questions: 31, available: true, hidden: true },
  { id: 'cp31_1900', name: '1900 Rated', group: 'Competitive', questions: 31, available: true, hidden: true },

  // A2OJ Ladders (Hidden individual sheets)
  { id: 'a2oj_800',  name: '800-1299 Rated',   group: 'Competitive', questions: 100, available: true, hidden: true },
  { id: 'a2oj_1300', name: '1300-1399 Rated',  group: 'Competitive', questions: 100, available: true, hidden: true },
  { id: 'a2oj_1400', name: '1400-1499 Rated',  group: 'Competitive', questions: 100, available: true, hidden: true },
  { id: 'a2oj_1500', name: '1500-1599 Rated',  group: 'Competitive', questions: 100, available: true, hidden: true },
  { id: 'a2oj_1600', name: '1600-1699 Rated',  group: 'Competitive', questions: 100, available: true, hidden: true },
  { id: 'a2oj_1700', name: '1700-1799 Rated',  group: 'Competitive', questions: 100, available: true, hidden: true },
  { id: 'a2oj_1800', name: '1800-1899 Rated',  group: 'Competitive', questions: 100, available: true, hidden: true },
  { id: 'a2oj_1900', name: '1900-1999 Rated',  group: 'Competitive', questions: 100, available: true, hidden: true },
  { id: 'a2oj_2000', name: '2000-2099 Rated',  group: 'Competitive', questions: 100, available: true, hidden: true },
  { id: 'a2oj_2100', name: '2100-2199 Rated',  group: 'Competitive', questions: 100, available: true, hidden: true },
  { id: 'a2oj_2200', name: '2200-4000 Rated',  group: 'Competitive', questions: 100, available: true, hidden: true },
];
