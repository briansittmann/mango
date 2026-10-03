## MODIFIED Requirements

### Requirement: Closing step stores a WhatsApp request and sends nothing
The last step SHALL explain in one or two lines that loading by WhatsApp is optional, and SHALL show a chat preview of what will happen: the message `vincular <código>` with the account's real code as the person's bubble and "✅ Listo, este chat ya está vinculado a tu cuenta." as Mango's. Reaching the step SHALL create the account's linking code (reusing a live one) as `whatsapp-linking` describes; no WhatsApp message SHALL be sent by the web.

The primary action SHALL be "Vincular WhatsApp": it opens the chat with the message written (`whatsapp-linking` → *"Vincular WhatsApp" opens the chat with the message written*) and SHALL NOT complete the onboarding by itself. After it is activated the step SHALL show the waiting state and the primary action SHALL become "Ir a mi mes", which completes the onboarding; when the page re-reads the account and finds the channel, the step SHALL show "Vinculado" with the number before the person leaves. "Seguir sin WhatsApp" SHALL complete the onboarding at any moment, keeping whatever code or number the account holds. When no number is configured, the step SHALL show the code with the line to send it by hand, and "Ir a mi mes" SHALL be the primary action from the start.

Under the preview, a collapsed line "Dejar mi número" SHALL open the phone field (`whatsapp-linking` → *The typed number is optional…*) with its explanation; "Guardar número" SHALL store it and stay on the step. A refused number SHALL keep the step with its message. Completing the onboarding, by either action, SHALL mark the account as onboarded and lead to `/dashboard`, which from then on SHALL render instead of redirecting.

#### Scenario: Link then leave
- **WHEN** the person activates "Vincular WhatsApp", the chat opens with "vincular K7M2PX", and they come back and activate "Ir a mi mes"
- **THEN** the onboarding is complete, the account holds the code `K7M2PX`, no channel exists yet, and `/dashboard` renders

#### Scenario: Linked before leaving
- **WHEN** the person sends the message from WhatsApp, the bot replies "Listo", and the tab regains focus
- **THEN** the step reads "Vinculado" with the linked number, and "Ir a mi mes" leads to `/dashboard`

#### Scenario: Continue without WhatsApp
- **WHEN** the person activates "Seguir sin WhatsApp"
- **THEN** the onboarding is complete, no channel exists, and `/dashboard` renders

#### Scenario: Optional number
- **WHEN** the person opens "Dejar mi número", chooses Argentina, types "11 5555 1234" and activates "Guardar número"
- **THEN** the account's phone is `+5491155551234`, the step stays, and the code is unchanged

#### Scenario: Phone taken
- **WHEN** another account already holds the typed number
- **THEN** a message says the number belongs to another account, the step stays, and the onboarding is not complete

#### Scenario: Malformed phone
- **WHEN** the person types "abc" as the phone
- **THEN** "Guardar número" stays disabled and nothing is stored

#### Scenario: No number configured
- **WHEN** the deployment has no WhatsApp number
- **THEN** the step shows the code and the line to send it by hand, the primary action reads "Ir a mi mes", and "Seguir sin WhatsApp" is not shown

### Requirement: Motion of the onboarding
Without the reduced-motion request:
- the welcome SHALL enter once: the logo with a pop, the title from below, the three lines one after another at 50 ms intervals, and "Empezar" last, all within 700 ms and none of it blocking "Empezar"
- changing step SHALL move the outgoing content out in the direction of travel and the incoming content in from the opposite side, each by a small offset with a fade, both finishing within 300 ms; going back SHALL mirror going forward; the theme control, the progress line, the primary action's place and, from budgets to savings target, the free margin SHALL NOT move or re-enter
- the progress line SHALL grow to its new length over successive frames
- on the budgets step the free margin SHALL reach a new value over successive frames with a critically damped spring, retargeting from wherever it is when a key is pressed mid-motion, and the envelope segments SHALL resize over successive frames using transforms only
- a row added to a list SHALL fade in from a few pixels below; a suggestion taken SHALL fade out; no row and no field SHALL carry any other animation
- on the closing step the two chat bubbles SHALL enter one after another, each from a few pixels below with a fade, Mango's after a short pause, once; the state line SHALL change by cross-fade, and "Vinculado" SHALL enter with a pop of its check; the waiting state SHALL carry no indefinite animation
- every button SHALL shrink slightly while pressed and return on release

With the reduced-motion request: the welcome SHALL appear in place; a step change SHALL cross-fade with no horizontal movement; the progress line, the envelope segments and the free margin SHALL take their new value at once; rows and the chat bubbles SHALL appear in place; the theme change SHALL be immediate. Every state change SHALL still happen.

In both settings no element SHALL animate indefinitely once the pending-action spinner is gone, and the material of the theme control SHALL NOT be stacked on another translucent surface.

#### Scenario: Step change moves
- **WHEN** motion is not reduced and the person continues from the welcome
- **THEN** the incoming step's content changes horizontal position over successive frames before settling, its opacity rises, and the theme control's position is the same before and after

#### Scenario: Step change under reduced motion
- **WHEN** reduced motion is emulated and the person continues from the welcome
- **THEN** in the first frame after the change the basics step is at its resting position with no horizontal transform, and it reaches full opacity by fading

#### Scenario: The margin rolls
- **WHEN** motion is not reduced and the person types a budget on the budgets step
- **THEN** the free margin's text changes over successive frames before reading its final value, and typing again before it settles starts the new motion from the current value

#### Scenario: The margin under reduced motion
- **WHEN** reduced motion is emulated and the person types a budget
- **THEN** the free margin reads its final value in the first frame after the keystroke

#### Scenario: The chat preview enters
- **WHEN** motion is not reduced and the closing step is shown
- **THEN** the person's bubble reaches its place before Mango's starts, both have settled within one second, and two seconds later no running animation on the page has an infinite iteration count

#### Scenario: Nothing endless
- **WHEN** the budgets step has been idle for two seconds
- **THEN** no running animation on the page has an infinite iteration count
