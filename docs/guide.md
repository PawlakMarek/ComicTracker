# ComicTracker Guide

## Overview
ComicTracker is a story block-first reading tracker for large comic libraries. It organizes reading around arcs/runs/events, tracks sessions and fatigue, and supports multiple reading orders for different timelines or focus reads.

## Entities and Relationships
- **Publisher**: Root of the catalog (Marvel, DC, etc.). Owns series and events.
- **Series**: A volume/title under a publisher. Has `startYear`, optional `endYear`, and one or more publication `era` values.
- **Issue**: Atomic comic issue in a series. `issueNumber` is a string; numeric ordering uses a derived `issueNumberSort`.
- **Story Block**: Core reading unit (ARC/RUN/EVENT/etc.). Requires a publisher and groups issues across one or more series.
- **Event**: Macro publishing event that can be associated with story blocks and issues.
- **Character/Team**: Single table with `type=CHARACTER|TEAM`. Characters can belong to teams.
- **Reading Session**: A reading log entry that can mark issues as finished.
- **Reading Order**: A custom list of story blocks with an `orderIndex` for sequencing.

Relationships at a glance:
- Publisher → Series → Issues
- Story Block → Series + Issues
- Story Block ↔ Characters/Teams (derived from its issues)
- Issues ↔ Characters/Teams + Events
- Reading Sessions ↔ Issues
- Reading Orders ↔ Story Blocks
- Story Blocks can reference a **previous** Story Block (used to infer next).

## Derived Data and Status Rules
Story blocks and reading orders derive their status and metadata from issues:
- **Story Block status**
  - All issues SKIPPED → SKIPPED
  - All issues FINISHED or SKIPPED → FINISHED
  - At least one issue not UNREAD and at least one issue not FINISHED → READING
  - Otherwise → NOT_STARTED
- **Story Block dates** derive from issue release dates (fallback to series start year).
- **Story Block characters/teams** derive from issue credits.
- **Reading Order status** derives from the statuses of its story blocks.

Derived fields are re-synced whenever issues or reading sessions change. If you add or remove issues from a story block, its status and metadata will update automatically.

## Core Workflows
### Build your library
1. Create **Publishers**.
2. Add **Series** (include all publication eras the series spans).
3. Add **Issues** manually, via bulk paste, CSV/JSON import, or ComicVine.

### Create Story Blocks
- Select a **publisher** first; series are filtered to that publisher.
- Add **series** to the block (must share the same publisher).
- Add **issues** by:
  - selecting them directly, or
  - using **issue ranges** (start/end issue numbers per series).
- Optionally set a **previous story block** to define reading continuity.

The block automatically derives its status, dates, and characters/teams from the chosen issues.

### Track Reading Sessions
Reading sessions are the main way to log progress:
- Select issues read in the session.
- The session marks selected issues as `FINISHED` and sets `readDate`.
- Story block and reading order status update automatically.

### Build Reading Orders
Reading orders are sequences of story blocks for a theme or timeline.
- Add story blocks and reorder them (order uses a float `orderIndex`).
- Status is derived from included story blocks.
- Existing reading orders auto-save changes.

## Search, Sort, Pagination
All list pages support pagination and column sorting.
- Character search checks `name`, `realName`, and **exact alias matches**.
- Issue sorting uses numeric issue order so `#10` appears after `#2`.
- Typeahead inputs replace large multi-selects for better scaling.

## Autosave Behavior
- Editing existing records auto-saves after changes.
- Creation flows still require an explicit save/submit.
- Reading order item changes (add/remove/reorder) are auto-saved.

## Import, Export, and Bulk Tools
- **Import** supports CSV or JSON with mapping + preview.
- **Bulk paste** tools exist for Series, Characters/Teams, Story Blocks, and Issues.
- **Export** provides JSON backups per entity.

See `docs/import-format.md` for field names and examples.

## ComicVine Integration
In Tools:
1. Save your ComicVine API key.
2. Search by resource (publisher, volume, issue, character, team).
3. Import selected items.

Notes:
- Importing **issues** will create missing series and publishers as needed.
- Importing **volumes** can optionally pull issues.
- Issue descriptions are stored in issue `notes`.
- Characters/teams are created and linked based on ComicVine credits.

## Deletion and Cascades
- You can delete any entity from its detail view.
- Deleting a **series** cascades to its issues and to any story blocks that only include that series.
- If a story block includes multiple series, the UI warns before deletion.

## Suggestions and Fatigue
The dashboard and story blocks show switch/stay suggestions based on recent reading sessions and fatigue levels. The dominant character/team in recent sessions is used to decide whether to recommend a switch.
