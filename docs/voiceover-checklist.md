# VoiceOver checklist

The last part of the accessibility audit ([wcag-audit.md](wcag-audit.md)): hearing Tomekeeper with a screen reader. It takes about 30 minutes. Use Safari, which works best with VoiceOver, on the site running locally or on Azure.

## Before you start

- Turn VoiceOver on and off with **Cmd+F5**. "VO" below means **Control+Option**.
- **VO+Right/Left arrow**: next or previous item. **VO+Space**: press the item.
- **VO+U**: the rotor, a list of the page's headings, links, form fields and landmarks. Left and right arrows switch list.
- **Tab** still moves between links, buttons and fields.
- Two accounts help for the fellowship part; use a private window for the second.

For each step, note anything that is silent when it should speak, said twice, confusing, in a strange order, or wrong. "OK" is a fine note too.

## 1. Signing up and in

1. Open **Create an account**. Open the rotor: is there one level 1 heading, and do the form fields have clear names?
2. Press **Create account** with the fields empty. *Listen for:* the focus moves to "There is a problem", with each error as a link. Follow a link: does it land in the right field, and is the error read with the field?
3. Create the account, and go through the two first-step choices (goal and portrait). Are the radio groups read with their question ("Count your goal in, Pages")?

## 2. The chronicle

1. On **Your chronicle**, open the rotor's headings. Do they give a sense of the page?
2. Move through **The Twelve Labours**. *Listen for:* a list of months with the pages read in each, with this month marked as current, and no stray numbers from the wheel.

## 3. Books

1. In **The Library**, search for a book. *Listen for:* "N books found for …" read out without moving there.
2. Choose a shelf and press **Add**. *Listen for:* "… is on your Reading now shelf." The focus should stay on the button, now **Move**.
3. Open the book's page. Log a page in **Your reading**. *Listen for:* the saved progress read out.
4. In **Reviews**, find **Your rating** with Tab. *Listen for:* "1 star, radio button, 1 of 5" (or similar) in the "Your rating" group. Use the **arrow keys** to choose 4 stars, and save. *Listen for:* the focus moves to "Your review", and "Review saved."
5. Press **Remove** for the book. *Listen for:* "This also deletes …" read as a warning, with **Yes, remove** and **Keep it**. Choose **Keep it**.

## 4. Character and quests

1. On **Quests**, move to the medallions around the portrait. *Listen for:* each one's name and whether it is earned, and "selected" (pressed) for the one shown.
2. Go into the **Volumes** table (VO+arrows inside it). *Listen for:* the column header read with each cell.

## 5. Profile and fellowship

1. On **Profile**, use **See your profile as**: *A friend*, *Someone else*, *You*. *Listen for:* "selected" on the chosen button, and the note under them read out.
2. In **Who can see what**, choose *Everyone* for Reading now. *Listen for:* "Saved: Reading now is visible to Everyone."
3. With the second account, find the first on **Fellowship** and ask to be friends. *Listen for:* "You asked … to be friends." Accept it with the first account: is "You and … are friends now." read, and where does the focus land?
4. Open the other reader's profile: **Report** and **Block**. Press **Block**. *Listen for:* the question read out, then **Yes, block** and **Don't block**. Choose **Don't block**.

## 6. Everywhere

1. On any page, press **Tab** once. Is **Skip to content** the first thing, and does it work?
2. Press **Dark theme** and **Plain script** in the header. *Listen for:* their names and "selected" or not.
3. Open the footer's **Privacy** and **Accessibility statement**. Do the headings in the rotor make the long pages easy to move through?

## Afterwards

Send the notes to Claude. Problems found get fixed, and [the accessibility statement](../web/src/pages/AccessibilityPage.tsx) and [wcag-audit.md](wcag-audit.md) are updated with the date of this walk-through.
