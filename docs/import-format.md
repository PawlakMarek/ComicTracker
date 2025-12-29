# Import Format Guide

Each import expects a CSV or JSON array. Use the Import UI to map column names to fields.

## Common Notes
- Related entities are matched by name (case-sensitive).
- Publishers and characters/teams can be created if missing.
- Series must exist before importing issues or story blocks (create series first).
- For story block issue lists, use `Series Name#IssueNumber` tokens (comma-separated).
- List fields use comma/semicolon/pipe separators unless noted.
- Story block derived fields (start/end year, status, characters/teams) are recalculated from issues after import.
- Bulk paste tools are available in the UI for Series, Characters/Teams, Story Blocks, and Issues.

## Publishers
Fields: `name`, `country`, `notes`

## Series
Fields: `name`, `publisher`, `startYear`, `endYear`, `era`, `type`, `notes`
- `era`: comma/semicolon/pipe separated list (stored as an array)
- `chronology`: supported only for Story Blocks (not Series)
Bulk CSV headers (paste): `name`, `publisherName`, `startYear`, `endYear`, `era`, `type`, `notes`

## Characters / Teams
Fields: `name`, `realName`, `type`, `publisher`, `aliases`, `continuity`, `majorStatusQuoNotes`, `currentTrackingPriority`, `teams`
- `type`: `CHARACTER` or `TEAM`
- `currentTrackingPriority`: `HIGH`, `MEDIUM`, `LOW`, `NONE`
- `aliases`: comma/newline/semicolon separated string (HTML `<br>` supported), or a JSON array of strings (stored as JSON)
- `teams`: comma/semicolon/pipe separated team names (only applied when `type` is `CHARACTER`)
Bulk CSV headers (paste): `name`, `realName`, `type`, `publisherName`, `aliases`, `continuity`, `majorStatusQuoNotes`, `currentTrackingPriority`

## Events
Fields: `name`, `publisher`, `startYear`, `endYear`, `sequenceOrder`, `notes`

## Story Blocks
Fields: `name`, `type`, `era`, `chronology`, `publisher`, `startYear`, `endYear`, `importance`, `syncLevel`, `event`, `orderIndex`, `status`, `notes`, `series`, `issues`, `characters`, `teams`
- `era`: single value (story blocks support one era at a time)
- `series`: comma-separated list of series names
- `issues`: comma-separated list of `Series Name#IssueNumber`
- `characters` / `teams`: comma-separated names (created if missing)
- `publisher`: required unless all series belong to the same publisher (then inferred); also used to create the event if it doesn't exist yet
Series and issues referenced here must already exist.
`orderIndex` supports decimal values for precise reading order placement.
If you include issues, derived fields (start/end year, status, characters/teams) will be recalculated after import.
Bulk CSV headers (paste): `name`, `type`, `era`, `chronology`, `publisherName`, `startYear`, `endYear`, `importance`, `syncLevel`, `eventName`, `orderIndex`, `status`, `notes`

## Issues
Fields: `series`, `issueNumber`, `title`, `releaseDate`, `readingOrderIndex`, `status`, `readDate`, `notes`, `storyBlocks`, `characters`, `teams`, `events`
- `series`: series name (must exist)
- `storyBlocks`: comma-separated story block names
- `characters` / `teams`: comma-separated names (created if missing)
- `events`: comma-separated event names (created with placeholder metadata if missing)

Date fields accept ISO or `YYYY-MM-DD`.

### Bulk Add (UI)
Issues paste headers: `seriesName,issueNumber,title,releaseDate,readingOrderIndex,status,readDate,notes`.
