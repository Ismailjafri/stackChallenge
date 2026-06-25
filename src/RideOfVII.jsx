import { useState, useEffect, useRef, useCallback } from "react";

const W = 800, H = 600;
const GRAVITY = 0.38;
const JUMP = -8.5;
const PI2 = Math.PI * 2;
const rand = (a, b) => Math.random() * (b - a) + a;

const C = {
  bg1: "#0f0e18", bg2: "#1a1520", marble: "#d4cfc9", marbleDk: "#9a9488",
  red: "#c41e1e", redLt: "#e63030", gold: "#d4a843", goldLt: "#f0d060",
  pillar: "#2a2535", pillarLt: "#3a3545", text: "#e8e4dc", dim: "#6a6570",
  wealth: "#d4a843", health: "#40d870", psych: "#a050e0",
};

export default function RideOfVII() {
  const canvasRef = useRef(null);
  const gRef = useRef(null);
  const animRef = useRef(null);
  const [screen, setScreen] = useState("menu");
  const [displayScore, setDisplayScore] = useState(0);
  const [best, setBest] = useState(0);
  const containerRef = useRef(null);
  const scaleRef = useRef(1);

  const init = useCallback(() => {
    gRef.current = {
      player: { y: 250, vy: 0, rot: 0 },
      pillars: [], collectibles: [], particles: [], trails: [],
      speed: 2.4, score: 0, dist: 0,
      pillarTimer: 180, collectTimer: 0, powerTimer: 0,
      groundY: H - 55,
      alive: true, ticks: 0,
      combo: 0, comboTimer: 0,
      sevens: 0, jackpot: false, jackpotTimer: 0,
      bgOffset: 0, mtOffset: 0,
      flash: 0,
      // Power-ups
      wealthActive: false, wealthTimer: 0,  // Luxury: no pillars, 3x score, recline
      healthActive: false, healthTimer: 0,  // Slow motion: 40% speed
      psychActive: false, psychTimer: 0,    // Mind expand: gaps widen 60%
      powerAnnounce: "", powerAnnounceTimer: 0, powerAnnounceColor: "",
      powerCooldown: 0, // No new power for 30-50s after one ends
    };
  }, []);

  const start = useCallback(() => { init(); setScreen("playing"); }, [init]);

  const jump = useCallback(() => {
    const g = gRef.current;
    if (!g || !g.alive) return;
    g.player.vy = JUMP;
    // Trail burst
    for (let i = 0; i < 4; i++) {
      g.particles.push({ x: 150, y: g.player.y + 30, vx: rand(-2, -0.5), vy: rand(-1, 1), life: 1, decay: rand(0.03, 0.06), color: g.jackpot ? C.goldLt : C.redLt, size: rand(2, 4) });
    }
  }, []);

  const handleInput = useCallback((e) => {
    if (e) e.preventDefault();
    if (screen === "playing") jump();
    else start();
  }, [screen, jump, start]);

  useEffect(() => {
    const kd = (e) => { if (e.code === "Space" || e.code === "ArrowUp") { e.preventDefault(); handleInput(); } };
    window.addEventListener("keydown", kd);
    return () => window.removeEventListener("keydown", kd);
  }, [handleInput]);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const md = (e) => { e.preventDefault(); handleInput(); };
    const ts = (e) => { e.preventDefault(); handleInput(); };
    canvas.addEventListener("mousedown", md);
    canvas.addEventListener("touchstart", ts, { passive: false });
    return () => { canvas.removeEventListener("mousedown", md); canvas.removeEventListener("touchstart", ts); };
  }, [handleInput]);

  // Game loop
  useEffect(() => {
    if (screen !== "playing") return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const loop = () => {
      const g = gRef.current;
      if (!g || !g.alive) return;
      g.ticks++;

      const baseSpd = g.speed + g.dist * 0.00015;
      const spdMult = g.healthActive ? 0.4 : 1;
      const spd = baseSpd * spdMult;
      g.dist += spd;
      g.bgOffset += spd;
      g.mtOffset += spd * 0.3;

      // Power-up timers
      if (g.wealthActive) { g.wealthTimer--; if (g.wealthTimer <= 0) { g.wealthActive = false; g.powerCooldown = 1800 + Math.floor(rand(0, 600)); } }
      if (g.healthActive) { g.healthTimer--; if (g.healthTimer <= 0) { g.healthActive = false; g.powerCooldown = 1800 + Math.floor(rand(0, 600)); } }
      if (g.psychActive) { g.psychTimer--; if (g.psychTimer <= 0) { g.psychActive = false; g.powerCooldown = 1800 + Math.floor(rand(0, 600)); } }
      if (g.powerCooldown > 0) g.powerCooldown--;
      if (g.powerAnnounceTimer > 0) g.powerAnnounceTimer--;

      // Physics
      g.player.vy += GRAVITY;
      g.player.y += g.player.vy;
      g.player.rot = g.player.vy * 0.04;

      // Bounds
      if (g.player.y + 28 > g.groundY) { g.player.y = g.groundY - 28; g.player.vy = 0; }
      if (g.player.y < 15) { g.player.y = 15; g.player.vy = 0; }

      // Spawn pillars (skip during LUXURY MODE)
      if (!g.wealthActive) {
        g.pillarTimer += spd;
        const baseGap = g.jackpot ? 195 : Math.max(170, 210 - g.dist * 0.002);
        const gap = g.psychActive ? baseGap * 1.5 : baseGap;
        if (g.pillarTimer > Math.max(150, 240 - g.dist * 0.007)) {
          const minTop = 70;
          const maxTop = g.groundY - gap - 70;
          const topH = minTop + Math.random() * Math.max(10, maxTop - minTop);
          const isGold = Math.random() < 0.12;
          g.pillars.push({ x: W + 40, topH, botY: topH + gap, scored: false, gold: isGold });
          g.pillarTimer = 0;
        }
      }

      // Spawn sevens (common)
      g.collectTimer += spd;
      if (g.collectTimer > 180) {
        const sy = 70 + Math.random() * (g.groundY - 150);
        g.collectibles.push({ x: W + 40, y: sy, type: "seven", bob: rand(0, PI2), collected: false });
        g.collectTimer = 0;
      }

      // Spawn rare power-ups - blocked during active power or cooldown
      const anyPowerActive = g.wealthActive || g.healthActive || g.psychActive;
      if (!anyPowerActive && g.powerCooldown <= 0) {
        g.powerTimer += spd;
        if (g.powerTimer > 1500 + rand(0, 400)) {
          const types = ["wealth", "health", "psych"];
          const type = types[Math.floor(Math.random() * types.length)];
          const lastP = g.pillars[g.pillars.length - 1];
          const py = lastP ? (lastP.topH + lastP.botY) / 2 : H * 0.35 + rand(0, H * 0.15);
          g.collectibles.push({ x: W + 80, y: py, type, bob: rand(0, PI2), collected: false, rare: true });
          g.powerTimer = 0;
        }
      } else {
        g.powerTimer = 0; // Reset timer while blocked
      }

      // Update pillars
      g.pillars = g.pillars.filter(p => {
        p.x -= spd;
        if (!p.scored && p.x + 65 < 150) {
          p.scored = true;
          g.score += g.wealthActive ? 5 : g.jackpot ? 3 : 1;
        }
        // Collision (only Luxury mode skips)
        if (!g.wealthActive) {
          const px = 150, py = g.player.y;
          const hw = 15, hh = 22;
          if (px + hw > p.x && px - hw < p.x + 65 && (py - hh < p.topH || py + hh > p.botY)) {
            g.alive = false;
            for (let i = 0; i < 25; i++) g.particles.push({ x: px, y: py, vx: rand(-5, 5), vy: rand(-5, 5), life: 1, decay: rand(0.02, 0.04), color: C.marble, size: rand(2, 6) });
            for (let i = 0; i < 15; i++) g.particles.push({ x: px, y: py, vx: rand(-4, 4), vy: rand(-4, 4), life: 1, decay: rand(0.02, 0.04), color: C.red, size: rand(2, 5) });
            setDisplayScore(g.score);
            setBest(prev => Math.max(prev, g.score));
            setScreen("dead");
            return false;
          }
        }
        return p.x > -80;
      });

      if (!g.alive) return;

      // Update collectibles
      g.collectibles = g.collectibles.filter(c => {
        c.x -= spd;
        if (c.collected) return false;
        const dx = 150 - c.x, dy = g.player.y - c.y;
        if (Math.sqrt(dx * dx + dy * dy) < 30) {
          c.collected = true;
          if (c.type === "seven") {
            g.sevens++;
            g.combo++; g.comboTimer = 120;
            g.score += 5 * g.combo;
            for (let i = 0; i < 8; i++) g.particles.push({ x: c.x, y: c.y, vx: rand(-3, 3), vy: rand(-3, 3), life: 1, decay: rand(0.02, 0.04), color: C.redLt, size: rand(2, 5) });
            if (g.sevens >= 14 && !g.jackpot) {
              g.jackpot = true; g.jackpotTimer = 480; g.sevens = 0;
              g.score += 77;
              g.flash = 20;
              for (let i = 0; i < 35; i++) g.particles.push({ x: 150 + rand(-80, 80), y: g.player.y + rand(-80, 80), vx: rand(-6, 6), vy: rand(-6, 6), life: 1, decay: rand(0.01, 0.025), color: C.goldLt, size: rand(3, 7) });
            }
          } else {
            const col = { wealth: C.wealth, health: C.health, psych: C.psych }[c.type];
            // Big burst for rare power-ups
            for (let i = 0; i < 20; i++) g.particles.push({ x: c.x, y: c.y, vx: rand(-5, 5), vy: rand(-5, 5), life: 1, decay: rand(0.015, 0.035), color: col, size: rand(3, 6) });
            g.flash = 15;

            if (c.type === "wealth") {
              // LUXURY MODE: no pillars, 5x score, character reclines
              g.wealthActive = true; g.wealthTimer = 720; // 12 seconds
              g.score += 50;
              // Clear existing pillars with gold explosion
              g.pillars.forEach(p => {
                for (let i = 0; i < 6; i++) g.particles.push({ x: p.x + 32, y: rand(50, g.groundY - 50), vx: rand(-2, 2), vy: rand(-2, 2), life: 1, decay: rand(0.02, 0.04), color: C.goldLt, size: rand(3, 6) });
              });
              g.pillars = [];
              g.powerAnnounce = "LUXURY MODE"; g.powerAnnounceTimer = 120; g.powerAnnounceColor = C.goldLt;
            } else if (c.type === "health") {
              // SLOW MOTION: everything slows to 40% for 10s
              g.healthActive = true; g.healthTimer = 600; // 10 seconds
              g.score += 30;
              g.powerAnnounce = "SLOW MOTION"; g.powerAnnounceTimer = 120; g.powerAnnounceColor = C.health;
            } else if (c.type === "psych") {
              // MIND EXPAND: pillar gaps widen 60% for 12s
              g.psychActive = true; g.psychTimer = 720; // 12 seconds
              g.score += 40;
              g.powerAnnounce = "MIND EXPAND"; g.powerAnnounceTimer = 120; g.powerAnnounceColor = C.psych;
            }
          }
          return false;
        }
        return c.x > -40;
      });

      // Combo decay
      if (g.comboTimer > 0) { g.comboTimer--; if (g.comboTimer <= 0) g.combo = 0; }

      // Jackpot timer
      if (g.jackpot) { g.jackpotTimer--; if (g.jackpotTimer <= 0) { g.jackpot = false; g.sevens = 0; } }

      // Trail
      if (g.ticks % 3 === 0) {
        g.trails.push({ x: 130, y: g.player.y + 25 + rand(-5, 5), life: 1, decay: 0.04, size: rand(4, 8) });
      }
      g.trails = g.trails.filter(t => { t.x -= spd * 0.4; t.life -= t.decay; return t.life > 0; });

      // Particles
      g.particles = g.particles.filter(p => { p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.life -= p.decay; return p.life > 0; });

      if (g.flash > 0) g.flash--;

      // ============ RENDER ============
      // Sky
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      if (g.jackpot) { sky.addColorStop(0, "#2a1f0a"); sky.addColorStop(1, "#0f0d05"); }
      else { sky.addColorStop(0, "#0f0e18"); sky.addColorStop(1, C.bg2); }
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

      // Mountains
      ctx.fillStyle = g.jackpot ? "rgba(80,60,20,0.25)" : "rgba(35,30,50,0.35)";
      ctx.beginPath(); ctx.moveTo(0, H);
      for (let i = 0; i <= W; i += 50) { const h = 170 + Math.sin((i + g.mtOffset) * 0.007) * 90 + Math.sin((i + g.mtOffset) * 0.015) * 40; ctx.lineTo(i, H - h); }
      ctx.lineTo(W, H); ctx.fill();

      ctx.fillStyle = g.jackpot ? "rgba(60,45,15,0.18)" : "rgba(25,20,40,0.25)";
      ctx.beginPath(); ctx.moveTo(0, H);
      for (let i = 0; i <= W; i += 70) { const h = 220 + Math.sin((i + g.mtOffset * 0.5) * 0.005) * 110; ctx.lineTo(i, H - h); }
      ctx.lineTo(W, H); ctx.fill();

      // Stars
      for (let i = 0; i < 20; i++) {
        const sx = ((i * 137 + 50 - g.bgOffset * 0.05) % (W + 20) + W + 20) % (W + 20);
        const sy = (i * 73 + 30) % (H * 0.5);
        ctx.fillStyle = g.jackpot ? "rgba(240,208,96,0.15)" : "rgba(200,195,210,0.12)";
        ctx.beginPath(); ctx.arc(sx, sy, 1 + (i % 3) * 0.5, 0, PI2); ctx.fill();
      }

      // Trail particles
      g.trails.forEach(t => {
        ctx.fillStyle = g.jackpot ? `rgba(240,208,96,${t.life * 0.25})` : `rgba(196,30,30,${t.life * 0.18})`;
        ctx.beginPath(); ctx.arc(t.x, t.y, t.size * t.life, 0, PI2); ctx.fill();
      });

      // Ground
      const grd = ctx.createLinearGradient(0, g.groundY, 0, H);
      grd.addColorStop(0, g.jackpot ? "#3a2d10" : "#2a2530");
      grd.addColorStop(1, g.jackpot ? "#1a1508" : "#15121a");
      ctx.fillStyle = grd; ctx.fillRect(0, g.groundY, W, H - g.groundY);
      ctx.strokeStyle = g.jackpot ? C.gold : "rgba(100,90,120,0.4)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, g.groundY); ctx.lineTo(W, g.groundY); ctx.stroke();

      // Ground tiles
      ctx.strokeStyle = g.jackpot ? "rgba(212,168,67,0.08)" : "rgba(100,90,120,0.06)"; ctx.lineWidth = 1;
      for (let i = 0; i < W + 40; i += 40) {
        const tx = ((i - g.bgOffset * 2) % (W + 40) + W + 40) % (W + 40) - 20;
        ctx.beginPath(); ctx.moveTo(tx, g.groundY); ctx.lineTo(tx, H); ctx.stroke();
      }

      // Pillars
      g.pillars.forEach(p => {
        const base = p.gold ? C.gold : C.pillar;
        const light = p.gold ? C.goldLt : C.pillarLt;

        // Top pillar
        const tg = ctx.createLinearGradient(p.x, 0, p.x + 65, 0);
        tg.addColorStop(0, light); tg.addColorStop(0.5, base); tg.addColorStop(1, light);
        ctx.fillStyle = tg; ctx.fillRect(p.x, 0, 65, p.topH);
        ctx.fillStyle = light; ctx.fillRect(p.x - 7, p.topH - 10, 79, 10); ctx.fillRect(p.x - 3, p.topH - 17, 71, 7);
        // Fluting
        ctx.strokeStyle = p.gold ? "rgba(255,240,150,0.1)" : "rgba(255,255,255,0.03)"; ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) { const lx = p.x + 10 + i * 14; ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, p.topH - 17); ctx.stroke(); }

        // Bottom pillar
        const bg = ctx.createLinearGradient(p.x, p.botY, p.x + 65, p.botY);
        bg.addColorStop(0, light); bg.addColorStop(0.5, base); bg.addColorStop(1, light);
        ctx.fillStyle = bg; ctx.fillRect(p.x, p.botY, 65, g.groundY - p.botY);
        ctx.fillStyle = light; ctx.fillRect(p.x - 7, p.botY, 79, 10); ctx.fillRect(p.x - 3, p.botY + 10, 71, 7);
        for (let i = 0; i < 4; i++) { const lx = p.x + 10 + i * 14; ctx.beginPath(); ctx.moveTo(lx, p.botY + 17); ctx.lineTo(lx, g.groundY); ctx.stroke(); }
      });

      // Collectibles
      g.collectibles.forEach(c => {
        if (c.collected) return;
        const by = c.y + Math.sin(c.bob + g.ticks * 0.05) * 7;
        ctx.save(); ctx.translate(c.x, by);
        if (c.type === "seven") {
          ctx.shadowColor = C.redLt; ctx.shadowBlur = 10;
          ctx.fillStyle = C.red; ctx.font = "bold 26px Georgia"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText("7", 0, 0); ctx.shadowBlur = 0;
          ctx.strokeStyle = "rgba(230,48,48,0.25)"; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(0, 0, 16 + Math.sin(g.ticks * 0.08) * 3, 0, PI2); ctx.stroke();
        } else {
          const cm = { wealth: C.wealth, health: C.health, psych: C.psych };
          const lm = { wealth: "$", health: "+", psych: "\u03A8" };
          const nm = { wealth: "LUXURY", health: "SLOW-MO", psych: "EXPAND" };
          const col = cm[c.type];
          // Pulsing outer ring
          const pulse = 0.4 + Math.sin(g.ticks * 0.1) * 0.3;
          ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.globalAlpha = pulse;
          ctx.beginPath(); ctx.arc(0, 0, 22 + Math.sin(g.ticks * 0.06) * 4, 0, PI2); ctx.stroke();
          ctx.globalAlpha = 1;
          // Big glowing orb
          ctx.shadowColor = col; ctx.shadowBlur = 18;
          const og = ctx.createRadialGradient(0, 0, 0, 0, 0, 18);
          og.addColorStop(0, col); og.addColorStop(0.6, col); og.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = og; ctx.beginPath(); ctx.arc(0, 0, 18, 0, PI2); ctx.fill();
          // Inner white core
          ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.beginPath(); ctx.arc(0, 0, 8, 0, PI2); ctx.fill();
          ctx.shadowBlur = 0;
          // Symbol
          ctx.fillStyle = "#fff"; ctx.font = "bold 14px Georgia"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(lm[c.type], 0, 1);
          // Label below
          ctx.fillStyle = col; ctx.font = "bold 8px Georgia";
          ctx.fillText(nm[c.type], 0, 28);
        }
        ctx.restore();
      });

      // Particles
      g.particles.forEach(p => {
        ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, PI2); ctx.fill();
      });
      ctx.globalAlpha = 1;

      // === PLAYER ===
      ctx.save();
      ctx.translate(150, g.player.y);
      ctx.rotate(g.player.rot);
      ctx.scale(0.7, 0.7);
      const isJ = g.jackpot;

      // Giant red 7 (mount)
      ctx.fillStyle = isJ ? C.goldLt : C.red;
      ctx.beginPath(); ctx.moveTo(-25, -15); ctx.lineTo(25, -15); ctx.lineTo(25, -8);
      ctx.lineTo(5, 35); ctx.lineTo(-5, 35); ctx.lineTo(12, -8); ctx.lineTo(-25, -8); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = isJ ? "#fff8d0" : C.redLt; ctx.lineWidth = 1.5; ctx.stroke();
      // Shine
      ctx.fillStyle = isJ ? "rgba(255,255,200,0.25)" : "rgba(255,255,255,0.12)";
      ctx.beginPath(); ctx.moveTo(-22, -13); ctx.lineTo(22, -13); ctx.lineTo(22, -10); ctx.lineTo(-22, -10); ctx.closePath(); ctx.fill();

      // Statue body
      const bGrad = ctx.createLinearGradient(-12, -48, 12, -18);
      bGrad.addColorStop(0, isJ ? C.goldLt : C.marble); bGrad.addColorStop(1, isJ ? C.gold : C.marbleDk);
      ctx.fillStyle = bGrad;
      ctx.beginPath(); ctx.ellipse(0, -30, 13, 17, 0, 0, PI2); ctx.fill();

      // Head
      ctx.fillStyle = isJ ? C.goldLt : C.marble;
      ctx.beginPath(); ctx.arc(0, -50, 11, 0, PI2); ctx.fill();

      // 777 on forehead
      ctx.fillStyle = C.red; ctx.font = "bold 7px sans-serif"; ctx.textAlign = "center";
      ctx.fillText("777", 0, -48);

      // Eyes
      ctx.fillStyle = isJ ? C.goldLt : C.redLt;
      ctx.shadowColor = isJ ? C.goldLt : C.redLt; ctx.shadowBlur = 4;
      ctx.beginPath(); ctx.ellipse(-4, -51, 2, 1.5, 0, 0, PI2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(4, -51, 2, 1.5, 0, 0, PI2); ctx.fill();
      ctx.shadowBlur = 0;

      // Cape
      ctx.fillStyle = isJ ? "rgba(240,208,96,0.35)" : "rgba(196,30,30,0.3)";
      ctx.beginPath(); ctx.moveTo(-5, -38);
      ctx.quadraticCurveTo(-28, -22, -33 + Math.sin(g.ticks * 0.12) * 6, -8);
      ctx.quadraticCurveTo(-22, -18, -8, -23); ctx.closePath(); ctx.fill();

      // Arms with small 7s
      ctx.strokeStyle = isJ ? C.goldLt : C.marble; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-8, -33); ctx.lineTo(-20, -42); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(8, -33); ctx.lineTo(20, -42); ctx.stroke();
      ctx.fillStyle = isJ ? C.goldLt : C.red; ctx.font = "bold 10px sans-serif";
      ctx.fillText("7", -22, -39); ctx.fillText("7", 22, -39);

      // Jackpot glow
      if (isJ) {
        ctx.shadowColor = C.goldLt; ctx.shadowBlur = 20;
        ctx.fillStyle = "rgba(240,208,96,0.08)"; ctx.beginPath(); ctx.arc(0, -28, 35, 0, PI2); ctx.fill();
        ctx.shadowBlur = 0;
      }

      ctx.restore();

      // Flash
      if (g.flash > 0) {
        ctx.fillStyle = g.jackpot ? `rgba(240,208,96,${g.flash * 0.02})` : `rgba(255,255,255,${g.flash * 0.02})`;
        ctx.fillRect(0, 0, W, H);
      }

      // Jackpot border
      if (g.jackpot) {
        const pu = Math.sin(g.ticks * 0.12) * 0.3 + 0.5;
        ctx.strokeStyle = `rgba(240,208,96,${pu * 0.5})`; ctx.lineWidth = 3;
        ctx.strokeRect(2, 2, W - 4, H - 4);
        ctx.fillStyle = `rgba(240,208,96,${pu * 0.12})`; ctx.font = "bold 50px Georgia"; ctx.textAlign = "center";
        ctx.fillText("JACKPOT 777", W / 2, H / 2 - 100);
      }

      // Power-up active effects
      if (g.wealthActive) {
        const pu = Math.sin(g.ticks * 0.08) * 0.15 + 0.2;
        ctx.fillStyle = `rgba(212,168,67,${pu * 0.08})`; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = `rgba(212,168,67,${pu + 0.2})`; ctx.lineWidth = 2;
        ctx.strokeRect(4, 4, W - 8, H - 8);
        // Gold particles rain
        if (g.ticks % 6 === 0) g.particles.push({ x: rand(0, W), y: -5, vx: rand(-0.5, 0.5), vy: rand(1, 3), life: 1, decay: 0.015, color: C.goldLt, size: rand(1.5, 3) });
      }
      if (g.healthActive) {
        const pu = Math.sin(g.ticks * 0.06) * 0.1 + 0.15;
        ctx.fillStyle = `rgba(64,216,112,${pu * 0.06})`; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = `rgba(64,216,112,${pu + 0.15})`; ctx.lineWidth = 2;
        ctx.strokeRect(4, 4, W - 8, H - 8);
      }
      if (g.psychActive) {
        const pu = Math.sin(g.ticks * 0.07) * 0.12 + 0.18;
        ctx.fillStyle = `rgba(160,80,224,${pu * 0.05})`; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = `rgba(160,80,224,${pu + 0.15})`; ctx.lineWidth = 2;
        ctx.strokeRect(4, 4, W - 8, H - 8);
      }

      // Power announcement
      if (g.powerAnnounceTimer > 0) {
        const alpha = g.powerAnnounceTimer > 90 ? Math.min(1, (120 - g.powerAnnounceTimer + 120) / 30) : g.powerAnnounceTimer / 90;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = g.powerAnnounceColor; ctx.font = "bold 36px Georgia"; ctx.textAlign = "center";
        ctx.fillText(g.powerAnnounce, W / 2, H / 2 - 60);
        ctx.globalAlpha = 1;
      }

      // === HUD ===
      ctx.fillStyle = C.text; ctx.font = "bold 28px Georgia"; ctx.textAlign = "left";
      ctx.fillText(g.score, 20, 38);

      if (g.combo > 1) {
        ctx.fillStyle = g.jackpot ? C.goldLt : C.redLt; ctx.font = "bold 16px Georgia";
        ctx.fillText("\xD7" + g.combo + " COMBO", 20, 60);
      }

      // Jackpot meter
      const mX = W - 125, mY = 18, mW = 108, mH = 14;
      ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.fillRect(mX, mY, mW, mH);
      const jFill = g.jackpot ? 1 : g.sevens / 14;
      const mGrad = ctx.createLinearGradient(mX, 0, mX + mW, 0);
      mGrad.addColorStop(0, C.red); mGrad.addColorStop(1, C.goldLt);
      ctx.fillStyle = mGrad; ctx.fillRect(mX, mY, mW * jFill, mH);
      ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.lineWidth = 1; ctx.strokeRect(mX, mY, mW, mH);
      ctx.fillStyle = g.jackpot ? C.goldLt : C.dim; ctx.font = "10px Georgia"; ctx.textAlign = "right";
      ctx.fillText(g.jackpot ? "JACKPOT! " + Math.ceil(g.jackpotTimer / 60) + "s" : "JACKPOT 777  " + g.sevens + "/14", W - 17, 46);

      // Active power-up timers
      let timerY = 62;
      if (g.wealthActive) {
        ctx.fillStyle = C.wealth; ctx.font = "bold 10px Georgia"; ctx.textAlign = "right";
        ctx.fillText("LUXURY " + Math.ceil(g.wealthTimer / 60) + "s", W - 17, timerY); timerY += 14;
      }
      if (g.healthActive) {
        ctx.fillStyle = C.health; ctx.font = "bold 10px Georgia"; ctx.textAlign = "right";
        ctx.fillText("SLOW-MO " + Math.ceil(g.healthTimer / 60) + "s", W - 17, timerY); timerY += 14;
      }
      if (g.psychActive) {
        ctx.fillStyle = C.psych; ctx.font = "bold 10px Georgia"; ctx.textAlign = "right";
        ctx.fillText("EXPAND " + Math.ceil(g.psychTimer / 60) + "s", W - 17, timerY);
      }

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [screen]);

  // Menu / Dead
  useEffect(() => {
    if (screen !== "menu" && screen !== "dead") return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let t = 0;

    const draw = () => {
      t++;
      // BG
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#0f0e18"); sky.addColorStop(1, C.bg2);
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

      // Pillars
      [50, 200, 550, 700].forEach(px => {
        const pg = ctx.createLinearGradient(px, 0, px + 36, 0);
        pg.addColorStop(0, "rgba(58,53,64,0.22)"); pg.addColorStop(0.5, "rgba(42,37,53,0.22)"); pg.addColorStop(1, "rgba(58,53,64,0.22)");
        ctx.fillStyle = pg; ctx.fillRect(px, 0, 36, H);
      });

      // Floating 7s
      for (let i = 0; i < 10; i++) {
        const fx = (80 + i * 75 + t * 0.2) % (W + 30) - 15;
        const fy = 80 + Math.sin(t * 0.015 + i * 1.3) * 60 + i * 35;
        ctx.fillStyle = `rgba(196,30,30,${0.05 + Math.sin(t * 0.025 + i) * 0.03})`;
        ctx.font = "bold 30px Georgia"; ctx.textAlign = "center"; ctx.fillText("7", fx, fy);
      }

      const tY = screen === "dead" ? 150 : 175;

      // Title glow
      ctx.shadowColor = C.red; ctx.shadowBlur = 30;
      ctx.fillStyle = C.red; ctx.font = "bold 72px Georgia"; ctx.textAlign = "center";
      ctx.fillText("777", W / 2, tY); ctx.shadowBlur = 0;

      ctx.fillStyle = C.text; ctx.font = "italic 26px Georgia";
      ctx.fillText("RIDE OF THE VII", W / 2, tY + 42);

      ctx.fillStyle = C.dim; ctx.font = "13px Georgia";
      ctx.fillText("Wealth  \xB7  Health  \xB7  Psychology", W / 2, tY + 72);

      if (screen === "dead") {
        ctx.fillStyle = C.text; ctx.font = "bold 22px Georgia";
        ctx.fillText("SCORE: " + displayScore, W / 2, 320);
        if (best > 0) { ctx.fillStyle = C.gold; ctx.font = "14px Georgia"; ctx.fillText("BEST: " + best, W / 2, 348); }
      }

      // Player preview
      const py = screen === "dead" ? 430 : 400;
      ctx.save(); ctx.translate(W / 2, py); ctx.scale(1.4, 1.4);
      // Red 7
      ctx.fillStyle = C.red;
      ctx.beginPath(); ctx.moveTo(-25, -15); ctx.lineTo(25, -15); ctx.lineTo(25, -8);
      ctx.lineTo(5, 35); ctx.lineTo(-5, 35); ctx.lineTo(12, -8); ctx.lineTo(-25, -8); ctx.closePath(); ctx.fill();
      // Body
      ctx.fillStyle = C.marble; ctx.beginPath(); ctx.ellipse(0, -30, 13, 17, 0, 0, PI2); ctx.fill();
      ctx.beginPath(); ctx.arc(0, -50, 11, 0, PI2); ctx.fill();
      ctx.fillStyle = C.red; ctx.font = "bold 7px sans-serif"; ctx.textAlign = "center"; ctx.fillText("777", 0, -48);
      // Eyes
      ctx.fillStyle = C.redLt; ctx.shadowColor = C.redLt; ctx.shadowBlur = 4;
      ctx.beginPath(); ctx.ellipse(-4, -51, 2, 1.5, 0, 0, PI2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(4, -51, 2, 1.5, 0, 0, PI2); ctx.fill();
      ctx.shadowBlur = 0;
      // Cape hint
      ctx.fillStyle = "rgba(196,30,30,0.25)"; ctx.beginPath();
      ctx.moveTo(-5, -38); ctx.quadraticCurveTo(-25, -20, -30 + Math.sin(t * 0.05) * 4, -5);
      ctx.quadraticCurveTo(-18, -15, -8, -23); ctx.closePath(); ctx.fill();
      ctx.restore();

      // CTA
      const pulse = Math.sin(t * 0.06) * 0.3 + 0.7;
      ctx.fillStyle = `rgba(232,228,220,${pulse})`; ctx.font = "14px Georgia"; ctx.textAlign = "center";
      ctx.fillText(screen === "dead" ? "TAP OR PRESS SPACE TO RETRY" : "TAP OR PRESS SPACE TO START", W / 2, H - 45);
      ctx.fillStyle = C.dim; ctx.font = "11px Georgia";
      ctx.fillText("Tap / Click / Space to jump  \xB7  Dodge pillars  \xB7  Collect 7s", W / 2, H - 22);
    };

    draw();
    const iv = setInterval(draw, 33);
    return () => clearInterval(iv);
  }, [screen, displayScore, best]);

  // Resize
  useEffect(() => {
    const resize = () => {
      if (!containerRef.current || !canvasRef.current) return;
      const s = Math.min(1, (containerRef.current.clientWidth - 16) / W, (window.innerHeight - 50) / H);
      scaleRef.current = s; canvasRef.current.style.width = W * s + "px"; canvasRef.current.style.height = H * s + "px";
    };
    resize(); window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  return (
    <div ref={containerRef} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: C.bg1, fontFamily: "Georgia, serif", userSelect: "none" }}>
      <canvas ref={canvasRef} width={W} height={H} style={{ border: "1px solid rgba(100,90,120,0.2)", borderRadius: 4, cursor: "pointer", touchAction: "none" }} />
      <div style={{ marginTop: 12, display: "flex", gap: 24, color: C.dim, fontSize: 11, flexWrap: "wrap", justifyContent: "center" }}>
        <span><span style={{ color: C.red }}>7</span> = pts \xD7 combo</span>
        <span><span style={{ color: C.wealth }}>$</span> Luxury</span>
        <span><span style={{ color: C.health }}>+</span> Slow-Mo</span>
        <span><span style={{ color: C.psych }}>{"\u03A8"}</span> Expand</span>
        <span><span style={{ color: C.goldLt }}>7/7</span> JACKPOT</span>
      </div>
    </div>
  );
}