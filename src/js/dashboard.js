import { auth, db } from "./firebase.js";
import { doc, getDoc } from "firebase/firestore";

export async function loadDashboard() {
  const user = auth.currentUser;
  if (!user) return; // Guarded by requireAuth() usually

  // Elements
  const nameEl = document.getElementById("user-name");
  const roleEl = document.getElementById("user-role");

  try {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      nameEl.textContent = data.name || user.email;
      roleEl.textContent = data.role || "New Explorer";
      
      const commEl = document.getElementById("user-community");
      if (commEl) commEl.textContent = `Active Community: ${data.communityName || 'None'}`;
    } else {
      nameEl.textContent = user.email;
      roleEl.textContent = "Welcome User";
    }
  } catch (error) {
    console.error("Failed to load user data:", error);
    nameEl.textContent = user.email;
  }
}
