import React, { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Trophy,
  FileSpreadsheet,
  Swords,
  Calendar,
  Settings as SettingsIcon,
  Users,
} from "lucide-react";
import { Friend, FriendProfile } from "../types";
import { Overview } from "./tabs/Overview";
import { Friends } from "./tabs/Friends";
import { Leaderboard } from "./tabs/Leaderboard";
import { SheetsTracker } from "./tabs/SheetsTracker";
import { ContestHub } from "./tabs/ContestHub";
import { StorageService } from "../services/storage";
import { PlatformIcon } from "../utils/PlatformIcons";
import { SettingsTab } from "../popup/SettingsTab";
import { CompareTab } from "../popup/CompareTab";
import { Toast } from "../popup/Toast";
import { Modal } from "../popup/Modal";
import { ImportExportModal } from "../popup/ImportExportModal";

export const DashboardApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    | "overview"
    | "friends"
    | "leaderboard"
    | "sheets"
    | "head-to-head"
    | "contests"
    | "settings"
  >(() => {
    const hash = window.location.hash.replace("#", "");
    if (
      [
        "overview",
        "friends",
        "leaderboard",
        "sheets",
        "head-to-head",
        "contests",
        "settings",
      ].includes(hash)
    ) {
      return hash as any;
    }
    return "overview";
  });
  const [friends, setFriends] = useState<Friend[]>([]);
  const [profiles, setProfiles] = useState<Record<string, FriendProfile>>({});
  const [loading, setLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [selectedGlobalPlatforms, setSelectedGlobalPlatforms] = useState<
    string[]
  >(["leetcode", "codeforces", "codechef"]);
  const [fontSizeScale, setFontSizeScale] = useState(100);
  const [displayZoomScale, setDisplayZoomScale] = useState(100);
  const [disabledPlatforms, setDisabledPlatforms] = useState<string[]>([]);

  const [allSubmissions, setAllSubmissions] = useState<any[]>([]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--font-scale', `${fontSizeScale}%`);
    root.style.setProperty('--zoom-scale', `${displayZoomScale}%`);
    root.style.fontSize = `${(fontSizeScale / 100) * 100}%`;
    if ('zoom' in root.style) {
      (root.style as any).zoom = `${displayZoomScale}%`;
    }
  }, [fontSizeScale, displayZoomScale]);

  // Settings & Sync State
  const [ownUsername, setOwnUsername] = useState<string>("");
  const [ownCodeforcesHandle, setOwnCodeforcesHandle] = useState<string>("");
  const [ownCodechefHandle, setOwnCodechefHandle] = useState<string>("");
  const [ownCsesHandle, setOwnCsesHandle] = useState<string>("");
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
    action?: { label: string; onClick: () => void };
  } | null>(null);
  const [showImportExport, setShowImportExport] = useState(false);
  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "info" | "error" | "success";
  }>({
    isOpen: false,
    title: "",
    message: "",
    type: "info",
  });
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);

  useEffect(() => {
    window.location.hash = activeTab;
  }, [activeTab]);

  const loadData = async () => {
    const [res, loadedFriends, loadedProfiles] = await Promise.all([
      chrome.storage.local.get([
        "own_username",
        "own_codeforces_handle",
        "own_codechef_handle",
        "own_cses_handle",
        "all_accepted_submissions",
        "theme_preference",
        "darkMode",
        "font_size_scale",
        "display_zoom_scale",
        "selected_global_platforms",
        "disabled_platforms"
      ]),
      StorageService.getFriends(),
      StorageService.getProfiles(),
    ]);

    const isDark =
      res.darkMode !== undefined
        ? res.darkMode
        : res.theme_preference !== "light";
    setIsDarkMode(isDark);
    setOwnUsername(res.own_username || "");
    setOwnCodeforcesHandle(res.own_codeforces_handle || "");
    setOwnCodechefHandle(res.own_codechef_handle || "");
    setOwnCsesHandle(res.own_cses_handle || "");
    setFontSizeScale(res.font_size_scale ?? 100);
    setDisplayZoomScale(res.display_zoom_scale ?? 100);

    if (res.selected_global_platforms && Array.isArray(res.selected_global_platforms) && res.selected_global_platforms.length > 0) {
      setSelectedGlobalPlatforms(res.selected_global_platforms);
    }

    const submissions = res.all_accepted_submissions || [];
    setAllSubmissions(submissions);

    // Construct the 'own-user' friend object just like the popup does
    const hasOwn =
      res.own_username ||
      res.own_codeforces_handle ||
      res.own_codechef_handle ||
      res.own_cses_handle;
    let finalFriends = loadedFriends;
    if (hasOwn) {
      const ownAccounts = [];
      if (res.own_username)
        ownAccounts.push({
          platform: "leetcode",
          handle: res.own_username,
          status: "active",
        });
      if (res.own_codeforces_handle)
        ownAccounts.push({
          platform: "codeforces",
          handle: res.own_codeforces_handle,
          status: "active",
        });
      if (res.own_codechef_handle)
        ownAccounts.push({
          platform: "codechef",
          handle: res.own_codechef_handle,
          status: "active",
        });
      if (res.own_cses_handle)
        ownAccounts.push({
          platform: "cses",
          handle: res.own_cses_handle,
          status: "active",
        });

      const ownFriend: Friend = {
        id: "own-user",
        displayName: "You",
        username:
          res.own_username ||
          res.own_codeforces_handle ||
          res.own_codechef_handle,
        accounts: ownAccounts as any,
        addedAt: Date.now(),
      };

      // Filter out any friend that explicitly matches our own handles to prevent duplication
      finalFriends = finalFriends.filter((f) => {
        const hasSameLC =
          res.own_username &&
          f.accounts?.some(
            (a) =>
              a.platform === "leetcode" &&
              a.handle.toLowerCase() === res.own_username.toLowerCase(),
          );
        const hasSameCF =
          res.own_codeforces_handle &&
          f.accounts?.some(
            (a) =>
              a.platform === "codeforces" &&
              a.handle.toLowerCase() ===
                res.own_codeforces_handle.toLowerCase(),
          );
        const hasSameCC =
          res.own_codechef_handle &&
          f.accounts?.some(
            (a) =>
              a.platform === "codechef" &&
              a.handle.toLowerCase() === res.own_codechef_handle.toLowerCase(),
          );
        return !(hasSameLC || hasSameCF || hasSameCC);
      });

      finalFriends = [ownFriend, ...finalFriends];
    }

    setFriends(finalFriends);
    setProfiles(loadedProfiles);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const handleStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName !== "local") return;
      if (changes.font_size_scale)
        setFontSizeScale(changes.font_size_scale.newValue ?? 100);
      if (changes.display_zoom_scale)
        setDisplayZoomScale(changes.display_zoom_scale.newValue ?? 100);
      if (changes.darkMode) setIsDarkMode(changes.darkMode.newValue);

      const reloadKeys = [
        "own_username",
        "own_codeforces_handle",
        "own_codechef_handle",
        "own_cses_handle",
        "all_accepted_submissions",
        "friends",
        "friends_list",
        "friend_profiles",
        "profiles"
      ];
      if (Object.keys(changes).some(k => reloadKeys.includes(k))) {
        loadData();
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  const toggleDarkMode = async () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    await chrome.storage.local.set({
      darkMode: newMode,
      theme_preference: newMode ? "dark" : "light",
    });
  };

  const requestConfirm = (
    action: () => void,
    title: string,
    message: string,
  ) => {
    setModal({
      isOpen: true,
      title,
      message,
      type: "info",
    });
    setConfirmAction(() => action);
  };

  useEffect(() => {
    document.body.style.background = isDarkMode ? "#0e0e0e" : "#ffffff";
  }, [isDarkMode]);

  const fs = fontSizeScale / 100;
  const zoom = displayZoomScale / 100;
  const customStyles = {
    "--font-size-xs": `${10 * fs}px`,
    "--font-size-sm": `${11 * fs}px`,
    "--font-size-base": `${12 * fs}px`,
    "--font-size-md": `${13 * fs}px`,
    "--font-size-value": `${18 * fs}px`,
    "--font-size-label": `${10 * fs}px`,
    "--font-size-title": `${14 * fs}px`,
    height: `${100 / zoom}vh`,
    width: `${100 / zoom}vw`,
    margin: 0,
    padding: 0,
    zoom: zoom,
  } as React.CSSProperties;

  if (loading) {
    return (
      <div
        className={`app dashboard-app ${isDarkMode ? "dark" : "light"}`}
        style={{
          height: `${100 / zoom}vh`,
          width: `${100 / zoom}vw`,
          background: "var(--bg-primary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zoom: zoom,
        }}
      >
        <div style={{ color: "var(--text-primary)" }}>
          Loading Dashboard Data...
        </div>
      </div>
    );
  }

  return (
    <div
      className={`app dashboard-app ${isDarkMode ? "dark" : "light"}`}
      style={customStyles}
    >
      <div className="dashboard-container">
        <div className="sidebar">
          <div className="sidebar-header">
            <h1>L'Amigo</h1>
            <div
              style={{
                fontSize: "var(--font-size-sm)",
                color: "#888",
                marginTop: "4px",
                letterSpacing: "1px",
                textTransform: "uppercase",
              }}
            >
              Analytics Dashboard
            </div>
          </div>
          <div className="nav-menu">
            <div
              className={`nav-item ${activeTab === "overview" ? "active" : ""}`}
              onClick={() => setActiveTab("overview")}
            >
              <LayoutDashboard size={20} />
              <span>Overview</span>
            </div>
            <div
              className={`nav-item ${activeTab === "friends" ? "active" : ""}`}
              onClick={() => setActiveTab("friends")}
            >
              <Users size={20} />
              <span>Friends</span>
            </div>
            <div
              className={`nav-item ${activeTab === "leaderboard" ? "active" : ""}`}
              onClick={() => setActiveTab("leaderboard")}
            >
              <Trophy size={20} />
              <span>Leaderboard</span>
            </div>
            <div
              className={`nav-item ${activeTab === "sheets" ? "active" : ""}`}
              onClick={() => setActiveTab("sheets")}
            >
              <FileSpreadsheet size={20} />
              <span>Sheets Tracker</span>
            </div>
            <div
              className={`nav-item ${activeTab === "head-to-head" ? "active" : ""}`}
              onClick={() => setActiveTab("head-to-head")}
            >
              <Swords size={20} />
              <span>Head-to-Head</span>
            </div>
            <div
              className={`nav-item ${activeTab === "contests" ? "active" : ""}`}
              onClick={() => setActiveTab("contests")}
            >
              <Calendar size={20} />
              <span>Contest Hub</span>
            </div>
            <div
              className={`nav-item ${activeTab === "settings" ? "active" : ""}`}
              onClick={() => setActiveTab("settings")}
            >
              <SettingsIcon size={20} />
              <span>Settings</span>
            </div>
          </div>

          <div
            className="global-filter-section"
            style={{ marginTop: "32px", padding: "0 16px" }}
          >
            <div
              style={{
                fontSize: "var(--font-size-sm)",
                fontWeight: 700,
                color: "var(--text-muted)",
                letterSpacing: "1px",
                textTransform: "uppercase",
                marginBottom: "12px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              Platform Filter (Multi-Select)
              <span
                title="Toggling platforms dynamically filters the active view, recalculating total solved stats, leaderboard rankings, and visible friend accounts."
                style={{
                  cursor: "help",
                  opacity: 0.8,
                  fontSize: "var(--font-size-base)",
                  textTransform: "none",
                }}
              >
                ⓘ
              </span>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              {(activeTab === "sheets" 
                ? [
                    { id: "leetcode", name: "LeetCode", activeBg: "#ffa116" },
                    { id: "codeforces", name: "Codeforces", activeBg: "#3b82f6" },
                    { id: "codechef", name: "CodeChef", activeBg: "#5B4638" },
                    { id: "cses", name: "CSES", activeBg: "#000000" },
                    { id: "gfg", name: "GeeksforGeeks", activeBg: "#2f8d46" },
                  ]
                : [
                    { id: "leetcode", name: "LeetCode", activeBg: "#ffa116" },
                    { id: "codeforces", name: "Codeforces", activeBg: "#3b82f6" },
                    { id: "codechef", name: "CodeChef", activeBg: "#5B4638" },
                  ]
              )
              .filter((p) => !disabledPlatforms.includes(p.id))
              .map((p) => {
                const active = selectedGlobalPlatforms.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedGlobalPlatforms((prev) => {
                        if (prev.includes(p.id)) {
                          const next = prev.filter((x) => x !== p.id);
                          const updated = next.length > 0 ? next : [p.id];
                          chrome.storage.local.set({ selected_global_platforms: updated });
                          return updated;
                        } else {
                          const updated = [...prev, p.id];
                          chrome.storage.local.set({ selected_global_platforms: updated });
                          return updated;
                        }
                      });
                    }}
                    title={`${p.name} (${active ? "Active" : "Inactive"}) - Click to toggle inclusion in dashboard calculations and lists.`}
                    style={{
                      flex: activeTab === "sheets" ? "1 1 calc(33.33% - 8px)" : 1,
                      height: "42px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: active ? p.activeBg : "var(--bg-primary)",
                      border: active
                        ? `1px solid ${p.activeBg}`
                        : "1px solid var(--border-strong)",
                      borderRadius: "0px",
                      cursor: "pointer",
                      opacity: active ? 1 : 0.4,
                      transition: "all 0.2s ease",
                      boxShadow: "none",
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.opacity = "1";
                    }}
                    onMouseOut={(e) => {
                      if (!active) e.currentTarget.style.opacity = "0.4";
                    }}
                  >
                    <PlatformIcon
                      platform={p.id}
                      size={22}
                      monochrome={active ? "white" : false}
                    />
                  </button>
                );
              })}
            </div>
            <div
              style={{
                fontSize: "var(--font-size-sm)",
                color: "var(--text-muted)",
                marginTop: "8px",
                fontStyle: "italic",
              }}
            >
              Click to toggle platforms on/off
            </div>
          </div>
        </div>
        <div className="main-content">
          {activeTab === "overview" && (
            <Overview
              friends={friends}
              profiles={profiles}
              isDarkMode={isDarkMode}
              selectedGlobalPlatforms={selectedGlobalPlatforms}
              allSubmissions={allSubmissions}
              onNavigate={(tab) => setActiveTab(tab as any)}
            />
          )}
          {activeTab === "friends" && (
            <Friends
              friends={friends}
              profiles={profiles}
              isDarkMode={isDarkMode}
              selectedGlobalPlatforms={selectedGlobalPlatforms}
              allSubmissions={allSubmissions}
              onNavigate={(tab) => setActiveTab(tab as any)}
            />
          )}
          {activeTab === "leaderboard" && (
            <Leaderboard
              friends={friends}
              profiles={profiles}
              selectedGlobalPlatforms={selectedGlobalPlatforms}
            />
          )}
          {activeTab === "sheets" && (
            <SheetsTracker
              friends={friends}
              profiles={profiles}
              allSubmissions={allSubmissions}
              selectedGlobalPlatforms={selectedGlobalPlatforms}
            />
          )}
          {activeTab === "head-to-head" && (
            <div
              className="compare-container-dashboard"
              style={{ padding: "24px", maxWidth: "1000px", margin: "0 auto" }}
            >
              <div className="tab-header" style={{ marginBottom: "24px" }}>
                <h2>Head-to-Head Arena (Compare)</h2>
                <p>
                  Select friends to compare their problem solving stats, topic
                  breakdowns, and contest ratings side-by-side.
                </p>
              </div>
              <CompareTab
                friends={friends}
                profiles={profiles}
                isDarkMode={isDarkMode}
                ownUsername={ownUsername}
                ownCodeforcesHandle={ownCodeforcesHandle}
                ownCodechefHandle={ownCodechefHandle}
              />
            </div>
          )}
          {activeTab === "contests" && (
            <ContestHub
              friends={friends}
              profiles={profiles}
              isDarkMode={isDarkMode}
              selectedGlobalPlatforms={selectedGlobalPlatforms}
              ownUsername={ownUsername}
              ownCodeforcesHandle={ownCodeforcesHandle}
              ownCodechefHandle={ownCodechefHandle}
            />
          )}
          {activeTab === "settings" && (
            <div
              className="settings-container-dashboard"
              style={{ padding: "24px", maxWidth: "800px", margin: "0 auto" }}
            >
              <div className="tab-header" style={{ marginBottom: "24px" }}>
                <h2>Global Settings & Sync</h2>
                <p>Fully synchronized with your L'Amigo extension popup.</p>
              </div>
              <SettingsTab
                onSync={loadData}
                isDarkMode={isDarkMode}
                onToggleDarkMode={toggleDarkMode}
                ownUsername={ownUsername}
                onUsernameChange={(val) => {
                  setOwnUsername(val);
                  chrome.storage.local.set({ own_username: val });
                }}
                ownCodeforcesHandle={ownCodeforcesHandle}
                onCodeforcesHandleChange={(val) => {
                  setOwnCodeforcesHandle(val);
                  chrome.storage.local.set({ own_codeforces_handle: val });
                }}
                ownCodechefHandle={ownCodechefHandle}
                onCodechefHandleChange={(val) => {
                  setOwnCodechefHandle(val);
                  chrome.storage.local.set({ own_codechef_handle: val });
                }}
                ownCsesHandle={ownCsesHandle}
                onCsesHandleChange={(val) => {
                  setOwnCsesHandle(val);
                  chrome.storage.local.set({ own_cses_handle: val });
                }}
                onToast={(message, type) => setToast({ message, type })}
                onConfirmAction={requestConfirm}
                onOpenImportExport={() => setShowImportExport(true)}
              />
            </div>
          )}
        </div>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          action={toast.action}
          onClose={() => setToast(null)}
        />
      )}

      <Modal
        isOpen={modal.isOpen}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        onClose={() => setModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={() => {
          if (confirmAction) confirmAction();
          setModal((prev) => ({ ...prev, isOpen: false }));
        }}
      />

      {showImportExport && (
        <ImportExportModal
          isOpen={showImportExport}
          onClose={() => setShowImportExport(false)}
          friends={friends}
          profiles={profiles}
          onFriendsImported={loadData}
          onToast={(message, type) => setToast({ message, type })}
        />
      )}
    </div>
  );
};
