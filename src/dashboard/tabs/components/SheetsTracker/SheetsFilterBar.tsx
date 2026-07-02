import React from "react";
import { useAppStore } from "../../../../store/useAppStore";

interface SheetsFilterBarProps {
  isLoading: boolean;
  uniqueCategories: string[];
  hasVideoSolutions: boolean;
  hasMultiplePlatforms: boolean;
  availablePlatforms: string[];
  blindMode: boolean;
}

export const SheetsFilterBar: React.FC<SheetsFilterBarProps> = ({
  isLoading,
  uniqueCategories,
  hasVideoSolutions,
  hasMultiplePlatforms,
  availablePlatforms,
  blindMode,
}) => {
  const setPartial = useAppStore(state => state.setPartial);
  const categoryFilter = useAppStore(state => state.ui_stCatFilter);
  const difficultyFilter = useAppStore(state => state.ui_stDiffFilter);
  const statusFilter = useAppStore(state => state.ui_stStatusFilter);
  const platformFilter = useAppStore(state => state.ui_stPlatFilter);
  const videoFilter = useAppStore(state => state.ui_stVideoFilter);
  const searchQuery = useAppStore(state => state.ui_stSearchQuery);

  const setCategoryFilter = (v: string) => setPartial({ ui_stCatFilter: v });
  const setDifficultyFilter = (v: string) => setPartial({ ui_stDiffFilter: v });
  const setStatusFilter = (v: string) => setPartial({ ui_stStatusFilter: v });
  const setPlatformFilter = (v: string) => setPartial({ ui_stPlatFilter: v });
  const setVideoFilter = (v: string) => setPartial({ ui_stVideoFilter: v });
  const setSearchQuery = (v: string) => setPartial({ ui_stSearchQuery: v });

  const filterStyle: React.CSSProperties = {
    padding: "8px 12px",
    border: "1px solid var(--border-strong)",
    background: "var(--bg-primary)",
    color: "var(--text-primary)",
    borderRadius: "0px",
    cursor: "pointer",
  };

  return (
    <>
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
              color: statusFilter === status ? "#000" : "var(--text-primary)",
              border: `1px solid ${
                statusFilter === status ? "#ffa116" : "var(--border-strong)"
              }`,
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
    </>
  );
};
