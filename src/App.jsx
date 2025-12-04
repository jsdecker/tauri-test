import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

function App() {
  const [name, setName] = useState("");
  const [greetMsg, setGreetMsg] = useState("");

  async function greet() {
    const message = await invoke("greet", { name });
    setGreetMsg(message);
  }

  return (
    <main className="container">
      <h1>Welcome to Tauri + React</h1>

      <div className="row">
        <a href="https://tauri.app" target="_blank">
          <img src="/assets/tauri.svg" className="logo tauri" alt="Tauri logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src="/assets/react.svg" className="logo react" alt="React logo" />
        </a>
      </div>
      <p>Click on the Tauri and React logos to learn more.</p>

      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          greet();
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter a name..."
        />
        <button type="submit">Greet</button>
      </form>
      <p>{greetMsg}</p>
    </main>
  );
}

export default App;
