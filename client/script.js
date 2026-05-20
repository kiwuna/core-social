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

function formatSocialDate(dateInput) {
  const date = new Date(dateInput);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  // 1-30 mins
  if (diffInSeconds < 1800) {
    const mins = Math.max(1, Math.floor(diffInSeconds / 60));
    return `${mins}m`;
  }
  
  // Up to 1h
  if (diffInSeconds < 3600) {
    return `${Math.floor(diffInSeconds / 60)}m`;
  }
  
  // 1h - 23h
  if (diffInSeconds < 86400) {
    return `${Math.floor(diffInSeconds / 3600)}h`;
  }
  
  // 1d - 7d
  if (diffInSeconds < 604800) {
    return `${Math.floor(diffInSeconds / 86400)}d`;
  }
  
  // Dates like 26/4
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  
  // If year 2027 comes, show 26/4/26 (User said 26/4/26 for 2027, so YY format)
  if (now.getFullYear() >= 2027) {
    const shortYear = String(year).slice(-2);
    return `${day}/${month}/${shortYear}`;
  }
  
  return `${day}/${month}`;
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
const settingsDisplayName = document.getElementById("settingsDisplayName");
const settingsUsername = document.getElementById("settingsUsername");
const settingsBio = document.getElementById("settingsBio");
const settingsUserEmoji = document.getElementById("settingsUserEmoji");
const settingsTabTitle = document.getElementById("settingsTabTitle");
const feedbackMessage = document.getElementById("feedbackMessage");
const enablePushBtn = document.getElementById("enablePushBtn");
const testPushBtn = document.getElementById("testPushBtn");
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
const notificationsView = document.getElementById("notificationsView");
const notificationsContent = document.getElementById("notificationsContent");
const messagesView = document.getElementById("messagesView");

// Nav
const navFeed = document.getElementById("navFeed");
const navSearch = document.getElementById("navSearch");
const navProfile = document.getElementById("navProfile");
const navCoreFlow = document.getElementById("navCoreFlow");
const tabExplore = document.getElementById("tabExplore");
const tabFollowing = document.getElementById("tabFollowing");
let feedMode = "explore"; // 'explore' or 'following'

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
const PUSH_USER_KEY = "core_push_user_id";
const pendingPostActions = new Set();
let selectedImageFile = null;
let selectedImagePreviewUrl = "";
let selectedFont = "default";

// Core Flow elements
const fontStylePicker = document.getElementById("fontStylePicker");
const fontBtns = document.querySelectorAll(".font-btn");
const avatarFileInput = document.getElementById("avatarFileInput");
const avatarPreview = document.getElementById("avatarPreview");
const removeAvatarBtn = document.getElementById("removeAvatarBtn");
const avatarUploadArea = document.getElementById("avatarUploadArea");
const avatarLockedMsg = document.getElementById("avatarLockedMsg");

const bannerFileInput = document.getElementById("bannerFileInput");
const bannerPreview = document.getElementById("bannerPreview");
const removeBannerBtn = document.getElementById("removeBannerBtn");
const bannerUploadArea = document.getElementById("bannerUploadArea");
const bannerLockedMsg = document.getElementById("bannerLockedMsg");
const activateCoreFlowBtn = document.getElementById("activateCoreFlow");
const coreFlowModal = document.getElementById("coreFlowModal");
const closeCoreFlow = document.getElementById("closeCoreFlow");
const activateCoreFlowModal = document.getElementById("activateCoreFlowModal");

// Sync Email Elements
const emailSyncStatus = document.getElementById("emailSyncStatus");
const syncEmailForm = document.getElementById("syncEmailForm");
const syncEmailInput = document.getElementById("email") || document.getElementById("syncEmailInput");
const btnRequestSync = document.getElementById("btnRequestSync");
const verifySyncForm = document.getElementById("verifySyncForm");
const syncEmailAddress = document.getElementById("syncEmailAddress");
const syncCodeInput = document.getElementById("syncCodeInput");
const btnVerifySync = document.getElementById("btnVerifySync");
const btnCancelSync = document.getElementById("btnCancelSync");
const syncedEmailInfo = document.getElementById("syncedEmailInfo");
const syncedEmailDisplay = document.getElementById("syncedEmailDisplay");

// Unlink Email Elements
const btnUnlinkRequest = document.getElementById("btnUnlinkRequest");
const verifyUnlinkForm = document.getElementById("verifyUnlinkForm");
const unlinkCodeInput = document.getElementById("unlinkCodeInput");
const btnUnlinkVerify = document.getElementById("btnUnlinkVerify");
const btnUnlinkCancel = document.getElementById("btnUnlinkCancel");

// Mobile Elements
const mobileMenuBtn = document.getElementById("mobileMenuBtn");
const mobNavFeed = document.getElementById("mobNavFeed");
const mobNavSearch = document.getElementById("mobNavSearch");
const mobNavNotifications = document.getElementById("mobNavNotifications");
const mobNavProfile = document.getElementById("mobNavProfile");
const mobNavProfileIcon = mobNavProfile ? mobNavProfile.querySelector('.ico') : null;
const userEmojiMobile = document.getElementById("userEmojiMobile");

// Global UI Elements
const confirmModal = document.getElementById("confirmModal");
const confirmTitle = document.getElementById("confirmTitle");
const confirmMessage = document.getElementById("confirmMessage");
const confirmCancel = document.getElementById("confirmCancel");
const confirmProceed = document.getElementById("confirmProceed");
const checkoutForm = document.querySelector('form[action="/create-checkout-session"]');

// Create Sidebar Overlay
const sidebarOverlay = document.createElement("div");
sidebarOverlay.className = "sidebar-overlay";
document.body.appendChild(sidebarOverlay);

function showFeedback(message, type = "info") {
  if (!feedbackMessage) return;
  feedbackMessage.textContent = message;
  feedbackMessage.className = `feedback-message ${type} show`;
  if (!message) return;
  
  setTimeout(() => {
    if (feedbackMessage.textContent === message) {
      feedbackMessage.classList.remove("show");
      setTimeout(() => {
        if (!feedbackMessage.classList.contains("show")) {
          feedbackMessage.textContent = "";
          feedbackMessage.className = "feedback-message";
        }
      }, 400);
    }
  }, 3000);
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
    userNameDisplay.textContent = currentUser.display_name || currentUser.username;
    userNameDisplay.classList.toggle('premium-name-gradient', !!currentUser.is_premium);
    userHandleDisplay.textContent = `@${currentUser.username.toLowerCase()}`;
    userEmojiLarge.textContent = currentUser.emoji || "👤";
    if (mobNavProfileIcon) mobNavProfileIcon.textContent = currentUser.emoji || "👤";

    if (userEmojiMini) {
      if (currentUser.is_premium && currentUser.avatar_path) {
        userEmojiMini.innerHTML = `<img src="${currentUser.avatar_path}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`;
      } else {
        userEmojiMini.textContent = currentUser.emoji || "👻";
      }
      userEmojiMini.classList.toggle('round-avatar', !!currentUser.is_premium);
    }
    
    if (userEmojiMobile) {
      if (currentUser.is_premium && currentUser.avatar_path) {
        userEmojiMobile.innerHTML = `<img src="${currentUser.avatar_path}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`;
      } else {
        userEmojiMobile.textContent = currentUser.emoji || "👻";
      }
      userEmojiMobile.classList.toggle('round-avatar', !!currentUser.is_premium);
    }
    // Show font picker for premium users
    if (fontStylePicker) fontStylePicker.classList.toggle('hidden', !currentUser.is_premium);

    // Update settings modal premium states
    const isPremium = !!currentUser.is_premium;

    if (avatarUploadArea) {
      avatarUploadArea.classList.toggle('locked', !isPremium || !currentUser.isSynced);
      avatarUploadArea.style.pointerEvents = (isPremium && currentUser.isSynced) ? 'auto' : 'none';
    }
    if (avatarLockedMsg) {
      avatarLockedMsg.classList.toggle('hidden', isPremium && currentUser.isSynced);
      if (isPremium && !currentUser.isSynced) {
      avatarLockedMsg.innerHTML = '<span>??</span> Custom avatars are a <strong>Core Flow</strong> exclusive feature.';
      } else if (!isPremium) {
      avatarLockedMsg.innerHTML = '<span>??</span> Custom avatars are a <strong>Core Flow</strong> exclusive feature.';
      }
    }

    if (bannerUploadArea) {
      bannerUploadArea.classList.toggle('locked', !isPremium || !currentUser.isSynced);
      bannerUploadArea.style.pointerEvents = (isPremium && currentUser.isSynced) ? 'auto' : 'none';
    }
    if (bannerLockedMsg) {
      bannerLockedMsg.classList.toggle('hidden', isPremium && currentUser.isSynced);
      if (!currentUser.isSynced) {
      bannerLockedMsg.innerHTML = '<span>??</span> Custom banners are a <strong>Core Flow</strong> exclusive feature.';
      } else {
      bannerLockedMsg.innerHTML = '<span>??</span> Custom banners are a <strong>Core Flow</strong> exclusive feature.';
      }
    }

    if (avatarPreview) {
      if (isPremium && currentUser.avatar_path) {
        avatarPreview.innerHTML = `<img src="${currentUser.avatar_path}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`;
      } else {
        avatarPreview.textContent = currentUser.emoji || "👤";
      }
    }

    // Sidebar Core Flow link state
    if (navCoreFlow) {
      navCoreFlow.classList.toggle('coreflow-active', !!currentUser.is_premium);
      if (currentUser.is_premium) {
        navCoreFlow.style.color = '#60a5fa'; // Premium Blue
        navCoreFlow.querySelector('span:last-child').textContent = 'CORE FLOW';
      } else {
        navCoreFlow.style.color = '';
        navCoreFlow.querySelector('span:last-child').textContent = 'UPGRADE';
      }
    }

    // Admin Panel Link Visibility
    const navAdmin = document.getElementById("navAdmin");
    if (navAdmin) {
      const isAdmin = currentUser.role === 'admin' || currentUser.role === 'ceo' || currentUser.role === 'mod' || currentUser.username === 'ceo' || currentUser.username === 'admin';
      navAdmin.classList.toggle("hidden", !isAdmin);
    }

    logoutBtn.classList.remove("hidden");
    loginLink.classList.add("hidden");
  } else {
    userNameDisplay.textContent = "Profile";
    userHandleDisplay.textContent = "@anonymous";
    userEmojiLarge.textContent = "👤";
    if (mobNavProfileIcon) mobNavProfileIcon.textContent = "👤";
    if (userEmojiMini) {
      userEmojiMini.textContent = "👻";
      userEmojiMini.classList.remove('premium-ring', 'round-avatar');
    }
    if (userEmojiMobile) {
      userEmojiMobile.textContent = "👻";
      userEmojiMobile.classList.remove('round-avatar');
    }
    if (fontStylePicker) fontStylePicker.classList.add('hidden');
    if (avatarUploadArea) avatarUploadArea.classList.add('hidden');
    if (avatarLockedMsg) avatarLockedMsg.classList.add('hidden');
    if (navCoreFlow) {
      navCoreFlow.classList.remove('coreflow-active');
      navCoreFlow.style.color = '';
      navCoreFlow.querySelector('span:last-child').textContent = 'CORE FLOW';
    }
    const navAdmin = document.getElementById("navAdmin");
    if (navAdmin) navAdmin.classList.add("hidden");
    
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
      updateAuthUI();
      checkUserWarnings();
      if(typeof initSocket === 'function') initSocket();
    } else if (res.status === 403) {
      const data = await res.json();
      if (data.error === "suspended") {
        window.location.href = `/suspended.html?until=${encodeURIComponent(data.suspendedUntil)}`;
        return;
      }
      currentUser = null;
      updateAuthUI();
    } else {
      currentUser = null;
      updateAuthUI();
    }
  } catch (err) {
    currentUser = null;
    updateAuthUI();
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service workers are not supported in this browser.");
  }
  return navigator.serviceWorker.register("/sw.js");
}

async function subscribeToPush() {
  const registration = await registerServiceWorker();
  await navigator.serviceWorker.ready;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission was denied.");
  }

  if (currentUser?.id) {
    const activePushUser = localStorage.getItem(PUSH_USER_KEY);
    if (activePushUser && activePushUser !== String(currentUser.id)) {
      await unsubscribeFromPush();
    }
  }

  const keyRes = await fetch("/api/push/public-key", { credentials: "include" });
  if (!keyRes.ok) throw new Error("Missing push public key.");
  const { publicKey } = await keyRes.json();

  let subscription = null;
  try {
    subscription = await registration.pushManager.getSubscription();
  } catch (error) {
    console.warn("Push subscription lookup failed, creating new subscription:", error.message);
  }
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });
  }

  await fetch("/api/push/subscribe", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription)
  });

  if (currentUser?.id) {
    localStorage.setItem(PUSH_USER_KEY, String(currentUser.id));
  }

  return subscription;
}

async function unsubscribeFromPush() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
    }
  } catch (error) {
    console.warn("Push unsubscribe skipped:", error.message);
  } finally {
    localStorage.removeItem(PUSH_USER_KEY);
  }
}

async function setupPushNotifications() {
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return;
  }

  try {
    await registerServiceWorker();
  } catch (error) {
    console.warn("Push setup skipped:", error.message);
  }
}

function showWarningModalDirectly() {
  if (!currentUser) return;
  const warningModal = document.getElementById("warningModal");
  const warningModalTitle = document.getElementById("warningModalTitle");
  const warningModalMessage = document.getElementById("warningModalMessage");
  const warningModalClose = document.getElementById("warningModalClose");

  if (warningModal && warningModalTitle && warningModalMessage) {
    warningModalTitle.textContent = `Warning ${currentUser.warnings}/3`;
    
    const reasons = currentUser.warning_reasons || [];
    const latestReason = reasons.length > 0 ? reasons[reasons.length - 1] : "No reason provided.";
    warningModalMessage.textContent = latestReason;
    
    warningModal.classList.add("show");
    
    if (warningModalClose) {
      warningModalClose.onclick = async () => {
        warningModal.classList.remove("show");
        try {
          await fetch("/auth/acknowledge-warning", { method: "POST" });
          currentUser.acknowledged_warnings = currentUser.warnings;
        } catch (err) {
          console.error("Failed to acknowledge warning:", err);
        }
      };
    }
  }
}

function checkUserWarnings() {
  if (currentUser && currentUser.warnings > (currentUser.acknowledged_warnings || 0)) {
    showWarningModalDirectly();
  }
}

function createPostElement(post) {
  const postElement = document.createElement("article");
  postElement.className = "post";
  postElement.dataset.postId = String(post.id);
  postElement.dataset.ownerId = String(post.user_id);

  const createdAt = post.created_at ? timeAgo(new Date(post.created_at)) : "just now";
  const displayEmoji = post.emoji || "👻";
  const displayUser = post.display_name || post.username || "anonymous";
  const isOwner = currentUser && post.user_id === currentUser.id;
  const isPremiumPost = !!post.is_premium;

  // Avatar: custom image or the new default image
  const avatarInner = (isPremiumPost && post.avatar_path)
    ? `<img src="${post.avatar_path.startsWith('http') ? post.avatar_path : API_URL + post.avatar_path}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;" />`
    : (post.emoji || "👻");

  // Verified badge only for Core Flow users
  const verifiedBadge = isPremiumPost ? `<span class="verified-check" title="Core Flow"></span>` : "";

  postElement.innerHTML = `
    <div class="post-head">
      <div class="mini-avatar" style="cursor:pointer" data-user-id="${post.user_id}">${avatarInner}</div>
      <div class="post-user-info" style="cursor:pointer" data-user-id="${post.user_id}">
        <h3 style="display:flex;align-items:center;gap:4px;">
          <span class="${isPremiumPost ? 'premium-name-gradient' : ''}">${displayUser}</span>${verifiedBadge}
        </h3>
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

  // Apply font style to post body
  const postBody = postElement.querySelector(".post-body");
  postBody.textContent = post.content;
  if (post.font_style && post.font_style !== 'default') {
    postBody.classList.add(`font-${post.font_style}`);
  }

  postElement.querySelectorAll('[data-user-id]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const uid = el.dataset.userId;
      if (uid && uid !== "null" && uid !== "undefined" && displayUser !== "anonymous") {
         MapsTo('profile/' + uid);
      } else {
         showFeedback("This is an anonymous or deleted user.", "info");
      }
    });
  });

  const postImageElement = postElement.querySelector(".post-image");
  if (post.image_path) {
    postImageElement.src = post.image_path.startsWith('http') ? post.image_path : `${API_URL}${post.image_path}`;
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
    const endpoint = feedMode === "following" ? "/feed/following" : "/posts";
    const response = await fetch(`${API_URL}${endpoint}`);
    
    if (response.status === 401 && feedMode === "following") {
      showFeedback("Log in to see your personalized feed.", "info");
      switchFeedMode("explore");
      return;
    }
    
    if (!response.ok) throw new Error("Load failed");
    const posts = await response.json();
    
    const postsList = document.getElementById("feedPosts");
    postsList.innerHTML = "";

    if (posts.length === 0) {
      const emptyMsg = feedMode === "following" 
        ? "Follow users to personalize your feed." 
        : "No posts yet. Be the first!";
      postsList.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--muted);">${emptyMsg}</div>`;
      return;
    }

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

function switchFeedMode(mode) {
  feedMode = mode;
  tabExplore.classList.toggle("active", mode === "explore");
  tabFollowing.classList.toggle("active", mode === "following");
  loadFeed();
}

function hideAllViews() {
  feedView.classList.add("hidden");
  if (searchView) searchView.classList.add("hidden");
  profileView.classList.add("hidden");
  if (messagesView) messagesView.classList.add("hidden");
  if (notificationsView) notificationsView.classList.add("hidden");
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
}

window.MapsTo = function(viewPath, push = true) {
  const parts = viewPath.split('/');
  const view = parts[0];
  const id = parts[1];
  
  if (push) {
    window.history.pushState({ viewPath }, "", `#${viewPath}`);
  }

  // Close modals if we navigate to a main view
  if (view !== 'settings') {
    if (settingsModal) settingsModal.classList.remove("show");
  }

  switch(view) {
    case 'feed':
      showFeed();
      break;
    case 'search':
      showSearchView();
      break;
    case 'profile':
      showProfile(id);
      break;
    case 'messages':
      showMessages(id);
      break;
    case 'notifications':
      showNotifications();
      break;
    case 'post':
    case 'comments':
      showSinglePost(id);
      break;
    case 'settings':
      openSettings(id || 'account', false);
      break;
    default:
      showFeed();
  }
};

window.onpopstate = (event) => {
  const hash = window.location.hash.slice(1);
  if (event.state && event.state.viewPath) {
    MapsTo(event.state.viewPath, false);
  } else if (hash) {
    MapsTo(hash, false);
  } else {
    if (settingsModal) settingsModal.classList.remove("show");
    showFeed();
  }
};

async function showProfile(userId) {
  console.log("Loading profile for user:", userId);
  if (!userId) {
    showFeedback("Invalid User ID", "error");
    return;
  }
  hideAllViews();
  profileView.classList.remove("hidden");
  navProfile.classList.add("active");
  setMobileNavActive("mobNavProfile");

  profileContent.innerHTML = `<div style="padding: 40px; color: var(--muted);">Loading profile...</div>`;

  try {
    const userRes = await fetch(`/auth/users/${userId}`);
    if (!userRes.ok) throw new Error("User not found");
    const userData = (await userRes.json()).user;

    const postsRes = await fetch(`/posts/user/${userId}`);
    const userPosts = await postsRes.json();

    const followRes = await fetch(`/users/${userId}/follow-status`);
    const followData = await followRes.json();

    const isMe = currentUser && String(currentUser.id) === String(userId);
    const regDate = new Date(userData.created_at || Date.now()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    profileContent.innerHTML = `
      <div class="profile-nav-top">
        <button class="back-btn" onclick="MapsTo('feed')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px; height:20px;"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
        </button>
        <div class="mini-profile-info">
          <span class="mini-name ${userData.is_premium ? 'premium-name-gradient' : ''}">${userData.display_name || userData.username}</span>
          <span class="mini-meta">${userPosts.length} posts</span>
        </div>
      </div>
      <div class="profile-header">
        <div class="profile-banner" style="${userData.is_premium && userData.banner_path ? `background-image: url(${userData.banner_path}?v=${Date.now()}) !important; background-size: cover; background-position: center;` : ''}">
        </div>
        <div class="profile-avatar-area">
          <div class="large-avatar-wrap ${userData.is_premium ? 'round-avatar' : ''}">
            <div class="large-avatar">
              ${(userData.is_premium && userData.avatar_path) 
                ? `<img src="${userData.avatar_path}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`
                : userData.emoji || '👤'}
            </div>
            <div class="status-indicator"></div>
          </div>
          <div class="profile-actions">
            ${isMe 
              ? '<button class="btn-pill btn-edit">Edit Profile</button><button class="btn-pill btn-secondary">Settings</button>' 
              : `<button class="btn-pill btn-follow ${followData.isFollowing ? 'following' : ''}" data-user-id="${userId}">${followData.isFollowing ? 'Following' : 'Follow'}</button><button class="btn-pill btn-secondary" onclick="MapsTo('messages/${userId}')">Message</button>`}
          </div>
        </div>
      </div>
      
      <div class="profile-info">
        <h2 style="display:flex;align-items:center;gap:8px;">
          <span class="${userData.is_premium ? 'premium-name-gradient' : ''}">${userData.display_name || userData.username}</span>
          ${userData.is_premium ? `<span class="verified-check" title="Core Flow"></span><span class="premium-check" title="Core Flow" style="width:22px;height:22px; display:inline-block; background: url('./assets/star.png'); background-size: contain;"></span>` : ''}
        </h2>
        <p class="handle">@${userData.username.toLowerCase()}</p>
        
        ${userData.bio ? `<p class="bio" style="margin-top: 12px; color: var(--text); font-size: 15px; line-height: 1.5;">${userData.bio}</p>` : ""}

        <div class="profile-stats">
          <span id="followerCountDisplay"><b>${formatNumber(followData.followerCount)}</b> followers</span>
          <span id="followingCountDisplay"><b>${formatNumber(followData.followingCount)}</b> following</span>
        </div>
        
        <div class="profile-meta">
          <span>Registered: ${regDate}</span>
        </div>
      </div>

      <div class="profile-tabs">
        <div class="tabs">
           <button class="tab active">Posts</button>
           <button class="tab">Likes</button>
        </div>
      </div>

      <div id="profilePosts" style="padding: 24px;"></div>
    `;

    const profilePosts = document.getElementById("profilePosts");
    const tabPosts = profileContent.querySelector('.profile-tabs .tab:nth-child(1)');
    const tabLikes = profileContent.querySelector('.profile-tabs .tab:nth-child(2)');

    const renderPosts = (posts) => {
      profilePosts.innerHTML = "";
      if (posts.length === 0) {
        profilePosts.innerHTML = `<p style="color: var(--muted); text-align: center; padding: 40px;">No posts yet.</p>`;
      } else {
        posts.forEach(post => {
          profilePosts.appendChild(createPostElement(post));
        });
      }
    };

    renderPosts(userPosts);

    tabPosts.addEventListener('click', () => {
      tabPosts.classList.add('active');
      tabLikes.classList.remove('active');
      renderPosts(userPosts);
    });

    tabLikes.addEventListener('click', async () => {
      tabLikes.classList.add('active');
      tabPosts.classList.remove('active');
      profilePosts.innerHTML = `<div style="padding: 40px; color: var(--muted); text-align: center;">Loading likes...</div>`;
      try {
        const likesRes = await fetch(`/users/${userId}/likes`);
        const likedPosts = await likesRes.json();
        renderPosts(likedPosts);
      } catch (e) {
        showFeedback("Could not load likes", "error");
      }
    });
    


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
        <button class="btn-pill btn-edit" onclick="MapsTo('feed')">Return to Feed</button>
      </div>
    `;
  }
}

function showFeed() {
  hideAllViews();
  feedView.classList.remove("hidden");
  navFeed.classList.add("active");
  setMobileNavActive("mobNavFeed");
  loadFeed();
}

function showSearchView() {
  hideAllViews();
  searchView.classList.remove("hidden");
  navSearch.classList.add("active");
  setMobileNavActive("mobNavSearch");
  setTimeout(() => searchInput && searchInput.focus(), 100);
}

async function showNotifications() {
  hideAllViews();
  notificationsView.classList.remove("hidden");
  if (navNotifications) navNotifications.classList.add("active");
  setMobileNavActive("mobNavNotifications");
  
  notificationsContent.innerHTML = `<div style="padding: 40px; color: var(--muted); text-align: center;">Loading...</div>`;
  
  try {
    const res = await fetch("/notifications");
    const notifications = await res.json();
    
    if (notifications.length === 0) {
      notificationsContent.innerHTML = `<div style="padding: 80px 20px; text-align: center; color: var(--muted);">
        <div style="margin-bottom: 20px; opacity: 0.5;"><img src="./assets/bell.png" width="48" height="48"></div>
        <p style="font-weight: 700; font-size: 18px; color: rgba(255,255,255,0.6);">No notifications yet</p>
        <p style="font-size: 14px; margin-top: 8px;">Interactions with your profile will appear here.</p>
      </div>`;
      return;
    }

    notificationsContent.innerHTML = "";
    notifications.forEach(n => {
      const el = document.createElement("div");
      el.className = `notification-item ${n.is_read ? '' : 'unread'}`;
      el.style = "padding: 16px; border-bottom: 1px solid var(--panel-border); display: flex; gap: 16px; align-items: flex-start; cursor: pointer;";
      el.dataset.id = n.id;
      
      let text = "";
      let icon = "";
      let isSystem = false;

      if (n.type === 'like') { text = "liked your post"; icon = "❤️"; }
      else if (n.type === 'follow') { text = "started following you"; icon = "👤"; }
      else if (n.type === 'comment') { text = "commented on your post"; icon = "💬"; }
      else if (n.type === 'message') { text = "sent you a message"; icon = "✉️"; }
      else if (n.type === 'warning') { 
        text = "You received a warning"; 
        icon = "⚠️";
        isSystem = true;
      }

      el.innerHTML = `
        <div class="mini-avatar" style="width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; background: ${isSystem ? 'rgba(217, 119, 6, 0.08)' : 'transparent'}; border: ${isSystem ? '1px solid rgba(217, 119, 6, 0.15)' : '0'}; border-radius: 50%;">
          ${isSystem 
            ? `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#d97706" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>` 
            : (n.sender_avatar ? `<img src="${n.sender_avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />` : (n.sender_emoji || "👤"))
          }
        </div>
        <div style="flex: 1;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <span style="font-weight: 800; color: #fff;">${isSystem ? "System" : (n.sender_display_name || n.sender_username)}</span>
            <span style="font-size: 13px; color: ${isSystem ? '#d97706' : 'var(--muted)'}; font-weight: ${isSystem ? '500' : '400'};">${text}</span>
          </div>
          ${(n.post_content || n.message_preview) ? `<p style="font-size: 14px; color: var(--muted); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; opacity: 0.8;">${n.post_content || n.message_preview}</p>` : ""}
          <span style="font-size: 11px; color: var(--muted); opacity: 0.5; margin-top: 4px; display: block;">${timeAgo(new Date(n.created_at))}</span>
        </div>
        <div style="font-size: 18px; opacity: 0.6;">${isSystem ? "" : icon}</div>
        <div class="notification-swipe-action" onclick="deleteNotification('${n.id}', this.parentElement)">Delete</div>
      `;
      
      // Right Click to Delete
      el.oncontextmenu = (e) => {
        e.preventDefault();
        deleteNotification(n.id, el);
      };

      // Swipe to Delete (Mobile)
      let touchStartX = 0;
      el.ontouchstart = (e) => touchStartX = e.touches[0].clientX;
      el.ontouchmove = (e) => {
        const touchX = e.touches[0].clientX;
        const diff = touchStartX - touchX;
        if (diff > 50) el.classList.add('swiped');
        if (diff < -50) el.classList.remove('swiped');
        
        // Auto-delete on deep swipe
        if (diff > 150) {
           el.style.transition = 'transform 0.2s';
           el.style.transform = 'translateX(-100%)';
           setTimeout(() => deleteNotification(n.id, el), 200);
        }
      };

      el.onclick = (e) => {
        if (e.target.classList.contains('notification-swipe-action')) return;
        if (n.type === 'warning') {
          showWarningModalDirectly();
        } else if (n.type === 'message') {
          MapsTo('messages/' + n.sender_id);
        } else if (n.post_id) {
          MapsTo('post/' + n.post_id);
        } else {
          MapsTo('profile/' + n.sender_id);
        }
      };
      notificationsContent.appendChild(el);
    });

    // Mark all as read
    fetch("/notifications/read", { method: "POST" });
    updateNotificationBadge(false);
  } catch (err) {
    notificationsContent.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--muted);">Error loading notifications.</div>`;
  }
}

async function deleteNotification(id, element) {
  showConfirm("Remove Notice?", "This notification will be permanently deleted from your feed.", async () => {
    try {
      const res = await fetch(`/notifications/${id}`, { method: "DELETE" });
      if (res.ok) {
        element.style.transform = "translateX(-100%)";
        element.style.opacity = "0";
        setTimeout(() => {
          element.remove();
          if (notificationsContent.children.length === 0) {
              showNotifications(); // Show empty state
          }
        }, 300);
        showFeedback("Notification removed", "success");
      }
    } catch (e) {
      showFeedback("Failed to delete", "error");
    }
  });
}

async function clearAllNotifications() {
  showConfirm("Clear All?", "All notifications will be permanently removed. This cannot be undone.", async () => {
    try {
      const res = await fetch("/notifications/clear-all", { method: "DELETE" });
      if (res.ok) {
        MapsTo('notifications');
        showFeedback("Inbox cleared", "success");
      }
    } catch (e) {
      showFeedback("Failed to clear inbox", "error");
    }
  });
}

// Custom Confirmation Modal Logic

function showConfirm(title, message, onConfirm) {
  if (!confirmModal) return;
  confirmTitle.textContent = title;
  confirmMessage.textContent = message;
  confirmModal.classList.add("show");

  const close = () => confirmModal.classList.remove("show");
  
  confirmCancel.onclick = close;
  confirmProceed.onclick = async () => {
    close();
    await onConfirm();
  };
}

async function updateNotificationBadge(hasUnread) {
  const badge = document.getElementById("unreadBadge");
  const mobBadge = document.getElementById("mobUnreadBadge");
  if (badge) {
    badge.style.display = hasUnread ? "block" : "none";
    badge.setAttribute("aria-hidden", hasUnread ? "false" : "true");
  }
  if (mobBadge) {
    mobBadge.style.display = hasUnread ? "block" : "none";
    mobBadge.setAttribute("aria-hidden", hasUnread ? "false" : "true");
  }
}

async function checkUnreadNotifications() {
  if (!currentUser) return;
  try {
    const res = await fetch("/notifications");
    const notifications = await res.json();
    const hasUnread = notifications.some(n => !n.is_read);
    updateNotificationBadge(hasUnread);
  } catch (e) {}
}

async function showSinglePost(postId) {
  hideAllViews();
  feedView.classList.remove("hidden");
  const postsList = document.getElementById("feedPosts");
  postsList.innerHTML = `<div style="padding: 40px; color: var(--muted); text-align: center;">Loading post...</div>`;
  
  try {
    // We can reuse the existing search API or add a specific one. 
    // For now, let's just fetch all posts and find the one. 
    // Ideally, we'd have GET /posts/:id
    const res = await fetch(`/posts`);
    const allPosts = await res.json();
    const post = allPosts.find(p => p.id === Number(postId));
    
    postsList.innerHTML = "";
    if (post) {
      postsList.appendChild(createPostElement(post));
    } else {
      postsList.innerHTML = `<div style="padding: 40px; color: var(--muted); text-align: center;">Post not found.</div>`;
    }
  } catch (e) {
    showFeedback("Error loading post", "error");
  }
}

// ═══════════════════════════════════════
// Mobile Navigation & Sidebar Logic
// ═══════════════════════════════════════

function toggleSidebar(show) {
  const sidebar = document.querySelector(".sidebar");
  if (show === undefined) show = !sidebar.classList.contains("open");
  
  sidebar.classList.toggle("open", show);
  sidebarOverlay.classList.toggle("show", show);
  document.body.style.overflow = show ? "hidden" : "";
}

if (mobileMenuBtn) {
  mobileMenuBtn.addEventListener("click", () => toggleSidebar(true));
}

sidebarOverlay.addEventListener("click", () => toggleSidebar(false));

// Mobile Nav Clicks
function setMobileNavActive(id) {
  const items = document.querySelectorAll(".mobile-nav-item");
  items.forEach(item => item.classList.toggle("active", item.id === id));
}

if (mobNavFeed) {
  mobNavFeed.addEventListener("click", (e) => {
    e.preventDefault();
    setMobileNavActive("mobNavFeed");
    MapsTo('feed');
  });
}

if (mobNavSearch) {
  mobNavSearch.addEventListener("click", (e) => {
    e.preventDefault();
    setMobileNavActive("mobNavSearch");
    MapsTo('search');
  });
}

if (mobNavNotifications) {
  mobNavNotifications.addEventListener("click", (e) => {
    e.preventDefault();
    setMobileNavActive("mobNavNotifications");
    MapsTo('notifications');
  });
}

if (mobNavProfile) {
  mobNavProfile.addEventListener("click", (e) => {
    e.preventDefault();
    if (!currentUser) {
      window.location.href = "login.html";
      return;
    }
    setMobileNavActive("mobNavProfile");
    MapsTo('profile/' + currentUser.id);
  });
}

// Sync Sidebar Nav with Mobile Nav
const sidebarLinks = document.querySelectorAll(".nav-item, .footer-link");
sidebarLinks.forEach(link => {
  link.addEventListener("click", () => {
    if (window.innerWidth <= 900) {
      toggleSidebar(false);
    }
  });
});

// ═══════════════════════════════════════
// Search Logic
// ═══════════════════════════════════════

async function performSearch(query) {
  if (!query || query.length < 1) {
    searchResults.innerHTML = `
      <div class="search-empty-state">
        <div class="search-empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:48px;height:48px;opacity:0.5;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        </div>
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
        <div class="search-empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:48px;height:48px;opacity:0.5;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        </div>
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
    const avatarHtml = user.avatar_path 
      ? `<img src="${user.avatar_path}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`
      : user.emoji || "👤";
    const bioSnippet = user.bio ? `<div class="search-user-bio">${highlightText(user.bio, query)}</div>` : '';
    html += `
      <div class="search-user-card" data-user-id="${user.id}" style="animation-delay: ${i * 0.05}s">
        <div class="search-user-avatar">${avatarHtml}</div>
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
      if (uid) MapsTo('profile/' + uid);
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

      // Add font style for premium users
      if (currentUser && currentUser.is_premium) {
        formData.append("font_style", selectedFont);
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

if (pickImageButton) {
  pickImageButton.addEventListener("click", () => {
    if (currentUser && currentUser.is_premium) {
      imageInput.click();
    } else {
      if (coreFlowModal) coreFlowModal.classList.add('show');
    }
  });
}
if (imageInput) {
  imageInput.addEventListener("change", () => {
    const file = imageInput.files && imageInput.files[0];
    if (file) {
      if (file.type === "image/gif") {
        showFeedback("GIFs are not allowed.", "error");
        imageInput.value = "";
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        showFeedback("File too large. Max 5MB.", "error");
        imageInput.value = "";
        return;
      }
      if (file.type.startsWith("image/")) {
        selectedImageFile = file;
        updateImagePreview(file);
      }
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
  await unsubscribeFromPush();
  const res = await fetch("/auth/logout", { method: "POST" });
  if (res.ok) window.location.reload();
});

navFeed.addEventListener("click", (e) => { e.preventDefault(); MapsTo('feed'); });
if (navSearch) navSearch.addEventListener("click", (e) => { e.preventDefault(); MapsTo('search'); });
if (document.getElementById("navNotifications")) document.getElementById("navNotifications").addEventListener("click", (e) => { e.preventDefault(); MapsTo('notifications'); });
if (document.getElementById("btnClearAll")) document.getElementById("btnClearAll").addEventListener("click", () => clearAllNotifications());
navProfile.addEventListener("click", (e) => { 
  e.preventDefault(); 
  if (currentUser) MapsTo('profile/' + currentUser.id); 
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
  const followBtn = event.target.closest(".btn-follow");
  const postElement = event.target.closest(".post");
  
  if (followBtn) {
    const targetId = followBtn.dataset.userId;
    handleFollow(targetId, followBtn);
    return;
  }

  if (!postElement) return;
  const postId = postElement.dataset.postId;
 
  // HANDLE LIKES
  if (likeBtn) {
    if (!currentUser) { window.location.href = "login.html"; return; }
    if (pendingPostActions.has(`like-${postId}`)) return;
    pendingPostActions.add(`like-${postId}`);
    const isLiked = likeBtn.classList.contains("liked");

    try {
      const res = await fetch(`${API_URL}/posts/${postId}/like`, {
        method: isLiked ? "DELETE" : "POST",
        credentials: "include"
      });
      if (res.ok) {
        const data = await res.json();
        const count = postElement.querySelector(".likes-count");
        if (count) count.textContent = formatNumber(data.likes);
        likeBtn.classList.toggle("liked", !isLiked);
        showFeedback(isLiked ? "Unliked." : "Liked!", "success");
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

  if (!container.classList.contains("hidden") && container.innerHTML !== "") {
    container.classList.add("hidden");
    container.innerHTML = "";
    return;
  }

  container.classList.remove("hidden");
  container.innerHTML = `<div style="padding: 20px; color: var(--muted); text-align: center;">Loading thoughts...</div>`;

  try {
    const res = await fetch(`${API_URL}/posts/${postId}/comments`);
    const comments = await res.json();
    
    renderInlineComments(postId, postElement, comments);
  } catch (err) {
    container.innerHTML = `<div style="padding: 20px; color: #f87171; text-align: center;">Failed to load comments.</div>`;
  }
}

function renderInlineComments(postId, postElement, comments) {
    const container = postElement.querySelector(".comments-container");
    const postOwnerId = Number(postElement.dataset.ownerId);
    let html = `<div class="comments-section">`;
    
    comments.forEach(c => {
      const avatarHtml = c.avatar_path 
        ? `<img src="${c.avatar_path}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`
        : c.emoji || "👤";

      html += `
        <div class="comment">
          <div class="mini-avatar">${avatarHtml}</div>
          <div class="comment-bubble">
            <div class="author">
               <span class="${c.is_premium ? 'premium-name-gradient' : ''}">${c.display_name || c.username}</span>
               <span class="comment-date">${formatSocialDate(c.created_at)}</span>
               ${currentUser && Number(currentUser.id) === postOwnerId ? `<button class="comment-delete-btn" data-comment-id="${c.id}" style="margin-left:auto; background:none; border:none; color:#f87171; cursor:pointer; font-size:12px;">Delete</button>` : ""}
            </div>
            <div class="text">${c.content}</div>
          </div>
        </div>
      `;
    });

    if (currentUser) {
      html += `
        <form class="comment-form" style="padding: 16px; border-top: 1px solid rgba(255,255,255,0.05); margin-top: 8px;">
          <input type="text" placeholder="Add your thought..." required />
          <button type="submit" class="btn-send-comment">➜</button>
        </form>
      `;
    } else {
      html += `<p style="padding: 16px; font-size: 12px; color: var(--muted); text-align: center;">Login to join the conversation.</p>`;
    }

    html += `</div>`;
    container.innerHTML = html;

    container.querySelectorAll(".comment-delete-btn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const commentId = btn.dataset.commentId;
        try {
          const res = await fetch(`${API_URL}/posts/${postId}/comments/${commentId}`, {
            method: "DELETE",
            credentials: "include"
          });
          if (res.ok) {
            const refreshRes = await fetch(`${API_URL}/posts/${postId}/comments`);
            const updatedComments = await refreshRes.json();
            renderInlineComments(postId, postElement, updatedComments);
            const countEl = postElement.querySelector(".comments-count");
            if (countEl) {
              const current = Math.max(0, (parseInt(countEl.textContent.replace(/[^0-9]/g, "")) || 1) - 1);
              countEl.textContent = formatNumber(current);
            }
          } else {
            const err = await res.json();
            showFeedback(err.error || "Failed to delete comment", "error");
          }
        } catch (err) {
          showFeedback("Failed to delete comment", "error");
        }
      });
    });

    const form = container.querySelector(".comment-form");
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        const input = form.querySelector("input");
        const content = input.value.trim();
        if (!content) return;

        try {
          const postRes = await fetch(`${API_URL}/posts/${postId}/comments`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content })
          });
          if (postRes.ok) {
            input.value = "";
            const refreshRes = await fetch(`${API_URL}/posts/${postId}/comments`);
            const updatedComments = await refreshRes.json();
            renderInlineComments(postId, postElement, updatedComments);
            
            // Scroll container to bottom
            container.scrollTop = container.scrollHeight;
            
            // Update count
            const countEl = postElement.querySelector(".comments-count");
            if (countEl) {
                const current = parseInt(countEl.textContent.replace(/[^0-9]/g, "")) || 0;
                countEl.textContent = formatNumber(current + 1);
            }
          }
        } catch (err) {
          showFeedback("Failed to post comment", "error");
        }
      };
    }
}

// Settings Logic
function openSettings(tab = "account", push = true) {
  if (!currentUser) return;
  if (push) {
    MapsTo('settings/' + tab);
    return;
  }
  settingsModal.classList.add("show");
  settingsUsername.value = currentUser.username;
  if (settingsDisplayName) settingsDisplayName.value = currentUser.display_name || "";
  settingsBio.value = currentUser.bio || "";
  settingsUserEmoji.textContent = currentUser.emoji;

  // Initialize previews
  if (currentUser.avatar_path && avatarPreview) {
    avatarPreview.innerHTML = `<img src="${currentUser.avatar_path}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`;
    if (removeAvatarBtn) removeAvatarBtn.classList.remove("hidden");
  } else if (avatarPreview) {
    avatarPreview.innerHTML = currentUser.emoji;
    if (removeAvatarBtn) removeAvatarBtn.classList.add("hidden");
  }

  if (currentUser.banner_path && bannerPreview) {
    bannerPreview.innerHTML = `<img src="${currentUser.banner_path}" />`;
    if (removeBannerBtn) removeBannerBtn.classList.remove("hidden");
  } else if (bannerPreview) {
    bannerPreview.innerHTML = `<div class="banner-placeholder">Banner Preview</div>`;
    if (removeBannerBtn) removeBannerBtn.classList.add("hidden");
  }

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

  // Lock premium features
  const isPremium = currentUser && !!currentUser.is_premium;
  const isSynced = true;
  
  if (avatarUploadArea) {
    avatarUploadArea.classList.toggle('locked', !isPremium || !isSynced);
    avatarUploadArea.style.pointerEvents = (isPremium && isSynced) ? 'auto' : 'none';
  }
  if (avatarLockedMsg) {
    avatarLockedMsg.classList.toggle('hidden', isPremium && isSynced);
    if (isPremium && !isSynced) {
      avatarLockedMsg.innerHTML = '<span>??</span> Custom avatars are a <strong>Core Flow</strong> exclusive feature.';
    } else if (!isPremium) {
      avatarLockedMsg.innerHTML = '<span>??</span> Custom avatars are a <strong>Core Flow</strong> exclusive feature.';
    }
  }
  
  if (bannerUploadArea) {
    bannerUploadArea.classList.toggle('locked', !isPremium || !isSynced);
    bannerUploadArea.style.pointerEvents = (isPremium && isSynced) ? 'auto' : 'none';
  }
  if (bannerLockedMsg) {
    bannerLockedMsg.classList.toggle('hidden', isPremium && isSynced);
    if (!isSynced) {
      bannerLockedMsg.innerHTML = '<span>??</span> Custom banners are a <strong>Core Flow</strong> exclusive feature.';
    } else {
      bannerLockedMsg.innerHTML = '<span>??</span> Custom banners are a <strong>Core Flow</strong> exclusive feature.';
    }
  }
}

if (closeSettings) {
  closeSettings.addEventListener("click", () => window.history.back());
}

settingsModal.addEventListener("click", (e) => {
  if (e.target === settingsModal) window.history.back();
});

settingsNavItems.forEach(btn => {
  btn.addEventListener("click", () => MapsTo('settings/' + btn.dataset.tab));
});

if (saveProfile) {
  saveProfile.addEventListener("click", async () => {
    const username = settingsUsername.value.trim();
    const display_name = settingsDisplayName ? settingsDisplayName.value.trim() : "";
    const bio = settingsBio.value.trim();
    
    if (!username) return showFeedback("Username is required", "error");

    saveProfile.disabled = true;
    saveProfile.textContent = "Saving...";

    try {
      const res = await fetch(`${API_URL}/auth/update-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, display_name, bio })
      });

      if (!res.ok) throw new Error(await getErrorMessage(res, "Update failed"));

      showFeedback("Profile updated!", "success");
      
      // Update local state and UI
      currentUser.username = username;
      currentUser.display_name = display_name;
      currentUser.bio = bio;
      
      updateAuthUI();
      
      // If we are on the profile page, refresh it
      if (!profileView.classList.contains("hidden")) {
        MapsTo('profile/' + currentUser.id, false);
      }
      
      window.history.back();
    } catch (err) {
      showFeedback(err.message, "error");
    } finally {
      saveProfile.disabled = false;
      saveProfile.textContent = "Save Changes";
    }
  });
}

// ═══════════════════════════════════════
// Core Flow (Premium) Logic
// ═══════════════════════════════════════

// Font Selection logic
if (fontBtns) {
  fontBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      fontBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedFont = btn.dataset.font;
      
      // Visual feedback in input
      postInput.className = '';
      if (selectedFont !== 'default') {
        postInput.classList.add(`font-${selectedFont}`);
      }
    });
  });
}

// Activate Core Flow logic
if (activateCoreFlowBtn) {
  activateCoreFlowBtn.addEventListener('click', async () => {
    if (!currentUser) return;
    
    activateCoreFlowBtn.disabled = true;
    activateCoreFlowBtn.textContent = 'Activating...';
    
    try {
      const res = await fetch(`${API_URL}/auth/activate-premium`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        showFeedback(data.message, 'success');
        
        // Refresh user data
        await fetchCurrentUser();
        
        // Refresh feed to show new styles
        await loadFeed();
        
        // Close settings or switch tab
        switchSettingsTab('account');
      } else {
        showFeedback('Activation failed. Please try again.', 'error');
      }
    } catch (err) {
      showFeedback('Error activating Core Flow', 'error');
    } finally {
      activateCoreFlowBtn.disabled = false;
      activateCoreFlowBtn.textContent = 'Activate';
    }
  });
}

// Avatar Upload logic
if (avatarFileInput) {
  avatarFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!currentUser || !currentUser.is_premium) {
      showFeedback('Custom avatars require Core Flow.', 'info');
      return;
    }

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      showFeedback('Uploading avatar...', 'info');
      const res = await fetch(`${API_URL}/auth/upload-avatar`, {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        currentUser.avatar_path = data.avatar_path;
        updateAuthUI();
        
        // Update preview in settings
        if (avatarPreview) {
          avatarPreview.innerHTML = `<img src="${data.avatar_path}" />`;
        }
        if (removeAvatarBtn) removeAvatarBtn.classList.remove('hidden');
        
        showFeedback('Avatar updated!', 'success');
      } else {
        const err = await res.json();
        showFeedback(err.error || 'Upload failed', 'error');
      }
    } catch (err) {
      showFeedback('Error uploading avatar', 'error');
    }
  });
}

if (removeAvatarBtn) {
  removeAvatarBtn.addEventListener('click', async () => {
    // Logic to remove avatar could be added here
  });
}
// Banner Upload logic
if (bannerFileInput) {
  bannerFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!currentUser || !currentUser.is_premium) {
      showFeedback('Custom banners require Core Flow.', 'info');
      return;
    }

    const formData = new FormData();
    formData.append('banner', file);

    try {
      showFeedback('Uploading banner...', 'info');
      
      const res = await fetch(`${API_URL}/auth/upload-banner`, {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        currentUser.banner_path = data.banner_path;
        
        // Update preview in settings
        if (bannerPreview) {
          bannerPreview.innerHTML = `<img src="${data.banner_path}?v=${Date.now()}" />`;
        }
        if (removeBannerBtn) removeBannerBtn.classList.remove('hidden');
        
        showFeedback('Banner updated successfully!', 'success');
        
        // Reset input so same file can be picked again
        bannerFileInput.value = '';

        // Refresh profile if visible
        if (!profileView.classList.contains("hidden") && currentUser) {
          MapsTo('profile/' + currentUser.id, false);
        }
      } else {
        const err = await res.json();
        showFeedback(err.error || 'Upload failed', 'error');
        bannerFileInput.value = '';
      }
    } catch (err) {
      showFeedback('Error uploading banner', 'error');
      bannerFileInput.value = '';
    }
  });
}



if (removeBannerBtn) {
  removeBannerBtn.addEventListener('click', async () => {
    if (!confirm('Remove your custom banner?')) return;
    try {
      const res = await fetch(`${API_URL}/auth/remove-banner`, { method: 'POST' });
      if (res.ok) {
        currentUser.banner_path = null;
        bannerPreview.innerHTML = `<div class="banner-placeholder">Banner Preview</div>`;
        removeBannerBtn.classList.add('hidden');
        showFeedback('Banner removed', 'success');
        if (!profileView.classList.contains("hidden") && currentUser) {
          MapsTo('profile/' + currentUser.id, false);
        }
      }
    } catch (err) {
      showFeedback('Error removing banner', 'error');
    }
  });
}

// Navigation Listeners
navFeed.addEventListener("click", (e) => { e.preventDefault(); MapsTo('feed'); });
if (navSearch) navSearch.addEventListener("click", (e) => { e.preventDefault(); MapsTo('search'); });
navProfile.addEventListener("click", (e) => { 
  e.preventDefault(); 
  if (currentUser) MapsTo('profile/' + currentUser.id); 
  else window.location.href = "login.html";
});

// Feed Mode Listeners
if (tabExplore) tabExplore.addEventListener("click", () => switchFeedMode("explore"));
if (tabFollowing) tabFollowing.addEventListener("click", () => switchFeedMode("following"));

// Core Flow Sidebar Link
if (navCoreFlow) {
  navCoreFlow.addEventListener("click", (e) => {
    e.preventDefault();
    if (!currentUser) {
      window.location.href = "login.html";
      return;
    }

    if (!currentUser.isSynced && !currentUser.is_premium) {
      confirmTitle.textContent = "Connect Mail First";
      confirmMessage.textContent = "You need Core Flow before upgrading.";
      confirmProceed.textContent = "Add Now";
      confirmProceed.className = "btn-pill btn-edit";
      confirmModal.classList.add("show");

      confirmProceed.onclick = () => {
        confirmModal.classList.remove("show");
        openSettings('security');
      };
      confirmCancel.onclick = () => confirmModal.classList.remove("show");
      return;
    }

    // If already premium, show account settings, otherwise show the new upgrade modal
    if (currentUser.is_premium) {
      openSettings('account');
    } else {
      if (coreFlowModal) coreFlowModal.classList.add('show');
    }
  });
}

// Intercept checkout form if not synced
if (checkoutForm) {
  checkoutForm.addEventListener("submit", (e) => {
    if (!currentUser.isSynced && !currentUser.is_premium) {
      e.preventDefault();
      if (coreFlowModal) coreFlowModal.classList.remove('show');
      
      confirmTitle.textContent = "Connect Mail First";
      confirmMessage.textContent = "You need Core Flow before upgrading.";
      confirmProceed.textContent = "Add Now";
      confirmProceed.className = "btn-pill btn-edit";
      confirmModal.classList.add("show");

      confirmProceed.onclick = () => {
        confirmModal.classList.remove("show");
        openSettings('security');
      };
      confirmCancel.onclick = () => confirmModal.classList.remove("show");
    }
  });
}

// Core Flow Modal Logic
if (closeCoreFlow) {
  closeCoreFlow.addEventListener("click", () => coreFlowModal.classList.remove("show"));
}

if (coreFlowModal) {
  coreFlowModal.addEventListener("click", (e) => {
    if (e.target === coreFlowModal) coreFlowModal.classList.remove("show");
  });
}

if (activateCoreFlowModal) {
  activateCoreFlowModal.addEventListener('click', async () => {
    if (!currentUser) return;
    
    activateCoreFlowModal.disabled = true;
    activateCoreFlowModal.textContent = 'Activating...';
    
    try {
      const res = await fetch("/auth/activate-premium", { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (res.ok) {
        const data = await res.json();
        showFeedback(data.message, 'success');
        
        // Update local user state immediately
        if (currentUser) {
          currentUser.is_premium = 1;
        }
        updateAuthUI();
        
        // Refresh full user data
        await fetchCurrentUser();
        
        // Refresh feed to show new styles
        await loadFeed();
        
        // Close modal
        setTimeout(() => {
           if (coreFlowModal) coreFlowModal.classList.remove('show');
        }, 1500);
      } else {
        const err = await res.json();
        showFeedback(err.error || 'Activation failed. Are you logged in?', 'error');
        console.error("Activation failed:", err);
      }
    } catch (err) {
      showFeedback('Network error during activation. Check server.', 'error');
      console.error("Network error:", err);
    } finally {
      activateCoreFlowModal.disabled = false;
      activateCoreFlowModal.textContent = 'Activate Core Flow';
    }
  });
}

// ═══════════════════════════════════════
// Email Sync Interaction
// ═══════════════════════════════════════

if (btnRequestSync) {
  btnRequestSync.addEventListener("click", async () => {
    const emailInputEl = document.getElementById("email") || document.getElementById("syncEmailInput");
    const rawEmail = emailInputEl ? emailInputEl.value.trim() : "";
    
    if (!rawEmail || !rawEmail.includes("@")) {
      showFeedback("Please enter a valid email address.", "error");
      return;
    }

    if (typeof setPostFormState === "function") setPostFormState(true);
    btnRequestSync.disabled = true;
    btnRequestSync.textContent = "...";

    try {
      const response = await fetch("/api/sync-request", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: rawEmail })
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.isSynced) {
          currentUser.isSynced = true;
          currentUser.email = rawEmail;
          updateAuthUI();
          openSettings('security', false);
          showFeedback(data.message || "Email verified!", "success");
          return;
        }

        syncEmailAddress.textContent = rawEmail;
        if (syncEmailForm) syncEmailForm.classList.add("hidden");
        verifySyncForm.classList.remove("hidden");
        showFeedback(data.message || "Verification code sent!", "success");
      } else {
        const err = await response.json();
        showFeedback(err.error || "Failed to send code.", "error");
      }
    } catch (err) {
      showFeedback("Error connecting to server.", "error");
    } finally {
      btnRequestSync.disabled = false;
      btnRequestSync.textContent = "Send Code";
      if (typeof setPostFormState === "function") setPostFormState(false);
    }
  });
}

if (btnVerifySync) {
  btnVerifySync.addEventListener("click", async () => {
    const email = syncEmailAddress.textContent;
    const code = syncCodeInput.value.trim();

    if (code.length !== 6) {
      showFeedback("Please enter the 6-digit code.", "error");
      return;
    }

    btnVerifySync.disabled = true;
    btnVerifySync.textContent = "...";

    try {
      const res = await fetch("/api/sync-verify", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code })
      });

      if (res.ok) {
        const data = await res.json();
        currentUser.isSynced = true;
        currentUser.is_verified = true;
        currentUser.email = email;
        
        // Update UI
        updateAuthUI();
        openSettings('security', false);
        showFeedback("Email synced & Verified!", "success");
      } else {
        const err = await res.json();
        showFeedback(err.error || "Verification failed.", "error");
      }
    } catch (err) {
      showFeedback("Error connecting to server.", "error");
    } finally {
      btnVerifySync.disabled = false;
      btnVerifySync.textContent = "Verify";
    }
  });
}

if (btnCancelSync) {
  btnCancelSync.addEventListener("click", () => {
    if (verifySyncForm) verifySyncForm.classList.add("hidden");
    if (syncEmailForm) syncEmailForm.classList.remove("hidden");
    syncCodeInput.value = "";
  });
}

if (btnUnlinkRequest) {
  btnUnlinkRequest.addEventListener("click", async (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    btnUnlinkRequest.disabled = true;
    btnUnlinkRequest.textContent = "...";

    try {
      const res = await fetch("/api/unlink-request", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" }
      });

      if (res.ok) {
        const data = await res.json();
        btnUnlinkRequest.style.display = "none";
        verifyUnlinkForm.classList.remove("hidden");
        showFeedback(data.message || "Verification code sent!", "success");
      } else {
        const err = await res.json();
        showFeedback(err.error || "Failed to initiate unlink.", "error");
        btnUnlinkRequest.disabled = false;
        btnUnlinkRequest.textContent = "Unlink Account Email";
      }
    } catch (err) {
      showFeedback("Error connecting to server.", "error");
      btnUnlinkRequest.disabled = false;
      btnUnlinkRequest.textContent = "Unlink Account Email";
    }
  });
}

if (btnUnlinkVerify) {
  btnUnlinkVerify.addEventListener("click", async (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    const code = unlinkCodeInput.value.trim();
    if (code.length !== 6) {
      showFeedback("Please enter the 6-digit code.", "error");
      return;
    }

    btnUnlinkVerify.disabled = true;
    btnUnlinkVerify.textContent = "...";

    try {
      const res = await fetch("/api/unlink-verify", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code })
      });

      if (res.ok) {
        const data = await res.json();
        currentUser.isSynced = false;
        currentUser.is_verified = false;
        currentUser.email = null;

        verifyUnlinkForm.classList.add("hidden");
        btnUnlinkRequest.style.display = "block";
        btnUnlinkRequest.disabled = false;
        btnUnlinkRequest.textContent = "Unlink Account Email";
        unlinkCodeInput.value = "";

        updateAuthUI();
        openSettings('security', false);
        showFeedback("Email successfully unlinked!", "success");
      } else {
        const err = await res.json();
        showFeedback(err.error || "Unlink verification failed.", "error");
      }
    } catch (err) {
      showFeedback("Error connecting to server.", "error");
    } finally {
      btnUnlinkVerify.disabled = false;
      btnUnlinkVerify.textContent = "Verify & Unlink";
    }
  });
}

if (btnUnlinkCancel) {
  btnUnlinkCancel.addEventListener("click", (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    verifyUnlinkForm.classList.add("hidden");
    btnUnlinkRequest.style.display = "block";
    btnUnlinkRequest.disabled = false;
    btnUnlinkRequest.textContent = "Unlink Account Email";
    unlinkCodeInput.value = "";
  });
}

async function handleFollow(userId, button) {
  if (!currentUser) { window.location.href = "login.html"; return; }
  if (button.disabled) return;

  const isFollowing = button.classList.contains("following");
  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = "...";

  try {
    const res = await fetch(`/users/${userId}/follow`, {
      method: isFollowing ? "DELETE" : "POST"
    });

    if (res.ok) {
      const data = await res.json();
      const nowFollowing = !isFollowing;
      button.classList.toggle("following", nowFollowing);
      button.textContent = nowFollowing ? "Following" : "Follow";
      showFeedback(data.message, "success");

      // Update counts instantly
      const followerCountEl = document.getElementById("followerCountDisplay");
      if (followerCountEl) {
        const b = followerCountEl.querySelector("b");
        let count = parseInt(b.textContent.replace(/[^0-9]/g, "")) || 0;
        count = nowFollowing ? count + 1 : Math.max(0, count - 1);
        b.textContent = formatNumber(count);
      }
    } else {
      const err = await res.json();
      showFeedback(err.error || "Action failed", "error");
      button.textContent = originalText;
    }
  } catch (err) {
    showFeedback("Error connecting to server", "error");
    button.textContent = originalText;
  } finally {
    button.disabled = false;
  }
}

// ═══════════════════════════════════════


(async function init() {
  await fetchCurrentUser();
  await setupPushNotifications();
  
  const searchParams = new URLSearchParams(window.location.search);
  if (searchParams.get("checkout") === "success") {
    showFeedback("Successfully upgraded to Core Flow!", "success");
    if (currentUser) {
      window.history.replaceState({ viewPath: 'profile/' + currentUser.id }, document.title, window.location.pathname + `#profile/${currentUser.id}`);
      MapsTo('profile/' + currentUser.id, false);
      return;
    }
  }

  // Handle initial hash navigation
  const hash = window.location.hash.slice(1);
  if (hash) {
    MapsTo(hash, false);
  } else {
    // Set initial state to feed without pushing to history stack
    window.history.replaceState({ viewPath: 'feed' }, "", "#feed");
    showFeed();
  }
  
  // Notification polling
  checkUnreadNotifications();
  setInterval(checkUnreadNotifications, 30000); // Check every 30s
})();

// ═══════════════════════════════════════
// Messaging Logic
// ═══════════════════════════════════════

let socket;
let currentChatUserId = null;

function initSocket() {
  if (!socket && currentUser) {
    socket = io();
    socket.on('connect', () => {
      socket.emit('register', currentUser.id);
    });

    socket.on('new_notification', (notification) => {
      if (notification && notification.type === 'message') {
        updateNotificationBadge(true);
      }
    });

    socket.on('receive_message', (msg) => {
      if (msg.sender_id !== currentUser.id) {
        updateNotificationBadge(true);
      }

      if (currentChatUserId && (msg.sender_id === Number(currentChatUserId) || msg.receiver_id === Number(currentChatUserId))) {
        appendMessage(msg);
        scrollToBottom();
      } else {
        if (msg.sender_id !== currentUser.id) {
          showFeedback("New message received", "info");
        }
      }
    });
  }
}

async function showMessages(friendId) {
  if (!currentUser) return window.location.href = "login.html";
  
  if (!socket) initSocket();
  hideAllViews();
  currentChatUserId = friendId;
  if (messagesView) messagesView.classList.remove("hidden");
  
  try {
    const userRes = await fetch(`/auth/users/${friendId}`);
    if (userRes.ok) {
      const userData = (await userRes.json()).user;
      document.getElementById("chatUserName").textContent = userData.display_name || userData.username;
    }
  } catch (e) {}

  const chatMessages = document.getElementById("chatMessages");
  chatMessages.innerHTML = `<div style="text-align:center; color: var(--muted); padding: 20px;">Loading chat...</div>`;
  
  try {
    const res = await fetch(`/api/messages/${friendId}`);
    const messages = await res.json();
    
    chatMessages.innerHTML = "";
    if (messages.length === 0) {
      chatMessages.innerHTML = `<div style="text-align:center; color: var(--muted); padding: 20px;">Say hi!</div>`;
    } else {
      messages.forEach(appendMessage);
      scrollToBottom();
    }
  } catch(e) {
    chatMessages.innerHTML = `<div style="text-align:center; color: var(--muted); padding: 20px;">Error loading messages.</div>`;
  }
}

function appendMessage(msg) {
  const chatMessages = document.getElementById("chatMessages");
  if (chatMessages.innerHTML.includes("Say hi!")) {
    chatMessages.innerHTML = "";
  }

  const isMe = msg.sender_id === currentUser.id;
  const messageDate = new Date(msg.created_at);
  const messageTime = messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const previousBubble = chatMessages.lastElementChild;
  const previousSenderId = previousBubble ? Number(previousBubble.dataset.senderId) : null;
  const previousDateMs = previousBubble ? Number(previousBubble.dataset.createdAtMs) : null;
  const shouldShowTime = !previousBubble
    || previousSenderId !== msg.sender_id
    || !previousDateMs
    || (messageDate.getTime() - previousDateMs) > 5 * 60 * 1000;
  const div = document.createElement("div");
  div.className = "message-bubble";
  div.dataset.senderId = String(msg.sender_id);
  div.dataset.createdAtMs = String(messageDate.getTime());
  div.style.display = "flex";
  div.style.flexDirection = "column";
  div.style.alignItems = isMe ? "flex-end" : "flex-start";
  div.style.marginBottom = shouldShowTime ? "12px" : "4px";

  div.innerHTML = `
    ${shouldShowTime ? `<span style="font-size: 10px; color: var(--muted); margin: 0 0 3px; opacity: 0.7;">${messageTime}</span>` : ""}
    <div style="max-width: 70%; padding: 10px 14px; border-radius: 18px; background: ${isMe ? '#7c3aed' : 'var(--panel)'}; color: #fff; font-size: 14px; line-height: 1.4; word-wrap: break-word;">
      ${msg.content}
    </div>
  `;
  chatMessages.appendChild(div);
}

function scrollToBottom() {
  const chatMessages = document.getElementById("chatMessages");
  if (chatMessages) {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const chatForm = document.getElementById("chatForm");
  if (chatForm) {
    chatForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = document.getElementById("chatInput");
      const text = input.value.trim();
      if (!text || !currentChatUserId || !socket) return;
      
      socket.emit("send_message", {
        sender_id: currentUser.id,
        receiver_id: Number(currentChatUserId),
        content: text
      });
      
      input.value = "";
    });
  }
});

if (enablePushBtn) {
  enablePushBtn.addEventListener("click", async () => {
    try {
      await subscribeToPush();
      showFeedback("Push notifications enabled.", "success");
    } catch (error) {
      console.error(error);
      showFeedback(error.message || "Failed to enable push notifications.", "error");
    }
  });
}

if (testPushBtn) {
  testPushBtn.addEventListener("click", async () => {
    try {
      const res = await fetch("/api/push/test", {
        method: "POST",
        credentials: "include"
      });
      if (res.ok) {
        showFeedback("Test notification sent.", "success");
      } else {
        const err = await res.json();
        showFeedback(err.error || "Failed to send test notification.", "error");
      }
    } catch (error) {
      showFeedback("Failed to send test notification.", "error");
    }
  });
}








