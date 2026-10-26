#!/usr/bin/env python3
"""Builds the Etsy download: index.html and the PDFs at the top, everything else in app/.

Reads the last commit (not the working folder), so unfinished edits never ship.
Usage: python3 build-customer-zip.py [output folder, default ~/Desktop/etsy]
"""
import json, pathlib, shutil, subprocess, sys, zipfile

NAME = 'AllocateStudio-BudgetPlanner'
PDFS = ['Budget_Planner_Welcome.pdf', 'Budget_Planner_StartHere.pdf']
repo = pathlib.Path(__file__).resolve().parent
out_root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '~/Desktop/etsy').expanduser()


def committed(path, binary=False):
    data = subprocess.run(['git', 'show', 'HEAD:' + path], cwd=repo, capture_output=True, check=True).stdout
    return data if binary else data.decode()


def replace(text, old, new):
    assert old in text, old
    return text.replace(old, new)


folder = out_root / NAME
if folder.exists():
    shutil.rmtree(folder)
app = folder / 'app'
(app / 'assets' / 'fonts').mkdir(parents=True)

# One script and one stylesheet instead of several loose files.
(app / 'app.bundle.js').write_text(
    '\n'.join(committed(f) for f in ['engine.js', 'month-picker.js', 'app.js'])
)
(app / 'styles.css').write_text(committed('styles.css') + '\n' + committed('budget.css'))

html = committed('index.html')
html = replace(html, 'href="styles.css"', 'href="app/styles.css"')
html = replace(html, '    <link rel="stylesheet" href="budget.css" />\n', '')
html = replace(html, 'href="assets/', 'href="app/assets/')
html = replace(html, 'href="manifest.webmanifest"', 'href="app/manifest.json"')
html = replace(
    html,
    '    <script src="engine.js"></script>\n    <script src="month-picker.js"></script>\n    <script src="app.js"></script>',
    '    <script src="app/app.bundle.js"></script>',
)
(folder / 'index.html').write_text(html)

manifest = json.loads(committed('manifest.webmanifest'))
manifest['start_url'] = '../index.html'
(app / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')

assets = subprocess.run(
    ['git', 'ls-tree', '-r', '--name-only', 'HEAD', 'assets'], cwd=repo, capture_output=True, text=True, check=True
).stdout.split()
for path in assets:
    (app / path).parent.mkdir(parents=True, exist_ok=True)
    (app / path).write_bytes(committed(path, binary=True))

missing = []
for pdf in PDFS:
    source = out_root / pdf
    if source.exists():
        shutil.copy2(source, folder / pdf)
    else:
        missing.append(pdf)

zip_path = out_root / (NAME + '.zip')
zip_path.unlink(missing_ok=True)
with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as z:
    for f in sorted(folder.rglob('*')):
        if f.is_file() and f.name != '.DS_Store':
            z.write(f, f.relative_to(out_root))

print(zip_path)
if missing:
    print('Missing PDFs, not in the zip:', ', '.join(missing))
