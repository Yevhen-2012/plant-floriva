"""Generate responsive WebP assets without changing the imported originals.

Run with Python + Pillow when source images change; generated files are committed,
so the normal Node/GitHub Pages build does not need an image-processing dependency.
"""
import hashlib
import json
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
capture = json.loads((ROOT / "data/capture.json").read_text(encoding="utf-8"))
sources = set()


class Images(HTMLParser):
    def handle_starttag(self, tag, attrs):
        if tag != "img":
            return
        src = dict(attrs).get("src", "")
        file = capture["assets"].get(urljoin("https://plant-f81e0d.webflow.io/", src))
        if file and Path(file).suffix.lower() in {".webp", ".png", ".jpg", ".jpeg"}:
            sources.add(file)


for page in set(capture["pages"].values()):
    Images().feed((ROOT / "snapshots" / page).read_text(encoding="utf-8"))

collections = json.loads((ROOT / "content/collections.json").read_text(encoding="utf-8"))
for collection in collections:
    if collection["schema"]["slug"] != "product":
        continue
    for item in collection["items"]:
        if item.get("isDraft") or item.get("isArchived"):
            continue
        file = capture["assets"].get(item["fieldData"].get("main-img", {}).get("url"))
        if file:
            sources.add(file)

destination = ROOT / "assets/responsive"
destination.mkdir(exist_ok=True)
manifest = {}
for file in sorted(sources):
    source = ROOT / file
    data = source.read_bytes()
    digest = hashlib.sha256(data + b"webp-q86-method4-v1").hexdigest()[:12]
    with Image.open(source) as image:
        image = ImageOps.exif_transpose(image)
        width, height = image.size
        image = image.convert("RGBA" if "A" in image.getbands() or "transparency" in image.info else "RGB")
        widths = [w for w in [96, 160, 320, 480, 640, 960, 1280] if w < width]
        if width <= 1280 and source.suffix.lower() == '.png':
            widths.append(width)
        variants = []
        for target_width in widths:
            target_height = max(1, round(height * target_width / width))
            resized = image.resize((target_width, target_height), Image.Resampling.LANCZOS)
            target = destination / f"{digest}-{target_width}.webp"
            resized.save(target, "WEBP", quality=86, method=4)
            if target.stat().st_size >= len(data):
                target.unlink()
                continue
            variants.append({"file": target.relative_to(ROOT).as_posix(), "width": target_width, "height": target_height, "bytes": target.stat().st_size})
        if not variants or variants[-1]["width"] < width:
            variants.append({"file": file, "width": width, "height": height, "bytes": len(data)})
        manifest[file] = {"width": width, "height": height, "variants": variants}

(ROOT / "content/responsive-images.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
generated = {v["file"] for item in manifest.values() for v in item["variants"] if v["file"].startswith("assets/responsive/")}
print(f"Prepared {len(manifest)} source images and {len(generated)} responsive WebP files.")
