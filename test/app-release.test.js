'use strict';

/**
 * RobustTailor updater API tests (node:test, no database required).
 *
 * The data layer (database/model) is replaced with an in-memory stub before
 * the Express app is loaded, uploads go to a temporary RELEASES_DIR and the
 * app listens on a random port so the real HTTP stack (multer, passport,
 * sendFile) is exercised.
 *
 *   npm test
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const releasesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rt-releases-'));
process.env.NODE_ENV = 'test';
process.env.RELEASES_DIR = releasesDir;
process.env.PUBLIC_BASE_URL = 'https://link.kingmakertech.io';
process.env.APP_RELEASE_MAX_FILE_SIZE_MB = '5';

/* ---------- in-memory data layer ---------- */

const store = {
    nextId: 1,
    releases: [],
    users: {
        1: { id: 1, email: 'admin@test.local', role: 'admin', blocked: 1 },
        2: { id: 2, email: 'user@test.local', role: 'user', blocked: 1 },
    },
};

const fakeModel = {
    getUserById: async (id) => store.users[id] || null,
    isEmailAllowed: async () => true,
    createHistoryLog: async () => {},
    getAppReleases: async () => [...store.releases],
    getPublishedAppReleases: async (target, arch) =>
        store.releases.filter((r) => r.target === target && r.arch === arch && r.published),
    getAppReleaseById: async (id) => store.releases.find((r) => r.id === Number(id)),
    getAppReleaseByVersion: async (target, arch, version) =>
        store.releases.find((r) => r.target === target && r.arch === arch && r.version === version),
    createAppRelease: async (data) => {
        const now = new Date();
        const row = {
            id: store.nextId++,
            version: data.version,
            notes: data.notes,
            pub_date: data.pubDate,
            target: data.target,
            arch: data.arch,
            file_name: data.fileName,
            signature: data.signature,
            sha256: data.sha256,
            size: String(data.size), // pg returns BIGINT as string
            published: data.published,
            created_at: now,
            updated_at: now,
        };
        store.releases.push(row);
        return row;
    },
    updateAppRelease: async (id, { published, notes }) => {
        const row = store.releases.find((r) => r.id === Number(id));
        Object.assign(row, { published, notes, updated_at: new Date() });
        return row;
    },
    deleteAppRelease: async (id) => {
        const index = store.releases.findIndex((r) => r.id === Number(id));
        return index === -1 ? undefined : store.releases.splice(index, 1)[0];
    },
};

const modelPath = require.resolve('../database/model');
require.cache[modelPath] = { id: modelPath, filename: modelPath, loaded: true, exports: fakeModel };

const { createApp } = require('../app');
const { signAdminToken, signUserToken } = require('../config/auth');
const { _internal } = require('../controllers/app-release.controller');

/* ---------- fixtures ---------- */

const SIGNATURE =
    'untrusted comment: signature from tauri secret key\n' +
    'RUQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=\n' +
    'trusted comment: timestamp:1730540000\tfile:RobustTailor_2.1.0_x64-setup.exe\n' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==\n';

const ONE_MB = 1024 * 1024;
const adminToken = signAdminToken(store.users[1]);
const nonAdminToken = signAdminToken(store.users[2]);
const clientToken = signUserToken(store.users[2]);

let server;
let base;

const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

const checkUpdate = (version, target = 'windows', arch = 'x86_64') =>
    fetch(`${base}/api/app/update/${target}/${arch}/${version}`, {
        headers: { Accept: 'application/json', 'User-Agent': 'tauri-plugin-updater/2.9.0' },
    });

/**
 * Publish a release through the real multipart endpoint.
 * Pass `null` for installer / signature to omit them.
 */
async function upload({
    version,
    notes,
    pub_date,
    target,
    arch,
    published,
    installerName,
    installerBytes = ONE_MB + 16,
    installer = crypto.randomBytes(installerBytes),
    signature = SIGNATURE,
    signatureAsFile = false,
    token = adminToken,
} = {}) {
    const form = new FormData();
    if (version !== undefined) form.append('version', version);
    if (notes !== undefined) form.append('notes', notes);
    if (pub_date !== undefined) form.append('pub_date', pub_date);
    if (target !== undefined) form.append('target', target);
    if (arch !== undefined) form.append('arch', arch);
    if (published !== undefined) form.append('published', String(published));
    if (installer !== null) {
        form.append('installer', new Blob([installer]), installerName || `RobustTailor_${version}_x64-setup.exe`);
    }
    if (signature !== null) {
        if (signatureAsFile) {
            form.append('signature', new Blob([signature]), `RobustTailor_${version}_x64-setup.exe.sig`);
        } else {
            form.append('signature', signature);
        }
    }

    const response = await fetch(`${base}/api/admin/app/releases`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
    });
    // passport answers 401 with a plain-text body; everything else is JSON
    const isJson = (response.headers.get('content-type') || '').includes('application/json');
    const body = isJson ? await response.json() : await response.text();
    return { status: response.status, body, installer };
}

const patch = (id, body, token = adminToken) =>
    fetch(`${base}/api/admin/app/releases/${id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

const remove = (id, token = adminToken) =>
    fetch(`${base}/api/admin/app/releases/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });

/** Only final installers may remain on disk; temp files must always be cleaned up. */
const filesOnDisk = () => fs.readdirSync(releasesDir).sort();

test.before(async () => {
    server = http.createServer(createApp());
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(releasesDir, { recursive: true, force: true });
});

/* ---------- pure helpers ---------- */

test('parseCurrentVersion tolerates a leading v and strips build metadata', () => {
    const { parseCurrentVersion } = _internal;
    assert.equal(parseCurrentVersion('2.0.0'), '2.0.0');
    assert.equal(parseCurrentVersion('v2.0.0'), '2.0.0');
    assert.equal(parseCurrentVersion('2.0.0+build.7'), '2.0.0');
    assert.equal(parseCurrentVersion('2.1.0-beta.1+sha.abc'), '2.1.0-beta.1');
    assert.equal(parseCurrentVersion('2.0'), null);
    assert.equal(parseCurrentVersion('latest'), null);
    assert.equal(parseCurrentVersion(''), null);
});

test('pickUpdate follows semver, ignores unpublished rows and prefers the newest', () => {
    const { pickUpdate } = _internal;
    const row = (version, published = true) => ({ version, published });
    const releases = [row('2.0.5'), row('2.1.0-beta.1'), row('2.1.0'), row('3.0.0', false), row('2.2.0-rc.1')];

    assert.equal(pickUpdate(releases, '2.0.0').version, '2.2.0-rc.1');
    assert.equal(pickUpdate(releases, '2.1.0').version, '2.2.0-rc.1');
    assert.equal(pickUpdate(releases, '2.2.0-rc.1'), null);
    assert.equal(pickUpdate(releases, '2.2.0'), null);
    // prerelease ordering: 2.1.0-beta.1 < 2.1.0 and 2.1.0-beta.1 > 2.0.0
    assert.equal(pickUpdate([row('2.1.0-beta.1')], '2.0.0').version, '2.1.0-beta.1');
    assert.equal(pickUpdate([row('2.1.0-beta.1')], '2.1.0'), null);
    assert.equal(pickUpdate([row('2.1.0')], '2.1.0-beta.1').version, '2.1.0');
});

test('formatPubDate emits a full RFC 3339 timestamp or nothing', () => {
    const { formatPubDate, RFC3339_PATTERN } = _internal;
    assert.equal(formatPubDate(new Date('2026-11-02T09:30:00Z')), '2026-11-02T09:30:00Z');
    assert.equal(formatPubDate(new Date('2026-11-02T11:30:00+02:00')), '2026-11-02T09:30:00Z');
    assert.equal(formatPubDate(null), null);
    assert.equal(formatPubDate('not a date'), null);
    assert.ok(RFC3339_PATTERN.test('2026-11-02T09:30:00Z'));
    assert.ok(RFC3339_PATTERN.test('2026-11-02T09:30:00.123+05:00'));
    assert.ok(!RFC3339_PATTERN.test('2026-11-02'));
    assert.ok(!RFC3339_PATTERN.test('2026-11-02T09:30:00'));
});

/* ---------- public endpoint, empty catalogue ---------- */

test('204 when no release exists', async () => {
    const response = await checkUpdate('2.0.0');
    assert.equal(response.status, 204);
    assert.equal(await response.text(), '');
});

test('400 { error: "invalid version" } for an unparsable current version', async () => {
    for (const bad of ['2.0', 'latest', '2.0.0.1']) {
        const response = await checkUpdate(bad);
        assert.equal(response.status, 400, bad);
        assert.deepEqual(await response.json(), { error: 'invalid version' });
    }
});

test('204 for an unknown target or arch', async () => {
    assert.equal((await checkUpdate('1.0.0', 'linux', 'x86_64')).status, 204);
    assert.equal((await checkUpdate('1.0.0', 'windows', 'i686')).status, 204);
});

/* ---------- admin upload ---------- */

test('admin upload rejects anonymous and non-admin callers before touching the disk', async () => {
    assert.equal((await upload({ version: '2.1.0', token: null })).status, 401);
    assert.equal((await upload({ version: '2.1.0', token: nonAdminToken })).status, 401);
    assert.equal((await upload({ version: '2.1.0', token: clientToken })).status, 401);
    assert.deepEqual(filesOnDisk(), []);
});

test('admin upload validation errors (and no files are left behind)', async () => {
    const cases = [
        [{ version: undefined }, /semver/i],
        [{ version: 'two' }, /semver/i],
        [{ version: '2.1.0', installerName: 'setup.exe' }, /RobustTailor_2.1.0_x64-setup.exe/],
        [{ version: '2.1.0', installerName: 'RobustTailor_2.1.1_x64-setup.exe' }, /RobustTailor_2.1.0_x64-setup.exe/],
        [{ version: '2.1.0', installerBytes: ONE_MB - 1 }, /too small/i],
        [{ version: '2.1.0', installer: null }, /installer/i],
        [{ version: '2.1.0', signature: null }, /signature/i],
        [{ version: '2.1.0', signature: 'RUQAAAA not a sig' }, /untrusted comment:/],
        [{ version: '2.1.0', pub_date: '2026-11-02' }, /RFC 3339/],
        [{ version: '2.1.0', pub_date: '2026-11-02T09:30:00' }, /RFC 3339/],
        [{ version: '2.1.0', notes: 'x'.repeat(4001) }, /4000/],
        [{ version: '2.1.0', target: 'linux' }, /unsupported/i],
    ];

    for (const [options, pattern] of cases) {
        const { status, body } = await upload(options);
        assert.equal(status, 400, JSON.stringify(options));
        assert.match(body.error, pattern, JSON.stringify(options));
    }
    assert.deepEqual(filesOnDisk(), []);
});

test('admin upload stores the release and returns the record without the signature', async () => {
    const { status, body, installer } = await upload({
        version: '2.1.0',
        notes: '## Changes\n- Faster PDF export\n- Fixed bold runs',
        pub_date: '2026-11-02T09:30:00Z',
    });

    assert.equal(status, 201);
    const release = body.release;
    assert.equal(release.version, '2.1.0');
    assert.equal(release.notes, '## Changes\n- Faster PDF export\n- Fixed bold runs');
    assert.equal(release.pub_date, '2026-11-02T09:30:00Z');
    assert.equal(release.target, 'windows');
    assert.equal(release.arch, 'x86_64');
    assert.equal(release.url, 'https://link.kingmakertech.io/releases/RobustTailor_2.1.0_x64-setup.exe');
    assert.equal(release.sha256, sha256(installer));
    assert.equal(release.size, installer.length);
    assert.equal(release.published, true);
    assert.ok(release.id && release.created_at);
    assert.equal('signature' in release, false);
    assert.deepEqual(filesOnDisk(), ['RobustTailor_2.1.0_x64-setup.exe']);
});

test('duplicate version is rejected with 409', async () => {
    const { status, body } = await upload({ version: '2.1.0' });
    assert.equal(status, 409);
    assert.match(body.error, /already exists/);
    assert.deepEqual(filesOnDisk(), ['RobustTailor_2.1.0_x64-setup.exe']);
});

/* ---------- public endpoint, with releases ---------- */

test('200 + exact manifest shape for a newer release', async () => {
    const response = await checkUpdate('2.0.0');
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /^application\/json/);
    assert.equal(response.headers.get('cache-control'), 'no-cache');

    const manifest = await response.json();
    assert.deepEqual(manifest, {
        version: '2.1.0',
        notes: '## Changes\n- Faster PDF export\n- Fixed bold runs',
        pub_date: '2026-11-02T09:30:00Z',
        platforms: {
            'windows-x86_64': {
                signature: SIGNATURE,
                url: 'https://link.kingmakertech.io/releases/RobustTailor_2.1.0_x64-setup.exe',
            },
        },
    });
});

test('204 when only equal or older releases exist', async () => {
    assert.equal((await checkUpdate('2.1.0')).status, 204);
    assert.equal((await checkUpdate('v2.1.0')).status, 204);
    assert.equal((await checkUpdate('2.1.0%2Bbuild.3')).status, 204);
    assert.equal((await checkUpdate('9.9.9')).status, 204);
});

test('the newest release wins when several are newer, with semver prerelease ordering', async () => {
    assert.equal((await upload({ version: '2.0.5' })).status, 201);
    assert.equal((await upload({ version: '2.2.0-beta.1', signatureAsFile: true })).status, 201);

    let manifest = await (await checkUpdate('2.0.0')).json();
    assert.equal(manifest.version, '2.2.0-beta.1');
    assert.equal(manifest.platforms['windows-x86_64'].signature, SIGNATURE, 'signature uploaded as a file is kept verbatim');
    assert.equal('pub_date' in manifest, false, 'pub_date is omitted when not provided');

    assert.equal((await upload({ version: '2.2.0' })).status, 201);
    manifest = await (await checkUpdate('2.0.0')).json();
    assert.equal(manifest.version, '2.2.0');

    // 2.2.0-beta.1 < 2.2.0, so a beta user is offered the final build
    manifest = await (await checkUpdate('2.2.0-beta.1')).json();
    assert.equal(manifest.version, '2.2.0');
    assert.equal((await checkUpdate('2.2.0')).status, 204);
});

test('unpublished releases are ignored by the public endpoint', async () => {
    const list = await (await fetch(`${base}/api/admin/app/releases`, { headers: { Authorization: `Bearer ${adminToken}` } })).json();
    assert.deepEqual(list.releases.map((r) => r.version), ['2.2.0', '2.2.0-beta.1', '2.1.0', '2.0.5'], 'newest first');
    const latest = list.releases[0];
    const beta = list.releases[1];

    assert.equal((await patch(latest.id, { published: false })).status, 200);
    assert.equal((await (await checkUpdate('2.0.0')).json()).version, '2.2.0-beta.1');

    assert.equal((await patch(beta.id, { published: false, notes: 'beta notes' })).status, 200);
    assert.equal((await (await checkUpdate('2.0.0')).json()).version, '2.1.0');

    const republished = await (await patch(latest.id, { published: true })).json();
    assert.equal(republished.release.published, true);
    assert.equal((await (await checkUpdate('2.0.0')).json()).version, '2.2.0');
});

test('PATCH validates its body', async () => {
    const { id } = store.releases[0];
    assert.equal((await patch(id, { published: 'yes' })).status, 400);
    assert.equal((await patch(id, {})).status, 400);
    assert.equal((await patch(999, { published: false })).status, 404);
    assert.equal((await patch(id, { notes: 'x' }, nonAdminToken)).status, 401);
});

/* ---------- artifact hosting ---------- */

test('static artifact route streams the installer with Content-Length and application/octet-stream', async () => {
    const release = store.releases.find((r) => r.version === '2.1.0');
    const expected = fs.readFileSync(path.join(releasesDir, release.file_name));

    const head = await fetch(`${base}/releases/${release.file_name}`, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(head.headers.get('content-type'), 'application/octet-stream');
    assert.equal(head.headers.get('content-length'), String(expected.length));
    assert.equal(head.headers.get('cache-control'), 'public, max-age=31536000, immutable');

    const response = await fetch(`${base}/releases/${release.file_name}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/octet-stream');
    assert.equal(response.headers.get('content-length'), String(expected.length));
    assert.equal(response.headers.get('accept-ranges'), 'bytes');
    const body = Buffer.from(await response.arrayBuffer());
    assert.equal(sha256(body), release.sha256);

    const partial = await fetch(`${base}/releases/${release.file_name}`, { headers: { Range: 'bytes=0-99' } });
    assert.equal(partial.status, 206);
    assert.equal(partial.headers.get('content-length'), '100');
});

test('static artifact route returns 404 for unknown or malformed names', async () => {
    assert.equal((await fetch(`${base}/releases/RobustTailor_9.9.9_x64-setup.exe`)).status, 404);
    assert.equal((await fetch(`${base}/releases/..%2Fpackage.json`)).status, 404);
    assert.equal((await fetch(`${base}/releases/package.json`)).status, 404);
});

/* ---------- delete ---------- */

test('DELETE only removes unpublished releases, together with their file', async () => {
    const published = store.releases.find((r) => r.version === '2.1.0');
    const unpublished = store.releases.find((r) => r.version === '2.2.0-beta.1');
    assert.equal(unpublished.published, false);

    const refused = await remove(published.id);
    assert.equal(refused.status, 409);
    assert.match((await refused.json()).error, /unpublish/i);

    assert.equal((await remove(unpublished.id, nonAdminToken)).status, 401);
    assert.equal((await remove(unpublished.id)).status, 200);
    assert.equal((await remove(unpublished.id)).status, 404);
    assert.ok(!fs.existsSync(path.join(releasesDir, unpublished.file_name)));
    assert.deepEqual(filesOnDisk(), ['RobustTailor_2.0.5_x64-setup.exe', 'RobustTailor_2.1.0_x64-setup.exe', 'RobustTailor_2.2.0_x64-setup.exe']);
});
