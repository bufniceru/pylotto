from __future__ import annotations

from pathlib import Path
from textwrap import wrap


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "freshness-calculation.pdf"

PAGE_WIDTH = 842
PAGE_HEIGHT = 595
MARGIN = 42


def pdf_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


class PdfDocument:
    def __init__(self) -> None:
        self.page_streams: list[str] = []

    def add_page(self, stream: str) -> None:
        self.page_streams.append(stream)

    def write(self, path: Path) -> None:
        objects: list[bytes] = [
            b"<< /Type /Catalog /Pages 2 0 R >>",
            b"",
            b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
            b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
        ]
        page_ids: list[int] = []

        for stream in self.page_streams:
            stream_bytes = stream.encode("latin-1")
            content_id = len(objects) + 1
            objects.append(
                b"<< /Length " + str(len(stream_bytes)).encode("ascii") + b" >>\nstream\n"
                + stream_bytes
                + b"\nendstream"
            )
            page_id = len(objects) + 1
            objects.append(
                (
                    f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {PAGE_WIDTH} {PAGE_HEIGHT}] "
                    f"/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> "
                    f"/Contents {content_id} 0 R >>"
                ).encode("ascii")
            )
            page_ids.append(page_id)

        kids = " ".join(f"{page_id} 0 R" for page_id in page_ids)
        objects[1] = f"<< /Type /Pages /Kids [{kids}] /Count {len(page_ids)} >>".encode("ascii")

        chunks = [b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"]
        offsets: list[int] = []
        for index, payload in enumerate(objects, start=1):
            offsets.append(sum(len(chunk) for chunk in chunks))
            chunks.append(f"{index} 0 obj\n".encode("ascii"))
            chunks.append(payload)
            chunks.append(b"\nendobj\n")
        xref_offset = sum(len(chunk) for chunk in chunks)
        chunks.append(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
        chunks.append(b"0000000000 65535 f \n")
        for offset in offsets:
            chunks.append(f"{offset:010d} 00000 n \n".encode("ascii"))
        chunks.append(
            (
                f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
                f"startxref\n{xref_offset}\n%%EOF\n"
            ).encode("ascii")
        )
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b"".join(chunks))


class Canvas:
    def __init__(self) -> None:
        self.ops: list[str] = []

    def color(self, rgb: str) -> None:
        r = int(rgb[1:3], 16) / 255
        g = int(rgb[3:5], 16) / 255
        b = int(rgb[5:7], 16) / 255
        self.ops.append(f"{r:.3f} {g:.3f} {b:.3f} rg {r:.3f} {g:.3f} {b:.3f} RG")

    def stroke_color(self, rgb: str) -> None:
        r = int(rgb[1:3], 16) / 255
        g = int(rgb[3:5], 16) / 255
        b = int(rgb[5:7], 16) / 255
        self.ops.append(f"{r:.3f} {g:.3f} {b:.3f} RG")

    def text(self, x: float, y: float, value: str, size: int = 10, bold: bool = False) -> None:
        font = "F2" if bold else "F1"
        self.color("#172033")
        self.ops.append(f"BT /{font} {size} Tf {x:.1f} {y:.1f} Td ({pdf_escape(value)}) Tj ET")

    def wrapped_text(
        self,
        x: float,
        y: float,
        value: str,
        width_chars: int,
        size: int = 10,
        leading: int = 13,
        bold: bool = False,
    ) -> float:
        for line in wrap(value, width_chars):
            self.text(x, y, line, size=size, bold=bold)
            y -= leading
        return y

    def line(self, x1: float, y1: float, x2: float, y2: float, color: str = "#8a95a8") -> None:
        self.stroke_color(color)
        self.ops.append(f"1.4 w {x1:.1f} {y1:.1f} m {x2:.1f} {y2:.1f} l S")

    def rect(self, x: float, y: float, w: float, h: float, fill: str, stroke: str = "#d8dee8") -> None:
        self.color(fill)
        self.stroke_color(stroke)
        self.ops.append(f"{x:.1f} {y:.1f} {w:.1f} {h:.1f} re B")

    def box(self, x: float, y: float, w: float, h: float, title: str, body: str, fill: str) -> None:
        self.rect(x, y, w, h, fill)
        self.text(x + 12, y + h - 20, title, size=12, bold=True)
        self.wrapped_text(x + 12, y + h - 38, body, width_chars=max(20, int(w / 6.2)), size=9)

    def pill(self, x: float, y: float, w: float, h: float, label: str, color: str) -> None:
        self.rect(x, y, w, h, color, stroke="#ffffff")
        self.text(x + 7, y + 9, label, size=8, bold=True)

    def stream(self) -> str:
        return "\n".join(self.ops)


def add_header(c: Canvas, title: str, subtitle: str) -> None:
    c.text(MARGIN, PAGE_HEIGHT - 44, title, size=20, bold=True)
    c.text(MARGIN, PAGE_HEIGHT - 64, subtitle, size=10)
    c.line(MARGIN, PAGE_HEIGHT - 78, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 78, "#c7d0de")


def page_one() -> str:
    c = Canvas()
    add_header(c, "PyLotto Freshness Calculation", "Flow diagram for singles, doublets, triplets, and next-draw ranking")
    y = 420
    boxes = [
        ("History", "Draws are processed oldest to newest. Each draw has six numbers.", "#eff5ff"),
        ("Last Seen", "Before each draw is counted, the model checks when every number, pair, and triplet was last seen.", "#f8fafc"),
        ("Gap", "gap = current draw index - previous seen index - 1. If never seen, gap is null.", "#fff8e0"),
        ("Bucket", "The gap is mapped into New, Repeat, Very fresh, Fresh, Warm, Stale, Cold, or Very cold.", "#f4f7fb"),
        ("Exposure and Hit", "Every possible item receives one exposure in its bucket. Drawn items also receive one hit.", "#edf8f1"),
        ("Hit Rate", "bucket hit rate = drawn count / exposure count. This is the freshness probability signal.", "#fff2ee"),
        ("Prediction", "Current items are bucketed by their latest gap, assigned the bucket hit rate, then ranked.", "#f7f0ff"),
    ]
    x = MARGIN
    for index, (title, body, fill) in enumerate(boxes):
        c.box(x, y, 94, 84, title, body, fill)
        if index < len(boxes) - 1:
            c.line(x + 94, y + 42, x + 112, y + 42, "#6c7a90")
        x += 112

    c.text(MARGIN, 300, "One historical draw update", size=14, bold=True)
    c.box(MARGIN, 204, 235, 72, "For each number 1..49", "Classify current freshness before updating lastSeen. If the number is drawn, increment drawn count in that bucket.", "#ffffff")
    c.box(304, 204, 235, 72, "For each pair C(49,2)", "Do the same exposure/hit counting for every possible doublet. A 6-number draw contains 15 actual doublets.", "#ffffff")
    c.box(566, 204, 235, 72, "For each triplet C(49,3)", "Do the same exposure/hit counting for every possible triplet. A 6-number draw contains 20 actual triplets.", "#ffffff")
    c.line(277, 240, 304, 240)
    c.line(539, 240, 566, 240)

    c.text(MARGIN, 154, "Important ordering detail", size=13, bold=True)
    c.wrapped_text(
        MARGIN,
        134,
        "A draw is evaluated against the state before that draw. Only after exposures and hits are counted does the model update lastSeen for the numbers, doublets, and triplets in the draw.",
        124,
        size=10,
    )
    return c.stream()


def page_two() -> str:
    c = Canvas()
    add_header(c, "Freshness Buckets and Core Formulas", "The model turns last-seen gaps into bucket-level historical hit rates")
    buckets = [
        ("New", "gap = null", "#7b8798"),
        ("Repeat", "gap = 0", "#d93a3a"),
        ("Very fresh", "gap 1-2", "#f27d42"),
        ("Fresh", "gap 3-5", "#f0b44f"),
        ("Warm", "gap 6-10", "#4b9f68"),
        ("Stale", "gap 11-20", "#3f7fc4"),
        ("Cold", "gap 21-35", "#7255b5"),
        ("Very cold", "gap >= 36", "#28344d"),
    ]
    y = 480
    for i, (label, rule, color) in enumerate(buckets):
        x = MARGIN + (i % 4) * 190
        row_y = y - (i // 4) * 58
        c.pill(x, row_y, 82, 28, label, color)
        c.text(x + 92, row_y + 10, rule, size=10)

    c.text(MARGIN, 326, "Single-number counting", size=14, bold=True)
    c.wrapped_text(MARGIN, 304, "For each historical draw and for each number from 1 to 49:", 118, size=10)
    c.text(MARGIN + 16, 276, "1. previousIndex = lastSeen[number]", size=10)
    c.text(MARGIN + 16, 256, "2. gap = null if previousIndex is null, otherwise drawIndex - previousIndex - 1", size=10)
    c.text(MARGIN + 16, 236, "3. bucket = bucketForGap(gap)", size=10)
    c.text(MARGIN + 16, 216, "4. exposureByBucket[bucket] += 1", size=10)
    c.text(MARGIN + 16, 196, "5. if number is in this draw: drawnByBucket[bucket] += 1", size=10)
    c.text(MARGIN + 16, 176, "6. after the draw is fully counted: lastSeen[number] = drawIndex for drawn numbers", size=10)

    c.text(468, 326, "Formulas", size=14, bold=True)
    c.box(468, 254, 320, 52, "Gap", "gap = currentDrawIndex - previousSeenIndex - 1", "#eff5ff")
    c.box(468, 184, 320, 52, "Hit rate", "hitRate(bucket) = drawnCount(bucket) / exposureCount(bucket)", "#edf8f1")
    c.box(468, 114, 320, 52, "Draw share", "drawShare(bucket) = drawnCount(bucket) / (drawCount * itemsPerDraw)", "#fff8e0")

    c.text(MARGIN, 82, "itemsPerDraw is 6 for singles, 15 for doublets, and 20 for triplets.", size=10, bold=True)
    return c.stream()


def page_three() -> str:
    c = Canvas()
    add_header(c, "Prediction Ranking and Evaluation", "How the report ranks next-draw candidates")
    c.text(MARGIN, 478, "Next draw prediction", size=14, bold=True)
    c.box(MARGIN, 390, 230, 64, "Current gap", "After all historical draws are processed, compute each candidate's current gap from the final lastSeen map.", "#eff5ff")
    c.box(306, 390, 230, 64, "Bucket rate", "Map the current gap to a freshness bucket and assign that bucket's historical hit rate.", "#edf8f1")
    c.box(570, 390, 230, 64, "Sort", "Rank by hit rate descending, then current gap descending, then number or key ascending.", "#fff8e0")
    c.line(272, 422, 306, 422)
    c.line(536, 422, 570, 422)

    c.text(MARGIN, 330, "Scopes", size=14, bold=True)
    c.wrapped_text(
        MARGIN,
        308,
        "Singles: 49 candidates, one per lottery number. Doublets: all C(49,2) = 1176 possible pairs. Triplets: all C(49,3) = 18424 possible triples. The same freshness bucket logic is applied to all three scopes.",
        124,
        size=10,
    )

    c.text(MARGIN, 246, "Backtest score used by Draw Scores and Score Graphs", size=14, bold=True)
    c.wrapped_text(
        MARGIN,
        224,
        "For each draw after the first, the app builds a prediction using only previous draws. It ranks the 49 numbers, then compares the actual draw to those ranks.",
        124,
        size=10,
    )
    c.box(MARGIN, 142, 350, 54, "Per-number score", "((49 - rank) / 48) * 100. Rank 1 scores 100; rank 49 scores 0.", "#f7f0ff")
    c.box(450, 142, 350, 54, "Draw score", "Average of the six per-number scores for the actual draw.", "#fff2ee")
    c.box(MARGIN, 70, 350, 54, "Top picks", "The six highest ranked freshness numbers from the previous-history-only model.", "#eff5ff")
    c.box(450, 70, 350, 54, "Cover count", "How deep into the ranked list you must go to include the requested number of actual draw hits.", "#edf8f1")
    return c.stream()


def main() -> None:
    doc = PdfDocument()
    doc.add_page(page_one())
    doc.add_page(page_two())
    doc.add_page(page_three())
    doc.write(OUTPUT)
    print(OUTPUT)


if __name__ == "__main__":
    main()
