# CodeSync — Real-time Collaborative Code Editor

Multiple people edit the same code live, then run it in a sandboxed Docker container.

**Stack:** Socket.io · Redis Pub/Sub · Docker (sandboxed execution) · GitHub Actions CI · k6 (load testing)

This is a working starter, not a finished product — built to be read and extended so you can explain every part of it in an interview.

---

## 1. Prerequisites

- Node.js 18+
- **Docker Desktop** installed and running (required for code execution — this is the part that can't be faked)
- **Redis** — easiest is running it in Docker too: `docker run -d -p 6379:6379 redis`
- (Optional, for load testing) [k6](https://k6.io/docs/get-started/installation/)

## 2. Build the sandbox images

These are the isolated containers untrusted code actually runs inside — no network access, memory/CPU/time capped.

```bash
cd server
npm run build:sandboxes
```

This builds two images: `sandbox-python` and `sandbox-node`. Re-run this any time you change the Dockerfiles in `server/sandbox/images/`.

## 3. Backend setup

```bash
cd server
cp .env.example .env
npm install
npm run dev
```

You should see:
```
Connected to Redis, Socket.io adapter attached
CodeSync server running on :5001
```

If it hangs or errors on Redis, confirm Redis is actually running (`docker ps` should show it) and that `REDIS_URL` in `.env` matches.

## 4. Frontend setup

```bash
cd client
npm install
npm run dev
```

Opens on `http://localhost:5173`.

## 5. Try it

1. Open the app in two different browser tabs (or two browsers).
2. In both, enter the **same Room ID**, different names.
3. Type in one tab — it appears in the other in real time.
4. Click **Run ▶** — the code executes inside a Docker container and the output streams back to everyone in the room.

## How it works

```
Browser A ──┐                                   ┌── Browser B
            │   Socket.io (edit/run events)     │
            ▼                                    ▼
      Node server ◄──── Redis Pub/Sub ────► (more server instances, if you scale out)
            │
    "Run code" request
            ▼
   Docker container (no network, CPU/mem/time limited)
            │
    stdout/stderr ──► broadcast back to everyone in the room
```

- **Editing:** every keystroke sends the *full* current document to the server (`rooms.js` holds the latest version per room), which rebroadcasts it to everyone else. This is simple and good enough for a demo, but it's "last write wins" — two people typing in the exact same spot at the exact same moment can clobber each other. See "Known limitations" below.
- **Running code:** `server/sandbox/run.js` uses `dockerode` to spin up a throwaway container per run, with `NetworkMode: "none"`, a memory cap, a CPU quota, and a hard wall-clock timeout. The container is always auto-removed.
- **Scaling:** the Redis adapter (`@socket.io/redis-adapter`) means if you ever run two server instances behind a load balancer, users connected to different instances still see each other's edits.

## Load testing (where your resume numbers come from)

```bash
k6 run load-test/k6-script.js
```

This ramps up to 200 concurrent simulated users over ~50 seconds and checks that 95% of them connect within 300ms. Read the actual numbers from k6's summary output at the end of the run — don't estimate them. Point `-e TARGET_URL=wss://your-deployed-app.com/...` at your deployed instance once it's live to get real-world numbers instead of localhost ones.

## CI/CD

`.github/workflows/ci.yml` runs on every push to `main`: installs and syntax-checks the server, builds the client, and builds both sandbox Docker images — so a broken Dockerfile or build fails the pipeline before it reaches production. Add an actual deploy step (e.g. pushing images to a registry and triggering a Render/Fly.io deploy) once you have a hosting target picked.

## Things to build next (in rough priority order)

1. **Deploy it.** Backend + Redis on Render/Fly.io (Docker-in-Docker or a host that allows privileged containers — note that some platforms, like Vercel, can't run Docker-based sandboxes; Render and Fly.io can). Frontend on Vercel.
2. **Swap full-document sync for a CRDT** (e.g. [Yjs](https://docs.yjs.dev/)) if you want true conflict-free concurrent editing instead of last-write-wins.
3. **Add more languages** by adding another `Dockerfile` + `entrypoint.sh` under `server/sandbox/images/` and registering it in `IMAGE_BY_LANGUAGE` in `run.js`.
4. **Persist rooms** (currently in-memory and lost on server restart) — move `rooms.js` state into Redis.
5. **Live cursors** — the `cursor` socket event is wired up server-side but the client doesn't render other users' cursor positions yet; that's a good next UI feature.

## Known limitations (be upfront about these in interviews)

- Editing sync is "last write wins" on the full document, not a true CRDT — fine for a demo, would need Yjs or similar for production-grade concurrent editing.
- Room state lives in server memory and is lost on restart.
- Only Python and JavaScript sandboxes are included.
- No authentication — anyone with the room ID can join and run code in that room.
