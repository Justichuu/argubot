# argubot

Give it a thing. It argues yes and no. It will not pick.

On a phone, open `index.html`. Keep it next to `argubot.js`. It runs here.
Nothing is sent.

```bash
node argubot.js pineapple on pizza
node argubot.js
```

The first one prints both sides. The second one talks. Type `done` to leave.
Each side is a short essay: a claim, reasons, and evidence. `yes` and `no`
say your side. If it cannot tell which side you are on, it flips a coin
for who talks first.

Read `argubot.js`. Checks are `test.js`. `npm test`. MIT.
