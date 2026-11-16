# Timetable import incident, 15 November 2026

Times below are Moscow time (UTC+3).

## Evidence

- Last inspected clean automatic snapshot: `b9e2071`, 15 November 01:56.
- First inspected contaminated snapshot: `1807ed2`, 15 November 05:33. The automatic schedule-import commit contained fabricated academic labels for five groups; group 25290909/3091 was unaffected.
- `174267f`, 15 November 12:52, still contained contaminated group feeds. By `3c129b5`, 15 November 19:42, four feeds had clean source data again. The feed for 25290907/3111 retained the earlier fabricated snapshot because its later source responses were empty.
- On 16 November the shared subject/teacher catalogs in groups 24290907/2092 and 25290907/1091 still contained imported fabricated entries. This can occur when an authorized administrator's browser publishes its automatically populated catalog. The available HTTP logs do not contain request bodies and are insufficient to attribute the original source modification to a person.
- The import commits changed schedule data, rather than application permissions. The identity or method of whoever modified the upstream timetable is not established by this investigation.

## Remediation

- Archived the inspected database catalogs and relevant Sunday HTTP metadata privately before repair.
- Restored the unavailable 25290907/3111 feed to the last known legitimate awaiting-source state, rather than presenting fabricated lessons.
- Rebuilt faculty assignments from trusted feeds.
- Added a versioned quarantine of entity identifiers observed in the contaminated snapshots, plus suspicious-text and mass subject replacement checks. Incoming invalid snapshots do not replace a trusted snapshot. Corrupted historical days cannot be carried forward.
- Removed quarantined subject/teacher entries from affected shared catalogs, preserving homework, notes, flashcards and attendance. Referenced material is retained under a review label instead of silently deleted.
- Invalidated the previous browser timetable cache and cleaned academic catalogs before publishing browser state.
- Added server-side academic text/entity checks and an internal change log with actor, session, tenant and before/after academic projections. Ordinary students cannot publish shared academic data.
- Restricted the legacy additional-password setter to the sole super-administrator. The previous setter lacked actor authorization; no link between this separate defect and timetable poisoning has been established.
- Disabled the obsolete administrator bootstrap RPC and pinned the Supabase browser SDK to an exact release with subresource integrity verification.

## Limits

Quarantine and anomaly checks reduce the risk of publishing untrusted timetable content. They are not proof that future upstream data is correct. Academic permissions continue to be enforced on the server; the browser's publishable Supabase key is intentionally public and is not an administrative secret.
