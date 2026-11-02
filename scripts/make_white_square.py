import sys
from PIL import Image

def process(input_png, output_jpg, size=600, quality=88):
    im = Image.open(input_png).convert('RGBA')
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    w, h = im.size
    if w <= 0 or h <= 0:
        return
    max_dim = max(w, h)
    padding = int(max_dim * 0.08)
    c_dim = max_dim + padding * 2
    canvas = Image.new('RGB', (c_dim, c_dim), (255, 255, 255))
    canvas.paste(im, ((c_dim - w) // 2, (c_dim - h) // 2), mask=im.split()[3])
    canvas = canvas.resize((size, size), Image.Resampling.LANCZOS)
    canvas.save(output_jpg, 'JPEG', quality=quality)

if __name__ == '__main__':
    if len(sys.argv) >= 3:
        process(sys.argv[1], sys.argv[2])

