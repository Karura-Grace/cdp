# Culture Dynamics Profile: Measure step B (pulses) and full loop test results

**Date:** 14 October 2026
**Scope:** Measure stage step B (watch list pulses) as built, and the full start to finish test run of the platform
**Status:** Built, deployed and tested. Steps C and D of the Measure stage are not started.
**Live site:** https://culture.pac.africa
**Code:** https://github.com/PAC-Africa/cdp-platform (private), commit 305d90e and the test fix commit that follows it

---

## Summary

Step B of the Measure stage is built. A PAC consultant can now set up a short pulse on the watch list of one priority, open it to the whole active roster, close it, and read indicative results beside the baseline. A movement past the trigger line raises a reassessment trigger for the consultant to decide. Respondents answer anonymously through a single use link, and results appear only when five or more people answered.

The full loop test ran against the live Supabase project and the local production build. Fourteen of fifteen test scripts passed. The fifteenth, the release gate test on the demo bank, cannot pass on this database because that bank was already released by an earlier run. It needs a fresh seed, and the fresh seed runs of the plan and pulse tests cover the same gate.

> Pulse results are indicative. They never replace a full assessment score, and CDP does not claim that an action caused a movement.

## What step B adds

### For the PAC consultant

- **Create.** Pick a priority from the plan, tick up to ten items from that priority's watch list, and choose the 90 day or 180 day review point. The engine checks the ten item cap and the watch list rule, and the baseline reading on exactly those items is stored with the pulse.
- **Open.** Set a close date (within 60 days). One single use link is issued to every active person on the roster. The consultant can tick a box to email each person their link from hello@pac.africa, and can download the links once as a CSV file. The links are not shown again.
- **Close.** Closing stops all links. A pulse whose window has passed is closed automatically when results are read.
- **Read the results.** The platform reads the answers through the single approved read path, compares them with the baseline on the same items, stores the aggregate once, and raises a movement trigger for each item past the trigger line.

### For the client

The client administrator and executives can read the pulses and their stored results. They cannot create, open or close a pulse, and they cannot see any individual answer.

### For the respondent

The respondent opens the link on a phone or computer. The page shows only what the pulse asks: the named culture scenarios, the four statement short forms for readiness dimensions, and the named Employee Orientation Survey questions. It takes about five to ten minutes. Answers stay on the device until the respondent submits.

## How pulse items work

A pulse item is a reference to a watch list entry of one priority. Three kinds exist.

| Item kind | Example | What the respondent sees | How it is read |
|---|---|---|---|
| Scenario | D2 S2 | The NOW scenario with four statements and 100 points to spread | Mean points given to the priority orientation |
| Readiness short form | D8 | Four fixed statements, rated 1 to 5 | Mean of each respondent's four item average |
| Employee Orientation Survey | eOS Q1 | One question, rated 0 to 10 | Category score of that question |

Triggers use the thresholds already in the engine configuration: a movement of 0.5 on a readiness short form, 15 points on an Employee Orientation Survey question, or 8.0 points on a scenario allocation.

## Privacy design

Pulses follow the same design as the main survey.

- Only the hash of each link token is stored. The link itself is never stored.
- The link between a person and their answers is destroyed in the same database transaction that stores the answers.
- Stored answers carry no person, no demographic data, no invitation reference and no free text.
- No client role and no service role can read the pulse answer tables.
- The only read path is a database function owned by a restricted role. It refuses until the pulse is closed, and it refuses when fewer than five people answered.
- Below five answers the platform stores only the counts and shows nothing.
- Results are stored once and cannot be changed or deleted. What a pulse asks cannot change after it is created, and a pulse can only move forward from draft to open to closed.
- Every create, open, close and result step writes an audit row.

## What changed in the code

- **Database migration 20.** New tables `pulse`, `pulse_result`, `capture.pulse_invitation` and `capture.pulse_response`, with security policies and service role functions. It is applied to the live project.
- **Engine.** A new `pulse.ts` module provides answer validation, the baseline reading from the frozen response set, and the pulse reading. It has four new tests, and the engine suite now stands at 255 passing tests.
- **Application.** New routes for creating, opening, closing and reading pulses, a respondent route for answers, a respondent page at `/respond/pulse`, and a Pulses section on the Measure page.
- **Documents.** `docs/SCHEMA_PLAN_MEASURE.md` records step B as built.

## Full loop test results

Each script ran against the live Supabase project through the local production build. Most scripts seed a fresh demo client first.

| Stage | Script | Passed | Failed |
|---|---|---|---|
| Organisation graph and roster | org | 276 | 0 |
| Organisation list | orgs | 44 | 0 |
| Setup, consent, transfer basis, launch | setup | 85 | 0 |
| Preflight and launch | launch | 31 | 0 |
| Fielding, submit, freeze, score, findings, report, release | live | 39 | 0 |
| Leadership 360 | 360 | 42 | 0 |
| Segments and suppression | segments | 10 | 0 |
| PDF and PPTX export | export | 14 | 0 |
| Action plan | plan | 58 | 0 |
| People Leader team view | team | 26 | 0 |
| Users and roles | users | 49 | 0 |
| Measure: trend, triggers, organisational changes | measure | 28 | 0 |
| Measure: pulses | pulse | 49 | 0 |
| Site and staff pages | ui | 28 | 0 |
| Release gate on the demo bank | release | 40 | 16 |

### Failures and what was done

- **setup.** One check failed in the first run and again on a rerun. The consultant dashboard now lists about 140 engagements, so the text "Review setup and launch" appeared for other organisations. The check was limited to its own engagement and it now passes, 85 of 85.
- **measure.** It failed once because earlier runs had decided every open trigger. It now raises its own trigger first and passes, 28 of 28.
- **release.** Sixteen checks fail. The script is written to run once per seed, and the demo bank was already released by an earlier run. It cannot pass until the bank is reseeded. The bank was not reseeded because it is demonstration data. The release gate itself is also exercised by the plan and pulse tests, which seed a fresh client, and both passed.
- The setup and measure fixes are test changes only. No product code changed.

## Actual output from the live run

### Culture score, one demo client

The client is Live Demo Co (run of 13 October 2026), six responses. The stored score hash is `sha256:9d868b8b1b4b37343…`, and it equals an engine run on the same responses.

| Orientation | NOW | PREFERRED | GAP | Class |
|---|---|---|---|---|
| ENGAGE | 30.00 | 31.00 | +1.00 | Keep and protect |
| INNOVATE | 16.00 | 25.00 | +9.00 | Build |
| PERFORM | 32.00 | 28.00 | −4.00 | Moderate |
| GOVERN | 22.00 | 16.00 | −6.00 | Moderate |

Readiness: the Transformation Probability Score is 3.41, band Enablement required, marked provisional. The Employee Orientation Survey index is 16.8.

### Reports and exports

The report was drafted, the sections were accepted and it was released. The client administrator could not see it before release and could read it afterwards. The PDF export is 89,834 bytes and the PowerPoint export is 597,812 bytes with a native chart. The chart figures, today 22/14/34/30 and preferred 31/25/28/16, come from the fixture export and not from Live Demo Co.

### Pulses

The two test pulses used synthetic answers. The test submits all high answers to force a movement, so these values show the mechanics and not a real organisation.

| Pulse | Answered | Shown | Label |
|---|---|---|---|
| 90 day | 4 of 45 | No, suppressed, counts only | Not applicable |
| 180 day | 6 of 45 | Yes | INDICATIVE |

| Item (180 day pulse) | Baseline | Pulse | Crossed trigger line |
|---|---|---|---|
| D8 readiness short form | 3.2 | 5.0 | Yes |
| eOS Q1 | 29 | 100 | Yes |
| D2 S2 scenario | 23.7 | 0.0 | Yes |

Three movement triggers were raised and wait for the consultant to accept or dismiss them.

### Trend comparison, Ostravane demonstration

The second cycle of the Ostravane demo is made up and labelled illustrative.

| Orientation | Change in NOW | Gap before | Gap after |
|---|---|---|---|
| ENGAGE | +4.95 | 12.02 | 6.99 |
| INNOVATE | +4.86 | 7.49 | 2.52 |
| PERFORM | −4.06 | −10.30 | −6.44 |
| GOVERN | −5.75 | −9.20 | −3.06 |

The Transformation Probability Score moved from 3.31 to 3.77, a change of +0.46.

## Known limits and decisions needed

- **Python mirror.** The new pulse engine code has TypeScript tests but no Python mirror, because Python is not installed on the build machine. The oracle check could flag this when CI next runs somewhere with Python. The mirror belongs in `oracle/cdp_oracle/reassess.py`, followed by `npm run oracle:generate`.
- **Test data.** The pulse test, like the plan test, leaves "Pulse test" clients in the live database. They can be removed in a clean up pass that needs approval.
- **Not built in step B.** Automatic scheduling of pulses at 90 and 180 days (the consultant creates them), reminder emails, and an audience narrower than the whole active roster.
- **Release test.** Decide whether to reseed the demo bank so the release script can pass, or retire the script in favour of the fresh seed tests.

## What is left in the Measure stage

| Step | What it adds | Needs |
|---|---|---|
| C | Adjust or retire decisions at the 90 and 180 day reviews, using the engine's adjust or retire rules on existing KPI readings | Its own approval |
| D | Cycle rollover: creates the next engagement with a carry forward preview | Its own approval |

Other open items, unchanged: reminder and password reset emails, the retention job (waits on four answers from PAC), multi factor sign in, the separate scoring login, key rotation, and legal review of the consent wording.
