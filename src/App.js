import "./App.css";
import React from "react";
import {BrainScene} from "./scene/BrainScene";

function App() {
  return (
    <div className="App">
      <header className="App-header">
        Brain data visualization
      </header>
      <BrainScene/>
    </div>
  );
}

export default App;
