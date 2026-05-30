# 🎮 Sabotażysta - Gra Imprezowa

Webowa gra imparzowa inspirowana Among Us + Jackbox. Każdy gra na swoim telefonie!

---

## 🚀 Uruchomienie

### 1. Zainstaluj Node.js
Pobierz z: https://nodejs.org (wersja LTS)

### 2. Zainstaluj zależności serwera
```
cd server
npm install
```

### 3. Zainstaluj zależności klienta
```
cd client
npm install
```

### 4. Uruchom serwer (Terminal 1)
```
cd server
node index.js
```

### 5. Uruchom klienta (Terminal 2)
```
cd client
npm start
```

### 6. Gracze łączą się telefonami
- Sprawdź IP swojego komputera (ipconfig na Windows, ifconfig na Mac/Linux)
- Gracze otwierają w przeglądarce telefonu: http://TWOJE_IP:3000
- Wszyscy muszą być w tej samej sieci WiFi!

---

## 🖼️ Podmiana avatarów

Wrzuć zdjęcia graczy do folderu:
  client/public/avatars/

Nazwy plików muszą pasować do tych w server/players.json:
  barti.jpg, adam.jpg, aneta.jpg, kuba.jpg, agata.jpg, monika.jpg, natus.jpg

---

## 👥 Edycja graczy

Lista graczy: server/players.json
Format: { "name": "Barti", "avatar": "/avatars/barti.jpg" }

---

## 🎯 Jak grać

Role: Zwykli gracze vs Sabotażyści (2 osoby, nie wiedzą o sobie!)

Cykl gry:
1. Minigra 1 - Kalambury ruchowe
2. Minigra 2 - 5 sekund
3. Głosowanie
4. Eliminacja
5. Powtarzaj

Wygrana: Gracze eliminują wszystkich sabo / Sabo zdobywają więcej punktów

---

## 🎮 Minigry

KALAMBURY RUCHOWE
- Każdy gracz po kolei pokazuje hasło (bez słów!)
- Pozostali wpisują odpowiedź na telefonie
- Ktoś zgadł = +1 punkt gracze | Nikt nie zgadł = +1 punkt sabo
- Koniec gdy wszyscy pokazali → podsumowanie → każdy klika Dalej

5 SEKUND
- Każdy gracz po kolei dostaje pytanie (np. "Wymień 3 miasta")
- Naciska START → 10 sekund → mówi głośno
- Pozostali głosują OK lub NIE
- 3+ głosów NIE = nie zaliczone (+1 sabo) | mniej = zaliczone (+1 gracze)
- Koniec gdy wszyscy mówili

GŁOSOWANIE
- Wszyscy głosują kto jest sabotażystą
- Największa liczba głosów = odpada (remis = losowanie)

ELIMINACJA
- Ekran ODPADA (bez ujawniania roli publicznie)
- Wyrzucony dostaje prywatnie listę sabotażystów (odsuń się od innych!)
- Pełne role pokazują się dopiero w GameOver

---

## ⚙️ Konfiguracja (server/index.js)

MIN_PLAYERS = 3        (zmień na 9 dla realnej gry)
ACTING_TIME = 120      (sekundy na kalambury)
FIVE_SECONDS_TIME = 10 (sekundy na odpowiedź)
REJECT_THRESHOLD = 3   (głosów NIE żeby odrzucić)
