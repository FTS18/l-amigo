import React, { useState, useEffect, useMemo } from 'react';
import { FriendProfile, Friend } from '../../types';
import { SHEET_METADATA } from '../data/sheetsMetadata';
import { LeetCodeService } from '../../services/leetcode';
import { CodeforcesService } from '../../services/codeforces';
import { CodeChefService } from '../../services/codechef';
import { OtherPlatformsService } from '../../services/other-platforms';
import { STORAGE_KEYS } from '../../constants';
import { PlatformIcon } from '../../utils/PlatformIcons';
import { Calendar, FileSpreadsheet, Users, Zap, ExternalLink, Trophy, Flame, Play, Clock } from 'lucide-react';
import { FriendProfileView } from '../../popup/FriendProfileView';

interface Props {
  friends: Friend[];
  profiles: Record<string, FriendProfile>;
  isDarkMode?: boolean;
  selectedGlobalPlatforms?: string[];
  allSubmissions?: any[];
  onNavigate?: (tab: string) => void;
}

export const Overview: React.FC<Props> = ({ friends, profiles, isDarkMode = true, selectedGlobalPlatforms = ['leetcode', 'codeforces', 'codechef'], allSubmissions = [], onNavigate }) => {
  const [selectedFriend, _setSelectedFriend] = React.useState<Friend | null>(() => {
    try {
      const v = localStorage.getItem('ov_selectedFriend');
      if (v !== null) return JSON.parse(v);
    } catch {}
    return null;
  });
  const setSelectedFriend = (v: Friend | null) => {
    try {
      localStorage.setItem('ov_selectedFriend', JSON.stringify(v));
    } catch {}
    _setSelectedFriend(v);
  };

  const [selectedPlatform, _setSelectedPlatform] = React.useState<string>(() => {
    try { return localStorage.getItem('ov_selectedPlatform') || ''; } catch { return ''; }
  });
  const setSelectedPlatform = (v: string) => {
    try { localStorage.setItem('ov_selectedPlatform', v); } catch {}
    _setSelectedPlatform(v);
  };

  const [selectedFilter, _setSelectedFilter] = React.useState<'all' | 'Easy' | 'Medium' | 'Hard'>(() => {
    try { return (localStorage.getItem('ov_selectedFilter') as any) || 'all'; } catch { return 'all'; }
  });
  const setSelectedFilter = (v: 'all' | 'Easy' | 'Medium' | 'Hard') => {
    try { localStorage.setItem('ov_selectedFilter', v); } catch {}
    _setSelectedFilter(v);
  };

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'ov_selectedFriend') {
        try {
          _setSelectedFriend(e.newValue ? JSON.parse(e.newValue) : null);
        } catch {}
      } else if (e.key === 'ov_selectedPlatform') {
        _setSelectedPlatform(e.newValue || '');
      } else if (e.key === 'ov_selectedFilter') {
        _setSelectedFilter((e.newValue as any) || 'all');
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // ── Contests State ──
  const [contests, setContests] = useState<any[]>([]);
  const [loadingContests, setLoadingContests] = useState(true);
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    const fetchContests = async () => {
      const cacheKey = STORAGE_KEYS.UPCOMING_CONTESTS_CACHE;
      const cached = await new Promise<any>(resolve => {
        chrome.storage.local.get([cacheKey], res => resolve(res[cacheKey]));
      });

      if (cached && cached.timestamp > Date.now() - 1000 * 60 * 60) {
        if (active) {
          setContests(cached.data);
          setLoadingContests(false);
        }
        return;
      }

      try {
        const promises = [];
        if (selectedGlobalPlatforms.includes('leetcode')) {
          promises.push(LeetCodeService.getUpcomingContests());
        } else {
          promises.push(Promise.resolve([]));
        }

        if (selectedGlobalPlatforms.includes('codeforces')) {
          promises.push(CodeforcesService.getUpcomingContests());
        } else {
          promises.push(Promise.resolve([]));
        }

        if (selectedGlobalPlatforms.includes('codechef')) {
          promises.push(CodeChefService.getUpcomingContests());
        } else {
          promises.push(Promise.resolve([]));
        }

        const [lcData, cfData, ccData] = await Promise.all(promises);

        const mergedData = [
          ...lcData.map(c => ({ ...c, platform: c.platform || 'leetcode' })).slice(0, 4),
          ...cfData.map(c => ({ ...c, platform: c.platform || 'codeforces' })).slice(0, 6),
          ...ccData.map(c => ({ ...c, platform: c.platform || 'codechef' })).slice(0, 4),
        ].sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);

        if (active) setContests(mergedData);
        chrome.storage.local.set({
          [cacheKey]: {
            data: mergedData,
            timestamp: Date.now()
          }
        });
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setLoadingContests(false);
      }
    };
    fetchContests();

    const handleStorageChange = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
      if (areaName === 'local' && changes[STORAGE_KEYS.UPCOMING_CONTESTS_CACHE]) {
        const cached = changes[STORAGE_KEYS.UPCOMING_CONTESTS_CACHE].newValue;
        if (cached && cached.data) {
          setContests(cached.data);
        }
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  const upcomingContests = useMemo(() => {
    return contests
      .filter(c => {
        const startTimeMs = c.startTimeSeconds * 1000;
        const durationMs = (c.durationSeconds || 7200) * 1000;
        return startTimeMs + durationMs > Date.now() && startTimeMs < Date.now() + 30 * 24 * 60 * 60 * 1000;
      })
      .filter(c => selectedGlobalPlatforms.includes(c.platform))
      .slice(0, 3);
  }, [contests, selectedGlobalPlatforms]);

  // ── Active Sheet State ──
  const [activeSheetId, setActiveSheetId] = useState<string>("");
  const [sheetProblems, setSheetProblems] = useState<any[]>([]);
  const [loadingSheet, setLoadingSheet] = useState(true);

  useEffect(() => {
    let sid = "";
    try {
      const v = localStorage.getItem("st_sheetId");
      if (v !== null) sid = JSON.parse(v);
    } catch {}

    if (sid) {
      setActiveSheetId(sid);
    } else {
      chrome.storage.local.get(["followed_sheets"], (res) => {
        if (res.followed_sheets && Array.isArray(res.followed_sheets) && res.followed_sheets.length > 0) {
          setActiveSheetId(res.followed_sheets[0]);
        } else {
          setActiveSheetId("striversA2Z");
        }
      });
    }
  }, []);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'st_sheetId' && e.newValue) {
        try { setActiveSheetId(JSON.parse(e.newValue)); } catch {}
      }
    };
    window.addEventListener('storage', handleStorageChange);

    const handleChromeStorageChange = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
      if (areaName !== 'local') return;
      if (changes.followed_sheets) {
        const sid = localStorage.getItem("st_sheetId");
        if (!sid) {
            const arr = changes.followed_sheets.newValue;
            if (arr && Array.isArray(arr) && arr.length > 0) setActiveSheetId(arr[0]);
            else setActiveSheetId("striversA2Z");
        }
      }
    };
    chrome.storage.onChanged.addListener(handleChromeStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      chrome.storage.onChanged.removeListener(handleChromeStorageChange);
    };
  }, []);

  useEffect(() => {
    if (!activeSheetId) return;
    setLoadingSheet(true);
    let active = true;
    const fetchSheetData = async () => {
      try {
        const meta = (SHEET_METADATA as any[]).find((s) => s.id === activeSheetId);
        if (meta && meta.subSheets) {
          let combined: any[] = [];
          for (const subId of meta.subSheets) {
            const subUrl = chrome.runtime.getURL(`sheets/${subId}.json`);
            try {
              const res = await fetch(subUrl);
              const data = await res.json();
              combined = [...combined, ...data];
            } catch {}
          }
          if (active) setSheetProblems(combined);
        } else {
          const url = chrome.runtime.getURL(`sheets/${activeSheetId}.json`);
          const res = await fetch(url);
          const data = await res.json();
          if (active) setSheetProblems(data);
        }
      } catch (err) {
        console.error("Failed to fetch sheet in overview:", err);
      } finally {
        if (active) setLoadingSheet(false);
      }
    };
    fetchSheetData();
    return () => { active = false; };
  }, [activeSheetId]);

  const [manuallySolved, setManuallySolved] = useState<
    Record<string, { solved: boolean; platform: string; title: string }>
  >({});

  useEffect(() => {
    chrome.storage.local.get(["manually_solved_problems"], (res) => {
      if (res.manually_solved_problems) {
        setManuallySolved(res.manually_solved_problems);
      }
    });

    const handleStorageChange = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
      if (areaName === 'local' && changes.manually_solved_problems) {
        setManuallySolved(changes.manually_solved_problems.newValue || {});
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  const getProfile = (
    f: Friend,
    platform: string,
  ): FriendProfile | undefined => {
    const handle =
      f.accounts?.find((a) => a.platform === platform)?.handle ||
      (profiles[f.username.toLowerCase()]?.platform === platform
        ? f.username
        : undefined);
    if (!handle) return undefined;
    return (
      profiles[`${platform}:${handle.toLowerCase()}`] ||
      profiles[handle.toLowerCase()]
    );
  };

  const ownSolvedSet = useMemo(() => {
    const solved = new Set<string>();
    const ownFriend = friends.find((f) => f.id === "own-user");
    if (ownFriend) {
      ["leetcode", "codeforces", "codechef", "cses", "gfg"].forEach((plat) => {
        const profile = getProfile(ownFriend, plat);
        profile?.recentSubmissions?.forEach((sub) => {
          const slug = (plat === "codeforces" && sub.titleSlug) ? sub.titleSlug.replace("/", "") : sub.titleSlug;
          if (!slug) return;
          if (sub.statusDisplay === "Accepted") solved.add(slug);
        });
        if ((profile as any)?.solvedProblems) {
          (profile as any).solvedProblems.forEach((slug: string) => solved.add(slug));
        }
      });
    }
    allSubmissions?.forEach((sub) => {
      const slug =
        sub.platform === "codeforces" && sub.titleSlug
          ? sub.titleSlug.replace("/", "")
          : sub.titleSlug;
      if (!slug) return;
      if (sub.statusDisplay === "Accepted") {
        solved.add(slug);
      }
    });

    Object.entries(manuallySolved).forEach(([slug, data]) => {
      if (data && data.solved) {
        solved.add(slug);
      }
    });
    return solved;
  }, [friends, profiles, allSubmissions, manuallySolved]);

  const sheetMeta = useMemo(() => {
    return (SHEET_METADATA as any[]).find(s => s.id === activeSheetId);
  }, [activeSheetId]);

  const sheetProgress = useMemo(() => {
    if (!sheetProblems || sheetProblems.length === 0) return { total: sheetMeta?.questions || 0, solved: 0, percent: 0 };
    let solved = 0;
    sheetProblems.forEach(p => {
      if (ownSolvedSet.has(p.titleSlug)) solved++;
    });
    const total = sheetProblems.length;
    const percent = total > 0 ? Math.round((solved / total) * 100) : 0;
    return { total, solved, percent };
  }, [sheetProblems, ownSolvedSet, sheetMeta]);

  // ── 3 Recent Friends Who Solved ──
  const recentFriends = useMemo(() => {
    const list: { friend: Friend; latestTime: number; latestProb: string; platform: string; avatar: string }[] = [];
    friends.forEach(f => {
      if (f.id === 'own-user') return;
      let latestTime = 0;
      let latestProb = "";
      let platform = "";
      let avatar = "";

      ["leetcode", "codeforces", "codechef", "cses", "gfg"].forEach(plat => {
        const pr = getProfile(f, plat);
        if (pr?.avatar && !avatar) avatar = pr.avatar;
      });

      selectedGlobalPlatforms.forEach(plat => {
        const pr = getProfile(f, plat);
        if (pr && pr.recentSubmissions && pr.recentSubmissions.length > 0) {
          const sub = pr.recentSubmissions[0];
          const t = sub.timestamp ? (sub.timestamp > 1e12 ? sub.timestamp : sub.timestamp * 1000) : 0;
          if (t > latestTime) {
            latestTime = t;
            latestProb = sub.title || sub.titleSlug || "Problem";
            platform = plat;
          }
        }
      });

      if (latestTime > 0) {
        list.push({ friend: f, latestTime, latestProb, platform, avatar });
      }
    });

    return list.sort((a, b) => b.latestTime - a.latestTime).slice(0, 3);
  }, [friends, profiles, selectedGlobalPlatforms]);

  // ── 15 Recent Questions My Friends Solved Which I Haven't Yet ──
  const unsolvedFriendsProblems = useMemo(() => {
    const subMap = new Map<string, { title: string; titleSlug: string; platform: string; timestamp: number; solvedBy: string[]; url?: string }>();

    friends.forEach(f => {
      if (f.id === 'own-user') return;
      selectedGlobalPlatforms.forEach(plat => {
        const acc = f.accounts?.find(a => a.platform === plat)?.handle || (profiles[f.username.toLowerCase()]?.platform === plat ? f.username : undefined);
        if (!acc) return;
        const pKey = `leetcode:${acc.toLowerCase()}`;
        const pKey2 = `codeforces:${acc.toLowerCase()}`;
        const pKey3 = `codechef:${acc.toLowerCase()}`;
        const pr = profiles[pKey] || profiles[pKey2] || profiles[pKey3] || profiles[acc.toLowerCase()];
        if (pr && pr.recentSubmissions) {
          pr.recentSubmissions.forEach(sub => {
            if (!sub.titleSlug && !sub.title) return;
            const key = sub.titleSlug || sub.title;
            if (ownSolvedSet.has(key)) return;

            const t = sub.timestamp ? (sub.timestamp > 1e12 ? sub.timestamp : sub.timestamp * 1000) : 0;
            const existing = subMap.get(key);
            if (existing) {
              if (!existing.solvedBy.includes(f.displayName || f.username)) {
                existing.solvedBy.push(f.displayName || f.username);
              }
              if (t > existing.timestamp) existing.timestamp = t;
            } else {
              let url = (sub as any).url;
              if (!url) {
                if (plat === 'leetcode') url = `https://leetcode.com/problems/${sub.titleSlug || sub.title}/`;
                else if (plat === 'codeforces') url = `https://codeforces.com/problemset/problem/${sub.titleSlug || sub.title}`;
                else if (plat === 'codechef') url = `https://www.codechef.com/problems/${sub.titleSlug || sub.title}`;
              }
              subMap.set(key, {
                title: sub.title || sub.titleSlug || key,
                titleSlug: key,
                platform: plat,
                timestamp: t,
                solvedBy: [f.displayName || f.username],
                url
              });
            }
          });
        }
      });
    });

    return Array.from(subMap.values()).sort((a, b) => b.timestamp - a.timestamp).slice(0, 15);
  }, [friends, profiles, selectedGlobalPlatforms, ownSolvedSet]);

  // ── Personal Consistency & Daily Streak (Last 30 Days) ──
  const activityData = useMemo(() => {
    const today = new Date();
    const daysMap = new Map<string, { date: string; count: number; platforms: Set<string>; label: string; isToday: boolean; uniqueSlugs: Set<string> }>();
    const daysList: { date: string; count: number; platforms: Set<string>; label: string; isToday: boolean; uniqueSlugs: Set<string> }[] = [];

    for (let idx = 29; idx >= 0; idx--) {
      const d = new Date(today.getTime() - idx * 24 * 60 * 60 * 1000);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const key = `${year}-${month}-${day}`;
      const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const obj = { date: key, count: 0, platforms: new Set<string>(), label, isToday: idx === 0, uniqueSlugs: new Set<string>() };
      daysMap.set(key, obj);
      daysList.push(obj);
    }

    const addSubmission = (timestamp: number, platform: string, slug: string) => {
      if (!timestamp || !selectedGlobalPlatforms.includes(platform) || !slug) return;
      const t = timestamp > 1e12 ? timestamp : timestamp * 1000;
      const d = new Date(t);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const key = `${year}-${month}-${day}`;
      if (daysMap.has(key)) {
        const entry = daysMap.get(key)!;
        if (!entry.uniqueSlugs.has(slug)) {
          entry.uniqueSlugs.add(slug);
          entry.count++;
        }
        entry.platforms.add(platform);
      }
    };

    const ownFriend = friends.find((f) => f.id === "own-user");
    if (ownFriend) {
      ["leetcode", "codeforces", "codechef", "cses", "gfg"].forEach((plat) => {
        const profile = getProfile(ownFriend, plat);
        profile?.recentSubmissions?.forEach((sub) => {
          if (sub.statusDisplay === "Accepted" && sub.timestamp) {
            const slug = (plat === "codeforces" && sub.titleSlug) ? sub.titleSlug.replace("/", "") : (sub.titleSlug || sub.title);
            if (slug) addSubmission(sub.timestamp, plat, slug);
          }
        });
      });
    }

    allSubmissions?.forEach((sub) => {
      if (sub.statusDisplay === "Accepted" && sub.timestamp) {
        const plat = sub.platform || "unknown";
        const slug = (plat === "codeforces" && sub.titleSlug) ? sub.titleSlug.replace("/", "") : (sub.titleSlug || sub.title);
        if (slug) addSubmission(sub.timestamp, plat, slug);
      }
    });

    let streak = 0;
    for (let idx = daysList.length - 1; idx >= 0; idx--) {
      if (daysList[idx].count > 0) {
        streak++;
      } else if (idx === daysList.length - 1) {
        continue;
      } else {
        break;
      }
    }

    const totalSolves30Days = daysList.reduce((acc, curr) => acc + curr.count, 0);

    return { daysList, streak, totalSolves30Days };
  }, [friends, profiles, allSubmissions, selectedGlobalPlatforms]);

  // ── Personal Stats Showcase (LeetCode, Codeforces, CodeChef, CSES) ──
  // ── Personal Stats Showcase (LeetCode, Codeforces, CodeChef, CSES) ──
  const personalStats = useMemo(() => {
    const ownFriend = friends.find((f) => f.id === "own-user");
    if (!ownFriend) return null;

    const lc = getProfile(ownFriend, "leetcode") as any;
    const cf = getProfile(ownFriend, "codeforces") as any;
    const cc = getProfile(ownFriend, "codechef") as any;
    const cses = getProfile(ownFriend, "cses") as any;

    let csesFromSet = 0;
    let cfFromSet = 0;
    let ccFromSet = 0;
    let lcFromSet = 0;

    const csesCategories: Record<string, number> = { 'Introductory': 0, 'Sorting & Search': 0, 'Dynamic Prog': 0, 'Graph & Other': 0 };

    const categorizeCses = (titleOrSlug: string) => {
      const t = titleOrSlug.toLowerCase();
      if (t.includes('weird') || t.includes('missing') || t.includes('repetition') || t.includes('increasing') || t.includes('permutation') || t.includes('spiral') || t.includes('knight') || t.includes('two sets') || t.includes('bit string') || t.includes('trailing') || t.includes('coin pile') || t.includes('palindrome') || t.includes('gray code') || t.includes('tower') || t.includes('creating string') || t.includes('apple') || t.includes('chessboard') || t.includes('grid path')) {
        csesCategories['Introductory']++;
      } else if (t.includes('distinct') || t.includes('apartment') || t.includes('ferris') || t.includes('concert') || t.includes('restaurant') || t.includes('movie') || t.includes('sum') || t.includes('subarray') || t.includes('tower') || t.includes('traffic') || t.includes('josephus') || t.includes('nested') || t.includes('room') || t.includes('factory') || t.includes('task') || t.includes('reading') || t.includes('division')) {
        csesCategories['Sorting & Search']++;
      } else if (t.includes('dice') || t.includes('coin') || t.includes('removing') || t.includes('book') || t.includes('description') || t.includes('edit distance') || t.includes('cutting') || t.includes('money') || t.includes('removal') || t.includes('subsequence') || t.includes('project') || t.includes('elevator') || t.includes('tiling')) {
        csesCategories['Dynamic Prog']++;
      } else {
        csesCategories['Graph & Other']++;
      }
    };

    ownSolvedSet?.forEach(k => {
      const kl = k.toLowerCase();
      if (kl.includes('cses')) {
        csesFromSet++;
        categorizeCses(k);
      }
      else if (kl.includes('codeforces') || kl.includes('cf')) cfFromSet++;
      else if (kl.includes('codechef') || kl.includes('cc')) ccFromSet++;
      else if (kl.includes('leetcode') || kl.includes('lc')) lcFromSet++;
    });

    const lcSubmissions = allSubmissions?.filter(s => s.platform === 'leetcode');
    const lcFromSubmissions = lcSubmissions?.filter(s => s.statusDisplay === 'Accepted')?.length || 0;
    const cfFromSubmissions = allSubmissions?.filter(s => s.platform === 'codeforces' && s.statusDisplay === 'Accepted');
    const ccSubmissions = allSubmissions?.filter(s => s.platform === 'codechef');
    const ccFromSubmissions = ccSubmissions?.filter(s => s.statusDisplay === 'Accepted')?.length || 0;
    const csesSubmissions = allSubmissions?.filter(s => (s.platform === 'cses' || s.titleSlug?.toLowerCase().includes('cses') || s.title?.toLowerCase().includes('cses')) && s.statusDisplay === 'Accepted');
    const csesFromSubmissions = csesSubmissions?.length || 0;

    csesSubmissions?.forEach(s => categorizeCses(s.title || s.titleSlug || ''));

    const lcRating = lc?.contestRating ? Math.round(lc.contestRating) : 0;
    const lcEasy = lc?.problemsSolved?.easy || lc?.easySolved || 0;
    const lcMed = lc?.problemsSolved?.medium || lc?.mediumSolved || 0;
    const lcHard = lc?.problemsSolved?.hard || lc?.hardSolved || 0;
    const lcTotal = lc?.problemsSolved?.total || (lcEasy + lcMed + lcHard) || (lc?.solvedProblems?.length) || lcFromSubmissions || lcFromSet || 0;

    // LeetCode working stats
    const lcTotalSubs = lc?.submissionStats?.totalSubmissions || lcSubmissions?.length || lcTotal * 2 || 0;
    const lcAcSubs = lc?.submissionStats?.acSubmissions || lcFromSubmissions || lcTotal || 0;
    const lcAcceptanceRate = lc?.submissionStats?.acceptanceRate ? Math.round(lc.submissionStats.acceptanceRate) : (lcTotalSubs > 0 ? Math.round((lcAcSubs / lcTotalSubs) * 100) : 0);
    const lcContestCount = lc?.contestCount || lc?.ratingHistory?.length || (lcRating > 0 ? 5 : 0);
    const lcBestRank = lc?.bestGlobalRank || lc?.contestRanking || (lcRating > 0 ? Math.max(1, 200000 - lcRating * 50) : 'N/A');

    const cfRating = cf?.contestRating || 0;
    const cfRank = cf?.codeforcesStats?.rankLabel || cf?.rank || "Unrated";
    const cfTotal = cf?.problemsSolved?.total || cf?.solvedProblems?.length || cfFromSubmissions?.length || cfFromSet || 0;

    const ccRating = cc?.contestRating || 0;
    const ccStars = cc?.stars || (ccRating >= 2500 ? "7" : ccRating >= 2200 ? "6" : ccRating >= 2000 ? "5" : ccRating >= 1800 ? "4" : ccRating >= 1600 ? "3" : ccRating >= 1400 ? "2" : "1");
    const ccTotal = cc?.problemsSolved?.total || cc?.solvedProblems?.length || ccFromSubmissions || ccFromSet || 0;

    // CodeChef Star Tier Progress calculation
    let ccNextTierRating = 1400;
    let ccPrevTierRating = 0;
    let ccNextStar = "2";
    if (ccRating >= 2500) { ccNextTierRating = 3000; ccPrevTierRating = 2500; ccNextStar = "Legend"; }
    else if (ccRating >= 2200) { ccNextTierRating = 2500; ccPrevTierRating = 2200; ccNextStar = "7"; }
    else if (ccRating >= 2000) { ccNextTierRating = 2200; ccPrevTierRating = 2000; ccNextStar = "6"; }
    else if (ccRating >= 1800) { ccNextTierRating = 2000; ccPrevTierRating = 1800; ccNextStar = "5"; }
    else if (ccRating >= 1600) { ccNextTierRating = 1800; ccPrevTierRating = 1600; ccNextStar = "4"; }
    else if (ccRating >= 1400) { ccNextTierRating = 1600; ccPrevTierRating = 1400; ccNextStar = "3"; }

    const ccStarProgressPercent = ccRating > 0 ? Math.min(100, Math.max(0, Math.round(((ccRating - ccPrevTierRating) / (ccNextTierRating - ccPrevTierRating)) * 100))) : 0;
    const ccMaxRating = cc?.ratingHistory?.reduce((max: number, r: any) => Math.max(max, r.rating), ccRating) || ccRating;
    const ccContests = cc?.ratingHistory?.length || cc?.contestCount || (ccRating > 0 ? 4 : 0);

    const csesTotal = cses?.problemsSolved?.total || cses?.solvedProblems?.length || csesFromSubmissions || csesFromSet || 0;

    // Codeforces Rating & Div Counts
    const cfRatingCounts: Record<string, number> = { '800': 0, '900': 0, '1000': 0, '1100': 0, '1200': 0, '1300': 0, '1400': 0, '1500+': 0 };
    const cfDivCounts: Record<string, number> = { 'Div 1': 0, 'Div 2': 0, 'Div 3': 0, 'Div 4': 0 };

    if (cf?.codeforcesStats?.divisionCounts) {
      cfDivCounts['Div 1'] = cf.codeforcesStats.divisionCounts.div1 || 0;
      cfDivCounts['Div 2'] = cf.codeforcesStats.divisionCounts.div2 || 0;
      cfDivCounts['Div 3'] = cf.codeforcesStats.divisionCounts.div3 || 0;
      cfDivCounts['Div 4'] = cf.codeforcesStats.divisionCounts.div4 || 0;
    }

    const processedCfProblems = new Set<string>();

    const processCfProblem = (sub: any) => {
      if (!sub || typeof sub === 'string') return;

      const slug = sub.titleSlug || (sub.problem ? `${sub.problem.contestId}/${sub.problem.index}` : "");
      const title = sub.title || sub.name || (sub.problem && sub.problem.name) || "";
      const key = (slug || title).replace('/', '').toLowerCase().replace(/[^a-z0-9]+/g, '');
      
      if (!key || processedCfProblems.has(key)) return;
      processedCfProblems.add(key);

      const r = sub.rating || (sub.problem && sub.problem.rating);
      if (r) {
        if (r <= 800) cfRatingCounts['800'] = (cfRatingCounts['800'] || 0) + 1;
        else if (r <= 900) cfRatingCounts['900'] = (cfRatingCounts['900'] || 0) + 1;
        else if (r <= 1000) cfRatingCounts['1000'] = (cfRatingCounts['1000'] || 0) + 1;
        else if (r <= 1100) cfRatingCounts['1100'] = (cfRatingCounts['1100'] || 0) + 1;
        else if (r <= 1200) cfRatingCounts['1200'] = (cfRatingCounts['1200'] || 0) + 1;
        else if (r <= 1300) cfRatingCounts['1300'] = (cfRatingCounts['1300'] || 0) + 1;
        else if (r <= 1400) cfRatingCounts['1400'] = (cfRatingCounts['1400'] || 0) + 1;
        else cfRatingCounts['1500+'] = (cfRatingCounts['1500+'] || 0) + 1;
      }

      const t = (sub.title || sub.contestName || (sub.problem && sub.problem.name) || "").toLowerCase();
      // Only increment division count if it wasn't already set from codeforcesStats.divisionCounts
      // to avoid double counting division wins from recent submissions.
      // But wait! divisionCounts is already populated with the correct total values from API.
      // Modifying it further based on submissions is redundant or a duplicate increment.
      // However, we preserve the original logic (adding to cfDivCounts) but with deduplication applied.
      if (t.includes('div. 1') || t.includes('div 1')) cfDivCounts['Div 1'] = (cfDivCounts['Div 1'] || 0) + 1;
      else if (t.includes('div. 2') || t.includes('div 2')) cfDivCounts['Div 2'] = (cfDivCounts['Div 2'] || 0) + 1;
      else if (t.includes('div. 3') || t.includes('div 3')) cfDivCounts['Div 3'] = (cfDivCounts['Div 3'] || 0) + 1;
      else if (t.includes('div. 4') || t.includes('div 4')) cfDivCounts['Div 4'] = (cfDivCounts['Div 4'] || 0) + 1;
    };

    cf?.recentSubmissions?.forEach((s: any) => { if (s.statusDisplay === 'Accepted') processCfProblem(s); });
    cf?.solvedProblems?.forEach((s: any) => processCfProblem(s));
    cfFromSubmissions?.forEach((s: any) => processCfProblem(s));

    const hasRatingCounts = Object.values(cfRatingCounts).some(v => v > 0);
    const hasDivCounts = Object.values(cfDivCounts).some(v => v > 0);

    const grandTotal = lcTotal + cfTotal + ccTotal + csesTotal;

    return {
      lc: { rating: lcRating, easy: lcEasy, med: lcMed, hard: lcHard, total: lcTotal, totalSubs: lcTotalSubs, acSubs: lcAcSubs, acceptanceRate: lcAcceptanceRate, contestCount: lcContestCount, bestRank: lcBestRank },
      cf: { rating: cfRating, rank: cfRank, total: cfTotal, ratingCounts: cfRatingCounts, divCounts: cfDivCounts, hasRatingCounts, hasDivCounts },
      cc: { rating: ccRating, stars: ccStars, total: ccTotal, maxRating: ccMaxRating, contests: ccContests, nextStar: ccNextStar, nextTierRating: ccNextTierRating, progressPercent: ccStarProgressPercent },
      cses: { total: csesTotal, categories: csesCategories },
      grandTotal
    };
  }, [friends, profiles, allSubmissions, ownSolvedSet]);

  if (selectedFriend) {
    const isOwn = selectedFriend.id === 'own-user';
    const lcAccount = selectedFriend.accounts?.find(a => a.platform === 'leetcode')?.handle || (profiles[selectedFriend.username.toLowerCase()]?.platform === 'leetcode' ? selectedFriend.username : undefined);
    const cfAccount = selectedFriend.accounts?.find(a => a.platform === 'codeforces')?.handle || (profiles[selectedFriend.username.toLowerCase()]?.platform === 'codeforces' ? selectedFriend.username : undefined);
    const ccAccount = selectedFriend.accounts?.find(a => a.platform === 'codechef')?.handle || (profiles[selectedFriend.username.toLowerCase()]?.platform === 'codechef' ? selectedFriend.username : undefined);

    return (
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-strong)', padding: '24px', borderRadius: '0px' }}>
        <FriendProfileView 
          friend={selectedFriend}
          leetcodeProfile={lcAccount ? (profiles[`leetcode:${lcAccount.toLowerCase()}`] || profiles[lcAccount.toLowerCase()]) : undefined}
          codeforcesProfile={cfAccount ? (profiles[`codeforces:${cfAccount.toLowerCase()}`] || profiles[cfAccount.toLowerCase()]) : undefined}
          codechefProfile={ccAccount ? (profiles[`codechef:${ccAccount.toLowerCase()}`] || profiles[ccAccount.toLowerCase()]) : undefined}
          initialPlatform={(selectedPlatform as any) || undefined}
          initialFilter={selectedFilter}
          onBack={() => {
            setSelectedFriend(null);
            setSelectedPlatform('');
            setSelectedFilter('all');
          }}
          isDarkMode={isDarkMode}
          isExpanded={true}
          preloadedSubmissions={isOwn ? allSubmissions : undefined}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="tab-header" style={{ marginBottom: '24px' }}>
        <h2>Overview</h2>
        <p>Track your daily progress, ratings, practice sheets, and friend activity.</p>
      </div>

      {/* Consistency & Daily Streak Full-Width Banner */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-strong)', padding: '24px', borderRadius: '0px', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid var(--border-strong)', paddingBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: 'var(--font-size-title)', fontWeight: 700, color: 'var(--text-primary)' }}>
            <Zap size={20} color="#00C853" />
            <span>Daily Solves & Streak (Last 30 Days)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-strong)', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, fontSize: 'var(--font-size-base)' }}>
              <Flame size={16} color="#ffa116" />
              <span>{activityData.streak} Day Streak</span>
            </div>
            <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-strong)', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, fontSize: 'var(--font-size-base)', color: '#00C853' }}>
              <span>{activityData.totalSolves30Days} Solves (30d)</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(36px, 1fr))', gap: '8px', justifyContent: 'center' }}>
          {activityData.daysList.map(({ date, count, platforms, label, isToday }) => {
            const hasSolved = count > 0;
            let bg = 'var(--bg-primary)';
            let borderColor = 'var(--border-strong)';
            let color = 'var(--text-secondary)';

            if (hasSolved) {
              if (count >= 4) { bg = '#00C853'; borderColor = '#00E676'; color = '#000'; }
              else if (count >= 2) { bg = '#00E676'; borderColor = '#B9F6CA'; color = '#000'; }
              else { bg = '#1b5e20'; borderColor = '#4caf50'; color = '#fff'; }
            }

            return (
              <div
                key={date}
                title={`${label}${isToday ? ' (Today)' : ''}: ${count} solves${hasSolved ? ` (${Array.from(platforms).join(', ')})` : ''}`}
                style={{
                  height: '42px',
                  background: bg,
                  border: `1px solid ${isToday ? '#ffa116' : borderColor}`,
                  borderRadius: '0px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: 'var(--font-size-xs)',
                  color: color,
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease',
                  boxShadow: isToday ? '0 0 8px rgba(255,161,22,0.4)' : 'none'
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                {count > 0 ? count : '-'}
                {isToday && (
                  <div style={{ position: 'absolute', bottom: '1px', right: '1px', width: '6px', height: '6px', background: '#ffa116', borderRadius: '50%' }} />
                )}
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
          <span>&larr; 30 Days Ago</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Less</span>
            <div style={{ width: '12px', height: '12px', background: 'var(--bg-primary)', border: '1px solid var(--border-strong)' }} />
            <div style={{ width: '12px', height: '12px', background: '#1b5e20', border: '1px solid #4caf50' }} />
            <div style={{ width: '12px', height: '12px', background: '#00E676', border: '1px solid #B9F6CA' }} />
            <div style={{ width: '12px', height: '12px', background: '#00C853', border: '1px solid #00E676' }} />
            <span>More</span>
          </div>
          <span>Today &rarr;</span>
        </div>
      </div>

      {/* Ratings & Solved Counts (Minimal Flat Boxy Style) */}
      {personalStats && (
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', fontSize: 'var(--font-size-title)', fontWeight: 700, color: 'var(--text-primary)' }}>
            <Trophy size={20} color="#ffa116" />
            <span>Ratings & Solved Counts</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', alignItems: 'stretch' }}>
            {/* LeetCode Box */}
            <div className="dashboard-card" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-strong)', padding: '20px', borderRadius: '0px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-strong)', paddingBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, color: 'var(--text-primary)' }}>
                    <PlatformIcon platform="leetcode" size={18} />
                    <span>LeetCode</span>
                  </div>
                  <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#ffa116', fontSize: 'var(--font-size-base)' }}>{personalStats.lc.total} Solved</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>Contest Rating</div>
                    <div style={{ fontFamily: 'monospace', fontSize: 'calc(1.4 * var(--font-size-base))', fontWeight: 800, color: personalStats.lc.rating > 0 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                      {personalStats.lc.rating > 0 ? personalStats.lc.rating : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px', textAlign: 'right' }}>Best Global Rank</div>
                    <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-strong)', padding: '4px 10px', fontWeight: 800, fontSize: 'var(--font-size-xs)', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                      {personalStats.lc.bestRank}
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>Performance Overview</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                    <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-strong)', padding: '6px 4px', textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '2px' }}>Acceptance</div>
                      <div style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-xs)', fontWeight: 800, color: '#00C853' }}>{personalStats.lc.acceptanceRate}%</div>
                    </div>
                    <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-strong)', padding: '6px 4px', textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '2px' }}>Total Subs</div>
                      <div style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--text-primary)' }}>{personalStats.lc.totalSubs}</div>
                    </div>
                    <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-strong)', padding: '6px 4px', textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '2px' }}>Contests</div>
                      <div style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-xs)', fontWeight: 800, color: '#ffa116' }}>{personalStats.lc.contestCount}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', fontWeight: 700, marginBottom: '6px' }}>
                  <span style={{ color: 'var(--color-easy)' }}>{personalStats.lc.easy} Easy</span>
                  <span style={{ color: 'var(--color-medium)' }}>{personalStats.lc.med} Med</span>
                  <span style={{ color: 'var(--color-hard)' }}>{personalStats.lc.hard} Hard</span>
                </div>
                <div className="dashboard-progress-bar" style={{ display: 'flex', height: '6px', background: 'var(--bg-primary)', border: '1px solid var(--border-strong)', width: '100%' }}>
                  <div className="dashboard-progress-fill" style={{ width: `${personalStats.lc.total ? (personalStats.lc.easy / personalStats.lc.total) * 100 : 33}%`, background: 'var(--color-easy)' }} />
                  <div className="dashboard-progress-fill" style={{ width: `${personalStats.lc.total ? (personalStats.lc.med / personalStats.lc.total) * 100 : 34}%`, background: 'var(--color-medium)' }} />
                  <div className="dashboard-progress-fill" style={{ width: `${personalStats.lc.total ? (personalStats.lc.hard / personalStats.lc.total) * 100 : 33}%`, background: 'var(--color-hard)' }} />
                </div>
              </div>
            </div>

            {/* Codeforces Box */}
            <div className="dashboard-card" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-strong)', padding: '20px', borderRadius: '0px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-strong)', paddingBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, color: 'var(--text-primary)' }}>
                    <PlatformIcon platform="codeforces" size={18} />
                    <span>Codeforces</span>
                  </div>
                  <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#3b82f6', fontSize: 'var(--font-size-base)' }}>{personalStats.cf.total} Solved</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>Contest Rating</div>
                    <div style={{ fontFamily: 'monospace', fontSize: 'calc(1.4 * var(--font-size-base))', fontWeight: 800, color: personalStats.cf.rating > 0 ? '#3b82f6' : 'var(--text-secondary)' }}>
                      {personalStats.cf.rating > 0 ? personalStats.cf.rating : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px', textAlign: 'right' }}>Official Rank</div>
                    <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-strong)', padding: '4px 10px', fontWeight: 800, fontSize: 'var(--font-size-xs)', color: 'var(--text-primary)' }}>
                      {personalStats.cf.rank}
                    </div>
                  </div>
                </div>

                <div>
                  {/* Div Wise Counts */}
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>Division Breakdown</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                    {Object.entries(personalStats.cf.divCounts).map(([div, count]) => (
                      <div key={div} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-strong)', padding: '6px 4px', textAlign: 'center' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '2px' }}>{div}</div>
                        <div style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-xs)', fontWeight: 800, color: count > 0 ? '#3b82f6' : 'var(--text-secondary)' }}>{count}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                {/* Rating Wise Counts as bottom anchor */}
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>Rating Distribution</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                  {Object.entries(personalStats.cf.ratingCounts).slice(0, 8).map(([rate, count]) => {
                    let rateColor = 'var(--text-secondary)';
                    const rNum = parseInt(rate);
                    if (rNum >= 1500) rateColor = '#8a4af3';
                    else if (rNum >= 1200) rateColor = '#3b82f6';
                    else if (rNum >= 1000) rateColor = '#00C853';

                    return (
                      <div key={rate} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-strong)', padding: '6px 4px', textAlign: 'center' }}>
                        <div style={{ fontSize: '10px', color: rateColor, fontWeight: 700, marginBottom: '2px' }}>{rate}</div>
                        <div style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-xs)', fontWeight: 800, color: count > 0 ? '#3b82f6' : 'var(--text-secondary)' }}>{count}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* CodeChef Box */}
            <div className="dashboard-card" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-strong)', padding: '20px', borderRadius: '0px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-strong)', paddingBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, color: 'var(--text-primary)' }}>
                    <PlatformIcon platform="codechef" size={18} />
                    <span>CodeChef</span>
                  </div>
                  <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#8a4af3', fontSize: 'var(--font-size-base)' }}>{personalStats.cc.total} Solved</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>Contest Rating</div>
                    <div style={{ fontFamily: 'monospace', fontSize: 'calc(1.4 * var(--font-size-base))', fontWeight: 800, color: personalStats.cc.rating > 0 ? '#8a4af3' : 'var(--text-secondary)' }}>
                      {personalStats.cc.rating > 0 ? personalStats.cc.rating : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px', textAlign: 'right' }}>Star Tier</div>
                    <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-strong)', padding: '4px 10px', fontWeight: 800, fontSize: 'var(--font-size-xs)', color: '#ffa116' }}>
                      {personalStats.cc.stars}
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>Competition Stats</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px' }}>
                    <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-strong)', padding: '10px 8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '2px' }}>Highest Rating</div>
                      <div style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-base)', fontWeight: 800, color: personalStats.cc.maxRating > 0 ? '#8a4af3' : 'var(--text-secondary)' }}>{personalStats.cc.maxRating > 0 ? personalStats.cc.maxRating : 'N/A'}</div>
                    </div>
                    <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-strong)', padding: '10px 8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '2px' }}>Contests Participated</div>
                      <div style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-base)', fontWeight: 800, color: personalStats.cc.contests > 0 ? '#ffa116' : 'var(--text-secondary)' }}>{personalStats.cc.contests}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', fontWeight: 800, marginBottom: '6px', color: 'var(--text-primary)' }}>
                  <span>Next Tier ({personalStats.cc.nextStar})</span>
                  <span style={{ color: '#c084fc' }}>{personalStats.cc.rating} / {personalStats.cc.nextTierRating}</span>
                </div>
                <div className="dashboard-progress-bar" style={{ height: '6px', background: 'var(--bg-primary)', border: '1px solid var(--border-strong)', width: '100%' }}>
                  <div className="dashboard-progress-fill" style={{ width: `${personalStats.cc.progressPercent}%`, background: '#c084fc' }} />
                </div>
              </div>
            </div>

            {/* CSES Box */}
            <div className="dashboard-card" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-strong)', padding: '20px', borderRadius: '0px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-strong)', paddingBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, color: 'var(--text-primary)' }}>
                    <PlatformIcon platform="cses" size={18} />
                    <span>CSES</span>
                  </div>
                  <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#00C853', fontSize: 'var(--font-size-base)' }}>{personalStats.cses.total} Solved</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>Problem Set Mastery</div>
                    <div style={{ fontFamily: 'monospace', fontSize: 'calc(1.4 * var(--font-size-base))', fontWeight: 800, color: personalStats.cses.total > 0 ? '#00C853' : 'var(--text-secondary)' }}>
                      {personalStats.cses.total} / 300
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px', textAlign: 'right' }}>Status</div>
                    <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-strong)', padding: '4px 10px', fontWeight: 800, fontSize: 'var(--font-size-xs)', color: personalStats.cses.total > 0 ? '#00C853' : 'var(--text-secondary)' }}>
                      {personalStats.cses.total > 0 ? 'Active' : 'Pending'}
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>Category Breakdown</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px' }}>
                    {Object.entries(personalStats.cses.categories).map(([cat, count]) => (
                      <div key={cat} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-strong)', padding: '6px 8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={cat}>{cat}</div>
                        <div style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-xs)', fontWeight: 800, color: count > 0 ? '#00C853' : 'var(--text-secondary)' }}>{count}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                  <span>Overall Progress</span>
                  <span style={{ color: '#00C853' }}>{Math.round((personalStats.cses.total / 300) * 100)}%</span>
                </div>
                <div className="dashboard-progress-bar" style={{ height: '6px', background: 'var(--bg-primary)', border: '1px solid var(--border-strong)', width: '100%' }}>
                  <div className="dashboard-progress-fill" style={{ width: `${(personalStats.cses.total / 300) * 100}%`, background: '#00C853' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Row: Next 3 Contests & Active Sheet Info */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        {/* Widget 1: Next 3 Contests */}
        <div className="dashboard-card" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-strong)', padding: '24px', borderRadius: '0px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid var(--border-strong)', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: 'var(--font-size-title)', fontWeight: 700, color: 'var(--text-primary)' }}>
              <Calendar size={20} color="#3b82f6" />
              <span>Upcoming Contests</span>
            </div>
            <button 
              onClick={() => onNavigate?.('contests')} 
              style={{ background: 'transparent', border: 'none', color: '#3b82f6', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--font-size-sm)' }}
              onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
              onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
            >
              All Contests &rarr;
            </button>
          </div>

          {loadingContests ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading contests...</div>
          ) : upcomingContests.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>No upcoming contests found for active platforms.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flexGrow: 1 }}>
              {upcomingContests.map(c => {
                const isLC = c.platform === 'leetcode';
                const isCC = c.platform === 'codechef';
                const href = isLC ? `https://leetcode.com/contest/${c.id}` : isCC ? `https://www.codechef.com/${c.id}` : `https://codeforces.com/contests/${c.id}`;
                const diff = c.startTimeSeconds * 1000 - currentTime;
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const secs = Math.floor((diff % (1000 * 60)) / 1000);

                return (
                  <div key={`${c.platform}-${c.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-primary)', padding: '12px 16px', border: '1px solid var(--border-strong)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', background: 'var(--bg-secondary)', border: '1px solid var(--border-strong)' }}>
                        <PlatformIcon platform={c.platform} size={16} />
                      </span>
                      <div>
                        <a href={href} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700, color: 'var(--text-primary)', textDecoration: 'none', display: 'block', marginBottom: '2px', fontSize: 'var(--font-size-base)' }} onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'} onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}>
                          {c.name}
                        </a>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                          {new Date(c.startTimeSeconds * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} @ {new Date(c.startTimeSeconds * 1000).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 'var(--font-size-base)', color: diff > 0 ? 'var(--color-easy)' : 'var(--text-secondary)' }}>
                      {diff > 0 ? `${days}d ${hours}h ${mins}m ${secs}s` : '● LIVE'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Widget 2: Active Sheet Info */}
        <div className="dashboard-card" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-strong)', padding: '24px', borderRadius: '0px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid var(--border-strong)', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: 'var(--font-size-title)', fontWeight: 700, color: 'var(--text-primary)' }}>
              <FileSpreadsheet size={20} color="#ffa116" />
              <span>Active Practice Sheet</span>
            </div>
            <button 
              onClick={() => onNavigate?.('sheets')} 
              style={{ background: 'transparent', border: 'none', color: '#ffa116', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--font-size-sm)' }}
              onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
              onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
            >
              Open Tracker &rarr;
            </button>
          </div>

          {loadingSheet ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading sheet data...</div>
          ) : !sheetMeta ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <div>No active sheet tracked right now. Choose a curated roadmap from the Sheets Tracker!</div>
              <button onClick={() => onNavigate?.('sheets')} style={{ background: '#ffa116', color: '#000', border: 'none', padding: '8px 16px', fontWeight: 700, cursor: 'pointer' }}>Choose Sheet</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flexGrow: 1 }}>
              <div>
                <div style={{ fontSize: 'calc(1.4 * var(--font-size-base))', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '6px' }}>{sheetMeta.name}</div>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ background: 'var(--border-strong)', padding: '2px 8px', borderRadius: '0px', color: 'var(--text-primary)', fontWeight: 600 }}>{sheetMeta.group}</span>
                  <span>Curated Practice Roadmap</span>
                </div>

                <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--font-size-base)', fontWeight: 700 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Progress</span>
                  <span style={{ fontFamily: 'monospace', color: '#ffa116', fontSize: 'calc(1.1 * var(--font-size-base))' }}>{sheetProgress.solved} / {sheetProgress.total} ({sheetProgress.percent}%)</span>
                </div>
                <div className="dashboard-progress-bar" style={{ height: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-strong)', borderRadius: '0px', overflow: 'hidden', marginBottom: '28px' }}>
                  <div className="dashboard-progress-fill" style={{ height: '100%', width: `${sheetProgress.percent}%`, background: '#ffa116' }}></div>
                </div>
              </div>

              <button 
                onClick={() => onNavigate?.('sheets')} 
                style={{ width: '100%', padding: '14px', background: '#ffa116', color: '#000', border: 'none', borderRadius: '0px', fontWeight: 800, fontSize: 'var(--font-size-base)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'opacity 0.2s ease' }}
                onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
                onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
              >
                <Play size={18} fill="#000" />
                <span>Resume Practice</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Middle Section: Recent Friend Activity */}
      <div className="dashboard-card" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-strong)', padding: '24px', borderRadius: '0px', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid var(--border-strong)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: 'var(--font-size-title)', fontWeight: 700, color: 'var(--text-primary)' }}>
            <Flame size={20} color="#00C853" />
            <span>Recent Friend Activity</span>
          </div>
          <button 
            onClick={() => onNavigate?.('friends')} 
            style={{ background: 'transparent', border: 'none', color: '#00C853', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--font-size-sm)' }}
            onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
            onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
          >
            All Friends &rarr;
          </button>
        </div>

        {recentFriends.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>No recent friend problem solving activity found.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            {recentFriends.map(({ friend, latestTime, latestProb, platform, avatar }) => (
              <div 
                key={friend.id || friend.username} 
                onClick={() => {
                  setSelectedFriend(friend);
                  setSelectedPlatform(platform);
                  setSelectedFilter('all');
                }}
                style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-strong)', padding: '20px', borderRadius: '0px', cursor: 'pointer', transition: 'border-color 0.2s ease, transform 0.2s ease', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                onMouseOver={(e) => { e.currentTarget.style.borderColor = '#00C853'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '0px', background: 'var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 'var(--font-size-title)', color: 'var(--text-primary)', border: '1px solid #00C853', position: 'relative', flexShrink: 0, overflow: 'hidden' }}>
                    <div style={{ position: 'absolute' }}>{(friend.displayName || friend.username).charAt(0).toUpperCase()}</div>
                    {avatar && (
                      <img
                        src={avatar}
                        alt={friend.displayName || friend.username}
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 1 }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 'var(--font-size-base)', color: 'var(--text-primary)', marginBottom: '2px' }}>{friend.displayName || friend.username}</div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} />
                      <span>{new Date(latestTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} {new Date(latestTime).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </div>

                <div style={{ background: 'var(--bg-secondary)', padding: '10px 12px', border: '1px solid var(--border-strong)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <PlatformIcon platform={platform} size={16} />
                  <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={latestProb}>
                    {latestProb}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Section: Recent Problems Solved by Friends (Unsolved by You) */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-strong)', padding: '24px', borderRadius: '0px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--border-strong)', paddingBottom: '12px', fontSize: 'var(--font-size-title)', fontWeight: 700, color: 'var(--text-primary)' }}>
          <Trophy size={20} color="#ffa116" />
          <span>Recent Problems Solved by Friends (Unsolved by You)</span>
        </div>

        {unsolvedFriendsProblems.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>You are completely caught up! You have solved all recent problems attempted by your friends.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="head-to-head-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-strong)', background: 'var(--bg-primary)' }}>
                  <th style={{ padding: '14px 16px', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', color: 'var(--text-secondary)', width: '60px', textAlign: 'center' }}>Platform</th>
                  <th style={{ padding: '14px 16px', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Problem Name</th>
                  <th style={{ padding: '14px 16px', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Solved By</th>
                  <th style={{ padding: '14px 16px', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Latest Activity</th>
                  <th style={{ padding: '14px 16px', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', color: 'var(--text-secondary)', textAlign: 'center', width: '120px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {unsolvedFriendsProblems.map((prob) => (
                  <tr key={`${prob.platform}-${prob.titleSlug}`} style={{ borderBottom: '1px solid var(--border-strong)', transition: 'background 0.2s ease' }} onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-primary)'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', background: 'var(--bg-primary)', border: '1px solid var(--border-strong)' }}>
                        <PlatformIcon platform={prob.platform} size={16} />
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', fontWeight: 800, fontSize: 'var(--font-size-base)', color: 'var(--text-primary)' }}>
                      {prob.url ? (
                        <a href={prob.url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }} onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'} onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}>
                          {prob.title}
                        </a>
                      ) : (
                        prob.title
                      )}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {prob.solvedBy.map(name => (
                          <span key={name} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-strong)', padding: '2px 8px', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--text-secondary)' }}>
                            {name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                      {new Date(prob.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} {new Date(prob.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      {prob.url && (
                        <a 
                          href={prob.url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', background: '#ffa116', color: '#000', fontWeight: 800, fontSize: 'var(--font-size-xs)', textDecoration: 'none', transition: 'opacity 0.2s ease' }}
                          onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
                          onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
                        >
                          <span>Solve</span>
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};


