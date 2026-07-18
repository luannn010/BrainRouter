import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { DEV_PROTOTYPES } from './src/devBridge/designSeed.js';

/**
 * Dev-only prototype server. The Designs preview normally loads a prototype in an
 * Electron <webview> (file://); the browser preview has no webview, so it falls
 * back to an <iframe>. A srcdoc iframe inherits the app's strict `script-src
 * 'self'` CSP and can't run a flow's inline nav script — but a same-origin SERVED
 * document does not inherit it, so its own `default-src 'none'; script-src
 * 'unsafe-inline'` meta governs: the flow is interactive, network still sealed.
 * Serve-only: the packaged app never uses this.
 */
// Claude-style element picker, injected into every served flow. Idle until the
// parent posts {__brpPick:'on'}: then hovering draws a green highlight + a
// `tag WxH · testid` label, a click posts {__brpPicked:{…}} back and turns off,
// Esc cancels. Capture-phase + `on` gate so it never interferes with the flow's
// own navigation when idle. Inline-script-safe (served doc allows unsafe-inline).
const PICKER = `
<style id="__brp-pick-style">
#__brp-hl{position:fixed;pointer-events:none;z-index:2147483646;border:2px solid #34C28E;background:rgba(52,194,142,.14);border-radius:4px;box-shadow:0 0 0 1px rgba(52,194,142,.4);display:none}
#__brp-tip{position:fixed;pointer-events:none;z-index:2147483647;background:#0B0D0F;color:#ECEFF2;border:1px solid rgba(255,255,255,.16);border-radius:6px;padding:4px 8px;font:12px ui-monospace,SFMono-Regular,Consolas,monospace;display:none;white-space:nowrap;box-shadow:0 6px 20px rgba(0,0,0,.55)}
#__brp-tip b{color:#7C8BFF;font-weight:600}#__brp-tip i{color:#34C28E;font-style:normal}
body.__brp-picking,body.__brp-picking *{cursor:crosshair !important}
</style>
<script id="__brp-pick">(function(){
var hl,tip,on=false;
function tid(el){while(el&&el.nodeType===1&&el!==document.body){var t=el.getAttribute&&el.getAttribute('data-testid');if(t)return t;el=el.parentElement;}return null;}
function ensure(){if(hl)return;hl=document.createElement('div');hl.id='__brp-hl';tip=document.createElement('div');tip.id='__brp-tip';document.documentElement.appendChild(hl);document.documentElement.appendChild(tip);}
function move(e){if(!on)return;var el=e.target;if(!el||el===hl||el===tip||el.nodeType!==1)return;var r=el.getBoundingClientRect();hl.style.display='block';hl.style.left=r.left+'px';hl.style.top=r.top+'px';hl.style.width=r.width+'px';hl.style.height=r.height+'px';var tag=(el.tagName||'node').toLowerCase();var t=tid(el);tip.style.display='block';tip.innerHTML='<b>'+tag+'</b> '+Math.round(r.width)+'\\u00d7'+Math.round(r.height)+(t?' \\u00b7 <i>'+t+'</i>':'');var top=r.top-26;tip.style.left=Math.max(4,r.left)+'px';tip.style.top=(top<4?r.bottom+6:top)+'px';}
function pick(e){if(!on)return;e.preventDefault();e.stopPropagation();var el=e.target;var tag=(el.tagName||'node').toLowerCase();var t=tid(el);var r=el.getBoundingClientRect();parent.postMessage({__brpPicked:{testid:t,tag:tag,label:t?'[data-testid="'+t+'"]':tag,w:Math.round(r.width),h:Math.round(r.height)}},'*');off();}
function key(e){if(on&&e.key==='Escape'){off();parent.postMessage({__brpPicked:null},'*');}}
function enable(){ensure();on=true;if(document.body)document.body.classList.add('__brp-picking');}
function off(){on=false;if(hl)hl.style.display='none';if(tip)tip.style.display='none';if(document.body)document.body.classList.remove('__brp-picking');}
document.addEventListener('mousemove',move,true);
document.addEventListener('click',pick,true);
document.addEventListener('keydown',key,true);
function resolve(ref){var t=/data-testid="([^"]+)"/.exec(ref);if(t)return document.querySelector('[data-testid="'+t[1].replace(/"/g,'\\"')+'"]');var p=/^([a-z][\\w-]*):(\\d+)$/.exec(ref);if(p)return document.querySelectorAll(p[1])[Number(p[2])]||null;return null;}
function measure(ref,props){var el=resolve(ref);if(!el)return null;var r=el.getBoundingClientRect();var par=el.offsetParent||document.documentElement;var pr=par.getBoundingClientRect();var cs=getComputedStyle(el);var styles={};for(var i=0;i<props.length;i++)styles[props[i]]=cs.getPropertyValue(props[i]);
return {ref:ref,box:{x:r.left,y:r.top,width:r.width,height:r.height,offsetLeft:r.left-pr.left,offsetTop:r.top-pr.top,offsetRight:pr.right-r.right,offsetBottom:pr.bottom-r.bottom},position:cs.position,parentDisplay:getComputedStyle(par).display,contentHeight:el.scrollHeight,styles:styles};}
function apply(ops){for(var i=0;i<ops.length;i++){var op=ops[i];var el=resolve(op.ref);if(!el)continue;if(op.text!==null&&op.text!==undefined)el.textContent=op.text;for(var d=0;d<op.declarations.length;d++)el.style.setProperty(op.declarations[d][0],op.declarations[d][1]);}}
window.addEventListener('message',function(e){var d=e.data||{};if(d.__brpPick==='on')enable();else if(d.__brpPick==='off')off();else if(d.__brpMeasure)parent.postMessage({__brpMeasured:{id:d.__brpMeasure.id,value:measure(d.__brpMeasure.ref,d.__brpMeasure.props||[])}},'*');else if(d.__brpApply)apply(d.__brpApply.ops||[]);});
})();</script>`;

function prototypeProxy(): Plugin {
  return {
    name: 'brp-prototype-proxy',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__brp/proto', (req, res) => {
        const q = (req.originalUrl ?? req.url ?? '').split('?')[1] ?? '';
        const id = new URLSearchParams(q).get('id') ?? '';
        const proto = DEV_PROTOTYPES.find((p) => p.id === id || p.path === id);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.statusCode = proto ? 200 : 404;
        const body = proto
          ? (proto.content.includes('</body>') ? proto.content.replace('</body>', `${PICKER}</body>`) : proto.content + PICKER)
          : '<!doctype html><meta charset="utf-8"><title>Flow not found</title>';
        res.end(body);
      });
    },
  };
}

/**
 * Dev-only model-probe proxy. The browser preview can't fetch a provider's
 * `/models` directly — it's cross-origin and most LLM gateways send NO CORS
 * headers (ZenMux, OpenAI, …), so the browser blocks it. This middleware runs in
 * the vite Node server (no CORS) and performs the fetch on the browser's behalf,
 * exactly like the Electron app does host-side. devBridge POSTs
 * `{ endpoint, apiKey, apiVersion }` here and gets `{ models, error? }` back.
 * Serve-only: the packaged Electron app never uses this (it has its own host).
 */
function modelProbeProxy(): Plugin {
  return {
    name: 'brp-model-probe-proxy',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__brp/models', (req, res) => {
        const send = (obj: unknown, code = 200): void => {
          res.statusCode = code;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(obj));
        };
        if (req.method !== 'POST') { send({ models: [], error: 'method' }, 405); return; }
        let raw = '';
        req.on('data', (c) => { raw += c; });
        req.on('end', async () => {
          let endpoint = '', apiKey = '', apiVersion = '';
          try { ({ endpoint = '', apiKey = '', apiVersion = '' } = JSON.parse(raw || '{}')); } catch { /* empty */ }
          const ep = String(endpoint).trim();
          if (!ep) { send({ models: [], error: 'no-endpoint' }); return; }
          const base = ep.replace(/\/chat\/completions\/?$/, '').replace(/\/$/, '') + '/models';
          const av = String(apiVersion).trim();
          const url = av ? base + (base.includes('?') ? '&' : '?') + 'api-version=' + encodeURIComponent(av) : base;
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 12_000);
          try {
            const r = await fetch(url, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${String(apiKey).trim() || 'local'}` }, signal: ctrl.signal });
            if (!r.ok) { send({ models: [], error: `http-${r.status}` }); return; }
            const body = await r.json().catch(() => ({})) as { data?: Array<{ id?: unknown }> };
            const ids = [...new Set((Array.isArray(body.data) ? body.data : []).map((x) => (x && typeof x.id === 'string') ? x.id : '').filter(Boolean))].sort();
            send({ models: ids });
          } catch {
            send({ models: [], error: 'unreachable' });
          } finally {
            clearTimeout(timer);
          }
        });
      });
    },
  };
}

// Renderer build — plain SPA served from dist/ inside the packaged app.
export default defineConfig({
  plugins: [react(), modelProbeProxy(), prototypeProxy()],
  base: './',
  build: { outDir: 'dist' },
  // Honour the port the preview harness assigns via PORT (Vite ignores it by
  // default); fall back to Vite's usual 5173 for a plain `npm run dev`.
  server: { port: Number(process.env.PORT) || 5173 },
  // Monaco ships its language services as web workers. Emit them as same-origin
  // ES-module chunks (via the `?worker` imports in src/lib/editor/monacoEnv.ts)
  // so they load under the packaged file:// CSP — never the blocked blob/CDN worker.
  worker: { format: 'es' },
  optimizeDeps: { include: ['monaco-editor'] },
});
