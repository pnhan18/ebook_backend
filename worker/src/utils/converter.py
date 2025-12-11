import re
import tempfile
import os
from bs4 import BeautifulSoup
from ebooklib import epub, ITEM_DOCUMENT


def epub_to_chapters(epub_bytes: bytes) -> list[dict]:
    """
    Parse EPUB file and extract chapters with full HTML (including styles and images).
    Returns list of {title, slug, content}
    """
    import base64

    with tempfile.NamedTemporaryFile(suffix=".epub", delete=False) as tmp:
        tmp.write(epub_bytes)
        tmp_path = tmp.name

    try:
        book = epub.read_epub(tmp_path)
        chapters = []

        # Extract CSS from EPUB
        css_content = ""
        for item in book.get_items():
            if item.media_type == "text/css":
                css_content += item.get_content().decode("utf-8") + "\n"

        # Build image map (path -> base64 data URI)
        image_map = {}
        for item in book.get_items():
            if item.media_type and item.media_type.startswith("image/"):
                img_data = base64.b64encode(item.get_content()).decode("utf-8")
                img_name = item.get_name()
                # Store with different path variations
                image_map[img_name] = f"data:{item.media_type};base64,{img_data}"
                image_map[os.path.basename(img_name)] = f"data:{item.media_type};base64,{img_data}"
                # Also store without leading path
                if "/" in img_name:
                    image_map[img_name.split("/", 1)[-1]] = f"data:{item.media_type};base64,{img_data}"

        for item in book.get_items():
            if item.get_type() == ITEM_DOCUMENT:
                content = item.get_content().decode("utf-8")
                soup = BeautifulSoup(content, "html.parser")

                # Replace image src with base64 data
                for img in soup.find_all("img"):
                    src = img.get("src", "")
                    if src:
                        # Try different path variations
                        src_clean = src.lstrip("./").lstrip("../")
                        for key in [src, src_clean, os.path.basename(src)]:
                            if key in image_map:
                                img["src"] = image_map[key]
                                break

                # Get title from h1/h2/h3 or filename
                title_tag = soup.find(["h1", "h2", "h3"])
                if title_tag:
                    title = title_tag.get_text().strip()
                else:
                    title = item.get_name().replace(".xhtml", "").replace(".html", "")
                    title = title.split("/")[-1]

                # Skip empty or navigation chapters
                body = soup.find("body")
                if body:
                    text_content = body.get_text().strip()
                    if len(text_content) < 50:
                        continue
                    html_content = str(body)
                else:
                    text_content = soup.get_text().strip()
                    if len(text_content) < 50:
                        continue
                    html_content = str(soup)

                # Wrap with original CSS
                full_html = f"""<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <style>
{css_content}
    </style>
</head>
{html_content}
</html>"""

                slug = generate_slug(title) or f"chapter-{len(chapters) + 1}"

                chapters.append({
                    "title": title,
                    "slug": slug,
                    "content": full_html,
                })

        if not chapters:
            raise ValueError("No chapters found in EPUB file")

        return chapters

    finally:
        os.unlink(tmp_path)


def get_epub_metadata(epub_bytes: bytes) -> dict:
    """Extract metadata from EPUB file."""
    with tempfile.NamedTemporaryFile(suffix=".epub", delete=False) as tmp:
        tmp.write(epub_bytes)
        tmp_path = tmp.name

    try:
        book = epub.read_epub(tmp_path)
        return {
            "title": book.get_metadata("DC", "title")[0][0] if book.get_metadata("DC", "title") else None,
            "author": book.get_metadata("DC", "creator")[0][0] if book.get_metadata("DC", "creator") else None,
            "description": book.get_metadata("DC", "description")[0][0] if book.get_metadata("DC", "description") else None,
            "language": book.get_metadata("DC", "language")[0][0] if book.get_metadata("DC", "language") else None,
        }
    finally:
        os.unlink(tmp_path)


def get_epub_cover(epub_bytes: bytes) -> bytes | None:
    """Extract cover image from EPUB file."""
    with tempfile.NamedTemporaryFile(suffix=".epub", delete=False) as tmp:
        tmp.write(epub_bytes)
        tmp_path = tmp.name

    try:
        book = epub.read_epub(tmp_path)

        for item in book.get_items():
            if "cover" in item.get_name().lower():
                if item.media_type and item.media_type.startswith("image/"):
                    return item.get_content()

        return None
    finally:
        os.unlink(tmp_path)


def generate_slug(text: str) -> str:
    """Generate URL-friendly slug from text."""
    import unicodedata

    text = unicodedata.normalize("NFD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9\s-]", "", text)
    text = re.sub(r"\s+", "-", text)
    text = re.sub(r"-+", "-", text)
    return text.strip("-")
