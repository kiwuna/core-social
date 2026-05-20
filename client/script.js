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


