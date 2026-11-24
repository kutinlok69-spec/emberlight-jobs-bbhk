"use strict";
const app = document.getElementById("app");
const nav = document.getElementById("nav");
if (!window.DATA) {
  app.textContent = "找不到同資料夾的 data.js。";
  throw new Error("no data");
}
const DATA = window.DATA;
const JOB = Object.create(null);
const SKILL = Object.create(null);
const BYJOB = Object.create(null);
for (const j of DATA.jobs) JOB[j.id] = j;
for (const s of DATA.skills) {
  SKILL[s.id] = s;
  (BYJOB[s.job] || (BYJOB[s.job] = [])).push(s);
}
for (const id in BYJOB) BYJOB[id].sort((a, b) => a.slot - b.slot);
const LINES = ["sword", "scout", "mage", "priest", "merchant", "tamer", "performer", "martial"];
const TIER = ["初始", "一轉", "二轉", "三轉"];
const COLS = ["物理攻擊", "魔法攻擊", "自身強化", "輔助"];
const STATN = { str: "力量", agi: "敏捷", vit: "體魄", int: "智力", dex: "靈巧", luk: "幸運" };
const STAT = {
  atk: ["物攻", ""], matk: ["魔攻", ""], atkPct: ["物攻", "%"], matkPct: ["魔攻", "%"],
  hit: ["命中", ""], flee: ["迴避", ""], def: ["物防", ""], defPct: ["物防", "%"], mdef: ["魔防", ""],
  hp: ["生命", ""], hpPct: ["最大生命", "%"], spPct: ["最大魔力", "%"], spRegen: ["魔力回復", ""],
  hpRegen: ["生命回復", ""], crit: ["暴擊率", "%"], critDmg: ["暴擊傷害", "%"], aspdPct: ["攻速", "%"],
  range: ["射程", ""], healPct: ["治療量", "%"], lifesteal: ["吸血", "%"], expPct: ["經驗", "%"],
  dropPct: ["掉寶率", "%"], luk: ["幸運", ""]
};
const KIND = { phys: "物理", magic: "魔法", buff: "增益", heal: "治療", shield: "護盾", summon: "召喚" };
const TARGET = { single: "單體", around: "身邊", aoe: "範圍", line: "直線", chain: "連鎖", self: "自身" };
const KEY = "emberlight-job-sim-v1";

const S = {
  tab: "jobs", line: "", job: "paladin", skillJob: "paladin", skill: "",
  q: "", show: 10, over: 10, lv: 80, a: "paladin", b: "darkknight",
  allocA: {}, allocB: {}
};
S.skill = (BYJOB.paladin && BYJOB.paladin[0].id) || DATA.skills[0].id;

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function r1(v) { return Math.round(Number(v) * 10) / 10; }
function r2(v) { return Math.round(Number(v) * 100) / 100; }
function statText(k, v) {
  if (k === "hpRegen") return "每秒回血 等級×" + r1(v * 0.25);
  const m = STAT[k] || [k, ""];
  return m[0] + " +" + r1(v) + m[1];
}
function kindName(sk) { return sk.type === "passive" ? "被動" : (KIND[sk.kind] || "主動"); }
function colName(sk) { return sk.slot === 8 ? "大招" : (COLS[sk.col] || ""); }
function pathOf(jobId) {
  const out = [];
  let j = JOB[jobId];
  while (j) { out.unshift(j); j = j.parent ? JOB[j.parent] : null; }
  return out;
}
function skillsOf(jobId) {
  const order = pathOf(jobId).map((j) => j.id);
  const list = [];
  for (const id of order) if (BYJOB[id]) list.push(...BYJOB[id]);
  return list;
}
function legalJob(jobId, lv) {
  let j = JOB[jobId];
  while (j && j.tier && lv < DATA.jobLv[j.tier]) j = JOB[j.parent];
  return j;
}
function stayMul(job, lv) {
  const next = DATA.jobLv[job.tier + 1];
  return next && lv >= next ? DATA.stay : 1;
}
function pointsOf(lv, tier) { return Math.max(0, lv - 1) + tier * 3; }
function stepAt(toLv) { return DATA.step[Math.max(0, Math.min(9, toLv - 1))]; }
function sumStep(toLv) {
  let n = 0;
  for (let i = 1; i <= toLv && i <= 10; i++) n += DATA.step[i - 1];
  return n;
}
function costTo(job, charLv, sk, toLv) {
  const mul = stayMul(job, charLv);
  if (job.id === "adventurer") {
    if (mul === 1) return 1;
    return sk.attack ? 1 : DATA.advSupport;
  }
  return stepAt(toLv) * mul;
}
function capOf(job, sk) {
  if (sk.job === "adventurer" && job.id !== "adventurer") return Math.min(sk.maxLv, 10);
  return sk.maxLv > 100 ? 200 : sk.maxLv;
}
function freeIds(jobId) {
  const set = new Set(["adventurer_0"]);
  for (const j of pathOf(jobId)) if (j.tier) set.add(j.first);
  return set;
}
function ensure(alloc, jobId) {
  for (const id of freeIds(jobId)) if ((alloc[id] || 0) < 1) alloc[id] = 1;
}
function spent(job, charLv, alloc) {
  const free = freeIds(job.id);
  let n = 0;
  for (const sk of skillsOf(job.id)) {
    const lv = alloc[sk.id] || 0;
    const start = free.has(sk.id) ? 2 : 1;
    for (let L = start; L <= lv; L++) n += costTo(job, charLv, sk, L);
  }
  return n;
}
function leftPts(job, charLv, alloc) { return pointsOf(charLv, job.tier) - spent(job, charLv, alloc); }
function raiseBlock(job, charLv, alloc, sk) {
  const lv = alloc[sk.id] || 0;
  if (lv + 1 > capOf(job, sk)) return "已經滿級";
  if (charLv < sk.unlock) return "需要角色 Lv." + sk.unlock;
  if (sk.prereq && (alloc[sk.prereq] || 0) < DATA.prereq) return "先把「" + SKILL[sk.prereq].name + "」點到 " + DATA.prereq + " 級";
  const c = costTo(job, charLv, sk, lv + 1);
  const left = leftPts(job, charLv, alloc);
  if (left < c) return "這一級要 " + c + " 點，還差 " + (c - left) + " 點";
  return "";
}
function dropBlock(job, alloc, sk) {
  const lv = alloc[sk.id] || 0;
  const min = freeIds(job.id).has(sk.id) ? 1 : 0;
  if (lv <= min) return min ? "轉職送的 1 級不能退" : "已經是 0";
  if (lv - 1 < DATA.prereq && skillsOf(job.id).some((s) => s.prereq === sk.id && (alloc[s.id] || 0) > 0)) {
    return "下一招已經點了，這招不能低於 " + DATA.prereq + " 級";
  }
  return "";
}
function rowAt(sk, lv) {
  if (lv >= 1 && lv <= 10) return sk.levels[lv - 1];
  const c = sk.curve;
  const sv = (p) => (p ? p[0] + p[1] * (lv - 1) : null);
  const row = { mul: c.mul ? Math.round(sv(c.mul)) : null, sp: c.sp ? Math.round(sv(c.sp)) : null };
  if (c.passive) {
    row.passive = {};
    for (const k in c.passive) row.passive[k] = c.passive[k] * lv;
  }
  if (c.buff) {
    row.buff = { dur: c.buff.dur, stats: {} };
    for (const k in c.buff.stats) row.buff.stats[k] = sv(c.buff.stats[k]);
  }
  if (c.shield) row.shield = sv(c.shield);
  if (c.heal) row.heal = [Math.round(sv(c.heal.base)), sv(c.heal.matk)];
  if (c.pull) row.pull = [c.pull[0] + c.pull[1] * lv, c.pull[2] + c.pull[3] * lv];
  if (c.aura) row.aura = c.aura + 10 * lv;
  if (c.dot) row.dot = Math.round(sv(c.dot));
  return row;
}
function bits(sk, row) {
  const out = [];
  if (row.mul != null) {
    const label = sk.kind === "summon" ? "召喚物攻擊 " + row.mul + "%" : "傷害 " + row.mul + "%";
    out.push(sk.route !== 1 ? label + "（打出去 ×" + sk.route + "）" : label);
  }
  if (row.sp != null) out.push("耗魔 " + row.sp);
  if (sk.spPct) out.push("耗魔 最大魔力 " + sk.spPct + "%");
  if (row.passive) out.push(Object.entries(row.passive).map(([k, v]) => statText(k, v)).join("、"));
  if (row.buff) {
    const parts = Object.entries(row.buff.stats).map(([k, v]) => statText(k, v));
    out.push(row.buff.dur + " 秒 " + parts.join("、"));
  }
  if (row.shield != null) out.push("護盾 " + r1(row.shield) + "% 生命，" + sk.shieldDur + " 秒");
  if (row.heal) out.push("治療 " + row.heal[0] + " ＋ 魔攻×" + r2(row.heal[1]));
  if (row.pull) out.push("範圍 " + row.pull[0] + "，最多 " + row.pull[1] + " 隻");
  if (row.aura) out.push("掛機引怪 " + row.aura);
  if (row.dot) out.push("持續傷害 " + row.dot + "%");
  return out;
}
function descAt(sk, lv) {
  if (Array.isArray(sk.desc)) return sk.desc[Math.max(0, Math.min(9, lv - 1))];
  return sk.desc;
}
function ratioText(r) {
  return Object.entries(STATN).map(([k, name]) => name + " " + (r[k] || 0)).join("、");
}
function passiveSum(job, alloc) {
  const sum = {};
  for (const sk of skillsOf(job.id)) {
    if (sk.type !== "passive") continue;
    const lv = alloc[sk.id] || 0;
    if (!lv) continue;
    const row = rowAt(sk, lv);
    if (!row.passive) continue;
    for (const k in row.passive) sum[k] = (sum[k] || 0) + row.passive[k];
  }
  return sum;
}
function side(which) {
  const jobId = which === "a" ? S.a : S.b;
  const alloc = which === "a" ? S.allocA : S.allocB;
  const legal = legalJob(jobId, S.lv);
  ensure(alloc, legal.id);
  return { which, jobId, alloc, legal, wanted: JOB[jobId] };
}
function packAlloc(which) {
  const s = side(which);
  const free = freeIds(s.legal.id);
  const parts = [];
  for (const sk of skillsOf(s.legal.id)) {
    const lv = s.alloc[sk.id] || 0;
    const base = free.has(sk.id) ? 1 : 0;
    if (lv > base) parts.push(sk.id + "." + lv);
  }
  return parts.join(",");
}
function simHash() {
  return "sim/" + S.lv + "/" + S.a + "/" + S.b + "/" + packAlloc("a") + "/" + packAlloc("b");
}
let lock = false;
function setHash(hash, replace) {
  const next = "#" + hash;
  if (location.hash === next) return;
  lock = true;
  if (replace) history.replaceState(null, "", next);
  else history.pushState(null, "", next);
  lock = false;
}
function saveSim() {
  localStorage.setItem(KEY, JSON.stringify({ lv: S.lv, a: S.a, b: S.b, allocA: S.allocA, allocB: S.allocB }));
  if (S.tab === "sim") setHash(simHash(), true);
}
function applyPack(alloc, text) {
  if (!text) return;
  for (const part of text.split(",")) {
    if (!part) continue;
    const dot = part.lastIndexOf(".");
    const id = part.slice(0, dot);
    const lv = parseInt(part.slice(dot + 1), 10);
    if (SKILL[id] && lv > 0) alloc[id] = Math.min(200, lv);
  }
}
function readHash() {
  const h = location.hash.replace(/^#/, "");
  if (h.startsWith("job/") && JOB[h.slice(4)]) {
    S.tab = "jobs";
    S.job = h.slice(4);
    S.line = JOB[S.job].line || "";
  } else if (h.startsWith("skill/") && SKILL[h.slice(6)]) {
    S.tab = "skills";
    S.skill = h.slice(6);
    S.skillJob = SKILL[S.skill].job;
    S.q = "";
  } else if (h.startsWith("sim/")) {
    const p = h.split("/");
    const lv = parseInt(p[1], 10);
    if (lv >= 1 && lv <= 150) S.lv = lv;
    if (JOB[p[2]]) S.a = p[2];
    if (JOB[p[3]]) S.b = p[3];
    S.allocA = {};
    S.allocB = {};
    applyPack(S.allocA, p[4] || "");
    applyPack(S.allocB, p[5] || "");
    S.tab = "sim";
  } else if (h === "skills" || h === "jobs" || h === "sim") S.tab = h;
}
function loadStore() {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!o) return;
    if (JOB[o.a]) S.a = o.a;
    if (JOB[o.b]) S.b = o.b;
    if (o.lv >= 1 && o.lv <= 150) S.lv = o.lv;
    if (o.allocA) S.allocA = o.allocA;
    if (o.allocB) S.allocB = o.allocB;
  } catch (e) { /* 壞掉的存檔就略過 */ }
}

function jobOptions(sel) {
  let html = "";
  html += "<option value=\"adventurer\"" + (sel === "adventurer" ? " selected" : "") + ">冒險者</option>";
  for (const line of LINES) {
    const jobs = DATA.jobs.filter((j) => j.line === line);
    html += "<optgroup label=\"" + esc(jobs[0].lineName) + "\">";
    for (const j of jobs) html += "<option value=\"" + j.id + "\"" + (j.id === sel ? " selected" : "") + ">" + esc(TIER[j.tier] + " " + j.name) + "</option>";
    html += "</optgroup>";
  }
  return html;
}
function playTag(j) {
  if (!j.play) return "";
  return "<span class=\"tag " + esc(j.play) + "\">" + esc(j.playName) + "</span>";
}
function navHTML() {
  const tabs = [["jobs", "職業"], ["skills", "技能"], ["sim", "轉職模擬"]];
  return tabs.map(([id, name]) => "<button type=\"button\" data-tab=\"" + id + "\" class=\"" + (S.tab === id ? "on" : "") + "\">" + name + "</button>").join("");
}

function viewJobs() {
  const lines = S.line ? [S.line] : LINES;
  const chips = ["<button type=\"button\" data-line=\"\" class=\"" + (S.line ? "" : "on") + "\">全部</button>"];
  for (const id of LINES) {
    const name = DATA.jobs.find((j) => j.line === id).lineName;
    chips.push("<button type=\"button\" data-line=\"" + id + "\" class=\"" + (S.line === id ? "on" : "") + "\">" + esc(name) + "</button>");
  }
  let cards = "";
  const showAdv = !S.line;
  if (showAdv) {
    const a = JOB.adventurer;
    cards += "<button type=\"button\" class=\"card" + (S.job === "adventurer" ? " on" : "") + "\" data-job=\"adventurer\" style=\"border-top-color:" + a.color + "\"><b>" + esc(a.name) + "</b><span>" + esc(a.role) + "</span></button>";
  }
  for (const line of lines) {
    for (const j of DATA.jobs.filter((x) => x.line === line)) {
      cards += "<button type=\"button\" class=\"card" + (S.job === j.id ? " on" : "") + "\" data-job=\"" + j.id + "\" style=\"border-top-color:" + j.color + "\"><b>" + esc(j.name) + "</b><span>" + esc(TIER[j.tier] + " · " + j.role) + "</span>" + playTag(j) + "</button>";
    }
  }
  return "<div class=\"chips\">" + chips.join("") + "</div><div class=\"grid\">" + cards + "</div>" + jobDetail(JOB[S.job]);
}
function jobDetail(j) {
  if (!j) return "";
  const kids = j.children.map((id) => "<button type=\"button\" class=\"btn tiny\" data-job=\"" + id + "\">" + esc(JOB[id].name) + "</button>").join("");
  const parent = j.parent ? "<button type=\"button\" class=\"btn tiny\" data-job=\"" + j.parent + "\">" + esc(JOB[j.parent].name) + "</button>" : "";
  const skills = (BYJOB[j.id] || []).map((sk) => "<button type=\"button\" class=\"btn tiny\" data-openskill=\"" + sk.id + "\">" + esc(sk.name) + "</button>").join("");
  const trial = j.tier ? "" : "";
  const req = j.tier ? "Lv." + DATA.jobLv[j.tier] + "，先打 " + trialLine(j.tier) + "，再打一場試煉。失敗不罰。" : "不轉職可以繼續當冒險者。10 級之後經驗和技能點需求變 3 倍。";
  const rows = [
    ["定位", j.role],
    ["武器", j.weapons.join("、") || "全部"],
    ["防具", j.armor || "全部"],
    ["距離", j.reachName],
    ["血量", "×" + j.hp],
    ["魔力", "×" + j.sp],
    ["基礎攻速", "×" + j.aspd],
    ["仇恨", "×" + j.threat],
    ["轉職加成", "物攻 +" + j.bonus.atk + "%、生命 +" + j.bonus.hp + "%"],
    ["戰力係數", String(j.powerK)],
    ["建議配點", ratioText(j.ratio)],
    ["主攻擊", j.magic ? "魔法，吃智力" : "物理"]
  ];
  return "<article class=\"panel\" id=\"detail\"><h2 style=\"color:" + j.color + "\">" + esc(j.name) + " <span class=\"muted\">" + esc(j.en) + " · " + esc(TIER[j.tier]) + (j.lineName ? " · " + esc(j.lineName) : "") + "</span></h2>"
    + "<p>" + esc(j.gimmick) + "</p>"
    + (j.playName ? "<p>" + playTag(j) + " " + esc(j.playDesc) + (j.playTip ? "<br>" + esc(j.playTip) : "") + "</p>" : "")
    + "<p class=\"muted\">" + esc(j.reachTip) + "</p>"
    + "<div class=\"kv\">" + rows.map(([k, v]) => "<div><b>" + esc(k) + "</b><br>" + esc(v) + "</div>").join("") + "</div>"
    + (j.armorDesc ? "<p class=\"muted\">" + esc(j.armorDesc) + "</p>" : "")
    + "<p><b>轉職條件。</b>" + esc(req) + "</p>"
    + "<p class=\"muted\">過了下一階的等級還沒轉，經驗和技能升級點數都變成 3 倍。正式轉職會保留已學的技能，技能點 +3，並學會新職業的第一招。</p>"
    + "<h3 class=\"sec\">這一階的技能</h3><div class=\"rowbtns\">" + skills + "</div>"
    + "<p class=\"muted\">角色會連同前面每一階的技能一起帶著。點技能看 1 到 10 級的數字。</p>"
    + (parent || kids ? "<h3 class=\"sec\">路線</h3><div class=\"rowbtns\">" + parent + kids + "</div>" : "")
    + "</article>";
}
function trialLine(tier) {
  const t = DATA.trials[tier];
  const bits = [t[0] + " 隻怪"];
  if (t[1]) bits.push(t[1] + " 隻菁英");
  if (t[2]) bits.push(t[2] + " 隻首領");
  return bits.join("、");
}

function viewSkills() {
  const q = S.q.trim();
  const jobs = jobOptions(S.skillJob);
  let body;
  if (q) {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const hits = DATA.skills.filter((sk) => {
      const blob = (sk.name + " " + JOB[sk.job].name + " " + kindName(sk) + " " + (Array.isArray(sk.desc) ? sk.desc[0] : sk.desc)).toLowerCase();
      return words.every((w) => blob.includes(w));
    });
    const shown = hits.slice(0, 80).map((sk) => "<button type=\"button\" class=\"hit\" data-openskill=\"" + sk.id + "\"><b>" + esc(sk.name) + "</b><span class=\"muted\">" + esc(JOB[sk.job].name) + " · " + esc(TIER[JOB[sk.job].tier]) + " · " + esc(colName(sk)) + " · " + esc(kindName(sk)) + "</span></button>").join("");
    body = "<p class=\"muted\">找到 " + hits.length + " 招" + (hits.length > 80 ? "，先列 80 招" : "") + "</p><div class=\"hits\">" + (shown || "<p>沒有符合的技能。</p>") + "</div>";
  } else body = skillTree(S.skillJob);
  const sk = !q && SKILL[S.skill] && SKILL[S.skill].job === S.skillJob ? SKILL[S.skill] : null;
  return "<div class=\"tools\"><input id=\"q\" type=\"search\" placeholder=\"搜技能、職業、說明\" value=\"" + esc(S.q) + "\" autocomplete=\"off\"><select id=\"skillJob\" aria-label=\"職業\">" + jobs + "</select></div>" + body + (sk ? skillDetail(sk) : "");
}
function skillTree(jobId) {
  const path = pathOf(jobId);
  const tabs = path.map((j) => "<button type=\"button\" class=\"btn tiny" + (j.id === jobId ? " on" : "") + "\" data-skilljob=\"" + j.id + "\">" + esc(TIER[j.tier] + " " + j.name) + "</button>").join("");
  const list = BYJOB[jobId] || [];
  const head = COLS.map((c) => "<div class=\"muted\">" + c + "</div>").join("");
  let cells = "";
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 4; col++) {
      const sk = list[col * 2 + row];
      cells += sk ? nodeBtn(sk) : "<div></div>";
    }
  }
  const ult = list[8] ? "<div class=\"ult\">" + nodeBtn(list[8]) + "</div>" : "";
  return "<div class=\"rowbtns\" style=\"margin-bottom:8px\">" + tabs + "</div><div class=\"tree-wrap\"><div class=\"tree\">" + head + cells + "</div></div>" + ult
    + "<p class=\"muted\">每欄下面那招，要先把上面那招學到 " + DATA.prereq + " 級。大招不占技能列的 6 格。</p>";
}
function nodeBtn(sk) {
  const on = sk.id === S.skill ? " on" : "";
  return "<button type=\"button\" class=\"node" + on + "\" data-openskill=\"" + sk.id + "\"><b>" + esc(sk.name) + "</b><small>" + esc(kindName(sk)) + " · Lv." + sk.unlock + "</small></button>";
}
function skillDetail(sk) {
  const job = JOB[sk.job];
  const lv = sk.job === "adventurer" ? Math.max(1, Math.min(100, S.over || S.show)) : Math.max(1, Math.min(10, S.show));
  const row = rowAt(sk, lv);
  const meta = [];
  meta.push(colName(sk), kindName(sk));
  if (sk.elemName) meta.push(sk.elemName + "屬性");
  if (sk.pull) meta.push("引怪");
  else if (TARGET[sk.target]) meta.push(TARGET[sk.target]);
  if (sk.hits > 1) meta.push(sk.hits + " 段");
  if (sk.cd != null) meta.push("冷卻 " + sk.cd + " 秒");
  if (sk.range != null) meta.push("射程 " + sk.range);
  if (sk.radius != null && !sk.pull) meta.push("半徑 " + sk.radius);
  if (sk.gold) meta.push("金幣 等級×" + sk.gold);
  if (sk.crit) meta.push("暴擊率 +" + sk.crit + "%");
  if (sk.leech) meta.push("吸取傷害 " + sk.leech + "%");
  if (sk.stun) meta.push("暈眩 " + sk.stun + " 秒");
  if (sk.slow) meta.push("緩速 " + sk.slow + "%");
  if (sk.taunt) meta.push("嘲諷");
  if (sk.charm) meta.push("走到身邊後定住 " + sk.charm + " 秒");
  if (sk.party) meta.push("影響附近隊友");
  if (sk.partyJobs && sk.partyJobs.length) meta.push("全隊效果只限 " + sk.partyJobs.map((id) => JOB[id].name).join("、"));
  if (sk.revive) meta.push(sk.revivePct ? "復活，回 " + Math.round(sk.revivePct * 100) + "% 生命" : "可復活隊友");
  if (sk.petHeal) meta.push("也治療自己的召喚物");
  if (sk.follow) meta.push("傷害類型跟著配點，物攻較高打物理，魔攻較高打魔法");
  meta.push("角色 Lv." + sk.unlock + " 解鎖");
  if (sk.prereq) meta.push("前置：" + SKILL[sk.prereq].name + " " + DATA.prereq + " 級");
  const rows = [];
  const maxRow = sk.job === "adventurer" ? Math.max(10, lv) : 10;
  for (let i = 1; i <= Math.min(10, maxRow); i++) rows.push(levelTr(sk, i, lv));
  if (lv > 10) rows.push(levelTr(sk, lv, lv));
  const advNote = sk.job === "adventurer"
    ? "<p class=\"muted\">轉職之後這招最高 10 級，點數跟別的招一樣，從 0 點滿是 17 點。留在冒險者且等級已到 10：攻擊招每級 1 點，輔助和被動每級 " + DATA.advSupport + " 點，沒有上限。10 級之前每級都是 1 點。</p>"
      + "<label>看到第 <input id=\"over\" type=\"number\" min=\"1\" max=\"100\" value=\"" + lv + "\"> 級（超過 10 級照公式往上加）</label>"
    : "<p class=\"muted\">點數是已經轉職的算法：1 到 5 級每級 1 點，6 到 8 級每級 2 點，9 到 10 級每級 3 點，從 0 點滿要 17 點。過了下一階還沒轉，每一級再乘 3。</p>";
  const route = sk.route !== 1 ? "<p class=\"note\">這招實際打出去時，傷害再乘 " + sk.route + "。表上的百分比是乘之前的數字。</p>" : "";
  const passiveNote = sk.type === "passive" ? "<p class=\"muted\">表上是該等級的合計。說明裡寫「／級」的，是每一級的增量。</p>" : "";
  return "<article class=\"panel\" id=\"detail\"><h2>" + esc(sk.name) + " <span class=\"muted\">" + esc(job.name) + "</span></h2>"
    + "<p>" + esc(descAt(sk, lv)).replace(/\n/g, "<br>") + "</p>"
    + "<p class=\"muted\">" + esc(meta.filter(Boolean).join(" · ")) + "</p>"
    + route + passiveNote + advNote
    + "<div class=\"tree-wrap\"><table><thead><tr><th>等級</th><th>這級點數</th><th>累計</th>" + (sk.job === "adventurer" ? "<th>超級冒險者累計</th>" : "") + "<th>這個等級的數字</th></tr></thead><tbody>"
    + rows.join("") + "</tbody></table></div></article>";
}
function levelTr(sk, i, sel) {
  const row = rowAt(sk, i);
  const cost = i <= 10 ? DATA.step[i - 1] : (sk.attack ? 1 : DATA.advSupport);
  const sum = i <= 10 ? sumStep(i) : "";
  const sup = sk.attack ? i : i * DATA.advSupport;
  return "<tr class=\"click" + (i === sel ? " sel" : "") + "\" data-show=\"" + i + "\"><td>" + i + "</td><td>" + cost + "</td><td>" + sum + "</td>"
    + (sk.job === "adventurer" ? "<td>" + sup + "</td>" : "")
    + "<td>" + esc(bits(sk, row).join("；") || "—") + "</td></tr>";
}

function viewSim() {
  const A = side("a");
  const B = side("b");
  const lv = S.lv;
  return "<div class=\"panel\"><div class=\"lvbox\"><label>等級 <input id=\"lv\" type=\"number\" min=\"1\" max=\"150\" value=\"" + lv + "\"></label>"
    + "<input id=\"lvRange\" type=\"range\" min=\"1\" max=\"150\" value=\"" + lv + "\" aria-label=\"等級\">"
    + "<button type=\"button\" class=\"btn\" data-swap>左右對調</button>"
    + "<button type=\"button\" class=\"btn\" id=\"copy\">複製這頁連結</button></div>"
    + "<p class=\"muted\" id=\"copyMsg\"></p>"
    + ruleBox(A, B) + "</div>"
    + "<div class=\"cmp\" style=\"margin-top:12px\">" + simCol(A, "路線 A") + simCol(B, "路線 B") + "</div>"
    + compare(A, B);
}
function ruleBox(A, B) {
  const ta = A.legal.tier;
  const tb = B.legal.tier;
  let ticket;
  if (ta < 1 || tb < 1) ticket = "一轉之後才能用轉職券。";
  else if (ta !== tb) ticket = "以現在的等級，兩邊實際是 " + TIER[ta] + " 和 " + TIER[tb] + "。轉職券只能換成同樣轉數，這組只能對照。";
  else ticket = "轉職券可以把 " + TIER[ta] + " 整條換成另一條 " + TIER[ta] + "。技能點和能力點全部退回，只留下新路線每一轉的第一招 1 級。等級、經驗、裝備和強化、寵物、外觀、稱號留著。身上的裝備會先脫到背包。換完 7 天不能再換，鑽石商城那張是 " + DATA.ticket + " 鑽。";
  return "<details class=\"note\" open><summary>正式轉職留技能。轉職券會把點數全部退回，技能重點。</summary>"
    + "<p>10／50／80 的正式轉職會留下已經學的技能，技能點 +3，並學會新職業第一招。</p>"
    + "<p>" + esc(ticket) + "</p>"
    + "<p>技能點 ＝（等級 − 1）＋ 轉數 × 3。150 級三轉是 158 點。奮力一擊和每一轉的第一招，1 級不扣點。</p>"
    + (stayMul(A.legal, S.lv) > 1 || stayMul(B.legal, S.lv) > 1 ? "<p class=\"bad\">有一邊已經過了下一階的等級還沒轉，那邊的技能升級點數是 3 倍。</p>" : "")
    + "</details>";
}
function simCol(s, title) {
  const job = s.legal;
  const want = s.wanted;
  const total = pointsOf(S.lv, job.tier);
  const used = spent(job, S.lv, s.alloc);
  const left = total - used;
  const warn = want.id !== job.id ? "<p class=\"bad\">選的是 " + esc(want.name) + "，要 Lv." + DATA.jobLv[want.tier] + "。以 Lv." + S.lv + "，這條路實際是 " + esc(job.name) + "。</p>" : "";
  const pen = stayMul(job, S.lv) > 1 ? "<p class=\"bad\">已到 Lv." + DATA.jobLv[job.tier + 1] + " 還沒轉，技能點需求 ×" + DATA.stay + "。</p>" : "";
  const groups = pathOf(job.id).map((j) => skillGroup(s, j)).join("");
  const future = want.id !== job.id ? futureList(want, job) : "";
  return "<section class=\"panel\"><h2>" + esc(title) + "</h2>"
    + "<select id=\"pick" + s.which + "\" aria-label=\"" + esc(title) + "\">" + jobOptions(want.id) + "</select>"
    + warn + pen
    + "<p class=\"remain\">剩餘 <b class=\"" + (left < 0 ? "bad" : "good") + "\">" + left + "</b> <span class=\"muted\">／ " + total + "，已用 " + used + "</span></p>"
    + "<div class=\"rowbtns\"><button type=\"button\" class=\"btn tiny\" data-clear=\"" + s.which + "\">只留免費技能</button>"
    + "<button type=\"button\" class=\"btn tiny\" data-fill=\"" + s.which + "\">先點最終職業的主攻和被動</button></div>"
    + "<p class=\"muted\">" + esc(job.name) + " · 血量 ×" + job.hp + " · 魔力 ×" + job.sp + " · 攻速 ×" + job.aspd + " · " + esc(job.weapons.join("、") || "全部武器") + "</p>"
    + groups + future + learnedList(s) + "</section>";
}
function skillGroup(s, j) {
  const rows = (BYJOB[j.id] || []).map((sk) => skillRow(s, sk)).join("");
  return "<h3 class=\"sec\">" + esc(TIER[j.tier] + " " + j.name) + "</h3>" + rows;
}
function skillRow(s, sk) {
  const lv = s.alloc[sk.id] || 0;
  const up = raiseBlock(s.legal, S.lv, s.alloc, sk);
  const down = dropBlock(s.legal, s.alloc, sk);
  const next = lv < capOf(s.legal, sk) ? costTo(s.legal, S.lv, sk, lv + 1) : 0;
  const free = freeIds(s.legal.id).has(sk.id);
  return "<div class=\"sk\"><div class=\"nm\"><b>" + esc(sk.name) + "</b><span class=\"muted\">" + esc(colName(sk)) + " · " + esc(kindName(sk))
    + (free && lv >= 1 ? " · 1 級免費" : "")
    + (up && lv === 0 ? " · " + esc(up) : "")
    + (down && lv > 0 ? "" : "")
    + "</span></div><div class=\"ops\"><button type=\"button\" class=\"btn tiny\" data-down=\"" + sk.id + "\" data-side=\"" + s.which + "\"" + (down ? " disabled title=\"" + esc(down) + "\"" : "") + ">−</button><b>" + lv + "</b>"
    + "<button type=\"button\" class=\"btn tiny\" data-up=\"" + sk.id + "\" data-side=\"" + s.which + "\"" + (up ? " disabled title=\"" + esc(up) + "\"" : "") + ">+</button>"
    + "<button type=\"button\" class=\"btn tiny\" data-max=\"" + sk.id + "\" data-side=\"" + s.which + "\"" + (up ? " disabled" : "") + ">滿</button>"
    + "<span class=\"muted\">" + (next ? "下一級 " + next + " 點" : "") + "</span></div></div>";
}
function futureList(want, legal) {
  const extra = [];
  let j = want;
  while (j && j.id !== legal.id) { extra.unshift(j); j = JOB[j.parent]; }
  if (!extra.length) return "";
  const rows = extra.map((j) => "<p><b>" + esc(TIER[j.tier] + " " + j.name) + "</b> <span class=\"muted\">Lv." + DATA.jobLv[j.tier] + " 才出現：" + esc((BYJOB[j.id] || []).map((sk) => sk.name).join("、")) + "</span></p>").join("");
  return "<h3 class=\"sec\">等級到了才會有</h3>" + rows;
}
function learnedList(s) {
  const lines = [];
  for (const sk of skillsOf(s.legal.id)) {
    const lv = s.alloc[sk.id] || 0;
    if (!lv) continue;
    const text = bits(sk, rowAt(sk, lv)).join("；");
    lines.push("<div><b>" + esc(sk.name) + "</b> Lv." + lv + " <span class=\"muted\">" + esc(text) + "</span></div>");
  }
  const pass = passiveSum(s.legal, s.alloc);
  const passText = Object.entries(pass).map(([k, v]) => statText(k, v)).join("、");
  return "<h3 class=\"sec\">目前這組</h3>" + (lines.join("") || "<p class=\"muted\">還沒有技能。</p>")
    + (passText ? "<p>常駐被動合計：<span class=\"good\">" + esc(passText) + "</span></p>" : "");
}
function compare(A, B) {
  const rows = [
    ["實際職業", A.legal.name, B.legal.name],
    ["血量", "×" + A.legal.hp, "×" + B.legal.hp],
    ["魔力", "×" + A.legal.sp, "×" + B.legal.sp],
    ["基礎攻速", "×" + A.legal.aspd, "×" + B.legal.aspd],
    ["仇恨", "×" + A.legal.threat, "×" + B.legal.threat],
    ["轉職加成", "物攻 +" + A.legal.bonus.atk + "%、生命 +" + A.legal.bonus.hp + "%", "物攻 +" + B.legal.bonus.atk + "%、生命 +" + B.legal.bonus.hp + "%"],
    ["戰力係數", String(A.legal.powerK), String(B.legal.powerK)],
    ["武器", A.legal.weapons.join("、") || "全部", B.legal.weapons.join("、") || "全部"],
    ["防具", A.legal.armor || "全部", B.legal.armor || "全部"],
    ["距離", A.legal.reachName, B.legal.reachName],
    ["玩法", A.legal.playName || "要看三轉", B.legal.playName || "要看三轉"],
    ["建議配點", ratioText(A.legal.ratio), ratioText(B.legal.ratio)],
    ["技能點剩餘", String(leftPts(A.legal, S.lv, A.alloc)), String(leftPts(B.legal, S.lv, B.alloc))]
  ];
  const pa = passiveSum(A.legal, A.alloc);
  const pb = passiveSum(B.legal, B.alloc);
  const keys = [...new Set([...Object.keys(pa), ...Object.keys(pb)])];
  for (const k of keys) {
    const unit = STAT[k] ? STAT[k][1] || "點" : "";
    const name = "被動" + (STAT[k] ? STAT[k][0] : k) + unit;
    rows.push([name, pa[k] ? statText(k, pa[k]) : "—", pb[k] ? statText(k, pb[k]) : "—"]);
  }
  const body = rows.map((r) => {
    const diff = r[1] !== r[2];
    return "<tr" + (diff ? " class=\"diff\"" : "") + "><th>" + esc(r[0]) + "</th><td>" + esc(r[1]) + "</td><td>" + esc(r[2]) + "</td></tr>";
  }).join("");
  return "<article class=\"panel\"><h2>對照</h2><p class=\"muted\">戰力係數只改畫面上的戰力和競技場，不改打怪傷害。這裡沒有把裝備、等級屬性算進每秒傷害。</p>"
    + "<div class=\"tree-wrap\"><table><thead><tr><th></th><th>" + esc(A.legal.name) + "</th><th>" + esc(B.legal.name) + "</th></tr></thead><tbody>" + body + "</tbody></table></div></article>";
}

function fillMain(which) {
  const s = side(which);
  for (const k of Object.keys(s.alloc)) delete s.alloc[k];
  ensure(s.alloc, s.legal.id);
  const list = skillsOf(s.legal.id);
  const col = s.legal.magic ? 1 : 0;
  const pri = [];
  pri.push(...list.filter((sk) => sk.job === s.legal.id && sk.col === col && sk.attack));
  pri.push(...list.filter((sk) => sk.job === s.legal.id && sk.type === "passive"));
  pri.push(...list.filter((sk) => sk.job !== s.legal.id && sk.col === col && sk.attack));
  for (const sk of pri) {
    while (!raiseBlock(s.legal, S.lv, s.alloc, sk)) s.alloc[sk.id] = (s.alloc[sk.id] || 0) + 1;
  }
}
function clearSide(which) {
  const s = side(which);
  for (const k of Object.keys(s.alloc)) delete s.alloc[k];
  ensure(s.alloc, s.legal.id);
}
function bump(which, id, dir) {
  const s = side(which);
  const sk = SKILL[id];
  if (!sk || !skillsOf(s.legal.id).some((x) => x.id === id)) return;
  if (dir > 0) {
    if (raiseBlock(s.legal, S.lv, s.alloc, sk)) return;
    s.alloc[id] = (s.alloc[id] || 0) + 1;
  } else if (dir < 0) {
    if (dropBlock(s.legal, s.alloc, sk)) return;
    s.alloc[id] = (s.alloc[id] || 0) - 1;
  } else {
    while (!raiseBlock(s.legal, S.lv, s.alloc, sk)) s.alloc[id] = (s.alloc[id] || 0) + 1;
  }
}

function view() {
  if (S.tab === "skills") return viewSkills();
  if (S.tab === "sim") return viewSim();
  return viewJobs();
}
function render(opt) {
  const ae = document.activeElement;
  const id = ae && ae.id;
  const start = ae && ae.selectionStart;
  const end = ae && ae.selectionEnd;
  nav.innerHTML = navHTML();
  app.innerHTML = view();
  if (id) {
    const el = document.getElementById(id);
    if (el) {
      el.focus();
      if (typeof start === "number" && el.setSelectionRange) {
        try { el.setSelectionRange(start, end); } catch (e) { /* 數字欄沒有選取範圍 */ }
      }
    }
  }
  if (opt && opt.scroll) document.getElementById("detail")?.scrollIntoView({ block: "start" });
}
function onClick(e) {
  const t = e.target.closest("[data-tab],[data-line],[data-job],[data-openskill],[data-skilljob],[data-show],[data-up],[data-down],[data-max],[data-clear],[data-fill],[data-swap],#copy");
  if (!t) return;
  if (t.dataset.tab) {
    S.tab = t.dataset.tab;
    setHash(S.tab === "sim" ? simHash() : S.tab, false);
    render();
    return;
  }
  if (t.dataset.line !== undefined && t.hasAttribute("data-line")) {
    S.line = t.dataset.line;
    render();
    return;
  }
  if (t.dataset.job) {
    S.job = t.dataset.job;
    S.line = JOB[S.job].line || S.line;
    S.tab = "jobs";
    setHash("job/" + S.job, false);
    render({ scroll: true });
    return;
  }
  if (t.dataset.openskill) {
    S.skill = t.dataset.openskill;
    S.skillJob = SKILL[S.skill].job;
    S.show = 10;
    S.over = 10;
    S.q = "";
    S.tab = "skills";
    setHash("skill/" + S.skill, false);
    render({ scroll: true });
    return;
  }
  if (t.dataset.skilljob) {
    S.skillJob = t.dataset.skilljob;
    S.skill = (BYJOB[S.skillJob] || [])[0].id;
    render();
    return;
  }
  if (t.dataset.show) {
    S.show = parseInt(t.dataset.show, 10);
    S.over = S.show;
    render();
    return;
  }
  if (t.dataset.up || t.dataset.down || t.dataset.max) {
    const id = t.dataset.up || t.dataset.down || t.dataset.max;
    const dir = t.dataset.up ? 1 : t.dataset.down ? -1 : 0;
    bump(t.dataset.side, id, dir);
    saveSim();
    render();
    return;
  }
  if (t.dataset.clear) { clearSide(t.dataset.clear); saveSim(); render(); return; }
  if (t.dataset.fill) { fillMain(t.dataset.fill); saveSim(); render(); return; }
  if (t.hasAttribute("data-swap")) {
    const job = S.a; S.a = S.b; S.b = job;
    const al = S.allocA; S.allocA = S.allocB; S.allocB = al;
    saveSim();
    render();
    return;
  }
  if (t.id === "copy") {
    const url = location.href;
    navigator.clipboard.writeText(url).then(() => {
      const m = document.getElementById("copyMsg");
      if (m) m.textContent = "已複製。把連結貼到公會頻道就能打開同一組配置。";
    }).catch(() => {
      const m = document.getElementById("copyMsg");
      if (m) m.textContent = url;
    });
  }
}
function onChange(e) {
  const t = e.target;
  if (t.id === "skillJob") {
    S.skillJob = t.value;
    S.skill = (BYJOB[S.skillJob] || [])[0].id;
    S.q = "";
    render();
    return;
  }
  if (t.id === "picka" || t.id === "pickb") {
    const which = t.id === "picka" ? "a" : "b";
    S[which] = t.value;
    saveSim();
    render();
    return;
  }
  if (t.id === "lv" || t.id === "lvRange") {
    const n = Math.max(1, Math.min(150, parseInt(t.value, 10) || 1));
    S.lv = n;
    saveSim();
    render();
    return;
  }
  if (t.id === "over") {
    S.over = Math.max(1, Math.min(100, parseInt(t.value, 10) || 1));
    S.show = S.over;
    render();
  }
}
let composing = false;
app.addEventListener("compositionstart", () => { composing = true; });
app.addEventListener("compositionend", (e) => {
  composing = false;
  if (e.target.id === "q") { S.q = e.target.value; render(); }
});
function onInput(e) {
  if (e.target.id === "q") {
    if (composing) return;
    S.q = e.target.value;
    render();
    return;
  }
  if (e.target.id === "lvRange") {
    const label = document.getElementById("lv");
    if (label) label.value = e.target.value;
  }
}
document.getElementById("ver").textContent = "客戶端 " + DATA.version + " · " + DATA.captured + " · 57 職 · " + DATA.skills.length + " 招";
document.getElementById("foot").textContent = "數字來自 emberlight.isekaifish.com 的遊戲客戶端，不是官方工具。遊戲改版以後若跟遊戲裡的技能說明不同，以遊戲內為準。";
app.addEventListener("click", onClick);
app.addEventListener("change", onChange);
app.addEventListener("input", onInput);
nav.addEventListener("click", onClick);
loadStore();
if (location.hash) readHash();
ensure(S.allocA, legalJob(S.a, S.lv).id);
ensure(S.allocB, legalJob(S.b, S.lv).id);
window.addEventListener("hashchange", () => { readHash(); render(); });
window.addEventListener("popstate", () => { readHash(); render(); });
render();