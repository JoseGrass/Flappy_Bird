import React, { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, StyleSheet, Dimensions, Pressable } from "react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Constantes del juego
const BIRD_SIZE = 40;
const BIRD_X = SCREEN_WIDTH * 0.25;      // x fijo del pájaro
const GRAVITY = 0.6;                      // gravedad por tick
const JUMP_VELOCITY = -10.5;              // impulso al saltar
const PIPE_WIDTH = 70;
const PIPE_GAP = 170;                     // hueco entre tuberías
const PIPE_SPEED = 3.2;                   // pixeles por tick
const TICK_MS = 16;                       // ~60 FPS

function randomTopHeight() {
  const minTop = 60;
  const maxTop = SCREEN_HEIGHT - 200; // deja espacio para el gap y la UI
  return Math.floor(Math.random() * (maxTop - minTop)) + minTop;
}

export default function App() {
  const [running, setRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);

  const birdY = useRef(SCREEN_HEIGHT * 0.45);
  const birdV = useRef(0);

  // Tuberías: { x, topHeight, scored }
  const [pipes, setPipes] = useState(() => {
    const startX1 = SCREEN_WIDTH + 100;
    const startX2 = startX1 + (SCREEN_WIDTH * 0.6);
    return [
      { x: startX1, topHeight: randomTopHeight(), scored: false },
      { x: startX2, topHeight: randomTopHeight(), scored: false },
    ];
  });

  const loopRef = useRef(null);

  const resetGame = useCallback(() => {
    setRunning(false);
    setGameOver(false);
    setScore(0);
    birdY.current = SCREEN_HEIGHT * 0.45;
    birdV.current = 0;
    setPipes(() => {
      const startX1 = SCREEN_WIDTH + 100;
      const startX2 = startX1 + (SCREEN_WIDTH * 0.6);
      return [
        { x: startX1, topHeight: randomTopHeight(), scored: false },
        { x: startX2, topHeight: randomTopHeight(), scored: false },
      ];
    });
  }, []);

  const startIfNeeded = useCallback(() => {
    if (!running && !gameOver) setRunning(true);
    // salto inmediato al toque
    birdV.current = JUMP_VELOCITY;
  }, [running, gameOver]);

  // Bucle del juego
  useEffect(() => {
    if (!running) {
      if (loopRef.current) {
        clearInterval(loopRef.current);
        loopRef.current = null;
      }
      return;
    }

    loopRef.current = setInterval(() => {
      // Física del pájaro
      birdV.current += GRAVITY;
      birdY.current += birdV.current;

      // Límite superior/inferior
      if (birdY.current < 0) birdY.current = 0;
      if (birdY.current + BIRD_SIZE > SCREEN_HEIGHT) {
        birdY.current = SCREEN_HEIGHT - BIRD_SIZE;
        triggerGameOver();
        return;
      }

      // Mover tuberías y reciclar
      setPipes((prev) => {
        const updated = prev.map((p) => ({ ...p, x: p.x - PIPE_SPEED }));
        // reciclar las que salen de pantalla
        for (let p of updated) {
          if (p.x + PIPE_WIDTH < 0) {
            p.x = SCREEN_WIDTH + Math.random() * 120 + 60;
            p.topHeight = randomTopHeight();
            p.scored = false;
          }
        }
        return [...updated];
      });

      // Colisiones + puntuación
      setPipes((prev) => {
        let collided = false;
        let gained = 0;

        const newArr = prev.map((p) => {
          // Rectángulos de colisión
          const birdRect = {
            x1: BIRD_X,
            y1: birdY.current,
            x2: BIRD_X + BIRD_SIZE,
            y2: birdY.current + BIRD_SIZE,
          };

          const topPipe = { x1: p.x, y1: 0, x2: p.x + PIPE_WIDTH, y2: p.topHeight };
          const bottomPipe = {
            x1: p.x,
            y1: p.topHeight + PIPE_GAP,
            x2: p.x + PIPE_WIDTH,
            y2: SCREEN_HEIGHT,
          };

          const intersects = (r, s) =>
            !(r.x2 < s.x1 || r.x1 > s.x2 || r.y2 < s.y1 || r.y1 > s.y2);

          if (intersects(birdRect, topPipe) || intersects(birdRect, bottomPipe)) {
            collided = true;
          }

          // Sumar punto cuando el centro del pájaro pasa el borde derecho del pipe
          const birdCenterX = BIRD_X + BIRD_SIZE / 2;
          if (!p.scored && birdCenterX > p.x + PIPE_WIDTH) {
            gained += 1;
            return { ...p, scored: true };
          }
          return p;
        });

        if (gained > 0) setScore((s) => s + gained);
        if (collided) {
          triggerGameOver();
        }
        return newArr;
      });
    }, TICK_MS);

    return () => {
      if (loopRef.current) clearInterval(loopRef.current);
      loopRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const triggerGameOver = useCallback(() => {
    if (loopRef.current) {
      clearInterval(loopRef.current);
      loopRef.current = null;
    }
    setGameOver(true);
    setRunning(false);
    setBest((b) => (score > b ? score : b));
  }, [score]);

  // Render de una tubería (dos bloques: arriba y abajo)
  const renderPipe = (p, index) => {
    const bottomY = p.topHeight + PIPE_GAP;
    return (
      <View key={index} style={StyleSheet.absoluteFill}>
        {/* Tubería superior */}
        <View
          style={[
            styles.pipe,
            {
              height: p.topHeight,
              left: p.x,
              top: 0,
            },
          ]}
        />
        {/* Tubería inferior */}
        <View
          style={[
            styles.pipe,
            {
              height: SCREEN_HEIGHT - bottomY,
              left: p.x,
              top: bottomY,
            },
          ]}
        />
      </View>
    );
  };

  return (
    <Pressable style={styles.container} onPressIn={startIfNeeded}>
      {/* Cielo/fondo */}
      <View style={styles.background} />

      {/* Pájaro */}
      <View
        style={[
          styles.bird,
          {
            left: BIRD_X,
            top: birdY.current,
          },
        ]}
      />

      {/* Tuberías */}
      {pipes.map(renderPipe)}

      {/* HUD */}
      <View style={styles.hud}>
        <Text style={styles.score}>{score}</Text>
        <Text style={styles.best}>Mejor: {best}</Text>
      </View>

      {/* Indicaciones */}
      {!running && !gameOver && (
        <View style={styles.overlay}>
          <Text style={styles.title}>Flappy Bird</Text>
          <Text style={styles.subtitle}>Toca para empezar</Text>
        </View>
      )}

      {/* Game Over */}
      {gameOver && (
        <View style={styles.overlay}>
          <Text style={styles.title}>¡Game Over!</Text>
          <Text style={styles.subtitle}>Puntuación: {score}</Text>
          <Pressable onPress={resetGame} style={styles.button}>
            <Text style={styles.buttonText}>Reintentar</Text>
          </Pressable>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#87CEEB", // cielo
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  bird: {
    position: "absolute",
    width: BIRD_SIZE,
    height: BIRD_SIZE,
    borderRadius: BIRD_SIZE / 2,
    backgroundColor: "#ffdd00",
    borderWidth: 3,
    borderColor: "#333",
  },
  pipe: {
    position: "absolute",
    width: PIPE_WIDTH,
    backgroundColor: "#2ecc71",
    borderColor: "#1e824c",
    borderWidth: 3,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  hud: {
    position: "absolute",
    top: 40,
    width: "100%",
    alignItems: "center",
  },
  score: {
    fontSize: 48,
    fontWeight: "800",
    color: "#ffffff",
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  best: {
    marginTop: 4,
    fontSize: 16,
    color: "#ffffff",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 44,
    fontWeight: "900",
    color: "#fff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: "#fff",
    marginBottom: 16,
  },
  button: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    backgroundColor: "#333",
    borderRadius: 12,
    marginTop: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
