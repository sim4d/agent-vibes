import { describe, expect, it } from "@jest/globals"

import {
  consumeThinkingTagTextDelta,
  createThinkingTagStreamState,
  flushThinkingTagTextDelta,
  splitThinkingTaggedText,
} from "./openai-compat.service"

describe("OpenAI compat thinking-tag normalization", () => {
  it("splits full tagged text into thinking and text blocks", () => {
    expect(
      splitThinkingTaggedText(
        "<thinking>\nPlan first.\n</thinking>\n\nFinal answer."
      )
    ).toEqual([
      { type: "thinking", thinking: "\nPlan first.\n" },
      { type: "text", text: "\n\nFinal answer." },
    ])
  })

  it("handles tags split across streaming chunks", () => {
    const state = createThinkingTagStreamState()

    expect(consumeThinkingTagTextDelta(state, "<thin")).toEqual([])
    expect(consumeThinkingTagTextDelta(state, "king>\nLet me read")).toEqual([
      { type: "thinking", text: "\nLet me read" },
    ])
    expect(consumeThinkingTagTextDelta(state, ".\n</thin")).toEqual([
      { type: "thinking", text: ".\n" },
    ])
    expect(consumeThinkingTagTextDelta(state, "king>\nDone")).toEqual([
      { type: "thinking_end" },
      { type: "text", text: "\nDone" },
    ])
    expect(flushThinkingTagTextDelta(state)).toEqual([])
  })

  it("flushes incomplete trailing tag fragments as literal text", () => {
    const state = createThinkingTagStreamState()

    expect(consumeThinkingTagTextDelta(state, "literal <thin")).toEqual([
      { type: "text", text: "literal " },
    ])
    expect(flushThinkingTagTextDelta(state)).toEqual([
      { type: "text", text: "<thin" },
    ])
  })
})
