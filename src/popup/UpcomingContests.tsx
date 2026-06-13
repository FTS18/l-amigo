import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { CodeforcesService } from '../services/codeforces';
import { CodeChefService } from '../services/codechef';
import { LeetCodeService } from '../services/leetcode';

export const UpcomingContests: React.FC = () => {
  const [contests, setContests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false); // Default to collapsed

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

  if (loading && contests.length === 0) {
    return (
      <div className="recommendations-section upcoming-contests-section">
        <button className="recommendations-toggle" style={{ cursor: 'default' }}>
          Upcoming Contests <ChevronRight size={14} style={{ verticalAlign: 'middle', marginLeft: '4px' }} />
        </button>
        <div className="recommendations-content" style={{ padding: '8px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          Loading schedule...
        </div>
      </div>
    );
  }

  if (contests.length === 0) return null;

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
          {contests.map(c => {
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
                <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap', flexShrink: 0, marginLeft: '8px' }}>
                  {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at {date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
