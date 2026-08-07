# Reimplemented minigame specifications

Step 1 and step 2 of the selective migration process in
[godot-prototype.md](godot-prototype.md): each minigame's learning objective and
rules, stated without reference to the prototype's implementation, plus its fit
with the roster model.

These specifications are authoritative. Where they disagree with the prototype,
they win.

## Shared vocabulary

Five of these games teach vocabulary rather than the child's own name, so they
consume **vocabulary items** instead of roster participants. A vocabulary item
is a picture together with the syllable sequence that spells its word.

The word is **derived** from the syllables (`syllables.join("")`), never stored
alongside them. A word that disagrees with its own syllabification is therefore
not expressible, rather than being a validation error nobody runs.

The prototype discovered its content by listing an assets directory and parsing
filenames, with hyphens marking syllable boundaries. That is the mechanism
[godot-prototype.md](godot-prototype.md) rejects. Content here arrives only in a
validated manifest.

### Personalisation

None of these five games personalise. They use product-authored default
vocabulary, so they are playable with no uploads and no child data at all — the
institutional pilot's requirement. They carry no participants, and the manifest
makes a vocabulary resource with participants unrepresentable.

## Pairs (`pairs-game`)

**Objective.** Associate a written word with the object it names, with several
associations visible at once.

**Rules.**

1. The resource supplies *n* vocabulary items. Each contributes one picture card
   and one word card.
2. Picture cards and word cards form two separate groups. Word cards are
   presented in a seeded order independent of the picture cards.
3. The child selects one card, then another.
4. Selecting two cards from the same group is not an answer. The first selection
   is cleared.
5. Selecting one card from each group is an attempt:
   - same vocabulary item → both cards are matched and stay matched;
   - different items → the selection clears and the board is unchanged.
6. The round is won when every pair is matched. It cannot be lost.

**Roster fit.** No roster. Vocabulary only.

## Word and picture (`word-picture-game`)

Known to the product team as *cartapum*.

**Objective.** Recognise a written word and pick the single picture it names,
against distractors.

**Rules.**

1. The resource supplies a target vocabulary item and *k* distractor items.
2. The target's word is displayed. It is not selectable.
3. The target's picture and every distractor picture are presented together in a
   seeded order.
4. Selecting the target's picture wins the round.
5. Selecting a distractor changes nothing. The round continues and every
   picture, including that one, stays selectable.
6. The round cannot be lost.

**Roster fit.** No roster. Vocabulary only.

**Deviation from the prototype.** The prototype bound the correct picture to a
different click handler than the distractors, which encodes the answer in the
event wiring. Here the rules decide from the manifest, so no per-card wiring can
disagree with the answer.

## Syllables (`syllables-game`)

**Objective.** Segment a word into syllables and rebuild it in order.

**Rules.**

1. The resource supplies one target vocabulary item of at least two syllables.
   A one-syllable target is rejected by the schema, not at runtime.
2. Its picture is shown, together with one ordered, initially empty slot per
   syllable.
3. Syllable cards are presented in a seeded order in which **no card starts in
   the slot it belongs to**.
4. Placing a card into a slot is an attempt:
   - correct slot → the card stays and the slot is filled;
   - wrong slot, or an occupied slot → the card returns to the row it came
     from and the round is otherwise unchanged.
5. The round is won when every slot is filled. It cannot be lost.

**Roster fit.** No roster. Vocabulary only.

**Placement is a drag, and only a drag** — see the letters game below, which
arranges it identically and states why.

**Deviation from the prototype.** The prototype produced rule 3 by reshuffling
until no syllable *value* sat in its home position. For a word whose syllables
repeat — `ca-ca` — no such arrangement exists and the loop never terminates.
The rule here deranges **positions**, which always exists for two or more
slots and always terminates.

## Letters (`letters-game`)

**Objective.** Spell a pictured word by putting its letters in order.

The next step after segmentation: syllables teaches that a word is made of
parts, and this teaches that those parts are made of letters. It is the same
ordering task at a finer grain, which is why the two share their rules
(`sequenceRound.ts`) and differ only in what a card carries.

**Rules.**

1. The resource supplies one target vocabulary item.
2. Its letters are **derived** from its word, which is itself derived from its
   syllables. A spelling that disagrees with the word is not expressible.
3. Its picture is shown, together with one ordered, initially empty slot per
   letter.
4. Letter cards are presented in a seeded order in which **no card starts in
   the slot it belongs to** — the same position derangement the syllables game
   uses, for the same reason.
5. Placing a card into a slot is an attempt:
   - correct slot → the card stays and the slot is filled;
   - wrong slot, or an occupied slot → the card returns to the row it came
     from and the round is otherwise unchanged.
6. The round is won when every slot is filled. It cannot be lost.
7. A word of fewer than two or more than eight letters is refused. One letter is
   already the whole word; nine cards on a panel is a search task rather than a
   spelling one, and the cards stop being big enough to hit.

**Roster fit.** No roster. Vocabulary only.

**Where the length rule lives.** In the rules (`assertSpellable`), not the
schema: the letters are derived, and a schema cannot constrain a value it does
not store. The catalogue calls the same function while a world is authored, so
an unplayable word fails when it is written rather than when a child opens the
chapter.

**Placement is a drag, and only a drag.** The child drags a letter from the row
of cards onto a slot. A tap does nothing, and that is the point: a tap is
reserved for the word recordings — see [audio](../plans/ideas/audio.md) —
where tapping a card will sound out what is written on it. A gesture cannot
both place a card and read it aloud.

This replaced an earlier arrangement in which tap-the-card then tap-the-slot
worked alongside the drag, on the grounds that a drag does not survive an aged
panel digitiser equally across touch, stylus, and mouse. That fallback was
given up deliberately; see
[ADR 0011](../decisions/0011-no-lives-and-drag-only-answers.md).

**Layout.** The picture is at the top, where a child cannot reach; the letter
cards and the slots below them are both inside the lower reach band.

## Initial syllable (`initial-syllable-game`)

**Objective.** Hear that two words begin with the same syllable, and see the
syllable they share.

The step between the initials game, which is about a letter, and the syllables
game, which takes a whole word apart: `GA-llo` and `GA-to` open the same way,
and hearing that is what Spanish blending is built on. It is the first game
here with no prototype ancestor.

**Rules.**

1. The resource supplies exactly four vocabulary items: one target and three
   choices. The count is pinned by the schema, not passed by a caller.
2. Which choice is right is **named** in the template, never positional — the
   vocabulary is shuffled by seed and its order carries no meaning.
3. The target's picture is shown above; the three choices are shown below.
4. Choosing is an attempt:
   - the named match → won;
   - any other choice → the card returns to the row and nothing else changes.
5. The round is won on the match. It cannot be lost.
6. Winning **reveals both words** with the syllable they share picked out in
   colour. That reveal is the lesson; the win is only its occasion.

**Roster fit.** No roster. Vocabulary only.

**What the rules refuse, and the schema cannot.** That the named match really
opens with the target's syllable, and that no distractor does. A round with two
right answers is one a child is marked wrong for being right in, so
`createInitialSyllableRound` refuses to build it — while a world is authored as
well as when a round starts.

**Where the match comes from.** A world node names its target and nothing else.
The match and the distractors are drawn from the catalogue by seed, so a node
cannot claim a match that does not actually share the syllable. A target whose
opening syllable no other word shares — `flor`, `iglu`, `tren`, about half the
shipped vocabulary — is refused when the world is built.

The draw also skips a candidate written inside the target from its first letter.
`CARAMELO` against `CARAMELOS` emphasises the same `CA` and reads as one word
printed twice.

**Accents are not folded.** `ni` and `ní` are different opening syllables here.
Whether they are the same sound is a phonetic claim this repository has no basis
to make, and it is a difference a Spanish reader sees.

**Answering is a drag, and only a drag**, exactly as the letters game arranges
it and for the same reason: the child carries a picture up to the target, and a
tap is left free for the word recordings — see
[audio](../plans/ideas/audio.md) — where tapping a card will play its word.
That is the very thing this game teaches a child to hear, so it is the gesture
worth reserving.

**Layout.** The target is above the child reach band, because it is shown and
never touched; the row of three choices is inside it.

## Pictures

Every vocabulary item names an `imageUrl` under `/vocabulary/`, served from
`apps/player-web/public/vocabulary/` and loaded by the scene's `preload`.

The pictures come from the prototype, imported by
`scripts/import-vocabulary-images.mjs` — which is also the provenance record,
because it states exactly which source produced each committed file. Rights are
recorded in `apps/player-web/public/vocabulary/PROVENANCE.md`. Nothing is added
to that directory by hand.

A picture that fails to load is a missing **default**, so it fails closed
(invariant 6): `ResourceScene` counts loader failures and shows an adult-facing
message instead of rendering a game with holes in it. This is not the
personalised-media exception, which does not apply — these games do not
personalise.

## Style

The card is the prototype's, reproduced in `vocabularyCard.ts`: 200×200, white,
a 6px `#B359E6` border, a 20px corner radius, pictures inset by 10px, uppercase
black labels, green on a match and red on a mistake, and the syllables game on
its turquoise `#33F2D9` field. The letters game has no prototype to reproduce;
it takes the same card on a warm `#FFD98A` field, so the two ordering games are
told apart from across a classroom rather than by reading their banners. Those values are the prototype's Godot colours
converted from 0–1 floats.

What is deliberately *not* reproduced is its layout: the prototype positioned
cards at fixed pixel offsets, which is one of the practices
[godot-prototype.md](godot-prototype.md) rejects. Rows here are centred and
spaced from the logical canvas size.

## No lives

None of these games can be lost. A wrong answer does not stick and costs
nothing else: the card goes back where it came from, the board is exactly what
it was, and the child tries again. The prototype's three-life budget is gone,
and `RoundStatus` has two members — `playing` and `won` — so a losing round is
not a state this codebase can express.

What a wrong answer still does is *say so*: the card flashes red and shakes.
That is feedback, not a penalty.

Round state is owned by the rules, not progress state: templates never read or
write progress (invariant 2). See
[ADR 0011](../decisions/0011-no-lives-and-drag-only-answers.md).
