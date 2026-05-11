const API_URL = ""; // Relative URL for same-origin

const postForm = document.getElementById("postForm");
const postInput = document.getElementById("postInput");
const postsList = document.getElementById("postsList");
const feedbackMessage = document.getElementById("feedbackMessage");
const sendButton = postForm.querySelector(".send");
const imageInput = document.getElementById("imageInput");
const pickImageButton = document.getElementById("pickImageButton");
const imagePreviewBox = document.getElementById("imagePreviewBox");
const imagePreview = document.getElementById("imagePreview");
const removeImageButton = document.getElementById("removeImageButton");

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
  isPosting = loading;
  sendButton.disabled = loading;
  pickImageButton.disabled = loading;
  imageInput.disabled = loading;
  removeImageButton.disabled = loading;
  sendButton.textContent = loading ? "Sending..." : "Send";
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
    userEmojiMini.textContent = currentUser.emoji;
    logoutBtn.classList.remove("hidden");
    loginLink.classList.add("hidden");
  } else {
    userNameDisplay.textContent = "Guest";
    userHandleDisplay.textContent = "@anonymous";
    userEmojiLarge.textContent = "👻";
    userEmojiMini.textContent = "👻";
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

  // Use the emoji from the post data (joined from users table)
  const displayEmoji = post.emoji || "👻";
  const displayUser = post.username || "anonymous";

  // Only show delete button if the user owns the post
  const isOwner = currentUser && post.user_id === currentUser.id;

  postElement.innerHTML = `
    <div class="post-head">
      <div class="mini-avatar" style="font-size: 24px; display: flex; align-items: center; justify-content: center; background: #1c2432; border: 1px solid #273149;">${displayEmoji}</div>
      <div>
        <h3>${displayUser}</h3>
        <span class="meta">${createdAt}</span>
      </div>
      <button class="more" type="button">⋯</button>
    </div>
    <img class="post-image hidden" alt="Post image" />
    <p class="post-body"></p>
    <footer class="post-foot">
      <button class="action action-like stat-like" type="button" aria-label="Like post">
        ♥ <span class="likes-count">${post.likes || 0}</span>
      </button>
      ${isOwner ? '<button class="action action-delete" type="button">Delete</button>' : ""}
    </footer>
  `;

  const postImageElement = postElement.querySelector(".post-image");
  if (post.image_path) {
    postImageElement.src = `${API_URL}${post.image_path}`;
    postImageElement.classList.remove("hidden");
  }

  postElement.querySelector(".post-body").textContent = post.content;
  return postElement;
}

function showEmptyState() {
  postsList.innerHTML = `<p class="empty">No posts yet. Be the first one.</p>`;
}

async function loadPosts() {
  try {
    showFeedback("Loading posts...", "info");
    const response = await fetch(`${API_URL}/posts`);
    if (!response.ok) {
      throw new Error("Could not load posts.");
    }
    const posts = await response.json();

    postsList.innerHTML = "";

    if (!posts.length) {
      showEmptyState();
      return;
    }

    posts.forEach((post) => {
      postsList.appendChild(createPostElement(post));
    });
    showFeedback("");
  } catch (error) {
    postsList.innerHTML = `<p class="empty">Could not load posts.</p>`;
    showFeedback("Could not load posts.", "error");
  }
}

postForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentUser) {
    window.location.href = "login.html";
    return;
  }

  if (isPosting) return;

  const content = postInput.value.trim();
  if (!content && !selectedImageFile) {
    showFeedback("Add text or choose an image before sending.", "error");
    return;
  }

  setPostFormState(true);

  try {
    const formData = new FormData();
    formData.append("content", content);
    if (selectedImageFile) {
      formData.append("image", selectedImageFile);
    }

    const response = await fetch(`${API_URL}/posts`, {
      method: "POST",
      body: formData
    });

    if (response.status === 401) {
      window.location.href = "login.html";
      return;
    }

    if (!response.ok) {
      const message = await getErrorMessage(response, "Could not save post.");
      throw new Error(message);
    }

    postInput.value = "";
    selectedImageFile = null;
    imageInput.value = "";
    updateImagePreview(null);
    await loadPosts();
    showFeedback("Post sent.", "success");
  } catch (error) {
    showFeedback(error.message || "Could not save post.", "error");
  } finally {
    setPostFormState(false);
  }
});

pickImageButton.addEventListener("click", () => {
  imageInput.click();
});

imageInput.addEventListener("change", () => {
  const file = imageInput.files && imageInput.files[0];
  if (!file) {
    selectedImageFile = null;
    updateImagePreview(null);
    return;
  }

  if (!file.type.startsWith("image/")) {
    showFeedback("Please select an image file.", "error");
    selectedImageFile = null;
    imageInput.value = "";
    updateImagePreview(null);
    return;
  }

  selectedImageFile = file;
  updateImagePreview(file);
});

removeImageButton.addEventListener("click", () => {
  selectedImageFile = null;
  imageInput.value = "";
  updateImagePreview(null);
});

logoutBtn.addEventListener("click", async () => {
  try {
    const res = await fetch("/auth/logout", { method: "POST" });
    if (res.ok) {
      window.location.reload();
    }
  } catch (err) {
    showFeedback("Logout failed", "error");
  }
});

postsList.addEventListener("click", async (event) => {
  const likeButton = event.target.closest(".action-like");
  const deleteButton = event.target.closest(".action-delete");
  const postElement = event.target.closest(".post");

  if (!postElement) return;
  const postId = postElement.dataset.postId;
  if (!postId) return;

  if (likeButton) {
    if (!currentUser) {
      window.location.href = "login.html";
      return;
    }

    if (pendingPostActions.has(`like-${postId}`)) return;
    pendingPostActions.add(`like-${postId}`);
    likeButton.disabled = true;

    try {
      const response = await fetch(`${API_URL}/posts/${postId}/like`, {
        method: "POST"
      });

      if (response.status === 401) {
        window.location.href = "login.html";
        return;
      }

      if (!response.ok) {
        const message = await getErrorMessage(response, "Could not like post.");
        throw new Error(message);
      }

      const updatedPost = await response.json();
      const likesCountElement = postElement.querySelector(".likes-count");
      if (likesCountElement) {
        likesCountElement.textContent = updatedPost.likes;
      }
      showFeedback("Liked.", "success");
    } catch (error) {
      showFeedback(error.message || "Could not like post.", "error");
    } finally {
      likeButton.disabled = false;
      pendingPostActions.delete(`like-${postId}`);
    }
  }

  if (deleteButton) {
    if (deleteButton.textContent === "Delete") {
      deleteButton.textContent = "Confirm?";
      deleteButton.classList.add("confirming");
      
      // Auto-revert after 3 seconds if not clicked
      setTimeout(() => {
        if (deleteButton && deleteButton.textContent === "Confirm?") {
          deleteButton.textContent = "Delete";
          deleteButton.classList.remove("confirming");
        }
      }, 3000);
      return;
    }

    if (pendingPostActions.has(`delete-${postId}`)) return;
    pendingPostActions.add(`delete-${postId}`);
    deleteButton.disabled = true;
    deleteButton.textContent = "Deleting...";

    try {
      const response = await fetch(`${API_URL}/posts/${postId}`, {
        method: "DELETE"
      });
      console.log("Delete response status:", response.status);

      if (response.status === 401) {
        window.location.href = "login.html";
        return;
      }

      if (!response.ok) {
        const message = await getErrorMessage(response, "Could not delete post.");
        throw new Error(message);
      }

      postElement.remove();
      if (!postsList.querySelector(".post")) {
        showEmptyState();
      }
      showFeedback("Post deleted.", "success");
    } catch (error) {
      showFeedback(error.message || "Could not delete post.", "error");
    } finally {
      deleteButton.disabled = false;
      pendingPostActions.delete(`delete-${postId}`);
    }
  }
});

// Initialize
(async function init() {
  await fetchCurrentUser();
  await loadPosts();
})();
