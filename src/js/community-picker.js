import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import { 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc, 
    collection, 
    query, 
    where, 
    getDocs, 
    serverTimestamp 
} from "firebase/firestore";
import { createIcons, icons } from "lucide";

// Ensure Lucide icons are rendered
createIcons({ icons });

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace("/pages/auth.html?mode=login");
    }
});

const joinBtn = document.getElementById("join-btn");
const createBtn = document.getElementById("create-btn");
const joinCodeInput = document.getElementById("join-code");
const newNameInput = document.getElementById("new-name");
const joinError = document.getElementById("join-error");
const createError = document.getElementById("create-error");

// JOIN COMMUNITY
joinBtn.addEventListener("click", async () => {
    const code = joinCodeInput.value.trim().toUpperCase();
    if (!code) return;

    try {
        joinBtn.disabled = true;
        joinBtn.textContent = "VERIFYING...";
        joinError.classList.add("hidden");

        // Simple lookup: check if a community with this name or ID exists
        // For MVP, we'll assume the code is the community's document ID or name
        const q = query(collection(db, "communities"), where("name", "==", code));
        const snap = await getDocs(q);

        let communityData = null;
        let communityId = null;

        if (!snap.empty) {
            communityId = snap.docs[0].id;
            communityData = snap.docs[0].data();
        } else {
            // Check by ID directly
            const directRef = doc(db, "communities", code);
            const directSnap = await getDoc(directRef);
            if (directSnap.exists()) {
                communityId = code;
                communityData = directSnap.data();
            }
        }

        if (communityId) {
            // Update user
            const user = auth.currentUser;
            await updateDoc(doc(db, "users", user.uid), {
                communityId: communityId,
                communityName: communityData.name
            });
            window.location.href = "/pages/dashboard.html";
        } else {
            joinError.textContent = "Community Code Not Found";
            joinError.classList.remove("hidden");
            joinBtn.disabled = false;
            joinBtn.textContent = "Access Community";
        }
    } catch (error) {
        console.error("Join failed:", error);
        joinError.textContent = "Error: " + error.message;
        joinError.classList.remove("hidden");
        joinBtn.disabled = false;
        joinBtn.textContent = "Access Community";
    }
});

// CREATE COMMUNITY
createBtn.addEventListener("click", async () => {
    const name = newNameInput.value.trim();
    if (!name) return;

    try {
        createBtn.disabled = true;
        createBtn.textContent = "LAUNCHING...";
        createError.classList.add("hidden");

        const user = auth.currentUser;
        const communityId = name.toLowerCase().replace(/\s+/g, '-');
        
        // Check if exists
        const checkRef = doc(db, "communities", communityId);
        const checkSnap = await getDoc(checkRef);
        if (checkSnap.exists()) {
            createError.textContent = "A community with this name already exists.";
            createError.classList.remove("hidden");
            createBtn.disabled = false;
            createBtn.textContent = "Launch Infrastructure";
            return;
        }

        // Create community
        await setDoc(doc(db, "communities", communityId), {
            name: name,
            creatorId: user.uid,
            createdAt: serverTimestamp(),
            stats: { users: 1, teams: 0, projects: 0 }
        });

        // Update user
        await updateDoc(doc(db, "users", user.uid), {
            communityId: communityId,
            communityName: name
        });

        window.location.href = "/pages/dashboard.html";
    } catch (error) {
        console.error("Creation failed:", error);
        createError.textContent = "Error: " + error.message;
        createError.classList.remove("hidden");
        createBtn.disabled = false;
        createBtn.textContent = "Launch Infrastructure";
    }
});
