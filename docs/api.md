# ComicTracker API

Base URL: `/api`

## Auth
- `POST /api/auth/register` `{ email, password }`
- `POST /api/auth/login` `{ email, password }`
- `POST /api/auth/logout`
- `GET /api/auth/me`

## Pagination, Search, Sorting
All list endpoints accept `page` and `pageSize`. Most lists accept `q` for text search.

Sorting uses `sort` and `order=asc|desc` where supported.

### List Filters
- `/api/publishers`: `q`
- `/api/series`: `q`, `publisherId`, `era` (comma/semicolon/pipe separated list), `type`, `sort=name|startYear|endYear|type|createdAt`
- `/api/characters`: `q` (name, realName, aliases exact), `publisherId`, `type`, `priority`, `sort=name|type|currentTrackingPriority|createdAt`
- `/api/events`: `q`, `publisherId`, `sort=sequenceOrder|name|startYear|endYear|createdAt`
- `/api/story-blocks`: `q`, `status`, `era`, `importance`, `syncLevel`, `publisherId`, `sort=orderIndex|name|startYear|status|importance|syncLevel|createdAt`
- `/api/issues`: `q`, `seriesId`, `status`, `sort=issueNumber|title|status|releaseDate|readingOrderIndex|series`
- `/api/reading-orders`: `q`
- `/api/sessions`: `from`, `to`

## Core Entities (CRUD)
Each supports `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id`.

- Publishers: `/api/publishers`
- Series: `/api/series`
- Characters/Teams: `/api/characters`
- Events: `/api/events`
- Story Blocks: `/api/story-blocks`
- Issues: `/api/issues`
- Reading Sessions: `/api/sessions`
- Reading Orders: `/api/reading-orders`

### Entity Notes
- **Series**: `era` is a string array (publication eras). `type` is an enum.
- **Story Blocks**: `era` is a single value; `chronology` is a free-text label. `publisherId` is required.
- **Story Blocks derived fields**: `startYear`, `endYear`, `status`, `characters`, and `teams` are derived from issues.
- **Issues**: `issueNumber` is a string; `issueNumberSort` stores numeric sorting value. `readingOrderIndex` is an integer.
- **Characters/Teams**: `aliases` is stored as a JSON array; `realName` is optional.
- **Reading Orders**: items include `storyBlockId` and `orderIndex` (float).

### Bulk Insert
- `POST /api/series/bulk` `{ items: [] }`
- `POST /api/characters/bulk` `{ items: [] }`
- `POST /api/story-blocks/bulk` `{ items: [] }`
- `POST /api/issues/bulk` `{ items: [] }`

### Helpers
- `GET /api/series/:id/dependencies` (issue count + story blocks, used for delete warnings)
- `POST /api/story-blocks/derive` `{ issueIds: [] }` returns derived `startYear`, `endYear`, `status`, `characters`, `teams`
- `POST /api/story-blocks/:id/finish` marks all issues in the block as `FINISHED`
- `GET /api/issues/range?seriesId=<id>&start=<issue>&end=<issue>` returns issues between issue numbers

## Dashboard + Suggestions
- `GET /api/dashboard` returns current reading blocks, high priority characters/teams, upcoming events, and switch suggestions.
- `GET /api/dashboard/suggestions?storyBlockId=<id>` returns switch recommendation for a specific block.
- `GET /api/stats` returns library counts and recent session metrics.

## Import / Export
- `POST /api/import/:entity/preview` (multipart) with `file` + `mapping`
- `POST /api/import/:entity/commit` (multipart) with `file` + `mapping`
- `GET /api/export/:entity`

Import supports: `publishers`, `series`, `characters`, `events`, `story-blocks`, `issues`
Export supports: `publishers`, `series`, `characters`, `events`, `story-blocks`, `issues`, `sessions`

## ComicVine Integration
- `GET /api/settings` returns saved API key metadata
- `PUT /api/settings` `{ comicVineApiKey }`
- `GET /api/comicvine/search?query=...&resource=publisher|volume|issue|character|team`
- `POST /api/comicvine/import` `{ resource, detailUrls: [], includeIssues?: boolean }` (`includeIssues` applies to volumes)
- `GET /api/jobs?status=<optional>&take=<optional>` to check import job status

## Data Hygiene
- `GET /api/duplicates?entity=publishers|series|characters|events|story-blocks|issues`
- `POST /api/merge` `{ entity, targetId, sourceIds }`
