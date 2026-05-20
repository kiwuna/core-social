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
const feedView = document.getElementById("feedView");
const searchView = document.getElementById("searchView");
const messagesView = document.getElementById("messagesView");
const notificationsView = document.getElementById("notificationsView");
const navFeed = document.getElementById("navFeed");
const navSearch = document.getElementById("navSearch");
const navNotifications = document.getElementById("navNotifications");
const navProfile = document.getElementById("navProfile");
const mobNavFeed = document.getElementById("mobNavFeed");
const mobNavSearch = document.getElementById("mobNavSearch");
const mobNavNotifications = document.getElementById("mobNavNotifications");
const mobNavProfile = document.getElementById("mobNavProfile");
const unreadBadge = document.getElementById("unreadBadge");
const mobUnreadBadge = document.getElementById("mobUnreadBadge");
const logoutBtn = document.getElementById("logoutBtn");
const loginLink = document.getElementById("loginLink");
const messagesContainer = document.getElementById("chatMessages");

let currentUser = null;

async function fetchCurrentUser() {
  try {
    const response = await fetch("/auth/me", { credentials: "include" });
    if (!response.ok) {
      window.location.href = "login.html";
      return null;
    }

    const data = await response.json();
    currentUser = data.user || null;
    return currentUser;
  } catch (error) {
    console.error("Failed to fetch current user:", error);
    window.location.href = "login.html";
    return null;
  }
}

function showFeedback(message, type = "info") {
  if (!feedbackMessage) return;
  feedbackMessage.textContent = message;
  feedbackMessage.dataset.type = type;
  feedbackMessage.style.opacity = "1";
  clearTimeout(window.__feedbackTimer);
  window.__feedbackTimer = setTimeout(() => {
    feedbackMessage.style.opacity = "0";
  }, 2500);
}

function updateNotificationBadge(hasUnread) {
  const display = hasUnread ? "block" : "none";
  if (unreadBadge) unreadBadge.style.display = display;
  if (mobUnreadBadge) mobUnreadBadge.style.display = display;
}

async function checkUnreadNotifications() {
  try {
    const res = await fetch("/notifications", { credentials: "include" });
    if (!res.ok) return;
    const notifications = await res.json();
    updateNotificationBadge(Array.isArray(notifications) && notifications.some((n) => !n.is_read));
  } catch (error) {
    console.error("Failed to check notifications:", error);
  }
}

function hideAllViews() {
  [feedView, searchView, profileView, notificationsView, messagesView].forEach((view) => {
    if (view) view.classList.add("hidden");
  });
}

function setActiveNav(activeId) {
  [navFeed, navSearch, navNotifications, navProfile, mobNavFeed, mobNavSearch, mobNavNotifications, mobNavProfile].forEach((item) => {
    if (!item) return;
    item.classList.remove("active");
  });

  const map = {
    feed: [navFeed, mobNavFeed],
    search: [navSearch, mobNavSearch],
    notifications: [navNotifications, mobNavNotifications],
    profile: [navProfile, mobNavProfile]
  };
  (map[activeId] || []).forEach((item) => item && item.classList.add("active"));
}

function showFeed() {
  hideAllViews();
  if (feedView) feedView.classList.remove("hidden");
  setActiveNav("feed");
}

function showSearch() {
  hideAllViews();
  if (searchView) searchView.classList.remove("hidden");
  setActiveNav("search");
}

function showNotifications() {
  hideAllViews();
  if (notificationsView) notificationsView.classList.remove("hidden");
  updateNotificationBadge(false);
  setActiveNav("notifications");
}

function showProfile(userId = currentUser?.id) {
  hideAllViews();
  if (profileView) profileView.classList.remove("hidden");
  setActiveNav("profile");
  if (userId && typeof loadProfile === "function") loadProfile(userId);
}

async function loadProfile(userId) {
  if (!profileContent) return;
  profileContent.innerHTML = `<div style="padding: 24px; color: var(--muted);">Loading profile...</div>`;
  try {
    const res = await fetch(`/auth/users/${userId}`);
    if (!res.ok) throw new Error("Profile not found");
    const data = await res.json();
    const user = data.user;
    profileContent.innerHTML = `
      <div style="padding: 24px;">
        <h2 style="margin: 0 0 8px; color: #fff;">${user.display_name || user.username}</h2>
        <p style="margin: 0; color: var(--muted);">@${user.username}</p>
        <p style="margin-top: 16px; color: #ddd;">${user.bio || ""}</p>
      </div>
    `;
  } catch (error) {
    profileContent.innerHTML = `<div style="padding: 24px; color: var(--muted);">Unable to load profile.</div>`;
  }
}

function MapsTo(path, pushState = true) {
  if (!path) return;
  if (typeof path === "string" && path.startsWith("profile/")) {
    const userId = path.split("/")[1];
    showProfile(userId);
    if (pushState) window.history.pushState({ viewPath: path }, "", `#${path}`);
    return;
  }
  if (path === "feed") showFeed();
  if (path === "search") showSearch();
  if (path === "notifications") showNotifications();
  if (pushState) window.history.pushState({ viewPath: path }, "", `#${path}`);
}

(async function init() {
  await fetchCurrentUser();
  
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

if (navFeed) navFeed.addEventListener("click", (e) => { e.preventDefault(); MapsTo("feed"); });
if (navSearch) navSearch.addEventListener("click", (e) => { e.preventDefault(); MapsTo("search"); });
if (navNotifications) navNotifications.addEventListener("click", (e) => { e.preventDefault(); MapsTo("notifications"); });
if (navProfile) navProfile.addEventListener("click", (e) => { e.preventDefault(); MapsTo(`profile/${currentUser?.id || ""}`); });
if (mobNavFeed) mobNavFeed.addEventListener("click", (e) => { e.preventDefault(); MapsTo("feed"); });
if (mobNavSearch) mobNavSearch.addEventListener("click", (e) => { e.preventDefault(); MapsTo("search"); });
if (mobNavNotifications) mobNavNotifications.addEventListener("click", (e) => { e.preventDefault(); MapsTo("notifications"); });
if (mobNavProfile) mobNavProfile.addEventListener("click", (e) => { e.preventDefault(); MapsTo(`profile/${currentUser?.id || ""}`); });
if (logoutBtn) {
  logoutBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    await fetch("/auth/logout", { method: "POST", credentials: "include" });
    window.location.href = "login.html";
  });
}

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


