# Focus Flow

A minimal Pomodoro-style focus timer that runs entirely in the browser. Add tasks, pick a session length, and start a focus timer; completed sessions are logged against the active task and count toward a daily streak.

## Features

- Focus / Short Break / Long Break modes with a circular progress ring
- Editable durations via presets or a custom form
- Task list with per-task session counts
- Daily session count and day-streak tracking
- All data is stored locally in the browser (`localStorage`) — nothing is sent anywhere

## Running it

No build step or server required. Open `index.html` directly in a browser:

```bash
open index.html
```

Or serve the folder locally, e.g.:

```bash
python3 -m http.server 8000
```

then visit `http://localhost:8000`.

## Files

- `index.html` — markup
- `style.css` — styling
- `script.js` — timer, task, and streak logic
