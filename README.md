# @parserelay/angular

The Angular twin of `@parserelay/scanner`: a dead-simple, unstyled
standalone component that captures or uploads an image, scans it through the
ParseRelay API, and hands you back structured, confidence-scored fields.

```ts
import { Component } from "@angular/core";
import { DeadSimpleMicroScanner, type ScanEnvelope } from "@parserelay/angular";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [DeadSimpleMicroScanner],
  template: `
    <parserelay-scanner
      [apiKey]="apiKey"
      [fields]="['merchant', 'total', 'date']"
      docType="receipt"
      (result)="onResult($event)"
      (needsReview)="flagged = $event"
      (error)="onError($event)"
    />
  `,
})
export class AppComponent {
  apiKey = "pk_...";
  flagged: string[] = [];
  onResult(envelope: ScanEnvelope) {
    console.log(envelope.fields, envelope.confidence);
  }
  onError(err: Error) {
    console.error(err);
  }
}
```

## Inputs

| Input      | Type                                  | Default         | Notes                                            |
| ---------- | ------------------------------------- | --------------- | ------------------------------------------------ |
| `apiKey`   | `string` (required)                   | —               | Sent as `Authorization: Bearer <apiKey>`.        |
| `baseUrl`  | `string`                              | hosted API      | Point at a self-host / staging deployment.       |
| `fields`   | `string[]`                            | —               | Field-list shorthand → request `schema`.         |
| `docType`  | `DocType`                             | —               | `receipt` \| `invoice` \| `id` \| …              |
| `engine`   | `Engine`                              | `"auto"`        | `auto` \| `ocr` \| `ocr+rescue` \| `vision` …    |
| `model`    | `string`                              | server default  | Pin a specific model.                            |
| `modelKey` | `string`                              | —               | Bring your own key → billed for plumbing only.   |
| `capture`  | `"environment" \| "user" \| false`    | `"environment"` | Rear camera on mobile; `false` for gallery only. |

## Outputs

| Output        | Payload         | Fires when                                  |
| ------------- | --------------- | ------------------------------------------- |
| `result`      | `ScanEnvelope`  | A scan completes.                           |
| `needsReview` | `string[]`      | The envelope has low-confidence fields.     |
| `error`       | `Error`         | The scan fails (transport or API error).    |

## Styling

The component is unstyled. The host element carries `data-parserelay-status`
(`idle` \| `reading` \| `scanning` \| `done` \| `error`) and the trigger is a
plain `<button>`, so target them from your own stylesheet.

## Notes

- **Synchronous path only.** The component returns the envelope inline. For
  fire-and-forget delivery, call the API with a `relay` config server-side and
  receive the envelope at your webhook.
- **v0 packaging.** Ships TypeScript source compiled by your Angular toolchain
  (peer `@angular/core` / `@angular/common` `>=17`). An `ng-packagr` build for
  standalone npm consumption is a follow-up; today it's consumed from source.
