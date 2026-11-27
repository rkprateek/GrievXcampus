"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";

type Profile = { role: string; department_id: string | null };
type Department = { id: string; name: string; code: string };
type Complaint = {
  id: string;
  title: string;
  description: string;
  location: string;
  status: string;
  priority: string;
  category: string | null;
  category_confidence: number | null;
  department_confidence: number | null;
  created_at: string;
  assigned_staff_id: string | null;
};

const STATUS_OPTIONS = ["submitted", "assigned", "in_progress", "resolved", "closed"];

export default function DepartmentHome() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [department, setDepartment] = useState<Department | null>(null);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [authenticated, setAuthenticated] = useState(false);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setMessage("");
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setAuthenticated(false);
      setLoading(false);
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("role, department_id")
      .eq("id", authData.user.id)
      .single();

    if (profileError || !profileData || !["department_head", "staff"].includes(profileData.role)) {
      await supabase.auth.signOut();
      setAuthenticated(false);
      setMessage("This account does not have department portal access. Please use a department staff or department head account.");
      setLoading(false);
      return;
    }

    if (!profileData.department_id) {
      setAuthenticated(false);
      setMessage("Your account is not linked to a department. Please contact the GrievX administrator.");
      setLoading(false);
      return;
    }

    const { data: departmentData, error: departmentError } = await supabase
      .from("departments")
      .select("id, name, code")
      .eq("id", profileData.department_id)
      .single();

    if (departmentError || !departmentData) {
      setAuthenticated(false);
      setMessage("We could not find your department. Please contact the GrievX administrator.");
      setLoading(false);
      return;
    }

    const { data: complaintData, error: complaintError } = await supabase
      .from("complaints")
      .select("id, title, description, location, status, priority, category, category_confidence, department_confidence, created_at, assigned_staff_id")
      .eq("department_id", profileData.department_id)
      .order("created_at", { ascending: false });

    if (complaintError) {
      setMessage(complaintError.message);
      setAuthenticated(false);
      setLoading(false);
      return;
    }

    setProfile(profileData as Profile);
    setDepartment(departmentData as Department);
    setComplaints((complaintData ?? []) as Complaint[]);
    setAuthenticated(true);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadWorkspace();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setAuthenticated(false);
        setProfile(null);
        setDepartment(null);
        setComplaints([]);
      }
    });
    return () => data.subscription.unsubscribe();
  }, [loadWorkspace]);

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setMessage(error.message);
      setSubmitting(false);
      return;
    }
    await loadWorkspace();
    setSubmitting(false);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setDepartment(null);
    setComplaints([]);
    setAuthenticated(false);
  };

  const changeStatus = async (complaint: Complaint, nextStatus: string) => {
    const previousStatus = complaint.status;
    setComplaints(current => current.map(item => item.id === complaint.id ? { ...item, status: nextStatus } : item));
    const { error } = await supabase.from("complaints")
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq("id", complaint.id)
      .eq("department_id", department?.id ?? "");
    if (error) {
      setComplaints(current => current.map(item => item.id === complaint.id ? { ...item, status: previousStatus } : item));
      setMessage("Could not update status: " + error.message);
    } else {
      setMessage("Complaint status updated.");
    }
  };

  const visibleComplaints = useMemo(() => complaints.filter(item => {
    const matchesStatus = filter === "all" || item.status === filter;
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || [item.title, item.description, item.location, item.category ?? ""].some(value => value.toLowerCase().includes(term));
    return matchesStatus && matchesSearch;
  }), [complaints, filter, search]);

  const pending = complaints.filter(item => ["submitted", "assigned"].includes(item.status)).length;
  const inProgress = complaints.filter(item => item.status === "in_progress").length;
  const resolved = complaints.filter(item => ["resolved", "closed"].includes(item.status)).length;

  if (loading) return <main className="loading">Loading your department workspace…</main>;

  if (!authenticated) return (
    <main className="loginWrap">
      <section className="loginVisual">
        <div className="brand"><span className="brandMark">G</span> GrievX</div>
        <div className="visualCopy">
          <div className="eyebrow">CAMPUS ISSUE MANAGEMENT</div>
          <h1>Make every campus issue one step closer to solved.</h1>
          <p>A focused workspace for department teams to review incoming complaints, coordinate work and keep students informed.</p>
        </div>
        <div className="visualFoot">GrievX · Department workspace</div>
      </section>
      <section className="loginSide">
        <form className="loginCard" onSubmit={signIn}>
          <div className="eyebrow">DEPARTMENT ACCESS</div>
          <h2>Welcome back</h2>
          <p>Sign in with the account created for your department by the GrievX administrator.</p>
          {message && <div className="message error" role="alert">{message}</div>}
          <div className="field"><label htmlFor="email">Email address</label><input id="email" type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} placeholder="name@campus.edu" /></div>
          <div className="field"><label htmlFor="password">Password</label><input id="password" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} placeholder="Enter your password" /></div>
          <button className="primary" disabled={submitting}>{submitting ? "Signing in…" : "Sign in to department portal"}</button>
        </form>
      </section>
    </main>
  );

  return (
    <main className="page">
      <div className="dashboard">
        <header className="topbar">
          <div className="topbarLeft">
            <div className="brand"><span className="brandMark">G</span> GrievX</div>
            <div className="deptLabel">Department workspace · {department?.name ?? "Department"}</div>
          </div>
          <div className="topActions">
            <span className="userPill">{profile?.role.replace("_", " ")}</span>
            <button className="outline" onClick={signOut}>Sign out</button>
          </div>
        </header>

        <section className="heading">
          <div className="eyebrow">{department?.code ?? "DEPARTMENT"} WORKSPACE</div>
          <h1>Complaint overview</h1>
          <p>Review complaints routed to your department and keep their progress up to date.</p>
        </section>

        <section className="stats">
          <div className="stat"><span>Total complaints</span><strong>{complaints.length}</strong><small>All complaints routed here</small></div>
          <div className="stat"><span>Pending review</span><strong>{pending}</strong><small>Submitted or assigned</small></div>
          <div className="stat"><span>In progress</span><strong>{inProgress}</strong><small>Currently being handled</small></div>
          <div className="stat"><span>Resolved</span><strong>{resolved}</strong><small>Resolved or closed</small></div>
        </section>

        <section className="panel">
          <div className="panelHead">
            <h2>Department complaint inbox</h2>
            <div className="tools">
              <input className="search" aria-label="Search complaints" placeholder="Search complaints…" value={search} onChange={event => setSearch(event.target.value)} />
              <select className="filterSelect" aria-label="Filter by status" value={filter} onChange={event => setFilter(event.target.value)}>
                <option value="all">All statuses</option>
                {STATUS_OPTIONS.map(status => <option key={status} value={status}>{status.replace("_", " ")}</option>)}
              </select>
              <button className="outline" onClick={() => void loadWorkspace()}>Refresh</button>
            </div>
          </div>

          {message && <div className="message" style={{ margin: 16 }}>{message}</div>}
          {visibleComplaints.length === 0 ? (
            <div className="empty">{complaints.length === 0 ? "No complaints have been routed to this department yet." : "No complaints match your search or filter."}</div>
          ) : (
            <div className="complaintList">
              {visibleComplaints.map(complaint => (
                <article className="complaint" key={complaint.id}>
                  <div className="complaintTop">
                    <div>
                      <div className="complaintTitle">{complaint.title}</div>
                      <div className="meta">{complaint.location} · {new Date(complaint.created_at).toLocaleString()}</div>
                    </div>
                    <div className="badges">
                      <span className={`badge priority-${complaint.priority.toLowerCase()}`}>{complaint.priority} priority</span>
                      <span className={`badge status-${complaint.status}`}>{complaint.status.replace("_", " ")}</span>
                    </div>
                  </div>
                  <p className="description">{complaint.description}</p>
                  <div className="complaintBottom">
                    <div className="details">
                      <span>Category: <b>{complaint.category ?? "Not classified"}</b></span>
                      <span>Category confidence: <b>{complaint.category_confidence == null ? "—" : `${(complaint.category_confidence * 100).toFixed(0)}%`}</b></span>
                      <span>Routing confidence: <b>{complaint.department_confidence == null ? "Fallback" : `${(complaint.department_confidence * 100).toFixed(0)}%`}</b></span>
                    </div>
                    <div className="statusControl">
                      <label htmlFor={`status-${complaint.id}`}>Update status</label>
                      <select id={`status-${complaint.id}`} value={complaint.status} onChange={event => void changeStatus(complaint, event.target.value)}>
                        {Array.from(new Set([complaint.status, ...STATUS_OPTIONS])).map(status => <option key={status} value={status}>{status.replace("_", " ")}</option>)}
                      </select>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
