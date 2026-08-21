# Employee Spotlight completion board

Public GitHub Pages board of who has completed the Employee Spotlight newsletter questionnaire.

Live site: <https://laurnguyentesla.github.io/charge_tracker/>

The published dataset includes **names, completed status, and completion times only**. Emails and written answers are stripped before the page is built.

## Refresh the board

1. In Microsoft Forms, open **Employee Spotlight Questionnaire - NEWSLETTER**.
2. Go to **Responses → Open in Excel**.
3. Save the `.xlsx` into Downloads (or `source/` in this repo).
4. Regenerate the sanitized JSON:

```bash
python scripts/prepare_data.py
```

5. Commit and push `data/charges.json` so GitHub Pages updates.

Anyone in the export is marked **Completed**. Duplicate names keep the latest completion time.

## New-response alerts (Power Automate)

GitHub Pages cannot watch Forms live. For an email or Teams ping when someone submits:

1. Open [Power Automate](https://make.powerautomate.com) → **Create** → **Automated cloud flow**.
2. Trigger: **Microsoft Forms — When a new response is submitted**.
3. Form Id (paste as a custom value if the form does not appear):

   `9MUmkNCGn0u9ObfU0PtGdEyB_njfkBxJjiwSpqLrARVUME5NRVRYNVNOR0hNM1dBUFhTQVVMMDZETy4u`
4. Action: **Get response details** (same Form Id, Response Id from the trigger).
5. Action: **Send an email (V2)** or **Post message in a chat or channel**, including the respondent name.

The public board still updates only after you re-export Excel and rerun the script.
