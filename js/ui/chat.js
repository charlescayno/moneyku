import { $ } from '../utils.js';
import { parsePrompt, handleQuery } from '../nlp.js';
import { toggleItemPaid, addItem, myData, currentKey } from '../state.js';
import { updateFirebaseItem, updateFirebasePaid } from '../firebase.js';

let activeParsed = null;

export function initChat() {
  const input = chat-input;
  if (!input) return;

  input.addEventListener('input', (e) => {
    const text = e.target.value;
    activeParsed = parsePrompt(text);
    renderPreview(activeParsed);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeCommand();
    }
  });
}

function renderPreview(parsed) {
  const previewBox = nlp-preview;
  if (!previewBox) return;

  if (!parsed || parsed.intent === 'UNKNOWN') {
    previewBox.classList.add('opacity-0', 'pointer-events-none');
    previewBox.classList.remove('opacity-100', 'pointer-events-auto');
    return;
  }

  // Show preview
  previewBox.classList.remove('opacity-0', 'pointer-events-none');
  previewBox.classList.add('opacity-100', 'pointer-events-auto');

  let html = '';
  
  switch(parsed.intent) {
    case 'MARK_PAID':
      html = `<div class="text-xs text-slate-400 font-bold mb-1">MARK PAID</div>`;
      if (parsed.matchingItems.length === 0) {
        html += `<div class="text-white">No matching bills found for "\"</div>`;
      } else if (parsed.matchingItems.length === 1) {
        html += `<div class="text-emerald-400 font-medium">?? `</div>`;
      } else {
        html += `<div class="text-white">Multiple matches. (Selection UI coming soon)</div>`;
      }
      break;
    case 'ADD_RECURRING':
      html = `<div class="text-xs text-slate-400 font-bold mb-1">ADD RECURRING BILL</div>`;
      html += `<div class="text-blue-400 font-medium">? \ `</div>`;
      break;
    case 'ADD_ONEOFF':
      html = `<div class="text-xs text-slate-400 font-bold mb-1">ADD PROJECTED EXPENSE</div>`;
      html += `<div class="text-indigo-400 font-medium">? \ `</div>`;
      break;
    case 'QUERY':
      html = `<div class="text-xs text-slate-400 font-bold mb-1">ASK AI</div>`;
      html += `<div class="text-white font-medium">?? `</div>`;
      break;
    default:
      html = `<div class="text-white">`</div>`;
  }

  previewBox.innerHTML = html;
}

function executeCommand() {
  if (!activeParsed || activeParsed.intent === 'UNKNOWN') return;

  const input = chat-input;
  
  if (activeParsed.intent === 'MARK_PAID') {
    if (activeParsed.matchingItems.length === 1) {
      const item = activeParsed.matchingItems[0];
      const isPaid = toggleItemPaid(item.id);
      updateFirebasePaid(item.id, isPaid);
      // Trigger UI re-render? For now rely on state listener if any, or manual reload
      // We will need to trigger a render.
      window.dispatchEvent(new Event('renderBudget'));
      clearChat();
    }
  } else if (activeParsed.intent === 'ADD_ONEOFF' || activeParsed.intent === 'ADD_RECURRING') {
     if (activeParsed.subject && activeParsed.amount) {
        const newItem = {
          id: Math.random().toString(36).substr(2, 9),
          name: activeParsed.subject,
          amount: activeParsed.amount,
          recurring: activeParsed.intent === 'ADD_RECURRING',
          start: currentKey(),
          paymentMethod: 'cash'
        };
        addItem('charlie', 'expenses', newItem);
        updateFirebaseItem('charlie', 'expenses', newItem.id, newItem);
        window.dispatchEvent(new Event('renderBudget'));
        clearChat();
     }
  } else if (activeParsed.intent === 'QUERY') {
    const q = handleQuery(activeParsed);
    if (q && q.type === 'LEFTOVER') {
      showAIResponse("Your leftover budget calculation goes here.");
      clearChat();
    }
  }
}

function clearChat() {
  const input = chat-input;
  if (input) input.value = '';
  activeParsed = null;
  renderPreview(null);
}

function showAIResponse(text) {
  const card = nlp-response;
  if (!card) return;
  card.innerHTML = `<div class="flex items-center gap-2"><span class="material-icons text-blue-400">auto_awesome</span><span>`</span></div>`;
  card.classList.remove('translate-y-[150%]', 'opacity-0');
  
  setTimeout(() => {
    card.classList.add('translate-y-[150%]', 'opacity-0');
  }, 4000);
}
