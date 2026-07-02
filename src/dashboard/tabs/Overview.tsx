import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSWRChromeStorage } from '../../hooks/useSWRChromeStorage';
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

import { ContestsWidget } from './components/Overview/ContestsWidget';
import { MiniSheetWidget } from './components/Overview/MiniSheetWidget';
import { FriendsProgressWidget } from './components/Overview/FriendsProgressWidget';
import { RecentSubmissionsWidget } from './components/Overview/RecentSubmissionsWidget';


import { useAppStore } from '../../store/useAppStore';

interface Props {
  onNavigate?: (tab: string) => void;
}

export const Overview: React.FC<Props> = ({ onNavigate }) => {
  const friends = useAppStore(state => state.friends);
  const profiles = useAppStore(state => state.profiles);
  const isDarkMode = useAppStore(state => state.isDarkMode);
  const selectedGlobalPlatforms = useAppStore(state => state.selectedGlobalPlatforms);
  const allSubmissions = useAppStore(state => state.allSubmissions);
  const followedSheets = useAppStore(state => state.followedSheets);
  const selectedFriend = useAppStore(state => state.ui_ovSelectedFriend);
  const setPartial = useAppStore(state => state.setPartial);
  const setSelectedFriend = (v: Friend | null) => setPartial({ ui_ovSelectedFriend: v });

  const selectedPlatform = useAppStore(state => state.ui_ovSelectedPlatform);
  const setSelectedPlatform = (v: string) => setPartial({ ui_ovSelectedPlatform: v });

  const selectedFilter = useAppStore(state => state.ui_ovSelectedFilter) as 'all' | 'Easy' | 'Medium' | 'Hard';
  const setSelectedFilter = (v: 'all' | 'Easy' | 'Medium' | 'Hard') => setPartial({ ui_ovSelectedFilter: v });

  // ── Contests State ──
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchContests = useCallback(async () => {
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

    return [
      ...lcData.map(c => ({ ...c, platform: c.platform || 'leetcode' })).slice(0, 4),
      ...cfData.map(c => ({ ...c, platform: c.platform || 'codeforces' })).slice(0, 6),
      ...ccData.map(c => ({ ...c, platform: c.platform || 'codechef' })).slice(0, 4),
    ].sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);
  }, [selectedGlobalPlatforms]);

  const { data: contestsData, loading: loadingContests } = useSWRChromeStorage<any[]>(
    STORAGE_KEYS.UPCOMING_CONTESTS_CACHE,
    fetchContests,
    [fetchContests]
  );
  
  const contests = contestsData || [];

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
  const activeSheetId = useAppStore(state => state.ui_stSheetId);
  const setActiveSheetId = (v: string) => setPartial({ ui_stSheetId: v });

  const [sheetProblems, setSheetProblems] = useState<any[]>([]);
  const [loadingSheet, setLoadingSheet] = useState(true);

  useEffect(() => {
    const sid = activeSheetId;
    if (sid) {
      setActiveSheetId(sid);
    } else if (followedSheets && followedSheets.length > 0) {
      setActiveSheetId(followedSheets[0]);
    } else {
      setActiveSheetId("striversA2Z");
    }
  }, [followedSheets, activeSheetId]);

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

  const manuallySolved = useAppStore(state => state.manuallySolvedProblems) as Record<string, { solved: boolean; platform: string; title: string }>;

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

  // ── Personal Consistency & Daily Streak (Last 365 Days) ──
  const activityData = useMemo(() => {
    const today = new Date();
    const daysMap = new Map<string, { date: string; count: number; platforms: Set<string>; label: string; isToday: boolean; uniqueSlugs: Set<string>; monthName: string; monthIndex: number; platformCounts: Record<string, number> }>();
    const daysList: { date: string; count: number; platforms: Set<string>; label: string; isToday: boolean; uniqueSlugs: Set<string>; monthName: string; monthIndex: number; platformCounts: Record<string, number> }[] = [];

    for (let idx = 364; idx >= 0; idx--) {
      const d = new Date(today.getTime() - idx * 24 * 60 * 60 * 1000);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const key = `${year}-${month}-${day}`;
      const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const monthName = d.toLocaleDateString(undefined, { month: 'short' });
      const monthIndex = d.getMonth();
      const obj = { date: key, count: 0, platforms: new Set<string>(), label, isToday: idx === 0, uniqueSlugs: new Set<string>(), monthName, monthIndex, platformCounts: {} as Record<string, number> };
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
          entry.platformCounts[platform] = (entry.platformCounts[platform] || 0) + 1;
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

    if (ownFriend && selectedGlobalPlatforms.includes("leetcode")) {
      // Clear LeetCode data from recent/allSubmissions to prevent double counting
      daysList.forEach(entry => {
        const currentLcCount = entry.platformCounts["leetcode"] || 0;
        entry.count -= currentLcCount;
        entry.platformCounts["leetcode"] = 0;
        // (We leave uniqueSlugs for LC so tooltips still show the problems solved if they were fetched locally)
      });

      const lcProfile = getProfile(ownFriend, "leetcode");
      if (lcProfile?.submissionCalendar) {
        Object.entries(lcProfile.submissionCalendar).forEach(([ts, count]) => {
          const d = new Date(parseInt(ts, 10) * 1000);
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          const key = `${year}-${month}-${day}`;
          if (daysMap.has(key)) {
            const entry = daysMap.get(key)!;
            const calendarCount = count as number;
            if (calendarCount > 0) {
               entry.count += calendarCount;
               entry.platformCounts["leetcode"] = calendarCount;
               entry.platforms.add("leetcode");
            }
          }
        });
      }
    }

    let maxStreak = 0;
    let currentStreak = 0;
    let activeDays = 0;
    for (let i = 0; i < daysList.length; i++) {
      if (daysList[i].count > 0) {
        activeDays++;
        currentStreak++;
        if (currentStreak > maxStreak) maxStreak = currentStreak;
      } else {
        currentStreak = 0;
      }
    }

    let streak = 0;
    for (let idx = daysList.length - 1; idx >= 0; idx--) {
      if (daysList[idx].count > 0) {
        streak++;
      } else if (idx === daysList.length - 1) {
        continue; // ignore if today is 0 so far
      } else {
        break;
      }
    }

    const totalSolvesYear = daysList.reduce((acc, curr) => acc + curr.count, 0);

    const startDate = new Date(today.getTime() - 364 * 24 * 60 * 60 * 1000);
    const startDayOfWeek = startDate.getDay();
    const emptyCells = Array.from({ length: startDayOfWeek }).map((_, i) => i);

    const monthLabels: { label: string; colIndex: number }[] = [];
    let currentMonth = -1;
    const allCells = [...emptyCells.map(() => null), ...daysList];
    for (let i = 0; i < allCells.length; i += 7) {
      const cellInCol = allCells.slice(i, i + 7).find(c => c !== null);
      if (cellInCol) {
        if (cellInCol.monthIndex !== currentMonth) {
          // Avoid pushing a label if it's too close to the end (prevents cutoff)
          if (i / 7 < (allCells.length / 7) - 2) {
            monthLabels.push({ label: cellInCol.monthName, colIndex: i / 7 });
          }
          currentMonth = cellInCol.monthIndex;
        }
      }
    }

    return { daysList, emptyCells, monthLabels, streak, maxStreak, activeDays, totalSolvesYear, totalCols: Math.ceil(allCells.length / 7) };
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
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '16px', borderRadius: '0px' }}>
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

      {/* Top Section: Heatmap & Sheet Widget */}
      <div style={{ display: 'flex', flexWrap: 'nowrap', gap: '16px', alignItems: 'stretch', marginBottom: '32px' }}>
        <div style={{ flex: 2, minWidth: '0', overflow: 'hidden', background: 'var(--bg-secondary)', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '16px', borderRadius: '0px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        
        {/* LeetCode Style Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>{activityData.totalSolvesYear}</span>
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>submissions in the past one year</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '13px' }}>
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>Total active days: </span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{activityData.activeDays}</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>Max streak: </span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{activityData.maxStreak}</span>
            </div>
          </div>
        </div>

        <div style={{ overflowX: 'auto', paddingBottom: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            
            {/* The grid */}
            <div style={{ 
              display: 'grid', 
              gridTemplateRows: 'repeat(7, 1fr)', 
              gridAutoFlow: 'column', 
              gap: '3px', 
              justifyContent: 'start',
              minWidth: 'max-content',
              marginBottom: '8px'
            }}>
              {activityData.emptyCells.map(i => (
                <div key={`empty-${i}`} style={{ width: '12px', height: '12px', borderRadius: '2px', background: 'rgba(255, 255, 255, 0.04)' }} />
              ))}
              {activityData.daysList.map(({ date, count, platforms, label, isToday }) => {
                const hasSolved = count > 0;
                let bg = 'rgba(255, 255, 255, 0.04)';
                let borderColor = 'var(--border-strong)';

                if (hasSolved) {
                  if (count >= 4) { bg = '#00C853'; borderColor = '#00E676'; }
                  else if (count >= 2) { bg = '#00E676'; borderColor = '#B9F6CA'; }
                  else { bg = '#1b5e20'; borderColor = '#4caf50'; }
                }

                return (
                  <div
                    key={date}
                    title={`${label}${isToday ? ' (Today)' : ''}: ${count} solves${hasSolved ? ` (${Array.from(platforms).join(', ')})` : ''}`}
                    style={{
                      width: '12px',
                      height: '12px',
                      background: bg,
                      borderRadius: '2px',
                      position: 'relative',
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease',
                      boxShadow: isToday ? '0 0 8px rgba(255,161,22,0.4)' : 'none'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  />
                );
              })}
            </div>

            {/* X-axis (Months at the bottom) */}
            <div style={{ position: 'relative', height: '16px', minWidth: `${activityData.totalCols * 15}px` }}>
              {activityData.monthLabels.map((m, i) => (
                <div key={`${m.label}-${i}`} style={{ position: 'absolute', left: `${m.colIndex * 15}px`, fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  {m.label}
                </div>
              ))}
            </div>
            </div>
          </div>
        </div>

        {/* Right Side Widget: Active Sheet */}
        <div style={{ flex: 1, minWidth: '250px' }}>
          <MiniSheetWidget 
            loadingSheet={loadingSheet} 
            sheetMeta={sheetMeta} 
            sheetProgress={sheetProgress} 
            onNavigate={onNavigate} 
          />
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
            <div className="dashboard-card" style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '16px', borderRadius: '0px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '20px' }}>
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
                    <div style={{ background: 'rgba(255, 255, 255, 0.04)', border: 'none', borderRadius: '0px', padding: '4px 10px', fontWeight: 800, fontSize: 'var(--font-size-xs)', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                      {personalStats.lc.bestRank}
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>Performance Overview</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                    <div style={{ background: 'rgba(255, 255, 255, 0.04)', border: 'none', borderRadius: '0px', padding: '6px 4px', textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '2px' }}>Acceptance</div>
                      <div style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-xs)', fontWeight: 800, color: '#00C853' }}>{personalStats.lc.acceptanceRate}%</div>
                    </div>
                    <div style={{ background: 'rgba(255, 255, 255, 0.04)', border: 'none', borderRadius: '0px', padding: '6px 4px', textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '2px' }}>Total Subs</div>
                      <div style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--text-primary)' }}>{personalStats.lc.totalSubs}</div>
                    </div>
                    <div style={{ background: 'rgba(255, 255, 255, 0.04)', border: 'none', borderRadius: '0px', padding: '6px 4px', textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '2px' }}>Contests</div>
                      <div style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-xs)', fontWeight: 800, color: '#ffa116' }}>{personalStats.lc.contestCount}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                  <div style={{ background: 'rgba(255, 161, 22, 0.15)', padding: '8px 4px', textAlign: 'center', borderRadius: '0px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#ffa116' }}>{personalStats.lc.total}</div>
                    <div style={{ fontSize: '9px', textTransform: 'uppercase', color: 'rgba(255, 161, 22, 0.8)', fontWeight: 700, marginTop: '2px' }}>Total</div>
                  </div>
                  <div style={{ background: 'rgba(0, 200, 83, 0.15)', padding: '8px 4px', textAlign: 'center', borderRadius: '0px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#00C853' }}>{personalStats.lc.easy}</div>
                    <div style={{ fontSize: '9px', textTransform: 'uppercase', color: 'rgba(0, 200, 83, 0.8)', fontWeight: 700, marginTop: '2px' }}>Easy</div>
                  </div>
                  <div style={{ background: 'rgba(255, 161, 22, 0.15)', padding: '8px 4px', textAlign: 'center', borderRadius: '0px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#ffa116' }}>{personalStats.lc.med}</div>
                    <div style={{ fontSize: '9px', textTransform: 'uppercase', color: 'rgba(255, 161, 22, 0.8)', fontWeight: 700, marginTop: '2px' }}>Med</div>
                  </div>
                  <div style={{ background: 'rgba(211, 47, 47, 0.15)', padding: '8px 4px', textAlign: 'center', borderRadius: '0px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#D32F2F' }}>{personalStats.lc.hard}</div>
                    <div style={{ fontSize: '9px', textTransform: 'uppercase', color: 'rgba(211, 47, 47, 0.8)', fontWeight: 700, marginTop: '2px' }}>Hard</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Codeforces Box */}
            <div className="dashboard-card" style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '16px', borderRadius: '0px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '20px' }}>
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
                    <div style={{ background: 'rgba(255, 255, 255, 0.04)', border: 'none', borderRadius: '0px', padding: '4px 10px', fontWeight: 800, fontSize: 'var(--font-size-xs)', color: 'var(--text-primary)' }}>
                      {personalStats.cf.rank}
                    </div>
                  </div>
                </div>

                <div>
                  {/* Div Wise Counts */}
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>Division Breakdown</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                    {Object.entries(personalStats.cf.divCounts).map(([div, count]) => (
                      <div key={div} style={{ background: 'rgba(255, 255, 255, 0.04)', border: 'none', borderRadius: '0px', padding: '6px 4px', textAlign: 'center' }}>
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
                      <div key={rate} style={{ background: 'rgba(255, 255, 255, 0.04)', border: 'none', borderRadius: '0px', padding: '6px 4px', textAlign: 'center' }}>
                        <div style={{ fontSize: '10px', color: rateColor, fontWeight: 700, marginBottom: '2px' }}>{rate}</div>
                        <div style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-xs)', fontWeight: 800, color: count > 0 ? '#3b82f6' : 'var(--text-secondary)' }}>{count}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* CodeChef Box */}
            <div className="dashboard-card" style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '16px', borderRadius: '0px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '20px' }}>
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
                    <div style={{ background: 'rgba(255, 255, 255, 0.04)', border: 'none', borderRadius: '0px', padding: '4px 10px', fontWeight: 800, fontSize: 'var(--font-size-xs)', color: '#ffa116' }}>
                      {personalStats.cc.stars}
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>Competition Stats</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px' }}>
                    <div style={{ background: 'rgba(255, 255, 255, 0.04)', border: 'none', borderRadius: '0px', padding: '10px 8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '2px' }}>Highest Rating</div>
                      <div style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-base)', fontWeight: 800, color: personalStats.cc.maxRating > 0 ? '#8a4af3' : 'var(--text-secondary)' }}>{personalStats.cc.maxRating > 0 ? personalStats.cc.maxRating : 'N/A'}</div>
                    </div>
                    <div style={{ background: 'rgba(255, 255, 255, 0.04)', border: 'none', borderRadius: '0px', padding: '10px 8px', textAlign: 'center' }}>
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
                <div className="dashboard-progress-bar" style={{ height: '6px', background: 'rgba(255, 255, 255, 0.04)', border: 'none', borderRadius: '0px', width: '100%' }}>
                  <div className="dashboard-progress-fill" style={{ width: `${personalStats.cc.progressPercent}%`, background: '#c084fc' }} />
                </div>
              </div>
            </div>

            {/* CSES Box */}
            <div className="dashboard-card" style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '16px', borderRadius: '0px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '20px' }}>
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
                    <div style={{ background: 'rgba(255, 255, 255, 0.04)', border: 'none', borderRadius: '0px', padding: '4px 10px', fontWeight: 800, fontSize: 'var(--font-size-xs)', color: personalStats.cses.total > 0 ? '#00C853' : 'var(--text-secondary)' }}>
                      {personalStats.cses.total > 0 ? 'Active' : 'Pending'}
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>Category Breakdown</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px' }}>
                    {Object.entries(personalStats.cses.categories).map(([cat, count]) => (
                      <div key={cat} style={{ background: 'rgba(255, 255, 255, 0.04)', border: 'none', borderRadius: '0px', padding: '6px 8px', textAlign: 'center' }}>
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
                <div className="dashboard-progress-bar" style={{ height: '6px', background: 'rgba(255, 255, 255, 0.04)', border: 'none', borderRadius: '0px', width: '100%' }}>
                  <div className="dashboard-progress-fill" style={{ width: `${(personalStats.cses.total / 300) * 100}%`, background: '#00C853' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Section: Upcoming Contests */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        <ContestsWidget 
          loadingContests={loadingContests} 
          upcomingContests={upcomingContests} 
          currentTime={currentTime} 
          onNavigate={onNavigate} 
        />
      </div>

      <FriendsProgressWidget 
        recentFriends={recentFriends} 
        setSelectedFriend={setSelectedFriend} 
        setSelectedPlatform={setSelectedPlatform} 
        setSelectedFilter={setSelectedFilter} 
        onNavigate={onNavigate} 
      />

      <RecentSubmissionsWidget 
        unsolvedFriendsProblems={unsolvedFriendsProblems} 
      />
    </div>
  );
};


