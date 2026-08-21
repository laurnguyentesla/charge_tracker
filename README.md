# Charge tracker boards

Public GitHub Pages boards for Microsoft Forms completion tracking.

Live site: <https://laurnguyentesla.github.io/charge_tracker/>

- [Employee Spotlight](https://laurnguyentesla.github.io/charge_tracker/)
- [Grow with Guild](https://laurnguyentesla.github.io/charge_tracker/guild.html)

Published data includes **names, completion times, and (for Guild) program / participation status**. Emails, written answers, course links, and file uploads are stripped before the page is built.

Each board has **All** (every respondent) and **Current month** (this calendar month only; resets on the 1st).

## Refresh the boards

1. Export each form (**Responses → Open in Excel**) as CSV into Downloads.
2. Regenerate sanitized JSON:

```bash
python scripts/prepare_data.py
```

3. Commit and push `data/charges.json` and `data/guild.json`.

Anyone in an export is marked **Completed** for submitting the form. Duplicate names keep the latest completion time.
