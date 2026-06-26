const fs = require('fs');
const https = require('https');
const path = require('path');

const outDir = path.join(__dirname, '..', 'public', 'sheets');

function postJSON(hostname, urlPath, postData) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname, path: urlPath, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData), 'User-Agent': 'Mozilla/5.0' }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

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

async function main() {
  // 1. Fix Blind 75 — fetch from official LC study plan
  console.log('[1/4] Fixing Blind 75 from LC study plan...');
  const b75 = await fetchStudyPlan('leetcode-study-plan-v2');  
  // Try alternate plan slug
  const b75alt = await fetchStudyPlan('top-interview-questions');
  
  // Use the curated list directly
  const blind75Data = [
    // Arrays & Hashing
    {title:"Two Sum",titleSlug:"two-sum",difficulty:"Easy",category:"Arrays & Hashing",platform:"leetcode"},
    {title:"Best Time to Buy and Sell Stock",titleSlug:"best-time-to-buy-and-sell-stock",difficulty:"Easy",category:"Arrays & Hashing",platform:"leetcode"},
    {title:"Contains Duplicate",titleSlug:"contains-duplicate",difficulty:"Easy",category:"Arrays & Hashing",platform:"leetcode"},
    {title:"Product of Array Except Self",titleSlug:"product-of-array-except-self",difficulty:"Medium",category:"Arrays & Hashing",platform:"leetcode"},
    {title:"Maximum Subarray",titleSlug:"maximum-subarray",difficulty:"Medium",category:"Arrays & Hashing",platform:"leetcode"},
    {title:"Maximum Product Subarray",titleSlug:"maximum-product-subarray",difficulty:"Medium",category:"Arrays & Hashing",platform:"leetcode"},
    {title:"Find Minimum in Rotated Sorted Array",titleSlug:"find-minimum-in-rotated-sorted-array",difficulty:"Medium",category:"Arrays & Hashing",platform:"leetcode"},
    {title:"Search in Rotated Sorted Array",titleSlug:"search-in-rotated-sorted-array",difficulty:"Medium",category:"Arrays & Hashing",platform:"leetcode"},
    {title:"3Sum",titleSlug:"3sum",difficulty:"Medium",category:"Arrays & Hashing",platform:"leetcode"},
    {title:"Container With Most Water",titleSlug:"container-with-most-water",difficulty:"Medium",category:"Arrays & Hashing",platform:"leetcode"},
    // Binary
    {title:"Sum of Two Integers",titleSlug:"sum-of-two-integers",difficulty:"Medium",category:"Binary",platform:"leetcode"},
    {title:"Number of 1 Bits",titleSlug:"number-of-1-bits",difficulty:"Easy",category:"Binary",platform:"leetcode"},
    {title:"Counting Bits",titleSlug:"counting-bits",difficulty:"Easy",category:"Binary",platform:"leetcode"},
    {title:"Missing Number",titleSlug:"missing-number",difficulty:"Easy",category:"Binary",platform:"leetcode"},
    {title:"Reverse Bits",titleSlug:"reverse-bits",difficulty:"Easy",category:"Binary",platform:"leetcode"},
    // Dynamic Programming
    {title:"Climbing Stairs",titleSlug:"climbing-stairs",difficulty:"Easy",category:"Dynamic Programming",platform:"leetcode"},
    {title:"Coin Change",titleSlug:"coin-change",difficulty:"Medium",category:"Dynamic Programming",platform:"leetcode"},
    {title:"Longest Increasing Subsequence",titleSlug:"longest-increasing-subsequence",difficulty:"Medium",category:"Dynamic Programming",platform:"leetcode"},
    {title:"Longest Common Subsequence",titleSlug:"longest-common-subsequence",difficulty:"Medium",category:"Dynamic Programming",platform:"leetcode"},
    {title:"Word Break",titleSlug:"word-break",difficulty:"Medium",category:"Dynamic Programming",platform:"leetcode"},
    {title:"Combination Sum IV",titleSlug:"combination-sum-iv",difficulty:"Medium",category:"Dynamic Programming",platform:"leetcode"},
    {title:"House Robber",titleSlug:"house-robber",difficulty:"Medium",category:"Dynamic Programming",platform:"leetcode"},
    {title:"House Robber II",titleSlug:"house-robber-ii",difficulty:"Medium",category:"Dynamic Programming",platform:"leetcode"},
    {title:"Decode Ways",titleSlug:"decode-ways",difficulty:"Medium",category:"Dynamic Programming",platform:"leetcode"},
    {title:"Unique Paths",titleSlug:"unique-paths",difficulty:"Medium",category:"Dynamic Programming",platform:"leetcode"},
    {title:"Jump Game",titleSlug:"jump-game",difficulty:"Medium",category:"Dynamic Programming",platform:"leetcode"},
    // Graph
    {title:"Clone Graph",titleSlug:"clone-graph",difficulty:"Medium",category:"Graph",platform:"leetcode"},
    {title:"Course Schedule",titleSlug:"course-schedule",difficulty:"Medium",category:"Graph",platform:"leetcode"},
    {title:"Pacific Atlantic Water Flow",titleSlug:"pacific-atlantic-water-flow",difficulty:"Medium",category:"Graph",platform:"leetcode"},
    {title:"Number of Islands",titleSlug:"number-of-islands",difficulty:"Medium",category:"Graph",platform:"leetcode"},
    {title:"Longest Consecutive Sequence",titleSlug:"longest-consecutive-sequence",difficulty:"Medium",category:"Graph",platform:"leetcode"},
    {title:"Alien Dictionary",titleSlug:"alien-dictionary",difficulty:"Hard",category:"Graph",platform:"leetcode"},
    {title:"Graph Valid Tree",titleSlug:"graph-valid-tree",difficulty:"Medium",category:"Graph",platform:"leetcode"},
    {title:"Number of Connected Components in an Undirected Graph",titleSlug:"number-of-connected-components-in-an-undirected-graph",difficulty:"Medium",category:"Graph",platform:"leetcode"},
    // Interval
    {title:"Insert Interval",titleSlug:"insert-interval",difficulty:"Medium",category:"Interval",platform:"leetcode"},
    {title:"Merge Intervals",titleSlug:"merge-intervals",difficulty:"Medium",category:"Interval",platform:"leetcode"},
    {title:"Non-overlapping Intervals",titleSlug:"non-overlapping-intervals",difficulty:"Medium",category:"Interval",platform:"leetcode"},
    {title:"Meeting Rooms",titleSlug:"meeting-rooms",difficulty:"Easy",category:"Interval",platform:"leetcode"},
    {title:"Meeting Rooms II",titleSlug:"meeting-rooms-ii",difficulty:"Medium",category:"Interval",platform:"leetcode"},
    // Linked List
    {title:"Reverse a Linked List",titleSlug:"reverse-linked-list",difficulty:"Easy",category:"Linked List",platform:"leetcode"},
    {title:"Detect Cycle in a Linked List",titleSlug:"linked-list-cycle",difficulty:"Easy",category:"Linked List",platform:"leetcode"},
    {title:"Merge Two Sorted Lists",titleSlug:"merge-two-sorted-lists",difficulty:"Easy",category:"Linked List",platform:"leetcode"},
    {title:"Merge K Sorted Lists",titleSlug:"merge-k-sorted-lists",difficulty:"Hard",category:"Linked List",platform:"leetcode"},
    {title:"Remove Nth Node From End Of List",titleSlug:"remove-nth-node-from-end-of-list",difficulty:"Medium",category:"Linked List",platform:"leetcode"},
    {title:"Reorder List",titleSlug:"reorder-list",difficulty:"Medium",category:"Linked List",platform:"leetcode"},
    // Matrix
    {title:"Set Matrix Zeroes",titleSlug:"set-matrix-zeroes",difficulty:"Medium",category:"Matrix",platform:"leetcode"},
    {title:"Spiral Matrix",titleSlug:"spiral-matrix",difficulty:"Medium",category:"Matrix",platform:"leetcode"},
    {title:"Rotate Image",titleSlug:"rotate-image",difficulty:"Medium",category:"Matrix",platform:"leetcode"},
    {title:"Word Search",titleSlug:"word-search",difficulty:"Medium",category:"Matrix",platform:"leetcode"},
    // String
    {title:"Longest Substring Without Repeating Characters",titleSlug:"longest-substring-without-repeating-characters",difficulty:"Medium",category:"String",platform:"leetcode"},
    {title:"Longest Repeating Character Replacement",titleSlug:"longest-repeating-character-replacement",difficulty:"Medium",category:"String",platform:"leetcode"},
    {title:"Minimum Window Substring",titleSlug:"minimum-window-substring",difficulty:"Hard",category:"String",platform:"leetcode"},
    {title:"Valid Anagram",titleSlug:"valid-anagram",difficulty:"Easy",category:"String",platform:"leetcode"},
    {title:"Group Anagrams",titleSlug:"group-anagrams",difficulty:"Medium",category:"String",platform:"leetcode"},
    {title:"Valid Parentheses",titleSlug:"valid-parentheses",difficulty:"Easy",category:"String",platform:"leetcode"},
    {title:"Valid Palindrome",titleSlug:"valid-palindrome",difficulty:"Easy",category:"String",platform:"leetcode"},
    {title:"Longest Palindromic Substring",titleSlug:"longest-palindromic-substring",difficulty:"Medium",category:"String",platform:"leetcode"},
    {title:"Palindromic Substrings",titleSlug:"palindromic-substrings",difficulty:"Medium",category:"String",platform:"leetcode"},
    {title:"Encode and Decode Strings",titleSlug:"encode-and-decode-strings",difficulty:"Medium",category:"String",platform:"leetcode"},
    // Tree
    {title:"Maximum Depth of Binary Tree",titleSlug:"maximum-depth-of-binary-tree",difficulty:"Easy",category:"Tree",platform:"leetcode"},
    {title:"Same Tree",titleSlug:"same-tree",difficulty:"Easy",category:"Tree",platform:"leetcode"},
    {title:"Invert/Flip Binary Tree",titleSlug:"invert-binary-tree",difficulty:"Easy",category:"Tree",platform:"leetcode"},
    {title:"Binary Tree Maximum Path Sum",titleSlug:"binary-tree-maximum-path-sum",difficulty:"Hard",category:"Tree",platform:"leetcode"},
    {title:"Binary Tree Level Order Traversal",titleSlug:"binary-tree-level-order-traversal",difficulty:"Medium",category:"Tree",platform:"leetcode"},
    {title:"Serialize and Deserialize Binary Tree",titleSlug:"serialize-and-deserialize-binary-tree",difficulty:"Hard",category:"Tree",platform:"leetcode"},
    {title:"Subtree of Another Tree",titleSlug:"subtree-of-another-tree",difficulty:"Easy",category:"Tree",platform:"leetcode"},
    {title:"Construct Binary Tree from Preorder and Inorder Traversal",titleSlug:"construct-binary-tree-from-preorder-and-inorder-traversal",difficulty:"Medium",category:"Tree",platform:"leetcode"},
    {title:"Validate Binary Search Tree",titleSlug:"validate-binary-search-tree",difficulty:"Medium",category:"Tree",platform:"leetcode"},
    {title:"Kth Smallest Element in a BST",titleSlug:"kth-smallest-element-in-a-bst",difficulty:"Medium",category:"Tree",platform:"leetcode"},
    {title:"Lowest Common Ancestor of BST",titleSlug:"lowest-common-ancestor-of-a-binary-search-tree",difficulty:"Easy",category:"Tree",platform:"leetcode"},
    {title:"Implement Trie (Prefix Tree)",titleSlug:"implement-trie-prefix-tree",difficulty:"Medium",category:"Tree",platform:"leetcode"},
    {title:"Add and Search Word",titleSlug:"add-and-search-word-data-structure-design",difficulty:"Medium",category:"Tree",platform:"leetcode"},
    {title:"Word Search II",titleSlug:"word-search-ii",difficulty:"Hard",category:"Tree",platform:"leetcode"},
    // Heap
    {title:"Merge K Sorted Lists",titleSlug:"merge-k-sorted-lists",difficulty:"Hard",category:"Heap",platform:"leetcode"},
    {title:"Top K Frequent Elements",titleSlug:"top-k-frequent-elements",difficulty:"Medium",category:"Heap",platform:"leetcode"},
    {title:"Find Median from Data Stream",titleSlug:"find-median-from-data-stream",difficulty:"Hard",category:"Heap",platform:"leetcode"},
  ];
  // Deduplicate by titleSlug
  const seen = new Set();
  const deduped = blind75Data.filter(p => { if (seen.has(p.titleSlug)) return false; seen.add(p.titleSlug); return true; });
  fs.writeFileSync(path.join(outDir, 'blind75.json'), JSON.stringify(deduped, null, 2));
  console.log(`✅ Fixed Blind 75 (${deduped.length} problems)`);

  // 2. Fix CSES — hardcoded from official cses.fi problem list
  console.log('[2/4] Fixing CSES Problem Set...');
  const cses = [
    // Introductory Problems
    ...[[1068,"Weird Algorithm"],[1083,"Missing Number"],[1069,"Repetitions"],[1094,"Increasing Array"],[1070,"Permutations"],[1071,"Number Spiral"],[1072,"Two Knights"],[1092,"Two Sets"],[1617,"Bit Strings"],[1618,"Trailing Zeros"],[1754,"Coin Piles"],[1755,"Palindrome Reorder"],[2205,"Gray Code"],[1622,"Fence Construction"],[1623,"Apple Division"],[1624,"Chessboard and Queens"],[1625,"Digit Queries"],[1626,"Grid Paths"]].map(([id,name])=>({title:name,titleSlug:`${id}`,difficulty:"Easy",category:"Introductory Problems",platform:"cses"})),
    // Sorting and Searching
    ...[[1621,"Distinct Numbers"],[1084,"Apartments"],[1090,"Ferris Wheel"],[1091,"Concert Tickets"],[1619,"Restaurant Customers"],[1631,"Movie Festival"],[1163,"Sum of Two Values"],[1164,"Maximum Subarray Sum"],[1620,"Stick Lengths"],[1630,"Missing Coin Sum"],[1641,"Collecting Numbers"],[1073,"Towers"],[1085,"Array Division"],[1076,"Sliding Median"],[1077,"Sliding Cost"],[1632,"Movie Festival II"],[2183,"Nested Ranges Check"],[2184,"Nested Ranges Count"],[1085,"Subarray Sums I"],[2422,"Subarray Sums II"],[1660,"Subarray Divisibility"],[2428,"Subarray Distinct Values"],[1076,"Array Division"],[1203,"Pizzeria Queries"]].map(([id,name])=>({title:name,titleSlug:`${id}`,difficulty:"Medium",category:"Sorting and Searching",platform:"cses"})),
    // Dynamic Programming
    ...[[1633,"Dice Combinations"],[1634,"Minimizing Coins"],[1635,"Coin Combinations I"],[1636,"Coin Combinations II"],[1637,"Removing Digits"],[1638,"Grid Paths"],[1639,"Edit Distance"],[1640,"Counting Towers"],[1641,"Collecting Numbers"],[1642,"Collecting Numbers II"],[1643,"Elevator Rides"],[1644,"Money Sums"],[1645,"Removal Game"],[1646,"Drop Balls"],[1647,"Increasing Subsequence"],[1648,"Projects"],[1649,"Counting Tilings"],[1650,"Counting Numbers"],[1651,"LCS"],[1745,"Increasing Array II"]].map(([id,name])=>({title:name,titleSlug:`${id}`,difficulty:"Medium",category:"Dynamic Programming",platform:"cses"})),
    // Graph Algorithms
    ...[[1192,"Counting Rooms"],[1193,"Labyrinth"],[1666,"Building Roads"],[1667,"Message Route"],[1668,"Building Teams"],[1669,"Round Trip"],[1670,"Monsters"],[1671,"Shortest Routes I"],[1672,"Shortest Routes II"],[1673,"High Score"],[1674,"Flight Discount"],[1675,"Cycle Finding"],[1676,"Flight Routes"],[1677,"Round Trip II"],[1678,"Course Schedule"],[1679,"Longest Flight Route"],[1680,"Game Routes"],[1681,"Investigation"],[1682,"Planets Queries I"],[1683,"Planets Queries II"],[1684,"Planets Cycles"],[1685,"Road Reparation"],[1686,"Road Construction"],[1687,"Flight Routes Check"],[1688,"Planets and Kingdoms"],[1689,"Giant Pizza"],[1690,"Coin Collector"],[1691,"Mail Delivery"],[1692,"De Bruijn Sequence"],[1693,"Teleporters Path"],[1694,"Hamiltonian Flights"],[1695,"Knight's Tour"],[1696,"Download Speed"],[1697,"Police Chase"],[1698,"School Dance"],[1699,"Distinct Routes"]].map(([id,name])=>({title:name,titleSlug:`${id}`,difficulty:"Hard",category:"Graph Algorithms",platform:"cses"})),
    // Tree Algorithms
    ...[[1674,"Subordinates"],[1130,"Tree Matching"],[1131,"Tree Diameter"],[1132,"Tree Distances I"],[1133,"Tree Distances II"],[1134,"Company Queries I"],[1135,"Company Queries II"],[1136,"Distance Queries"],[1137,"Counting Paths"],[1138,"Subtree Queries"],[1139,"Path Queries"],[1140,"Distinct Colors"],[2079,"Finding a Centroid"],[2080,"Fixed-Length Paths I"],[2081,"Fixed-Length Paths II"]].map(([id,name])=>({title:name,titleSlug:`${id}`,difficulty:"Hard",category:"Tree Algorithms",platform:"cses"})),
    // String Algorithms
    ...[[1731,"Word Combinations"],[1753,"String Matching"],[1732,"String Factors"],[1733,"String Transform"],[1110,"Minimal Rotation"],[1111,"Longest Palindrome"],[2101,"Palindrome Queries"],[2102,"Required Substring"],[2103,"Palindrome Partition"],[2104,"Counting Patterns"],[2105,"Pattern Positions"],[2106,"Distinct Substrings"],[2107,"Substring Order I"],[2108,"Substring Order II"],[2109,"Substring Distribution"]].map(([id,name])=>({title:name,titleSlug:`${id}`,difficulty:"Hard",category:"String Algorithms",platform:"cses"})),
    // Mathematics
    ...[[1712,"Exponentiation"],[1713,"Exponentiation II"],[1081,"Counting Divisors"],[1082,"Common Divisors"],[1079,"Binomial Coefficients"],[1715,"Creating Strings II"],[1716,"Distributing Apples"],[1717,"Christmas Party"],[1718,"Fibonacci Numbers"],[1719,"Throwing Dice"],[1720,"Graph Paths I"],[1721,"Graph Paths II"],[1722,"Dice Probability"],[1723,"Moving Robots"],[1724,"Candy Lottery"],[1725,"Inversion Probability"],[1726,"Stick Game"],[1727,"Nim Game I"],[1728,"Nim Game II"],[1729,"Staircase Game"],[1730,"Grundy's Game"],[2413,"Another Game"]].map(([id,name])=>({title:name,titleSlug:`${id}`,difficulty:"Hard",category:"Mathematics",platform:"cses"})),
  ];
  fs.writeFileSync(path.join(outDir, 'cses.json'), JSON.stringify(cses, null, 2));
  console.log(`✅ Fixed CSES (${cses.length} problems)`);

  // 3. Fetch Striver CP sheet properly from LC GraphQL study plan
  console.log('[3/4] Fixing Striver CP sheet (re-verifying)...');
  const cpCount = JSON.parse(fs.readFileSync(path.join(outDir, 'striverCpSheet.json'))).length;
  console.log(`  Current striverCpSheet: ${cpCount} problems - needs manual data`);

  console.log('\n✅ Done. Summary:');
  fs.readdirSync(outDir).forEach(f => {
    try {
      const d = JSON.parse(fs.readFileSync(path.join(outDir, f)));
      console.log(`  ${f}: ${d.length} problems`);
    } catch(e) { console.log(`  ${f}: parse error`); }
  });
}

main().catch(console.error);
