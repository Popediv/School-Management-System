/**
 * moodle-sync-cli.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Command-Line / Scheduled Runner for Moodle → SMS Grade Sync.
 * Can be run manually in terminal or triggered automatically via Windows Task
 * Scheduler or Linux crontab.
 *
 * Usage:
 *   node scripts/moodle-sync-cli.js
 *   node scripts/moodle-sync-cli.js --session "2025/2026" --term FIRST
 *   node scripts/moodle-sync-cli.js --session "2025/2026" --term SECOND
 *   node scripts/moodle-sync-cli.js --session "2025/2026" --term THIRD
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const path = require('path');
const fs = require('fs');
const { getMoodleConfig } = require('../src/modules/moodle-sync/moodle.config');
const { runSync } = require('../src/modules/moodle-sync/moodle.engine');
const { getStoredSettings } = require('../src/modules/settings/settings.controller');

// Parse CLI flags
function parseArgs() {
  const args = process.argv.slice(2);
  const params = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--session' && args[i + 1]) {
      params.session = args[++i];
    } else if (args[i] === '--term' && args[i + 1]) {
      params.term = args[++i];
    }
  }
  return params;
}

// Append log to JSON history
const LOG_PATH = path.join(__dirname, '..', 'src', 'config', 'moodle_sync_logs.json');
function saveLog(entry) {
  try {
    let logs = [];
    if (fs.existsSync(LOG_PATH)) {
      logs = JSON.parse(fs.readFileSync(LOG_PATH, 'utf8'));
    }
    logs.unshift(entry);
    const trimmed = logs.slice(0, 50);
    fs.writeFileSync(LOG_PATH, JSON.stringify(trimmed, null, 2));
  } catch (e) {
    console.error('Failed to write log file:', e.message);
  }
}

async function main() {
  console.log('====================================================');
  console.log('       PATIMO SMS — MOODLE GRADE SYNC CLI           ');
  console.log('====================================================\n');

  const cliParams = parseArgs();
  const schoolSettings = getStoredSettings();

  const session = cliParams.session || schoolSettings.currentSession || '2025/2026';
  const term = cliParams.term || schoolSettings.currentTerm || 'FIRST';

  console.log(`Academic Session: ${session}`);
  console.log(`Academic Term:    ${term}\n`);

  const cfg = getMoodleConfig();
  if (!cfg.moodleUrl || !cfg.moodleToken) {
    console.error('❌ Error: Moodle URL or token not configured.');
    console.error('Please configure Moodle via SMS Portal (Results → Moodle Sync) first.');
    process.exit(1);
  }

  if (!cfg.courseMap || cfg.courseMap.length === 0) {
    console.error('❌ Error: No course mappings found in config.');
    console.error('Map at least one Moodle course to an SMS subject first.');
    process.exit(1);
  }

  const logLines = [];
  const onLog = (entry) => {
    const time = new Date().toLocaleTimeString();
    logLines.push({ time: new Date().toISOString(), ...entry });
    console.log(`[${time}] [${entry.type.toUpperCase()}] ${entry.message}`);
  };

  const startedAt = new Date().toISOString();
  let status = 'success';
  let result;

  try {
    result = await runSync(cfg, session, term, onLog);
    console.log('\n====================================================');
    console.log(`🎉 Sync Completed Successfully!`);
    console.log(`   Total Scores Processed: ${result.total}`);
    console.log(`   Results Saved to DB:    ${result.saved}`);
    console.log(`   Skipped:                ${result.skipped}`);
    console.log(`   Errors:                 ${result.errors.length}`);
    console.log('====================================================\n');
  } catch (err) {
    status = 'error';
    onLog({ type: 'error', message: err.message });
    result = { total: 0, saved: 0, skipped: 0, errors: [err.message] };
    console.error('\n❌ Sync Failed:', err.message);
  }

  saveLog({
    startedAt,
    completedAt: new Date().toISOString(),
    session,
    term,
    status,
    triggeredBy: 'CLI / Scheduled Task',
    ...result,
    log: logLines,
  });

  process.exit(status === 'success' ? 0 : 1);
}

main();
