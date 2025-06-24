# Thmanyah CMS

Admin CMS and public discovery API built on Microservices architecture

## Services

- **CMS** `:3000` - Admin interface, JWT auth, content management
- **Discovery** `:3001` - Public API, read-only, cached responses  
- **PostgreSQL** - Database
- **Redis** - Cache + pub/sub

## Setup

```bash
git clone <repo>
cd cms-thmanyah
./setup-env.sh
docker-compose up
```

## Environment Setup

```bash
# Development
./setup-env.sh

```

## API

### Admin (CMS - Port 3000)
```
POST /auth/dev-token        # Get JWT token
GET  /cms/content          # List episodes
POST /cms/content          # Create episode
PUT  /cms/content/:id      # Update episode
DELETE /cms/content/:id    # Delete episode
GET  /sync/youtube/status  # YouTube sync status
```

### Public (Discovery - Port 3001)
```
GET /api/v1/content        # List published episodes
GET /api/v1/content/:id    # Get episode details
GET /api/v1/content/search # Search episodes
GET /api/v1/health/live    # Health check
```

## Development

```bash
# Individual services
cd cms && npm run start:dev
cd discovery && npm run start:dev

# All services
docker-compose up

# With debugging tools
docker-compose --profile debug up
```

## Features

- JWT authentication
- Arabic content support with RTL metadata
- Redis cache invalidation between services
- YouTube API integration
- TypeORM migrations
- Health checks and monitoring