import "./App.css";
import React from "react";
import {BrainScene} from "./scene/BrainScene";
import {Header} from "semantic-ui-react";

function App() {
  return (
    <div className="App">
      <Header as="h1" style={{margin: "10px"}}>
          Visualization of intracranial brain recordings during the task of visual perceptual categorization in humans
      </Header>
      <BrainScene/>
    </div>
  );
}

export default App;
