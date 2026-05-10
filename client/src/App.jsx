import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";

import Home from "./Home";

const Login = lazy(() => import("./Login"));
const Signup = lazy(() => import("./Signup"));
const Chat = lazy(() => import("./Chat"));
const ProtectedRoute = lazy(() => import("./pages/ProtectedRoute"));

function PageLoader() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
      <div className="rounded-lg border border-white/10 bg-white/[0.06] px-6 py-4 font-black shadow-2xl shadow-black/30">
        Loading Nexus...
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Suspense>
  );
}
