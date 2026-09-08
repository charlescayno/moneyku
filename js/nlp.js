import { currentKey, myData } from './state.js';
import { extractNumber } from './utils.js';

// Heuristic parser for financial projections
export function parsePrompt(text) {
  text = text.toLowerCase().trim();
  if (!text) return null;

  // 1. Determine Intent
  let intent = 'UNKNOWN';
  
  if (text.startsWith('paid ') || text.startsWith('settle ')) {
    intent = 'MARK_PAID';
  } else if (text.startsWith('add recurring ') || text.startsWith('new bill ')) {
    intent = 'ADD_RECURRING';
  } else if (text.startsWith('add ') || text.startsWith('project ')) {
    intent = 'ADD_ONEOFF';
  } else if (text.startsWith('how much ') || text.startsWith('what is ') || text.startsWith('leftover ')) {
    intent = 'QUERY';
  } else if (text.startsWith('transfer ') || text.startsWith('move ')) {
    intent = 'TRANSFER';
  }

  // 2. Extract Amount
  const amountMatch = text.match(/\d+(\.\d+)?/);
  const amount = amountMatch ? parseFloat(amountMatch[0]) : null;

  // 3. Extract Subject
  let subject = '';
  if (intent === 'MARK_PAID') {
    subject = text.replace(/^(paid|settle)\s+/, '').trim();
  } else if (intent === 'ADD_RECURRING' || intent === 'ADD_ONEOFF') {
    // e.g. add netflix for 500
    const parts = text.split(/for|amount|costing/);
    subject = parts[0].replace(/^(add recurring|new bill|add|project)\s+/, '').trim();
  }

  // 4. Fuzzy Match Subject against existing items for MARK_PAID
  let matchingItems = [];
  if (intent === 'MARK_PAID' && subject) {
      const monthData = myData.items?.charlie?.expenses || [];
      // Basic substring match for now
      matchingItems = monthData.filter(item => item.name.toLowerCase().includes(subject));
  }

  return {
    intent,
    amount,
    subject,
    raw: text,
    matchingItems
  };
}

export function handleQuery(parsed) {
    if (parsed.intent !== 'QUERY') return null;
    const text = parsed.raw;

    // Check for leftover / remaining
    if (text.includes('left') || text.includes('remaining') || text.includes('balance')) {
        // Need to calculate projection for current month
        // We'll emit an event or return a signal for the UI to handle, 
        // since full calculation requires UI state or state.js functions.
        return { type: 'LEFTOVER' };
    }

    return null;
}
