/**
 * Pomodoro Timer Pro - Final Production Version
 * Features: Light/Dark Theme, Work/Break Modes, Responsive Task UI
 */

/* --- 1. CORE VARIABLES & THEMES --- */
:root {
    /* Light Mode Defaults */
    --bg-color: #f0f2f5;
    --text-color: #1a1a1a;
    --card-bg: #ffffff;
    --primary-color: #e74c3c; /* Work Red */
    --secondary-color: #34495e;
    --border-color: #f0f0f0;
    --input-bg: #ffffff;
    --transition-speed: 0.3s;
}

/* Dark Mode Overrides */
body.dark-mode {
    --bg-color: #121212;
    --text-color: #e0e0e0;
    --card-bg: #1e1e1e;
    --secondary-color: #ecf0f1;
    --border-color: #333333;
    --input-bg: #252525;
}

/* Mode-Specific Overrides */
body.break-mode {
    --primary-color: #2ecc71; /* Break Green */
}

/* Background Color Logic based on Mode + Theme */
body.work-mode.dark-mode { background-color: #1a1010; }
body.break-mode.dark-mode { background-color: #101a12; }
body.work-mode:not(.dark-mode) { background-color: #fdf2f2; }
body.break-mode:not(.dark-mode) { background-color: #f2fdf5; }

/* --- 2. BASE STYLES --- */
* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

body {
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    color: var(--text-color);
    transition: background-color var(--transition-speed) ease;
    padding: 20px;
}

#app {
    position: relative;
    text-align: center;
    background: var(--card-bg);
    padding: 2.5rem 2rem;
    border-radius: 2rem;
    box-shadow: 0 10px 40px rgba(0,0,0,0.1);
    width: 100%;
    max-width: 400px;
    transition: background var(--transition-speed) ease, box-shadow var(--transition-speed) ease;
}

/* --- 3. THEME TOGGLE --- */
#theme-toggle {
    position: absolute;
    top: 20px;
    right: 20px;
    background: none;
    border: none;
    font-size: 1.4rem;
    cursor: pointer;
    padding: 5px;
    line-height: 1;
    transition: transform 0.2s;
}

#theme-toggle:hover { transform: scale(1.2); }

/* --- 4. TIMER DISPLAY --- */
#state-indicator h2 {
    text-transform: uppercase;
    letter-spacing: 0.15rem;
    font-size: 0.8rem;
    color: #7f8c8d;
    margin-bottom: 0.5rem;
}

#timer-display time {
    font-size: 5.5rem;
    font-weight: 800;
    margin: 0.5rem 0 1.5rem 0;
    display: block;
    font-variant-numeric: tabular-nums; /* Prevents jitter */
    color: var(--primary-color);
    transition: color var(--transition-speed) ease;
}

/* --- 5. CONTROLS --- */
#controls {
    display: flex;
    gap: 1rem;
    justify-content: center;
    margin-bottom: 2rem;
}

button {
    padding: 0.8rem 1.8rem;
    border: none;
    border-radius: 0.8rem;
    font-weight: 700;
    font-size: 1rem;
    cursor: pointer;
    transition: transform 0.1s, opacity 0.2s, background-color 0.3s;
}

button:active { transform: scale(0.96); }

#start-btn { background: var(--primary-color); color: white; }
#pause-btn { background: #95a5a6; color: white; }
#reset-btn { 
    background: transparent; 
    color: #7f8c8d; 
    border: 2px solid var(--border-color); 
}

/* --- 6. SETTINGS --- */
#settings {
    margin: 1.5rem 0;
    text-align: left;
    border-top: 1px solid var(--border-color);
    padding-top: 1rem;
}

#settings summary {
    cursor: pointer;
    font-size: 0.85rem;
    color: #95a5a6;
    font-weight: 600;
    list-style: none;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

#settings summary::before { content: '⚙️'; }

.settings-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-top: 1rem;
    background: var(--input-bg);
    padding: 1rem;
    border-radius: 0.8rem;
    border: 1px solid var(--border-color);
}

.settings-grid label {
    font-size: 0.65rem;
    color: #7f8c8d;
    text-transform: uppercase;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
}

.settings-grid input {
    padding: 0.5rem;
    border: 1px solid var(--border-color);
    border-radius: 0.4rem;
    font-size: 1rem;
    font-weight: 600;
    background: var(--input-bg);
    color: var(--text-color);
}

/* --- 7. TASK MANAGEMENT --- */
#task-management {
    margin-top: 1.5rem;
    text-align: left;
    border-top: 1px solid var(--border-color);
    padding-top: 1rem;
}

#task-management h3 {
    font-size: 0.85rem;
    color: var(--text-color);
    margin-bottom: 1rem;
    text-transform: uppercase;
    letter-spacing: 0.05rem;
}

#task-form {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
}

#task-input {
    flex: 1;
    padding: 0.7rem;
    border: 1px solid var(--border-color);
    border-radius: 0.6rem;
    font-size: 0.9rem;
    background: var(--input-bg);
    color: var(--text-color);
}

#task-form button {
    padding: 0.7rem 1.2rem;
    background: var(--secondary-color);
    color: var(--card-bg);
    font-size: 0.8rem;
}

#task-list {
    list-style: none;
    max-height: 160px;
    overflow-y: auto;
    padding-right: 5px;
}

.task-item {
    display: flex;
    align-items: center;
    gap: 0.8rem;
    padding: 0.6rem 0;
    border-bottom: 1px solid var(--border-color);
}

.task-item span {
    flex: 1;
    font-size: 0.9rem;
    overflow-wrap: break-word;
    word-break: break-word;
}

.task-item.completed span {
    text-decoration: line-through;
    color: #7f8c8d;
    opacity: 0.6;
}

.task-toggle {
    cursor: pointer;
    width: 1.1rem;
    height: 1.1rem;
    accent-color: var(--primary-color);
}

.task-delete {
    background: none;
    border: none;
    color: #e74c3c;
    font-size: 1.3rem;
    padding: 0 5px;
    cursor: pointer;
    opacity: 0.3;
}

.task-item:hover .task-delete { opacity: 1; }

/* --- 8. FOOTER --- */
#session-tracking {
    margin-top: 2rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--border-color);
}

#session-tracking p {
    font-size: 0.8rem;
    color: #7f8c8d;
    margin-bottom: 0.5rem;
}

#session-count {
    font-weight: 800;
    color: var(--primary-color);
}

#clear-progress-btn {
    background: none;
    border: none;
    color: #95a5a6;
    font-size: 0.7rem;
    text-decoration: underline;
    cursor: pointer;
}

/* Custom Scrollbar */
#task-list::-webkit-scrollbar { width: 4px; }
#task-list::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 10px; }
