# Sweet Swap — Gameplay, rewards and stability update

Pure HTML, CSS and JavaScript. No dependencies, build command, database or paid services.

## Run and deploy
Extract all ten files into your existing project folder. Test with VS Code Live Server, then commit all updated files to GitHub and deploy the static site on Render. Keep all files in the same directory. Export existing progress first using Menu → Settings. Local and hosted browser saves are separate origins; import an exported profile to transfer it. Import excludes the active board but includes all five high-score records in new exports. Older exports remain supported.

## Rewards and controls
The header coin counter opens the shop. The Finish button ends an active run (including Endless) and displays the coins earned; earned coins are credited automatically, not twice on completion. A normal restart asks for confirmation. The reward tab explains all sources, including score milestones (5 coins per 100 points), special creation (1/2/3 coins), combo milestones (5/15), natural Sugar Rush (5), completed non-mission runs (up to 30), a new existing record (25), newly earned stars (30 each), every tenth first-time Adventure completion (100), daily login (50), daily completion (100), lifetime 7/30-day streak milestones (250/1000), achievements (50), and Survival milestones. Starting coins for new profiles: 300.

Survival starts with 15 moves, caps at 30, and rewards matches, cascades, levels and Sugar Rush. Milestones at 25/50/100/200/500/1000 moves are one-time rewards. Undo is available once per run while the last move remains eligible; it reverses move-related rewards and lifetime statistics. Spending or using a booster, claiming a separate reward, or shuffling invalidates that move's undo. Undo history is not carried across a reload. Targeted boosters are consumed on target selection, not when armed. Cancel with Escape or the Boosters menu. Saves checkpoint before and after a move; closing during an animation restores the last completed move, not a partially cleared board.

## Service worker and future deployments
Localhost disables registration for development. If the previous worker is still controlling your local page, unregister it in DevTools → Application → Service Workers, close the tab and reopen. Do not clear localStorage. HTTPS hosting enables offline installation. The new worker precaches a whole release and waits for existing game tabs to close before activating. This avoids mixing old and new gameplay files mid-game. Every deployment that changes game assets, including minor HTML edits, MUST increment `RELEASE` at the top of sw.js. Deploy all files together. Once a new worker has downloaded, close all Sweet Swap tabs or installed app windows and reopen to activate it. No forced reload during play. Actual PWA installation and offline operation need testing over HTTPS; browser eviction can remove saved data, so keep exports.

## Audio
Both original synthesized MP3 loops may be used, modified and distributed without a fee. Device speech synthesis, vibration and fullscreen support vary.

## Validation
Node syntax checks passed for main.js and sw.js. Isolated Chromium checks with simulated localStorage passed for coin balance, hinted match, undo (score and coins), targeted booster cancellation, Endless finish and results, Survival start and mode-aware help. Layout bounds for key controls passed at 1366×768, 390×664, 320×568 and 844×390. One generated starting board per Adventure stage (100 total) had no initial matches and at least one legal move. Survival cap and score reward logic passed targeted checks. No uncaught JavaScript errors in these smoke tests. Localhost navigation was blocked in the test environment, so actual HTTPS/offline, audio output, storage persistence across real reloads, import/export end-to-end, all 100 level completions and every booster combination remain to be tested on the deployed game.
