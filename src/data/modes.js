// Game modes. rank: 'score' keeps the highest score, 'time' keeps the fastest finish.
//   startLevel  starting level (gravity + score multiplier)
//   levelUp     level rises every 10 lines
//   goalLines   finish after this many lines
//   timeLimit   finish after this many seconds
//   garbage     start with this many garbage rows; finish when all are gone
export const MODES = [
  { id: 'marathon', name: '마라톤', goal: '10줄마다 빨라져요 · 150줄 목표', startLevel: 1, levelUp: true, goalLines: 150, rank: 'score', color: '#3fe4ff' },
  { id: 'sprint', name: '40줄', goal: '40줄을 최대한 빨리 지우세요', startLevel: 1, goalLines: 40, rank: 'time', color: '#ffc23f' },
  { id: 'ultra', name: '2분', goal: '2분 동안 최고 점수를 노리세요', startLevel: 1, timeLimit: 120, rank: 'score', color: '#9b7bff' },
  { id: 'dig', name: '청소', goal: '회색 쓰레기 줄 10개를 모두 지우세요', startLevel: 1, garbage: 10, rank: 'time', color: '#3ee0a1' },
];
