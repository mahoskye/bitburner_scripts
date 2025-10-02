# Alainbryden's Go Bot (Isolated)

This folder contains alainbryden's proven Go bot, isolated from the rest of his script suite.

## Files

- **go-player.js** - Main Go bot (from https://github.com/alainbryden/bitburner-scripts/blob/main/go.js)
- **helpers.js** - Required helper functions (from https://github.com/alainbryden/bitburner-scripts/blob/main/helpers.js)
- **README.md** - This file

## Usage

Run the bot against an opponent:
```
run game-scripts/go/go-player.js
```

The bot will automatically:
- Play against all available factions
- Use pattern matching and tactical analysis
- Make strategic decisions based on opponent difficulty
- Continue playing matches to farm reputation

## Credits

- **Original Author:** Sphyxis
- **Contributors:** Stoneware, gmcew, eithel, Insight (alainbryden)
- **Source:** https://github.com/alainbryden/bitburner-scripts

## Why This Bot?

After testing our custom scoring-based bot, we found:
- **Our bot:** 40% win rate, but 40% of games ended with all stones captured (0 points)
- **This bot:** Proven implementation using pattern matching and tactical priorities

The fundamental issue with our approach was trying to use positional scoring without understanding Go's life-and-death concepts. This bot uses patterns and tactical analysis that have been proven to work.

## Isolation

This bot is intentionally kept separate from the rest of the codebase:
- No integration with our managers/overlord system (yet)
- Self-contained with only helpers.js dependency
- Can be updated independently from our code
- Can be removed/replaced without affecting other systems

## Future Integration

If desired, this bot could be integrated with our overlord system by:
1. Adding it as a manager script in `managers/go-player.js`
2. Calling it from `overlord.js` with the `--go` flag
3. Using port communication for status updates
