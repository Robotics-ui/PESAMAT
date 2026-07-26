---
name: Imported project setup
description: Development setup requirement for imported PesaMatrix workspaces.
---

An imported workspace may have a valid schema and workflow but an empty development database; initialize the development schema with the repository's existing Drizzle push command before judging API startup failures.

**Why:** The API seed runs during startup and exits when expected tables do not yet exist, even though the application code and database connection are otherwise healthy.

**How to apply:** When setting up a fresh import, install from the lockfile, apply the existing development schema, restart the workflow, and verify both the frontend and API health endpoint.