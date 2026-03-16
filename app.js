/**
 * Pomodoro Timer Pro - Optimized Orchestration
 * Fixes: Timer Drift, Audio Blocking, Hydration Logic
 */

import { createStore } from 'https://esm.sh/zustand@4.5.2/vanilla';
import { persist, createJSONStorage } from 'https://esm.sh/zustand@4.5.2/middleware';

// --- 1. ENHANCED UTILITIES ---

let audioCtx = null; // Global reference to be initialized on user gesture

const playNotificationSound = () => {
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime); 
    osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.5); 
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.5);
};

const triggerVisualNotification = (title, body) => {
    if (Notification.permission === 'granted') {
        new Notification(title, { 
            body, 
            icon: 'https://cdn-icons-png.flaticon.com/512/2553/2553391.png' 
        });
    }
};

const formatTime = (seconds) => {
    const mins = Math.floor(Math.max(0, seconds) / 60);
    const secs = Math.floor(Math.max(0, seconds) % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// --- 2. STATE ENGINE (DETERMINISTIC) ---

const timerStore = createStore(
    persist(
        (set, get) => ({
            timeLeft: 1500,
            workDuration: 25,
            breakDuration: 5,
            isActive: false,
            mode: 'work',
            sessionsCompleted: 0,
            expectedEndTime: null, // Used for drift-free timing
            tasks: [],

            startTimer: () => {
                if (get().isActive) return;
                
                // Initialize Audio on first start
                if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                if (Notification.permission === 'default') Notification.requestPermission();

                const now = Date.now();
                const endTime = now + (get().timeLeft * 1000);
                
                set({ isActive: true, expectedEndTime: endTime });
                
                // Use a high-frequency tick for UI responsiveness, 
                // but logic relies on the endTime delta.
                const id = setInterval(() => get().tick(), 200); 
                get().intervalId = id; 
            },

            pauseTimer: () => {
                if (get().intervalId) clearInterval(get().intervalId);
                set({ isActive: false, expectedEndTime: null });
            },

            resetTimer: () => {
                get().pauseTimer();
                const { mode, workDuration, breakDuration } = get();
                set({ 
                    timeLeft: mode === 'work' ? workDuration * 60 : breakDuration * 60,
                    isActive: false 
                });
            },

            tick: () => {
                const { expectedEndTime, mode, sessionsCompleted, workDuration, breakDuration } = get();
                if (!expectedEndTime) return;

                const now = Date.now();
                const remaining = Math.round((expectedEndTime - now) / 1000);

                if (remaining >= 0) {
                    set({ timeLeft: remaining });
                } else {
                    // Phase Transition
                    playNotificationSound();
                    const nextMode = mode === 'work' ? 'break' : 'work';
                    const nextDuration = nextMode === 'work' ? workDuration : breakDuration;
                    
                    triggerVisualNotification('Pomodoro', nextMode === 'break' ? 'Break time!' : 'Work time!');
                    
                    set({ 
                        mode: nextMode, 
                        timeLeft: nextDuration * 60, 
                        sessionsCompleted: mode === 'work' ? sessionsCompleted + 1 : sessionsCompleted,
                        isActive: false,
                        expectedEndTime: null
                    });
                    
                    if (get().intervalId) clearInterval(get().intervalId);
                }
            },

            updateSettings: (work, breakTime) => {
                const w = Math.max(1, Math.min(60, parseInt(work) || 25));
                const b = Math.max(1, Math.min(30, parseInt(breakTime) || 5));
                set({ workDuration: w, breakDuration: b });
                if (!get().isActive) get().resetTimer();
            },

            addTask: (text) => {
                const newTask = { id: crypto.randomUUID(), text: text.trim(), completed: false };
                if (newTask.text) set((state) => ({ tasks: [...state.tasks, newTask] }));
            },

            toggleTask: (id) => {
                set((state) => ({
                    tasks: state.tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t)
                }));
            },

            deleteTask: (id) => {
                set((state) => ({ tasks: state.tasks.filter(t => t.id !== id) }));
            },

            clearProgress: () => {
                if (confirm("Reset all session and task data?")) {
                    set({ sessionsCompleted: 0, tasks: [] });
                    get().resetTimer();
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
                timeLeft: state.timeLeft, // Persist remaining time
                mode: state.mode
            }),
        }
    )
);

// --- 3. DOM CONTROLLER (REACTIVE) ---

const elements = {
    timeLeft: document.getElementById('time-left'),
    currentPhase: document.getElementById('current-phase'),
    sessionCount: document.getElementById('session-count'),
    startBtn: document.getElementById('start-btn'),
    pauseBtn: document.getElementById('pause-btn'),
    resetBtn: document.getElementById('reset-btn'),
    clearBtn: document.getElementById('clear-progress-btn'),
    workInput: document.getElementById('work-input'),
    breakInput: document.getElementById('break-input'),
    taskForm: document.getElementById('task-form'),
    taskInput: document.getElementById('task-input'),
    taskList: document.getElementById('task-list'),
    body: document.body
};

const renderTasks = (tasks) => {
    const fragment = document.createDocumentFragment();
    tasks.forEach(task => {
        const li = document.createElement('li');
        li.className = `task-item ${task.completed ? 'completed' : ''}`;
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = task.completed;
        checkbox.className = 'task-toggle';
        checkbox.onclick = () => timerStore.getState().toggleTask(task.id);

        const span = document.createElement('span');
        span.textContent = task.text;

        const delBtn = document.createElement('button');
        delBtn.innerHTML = '&times;';
        delBtn.className = 'task-delete';
        delBtn.onclick = () => timerStore.getState().deleteTask(task.id);

        li.append(checkbox, span, delBtn);
        fragment.appendChild(li);
    });
    elements.taskList.innerHTML = '';
    elements.taskList.appendChild(fragment);
};

// Reactive Subscription
let lastTasks = null;
timerStore.subscribe((state) => {
    const timeStr = formatTime(state.timeLeft);
    elements.timeLeft.textContent = timeStr;
    elements.currentPhase.textContent = state.mode === 'work' ? 'Work Session' : 'Break Time';
    elements.sessionCount.textContent = state.sessionsCompleted;
    
    // UI State Toggles
    elements.startBtn.hidden = state.isActive;
    elements.pauseBtn.hidden = !state.isActive;
    
    // Theme Sync
    if (!elements.body.classList.contains(`${state.mode}-mode`)) {
        elements.body.classList.remove('work-mode', 'break-mode');
        elements.body.classList.add(`${state.mode}-mode`);
    }

    document.title = `${timeStr} - ${state.mode === 'work' ? 'Work' : 'Break'}`;

    if (state.tasks !== lastTasks) {
        renderTasks(state.tasks);
        lastTasks = state.tasks;
    }
});

// Event Listeners
elements.startBtn.addEventListener('click', () => timerStore.getState().startTimer());
elements.pauseBtn.addEventListener('click', () => timerStore.getState().pauseTimer());
elements.resetBtn.addEventListener('click', () => timerStore.getState().resetTimer());
elements.clearBtn.addEventListener('click', () => timerStore.getState().clearProgress());

const syncSettings = () => {
    timerStore.getState().updateSettings(elements.workInput.value, elements.breakInput.value);
};
elements.workInput.addEventListener('input', syncSettings);
elements.breakInput.addEventListener('input', syncSettings);

elements.taskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = elements.taskInput.value.trim();
    if (val) {
        timerStore.getState().addTask(val);
        elements.taskInput.value = '';
    }
});

// Initial Sync
const initialState = timerStore.getState();
elements.workInput.value = initialState.workDuration;
elements.breakInput.value = initialState.breakDuration;
