from pathlib import Path
import re
from bs4 import BeautifulSoup

paths = [
    Path('/home/ubuntu/browser_html/trabzon_bel_tr_SehirKameralari_1788948316652.html'),
    Path('/home/ubuntu/browser_html/altinordu_bel_tr_sehir-kameralari_1788949408788.html'),
]
patterns = re.compile(r'(https?://[^\"\'<>\s]+|[^\"\'<>\s]+\.(?:m3u8|mp4|mjpg|mjpeg)(?:\?[^\"\'<>\s]*)?)', re.I)
for path in paths:
    print(f'--- {path.name} ---')
    text = path.read_text(errors='ignore')
    soup = BeautifulSoup(text, 'html.parser')
    urls = []
    for tag in soup.find_all(['video', 'source', 'iframe', 'script', 'a']):
        for attr in ('src', 'href', 'data-src', 'data-url', 'data-stream', 'data-playlist'):
            value = tag.get(attr)
            if value:
                urls.append(value)
        if tag.name == 'script' and tag.string:
            urls.extend(patterns.findall(tag.string))
    for value in sorted(set(urls)):
        if any(token in value.lower() for token in ('m3u8', 'mjpeg', 'mjpg', 'webrtc', 'player', 'stream', 'video', 'yayin')):
            print(value)
    print('CAMERA_IDS', sorted(set(re.findall(r'data-cam-id=[\"\'](\d+)', text))))
