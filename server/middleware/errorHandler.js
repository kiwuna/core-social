function errorHandler(error, req, res, next) {
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return res.status(400).json({ error: "Invalid JSON body." });
  }

  if (error && error.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ error: "Image is too large. Max size is 5MB." });
  }

  if (error && error.message === "Only image files are allowed.") {
    return res.status(400).json({ error: error.message });
  }

  console.error("Unexpected server error:", error);
  res.status(500).json({ error: "Internal server error." });
}

module.exports = errorHandler;
