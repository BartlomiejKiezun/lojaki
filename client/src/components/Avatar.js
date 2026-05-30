import { useState } from "react";

/**
 * Wyświetla awatar gracza.
 * Próbuje załadować obraz z `src`. Jeśli się nie uda (np. nie ma pliku),
 * pokazuje fallback z pierwszą literą imienia.
 */
function Avatar({ src, name, size = "medium" }) {
  const [error, setError] = useState(false);

  const sizeClass = `avatar-${size}`;

  if (!src || error) {
    return (
      <div className={`avatar ${sizeClass} avatar-fallback`}>
        {(name || "?").charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      className={`avatar ${sizeClass}`}
      onError={() => setError(true)}
    />
  );
}

export default Avatar;
