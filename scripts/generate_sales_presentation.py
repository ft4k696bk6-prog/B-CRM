from __future__ import annotations

from pathlib import Path
from textwrap import wrap

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf" / "b-crm-energy-prezentacja.pdf"
PUBLIC = ROOT / "public" / "materials" / "b-crm-energy-prezentacja.pdf"

PAGE_W, PAGE_H = landscape(A4)
M = 42

INK = HexColor("#101820")
MUTED = HexColor("#60707b")
LINE = HexColor("#dbe5de")
PAPER = HexColor("#f5f8f3")
CARD = HexColor("#ffffff")
GREEN = HexColor("#177a5b")
MINT = HexColor("#bfeede")
TEAL = HexColor("#1f7890")
AMBER = HexColor("#c9992b")
NAVY = HexColor("#12202e")
SOFT = HexColor("#eef4ef")


def register_fonts() -> None:
    font_dir = Path("/System/Library/Fonts/Supplemental")
    pdfmetrics.registerFont(TTFont("Deck", str(font_dir / "Arial.ttf")))
    pdfmetrics.registerFont(TTFont("Deck-Bold", str(font_dir / "Arial Bold.ttf")))
    pdfmetrics.registerFont(TTFont("Deck-Black", str(font_dir / "Arial Black.ttf")))


def text_width(text: str, font: str, size: int) -> float:
    return pdfmetrics.stringWidth(text, font, size)


def wrapped_lines(text: str, font: str, size: int, max_width: float) -> list[str]:
    chars = max(14, int(max_width / (size * 0.48)))
    lines: list[str] = []
    for paragraph in text.split("\n"):
        if not paragraph:
            lines.append("")
            continue
        candidate = wrap(paragraph, width=chars, break_long_words=False, replace_whitespace=False)
        for line in candidate:
            while text_width(line, font, size) > max_width and len(line) > 10:
                chars = max(10, chars - 2)
                candidate = wrap(paragraph, width=chars, break_long_words=False, replace_whitespace=False)
                line = candidate[0]
                break
            lines.extend(candidate)
            break
    return lines


def draw_text(
    c: canvas.Canvas,
    text: str,
    x: float,
    y: float,
    width: float,
    size: int,
    color=INK,
    font: str = "Deck",
    leading: float | None = None,
    max_lines: int | None = None,
) -> float:
    c.setFillColor(color)
    c.setFont(font, size)
    line_h = leading or size * 1.26
    lines = wrapped_lines(text, font, size, width)
    if max_lines is not None:
        lines = lines[:max_lines]
    yy = y
    for line in lines:
        c.drawString(x, yy, line)
        yy -= line_h
    return yy


def header(c: canvas.Canvas, page: int, progress: float) -> None:
    c.setFillColor(PAPER)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    c.setFillColor(GREEN)
    c.circle(M - 16, PAGE_H - 42, 6, fill=1, stroke=0)
    c.setFont("Deck-Black", 13)
    c.setFillColor(INK)
    c.drawString(M, PAGE_H - 46, "RE-ENERGY SYSTEM")
    c.setFont("Deck", 8)
    c.setFillColor(MUTED)
    c.drawRightString(PAGE_W - M, PAGE_H - 42, f"{page:02d} / B-CRM")
    c.setStrokeColor(LINE)
    c.setLineWidth(0.8)
    c.line(M - 14, PAGE_H - 66, PAGE_W - M + 14, PAGE_H - 66)
    x1 = M - 4
    x2 = PAGE_W - M
    c.setStrokeColor(MINT)
    c.setLineWidth(5)
    c.line(x1, PAGE_H - 80, x2, PAGE_H - 80)
    c.setFillColor(GREEN)
    c.circle(x1 + (x2 - x1) * progress, PAGE_H - 80, 8, fill=1, stroke=0)


def title(c: canvas.Canvas, text: str, y: float = 448, width: float = 560, size: int = 36) -> None:
    draw_text(c, text, M, y, width, size, INK, "Deck-Black", size * 1.12)


def subtitle(c: canvas.Canvas, text: str, y: float, width: float = 560) -> None:
    draw_text(c, text, M, y, width, 15, MUTED, "Deck", 20)


def pill(c: canvas.Canvas, x: float, y: float, text: str, color, bg) -> None:
    pad_x = 12
    w = text_width(text, "Deck-Bold", 10) + pad_x * 2
    c.setFillColor(bg)
    c.setStrokeColor(color)
    c.roundRect(x, y, w, 24, 7, fill=1, stroke=1)
    c.setFillColor(color)
    c.setFont("Deck-Bold", 10)
    c.drawString(x + pad_x, y + 7, text)


def card(c: canvas.Canvas, x: float, y: float, w: float, h: float, accent, heading: str, body: str) -> None:
    c.setFillColor(CARD)
    c.setStrokeColor(LINE)
    c.setLineWidth(0.9)
    c.roundRect(x, y, w, h, 8, fill=1, stroke=1)
    c.setFillColor(accent)
    c.roundRect(x + 14, y + h - 39, 25, 25, 6, fill=1, stroke=0)
    draw_text(c, heading, x + 52, y + h - 30, w - 66, 14, INK, "Deck-Bold", 17, 2)
    draw_text(c, body, x + 18, y + h - 68, w - 36, 12.2, MUTED, "Deck", 16, 5)


def metric(c: canvas.Canvas, x: float, y: float, label: str, value: str, accent) -> None:
    c.setFillColor(CARD)
    c.setStrokeColor(LINE)
    c.roundRect(x, y, 158, 74, 8, fill=1, stroke=1)
    c.setFillColor(accent)
    c.setFont("Deck-Black", 22)
    c.drawString(x + 15, y + 39, value)
    draw_text(c, label, x + 15, y + 25, 128, 9.5, MUTED, "Deck", 12, 2)


def image_box(c: canvas.Canvas, path: Path, x: float, y: float, w: float, h: float, pad: float = 10) -> None:
    c.setFillColor(CARD)
    c.setStrokeColor(HexColor("#edf1ee"))
    c.roundRect(x, y, w, h, 6, fill=1, stroke=0)
    img = ImageReader(str(path))
    iw, ih = img.getSize()
    scale = min((w - 2 * pad) / iw, (h - 2 * pad) / ih)
    dw = iw * scale
    dh = ih * scale
    c.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh, mask="auto")


def connector(c: canvas.Canvas, points: list[tuple[float, float]], color=GREEN) -> None:
    c.setStrokeColor(color)
    c.setLineWidth(2.0)
    for a, b in zip(points, points[1:]):
        c.line(a[0], a[1], b[0], b[1])
    c.setFillColor(color)
    for x, y in points:
        c.circle(x, y, 4, fill=1, stroke=0)


def slide_1(c: canvas.Canvas) -> None:
    header(c, 1, 0.06)
    title(c, "Energia bez chaosu", 448, 530, 42)
    subtitle(c, "Fotowoltaika i magazyn energii pokazane tak, jak klient podejmuje decyzję: spokojnie, konkretnie i bez technicznego szumu.", 350, 520)
    image_box(c, ROOT / "public/products/ja-solar-panel.webp", 548, 158, 230, 236, 18)
    c.setFillColor(NAVY)
    c.roundRect(520, 70, 282, 74, 10, fill=1, stroke=0)
    draw_text(c, "Re-Energy System", 546, 111, 220, 18, CARD, "Deck-Bold", 20)
    draw_text(c, "Sprzęt, dokumenty i realizacja spięte w jednym procesie.", 546, 84, 230, 9.8, HexColor("#9aa7b1"), "Deck", 12, 2)
    pill(c, M, 76, "PV", GREEN, HexColor("#e8f7f0"))
    pill(c, M + 58, 76, "Magazyn", AMBER, HexColor("#fff5d8"))
    pill(c, M + 148, 76, "Proces od spotkania do montażu", INK, HexColor("#ffffff"))


def slide_2(c: canvas.Canvas) -> None:
    header(c, 2, 0.14)
    title(c, "Firma, która prowadzi decyzję do końca", 444, 500, 34)
    subtitle(c, "Klient nie kupuje paneli. Kupuje spokój, niższe ryzyko i zespół, który dowozi cały proces: dobór, dokumenty, podpis, magazyn, montaż i odbiór.", 334, 650)
    y = 82
    card(c, 52, y, 228, 120, GREEN, "Jedna odpowiedzialność", "Doradca zbiera dane, kierownik zatwierdza bramę umowy, administracja pilnuje dokumentów.")
    card(c, 308, y, 228, 120, TEAL, "Technika pod kontrolą", "Falownik, magazyn, BMS, komunikacja i firmware są sprawdzane przed obietnicą klientowi.")
    card(c, 564, y, 228, 120, AMBER, "Czysty proces", "Każdy etap zostawia ślad: oferta, otwarcie, akceptacja, podpis i realizacja.")


def slide_3(c: canvas.Canvas) -> None:
    header(c, 3, 0.25)
    title(c, "Jak działa fotowoltaika", 444, 520, 36)
    subtitle(c, "Instalacja produkuje energię w dzień. Najpierw zasila dom, później magazyn, a nadwyżka trafia do sieci.", 344, 590)
    centers = [(148, 170), (330, 170), (512, 170), (694, 170)]
    labels = [("Słońce", "produkcja"), ("Dom", "zużycie na bieżąco"), ("Magazyn", "energia na wieczór"), ("Sieć", "nadwyżka")]
    connector(c, centers, GREEN)
    for (x, y), (h, b) in zip(centers, labels):
        c.setFillColor(CARD)
        c.setStrokeColor(LINE)
        c.roundRect(x - 58, y - 46, 116, 92, 8, fill=1, stroke=1)
        c.setFillColor(GREEN if h != "Sieć" else TEAL)
        c.circle(x, y + 25, 16, fill=1, stroke=0)
        draw_text(c, h, x - 42, y - 14, 84, 13, INK, "Deck-Bold", 16, 1)
        draw_text(c, b, x - 42, y - 34, 84, 9.4, MUTED, "Deck", 11, 2)
    c.setFillColor(NAVY)
    c.roundRect(92, 236, 304, 66, 8, fill=1, stroke=0)
    draw_text(c, "Najważniejsze pytanie klienta", 112, 276, 260, 11, HexColor("#aeb9c2"), "Deck-Bold", 13)
    draw_text(c, "Ile energii zostanie w domu, zamiast uciekać poza kontrolą?", 112, 254, 250, 15, CARD, "Deck-Bold", 17, 2)
    metric(c, 448, 236, "autokonsumpcja", "dom", GREEN)
    metric(c, 620, 236, "wieczorne zużycie", "magazyn", AMBER)


def slide_4(c: canvas.Canvas) -> None:
    header(c, 4, 0.36)
    title(c, "Magazyn energii zmienia rozmowę", 438, 540, 35)
    subtitle(c, "Bez magazynu klient zależy od tego, czy zużywa energię dokładnie wtedy, gdy świeci słońce. Z magazynem większa część produkcji zostaje w domu.", 332, 620)
    image_box(c, ROOT / "public/products/kon-tec-storage.webp", 92, 82, 178, 190, 12)
    image_box(c, ROOT / "public/products/deye-storage.webp", 330, 82, 178, 190, 16)
    image_box(c, ROOT / "public/products/felicity-storage.jpg", 568, 82, 178, 190, 12)
    c.setFillColor(CARD)
    c.setStrokeColor(LINE)
    c.roundRect(505, 292, 286, 108, 8, fill=1, stroke=1)
    draw_text(c, "Magazyn zwiększa autokonsumpcję, ogranicza straty na tanich godzinach i daje klientowi większą kontrolę nad domem.", 526, 364, 238, 13.8, INK, "Deck-Bold", 17, 5)


def slide_5(c: canvas.Canvas) -> None:
    header(c, 5, 0.48)
    title(c, "Rozliczenia w Polsce: klient musi to zobaczyć", 438, 620, 30)
    subtitle(c, "Net-billing zmienia rozmowę z 'ile oddam' na 'ile zużyję u siebie'. Magazyn energii daje prostszy obraz: mniej zależności od godzin i większą kontrolę.", 326, 690)
    card(c, 54, 62, 210, 156, GREEN, "PV bez magazynu", "Dom korzysta z produkcji w dzień. Nadwyżka idzie do sieci, a wieczorem energia jest kupowana z powrotem.")
    card(c, 316, 62, 210, 156, TEAL, "PV z magazynem", "Nadwyżka ładuje baterię. Wieczorem klient zużywa więcej własnej energii i łatwiej rozumie sens inwestycji.")
    card(c, 578, 62, 210, 156, AMBER, "Rozmowa handlowca", "Najpierw profil zużycia, potem dobór mocy, magazynu i warunków technicznych. Bez obietnic bez danych.")
    c.setFillColor(SOFT)
    c.roundRect(112, 238, 620, 54, 8, fill=1, stroke=0)
    draw_text(c, "Klient ma wyjść ze spotkania z jednym wnioskiem: energia nie jest abstrakcją z faktury, tylko przepływem, którym można zarządzać.", 138, 269, 560, 12.6, INK, "Deck-Bold", 15, 2)


def slide_6(c: canvas.Canvas) -> None:
    header(c, 6, 0.59)
    title(c, "Dobór instalacji bez zgadywania", 438, 540, 35)
    subtitle(c, "Spotkanie ma zebrać dane do decyzji, a nie tylko zachwycić klienta. CRM prowadzi handlowca przez to, co trzeba sprawdzić przed ofertą.", 334, 630)
    steps = [
        ("1", "rachunki i profil zużycia"),
        ("2", "dach, strony świata, zacienienie"),
        ("3", "falownik, magazyn, zabezpieczenia"),
        ("4", "trasa kabla i warunki montażu"),
        ("5", "PPE, licznik, zgody i brama umowy"),
    ]
    y = 262
    connector(c, [(72 + i * 144, y) for i in range(5)], HexColor("#9fcfbf"))
    for i, (num, label) in enumerate(steps):
        x = 72 + i * 144
        c.setFillColor([GREEN, TEAL, AMBER, GREEN, TEAL][i])
        c.circle(x, y, 20, fill=1, stroke=0)
        c.setFillColor(CARD)
        c.setFont("Deck-Black", 16)
        c.drawCentredString(x, y - 5, num)
        draw_text(c, label, x - 52, y - 48, 104, 10.6, INK, "Deck-Bold", 13, 3)
    c.setFillColor(NAVY)
    c.roundRect(96, 80, 650, 72, 8, fill=1, stroke=0)
    draw_text(c, "Kabel jest liczony prosto: CRM wpisuje łączną długość trasy i pilnuje limitu przewidzianego w ofercie.", 126, 121, 590, 15, CARD, "Deck-Bold", 18, 3)


def slide_7(c: canvas.Canvas) -> None:
    header(c, 7, 0.7)
    title(c, "Sprzęt, który domyka system", 438, 510, 35)
    subtitle(c, "Nie chodzi o katalog modeli. Chodzi o dobór zestawu, który technicznie pasuje, da się zamontować i zostawia administracji czysty proces.", 334, 610)
    items = [
        ("Panel", ROOT / "public/products/ja-solar-panel.webp", "moduły PV dobrane do dachu i profilu produkcji"),
        ("Falownik", ROOT / "public/products/deye-inverter.webp", "serce układu: moc, fazy, komunikacja, zabezpieczenia"),
        ("Magazyn", ROOT / "public/products/deye-storage.webp", "BMS, napięcie, CAN/RS485, firmware i gwarancja"),
    ]
    for i, (name, img, body) in enumerate(items):
        x = 70 + i * 245
        image_box(c, img, x, 142, 170, 150, 16)
        draw_text(c, name, x, 112, 170, 16, INK, "Deck-Bold", 18, 1)
        draw_text(c, body, x, 90, 170, 10.5, MUTED, "Deck", 13, 3)


def slide_8(c: canvas.Canvas) -> None:
    header(c, 8, 0.81)
    title(c, "Wybrane realizacje", 438, 520, 36)
    subtitle(c, "Dane klientów są ukryte. W CRM zostaje dokumentacja zdjęciowa, etapy procesu i odpowiedzialność za odbiór.", 332, 620)
    card(c, 54, 86, 212, 188, GREEN, "Lubelskie", "PV + magazyn. Dom jednorodzinny, przeniesienie zużycia na wieczór. Zdjęcia przed i po montażu w CRM.")
    card(c, 316, 86, 212, 188, TEAL, "Mazowieckie", "Magazyn energii. Modernizacja instalacji i uporządkowanie pracy falownika. Dokumenty odbiorowe w jednym miejscu.")
    card(c, 578, 86, 212, 188, AMBER, "Podkarpackie", "PV z rozbudową. Dobór mocy pod rachunki i planowane urządzenia domowe. Proces domknięty checklistą.")


def slide_9(c: canvas.Canvas) -> None:
    header(c, 9, 0.92)
    title(c, "Co klient ma zapamiętać", 438, 520, 36)
    subtitle(c, "Dobra prezentacja nie ma krzyczeć. Ma poukładać decyzję tak, żeby klient czuł, że ktoś wreszcie mówi ludzkim językiem.", 332, 610)
    c.setFillColor(NAVY)
    c.roundRect(70, 103, 332, 198, 10, fill=1, stroke=0)
    draw_text(c, "Referencja procesu", 98, 252, 260, 17, CARD, "Deck-Bold", 20)
    draw_text(c, "Najmocniejszy dowód to nie hasło. To spokojny proces: jasne dane, sensowny dobór, komplet dokumentów, zdjęcia z montażu i kontakt po odbiorze.", 98, 220, 260, 13.5, HexColor("#d7e0e6"), "Deck", 17, 6)
    card(c, 456, 195, 286, 106, GREEN, "Przed decyzją", "Klient rozumie, co kupuje i dlaczego zestaw ma sens dla jego domu.")
    card(c, 456, 72, 286, 106, AMBER, "Po montażu", "Klient ma dokumenty, zdjęcia, statusy i jeden punkt odpowiedzialności.")


def slide_10(c: canvas.Canvas) -> None:
    header(c, 10, 1.0)
    title(c, "Następny krok jest prosty", 438, 540, 38)
    subtitle(c, "Zbieramy dane, pokazujemy scenariusz, potwierdzamy technikę, przechodzimy przez bramkę umowy i realizujemy montaż bez gubienia informacji.", 334, 640)
    steps = [
        ("Spotkanie", "rachunki, dach, zużycie, potrzeby"),
        ("Dobór", "PV, magazyn, falownik, trasa kabla"),
        ("Oferta", "czytelny PDF i strona oferty"),
        ("Umowa", "checklista, bramka, podpis online"),
        ("Montaż", "magazyn, zdjęcia, odbiór"),
    ]
    for i, (h, b) in enumerate(steps):
        x = 70 + i * 144
        c.setFillColor(CARD)
        c.setStrokeColor(LINE)
        c.roundRect(x, 122, 116, 132, 8, fill=1, stroke=1)
        c.setFillColor([GREEN, TEAL, AMBER, GREEN, TEAL][i])
        c.rect(x, 240, 116, 14, fill=1, stroke=0)
        draw_text(c, h, x + 12, 214, 92, 13, INK, "Deck-Bold", 15, 2)
        draw_text(c, b, x + 12, 180, 92, 9.6, MUTED, "Deck", 12, 4)
    c.setFillColor(GREEN)
    c.roundRect(242, 62, 356, 38, 8, fill=1, stroke=0)
    draw_text(c, "Re-Energy System - decyzja, dokumenty, realizacja.", 270, 78, 310, 12.5, CARD, "Deck-Bold", 15, 1)


def build() -> None:
    register_fonts()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    PUBLIC.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUT), pagesize=landscape(A4))
    c.setTitle("B-CRM - prezentacja klienta")
    c.setAuthor("Re-Energy System")
    slides = [slide_1, slide_2, slide_3, slide_4, slide_5, slide_6, slide_7, slide_8, slide_9, slide_10]
    for slide in slides:
        slide(c)
        c.showPage()
    c.save()
    PUBLIC.write_bytes(OUT.read_bytes())


if __name__ == "__main__":
    build()
