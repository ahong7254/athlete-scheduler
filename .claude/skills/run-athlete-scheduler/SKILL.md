---
name: run-athlete-scheduler
description: Run, start, screenshot, or drive the Athlete Schedule Optimizer (athlete_schedule_v6_AH.html) in headless Chrome and verify a change works in the real page. Use when asked to run/open/screenshot/test the scheduler or its Stress tab.
---

# Run the Athlete Scheduler

Paths are relative to the repo root. The app is a single static HTML file (`athlete_schedule_v6_AH.html`, no build, no package manager, no tests). It loads the LP solver from `cdn.jsdelivr.net`, so **internet is required**. Windows host: no node, no python, no chromium-cli — the driver is a PowerShell script that talks to headless Chrome over CDP.

## Prerequisites
- Google Chrome at `C:\Program Files\Google\Chrome\Application\chrome.exe` (Edge is also installed; the driver hardcodes Chrome).
- Windows PowerShell 5.1 (built in).

## Run (agent path)
```bash
powershell -NoProfile -ExecutionPolicy Bypass -File .claude/skills/run-athlete-scheduler/driver.ps1 \
  -Js "({title:document.title, solver: typeof solver})" -Shot "$TEMP/sched.png"
```
Flags: `-Html` (default `athlete_schedule_v6_AH.html`), `-Js` (expression evaluated after load; result printed as JSON; promises awaited), `-Shot` (PNG path), `-Width/-Height` (default 1400x1000), `-Port` (default 9333). Uncaught page exceptions are printed as `PAGE EXCEPTION:`. Each call is a fresh page load; state does not persist between calls, so do the whole flow in one `-Js`.

Verified flows (each ran and screenshotted correctly):
```bash
# change the week start date, select Wednesday
... -Js "(()=>{setWeekStartDate('2026-09-21'); selDayFn(2); return document.body.innerText.match(/Sep \d+, 2026/)[0]})()" -Shot "$TEMP/day.png"
# switch to the Stress tab
... -Js "(()=>{document.getElementById('tab-btn-stress').click(); return document.getElementById('tab-btn-stress').className})()" -Shot "$TEMP/stress.png"
```
Useful globals for `-Js`: `refresh()`, `compute()`, `renderStress()`, `showTab(name)`, `saveSchedule()`, `solveWeekLP()`. Always open the screenshot and look at it.

## Run (human path)
Double-click / open `athlete_schedule_v6_AH.html` in a browser. Useless headless.

## Gotchas
- Running the `.ps1` without `-ExecutionPolicy Bypass` fails with "running scripts is disabled on this system".
- Under Git Bash use `$TEMP` for screenshot paths; read them with the Read tool to view.
- The driver waits (up to 20s) for `typeof solver !== 'undefined'`; if the CDN is unreachable the LP never solves and the schedule is empty.
- The screenshot is viewport-only (1000px); the selected-day detail panel is below the fold — raise `-Height` (e.g. 2200) to see it.
- The Stress tab is empty until health `.txt` exports are imported through the hidden file input (`#s-import-input`); a file chooser can't be driven by this driver, so call `parseShortcutsExports([...texts])` / `buildDaily` via `-Js` instead (not verified end-to-end).
- The driver kills Chrome processes using its temp profile (`%TEMP%\athlete-driver-profile`) on exit.
- Other `athlete_schedule_*.html` files are older versions; use `-Html` to drive one.
