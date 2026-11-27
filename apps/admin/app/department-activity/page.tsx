"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Department = { id: string; name: string; code: string };
type Complaint = { department_id: string | null; status: string; priority: string };

export default function DepartmentActivityPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [message, setMessage] = useState("Checking administrator access...");
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { if (active) setMessage("Sign in through the main administrator dashboard first."); return; }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", auth.user.id).single();
      if (!active) return;
      if (profile?.role !== "admin") { setMessage("Only campus administrators can view department-wide activity."); return; }
      const [d, c] = await Promise.all([
        supabase.from("departments").select("id, name, code").order("name"),
        supabase.from("complaints").select("department_id, status, priority"),
      ]);
      if (!active) return;
      if (d.error || c.error) { setMessage(d.error?.message ?? c.error?.message ?? "Unable to load department activity."); return; }
      setDepartments((d.data ?? []) as Department[]);
      setComplaints((c.data ?? []) as Complaint[]);
      setAllowed(true); setMessage("");
    };
    void load();
    return () => { active = false; };
  }, []);

  return <main style={{ maxWidth: 1100, margin: "36px auto", padding: 24, fontFamily: "Arial,sans-serif", color: "#17233B" }}>
    <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
      <div><p style={{ color: "#315DB8", fontWeight: 800 }}>GRIEVX · ADMINISTRATION</p><h1>Department activity</h1>
        <p>Monitor automatically routed complaints across all campus departments.</p></div>
      <a href="/">Back to admin dashboard</a>
    </header>
    {message && <p role="status">{message}</p>}
    {allowed && <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12, margin: "24px 0" }}>
        <Metric label="Total complaints" value={complaints.length}/>
        <Metric label="Unrouted" value={complaints.filter(x => !x.department_id).length}/>
        <Metric label="Critical" value={complaints.filter(x => x.priority === "critical").length}/>
        <Metric label="In progress" value={complaints.filter(x => x.status === "in_progress").length}/>
      </div>
      <section style={{ display: "grid", gap: 12 }}>
        {departments.map(d => {
          const items = complaints.filter(c => c.department_id === d.id);
          return <article key={d.id} style={{ border: "1px solid #dce3ef", borderRadius: 12, padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div><h2 style={{ margin: 0 }}>{d.name}</h2><small>{d.code}</small></div>
              <strong>{items.length} complaints</strong>
            </div>
            <p style={{ color: "#64748b" }}>
              {items.filter(x => ["submitted", "assigned"].includes(x.status)).length} pending · {items.filter(x => x.status === "in_progress").length} in progress · {items.filter(x => ["resolved", "closed"].includes(x.status)).length} resolved · {items.filter(x => x.priority === "critical").length} critical
            </p>
          </article>;
        })}
      </section>
    </>}
  </main>;
}
function Metric({ label, value }: { label: string; value: number }) {
  return <div style={{ padding: 18, background: "#f4f7fb", borderRadius: 12, display: "grid", gap: 8 }}>
    <small>{label}</small><strong style={{ fontSize: 28 }}>{value}</strong>
  </div>;
}
