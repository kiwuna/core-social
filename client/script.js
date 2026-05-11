const API_URL = "http://localhost:3000";

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

let isPosting = false;
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

function getErrorMessage(response, fallbackMessage) {
  return response
    .json()
    .then((data) => data.error || fallbackMessage)
    .catch(() => fallbackMessage);
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

function createPostElement(post) {
  const postElement = document.createElement("article");
  postElement.className = "post";
  postElement.dataset.postId = String(post.id);

  const createdAt = post.created_at
    ? new Date(post.created_at).toLocaleString()
    : "Just now";

  postElement.innerHTML = `
    <div class="post-head">
      <img class="mini-avatar" src="https://i.pravatar.cc/100?img=15" alt="" />
      <div>
        <h3>Anonymous</h3>
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
      <button class="action action-delete" type="button">Delete</button>
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

postsList.addEventListener("click", async (event) => {
  const likeButton = event.target.closest(".action-like");
  const deleteButton = event.target.closest(".action-delete");
  const postElement = event.target.closest(".post");

  if (!postElement) return;
  const postId = postElement.dataset.postId;
  if (!postId) return;

  if (likeButton) {
    if (pendingPostActions.has(`like-${postId}`)) return;
    pendingPostActions.add(`like-${postId}`);
    likeButton.disabled = true;

    try {
      const response = await fetch(`${API_URL}/posts/${postId}/like`, {
        method: "POST"
      });

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
    if (pendingPostActions.has(`delete-${postId}`)) return;
    pendingPostActions.add(`delete-${postId}`);
    deleteButton.disabled = true;

    try {
      const response = await fetch(`${API_URL}/posts/${postId}`, {
        method: "DELETE"
      });

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

loadPosts();
