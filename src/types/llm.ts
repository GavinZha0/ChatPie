export type LlmModelType =
  | "chat"
  | "vision"
  | "embedding"
  | "audio"
  | "transcription"
  | "rerank"
  | "agent";

export interface LlmModel {
  id: string;
  provider: string;
  type: LlmModelType;
  functionCall: boolean;
  imageInput: boolean;
  contextLimit: number;
  updatedAt: Date;
}

export type CreateLlmModel = {
  id: string;
  provider: string;
  type?: LlmModelType;
  functionCall?: boolean;
  imageInput?: boolean;
  contextLimit?: number;
};

export type UpdateLlmModel = Partial<Omit<LlmModel, "id" | "provider">>;

export interface LlmRepository {
  selectAll(): Promise<LlmModel[]>;
  selectById(id: string): Promise<LlmModel | null>;
  selectByProvider(provider: string): Promise<LlmModel[]>;
  save(model: CreateLlmModel): Promise<LlmModel>;
  update(
    id: string,
    provider: string,
    model: UpdateLlmModel,
  ): Promise<LlmModel | null>;
  deleteById(id: string): Promise<void>;
}
