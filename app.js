/**
 * Pomodoro Timer MVP - app.js
 * Tech Stack: Modern Vanilla JS, Zustand (Vanilla), Web Audio API
 */

import { createStore } from 'https://esm.sh/zustand@4.5.2/vanilla';
import { persist, createJSONStorage } from 'https://esm.sh/zustand@4.5.2/middleware';

// --- 1. UTILITIES: ALERTS & NOTIFICATIONS ---

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
    } catch (e) {
        console.warn("Audio context failed to initialize:", e);
    }
};

const triggerVisualNotification = (title, body) => {
    if (Notification.permission === 'granted') {
        new Notification(title, { 
            body, 
            icon: 'https://cdn-icons-png.flaticon.com/512/2553/2553391.png' 
        });
    }
};

// --- 2. STATE ENGINE: ZUSTAND STORE ---

const WORK_TIME = 25 * 60;
const BREAK_TIME = 5 * 60;

const timerStore = createStore(
    persist(
        (set, get) => ({
            timeLeft: WORK_TIME,
            isActive: false,
            mode: 'work', // 'work' | 'break'
            sessionsCompleted: 0,
            intervalId: null,

            startTimer: () => {
                if (get().isActive) return;
                
                // Request Notification Permission on first user gesture
                if (Notification.permission === 'default') {
                    Notification.requestPermission();
                }

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
                const mode = get().mode;
                set({ 
                    timeLeft: mode === 'work' ? WORK_TIME : BREAK_TIME,
                    isActive: false 
                });
            },

            tick: () => {
                const { timeLeft, mode, sessionsCompleted } = get();

                if (timeLeft > 0) {
                    set({ timeLeft: timeLeft - 1 });
                } else {
                    // Timer Completion Logic
                    playNotificationSound();
                    const msg = mode === 'work' ? 'Work session complete! Take a break.' : 'Break over! Back to work.';
                    triggerVisualNotification('Pomodoro Timer', msg);

                    if (mode === 'work') {
                        set({ 
                            mode: 'break', 
                            timeLeft: BREAK_TIME, 
                            sessionsCompleted: sessionsCompleted + 1 
                        });
                    } else {
                        set({ 
                            mode: 'work', 
                            timeLeft: WORK_TIME 
                        });
                    }
                    get().pauseTimer();
                }
            },

            clearProgress: () => {
                if (confirm("Reset all completed session data?")) {
                    set({ sessionsCompleted: 0 });
                }
            }
        }),
        {
            name: 'pomodoro-storage',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({ sessionsCompleted: state.sessionsCompleted }),
        }
    )
);

// --- 3. DOM CONTROLLER: UI BINDING ---

const elements = {
    timeLeft: document.getElementById('time-left'),
    currentPhase: document.getElementById('current-phase'),
    sessionCount: document.getElementById('session-count'),
    startBtn: document.getElementById('start-btn'),
    pauseBtn: document.getElementById('pause-btn'),
    resetBtn: document.getElementById('reset-btn'),
    clearBtn: document.getElementById('clear-progress-btn'),
    body: document.body
};

const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// Reactive UI Updates via Subscription
timerStore.subscribe((state) => {
    // Update Text
    elements.timeLeft.textContent = formatTime(state.timeLeft);
    elements.currentPhase.textContent = state.mode === 'work' ? 'Work Session' : 'Break Time';
    elements.sessionCount.textContent = state.sessionsCompleted;
    
    // Update Button Visibility
    elements.startBtn.hidden = state.isActive;
    elements.pauseBtn.hidden = !state.isActive;

    // Update Visual State (CSS Classes)
    if (state.mode === 'work') {
        elements.body.classList.add('work-mode');
        elements.body.classList.remove('break-mode');
    } else {
        elements.body.classList.add('break-mode');
        elements.body.classList.remove('work-mode');
    }

    // Update Browser Tab Title
    document.title = `${formatTime(state.timeLeft)} - ${state.mode === 'work' ? 'Work' : 'Break'}`;
});

// Event Listeners
elements.startBtn.addEventListener('click', () => timerStore.getState().startTimer());
elements.pauseBtn.addEventListener('click', () => timerStore.getState().pauseTimer());
elements.resetBtn.addEventListener('click', () => timerStore.getState().resetTimer());
elements.clearBtn.addEventListener('click', () => timerStore.getState().clearProgress());

// Initial Render Call
const initialState = timerStore.getState();
elements.timeLeft.textContent = formatTime(initialState.timeLeft);
elements.sessionCount.textContent = initialState.sessionsCompleted;
