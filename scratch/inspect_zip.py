import zipfile

tflite_path = "model/best.tflite"
with zipfile.ZipFile(tflite_path, 'r') as zip_ref:
    content = zip_ref.read('metadata.json').decode('utf-8', errors='ignore')
    print("Metadata content length:", len(content))
    print(content[:2000]) # print first 2000 chars
