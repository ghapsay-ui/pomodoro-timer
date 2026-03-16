/**
 * Pomodoro Timer Pro - Orchestrated Version 5.4 (Final & Bulletproof)
 * Fix: Nuclear JSON Serialization to prevent DataCloneError on BroadcastChannel.
 */

import { createStore } from 'https://esm.sh/zustand@4.5.2/vanilla';
import { persist, createJSONStorage } from 'https://esm.sh/zustand@4.5.2/middleware';

// --- 1. TECHNICAL CORE: WORKER & HARDWARE ---

const workerCode = `
    let timerId = null;
    self.onmessage = (e) => {
        if (e.data.command === 'START') {
            if (timerId) clearInterval(timerId);
            timerId = setInterval(() => self.postMessage('TICK'), 1000);
        } else if (e.data.command === 'STOP') {
            clearInterval(timerId);
            timerId = null;
        }
    };
`;
const blob = new Blob([workerCode], { type: 'application/javascript' });
const timerWorker = new Worker(URL.createObjectURL(blob));

const syncChannel = new BroadcastChannel('pomodoro_pro_sync');
let wakeLock = null;

class HardwareManager {
    constructor() { this.port = null; this.writer = null; }
    async connect() {
        if (!("serial" in navigator)) return alert("WebSerial not supported.");
        try {
            this.port = await navigator.serial.requestPort();
            await this.port.open({ baudRate: 9600 });
            this.writer = this.port.writable.getWriter();
            const dot = document.getElementById('hardware-status');
            if (dot) dot.className = 'status-dot connected';
        } catch (err) { console.error("Hardware Sync Failed", err); }
    }
    async sendCommand(cmd) {
        if (!this.writer) return;
        try {
            const data = new TextEncoder().encode(cmd);
            await this.writer.write(data);
        } catch (err) { console.warn("Serial Write Failed", err); }
    }
}

const hardware = new HardwareManager();

const requestWakeLock = async () => {
    if ('wakeLock' in navigator && !wakeLock) {
        try { wakeLock = await navigator.wakeLock.request('screen'); } 
        catch (err) { console.warn("Wake Lock blocked."); }
    }
};

const releaseWakeLock = () => {
    if (wakeLock) { wakeLock.release().then(() => wakeLock = null); }
};

// --- 2. THE ORCHESTRATION ENGINE (STATE) ---

const timerStore = createStore(
    persist(
        (set, get) => ({
            timeLeft: 1500,
            workDuration: 25,
            breakDuration: 5,
            isActive: false,
            isBreathing: false,
            mode: 'work',
            rhythmMode: 'pomodoro',
            sessionsCompleted: 0,
            distractionCount: 0,
            eyeRestsCompleted: 0,
            tasks: [],
            currentIntention: "",
            nextMicroStep: "",
            expectedEndTime: null,
            isEyeResting: false,
            eyeRestTimeLeft: 20,
            activeWorkSeconds: 0,

            applyExternalSync: (data) => {
                const { type, payload } = data;
                if (type === 'STATE_UPDATE') {
                    set({ ...payload });
                    if (payload.isActive) timerWorker.postMessage({ command: 'START' });
                    else timerWorker.postMessage({ command: 'STOP' });
                }
            },

            broadcast: (overrides = {}) => {
                const state = get();
                
                // NUCLEAR FIX: JSON serialization strips ALL functions/symbols.
                // This is the only 100% way to prevent DataCloneError.
                const dataOnly = JSON.parse(JSON.stringify({
                    timeLeft: state.timeLeft,
                    isActive: state.isActive,
                    isBreathing: state.isBreathing,
                    mode: state.mode,
                    rhythmMode: state.rhythmMode,
                    expectedEndTime: state.expectedEndTime,
                    currentIntention: state.currentIntention,
                    nextMicroStep: state.nextMicroStep,
                    activeWorkSeconds: state.activeWorkSeconds,
                    isEyeResting: state.isEyeResting,
                    eyeRestTimeLeft: state.eyeRestTimeLeft,
                    ...overrides
                }));

                syncChannel.postMessage({
                    type: 'STATE_UPDATE',
                    payload: dataOnly
                });
            },

            setIntention: (text) => {
                set({ currentIntention: text });
                get().broadcast();
            },

            startTimer: async (isSync = false, force = false) => {
                const state = get();
                if (!force && (state.isActive || state.isBreathing)) return;

                await requestWakeLock();
                const endTime = Date.now() + (state.timeLeft * 1000);
                set({ isActive: true, expectedEndTime: endTime });
                timerWorker.postMessage({ command: 'START' });

                if (!isSync) get().broadcast({ isActive: true, expectedEndTime: endTime });
            },

            pauseTimer: (isSync = false) => {
                timerWorker.postMessage({ command: 'STOP' });
                releaseWakeLock();
                set({ isActive: false, expectedEndTime: null });
                if (!isSync) get().broadcast({ isActive: false, expectedEndTime: null });
            },

            resetTimer: (isSync = false) => {
                get().pauseTimer(true);
                const duration = get().mode === 'work' ? get().workDuration : get().breakDuration;
                set({ timeLeft: duration * 60, expectedEndTime: null, activeWorkSeconds: 0 });
                if (!isSync) get().broadcast({ timeLeft: duration * 60, expectedEndTime: null });
            },

            updateRhythmMode: (mode) => {
                const isUltradian = mode === 'ultradian';
                const work = isUltradian ? 90 : 25;
                const breakTime = isUltradian ? 20 : 5;
                set({ rhythmMode: mode, workDuration: work, breakDuration: breakTime, timeLeft: work * 60 });
                get().broadcast();
            },

            tick: () => {
                const { expectedEndTime, isActive, mode, isEyeResting, activeWorkSeconds } = get();
                if (!expectedEndTime || !isActive) return;

                const remaining = Math.round((expectedEndTime - Date.now()) / 1000);
                if (remaining >= 0) {
                    set({ timeLeft: remaining });
                    if (mode === 'work' && !isEyeResting) {
                        const newActive = activeWorkSeconds + 1;
                        set({ activeWorkSeconds: newActive });
                        if (newActive > 0 && newActive % 1200 === 0) get().triggerEyeRest();
                    }
                    if (isEyeResting) {
                        const restLeft = get().eyeRestTimeLeft - 1;
                        if (restLeft <= 0) set({ isEyeResting: false, eyeRestTimeLeft: 20, eyeRestsCompleted: get().eyeRestsCompleted + 1 });
                        else set({ eyeRestTimeLeft: restLeft });
                    }
                } else {
                    get().triggerTransition();
                }
            },

            triggerEyeRest: () => {
                set({ isEyeResting: true, eyeRestTimeLeft: 20 });
                new Audio('https://actions.google.com/sounds/v1/scifi/beep_mellow.ogg').play().catch(() => {});
                get().broadcast({ isEyeResting: true, eyeRestTimeLeft: 20 });
            },

            triggerTransition: (isSync = false) => {
                const { mode, workDuration, breakDuration, sessionsCompleted } = get();
                const nextStepInput = document.getElementById('next-step-input');
                const nextStep = nextStepInput ? nextStepInput.value.trim() : "";
                
                get().pauseTimer(true);
                new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg').play().catch(() => {}); 
                
                set({ isBreathing: true, nextMicroStep: mode === 'work' ? nextStep : "" });
                if (!isSync) get().broadcast({ isBreathing: true, nextMicroStep: get().nextMicroStep });

                setTimeout(() => {
                    const nextMode = mode === 'work' ? 'break' : 'work';
                    const nextDuration = nextMode === 'work' ? workDuration : breakDuration;
                    const finalState = { 
                        isBreathing: false, mode: nextMode, timeLeft: nextDuration * 60,
                        sessionsCompleted: mode === 'work' ? sessionsCompleted + 1 : sessionsCompleted,
                        currentIntention: "", expectedEndTime: null, activeWorkSeconds: 0
                    };
                    set(finalState);
                    if (!isSync) get().broadcast(finalState);
                }, 15000);
            },

            calculateFlowScore: () => {
                const { sessionsCompleted, distractionCount } = get();
                if (sessionsCompleted === 0) return 0;
                return Math.round((sessionsCompleted / (sessionsCompleted + (distractionCount * 0.5))) * 100);
            },

            getFlowInsight: (score) => {
                if (score >= 90) return "Exceptional Focus. You are in 'Hyper-Flow'.";
                if (score >= 70) return "Strong Performance. Cognitive endurance is high.";
                return "Entropy detected. Use the 20-20-20 rule to reset.";
            },

            addTask: (text) => { set(state => ({ tasks: [...state.tasks, { id: crypto.randomUUID(), text, completed: false }] })); get().broadcast(); },
            toggleTask: (id) => { set(state => ({ tasks: state.tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t) })); get().broadcast(); },
            deleteTask: (id) => { set(state => ({ tasks: state.tasks.filter(t => t.id !== id) })); get().broadcast(); },
            logDistraction: () => { if (get().isActive && get().mode === 'work') { set(state => ({ distractionCount: state.distractionCount + 1 })); get().broadcast(); } },
            clearProgress: () => { if (confirm("Reset all data?")) { set({ sessionsCompleted: 0, distractionCount: 0, tasks: [], eyeRestsCompleted: 0 }); get().resetTimer(); get().broadcast(); } }
        }),
        {
            name: 'pomodoro-pro-storage',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({ 
                sessionsCompleted: state.sessionsCompleted, tasks: state.tasks,
                workDuration: state.workDuration, breakDuration: state.breakDuration,
                distractionCount: state.distractionCount, eyeRestsCompleted: state.eyeRestsCompleted
            }),
        }
    )
);

// --- 3. DOM INTERFACE & SECURE RENDERING ---

const elements = {
    timeLeft: document.getElementById('time-left'),
    currentPhase: document.getElementById('current-phase'),
    sessionCount: document.getElementById('session-count'),
    startBtn: document.getElementById('start-btn'),
    pauseBtn: document.getElementById('pause-btn'),
    resetBtn: document.getElementById('reset-btn'),
    workInput: document.getElementById('work-input'),
    breakInput: document.getElementById('break-input'),
    taskList: document.getElementById('task-list'),
    taskForm: document.getElementById('task-form'),
    taskInput: document.getElementById('task-input'),
    body: document.body,
    app: document.getElementById('app'),
    intentionOverlay: document.getElementById('intention-overlay'),
    intentionForm: document.getElementById('intention-form'),
    intentionInput: document.getElementById('intention-input'),
    intentionText: document.getElementById('current-intention-text'),
    breathingOverlay: document.getElementById('breathing-overlay'),
    eyeToast: document.getElementById('eye-rest-toast'),
    eyeCountdown: document.getElementById('eye-rest-countdown'),
    eyeProgress: document.getElementById('eye-rest-progress'),
    neuralArcFill: document.getElementById('neural-arc-fill'),
    reentryNudge: document.getElementById('reentry-nudge'),
    reentryText: document.getElementById('reentry-text'),
    dashboard: document.getElementById('dashboard'),
    scoreFill: document.getElementById('score-fill'),
    scoreText: document.getElementById('score-text'),
    flowInsight: document.getElementById('flow-insight'),
    clearBtn: document.getElementById('clear-progress-btn'),
    viewStatsBtn: document.getElementById('view-stats-btn'),
    closeDashboard: document.getElementById('close-dashboard'),
    rhythmMode: document.getElementById('rhythm-mode'),
    hardwareBtn: document.getElementById('connect-hardware-btn')
};

const renderTasks = (tasks) => {
    if (!elements.taskList) return;
    elements.taskList.innerHTML = '';
    tasks.forEach(task => {
        const li = document.createElement('li');
        li.className = `task-item ${task.completed ? 'completed' : ''}`;
        const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = task.completed;
        cb.onclick = () => timerStore.getState().toggleTask(task.id);
        const span = document.createElement('span'); span.textContent = task.text;
        const del = document.createElement('button'); del.className = 'task-delete'; del.innerHTML = '&times;';
        del.onclick = () => timerStore.getState().deleteTask(task.id);
        li.append(cb, span, del);
        elements.taskList.appendChild(li);
    });
};

// --- 4. REACTIVE UI & HARDWARE SYNC ---

let lastSentMode = "";

timerStore.subscribe((state) => {
    if (elements.timeLeft) {
        const mins = Math.floor(state.timeLeft / 60).toString().padStart(2, '0');
        const secs = (state.timeLeft % 60).toString().padStart(2, '0');
        elements.timeLeft.textContent = `${mins}:${secs}`;
    }
    if (elements.currentPhase) elements.currentPhase.textContent = state.mode === 'work' ? 'Work Session' : 'Break Time';
    if (elements.sessionCount) elements.sessionCount.textContent = state.sessionsCompleted;
    if (elements.breathingOverlay) elements.breathingOverlay.classList.toggle('hidden', !state.isBreathing);
    if (elements.eyeToast) {
        elements.eyeToast.classList.toggle('hidden', !state.isEyeResting);
        if (state.isEyeResting && elements.eyeCountdown && elements.eyeProgress) {
            elements.eyeCountdown.textContent = state.eyeRestTimeLeft;
            elements.eyeProgress.style.width = `${(state.eyeRestTimeLeft / 20) * 100}%`;
        }
    }
    if (elements.reentryNudge && elements.reentryText) {
        if (state.mode === 'work' && state.nextMicroStep && !state.isActive) {
            elements.reentryNudge.classList.remove('hidden');
            elements.reentryText.textContent = state.nextMicroStep;
        } else { elements.reentryNudge.classList.add('hidden'); }
    }
    if (state.rhythmMode === 'ultradian' && state.mode === 'work' && elements.neuralArcFill) {
        const percent = ((state.workDuration * 60 - state.timeLeft) / (state.workDuration * 60)) * 100;
        elements.neuralArcFill.style.width = `${percent}%`;
        elements.neuralArcFill.className = percent < 15 ? '' : (percent < 75 ? 'arc-peak' : 'arc-decline');
    }
    let cmd = "S";
    if (state.isBreathing) cmd = "B"; else if (state.isEyeResting) cmd = "R"; else if (state.isActive) cmd = state.mode === 'work' ? "W" : "K";
    if (cmd !== lastSentMode) { hardware.sendCommand(cmd); lastSentMode = cmd; }
    if (elements.startBtn) elements.startBtn.hidden = state.isActive || state.isBreathing;
    if (elements.pauseBtn) elements.pauseBtn.hidden = !state.isActive;
    if (elements.body) {
        elements.body.className = `${state.mode}-mode`;
        elements.body.classList.toggle('overlay-active', state.isBreathing || (elements.intentionOverlay && !elements.intentionOverlay.classList.contains('hidden')));
    }
    renderTasks(state.tasks);
});

// --- 5. RESILIENT EVENT BINDINGS (EMERGENCY BYPASS) ---

const attachListeners = () => {
    if (elements.startBtn) {
        elements.startBtn.onclick = () => {
            const state = timerStore.getState();
            if (state.mode === 'work' && !state.currentIntention) {
                if (elements.intentionOverlay) elements.intentionOverlay.classList.remove('hidden');
                if (elements.intentionInput) elements.intentionInput.focus();
            } else { state.startTimer(); }
        };
    }

    const beginFocusBtn = document.querySelector('#intention-form button[type="submit"]');
    if (beginFocusBtn) {
        beginFocusBtn.onclick = (e) => {
            e.preventDefault();
            const text = elements.intentionInput.value.trim();
            if (text) {
                timerStore.getState().setIntention(text);
                if (elements.intentionOverlay) elements.intentionOverlay.classList.add('hidden');
                timerStore.getState().startTimer(false, true); // FORCE START
            } else { alert("Please enter an intention."); }
        };
    }

    if (elements.pauseBtn) elements.pauseBtn.onclick = () => timerStore.getState().pauseTimer();
    if (elements.resetBtn) elements.resetBtn.onclick = () => timerStore.getState().resetTimer();
    if (elements.clearBtn) elements.clearBtn.onclick = () => timerStore.getState().clearProgress();
    if (elements.rhythmMode) elements.rhythmMode.onchange = (e) => timerStore.getState().updateRhythmMode(e.target.value);
    if (elements.hardwareBtn) elements.hardwareBtn.onclick = () => hardware.connect();
    if (elements.taskForm) {
        elements.taskForm.onsubmit = (e) => {
            e.preventDefault();
            const val = elements.taskInput.value.trim();
            if (val) { timerStore.getState().addTask(val); elements.taskInput.value = ''; }
        };
    }
    if (elements.viewStatsBtn) {
        elements.viewStatsBtn.onclick = () => {
            const state = timerStore.getState();
            const score = state.calculateFlowScore();
            if (elements.scoreFill) elements.scoreFill.setAttribute('stroke-dasharray', `${score}, 100`);
            if (elements.scoreText) elements.scoreText.textContent = score;
            if (elements.flowInsight) elements.flowInsight.textContent = state.getFlowInsight(score);
            const sSess = document.getElementById('stat-sessions'), sDist = document.getElementById('stat-distractions'), sEye = document.getElementById('stat-eye-rests');
            if (sSess) sSess.textContent = state.sessionsCompleted; if (sDist) sDist.textContent = state.distractionCount; if (sEye) sEye.textContent = state.eyeRestsCompleted;
            if (elements.dashboard) elements.dashboard.classList.remove('hidden');
        };
    }
    if (elements.closeDashboard) elements.closeDashboard.onclick = () => { if (elements.dashboard) elements.dashboard.classList.add('hidden'); };
};

// --- 6. INITIALIZATION ---

try {
    const init = timerStore.getState();
    if (elements.workInput) elements.workInput.value = init.workDuration;
    if (elements.breakInput) elements.breakInput.value = init.breakDuration;
    if (elements.rhythmMode) elements.rhythmMode.value = init.rhythmMode;
    if (elements.app && init.rhythmMode === 'ultradian') elements.app.classList.add('ultradian-active');
    renderTasks(init.tasks);
    attachListeners();
    syncChannel.onmessage = (e) => timerStore.getState().applyExternalSync(e.data);
    timerWorker.onmessage = () => timerStore.getState().tick();
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') timerStore.getState().logDistraction();
        else if (timerStore.isActive) requestWakeLock();
    });
    console.log("System: ONLINE");
} catch (error) { console.error("Initialization Error:", error); }
