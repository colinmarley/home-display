"use client";

import { useState } from "react";

export default function AdminLogin() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    if (res.ok) window.location.reload();
    else setError("Wrong PIN");
  };
  return (
    <div className="admin">
      <h1>Home Display settings</h1>
      <form onSubmit={submit} className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        <label className="field">
          <span>PIN</span>
          <input type="password" inputMode="numeric" autoFocus value={pin} onChange={(e) => setPin(e.target.value)} />
        </label>
        <button className="btn btn-primary" type="submit">Unlock</button>
        {error && <div style={{ color: "var(--danger)" }}>{error}</div>}
      </form>
    </div>
  );
}
