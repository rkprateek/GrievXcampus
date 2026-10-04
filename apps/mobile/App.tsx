import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
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
  getComplaint,
  getComplaints,
  getMe,
  login,
  register,
  resetPassword,
  signOut,
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
  created_at: string;
  images: { id: string; original_filename: string; content_type: string }[];
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
      {screen === "notifications" && (
        <Simple
          title="Notifications"
          back={() => setScreen("home")}
          text="Notification APIs are outside the current Week 4 backend scope."
        />
      )}
      {screen === "profile" && <Profile back={() => setScreen("home")} logout={signOut} />}
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
                <Text style={s.authLabel}>University Roll No or Email</Text>
                {mode === "login" && <Text style={s.verified}>Verified ID</Text>}
              </View>
              <View style={s.authInputWrap}>
                <Text style={s.inputIcon}>▣</Text>
                <TextInput
                  style={s.authInput}
                  placeholder="e.g. 2022BCSE042 or student@univ.edu"
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
                  <Text style={s.googleText}>Sign in with Campus Google Workspace\n(@univ.edu)</Text>
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
            {keepSignedIn ? "Secure campus access · Session stays active on this device." : "Secure campus access"}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Home({ go }: { go: (x: Screen) => void }) {
  const [me, setMe] = useState<{ name: string } | null>(null);
  useEffect(() => {
    getMe().then(setMe).catch(() => {});
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
          <Text style={s.heroBody}>
            Report an issue in a few simple steps and follow its progress.
          </Text>
          <Primary label="Report an issue" onPress={() => go("report")} />
        </View>
        <View style={s.heroIcon}><Text style={s.heroCheck}>✓</Text></View>
      </View>

      <Text style={s.section}>Your activity</Text>
      <View style={s.stats}>
        <Stat label="Submitted" />
        <Stat label="In progress" />
        <Stat label="Resolved" />
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
  const [category, setCategory] = useState("Wi-Fi / Net");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [priority, setPriority] = useState<"Normal" | "High" | "Critical">("High");
  const [anonymous, setAnonymous] = useState(false);
  const [image, setImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [busy, setBusy] = useState(false);

  const categories = [
    ["Electrical", "ϟ"],
    ["Plumbing", "♢"],
    ["Wi-Fi / Net", "⌁"],
    ["Cleanliness", "♜"],
    ["Classroom", "◇"],
    ["Hostel", "▱"],
    ["Security", "♢"],
    ["Transport", "▤"],
    ["Other", "?"],
  ];

  const pick = async () => {
    const p = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!p.granted) {
      Alert.alert("Photo access needed", "Allow photo access to attach evidence.");
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!r.canceled) setImage(r.assets[0]);
  };

  const submit = async () => {
    if (!title.trim() || !description.trim() || !location.trim()) {
      Alert.alert("Missing information", "Please complete the complaint summary, description and manual campus location.");
      return;
    }

    try {
      setBusy(true);
      const c = await createComplaint({
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
      });

      if (image) {
        await uploadComplaintImage(
          c.id,
          image.uri,
          image.fileName ?? "evidence.jpg",
          image.mimeType ?? "image/jpeg",
        );
      }

      Alert.alert(
        "Complaint submitted",
        "Your complaint was submitted successfully.",
        [{ text: "View complaints", onPress: done }],
      );
    } catch (e) {
      Alert.alert("Submission failed", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={s.reportRoot}>
      <ScrollView
        contentContainerStyle={s.reportPage}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.reportTop}>
          <View style={s.reportBrand}>
            <View style={s.miniLogo}><Text style={s.miniLogoText}>✓</Text></View>
            <View>
              <Text style={s.reportBrandTitle}><Text style={{ color: C.blue }}>GrievX</Text> | Report</Text>
              <Text style={s.reportBrandSub}>University Campus Portal</Text>
            </View>
          </View>
          <View style={s.photoAvatar}><Text style={s.photoAvatarText}>S</Text></View>
        </View>

        <View style={s.routeCard}>
          <View style={{ flex: 1 }}>
            <Text style={s.routeStep}><Text style={s.routeBadge}>1/4</Text> FAST ROUTE DESK</Text>
            <Text style={s.routeTitle}>Report an Issue</Text>
            <Text style={s.routeBody}>Provide details to route directly to responsible campus maintenance.</Text>
          </View>
          <View style={s.routeIcon}><Text style={s.routeIconText}>⚒</Text></View>
        </View>

        <View style={s.formCard}>
          <View style={s.sectionHeader}>
            <Text style={s.formTitle}>1. Choose Category <Text style={s.required}>*</Text></Text>
            <Text style={s.selectedLabel}>{category}</Text>
          </View>
          <Text style={s.formHint}>Tap the closest matching campus department.</Text>
          <View style={s.categoryGrid}>
            {categories.map(([name, icon]) => {
              const selected = category === name;
              return (
                <Pressable
                  key={name}
                  onPress={() => setCategory(name)}
                  style={[s.categoryItem, selected && s.categorySelected]}
                >
                  <Text style={[s.categoryIcon, selected && s.categoryIconSelected]}>{icon}</Text>
                  <Text style={[s.categoryText, selected && s.categoryTextSelected]}>{name}</Text>
                  {selected && <View style={s.categoryCheck}><Text style={s.categoryCheckText}>✓</Text></View>}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={s.formCard}>
          <View style={s.sectionHeader}>
            <Text style={s.formTitle}>2. Complaint Summary</Text>
            <Text style={s.counter}>{title.length}/60</Text>
          </View>
          <View style={s.compactInput}>
            <Text style={s.compactIcon}>≡</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              maxLength={60}
              placeholder="Wi-Fi disconnected in Lab 304"
              placeholderTextColor="#6E7381"
              style={s.compactTextInput}
            />
          </View>
        </View>

        <View style={s.formCard}>
          <View style={s.sectionHeader}>
            <View>
              <Text style={s.formTitle}>3. Detailed</Text>
              <Text style={s.formTitle}>Description</Text>
            </View>
            <Text style={s.tipText}>Clear details get solved 40% faster.</Text>
          </View>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Signal drops immediately after authentication. Lab 304 router..."
            placeholderTextColor="#6E7381"
            multiline
            style={s.descriptionInput}
            textAlignVertical="top"
          />
          <View style={s.audioRow}>
            <Pressable
              style={s.audioPill}
              onPress={() => Alert.alert("Audio note", "Audio recording is not enabled in the current mobile build.")}
            >
              <Text style={s.audioIcon}>♩</Text>
              <Text style={s.audioText}>Record Audio Note (0:18)</Text>
            </Pressable>
            <View style={s.transcribed}><View style={s.blueDot} /><Text style={s.transcribedText}>Transcribed</Text></View>
          </View>
        </View>

        <View style={s.formCard}>
          <View style={s.sectionHeader}>
            <Text style={s.formTitle}>4. Upload Evidence</Text>
            <Text style={s.counter}>{image ? "1 / 3 Attached" : "0 / 3 Attached"}</Text>
          </View>
          <Text style={s.formHint}>Add a photo or clip to help technician identify the fault instantly.</Text>
          <View style={s.evidenceRow}>
            {image ? (
              <View style={s.evidencePreview}>
                <Image source={{ uri: image.uri }} style={s.evidenceImage} />
                <Pressable style={s.removeImage} onPress={() => setImage(null)}>
                  <Text style={s.removeImageText}>×</Text>
                </Pressable>
                <View style={s.fileCaption}>
                  <Text style={s.fileName} numberOfLines={1}>{image.fileName ?? "evidence.jpg"}</Text>
                  <Text style={s.fileSize}>photo</Text>
                </View>
              </View>
            ) : (
              <Pressable style={s.evidenceEmpty} onPress={pick}>
                <Text style={s.evidenceEmptyIcon}>▧</Text>
                <Text style={s.addMedia}>+ Add Media</Text>
                <Text style={s.mediaHint}>Max 3 files · 15MB</Text>
              </Pressable>
            )}
            {image && (
              <Pressable style={s.evidenceEmpty} onPress={pick}>
                <Text style={s.evidenceEmptyIcon}>▧</Text>
                <Text style={s.addMedia}>+ Add Media</Text>
                <Text style={s.mediaHint}>Max 3 files · 15MB</Text>
              </Pressable>
            )}
          </View>
        </View>

        <View style={s.formCard}>
          <View style={s.sectionHeader}>
            <Text style={s.formTitle}>5. Campus Location</Text>
            <Text style={s.preciseNode}>Manual Node</Text>
          </View>
          <Text style={s.formHint}>Building / Wing</Text>
          <View style={s.locationInput}>
            <Text style={s.locationIcon}>⌂</Text>
            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder="Academic Complex - South Block"
              placeholderTextColor="#6E7381"
              style={s.locationTextInput}
            />
            <Text style={s.chevron}>⌄</Text>
          </View>
          <Text style={[s.formHint, { marginTop: 8 }]}>Specific Room / Lab / Corridor</Text>
          <View style={s.locationInput}>
            <Text style={s.locationIcon}>□</Text>
            <TextInput
              placeholder="Room 214, 2nd Floor (Systems Lab)"
              placeholderTextColor="#6E7381"
              style={s.locationTextInput}
            />
          </View>
          <View style={s.noGpsNote}>
            <Text style={s.noGpsIcon}>⌖</Text>
            <Text style={s.noGpsText}>Manual campus location only · No GPS is used</Text>
          </View>
        </View>

        <View style={s.formCard}>
          <View style={s.sectionHeader}>
            <Text style={s.formTitle}>6. Priority Level</Text>
            <Text style={s.counter}>SLA Target</Text>
          </View>
          <View style={s.priorityRow}>
            {(["Normal", "High", "Critical"] as const).map((value) => {
              const selected = priority === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setPriority(value)}
                  style={[s.priorityItem, selected && s.prioritySelected]}
                >
                  <Text style={[s.priorityTitle, selected && s.priorityTitleSelected]}>{value}</Text>
                  <Text style={s.prioritySub}>
                    {value === "Normal" ? "48–72 hrs" : value === "High" ? "12–24 hrs" : "< 4 hrs"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={s.priorityInfo}>
            <Text style={s.infoIcon}>i</Text>
            <Text style={s.priorityInfoText}>Mark as Critical only for urgent physical hazards, power outages, or gas leaks threatening immediate safety.</Text>
          </View>
        </View>

        <View style={s.anonymousCard}>
          <View style={s.anonymousIcon}><Text style={s.anonymousIconText}>○</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.formTitle}>Submit Anonymously</Text>
            <Text style={s.formHint}>Hide your roll number from peer lists</Text>
          </View>
          <Pressable onPress={() => setAnonymous((v) => !v)} style={[s.switch, anonymous && s.switchOn]}>
            <View style={[s.switchThumb, anonymous && s.switchThumbOn]} />
          </Pressable>
        </View>

        <Pressable
          style={[s.submitComplaint, busy && { opacity: 0.55 }]}
          onPress={submit}
          disabled={busy}
        >
          <Text style={s.submitComplaintText}>{busy ? "Submitting..." : "Submit Complaint"}</Text>
          <Text style={s.submitArrow}>→</Text>
        </Pressable>

        <View style={s.ticketNote}>
          <Text style={s.ticketIcon}>✓</Text>
          <Text style={s.ticketText}>Automatic ticket created for status tracking</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Complaints({ back, open }: { back: () => void; open: (id: string) => void }) {
  const [items, setItems] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getComplaints()
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "Unable to load complaints."))
      .finally(() => setLoading(false));
  }, []);

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
        renderItem={({ item }) => (
          <Pressable style={s.complaint} onPress={() => open(item.id)}>
            <View style={s.row}>
              <Status status={item.status} />
              <Text style={s.date}>{date(item.created_at)}</Text>
            </View>
            <Text style={s.complaintTitle}>{item.title}</Text>
            <Text style={s.muted} numberOfLines={2}>{item.description}</Text>
            <Text style={s.helper}>• {item.location}</Text>
          </Pressable>
        )}
      />
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
          <View key={x.id} style={s.file}>
            <Text>▧</Text>
            <View>
              <Text style={s.label}>{x.original_filename}</Text>
              <Text style={s.helper}>{x.content_type}</Text>
            </View>
          </View>
        )) : <Text style={s.muted}>No evidence attached.</Text>}
      </Card>
      <Card>
        <Text style={s.label}>Complaint status</Text>
        {["Submitted", "Assigned", "In progress", "Resolved"].map((x, i) => (
          <View style={s.timeline} key={x}>
            <View style={[s.dot, i === 0 && s.activeDot]} />
            <Text style={i === 0 ? s.label : s.muted}>{x}</Text>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

function Profile({ back, logout }: { back: () => void; logout: () => void }) {
  const [me, setMe] = useState<{ name: string; email?: string } | null>(null);
  useEffect(() => {
    getMe().then(setMe).catch(() => {});
  }, []);

  return (
    <ScrollView contentContainerStyle={s.page}>
      <Header title="Profile" back={back} />
      <View style={s.profile}>
        <View style={s.profileAvatar}><Text style={s.profileLetter}>{(me?.name || "S")[0]}</Text></View>
        <Text style={s.detailTitle}>{me?.name || "Student"}</Text>
        <Text style={s.muted}>{me?.email || "Student account"}</Text>
      </View>
      <Card>
        <Text style={s.label}>Account</Text>
        <Text style={s.body}>Student account</Text>
        <Text style={s.helper}>Authentication and student data are handled by Supabase in the current demo implementation.</Text>
      </Card>
      <Pressable style={s.logout} onPress={logout}>
        <Text style={{ color: "#B91C1C", fontWeight: "700" }}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

function Simple({ title, back, text }: { title: string; back: () => void; text: string }) {
  return (
    <ScrollView contentContainerStyle={s.page}>
      <Header title={title} back={back} />
      <View style={s.empty}>
        <Text style={s.cardTitle}>You're all caught up</Text>
        <Text style={s.muted}>{text}</Text>
      </View>
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

function Stat({ label }: { label: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statValue}>—</Text>
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
  googleButton: {
    minHeight: 82,
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
  detailTitle: { fontSize: 24, lineHeight: 30, fontWeight: "700", color: C.text },
  file: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 7 },
  timeline: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9 },
  activeDot: { backgroundColor: C.blue },
  profile: { alignItems: "center", backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 18, padding: 24, gap: 5 },
  profileAvatar: { width: 82, height: 82, borderRadius: 41, backgroundColor: "#DAE2FD", alignItems: "center", justifyContent: "center" },
  profileLetter: { fontSize: 34, fontWeight: "800", color: C.navy },
  empty: { backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 18, padding: 28, alignItems: "center", gap: 8 },
  logout: { height: 48, borderRadius: 12, borderWidth: 1, borderColor: "#F1B4B4", backgroundColor: "#FEF2F2", alignItems: "center", justifyContent: "center" },
  error: { fontSize: 13, color: C.red },
  body: { fontSize: 16, lineHeight: 24, color: C.text },
  card: { backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 16, gap: 10 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.bg },
  disabled: { opacity: 0.55 },
});
