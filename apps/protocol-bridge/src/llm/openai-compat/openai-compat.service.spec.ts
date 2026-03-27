import { describe, expect, it, jest } from "@jest/globals"
import { ConfigService } from "@nestjs/config"
import type { CreateMessageDto } from "../../protocol/anthropic/dto/create-message.dto"
import { OpenaiCompatService } from "./openai-compat.service"

type OpenaiCompatStreamHarness = OpenaiCompatService & {
  apiKey: string
  baseUrl: string
  responsesApiMode: "auto" | "always" | "never"
  resolveEndpoint(model: string): "responses" | "chat-completions"
  translateRequest(
    dto: CreateMessageDto,
    stream: boolean
  ): {
    messages: Array<{
      role: string
      content?:
        | string
        | Array<{ type: string; text?: string; image_url?: { url: string } }>
    }>
  }
  sendClaudeMessageStreamViaChatCompletions(
    dto: CreateMessageDto
  ): AsyncGenerator<string, void, unknown>
  sendClaudeMessageStreamViaResponses(
    dto: CreateMessageDto
  ): AsyncGenerator<string, void, unknown>
}

describe("OpenaiCompatService stream fallback", () => {
  const dto: CreateMessageDto = {
    model: "gpt-5",
    messages: [],
  }

  async function* makeStream(
    events: string[],
    error?: Error
  ): AsyncGenerator<string, void, unknown> {
    await Promise.resolve()
    for (const event of events) {
      yield event
    }
    if (error) {
      throw error
    }
  }

  function createService(): OpenaiCompatService {
    const get = jest.fn((_: string, defaultValue = "") => defaultValue)
    const configService = {
      get,
    } as Pick<ConfigService, "get"> as ConfigService

    const service = new OpenaiCompatService(configService)
    const harness = service as OpenaiCompatStreamHarness
    harness.apiKey = "test-key"
    harness.baseUrl = "https://example.com"
    harness.responsesApiMode = "auto"

    return service
  }

  it("does not fallback to Responses API after chat stream already emitted data", async () => {
    const harness = createService() as OpenaiCompatStreamHarness
    const streamError = new Error(
      "OpenAI-compatible API error 503: no_available_providers"
    )

    jest
      .spyOn(harness, "sendClaudeMessageStreamViaChatCompletions")
      .mockImplementation(() => makeStream(["partial-chat-event"], streamError))

    const responsesSpy = jest
      .spyOn(harness, "sendClaudeMessageStreamViaResponses")
      .mockImplementation(() => makeStream(["responses-event"]))

    const seen: string[] = []

    await expect(
      (async () => {
        for await (const chunk of harness.sendClaudeMessageStream(dto)) {
          seen.push(chunk)
        }
      })()
    ).rejects.toThrow(streamError.message)

    expect(seen).toEqual(["partial-chat-event"])
    expect(responsesSpy).not.toHaveBeenCalled()
  })

  it("does not fallback to Chat Completions after responses stream already emitted data", async () => {
    const harness = createService() as OpenaiCompatStreamHarness
    const streamError = new Error("OpenAI-compatible API error 503: upstream")

    jest.spyOn(harness, "resolveEndpoint").mockReturnValue("responses")

    jest
      .spyOn(harness, "sendClaudeMessageStreamViaResponses")
      .mockImplementation(() =>
        makeStream(["partial-responses-event"], streamError)
      )

    const chatSpy = jest
      .spyOn(harness, "sendClaudeMessageStreamViaChatCompletions")
      .mockImplementation(() => makeStream(["chat-event"]))

    const seen: string[] = []

    await expect(
      (async () => {
        for await (const chunk of harness.sendClaudeMessageStream(dto)) {
          seen.push(chunk)
        }
      })()
    ).rejects.toThrow(streamError.message)

    expect(seen).toEqual(["partial-responses-event"])
    expect(chatSpy).not.toHaveBeenCalled()
  })

  it("translates Anthropic image blocks into OpenAI vision content", () => {
    const harness = createService() as OpenaiCompatStreamHarness

    const request = harness.translateRequest(
      {
        model: "gpt-5",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "what is in this image?" },
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
        ],
      },
      false
    )

    expect(request.messages).toEqual([
      {
        role: "user",
        content: [
          { type: "text", text: "what is in this image?" },
          {
            type: "image_url",
            image_url: { url: "data:image/png;base64,AQID" },
          },
        ],
      },
    ])
  })
})
