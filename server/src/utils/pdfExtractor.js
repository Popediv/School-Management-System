const fs = require('fs');
const pdfParse = require('pdf-parse');

const termRegexes = {
  FIRST: [/first\s*term/i, /1st\s*term/i, /term\s*one/i, /term\s*1/i],
  SECOND: [/second\s*term/i, /2nd\s*term/i, /term\s*two/i, /term\s*2/i],
  THIRD: [/third\s*term/i, /3rd\s*term/i, /term\s*three/i, /term\s*3/i]
};

/**
 * Multi-Strategy Parser for extracting weekly topics from text chunks.
 */
function parseWeeksFromText(termText) {
  if (!termText || !termText.trim()) return [];

  const schemes = [];

  // Strategy 1: Explicit "Week X", "Wk X", "Lesson X", "Module X", "Unit X"
  const weekRegex = /(?:week|wk|lesson|module|unit)\s*(\d+)/gi;
  const matches = [];
  let match;
  while ((match = weekRegex.exec(termText)) !== null) {
    matches.push({
      week: parseInt(match[1]),
      index: match.index,
      fullMatch: match[0]
    });
  }

  if (matches.length > 0) {
    matches.sort((a, b) => a.index - b.index);

    for (let i = 0; i < matches.length; i++) {
      const current = matches[i];
      const next = matches[i + 1];
      const start = current.index + current.fullMatch.length;
      const end = next ? next.index : termText.length;

      let content = termText.substring(start, end).trim();
      let lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length === 0) continue;

      let topic = lines[0].replace(/^[:\-\s\.]+/g, '').trim();
      let objectives = '';
      let notesText = '';

      const objIndex = lines.findIndex(l => /objective/i.test(l));
      if (objIndex !== -1) {
        objectives = lines.slice(objIndex + 1, objIndex + 4).join('\n');
        notesText = lines.slice(objIndex + 4).join('\n');
      } else {
        notesText = lines.slice(1).join('\n');
      }

      if (topic.length > 150) {
        topic = topic.substring(0, 147) + '...';
      }

      if (current.week >= 1 && current.week <= 15) {
        schemes.push({
          week: current.week,
          topic: topic || `Week ${current.week} Topic`,
          objectives: objectives || null,
          notesText: notesText || null
        });
      }
    }
  }

  // Strategy 2: Numbered lists like "1. Topic", "2) Topic", "1 - Topic" (if Strategy 1 found no results)
  if (schemes.length === 0) {
    const numRegex = /(?:^|\n)\s*(\d{1,2})[\.\)\-]\s*(.+)/g;
    let nMatch;
    const numMatches = [];

    while ((nMatch = numRegex.exec(termText)) !== null) {
      const wkNum = parseInt(nMatch[1]);
      if (wkNum >= 1 && wkNum <= 15) {
        numMatches.push({
          week: wkNum,
          index: nMatch.index,
          rawTopic: nMatch[2].trim()
        });
      }
    }

    if (numMatches.length > 0) {
      numMatches.sort((a, b) => a.index - b.index);

      for (let i = 0; i < numMatches.length; i++) {
        const current = numMatches[i];
        const next = numMatches[i + 1];
        const end = next ? next.index : termText.length;

        let rawBlock = termText.substring(current.index, end).trim();
        let lines = rawBlock.split('\n').map(l => l.trim()).filter(l => l.length > 0);

        let topic = current.rawTopic.replace(/^[:\-\s\.]+/g, '').trim();
        let notesText = lines.slice(1).join('\n');

        if (topic.length > 150) {
          topic = topic.substring(0, 147) + '...';
        }

        schemes.push({
          week: current.week,
          topic: topic || `Week ${current.week} Topic`,
          objectives: null,
          notesText: notesText || null
        });
      }
    }
  }

  // Strategy 3: Table cell layout ("1 | Topic Name | ...")
  if (schemes.length === 0) {
    const lines = termText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    let weekCounter = 1;

    for (const line of lines) {
      // Check if line starts with a number 1-15 followed by separator or tab
      const tableMatch = line.match(/^(\d{1,2})\s*[\|\t\:]\s*(.+)/);
      if (tableMatch) {
        const wkNum = parseInt(tableMatch[1]);
        if (wkNum >= 1 && wkNum <= 15) {
          let parts = tableMatch[2].split(/[\|\t]/).map(p => p.trim()).filter(Boolean);
          schemes.push({
            week: wkNum,
            topic: parts[0] || `Week ${wkNum} Topic`,
            objectives: parts[1] || null,
            notesText: parts.slice(2).join('\n') || null
          });
        }
      }
    }
  }

  // Strategy 4: Line-by-line fallback (if document has plain paragraph lines)
  if (schemes.length === 0) {
    const rawLines = termText
      .split('\n')
      .map(l => l.trim())
      .filter(l => {
        if (!l || l.length < 4) return false;
        if (/scheme\s*of\s*work|lesson\s*notes|curriculum|subject|class|term/i.test(l) && l.length < 40) return false;
        return true;
      });

    let weekNum = 1;
    for (const line of rawLines) {
      if (weekNum > 13) break;
      let cleanTopic = line.replace(/^[\d\.\:\-\s\)\(]+/g, '').trim();
      if (cleanTopic.length > 150) cleanTopic = cleanTopic.substring(0, 147) + '...';

      if (cleanTopic.length > 0) {
        schemes.push({
          week: weekNum,
          topic: cleanTopic,
          objectives: null,
          notesText: null
        });
        weekNum++;
      }
    }
  }

  // Deduplicate by week
  const uniqueSchemes = [];
  const weeksSeen = new Set();
  for (const s of schemes) {
    if (!weeksSeen.has(s.week)) {
      weeksSeen.add(s.week);
      uniqueSchemes.push(s);
    }
  }

  return uniqueSchemes.sort((a, b) => a.week - b.week);
}

/**
 * Main function to extract all schemes across terms from a PDF file.
 */
async function extractAllSchemesFromPdf(pdfPath) {
  try {
    if (!fs.existsSync(pdfPath)) {
      throw new Error('PDF file does not exist at path: ' + pdfPath);
    }

    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdfParse(dataBuffer);
    const text = data.text || '';

    const pos = { FIRST: -1, SECOND: -1, THIRD: -1 };
    for (const term of ['FIRST', 'SECOND', 'THIRD']) {
      for (const r of termRegexes[term]) {
        const match = text.search(r);
        if (match !== -1) {
          pos[term] = match;
          break;
        }
      }
    }

    const results = { FIRST: [], SECOND: [], THIRD: [] };

    const termsWithPos = Object.keys(pos)
      .map(t => ({ term: t, index: pos[t] }))
      .filter(item => item.index !== -1)
      .sort((a, b) => a.index - b.index);

    if (termsWithPos.length > 0) {
      for (let i = 0; i < termsWithPos.length; i++) {
        const current = termsWithPos[i];
        const next = termsWithPos[i + 1];
        const start = current.index;
        const end = next ? next.index : text.length;

        const termChunk = text.substring(start, end);
        results[current.term] = parseWeeksFromText(termChunk);
      }
    } else {
      // Fallback: parse entire document as FIRST term or distribute across terms if long
      results.FIRST = parseWeeksFromText(text);
    }

    return results;
  } catch (err) {
    console.error('Error extracting text from PDF:', err);
    return { FIRST: [], SECOND: [], THIRD: [] };
  }
}

async function extractSchemeFromPdf(pdfPath, targetTerm) {
  const allResults = await extractAllSchemesFromPdf(pdfPath);
  if (targetTerm && allResults[targetTerm] && allResults[targetTerm].length > 0) {
    return allResults[targetTerm];
  }
  return allResults.FIRST.length > 0 ? allResults.FIRST : (allResults.SECOND.length > 0 ? allResults.SECOND : allResults.THIRD);
}

module.exports = { extractSchemeFromPdf, extractAllSchemesFromPdf };
