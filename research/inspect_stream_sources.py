from pathlib import Path
from bs4 import BeautifulSoup
import re

paths = [
    Path('/home/ubuntu/browser_html/trabzon_bel_tr_SehirKameralari_1788778616692.html'),
    Path('/home/ubuntu/browser_html/aloula_sba_sa_quran_1788778730794.html'),
]
url_re = re.compile(r'https?://[^\"\'\\s<>]+|(?:/|\./)[^\"\'\\s<>]*(?:m3u8|camera|kamera|stream|live)[^\"\'\\s<>]*', re.I)
for path in paths:
    print(f'--- {path} ---')
    if not path.exists():
        print('missing')
        continue
    text = path.read_text(errors='ignore')
    print('bytes', len(text))
    soup = BeautifulSoup(text, 'html.parser')
    print('scripts', len(soup.find_all('script')), 'iframes', len(soup.find_all('iframe')), 'videos', len(soup.find_all('video')), 'images', len(soup.find_all('img')))
    for tag in soup.find_all(['script','iframe','video','source','img','a']):
        attrs = ' '.join(f'{k}={v}' for k,v in tag.attrs.items() if k in {'src','href','data-src','data-url','data-id','id','class'})
        if attrs and re.search(r'camera|kamera|stream|live|video|m3u8|webp|youtube|shahid|sba', attrs, re.I):
            print(tag.name, attrs[:500])
    urls = []
    for m in url_re.findall(text):
        if m not in urls:
            urls.append(m)
    print('candidate urls')
    for url in urls[:120]: print(url[:700])
    print('inline camera/live snippets')
    for match in re.finditer(r'camera|kamera|m3u8|stream|live|webp', text, flags=re.I):
        print(text[max(0, match.start()-180):match.start()+420].replace('\n',' ')[:650])
        if match.start() > 0 and sum(1 for _ in []) > 20: break
