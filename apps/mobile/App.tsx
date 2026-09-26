import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";

import {
  clearToken,
  createComplaint,
  getComplaint,
  getComplaints,
  getMe,
  getToken,
  login,
  register,
  uploadComplaintImage,
} from "./src/api";

type Screen = "home" | "new" | "list" | "detail";

type Complaint = {
  id: string;
  title: string;
  description: string;
  location: string;
  status: string;
  created_at: string;
  images: Array<{
    id: string;
    original_filename: string;
    content_type: string;
  }>;
};

export default function App() {
  const [token, setTokenState] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>("home");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    getToken()
      .then(setTokenState)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Centered>
        <ActivityIndicator size="large" />
      </Centered>
    );
  }

  if (!token) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.authCard}>
          <Text style={styles.brand}>GrievX Campus</Text>
          <Text style={styles.heading}>
            {authMode === "login" ? "Student Login" : "Create Student Account"}
          </Text>

          {authMode === "register" && (
            <TextInput
              style={styles.input}
              placeholder="Full name"
              value={name}
              onChangeText={setName}
            />
          )}

          <TextInput
            style={styles.input}
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {!!error && <Text style={styles.error}>{error}</Text>}

          <Button
            label={authMode === "login" ? "Login" : "Register"}
            onPress={async () => {
              try {
                setError("");
                if (authMode === "register") {
                  await register(name, email, password);
                }
                await login(email, password);
                setTokenState(await getToken());
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : "Something went wrong.",
                );
              }
            }}
          />

          <Pressable
            onPress={() =>
              setAuthMode(authMode === "login" ? "register" : "login")
            }
          >
            <Text style={styles.link}>
              {authMode === "login"
                ? "Create a student account"
                : "Already have an account? Login"}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {screen === "home" && (
        <Home
          onNavigate={setScreen}
          onLogout={async () => {
            await clearToken();
            setTokenState(null);
          }}
        />
      )}

      {screen === "new" && (
        <NewComplaint
          onDone={() => setScreen("list")}
          onBack={() => setScreen("home")}
        />
      )}

      {screen === "list" && (
        <ComplaintList
          onBack={() => setScreen("home")}
          onOpen={(id) => {
            setSelectedId(id);
            setScreen("detail");
          }}
        />
      )}

      {screen === "detail" && selectedId && (
        <ComplaintDetail
          id={selectedId}
          onBack={() => setScreen("list")}
        />
      )}
    </SafeAreaView>
  );
}

function Home({
  onNavigate,
  onLogout,
}: {
  onNavigate: (screen: Screen) => void;
  onLogout: () => void;
}) {
  const [me, setMe] = useState<{ name: string } | null>(null);

  useEffect(() => {
    getMe().then(setMe).catch(() => undefined);
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.brand}>GrievX Campus</Text>
      <Text style={styles.heading}>
        Hello{me?.name ? ", " + me.name : ""}
      </Text>
      <Text style={styles.muted}>
        Report a campus issue and keep track of its status.
      </Text>

      <Button
        label="New Complaint"
        onPress={() => onNavigate("new")}
      />
      <Button
        label="My Complaints"
        onPress={() => onNavigate("list")}
        secondary
      />

      <Pressable onPress={onLogout}>
        <Text style={styles.link}>Logout</Text>
      </Pressable>
    </ScrollView>
  );
}

function NewComplaint({
  onDone,
  onBack,
}: {
  onDone: () => void;
  onBack: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [image, setImage] =
    useState<ImagePicker.ImagePickerAsset | null>(null);
  const [busy, setBusy] = useState(false);

  const pickImage = async () => {
    const permission =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Permission required",
        "Please allow photo access to attach evidence.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0]);
    }
  };

  const submit = async () => {
    if (!title.trim() || !description.trim() || !location.trim()) {
      Alert.alert(
        "Missing information",
        "Please fill title, description and location.",
      );
      return;
    }

    try {
      setBusy(true);

      const complaint = await createComplaint({
        title,
        description,
        location,
      });

      if (image) {
        await uploadComplaintImage(
          complaint.id,
          image.uri,
          image.fileName ?? "evidence.jpg",
          image.mimeType ?? "image/jpeg",
        );
      }

      Alert.alert(
        "Submitted",
        "Your complaint was submitted successfully.",
      );
      onDone();
    } catch (err) {
      Alert.alert(
        "Submission failed",
        err instanceof Error ? err.message : "Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable onPress={onBack}>
        <Text style={styles.link}>← Back</Text>
      </Pressable>

      <Text style={styles.heading}>New Complaint</Text>

      <TextInput
        style={styles.input}
        placeholder="Title"
        value={title}
        onChangeText={setTitle}
      />

      <TextInput
        style={[styles.input, styles.multiline]}
        placeholder="Describe the issue"
        multiline
        value={description}
        onChangeText={setDescription}
      />

      <TextInput
        style={styles.input}
        placeholder="Location"
        value={location}
        onChangeText={setLocation}
      />

      {image && (
        <Image source={{ uri: image.uri }} style={styles.preview} />
      )}

      <Button
        label={image ? "Change Image" : "Attach Image"}
        onPress={pickImage}
        secondary
      />

      <Button
        label={busy ? "Submitting..." : "Submit Complaint"}
        onPress={submit}
        disabled={busy}
      />
    </ScrollView>
  );
}

function ComplaintList({
  onBack,
  onOpen,
}: {
  onBack: () => void;
  onOpen: (id: string) => void;
}) {
  const [items, setItems] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    getComplaints()
      .then(setItems)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Unable to load complaints."),
      )
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  return (
    <View style={styles.content}>
      <Pressable onPress={onBack}>
        <Text style={styles.link}>← Back</Text>
      </Pressable>

      <Text style={styles.heading}>My Complaints</Text>

      {loading ? (
        <ActivityIndicator />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <Text style={styles.muted}>No complaints yet.</Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.complaintCard}
              onPress={() => onOpen(item.id)}
            >
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.status}>{item.status}</Text>
              <Text style={styles.muted}>{item.location}</Text>
              <Text style={styles.muted}>
                {new Date(item.created_at).toLocaleString()}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

function ComplaintDetail({
  id,
  onBack,
}: {
  id: string;
  onBack: () => void;
}) {
  const [item, setItem] = useState<Complaint | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getComplaint(id)
      .then(setItem)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Unable to load complaint."),
      );
  }, [id]);

  if (error) {
    return (
      <View style={styles.content}>
        <Pressable onPress={onBack}>
          <Text style={styles.link}>← Back</Text>
        </Pressable>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  if (!item) {
    return (
      <Centered>
        <ActivityIndicator />
      </Centered>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable onPress={onBack}>
        <Text style={styles.link}>← Back</Text>
      </Pressable>

      <Text style={styles.heading}>{item.title}</Text>
      <Text style={styles.status}>{item.status}</Text>

      <Text style={styles.label}>Description</Text>
      <Text style={styles.body}>{item.description}</Text>

      <Text style={styles.label}>Location</Text>
      <Text style={styles.body}>{item.location}</Text>

      <Text style={styles.label}>Evidence</Text>
      {item.images.length ? (
        item.images.map((image) => (
          <Text key={image.id} style={styles.muted}>
            {image.original_filename}
          </Text>
        ))
      ) : (
        <Text style={styles.muted}>No images attached.</Text>
      )}
    </ScrollView>
  );
}

function Button({
  label,
  onPress,
  secondary,
  disabled,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        secondary && styles.buttonSecondary,
        disabled && styles.disabled,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          secondary && styles.buttonTextSecondary,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={styles.centered}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F8FA",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    padding: 24,
    gap: 14,
  },
  authCard: {
    margin: 24,
    padding: 24,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    gap: 14,
  },
  brand: {
    fontSize: 28,
    fontWeight: "800",
  },
  heading: {
    fontSize: 24,
    fontWeight: "700",
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: 10,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
  },
  muted: {
    color: "#68707D",
    lineHeight: 20,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D9DEE7",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
  },
  multiline: {
    minHeight: 120,
    textAlignVertical: "top",
  },
  button: {
    backgroundColor: "#111827",
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 4,
  },
  buttonSecondary: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#111827",
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
  buttonTextSecondary: {
    color: "#111827",
  },
  disabled: {
    opacity: 0.5,
  },
  link: {
    color: "#2563EB",
    fontWeight: "600",
    paddingVertical: 8,
  },
  error: {
    color: "#B42318",
  },
  status: {
    color: "#2563EB",
    fontWeight: "700",
    textTransform: "uppercase",
  },
  complaintCard: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 14,
    marginBottom: 10,
    gap: 5,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  preview: {
    width: "100%",
    height: 220,
    borderRadius: 14,
  },
});
