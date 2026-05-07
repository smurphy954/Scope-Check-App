# Cabinet Lookbook

A self-contained HTML presentation for client meetings, covering the cabinet
collections you can offer through your subcontractor (Cetta Group). The
subcontractor's branding has been intentionally kept off the deck — the book
reads as yours.

## Files

- `index.html` — the full presentation. Open in any browser.
- `images/` — image slots, one folder per collection. **Empty by default.**
  Drop saved images into the matching folder using the filenames the page
  expects, and they'll appear automatically.

## How to use

1. Open `index.html` in Chrome, Safari, or Firefox.
2. Use the **"Print / Save PDF"** button in the top-right (or `Cmd/Ctrl + P`)
   to produce a PDF you can email or carry to the meeting. The deck is laid
   out for **landscape US Letter (11 × 8.5 in)**.
3. To present live, just go full-screen in the browser and scroll.

## Adding the photos

Empty image slots show a small dashed placeholder with the exact filename the
page is looking for. Save the image you want from the gallery
([cettaterrazza.com/gallery](https://www.cettaterrazza.com/gallery/)) and
save it into the matching folder with that filename.

For example, the "Urbane hero" slot expects:

```
lookbook/images/danver-urbane/hero.jpg
```

You can use `.jpg`, `.jpeg`, `.png`, or `.webp` — just keep the filename
(everything before the extension) the same. If you change the extension, also
update the `<img src="...">` in `index.html`.

### Filenames the page expects

```
images/cover/hero.jpg                    (cover hero)
images/cover/intro.jpg                   (intro slide)
images/cover/closing.jpg                 (next-steps slide)

images/danver-urbane/hero.jpg            + 01.jpg ... 06.jpg
images/danver-cosmopolitan/hero.jpg      + 01.jpg ... 05.jpg
images/brown-jordan-tecno/hero.jpg       + 01.jpg ... 03.jpg
images/brown-jordan-elements/01.jpg ... 04.jpg
images/naturekast/hero.jpg               + 01.jpg ... 03.jpg
images/sonoma-compact/hero.jpg           + 01.jpg ... 03.jpg
images/windswept/01.jpg ... 04.jpg
images/hdpe-marine/hero.jpg              + 01.jpg ... 03.jpg
```

Empty slots simply render as a quiet placeholder — the deck is presentable
without any photos at all, but it sings once they're in.

## Editing the copy

All product descriptions, features, and the at-a-glance comparison live
directly in `index.html`. They're written for a client audience — feel free to
tweak the voice to match how you talk to your customers, drop in pricing
ranges, or trim collections you don't want to show on a given project.

## Collections covered

1. **Danver Outdoor Kitchens** — Urbane and Cosmopolitan
2. **Brown Jordan Outdoor Kitchens** — TECNO and Elements
3. **NatureKast** — fully weatherproof polyurethane resin cabinetry
4. **Sonoma Compact Collection** — 16 mm phenolic compact board
5. **Windswept Collection** — Accoya (acetylated wood) doors
6. **HDPE Marine Grade Collection** — marine-grade polymer

Source content is summarized from cettaterrazza.com and the underlying
manufacturers (Danver, Brown Jordan Outdoor Kitchens, NatureKast, Accoya/
ZähBuilt). Verify finish names and warranty terms with the subcontractor
before any final commitment to the client.
