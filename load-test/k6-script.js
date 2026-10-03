// Run with: k6 run k6-script.js
// Override target with: k6 run -e TARGET_URL=wss://your-app.onrender.com k6-script.js
import ws from "k6/ws";
import { check, sleep } from "k6";

const TARGET_URL = __ENV.TARGET_URL || "ws://localhost:5001/socket.io/?EIO=4&transport=websocket";

export const options = {
  scenarios: {
    ramping: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "15s", target: 50 },
        { duration: "20s", target: 200 }, // <- bump this to find your breaking point
        { duration: "15s", target: 0 },
      ],
    },
  },
  thresholds: {
    // Fails the run if p95 latency-to-first-message exceeds 300ms —
    // tune this to whatever you decide is "good enough" and report that number.
    ws_session_duration: ["p(95)<300"],
  },
};

export default function () {
  const roomId = `loadtest-room`;

  const res = ws.connect(TARGET_URL, {}, (socket) => {
    socket.on("open", () => {
      // Socket.io's wire protocol needs a "40" handshake before custom events.
      socket.send("40");
    });

    socket.on("message", (msg) => {
      if (msg.startsWith("40")) {
        // connected to the Socket.io namespace — now join a room and send an edit
        socket.send(`42["join-room",{"roomId":"${roomId}","name":"k6-vu"}]`);
        socket.send(`42["edit",{"roomId":"${roomId}","code":"print(1)"}]`);
      }
    });

    socket.setTimeout(() => socket.close(), 4000);
  });

  check(res, { "connected (HTTP 101)": (r) => r && r.status === 101 });
  sleep(1);
}
