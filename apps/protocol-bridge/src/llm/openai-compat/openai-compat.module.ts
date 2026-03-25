import { Module } from "@nestjs/common"
import { OpenaiCompatService } from "./openai-compat.service"

@Module({
  providers: [OpenaiCompatService],
  exports: [OpenaiCompatService],
})
export class OpenaiCompatModule {}
