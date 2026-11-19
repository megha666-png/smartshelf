"""
macOS Native Apple Vision OCR Integration for SmartShelf.
Uses VNRecognizeTextRequest to extract text printed on packaging from images with high accuracy.
"""

import os
import sys
import subprocess
import tempfile
import base64
from typing import List, Optional

SWIFT_OCR_SCRIPT = """
import Foundation
import Vision
import AppKit

guard CommandLine.arguments.count > 1 else {
    print("")
    exit(0)
}

let imagePath = CommandLine.arguments[1]
guard let image = NSImage(contentsOfFile: imagePath),
      let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    print("")
    exit(0)
}

let request = VNRecognizeTextRequest { request, error in
    guard let observations = request.results as? [VNRecognizedTextObservation] else { return }
    var recognizedStrings = [String]()
    for obs in observations {
        if let topCandidate = obs.topCandidates(1).first {
            recognizedStrings.append(topCandidate.string)
        }
    }
    print(recognizedStrings.joined(separator: "\\n"))
}

request.recognitionLevel = .accurate
request.usesLanguageCorrection = true

let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
try? handler.perform([request])
"""

class VisionOCR:
    def __init__(self):
        self.swift_path = self._ensure_swift_script()

    def _ensure_swift_script(self) -> Optional[str]:
        script_path = os.path.join(os.path.dirname(__file__), "vision_text_recognizer.swift")
        try:
            with open(script_path, "w", encoding="utf-8") as f:
                f.write(SWIFT_OCR_SCRIPT)
            return script_path
        except Exception as e:
            return None

    def extract_text_from_image_path(self, image_path: str) -> str:
        if not os.path.exists(image_path):
            return ""

        # Priority 1: Node Tesseract OCR service (accurate & cross-platform)
        node_script = os.path.join(os.path.dirname(__file__), "node_ocr_service.js")
        if os.path.exists(node_script):
            try:
                proc = subprocess.run(
                    ["node", node_script, image_path],
                    capture_output=True,
                    text=True,
                    timeout=15
                )
                if proc.returncode == 0 and proc.stdout.strip():
                    return proc.stdout.strip()
            except Exception:
                pass

        # Priority 2: Swift OCR if available on macOS
        if self.swift_path:
            try:
                proc = subprocess.run(
                    ["swift", self.swift_path, image_path],
                    capture_output=True,
                    text=True,
                    timeout=5
                )
                if proc.stdout.strip():
                    return proc.stdout.strip()
            except Exception:
                pass

        return ""

    def extract_text_from_base64(self, b64_str: str) -> str:
        if not b64_str:
            return ""
        try:
            if "," in b64_str:
                raw_b64 = b64_str.split(",", 1)[1]
            else:
                raw_b64 = b64_str

            img_bytes = base64.b64decode(raw_b64)
            with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
                tmp.write(img_bytes)
                tmp_path = tmp.name

            try:
                text = self.extract_text_from_image_path(tmp_path)
            finally:
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)

            return text
        except Exception:
            return ""

# Singleton
ocr_engine = VisionOCR()
