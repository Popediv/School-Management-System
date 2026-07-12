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
 * Returns { [studentId]: position }
 */
function calculatePositions(scores) {
  const sorted = [...scores].sort((a, b) => b.total - a.total);
  const positions = {};
  sorted.forEach((s, i) => { positions[s.studentId] = i + 1; });
  return positions;
}

module.exports = { calculateGrade, gradeRemark, calculatePositions };
