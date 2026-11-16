#!/usr/bin/env python3
"""Build only the FERRO workshop as one offline HTML; never rebuild the game."""
import argparse, pathlib, re
ROOT=pathlib.Path(__file__).resolve().parents[1]
def build(destination):
    editor=ROOT/'editor'
    html=(editor/'index.html').read_text()
    css=(editor/'style.css').read_text()
    html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+css+'</style>')
    def inline(match):
        source=(editor/match.group(1)).resolve()
        if not source.is_relative_to(ROOT):
            raise ValueError('Script outside the checkout')
        return '<script>\n'+source.read_text().replace('</script','<\\/script')+'\n</script>'
    html=re.sub(r'<script src="([^"]+)"></script>',inline,html)
    destination.parent.mkdir(parents=True,exist_ok=True)
    destination.write_text(html)
    print(str(destination)+' ('+str(destination.stat().st_size)+' bytes)')
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--output',type=pathlib.Path,default=ROOT/'dist/ferro-editor.html');build(p.parse_args().output.resolve())
