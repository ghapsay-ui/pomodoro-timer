/**
 * Pomodoro Timer Pro - Orchestrated Version 4.5 (Definitive)
 * Pillars: Distributed State, Technical Immortality, XSS Protection
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

const requestWakeLock = async () => {
    if ('wakeLock' in navigator && !wakeLock) {
        try { wakeLock = await navigator.wakeLock.request('screen'); } 
        catch (err) { console.warn("Wake Lock blocked by system."); }
    }
};

const releaseWakeLock = () => {
    if (wakeLock) {
        wakeLock.release().then(() => wakeLock = null);
    }
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
            sessionsCompleted: 0,
            distractionCount: 0,
            tasks: [],
            currentIntention: "",
            expectedEndTime: null,

            // --- SYNC LOGIC ---
            applyExternalSync: (data) => {
                const { type, payload } = data;
                if (type === 'STATE_UPDATE') {
                    set({ ...payload });
                    if (payload.isActive) timerWorker.postMessage({ command: 'START' });
                    else timerWorker.postMessage({ command: 'STOP' });
                }
            },

            broadcast: (overrides = {}) => {
                syncChannel.postMessage({
                    type: 'STATE_UPDATE',
                    payload: { ...get(), ...overrides }
                });
            },

            // --- ACTIONS ---
            setIntention: (text) => {
                set({ currentIntention: text });
                get().broadcast();
            },

            startTimer: async (isSync = false) => {
                const state = get();
                if (state.isActive || state.isBreathing) return;

                if (Notification.permission === 'default') Notification.requestPermission();
                await requestWakeLock();

                const endTime = state.expectedEndTime || (Date.now() + (state.timeLeft * 1000));
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
                set({ timeLeft: duration * 60, expectedEndTime: null });
                if (!isSync) get().broadcast({ timeLeft: duration * 60, expectedEndTime: null });
            },

            tick: () => {
                const { expectedEndTime, isActive } = get();
                if (!expectedEndTime || !isActive) return;

                const remaining = Math.round((expectedEndTime - Date.now()) / 1000);
                if (remaining >= 0) {
                    set({ timeLeft: remaining });
                } else {
                    get().triggerTransition();
                }
            },

            triggerTransition: (isSync = false) => {
                const { mode, workDuration, breakDuration, sessionsCompleted } = get();
                get().pauseTimer(true);
                
                new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg').play().catch(() => {}); 
                set({ isBreathing: true });

                if (!isSync) get().broadcast({ isBreathing: true });

                setTimeout(() => {
                    const nextMode = mode === 'work' ? 'break' : 'work';
                    const nextDuration = nextMode === 'work' ? workDuration : breakDuration;
                    const finalState = { 
                        isBreathing: false,
                        mode: nextMode,
                        timeLeft: nextDuration * 60,
                        sessionsCompleted: mode === 'work' ? sessionsCompleted + 1 : sessionsCompleted,
                        currentIntention: "",
                        expectedEndTime: null
                    };
                    set(finalState);
                    if (!isSync) get().broadcast(finalState);
                }, 15000);
            },

            updateSettings: (work, breakTime) => {
                const w = Math.max(1, Math.min(60, parseInt(work) || 25));
                const b = Math.max(1, Math.min(30, parseInt(breakTime) || 5));
                set({ workDuration: w, breakDuration: b });
                if (!get().isActive) {
                    const newTime = get().mode === 'work' ? w * 60 : b * 60;
                    set({ timeLeft: newTime });
                    get().broadcast({ workDuration: w, breakDuration: b, timeLeft: newTime });
                }
            },

            addTask: (text) => {
                set(state => ({ tasks: [...state.tasks, { id: crypto.randomUUID(), text, completed: false }] }));
                get().broadcast();
            },

            toggleTask: (id) => {
                set(state => ({ tasks: state.tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t) }));
                get().broadcast();
            },

            deleteTask: (id) => {
                set(state => ({ tasks: state.tasks.filter(t => t.id !== id) }));
                get().broadcast();
            },

            logDistraction: () => {
                if (get().isActive && get().mode === 'work') {
                    set(state => ({ distractionCount: state.distractionCount + 1 }));
                    get().broadcast();
                }
            },

            clearProgress: () => {
                if (confirm("Reset all data and sessions?")) {
                    set({ sessionsCompleted: 0, distractionCount: 0, tasks: [] });
                    get().resetTimer();
                    get().broadcast();
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
    intentionOverlay: document.getElementById('intention-overlay'),
    intentionForm: document.getElementById('intention-form'),
    intentionInput: document.getElementById('intention-input'),
    intentionDisplay: document.getElementById('active-intention-display'),
    intentionText: document.getElementById('current-intention-text'),
    breathingOverlay: document.getElementById('breathing-overlay'),
    clearBtn: document.getElementById('clear-progress-btn')
};

// SECURE RENDERER: Prevents XSS via textContent
const renderTasks = (tasks) => {
    elements.taskList.innerHTML = '';
    tasks.forEach(task => {
        const li = document.createElement('li');
        li.className = `task-item ${task.completed ? 'completed' : ''}`;
        
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = task.completed;
        cb.className = 'task-toggle';
        cb.onclick = () => timerStore.getState().toggleTask(task.id);

        const span = document.createElement('span');
        span.textContent = task.text;

        const del = document.createElement('button');
        del.className = 'task-delete';
        del.innerHTML = '&times;';
        del.onclick = () => timerStore.getState().deleteTask(task.id);

        li.append(cb, span, del);
        elements.taskList.appendChild(li);
    });
};

// REACTIVE UI SYNC
timerStore.subscribe((state) => {
    const mins = Math.floor(state.timeLeft / 60).toString().padStart(2, '0');
    const secs = (state.timeLeft % 60).toString().padStart(2, '0');
    const timeStr = `${mins}:${secs}`;
    
    elements.timeLeft.textContent = timeStr;
    elements.currentPhase.textContent = state.mode === 'work' ? 'Work Session' : 'Break Time';
    elements.sessionCount.textContent = state.sessionsCompleted;
    
    elements.breathingOverlay.classList.toggle('hidden', !state.isBreathing);
    elements.body.classList.toggle('overlay-active', state.isBreathing || !elements.intentionOverlay.classList.contains('hidden'));
    elements.body.className = `${state.mode}-mode`;
    
    if (state.mode === 'work' && state.currentIntention && !state.isBreathing) {
        elements.intentionDisplay.classList.remove('hidden');
        elements.intentionText.textContent = state.currentIntention;
    } else {
        elements.intentionDisplay.classList.add('hidden');
    }

    elements.startBtn.hidden = state.isActive || state.isBreathing;
    elements.pauseBtn.hidden = !state.isActive;
    document.title = state.isBreathing ? "Breathe..." : `${timeStr} - ${state.mode}`;
    
    renderTasks(state.tasks);
});

// --- 4. EVENT ORCHESTRATION ---

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
    }
});

elements.pauseBtn.addEventListener('click', () => timerStore.getState().pauseTimer());
elements.resetBtn.addEventListener('click', () => timerStore.getState().resetTimer());
elements.clearBtn.addEventListener('click', () => timerStore.getState().clearProgress());

elements.taskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = elements.taskInput.value.trim();
    if (val) {
        timerStore.getState().addTask(val);
        elements.taskInput.value = '';
    }
});

elements.workInput.addEventListener('change', (e) => timerStore.getState().updateSettings(e.target.value, elements.breakInput.value));
elements.breakInput.addEventListener('change', (e) => timerStore.getState().updateSettings(elements.workInput.value, e.target.value));

// SYNC & ANALYTICS
syncChannel.onmessage = (e) => timerStore.getState().applyExternalSync(e.data);
timerWorker.onmessage = () => timerStore.getState().tick();

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        timerStore.getState().logDistraction();
    } else if (timerStore.getState().isActive) {
        requestWakeLock();
    }
});

// INITIAL HYDRATION
const init = timerStore.getState();
elements.workInput.value = init.workDuration;
elements.breakInput.value = init.breakDuration;
renderTasks(init.tasks);
