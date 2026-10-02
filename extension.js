// ccusage Status Bar: periodically runs `ccusage` and shows the active 5-hour
// block and today's Claude Code cost in the VS Code status bar.
// Uses no tokens; ccusage only reads the local logs under ~/.claude/projects.
const vscode = require('vscode');
const { exec } = require('child_process');

let item;
let timer;
let running = false;

function cfg() {
  return vscode.workspace.getConfiguration('ccusageBar');
}

// Only allow characters that appear in IANA zone names, since the value goes into a shell command.
function timezone() {
  const tz = (cfg().get('timezone') || '').trim();
  return /^[A-Za-z0-9_/+-]+$/.test(tz) ? tz : '';
}

// Tries the online price list first; falls back to the bundled one (--offline) without internet.
function runJson(args) {
  const tz = timezone();
  const base = `"${cfg().get('command')}" ${args} --json${tz ? ` --timezone ${tz}` : ''}`;
  const once = (cmd) =>
    new Promise((resolve, reject) => {
      exec(cmd, { windowsHide: true, timeout: 60000, maxBuffer: 32 * 1024 * 1024 }, (err, stdout) => {
        if (err) return reject(err);
        try { resolve(JSON.parse(stdout)); } catch (e) { reject(e); }
      });
    });
  return once(base).catch(() => once(`${base} --offline`));
}

// Today's year/month/day in the configured timezone (system time when unset)
function todayParts() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone() || undefined, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date());
  const get = (t) => parts.find((x) => x.type === t).value;
  return { y: get('year'), m: get('month'), d: get('day') };
}

const usd = (n) => `$${(n || 0).toFixed(2)}`;

function fmtMinutes(m) {
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
}

async function refresh() {
  if (running) return;
  running = true;
  item.text = item.text.startsWith('$(sync~spin)') ? item.text : `$(sync~spin) ${item.text}`;
  try {
    const { y, m, d } = todayParts();
    const [blocks, daily, monthly] = await Promise.all([
      runJson('blocks --active'),
      runJson(`daily --since ${y}${m}${d}`),
      runJson(`monthly --since ${y}${m}01`),
    ]);
    const block = (blocks.blocks || []).find((b) => b.isActive && !b.isGap);
    const day = (daily.daily || []).find((x) => x.period === `${y}-${m}-${d}`);
    const month = (monthly.monthly || []).find((x) => x.period === `${y}-${m}`);
    const dayCost = day ? day.totalCost : 0;
    const monthCost = month ? month.totalCost : 0;
    const monthText = cfg().get('showMonthInBar') ? ` | month ${usd(monthCost)}` : '';

    const md = new vscode.MarkdownString();
    md.supportThemeIcons = true;

    if (block) {
      const left = block.projection ? block.projection.remainingMinutes : 0;
      item.text = `$(flame) ${usd(block.costUSD)} block · ${fmtMinutes(left)} | today ${usd(dayCost)}${monthText}`;
      md.appendMarkdown(`**Active 5-hour block**\n\n`);
      md.appendMarkdown(`- Cost: ${usd(block.costUSD)}\n`);
      md.appendMarkdown(`- Time left: ${fmtMinutes(left)}\n`);
      if (block.burnRate) md.appendMarkdown(`- Burn rate: ${usd(block.burnRate.costPerHour)}/hour\n`);
      if (block.projection) md.appendMarkdown(`- Projected at block end: ${usd(block.projection.totalCost)}\n`);
      md.appendMarkdown(`- Models: ${(block.models || []).join(', ')}\n\n`);
    } else {
      item.text = `$(flame) no block | today ${usd(dayCost)}${monthText}`;
      md.appendMarkdown(`No active block.\n\n`);
    }

    if (day) {
      md.appendMarkdown(`**Today: ${usd(dayCost)}**\n\n`);
      const rows = [...(day.modelBreakdowns || [])].sort((a, b) => b.cost - a.cost);
      for (const r of rows) {
        md.appendMarkdown(`- ${r.modelName}: ${usd(r.cost)}${r.missingPricing ? ' ⚠ no pricing' : ''}\n`);
      }
    }
    if (month) {
      md.appendMarkdown(`\n**This month (${y}-${m}): ${usd(monthCost)}** · daily average ${usd(monthCost / Number(d))}\n`);
    }
    md.appendMarkdown(`\n---\nAmounts are API-equivalent costs, not your subscription bill. Updated ${new Date().toLocaleTimeString()}. Click to refresh.`);
    item.tooltip = md;
  } catch (e) {
    item.text = '$(flame) ccusage error';
    item.tooltip = `Could not run ccusage: ${e.message}\n\nInstall it with: npm install -g ccusage\nOr set the full path in the "ccusageBar.command" setting.`;
  } finally {
    running = false;
  }
}

function schedule() {
  if (timer) clearInterval(timer);
  const minutes = Math.max(1, cfg().get('intervalMinutes'));
  timer = setInterval(refresh, minutes * 60 * 1000);
}

function activate(context) {
  item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  item.text = '$(flame) ccusage…';
  item.command = 'ccusageBar.refresh';
  item.show();

  context.subscriptions.push(
    item,
    vscode.commands.registerCommand('ccusageBar.refresh', refresh),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('ccusageBar')) { schedule(); refresh(); }
    }),
    { dispose: () => timer && clearInterval(timer) }
  );

  refresh();
  schedule();
}

function deactivate() {}

module.exports = { activate, deactivate };
