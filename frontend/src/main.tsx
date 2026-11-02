import { createRoot } from "react-dom/client";
import Site from "./app/Site";
import "@xyflow/react/dist/style.css";
import "./styles/tokens.css";
import "./styles/global.css";

createRoot(document.getElementById("root")!).render(<Site />);
