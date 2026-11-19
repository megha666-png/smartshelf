#import <Foundation/Foundation.h>
#import <Vision/Vision.h>
#import <AppKit/AppKit.h>

int main(int argc, const char * argv[]) {
    @autoreleasepool {
        if (argc < 2) {
            return 0;
        }
        NSString *path = [NSString stringWithUTF8String:argv[1]];
        NSImage *image = [[NSImage alloc] initWithContentsOfFile:path];
        if (!image) {
            return 0;
        }
        CGImageRef cgImage = [image CGImageForProposedRect:nil context:nil hints:nil];
        if (!cgImage) {
            return 0;
        }

        VNRecognizeTextRequest *request = [[VNRecognizeTextRequest alloc] initWithCompletionHandler:^(VNRequest * _Nonnull req, NSError * _Nullable error) {
            if (error) return;
            NSArray *observations = req.results;
            NSMutableArray *lines = [NSMutableArray array];
            for (VNRecognizedTextObservation *obs in observations) {
                VNRecognizedText *top = [[obs topCandidates:1] firstObject];
                if (top) {
                    [lines addObject:top.string];
                }
            }
            NSString *full = [lines componentsJoinedByString:@"\n"];
            printf("%s\n", [full UTF8String]);
        }];

        request.recognitionLevel = VNRequestTextRecognitionLevelAccurate;
        request.usesLanguageCorrection = YES;

        VNImageRequestHandler *handler = [[VNImageRequestHandler alloc] initWithCGImage:cgImage options:@{}];
        NSError *err = nil;
        [handler performRequests:@[request] error:&err];
    }
    return 0;
}
