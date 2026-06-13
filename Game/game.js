// ── GAME STATE ──
let state = {
  wizardName: "Wizard",
  hp: 5,
  maxHp: 5,
  score: 0,
  level: 1,
  monsterIndex: 0,
  monsterHp: 3,
  monsterMaxHp: 3,
  streak: 0,
  questionsAnswered: 0,
  questionsCorrect: 0,
  usedQuestions: new Set(),
  currentQuestion: null,
  filterCategory: null,
  gamePhase: "title", // title | category | battle | levelup | end
};

// ── UTILITIES ──
function $(id) { return document.getElementById(id); }

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  $(id).classList.add("active");
}

function getCategoryClass(cat) {
  const map = {
    "Vocabulary": "cat-vocabulary",
    "Literary Elements": "cat-literary",
    "Comprehension": "cat-comprehension",
    "Grammar": "cat-grammar",
    "Text Structure": "cat-text"
  };
  return map[cat] || "cat-vocabulary";
}

function getDiffStars(d) {
  return "⭐".repeat(d) + "☆".repeat(3 - d);
}

function getSpell() {
  return SPELLS[Math.floor(Math.random() * SPELLS.length)];
}

function getMonster() {
  return MONSTERS[state.monsterIndex % MONSTERS.length];
}

function getWizardEmoji() {
  const wizards = ["🧙‍♀️", "🧙‍♂️", "🧝‍♀️", "🧝‍♂️"];
  return wizards[0];
}

// ── QUESTION PICKER ──
function pickQuestion() {
  let pool = QUESTIONS.filter((_, i) => !state.usedQuestions.has(i));
  if (state.filterCategory) {
    const catPool = pool.filter(q => q.category === state.filterCategory);
    if (catPool.length > 0) pool = catPool;
  }
  if (pool.length === 0) {
    state.usedQuestions.clear();
    pool = QUESTIONS.slice();
  }
  const idx = QUESTIONS.indexOf(pool[Math.floor(Math.random() * pool.length)]);
  state.usedQuestions.add(idx);
  return { ...QUESTIONS[idx], _idx: idx };
}

// ── RENDER HUD ──
function renderHud() {
  $("hud-name").textContent = state.wizardName;
  $("hud-score").textContent = state.score;
  $("hud-level").textContent = state.level;
  $("hud-streak").textContent = state.streak > 1 ? `🔥 ${state.streak}x` : "--";

  const playerPct = (state.hp / state.maxHp) * 100;
  $("player-hp-fill").style.width = playerPct + "%";
  $("player-hp-text").textContent = `${state.hp}/${state.maxHp}`;

  const monster = getMonster();
  const monsterPct = (state.monsterHp / state.monsterMaxHp) * 100;
  $("monster-hp-fill").style.width = monsterPct + "%";
  $("monster-hp-text").textContent = `${state.monsterHp}/${state.monsterMaxHp}`;
}

// ── RENDER ARENA ──
function renderArena() {
  const monster = getMonster();
  $("player-emoji").textContent = getWizardEmoji();
  $("player-name-label").textContent = state.wizardName;
  $("monster-emoji").textContent = monster.emoji;
  $("monster-name-label").textContent = monster.name;
  renderHearts("player-hearts", state.hp, state.maxHp, "player");
  renderHearts("monster-hearts", state.monsterHp, state.monsterMaxHp, "monster");
}

function renderHearts(containerId, hp, maxHp, who) {
  const el = $(containerId);
  el.innerHTML = "";
  for (let i = 0; i < maxHp; i++) {
    const span = document.createElement("span");
    span.className = "hp-heart";
    span.textContent = i < hp ? "❤️" : "🖤";
    el.appendChild(span);
  }
}

// ── RENDER QUESTION ──
function renderQuestion() {
  const q = state.currentQuestion;
  const catClass = getCategoryClass(q.category);

  $("q-category").textContent = q.category;
  $("q-category").className = `category-badge ${catClass}`;
  $("q-difficulty").textContent = getDiffStars(q.difficulty);
  $("q-text").textContent = q.question;

  const grid = $("options-grid");
  grid.innerHTML = "";
  q.options.forEach((opt, i) => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.textContent = `${["A", "B", "C", "D"][i]}. ${opt}`;
    btn.onclick = () => handleAnswer(i);
    grid.appendChild(btn);
  });

  $("feedback-box").className = "feedback-box";
  $("feedback-box").innerHTML = "";
  $("next-btn-wrap").className = "next-btn-wrap";
}

// ── HANDLE ANSWER ──
function handleAnswer(chosen) {
  const q = state.currentQuestion;
  const buttons = document.querySelectorAll(".option-btn");
  buttons.forEach(b => b.disabled = true);

  state.questionsAnswered++;
  const correct = chosen === q.answer;

  buttons[q.answer].classList.add("correct");
  if (!correct) buttons[chosen].classList.add("wrong");

  const fb = $("feedback-box");

  if (correct) {
    state.questionsCorrect++;
    state.streak++;
    const bonus = state.streak > 2 ? Math.floor(state.streak * 0.5) : 0;
    const points = (10 * q.difficulty) + bonus;
    state.score += points;

    // Attack monster
    state.monsterHp = Math.max(0, state.monsterHp - 1);

    fb.className = "feedback-box correct";
    fb.innerHTML = `<div class="feedback-title">✅ Correct! +${points} points${bonus > 0 ? ` (🔥 streak bonus +${bonus})` : ""}</div><div>${q.explanation}</div>`;

    // Spell animation
    const spell = getSpell();
    const flash = $("spell-flash");
    flash.textContent = spell.emoji;
    flash.classList.add("animate");
    setTimeout(() => flash.classList.remove("animate"), 700);

    // Player attacks
    const playerEl = $("player-fighter");
    playerEl.classList.add("attack");
    setTimeout(() => playerEl.classList.remove("attack"), 400);

  } else {
    state.streak = 0;
    state.hp = Math.max(0, state.hp - 1);

    fb.className = "feedback-box wrong";
    fb.innerHTML = `<div class="feedback-title">❌ Not quite! The answer was: ${["A","B","C","D"][q.answer]}.</div><div>${q.explanation}</div>`;

    // Monster attacks back
    const monsterEl = $("monster-fighter");
    monsterEl.classList.add("attack");
    setTimeout(() => monsterEl.classList.remove("attack"), 400);

    const playerEl = $("player-fighter");
    playerEl.classList.add("shake");
    setTimeout(() => playerEl.classList.remove("shake"), 500);
  }

  renderHud();
  renderArena();
  $("next-btn-wrap").className = "next-btn-wrap show";

  // Check win/lose conditions
  if (state.monsterHp <= 0) {
    $("next-btn").textContent = "🎉 Monster Defeated! Continue →";
    $("next-btn").dataset.action = "monsterDefeated";
  } else if (state.hp <= 0) {
    $("next-btn").textContent = "💀 You fell... Try again!";
    $("next-btn").dataset.action = "gameOver";
  } else {
    $("next-btn").textContent = "Next Question →";
    $("next-btn").dataset.action = "next";
  }
}

// ── NEXT BUTTON ──
function handleNext() {
  const action = $("next-btn").dataset.action || "next";

  if (action === "gameOver") {
    showEndScreen(false);
    return;
  }

  if (action === "monsterDefeated") {
    state.monsterIndex++;
    state.level++;

    if (state.monsterIndex >= MONSTERS.length) {
      showEndScreen(true);
      return;
    }

    // Level up!
    const monster = getMonster();
    state.monsterHp = monster.hp;
    state.monsterMaxHp = monster.hp;
    state.hp = Math.min(state.maxHp, state.hp + 2); // heal 2 on level up

    showLevelUp(monster);
    return;
  }

  // Normal next question
  state.currentQuestion = pickQuestion();
  renderQuestion();
  renderHud();
  renderArena();
}

// ── LEVEL UP ──
function showLevelUp(monster) {
  const overlay = $("level-up-overlay");
  $("lu-monster-emoji").textContent = monster.emoji;
  $("lu-monster-name").textContent = monster.name;
  $("lu-level").textContent = state.level;
  overlay.classList.add("show");
}

function dismissLevelUp() {
  $("level-up-overlay").classList.remove("show");
  state.currentQuestion = pickQuestion();
  renderQuestion();
  renderHud();
  renderArena();
}

// ── END SCREEN ──
function showEndScreen(won) {
  const accuracy = state.questionsAnswered > 0
    ? Math.round((state.questionsCorrect / state.questionsAnswered) * 100)
    : 0;

  $("end-trophy").textContent = won ? "🏆" : "💀";
  $("end-title").textContent = won
    ? `${state.wizardName} Wins!`
    : `${state.wizardName} Fell...`;
  $("end-subtitle").textContent = won
    ? "You defeated all the monsters! Amazing ELA skills!"
    : `You made it to Level ${state.level}. Keep practicing!`;

  $("end-score").textContent = state.score;
  $("end-accuracy").textContent = accuracy + "%";
  $("end-streak").textContent = state.questionsCorrect;

  showScreen("end-screen");
}

// ── CATEGORY SCREEN ──
function showCategoryScreen() {
  const categories = [
    { key: null, label: "All Topics", icon: "✨", desc: "Mix of everything" },
    { key: "Vocabulary", label: "Vocabulary", icon: "📖", desc: `${QUESTIONS.filter(q => q.category === "Vocabulary").length} questions` },
    { key: "Literary Elements", label: "Literary Elements", icon: "📚", desc: `${QUESTIONS.filter(q => q.category === "Literary Elements").length} questions` },
    { key: "Comprehension", label: "Comprehension", icon: "🔍", desc: `${QUESTIONS.filter(q => q.category === "Comprehension").length} questions` },
    { key: "Grammar", label: "Grammar", icon: "✏️", desc: `${QUESTIONS.filter(q => q.category === "Grammar").length} questions` },
    { key: "Text Structure", label: "Text Structure", icon: "🗂️", desc: `${QUESTIONS.filter(q => q.category === "Text Structure").length} questions` },
  ];

  const grid = $("cat-grid");
  grid.innerHTML = "";
  const colors = [
    "rgba(127,119,221,0.2)", "rgba(127,119,221,0.15)",
    "rgba(212,83,126,0.15)", "rgba(29,158,117,0.15)",
    "rgba(239,159,39,0.15)", "rgba(55,138,221,0.15)"
  ];

  categories.forEach((cat, i) => {
    const div = document.createElement("div");
    div.className = "cat-option";
    div.style.background = colors[i];
    div.innerHTML = `
      <div class="cat-icon">${cat.icon}</div>
      <div class="cat-title">${cat.label}</div>
      <div class="cat-count">${cat.desc}</div>
    `;
    div.onclick = () => startGame(cat.key);
    grid.appendChild(div);
  });

  showScreen("category-screen");
}

// ── START GAME ──
function startGame(category = null) {
  const name = ($("wizard-name").value.trim() || "Wizard").slice(0, 20);
  const monster = MONSTERS[0];

  state = {
    wizardName: name,
    hp: 5,
    maxHp: 5,
    score: 0,
    level: 1,
    monsterIndex: 0,
    monsterHp: monster.hp,
    monsterMaxHp: monster.hp,
    streak: 0,
    questionsAnswered: 0,
    questionsCorrect: 0,
    usedQuestions: new Set(),
    filterCategory: category,
    gamePhase: "battle",
  };

  state.currentQuestion = pickQuestion();
  renderQuestion();
  renderHud();
  renderArena();
  showScreen("game-screen");
}

// ── INIT ──
document.addEventListener("DOMContentLoaded", () => {
  showScreen("title-screen");

  $("start-btn").onclick = () => showCategoryScreen();

  $("wizard-name").addEventListener("keydown", (e) => {
    if (e.key === "Enter") showCategoryScreen();
  });

  $("next-btn").onclick = () => handleNext();
  $("lu-continue-btn").onclick = () => dismissLevelUp();
  $("play-again-btn").onclick = () => {
    showScreen("title-screen");
  };
});