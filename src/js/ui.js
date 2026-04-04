import { auth, db } from "./firebase.js";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { createIcons, icons } from "lucide";

export function renderNavbar(isAuthPage = false) {
  const navContainer = document.getElementById("navbar-container");
  if (!navContainer || isAuthPage) return;

  navContainer.innerHTML = `
    <nav class="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex items-center">
            <a href="/" class="flex items-center gap-3 group">
              <div class="w-10 h-10 flex items-center justify-center p-0.5 transition-transform duration-500 group-hover:scale-110">
                <img src="/logo.jpeg" alt="HackMate" class="w-full h-full object-contain" />
              </div>
              <span class="font-heading font-black text-xl text-slate-900 tracking-tighter">Hack<span class="text-indigo-600">Mate</span></span>
            </a>
            
            <div id="community-badge-container" class="ml-6 hidden md:flex items-center">
                <div class="h-4 w-px bg-slate-200 mr-6"></div>
                <div class="flex items-center bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100/50">
                    <i data-lucide="shield-check" class="w-3 h-3 text-indigo-600 mr-2"></i>
                    <span id="nav-community-name" class="text-[10px] font-black uppercase tracking-widest text-indigo-700">Loading Community...</span>
                    <a href="/pages/community-picker.html" class="ml-3 hover:text-slate-900 text-indigo-400">
                        <i data-lucide="refresh-cw" class="w-3 h-3"></i>
                    </a>
                </div>
            </div>
          </div>
          <div class="flex items-center space-x-6">
            <a href="/pages/dashboard.html" class="text-slate-600 hover:text-indigo-600 transition-colors text-xs font-black uppercase tracking-widest">Dashboard</a>
            <a href="/pages/find-teammates.html" class="text-slate-600 hover:text-indigo-600 transition-colors text-xs font-black uppercase tracking-widest">Community</a>
            <a href="/pages/teams.html" class="text-slate-600 hover:text-indigo-600 transition-colors text-xs font-black uppercase tracking-widest">Teams</a>
            <div class="h-6 w-px bg-slate-100 mx-2"></div>
            <a href="/pages/profile.html" class="flex items-center justify-center w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-all">
                <i data-lucide="user" class="w-4 h-4 text-slate-600"></i>
            </a>
          </div>
        </div>
      </div>
    </nav>
  `;

  // Fetch community name dynamically
  onAuthStateChanged(auth, async (user) => {
      if (user) {
          const userSnap = await getDoc(doc(db, "users", user.uid));
          if (userSnap.exists()) {
              const data = userSnap.data();
              const badgeCont = document.getElementById("community-badge-container");
              const nameEl = document.getElementById("nav-community-name");
              if (data.communityName && nameEl) {
                  nameEl.textContent = data.communityName;
                  badgeCont.classList.remove("hidden");
              }
          }
          createIcons({ icons });
      }
  });
}

export function renderSidebar(activePath) {
  const sidebarContainer = document.getElementById("sidebar-container");
  if (!sidebarContainer) return;

  const navItems = [
    { icon: "layout-dashboard", label: "Overview", path: "/pages/dashboard.html" },
    {
      icon: "user-plus",
      label: "Find Teammates",
      path: "/pages/find-teammates.html",
    },
    { icon: "users", label: "Teams", path: "/pages/teams.html" },
    { icon: "message-square", label: "Messages", path: "/pages/messages.html" },
    { icon: "target", label: "Daily Challenge", path: "/pages/daily-challenge.html" },
    { icon: "trophy", label: "Leaderboard", path: "/pages/leaderboard.html" },
    { icon: "folder-git-2", label: "Projects", path: "/pages/projects.html" },
  ];

  const renderLinks = navItems
    .map((item) => {
      const isActive = activePath.includes(item.path);
      return `
      <a
        href="${item.path}"
        class="flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
          isActive
            ? "bg-indigo-50 text-primary"
            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
        }"
      >
        <i data-lucide="${item.icon}" class="w-5 h-5 mr-3"></i>
        ${item.label}
      </a>
    `;
    })
    .join("");

  sidebarContainer.innerHTML = `
    <div class="w-64 bg-white border-r border-gray-100 h-[calc(100vh-4rem)] flex flex-col hidden md:flex sticky top-16">
      <div class="py-6 px-4 flex-1">
        <div class="space-y-1">
          ${renderLinks}
        </div>
      </div>
      <div class="p-4 border-t border-gray-100">
        <a
            href="/pages/profile.html"
            class="flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          >
            <i data-lucide="settings" class="w-5 h-5 mr-3"></i>
            Settings
        </a>
      </div>
    </div>
  `;
}

// Global script execution
export function initUI(
  isAuthPage = false,
  activePath = window.location.pathname,
) {
  renderNavbar(isAuthPage);
  renderSidebar(activePath);
  createIcons({ icons });
}
