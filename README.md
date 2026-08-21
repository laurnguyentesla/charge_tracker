# Charge tracker boards

Public GitHub Pages boards for Microsoft Forms completion tracking.

Live site: <https://laurnguyentesla.github.io/charge_tracker/>

- [Overview](https://laurnguyentesla.github.io/charge_tracker/overview.html)
- [Grow with Guild](https://laurnguyentesla.github.io/charge_tracker/guild.html)
- [Employee Spotlight](https://laurnguyentesla.github.io/charge_tracker/)
- [Pathways to Success](https://laurnguyentesla.github.io/charge_tracker/pathways.html)

Published data includes **names, completion times, and (for Guild) program / participation status**. Emails, written answers, course links, and file uploads are stripped before the page is built.

Each board has **All** (every respondent) and **Current month** (this calendar month only; resets on the 1st).

## Refresh the boards

1. Export each form (**Responses → Open in Excel**) into Downloads.
2. Regenerate sanitized JSON:

```bash
python scripts/prepare_data.py
```

3. Commit and push `data/charges.json`, `data/guild.json`, and `data/pathways.json`.

Anyone in an export is marked **Completed** for submitting the form. Duplicate names keep the latest completion time.
