# ComicTracker API

Base URL: `/api`

## Auth
- `POST /api/auth/register` `{ email, password }`
- `POST /api/auth/login` `{ email, password }`
- `POST /api/auth/logout`
- `GET /api/auth/me`

## Core Entities (CRUD)
Each supports `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id`.

- Publishers: `/api/publishers`
- Series: `/api/series`
- Characters/Teams: `/api/characters`
- Events: `/api/events`
- Story Blocks: `/api/story-blocks`
- Reading Orders: `/api/reading-orders`
- Issues: `/api/issues`
- Reading Sessions: `/api/sessions`

### Bulk Insert
- `POST /api/series/bulk` with `{ items: [] }`
- `POST /api/characters/bulk` with `{ items: [] }`
- `POST /api/story-blocks/bulk` with `{ items: [] }`
- `POST /api/issues/bulk` with `{ items: [] }`

### List Filtering
- `/api/series`: `publisherId`, `era` (matches any era value), `type`, `q`
- `/api/characters`: `publisherId`, `type`, `priority`, `q`, `sort`, `order`
- `/api/events`: `publisherId`, `q`
- `/api/story-blocks`: `status`, `era`, `importance`, `syncLevel`, `publisherId`, `q`
- `/api/reading-orders`: `q`
- `/api/issues`: `seriesId`, `status`, `q`
- `/api/sessions`: `from`, `to`

Pagination: `page`, `pageSize` on list endpoints.

### Characters/Teams payload notes
- `realName` is optional.
- `teamIds` (for characters) and `memberIds` (for teams) allow linking memberships.

## Dashboard + Suggestions
- `GET /api/dashboard` returns current reading blocks, high priority characters/teams, upcoming events, and switch suggestion.
- `GET /api/dashboard/suggestions?storyBlockId=<id>` returns switch recommendation for a specific block.
- `GET /api/stats` returns library counts and recent session metrics.

## Story Block Helpers
- `POST /api/story-blocks/derive` `{ issueIds: [] }` returns derived `startYear`, `endYear`, `status`, `characters`, `teams`
- `POST /api/story-blocks/:id/finish` marks all issues in the block as `FINISHED`

## Issue Helpers
- `GET /api/issues/range?seriesId=<id>&start=<issue>&end=<issue>` returns issues between two issue numbers

## Import / Export
- `POST /api/import/:entity/preview` (multipart) with `file` and `mapping`
- `POST /api/import/:entity/commit` (multipart) with `file` and `mapping`
- `GET /api/export/:entity`
- `POST /api/issues/bulk` with `{ items: [] }` for CSV-style bulk inserts

Entities: `publishers`, `series`, `characters`, `events`, `story-blocks`, `issues`, `sessions` (export only)

## ComicVine Integration
- `GET /api/settings` returns saved API key metadata
- `PUT /api/settings` `{ comicVineApiKey }`
- `GET /api/comicvine/search?query=...&resource=publisher|volume|issue|character|team`
- `POST /api/comicvine/import` `{ resource, detailUrls: [], includeIssues?: boolean }` (includeIssues applies to `volume`)
- `GET /api/jobs?status=<optional>&take=<optional>` to check import job status

## Data Hygiene
- `GET /api/duplicates?entity=publishers|series|characters|events|story-blocks|issues`
- `POST /api/merge` `{ entity, targetId, sourceIds }`
