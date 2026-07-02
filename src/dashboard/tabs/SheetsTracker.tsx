import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { FriendProfile, Friend } from "../../types";
import { SHEET_METADATA } from "../data/sheetsMetadata";
import {
  LeetCodeIcon,
  CodeforcesIcon,
  CodeChefIcon,
} from "../../utils/PlatformIcons";

export interface SheetProblem {
  title: string;
  titleSlug: string;
  difficulty: "Easy" | "Medium" | "Hard";
  category: string;
  platform?:
    | "leetcode"
    | "codeforces"
    | "cses"
    | "gfg"
    | "codechef"
    | "other"
    | "tuf";
  youtubeLink?: string;
  url?: string;
}

interface Props {
  friends: Friend[];
  profiles: Record<string, FriendProfile>;
  allSubmissions: any[];
  selectedGlobalPlatforms?: string[];
  selectedSheetId?: string;
  setSelectedSheetId?: (id: string) => void;
}

// Memory cache so we don't re-fetch unnecessarily
const sheetCache: Record<string, SheetProblem[]> = {};

export const SheetsTracker: React.FC<Props> = ({
  friends,
  profiles,
  allSubmissions,
  selectedGlobalPlatforms = ["leetcode", "codeforces", "codechef"],
  selectedSheetId: propsSelectedSheetId,
  setSelectedSheetId: propsSetSelectedSheetId,
}) => {
  // ── Local-persistent state (survives refresh & syncs across tabs) ───────────────────────────
  const ss = <T,>(key: string, fallback: T): T => {
    try {
      const v = localStorage.getItem(`st_${key}`);
      if (v !== null) return JSON.parse(v) as T;
    } catch { /* ignore */ }
    return fallback;
  };
  const setSS = <T,>(key: string, value: T) => {
    try { localStorage.setItem(`st_${key}`, JSON.stringify(value)); } catch { /* ignore */ }
  };

  const [localSheetId, _setLocalSheetId] = useState<string>(() => ss("sheetId", ""));
  
  const selectedSheetId = propsSelectedSheetId !== undefined ? propsSelectedSheetId : localSheetId;
  const setSelectedSheetId = (id: string) => {
    setSS("sheetId", id);
    if (propsSetSelectedSheetId) {
      propsSetSelectedSheetId(id);
    } else {
      _setLocalSheetId(id);
    }
  };

  const activeSheet = SHEET_METADATA.find((s) => s.id === selectedSheetId);

  const [sheetData, setSheetData] = useState<SheetProblem[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [categoryFilter, _setCategoryFilter] = useState<string>(() => ss("catFilter", "All"));
  const setCategoryFilter = (v: string) => { setSS("catFilter", v); _setCategoryFilter(v); };

  const [difficultyFilter, _setDifficultyFilter] = useState<string>(() => ss("diffFilter", "All"));
  const setDifficultyFilter = (v: string) => { setSS("diffFilter", v); _setDifficultyFilter(v); };

  const [statusFilter, _setStatusFilter] = useState<string>(() => ss("statusFilter", "All"));
  const setStatusFilter = (v: string) => { setSS("statusFilter", v); _setStatusFilter(v); };

  const [platformFilter, _setPlatformFilter] = useState<string>(() => ss("platFilter", "All"));
  const setPlatformFilter = (v: string) => { setSS("platFilter", v); _setPlatformFilter(v); };

  const [videoFilter, _setVideoFilter] = useState<string>(() => ss("videoFilter", "All"));
  const setVideoFilter = (v: string) => { setSS("videoFilter", v); _setVideoFilter(v); };

  const [searchQuery, _setSearchQuery] = useState<string>(() => ss("searchQuery", ""));
  const setSearchQuery = (v: string) => { setSS("searchQuery", v); _setSearchQuery(v); };

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'st_sheetId' && e.newValue) {
        try {
          const val = JSON.parse(e.newValue);
          _setLocalSheetId(val);
          if (propsSetSelectedSheetId) {
            propsSetSelectedSheetId(val);
          }
        } catch {}
      } else if (e.key === 'st_catFilter' && e.newValue) {
        try { _setCategoryFilter(JSON.parse(e.newValue)); } catch {}
      } else if (e.key === 'st_diffFilter' && e.newValue) {
        try { _setDifficultyFilter(JSON.parse(e.newValue)); } catch {}
      } else if (e.key === 'st_statusFilter' && e.newValue) {
        try { _setStatusFilter(JSON.parse(e.newValue)); } catch {}
      } else if (e.key === 'st_platFilter' && e.newValue) {
        try { _setPlatformFilter(JSON.parse(e.newValue)); } catch {}
      } else if (e.key === 'st_videoFilter' && e.newValue) {
        try { _setVideoFilter(JSON.parse(e.newValue)); } catch {}
      } else if (e.key === 'st_searchQuery' && e.newValue) {
        try { _setSearchQuery(JSON.parse(e.newValue)); } catch {}
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(),
  );
  const [revisionStars, setRevisionStars] = useState<Set<string>>(new Set());
  const [followedSheets, setFollowedSheets] = useState<string[]>([]);
  const [dismissedNotice, setDismissedNotice] = useState(false);
  const [blindMode, setBlindMode] = useState(false);

  // ── Global search ────────────────────────────────────────────────────────
  const [globalSearch, setGlobalSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggIdx, setActiveSuggIdx] = useState(-1);
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexReady, setIndexReady] = useState(false);
  const globalSearchRef = useRef<HTMLDivElement>(null);
  const globalSearchInputRef = useRef<HTMLInputElement>(null);

  type SearchEntry = {
    title: string;
    titleSlug: string;
    difficulty: string;
    platform: string;
    category: string;
    sheetId: string;
    sheetName: string;
    url?: string;
  };
  const searchIndexRef = useRef<SearchEntry[]>([]);

  const PLATFORM_LABELS: Record<string, string> = {
    leetcode: "LeetCode", codeforces: "Codeforces", codechef: "CodeChef",
    cses: "CSES", gfg: "GeeksforGeeks", tuf: "TUF", other: "TUF",
  };
  const DIFFICULTY_COLORS: Record<string, string> = {
    Easy: "#00b8a3", Medium: "#ffc01e", Hard: "#ff375f",
  };

  // Build full-text search index from ALL sheets in background
  useEffect(() => {
    let cancelled = false;
    const buildIndex = async () => {
      setIsIndexing(true);
      const entries: SearchEntry[] = [];
      const allMeta = SHEET_METADATA.filter((s: any) => !s.hidden && s.available !== false) as any[];
      for (const meta of allMeta) {
        if (cancelled) break;
        try {
          let problems: SheetProblem[] = [];
          if (sheetCache[meta.id]) {
            problems = sheetCache[meta.id];
          } else if (meta.subSheets) {
            for (const subId of meta.subSheets) {
              if (cancelled) break;
              try {
                const r = await fetch(chrome.runtime.getURL(`sheets/${subId}.json`));
                const d: SheetProblem[] = await r.json();
                problems = [...problems, ...d];
              } catch { /* skip */ }
            }
            sheetCache[meta.id] = problems;
          } else {
            const r = await fetch(chrome.runtime.getURL(`sheets/${meta.id}.json`));
            problems = await r.json();
            sheetCache[meta.id] = problems;
          }
          problems.forEach(p => {
            if (!p || typeof p !== 'object') {
              console.warn(`[SheetsTracker] Invalid problem entry:`, p);
              return;
            }
            if (typeof p.title !== 'string' || !p.title.trim()) {
              console.warn(`[SheetsTracker] Invalid or missing title:`, p);
              return;
            }
            if (typeof p.titleSlug !== 'string' || !p.titleSlug.trim()) {
              console.warn(`[SheetsTracker] Invalid or missing titleSlug:`, p);
              return;
            }
            const platform = typeof p.platform === 'string' && p.platform.trim() ? p.platform.toLowerCase() : 'leetcode';
            const difficulty = typeof p.difficulty === 'string' && p.difficulty.trim() ? p.difficulty : 'Medium';
            const category = typeof p.category === 'string' && p.category.trim() ? p.category : 'General';
            entries.push({
              title: p.title.trim(),
              titleSlug: p.titleSlug.trim(),
              difficulty,
              platform,
              category,
              sheetId: meta.id,
              sheetName: meta.name,
              url: p.url || '',
            });
          });
        } catch { /* skip bad sheet */ }
      }
      if (!cancelled) {
        searchIndexRef.current = entries;
        setIsIndexing(false);
        setIndexReady(true);
      }
    };
    buildIndex();
    return () => { cancelled = true; };
  // Only run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (globalSearchRef.current && !globalSearchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  type Suggestion =
    | { kind: "sheet"; id: string; name: string; group: string; questions: number }
    | { kind: "problem"; title: string; titleSlug: string; platform: string; difficulty: string; category: string; sheetId: string; sheetName: string; url?: string; appearances: number }
    | { kind: "category"; label: string; category: string; count: number };

  const globalSuggestions = useMemo((): Suggestion[] => {
    const q = globalSearch.trim().toLowerCase();
    if (q.length < 2) return [];
    const results: Suggestion[] = [];

    // 1. Sheet name matches (always available)
    const sheetMatches = (SHEET_METADATA as any[]).filter(s => !s.hidden && s.name.toLowerCase().includes(q));
    sheetMatches.slice(0, 5).forEach(s => {
      results.push({ kind: "sheet", id: s.id, name: s.name, group: s.group, questions: s.questions });
    });

    // 2. Problem matches from search index (cross-sheet)
    if (searchIndexRef.current.length > 0) {
      // Deduplicate by titleSlug — track which sheets each slug appears in
      const slugMap = new Map<string, SearchEntry & { appearances: number; sheetName: string }>();
      for (const entry of searchIndexRef.current) {
        if (!entry.title.toLowerCase().includes(q)) continue;
        const existing = slugMap.get(entry.titleSlug);
        if (existing) {
          existing.appearances++;
        } else {
          slugMap.set(entry.titleSlug, { ...entry, appearances: 1 });
        }
      }
      // Sort: exact title match first, then alphabetical
      const sorted = Array.from(slugMap.values()).sort((a, b) => {
        const aExact = a.title.toLowerCase() === q ? -1 : 0;
        const bExact = b.title.toLowerCase() === q ? -1 : 0;
        if (aExact !== bExact) return aExact - bExact;
        return a.title.localeCompare(b.title);
      });
      sorted.slice(0, 8).forEach(e => {
        results.push({
          kind: "problem",
          title: e.title,
          titleSlug: e.titleSlug,
          platform: e.platform,
          difficulty: e.difficulty,
          category: e.category,
          sheetId: e.sheetId,
          sheetName: e.sheetName,
          url: e.url,
          appearances: e.appearances,
        });
      });
    }

    // 3. Category/topic matches (from index)
    const catCounts = new Map<string, number>();
    for (const entry of searchIndexRef.current) {
      if (entry.category.toLowerCase().includes(q)) {
        catCounts.set(entry.category, (catCounts.get(entry.category) || 0) + 1);
      }
    }
    // also from current sheet if loaded
    if (sheetData) {
      sheetData.forEach(p => {
        if (p.category.toLowerCase().includes(q)) {
          catCounts.set(p.category, (catCounts.get(p.category) || 0) + 1);
        }
      });
    }
    Array.from(catCounts.entries()).slice(0, 4).forEach(([cat, count]) => {
      // avoid duplicate if already in sheet matches
      if (!results.some(r => r.kind === "category" && r.category === cat)) {
        results.push({ kind: "category", label: cat, category: cat, count });
      }
    });

    return results;
  }, [globalSearch, indexReady, sheetData]);

  const handleGlobalSuggestionClick = useCallback((s: Suggestion) => {
    setShowSuggestions(false);
    setActiveSuggIdx(-1);
    setGlobalSearch("");
    if (s.kind === "sheet") {
      setSelectedSheetId(s.id);
    } else if (s.kind === "problem") {
      setSelectedSheetId(s.sheetId);
      // setSearchQuery will fire after sheet data loads via useEffect
      // Store pending search in a ref so it applies once sheetData is ready
      pendingProblemSearch.current = s.title;
    } else if (s.kind === "category") {
      if (selectedSheetId) setCategoryFilter(s.category);
    }
  }, [selectedSheetId]);

  const pendingProblemSearch = useRef<string | null>(null);
  useEffect(() => {
    if (pendingProblemSearch.current && sheetData) {
      setSearchQuery(pendingProblemSearch.current);
      pendingProblemSearch.current = null;
    }
  }, [sheetData]);

  // Highlight matching text in a string
  const highlightMatch = (text: string, query: string): React.ReactNode => {
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1 || !query) return text;
    return (
      <>
        {text.slice(0, idx)}
        <strong style={{ color: "var(--text-primary)", fontWeight: 700 }}>{text.slice(idx, idx + query.length)}</strong>
        {text.slice(idx + query.length)}
      </>
    );
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || globalSuggestions.length === 0) {
      if (e.key === "Escape") { setGlobalSearch(""); }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveSuggIdx(idx => Math.min(idx + 1, globalSuggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveSuggIdx(idx => Math.max(idx - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeSuggIdx >= 0 && activeSuggIdx < globalSuggestions.length) {
        handleGlobalSuggestionClick(globalSuggestions[activeSuggIdx]);
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setGlobalSearch("");
      setActiveSuggIdx(-1);
    }
  };

  // Reset active index when suggestions change
  useEffect(() => { setActiveSuggIdx(-1); }, [globalSuggestions.length]);

  useEffect(() => {
    chrome.storage.local.get(
      ["revision_stars", "dismissed_sheetstracker_info", "followed_sheets"],
      (res) => {
        if (res.revision_stars) {
          setRevisionStars(new Set(res.revision_stars));
        }
        if (res.dismissed_sheetstracker_info) {
          setDismissedNotice(true);
        }
        if (res.followed_sheets && Array.isArray(res.followed_sheets)) {
          setFollowedSheets(res.followed_sheets);
        }
      },
    );

    const handleStorageChange = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
      if (areaName === 'local') {
        if (changes.revision_stars) {
          setRevisionStars(new Set(changes.revision_stars.newValue || []));
        }
        if (changes.dismissed_sheetstracker_info) {
          setDismissedNotice(!!changes.dismissed_sheetstracker_info.newValue);
        }
        if (changes.followed_sheets) {
          setFollowedSheets(changes.followed_sheets.newValue || []);
        }
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  const toggleFollowSheet = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFollowedSheets((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      chrome.storage.local.set({ followed_sheets: next });
      return next;
    });
  };

  const toggleRevisionStar = (titleSlug: string) => {
    setRevisionStars((prev) => {
      const next = new Set(prev);
      if (next.has(titleSlug)) next.delete(titleSlug);
      else next.add(titleSlug);
      chrome.storage.local.set({ revision_stars: Array.from(next) });
      return next;
    });
  };

  useEffect(() => {
    let active = true;
    const fetchSheet = async () => {
      if (!selectedSheetId) {
        setSheetData(null);
        return;
      }
      setIsLoading(true);
      try {
        if (sheetCache[selectedSheetId]) {
          setSheetData(sheetCache[selectedSheetId]);
          setIsLoading(false);
          return;
        }

        const meta = (SHEET_METADATA as any).find(
          (s: any) => s.id === selectedSheetId,
        );

        if (meta && meta.subSheets) {
          let combinedData: SheetProblem[] = [];
          for (const subId of meta.subSheets) {
            const subUrl = chrome.runtime.getURL(`sheets/${subId}.json`);
            try {
              const res = await fetch(subUrl);
              const data = await res.json();
              combinedData = [...combinedData, ...data];
            } catch (err) {
              console.warn(`Failed to fetch sub-sheet ${subId}:`, err);
            }
          }
          sheetCache[selectedSheetId] = combinedData;
          if (active) {
            setSheetData(combinedData);
            setIsLoading(false);
          }
          return;
        }

        const url = chrome.runtime.getURL(`sheets/${selectedSheetId}.json`);
        const res = await fetch(url);
        const data = await res.json();
        sheetCache[selectedSheetId] = data;
        if (active) {
          setSheetData(data);
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Failed to fetch sheet data:", err);
        if (active) setIsLoading(false);
      }
    };
    fetchSheet();
    return () => {
      active = false;
    };
  }, [selectedSheetId]);

  const {
    hasMultiplePlatforms,
    availablePlatforms,
    hasVideoSolutions,
    uniqueCategories,
  } = useMemo(() => {
    if (!sheetData)
      return {
        hasMultiplePlatforms: false,
        availablePlatforms: [],
        hasVideoSolutions: false,
        uniqueCategories: [],
      };
    const platforms = new Set<string>();
    let hasVid = false;
    const cats = new Set<string>();

    sheetData.forEach((p) => {
      platforms.add(p.platform || "leetcode");
      if (p.youtubeLink) hasVid = true;
      if (p.category) cats.add(p.category);
    });

    return {
      hasMultiplePlatforms: platforms.size > 1,
      availablePlatforms: Array.from(platforms).sort(),
      hasVideoSolutions: hasVid,
      uniqueCategories: Array.from(cats).sort(),
    };
  }, [sheetData]);

  // Reset filters and collapsed state when changing sheets
  useEffect(() => {
    setCategoryFilter("All");
    setDifficultyFilter("All");
    setStatusFilter("All");
    setPlatformFilter("All");
    setVideoFilter("All");
    setSearchQuery("");
    setExpandedCategories(new Set());
  }, [selectedSheetId]);

  const trackerFriends = friends.filter((f) => f.id === "own-user");
  const allOtherFriends = friends.filter((f) => f.id !== "own-user");

  const [manuallySolved, setManuallySolved] = useState<
    Record<string, { solved: boolean; platform: string; title: string }>
  >({});

  useEffect(() => {
    chrome.storage.local.get(["manually_solved_problems", "blind_mode"], (res) => {
      if (res.manually_solved_problems) {
        setManuallySolved(res.manually_solved_problems);
      }
      if (res.blind_mode !== undefined) {
        setBlindMode(res.blind_mode);
      }
    });

    const handleStorageChange = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
      if (areaName === 'local') {
        if (changes.blind_mode) {
          setBlindMode(!!changes.blind_mode.newValue);
        }
        if (changes.manually_solved_problems) {
          setManuallySolved(changes.manually_solved_problems.newValue || {});
        }
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  const toggleManualSolve = (titleSlug: string, title: string, platform: string) => {
    const current = manuallySolved[titleSlug]?.solved || false;
    const updated = {
      ...manuallySolved,
      [titleSlug]: { solved: !current, platform, title },
    };
    setManuallySolved(updated);
    chrome.storage.local.set({ manually_solved_problems: updated });
  };

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

  const { ownSolvedSet, ownAttemptedSet, allFriendsSolvedSets } =
    useMemo(() => {
      const solved = new Set<string>();
      const attempted = new Set<string>();
      const ownFriend = friends.find((f) => f.id === "own-user");
      if (ownFriend) {
        ["leetcode", "codeforces", "codechef", "cses", "gfg"].forEach((plat) => {
          const profile = getProfile(ownFriend, plat);
          profile?.recentSubmissions?.forEach((sub) => {
            const slug = (plat === "codeforces" && sub.titleSlug) ? sub.titleSlug.replace("/", "") : sub.titleSlug;
            if (!slug) return;
            if (sub.statusDisplay === "Accepted") solved.add(slug);
            else attempted.add(slug);
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
        } else {
          attempted.add(slug);
        }
      });

      Object.entries(manuallySolved).forEach(([slug, data]) => {
        if (data && data.solved) {
          solved.add(slug);
        }
      });

      const otherFriendsSets = allOtherFriends.map((f) => {
        const fSolved = new Set<string>();
        ["leetcode", "codeforces", "codechef", "cses", "gfg"].forEach((plat) => {
          const profile = getProfile(f, plat);
          profile?.recentSubmissions?.forEach((sub) => {
            const slug = (plat === "codeforces" && sub.titleSlug) ? sub.titleSlug.replace("/", "") : sub.titleSlug;
            if (!slug) return;
            if (sub.statusDisplay === "Accepted") fSolved.add(slug);
          });
          if ((profile as any)?.solvedProblems) {
            (profile as any).solvedProblems.forEach((slug: string) => fSolved.add(slug));
          }
        });
        return { friend: f, solvedSet: fSolved };
      });

      return {
        ownSolvedSet: solved,
        ownAttemptedSet: attempted,
        allFriendsSolvedSets: otherFriendsSets,
      };
    }, [friends, profiles, allSubmissions, allOtherFriends, manuallySolved]);

  const hasHistoricalSubmissions = allSubmissions && allSubmissions.length > 0;

  const groupedData = useMemo(() => {
    if (!sheetData) return {};

    // First, filter the data
    const filtered = sheetData.filter((p) => {
      // 1. Topic
      if (categoryFilter !== "All" && p.category !== categoryFilter)
        return false;
      // 2. Difficulty
      if (difficultyFilter !== "All" && p.difficulty !== difficultyFilter)
        return false;
      // 3. Status (Pills filter)
      if (statusFilter !== "All") {
        const isSolved = ownSolvedSet.has(p.titleSlug);
        const isStar = revisionStars.has(p.titleSlug);
        const isAttempted = ownAttemptedSet.has(p.titleSlug) && !isSolved;
        if (statusFilter === "Solved" && !isSolved) return false;
        if (statusFilter === "Unsolved" && isSolved) return false;
        if (statusFilter === " For Revision" && !isStar) return false;
        if (statusFilter === "Attempted/Wrong Answer" && !isAttempted)
          return false;
      }
      // 4. Platform
      const rawPlat = p.platform || "leetcode";
      const probPlatform = rawPlat === "tuf" ? "leetcode" : rawPlat;
      if (platformFilter !== "All") {
        if (probPlatform !== platformFilter && p.platform !== platformFilter) return false;
      }
      if (!selectedGlobalPlatforms.includes(probPlatform) && probPlatform !== "other") return false;
      // 5. Video
      if (videoFilter === "Has Video" && !p.youtubeLink) return false;
      if (videoFilter === "No Video" && p.youtubeLink) return false;
      // 6. Search text
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        if (!p.title.toLowerCase().includes(query)) return false;
      }
      return true;
    });

    // Then group by category
    const map: Record<string, SheetProblem[]> = {};
    filtered.forEach((p) => {
      if (!map[p.category]) map[p.category] = [];
      map[p.category].push(p);
    });
    return map;
  }, [
    sheetData,
    categoryFilter,
    difficultyFilter,
    statusFilter,
    platformFilter,
    videoFilter,
    searchQuery,
    ownSolvedSet,
    ownAttemptedSet,
    revisionStars,
    selectedGlobalPlatforms,
    followedSheets,
  ]);

  // Group metadata for the select dropdown
  const sheetsByGroup = useMemo(() => {
    const groups: Record<string, typeof SHEET_METADATA> = {};
    const followedList: typeof SHEET_METADATA = [];
    SHEET_METADATA.forEach((s) => {
      if ((s as any).hidden) return;

      const isCsesSheet = s.id === "cses";
      const isCfSheet =
        s.id.startsWith("cp31") ||
        s.id.startsWith("a2oj") ||
        s.id === "codeprime75" ||
        s.id === "striverCpSheet";

      const hasGfgProblems = [
        "striver79",
        "loveBabbar",
        "dpMastery",
        "codeArmy",
        "arshDsa",
        "6companies30days",
      ].includes(s.id);

      const hasLeetCodeProblems = !isCsesSheet && !isCfSheet;

      let matches = false;
      if (selectedGlobalPlatforms.includes("cses") && isCsesSheet) matches = true;
      if (selectedGlobalPlatforms.includes("codeforces") && isCfSheet) matches = true;
      if (selectedGlobalPlatforms.includes("gfg") && hasGfgProblems) matches = true;
      if (selectedGlobalPlatforms.includes("leetcode") && hasLeetCodeProblems) matches = true;

      if (!matches) return;

      if (followedSheets.includes(s.id)) {
        followedList.push(s);
      }

      if (!groups[s.group]) groups[s.group] = [];
      groups[s.group].push(s);
    });
    if (followedList.length > 0) {
      return { " Followed Sheets": followedList, ...groups };
    }
    return groups;
  }, [selectedGlobalPlatforms, followedSheets]);

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const sheetProgress = useMemo(() => {
    if (!sheetData) return { total: 0, solved: 0, percent: 0 };
    let solvedCount = 0;
    sheetData.forEach((p) => {
      if (ownSolvedSet.has(p.titleSlug)) solvedCount++;
    });
    const percent =
      sheetData.length > 0
        ? Math.round((solvedCount / sheetData.length) * 100)
        : 0;
    return { total: sheetData.length, solved: solvedCount, percent };
  }, [sheetData, ownSolvedSet]);

  // ── Cross-sheet index: slug → list of sheet IDs that contain it ───────────
  // Built lazily from sheetCache (already-visited sheets)
  const crossSheetIndex = useMemo(() => {
    const index: Record<string, string[]> = {};
    Object.entries(sheetCache).forEach(([sid, problems]) => {
      if (sid === selectedSheetId) return; // skip current sheet
      problems.forEach((p) => {
        if (!index[p.titleSlug]) index[p.titleSlug] = [];
        if (!index[p.titleSlug].includes(sid)) index[p.titleSlug].push(sid);
      });
    });
    return index;
  // Re-compute whenever sheetData changes or the global index finishes building
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetData, selectedSheetId, indexReady]);

  // Helper: get short display name for a sheet id
  const getSheetName = (id: string): string => {
    const meta = (SHEET_METADATA as any[]).find((s) => s.id === id);
    return meta?.name ?? id;
  };

  const filterStyle: React.CSSProperties = {
    padding: "8px 12px",
    border: "1px solid var(--border-strong)",
    background: "var(--bg-primary)",
    color: "var(--text-primary)",
    borderRadius: "0px",
    cursor: "pointer",
  };

  return (
    <div>
      <div
        className="tab-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <h2 style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {activeSheet ? activeSheet.name : "Sheets Tracker"}
            {activeSheet && (
              <button
                title={followedSheets.includes(activeSheet.id) ? "Unfollow sheet" : "Follow sheet (pin to top)"}
                onClick={(e) => toggleFollowSheet(activeSheet.id, e)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "18px",
                  padding: "4px",
                  color: followedSheets.includes(activeSheet.id) ? "#ffa116" : "var(--text-secondary)",
                  opacity: followedSheets.includes(activeSheet.id) ? 1 : 0.4,
                  transition: "opacity 0.2s ease, color 0.2s ease",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
                onMouseOver={(e) => (e.currentTarget.style.opacity = "1")}
                onMouseOut={(e) => (e.currentTarget.style.opacity = followedSheets.includes(activeSheet.id) ? "1" : "0.4")}
              >
                {followedSheets.includes(activeSheet.id) ? "★" : "☆"}
              </button>
            )}
            <span
              title={activeSheet 
                ? `Track your problem-solving roadmap for ${activeSheet.name}. Problems are automatically marked green when a matching accepted submission is found in your synced platform history.`
                : "Track your problem-solving roadmap. Problems are automatically marked green when a matching accepted submission is found in your synced platform history."}
              style={{
                fontSize: "var(--font-size-title)",
                cursor: "help",
                opacity: 0.7,
                fontWeight: "normal",
              }}
            >
              (i)
            </span>
          </h2>
          <p>
            {activeSheet 
              ? `${activeSheet.group} Series — ${activeSheet.questions} curated questions.`
              : "Track your completion across popular lists."}
          </p>
        </div>
        {selectedSheetId && (
          <div>
            <button
              onClick={() => setSelectedSheetId("")}
              style={{
                padding: "10px 20px",
                background: "var(--bg-secondary)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-strong)",
                borderRadius: "0px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontWeight: 600,
                textTransform: "uppercase",
                transition: "all 0.1s ease-out",
                boxShadow: "none",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = "var(--bg-hover)";
                e.currentTarget.style.borderColor = "var(--text-primary)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = "var(--bg-secondary)";
                e.currentTarget.style.borderColor = "var(--border-strong)";
              }}
            >
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
              >
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
              <span
                style={{
                  fontSize: "var(--font-size-title)",
                  letterSpacing: "0.5px",
                }}
              >
                Back
              </span>
            </button>
          </div>
        )}
      </div>

      {/* ── Global Search Bar ──────────────────────────────────────────────── */}
      <div
        ref={globalSearchRef}
        style={{ position: "relative", marginBottom: "20px", zIndex: 100 }}
      >
        {/* Input row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "10px 14px",
            background: "var(--bg-secondary)",
            border: `1px solid ${showSuggestions && globalSearch.length >= 2 ? "#ffa116" : "var(--border-strong)"}`,
            borderBottom: showSuggestions && globalSuggestions.length > 0 ? "1px solid var(--border-color)" : undefined,
            borderRadius: showSuggestions && globalSuggestions.length > 0 ? "4px 4px 0 0" : "4px",
            transition: "border-color 0.15s ease",
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ opacity: 0.45, flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={globalSearchInputRef}
            type="text"
            placeholder="Search sheets, problems, topics... (↑↓ navigate, Enter select, Esc clear)"
            value={globalSearch}
            onChange={e => { setGlobalSearch(e.target.value); setShowSuggestions(true); setActiveSuggIdx(-1); }}
            onFocus={() => { if (globalSearch.length >= 2) setShowSuggestions(true); }}
            onKeyDown={handleSearchKeyDown}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text-primary)",
              fontSize: "var(--font-size-title)",
            }}
          />
          {isIndexing && (
            <span style={{ fontSize: "10px", color: "var(--text-muted)", flexShrink: 0, opacity: 0.7 }}>Indexing…</span>
          )}
          {globalSearch && (
            <button
              onClick={() => { setGlobalSearch(""); setShowSuggestions(false); setActiveSuggIdx(-1); globalSearchInputRef.current?.focus(); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "2px 4px", fontSize: "16px", lineHeight: 1, borderRadius: "3px" }}
            >×</button>
          )}
        </div>

        {/* Dropdown */}
        {showSuggestions && globalSuggestions.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              background: "var(--bg-secondary)",
              border: "1px solid #ffa116",
              borderTop: "none",
              borderRadius: "0 0 4px 4px",
              boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
              maxHeight: "460px",
              overflowY: "auto",
            }}
          >
            {/* Render groups: Sheets, Problems, Topics */}
            {(["sheet", "problem", "category"] as const).map(kind => {
              const items = globalSuggestions.filter(s => s.kind === kind);
              if (items.length === 0) return null;
              const groupLabel: Record<string, string> = {
                sheet: "SHEETS", problem: "PROBLEMS", category: "TOPICS",
              };
              // compute flat index offset for keyboard highlighting
              const kindOrder = ["sheet", "problem", "category"];
              const offset = kindOrder.slice(0, kindOrder.indexOf(kind)).reduce((acc, k) => acc + globalSuggestions.filter(s => s.kind === k).length, 0);
              return (
                <div key={kind}>
                  {/* Section label */}
                  <div style={{
                    padding: "5px 14px 4px",
                    fontSize: "10px",
                    fontWeight: 700,
                    letterSpacing: "1.5px",
                    color: "var(--text-muted)",
                    background: "var(--bg-primary)",
                    borderBottom: "1px solid var(--border-color)",
                    userSelect: "none",
                  }}>
                    {groupLabel[kind]}
                  </div>
                  {items.map((s, i) => {
                    const flatIdx = offset + i;
                    const isActive = flatIdx === activeSuggIdx;
                    return (
                      <div
                        key={i}
                        onMouseDown={() => handleGlobalSuggestionClick(s)}
                        onMouseEnter={() => setActiveSuggIdx(flatIdx)}
                        style={{
                          padding: "9px 14px 9px 12px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          borderLeft: isActive ? "3px solid #ffa116" : "3px solid transparent",
                          borderBottom: "1px solid var(--border-color)",
                          background: isActive ? "var(--bg-hover)" : "transparent",
                          transition: "background 0.08s, border-color 0.08s",
                        }}
                      >
                        {/* Left type indicator */}
                        <span style={{
                          fontSize: "9px",
                          fontWeight: 700,
                          letterSpacing: "0.5px",
                          color: kind === "sheet" ? "#60a5fa" : kind === "problem" ? "var(--text-muted)" : "#a78bfa",
                          textTransform: "uppercase",
                          width: "38px",
                          flexShrink: 0,
                          textAlign: "right",
                        }}>
                          {kind === "sheet" ? "sheet" : kind === "problem" ? (s as any).difficulty?.slice(0,1) || "P" : "topic"}
                        </span>

                        {/* Main content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {s.kind === "sheet" && (
                            <>
                              <div style={{ fontWeight: 600, fontSize: "var(--font-size-title)", color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {highlightMatch(s.name, globalSearch.trim())}
                              </div>
                              <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "1px" }}>{s.group} · {s.questions} questions</div>
                            </>
                          )}
                          {s.kind === "problem" && (
                            <>
                              <div style={{ fontWeight: 500, fontSize: "var(--font-size-title)", color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {highlightMatch(s.title, globalSearch.trim())}
                              </div>
                              <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "1px" }}>
                                {s.sheetName} · {PLATFORM_LABELS[s.platform] || s.platform}
                                {(s as any).appearances > 1 && <span style={{ marginLeft: "6px", color: "#ffa116" }}>· in {(s as any).appearances} sheets</span>}
                              </div>
                            </>
                          )}
                          {s.kind === "category" && (
                            <>
                              <div style={{ fontWeight: 500, fontSize: "var(--font-size-title)", color: "var(--text-primary)" }}>
                                {highlightMatch(s.label, globalSearch.trim())}
                              </div>
                              <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "1px" }}>Topic · {(s as any).count} problems</div>
                            </>
                          )}
                        </div>

                        {/* Right meta */}
                        {s.kind === "sheet" && (
                          <span style={{ fontSize: "10px", color: "var(--text-muted)", flexShrink: 0 }}>Open</span>
                        )}
                        {s.kind === "problem" && !blindMode && (
                          <span style={{ fontSize: "10px", fontWeight: 700, color: DIFFICULTY_COLORS[(s as any).difficulty] || "var(--text-muted)", flexShrink: 0 }}>
                            {(s as any).difficulty}
                          </span>
                        )}
                        {s.kind === "category" && selectedSheetId && (
                          <span style={{ fontSize: "10px", color: "var(--text-muted)", flexShrink: 0 }}>Filter</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {/* Footer hint */}
            <div style={{ padding: "6px 14px", fontSize: "10px", color: "var(--text-muted)", display: "flex", gap: "12px", borderTop: "1px solid var(--border-color)", background: "var(--bg-primary)" }}>
              <span>↑↓ navigate</span>
              <span>↵ select</span>
              <span>Esc clear</span>
              {isIndexing && <span style={{ marginLeft: "auto", color: "#ffa116" }}>Indexing sheets…</span>}
              {indexReady && <span style={{ marginLeft: "auto", opacity: 0.5 }}>{searchIndexRef.current.length.toLocaleString()} problems indexed</span>}
            </div>
          </div>
        )}

        {/* No results */}
        {showSuggestions && globalSearch.trim().length >= 2 && globalSuggestions.length === 0 && !isIndexing && (
          <div style={{
            position: "absolute", top: "100%", left: 0, right: 0,
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-strong)",
            borderTop: "none",
            borderRadius: "0 0 4px 4px",
            padding: "14px",
            color: "var(--text-muted)",
            fontSize: "var(--font-size-base)",
          }}>
            No results for &ldquo;{globalSearch}&rdquo;
          </div>
        )}
      </div>

      {!selectedSheetId ? (
        Object.keys(sheetsByGroup).length === 0 ? (
          <div
            style={{
              padding: "48px 24px",
              textAlign: "center",
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-strong)",
            }}
          >
            <h3
              style={{
                fontSize: "var(--font-size-value)",
                color: "var(--text-primary)",
                marginBottom: "8px",
                textTransform: "capitalize",
              }}
            >
              No Curated Sheets Available for{" "}
              {selectedGlobalPlatforms.join(", ")}
            </h3>
            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: "var(--font-size-title)",
                maxWidth: "450px",
                margin: "0 auto",
              }}
            >
              Currently, our curated roadmaps (Striver, NeetCode, CP-31, CSES)
              focus on LeetCode and Codeforces. Dedicated CodeChef practice
              sheets will be added in a future update!
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: "32px",
            }}
          >
            {Object.entries(sheetsByGroup).map(([group, sheets]) => (
              <div
                key={group}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                }}
              >
                <h3
                  style={{
                    fontSize: "var(--font-size-title)",
                    margin: "0",
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    textTransform: "uppercase",
                    letterSpacing: "1.5px",
                    borderBottom: "1px solid var(--border-strong)",
                    paddingBottom: "8px",
                  }}
                >
                  {group}
                </h3>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "1px",
                    background: "var(--border-strong)",
                  }}
                >
                  {sheets.map((s) => (
                    <button
                      key={s.id}
                      disabled={!s.available}
                      onClick={() => setSelectedSheetId(s.id)}
                      style={{
                        textAlign: "left",
                        padding: "16px 20px",
                        background: "var(--bg-primary)",
                        color: s.available
                          ? "var(--text-primary)"
                          : "var(--text-secondary)",
                        border: "none",
                        borderRadius: "0px",
                        cursor: s.available ? "pointer" : "not-allowed",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        transition: "background 0.1s ease",
                        opacity: s.available ? 1 : 0.5,
                        fontWeight: 500,
                      }}
                      onMouseOver={(e) => {
                        if (s.available) {
                          e.currentTarget.style.background = "var(--bg-hover)";
                          e.currentTarget.style.color = "#ffa116";
                        }
                      }}
                      onMouseOut={(e) => {
                        if (s.available) {
                          e.currentTarget.style.background =
                            "var(--bg-primary)";
                          e.currentTarget.style.color = "var(--text-primary)";
                        }
                      }}
                    >
                      <span
                        style={{
                          fontSize: "calc(1.25 * var(--font-size-base))",
                          letterSpacing: "0.5px",
                        }}
                      >
                        {s.name}
                      </span>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                        }}
                      >
                        {!s.available && (
                          <span
                            style={{
                              fontSize: "var(--font-size-sm)",
                              background: "var(--bg-secondary)",
                              color: "var(--text-secondary)",
                              padding: "4px 8px",
                              borderRadius: "0px",
                              fontWeight: 600,
                              textTransform: "uppercase",
                              letterSpacing: "0.5px",
                            }}
                          >
                            Soon
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: "var(--font-size-md)",
                            color: "var(--text-secondary)",
                            fontWeight: 600,
                            fontFamily: "monospace",
                          }}
                        >
                          {s.questions} Qs
                        </span>
                        <button
                          title={followedSheets.includes(s.id) ? "Unfollow sheet" : "Follow sheet (pin to top)"}
                          onClick={(e) => toggleFollowSheet(s.id, e)}
                          style={{
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            fontSize: "18px",
                            padding: "4px",
                            color: followedSheets.includes(s.id) ? "#ffa116" : "var(--text-secondary)",
                            opacity: followedSheets.includes(s.id) ? 1 : 0.25,
                            transition: "opacity 0.2s ease, color 0.2s ease",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center"
                          }}
                          onMouseOver={(e) => (e.currentTarget.style.opacity = "1")}
                          onMouseOut={(e) => (e.currentTarget.style.opacity = followedSheets.includes(s.id) ? "1" : "0.25")}
                        >
                          {followedSheets.includes(s.id) ? "★" : "☆"}
                        </button>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <>
          {/* Global Progress Bar */}
          {sheetData && sheetData.length > 0 && (
            <div
              className="dashboard-card"
              style={{
                marginBottom: "32px",
                padding: "24px",
                borderRadius: "0px",
                border: "1px solid var(--border-strong)",
                background: "var(--bg-secondary)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "16px",
                  fontSize: "var(--font-size-md)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  color: "var(--text-secondary)",
                }}
              >
                <span
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
                >
                  Sheet Progress
                  <span
                    title="Calculated automatically by verifying your cached accepted submissions against this sheet's problem list."
                    style={{
                      cursor: "help",
                      opacity: 0.7,
                      fontSize: "var(--font-size-base)",
                      textTransform: "none",
                    }}
                  >
                    ⓘ
                  </span>
                </span>
                <span
                  style={{
                    color: "var(--text-primary)",
                    fontFamily: "monospace",
                  }}
                >
                  {sheetProgress.solved} / {sheetProgress.total} (
                  {sheetProgress.percent}%)
                </span>
              </div>
              <div
                className="dashboard-progress-bar"
                style={{
                  width: "100%",
                  height: "8px",
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "0px",
                  overflow: "hidden",
                }}
              >
                <div
                  className="dashboard-progress-fill"
                  style={{
                    width: `${sheetProgress.percent}%`,
                    height: "100%",
                    background: "#ffa116",
                  }}
                ></div>
              </div>
            </div>
          )}

          {!dismissedNotice && (
            <div
              style={{
                marginBottom: "16px",
                padding: "12px 16px",
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-strong)",
                borderRadius: "0px",
                fontSize: "var(--font-size-base)",
                lineHeight: "1.4",
                color: "var(--text-secondary)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "4px",
                }}>
                <strong>ⓘ How Checkmarks Work</strong>
                <button
                  onClick={() => {
                    setDismissedNotice(true);
                    chrome.storage.local.set({
                      dismissed_sheetstracker_info: true,
                    });
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    fontWeight: "bold",
                    fontSize: "var(--font-size-base)",
                  }}
                >
                  ×
                </button>
              </div>
              <div style={{ marginBottom: "8px" }}>
                <strong> Automated (LeetCode, Codeforces, CodeChef, CSES):</strong> L'Amigo
                auto-detects solved problems by matching your cached accepted
                submissions. Click <strong>"Sync"</strong> in the popup after solving to refresh.
              </div>
              <div style={{ color: "var(--text-muted)" }}>
                <strong> Manual (GFG &amp; TUF):</strong> GeeksforGeeks and TakeUForward don't
                provide public submission APIs. For these platforms, click the checkmark icon
                next to any problem in this table to manually mark it as solved.
              </div>
            </div>
          )}

          {!hasHistoricalSubmissions && (
            <div
              style={{
                marginBottom: "16px",
                padding: "12px",
                backgroundColor: "rgba(255, 165, 0, 0.1)",
                color: "#ffa500",
                border: "1px solid #ffa500",
                borderRadius: "0px",
                fontSize: "var(--font-size-title)",
              }}
            >
              <strong>Note:</strong> We couldn't find your historical submission
              cache. To populate your checkmarks, please click the "Sync" button
              in the extension popup.
            </div>
          )}

          {/* Custom Filter Pills */}
          <div
            style={{
              display: "flex",
              gap: "8px",
              flexWrap: "wrap",
              alignItems: "center",
              marginBottom: "16px",
            }}
          >
            {[
              "All",
              "Solved",
              "Unsolved",
              " For Revision",
              "Attempted/Wrong Answer",
            ].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                style={{
                  padding: "6px 16px",
                  background:
                    statusFilter === status ? "#ffa116" : "var(--bg-secondary)",
                  color:
                    statusFilter === status ? "#000" : "var(--text-primary)",
                  border: `1px solid ${statusFilter === status ? "#ffa116" : "var(--border-strong)"}`,
                  borderRadius: "0px",
                  fontSize: "var(--font-size-md)",
                  fontWeight: statusFilter === status ? 700 : 500,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {status}
              </button>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              gap: "12px",
              marginBottom: "16px",
              flexWrap: "wrap",
            }}
          >
            <input
              type="text"
              placeholder="Search problems..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ ...filterStyle, minWidth: "200px", cursor: "text" }}
              disabled={isLoading}
            />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={filterStyle}
              disabled={isLoading}
            >
              <option value="All">All Topics</option>
              {uniqueCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {!blindMode && (
              <select
                value={difficultyFilter}
                onChange={(e) => setDifficultyFilter(e.target.value)}
                style={filterStyle}
                disabled={isLoading}
              >
                <option value="All">All Difficulties</option>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            )}
            {hasVideoSolutions && (
              <select
                value={videoFilter}
                onChange={(e) => setVideoFilter(e.target.value)}
                style={filterStyle}
                disabled={isLoading}
              >
                <option value="All">All Videos</option>
                <option value="Has Video">Has Video</option>
                <option value="No Video">No Video</option>
              </select>
            )}
            {hasMultiplePlatforms && (
              <select
                value={platformFilter}
                onChange={(e) => setPlatformFilter(e.target.value)}
                style={filterStyle}
                disabled={isLoading}
              >
                <option value="All">All Platforms</option>
                {availablePlatforms.map((platform) => {
                  let label = platform;
                  if (platform === "leetcode") label = "LeetCode";
                  else if (platform === "gfg") label = "GeeksforGeeks";
                  else if (platform === "codeforces") label = "Codeforces";
                  else if (platform === "cses") label = "CSES";
                  else if (platform === "codechef") label = "CodeChef";
                  else if (platform === "tuf" || platform === "other")
                    label = "TakeUForward";
                  return (
                    <option key={platform} value={platform}>
                      {label}
                    </option>
                  );
                })}
              </select>
            )}
          </div>
          <div className="card" style={{ padding: "0", overflowX: "auto" }}>
            {isLoading ? (
              <div
                style={{
                  padding: "40px",
                  textAlign: "center",
                  color: "var(--text-secondary)",
                }}
              >
                Loading sheet...
              </div>
            ) : (
              <table className="sheets-table">
                <thead>
                  <tr>
                    <th style={{ width: "40%" }}>Problem</th>
                    {!blindMode && <th style={{ width: "10%" }}>Difficulty</th>}
                    <th style={{ width: "20%", fontSize: "var(--font-size-xs)", color: "var(--text-muted)", fontWeight: 600 }}>Also In</th>
                    {trackerFriends.map((f) => (
                      <th
                        key={f.id || f.username}
                        style={{ textAlign: "center" }}
                      >
                        {f.displayName || f.username}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(!sheetData || Object.keys(groupedData).length === 0) && (
                    <tr>
                      <td
                        colSpan={10}
                        style={{ textAlign: "center", padding: "24px" }}
                      >
                        No problems match filters or sheet is empty.
                      </td>
                    </tr>
                  )}
                  {Object.entries(groupedData).map(([category, problems]) => (
                    <React.Fragment key={category}>
                      <tr
                        className="category-header-row"
                        onClick={() => toggleCategory(category)}
                        style={{ cursor: "pointer" }}
                      >
                        <td
                          colSpan={10}
                          style={{
                            background: "var(--bg-secondary)",
                            padding: "16px 16px",
                            borderBottom: "1px solid var(--border-strong)",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "10px",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                }}
                              >
                                <svg
                                  viewBox="0 0 24 24"
                                  width="18"
                                  height="18"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  fill="none"
                                  style={{
                                    transform: expandedCategories.has(category)
                                      ? "rotate(0deg)"
                                      : "rotate(-90deg)",
                                    transition: "transform 0.2s",
                                  }}
                                >
                                  <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                  }}
                                >
                                  <span
                                    style={{
                                      fontWeight: "bold",
                                      fontSize:
                                        "calc(1.333 * var(--font-size-base))",
                                      color: "var(--text-primary)",
                                    }}
                                  >
                                    {category}
                                  </span>
                                </div>
                              </div>
                              {(() => {
                                const solvedCat = problems.filter((p) =>
                                  ownSolvedSet.has(p.titleSlug),
                                ).length;
                                const totalCat = problems.length;
                                const catPct =
                                  totalCat > 0
                                    ? Math.round((solvedCat / totalCat) * 100)
                                    : 0;
                                return (
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "12px",
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontSize: "var(--font-size-md)",
                                        fontWeight: 600,
                                        color: "var(--text-secondary)",
                                      }}
                                    >
                                      {solvedCat} / {totalCat} Solved
                                    </span>
                                    <span
                                      style={{
                                        fontSize: "var(--font-size-md)",
                                        fontWeight: 700,
                                        color:
                                          catPct === 100
                                            ? "var(--color-easy)"
                                            : "#ffa116",
                                        background: "var(--bg-primary)",
                                        padding: "2px 8px",
                                        borderRadius: "0px",
                                        border: "1px solid var(--border-color)",
                                      }}
                                    >
                                      {catPct}%
                                    </span>
                                  </div>
                                );
                              })()}
                            </div>
                            {(() => {
                              const solvedCat = problems.filter((p) =>
                                ownSolvedSet.has(p.titleSlug),
                              ).length;
                              const totalCat = problems.length;
                              const catPct =
                                totalCat > 0
                                  ? Math.round((solvedCat / totalCat) * 100)
                                  : 0;
                              return (
                                <div
                                  style={{
                                    width: "100%",
                                    height: "6px",
                                    background: "var(--bg-primary)",
                                    borderRadius: "0px",
                                    overflow: "hidden",
                                    border: "1px solid var(--border-color)",
                                  }}
                                >
                                  <div
                                    style={{
                                      width: `${catPct}%`,
                                      height: "100%",
                                      background:
                                        catPct === 100
                                          ? "var(--color-easy)"
                                          : "#ffa116",
                                      transition: "width 0.3s ease",
                                    }}
                                  ></div>
                                </div>
                              );
                            })()}
                          </div>
                        </td>
                      </tr>
                      {expandedCategories.has(category) &&
                        problems.map((prob) => {
                          const isCf = prob.platform === "codeforces";
                          const isCses = prob.platform === "cses";
                          const isGfg = prob.platform === "gfg";
                          const isCc = prob.platform === "codechef";
                          const isTuf =
                            prob.platform === "tuf" ||
                            prob.platform === "other";

                          const match = isCf
                            ? prob.titleSlug.match(/^(\d+)([A-Z]\d*)$/i)
                            : null;

                          let link = prob.url;
                          if (!link) {
                            link = `https://leetcode.com/problems/${prob.titleSlug}/`;
                            if (isCses)
                              link = `https://cses.fi/problemset/task/${prob.titleSlug}`;
                            else if (isCf && match)
                              link = `https://codeforces.com/contest/${match[1]}/problem/${match[2]}`;
                            else if (isCf)
                              link = `https://codeforces.com/problemset/problem/${prob.titleSlug}`;
                            else if (isGfg)
                              link = `https://www.geeksforgeeks.org/problems/${prob.titleSlug}/1`;
                            else if (isCc)
                              link = `https://www.codechef.com/problems/${prob.titleSlug}`;
                          }

                          let solLink = `https://leetcode.com/problems/${prob.titleSlug}/solutions/`;
                          if (isCses)
                            solLink = `https://cses.fi/problemset/stats/${prob.titleSlug}/`;
                          else if (isCf && match)
                            solLink = `https://codeforces.com/contest/${match[1]}/status/${match[2]}`;
                          else if (isCf)
                            solLink = `https://codeforces.com/problemset/status/${prob.titleSlug}`;
                          else if (isGfg)
                            solLink = `https://www.geeksforgeeks.org/problems/${prob.titleSlug}/1?tab=editorial`;
                          else if (isCc)
                            solLink = `https://www.codechef.com/problems/${prob.titleSlug}/solutions`;
                          else if (isTuf && prob.url) solLink = prob.url;

                          return (
                            <tr key={prob.titleSlug}>
                              <td>
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                  }}
                                >
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      toggleRevisionStar(prob.titleSlug);
                                    }}
                                    title={
                                      revisionStars.has(prob.titleSlug)
                                        ? "Marked for Revision (Click to unmark)"
                                        : "Click to mark for revision"
                                    }
                                    style={{
                                      background: "none",
                                      border: "none",
                                      padding: "4px",
                                      cursor: "pointer",
                                      color: revisionStars.has(prob.titleSlug)
                                        ? "#ffa116"
                                        : "var(--text-muted)",
                                      fontSize:
                                        "calc(1.333 * var(--font-size-base))",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      transition: "transform 0.15s ease",
                                    }}
                                    onMouseOver={(e) => {
                                      e.currentTarget.style.transform =
                                        "scale(1.2)";
                                    }}
                                    onMouseOut={(e) => {
                                      e.currentTarget.style.transform =
                                        "scale(1)";
                                    }}
                                  >
                                    {revisionStars.has(prob.titleSlug)
                                      ? ""
                                      : ""}
                                  </button>
                                  <a
                                    href={link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="problem-title"
                                    style={{
                                      textDecoration: "none",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "6px",
                                    }}
                                  >
                                    {isGfg && (
                                      <span
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          padding: "0 4px",
                                          height: "20px",
                                          background: "rgba(47, 141, 70, 0.2)",
                                          border: "1px solid #2f8d46",
                                          color: "#2f8d46",
                                          borderRadius: "0px",
                                          fontSize: "var(--font-size-xs)",
                                          fontWeight: 700,
                                          fontFamily: "monospace",
                                          letterSpacing: "0.5px",
                                        }}
                                        title="GeeksforGeeks"
                                      >
                                        GFG
                                      </span>
                                    )}
                                    {isTuf && (
                                      <span
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          padding: "0 4px",
                                          height: "20px",
                                          background: "rgba(217, 70, 70, 0.2)",
                                          border: "1px solid #d94646",
                                          color: "#d94646",
                                          borderRadius: "0px",
                                          fontSize: "var(--font-size-xs)",
                                          fontWeight: 700,
                                          fontFamily: "monospace",
                                          letterSpacing: "0.5px",
                                        }}
                                        title="TakeUForward"
                                      >
                                        TUF
                                      </span>
                                    )}
                                    {isCc && (
                                      <span
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          width: "20px",
                                          height: "20px",
                                          background: "rgba(139, 87, 42, 0.15)",
                                          borderRadius: "0px",
                                        }}
                                        title="CodeChef"
                                      >
                                        <CodeChefIcon size={14} />
                                      </span>
                                    )}
                                    {!isGfg &&
                                      !isCf &&
                                      !isCses &&
                                      !isCc &&
                                      !isTuf && (
                                        <span
                                          style={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            width: "20px",
                                            height: "20px",
                                            background:
                                              "rgba(255, 161, 22, 0.15)",
                                            borderRadius: "0px",
                                          }}
                                          title="LeetCode"
                                        >
                                          <LeetCodeIcon size={14} />
                                        </span>
                                      )}
                                    {isCf && (
                                      <span
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          width: "20px",
                                          height: "20px",
                                          background:
                                            "rgba(59, 130, 246, 0.15)",
                                          borderRadius: "0px",
                                        }}
                                        title="Codeforces"
                                      >
                                        <CodeforcesIcon size={14} />
                                      </span>
                                    )}
                                    {isCses && (
                                      <span
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          padding: "0 4px",
                                          height: "20px",
                                          background:
                                            "rgba(156, 163, 175, 0.2)",
                                          border: "1px solid #9ca3af",
                                          color: "#9ca3af",
                                          borderRadius: "0px",
                                          fontSize: "var(--font-size-xs)",
                                          fontWeight: 700,
                                          fontFamily: "monospace",
                                          letterSpacing: "0.5px",
                                        }}
                                        title="CSES"
                                      >
                                        CSES
                                      </span>
                                    )}
                                    {prob.title}
                                  </a>
                                  {prob.youtubeLink && (
                                    <a
                                      href={prob.youtubeLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title="Video Solution"
                                      className="yt-link-icon"
                                    >
                                      <svg
                                        viewBox="0 0 24 24"
                                        width="18"
                                        height="18"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        fill="none"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      >
                                        <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"></path>
                                        <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon>
                                      </svg>
                                    </a>
                                  )}
                                  {!isCf && (
                                    <a
                                      href={solLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title="Solutions / Editorials"
                                      style={{
                                        padding: "2px 6px",
                                        background: "var(--bg-primary)",
                                        border:
                                          "1px solid var(--border-strong)",
                                        color: "var(--text-secondary)",
                                        fontSize: "var(--font-size-sm)",
                                        fontWeight: 700,
                                        textDecoration: "none",
                                        borderRadius: "0px",
                                      }}
                                      onMouseOver={(e) => {
                                        e.currentTarget.style.background =
                                          "#ffa116";
                                        e.currentTarget.style.color = "#000";
                                      }}
                                      onMouseOut={(e) => {
                                        e.currentTarget.style.background =
                                          "var(--bg-primary)";
                                        e.currentTarget.style.color =
                                          "var(--text-secondary)";
                                      }}
                                    >
                                      SOL
                                    </a>
                                  )}
                                  {/* Friend Avatars Cluster */}
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "4px",
                                      marginLeft: "12px",
                                    }}
                                  >
                                    {allFriendsSolvedSets
                                      .filter((fs) =>
                                        fs.solvedSet.has(prob.titleSlug),
                                      )
                                      .map(({ friend }) => {
                                        const name =
                                          friend.displayName ||
                                          friend.username ||
                                          "F";
                                        const initial = name
                                          .charAt(0)
                                          .toUpperCase();
                                        let profileHref = `https://leetcode.com/${friend.username}`;
                                        if (isCf) {
                                          const acc = friend.accounts?.find(
                                            (a) => a.platform === "codeforces",
                                          );
                                          profileHref = `https://codeforces.com/profile/${acc ? acc.handle : friend.username}`;
                                        } else if (isCc) {
                                          const acc = friend.accounts?.find(
                                            (a) => a.platform === "codechef",
                                          );
                                          profileHref = `https://www.codechef.com/users/${acc ? acc.handle : friend.username}`;
                                        } else {
                                          const acc = friend.accounts?.find(
                                            (a) => a.platform === "leetcode",
                                          );
                                          if (acc)
                                            profileHref = `https://leetcode.com/${acc.handle}`;
                                        }
                                        return (
                                          <a
                                            key={friend.id || friend.username}
                                            href={profileHref}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            title={`${name} has solved this problem! (Click to view profile)`}
                                            style={{
                                              display: "inline-flex",
                                              alignItems: "center",
                                              justifyContent: "center",
                                              width: "20px",
                                              height: "20px",
                                              borderRadius: "0px",
                                              background: "var(--color-easy)",
                                              color: "#000",
                                              fontSize: "var(--font-size-xs)",
                                              fontWeight: "bold",
                                              border: "1px solid #000",
                                              cursor: "pointer",
                                              textDecoration: "none",
                                              boxShadow: "none",
                                            }}
                                          >
                                            {initial}
                                          </a>
                                        );
                                      })}
                                  </div>
                                </div>
                              </td>
                              <td>
                                {!blindMode && (
                                  <span
                                    className={`diff-badge diff-${prob.difficulty?.toLowerCase()}`}
                                  >
                                    {prob.difficulty}
                                  </span>
                                )}
                              </td>
                              {/* Also In column */}
                              <td style={{ verticalAlign: "middle", padding: "6px 10px" }}>
                                {(() => {
                                  const alsoIn = crossSheetIndex[prob.titleSlug] || [];
                                  if (alsoIn.length === 0) return <span style={{ color: "var(--text-muted)", fontSize: "10px", opacity: 0.5 }}>—</span>;
                                  return (
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                                      {alsoIn.slice(0, 4).map((sid) => (
                                        <button
                                          key={sid}
                                          onClick={() => setSelectedSheetId(sid)}
                                          title={`Open ${getSheetName(sid)}`}
                                          style={{
                                            padding: "2px 7px",
                                            fontSize: "10px",
                                            background: "var(--bg-primary)",
                                            border: "1px solid var(--border-strong)",
                                            color: "var(--text-secondary)",
                                            borderRadius: "3px",
                                            cursor: "pointer",
                                            whiteSpace: "nowrap",
                                            maxWidth: "110px",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            transition: "all 0.1s",
                                          }}
                                          onMouseEnter={e => { e.currentTarget.style.background = "#ffa116"; e.currentTarget.style.color = "#000"; e.currentTarget.style.borderColor = "#ffa116"; }}
                                          onMouseLeave={e => { e.currentTarget.style.background = "var(--bg-primary)"; e.currentTarget.style.color = "var(--text-secondary)"; e.currentTarget.style.borderColor = "var(--border-strong)"; }}
                                        >
                                          {getSheetName(sid)}
                                        </button>
                                      ))}
                                      {alsoIn.length > 4 && (
                                        <span style={{ fontSize: "10px", color: "var(--text-muted)", alignSelf: "center" }}>+{alsoIn.length - 4} more</span>
                                      )}
                                    </div>
                                  );
                                })()}
                              </td>
                              {trackerFriends.map((friend) => {
                                const isSolved = ownSolvedSet.has(
                                  prob.titleSlug,
                                );
                                const isManualAllowed = isGfg || isTuf;
                                return (
                                  <td
                                    key={friend.id || friend.username}
                                    className="status-cell"
                                  >
                                    <div
                                      className={`status-icon ${isSolved ? "solved" : ""}`}
                                      title={
                                        isManualAllowed
                                          ? isSolved
                                            ? "Solved (Click to unmark)"
                                            : "Not Solved (Click to mark as solved)"
                                          : isSolved
                                            ? "Solved"
                                            : "Not Solved"
                                      }
                                      style={{
                                        cursor: isManualAllowed ? "pointer" : "default",
                                        transition: "transform 0.15s ease",
                                      }}
                                      onClick={() => {
                                        if (isManualAllowed) {
                                          toggleManualSolve(
                                            prob.titleSlug,
                                            prob.title,
                                            prob.platform || "other",
                                          );
                                        }
                                      }}
                                      onMouseOver={(e) => {
                                        if (isManualAllowed)
                                          e.currentTarget.style.transform = "scale(1.2)";
                                      }}
                                      onMouseOut={(e) => {
                                        if (isManualAllowed)
                                          e.currentTarget.style.transform = "scale(1)";
                                      }}
                                    >
                                      {isSolved ? (
                                        <svg
                                          viewBox="0 0 24 24"
                                          width="14"
                                          height="14"
                                          stroke="currentColor"
                                          strokeWidth="3"
                                          fill="none"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        >
                                          <polyline points="20 6 9 17 4 12"></polyline>
                                        </svg>
                                      ) : (
                                        <svg
                                          viewBox="0 0 24 24"
                                          width="14"
                                          height="14"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                          fill="none"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          style={{ opacity: 0.5 }}
                                        >
                                          <line
                                            x1="5"
                                            y1="12"
                                            x2="19"
                                            y2="12"
                                          ></line>
                                        </svg>
                                      )}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const filterStyle = {
  padding: "6px 12px",
  background: "var(--bg-secondary)",
  color: "var(--text-primary)",
  border: "1px solid var(--border-color)",
  borderRadius: "0px",
  outline: "none",
  fontSize: "var(--font-size-md)",
};

export default SheetsTracker;
