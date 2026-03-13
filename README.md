# 🍅 Pomodoro Timer (MVP)

A high-performance, production-ready Pomodoro Timer built with modern web standards. This application focuses on deep work intervals and automated rest phases to maximize productivity.

## 🚀 Features

- **Core Timer**: Strictly initialized 25-minute work sessions and 5-minute break sessions.
- **State Indicator**: Clear visual distinction between "Work" and "Break" modes via dynamic UI theming.
- **Alert System**: Dual-layer notifications featuring synthesized audio alerts (Web Audio API) and browser-level notifications.
- **Session Tracking**: Persistent counter for completed work sessions that survives page refreshes.
- **Responsive Design**: Mobile-first layout optimized for all screen sizes.

## 🛠 Tech Stack

- **Frameworks**: HTML Living Standard, Modern Vanilla JS (ES6+).
- **Styling**: CSS Snapshot 2026 (Custom Properties, Flexbox).
- **State Management**: [Zustand (Vanilla)](https://github.com/pmndrs/zustand) - Manages timer state and intervals without unnecessary re-renders.
- **Persistence**: LocalStorage via Zustand Middleware.
- **Hosting**: GitHub Pages.

## 📂 Project Structure

```text
├── index.html   # Semantic structure and DOM hooks
├── style.css    # Responsive design and state-based theming
├── app.js       # State engine, alert logic, and DOM controller
└── README.md    # Project documentation
⚙️ Installation & Local Development

Since this project uses Vanilla JS and ESM, no build step or npm install is required.

Clone the repository:

git clone https://github.com/your-username/pomodoro-timer.git

Open index.html in any modern web browser.

Note: For Browser Notifications to work, the app should be served via a local server (e.g., VS Code Live Server) or a secure (HTTPS) connection.

🌐 Deployment

This project is optimized for GitHub Pages:

Push your code to a GitHub repository.

Navigate to Settings > Pages.

Select the main branch as the source.

Click Save. Your app will be live at https://<your-username>.github.io/<repo-name>/.

🛡 Security & Performance

Zero Dependencies: Uses only lightweight, version-locked ESM imports.

No Tracking: No external fonts, analytics, or third-party scripts.

Memory Safe: Explicit interval management to prevent memory leaks and race conditions.

📄 License
