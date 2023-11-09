<h1>Youtube Freemium</h1>

<h3>Features<h3>
- Find and display lyrics in popup or in floating manner.
- mute ads (preserve state)
- skip upcoming ad
- display time saved
- Manual search if unable to find lyrics
- Lyrics Source: Google
- multi tab support (upcoming)
- Explicit lyric
- Donate

<h3>Caveat</h3>
- cannot auto search when player is minimized


<h3>WP<h3>

cjs[valid page? || music changed] -> bjs[find(locally ? -> online), validate and save] -> popjs[query and display lyrics]

bjs[valid page? || music changed] -> cjs[find, validate, save, display] -> popjs[query and display lyrics]

Happy Scenarios - 
Current tab opened - Music Playing
				   - cjs[find, save lyrics], display

Edge case scnarios
Different tab open - Music Changed -
Multiple tabs open - Music playing on one - 
Multiple tabs open - Music playing on both - 
Multiple tabs open (Diff tab) - Music changed on one -