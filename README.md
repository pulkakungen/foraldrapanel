# Föräldrapanelen

En sida för dig, inte för barnen. Den visar läget i barnens appar och kan
skicka notiser till dem.

Ingen egen server. Sidan pratar direkt med varje barns Cloudflare Worker och
nyckeln sparas bara i din webbläsare.

## Vad den visar per barn

* Om notiser är påslagna på telefonen
* Hur länge sedan appen senast användes
* Dagens uppgifter, avbockade av totalt
* Nivå, streak, mat och kärlek
* De senaste fjorton dagarna som en stapel per dag, hovra för detaljer
* Hela dagens lista, utfällbar
* Länkar till statussidan och rapporten

Längst ner skriver du ett meddelande, kryssar i vilka det ska till och skickar.
Det landar som en notis på deras telefoner direkt.

## Apparna

| Barn | App | Worker |
| --- | --- | --- |
| Sassa | Sassibrass | `sassibrass-push` |
| Samuel | Sameluren | `sameluren-push` |
| Emil | Mrs Raccoon | `mrs-raccoon-push` |
| Frallan | Frallan | saknas, appen sparar allt lokalt i telefonen |

Frallan syns som ett kort men utan data. Den behöver en egen worker för att
kunna vara med på riktigt.

Listan ligger i `APPS` högst upp i `app.js`. Lägg till, ta bort eller byt namn
där.

## Nyckeln

Varje worker läser en hemlighet som heter `ADMIN_TOKEN`. Är den satt krävs den
för allt under `/admin` och för `/report`. Är den inte satt beter sig workern
precis som förut, så ingenting går sönder innan du hinner sätta den.

Sätt samma nyckel på alla tre:

```
npx wrangler secret put ADMIN_TOKEN
```

Kör kommandot i varje apps `cloudflare-worker`-mapp och klistra in samma värde.
Det är den nyckeln du skriver in i panelen.

Efter det behöver dina gamla bokmärken till `/admin/status` och `/report` ha
`?key=DIN_NYCKEL` på slutet. Panelens länkar lägger på den automatiskt.

## Vad som händer med data

Panelen läser bara. Den enda skrivande funktionen är att skicka ett meddelande.
Att dra tillbaka poäng kräver en kommandokö i varje app, det är nästa steg och
är inte byggt än.
