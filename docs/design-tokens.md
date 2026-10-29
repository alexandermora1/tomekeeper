# Design tokens

The colours live in `web/src/styles/tokens.css` as CSS custom properties. `<html data-theme>` switches between light and dark, and anything with `class="paper"` switches back to ink on paper in the dark theme.

## Light

| Token | Value | Use |
| --- | --- | --- |
| `--page` | `#F6F1E4` | Page background |
| `--raised` | `#FFFDF7` | Inputs, cards |
| `--ink` | `#171512` | Text, frames |
| `--muted` | `#4D463C` | Secondary text |
| `--accent` | `#9A3F2B` | Red headings, focus ring |
| `--red` / `--blue` | `#B5523B` / `#4F6E8C` | Progress bars |
| `--gold` | `#D9B45A` | Initials, the sun, current page underline (decorative only) |

## Dark

| Token | Value |
| --- | --- |
| `--page` | `#1C1914` |
| `--raised` | `#26221B` |
| `--ink` | `#E6DAC1` |
| `--muted` | `#B3A78F` |
| `--accent` | `#E8957A` |
| `--red` / `--blue` | `#D3765A` / `#86A6C4` |
| `--wash` | `#42371C` |
| `--chrome` (header, footer) | `#0F0D0A` |

## Paper plates (dark theme)

Woodcuts keep their black ink and sit on a dimmed paper plate, `#C9BC9E`. Inside `.paper`: ink `#171512`, muted `#3F3930`, accent `#7E2F1F`, success `#33492B`.

## Contrast (WCAG 2.2 AA needs 4.5:1 for text)

| Pair | Light | Dark |
| --- | --- | --- |
| Ink on page | 16.2:1 | 12.7:1 |
| Muted on page | 8.3:1 | 7.4:1 |
| Accent on page | 6.0:1 | 7.5:1 |
| Muted on wash | 6.6:1 | 4.7:1 |
| Ink on chrome (header) | 16.2:1 | 14.0:1 |

On the paper plate: ink 9.7:1, muted 6.1:1, accent 4.8:1, success 5.3:1.
