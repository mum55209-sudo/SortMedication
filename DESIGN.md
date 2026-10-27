# SortMedication design guide

SortMedication uses a **square design**. Everything on screen is built from
boxes with sharp corners that sit on a tidy grid. The look should feel clean,
calm and organised, like labelled drawers in a pharmacy.

All of the styles live in one file: `src/app/globals.css`.

## The square rules

1. **No rounded corners.** Cards, buttons, inputs, tags, tabs, messages and
   the app icon all have square corners. In code this is the `--radius`
   setting, which is `0`. Never write a different `border-radius`.
2. **Boxes have edges, not shadows.** A card is a white box with a thin grey
   1px border (`--border`). We do not use drop shadows.
3. **Line things up on a grid.** Cards and tiles sit in a `.grid`, which
   places them in equal columns with the same space between them
   (`--gap`, 16px). On a phone the columns stack into one.
4. **One shape per job.** A box is either a card (holds content), a tile
   (a card you click, like the dashboard numbers), a button, or an input.
   Do not invent new shapes.
5. **Colour marks meaning.** A thick coloured stripe down the left edge of a
   tile says what kind of number it is (see Colours).

## Spacing

| Setting | Value | Used for |
| --- | --- | --- |
| `--gap` | 16px | Space between cards and tiles, and below each card |
| Card padding | 18px | Space inside a card |
| Field gap | 12px | Space between form fields |

## Colours

| Name | Colour | Used for |
| --- | --- | --- |
| `--brand` | Teal `#0f6e66` | Top bar, main buttons, links, active tab |
| `--bg` | Light grey `#f4f6f8` | Page background |
| `--card` | White | Cards and inputs |
| `--border` | Grey `#d9dee4` | Card and box edges |
| `--text` / `--muted` | Dark / mid grey | Main text / helper text |
| Green | `--green`, `--green-bg` | Good, in stock, saved |
| Amber | `--amber`, `--amber-bg` | Running low, expiring soon |
| Red | `--red`, `--red-bg` | Expired, errors, risky actions |
| Blue | `--blue`, `--blue-bg` | Free trial banner and information |

## Building blocks

- **Card** (`.card`): white square box with a grey border. Use for any group
  of content.
- **Tile** (`.card.stat`): a card with one big number and a label. Add
  `green`, `amber` or `red` for the coloured left stripe.
- **Grid** (`.grid`): wraps cards or tiles so they line up in columns.
- **Button** (`button`, `.button`): solid teal square. Variants:
  `.secondary` (white with teal edge), `.danger` (white with red edge),
  `.small`, and `.link` (looks like a text link).
- **Inputs** (`input`, `select`, `textarea`): square white boxes with a grey
  edge that turns teal when you click into them.
- **Tags** (`.tag`): small square labels such as "Low", "Expired" or
  "DEA II".
- **Messages** (`.notice`, `.warning`, `.error`): full-width square
  coloured bars.
- **Tabs** (`.tabs`): a row of square boxes; the active one is teal.
- **Tables**: full width, thin lines between rows, grey header row.

## Type

- System font (the one the computer already has), so it loads fast.
- Page title 1.6rem bold, section title 1.2rem, body 1rem.
- Numbers in tables line up on the right.

## Checklist for new screens

- [ ] No `border-radius` other than `var(--radius)`.
- [ ] No `box-shadow`.
- [ ] Content sits in `.card` boxes, and groups of cards sit in a `.grid`.
- [ ] Uses the colour names above, not new colours.
- [ ] Looks right at phone width (cards stack, nothing scrolls sideways).
