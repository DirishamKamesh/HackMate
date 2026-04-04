import { auth, db } from "./firebase.js";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  query,
  where,
} from "firebase/firestore";
import { createIcons, icons } from "lucide";

// Helper for Role Compatibility
function areRolesComplementary(role1, role2) {
  const pairs = [
    ["Frontend", "Backend"],
    ["Backend", "AI / ML"],
    ["Full Stack", "Frontend"],
    ["Full Stack", "Backend"],
    ["Full Stack", "AI / ML"],
    ["Full Stack", "UI/UX"],
    ["UI/UX", "Frontend"],
  ];
  return pairs.some(
    (p) =>
      (p[0] === role1 && p[1] === role2) || (p[0] === role2 && p[1] === role1),
  );
}

// Helper for Experience Compatibility
function areExpAdjacent(exp1, exp2) {
  if (exp1 === exp2) return false;
  const levels = ["Beginner", "Intermediate", "Advanced"];
  const i1 = levels.indexOf(exp1);
  const i2 = levels.indexOf(exp2);
  return Math.abs(i1 - i2) === 1;
}

// The AI Scoring Engine
export function calculateAIMatchScore(currentUser, targetUser) {
  let score = 0;
  const reasons = [];
  const commonSkills = [];

  // 1. Skill Overlap (+50 max)
  const userSkills = currentUser.skills || [];
  const targetSkills = targetUser.skills || [];
  const matches = userSkills.filter((s) =>
    targetSkills.some((ts) => ts.toLowerCase() === s.toLowerCase()),
  );

  if (matches.length >= 2) {
    score += 50;
    reasons.push(`You both know ${matches.slice(0, 2).join(" & ")}`);
  } else if (matches.length === 1) {
    score += 25;
    reasons.push(`Shared skill: ${matches[0]}`);
  }
  
  matches.forEach(m => commonSkills.push(m));

  // 2. Role Compatibility (+30 max)
  if (currentUser.role && targetUser.role) {
    if (areRolesComplementary(currentUser.role, targetUser.role)) {
      score += 30;
      reasons.push(`Complementary roles (${currentUser.role} + ${targetUser.role})`);
    } else if (currentUser.role === targetUser.role) {
      score += 15;
      reasons.push(`You share the same role focus`);
    }
  }

  // 3. Experience Level (+20 max)
  if (currentUser.experience && targetUser.experience) {
    if (currentUser.experience === targetUser.experience) {
      score += 20;
      reasons.push(`Matched experience levels (${currentUser.experience})`);
    } else if (areExpAdjacent(currentUser.experience, targetUser.experience)) {
      score += 15;
      reasons.push(`Compatible experience levels`);
    }
  }

  // 4. Hackathon Goals (+10 max)
  if (currentUser.goal && targetUser.goal && currentUser.goal === targetUser.goal) {
    score += 10;
    reasons.push(`Shared goal: ${currentUser.goal}`);
  }

  // 5. High-Value Skill Bonus (+10)
  const highValue = ["React", "Node.js", "AI"];
  const hasHighValue = targetSkills.some(s => highValue.some(hv => s.toLowerCase().includes(hv.toLowerCase())));
  if (hasHighValue) {
    score += 10;
  }

  return {
    score: Math.min(100, score),
    reasons,
    commonSkills
  };
}

// Persistence for Favorites
export async function toggleFavorite(userId, targetId, isCurrentlyFavorited) {
  const userRef = doc(db, "users", userId);
  try {
    await updateDoc(userRef, {
      favorites: isCurrentlyFavorited ? arrayRemove(targetId) : arrayUnion(targetId)
    });
    return true;
  } catch (e) {
    console.error("Favorite toggle failed:", e);
    return false;
  }
}

export async function loadTeammates(currentUser, filters = {}) {
  const grid = document.getElementById("teammates-grid");
  const loader = document.getElementById("ai-loader");
  const loaderText = document.getElementById("loader-text");

  if (!currentUser) return;

  try {
    // Show AI Loading Sequence (only if not a quick filter update)
    const isInitialLoad = Object.keys(filters).length === 0 || grid.innerHTML.includes('Initializing');
    if (isInitialLoad && loader && loaderText) {
      loader.classList.remove("hidden");
      const loaderBar = document.getElementById("loader-bar");
      const steps = [
        "Analyzing your technical profile...",
        "Evaluating role compatibility...",
        "Scanning active community...",
        "Finalizing best matches..."
      ];
      let progress = 0;
      for (const step of steps) {
        loaderText.textContent = step;
        progress += 25;
        if (loaderBar) loaderBar.style.width = `${progress}%`;
        await new Promise(r => setTimeout(r, 600));
      }
    }

    // 1. Get Current User Data
    const meSnap = await getDoc(doc(db, "users", currentUser.uid));
    if (!meSnap.exists()) return;
    const me = meSnap.data();
    const myFavorites = me.favorites || [];

    if (!me.skills || me.skills.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full py-20 text-center bg-white rounded-[32px] border border-slate-100 shadow-sm">
          <div class="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <i data-lucide="user-plus" class="w-8 h-8 text-indigo-600"></i>
          </div>
          <h3 class="text-xl font-bold text-slate-900 mb-2">Matrix Incomplete</h3>
          <p class="text-slate-400 mb-8 max-w-xs mx-auto font-medium">Your profile needs more data points to unlock Neural Matching.</p>
          <a href="/pages/profile.html" class="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200">Initialize Profile Hub</a>
        </div>
      `;
      if (loader) loader.classList.add("hidden");
      createIcons({ icons });
      return;
    }

    // 2. Fetch Only users in the same Community
    if (!me.communityId) {
        console.error("No community assigned to user.");
        grid.innerHTML = '<div class="col-span-full py-20 text-center">Please join a community first.</div>';
        return;
    }

    // Update Header with Community Name
    const headerTitle = document.getElementById("header-community-name");
    if (headerTitle && me.communityName) {
        headerTitle.textContent = me.communityName;
    }

    const q = query(collection(db, "users"), where("communityId", "==", me.communityId));
    const snap = await getDocs(q);

    let matches = [];
    snap.forEach(docSnap => {
      if (docSnap.id === currentUser.uid) return;
      const target = docSnap.data();

      // Apply Filters
      if (filters.role && target.role !== filters.role) return;
      if (filters.experience && target.experience !== filters.experience) return;
      if (filters.search) {
        const search = filters.search.toLowerCase();
        const hasSkill = (target.skills || []).some(s => s.toLowerCase().includes(search));
        const hasName = (target.name || "").toLowerCase().includes(search);
        if (!hasSkill && !hasName) return;
      }

      const analysis = calculateAIMatchScore(me, target);
      
      matches.push({
        id: docSnap.id,
        ...target,
        ...analysis,
        isFavorited: myFavorites.includes(docSnap.id)
      });
    });

    // 3. Sort by score
    matches.sort((a, b) => b.score - a.score);

    // 4. Render
    grid.innerHTML = "";
    if (matches.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full py-32 text-center">
            <p class="text-slate-300 font-black uppercase tracking-[0.2em] text-xs">No Compatible Entities Found</p>
        </div>
      `;
    } else {
      matches.forEach((user, index) => {
        const isTopMatch = index === 0 && user.score > 70;
        const card = document.createElement("div");
        card.className = `bg-white rounded-[32px] p-8 flex flex-col border-2 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 relative cursor-pointer ${isTopMatch ? 'border-indigo-600' : 'border-slate-50'}`;
        
        const badgeStyle = user.score >= 80 ? 'bg-green-50 text-green-600' : (user.score >= 50 ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-400');
        const initials = (user.name || 'H').charAt(0).toUpperCase();

        card.innerHTML = `
          ${isTopMatch ? '<div class="absolute -top-3.5 left-8 px-4 py-1 bg-indigo-600 text-white text-[10px] font-black rounded-full shadow-lg shadow-indigo-600/30 tracking-widest">TOP MATCH 🔥</div>' : ''}
          
          <button class="fav-btn absolute top-6 right-6 p-2 rounded-full hover:bg-slate-50 transition-colors" data-id="${user.id}">
             <i data-lucide="heart" class="w-5 h-5 ${user.isFavorited ? 'fill-red-500 text-red-500' : 'text-slate-200'}"></i>
          </button>

          <div class="flex items-center mb-8">
            <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center mr-4 shrink-0 shadow-lg shadow-indigo-500/10">
               <span class="text-xl font-bold text-white">${initials}</span>
            </div>
            <div class="overflow-hidden">
              <h3 class="font-black text-slate-900 text-lg truncate">${user.name || 'Anonymous Hacker'}</h3>
              <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">${user.role || 'Entity'} · ${user.experience || 'Junior'}</p>
            </div>
          </div>

          <div class="space-y-6 flex-grow">
            <div class="${badgeStyle} flex items-center justify-between px-4 py-3 rounded-2xl">
               <span class="text-xs font-black uppercase tracking-tight">AI Compatibility</span>
               <span class="text-lg font-black">${user.score}%</span>
            </div>

            <div>
               <p class="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-3">Matching Logic</p>
               <ul class="space-y-2">
                  ${user.reasons.slice(0, 3).map(r => `
                    <li class="text-[11px] text-slate-600 font-semibold flex items-center">
                        <i data-lucide="check" class="w-3.5 h-3.5 text-indigo-500 mr-2.5"></i>
                        ${r}
                    </li>
                  `).join('')}
               </ul>
            </div>

            <div class="pt-2">
               <p class="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-3">Sync Skills</p>
               <div class="flex flex-wrap gap-2">
                  ${(user.skills || []).slice(0, 4).map(s => {
                    const isCommon = me.skills.some(ms => ms.toLowerCase() === s.toLowerCase());
                    return `
                        <span class="px-3 py-1.5 ${isCommon ? 'bg-indigo-50 text-indigo-600 border-indigo-100/50' : 'bg-slate-50 text-slate-500 border-transparent'} border rounded-xl text-[10px] font-bold flex items-center">
                          ${s} ${isCommon ? '<i data-lucide="sparkles" class="w-3 h-3 ml-1.5 opacity-50"></i>' : ''}
                        </span>`;
                  }).join('')}
               </div>
            </div>
          </div>

          <button class="message-btn mt-8 w-full py-4 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-indigo-700 transition-all active:scale-95 shadow-xl shadow-indigo-600/20" data-id="${user.id}">
            Initialize Neural Chat
          </button>
        `;
        grid.appendChild(card);
      });

      // Events
      document.querySelectorAll(".fav-btn").forEach(btn => {
        btn.onclick = async () => {
          const id = btn.dataset.id;
          const isFav = btn.querySelector('svg').classList.contains('fill-red-500');
          const success = await toggleFavorite(currentUser.uid, id, isFav);
          if (success) {
            const icon = btn.querySelector('svg');
            icon.classList.toggle('fill-red-500');
            icon.classList.toggle('text-red-500');
            icon.classList.toggle('text-gray-300');
          }
        };
      });

      document.querySelectorAll(".message-btn").forEach(btn => {
        btn.onclick = () => {
          const partnerId = btn.dataset.id;
          window.location.href = `/pages/messages.html?partner=${partnerId}`;
        };
      });
    }

    createIcons({ icons });
    if (loader) loader.classList.add("hidden");

  } catch (error) {
    console.error("Matching Error:", error);
    if (loader) loader.classList.add("hidden");
  }
}
