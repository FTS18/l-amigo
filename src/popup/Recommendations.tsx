import React, { useState, useEffect } from 'react';
import { ProblemRecommendation, RecommendationService } from '../services/recommendations';
import { FriendProfile } from '../types';

interface RecommendationsProps {
  profiles: Record<string, FriendProfile>;
  ownUsername?: string;
}

export const Recommendations: React.FC<RecommendationsProps> = ({ profiles, ownUsername }) => {
  const [recommendations, setRecommendations] = useState<ProblemRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const loadRecommendations = async () => {
    if (Object.keys(profiles).length === 0) return;
    
    setLoading(true);
    try {
      // Get own solved problems if ownUsername is available
      const ownProfile = ownUsername ? profiles[ownUsername.toLowerCase()] : undefined;
      const ownSolvedProblems = new Set<string>();
      
      if (ownProfile?.recentSubmissions) {
        ownProfile.recentSubmissions.forEach(sub => {
          if (sub.statusDisplay === 'Accepted') {
            ownSolvedProblems.add(sub.titleSlug);
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
    if (expanded && recommendations.length === 0) {
      loadRecommendations();
    }
  }, [expanded]);

  if (Object.keys(profiles).length === 0) {
    return null;
  }

  return (
    <div className="recommendations-section">
      <button 
        className="recommendations-toggle"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="section-icon"></span> Problem Recommendations {expanded ? '▼' : '▶'}
      </button>

      {expanded && (
        <div className="recommendations-content">
          {loading ? (
            <p className="loading-text">Loading recommendations...</p>
          ) : recommendations.length === 0 ? (
            <p className="empty-text">No recommendations available yet</p>
          ) : (
            <ul className="recommendations-list">
              {recommendations.map((rec, idx) => (
                <li key={idx} className="recommendation-item">
                  <a
                    href={`https://leetcode.com/problems/${rec.titleSlug}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="recommendation-link"
                  >
                    <div className="rec-header">
                      <span className="rec-title">{rec.title}</span>
                      <span className={`rec-difficulty ${rec.difficulty.toLowerCase()}`}>
                        {rec.difficulty}
                      </span>
                    </div>
                    <div className="rec-reason">{rec.reason}</div>
                    <div className="rec-friends">
                      {rec.solvedByFriends.slice(0, 3).join(', ')}
                      {rec.solvedByFriends.length > 3 && ` +${rec.solvedByFriends.length - 3} more`}
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
