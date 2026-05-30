function Connecting() {
  return (
    <div className="screen center">
      <div className="card">
        <div className="spinner" />
        <h2>Łączenie z serwerem...</h2>
        <p className="muted">
          Sprawdź czy serwer jest uruchomiony i czy adres w <code>socket.js</code> jest poprawny.
        </p>
      </div>
    </div>
  );
}

export default Connecting;
