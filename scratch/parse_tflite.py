import struct

def parse_tflite_tensors(path):
    with open(path, "rb") as f:
        buf = f.read()
        
    # We want to find potential shape vectors.
    # In flatbuffers, a vector of ints is represented as a 32-bit count followed by that many 32-bit values.
    # Let's search for sequences of 4-byte integers that look like shape vectors.
    # A shape vector usually has length 1 to 5.
    # Let's scan the file for patterns: length (1 to 5) followed by integers between 1 and 2000.
    # We can scan at 4-byte alignments.
    shapes = set()
    for idx in range(0, len(buf) - 24, 4):
        length = struct.unpack("<I", buf[idx:idx+4])[0]
        if 1 <= length <= 6:
            vals = []
            valid = True
            for j in range(length):
                val = struct.unpack("<i", buf[idx+4+j*4:idx+8+j*4])[0]
                if val <= 0 or val > 10000:
                    valid = False
                    break
                vals.append(val)
            if valid:
                shapes.add(tuple(vals))
                
    print("Found potential shape-like vectors:")
    for s in sorted(shapes):
        # Only print shapes that look like neural network tensor shapes (e.g. have 2 to 5 dimensions, and include batch size 1)
        if len(s) >= 2 and s[0] == 1:
            print(s)

parse_tflite_tensors("model/best.tflite")
