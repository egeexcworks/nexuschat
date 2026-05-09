import { useState } from "react";

export default function App() {
  const [online, setOnline] = useState(128);

  return (
    <div className="h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-xl bg-zinc-900/60 border border-zinc-800 rounded-2xl p-8 shadow-2xl backdrop-blur-lg">

        {/* Header */}
        <h1 className="text-4xl font-bold text-center mb-2">
          Nexus Chat
        </h1>

        <p className="text-center text-zinc-400 mb-6">
          Real-time Discord-style chat system (in progress)
        </p>

        {/* Status Card */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-zinc-800/60 p-4 rounded-xl text-center">
            <p className="text-sm text-zinc-400">Status</p>
            <p className="text-green-400 font-semibold">● Online</p>
          </div>

          <div className="bg-zinc-800/60 p-4 rounded-xl text-center">
            <p className="text-sm text-zinc-400">Users</p>
            <p className="font-semibold">{online}</p>
          </div>
        </div>

        {/* Button actions */}
        <div className="flex gap-3">
          <button
            onClick={() => setOnline(online + 1)}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 transition p-3 rounded-xl font-medium"
          >
            Simulate User Join
          </button>

          <button
            onClick={() => setOnline(online - 1)}
            className="flex-1 bg-zinc-700 hover:bg-zinc-600 transition p-3 rounded-xl font-medium"
          >
            Simulate Leave
          </button>
        </div>

        {/* Footer */}
        <p className="text-xs text-zinc-500 text-center mt-6">
          Built with React + Socket.io (next step)
        </p>
      </div>
    </div>
  );
}