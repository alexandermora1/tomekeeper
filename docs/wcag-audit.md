# WCAG 2.2 AA audit

Audited 4 November 2026, against all 55 success criteria at levels A and AA of WCAG 2.2 (4.1.1 Parsing was removed in 2.2). Norwegian law asks for WCAG 2.1 AA, which this covers.

**Result:** every criterion that applies is met, after one fix (2.5.8, below). What remains is a walk-through with a real screen reader: [voiceover-checklist.md](voiceover-checklist.md).

## How it was checked

- **An automated sweep of every page** (`/sign-in`, `/sign-up`, `/forgot-password`, `/privacy`, `/accessibility`, `/credits`, the not-found page, `/first-steps`, `/`, `/library`, `/library/add`, a book page, `/quests`, `/fellowship`, `/profile`, `/profile/edit`, another reader's profile, `/report/{handle}` and `/settings`), signed in and out, in the light and dark themes. On each page it:
  - ran axe-core with the WCAG 2.0, 2.1 and 2.2 A and AA rules and best practices;
  - measured every link, button and field against the 24 by 24 pixel target size (links inside sentences are exempt);
  - pressed Tab through the whole page, checking that each stop shows a focus indicator and that the focus comes back round (no trap);
  - applied WCAG's text spacing (line height 1.5, letter spacing 0.12em, word spacing 0.16em, 2em after paragraphs) and looked for sideways scrolling and clipped text, at 1280 and 320 pixels wide;
  - checked the page title, the `lang` of the page, one `main` and one `h1`, heading levels going down one at a time, and `autocomplete` on name, email and password fields.
- **The walkthroughs from each build step**, which also ran axe on states the sweep doesn't reach (error summaries, confirmations, results, empty and full lists, at 320 pixels and in the dark theme), and checked where the focus goes after each action and what is announced.
- **A review of the code** for each criterion below.

## Fixed in this audit

| Criterion | Problem | Fix |
| --- | --- | --- |
| 2.5.8 Target size (minimum) | The "Back to …" links on the book page, Add a book, Edit profile and Report pages were 23 pixels tall. They had the spacing exception, but needn't rely on it. | 2px padding above and below, so they are 27 pixels tall. |

## Criterion by criterion

| Criterion | Level | Result | How |
| --- | --- | --- | --- |
| 1.1.1 Non-text content | A | Met | Woodcuts, portraits, the vine strip, frame corners and medallion drawings are decorative (`alt=""` or hidden from screen readers), with the name or text beside them. Initials keep the real letter in the text. Stars are `role="img"` with "4 of 5 stars". Covers have the title next to them. |
| 1.2.1–1.2.5 Audio and video | A, AA | Not applicable | No audio or video. |
| 1.3.1 Info and relationships | A | Met | Headings, lists, landmarks, a table with column headers (volumes), fieldsets with legends for radio groups, labels tied to fields, errors tied to fields with `aria-describedby`. |
| 1.3.2 Meaningful sequence | A | Met | The page order in the code is the reading order. The Twelve Labours wheel is hidden from screen readers, which get the months as a list. |
| 1.3.3 Sensory characteristics | A | Met | No instruction depends on shape, place or colour. |
| 1.3.4 Orientation | AA | Met | Works upright and sideways. |
| 1.3.5 Identify input purpose | AA | Met | `autocomplete` on the name, email and password fields of the account forms: `nickname`, `username` (the email, which is the account's user name, so password managers fill it), `current-password` and `new-password`. |
| 1.4.1 Use of colour | A | Met | Links in text are underlined; earned gear also says so in words; stars differ in shape (★ ☆) as well as colour; errors have text. |
| 1.4.2 Audio control | A | Not applicable | No sound. |
| 1.4.3 Contrast (minimum) | AA | Met | Every text colour pair is checked in both themes ([design-tokens.md](design-tokens.md)); axe finds no contrast problems. |
| 1.4.4 Resize text | AA | Met | Sizes in rem; text grows with the browser's setting and zoom to 200 percent without loss. |
| 1.4.5 Images of text | AA | Met | The woodcut initials are decorative and the real letter is text; Plain script turns the blackletter off. All other text is text. |
| 1.4.10 Reflow | AA | Met | No sideways scrolling at 320 pixels (400 percent zoom of 1280); the volumes table scrolls inside its own focusable box, which tables may. |
| 1.4.11 Non-text contrast | AA | Met | Field borders, radio buttons, focus rings and medallion outlines are in the ink colour on the page colour. |
| 1.4.12 Text spacing | AA | Met | Nothing clipped or overflowing with WCAG's spacing (sweep). |
| 1.4.13 Content on hover or focus | AA | Not applicable | Nothing appears on hover or focus. |
| 2.1.1 Keyboard | A | Met | Everything works with the keyboard: native links, buttons and fields; the wheel isn't interactive. |
| 2.1.2 No keyboard trap | A | Met | Tabbing goes round every page (sweep). |
| 2.1.4 Character key shortcuts | A | Not applicable | No shortcuts. |
| 2.2.1 Timing adjustable | A | Met | No time limits on pages. Email links last 24 hours, past the criterion's 20-hour exception. |
| 2.2.2 Pause, stop, hide | A | Met | Nothing moves by itself; motion is reduced when the device asks for it. |
| 2.3.1 Three flashes | A | Met | Nothing flashes. |
| 2.4.1 Bypass blocks | A | Met | "Skip to content" is the first link on every page. |
| 2.4.2 Page titled | A | Met | Each page has its own title, "Page – Tomekeeper"; books and readers by name. |
| 2.4.3 Focus order | A | Met | The focus follows the page; after an action it goes to the result (a moved book, a new state line, an error summary, a heading that replaces removed content). |
| 2.4.4 Link purpose (in context) | A | Met | Links say where they go; repeated ones ("Report", "Accept") carry the name in hidden text ("Report review by Tormod"). |
| 2.4.5 Multiple ways | AA | Met | The menu and footer on every page, links between pages (chronicle to quests, books, profiles), and search for books and readers. |
| 2.4.6 Headings and labels | AA | Met | Headings and labels say what follows. |
| 2.4.7 Focus visible | AA | Met | Every tab stop has a visible ring (sweep), including the stars, which show it on the star. |
| 2.4.11 Focus not obscured (minimum) | AA | Met | Nothing is fixed or sticky on the page, so nothing can cover the focus. |
| 2.5.1 Pointer gestures | A | Met | Single taps and clicks only. |
| 2.5.2 Pointer cancellation | A | Met | Ordinary buttons and links, which act on release. |
| 2.5.3 Label in name | A | Met | Each name starts with its visible label ("Ask to be friends" + "with Tormod"). |
| 2.5.4 Motion actuation | A | Not applicable | Nothing reacts to moving the device. |
| 2.5.7 Dragging movements | AA | Not applicable | No dragging. |
| 2.5.8 Target size (minimum) | AA | Met (after the fix) | Every target at least 24 by 24 pixels, apart from links inside sentences (sweep). |
| 3.1.1 Language of page | A | Met | `<html lang="en">`. |
| 3.1.2 Language of parts | AA | Met | All text is English; names of people and places aren't counted. |
| 3.2.1 On focus | A | Met | Focus never changes the page. |
| 3.2.2 On input | A | Met | Choosing in a list or radio group does nothing until a button is pressed, except the profile's "Who can see what", which saves at once and says so above the choices; it doesn't change the page. |
| 3.2.3 Consistent navigation | AA | Met | The same header and footer in the same order on every page. |
| 3.2.4 Consistent identification | AA | Met | The same things have the same names everywhere. |
| 3.2.6 Consistent help | A | Met | The privacy policy and accessibility statement, with the contact address, are linked in the same place in the footer of every page. |
| 3.3.1 Error identification | A | Met | An error summary at the top of the form, which takes the focus, and the error next to each field. |
| 3.3.2 Labels or instructions | A | Met | Every field has a label, and a hint where the format matters. |
| 3.3.3 Error suggestion | AA | Met | Errors say how to fix them ("Use 3 to 30 lowercase letters…"). |
| 3.3.4 Error prevention (legal, financial, data) | AA | Met | Deleting the account needs the email and password; removing a book with pages or a review, deleting a review, removing a friend and blocking all ask first. |
| 3.3.7 Redundant entry | A | Met | No form asks for something already given. |
| 3.3.8 Accessible authentication (minimum) | AA | Met | No puzzles or memory tests: passwords can be pasted and filled by password managers, can be shown, and Google sign-in and email links are alternatives. |
| 4.1.2 Name, role, value | A | Met | Native elements wherever possible; toggles use `aria-pressed`, the current page `aria-current`; axe finds no problems. |
| 4.1.3 Status messages | AA | Met | Results, saves and errors are in `role="status"` or `role="alert"` regions, or the focus moves to them. |

## Still to do

- A walk-through with VoiceOver on a Mac, by a person: [voiceover-checklist.md](voiceover-checklist.md). Automated tools can't tell whether announcements make sense when heard.
- The sweep and the walkthroughs ran in the workspace Claude builds and tests in; they aren't in the repository. Adding them as Playwright tests, so CI runs them, would keep this audit true as the site changes.
