# Senior design review resolution

The verified design-boundary findings from `AUDIT.md` have now received an
explicit product decision and an end-to-end implementation. This file no longer
contains an unresolved release blocker.

## P1-02 / P1-03: scoped credentials and transport policy

The Hub contract is API version 2. It defines independent admin, read-only
viewer, and device-bound credentials. A device token can read shared stats and
ingest only its configured `deviceId`; the payload no longer chooses its own
identity. Administrative mutations require admin scope. The old
`TOKEN_MONITOR_SECRET` is read-only by default, with explicit temporary flags
for a migration that still needs legacy ingest/admin behavior.

Only viewer credentials are accepted through `?secret=`. Admin and device
credentials in a URL are rejected. Node Hub, the agent, and desktop clients
reject non-loopback HTTP by default; a trusted-LAN/VPN deployment needs an
explicit insecure-HTTP opt-in. Android release builds disable cleartext traffic.
Authentication failures and ingest bursts are rate-limited, and successful
administrative changes emit structured audit records without secret material.

The embedded desktop Hub creates a private admin token, a read-only viewer
token, and individually provisioned device tokens in the unified credential
store. Raw admin/device credentials cross into the renderer only after a direct
user action to create or copy one.

## P1-05: version-split product chains

- Reasonix native session/project details are restored to the local Electron
  display without putting native paths or local-only details on the Hub wire.
- The macOS Widget has a current App Group snapshot producer, demand lease,
  atomic snapshot persistence, reload throttling, deep-link handling, tests,
  and a fail-closed signed release path.
- The orphaned diagnostic report/journal and the unconsumed `clientHealth` wire
  document were removed end to end because no current Electron, Hub web,
  Android, or Widget consumer remained. The compact `clientStatus` product
  signal and local path-free self-sync failure classification remain.

## P1-07: measurement identity

Node/MySQL deletion is now a soft removal: the current record disappears from
stats but its baseline and immutable ledger identity remain. Re-ingesting the
same ID therefore produces only a real delta. Device rename is an atomic admin
operation that moves the record, baseline, usage events, and session rollups;
the Worker exposes the same rename contract for its current-record store.
Conflicting target identities return `409` instead of being merged.
The embedded Electron Host also migrates its device-bound credential before
re-listening and refreshes the live authorization policy after the identity
move, so the old ID cannot be recreated with a stale token. Standalone Node and
Worker deployments cannot mutate environment/secret configuration through a
database operation; their dashboard and API documentation therefore require a
new-ID credential to be provisioned and the client updated before the old
binding is removed.

## P1-08: Node/Worker feature contract

`/api/health`, `/api/capabilities`, and authenticated stats publish a versioned
capability map. Node advertises custom range and pricing; Worker explicitly
advertises both as unsupported. Web, Electron, and Android gate those features
from the returned contract. Android connection testing verifies both a protected
stats request and the authenticated capability/role response.

## P2-03: qodercn Discord asset boundary

The existing Discord fallback remains the chosen behavior. No asset was
invented for `qodercn`; the renderer registry can display it while Discord RPC
uses its generic fallback until a real branded asset is supplied.

## Environment-dependent acceptance

The following are not source-design blockers, but cannot be claimed from this
Linux review environment:

- macOS Widget signing, installation, timeline refresh, and deep-link acceptance;
- native Windows/macOS updater hand-off acceptance;
- a real Android device/network acceptance pass;
- MySQL migration/restart integration and production acceptance; Docker is not
  installed in this review environment, so no disposable MySQL run was made.

These boundaries must remain reported as `NOT RUN` rather than inferred from
unit tests or build success.
