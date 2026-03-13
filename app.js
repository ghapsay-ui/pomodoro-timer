/**
 * Pomodoro Timer Pro - Definitive Version
 * Features: Local Imports, Custom Durations, Task Management, Persistence
 */

// 1. LOCAL IMPORTS (Ensure zustand.js is in your project folder)
import { createStore, persist, createJSONStorage } from './zustand.js';

// 2. ASSET CONFIGURATION
// Paste your Base64 string here or a local path like './icon.png'
const NOTIFICATION_ICON = ""; 

// 3. UTILITIES
const playNotificationSound = () => {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime); 
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5); 
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
    } catch (e) { console.warn("Audio blocked by browser policy."); }
};

const triggerVisualNotification = (title, body) => {
    if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: NOTIFICATION_ICON });
    }
};

const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// 4. STATE ENGINE: ZUSTAND STORE
const timerStore = createStore(
    persist(
        (set, get) => ({
            timeLeft: 1500,
            workDuration: 25,
            breakDuration: 5,
            isActive: false,
            mode: 'work',
            sessionsCompleted: 0,
            intervalId: null,
            tasks: [],

            startTimer: () => {
                if (get().isActive) return;
                if (Notification.permission === 'default') Notification.requestPermission();
                const id = setInterval(() => get().tick(), 1000);
                set({ isActive: true, intervalId: id });
            },

            pauseTimer: () => {
                const { intervalId } = get();
                if (intervalId) clearInterval(intervalId);
                set({ isActive: false, intervalId: null });
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
                const { timeLeft, mode, sessionsCompleted, workDuration, breakDuration } = get();
                if (timeLeft > 0) {
                    set({ timeLeft: timeLeft - 1 });
                } else {
                    playNotificationSound();
                    triggerVisualNotification('Pomodoro Pro', mode === 'work' ? 'Break time!' : 'Work time!');
                    if (mode === 'work') {
                        set({ mode: 'break', timeLeft: breakDuration * 60, sessionsCompleted: sessionsCompleted + 1 });
                    } else {
                        set({ mode: 'work', timeLeft: workDuration * 60 });
                    }
                    get().pauseTimer();
                }
            },

            updateSettings: (work, breakTime) => {
                const w = Math.max(1, Math.min(60, parseInt(work) || 25));
                const b = Math.max(1, Math.min(30, parseInt(breakTime) || 5));
                set({ workDuration: w, breakDuration: b });
                if (!get().isActive) get().resetTimer();
            },

            addTask: (text) => {
                const newTask = { id: Date.now(), text: text.trim(), completed: false };
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
                tasks: state.tasks
            }),
        }
    )
);

// 5. DOM CONTROLLER
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
    elements.taskList.innerHTML = '';
    tasks.forEach(task => {
        const li = document.createElement('li');
        li.className = `task-item ${task.completed ? 'completed' : ''}`;
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = task.completed;
        checkbox.dataset.id = task.id;
        checkbox.className = 'task-toggle';

        const span = document.createElement('span');
        span.textContent = task.text;

        const delBtn = document.createElement('button');
        delBtn.textContent = '×';
        delBtn.dataset.id = task.id;
        delBtn.className = 'task-delete';

        li.append(checkbox, span, delBtn);
        elements.taskList.appendChild(li);
    });
};

// Reactive Subscription
let lastTasks = [];
timerStore.subscribe((state) => {
    elements.timeLeft.textContent = formatTime(state.timeLeft);
    elements.currentPhase.textContent = state.mode === 'work' ? 'Work Session' : 'Break Time';
    elements.sessionCount.textContent = state.sessionsCompleted;
    elements.startBtn.hidden = state.isActive;
    elements.pauseBtn.hidden = !state.isActive;
    elements.body.className = state.mode === 'work' ? 'work-mode' : 'break-mode';
    document.title = `${formatTime(state.timeLeft)} - ${state.mode === 'work' ? 'Work' : 'Break'}`;

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

const syncSettings = () => timerStore.getState().updateSettings(elements.workInput.value, elements.breakInput.value);
elements.workInput.addEventListener('change', syncSettings);
elements.breakInput.addEventListener('change', syncSettings);

elements.taskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    timerStore.getState().addTask(elements.taskInput.value);
    elements.taskInput.value = '';
});

elements.taskList.addEventListener('click', (e) => {
    const id = parseInt(e.target.dataset.id);
    if (!id) return;
    if (e.target.classList.contains('task-toggle')) timerStore.getState().toggleTask(id);
    if (e.target.classList.contains('task-delete')) timerStore.getState().deleteTask(id);
});

// Initialization
const init = timerStore.getState();
elements.workInput.value = init.workDuration;
elements.breakInput.value = init.breakDuration;
elements.timeLeft.textContent = formatTime(init.timeLeft);
renderTasks(init.tasks);
