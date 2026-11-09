# Rogue Chess
A pixel-art chess roguelike, built for GitHub Pages. No backend, accounts, or runtime API keys.

## Play
You play White against an in-browser minimax engine running in a Web Worker. Win to advance a floor; lose or resign to choose a relic and restart at floor 1. Draw to replay the current floor. Standard chess legality is provided by chess.js, including castling, en passant, and a promotion picker.

- **Echo stone:** once per battle, move the same piece twice. Each move must be legal; you cannot leave your king in check. End the turn early if desired. Giving check ends your turn immediately, preventing an unanswered check. Checkmate ends the battle immediately.
- **Oracle lens:** a single depth-3 engine recommendation per battle.
- **Hourglass:** undo your last turn and the opponent reply, once per battle.
- **Royal seed:** start each battle with a knight in place of the a2 pawn.

A chosen relic lasts the run; charges refresh per floor. Choosing a relic after defeat replaces the previous one. Progress is stored locally; reloading restarts the current battle. Engine depth rises from 1 to 3 over the first five floors; floors continue indefinitely at depth 3. This is a simple engine, not Stockfish.

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

The build uses `/rogue-chess/` as its asset base. `.github/workflows/pages.yml` builds and deploys to GitHub Pages on pushes to main. Enable Pages with GitHub Actions as the source.

Chess rules: [chess.js](https://github.com/jhlywa/chess.js), BSD-2-Clause. Original pixel piece silhouettes authored for this project. Google Fonts are optional network fonts with local fallbacks.
