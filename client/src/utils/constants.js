export const CURRENT_SESSION = '2025/2026';

export const generateSessions = (startYear = 2023, numYears = 20) => {
  return Array.from({ length: numYears }, (_, i) => {
    const year = startYear + i;
    return `${year}/${year + 1}`;
  });
};

export const SESSIONS = generateSessions();
