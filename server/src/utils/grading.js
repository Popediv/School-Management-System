/**
 * Calculates grade from total score (Nigerian WAEC style)
 */
function calculateGrade(total) {
  if (total >= 75) return 'A1';
  if (total >= 70) return 'B2';
  if (total >= 65) return 'B3';
  if (total >= 60) return 'C4';
  if (total >= 55) return 'C5';
  if (total >= 50) return 'C6';
  if (total >= 45) return 'D7';
  if (total >= 40) return 'E8';
  return 'F9';
}

/**
 * Calculates remark from grade
 */
function gradeRemark(grade) {
  const map = {
    A1: 'Excellent', B2: 'Very Good', B3: 'Good',
    C4: 'Credit',   C5: 'Credit',    C6: 'Credit',
    D7: 'Pass',     E8: 'Pass',      F9: 'Fail',
  };
  return map[grade] || '';
}

/**
 * Calculates class positions from an array of { studentId, total }
 * Returns { [studentId]: position } (supports ties)
 */
function calculatePositions(scores) {
  const sorted = [...scores].sort((a, b) => (b.total || 0) - (a.total || 0));
  const positions = {};
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i].total === sorted[i - 1].total) {
      positions[sorted[i].studentId] = positions[sorted[i - 1].studentId];
    } else {
      positions[sorted[i].studentId] = i + 1;
    }
  }
  return positions;
}

/**
 * Formats a numeric rank into an ordinal string e.g. 1 -> '1st', 2 -> '2nd'
 */
function formatPosition(pos) {
  if (!pos || isNaN(pos)) return '—';
  const n = parseInt(pos, 10);
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

module.exports = { calculateGrade, gradeRemark, calculatePositions, formatPosition };

