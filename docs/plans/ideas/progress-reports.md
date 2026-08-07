# Progress reports

## Why this document exists

The profile drawer shows a **Progreso** row, disabled and marked
*próximamente*. That row is a promise, and this is what it promises. A disabled
row with no plan behind it is debt parked in the interface, which the
repository contract forbids.

## Problem

An adult can see that a child has letriestrellas and a shelf of animals. They
cannot see anything a teacher or a parent would actually ask:

- which chapters this child has finished, and which they keep replaying;
- whether they are stuck on one, and for how long;
- how a class is spread across the world, for a teacher with twenty children.

`Progress` records completed nodes, the last node played, claimed rewards, and
a star total. It records no timestamps at all, so "when" and "how long" cannot
be answered from what is stored today.

## Open questions

1. **What is the smallest useful report?** A per-child chapter list is cheap
   and probably enough for a parent. A class view is a different product and
   needs the group tenancy that does not exist yet.
2. **What has to be recorded to support it?** Adding a finish timestamp per
   completion changes `Progress`, which is stored client-side today and read by
   `deriveMapView`. That is a schema change with a migration, not an addition.
3. **Is a report personal data?** A named child's difficulty with a literacy
   task is closer to sensitive than the star count is. The privacy baseline
   requires retention and deletion answers before any of it is stored, and
   almost certainly bars it from leaving the device until accounts and a
   deployment's privacy artefacts exist.
4. **Who is it for first?** The institutional market comes first, and a teacher
   wants a class view — which is exactly the reading that needs the most data
   and the most privacy review.

## Not yet decided

Everything above. This is an idea, not a plan; nothing here is approved and no
part of it should be implemented from this document.
