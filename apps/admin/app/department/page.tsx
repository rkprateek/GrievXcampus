"use client";

import { type CSSProperties, type FormEvent, useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Profile = { role: string; department_id: string | null };
type Department = { id: string; name: string; code: string };
type Complaint = {
  id: string; title: string; description: string; location: string;
  status: string; priority: string; category: string | null;
  category_confidence: number | null; department_confidence: number | null;
  created_at: string; assigned_staff_id: string | null;
};
const STATUSES = ["assigned", "in_progress", "resolved", "closed"];

export default function DepartmentPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [department, setDepartment] = useState<Department | null>(null);
  const [rows, setRows] = useState<Complaint[]>([]);
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Sign in with your department account.");

  const loadWorkspace = useCallback(async () => {
    setBusy(true); setMessage("");
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setSignedIn(false); setBusy(false); return; }
    const { data: p, error: profileError } = await supabase.from("profiles")
      .select("role, department_id").eq("id", auth.user.id).single();
    if (profileError || !p || !["department_head", "staff", "admin"].includes(p.role)) {
      setMessage("This account does not have department portal access.");
      await supabase.auth.signOut(); setSignedIn(false); setBusy(false); return;
    }
    if (p.role !== "admin" && !p.department_id) {
      setMessage("Your account is not assigned to a department yet. Contact the campus administrator.");
      setBusy(false); return;
    }
    setProfile(p as Profile);
    if (p.department_id) {
      const { data: d } = await supabase.from("departments").select("id, name, code").eq("id", p.department_id).maybeSingle();
      setDepartment((d as Department | null) ?? null);
    } else setDepartment({ id: "", name: "All departments", code: "ALL" });
    let query = supabase.from("complaints")
      .select("id, title, description, location, status, priority, category, category_confidence, department_confidence, created_at, assigned_staff_id")
      .order("created_at", { ascending: false });
    if (p.role !== "admin" && p.department_id) query = query.eq("department_id", p.department_id);
    const { data, error } = await query;
    if (error) setMessage(error.message); else setRows((data ?? []) as Complaint[]);
    setSignedIn(true); setBusy(false);
  }, []);

  useEffect(() => {
    void loadWorkspace();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) { setSignedIn(false); setProfile(null); setDepartment(null); setRows([]); }
    });
    return () => listener.subscription.unsubscribe();
  }, [loadWorkspace]);

  const login = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) { setMessage(error.message); setBusy(false); return; }
    await loadWorkspace();
  };
  const updateStatus = async (complaint: Complaint, status: string) => {
    setMessage("");
    const { error } = await supabase.from("complaints")
      .update({ status, updated_at: new Date().toISOString() }).eq("id", complaint.id);
    if (error) { setMessage(error.message); return; }
    setRows(items => items.map(item => item.id === complaint.id ? { ...item, status } : item));
    setMessage("Complaint status updated.");
  };
  const logout = async () => { await supabase.auth.signOut(); setSignedIn(false); setProfile(null); setRows([]); };

  if (!signedIn) return (
    <main style={styles.shell}><form onSubmit={login} style={styles.login}>
      <div style={styles.brand}>GrievX · Department Portal</div><h1>Department sign in</h1>
      <p>Use the account assigned to your campus department.</p>
      <label style={styles.label}>Email</label><input style={styles.input} type="email" required value={email} onChange={e => setEmail(e.target.value)} />
      <label style={styles.label}>Password</label><input style={styles.input} type="password" required value={password} onChange={e => setPassword(e.target.value)} />
      {message && <p role="status">{message}</p>}
      <button style={styles.primary} disabled={busy}>{busy ? "Signing in..." : "Sign in"}</button>
      <a href="/">Main administrator dashboard</a>
    </form></main>
  );

  const visible = rows.filter(row => filter === "all" || row.status === filter);
  const pending = rows.filter(row => ["submitted", "assigned"].includes(row.status)).length;
  const active = rows.filter(row => row.status === "in_progress").length;
  const resolved = rows.filter(row => ["resolved", "closed"].includes(row.status)).length;
  return <main style={styles.shell}>
    <header style={styles.header}><div><div style={styles.brand}>GrievX · Department Portal</div><h1>{department?.name ?? "Department workspace"}</h1>
      <p>{profile?.role?.replace("_", " ")} · Complaints routed to your department</p></div><button style={styles.secondary} onClick={logout}>Sign out</button></header>
    <section style={styles.stats}><Stat label="Total complaints" value={rows.length}/><Stat label="Pending" value={pending}/><Stat label="In progress" value={active}/><Stat label="Resolved" value={resolved}/></section>
    <section style={styles.panel}><div style={styles.toolbar}><h2>Department complaint inbox</h2>
      <select style={styles.select} value={filter} onChange={e => setFilter(e.target.value)}>
        {["all", "submitted", "assigned", "in_progress", "resolved", "closed"].map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
      </select></div>
      {message && <p role="status">{message}</p>}
      {busy ? <p>Loading complaints...</p> : visible.length === 0 ? <p>No complaints in this view.</p> : visible.map(item =>
        <article key={item.id} style={styles.card}><div style={styles.toolbar}><div><h3>{item.title}</h3><small>{item.location} · {new Date(item.created_at).toLocaleString()}</small></div><strong>{item.priority.toUpperCase()}</strong></div>
          <p>{item.description}</p><p><b>Category:</b> {item.category ?? "Not classified"} · <b>Status:</b> {item.status.replace("_", " ")}</p>
          <p><b>Category confidence:</b> {item.category_confidence == null ? "Unavailable" : (item.category_confidence * 100).toFixed(1) + "%"} · <b>Routing confidence:</b> {item.department_confidence == null ? "Fallback" : (item.department_confidence * 100).toFixed(1) + "%"}</p>
          <label style={styles.label}>Update status</label><select style={styles.select} value={item.status} onChange={e => void updateStatus(item, e.target.value)}>
            {[item.status, ...STATUSES.filter(s => s !== item.status)].map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
        </article>)}
    </section>
  </main>;
}
function Stat({ label, value }: { label: string; value: number }) {
  return <div style={styles.stat}><small>{label}</small><strong>{value}</strong></div>;
}
const styles: Record<string, CSSProperties> = {
  shell: { maxWidth: 1180, margin: "0 auto", padding: 28, color: "#17233B", fontFamily: "Arial, sans-serif" },
  login: { maxWidth: 420, margin: "10vh auto", padding: 28, border: "1px solid #dce3ef", borderRadius: 16, display: "grid", gap: 12 },
  brand: { color: "#315DB8", fontWeight: 800, letterSpacing: ".04em" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 24 },
  label: { display: "block", fontWeight: 700, marginTop: 8 },
  input: { padding: 12, border: "1px solid #cbd5e1", borderRadius: 8, width: "100%", boxSizing: "border-box" },
  select: { padding: 10, border: "1px solid #cbd5e1", borderRadius: 8, background: "white" },
  primary: { padding: 12, border: 0, borderRadius: 8, background: "#315DB8", color: "white", fontWeight: 700, cursor: "pointer" },
  secondary: { padding: 10, border: "1px solid #cbd5e1", borderRadius: 8, background: "white", cursor: "pointer" },
  stats: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 20 },
  stat: { padding: 18, background: "#f4f7fb", borderRadius: 12, display: "grid", gap: 8 },
  panel: { border: "1px solid #dce3ef", borderRadius: 14, padding: 20 },
  toolbar: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" },
  card: { border: "1px solid #e2e8f0", borderRadius: 12, padding: 18, marginTop: 14 },
};