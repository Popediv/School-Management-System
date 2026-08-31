const fs = require('fs');
const pdfParse = require('pdf-parse');

const fs = require('fs');
const pdfParse = require('pdf-parse');

const termRegexes = {
  FIRST: [/first\s*term/i, /1st\s*term/i],
  SECOND: [/second\s*term/i, /2nd\s*term/i],
  THIRD: [/third\s*term/i, /3rd\s*term/i]
};

function parseWeeksFromText(termText) {
  const schemes = [];

  // Strategy 1: Explicit "Week X" or "Wk X" matches
  const weekRegex = /(?:week|wk)\s*(\d+)/gi;
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
  } else {
    // Strategy 2: Numbered lists like "1. Topic", "2. Topic" under term header (e.g. 1. Environmental Chemistry...)
    const numRegex = /(?:^|\n)\s*(\d{1,2})[\.\)]\s*(.+)/g;
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
      // Fallback: parse entire document as FIRST term
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
  if (targetTerm && allResults[targetTerm]) {
    return allResults[targetTerm];
  }
  // Return whichever has results or FIRST
  return allResults.FIRST.length > 0 ? allResults.FIRST : (allResults.SECOND.length > 0 ? allResults.SECOND : allResults.THIRD);
}

module.exports = { extractSchemeFromPdf, extractAllSchemesFromPdf };

