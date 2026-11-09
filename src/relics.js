export const relics = [
  { id:'echo', name:'Echo stone', type:'time', typeName:'Time', desc:'Move the same piece twice before your opponent replies. Giving check ends your turn.' },
  { id:'oracle', name:'Oracle lens', type:'insight', typeName:'Insight', desc:'Reveal the engine’s recommended move for this position.' },
  { id:'rewind', name:'Hourglass', type:'time', typeName:'Time', desc:'Undo your last turn and the enemy reply. Time and consumed items are not restored.' },
  { id:'crown', name:'Royal seed', type:'growth', typeName:'Growth', desc:'Begin each battle with your a-pawn transformed into a knight.' },
];
// Original pixel art, built on the same integer grid and left-lit shading as
// the chess pieces. 1 outline, 2 shadow, 3 body, 4 highlight, 5 accent, 6 glint.
const art = {
  echo: [
    '................',
    '.......11.......',
    '......1441......',
    '.....143341.....',
    '....14333321....',
    '...1435333221...',
    '...1435533221...',
    '..143335332221..',
    '..143335332221..',
    '...1433353221...',
    '...1435353221...',
    '....14353321....',
    '....14333221....',
    '.....143321.....',
    '......1321......',
    '.......11.......',
    '................',
    '................',
  ],
  oracle: [
    '................',
    '.....11111......',
    '...114444411....',
    '..14433333441...',
    '..14346633321...',
    '.1434663333221..',
    '.1434333333221..',
    '.1433333333221..',
    '..13333333221...',
    '..12333332221...',
    '...112222211....',
    '.....11111551...',
    '..........1551..',
    '...........1551.',
    '............121.',
    '.............1..',
    '................',
    '................',
  ],
  rewind: [
    '................',
    '..144444444441..',
    '..133333333321..',
    '...1155555111...',
    '....14555421....',
    '....14355221....',
    '.....145521.....',
    '......1551......',
    '......1551......',
    '.....145521.....',
    '....14355221....',
    '....14555421....',
    '...1155555111...',
    '..144444444441..',
    '..133333333321..',
    '................',
    '................',
    '................',
  ],
  crown: [
    '................',
    '.......11.......',
    '..11...141..11..',
    '..145114411541..',
    '...1455555541...',
    '....15555551....',
    '.....111111.....',
    '....14444331....',
    '...1444433321...',
    '..144463333221..',
    '..143633333221..',
    '..143333333221..',
    '...1333333221...',
    '....12333221....',
    '.....122221.....',
    '......1111......',
    '................',
    '................',
  ],
};
const palettes = {
  echo:['#271e36','#644888','#a278d1','#e6cbff','#75dcd9','#ffffff'],
  oracle:['#152c3c','#275a79','#489fc7','#a7e9ff','#d6ad64','#f1fbff'],
  rewind:['#271e36','#644888','#a278d1','#e6cbff','#edc778','#fff0c6'],
  crown:['#1b3022','#3b6e42','#7dad62','#d2edaa','#e3b961','#efffda'],
};
const paths = Object.fromEntries(Object.entries(art).map(([id,rows]) => {
  const layers = Array.from({length:6}, () => '');
  rows.forEach((row,y) => [...row].forEach((pixel,x) => {
    if (pixel !== '.') layers[Number(pixel)-1] += `M${x} ${y}h1v1h-1z`;
  }));
  return [id,layers.map((path,index) => `<path fill="${palettes[id][index]}" d="${path}"/>`).join('')];
}));
export function relicSprite(id) {
  return `<svg viewBox="-1 -1 18 20" class="relic-sprite" aria-hidden="true"><ellipse cx="8" cy="16.4" rx="6" ry="1" fill="#0b140f" opacity=".4"/>${paths[id]}</svg>`;
}
