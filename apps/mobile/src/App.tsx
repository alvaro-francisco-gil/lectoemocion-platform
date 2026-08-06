import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View
} from "react-native";
import { WebView } from "react-native-webview";
import {
  playerOrigin,
  resolvePlayerUrl,
  type PlayerUrlProblem
} from "./playerUrl";

/**
 * The native shell.
 *
 * Today it is a full-screen host for the web player and nothing else. Per
 * [ADR 0003](../../../docs/decisions/0003-runtime-and-animation.md) this shell
 * will grow to own authentication, group management, camera, microphone, and
 * upload — everything an *adult* touches. Everything a *child* touches stays
 * inside the player, implemented exactly once and shared with the classroom
 * display.
 *
 * The shell therefore holds no game logic, no progression, and no template
 * knowledge, and it must not acquire any.
 */

/*
 * A `Record` keyed by the union rather than a switch with `assertNever`: it
 * gives the same guarantee — adding a problem breaks compilation here — without
 * `apps/mobile` taking a workspace dependency it does not otherwise need.
 * Metro and pnpm's symlinked `node_modules` are a known friction point, and the
 * shell is deliberately free of workspace imports until one earns its way in.
 */
const PROBLEM_MESSAGE: Record<PlayerUrlProblem, string> = {
  missing:
    "Falta la dirección del reproductor. Define EXPO_PUBLIC_PLAYER_URL y vuelve a iniciar la aplicación.",
  malformed:
    "La dirección del reproductor no es válida. Debe empezar por http:// o https://.",
  "unsupported-scheme":
    "La dirección del reproductor debe usar http:// o https://."
};

const UNREACHABLE_MESSAGE =
  "No se ha podido cargar el reproductor. Comprueba que el servidor está en marcha y que el dispositivo está en la misma red.";

export function App() {
  /* Resolved once: the value is inlined at build time and cannot change. */
  const player = useMemo(
    () => resolvePlayerUrl(process.env.EXPO_PUBLIC_PLAYER_URL),
    []
  );

  const [attempt, setAttempt] = useState(0);
  const [unreachable, setUnreachable] = useState(false);

  const retry = useCallback(() => {
    setUnreachable(false);
    /* Remounts the WebView, so a retry is a genuine reload and not a no-op. */
    setAttempt((previous) => previous + 1);
  }, []);

  if (player.kind === "unusable") {
    /*
     * Fails closed, per invariant 6. There is no default URL to fall back to:
     * a blank WebView is indistinguishable from a broken application, and this
     * is a configuration fault that only an adult can repair.
     */
    return <Problem message={PROBLEM_MESSAGE[player.problem]} />;
  }

  if (unreachable) {
    return <Problem message={UNREACHABLE_MESSAGE} onRetry={retry} />;
  }

  const origin = playerOrigin(player.url);

  return (
    <View style={styles.fill}>
      <StatusBar hidden />
      <WebView
        key={attempt}
        source={{ uri: player.url }}
        style={styles.fill}
        /* The player owns the whole viewport; the shell contributes no chrome. */
        containerStyle={styles.fill}
        originWhitelist={["http://*", "https://*"]}
        /*
         * Confines navigation to the player's own origin. Without this the
         * WebView is an address-bar-less browser shipped to children: one
         * unexpected link and the child is somewhere nobody reviewed.
         */
        onShouldStartLoadWithRequest={(request) =>
          request.url.startsWith(origin)
        }
        onError={() => setUnreachable(true)}
        onHttpError={() => setUnreachable(true)}
        renderLoading={() => (
          <View style={styles.centred}>
            <ActivityIndicator size="large" color="#f3f4ff" />
          </View>
        )}
        startInLoadingState
        /* Without this iOS forces video out of the canvas and into fullscreen. */
        allowsInlineMediaPlayback
        /*
         * Scrolling and zoom are left off deliberately: the player is a
         * fixed-viewport canvas, and a child dragging the page is a child who
         * has lost the game.
         */
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        setBuiltInZoomControls={false}
      />
    </View>
  );
}

/** The one adult-facing surface the shell owns today. */
function Problem({
  message,
  onRetry
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View style={[styles.fill, styles.centred, styles.problem]}>
      <StatusBar hidden={false} />
      <Text style={styles.problemText} accessibilityRole="alert">
        {message}
      </Text>
      {onRetry === undefined ? null : (
        <Pressable
          onPress={onRetry}
          style={styles.retry}
          accessibilityRole="button"
        >
          <Text style={styles.retryText}>Reintentar</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#0f1020" },
  centred: { alignItems: "center", justifyContent: "center" },
  problem: { padding: 32, gap: 24 },
  problemText: {
    color: "#f3f4ff",
    fontSize: 18,
    lineHeight: 26,
    textAlign: "center"
  },
  retry: {
    backgroundColor: "#f3f4ff",
    borderRadius: 999,
    paddingHorizontal: 28,
    paddingVertical: 14
  },
  retryText: { color: "#0f1020", fontSize: 17, fontWeight: "600" }
});
