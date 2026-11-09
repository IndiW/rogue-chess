# Rogue Chess
A pixel-art chess roguelike, built for GitHub Pages. No backend, accounts, or runtime API keys.

## Play
You play White against Stockfish 17.1 lite running in a browser Web Worker. Win to advance a floor; lose or resign to choose a relic and restart at floor 1. Draw to replay the current floor. Standard chess legality is provided by chess.js, including castling, en passant, and a promotion picker.

Each battle gives you **three minutes of total player thinking time**, with no increment. The clock runs only on White’s turn, including Oracle searches, Echo moves, promotion choices, help dialogs, and time in background tabs. Black’s turn and engine loading on Black’s turn pause the clock. Timeout ends the run and opens relic selection. Each new battle starts at 3:00. Hourglass never refunds spent time.

- **Echo stone:** once per battle, move the same piece twice. Each move must be legal; you cannot leave your king in check. End the turn early if desired. Giving check ends your turn immediately, preventing an unanswered check. Checkmate ends the battle immediately.
- **Oracle lens:** one full-skill Stockfish recommendation per battle, with up to 2.5 seconds of analysis.
- **Hourglass:** undo your last turn and the opponent reply, once per battle.
- **Royal seed:** start each battle with a knight in place of the a2 pawn.

Relic images use the same pixel grid, directional highlights, and shadows as the pieces. Type colors and visible labels identify **Time** (purple: Echo stone and Hourglass), **Insight** (blue: Oracle lens), and **Growth** (green: Royal seed).

A chosen relic lasts the run; charges refresh per floor. Choosing a relic after defeat replaces the previous one. Progress is stored locally; reloading restarts the current battle. Stockfish skill rises from 0 on floor 1 to 20 on floor 11. Search depth caps rise from 4 to 24, with think-time limits from 250 ms to 2 seconds. Later floors retain maximum difficulty. The Oracle uses skill 20, depth cap 28, and a 2.5-second limit regardless of floor. These are difficulty settings, not measured Elo ratings.

The 7.3 MB single-threaded WebAssembly engine downloads on the first search, then runs locally. No shared-memory or special server headers are required. If it cannot load or a search stalls, a small JavaScript minimax engine supplies legal moves instead. The opponent label identifies the active backend. If both engines fail, a retry control is shown.

## Audio and pixel pieces

Use the music-note button in the header to start the original 8-bit soundtrack. Music is off on first visit; sound effects are on. Both controls save your preference on this device. Audio starts after a click or keypress, and the music pauses in background tabs. Move, capture, castling, promotion, and check cues are synthesized with Web Audio, with no audio downloads or external services.

The six piece types use original 15 × 19 pixel silhouettes, carved details, directional highlights, and contact shadows.

## Develop
Requires Node 22 or later.

```sh
npm ci
npm run dev
npm test
npm run build
```

`predev` and `prebuild` stage the engine assets into `public/engine/`; only the lite single-threaded distribution is shipped. `npm test` covers engine settings, the lightweight fallback, and tactical positions using the actual bundled Stockfish WASM.

The build uses `/rogue-chess/` as its asset base. `.github/workflows/pages.yml` builds and deploys to GitHub Pages on pushes to main. Enable Pages with GitHub Actions as the source.

Chess rules: [chess.js](https://github.com/jhlywa/chess.js), BSD-2-Clause. Stockfish.js 17.1 is GPLv3; see `public/engine/NOTICE.txt`. The build copies the pinned, unmodified lite engine and license from npm. Corresponding source and build scripts are included in `public/engine/stockfish-source.tar.gz` (upstream revision `602fd7e1a571a2be71f242942db90483731f2a1f`, generated engine binaries omitted). Credits, GPL text, and source downloads are also linked from the game’s help panel.

Original pixel piece silhouettes authored for this project. Google Fonts are optional network fonts with local fallbacks.
