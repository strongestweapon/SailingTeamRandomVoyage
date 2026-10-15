"""Build the standalone map tool from the versioned sources, without downloads."""
from pathlib import Path

root = Path(__file__).resolve().parent.parent
source = root / 'work' / 'route-studio' / 'dist'
target = root / 'outputs' / 'Random-Voyage-Map-Studio.html'
html = (source / 'index.html').read_text(encoding='utf-8')
stylesheet = '<link rel="stylesheet" href="style.css">'
if html.count(stylesheet) != 1:
    raise ValueError('Expected exactly one style.css reference')
html = html.replace(stylesheet, '<style>' + (source / 'style.css').read_text(encoding='utf-8') + '</style>')
for name in ['data.js', 'backgrounds.js', 'renderer.js', 'highres.js', 'app.js']:
    reference = '<script src="' + name + '"></script>'
    if html.count(reference) != 1:
        raise ValueError('Expected exactly one script reference: ' + name)
    script = (source / name).read_text(encoding='utf-8').replace('</script', '<\\/script')
    html = html.replace(reference, '<script>' + script + '</script>')
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(html, encoding='utf-8')
print('Built ' + str(target))
