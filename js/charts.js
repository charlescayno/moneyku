// =============================
// Chart.js Visualizations
// =============================

import { peso, monthShort, keyParts } from "./utils.js";
import {
  timeline,
  getItems,
  itemActiveIn,
  itemAmts,
  monthTotals,
  accountsTotal,
} from "./state.js";

let pieChartInstance = null;
let barChartInstance = null;
let projectionChartInstance = null;

export function renderCharts(currentK) {
  if (!window.Chart) return;
  
  Chart.defaults.color = '#94a3b8'; // text-slate-400
  Chart.defaults.font.family = 'Nunito, sans-serif';
  Chart.defaults.font.weight = 'bold';

  renderPieChart(currentK);
  renderBarChart(currentK);
}

export function renderPieChart(k) {
  const ctx = document.getElementById('pieChart');
  if (!ctx || !window.Chart) return;
  
  const expenses = getItems("charlie", "expenses").filter((it) => itemActiveIn(it, k));
  
  // Group by category/name and sum totals
  const categoryTotals = {};
  for (const it of expenses) {
    const name = (it.name || "Unnamed").trim();
    categoryTotals[name] = (categoryTotals[name] || 0) + itemAmts(it, k).total;
  }
  
  // Sort descending by amount
  const sortedEntries = Object.entries(categoryTotals)
    .filter(([_, amt]) => amt > 0)
    .sort((a, b) => b[1] - a[1]);
    
  const labels = sortedEntries.map(e => e[0]);
  const data = sortedEntries.map(e => e[1]);
  
  // Indigo/Fuchsia/Emerald gradients
  const colors = [
    '#6366f1', '#a855f7', '#ec4899', '#f43f5e', '#f97316',
    '#eab308', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6'
  ];

  if (pieChartInstance) pieChartInstance.destroy();
  
  pieChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: colors.slice(0, data.length),
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          titleFont: { size: 13, weight: '900' },
          bodyFont: { size: 14, weight: '900' },
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: function(context) { return ' ' + peso(context.raw); }
          }
        }
      }
    }
  });
}

export function renderBarChart(currentK) {
  const ctx = document.getElementById('barChart');
  if (!ctx || !window.Chart) return;
  
  const t = timeline();
  const curIdx = t.indexOf(currentK);
  if (curIdx === -1) return;
  
  // Get 3 months before, current month, and 2 months after
  const startIdx = Math.max(0, curIdx - 3);
  const endIdx = Math.min(t.length - 1, curIdx + 2);
  const keys = t.slice(startIdx, endIdx + 1);
  
  const labels = keys.map(k => monthShort(k));
  const incomes = [];
  const expenses = [];
  
  for (const k of keys) {
    const tots = monthTotals(k);
    incomes.push(tots.cI);
    expenses.push(tots.cE);
  }

  if (barChartInstance) barChartInstance.destroy();
  
  barChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Income',
          data: incomes,
          backgroundColor: '#34d399', // emerald-400
          borderRadius: 4,
          barPercentage: 0.7
        },
        {
          label: 'Expenses',
          data: expenses,
          backgroundColor: '#f43f5e', // rose-500
          borderRadius: 4,
          barPercentage: 0.7
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'end',
          labels: { usePointStyle: true, boxWidth: 6 }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          titleFont: { size: 11, weight: 'bold' },
          bodyFont: { size: 13, weight: '900' },
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: function(context) { return context.dataset.label + ': ' + peso(context.raw); }
          }
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: { 
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { callback: function(value) { return '₱' + (value / 1000) + 'k'; } }
        }
      }
    }
  });
}
