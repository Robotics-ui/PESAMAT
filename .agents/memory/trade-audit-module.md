---
name: Trade Audit Journal
description: Schema and API for the trade_audit_logs table; how to populate it from webhooks.
---

# Trade Audit Journal

## Schema
`lib/db/src/schema/tradeAuditLogs.ts` → table `trade_audit_logs`

Key columns: `trading_master_id`, `distribution_master_id`, `subscriber_id`, `broker`, `account_type`, `trade_action` (OPEN/CLOSE/MODIFY), `symbol`, `entry_price`, `stop_loss`, `take_profit`, `execution_time`, `replication_latency_ms`, `status` (SUCCESS/FAILED/PARTIAL), `failure_reason`, `ticket`.

## API
- `GET /api/admin/trade-audit` — paginated list with query params: `page`, `limit`, `dateFrom`, `dateTo`, `subscriberId`, `distributionMasterId`, `tradingMasterId`, `broker`, `symbol`, `status`, `tradeAction`
- `POST /api/admin/trade-audit` — insert a single log entry (admin-only)

## Integration point
The table is populated manually or by the CopyFactory webhook handler. The webhook handler in `artifacts/api-server/src/routes/webhooks.ts` needs to call `db.insert(tradeAuditLogsTable)` whenever a trade replication event arrives. This wiring is NOT yet done — it is a follow-up task.

## Admin UI
`/admin/trade-audit` → `artifacts/pesamatrix/src/pages/admin/trade-audit.tsx`
Filter-first UI: user must search before results appear.
