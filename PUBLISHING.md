# Publishing Note Compass

This takes the plugin from a private repository to an entry in the Obsidian community plugin list.
Run every command from the repository root, on `main`, with a clean working tree. Nothing here has
been run for you: no tag exists, no release exists and the repository is still private.

## 1. Pre-flight checks

```sh
curl -s https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugins.json \
  | grep -c '"id": "note-compass"'
```

This must print `0`. The id is the primary key of the entry in `community-plugins.json`, so an id
already listed belongs to someone else and the submission would be refused.

```sh
cat manifest.json versions.json
```

The manifest must say `"id": "note-compass"`, `"name": "Note Compass"`, a `version` such as `0.1.0`
with no `v` prefix, the `minAppVersion`, a one-sentence `description` and the `author`. The id is
permanent once the entry is merged, and a different id later is a different plugin that existing users
never receive. `versions.json` must hold a line mapping that same `version` to that `minAppVersion`,
because it is how older installs know which release they can run.

```sh
git ls-files README.md LICENSE styles.css docs/images
```

This must list `README.md`, `LICENSE`, `styles.css` and every screenshot in `docs/images`, because the
review and the plugin browser read them from the repository. The README is the user manual, and the
plugin browser shows it as the plugin's page.

```sh
grep -o 'docs/images/[^)]*' README.md | sort -u | while read -r image; do
  git ls-files --error-unmatch "$image" > /dev/null || echo "missing: $image"
done
```

This must print nothing. Every image in the README is a relative `docs/images/...` path, which GitHub
and the plugin browser resolve against the default branch, so an image that is not committed on `main`
shows as a broken link. After step 2, open the README on GitHub to confirm the
screenshots render.

```sh
npm ci && npm run typecheck && npm test && npm run lint && npm run build
```

This must pass, because the release workflow runs the same tests, lint and build and publishes nothing
when one of them fails.

## 2. Make the repository public

```sh
gh repo edit carlesba/obsidian-note-compass --visibility public \
  --accept-visibility-change-consequences
```

This is the irreversible step. Making the repository public exposes the whole history to anyone and to
forks and caches you do not control, and flipping it back does not withdraw what was read.

## 3. Release through the workflow

```sh
git push origin main
git tag -a 0.1.0 -m "First public release."
git push origin 0.1.0
```

The tag must be exactly the `version` in `manifest.json`, because Obsidian resolves a release by that
string. Pushing a tag that matches `*.*.*` runs `.github/workflows/release.yml`, which checks that the
tag equals the manifest `version`, runs the tests, the lint and the build, attests `main.js`,
`manifest.json` and `styles.css` with GitHub artifact attestations, and publishes a release with those
three files attached and the tag's message as its notes. Never create the release by hand: a release
uploaded from a laptop has no attestations, and `main.js` is gitignored, so it only exists as a
release asset.

```sh
gh run watch "$(gh run list --workflow release.yml --limit 1 --json databaseId -q '.[0].databaseId')"
gh release view 0.1.0
```

The release must list `main.js`, `manifest.json` and `styles.css` as individual assets. If the run
fails, no release exists and nobody can have installed the tag yet, so fix the cause on `main`, move
the tag onto the fix with `git tag -fa 0.1.0` and `git push --force origin 0.1.0`, and the workflow
runs again. Once a release is published the tag is final, and a mistake is fixed by releasing the
next patch version.

## 4. Submit through the developer dashboard

Obsidian moved submissions off GitHub in May 2026. `community-plugins.json` in
`obsidianmd/obsidian-releases` is now mirrored hourly from
`https://community.obsidian.md/assets/community-plugins.json`, so a pull request editing it is reverted
within the hour and is no longer the way in.

The dashboard needs two accounts only you can sign into, so this step cannot be scripted:

1. Open <https://community.obsidian.md> and sign in with your Obsidian account, the one your licence
   and forum login use, not GitHub.
2. Link your GitHub account to that profile, which is how the directory proves you own the
   repository.
3. Add `carlesba/obsidian-note-compass` as a plugin. The dashboard reads `manifest.json` from the
   head of the default branch, so the `id`, `name`, `version`, `description` and `author` it lists are
   whatever is committed on `main`.

If the dashboard answers `Please wait before trying again`, it has rate-limited you without saying for
how long, and clicking again extends it. Come back later and click once.

## 5. After you submit

The automated review checks the developer policies, code quality and known vulnerabilities, and
usually reports within a few minutes. A plugin that passes is searchable inside Obsidian within 24
hours. A plugin that fails shows the findings in the dashboard, and you clear them by publishing a new
release with a higher version, because the review scans releases rather than the repository.

Every later release is scanned too, and a release that fails review delists the plugin from search
within 24 hours until a passing release exists.

## Releasing an update later

Bump `version` in both `manifest.json` and `package.json`, run `npm install --package-lock-only` so
`package-lock.json` follows, raise `minAppVersion` if the update needs a
newer Obsidian, and add the matching line to `versions.json`. Then check locally what the workflow and
the review will check:

```sh
npm ci && npm test && npm run lint && npm run build
```

`npm run lint` runs `eslint-plugin-obsidianmd`, the same rules the review applies. Then commit, push
and tag as in step 3, with the new version and a one-line message saying what changed:

```sh
git commit -am "Release 0.2.0"
git push origin main
git tag -a 0.2.0 -m "<what changed, in one line>"
git push origin 0.2.0
```

Obsidian picks the update up from the new release on its own, so there is nothing to resubmit.
