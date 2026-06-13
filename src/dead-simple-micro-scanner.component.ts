import { ChangeDetectorRef, Component, EventEmitter, Input, Output, inject } from "@angular/core";
import { ParseRelayClient, isEnvelope } from "@parserelay/client";
import type { DocType, Engine, OcrConfig, ScanEnvelope, ScanSchema } from "@parserelay/core";

type Status = "idle" | "reading" | "scanning" | "done" | "error";

function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("file read failed"));
    reader.readAsDataURL(file);
  });
}

/**
 * `<parserelay-scanner>` — capture or upload an image, scan it, get structured
 * fields back. A thin, unstyled standalone client over the ParseRelay API:
 * bring your own styling (the host carries `data-parserelay-status`, and the
 * button is a plain element you can target).
 *
 * The Angular twin of `<DeadSimpleMicroScanner>` from `@parserelay/scanner`.
 * Uses the synchronous path (no `relay`); for fire-and-forget, call the API
 * with a `relay` config server-side and receive the envelope at your webhook.
 */
@Component({
  selector: "parserelay-scanner",
  standalone: true,
  host: { "[attr.data-parserelay-status]": "status" },
  template: `
    <input
      #fileInput
      type="file"
      accept="image/*"
      [attr.capture]="captureAttr"
      (change)="onFileChange($event)"
      hidden
    />
    <button type="button" [disabled]="busy" (click)="fileInput.click()">{{ label }}</button>
  `,
})
export class DeadSimpleMicroScanner {
  /** API key for the hosted ParseRelay API. Sent as `Authorization: Bearer <apiKey>`. */
  @Input({ required: true }) apiKey!: string;
  /** Override the API base URL (self-host / staging). */
  @Input() baseUrl?: string;
  /** Field-list shorthand passed through as the request `schema`. */
  @Input() fields?: string[];
  /** Full JSON Schema (or field-list) — takes precedence over `fields`. Use for typed/nested extraction. */
  @Input() schema?: ScanSchema;
  /** Optional document-type hint. */
  @Input() docType?: DocType;
  /** Extraction mode. Defaults to "auto". */
  @Input() engine: Engine = "auto";
  /** OCR backend selection (e.g. `{ backend: "glm" }`) or passthrough text. Omit for the server default. */
  @Input() ocr?: OcrConfig;
  /** Pin a specific model (omit for the server default). */
  @Input() model?: string;
  /** Bring-your-own provider key → billed for plumbing only. */
  @Input() modelKey?: string;
  /**
   * Capture hint for the file input. "environment" opens the rear camera on
   * mobile; pass `false` to allow gallery/file selection only.
   */
  @Input() capture: "environment" | "user" | false = "environment";

  /** Emits the parsed envelope once a scan completes. */
  @Output() result = new EventEmitter<ScanEnvelope>();
  /** Convenience: emits the low-confidence field names, to gate UI. */
  @Output() needsReview = new EventEmitter<string[]>();
  /** Emits on a failed scan or transport error. */
  @Output() error = new EventEmitter<Error>();

  protected status: Status = "idle";

  private readonly cdr = inject(ChangeDetectorRef);

  private setStatus(status: Status): void {
    this.status = status;
    // zone.js does NOT track native async/await (Vite/esbuild emit native
    // ES2022), so updates after an `await` won't trigger change detection on
    // their own. Force it so the button reflects reading/scanning/done in every
    // setup — zoned, zoneless, or native-async.
    this.cdr.detectChanges();
  }

  get busy(): boolean {
    return this.status === "reading" || this.status === "scanning";
  }

  get captureAttr(): string | null {
    return this.capture === false ? null : this.capture;
  }

  get label(): string {
    if (this.status === "scanning") return "Scanning…";
    if (this.status === "reading") return "Reading…";
    return "Scan";
  }

  async onFileChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      this.setStatus("reading");
      const image = await fileToDataUri(file);

      this.setStatus("scanning");
      // Fresh client per scan so input changes (key rotation, env toggle) take effect.
      const client = new ParseRelayClient({ apiKey: this.apiKey, baseUrl: this.baseUrl });
      const response = await client.scan({
        image,
        schema: this.schema ?? this.fields,
        doc_type: this.docType,
        engine: this.engine,
        ocr: this.ocr,
        model: this.model,
        model_key: this.modelKey,
      });

      // The component uses the synchronous path, so we always expect an envelope.
      if (!isEnvelope(response)) {
        throw new Error("Unexpected async response; the component expects the sync path.");
      }

      this.setStatus("done");
      this.result.emit(response);
      if (response.needs_review.length > 0) {
        this.needsReview.emit(response.needs_review);
      }
    } catch (err) {
      this.setStatus("error");
      this.error.emit(err instanceof Error ? err : new Error(String(err)));
    } finally {
      // Reset AFTER the read so clearing the input can't cancel an in-flight
      // FileReader (some browsers detach the File when input.value changes),
      // while still letting the same file be re-selected next time.
      input.value = "";
    }
  }
}
