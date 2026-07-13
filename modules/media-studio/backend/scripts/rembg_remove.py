#!/usr/bin/env python3
"""Détourage fond — rembg (U2-Net / ISNet). Usage: rembg_remove.py in.png out.png [model]"""

import sys

def main():
    if len(sys.argv) < 3:
        print("Usage: rembg_remove.py input.png output.png [model]", file=sys.stderr)
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]
    model = sys.argv[3] if len(sys.argv) > 3 else "u2net"

    try:
        from rembg import remove, new_session
    except ImportError:
        print(
            "rembg non installé. Exécutez: pip install rembg onnxruntime pillow",
            file=sys.stderr,
        )
        sys.exit(2)

    with open(input_path, "rb") as f:
        data = f.read()

    session = new_session(model)
    result = remove(data, session=session)

    with open(output_path, "wb") as f:
        f.write(result)

    print("ok")

if __name__ == "__main__":
    main()
