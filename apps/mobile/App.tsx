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

type Screen = "home" | "report" | "complaints" | "detail" | "notifications" | "profile";
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
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);

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
        setName("");
        setPassword("");
        setError("Account created successfully. Please sign in.");
        setMode("login");
        return;
      }

      await login(email.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    const value = email.trim();
    if (!value) {
      Alert.alert("Enter your email", "Enter your university email first.");
      return;
    }
    try {
      setBusy(true);
      await resetPassword(value);
      Alert.alert("Reset email sent", "Check your inbox for the password reset link.");
    } catch (e) {
      Alert.alert("Unable to reset password", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={s.authScreen}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={s.authScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={s.portalPill}>
            <View style={s.portalMark}><Text style={s.portalMarkText}>✓</Text></View>
            <Text style={s.portalPillText}>STUDENT GRIEVANCE PORTAL</Text>
          </View>

          <Text style={s.authTitle}>{mode === "login" ? "Welcome back!" : "Create your account"}</Text>
          <Text style={s.authSubtitle}>
            {mode === "login"
              ? "Sign in with your University Roll No / SRN to report\nor track issues."
              : "Create your student account to report\nand track campus issues."}
          </Text>

          <View style={s.authCard}>
            {mode === "register" && (
              <Field
                label="Full name"
                placeholder="Enter your full name"
                value={name}
                onChangeText={setName}
              />
            )}

            <View style={s.fieldBlock}>
              <View style={s.labelRow}>
                <Text style={s.authLabel}>University Email</Text>
                {mode === "login" && <Text style={s.verified}>STUDENT ACCESS</Text>}
              </View>
              <View style={s.authInputWrap}>
                <Text style={s.inputIcon}>▣</Text>
                <TextInput
                  style={s.authInput}
                  placeholder="student@pesu.pes.edu"
                  placeholderTextColor="#858896"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
            </View>

            <View style={s.fieldBlock}>
              <View style={s.labelRow}>
                <Text style={s.authLabel}>Password</Text>
                {mode === "login" && (
                  <Pressable onPress={forgot} disabled={busy}>
                    <Text style={s.verified}>Forgot Password?</Text>
                  </Pressable>
                )}
              </View>
              <View style={s.authInputWrap}>
                <Text style={s.inputIcon}>▣</Text>
                <TextInput
                  style={s.authInput}
                  placeholder="Enter university password"
                  placeholderTextColor="#858896"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <Pressable onPress={() => setShowPassword((v) => !v)} style={s.eyeButton}>
                  <Text style={s.eye}>{showPassword ? "◉" : "◌"}</Text>
                </Pressable>
              </View>
            </View>

            {mode === "login" && (
              <Pressable style={s.keepRow} onPress={() => setKeepSignedIn((v) => !v)}>
                <View style={[s.checkbox, keepSignedIn && s.checkboxOn]}>
                  {keepSignedIn && <Text style={s.checkmark}>✓</Text>}
                </View>
                <Text style={s.keepText}>Keep me signed in on this device</Text>
              </Pressable>
            )}

            {!!error && <Text style={s.authError}>{error}</Text>}

            <Pressable
              style={[s.portalButton, busy && { opacity: 0.55 }]}
              onPress={submit}
              disabled={busy}
            >
              <Text style={s.portalButtonText}>
                {busy
                  ? "Please wait..."
                  : mode === "login"
                    ? "Sign In to Campus Portal"
                    : "Create Campus Account"}
              </Text>
              <Text style={s.portalArrow}>→</Text>
            </Pressable>

            {mode === "login" && (
              <>
                <View style={s.ssoDivider}>
                  <View style={s.dividerLine} />
                  <Text style={s.ssoText}>CAMPUS SSO</Text>
                  <View style={s.dividerLine} />
                </View>

                <Pressable
                  style={s.googleButton}
                  onPress={() =>
                    Alert.alert(
                      "Campus SSO",
                      "Google Workspace sign-in is shown in the portal design but is not configured in the current Supabase project yet.",
                    )
                  }
                >
                  <Text style={s.googleG}>G</Text>
                  <Text style={s.googleText}>Sign in with Campus Google Workspace\n(@pesu.pes.edu)</Text>
                </Pressable>
              </>
            )}
          </View>

          <Pressable
            onPress={() => {
              setError("");
              setMode(mode === "login" ? "register" : "login");
            }}
          >
            <Text style={s.registerPrompt}>
              {mode === "login" ? "New student? " : "Already registered? "}
              <Text style={s.registerLink}>
                {mode === "login" ? "Register your campus account" : "Sign in to your account"}
              </Text>
            </Text>
          </Pressable>

          {mode === "login" && (
            <View style={s.emergency}>
              <Text style={s.emergencyIcon}>♢</Text>
              <Text style={s.emergencyText}>Emergency / Security helpline: </Text>
              <Text style={s.emergencyNumber}>1800-CAMPUS-911</Text>
            </View>
          )}

          <Text style={s.authFootnote}>
            "Secure campus access · Session managed by Supabase."
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
  const [counts, setCounts] = useState({ submitted: 0, progress: 0, resolved: 0 });
  useEffect(() => {
    getMe().then(setMe).catch(() => {});
    getComplaints().then((items) => {
      setCounts({
        submitted: items.filter((x) => x.status?.toLowerCase() === "submitted").length,
        progress: items.filter((x) => ["assigned", "in_progress"].includes(x.status?.toLowerCase())).length,
        resolved: items.filter((x) => ["resolved", "closed"].includes(x.status?.toLowerCase())).length,
      });
    }).catch(() => {});
  }, []);
  const first = me?.name?.split(" ")[0] || "Student";

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
          <Text style={s.heroBody}>Report an issue in a few simple steps and follow its progress.</Text>
          <Primary label="Report an issue" onPress={() => go("report")} />
        </View>
        <View style={s.heroIcon}><Text style={s.heroCheck}>✓</Text></View>
      </View>

      <Text style={s.section}>Your activity</Text>
      <View style={s.stats}>
        <Stat label="Submitted" value={counts.submitted} />
        <Stat label="In progress" value={counts.progress} />
        <Stat label="Resolved" value={counts.resolved} />
      </View>

      <Text style={s.section}>Quick actions</Text>
      <View style={s.actions}>
        <Action title="My complaints" sub="View your reports" icon="▣" onPress={() => go("complaints")} />
        <Action title="Notifications" sub="Updates and alerts" icon="●" onPress={() => go("notifications")} />
      </View>
    </ScrollView>
  );
}

function Report({ back, done }: { back: () => void; done: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [image, setImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Photo access needed", "Allow photo access to attach evidence.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled) setImage(result.assets[0]);
  };

  const submit = async () => {
    if (!title.trim() || !description.trim() || !location.trim()) {
      Alert.alert("Missing information", "Please complete the complaint title, description and campus location.");
      return;
    }

    try {
      setBusy(true);
      const input = { title: title.trim(), description: description.trim(), location: location.trim() };
      let duplicates: Awaited<ReturnType<typeof findPossibleDuplicates>> = [];
      try {
        duplicates = await findPossibleDuplicates(input);
      } catch {
        // Duplicate checking is advisory; allow the student to continue if it is unavailable.
      }

      const proceed = async () => {
        const complaint = await createComplaint(input);
        if (image) {
          await uploadComplaintImage(
            complaint.id,
            image.uri,
            image.fileName ?? "evidence.jpg",
            image.mimeType ?? "image/jpeg",
          );
        }
        const routingNotice = complaint.ml_warning ??
          (complaint.routing_fallback
            ? "ML service is unavailable, so your complaint was automatically routed to General."
            : "Your complaint was automatically classified and routed to the appropriate department.");
        Alert.alert(
          complaint.ml_warning ? "Complaint saved — routing needs attention" : "Complaint submitted",
          complaint.ml_warning ?? ("Your complaint was submitted successfully. " + routingNotice),
          [{ text: "View complaints", onPress: done }],
        );
      };

      if (duplicates.length) {
        const top = duplicates.slice(0, 3).map((duplicate, index) =>
          `${index + 1}. ${duplicate.title} · ${duplicate.location} · ${Math.round(duplicate.similarity_score * 100)}% similar`,
        ).join("\n");
        Alert.alert(
          "Possible duplicate found",
          "A recent complaint may describe the same issue:\n\n" + top + "\n\nReview it before submitting another report.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Submit anyway", onPress: proceed },
          ],
        );
      } else {
        await proceed();
      }
    } catch (error) {
      Alert.alert("Submission failed", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.reportRoot} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={s.originalReportPage} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={s.originalReportIntro}>
          <Text style={s.originalReportIntroTitle}>Tell us what happened.</Text>
          <Text style={s.originalReportIntroText}>Clear details help the complaint reach the right campus team.</Text>
        </View>

        <View style={s.originalReportCard}>
          <Text style={s.originalFieldLabel}>Complaint title</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            maxLength={150}
            placeholder="e.g. Wi-Fi disconnected in Lab 304"
            placeholderTextColor="#858A99"
            style={s.originalFieldInput}
          />
          <Text style={s.originalFieldLabel}>Detailed description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the problem clearly..."
            placeholderTextColor="#858A99"
            multiline
            textAlignVertical="top"
            style={s.originalDescriptionInput}
          />
          <Text style={s.originalFieldLabel}>Campus location</Text>
          <Text style={s.originalFieldHint}>Enter the building, room or campus area.</Text>
          <TextInput
            value={location}
            onChangeText={setLocation}
            placeholder="e.g. EC Block, Lab 304"
            placeholderTextColor="#858A99"
            style={s.originalFieldInput}
          />
        </View>

        <View style={s.originalReportCard}>
          <Text style={s.originalFieldLabel}>Upload evidence</Text>
          <Text style={s.originalFieldHint}>Add one photo showing the issue. JPG, PNG or WEBP · max 5 MB</Text>
          {image ? (
            <View style={s.originalImagePreviewWrap}>
              <Image source={{ uri: image.uri }} style={s.originalImagePreview} />
              <Pressable onPress={() => setImage(null)} style={s.originalRemoveImage}>
                <Text style={{ color: C.white, fontWeight: "700" }}>Remove photo</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable style={s.originalUpload} onPress={pick}>
              <Text style={s.originalUploadPlus}>＋</Text>
              <Text style={s.originalUploadText}>Add photo</Text>
            </Pressable>
          )}
        </View>

        <Pressable style={[s.originalSubmit, busy && s.disabled]} onPress={submit} disabled={busy}>
          {busy ? <ActivityIndicator color={C.white} /> : <Text style={s.originalSubmitText}>Submit complaint</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

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
      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => !saving && setEditing(null)}>
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

function Profile({ back, go, logout }: { back: () => void; go: (x: Screen) => void; logout: () => void }) {
  const [me, setMe] = useState<{ name: string; email?: string } | null>(null);
  const [stats, setStats] = useState({ total: 0, submitted: 0, resolved: 0, rejected: 0 });
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    getMe().then(setMe).catch(() => {});
    getComplaints().then((items) => setStats({
      total: items.length,
      submitted: items.filter((x) => x.status?.toLowerCase() === "submitted").length,
      resolved: items.filter((x) => ["resolved", "closed"].includes(x.status?.toLowerCase())).length,
      rejected: items.filter((x) => x.status?.toLowerCase() === "rejected").length,
    })).catch(() => {});
    getNotifications().then((items) => setUnread(items.filter((x) => !x.read_at).length)).catch(() => {});
  }, []);

  const security = async () => {
    if (!me?.email) {
      Alert.alert("Security", "Your account email could not be loaded.");
      return;
    }
    try {
      await resetPassword(me.email);
      Alert.alert("Password reset email sent", "Check your inbox for the secure password reset link.");
    } catch (error) {
      Alert.alert("Unable to send reset email", error instanceof Error ? error.message : "Please try again.");
    }
  };

  return (
    <ScrollView contentContainerStyle={s.profilePage} showsVerticalScrollIndicator={false}>
      <Header title="Profile" back={back} />
      <View style={s.profileSummary}>
        <View style={s.profileAvatar}><Text style={s.profileLetter}>{(me?.name || "S")[0]?.toUpperCase()}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={s.profileSummaryName}>{me?.name || "Student"}</Text>
          <Text style={s.profileSummaryEmail}>{me?.email || "Student account"}</Text>
          <Text style={s.profileRole}>Student</Text>
        </View>
        <Pressable style={s.profileEdit} onPress={() => Alert.alert("Personal information", "Your name and email are managed by your university account.")}>
          <Text style={s.profileEditText}>Edit</Text>
        </Pressable>
      </View>

      <View style={s.profileStats}>
        <ProfileStat value={stats.total} label="Total" tone="blue" />
        <ProfileStat value={stats.submitted} label="Submitted" tone="orange" />
        <ProfileStat value={stats.resolved} label="Resolved" tone="green" />
        <ProfileStat value={stats.rejected} label="Rejected" tone="red" />
      </View>

      <View style={s.profileSection}>
        <Text style={s.profileSectionTitle}>My Activity</Text>
        <ProfileRow icon="☷" title="My Complaints" subtitle="View and manage your raised complaints" onPress={() => back()} />
        <ProfileRow icon="♢" title="Notifications" subtitle="Complaint updates and alerts" count={unread} onPress={() => Alert.alert("Notifications", "Open Alerts from the bottom navigation to view your updates.")} />
      </View>

      <View style={s.profileSection}>
        <Text style={s.profileSectionTitle}>Account</Text>
        <ProfileRow icon="○" title="Personal Information" subtitle="Update your name and view account email" onPress={() => Alert.alert("Personal information", `${me?.name || "Student"}\n${me?.email || ""}\n\nYour account details are managed securely through Supabase.`)} />
        <ProfileRow icon="⬡" title="Security" subtitle="Send a secure password reset email" onPress={security} />
      </View>

      <View style={s.profileSection}>
        <Text style={s.profileSectionTitle}>App</Text>
        <ProfileRow icon="⚙" title="Settings" subtitle="Notification updates and app information" onPress={() => Alert.alert("Settings", "Notification preferences are managed by the current app configuration.")} />
        <ProfileRow icon="ⓘ" title="About GrievX" subtitle="About this campus complaint platform" onPress={() => Alert.alert("About GrievX", "GrievX helps students report campus issues, track progress and route complaints to the responsible department.")} />
      </View>

      <View style={s.profileSection}>
        <Text style={s.profileSectionTitle}>Support</Text>
        <ProfileRow icon="ⓘ" title="Help & Support" subtitle="Quick answers about using GrievX" onPress={() => Alert.alert("Help & Support", "Submit a complaint with a clear title, description, campus location and optional photo. You can track updates under My Complaints.")} />
        <ProfileRow icon="▱" title="Send Feedback" subtitle="Share suggestions or report a problem" onPress={() => Alert.alert("Send Feedback", "Please share feedback with your project administrator or campus support team.")} />
      </View>

      <Pressable style={s.logout} onPress={logout}>
        <Text style={{ color: "#B91C1C", fontWeight: "700" }}>←  Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

function ProfileStat({ value, label, tone }: { value: number; label: string; tone: "blue" | "orange" | "green" | "red" }) {
  return (
    <View style={s.profileStat}>
      <View style={[s.profileStatIcon, tone === "blue" ? s.profileToneBlue : tone === "orange" ? s.profileToneOrange : tone === "green" ? s.profileToneGreen : s.profileToneRed]}>
        <Text style={s.profileStatValue}>{value}</Text>
      </View>
      <Text style={s.profileStatLabel}>{label}</Text>
    </View>
  );
}

function ProfileRow({ icon, title, subtitle, count, onPress }: { icon: string; title: string; subtitle: string; count?: number; onPress: () => void }) {
  return (
    <Pressable style={s.profileRow} onPress={onPress}>
      <View style={s.profileRowIcon}><Text style={s.profileRowIconText}>{icon}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={s.profileRowTitle}>{title}</Text>
        <Text style={s.profileRowSubtitle}>{subtitle}</Text>
      </View>
      {!!count && <View style={s.profileUnread}><Text style={s.profileUnreadText}>{count}</Text></View>}
      <Text style={s.profileChevron}>›</Text>
    </Pressable>
  );
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
  const items: [Screen, string, string][] = [
    ["home", "⌂", "Home"],
    ["complaints", "▤", "Complaints"],
    ["report", "+", "Report"],
    ["notifications", "♧", "Alerts"],
    ["profile", "○", "Profile"],
  ];

  return (
    <View style={s.nav}>
      {items.map(([key, icon, label]) => {
        const selected = active === key;
        if (key === "report") {
          return (
            <Pressable key={key} style={s.reportNavItem} onPress={() => go("report")}>
              <View style={[s.reportNavCircle, selected && s.reportNavCircleActive]}>
                <Text style={s.reportNavPlus}>{icon}</Text>
              </View>
              <Text style={[s.navLabel, selected && s.navActive]}>Report</Text>
            </Pressable>
          );
        }

        return (
          <Pressable key={key} style={s.navItem} onPress={() => go(key)}>
            <Text style={[s.navIcon, selected && s.navActive]}>{icon}</Text>
            <Text style={[s.navLabel, selected && s.navActive]}>{label}</Text>
          </Pressable>
        );
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

function Stat({ label, value }: { label: string; value: number }) {
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
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 1.1, color: C.blue },
  greeting: { fontSize: 24, lineHeight: 31, fontWeight: "700", color: C.text, marginTop: 4 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#DAE2FD", alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 18, fontWeight: "800", color: C.navy },
  hero: { backgroundColor: C.navy, borderRadius: 22, padding: 20, flexDirection: "row", minHeight: 185 },
  heroTitle: { fontSize: 23, lineHeight: 29, fontWeight: "700", color: C.white },
  heroBody: { fontSize: 14, lineHeight: 20, color: "#DCE1FF", marginVertical: 8, maxWidth: 230 },
  primary: { minHeight: 48, borderRadius: 12, backgroundColor: C.blue, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, marginTop: 8 },
  primaryText: { color: C.white, fontSize: 14, fontWeight: "700" },
  disabled: { opacity: 0.55 },
  section: { fontSize: 18, fontWeight: "600", color: C.text },
  stats: { flexDirection: "row", gap: 10 },
  stat: { flex: 1, padding: 14, backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 16 },
  statValue: { fontSize: 22, fontWeight: "700", color: C.text, marginBottom: 4 },
  actions: { flexDirection: "row", gap: 10 },
  action: { flex: 1, minHeight: 120, padding: 16, backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 16 },
  actionIcon: { fontSize: 24, color: C.blue, marginBottom: 10 },
  card: { backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 16, gap: 10 },
  progress: { backgroundColor: C.softBlue, borderRadius: 16, padding: 16, gap: 5 },
  cardTitle: { fontSize: 20, lineHeight: 26, fontWeight: "600", color: C.text },
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: "600", color: C.text },
  input: { backgroundColor: C.softBlue, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: C.text, fontSize: 14 },
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

  originalReportPage: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 118, gap: 16 },
  originalReportIntro: { backgroundColor: "#EEF1FF", borderRadius: 22, padding: 20, gap: 8 },
  originalReportIntroTitle: { color: C.text, fontSize: 21, lineHeight: 28, fontWeight: "700" },
  originalReportIntroText: { color: C.muted, fontSize: 15, lineHeight: 23 },
  originalReportCard: { backgroundColor: C.white, borderRadius: 20, borderWidth: 1, borderColor: C.border, padding: 16, gap: 10 },
  originalFieldLabel: { color: C.text, fontSize: 15, fontWeight: "600", marginTop: 2 },
  originalFieldHint: { color: C.muted, fontSize: 13, lineHeight: 19 },
  originalFieldInput: { minHeight: 48, backgroundColor: "#F0F1FC", borderRadius: 13, paddingHorizontal: 14, paddingVertical: 12, color: C.text, fontSize: 15, marginBottom: 4 },
  originalDescriptionInput: { minHeight: 126, backgroundColor: "#F0F1FC", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, color: C.text, fontSize: 15, lineHeight: 22, marginBottom: 5 },
  originalUpload: { minHeight: 116, borderWidth: 1, borderStyle: "dashed", borderColor: C.border, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: C.white, gap: 6, marginTop: 4 },
  originalUploadPlus: { color: C.blue, fontSize: 32, lineHeight: 36 },
  originalUploadText: { color: C.text, fontSize: 15, fontWeight: "600" },
  originalImagePreviewWrap: { gap: 8, marginTop: 4 },
  originalImagePreview: { width: "100%", height: 170, borderRadius: 12 },
  originalRemoveImage: { backgroundColor: C.red, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9 },
  originalSubmit: { minHeight: 58, borderRadius: 14, backgroundColor: C.blue, alignItems: "center", justifyContent: "center", marginTop: 1 },
  originalSubmitText: { color: C.white, fontSize: 16, fontWeight: "800" },
  profilePage: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 112, gap: 14 },
  profileSummary: { backgroundColor: "#EAF0FF", borderRadius: 18, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  profileSummaryName: { color: C.text, fontSize: 17, fontWeight: "700" },
  profileSummaryEmail: { color: C.muted, fontSize: 12, marginTop: 2 },
  profileRole: { color: C.blue, fontSize: 11, fontWeight: "700", marginTop: 5 },
  profileEdit: { borderWidth: 1, borderColor: C.blue, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  profileEditText: { color: C.blue, fontSize: 11, fontWeight: "700" },
  profileStats: { flexDirection: "row", gap: 7 },
  profileStat: { flex: 1, backgroundColor: C.white, borderRadius: 13, borderWidth: 1, borderColor: C.border, paddingVertical: 10, alignItems: "center", gap: 5 },
  profileStatIcon: { width: 29, height: 29, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  profileToneBlue: { backgroundColor: "#E5EDFF" },
  profileToneOrange: { backgroundColor: "#FFF1DF" },
  profileToneGreen: { backgroundColor: "#E4F7EE" },
  profileToneRed: { backgroundColor: "#FDE9E9" },
  profileStatValue: { color: C.text, fontSize: 12, fontWeight: "800" },
  profileStatLabel: { color: C.muted, fontSize: 9.5, textAlign: "center" },
  profileSection: { backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 15, padding: 13, gap: 3 },
  profileSectionTitle: { color: C.text, fontSize: 13, fontWeight: "700", marginBottom: 5 },
  profileRow: { minHeight: 55, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 5 },
  profileRowIcon: { width: 31, height: 31, borderRadius: 16, backgroundColor: "#EEF1FF", alignItems: "center", justifyContent: "center" },
  profileRowIconText: { color: C.blue, fontSize: 16, fontWeight: "700" },
  profileRowTitle: { color: C.text, fontSize: 12, fontWeight: "700" },
  profileRowSubtitle: { color: C.muted, fontSize: 10, marginTop: 3 },
  profileUnread: { minWidth: 19, height: 19, borderRadius: 10, backgroundColor: C.blue, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  profileUnreadText: { color: C.white, fontSize: 10, fontWeight: "700" },
  profileChevron: { color: C.muted, fontSize: 22, paddingLeft: 3 },
  nav: { position: "absolute", left: 0, right: 0, bottom: 0, height: 67, borderTopWidth: 1, borderTopColor: "#E7E8F0", backgroundColor: C.white, flexDirection: "row", alignItems: "center", paddingHorizontal: 3 },
  navItem: { flex: 1, alignItems: "center", gap: 2 },
  navIcon: { fontSize: 19, color: "#252C3E" },
  navLabel: { fontSize: 9, fontWeight: "600", color: "#252C3E" },
  navActive: { color: C.blue },
  reportNavItem: { flex: 1, alignItems: "center", justifyContent: "center", marginTop: -18 },
  reportNavCircle: { width: 43, height: 43, borderRadius: 22, backgroundColor: "#0A5CDA", alignItems: "center", justifyContent: "center", borderWidth: 4, borderColor: C.white },
  reportNavCircleActive: { backgroundColor: "#0A5CDA" },
  reportNavPlus: { color: C.white, fontSize: 28, lineHeight: 30, fontWeight: "300" },

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
  timeline: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9 },
  activeDot: { backgroundColor: C.blue },
  profile: { alignItems: "center", backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 18, padding: 24, gap: 5 },
  profileAvatar: { width: 82, height: 82, borderRadius: 41, backgroundColor: "#DAE2FD", alignItems: "center", justifyContent: "center" },
  profileLetter: { fontSize: 34, fontWeight: "800", color: C.navy },
  empty: { backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 18, padding: 28, alignItems: "center", gap: 8 },
  logout: { height: 48, borderRadius: 12, borderWidth: 1, borderColor: "#F1B4B4", backgroundColor: "#FEF2F2", alignItems: "center", justifyContent: "center" },
  body: { fontSize: 16, lineHeight: 24, color: C.text },
  auth: { flexGrow: 1, padding: 20, justifyContent: "center", gap: 18 },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.navy, alignItems: "center", justifyContent: "center" },
  logoText: { color: C.white, fontSize: 22, fontWeight: "800" },
  brandText: { fontSize: 17, fontWeight: "700", color: C.text },
  display: { fontSize: 30, lineHeight: 36, fontWeight: "700", color: C.text },
  link: { color: C.blue, fontSize: 13, fontWeight: "600", textAlign: "center", paddingVertical: 8 },

  evidenceDetail: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  evidenceDetailImage: { width: 88, height: 88, borderRadius: 10, backgroundColor: C.softBlue },
  evidenceDetailPlaceholder: { width: 88, height: 88, borderRadius: 10, backgroundColor: C.softBlue, alignItems: "center", justifyContent: "center" },
  evidenceDetailPlaceholderText: { color: C.blue, fontSize: 28 },
  notificationHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  notificationCard: { backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 16, gap: 8 },
  notificationUnread: { borderColor: "#B9C9F7", backgroundColor: "#F6F8FF" },
  notificationDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.blue },
  heroIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#E9EDFF", alignItems: "center", justifyContent: "center", alignSelf: "center" },
  heroCheck: { color: C.blue, fontSize: 24, fontWeight: "800" },
  step: { color: C.blue, fontSize: 9, letterSpacing: 0.5, fontWeight: "700" },
  area: { minHeight: 90, textAlignVertical: "top" },
  imageBox: { width: "100%", gap: 8, alignItems: "flex-start" },
  image: { width: "100%", height: 160, borderRadius: 10 },
  upload: { minHeight: 90, borderWidth: 1, borderStyle: "dashed", borderColor: C.border, borderRadius: 12, alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.softBlue },
  plus: { color: C.blue, fontSize: 28, fontWeight: "300" },
});