import "./setup.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { includedWho, setWhoIncluded } from "../js/state.js";

// Same calls the profile tiles make (focusPerson in ui/actions.js)
const focus = (who) => {
  setWhoIncluded("charlie", who === "all" || who === "charlie");
  setWhoIncluded("partner", who === "all" || who === "partner");
};

test("tapping a profile shows only that person, in any order", () => {
  for (const seq of [["charlie", "partner", "partner", "charlie"], ["all", "partner", "charlie", "all", "charlie"]]) {
    for (const who of seq) {
      focus(who);
      assert.deepEqual(includedWho().slice().sort(), who === "all" ? ["charlie", "partner"] : [who], `after tapping ${who}`);
    }
  }
});
