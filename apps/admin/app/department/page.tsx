"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Complaint = {
  id: string;
  title: string;
  description: string;
  location: string;
  status: string;
  priority: string;
  created_at: string;
};

export default function DepartmentPage() {
  const [rows, setRows] = useState<Complaint[]>([]);
  const [role, setRole] = useState("");
  const [message, setMessage] = useState("Loading your authorized complaints...");

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        if (active) setMessage("Please sign in from the main GrievX dashboard, then open this page again.");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, department_id")
        .eq("id", session.user.id)
        .single();

      if (!active) return;
      if (profileError || !profile || !["staff", "department_head", "admin"].includes(profile.role)) {
        setMessage("This page is available to staff, department heads and administrators.");
        return;
      }
      setRole(profile.role);

      const { data, error } = await supabase
        .from("complaints")
        .select("id, title, description, location, status, priority, created_at")
        .order("created_at", { ascending: false });

      if (!active) return;
      if (error) setMessage(error.message);
      else {
        setRows((data ?? []) as Complaint[]);
        setMessage(data?.length ? "" : "No complaints are currently visible in your authorized scope.");
      }
    };

    void load();
    return () => { active = false; };
  }, []);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from("complaints")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      setMessage(error.message);
      return;
    }
    setRows((items) => items.map((item) => item.id === id ? { ...item, status } : item));
    setMessage("Complaint status updated.");
  };

  return (
    <main style={{ maxWidth: 1000, margin: "40px auto", padding: 20, fontFamily: "Arial, sans-serif", color: "#17233B" }}>
      <p style={{ color: "#315DB8", fontWeight: 700 }}>GRIEVX CAMPUS · OPERATIONS</p>
      <h1>Department workspace</h1>
      <p>Signed-in role: {role || "checking session"}. Database row-level security determines which complaints appear here.</p>
      {message && <p role="status">{message}</p>}
      <p><a href="/">Return to the main dashboard</a></p>
      <section style={{ display: "grid", gap: 14 }}>
        {rows.map((item) => (
          <article key={item.id} style={{ border: "1px solid #DDE3EE", borderRadius: 12, padding: 18, background: "white" }}>
            <h2 style={{ marginTop: 0 }}>{item.title}</h2>
            <p>{item.description}</p>
            <p>{item.location} · {item.priority} priority · {item.status.replace("_", " ")}</p>
            <label>
              Update status{" "}
              <select value={item.status} onChange={(event) => void updateStatus(item.id, event.target.value)}>
                <option value={item.status}>{item.status.replace("_", " ")}</option>
                <option value="in_progress">In progress</option>
                <option value="resolved">Resolved</option>
              </select>
            </label>
          </article>
        ))}
      </section>
    </main>
  );
}
