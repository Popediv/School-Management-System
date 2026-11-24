/**
 * Calculates grade from total score
 * Scale: A (75–100), B (65–74), C (55–64), D (45–54), E (40–44), F (0–39)
 */
function calculateGrade(total) {
  if (total >= 75) return 'A';
  if (total >= 65) return 'B';
  if (total >= 55) return 'C';
  if (total >= 45) return 'D';
  if (total >= 40) return 'E';
  return 'F';
}

/**
 * Calculates remark from grade
 */
function gradeRemark(grade) {
  const map = {
    A: 'Excellent',
    B: 'Very Good',
    C: 'Good',
    D: 'Pass',
    E: 'Poor',
    F: 'Fail',
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

