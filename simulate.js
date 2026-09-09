// Headless simulator that mirrors the in-browser physics from index.html.
// Usage:
//   node simulate.js [rounds] [pegInc] [bumperInc] [slingInc] [jackpotMult]

const W = 380, H = 560;

const slots = [
  { type: 'bust',    mult: 0,  w: 2.5 },
  { type: 'collect', mult: 1,  w: 2.0 },
  { type: 'jackpot', mult: 10, w: 1.0 },
  { type: 'collect', mult: 1,  w: 2.0 },
  { type: 'bust',    mult: 0,  w: 2.5 },
];
const TOTAL_W = slots.reduce((s, x) => s + x.w, 0);
{
  let acc = 0;
  for (const s of slots) {
    s.x1 = (acc / TOTAL_W) * W;
    acc += s.w;
    s.x2 = (acc / TOTAL_W) * W;
  }
}

const pegs = [];
function P(x, y, r, bumper) { pegs.push({ x, y, r, bumper, cd: 0 }); }
P(95, 100, 15, true);
P(190, 60,  15, true);
P(285, 100, 15, true);
P(190, 260, 16, true);
const smallPegs = [
  [55, 160], [140, 160], [240, 160], [325, 160],
  [95, 145], [190, 130], [285, 145],
  [70, 210], [120, 230], [260, 230], [310, 210],
  [50, 290], [95, 250], [285, 250], [330, 290],
  [140, 300], [240, 300], [95, 340], [285, 340],
  [70, 350], [140, 370], [240, 370], [310, 350],
  [190, 395],
  [40, 420], [90, 420], [140, 420], [190, 420], [240, 420], [290, 420], [340, 420],
  [65, 450], [115, 450], [165, 450], [215, 450], [265, 450], [315, 450],
  [40, 480], [90, 480], [140, 480], [190, 480], [240, 480], [290, 480], [340, 480],
];
for (const [x, y] of smallPegs) P(x, y, 5, false);

const slings = [
  { ax: 18, ay: 395, bx: 18, by: 320, cx: 105, cy: 395,
    x1: 18, y1: 320, x2: 105, y2: 395,
    nx: 0.694, ny: -0.720, cd: 0 },
  { ax: W-18, ay: 395, bx: W-18, by: 320, cx: W-105, cy: 395,
    x1: W-18, y1: 320, x2: W-105, y2: 395,
    nx: -0.694, ny: -0.720, cd: 0 },
];

const dividers = [];
for (let i = 1; i < slots.length; i++) {
  dividers.push({ x: slots[i].x1, y1: H - 78, y2: H - 12 });
}

const params = {
  pegInc: 0.045,
  bumperInc: 0.22,
  slingInc: 0.12,
  jackpotMult: 10,
};

function simulateOne() {
  for (const p of pegs)   p.cd = 0;
  for (const s of slings) s.cd = 0;

  const ball = {
    x: W/2 + (Math.random() - 0.5) * 60,
    y: 22,
    vx: (Math.random() - 0.5) * 4,
    vy: 1.5 + Math.random() * 1.5,
    r: 8,
  };
  let multi = 0;

  const maxFrames = 3000;
  for (let f = 0; f < maxFrames; f++) {
    for (let step = 0; step < 4; step++) {
      ball.vy += 0.09;
      ball.vx *= 0.9994;
      ball.x += ball.vx / 4;
      ball.y += ball.vy / 4;

      if (ball.x < ball.r + 4)     { ball.x = ball.r + 4;     ball.vx = -ball.vx * 0.92; }
      if (ball.x > W - ball.r - 4) { ball.x = W - ball.r - 4; ball.vx = -ball.vx * 0.92; }
      if (ball.y < ball.r + 4)     { ball.y = ball.r + 4;     ball.vy = Math.abs(ball.vy) * 0.7; }

      for (const p of pegs) {
        if (p.cd > 0) continue;
        const dx = ball.x - p.x;
        const dy = ball.y - p.y;
        const dist = Math.hypot(dx, dy) || 0.0001;
        const minDist = ball.r + p.r;
        if (dist < minDist) {
          const nx = dx / dist, ny = dy / dist;
          ball.x = p.x + nx * (minDist + 0.6);
          ball.y = p.y + ny * (minDist + 0.6);
          const dot = ball.vx * nx + ball.vy * ny;
          if (dot < 0) {
            const rest = p.bumper ? 1.24 : 0.93;
            ball.vx = (ball.vx - 2 * dot * nx) * rest;
            ball.vy = (ball.vy - 2 * dot * ny) * rest;
            if (p.bumper) { ball.vx += nx * 2.6; ball.vy += ny * 2.6; }
          }
          ball.vx += (Math.random() - 0.5) * 0.5;
          const sp = Math.hypot(ball.vx, ball.vy);
          const maxSp = p.bumper ? 13 : 11;
          if (sp > maxSp) { ball.vx = ball.vx / sp * maxSp; ball.vy = ball.vy / sp * maxSp; }
          p.cd = p.bumper ? 18 : 10;
          multi += p.bumper ? params.bumperInc : params.pegInc;
        }
      }

      for (const sling of slings) {
        if (sling.cd > 0) continue;
        const sdx = sling.x2 - sling.x1, sdy = sling.y2 - sling.y1;
        const lenSq = sdx * sdx + sdy * sdy;
        const t = Math.max(0, Math.min(1,
          ((ball.x - sling.x1) * sdx + (ball.y - sling.y1) * sdy) / lenSq));
        const px = sling.x1 + t * sdx;
        const py = sling.y1 + t * sdy;
        const distX = ball.x - px, distY = ball.y - py;
        const dist = Math.hypot(distX, distY) || 0.0001;
        if (dist < ball.r + 3) {
          const side = distX * sling.nx + distY * sling.ny;
          if (side < 0) continue;
          ball.x = px + sling.nx * (ball.r + 5);
          ball.y = py + sling.ny * (ball.r + 5);
          const dot = ball.vx * sling.nx + ball.vy * sling.ny;
          if (dot < 0) {
            const r = 1.22;
            ball.vx = (ball.vx - 2 * dot * sling.nx) * r;
            ball.vy = (ball.vy - 2 * dot * sling.ny) * r;
          }
          ball.vx += sling.nx * 3.6;
          ball.vy += sling.ny * 3.6;
          const sp = Math.hypot(ball.vx, ball.vy);
          if (sp > 13) { ball.vx = ball.vx / sp * 13; ball.vy = ball.vy / sp * 13; }
          sling.cd = 14;
          multi += params.slingInc;
        }
      }

      for (const d of dividers) {
        if (ball.y + ball.r > d.y1 && ball.y - ball.r < d.y2) {
          const dx = ball.x - d.x;
          if (Math.abs(dx) < ball.r) {
            ball.x = d.x + Math.sign(dx || 1) * ball.r;
            ball.vx = -ball.vx * 0.5;
          }
        }
      }

      if (ball.y > H - 20) {
        let idx = slots.findIndex(s => ball.x < s.x2);
        if (idx < 0) idx = slots.length - 1;
        return { multi, slotIdx: idx, frames: f };
      }
    }
    for (const p of pegs)   if (p.cd > 0) p.cd--;
    for (const s of slings) if (s.cd > 0) s.cd--;
  }
  return { multi, slotIdx: 0, frames: maxFrames, timeout: true };
}

function slotFactor(slotIdx) {
  const s = slots[slotIdx];
  return s.type === 'jackpot' ? params.jackpotMult : s.mult;
}

function runSim(n) {
  const slotHits = new Array(slots.length).fill(0);
  const multiSumByslot = new Array(slots.length).fill(0);
  const bet = 1;
  let totalWagered = 0, totalReturned = 0;
  let bust = 0, win = 0, jackpot = 0;
  let timeouts = 0;
  const multiSamples = [];
  const topPayouts = []; // { payout, multi, slotIdx }

  for (let i = 0; i < n; i++) {
    const { multi, slotIdx, timeout } = simulateOne();
    if (timeout) timeouts++;
    const factor = slotFactor(slotIdx);
    const payout = bet * multi * factor;
    totalWagered += bet;
    totalReturned += payout;
    slotHits[slotIdx]++;
    multiSumByslot[slotIdx] += multi;
    multiSamples.push(multi);
    if (topPayouts.length < 10 || payout > topPayouts[topPayouts.length - 1].payout) {
      topPayouts.push({ payout, multi, slotIdx });
      topPayouts.sort((a,b) => b.payout - a.payout);
      if (topPayouts.length > 10) topPayouts.pop();
    }
    const t = slots[slotIdx].type;
    if (t === 'bust') bust++;
    else if (t === 'jackpot') jackpot++;
    else win++;
  }
  multiSamples.sort((a,b) => a-b);
  return {
    n,
    rtp: totalReturned / totalWagered,
    slotHits,
    slotAvgMulti: multiSumByslot.map((s, i) => slotHits[i] > 0 ? s / slotHits[i] : 0),
    avgMulti: multiSamples.reduce((a,b)=>a+b,0) / n,
    medianMulti: multiSamples[Math.floor(n/2)],
    p10Multi: multiSamples[Math.floor(n*0.1)],
    p90Multi: multiSamples[Math.floor(n*0.9)],
    p99Multi: multiSamples[Math.floor(n*0.99)],
    maxMulti: multiSamples[multiSamples.length - 1],
    topPayouts,
    bust, win, jackpot,
    timeouts,
  };
}

const args = process.argv.slice(2);
const n = parseInt(args[0]) || 10000;
if (args[1]) params.pegInc = parseFloat(args[1]);
if (args[2]) params.bumperInc = parseFloat(args[2]);
if (args[3]) params.slingInc = parseFloat(args[3]);
if (args[4]) params.jackpotMult = parseFloat(args[4]);

const r = runSim(n);
console.log(`\n=== ${n} rounds ===`);
console.log(`Params: peg=${params.pegInc}, bumper=${params.bumperInc}, sling=${params.slingInc}, jackpotMult=${params.jackpotMult}`);
console.log(`\nRTP: ${(r.rtp * 100).toFixed(2)}%`);
console.log(`\nMulti stats: avg ${r.avgMulti.toFixed(3)}, median ${r.medianMulti.toFixed(3)}, p10 ${r.p10Multi.toFixed(3)}, p90 ${r.p90Multi.toFixed(3)}, p99 ${r.p99Multi.toFixed(3)}, max ${r.maxMulti.toFixed(3)}`);
console.log(`\nTop 10 payouts (bet=1):`);
for (const t of r.topPayouts) {
  console.log(`  ${t.payout.toFixed(2)}× (multi ${t.multi.toFixed(3)} × ${slotFactor(t.slotIdx)} = ${slots[t.slotIdx].type})`);
}
console.log(`\nSlot distribution:`);
for (let i = 0; i < slots.length; i++) {
  const pct = (r.slotHits[i] / n * 100).toFixed(1);
  console.log(`  slot ${i} ${slots[i].type.padEnd(8)} x${slots[i].mult.toString().padStart(2)}: ${r.slotHits[i].toString().padStart(5)} hits (${pct}%), avg multi ${r.slotAvgMulti[i].toFixed(3)}`);
}
console.log(`\nOutcome buckets:`);
console.log(`  bust:    ${r.bust.toString().padStart(5)} (${(r.bust/n*100).toFixed(1)}%)`);
console.log(`  win  :   ${r.win.toString().padStart(5)} (${(r.win/n*100).toFixed(1)}%)`);
console.log(`  jackpot: ${r.jackpot.toString().padStart(5)} (${(r.jackpot/n*100).toFixed(1)}%)`);
if (r.timeouts) console.log(`\nTimeouts (stuck ball, no slot landed): ${r.timeouts}`);
