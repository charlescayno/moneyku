// =============================
// Drag to reorder sub-expenses (Arrange mode)
// Pointer events on the drag handle only, so normal scrolling and row swipes are untouched.
// =============================

const ROW = ".arr-row";

export function initArrangeDrag() {
  let drag = null;

  const rowsOf = (container) => [...container.children].filter((el) => el.matches(ROW));

  function layout(clientY) {
    const { row, grab } = drag;
    // Put the row where the pointer wants it, swapping DOM order as it crosses neighbours.
    for (let guard = 0; guard < 50; guard++) {
      row.style.transform = "";
      const natural = row.getBoundingClientRect();
      const desiredTop = clientY - grab;
      const center = desiredTop + natural.height / 2;
      const prev = row.previousElementSibling;
      const next = row.nextElementSibling;
      if (prev && prev.matches(ROW)) {
        const r = prev.getBoundingClientRect();
        if (center < r.top + r.height / 2) { row.parentElement.insertBefore(row, prev); continue; }
      }
      if (next && next.matches(ROW)) {
        const r = next.getBoundingClientRect();
        if (center > r.top + r.height / 2) { row.parentElement.insertBefore(next, row); continue; }
      }
      row.style.transform = `translateY(${desiredTop - natural.top}px)`;
      break;
    }
  }

  function tick() {
    if (!drag) return;
    // Auto-scroll the page when dragging near the top or bottom edge.
    const edge = 70, y = drag.y;
    if (y < edge) window.scrollBy(0, -Math.ceil((edge - y) / 5));
    else if (y > window.innerHeight - edge) window.scrollBy(0, Math.ceil((y - (window.innerHeight - edge)) / 5));
    layout(y);
    drag.raf = requestAnimationFrame(tick);
  }

  function end(commit) {
    if (!drag) return;
    const { row, handle, pointerId, container, raf, startOrder } = drag;
    cancelAnimationFrame(raf);
    try { handle.releasePointerCapture(pointerId); } catch { /* already released */ }
    row.style.transform = "";
    row.classList.remove("arr-dragging");
    const order = rowsOf(container).map((el) => el.dataset.child);
    const who = container.dataset.who, parentId = container.dataset.parent;
    drag = null;
    if (commit && order.join() !== startOrder.join() && typeof window.reorderChildren === "function") {
      window.reorderChildren(who, parentId, order);
    } else if (!commit) {
      // Cancelled: put the rows back in their original order.
      startOrder.forEach((id) => {
        const el = container.querySelector(`${ROW}[data-child="${id}"]`);
        if (el) container.appendChild(el);
      });
    }
  }

  function startDrag(handle, pointerId, clientY) {
    const row = handle.closest(ROW);
    const container = row && row.parentElement;
    if (!container || drag) return false;
    try { handle.setPointerCapture(pointerId); } catch { /* pointer already gone */ }
    row.classList.add("arr-dragging");
    drag = {
      row, handle, container, pointerId, y: clientY,
      grab: clientY - row.getBoundingClientRect().top,
      startOrder: rowsOf(container).map((el) => el.dataset.child),
      raf: 0,
    };
    drag.raf = requestAnimationFrame(tick);
    return true;
  }

  document.addEventListener("pointerdown", (e) => {
    const handle = e.target.closest?.("[data-drag-handle]");
    if (!handle || drag || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    startDrag(handle, e.pointerId, e.clientY);
  });

  // Hold a sub-expense row (no need to open Arrange first) and drag it: the list switches to
  // arrange mode and the held row follows the finger/mouse.
  let hold = null;
  const cancelHold = () => { if (hold) { clearTimeout(hold.timer); hold = null; } };
  document.addEventListener("pointerdown", (e) => {
    if (drag || (e.pointerType === "mouse" && e.button !== 0)) return;
    const row = e.target.closest?.(".child-list [data-child]:not(.arr-row)");
    if (!row || e.target.closest("button")) return;
    const list = row.parentElement;
    if (list.querySelectorAll("[data-child]").length < 2) return;
    const h = { id: row.dataset.child, who: list.dataset.who, parentId: list.dataset.parent, pointerId: e.pointerId, x: e.clientX, y: e.clientY };
    h.timer = setTimeout(() => {
      hold = null;
      if (typeof window.toggleArrange !== "function") return;
      if (navigator.vibrate) { try { navigator.vibrate(15); } catch { /* ignore */ } }
      window.toggleArrange(h.parentId);
      const next = document.querySelector(`.child-list[data-parent="${h.parentId}"] .arr-row[data-child="${h.id}"] [data-drag-handle]`);
      if (next) startDrag(next, h.pointerId, h.y);
      // The release that ends this hold must not also count as a tap on the row.
      const swallow = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
      document.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => document.removeEventListener("click", swallow, { capture: true }), 600);
    }, 450);
    hold = h;
  });
  document.addEventListener("pointermove", (e) => {
    if (hold && e.pointerId === hold.pointerId && Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > 8) cancelHold();
    else if (hold && e.pointerId === hold.pointerId) hold.y = e.clientY;
  });
  document.addEventListener("pointerup", cancelHold);
  document.addEventListener("pointercancel", cancelHold);
  document.addEventListener("scroll", cancelHold, { passive: true });
  document.addEventListener("contextmenu", (e) => { if (e.target.closest?.(".child-list [data-child]")) e.preventDefault(); });

  document.addEventListener("pointermove", (e) => {
    if (drag && e.pointerId === drag.pointerId) { drag.y = e.clientY; e.preventDefault(); }
  }, { passive: false });
  document.addEventListener("pointerup", (e) => { if (drag && e.pointerId === drag.pointerId) end(true); });
  document.addEventListener("pointercancel", (e) => { if (drag && e.pointerId === drag.pointerId) end(false); });
  // Don't let a long-press on the handle open a context menu on touch devices.
  document.addEventListener("contextmenu", (e) => { if (e.target.closest?.("[data-drag-handle]")) e.preventDefault(); });
}
