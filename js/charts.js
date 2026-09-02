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

let projectionChartInstances = [];

export function renderProjectionChart() {
  if (!window.Chart) return;
  const canvases = document.querySelectorAll('.projection-chart-canvas, #projectionChart');
  if (!canvases.length) return;
  
  const keys = timeline();
  let bal = accountsTotal();
  const series = keys.map((k) => { const t = monthTotals(k); bal += t.netPending; return { k, bal, savings: t.savings }; });
  
  const years = {};
  series.forEach((s) => { 
    const y = keyParts(s.k).y; 
    years[y] = years[y] || { savings: 0, endBal: s.bal }; 
    years[y].savings += s.savings; 
    years[y].endBal = s.bal; 
  });
  
  const labels = Object.keys(years);
  const endBals = labels.map(y => years[y].endBal);
  const savings = labels.map(y => years[y].savings);
  
  projectionChartInstances.forEach(inst => {
    try { inst.destroy(); } catch (e) {}
  });
  projectionChartInstances = [];
  
  canvases.forEach(ctx => {
    try {
      const inst = new Chart(ctx, {
        data: {
          labels: labels,
          datasets: [
            {
              type: 'line',
              label: 'End Balance',
              data: endBals,
              borderColor: '#8b5cf6', // violet-500
              backgroundColor: '#8b5cf6',
              borderWidth: 2,
              tension: 0.3,
              pointRadius: 3,
            },
            {
              type: 'bar',
              label: 'Yearly Savings',
              data: savings,
              backgroundColor: savings.map(s => s >= 0 ? '#34d399' : '#f43f5e'), // emerald-400 or rose-500
              borderRadius: 4,
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
              labels: { usePointStyle: true, boxWidth: 6 }
            },
            tooltip: {
              backgroundColor: 'rgba(15, 23, 42, 0.9)',
              titleFont: { size: 11, weight: 'bold' },
              bodyFont: { size: 13, weight: '900' },
              padding: 10,
              cornerRadius: 8,
              callbacks: {
                label: function(context) {
                  let label = context.dataset.label || '';
                  if (label) { label += ': '; }
                  if (context.parsed.y !== null) {
                    label += peso(context.parsed.y);
                  }
                  return label;
                }
              }
            }
          },
          scales: {
            x: { grid: { display: false, color: '#334155' }, ticks: { font: { size: 10 } } },
            y: { 
              grid: { color: '#334155', borderDash: [4, 4] }, 
              border: { display: false }, 
              ticks: { 
                font: { size: 10 }, 
                callback: function(value) { return '₱' + (value / 1000) + 'k'; } 
              } 
            }
          }
        }
      });
      projectionChartInstances.push(inst);
    } catch (err) {
      console.warn("Projection chart mount error:", err);
    }
  });
}
