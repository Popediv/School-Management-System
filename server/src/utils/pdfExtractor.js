const fs = require('fs');
const pdfParse = require('pdf-parse');

async function extractSchemeFromPdf(pdfPath, targetTerm) {
  try {
    if (!fs.existsSync(pdfPath)) {
      throw new Error('PDF file does not exist at path: ' + pdfPath);
    }

    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdfParse(dataBuffer);
    const text = data.text;

    let termText = text;
    
    const termRegexes = {
      FIRST: [/first\s*term/i, /1st\s*term/i],
      SECOND: [/second\s*term/i, /2nd\s*term/i],
      THIRD: [/third\s*term/i, /3rd\s*term/i]
    };

    const getTermPositions = () => {
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
      return pos;
    };

    const positions = getTermPositions();
    
    // Segment text by term if matches are found
    if (positions[targetTerm] !== -1) {
      let endPos = text.length;
      for (const term of ['FIRST', 'SECOND', 'THIRD']) {
        if (term !== targetTerm && positions[term] > positions[targetTerm]) {
          if (positions[term] < endPos) {
            endPos = positions[term];
          }
        }
      }
      termText = text.substring(positions[targetTerm], endPos);
    }

    // Parse weeks
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

    // Sort matches by index
    matches.sort((a, b) => a.index - b.index);

    const schemes = [];
    for (let i = 0; i < matches.length; i++) {
      const current = matches[i];
      const next = matches[i + 1];
      const start = current.index + current.fullMatch.length;
      const end = next ? next.index : termText.length;
      
      let content = termText.substring(start, end).trim();
      let lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length === 0) continue;

      let topic = lines[0];
      topic = topic.replace(/^[:\-\s\.]+/g, '').trim();

      let objectives = '';
      let notesText = '';

      const objIndex = lines.findIndex(l => /objective/i.test(l));
      if (objIndex !== -1) {
        objectives = lines.slice(objIndex + 1, objIndex + 4).join('\n');
        notesText = lines.slice(objIndex + 4).join('\n');
      } else {
        notesText = lines.slice(1).join('\n');
      }

      if (topic.length > 120) {
        topic = topic.substring(0, 117) + '...';
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

    // Deduplicate
    const uniqueSchemes = [];
    const weeksSeen = new Set();
    for (const s of schemes) {
      if (!weeksSeen.has(s.week)) {
        weeksSeen.add(s.week);
        uniqueSchemes.push(s);
      }
    }

    return uniqueSchemes.sort((a, b) => a.week - b.week);
  } catch (err) {
    console.error('Error extracting text from PDF:', err);
    return [];
  }
}

module.exports = { extractSchemeFromPdf };
