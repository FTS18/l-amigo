import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Bell, BellRing } from 'lucide-react';
import { AlarmsService } from '../services/alarms';
import { CodeforcesService } from '../services/codeforces';
import { CodeChefService } from '../services/codechef';
import { LeetCodeService } from '../services/leetcode';

export const UpcomingContests: React.FC = () => {
  const [contests, setContests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false); // Default to collapsed
  const [reminders, setReminders] = useState<Record<string, any>>({});
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

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
      const cacheKey = 'lamigo:upcomingContests:v5'; // bumped cache key for codechef name fix
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
        
        const mergedData = [
          ...lcData.map(c => ({ ...c, platform: c.platform || 'leetcode' })),
          ...cfData.map(c => ({ ...c, platform: c.platform || 'codeforces' })),
          ...ccData.map(c => ({ ...c, platform: c.platform || 'codechef' }))
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
      } finally {
        setLoading(false);
      }
    };
    fetchContests();
  }, []);

  // If we have loaded but have no contests, hide the section
  if (!loading && contests.length === 0) return null;

  return (
    <div className="recommendations-section upcoming-contests-section">
      <button 
        className="recommendations-toggle"
        onClick={() => setExpanded(!expanded)}
      >
        Upcoming Contests {expanded ? <ChevronDown size={14} style={{ verticalAlign: 'middle', marginLeft: '4px' }} /> : <ChevronRight size={14} style={{ verticalAlign: 'middle', marginLeft: '4px' }} />}
      </button>

      {expanded && (
        <div className="recommendations-content" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {loading && contests.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Loading schedule...
            </div>
          ) : (
            contests.map(c => {
              const date = new Date(c.startTimeSeconds * 1000);
              const isLC = c.platform === 'leetcode';
              const isCC = c.platform === 'codechef';
              const href = isLC 
                ? `https://leetcode.com/contest/${c.id}` 
                : isCC
                ? `https://www.codechef.com/${c.id}`
                : `https://codeforces.com/contests/${c.id}`;
                
              return (
                <div key={`${c.platform}-${c.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    <div 
                      className="contest-platform-badge"
                      style={{ 
                        padding: '2px 4px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        backgroundColor: isLC ? 'var(--accent-leetcode-primary)' : isCC ? 'var(--accent-codechef-primary, #5B4638)' : 'var(--accent-codeforces-blue)',
                        color: 'white',
                        flexShrink: 0
                      }}
                      title={isLC ? 'LeetCode' : isCC ? 'CodeChef' : 'Codeforces'}
                    >
                      {isLC ? 'LC' : isCC ? 'CC' : 'CF'}
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
                    {c.startTimeSeconds * 1000 - currentTime < 24 * 60 * 60 * 1000 && c.startTimeSeconds * 1000 > currentTime ? (
                      <span style={{ color: 'var(--color-easy)', whiteSpace: 'nowrap', flexShrink: 0, fontWeight: 600, fontSize: '11px', fontFamily: 'monospace' }}>
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
