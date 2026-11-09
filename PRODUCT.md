# Rogue Chess
A static browser chess roguelike hosted on GitHub Pages. The player controls White against a local engine. Victories advance the floor and increase engine strength. Defeat resets to floor 1 and lets the player choose one replacement relic for the next run. Relics persist through wins; active charges refresh per battle. Draws replay the same floor. Device-local progression is saved; in-progress games restart on reload.

Relics: Echo Stone (same piece makes two legal moves once per battle), Oracle Lens (one engine recommendation per battle), Hourglass (one full-turn takeback per battle), Royal Seed (a2 pawn starts as a knight).

Engine: Stockfish.js 17.1 lite single-threaded WASM, loaded lazily and hosted with the game. Floors 1–11 scale skill 0–20 with depth caps 4–24 and 250–2000 ms search limits. Later floors keep maximum strength. Oracle always uses skill 20, depth cap 28, and 2500 ms. All returned Stockfish moves are validated by chess.js. A JavaScript minimax fallback keeps games playable if WASM cannot load or search times out; the current backend is shown under the opponent name. Engine failures expose a retry action. GPLv3, corresponding source, and credits are linked in help.

Battles have a 180-second total player clock, no increment. It runs whenever White owns the turn, including Oracle analysis, Echo extra actions, promotion choices, and background tabs. It pauses on Black’s turn and stops at battle end. Timeout counts as defeat with relic selection. A new battle resets the clock; Hourglass does not restore time.

Relic presentation: original pixel sprites on inventory and selection cards. Time (purple): Echo stone/Hourglass; Insight (blue): Oracle lens; Growth (green): Royal seed. Text labels identify types independently of color.

Piece-upgrade system remains in discussion, not implemented: user prefers XP earned through captures, progression/unlocks across runs, and a mix of movement changes and charged abilities. Whether equipped upgrades persist after defeat and when choices occur are open decisions.
