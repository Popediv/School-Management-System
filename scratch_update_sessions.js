const fs = require('fs');
const path = require('path');

const files = [
  'client/src/pages/teachers/TeacherListPage.jsx',
  'client/src/pages/students/StudentRegisterPage.jsx',
  'client/src/pages/students/StudentProfilePage.jsx',
  'client/src/pages/schemes/SchemesPage.jsx',
  'client/src/pages/schemes/ManageSchemePage.jsx',
  'client/src/pages/schemes/ManagePdfsPage.jsx',
  'client/src/pages/fees/FeesPage.jsx',
  'client/src/pages/classes/PromotionPage.jsx',
  'client/src/pages/idcards/IDCardPage.jsx' // Just in case, though it's sample data mostly
];

files.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (!fs.existsSync(fullPath)) return;

  let content = fs.readFileSync(fullPath, 'utf8');
  let originalContent = content;
  
  // Replace the 3 options
  const optionsRegex = /<option value="2024\/2025">2024\/2025<\/option>\s*<option value="2025\/2026">2025\/2026<\/option>\s*<option value="2026\/2027">2026\/2027<\/option>/g;
  content = content.replace(optionsRegex, '{SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}');
  
  // Replace the array mapping
  content = content.replace(/\{?\['2024\/2025','2025\/2026','2026\/2027'\]\}?\.map/g, '{SESSIONS.map');
  content = content.replace(/options=\{?\['2024\/2025',\s*'2025\/2026',\s*'2026\/2027'\]\}?/g, 'options={SESSIONS}');
  
  // Replace the hardcoded state / default values
  // Only replace '2025/2026' when it's standalone in quotes
  content = content.replace(/'2025\/2026'/g, 'CURRENT_SESSION');
  
  // Add import if not exists
  if (content !== originalContent && !content.includes('import { SESSIONS')) {
    const depth = file.split('/').length - 3; // client/src/pages/... depth relative to src
    let relativePath = '../../utils/constants';
    if (depth === 1) relativePath = '../../utils/constants'; // client/src/pages/Folder/File.jsx (2 up to src)
    if (depth === 0) relativePath = '../utils/constants'; // client/src/pages/File.jsx (1 up to src)
    
    const importStmt = `import { SESSIONS, CURRENT_SESSION } from '${relativePath}';\n`;
    
    // Find the last import line
    const lastImportIndex = content.lastIndexOf('import ');
    if (lastImportIndex !== -1) {
      const endOfImport = content.indexOf('\n', lastImportIndex);
      content = content.slice(0, endOfImport + 1) + importStmt + content.slice(endOfImport + 1);
    } else {
      content = importStmt + content;
    }
    
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});
