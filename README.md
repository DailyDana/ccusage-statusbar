# ccusage Status Bar

Shows your Claude Code usage in the VS Code status bar, so you can keep an eye on it while using the Claude Code panel (where the CLI status line is not shown).

```
🔥 $3.29 block · 4h 21m | today $125.27
```

- **Status bar:** cost of the active 5-hour block, time left in it, and today's total.
- **Tooltip:** burn rate, projected block cost, per-model breakdown for today, this month's total and daily average.
- **Click** to refresh immediately. Otherwise it refreshes every 5 minutes.

It uses no tokens and sends nothing anywhere: [ccusage](https://github.com/ryoppippi/ccusage) only reads the local Claude Code logs on your machine. Amounts are API-equivalent costs, not your subscription bill.

## Requirements

[ccusage](https://github.com/ryoppippi/ccusage) installed globally:

```sh
npm install -g ccusage
```

## Install

Download the `.vsix` file from the [latest release](../../releases/latest), then:

```sh
code --install-extension ccusage-statusbar-0.3.0.vsix
```

or in VS Code: Extensions view → `...` menu → **Install from VSIX...**

## Settings

| Setting | Default | Description |
|---|---|---|
| `ccusageBar.command` | `ccusage` | ccusage command; use the full path if it is not on PATH. |
| `ccusageBar.intervalMinutes` | `5` | Refresh interval in minutes. |
| `ccusageBar.timezone` | *(empty)* | IANA timezone for day/month grouping, e.g. `Europe/Istanbul`. Empty uses system time. |
| `ccusageBar.showMonthInBar` | `false` | Also show this month's total in the status bar. |

## Notes

- Each refresh tries ccusage's online price list first and falls back to `--offline` when there is no internet. The bundled list can lag behind new models; those show as `⚠ no pricing` in the tooltip.
- Building from source: `npx @vscode/vsce package`

## License

MIT
