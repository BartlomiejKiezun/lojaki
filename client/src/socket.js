import { io } from "socket.io-client";

/**
 * Adres serwera:
 * - Lokalnie (development): http://localhost:3001 lub IP komputera
 * - Produkcja (Render): URL serwera ustawiony w REACT_APP_SERVER_URL
 */
const SERVER_URL =
  process.env.REACT_APP_SERVER_URL ||
  `http://${window.location.hostname}:3001`;

export const socket = io(SERVER_URL, {
  transports: ["websocket", "polling"],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000
});

socket.on("connect", () => {
  console.log("✅ Połączono z serwerem", SERVER_URL);
});

socket.on("connect_error", (err) => {
  console.error("❌ Błąd połączenia:", err.message);
});

socket.on("disconnect", () => {
  console.log("🔌 Rozłączono z serwerem");
});