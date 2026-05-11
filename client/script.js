const API_URL = ""; 

const postForm = document.getElementById("postForm");
const postInput = document.getElementById("postInput");
const postsList = document.getElementById("feedPosts");
const profileContainer = document.getElementById("profileContent");
const feedbackMessage = document.getElementById("feedbackMessage");
const sendButton = postForm ? postForm.querySelector(".send") : null;
const imageInput = document.getElementById("imageInput");
const pickImageButton = document.getElementById("pickImageButton");
const imagePreviewBox = document.getElementById("imagePreviewBox");
const imagePreview = document.getElementById("imagePreview");
const removeImageButton = document.getElementById("removeImageButton");

// Views
const feedView = document.getElementById("feedView");
const profileView = document.getElementById("profileView");

// Nav
const navFeed = document.getElementById("navFeed");
const navProfile = document.getElementById("navProfile");

// Modal Elements
const imageModal = document.getElementById("imageModal");
const modalImage = document.getElementById("modalImage");
const modalClose = document.getElementById("modalClose");

// Auth UI Elements
const userNameDisplay = document.getElementById("userNameDisplay");
const userHandleDisplay = document.getElementById("userHandleDisplay");
const userEmojiLarge = document.getElementById("userEmojiLarge");
const userEmojiMini = document.getElementById("userEmojiMini");
const logoutBtn = document.getElementById("logoutBtn");
const loginLink = document.getElementById("loginLink");

let isPosting = false;
let currentUser = null;
const pendingPostActions = new Set();
let selectedImageFile = null;
let selectedImagePreviewUrl = "";

function showFeedback(message, type = "info") {
  if (!feedbackMessage) return;
  feedbackMessage.textContent = message;
  feedbackMessage.className = `feedback-message ${type}`;
  if (!message) return;
  setTimeout(() => {
    if (feedbackMessage.textContent === message) {
      feedbackMessage.textContent = "";
      feedbackMessage.className = "feedback-message";
    }
  }, 2200);
}

function setPostFormState(loading) {
  if (!sendButton) return;
  isPosting = loading;
  sendButton.disabled = loading;
  sendButton.textContent = loading ? "..." : "Post";
}

async function getErrorMessage(response, fallbackMessage) {
  try {
    const data = await response.json();
    return data.error || fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

function updateImagePreview(file) {
  if (selectedImagePreviewUrl) {
    URL.revokeObjectURL(selectedImagePreviewUrl);
    selectedImagePreviewUrl = "";
  }
  if (!file) {
    imagePreview.src = "";
    imagePreviewBox.classList.add("hidden");
    return;
  }
  selectedImagePreviewUrl = URL.createObjectURL(file);
  imagePreview.src = selectedImagePreviewUrl;
  imagePreviewBox.classList.remove("hidden");
}

function updateAuthUI() {
  if (currentUser) {
    userNameDisplay.textContent = currentUser.username;
    userHandleDisplay.textContent = `@${currentUser.username.toLowerCase()}`;
    userEmojiLarge.textContent = currentUser.emoji;
    if (userEmojiMini) userEmojiMini.textContent = currentUser.emoji;
    logoutBtn.classList.remove("hidden");
    loginLink.classList.add("hidden");
  } else {
    userNameDisplay.textContent = "Profile";
    userHandleDisplay.textContent = "@anonymous";
    userEmojiLarge.textContent = "👤";
    if (userEmojiMini) userEmojiMini.textContent = "👻";
    logoutBtn.classList.add("hidden");
    loginLink.classList.remove("hidden");
  }
}

async function fetchCurrentUser() {
  try {
    const res = await fetch("/auth/me");
    if (res.ok) {
      const data = await res.json();
      currentUser = data.user;
    } else {
      currentUser = null;
    }
    updateAuthUI();
  } catch (err) {
    currentUser = null;
    updateAuthUI();
  }
}

function createPostElement(post) {
  const postElement = document.createElement("article");
  postElement.className = "post";
  postElement.dataset.postId = String(post.id);

  const createdAt = post.created_at
    ? new Date(post.created_at).toLocaleString()
    : "Just now";

  const displayEmoji = post.emoji || "👻";
  const displayUser = post.username || "anonymous";
  const isOwner = currentUser && post.user_id === currentUser.id;

  postElement.innerHTML = `
    <div class="post-head">
      <div class="mini-avatar" style="cursor:pointer" data-user-id="${post.user_id}">${displayEmoji}</div>
      <div class="post-user-info" style="cursor:pointer" data-user-id="${post.user_id}">
        <h3>${displayUser}</h3>
        <span class="meta">${createdAt}</span>
      </div>
      <div style="color: #444; font-size: 18px;">⋯</div>
    </div>
    <div class="post-body"></div>
    <img class="post-image hidden" alt="Post image" />
    <footer class="post-foot">
      <span class="action-like ${post.has_liked ? "liked" : ""}" style="cursor:pointer">❤ <span class="likes-count">${post.likes || 0}</span></span>
      <span>💬 0</span>
      <span>🔄 0</span>
      ${isOwner ? '<button class="action-delete" style="background:none; border:0; color:#444; cursor:pointer; font-size:12px; margin-left:auto;">Delete</button>' : ""}
    </footer>
  `;

  // Go to profile on avatar/name click
  postElement.querySelectorAll('[data-user-id]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const uid = el.dataset.userId;
      // Safety check for legacy posts, anonymous, or deleted users
      if (uid && uid !== "null" && uid !== "undefined" && displayUser !== "anonymous") {
         showProfile(uid);
      } else {
         showFeedback("This is an anonymous or deleted user.", "info");
      }
    });
  });

  const postImageElement = postElement.querySelector(".post-image");
  if (post.image_path) {
    postImageElement.src = `${API_URL}${post.image_path}`;
    postImageElement.classList.remove("hidden");
    postImageElement.addEventListener("click", (e) => {
      e.stopPropagation();
      modalImage.src = postImageElement.src;
      imageModal.classList.add("show");
    });
  }

  postElement.querySelector(".post-body").textContent = post.content;
  return postElement;
}

async function loadFeed() {
  try {
    const response = await fetch(`${API_URL}/posts`);
    if (!response.ok) throw new Error("Load failed");
    const posts = await response.json();
    
    postsList.innerHTML = "";
    posts.forEach((post) => {
      postsList.appendChild(createPostElement(post));
    });
  } catch (error) {
    showFeedback("Could not load posts.", "error");
  }
}

async function showProfile(userId) {
  console.log("Loading profile for user:", userId);
  if (!userId) {
    showFeedback("Invalid User ID", "error");
    return;
  }
  feedView.classList.add("hidden");
  profileView.classList.remove("hidden");
  navFeed.classList.remove("active");
  navProfile.classList.add("active");

  profileContainer.innerHTML = `<div style="padding: 40px; color: var(--muted);">Loading profile...</div>`;

  try {
    const userRes = await fetch(`/auth/users/${userId}`);
    console.log("Profile fetch status:", userRes.status);
    if (!userRes.ok) throw new Error("User not found");
    const userData = (await userRes.json()).user;

    const postsRes = await fetch(`/posts/user/${userId}`);
    const userPosts = await postsRes.json();

    const isMe = currentUser && String(currentUser.id) === String(userId);
    const regDate = new Date(userData.created_at || Date.now()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    profileContainer.innerHTML = `
      <div class="profile-header">
        <div class="profile-banner">
          <div style="position: absolute; bottom: 20px; right: 20px;">
             <button class="btn-pill btn-secondary">🎨 Theme</button>
          </div>
        </div>
        <div class="profile-avatar-area">
          <div class="large-avatar-wrap">
            <div class="large-avatar">${userData.emoji}</div>
            <div class="status-indicator"></div>
          </div>
          <div class="profile-actions">
            ${isMe 
              ? '<button class="btn-pill btn-edit">Edit Profile</button><button class="btn-pill btn-secondary">Settings</button>' 
              : '<button class="btn-pill btn-follow">Follow</button><button class="btn-pill btn-secondary">Message</button>'}
          </div>
        </div>
      </div>
      
      <div class="profile-info">
        <h2>${userData.username} <span style="color: #6366f1; font-size: 18px;">✔</span></h2>
        <p class="handle">@${userData.username.toLowerCase()}</p>
        
        <div class="profile-stats">
          <span><b>0</b> followers</span>
          <span><b>0</b> following</span>
        </div>
        
        <div class="profile-meta">
          <span>📅 Registered: ${regDate}</span>
        </div>
      </div>

      <div class="profile-tabs">
        <div class="tabs" style="justify-content: flex-start; background: transparent; padding: 0; border: 0;">
           <button class="tab active" style="padding-left:0">Posts</button>
           <button class="tab">Likes</button>
        </div>
      </div>

      <div id="profilePosts" class="feed-content" style="padding: 24px 40px;"></div>
    `;

    const profilePosts = document.getElementById("profilePosts");
    if (userPosts.length === 0) {
      profilePosts.innerHTML = `<p style="color: var(--muted); text-align: center; padding: 40px;">No posts yet.</p>`;
    } else {
      userPosts.forEach(post => {
        profilePosts.appendChild(createPostElement(post));
      });
    }

  } catch (err) {
    profileContainer.innerHTML = `
      <div style="padding: 100px 40px; text-align: center;">
        <h2 style="font-size: 24px; margin-bottom: 16px; color: #fff;">Profile Unavailable</h2>
        <p style="color: var(--muted); margin-bottom: 32px;">This user might have been deleted or never existed.</p>
        <button class="btn-pill btn-edit" onclick="showFeed()">Return to Feed</button>
      </div>
    `;
  }
}

function showFeed() {
  feedView.classList.remove("hidden");
  profileView.classList.add("hidden");
  navFeed.classList.add("active");
  navProfile.classList.remove("active");
  loadFeed();
}

if (postForm) {
  postForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentUser) { window.location.href = "login.html"; return; }
    if (isPosting) return;

    const content = postInput.value.trim();
    if (!content && !selectedImageFile) return;

    setPostFormState(true);
    try {
      const formData = new FormData();
      formData.append("content", content);
      if (selectedImageFile) formData.append("image", selectedImageFile);

      const response = await fetch(`${API_URL}/posts`, {
        method: "POST",
        body: formData
      });

      if (response.status === 401) { window.location.href = "login.html"; return; }
      if (!response.ok) throw new Error(await getErrorMessage(response, "Error"));

      postInput.value = "";
      selectedImageFile = null;
      if (imageInput) imageInput.value = "";
      updateImagePreview(null);
      await loadFeed();
    } catch (error) {
      showFeedback(error.message, "error");
    } finally {
      setPostFormState(false);
    }
  });
}

if (pickImageButton) pickImageButton.addEventListener("click", () => imageInput.click());
if (imageInput) {
  imageInput.addEventListener("change", () => {
    const file = imageInput.files && imageInput.files[0];
    if (file && file.type.startsWith("image/")) {
      selectedImageFile = file;
      updateImagePreview(file);
    }
  });
}
if (removeImageButton) {
  removeImageButton.addEventListener("click", () => {
    selectedImageFile = null;
    imageInput.value = "";
    updateImagePreview(null);
  });
}

logoutBtn.addEventListener("click", async () => {
  const res = await fetch("/auth/logout", { method: "POST" });
  if (res.ok) window.location.reload();
});

navFeed.addEventListener("click", (e) => { e.preventDefault(); showFeed(); });
navProfile.addEventListener("click", (e) => { 
  e.preventDefault(); 
  if (currentUser) showProfile(currentUser.id); 
  else window.location.href = "login.html";
});

// Modal Close logic
modalClose.addEventListener("click", () => imageModal.classList.remove("show"));
imageModal.addEventListener("click", (e) => {
  if (e.target === imageModal) imageModal.classList.remove("show");
});

// Global Event for Post Actions
document.addEventListener("click", async (event) => {
  const likeBtn = event.target.closest(".action-like");
  const deleteButton = event.target.closest(".action-delete");
  const postElement = event.target.closest(".post");
  
  if (!postElement) return;
  const postId = postElement.dataset.postId;

  // HANDLE LIKES
  if (likeBtn) {
    if (!currentUser) { window.location.href = "login.html"; return; }
    if (pendingPostActions.has(`like-${postId}`)) return;
    pendingPostActions.add(`like-${postId}`);

    try {
      const res = await fetch(`${API_URL}/posts/${postId}/like`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        const count = postElement.querySelector(".likes-count");
        if (count) count.textContent = data.likes;
        likeBtn.classList.add("liked");
        showFeedback("Liked!", "success");
      } else {
        const err = await res.json();
        showFeedback(err.error || "Error", "error");
      }
    } catch (err) {
      showFeedback("Error", "error");
    } finally {
      pendingPostActions.delete(`like-${postId}`);
    }
    return;
  }

  // HANDLE DELETE
  if (deleteButton) {
    if (deleteButton.textContent === "Delete") {
      deleteButton.textContent = "Confirm?";
      deleteButton.style.color = "#ff4444";
      setTimeout(() => {
        if (deleteButton.textContent === "Confirm?") {
          deleteButton.textContent = "Delete";
          deleteButton.style.color = "#444";
        }
      }, 3000);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/posts/${postId}`, { method: "DELETE" });
      if (res.ok) {
        postElement.remove();
        showFeedback("Deleted.", "success");
      } else {
        showFeedback("Delete failed", "error");
      }
    } catch (err) {
      showFeedback("Error", "error");
    }
  }
});

// Sticky Header Scroll Logic
const feedTabs = document.querySelector(".feed-tabs-container");
const composerBox = document.querySelector(".composer");
let lastScrollTop = 0;

function handleScroll(e) {
  const st = e.target.scrollTop;
  if (!feedTabs) return;

  if (st > lastScrollTop && st > 100) {
    // Scrolling down
    feedTabs.classList.add("hidden");
    if (composerBox) composerBox.style.opacity = "0.5";
  } else {
    // Scrolling up
    feedTabs.classList.remove("hidden");
    if (composerBox) composerBox.style.opacity = "1";
  }
  lastScrollTop = st <= 0 ? 0 : st;
}

const feedScrollArea = document.getElementById("postsList");
if (feedScrollArea) {
  feedScrollArea.addEventListener("scroll", handleScroll);
}

(async function init() {
  await fetchCurrentUser();
  await loadFeed();
})();
