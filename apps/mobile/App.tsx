import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import {
  createComplaint,
  updateComplaint,
  withdrawComplaint,
  findPossibleDuplicates,
  getComplaint,
  getComplaints,
  getMe,
  updateMyProfileName,
  submitAppFeedback,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  login,
  register,
  resetPassword,
  signOut,
  upvoteComplaint,
  uploadComplaintImage,
} from "./src/api";
import { supabase } from "./src/supabase";

type Screen = "home" | "report" | "complaints" | "detail" | "notifications" | "profile" | "settings";
type AuthMode = "login" | "register";
type Complaint = {
  id: string;
  title: string;
  description: string;
  location: string;
  status: string;
  priority?: "normal" | "high" | "critical";
  category?: string | null;
  upvote_count?: number;
  has_upvoted?: boolean;
  duplicate_of_id?: string | null;
  created_at: string;
  images: { id: string; original_filename: string; content_type: string; signed_url?: string | null }[];
  status_history?: { id: string; from_status: string | null; to_status: string; changed_by: string | null; note: string | null; created_at: string }[];
};

const C = {
  bg: "#FAF9FF",
  white: "#FFFFFF",
  navy: "#06164A",
  blue: "#0757D9",
  blue2: "#0B63E5",
  softBlue: "#EEF1FF",
  paleBlue: "#E9EDFF",
  text: "#10162A",
  muted: "#6F7381",
  border: "#E7E7EF",
  red: "#C51F1F",
  paleRed: "#FFE0DF",
  green: "#16A56B",
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const [session, setSession] = useState<boolean | null>(null);
  const [screen, setScreen] = useState<Screen>("home");
  const [id, setId] = useState<string | null>(null);
  const [auth, setAuth] = useState<AuthMode>("login");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const loggedIn = !!data.session;
      setSession(loggedIn);
      if (loggedIn) {
        setScreen("home");
        setId(null);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      const loggedIn = !!next;
      setSession(loggedIn);
      if (loggedIn) {
        setScreen("home");
        setId(null);
      } else {
        setScreen("home");
        setId(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (session === null) return <Centered><ActivityIndicator color={C.blue} /></Centered>;
  if (!session) return <Auth mode={auth} setMode={setAuth} />;

  const open = (x: string) => {
    setId(x);
    setScreen("detail");
  };

  return (
    <SafeAreaView style={s.app}>
      {screen === "home" && <Home go={setScreen} />}
      {screen === "report" && (
        <Report back={() => setScreen("home")} done={() => setScreen("complaints")} />
      )}
      {screen === "complaints" && (
        <Complaints back={() => setScreen("home")} open={open} />
      )}
      {screen === "detail" && id && (
        <Detail id={id} back={() => setScreen("complaints")} />
      )}
      {screen === "notifications" && <Notifications back={() => setScreen("home")} openComplaint={open} />}
      {screen === "profile" && <Profile back={() => setScreen("home")} go={setScreen} logout={signOut} />}
      {screen === "settings" && <Settings back={() => setScreen("profile")} openNotifications={() => setScreen("notifications")} />}
      {screen !== "detail" && <Nav active={screen} go={setScreen} />}
    </SafeAreaView>
  );
}

function Auth({
  mode,
  setMode,
}: {
  mode: AuthMode;
  setMode: (x: AuthMode) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    try {
      setError("");
      setBusy(true);

      if (mode === "register") {
        if (!name.trim()) {
          setError("Please enter your full name.");
          return;
        }
        await register(name.trim(), email.trim(), password);
        setMode("login");
        setError("Account created successfully. Please sign in.");
        return;
      }

      await login(email.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={s.app}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={s.auth}>
          <Brand />
          <Text style={s.eyebrow}>CAMPUS CLARITY</Text>
          <Text style={s.display}>
            {mode === "login" ? "Welcome back." : "Join GrievX Campus."}
          </Text>
          <Text style={s.body}>
            Report campus issues and keep track of your complaints.
          </Text>

          <Card>
            {mode === "register" && (
              <Field
                label="Full name"
                placeholder="Your full name"
                value={name}
                onChangeText={setName}
              />
            )}

            <Field
              label="Email"
              placeholder="you@pesu.pes.edu"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />

            <Field
              label="Password"
              placeholder="Enter your password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            {!!error && <Text style={s.error}>{error}</Text>}

            <Primary
              label={
                busy
                  ? "Please wait..."
                  : mode === "login"
                    ? "Sign in"
                    : "Create account"
              }
              onPress={submit}
              disabled={busy}
            />

            <Pressable
              onPress={() => {
                setError("");
                setMode(mode === "login" ? "register" : "login");
              }}
            >
              <Text style={s.link}>
                {mode === "login"
                  ? "New here? Create an account"
                  : "Already have an account? Sign in"}
              </Text>
            </Pressable>
          </Card>

          <Text style={s.helper}>
            PESU credential verification can be integrated behind the GrievX API.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Brand() {
  return (
    <View style={s.brand}>
      <View style={s.logo}>
        <Text style={s.logoText}>G</Text>
      </View>
      <Text style={s.brandText}>GrievX Campus</Text>
    </View>
  );
}

function Home({ go }: { go: (x: Screen) => void }) {
  const [me, setMe] = useState<{ name: string } | null>(null);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    getMe().then((profile) => {
      if (active) setMe(profile);
    }).catch(() => {});

    getComplaints()
      .then((items) => {
        if (active) setComplaints(items as Complaint[]);
      })
      .catch(() => {
        if (active) setComplaints([]);
      })
      .finally(() => {
        if (active) setStatsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const first = me?.name?.split(" ")[0] || "Student";
  const submittedCount = complaints.filter((item) => item.status.toLowerCase() === "submitted").length;
  const inProgressCount = complaints.filter((item) =>
    ["assigned", "in_progress"].includes(item.status.toLowerCase()),
  ).length;
  const resolvedCount = complaints.filter((item) =>
    ["resolved", "closed"].includes(item.status.toLowerCase()),
  ).length;

  return (
    <ScrollView contentContainerStyle={s.page} showsVerticalScrollIndicator={false}>
      <View style={s.top}>
        <View>
          <Text style={s.eyebrow}>GRIEVX CAMPUS</Text>
          <Text style={s.greeting}>Hi, {first} 👋</Text>
        </View>
        <Pressable style={s.avatar} onPress={() => go("profile")}>
          <Text style={s.avatarText}>{first[0]?.toUpperCase()}</Text>
        </Pressable>
      </View>

      <View style={s.hero}>
        <View style={{ flex: 1 }}>
          <Text style={s.heroTitle}>Make your campus better.</Text>
          <Text style={s.heroBody}>
            Report an issue in a few simple steps and follow its progress.
          </Text>
          <Primary label="Report an issue" onPress={() => go("report")} />
        </View>
        <View style={s.heroIcon}><Text style={s.heroCheck}>✓</Text></View>
      </View>

      <Text style={s.section}>Your activity</Text>
      <View style={s.stats}>
        <Stat label="Submitted" value={statsLoading ? "…" : submittedCount} />
        <Stat label="In progress" value={statsLoading ? "…" : inProgressCount} />
        <Stat label="Resolved" value={statsLoading ? "…" : resolvedCount} />
      </View>

      <Text style={s.section}>Quick actions</Text>
      <View style={s.actions}>
        <Action title="My complaints" sub="View your reports" icon="📋" onPress={() => go("complaints")} />
        <Action title="Notifications" sub="Updates and alerts" icon="🔔" onPress={() => go("notifications")} />
      </View>
    </ScrollView>
  );
}

function Report({back,done}:{back:()=>void;done:()=>void}){const [title,setTitle]=useState(""),[description,setDescription]=useState(""),[location,setLocation]=useState(""),[image,setImage]=useState<ImagePicker.ImagePickerAsset|null>(null),[busy,setBusy]=useState(false);
 const pick=async()=>{const p=await ImagePicker.requestMediaLibraryPermissionsAsync();if(!p.granted){Alert.alert("Photo access needed","Allow photo access to attach evidence.");return}const r=await ImagePicker.launchImageLibraryAsync({mediaTypes:["images"],allowsEditing:true,quality:.8});if(!r.canceled)setImage(r.assets[0])};
 const submit=async()=>{if(!title.trim()||!description.trim()||!location.trim()){Alert.alert("Missing information","Please complete title, description and campus location.");return}try{setBusy(true);
   const input={title:title.trim(),description:description.trim(),location:location.trim()};
   let duplicates: Awaited<ReturnType<typeof findPossibleDuplicates>> = [];
   try { duplicates = await findPossibleDuplicates(input); } catch {}
   const proceed=async()=>{const c=await createComplaint(input);if(image)await uploadComplaintImage(c.id,image.uri,image.fileName??"evidence.jpg",image.mimeType??"image/jpeg");Alert.alert("Complaint submitted","Your complaint was submitted successfully.",[{text:"View complaints",onPress:done}])};
   if(duplicates.length){
     const top=duplicates.slice(0,3).map((d,i)=>`${i+1}. ${d.title} · ${d.location} · ${Math.round(d.similarity_score*100)}% similar`).join("\n");
     Alert.alert("Possible duplicate found","A recent complaint may describe the same issue:\n\n"+top+"\n\nReview it before submitting another report.",[
       {text:"Cancel",style:"cancel"},
       {text:"Submit anyway",onPress:proceed},
     ]);
   } else await proceed();
 }catch(e){Alert.alert("Submission failed",e instanceof Error?e.message:"Please try again.")}finally{setBusy(false)}};
 return <KeyboardAvoidingView style={s.app} behavior={Platform.OS==="ios"?"padding":undefined}><ScrollView contentContainerStyle={s.page}><Header title="Report an issue" back={back}/>
 <View style={s.progress}><Text style={s.cardTitle}>Tell us what happened.</Text><Text style={s.muted}>Clear details help the complaint reach the right campus team.</Text></View>
 <Card><Field label="Complaint title" placeholder="e.g. Wi-Fi disconnected in Lab 304" maxLength={150} value={title} onChangeText={setTitle}/><Field label="Detailed description" placeholder="Describe the problem clearly..." multiline value={description} onChangeText={setDescription} inputStyle={s.area}/><Text style={s.label}>Campus location</Text><Text style={s.helper}>Enter the building, room or campus area.</Text><Field label="" placeholder="e.g. EC Block, Lab 304" value={location} onChangeText={setLocation}/></Card>
 <Card><Text style={s.label}>Upload evidence</Text><Text style={s.helper}>Add one photo showing the issue. JPG, PNG or WEBP · max 5 MB</Text>{image?<View style={s.imageBox}><Image source={{uri:image.uri}} style={s.image}/><Pressable onPress={pick}><Text style={s.link}>Change photo</Text></Pressable></View>:<Pressable onPress={pick} style={s.upload}><Text style={s.plus}>+</Text><Text style={s.label}>Add photo evidence</Text></Pressable>}</Card>
 <Primary label={busy?"Submitting...":"Submit complaint"} onPress={submit} disabled={busy}/><Pressable onPress={back}><Text style={[s.muted,{textAlign:"center"}]}>Cancel</Text></Pressable>
 </ScrollView></KeyboardAvoidingView>}

function Complaints({ back, open }: { back: () => void; open: (id: string) => void }) {
  const [items, setItems] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Complaint | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    try {
      setError("");
      setItems(await getComplaints() as Complaint[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load complaints.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const beginEdit = (item: Complaint) => {
    setEditing(item);
    setEditTitle(item.title);
    setEditDescription(item.description);
    setEditLocation(item.location);
  };

  const saveEdit = async () => {
    if (!editing || !editTitle.trim() || !editDescription.trim() || !editLocation.trim()) {
      Alert.alert("Missing information", "Please complete the title, description and location.");
      return;
    }
    try {
      setSaving(true);
      await updateComplaint(editing.id, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        location: editLocation.trim(),
      });
      setEditing(null);
      await refresh();
      Alert.alert("Complaint updated", "Your changes have been saved.");
    } catch (e) {
      Alert.alert("Unable to update", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const confirmWithdraw = (item: Complaint) => {
    Alert.alert(
      "Withdraw complaint?",
      "This will mark your submitted complaint as withdrawn. You cannot undo this action.",
      [
        { text: "Keep complaint", style: "cancel" },
        { text: "Withdraw", style: "destructive", onPress: async () => {
          try {
            await withdrawComplaint(item.id);
            await refresh();
            Alert.alert("Complaint withdrawn", "Your complaint has been withdrawn.");
          } catch (e) {
            Alert.alert("Unable to withdraw", e instanceof Error ? e.message : "Please try again.");
          }
        }},
      ],
    );
  };

  return (
    <View style={s.app}>
      <FlatList
        contentContainerStyle={s.page}
        data={items}
        keyExtractor={(x) => x.id}
        ListHeaderComponent={
          <>
            <Header title="My complaints" back={back} />
            <Text style={s.muted}>Follow the status of every complaint you have submitted.</Text>
            <View style={{ height: 8 }} />
          </>
        }
        ListEmptyComponent={
          loading ? <ActivityIndicator color={C.blue} /> : <Text style={s.error}>{error || "No complaints yet."}</Text>
        }
        renderItem={({ item }) => {
          const canManage = item.status.toLowerCase() === "submitted";
          return (
            <View style={s.complaint}>
              <Pressable onPress={() => open(item.id)}>
                <View style={s.row}>
                  <Status status={item.status} />
                  <Text style={s.date}>{date(item.created_at)}</Text>
                </View>
                <Text style={s.complaintTitle}>{item.title}</Text>
                <Text style={s.muted} numberOfLines={2}>{item.description}</Text>
                <Text style={s.helper}>• {item.location}</Text>
                <Text style={s.helper}>• {item.upvote_count ?? 0} campus support{item.upvote_count === 1 ? "" : "s"}</Text>
              </Pressable>
              {canManage && (
                <View style={s.complaintActions}>
                  <Pressable style={s.editComplaintButton} onPress={() => beginEdit(item)}>
                    <Text style={s.editComplaintText}>✎  Edit</Text>
                  </Pressable>
                  <Pressable style={s.withdrawComplaintButton} onPress={() => confirmWithdraw(item)}>
                    <Text style={s.withdrawComplaintText}>▤  Withdraw</Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        }}
      />
      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => {
        if (!saving) setEditing(null);
      }}>
        <View style={s.editModalBackdrop}>
          <View style={s.editModalCard}>
            <Text style={s.cardTitle}>Edit complaint</Text>
            <Text style={s.label}>Title</Text>
            <TextInput style={s.editInput} value={editTitle} onChangeText={setEditTitle} maxLength={150} />
            <Text style={s.label}>Description</Text>
            <TextInput style={[s.editInput, s.editMultiline]} value={editDescription} onChangeText={setEditDescription} multiline textAlignVertical="top" />
            <Text style={s.label}>Campus location</Text>
            <TextInput style={s.editInput} value={editLocation} onChangeText={setEditLocation} />
            <View style={s.editModalActions}>
              <Pressable style={s.cancelEditButton} disabled={saving} onPress={() => setEditing(null)}>
                <Text style={s.cancelEditText}>Cancel</Text>
              </Pressable>
              <Pressable style={s.saveEditButton} disabled={saving} onPress={saveEdit}>
                <Text style={s.saveEditText}>{saving ? "Saving..." : "Save changes"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Detail({ id, back }: { id: string; back: () => void }) {
  const [item, setItem] = useState<Complaint | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getComplaint(id)
      .then(setItem)
      .catch((e) => setError(e instanceof Error ? e.message : "Unable to load complaint."));
  }, [id]);

  if (error) {
    return (
      <View style={s.page}>
        <Header title="Complaint details" back={back} />
        <Text style={s.error}>{error}</Text>
      </View>
    );
  }

  if (!item) return <Centered><ActivityIndicator color={C.blue} /></Centered>;

  return (
    <ScrollView contentContainerStyle={s.page}>
      <Header title="Complaint details" back={back} />
      <View style={s.progress}>
        <Status status={item.status} />
        <Text style={s.detailTitle}>{item.title}</Text>
        <Text style={s.date}>{date(item.created_at)}</Text>
      </View>
      <Card>
        <Text style={s.label}>Description</Text>
        <Text style={s.body}>{item.description}</Text>
        <Text style={[s.label, { marginTop: 14 }]}>Campus location</Text>
        <Text style={s.body}>{item.location}</Text>
      </Card>
      <Card>
        <Text style={s.label}>Evidence</Text>
        {item.images.length ? item.images.map((x) => (
          <View key={x.id} style={s.evidenceDetail}>
            {x.signed_url ? (
              <Image source={{ uri: x.signed_url }} style={s.evidenceDetailImage} />
            ) : (
              <View style={s.evidenceDetailPlaceholder}><Text style={s.evidenceDetailPlaceholderText}>▧</Text></View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={s.label} numberOfLines={1}>{x.original_filename}</Text>
              <Text style={s.helper}>{x.content_type}</Text>
            </View>
          </View>
        )) : <Text style={s.muted}>No evidence attached.</Text>}
      </Card>
      <Card>
        <View style={s.row}>
          <View>
            <Text style={s.label}>Community support</Text>
            <Text style={s.helper}>{item.upvote_count ?? 0} students support this issue.</Text>
          </View>
          {!item.has_upvoted && item.status !== "closed" && item.status !== "rejected" && (
            <Pressable onPress={async()=>{try{await upvoteComplaint(item.id);setItem({...item,upvote_count:(item.upvote_count??0)+1,has_upvoted:true});}catch(e){Alert.alert("Unable to support",e instanceof Error?e.message:"Please try again.");}}}>
              <Text style={s.link}>Support issue</Text>
            </Pressable>
          )}
        </View>
      </Card>
      <Card>
        <Text style={s.label}>Status history</Text>
        {item.status_history?.length ? item.status_history.map((entry, index) => (
          <View style={s.timeline} key={entry.id}>
            <View style={[s.dot, index === item.status_history!.length - 1 && s.activeDot]} />
            <View style={{ flex: 1 }}>
              <Text style={index === item.status_history!.length - 1 ? s.label : s.muted}>
                {formatStatus(entry.to_status)}
              </Text>
              <Text style={s.helper}>
                {entry.from_status ? formatStatus(entry.from_status) + " → " + formatStatus(entry.to_status) : "Complaint submitted"}
                {" · "}
                {date(entry.created_at)}
              </Text>
            </View>
          </View>
        )) : (
          <Text style={s.muted}>No status history available yet.</Text>
        )}
      </Card>
    </ScrollView>
  );
}

function Profile({ back, go, logout }: { back: () => void; go: (screen: Screen) => void; logout: () => Promise<void> | void }) {
  const [me, setMe] = useState<{ id: string; name: string; email?: string; role?: string } | null>(null);
  const [stats, setStats] = useState({ total: 0, submitted: 0, resolved: 0, rejected: 0 });
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [sendingFeedback, setSendingFeedback] = useState(false);

  const loadProfile = async () => {
    try {
      const [profile, complaints, notifications] = await Promise.all([getMe(), getComplaints(), getNotifications()]);
      setMe(profile);
      setName(profile.name ?? "");
      setStats({
        total: complaints.length,
        submitted: complaints.filter((x: any) => x.status === "submitted").length,
        resolved: complaints.filter((x: any) => x.status === "resolved").length,
        rejected: complaints.filter((x: any) => x.status === "rejected").length,
      });
      setUnread(notifications.filter((x: any) => !x.read_at).length);
    } catch (e) {
      Alert.alert("Profile unavailable", e instanceof Error ? e.message : "Unable to load your profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProfile(); }, []);

  const saveProfile = async () => {
    if (!name.trim()) {
      Alert.alert("Name required", "Please enter your full name.");
      return;
    }
    try {
      setSaving(true);
      await updateMyProfileName(name.trim());
      setMe((current) => current ? { ...current, name: name.trim() } : current);
      setEditing(false);
      Alert.alert("Profile updated", "Your name has been saved.");
    } catch (e) {
      Alert.alert("Unable to update profile", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (!me?.email) {
      Alert.alert("Email unavailable", "We could not find an email address for this account.");
      return;
    }
    try {
      await resetPassword(me.email);
      Alert.alert("Password reset email sent", "Check your inbox for the secure password reset link.");
    } catch (e) {
      Alert.alert("Unable to send reset email", e instanceof Error ? e.message : "Please try again.");
    }
  };

  const sendFeedback = async () => {
    if (feedback.trim().length < 5) {
      Alert.alert("More detail needed", "Please enter at least 5 characters.");
      return;
    }
    try {
      setSendingFeedback(true);
      await submitAppFeedback(feedback.trim());
      setFeedback("");
      setFeedbackOpen(false);
      Alert.alert("Feedback sent", "Thank you for helping us improve GrievX.");
    } catch (e) {
      Alert.alert("Unable to send feedback", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setSendingFeedback(false);
    }
  };

  const menuRow = (symbol: string, title: string, subtitle: string, onPress: () => void, badgeText?: string) => (
    <Pressable style={s.profileMenuRow} onPress={onPress}>
      <View style={s.profileMenuIcon}><Text style={s.profileMenuSymbol}>{symbol}</Text></View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={s.profileMenuTitle}>{title}</Text>
        <Text style={s.profileMenuSubtitle}>{subtitle}</Text>
      </View>
      {badgeText ? <Text style={s.profileMenuBadge}>{badgeText}</Text> : null}
      <Text style={s.settingsChevron}>›</Text>
    </Pressable>
  );

  const confirmLogout = () => Alert.alert("Sign out?", "You will need to sign in again to access your complaints.", [
    { text: "Cancel", style: "cancel" },
    { text: "Sign out", style: "destructive", onPress: () => { void logout(); } },
  ]);

  return (
    <ScrollView contentContainerStyle={s.page}>
      <Header title="Profile" back={back} />
      <View style={s.profileHero}>
        <View style={s.profileAvatar}><Text style={s.profileLetter}>{(me?.name || "S").trim().charAt(0).toUpperCase()}</Text></View>
        <View style={{ flex: 1, gap: 5 }}>
          <Text style={s.profileHeroName}>{me?.name || (loading ? "Loading..." : "Student")}</Text>
          <Text style={s.profileHeroEmail}>{me?.email || "Student account"}</Text>
          <View style={s.rolePill}><Text style={s.rolePillText}>{(me?.role || "student").replace("_", " ").replace(/\b\w/g, (x) => x.toUpperCase())}</Text></View>
        </View>
        <Pressable style={s.editProfileButton} onPress={() => { setName(me?.name || ""); setEditing(true); }}>
          <Text style={s.editProfileButtonText}>✎  Edit</Text>
        </Pressable>
      </View>

      <View style={s.profileStats}>
        {[
          { value: stats.total, label: "Total", symbol: "▤", tone: C.blue },
          { value: stats.submitted, label: "Submitted", symbol: "➤", tone: "#D97706" },
          { value: stats.resolved, label: "Resolved", symbol: "✓", tone: C.green },
          { value: stats.rejected, label: "Rejected", symbol: "×", tone: C.red },
        ].map((item) => (
          <View key={item.label} style={s.profileStat}>
            <View style={[s.profileStatIcon, { backgroundColor: item.tone + "18" }]}><Text style={[s.profileStatSymbol, { color: item.tone }]}>{item.symbol}</Text></View>
            <Text style={s.profileStatValue}>{loading ? "—" : item.value}</Text>
            <Text style={s.profileStatLabel}>{item.label}</Text>
          </View>
        ))}
      </View>

      <Card>
        <Text style={s.profileSectionTitle}>My Activity</Text>
        {menuRow("☷", "My Complaints", "View and manage your raised complaints", () => go("complaints"))}
        {menuRow("♧", "Notifications", "Complaint updates and alerts", () => go("notifications"), unread ? String(unread) : undefined)}
      </Card>

      <Card>
        <Text style={s.profileSectionTitle}>Account</Text>
        {menuRow("♙", "Personal Information", "Update your name and view account email", () => { setName(me?.name || ""); setEditing(true); })}
        {menuRow("⬡", "Security", "Send a secure password reset email", changePassword)}
      </Card>

      <Card>
        <Text style={s.profileSectionTitle}>App</Text>
        {menuRow("⚙", "Settings", "Notification updates and app information", () => go("settings"))}
        {menuRow("ⓘ", "About GrievX", "About this campus complaint platform", () => Alert.alert("About GrievX", "GrievX Campus helps students report campus issues, track complaint progress and receive updates from campus teams."))}
      </Card>

      <Card>
        <Text style={s.profileSectionTitle}>Support</Text>
        {menuRow("?", "Help & Support", "Quick answers about using GrievX", () => Alert.alert("Help & Support", "• Report an issue: use the Report tab and provide a clear title, description and campus location.\n\n• Track a complaint: open My Complaints to view its latest status.\n\n• Edit or withdraw: available while a complaint is still submitted.\n\n• Updates: check the Alert tab for complaint notifications."))}
        {menuRow("▤", "Send Feedback", "Share suggestions or report a problem", () => setFeedbackOpen(true))}
      </Card>

      <Pressable style={s.logout} onPress={confirmLogout}>
        <Text style={s.logoutText}>⇥  Sign out</Text>
      </Pressable>

      <Modal visible={editing} transparent animationType="slide" onRequestClose={() => {
        if (!saving) setEditing(false);
      }}>
        <View style={s.editModalBackdrop}>
          <View style={s.editModalCard}>
            <Text style={s.cardTitle}>Personal information</Text>
            <Text style={s.label}>Full name</Text>
            <TextInput style={s.editInput} value={name} onChangeText={setName} maxLength={100} placeholder="Your full name" />
            <Text style={s.label}>Email address</Text>
            <TextInput style={[s.editInput, { opacity: 0.65 }]} value={me?.email || ""} editable={false} />
            <Text style={s.helper}>Email is managed by your sign-in account and cannot be changed here.</Text>
            <View style={s.editModalActions}>
              <Pressable style={s.cancelEditButton} disabled={saving} onPress={() => setEditing(false)}><Text style={s.cancelEditText}>Cancel</Text></Pressable>
              <Pressable style={s.saveEditButton} disabled={saving} onPress={saveProfile}><Text style={s.saveEditText}>{saving ? "Saving..." : "Save changes"}</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={feedbackOpen} transparent animationType="slide" onRequestClose={() => {
        if (!sendingFeedback) setFeedbackOpen(false);
      }}>
        <View style={s.editModalBackdrop}>
          <View style={s.editModalCard}>
            <Text style={s.cardTitle}>Send feedback</Text>
            <Text style={s.muted}>Tell us what is working well or what we should improve.</Text>
            <TextInput style={[s.editInput, s.editMultiline]} value={feedback} onChangeText={setFeedback} multiline textAlignVertical="top" maxLength={2000} placeholder="Write your feedback..." />
            <Text style={s.helper}>{feedback.length}/2000 characters</Text>
            <View style={s.editModalActions}>
              <Pressable style={s.cancelEditButton} disabled={sendingFeedback} onPress={() => setFeedbackOpen(false)}><Text style={s.cancelEditText}>Cancel</Text></Pressable>
              <Pressable style={s.saveEditButton} disabled={sendingFeedback} onPress={sendFeedback}><Text style={s.saveEditText}>{sendingFeedback ? "Sending..." : "Send feedback"}</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function Settings({ back, openNotifications }: { back: () => void; openNotifications: () => void }) {
  return (
    <ScrollView contentContainerStyle={s.page}>
      <Header title="Settings" back={back} />
      <Card>
        <View style={s.settingsDetailHeader}>
          <LineIcon name="settings" color={C.blue} size={22} />
          <Text style={s.cardTitle}>GrievX preferences</Text>
        </View>
        <Text style={s.muted}>Manage how you check updates and learn about the app.</Text>
        <Pressable style={s.settingsRow} onPress={openNotifications}>
          <View style={s.settingsIcon}><LineIcon name="bell" color={C.blue} size={21} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Notifications</Text>
            <Text style={s.helper}>View complaint updates and status alerts</Text>
          </View>
          <Text style={s.settingsChevron}>›</Text>
        </Pressable>
      </Card>
      <Card>
        <Text style={s.label}>About GrievX</Text>
        <Text style={s.muted}>GrievX Campus helps students report campus issues and follow their resolution.</Text>
        <Text style={s.helper}>Version 1.0 · Student mobile app</Text>
      </Card>
    </ScrollView>
  );
}

function LineIcon({ name, color, size = 22 }: { name: "home" | "clipboard" | "bell" | "user" | "settings"; color: string; size?: number }) {
  const scale = size / 22;
  const line = { borderColor: color, borderWidth: 1.8 * scale } as const;
  if (name === "home") return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <View style={{ position: "absolute", top: 3 * scale, width: 13 * scale, height: 13 * scale, borderTopWidth: 1.8 * scale, borderLeftWidth: 1.8 * scale, borderColor: color, transform: [{ rotate: "45deg" }] }} />
      <View style={{ position: "absolute", bottom: 2 * scale, width: 15 * scale, height: 11 * scale, borderTopWidth: 1.8 * scale, borderLeftWidth: 1.8 * scale, borderRightWidth: 1.8 * scale, borderColor: color, alignItems: "center", justifyContent: "flex-end" }}>
        <View style={{ width: 4 * scale, height: 6 * scale, borderWidth: 1.4 * scale, borderBottomWidth: 0, borderColor: color }} />
      </View>
    </View>
  );
  if (name === "clipboard") return (
    <View style={{ width: 15 * scale, height: 18 * scale, borderRadius: 2 * scale, ...line, alignItems: "center", paddingTop: 6 * scale, gap: 2.5 * scale }}>
      <View style={{ position: "absolute", top: -3 * scale, width: 8 * scale, height: 5 * scale, borderRadius: 2 * scale, backgroundColor: C.white, ...line }} />
      <View style={{ width: 8 * scale, height: 1.4 * scale, backgroundColor: color }} />
      <View style={{ width: 8 * scale, height: 1.4 * scale, backgroundColor: color }} />
      <View style={{ width: 6 * scale, height: 1.4 * scale, backgroundColor: color }} />
    </View>
  );
  if (name === "bell") return (
    <View style={{ width: 18 * scale, height: 20 * scale, alignItems: "center", justifyContent: "flex-end" }}>
      <View style={{ position: "absolute", top: 3 * scale, width: 15 * scale, height: 13 * scale, borderTopLeftRadius: 9 * scale, borderTopRightRadius: 9 * scale, borderBottomLeftRadius: 3 * scale, borderBottomRightRadius: 3 * scale, borderWidth: 1.8 * scale, borderBottomWidth: 0, borderColor: color }} />
      <View style={{ width: 18 * scale, height: 3 * scale, borderTopWidth: 1.8 * scale, borderColor: color }} />
      <View style={{ width: 4 * scale, height: 3 * scale, borderBottomLeftRadius: 4 * scale, borderBottomRightRadius: 4 * scale, backgroundColor: color }} />
      <View style={{ position: "absolute", top: 1 * scale, width: 3 * scale, height: 3 * scale, borderRadius: 2 * scale, backgroundColor: color }} />
    </View>
  );
  if (name === "user") return (
    <View style={{ width: 19 * scale, height: 20 * scale, alignItems: "center", justifyContent: "flex-end", gap: 2 * scale }}>
      <View style={{ width: 7 * scale, height: 7 * scale, borderRadius: 4 * scale, borderWidth: 1.8 * scale, borderColor: color }} />
      <View style={{ width: 17 * scale, height: 9 * scale, borderTopLeftRadius: 10 * scale, borderTopRightRadius: 10 * scale, borderWidth: 1.8 * scale, borderBottomWidth: 0, borderColor: color }} />
    </View>
  );
  return <Text style={{ color, fontSize: size, lineHeight: size + 2 }}>⚙</Text>;
}

function Notifications({ back, openComplaint }: { back: () => void; openComplaint: (id: string) => void }) {
  const [items, setItems] = useState<import("./src/api").Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const load = async () => {
      try {
        setLoading(true);
        const data = await getNotifications();
        if (mounted) setItems(data);

        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return;

        channel = supabase
          .channel(`notifications-${userData.user.id}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "notifications",
              filter: `recipient_id=eq.${userData.user.id}`,
            },
            (payload) => {
              const next = payload.new as import("./src/api").Notification;
              if (!mounted) return;
              setItems((current) => [
                next,
                ...current.filter((item) => item.id !== next.id),
              ]);
            },
          )
          .subscribe();
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : "Unable to load notifications.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const unread = items.filter((item) => !item.read_at).length;

  const read = async (item: import("./src/api").Notification) => {
    if (!item.read_at) {
      try {
        await markNotificationRead(item.id);
        setItems((current) => current.map((x) =>
          x.id === item.id ? { ...x, read_at: new Date().toISOString() } : x
        ));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to update notification.");
        return;
      }
    }

    if (item.complaint_id) openComplaint(item.complaint_id);
  };

  const markAll = async () => {
    try {
      await markAllNotificationsRead();
      setItems((current) => current.map((item) => ({
        ...item,
        read_at: item.read_at ?? new Date().toISOString(),
      })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update notifications.");
    }
  };

  return (
    <ScrollView contentContainerStyle={s.page}>
      <Header title="Notifications" back={back} />
      <View style={s.notificationHeader}>
        <View>
          <Text style={s.cardTitle}>{unread ? `${unread} unread update${unread === 1 ? "" : "s"}` : "All caught up"}</Text>
          <Text style={s.muted}>Status changes and complaint updates appear here.</Text>
        </View>
        {unread > 0 && (
          <Pressable onPress={markAll}>
            <Text style={s.link}>Mark all read</Text>
          </Pressable>
        )}
      </View>

      {loading ? <ActivityIndicator color={C.blue} /> : error ? (
        <Text style={s.error}>{error}</Text>
      ) : items.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.cardTitle}>No notifications yet</Text>
          <Text style={s.muted}>You'll see an update here when your complaint is submitted or its status changes.</Text>
        </View>
      ) : items.map((item) => (
        <Pressable
          key={item.id}
          style={[s.notificationCard, !item.read_at && s.notificationUnread]}
          onPress={() => read(item)}
        >
          <View style={s.row}>
            <Text style={s.label}>{item.title}</Text>
            {!item.read_at && <View style={s.notificationDot} />}
          </View>
          <Text style={s.muted}>{item.message}</Text>
          <Text style={s.helper}>{date(item.created_at)}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function Nav({ active, go }: { active: Screen; go: (x: Screen) => void }) {
  const items: { key: Screen; icon: "home" | "clipboard" | "bell" | "user"; label: string }[] = [
    { key: "home", icon: "home", label: "Home" },
    { key: "complaints", icon: "clipboard", label: "Complaints" },
    { key: "notifications", icon: "bell", label: "Alert" },
    { key: "profile", icon: "user", label: "Profile" },
  ];
  return (
    <View style={s.nav}>
      {items.slice(0, 2).map(({ key, icon, label }) => {
        const selected = active === key;
        return <Pressable key={key} style={s.navItem} onPress={() => go(key)}>
          <LineIcon name={icon} color={selected ? C.blue : C.muted} size={21} />
          <Text style={[s.navLabel, selected && s.navActive]}>{label}</Text>
        </Pressable>;
      })}
      <Pressable style={s.reportNavItem} onPress={() => go("report")}>
        <View style={[s.reportNavCircle, active === "report" && s.reportNavCircleActive]}>
          <Text style={s.reportNavPlus}>+</Text>
        </View>
        <Text style={[s.navLabel, active === "report" && s.navActive]}>Report</Text>
      </Pressable>
      {items.slice(2).map(({ key, icon, label }) => {
        const selected = active === key;
        return <Pressable key={key} style={s.navItem} onPress={() => go(key)}>
          <LineIcon name={icon} color={selected ? C.blue : C.muted} size={21} />
          <Text style={[s.navLabel, selected && s.navActive]}>{label}</Text>
        </Pressable>;
      })}
    </View>
  );
}

function Header({ title, back }: { title: string; back: () => void }) {
  return (
    <View style={s.header}>
      <Pressable onPress={back} style={s.back}>
        <Text style={s.backText}>‹</Text>
      </Pressable>
      <Text style={s.headerTitle}>{title}</Text>
      <View style={{ width: 44 }} />
    </View>
  );
}

function Field({
  label,
  inputStyle,
  ...p
}: { label: string; inputStyle?: object } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={s.field}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <TextInput {...p} style={[s.input, inputStyle]} placeholderTextColor="#8A8E9A" />
    </View>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={s.card}>{children}</View>;
}

function Primary({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={[s.primary, disabled && s.disabled]}>
      <Text style={s.primaryText}>{label}</Text>
    </Pressable>
  );
}

function Status({ status }: { status: string }) {
  const x = status.toLowerCase();
  const tone =
    x === "submitted"
      ? ["#FEF3C7", "#B45309", "#F59E0B"]
      : x === "assigned"
        ? ["#EFF6FF", "#1D4ED8", "#3B82F6"]
        : x === "in_progress"
          ? ["#EEF2FF", "#4338CA", "#6366F1"]
          : x === "resolved" || x === "closed"
            ? ["#ECFDF5", "#047857", C.green]
            : ["#FEF2F2", "#B91C1C", "#EF4444"];

  return (
    <View style={[s.status, { backgroundColor: tone[0] as string }]}>
      <View style={[s.dot, { backgroundColor: tone[2] as string }]} />
      <Text style={[s.statusText, { color: tone[1] as string }]}>{status.replace("_", " ")}</Text>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.helper}>{label}</Text>
    </View>
  );
}

function Action({
  title,
  sub,
  icon,
  onPress,
}: {
  title: string;
  sub: string;
  icon: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={s.action} onPress={onPress}>
      <Text style={s.actionIcon}>{icon}</Text>
      <Text style={s.label}>{title}</Text>
      <Text style={s.helper}>{sub}</Text>
    </Pressable>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <SafeAreaView style={s.centered}>{children}</SafeAreaView>;
}

function formatStatus(v: string) {
  return v.replace("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function date(v: string) {
  return new Date(v).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const s = StyleSheet.create({
  auth: { flexGrow: 1, padding: 20, justifyContent: "center", gap: 18 },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.navy, alignItems: "center", justifyContent: "center" },
  logoText: { color: C.white, fontSize: 22, fontWeight: "800" },
  brandText: { fontSize: 17, fontWeight: "700", color: C.text },
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 1.1, color: C.blue },
  display: { fontSize: 30, lineHeight: 36, fontWeight: "700", color: C.text },
  body: { fontSize: 16, lineHeight: 24, color: C.text },
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: "600", color: C.text },
  input: { backgroundColor: "#F2F3FF", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: C.text, fontSize: 14 },
  card: { backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 16, gap: 10 },
  primary: { minHeight: 48, borderRadius: 12, backgroundColor: C.blue, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, marginTop: 8 },
  primaryText: { color: C.white, fontSize: 14, fontWeight: "700" },
  disabled: { opacity: 0.55 },
  link: { color: C.blue, fontSize: 13, fontWeight: "600", textAlign: "center", paddingVertical: 8 },

  app: { flex: 1, backgroundColor: C.bg },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.bg },

  authScreen: { flex: 1, backgroundColor: "#FAF8FF" },
  authScroll: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 28, paddingBottom: 34, alignItems: "center" },
  portalPill: {
    minHeight: 72,
    width: "92%",
    maxWidth: 650,
    borderRadius: 40,
    backgroundColor: "#EDF0FF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingHorizontal: 24,
    marginBottom: 30,
  },
  portalMark: { width: 18, height: 18, borderRadius: 5, backgroundColor: C.blue, alignItems: "center", justifyContent: "center" },
  portalMarkText: { color: C.white, fontSize: 11, fontWeight: "900" },
  portalPillText: { color: "#07185A", fontSize: 20, fontWeight: "500", letterSpacing: 1.2 },
  authTitle: { color: C.navy, fontSize: 46, lineHeight: 54, fontWeight: "800", textAlign: "center" },
  authSubtitle: { color: "#3F4250", fontSize: 23, lineHeight: 33, textAlign: "center", marginTop: 8, marginBottom: 30 },
  authCard: {
    width: "100%",
    maxWidth: 650,
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 28,
    gap: 20,
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  fieldBlock: { gap: 9 },
  labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  authLabel: { color: C.text, fontSize: 20, fontWeight: "600" },
  verified: { color: C.blue, fontSize: 19, fontWeight: "600" },
  authInputWrap: {
    minHeight: 78,
    borderRadius: 20,
    backgroundColor: C.softBlue,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 22,
  },
  inputIcon: { width: 36, color: "#747989", fontSize: 28, textAlign: "center" },
  authInput: { flex: 1, color: C.text, fontSize: 20, paddingVertical: 16, paddingHorizontal: 10 },
  eyeButton: { padding: 8 },
  eye: { color: "#747989", fontSize: 27 },
  keepRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingTop: 2 },
  checkbox: { width: 38, height: 38, borderRadius: 10, borderWidth: 2, borderColor: "#AAB3D5", alignItems: "center", justifyContent: "center" },
  checkboxOn: { backgroundColor: C.blue, borderColor: C.blue },
  checkmark: { color: C.white, fontSize: 26, fontWeight: "900", lineHeight: 29 },
  keepText: { color: "#3D4150", fontSize: 20 },
  authError: { color: C.red, fontSize: 14, lineHeight: 20 },
  portalButton: {
    minHeight: 78,
    borderRadius: 18,
    backgroundColor: "#0759DA",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    paddingHorizontal: 24,
    shadowColor: "#0759DA",
    shadowOpacity: 0.22,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  portalButtonText: { color: C.white, fontSize: 22, fontWeight: "800" },
  portalArrow: { color: C.white, fontSize: 34, marginLeft: 14, marginTop: -3 },
  ssoDivider: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 1 },
  dividerLine: { flex: 1, height: 1.5, backgroundColor: "#DCE0EF" },
  ssoText: { color: "#7A7D88", fontSize: 18, letterSpacing: 1 },
  googleButton: {    minHeight: 82,
    borderRadius: 18,
    backgroundColor: "#EDF0FF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 22,
    paddingHorizontal: 18,
  },
  googleG: { fontSize: 26, fontWeight: "800", color: "#4285F4" },
  googleText: { color: "#071A5B", fontSize: 19, lineHeight: 27, fontWeight: "600", textAlign: "center" },
  registerPrompt: { color: "#414451", fontSize: 19, textAlign: "center", marginTop: 34 },
  registerLink: { color: C.blue, fontWeight: "600" },
  emergency: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.paleRed,
    borderRadius: 30,
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginTop: 36,
    maxWidth: 590,
  },
  emergencyIcon: { color: "#B80D13", fontSize: 24, marginRight: 8 },
  emergencyText: { color: "#B80D13", fontSize: 15, fontWeight: "600" },
  emergencyNumber: { color: "#8D1218", fontSize: 15, fontWeight: "700", textDecorationLine: "underline" },
  authFootnote: { color: "#9A9CA7", fontSize: 11, marginTop: 22 },

  page: { padding: 16, paddingBottom: 112, gap: 16 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  greeting: { fontSize: 24, lineHeight: 31, fontWeight: "700", color: C.text, marginTop: 4 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#DAE2FD", alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 18, fontWeight: "800", color: C.navy },
  hero: { backgroundColor: C.navy, borderRadius: 22, padding: 20, flexDirection: "row", minHeight: 185 },
  heroIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#18316F", alignItems: "center", justifyContent: "center", alignSelf: "center", marginLeft: 10 },
  heroCheck: { color: C.white, fontSize: 28, fontWeight: "700" },
  heroTitle: { fontSize: 23, lineHeight: 29, fontWeight: "700", color: C.white },
  heroBody: { fontSize: 14, lineHeight: 20, color: "#DCE1FF", marginVertical: 8, maxWidth: 230 },
  section: { fontSize: 18, fontWeight: "600", color: C.text },
  stats: { flexDirection: "row", gap: 10 },
  stat: { flex: 1, padding: 14, backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 16 },
  statValue: { fontSize: 22, fontWeight: "700", color: C.text, marginBottom: 4 },
  actions: { flexDirection: "row", gap: 10 },
  action: { flex: 1, minHeight: 120, padding: 16, backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 16 },
  actionIcon: { fontSize: 24, color: C.blue, marginBottom: 10 },
  progress: { backgroundColor: C.softBlue, borderRadius: 16, padding: 16, gap: 5 },
  step: { color: C.blue, fontSize: 10, fontWeight: "700", letterSpacing: 0.8 },
  area: { minHeight: 110, textAlignVertical: "top" },
  imageBox: { alignItems: "flex-start", gap: 8 },
  image: { width: "100%", height: 180, borderRadius: 12, backgroundColor: C.softBlue },
  upload: { minHeight: 110, borderWidth: 1, borderStyle: "dashed", borderColor: C.border, borderRadius: 12, alignItems: "center", justifyContent: "center", gap: 6 },
  plus: { color: C.blue, fontSize: 30, lineHeight: 34 },
  cardTitle: { fontSize: 20, lineHeight: 26, fontWeight: "600", color: C.text },
  error: { fontSize: 13, color: C.red },
  muted: { fontSize: 14, lineHeight: 20, color: C.muted },
  helper: { fontSize: 12, lineHeight: 17, color: C.muted },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.white, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  backText: { fontSize: 31, lineHeight: 34, color: C.text, marginTop: -4 },
  headerTitle: { fontSize: 20, fontWeight: "700", color: C.text },

  reportRoot: { flex: 1, backgroundColor: "#FAF9FF" },
  reportPage: { paddingHorizontal: 13, paddingBottom: 118, gap: 12 },
  reportTop: { minHeight: 54, backgroundColor: C.white, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4 },
  reportBrand: { flexDirection: "row", alignItems: "center", gap: 9 },
  miniLogo: { width: 20, height: 20, borderRadius: 6, backgroundColor: C.blue, alignItems: "center", justifyContent: "center" },
  miniLogoText: { color: C.white, fontSize: 11, fontWeight: "900" },
  reportBrandTitle: { color: C.text, fontSize: 17, fontWeight: "600" },
  reportBrandSub: { color: "#4E5260", fontSize: 9.5, marginTop: 1 },
  photoAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#C7D2FE", borderWidth: 2, borderColor: C.white, alignItems: "center", justifyContent: "center" },
  photoAvatarText: { color: C.navy, fontWeight: "800" },
  routeCard: { minHeight: 103, borderRadius: 14, backgroundColor: "#EEF1FF", padding: 13, flexDirection: "row", overflow: "hidden" },
  routeStep: { color: C.blue, fontSize: 9, letterSpacing: 0.5, fontWeight: "700" },
  routeBadge: { color: C.navy, backgroundColor: "#DCE3FF", borderRadius: 8, overflow: "hidden", paddingHorizontal: 3 },
  routeTitle: { color: C.text, fontSize: 18, fontWeight: "600", marginTop: 5 },
  routeBody: { color: C.muted, fontSize: 11.5, lineHeight: 16, maxWidth: 220, marginTop: 3 },
  routeIcon: { width: 67, height: 67, borderRadius: 34, backgroundColor: "#DCE4FF", alignItems: "center", justifyContent: "center", alignSelf: "center" },
  routeIconText: { color: C.blue, fontSize: 25 },
  formCard: { backgroundColor: C.white, borderRadius: 13, padding: 13, borderWidth: 1, borderColor: "#EEEEF4", gap: 8 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  formTitle: { color: C.text, fontSize: 12.5, lineHeight: 17, fontWeight: "500" },
  required: { color: C.red },
  selectedLabel: { color: C.blue, fontSize: 10.5, fontWeight: "500", paddingTop: 1 },
  counter: { color: "#666A74", fontSize: 9.5, paddingTop: 2 },
  formHint: { color: C.muted, fontSize: 9.5, lineHeight: 13 },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  categoryItem: { width: "31.9%", minHeight: 68, borderRadius: 10, backgroundColor: "#F0F2FF", alignItems: "center", justifyContent: "center", position: "relative", paddingHorizontal: 3 },
  categorySelected: { backgroundColor: "#DDE5FF" },
  categoryIcon: { color: "#172038", fontSize: 22, marginBottom: 5 },
  categoryIconSelected: { color: "#005DE6" },
  categoryText: { color: "#11172A", fontSize: 9.5, textAlign: "center" },
  categoryTextSelected: { color: "#0A2D83", fontWeight: "600" },
  categoryCheck: { position: "absolute", right: 5, top: 5, width: 13, height: 13, borderRadius: 7, backgroundColor: C.blue, alignItems: "center", justifyContent: "center" },
  categoryCheckText: { color: C.white, fontSize: 8, fontWeight: "900" },
  compactInput: { minHeight: 36, borderRadius: 9, backgroundColor: "#EEF1FF", flexDirection: "row", alignItems: "center", paddingHorizontal: 9 },
  compactIcon: { color: "#697080", fontSize: 14, marginRight: 6 },
  compactTextInput: { flex: 1, color: C.text, fontSize: 11.5, paddingVertical: 7 },
  tipText: { color: C.blue, fontSize: 9.5, lineHeight: 12, width: 145, textAlign: "left", paddingTop: 1 },
  descriptionInput: { minHeight: 86, borderRadius: 9, backgroundColor: "#EEF1FF", color: C.text, fontSize: 10.5, lineHeight: 15, paddingHorizontal: 10, paddingVertical: 9 },
  audioRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  audioPill: { backgroundColor: "#E6EAFF", borderRadius: 16, paddingHorizontal: 9, paddingVertical: 7, flexDirection: "row", alignItems: "center", gap: 5 },
  audioIcon: { color: C.blue, fontSize: 12 },
  audioText: { color: "#334070", fontSize: 9.5 },
  transcribed: { flexDirection: "row", alignItems: "center", gap: 5 },
  blueDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.blue },
  transcribedText: { color: "#5C6270", fontSize: 9.5 },
  evidenceRow: { flexDirection: "row", gap: 7 },
  evidencePreview: { width: "50%", height: 94, borderRadius: 9, overflow: "hidden", backgroundColor: "#DDE1EC", position: "relative" },
  evidenceImage: { width: "100%", height: "100%" },
  removeImage: { position: "absolute", right: 5, top: 5, width: 20, height: 20, borderRadius: 10, backgroundColor: "#162038", alignItems: "center", justifyContent: "center" },
  removeImageText: { color: C.white, fontSize: 16, lineHeight: 17 },
  fileCaption: { position: "absolute", left: 6, right: 6, bottom: 4, flexDirection: "row", justifyContent: "space-between" },
  fileName: { color: C.white, fontSize: 8.5, maxWidth: 95 },
  fileSize: { color: C.white, fontSize: 8 },
  evidenceEmpty: { flex: 1, minHeight: 94, borderRadius: 9, backgroundColor: "#EEF1FF", alignItems: "center", justifyContent: "center" },
  evidenceEmptyIcon: { color: C.blue, fontSize: 21, marginBottom: 3 },
  addMedia: { color: C.text, fontSize: 9.5 },
  mediaHint: { color: C.muted, fontSize: 8.5, marginTop: 2 },
  preciseNode: { color: C.blue, fontSize: 9.5, paddingTop: 2 },
  locationInput: { minHeight: 36, borderRadius: 9, backgroundColor: "#EEF1FF", flexDirection: "row", alignItems: "center", paddingHorizontal: 8 },
  locationIcon: { color: "#61697B", fontSize: 15, width: 22, textAlign: "center" },
  locationTextInput: { flex: 1, color: C.text, fontSize: 10.5, paddingVertical: 7 },
  chevron: { color: "#4E5667", fontSize: 15 },
  noGpsNote: { minHeight: 36, borderRadius: 9, backgroundColor: "#EEF1FF", flexDirection: "row", alignItems: "center", paddingHorizontal: 9, gap: 7 },
  noGpsIcon: { color: C.blue, fontSize: 16 },
  noGpsText: { color: "#3D4557", fontSize: 9.5, flex: 1 },
  priorityRow: { flexDirection: "row", gap: 6 },
  priorityItem: { flex: 1, minHeight: 51, borderRadius: 9, backgroundColor: "#EEF1FF", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "transparent" },
  prioritySelected: { backgroundColor: "#DDE5FF", borderColor: "#D2DBFA" },
  priorityTitle: { color: C.text, fontSize: 9.5 },
  priorityTitleSelected: { color: "#0A4BC0", fontWeight: "600" },
  prioritySub: { color: "#646A78", fontSize: 8.2, marginTop: 2 },
  priorityInfo: { backgroundColor: "#E1E7FF", borderRadius: 7, padding: 7, flexDirection: "row", gap: 7 },
  infoIcon: { width: 14, height: 14, borderRadius: 7, backgroundColor: "#D2DBFF", color: C.blue, fontSize: 9, fontWeight: "800", textAlign: "center", lineHeight: 14 },
  priorityInfoText: { flex: 1, color: "#50586B", fontSize: 8.5, lineHeight: 12 },
  anonymousCard: { minHeight: 58, backgroundColor: C.white, borderRadius: 12, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 9, borderWidth: 1, borderColor: "#EEEEF4" },
  anonymousIcon: { width: 31, height: 31, borderRadius: 16, backgroundColor: "#E1E7FF", alignItems: "center", justifyContent: "center" },
  anonymousIconText: { color: C.blue, fontSize: 20 },
  switch: { width: 38, height: 22, borderRadius: 12, backgroundColor: "#D8E1FF", padding: 2, justifyContent: "center" },
  switchOn: { backgroundColor: "#7CA2F8" },
  switchThumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: C.white },
  switchThumbOn: { alignSelf: "flex-end" },
  submitComplaint: { minHeight: 40, borderRadius: 9, backgroundColor: "#0059DB", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 2 },
  submitComplaintText: { color: C.white, fontSize: 11, fontWeight: "800" },
  submitArrow: { color: C.white, fontSize: 18 },
  ticketNote: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, marginTop: -4 },
  ticketIcon: { color: C.green, fontSize: 12 },
  ticketText: { color: "#666B77", fontSize: 8.5 },

  nav: { position: "absolute", left: 0, right: 0, bottom: 0, height: 67, borderTopWidth: 1, borderTopColor: "#E7E8F0", backgroundColor: C.white, flexDirection: "row", alignItems: "center", paddingHorizontal: 3 },
  navItem: { flex: 1, alignItems: "center", gap: 2 },
  navIcon: { fontSize: 19, color: "#252C3E" },
  navLabel: { fontSize: 9, fontWeight: "600", color: C.muted },
  navActive: { color: C.blue },
  reportNavItem: { flex: 1, alignItems: "center", justifyContent: "center", marginTop: -18 },
  reportNavCircle: { width: 43, height: 43, borderRadius: 22, backgroundColor: "#0A5CDA", alignItems: "center", justifyContent: "center", borderWidth: 4, borderColor: C.white },
  reportNavCircleActive: { backgroundColor: "#0A5CDA" },
  reportNavPlus: { color: C.white, fontSize: 28, lineHeight: 30, fontWeight: "300" },
  settingsRow: { minHeight: 66, backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  settingsIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.softBlue, alignItems: "center", justifyContent: "center" },
  settingsChevron: { color: C.muted, fontSize: 26 },
  settingsDetailHeader: { flexDirection: "row", alignItems: "center", gap: 10 },

  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  status: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", borderRadius: 999, paddingVertical: 5, paddingHorizontal: 10, gap: 6 },
  statusText: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  dot: { width: 6, height: 6, borderRadius: 3 },
  date: { fontSize: 11, color: C.muted },
  complaint: { backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 16, marginBottom: 10, gap: 8 },
  complaintTitle: { fontSize: 17, fontWeight: "700", color: C.text },
  complaintActions: { flexDirection: "row", justifyContent: "flex-end", gap: 9, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10, marginTop: 4 },
  editComplaintButton: { borderWidth: 1.5, borderColor: C.blue, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 15 },
  editComplaintText: { color: C.blue, fontSize: 13, fontWeight: "700" },
  withdrawComplaintButton: { borderWidth: 1.5, borderColor: C.red, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 13 },
  withdrawComplaintText: { color: C.red, fontSize: 13, fontWeight: "700" },
  editModalBackdrop: { flex: 1, backgroundColor: "rgba(6,22,74,0.42)", justifyContent: "center", padding: 20 },
  editModalCard: { backgroundColor: C.white, borderRadius: 18, padding: 18, gap: 9 },
  editInput: { minHeight: 43, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, color: C.text, fontSize: 14 },
  editMultiline: { minHeight: 105 },
  editModalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 8 },
  cancelEditButton: { paddingVertical: 11, paddingHorizontal: 15, borderRadius: 10, backgroundColor: C.softBlue },
  cancelEditText: { color: C.navy, fontWeight: "700" },
  saveEditButton: { paddingVertical: 11, paddingHorizontal: 16, borderRadius: 10, backgroundColor: C.blue },
  saveEditText: { color: C.white, fontWeight: "700" },

  detailTitle: { fontSize: 24, lineHeight: 30, fontWeight: "700", color: C.text },
  file: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 7 },
  evidenceDetail: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  evidenceDetailImage: { width: 88, height: 88, borderRadius: 10, backgroundColor: C.softBlue },
  evidenceDetailPlaceholder: { width: 88, height: 88, borderRadius: 10, backgroundColor: C.softBlue, alignItems: "center", justifyContent: "center" },
  evidenceDetailPlaceholderText: { color: C.blue, fontSize: 28 },
  timeline: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9 },
  activeDot: { backgroundColor: C.blue },
  profileHero: { backgroundColor: "#EAF0FF", borderWidth: 1, borderColor: "#D8E2FF", borderRadius: 20, padding: 18, flexDirection: "row", alignItems: "center", gap: 13 },
  profileHeroName: { fontSize: 22, fontWeight: "800", color: C.text },
  profileHeroEmail: { fontSize: 13, color: C.muted },
  rolePill: { alignSelf: "flex-start", borderRadius: 20, backgroundColor: "#D8E5FF", paddingHorizontal: 11, paddingVertical: 5, marginTop: 3 },
  rolePillText: { color: C.blue, fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
  editProfileButton: { borderWidth: 1.3, borderColor: C.blue, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 10, alignSelf: "flex-start" },
  editProfileButtonText: { color: C.blue, fontSize: 12, fontWeight: "700" },
  profileStats: { flexDirection: "row", gap: 7 },
  profileStat: { flex: 1, backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingVertical: 11, paddingHorizontal: 4, alignItems: "center", gap: 3 },
  profileStatIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  profileStatSymbol: { fontSize: 18, fontWeight: "800" },
  profileStatValue: { fontSize: 18, fontWeight: "800", color: C.text },
  profileStatLabel: { fontSize: 10, color: C.muted, textAlign: "center" },
  profileSectionTitle: { fontSize: 16, fontWeight: "800", color: C.text, marginBottom: 2 },
  profileMenuRow: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 5 },
  profileMenuIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.softBlue, alignItems: "center", justifyContent: "center" },
  profileMenuSymbol: { fontSize: 19, color: C.blue, fontWeight: "700" },
  profileMenuTitle: { fontSize: 14, fontWeight: "700", color: C.text },
  profileMenuSubtitle: { fontSize: 11, color: C.muted, lineHeight: 15 },
  profileMenuBadge: { color: C.white, backgroundColor: C.blue, overflow: "hidden", borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, fontSize: 10, fontWeight: "700" },

  profile: { alignItems: "center", backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 18, padding: 24, gap: 5 },
  profileAvatar: { width: 82, height: 82, borderRadius: 41, backgroundColor: "#DAE2FD", alignItems: "center", justifyContent: "center" },
  profileLetter: { fontSize: 34, fontWeight: "800", color: C.navy },
  empty: { backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 18, padding: 28, alignItems: "center", gap: 8 },
  notificationHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  notificationCard: { backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 16, gap: 8 },
  notificationUnread: { borderColor: "#B9C9F7", backgroundColor: "#F6F8FF" },
  notificationDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.blue },
  logout: { height: 52, borderRadius: 14, borderWidth: 1, borderColor: "#F1B4B4", backgroundColor: "#FEF2F2", alignItems: "center", justifyContent: "center" },
  logoutText: { color: C.red, fontWeight: "800", fontSize: 15 },
});