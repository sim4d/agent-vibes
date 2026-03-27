import { describe, expect, it } from "@jest/globals"
import { CursorRequestParser } from "./cursor-request-parser"

describe("CursorRequestParser image attachments", () => {
  it("accepts image-only user messages and extracts inline image data", () => {
    const parser = new CursorRequestParser()

    const parsed = (
      parser as {
        parseRunRequest: (request: unknown) => {
          conversation: Array<{ role: "user" | "assistant"; content: string }>
          newMessage: string
          attachedImages?: Array<{
            data: string
            mimeType: string
            width?: number
            height?: number
          }>
        } | null
      }
    ).parseRunRequest({
      action: {
        action: {
          case: "userMessageAction",
          value: {
            userMessage: {
              text: "",
              selectedContext: {
                selectedImages: [
                  {
                    uuid: "img-1",
                    mimeType: "image/png",
                    dimension: { width: 1920, height: 1080 },
                    dataOrBlobId: {
                      case: "data",
                      value: Uint8Array.from([1, 2, 3]),
                    },
                  },
                ],
              },
            },
          },
        },
      },
    })

    expect(parsed).not.toBeNull()
    expect(parsed).toMatchObject({
      conversation: [{ role: "user", content: "" }],
      newMessage: "",
      attachedImages: [
        {
          data: "AQID",
          mimeType: "image/png",
          width: 1920,
          height: 1080,
        },
      ],
    })
  })
})
