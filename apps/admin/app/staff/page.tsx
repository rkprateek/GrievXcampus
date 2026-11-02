"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Department = { id: string; name: string };
type Member = { id: string; name: string | null; email: string; role: string; department_id: string | null };

export default function StaffDirectoryPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [message, setMessage] = useState("Loading staff directory...");
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        if (active) setMessage("Sign in as an administrator from the main dashboard first.");
        return;
      }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", sessionData.session.user.id).single();
      if (!active) return;
      if (profile?.role !== "admin") {
        setMessage("Only administrators can manage staff department membership.");
        return;
      }
      setAllowed(true);
      const [memberResult, departmentResult] = await Promise.all([
        supabase.from("profiles").select("id, name, email, role, department_id").in("role", ["staff", "department_head"]).order("name"),
        supabase.from("departments").select("id, name").order("name"),
      ]);
      if (!active) return;
      if (memberResult.error || departmentResult.error) {
        setMessage(memberResult.error?.message ?? departmentResult.error?.message ?? "Unable to load directory.");
        return;
      }
      setMembers((memberResult.data ?? []) as Member[]);
      setDepartments((departmentResult.data ?? []) as Department[]);
      setMessage("");
    };
    void load();
    return () => { active = false; };
  }, []);

  const assignDepartment = async (memberId: string, departmentId: string) => {
    const { error } = await supabase.from("profiles").update({ department_id: departmentId || null }).eq("id", memberId);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMembers((items) => items.map((item) => item.id === memberId ? { ...item, department_id: departmentId || null } : item));
    setMessage("Department membership saved.");
  };

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: 20, fontFamily: "Arial, sans-serif", color: "#17233B" }}>
      <p style={{ color: "#315DB8", fontWeight: 700 }}>GRIEVX CAMPUS · ADMINISTRATION</p>
      <h1>Staff department assignments</h1>
      <p>Assign each staff member and department head to the correct campus department. These assignments control the scope of the department workspace.</p>
      <p><a href="/">Return to the main dashboard</a></p>
      {message && <p role="status">{message}</p>}
      {allowed && members.map((member) => (
        <section key={member.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: 16, border: "1px solid #DDE3EE", borderRadius: 10, marginBottom: 10, background: "white" }}>
          <div>
            <strong>{member.name || member.email}</strong>
            <div style={{ color: "#64718A", fontSize: 13 }}>{member.email} · {member.role.replace("_", " ")}</div>
          </div>
          <select aria-label={"Department for " + member.email} value={member.department_id ?? ""} onChange={(event) => void assignDepartment(member.id, event.target.value)}>
            <option value="">No department</option>
            {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
          </select>
        </section>
      ))}
    </main>
  );
}
