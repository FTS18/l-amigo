import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight, RefreshCw, SlidersHorizontal, X, FolderSearch } from 'lucide-react';
import { ProblemRecommendation, RecommendationService } from '../services/recommendations';
import { FriendProfile } from '../types';
import { SkeletonRecItem } from './Skeleton';

interface RecommendationsProps {
  profiles: Record<string, FriendProfile>;
  ownUsername?: string;
}

type DiffFilter = 'All' | 'Easy' | 'Medium' | 'Hard';
type PlatformFilter = 'lc' | 'cf';

export const Recommendations: React.FC<RecommendationsProps> = ({ profiles, ownUsername }) => {
  const [recommendations, setRecommendations] = useState<ProblemRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const ss = <T,>(key: string, fallback: T): T => {
    try {
      const v = sessionStorage.getItem(`rec_${key}`);
      if (v !== null) return JSON.parse(v) as T;
    } catch { /* ignore */ }
    return fallback;
  };
  const setSS = <T,>(key: string, value: T) => {
    try { sessionStorage.setItem(`rec_${key}`, JSON.stringify(value)); } catch { /* ignore */ }
  };

  const [expanded, _setExpanded] = useState<boolean>(() => ss('expanded', false));
  const setExpanded = (v: boolean | ((prev: boolean) => boolean)) => {
    _setExpanded(prev => {
      const next = typeof v === 'function' ? v(prev) : v;
      setSS('expanded', next);
      return next;
    });
  };

  // Filters
  const [diffFilter, _setDiffFilter] = useState<DiffFilter>(() => ss('diffFilter', 'All'));
  const setDiffFilter = (v: DiffFilter) => { setSS('diffFilter', v); _setDiffFilter(v); };

  const [platformFilters, _setPlatformFilters] = useState<Set<PlatformFilter>>(() => new Set(ss('platformFilters', [])));
  const setPlatformFilters = (v: Set<PlatformFilter> | ((prev: Set<PlatformFilter>) => Set<PlatformFilter>)) => {
    _setPlatformFilters(prev => {
      const next = typeof v === 'function' ? v(prev) : v;
      setSS('platformFilters', Array.from(next));
      return next;
    });
  };

  const [ratingMin, _setRatingMin] = useState<string>(() => ss('ratingMin', ''));
  const setRatingMin = (v: string) => { setSS('ratingMin', v); _setRatingMin(v); };

  const [ratingMax, _setRatingMax] = useState<string>(() => ss('ratingMax', ''));
  const setRatingMax = (v: string) => { setSS('ratingMax', v); _setRatingMax(v); };

  const [showAdvanced, _setShowAdvanced] = useState<boolean>(() => ss('showAdvanced', false));
  const setShowAdvanced = (v: boolean | ((prev: boolean) => boolean)) => {
    _setShowAdvanced(prev => {
      const next = typeof v === 'function' ? v(prev) : v;
      setSS('showAdvanced', next);
      return next;
    });
  };

  const loadRecommendations = async () => {
    if (Object.keys(profiles).length === 0) return;
    setLoading(true);
    try {
      const ownSolvedProblems = new Set<string>();
      const storedData = await chrome.storage.local.get('all_accepted_submissions');
      const storedSubs = storedData.all_accepted_submissions || [];
      storedSubs.forEach((sub: any) => ownSolvedProblems.add(sub.titleSlug));

      if (ownUsername) {
        const lowerOwn = ownUsername.toLowerCase();
        Object.entries(profiles).forEach(([key, profile]) => {
          const [, handle] = key.split(':');
          if (handle && handle.toLowerCase() === lowerOwn) {
            profile.recentSubmissions?.forEach(sub => {
              if (sub.statusDisplay === 'Accepted') ownSolvedProblems.add(sub.titleSlug);
            });
          }
          if (profile.username?.toLowerCase() === lowerOwn) {
            profile.recentSubmissions?.forEach(sub => {
              if (sub.statusDisplay === 'Accepted') ownSolvedProblems.add(sub.titleSlug);
            });
          }
        });
      }

      const recs = await RecommendationService.getRecommendations(profiles, ownSolvedProblems);
      setRecommendations(recs);
    } catch (error) {
      console.error('Error loading recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (expanded) loadRecommendations();
  }, [expanded]);

  if (Object.keys(profiles).length === 0) return null;

  // ── Apply all filters ────────────────────────────────────────────────
  const filteredRecs = recommendations.filter(r => {
    // Difficulty
    if (diffFilter !== 'All' && r.difficulty.toLowerCase() !== diffFilter.toLowerCase()) return false;

    // Platform multi-select (empty = show all)
    if (platformFilters.size > 0) {
      const isPlatformSelected =
        (platformFilters.has('lc') && r.platform === 'leetcode') ||
        (platformFilters.has('cf') && r.platform === 'codeforces');
      if (!isPlatformSelected) return false;
    }

    // CF Rating range (only applies to CF problems with a rating)
    if (r.platform === 'codeforces' && r.rating !== undefined) {
      const min = ratingMin !== '' ? Number(ratingMin) : -Infinity;
      const max = ratingMax !== '' ? Number(ratingMax) : Infinity;
      if (r.rating < min || r.rating > max) return false;
    }

    return true;
  }).slice(0, 10);

  const togglePlatform = (p: PlatformFilter) => {
    setPlatformFilters(prev => {
      const next = new Set(prev);
      next.has(p) ? next.delete(p) : next.add(p);
      return next;
    });
  };

  const clearFilters = () => {
    setDiffFilter('All');
    setPlatformFilters(new Set());
    setRatingMin('');
    setRatingMax('');
  };

  const hasActiveFilters =
    diffFilter !== 'All' ||
    platformFilters.size > 0 ||
    ratingMin !== '' ||
    ratingMax !== '';

  // Colour helpers
  const diffColor = (d: string) =>
    d === 'Easy' ? 'var(--color-easy)' : d === 'Medium' ? 'var(--color-medium)' : d === 'Hard' ? 'var(--color-hard)' : 'var(--btn-bg)';

  return (
    <div className="recommendations-section">
      {/* ── Header toggle ───────────────────────────────────────────── */}
      <button
        className="recommendations-toggle"
        onClick={() => setExpanded(!expanded)}
      >
        Problem Recommendations
        {expanded
          ? <ChevronDown size={14} style={{ verticalAlign: 'middle', marginLeft: '4px' }} />
          : <ChevronRight size={14} style={{ verticalAlign: 'middle', marginLeft: '4px' }} />}
        {recommendations.length > 0 && (
          <span style={{ marginLeft: '4px', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 400 }}>
            ({filteredRecs.length}{filteredRecs.length !== recommendations.length ? `/${recommendations.length}` : ''})
          </span>
        )}
      </button>

      {expanded && (
        <div className="recommendations-content">

          {/* ── Filter bar ──────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>

            {/* Row 1: Difficulty + platform + tools */}
            <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Difficulty pills */}
              {(['All', 'Easy', 'Medium', 'Hard'] as DiffFilter[]).map(d => {
                const active = diffFilter === d;
                return (
                  <button
                    key={d}
                    onClick={() => setDiffFilter(d)}
                    style={{
                      padding: '3px 10px',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 700,
                      borderRadius: '0',
                      border: `1.5px solid ${active ? diffColor(d) : 'var(--border-strong)'}`,
                      background: active ? diffColor(d) : 'transparent',
                      color: active ? '#fff' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      letterSpacing: '0.3px',
                    }}
                    className="brutalist-btn"
                  >
                    {d}
                  </button>
                );
              })}

              <div style={{ width: '1px', height: '14px', background: 'var(--border)', margin: '0 2px', flexShrink: 0 }} />

              {/* Platform multi-select */}
              {([
                { key: 'lc', label: 'LC', color: 'var(--accent-leetcode-primary)' },
                { key: 'cf', label: 'CF', color: 'var(--accent-codeforces-blue)' },
              ] as { key: PlatformFilter; label: string; color: string }[]).map(p => {
                const active = platformFilters.has(p.key);
                return (
                  <button
                    key={p.key}
                    onClick={() => togglePlatform(p.key)}
                    style={{
                      padding: '3px 9px',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 800,
                      borderRadius: '0',
                      border: `1.5px solid ${active ? p.color : 'var(--border-strong)'}`,
                      background: active ? p.color : 'transparent',
                      color: active ? '#fff' : 'var(--text-muted)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                    className="brutalist-btn"
                    data-tooltip={`Filter by ${p.key === 'lc' ? 'LeetCode' : 'Codeforces'}`}
                  >
                    {p.label}
                  </button>
                );
              })}

              {/* Spacer */}
              <div style={{ flex: 1 }} />

              {/* CF rating range toggle */}
              {!(platformFilters.size === 1 && platformFilters.has('lc')) && (
                <button
                onClick={() => setShowAdvanced(s => !s)}
                style={{
                  padding: '3px 8px',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 700,
                  borderRadius: '0',
                  border: `1.5px solid ${showAdvanced ? 'var(--accent-codeforces-blue)' : 'var(--border-strong)'}`,
                  background: showAdvanced ? 'rgba(59,130,246,0.15)' : 'transparent',
                  color: showAdvanced ? 'var(--accent-codeforces-blue)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                className="brutalist-btn"
                data-tooltip="CF Rating Range"
              >
                <SlidersHorizontal size={11} />
                  CF ±
                </button>
              )}

              {/* Clear filters */}
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  style={{
                    padding: '3px 7px',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 700,
                    borderRadius: '0',
                    border: '1.5px solid var(--color-hard)',
                    background: 'transparent',
                    color: 'var(--color-hard)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                  }}
                  className="brutalist-btn"
                  data-tooltip="Clear all filters"
                >
                  <X size={10} />
                </button>
              )}

              {/* Refresh */}
              <button
                onClick={loadRecommendations}
                disabled={loading}
                style={{
                  padding: '3px 7px',
                  fontSize: 'var(--font-size-base)',
                  borderRadius: '0',
                  border: '1.5px solid var(--border-strong)',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                }}
                className="brutalist-btn"
                data-tooltip="Refresh recommendations"
              >
                <RefreshCw size={11} className={loading ? 'spin' : ''} />
              </button>
            </div>

            {/* Row 2: CF Rating range (collapsible) */}
            {showAdvanced && !(platformFilters.size === 1 && platformFilters.has('lc')) && (
              <div
                style={{
                  display: 'flex',
                  gap: '6px',
                  alignItems: 'center',
                  padding: '8px 10px',
                  background: 'rgba(59,130,246,0.06)',
                  borderRadius: '0',
                  border: '1px solid rgba(59,130,246,0.2)',
                }}
              >
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--accent-codeforces-blue)', whiteSpace: 'nowrap' }}>
                  CF Rating
                </span>
                <input
                  type="number"
                  placeholder="Min"
                  value={ratingMin}
                  onChange={e => setRatingMin(e.target.value)}
                  style={{
                    width: '64px',
                    padding: '4px 8px',
                    fontSize: 'var(--font-size-sm)',
                    borderRadius: '0',
                    border: '1.5px solid var(--border-strong)',
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    textAlign: 'center',
                  }}
                  onKeyDown={e => { if (e.key === 'Enter') loadRecommendations(); }}
                />
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>–</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={ratingMax}
                  onChange={e => setRatingMax(e.target.value)}
                  style={{
                    width: '64px',
                    padding: '4px 8px',
                    fontSize: 'var(--font-size-sm)',
                    borderRadius: '0',
                    border: '1.5px solid var(--border-strong)',
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    textAlign: 'center',
                  }}
                  onKeyDown={e => { if (e.key === 'Enter') loadRecommendations(); }}
                />
                {(ratingMin !== '' || ratingMax !== '') && (
                  <button
                    onClick={() => { setRatingMin(''); setRatingMax(''); }}
                    style={{
                      padding: '2px 6px',
                      fontSize: 'var(--font-size-xs)',
                      borderRadius: '0',
                      border: '1px solid var(--border)',
                      background: 'transparent',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                    className="brutalist-btn"
                  >
                    Clear
                  </button>
                )}
                <span style={{ fontSize: 'calc(0.9 * var(--font-size-xs))', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  (only applies to CF)
                </span>
              </div>
            )}
          </div>

          {/* ── Recommendation list ──────────────────────────────────── */}
          {loading ? (
            <div>
              <SkeletonRecItem /><SkeletonRecItem /><SkeletonRecItem />
            </div>
          ) : filteredRecs.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', padding: '30px 20px',
              border: '1px dashed var(--border-strong)', background: 'var(--bg-secondary)',
              color: 'var(--text-muted)', gap: '8px', margin: '8px 0', borderRadius: '0'
            }}>
              <FolderSearch size={28} style={{ opacity: 0.5, marginBottom: '4px' }} />
              <p style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 600 }}>
                {recommendations.length === 0
                  ? 'No recommendations available yet'
                  : 'No problems match your filters'}
              </p>
            </div>
          ) : (
            <ul className="recommendations-list">
              {filteredRecs.map((rec, idx) => {
                const url = rec.platform === 'codeforces'
                  ? `https://codeforces.com/problemset/problem/${rec.titleSlug}`
                  : `https://leetcode.com/problems/${rec.titleSlug}/`;

                const platformColor = rec.platform === 'codeforces'
                  ? 'var(--accent-codeforces-blue)'
                  : 'var(--accent-leetcode-primary)';

                return (
                  <li key={idx} className="recommendation-item">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="recommendation-link"
                    >
                      <div className="rec-header">
                        <span className="rec-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {/* Platform dot */}
                          <span
                            style={{
                              display: 'inline-block',
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              backgroundColor: platformColor,
                              flexShrink: 0,
                            }}
                            title={rec.platform === 'codeforces' ? 'Codeforces' : 'LeetCode'}
                          />
                          {rec.title}
                        </span>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                          {/* CF Rating badge */}
                          {rec.platform === 'codeforces' && rec.rating && (
                            <span style={{
                              fontSize: 'calc(0.9 * var(--font-size-xs))',
                              fontWeight: 700,
                              padding: '1px 5px',
                              borderRadius: '0',
                              border: '1px solid var(--accent-codeforces-blue)',
                              color: 'var(--accent-codeforces-blue)',
                              background: 'rgba(59,130,246,0.1)',
                            }}>
                              {rec.rating.toLocaleString()}
                            </span>
                          )}
                          {/* Difficulty badge */}
                          <span className={`rec-difficulty ${rec.difficulty.toLowerCase()}`}>
                            {rec.difficulty}
                          </span>
                        </div>
                      </div>
                      <div className="rec-reason">{rec.reason}</div>
                      <div className="rec-friends">
                        {rec.solvedByFriends.slice(0, 3).join(', ')}
                        {rec.solvedByFriends.length > 3 && ` +${rec.solvedByFriends.length - 3} more`}
                      </div>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
