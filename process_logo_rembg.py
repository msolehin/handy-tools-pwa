import sys
from PIL import Image
from rembg import remove

image_path = r"C:\Users\msole\.gemini\antigravity-ide\brain\81b59fd3-73e2-4304-b54d-e73dc524ed5c\media__1780564342711.png"
output_logo_path = r"c:\laragon\www\handy-tools-pwa\public\logo.png"
output_favicon_path = r"c:\laragon\www\handy-tools-pwa\public\favicon.png"

def process_image():
    # 1. Remove background using rembg
    with open(image_path, 'rb') as i:
        input_data = i.read()
        
    output_data = remove(input_data)
    
    with open(output_logo_path, 'wb') as o:
        o.write(output_data)
        
    # 2. Crop to bounding box
    img = Image.open(output_logo_path).convert("RGBA")
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
        img.save(output_logo_path, "PNG")
        
    # 3. Extract the thunder for favicon
    width, height = img.size
    pixels = img.load()
    
    gap_x = -1
    in_thunder = False
    for x in range(width):
        col_has_alpha = False
        for y in range(height):
            # Check alpha channel > threshold to avoid compression artifacts
            if pixels[x, y][3] > 20:
                col_has_alpha = True
                break
        
        if col_has_alpha:
            in_thunder = True
        elif in_thunder and not col_has_alpha:
            gap_x = x
            break
            
    if gap_x != -1:
        thunder = img.crop((0, 0, gap_x, height))
        thunder_bbox = thunder.getbbox()
        if thunder_bbox:
            thunder = thunder.crop(thunder_bbox)
        thunder.save(output_favicon_path, "PNG")
    else:
        size = min(width, height)
        thunder = img.crop((0, 0, size, height))
        thunder.save(output_favicon_path, "PNG")

if __name__ == "__main__":
    process_image()
    print("Logo processed successfully with rembg.")
