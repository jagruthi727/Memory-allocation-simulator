const COLORS = ['#2657A6', '#3E8E7E', '#8B5FBF', '#C97A2B', '#4C6EF5', '#2F9E8F', '#B23A48', '#7C5CBF', '#3F7FBF', '#A06A2E'];
const ALGOS = [
  { key: 'first', label: 'First Fit' },
  { key: 'best',  label: 'Best Fit' },
  { key: 'worst', label: 'Worst Fit' },
  { key: 'next',  label: 'Next Fit' },
];

function parseList(str) {
  const parts = str.split(/[,\s]+/).filter(s => s.length);
  const nums = parts.map(s => Number(s));
  if (!nums.length || nums.some(n => !Number.isInteger(n) || n <= 0)) return null;
  return nums;
}

// Same logic as the Java program: blocks keep a running "remaining" capacity.
function simulate(blocks, processes, algo) {
  const remaining = blocks.slice();
  const allocation = new Array(processes.length).fill(-1);
  let lastPosition = 0;

  processes.forEach((p, i) => {
    if (algo === 'first') {
      for (let j = 0; j < remaining.length; j++) {
        if (remaining[j] >= p) { allocation[i] = j; remaining[j] -= p; break; }
      }
    } else if (algo === 'best' || algo === 'worst') {
      let pick = -1;
      for (let j = 0; j < remaining.length; j++) {
        if (remaining[j] < p) continue;
        if (pick === -1 ||
            (algo === 'best' && remaining[j] < remaining[pick]) ||
            (algo === 'worst' && remaining[j] > remaining[pick])) pick = j;
      }
      if (pick !== -1) { allocation[i] = pick; remaining[pick] -= p; }
    } else if (algo === 'next') {
      let count = 0, j = lastPosition;
      while (count < remaining.length) {
        if (remaining[j] >= p) { allocation[i] = j; remaining[j] -= p; lastPosition = j; break; }
        j = (j + 1) % remaining.length;
        count++;
      }
    }
  });

  const totalMemory = blocks.reduce((a, b) => a + b, 0);
  let allocatedMemory = 0, allocatedCount = 0;
  processes.forEach((p, i) => { if (allocation[i] !== -1) { allocatedMemory += p; allocatedCount++; } });
  const freeMemory = remaining.reduce((a, b) => a + b, 0);

  const occupants = blocks.map(() => []);
  processes.forEach((p, i) => { if (allocation[i] !== -1) occupants[allocation[i]].push({ idx: i, size: p }); });

  return {
    blocks, processes, remaining, allocation, occupants,
    totalMemory, allocatedMemory, allocatedCount,
    failedCount: processes.length - allocatedCount,
    freeMemory,
    utilization: totalMemory ? (allocatedMemory / totalMemory) * 100 : 0,
  };
}

function barHTML(run) {
  let segs = '', labels = '';
  run.blocks.forEach((size, j) => {
    const w = (size / run.totalMemory) * 100;
    let inner = '';
    run.occupants[j].forEach(o => {
      inner += `<div class="occ-seg" style="width:${(o.size / size) * 100}%;background:${COLORS[o.idx % COLORS.length]}" title="P${o.idx + 1} — ${o.size} in Block ${j + 1}">${o.size}</div>`;
    });
    const free = run.remaining[j];
    if (free > 0) {
      const fw = (free / size) * 100;
      inner += `<div class="occ-seg free" style="width:${fw}%" title="${free} free in Block ${j + 1}">${fw > 22 ? free : ''}</div>`;
    }
    segs += `<div class="block-seg" style="width:${w}%">${inner}</div>`;
    labels += `<span style="width:${w}%" title="Block ${j + 1} (${size})">B${j + 1}</span>`;
  });
  return `<div class="bar-outer">${segs}</div><div class="bar-labels">${labels}</div>`;
}

function tableHTML(run) {
  const rows = run.processes.map((p, i) => {
    const dot = `<span class="dot" style="background:${COLORS[i % COLORS.length]}"></span>`;
    if (run.allocation[i] !== -1) {
      const b = run.allocation[i];
      return `<tr><td>${dot}P${i + 1}</td><td class="num">${p}</td><td class="ok">Block ${b + 1}</td><td class="num">${run.remaining[b]}</td></tr>`;
    }
    return `<tr><td>${dot}P${i + 1}</td><td class="num">${p}</td><td class="no">Not Allocated</td><td class="num">-</td></tr>`;
  }).join('');
  return `<div class="table-scroll"><table>
    <thead><tr><th>Process</th><th>Size</th><th>Allocated Block</th><th>Remaining</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

function statsHTML(run) {
  const items = [
    ['Total memory', run.totalMemory],
    ['Allocated memory', run.allocatedMemory],
    ['Free memory', run.freeMemory],
    ['Processes allocated', run.allocatedCount],
    ['Processes failed', run.failedCount],
    ['Utilization', run.utilization.toFixed(2) + '%', true],
  ];
  return `<div class="stats">${items.map(([k, v, hl]) =>
    `<div class="stat${hl ? ' hl' : ''}"><div class="k">${k}</div><div class="v">${v}</div></div>`).join('')}</div>`;
}

function render(runs, blocks, processes) {
  const bestUtil = Math.max(...ALGOS.map(a => runs[a.key].utilization));
  const bestKeys = ALGOS.filter(a => Math.abs(runs[a.key].utilization - bestUtil) < 1e-9).map(a => a.key);
  const allSame = bestKeys.length === ALGOS.length;

  document.getElementById('cards').innerHTML = ALGOS.map(a => {
    const r = runs[a.key];
    const isBest = !allSame && bestKeys.includes(a.key);
    return `<div class="panel card">
      <div class="card-head"><h2>${a.label}</h2><span class="badge${isBest ? ' show' : ''}">highest utilization</span></div>
      ${barHTML(r)}${tableHTML(r)}${statsHTML(r)}
    </div>`;
  }).join('');

  document.querySelector('#compareTable tbody').innerHTML = ALGOS.map(a => {
    const r = runs[a.key];
    const isBest = !allSame && bestKeys.includes(a.key);
    return `<tr class="${isBest ? 'best' : ''}"><td>${a.label}</td><td class="num">${r.allocatedCount}</td><td class="num">${r.failedCount}</td>
      <td class="num">${r.allocatedMemory}</td><td class="num">${r.freeMemory}</td><td class="num">${r.utilization.toFixed(2)}%</td></tr>`;
  }).join('');

  const total = blocks.reduce((a, b) => a + b, 0);
  document.getElementById('summaryLine').textContent =
    `${blocks.length} blocks (total ${total})  ·  ${processes.length} processes (total ${processes.reduce((a, b) => a + b, 0)})`;
}

function run() {
  const blocks = parseList(document.getElementById('blocksInput').value);
  const processes = parseList(document.getElementById('procInput').value);
  document.getElementById('blocksErr').style.display = blocks ? 'none' : 'block';
  document.getElementById('procErr').style.display = processes ? 'none' : 'block';
  if (!blocks || !processes) return;
  const runs = {};
  ALGOS.forEach(a => { runs[a.key] = simulate(blocks, processes, a.key); });
  render(runs, blocks, processes);
}

document.getElementById('runBtn').addEventListener('click', run);
document.getElementById('resetBtn').addEventListener('click', () => {
  document.getElementById('blocksInput').value = '100, 500, 200, 300, 600';
  document.getElementById('procInput').value = '212, 417, 112, 426';
  run();
});
['blocksInput', 'procInput'].forEach(id =>
  document.getElementById(id).addEventListener('keydown', e => { if (e.key === 'Enter') run(); }));

run();
