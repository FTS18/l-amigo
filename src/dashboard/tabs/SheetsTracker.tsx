import React, { useState, useMemo, useEffect } from 'react';
import { FriendProfile, Friend } from '../../types';
import { SHEET_METADATA } from '../data/sheetsMetadata';
import { LeetCodeIcon, CodeforcesIcon, CodeChefIcon } from '../../utils/PlatformIcons';

export interface SheetProblem {
  title: string;
  titleSlug: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  category: string;
  platform?: 'leetcode' | 'codeforces' | 'cses' | 'gfg' | 'codingninjas' | 'naukri' | 'interviewbit' | 'codechef' | 'spoj' | 'other' | 'tuf';
  youtubeLink?: string;
  url?: string;
}

interface Props {
  friends: Friend[];
  profiles: Record<string, FriendProfile>;
  allSubmissions: any[];
  selectedGlobalPlatforms?: string[];
}

// Memory cache so we don't re-fetch unnecessarily
const sheetCache: Record<string, SheetProblem[]> = {};

export const SheetsTracker: React.FC<Props> = ({ friends, profiles, allSubmissions, selectedGlobalPlatforms = ['leetcode', 'codeforces', 'codechef'] }) => {
  const [selectedSheetId, setSelectedSheetId] = useState<string>('');
  const [sheetData, setSheetData] = useState<SheetProblem[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [platformFilter, setPlatformFilter] = useState<string>('All');
  const [videoFilter, setVideoFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [revisionStars, setRevisionStars] = useState<Set<string>>(new Set());
  const [dismissedNotice, setDismissedNotice] = useState(false);

  useEffect(() => {
    chrome.storage.local.get(['revision_stars', 'dismissed_sheetstracker_info'], (res) => {
      if (res.revision_stars) {
        setRevisionStars(new Set(res.revision_stars));
      }
      if (res.dismissed_sheetstracker_info) {
        setDismissedNotice(true);
      }
    });
  }, []);

  const toggleRevisionStar = (titleSlug: string) => {
    setRevisionStars(prev => {
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

        const meta = (SHEET_METADATA as any).find((s: any) => s.id === selectedSheetId);
        
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
        console.error('Failed to fetch sheet data:', err);
        if (active) setIsLoading(false);
      }
    };
    fetchSheet();
    return () => { active = false; };
  }, [selectedSheetId]);

  const { hasMultiplePlatforms, availablePlatforms, hasVideoSolutions, uniqueCategories } = useMemo(() => {
    if (!sheetData) return { hasMultiplePlatforms: false, availablePlatforms: [], hasVideoSolutions: false, uniqueCategories: [] };
    const platforms = new Set<string>();
    let hasVid = false;
    const cats = new Set<string>();
    
    sheetData.forEach(p => {
      platforms.add(p.platform || 'leetcode');
      if (p.youtubeLink) hasVid = true;
      if (p.category) cats.add(p.category);
    });
    
    return {
      hasMultiplePlatforms: platforms.size > 1,
      availablePlatforms: Array.from(platforms).sort(),
      hasVideoSolutions: hasVid,
      uniqueCategories: Array.from(cats).sort()
    };
  }, [sheetData]);

  // Reset filters and collapsed state when changing sheets
  useEffect(() => {
    setCategoryFilter('All');
    setDifficultyFilter('All');
    setStatusFilter('All');
    setPlatformFilter('All');
    setVideoFilter('All');
    setSearchQuery('');
    setExpandedCategories(new Set());
  }, [selectedSheetId]);

  const trackerFriends = friends.filter(f => f.id === 'own-user');
  const allOtherFriends = friends.filter(f => f.id !== 'own-user');

  const getProfile = (f: Friend, platform: string): FriendProfile | undefined => {
    if (f.id === 'own-user') {
      return Object.values(profiles).find(p => p.username === f.username && p.platform === platform);
    }
    const acc = f.accounts?.find(a => a.platform === platform);
    if (!acc) return undefined;
    return profiles[`${platform}:${acc.handle.toLowerCase()}`] || profiles[acc.handle.toLowerCase()];
  };

  const { ownSolvedSet, ownAttemptedSet, allFriendsSolvedSets } = useMemo(() => {
    const solved = new Set<string>();
    const attempted = new Set<string>();
    const ownFriend = friends.find(f => f.id === 'own-user');
    if (ownFriend) {
      const lcProfile = getProfile(ownFriend, 'leetcode');
      lcProfile?.recentSubmissions?.forEach(sub => {
        if (sub.statusDisplay === 'Accepted') solved.add(sub.titleSlug);
        else attempted.add(sub.titleSlug);
      });
      const cfProfile = getProfile(ownFriend, 'codeforces');
      cfProfile?.recentSubmissions?.forEach(sub => {
        if (sub.statusDisplay === 'Accepted' && sub.titleSlug) solved.add(sub.titleSlug.replace('/', ''));
        else if (sub.titleSlug) attempted.add(sub.titleSlug.replace('/', ''));
      });
    }
    allSubmissions?.forEach(sub => {
      const slug = sub.platform === 'codeforces' && sub.titleSlug ? sub.titleSlug.replace('/', '') : sub.titleSlug;
      if (!slug) return;
      if (sub.statusDisplay === 'Accepted') {
        solved.add(slug);
      } else {
        attempted.add(slug);
      }
    });

    const otherFriendsSets = allOtherFriends.map(f => {
      const fSolved = new Set<string>();
      const lcProfile = getProfile(f, 'leetcode');
      lcProfile?.recentSubmissions?.forEach(sub => {
        if (sub.statusDisplay === 'Accepted') fSolved.add(sub.titleSlug);
      });
      const cfProfile = getProfile(f, 'codeforces');
      cfProfile?.recentSubmissions?.forEach(sub => {
        if (sub.statusDisplay === 'Accepted' && sub.titleSlug) {
          fSolved.add(sub.titleSlug.replace('/', ''));
        }
      });
      return { friend: f, solvedSet: fSolved };
    });

    return { ownSolvedSet: solved, ownAttemptedSet: attempted, allFriendsSolvedSets: otherFriendsSets };
  }, [friends, profiles, allSubmissions, allOtherFriends]);

  const hasHistoricalSubmissions = allSubmissions && allSubmissions.length > 0;

  const groupedData = useMemo(() => {
    if (!sheetData) return {};
    
    // First, filter the data
    const filtered = sheetData.filter(p => {
      // 1. Topic
      if (categoryFilter !== 'All' && p.category !== categoryFilter) return false;
      // 2. Difficulty
      if (difficultyFilter !== 'All' && p.difficulty !== difficultyFilter) return false;
      // 3. Status (Pills filter)
      if (statusFilter !== 'All') {
        const isSolved = ownSolvedSet.has(p.titleSlug);
        const isStar = revisionStars.has(p.titleSlug);
        const isAttempted = ownAttemptedSet.has(p.titleSlug) && !isSolved;
        if (statusFilter === 'Solved' && !isSolved) return false;
        if (statusFilter === 'Unsolved' && isSolved) return false;
        if (statusFilter === '★ For Revision' && !isStar) return false;
        if (statusFilter === 'Attempted/Wrong Answer' && !isAttempted) return false;
      }
      // 4. Platform
      const probPlatform = p.platform || 'leetcode';
      if (platformFilter !== 'All') {
        if (probPlatform !== platformFilter) return false;
      }
      // 5. Video
      if (videoFilter === 'Has Video' && !p.youtubeLink) return false;
      if (videoFilter === 'No Video' && p.youtubeLink) return false;
      // 6. Search text
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        if (!p.title.toLowerCase().includes(query)) return false;
      }
      return true;
    });

    // Then group by category
    const map: Record<string, SheetProblem[]> = {};
    filtered.forEach(p => {
      if (!map[p.category]) map[p.category] = [];
      map[p.category].push(p);
    });
    return map;
  }, [sheetData, categoryFilter, difficultyFilter, statusFilter, platformFilter, videoFilter, searchQuery, ownSolvedSet, ownAttemptedSet, revisionStars, selectedGlobalPlatforms]);

  // Group metadata for the select dropdown
  const sheetsByGroup = useMemo(() => {
    const groups: Record<string, typeof SHEET_METADATA> = {};
    SHEET_METADATA.forEach(s => {
      if ((s as any).hidden) return;
      const isCfSheet = s.id.startsWith('cp31') || s.id === 'cses' || s.id === 'codeprime75' || s.id === 'striverCpSheet';
      const sheetPlatform = isCfSheet ? 'codeforces' : 'leetcode';
      if (!selectedGlobalPlatforms.includes(sheetPlatform)) return;
      if (!groups[s.group]) groups[s.group] = [];
      groups[s.group].push(s);
    });
    return groups;
  }, [selectedGlobalPlatforms]);

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };
  
  const sheetProgress = useMemo(() => {
    if (!sheetData) return { total: 0, solved: 0, percent: 0 };
    let solvedCount = 0;
    sheetData.forEach(p => {
      if (ownSolvedSet.has(p.titleSlug)) solvedCount++;
    });
    const percent = sheetData.length > 0 ? Math.round((solvedCount / sheetData.length) * 100) : 0;
    return { total: sheetData.length, solved: solvedCount, percent };
  }, [sheetData, ownSolvedSet]);

  const filterStyle: React.CSSProperties = {
    padding: '8px 12px',
    border: '1px solid var(--border-strong)',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    borderRadius: '0px',
    cursor: 'pointer'
  };

  return (
    <div>
      <div className="tab-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            Sheets Tracker
            <span title="Track your problem-solving roadmap. Problems are automatically marked green when a matching accepted submission is found in your synced platform history." style={{ fontSize: 'var(--font-size-title)', cursor: 'help', opacity: 0.7, fontWeight: 'normal' }}>ⓘ</span>
          </h2>
          <p>Track your completion across popular lists.</p>
        </div>
        {selectedSheetId && (
          <div>
            <button 
              onClick={() => setSelectedSheetId('')}
              style={{ 
                padding: '10px 20px', 
                background: 'var(--bg-secondary)', 
                color: 'var(--text-primary)', 
                border: '1px solid var(--border-strong)', 
                borderRadius: '0px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: 600,
                textTransform: 'uppercase',
                transition: 'all 0.1s ease-out',
                boxShadow: 'none'
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.borderColor = 'var(--text-primary)'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = 'var(--bg-secondary)'; e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
              <span style={{ fontSize: 'var(--font-size-title)', letterSpacing: '0.5px' }}>Back</span>
            </button>
          </div>
        )}
      </div>

      {!selectedSheetId ? (
        Object.keys(sheetsByGroup).length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', background: 'var(--bg-secondary)', border: '1px solid var(--border-strong)' }}>
            <h3 style={{ fontSize: 'var(--font-size-value)', color: 'var(--text-primary)', marginBottom: '8px', textTransform: 'capitalize' }}>No Curated Sheets Available for {selectedGlobalPlatforms.join(', ')}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-title)', maxWidth: '450px', margin: '0 auto' }}>
              Currently, our curated roadmaps (Striver, NeetCode, CP-31, CSES) focus on LeetCode and Codeforces. Dedicated CodeChef practice sheets will be added in a future update!
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '32px' }}>
            {Object.entries(sheetsByGroup).map(([group, sheets]) => (
              <div key={group} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ fontSize: 'var(--font-size-title)', margin: '0', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1.5px', borderBottom: '1px solid var(--border-strong)', paddingBottom: '8px' }}>
                  {group}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--border-strong)' }}>
                  {sheets.map(s => (
                    <button
                      key={s.id}
                      disabled={!s.available}
                      onClick={() => setSelectedSheetId(s.id)}
                      style={{
                        textAlign: 'left',
                        padding: '16px 20px',
                        background: 'var(--bg-primary)',
                        color: s.available ? 'var(--text-primary)' : 'var(--text-secondary)',
                        border: 'none',
                        borderRadius: '0px',
                        cursor: s.available ? 'pointer' : 'not-allowed',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'background 0.1s ease',
                        opacity: s.available ? 1 : 0.5,
                        fontWeight: 500
                      }}
                      onMouseOver={(e) => {
                        if (s.available) {
                          e.currentTarget.style.background = 'var(--bg-hover)';
                          e.currentTarget.style.color = '#ffa116';
                        }
                      }}
                      onMouseOut={(e) => {
                        if (s.available) {
                          e.currentTarget.style.background = 'var(--bg-primary)';
                          e.currentTarget.style.color = 'var(--text-primary)';
                        }
                      }}
                    >
                      <span style={{ fontSize: 'calc(1.25 * var(--font-size-base))', letterSpacing: '0.5px' }}>{s.name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {!s.available && <span style={{ fontSize: 'var(--font-size-sm)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', padding: '4px 8px', borderRadius: '0px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Soon</span>}
                        <span style={{ fontSize: 'var(--font-size-md)', color: 'var(--text-secondary)', fontWeight: 600, fontFamily: 'monospace' }}>{s.questions} Qs</span>
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
        <div style={{ marginBottom: '32px', padding: '24px', borderRadius: '0px', border: '1px solid var(--border-strong)', background: 'var(--bg-secondary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: 'var(--font-size-md)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              Sheet Progress
              <span title="Calculated automatically by verifying your cached accepted submissions against this sheet's problem list." style={{ cursor: 'help', opacity: 0.7, fontSize: 'var(--font-size-base)', textTransform: 'none' }}>ⓘ</span>
            </span>
            <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>
              {sheetProgress.solved} / {sheetProgress.total} ({sheetProgress.percent}%)
            </span>
          </div>
          <div style={{ width: '100%', height: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '0px', overflow: 'hidden' }}>
            <div style={{ width: `${sheetProgress.percent}%`, height: '100%', background: '#ffa116', transition: 'width 0.3s ease' }}></div>
          </div>
        </div>
      )}

      {!dismissedNotice && (
        <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'var(--bg-secondary)', border: '1px solid var(--border-strong)', borderRadius: '0px', fontSize: 'var(--font-size-base)', lineHeight: '1.4', color: 'var(--text-secondary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <strong>ⓘ How Automated Checkmarks Work</strong>
            <button onClick={() => { setDismissedNotice(true); chrome.storage.local.set({ dismissed_sheetstracker_info: true }); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 'bold', fontSize: 'var(--font-size-base)' }}>×</button>
          </div>
          L'Amigo verifies your problem completion by matching cached accepted submissions against problem slugs. If you recently solved a problem on an external platform (like LeetCode or Codeforces), open the extension popup and click <strong>"Sync"</strong> to refresh your local accepted cache.
        </div>
      )}

      {!hasHistoricalSubmissions && (
        <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: 'rgba(255, 165, 0, 0.1)', color: '#ffa500', border: '1px solid #ffa500', borderRadius: '0px', fontSize: 'var(--font-size-title)' }}>
          <strong>Note:</strong> We couldn't find your historical submission cache. To populate your checkmarks, please click the "Sync" button in the extension popup.
        </div>
      )}

      {/* Custom Filter Pills */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' }}>
        {['All', 'Solved', 'Unsolved', '★ For Revision', 'Attempted/Wrong Answer'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            style={{
              padding: '6px 16px',
              background: statusFilter === status ? '#ffa116' : 'var(--bg-secondary)',
              color: statusFilter === status ? '#000' : 'var(--text-primary)',
              border: `1px solid ${statusFilter === status ? '#ffa116' : 'var(--border-strong)'}`,
              borderRadius: '0px',
              fontSize: 'var(--font-size-md)',
              fontWeight: statusFilter === status ? 700 : 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            {status}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input 
          type="text" 
          placeholder="Search problems..." 
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ ...filterStyle, minWidth: '200px', cursor: 'text' }}
          disabled={isLoading}
        />
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={filterStyle} disabled={isLoading}>
          <option value="All">All Topics</option>
          {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={difficultyFilter} onChange={e => setDifficultyFilter(e.target.value)} style={filterStyle} disabled={isLoading}>
          <option value="All">All Difficulties</option>
          <option value="Easy">Easy</option>
          <option value="Medium">Medium</option>
          <option value="Hard">Hard</option>
        </select>
        {hasVideoSolutions && (
          <select value={videoFilter} onChange={e => setVideoFilter(e.target.value)} style={filterStyle} disabled={isLoading}>
            <option value="All">All Videos</option>
            <option value="Has Video">Has Video</option>
            <option value="No Video">No Video</option>
          </select>
        )}
        {hasMultiplePlatforms && (
          <select value={platformFilter} onChange={e => setPlatformFilter(e.target.value)} style={filterStyle} disabled={isLoading}>
            <option value="All">All Platforms</option>
            {availablePlatforms.map(platform => {
              let label = platform;
              if (platform === 'leetcode') label = 'LeetCode';
              else if (platform === 'gfg') label = 'GeeksforGeeks';
              else if (platform === 'codeforces') label = 'Codeforces';
              else if (platform === 'cses') label = 'CSES';
              else if (platform === 'codingninjas' || platform === 'naukri') label = 'Coding Ninjas';
              else if (platform === 'interviewbit') label = 'InterviewBit';
              else if (platform === 'codechef') label = 'CodeChef';
              else if (platform === 'spoj') label = 'SPOJ';
              else if (platform === 'tuf' || platform === 'other') label = 'TakeUForward';
              return <option key={platform} value={platform}>{label}</option>;
            })}
          </select>
        )}
      </div>
      <div className="card" style={{ padding: '0', overflowX: 'auto' }}>
        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Loading sheet...
          </div>
        ) : (
          <table className="sheets-table">
            <thead>
              <tr>
                <th style={{ width: '40%' }}>Problem</th>
                <th style={{ width: '10%' }}>Difficulty</th>
                {trackerFriends.map(f => (
                  <th key={f.id || f.username} style={{ textAlign: 'center' }}>
                    {f.displayName || f.username}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(!sheetData || Object.keys(groupedData).length === 0) && (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: '24px' }}>No problems match filters or sheet is empty.</td></tr>
              )}
              {Object.entries(groupedData).map(([category, problems]) => (
                <React.Fragment key={category}>
                  <tr 
                    className="category-header-row" 
                    onClick={() => toggleCategory(category)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td colSpan={10} style={{ background: 'var(--bg-secondary)', padding: '16px 16px', borderBottom: '1px solid var(--border-strong)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" style={{ transform: expandedCategories.has(category) ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }}>
                              <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontWeight: 'bold', fontSize: 'calc(1.333 * var(--font-size-base))', color: 'var(--text-primary)' }}>{category}</span>
                            </div>
                          </div>
                          {(() => {
                            const solvedCat = problems.filter(p => ownSolvedSet.has(p.titleSlug)).length;
                            const totalCat = problems.length;
                            const catPct = totalCat > 0 ? Math.round((solvedCat / totalCat) * 100) : 0;
                            return (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                  {solvedCat} / {totalCat} Solved
                                </span>
                                <span style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: catPct === 100 ? 'var(--color-easy)' : '#ffa116', background: 'var(--bg-primary)', padding: '2px 8px', borderRadius: '0px', border: '1px solid var(--border-color)' }}>
                                  {catPct}%
                                </span>
                              </div>
                            );
                          })()}
                        </div>
                        {(() => {
                          const solvedCat = problems.filter(p => ownSolvedSet.has(p.titleSlug)).length;
                          const totalCat = problems.length;
                          const catPct = totalCat > 0 ? Math.round((solvedCat / totalCat) * 100) : 0;
                          return (
                            <div style={{ width: '100%', height: '6px', background: 'var(--bg-primary)', borderRadius: '0px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                              <div style={{ width: `${catPct}%`, height: '100%', background: catPct === 100 ? 'var(--color-easy)' : '#ffa116', transition: 'width 0.3s ease' }}></div>
                            </div>
                          );
                        })()}
                      </div>
                    </td>
                  </tr>
                  {expandedCategories.has(category) && problems.map((prob) => {
                    const isCf = prob.platform === 'codeforces';
                    const isCses = prob.platform === 'cses';
                    const isGfg = prob.platform === 'gfg';
                    const isNinjas = prob.platform === 'codingninjas' || prob.platform === 'naukri';
                    const isIb = prob.platform === 'interviewbit';
                    const isCc = prob.platform === 'codechef';
                    const isSpoj = prob.platform === 'spoj';
                    const isTuf = prob.platform === 'tuf' || prob.platform === 'other';
                    
                    const match = isCf ? prob.titleSlug.match(/^(\d+)([A-Z]\d*)$/i) : null;
                    
                    let link = prob.url;
                    if (!link) {
                      link = `https://leetcode.com/problems/${prob.titleSlug}/`;
                      if (isCses) link = `https://cses.fi/problemset/task/${prob.titleSlug}`;
                      else if (isCf && match) link = `https://codeforces.com/contest/${match[1]}/problem/${match[2]}`;
                      else if (isCf) link = `https://codeforces.com/problemset/problem/${prob.titleSlug}`;
                      else if (isGfg) link = `https://www.geeksforgeeks.org/problems/${prob.titleSlug}/1`;
                      else if (isNinjas) link = `https://www.naukri.com/code360/problems/${prob.titleSlug}`;
                      else if (isIb) link = `https://www.interviewbit.com/problems/${prob.titleSlug}/`;
                      else if (isCc) link = `https://www.codechef.com/problems/${prob.titleSlug}`;
                      else if (isSpoj) link = `https://www.spoj.com/problems/${prob.titleSlug}/`;
                    }

                    let solLink = `https://leetcode.com/problems/${prob.titleSlug}/solutions/`;
                    if (isCses) solLink = `https://cses.fi/problemset/stats/${prob.titleSlug}/`;
                    else if (isCf && match) solLink = `https://codeforces.com/contest/${match[1]}/status/${match[2]}`;
                    else if (isCf) solLink = `https://codeforces.com/problemset/status/${prob.titleSlug}`;
                    else if (isGfg) solLink = `https://www.geeksforgeeks.org/problems/${prob.titleSlug}/1?tab=editorial`;
                    else if (isNinjas) solLink = `https://www.naukri.com/code360/problems/${prob.titleSlug}?tab=solution`;
                    else if (isIb) solLink = `https://www.interviewbit.com/problems/${prob.titleSlug}/?tab=solutions`;
                    else if (isCc) solLink = `https://www.codechef.com/problems/${prob.titleSlug}/solutions`;
                    else if (isSpoj) solLink = `https://www.spoj.com/ranks/${prob.titleSlug}/`;
                    else if (isTuf && prob.url) solLink = prob.url;

                    return (
                      <tr key={prob.titleSlug}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  toggleRevisionStar(prob.titleSlug);
                                }}
                                title={revisionStars.has(prob.titleSlug) ? "Marked for Revision (Click to unmark)" : "Click to mark for revision"}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  padding: '4px',
                                  cursor: 'pointer',
                                  color: revisionStars.has(prob.titleSlug) ? '#ffa116' : 'var(--text-muted)',
                                  fontSize: 'calc(1.333 * var(--font-size-base))',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'transform 0.15s ease'
                                }}
                                onMouseOver={(e) => { e.currentTarget.style.transform = 'scale(1.2)'; }}
                                onMouseOut={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                              >
                                {revisionStars.has(prob.titleSlug) ? '★' : '☆'}
                              </button>
                              <a 
                                href={link} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="problem-title"
                                style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
                              >
                                {isGfg && (
                                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', height: '20px', background: 'rgba(47, 141, 70, 0.2)', border: '1px solid #2f8d46', color: '#2f8d46', borderRadius: '0px', fontSize: 'var(--font-size-xs)', fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.5px' }} title="GeeksforGeeks">
                                    GFG
                                  </span>
                                )}
                                {isNinjas && (
                                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', height: '20px', background: 'rgba(238, 108, 77, 0.2)', border: '1px solid #ee6c4d', color: '#ee6c4d', borderRadius: '0px', fontSize: 'var(--font-size-xs)', fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.5px' }} title="Coding Ninjas">
                                    CN
                                  </span>
                                )}
                                {isTuf && (
                                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', height: '20px', background: 'rgba(217, 70, 70, 0.2)', border: '1px solid #d94646', color: '#d94646', borderRadius: '0px', fontSize: 'var(--font-size-xs)', fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.5px' }} title="TakeUForward">
                                    TUF
                                  </span>
                                )}
                                {isIb && (
                                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', height: '20px', background: 'rgba(74, 144, 226, 0.2)', border: '1px solid #4a90e2', color: '#4a90e2', borderRadius: '0px', fontSize: 'var(--font-size-xs)', fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.5px' }} title="InterviewBit">
                                    IB
                                  </span>
                                )}
                                {isCc && (
                                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', background: 'rgba(139, 87, 42, 0.15)', borderRadius: '0px' }} title="CodeChef">
                                    <CodeChefIcon size={14} />
                                  </span>
                                )}
                                {isSpoj && (
                                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', height: '20px', background: 'rgba(102, 128, 153, 0.2)', border: '1px solid #668099', color: '#668099', borderRadius: '0px', fontSize: 'var(--font-size-xs)', fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.5px' }} title="SPOJ">
                                    SPOJ
                                  </span>
                                )}
                                {(!isGfg && !isCf && !isCses && !isNinjas && !isIb && !isCc && !isSpoj && !isTuf) && (
                                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', background: 'rgba(255, 161, 22, 0.15)', borderRadius: '0px' }} title="LeetCode">
                                    <LeetCodeIcon size={14} />
                                  </span>
                                )}
                                {isCf && (
                                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', background: 'rgba(59, 130, 246, 0.15)', borderRadius: '0px' }} title="Codeforces">
                                    <CodeforcesIcon size={14} />
                                  </span>
                                )}
                                {isCses && (
                                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', height: '20px', background: 'rgba(156, 163, 175, 0.2)', border: '1px solid #9ca3af', color: '#9ca3af', borderRadius: '0px', fontSize: 'var(--font-size-xs)', fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.5px' }} title="CSES">
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
                                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
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
                                  padding: '2px 6px', 
                                  background: 'var(--bg-primary)', 
                                  border: '1px solid var(--border-strong)', 
                                  color: 'var(--text-secondary)', 
                                  fontSize: 'var(--font-size-sm)', 
                                  fontWeight: 700, 
                                  textDecoration: 'none',
                                  borderRadius: '0px'
                                }}
                                onMouseOver={(e) => { e.currentTarget.style.background = '#ffa116'; e.currentTarget.style.color = '#000'; }}
                                onMouseOut={(e) => { e.currentTarget.style.background = 'var(--bg-primary)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                              >
                                SOL
                              </a>
                            )}
                            {/* Friend Avatars Cluster */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '12px' }}>
                              {allFriendsSolvedSets.filter(fs => fs.solvedSet.has(prob.titleSlug)).map(({ friend }) => {
                                const name = friend.displayName || friend.username || 'F';
                                const initial = name.charAt(0).toUpperCase();
                                let profileHref = `https://leetcode.com/${friend.username}`;
                                if (isCf) {
                                  const acc = friend.accounts?.find(a => a.platform === 'codeforces');
                                  profileHref = `https://codeforces.com/profile/${acc ? acc.handle : friend.username}`;
                                } else if (isCc) {
                                  const acc = friend.accounts?.find(a => a.platform === 'codechef');
                                  profileHref = `https://www.codechef.com/users/${acc ? acc.handle : friend.username}`;
                                } else {
                                  const acc = friend.accounts?.find(a => a.platform === 'leetcode');
                                  if (acc) profileHref = `https://leetcode.com/${acc.handle}`;
                                }
                                return (
                                  <a 
                                    key={friend.id || friend.username} 
                                    href={profileHref}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={`${name} has solved this problem! (Click to view profile)`}
                                    style={{ 
                                      display: 'inline-flex', 
                                      alignItems: 'center', 
                                      justifyContent: 'center', 
                                      width: '20px', 
                                      height: '20px', 
                                      borderRadius: '0px', 
                                      background: 'var(--color-easy)', 
                                      color: '#000', 
                                      fontSize: 'var(--font-size-xs)', 
                                      fontWeight: 'bold',
                                      border: '1px solid #000',
                                      cursor: 'pointer',
                                      textDecoration: 'none',
                                      boxShadow: 'none'
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
                          <span className={`diff-badge diff-${prob.difficulty?.toLowerCase()}`}>
                            {prob.difficulty}
                          </span>
                        </td>
                        {trackerFriends.map(friend => {
                          const isSolved = ownSolvedSet.has(prob.titleSlug);
                          return (
                            <td key={friend.id || friend.username} className="status-cell">
                              <div className={`status-icon ${isSolved ? 'solved' : ''}`} title={isSolved ? 'Solved' : 'Not Solved'}>
                                {isSolved ? (
                                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                  </svg>
                                ) : (
                                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
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
  padding: '6px 12px',
  background: 'var(--bg-secondary)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-color)',
  borderRadius: '0px',
  outline: 'none',
  fontSize: 'var(--font-size-md)'
};

export default SheetsTracker;
