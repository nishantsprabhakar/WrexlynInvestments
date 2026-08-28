# Wrexlyn for Investments — Privacy Policy

**Effective date: 2026-08-27**

This policy explains how Nishant Prabhakar ("Wrexlyn for Investments," "we," "us") handles data
when you install and run this software. It should be read with the
[Terms of Service](TERMS_OF_SERVICE.md).

## 1. Scope and roles

This is a locally-installed application. By default it has **no Developer-operated server or
database** — it does not phone home, register your installation, or transmit your deals,
portfolio records, or other Deal Data to Nishant Prabhakar in any form. The one exception is
license registration/activation (Section 3a below), which only runs at all if the installation has
been explicitly configured with a license-server address (`WREXLYN_INVESTMENTS_LICENSE_SERVER_URL`)
— on an unconfigured install, none of that applies either, and this section's "no server" statement
is fully accurate. When you configure a third-party LLM provider (for example Kilo, Groq,
OpenRouter, Google Gemini, Cerebras, or Mistral), that party processes data under its own terms and
privacy policy, which you should review separately. If you deploy the Software for an organization
or fund, that organization may separately act as controller of its own users' and portfolio
companies' data.

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

## 3. License registration and activation (only if configured)

If — and only if — this installation has been configured with a license-server address (an
operator/administrator setting, not something you can trigger from the app's own UI), the Software
registers itself once and periodically checks in:

- **What's collected**: your name and email address (typed in once, at a terminal prompt, on
  first run), plus a randomly generated device identifier and the accepted Terms version/timestamp.
  These are sent to, and stored by, the configured license-server — a small service the Developer
  or your organization's administrator operates (see `license-server/` in the source repository),
  separate from this app's own data storage.
- **What's NOT collected this way**: your deals, portfolio records, screening/evaluation output,
  uploaded documents, or any other Deal Data — the license-server only ever sees the registration
  fields above and periodic check-in timestamps, never anything from `data/`.
- **Purpose**: to activate and periodically verify that this installation is authorized to run, and
  to let an administrator see/revoke registered installs from that service's admin dashboard. This
  is the actual technical mechanism enforcing the commercial license described in
  [`LICENSE`](LICENSE) — revoking an installation there blocks the app on its next check-in.
- **Where it's stored locally**: the device id, registration status, and a bearer token authorizing
  future check-ins are cached in a local file (`~/.wrexlyn-investments/device.json`) on the machine
  running the Software.
- To request deletion of registration data held by a license-server, contact whoever operates it
  (the Developer, or your organization's administrator if they deployed their own instance).

## 4. Third-party LLM providers

Running screening, evaluation, or documentation-review sends the relevant prompt and document
content to the LLM provider you have configured (or the built-in free default, if you have not
configured one) in order to generate the requested output. **The Developer does not operate,
control, or receive a copy of these requests** — they go directly from the machine running the
Software to that provider over that provider's own API. That provider's retention, training-data
use, security, and international-transfer practices are governed by its own terms, not by the
Developer.

## 5. Purposes

Data is processed locally to run the app's screening, evaluation, documentation-review, pipeline,
portfolio-monitoring, and related features, and is sent to a configured third-party LLM provider
only as needed to generate the specific output you requested. If license registration is
configured (Section 3), the collected fields are used solely to activate and verify this
installation. The Developer does not sell data, does not receive your Deal Data, and does not use
it to train any model.

## 6. Sharing

Aside from a configured third-party LLM provider (Section 4) and, if configured, the license-server
(Section 3), the Software does not share your data with anyone. It has no analytics, telemetry, or
crash-reporting connection beyond what Section 3 describes; if that scope ever changes in a future
version, this policy will be updated first and the "Last updated" date above will reflect it.

## 7. Retention

Local Deal Data, settings, and audit-trail records remain on your machine until you delete them,
uninstall the Software, or remove the relevant files/directories yourself — there is no
Developer-side copy to separately delete. Deleting the installation directory (or, for an
uninstall via the packaged installers, following the uninstaller/`install.sh` instructions in
[README.md](README.md)) removes them. If license registration is configured, registration data held
by that license-server is retained until deletion is requested from whoever operates it (Section 3).

## 8. Security

See [SECURITY.md](SECURITY.md) for the Software's security model. No system is completely secure.
You are responsible for the security of the device the Software runs on, its operating-system
credential store, your backups, and any account credentials you provide to the Software or to a
third-party provider through it.

## 9. Your choices and rights

Because all Deal Data lives locally under your control, access, correction, deletion, and
portability are entirely in your hands — inspect or edit the JSON files under `data/` directly,
or use the Software's own UI. There is no Developer-held copy of Deal Data for the Developer to act
on. For registration data held by a configured license-server, see Section 3. If you have a privacy
question about the Software's design itself, you may contact Nishant Prabhakar through the official
repository contact channel.

## 10. International processing

If you configure a third-party LLM provider located outside your jurisdiction, that provider may
process the content you send it outside your location. Applicable transfer safeguards depend on
the provider and jurisdiction — review your configured provider's own policy before sending it
personal or confidential Deal Data.

## 11. Children

The Software is not directed to children and is not intended for anyone below the age at which
they may independently consent to data processing or enter the Terms of Service.

## 12. Changes and contact

Material changes will be reflected by a revised effective date above. Privacy questions may be
sent privately to Nishant Prabhakar through the official repository contact channel. Never post
personal data, credentials, or confidential Deal Data in a public issue.
