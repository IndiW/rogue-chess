# Rogue Chess
A pixel-art chess roguelike for [GitHub Pages](https://indiw.github.io/rogue-chess/). No backend, accounts, or runtime API keys.

## Runs, clock and controls
Start from the main menu. **Resume run** restores your saved battle or rewards. **Restart run** returns to floor 1 with a fresh build. **Quit run** discards the active run. Restart and quit preserve permanent capture mastery and ask for confirmation. The in-game Menu button pauses the run; clicking the logo also returns to the menu.

You play White. Win to advance a floor; draw to replay the floor with your army's progress. Defeat or timeout ends the run and offers a saved three-choice random starter-relic pack. Select one starting relic for the next attempt. Equipped piece upgrades and looted inventory reset after defeat.

Each battle has **3:00 of player thinking time**, no increment. The clock starts only after White makes the first actual move. Selecting a piece, arming a power, or considering the first move does not start it. After that, it runs on White's turns, including extra moves, promotion choices, Oracle analysis, and background tabs. It pauses during Black's turn, in the main menu, and between battles. Hourglass never refunds time. Closing the page saves and pauses the clock; runs, pending packs, and their revealed choices can be resumed on this device.

Touch controls suppress accidental double-tap zoom while preserving pinch zoom. Checkmate first topples the defeated king, then shows a full-width blue/gold victory ribbon (or a defeat ribbon), then opens the rewards screen. Reduced-motion preferences are respected.

## Capture XP and packs
Captures award XP to the capturing piece: pawn **1**, knight/bishop **3**, rook **5**, queen **9**. Scholar adds 1 XP. Each individual piece earns packs at **3, 6 and 10 actual captures**, at most three per run. Capturing a queen still counts as one capture; Scholar increases mastery XP, not pack progress. Previously earned packs remain earned when migrating a save. Open earned packs on the dedicated rewards screen between battles after a win or draw.

Every piece pack contains exactly **two distinct, random eligible upgrades for that piece** and **one random general item**. Choose one; the other two are discarded. Owned upgrades are filtered out. Rolls are saved before their choices are shown, so reloading preserves the same offer. An improved passive replaces the corresponding charged movement ability instead of creating a redundant duplicate.

Piece identity follows the starting square, so the two knights or rooks have separate XP and builds. XP, upgrades, and identity continue between floors; captured pieces return next battle. Promotion and Royal seed transformations do not erase that identity. Charged piece abilities refresh each battle. General items from packs are consumable; the starting relic refreshes each battle.

Items occupy four fixed slots above the board, with selected-piece abilities directly beneath them. Pack counters do not change the board position. Between-game rewards show battle totals, sealed packs, claimed rewards and the next-floor loadout. Open a pack, watch its seal break, then choose one of three rewards; all packs must be claimed before advancing.

## Piece upgrades
Each type has four starting options and two branches unlocked by lifetime mastery:

| Piece | Starting movement power | Other starting options | At 8 mastery XP | At 20 mastery XP |
| --- | --- | --- | --- | --- |
| Pawn | Backstep: one backward empty-square step | Recall, Scholar, Momentum | Vanguard: starts a square forward | Second Wind |
| Knight | Shadow Step: adjacent empty diagonal | Recall, Scholar, Chain Jump | Long Stride: also jumps 3+1, including captures | Second Wind |
| Bishop | Sidestep: adjacent empty orthogonal | Recall, Scholar, Momentum | Pathfinder: unlimited Sidesteps | Second Wind |
| Rook | Corner Step: adjacent empty diagonal | Recall, Scholar, Momentum | Cornerwalk: unlimited Corner Steps | Second Wind |
| Queen | Royal Leap: empty-square knight jump | Recall, Scholar, Momentum | Skydance: unlimited Royal Leaps | Second Wind |
| King | King's Leap: empty, safe knight jump | Recall, Scholar, Momentum | Royal March: two safe, clear orthogonal steps | Second Wind |

- **Recall:** return to this piece's empty starting square once per battle. Does not restore castling rights.
- **Scholar:** captures by this piece earn 1 extra XP and mastery.
- **Momentum / Chain Jump:** once per battle, take a second non-capturing move with this piece. Giving check ends the turn. You can end the extra turn early.
- **Second Wind:** charged abilities on this piece get two uses each battle.

All moves must protect the player's king. Long Stride attacks also restrict enemy king movement and castling. Charged escapes are considered before declaring checkmate. Inspect a piece to see its XP, abilities, and remaining charges; arm a charged ability and select a highlighted destination. Small gold markers identify upgraded pieces.

Capture XP is banked as permanent mastery at battle end, including defeat, restart, or quit. New branches enter that piece type's random pool at **8 and 20 lifetime XP**. Unlocks persist; equipped builds do not survive a lost run. Hourglass rewinds the board, piece XP and pending packs, preventing duplicate mastery from undone captures. Time and consumed inventory remain spent.

## General items
- **Echo stone:** move the same piece twice; the extra action may capture. Giving check ends the turn.
- **Oracle lens:** recommend a strong move for the current position, including equipped powers.
- **Hourglass:** undo your last full turn and the enemy reply. Piece charges are restored with the position, but time and consumed general items are not.
- **Royal seed:** transform the a2 pawn into a knight at the next battle. A starting Royal seed does this every battle; looted seeds supply one battle each. Redundant seeds are excluded from packs if Royal seed is already the starting relic.

Pixel art and text labels identify **Time** (purple), **Insight** (blue), **Growth** (green), and piece **Movement** (amber).

## Browser opponents
Normal positions use **Stockfish 17.1 lite** in a single-threaded WebAssembly worker. Skill increases from 0 at floor 1 to 20 at floor 11, with depth caps 4–24 and think-time limits 250–2000 ms. Oracle uses full skill, depth cap 28 and up to 2.5 seconds. These are difficulty settings, not measured Elo ratings.

When movement powers or Echo charges are available, a separate **Rogue-aware engine** searches the same `RogueGame` actions and king-safety rules used by the player. It considers upgraded attacks, charged moves, and same-piece extra turns. It uses iterative deepening, alpha-beta pruning, capture search, material/position evaluation and power charges within a time budget. Its strength is different from Stockfish's standard-chess strength. The active backend is named under the Warden.

The 7.3 MB Stockfish WASM downloads only when needed and runs locally, without special server headers. If it cannot load or stalls in a standard position, a lightweight JavaScript fallback keeps the game playable. Variant failures show a retry action rather than silently using an engine with different rules.

## Audio
The original 8-bit soundtrack is a locally hosted, looping MP3 played through the browser media channel. Music defaults on after a user gesture; explicit saved mute preferences are respected. Use the menu Music control or header music-note button to start, retry or mute. The speaker independently controls synthesized move, capture, castle, promotion, check and pack-opening sounds. Music pauses in background tabs and resumes on return. No external audio services are used. The optional authoring script `node scripts/render-music.mjs` requires ffmpeg; ordinary builds use the tracked soundtrack.

## Develop and deploy
Requires Node 22 or later.

```sh
npm ci
npm run dev
npm test
npm run build
```

`predev` and `prebuild` stage the pinned lite Stockfish assets from npm. Tests cover standard and variant tactics, movement and castling safety, packs, rewards, XP, mastery and clocks. Source is split into `rules.js` (shared legality), `upgrades.js` (catalog), `progression.js` (XP/pack rules), `variant-engine.js` (upgrade-aware search), and `main.js` (UI/run state).

The build uses `/rogue-chess/` as its asset base. For local production preview, run `npx vite preview --base=/rogue-chess/`. `.github/workflows/pages.yml` tests, builds, and deploys pushes to `main` through GitHub Actions.

Progress is device-local under `rogue-chess-v2`; existing `rogue-chess-v1` profiles are migrated. A single save stores profile and run together; game actions and pack rolls save immediately, with clock snapshots every second. General audio preferences use their own key.

## Credits
Chess rules: [chess.js](https://github.com/jhlywa/chess.js), BSD-2-Clause. Stockfish.js 17.1 is GPLv3; see `public/engine/NOTICE.txt`. The pinned, unmodified lite JS/WASM and license are copied from npm. Corresponding source and build scripts are included in `public/engine/stockfish-source.tar.gz` (revision `602fd7e1a571a2be71f242942db90483731f2a1f`, generated binaries omitted). Credits, GPL text, and source are linked in help.

Original pixel pieces, item images, pack art, and procedural score were authored for this project. Google Fonts are optional network fonts with local fallbacks.
