"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Complaint = {
  id: string;
  student_id: string;
  title: string;
  description: string;
  location: string;
  status: "submitted" | "assigned" | "in_progress" | "resolved" | "closed" | "rejected" | "withdrawn";
  created_at: string;
  updated_at: string;
  department_id?: string | null;
  suggested_department_id?: string | null;
  priority?: "normal" | "high" | "critical";
  category?: string | null;
  category_confidence?: number | null;
  priority_confidence?: number | null;
  department_confidence?: number | null;
  department_source?: string | null;
  upvote_count?: number;
  duplicate_of_id?: string | null;
  assigned_staff_id?: string | null;
  status_history?: { id: string; from_status: string | null; to_status: string; changed_by: string | null; note: string | null; created_at: string }[];
  student?: { name: string; email: string } | null;
  images?: { id: string; storage_path: string; signed_url?: string | null; content_type?: string | null }[];
};

const statuses = ["all", "submitted", "assigned", "in_progress", "resolved", "closed", "rejected", "withdrawn"] as const;
const priorities = ["normal", "high", "critical"] as const;
type Department = { id: string; name: string; code: string };
type StaffMember = { id: string; name: string | null; email: string; role: string };
type StaffDirectoryEntry = { staff_id: string; department_id: string; skills: string[]; is_available: boolean; max_active_assignments: number };
type MLPredictionRecord = {
  id: string; complaint_id: string; prediction_state: string;
  category: string | null; category_confidence: number | null;
  priority: string | null; priority_confidence: number | null;
  department_name: string | null; requires_manual_review: boolean;
  review_reason: string | null;
  created_at: string;
};
type MLHealth = { status: string; training_samples?: number; dataset?: string; models?: Record<string, string>; error?: string };
type MLMetrics = { category?: { accuracy: number; macro_f1: number }; priority?: { accuracy: number; macro_f1: number }; note?: string };


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
  const [staffDirectory, setStaffDirectory] = useState<StaffDirectoryEntry[]>([]);
  const [showStaffManager, setShowStaffManager] = useState(false);
  const [showMLInsights, setShowMLInsights] = useState(false);
  const [mlPredictions, setMlPredictions] = useState<MLPredictionRecord[]>([]);
  const [mlHealth, setMlHealth] = useState<MLHealth | null>(null);
  const [mlMetrics, setMlMetrics] = useState<MLMetrics | null>(null);
  const [mlLoading, setMlLoading] = useState(false);
  const [mlError, setMlError] = useState("");
  const [staffUserId, setStaffUserId] = useState("");
  const [staffDepartmentId, setStaffDepartmentId] = useState("");
  const [staffSkills, setStaffSkills] = useState("");
  const [staffAvailable, setStaffAvailable] = useState(true);
  const [staffCapacity, setStaffCapacity] = useState("10");
  const [staffSaving, setStaffSaving] = useState(false);

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
    const { data: directory, error: directoryError } = await supabase.from("staff_directory").select("staff_id, department_id, skills, is_available, max_active_assignments");
    if (directoryError) { setMessage(directoryError.message); return; }
    setStaffDirectory(directory ?? []);
  };


  const refreshMLInsights = async () => {
    setMlLoading(true);
    setMlError("");
    const { data, error } = await supabase
      .from("complaint_ml_predictions")
      .select("id, complaint_id, prediction_state, category, category_confidence, priority, priority_confidence, department_name, requires_manual_review, review_reason, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) setMlError(`Could not load prediction history: ${error.message}`);
    else setMlPredictions((data ?? []) as MLPredictionRecord[]);

    const baseUrl = process.env.NEXT_PUBLIC_GRIEVX_API_URL?.trim().replace(/\/$/, "");
    if (!baseUrl) {
      setMlHealth({ status: "not_configured", error: "Set NEXT_PUBLIC_GRIEVX_API_URL in apps/admin/.env.local to check the live API." });
      setMlMetrics(null);
      setMlLoading(false);
      return;
    }
    try {
      const [healthResponse, metricsResponse] = await Promise.all([
        fetch(`${baseUrl}/ml/health`), fetch(`${baseUrl}/ml/metrics`)
      ]);
      if (!healthResponse.ok || !metricsResponse.ok) throw new Error("ML API health or metrics request failed.");
      const [health, metrics] = await Promise.all([healthResponse.json(), metricsResponse.json()]);
      setMlHealth(health as MLHealth);
      setMlMetrics(metrics as MLMetrics);
    } catch (error) {
      setMlHealth({ status: "unavailable", error: error instanceof Error ? error.message : "Unable to reach ML API." });
      setMlMetrics(null);
    } finally {
      setMlLoading(false);
    }
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
      .select("id, student_id, title, description, location, status, category, category_confidence, priority_confidence, department_confidence, department_source, upvote_count, duplicate_of_id, priority, department_id, suggested_department_id, assigned_staff_id, created_at, updated_at, profiles!complaints_student_id_fkey(name, email), complaint_images(id, storage_path, content_type), complaint_status_history(id, from_status, to_status, changed_by, note, created_at)")
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
        status_history: item.complaint_status_history ?? [],
      };
    })) as Complaint[];

    setComplaints(mapped);
    setSelected((current) => current ? mapped.find((x) => x.id === current.id) ?? mapped[0] ?? null : mapped[0] ?? null);
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
      .select("id, student_id, title, description, location, status, category, category_confidence, priority_confidence, department_confidence, department_source, upvote_count, duplicate_of_id, priority, department_id, suggested_department_id, assigned_staff_id, created_at, updated_at, profiles!complaints_student_id_fkey(name, email), complaint_images(id, storage_path, content_type), complaint_status_history(id, from_status, to_status, changed_by, note, created_at)")
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
      status_history: (data as any).complaint_status_history ?? [],
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
      .update({ ...changes, ...(changes.department_id !== undefined ? { department_source: "admin_confirmed" } : {}), updated_at: new Date().toISOString() })
      .eq("id", selected.id)
      .select("id, student_id, title, description, location, status, category, category_confidence, priority_confidence, department_confidence, department_source, upvote_count, duplicate_of_id, priority, department_id, suggested_department_id, assigned_staff_id, created_at, updated_at, profiles!complaints_student_id_fkey(name, email), complaint_images(id, storage_path, content_type), complaint_status_history(id, from_status, to_status, changed_by, note, created_at)")
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
      status_history: (data as any).complaint_status_history ?? selected.status_history ?? []
    } as Complaint;
    setComplaints((items) => items.map((item) => item.id === updated.id ? updated : item));
    setSelected(updated);
    setMessage("Complaint routing updated.");
  };

  const assignStaff = async (staffId: string | null) => {
    if (!selected) return;
    setMessage("");

    const { data: authData } = await supabase.auth.getUser();
    const adminId = authData.user?.id;
    if (!adminId) {
      setMessage("Your admin session has expired. Please sign in again.");
      return;
    }

    // Update the complaint first. Keep assignment history in sync only after this succeeds.
    const { data, error } = await supabase
      .from("complaints")
      .update({ assigned_staff_id: staffId, updated_at: new Date().toISOString() })
      .eq("id", selected.id)
      .select("id, student_id, title, description, location, status, category, category_confidence, priority_confidence, department_confidence, department_source, upvote_count, duplicate_of_id, priority, department_id, suggested_department_id, assigned_staff_id, created_at, updated_at, profiles!complaints_student_id_fkey(name, email), complaint_images(id, storage_path, content_type), complaint_status_history(id, from_status, to_status, changed_by, note, created_at)")
      .single();

    if (error) {
      setMessage(error.message);
      return;
    }

    const now = new Date().toISOString();
    const { error: historyCloseError } = await supabase
      .from("staff_assignments")
      .update({ unassigned_at: now })
      .eq("complaint_id", selected.id)
      .is("unassigned_at", null);

    if (historyCloseError) {
      setMessage(`Complaint assignment changed, but assignment history could not be closed: ${historyCloseError.message}`);
      await loadComplaints();
      return;
    }

    if (staffId) {
      const { error: assignmentError } = await supabase.from("staff_assignments").insert({
        complaint_id: selected.id,
        staff_id: staffId,
        assigned_by: adminId,
      });
      if (assignmentError) {
        setMessage(`Complaint assignment changed, but history could not be recorded: ${assignmentError.message}`);
        await loadComplaints();
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
      status_history: (data as any).complaint_status_history ?? selected.status_history ?? [],
    } as Complaint;
    setComplaints((items) => items.map((item) => item.id === updated.id ? updated : item));
    setSelected(updated);
    setMessage(staffId ? "Complaint assigned to staff." : "Staff assignment removed.");
  };

  const saveStaffDirectory = async () => {
    if (!staffUserId || !staffDepartmentId) {
      setMessage("Choose a staff account and department first.");
      return;
    }
    const capacity = Number(staffCapacity);
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100) {
      setMessage("Maximum active assignments must be between 1 and 100.");
      return;
    }
    setStaffSaving(true);
    const { error } = await supabase.from("staff_directory").upsert({
      staff_id: staffUserId,
      department_id: staffDepartmentId,
      skills: staffSkills.split(",").map((skill) => skill.trim()).filter(Boolean),
      is_available: staffAvailable,
      max_active_assignments: capacity,
      updated_at: new Date().toISOString(),
    });
    setStaffSaving(false);
    if (error) { setMessage(error.message); return; }
    setMessage("Staff routing profile saved.");
    setStaffUserId("");
    setStaffSkills("");
    await loadStaff();
  };

  const removeStaffDirectory = async (staffId: string) => {
    const { error } = await supabase.from("staff_directory").delete().eq("staff_id", staffId);
    if (error) { setMessage(error.message); return; }
    setMessage("Staff member removed from automatic assignment.");
    await loadStaff();
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

  const workload = departments.map((department) => {
    const total = complaints.filter((item) => item.department_id === department.id).length;
    const active = complaints.filter((item) => item.department_id === department.id && (item.status === "assigned" || item.status === "in_progress")).length;
    return { ...department, total, active, share: complaints.length ? Math.round((total / complaints.length) * 100) : 0 };
  }).sort((a, b) => b.total - a.total).slice(0, 4);

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand"><span className="brandMark"><Icon name="check" size={25} /></span><span>GrievX</span></div>
        <div className="brandSub">CAMPUS</div>
        <nav>
          <button className={!showStaffManager && !showMLInsights ? "navActive" : ""} onClick={() => { setShowStaffManager(false); setShowMLInsights(false); }}><Icon name="home" size={20} />Overview</button>
          <button onClick={() => { setShowStaffManager(false); setShowMLInsights(false); setFilter("all"); }}><Icon name="clipboard" size={20} />Complaints</button>
          <button className={showStaffManager ? "navActive" : ""} onClick={() => { setShowStaffManager(true); setShowMLInsights(false); }}><Icon name="users" size={20} />Departments &amp; Staff</button>
          <button className={showMLInsights ? "navActive" : ""} onClick={() => { setShowStaffManager(false); setShowMLInsights(true); void refreshMLInsights(); }}><Icon name="sparkles" size={20} />ML Insights</button>
          <button onClick={() => { setShowStaffManager(false); setShowMLInsights(false); setMessage("Analytics are calculated from live complaint records."); }}><Icon name="chart" size={20} />Analytics</button>
          <button onClick={() => { setShowStaffManager(false); setShowMLInsights(false); setMessage("Admin settings are managed through project configuration."); }}><Icon name="settings" size={20} />Settings</button>
        </nav>
        <div className="sidebarArtwork" aria-hidden="true"><div className="campusBuilding"><span>⚑</span><b>▱</b><i>▥</i></div></div>
        <div className="sideBottom">
          <div className="adminMini"><span className="avatar">A</span><span><b>Admin</b><small>{userEmail}</small></span></div>
          <button className="logout" onClick={logout}>Sign out</button>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div className="pageHeading">
            <h1>{showStaffManager ? "Departments & Staff" : showMLInsights ? "ML Insights" : "Complaint Management"}</h1>
            <p>{showStaffManager ? "Manage staff profiles and automatic assignment rules." : showMLInsights ? "Monitor model availability, prediction history and evaluation results." : "Review, assign and update student complaints from one place."}</p>
          </div>
          <div className="topActions">
            <div className="globalSearch"><Icon name="search" size={19} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search complaints, students, departments..." /></div>
            <button className="iconButton" aria-label="Notifications" onClick={() => setMessage("You are viewing the latest complaint records.")}><Icon name="bell" size={22} /><i /></button>
            <div className="adminTop"><span className="avatar">A</span><b>Admin</b><button onClick={logout} aria-label="Sign out">⌄</button></div>
          </div>
        </header>

        {message && <div className="notice">{message}<button onClick={() => setMessage("")}>×</button></div>}

        {showStaffManager ? (
          <section className="staffManager">
            <div className="staffManagerHeading">
              <div><span className="eyebrow">ROUTING CONFIGURATION</span><h2>Departments &amp; Staff</h2><p>Configure which staff members can receive automatic complaint assignments.</p></div>
              <span className="secure">{staffDirectory.length} configured</span>
            </div>
            <div className="staffForm">
              <label>Staff account
                <select value={staffUserId} onChange={(e) => setStaffUserId(e.target.value)}>
                  <option value="">Select staff member</option>
                  {staff.filter((member) => member.role === "staff" || member.role === "department_head").map((member) => <option key={member.id} value={member.id}>{member.name || member.email} · {member.role.replace("_", " ")}</option>)}
                </select>
              </label>
              <label>Department
                <select value={staffDepartmentId} onChange={(e) => setStaffDepartmentId(e.target.value)}>
                  <option value="">Confirm a department</option>
                  {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                </select>
              </label>
              <label>Skills (comma separated)
                <input value={staffSkills} onChange={(e) => setStaffSkills(e.target.value)} placeholder="network, router, electrical..." />
              </label>
              <label>Maximum active complaints
                <input type="number" min="1" max="100" value={staffCapacity} onChange={(e) => setStaffCapacity(e.target.value)} />
              </label>
              <label className="availabilityToggle"><input type="checkbox" checked={staffAvailable} onChange={(e) => setStaffAvailable(e.target.checked)} /> Available for automatic assignment</label>
              <button className="saveStaffButton" onClick={saveStaffDirectory} disabled={staffSaving || staff.length === 0 || departments.length === 0}>{staffSaving ? "Saving..." : "Save staff routing profile"}</button>
            </div>
            <div className="staffDirectoryList">
              {staffDirectory.length === 0 ? <p>No staff routing profiles configured yet. Add a profile above to enable automatic staff assignment.</p> : staffDirectory.map((entry) => {
                const member = staff.find((person) => person.id === entry.staff_id);
                const department = departments.find((item) => item.id === entry.department_id);
                return <div className="staffDirectoryRow" key={entry.staff_id}><div><strong>{member?.name || member?.email || "Staff account"}</strong><span>{department?.name ?? "Department unavailable"} · {(entry.skills ?? []).join(", ") || "No skills added"} · max {entry.max_active_assignments}</span></div><span className={entry.is_available ? "readyBadge" : "reviewBadge"}>{entry.is_available ? "Available" : "Unavailable"}</span><button className="removeStaffButton" onClick={() => removeStaffDirectory(entry.staff_id)}>Remove</button></div>;
              })}
            </div>
          </section>
        ) : showMLInsights ? (
          <section className="mlInsights">
            <div className="mlInsightsToolbar">
              <div><span className="eyebrow">MODEL MONITORING</span><h2>ML service and prediction history</h2><p>Predictions use complaint title and description only. Evidence images are not analysed.</p></div>
              <button className="refresh" onClick={() => void refreshMLInsights()} disabled={mlLoading}>{mlLoading ? "Refreshing..." : "Refresh ML status"}</button>
            </div>
            {mlError && <div className="error">{mlError}</div>}
            <div className="stats">
              <Stat icon="sparkles" tone="blue" label="Saved predictions" value={mlPredictions.length} />
              <Stat icon="target" tone="green" label="Manual reviews" value={mlPredictions.filter((x) => x.requires_manual_review || x.prediction_state === "manual_review").length} />
              <Stat icon="flag" tone="blue" label="Critical predictions" value={mlPredictions.filter((x) => x.priority === "critical").length} />
              <Stat icon="check" tone="green" label="API online" value={mlHealth?.status === "ok" ? 1 : 0} />
            </div>
            <div className="mlInsightsGrid">
              <section className="mlInsightCard">
                <div className="panelHeading"><h2>ML service health</h2><span className={mlHealth?.status === "ok" ? "readyBadge" : "reviewBadge"}>{mlHealth?.status ?? "Not checked"}</span></div>
                {mlHealth?.models ? <div className="mlModelList">
                  <div><span>Category model</span><b>{mlHealth.models.category}</b></div>
                  <div><span>Priority model</span><b>{mlHealth.models.priority}</b></div>
                  <div><span>Department router</span><b>{mlHealth.models.department_router}</b></div>
                  <div><span>Training examples</span><b>{mlHealth.training_samples ?? "—"} · {mlHealth.dataset}</b></div>
                </div> : <p className="mutedText">{mlHealth?.error ?? "Refresh ML status to check the FastAPI service."}</p>}
              </section>
              <section className="mlInsightCard">
                <div className="panelHeading"><h2>Seed dataset evaluation</h2></div>
                {mlMetrics?.category && mlMetrics?.priority ? <div className="mlMetricGrid">
                  <div><span>Category accuracy</span><b>{(mlMetrics.category.accuracy * 100).toFixed(1)}%</b><small>Macro F1 {(mlMetrics.category.macro_f1 * 100).toFixed(1)}%</small></div>
                  <div><span>Priority accuracy</span><b>{(mlMetrics.priority.accuracy * 100).toFixed(1)}%</b><small>Macro F1 {(mlMetrics.priority.macro_f1 * 100).toFixed(1)}%</small></div>
                </div> : <p className="mutedText">Evaluation metrics appear when the ML API is running and configured for the admin app.</p>}
                <p className="mlCaveat">{mlMetrics?.note ?? "The dataset contains 54 curated demo examples. These metrics are not production accuracy guarantees."}</p>
              </section>
            </div>
            <section className="mlInsightCard mlHistoryCard">
              <div className="panelHeading"><h2>Recent prediction history</h2><span className="secure">{mlPredictions.length} records loaded</span></div>
              {mlPredictions.length === 0 ? <div className="empty">No prediction records yet. Submit a complaint with the ML API configured to populate this history.</div> : <div className="mlHistoryTable">
                <div className="mlHistoryHead"><span>Complaint</span><span>Category</span><span>Priority</span><span>Department</span><span>Confidence</span><span>State</span></div>
                {mlPredictions.slice(0, 30).map((item) => <div className="mlHistoryRow" key={item.id}>
                  <b>{complaints.find((x) => x.id === item.complaint_id)?.title ?? item.complaint_id.slice(0, 8)}</b>
                  <span>{item.category ?? "—"}</span><span>{item.priority ?? "—"}</span><span>{item.department_name ?? "—"}</span>
                  <span>{item.category_confidence == null ? "—" : `${Math.round(item.category_confidence * 100)}%`}</span>
                  <span>
                    <span className={item.requires_manual_review || item.prediction_state === "manual_review" ? "reviewBadge" : "readyBadge"}>
                      {item.requires_manual_review || item.prediction_state === "manual_review" ? "Manual review" : item.prediction_state}
                    </span>
                    {item.requires_manual_review && item.review_reason && <small className="mutedText">{item.review_reason}</small>}
                  </span>
                </div>)}
              </div>}
            </section>
          </section>
        ) : (
          <>
            <div className="stats">
              <Stat icon="clipboard" tone="blue" label="Total complaints" value={counts.total} />
              <Stat icon="plus" tone="green" label="New submissions" value={counts.submitted} />
              <Stat icon="refresh" tone="blue" label="Active" value={counts.active} />
              <Stat icon="check" tone="green" label="Resolved" value={counts.resolved} />
            </div>

            <div className="dashboardGrid">
              <div className="leftColumn">
                <section className="listPanel">
                  <div className="panelHeading"><h2>Recent Complaints</h2><button onClick={() => setFilter("all")}>View All Complaints <span>→</span></button></div>
                  <div className="tableScroll">
                    <div className="complaintTable">
                      <div className="tableHead"><span>Complaint</span><span>Category</span><span>Department</span><span>Priority</span><span>Status</span><span>Assigned staff</span><span>Submitted</span></div>
                      {loading ? <div className="empty">Loading complaints...</div> : filtered.length === 0 ? <div className="empty">No complaints match your search.</div> : filtered.slice(0, 6).map((item) => {
                        const department = departments.find((d) => d.id === item.department_id);
                        const suggestedDepartment = departments.find((d) => d.id === item.suggested_department_id);
                        const assigned = staff.find((person) => person.id === item.assigned_staff_id);
                        return <button key={item.id} className={selected?.id === item.id ? "tableRow selected" : "tableRow"} onClick={() => setSelected(item)}>
                          <span className="complaintTitle"><i><Icon name={item.category?.toLowerCase().includes("network") ? "wifi" : item.category?.toLowerCase().includes("plumb") ? "droplet" : "file"} size={18} /></i><b>{item.title}</b></span>
                          <span>{item.category ?? "Unclassified"}</span>
                          <span>{department?.name ?? (suggestedDepartment ? `Suggested: ${suggestedDepartment.name}` : "Pending")}</span>
                          <span><em className={`priorityPill priority-${item.priority ?? "normal"}`}>{item.priority ?? "normal"}</em></span>
                          <span><Status status={item.status} /></span>
                          <span>{assigned?.name ?? (item.assigned_staff_id ? "Assigned staff" : "Unassigned")}</span>
                          <span>{formatDate(item.created_at)}</span>
                        </button>;
                      })}
                    </div>
                  </div>
                </section>

                <section className="workloadPanel">
                  <div className="panelHeading"><h2>Department Workload</h2></div>
                  {workload.length === 0 ? <p className="mutedText">Department workload will appear when departments and complaints are available.</p> : workload.map((department) => (
                    <div className="workloadRow" key={department.id}>
                      <b>{department.name}</b>
                      <div className="workloadTrack"><span style={{ width: `${department.share}%` }} /></div>
                      <strong>{department.share}% <small>({department.total} total · {department.active} active)</small></strong>
                    </div>
                  ))}
                </section>
              </div>

              <aside className="detailPanel">
                <div className="detailPanelTitle"><span><Icon name="file" size={22} /></span><h2>Complaint Details</h2></div>
                {selected ? (
                  <>
                    <div className="selectedComplaint">
                      <div className="selectedTitle"><h3>{selected.title}</h3><Status status={selected.status} /></div>
                      <div className="metaLine"><span>♙</span><b>Student:</b> {selected.student?.name ?? "Student"} <small>{selected.student?.email ?? ""}</small></div>
                      <div className="metaLine"><span>⌖</span><b>Location:</b> {selected.location}</div>
                      <div className="metaLine"><span>▦</span><b>Submitted:</b> {formatDate(selected.created_at)}</div>
                    </div>
                    <div className="detailDescription"><b>Description</b><p>{selected.description}</p></div>
                    <div className="evidenceBlock"><b>Evidence</b>
                      {selected.images?.length ? <div className="evidenceGrid">{selected.images.map((image) => image.signed_url ? <a key={image.id} href={image.signed_url} target="_blank" rel="noreferrer"><img className="evidenceImage" src={image.signed_url} alt="Complaint evidence" /></a> : <span key={image.id}>Evidence unavailable.</span>)}</div> : <span className="mutedText">No evidence photo attached.</span>}
                    </div>

                    <section className="automaticCard">
                      <div className="automaticHeading"><h3><span><Icon name="settings" size={21} /></span>Department suggestion & assignment</h3><span className={selected.category && selected.department_source !== "manual_review" ? "readyBadge" : "reviewBadge"}>{selected.category && selected.department_source !== "manual_review" ? "ML result saved" : "Review needed"}</span></div>
                      <div className="assignmentSteps">
                        <div><span>◎ &nbsp; Predicted category:</span><b>{selected.category ?? "Pending"}</b><i>{selected.category_confidence != null ? Math.round(selected.category_confidence * 100) + "%" : "—"}</i></div>
                        <div><span>◎ &nbsp; Suggested department:</span><b>{departments.find((d) => d.id === selected.suggested_department_id)?.name ?? "Not available"}</b><i>{selected.department_confidence != null ? Math.round(selected.department_confidence * 100) + "%" : "—"}</i></div>
                        <div><span>♜ &nbsp; Confirmed department:</span><b>{departments.find((d) => d.id === selected.department_id)?.name ?? "Pending admin review"}</b><i>{selected.department_id ? "Confirmed" : "Pending"}</i></div>
                        <div><span>⚑ &nbsp; Priority:</span><b><em className={`priorityPill priority-${selected.priority ?? "normal"}`}>{selected.priority ?? "normal"}</em></b><i>{selected.priority_confidence != null ? Math.round(selected.priority_confidence * 100) + "%" : "—"}</i></div>
                        <div><span>♧ &nbsp; Assigned staff:</span><b>{staff.find((member) => member.id === selected.assigned_staff_id)?.name ?? (selected.assigned_staff_id ? "Assigned staff" : "Not assigned")}</b><i>{selected.assigned_staff_id ? "Assigned" : "Pending"}</i></div>
                      </div>
                      <p className="mlReason">ⓘ &nbsp; Matched using complaint text, department rules, staff skills and availability. Evidence is displayed only; ML does not analyse images.</p>
                    </section>

                    <div className="overrideArea">
                      <label>Confirm department / override assignment</label>
                      <div className="overrideControls">
                        <select className="departmentSelect" value={selected.department_id ?? ""} onChange={(e) => updateRouting({ department_id: e.target.value || null })}>
                          <option value="">Select department</option>
                          {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                        </select>
                        <select className="departmentSelect" value={selected.assigned_staff_id ?? ""} onChange={(e) => assignStaff(e.target.value || null)}>
                          <option value="">Unassigned</option>
                          {staff.map((member) => <option key={member.id} value={member.id}>{member.name || member.email}</option>)}
                        </select>
                      </div>
                      <div className="priorityControls">{priorities.map((priority) => <button key={priority} className={selected.priority === priority ? "statusButton current" : "statusButton"} onClick={() => updateRouting({ priority })}>{priority}</button>)}</div>
                    </div>
                    <div className="statusEditor compactStatus"><label>Update complaint status</label><div className="statusButtons">{statuses.filter((x) => x !== "all").map((status) => <button key={status} className={selected.status === status ? "statusButton current" : "statusButton"} onClick={() => updateStatus(status)}>{status.replace("_", " ")}</button>)}</div></div>
                  </>
                ) : <div className="detailEmpty"><div className="detailIcon"><Icon name="file" size={25} /></div><h2>Select a complaint</h2><p>Choose a complaint from the table to inspect and manage it.</p></div>}
              </aside>
            </div>
          </>
        )}
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


function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, string> = {
    check: "M5 12.5 9.5 17 19 7",
    home: "M3 10.5 12 3l9 7.5M5.5 9.5V21h13V9.5M9 21v-7h6v7",
    clipboard: "M8 4.5h8M9 3h6v3H9zM6 5H4v16h16V5h-2M8 10h8M8 14h8M8 18h5",
    users: "M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20M9.5 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM17 4a3.5 3.5 0 0 1 0 6.8M17 14.5a4 4 0 0 1 4 4V20",
    sparkles: "m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3ZM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16ZM5 2l.7 2.3L8 5l-2.3.7L5 8l-.7-2.3L2 5l2.3-.7L5 2Z",
    chart: "M4 20V12M10 20V4M16 20v-9M22 20H2",
    settings: "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7ZM19.4 13.5l1.2 1-.0 2-1.7 1-1.6-.5-1.3.8-.3 1.7h-3.4l-.3-1.7-1.3-.8-1.6.5-1.7-1v-2l1.2-1v-1.5l-1.2-1v-2l1.7-1 1.6.5 1.3-.8.3-1.7h3.4l.3 1.7 1.3.8 1.6-.5 1.7 1v2l-1.2 1v1.5Z",
    search: "m20 20-4.5-4.5M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z",
    bell: "M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4",
    plus: "M12 5v14M5 12h14",
    refresh: "M20 7v5h-5M4 17v-5h5M5.5 9a7 7 0 0 1 12-2L20 12M4 12l2.5 5a7 7 0 0 0 12-2",
    file: "M6 3h8l5 5v13H6zM14 3v5h5M9 12h7M9 16h7",
    wifi: "M3 9a14 14 0 0 1 18 0M6 12a9 9 0 0 1 12 0M9 15a4 4 0 0 1 6 0M12 19h.01",
    droplet: "M12 3C9 7 6 10 6 14a6 6 0 0 0 12 0c0-4-3-7-6-11Z",
    layers: "m12 3 9 5-9 5-9-5 9-5ZM3 13l9 5 9-5M3 18l9 5 9-5",
    target: "M12 3v3M12 18v3M3 12h3M18 12h3M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10ZM12 10v4M10 12h4",
    building: "M4 21V8l8-5 8 5v13M2 21h20M8 11h2M14 11h2M8 15h2M14 15h2M10 21v-3h4v3",
    flag: "M5 21V4m0 1c5-4 9 4 14 0v10c-5 4-9-4-14 0",
    edit: "m4 16-.8 4.8L8 20l11-11-4-4L4 16ZM13.5 6.5l4 4",
    user: "M20 21a8 8 0 0 0-16 0M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
    pin: "M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0ZM12 10h.01",
    calendar: "M5 4v3M19 4v3M4 8h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1ZM8 12h2M14 12h2M8 16h2",
    projector: "M3 5h18v12H3zM8 21l4-4 4 4M9 9h6M9 13h3"
  };
  return <svg className="lineIcon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] ?? paths.file} /></svg>;
}

function Stat({ icon, tone, label, value }: { icon: string; tone: "blue" | "green"; label: string; value: number }) {
  return <div className="statCard"><span className={`statIcon ${tone}`}><Icon name={icon} size={34} /></span><div><span className="statLabel">{label}</span><strong>{value}</strong></div></div>;
}

function Status({ status }: { status: Complaint["status"] }) {
  return <span className={`status status-${status}`}><i />{status.replace("_", " ")}</span>;
}

function formatStatusLabel(value: string) {
  return value.replace("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
