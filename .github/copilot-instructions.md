# Copilot Instructions for Integration Platform

## Architecture Overview

This is a **multi-service integration platform** with a React frontend and FastAPI backend that connects to external data sources (Airtable, Notion, HubSpot).

### Core Components
- **Backend** (`backend/`): FastAPI server handling OAuth flows and data retrieval for integrations
- **Frontend** (`frontend/`): React app with Material-UI for user interaction
- **Redis Cache** (`redis_client.py`): Stores temporary OAuth state and verifiers (6min expiry)
- **Integration Layer** (`backend/integrations/`): Modular OAuth handlers for each service

### Data Flow
1. Frontend initiates OAuth → calls `/integrations/{service}/authorize` endpoint
2. Backend generates state+verifier, stores in Redis (600s expiry), returns auth URL
3. User authenticates with OAuth provider
4. Callback handler validates state, exchanges code for token, stores credentials
5. Frontend loads data via `/integrations/{service}/load` with credentials
6. IntegrationItem objects normalize data across services

## Critical Patterns

### OAuth Flow Pattern (Airtable, Notion, HubSpot)
All integrations follow this sequence in `backend/integrations/{service}.py`:

1. **authorize()**: Creates state + PKCE challenge, stores in Redis with 10min expiry
2. **oauth2callback()**: Validates state, exchanges code for token, deletes temporary data
3. **get_{service}_credentials()**: Retrieves stored credentials from Redis
4. **get_items_{service}()**: Fetches paginated items using IntegrationItem schema

**Key detail**: State data is base64-encoded JSON including `user_id`, `org_id`, and `state` token. Redis keys use pattern: `{service}_state:{org_id}:{user_id}` and `{service}_verifier:{org_id}:{user_id}`.

### Frontend Integration Pattern (`frontend/src/integrations/`)
Each integration component exports default handler:
```javascript
// Example structure in airtable.js, notion.js, hubspot.js, slack.js
export const AirtableIntegration = ({ user, org, integrationParams, setIntegrationParams }) => {
  // 1. Calls /authorize endpoint with user_id + org_id
  // 2. Opens OAuth URL in popup/redirect
  // 3. On callback, fetches credentials
  // 4. Calls /load endpoint with credentials
  // 5. Updates integrationParams with type + credentials
}
```

Integration state flows up to `IntegrationForm.js` which displays `DataForm` once credentials exist.

### Redis Client Pattern
Use `redis_client.py` for all cache operations:
- `add_key_value_redis(key, value, expire=None)` - Set with optional TTL
- `get_value_redis(key)` - Get value (returns bytes, decode if needed)
- `delete_key_redis(key)` - Delete key
All operations are async; use `await` in FastAPI endpoints.

## Development Workflows

### Running Locally
```bash
# Backend
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload

# Frontend (separate terminal)
cd frontend
npm install
npm start  # Runs on http://localhost:3000
```

### Adding a New Integration Service
1. Create `backend/integrations/{service}.py` with functions:
   - `authorize_{service}(user_id, org_id)` → returns auth_url
   - `oauth2callback_{service}(request: Request)` → returns redirect or HTML response
   - `get_{service}_credentials(user_id, org_id)` → returns stored token
   - `get_items_{service}(credentials)` → returns List[IntegrationItem]

2. Add routes in `backend/main.py`:
   - POST `/integrations/{service}/authorize`
   - GET `/integrations/{service}/oauth2callback`
   - POST `/integrations/{service}/credentials`
   - POST `/integrations/{service}/load` (or custom endpoint name)

3. Create `frontend/src/integrations/{service}.js` with component exporting the handler

4. Register in `IntegrationForm.js` integrationMapping

### Key Environment Variables
- `REDIS_HOST` - Redis server hostname (defaults to 'localhost')
- Service-specific OAuth credentials (CLIENT_ID, CLIENT_SECRET) - stored as constants in each integration module

## Common Gotchas

- **State Validation**: Always validate state token matches saved state before token exchange
- **Redis TTL**: OAuth state expires after 600s; callbacks must complete quickly
- **CORS**: Frontend runs on `localhost:3000`, backend configured to accept this origin
- **Async/Await**: All Redis operations and HTTP calls in FastAPI must use async functions
- **Credentials Storage**: Currently stored in Redis; add persistence layer (DB) for production
- **IntegrationItem**: Flexible schema supports heterogeneous data; not all fields required for all services
