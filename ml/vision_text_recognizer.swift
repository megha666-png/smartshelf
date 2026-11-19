
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
    print(recognizedStrings.joined(separator: "\n"))
}

request.recognitionLevel = .accurate
request.usesLanguageCorrection = true

let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
try? handler.perform([request])
