import re

with open("model/best.tflite", "rb") as f:
    data = f.read()

# Let's search for ascii strings of length >= 4
strings = re.findall(b"[a-zA-Z0-9_\\-\\./ ]{4,100}", data)
unique_strings = sorted(list(set(strings)))

print("Found", len(unique_strings), "strings.")
# Print strings that might look like classes or label names
for s in unique_strings:
    s_dec = s.decode('ascii', errors='ignore')
    if any(keyword in s_dec.lower() for keyword in ["sigatoka", "moko", "wilt", "panama", "healthy", "leaf", "disease", "banana", "spot", "black", "yellow", "class", "label"]):
        print(s_dec)
