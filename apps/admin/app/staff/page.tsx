"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Department = { id: string; name: string; code?: string };
type Member = { id: string; name: string | null; email: string; role: string; department_id: string | null };

export default function StaffDirectoryPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [message, setMessage] = useState("Checking administrator access...");
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"department_head" | "staff">("department_head");
  const [departmentId, setDepartmentId] = useState("");

  const load = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setAllowed(false);
      setMessage("Sign in as an administrator from the main dashboard first.");
      return;
    }
    const { data: profile, error: profileError } = await supabase.from("profiles")
      .select("role").eq("id", sessionData.session.user.id).single();
    if (profileError || profile?.role !== "admin") {
      setAllowed(false);
      setMessage("Only administrators can create department accounts and manage assignments.");
      return;
    }
    setAllowed(true);
    const [memberResult, departmentResult] = await Promise.all([
      supabase.from("profiles").select("id, name, email, role, department_id")
        .in("role", ["staff", "department_head"]).order("name"),
      supabase.from("departments").select("id, name, code").order("name"),
    ]);
    if (memberResult.error || departmentResult.error) {
      setMessage(memberResult.error?.message ?? departmentResult.error?.message ?? "Unable to load directory.");
      return;
    }
    setMembers((memberResult.data ?? []) as Member[]);
    setDepartments((departmentResult.data ?? []) as Department[]);
    setDepartmentId(current => current || departmentResult.data?.[0]?.id || "");
    setMessage("");
  };

  useEffect(() => { void load(); }, []);

  const createAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!departmentId) { setMessage("Select a department before creating the account."); return; }
    setLoading(true);
    setMessage("");
    const { data, error } = await supabase.functions.invoke("admin-create-department-user", {
      body: { name: name.trim(), email: email.trim().toLowerCase(), role, department_id: departmentId },
    });
    if (error) {
      setMessage(error.message || "Unable to create department account.");
      setLoading(false);
      return;
    }
    if (data?.error) {
      setMessage(data.error);
      setLoading(false);
      return;
    }
    setMessage(`Invitation sent to ${email.trim()}. The user must accept it and set a password before signing in.`);
    setName("");
    setEmail("");
    await load();
    setLoading(false);
  };

  const assignDepartment = async (memberId: string, nextDepartmentId: string) => {
    const { error } = await supabase.from("profiles")
      .update({ department_id: nextDepartmentId || null }).eq("id", memberId);
    if (error) { setMessage(error.message); return; }
    setMembers(items => items.map(item => item.id === memberId
      ? { ...item, department_id: nextDepartmentId || null } : item));
    setMessage("Department membership saved.");
  };

  return (
    <main style={styles.shell}>
      <header>
        <p style={styles.eyebrow}>GRIEVX CAMPUS · ADMINISTRATION</p>
        <h1 style={styles.heading}>Department account management</h1>
        <p style={styles.subheading}>Invite department heads and staff, then assign them to the department whose complaints they handle.</p>
        <a href="/">← Return to the main dashboard</a>
      </header>
      {message && <p role="status" style={styles.notice}>{message}</p>}
      {allowed && <>
        <form onSubmit={createAccount} style={styles.panel}>
          <h2 style={styles.sectionHeading}>Create a department account</h2>
          <p style={styles.subheading}>An invitation email will be sent. The user creates their own password through the invitation.</p>
          <div style={styles.formGrid}>
            <label style={styles.field}>Full name
              <input required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Electrical Department Head" style={styles.input} />
            </label>
            <label style={styles.field}>Email address
              <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@university.edu" style={styles.input} />
            </label>
            <label style={styles.field}>Account role
              <select value={role} onChange={e => setRole(e.target.value as "department_head" | "staff")} style={styles.input}>
                <option value="department_head">Department head</option>
                <option value="staff">Staff member</option>
              </select>
            </label>
            <label style={styles.field}>Department
              <select required value={departmentId} onChange={e => setDepartmentId(e.target.value)} style={styles.input}>
                <option value="">Select department</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}{d.code ? ` (${d.code})` : ""}</option>)}
              </select>
            </label>
          </div>
          <button disabled={loading || !departments.length} style={styles.primary}>
            {loading ? "Sending invitation..." : "Create account and send invitation"}
          </button>
          {!departments.length && <p style={styles.warning}>No departments found. Add departments before inviting users.</p>}
        </form>
        <section style={styles.panel}>
          <h2 style={styles.sectionHeading}>Existing department accounts</h2>
          {members.length === 0 ? <p style={styles.subheading}>No department accounts have been created yet.</p> : members.map(member => (
            <article key={member.id} style={styles.member}>
              <div>
                <strong>{member.name || member.email}</strong>
                <div style={styles.memberMeta}>{member.email} · {member.role.replace("_", " ")}</div>
              </div>
              <label style={styles.assignment}>Department
                <select aria-label={"Department for " + member.email} value={member.department_id ?? ""}
                  onChange={event => void assignDepartment(member.id, event.target.value)} style={styles.input}>
                  <option value="">No department</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </label>
            </article>
          ))}
        </section>
      </>}
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: { maxWidth: 1000, margin: "36px auto", padding: 24, color: "#17233B", fontFamily: "Arial, sans-serif" },
  eyebrow: { color: "#315DB8", fontWeight: 800, letterSpacing: ".06em", fontSize: 13 },
  heading: { marginBottom: 8, fontSize: 30 },
  sectionHeading: { margin: "0 0 8px", fontSize: 20 },
  subheading: { color: "#64718A", lineHeight: 1.5 },
  panel: { marginTop: 24, padding: 22, border: "1px solid #DDE3EE", borderRadius: 14, background: "white" },
  notice: { padding: 12, borderRadius: 8, background: "#EFF5FF", color: "#234987" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16, margin: "20px 0" },
  field: { display: "grid", gap: 7, fontWeight: 700, fontSize: 14 },
  input: { width: "100%", boxSizing: "border-box", padding: 11, border: "1px solid #CBD5E1", borderRadius: 8, background: "white", color: "#17233B" },
  primary: { padding: "12px 18px", border: 0, borderRadius: 8, background: "#315DB8", color: "white", fontWeight: 700, cursor: "pointer" },
  warning: { color: "#9A5B00" },
  member: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 18, padding: "15px 0", borderTop: "1px solid #E8EDF5" },
  memberMeta: { color: "#64718A", fontSize: 13, marginTop: 5 },
  assignment: { display: "grid", gap: 6, minWidth: 220, fontSize: 13, fontWeight: 700 },
};
