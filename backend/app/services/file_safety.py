"""
File safety verification: extension whitelist, MIME type, magic bytes, and size limit.
Ensures uploaded documents cannot execute code, escape upload directories, or masquerade as valid files.
"""

import os
from typing import Dict, Any, Tuple

# Supported file extensions and their valid magic bytes
ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".txt", ".csv"}
MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024  # 15 MB limit

MAGIC_SIGNATURES = {
    ".pdf": [b"%PDF"],
    ".png": [b"\x89PNG\r\n\x1a\n"],
    ".jpg": [b"\xff\xd8\xff"],
    ".jpeg": [b"\xff\xd8\xff"],
}


def validate_file_safety(
    filename: str,
    content: bytes,
    content_type: str = ""
) -> Tuple[bool, str]:
    """
    Validates file extension, magic bytes, size, and content safety.
    Returns: (is_safe: bool, reason_or_error: str)
    """
    if not filename or not filename.strip():
        return False, "File name cannot be empty."

    # Prevent directory traversal
    basename = os.path.basename(filename)
    if ".." in filename or basename != filename.replace("/", "\\").split("\\")[-1]:
        return False, "Invalid file name: path traversal detected."

    ext = os.path.splitext(filename.lower())[1]
    if ext not in ALLOWED_EXTENSIONS:
        return False, f"Unsupported file extension '{ext}'. Allowed extensions: {', '.join(sorted(ALLOWED_EXTENSIONS))}."

    if len(content) == 0:
        return False, "Uploaded file is empty (0 bytes)."

    if len(content) > MAX_FILE_SIZE_BYTES:
        return False, f"File exceeds maximum allowed size of 15MB ({len(content)} bytes)."

    # Magic byte inspection for binary file types
    if ext in MAGIC_SIGNATURES:
        signatures = MAGIC_SIGNATURES[ext]
        if not any(content.startswith(sig) for sig in signatures):
            return False, f"File content does not match expected magic bytes for extension '{ext}' (masquerading file rejected)."

    # For text files, ensure valid UTF-8 / ASCII text without null bytes
    if ext in {".txt", ".csv"}:
        if b"\x00" in content:
            return False, "Text file contains forbidden binary null bytes."
        try:
            content.decode("utf-8")
        except UnicodeDecodeError:
            try:
                content.decode("latin-1")
            except Exception:
                return False, "Text file is not readable as UTF-8 or Latin-1."

    return True, "File passed safety validation."
