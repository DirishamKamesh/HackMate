import { auth, db, storage } from "./firebase.js";
import {
  collection,
  addDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { createIcons, icons } from "lucide";

export function setupProjects(user) {
  const modal = document.getElementById("upload-modal");
  const openBtn = document.getElementById("open-upload-modal");
  const closeBtn = document.getElementById("close-modal");
  const form = document.getElementById("project-form");
  const submitBtn = document.getElementById("proj-submit");
  const grid = document.getElementById("projects-grid");

  // Drag and Drop Elements
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("proj-image");
  const imagePreview = document.getElementById("image-preview");
  const imageOverlay = document.getElementById("image-overlay");
  const dropZoneContent = document.getElementById("drop-zone-content");

  // Progress Tracker Elements
  const progressContainer = document.getElementById("progress-container");
  const progressBar = document.getElementById("progress-bar");
  const progressText = document.getElementById("progress-text");
  const progressStatus = document.getElementById("progress-status");

  let selectedFile = null;

  // Navigation / Modal Handlers
  openBtn.addEventListener("click", () => {
    modal.classList.remove("hidden");
    resetForm();
  });
  closeBtn.addEventListener("click", () => modal.classList.add("hidden"));

  // --- Drag and Drop Logic ---

  const handleFile = (file) => {
    if (!file) return;

    // Size validation: 5MB max
    if (file.size > 5 * 1024 * 1024) {
      alert("File size exceeds 5MB limit. Please upload a smaller image.");
      fileInput.value = ""; // Reset input
      selectedFile = null;
      return;
    }

    selectedFile = file;

    // FileReader to show preview thumbnail
    const reader = new FileReader();
    reader.onload = (e) => {
      imagePreview.src = e.target.result;
      imagePreview.classList.remove("hidden");
      imageOverlay.classList.remove("hidden");
      dropZoneContent.classList.add("opacity-0"); // Hide default text
    };
    reader.readAsDataURL(file);
  };

  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  });

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("border-primary", "bg-indigo-50");
  });

  dropZone.addEventListener("dragleave", (e) => {
    e.preventDefault();
    dropZone.classList.remove("border-primary", "bg-indigo-50");
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("border-primary", "bg-indigo-50");
    if (e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      // Only allow images
      if (file.type.startsWith("image/")) {
        handleFile(file);
        // Sync with hidden input
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;
      } else {
        alert("Please drop a valid image file (JPEG/PNG).");
      }
    }
  });

  // Reset form helper
  const resetForm = () => {
    form.reset();
    selectedFile = null;
    imagePreview.classList.add("hidden");
    imageOverlay.classList.add("hidden");
    dropZoneContent.classList.remove("opacity-0");
    progressContainer.classList.add("hidden");
    progressBar.style.width = "0%";
    progressText.textContent = "0%";
    submitBtn.disabled = false;
    submitBtn.textContent = "Publish Project";
  };

  // --- Resumable File Upload + Firestore ---

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document.getElementById("proj-title").value;
    const desc = document.getElementById("proj-desc").value;

    if (!selectedFile) {
      alert("Please attach a project screenshot image.");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Uploading...";
    progressContainer.classList.remove("hidden");

    try {
      // Create Storage Reference
      const storageRef = ref(
        storage,
        `projects/${user.uid}/${Date.now()}_${selectedFile.name}`,
      );

      // Resumable upload task
      const uploadTask = uploadBytesResumable(storageRef, selectedFile);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          // Track progress natively
          const progress =
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          progressBar.style.width = progress + "%";
          progressText.textContent = Math.round(progress) + "%";

          switch (snapshot.state) {
            case "paused":
              progressStatus.textContent = "Upload paused";
              break;
            case "running":
              progressStatus.textContent = "Uploading image...";
              break;
          }
        },
        (error) => {
          // Handle Upload Error
          console.error("Storage upload error:", error);
          alert(
            "Failed to upload image. Storage rules may deny access. Detailed Error: " +
              error.message,
          );
          resetForm();
        },
        async () => {
          // Upload complete successfully, get download URL
          progressStatus.textContent = "Processing...";

          const imageUrl = await getDownloadURL(uploadTask.snapshot.ref);

          // Fetch user's community
          const userRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userRef);
          const userData = userSnap.data();

          if (!userData.communityId) {
            alert("You must be in a community to publish projects.");
            return;
          }

          // Save to Firestore Database
          await addDoc(collection(db, "projects"), {
            title,
            description: desc,
            imageUrl: imageUrl,
            authorId: user.uid,
            communityId: userData.communityId, // Added communityId
            likes: 0,
            createdAt: serverTimestamp(),
          });

          // Show success, wait briefly, then close modal
          progressStatus.textContent = "Success!";
          progressBar.classList.replace("bg-primary", "bg-green-500");
          progressText.textContent = "100%";

          setTimeout(() => {
            modal.classList.add("hidden");
            resetForm();
            progressBar.classList.replace("bg-green-500", "bg-primary");
          }, 1000);
        },
      );
    } catch (error) {
      console.error("Error initiating sequence:", error);
      alert("Failed pipeline initialization: " + error.message);
      submitBtn.disabled = false;
      submitBtn.textContent = "Publish Project";
    }
  });

  // Listen to Projects Realtime in user's Community
  const userRef = doc(db, "users", user.uid);
  getDoc(userRef).then(userSnap => {
    const userData = userSnap.data();
    const q = query(
      collection(db, "projects"), 
      where("communityId", "==", userData.communityId),
      orderBy("createdAt", "desc")
    );

    onSnapshot(q, (snapshot) => {
      grid.innerHTML = "";
      if (snapshot.empty) {
        grid.innerHTML =
          '<div class="col-span-full py-12 text-center text-gray-500">No projects showcase yet. Be the first!</div>';
        return;
      }

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const card = document.createElement("div");
        card.className =
          "card group hover:shadow-lg transition-all duration-300 flex flex-col";
        card.innerHTML = `
        <div class="aspect-video w-full bg-gray-100 overflow-hidden relative border-b border-gray-100">
          ${
            data.imageUrl
              ? `<img src="${data.imageUrl}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" alt="${data.title}">`
              : `<div class="w-full h-full flex items-center justify-center bg-indigo-50"><i data-lucide="image" class="w-12 h-12 text-indigo-200"></i></div>`
          }
        </div>
        <div class="p-6 flex flex-col flex-grow">
          <h3 class="text-xl font-bold font-heading text-dark mb-2 group-hover:text-primary transition-colors">${data.title}</h3>
          <p class="text-gray-600 text-sm mb-4 line-clamp-3">${data.description}</p>
          <div class="flex items-center justify-between pt-4 mt-auto border-t border-gray-50">
            <div class="flex items-center space-x-4">
               <button class="flex items-center text-sm text-gray-500 hover:text-red-500 transition-colors">
                  <i data-lucide="heart" class="w-4 h-4 mr-1"></i>
                  ${data.likes || 0}
               </button>
            </div>
            <div class="flex space-x-2">
              <a href="#" class="p-2 text-gray-400 hover:text-dark transition-colors bg-gray-50 hover:bg-gray-100 rounded-lg">
                <i data-lucide="globe" class="w-4 h-4"></i>
              </a>
            </div>
          </div>
        </div>
      `;
        grid.appendChild(card);
      });

      createIcons({ icons });
    },
    (error) => {
      console.error("Error fetching projects snapshot:", error);
      grid.innerHTML =
        '<div class="col-span-full py-12 text-center text-red-500">Error loading projects. Check config.</div>';
    });
  });
}
