import { useState, useEffect, useRef, useCallback } from "react";

const W = 800, H = 600, CX = W / 2, CY = H / 2 + 40, PI2 = Math.PI * 2;
const C = {
  bg: "#07060c", marble: "#cdc8c0", marbleLt: "#e0dcd6", marbleDk: "#8a8478",
  red: "#c41e1e", redLt: "#e63946", gold: "#d4a843", goldLt: "#f0d060",
  enemyEye: "#ff3040", text: "#e8e4dc", dim: "#5a5068",
  wealth: "#d4a843", health: "#40d870", psych: "#a050e0",
  butcher: "#8a1515", butcherLt: "#cc2020",
};
const dist = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
const ang = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
const rand = (a, b) => Math.random() * (b - a) + a;
const lerp = (a, b, t) => a + (b - a) * t;

// Evolution stages
const EVOLUTIONS = [
  { name: "MARBLE", wave: 0, color: C.marble, beamColor: "#ff5040", crownColor: null, wings: false, auraRadius: 0, beamBonus: 0, hpBonus: 0, desc: "" },
  { name: "AWAKENED", wave: 3, color: "#d8d4cc", beamColor: "#ff4030", crownColor: null, wings: false, auraRadius: 0, beamBonus: 0.5, hpBonus: 2, desc: "Eyes burn brighter \u2022 Beam strengthened" },
  { name: "CROWNED", wave: 6, color: "#e0d8c8", beamColor: "#ff6020", crownColor: C.gold, wings: false, auraRadius: 60, beamBonus: 1, hpBonus: 2, desc: "Crown of judgment \u2022 Damage aura" },
  { name: "WINGED", wave: 10, color: "#e8e0d0", beamColor: "#ff8030", crownColor: C.goldLt, wings: true, auraRadius: 90, beamBonus: 1.5, hpBonus: 3, desc: "Wings of dominion \u2022 Rear guard beam" },
  { name: "DIVINE", wave: 15, color: "#fff8e0", beamColor: "#ffc040", crownColor: "#fff0a0", wings: true, auraRadius: 120, beamBonus: 3, hpBonus: 4, desc: "Transcendence \u2022 Ultimate power" },
];

const WAVE_EVENTS = {
  2: { msg: "SWIFT SHADOWS APPEAR", type: "swift" },
  3: { msg: null, type: "evolve" },
  4: { msg: "BRUTES APPROACH", type: "brute" },
  5: { msg: "THE BUTCHER AWAKENS", type: "butcher" },
  6: { msg: null, type: "evolve" },
  7: { msg: "SHIELDED ONES ARRIVE", type: "shield" },
  9: { msg: "THE BUTCHER RETURNS", type: "butcher2" },
  10: { msg: null, type: "evolve" },
  12: { msg: "SHADOW SWARM", type: "swarm" },
  13: { msg: "BUTCHER WARLORD", type: "butcher3" },
  15: { msg: null, type: "evolve" },
  17: { msg: "BUTCHER OVERLORD", type: "butcher4" },
  20: { msg: "THE ENDLESS NIGHT", type: "chaos" },
};

export default function ReignOfVII() {
  const canvasRef = useRef(null);
  const gRef = useRef(null);
  const animRef = useRef(null);
  const mouseRef = useRef({ x: CX, y: 0, down: false });
  const [screen, setScreen] = useState("menu");
  const [finalStats, setFinalStats] = useState({});
  const [bestScore, setBestScore] = useState(0);
  const containerRef = useRef(null);
  const scaleRef = useRef(1);

  const initGame = useCallback(() => {
    gRef.current = {
      entities: [], particles: [], dmgNums: [], announcements: [],
      score: 0, kills: 0, saved: 0, betrayed: 0,
      hp: 8, maxHp: 8,
      power: 0, powerW: 0, powerH: 0, powerP: 0,
      combo: 0, maxCombo: 0, comboTimer: 0,
      wave: 1, waveTimer: 0, spawnTimer: 0,
      ticks: 0, time: 0, alive: true,
      firing: false, aimAngle: -Math.PI / 2,
      laserIntensity: 0, eyeGlow: 0, pulsePhase: 0,
      ascension: false, ascensionTimer: 0,
      screenShake: 0, screenFlash: 0, flashColor: "",
      beamWidth: 16, beamDmg: 2, magnetism: 1,
      evoStage: 0, evoAnimTimer: 0,
      unlockedSwift: false, unlockedBrute: false, unlockedShield: false,
      butcherLevel: 0, chaosMode: false, butcherActive: false,
      rearBeam: false, auraRadius: 0, auraDmg: 0,
      wingPhase: 0,
    };
  }, []);

  const addP = useCallback((x, y, color, n, spd = 4, sz = [2, 5]) => {
    const g = gRef.current; if (!g) return;
    for (let i = 0; i < n; i++) {
      const a = rand(0, PI2), v = rand(0.5, spd);
      g.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, decay: rand(0.015, 0.04), color, size: rand(sz[0], sz[1]) });
    }
  }, []);

  const addDmg = useCallback((x, y, text, color, big) => {
    const g = gRef.current; if (!g) return;
    g.dmgNums.push({ x: x + rand(-8, 8), y, text: String(text), color, life: 1, vy: -1.5, big: !!big });
  }, []);

  const announce = useCallback((text, color = C.goldLt, duration = 180) => {
    const g = gRef.current; if (!g) return;
    g.announcements.push({ text, color, life: duration, maxLife: duration });
  }, []);

  const evolve = useCallback(() => {
    const g = gRef.current; if (!g) return;
    if (g.evoStage >= EVOLUTIONS.length - 1) return;
    g.evoStage++;
    const evo = EVOLUTIONS[g.evoStage];
    // Apply bonuses
    g.maxHp += evo.hpBonus;
    g.hp = g.maxHp; // Full heal
    g.beamDmg += evo.beamBonus;
    if (evo.auraRadius > 0) { g.auraRadius = evo.auraRadius; g.auraDmg = 2 + g.evoStage; }
    if (evo.wings) g.rearBeam = true;
    g.beamWidth += 2;
    // Effects
    g.evoAnimTimer = 120;
    g.screenFlash = 25;
    g.flashColor = "rgba(255,240,200,0.4)";
    g.screenShake = 10;
    g.score += 200 * g.evoStage;
    // Big particle burst
    for (let i = 0; i < 50; i++) {
      const a = rand(0, PI2), d = rand(10, 150);
      g.particles.push({ x: CX + Math.cos(a) * d, y: CY + Math.sin(a) * d, vx: Math.cos(a) * rand(1, 6), vy: Math.sin(a) * rand(1, 6), life: 1, decay: rand(0.008, 0.025), color: evo.crownColor || evo.color, size: rand(3, 7) });
    }
    announce("\u2605 EVOLUTION: " + evo.name + " \u2605", C.goldLt, 200);
    if (evo.desc) announce(evo.desc, C.dim, 250);
  }, [announce]);

  const spawnButcher = useCallback((lvl) => {
    const g = gRef.current; if (!g) return;
    const a = rand(0, PI2);
    g.entities.push({
      x: CX + Math.cos(a) * 420, y: CY + Math.sin(a) * 420,
      hp: 60 + lvl * 30, maxHp: 60 + lvl * 30,
      speed: 0.7 + lvl * 0.1, size: 28 + lvl * 3,
      score: 200 + lvl * 80, color: C.butcher,
      enemy: true, type: "butcher", flash: 0, wobble: rand(0, PI2),
      phase: "circle", phaseTimer: 200 + Math.floor(rand(0, 60)),
      orbitAngle: a, orbitRadius: 260 - lvl * 10,
      chargeAngle: 0, chargeSpeed: 0,
      stunTimer: 0, dmgReduction: 0.15 + lvl * 0.05,
      spawnedMinions: false, lvl,
    });
    g.butcherActive = true;
    announce("\u2694 THE BUTCHER ENTERS \u2694", C.butcherLt, 120);
  }, [announce]);

  const spawn = useCallback(() => {
    const g = gRef.current; if (!g) return;
    // Enemies dominate, worshippers are the rare blessing
    const enemyChance = Math.min(0.88, 0.75 + g.wave * 0.008);
    const isEnemy = Math.random() < enemyChance;
    const edge = Math.floor(Math.random() * 4);
    let x, y;
    if (edge === 0) { x = rand(50, W - 50); y = -30; }
    else if (edge === 1) { x = W + 30; y = rand(50, H - 50); }
    else if (edge === 2) { x = rand(50, W - 50); y = H + 30; }
    else { x = -30; y = rand(50, H - 50); }
    // Gentler scaling
    const wm = 1 + g.wave * 0.07;

    if (isEnemy) {
      const pool = [];
      // Grunts fade as new types unlock
      const gruntWeight = g.unlockedShield ? 1 : g.unlockedBrute ? 1 : g.unlockedSwift ? 2 : 3;
      for (let i = 0; i < gruntWeight; i++) pool.push(0);
      if (g.unlockedSwift) { pool.push(1, 1); if (g.wave >= 6) pool.push(1); }
      if (g.unlockedBrute) { pool.push(2, 2); if (g.wave >= 8) pool.push(2); }
      if (g.unlockedShield) { pool.push(3, 3, 3); }
      const type = pool[Math.floor(Math.random() * pool.length)];
      // Slower enemies overall
      const templates = [
        { hp: 10 * wm, speed: 0.9, size: 15, score: 10, color: "#4a2035", name: "grunt" },
        { hp: 6 * wm, speed: 1.8, size: 12, score: 15, color: "#2a2060", name: "swift" },
        { hp: 35 * wm, speed: 0.5, size: 23, score: 30, color: "#5a3a20", name: "brute" },
        { hp: 16 * wm, speed: 0.8, size: 17, score: 25, color: "#205050", name: "shield" },
      ];
      const t = templates[type];
      g.entities.push({
        x, y, hp: t.hp, maxHp: t.hp, speed: t.speed * (g.chaosMode ? 1.2 : 1),
        size: t.size, score: t.score, color: t.color,
        enemy: true, type: t.name, flash: 0, wobble: rand(0, PI2),
        shieldHp: type === 3 ? 12 * wm : 0, shieldMax: type === 3 ? 12 * wm : 0,
        shieldBroken: type !== 3,
      });
    } else {
      const cats = ["wealth", "health", "psych"];
      const cat = cats[Math.floor(Math.random() * cats.length)];
      const cc = { wealth: C.wealth, health: C.health, psych: C.psych };
      const cs = { wealth: "W", health: "H", psych: "P" };
      g.entities.push({
        x, y, hp: 1, maxHp: 1, speed: 0.8 + g.wave * 0.02,
        size: 14, score: 0, color: cc[cat], enemy: false, cat,
        symbol: cs[cat], powerValue: 70 + Math.floor(rand(0, 30)),
        flash: 0, wobble: rand(0, PI2),
      });
    }
  }, []);

  const triggerAscension = useCallback(() => {
    const g = gRef.current; if (!g) return;
    g.ascension = true; g.ascensionTimer = 420; // 7 seconds
    g.screenFlash = 25; g.flashColor = "rgba(240,208,96,0.4)"; g.screenShake = 15;
    // Heal 3 HP on ascension
    g.hp = Math.min(g.maxHp, g.hp + 3);
    g.entities = g.entities.filter(e => {
      if (e.enemy) { g.score += e.score * 3; g.kills++; addP(e.x, e.y, C.goldLt, 10, 5); return false; }
      return true;
    });
    for (let i = 0; i < 50; i++) {
      const a = rand(0, PI2), d = rand(20, 220);
      g.particles.push({ x: CX + Math.cos(a) * d, y: CY + Math.sin(a) * d, vx: Math.cos(a) * rand(2, 8), vy: Math.sin(a) * rand(2, 8), life: 1, decay: rand(0.008, 0.02), color: C.goldLt, size: rand(3, 8) });
    }
    g.score += 777; g.power = 0; g.powerW = 0; g.powerH = 0; g.powerP = 0;
    announce("\u2605 ASCENSION 777 \u2605", C.goldLt, 150);
  }, [addP, announce]);

  const startGame = useCallback(() => { initGame(); setScreen("playing"); }, [initGame]);

  // Input
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const getP = (e) => { const r = canvas.getBoundingClientRect(); const s = scaleRef.current; const src = e.touches ? e.touches[0] : e; return { x: (src.clientX - r.left) / s, y: (src.clientY - r.top) / s }; };
    const md = (e) => { e.preventDefault(); if (screen !== "playing") { startGame(); return; } mouseRef.current = { ...getP(e), down: true }; };
    const mm = (e) => { const p = getP(e); mouseRef.current.x = p.x; mouseRef.current.y = p.y; };
    const mu = () => { mouseRef.current.down = false; };
    const ts = (e) => { e.preventDefault(); if (screen !== "playing") { startGame(); return; } mouseRef.current = { ...getP(e), down: true }; };
    const tm = (e) => { e.preventDefault(); if (e.touches.length > 0) { const p = getP(e); mouseRef.current.x = p.x; mouseRef.current.y = p.y; } };
    const te = (e) => { e.preventDefault(); mouseRef.current.down = false; };
    canvas.addEventListener("mousedown", md); window.addEventListener("mousemove", mm); window.addEventListener("mouseup", mu);
    canvas.addEventListener("touchstart", ts, { passive: false }); canvas.addEventListener("touchmove", tm, { passive: false }); canvas.addEventListener("touchend", te, { passive: false });
    return () => { canvas.removeEventListener("mousedown", md); window.removeEventListener("mousemove", mm); window.removeEventListener("mouseup", mu); canvas.removeEventListener("touchstart", ts); canvas.removeEventListener("touchmove", tm); canvas.removeEventListener("touchend", te); };
  }, [screen, startGame]);

  // Main loop
  useEffect(() => {
    if (screen !== "playing") return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const loop = () => {
      const g = gRef.current;
      if (!g || !g.alive) return;
      const m = mouseRef.current;
      g.ticks++; g.pulsePhase++; g.wingPhase += 0.04;
      if (g.ticks % 60 === 0) g.time++;
      g.aimAngle = Math.atan2(m.y - (CY - 47), m.x - CX);
      g.firing = m.down;
      g.laserIntensity = lerp(g.laserIntensity, g.firing ? 1 : 0, g.firing ? 0.15 : 0.25);
      g.eyeGlow = lerp(g.eyeGlow, g.firing ? 1 : 0.12, 0.1);
      if (g.evoAnimTimer > 0) g.evoAnimTimer--;

      const evo = EVOLUTIONS[g.evoStage];

      // === WAVES (longer: 2000 ticks = ~33s each) ===
      g.waveTimer++;
      if (g.waveTimer >= 2000) {
        g.wave++; g.waveTimer = 0;
        // Heal 1 HP on wave clear
        g.hp = Math.min(g.maxHp, g.hp + 1);
        addDmg(CX, CY - 80, "+1 HP", C.health);

        const evt = WAVE_EVENTS[g.wave];
        if (evt) {
          if (evt.type === "evolve") { evolve(); }
          else if (evt.type === "swift") { g.unlockedSwift = true; announce("WAVE " + g.wave + ": " + evt.msg, C.text, 150); }
          else if (evt.type === "brute") { g.unlockedBrute = true; announce("WAVE " + g.wave + ": " + evt.msg, C.text, 150); }
          else if (evt.type === "shield") { g.unlockedShield = true; announce("WAVE " + g.wave + ": " + evt.msg, C.text, 150); }
          else if (evt.type === "butcher") { spawnButcher(0); }
          else if (evt.type === "butcher2") { spawnButcher(1); }
          else if (evt.type === "butcher3") { spawnButcher(2); }
          else if (evt.type === "butcher4") { spawnButcher(3); }
          else if (evt.type === "swarm") { for (let i = 0; i < 12; i++) spawn(); announce("WAVE " + g.wave + ": SHADOW SWARM", C.redLt, 120); }
          else if (evt.type === "chaos") { g.chaosMode = true; announce("WAVE " + g.wave + ": THE ENDLESS NIGHT", C.redLt, 200); }
        } else {
          announce("WAVE " + g.wave, C.text, 80);
        }
        g.screenFlash = 6; g.flashColor = "rgba(255,255,255,0.1)";
        // Periodic butcher after wave 5
        if (g.wave > 6 && g.wave % 5 === 0 && !g.butcherActive) {
          spawnButcher(Math.min(3, Math.floor(g.wave / 6)));
        }
      }

      // Spawning — gradual ramp
      g.spawnTimer++;
      const spawnRate = Math.max(22, 55 - g.wave * 2.5);
      if (g.spawnTimer >= spawnRate) { spawn(); g.spawnTimer = 0; }
      // Force enemies if screen is too empty
      const enemyCount = g.entities.filter(e => e.enemy && !e._dead).length;
      if (enemyCount < 3 && g.ticks % 40 === 0) { spawn(); }

      if (g.ascension) { g.ascensionTimer--; if (g.ascensionTimer <= 0) g.ascension = false; }

      // === AURA damage (from evolution) ===
      if (g.auraRadius > 0 && g.ticks % 20 === 0) {
        g.entities.forEach(e => {
          if (e.enemy && !e._dead && dist({ x: CX, y: CY }, e) < g.auraRadius) {
            e.hp -= g.auraDmg; e.flash = 3;
            if (g.ticks % 40 === 0) addP(e.x, e.y, evo.crownColor || C.gold, 2, 2, [1, 3]);
          }
        });
      }

      // === BEAM (stops on first hit) ===
      let beamHitDist;
      const die = () => {
        g.alive = false;
        setFinalStats({ score: g.score, kills: g.kills, saved: g.saved, betrayed: g.betrayed, wave: g.wave, time: g.time, maxCombo: g.maxCombo, evoName: EVOLUTIONS[g.evoStage].name });
        setBestScore(prev => Math.max(prev, g.score));
        setScreen("dead");
      };
      const fireBeam = (bAngle, dmgMult = 1, isRear = false) => {
        if (g.laserIntensity < (isRear ? 0.1 : 0.3)) return 9999;
        const eyeX = CX, eyeY = CY - 47;
        const dmg = (g.beamDmg + (g.ascension ? 3 : 0)) * dmgMult;
        let hitDist = 9999;

        const sorted = g.entities.filter(e => !e._dead).map(e => {
          const d = dist({ x: eyeX, y: eyeY }, e);
          const eA = Math.atan2(e.y - eyeY, e.x - eyeX);
          let aD = eA - bAngle; while (aD > Math.PI) aD -= PI2; while (aD < -Math.PI) aD += PI2;
          return { e, d, aD, cross: Math.abs(Math.sin(aD) * d) };
        }).filter(o => Math.abs(o.aD) < Math.PI / 2).sort((a, b) => a.d - b.d);

        let hit = false;
        for (const o of sorted) {
          if (hit) break;
          if (o.cross < g.beamWidth + o.e.size) {
            const e = o.e; hitDist = o.d; hit = true;

            if (e.type === "butcher") {
              const ad = e.stunTimer > 0 ? dmg * 3 : dmg * e.dmgReduction;
              e.hp -= ad; e.flash = 4;
            } else if (e.type === "shield" && !e.shieldBroken) {
              e.shieldHp -= dmg; e.flash = 3;
              if (e.shieldHp <= 0) { e.shieldBroken = true; addP(e.x, e.y, "#40aaaa", 12, 5); addDmg(e.x, e.y - 15, "SHIELD BROKEN", "#40dddd"); }
            } else if (e.enemy) { e.hp -= dmg; e.flash = 4; }
            else { e.hp -= dmg * 5; e.flash = 6; }

            if (e.hp <= 0 && !e._dead) {
              e._dead = true;
              if (e.enemy) {
                const mult = 1 + Math.floor(g.combo / 5);
                g.score += e.score * mult; g.kills++; g.combo++; g.comboTimer = 150;
                if (g.combo > g.maxCombo) g.maxCombo = g.combo;
                addP(e.x, e.y, e.type === "butcher" ? C.butcherLt : C.redLt, e.type === "butcher" ? 25 : 8, e.type === "butcher" ? 8 : 4);
                addDmg(e.x, e.y, "+" + (e.score * mult), C.goldLt);
                g.screenShake = Math.min(g.screenShake + (e.type === "butcher" ? 12 : 1.5), 12);
                if (e.type === "butcher") {
                  g.butcherActive = false; announce("BUTCHER SLAIN!", C.goldLt, 120);
                  g.score += 500; addDmg(e.x, e.y - 30, "+500 BONUS", C.goldLt, true);
                  g.hp = Math.min(g.maxHp, g.hp + 2); addDmg(CX, CY - 80, "+2 HP", C.health);
                }
              } else {
                g.betrayed++; g.combo = 0; g.comboTimer = 0;
                g.hp--; // Betrayal costs life
                g.power = Math.max(0, g.power - 40);
                if (e.cat === "wealth") g.powerW = Math.max(0, g.powerW - 40);
                if (e.cat === "health") g.powerH = Math.max(0, g.powerH - 40);
                if (e.cat === "psych") g.powerP = Math.max(0, g.powerP - 40);
                addP(e.x, e.y, "#fff", 12, 5); addDmg(e.x, e.y, "BETRAYED -1 HP", "#ff4040", true);
                g.screenShake = 5; g.screenFlash = 8; g.flashColor = "rgba(255,60,60,0.2)";
                if (g.hp <= 0) { die(); return -1; }
              }
            } else if (e.enemy && !e._dead && g.ticks % 10 === 0) {
              addDmg(e.x + rand(-5, 5), e.y - 10, Math.ceil(dmg), "#ff9999");
            }
          }
        }
        return hitDist;
      };

      beamHitDist = fireBeam(g.aimAngle, 1, false);
      if (!g.alive) { return; }
      let rearHitDist = 9999;
      if (g.rearBeam && g.firing) { rearHitDist = fireBeam(g.aimAngle + Math.PI, 0.4, true); }
      if (!g.alive) { return; }

      if (g.comboTimer > 0) { g.comboTimer--; if (g.comboTimer <= 0) g.combo = 0; }

      // Update entities
      

      g.entities = g.entities.filter(e => {
        if (e._dead) return false;
        if (e.flash > 0) e.flash--;

        if (e.type === "butcher") {
          if (e.stunTimer > 0) { e.stunTimer--; e.x += Math.sin(g.ticks * 0.3) * 0.5; return true; }
          if (e.phase === "circle") {
            e.orbitAngle += (0.01 + e.lvl * 0.003);
            e.orbitRadius = Math.max(110, e.orbitRadius - 0.1);
            e.x = lerp(e.x, CX + Math.cos(e.orbitAngle) * e.orbitRadius, 0.035);
            e.y = lerp(e.y, CY + Math.sin(e.orbitAngle) * e.orbitRadius, 0.035);
            e.phaseTimer--;
            if (e.phaseTimer <= 0) { e.phase = "windup"; e.phaseTimer = 70; }
            if (e.lvl >= 1 && !e.spawnedMinions && e.hp < e.maxHp * 0.4) {
              e.spawnedMinions = true;
              for (let i = 0; i < 2 + e.lvl; i++) {
                const ma = rand(0, PI2), md2 = rand(30, 50);
                g.entities.push({ x: e.x + Math.cos(ma) * md2, y: e.y + Math.sin(ma) * md2, hp: 6, maxHp: 6, speed: 1.5, size: 10, score: 5, color: "#6a2020", enemy: true, type: "minion", flash: 0, wobble: rand(0, PI2), shieldHp: 0, shieldMax: 0, shieldBroken: true });
              }
              announce("BUTCHER SUMMONS MINIONS!", C.butcherLt, 90);
            }
          } else if (e.phase === "windup") {
            e.x += (Math.random() - 0.5) * 3; e.y += (Math.random() - 0.5) * 3;
            e.phaseTimer--;
            if (e.phaseTimer <= 0) { e.phase = "charge"; e.chargeAngle = ang(e, { x: CX, y: CY }); e.chargeSpeed = 5 + e.lvl; e.phaseTimer = 55; }
          } else if (e.phase === "charge") {
            e.x += Math.cos(e.chargeAngle) * e.chargeSpeed; e.y += Math.sin(e.chargeAngle) * e.chargeSpeed;
            e.phaseTimer--; addP(e.x, e.y, C.butcherLt, 1, 2, [2, 4]);
            if (dist(e, { x: CX, y: CY + 20 }) < 50) {
              if (!g.ascension) { g.hp -= 2; g.screenShake = 10; g.screenFlash = 12; g.flashColor = "rgba(255,30,30,0.3)"; addP(CX, CY, C.redLt, 10, 5); addDmg(CX, CY - 70, "-2 HP", C.redLt, true); if (g.hp <= 0) { die(); return false; } }
              e.phase = "circle"; e.phaseTimer = 140; e.stunTimer = 140; e.orbitRadius = 200; addDmg(e.x, e.y - 20, "STUNNED!", "#ffff60", true); return true;
            }
            if (e.phaseTimer <= 0 || e.x < -60 || e.x > W + 60 || e.y < -60 || e.y > H + 60) {
              e.phase = "circle"; e.phaseTimer = 160 + Math.floor(rand(0, 60)); e.stunTimer = 100; e.orbitRadius = 230;
              addDmg(CX + rand(-100, 100), CY - 60, "STUNNED!", "#ffff60", true);
            }
          }
          return true;
        }

        const toC = ang(e, { x: CX, y: CY + 20 });
        e.x += Math.cos(toC) * e.speed; e.y += Math.sin(toC) * e.speed;
        const d = dist(e, { x: CX, y: CY + 20 });

        // Magnetism for worshippers
        if (!e.enemy && d < 120 * g.magnetism) {
          e.x += Math.cos(toC) * 0.5; e.y += Math.sin(toC) * 0.5;
        }

        if (d < 45) {
          if (e.enemy) {
            if (!g.ascension) {
              g.hp--; g.combo = 0; g.screenShake = 6; g.screenFlash = 10; g.flashColor = "rgba(255,50,50,0.25)";
              addP(CX, CY, C.redLt, 6, 3); addDmg(CX, CY - 70, "-1 HP", C.redLt);
              if (g.hp <= 0) { die(); return false; }
            } else { g.score += e.score; g.kills++; addP(e.x, e.y, C.goldLt, 5, 3); }
          } else {
            g.saved++; g.score += 25;
            const pv = e.powerValue;
            if (e.cat === "wealth") g.powerW = Math.min(259, g.powerW + pv);
            if (e.cat === "health") g.powerH = Math.min(259, g.powerH + pv);
            if (e.cat === "psych") g.powerP = Math.min(259, g.powerP + pv);
            g.power = g.powerW + g.powerH + g.powerP;
            addP(e.x, e.y, e.color, 6, 3); addDmg(e.x, e.y - 15, "+" + pv, e.color);
            if (g.power >= 777 && !g.ascension) triggerAscension();
          }
          return false;
        }
        return true;
      });

      if (!g.alive) return; // Stop if died during entity update

      g.particles = g.particles.filter(p => { p.x += p.vx; p.y += p.vy; p.vx *= 0.97; p.vy *= 0.97; p.life -= p.decay; return p.life > 0; });
      g.dmgNums = g.dmgNums.filter(d => { d.y += d.vy; d.life -= 0.02; return d.life > 0; });
      g.announcements = g.announcements.filter(a => { a.life--; return a.life > 0; });
      g.screenShake *= 0.88; if (g.screenFlash > 0) g.screenFlash--;

      // ============ RENDER ============
      ctx.save();
      ctx.translate((Math.random() - 0.5) * g.screenShake, (Math.random() - 0.5) * g.screenShake);

      // BG
      ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
      const bgG = ctx.createRadialGradient(CX, CY, 40, CX, CY, 400);
      bgG.addColorStop(0, g.ascension ? "rgba(50,40,15,0.3)" : g.evoStage >= 4 ? "rgba(40,30,10,0.25)" : "rgba(20,15,30,0.2)");
      bgG.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = bgG; ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = g.ascension ? "rgba(212,168,67,0.04)" : "rgba(60,50,80,0.04)"; ctx.lineWidth = 1;
      for (let r = 50; r < 500; r += 50) { ctx.beginPath(); ctx.arc(CX, CY + 30, r, 0, PI2); ctx.stroke(); }
      for (let i = 0; i < 12; i++) { const a = (i / 12) * PI2; ctx.beginPath(); ctx.moveTo(CX + Math.cos(a) * 50, CY + 30 + Math.sin(a) * 50); ctx.lineTo(CX + Math.cos(a) * 500, CY + 30 + Math.sin(a) * 500); ctx.stroke(); }

      [60, W - 80].forEach(px => { ctx.fillStyle = "rgba(40,35,55,0.2)"; ctx.fillRect(px, 0, 20, H); ctx.fillStyle = "rgba(55,48,70,0.25)"; ctx.fillRect(px - 6, 0, 32, 14); ctx.fillRect(px - 6, H - 14, 32, 14); });

      // Aura ring
      if (g.auraRadius > 0) {
        ctx.strokeStyle = "rgba(212,168,67," + (0.08 + Math.sin(g.ticks * 0.04) * 0.04) + ")";
        ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(CX, CY, g.auraRadius, 0, PI2); ctx.stroke();
      }

      // Particles
      g.particles.forEach(p => { ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, PI2); ctx.fill(); });
      ctx.globalAlpha = 1;

      // Entities
      g.entities.forEach(e => {
        if (e._dead) return;
        ctx.save(); ctx.translate(e.x, e.y);
        const wb = Math.sin(e.wobble + g.ticks * 0.06) * 3;
        const fl = e.flash > 0;

        if (e.type === "butcher") {
          const stunned = e.stunTimer > 0; const winding = e.phase === "windup";
          ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.ellipse(0, e.size + 5, e.size * 0.8, e.size * 0.3, 0, 0, PI2); ctx.fill();
          if (winding) { ctx.strokeStyle = "rgba(255,30,30," + (0.3 + Math.sin(g.ticks * 0.3) * 0.3) + ")"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, e.size + 12 + Math.sin(g.ticks * 0.2) * 4, 0, PI2); ctx.stroke(); }
          ctx.fillStyle = fl ? "#fff" : stunned ? "#aa7766" : winding ? "#cc1515" : C.butcher;
          ctx.beginPath(); ctx.arc(0, wb, e.size, 0, PI2); ctx.fill();
          ctx.fillStyle = fl ? "#ddd" : "rgba(0,0,0,0.45)"; ctx.beginPath(); ctx.arc(0, wb, e.size * 0.55, 0, PI2); ctx.fill();
          [-1, 1].forEach(dir => { ctx.fillStyle = stunned ? "#887070" : "#aa2020"; ctx.beginPath(); ctx.moveTo(dir * e.size * 0.5, wb - e.size * 0.7); ctx.lineTo(dir * e.size * 0.3, wb - e.size * 1.3); ctx.lineTo(dir * e.size * 0.1, wb - e.size * 0.6); ctx.fill(); });
          ctx.fillStyle = stunned ? "#996600" : "#ff2020"; ctx.shadowColor = stunned ? "#996600" : "#ff0000"; ctx.shadowBlur = stunned ? 4 : 10;
          ctx.beginPath(); ctx.arc(-e.size * 0.25, wb - 3, 3.5, 0, PI2); ctx.fill();
          ctx.beginPath(); ctx.arc(e.size * 0.25, wb - 3, 3.5, 0, PI2); ctx.fill(); ctx.shadowBlur = 0;
          if (!stunned) { ctx.fillStyle = "#888"; ctx.save(); ctx.translate(e.size * 0.8, wb); ctx.rotate(Math.sin(g.ticks * 0.08) * 0.3); ctx.fillRect(-3, -18, 6, 13); ctx.fillStyle = "#aaa"; ctx.beginPath(); ctx.moveTo(-7, -18); ctx.lineTo(7, -18); ctx.lineTo(9, -27); ctx.lineTo(-5, -27); ctx.closePath(); ctx.fill(); ctx.restore(); }
          const bw = e.size * 2.5; ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(-bw / 2, -e.size - 20, bw, 5);
          ctx.fillStyle = stunned ? "#ffcc00" : C.butcherLt; ctx.fillRect(-bw / 2, -e.size - 20, bw * Math.max(0, e.hp / e.maxHp), 5);
          if (stunned) { ctx.fillStyle = "#ffff60"; ctx.font = "bold 10px Georgia"; ctx.textAlign = "center"; ctx.fillText("VULNERABLE", 0, -e.size - 26); }
        } else if (e.enemy) {
          ctx.fillStyle = "rgba(0,0,0,0.2)"; ctx.beginPath(); ctx.ellipse(0, e.size, e.size * 0.6, e.size * 0.2, 0, 0, PI2); ctx.fill();
          if (e.type === "shield" && !e.shieldBroken) { ctx.strokeStyle = "rgba(64,170,170," + (0.35 + Math.sin(g.ticks * 0.1) * 0.15) + ")"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, wb, e.size + 5, 0, PI2); ctx.stroke(); }
          ctx.fillStyle = fl ? "#fff" : e.color; ctx.beginPath(); ctx.arc(0, wb, e.size, 0, PI2); ctx.fill();
          ctx.fillStyle = fl ? "#ccc" : "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.arc(0, wb, e.size * 0.45, 0, PI2); ctx.fill();
          ctx.fillStyle = C.enemyEye; ctx.shadowColor = C.enemyEye; ctx.shadowBlur = 4;
          ctx.beginPath(); ctx.arc(-e.size * 0.25, wb - 1, 2, 0, PI2); ctx.fill();
          ctx.beginPath(); ctx.arc(e.size * 0.25, wb - 1, 2, 0, PI2); ctx.fill(); ctx.shadowBlur = 0;
          if (e.type === "brute") { ctx.strokeStyle = "#8a4020"; ctx.lineWidth = 2; for (let i = 0; i < 6; i++) { const sa = (i / 6) * PI2 + g.ticks * 0.02; ctx.beginPath(); ctx.moveTo(Math.cos(sa) * e.size, wb + Math.sin(sa) * e.size); ctx.lineTo(Math.cos(sa) * (e.size + 6), wb + Math.sin(sa) * (e.size + 6)); ctx.stroke(); } }
        } else {
          const gw = 0.3 + Math.sin(g.ticks * 0.08 + e.wobble) * 0.15;
          ctx.shadowColor = e.color; ctx.shadowBlur = 8;
          ctx.fillStyle = fl ? "#fff" : e.color; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(0, wb, e.size, 0, PI2); ctx.fill(); ctx.globalAlpha = 1;
          ctx.fillStyle = "rgba(255,255,255," + gw + ")"; ctx.beginPath(); ctx.arc(0, wb, e.size * 0.45, 0, PI2); ctx.fill(); ctx.shadowBlur = 0;
          ctx.fillStyle = "#fff"; ctx.font = "bold " + (e.size * 0.8) + "px Georgia"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(e.symbol, 0, wb + 1);
        }
        ctx.restore();
      });

      // === BEAMS ===
      const drawBeamLine = (bAngle, hitD, alpha = 1) => {
        if (g.laserIntensity < 0.05) return;
        const isAsc = g.ascension; const st = g.evoStage;
        const bLen = hitD < 9000 ? hitD : 600;
        const int = g.laserIntensity * alpha;
        const bColor = isAsc ? "rgba(255,224,80," : st >= 4 ? "rgba(255,200,80," : st >= 2 ? "rgba(255,120,40," : "rgba(255,50,50,";
        const cColor = isAsc ? "rgba(255,255,220," : st >= 4 ? "rgba(255,240,200," : "rgba(255,200,180,";

        [{ x: CX - 7, y: CY - 47 }, { x: CX + 7, y: CY - 47 }].forEach(eye => {
          const ex = eye.x + Math.cos(bAngle) * bLen;
          const ey = eye.y + Math.sin(bAngle) * bLen;
          ctx.strokeStyle = bColor + int * 0.1 + ")"; ctx.lineWidth = g.beamWidth * 3.5 * alpha; ctx.lineCap = "round";
          ctx.beginPath(); ctx.moveTo(eye.x, eye.y); ctx.lineTo(ex, ey); ctx.stroke();
          ctx.strokeStyle = bColor + int * 0.3 + ")"; ctx.lineWidth = g.beamWidth * 1.5 * alpha;
          ctx.beginPath(); ctx.moveTo(eye.x, eye.y); ctx.lineTo(ex, ey); ctx.stroke();
          ctx.strokeStyle = cColor + int * 0.8 + ")"; ctx.lineWidth = g.beamWidth * 0.5 * alpha;
          ctx.beginPath(); ctx.moveTo(eye.x, eye.y); ctx.lineTo(ex, ey); ctx.stroke();
        });
        if (hitD < 9000 && int > 0.3) {
          const ix = CX + Math.cos(bAngle) * hitD, iy = (CY - 47) + Math.sin(bAngle) * hitD;
          const ig = ctx.createRadialGradient(ix, iy, 0, ix, iy, 15 * int);
          ig.addColorStop(0, bColor + "0.4)"); ig.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = ig; ctx.beginPath(); ctx.arc(ix, iy, 15 * int, 0, PI2); ctx.fill();
        }
      };
      drawBeamLine(g.aimAngle, beamHitDist);
      if (g.rearBeam && g.firing) drawBeamLine(g.aimAngle + Math.PI, rearHitDist, 0.35);

      // === STATUE ===
      ctx.save(); ctx.translate(CX, CY);
      const isAsc = g.ascension; const st = g.evoStage;

      // Evo anim glow
      if (g.evoAnimTimer > 0) {
        const eP = g.evoAnimTimer / 120;
        ctx.fillStyle = "rgba(255,240,200," + eP * 0.3 + ")"; ctx.beginPath(); ctx.arc(0, -20, 80 + (1 - eP) * 60, 0, PI2); ctx.fill();
      }

      // Aura
      const aS = 55 + g.power * 0.05 + Math.sin(g.pulsePhase * 0.03) * 3;
      const aG = ctx.createRadialGradient(0, -20, 8, 0, -20, aS);
      aG.addColorStop(0, isAsc ? "rgba(240,208,96,0.2)" : st >= 4 ? "rgba(255,220,100,0.15)" : st >= 2 ? "rgba(212,168,67,0.08)" : "rgba(196,30,30," + (0.03 + g.power * 0.0002) + ")");
      aG.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = aG; ctx.beginPath(); ctx.arc(0, -20, aS, 0, PI2); ctx.fill();

      // === WINGS (stage 3+) ===
      if (st >= 3) {
        const wingFlap = Math.sin(g.wingPhase) * 0.25;
        const wColor = isAsc ? "rgba(255,240,150," : st >= 4 ? "rgba(255,220,120," : "rgba(200,180,140,";
        [-1, 1].forEach(dir => {
          ctx.save(); ctx.scale(dir, 1);
          ctx.fillStyle = wColor + "0.25)";
          ctx.beginPath();
          ctx.moveTo(20, -25);
          ctx.quadraticCurveTo(55 + wingFlap * 20, -70 - wingFlap * 30, 80, -50 + wingFlap * 10);
          ctx.quadraticCurveTo(70, -20, 35, 5);
          ctx.quadraticCurveTo(25, -5, 20, -10);
          ctx.closePath(); ctx.fill();
          // Wing bones
          ctx.strokeStyle = wColor + "0.15)"; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(22, -22); ctx.quadraticCurveTo(50, -55 - wingFlap * 20, 75, -48 + wingFlap * 8); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(24, -18); ctx.quadraticCurveTo(45, -40, 65, -30); ctx.stroke();
          ctx.restore();
        });
      }

      // Pedestal
      ctx.fillStyle = "#1a1820"; ctx.beginPath(); ctx.moveTo(-45, 55); ctx.lineTo(45, 55); ctx.lineTo(38, 28); ctx.lineTo(-38, 28); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#252330"; ctx.fillRect(-50, 55, 100, 10); ctx.fillRect(-55, 65, 110, 5);

      // Body
      const bodyC = isAsc ? C.goldLt : evo.color;
      const bodyD = isAsc ? C.gold : C.marbleDk;
      const bGr = ctx.createLinearGradient(-25, -15, 25, 28);
      bGr.addColorStop(0, bodyC); bGr.addColorStop(1, bodyD); ctx.fillStyle = bGr;
      ctx.beginPath(); ctx.moveTo(-35, 26); ctx.quadraticCurveTo(-38, 8, -30, -6); ctx.quadraticCurveTo(-25, -16, -15, -20);
      ctx.lineTo(15, -20); ctx.quadraticCurveTo(25, -16, 30, -6); ctx.quadraticCurveTo(38, 8, 35, 26); ctx.closePath(); ctx.fill();

      // Neck + Head
      ctx.fillStyle = isAsc ? C.goldLt : evo.color; ctx.fillRect(-8, -30, 16, 14);
      const hGr = ctx.createRadialGradient(-3, -47, 5, 0, -44, 22);
      hGr.addColorStop(0, bodyC); hGr.addColorStop(1, bodyD);
      ctx.fillStyle = hGr; ctx.beginPath(); ctx.ellipse(0, -47, 18, 22, 0, 0, PI2); ctx.fill();
      ctx.fillStyle = bodyD; ctx.beginPath(); ctx.ellipse(0, -62, 16, 8, 0, Math.PI, PI2); ctx.fill();

      // === CROWN (stage 2+) ===
      if (st >= 2 && evo.crownColor) {
        ctx.fillStyle = isAsc ? "#fff0a0" : evo.crownColor;
        const cY = -68;
        ctx.beginPath();
        ctx.moveTo(-12, cY + 5); ctx.lineTo(-14, cY - 6); ctx.lineTo(-7, cY);
        ctx.lineTo(0, cY - 10); ctx.lineTo(7, cY);
        ctx.lineTo(14, cY - 6); ctx.lineTo(12, cY + 5); ctx.closePath(); ctx.fill();
        // Jewel
        ctx.fillStyle = C.red; ctx.beginPath(); ctx.arc(0, cY - 2, 2.5, 0, PI2); ctx.fill();
      }

      // Thinker hand
      ctx.fillStyle = isAsc ? C.goldLt : evo.color;
      ctx.beginPath(); ctx.moveTo(15, 3); ctx.quadraticCurveTo(22, -12, 18, -27); ctx.quadraticCurveTo(15, -32, 8, -32);
      ctx.quadraticCurveTo(5, -27, 10, -17); ctx.quadraticCurveTo(12, -7, 10, 3); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(10, -32, 7, 0, PI2); ctx.fill();

      // Eyes
      ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.ellipse(-7, -49, 5, 3, 0, 0, PI2); ctx.fill(); ctx.beginPath(); ctx.ellipse(7, -49, 5, 3, 0, 0, PI2); ctx.fill();
      const eIntensity = 0.15 + g.evoStage * 0.15 + g.eyeGlow * 0.4;
      const eColor = isAsc ? C.goldLt : evo.beamColor;
      ctx.shadowColor = eColor; ctx.shadowBlur = 4 + eIntensity * 15;
      ctx.fillStyle = eColor;
      ctx.beginPath(); ctx.ellipse(-7, -49, 3.5, 2.5, 0, 0, PI2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(7, -49, 3.5, 2.5, 0, 0, PI2); ctx.fill(); ctx.shadowBlur = 0;

      // 777
      ctx.shadowColor = eColor; ctx.shadowBlur = 4 + g.power * 0.01;
      ctx.fillStyle = isAsc ? C.goldLt : C.red;
      ctx.font = "bold 12px Georgia"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("777", 0, -58); ctx.shadowBlur = 0;

      ctx.restore();

      // Dmg numbers
      g.dmgNums.forEach(d => { ctx.globalAlpha = Math.max(0, d.life); ctx.fillStyle = d.color; ctx.font = d.big ? "bold 18px Georgia" : "bold 13px Georgia"; ctx.textAlign = "center"; ctx.fillText(d.text, d.x, d.y); });
      ctx.globalAlpha = 1;

      if (g.screenFlash > 0) { ctx.fillStyle = g.flashColor; ctx.globalAlpha = g.screenFlash * 0.025; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
      if (g.ascension) { const pu = Math.sin(g.ticks * 0.1) * 0.3 + 0.5; ctx.strokeStyle = "rgba(240,208,96," + pu * 0.6 + ")"; ctx.lineWidth = 3; ctx.strokeRect(3, 3, W - 6, H - 6); }

      // === HUD ===
      for (let i = 0; i < g.maxHp; i++) { ctx.fillStyle = i < g.hp ? C.redLt : "rgba(255,255,255,0.08)"; ctx.font = "14px serif"; ctx.textAlign = "left"; ctx.fillText(i < g.hp ? "\u2665" : "\u2661", 14 + i * 16, 24); }
      ctx.fillStyle = C.text; ctx.font = "bold 26px Georgia"; ctx.textAlign = "center"; ctx.fillText(g.score, W / 2, 32);
      ctx.fillStyle = C.dim; ctx.font = "11px Georgia"; ctx.fillText("WAVE " + g.wave + "  \xB7  " + g.kills + " kills  \xB7  " + g.saved + " saved", W / 2, 52);

      // Evolution stage indicator
      ctx.fillStyle = evo.crownColor || evo.beamColor; ctx.font = "bold 10px Georgia"; ctx.textAlign = "left";
      ctx.fillText(evo.name, 14, 42);

      // Next evolution hint
      const nextEvo = EVOLUTIONS[g.evoStage + 1];
      if (nextEvo) {
        ctx.fillStyle = C.dim; ctx.font = "9px Georgia"; ctx.textAlign = "left";
        ctx.fillText("Next form: " + nextEvo.name + " (wave " + nextEvo.wave + ")", 14, 54);
      }

      if (g.combo > 2) { ctx.fillStyle = g.ascension ? C.goldLt : C.redLt; ctx.font = "bold 15px Georgia"; ctx.textAlign = "center"; ctx.fillText("\xD7" + g.combo, W / 2, 72); }

      // Power meter
      const mX = W - 136, mY = 14, mW2 = 118, mH2 = 14;
      ctx.fillStyle = "rgba(255,255,255,0.05)"; ctx.fillRect(mX, mY, mW2, mH2);
      const sW2 = mW2 / 3;
      [{ v: g.powerW, c: C.wealth }, { v: g.powerH, c: C.health }, { v: g.powerP, c: C.psych }].forEach((s, i) => {
        ctx.fillStyle = s.c; ctx.globalAlpha = 0.75; ctx.fillRect(mX + i * sW2, mY, sW2 * Math.min(1, s.v / 259), mH2);
        if (i > 0) { ctx.globalAlpha = 1; ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fillRect(mX + i * sW2 - 1, mY, 2, mH2); }
      });
      ctx.globalAlpha = 1; ctx.strokeStyle = "rgba(255,255,255,0.1)"; ctx.lineWidth = 1; ctx.strokeRect(mX, mY, mW2, mH2);
      ctx.fillStyle = g.power >= 700 ? C.goldLt : C.dim; ctx.font = "bold 10px Georgia"; ctx.textAlign = "right";
      ctx.fillText(Math.floor(g.power) + " / 777", W - 18, 42);

      // Announcements
      g.announcements.forEach((a, i) => {
        const fi = Math.min(1, (a.maxLife - a.life) / 20); const fo = Math.min(1, a.life / 30);
        ctx.globalAlpha = Math.min(fi, fo); ctx.fillStyle = a.color; ctx.font = a.color === C.dim ? "14px Georgia" : "bold 20px Georgia";
        ctx.textAlign = "center"; ctx.fillText(a.text, W / 2, 100 + i * 28);
      });
      ctx.globalAlpha = 1;

      if (g.ticks < 420) {
        ctx.globalAlpha = g.ticks < 350 ? 0.5 : 0.5 * (1 - (g.ticks - 350) / 70);
        ctx.fillStyle = C.dim; ctx.font = "12px Georgia"; ctx.textAlign = "center";
        ctx.fillText("HOLD to fire  \xB7  Vaporize enemies  \xB7  Spare offerings  \xB7  Evolve through waves", W / 2, H - 20);
        ctx.globalAlpha = 1;
      }

      ctx.restore();
      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [screen, spawn, spawnButcher, addP, addDmg, announce, triggerAscension, evolve]);

  // Menu/Dead
  useEffect(() => {
    if (screen !== "menu" && screen !== "dead") return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let t = 0;
    const draw = () => {
      t++;
      ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(60,50,80,0.04)"; ctx.lineWidth = 1;
      for (let r = 50; r < 400; r += 50) { ctx.beginPath(); ctx.arc(CX, CY - 20, r, 0, PI2); ctx.stroke(); }

      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * PI2 + t * 0.006; const d = 160 + Math.sin(t * 0.02 + i * 2) * 30;
        ctx.fillStyle = [C.wealth, C.health, C.psych, C.redLt, C.goldLt, C.dim][i];
        ctx.globalAlpha = 0.12 + Math.sin(t * 0.03 + i) * 0.08;
        ctx.beginPath(); ctx.arc(CX + Math.cos(a) * d, (CY - 30) + Math.sin(a) * d * 0.5, 5, 0, PI2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      const tY = screen === "dead" ? 80 : 110;
      ctx.shadowColor = C.red; ctx.shadowBlur = 35;
      ctx.fillStyle = C.red; ctx.font = "bold 68px Georgia"; ctx.textAlign = "center";
      ctx.fillText("777", CX, tY); ctx.shadowBlur = 0;
      ctx.fillStyle = C.text; ctx.font = "italic 20px Georgia"; ctx.fillText("REIGN OF THE VII", CX, tY + 34);
      ctx.fillStyle = C.dim; ctx.font = "12px Georgia";
      ctx.fillText("Vaporize enemies  \xB7  Spare offerings  \xB7  Evolve your form", CX, tY + 58);

      // Evolution stages preview
      ctx.fillStyle = C.dim; ctx.font = "10px Georgia"; ctx.textAlign = "center";
      const evoY = tY + 82;
      EVOLUTIONS.slice(1).forEach((ev, i) => {
        const x = CX - 160 + i * 80;
        ctx.fillStyle = screen === "dead" && finalStats.evoName === ev.name ? C.goldLt : C.dim;
        ctx.fillText(ev.name, x, evoY);
        ctx.fillStyle = "rgba(255,255,255,0.06)";
        ctx.fillRect(x - 25, evoY + 4, 50, 2);
        if (screen === "dead" && EVOLUTIONS.findIndex(e => e.name === finalStats.evoName) >= i + 1) {
          ctx.fillStyle = C.goldLt; ctx.fillRect(x - 25, evoY + 4, 50, 2);
        }
      });

      if (screen === "dead") {
        const fs = finalStats;
        ctx.fillStyle = C.text; ctx.font = "bold 22px Georgia"; ctx.fillText("SCORE: " + (fs.score || 0), CX, 260);
        ctx.fillStyle = C.goldLt; ctx.font = "italic 14px Georgia";
        ctx.fillStyle = C.goldLt; ctx.fillText("Final Form: " + (fs.evoName || "MARBLE"), CX, 285);
        ctx.fillStyle = C.dim; ctx.font = "13px Georgia";
        ctx.fillText((fs.kills || 0) + " killed  \xB7  " + (fs.saved || 0) + " saved  \xB7  " + (fs.betrayed || 0) + " betrayed  \xB7  Wave " + (fs.wave || 1), CX, 310);
        ctx.fillText("Best combo: \xD7" + (fs.maxCombo || 0) + "  \xB7  " + Math.floor((fs.time || 0) / 60) + ":" + String((fs.time || 0) % 60).padStart(2, "0"), CX, 332);
        if (bestScore > 0) { ctx.fillStyle = C.gold; ctx.font = "14px Georgia"; ctx.fillText("BEST: " + bestScore, CX, 358); }
      }

      // Statue preview
      const sY = screen === "dead" ? 450 : 400;
      ctx.save(); ctx.translate(CX, sY); ctx.scale(1.8, 1.8);
      ctx.fillStyle = "#1a1820"; ctx.beginPath(); ctx.moveTo(-28, 20); ctx.lineTo(28, 20); ctx.lineTo(22, 8); ctx.lineTo(-22, 8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = C.marble;
      ctx.beginPath(); ctx.moveTo(-20, 6); ctx.quadraticCurveTo(-22, -4, -16, -10); ctx.lineTo(16, -10); ctx.quadraticCurveTo(22, -4, 20, 6); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.ellipse(0, -24, 13, 16, 0, 0, PI2); ctx.fill();
      ctx.shadowColor = C.redLt; ctx.shadowBlur = 6; ctx.fillStyle = C.redLt;
      ctx.beginPath(); ctx.ellipse(-5, -26, 2.5, 1.8, 0, 0, PI2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(5, -26, 2.5, 1.8, 0, 0, PI2); ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = C.red; ctx.font = "bold 7px Georgia"; ctx.textAlign = "center"; ctx.fillText("777", 0, -33);
      ctx.fillStyle = C.marble; ctx.beginPath(); ctx.arc(8, -18, 5, 0, PI2); ctx.fill();
      if (t % 140 < 70) { const la = -Math.PI / 2 + Math.sin(t * 0.03) * 0.5; ctx.strokeStyle = "rgba(255,50,50,0.15)"; ctx.lineWidth = 1.5; [-5, 5].forEach(ex => { ctx.beginPath(); ctx.moveTo(ex, -26); ctx.lineTo(ex + Math.cos(la) * 70, -26 + Math.sin(la) * 70); ctx.stroke(); }); }
      ctx.restore();

      const pulse = Math.sin(t * 0.06) * 0.3 + 0.7;
      ctx.fillStyle = "rgba(232,228,220," + pulse + ")"; ctx.font = "14px Georgia"; ctx.textAlign = "center";
      ctx.fillText(screen === "dead" ? "TAP OR CLICK TO PLAY AGAIN" : "TAP OR CLICK TO BEGIN", CX, H - 30);
      ctx.fillStyle = C.dim; ctx.font = "11px Georgia";
      ctx.fillText("Hold to fire eye-lasers  \xB7  Aim at enemies  \xB7  Avoid worshippers", CX, H - 10);
    };
    draw(); const iv = setInterval(draw, 33); return () => clearInterval(iv);
  }, [screen, finalStats, bestScore]);

  useEffect(() => {
    const resize = () => { if (!containerRef.current || !canvasRef.current) return; const s = Math.min(1, (containerRef.current.clientWidth - 16) / W, (window.innerHeight - 50) / H); scaleRef.current = s; canvasRef.current.style.width = W * s + "px"; canvasRef.current.style.height = H * s + "px"; };
    resize(); window.addEventListener("resize", resize); return () => window.removeEventListener("resize", resize);
  }, []);

  return (
    <div ref={containerRef} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: C.bg, fontFamily: "Georgia, serif", userSelect: "none" }}>
      <canvas ref={canvasRef} width={W} height={H} style={{ border: "1px solid rgba(80,70,100,0.2)", borderRadius: 4, cursor: screen === "playing" ? "crosshair" : "pointer", touchAction: "none" }} />
      <div style={{ marginTop: 10, display: "flex", gap: 14, color: C.dim, fontSize: 10, flexWrap: "wrap", justifyContent: "center" }}>
        <span><span style={{ color: C.enemyEye }}>{"\u25CF"}</span> Vaporize</span>
        <span><span style={{ color: C.wealth }}>W</span><span style={{ color: C.health }}>H</span><span style={{ color: C.psych }}>P</span> Spare</span>
        <span><span style={{ color: C.butcherLt }}>{"\u2694"}</span> Dodge + strike stunned</span>
        <span><span style={{ color: C.goldLt }}>777</span> Ascension</span>
        <span>Evolve: MARBLE \u2192 AWAKENED \u2192 CROWNED \u2192 WINGED \u2192 DIVINE</span>
      </div>
    </div>
  );
}
