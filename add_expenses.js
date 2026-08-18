const fs = require('fs');

const dbPath = './db.json';
const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

if (!data.items) data.items = {};
if (!data.items.charlie) data.items.charlie = {};
if (!data.items.charlie.expenses) data.items.charlie.expenses = [];

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

const expensesToAdd = [
  { name: 'Burger King', amount: 190.00 },
  { name: 'gift to tito Gerry and tita Doris', amount: 1101.95 },
  { name: 'moveit', amount: 106.00 },
  { name: 'moveit', amount: 67.00 },
  { name: 'gas', amount: 424.71 }
];

const newItems = expensesToAdd.map(exp => ({
  id: generateId(),
  name: exp.name,
  amount: exp.amount,
  start: '2026-09',
  end: null,
  recurring: false,
  dueDay: 3,
  paymentMethod: 'bpi_platinum',
  txDay: 14,
  cutoffDay: 14
}));

// Use Array.isArray check in case it's an object from Firebase (it might convert arrays with missing elements to objects)
if (Array.isArray(data.items.charlie.expenses)) {
  data.items.charlie.expenses.push(...newItems);
} else {
  // It's an object
  const nextIdx = Object.keys(data.items.charlie.expenses).length;
  newItems.forEach((item, i) => {
    data.items.charlie.expenses[nextIdx + i] = item;
  });
}

fs.writeFileSync('./db_new.json', JSON.stringify(data));
console.log('Added 5 expenses to db_new.json');
