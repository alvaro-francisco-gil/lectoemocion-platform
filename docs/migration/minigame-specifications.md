# Reimplemented minigame specifications

Step 1 and step 2 of the selective migration process in
[godot-prototype.md](godot-prototype.md): each minigame's learning objective and
rules, stated without reference to the prototype's implementation, plus its fit
with the roster model.

These specifications are authoritative. Where they disagree with the prototype,
they win.

## Shared vocabulary

Three of these games teach vocabulary rather than the child's own name, so they
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

None of these three games personalise. They use product-authored default
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
   is cleared and no life is spent.
5. Selecting one card from each group is an attempt:
   - same vocabulary item → both cards are matched and stay matched;
   - different items → one life is spent.
6. The round is won when every pair is matched, and lost when lives reach zero.

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
5. Selecting a distractor spends one life. The round continues; the picture
   stays selectable.
6. The round is lost when lives reach zero.

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
   - wrong slot, or an occupied slot → the card returns and one life is spent.
5. The round is won when every slot is filled, and lost when lives reach zero.

**Roster fit.** No roster. Vocabulary only.

**Deviation from the prototype.** Placement is tap-the-card then tap-the-slot,
not a drag. Touch, stylus, and mouse then map to one semantic action; a drag
gesture does not survive an aged panel digitiser equally across all three.

**Deviation from the prototype.** The prototype produced rule 3 by reshuffling
until no syllable *value* sat in its home position. For a word whose syllables
repeat — `ca-ca` — no such arrangement exists and the loop never terminates.
The rule here deranges **positions**, which always exists for two or more
slots and always terminates.

## Pictures

No default artwork is authored yet. Every vocabulary item names an `imageUrl`,
which is the contract the artwork will satisfy, and until then the player draws
a deterministic geometric glyph derived from the item's identifier — the same
synthetic-content approach the roster games use for avatars.

The renderer does not fetch `imageUrl`, because a missing default must fail
closed (invariant 6) and a 404 during a lesson is exactly that failure. Wiring
the loader is the job of the change that authors the artwork.

## Lives

All three spend from the same three-life budget the prototype used. Lives are
round state owned by the rules, not progress state: templates never read or
write progress (invariant 2).
