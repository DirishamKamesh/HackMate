import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

// Helper to ensure User exists in Firestore
async function ensureUserDocument(user, extraData = {}) {
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) {
    await setDoc(userRef, {
      name: extraData.name || user.displayName || "New User",
      email: user.email || "",
      phone: user.phoneNumber || "",
      skills: [],
      role: "Hacker",
      createdAt: serverTimestamp(),
    });
  }
}

// Redirect Helper
async function finalizeAuth(user, extraData = {}) {
  await ensureUserDocument(user, extraData);
  
  // Check if user has a community
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);
  const userData = userSnap.data();

  if (!userData.communityId) {
    window.location.href = "/pages/community-picker.html";
  } else {
    window.location.href = "/pages/dashboard.html";
  }
}

export function initAuthUI() {
  const urlParams = new URLSearchParams(window.location.search);
  const isSignup = urlParams.get("mode") === "signup";

  const title = document.getElementById("auth-title");
  const toggleText = document.getElementById("auth-toggle-text");
  const toggleLink = document.getElementById("auth-toggle-link");
  const submitBtn = document.getElementById("auth-submit");
  const nameField = document.getElementById("name-field");
  const confirmField = document.getElementById("confirm-field");

  if (!title) return; // Not on auth page

  if (isSignup) {
    nameField.style.display = "block";
    confirmField.style.display = "block";
  } else {
    nameField.style.display = "none";
    confirmField.style.display = "none";
  }

  // standard form (Email/Password)
  const form = document.getElementById("auth-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const name = document.getElementById("name")
      ? document.getElementById("name").value
      : "";

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = "Loading...";

      let userCredential;
      if (isSignup) {
        userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password,
        );
      } else {
        userCredential = await signInWithEmailAndPassword(
          auth,
          email,
          password,
        );
      }
      await finalizeAuth(userCredential.user, { name });
    } catch (error) {
      alert("Error: " + error.message);
      submitBtn.disabled = false;
      submitBtn.textContent = isSignup ? "Sign up" : "Sign in";
    }
  });

  // Google Login
  const googleBtn = document.getElementById("google-btn");
  googleBtn.addEventListener("click", async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      await finalizeAuth(result.user);
    } catch (error) {
      console.error("Google Auth failed:", error);
      alert("Google Sign In Failed");
    }
  });

  // Phone Toggle
  const phoneToggleBtn = document.getElementById("phone-toggle-btn");
  const phoneContainer = document.getElementById("phone-auth-container");
  phoneToggleBtn.addEventListener("click", () => {
    phoneContainer.classList.toggle("hidden");
  });

  // Phone Auth Variables
  let confirmationResult = null;

  // Render Recaptcha
  if (!window.recaptchaVerifier) {
    window.recaptchaVerifier = new RecaptchaVerifier(
      auth,
      "recaptcha-container",
      {
        size: "normal",
      },
    );
  }

  // Send SMS
  const sendCodeBtn = document.getElementById("send-code-btn");
  sendCodeBtn.addEventListener("click", async () => {
    const phone = document.getElementById("phone-input").value;
    if (!phone) {
      alert("Enter a phone number");
      return;
    }
    try {
      confirmationResult = await signInWithPhoneNumber(
        auth,
        phone,
        window.recaptchaVerifier,
      );
      document.getElementById("phone-step-1").classList.add("hidden");
      document.getElementById("phone-step-2").classList.remove("hidden");
      alert("SMS Sent! Check your phone.");
    } catch (error) {
      console.error("SMS failed:", error);
      alert("Failed to send SMS. Ensure Phone Auth is enabled in Firebase.");
    }
  });

  // Verify Code
  const verifyCodeBtn = document.getElementById("verify-code-btn");
  verifyCodeBtn.addEventListener("click", async () => {
    const code = document.getElementById("code-input").value;
    if (!code || !confirmationResult) return;

    try {
      const result = await confirmationResult.confirm(code);
      await finalizeAuth(result.user);
    } catch (error) {
      console.error("OTP failed:", error);
      alert("Invalid code");
    }
  });
}

// Global Auth State Guard (import this on private pages)
export function requireAuth() {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.replace("/pages/auth.html?mode=login");
    } else {
      // Check for community
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        if (!userData.communityId && !window.location.pathname.includes("community-picker")) {
          window.location.replace("/pages/community-picker.html");
        }
      }
    }
  });
}
