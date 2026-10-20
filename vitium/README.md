# VITIUM

**A field guide to the seven appetites / 七宗罪 · 欲望解剖图谱**

Live: **https://opes32.github.io/vitium/**
Repository target: **https://github.com/OPES32/OPES32.github.io** (site lives in `/vitium/`)

VITIUM is a single-page digital exhibition about the seven deadly sins. It treats the
sins not as a moral scoreboard but as seven conditions of wanting — and turns each one
into a small interactive instrument.

No stock photography. No icon library. No framework. Every mark on the page is type,
CSS, or inline SVG.

---

## The idea

The art direction is a collision of a **baroque emblem book**, a **clinical specimen
catalogue**, and a **contemporary editorial spread**. The page behaves like an object
that was printed, annotated, and then wired for sound:

- A rotating **wheel of appetites** is the entrance to the seven rooms.
- Each room has a different colour field, layout rhythm, and interactive apparatus.
- The interface keeps the same typographic rules — a display serif for the soul, a
  black grotesque for the body, a mono face for the evidence — while letting every sin
  disobey the layout in its own way.
- A privately generated **confessional** closes the exhibition. It never sends or stores
  what you type.
- Optional room tone is synthesised in the browser with the Web Audio API.

### The seven rooms

| # | Sin | Apparatus | What it does |
| --- | --- | --- | --- |
| I | Pride / 傲慢 | The mirror with a pupil | The eye tracks your pointer; click it to blink |
| II | Greed / 贪婪 | The acquisition engine | Every press claims another square; the count has no end |
| III | Lust / 色欲 | A muscle that lies | Hold to bring the pulse closer; release to return |
| IV | Envy / 嫉妒 | The relative mirror | Your mirrored double follows your pointer; look away to make it go dark |
| V | Gluttony / 暴食 | The intake | Feed a phrase into the mouth; it is not saved |
| VI | Wrath / 暴怒 | The pressure valve | Hold until the plate cracks; reset the valve |
| VII | Sloth / 怠惰 | The stillness clock | Start doing nothing; the clock only counts non-productive time |
| VIII | — | The confessional | Choose a hunger, write one sentence, receive a small penance |

---

## Run it

The site is plain HTML, CSS, and JavaScript. It needs to be served over HTTP so the local
font files load consistently.

```bash
cd vitium
npm start
# open http://127.0.0.1:4173
```

No install step and no dependencies. Node 18+ is enough. You can also use any static
server you prefer, for example `npx serve .` or `python -m http.server`.

To use another port:

```powershell
$env:PORT=8080; npm start
```

---

## Structure

```text
vitium/
├─ index.html               # all seven rooms, semantic markup, inline SVG
├─ css/style.css            # design system, per-sin art direction, responsive rules
├─ js/main.js               # wheel, themes, instruments, confession, audio
├─ assets/
│  ├─ fonts/                # self-hosted WOFF2 (OFL — see licenses/)
│  ├─ img/noise.svg         # paper grain
│  ├─ img/vitium-cover.png  # social card
│  └─ favicon.svg
├─ licenses/                # SIL OFL 1.1 + font attribution
├─ preview/                 # clean screenshots of the exhibition
├─ server.mjs               # dependency-free local preview server
└─ package.json
```

---

## Design system

- **Display:** Instrument Serif (with a subsetted Noto Serif SC for Chinese)
- **Mass:** Archivo Black
- **Evidence:** DM Mono
- **Paper:** `#e8e2d5` · **Ink:** `#12110e` · **Vermilion:** `#d7472f`
- **Room colours:** cobalt, brass, oxblood, bile, mustard, vermilion, fog
- **Motion:** a single reveal language; no generic fade-up-everything. Each apparatus
  has its own physical behaviour. `prefers-reduced-motion` removes the movement.
- **Composition:** twelve-column editorial grid on desktop; each sin is allowed to break
  it differently. Chapter numbering uses Roman numerals because the subject is a list
  of seven, not because it is a UI convention.

### References, remixed rather than copied

- the marginalia and emblems of early modern printed books
- Swiss exhibition catalogues and their use of the grid as a stage
- 1970s Italian film title cards, with their acid palettes and distressed type
- natural-history specimen plates, where every object carries a caption and a number
- contemporary experimental music sites, where an index can also be an instrument

---

## Accessibility & privacy

- Semantic landmarks, a visible skip link, and a single `h1`.
- Native `<dialog>` for the index with focus handling and `Escape` support.
- All apparatuses are reachable and operable by keyboard.
- Every room has a visible focus style and respects `prefers-reduced-motion`.
- The sound is opt-in and synthesised locally.
- No cookies, analytics, third-party scripts, images, or network calls after load.
- The confessional is client-side only: no fetch, no storage, and the field is cleared
  after the penance is shown.

Tested in Chromium at 1440, 1280, 1024, 768, 390, and 320 px. The layout is fluid and
does not scroll horizontally at those widths. Automated WCAG 2.1 A/AA checks (axe-core)
report no violations on the base page or the open index dialog at both 1440 px and 390 px.

---

## Preview

- [The cover](preview/01-cover.png)
- [Index of appetites](preview/02-index.png)
- [I — Pride](preview/03-pride.png)
- [VI — Wrath](preview/04-wrath.png)
- [VIII — The confessional](preview/05-confession.png)
- [Mobile cover](preview/06-mobile-cover.png)

## Notes

- The Chinese copy is in Simplified Chinese; the Latin titles use the traditional Latin
  names of the sins.
- The room tone is intentionally quiet and low-frequency. It is a background texture,
  not a soundtrack.
- The site is a self-contained exhibition, not a CMS or a production marketing site.
  The confessional has no server by design.
- Typefaces are licensed under the SIL OFL 1.1. See [`licenses/`](licenses/).
