# argubot

argubot: it's me as a bot - not really that funny, and it argues everything. It also makes them worse and unfriendly and breaks their logic.

Give it a thing. It argues yes and no. It will not pick.

## Demo

![argubot arguing both sides of "hey how are you", "please just agree with me", and "I like you"](media/argubot_demo.gif)

The same run as a downloadable clip: [media/argubot_demo.mp4](media/argubot_demo.mp4).

On a phone, open `index.html`. Keep it next to `argubot.js`. Type a thing.
Press Argue. Nothing is sent.

```bash
node argubot.js pineapple on pizza
node argubot.js
```

The first one prints both sides. The second one talks. Type `done` to leave.
`yes` and `no` say your side. If it cannot tell, it flips a coin.

Read `argubot.js`. Checks are `test.js`. `npm test`. MIT.
