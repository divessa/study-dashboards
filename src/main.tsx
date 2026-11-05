import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { parseData } from "./storage";
import { PrivateGate } from "../private-cloud/Gate";
import "./styles.css";
const validate = (value: unknown) => parseData(JSON.stringify(value));
ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><PrivateGate dashboard="ects" validate={validate} render={(initial,cloud)=><App initial={initial} cloud={cloud}/>} /></React.StrictMode>);
