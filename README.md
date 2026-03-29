# Muzyka

Progressive Web App – odtwarzacz muzyki działający w przeglądarce i offline.

## Funkcje

- Wczytywanie plików audio z urządzenia (MP3, OGG, FLAC, WAV)
- Playlista z obsługą wielu plików
- Odtwarzanie / pauza, poprzedni / następny utwór
- Tryb losowy i powtarzanie
- Pasek postępu i regulacja głośności
- Obracający się winyl animowany CSS
- Media Session API – sterowanie z blokady ekranu
- Service Worker – działa offline
- Instalowalna jako PWA

## Deploy

Aplikacja jest automatycznie wdrażana na GitHub Pages przy każdym pushu do gałęzi main.
Workflow: .github/workflows/deploy.yml

## Lokalne uruchomienie

```bash
npx serve .
```

## Ikony PWA

```bash
npm install canvas
node generate-icons.js
```