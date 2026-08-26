# Phase 4, deferred — not deployed

`submit.php` (public anonymous upload into a quarantine folder) and the
original `moderate.php` (queue-based approve/reject) were archived here,
2026-08-26, when the backend was rebuilt as `api/publish.php` — a single
authenticated admin-publishes-directly flow, per `BACKEND-PLAN-v3.md`.

Why archived rather than deleted: an unauthenticated, file-writing PHP
endpoint sitting on the server — even one nothing links to — is still a
live, URL-reachable attack surface. "Not deployed" has to mean not present
in `api/`, not just "not linked from any page." Keeping the source here
means Phase 4 doesn't start from scratch: when public submissions actually
launch, this is the reference for the quarantine/queue/duplicate-detection/
rate-limiting design that `BACKEND-PLAN-v2.md` already worked out in full,
across two review rounds — re-deploy it deliberately at that point, don't
resurrect it by accident.
