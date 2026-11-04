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
      .select("id, student_id, title, description, location, status, category, category_confidence, priority_confidence, department_confidence, department_source, upvote_count, duplicate_of_id, priority, department_id, assigned_staff_id, created_at, updated_at, profiles!complaints_student_id_fkey(name, email), complaint_images(id, storage_path, content_type), complaint_status_history(id, from_status, to_status, changed_by, note, created_at)")
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
      .select("id, student_id, title, description, location, status, category, category_confidence, priority_confidence, department_confidence, department_source, upvote_count, duplicate_of_id, priority, department_id, assigned_staff_id, created_at, updated_at, profiles!complaints_student_id_fkey(name, email), complaint_images(id, storage_path, content_type), complaint_status_history(id, from_status, to_status, changed_by, note, created_at)")
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
      .update({ ...changes, updated_at: new Date().toISOString() })
      .eq("id", selected.id)
      .select("id, student_id, title, description, location, status, category, category_confidence, priority_confidence, department_confidence, department_source, upvote_count, duplicate_of_id, priority, department_id, assigned_staff_id, created_at, updated_at, profiles!complaints_student_id_fkey(name, email), complaint_images(id, storage_path, content_type), complaint_status_history(id, from_status, to_status, changed_by, note, created_at)")
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
      .select("id, student_id, title, description, location, status, category, category_confidence, priority_confidence, department_confidence, department_source, upvote_count, duplicate_of_id, priority, department_id, assigned_staff_id, created_at, updated_at, profiles!complaints_student_id_fkey(name, email), complaint_images(id, storage_path, content_type), complaint_status_history(id, from_status, to_status, changed_by, note, created_at)")
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
        <div className="brand"><span className="brandMark">✓</span><span>GrievX</span></div>
        <div className="brandSub">CAMPUS</div>
        <nav>
          <button className={!showStaffManager ? "navActive" : ""} onClick={() => setShowStaffManager(false)}><span>⌂</span>Overview</button>
          <button onClick={() => { setShowStaffManager(false); setFilter("all"); }}><span>▤</span>Complaints</button>
          <button className={showStaffManager ? "navActive" : ""} onClick={() => setShowStaffManager(true)}><span>♧</span>Departments &amp; Staff</button>
          <button onClick={() => { setShowStaffManager(false); setMessage("ML uses TF-IDF and Logistic Regression for category and priority. Department routing uses category mapping."); }}><span>✧</span>ML Insights</button>
          <button onClick={() => { setShowStaffManager(false); setMessage("Analytics are calculated from live complaint records."); }}><span>▥</span>Analytics</button>
          <button onClick={() => { setShowStaffManager(false); setMessage("Admin settings are managed through project configuration."); }}><span>⚙</span>Settings</button>
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
            <h1>{showStaffManager ? "Departments & Staff" : "Complaint Management"}</h1>
            <p>{showStaffManager ? "Manage staff profiles and automatic assignment rules." : "Review, assign and update student complaints from one place."}</p>
          </div>
          <div className="topActions">
            <div className="globalSearch"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search complaints, students, departments..." /></div>
            <button className="iconButton" aria-label="Notifications" onClick={() => setMessage("You are viewing the latest complaint records.")}>♧<i /></button>
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
                  <option value="">Select department</option>
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
        ) : (
          <>
            <div className="stats">
              <Stat icon="▤" tone="blue" label="Total complaints" value={counts.total} />
              <Stat icon="＋" tone="green" label="New submissions" value={counts.submitted} />
              <Stat icon="↻" tone="blue" label="Active" value={counts.active} />
              <Stat icon="✓" tone="green" label="Resolved" value={counts.resolved} />
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
                        const assigned = staff.find((person) => person.id === item.assigned_staff_id);
                        return <button key={item.id} className={selected?.id === item.id ? "tableRow selected" : "tableRow"} onClick={() => setSelected(item)}>
                          <span className="complaintTitle"><i>{item.category?.toLowerCase().includes("network") ? "⌁" : item.category?.toLowerCase().includes("plumb") ? "♨" : "▣"}</i><b>{item.title}</b></span>
                          <span>{item.category ?? "Unclassified"}</span>
                          <span>{department?.name ?? "Pending"}</span>
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
                <div className="detailPanelTitle"><span>▤</span><h2>Complaint Details</h2></div>
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
                      <div className="automaticHeading"><h3><span>⚙</span>Automatic assignment</h3><span className={selected.category && selected.department_source !== "manual_review" ? "readyBadge" : "reviewBadge"}>{selected.category && selected.department_source !== "manual_review" ? "ML result saved" : "Review needed"}</span></div>
                      <div className="assignmentSteps">
                        <div><span>◎ &nbsp; Predicted category:</span><b>{selected.category ?? "Pending"}</b><i>{selected.category_confidence != null ? Math.round(selected.category_confidence * 100) + "%" : "—"}</i></div>
                        <div><span>♜ &nbsp; Department:</span><b>{departments.find((d) => d.id === selected.department_id)?.name ?? "Needs review"}</b><i>{selected.department_confidence != null ? Math.round(selected.department_confidence * 100) + "%" : "—"}</i></div>
                        <div><span>⚑ &nbsp; Priority:</span><b><em className={`priorityPill priority-${selected.priority ?? "normal"}`}>{selected.priority ?? "normal"}</em></b><i>{selected.priority_confidence != null ? Math.round(selected.priority_confidence * 100) + "%" : "—"}</i></div>
                        <div><span>♧ &nbsp; Assigned staff:</span><b>{staff.find((member) => member.id === selected.assigned_staff_id)?.name ?? (selected.assigned_staff_id ? "Assigned staff" : "Not assigned")}</b><i>{selected.assigned_staff_id ? "Assigned" : "Pending"}</i></div>
                      </div>
                      <p className="mlReason">ⓘ &nbsp; Matched using complaint text, department rules, staff skills and availability. Evidence is displayed only; ML does not analyse images.</p>
                    </section>

                    <div className="overrideArea">
                      <label>Override assignment</label>
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
                ) : <div className="detailEmpty"><div className="detailIcon">▤</div><h2>Select a complaint</h2><p>Choose a complaint from the table to inspect and manage it.</p></div>}
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

function Stat({ icon, tone, label, value }: { icon: string; tone: "blue" | "green"; label: string; value: number }) {
  return <div className="statCard"><span className={`statIcon ${tone}`}>{icon}</span><div><span className="statLabel">{label}</span><strong>{value}</strong></div></div>;
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
