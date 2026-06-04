import sys
from PIL import Image

image_path = r"C:\Users\msole\.gemini\antigravity-ide\brain\81b59fd3-73e2-4304-b54d-e73dc524ed5c\media__1780564342711.png"
output_logo_path = r"c:\laragon\www\handy-tools-pwa\public\logo.png"
output_favicon_path = r"c:\laragon\www\handy-tools-pwa\public\favicon.png"

def process_image():
    img = Image.open(image_path).convert("RGBA")
    data = img.getdata()
    
    newData = []
    for item in data:
        # Change all white (also shades of whites)
        # to transparent
        if item[0] > 240 and item[1] > 240 and item[2] > 240:
            newData.append((255, 255, 255, 0))
        else:
            newData.append(item)
            
    img.putdata(newData)
    
    # Get bounding box of non-transparent pixels
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
        
    img.save(output_logo_path, "PNG")
    
    # To get the thunder, we look for the first vertical gap of transparent pixels
    # scanning from left to right.
    width, height = img.size
    pixels = img.load()
    
    gap_x = -1
    in_thunder = False
    for x in range(width):
        col_has_alpha = False
        for y in range(height):
            if pixels[x, y][3] > 0:
                col_has_alpha = True
                break
        
        if col_has_alpha:
            in_thunder = True
        elif in_thunder and not col_has_alpha:
            # We found the gap!
            gap_x = x
            break
            
    if gap_x != -1:
        # Crop the thunder
        thunder = img.crop((0, 0, gap_x, height))
        # Crop thunder again to its exact bounding box
        thunder_bbox = thunder.getbbox()
        if thunder_bbox:
            thunder = thunder.crop(thunder_bbox)
        thunder.save(output_favicon_path, "PNG")
    else:
        # If no gap found, just save a square from the left
        size = min(width, height)
        thunder = img.crop((0, 0, size, height))
        thunder.save(output_favicon_path, "PNG")

if __name__ == "__main__":
    process_image()
    print("Logo processed successfully.")
