// devBridge/designSeed.ts — sample FLOWS for the browser preview / dev bridge.
//
// The real Electron host seeds prototype files to disk (electron/designHost.ts);
// the browser preview has no file system, so the design queries serve these
// in-memory instead. Each entry is a named user FLOW — Sign in, Register, Sign
// out — and each flow is ONE self-contained index.html you can click through:
// an in-page step navigator (go / data-go / data-show) swaps screens, so the
// Designs preview and the Canvas both let you drive the whole journey inside a
// single document.
//
// Every doc is self-contained (inline CSS/JS, no external URLs), carries a
// <title> (the Studio derives the flow name from it) and data-testid attributes
// on the interactive elements (for the element picker + hands-on testing).

export type DevPrototype = { id: string; path: string; title: string; mtimeMs: number; content: string };

// Shared brand chrome + step navigator, inlined per file (flows are self-contained).
const STYLE = `<style>
:root{--bg:#0B0D0F;--surface:#14171A;--text:#ECEFF2;--mut:#9BA3AC;--accent:#34C28E;--danger:#E5675F;--border:rgba(255,255,255,.08)}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--text);
font-family:ui-sans-serif,system-ui,-apple-system,sans-serif}
.card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:30px;width:min(380px,92vw)}
h1{font-size:22px;margin:0 0 6px}.sub{color:var(--mut);margin:0 0 20px;font-size:13px;line-height:1.55}
.dot{display:inline-block;width:8px;height:8px;border-radius:9999px;background:var(--accent);margin-right:8px;vertical-align:middle}
label{display:block;font-size:12px;color:var(--mut);margin-bottom:12px}
input{display:block;width:100%;margin-top:6px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:8px;padding:11px;font:inherit}
input::placeholder{color:#5E6670}
.accent{width:100%;margin-top:4px;background:var(--accent);color:#06140E;border:0;border-radius:8px;padding:11px;font:inherit;font-weight:600;cursor:pointer}
.ghost{width:100%;margin-top:8px;background:transparent;color:var(--text);border:1px solid var(--border);border-radius:8px;padding:10px;font:inherit;font-weight:600;cursor:pointer}
.danger{width:100%;margin-top:4px;background:var(--danger);color:#1a0b0a;border:0;border-radius:8px;padding:11px;font:inherit;font-weight:600;cursor:pointer}
.alt{text-align:center;margin:14px 0 0;font-size:12px}.alt a{color:var(--accent);text-decoration:none;cursor:pointer}
.row2{display:flex;gap:10px}.row2>label{flex:1}
.banner{display:flex;gap:8px;align-items:flex-start;background:rgba(229,103,95,.14);border:1px solid var(--danger);color:var(--danger);border-radius:8px;padding:9px 11px;font-size:12.5px;line-height:1.4;margin:0 0 16px}
.step[hidden]{display:none}.big{text-align:center;padding:8px 0}
</style>`;

// A tiny in-page router: go(step) shows the one matching section; a single
// delegated listener drives every [data-go] (step) and [data-show] (reveal an
// inline element, e.g. the sign-in error banner) control. Delegation, not inline
// onclick, works reliably inside the sandboxed preview iframe.
const NAV = `<script>
function go(s){document.querySelectorAll('.step').forEach(function(el){el.hidden=el.getAttribute('data-step')!==s})}
document.addEventListener('click',function(e){
var g=e.target.closest('[data-go]');if(g){e.preventDefault();go(g.getAttribute('data-go'));return;}
var s=e.target.closest('[data-show]');if(s){e.preventDefault();var el=document.getElementById(s.getAttribute('data-show'));if(el)el.hidden=false;}
});
</script>`;

// The preview iframe (and the Canvas srcdoc frames) otherwise inherit the app's
// strict `script-src 'self'` CSP, which blocks the flow's inline nav script. An
// own CSP meta lets the self-contained script run while `default-src 'none'`
// still blocks all network — the same sealed-preview trick ArtifactsPanel uses.
const CSP = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:" />`;

const page = (title: string, body: string): string =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
  `<meta name="viewport" content="width=device-width, initial-scale=1" />${CSP}<title>${title}</title>${STYLE}</head>` +
  `<body><main class="card">${body}</main>${NAV}</body></html>`;

// ── Sign in ────────────────────────────────────────────────────────────────
// Sign in fails (error banner), and "Forgot password?" opens a full recovery
// sub-flow: email → verification code → new password → done.
const signIn = page('Sign in', `
  <section class="step" data-step="form">
    <h1><span class="dot"></span>Sign in</h1>
    <p class="sub">Welcome back to BrainRouter.</p>
    <div class="banner" id="signin-error" hidden><span>&#9888;</span><span>Incorrect email or password. Try again, or reset your password.</span></div>
    <label>Email<input data-testid="signin-email" type="email" placeholder="you@team.com" /></label>
    <label>Password<input data-testid="signin-password" type="password" placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;" /></label>
    <button class="accent" data-testid="signin-submit" data-show="signin-error">Sign in</button>
    <p class="alt"><a data-testid="signin-forgot" data-go="fp-email">Forgot password?</a></p>
  </section>
  <section class="step" data-step="fp-email" hidden>
    <h1><span class="dot"></span>Reset password</h1>
    <p class="sub">Enter your email and we'll send a verification code.</p>
    <label>Email<input data-testid="fp-email-input" type="email" placeholder="you@team.com" /></label>
    <button class="accent" data-testid="fp-send" data-go="fp-code">Send code</button>
    <button class="ghost" data-testid="fp-cancel" data-go="form">Back to sign in</button>
  </section>
  <section class="step" data-step="fp-code" hidden>
    <h1><span class="dot"></span>Enter code</h1>
    <p class="sub">We sent a 6-digit code to your email.</p>
    <label>Verification code<input data-testid="fp-code-input" inputmode="numeric" placeholder="123456" /></label>
    <button class="accent" data-testid="fp-verify" data-go="fp-new">Verify</button>
    <p class="alt"><a data-testid="fp-resend" data-go="fp-code">Resend code</a></p>
  </section>
  <section class="step" data-step="fp-new" hidden>
    <h1><span class="dot"></span>New password</h1>
    <p class="sub">Choose a new password for your account.</p>
    <label>New password<input data-testid="fp-new-input" type="password" placeholder="8+ characters" /></label>
    <label>Confirm password<input data-testid="fp-confirm-input" type="password" placeholder="repeat password" /></label>
    <button class="accent" data-testid="fp-update" data-go="fp-done">Update password</button>
  </section>
  <section class="step" data-step="fp-done" hidden>
    <div class="big"><h1><span class="dot"></span>Password updated</h1>
    <p class="sub">You can now sign in with your new password.</p></div>
    <button class="ghost" data-testid="fp-back" data-go="form">Back to sign in</button>
  </section>`);

// ── Register ───────────────────────────────────────────────────────────────
// Create account → date of birth → address → payment (mock — never charged) →
// welcome.
const register = page('Register', `
  <section class="step" data-step="form">
    <h1><span class="dot"></span>Create account</h1>
    <p class="sub">Start your BrainRouter memory instrument.</p>
    <label>Name<input data-testid="register-name" placeholder="Ada Lovelace" /></label>
    <label>Email<input data-testid="register-email" type="email" placeholder="you@team.com" /></label>
    <label>Password<input data-testid="register-password" type="password" placeholder="8+ characters" /></label>
    <button class="accent" data-testid="register-submit" data-go="dob">Create account</button>
  </section>
  <section class="step" data-step="dob" hidden>
    <h1><span class="dot"></span>Date of birth</h1>
    <p class="sub">We use this to personalise your experience.</p>
    <label>Date of birth<input data-testid="register-dob" type="date" /></label>
    <button class="accent" data-testid="register-dob-next" data-go="address">Continue</button>
    <button class="ghost" data-testid="register-dob-back" data-go="form">Back</button>
  </section>
  <section class="step" data-step="address" hidden>
    <h1><span class="dot"></span>Your address</h1>
    <p class="sub">Where should we reach you?</p>
    <label>Street<input data-testid="register-street" placeholder="1 Analytical Ave" /></label>
    <label>City<input data-testid="register-city" placeholder="London" /></label>
    <label>Postcode<input data-testid="register-zip" placeholder="EC1A 1AA" /></label>
    <button class="accent" data-testid="register-address-next" data-go="payment">Continue</button>
    <button class="ghost" data-testid="register-address-back" data-go="dob">Back</button>
  </section>
  <section class="step" data-step="payment" hidden>
    <h1><span class="dot"></span>Payment method</h1>
    <p class="sub">Add a card &mdash; you won't be charged during the trial.</p>
    <label>Card number<input data-testid="register-card" inputmode="numeric" placeholder="1234 5678 9012 3456" /></label>
    <div class="row2">
      <label>Expiry<input data-testid="register-exp" placeholder="MM/YY" /></label>
      <label>CVC<input data-testid="register-cvc" inputmode="numeric" placeholder="123" /></label>
    </div>
    <button class="accent" data-testid="register-pay" data-go="done">Add card &amp; finish</button>
    <button class="ghost" data-testid="register-pay-back" data-go="address">Back</button>
  </section>
  <section class="step" data-step="done" hidden>
    <div class="big"><h1><span class="dot"></span>Welcome aboard</h1>
    <p class="sub">Your account is ready. Recall what you learn from here on.</p></div>
    <button class="ghost" data-testid="register-restart" data-go="form">Start over</button>
  </section>`);

// ── Sign out ───────────────────────────────────────────────────────────────
const signOut = page('Sign out', `
  <section class="step" data-step="confirm">
    <div class="big"><h1><span class="dot"></span>Sign out?</h1>
    <p class="sub">You'll need to sign back in to reach your memory.</p></div>
    <button class="danger" data-testid="signout-confirm" data-go="done">Sign out</button>
    <button class="ghost" data-testid="signout-cancel" data-go="stay">Cancel</button>
  </section>
  <section class="step" data-step="stay" hidden>
    <div class="big"><h1><span class="dot"></span>Still signed in</h1>
    <p class="sub">No changes &mdash; you're right where you left off.</p></div>
    <button class="ghost" data-testid="signout-reopen" data-go="confirm">Sign out instead</button>
  </section>
  <section class="step" data-step="done" hidden>
    <div class="big"><h1><span class="dot"></span>Signed out</h1>
    <p class="sub">See you soon. Your memory is safe until you're back.</p></div>
    <button class="accent" data-testid="signout-back" data-go="confirm">Sign back in</button>
  </section>`);

// Descending mtimeMs (fixed, not Date.now — deterministic across reloads) keeps
// the flow order Sign in → Register → Sign out in the recent-sorted list.
export const DEV_PROTOTYPES: DevPrototype[] = [
  { id: 'flow-sign-in', path: 'flows/sign-in/index.html', title: 'Sign in', mtimeMs: 1_760_000_003_000, content: signIn },
  { id: 'flow-register', path: 'flows/register/index.html', title: 'Register', mtimeMs: 1_760_000_002_000, content: register },
  { id: 'flow-sign-out', path: 'flows/sign-out/index.html', title: 'Sign out', mtimeMs: 1_760_000_001_000, content: signOut },
];
