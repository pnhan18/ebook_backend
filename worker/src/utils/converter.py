import re
import tempfile
import os
from bs4 import BeautifulSoup
from ebooklib import epub, ITEM_DOCUMENT


def _convert_font_size_to_em(value: str) -> str:
    """Convert absolute font-size (px, pt) to relative (em)."""
    # Base font size assumption: 16px
    match = re.match(r"([\d.]+)\s*(px|pt|em|rem|%)", value.strip(), re.IGNORECASE)
    if not match:
        return value
    
    num = float(match.group(1))
    unit = match.group(2).lower()
    
    if unit == "px":
        em_value = num / 16
    elif unit == "pt":
        em_value = num / 12  # 12pt = 1em roughly
    elif unit in ("em", "rem"):
        return value  # Already relative
    elif unit == "%":
        em_value = num / 100
    else:
        return value
    
    return f"{em_value:.2f}em"


def _convert_css_font_sizes(css_content: str) -> str:
    """Convert all font-size values in CSS to em units."""
    def replace_font_size(match):
        prop = match.group(1)
        value = match.group(2)
        new_value = _convert_font_size_to_em(value)
        return f"{prop}{new_value}"
    
    return re.sub(
        r"(font-size\s*:\s*)([^;}\n]+)",
        replace_font_size,
        css_content,
        flags=re.IGNORECASE
    )


def _clean_css(css_content: str) -> str:
    """
    Clean CSS: remove color/font properties, keep layout properties.
    Keep: margin, padding, border, display, width, height, text-indent, etc.
    Remove: color, background, font-family, font-size, etc.
    """
    # Properties to remove (color and font related, but keep font-size for drop caps)
    remove_props = [
        r"color\s*:",
        r"background(-color|-image|-attachment|-position|-repeat)?\s*:",
        r"font-family\s*:",
        r"font-weight\s*:",
        r"font-style\s*:",
        r"letter-spacing\s*:",
        r"text-decoration\s*:",
        r"text-shadow\s*:",
        r"box-shadow\s*:",
    ]

    for prop in remove_props:
        # Remove property and its value (until ; or })
        css_content = re.sub(
            rf"{prop}[^;}}]+[;]?",
            "",
            css_content,
            flags=re.IGNORECASE,
        )

    # Remove empty rule blocks
    css_content = re.sub(r"[^{}]+\{\s*\}", "", css_content)

    # Convert font-size to em units
    css_content = _convert_css_font_sizes(css_content)

    return css_content.strip()


def _clean_inline_style(style: str) -> str:
    """Clean inline style: remove color/font-family, keep layout and font-size."""
    remove_props = [
        r"color\s*:",
        r"background(-color|-image|-attachment|-position|-repeat)?\s*:",
        r"font-family\s*:",
        r"font-weight\s*:",
        r"font-style\s*:",
        r"letter-spacing\s*:",
        r"text-decoration\s*:",
        r"text-shadow\s*:",
        r"box-shadow\s*:",
    ]

    for prop in remove_props:
        style = re.sub(rf"{prop}[^;]+;?", "", style, flags=re.IGNORECASE)

    # Convert font-size to em
    style = _convert_css_font_sizes(style)

    return style.strip()


def epub_to_chapters(epub_bytes: bytes) -> list[dict]:
    """
    Parse EPUB file and extract chapters.
    Keep layout CSS (tables, code blocks, indentation).
    Remove color and font CSS (will be overridden by reader).
    Returns list of {title, slug, content}
    """
    import base64

    with tempfile.NamedTemporaryFile(suffix=".epub", delete=False) as tmp:
        tmp.write(epub_bytes)
        tmp_path = tmp.name

    try:
        book = epub.read_epub(tmp_path)
        chapters = []

        # Extract and clean CSS from EPUB
        css_content = ""
        for item in book.get_items():
            if item.media_type == "text/css":
                raw_css = item.get_content().decode("utf-8")
                css_content += _clean_css(raw_css) + "\n"

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
                
                # Remove clipboard markers (StartFragment, EndFragment)
                content = re.sub(r'<!--\s*StartFragment\s*-->', '', content)
                content = re.sub(r'<!--\s*EndFragment\s*-->', '', content)
                content = content.replace('StartFragment', '')
                content = content.replace('EndFragment', '')
                
                soup = BeautifulSoup(content, "html.parser")

                # Remove external CSS links (we already extracted CSS)
                for link_tag in soup.find_all("link", rel="stylesheet"):
                    link_tag.decompose()

                # Clean inline style tags
                for style_tag in soup.find_all("style"):
                    style_tag.string = _clean_css(style_tag.get_text())

                # Clean inline style attributes (keep layout, remove colors/fonts)
                for tag in soup.find_all(True):
                    if tag.has_attr("style"):
                        cleaned = _clean_inline_style(tag["style"])
                        if cleaned:
                            tag["style"] = cleaned
                        else:
                            del tag["style"]

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

                # Get title from various sources
                title = None
                
                # 1. Try h1-h6 tags
                for heading_level in ["h1", "h2", "h3", "h4", "h5", "h6"]:
                    title_tag = soup.find(heading_level)
                    if title_tag:
                        potential_title = title_tag.get_text().strip()
                        if potential_title and len(potential_title) > 1:
                            title = potential_title
                            break
                
                # 2. Try common title class patterns
                if not title:
                    title_patterns = [
                        {"class_": re.compile(r"title|chapter|heading", re.I)},
                        {"id": re.compile(r"title|chapter|heading", re.I)},
                    ]
                    for pattern in title_patterns:
                        title_elem = soup.find(["p", "div", "span"], **pattern)
                        if title_elem:
                            potential_title = title_elem.get_text().strip()
                            if potential_title and len(potential_title) > 1:
                                title = potential_title
                                break
                
                # 3. Fallback to filename with better formatting
                if not title:
                    filename = item.get_name().replace(".xhtml", "").replace(".html", "")
                    filename = filename.split("/")[-1]
                    # Convert part0001 -> Chapter 1
                    match = re.match(r"(?:part|chapter|ch|chuong|phan)[-_]?(\d+)", filename, re.I)
                    if match:
                        title = f"Chương {int(match.group(1))}"
                    else:
                        title = f"Chương {len(chapters) + 1}"

                # Skip empty or navigation chapters
                body = soup.find("body")
                if body:
                    text_content = body.get_text().strip()
                    if len(text_content) < 50:
                        continue
                    # Get inner HTML of body (without body tag itself)
                    html_content = "".join(str(child) for child in body.children)
                else:
                    text_content = soup.get_text().strip()
                    if len(text_content) < 50:
                        continue
                    html_content = str(soup)

                # Clean clipboard markers from final HTML
                html_content = re.sub(r'<!--\s*StartFragment\s*-->', '', html_content)
                html_content = re.sub(r'<!--\s*EndFragment\s*-->', '', html_content)
                html_content = html_content.replace('StartFragment', '')
                html_content = html_content.replace('EndFragment', '')
                
                # Clean EPUB content markers
                html_content = re.sub(r'@startcontent\b', '', html_content, flags=re.IGNORECASE)
                html_content = re.sub(r'@endcontent\b', '', html_content, flags=re.IGNORECASE)
                html_content = re.sub(r'@content\b', '', html_content, flags=re.IGNORECASE)
                html_content = re.sub(r'@start\b', '', html_content, flags=re.IGNORECASE)
                html_content = re.sub(r'@end\b', '', html_content, flags=re.IGNORECASE)

                # HTML with cleaned CSS (layout only)
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
<body>
{html_content}
</body>
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

    # Guard against None or empty string
    if not text:
        return ""

    text = unicodedata.normalize("NFD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9\s-]", "", text)
    text = re.sub(r"\s+", "-", text)
    text = re.sub(r"-+", "-", text)
    return text.strip("-")
