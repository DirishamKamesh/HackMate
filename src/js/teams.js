import { auth, db } from "./firebase.js";
import {
  collection,
  addDoc,
  onSnapshot,
  doc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
} from "firebase/firestore";
import { createIcons, icons } from "lucide";

export function setupTeams(user) {
  const modal = document.getElementById("team-modal");
  const openBtn = document.getElementById("create-team-btn");
  const closeBtn = document.getElementById("close-team-modal");
  const form = document.getElementById("team-form");
  const grid = document.getElementById("teams-grid");

  openBtn.addEventListener("click", () => modal.classList.remove("hidden"));
  closeBtn.addEventListener("click", () => modal.classList.add("hidden"));

  // Create Team Logic
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("team-name").value;
    const skillsParam = document.getElementById("team-skills").value;
    const capacity = parseInt(document.getElementById("team-capacity").value);

    // Parse skills
    const requiredSkills = skillsParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.data();

      if (!userData.communityId) {
        alert("You must be in a community to create a team.");
        return;
      }

      await addDoc(collection(db, "teams"), {
        name,
        creatorId: user.uid,
        communityId: userData.communityId, // Added communityId
        members: [user.uid], // Creator is first member
        requiredSkills,
        maxCapacity: capacity,
        createdAt: serverTimestamp(),
      });
      modal.classList.add("hidden");
      form.reset();
    } catch (error) {
      console.error("Error creating team:", error);
      alert("Failed to create team");
    }
  });

  // Fetch and Listen to Teams in user's Community
  const userRef = doc(db, "users", user.uid);
  getDoc(userRef).then(userSnap => {
    const userData = userSnap.data();
    const q = query(collection(db, "teams"), where("communityId", "==", userData.communityId));
    
    onSnapshot(q, (snapshot) => {
      grid.innerHTML = "";
      if (snapshot.empty) {
        grid.innerHTML =
          '<div class="col-span-full py-12 text-center text-gray-500 font-medium">No teams formed in this community yet.</div>';
        return;
      }

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const isMember = (data.members || []).includes(user.uid);
        const isFull = (data.members || []).length >= data.maxCapacity;

        const skillsHTML = (data.requiredSkills || [])
          .slice(0, 3)
          .map((skill) => `<span class="badge-gray">${skill}</span>`)
          .join("");
        const extraSkills =
          data.requiredSkills?.length > 3
            ? `<span class="badge-gray">+${data.requiredSkills.length - 3}</span>`
            : "";

        const card = document.createElement("div");
        card.className =
          "card p-6 flex flex-col hover:border-indigo-200 transition-colors";
        card.innerHTML = `
        <div class="flex items-start justify-between mb-4">
          <div>
            <h3 class="text-xl font-bold font-heading text-dark mb-1">${data.name}</h3>
            <p class="text-sm text-gray-500 flex items-center">
              <i data-lucide="users" class="w-4 h-4 mr-1"></i>
              ${(data.members || []).length} / ${data.maxCapacity} Members
            </p>
          </div>
          ${isFull && !isMember ? `<span class="badge-accent bg-red-100 text-red-800">Full</span>` : ""}
          ${isMember ? `<span class="badge-accent">Joined</span>` : ""}
        </div>

        <div class="mb-6 flex-grow">
          <p class="text-xs font-semibold text-gray-500 tracking-wider mb-2">LOOKING FOR</p>
          <div class="flex flex-wrap gap-2">
            ${skillsHTML}
            ${extraSkills}
          </div>
        </div>

        ${
          !isMember && !isFull
            ? `
           <button class="join-btn btn-primary w-full" data-teamid="${docSnap.id}">
             Request to Join
           </button>
        `
            : ""
        }
        ${
          isMember
            ? `
           <button class="btn-outline w-full" disabled>
             You are in this team
           </button>
        `
            : ""
        }
      `;
        grid.appendChild(card);
      });

      // Wire up Join buttons
      const joinBtns = document.querySelectorAll(".join-btn");
      joinBtns.forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const teamId = e.target.getAttribute("data-teamid");
          e.target.disabled = true;
          e.target.textContent = "Joining...";
          try {
            await updateDoc(doc(db, "teams", teamId), {
              members: arrayUnion(user.uid),
            });
            // Optimistically handled by onSnapshot
          } catch (error) {
            console.error("Error joining team:", error);
            alert("Failed to join team.");
            e.target.disabled = false;
            e.target.textContent = "Request to Join";
          }
        });
      });

      createIcons({ icons });
    },
    (error) => {
      console.error("Teams listener error:", error);
    });
  });
}
