"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Complaint = {
  id: string;
  student_id: string;
  title: string;
  description: string;
  location: string;
  status: "submitted" | "assigned" | "in_progress" | "resolved" | "closed" | "rejected";
  created_at: string;
  updated_at: string;
  department_id?: string | null;
  priority?: "normal" | "high" | "critical";
  assigned_staff_id?: string | null;
  student?: { name: string; email: string } | null;
  images?: { id: string; storage_path: string; signed_url?: string | null; content_type?: string | null }[];
};

const statuses = ["all", "submitted", "assigned", "in_progress", "resolved", "closed", "rejected"] as const;
const priorities = ["normal", "high", "critical"] as const;
type Department = { id: string; name: string; code: string };
type StaffMember = { id: string; name: string | null; email: string; role: string };

export default function AdminPage() {
  const [sessionReady, setSessionReady] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [selected, setSelected] = useState<Complaint | null>(null);
  const [filter, setFilter] = useState<(typeof statuses)[number]>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);

  useEffect(() => {
    const boot = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setSessionReady(true);
        return;
      }

      setUserEmail(data.session.user.email ?? "");
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.session.user.id)
        .single();

      setIsAdmin(profile?.role === "admin");
      setSessionReady(true);
      if (profile?.role === "admin") {
        await loadDepartments();
        await loadStaff();
        await loadComplaints();
      }
      else setLoading(false);
    };

    boot();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, next) => {
      if (!next) {
        setIsAdmin(false);
        setUserEmail("");
        setComplaints([]);
        setSelected(null);
        return;
      }
      setUserEmail(next.user.email ?? "");
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const loadStaff = async () => {
    const { data, error } = await supabase.from("profiles").select("id, name, email, role").in("role", ["staff", "department_head", "admin"]).order("name");
    if (error) {
      setMessage(error.message);
      return;
    }
    setStaff(data ?? []);
  };

  const loadDepartments = async () => {
    const { data, error } = await supabase.from("departments").select("id, name, code").order("name");
    if (error) {
      setMessage(error.message);
      return;
    }
    setDepartments(data ?? []);
  };

  const loadComplaints = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("complaints")
      .select("id, student_id, title, description, location, status, priority, department_id, assigned_staff_id, created_at, updated_at, profiles!complaints_student_id_fkey(name, email), complaint_images(id, storage_path, content_type)")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    const mapped = await Promise.all((data ?? []).map(async (item: any) => {
      const rawImages = Array.isArray(item.complaint_images) ? item.complaint_images : [];
      const images = await Promise.all(rawImages.map(async (image: any) => {
        const { data: signed } = await supabase.storage.from("complaint-evidence").createSignedUrl(image.storage_path, 3600);
        return { ...image, signed_url: signed?.signedUrl ?? null };
      }));
      return {
        ...item,
        student: Array.isArray(item.profiles) ? item.profiles[0] ?? null : item.profiles ?? null,
        images,
      };
    })) as Complaint[];

    setComplaints(mapped);
    setSelected((current) => current ? mapped.find((x) => x.id === current.id) ?? null : null);
    setLoading(false);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return complaints.filter((item) => {
      const statusMatch = filter === "all" || item.status === filter;
      const text = [item.title, item.description, item.location, item.student?.name, item.student?.email].join(" ").toLowerCase();
      return statusMatch && (!q || text.includes(q));
    });
  }, [complaints, filter, query]);

  const updateStatus = async (status: Complaint["status"]) => {
    if (!selected) return;
    setMessage("");

    const { data, error } = await supabase
      .from("complaints")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", selected.id)
      .select("id, student_id, title, description, location, status, priority, department_id, assigned_staff_id, created_at, updated_at, profiles!complaints_student_id_fkey(name, email), complaint_images(id, storage_path, content_type)")
      .single();

    if (error) {
      setMessage(error.message);
      return;
    }

    const rawImages = Array.isArray((data as any).complaint_images) ? (data as any).complaint_images : [];
    const images = await Promise.all(rawImages.map(async (image: any) => {
      const { data: signed } = await supabase.storage.from("complaint-evidence").createSignedUrl(image.storage_path, 3600);
      return { ...image, signed_url: signed?.signedUrl ?? null };
    }));
    const updated = {
      ...data,
      student: Array.isArray((data as any).profiles) ? (data as any).profiles[0] ?? null : (data as any).profiles ?? null,
      images,
    } as Complaint;

    setComplaints((items) => items.map((item) => item.id === updated.id ? updated : item));
    setSelected(updated);
    setMessage("Complaint status updated.");
  };

  const updateRouting = async (changes: { priority?: Complaint["priority"]; department_id?: string | null }) => {
    if (!selected) return;
    setMessage("");
    const { data, error } = await supabase
      .from("complaints")
      .update({ ...changes, updated_at: new Date().toISOString() })
      .eq("id", selected.id)
      .select("id, student_id, title, description, location, status, priority, department_id, created_at, updated_at, profiles!complaints_student_id_fkey(name, email), complaint_images(id, storage_path, content_type)")
      .single();

    if (error) {
      setMessage(error.message);
      return;
    }

    const rawImages = Array.isArray((data as any).complaint_images) ? (data as any).complaint_images : [];
    const images = await Promise.all(rawImages.map(async (image: any) => {
      const { data: signed } = await supabase.storage.from("complaint-evidence").createSignedUrl(image.storage_path, 3600);
      return { ...image, signed_url: signed?.signedUrl ?? null };
    }));
    const updated = {
      ...data,
      student: Array.isArray((data as any).profiles) ? (data as any).profiles[0] ?? null : (data as any).profiles ?? null,
      images,
    } as Complaint;
    setComplaints((items) => items.map((item) => item.id === updated.id ? updated : item));
    setSelected(updated);
    setMessage("Complaint routing updated.");
  };

  const assignStaff = async (staffId: string | null) => {
    if (!selected) return;
    setMessage("");
    const { data, error } = await supabase
      .from("complaints")
      .update({ assigned_staff_id: staffId, updated_at: new Date().toISOString() })
      .eq("id", selected.id)
      .select("id, student_id, title, description, location, status, priority, department_id, assigned_staff_id, created_at, updated_at, profiles!complaints_student_id_fkey(name, email), complaint_images(id, storage_path, content_type)")
      .single();

    if (error) {
      setMessage(error.message);
      return;
    }

    if (staffId) {
      const { error: assignmentError } = await supabase.from("staff_assignments").insert({
        complaint_id: selected.id,
        staff_id: staffId,
        assigned_by: (await supabase.auth.getUser()).data.user?.id,
      });
      if (assignmentError) {
        setMessage(assignmentError.message);
        return;
      }
    }

    const rawImages = Array.isArray((data as any).complaint_images) ? (data as any).complaint_images : [];
    const images = await Promise.all(rawImages.map(async (image: any) => {
      const { data: signed } = await supabase.storage.from("complaint-evidence").createSignedUrl(image.storage_path, 3600);
      return { ...image, signed_url: signed?.signedUrl ?? null };
    }));
    const updated = {
      ...data,
      student: Array.isArray((data as any).profiles) ? (data as any).profiles[0] ?? null : (data as any).profiles ?? null,
      images,
    } as Complaint;
    setComplaints((items) => items.map((item) => item.id === updated.id ? updated : item));
    setSelected(updated);
    setMessage(staffId ? "Complaint assigned to staff." : "Staff assignment removed.");
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  if (!sessionReady) return <div className="center">Loading GrievX Admin...</div>;

  if (!isAdmin) {
    return <Login email={userEmail} onSignedIn={async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.session.user.id).single();
      setUserEmail(data.session.user.email ?? "");
      setIsAdmin(profile?.role === "admin");
      if (profile?.role === "admin") {
        await loadDepartments();
        await loadStaff();
        await loadComplaints();
      }
      else setMessage("This account is not an administrator.");
    }} />;
  }

  const counts = {
    total: complaints.length,
    submitted: complaints.filter((x) => x.status === "submitted").length,
    active: complaints.filter((x) => x.status === "assigned" || x.status === "in_progress").length,
    resolved: complaints.filter((x) => x.status === "resolved" || x.status === "closed").length,
  };

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand"><span className="brandMark">✓</span><span>GrievX</span></div>
        <div className="brandSub">CAMPUS ADMIN</div>
        <nav>
          <button className="navActive">Dashboard</button>
          <button onClick={() => setFilter("all")}>Complaints</button>
          <button onClick={() => setMessage("Analytics will be added in Week 11.")}>Analytics</button>
          <button onClick={() => setMessage("Department routing is available in the current Week 5 admin flow.")}>Departments</button>
        </nav>
        <div className="sideBottom">
          <div className="adminMini"><span className="avatar">A</span><span><b>Administrator</b><small>{userEmail}</small></span></div>
          <button className="logout" onClick={logout}>Sign out</button>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <span className="eyebrow">GRIEVX CAMPUS</span>
            <h1>Complaint Management</h1>
            <p>Review, assign and update student complaints from one place.</p>
          </div>
          <div className="topActions">
            <span className="secure">● Admin access</span>
            <button className="refresh" onClick={loadComplaints}>Refresh</button>
          </div>
        </header>

        {message && <div className="notice">{message}</div>}

        <div className="stats">
          <Stat label="Total complaints" value={counts.total} />
          <Stat label="New submissions" value={counts.submitted} />
          <Stat label="Active" value={counts.active} />
          <Stat label="Resolved / closed" value={counts.resolved} />
        </div>

        <div className="workspace">
          <section className="listPanel">
            <div className="listToolbar">
              <div className="filters">
                {statuses.map((status) => (
                  <button key={status} className={filter === status ? "filter active" : "filter"} onClick={() => setFilter(status)}>
                    {status === "all" ? "All" : status.replace("_", " ")}
                  </button>
                ))}
              </div>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search complaints..." />
            </div>

            {loading ? <div className="empty">Loading complaints...</div> : filtered.length === 0 ? (
              <div className="empty">No complaints match the current filter.</div>
            ) : (
              <div className="table">
                {filtered.map((item) => (
                  <button key={item.id} className={selected?.id === item.id ? "complaintRow selected" : "complaintRow"} onClick={() => setSelected(item)}>
                    <div className="rowMain">
                      <Status status={item.status} />
                      <strong>{item.title}</strong>
                      <span>{item.location}</span>
                    </div>
                    <div className="rowMeta">
                      <span>{item.student?.name ?? "Student"}</span>
                      <span>{formatDate(item.created_at)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <aside className="detailPanel">
            {selected ? (
              <>
                <div className="detailHeader">
                  <div>
                    <span className="eyebrow">COMPLAINT DETAILS</span>
                    <h2>{selected.title}</h2>
                  </div>
                  <Status status={selected.status} />
                </div>

                <div className="detailSection">
                  <label>Student</label>
                  <strong>{selected.student?.name ?? "Student"}</strong>
                  <span>{selected.student?.email ?? selected.student_id}</span>
                </div>
                <div className="detailSection">
                  <label>Campus location</label>
                  <strong>{selected.location}</strong>
                </div>
                <div className="detailSection">
                  <label>Description</label>
                  <p>{selected.description}</p>
                </div>
                <div className="detailSection">
                  <label>Submitted</label>
                  <span>{formatDate(selected.created_at)}</span>
                </div>

                <div className="detailSection">
                  <label>Evidence</label>
                  {selected.images?.length ? (
                    <div className="evidenceGrid">
                      {selected.images.map((image) => image.signed_url ? (
                        <a key={image.id} href={image.signed_url} target="_blank" rel="noreferrer">
                          <img className="evidenceImage" src={image.signed_url} alt="Complaint evidence" />
                        </a>
                      ) : <span key={image.id}>Evidence file is unavailable.</span>)}
                    </div>
                  ) : <span>No evidence photo attached.</span>}
                </div>

                <div className="detailSection">
                  <label>Priority</label>
                  <div className="statusButtons">
                    {priorities.map((priority) => (
                      <button key={priority} className={selected.priority === priority ? "statusButton current" : "statusButton"} onClick={() => updateRouting({ priority })}>
                        {priority}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="detailSection">
                  <label>Department</label>
                  <select className="departmentSelect" value={selected.department_id ?? ""} onChange={(e) => updateRouting({ department_id: e.target.value || null })}>
                    <option value="">Unassigned</option>
                    {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                  </select>
                </div>

                <div className="detailSection">
                  <label>Assigned staff</label>
                  <select className="departmentSelect" value={selected.assigned_staff_id ?? ""} onChange={(e) => assignStaff(e.target.value || null)}>
                    <option value="">Unassigned</option>
                    {staff.map((member) => <option key={member.id} value={member.id}>{member.name || member.email} ({member.role.replace("_", " ")})</option>)}
                  </select>
                  {staff.length === 0 && <span>No staff accounts are available yet.</span>}
                </div>

                <div className="statusEditor">
                  <label>Update lifecycle status</label>
                  <div className="statusButtons">
                    {statuses.filter((x) => x !== "all").map((status) => (
                      <button
                        key={status}
                        className={selected.status === status ? "statusButton current" : "statusButton"}
                        onClick={() => updateStatus(status)}
                      >
                        {status.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="detailEmpty">
                <div className="detailIcon">▤</div>
                <h2>Select a complaint</h2>
                <p>Choose a complaint from the list to inspect it and manage its lifecycle status.</p>
              </div>
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}

function Login({ email, onSignedIn }: { email: string; onSignedIn: () => void }) {
  const [value, setValue] = useState(email);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    try {
      setBusy(true);
      setError("");
      const { error: authError } = await supabase.auth.signInWithPassword({ email: value.trim(), password });
      if (authError) throw new Error(authError.message);
      await onSignedIn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="loginShell">
      <div className="loginCard">
        <div className="brand centeredBrand"><span className="brandMark">✓</span><span>GrievX</span></div>
        <span className="eyebrow">CAMPUS ADMIN PORTAL</span>
        <h1>Welcome back</h1>
        <p>Sign in with an administrator account to manage student complaints.</p>
        <label>Email</label>
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="admin@university.edu" autoComplete="email" />
        <label>Password</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" type="password" autoComplete="current-password" />
        {error && <div className="error">{error}</div>}
        <button className="loginButton" onClick={submit} disabled={busy}>{busy ? "Signing in..." : "Sign in to Admin Portal"}</button>
        <small>Only profiles with the <b>admin</b> role can access complaint management.</small>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="statCard"><span>{label}</span><strong>{value}</strong></div>;
}

function Status({ status }: { status: Complaint["status"] }) {
  return <span className={`status status-${status}`}><i />{status.replace("_", " ")}</span>;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
