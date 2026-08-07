import type { ChildRecord } from "@lectoemocion/domain";
import { syntheticClass } from "@lectoemocion/template-catalog";

/**
 * The roster the player has, which today is a stand-in or nothing at all.
 *
 * There is no way for an adult to record a child yet — photo and recording
 * capture is separate work — so *El libro de los nombres* would be unopenable
 * and undevelopable without a class to stand in for one.
 *
 * A production build gets nothing. Twenty invented children shown to a school
 * as if they were its pupils is a worse failure than a chapter that says it
 * needs names, and this is the one line standing between the two. The whole
 * decision lives here, named, rather than inlined at a call site where a later
 * reader would take it for a default value.
 *
 * When capture lands this function is replaced by the real roster, and nothing
 * downstream of it changes: `createResourceForNode` already takes
 * `ChildRecord[]` and cannot tell where they came from.
 */
export function rosterForBuild(isDevelopment: boolean): readonly ChildRecord[] {
  return isDevelopment ? syntheticClass : [];
}
