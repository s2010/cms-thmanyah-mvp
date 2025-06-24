# Thmanyah CMS

Microservices architecture with admin CMS and public discovery API.

## Services

- **CMS** `:3000` - Admin interface, JWT auth, content management
- **Discovery** `:3001` - Public API, read-only, cached responses  
- **PostgreSQL** - Database
- **Redis** - Cache + pub/sub

## Setup

```bash
git clone <repo>
cd cms-thmanyah
docker-compose up -d
```

Configure environment:
```bash
# cms/.env
DB_HOST=postgres
DB_PASSWORD=password
JWT_SECRET=your-key
YOUTUBE_API_KEY=your-key

# discovery/.env  
DISCOVERY_DB_HOST=postgres
DB_PASSWORD=password
```

## API

### Admin (CMS)
```
POST /auth/login
GET  /cms/content
POST /cms/content
PUT  /cms/content/:id
DELETE /cms/content/:id
```

### Public (Discovery)
```
GET /api/v1/content
GET /api/v1/content/:id
GET /api/v1/content/search
```

## Development

```bash
# Each service
npm install
npm run start:dev
```

## YouTube Sync

Auto-syncs configured channel hourly. Set `YOUTUBE_API_KEY` and `YOUTUBE_CHANNEL_HANDLE`.
