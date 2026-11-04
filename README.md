# Bright Hearts RPG

A co-op pixel art dungeon raid RPG for 1 to 10 heroes, playable in any phone browser.
Made by **[LONERXONE](https://github.com/LONERXONE-ops)**.

## Play

Once GitHub Pages is on, the game lives at:
**https://lonerxone-ops.github.io/Bright-hearts-RPG/**

Turn your phone sideways. Move with the stick, attack with the big red button, two class skills,
dodge roll (invincible while rolling), and a potion button. On PC: WASD to move, Space/J attack,
K and L skills, Shift dodge, Q potion, E interact, I hero panel, Enter chat.

## What is in v0.1

- **5 classes** from the design guide: Warrior, Mage, Savage, Gunman, Engineer (Scrap resource),
  with the guide's 100-point attribute spreads, 2 active skills each plus dodge
- **Brightheart Village** hub: Village Store and Market Counter (Sell All Treasures), Blacksmith
  (repair, smelt into Forged Ingots, upgrade), Enchanter (roll and lock perks), Tavern meals and
  the King's Banquet, Guild Board bounties, Dungeon Portal
- **King's Castle** throne room: Royal Decrees (Mastery Seals) and King's Crusades
- **Overgrown Ruins**: procedural dungeon stitched from 5 to 8 rooms out of a pool of 12 templates,
  room seals that open when cleared, breakable jars, crates and Sunken Chests, poison puddles,
  Viper Swarmers, Venom Spitters, Bramble Tortoises (frontal block), Mandrake Shriekers (heal snakes)
- **Boss: Three-Headed Snake** with independent heads (venom barrage, fang bite, tail sweep);
  severing a head disables its attack
- Loot: guide's rarity tables per difficulty, private loot, boss pity counter, tiered Treasures,
  Viper-Scale set bonuses, durability, enchant slots
- Party scaling (Solo, Small Squad, Mid Party, Full Guild Raid), downed state with bleed-out timer,
  revives (Mage revives from range), party wipes
- **Online co-op**: party Room Codes, up to 10 players, shared village with chat bubbles

## Art direction

All art is generated in code at startup (no image files besides the logo). The style was
synthesized from research on the reference list: 16-bit SNES sprite language (Final Fantasy VI,
Chrono Trigger, Chained Echoes), hue-shifted ramps with indigo shadows and warm highlights
(Eastward, Sea of Stars), saturated hopeful colour (Stardew Valley, Forager), neon magic accents
(Hyper Light Drifter), and smooth hi-res light over pixel art (Children of Morta, Octopath's HD-2D).

## Multiplayer server (Render)

The server is `server/index.js`, zero dependencies. `render.yaml` deploys it:

1. Sign in at render.com with GitHub
2. New → Blueprint → pick this repo → Apply
3. Copy the URL Render gives you; if it is not `bright-hearts-rpg-server.onrender.com`,
   paste it in the game's Settings (or it gets set as the default in `client/src/config.js`)

The free plan sleeps after about 15 idle minutes, so the first connection can take up to a minute.

## Run locally

```
node tools/serve.js        # game on http://localhost:8080
node server/index.js       # multiplayer on ws://localhost:8787
```

## Layout

```
client/            static game (GitHub Pages serves this folder)
  src/art/         procedural pixel art: palette, tiles, characters, enemies, props, icons, fx
  src/data/        classes, items, quests from the design guide
  src/world/       village + castle maps, procedural dungeon generator
  src/game/        Phaser world scene, combat + co-op sync, progression
  src/ui/          HUD, touch controls, all panels
  vendor/          Phaser 3.90
server/            WebSocket server (rooms, parties, relay)
```
