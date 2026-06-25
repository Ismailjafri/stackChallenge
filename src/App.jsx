import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import ReignOfVII from "./ReignOfVII";
import RideOfVII from "./RideOfVII";

function Home() {
  return (
    <div
      style={{
        background: "#0d1117",
        color: "white",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        gap: "20px",
      }}
    >
      <h1>VII Games</h1>

      <Link to="/reign">
        <button>Reign of VII</button>
      </Link>

      <Link to="/ride">
        <button>Ride of VII</button>
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/reign" element={<ReignOfVII />} />
        <Route path="/ride" element={<RideOfVII />} />
      </Routes>
    </BrowserRouter>
  );
}