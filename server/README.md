Environment

Create `server/.env` with values like:

```
PORT=8787
HOST=0.0.0.0
JELLYSEERR_BASE=http://192.168.1.10:5055
JELLYFIN_BASE=http://192.168.1.20:8096
KARAKEEP_BASE=http://192.168.1.30:3000/api/v1
ALLOWED_ORIGINS=http://localhost:8080
```

Start the proxy:

```
pnpm proxy
```


