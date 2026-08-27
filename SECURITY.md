# Wrexlyn for Investments — Security Policy

## Supported versions

Security fixes are provided for the latest released version only unless a signed commercial
agreement states otherwise. Users should update promptly and verify release provenance.

## Reporting a vulnerability

Do not disclose a suspected vulnerability, exploit, credential, or Deal Data in a public issue.
Send a private report to Nishant Prabhakar using the private contact channel listed on the
official repository for this Software.

Include the affected version, environment, reproduction steps, impact, and any suggested
mitigation. Do not access data that is not yours, disrupt service, persist access, extort, or
publicly disclose details before a remediation window has been agreed. Receipt and remediation
times are not guaranteed unless a separate written agreement provides an SLA.

## Security model

- The web UI binds to loopback (`127.0.0.1`) by default and is not reachable from your network
  unless you deliberately set the `HOST` environment variable to a different address — there is
  no login/authentication layer in front of it, so treat any non-default `HOST` as exposing
  everything in `data/` (deal, portfolio, and cap-table records) to whoever can reach that
  interface.
- The Software has no Developer-operated server component; it is not a "hosted mode" that a
  future version might add without updating this document first.
- The Software modifies local files (`data/*.json`, generated `.docx`/`.xlsx` artifacts) at your
  direction. It does not execute arbitrary shell commands or modify files outside its own
  workspace directory.
- Provider API keys use OS-backed secure storage where available, with a local file fallback on
  unsupported systems (see [PRIVACY_POLICY.md](PRIVACY_POLICY.md)).
- Prompts and document content you submit through screening/evaluation/documentation-review are
  sent to the LLM provider you configure. Their security and data practices are outside this
  Software's control.
- Uploaded files (decks, financial models, other documents) are parsed by the underlying Wrexlyn
  core ingestion pipeline; treat any file from an untrusted source with the same caution you would
  apply to opening it in Office/Acrobat directly.

## Deployment guidance

Use least-privilege OS accounts and provider keys, keep the host and dependencies updated,
maintain independent backups of `data/` (it is not synced anywhere by the Software itself), review
generated financial figures before relying on them, restrict network exposure (leave `HOST` at its
loopback default unless you have a specific, deliberate reason and additional access controls in
place), and avoid processing regulated or highly sensitive Deal Data without an independent risk
assessment appropriate to your fund's obligations. Automated tests are not a penetration test or
security certification.

## Disclosure

Nishant Prabhakar may credit reporters who request recognition, but cannot promise a bounty. This
policy does not authorize activity prohibited by law or third-party terms.
