(() => {
  const STORAGE_KEY = "focusflow.state.v1";
  const CIRCUMFERENCE = 2 * Math.PI * 108;

  const defaultState = () => ({
    tasks: [],
    activeTaskId: null,
    durations: { focus: 25, short: 5, long: 15 },
    streak: 0,
    lastCompletionDay: null,
    todayCount: 0,
    todayDay: null,
  });

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return { ...defaultState(), ...parsed };
    } catch {
      return defaultState();
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }

  function dayDiff(aKey, bKey) {
    // returns bKey - aKey in whole days, keys are "Y-M-D"
    const [ay, am, ad] = aKey.split("-").map(Number);
    const [by, bm, bd] = bKey.split("-").map(Number);
    const a = new Date(ay, am, ad);
    const b = new Date(by, bm, bd);
    return Math.round((b - a) / 86400000);
  }

  let state = loadState();

  // Reset today's count if the day rolled over
  const tk = todayKey();
  if (state.todayDay !== tk) {
    state.todayDay = tk;
    state.todayCount = 0;
  }
  // Streak decays if more than a day has passed with no session
  if (state.lastCompletionDay && dayDiff(state.lastCompletionDay, tk) > 1) {
    state.streak = 0;
  }
  saveState();

  const els = {
    streakCount: document.getElementById("streakCount"),
    todayCount: document.getElementById("todayCount"),
    modeTabs: [...document.querySelectorAll(".mode-tab")],
    activeTaskLabel: document.getElementById("activeTaskLabel"),
    ringProgress: document.getElementById("ringProgress"),
    timeDisplay: document.getElementById("timeDisplay"),
    startPauseBtn: document.getElementById("startPauseBtn"),
    resetBtn: document.getElementById("resetBtn"),
    skipBtn: document.getElementById("skipBtn"),
    presets: [...document.querySelectorAll(".preset[data-focus]")],
    customToggle: document.getElementById("customToggle"),
    customForm: document.getElementById("customForm"),
    customFocus: document.getElementById("customFocus"),
    customShort: document.getElementById("customShort"),
    customLong: document.getElementById("customLong"),
    taskForm: document.getElementById("taskForm"),
    taskInput: document.getElementById("taskInput"),
    taskList: document.getElementById("taskList"),
    emptyHint: document.getElementById("emptyHint"),
  };

  els.ringProgress.style.strokeDasharray = String(CIRCUMFERENCE);

  let mode = "focus"; // focus | short | long
  let remaining = state.durations.focus * 60;
  let total = remaining;
  let running = false;
  let timerId = null;

  function minutesFor(m) {
    return state.durations[m] * 60;
  }

  function formatTime(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = Math.floor(sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  function updateRing() {
    const frac = total > 0 ? remaining / total : 0;
    els.ringProgress.style.strokeDashoffset = String(CIRCUMFERENCE * (1 - frac));
    els.ringProgress.style.stroke = mode === "focus" ? "var(--accent)" : "var(--break)";
  }

  function render() {
    els.timeDisplay.textContent = formatTime(remaining);
    updateRing();
    els.streakCount.textContent = state.streak;
    els.todayCount.textContent = state.todayCount;
    els.startPauseBtn.textContent = running ? "Pause" : "Start";

    els.modeTabs.forEach(tab => tab.classList.toggle("active", tab.dataset.mode === mode));

    const activeTask = state.tasks.find(t => t.id === state.activeTaskId);
    if (activeTask) {
      els.activeTaskLabel.textContent = `Focusing on: ${activeTask.name}`;
      els.activeTaskLabel.classList.add("set");
    } else {
      els.activeTaskLabel.textContent = mode === "focus" ? "No task selected" : "Break time";
      els.activeTaskLabel.classList.remove("set");
    }

    renderTasks();
    syncPresetActiveState();
    document.title = running ? `${formatTime(remaining)} · Focus Flow` : "Focus Flow";
  }

  function syncPresetActiveState() {
    const matched = els.presets.find(btn =>
      Number(btn.dataset.focus) === state.durations.focus &&
      Number(btn.dataset.short) === state.durations.short &&
      Number(btn.dataset.long) === state.durations.long
    );
    els.presets.forEach(btn => btn.classList.toggle("active", btn === matched));
    els.customToggle.classList.toggle("active", !matched);
  }

  function renderTasks() {
    els.taskList.innerHTML = "";
    els.emptyHint.style.display = state.tasks.length ? "none" : "block";
    state.tasks.forEach(task => {
      const li = document.createElement("li");
      li.className = "task-item" + (task.id === state.activeTaskId ? " active" : "");
      li.innerHTML = `
        <span class="task-radio"></span>
        <span class="task-name"></span>
        <span class="task-pips">${task.sessions} 🍅</span>
        <button class="task-delete" title="Delete task">×</button>
      `;
      li.querySelector(".task-name").textContent = task.name;
      li.addEventListener("click", (e) => {
        if (e.target.closest(".task-delete")) return;
        state.activeTaskId = task.id === state.activeTaskId ? null : task.id;
        saveState();
        render();
      });
      li.querySelector(".task-delete").addEventListener("click", () => {
        state.tasks = state.tasks.filter(t => t.id !== task.id);
        if (state.activeTaskId === task.id) state.activeTaskId = null;
        saveState();
        render();
      });
      els.taskList.appendChild(li);
    });
  }

  function switchMode(newMode, { autoStart = false } = {}) {
    mode = newMode;
    remaining = minutesFor(mode);
    total = remaining;
    running = false;
    clearInterval(timerId);
    render();
    if (autoStart) toggleRunning();
  }

  function beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = 660;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.55);
    } catch {
      /* audio not available */
    }
  }

  function completeSession() {
    clearInterval(timerId);
    running = false;
    beep();

    if (mode === "focus") {
      const task = state.tasks.find(t => t.id === state.activeTaskId);
      if (task) task.sessions += 1;

      const key = todayKey();
      if (state.todayDay !== key) {
        state.todayDay = key;
        state.todayCount = 0;
      }
      state.todayCount += 1;

      if (state.lastCompletionDay !== key) {
        const gap = state.lastCompletionDay ? dayDiff(state.lastCompletionDay, key) : null;
        state.streak = gap === 1 || gap === null ? state.streak + 1 : 1;
        state.lastCompletionDay = key;
      }
      saveState();
      switchMode("short");
    } else {
      switchMode("focus");
    }
  }

  function tick() {
    remaining -= 1;
    if (remaining <= 0) {
      remaining = 0;
      render();
      completeSession();
      return;
    }
    render();
  }

  function toggleRunning() {
    running = !running;
    if (running) {
      timerId = setInterval(tick, 1000);
    } else {
      clearInterval(timerId);
    }
    render();
  }

  els.startPauseBtn.addEventListener("click", toggleRunning);

  els.resetBtn.addEventListener("click", () => {
    running = false;
    clearInterval(timerId);
    remaining = minutesFor(mode);
    total = remaining;
    render();
  });

  els.skipBtn.addEventListener("click", () => {
    clearInterval(timerId);
    running = false;
    if (mode === "focus") switchMode("short");
    else switchMode("focus");
  });

  els.modeTabs.forEach(tab => {
    tab.addEventListener("click", () => switchMode(tab.dataset.mode));
  });

  els.presets.forEach(btn => {
    btn.addEventListener("click", () => {
      state.durations = {
        focus: Number(btn.dataset.focus),
        short: Number(btn.dataset.short),
        long: Number(btn.dataset.long),
      };
      saveState();
      els.customForm.hidden = true;
      switchMode(mode);
    });
  });

  els.customToggle.addEventListener("click", () => {
    els.customFocus.value = state.durations.focus;
    els.customShort.value = state.durations.short;
    els.customLong.value = state.durations.long;
    els.customForm.hidden = !els.customForm.hidden;
    if (!els.customForm.hidden) els.customFocus.focus();
  });

  els.customForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const clamp = (val, min, max) => Math.min(max, Math.max(min, Math.round(val)));
    const focus = clamp(Number(els.customFocus.value) || 1, 1, 180);
    const short = clamp(Number(els.customShort.value) || 1, 1, 60);
    const long = clamp(Number(els.customLong.value) || 1, 1, 90);
    state.durations = { focus, short, long };
    saveState();
    els.customForm.hidden = true;
    switchMode(mode);
  });

  els.taskForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = els.taskInput.value.trim();
    if (!name) return;
    const task = { id: crypto.randomUUID(), name, sessions: 0 };
    state.tasks.push(task);
    state.activeTaskId = task.id;
    els.taskInput.value = "";
    saveState();
    render();
  });

  render();
})();
