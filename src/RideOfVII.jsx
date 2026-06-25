import { useState, useEffect, useRef, useCallback } from "react";

const W = 800, H = 600;
const GRAVITY = 0.55;
const JUMP = -11;
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
      speed: 3.2, score: 0, dist: 0,
      pillarTimer: 0, collectTimer: 0,
      groundY: H - 55,
      alive: true, ticks: 0,
      combo: 0, comboTimer: 0,
      sevens: 0, jackpot: false, jackpotTimer: 0,
      bgOffset: 0, mtOffset: 0,
      flash: 0,
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

      const spd = g.speed + g.dist * 0.00025;
      g.dist += spd;
      g.bgOffset += spd;
      g.mtOffset += spd * 0.3;

      // Physics
      g.player.vy += GRAVITY;
      g.player.y += g.player.vy;
      g.player.rot = g.player.vy * 0.04;

      // Bounds
      if (g.player.y + 40 > g.groundY) { g.player.y = g.groundY - 40; g.player.vy = 0; }
      if (g.player.y < 15) { g.player.y = 15; g.player.vy = 0; }

      // Spawn pillars
      g.pillarTimer += spd;
      const gap = g.jackpot ? 200 : Math.max(155, 190 - g.dist * 0.003);
      if (g.pillarTimer > Math.max(160, 260 - g.dist * 0.008)) {
        const minTop = 70;
        const maxTop = g.groundY - gap - 70;
        const topH = minTop + Math.random() * (maxTop - minTop);
        const isGold = Math.random() < 0.12;
        g.pillars.push({ x: W + 40, topH, botY: topH + gap, scored: false, gold: isGold });
        g.pillarTimer = 0;
      }

      // Spawn collectibles
      g.collectTimer += spd;
      if (g.collectTimer > 100) {
        const types = ["seven", "seven", "seven", "wealth", "health", "psych"];
        const type = types[Math.floor(Math.random() * types.length)];
        g.collectibles.push({ x: W + 40, y: 80 + Math.random() * (g.groundY - 180), type, bob: rand(0, PI2), collected: false });
        g.collectTimer = 0;
      }

      // Update pillars
      g.pillars = g.pillars.filter(p => {
        p.x -= spd;
        if (!p.scored && p.x + 65 < 150) {
          p.scored = true;
          g.score += g.jackpot ? 3 : 1;
        }
        // Collision (not during jackpot)
        if (!g.jackpot) {
          const px = 150, py = g.player.y;
          const hw = 22, hh = 32;
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
            if (g.sevens >= 7 && !g.jackpot) {
              g.jackpot = true; g.jackpotTimer = 480; g.sevens = 0;
              g.score += 77;
              g.flash = 20;
              for (let i = 0; i < 35; i++) g.particles.push({ x: 150 + rand(-80, 80), y: g.player.y + rand(-80, 80), vx: rand(-6, 6), vy: rand(-6, 6), life: 1, decay: rand(0.01, 0.025), color: C.goldLt, size: rand(3, 7) });
            }
          } else {
            const bonus = { wealth: 15, health: 10, psych: 20 }[c.type];
            g.score += bonus * (g.jackpot ? 3 : 1);
            const col = { wealth: C.wealth, health: C.health, psych: C.psych }[c.type];
            for (let i = 0; i < 6; i++) g.particles.push({ x: c.x, y: c.y, vx: rand(-3, 3), vy: rand(-3, 3), life: 1, decay: rand(0.02, 0.04), color: col, size: rand(2, 4) });
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
          const lm = { wealth: "W", health: "H", psych: "P" };
          const col = cm[c.type];
          ctx.shadowColor = col; ctx.shadowBlur = 8;
          const og = ctx.createRadialGradient(0, 0, 0, 0, 0, 12);
          og.addColorStop(0, col); og.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = og; ctx.beginPath(); ctx.arc(0, 0, 12, 0, PI2); ctx.fill(); ctx.shadowBlur = 0;
          ctx.fillStyle = "#fff"; ctx.font = "bold 12px Georgia"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(lm[c.type], 0, 0);
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
      const jFill = g.jackpot ? 1 : g.sevens / 7;
      const mGrad = ctx.createLinearGradient(mX, 0, mX + mW, 0);
      mGrad.addColorStop(0, C.red); mGrad.addColorStop(1, C.goldLt);
      ctx.fillStyle = mGrad; ctx.fillRect(mX, mY, mW * jFill, mH);
      ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.lineWidth = 1; ctx.strokeRect(mX, mY, mW, mH);
      ctx.fillStyle = g.jackpot ? C.goldLt : C.dim; ctx.font = "10px Georgia"; ctx.textAlign = "right";
      ctx.fillText(g.jackpot ? "JACKPOT! " + Math.ceil(g.jackpotTimer / 60) + "s" : "JACKPOT 777  " + g.sevens + "/7", W - 17, 46);

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
        <span><span style={{ color: C.red }}>7</span> = +5 pts \xD7 combo</span>
        <span><span style={{ color: C.wealth }}>W</span> +15  <span style={{ color: C.health }}>H</span> +10  <span style={{ color: C.psych }}>P</span> +20</span>
        <span><span style={{ color: C.goldLt }}>7/7</span> = JACKPOT</span>
      </div>
    </div>
  );
}
