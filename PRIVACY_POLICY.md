# Wrexlyn for Investments — Privacy Policy

**Effective date: 2026-08-27**

This policy explains how Nishant Prabhakar ("Wrexlyn for Investments," "we," "us") handles data
when you install and run this software. It should be read with the
[Terms of Service](TERMS_OF_SERVICE.md).

## 1. Scope and roles

This is a locally-installed application with **no Developer-operated server or database** — it
does not phone home, register your installation, or transmit your deals, portfolio records, or
other Deal Data to Nishant Prabhakar in any form. When you configure a third-party LLM provider
(for example Kilo, Groq, OpenRouter, Google Gemini, Cerebras, or Mistral), that party processes
data under its own terms and privacy policy, which you should review separately. If you deploy the
Software for an organization or fund, that organization may separately act as controller of its
own users' and portfolio companies' data.

## 2. Data the Software processes, and where it lives

- **Deal and portfolio data**: company names, sectors, screening ratings, evaluation notes,
  financial figures, cap tables, valuations, diligence records, IC decisions, contacts, and
  similar Deal Data you create or upload — stored as local JSON files under this application's
  own `data/` directory on the machine where it runs. This data is never uploaded to any
  Developer-operated service.
- **Uploaded documents**: decks, financial models, and other files you attach to a screening,
  evaluation, or documentation-review run are processed locally and, as part of running that
  flow, their extracted text/content is sent to whichever LLM provider you have configured (see
  Section 3) so it can generate the requested analysis.
- **Settings and API keys**: which LLM provider/model is active is stored locally in a settings
  file. API keys are stored via your operating system's native secure credential store where
  available (the same store used by, and shared with, the companion Wrexlyn coding-agent
  application if installed), falling back to a local file only on systems without one.
- **Audit trail**: a local, append-only log of flow runs (which deal, which flow, a short summary
  of the result) is kept under `data/` to support the app's own evidence/audit-trail feature —
  this stays local as well.

Do not process Deal Data through the Software, or through any third-party provider it connects
to, that you are not authorized to share under your confidentiality obligations, NDAs, or fund
governing documents.

## 3. Third-party LLM providers

Running screening, evaluation, or documentation-review sends the relevant prompt and document
content to the LLM provider you have configured (or the built-in free default, if you have not
configured one) in order to generate the requested output. **The Developer does not operate,
control, or receive a copy of these requests** — they go directly from the machine running the
Software to that provider over that provider's own API. That provider's retention, training-data
use, security, and international-transfer practices are governed by its own terms, not by the
Developer.

## 4. Purposes

Data is processed locally to run the app's screening, evaluation, documentation-review, pipeline,
portfolio-monitoring, and related features, and is sent to a configured third-party LLM provider
only as needed to generate the specific output you requested. The Developer does not sell data,
does not receive your Deal Data, and does not use it to train any model.

## 5. Sharing

Aside from the third-party LLM provider you configure (Section 3), the Software does not share
your data with anyone. It has no analytics, telemetry, or crash-reporting connection to a
Developer-operated service as of this policy's effective date; if that ever changes in a future
version, this policy will be updated first and the "Last updated" date above will reflect it.

## 6. Retention

Local Deal Data, settings, and audit-trail records remain on your machine until you delete them,
uninstall the Software, or remove the relevant files/directories yourself — there is no
Developer-side copy to separately delete. Deleting the installation directory (or, for an
uninstall via the packaged installers, following the uninstaller/`install.sh` instructions in
[README.md](README.md)) removes them.

## 7. Security

See [SECURITY.md](SECURITY.md) for the Software's security model. No system is completely secure.
You are responsible for the security of the device the Software runs on, its operating-system
credential store, your backups, and any account credentials you provide to the Software or to a
third-party provider through it.

## 8. Your choices and rights

Because all Deal Data lives locally under your control, access, correction, deletion, and
portability are entirely in your hands — inspect or edit the JSON files under `data/` directly,
or use the Software's own UI. There is no Developer-held copy for the Developer to act on. If you
have a privacy question about the Software's design itself (not about data you generated), you may
contact Nishant Prabhakar through the official repository contact channel.

## 9. International processing

If you configure a third-party LLM provider located outside your jurisdiction, that provider may
process the content you send it outside your location. Applicable transfer safeguards depend on
the provider and jurisdiction — review your configured provider's own policy before sending it
personal or confidential Deal Data.

## 10. Children

The Software is not directed to children and is not intended for anyone below the age at which
they may independently consent to data processing or enter the Terms of Service.

## 11. Changes and contact

Material changes will be reflected by a revised effective date above. Privacy questions may be
sent privately to Nishant Prabhakar through the official repository contact channel. Never post
personal data, credentials, or confidential Deal Data in a public issue.
