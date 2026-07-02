import React from "react";
import { SheetProblem } from "../../SheetsTracker";
import { Friend } from "../../../../types";
import { LeetCodeIcon, CodeforcesIcon, CodeChefIcon } from "../../../../utils/PlatformIcons";

interface SheetsProblemTableProps {
  isLoading: boolean;
  sheetData: SheetProblem[] | null;
  groupedData: Record<string, SheetProblem[]>;
  blindMode: boolean;
  trackerFriends: Friend[];
  expandedCategories: Set<string>;
  toggleCategory: (cat: string) => void;
  ownSolvedSet: Set<string>;
  revisionStars: Set<string>;
  toggleRevisionStar: (slug: string) => void;
  allFriendsSolvedSets: { friend: Friend; solvedSet: Set<string> }[];
  crossSheetIndex: Record<string, string[]>;
  setSelectedSheetId: (id: string) => void;
  getSheetName: (id: string) => string;
  toggleManualSolve: (slug: string, title: string, platform: string) => void;
}

export const SheetsProblemTable: React.FC<SheetsProblemTableProps> = React.memo(({
  isLoading,
  sheetData,
  groupedData,
  blindMode,
  trackerFriends,
  expandedCategories,
  toggleCategory,
  ownSolvedSet,
  revisionStars,
  toggleRevisionStar,
  allFriendsSolvedSets,
  crossSheetIndex,
  setSelectedSheetId,
  getSheetName,
  toggleManualSolve,
}) => {
  return (
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
                                ? "★"
                                : "☆"}
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
                                      (a: any) => a.platform === "codeforces",
                                    );
                                    profileHref = `https://codeforces.com/profile/${acc ? acc.handle : friend.username}`;
                                  } else if (isCc) {
                                    const acc = friend.accounts?.find(
                                      (a: any) => a.platform === "codechef",
                                    );
                                    profileHref = `https://www.codechef.com/users/${acc ? acc.handle : friend.username}`;
                                  } else {
                                    const acc = friend.accounts?.find(
                                      (a: any) => a.platform === "leetcode",
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
  );
});
