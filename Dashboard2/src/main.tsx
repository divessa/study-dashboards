import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { validateData } from "./storage";
import { PrivateGate } from "../../private-cloud/Gate";
import "./styles.css";
createRoot(document.getElementById("root")!).render(<React.StrictMode><PrivateGate dashboard="campus" validate={validateData} render={(initial,cloud)=><App initial={initial} cloud={cloud}/>} /></React.StrictMode>);
