export function engineSettings(level = 1, kind = 'engine') {
  if (kind === 'hint') return { skill: 20, depth: 28, timeMs: 2500 };
  const floor = Number.isFinite(Number(level)) ? Math.max(1, Math.floor(Number(level))) : 1;
  const tier = Math.min(10, floor - 1);
  return {
    skill: tier * 2,
    depth: tier === 0 ? 4 : Math.min(24, 3 + tier * 2),
    timeMs: Math.min(2000, 250 + tier * 175),
  };
}
export function engineRank(level) {
  if (level < 3) return 'Apprentice';
  if (level < 5) return 'Tactician';
  if (level < 8) return 'Veteran';
  if (level < 11) return 'Master';
  return 'Grandmaster';
}
