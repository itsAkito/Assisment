# backend/integrations/hubspot.py
import os
import time
import json
import secrets
import requests
from typing import List, Dict, Any, Optional
from fastapi import Request, HTTPException
from fastapi.responses import HTMLResponse

# Try to import IntegrationItem model if your repo defines one
try:
    from .integration_item import IntegrationItem
except Exception:
    IntegrationItem = None

# Import redis helper functions used by other integrations
try:
    from redis_client import add_key_value_redis, get_value_redis, delete_key_redis
except Exception:
    # fallback to in-memory store
    add_key_value_redis = None
    get_value_redis = None
    delete_key_redis = None

# Config: set these as environment variables in your backend or edit directly for local testing
HUBSPOT_CLIENT_ID = os.getenv("HUBSPOT_CLIENT_ID", "")  # Leave empty - will use .env file
HUBSPOT_CLIENT_SECRET = os.getenv("HUBSPOT_CLIENT_SECRET", "")  # Leave empty - will use .env file
# Must match the redirect URI registered in HubSpot app settings
HUBSPOT_REDIRECT_URI = os.getenv(
    "HUBSPOT_REDIRECT_URI",
    "http://localhost:8000/integrations/hubspot/oauth2callback",
)
HUBSPOT_AUTH_URL = "https://app.hubspot.com/oauth/authorize"
HUBSPOT_TOKEN_URL = "https://api.hubapi.com/oauth/v1/token"
HUBSPOT_API_BASE = "https://api.hubapi.com"

DEFAULT_SCOPES = [
    "crm.objects.contacts.read",
    # add more scopes here if you want companies or deals:
    # "crm.objects.companies.read", "crm.objects.deals.read"
]


# -----------------
# Simple in-memory fallback store
# -----------------
_MEM_STORE: Dict[str, Dict[str, Any]] = {}


def _store_credentials_local(key: str, value: str):
    # For non-async context, use in-memory store
    # Redis calls are handled in async functions
    _MEM_STORE[key] = value


def _get_credentials_local(key: str):
    if get_value_redis:
        try:
            val = get_value_redis(key)
            return val
        except Exception:
            pass
    return _MEM_STORE.get(key)


def _delete_credentials_local(key: str):
    if delete_key_redis:
        try:
            delete_key_redis(key)
            return
        except Exception:
            pass
    _MEM_STORE.pop(key, None)


# -----------------
# OAuth endpoints and helpers
# -----------------
async def authorize_hubspot(user_id, org_id, state: str = None):
    """
    Build the HubSpot authorization URL to redirect the user to.
    Returns the auth URL string.
    """
    if not HUBSPOT_CLIENT_ID:
        # Return an HTTP error so middleware (CORS) can still add headers
        raise HTTPException(status_code=400, detail="HUBSPOT_CLIENT_ID not configured in environment")

    # Create state that includes user/org so callback can persist credentials
    state_data = {
        'state': secrets.token_urlsafe(32),
        'user_id': user_id,
        'org_id': org_id,
    }
    encoded_state = json.dumps(state_data)

    # Persist state temporarily (expire ~10 minutes)
    try:
        if add_key_value_redis:
            await add_key_value_redis(f'hubspot_state:{org_id}:{user_id}', encoded_state, expire=600)
        else:
            _store_credentials_local(f'hubspot_state:{org_id}:{user_id}', encoded_state)
    except Exception:
        _store_credentials_local(f'hubspot_state:{org_id}:{user_id}', encoded_state)

    scopes = " ".join(DEFAULT_SCOPES)
    # Build URL
    from urllib.parse import urlencode

    params = {
        "client_id": HUBSPOT_CLIENT_ID,
        "redirect_uri": HUBSPOT_REDIRECT_URI,
        "scope": scopes,
        "state": encoded_state,
        "response_type": "code",
    }
    url = f"{HUBSPOT_AUTH_URL}?{urlencode(params)}"
    # Log for debugging
    try:
        print(f"[hubspot] Generated auth URL for client_id={HUBSPOT_CLIENT_ID}: {url}")
    except Exception:
        pass
    # Return JSON so frontend reliably receives a structured response
    return {"url": url}


async def oauth2callback_hubspot(request: Request):
    """
    Exchange code returned by HubSpot for access + refresh tokens.
    This route will persist credentials keyed by user/org and return a small HTML page to close the window.
    """
    params = dict(request.query_params)
    if params.get('error'):
        raise HTTPException(status_code=400, detail=params.get('error_description', 'OAuth error'))

    code = params.get('code')
    encoded_state = params.get('state')
    if not code or not encoded_state:
        raise HTTPException(status_code=400, detail='Missing code or state in callback')

    try:
        state_data = json.loads(encoded_state)
        user_id = state_data.get('user_id')
        org_id = state_data.get('org_id')
    except Exception:
        raise HTTPException(status_code=400, detail='Invalid state value')

    # Verify stored state
    saved_state = None
    try:
        if get_value_redis:
            saved_state = await get_value_redis(f'hubspot_state:{org_id}:{user_id}')
        else:
            saved_state = _get_credentials_local(f'hubspot_state:{org_id}:{user_id}')
    except Exception:
        saved_state = _get_credentials_local(f'hubspot_state:{org_id}:{user_id}')

    if not saved_state:
        raise HTTPException(status_code=400, detail='No saved state found for this oauth flow')

    try:
        saved_state_json = json.loads(saved_state) if isinstance(saved_state, str) else saved_state
    except Exception:
        saved_state_json = saved_state

    if saved_state_json.get('state') != state_data.get('state'):
        raise HTTPException(status_code=400, detail='State does not match')

    # Exchange code for tokens
    payload = {
        "grant_type": "authorization_code",
        "client_id": HUBSPOT_CLIENT_ID,
        "client_secret": HUBSPOT_CLIENT_SECRET,
        "redirect_uri": HUBSPOT_REDIRECT_URI,
        "code": code,
    }
    headers = {"Content-Type": "application/x-www-form-urlencoded"}

    resp = requests.post(HUBSPOT_TOKEN_URL, data=payload, headers=headers, timeout=15)
    resp.raise_for_status()
    token_data = resp.json()

    expires_in = int(token_data.get("expires_in", 0))
    expires_at = int(time.time()) + expires_in if expires_in else None

    credentials = {
        "access_token": token_data.get("access_token"),
        "refresh_token": token_data.get("refresh_token"),
        "expires_at": expires_at,
        "hub_id": token_data.get("hub_id"),
        "token_type": token_data.get("token_type", "Bearer"),
        "raw": token_data,
    }

    # Persist credentials keyed to user/org
    try:
        if add_key_value_redis:
            await add_key_value_redis(f'hubspot_credentials:{org_id}:{user_id}', json.dumps(credentials), expire=600)
        else:
            _store_credentials_local(f'hubspot_credentials:{org_id}:{user_id}', json.dumps(credentials))
    except Exception:
        _store_credentials_local(f'hubspot_credentials:{org_id}:{user_id}', json.dumps(credentials))

    # delete the saved state
    try:
        if delete_key_redis:
            await delete_key_redis(f'hubspot_state:{org_id}:{user_id}')
        else:
            _delete_credentials_local(f'hubspot_state:{org_id}:{user_id}')
    except Exception:
        _delete_credentials_local(f'hubspot_state:{org_id}:{user_id}')

    close_window_script = """
    <html>
        <script>
            window.close();
        </script>
    </html>
    """
    return HTMLResponse(content=close_window_script)


async def get_hubspot_credentials(user_id, org_id):
    """
    Load credentials for a given user/org (reads from the temporary store and deletes the key)
    """
    try:
        if get_value_redis:
            credentials = await get_value_redis(f'hubspot_credentials:{org_id}:{user_id}')
        else:
            credentials = _get_credentials_local(f'hubspot_credentials:{org_id}:{user_id}')
    except Exception:
        credentials = _get_credentials_local(f'hubspot_credentials:{org_id}:{user_id}')

    if not credentials:
        raise HTTPException(status_code=400, detail='No credentials found.')

    try:
        credentials_json = json.loads(credentials) if isinstance(credentials, str) else credentials
    except Exception:
        credentials_json = credentials

    # remove from store
    try:
        if delete_key_redis:
            await delete_key_redis(f'hubspot_credentials:{org_id}:{user_id}')
        else:
            _delete_credentials_local(f'hubspot_credentials:{org_id}:{user_id}')
    except Exception:
        _delete_credentials_local(f'hubspot_credentials:{org_id}:{user_id}')

    return credentials_json


# -----------------
# Item creation + fetch helpers
# -----------------
async def create_integration_item_metadata_object(response_json: dict) -> dict:
    """
    Given a single HubSpot object JSON (from CRM v3), build the integration-item-like metadata dict.
    """
    obj_id = response_json.get("id")
    properties = response_json.get("properties", {}) or {}

    # Build name: prefer firstname + lastname, fallback to email or id
    firstname = properties.get("firstname")
    lastname = properties.get("lastname")
    email = properties.get("email")
    name = " ".join(filter(None, [firstname, lastname])).strip() or email or f"hubspot-{obj_id}"

    # Map certain properties as parameters
    parameters = []
    for k in ("email", "firstname", "lastname", "jobtitle", "company", "phone"):
        if k in properties and properties.get(k) is not None:
            parameters.append({"name": k, "value": properties.get(k)})

    item = {
        "id": obj_id,
        "type": "contact",
        "name": name,
        "parameters": parameters,
        "raw": response_json,
    }

    # If IntegrationItem class exists in repo, try to use it
    if IntegrationItem:
        try:
            return IntegrationItem(
                id=obj_id,
                type="contact",
                name=name,
                parameters=parameters,
                raw=response_json,
            )
        except Exception:
            return item

    return item


async def get_items_hubspot(credentials: Dict[str, Any], max_items: int = 100) -> List[dict]:
    """
    Retrieve HubSpot contacts. Returns a list of metadata dicts or IntegrationItem instances.
    `credentials` is the dict returned by oauth2callback_hubspot or get_hubspot_credentials.
    """
    access_token = credentials.get("access_token")
    if not access_token:
        raise RuntimeError("No access token in provided credentials")

    headers = {"Authorization": f"Bearer {access_token}", "Accept": "application/json"}
    properties = [
        "email",
        "firstname",
        "lastname",
        "jobtitle",
        "company",
        "phone",
    ]
    params = {
        "limit": 100 if max_items >= 100 else max_items,
        "properties": ",".join(properties),
        "archived": "false",
    }

    items = []
    url = f"{HUBSPOT_API_BASE}/crm/v3/objects/contacts"

    # Basic single-page fetch. HubSpot supports paging via 'paging' key — add loop if you want more.
    resp = requests.get(url, headers=headers, params=params, timeout=15)
    resp.raise_for_status()
    data = resp.json()

    results = data.get("results", [])
    for res in results:
        item = await create_integration_item_metadata_object(res)
        items.append(item)
        if len(items) >= max_items:
            break

    # If there are more pages and user asked for more than this page returned, follow next page
    paging = data.get("paging", {})
    next_link = None
    if paging:
        next_obj = paging.get("next")
        if next_obj:
            next_link = next_obj.get("link")

    # Follow next pages if needed
    while next_link and len(items) < max_items:
        resp = requests.get(next_link, headers=headers, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        results = data.get("results", [])
        for res in results:
            item = await create_integration_item_metadata_object(res)
            items.append(item)
            if len(items) >= max_items:
                break
        paging = data.get("paging", {})
        next_obj = paging.get("next") if paging else None
        next_link = next_obj.get("link") if next_obj else None

    return items
