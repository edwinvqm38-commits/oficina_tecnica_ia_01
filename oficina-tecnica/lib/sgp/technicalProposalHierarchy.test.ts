import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildTechnicalProposalHierarchy,
  numberTechnicalProposalHierarchy,
  numberTechnicalProposalResourceGroups,
  resolveTechnicalProposalInsertionLevel,
} from "./technicalProposalHierarchy";

type Item = { id: string; level: number; number: string; kind: "group" | "subgroup" | "activity" };

function number(levels: number[]): Item[] {
  return numberTechnicalProposalHierarchy(
    levels.map((level, index) => ({ id: `item-${index + 1}`, level, number: "", kind: index === 0 ? "group" : "activity" })),
  );
}

describe("technical proposal hierarchy numbering", () => {
  it("case A numbers four real hierarchy levels", () => {
    assert.deepEqual(number([0, 1, 2, 3]).map((item) => item.number), ["1", "1.1", "1.1.1", "1.1.1.1"]);
  });

  it("case B numbers siblings from their common parent", () => {
    assert.deepEqual(number([0, 1, 2, 2, 1]).map((item) => item.number), ["1", "1.1", "1.1.1", "1.1.2", "1.2"]);
  });

  it("case C numbers two root titles independently", () => {
    assert.deepEqual(number([0, 0]).map((item) => item.number), ["1", "2"]);
  });

  it("case D renumbers an activity when moved from 1.1 to 1.2", () => {
    const moved = numberTechnicalProposalHierarchy<Item>([
      { id: "title", level: 0, number: "", kind: "group" },
      { id: "subtitle-1", level: 1, number: "", kind: "subgroup" },
      { id: "subtitle-2", level: 1, number: "", kind: "subgroup" },
      { id: "activity", level: 2, number: "", kind: "activity" },
    ]);
    assert.equal(moved.find((item) => item.id === "activity")?.number, "1.2.1");
    assert.equal(buildTechnicalProposalHierarchy(moved).find((item) => item.id === "activity")?.parentId, "subtitle-2");
  });

  it("cases E and F number only resource groups that exist", () => {
    const groups = numberTechnicalProposalResourceGroups("1.1.1", [{ key: "mano_obra" }, { key: "materiales" }]);
    assert.deepEqual(groups, [
      { key: "mano_obra", number: "1.1.1.1" },
      { key: "materiales", number: "1.1.1.2" },
    ]);
  });

  it("case G renumbers materials after labor is removed", () => {
    const [materials] = numberTechnicalProposalResourceGroups("1.1.1", [{ key: "materiales" }]);
    assert.deepEqual(materials, { key: "materiales", number: "1.1.1.1" });
  });

  it("preserves node type instead of deriving it from depth", () => {
    const [rootActivity] = numberTechnicalProposalHierarchy<Item>([{ id: "activity", level: 0, number: "", kind: "activity" }]);
    assert.equal(rootActivity.kind, "activity");
  });

  it("uses persisted parent identity as the authoritative hierarchy", () => {
    const hierarchy = buildTechnicalProposalHierarchy([
      { id: "title", level: 0, parentId: null },
      { id: "subtitle", level: 0, parentId: "title" },
      { id: "activity", level: 0, parentId: "subtitle" },
    ]);
    assert.deepEqual(hierarchy.map((item) => [item.parentId, item.number]), [
      [null, "1"],
      ["title", "1.1"],
      ["subtitle", "1.1.1"],
    ]);
  });

  it("inserts a new activity as a child of the selected subtitle", () => {
    assert.equal(resolveTechnicalProposalInsertionLevel("activity", { level: 1, kind: "subgroup" }), 2);
    assert.equal(resolveTechnicalProposalInsertionLevel("activity", { level: 2, kind: "activity" }), 2);
  });
});
