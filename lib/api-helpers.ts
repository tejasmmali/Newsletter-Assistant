import { z } from "zod";
import { SourceSchema } from "@/lib/schemas";

export { IngestRequestSchema } from "@/lib/schemas";

export const zArrayOfSources = z.array(SourceSchema);
