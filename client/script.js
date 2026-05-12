const API_URL = ""; 
const CURRENT_TIME = new Date();

function timeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + "y";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + "mo";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + "d";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + "h";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + "m";
  return Math.floor(seconds) + "s";
}
function formatNumber(num) {
  if (!num) return "0";
  if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return num.toString();
}

const postForm = document.getElementById("postForm");
const postInput = document.getElementById("postInput");
const profileView = document.getElementById("profileView");
const profileContent = document.getElementById("profileContent");
const settingsModal = document.getElementById("settingsModal");
const closeSettings = document.getElementById("closeSettings");
const saveProfile = document.getElementById("saveProfile");
const settingsNavItems = document.querySelectorAll(".settings-nav-item");
const settingsTabContents = document.querySelectorAll(".settings-tab-content");
const settingsUsername = document.getElementById("settingsUsername");
const settingsBio = document.getElementById("settingsBio");
const settingsUserEmoji = document.getElementById("settingsUserEmoji");
const settingsTabTitle = document.getElementById("settingsTabTitle");
const feedbackMessage = document.getElementById("feedbackMessage");
const sendButton = postForm ? postForm.querySelector(".send") : null;
const imageInput = document.getElementById("imageInput");
const pickImageButton = document.getElementById("pickImageButton");
const imagePreviewBox = document.getElementById("imagePreviewBox");
const imagePreview = document.getElementById("imagePreview");
const removeImageButton = document.getElementById("removeImageButton");
const togglePollButton = document.getElementById("togglePollButton");
const pollCreator = document.getElementById("pollCreator");
const closePollButton = document.getElementById("closePollButton");
const addPollOptionButton = document.getElementById("addPollOption");
const pollOptionsContainer = document.getElementById("pollOptionsContainer");
const pollQuestionInput = document.getElementById("pollQuestion");

// Views
const feedView = document.getElementById("feedView");
const searchView = document.getElementById("searchView");

// Nav
const navFeed = document.getElementById("navFeed");
const navSearch = document.getElementById("navSearch");
const navProfile = document.getElementById("navProfile");

// Search Elements
const searchInput = document.getElementById("searchInput");
const searchClearBtn = document.getElementById("searchClearBtn");
const searchResults = document.getElementById("searchResults");
const searchTabs = document.querySelectorAll(".search-tab");
let searchDebounceTimer = null;
let activeSearchTab = "people";
let cachedSearchUsers = [];
let cachedSearchPosts = [];

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
    ? timeAgo(new Date(post.created_at))
    : "just now";

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
      <div class="post-more">⋯</div>
    </div>
    <div class="post-body"></div>
    <img class="post-image hidden" alt="Post image" />
    <footer class="post-foot">
      <span class="action-like ${post.has_liked ? "liked" : ""}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="action-icon"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
        <span class="likes-count">${formatNumber(post.likes || 0)}</span>
      </span>
      <span class="action-comment">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="action-icon"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
        <span class="comments-count">${formatNumber(post.comment_count || 0)}</span>
      </span>
      <span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="action-icon"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
        0
      </span>
      ${isOwner ? '<button class="action-delete" style="margin-left:auto;">Delete</button>' : ""}
    </footer>
    <div class="comments-container hidden"></div>
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

  // Render Poll if exists
  if (post.poll) {
    const poll = post.poll;
    const pollDiv = document.createElement("div");
    pollDiv.className = "poll-display";
    
    const isVoted = poll.user_has_voted;
    let optionsHtml = "";
    poll.options.forEach(opt => {
      const percentage = poll.total_votes > 0 ? Math.round((opt.vote_count / poll.total_votes) * 100) : 0;
      const userChoice = opt.user_voted;
      
      optionsHtml += `
        <div class="poll-option ${isVoted ? "voted" : ""} ${userChoice ? "user-voted" : ""}" data-option-id="${opt.id}">
          ${isVoted ? `<div class="poll-vote-bar" style="width: ${percentage}%"></div>` : ""}
          <span class="poll-option-text">${opt.option_text}</span>
          ${isVoted ? `<span class="poll-option-percent">${percentage}%</span>` : ""}
        </div>
      `;
    });

    pollDiv.innerHTML = `
      <div class="poll-question">${poll.question}</div>
      <div class="poll-options">
        ${optionsHtml}
      </div>
      <div class="poll-footer">
        <span>${isVoted ? `${poll.total_votes} votes` : "Vote to see results"}</span>
        <span>${isVoted ? "Final results" : "Poll active"}</span>
      </div>
    `;

    // Handle voting
    if (!isVoted) {
      pollDiv.querySelectorAll(".poll-option").forEach(optEl => {
        optEl.addEventListener("click", async (e) => {
          e.stopPropagation();
          if (!currentUser) { window.location.href = "login.html"; return; }
          if (postElement.dataset.voting === "true") return;
          
          const optionId = optEl.dataset.optionId;
          postElement.dataset.voting = "true";
          
          try {
            const res = await fetch(`${API_URL}/posts/${post.id}/vote`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ optionId })
            });
            
            if (res.ok) {
              const data = await res.json();
              post.poll = data.poll;
              const newPostEl = createPostElement(post);
              postElement.replaceWith(newPostEl);
              showFeedback("Vote recorded!", "success");
            } else {
              const err = await res.json();
              showFeedback(err.error || "Voting failed", "error");
              postElement.dataset.voting = "false";
            }
          } catch (err) {
            showFeedback("Voting failed", "error");
            postElement.dataset.voting = "false";
          }
        });
      });
    }

    postElement.querySelector(".post-body").after(pollDiv);
  }

  return postElement;
}

async function loadFeed() {
  try {
    const response = await fetch(`${API_URL}/posts`);
    if (!response.ok) throw new Error("Load failed");
    const posts = await response.json();
    
    const postsList = document.getElementById("feedPosts");
    postsList.innerHTML = "";
    posts.forEach((post, index) => {
      const el = createPostElement(post);
      el.style.opacity = "0";
      el.style.transform = "translateY(10px)";
      postsList.appendChild(el);
      setTimeout(() => {
        el.style.transition = "all 0.4s ease";
        el.style.opacity = "1";
        el.style.transform = "translateY(0)";
      }, index * 50);
    });
  } catch (error) {
    showFeedback("Could not load posts.", "error");
  }
}

function hideAllViews() {
  feedView.classList.add("hidden");
  if (searchView) searchView.classList.add("hidden");
  profileView.classList.add("hidden");
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
}

async function showProfile(userId) {
  console.log("Loading profile for user:", userId);
  if (!userId) {
    showFeedback("Invalid User ID", "error");
    return;
  }
  hideAllViews();
  profileView.classList.remove("hidden");
  navProfile.classList.add("active");

  profileContent.innerHTML = `<div style="padding: 40px; color: var(--muted);">Loading profile...</div>`;

  try {
    const userRes = await fetch(`/auth/users/${userId}`);
    console.log("Profile fetch status:", userRes.status);
    if (!userRes.ok) throw new Error("User not found");
    const userData = (await userRes.json()).user;

    const postsRes = await fetch(`/posts/user/${userId}`);
    const userPosts = await postsRes.json();

    const isMe = currentUser && String(currentUser.id) === String(userId);
    const regDate = new Date(userData.created_at || Date.now()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    profileContent.innerHTML = `
      <div class="profile-nav-top">
        <button class="back-btn" onclick="showFeed()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px; height:20px;"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
        </button>
        <div class="mini-profile-info">
          <span class="mini-name">${userData.username}</span>
          <span class="mini-meta">${userPosts.length} posts</span>
        </div>
      </div>
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
        <h2>${userData.username}</h2>
        <p class="handle">@${userData.username.toLowerCase()}</p>
        
        ${userData.bio ? `<p class="bio" style="margin-top: 12px; color: var(--text); font-size: 15px; line-height: 1.5;">${userData.bio}</p>` : ""}

        <div class="profile-stats">
          <span><b>0</b> followers</span>
          <span><b>0</b> following</span>
        </div>
        
        <div class="profile-meta">
          <span>📅 Registered: ${regDate}</span>
        </div>
      </div>

      <div class="profile-tabs">
        <div class="tabs">
           <button class="tab active">Posts</button>
           <button class="tab">Likes</button>
        </div>
      </div>

      <div id="profilePosts" style="padding: 24px 40px;"></div>
    `;

    const profilePosts = document.getElementById("profilePosts");
    if (userPosts.length === 0) {
      profilePosts.innerHTML = `<p style="color: var(--muted); text-align: center; padding: 40px;">No posts yet.</p>`;
    } else {
      userPosts.forEach(post => {
        profilePosts.appendChild(createPostElement(post));
      });
    }
    


    // Wire up Edit Profile button
    const editBtn = profileContent.querySelector('.btn-edit');
    if (editBtn && isMe) {
      editBtn.addEventListener('click', () => {
        openSettings('account');
      });
    }
  } catch (err) {
    profileContent.innerHTML = `
      <div style="padding: 100px 40px; text-align: center;">
        <h2 style="font-size: 24px; margin-bottom: 16px; color: #fff;">Profile Unavailable</h2>
        <p style="color: var(--muted); margin-bottom: 32px;">This user might have been deleted or never existed.</p>
        <button class="btn-pill btn-edit" onclick="showFeed()">Return to Feed</button>
      </div>
    `;
  }
}

function showFeed() {
  hideAllViews();
  feedView.classList.remove("hidden");
  navFeed.classList.add("active");
  loadFeed();
}

function showSearchView() {
  hideAllViews();
  searchView.classList.remove("hidden");
  navSearch.classList.add("active");
  setTimeout(() => searchInput && searchInput.focus(), 100);
}

// ═══════════════════════════════════════
// Search Logic
// ═══════════════════════════════════════

async function performSearch(query) {
  if (!query || query.length < 1) {
    searchResults.innerHTML = `
      <div class="search-empty-state">
        <div class="search-empty-icon">🔍</div>
        <p>Start typing to search</p>
        <span>Find users, posts, and conversations</span>
      </div>`;
    cachedSearchUsers = [];
    cachedSearchPosts = [];
    return;
  }

  // Show loading
  searchResults.innerHTML = `
    <div class="search-loading">
      <div class="search-spinner"></div>
      <span>Searching...</span>
    </div>`;

  try {
    const [usersRes, postsRes] = await Promise.all([
      fetch(`${API_URL}/auth/users/search/${encodeURIComponent(query)}`),
      fetch(`${API_URL}/posts/search?q=${encodeURIComponent(query)}`)
    ]);

    cachedSearchUsers = usersRes.ok ? await usersRes.json() : [];
    cachedSearchPosts = postsRes.ok ? await postsRes.json() : [];

    renderSearchResults(query);
  } catch (err) {
    searchResults.innerHTML = `
      <div class="search-no-results">
        <div class="search-empty-icon">⚠️</div>
        <p>Search failed</p>
        <span>Please try again</span>
      </div>`;
  }
}

function renderSearchResults(query) {
  const isUsers = activeSearchTab === "people";
  const data = isUsers ? cachedSearchUsers : cachedSearchPosts;

  // Update tab counts
  searchTabs.forEach(tab => {
    const type = tab.dataset.searchTab;
    const count = type === "people" ? cachedSearchUsers.length : cachedSearchPosts.length;
    // Remove old badge
    const oldBadge = tab.querySelector('.search-tab-count');
    if (oldBadge) oldBadge.remove();
    if (count > 0) {
      const badge = document.createElement('span');
      badge.className = 'search-tab-count';
      badge.style.cssText = 'font-size:12px; opacity:0.5; margin-left: 4px;';
      badge.textContent = `(${count})`;
      tab.appendChild(badge);
    }
  });

  if (data.length === 0) {
    searchResults.innerHTML = `
      <div class="search-no-results">
        <div class="search-empty-icon">😶</div>
        <p>No ${isUsers ? 'people' : 'posts'} found</p>
        <span>Try a different search term</span>
      </div>`;
    return;
  }

  if (isUsers) {
    renderUserResults(data, query);
  } else {
    renderPostResults(data, query);
  }
}

function highlightText(text, query) {
  if (!query) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  return text.replace(regex, '<span class="search-highlight">$1</span>');
}

function renderUserResults(users, query) {
  let html = `<div class="search-results-count">${users.length} people found</div>`;
  
  users.forEach((user, i) => {
    const bioSnippet = user.bio ? `<div class="search-user-bio">${highlightText(user.bio, query)}</div>` : '';
    html += `
      <div class="search-user-card" data-user-id="${user.id}" style="animation-delay: ${i * 0.05}s">
        <div class="search-user-avatar">${user.emoji || '👤'}</div>
        <div class="search-user-info">
          <div class="search-user-name">${highlightText(user.username, query)}</div>
          <div class="search-user-handle">@${user.username.toLowerCase()}</div>
          ${bioSnippet}
        </div>
        <svg class="search-user-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </div>`;
  });

  searchResults.innerHTML = html;

  // Wire up clicks
  searchResults.querySelectorAll('.search-user-card').forEach(card => {
    card.addEventListener('click', () => {
      const uid = card.dataset.userId;
      if (uid) showProfile(uid);
    });
  });
}

function renderPostResults(posts, query) {
  let html = `<div class="search-results-count">${posts.length} posts found</div>`;
  searchResults.innerHTML = html;

  posts.forEach((post, i) => {
    const el = createPostElement(post);
    el.classList.add('search-post-result');
    el.style.animationDelay = `${i * 0.05}s`;
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    searchResults.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'all 0.4s ease';
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    }, i * 50);
  });
}

// Search event listeners
if (searchInput) {
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim();
    searchClearBtn.classList.toggle('hidden', !q);
    
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => performSearch(q), 300);
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchInput.value = '';
      searchClearBtn.classList.add('hidden');
      performSearch('');
    }
  });
}

if (searchClearBtn) {
  searchClearBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchClearBtn.classList.add('hidden');
    performSearch('');
    searchInput.focus();
  });
}

searchTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    searchTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    activeSearchTab = tab.dataset.searchTab;
    const q = searchInput ? searchInput.value.trim() : '';
    if (q) renderSearchResults(q);
  });
});

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

      // Add poll data if active
      if (!pollCreator.classList.contains("hidden")) {
        const question = pollQuestionInput.value.trim();
        const optionInputs = pollOptionsContainer.querySelectorAll(".poll-option-input");
        const options = Array.from(optionInputs).map(i => i.value.trim()).filter(v => v);
        
        if (question && options.length >= 2) {
          formData.append("poll", JSON.stringify({ question, options }));
        }
      }

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
      
      // Clear Poll
      if (closePollButton) closePollButton.click();
      
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

// Poll Logic
if (togglePollButton) {
  togglePollButton.addEventListener("click", () => {
    pollCreator.classList.toggle("hidden");
    if (!pollCreator.classList.contains("hidden")) {
      pollQuestionInput.focus();
    }
  });
}

if (closePollButton) {
  closePollButton.addEventListener("click", () => {
    pollCreator.classList.add("hidden");
    // Clear inputs
    pollQuestionInput.value = "";
    const optionInputs = pollOptionsContainer.querySelectorAll(".poll-option-input");
    optionInputs.forEach((input, index) => {
      if (index < 2) input.value = "";
      else input.remove();
    });
  });
}

if (addPollOptionButton) {
  addPollOptionButton.addEventListener("click", () => {
    const currentOptions = pollOptionsContainer.querySelectorAll(".poll-option-input");
    if (currentOptions.length >= 4) {
      showFeedback("Maximum 4 options allowed.", "info");
      return;
    }
    const newInput = document.createElement("input");
    newInput.type = "text";
    newInput.className = "poll-option-input";
    newInput.placeholder = `Option ${currentOptions.length + 1}`;
    newInput.maxLength = 50;
    pollOptionsContainer.appendChild(newInput);
    newInput.focus();
  });
}

logoutBtn.addEventListener("click", async () => {
  const res = await fetch("/auth/logout", { method: "POST" });
  if (res.ok) window.location.reload();
});

navFeed.addEventListener("click", (e) => { e.preventDefault(); showFeed(); });
if (navSearch) navSearch.addEventListener("click", (e) => { e.preventDefault(); showSearchView(); });
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
  const commentBtn = event.target.closest(".action-comment");
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
        if (count) count.textContent = formatNumber(data.likes);
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

  // HANDLE COMMENTS TOGGLE
  if (commentBtn) {
    toggleComments(postId, postElement);
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
const stickyHeader = document.getElementById("stickyHeader");
let lastScrollTop = 0;

let isHeaderHidden = false;

function handleScroll() {
  const st = window.pageYOffset || document.documentElement.scrollTop;
  if (!stickyHeader) return;
  lastScrollTop = st;
}

window.addEventListener("scroll", handleScroll);

async function toggleComments(postId, postElement) {
  const container = postElement.querySelector(".comments-container");
  if (!container) return;

  if (!container.classList.contains("hidden")) {
    container.classList.add("hidden");
    container.innerHTML = "";
    return;
  }

  container.classList.remove("hidden");
  container.innerHTML = `<div style="padding: 10px; color: var(--muted); font-size: 13px;">Loading thoughts...</div>`;

  try {
    const res = await fetch(`${API_URL}/posts/${postId}/comments`);
    const comments = await res.json();
    
    let html = `<div class="comments-section">`;
    comments.forEach(c => {
      html += `
        <div class="comment">
          <div class="mini-avatar">${c.emoji}</div>
          <div class="comment-bubble">
            <span class="author">${c.username}</span>
            <div class="text">${c.content}</div>
          </div>
        </div>
      `;
    });

    if (currentUser) {
      html += `
        <form class="comment-form" data-post-id="${postId}">
          <input type="text" placeholder="Add your thought..." required />
          <button type="submit" class="btn-send-comment">➜</button>
        </form>
      `;
    } else {
      html += `<p style="font-size: 12px; color: var(--muted); margin-top: 8px;">Login to join the conversation.</p>`;
    }

    html += `</div>`;
    container.innerHTML = html;

    // Handle comment submission
    const form = container.querySelector(".comment-form");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const input = form.querySelector("input");
        const content = input.value.trim();
        if (!content) return;

        try {
          const postRes = await fetch(`${API_URL}/posts/${postId}/comments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content })
          });
          if (postRes.ok) {
            input.value = "";
            toggleComments(postId, postElement); // Refresh comments
            // Update count
            const countEl = postElement.querySelector(".comments-count");
            if (countEl) {
              const currentText = countEl.textContent.replace(/[^0-9]/g, "");
              const current = parseInt(currentText) || 0;
              countEl.textContent = formatNumber(current + 1);
            }
          }
        } catch (err) {
          showFeedback("Failed to post comment", "error");
        }
      });
    }

  } catch (err) {
    container.innerHTML = `<div style="padding: 10px; color: #f87171;">Failed to load comments.</div>`;
  }
}

// Settings Logic
function openSettings(tab = "account") {
  if (!currentUser) return;
  settingsModal.classList.add("show");
  settingsUsername.value = currentUser.username;
  settingsBio.value = currentUser.bio || "";
  settingsUserEmoji.textContent = currentUser.emoji;
  switchSettingsTab(tab);
}

function switchSettingsTab(tabId) {
  settingsNavItems.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });
  settingsTabContents.forEach(content => {
    content.classList.toggle("hidden", content.id !== `tab-${tabId}`);
  });
  settingsTabTitle.textContent = tabId.charAt(0).toUpperCase() + tabId.slice(1);
}

if (closeSettings) {
  closeSettings.addEventListener("click", () => settingsModal.classList.remove("show"));
}

settingsModal.addEventListener("click", (e) => {
  if (e.target === settingsModal) settingsModal.classList.remove("show");
});

settingsNavItems.forEach(btn => {
  btn.addEventListener("click", () => switchSettingsTab(btn.dataset.tab));
});

if (saveProfile) {
  saveProfile.addEventListener("click", async () => {
    const username = settingsUsername.value.trim();
    const bio = settingsBio.value.trim();
    
    if (!username) return showFeedback("Username is required", "error");

    saveProfile.disabled = true;
    saveProfile.textContent = "Saving...";

    try {
      const res = await fetch(`${API_URL}/auth/update-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, bio })
      });

      if (!res.ok) throw new Error(await getErrorMessage(res, "Update failed"));

      showFeedback("Profile updated!", "success");
      
      // Update local state and UI
      currentUser.username = username;
      currentUser.bio = bio;
      
      const userNameDisplay = document.getElementById("userNameDisplay");
      const userHandleDisplay = document.getElementById("userHandleDisplay");
      if (userNameDisplay) userNameDisplay.textContent = username;
      if (userHandleDisplay) userHandleDisplay.textContent = `@${username.toLowerCase()}`;
      
      // If we are on the profile page, refresh it
      if (!profileView.classList.contains("hidden")) {
        showProfile(currentUser.id);
      }
      
      settingsModal.classList.remove("show");
    } catch (err) {
      showFeedback(err.message, "error");
    } finally {
      saveProfile.disabled = false;
      saveProfile.textContent = "Save Changes";
    }
  });
}

(async function init() {
  await fetchCurrentUser();
  await loadFeed();
})();
