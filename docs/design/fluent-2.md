# Fluent 2 shared workspace

## Basis and dependency decision

Reviewed 2026-09-23 against Microsoft's current Fluent 2 [principles](https://fluent2.microsoft.design/design-principles), [design tokens](https://fluent2.microsoft.design/design-tokens), [color](https://fluent2.microsoft.design/color), [typography](https://fluent2.microsoft.design/typography), [layout](https://fluent2.microsoft.design/layout), [motion](https://fluent2.microsoft.design/motion), [accessibility](https://fluent2.microsoft.design/accessibility), [navigation](https://fluent2.microsoft.design/components/web/react/core/nav/usage), [buttons](https://fluent2.microsoft.design/components/web/react/core/button/usage), [tabs](https://fluent2.microsoft.design/components/web/react/core/tablist/usage), [fields](https://fluent2.microsoft.design/components/web/react/core/field/usage), [dropdowns](https://fluent2.microsoft.design/components/web/react/core/dropdown/usage), [radio groups](https://fluent2.microsoft.design/components/web/react/core/radiogroup/usage), [switches](https://fluent2.microsoft.design/components/web/react/core/switch/usage), and [development guidance](https://fluent2.microsoft.design/get-started/develop).

Use official `@fluentui/web-components` 3.1.3 with Fluent 2 tokens. The existing renderer uses DOM templates, so standards-based Web Components preserve its host-neutral HTTP/IPC architecture without introducing React or a second UI. The pinned development dependency supplies its official prebuilt browser module and tokens; `npm run update:fluent-assets` copies reproducible runtime assets, including the Microsoft MIT license. Assets are checked in for Electron file URLs, Compose and offline PWA; no CDN or new build tool is required. Native select, date/number input, details, semantic tables and links remain appropriate browser primitives where the component library has no equivalent semantics. Do not claim native controls are official Fluent components.

## Audit and redesign

| Dimension | Previous issue | Product design |
| --- | --- | --- |
| Shape | Arbitrary radii, tinted grays, oversized pill surfaces and non-system font stacks | Official light/dark semantic aliases, Segoe UI web type ramp, 4px control corners, 8px surfaces, a 4px spacing base with Fluent nudge tokens, and elevation reserved for overlays |
| Structure | Duplicate page headings, eight destinations in the mobile bottom bar, competing settings columns | Grouped primary navigation; page heading before the shared scope command bar; overview prioritizes activity and quota before breakdowns; settings have their own section navigation |
| Components | Hand-built account menus and single-choice buttons without form semantics | Fluent Button, Tab/Tablist, Dropdown, RadioGroup, Badge, MessageBar and Spinner; links navigate; native HTML select remains for platform-native form behavior |
| Interaction | Incomplete single-choice semantics, unclear motion labels, and a system reduced-motion preference that could not be overridden | RadioGroup for one-of-many filters; Dropdown for provider choice; explicit selected, disabled, busy, error and focus states; motion preference labels describe the actual behavior |
| Motion | Isolated hover transitions and no coherent reduced-motion override | Fluent duration/easing tokens for page navigation, overlays, disclosures, and refresh feedback; stream snapshots do not replay entry; system reduction is honored unless the user explicitly allows motion |
| Adaptation | Crowded mobile navigation, desktop override conflicts, and oversized Android shapes | Persistent desktop navigation and modal mobile navigation; 44px web touch targets, forced colors, system/light/dark, reduced motion, keyboard and screen reader support; Android keeps native Compose semantics with shared Fluent colors, shapes and type hierarchy |

## Platform mapping

Electron, Compose Hub and the PWA use the same shared renderer, Fluent Web Components and checked-in tokens. The native Android client keeps Compose Material 3 controls because they provide Android navigation, input, accessibility and touch conventions; its default blue palette, neutral surfaces, 4dp spacing aliases and shared shape/type scales follow Fluent tokens. Android's system theme seed continues to follow wallpaper colors when the user chooses System, as a platform-native adaptation.

## Preserved contracts

All eight destinations, legacy route aliases, tool/model/project/session breakdowns, history scope and completeness, quota health and account operations, subscriptions/pricing, desktop collection/export/appearance/device/sync/advanced configuration remain reachable. Data shapes, permission checks, credentials, transport and collector cadence are unchanged. UI charts are domain-specific components; statuses retain textual labels and numeric values.

## Acceptance

Run `npm run verify`, then exercise the real shared renderer in a browser with fixture API responses and the desktop shell with its IPC adapter. Cover five locales, desktop/mobile widths, light/dark, forced colors, reduced motion, navigation, tab keyboard interaction, form submit, account editor, loading/error/empty/populated states and host asset reachability. Browser fixtures prove rendering and interactions, not live provider credentials or production synchronization. Record actual results separately.
