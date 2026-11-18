# Moneyku UX backlog (phone-first). Ranked by help for daily phone use.
Status: todo | done | skipped | needs decision

| # | Status | Issue | Where |
|---|--------|-------|-------|
| 1 | done | Header icon buttons were 36px on phones; now 44px (320px screens shrink them to ~32px wide x 44px tall to fit) | index.html header |
| 2 | todo | Month bar buttons (‹ › Today, label) are 40px; raise to 44px | index.html #month-nav |
| 3 | todo | Overview close and sign-out buttons are 40px, close to each other | index.html #more-overlay |
| 4 | todo | Tiny text (8-10px) on labels like "projected" and chip captions; raise to 11px where it carries info | js/ui/components.js, cardui.js |
| 5 | todo | Month picker close button is small and far from the thumb; make it larger and fixed at the bottom | index.html #month-picker |
| 6 | todo | Pressing a bottom-tab shows no active-state feedback beyond color; add a clearer active indicator | index.html tabs, style.css |
| 7 | todo | Empty states: months with no items show a blank area; add a short hint | js/ui/layout.js |
| 8 | todo | Search and History buttons have only an icon; add visible labels in their screens' titles | js/ui/historyui.js |
| 9 | todo | Disabled Undo has no explanation on touch (title tooltip only shows on hover) | index.html #undo-btn |
| 10 | todo | Confirm dialogs: destructive button is as large as cancel; add spacing so it is not tapped by accident | index.html #confirm-overlay |

Notes
- Never touch: database rules, live data rewrites or migrations, Firebase setup, data model.
- Each tick: one item, tests (`node --test`, `python tests/layout_check.py`), bump sw cache, commit, push.
