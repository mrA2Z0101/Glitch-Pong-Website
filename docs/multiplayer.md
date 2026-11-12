# Online multiplayer without a server

Glitch Pong has two ways to play online. Both use the same lobby, the same six-digit join code and the same match rules, so the game can't tell them apart.

| | Peer-to-peer | Hosted server |
|---|---|---|
| Needs | A static site (GitHub Pages is enough) | `npm start` somewhere that stays running |
| Who runs the match | The hosting player's browser | The server |
| Cost to you | None | Hosting, plus keeping it up |
| Used when | There is no socket.io server on the page | `npm start` is serving the page |

The client picks for itself: if `window.io` exists (the server's `/socket.io/socket.io.js` loaded) it uses the server, otherwise peer-to-peer. `?net=p2p` or `?net=server` forces one while testing.

## How a game is set up (peer-to-peer)

```
 Host's browser                     PeerJS broker                 Guest's browser
 ───────────────                    (free, public)                ───────────────
 makes lobby, gets 483920
 registers as "glitchpong-483920" ─▶ knows that id
                                                  ◀── asks for "glitchpong-483920"
              ◀─────── introduces the two browsers ───────▶
 ◀════════════════ direct WebRTC data channel ════════════════▶
 runs the match, 60 snapshots/s  ──────────────────────────────▶ draws them
 ◀────────────────────────────────────────── sends up/down/stop
```

- The broker only introduces the two browsers. The game itself never goes through it.
- The host's browser runs the same session manager and simulation as the server, and the host's own player connects to it through an in-process pipe.
- The code is the host's id on the broker. If someone else already has that id, the host silently tries another code. A code only exists while the host's tab is open, so there is nothing to store or expire.

## Playing

- **Host:** Glitch Pong → Play → Player 2 → Host a game. Share the six digits. Press Start when the opponent shows as connected.
- **Guest:** Play → Player 2 → Join game → type the code.
- If the guest drops, "Resume last session" brings them back for 45 seconds. If the host leaves, the game ends and the code is released.
- Online matches are plain Pong on every arena. Each player sees the backdrop of the arena they last picked, but arena rules (Black-Hole Nexus gravity, and everything the twelve maps in [arenas.md](arenas.md) do) only apply to local matches.

**Keep the host's tab open and in front.** Browsers slow down timers in background tabs, and a host that sleeps stops the match for both players. A phone host also stops if the screen locks. The lobby tells the host this.

## Where it can go wrong

- **Some networks block direct connections** (many school and office networks, some mobile data). PeerJS's free broker also hands out STUN and shared TURN relay servers, which cover most of these cases, but they are best-effort and not run by you. When it fails the guest sees "Couldn't connect to the host… Try another network."
- **The broker is someone else's free service** with no uptime promise. If it's down, hosting fails with "Can't reach the matchmaking service".
- **Players can see each other's IP addresses.** That's inherent to WebRTC. Only share a code with people you'd be happy to play with.
- **Codes can be guessed.** There are a million of them and a lobby is open only until it has two players (or the host presses Lock). The same is true of any join-by-PIN game.
- **The host is the referee.** A host can cheat, and can send a guest any result. That's fine between friends, so peer-to-peer wins pay arcade coins only for the first three a day (`P2P_PAID_WINS_PER_DAY` in `glitchpong-site.js`). Wins on the hosted server pay as before.

## Configuring it

By default nothing needs configuring. To change the broker or add your own TURN server, define this before `glitchpong-p2p.js` loads:

```html
<script>
  window.GLITCH_P2P_CONFIG = {
    // your own PeerServer (npx peerjs --port 9000), instead of the free public broker
    host: "peers.example.com", port: 443, path: "/", secure: true,
    // your own relay, for networks that block direct connections
    config: { iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "turn:turn.example.com:3478", username: "…", credential: "…" }] }
  };
</script>
```

Any TURN credential in a static page is visible to everyone who loads it. Use short-lived credentials from a small endpoint if you add one.

For local testing only, `?peerserver=localhost:9000` on a `localhost` page points the game at a local broker with no STUN or TURN.

## What an untrusted host can't do to a guest

With a server, the other end of the connection was yours. Peer-to-peer, it's a stranger's browser. Everything the host sends is rebuilt from scratch before the game or the page sees it (`GlitchP2P.clean` in `glitchpong-p2p.js`):

- Lobbies, snapshots and join replies are reduced to the expected fields, with types, lengths and ranges checked. A snapshot with an out-of-range or non-finite number is dropped whole (JSON can carry `1e999`, which parses to `Infinity`).
- Names are length-limited and stripped of control, zero-width and direction-override characters, and are escaped wherever they're put in the page. Before this work the lobby inserted `lobby.code` and nicknames into `innerHTML` unescaped, which let a hostile host run script in a guest's page. That also closed a smaller version of the same hole in server mode.
- A player's title and nameplate arrive as two catalog ids (`card`). Anything that is not a short id becomes `default`, and the game looks ids up in its own catalog, so a host can't put text of its own on the guest's screen that way.
- A guest only passes on the events a host legitimately sends, so a host can't fake a "disconnect".

The other direction is guarded too: a host accepts only the five events a client may send, drops connections that never identify themselves, limits connections and message rates, and answers strangers' malformed messages with nothing.

## Files

| File | Role |
|---|---|
| `glitchpong-p2p.js` | The peer-to-peer transport and validators. A small file the page always loads; it fetches the rest on first use |
| `vendor/peerjs.min.js` | PeerJS 1.5.5 (MIT), loaded only when someone opens multiplayer |
| `server/online-host.js` | The lobby's rules, shared by the server and the browser host |
| `server/session-manager.js`, `server/authoritative-pong.js` | Lobbies and the simulation. They now run in Node and in a browser |
| `server/index.js` | The socket.io server, unchanged in behaviour |

## Tests

`node --test tests/*.mjs` covers the shared lobby rules, the whole peer-to-peer protocol against an in-memory fake of PeerJS (`tests/helpers/fake-peer.mjs`), and a hostile host and hostile guests. The security checks were also mutation-tested: each guard was removed in turn to confirm a test fails.

The real thing, two browsers over a real WebRTC channel, was run by hand with Playwright against a local PeerServer (`npm i peer`, then `new PeerServer({host:"0.0.0.0", port:9000, path:"/"})`) and `?net=p2p&peerserver=localhost:9000`. In that run the guest joined in about 200 ms, snapshots arrived at 60 Hz (median 16 ms, 95th percentile 24 ms), and a hostile lobby that ran script in the guest's page before the fix did nothing after it.

### Not tested

- **The public PeerJS broker.** The sandbox couldn't reach it, so this has only been run against a local one.
- **Real NAT traversal and TURN.** Both browsers were on one machine.
- **Safari, iOS and Android browsers.**
- **A host in the background.** Only reasoned about, not measured.
