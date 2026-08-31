const fs = require('fs');

const termRegexes = {
  FIRST: [/first\s*term/i, /1st\s*term/i, /term\s*one/i, /term\s*1/i],
  SECOND: [/second\s*term/i, /2nd\s*term/i, /term\s*two/i, /term\s*2/i],
  THIRD: [/third\s*term/i, /3rd\s*term/i, /term\s*three/i, /term\s*3/i]
};

/**
 * Smart Spacing Sanitizer: Fixes concatenated words (e.g., "DefinitionofChemistry" -> "Definition of Chemistry")
 */
function sanitizeSpacing(text) {
  if (!text || typeof text !== 'string') return '';

  return text
    // Remove leading hyphens/bullets from headers
    .replace(/^[\s\-–—]+/g, '')
    // Add space between lowercase and uppercase (CamelCase concatenation)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    // Add space between uppercase sequences and mixed case
    .replace(/([A-Z]{2,})([A-Z][a-z])/g, '$1 $2')
    // Add space after punctuation attached to words (e.g. "matter.Composition" -> "matter. Composition")
    .replace(/([a-zA-Z0-9\)])([.,;:!?])([a-zA-Z])/g, '$1$2 $3')
    // Convert square/box glyphs to clean bullet points
    .replace(/[□■●]/g, '• ')
    // Normalize spaces and tabs
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/**
 * Universal PDF Text Reader supporting pdf-parse v1, v2, and raw buffer parsing fallback
 */
async function readPdfText(pdfPath) {
  if (!fs.existsSync(pdfPath)) {
    throw new Error('PDF file does not exist at path: ' + pdfPath);
  }

  const dataBuffer = fs.readFileSync(pdfPath);
  let extractedText = '';

  // 1. Try standard / v2 pdf-parse module with explicit itemJoiner spacing
  try {
    const pdfParseModule = require('pdf-parse');
    if (typeof pdfParseModule === 'function') {
      const data = await pdfParseModule(dataBuffer);
      if (data && data.text) {
        extractedText = data.text;
      }
    } else if (pdfParseModule.PDFParse) {
      const parser = new pdfParseModule.PDFParse({ data: new Uint8Array(dataBuffer) });
      if (typeof parser.getText === 'function') {
        // Explicitly instruct pdf-parse v2 to join text items with spaces
        const res = await parser.getText({
          itemJoiner: ' ',
          cellSeparator: ' ',
          lineEnforce: true,
          lineThreshold: 2
        });
        extractedText = typeof res === 'string' ? res : (res?.text || '');
      }
    }
  } catch (err) {
    console.error('PDF Library text parsing notice:', err.message);
  }

  // 2. Fallback: Raw binary text stream reader
  if (!extractedText || !extractedText.trim()) {
    try {
      const rawString = dataBuffer.toString('binary');
      const textBlocks = [];
      const tjRegex = /\(([^)]+)\)\s*T[jJ]/g;
      let match;
      while ((match = tjRegex.exec(rawString)) !== null) {
        const text = match[1].replace(/\\([()\\])/g, '$1').trim();
        if (text && text.length > 1) {
          textBlocks.push(text);
        }
      }
      if (textBlocks.length > 5) {
        extractedText = textBlocks.join(' ');
      }
    } catch (rawErr) {
      console.error('Raw binary reader notice:', rawErr.message);
    }
  }

  return sanitizeSpacing(extractedText);
}

/**
 * Multi-Strategy Parser for extracting weekly topics from text chunks.
 */
function parseWeeksFromText(termText) {
  if (!termText || !termText.trim()) return [];

  const schemes = [];

  // Strategy A: Explicit "Week X", "Wk X", "Lesson X", "Topic X", "Module X", "Unit X", "Chapter X"
  const weekRegex = /(?:week|wk|lesson|topic|module|unit|chapter)\s*(\d+)/gi;
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

      let topic = sanitizeSpacing(lines[0].replace(/^[:\-\s\.]+/g, ''));
      let objectives = '';
      let notesText = '';

      const objIndex = lines.findIndex(l => /objective/i.test(l));
      if (objIndex !== -1) {
        objectives = lines.slice(objIndex + 1, objIndex + 4).map(sanitizeSpacing).join('\n');
        notesText = lines.slice(objIndex + 4).map(sanitizeSpacing).join('\n');
      } else {
        notesText = lines.slice(1).map(sanitizeSpacing).join('\n');
      }

      if (topic.length > 150) {
        topic = topic.substring(0, 147) + '...';
      }

      if (current.week >= 1 && current.week <= 50) {
        schemes.push({
          week: current.week,
          topic: topic || `Topic ${current.week}`,
          objectives: objectives || null,
          notesText: notesText || null
        });
      }
    }
  }

  // Strategy B: Numbered lists like "1. Topic", "2) Topic", "1 - Topic"
  if (schemes.length === 0) {
    const numRegex = /(?:^|\n)\s*(\d{1,2})[\.\)\-]\s*(.+)/g;
    let nMatch;
    const numMatches = [];

    while ((nMatch = numRegex.exec(termText)) !== null) {
      const wkNum = parseInt(nMatch[1]);
      if (wkNum >= 1 && wkNum <= 50) {
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

        let topic = sanitizeSpacing(current.rawTopic.replace(/^[:\-\s\.]+/g, ''));
        let notesText = lines.slice(1).map(sanitizeSpacing).join('\n');

        if (topic.length > 150) {
          topic = topic.substring(0, 147) + '...';
        }

        schemes.push({
          week: current.week,
          topic: topic || `Topic ${current.week}`,
          objectives: null,
          notesText: notesText || null
        });
      }
    }
  }

  // Strategy C: Table cell layout ("1 | Topic Name | ...")
  if (schemes.length === 0) {
    const lines = termText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    for (const line of lines) {
      const tableMatch = line.match(/^(\d{1,2})\s*[\|\t\:]\s*(.+)/);
      if (tableMatch) {
        const wkNum = parseInt(tableMatch[1]);
        if (wkNum >= 1 && wkNum <= 50) {
          let parts = tableMatch[2].split(/[\|\t]/).map(p => sanitizeSpacing(p)).filter(Boolean);
          schemes.push({
            week: wkNum,
            topic: parts[0] || `Topic ${wkNum}`,
            objectives: parts[1] || null,
            notesText: parts.slice(2).join('\n') || null
          });
        }
      }
    }
  }

  // Strategy D: Paragraph lines fallback (Smart NLP split)
  if (schemes.length === 0) {
    const rawLines = termText
      .split('\n')
      .map(l => l.trim())
      .filter(l => {
        if (!l || l.length < 4) return false;
        if (/scheme\s*of\s*work|lesson\s*notes|curriculum|subject|class|term|table\s*of\s*content/i.test(l) && l.length < 45) return false;
        return true;
      });

    let weekNum = 1;
    for (const line of rawLines) {
      if (weekNum > 36) break;
      let cleanTopic = sanitizeSpacing(line.replace(/^[\d\.\:\-\s\)\(]+/g, ''));
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
 * Distribute extracted weekly topics into FIRST, SECOND, and THIRD terms.
 */
function distributeWeeksIntoTerms(allWeeks) {
  const results = { FIRST: [], SECOND: [], THIRD: [] };

  if (!allWeeks || allWeeks.length === 0) return results;

  const total = allWeeks.length;

  if (total <= 13) {
    results.FIRST = allWeeks;
  } else {
    const chunkSize = Math.ceil(total / 3);
    results.FIRST = allWeeks.slice(0, chunkSize).map((w, idx) => ({ ...w, week: idx + 1 }));
    results.SECOND = allWeeks.slice(chunkSize, chunkSize * 2).map((w, idx) => ({ ...w, week: idx + 1 }));
    results.THIRD = allWeeks.slice(chunkSize * 2).map((w, idx) => ({ ...w, week: idx + 1 }));
  }

  return results;
}

/**
 * Main function to extract all schemes across terms from a PDF file.
 */
async function extractAllSchemesFromPdf(pdfPath) {
  try {
    const text = await readPdfText(pdfPath);
    if (!text || !text.trim()) {
      console.warn('PDF text extraction produced empty result for path:', pdfPath);
      return { FIRST: [], SECOND: [], THIRD: [] };
    }

    // Check if explicit term headers exist in text
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

    const termsWithPos = Object.keys(pos)
      .map(t => ({ term: t, index: pos[t] }))
      .filter(item => item.index !== -1)
      .sort((a, b) => a.index - b.index);

    if (termsWithPos.length >= 2) {
      const results = { FIRST: [], SECOND: [], THIRD: [] };
      for (let i = 0; i < termsWithPos.length; i++) {
        const current = termsWithPos[i];
        const next = termsWithPos[i + 1];
        const start = current.index;
        const end = next ? next.index : text.length;

        const termChunk = text.substring(start, end);
        results[current.term] = parseWeeksFromText(termChunk);
      }
      return results;
    }

    // Fallback: Extract all lessons/topics and distribute evenly across First, Second, Third terms
    const allWeeks = parseWeeksFromText(text);
    return distributeWeeksIntoTerms(allWeeks);
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

module.exports = { extractSchemeFromPdf, extractAllSchemesFromPdf, readPdfText, sanitizeSpacing };
