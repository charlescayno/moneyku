# Moneyku UX backlog (phone-first). Ranked by help for daily phone use.
Status: todo | done | skipped | needs decision

| # | Status | Issue | Where |
|---|--------|-------|-------|
| 1 | done | Header icon buttons were 36px on phones; now 44px (320px screens shrink them to ~32px wide x 44px tall to fit) | index.html header |
| 2 | done | Month bar buttons (‹ › Today, label) raised from 40px to 44px | index.html #month-nav |
| 3 | done | Overview close and sign-out buttons raised to 44px and spaced 16px apart | index.html #more-overlay |
| 4 | done | Item row tags (card, due date, installment end) raised from 9px to 11px; remaining 8-10px text elsewhere left as is | js/ui/components.js, cardui.js |
| 5 | done | Month picker close button is already 56px and fixed at the bottom centre | index.html #month-picker |
| 6 | skipped | Bottom tab bar no longer exists in the app (no #tabbar element) | js/tabs.js is unused |
| 7 | done | Empty months already show "No income/expenses yet" with an Add button | js/ui/components.js |
| 8 | done | Search and History sheets already have titles "Search" and "History" | js/extras.js, js/ui/historyui.js |
| 9 | skipped | #undo-btn no longer exists; Undo now appears as a toast action and in the History sheet | js/ui/historyui.js |
| 10 | done | Confirm dialog: gap between Delete and Cancel raised from 8px to 20px | index.html #confirm-buttons |

Notes
- Never touch: database rules, live data rewrites or migrations, Firebase setup, data model.
- Each tick: one item, tests (`node --test`, `python tests/layout_check.py`), bump sw cache, commit, push.


UI pass (Nov 21): text floor 11px and lighter greys (theme.css); due-soon reminders moved under the headline on phones (layout.js); inline field errors (core.js fieldError). Known: style.css:1431 sets month-nav buttons to 40px on phones (layout_check flags it).


UI 5-pass (Nov 21): (1) month bar buttons 44px on phones, (2) toast is a live region, (3) Escape closes top-most overlay, (4) color-scheme dark for native controls, (5) scroll containment on month picker and sheets. Skipped on purpose: role=dialog on overlays (closed overlays are only faded out, would need aria-hidden wiring).
