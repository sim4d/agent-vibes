import { describe, expect, it } from "@jest/globals"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { ChatSessionManager } from "./chat-session.service"
import type { ParsedCursorRequest } from "./cursor-request-parser"

describe("ChatSessionManager multimodal initialization", () => {
  it("stores attached images in the initial user session history", () => {
    const originalHome = process.env.HOME
    const tempHome = fs.mkdtempSync(
      path.join(os.tmpdir(), "agent-vibes-chat-session-")
    )
    process.env.HOME = tempHome

    const manager = new ChatSessionManager()

    try {
      const initialRequest: ParsedCursorRequest = {
        conversation: [{ role: "user", content: "describe this image" }],
        newMessage: "describe this image",
        model: "claude-sonnet-4-20250514",
        thinkingLevel: 0,
        unifiedMode: "AGENT",
        isAgentic: true,
        supportedTools: [],
        useWeb: false,
        attachedImages: [{ data: "AQID", mimeType: "image/png" }],
      }

      const session = manager.getOrCreateSession("conv-1", initialRequest)

      expect(session.messages).toEqual([
        {
          role: "user",
          content: [
            { type: "text", text: "describe this image" },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: "AQID",
              },
            },
          ],
        },
      ])
    } finally {
      manager.onModuleDestroy()
      process.env.HOME = originalHome
      fs.rmSync(tempHome, { recursive: true, force: true })
    }
  })
})
