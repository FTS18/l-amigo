import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Bell, BellRing } from 'lucide-react';
import { AlarmsService } from '../services/alarms';
import { CodeforcesService } from '../services/codeforces';
import { CodeChefService } from '../services/codechef';
import { LeetCodeService } from '../services/leetcode';
import { STORAGE_KEYS } from '../constants';
import { PlatformIcon } from '../utils/PlatformIcons';

export const UpcomingContests: React.FC = () => {
  const [contests, setContests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(false); // Default to collapsed
  const [reminders, setReminders] = useState<Record<string, any>>({});
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Only tick the countdown when the section is open — saves 1 re-render/sec when collapsed
  useEffect(() => {
    if (!expanded) return;
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [expanded]);

  useEffect(() => {
    AlarmsService.getReminders().then(setReminders);
  }, []);

  const handleToggleReminder = async (e: React.MouseEvent, c: any) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Request permission if not granted
    if (!reminders[c.id]) {
      chrome.permissions.request({ permissions: ['notifications'] }, async (granted) => {
        if (granted) {
          await AlarmsService.toggleReminder({
            id: String(c.id),
            name: c.name,
            platform: c.platform,
            startTimeSeconds: c.startTimeSeconds
          });
          setReminders(await AlarmsService.getReminders());
        }
      });
    } else {
      await AlarmsService.toggleReminder({
        id: String(c.id),
        name: c.name,
        platform: c.platform,
        startTimeSeconds: c.startTimeSeconds
      });
      setReminders(await AlarmsService.getReminders());
    }
  };

  useEffect(() => {
    const fetchContests = async () => {
      const cacheKey = STORAGE_KEYS.UPCOMING_CONTESTS_CACHE;
      const cached = await new Promise<any>(resolve => {
        chrome.storage.local.get([cacheKey], res => resolve(res[cacheKey]));
      });

      if (cached && cached.timestamp > Date.now() - 1000 * 60 * 60) {
        // Cache for 1 hour
        setContests(cached.data);
        setLoading(false);
        return;
      }

      try {
        const [lcData, cfData, ccData] = await Promise.all([
          LeetCodeService.getUpcomingContests(),
          CodeforcesService.getUpcomingContests(),
          CodeChefService.getUpcomingContests()
        ]);
        
        const LC_MAX = 4;
        const CF_MAX = 6;
        const CC_MAX = 4;

        const mergedData = [
          ...lcData.map(c => ({ ...c, platform: c.platform || 'leetcode' })).slice(0, LC_MAX),
          ...cfData.map(c => ({ ...c, platform: c.platform || 'codeforces' })).slice(0, CF_MAX),
          ...ccData.map(c => ({ ...c, platform: c.platform || 'codechef' })).slice(0, CC_MAX),
        ].sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);

        setContests(mergedData);
        chrome.storage.local.set({
          [cacheKey]: {
            data: mergedData,
            timestamp: Date.now()
          }
        });
      } catch (err) {
        console.error(err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchContests();
  }, []);

  // Filter out contests that have already finished or are more than 30 days away
  const upcomingContests = contests.filter(c => {
    const startTimeMs = c.startTimeSeconds * 1000;
    const durationMs = (c.durationSeconds || 7200) * 1000;
    return startTimeMs + durationMs > Date.now() && startTimeMs < Date.now() + 30 * 24 * 60 * 60 * 1000;
  });

  // If we have loaded but have no upcoming contests, hide the section
  if (!loading && upcomingContests.length === 0 && !error) return null;

  return (
    <div className="recommendations-section upcoming-contests-section">
      <button 
        className="recommendations-toggle"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-label="Toggle upcoming contests list"
      >
        Upcoming Contests {expanded ? <ChevronDown size={14} style={{ verticalAlign: 'middle', marginLeft: '4px' }} /> : <ChevronRight size={14} style={{ verticalAlign: 'middle', marginLeft: '4px' }} />}
      </button>

      {expanded && (
        <div className="recommendations-content" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {loading && upcomingContests.length === 0 ? (
            <div style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-secondary)' }}>
              Loading schedule...
            </div>
          ) : error ? (
            <div style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-secondary)' }}>
              Could not load contests. Check connection.
            </div>
          ) : (
            upcomingContests.map(c => {
              const date = new Date(c.startTimeSeconds * 1000);
              const isLC = c.platform === 'leetcode';
              const isCC = c.platform === 'codechef';
              const href = isLC 
                ? `https://leetcode.com/contest/${c.id}` 
                : isCC
                ? `https://www.codechef.com/${c.id}`
                : `https://codeforces.com/contests/${c.id}`;
                
              return (
                <div key={`${c.platform}-${c.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--font-size-base)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    <div 
                      className="contest-platform-badge"
                      style={{ 
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '18px',
                        height: '18px',
                        backgroundColor: isLC ? 'var(--accent-leetcode-primary)' : isCC ? 'var(--accent-codechef-primary, #5B4638)' : 'var(--accent-codeforces-blue)',
                        flexShrink: 0
                      }}
                      title={isLC ? 'LeetCode' : isCC ? 'CodeChef' : 'Codeforces'}
                    >
                      <PlatformIcon platform={c.platform} size={12} monochrome="white" />
                    </div>
                    <a 
                      href={href} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="uc-contest-link"
                      title={c.name}
                      style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {c.name}
                    </a>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {c.startTimeSeconds * 1000 <= currentTime && c.startTimeSeconds * 1000 + (c.durationSeconds || 7200) * 1000 > currentTime ? (
                      <span className="live-now-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(0, 200, 83, 0.15)', border: '1px solid #00C853', color: '#00C853', padding: '2px 8px', borderRadius: '4px', animation: 'pulse 2s infinite', fontWeight: 'bold', fontSize: 'var(--font-size-xs)' }}>
                        ● LIVE NOW
                      </span>
                    ) : c.startTimeSeconds * 1000 - currentTime < 24 * 60 * 60 * 1000 && c.startTimeSeconds * 1000 > currentTime ? (
                      <span style={{ color: 'var(--color-easy)', whiteSpace: 'nowrap', flexShrink: 0, fontWeight: 600, fontSize: 'var(--font-size-sm)', fontFamily: 'monospace' }}>
                        {(() => {
                           const diff = c.startTimeSeconds * 1000 - currentTime;
                           const h = Math.floor(diff / (1000 * 60 * 60));
                           const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                           const s = Math.floor((diff % (1000 * 60)) / 1000);
                           return `Starts in ${h}h ${m}m ${s}s`;
                        })()}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at {date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                    <button 
                      onClick={(e) => handleToggleReminder(e, c)}
                      title={reminders[c.id] ? "Remove reminder" : "Set reminder"}
                      aria-label={reminders[c.id] ? "Remove reminder" : "Set reminder"}
                      style={{ 
                        background: 'none', border: 'none', cursor: 'pointer', padding: 0, 
                        color: reminders[c.id] ? 'var(--platform-theme-color, #FFD700)' : 'var(--text-muted)' 
                      }}
                    >
                      {reminders[c.id] ? <BellRing size={14} /> : <Bell size={14} />}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
