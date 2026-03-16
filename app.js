/**
 * Pomodoro Timer Pro - Orchestrated Version 4.0 (Final)
 * Pillars: Technical Immortality, Cognitive Flow, Deterministic Analytics
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

let audioCtx = null;
let wakeLock = null;

const requestWakeLock = async () => {
    if ('wakeLock' in navigator) {
        try { wakeLock = await navigator.wakeLock.request('screen'); } 
        catch (err) { console.warn("Wake Lock blocked"); }
    }
};

const releaseWakeLock = () => {
    if (wakeLock) { wakeLock.release().then(() => wakeLock = null); }
};

// --- 2. THE ORCHESTRATION ENGINE (STATE) ---

const timerStore = createStore(
    persist(
        (set, get) => ({
            // Core State
            timeLeft: 1500,
            workDuration: 25,
            breakDuration: 5,
            isActive: false,
            isBreathing: false,
            mode: 'work',
            sessionsCompleted: 0,
            distractionCount: 0,
            expectedEndTime: null,
            tasks: [],
            currentIntention: "",

            // Actions: Psychological Priming
            setIntention: (text) => set({ currentIntention: text }),

            startTimer: async () => {
                const state = get();
                if (state.isActive || state.isBreathing) return;

                // Hardware Init
                if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                if (Notification.permission === 'default') Notification.requestPermission();
                await requestWakeLock();

                const endTime = Date.now() + (state.timeLeft * 1000);
                set({ isActive: true, expectedEndTime: endTime });
                timerWorker.postMessage({ command: 'START' });
            },

            pauseTimer: () => {
                timerWorker.postMessage({ command: 'STOP' });
                releaseWakeLock();
                set({ isActive: false, expectedEndTime: null });
            },

            tick: () => {
                const { expectedEndTime, mode, sessionsCompleted, workDuration, breakDuration } = get();
                if (!expectedEndTime) return;

                const now = Date.now();
                const remaining = Math.round((expectedEndTime - now) / 1000);

                if (remaining >= 0) {
                    set({ timeLeft: remaining });
                } else {
                    get().triggerTransition();
                }
            },

            triggerTransition: () => {
                const { mode, workDuration, breakDuration, sessionsCompleted } = get();
                get().pauseTimer();
                
                // Play Sound & Notify
                const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
                audio.play().catch(() => {}); 

                // Start Breathing Phase (Psychological Pillar)
                set({ isBreathing: true });

                setTimeout(() => {
                    const nextMode = mode === 'work' ? 'break' : 'work';
                    const nextDuration = nextMode === 'work' ? workDuration : breakDuration;
                    
                    set({ 
                        isBreathing: false,
                        mode: nextMode,
                        timeLeft: nextDuration * 60,
                        sessionsCompleted: mode === 'work' ? sessionsCompleted + 1 : sessionsCompleted,
                        currentIntention: "" // Reset for next session
                    });
                }, 15000); // 15 Seconds of Breathing
            },

            // Data Optimization: Distraction Tracking
            logDistraction: () => set(state => ({ distractionCount: state.distractionCount + 1 })),

            updateSettings: (work, breakTime) => {
                const w = Math.max(1, Math.min(60, parseInt(work) || 25));
                const b = Math.max(1, Math.min(30, parseInt(breakTime) || 5));
                set({ workDuration: w, breakDuration: b });
                if (!get().isActive) set({ timeLeft: get().mode === 'work' ? w * 60 : b * 60 });
            },

            addTask: (text) => set(state => ({ 
                tasks: [...state.tasks, { id: crypto.randomUUID(), text, completed: false }] 
            })),

            toggleTask: (id) => set(state => ({
                tasks: state.tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t)
            })),

            deleteTask: (id) => set(state => ({ tasks: state.tasks.filter(t => t.id !== id) })),

            clearProgress: () => {
                if (confirm("Reset all data?")) {
                    set({ sessionsCompleted: 0, distractionCount: 0, tasks: [] });
                    const s = get();
                    set({ timeLeft: s.mode === 'work' ? s.workDuration * 60 : s.breakDuration * 60 });
                }
            }
        }),
        {
            name: 'pomodoro-pro-storage',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({ 
                sessionsCompleted: state.sessionsCompleted,
                workDuration: state.workDuration,
                breakDuration: state.breakDuration,
                tasks: state.tasks,
                distractionCount: state.distractionCount
            }),
        }
    )
);

// --- 3. DOM INTERFACE & REACTIVE BINDINGS ---

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
    // Psychological Elements
    intentionOverlay: document.getElementById('intention-overlay'),
    intentionForm: document.getElementById('intention-form'),
    intentionInput: document.getElementById('intention-input'),
    intentionDisplay: document.getElementById('active-intention-display'),
    intentionText: document.getElementById('current-intention-text'),
    breathingOverlay: document.getElementById('breathing-overlay')
};

const formatTime = (s) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

// Reactive UI Sync
timerStore.subscribe((state) => {
    elements.timeLeft.textContent = formatTime(state.timeLeft);
    elements.currentPhase.textContent = state.mode === 'work' ? 'Work Session' : 'Break Time';
    elements.sessionCount.textContent = state.sessionsCompleted;
    
    // Toggle Overlays
    elements.breathingOverlay.classList.toggle('hidden', !state.isBreathing);
    
    // Intention Display
    if (state.mode === 'work' && state.currentIntention && !state.isBreathing) {
        elements.intentionDisplay.classList.remove('hidden');
        elements.intentionText.textContent = state.currentIntention;
    } else {
        elements.intentionDisplay.classList.add('hidden');
    }

    // Button States
    elements.startBtn.hidden = state.isActive || state.isBreathing;
    elements.pauseBtn.hidden = !state.isActive;
    
    // Theme
    elements.body.className = `${state.mode}-mode`;
    document.title = state.isBreathing ? "Breathe..." : `${formatTime(state.timeLeft)} - ${state.mode}`;
});

// Task Rendering
let lastTasks = [];
timerStore.subscribe((state) => {
    if (state.tasks === lastTasks) return;
    lastTasks = state.tasks;
    elements.taskList.innerHTML = '';
    state.tasks.forEach(task => {
        const li = document.createElement('li');
        li.className = `task-item ${task.completed ? 'completed' : ''}`;
        li.innerHTML = `
            <input type="checkbox" ${task.completed ? 'checked' : ''} class="task-toggle">
            <span>${task.text}</span>
            <button class="task-delete">&times;</button>
        `;
        li.querySelector('.task-toggle').onclick = () => timerStore.getState().toggleTask(task.id);
        li.querySelector('.task-delete').onclick = () => timerStore.getState().deleteTask(task.id);
        elements.taskList.appendChild(li);
    });
});

// --- 4. EVENT ORCHESTRATION ---

// Start Logic with Intention Priming
elements.startBtn.addEventListener('click', () => {
    const state = timerStore.getState();
    if (state.mode === 'work' && !state.currentIntention) {
        elements.intentionOverlay.classList.remove('hidden');
        elements.intentionInput.focus();
    } else {
        timerStore.getState().startTimer();
    }
});

elements.intentionForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = elements.intentionInput.value.trim();
    if (text) {
        timerStore.getState().setIntention(text);
        elements.intentionOverlay.classList.add('hidden');
        timerStore.getState().startTimer();
        elements.intentionInput.value = '';
    }
});

elements.pauseBtn.addEventListener('click', () => timerStore.getState().pauseTimer());
elements.resetBtn.addEventListener('click', () => timerStore.getState().resetTimer());

elements.taskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = elements.taskInput.value.trim();
    if (val) {
        timerStore.getState().addTask(val);
        elements.taskInput.value = '';
    }
});

const syncSettings = () => timerStore.getState().updateSettings(elements.workInput.value, elements.breakInput.value);
elements.workInput.addEventListener('input', syncSettings);
elements.breakInput.addEventListener('input', syncSettings);

timerWorker.onmessage = () => timerStore.getState().tick();

// OS/Hardware Resilience
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && timerStore.getState().isActive) {
        requestWakeLock();
    }
});

// Initial Hydration
const init = timerStore.getState();
elements.workInput.value = init.workDuration;
elements.breakInput.value = init.breakDuration;
