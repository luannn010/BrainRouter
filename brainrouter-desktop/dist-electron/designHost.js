/**
 * DesignHost — the host-side backend for the Design Studio's prototype canvases.
 * Lists / reads / seeds self-contained prototype HTML under the workspace `proto/`
 * dir, reusing core's `isAuthorizedPrototypePath` so we only ever touch files the
 * sandboxed <webview> is also allowed to load.
 */
import fs from 'node:fs';
import path from 'node:path';
import { isAuthorizedPrototypePath } from '@kinqs/brainrouter-core/dist/prototype/protoDetect.js';
/** Canvas guards — never flood the renderer with a huge or unbounded frame set. */
const MAX_FRAMES = 24;
const MAX_FRAME_BYTES = 512_000;
function titleFrom(html, id) {
    const m = /<title>([^<]+)<\/title>/i.exec(html);
    if (m && m[1].trim())
        return m[1].trim();
    const words = id.replace(/^prototype[-_]?/i, '').replace(/[-_]\d{10,}.*$/, '').replace(/[-_]+/g, ' ').trim();
    return words ? words.replace(/\b\w/g, (c) => c.toUpperCase()) : 'Untitled prototype';
}
const SEED_ID = 'prototype-welcome';
export function createDesignHost(workspaceRoot) {
    const protoDir = path.join(workspaceRoot, 'proto');
    const canvasStateDir = path.join(workspaceRoot, '.brainrouter', 'design');
    const canvasStatePath = path.join(canvasStateDir, 'canvas.json');
    const brandStatePath = path.join(canvasStateDir, 'brand.json');
    const insideWorkspace = (candidate) => {
        const relative = path.relative(workspaceRoot, path.resolve(candidate));
        return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
    };
    const writeAtomic = (filePath, content) => {
        if (!insideWorkspace(filePath))
            throw new Error('canvas state path escaped workspace');
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
        try {
            fs.writeFileSync(temporary, content, 'utf8');
            fs.renameSync(temporary, filePath);
        }
        finally {
            try {
                if (fs.existsSync(temporary))
                    fs.unlinkSync(temporary);
            }
            catch { /* best effort */ }
        }
    };
    const resolveAuthorized = (id) => {
        const rel = `proto/${id}.html`;
        if (!isAuthorizedPrototypePath(rel))
            return null;
        const abs = path.resolve(workspaceRoot, rel);
        const inside = path.relative(workspaceRoot, abs);
        if (inside.startsWith('..') || path.isAbsolute(inside))
            return null;
        if (path.dirname(abs) !== protoDir)
            return null; // flat proto/ only — mirror listPrototypes
        return abs;
    };
    /** One directory walk, newest-first — the single source both list and batch-read use. */
    const scan = () => {
        let names = [];
        try {
            names = fs.readdirSync(protoDir);
        }
        catch {
            return [];
        }
        const frames = [];
        for (const name of names) {
            const rel = `proto/${name}`;
            if (!isAuthorizedPrototypePath(rel))
                continue;
            const abs = path.join(protoDir, name);
            let content = '';
            let mtimeMs = 0;
            try {
                content = fs.readFileSync(abs, 'utf8');
                mtimeMs = fs.statSync(abs).mtimeMs;
            }
            catch {
                continue;
            }
            const id = name.replace(/\.html?$/i, '');
            frames.push({ id, path: rel, title: titleFrom(content, id), mtimeMs, content });
        }
        frames.sort((a, b) => b.mtimeMs - a.mtimeMs);
        return frames;
    };
    /** `<id>-copy`, then `-copy-2`, … — the first that isn't taken on disk. */
    const freeCopyId = (id) => {
        const base = `${id}-copy`;
        for (let n = 1; n <= 50; n += 1) {
            const candidate = n === 1 ? base : `${base}-${n}`;
            const abs = resolveAuthorized(candidate);
            if (!abs)
                return null;
            if (!fs.existsSync(abs))
                return candidate;
        }
        return null;
    };
    return {
        listPrototypes() {
            // Drop `content` — the picker only needs metadata.
            const prototypes = scan().map(({ content: _content, ...entry }) => entry);
            return { prototypes };
        },
        readPrototypes(opts) {
            const limit = Math.max(1, Math.min(opts?.limit ?? MAX_FRAMES, MAX_FRAMES));
            const all = scan();
            const frames = all.slice(0, limit).filter((f) => f.content.length <= MAX_FRAME_BYTES);
            return { frames, truncated: all.length > frames.length };
        },
        readPrototype(id) {
            const abs = resolveAuthorized(id);
            if (!abs)
                return { error: 'not an authorized prototype path' };
            try {
                return { path: `proto/${id}.html`, content: fs.readFileSync(abs, 'utf8') };
            }
            catch (err) {
                return { error: err instanceof Error ? err.message : String(err) };
            }
        },
        readCanvasDocument() {
            if (!insideWorkspace(canvasStatePath))
                return { error: 'canvas state path escaped workspace' };
            try {
                if (!fs.existsSync(canvasStatePath))
                    return {};
                return { document: JSON.parse(fs.readFileSync(canvasStatePath, 'utf8')) };
            }
            catch (err) {
                return { error: err instanceof Error ? err.message : String(err) };
            }
        },
        writeCanvasDocument(document) {
            try {
                writeAtomic(canvasStatePath, `${JSON.stringify(document, null, 2)}\n`);
                return { ok: true };
            }
            catch (err) {
                return { ok: false, error: err instanceof Error ? err.message : String(err) };
            }
        },
        readBrandOverrides() {
            if (!insideWorkspace(brandStatePath))
                return { error: 'brand state path escaped workspace' };
            try {
                if (!fs.existsSync(brandStatePath))
                    return {};
                return { overrides: JSON.parse(fs.readFileSync(brandStatePath, 'utf8')) };
            }
            catch (err) {
                return { error: err instanceof Error ? err.message : String(err) };
            }
        },
        writeBrandOverrides(overrides) {
            try {
                writeAtomic(brandStatePath, `${JSON.stringify(overrides, null, 2)}\n`);
                return { ok: true };
            }
            catch (err) {
                return { ok: false, error: err instanceof Error ? err.message : String(err) };
            }
        },
        ensureSeed() {
            const rel = `proto/${SEED_ID}.html`;
            const abs = path.join(protoDir, `${SEED_ID}.html`);
            try {
                const existing = fs.existsSync(protoDir) ? fs.readdirSync(protoDir).filter((n) => /\.html?$/i.test(n)) : [];
                if (existing.length > 0)
                    return { path: existing.includes(`${SEED_ID}.html`) ? rel : `proto/${existing[0]}`, created: false };
            }
            catch { /* fall through to create */ }
            fs.mkdirSync(protoDir, { recursive: true });
            fs.writeFileSync(abs, SEED_HTML, 'utf8');
            return { path: rel, created: true };
        },
        duplicatePrototype(id) {
            const source = resolveAuthorized(id);
            if (!source)
                return { error: `not an authorized prototype: ${id}` };
            let content = '';
            try {
                content = fs.readFileSync(source, 'utf8');
            }
            catch (err) {
                return { error: err instanceof Error ? err.message : String(err) };
            }
            const copyId = freeCopyId(id);
            if (!copyId)
                return { error: 'could not find a free name for the copy' };
            const target = resolveAuthorized(copyId);
            if (!target)
                return { error: 'could not resolve the copy path' };
            try {
                writeAtomic(target, content);
                return { id: copyId, path: `proto/${copyId}.html` };
            }
            catch (err) {
                return { error: err instanceof Error ? err.message : String(err) };
            }
        },
    };
}
/** A minimal on-brand starter so the Preview/Test canvases are never empty. */
const SEED_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" /><title>Welcome</title>
<style>
:root{--bg:#0B0D0F;--surface:#14171A;--text:#ECEFF2;--mut:#9BA3AC;--accent:#34C28E;--border:rgba(255,255,255,.08)}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);
color:var(--text);font-family:ui-sans-serif,system-ui,sans-serif}
.card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:32px;max-width:420px;text-align:center}
h1{font-size:28px;margin:0 0 8px}p{color:var(--mut);margin:0 0 24px;line-height:1.5}
button{background:var(--accent);color:#06140E;border:0;border-radius:6px;padding:10px 18px;font:inherit;font-weight:600;cursor:pointer}
.dot{display:inline-block;width:8px;height:8px;border-radius:9999px;background:var(--accent);margin-right:6px;vertical-align:middle}
</style></head><body>
<main class="card"><h1><span class="dot"></span>BrainRouter prototype</h1>
<p>Edit me from the UI-fix chat, preview me here, and test me hands-on. Memory Instrument, self-contained.</p>
<button data-testid="primary-cta">Recall</button></main></body></html>`;
