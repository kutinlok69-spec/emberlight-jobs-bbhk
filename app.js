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
  allocA: {}, allocB: {}, wjob: "all", wid: "", ref: 0,
  capAspd: 3.2, capLv: 80, capHit: 0, capKind: "melee", capCrit: 40, capRank: "boss",
  stLv: 80, stJob: "paladin",
  pts: { str: 5, agi: 5, vit: 5, int: 5, dex: 5, luk: 5 },
  rfFrom: 6, rfTo: 10, rfTier: 9, rfKind: "weapon", rfBless: false, rfDust: false, rfCharm: "none",
  afTier: 9, afLocks: 0, afDeep: false, afRarity: 3,
  setTier: 9, setRarity: 4, setCount: 8, setRef: 9
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
  } else if (h === "gear" || h.startsWith("gear/")) {
    S.tab = "gear";
    const id = h.slice(5);
    if (id && window.WEAPONS && WEAPONS.weapons.some((w) => w.id === id)) S.wid = id;
  } else if (h === "skills" || h === "jobs" || h === "sim" || h === "gear" || h === "caps" || h === "stats" || h === "refine" || h === "drops" || h === "patch" || h === "affix" || h === "set") S.tab = h;
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
  const tabs = [["jobs", "職業"], ["skills", "技能"], ["sim", "轉職模擬"], ["gear", "首領武器"], ["caps", "封頂"], ["stats", "配點"], ["refine", "強化機率"], ["drops", "掉落"], ["patch", "更新"], ["affix", "洗鍊"], ["set", "套裝"]];
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
    + "<div class=\"rowbtns\"><button type=\"button\" class=\"btn tiny\" data-gearjob=\"" + j.id + "\">這個職業的首領武器</button></div>"
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

function weaponsFor(jobId) {
  const list = (window.WEAPONS && WEAPONS.weapons) || [];
  if (!jobId || jobId === "all") return list;
  const job = JOB[jobId];
  if (!job || job.id === "adventurer") return list;
  const ok = new Set(job.weapons || []);
  return list.filter((w) => ok.has(w.fam));
}
function pctText(x) {
  const n = Math.round(x * 10000) / 100;
  return String(n).replace(/\.0$/, "").replace(/(\.\d)0$/, "$1");
}
function goldText(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
function gearLine(k, v) {
  if (STATN[k]) return STATN[k] + " +" + v;
  if (k === "sp") return "魔力 +" + v;
  if (k === "atk" || k === "matk") return (STAT[k] ? STAT[k][0] : k) + " " + v;
  if (STAT[k]) return STAT[k][0] + " +" + r1(v) + STAT[k][1];
  return k + " " + v;
}
function gearBits(stats) {
  const order = ["atk", "matk", "hp", "sp", "def", "mdef", "str", "agi", "vit", "int", "dex", "luk", "hit", "flee", "crit", "critDmg", "aspdPct", "expPct", "dropPct"];
  return order.filter((k) => stats[k]).map((k) => gearLine(k, stats[k]));
}
function viewGear() {
  if (!window.WEAPONS) return "<p>找不到首領武器資料。</p>";
  const ref = Math.max(0, Math.min(WEAPONS.max, S.ref || 0));
  const list = weaponsFor(S.wjob);
  const w = list.find((x) => x.id === S.wid) || list[0];
  const opts = "<option value=\"all\"" + (S.wjob === "all" ? " selected" : "") + ">全部職業</option>" + jobOptions(S.wjob === "all" ? "" : S.wjob);
  const cards = list.map((x) => {
    const on = w && x.id === w.id ? " on" : "";
    const st = x.levels[ref].stats;
    return "<button type=\"button\" class=\"card" + on + "\" data-wid=\"" + x.id + "\"><b>" + esc(x.name) + "</b><span>" + esc(x.fam) + " · " + esc(x.mapName) + "</span><span>物攻 " + (st.atk || 0) + (st.matk ? " · 魔攻 " + st.matk : "") + "</span></button>";
  }).join("");
  return "<div class=\"panel\"><div class=\"lvbox\"><label>職業 <select id=\"wjob\" aria-label=\"職業\">" + opts + "</select></label>"
    + "<label>強化 <input id=\"ref\" type=\"number\" min=\"0\" max=\"" + WEAPONS.max + "\" value=\"" + ref + "\"></label>"
    + "<input id=\"refRange\" type=\"range\" min=\"0\" max=\"" + WEAPONS.max + "\" value=\"" + ref + "\" aria-label=\"強化等級\">"
    + "<b id=\"refLive\">+" + ref + "</b></div>"
    + "<p class=\"muted\">數字是" + esc(WEAPONS.rarity) + "品質，首領掉出來就是這個品質。武器每強化 1 級，物攻和魔攻 +" + Math.round(WEAPONS.per * 100) + "%。詞條不加這一段。+6 以內一定成功。+7 起失敗會碎，除非用防爆符。+9 起另外加最後攻擊，乘在算出來的物攻和魔攻外面。</p></div>"
    + (cards ? "<div class=\"grid\" style=\"margin-top:12px\">" + cards + "</div>" : "<p>這個職業沒有對應的首領武器。</p>")
    + (w ? weaponDetail(w, ref) : "");
}
function weaponDetail(w, ref) {
  const lv = w.levels[ref];
  const users = DATA.jobs.filter((j) => j.id !== "adventurer" && (j.weapons || []).includes(w.fam)).map((j) => j.name);
  const rows = w.levels.map((row, i) => {
    const risk = i >= WEAPONS.safe ? "失敗會碎" : "一定成功";
    const step = i < WEAPONS.max ? "升到 +" + (i + 1) + "：" + pctText(row.nextRate) + "%，" + goldText(row.nextCost) + " 金幣，" + risk : "已滿";
    return "<tr class=\"" + (i === ref ? "sel" : "") + "\"><td>+" + i + "</td><td>" + esc(gearBits(row.stats).join("、")) + (row.hi ? "；最後攻擊 +" + row.hi + "%" : "") + "</td><td>" + esc(step) + "</td></tr>";
  }).join("");
  const reach = Math.round(w.range / 10);
  const extra = [w.shield ? "可以同時拿盾" : "", w.dual ? "普攻再補一刀，第二刀是普攻的 " + Math.round(w.dual * 100) + "%" : ""].filter(Boolean).join("。");
  return "<article class=\"panel\" id=\"detail\"><h2>" + esc(w.name) + " <span class=\"muted\">+" + ref + " · " + esc(w.fam) + "</span></h2>"
    + "<p>" + esc(w.lore) + "</p>"
    + "<p><b>怎麼拿到。</b> 線上打倒「" + esc(w.mapName) + "」的首領「" + esc(w.boss) + "」。這張圖的怪大約 " + w.lv[0] + "～" + w.lv[1] + " 級，武器需求 Lv." + w.req + "。離線不掉首領的東西。</p>"
    + "<p class=\"muted\">沒開尋寶時，這張圖掉出一件專屬的機率是 " + pctText(w.mapRate) + "%。" + w.pool + " 件專屬共用這一次，掉到才隨機抽，這把大約 " + pctText(w.mapRate / w.pool) + "%。尋寶卷 +50%、高級尋寶藥水 +100% 會乘上去。掉出來是" + esc(WEAPONS.rarity) + "。</p>"
    + "<p>現在 +" + ref + "：" + esc(gearBits(lv.stats).join("、")) + (lv.hi ? "。最後攻擊 +" + lv.hi + "%。" : "。") + "</p>"
    + "<p class=\"muted\">攻速係數 ×" + w.aspd + "，射程 " + reach + " 格。" + esc(extra) + "</p>"
    + "<p class=\"muted\">能用的職業：" + esc(users.join("、")) + "。冒險者什麼武器都能拿。</p>"
    + "<div class=\"tree-wrap\"><table><thead><tr><th>強化</th><th>這一級的數字</th><th>再升一級</th></tr></thead><tbody>" + rows + "</tbody></table></div></article>";
}
function aspdReal(aspd) {
  const shown = Math.min(4, Math.max(0.2, aspd));
  const infoDur = 0.55;
  const dur = infoDur / Math.max(1, infoDur * shown * 1.1);
  let act = 0;
  for (let t = 0; t < dur; t += 0.05) act++;
  const cd = Math.ceil(1 / shown / 0.05 - 1e-9);
  const ticks = Math.max(act + 1, cd);
  return { shown, hits: 1 / (ticks * 0.05), ticks };
}
function monFlee(L, kind) {
  if (kind === "magic") return null;
  const raw = kind === "dex" ? 116 + 4.1 * L - 0.0081 * L * L : 92 + 1.33 * L;
  return Math.round(raw);
}
function hitChance(hit, flee) {
  return Math.min(1, Math.max(0.4, 0.88 + (hit - flee) / 250));
}
function viewCaps() {
  const aspd = Math.max(0.2, Math.min(4, Number(S.capAspd) || 0));
  const real = aspdReal(aspd);
  const stopped = real.hits >= aspdReal(4).hits - 1e-9;
  const L = Math.max(1, Math.min(150, S.capLv | 0));
  const extra = Math.max(0, S.capHit | 0);
  const kind = S.capKind || "melee";
  const sheetHit = 80 + L + extra;
  const flee = monFlee(L, kind);
  let hitText;
  if (L < 10 && kind !== "magic") {
    hitText = "10 級以下的怪不套這套迴避。魔法攻擊本來就必中。";
  } else if (kind === "magic") {
    hitText = "魔法攻擊必中。面板上的命中不會讓法術更準，也不會讓它打空。";
  } else {
    const chance = hitChance(sheetHit, flee);
    const full = flee + 30;
    const floor = flee - 120;
    const wall = chance >= 0.999 ? "已經打滿 100%。再堆命中，打這種怪不會更準。"
      : chance <= 0.401 ? "已經貼在 40% 的地板。要先補到離開地板，命中才開始有用。"
      : "還沒到頂。打滿 100% 要命中至少 " + full + "，也就是再補 " + Math.max(0, full - sheetHit) + "。低於 " + floor + " 就會貼在 40%。";
    hitText = (kind === "dex" ? "弓、火銃、卡牌打到的怪，迴避比較高。" : "近戰和其他物理武器打到的怪，迴避比較低。")
      + " 這隻 " + L + " 級怪的迴避是 " + flee + "。你的命中若只有等級那一段再加 " + extra + "，是 " + sheetHit + "，命中率 " + Math.round(chance * 1000) / 10 + "%。" + wall;
  }
  const raw = Math.max(0, Number(S.capCrit) || 0);
  const resist = { normal: 5, elite: 5, boss: 10, world: 15 }[S.capRank] || 10;
  const shownCrit = Math.min(80, raw);
  const fightCrit = Math.min(80, Math.max(0, raw - resist));
  const critNeed = 80 + resist;
  return "<article class=\"panel\"><h2>哪裡有頂</h2>"
    + "<p>有些數字會一直往上加，加到某個地方就不再讓你打得更快或更準。下面先列硬上限，再列「面板還在漲、實際已經停」的那幾項。</p>"
    + "<div class=\"tree-wrap\"><table><thead><tr><th>項目</th><th>停在哪</th><th>停了以後</th></tr></thead><tbody>"
    + "<tr><td>能力點</td><td>每一維 200</td><td>加點鈕會停。裝備、秘藥仍可再加，那不算在這 200 裡。</td></tr>"
    + "<tr><td>秘藥</td><td>每一維 50</td><td>每點能力 +1，不用花能力點。</td></tr>"
    + "<tr><td>面板攻速</td><td>4</td><td>公式先卡在 4。真正的普攻次數更早停，見下面。</td></tr>"
    + "<tr><td>實際普攻</td><td>每秒 3.33 下</td><td>面板攻速 3.64 起就是這個次數，一直到 4 都不會再變快。</td></tr>"
    + "<tr><td>暴擊率</td><td>面板 80%</td><td>打怪先扣抗暴，再套 80%。面板滿了以後，多出來的原始暴擊還能補抗暴。</td></tr>"
    + "<tr><td>暴擊傷害</td><td>競技場 170%</td><td>野外這份客戶端沒有寫上限。力量每點仍 +0.1%。</td></tr>"
    + "<tr><td>命中率</td><td>100%，最低 40%</td><td>命中比怪的迴避高 30 就滿。再低 120 就貼在 40%。魔法必中。</td></tr>"
    + "<tr><td>大招冷卻減免</td><td>50%</td><td>七曜武器那條減冷卻，最多減一半。</td></tr>"
    + "<tr><td>等級差</td><td>最多 10 級</td><td>你打出的傷害最低剩 50%，挨打最高 1.6 倍。16 級才開始，25 級起才算滿 10 級。</td></tr>"
    + "<tr><td>強化</td><td>+15</td><td>武器每級物攻、魔攻 +7%。+9 起的最後攻擊另外算。</td></tr>"
    + "<tr><td>物攻、魔攻、生命、防禦</td><td>沒有硬上限</td><td>防禦的減傷只會靠近 100%，到不了。減傷比例是 防禦 ÷（防禦 + 120 + 自己的等級 × 3）。</td></tr>"
    + "<tr><td>掉寶、經驗、吸血、治療</td><td>沒有再設上限</td><td>幸運的掉寶、卷和藥水是相加。經驗祝福和經驗藥水也是相加。</td></tr>"
    + "</tbody></table></div></article>"
    + "<article class=\"panel\"><h2>攻速</h2>"
    + "<div class=\"lvbox\"><label>面板攻速 <input id=\"capAspd\" type=\"number\" min=\"0.2\" max=\"4\" step=\"0.01\" value=\"" + aspd + "\"></label>"
    + "<input id=\"capAspdRange\" type=\"range\" min=\"0.8\" max=\"4\" step=\"0.01\" value=\"" + aspd + "\" aria-label=\"面板攻速\"></div>"
    + "<p>面板寫 <b>" + real.shown.toFixed(2) + "</b>。實際普攻約 <b>" + real.hits.toFixed(2) + "</b> 下／秒。"
    + (stopped ? " 已經頂到每秒 3.33 下。再加敏捷或攻速%，次數不會增加。自動配點這時會把原本要點敏捷的點改點主能力。" : " 還沒到頂。3.64 以前，面板每高一截，次數還會跳一格。")
    + "</p><p class=\"muted\">伺服器每 0.05 秒算一格。普攻要等冷卻湊滿整格，也要等動作播完的下一格。攻速高了以後，各種武器的動作都會被壓到同一種長度，所以劍、弓、槍都在 3.64 停在同一格：6 格、0.30 秒、每秒 3.33 下。面板上限 4 比這個實際天花板還高。</p></article>"
    + "<article class=\"panel\"><h2>命中</h2>"
    + "<div class=\"lvbox\"><label>怪的等級 <input id=\"capLv\" type=\"number\" min=\"1\" max=\"150\" value=\"" + L + "\"></label>"
    + "<label>額外命中 <input id=\"capHit\" type=\"number\" min=\"0\" max=\"2000\" value=\"" + extra + "\"></label>"
    + "<select id=\"capKind\" aria-label=\"攻擊種類\"><option value=\"melee\"" + (kind === "melee" ? " selected" : "") + ">近戰和其他物理</option><option value=\"dex\"" + (kind === "dex" ? " selected" : "") + ">弓、火銃、卡牌</option><option value=\"magic\"" + (kind === "magic" ? " selected" : "") + ">魔法</option></select></div>"
    + "<p>" + esc(hitText) + "</p>"
    + "<p class=\"muted\">命中率＝0.88 ＋（你的命中 − 怪的迴避）÷ 250，再卡在 40% 到 100%。怪的迴避不看你堆了多少迴避；近戰怪用 92 ＋ 1.33×等級，弓火銃卡牌打到的怪用 116 ＋ 4.1×等級 − 0.0081×等級²。10 級以下不套。你的命中＝80 ＋等級 ＋靈巧×1.5 ＋幸運×0.3 ＋額外命中。這裡的額外命中把靈巧和幸運也算進去，方便自己填。</p></article>"
    + "<article class=\"panel\"><h2>暴擊</h2>"
    + "<div class=\"lvbox\"><label>原始暴擊% <input id=\"capCrit\" type=\"number\" min=\"0\" max=\"300\" value=\"" + raw + "\"></label>"
    + "<select id=\"capRank\" aria-label=\"怪物種類\"><option value=\"normal\"" + (S.capRank === "normal" ? " selected" : "") + ">小怪、菁英，抗暴 5</option><option value=\"boss\"" + (S.capRank === "boss" ? " selected" : "") + ">首領，抗暴 10</option><option value=\"world\"" + (S.capRank === "world" ? " selected" : "") + ">世界首領，抗暴 15</option></select></div>"
    + "<p>面板寫 <b>" + shownCrit + "%</b>。打這隻怪是 <b>" + fightCrit + "%</b>。"
    + (raw >= critNeed ? " 抗暴扣完仍是 80%，再堆暴擊不會更高。" : " 要讓抗暴之後仍是 80%，原始暴擊要到 " + critNeed + "%。面板在 80% 就不再往上寫，所以看起來滿了，打首領還可能沒滿。")
    + "</p><p class=\"muted\">打怪時先用沒有套 80% 的原始值減抗暴，再套 80%。小怪和菁英抗暴都是 5。暴擊傷害在競技場封頂 170%。野外沒有寫這個上限。</p></article>";
}
const STAT_KEYS = ["str", "agi", "vit", "int", "dex", "luk"];
const WASPD = { "單手劍": 1, "雙手大劍": 0.8, "雙短刃": 1.3, "弓": 0.95, "火銃": 1.15, "法杖": 0.85, "魔導書": 0.85, "權杖": 0.9, "戰錘": 0.85, "獸鞭": 1, "樂器": 0.95, "卡牌": 1.1, "操偶架": 1, "拳套": 1.25, "長槍": 0.85, "巨斧": 0.75 };
const TIER_NAMES = ["晨露", "低語", "珊瑚", "赤砂", "腐沼", "迴音", "蒼鷹", "霜語", "永凍", "熔心", "遺忘", "亡者", "星晶", "浮空", "菌光", "沉沒", "齒輪", "深淵", "虛空", "天穹"];
const REFINE_RATES = [1, 1, 1, 1, 1, 1, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.12, 0.07, 0.04];
const SCROLL_GOLD = { weapon: 70000, armor: 40000, acc: 50000 };
function pointBudget(lv) {
  let n = 20;
  for (let L = 2; L <= lv; L++) n += 5 + (L % 10 === 0 ? 1 : 0);
  return n;
}
function pointCost(v) { return 1 + Math.floor(v / 30); }
function pointsSpent() {
  let n = 0;
  for (const k of STAT_KEYS) for (let v = 5; v < (S.pts[k] || 5); v++) n += pointCost(v);
  return n;
}
function viewStats() {
  const lv = Math.max(1, Math.min(150, S.stLv | 0));
  const job = JOB[S.stJob] || JOB.paladin;
  const budget = pointBudget(lv);
  const used = pointsSpent();
  const left = budget - used;
  const fam = (job.weapons || [])[0] || "單手劍";
  const ranged = ["弓", "火銃", "卡牌"].includes(fam);
  const mainName = job.magic ? "智力" : ranged ? "靈巧" : "力量";
  const st = S.pts;
  const main = ranged ? st.dex : st.str;
  const sub = ranged ? st.str : st.dex;
  const atk = (job.magic ? st.str * 0.5 + st.dex * 0.5 : main * 2 + sub * 0.5) + lv;
  const matk = st.int * 2.4 + lv;
  const hp = (80 + 18 * lv + 12 * st.vit + 0.35 * lv * st.vit) * job.hp;
  const sp = (20 + 3.5 * lv + 6 * st.int + 0.1 * lv * st.int) * job.sp;
  const aspd = Math.min(4, job.aspd * (WASPD[fam] || 1) * (1 + st.agi * 0.01 + st.dex * 0.002));
  const hits = aspdReal(aspd).hits;
  const rows = STAT_KEYS.map((k) => {
    const v = st[k];
    const cost = v >= 200 ? 0 : pointCost(v);
    const upLock = v >= 200 || left < cost;
    const downLock = v <= 5;
    return "<div class=\"sk\"><div class=\"nm\"><b>" + esc(STATN[k]) + "</b><span class=\"muted\">下一點 " + (v >= 200 ? "已滿" : cost + " 點能力") + "</span></div><div class=\"ops\">"
      + "<button type=\"button\" class=\"btn tiny\" data-pt=\"" + k + "\" data-pd=\"-1\"" + (downLock ? " disabled" : "") + ">−</button><b>" + v + "</b>"
      + "<button type=\"button\" class=\"btn tiny\" data-pt=\"" + k + "\" data-pd=\"1\"" + (upLock ? " disabled" : "") + ">+</button></div></div>";
  }).join("");
  return "<article class=\"panel\"><h2>配點</h2>"
    + "<div class=\"lvbox\"><label>等級 <input id=\"stLv\" type=\"number\" min=\"1\" max=\"150\" value=\"" + lv + "\"></label>"
    + "<label>職業 <select id=\"stJob\" aria-label=\"職業\">" + jobOptions(S.stJob) + "</select></label>"
    + "<button type=\"button\" class=\"btn tiny\" data-ptreset>回到各 5</button>"
    + "<button type=\"button\" class=\"btn tiny\" data-ptpour>把剩下的點灌進" + esc(mainName) + "</button></div>"
    + "<p class=\"remain\">剩餘 <b class=\"" + (left < 0 ? "bad" : "good") + "\">" + left + "</b> <span class=\"muted\">／ " + budget + "，已用 " + used + "</span></p>"
    + "<p class=\"muted\">一開始六維各 5，另外 20 點。2 級起每級 5 點，10 的倍數那一級再多 1 點。現在這一維是 v 時，再加 1 要花 1 ＋ floor(v ÷ 30) 點。每維最高 200。秘藥每維另加最多 50，不花這些點，這裡沒算進去。</p>"
    + rows
    + "<h3 class=\"sec\">這些點算出來的面板，不含裝備</h3>"
    + "<div class=\"kv\">"
    + "<div><b>物攻</b><br>" + Math.round(atk) + "</div><div><b>魔攻</b><br>" + Math.round(matk) + "</div>"
    + "<div><b>生命</b><br>" + Math.round(hp) + "</div><div><b>魔力</b><br>" + Math.round(sp) + "</div>"
    + "<div><b>物防</b><br>" + Math.round(st.vit * 0.8 + lv * 0.3) + "</div><div><b>魔防</b><br>" + Math.round(st.int * 0.5 + st.vit * 0.3) + "</div>"
    + "<div><b>攻速</b><br>" + aspd.toFixed(2) + "，實際約 " + hits.toFixed(2) + " 下／秒</div>"
    + "<div><b>命中</b><br>" + Math.round(80 + lv + st.dex * 1.5 + st.luk * 0.3) + "</div>"
    + "<div><b>迴避</b><br>" + Math.round(50 + lv + st.agi * 1.4 + st.luk * 0.3) + "</div>"
    + "<div><b>暴擊</b><br>" + Math.min(80, Math.round((1 + st.luk * 0.3) * 10) / 10) + "%</div>"
    + "<div><b>暴傷</b><br>" + (Math.round((150 + st.str * 0.1) * 10) / 10) + "%</div>"
    + "</div><p class=\"muted\">主武器先看" + esc(fam) + "，所以主攻擊能力是" + esc(mainName) + "。弓、火銃、卡牌的物攻吃靈巧，其他吃力量。職業血量 ×" + job.hp + "、魔力 ×" + job.sp + "、基礎攻速 ×" + job.aspd + "。攻速到 3.64 以後，實際次數停在每秒 3.33 下。</p></article>";
}
function refineFee(tier, lv) {
  return Math.round((80 + tier * 42) * (1 + lv * 0.5)) + (lv >= 6 ? tier * 10000 * (lv - 5) : 0);
}
function luckAdd(lv) { return lv >= 11 ? 0.03 : 0.05; }
function stepRate(lv, bless, dust) {
  let r = REFINE_RATES[lv] || 0;
  if (bless && lv >= 6) r += luckAdd(lv);
  if (dust && lv >= 6) r += luckAdd(lv);
  return Math.min(1, r);
}
function stepOutcomes(lv, bless, dust, charm) {
  const rate = stepRate(lv, bless, dust);
  const out = [];
  if (bless && lv < 6) {
    for (const add of [1, 2, 3]) out.push({ p: rate / 3, to: Math.min(15, lv + add) });
  } else out.push({ p: rate, to: Math.min(15, lv + 1) });
  const fail = 1 - rate;
  if (fail <= 1e-12) return out;
  let to = -1;
  if (charm === "charm3" || (charm === "charm2" && lv <= 10)) to = lv;
  else if (charm === "charm" || charm === "charm2") to = Math.max(0, lv - 1);
  out.push({ p: fail, to });
  return out;
}
function solveSystem(A) {
  const n = A.length;
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    const tmp = A[col]; A[col] = A[piv]; A[piv] = tmp;
    const div = A[col][col] || 1e-12;
    for (let c = col; c <= n; c++) A[col][c] /= div;
    for (let r = 0; r < n; r++) if (r !== col) {
      const f = A[r][col];
      if (!f) continue;
      for (let c = col; c <= n; c++) A[r][c] -= f * A[col][c];
    }
  }
  return A.map((row) => row[n]);
}
function expectRefine(from, to, opts) {
  if (from >= to) return { p: 1, attempts: 0, gold: 0, dust: 0, charms: 0 };
  const n = to;
  function build(costFn, prob) {
    const A = Array.from({ length: n }, () => Array(n + 1).fill(0));
    for (let i = 0; i < n; i++) {
      A[i][i] = 1;
      let jump = 0;
      for (const o of stepOutcomes(i, opts.bless, opts.dust, opts.charm)) {
        if (o.to >= to) jump += o.p;
        else if (o.to >= 0) A[i][o.to] -= o.p;
      }
      A[i][n] = prob ? jump : costFn(i);
    }
    return solveSystem(A);
  }
  const scroll = opts.bless ? 0 : (SCROLL_GOLD[opts.kind] || 0);
  return {
    p: build(null, true)[from],
    attempts: build(() => 1, false)[from],
    gold: build((i) => refineFee(opts.tier, i) + scroll, false)[from],
    dust: build((i) => (opts.dust && i >= 6 ? 1 : 0), false)[from],
    charms: build(() => (opts.charm === "none" ? 0 : 1), false)[from],
  };
}
function viewRefine() {
  const from = Math.max(0, Math.min(15, S.rfFrom | 0));
  const to = Math.max(0, Math.min(15, S.rfTo | 0));
  const tier = Math.max(0, Math.min(19, S.rfTier | 0));
  const opts = { bless: !!S.rfBless, dust: !!S.rfDust, charm: S.rfCharm || "none", kind: S.rfKind || "weapon", tier };
  const exp = expectRefine(from, to, opts);
  const rateRows = [];
  for (let lv = 0; lv < 15; lv++) {
    const rate = stepRate(lv, opts.bless, opts.dust);
    const fail = lv < 6 ? "不會失敗" : opts.charm === "charm3" || (opts.charm === "charm2" && lv <= 10) ? "停在原地" : opts.charm === "none" ? "裝備碎掉" : "掉 1 級";
    const extra = opts.bless && lv < 6 ? "，成功時 +1／+2／+3 各三分之一" : "";
    rateRows.push("<tr" + (lv === from ? " class=\"sel\"" : "") + "><td>+" + lv + " → +" + (lv + 1) + "</td><td>" + pctText(rate) + "%</td><td>" + goldText(refineFee(tier, lv)) + "</td><td>" + esc(fail + extra) + "</td></tr>");
  }
  const tiers = TIER_NAMES.map((name, i) => "<option value=\"" + i + "\"" + (i === tier ? " selected" : "") + ">" + esc(name) + " · 需求 Lv." + (1 + 7 * i) + "</option>").join("");
  const reached = from >= to;
  return "<article class=\"panel\"><h2>強化機率</h2>"
    + "<div class=\"lvbox\"><label>從 +<input id=\"rfFrom\" type=\"number\" min=\"0\" max=\"15\" value=\"" + from + "\"></label>"
    + "<label>到 +<input id=\"rfTo\" type=\"number\" min=\"0\" max=\"15\" value=\"" + to + "\"></label>"
    + "<label>裝備 <select id=\"rfTier\" aria-label=\"裝備階級\">" + tiers + "</select></label>"
    + "<select id=\"rfKind\" aria-label=\"卷軸種類\"><option value=\"weapon\"" + (opts.kind === "weapon" ? " selected" : "") + ">武器卷 7 萬</option><option value=\"acc\"" + (opts.kind === "acc" ? " selected" : "") + ">飾品卷 5 萬</option><option value=\"armor\"" + (opts.kind === "armor" ? " selected" : "") + ">防具卷 4 萬</option></select></div>"
    + "<div class=\"lvbox\"><label><input id=\"rfBless\" type=\"checkbox\"" + (opts.bless ? " checked" : "") + "> 祝福卷</label>"
    + "<label><input id=\"rfDust\" type=\"checkbox\"" + (opts.dust ? " checked" : "") + "> 幸運星砂</label>"
    + "<select id=\"rfCharm\" aria-label=\"防爆符\"><option value=\"none\"" + (opts.charm === "none" ? " selected" : "") + ">不用符，失敗碎掉</option><option value=\"charm\"" + (opts.charm === "charm" ? " selected" : "") + ">守護之符，失敗掉 1 級</option><option value=\"charm2\"" + (opts.charm === "charm2" ? " selected" : "") + ">高級防爆符，+10 以下不動</option><option value=\"charm3\"" + (opts.charm === "charm3" ? " selected" : "") + ">完美防爆符，失敗不動</option></select></div>"
    + (reached ? "<p>起點已經不低於目標。</p>" : "<div class=\"kv\">"
      + "<div><b>到達機率</b><br>" + pctText(exp.p) + "%</div>"
      + "<div><b>期望次數</b><br>" + (Math.round(exp.attempts * 10) / 10) + "</div>"
      + "<div><b>期望金幣</b><br>" + goldText(Math.round(exp.gold)) + "</div>"
      + "<div><b>期望卷軸</b><br>" + (Math.round(exp.attempts * 10) / 10) + "</div>"
      + "<div><b>期望星砂</b><br>" + (Math.round(exp.dust * 10) / 10) + "</div>"
      + "<div><b>期望符</b><br>" + (Math.round(exp.charms * 10) / 10) + "</div></div>")
    + "<p class=\"muted\">期望是衝到目標，或中途碎掉為止，平均花掉的東西。不用符時，到達機率不是 100%。有符就不會碎，機率會到 100%，次數是平均要試幾次。祝福卷在 +6 以下每次成功有三分之一機率 +1、+2 或 +3，可能跳過中間。+6 以上祝福卷只加成功率，不加級數。星砂和祝福卷在衝 +7 到 +11 各 +5%，衝 +12 到 +15 各 +3%，兩個一起加。+6 以內用不到星砂。普通卷軸的價錢算進金幣，祝福卷沒有標價，只算張數。符每次強化都扣，成功也扣。</p>"
    + "<div class=\"tree-wrap\"><table><thead><tr><th>這一級</th><th>成功率</th><th>金幣</th><th>失敗</th></tr></thead><tbody>" + rateRows.join("") + "</tbody></table></div></article>";
}
const DROP_MAPS = [
  [1, "晨露草原", "綠丘泥王・葛魯姆", 1, 10],
  [2, "低語森林", "古樹守衛・歐克蘭", 8, 18],
  [3, "珊瑚海岸", "潮汐巨螯・卡拉克", 15, 25],
  [4, "赤砂荒漠", "沙海吞噬者・薩布拉", 22, 32],
  [5, "腐沼濕地", "腐泥之母・莫菈", 29, 39],
  [6, "迴音礦坑", "地心掘進者・鐵顎", 36, 46],
  [7, "蒼鷹山脈", "天空主宰・颶羽", 43, 53],
  [8, "霜語雪原", "永冬狼帝・霜嚎", 50, 60],
  [9, "永凍冰窟", "冰窟女王・絲凜", 57, 67],
  [10, "熔心火山", "熔心巨像・伊格尼", 64, 74],
  [11, "遺忘神殿", "遺忘之王・阿蒙特", 71, 81],
  [12, "亡者墓園", "冥府守墓人・葛雷文", 78, 88],
  [13, "星晶礦脈", "晶核巨像・普麗茲", 85, 95],
  [14, "浮空群島", "蒼穹之翼・艾瑟", 92, 102],
  [15, "菌光秘林", "菌后・茉希菈", 99, 109],
  [16, "沉沒古城", "深潮之主・瑟蘭", 106, 116],
  [17, "齒輪要塞", "機械領主・齒輪泰坦", 113, 123],
  [18, "深淵裂谷", "深淵領主・卡爾薩斯", 120, 130],
  [19, "虛空迴廊", "虛空主宰・尼赫", 127, 137],
  [20, "天穹聖殿", "燼光之神・索拉瑞斯", 134, 150]
];
const TUNE = [[23, 1], [40, 1.18], [68, 1.6], [96, 2.1], [141, 3.7], [150, 3.9]];
function normalReward(lv) {
  if (lv <= TUNE[0][0]) return TUNE[0][1];
  for (let i = 1; i < TUNE.length; i++) {
    if (lv <= TUNE[i][0]) {
      const a = TUNE[i - 1];
      const b = TUNE[i];
      return a[1] + (b[1] - a[1]) * (lv - a[0]) / (b[0] - a[0]);
    }
  }
  return TUNE[TUNE.length - 1][1];
}
function uniqueChance(id) {
  const base = id <= 10 ? 0.01 : Math.max(0.001, 0.01 - 0.001 * (id - 10));
  const share = [10, 11, 13, 17, 20].includes(id) ? 4 / 3 : 1;
  return Math.min(0.05, base) * share;
}
function uniqueCount(id) {
  if (id < 10) return 1;
  return [10, 11, 13, 17, 20].includes(id) ? 4 : 3;
}
function viewDrops() {
  const rows = DROP_MAPS.map(([id, name, boss, lo, hi]) => {
    const low = normalReward(lo) * 0.025;
    const high = normalReward(hi) * 0.025;
    const bosses = id >= 8 ? (160 + 20 * (id - 8)) + " 隻" : "約 80 隻";
    const myth = lo >= 50 ? "減半" : "原表";
    return "<tr><td>" + id + "</td><td>" + esc(name) + "</td><td>" + lo + "–" + hi + "</td><td>" + esc(boss) + "</td><td>" + pctText(low) + "% → " + pctText(high) + "%</td><td>40%</td><td>2 件</td><td>" + pctText(uniqueChance(id)) + "%／" + uniqueCount(id) + " 件</td><td>" + bosses + "</td><td>" + myth + "</td></tr>";
  }).join("");
  return "<article class=\"panel\"><h2>掉落</h2>"
    + "<p>沒有任何一隻怪專門提高某個部位。小怪、菁英、首領掉出裝備之後，用的是同一套部位比例，只看你的職業，不看怪的名字、種類或外型。後期小怪比較會掉「件數」，是因為等級高、打得久，一隻算比較多份，部位比例不變。</p>"
    + "<h3 class=\"sec\">一件裝備掉出來之後</h3>"
    + "<div class=\"tree-wrap\"><table><thead><tr><th>部位</th><th>占全部裝備</th><th>怎麼再分</th></tr></thead><tbody>"
    + "<tr><td>武器</td><td>35%</td><td>其中 60% 是你這個職業能用的武器，剩下 40% 在 16 種武器裡隨機。</td></tr>"
    + "<tr><td>頭、身體、手、腳</td><td>各 11.25%</td><td>四件平分 45%。職業有固定防具時，60% 是你的防具類，40% 在重裝、皮裝、棉裝裡隨機。頭、身、手、腳本身沒有誰比較高。</td></tr>"
    + "<tr><td>披風、戒指、項鍊</td><td>各 5%</td><td>飾品一共 20%。</td></tr>"
    + "<tr><td>盾、護符</td><td>各 2.5%</td><td>盾的那一份有一半改成護符。不是某隻怪比較掉盾。</td></tr>"
    + "</tbody></table></div>"
    + "<p class=\"muted\">階級：62% 是這張圖的階，20% 低一階，18% 高一階。尋寶加成只把稀有、史詩、傳說、神話的權重放大，普通和精良不乘。下面的件數是沒開尋寶的數字。</p>"
    + "<h3 class=\"sec\">品質，沒開尋寶</h3>"
    + "<div class=\"tree-wrap\"><table><thead><tr><th></th><th>普通</th><th>精良</th><th>稀有</th><th>史詩</th><th>傳說</th><th>神話</th></tr></thead><tbody>"
    + "<tr><td>小怪</td><td>62%</td><td>27%</td><td>8.5%</td><td>2.4%</td><td>0.08%</td><td>0.02%</td></tr>"
    + "<tr><td>菁英</td><td>15%</td><td>42%</td><td>30%</td><td>12.3%</td><td>0.5%</td><td>0.2%</td></tr>"
    + "<tr><td>首領</td><td>0</td><td>25.8%</td><td>45%</td><td>27.5%</td><td>1.5%</td><td>0.2%</td></tr>"
    + "<tr><td>地圖最低 50 級起</td><td colspan=\"6\">神話權重減半，減掉的補進史詩。小怪神話變 0.01%，菁英和首領神話變 0.1%。</td></tr>"
    + "</tbody></table></div>"
    + "<h3 class=\"sec\">每張圖</h3>"
    + "<p class=\"muted\">小怪那一欄是這張圖等級最低到最高的期望件數，等於沒開尋寶時掉出至少一件的機率。菁英固定 40% 一件。首領固定 2 件地圖裝備，另外再擲一次專屬。專屬是整張圖共用一次，掉到才在那幾件裡隨機。地圖 8 起，大約打這麼多隻才出一隻首領，小怪和菁英都算 1 隻。地圖 1 到 7 程式沒有寫死，註解是大約 80 隻。</p>"
    + "<div class=\"tree-wrap\"><table><thead><tr><th>圖</th><th>名稱</th><th>等級</th><th>首領</th><th>小怪裝備</th><th>菁英</th><th>首領裝備</th><th>專屬</th><th>首領間隔</th><th>神話</th></tr></thead><tbody>"
    + rows + "</tbody></table></div></article>";
}
const PATCHES = [
  ["11 月 23 日", ["野外星晶礦降到 0.01%。魂石礦脈困難一次 5 個，公會商店沒改。", "地圖 17 補權杖，地圖 10、11、13、20 各再補一把武器。這五張圖變成四件專屬共用一次，整張圖的機率乘 4/3，原本每件的機率不變。"]],
  ["11 月 22 日", ["召喚物傷害下修：火靈、雷靈、大地守衛、契約王乘 0.6，幼獸乘 0.85，野狼乘 0.4，奇美拉和巨獸乘 0.5，幼龍乘 0.5。", "幻影忍皇自己的攻擊招，含大招，施放時再乘 1.4。引怪和持續傷害不乘。", "技能說明改成照目前等級寫數字。武器的額外傷害詞條先關掉，程式留著。"]],
  ["11 月 20 日", ["首領專屬：地圖 1 到 10 是 1%，之後每換一張圖少 0.1%，地圖 19 和 20 是 0.1%。", "首領間隔改成地圖 8 是 160 隻，每張加 20，地圖 20 是 400 隻。", "副本每個難度多了困難。"]],
  ["11 月 19 日", ["16 種武器的首領專屬補進地圖 10 到 20，一張圖多件時共用一次機率。", "非法系兩次技能之間的間隔從 2.6 秒改成 1.3 秒。", "技能效果不因轉職而改，只看技能等級。"]],
  ["11 月 17 日", ["攻速面板最高 4，但 3.64 起實際每秒 3.33 下。自動配點碰到這裡就改點主能力。", "暴擊先扣抗暴再套 80%。小怪和菁英 5，首領 10，世界首領 15。", "命中率卡在 40% 到 100%。弓、火銃、卡牌打到的怪用較高的迴避。魔法必中。", "能力秘藥每維最多 50。暗黑騎士物理欄攻擊招再乘 1.5。"]],
  ["11 月 16 日", ["月卡經驗改成線上和離線都加 30%。", "地圖 12 起，裝備數值每張圖固定再加 12%。", "七曜化開放。後來改成要神話、加 13 以上、地圖 10 起。武器大招冷卻最多減 50%。"]],
  ["11 月 15 日", ["防爆符改成每次強化都消耗，成功也扣。", "技能書改成首領 0.1%，而且只有這隻傷害前 10% 的人抽得到。", "守護之符、高級洗鍊石、裝備寶箱、寵物蛋的首領掉率改成原本的三分之一。"]],
  ["11 月 14 日", ["強化可以傳承。加 6 以下原樣搬，加 7 到 9 不用符會掉 1 級，加 10 以上不能傳。需求 85 級以上的新裝備，不用高級傳承符就只收到加 6。", "地圖可以看會掉什麼，遊戲裡的那一頁不顯示機率。"]],
  ["11 月 13 日", ["地圖最低等級 50 起，神話權重減半，減掉的補進史詩。", "同一段地圖的首領出現速度減半。後來 11 月 20 日改成上面的固定隻數。"]],
  ["11 月 9 日", ["二轉改 50 級，三轉改 80 級。", "技能點改成 1 到 5 級每級 1 點，6 到 8 級 2 點，9 到 10 級 3 點。"]],
  ["11 月 8 日", ["引怪招加強：範圍和隻數會隨等級變大。", "卷軸、星砂、洗鍊石再降一輪。祝福卷只有首領會掉。", "武器加 9 起另加最後攻擊。其他部位加 9 起加最大生命。加 8 以下沒有這層。"]],
  ["11 月 7 日", ["等級差從 16 級開始，最多 10 級，25 級起才算滿。", "比地圖等級上限高超過 10 級之後，通用掉落每級少 8%，最低剩 20%。裝備、藥水、素材不打折。", "轉職不再改已經學的技能。"]],
  ["11 月 6 日", ["小怪等級差：你打出少 5%，挨打多 6%。菁英、野外首領、世界首領不算。", "非法系技能耗魔減半。"]],
  ["11 月 5 日", ["戒指和項鍊改用飾品卷軸。", "品質提升成功率下修：精良 60%、稀有 30%、史詩 10%、傳說 2%。", "普攻看手上的武器，不看職業。"]],
  ["11 月 4 日", ["武器卷軸 7 萬金幣，防具卷軸 4 萬。飾品卷後來定 5 萬。", "打怪掉的強化卷軸大約砍到原本的八分之一。"]],
  ["11 月 3 日", ["首領裝備的神話權重從 1 改到 0.2，空出來的補進精良。", "登入公告和跑馬燈做進遊戲。公告本文在伺服器，不在這份客戶端。"]]
];
function viewPatch() {
  const summary = "客戶端版本 93ba93a508a1，2026 年 11 月 26 日對過。信箱公告放在伺服器，這頁讀不到原文，只整理程式裡寫明日期的平衡。註解寫到 11 月 23 日；之後版本號有換，這幾個檔沒有新的日期。現在是 10、50、80 級轉職。過了等級還沒轉，經驗和技能點變 3 倍。技能 1 到 5 級每級 1 點，6 到 8 級 2 點，9 到 10 級 3 點。攻速面板最高 4，3.64 起實際每秒 3.33 下。50 級以後的地圖，首領變少，神話權重減半。專屬裝在第 10 張圖以前是 1%，之後每張少 0.1%。11 月 22 日召喚物砍過一輪，幻影忍皇的攻擊招再乘 1.4。強化加 6 以內必成，加 9 起武器另加最後攻擊。掉落不看你打哪一隻怪，部位只看職業。";
  const blocks = PATCHES.map(([day, items]) => "<h3 class=\"sec\">" + esc(day) + "</h3><ul>" + items.map((x) => "<li>" + esc(x) + "</li>").join("") + "</ul>").join("");
  return "<article class=\"panel\"><h2>更新</h2><p>" + esc(summary) + "</p>" + blocks + "</article>";
}
function view() {
  if (S.tab === "skills") return viewSkills();
  if (S.tab === "sim") return viewSim();
  if (S.tab === "gear") return viewGear();
  if (S.tab === "caps") return viewCaps();
  if (S.tab === "stats") return viewStats();
  if (S.tab === "refine") return viewRefine();
  if (S.tab === "drops") return viewDrops();
  if (S.tab === "patch") return viewPatch();
  if (S.tab === "affix") return viewAffix();
  if (S.tab === "set") return viewSet();
  return viewJobs();
}
function effTierOf(t) {
  if (t <= 10) return t;
  const raw = (x) => 14 + 11.2 * x + 0.17 * x * x;
  const v = raw(10) * (1.12 ** (t - 10));
  return (-11.2 + Math.sqrt(11.2 * 11.2 - 4 * 0.17 * (14 - v))) / (2 * 0.17);
}
function affixSpan(max, pct) {
  const round = (v) => (pct ? Math.round(v * 10) / 10 : Math.max(1, Math.round(v)));
  return round(max * 0.5) + "～" + round(max) + (pct ? "%" : "");
}
function reforgeBill(tier, deep, locks) {
  return Math.round((1000 + tier * 1000) * (deep ? 3 : 1) * (1 + locks * 0.5));
}
function qualityBill(tier, rarity) {
  return (1000 + tier * 1000) * (rarity + 1) * 2;
}
const AFFIX_ROWS = [
  ["力量、敏捷、體魄、智力、靈巧、幸運", (t) => 2 + 1.12 * t, false],
  ["物攻、魔攻", (t) => 4 + 4.2 * t, false],
  ["生命", (t) => 30 + 42 * t, false],
  ["魔力", (t) => 8 + 8.4 * t, false],
  ["物防、魔防", (t) => 3 + 2.1 * t, false],
  ["命中、迴避", (t) => 3 + 1.4 * t, false],
  ["暴擊率", (t) => 2 + 0.21 * t, true],
  ["暴擊傷害", (t) => 5 + 0.84 * t, true],
  ["攻速", (t) => 3 + 0.35 * t, true],
  ["經驗", (t) => 3 + 0.42 * t, true],
  ["掉寶率", (t) => 5 + 0.56 * t, true]
];
const RARITY_NAME = ["普通", "精良", "稀有", "史詩", "傳說", "神話"];
const QUALITY_P = [1, 0.6, 0.3, 0.1, 0.02];
function viewAffix() {
  const tier = Math.max(0, Math.min(19, S.afTier | 0));
  const et = effTierOf(tier);
  const locks = Math.max(0, Math.min(4, S.afLocks | 0));
  const deep = !!S.afDeep;
  const rarity = Math.max(0, Math.min(4, S.afRarity | 0));
  const rows = AFFIX_ROWS.map(([name, fn, pct]) => "<tr><td>" + esc(name) + "</td><td>" + affixSpan(fn(et), pct) + "</td></tr>").join("");
  const billRows = [0, 1, 2, 3, 4].map((n) => "<tr" + (n === locks ? " class=\"sel\"" : "") + "><td>" + n + "</td><td>" + goldText(reforgeBill(tier, false, n)) + "</td><td>" + goldText(reforgeBill(tier, true, n)) + "</td><td>" + (1 + n) + " 顆</td><td>" + n + " 張</td></tr>").join("");
  let stones = 0;
  let gold = 0;
  const steps = [];
  for (let r = rarity; r < 5; r++) {
    const tries = 1 / QUALITY_P[r];
    const once = qualityBill(tier, r);
    stones += tries;
    gold += once * tries;
    steps.push("<tr><td>" + esc(RARITY_NAME[r]) + " → " + esc(RARITY_NAME[r + 1]) + "</td><td>" + pctText(QUALITY_P[r]) + "%</td><td>" + goldText(once) + "</td><td>" + (Math.round(tries * 10) / 10) + "</td></tr>");
  }
  const tiers = TIER_NAMES.map((name, i) => "<option value=\"" + i + "\"" + (i === tier ? " selected" : "") + ">" + esc(name) + " · Lv." + (1 + 7 * i) + "</option>").join("");
  const rares = RARITY_NAME.slice(0, 5).map((name, i) => "<option value=\"" + i + "\"" + (i === rarity ? " selected" : "") + ">" + esc(name) + "，" + i + " 條</option>").join("");
  return "<article class=\"panel\"><h2>洗鍊</h2>"
    + "<div class=\"lvbox\"><label>裝備 <select id=\"afTier\" aria-label=\"裝備階級\">" + tiers + "</select></label>"
    + "<label>鎖定 <input id=\"afLocks\" type=\"number\" min=\"0\" max=\"4\" value=\"" + locks + "\"></label>"
    + "<label><input id=\"afDeep\" type=\"checkbox\"" + (deep ? " checked" : "") + "> 高級洗鍊，連種類一起換</label></div>"
    + "<p>這件現在洗一次：<b>" + goldText(reforgeBill(tier, deep, locks)) + "</b> 金幣，洗鍊石 <b>" + (1 + locks) + "</b> 顆" + (deep ? "（高級）" : "") + "，鎖定符 <b>" + locks + "</b> 張。不能把詞條全部鎖住。</p>"
    + "<p class=\"muted\">數值在最大值的一半到滿值之間隨機。百分比取一位小數，其他至少是 1。地圖 12 起用等效階級，所以同一條詞條會比前一張圖高約 12%，不是每張只加固定幾點。額外傷害詞條目前關著，洗不出來。首領專屬的固定詞條不能洗掉，隨機詞條固定 2 條，再加品質提升多出來的。</p>"
    + "<div class=\"tree-wrap\"><table><thead><tr><th>詞條</th><th>這階範圍</th></tr></thead><tbody>" + rows + "</tbody></table></div>"
    + "<h3 class=\"sec\">鎖定幾條</h3>"
    + "<div class=\"tree-wrap\"><table><thead><tr><th>鎖定</th><th>普通金幣</th><th>高級金幣</th><th>洗鍊石</th><th>鎖定符</th></tr></thead><tbody>" + billRows + "</tbody></table></div>"
    + "<h3 class=\"sec\">品質提升</h3>"
    + "<div class=\"lvbox\"><label>現在品質 <select id=\"afRarity\" aria-label=\"品質\">" + rares + "</select></label></div>"
    + "<p>從" + esc(RARITY_NAME[rarity]) + "升到神話，期望 <b>" + (Math.round(stones * 10) / 10) + "</b> 顆品質石、<b>" + goldText(Math.round(gold)) + "</b> 金幣。失敗只掉一顆石頭和這次的金幣，詞條不變。成功多一條詞條。普通 0 條、精良 1、稀有 2、史詩 3、傳說 4、神話 5。</p>"
    + "<div class=\"tree-wrap\"><table><thead><tr><th>這一次</th><th>成功率</th><th>金幣</th><th>期望次數</th></tr></thead><tbody>" + steps.join("") + "</tbody></table></div></article>";
}
const FULL_REFINE = [[7, 2], [9, 4], [10, 6], [11, 8], [12, 11], [13, 14], [14, 17], [15, 20]];
const SET_Q = [1, 1.25, 1.5, 1.85, 2.2, 2.5];
function setFullPct(tier, rarity) {
  return Math.round((2 + (6 * tier) / 19) * SET_Q[rarity] * 10) / 10;
}
function viewSet() {
  const tier = Math.max(0, Math.min(19, S.setTier | 0));
  const rarity = Math.max(0, Math.min(5, S.setRarity | 0));
  const count = Math.max(0, Math.min(8, S.setCount | 0));
  const ref = Math.max(0, Math.min(15, S.setRef | 0));
  const fullPct = setFullPct(tier, rarity);
  const four = Math.round(fullPct * 5) / 10;
  const setPct = count >= 8 ? fullPct : count >= 4 ? four : 0;
  let gearPct = 0;
  for (const [lv, pct] of FULL_REFINE) if (ref >= lv) gearPct = pct;
  const next = FULL_REFINE.find(([lv]) => lv > ref);
  const tiers = TIER_NAMES.map((name, i) => "<option value=\"" + i + "\"" + (i === tier ? " selected" : "") + ">" + esc(name) + "</option>").join("");
  const rares = RARITY_NAME.map((name, i) => "<option value=\"" + i + "\"" + (i === rarity ? " selected" : "") + ">" + esc(name) + "</option>").join("");
  const gearRows = FULL_REFINE.map(([lv, pct]) => "<tr" + (ref >= lv && (FULL_REFINE.find(([n]) => n > lv) || [99])[0] > ref ? " class=\"sel\"" : "") + "><td>八件都 ≥ +" + lv + "</td><td>攻擊、生命 +" + pct + "%</td></tr>").join("");
  return "<article class=\"panel\"><h2>套裝和全身強化</h2>"
    + "<div class=\"lvbox\"><label>系列 <select id=\"setTier\">" + tiers + "</select></label>"
    + "<label>這套最低品質 <select id=\"setRarity\">" + rares + "</select></label>"
    + "<label>件數 <input id=\"setCount\" type=\"number\" min=\"0\" max=\"8\" value=\"" + count + "\"></label>"
    + "<label>八件裡最低強化 <input id=\"setRef\" type=\"number\" min=\"0\" max=\"15\" value=\"" + ref + "\"></label></div>"
    + "<div class=\"kv\">"
    + "<div><b>套裝</b><br>" + (setPct ? "攻擊、生命 +" + setPct + "%" : "不到 4 件，沒有") + "</div>"
    + "<div><b>全身強化</b><br>" + (gearPct ? "攻擊、生命 +" + gearPct + "%" : "八件還沒同時到 +7") + "</div>"
    + "<div><b>加在一起</b><br>攻擊、生命 +" + (Math.round((setPct + gearPct) * 10) / 10) + "%</div>"
    + "</div>"
    + "<p class=\"muted\">只算武器、頭、身體、手、腳、披風、戒指、項鍊。副手不算。首領專屬算它掉落的那張圖。4 到 7 件都是 8 件效果的一半，5 件不會比 4 件高。8 件才是滿的。品質看這一套裡最低的那件。身上若有兩套，只算加得比較多的那套。全身強化也只算達到的最高一階，+7 的 2% 不會再和 +15 的 20% 相加。" + (next ? " 下一階全身強化是八件都到 +" + next[0] + "，攻擊和生命 +" + next[1] + "%。" : " 已經是全身 +15。") + "</p>"
    + "<p>這張圖 4 件是 +" + four + "%，8 件是 +" + fullPct + "%。品質從普通到神話的倍率是 1、1.25、1.5、1.85、2.2、2.5，乘在（2 ＋ 6 × 階級 ÷ 19）上。</p>"
    + "<div class=\"tree-wrap\"><table><thead><tr><th>條件</th><th>加成</th></tr></thead><tbody>" + gearRows + "</tbody></table></div></article>";
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
  const t = e.target.closest("[data-tab],[data-line],[data-job],[data-openskill],[data-skilljob],[data-show],[data-up],[data-down],[data-max],[data-clear],[data-fill],[data-swap],[data-wid],[data-gearjob],[data-pt],[data-ptreset],[data-ptpour],#copy");
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
  if (t.dataset.pt) {
    const k = t.dataset.pt;
    const dir = Number(t.dataset.pd) || 0;
    const v = S.pts[k] || 5;
    if (dir < 0 && v > 5) S.pts[k] = v - 1;
    if (dir > 0 && v < 200) {
      const left = pointBudget(Math.max(1, Math.min(150, S.stLv | 0))) - pointsSpent();
      if (left >= pointCost(v)) S.pts[k] = v + 1;
    }
    render();
    return;
  }
  if (t.hasAttribute("data-ptreset")) {
    for (const k of STAT_KEYS) S.pts[k] = 5;
    render();
    return;
  }
  if (t.hasAttribute("data-ptpour")) {
    const job = JOB[S.stJob] || JOB.paladin;
    const fam = (job.weapons || [])[0];
    const key = job.magic ? "int" : ["弓", "火銃", "卡牌"].includes(fam) ? "dex" : "str";
    for (let guard = 0; guard < 400; guard++) {
      const v = S.pts[key];
      if (v >= 200) break;
      const left = pointBudget(Math.max(1, Math.min(150, S.stLv | 0))) - pointsSpent();
      if (left < pointCost(v)) break;
      S.pts[key] = v + 1;
    }
    render();
    return;
  }
  if (t.dataset.gearjob) {
    S.tab = "gear";
    S.wjob = t.dataset.gearjob;
    S.wid = "";
    setHash("gear", false);
    render();
    return;
  }
  if (t.dataset.wid) {
    S.wid = t.dataset.wid;
    S.tab = "gear";
    setHash("gear/" + S.wid, true);
    render({ scroll: true });
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
  if (t.id === "wjob") {
    S.wjob = t.value;
    S.wid = "";
    render();
    return;
  }
  if (t.id === "ref" || t.id === "refRange") {
    const n = Math.max(0, Math.min(window.WEAPONS ? WEAPONS.max : 15, parseInt(t.value, 10) || 0));
    S.ref = n;
    render();
    return;
  }
  if (t.id === "capAspd" || t.id === "capAspdRange") {
    S.capAspd = Math.max(0.2, Math.min(4, Number(t.value) || 0));
    render();
    return;
  }
  if (t.id === "capLv") { S.capLv = Math.max(1, Math.min(150, parseInt(t.value, 10) || 1)); render(); return; }
  if (t.id === "capHit") { S.capHit = Math.max(0, parseInt(t.value, 10) || 0); render(); return; }
  if (t.id === "capKind") { S.capKind = t.value; render(); return; }
  if (t.id === "capCrit") { S.capCrit = Math.max(0, Number(t.value) || 0); render(); return; }
  if (t.id === "capRank") { S.capRank = t.value; render(); return; }
  if (t.id === "stLv") { S.stLv = Math.max(1, Math.min(150, parseInt(t.value, 10) || 1)); render(); return; }
  if (t.id === "stJob") { S.stJob = t.value; render(); return; }
  if (t.id === "rfFrom") { S.rfFrom = Math.max(0, Math.min(15, parseInt(t.value, 10) || 0)); render(); return; }
  if (t.id === "rfTo") { S.rfTo = Math.max(0, Math.min(15, parseInt(t.value, 10) || 0)); render(); return; }
  if (t.id === "rfTier") { S.rfTier = Math.max(0, Math.min(19, parseInt(t.value, 10) || 0)); render(); return; }
  if (t.id === "rfKind") { S.rfKind = t.value; render(); return; }
  if (t.id === "rfBless") { S.rfBless = t.checked; render(); return; }
  if (t.id === "rfDust") { S.rfDust = t.checked; render(); return; }
  if (t.id === "rfCharm") { S.rfCharm = t.value; render(); return; }
  if (t.id === "afTier") { S.afTier = Math.max(0, Math.min(19, parseInt(t.value, 10) || 0)); render(); return; }
  if (t.id === "afLocks") { S.afLocks = Math.max(0, Math.min(4, parseInt(t.value, 10) || 0)); render(); return; }
  if (t.id === "afDeep") { S.afDeep = t.checked; render(); return; }
  if (t.id === "afRarity") { S.afRarity = Math.max(0, Math.min(4, parseInt(t.value, 10) || 0)); render(); return; }
  if (t.id === "setTier") { S.setTier = Math.max(0, Math.min(19, parseInt(t.value, 10) || 0)); render(); return; }
  if (t.id === "setRarity") { S.setRarity = Math.max(0, Math.min(5, parseInt(t.value, 10) || 0)); render(); return; }
  if (t.id === "setCount") { S.setCount = Math.max(0, Math.min(8, parseInt(t.value, 10) || 0)); render(); return; }
  if (t.id === "setRef") { S.setRef = Math.max(0, Math.min(15, parseInt(t.value, 10) || 0)); render(); return; }
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
  if (e.target.id === "capAspdRange") {
    const label = document.getElementById("capAspd");
    if (label) label.value = e.target.value;
    return;
  }
  if (e.target.id === "refRange") {
    const label = document.getElementById("ref");
    const live = document.getElementById("refLive");
    if (label) label.value = e.target.value;
    if (live) live.textContent = "+" + e.target.value;
    return;
  }
  if (e.target.id === "lvRange") {
    const label = document.getElementById("lv");
    if (label) label.value = e.target.value;
  }
}
document.getElementById("ver").textContent = "客戶端 " + DATA.version + " · " + DATA.captured + " · 57 職 · " + DATA.skills.length + " 招" + (window.WEAPONS ? " · " + WEAPONS.weapons.length + " 把首領武器" : "");
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