import { useEffect, useRef, useState } from "react";
import { socket } from "./socket.js";

export default function App() {
  const [joined, setJoined] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [name, setName] = useState("");

  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("python");
  const [users, setUsers] = useState([]);
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);

  // Tracks whether the last "edit" event we're about to emit came from our
  // own typing vs. a remote update, so we don't echo remote changes back out.
  const applyingRemoteChange = useRef(false);

  useEffect(() => {
    if (!joined) return;

    socket.connect();
    socket.emit("join-room", { roomId, name });

    socket.on("init", (state) => {
      applyingRemoteChange.current = true;
      setCode(state.code);
      setLanguage(state.language);
      setUsers(state.users);
    });

    socket.on("edit", ({ code: incoming }) => {
      applyingRemoteChange.current = true;
      setCode(incoming);
    });

    socket.on("language-change", ({ language: lang }) => setLanguage(lang));
    socket.on("user-joined", () => {
      /* could show a toast; kept minimal for the starter */
    });
    socket.on("user-left", ({ id }) => setUsers((prev) => prev.filter((u) => u.id !== id)));

    socket.on("run-started", () => {
      setRunning(true);
      setOutput("");
    });
    socket.on("run-result", ({ output: out, error }) => {
      setRunning(false);
      setOutput(error ? `Error: ${error}` : out);
    });

    return () => socket.disconnect();
  }, [joined, roomId, name]);

  function handleJoin(e) {
    e.preventDefault();
    if (roomId.trim()) setJoined(true);
  }

  function handleCodeChange(e) {
    const next = e.target.value;
    setCode(next);

    // Skip echoing straight back out if this change just arrived from the server.
    if (applyingRemoteChange.current) {
      applyingRemoteChange.current = false;
      return;
    }
    socket.emit("edit", { roomId, code: next });
  }

  function handleLanguageChange(e) {
    const lang = e.target.value;
    setLanguage(lang);
    socket.emit("language-change", { roomId, language: lang });
  }

  function handleRun() {
    socket.emit("run-code", { roomId, code, language });
  }

  if (!joined) {
    return (
      <div className="join-screen">
        <h1>CodeSync</h1>
        <p className="subtitle">Real-time collaborative code editor.</p>
        <form onSubmit={handleJoin}>
          <input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required />
          <input
            placeholder="Room ID (share this with others)"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            required
          />
          <button type="submit">Join room</button>
        </form>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>CodeSync — {roomId}</h1>
        <div className="users">
          {users.map((u) => (
            <span key={u.id} className="user-chip">
              {u.name}
            </span>
          ))}
        </div>
        <select value={language} onChange={handleLanguageChange}>
          <option value="python">Python</option>
          <option value="javascript">JavaScript</option>
        </select>
        <button className="run-btn" onClick={handleRun} disabled={running}>
          {running ? "Running…" : "Run ▶"}
        </button>
      </header>

      <div className="main">
        <textarea
          className="editor"
          value={code}
          onChange={handleCodeChange}
          spellCheck={false}
          placeholder={`# Write ${language} code here, everyone in the room sees it live`}
        />
        <div className="output-panel">
          <div className="output-header">Output</div>
          <pre className="output">{output || (running ? "Running…" : "Click Run to execute the code.")}</pre>
        </div>
      </div>
    </div>
  );
}
